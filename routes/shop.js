const router = require('express').Router();
const { STRIPE_SK, STRIPE_PK, NODE_ENV, EXCHANGERATE_API_KEY } = process.env;
const Stripe = new (require('stripe').Stripe)(STRIPE_SK);
const { v2: cloud } = require('cloudinary');
const { default: axios } = require('axios');
const { each } = require('async');
const { isAuthed } = require('../config/config');
const { Product } = require('../models/models');
const MailingListMailTransporter = require('../config/mailingListMailTransporter');
const curr_symbols = require('../config/currSymbols');
const production = NODE_ENV === "production";
const axiosRequestUri = `https://v6.exchangerate-api.com/v6/${EXCHANGERATE_API_KEY}/latest/GBP`;

router.get("/", async (req, res) => {
    const products = await Product.find();
    const rates = req.session.rates = req.session.rates || (await axios.get(axiosRequestUri)).data.conversion_rates;
    res.render('shop', { title: "Shop", pagename: "shop", products, curr_symbols, rates })
});

router.get("/checkout", (req, res) => {
    if (!req.session.cart.length) return res.redirect(req.get("referrer"));
    res.render('checkout', { title: "Checkout", pagename: "checkout" })
});

router.get("/cart", (req, res) => {
    res.render('cart', { title: "Cart", pagename: "cart", cart: req.session.cart })
});

router.post("/fx", (req, res) => {
    const rate = req.session.rates[req.body.currency];
    const symbol = curr_symbols[req.body.currency];
    const currency = req.session.currency = req.body.currency.toLowerCase();
    req.session.fx_rate = rate;
    req.session.currency_symbol = symbol || currency.toUpperCase();
    res.send({ rate, symbol, currency });
});

router.post("/stock/add", isAuthed, async (req, res) => {
    const { name, price, stock_qty, info, image_file, image_url } = req.body;
    try {
        const product = await Product.create({ name, price, stock_qty, info });
        if (!image_url && !image_file) return res.send("Product saved in stock");
        const public_id = `shop/stock/${product.name.replace(/ /g, "-")}`.replace(/[ ?&#\\%<>]/g, "_");
        const result = await cloud.uploader.upload(image_url || image_file, { public_id });
        product.image = result.secure_url;
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
        if (!image_url && !image_file) return res.send("Product details updated successfully");
        const public_id = `shop/stock/${saved.name.replace(/ /g, "-")}`.replace(/[ ?&#\\%<>]/g, "_");
        await cloud.api.delete_resources([prev_p_id]);
        const result = await cloud.uploader.upload(image_url || image_file, { public_id });
        saved.image = result.secure_url;
        await saved.save();
        for (const item of req.session.cart) if (item.id === saved.id) item.image = result.secure_url;
        res.send("Product details updated successfully");
    } catch (err) { res.status(err.http_code || 500).send(err.message) }
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
        const missing = err.message === "Product(s) not found";
        res.status(missing ? 404 : 500).send(missing ? "Product(s) not found" : err.message);
    }
});

router.post("/cart/add", async (req, res) => {
    const product = await Product.findById(req.body.id).catch(err => null);
    if (!product || product.stock_qty < 1) return res.status(!product ? 404 : 400).send("Item currently not in stock");
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
    const total = req.session.cart.length ? req.session.cart.map(itm => itm.price * itm.qty).reduce((t, p) => t + p) : 0;
    res.send({ total: req.session.converted_price(total), quantity: 0 });
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
    const total = req.session.cart.map(itm => itm.price * itm.qty).reduce((t, p) => t + p);
    res.send({ total: req.session.converted_price(total), quantity: currentItem.qty });
});

router.post("/checkout/payment-intent/create", async (req, res) => {
    const { firstname, lastname, email, address_l1, address_l2, city, postcode } = req.body;
    const { cart, currency_symbol, converted_price } = req.session;
    const name = `${firstname} ${lastname}`;
    const address = { line1: address_l1, line2: address_l2, city, postal_code: postcode };

    const customer = await Stripe.customers.create({ name, email, shipping: { name, address } });

    Stripe.paymentIntents.create({ // Create a PaymentIntent with the order details
        customer: customer.id,
        description: cart.map(p => `${p.name} (${currency_symbol}${converted_price(p.price).toFixed(2)} X ${p.qty})`).join(", \r\n"),
        amount: cart.map(p => p.price * p.qty).reduce((sum, val) => sum + val),
        currency: "gbp"
    }).then(pi => {
        req.session.paymentIntentID = pi.id;
        res.send({ clientSecret: pi.client_secret, pk: STRIPE_PK });
    }).catch(err => res.status(err.statusCode).send(err.message));
});

router.post("/checkout/payment-intent/complete", async (req, res) => {
    try {
        const pi = await Stripe.paymentIntents.retrieve(req.session.paymentIntentID, { expand: "customer" });
        const products = await Product.find();
        if (!pi) return res.status(404).send("Invalid payment session");
        if (pi.status !== "succeeded") return res.status(500).send(pi.status.replace(/_/g, " "));
        if (production) await Promise.all(req.session.cart.map(item => {
            const product = products.find(p => p.id === item.id);
            if (!product) return null;
            product.stock_qty -= item.qty;
            if (product.stock_qty < 0) product.stock_qty = 0;
            return product.save();
        }));
        req.session.cart = [];
        req.session.paymentIntentID = undefined;

        const { line1, line2, city, postal_code } = pi.shipping.address;
        const transporter = new MailingListMailTransporter({ req, res });
        console.log(pi);
        const receipt_email = pi.receipt_email || pi.customer.email;
        const subject = "Purchase Nofication: Payment Successful";
        const message = `Hi ${pi.shipping.name},\n\n` +
        `Your payment was successful. Below is a summary of your purchase:\n\n${pi.charges.data[0].description}\n\n` +
        `If you have not yet received your receipt via email, you can view it here instead:\n${pi.charges.data[0].receipt_url}\n\n` +
        "Thank you for shopping with us!\n\n- CS";
        transporter.setRecipient(receipt_email).sendMail({ subject, message }, err => {
            if (err) console.error(err), res.status(500);
            const subject = "Purchase Report: You Got Paid!";
            const message = "You've received a new purchase from a new customer. Summary shown below\n\n" +
            `- Name: ${pi.shipping.name}\n- Email: ${receipt_email}\n- Purchased items: ${pi.charges.data[0].description}\n` +
            `- Address:\n\t${line1},${line2 ? "\n\t"+line2+"," : ""}\n\t${city},\n\t${postal_code}\n\n` +
            `- Date of purchase: ${Date(pi.created * 1000)}\n` +
            `- Total amount: £${pi.amount / 100}\n\n` +
            `- And finally, a copy of their receipt:\n${pi.charges.data[0].receipt_url}`;
            transporter.setRecipient({ email: "info@thecs.co" }).sendMail({ subject, message }, err => {
                if (err) { console.error(err); if (res.statusCode !== 500) res.status(500) }
                res.end();
            });
        });
    } catch(err) { res.status(err.statusCode || 500).send(err.message) }
});

module.exports = router;
