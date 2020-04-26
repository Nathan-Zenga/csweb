var express = require('express');
var router = express.Router();
var cloud = require('cloudinary');
var { Article } = require('../models/models');
var { saveMedia, indexReorder } = require('../config/config');

router.get('/', (req, res) => {
    Article.find().sort({ index: 1 }).exec((err, articles) => {
        res.render('news', { title: "News", pagename: "news", articles })
    })
});

router.get('/article/:id', (req, res, next) => {
    Article.findById(req.params.id, (err, article) => {
        if (!article) return next();
        var headline = article.headline.length > 25 ? article.headline.slice(0, 25).trim() + "..." : article.headline;
        res.render('news-article', { title: headline + " | News", pagename: "news", article })
    })
});

router.post('/article/new', (req, res) => {
    var { headline, textbody } = req.body;
    var article = new Article({ headline, textbody });
    article.save((err, doc) => { saveMedia(req.body, doc, msg => res.send("DONE" + msg)) });
});

router.post('/article/delete', (req, res) => {
    var ids = Object.values(req.body);
    if (ids.length) {
        Article.deleteMany({_id : { $in: ids }}, (err, result) => {
            if (err || !result.deletedCount) return res.send(err || "Article(s) not found");
            ids.forEach(id => {
                cloud.v2.api.delete_resources_by_prefix("article/" + id, (err, result) => { console.log(err || result) });
            })
            res.send("ARTICLE"+ (ids.length > 1 ? "S" : "") +" DELETED SUCCESSFULLY")
        })
    } else { res.send("NOTHING SELECTED") }
});

router.post('/article/edit', (req, res) => {
    var id = req.body.article_id;
    Article.findById(id, (err, article) => {
        if (err || !article) return res.send(err ? "ERROR OCCURED" : "ARTICLE NOT FOUND");

        article.headline = req.body.headline_edit || article.headline;
        article.textbody = req.body.textbody_edit || article.textbody;
        article.headline_image_thumb = req.body.headline_image_thumb_change || article.headline_image_thumb;

        for (k in req.body) {
            if (req.body[k] && k !== "article_id") {
                if (/textbody_media_change|headline_images_change/g.test(k)) {
                    var k = k.replace(/_change|\[\]/gi, "");
                    cloud.v2.api.delete_resources_by_prefix("article/" + id + "/" + k, (err, result) => {
                        console.log(err || result);
                        article[k] = [];
                        article.save((err, doc) => { saveMedia(req.body, doc) });
                    });
                }
                break;
            }
        }

        article.save((err, saved) => { res.send("ARTICLE UPDATED SUCCESSFULLY") });
    })
});

router.post('/article/edit/reorder', (req, res) => {
    var { id, index } = req.body;
    indexReorder(Article, { id, newIndex: index, sort: {created_at: -1} }, () => res.send("ARTICLE RE-ORDERED SUCCESSFULLY"));
});

module.exports = router;
