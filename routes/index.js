var express = require('express');
var router = express.Router();
var { Article, Project, Artist } = require('../models/models');

router.get('/', (req, res) => {
	res.render('index', { title: null, pagename: "home" })
});

router.get('/map', (req, res) => {
	res.render('map', { title: "Map", pagename: "map" })
});

router.get('/admin', (req, res) => {
	Article.find().sort({ created_at: -1 }).exec((err, articles) => {
		Artist.find((err, artists) => {
			Project.find().sort({ year: -1 }).exec((err, projects) => {
				res.render('admin', { title: "Admin", pagename: "admin", db: {articles, artists, projects} })
			})
		})
	})
});

router.post('/search', (req, res) => {
	Article.find().sort({ created_at: -1 }).exec((err, articles) => {
		Artist.find((err, artists) => {
			Project.find().sort({ year: -1 }).exec((err, projects) => {
				res.send([...articles, ...artists, ...projects]);
			})
		})
	})
});

module.exports = router;
