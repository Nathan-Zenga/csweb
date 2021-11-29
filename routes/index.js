const router = require('express').Router();
const { v2: cloud } = require('cloudinary');
const { each } = require('async');
const { isAuthed, indexReorder } = require('../config/config');
const { Homepage_content, Homepage_image } = require('../models/models');

router.get('/', async (req, res) => {
    const content = await Homepage_content.findOne();
    const images = await Homepage_image.find().sort({index: 1}).exec();
    res.render('index', { title: null, pagename: "home", content, images })
});

router.get('/events', (req, res, next) => { res.status(404); next() });

router.post('/homepage/content', isAuthed, async (req, res) => {
    const { banner_text, footnote_text, socials_name, socials_url } = req.body;
    const contents = await Homepage_content.find();
    const content = !contents.length ? new Homepage_content() : contents[0];
    if (banner_text)   content.banner_text = banner_text;
    if (footnote_text) content.footnote_text = footnote_text;
    if (socials_name && socials_url) {
        const names = (Array.isArray(socials_name) ? socials_name : [socials_name]).filter(e => e);
        const urls = (Array.isArray(socials_url) ? socials_url : [socials_url]).filter(e => e);
        if (names.length !== urls.length) return res.status(400).send("Number of specified social names + urls don't match");
        const socials = names.map((name, i) => ({ name, url: urls[i] }));
        if (Array.isArray(content.socials)) {
            content.socials = content.socials.filter(s => socials_name !== s.name).concat(socials);
        } else {
            content.socials = socials;
        }
    }
    content.save(err => res.send("Homepage content " + (!contents.length ? "saved" : "updated")));
});

router.post('/homepage/image/save', isAuthed, async (req, res) => {
    const { filename, image, index } = req.body;
    const public_id = `homepage/images/${filename.replace(/ /g, "-")}`.replace(/[ ?&#\\%<>]/g, "_");
    try {
        const result = await cloud.uploader.upload(image, { public_id });
        const { length } = await Homepage_image.find();
        const newImage = new Homepage_image({ url: result.secure_url, p_id: result.public_id, index });
        const saved = await newImage.save();
        if (saved.index === length + 1) return res.send("Image saved");
        indexReorder(Homepage_image, { id: saved._id, newIndex: saved.index }, () => res.send("Image saved"));
    } catch (err) { res.status(err.http_code || 500).send(err.message) }
});

router.post('/homepage/image/delete', isAuthed, (req, res) => {
    const p_ids = Object.values(req.body);
    if (!p_ids.length) return res.status(400).send("Nothing selected");
    each(p_ids, (p_id, cb) => {
        cloud.api.delete_resources([ p_id ], err => {
            if (err) return cb(err);
            Homepage_image.deleteOne({ p_id }, err => { err ? cb(err) : cb() });
        })
    }, err => res.status(err ? err.http_code || 500 : 200).send(err ? err.message : "Images removed"));
});

router.post('/homepage/image/reorder', isAuthed, (req, res) => {
    const { id, index } = req.body;
    indexReorder(Homepage_image, { id, newIndex: index }, () => res.send("Re-ordering process done"));
});

router.post('/cs/links/delete', isAuthed, async (req, res) => {
    const names = Object.values(req.body);
    const content = await Homepage_content.findOne();
    if (!content || !names.length) return res.status(400).send("Nothing selected");
    content.socials = content.socials.filter(x => !names.includes(x.name));
    content.save(err => res.status(err ? 500 : 200).send(err ? err.message : `Link${names.length > 1 ? "s" : ""} removed successfully`));
});

module.exports = router;
