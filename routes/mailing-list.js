const router = require('express').Router();
const { MailingList } = require('../models/models');
const { isAuthed } = require('../config/config');
const { default: axios } = require('axios');
const { RECAPTCHA_SITE_KEY: recaptcha_site_key, RECAPTCHA_SECRET_KEY } = process.env;

router.get('/sign-up', (req, res) => {
    res.render('mailing-list', { recaptcha_site_key })
});

router.get('/member/delete', async (req, res) => {
    const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
    const src = Array.isArray(req.query.src) ? req.query.src[0] : req.query.src;
    try {
        const doc = await MailingList.findById(id);
        if (!src.match(/^email_unsub_link[A-Za-z0-9]{24}$/g) || !src.endsWith(id) || !doc) return res.status(400).send("Invalid entry");
        const { data: body } = await axios.post(res.locals.location_origin + req.originalUrl, { id });
        if (body === "Nothing selected") return res.status(404).send("You already don't exist on our records.<br><br> - CS");
        res.send(`You are now unsubscribed. Sorry to see you go!<br><br> - CS`);
    } catch (err) { res.status(500).send(err.message || "Error occurred") }
});

router.post('/new', async (req, res) => {
    for (const k in req.body) if (typeof req.body[k] == "string") req.body[k] = req.body[k].replace(/<script(.*?)>((.*?)<\/script>)?/gi, "");
    const { firstname, lastname, email, size_top, size_bottom, extra_info, "g-recaptcha-response": captcha } = req.body;
    if (!captcha) return res.status(400).send("Sorry, we need to verify that you're not a robot.\nPlease tick the box to proceed.");
    const newMember = new MailingList({ firstname, lastname, email, size_top, size_bottom, extra_info });
    const member = await MailingList.findOne({ email });
    if (member) return res.status(400).send("Already registered");

    const params = new URLSearchParams({ secret: RECAPTCHA_SECRET_KEY, response: captcha, remoteip: req.socket.remoteAddress });
    const verifyURL = `https://google.com/recaptcha/api/siteverify?${params.toString()}`;
    const { data: result } = await axios.get(verifyURL).catch(e => e);
    if (!result || !result.success) return res.status(400).send("Failed CAPTCHA verification");

    newMember.save(err => res.status(err ? 500 : 200).send(err ? err.message : "You are now registered"));
});

router.post('/update', isAuthed, async (req, res) => {
    const { member_id, firstname, lastname, email, size_top, size_bottom, extra_info } = req.body;
    try {
        const member = await MailingList.findById(member_id);
        if (!member) return res.status(404).send("Member not found");
        if (firstname)   member.firstname = firstname;
        if (lastname)    member.lastname = lastname;
        if (email)       member.email = email;
        if (size_top)    member.size_top = size_top;
        if (size_bottom) member.size_bottom = size_bottom;
        if (extra_info)  member.extra_info = extra_info;
        await member.save(); res.send("Member updated");
    } catch (err) { res.status(500).send(err.message) }
});

router.post('/member/delete', async (req, res) => {
    const ids = Object.values(req.body);
    if (!ids.length) return res.status(400).send("Nothing selected");
    try {
        const { deletedCount } = await MailingList.deleteMany({ _id : { $in: ids } });
        if (!deletedCount) return res.status(404).send("Member(s) not found");
        res.send(`Member${ids.length > 1 ? "s" : ""} removed successfully`)
    } catch (err) { res.status(500).send(err.message) }
});

module.exports = router;
