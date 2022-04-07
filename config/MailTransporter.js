const path = require('path');
const nodemailer = require('nodemailer');
const SMTPTransport = require('nodemailer/lib/smtp-transport');
const { renderFile } = require('ejs');
const { Document: Doc } = require('mongoose');
const { OAuth2 } = (require("googleapis")).google.auth;
const { Homepage_content } = require('../models/models');
const { OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, OAUTH_REFRESH_TOKEN, NODE_ENV } = process.env;
const production = NODE_ENV === "production";

/** Class for processing mail transports */
class MailTransporter {
    #recipient; #recipients; #oauth2Client; #user; #pass;

    /** @param {Doc | Doc[]} recipient one or more existing mailing list recipients */
    constructor(recipient) {
        this.#recipient = !Array.isArray(recipient) ? recipient : null;
        this.#recipients = Array.isArray(recipient) ? recipient : [];
        this.#oauth2Client = new OAuth2( OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, "https://developers.google.com/oauthplayground" );
        this.#oauth2Client.setCredentials({ refresh_token: OAUTH_REFRESH_TOKEN });
    };

    /**
     * Passes transport objects to sendMail method for authentication
     * @returns {Promise<SMTPTransport.Options>} transporter options
     */
    async #getTransportOpts() {
        try {
            const response = await this.#oauth2Client.getAccessToken();
            return {
                service: 'gmail', /* port: 465, secure: true, */
                auth: {
                    type: "OAuth2",
                    user: "info@thecs.co",
                    clientId: OAUTH_CLIENT_ID,
                    clientSecret: OAUTH_CLIENT_SECRET,
                    refreshToken: OAUTH_REFRESH_TOKEN,
                    accessToken: response.token
                },
                tls: { rejectUnauthorized: true }
            }
        } catch(err) {
            if (production) throw err;
            const acc = await nodemailer.createTestAccount();
            this.#user = this.#user || acc.user;
            this.#pass = this.#pass || acc.pass;
            return {
                host: 'smtp.ethereal.email',
                port: 587,
                secure: false,
                auth: { user: this.#user, pass: this.#pass }
            }
        }
    };

    /**
     * Starts SMTP process of creating and sending new emails
     * @param {object} mail_opts contents to be applied to compose the email
     * @param {string} mail_opts.subject email subject
     * @param {string} mail_opts.message email message
     * @param {function} [cb] optional callback
     */
    async sendMail({ subject, message }, cb) {
        try {
            if (!this.#recipient && !this.#recipients.length) throw Error("Recipient(s) not set");
            if (!subject || !message) throw Error("Subject and message cannot be empty");

            const template = path.join(__dirname, '../views/templates/mail.ejs');
            const socials = (await Homepage_content.find())[0]?.socials || [];
            const location_origin = production ? "https://www.thecs.co" : "http://localhost:4001";
            const html = await renderFile(template, { message, recipient: this.#recipient, socials, location_origin });

            const transport_opts = await this.#getTransportOpts();
            const attachments = [{ path: 'public/img/cs-logo.png', cid: 'logo' }];
            socials.forEach((s, i) => attachments.push({ path: `public/img/socials/${s.name}.png`, cid: `social_icon_${i}` }));
            const from = "CS <info@thecs.co>";
            const to = this.#recipient?.email || this.#recipients.map(m => m.email);
            await nodemailer.createTransport(transport_opts).sendMail({ from, to, subject, html, attachments });
            cb?.();
        } catch (err) { if (!cb) throw err; cb(err) }
    };

    /** @param {Doc} recipient existing mailing list recipient */
    setRecipient(recipient) {
        this.#recipients = [];
        this.#recipient = recipient;
        return this
    };

    /** @param {Doc[]} recipients existing mailing list recipients */
    setRecipients(recipients) {
        this.#recipients = recipients;
        this.#recipient = null;
        return this
    };
};

module.exports = MailTransporter;
