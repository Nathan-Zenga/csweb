const router = require('express').Router();
const { v2: cloud } = require('cloudinary');
const { Article } = require('../models/models');
const { isAuthed, saveMedia, indexReorder } = require('../modules/config');

router.get('/', async (req, res) => {
    const articles = await Article.find().sort({ index: 1 }).exec();
    res.render('news', { articles })
});

router.get('/article/:title', async (req, res, next) => {
    const title = req.params.title.replace(/\-|\$/g, "\\W+");
    const a = await Article.findById(req.params.title).catch(e => null);
    const article = a || await Article.findOne({ headline: RegExp(`^(\\W+|_+)?${title}(\\W+|_+)?$`, "i") });
    if (!article) return next();
    const adjacent_articles = await Article.find({ $or: [{ index: article.index-1 }, { index: article.index+1 }] }).sort({ index: 1 });
    res.render('news-article', { title: article.headline_cropped() + " | News", article, adjacent_articles })
});

router.post('/article/new', isAuthed, async (req, res) => {
    const { headline, textbody } = req.body;
    const article = new Article({ headline, textbody, index: 1 });
    const found = await Article.findOne({ headline: RegExp(`^${headline.replace(/\W/g, m => "\\"+m)}$`, "i") });
    if (found?.link === article.link) return res.status(400).send("This headline cannot be used as it conflicts with another article.");
    const articles = await Article.find().sort({ index: 1, created_at: -1 }).exec();
    try {
        const results = await saveMedia(req.body, article);
        if (results) for (let k in results) article[k] = results[k];
        await Promise.all(articles.map(a => { a.index += 1; return a.save() }));
        await article.save(); res.send("New article now posted");
    } catch (err) { return res.status(err.http_code || 500).send(err.message) }
});

router.post('/article/delete', isAuthed, async (req, res) => {
    const ids = Object.values(req.body);
    if (!ids.length) return res.status(400).send("Nothing selected");
    try {
        const { deletedCount } = await Article.deleteMany({_id : { $in: ids }});
        if (!deletedCount) return res.status(404).send("Article(s) not found");
        await Promise.all(ids.map(id => cloud.api.delete_resources_by_prefix(`article/${id}`)));
        const articles = await Article.find().sort({ index: 1 }).exec();
        await Promise.all(articles.map((a, i) => { a.index = i+1; return a.save() }));
        res.send(`Article${ids.length > 1 ? "s" : ""} deleted successfully`)
    } catch (err) { res.status(err.http_code || 500).send(err.message) }
});

router.post('/article/edit', isAuthed, async (req, res) => {
    const { article_id, headline, textbody, headline_image_thumb } = req.body;
    try {
        const article = await Article.findById(article_id);
        if (!article) return res.status(404).send("Article not found");
        if (headline) article.headline = headline;
        const found = await Article.findOne({ headline: RegExp(`^${headline.replace(/\W/g, m => "\\"+m)}$`, "i"), $not: { _id: article_id } });
        if (found?.link === article.link) return res.status(400).send("This headline cannot be used as it conflicts with another article.");
        if (textbody) article.textbody = textbody;
        if (headline_image_thumb) article.headline_image_thumb = headline_image_thumb;

        const media_fields = ["headline_images", "textbody_media"].filter(f => req.body[f]);
        if (!media_fields.length) { await article.save(); return res.send("Article updated successfully") }
        const results = await saveMedia(req.body, article);
        const urls_to_delete1 = results?.headline_images.length ? article.headline_images.slice(results.headline_images.length) : [];
        const urls_to_delete2 = results?.textbody_media.length ? article.textbody_media.slice(results.textbody_media.length) : [];
        await Promise.all([...urls_to_delete1, ...urls_to_delete2].map(url => {
            const prefix = url.slice(url.indexOf("/article/"));
            return url.startsWith("https://res.cloudinary.com") ? cloud.api.delete_resources_by_prefix(prefix) : null;
        }));
        if (results) for (let k in results) article[k] = results[k].length ? results[k] : article[k];
        await article.save(); res.send("Article updated successfully")
    } catch (err) { res.status(err.http_code || 500).send(err.message) }
});

router.post('/article/edit/reorder', isAuthed, (req, res) => {
    const { id, index: newIndex } = req.body;
    indexReorder(Article, { id, newIndex, sort: {updated_at: -1} }, err => {
        if (err) return res.status(500).send(err.message || "Error occurred");
        res.send("Article re-ordered successfully")
    });
});

module.exports = router;
