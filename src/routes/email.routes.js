/**
 * Email Routes (Legacy - for backward compatibility)
 * Redirects to IRN-DRN Tracker feature
 */

const express = require('express');
const router = express.Router();

// Import the new modular controller
const { emailController } = require('../controllers/irn-drn-tracker');

/**
 * @route   GET & POST /api/email/process
 * @desc    Process emails using .env defaults (legacy - redirects to IRN-DRN Tracker)
 */
router.get('/process', emailController.processEmails);
router.post('/process', emailController.processEmails);

/**
 * @route   POST /api/email/fetch-and-parse
 * @desc    Legacy endpoint - same as /process
 */
router.post('/fetch-and-parse', emailController.processEmails);

/**
 * @route   GET /api/email/config
 * @desc    Get current configuration from .env
 */
router.get('/config', emailController.getConfig);

/**
 * @route   GET /api/email/health
 * @desc    Check if email service is healthy
 */
router.get('/health', emailController.healthCheck);

module.exports = router;
