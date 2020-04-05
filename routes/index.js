var express = require('express');
var router = express.Router();
var cloud = require('cloudinary');
var { Article, Project, Artist, Location, MailingList, Homepage_content, Homepage_image } = require('../models/models');
var Collections = cb => {
    Article.find().sort({ created_at: -1 }).exec((err, articles) => {
        Artist.find((err, artists) => {
            Project.find().sort({ year: -1 }).exec((err, projects) => {
                Location.find((err, locations) => {
                    MailingList.find((err, members) => {
                        Homepage_content.find((err, homepage_contents) => {
                            Homepage_image.find((err, homepage_images) => {
                                cb({ articles, artists, projects, locations, members, homepage_contents, homepage_images });
                            })
                        })
                    })
                })
            })
        })
    })
};

router.get('/', (req, res) => {
    Homepage_content.findOne((err, content) => {
        Homepage_image.find((err, images) => {
            res.render('index', { title: null, pagename: "home", content, images })
        })
    })
});

router.get('/admin', (req, res) => {
    Collections(db => res.render('admin', { title: "Admin", pagename: "admin", db }))
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
        content.save(err => res.send("HOMEPAGE CONTENT " + (!contents.length ? "SAVED" : "UPDATED")));
    })
});

router.post('/homepage/image/save', (req, res) => {
    cloud.v2.uploader.upload(req.body.homepage_image, { public_id: `homepage/images/${req.body.filename.replace(" ", "_")}` }, (err, result) => {
        if (err) return res.send(err);
        var newImage = new Homepage_image({ url: result.secure_url, p_id: result.public_id });
        newImage.save(err => res.send(err || "IMAGE SAVED"));
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

module.exports = router;
