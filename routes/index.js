var express = require('express');
var router = express.Router();
// var nodemailer = require('nodemailer');
// var models = require('../models/models');

router.get('/', (req, res) => {
	res.render('index', { title: null, pagename: "home" })
});

// router.post('/send/message', (req, res) => {
// 	let transporter = nodemailer.createTransport({
// 		service: 'gmail',
// 		port: 465,
// 		secure: true,
// 		auth: {
// 			user: 'nznodemailer@gmail.com',
// 			pass: 'nodemailer246'
// 		},
// 		tls: {
// 			rejectUnauthorized: true
// 		}
// 	});

// 	let mailOptions = {
// 		from: { name: req.body.name, address: req.body.email },
// 		to: 'nathanzenga@gmail.com',
// 		subject: req.body.subject,
// 		text: `From ${req.body.name} (${req.body.email}):\n\n${req.body.message}`
// 	};

// 	transporter.sendMail(mailOptions, (err, info) => {
// 		if (err) return console.log(err), res.send("Could not send message");
// 		console.log("The message was sent!");
// 		console.log(info);
// 		console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
// 		res.send('Message sent');
// 	});
// });

module.exports = router;