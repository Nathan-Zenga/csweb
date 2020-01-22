var express = require('express');
var router = express.Router();
var cloud = require('cloudinary');
var { Article } = require('../models/models');
var saveMedia = (body, doc, cb) => {
    var msg = "";
    var fields = ["headline_images", "textbody_media", "headline_images[]", "textbody_media[]",
                  "headline_images_change", "textbody_media_change", "headline_images_change[]", "textbody_media_change[]"];
    fields.forEach((field, i) => {
        if (body[field]) {
            doc[field] = [];
            body[field] = typeof body[field] === "string" ? [body[field]] : body[field];
            body[field].forEach((imageStr, i) => {
                var f = field.replace(/_change|\[\]/g, "");
                var notIframe = "(?=.*(^((?!<\/?iframe>?).)*$))(?=.*(^((?!embed).)*$)).*";
                if (RegExp(notIframe, "i").test(imageStr)) {
                    var public_id = "article/"+ doc.id +"/"+ f + (i+1);
                    cloud.v2.uploader.upload(imageStr, { public_id, resource_type: "auto" }, (err, result) => {
                        if (err) console.log(err);
                        if (body.headline_image_thumb === imageStr) doc.headline_image_thumb = result.url;
                        doc[f].push(result.url);
                        doc.save();
                    });
                } else {
                    var ytUrl = RegExp("(?=.*youtu.?be)" + notIframe, "i");
                    var toReplace = /^.*(youtu.?be\/|v\/|u\/\w\/|watch\?v=|\&v=|\?v=)/i;
                    var ytIframe = '<iframe src="' + imageStr.replace(toReplace, "https://youtube.com/embed/") + '" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>';
                    imageStr = ytUrl.test(imageStr) ? ytIframe : imageStr;
                    doc[f].push( imageStr.replace(/(width|height|style)\=\"?\'?(.*?)\"?\'? /gi, "") );
                    doc.save();
                }
            })
            msg = "saving images";
        }
        if (cb && i === fields.length) cb(msg);
    });
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
    var article = new Article({
        headline: req.body.headline,
        textbody: req.body.textbody
    });

    article.save((err, doc) => {
        var message_update = "";
        saveMedia(req.body, doc, msg => { message_update = msg || "" });
        res.send("DONE" + message_update);
    });
});

router.post('/article/delete', (req, res) => {
    var ids = Object.values(req.body);
    if (ids.length) {
        Article.deleteMany({_id : { $in: ids }}, (err, result) => {
            if (err || !result.deletedCount) return res.send(err || "Article(s) not found");
            ids.forEach(id => {
                cloud.v2.api.delete_resources_by_prefix("article/" + id, (err, result) => { console.log(result, "\n\nError: " + err) });
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
