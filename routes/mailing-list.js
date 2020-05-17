const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const async = require('async');
const { OAuth2 } = require("googleapis").google.auth;
const { OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, OAUTH_REFRESH_TOKEN, NODE_ENV } = process.env;
const { MailingList } = require('../models/models');

router.get('/sign-up', (req, res) => {
    res.render('mailing-list', { title: "Sign Up", pagename: "sign-up" })
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
    var { member_id, firstname, lastname, email, size_top, size_bottom } = req.body;
    MailingList.findById(member_id, (err, member) => {
        if (err || !member) return res.send(err || "MEMBER NOT FOUND");
        member.firstname = firstname || member.firstname;
        member.lastname = lastname || member.lastname;
        member.email = email || member.email;
        member.size_top = size_top || member.size_top;
        member.size_bottom = size_bottom || member.size_bottom;
        member.extra_info = extra_info || member.extra_info;
        member.save(err => res.send(err || "MEMBER UPDATED"));
    })
});

router.post('/send/mail', (req, res) => {
    var { email, subject, message } = req.body;
    MailingList.find(email ? { email } : {}, (err, members) => {
        if (err || !members.length) return res.send(err || "NO MEMBERS IN THE MAILING LIST TO SEND THE EMAIL TO");

        var oauth2Client = new OAuth2( OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, "https://developers.google.com/oauthplayground" );
        oauth2Client.setCredentials({ refresh_token: OAUTH_REFRESH_TOKEN });
        var accessToken = oauth2Client.getAccessToken();
        var sentCount = 0, errCount = 0;

        nodemailer.createTestAccount((err, acc) => {
            async.each(members, (member, cb) => {
                var transporter;
                if (NODE_ENV === "production") {
                    transporter = nodemailer.createTransport({
                        service: 'gmail', /* port: 465, secure: true, */
                        auth: {
                            type: "OAuth2",
                            user: "info@thecs.co",
                            clientId: OAUTH_CLIENT_ID,
                            clientSecret: OAUTH_CLIENT_SECRET,
                            refreshToken: OAUTH_REFRESH_TOKEN,
                            accessToken
                        },
                        tls: { rejectUnauthorized: true }
                    });
                } else {
                    transporter = nodemailer.createTransport({
                        host: 'smtp.ethereal.email',
                        port: 587,
                        secure: false,
                        auth: { user: acc.user, pass: acc.pass }
                    });
                }

                res.render('templates/mail', { message }, (err, html) => {
                    var msg = {
                        from: "CS <info@thecs.co>",
                        to: member.email,
                        subject,
                        html,
                        attachments: [{ filename: 'cs-icon.png', path: 'public/img/cs-icon.png', cid: 'logo' }]
                    };
                    transporter.sendMail(msg, err => {
                        err ? errCount += 1 : sentCount += 1;
                        console.log(err || "The message was sent!");
                        cb(err);
                    })
                })
            }, err => {
                if (err) console.log(err);
                res.send(`MESSAGE SENT TO ${sentCount} MEMBERS${errCount ? " ("+ errCount +"ERRORS)" : ""}`);
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
