var express = require('express');
var router = express.Router();
var { Article, Project, Artist, Location } = require('../models/models');

router.get('/', (req, res) => {
	res.render('index', { title: null, pagename: "home" })
});

router.get('/admin', (req, res) => {
	Article.find().sort({ created_at: -1 }).exec((err, articles) => {
		Artist.find((err, artists) => {
			Project.find().sort({ year: -1 }).exec((err, projects) => {
				Location.find((err, locations) => {
					res.render('admin', { title: "Admin", pagename: "admin", db: {articles, artists, projects, locations} })
				})
			})
		})
	})
});

router.post('/search', (req, res) => {
	Article.find().sort({ created_at: -1 }).exec((err, articles) => {
		Artist.find((err, artists) => {
			Project.find().sort({ year: -1 }).exec((err, projects) => {
				Location.find((err, locations) => {
					res.send([...articles, ...artists, ...projects, ...locations]);
				})
			})
		})
	})
});

module.exports = router;
