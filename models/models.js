const { model, Schema } = require('mongoose');
Schema.Types.String.set('trim', true);

module.exports.Article = model('Article', new Schema({
    headline: { type: String, unique: true, required: true },
    headline_images: [String],
    headline_image_thumb: String,
    textbody: String,
    textbody_media: [String],
    index: Number
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }));

module.exports.Project = model('Project', new Schema({
    title: String,
    artist: String,
    year: Number,
    artwork: String,
    links: [{ name: String, url: String }],
    all_platforms: { type: Boolean, default: false }
}));

module.exports.Artist = model('Artist', new Schema({
    name: String,
    bio: String,
    socials: [{ name: String, url: String }],
    profile_image: String
}));

module.exports.MailingList = model('MailingList', new Schema({
    firstname: { type: String, set: v => v.charAt(0).toUpperCase() + v.slice(1) },
    lastname: { type: String, set: v => v.charAt(0).toUpperCase() + v.slice(1) },
    email: { type: String, index: true, unique: true },
    size_top: String,
    size_bottom: String,
    extra_info: String
}));

module.exports.Location = model('Location', new Schema({
    name: String,
    street_address: String,
    city: String,
    country: String,
    postcode: String,
    latitude: Number,
    longitude: Number
}));

module.exports.Homepage_content = model('Homepage_content', new Schema({
    banner_text: String,
    banner_media: [String],
    footnote_text: String,
    socials: [{ name: String, url: String }]
}));

module.exports.Homepage_image = model('Homepage_image', new Schema({
    p_id: String,
    url: String,
    index: Number
}));

module.exports.Product = model('Product', new Schema({
    name: { type: String, unique: true, required: true },
    price: { type: Number, set: n => parseFloat(n) * 100 },
    image: String,
    info: String,
    stock_qty: { type: Number, min: [0, "No negative values allowed for stock quantity"] }
}));

module.exports.Admin = model('Admin', (() => {
    const schema = new Schema({ email: { type: String, index: true }, password: String, tokenExpiryDate: Date });
    schema.virtual("username").get(() => this.email);
    return schema;
})());
