const { Article, Project, Artist, Location, MailingList, Homepage_content, Homepage_image } = require('../models/models');
const cloud = require('cloudinary');
const mongoose = require('mongoose');

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
    collection.find().sort({index: 1}).exec((err, docs) => {
        if (err) return err;
        var index = docs.findIndex(e => e._id == id);
        var beforeSelectedDoc = docs.slice(0, index);
        var afterSelectedDoc = docs.slice(index+1, docs.length);
        var docs_mutable = [...beforeSelectedDoc, ...afterSelectedDoc];
        docs_mutable.splice(parseInt(newIndex)-1, 0, docs[index]);
        docs_mutable.forEach((doc, i) => {
            doc.index = i+1;
            doc.save();
        });
        if (cb) cb();
    })
};

/**
 * Executing process of saving media
 * @param {{}} body response body object
 * @param {mongoose.Document} doc the new / existing document to contain references (URLs) to the media being uploaded / saved
 * @param {function} [cb] callback with optional message
 * @callback cb
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
