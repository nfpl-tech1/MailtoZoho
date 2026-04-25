/**
 * Record Query Routes
 * Defines API endpoints for Record Query feature
 */

const express = require('express');
const router = express.Router();
const { emailController, zohoController } = require('../../controllers/record-query');

/**
 * @route   GET & POST /api/record-query/process
 * @desc    Process emails with "Outbound file generated" subject
 *          Parse attachments and submit to Zoho Record_query form
 *          GET - for cron jobs
 *          POST - for manual calls with optional overrides
 * @body    Optional: { hoursBack, maxResults, pushToZoho }
 * @returns Parsed email data and Zoho results
 */
router.get('/process', emailController.processEmails);
router.post('/process', emailController.processEmails);

/**
 * @route   GET /api/record-query/health
 * @desc    Check if service is healthy
 * @returns Health status
 */
router.get('/health', emailController.healthCheck);

/**
 * @route   GET /api/record-query/config
 * @desc    Get current Record Query configuration
 * @returns Current configuration
 */
router.get('/config', emailController.getConfig);

/**
 * @route   POST /api/record-query/test-parse
 * @desc    Test parsing a text file content (for debugging)
 * @body    { content: "text file content" }
 * @returns Parsed data
 */
router.post('/test-parse', emailController.testParse);

/**
 * @route   POST /api/record-query/zoho/create-record
 * @desc    Manually create a record in Record_query form
 * @body    { jobNo, importer, mode, queryDate, query }
 */
router.post('/zoho/create-record', zohoController.createRecord);

/**
 * @route   GET /api/record-query/zoho/lookup-job/:beNumber
 * @desc    Lookup job details by BE Number
 */
router.get('/zoho/lookup-job/:beNumber', zohoController.lookupJob);

/**
 * @route   GET /api/record-query/zoho/status
 * @desc    Check Zoho Creator configuration status
 */
router.get('/zoho/status', zohoController.status);

/**
 * @route   GET /api/record-query/zoho/debug-report
 * @desc    Debug endpoint to see actual field names in View_All_Jobs report
 */
router.get('/zoho/debug-report', zohoController.debugReport);

/**
 * @route   GET /api/record-query/zoho/record/:recordId
 * @desc    Get a single record by ID for debugging
 */
router.get('/zoho/record/:recordId', zohoController.getRecord);

module.exports = router;
