var { Article, Project, Artist, Location, MailingList, Homepage_content, Homepage_image } = require('../models/models');

module.exports.Collections = cb => {
    Article.find().sort({ created_at: -1 }).exec((err, articles) => {
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

module.exports.indexReorder = (collection, id, newIndex, cb) => {
	collection.find().sort({index: 1}).exec((err, docs) => {
		if (err) return err;
		var selected_doc = docs.filter(e => e._id == id)[0];
		docs.splice(selected_doc.index-1, 1);
		docs.splice(parseInt(newIndex-1), 0, selected_doc);
		docs.forEach((doc, i) => {
			if (doc.index != i+1) doc.index = i+1;
			doc.save();
		});
		if (cb) cb();
	})
};
