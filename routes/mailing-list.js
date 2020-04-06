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

router.post('/update', (req, res) => {
    var { member_id, firstname, lastname, email, size_top, size_bottom } = req.body;
    MailingList.findById(member_id, (err, member) => {
        if (err || !member) return res.send(err || "MEMBER NOT FOUND");
        member.firstname = firstname || member.firstname;
        member.lastname = lastname || member.lastname;
        member.email = email || member.email;
        member.size_top = size_top || member.size_top;
        member.size_bottom = size_bottom || member.size_bottom;
        member.save(err => res.send(err || "MEMBER UPDATED"));
    })
});

router.post('/send/mail', (req, res) => {
    MailingList.find((err, members) => {
        if (err || !members.length) return res.send(err || "NO MEMBERS IN THE MAILING LIST TO SEND THE EMAIL TO");

        var oauth2Client = new OAuth2( OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, "https://developers.google.com/oauthplayground" );
        oauth2Client.setCredentials({ refresh_token: OAUTH_REFRESH_TOKEN });
        var accessToken = oauth2Client.getAccessToken();

        members.forEach((member, i) => {
            var { firstname, lastname, email, size_top, size_bottom } = member;
            var refs = {"=FN=": firstname, "=LN=": lastname, "=ST=": size_top, "=SB=": size_bottom};
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

            res.render('templates/mail', { message: req.body.message, refs }, (err, html) => {
                transporter.sendMail({
                    from: "CS <info@thecs.co>",
                    to: email,
                    subject: req.body.subject,
                    html,
                    attachments: [{ filename: 'cs-icon.png', path: 'public/img/cs-icon.png', cid: 'logo' }]
                }, err => {
                    if (err) return console.log(err), res.send("Could not send message. Error occurred.");
                    console.log("The message was sent!");
                    transporter.close();
                    if (i === members.length-1) res.send("MESSAGE SENT")
                });
            });
        })
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
