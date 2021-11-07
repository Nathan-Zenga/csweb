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
    const title = req.params.title.replace(/\-|\$/g, "\\W+");
    var article = await Article.findById(req.params.title).catch(err => null);
    article = article || await Article.findOne({ headline: RegExp(`^${title}(\\W+|_+)?$`, "i") });
    if (!article) return next();
    const headline = article.headline.length > 25 ? article.headline.slice(0, 25).trim() + "..." : article.headline;
    res.render('news-article', { title: headline + " | News", pagename: "news-article", article })
});

router.post('/article/new', isAuthed, async (req, res) => {
    const { headline, textbody } = req.body;
    const hl = headline.replace(/\W+/g, '-').replace(/\W+$/, '').replace(/\-|\$/g, "\\W+");
    const existing = await Article.findOne({ headline: RegExp(`^${hl}(\\W+|_+)?$`, "i") });
    if (existing) return res.status(400).send("This headline already exists for another article.");
    const article = await Article.create({ headline, textbody, index: 1 }).catch(err => ({ err }));
    if (article.err) return res.status(500).send(article.err.message);
    const articles = await Article.find({ _id: { $ne: article._id } }).sort({ index: 1, created_at: -1 }).exec();
    articles.forEach(a => { a.index += 1; a.save() });
    saveMedia(req.body, article, (err, msg) => {
        if (err) return res.status(err.http_code || 500).send(err.message);
        res.send(`Done${msg ? ". "+msg : ""}`);
    });
});

router.post('/article/delete', isAuthed, async (req, res) => {
    const ids = Object.values(req.body);
    if (!ids.length) return res.status(400).send("Nothing selected");
    try {
        const { deletedCount } = await Article.deleteMany({_id : { $in: ids }});
        if (!deletedCount) return res.status(404).send("Article(s) not found");
        await Promise.all(ids.map(id => cloud.v2.api.delete_resources_by_prefix(`article/${id}`)));
        const articles = await Article.find().sort({index: 1}).exec();
        await Promise.all(articles.map((a, i) => { a.index = i+1; return a.save() }));
        res.send(`Article${ids.length > 1 ? "s" : ""} deleted successfully`)
    } catch (err) { res.status(err.http_code || 500).send(err.message) }
});

router.post('/article/edit', isAuthed, async (req, res) => {
    const { article_id, headline, textbody, headline_image_thumb } = req.body;
    const hl = headline.replace(/\W+/g, '-').replace(/\W+$/, '').replace(/\-|\$/g, "\\W+");
    const existing = await Article.findOne({ headline: RegExp(`^${hl}(\\W+|_+)?$`, "i") });
    const article = await Article.findById(article_id).catch(err => ({ err }));
    const { err } = article || {};
    if (err || !article) return res.status(err ? 500 : 404).send(err ? err.message : "Article not found");
    if (existing && existing.id !== article_id) return res.status(400).send("This headline already exists for another article.");
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
            if (err) return res.status(err.http_code || 500).send(err.message);
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
