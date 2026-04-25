/**
 * Zoho Routes (Legacy - for backward compatibility)
 * Redirects to IRN-DRN Tracker feature
 */

const express = require('express');
const router = express.Router();

// Import the new modular controller
const { zohoController } = require('../controllers/irn-drn-tracker');

/**
 * @route   POST /api/zoho/push-record
 * @desc    Legacy - use /api/irn-drn-tracker/process instead
 */
router.post('/push-record', (req, res) => {
    res.status(301).json({
        success: false,
        message: 'This endpoint is deprecated. Use POST /api/irn-drn-tracker/process instead.'
    });
});

/**
 * @route   POST /api/zoho/create-record
 * @desc    Create a single record in Zoho Creator
 */
router.post('/create-record', zohoController.createRecord);

/**
 * @route   GET /api/zoho/status
 * @desc    Check Zoho Creator configuration status
 */
router.get('/status', zohoController.status);

module.exports = router;
