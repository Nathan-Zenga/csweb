const { Article, Project, Artist, Location, MailingList, Homepage_content, Homepage_image, Product } = require('../models/models');
const { v2: cloud } = require('cloudinary');
const { Model, Document: MongooseDocument } = require('mongoose');
const { default: axios } = require('axios');
const { each, forEachOf } = require('async');

/**
 * Getting all documents from all collections
 * @param {function} cb callback with passed document collections as arguments
 */
module.exports.Collections = async cb => {
    const docs = {};
    docs.articles = await Article.find().sort({ index: 1 }).exec();
    docs.artists = await Artist.find();
    docs.projects = await Project.find().sort({ year: -1 }).exec();
    docs.locations = await Location.find();
    docs.members = await MailingList.find().sort({ lastname: 1 }).exec();
    docs.homepage_contents = await Homepage_content.find();
    docs.homepage_images = await Homepage_image.find().sort({index: 1}).exec();
    docs.products = await Product.find();
    cb(docs);
};

/**
 * Executing process of re-ordering document items
 * @param {Model.<MongooseDocument, {}>} collection a database collection model
 * @param {object} args
 * @param {string} args.id identifier to specify document to re-order
 * @param {number} args.newIndex the new order number (position) to which the selected document is assigned (by index field)
 * @param {object} [args.sort] sort query
 * @param {function} [cb] callback
 */
module.exports.indexReorder = async (collection, args, cb) => {
    try {
        const { id, newIndex, sort } = args;
        if (sort) sort = Object.assign({index: 1}, sort);
        const docs = await collection.find().sort(sort || {index: 1}).exec();
        const index = docs.findIndex(e => e._id == id);
        const beforeSelectedDoc = docs.slice(0, index);
        const afterSelectedDoc = docs.slice(index+1, docs.length);
        const docs_mutable = [...beforeSelectedDoc, ...afterSelectedDoc];
        docs_mutable.splice(parseInt(newIndex)-1, 0, docs[index]);
        await Promise.all(docs_mutable.map((doc, i) => { doc.index = i+1; return doc.save() }));
        if (cb) cb();
    } catch(err) { if (cb) return cb(err); throw err }
};

/**
 * Saving images / videos for news articles
 * @param {object} body response body object
 * @param {MongooseDocument} doc the new / existing document to contain references (URLs) to the media being uploaded / saved
 * @param {function} [cb] optional callback
 */
module.exports.saveMedia = (body, doc, cb) => {
    const fields = ["headline_images", "textbody_media"].filter(f => body[f]);
    const saved_p_ids = [];
    if (!fields.length) return cb ? cb(null, "Skipping media saving...") : false;
    each(fields, (field, callback1) => {
        body[field] = !Array.isArray(body[field]) ? [body[field]] : body[field];
        doc[field] = Object.assign([], body[field]);
        forEachOf(body[field], (mediaStr, i, callback2) => {
            const isIframe = /<iframe(.*?)><\/iframe>/i.test(mediaStr);
            const ytUrl = /youtu.?be/.test(mediaStr) && !isIframe;
            if (isIframe) {
                doc[field].splice(i, 1, mediaStr.match(/<iframe(.*?)><\/iframe>/gi)[0].replace(/(width|height|style)\=\"?\'?(.*?)\"?\'? /gi, "") );
                console.log("Stored iframe...");
                callback2();
            } else if (ytUrl) {
                const toReplace = /^.*(youtu.?be\/|v\/|u\/\w\/|watch\?v=|\&v=|\?v=)/i;
                const iframe = '<iframe src="' + mediaStr.replace(toReplace, "https://youtube.com/embed/") + '" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>';
                doc[field].splice(i, 1, iframe);
                console.log("Youtube link stored as iframe...");
                callback2();
            } else {
                axios.get(mediaStr).catch(err => callback2(err)).then(response => {
                    if (/^(\w+)\/html/.test(response.headers["content-type"] || "")) {
                        doc[field].splice(i, 1, '<iframe src="' + mediaStr + '" frameborder="0" allowfullscreen></iframe>');
                        console.log("Web link stored as iframe...");
                        callback2();
                    } else {
                        const public_id = ("article/"+ doc.id +"/"+ field + ( parseInt(i)+1 )).replace(/[ ?&#\\%<>]/g, "_");
                        cloud.uploader.upload(mediaStr, { public_id, resource_type: "auto" }, (err, result) => {
                            if (err) return callback2(err);
                            if (body.headline_image_thumb === mediaStr) doc.headline_image_thumb = result.secure_url;
                            saved_p_ids.push(result.public_id);
                            doc[field].splice(i, 1, result.secure_url);
                            console.log(`Uploaded ${result.resource_type} to cloud...`);
                            callback2();
                        });
                    }
                });
            }
        }, async err => {
            if (err) { await cloud.api.delete_resources(saved_p_ids).catch(e => e); return callback1(err) }
            console.log(`All media from ${field} field saved...`);
            callback1();
        });
    }, async err => {
        const msg = "Images / videos saved";
        const error = doc.validateSync() || err;
        if (error) return cb ? cb(error) : console.error(error.message);
        await doc.save();
        console.log("Media saving process done." + (cb ? " Running callback..." : ""));
        cb ? cb(null, msg) : console.log(msg)
    });
};

module.exports.isAuthed = (req, res, next) => {
    if (process.env.NODE_ENV !== "production") return next();
    if (req.isAuthenticated()) return next();
    if (req.method === "GET") return res.status(401).redirect("/admin/login");
    return res.sendStatus(401);
}
