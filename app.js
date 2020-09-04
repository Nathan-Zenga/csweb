const express = require('express');
const app = express();
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const path = require('path'); // core module
const mongoose = require('mongoose');
const session = require('express-session');
const MemoryStore = require('memorystore')(session);
const passport = require('passport');
const { STRIPE_SK, CSDB, NODE_ENV } = process.env;
const stripe = require('stripe')(STRIPE_SK);
const { Homepage_content } = require('./models/models');

mongoose.connect(CSDB, { useNewUrlParser: true, useUnifiedTopology: true, autoIndex: false });
mongoose.connection.once('open', () => { console.log("Connected to DB") });

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
app.use((req, res, next) => {
    Homepage_content.find((err, contents) => {
        res.locals.user = req.user || null;
        res.locals.socials = contents.length ? contents[0].socials : [];
        res.locals.location_origin = `https://${req.hostname}`;
        res.locals.cart = req.session.cart = req.session.cart || [];
        res.locals.fx_rate = req.session.fx_rate = req.session.fx_rate || 1;
        res.locals.currency = req.session.currency = req.session.currency || "gbp";
        res.locals.currency_symbol = req.session.currency_symbol = req.session.currency_symbol || "£";
        res.locals.converted_price = req.session.converted_price = price => {
            const value = parseFloat(price / 100), {currency, fx_rate} = req.session;
            return Function(`return (${value} ${currency === "EUR" ? "/" : "*"} ${fx_rate})`)();
        };
        if (!req.session.paymentIntentID) return next();
        stripe.paymentIntents.retrieve(req.session.paymentIntentID, (err, pi) => {
            if (err) return console.log(err.message || err), next();
            // id used in payment completion request if true
            if (!(pi && pi.status === "succeeded")) req.session.paymentIntentID = undefined;
            if (!pi || pi.status === "succeeded") return next();
            stripe.paymentIntents.cancel(pi.id, { cancellation_reason: "requested_by_customer" }, err => {
                if (err) console.log(err.message || err);
                next();
            });
        });
    })
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

// Set port + listen for requests
const port = process.env.PORT || 4001;
const production = NODE_ENV === "production";
app.listen(port, () => { console.log(`Server started${!production ? " on port " + port : ""}`) });
