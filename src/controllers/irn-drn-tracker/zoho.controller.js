/**
 * Zoho Controller for IRN-DRN Tracker
 * Handles HTTP requests for Zoho Creator operations
 */

const { ZohoService } = require('../../services/common');

// Singleton instance
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
 * POST /api/irn-drn-tracker/zoho/create-record
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
 * GET /api/irn-drn-tracker/zoho/status
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
    createRecord,
    status
};
