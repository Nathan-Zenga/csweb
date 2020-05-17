const mongoose = require('mongoose');
const Schema = mongoose.Schema;

module.exports.Article = mongoose.model('Article', Schema({
    headline: String,
    headline_images: [String],
    headline_image_thumb: String,
    textbody: String,
    textbody_media: [String],
    index: Number
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }));

module.exports.Project = mongoose.model('Project', Schema({
    title: String,
    artist: String,
    year: Number,
    artwork: String,
    links: [String],
    all_platforms: { type: Boolean, default: false }
}));

module.exports.Artist = mongoose.model('Artist', Schema({
    name: String,
    bio: String,
    socials: Schema.Types.Mixed,
    profile_image: String
}));

module.exports.MailingList = mongoose.model('MailingList', Schema({
    firstname: String,
    lastname: String,
    email: String,
    size_top: String,
    size_bottom: String,
    extra_info: String
}));

module.exports.Location = mongoose.model('Location', Schema({
    name: String,
    street_address: String,
    city: String,
    country: String,
    postcode: String,
    latitude: Number,
    longitude: Number
}));

module.exports.Homepage_content = mongoose.model('Homepage_content', Schema({
    banner_text: String,
    banner_media: [String],
    footnote_text: String,
    socials: Array
}));

module.exports.Homepage_image = mongoose.model('Homepage_image', Schema({
    p_id: String,
    url: String,
    index: Number
}));
