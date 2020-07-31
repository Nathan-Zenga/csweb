const router = require('express').Router();
const stripe = require('stripe')(process.env.STRIPE_SK);
const cloud = require('cloudinary');
const { each } = require('async');
const { Product } = require('../models/models');

router.get("/", (req, res) => {
    Product.find((err, products) => { res.render('shop', { title: "Shop", pagename: "shop", products }) })
});

router.get("/checkout", (req, res) => {
    if (!req.session.cart.length) return res.status(302).redirect(req.get("referrer"));
    res.render('checkout', { title: "Checkout", pagename: "checkout", pk: process.env.STRIPE_PK })
});

router.get("/cart", (req, res) => {
    res.render('cart', { title: "Cart", pagename: "cart", cart: req.session.cart })
});

router.post("/stock/add", (req, res) => {
    const { name, price, stock_qty, info, image_file, image_url } = req.body;
    new Product({ name, price: parseInt(price) * 100, stock_qty, info, image: image_url }).save((err, saved) => {
        if (err) return res.status(500).send(err.message);
        if (!image_file) return res.send("Product saved in stock");
        const public_id = ("shop/stock/" + saved.name.replace(/ /g, "-")).replace(/[ ?&#\\%<>]/g, "_");
        cloud.v2.uploader.upload(image_file, { public_id }, (err, result) => {
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
        if (image_url) product.image = image_url;

        product.save((err, saved) => {
            if (err) return res.status(500).send(err.message || "Error occurred whilst saving product");
            if (!image_file) return res.send("Product details updated successfully");
            const public_id = ("shop/stock/" + saved.name.replace(/ /g, "-")).replace(/[ ?&#\\%<>]/g, "_");
            cloud.v2.api.delete_resources([prefix], err => {
                if (err) return res.status(500).send(err.message);
                cloud.v2.uploader.upload(image_file, { public_id }, (err, result) => {
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
    currentItem.qty = (newQuantity < 1) ? 1 : (newQuantity > currentItem.stock_qty) ? currentItem.stock_qty : newQuantity;
    res.send(`${currentItem.qty}`);
});

router.post("/checkout/create-payment-intent", async (req, res) => {
    const { firstname, lastname, email, address, city, postcode, cart } = Object.assign(req.body, req.session);
    try {
        const paymentIntent = await stripe.paymentIntents.create({ // Create a PaymentIntent with the order details
            receipt_email: email,
            description: cart.map(p => `${p.name} (£${(p.price / 100).toFixed(2)} X ${p.qty})`).join("\r\n"),
            amount: cart.map(p => p.price * p.qty).reduce((sum, val) => sum + val),
            currency: "gbp",
            shipping: {
                name: firstname + " " + lastname,
                address: { line1: address, city, postal_code: postcode }
            }
        });

        req.session.paymentIntentID = paymentIntent.id;
        res.send({ clientSecret: paymentIntent.client_secret });
    } catch(err) { res.status(400).send(err.message) }
});

module.exports = router;
