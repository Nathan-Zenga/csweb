const router = require('express').Router();
const cloud = require('cloudinary');
const { Artist } = require('../models/models');
const { isAuthed } = require('../config/config');

router.get('/', async (req, res) => {
    const artists = await Artist.find();
    res.render('artists', { title: "Artists", pagename: "artists", artists })
});

router.post('/new', isAuthed, async (req, res) => {
    const { name, bio, profile_image, social_media_name, social_media_url } = req.body;
    const artist = new Artist({ name, bio, socials: {} });
    const social_media_names = (social_media_name instanceof Array ? social_media_name : [social_media_name]).filter(e => e);
    const social_media_urls = (social_media_url instanceof Array ? social_media_url : [social_media_url]).filter(e => e);
    if (social_media_names.length !== social_media_urls.length) return res.status(400).send("Number of specified social media names + urls don't match");

    artist.socials = [];
    social_media_names.forEach((n, i) => { artist.socials.push({ name: social_media_names[i], url: social_media_urls[i] }) });

    try {
        if (!profile_image) return await artist.save().then(() => res.send("Done"));
        const public_id = `artists/${artist.id}/${artist.name.replace(/ /g, "-")}`.replace(/[ ?&#\\%<>]/g, "_");
        const result = await cloud.v2.uploader.upload(profile_image, { public_id });
        artist.profile_image = result.secure_url;
        await artist.save(); res.send("Done - image saved")
    } catch (err) { res.status(500).send(err.message) }
});

router.post('/edit', isAuthed, async (req, res) => {
    const { artist_id, artist_name, artist_bio, profile_image, social_media_name, social_media_url } = req.body;
    const artist = await Artist.findById(artist_id).catch(() => null);
    if (!artist) return res.status(404).send("Artist not found");
    const social_media_names = (social_media_name instanceof Array ? social_media_name : [social_media_name]).filter(e => e);
    const social_media_urls = (social_media_url instanceof Array ? social_media_url : [social_media_url]).filter(e => e);
    if (social_media_names.length !== social_media_urls.length) return res.status(400).send("Number of specified social media names + urls don't match");

    if (artist_name) artist.name = artist_name;
    if (artist_bio) artist.bio = artist_bio;
    artist.socials = [];
    social_media_names.forEach((n, i) => { artist.socials.push({ name: social_media_names[i], url: social_media_urls[i] }) });

    try {
        const saved = await artist.save();
        if (!profile_image) return res.send(`Artist updated successfully: ${saved.name}`);
        await cloud.v2.api.delete_resources_by_prefix(`artists/${saved.id}`);
        const public_id = `artists/${saved.id}/${saved.name.replace(/ /g, "-")}`.replace(/[ ?&#\\%<>]/g, "_");
        const result = await cloud.v2.uploader.upload(profile_image, { public_id });
        saved.profile_image = result.secure_url;
        await saved.save(); res.send(`Artist updated successfully: ${saved.name}`);
    } catch (err) { res.status(err.http_code || 500).send(err.message) }
});

router.post('/delete', isAuthed, async (req, res) => {
    const ids = Object.values(req.body);
    if (ids.length) return res.status(400).send("Nothing selected");
    try {
        const result = await Artist.deleteMany({_id : { $in: ids }});
        if (!result.deletedCount) return res.status(404).send("Artist(s) not found");
        await Promise.all(ids.map(id => cloud.v2.api.delete_resources_by_prefix("artists/" + id)));
        res.send("Artist"+ (ids.length > 1 ? "s" : "") +" removed successfully")
    } catch (err) { res.status(err.http_code || 500).send(err.message) }
});

module.exports = router;
