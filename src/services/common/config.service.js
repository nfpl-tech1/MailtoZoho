/**
 * Configuration Service
 * Manages application configuration with .env defaults and Supabase overrides
 * 
 * Priority: ENV defaults → Supabase overrides (loaded on startup)
 * Writes: Always to Supabase
 */

const { getSupabaseService } = require('./supabase.service');

class ConfigService {
    constructor() {
        this.cache = {};
        this.loaded = false;
        this.loading = null;
        this.loadedAt = null; // Timestamp when config was last loaded
        this.debug = true; // Enable detailed logging
    }

    /**
     * Debug log helper
     */
    log(action, data) {
        if (!this.debug) return;
        console.log(`\n${'─'.repeat(60)}`);
        console.log(`⚙️  CONFIG SERVICE | ${action}`);
        console.log(`${'─'.repeat(60)}`);
        if (data) {
            if (typeof data === 'object') {
                console.log(JSON.stringify(data, null, 2));
            } else {
                console.log(data);
            }
        }
    }

    /**
     * Load configuration from Supabase
     */
    async loadConfig() {
        // Prevent multiple simultaneous loads
        if (this.loading) {
            return this.loading;
        }

        this.loading = (async () => {
            try {
                const supabase = getSupabaseService();

                if (!supabase.isConfigured()) {
                    console.log('ℹ Supabase not configured, using .env defaults only');
                    this.cache = {};
                    this.loaded = true;
                    return;
                }

                const result = await supabase.getAll();
                if (result.success) {
                    this.cache = result.data || {};
                    this.loadedAt = Date.now(); // Track when loaded
                    console.log(`✓ Configuration loaded from Supabase (${Object.keys(this.cache).length} overrides)`);
                } else {
                    console.error('⚠ Failed to load from Supabase:', result.error);
                    this.cache = {};
                    this.loadedAt = Date.now();
                }
                this.loaded = true;
            } catch (error) {
                console.error('⚠ Error loading config from Supabase:', error.message);
                this.cache = {};
                this.loadedAt = Date.now(); // Track timestamp even on error
                this.loaded = true;
            } finally {
                this.loading = null;
            }
        })();

        return this.loading;
    }

    /**
     * Ensure config is loaded
     * Auto-reloads if cache is stale (>5 minutes old) to prevent Vercel cold-start caching issues
     * @param {boolean} force - Force reload even if already loaded
     */
    async ensureLoaded(force = false) {
        const CACHE_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes
        const isStale = this.loadedAt && (Date.now() - this.loadedAt > CACHE_MAX_AGE_MS);

        if (force || !this.loaded || isStale) {
            if (isStale) {
                console.log('⚠ Config cache is stale, reloading from Supabase...');
            }
            await this.loadConfig();
        }
    }

    /**
     * Force reload config from Supabase (use before processing to ensure fresh values)
     */
    async forceReload() {
        this.loaded = false;
        this.loading = null;
        this.cache = {};
        await this.loadConfig();
        console.log('🔄 Config force-reloaded from Supabase');
        return this.cache;
    }

    /**
     * Get a config value (Supabase overrides .env)
     */
    get(key, defaultValue = null) {
        // First check Supabase cache
        if (this.cache && this.cache[key] !== undefined && this.cache[key] !== '') {
            return this.cache[key];
        }
        // Then check .env
        if (process.env[key] !== undefined && process.env[key] !== '') {
            return process.env[key];
        }
        // Return default
        return defaultValue;
    }

    /**
     * Get a config value as number
     */
    getNumber(key, defaultValue = 0) {
        const value = this.get(key, defaultValue);
        return parseInt(value, 10) || defaultValue;
    }

    /**
     * Get a config value as boolean
     */
    getBoolean(key, defaultValue = false) {
        const value = this.get(key, defaultValue);
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') return value.toLowerCase() === 'true';
        return defaultValue;
    }

    /**
     * Set a config value (saves to Supabase)
     */
    async set(key, value) {
        const supabase = getSupabaseService();

        if (!supabase.isConfigured()) {
            console.warn('⚠ Cannot save to Supabase - not configured');
            return false;
        }

        const success = await supabase.set(key, value);
        if (success) {
            this.cache[key] = String(value);
        }
        return success;
    }

    /**
     * Set multiple config values (saves to Supabase)
     */
    async setMultiple(configs) {
        const supabase = getSupabaseService();

        if (!supabase.isConfigured()) {
            console.warn('⚠ Cannot save to Supabase - not configured');
            return false;
        }

        // Log what's changing
        this.log('SAVE SETTINGS - CHANGES DETECTED', {
            timestamp: new Date().toISOString(),
            changes: Object.entries(configs).map(([key, newValue]) => {
                const oldValue = this.cache[key] || process.env[key] || '(not set)';
                return {
                    key,
                    oldValue,
                    newValue,
                    changed: oldValue !== newValue
                };
            })
        });

        const success = await supabase.setMultiple(configs);
        if (success) {
            Object.entries(configs).forEach(([key, value]) => {
                this.cache[key] = String(value);
            });

            this.log('SAVE SETTINGS - SUCCESS', {
                savedKeys: Object.keys(configs),
                newCacheState: this.cache
            });
        } else {
            this.log('SAVE SETTINGS - FAILED', 'Supabase write failed');
        }
        return success;
    }

    /**
     * Delete a config override (reverts to .env default)
     */
    async delete(key) {
        const supabase = getSupabaseService();

        if (!supabase.isConfigured()) {
            return true;
        }

        const success = await supabase.delete(key);
        if (success) {
            delete this.cache[key];
        }
        return success;
    }

    /**
     * Get all configurations (merged .env + overrides)
     */
    getAll() {
        const configKeys = this.getConfigurableKeys();
        const result = {};

        configKeys.forEach(item => {
            const envValue = process.env[item.key];
            const overrideValue = this.cache ? this.cache[item.key] : undefined;

            result[item.key] = {
                value: (overrideValue !== undefined && overrideValue !== '')
                    ? overrideValue
                    : (envValue || item.default),
                envValue: envValue || item.default,
                isOverridden: overrideValue !== undefined && overrideValue !== '',
                ...item
            };
        });

        return result;
    }

    /**
     * Get only the overridden values
     */
    getOverrides() {
        return { ...this.cache };
    }

    /**
     * Reset all overrides (revert to .env defaults)
     */
    async resetAll() {
        const supabase = getSupabaseService();
        if (!supabase.isConfigured()) {
            this.cache = {};
            return true;
        }

        // Delete all keys from Supabase
        const keys = Object.keys(this.cache);
        for (const key of keys) {
            await supabase.delete(key);
        }
        this.cache = {};
        return true;
    }

    /**
     * Check if storage is available (Supabase configured)
     */
    isStorageAvailable() {
        const supabase = getSupabaseService();
        return supabase.isConfigured();
    }

    /**
     * Define all configurable keys with metadata
     * Simplified: Using single INTERVAL_HOURS for both cron schedule and lookback
     */
    getConfigurableKeys() {
        return [
            // IRN-DRN Tracker Settings
            {
                key: 'IRN_DRN_INTERVAL_HOURS',
                label: 'Interval (Hours)',
                type: 'select',
                options: [
                    { value: '1', label: 'Every 1 hour' },
                    { value: '2', label: 'Every 2 hours' },
                    { value: '3', label: 'Every 3 hours' },
                    { value: '4', label: 'Every 4 hours' },
                    { value: '6', label: 'Every 6 hours' },
                    { value: '8', label: 'Every 8 hours' },
                    { value: '12', label: 'Every 12 hours' }
                ],
                category: 'IRN-DRN Tracker',
                default: '3',
                description: 'Run every X hours (also sets lookback period)'
            },
            {
                key: 'EMAIL_SUBJECT_KEYWORDS',
                label: 'Email Subject Keywords',
                type: 'text',
                category: 'IRN-DRN Tracker',
                default: 'Document upload confirmation',
                description: 'Keywords to search in email subject'
            },
            {
                key: 'EMAIL_MAX_RESULTS',
                label: 'Max Emails to Process',
                type: 'number',
                category: 'IRN-DRN Tracker',
                default: '20',
                description: 'Maximum number of emails to process per run'
            },
            {
                key: 'ZOHO_FORM_LINK_NAME',
                label: 'Zoho Form Name',
                type: 'text',
                category: 'IRN-DRN Tracker',
                default: 'IRN_DRN_Tracker',
                description: 'Form where IRN-DRN records are created'
            },
            {
                key: 'ZOHO_JOB_REPORT_LINK_NAME',
                label: 'Job Report Name',
                type: 'text',
                category: 'IRN-DRN Tracker',
                default: 'Billing_manager',
                description: 'Report to lookup Job records'
            },
            {
                key: 'ZOHO_PUSH_ENABLED',
                label: 'Auto Push to Zoho',
                type: 'boolean',
                category: 'IRN-DRN Tracker',
                default: 'true',
                description: 'Automatically push parsed data to Zoho'
            },

            // Record Query Settings
            {
                key: 'RECORD_QUERY_INTERVAL_HOURS',
                label: 'Interval (Hours)',
                type: 'select',
                options: [
                    { value: '1', label: 'Every 1 hour' },
                    { value: '2', label: 'Every 2 hours' },
                    { value: '3', label: 'Every 3 hours' },
                    { value: '4', label: 'Every 4 hours' },
                    { value: '6', label: 'Every 6 hours' },
                    { value: '8', label: 'Every 8 hours' },
                    { value: '12', label: 'Every 12 hours' }
                ],
                category: 'Record Query',
                default: '3',
                description: 'Run every X hours (also sets lookback period)'
            },
            {
                key: 'RECORD_QUERY_SUBJECT_KEYWORD',
                label: 'Email Subject Keyword',
                type: 'text',
                category: 'Record Query',
                default: 'Outbound file generated',
                description: 'Keywords to search in email subject'
            },
            {
                key: 'RECORD_QUERY_MAX_RESULTS',
                label: 'Max Emails to Process',
                type: 'number',
                category: 'Record Query',
                default: '30',
                description: 'Maximum number of emails to process per run'
            },
            {
                key: 'RECORD_QUERY_FORM_LINK_NAME',
                label: 'Zoho Form Name',
                type: 'text',
                category: 'Record Query',
                default: 'Testing_Record_query',
                description: 'Form where Record Query records are created'
            },
            {
                key: 'RECORD_QUERY_JOB_REPORT_LINK_NAME',
                label: 'Job Report Name',
                type: 'text',
                category: 'Record Query',
                default: 'View_All_Jobs',
                description: 'Report to lookup Job by BE Number'
            },
            {
                key: 'RECORD_QUERY_REPORT_LINK_NAME',
                label: 'Record Query Report Name',
                type: 'text',
                category: 'Record Query',
                default: 'Testing_Record_query_Report',
                description: 'Report to lookup existing Record Queries'
            },
            {
                key: 'RECORD_QUERY_PUSH_ENABLED',
                label: 'Auto Push to Zoho',
                type: 'boolean',
                category: 'Record Query',
                default: 'true',
                description: 'Automatically push parsed data to Zoho'
            },

            // Zoho Settings (mostly from ENV, rarely changed)
            {
                key: 'ZOHO_ACCOUNT_OWNER',
                label: 'Account Owner',
                type: 'text',
                category: 'Zoho Settings',
                default: '',
                description: 'Zoho account owner name'
            },
            {
                key: 'ZOHO_APP_LINK_NAME',
                label: 'App Link Name',
                type: 'text',
                category: 'Zoho Settings',
                default: '',
                description: 'Zoho Creator app link name'
            },

            // Email Notification Settings
            {
                key: 'ERROR_NOTIFICATION_EMAILS',
                label: 'Notification Recipients',
                type: 'text',
                category: 'Email Notifications',
                default: '',
                description: 'Comma-separated email addresses to receive failure notifications'
            },

            // Security Settings
            {
                key: 'SETTINGS_PASSWORD',
                label: 'Settings Page Password',
                type: 'password',
                category: 'Security',
                default: '',
                description: 'Password required to access settings page (leave empty to disable)'
            }
        ];
    }

    /**
     * Get configs grouped by category
     */
    getAllGrouped() {
        const all = this.getAll();
        const grouped = {};

        Object.values(all).forEach(config => {
            if (!grouped[config.category]) {
                grouped[config.category] = [];
            }
            grouped[config.category].push(config);
        });

        return grouped;
    }

    /**
     * Get hours back for email lookup (uses interval hours)
     */
    getIrnDrnHoursBack() {
        return this.getNumber('IRN_DRN_INTERVAL_HOURS', 3);
    }

    /**
     * Get hours back for record query email lookup (uses interval hours)
     */
    getRecordQueryHoursBack() {
        return this.getNumber('RECORD_QUERY_INTERVAL_HOURS', 3);
    }
}

// Singleton instance
let instance = null;

module.exports = {
    ConfigService,
    getConfigService: () => {
        if (!instance) {
            instance = new ConfigService();
        }
        return instance;
    },
    // Helper to initialize config on app startup
    initializeConfig: async () => {
        const service = module.exports.getConfigService();
        await service.loadConfig();
        return service;
    }
};
