const router = require('express').Router();
const { Location } = require('../models/models');
const { isAuthed } = require('../config/config');
const geocoder = require('node-geocoder')({
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
            const lat = locations.map(x => x.latitude).reduce((sum, n) => sum + n) / locations.length;
            const lng = locations.map(x => x.longitude).reduce((sum, n) => sum + n) / locations.length;
            const mid_point = { lat, lng };
            res.send({ locations, mid_point });
        } else {
            const defaultPts = { lat: 51.5073219, lng: -0.1276474 };
            res.send({ locations: [defaultPts], mid_point: defaultPts});
        }
    });
});

router.post('/location/new', isAuthed, (req, res) => {
    const { name, street_address, city, country, postcode } = req.body;
    const newLocation = new Location({ name, street_address, city, country, postcode });
    const address = `${street_address}, ${city}, ${country}` + (postcode ? ", "+postcode : "");
    newLocation.save((err, saved) => {
        if (err) return res.status(500).send(err.message);
        geocoder.geocode(address, (err, result) => {
            if (err) return res.status(500).send(err.message);
            saved.latitude = result[0].latitude;
            saved.longitude = result[0].longitude;
            saved.save(() => res.send("Location saved"));
        })
    })
});

router.post('/location/edit', isAuthed, (req, res) => {
    const { location_id, name_edit, street_address_edit, city_edit, country_edit, postcode_edit } = req.body;
    const address = `${street_address_edit}, ${city_edit}, ${country_edit}` + (postcode_edit ? ", "+postcode_edit : "");
    Location.findById(location_id, (err, doc) => {
        if (err || !doc) return res.status(err ? 500 : 404).send(err ? err.message || "Error occurred" : "Location not found");
        if (name_edit)           doc.name = name_edit;
        if (street_address_edit) doc.street_address = street_address_edit;
        if (city_edit)           doc.city = city_edit;
        if (country_edit)        doc.country = country_edit;
        if (postcode_edit)       doc.postcode = postcode_edit;
        doc.save((err, saved) => {
            if (err) return res.status(500).send(err.message);
            geocoder.geocode(address, (err, result) => {
                if (err) return res.status(500).send(err.message);
                saved.latitude = result[0].latitude;
                saved.longitude = result[0].longitude;
                saved.save(() => res.send("Location updated"));
            })
        })
    })
});

router.post('/location/delete', isAuthed, (req, res) => {
    const ids = Object.values(req.body);
    if (!ids.length) return res.send("Nothing selected");
    Location.deleteMany({_id : { $in: ids }}, (err, result) => {
        if (err || !result.deletedCount) return res.status(err ? 500 : 404).send(err ? err.message || "Error occurred" : "Location(s) not found");
        res.send("Location"+ (ids.length > 1 ? "s" : "") + " removed successfully")
    })
});

module.exports = router;
