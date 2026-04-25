/**
 * IRN-DRN Tracker Routes
 * Defines API endpoints for IRN-DRN Tracker feature
 */

const express = require('express');
const router = express.Router();
const { emailController, zohoController } = require('../../controllers/irn-drn-tracker');

/**
 * @route   GET & POST /api/irn-drn-tracker/process
 * @desc    Process emails using config defaults
 *          GET - for cron jobs
 *          POST - for manual calls with optional overrides
 * @body    Optional overrides: { hoursBack, maxResults, pushToZoho }
 * @returns Parsed email data and Zoho results
 */
router.get('/process', emailController.processEmails);
router.post('/process', emailController.processEmails);

/**
 * @route   GET /api/irn-drn-tracker/config
 * @desc    Get current configuration
 * @returns Current email and Zoho configuration
 */
router.get('/config', emailController.getConfig);

/**
 * @route   GET /api/irn-drn-tracker/health
 * @desc    Check if service is healthy
 * @returns Health status
 */
router.get('/health', emailController.healthCheck);

/**
 * @route   POST /api/irn-drn-tracker/zoho/create-record
 * @desc    Create a single record in Zoho Creator
 */
router.post('/zoho/create-record', zohoController.createRecord);

/**
 * @route   GET /api/irn-drn-tracker/zoho/status
 * @desc    Check Zoho Creator configuration status
 */
router.get('/zoho/status', zohoController.status);

module.exports = router;
