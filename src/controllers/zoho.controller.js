/**
 * Zoho Controller
 * Handles HTTP requests for Zoho Creator operations
 */

const { ZohoService } = require('../services/common');

// Singleton instance of ZohoService
let zohoService = null;

/**
 * Get or create ZohoService instance
 */
const getService = () => {
    if (!zohoService) {
        zohoService = new ZohoService();
    }
    return zohoService;
};

/**
 * POST /api/zoho/push-record
 * Push parsed email data to Zoho Creator
 * For testing, returns the mock response
 */
const pushRecord = async (req, res, next) => {
    try {
        const { parsedData, formLinkName = 'Email_Records' } = req.body;

        if (!parsedData) {
            return res.status(400).json({
                success: false,
                message: 'parsedData is required in request body'
            });
        }

        const service = getService();
        
        const result = await service.pushEmailDataToZoho(parsedData);

        res.json({
            success: true,
            message: 'Data processed for Zoho Creator',
            isConfigured: service.isConfigured(),
            data: result
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/zoho/create-record
 * Create a single record in Zoho Creator
 */
const createRecord = async (req, res, next) => {
    try {
        const { formLinkName, data } = req.body;

        if (!formLinkName || !data) {
            return res.status(400).json({
                success: false,
                message: 'formLinkName and data are required in request body'
            });
        }

        const service = getService();
        
        const result = await service.createRecord({ formLinkName, data });

        res.json({
            success: true,
            message: 'Record creation processed',
            isConfigured: service.isConfigured(),
            data: result
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/zoho/status
 * Check Zoho Creator configuration status
 */
const status = async (req, res) => {
    const service = getService();
    
    res.json({
        success: true,
        isConfigured: service.isConfigured(),
        message: service.isConfigured() 
            ? 'Zoho Creator is configured' 
            : 'Zoho Creator is not configured. Set environment variables to enable.'
    });
};

module.exports = {
    pushRecord,
    createRecord,
    status
};
