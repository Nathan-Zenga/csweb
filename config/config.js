const { Article, Project, Artist, Location, MailingList, Homepage_content, Homepage_image } = require('../models/models');
const cloud = require('cloudinary');
const mongoose = require('mongoose');
const { each, forEachOf } = require('async');

/**
 * Getting all documents from all collections
 * @param {function} cb callback with passed document collections as arguments
 * @callback cb
 */
module.exports.Collections = cb => {
    Article.find().sort({ index: 1 }).exec((err, articles) => {
        Artist.find((err, artists) => {
            Project.find().sort({ year: -1 }).exec((err, projects) => {
                Location.find((err, locations) => {
                    MailingList.find().sort({ lastname: 1 }).exec((err, members) => {
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
 * @param {mongoose.Model.<Document, {}>} collection a database collection model
 * @param {Object} args
 * @param {string} args.id identifier to specify document to re-order
 * @param {number} args.newIndex the new order number (position) to which the selected document is assigned (by index field)
 * @param {{}} [args.sort] sort query
 * @param {function} [cb] callback
 * @callback cb
 */
module.exports.indexReorder = (collection, args, cb) => {
    var { id, newIndex, sort } = args;
    if (sort) sort = Object.assign({index: 1}, sort);
    collection.find().sort(sort || {index: 1}).exec((err, docs) => {
        if (err) return cb ? cb(err.message) : err;
        var index = docs.findIndex(e => e._id == id);
        var beforeSelectedDoc = docs.slice(0, index);
        var afterSelectedDoc = docs.slice(index+1, docs.length);
        var docs_mutable = [...beforeSelectedDoc, ...afterSelectedDoc];
        docs_mutable.splice(parseInt(newIndex)-1, 0, docs[index]);
        docs_mutable.forEach((doc, i) => { doc.index = i+1; doc.save() });
        if (cb) cb();
    })
};

/**
 * Saving images / videos for news articles
 * @param {object} body response body object
 * @param {mongoose.Document} doc the new / existing document to contain references (URLs) to the media being uploaded / saved
 * @param {function} [cb] optional callback
 */
module.exports.saveMedia = (body, doc, cb) => {
    var msg = "";
    var fields = ["headline_images", "textbody_media"].filter(f => body[f]);
    if (!fields.length) return cb ? cb(null, "Skipping media saving...") : false;
    each(fields, (field, callback1) => {
        body[field] = !Array.isArray(body[field]) ? [body[field]] : body[field];
        doc[field] = Object.assign([], body[field]);
        forEachOf(body[field], (mediaStr, i, callback2) => {
            var isIframe = /<iframe(.*?)><\/iframe>/i.test(mediaStr);
            var ytUrl = /youtu.?be/.test(mediaStr) && !isIframe;
            if (isIframe) {
                doc[field].splice(i, 1, mediaStr.match(/<iframe(.*?)><\/iframe>/gi)[0].replace(/(width|height|style)\=\"?\'?(.*?)\"?\'? /gi, "") );
                console.log("Stored iframe...");
                callback2();
            } else if (ytUrl) {
                var toReplace = /^.*(youtu.?be\/|v\/|u\/\w\/|watch\?v=|\&v=|\?v=)/i;
                var iframe = '<iframe src="' + mediaStr.replace(toReplace, "https://youtube.com/embed/") + '" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>';
                doc[field].splice(i, 1, iframe );
                console.log("Youtube link stored as iframe...");
                callback2();
            } else {
                var public_id = ("article/"+ doc.id +"/"+ field + ( parseInt(i)+1 )).replace(/[ ?&#\\%<>]/g, "_");
                cloud.v2.uploader.upload(mediaStr, { public_id, resource_type: "auto" }, (err, result) => {
                    if (err) return callback2(err.message || "Error occurred whilst uploading image");
                    if (body.headline_image_thumb === mediaStr) doc.headline_image_thumb = result.secure_url;
                    doc[field].splice(i, 1, result.secure_url);
                    console.log("Uploaded image / video to cloud...");
                    callback2();
                });
            }
        }, err => {
            if (err) return callback1(err.message);
            console.log(`All media from ${field} field saved...`);
            callback1();
        });
    }, err => {
        msg = "Images / videos saved";
        console.log(`Media saving process done.${!cb ? "" : " Calling callback now..."}`);
        doc.save();
        cb ? cb(err, msg) : console.log(err || msg)
    });
};
