const router = require('express').Router();
const { Location } = require('../models/models');
const { isAuthed } = require('../config/config');
const apiKey = process.env.GEOCODER_API_KEY;
const geocoder = require('node-geocoder')({ provider: 'google', httpAdapter: 'https', apiKey });

router.get('/', (req, res) => res.render('map'));

router.post('/init', async (req, res) => {
    const locations = await Location.find();
    const defaultPts = { lat: 51.5073219, lng: -0.1276474 };
    if (!locations.length) return res.send({ locations: [defaultPts], mid_point: defaultPts});
    const lat = locations.reduce((sum, x) => sum + x.latitude, 0) / locations.length;
    const lng = locations.reduce((sum, x) => sum + x.longitude, 0) / locations.length;
    res.send({ locations, mid_point: { lat, lng } });
});

router.post('/location/new', isAuthed, async (req, res) => {
    const { name, street_address, city, country, postcode } = req.body;
    const newLocation = new Location({ name, street_address, city, country, postcode });
    const address = `${street_address}, ${city}, ${country}` + (postcode ? ", "+postcode : "");
    try {
        const result = await geocoder.geocode(address);
        newLocation.latitude = result[0].latitude;
        newLocation.longitude = result[0].longitude;
        await newLocation.save(); res.send("Location saved");
    } catch (err) { res.status(500).send(err.message) }
});

router.post('/location/edit', isAuthed, async (req, res) => {
    const { location_id, name_edit, street_address_edit, city_edit, country_edit, postcode_edit } = req.body;
    const address = `${street_address_edit}, ${city_edit}, ${country_edit}` + (postcode_edit ? ", "+postcode_edit : "");
    try {
        const doc = await Location.findById(location_id);
        if (!doc) return res.status(404).send("Location not found");
        if (name_edit)           doc.name = name_edit;
        if (street_address_edit) doc.street_address = street_address_edit;
        if (city_edit)           doc.city = city_edit;
        if (country_edit)        doc.country = country_edit;
        if (postcode_edit)       doc.postcode = postcode_edit;
        const saved = await doc.save();
        const result = await geocoder.geocode(address);
        saved.latitude = result[0].latitude;
        saved.longitude = result[0].longitude;
        await saved.save(); res.send("Location updated");
    } catch (err) { res.status(500).send(err.message) }
});

router.post('/location/delete', isAuthed, async (req, res) => {
    const ids = Object.values(req.body);
    if (!ids.length) return res.status(400).send("Nothing selected");
    try {
        const result = await Location.deleteMany({_id : { $in: ids }});
        if (!result.deletedCount) return res.status(404).send("Location(s) not found");
        res.send(`Location${ids.length > 1 ? "s" : ""} removed successfully`)
    } catch (err) { res.status(500).send(err.message) }
});

module.exports = router;
