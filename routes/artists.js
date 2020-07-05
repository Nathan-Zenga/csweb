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
    const { name, bio, profile_image, social_media_name, social_media_url } = req.body;
    const artist = new Artist({ name, bio, socials: {} });
    const social_media_names = (social_media_name instanceof Array ? social_media_name : [social_media_name]).filter(e => e);
    const social_media_urls = (social_media_url instanceof Array ? social_media_url : [social_media_url]).filter(e => e);
    if (social_media_names.length !== social_media_urls.length) return res.send("Number of specified social media names + urls don't match");

    artist.socials = [];
    social_media_names.forEach((name, i) => {
        artist.socials.push({ name: social_media_names[i], url: social_media_urls[i] });
    });

    artist.save((err, saved) => {
        if (profile_image) {
            var public_id = "artists/"+ saved.id +"/"+ saved.name.replace(/ /g, "-");
            cloud.v2.uploader.upload(profile_image, { public_id }, (err, result) => {
                if (err) return res.status(500).send(err.message || "Error occurred whilst uploading");
                saved.profile_image = result.secure_url;
                saved.save();
                res.send("Done - image saved");
            });
        } else { res.send("Done") }
    });
});

router.post('/edit', (req, res) => {
    const { artist_id, artist_name, artist_bio, profile_image, social_media_name, social_media_url } = req.body;
    Artist.findById(artist_id, (err, artist) => {
        if (err || !artist) return res.status(err ? 500 : 404).send(err ? err.message || "Error occured" : "Artist not found");
        const social_media_names = (social_media_name instanceof Array ? social_media_name : [social_media_name]).filter(e => e);
        const social_media_urls = (social_media_url instanceof Array ? social_media_url : [social_media_url]).filter(e => e);
        if (social_media_names.length !== social_media_urls.length) return res.send("Number of specified social media names + urls don't match");

        if (artist_name) artist.name = artist_name;
        if (artist_bio) artist.bio = artist_bio;
        artist.socials = [];
        social_media_names.forEach((name, i) => { artist.socials.push({ name: social_media_names[i], url: social_media_urls[i] }) });
        artist.save((err, saved) => {
            if (!profile_image) return res.send("Artist updated successfully: " + saved.name);
            cloud.v2.api.delete_resources_by_prefix("artists/" + saved.id, err => {
                if (err) return res.status(500).send(err.message || "Error occurred whilst uploading");
                var public_id = "artists/"+ saved.id +"/"+ saved.name.replace(/ /g, "-");
                cloud.v2.uploader.upload(profile_image, { public_id }, (err, result) => {
                    if (err) return res.status(500).send(err.message);
                    saved.profile_image = result.secure_url;
                    saved.save((err, saved) => { res.send("Artist updated successfully: " + saved.name) });
                });
            });
        });
    })
});

router.post('/delete', (req, res) => {
    var ids = Object.values(req.body);
    if (ids.length) {
        Artist.deleteMany({_id : { $in: ids }}, (err, result) => {
            if (err || !result.deletedCount) return res.status(err ? 500 : 404).send(err ? err.message || "Error occurred" : "Artist(s) not found");
            ids.forEach(id => {
                cloud.v2.api.delete_resources_by_prefix("artists/" + id, (err, result) => { console.log(err.message || result) });
            })
            res.send("Artist"+ (ids.length > 1 ? "s" : "") +" removed successfully")
        })
    } else { res.send("Nothing selected") }
});

module.exports = router;
