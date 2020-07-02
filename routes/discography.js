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
    var { title, artist, year, artwork_file, artwork_url, links, all_platforms } = req.body;
    links = links instanceof Array ? links : [links].filter(e => e);
    var project = new Project({ title, artist, year, artwork: artwork_url, links, all_platforms: !!all_platforms });

    project.save((err, saved) => {
        var message_update = "Done";
        if (artwork_file) {
            var public_id = "discography/"+ saved.id +"/"+ saved.title.replace(/ /g, "-");
            cloud.v2.uploader.upload(artwork_file, { public_id }, (err, result) => {
                if (err) return res.send(err);
                message_update += ": artwork saved";
                saved.artwork = result.secure_url;
                saved.save();
            });
        }
        res.send(message_update);
    });
});

router.post('/project/delete', (req, res) => {
    var ids = Object.values(req.body);
    if (ids.length) {
        Project.deleteMany({_id : { $in: ids }}, (err, result) => {
            if (err || !result.deletedCount) return res.send(err || "Project(s) not found");
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
        project.title = req.body.title_edit || project.title;
        project.artist = req.body.artist_edit || project.artist;
        project.year = req.body.year_edit || project.year;
        project.artwork = req.body.artwork_url_edit || project.artwork;
        project.links = links && links.length ? links : project.links;
        project.all_platforms = !!req.body.all_platforms_change;

        project.save((err, saved) => {
            var message_update = "Done";
            if (req.body.artwork_file_change) {
                cloud.v2.api.delete_resources_by_prefix("discography/" + saved.id, (err, result) => {
                    console.log(err || result);
                    message_update += err ? ": error occurred, could not save artwork" : ": artwork saved";
                    var public_id = "discography/"+ saved.id +"/"+ saved.title.replace(/ /g, "-");
                    cloud.v2.uploader.upload(req.body.artwork_file_change, { public_id }, (err, result) => {
                        if (err) return res.send(err);
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
