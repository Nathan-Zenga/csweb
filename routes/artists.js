var express = require('express');
var router = express.Router();
var cloud = require('cloudinary');
var { Artist } = require('../models/models');

router.get('/', (req, res) => {
	Artist.find((err, artists) => {
		res.render('artists', { title: "Artists", pagename: "artists", artists })
	})
});

router.post('/new', (req, res) => {
	var artist = new Artist({
		name: req.body.name,
		bio: req.body.bio
	});

	for (k in req.body) if (k.includes("socials")) {
		if (!artist.socials) artist.socials = {};
		artist.socials[k.replace(/socials\[|\]/g, "")] = req.body[k];
	}

	artist.markModified("socials");
	artist.save((err, doc) => {
		var message_update = "";
		if (req.body.profile_image) {
			message_update = ": saving image";
			var public_id = "artists/"+ doc.id +"/"+ doc.name.replace(/ /g, "-");
			cloud.v2.uploader.upload(req.body.profile_image, { public_id }, (err, result) => {
				if (err) return res.send(err);
				doc.profile_image = result.url;
				doc.save();
			});
		}
		res.send("DONE" + message_update);
	});
});

router.post('/edit', (req, res) => {
	var id = req.body.artist_id;
	Artist.findById(id, (err, artist) => {
		if (err || !artist) return res.send(err ? "ERROR OCCURED" : "ARTIST NOT FOUND");

		artist.name = req.body.artist_name_edit || artist.name;
		artist.bio = req.body.artist_bio_edit || artist.bio;

		for (k in req.body) {
			if (req.body[k] && k !== "artist_id") {
				if (k.includes("socials")) {
					artist.socials[k.replace(/socials\[|\]/g, "")] = req.body[k];
				} else if (k === "profile_image_change") {
					cloud.v2.api.delete_resources_by_prefix("artists/" + id, (err, result) => {
						console.log(err || result);
						var public_id = "artists/"+ id +"/"+ artist.name.replace(/ /g, "-");
						cloud.v2.uploader.upload(req.body.profile_image_change, { public_id }, (err, result) => {
							if (err) return res.send(err);
							artist.profile_image = result.url;
							artist.save();
						});
					});
				} else {
					artist[k] = req.body[k];
				}
			}
		}

		artist.markModified("socials");
		artist.save((err, saved) => { res.send("ARTIST UPDATED SUCCESSFULLY: " + saved.name.toUpperCase()) });
	})
});

router.post('/delete', (req, res) => {
	var keys = Object.keys(req.body);
	if (keys.length) {
		keys.forEach((k, i) => {
			var id = req.body[k];
			Artist.findByIdAndDelete(id, (err, doc) => {
				if (err || !doc) return res.send(err || "Artist not found");
				cloud.v2.api.delete_resources_by_prefix("artists/" + id, (err, result) => { console.log(result, "\n\nError: " + err) });
				if (i === keys.length-1) res.send("ARTISTS REMOVED SUCCESSFULLY")
			})
		})
	} else { res.send("NOTHING SELECTED") }
});

module.exports = router;
