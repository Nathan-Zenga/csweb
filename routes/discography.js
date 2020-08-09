const router = require('express').Router();
const cloud = require('cloudinary');
const { Project } = require('../models/models');
const { isAuthed } = require('../config/config');

router.get('/', (req, res) => {
    Project.find().sort({ year: -1 }).exec((err, projects) => {
        res.render('discography', { title: "Discography", pagename: "discography", projects })
    })
});

router.post('/project/new', isAuthed, (req, res) => {
    const { title, artist, year, artwork_file, artwork_url, link_name, link_url, all_platforms } = req.body;
    const link_names = (link_name instanceof Array ? link_name : [link_name]).filter(e => e);
    const link_urls = (link_url instanceof Array ? link_url : [link_url]).filter(e => e);
    if (link_names.length !== link_urls.length) return res.send("Number of specified link names + urls don't match");

    const project = new Project({ title, artist, year, artwork: artwork_url, all_platforms: !!all_platforms });
    link_names.forEach((name, i) => { project.links.push({ name: link_names[i], url: link_urls[i] }) });

    project.save((err, saved) => {
        if (!artwork_file) return res.send("Done");
        const public_id = ("discography/"+ saved.id +"/"+ saved.title.replace(/ /g, "-")).replace(/[ ?&#\\%<>]/g, "_");
        cloud.v2.uploader.upload(artwork_file, { public_id }, (err, result) => {
            if (err) return res.status(500).send(err.message);
            saved.artwork = result.secure_url;
            saved.save(() => res.send("Done - artwork saved"));
        });
    });
});

router.post('/project/delete', isAuthed, (req, res) => {
    const ids = Object.values(req.body);
    if (!ids.length) return res.send("Nothing selected");
    Project.deleteMany({_id : { $in: ids }}, (err, result) => {
        if (err || !result.deletedCount) return res.status(err ? 500 : 404).send(err ? err.message || "Error occurred" : "Project(s) not found");
        ids.forEach(id => {
            cloud.v2.api.delete_resources_by_prefix("discography/" + id, (err, result) => { console.log(err || result) });
        })
        res.send("Project"+ (ids.length > 1 ? "s" : "") +" removed successfully")
    })
});

router.post('/project/edit', isAuthed, (req, res) => {
    const { link_name, link_url, project_id, title, artist, year, artwork_url, all_platforms, artwork_file } = req.body;
    const link_names = (link_name instanceof Array ? link_name : [link_name]).filter(e => e);
    const link_urls = (link_url instanceof Array ? link_url : [link_url]).filter(e => e);
    if (link_names.length !== link_urls.length) return res.send("Number of specified link names + urls don't match");

    Project.findById(project_id, (err, project) => {
        if (title) project.title = project.title;
        if (artist) project.artist = project.artist;
        if (year) project.year = project.year;
        if (artwork_url) project.artwork = project.artwork;
        if (link_names.length && link_urls.length) {
            project.links = [];
            link_names.forEach((name, i) => { project.links.push({ name: link_names[i], url: link_urls[i] }) });
        }
        project.all_platforms = !!all_platforms;

        project.save((err, saved) => {
            if (!artwork_file) return res.send("Done");
            cloud.v2.api.delete_resources_by_prefix("discography/" + saved.id, err => {
                if (err) return res.status(500).send(err.message || "Error occurred whilst updating artwork");
                const public_id = ("discography/"+ saved.id +"/"+ saved.title.replace(/ /g, "-")).replace(/[ ?&#\\%<>]/g, "_");
                cloud.v2.uploader.upload(artwork_file, { public_id }, (err, result) => {
                    if (err) return res.status(500).send(err.message || "Error occurred whilst updating artwork");
                    saved.artwork = result.secure_url;
                    saved.save(() => res.send("Done - artwork saved"));
                });
            });
        });
    })
});

module.exports = router;
