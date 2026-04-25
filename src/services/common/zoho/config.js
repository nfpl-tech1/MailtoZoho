/**
 * Zoho Configuration
 * Contains credentials and domain settings
 */

/**
 * Get Zoho configuration from environment variables
 * @returns {Object} Configuration object
 */
function getConfig() {
    return {
        clientId: process.env.ZOHO_CLIENT_ID,
        clientSecret: process.env.ZOHO_CLIENT_SECRET,
        refreshToken: process.env.ZOHO_REFRESH_TOKEN,
        accountOwner: process.env.ZOHO_ACCOUNT_OWNER,
        appLinkName: process.env.ZOHO_APP_LINK_NAME,
        formLinkName: process.env.ZOHO_FORM_LINK_NAME || 'Email_Records',
        zohoAccountsDomain: process.env.ZOHO_ACCOUNTS_DOMAIN || 'https://accounts.zoho.in',
        zohoCreatorDomain: process.env.ZOHO_CREATOR_DOMAIN || 'https://creatorapp.zoho.in'
    };
}

/**
 * Check if Zoho credentials are configured
 * @param {Object} config - Configuration object
 * @returns {boolean}
 */
function isConfigured(config) {
    return !!(
        config.clientId &&
        config.clientSecret &&
        config.refreshToken &&
        config.accountOwner &&
        config.appLinkName &&
        config.clientId !== 'your_zoho_client_id'
    );
}

module.exports = {
    getConfig,
    isConfigured
};
