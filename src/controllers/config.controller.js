/**
 * Configuration Controller
 * API endpoints for managing application settings and cron jobs
 * Uses Supabase for persistent storage
 */

const { getConfigService } = require('../services/common/config.service');
const { getCronJobService } = require('../services/common/cronjob.service');
const { getSupabaseService } = require('../services/common/supabase.service');

/**
 * Get all configuration settings
 */
async function getSettings(req, res) {
    try {
        const configService = getConfigService();
        await configService.ensureLoaded();

        const settings = configService.getAllGrouped();
        const supabase = getSupabaseService();

        res.json({
            success: true,
            settings,
            storageAvailable: supabase.isConfigured(),
            storageType: supabase.isConfigured() ? 'supabase' : 'env-only'
        });
    } catch (error) {
        console.error('Error fetching settings:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

/**
 * Update configuration settings
 */
async function updateSettings(req, res) {
    try {
        const configService = getConfigService();
        await configService.ensureLoaded();

        const updates = req.body.settings;

        if (!updates || typeof updates !== 'object') {
            return res.status(400).json({
                success: false,
                error: 'Invalid settings format'
            });
        }

        // Check if storage is available
        if (!configService.isStorageAvailable()) {
            return res.status(400).json({
                success: false,
                error: 'Supabase not configured. Please add SUPABASE_URL and SUPABASE_ANON_KEY to environment variables.'
            });
        }

        // Log what we received
        console.log('\n' + '═'.repeat(70));
        console.log('📥 SAVE SETTINGS REQUEST RECEIVED');
        console.log('═'.repeat(70));
        console.log('Timestamp:', new Date().toISOString());
        console.log('Settings to save:');
        Object.entries(updates).forEach(([key, value]) => {
            console.log(`   ${key}: "${value}"`);
        });
        console.log('═'.repeat(70));

        // Update settings in Supabase
        const result = await configService.setMultiple(updates);

        if (!result) {
            console.log('❌ SAVE FAILED - Supabase write error');
            return res.status(500).json({
                success: false,
                error: 'Failed to save settings to Supabase'
            });
        }

        console.log('✅ SAVE SUCCESS - Settings saved to Supabase');
        console.log('═'.repeat(70) + '\n');

        res.json({
            success: true,
            message: 'Settings saved to Supabase',
            settings: configService.getAllGrouped()
        });
    } catch (error) {
        console.error('Error updating settings:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

/**
 * Get cron job status from cron-job.org (with auto-detection)
 */
async function getCronStatus(req, res) {
    try {
        const cronService = getCronJobService();
        const status = await cronService.getStatus();

        res.json({
            success: true,
            ...status
        });
    } catch (error) {
        console.error('Error fetching cron status:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

/**
 * Sync settings to cron-job.org (updates existing jobs or creates new)
 */
async function syncCronJobs(req, res) {
    try {
        const cronService = getCronJobService();

        if (!cronService.isConfigured()) {
            return res.status(400).json({
                success: false,
                error: 'Cron-job.org API key not configured. Please add CRONJOB_API_KEY to your environment variables.'
            });
        }

        // Get base URL from request or config
        const baseUrl = req.body.baseUrl || getBaseUrl(req);

        const result = await cronService.syncAllJobs(baseUrl);

        res.json({
            success: result.success,
            results: result.results,
            message: result.success
                ? 'Cron jobs synced successfully'
                : 'Some cron jobs failed to sync'
        });
    } catch (error) {
        console.error('Error syncing cron jobs:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

/**
 * List all cron jobs from cron-job.org account
 */
async function listCronJobs(req, res) {
    try {
        const cronService = getCronJobService();

        if (!cronService.isConfigured()) {
            return res.status(400).json({
                success: false,
                error: 'Cron-job.org API key not configured'
            });
        }

        const result = await cronService.listJobs();

        res.json({
            success: result.success,
            jobs: result.jobs || [],
            error: result.error
        });
    } catch (error) {
        console.error('Error listing cron jobs:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

/**
 * Auto-detect cron jobs by URL pattern
 */
async function autoDetectCronJobs(req, res) {
    try {
        const cronService = getCronJobService();

        if (!cronService.isConfigured()) {
            return res.status(400).json({
                success: false,
                error: 'Cron-job.org API key not configured'
            });
        }

        const result = await cronService.autoDetectJobs();

        res.json({
            success: result.success,
            irnDrn: result.irnDrn ? {
                jobId: result.irnDrn.jobId,
                title: result.irnDrn.title,
                url: result.irnDrn.url,
                enabled: result.irnDrn.enabled
            } : null,
            recordQuery: result.recordQuery ? {
                jobId: result.recordQuery.jobId,
                title: result.recordQuery.title,
                url: result.recordQuery.url,
                enabled: result.recordQuery.enabled
            } : null,
            allJobs: result.allJobs?.map(j => ({
                jobId: j.jobId,
                title: j.title,
                url: j.url,
                enabled: j.enabled
            })) || [],
            error: result.error
        });
    } catch (error) {
        console.error('Error auto-detecting cron jobs:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

/**
 * Helper to get base URL from request
 */
function getBaseUrl(req) {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    return `${protocol}://${host}`;
}

/**
 * Get configurable keys metadata (for UI)
 */
async function getConfigMetadata(req, res) {
    try {
        const configService = getConfigService();
        const keys = configService.getConfigurableKeys();

        res.json({
            success: true,
            keys
        });
    } catch (error) {
        console.error('Error fetching config metadata:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

/**
 * Test configuration (verify connections)
 */
async function testConnection(req, res) {
    const { service } = req.params;

    try {
        if (service === 'cronjob') {
            const cronService = getCronJobService();
            if (!cronService.isConfigured()) {
                return res.json({
                    success: false,
                    error: 'API key not configured'
                });
            }
            const result = await cronService.listJobs();
            return res.json({
                success: result.success,
                message: result.success ? `Connected! Found ${result.jobs?.length || 0} jobs` : 'Connection failed',
                error: result.error
            });
        }

        if (service === 'supabase') {
            const supabase = getSupabaseService();
            const result = await supabase.testConnection();
            return res.json(result);
        }

        res.status(400).json({
            success: false,
            error: 'Unknown service'
        });
    } catch (error) {
        console.error(`Error testing ${service} connection:`, error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

/**
 * Reset all settings to defaults
 */
async function resetSettings(req, res) {
    try {
        const configService = getConfigService();
        await configService.resetAll();

        res.json({
            success: true,
            message: 'Settings reset to defaults',
            settings: configService.getAllGrouped()
        });
    } catch (error) {
        console.error('Error resetting settings:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

/**
 * Get effective configuration - what values services will actually use
 * This shows the final resolved values after Supabase overrides and ENV fallbacks
 */
async function getEffectiveConfig(req, res) {
    try {
        const configService = getConfigService();
        await configService.ensureLoaded();

        // Get the actual values that will be used by services
        const effectiveConfig = {
            timestamp: new Date().toISOString(),
            source: 'Resolved from: Supabase override → ENV variable → Default',

            irnDrnTracker: {
                intervalHours: configService.getNumber('IRN_DRN_INTERVAL_HOURS', 3),
                lookbackHours: configService.getNumber('IRN_DRN_INTERVAL_HOURS', 3), // Same as interval
                maxResults: configService.getNumber('EMAIL_MAX_RESULTS', 20),
                subjectKeywords: configService.get('EMAIL_SUBJECT_KEYWORDS', 'Document upload confirmation'),
                formName: configService.get('ZOHO_FORM_LINK_NAME', 'IRN_DRN_Tracker'),
                jobReportName: configService.get('ZOHO_JOB_REPORT_LINK_NAME', 'Billing_manager'),
                pushEnabled: configService.getBoolean('ZOHO_PUSH_ENABLED', true)
            },

            recordQuery: {
                intervalHours: configService.getNumber('RECORD_QUERY_INTERVAL_HOURS', 3),
                lookbackHours: configService.getNumber('RECORD_QUERY_INTERVAL_HOURS', 3), // Same as interval
                maxResults: configService.getNumber('RECORD_QUERY_MAX_RESULTS', 30),
                subjectKeyword: configService.get('RECORD_QUERY_SUBJECT_KEYWORD', 'Outbound file generated'),
                formName: configService.get('RECORD_QUERY_FORM_LINK_NAME', 'Record_query'),
                jobReportName: configService.get('RECORD_QUERY_JOB_REPORT_LINK_NAME', 'View_All_Jobs'),
                reportName: configService.get('RECORD_QUERY_REPORT_LINK_NAME', 'Record_query_Report'),
                pushEnabled: configService.getBoolean('RECORD_QUERY_PUSH_ENABLED', true)
            },

            zoho: {
                accountOwner: configService.get('ZOHO_ACCOUNT_OWNER', ''),
                appName: configService.get('ZOHO_APP_LINK_NAME', '')
            },

            notifications: {
                recipients: configService.get('ERROR_NOTIFICATION_EMAILS', '') || '(not configured)',
                enabled: configService.get('ERROR_NOTIFICATION_EMAILS', '') ? true : false
            },

            cron: {
                secret: configService.get('CRON_SECRET', '') ? '***configured***' : '(not set)'
            }
        };

        // Log for debugging
        console.log('\n' + '═'.repeat(70));
        console.log('📊 EFFECTIVE CONFIG REQUEST');
        console.log('═'.repeat(70));
        console.log(JSON.stringify(effectiveConfig, null, 2));
        console.log('═'.repeat(70) + '\n');

        res.json({
            success: true,
            config: effectiveConfig
        });
    } catch (error) {
        console.error('Error getting effective config:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

/**
 * Debug endpoint - shows current cache state
 */
async function debugCache(req, res) {
    try {
        const configService = getConfigService();

        res.json({
            success: true,
            timestamp: new Date().toISOString(),
            loaded: configService.loaded,
            cache: configService.cache,
            resolvedValues: {
                RECORD_QUERY_INTERVAL_HOURS: {
                    cache: configService.cache['RECORD_QUERY_INTERVAL_HOURS'],
                    env: process.env.RECORD_QUERY_INTERVAL_HOURS,
                    resolved: configService.getNumber('RECORD_QUERY_INTERVAL_HOURS', 3),
                    helperMethod: configService.getRecordQueryHoursBack()
                },
                IRN_DRN_INTERVAL_HOURS: {
                    cache: configService.cache['IRN_DRN_INTERVAL_HOURS'],
                    env: process.env.IRN_DRN_INTERVAL_HOURS,
                    resolved: configService.getNumber('IRN_DRN_INTERVAL_HOURS', 3),
                    helperMethod: configService.getIrnDrnHoursBack()
                }
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

module.exports = {
    getSettings,
    updateSettings,
    getCronStatus,
    syncCronJobs,
    listCronJobs,
    autoDetectCronJobs,
    getConfigMetadata,
    testConnection,
    resetSettings,
    getEffectiveConfig,
    debugCache
};
