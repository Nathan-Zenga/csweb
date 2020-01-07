var express = require('express');
var router = express.Router();
var cloud = require('cloudinary');
var Article = require('../models/models').article;
// var nodemailer = require('nodemailer');

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
	var article = new Article({
		headline: req.body.headline,
		textbody: req.body.textbody
	});

	article.save((err, doc) => {
		["headline_images", "textbody_media", "headline_images[]", "textbody_media[]"].forEach(field => {
			if (req.body[field]) {
				doc[field] = [];
				req.body[field] = typeof req.body[field] === "string" ? [req.body[field]] : req.body[field];
				req.body[field].forEach((image, i) => {
					var f = field.replace("[]", "");
					cloud.v2.uploader.upload(image, { public_id: ("article/"+ doc.id +"/"+ f + i+1) }, (err, result) => {
						if (err) console.log(err);
						doc[f].push(result.url);
						doc.save();
					});
				})
			}
		});
		res.send("DONE")
	});
});

router.post('/news/article/delete/:id', (req, res) => {
	Article.findByIdAndDelete(req.params.id, function(err, doc) {
		if (err || !doc) return res.send(err || "Article not found");
		cloud.v2.api.delete_resources_by_prefix('article/'+doc.id, (err, result) => { console.log(result, err) });
		res.redirect(req.get("referrer"))
	})
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