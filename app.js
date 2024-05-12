const express = require('express');
const app = express();
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const path = require('path'); // core module
const mongoose = require('mongoose');
const session = require('express-session');
const MemoryStore = require('memorystore')(session);
const passport = require('passport');
const { STRIPE_SK, CSDB, PORT, NODE_ENV, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
const Stripe = new (require('stripe').Stripe)(STRIPE_SK);
const { Homepage_content } = require('./models/models');
const MailTransporter = require('./modules/MailTransporter');
const currencies = require('./modules/currencies');
const socketio = require('./modules/socket.io');
const visitor = require('./modules/visitor-info');
const { OAuth2 } = (require("googleapis")).google.auth;
const { platforms, sizes, delivery_est_units, product_categories } = require('./config/constants');
const { v2: cloud } = require('cloudinary');
const production = NODE_ENV === "production";

cloud.config({ cloud_name: CLOUDINARY_CLOUD_NAME, api_key: CLOUDINARY_API_KEY, api_secret: CLOUDINARY_API_SECRET });

mongoose.set({ strictQuery: true }).connect(CSDB).then(() => { console.log("Connected to DB") });

// View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: false }));
app.use(cookieParser());

// Set static folder
app.use(express.static(path.join(__dirname, 'public')));

// Express session
app.set('trust proxy', 1);
app.use(session({
    secret: 'secret',
    name: 'sesh' + Math.round(Math.random() * 10000),
    saveUninitialized: true,
    resave: true,
    cookie: { secure: 'auto' },
    store: new MemoryStore({ checkPeriod: 1000 * 60 * 60 * 12 })
}));

// Passport init
app.use(passport.initialize());
app.use(passport.session());

// Global variables
app.use(async (req, res, next) => {
    req.hostname != "localhost" && res.on("finish", () => console.log(visitor(req, res)));
    res.locals.user = req.user;
    res.locals.socials = (await Homepage_content.find())[0]?.socials || [];
    res.locals.location_origin = MailTransporter.location_origin = `${req.protocol}://${req.headers.host}`;
    res.locals.cart = req.session.cart = req.session.cart || [];
    res.locals.fx_rate = req.session.fx_rate = req.session.fx_rate || 1;
    res.locals.currency_name = req.session.currency_name = req.session.currency_name || currencies.find(c => c.code === "GBP").name;
    res.locals.currency_code = req.session.currency_code = req.session.currency_code || "GBP";
    res.locals.currency_symbol = req.session.currency_symbol = req.session.currency_symbol || "£";
    res.locals.converted_price = req.session.converted_price = price => parseFloat(price / 100) * req.session.fx_rate;
    res.locals.platforms = platforms;
    res.locals.sizes = sizes;
    res.locals.delivery_est_units = delivery_est_units;
    res.locals.number_separator_regx = /\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g;
    res.locals.product_categories = product_categories;
    if (req.originalUrl === "/shop/checkout/payment/complete") return next();
    req.session.checkout_session_id && await Stripe.checkout.sessions.expire(req.session.checkout_session_id).catch(e => null);
    req.session.checkout_session_id = undefined;
    next();
});

app.use('/', require('./routes/index'));
app.use('/admin', require('./routes/admin'));
app.use('/news', require('./routes/news'));
app.use('/team', require('./routes/artists'));
app.use('/discography', require('./routes/discography'));
app.use('/shop', require('./routes/shop'));
app.use('/shop/shipping', require('./routes/shipping'));
app.use('/mailing-list', require('./routes/mailing-list'));
app.use('/map', require('./routes/map'));

app.get("*", (req, res) => res.status(404).render('error', { title: "Error 404", html: "<h1>PAGE NOT FOUND</h1>" }));

app.post("*", (req, res) => res.status(400).send("Sorry, your request currently cannot be processed"));

const server = app.listen(PORT, () => {
    console.log(`Server started${!production ? " on port " + PORT : ""}`);

    if (production) setInterval(async () => {
        try {
            const { OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, OAUTH_REFRESH_TOKEN } = process.env;
            const oauth2Client = new OAuth2( OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, "https://developers.google.com/oauthplayground" );
            oauth2Client.setCredentials({ refresh_token: OAUTH_REFRESH_TOKEN });
            const response = await oauth2Client.getAccessToken();
            if (!response.token) throw Error("Null token");
        } catch (err) { console.error(err.message) }
    }, 1000 * 60 * 60 * 24 * 7);
});

socketio(server);
