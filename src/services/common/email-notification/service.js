/**
 * Email Notification Service - Core Service Class
 * Handles email notification sending for errors and failures
 */

const { getConfigService } = require('../config.service');
const { createGmailTransporter } = require('./transporter');
const { generateSingleFailureEmail, generateBatchFailureEmail } = require('./templates');

class EmailNotificationService {
    constructor() {
        this.transporter = null;
        this.initialized = false;
        this.fromEmail = null;
        this.notificationRecipients = [];
    }

    /**
     * Initialize the email notification service
     */
    async initialize() {
        if (this.initialized) {
            return;
        }

        const configService = getConfigService();

        // IMPORTANT: Ensure config is loaded from Supabase first
        await configService.ensureLoaded();

        // Get email credentials from config
        const gmailUser = process.env.GMAIL_USER || configService.get('GMAIL_USER');
        const gmailAppPassword = process.env.GMAIL_APP_PASSWORD || configService.get('GMAIL_APP_PASSWORD');

        // Get notification recipients (comma-separated email addresses)
        // PRIORITY: Supabase (configService) > ENV > default
        // configService.get() already handles this priority order correctly
        const recipientsStr = configService.get('ERROR_NOTIFICATION_EMAILS', '');

        if (!recipientsStr) {
            console.log('⚠️ ERROR_NOTIFICATION_EMAILS not configured - email notifications disabled');
            this.initialized = false;
            return;
        }

        this.notificationRecipients = recipientsStr.split(',').map(email => email.trim()).filter(email => email);

        if (this.notificationRecipients.length === 0) {
            console.log('⚠️ No valid notification recipients configured');
            this.initialized = false;
            return;
        }

        if (!gmailUser || !gmailAppPassword) {
            console.log('⚠️ Gmail credentials not configured - email notifications disabled');
            this.initialized = false;
            return;
        }

        try {
            const gmailConfig = await createGmailTransporter(gmailUser, gmailAppPassword);
            this.transporter = gmailConfig.transporter;
            this.fromEmail = gmailConfig.fromEmail;

            console.log('✅ Email notification service initialized successfully');
            console.log(`📧 Notifications will be sent to: ${this.notificationRecipients.join(', ')}`);
            this.initialized = true;
        } catch (error) {
            console.error('❌ Failed to initialize email notification service:', error.message);
            this.initialized = false;
        }
    }

    /**
     * Check if service is ready to send emails
     */
    isReady() {
        return this.initialized && this.transporter && this.notificationRecipients.length > 0;
    }

    /**
     * Refresh notification recipients from config
     * This allows picking up new recipients added via settings.html without restart
     */
    async refreshRecipients() {
        const configService = getConfigService();

        // Force reload config from Supabase to get latest values
        await configService.ensureLoaded();

        const recipientsStr = configService.get('ERROR_NOTIFICATION_EMAILS', '');

        if (recipientsStr) {
            const newRecipients = recipientsStr.split(',').map(email => email.trim()).filter(email => email);

            // Log if recipients changed
            const oldRecipientsStr = this.notificationRecipients.join(',');
            const newRecipientsStr = newRecipients.join(',');

            if (oldRecipientsStr !== newRecipientsStr) {
                console.log('📧 Notification recipients updated:');
                console.log(`   Old: ${oldRecipientsStr || '(none)'}`);
                console.log(`   New: ${newRecipientsStr}`);
            }

            this.notificationRecipients = newRecipients;
        }

        return this.notificationRecipients;
    }

    /**
     * Send query insertion failure notification
     * @param {Object} failure - Failure details
     * @param {string} failure.beNumber - BE Number
     * @param {string} failure.queryDate - Query date
     * @param {string} failure.query - Query text
     * @param {string} failure.error - Error message
     * @param {string} failure.jobNo - Job Number (optional)
     * @param {string} workflow - Workflow name (e.g., 'Record Query', 'IRN-DRN')
     */
    async sendQueryFailureNotification(failure, workflow = 'Unknown') {
        if (!this.isReady()) {
            console.log('⚠️ Email notification service not ready - skipping notification');
            return { success: false, error: 'Service not initialized' };
        }

        // Refresh recipients before sending to pick up any settings changes
        await this.refreshRecipients();

        try {
            const { subject, html, text } = generateSingleFailureEmail(failure, workflow);

            const mailOptions = {
                from: {
                    name: 'eSanchit Error Notifier',
                    address: this.fromEmail
                },
                to: this.notificationRecipients.join(', '),
                subject: subject,
                text: text,
                html: html
            };

            const info = await this.transporter.sendMail(mailOptions);

            console.log('✅ Failure notification email sent successfully');
            console.log(`   Message ID: ${info.messageId}`);
            console.log(`   Recipients: ${this.notificationRecipients.join(', ')}`);

            return {
                success: true,
                messageId: info.messageId,
                recipients: this.notificationRecipients
            };

        } catch (error) {
            console.error('❌ Failed to send notification email:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Send batch failure notification (for multiple failures)
     * @param {Array} failures - Array of failure objects
     * @param {string} workflow - Workflow name
     */
    async sendBatchFailureNotification(failures, workflow = 'Unknown') {
        if (!this.isReady()) {
            console.log('⚠️ Email notification service not ready - skipping notification');
            return { success: false, error: 'Service not initialized' };
        }

        if (!failures || failures.length === 0) {
            return { success: false, error: 'No failures to report' };
        }

        // Refresh recipients before sending to pick up any settings changes
        await this.refreshRecipients();

        try {
            const { subject, html, text } = generateBatchFailureEmail(failures, workflow);

            const mailOptions = {
                from: {
                    name: 'eSanchit Error Notifier',
                    address: this.fromEmail
                },
                to: this.notificationRecipients.join(', '),
                subject: subject,
                text: text,
                html: html
            };

            const info = await this.transporter.sendMail(mailOptions);

            console.log(`✅ Batch failure notification email sent (${failures.length} failures)`);
            console.log(`   Message ID: ${info.messageId}`);

            return {
                success: true,
                messageId: info.messageId,
                recipients: this.notificationRecipients,
                failureCount: failures.length
            };

        } catch (error) {
            console.error('❌ Failed to send batch notification email:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = EmailNotificationService;
