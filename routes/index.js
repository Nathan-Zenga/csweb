var express = require('express');
var router = express.Router();
var cloud = require('cloudinary');
var { indexReorder, Collections } = require('../config/config');
var { Homepage_content, Homepage_image } = require('../models/models');

router.get('/', (req, res) => {
    Homepage_content.findOne((err, content) => {
        Homepage_image.find().sort({index: 1}).exec((err, images) => {
            res.render('index', { title: null, pagename: "home", content, images })
        })
    })
});

router.get('/admin', (req, res) => {
    Collections(db => res.render('admin', { title: "Admin", pagename: "admin", ...db }))
});

router.post('/search', (req, res) => {
    Collections(db => {
        var { articles, artists, projects, locations, members } = db;
        res.send([...articles, ...artists, ...projects, ...locations, ...members]);
    })
});

router.post('/homepage/content', (req, res) => {
    Homepage_content.find((err, contents) => {
        var content = !contents.length ? new Homepage_content() : contents[0];
        if (req.body.banner_text)   content.banner_text = req.body.banner_text;
        if (req.body.footnote_text) content.footnote_text = req.body.footnote_text;
        if (req.body.socials_name && req.body.socials_url) {
            var names = (req.body.socials_name instanceof Array ? req.body.socials_name : [req.body.socials_name]).filter(e => e);
            var urls = (req.body.socials_url instanceof Array ? req.body.socials_url : [req.body.socials_url]).filter(e => e);
            var socials = [];
            names.forEach((name, i) => { socials.push({name, url: urls[i] })});
            if (content.socials instanceof Array) {
                content.socials = content.socials.filter(s => req.body.socials_name !== s.name).concat(socials);
            } else {
                content.socials = socials;
            }
        }
        content.save(err => res.send("HOMEPAGE CONTENT " + (!contents.length ? "SAVED" : "UPDATED")));
    })
});

router.post('/homepage/image/save', (req, res) => {
    cloud.v2.uploader.upload(req.body.homepage_image, { public_id: `homepage/images/${req.body.filename.replace(" ", "_")}` }, (err, result) => {
        Homepage_image.find((err, images) => {
            if (err) return res.send(err);
            var length = images.length;
            var newImage = new Homepage_image({ url: result.secure_url, p_id: result.public_id, index: req.body.index });
            newImage.save((err, saved) => {
                if (saved.index === length + 1) return res.send(err || "IMAGE SAVED");
                indexReorder(Homepage_image, saved._id, saved.index, () => res.send(err || "IMAGE SAVED"));
            });
        })
    })
});

router.post('/homepage/image/delete', (req, res) => {
    var p_ids = Object.values(req.body);
    if (p_ids.length) {
        p_ids.forEach(p_id => {
            cloud.v2.api.delete_resources([ p_id ], err => {
                if (err) return res.send(err);
                Homepage_image.deleteOne({ p_id }, err => res.send(err || "IMAGE REMOVED"))
            })
        });
    } else { res.send("NOTHING SELECTED") }
});

router.post('/homepage/image/reorder', (req, res) => {
    var { id, index } = req.body;
    indexReorder(Homepage_image, id, index, () => res.send("RE-ORDERING PROCESS DONE"));
});

router.post('/cs/links/delete', (req, res) => {
    var names = Object.values(req.body);
    Homepage_content.findOne((err, content) => {
        if (content && names.length) {
            content.socials = content.socials.filter(x => !names.includes(x.name));
            content.save(err => res.send(err || "LINK"+ (names.length > 1 ? "S" : "") +" REMOVED SUCCESSFULLY"));
        } else { res.send("NOTHING SELECTED") }
    })
});

module.exports = router;
