const router = require('express').Router();
const { STRIPE_SK, STRIPE_PK, NODE_ENV, EXCHANGERATE_API_KEY } = process.env;
const Stripe = new (require('stripe').Stripe)(STRIPE_SK);
const { v2: cloud } = require('cloudinary');
const { default: axios } = require('axios');
const { each } = require('async');
const { isAuthed } = require('../config/config');
const { Product, Shipping_method } = require('../models/models');
const MailTransporter = require('../config/MailTransporter');
const currencies = require('../config/currencies');
const production = NODE_ENV === "production";
const number_separator_regx = /\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g;
const countries = require("../config/country-list");

router.get("/", async (req, res) => {
    const products = await Product.find();
    res.render('shop', { products, currencies })
});

router.get("/checkout", (req, res) => {
    if (!req.session.cart.length) return res.redirect(req.get("referrer"));
    res.render('checkout', { countries })
});

router.get("/cart", (req, res) => res.render('cart'));

router.post("/fx", async (req, res) => {
    const currency = currencies.find(c => c.code === req.body.currency_code?.toUpperCase());
    const url = `https://free.currconv.com/api/v7/convert?q=GBP_${currency?.code}&compact=ultra&apiKey=${EXCHANGERATE_API_KEY}`;
    const rate = await axios.get(url).then(r => r.data[`GBP_${currency?.code}`]).catch(e => null);
    if (!currency || !rate) return res.status(400).send("Unable to convert to this currency at this time\nPlease try again later");
    const symbol = req.session.currency_symbol = currency.symbol || currency.code;
    const currency_code = req.session.currency_code = currency.code;
    const converted_prices = (await Product.find()).map(p => ((p.price * rate)/100).toFixed(2).replace(number_separator_regx, ","));
    req.session.fx_rate = rate;
    req.session.currency_name = currency.name;
    res.send({ symbol, currency_code, converted_prices });
});

router.post("/stock/add", isAuthed, async (req, res) => {
    const { name, price, stock_qty, info, image_file, image_url } = req.body;
    try {
        const product = new Product({ name, price, stock_qty, info });
        const public_id = `shop/stock/${product.name.replace(/ /g, "-")}`.replace(/[ ?&#\\%<>]/g, "_");
        const result = image_url || image_file ? await cloud.uploader.upload(image_url || image_file, { public_id }) : null;
        if (result) product.image = result.secure_url;
        await product.save(); res.send("Product saved in stock");
    } catch (err) { res.status(err.http_code || 500).send(err.message) }
});

router.post('/stock/edit', isAuthed, async (req, res) => {
    const { product_id, name, price, stock_qty, info, image_file, image_url } = req.body;
    try {
        const product = await Product.findById(product_id);
        if (!product) return res.status(404).send("Product not found");

        const prev_p_id = `shop/stock/${product.name.replace(/ /g, "-")}`.replace(/[ ?&#\\%<>]/g, "_");
        if (name) product.name = name;
        if (price) product.price = price;
        if (info) product.info = info;
        if (stock_qty) product.stock_qty = stock_qty;
        if (stock_qty) req.session.cart = req.session.cart.map(item => {
            if (item.id === product.id) item.stock_qty = stock_qty;
            return item;
        });

        const saved = await product.save();
        const public_id = `shop/stock/${saved.name.replace(/ /g, "-")}`.replace(/[ ?&#\\%<>]/g, "_");
        if (image_url || image_file) await cloud.api.delete_resources([prev_p_id]);
        const result = image_url || image_file ? await cloud.uploader.upload(image_url || image_file, { public_id }) : null;
        if (result) saved.image = result.secure_url;
        await saved.save();
        for (const item of req.session.cart) if (item.id === saved.id) item.image = result.secure_url;
        res.send("Product details updated successfully");
    } catch (err) { res.status(err.http_code || 400).send(err.message) }
});

router.post("/stock/remove", isAuthed, async (req, res) => {
    const ids = Object.values(req.body);
    if (!ids.length) return res.status(400).send("Nothing selected");
    try {
        const products = await Product.find({_id : { $in: ids }});
        await each(products, (item, cb) => {
            Product.deleteOne({ _id : item.id }, (err, result) => {
                if (err || !result.deletedCount) return cb(err || Error("Product(s) not found"));
                const p_id = `shop/stock/${item.name.replace(/ /g, "-")}`.replace(/[ ?&#\\%<>]/g, "_");
                cloud.api.delete_resources([p_id], () => cb());
            })
        });
        res.send(`Product${ids.length > 1 ? "s" : ""} deleted from stock successfully`);
    } catch (err) {
        res.status(err.message === "Product(s) not found" ? 404 : 500).send(err.message);
    }
});

router.post("/cart/add", async (req, res) => {
    const product = await Product.findById(req.body.id).catch(e => null);
    if (!product || product.stock_qty < 1) return res.status(404).send("Item currently not in stock");
    const { id, name, price, image, info, stock_qty } = product;
    const currentItem = req.session.cart.find(item => item.id === id);

    if (currentItem) {
        currentItem.qty += 1;
        if (currentItem.qty > stock_qty) currentItem.qty = stock_qty;
    } else {
        req.session.cart.unshift({ id, name, price, image, info, stock_qty, qty: 1 });
    }

    res.send(`${req.session.cart.length}`);
});

router.post("/cart/remove", (req, res) => {
    const cartItemIndex = req.session.cart.findIndex(item => item.id === req.body.id);
    if (cartItemIndex === -1) return res.status(400).send("The selected item is not found in your cart");
    req.session.cart.splice(cartItemIndex, 1);
    var total = req.session.cart.map(itm => itm.price * itm.qty).reduce((t, p) => t + p, 0);
    total = req.session.converted_price(total).toFixed(2).replace(number_separator_regx, ",");
    res.send({ total, quantity: 0, cart_empty: !req.session.cart.length });
});

router.post("/cart/increment", (req, res) => {
    const { id, quantity } = req.body;
    const currentItem = req.session.cart.find(item => item.id === id);
    if (!currentItem) return res.status(400).send("The selected item is not found in your cart");
    if (isNaN(quantity)) return res.status(400).send("Invalid value for quantity");
    const newQuantity = parseInt(quantity) || 1;
    const underMin = newQuantity < 1;
    const overMax = newQuantity > currentItem.stock_qty;
    currentItem.qty = underMin ? 1 : overMax ? currentItem.stock_qty : newQuantity;
    var total = req.session.cart.map(itm => itm.price * itm.qty).reduce((t, p) => t + p);
    total = req.session.converted_price(total).toFixed(2).replace(number_separator_regx, ",");
    res.send({ total, quantity: currentItem.qty });
});

router.post("/checkout/payment/create", async (req, res) => {
    const { firstname, lastname, email, address_l1, address_l2, city, state, country, postcode } = req.body;
    const { cart, location_origin } = Object.assign(req.session, res.locals);
    const price_total = cart.reduce((sum, p) => sum + (p.price * p.qty), 0);
    if (!price_total) return res.status(400).send("Unable to begin checkout - your basket is empty");

    try {
        const field_check = { firstname, lastname, email, "address line 1": address_l1, city, country, "post / zip code": postcode };
        const missing_fields = Object.keys(field_check).filter(k => !field_check[k]);
        const email_pattern = /^(?:[a-z0-9!#$%&'*+=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])$/i;
        if (missing_fields.length) return res.status(400).send(`Missing fields: ${missing_fields.join(", ")}`);
        if (!email_pattern.test(email)) return res.status(400).send("Invalid email format");

        const customer = await Stripe.customers.create({
            name: `${firstname} ${lastname}`,
            email,
            shipping: {
                name: `${firstname} ${lastname}`,
                address: { line1: address_l1, line2: address_l2, city, state, country, postal_code: postcode }
            }
        });

        const domestic = /GB|IE/i.test(country);
        const shipping_methods = await Shipping_method.find({ name: domestic ? /domestic|free|uk/i : /^((?!(domestic|free|uk)).)*$/i });

        const session = await Stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            customer: customer.id,
            payment_intent_data: { description: "CS Store Purchase" },
            line_items: cart.map(item => ({
                price_data: {
                    product_data: { name: item.name, images: item.image ? [item.image] : undefined },
                    unit_amount: parseInt(item.price),
                    currency: "gbp"
                },
                description: item.info || undefined,
                quantity: item.qty
            })),
            shipping_options: shipping_methods.map(method => ({
                shipping_rate_data: {
                    type: "fixed_amount",
                    fixed_amount: { amount: method.fee, currency: "gbp" },
                    display_name: method.name,
                    delivery_estimate: {
                        minimum: {
                            unit: method.delivery_estimate.minimum.unit.replace(/ /g, "_"),
                            value: method.delivery_estimate.minimum.value
                        },
                        maximum: {
                            unit: method.delivery_estimate.maximum.unit.replace(/ /g, "_"),
                            value: method.delivery_estimate.maximum.value
                        }
                    }
                }
            })),
            mode: "payment",
            success_url: location_origin + "/shop/checkout/payment/complete",
            cancel_url: location_origin + "/shop/checkout/payment/cancel"
        });

        req.session.checkout_session = session;
        res.send({ id: session.id, pk: STRIPE_PK });
    } catch(err) { console.error(err.message); res.status(err.statusCode || 500).send(err.message) };
});

router.get("/checkout/payment/complete", async (req, res) => {
    if (!req.session.cart.length) return res.status(400).render('error', { html: "Unable to complete checkout - session expired" });
    try {
        const { customer, payment_intent: pi } = await Stripe.checkout.sessions.retrieve(req.session.checkout_session?.id, { expand: ["customer", "payment_intent"] });
        if (pi.status !== "succeeded") return res.status(400).render('error', { html: `<p>${pi.status.replace(/_/g, " ")}</p>` });

        const products = await Product.find();
        const price_total = req.session.cart.reduce((sum, p) => sum + (p.price * p.qty));

        if (production) await Promise.all(req.session.cart.map(item => {
            const product = products.find(p => p.id === item.id);
            if (!product) return null;
            product.stock_qty -= item.qty;
            if (product.stock_qty < 0) product.stock_qty = 0;
            return product.save();
        }));

        req.session.cart = [];
        req.session.checkout_session = undefined;

        const { line1, line2, city, postal_code, state, country } = customer.shipping.address;
        const transporter = new MailTransporter();
        const subject = "Purchase Nofication: Payment Successful";
        const message = `Hi ${customer.name},\n\n` +
        "Your payment was successful. Please see below for your purchase receipt:\n\n" +
        `${pi.charges.data[0].receipt_url}\n\n` +
        "Thank you for shopping with us!\n\n- CS";
        transporter.setRecipient({ email: customer.email }).sendMail({ subject, message }, err => {
            if (err) console.error(err), res.status(500);
            const subject = "Purchase Report: You Got Paid!";
            const message = "You've received a new purchase from a new customer. Summary shown below\n\n" +
            `- Name: ${customer.name}\n- Email: ${customer.email}\n` +
            `- Address:\n\t${line1},${line2 ? "\n\t"+line2+"," : ""}\n\t${city}, ${country},` + (state ? ` ${state},` : "") + `\n\t${postal_code}\n\n` +
            `- Date of purchase: ${new Date().toDateString()}\n\n` +
            `- Total amount: £ ${(pi.amount / 100).toFixed(2).replace(number_separator_regx, ",")}` +
            (req.session.currency_code !== "GBP" ? ` (${req.session.currency_symbol} ${req.session.converted_price(price_total).toFixed(2).replace(number_separator_regx, ",")})` : "") +
            `\n\nAnd finally, a copy of their receipt:\n${pi.charges.data[0].receipt_url}`;
            transporter.setRecipient({ email: "info@thecs.co" }).sendMail({ subject, message }, err => {
                if (err) { console.error(err); if (res.statusCode !== 500) res.status(500) }
                res.render('checkout-success')
            });
        });
    } catch(err) { res.status(err.statusCode || 400).render('error', { html: `<p>${err.message}</p>` }) }
});

router.get("/checkout/payment/cancel", (req, res) => res.render('checkout-cancel'));

module.exports = router;
