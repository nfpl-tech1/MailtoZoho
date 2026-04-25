/**
 * Configuration Routes
 * API routes for settings and cron job management
 */

const express = require('express');
const router = express.Router();
const configController = require('../controllers/config.controller');

// Settings endpoints
router.get('/settings', configController.getSettings);
router.post('/settings', configController.updateSettings);
router.get('/settings/metadata', configController.getConfigMetadata);
router.get('/settings/effective', configController.getEffectiveConfig);

// Cron job endpoints
router.get('/cron/status', configController.getCronStatus);
router.post('/cron/sync', configController.syncCronJobs);
router.get('/cron/list', configController.listCronJobs);
router.get('/cron/auto-detect', configController.autoDetectCronJobs);

// Settings management
router.post('/settings/reset', configController.resetSettings);

// Test endpoints
router.get('/test/:service', configController.testConnection);

// Debug endpoint
router.get('/debug-cache', configController.debugCache);

module.exports = router;
