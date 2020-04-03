var express = require('express');
var router = express.Router();
var nodemailer = require('nodemailer');
var { OAuth2 } = require("googleapis").google.auth;
var { OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, OAUTH_REFRESH_TOKEN } = process.env;
var { MailingList } = require('../models/models');

router.get('/sign-up', (req, res) => {
    res.render('mailing-list', { title: "Sign Up", pagename: "sign-up" })
});

router.post('/new', (req, res) => {
    var { firstname, lastname, email, size_top, size_bottom } = req.body;
    var newMember = new MailingList({ firstname, lastname, email, size_top, size_bottom });

    MailingList.findOne({ email }, (err, member) => {
        if (err || member) return res.send(err || "ALREADY REGISTERED");
        newMember.save(err => res.send(err || "YOU ARE NOW REGISTERED"))
    })
});

router.post('/send/email', (req, res) => {
    MailingList.find((err, members) => {
        if (err || !members.length) return res.send(err || "NO MEMBERS IN THE MAILING LIST TO SEND THE EMAIL TO");
        members.forEach((member, i) => {
            var oauth2Client = new OAuth2( OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, "https://developers.google.com/oauthplayground" );
            oauth2Client.setCredentials({ refresh_token: OAUTH_REFRESH_TOKEN });
            var accessToken = oauth2Client.getAccessToken();

            var transporter = nodemailer.createTransport({
                service: 'gmail',
                // port: 465,
                // secure: true,
                auth: {
                    type: "OAuth2",
                    user: "info@thecs.co",
                    clientId: OAUTH_CLIENT_ID,
                    clientSecret: OAUTH_CLIENT_SECRET,
                    refreshToken: OAUTH_REFRESH_TOKEN,
                    accessToken
                },
                tls: {
                    rejectUnauthorized: true
                }
            });

            transporter.sendMail({
                from: "info@thecs.co",
                to: member.email,
                subject: req.body.subject,
                html: req.body.message.replace(/\=FN\=/g, member.firstname).replace(/\=LN\=/g, member.lastname)
            }, err => {
                if (err) return console.log(err), res.send("Could not send message. Error occurred.");
                console.log("The message was sent!");
                transporter.close();
                if (i === members.length-1) res.send("DONE")
            });
        })
    })
});

module.exports = router;
