const { Strategy } = require('passport-local');
const { Admin } = require('../models/models');
const bcrypt = require('bcrypt');
const passport = require('passport');

passport.use("local-login", new Strategy(async (email, password, done) => {
    try {
        const user = await Admin.findOne({ email });
        if (!user) return done(null, "to_activate", { message: "Verification email sent" });
        const match = await bcrypt.compare(password, user.password);
        if (!match) return done(null, null, { message: "Invalid password" });
        done(null, user);
    } catch(err) { done(err) }
}));

passport.use("local-register", new Strategy({ passReqToCallback: true }, async (req, email, password, done) => {
    try {
        if (password !== req.body.password_confirm) return done(null, null, { message: "Passwords don't match" });
        const found = await Admin.findOne({ password: req.params.token, tokenExpiryDate: { $gte: Date.now() } });
        if (!found) return done(null, null, { message: "Cannot activate account: token expired / not valid" });
        const existing = await Admin.findOne({ email });
        if (existing) return done(null, null, { message: "An admin is already registered" });
        const hash = await bcrypt.hash(password, 10);
        const user = await Admin.create({ email, password: hash });
        done(null, user);
    } catch(err) { done(err) }
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => { Admin.findById(id, (err, user) => done(err, user)) });

module.exports = passport;