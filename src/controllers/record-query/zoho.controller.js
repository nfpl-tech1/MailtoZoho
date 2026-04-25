/**
 * Zoho Controller for Record Query
 * Handles HTTP requests for Zoho Creator operations
 */

const { ZohoService } = require('../../services/common');
const config = require('../../config');

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
 * GET /api/record-query/zoho/debug-report
 * Debug endpoint to see what fields are available in a report
 * Query params: 
 *   ?beNumber=5936667 to search by BE number
 *   ?jobNo=52232 to search by Job number  
 *   ?report=Billing_manager to use a different report
 */
const debugReport = async (req, res, next) => {
    try {
        const service = getService();
        const { beNumber, jobNo, report } = req.query;
        const reportName = report || config.recordQuery.jobReportLinkName;
        
        console.log(`\n🔍 DEBUG: Fetching records from ${reportName}...`);
        
        let result;
        let criteria = '';
        
        if (beNumber) {
            // Try searching with criteria
            criteria = `BE_No == "${beNumber}"`;
            console.log(`   Searching with criteria: ${criteria}`);
            result = await service.getRecords({
                reportLinkName: reportName,
                criteria,
                limit: 10
            });
            
            // If no results, also try with numeric criteria (without quotes)
            if (result.data.length === 0) {
                const numericCriteria = `BE_No == ${beNumber}`;
                console.log(`   Trying numeric criteria: ${numericCriteria}`);
                result = await service.getRecords({
                    reportLinkName: reportName,
                    criteria: numericCriteria,
                    limit: 10
                });
                criteria = numericCriteria;
            }
            
            // Try contains operator
            if (result.data.length === 0) {
                const containsCriteria = `BE_No.contains("${beNumber}")`;
                console.log(`   Trying contains criteria: ${containsCriteria}`);
                result = await service.getRecords({
                    reportLinkName: reportName,
                    criteria: containsCriteria,
                    limit: 10
                });
                criteria = containsCriteria;
            }
        } else if (jobNo) {
            // Search by Job_No
            criteria = `Job_No == ${jobNo}`;
            console.log(`   Searching with criteria: ${criteria}`);
            result = await service.getRecords({
                reportLinkName: reportName,
                criteria,
                limit: 10
            });
            
            // Try string format
            if (result.data.length === 0) {
                const stringCriteria = `Job_No == "${jobNo}"`;
                console.log(`   Trying string criteria: ${stringCriteria}`);
                result = await service.getRecords({
                    reportLinkName: reportName,
                    criteria: stringCriteria,
                    limit: 10
                });
                criteria = stringCriteria;
            }
        } else {
            // Fetch first 10 records without criteria (for debugging)
            criteria = '';
            console.log(`   Fetching first 10 records without criteria`);
            result = await service.getRecords({
                reportLinkName: reportName,
                limit: 10
            });
        }

        if (result.success && result.data.length > 0) {
            const fieldNames = Object.keys(result.data[0]);
            
            res.json({
                success: true,
                reportName,
                criteriaUsed: criteria,
                recordCount: result.data.length,
                fieldNames,
                sampleRecords: result.data
            });
        } else {
            res.json({
                success: false,
                reportName,
                criteriaUsed: criteria,
                message: 'No records found with given criteria',
                error: result.error
            });
        }
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/record-query/zoho/create-record
 * Create a record in Record_query form
 */
const createRecord = async (req, res, next) => {
    try {
        const { jobNo, importer, mode, queryDate, query } = req.body;

        if (!jobNo || !queryDate || !query) {
            return res.status(400).json({
                success: false,
                message: 'jobNo, queryDate, and query are required in request body'
            });
        }

        const service = getService();
        
        const recordData = {
            Job_No: jobNo,
            Importer: importer || '',
            Mode: mode || '',
            Query_fields: [
                {
                    Query_date: queryDate,
                    Query_by: '',
                    Query: query,
                    Response: '',
                    Tags: '',
                    Keyword: ''
                }
            ]
        };

        const result = await service.createRecord({
            formLinkName: 'Record_query',
            data: recordData
        });

        res.json({
            success: result.success,
            message: result.success ? 'Record created successfully' : 'Failed to create record',
            isConfigured: service.isConfigured(),
            data: result
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/record-query/zoho/lookup-job/:beNumber
 * Lookup job details by BE Number
 */
const lookupJob = async (req, res, next) => {
    try {
        const { beNumber } = req.params;

        if (!beNumber) {
            return res.status(400).json({
                success: false,
                message: 'beNumber is required'
            });
        }

        const service = getService();
        const jobDetails = await service.lookupJobByBENumber(beNumber);

        if (!jobDetails) {
            return res.status(404).json({
                success: false,
                message: `No job found for BE_No: ${beNumber}`
            });
        }

        res.json({
            success: true,
            data: jobDetails
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/record-query/zoho/status
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

/**
 * GET /api/record-query/zoho/record/:recordId
 * Debug endpoint to fetch a single record by ID
 */
const getRecord = async (req, res, next) => {
    try {
        const { recordId } = req.params;
        const { report } = req.query;
        
        const service = getService();
        const reportName = report || process.env.RECORD_QUERY_REPORT_LINK_NAME || 'All_Record_Queries';
        
        const result = await service.getRecordById({
            reportLinkName: reportName,
            recordId
        });
        
        res.json({
            success: result.success,
            reportName,
            recordId,
            data: result.data,
            error: result.error
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createRecord,
    lookupJob,
    status,
    debugReport,
    getRecord
};
