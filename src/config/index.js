/**
 * Application Configuration
 * Centralized configuration management - all from .env
 */

require('dotenv').config();

// Helper to parse comma-separated values
const parseList = (str, defaultVal = []) => {
    if (!str) return defaultVal;
    return str.split(',').map(s => s.trim()).filter(Boolean);
};

const config = {
    // Server Configuration
    server: {
        port: parseInt(process.env.PORT, 10) || 3000,
        env: process.env.NODE_ENV || 'development'
    },

    // ==========================================================================
    // IRN-DRN Tracker Configuration
    // ==========================================================================
    email: {
        subjectKeywords: parseList(process.env.EMAIL_SUBJECT_KEYWORDS, ['Document upload confirmation']),
        hoursBack: parseInt(process.env.EMAIL_HOURS_BACK, 10) || 24,
        maxResults: parseInt(process.env.EMAIL_MAX_RESULTS, 10) || 20
    },

    // ==========================================================================
    // Record Query Configuration
    // ==========================================================================
    recordQuery: {
        subjectKeyword: process.env.RECORD_QUERY_SUBJECT_KEYWORD || 'Outbound file generated',
        hoursBack: parseInt(process.env.RECORD_QUERY_HOURS_BACK, 10) || 24,
        maxResults: parseInt(process.env.RECORD_QUERY_MAX_RESULTS, 10) || 10,
        formLinkName: process.env.RECORD_QUERY_FORM_LINK_NAME || 'Record_query',
        jobReportLinkName: process.env.RECORD_QUERY_JOB_REPORT_LINK_NAME || 'View_All_Jobs',
        pushEnabled: process.env.RECORD_QUERY_PUSH_ENABLED !== 'false'
    },

    // Google OAuth2 Configuration
    google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost',
        accessToken: process.env.GOOGLE_ACCESS_TOKEN,
        refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
        tokenUri: process.env.GOOGLE_TOKEN_URI || 'https://oauth2.googleapis.com/token'
    },

    // Zoho Creator Configuration (shared)
    zoho: {
        clientId: process.env.ZOHO_CLIENT_ID,
        clientSecret: process.env.ZOHO_CLIENT_SECRET,
        refreshToken: process.env.ZOHO_REFRESH_TOKEN,
        accountOwner: process.env.ZOHO_ACCOUNT_OWNER,
        appLinkName: process.env.ZOHO_APP_LINK_NAME,
        formLinkName: process.env.ZOHO_FORM_LINK_NAME || 'IRN_DRN_Tracker',
        jobReportLinkName: process.env.ZOHO_JOB_REPORT_LINK_NAME || 'View_All_Jobs',
        accountsDomain: process.env.ZOHO_ACCOUNTS_DOMAIN || 'https://accounts.zoho.in',
        creatorDomain: process.env.ZOHO_CREATOR_DOMAIN || 'https://creatorapp.zoho.in',
        pushEnabled: process.env.ZOHO_PUSH_ENABLED !== 'false'
    },

    // CORS Configuration
    cors: {
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization']
    }
};

module.exports = config;
