const express = require('express');
const app = express();
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const path = require('path'); // core module
const mongoose = require('mongoose');
const session = require('express-session');
const MemoryStore = require('memorystore')(session);
const passport = require('passport');
const { STRIPE_SK, CSDB, NODE_ENV, PORT = 4001 } = process.env;
const Stripe = new (require('stripe').Stripe)(STRIPE_SK);
const { Homepage_content, MailTest } = require('./models/models');
const MailTransporter = require('./config/MailTransporter');
const currencies = require('./config/currencies');
const production = NODE_ENV === "production";
const socketio = require('./config/socket.io');
const { createServer } = require('http');

mongoose.connect(CSDB).then(() => { console.log("Connected to DB") });

// View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: false }));
app.use(cookieParser());

// Set static folder
app.use(express.static(path.join(__dirname, 'public')));

// Express session
app.use(session({
    secret: 'secret',
    name: 'sesh' + Math.round(Math.random() * 10000),
    saveUninitialized: true,
    resave: true,
    cookie: { secure: false },
    store: new MemoryStore({ checkPeriod: 1000 * 60 * 60 * 12 })
}));

// Passport init
app.use(passport.initialize());
app.use(passport.session());

// Global variables
app.use(async (req, res, next) => {
    const contents = await Homepage_content.find();
    res.locals.user = req.user || null;
    res.locals.socials = contents[0]?.socials || [];
    res.locals.location_origin = `https://${req.hostname}`;
    res.locals.cart = req.session.cart = req.session.cart || [];
    res.locals.fx_rate = req.session.fx_rate = req.session.fx_rate || 1;
    res.locals.currency_name = req.session.currency_name = req.session.currency_name || currencies.find(c => c.code === "GBP").name;
    res.locals.currency_code = req.session.currency_code = req.session.currency_code || "gbp";
    res.locals.currency_symbol = req.session.currency_symbol = req.session.currency_symbol || "£";
    res.locals.converted_price = req.session.converted_price = price => parseFloat(price / 100) * req.session.fx_rate;
    if (!req.session.paymentIntentID) return next();
    try {
        const pi = await Stripe.paymentIntents.retrieve(req.session.paymentIntentID);
        if (!pi || pi.status !== "succeeded") req.session.paymentIntentID = undefined; // id used in payment completion request if true
        if (!pi || pi.status === "succeeded") return next();
        await Stripe.paymentIntents.cancel(pi.id, { cancellation_reason: "requested_by_customer" });
        next();
    } catch (err) { console.error(err.message); next() }
});

app.use('/', require('./routes/index'));
app.use('/admin', require('./routes/admin'));
app.use('/news', require('./routes/news'));
app.use('/team', require('./routes/artists'));
app.use('/discography', require('./routes/discography'));
app.use('/shop', require('./routes/shop'));
app.use('/mailing-list', require('./routes/mailing-list'));
app.use('/map', require('./routes/map'));

app.get("*", (req, res) => {
    const html = `<h1>PAGE ${res.statusCode === 404 ? "IN CONSTRUCTION" : "NOT FOUND"}</h1>`;
    res.status(404).render('error', { title: "Error 404", pagename: "error", html });
});

app.post("*", (req, res) => res.status(400).send("Sorry, your request currently cannot be processed"));

const server = createServer(app);
socketio(server);

server.listen(PORT, async () => {
    console.log(`Server started${!production ? " on port " + PORT : ""}`);

    if (production) try {
        const test = await MailTest.findOne() || new MailTest();
        const { email, subject, message, newDay } = test;
        newDay && await new MailTransporter({ email }).sendMail({ subject, message });
        newDay && (test.last_sent_date = Date.now());
        newDay && await test.save();
    } catch (err) { console.error(err.message) }
});
