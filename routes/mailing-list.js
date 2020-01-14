var express = require('express');
var router = express.Router();
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

module.exports = router;
