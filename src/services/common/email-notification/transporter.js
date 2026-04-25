/**
 * Gmail SMTP Transporter
 * Handles creation and verification of Gmail SMTP connection
 */

const nodemailer = require('nodemailer');

/**
 * Create and verify Gmail SMTP transporter
 * @param {string} gmailUser - Gmail email address
 * @param {string} gmailAppPassword - Gmail app password
 * @returns {Promise<{transporter: Object, fromEmail: string}>}
 */
async function createGmailTransporter(gmailUser, gmailAppPassword) {
    if (!gmailUser || !gmailAppPassword) {
        throw new Error('Gmail credentials (GMAIL_USER and GMAIL_APP_PASSWORD) are required');
    }

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: gmailUser,
            pass: gmailAppPassword
        }
    });

    // Verify connection
    await transporter.verify();

    return {
        transporter,
        fromEmail: gmailUser
    };
}

module.exports = {
    createGmailTransporter
};
