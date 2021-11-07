const router = require('express').Router();
const { post } = require('request');
const { MailingList } = require('../models/models');
const { isAuthed } = require('../config/config');
const MailingListMailTransporter = require('../config/mailingListMailTransporter');

router.get('/sign-up', (req, res) => {
    res.render('mailing-list', { title: "Sign Up", pagename: "sign-up" })
});

router.get('/member/delete', async (req, res) => {
    const { id, src } = req.query;
    const doc = await MailingList.findById(id);
    if (!src.match(/^email_unsub_link[A-Za-z0-9]{24}$/g) || src.slice(-24) !== id || err || !doc) return res.status(400).send("Invalid entry");
    post({ url: res.locals.location_origin + req.originalUrl, json: { id } }, (err, response) => {
        if (err) return res.status(500).send(err.message || "Error occurred");
        const result = response.body === "Nothing selected" ? "You don't exist on our records." : "You are now unsubscribed. Sorry to see you go!";
        res.send(`${result}<br><br> - CS`);
    })
});

router.post('/new', async (req, res) => {
    for (const k in req.body) if (typeof req.body[k] == "string") req.body[k] = req.body[k].replace(/<script(.*?)>(<\/script>)?/gi, "");
    const { firstname, lastname, email, size_top, size_bottom, extra_info } = req.body;
    const newMember = new MailingList({ firstname, lastname, email, size_top, size_bottom, extra_info });

    const member = await MailingList.findOne({ email });
    if (member) return res.status(400).send("Already registered");
    newMember.save().then(() => res.send("You are now registered")).catch(err => res.status(500).send(err.message))
});

router.post('/update', isAuthed, async (req, res) => {
    const { member_id, firstname, lastname, email, size_top, size_bottom, extra_info } = req.body;
    const member = await MailingList.findById(member_id).catch(err => null);
    if (!member) return res.status(404).send("Member not found");
    if (firstname)   member.firstname = firstname;
    if (lastname)    member.lastname = lastname;
    if (email)       member.email = email;
    if (size_top)    member.size_top = size_top;
    if (size_bottom) member.size_bottom = size_bottom;
    if (extra_info)  member.extra_info = extra_info;
    member.save().then(() => res.send("Member updated")).catch(err => res.status(500).send(err.message));
});

router.post('/send/mail', isAuthed, async (req, res) => {
    const { email, subject, message } = req.body;
    const members = await MailingList.find(email === "all" ? {} : { email: email || "null" });
    if (!members.length) return res.status(404).send("Member(s) not found");
    const transporter = new MailingListMailTransporter({ req, res });

    members.forEach((member, i) => {
        setTimeout(() => {
            transporter.setRecipient(member).sendMail({ subject, message }, err => {
                if (err) console.log(err.message || err), console.log(`Not sent for ${member.firstname +" "+ member.lastname}`);
                else console.log(`Message sent!`);
            });
        }, i * 2000);
    });
    res.send(`Message sent to ${email === "all" ? "everyone" : members[0].firstname+" "+members[0].lastname}`);
});

router.post('/member/delete', async (req, res) => {
    const ids = Object.values(req.body);
    if (!ids.length) return res.status(400).send("Nothing selected");
    const result = await MailingList.deleteMany({ _id : { $in: ids } }).catch(err => null);
    if (!result.deletedCount) return res.status(404).send("Member(s) not found");
    res.send(`Member${ids.length > 1 ? "s" : ""} removed successfully`)
});

module.exports = router;
