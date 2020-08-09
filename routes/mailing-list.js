const router = require('express').Router();
const { post } = require('request');
const { each } = require('async');
const { MailingList } = require('../models/models');
const { isAuthed } = require('../config/config');
const MailingListMailTransporter = require('../config/mailingListMailTransporter');

router.get('/sign-up', (req, res) => {
    res.render('mailing-list', { title: "Sign Up", pagename: "sign-up" })
});

router.get('/member/delete', (req, res) => {
    const { id, src } = req.query;
    MailingList.findById(id, (err, doc) => {
        if (!src.match(/^email_unsub_link[A-Za-z0-9]{24}$/g) || src.slice(-24) !== id || err || !doc) return res.status(400).send("Invalid entry");
        post({ url: res.locals.location_origin + req.originalUrl, json: { id } }, (err, response) => {
            if (err) return res.status(500).send(err.message || "Error occurred");
            var result = response.body === "Nothing selected" ? "You don't exist on our records." : "You are now unsubscribed. Sorry to see you go!";
            res.send(result + "<br><br> - CS");
        })
    })
});

router.post('/new', (req, res) => {
    for (const k in req.body) if (typeof req.body[k] == "string") req.body[k] = req.body[k].replace(/<script(.*?)>(<\/script>)?/gi, "");
    const { firstname, lastname, email, size_top, size_bottom, extra_info } = req.body;
    const newMember = new MailingList({ firstname, lastname, email, size_top, size_bottom, extra_info });

    MailingList.findOne({ email }, (err, member) => {
        if (err || member) return res.status(err ? 500 : 200).send(err || "Already registered");
        newMember.save(err => res.send(err ? err.message : "You are now registered"))
    })
});

router.post('/update', isAuthed, (req, res) => {
    const { member_id, firstname, lastname, email, size_top, size_bottom, extra_info } = req.body;
    MailingList.findById(member_id, (err, member) => {
        if (err || !member) return res.status(err ? 500 : 404).send(err ? err.message || "Error occurred" : "Member not found");
        if (firstname)   member.firstname = firstname;
        if (lastname)    member.lastname = lastname;
        if (email)       member.email = email;
        if (size_top)    member.size_top = size_top;
        if (size_bottom) member.size_bottom = size_bottom;
        if (extra_info)  member.extra_info = extra_info;
        member.save(err => res.send(err ? err.message : "Member updated"));
    })
});

router.post('/send/mail', isAuthed, (req, res) => {
    const { email, subject, message } = req.body, sentCount = [];
    MailingList.find(email === "all" ? {} : { email: email || "null" }, (err, members) => {
        if (err || !members.length) return res.status(err ? 500 : 404).send(err ? err.message || "Error occurred" : "Member(s) not found");
        const transporter = new MailingListMailTransporter({ req, res });

        each(members, (member, cb) => {
            transporter.setRecipient(member);
            transporter.sendMail({ subject, message }, err => {
                if (err) return cb(err.message || err);
                sentCount.push(member.email);
                console.log("The message was sent!");
                cb();
            });
        }, error => {
            if (!error) return res.send(`Message sent to ${email === "all" ? "everyone" : members[0].firstname+" "+members[0].lastname}`);
            new MailingList({ firstname: "CS", lastname: "Records", email: "info@thecs.co" }).save((err, saved) => {
                const remainingRecipients = members.filter(m => !sentCount.includes(m.email)).map(m => `${m.firstname} ${m.lastname} (${m.email})`);
                new MailingListMailTransporter({ req, res }, saved).sendMail({
                    subject: "Error Notification",
                    message: "Unable to send the latest email to the following members:\n\n- "+ remainingRecipients.join("\n- ")
                }, err1 => {
                    MailingList.deleteOne({ _id: saved.id }, err2 => {
                        if (err1 || err2) return res.status(500).send(`${(err1 || err2).message || err1 || err2}\n\nUnable to send to:\n- ${remainingRecipients.join("\n- ")}`);
                        res.status(500).send(error.message + "\n\nCheck your inbox");
                    })
                })
            })
        })
    })
});

router.post('/member/delete', (req, res) => {
    const ids = Object.values(req.body);
    if (ids.length) {
        MailingList.deleteMany({_id : { $in: ids }}, (err, result) => {
            if (err || !result.deletedCount) return res.status(err ? 500 : 404).send(err || "Member(s) not found");
            res.send("Member"+ (ids.length > 1 ? "s" : "") +" removed successfully")
        })
    } else { res.send("Nothing selected") }
});

module.exports = router;
