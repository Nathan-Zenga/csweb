const express = require('express');
const router = express.Router();
const cloud = require('cloudinary');
const { Project } = require('../models/models');

router.get('/', (req, res) => {
    Project.find().sort({ year: -1 }).exec((err, projects) => {
        res.render('discography', { title: "Discography", pagename: "discography", projects })
    })
});

router.post('/project/new', (req, res) => {
    const { title, artist, year, artwork_file, artwork_url, link_name, link_url, all_platforms } = req.body;
    const link_names = (link_name instanceof Array ? link_name : [link_name]).filter(e => e);
    const link_urls = (link_url instanceof Array ? link_url : [link_url]).filter(e => e);
    if (link_names.length !== link_urls.length) return res.send("Number of specified link names + urls don't match");

    const project = new Project({ title, artist, year, artwork: artwork_url, all_platforms: !!all_platforms });
    link_names.forEach((name, i) => { project.links.push({ name: link_names[i], url: link_urls[i] }) });

    project.save((err, saved) => {
        if (!artwork_file) return res.send("Done");
        var public_id = "discography/"+ saved.id +"/"+ saved.title.replace(/ /g, "-");
        cloud.v2.uploader.upload(artwork_file, { public_id }, (err, result) => {
            if (err) return res.status(500).send(err.message);
            saved.artwork = result.secure_url;
            saved.save(() => res.send("Done - artwork saved"));
        });
    });
});

router.post('/project/delete', (req, res) => {
    var ids = Object.values(req.body);
    if (ids.length) {
        Project.deleteMany({_id : { $in: ids }}, (err, result) => {
            if (err || !result.deletedCount) return res.status(err ? 500 : 404).send(err ? err.message || "Error occurred" : "Project(s) not found");
            ids.forEach(id => {
                cloud.v2.api.delete_resources_by_prefix("discography/" + id, (err, result) => { console.log(err || result) });
            })
            res.send("Project"+ (ids.length > 1 ? "s" : "") +" removed successfully")
        })
    } else { res.send("Nothing selected") }
});

router.post('/project/edit', (req, res) => {
    var links = req.body.links_edit instanceof Array ? req.body.links_edit : [req.body.links_edit].filter(e => e);

    Project.findById(req.body.project_id, (err, project) => {
        if (req.body.title_edit) project.title = project.title;
        if (req.body.artist_edit) project.artist = project.artist;
        if (req.body.year_edit) project.year = project.year;
        if (req.body.artwork_url_edit) project.artwork = project.artwork;
        if (links && links.length) project.links = links;
        project.all_platforms = !!req.body.all_platforms_change;

        project.save((err, saved) => {
            var message_update = "Done";
            if (req.body.artwork_file_change) {
                cloud.v2.api.delete_resources_by_prefix("discography/" + saved.id, (err1, result) => {
                    message_update += err ? ": error occurred, could not save artwork" : ": artwork saved";
                    var public_id = "discography/"+ saved.id +"/"+ saved.title.replace(/ /g, "-");
                    cloud.v2.uploader.upload(req.body.artwork_file_change, { public_id }, (err2, result) => {
                        if (err1 || err2) return res.status(500).send((err1 || err2).message);
                        saved.artwork = result.secure_url;
                        saved.save();
                    });
                });
            }
            res.send(message_update);
        });
    })
});

module.exports = router;
