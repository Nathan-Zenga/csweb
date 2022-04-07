const { model, Schema } = require('mongoose');
Schema.Types.String.set('trim', true);

module.exports.Article = model('Article', (() => {
    const schema = new Schema({
        headline: { type: String, unique: true, required: true },
        headline_images: [String],
        headline_image_thumb: String,
        textbody: String,
        textbody_media: [String],
        index: Number
    }, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

    schema.virtual("link").get((val, vt, doc) => {
        return `/news/article/${ doc.headline.split("").map(c => /\W/.test(c) && c != "$" ? "-" : c).join("").replace(/\-+/g, "-").replace(/\W+$/, '') }`.toLowerCase();
    });

    schema.virtual("headline_cropped").get((val, vt, doc) => {
        return (num = 25) => doc.headline.length > num ? doc.headline.slice(0, num).trim() + "..." : doc.headline;
    });

    return schema;
})());

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

module.exports.MailingList = model('MailingList', (() => {
    const schema = new Schema({
        firstname: { type: String, set: v => v.charAt(0).toUpperCase() + v.slice(1) },
        lastname: { type: String, set: v => v.charAt(0).toUpperCase() + v.slice(1) },
        email: { type: String, index: true, unique: true },
        size_top: String,
        size_bottom: String,
        extra_info: String
    });

    schema.virtual("fullname").get((val, vt, doc) => `${doc.firstname} ${doc.lastname}`);
    return schema;
})());

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
    schema.virtual("username").get((val, vt, doc) => doc.email);
    return schema;
})());
