const router = require('express').Router();
const crypto = require('crypto');
const passport = require('passport');
const { isAuthed, Collections } = require('../config/config');
const MailingListMailTransporter = require('../config/mailingListMailTransporter');
const { Admin } = require('../models/models');
const email = "info@thecs.co";
require('../config/passport')(passport);

router.get('/', isAuthed, (req, res) => {
    Collections(db => res.render('admin', { title: "Admin", pagename: "admin", ...db }))
});

router.get('/login', (req, res) => {
    res.render('admin-login', { title: "Admin Login", pagename: "admin" })
});

router.get('/logout', (req, res) => { req.logout(); res.redirect("/") });

router.post('/login', (req, res) => {
    req.body.username = email;
    passport.authenticate("local-login", (err, user, info) => {
        if (err) return res.status(500).send(err.message || err);
        if (!user) return res.status(400).send(info.message);
        if (user === "to_activate") {
            new MailingListMailTransporter({ req, res }, { email }).sendMail({
                subject: "Admin Account Activation",
                message: "You're recieving this email because an admin account needs setting up. " +
                    "Please click the link below to activate the account, as this will only be available " +
                    "for the next 2 hours from the time of this email received:\n\n" +
                    `- ${res.locals.location_origin}/admin/activate/${doc.password}\n\n`
            }, err => {
                if (err) return res.status(500).send(err.message || err);
                crypto.randomBytes(20, (err, buf) => {
                    let password = buf.toString("hex");
                    let tokenExpiryDate = new Date(Date.now() + (1000 * 60 * 60 * 2));
                    new Admin({ password, tokenExpiryDate }).save((err, doc) => { res.send(info.message) })
                })
            });
        } else {
            req.logIn(user, err => {
                res.status(err ? 500 : 200).send(err ? err.message || err : "/admin")
            });
        }
    })(req, res);
});

router.post("/activate/:token", async (req, res) => {
    req.body.username = email;
    passport.authenticate("local-register", (err, user, info) => {
        if (err) return res.status(500).send(err.message || err);
        if (!user) return res.status(400).send(info.message);
        req.logIn(user, err => {
            if (err) return res.status(500).send(err.message || err);
            Admin.deleteOne({ password: req.params.token }, err => {
                res.status(err ? 500 : 200).send(err ? err.message : "/admin")
            });
        });
    })(req, res);
});

router.post("/search", isAuthed, (req, res) => {
    Collections(db => {
        const { articles, artists, projects, locations, members, products } = db;
        res.send([...articles, ...artists, ...projects, ...locations, ...members, ...products]);
    })
});

module.exports = router;
