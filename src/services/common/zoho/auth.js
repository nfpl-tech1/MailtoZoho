/**
 * Zoho Authentication Module
 * Handles token management and authentication
 */

const { getConfig, isConfigured } = require('./config');

// Token cache (shared across all calls)
let accessToken = null;
let tokenExpiry = null;

/**
 * Get access token (refresh if needed)
 * @returns {Promise<string>} Access token
 */
async function getAccessToken() {
    const config = getConfig();

    if (!isConfigured(config)) {
        throw new Error('Zoho Creator is not configured. Please set environment variables.');
    }

    // Check if we have a valid token
    if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
        return accessToken;
    }

    console.log('🔄 Refreshing Zoho access token...');

    try {
        const response = await fetch(`${config.zohoAccountsDomain}/oauth/v2/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                refresh_token: config.refreshToken,
                client_id: config.clientId,
                client_secret: config.clientSecret,
                grant_type: 'refresh_token'
            })
        });

        const data = await response.json();

        if (data.error) {
            throw new Error(`Zoho token refresh failed: ${data.error}`);
        }

        accessToken = data.access_token;
        // Token expires in 1 hour, refresh 5 minutes early
        tokenExpiry = Date.now() + ((data.expires_in || 3600) - 300) * 1000;

        console.log('✓ Zoho access token refreshed successfully');
        return accessToken;
    } catch (error) {
        console.error('❌ Failed to refresh Zoho token:', error.message);
        throw error;
    }
}

/**
 * Clear cached token (for testing or forced refresh)
 */
function clearTokenCache() {
    accessToken = null;
    tokenExpiry = null;
}

module.exports = {
    getAccessToken,
    clearTokenCache
};
