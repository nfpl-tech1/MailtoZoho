/**
 * Cron-job.org API Service
 * Manages cron jobs via cron-job.org REST API
 * 
 * API LIMITS (from docs.cron-job.org/rest-api.html):
 * - Default: 100 requests/day (5000 for sustaining members)
 * - GET /jobs: 5 req/sec
 * - GET /jobs/{id}: 5 req/sec  
 * - GET /jobs/{id}/history: 5 req/sec
 * - PATCH /jobs/{id}: 5 req/sec
 * - PUT /jobs: 1 req/sec, 5 req/min
 * 
 * OPTIMIZATION STRATEGY:
 * - GET /jobs returns lastExecution, nextExecution, enabled, title, url
 * - No need to call GET /jobs/{id} just to show status
 * - Cache job list for 5 minutes to minimize API calls
 * - Store job IDs in Supabase to persist across cold starts
 */

const { getConfigService } = require('./config.service');

class CronJobService {
    constructor() {
        this.baseUrl = 'https://api.cron-job.org';
        this.configService = getConfigService();
        
        // Cache for job list - 5 minutes to minimize API calls
        // With 100 requests/day limit, we can only afford ~4 requests/hour
        this.cache = {
            jobs: null,
            timestamp: null,
            ttl: 300000 // 5 minutes
        };
        
        this.debug = true;
    }

    /**
     * Get API key from environment
     */
    getApiKey() {
        return process.env.CRONJOB_API_KEY;
    }

    /**
     * Debug log helper
     */
    log(action, data) {
        if (!this.debug) return;
        console.log(`\n${'─'.repeat(60)}`);
        console.log(`⏰ CRON-JOB.ORG | ${action}`);
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
     * Check if API key is configured
     */
    isConfigured() {
        const apiKey = this.getApiKey();
        return !!(apiKey && apiKey.length > 10);
    }

    /**
     * Make API request to cron-job.org
     */
    async apiRequest(method, endpoint, data = null) {
        const apiKey = this.getApiKey();
        
        if (!apiKey || apiKey.length < 10) {
            return { success: false, error: 'API key not configured' };
        }

        try {
            const options = {
                method,
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            };

            if (data && ['PUT', 'PATCH', 'POST'].includes(method)) {
                options.body = JSON.stringify(data);
            }

            const url = `${this.baseUrl}${endpoint}`;
            this.log('API CALL', { method, endpoint });
            
            const response = await fetch(url, options);
            
            // Handle rate limiting
            if (response.status === 429) {
                this.log('RATE LIMITED', { status: 429 });
                return { 
                    success: false, 
                    error: 'Rate limited (429). Please wait before retrying.',
                    rateLimited: true 
                };
            }

            const responseText = await response.text();
            
            // Empty response (common for PATCH/DELETE)
            if (!responseText) {
                return { success: response.ok, data: {} };
            }
            
            let result;
            try {
                result = JSON.parse(responseText);
            } catch (e) {
                this.log('PARSE ERROR', { responseText: responseText.substring(0, 200) });
                return { success: false, error: 'Invalid JSON response' };
            }

            if (!response.ok) {
                return { 
                    success: false, 
                    error: result.message || `HTTP ${response.status}`,
                    status: response.status 
                };
            }

            return { success: true, data: result };
        } catch (error) {
            this.log('ERROR', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * List all cron jobs (with caching)
     * This is the ONLY endpoint we need for status display
     * Returns: jobId, enabled, title, url, lastExecution, nextExecution, schedule
     */
    async listJobs(forceRefresh = false) {
        // Check cache first
        if (!forceRefresh && this.cache.jobs && this.cache.timestamp) {
            const age = Date.now() - this.cache.timestamp;
            if (age < this.cache.ttl) {
                this.log('CACHE HIT', { age: `${Math.round(age/1000)}s`, count: this.cache.jobs.length });
                return { success: true, jobs: this.cache.jobs, cached: true };
            }
        }

        const result = await this.apiRequest('GET', '/jobs');
        
        // If rate limited but we have cache, return stale cache
        if (result.rateLimited && this.cache.jobs) {
            this.log('RATE LIMITED - USING STALE CACHE', { count: this.cache.jobs.length });
            return { success: true, jobs: this.cache.jobs, cached: true, stale: true };
        }
        
        if (result.success && result.data) {
            const jobs = result.data.jobs || [];
            this.cache.jobs = jobs;
            this.cache.timestamp = Date.now();
            this.log('JOBS FETCHED', { count: jobs.length });
            return { success: true, jobs };
        }
        
        return result;
    }

    /**
     * Update an existing cron job (schedule only)
     */
    async updateJob(jobId, jobConfig) {
        const result = await this.apiRequest('PATCH', `/jobs/${jobId}`, { job: jobConfig });
        if (result.success) {
            // Invalidate cache
            this.cache.jobs = null;
            this.cache.timestamp = null;
        }
        return result;
    }

    /**
     * Find jobs by URL pattern (from cached job list)
     */
    findJobsByUrl(jobs, urlPattern) {
        const pattern = urlPattern.toLowerCase();
        return jobs.filter(job => {
            const url = (job.url || '').toLowerCase();
            const title = (job.title || '').toLowerCase();
            return url.includes(pattern) || title.includes(pattern);
        });
    }

    /**
     * Auto-detect our cron jobs from the job list
     * Uses URL patterns to identify IRN-DRN and Record Query jobs
     */
    async autoDetectJobs() {
        const result = await this.listJobs();
        
        if (!result.success) {
            return { 
                success: false, 
                error: result.error,
                rateLimited: result.rateLimited 
            };
        }

        const jobs = result.jobs || [];
        let irnDrnJob = null;
        let recordQueryJob = null;

        for (const job of jobs) {
            const url = (job.url || '').toLowerCase();
            const title = (job.title || '').toLowerCase();
            
            // Match IRN-DRN Tracker
            if (!irnDrnJob && (
                url.includes('irn-drn-tracker') || 
                url.includes('irn-drn') ||
                title.includes('irn-drn') ||
                title.includes('irn drn')
            )) {
                irnDrnJob = job;
            }
            
            // Match Record Query Tracker
            if (!recordQueryJob && (
                url.includes('record-query') ||
                title.includes('record query') ||
                title.includes('record-query')
            )) {
                recordQueryJob = job;
            }
        }

        this.log('AUTO-DETECT RESULT', {
            irnDrn: irnDrnJob ? { jobId: irnDrnJob.jobId, title: irnDrnJob.title } : null,
            recordQuery: recordQueryJob ? { jobId: recordQueryJob.jobId, title: recordQueryJob.title } : null,
            totalJobs: jobs.length,
            cached: result.cached || false
        });

        return {
            success: true,
            irnDrn: irnDrnJob,
            recordQuery: recordQueryJob,
            allJobs: jobs,
            cached: result.cached || false,
            stale: result.stale || false
        };
    }

    /**
     * Convert hours interval to cron-job.org schedule format
     * Valid intervals: 1, 2, 3, 4, 6, 8, 12 hours
     */
    hoursToSchedule(hours) {
        const h = parseInt(hours, 10) || 3;
        
        // Generate hours array based on interval
        let hoursArray;
        switch (h) {
            case 1:  hoursArray = [-1]; break; // Every hour
            case 2:  hoursArray = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22]; break;
            case 3:  hoursArray = [0, 3, 6, 9, 12, 15, 18, 21]; break;
            case 4:  hoursArray = [0, 4, 8, 12, 16, 20]; break;
            case 6:  hoursArray = [0, 6, 12, 18]; break;
            case 8:  hoursArray = [0, 8, 16]; break;
            case 12: hoursArray = [0, 12]; break;
            default: hoursArray = [0, 3, 6, 9, 12, 15, 18, 21]; break;
        }

        return {
            timezone: 'Asia/Kolkata',
            hours: hoursArray,
            minutes: [0],
            mdays: [-1],
            months: [-1],
            wdays: [-1],
            expiresAt: 0
        };
    }

    /**
     * Extract hours interval from schedule
     */
    scheduleToHours(schedule) {
        if (!schedule || !schedule.hours) return 3;
        const hours = schedule.hours;
        if (hours.includes(-1) || hours.length === 24) return 1;
        if (hours.length === 12) return 2;
        if (hours.length === 8) return 3;
        if (hours.length === 6) return 4;
        if (hours.length === 4) return 6;
        if (hours.length === 3) return 8;
        if (hours.length === 2) return 12;
        return 3;
    }

    /**
     * Build job URL with secret
     * Always use HTTPS for Vercel deployments to avoid 308 redirects
     */
    buildJobUrl(baseUrl, path, secret) {
        // Ensure HTTPS for vercel.app domains
        let secureBase = baseUrl;
        if (baseUrl.includes('vercel.app') && baseUrl.startsWith('http://')) {
            secureBase = baseUrl.replace('http://', 'https://');
        }
        
        const url = new URL(path, secureBase);
        
        // Force HTTPS protocol
        if (url.hostname.includes('vercel.app') || url.hostname.includes('vercel.com')) {
            url.protocol = 'https:';
        }
        
        if (secret) {
            url.searchParams.set('secret', secret);
        }
        return url.toString();
    }

    /**
     * Update IRN-DRN Tracker cron job schedule only
     * Does NOT create new jobs - only updates existing ones
     */
    async syncIrnDrnJob(baseUrl) {
        const detected = await this.autoDetectJobs();
        const jobId = detected.irnDrn?.jobId;
        
        // Only update existing jobs, don't create new ones
        if (!jobId) {
            this.log('SYNC IRN-DRN', 'No existing job found - skipping (create jobs manually in cron-job.org)');
            return { 
                success: false, 
                error: 'No IRN-DRN cron job found. Please create it manually in cron-job.org',
                action: 'skipped'
            };
        }
        
        const intervalHours = this.configService.get('IRN_DRN_INTERVAL_HOURS', '3');

        // Only update the schedule timing
        const jobConfig = {
            schedule: this.hoursToSchedule(intervalHours)
        };

        this.log('SYNC IRN-DRN', { 
            action: 'UPDATE SCHEDULE', 
            jobId,
            intervalHours
        });

        return { ...await this.updateJob(jobId, jobConfig), jobId, action: 'updated' };
    }

    /**
     * Update Record Query cron job schedule only
     * Does NOT create new jobs - only updates existing ones
     */
    async syncRecordQueryJob(baseUrl) {
        const detected = await this.autoDetectJobs();
        const jobId = detected.recordQuery?.jobId;
        
        // Only update existing jobs, don't create new ones
        if (!jobId) {
            this.log('SYNC RECORD-QUERY', 'No existing job found - skipping (create jobs manually in cron-job.org)');
            return { 
                success: false, 
                error: 'No Record Query cron job found. Please create it manually in cron-job.org',
                action: 'skipped'
            };
        }
        
        const intervalHours = this.configService.get('RECORD_QUERY_INTERVAL_HOURS', '3');

        // Only update the schedule timing
        const jobConfig = {
            schedule: this.hoursToSchedule(intervalHours)
        };

        this.log('SYNC RECORD-QUERY', { 
            action: 'UPDATE SCHEDULE', 
            jobId,
            intervalHours
        });

        return { ...await this.updateJob(jobId, jobConfig), jobId, action: 'updated' };
    }

    /**
     * Update schedules for both cron jobs (no creation)
     */
    async syncAllJobs(baseUrl) {
        const results = {
            irnDrn: await this.syncIrnDrnJob(baseUrl),
            recordQuery: await this.syncRecordQueryJob(baseUrl)
        };

        return {
            success: results.irnDrn.success && results.recordQuery.success,
            results
        };
    }

    /**
     * Get status for settings page
     * OPTIMIZED: Uses only GET /jobs (1 API call) which returns all needed info
     * No need for separate getJob() or getJobHistory() calls
     */
    async getStatus() {
        const status = {
            configured: this.isConfigured(),
            jobs: { irnDrn: null, recordQuery: null },
            cached: false,
            rateLimited: false
        };

        if (!status.configured) {
            return status;
        }

        const detected = await this.autoDetectJobs();
        
        status.cached = detected.cached || false;
        status.stale = detected.stale || false;
        
        if (!detected.success) {
            status.error = detected.error;
            status.rateLimited = detected.rateLimited || false;
            return status;
        }

        // GET /jobs already returns: jobId, enabled, title, url, lastExecution, nextExecution, schedule
        // No need for additional API calls!
        
        if (detected.irnDrn) {
            const job = detected.irnDrn;
            status.jobs.irnDrn = {
                jobId: job.jobId,
                title: job.title,
                url: job.url,
                enabled: job.enabled,
                lastExecution: job.lastExecution,
                nextExecution: job.nextExecution,
                lastStatus: job.lastStatus,
                schedule: job.schedule,
                intervalHours: this.scheduleToHours(job.schedule)
            };
        }

        if (detected.recordQuery) {
            const job = detected.recordQuery;
            status.jobs.recordQuery = {
                jobId: job.jobId,
                title: job.title,
                url: job.url,
                enabled: job.enabled,
                lastExecution: job.lastExecution,
                nextExecution: job.nextExecution,
                lastStatus: job.lastStatus,
                schedule: job.schedule,
                intervalHours: this.scheduleToHours(job.schedule)
            };
        }

        return status;
    }
}

// Singleton instance
let instance = null;

module.exports = {
    CronJobService,
    getCronJobService: () => {
        if (!instance) {
            instance = new CronJobService();
        }
        return instance;
    }
};
