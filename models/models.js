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
	release_date: Date,
	artwork: String,
	links: [String],
	all_platforms: { type: Boolean, default: false }
}));
