var express = require('express');
var router = express.Router();
var cloud = require('cloudinary');
var { Article, Project } = require('../models/models');
// var nodemailer = require('nodemailer');

router.get('/', (req, res) => {
	res.render('index', { title: null, pagename: "home" })
});

router.get('/news', (req, res) => {
	Article.find().sort({ created_at: -1 }).exec((err, articles) => {
		res.render('news', { title: "News", pagename: "news", articles })
	})
});

router.get('/news/article/:id', (req, res, next) => {
	Article.findById(req.params.id, (err, article) => {
		if (!article) return next();
		res.render('news-article', { title: article.headline + " | News", pagename: "news", article })
	})
});

router.get('/artists', (req, res) => {
	res.render('artists', { title: "Artists", pagename: "artists" })
});

router.get('/discography', (req, res) => {
	Project.find().sort({ year: -1, created_at: -1 }).exec(function(err, projects) {
		res.render('discography', { title: "Discography", pagename: "discography", projects })
	})
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
		var message_update = "";
		["headline_images", "textbody_media", "headline_images[]", "textbody_media[]"].forEach(field => {
			if (req.body[field]) {
				message_update = " - All uploaded images will be available very shortly";
				doc[field] = [];
				req.body[field] = typeof req.body[field] === "string" ? [req.body[field]] : req.body[field];
				req.body[field].forEach((imageStr, i) => {
					var f = field.replace("[]", "");
					if (!/<iframe(.*?)<\/iframe>/.test(imageStr)) {
						var public_id = "article/"+ doc.id +"/"+ f + (i+1);
						cloud.v2.uploader.upload(imageStr, { public_id }, (err, result) => {
							if (err) return res.send(err);
							doc[f].push(result.url);
							doc.save();
						});
					} else {
						doc[f].push(imageStr);
						doc.save();
					}
				})
			}
		});
		res.send("DONE" + message_update)
	});
});

router.post('/news/article/delete/:id', (req, res) => {
	Article.findByIdAndDelete(req.params.id, function(err, doc) {
		if (err || !doc) return res.send(err || "Article not found");
		cloud.v2.api.delete_resources_by_prefix("articles/" + doc.id, (err, result) => { console.log(result, err) });
		res.send("ARTICLE DELETED SUCCESSFULLY")
	})
});

router.post('/discography/project/new', (req, res) => {
	var project = new Project({
		title: req.body.title,
		artist: req.body.artist,
		year: req.body.year,
		artwork: req.body.artwork_url,
		links: req.body.links || req.body["links[]"],
		all_platforms: !!req.body.all_platforms
	});

	project.save((err, doc) => {
		var message_update = "";
		if (req.body.artwork_file) {
			message_update = " - All uploaded images will be available very shortly";
			var public_id = "discography/"+ doc.id +"/"+ doc.title.replace(/ /g, "-");
			cloud.v2.uploader.upload(req.body.artwork_file, { public_id }, (err, result) => {
				if (err) return res.send(err);
				doc.artwork = result.url;
				doc.save();
			});
		}
		res.send("DONE" + message_update);
	});
});

router.post('/discography/project/delete/:id', (req, res) => {
	Project.findByIdAndDelete(req.params.id, function(err, doc) {
		if (err || !doc) return res.send(err || "Project not found");
		cloud.v2.api.delete_resources_by_prefix("discography/" + doc.id, (err, result) => { console.log(result, err) });
		res.send("PROJECT DELETED SUCCESSFULLY")
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