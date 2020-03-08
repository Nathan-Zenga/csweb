var express = require('express');
var router = express.Router();
var cloud = require('cloudinary');
var { Article } = require('../models/models');
var saveMedia = (body, doc, cb) => {
    var msg = "";
    var fields = ["headline_images", "textbody_media", "headline_images[]", "textbody_media[]",
                  "headline_images_change", "textbody_media_change", "headline_images_change[]", "textbody_media_change[]"]
                  .filter(f => body[f]);
    fields.forEach(field => {
        var f = field.replace(/_change|\[\]/g, "");
        doc[f] = [];
        body[field] = typeof body[field] === "string" ? [body[field]] : body[field];
        body[field].forEach((mediaStr, i) => {
            var notIframe = !["<iframe", "embed"].filter(x => mediaStr.includes(x)).length;
            if (notIframe) {
                var public_id = "article/"+ doc.id +"/"+ f + (i+1);
                cloud.v2.uploader.upload(mediaStr, { public_id, resource_type: "auto" }, (err, result) => {
                    if (err) console.log(err);
                    if (body.headline_image_thumb === mediaStr) doc.headline_image_thumb = result.secure_url;
                    doc[f].push(result.secure_url);
                    doc.save();
                });
            } else {
                var ytUrl = ["youtu"].filter(x => mediaStr.includes(x)).length && notIframe;
                var toReplace = /^.*(youtu.?be\/|v\/|u\/\w\/|watch\?v=|\&v=|\?v=)/i;
                var ytIframe = '<iframe src="' + mediaStr.replace(toReplace, "https://youtube.com/embed/") + '" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>';
                mediaStr = ytUrl ? ytIframe : mediaStr;
                doc[f].push( mediaStr.replace(/(width|height|style)\=\"?\'?(.*?)\"?\'? /gi, "") );
                doc.save();
            }
        });
        msg = " - saving images / videos";
    });
    if (cb) cb(msg);
};

router.get('/', (req, res) => {
    Article.find().sort({ created_at: -1 }).exec((err, articles) => {
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

module.exports = router;
