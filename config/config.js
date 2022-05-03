const { Article, Project, Artist, Location, MailingList, Homepage_content, Homepage_image, Product } = require('../models/models');
const { v2: cloud } = require('cloudinary');
const { Model, Document: Doc } = require('mongoose');
const { default: axios } = require('axios');
const { each, forEachOf } = require('async');

/**
 * Getting all documents from all collections
 * @param {(docs: {[collection: string]: Doc[]})} [cb] callback with passed document collections as arguments
 */
module.exports.Collections = async cb => {
    const docs = {};
    docs.articles = await Article.find().sort({ index: 1 }).exec();
    docs.artists = await Artist.find().sort({ name: 1 });
    docs.projects = await Project.find().sort({ year: -1 }).exec();
    docs.locations = await Location.find().sort({ country: 1, city: 1, name: 1 });
    docs.members = await MailingList.find().sort({ lastname: 1 }).exec();
    docs.homepage_contents = await Homepage_content.find();
    docs.homepage_images = await Homepage_image.find().sort({ index: 1 }).exec();
    docs.products = await Product.find().sort({ name: 1 });
    if (!cb) return docs; cb(docs);
};

/**
 * Executing process of re-ordering document items
 * @param {Model} collection a database collection model
 * @param {object} args
 * @param {string} args.id identifier to specify document to re-order
 * @param {number} args.newIndex the new order number (position) to which the selected document is assigned (by index field)
 * @param {object} [args.sort] sort query
 * @param {function} [cb] callback
 */
module.exports.indexReorder = async (collection, args, cb) => {
    try {
        const { id, newIndex, sort } = args;
        if (sort) sort = Object.assign({ index: 1 }, sort);
        const docs = await collection.find().sort(sort || { index: 1 }).exec();
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
 * @param {Doc} doc the new / existing document to contain references (URLs) to the media being uploaded / saved
 * @param {(err: Error, mediaResults: {headline_images: string[], textbody_media: string[]}) => void} [cb] optional callback
 */
module.exports.saveMedia = async (body, doc, cb) => {
    const fields = ["headline_images", "textbody_media"].filter(f => body[f]);
    const savedMedia = { headline_images: [], textbody_media: [] };
    const saved_p_ids = [];
    try {
        if (!(doc instanceof Doc)) throw TypeError("Article document not valid");
        if (!fields.length) return cb ? cb() : null;
        await each(fields, (field, callback1) => {
            body[field] = Array.isArray(body[field]) ? body[field] : [body[field]];
            savedMedia[field].push(...body[field]);
            forEachOf(body[field], (mediaStr, i, callback2) => {
                const isIframe = /<iframe(.*?)><\/iframe>/i.test(mediaStr);
                const ytUrl = /youtu.?be/.test(mediaStr) && !isIframe;
                const img = /^data:image\/(.*?);base64|\.(jpe?g|png|gif|bmp)$/i.test(mediaStr);
                const av = /^data:(video|audio)\/(.*?);base64|\.(mp(4|3|2)|mov|avi|wmv|f(l|4)v|webm|mkv|ogg|mpeg?|m(4|k)a|wav)$/i.test(mediaStr);
                const url = /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/.test(mediaStr);
                if (isIframe) {
                    savedMedia[field].splice(i, 1, mediaStr.match(/<iframe(.*?)><\/iframe>/gi)[0].replace(/(width|height|style)\=\"?\'?(.*?)\"?\'? /gi, "") );
                    console.log("Stored iframe...");
                    callback2();
                } else if (ytUrl) {
                    const toReplace = /^.*(youtu.?be\/|v\/|u\/\w\/|watch\?v=|\&v=|\?v=)/i;
                    const iframe = `<iframe src="${mediaStr.replace(toReplace, "https://youtube.com/embed/")}" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
                    savedMedia[field].splice(i, 1, iframe);
                    console.log("Youtube link stored as iframe...");
                    callback2();
                } else if (img || av) {
                    const public_id = `article/${doc.id}/${field}${parseInt(i)+1}`.replace(/[ ?&#\\%<>]/g, "_");
                    cloud.uploader.upload(mediaStr, { public_id, resource_type: img ? "image" : "video" }, (err, result) => {
                        if (err) return callback2(err);
                        if (body.headline_image_thumb === mediaStr) doc.headline_image_thumb = result.secure_url;
                        saved_p_ids.push(result.public_id);
                        savedMedia[field].splice(i, 1, result.secure_url);
                        console.log(`Uploaded ${result.resource_type} to cloud...`);
                        callback2();
                    });
                } else if (url) {
                    axios.get(mediaStr).then(response => {
                        const isHTML = /^(\w+)\/html/.test(response.headers["content-type"] || "");
                        if (!isHTML) return callback2(TypeError("Web link / file format not valid"));
                        savedMedia[field].splice(i, 1, `<iframe src="${mediaStr}" frameborder="0" allowfullscreen></iframe>`);
                        console.log("Web link stored as iframe...");
                        callback2();
                    }).catch(err => callback2(err));
                } else callback2(TypeError("Media file / URL format not valid"));
            }).then(() => {
                console.log(`All media from ${field} field saved...`);
                callback1();
            }).catch(err => callback1(err));
        });
        console.log("Media saving process done");
        return cb ? cb(null, savedMedia) : savedMedia;
    } catch (err) {
        await cloud.api.delete_resources(saved_p_ids).catch(e => e);
        if (!cb) throw err; cb(err)
    }
};

module.exports.isAuthed = (req, res, next) => {
    if (process.env.NODE_ENV !== "production") return next();
    if (req.isAuthenticated()) return next();
    if (req.method === "GET") return res.status(401).redirect("/admin/login");
    return res.sendStatus(401);
}
