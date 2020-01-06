var express = require('express');
var router = express.Router();
// var nodemailer = require('nodemailer');
// var models = require('../models/models');

router.get('/', (req, res) => {
	res.render('index', { title: null, pagename: "home" })
});

router.get('/news', (req, res) => {
	res.render('news', { title: "News", pagename: "news" })
});

router.get('/news/article', (req, res) => {
	res.render('news-article', { title: "News", pagename: "news" })
});

router.get('/artists', (req, res) => {
	res.render('artists', { title: "Artists", pagename: "artists" })
});

router.get('/discography', (req, res) => {
	res.render('discography', { title: "Discography", pagename: "discography" })
});

router.get('/map', (req, res) => {
	res.render('map', { title: "Map", pagename: "map" })
});

router.get('/admin', (req, res) => {
	res.render('admin', { title: "Admin", pagename: "admin" })
});

router.post('/news/article/new', (req, res) => {
	console.log(req.body);
	res.send("done!!!");
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