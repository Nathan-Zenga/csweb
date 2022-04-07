const router = require('express').Router();
const crypto = require('crypto');
const { isAuthed, Collections } = require('../config/config');
const MailTransporter = require('../config/MailTransporter');
const { Admin } = require('../models/models');
const email = "info@thecs.co";
const passport = require('../config/passport');

router.get('/', isAuthed, (req, res) => {
    Collections(db => res.render('admin', { title: "Admin", pagename: "admin", ...db }))
});

router.get('/login', (req, res) => {
    res.render('admin-login', { title: "Admin Login", pagename: "admin" })
});

router.get('/activate/:token', async (req, res, next) => {
    const found = await Admin.findOne({ password: req.params.token, tokenExpiryDate: { $gte: Date.now() } });
    if (!found) return next();
    res.render('admin-activate', { title: "Admin Register", pagename: "admin", token: found.password })
});

router.get('/logout', (req, res) => { req.logout(); res.redirect("/") });

router.post('/login', (req, res) => {
    req.body.username = email; Object.freeze(req.body);
    passport.authenticate("local-login", async (err, user, info) => {
        if (err) return res.status(500).send(err.message || err);
        if (!user) return res.status(400).send(info.message);
        if (user === "to_activate") {
            await Admin.deleteMany({ email: "temp" });
            const password = await crypto.randomBytes(20).toString("hex");
            const tokenExpiryDate = new Date(Date.now() + (1000 * 60 * 60 * 2));
            const doc = await Admin.create({ email: "temp", password, tokenExpiryDate });
            const subject = "Admin Account Activation";
            const message = "You're recieving this email because an admin account needs setting up. " +
                "Please click the link below to activate the account, as this will only be " +
                "<u>available for the next 2 hours</u> from the time of this email received:\n\n" +
                `${res.locals.location_origin}/admin/activate/${doc.password}\n\n`;
            new MailTransporter({ email }).sendMail({ subject, message }, err => {
                if (err) return res.status(500).send(err.message || err);
                res.status(400).send(info.message);
            });
        } else {
            req.logIn(user, err => {
                if (err) return res.status(500).send(err.message || err);
                res.send("/admin")
            });
        }
    })(req, res);
});

router.post("/activate/:token", async (req, res) => {
    req.body.username = email; Object.freeze(req.body);
    passport.authenticate("local-register", (err, user, info) => {
        if (err) return res.status(500).send(err.message || err);
        if (!user) return res.status(400).send(info.message);
        req.logIn(user, err => {
            if (err) return res.status(500).send(err.message || err);
            Admin.deleteMany({ email: "temp" }, err => {
                res.status(err ? 500 : 200).send(err ? err.message : "/admin")
            });
        });
    })(req, res);
});

router.post("/search", isAuthed, async (req, res) => {
    const { articles, artists, projects, locations, members, products } = await Collections();
    res.send([...articles, ...artists, ...projects, ...locations, ...members, ...products]);
});

module.exports = router;
