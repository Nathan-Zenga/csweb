const router = require('express').Router();
const stripe = require('stripe')(process.env.STRIPE_SK);
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

router.post("/cart/add", (req, res) => {
    const { product_id, name, price, img_url } = req.body;
    const cartItemIndex = req.session.cart.findIndex(item => item.product_id === product_id);

    if (cartItemIndex >= 0) {
        req.session.cart[cartItemIndex].qty += 1;
    } else {
        req.session.cart.unshift({ product_id, name, price: parseInt(price), img_url, qty: 1 });
    }

    res.send(`${req.session.cart.length}`);
});

router.post("/cart/remove", (req, res) => {
    const { product_id } = req.body;
    const cartItemIndex = req.session.cart.findIndex(item => item.product_id === product_id);
    req.session.cart.splice(cartItemIndex, 1);
    res.send(`${req.session.cart.length}`);
});

router.post("/cart/increment", (req, res) => {
    const { product_id, increment } = req.body;
    const cartItemIndex = req.session.cart.findIndex(item => item.product_id === product_id);
    req.session.cart[cartItemIndex].qty = Math.max(1, req.session.cart[cartItemIndex].qty + parseInt(increment));
    res.send(`${req.session.cart[cartItemIndex].qty}`);
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
    } catch(err) { return res.status(400).send(err.message) }

    req.session.paymentIntentID = paymentIntent.id;
    res.send({ clientSecret: paymentIntent.client_secret });
});

module.exports = router;
