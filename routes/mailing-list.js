var express = require('express');
var router = express.Router();
var nodemailer = require('nodemailer');
var { MailingList } = require('../models/models');

router.get('/sign-up', (req, res) => {
	res.render('mailing-list', { title: "Sign Up", pagename: "sign-up" })
});

router.post('/new', (req, res) => {
	var newMember = new MailingList({
		firstname: req.body.firstname,
		lastname: req.body.lastname,
		email: req.body.email,
		size_top: req.body.size_top,
		size_bottom: req.body.size_bottom
	});

	MailingList.findOne({email: req.body.email}, (err, member) => {
		!member ? newMember.save(err => { res.send("YOU ARE NOW REGISTERED") }) : res.send("ALREADY REGISTERED")
	})
});

router.post('/send/email', (req, res) => {
	MailingList.find((err, members) => {
		var transporter = nodemailer.createTransport({
			service: 'gmail',
			port: 465,
			secure: true,
			auth: {
				user: NODEMAILER_AUTH_USER,
				pass: NODEMAILER_AUTH_PASS
			},
			tls: {
				rejectUnauthorized: true
			}
		});

		var emails = members.map(member => member.email);

		var mailOptions = {
			from: { name: req.body.name, address: req.body.email },
			to: emails,
			subject: req.body.subject,
			html: `From ${req.body.name} (${req.body.email}):\n\n${req.body.message}`
		};

		transporter.sendMail(mailOptions, err => {
			if (err) return console.log(err), res.send("COULD NOT SEND MESSAGE");
			transporter.close();
			res.send('MESSAGE SENT');
		});
	})
});

module.exports = router;
