var express = require('express');
var router = express.Router();
var cloud = require('cloudinary');
var { Article, Project, Artist, Location, MailingList, Homepage_banner, Homepage_image } = require('../models/models');
var Collections = cb => {
    Article.find().sort({ created_at: -1 }).exec((err, articles) => {
        Artist.find((err, artists) => {
            Project.find().sort({ year: -1 }).exec((err, projects) => {
                Location.find((err, locations) => {
                    MailingList.find((err, members) => {
                        Homepage_banner.find((err, banners) => {
                            Homepage_image.find((err, homepage_images) => {
                                cb({ articles, artists, projects, locations, members, banners, homepage_images });
                            })
                        })
                    })
                })
            })
        })
    })
};

router.get('/', (req, res) => {
    Homepage_banner.findOne((err, banner) => {
        Homepage_image.find((err, images) => {
            res.render('index', { title: null, pagename: "home", banner, images })
        })
    })
});

router.get('/admin', (req, res) => {
    Collections(db => res.render('admin', { title: "Admin", pagename: "admin", db }))
});

router.post('/search', (req, res) => {
    Collections(db => {
        var { articles, artists, projects, locations, members, banners, homepage_images } = db;
        res.send([...articles, ...artists, ...projects, ...locations, ...members, ...banners, ...homepage_images]);
    })
});

router.post('/homepage/banner', (req, res) => {
    Homepage_banner.find((err, banners) => {
        var banner = !banners.length ? new Homepage_banner() : banners[0];
        banner.text = req.body.text || banner.text;
        banner.save(err => res.send("BANNER " + (!banners.length ? "SAVED" : "UPDATED")));
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
    var { p_id } = req.body;
    cloud.v2.api.delete_resources([ p_id ], err => {
        if (err) return res.send(err);
        Homepage_image.deleteOne({ p_id }, err => res.send(err || "IMAGE REMOVED"))
    })
});

module.exports = router;
