const router = require('express').Router();
const stripe = require("stripe")(process.env.STRIPE_SK);

router.get("/", (req, res) => {
    res.render('shop', { title: "Shop", pagename: "shop" })
});

router.get("/checkout", (req, res) => {
    const { cart } = req.session;
    res.render('checkout', { title: "Checkout", pagename: "checkout", pk: process.env.STRIPE_PK, cart })
});

router.get("/cart", (req, res) => {
    res.end()
});

router.post("/cart/add", (req, res) => {
    if (!req.session.cart) req.session.cart = [];
    const { product_id, name, price, category } = req.body;
    const cartItemIndex = req.session.cart.findIndex(item => item.product_id === product_id);

    if (cartItemIndex >= 0) {
        req.session.cart[cartItemIndex].quantity += 1;
    } else {
        req.session.cart.unshift({ product_id, name, price, category, quantity: 1 });
    }

    res.send(req.session.cart.length.toString());
});

router.post("/cart/remove", (req, res) => {
    // TODO
});

router.post("/checkout/create-payment-intent", async (req, res) => {
    const { items } = req.body;
    // Create a PaymentIntent with the order amount and currency
    const amount = items.map(item => item.price).reduce((sum, val) => sum + val);
    const paymentIntent = await stripe.paymentIntents.create({ amount, currency: "gbp" });

    res.send({ clientSecret: paymentIntent.client_secret });
});

module.exports = router;
