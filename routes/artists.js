const express = require('express');
const router = express.Router();
const cloud = require('cloudinary');
const { Artist } = require('../models/models');

router.get('/', (req, res) => {
	Artist.find((err, artists) => {
		res.render('artists', { title: "Artists", pagename: "artists", artists })
	})
});

router.post('/new', (req, res) => {
	var { name, bio, profile_image, social_media_name, social_media_url } = req.body;
	var artist = new Artist({ name, bio, socials: {} });
	social_media_names = (social_media_name instanceof Array ? social_media_name : [social_media_name]).filter(e => e);
	social_media_urls = (social_media_url instanceof Array ? social_media_url : [social_media_url]).filter(e => e);

	social_media_names.forEach((name, i) => {
		artist.socials[name] = social_media_urls[i];
	});

	artist.markModified("socials");
	artist.save((err, saved) => {
		if (profile_image) {
			var public_id = "artists/"+ saved.id +"/"+ saved.name.replace(/ /g, "-");
			cloud.v2.uploader.upload(profile_image, { public_id }, (err, result) => {
				if (err) return res.send(err);
				saved.profile_image = result.secure_url;
				saved.save();
				res.send("DONE - image saved");
			});
		} else { res.send("DONE") }
	});
});

router.post('/edit', (req, res) => {
	var { artist_id, artist_name, artist_bio, profile_image, social_media_name, social_media_url } = req.body;
	Artist.findById(artist_id, (err, artist) => {
		if (err || !artist) return res.send(err ? "ERROR OCCURED" : "ARTIST NOT FOUND");

		artist.name = artist_name || artist.name;
		artist.bio = artist_bio || artist.bio;

		if (profile_image) {
			cloud.v2.api.delete_resources_by_prefix("artists/" + artist_id, err => {
				if (err) return res.send(err);
				var public_id = "artists/"+ artist_id +"/"+ artist.name.replace(/ /g, "-");
				cloud.v2.uploader.upload(profile_image, { public_id }, (err, result) => {
					if (err) return res.send(err);
					artist.profile_image = result.secure_url;
					artist.save();
				});
			});
		}

		social_media_names = (social_media_name instanceof Array ? social_media_name : [social_media_name]).filter(e => e);
		social_media_urls = (social_media_url instanceof Array ? social_media_url : [social_media_url]).filter(e => e);
		artist.socials = {};

		social_media_names.forEach((name, i) => {
			artist.socials[name] = social_media_urls[i];
		});

		artist.markModified("socials");
		artist.save((err, saved) => { res.send("ARTIST UPDATED SUCCESSFULLY: " + saved.name.toUpperCase()) });
	})
});

router.post('/delete', (req, res) => {
	var ids = Object.values(req.body);
	if (ids.length) {
		Artist.deleteMany({_id : { $in: ids }}, (err, result) => {
			if (err || !result.deletedCount) return res.send(err || "ARTIST(S) NOT FOUND");
			ids.forEach(id => {
				cloud.v2.api.delete_resources_by_prefix("artists/" + id, (err, result) => { console.log(err || result) });
			})
			res.send("ARTIST"+ (ids.length > 1 ? "S" : "") +" REMOVED SUCCESSFULLY")
		})
	} else { res.send("NOTHING SELECTED") }
});

module.exports = router;
