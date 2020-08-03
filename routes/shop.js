const router = require('express').Router();
const stripe = require('stripe')(process.env.STRIPE_SK);
const cloud = require('cloudinary');
const { each } = require('async');
const { Product } = require('../models/models');
const MailingListMailTransporter = require('../config/mailingListMailTransporter');

router.get("/", (req, res) => {
    Product.find((err, products) => { res.render('shop', { title: "Shop", pagename: "shop", products }) })
});

router.get("/checkout", (req, res) => {
    if (!req.session.cart.length) return res.redirect(req.get("referrer"));
    res.render('checkout', { title: "Checkout", pagename: "checkout", pk: process.env.STRIPE_PK })
});

router.get("/cart", (req, res) => {
    res.render('cart', { title: "Cart", pagename: "cart", cart: req.session.cart })
});

router.post("/stock/add", (req, res) => {
    const { name, price, stock_qty, info, image_file, image_url } = req.body;
    new Product({ name, price, stock_qty, info }).save((err, saved) => {
        if (err) return res.status(500).send(err.message);
        if (!image_url && !image_file) return res.send("Product saved in stock");
        const public_id = ("shop/stock/" + saved.name.replace(/ /g, "-")).replace(/[ ?&#\\%<>]/g, "_");
        cloud.v2.uploader.upload(image_url || image_file, { public_id }, (err, result) => {
            if (err) return res.status(500).send(err.message);
            saved.image = result.secure_url;
            saved.save(() => { res.send("Product saved in stock") });
        });
    });
});

router.post('/stock/edit', (req, res) => {
    const { product_id, name, price, stock_qty, info, image_file, image_url } = req.body;
    Product.findById(product_id, (err, product) => {
        if (err || !product) return res.status(err ? 500 : 404).send(err ? err.message || "Error occurred" : "Product not found");

        const prefix = ("shop/stock/" + product.name.replace(/ /g, "-")).replace(/[ ?&#\\%<>]/g, "_");
        if (name)      product.name = name;
        if (price)     product.price = price;
        if (info)      product.info = info;
        if (stock_qty) product.stock_qty = stock_qty;

        product.save((err, saved) => {
            if (err) return res.status(500).send(err.message || "Error occurred whilst saving product");
            if (!image_url && !image_file) return res.send("Product details updated successfully");
            const public_id = ("shop/stock/" + saved.name.replace(/ /g, "-")).replace(/[ ?&#\\%<>]/g, "_");
            cloud.v2.api.delete_resources([prefix], err => {
                if (err) return res.status(500).send(err.message);
                cloud.v2.uploader.upload(image_url || image_file, { public_id }, (err, result) => {
                    if (err) return res.status(500).send(err.message);
                    saved.image = result.secure_url;
                    saved.save(() => { res.send("Product details updated successfully") });
                });
            })
        });
    })
});

router.post("/stock/remove", (req, res) => {
    const ids = Object.values(req.body);
    if (!ids.length) return res.send("Nothing selected");
    Product.find({_id : { $in: ids }}, (err, products) => {
        each(products, (item, cb) => {
            Product.deleteOne({ _id : item.id }, (err, result) => {
                if (err || !result.deletedCount) return cb(err ? err.message : "Product(s) not found");
                const prefix = ("shop/stock/" + item.name.replace(/ /g, "-")).replace(/[ ?&#\\%<>]/g, "_");
                cloud.v2.api.delete_resources([prefix], () => cb());
            })
        }, err => {
            if (!err) return res.send("Product"+ (ids.length > 1 ? "s" : "") +" deleted from stock successfully");
            let is404 = err.message === "Product(s) not found";
            res.status(!is404 ? 500 : 404).send(!is404 ? "Error occurred" : "Product(s) not found");
        })
    });
});

router.post("/cart/add", (req, res) => {
    Product.findById(req.body.id, (err, product) => {
        const { id, name, price, image, info, stock_qty } = product;
        if (!product || stock_qty < 1) return res.status(!product ? 404 : 400).send("Item currently not in stock");
        const cartItemIndex = req.session.cart.findIndex(item => item.id === id);
        const currentItem = req.session.cart[cartItemIndex];

        if (cartItemIndex >= 0) {
            currentItem.qty += 1;
            if (currentItem.qty > stock_qty) currentItem.qty = stock_qty;
        } else {
            req.session.cart.unshift({ id, name, price, image, info, stock_qty, qty: 1 });
        }

        res.send(`${req.session.cart.length}`);
    })
});

router.post("/cart/remove", (req, res) => {
    const cartItemIndex = req.session.cart.findIndex(item => item.id === req.body.id);
    req.session.cart.splice(cartItemIndex, 1);
    res.send(`${req.session.cart.length}`);
});

router.post("/cart/increment", (req, res) => {
    const { id, increment } = req.body;
    const cartItemIndex = req.session.cart.findIndex(item => item.id === id);
    const currentItem = req.session.cart[cartItemIndex];
    const newQuantity = currentItem.qty + parseInt(increment);
    const ltMin = newQuantity < 1;
    const gtMax = newQuantity > currentItem.stock_qty;
    currentItem.qty = ltMin ? 1 : gtMax ? currentItem.stock_qty : newQuantity;
    res.send(`${currentItem.qty}`);
});

router.post("/checkout/payment-intent/create", (req, res) => {
    const { firstname, lastname, email, address_l1, address_l2, city, postcode, cart } = Object.assign(req.body, req.session);
    stripe.paymentIntents.create({ // Create a PaymentIntent with the order details
        receipt_email: email,
        description: cart.map(p => `${p.name} (£${(p.price / 100).toFixed(2)} X ${p.qty})`).join(", \r\n"),
        amount: cart.map(p => p.price * p.qty).reduce((sum, val) => sum + val),
        currency: "gbp",
        shipping: {
            name: firstname + " " + lastname,
            address: { line1: address_l1, line2: address_l2, city, postal_code: postcode }
        }
    }, (err, pi) => {
        if (err) return res.status(400).send(err.message);
        req.session.paymentIntentID = pi.id;
        res.send({ clientSecret: pi.client_secret });
    });
});

router.post("/checkout/payment-intent/complete", (req, res) => {
    stripe.paymentIntents.retrieve(req.session.paymentIntentID, (err, pi) => {
        if (err || !pi) return res.status(err ? 500 : 400).send("Error occurred");
        if (pi.status !== "succeeded") return res.status(500).send(pi.status.replace(/_/g, " "));
        Product.find((err, products) => {
            req.session.cart.forEach(item => {
                const product = products.filter(p => p.id === item.id)[0];
                if (product) {
                    product.stock_qty -= item.qty;
                    if (product.stock_qty < 0) product.stock_qty = 0;
                    product.save();
                }
            });
            const cart = req.session.cart.map(p => `${p.name} (£${(p.price / 100).toFixed(2)} X ${p.qty})`).join(", \r\n");
            req.session.cart = [];
            req.session.paymentIntentID = undefined;
            if (process.env.NODE_ENV !== "production") return res.end();
            const transporter = new MailingListMailTransporter({ req, res }, pi.receipt_email);
            transporter.sendMail({
                subject: "Purchase Nofication: Payment Successful",
                message: `Hi ${pi.shipping.name},\n\n` +
                    `Your payment was successful. Below is a summary of your purchase:\n\n${cart}\n\n` +
                    "Thank you for shopping with us!\n\n- CS"
            }, err => {
                if (err) return res.status(500).send(err.message);
                res.end();
            });
        })
    })
});

module.exports = router;
