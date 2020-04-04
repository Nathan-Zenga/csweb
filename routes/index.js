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
    var saveMedia = (doc, cb) => {
        var msg = "", { banner_media } = req.body;
        if (banner_media) {
            msg = " - saving images / videos";
            banner_media.split(",").forEach((mediaStr, i) => {
                doc.banner_media = [];
                var public_id = "homepage/banner/image" + (i+1);
                cloud.v2.uploader.upload(mediaStr, { public_id, resource_type: "auto" }, (err, result) => {
                    if (err) res.send(err);
                    doc.banner_media.push(result.secure_url);
                    doc.save();
                });
            });
        }
        if (cb) cb(msg);
    };

    Homepage_banner.find((err, banners) => {
        var banner = !banners.length ? new Homepage_banner() : banners[0];
        banner.text = req.body.text;
        banner.save((err, saved) => {
            if (err) return res.send(err);
            cloud.v2.api.delete_resources_by_prefix("homepage/banner/", err => {
                if (err) return res.send(err);
                saveMedia(saved, msg => res.send("BANNER " + (!banners.length ? "SAVED" : "UPDATED") + msg))
            });
        });
    })
});

router.post('/homepage/image/save', (req, res) => {
    cloud.v2.uploader.upload(req.body.image, { public_id: `homepage/images/${req.body.filename}` }, (err, result) => {
        if (err) return res.send(err);
        var newImage = new Homepage_image({ image: result.secure_url });
        newImage.save(err => {
            if (err) return res.send(err);
            saved.p_id = result.public_id;
            saved.save(err => res.send(err || "IMAGE SAVED"));
        })
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
