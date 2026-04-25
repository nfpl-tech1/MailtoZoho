/**
 * Email Notification Module
 * Main entry point for email notification functionality
 */

const EmailNotificationService = require('./service');

// Singleton instance
let notificationService = null;

/**
 * Get or create EmailNotificationService instance
 */
const getNotificationService = async () => {
    if (!notificationService) {
        notificationService = new EmailNotificationService();
        await notificationService.initialize();
    }
    return notificationService;
};

module.exports = {
    EmailNotificationService,
    getNotificationService
};
