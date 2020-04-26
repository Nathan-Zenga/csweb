var { Article, Project, Artist, Location, MailingList, Homepage_content, Homepage_image } = require('../models/models');
var cloud = require('cloudinary');
var { Model } = require('mongoose');

/**
 * Getting all documents from all collections
 * @param {function} cb callback with passed document collections as arguments
 */
module.exports.Collections = cb => {
    Article.find().sort({ index: 1 }).exec((err, articles) => {
        Artist.find((err, artists) => {
            Project.find().sort({ year: -1 }).exec((err, projects) => {
                Location.find((err, locations) => {
                    MailingList.find((err, members) => {
                        Homepage_content.find((err, homepage_contents) => {
                            Homepage_image.find().sort({index: 1}).exec((err, homepage_images) => {
                                cb({ articles, artists, projects, locations, members, homepage_contents, homepage_images });
                            })
                        })
                    })
                })
            })
        })
    })
};

/**
 * Executing process of re-ordering document items
 * @param {Model.<Document, {}>} collection a database collection model
 * @param {Object} args
 * @param {string} args.id identifier to specify document to re-order
 * @param {number} args.newIndex the new order number (position) to which the selected document is assigned (by index field)
 * @param {{}} [args.sort] sort query
 * @param {function} [cb] callback
 */
module.exports.indexReorder = (collection, args, cb) => {
    var { id, newIndex, sort } = args;
    collection.find().sort(sort || {index: 1}).exec((err, docs) => {
        if (err) return err;
        var selected_doc = docs.filter(e => e._id == id)[0];
        docs.splice(selected_doc.index-1, 1); //remove selected
        docs.splice(parseInt(newIndex-1), 0, selected_doc); //insert selected
        docs.forEach((doc, i) => {
            if (doc.index != i+1) { doc.index = i+1; doc.save() }
        });
        if (cb) cb();
    })
};

/**
 * Executing process of saving media
 * @param {{}} body response body object
 * @param {{}} doc the new / existing document to contain references (URLs) to the media being uploaded / saved
 * @param {function} [cb] callback with optional message
 */
module.exports.saveMedia = (body, doc, cb) => {
    var msg = "";
    var fields = ["headline_images", "textbody_media", "headline_images_change", "textbody_media_change"].filter(f => body[f]);
    fields.forEach(field => {
        var f = field.replace("_change", "");
        doc[f] = [];
        body[field] = typeof body[field] === "string" ? [body[field]] : body[field];
        body[field].forEach((mediaStr, i) => {
            var notIframe = !["<iframe", "embed"].filter(x => mediaStr.includes(x)).length;
            if (notIframe) {
                var public_id = "article/"+ doc.id +"/"+ f + (i+1);
                cloud.v2.uploader.upload(mediaStr, { public_id, resource_type: "auto" }, (err, result) => {
                    if (err) console.log(err);
                    if (body.headline_image_thumb === mediaStr) doc.headline_image_thumb = result.secure_url;
                    doc[f].push(result.secure_url);
                    doc.save();
                });
            } else {
                var ytUrl = ["youtu"].filter(x => mediaStr.includes(x)).length && notIframe;
                var toReplace = /^.*(youtu.?be\/|v\/|u\/\w\/|watch\?v=|\&v=|\?v=)/i;
                var ytIframe = '<iframe src="' + mediaStr.replace(toReplace, "https://youtube.com/embed/") + '" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>';
                mediaStr = ytUrl ? ytIframe : mediaStr;
                doc[f].push( mediaStr.replace(/(width|height|style)\=\"?\'?(.*?)\"?\'? /gi, "") );
                doc.save();
            }
        });
        msg = " - saving images / videos";
    });
    if (cb) cb(msg);
};
