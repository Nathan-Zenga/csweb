const router = require('express').Router();
const cloud = require('cloudinary');
const { each } = require('async');
const { Article } = require('../models/models');
const { isAuthed, saveMedia, indexReorder } = require('../config/config');

router.get('/', async (req, res) => {
    const articles = await Article.find().sort({ index: 1 }).exec();
    res.render('news', { title: "News", pagename: "news", articles })
});

router.get('/article/:title', async (req, res, next) => {
    const article = await Article.findOne({ headline: RegExp(req.params.title.replace(/\-/g, "\\W+"), "i") });
    if (!article) return next();
    const headline = article.headline.length > 25 ? article.headline.slice(0, 25).trim() + "..." : article.headline;
    res.render('news-article', { title: headline + " | News", pagename: "news", article })
});

router.post('/article/new', isAuthed, async (req, res) => {
    const { headline, textbody } = req.body;
    const hl = headline.replace(/\W+/g, '-').replace(/\W+$/, '');
    const existing = await Article.findOne({ headline: RegExp(hl.replace(/\-/g, "\\W+"), "i") });
    if (existing) return res.status(400).send("This headline already exists for another article.");
    const article = await Article.create({ headline, textbody, index: 1 }).catch(err => ({ err }));
    if (article.err) return res.status(500).send(article.err.message);
    const articles = await Article.find({ _id: { $ne: article._id } }).sort({ index: 1, created_at: -1 }).exec();
    articles.forEach(a => { a.index += 1; a.save() });
    saveMedia(req.body, article, (err, msg) => {
        if (err) return res.status(500).send(err.message);
        res.send(`Done${msg ? ". "+msg : ""}`);
    });
});

router.post('/article/delete', isAuthed, async (req, res) => {
    const ids = Object.values(req.body);
    if (!ids.length) return res.send("Nothing selected");
    const { err, deletedCount } = await Article.deleteMany({_id : { $in: ids }}).catch(err => ({ err }));
    if (err || !deletedCount) return res.status(err ? 500 : 404).send(err ? err.message || "Error occurred" : "Article(s) not found");
    ids.forEach(id => { cloud.v2.api.delete_resources_by_prefix("article/" + id, (err, result) => { console.log(err || result) }) });
    const articles = await Article.find().sort({index: 1}).exec();
    articles.forEach((a, i) => { a.index = i+1; a.save() });
    res.send("Article"+ (ids.length > 1 ? "s" : "") +" deleted successfully")
});

router.post('/article/edit', isAuthed, async (req, res) => {
    const { article_id, headline, textbody, headline_image_thumb } = req.body;
    const hl = headline.replace(/\W+/g, '-').replace(/\W+$/, '');
    const existing = await Article.findOne({ headline: RegExp(hl.replace(/\-/g, "\\W+"), "i") });
    const article = await Article.findById(article_id).catch(err => ({ err }));
    const { err } = article || {};
    if (err || !article) return res.status(err ? 500 : 404).send(err ? err.message : "Article not found");
    if (existing) return res.status(400).send("This headline already exists for another article.");
    if (headline) article.headline = headline;
    if (textbody) article.textbody = textbody;
    if (headline_image_thumb) article.headline_image_thumb = headline_image_thumb;

    const saved = await article.save().catch(err => ({ err }));
    if (saved.err) return res.status(500).send(saved.err.message);
    const media_fields = ["headline_images", "textbody_media"].filter(f => req.body[f]);
    if (!media_fields.length) return res.send("Article updated successfully");
    each(media_fields, (field, cb) => {
        const prefix = "article/" + saved.id + "/" + field;
        cloud.v2.api.delete_resources_by_prefix(prefix, err => { err ? cb(err) : cb() });
    }, err => {
        if (err) return res.status(500).send(err.message);
        saveMedia(req.body, saved, err => {
            if (err) return res.status(500).send(err.message || "Error occurred whilst saving article media");
            res.send("Article updated successfully");
        });
    });
});

router.post('/article/edit/reorder', isAuthed, (req, res) => {
    const { id, index } = req.body;
    indexReorder(Article, { id, newIndex: index, sort: {updated_at: -1} }, err => {
        if (err) return res.status(500).send(err.message || "Error occurred");
        res.send("Article re-ordered successfully")
    });
});

module.exports = router;
