/**
 * Supabase Service
 * Handles database operations for storing configuration
 */

class SupabaseService {
    constructor() {
        this.url = process.env.SUPABASE_URL;
        this.anonKey = process.env.SUPABASE_ANON_KEY;
        this.tableName = 'config';
        this.debug = true; // Enable detailed logging
    }

    /**
     * Debug log helper
     */
    log(action, data) {
        if (!this.debug) return;
        console.log(`\n${'─'.repeat(60)}`);
        console.log(`🗄️  SUPABASE | ${action}`);
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
     * Check if Supabase is configured
     */
    isConfigured() {
        return !!(this.url && this.anonKey);
    }

    /**
     * Make REST API request to Supabase
     */
    async request(method, endpoint, data = null, options = {}) {
        if (!this.isConfigured()) {
            return { success: false, error: 'Supabase not configured' };
        }

        try {
            const url = `${this.url}/rest/v1/${endpoint}`;
            const headers = {
                'apikey': this.anonKey,
                'Authorization': `Bearer ${this.anonKey}`,
                'Content-Type': 'application/json',
                'Prefer': options.prefer || 'return=representation'
            };

            const fetchOptions = { method, headers };
            if (data && ['POST', 'PATCH', 'PUT'].includes(method)) {
                fetchOptions.body = JSON.stringify(data);
            }

            const response = await fetch(url, fetchOptions);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Supabase error:', errorText);
                return { success: false, error: errorText };
            }

            // For DELETE or when no content expected
            if (response.status === 204 || method === 'DELETE') {
                return { success: true, data: null };
            }

            const result = await response.json();
            return { success: true, data: result };
        } catch (error) {
            console.error('Supabase request error:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get a single config value
     */
    async get(key) {
        const result = await this.request('GET', `${this.tableName}?key=eq.${encodeURIComponent(key)}&select=value`);
        if (result.success && result.data && result.data.length > 0) {
            return result.data[0].value;
        }
        return null;
    }

    /**
     * Get all config values
     */
    async getAll() {
        this.log('READ ALL', 'Fetching all config values from Supabase...');
        
        const result = await this.request('GET', `${this.tableName}?select=key,value,updated_at`);
        if (result.success && result.data) {
            // Convert array to object
            const config = {};
            result.data.forEach(row => {
                config[row.key] = row.value;
            });
            
            this.log('READ ALL RESULT', {
                success: true,
                count: Object.keys(config).length,
                values: config
            });
            
            return { success: true, data: config };
        }
        
        this.log('READ ALL RESULT', {
            success: false,
            error: result.error
        });
        
        return { success: false, data: {}, error: result.error };
    }

    /**
     * Set a single config value (upsert)
     */
    async set(key, value) {
        const result = await this.request(
            'POST',
            `${this.tableName}?on_conflict=key`,
            { key, value: String(value) },
            { prefer: 'resolution=merge-duplicates,return=representation' }
        );
        return result.success;
    }

    /**
     * Set multiple config values (upsert)
     */
    async setMultiple(configs) {
        if (!configs || Object.keys(configs).length === 0) {
            return true;
        }

        // Convert object to array of {key, value}
        const rows = Object.entries(configs).map(([key, value]) => ({
            key,
            value: String(value)
        }));

        this.log('WRITE MULTIPLE', {
            action: 'Upserting config values',
            count: rows.length,
            data: rows
        });

        const result = await this.request(
            'POST',
            `${this.tableName}?on_conflict=key`,
            rows,
            { prefer: 'resolution=merge-duplicates,return=representation' }
        );
        
        this.log('WRITE RESULT', {
            success: result.success,
            error: result.error || null,
            savedRows: result.data?.length || 0
        });

        return result.success;
    }

    /**
     * Delete a config value
     */
    async delete(key) {
        const result = await this.request('DELETE', `${this.tableName}?key=eq.${encodeURIComponent(key)}`);
        return result.success;
    }

    /**
     * Test connection to Supabase
     */
    async testConnection() {
        if (!this.isConfigured()) {
            return { success: false, error: 'Supabase URL or ANON_KEY not configured' };
        }

        try {
            const result = await this.request('GET', `${this.tableName}?select=key&limit=1`);
            return {
                success: result.success,
                message: result.success ? 'Connected to Supabase' : 'Failed to connect',
                error: result.error
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

// Singleton instance
let instance = null;

module.exports = {
    SupabaseService,
    getSupabaseService: () => {
        if (!instance) {
            instance = new SupabaseService();
        }
        return instance;
    }
};
