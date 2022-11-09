const { Server } = require('socket.io');
const { MailingList } = require('../models/models');
const MailTransporter = require('./MailTransporter');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const status = { running: false, count: 0, message: "" };

module.exports = server => {
    const io = new Server(server);

    io.on("connection", socket => {
        const url = new URL(socket.handshake.headers.referer);

        url.pathname === "/admin" && socket.on("send mail", async body => {
            const event = "sent mail result";

            if (status.running) return socket.emit(event, { background_running: true });
            status.running = true;

            const { email, subject, message } = body.reduce((p, c) => ({...p, [c.name]: c.value}), {});
            const members = await MailingList.find(email === "all" ? {} : { email: email || "null" });
            if (!members.length) {
                status.count = 0;
                status.running = false;
                return socket.emit(event, { finished: true, error: Error("Member(s) not found") })
            };

            const transporter = new MailTransporter();

            await (async function send_mail(list) {
                const member = list[0];
                if (!member) {
                    status.count = 0;
                    status.running = false;
                    status.message = status.count < members.length ? status.message.replace(" so far...", "!") : "All emails sent!";
                    return socket.emit(event, { finished: true })
                }

                const success = () => { socket.emit(event, { message: `Email sent to ${member.fullname} (${status.count+=1}/${members.length})` }) };
                const error = err => { socket.emit(event, { message: `${err.message}\nNot sent for ${member.fullname}` }) };
                await transporter.setRecipient(member).sendMail({ subject, message }).then(success).catch(error);
                status.message = `${status.count}/${members.length} emails sent so far...`;

                await sleep(2000);
                await send_mail(list.slice(1))
            })(members);
        });

        const timeout = setInterval(() => {
            if (!status.running) return clearInterval(timeout);
            status.message && socket.emit("sent mail background update", status);
        }, 1000);
    })
}