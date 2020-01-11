var express = require('express');
var router = express.Router();
var cloud = require('cloudinary');
var { Article } = require('../models/models');

router.get('/', (req, res) => {
	Article.find().sort({ created_at: -1 }).exec((err, articles) => {
		res.render('news', { title: "News", pagename: "news", articles })
	})
});

router.get('/article/:id', (req, res, next) => {
	Article.findById(req.params.id, (err, article) => {
		if (!article) return next();
		res.render('news-article', { title: article.headline + " | News", pagename: "news", article })
	})
});

router.post('/article/new', (req, res) => {
	var article = new Article({
		headline: req.body.headline,
		textbody: req.body.textbody
	});

	article.save((err, doc) => {
		var message_update = "";
		["headline_images", "textbody_media", "headline_images[]", "textbody_media[]"].forEach(field => {
			if (req.body[field]) {
				message_update = ": saving images";
				doc[field] = [];
				req.body[field] = typeof req.body[field] === "string" ? [req.body[field]] : req.body[field];
				req.body[field].forEach((imageStr, i) => {
					var f = field.replace("[]", "");
					if (!/youtu.?be(.*?)(embed)?|<iframe(.*?)<\/iframe>/.test(imageStr)) {
						var public_id = "article/"+ doc.id +"/"+ f + (i+1);
						cloud.v2.uploader.upload(imageStr, { public_id, resource_type: "auto" }, (err, result) => {
							if (err) console.log(err);
							if (req.body.headline_image_thumb === imageStr) doc.headline_image_thumb = result.url;
							doc[f].push(result.url);
							doc.save();
						});
					} else {
						var yt_regExp = /^.*(youtu.?be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|\?v=)/i;
						var yt_iframe = '<iframe width="560" height="315" src="' + imageStr.replace(yt_regExp, "https://youtube.com/embed/") + '" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>';
						doc[f].push( yt_regExp.test(imageStr) ? yt_iframe : imageStr );
						doc.save();
					}
				})
			}
		});
		res.send("DONE" + message_update)
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

		for (k in req.body) {
			if (req.body[k] && k !== "article_id") {
				if (/textbody_media_change|headline_images_change/g.test(k)) {
					cloud.v2.api.delete_resources_by_prefix("article/" + id, (err, result) => {
						console.log(err || result);
						["headline_images_change", "textbody_media_change", "headline_images_change[]", "textbody_media_change[]"].forEach(field => {
							if (req.body[field]) {
								message_update = ": saving images";
								article[field] = [];
								req.body[field] = typeof req.body[field] === "string" ? [req.body[field]] : req.body[field];
								req.body[field].forEach((imageStr, i) => {
									var f = field.replace("[]", "");
									if (!/<iframe(.*?)<\/iframe>/.test(imageStr)) {
										var public_id = "article/"+ id +"/"+ f + (i+1);
										cloud.v2.uploader.upload(imageStr, { public_id }, (err, result) => {
											if (err) return res.send(err);
											if (article.headline_image_thumb === imageStr) article.headline_image_thumb = result.url;
											article[f].push(result.url);
											article.save();
										});
									} else {
										article[f].push(imageStr);
										article.save();
									}
								})
							}
						});
					});
				}
				break;
			}
		}

		article.save((err, saved) => { res.send("ARTICLE UPDATED SUCCESSFULLY") });
	})
});

module.exports = router;
