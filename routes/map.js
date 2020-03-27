var express = require('express');
var router = express.Router();
var nodeGeocoder = require('node-geocoder');
var { Location } = require('../models/models');
var geocoder = nodeGeocoder({
    provider: 'google',
    httpAdapter: 'https',
    apiKey: 'AIzaSyCRIzIyhXXI1JxBGUqmUsX5N4MnxYHHGCo'
});

router.get('/', (req, res) => {
    res.render('map', { title: "Map", pagename: "map" });
});

router.post('/location/new', (req, res) => {
    var { name, street_address, city, country, postcode } = req.body;
    var newLocation = new Location({ name, street_address, city, country, postcode });
    newLocation.save((err, saved) => {
        if (err) return res.send(err);
        var address = `${street_address}, ${city}, ${country}, ${postcode || ""}`;
        geocoder.geocode(address, (err, result) => {
            if (err) return res.send(err);
            saved.latitude = result[0].latitude;
            saved.longitude = result[0].longitude;
            saved.save(err => res.send(err || "Location saved"));
        })
    })
});

router.post('/location/edit', (req, res) => {
    Location.findById(req.body.id, (err, doc) => {
        if (err || !doc) return res.send(err || "Location not found");
        var { name, street_address, city, country, postcode } = req.body;
        var address = `${street_address}, ${city}, ${country}` + (postcode ? ", "+postcode : "");
        doc.name = name || doc.name;
        doc.street_address = street_address || doc.street_address;
        doc.city = city || doc.city;
        doc.country = country || doc.country;
        doc.postcode = postcode || doc.postcode;
        doc.save((err, saved) => {
            if (err) return res.send(err);
            geocoder.geocode(address, (err, result) => {
                if (err) return res.send(err);
                saved.latitude = result[0].latitude;
                saved.longitude = result[0].longitude;
                saved.save(err => res.send(err || "Location updated"));
            })
        })
    })
});

router.post('/location/delete', (req, res) => {
	var ids = Object.values(req.body);
	if (ids.length) {
		Location.deleteMany({_id : { $in: ids }}, (err, result) => {
			if (err || !result.deletedCount) return res.send(err || "Location(s) not found");
			res.send("LOCATION"+ (ids.length > 1 ? "S" : "") + " REMOVED SUCCESSFULLY")
		})
	} else { res.send("NOTHING SELECTED") }
});

module.exports = router;
