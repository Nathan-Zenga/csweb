var mongoose = require('mongoose');
var Schema = mongoose.Schema;

module.exports.article = mongoose.model('Article', Schema({
	headline: String,
	headline_images: [String],
    textbody: String,
    textbody_media: [String]
}, {
	timestamps: {
		createdAt: 'created_at',
		updatedAt: 'updated_at'
    }
}));
