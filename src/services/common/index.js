/**
 * Common Services Index
 * Re-exports all common services
 */

const GmailService = require('./gmail.service');
const ZohoService = require('./zoho');  // Now uses modular structure
const { ConfigService, getConfigService, initializeConfig } = require('./config.service');
const { CronJobService, getCronJobService } = require('./cronjob.service');
const { SupabaseService, getSupabaseService } = require('./supabase.service');
const { EmailNotificationService, getNotificationService } = require('./email-notification');

module.exports = {
    GmailService,
    ZohoService,
    ConfigService,
    getConfigService,
    initializeConfig,
    CronJobService,
    getCronJobService,
    SupabaseService,
    getSupabaseService,
    EmailNotificationService,
    getNotificationService
};
