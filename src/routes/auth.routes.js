/**
 * Authentication Routes
 * Handles settings page authentication
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

/**
 * @route   POST /api/auth/verify-settings-password
 * @desc    Verify password and get session token
 */
router.post('/verify-settings-password', authController.verifySettingsPassword);

/**
 * @route   POST /api/auth/verify-token
 * @desc    Verify if session token is still valid
 */
router.post('/verify-token', authController.verifyToken);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout and invalidate session token
 */
router.post('/logout', authController.logout);

/**
 * @route   POST /api/auth/change-password
 * @desc    Change settings password
 */
router.post('/change-password', authController.changePassword);

/**
 * @route   GET /api/auth/session-stats
 * @desc    Get session statistics (for debugging)
 */
router.get('/session-stats', authController.getSessionStats);

module.exports = router;
