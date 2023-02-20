const router = require('express').Router();
const { isAuthed } = require('../modules/config');
const { Shipping_method } = require('../models/models');

router.post("/add", async (req, res) => {
    const { name, fee, min_value, min_unit, max_value, max_unit } = req.body;
    const shipping = new Shipping_method({ name, fee });

    try {
        shipping.delivery_estimate.minimum.value = min_value;
        shipping.delivery_estimate.maximum.value = max_value;
        shipping.delivery_estimate.minimum.unit = min_unit;
        shipping.delivery_estimate.maximum.unit = max_unit;
        await shipping.save(); res.send("Shipping method saved");
    } catch (err) { res.status(400).send(err.message) }
});

router.post('/edit', isAuthed, async (req, res) => {
    const { shipping_method_id, name, fee, min_value, min_unit, max_value, max_unit } = req.body;
    try {
        const shipping = await Shipping_method.findById(shipping_method_id);
        if (!shipping) return res.status(404).send("Shipping method not found");

        if (name) shipping.name = name;
        if (fee) shipping.fee = fee;
        if (min_value) shipping.delivery_estimate.minimum.value = min_value;
        if (max_value) shipping.delivery_estimate.maximum.value = max_value;
        if (min_unit) shipping.delivery_estimate.minimum.unit = min_unit;
        if (max_unit) shipping.delivery_estimate.maximum.unit = max_unit;

        await shipping.save();
        res.send("Shipping method details updated successfully");
    } catch (err) { res.status(400).send(err.message) }
});

router.post("/remove", isAuthed, async (req, res) => {
    const ids = Object.values(req.body);
    if (!ids.length) return res.status(400).send("Nothing selected");
    try {
        await Shipping_method.deleteMany({_id : { $in: ids }});
        res.send(`Shipping method${ids.length > 1 ? "s" : ""} removed successfully`);
    } catch (err) {
        res.status(400).send(err.message);
    }
});

module.exports = router;
