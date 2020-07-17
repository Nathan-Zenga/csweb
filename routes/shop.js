const router = require('express').Router();
const stripe = require("stripe")(process.env.STRIPE_SK);

router.get("/", (req, res) => {
    res.render('shop', { title: "Shop", pagename: "shop" })
});

router.get("/checkout", (req, res) => {
    res.render('checkout', { title: "Checkout", pagename: "checkout", pk: process.env.STRIPE_PK })
});

router.get("/cart", (req, res) => {
    res.end()
});

router.post("/cart/add", (req, res) => {
    // TODO
});

router.post("/cart/remove", (req, res) => {
    // TODO
});

router.post("/checkout/create-payment-intent", async (req, res) => {
    const { items } = req.body;
    // Create a PaymentIntent with the order amount and currency
    const paymentIntent = await stripe.paymentIntents.create({
        amount: items.map(item => item.price).reduce((sum, val) => sum + val),
        currency: "gbp"
    });

    res.send({ clientSecret: paymentIntent.client_secret });
});

module.exports = router;
