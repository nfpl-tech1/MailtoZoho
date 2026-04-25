/**
 * Cron Routes
 * Secure endpoints for cron-job.org to call
 * 
 * Config Loading Strategy:
 * - Cold start: Loads from Supabase via initializeConfig() in index.js
 * - Warm instance: Uses cached config (updated when settings are saved)
 * - No Supabase calls on each cron run = faster & fewer API calls
 */

const express = require('express');
const router = express.Router();
const { getConfigService } = require('../services/common/config.service');

// Import controllers
const irnDrnController = require('../controllers/irn-drn-tracker/email.controller');
const recordQueryController = require('../controllers/record-query/email.controller');

/**
 * Middleware to validate cron secret
 */
const validateCronSecret = (req, res, next) => {
    const configService = getConfigService();
    const expectedSecret = configService.get('CRON_SECRET', '');

    // Skip validation if no secret is configured
    if (!expectedSecret) {
        console.log('⚠️ CRON_SECRET not configured - allowing request');
        return next();
    }

    // Get secret from query params or header
    const providedSecret = req.query.secret || req.headers['x-cron-secret'];

    if (providedSecret !== expectedSecret) {
        console.log('❌ Invalid cron secret provided');
        return res.status(401).json({
            success: false,
            error: 'Unauthorized - Invalid cron secret'
        });
    }

    next();
};

/**
 * @route   POST /api/cron/irn-drn-tracker
 * @desc    Process IRN-DRN emails (called by cron-job.org)
 * @note    Uses cached config (loaded on cold start or updated on settings save)
 */
router.post('/irn-drn-tracker', validateCronSecret, irnDrnController.processEmails);

/**
 * @route   POST /api/cron/record-query
 * @desc    Process Record Query emails (called by cron-job.org)
 * @note    Uses cached config (loaded on cold start or updated on settings save)
 */
router.post('/record-query', validateCronSecret, recordQueryController.processEmails);

/**
 * @route   GET /api/cron/health
 * @desc    Health check for cron endpoints
 */
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Cron endpoints are active',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
