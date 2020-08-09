const router = require('express').Router();
const cloud = require('cloudinary');
const { each } = require('async');
const { Article } = require('../models/models');
const { isAuthed, saveMedia, indexReorder } = require('../config/config');

router.get('/', (req, res) => {
    Article.find().sort({ index: 1 }).exec((err, articles) => {
        res.render('news', { title: "News", pagename: "news", articles })
    })
});

router.get('/article/:id', (req, res, next) => {
    Article.findById(req.params.id, (err, article) => {
        if (!article) return next();
        const headline = article.headline.length > 25 ? article.headline.slice(0, 25).trim() + "..." : article.headline;
        res.render('news-article', { title: headline + " | News", pagename: "news", article })
    })
});

router.post('/article/new', isAuthed, (req, res) => {
    const { headline, textbody } = req.body;
    const article = new Article({ headline, textbody, index: 1 });
    article.save((err, saved) => {
        Article.find({ _id: { $ne: saved._id } }).sort({index: 1, created_at: -1}).exec((err, articles) => {
            articles.forEach(a => { a.index += 1; a.save() });
            saveMedia(req.body, saved, (err, msg) => {
                if (err) return res.status(500).send(err.message);
                res.send(`Done${msg ? ". "+msg : ""}`);
            });
        })
    })
});

router.post('/article/delete', isAuthed, (req, res) => {
    const ids = Object.values(req.body);
    if (!ids.length) return res.send("Nothing selected");
    Article.deleteMany({_id : { $in: ids }}, (err, result) => {
        if (err || !result.deletedCount) return res.status(err ? 500 : 404).send(err ? err.message || "Error occurred" : "Article(s) not found");
        ids.forEach(id => {
            cloud.v2.api.delete_resources_by_prefix("article/" + id, (err, result) => { console.log(err || result) });
        });
        Article.find().sort({index: 1}).exec((err, articles) => {
            articles.forEach((a, i) => { a.index = i+1; a.save() });
            res.send("Article"+ (ids.length > 1 ? "s" : "") +" deleted successfully")
        })
    })
});

router.post('/article/edit', isAuthed, (req, res) => {
    const { article_id, headline, textbody, headline_image_thumb } = req.body;
    Article.findById(article_id, (err, article) => {
        if (err || !article) return res.status(err ? 500 : 404).send(err ? err.message || "Error occurred" : "Article not found");

        if (headline) article.headline = headline;
        if (textbody) article.textbody = textbody;
        if (headline_image_thumb) article.headline_image_thumb = headline_image_thumb;

        article.save((err, saved) => {
            if (err) return res.status(500).send(err.message || "Error occurred whilst saving article");
            const media_fields = ["headline_images", "textbody_media"].filter(f => req.body[f]);
            if (!media_fields.length) return res.send("Article updated successfully");
            each(media_fields, (field, cb) => {
                const prefix = "article/" + article_id + "/" + field;
                cloud.v2.api.delete_resources_by_prefix(prefix, (err, result) => {
                    if (err) return cb(err);
                    cb();
                })
            }, err => {
                if (err) return res.status(500).send(err.message || "Error occurred whilst deleting article media");
                saveMedia(req.body, saved, err => {
                    if (err) return res.status(500).send(err.message || "Error occurred whilst saving article media");
                    res.send("Article updated successfully");
                });
            });
        });
    })
});

router.post('/article/edit/reorder', isAuthed, (req, res) => {
    const { id, index } = req.body;
    indexReorder(Article, { id, newIndex: index, sort: {updated_at: -1} }, err => {
        if (err) return res.status(500).send(err.message || "Error occurred");
        res.send("Article re-ordered successfully")
    });
});

module.exports = router;
