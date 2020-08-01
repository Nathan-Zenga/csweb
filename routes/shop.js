const router = require('express').Router();
const stripe = require('stripe')(process.env.STRIPE_SK);
const { Product } = require('../models/models');

router.get("/", (req, res) => {
    Product.find((err, products) => { res.render('shop', { title: "Shop", pagename: "shop", products }) })
});

router.get("/checkout", (req, res) => {
    res.render('checkout', { title: "Checkout", pagename: "checkout", pk: process.env.STRIPE_PK })
});

router.get("/cart", (req, res) => {
    res.render('cart', { title: "Cart", pagename: "cart", cart: req.session.cart })
});

router.post("/cart/add", (req, res) => {
    const { product_id, name, price, category } = req.body;
    const cartItemIndex = req.session.cart.findIndex(item => item.product_id === product_id);

    if (cartItemIndex >= 0) {
        req.session.cart[cartItemIndex].qty += 1;
    } else {
        req.session.cart.unshift({ product_id, name, price, category, qty: 1 });
    }

    res.send(`${req.session.cart.length}`);
});

router.post("/cart/remove", (req, res) => {
    const { product_id, increment } = req.body;
    const cartItemIndex = req.session.cart.findIndex(item => item.product_id === product_id);
    if (increment) req.session.cart[cartItemIndex].qty += parseInt(increment);
    if (!increment || req.session.cart[cartItemIndex].qty < 1) req.session.cart.splice(cartItemIndex, 1);
    res.send(`${req.session.cart.length}`);
});

router.post("/checkout/create-payment-intent", async (req, res) => {
    const { firstname, lastname, email, address, city, postcode, cart } = Object.assign(req.body, req.session);
    try {
        const paymentIntent = await stripe.paymentIntents.create({ // Create a PaymentIntent with the order details
            receipt_email: email,
            description: cart.map(p => `${p.name} (£${(p.price / 100).toFixed(2)} X ${p.qty})`).join("\r\n"),
            amount: cart.map(p => p.price).reduce((sum, val) => sum + val),
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
