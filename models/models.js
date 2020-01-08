var mongoose = require('mongoose');
var Schema = mongoose.Schema;

module.exports.Article = mongoose.model('Article', Schema({
	headline: String,
	headline_images: [String],
	textbody: String,
	textbody_media: [String]
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
