/**
 * Authentication Controller
 * Handles password verification for settings page access
 */

const crypto = require('crypto');
const { getConfigService } = require('../services/common/config.service');

/**
 * Generate a simple session token
 */
function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Store active tokens in memory (expires on server restart)
 * In production, consider using Redis or database
 */
const activeSessions = new Map();

// Clean up expired tokens every hour
setInterval(() => {
    const now = Date.now();
    for (const [token, data] of activeSessions.entries()) {
        if (data.expiresAt < now) {
            activeSessions.delete(token);
        }
    }
}, 60 * 60 * 1000);

/**
 * Verify settings password
 * POST /api/auth/verify-settings-password
 */
async function verifySettingsPassword(req, res) {
    try {
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({
                success: false,
                error: 'Password is required'
            });
        }

        const configService = getConfigService();
        await configService.ensureLoaded();

        // Get configured password (from Supabase or .env)
        const correctPassword = configService.get('SETTINGS_PASSWORD', '');

        // If no password is configured, allow access
        if (!correctPassword) {
            console.log('⚠️ SETTINGS_PASSWORD not configured - allowing access without authentication');
            const token = generateToken();
            const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours

            activeSessions.set(token, {
                createdAt: Date.now(),
                expiresAt
            });

            return res.json({
                success: true,
                token,
                message: 'No password configured - access granted'
            });
        }

        // Verify password
        if (password === correctPassword) {
            // Generate session token
            const token = generateToken();
            const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours

            activeSessions.set(token, {
                createdAt: Date.now(),
                expiresAt
            });

            console.log(`✅ Settings access granted - Token: ${token.substring(0, 8)}...`);

            return res.json({
                success: true,
                token,
                expiresAt,
                message: 'Authentication successful'
            });
        } else {
            console.log('❌ Settings access denied - Invalid password');

            return res.status(401).json({
                success: false,
                error: 'Invalid password'
            });
        }
    } catch (error) {
        console.error('Error verifying password:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

/**
 * Verify session token
 * POST /api/auth/verify-token
 */
function verifyToken(req, res) {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({
                success: false,
                error: 'Token is required'
            });
        }

        const session = activeSessions.get(token);

        if (!session) {
            return res.status(401).json({
                success: false,
                error: 'Invalid or expired token'
            });
        }

        // Check if token is expired
        if (session.expiresAt < Date.now()) {
            activeSessions.delete(token);
            return res.status(401).json({
                success: false,
                error: 'Token expired'
            });
        }

        return res.json({
            success: true,
            valid: true,
            expiresAt: session.expiresAt
        });
    } catch (error) {
        console.error('Error verifying token:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

/**
 * Logout - invalidate token
 * POST /api/auth/logout
 */
function logout(req, res) {
    try {
        const { token } = req.body;

        if (token && activeSessions.has(token)) {
            activeSessions.delete(token);
            console.log(`🔓 Settings session logged out - Token: ${token.substring(0, 8)}...`);
        }

        return res.json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error) {
        console.error('Error during logout:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

/**
 * Get session stats (for debugging)
 */
function getSessionStats(req, res) {
    const now = Date.now();
    const sessions = Array.from(activeSessions.values());

    const stats = {
        totalSessions: activeSessions.size,
        activeSessions: sessions.filter(s => s.expiresAt > now).length,
        expiredSessions: sessions.filter(s => s.expiresAt <= now).length
    };

    res.json({
        success: true,
        stats
    });
}

/**
 * Change password
 * POST /api/auth/change-password
 */
async function changePassword(req, res) {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                error: 'Current password and new password are required'
            });
        }

        const configService = getConfigService();
        await configService.ensureLoaded();

        // Get current password from config
        const storedPassword = configService.get('SETTINGS_PASSWORD', '');

        // If no password is configured, allow setting one
        if (!storedPassword) {
            // Set new password in Supabase
            const result = await configService.set('SETTINGS_PASSWORD', newPassword);

            if (result) {
                console.log('✅ Initial password set successfully');

                // Clear all sessions
                activeSessions.clear();

                return res.json({
                    success: true,
                    message: 'Password set successfully'
                });
            } else {
                return res.status(500).json({
                    success: false,
                    error: 'Failed to set password'
                });
            }
        }

        // Verify current password
        if (currentPassword !== storedPassword) {
            console.log('❌ Password change failed - incorrect current password');
            return res.status(401).json({
                success: false,
                error: 'Current password is incorrect'
            });
        }

        // Update password in Supabase
        const result = await configService.set('SETTINGS_PASSWORD', newPassword);

        if (result) {
            console.log('✅ Password changed successfully');

            // Invalidate all active sessions to force re-login
            activeSessions.clear();
            console.log('🔓 All sessions invalidated');

            return res.json({
                success: true,
                message: 'Password changed successfully. Please login again.'
            });
        } else {
            return res.status(500).json({
                success: false,
                error: 'Failed to update password in database'
            });
        }
    } catch (error) {
        console.error('Error changing password:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

module.exports = {
    verifySettingsPassword,
    verifyToken,
    logout,
    getSessionStats,
    changePassword
};
