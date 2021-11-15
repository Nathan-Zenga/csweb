const router = require('express').Router();
const { v2: cloud } = require('cloudinary');
const { Project } = require('../models/models');
const { isAuthed } = require('../config/config');

router.get('/', async (req, res) => {
    const projects = await Project.find().sort({ year: -1 }).exec();
    res.render('discography', { title: "Discography", pagename: "discography", projects })
});

router.post('/project/new', isAuthed, async (req, res) => {
    const { title, artist, year, artwork_file, artwork_url, link_name, link_url, all_platforms } = req.body;
    const link_names = (Array.isArray(link_name) ? link_name : [link_name]).filter(e => e);
    const link_urls = (Array.isArray(link_url) ? link_url : [link_url]).filter(e => e);
    if (link_names.length !== link_urls.length) return res.status(400).send("Number of specified link names + urls don't match");

    const project = new Project({ title, artist, year, artwork: artwork_url, all_platforms: !!all_platforms });
    project.links = link_names.map((name, i) => ({ name, url: link_urls[i] }));

    try {
        if (!artwork_file) { await project.save(); return res.send("Done") }
        const public_id = `discography/${project.id}/${project.title.replace(/ /g, "-")}`.replace(/[ ?&#\\%<>]/g, "_");
        const result = await cloud.uploader.upload(artwork_file, { public_id });
        project.artwork = result.secure_url;
        await project.save(); res.send("Done - artwork saved");
    } catch (err) { res.status(500).send(err.message) }
});

router.post('/project/delete', isAuthed, async (req, res) => {
    const ids = Object.values(req.body);
    if (!ids.length) return res.status(400).send("Nothing selected");
    try {
        const { deletedCount } = await Project.deleteMany({ _id : { $in: ids } });
        if (!deletedCount) return res.status(404).send("Project(s) not found");
        await Promise.all(ids.map(id => cloud.api.delete_resources_by_prefix(`discography/${id}`)));
        res.send(`Project${ids.length > 1 ? "s" : ""} removed successfully`)
    } catch (err) { res.status(500).send(err.message) }
});

router.post('/project/edit', isAuthed, async (req, res) => {
    const { link_name, link_url, project_id, title, artist, year, artwork_url, all_platforms, artwork_file } = req.body;
    const link_names = (Array.isArray(link_name) ? link_name : [link_name]).filter(e => e);
    const link_urls = (Array.isArray(link_url) ? link_url : [link_url]).filter(e => e);
    if (link_names.length !== link_urls.length) return res.status(400).send("Number of specified link names + urls don't match");

    try {
        const project = await Project.findById(project_id);
        if (!project) return res.status(404).status("Project not found");
        if (title) project.title = title;
        if (artist) project.artist = artist;
        if (year) project.year = year;
        if (artwork_url) project.artwork = artwork_url;
        if (link_names.length && link_urls.length) project.links = link_names.map((name, i) => ({ name, url: link_urls[i] }));
        project.all_platforms = !!all_platforms;

        const saved = await project.save();
        if (!artwork_file) return res.send("Done");
        await cloud.api.delete_resources_by_prefix(`discography/${saved.id}`);
        const public_id = `discography/${saved.id}/${saved.title.replace(/ /g, "-")}`.replace(/[ ?&#\\%<>]/g, "_");
        const result = await cloud.uploader.upload(artwork_file, { public_id });
        saved.artwork = result.secure_url;
        await saved.save(); res.send("Done - artwork saved");
    } catch (err) { res.status(500).send(err.message) }
});

module.exports = router;
