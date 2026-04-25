/**
 * eSanchit Backend - Main Entry Point
 * Express server for email table extraction and Zoho Creator integration
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { initializeConfig } = require('./services/common/config.service');

// Initialize Express app
const app = express();

// =============================================================================
// MIDDLEWARE
// =============================================================================

// Enable CORS
app.use(cors(config.cors));

// Parse JSON bodies
app.use(express.json({ limit: '10mb' }));

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Request logging (simple)
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} | ${req.method} ${req.path}`);
    next();
});

// =============================================================================
// ROUTES
// =============================================================================

// Root endpoint - redirect to settings UI
app.get('/', (req, res) => {
    // If requesting JSON (API client), return API info
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
        return res.json({
            name: 'eSanchit Backend',
            version: '2.0.0',
            description: 'Email processing and Zoho Creator integration service',
            settingsUI: '/settings.html',
            features: {
                'irn-drn-tracker': '/api/irn-drn-tracker',
                'record-query': '/api/record-query',
                'config': '/api/config'
            }
        });
    }
    // Otherwise redirect to settings page
    res.redirect('/settings.html');
});

// API routes
app.use('/api', routes);

// =============================================================================
// ERROR HANDLING
// =============================================================================

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

// =============================================================================
// SERVER START
// =============================================================================

const PORT = config.server.port;

// Initialize config from Supabase before starting server
initializeConfig().then(() => {
    app.listen(PORT, () => {
        console.log('\n' + '='.repeat(60));
        console.log('🚀 eSanchit Backend Server Started');
        console.log('='.repeat(60));
        console.log(`📍 URL: http://localhost:${PORT}`);
        console.log(`🌍 Environment: ${config.server.env}`);
        console.log('='.repeat(60));
        console.log('\n📋 Available Endpoints:');
        console.log(`   GET  /                                - API info`);
        console.log(`   GET  /api/health                      - Health check`);
        console.log(`   GET  /settings.html                   - Settings Dashboard`);
        console.log('\n   📁 IRN-DRN Tracker:');
        console.log(`   GET  /api/irn-drn-tracker/process     - Process emails (manual)`);
        console.log(`   POST /api/irn-drn-tracker/process     - Process emails`);
        console.log(`   GET  /api/irn-drn-tracker/health      - Service health`);
        console.log('\n   📁 Record Query:');
        console.log(`   GET  /api/record-query/process        - Process emails (manual)`);
        console.log(`   POST /api/record-query/process        - Process emails`);
        console.log(`   GET  /api/record-query/health         - Service health`);
        console.log('\n   ⏰ Cron Jobs (for cron-job.org):');
        console.log(`   POST /api/cron/irn-drn-tracker        - IRN-DRN cron endpoint`);
        console.log(`   POST /api/cron/record-query           - Record Query cron endpoint`);
        console.log('\n   ⚙️  Configuration:');
        console.log(`   GET  /api/config/settings             - Get settings`);
        console.log(`   POST /api/config/settings             - Update settings`);
        console.log(`   GET  /api/config/cron/status          - Cron job status`);
        console.log(`   POST /api/config/cron/sync            - Sync cron jobs`);
        console.log('='.repeat(60) + '\n');
    });
}).catch(err => {
    console.error('Failed to initialize config:', err);
    process.exit(1);
});

module.exports = app;
