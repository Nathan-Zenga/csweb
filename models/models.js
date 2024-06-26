const { model, Schema } = require('mongoose');
const { platforms, sizes, delivery_est_units, product_categories } = require('../config/constants');
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
        return `/news/article/${ doc.headline.replace(/\W/g, m => m != "$" ? "-" : m).replace(/\-+/g, "-").replace(/^\W+|\W+$/, '') }`.toLowerCase();
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
    links: [{ name: { type: String, enum: platforms }, url: String }],
    all_platforms: { type: Boolean, default: false }
}));

module.exports.Artist = model('Artist', new Schema({
    name: String,
    bio: String,
    socials: [{ name: { type: String, enum: platforms }, url: String }],
    profile_image: String
}));

module.exports.MailingList = model('MailingList', (() => {
    const schema = new Schema({
        firstname: { type: String, set: v => v.replace(/^./, m => m.toUpperCase()).trim(), required: true },
        lastname: { type: String, set: v => v.replace(/^./, m => m.toUpperCase()).trim(), required: true },
        email: { type: String, index: true, unique: true, required: true },
        size_top: { type: String, enum: sizes, required: true },
        size_bottom: { type: String, enum: sizes, required: true },
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
    socials: [{ name: { type: String, enum: platforms }, url: String }]
}));

module.exports.Homepage_image = model('Homepage_image', new Schema({
    p_id: String,
    url: String,
    index: Number
}));

module.exports.Product = model('Product', (() => {
    const schema = new Schema({
        name: { type: String, unique: true, required: true },
        price: { type: Number, set: n => parseFloat(n) * 100 },
        image: String,
        info: String,
        stock_qty: { type: Number, min: [0, "No negative values allowed for stock quantity"] },
        category: { type: String, enum: product_categories }
    });

    schema.virtual("size_required").get((val, vt, doc) => doc.category === "clothing");
    return schema;
})());

module.exports.Admin = model('Admin', (() => {
    const schema = new Schema({
        email: { type: String, index: true },
        password: String,
        tokenExpiryDate: Date
    });

    schema.virtual("username").get((val, vt, doc) => doc.email);
    return schema;
})());

module.exports.Shipping_method = model('Shipping_method', (() => {
    const schema = new Schema({
        name: { type: String, required: true },
        delivery_estimate: {
            minimum: { value: { type: Number, min: 1 }, unit: { type: String, enum: delivery_est_units } },
            maximum: { value: { type: Number, min: 1 }, unit: { type: String, enum: delivery_est_units } }
        },
        fee: { type: Number, set: n => parseFloat(n) * 100, required: true }
    });

    schema.pre("save", function() {
        const min_unit = delivery_est_units.indexOf(this.delivery_estimate.minimum.unit);
        const max_unit = delivery_est_units.indexOf(this.delivery_estimate.maximum.unit);
        if (min_unit > max_unit) throw Error("Minimum delivery estimate cannot be higher than the maximum");
        const min_val = this.delivery_estimate.minimum.value;
        const max_val = this.delivery_estimate.maximum.value;
        this.delivery_estimate.minimum.value = Math.min(min_val, max_val);
        this.delivery_estimate.maximum.value = Math.max(min_val, max_val);
    });

    return schema;
})());
