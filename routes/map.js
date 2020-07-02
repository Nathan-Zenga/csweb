const express = require('express');
const router = express.Router();
const nodeGeocoder = require('node-geocoder');
const { Location } = require('../models/models');
const geocoder = nodeGeocoder({
    provider: 'google',
    httpAdapter: 'https',
    apiKey: 'AIzaSyCRIzIyhXXI1JxBGUqmUsX5N4MnxYHHGCo'
});

router.get('/', (req, res) => {
    res.render('map', { title: "Map", pagename: "map" });
});

router.post('/init', (req, res) => {
    Location.find((err, locations) => {
        if (locations.length) {
            var lat = locations.map(x => x.latitude).reduce((sum, n) => sum + n) / locations.length;
            var lng = locations.map(x => x.longitude).reduce((sum, n) => sum + n) / locations.length;
            var mid_point = { lat, lng };
            res.send({ locations, mid_point });
        } else {
            var defaultPts = { lat: 51.5073219, lng: -0.1276474 };
            res.send({ locations: [defaultPts], mid_point: defaultPts});
        }
    });
});

router.post('/location/new', (req, res) => {
    var { name, street_address, city, country, postcode } = req.body;
    var newLocation = new Location({ name, street_address, city, country, postcode });
    newLocation.save((err, saved) => {
        if (err) return res.send(err);
        var address = `${street_address}, ${city}, ${country}` + (postcode ? ", "+postcode : "");
        geocoder.geocode(address, (err, result) => {
            if (err) return res.send(err);
            saved.latitude = result[0].latitude;
            saved.longitude = result[0].longitude;
            saved.save(err => res.send(err || "Location saved"));
        })
    })
});

router.post('/location/edit', (req, res) => {
    Location.findById(req.body.location_id, (err, doc) => {
        if (err || !doc) return res.send(err || "Location not found");
        var { name_edit, street_address_edit, city_edit, country_edit, postcode_edit } = req.body;
        var address = `${street_address_edit}, ${city_edit}, ${country_edit}` + (postcode_edit ? ", "+postcode_edit : "");
        doc.name = name_edit || doc.name;
        doc.street_address = street_address_edit || doc.street_address;
        doc.city = city_edit || doc.city;
        doc.country = country_edit || doc.country;
        doc.postcode = postcode_edit || doc.postcode;
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
            res.send("Location"+ (ids.length > 1 ? "s" : "") + " removed successfully")
        })
    } else { res.send("Nothing selected") }
});

module.exports = router;
