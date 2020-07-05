const { model, Schema } = require('mongoose');

module.exports.Article = model('Article', Schema({
    headline: String,
    headline_images: [String],
    headline_image_thumb: String,
    textbody: String,
    textbody_media: [String],
    index: Number
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }));

module.exports.Project = model('Project', Schema({
    title: String,
    artist: String,
    year: Number,
    artwork: String,
    links: [{ name: String, url: String }],
    all_platforms: { type: Boolean, default: false }
}));

module.exports.Artist = model('Artist', Schema({
    name: String,
    bio: String,
    socials: [{ name: String, url: String }],
    profile_image: String
}));

module.exports.MailingList = model('MailingList', Schema({
    firstname: { type: String, set: v => v.charAt(0).toUpperCase() + v.slice(1) },
    lastname: { type: String, set: v => v.charAt(0).toUpperCase() + v.slice(1) },
    email: String,
    size_top: String,
    size_bottom: String,
    extra_info: String
}));

module.exports.Location = model('Location', Schema({
    name: String,
    street_address: String,
    city: String,
    country: String,
    postcode: String,
    latitude: Number,
    longitude: Number
}));

module.exports.Homepage_content = model('Homepage_content', Schema({
    banner_text: String,
    banner_media: [String],
    footnote_text: String,
    socials: [{ name: String, url: String }]
}));

module.exports.Homepage_image = model('Homepage_image', Schema({
    p_id: String,
    url: String,
    index: Number
}));
