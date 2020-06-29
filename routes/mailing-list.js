const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const { post } = require('request');
const { each } = require('async');
const { OAuth2 } = require("googleapis").google.auth;
const { OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, OAUTH_REFRESH_TOKEN, NODE_ENV } = process.env;
const { MailingList } = require('../models/models');

router.get('/sign-up', (req, res) => {
    res.render('mailing-list', { title: "Sign Up", pagename: "sign-up" })
});

router.get('/member/delete', (req, res) => {
    const { id, src } = req.query;
    MailingList.findById(id, (err, doc) => {
        if (!src.match(/^email_unsub_link[A-Za-z0-9]{24}$/g) || src.slice(-24) !== id || err || !doc) return res.send("Invalid entry");
        post({ url: res.locals.location_origin + req.originalUrl, json: { id } }, (err, response) => {
            if (err) return console.error(err), res.send(err.message || "Error occurred");
            var result = response.body === "NOTHING SELECTED" ? "You don't exist on our records." : "You are have been unsubscribed. Sorry to see you go!";
            res.send(result + "<br><br> - CS");
        })
    })
});

router.post('/new', (req, res) => {
    var { firstname, lastname, email, size_top, size_bottom, extra_info } = req.body;
    var newMember = new MailingList({ firstname, lastname, email, size_top, size_bottom, extra_info });

    MailingList.findOne({ email }, (err, member) => {
        if (err || member) return res.send(err || "ALREADY REGISTERED");
        newMember.save(err => res.send(err || "YOU ARE NOW REGISTERED"))
    })
});

router.post('/update', (req, res) => {
    var { member_id, firstname, lastname, email, size_top, size_bottom, extra_info } = req.body;
    MailingList.findById(member_id, (err, member) => {
        if (err || !member) return res.send(err || "MEMBER NOT FOUND");
        if (firstname)   member.firstname = firstname;
        if (lastname)    member.lastname = lastname;
        if (email)       member.email = email;
        if (size_top)    member.size_top = size_top;
        if (size_bottom) member.size_bottom = size_bottom;
        if (extra_info)  member.extra_info = extra_info;
        member.save(err => res.send(err || "MEMBER UPDATED"));
    })
});

router.post('/send/mail', (req, res) => {
    var { email, subject, message } = req.body, sentCount = 0;
    MailingList.find(email ? { email } : {}, (err, members) => {
        if (err || !members.length) return res.send(err || "Mailing list member(s) not found");

        const oauth2Client = new OAuth2( OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, "https://developers.google.com/oauthplayground" );
        oauth2Client.setCredentials({ refresh_token: OAUTH_REFRESH_TOKEN });

        nodemailer.createTestAccount((err, acc) => {
            each(members, (member, cb) => {
                let mailTransporter = transportOpts => {
                    res.render('templates/mail', { message, member }, (err, html) => {
                        let attachments = [{ path: 'public/img/cs-logo.png', cid: 'logo' }];
                        res.locals.socials.forEach((s, i) => attachments.push({ path: `public/img/socials/${s.name}.png`, cid: `social_icon_${i}` }));
                        nodemailer.createTransport(transportOpts).sendMail({ from: "CS <info@thecs.co>", to: member.email, subject, html, attachments }, err => {
                            if (err) return console.error(err), cb(err);
                            sentCount += 1;
                            console.log("The message was sent!");
                            cb();
                        })
                    })
                };

                oauth2Client.getAccessToken().then(response => {
                    mailTransporter({
                        service: 'gmail', /* port: 465, secure: true, */
                        auth: {
                            type: "OAuth2",
                            user: "info@thecs.co",
                            clientId: OAUTH_CLIENT_ID,
                            clientSecret: OAUTH_CLIENT_SECRET,
                            refreshToken: OAUTH_REFRESH_TOKEN,
                            accessToken: response.token
                        },
                        tls: { rejectUnauthorized: true }
                    });
                }).catch(err => {
                    if (NODE_ENV === "production") return console.error(err), cb(err);
                    mailTransporter({
                        host: 'smtp.ethereal.email',
                        port: 587,
                        secure: false,
                        auth: { user: acc.user, pass: acc.pass }
                    });
                });
            }, err => {
                if (err) console.error(err);
                res.send(`Message sent to ${sentCount}/${members.length} members.${err ? err.message ? " "+err.message : " Error occurred" : ""}`);
            });
        });
    })
});

router.post('/member/delete', (req, res) => {
    var ids = Object.values(req.body);
    if (ids.length) {
        MailingList.deleteMany({_id : { $in: ids }}, (err, result) => {
            if (err || !result.deletedCount) return res.send(err || "Member(s) not found");
            res.send("MEMBER"+ (ids.length > 1 ? "S" : "") +" REMOVED SUCCESSFULLY")
        })
    } else { res.send("NOTHING SELECTED") }
});

module.exports = router;
