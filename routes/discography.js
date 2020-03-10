var express = require('express');
var router = express.Router();
var cloud = require('cloudinary');
var { Project } = require('../models/models');

router.get('/', (req, res) => {
	Project.find().sort({ year: -1 }).exec((err, projects) => {
		res.render('discography', { title: "Discography", pagename: "discography", projects })
	})
});

router.post('/project/new', (req, res) => {
	var project = new Project({
		title: req.body.title,
		artist: req.body.artist,
		year: req.body.year,
		artwork: req.body.artwork_url,
		links: req.body.links || req.body["links[]"],
		all_platforms: !!req.body.all_platforms
	});

	project.save((err, doc) => {
		var message_update = "";
		if (req.body.artwork_file) {
			message_update = ": saving image";
			var public_id = "discography/"+ doc.id +"/"+ doc.title.replace(/ /g, "-");
			cloud.v2.uploader.upload(req.body.artwork_file, { public_id }, (err, result) => {
				if (err) return res.send(err);
				doc.artwork = result.secure_url;
				doc.save();
			});
		}
		res.send("DONE" + message_update);
	});
});

router.post('/project/delete', (req, res) => {
	var ids = Object.values(req.body);
	if (ids.length) {
		Project.deleteMany({_id : { $in: ids }}, (err, result) => {
			if (err || !result.deletedCount) return res.send(err || "Project(s) not found");
			ids.forEach(id => {
				cloud.v2.api.delete_resources_by_prefix("discography/" + id, (err, result) => { console.log(result, "\n\nError: " + err) });
			})
			res.send("PROJECT"+ (ids.length > 1 ? "S" : "") +" REMOVED SUCCESSFULLY")
		})
	} else { res.send("NOTHING SELECTED") }
});

router.post('/project/edit', (req, res) => {
	Project.findById(req.body.project_id, (err, project) => {

		project.title = req.body.title_edit || project.title;
		project.artist = req.body.artist_edit || project.artist;
		project.year = req.body.year_edit || project.year;
		project.artwork = req.body.artwork_url_edit || project.artwork;
		project.links = req.body.links_edit || req.body["links_edit[]"] || project.links;
		project.all_platforms = !!req.body.all_platforms_change || project.all_platforms;

		project.save((err, doc) => {
			var message_update = "";
			if (req.body.artwork_file_change) {
				cloud.v2.api.delete_resources_by_prefix("discography/" + doc.id, (err, result) => {
					console.log(err || result);
					message_update = ": saving image";
					var public_id = "discography/"+ doc.id +"/"+ doc.title.replace(/ /g, "-");
					cloud.v2.uploader.upload(req.body.artwork_file_change, { public_id }, (err, result) => {
						if (err) return res.send(err);
						doc.artwork = result.secure_url;
						doc.save();
					});
				});
			}
			res.send("DONE" + message_update);
		});
	})
});

module.exports = router;
