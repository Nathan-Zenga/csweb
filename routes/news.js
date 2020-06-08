const express = require('express');
const router = express.Router();
const cloud = require('cloudinary');
const { Article } = require('../models/models');
const { saveMedia, indexReorder } = require('../config/config');

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
    var article = new Article({ headline, textbody, index: 1 });
    article.save((err, saved) => {
        Article.find({ _id: { $ne: saved._id } }).sort({index: 1, created_at: -1}).exec((err, articles) => {
            articles.forEach(a => { a.index += 1; a.save() });
            saveMedia(req.body, saved, (err, msg) => res.send(err || `DONE${msg ? ". "+msg : ""}`));
        })
    })
});

router.post('/article/delete', (req, res) => {
    var ids = Object.values(req.body);
    if (ids.length) {
        Article.deleteMany({_id : { $in: ids }}, (err, result) => {
            if (err || !result.deletedCount) return res.send(err || "Article(s) not found");
            ids.forEach(id => {
                cloud.v2.api.delete_resources_by_prefix("article/" + id, (err, result) => { console.log(err || result) });
            });
            Article.find().sort({index: 1}).exec((err, articles) => {
                articles.forEach((a, i) => { a.index = i+1; a.save() });
                res.send("ARTICLE"+ (ids.length > 1 ? "S" : "") +" DELETED SUCCESSFULLY")
            })
        })
    } else { res.send("NOTHING SELECTED") }
});

router.post('/article/edit', (req, res) => {
    var { article_id, headline, textbody, headline_image_thumb } = req.body;
    Article.findById(article_id, (err, article) => {
        if (err || !article) return res.send(err ? "Error occurred" : "Article not found");

        if (headline) article.headline = headline;
        if (textbody) article.textbody = textbody;
        if (headline_image_thumb) article.headline_image_thumb = headline_image_thumb;

        article.save((err, saved) => {
            if (err) return console.error(err), res.send("Error occurred whilst saving article");
            var fields = ["headline_images", "textbody_media"].filter(f => req.body[f]);
            if (fields.length) {
                fields.forEach((field, i, arr) => {
                    var prefix = "article/" + article_id + "/" + field;
                    cloud.v2.api.delete_resources_by_prefix(prefix, (err, result) => {
                        console.log(err || result);
                        if (i === arr.length-1) saveMedia(req.body, saved, err => {
                            if (err) return console.error(err), res.send(err);
                            res.send("Article updated successfully");
                        });
                    });
                });
            } else {
                res.send("Article updated successfully");
            }
        });
    })
});

router.post('/article/edit/reorder', (req, res) => {
    var { id, index } = req.body;
    indexReorder(Article, { id, newIndex: index, sort: {updated_at: -1} }, result => res.send(result || "ARTICLE RE-ORDERED SUCCESSFULLY"));
});

module.exports = router;
