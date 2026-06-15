/**
 * Routes Index
 * Aggregates all route modules (feature-based routing)
 */

const express = require('express');
const router = express.Router();

// Feature-based routes
const irnDrnTrackerRoutes = require('./irn-drn-tracker');
const recordQueryRoutes = require('./record-query');
const configRoutes = require('./config.routes');
const cronRoutes = require('./cron.routes');
const authRoutes = require('./auth.routes');
const inboxRoutes = require('./inbox.routes');

// Legacy routes (for backward compatibility)
const emailRoutes = require('./email.routes');
const zohoRoutes = require('./zoho.routes');

// =============================================================================
// FEATURE ROUTES (New modular structure)
// =============================================================================

// IRN-DRN Tracker feature
router.use('/irn-drn-tracker', irnDrnTrackerRoutes);

// Record Query feature
router.use('/record-query', recordQueryRoutes);

// Configuration & Settings
router.use('/config', configRoutes);

// Authentication
router.use('/auth', authRoutes);

// Cron endpoints (for cron-job.org)
router.use('/cron', cronRoutes);

// Inbox management
router.use('/inboxes', inboxRoutes);

// =============================================================================
// LEGACY ROUTES (For backward compatibility - redirects to IRN-DRN Tracker)
// =============================================================================

router.use('/email', emailRoutes);
router.use('/zoho', zohoRoutes);

// =============================================================================
// API HEALTH CHECK
// =============================================================================

router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'API is running',
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        features: {
            'irn-drn-tracker': '/api/irn-drn-tracker',
            'record-query': '/api/record-query',
            'config': '/api/config',
            'cron': '/api/cron'
        }
    });
});

module.exports = router;
