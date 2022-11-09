const router = require('express').Router();
const { v2: cloud } = require('cloudinary');
const { Artist } = require('../models/models');
const { isAuthed } = require('../modules/config');

router.get('/', async (req, res) => {
    const artists = await Artist.find();
    res.render('artists', { artists })
});

router.post('/new', isAuthed, async (req, res) => {
    const { name, bio, profile_image, social_media_name, social_media_url } = req.body;
    const artist = new Artist({ name, bio });
    const social_media_names = (Array.isArray(social_media_name) ? social_media_name : [social_media_name]).filter(e => e);
    const social_media_urls = (Array.isArray(social_media_url) ? social_media_url : [social_media_url]).filter(e => e);
    if (social_media_names.length !== social_media_urls.length) return res.status(400).send("Number of specified social media names + urls don't match");

    artist.socials = social_media_names.map((name, i) => ({ name, url: social_media_urls[i] }));

    try {
        const public_id = `artists/${artist.id}/${artist.name.replace(/ /g, "-")}`.replace(/[ ?&#\\%<>]/g, "_");
        const result = profile_image ? await cloud.uploader.upload(profile_image, { public_id }) : null;
        if (result) artist.profile_image = result.secure_url;
        await artist.save(); res.send(`Done${result ? ", profile picture saved" : ""}`)
    } catch (err) { res.status(500).send(err.message) }
});

router.post('/edit', isAuthed, async (req, res) => {
    const { artist_id, name, bio, profile_image, social_media_name, social_media_url } = req.body;
    try {
        const artist = await Artist.findById(artist_id);
        if (!artist) return res.status(404).send("Artist not found");
        const social_media_names = (Array.isArray(social_media_name) ? social_media_name : [social_media_name]).filter(e => e);
        const social_media_urls = (Array.isArray(social_media_url) ? social_media_url : [social_media_url]).filter(e => e);
        if (social_media_names.length !== social_media_urls.length) return res.status(400).send("Number of specified social media names + urls don't match");

        if (name) artist.name = name;
        if (bio) artist.bio = bio;
        artist.socials = social_media_names.map((name, i) => ({ name, url: social_media_urls[i] }));

        if (profile_image) await cloud.api.delete_resources_by_prefix(`artists/${artist.id}`);
        const public_id = `artists/${artist.id}/${artist.name.replace(/ /g, "-")}`.replace(/[ ?&#\\%<>]/g, "_");
        const result = profile_image ? await cloud.uploader.upload(profile_image, { public_id }) : null;
        if (result) artist.profile_image = result.secure_url;
        await artist.save(); res.send(`Artist updated successfully: ${artist.name}`);
    } catch (err) { res.status(err.http_code || 500).send(err.message) }
});

router.post('/delete', isAuthed, async (req, res) => {
    const ids = Object.values(req.body);
    if (!ids.length) return res.status(400).send("Nothing selected");
    try {
        const result = await Artist.deleteMany({_id : { $in: ids }});
        if (!result.deletedCount) return res.status(404).send("Artist(s) not found");
        await Promise.all(ids.map(id => cloud.api.delete_resources_by_prefix("artists/" + id)));
        res.send("Artist"+ (ids.length > 1 ? "s" : "") +" removed successfully")
    } catch (err) { res.status(err.http_code || 500).send(err.message) }
});

module.exports = router;
