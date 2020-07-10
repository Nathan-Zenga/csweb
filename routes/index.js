const express = require('express');
const router = express.Router();
const cloud = require('cloudinary');
const { indexReorder, Collections } = require('../config/config');
const { Homepage_content, Homepage_image } = require('../models/models');

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
        content.save(err => res.send("Homepage content " + (!contents.length ? "saved" : "updated")));
    })
});

router.post('/homepage/image/save', (req, res) => {
    const { filename, image, index } = req.body;
    const public_id = `homepage/images/${filename.replace(/ /g, "-")}`.replace(/[ ?&#\\%<>]/g, "_");
    cloud.v2.uploader.upload(image, { public_id }, (err, result) => {
        Homepage_image.find((err, images) => {
            if (err) return res.status(500).send(err.message);
            const { length } = images;
            const newImage = new Homepage_image({ url: result.secure_url, p_id: result.public_id, index });
            newImage.save((err, saved) => {
                if (err) return res.status(500).send(err.message);
                if (saved.index === length + 1) return res.send("Image saved");
                indexReorder(Homepage_image, { id: saved._id, newIndex: saved.index }, () => res.send("Image saved"));
            });
        })
    })
});

router.post('/homepage/image/delete', (req, res) => {
    var p_ids = Object.values(req.body);
    if (p_ids.length) {
        p_ids.forEach(p_id => {
            cloud.v2.api.delete_resources([ p_id ], err => {
                if (err) return res.status(500).send(err.message);
                Homepage_image.deleteOne({ p_id }, err => res.send(err ? err.message : "Image removed"))
            })
        });
    } else { res.send("Nothing selected") }
});

router.post('/homepage/image/reorder', (req, res) => {
    var { id, index } = req.body;
    indexReorder(Homepage_image, { id, newIndex: index }, () => res.send("Re-ordering process done"));
});

router.post('/cs/links/delete', (req, res) => {
    var names = Object.values(req.body);
    Homepage_content.findOne((err, content) => {
        if (content && names.length) {
            content.socials = content.socials.filter(x => !names.includes(x.name));
            content.save(err => res.send(err ? err.message : "Link"+ (names.length > 1 ? "s" : "") +" removed successfully"));
        } else { res.send("Nothing selected") }
    })
});

module.exports = router;
