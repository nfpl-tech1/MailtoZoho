/**
 * Email Controller
 * Handles HTTP requests for email-related operations
 */

const EmailProcessor = require('../services/emailProcessor.service');
const { ZohoService } = require('../services/common');
const config = require('../config');

// Singleton instances
let emailProcessor = null;
let zohoService = null;

/**
 * Get or create EmailProcessor instance
 */
const getProcessor = async () => {
    if (!emailProcessor) {
        emailProcessor = new EmailProcessor();
        await emailProcessor.initialize();
    }
    return emailProcessor;
};

/**
 * Get or create ZohoService instance
 */
const getZohoService = () => {
    if (!zohoService) {
        zohoService = new ZohoService();
    }
    return zohoService;
};

/**
 * POST /api/email/process
 * Simple endpoint - uses config.json defaults, just call it!
 * Optional body params override config: { hoursBack, maxResults, pushToZoho }
 */
const processEmails = async (req, res, next) => {
    try {
        // Use config.json defaults, allow overrides from request body
        const hoursBack = req.body.hoursBack ?? config.email.hoursBack;
        const maxResults = req.body.maxResults ?? config.email.maxResults;
        const pushToZoho = req.body.pushToZoho ?? config.zoho.pushEnabled;
        const subjectKeywords = req.body.subjectKeywords ?? config.email.subjectKeywords;

        const processor = await getProcessor();
        
        const parseResult = await processor.fetchAndParseTables({
            subjectKeywords: Array.isArray(subjectKeywords) ? subjectKeywords : [subjectKeywords],
            hoursBack: parseInt(hoursBack, 10),
            maxResults: parseInt(maxResults, 10)
        });

        let zohoResult = null;

        // Push to Zoho if enabled and we have results
        if (pushToZoho && parseResult.results && parseResult.results.length > 0) {
            const zoho = getZohoService();
            zohoResult = await zoho.pushToZoho(parseResult.results);
        }

        res.json({
            success: true,
            message: parseResult.results.length > 0 
                ? `Processed ${parseResult.results.length} email(s)` 
                : 'No matching emails found',
            data: {
                parsed: parseResult,
                zoho: zohoResult
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/email/fetch-and-parse (legacy - kept for compatibility)
 */
const fetchAndParse = async (req, res, next) => {
    return processEmails(req, res, next);
};

/**
 * GET /api/email/config
 * Get current configuration
 */
const getConfig = async (req, res, next) => {
    try {
        res.json({
            success: true,
            config: {
                email: config.email,
                zoho: {
                    pushEnabled: config.zoho.pushEnabled,
                    formLinkName: config.zoho.formLinkName,
                    jobReportLinkName: config.zoho.jobReportLinkName
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/email/health
 * Check if email service is healthy
 */
const healthCheck = async (req, res, next) => {
    try {
        const processor = await getProcessor();
        const zoho = getZohoService();
        
        res.json({
            success: true,
            message: 'Email service is healthy',
            initialized: processor.initialized,
            zohoConfigured: zoho.isConfigured()
        });
    } catch (error) {
        res.status(503).json({
            success: false,
            message: 'Email service is not healthy',
            error: error.message
        });
    }
};

module.exports = {
    processEmails,
    fetchAndParse,
    getConfig,
    healthCheck
};
