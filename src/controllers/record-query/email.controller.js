/**
 * Email Controller for Record Query
 * Handles HTTP requests for email processing
 */

const { RecordQueryEmailProcessor } = require('../../services/record-query');
const { ZohoService, getNotificationService } = require('../../services/common');
const { getConfigService } = require('../../services/common/config.service');
const config = require('../../config');

// Singleton instances
let emailProcessor = null;
let zohoService = null;

/**
 * Get or create EmailProcessor instance
 */
const getProcessor = async () => {
    if (!emailProcessor) {
        emailProcessor = new RecordQueryEmailProcessor();
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
 * POST /api/record-query/process
 * Process emails and push to Zoho Record_query form
 */
const processEmails = async (req, res, next) => {
    try {
        const configService = getConfigService();

        // IMPORTANT: Ensure config is loaded from Supabase (critical for serverless cold starts)
        await configService.ensureLoaded();

        // Get config values (Supabase overrides > ENV > defaults)
        const hoursBack = req.body.hoursBack ?? configService.getNumber('RECORD_QUERY_INTERVAL_HOURS', 3);
        const maxResults = req.body.maxResults ?? configService.getNumber('RECORD_QUERY_MAX_RESULTS', 30);
        const pushToZoho = req.body.pushToZoho ?? configService.getBoolean('RECORD_QUERY_PUSH_ENABLED', true);
        const subjectKeyword = configService.get('RECORD_QUERY_SUBJECT_KEYWORD', 'Outbound file generated');
        const formLinkName = configService.get('RECORD_QUERY_FORM_LINK_NAME', 'Record_query');
        const jobReportLinkName = configService.get('RECORD_QUERY_JOB_REPORT_LINK_NAME', 'View_All_Jobs');
        const reportLinkName = configService.get('RECORD_QUERY_REPORT_LINK_NAME', 'Record_query_Report');

        // Log the config values being used (with source for debugging)
        console.log('\n' + '═'.repeat(70));
        console.log('🔧 RECORD QUERY - CONFIG VALUES BEING USED');
        console.log('═'.repeat(70));
        console.log('Config loaded:', configService.loaded ? 'YES' : 'NO');
        console.log('Cache keys:', Object.keys(configService.cache).length);
        console.log('─'.repeat(70));
        console.log(`RECORD_QUERY_INTERVAL_HOURS (hoursBack): ${hoursBack}`);
        console.log(`   ↳ Supabase: ${configService.cache['RECORD_QUERY_INTERVAL_HOURS'] || '(not set)'}`);
        console.log(`   ↳ ENV: ${process.env.RECORD_QUERY_INTERVAL_HOURS || '(not set)'}`);
        console.log(`RECORD_QUERY_MAX_RESULTS (maxResults): ${maxResults}`);
        console.log(`RECORD_QUERY_PUSH_ENABLED (pushToZoho): ${pushToZoho}`);
        console.log(`RECORD_QUERY_SUBJECT_KEYWORD: ${subjectKeyword}`);
        console.log(`RECORD_QUERY_FORM_LINK_NAME: ${formLinkName}`);
        console.log(`RECORD_QUERY_JOB_REPORT_LINK_NAME: ${jobReportLinkName}`);
        console.log(`RECORD_QUERY_REPORT_LINK_NAME: ${reportLinkName}`);
        console.log('═'.repeat(70) + '\n');

        const processor = await getProcessor();
        const zoho = getZohoService();

        // Step 1: Fetch and parse emails
        const parseResult = await processor.fetchAndProcessEmails({
            hoursBack: parseInt(hoursBack, 10),
            maxResults: parseInt(maxResults, 10)
        });

        if (!parseResult.success || parseResult.successCount === 0) {
            return res.json({
                success: true,
                message: 'No emails processed successfully',
                data: {
                    parsed: parseResult,
                    zoho: null
                }
            });
        }

        // Step 2: Process each successful result and push to Zoho
        const zohoResults = [];
        const successfulParsed = parseResult.results.filter(r => r.success);
        const failuresForNotification = []; // Track failures for email notification

        if (pushToZoho && successfulParsed.length > 0) {
            console.log(`\n${'='.repeat(60)}`);
            console.log('📤 PUSHING TO ZOHO CREATOR (Record Query) - BATCH MODE');
            console.log(`${'='.repeat(60)}`);

            // Step 2a: BATCH lookup all Jobs by BE Numbers (1 API call instead of N)
            const beNumbers = successfulParsed.map(r => r.data.beNumber);
            console.log(`\n📋 Batch looking up ${beNumbers.length} BE Numbers...`);
            const jobsMap = await zoho.batchLookupJobsByBENumbers(beNumbers);

            // Step 2b: BATCH lookup all existing Record Queries (1 API call instead of N)
            const jobRecordIds = Array.from(jobsMap.values()).map(j => j.ID);
            console.log(`📋 Batch looking up ${jobRecordIds.length} Record Queries...`);
            const recordQueriesMap = await zoho.batchLookupRecordQueriesByJobIds(jobRecordIds, reportLinkName);

            // Step 2c: Process each email with the cached data
            for (const result of successfulParsed) {
                const { beNumber, queryDate, query } = result.data;

                console.log(`\n📋 Processing BE Number: ${beNumber}`);

                // Get job details from cache (no API call)
                const jobDetails = jobsMap.get(beNumber);

                if (!jobDetails) {
                    console.log(`   ❌ No job found for BE_No: ${beNumber}`);
                    const errorMsg = `No job found in View_All_Jobs for BE_No: ${beNumber}`;

                    zohoResults.push({
                        beNumber,
                        success: false,
                        error: errorMsg
                    });

                    // Add to failures for email notification
                    failuresForNotification.push({
                        beNumber,
                        queryDate,
                        query,
                        error: errorMsg,
                        jobNo: null
                    });

                    continue;
                }

                console.log(`   ✓ Found Job Record ID: ${jobDetails.ID}`);
                console.log(`   ✓ Found Job: ${jobDetails.Job_No}`);
                console.log(`   ✓ Importer: ${jobDetails.Importer}`);
                console.log(`   ✓ Mode: ${jobDetails.Mode}`);

                // Get existing Record Query from cache (no API call)
                const existingRecord = recordQueriesMap.get(jobDetails.ID);

                // Prepare query data for subform - only include required fields
                // DON'T include empty strings for optional fields as Zoho will clear them
                const queryData = {
                    Query_date: queryDate,
                    Query: query
                    // Note: Query_by, Response, Tags, Keyword are intentionally omitted
                    // so Zoho doesn't clear any existing values in those fields
                };

                let zohoResult;
                let action;

                if (existingRecord) {
                    // Step 2c: UPDATE existing record - add new query to subform
                    console.log(`   📝 Record_query exists (ID: ${existingRecord.ID}), adding new query...`);
                    console.log(`      Existing queries: ${existingRecord.Query_fields?.length || 0}`);
                    console.log(`      Query Date: ${queryDate}`);
                    console.log(`      Query: ${query}`);

                    // Pass existing Query_fields to preserve them when adding new query
                    // The 5th parameter tells addQueryToRecordQuery to skip the getRecordById call
                    // if batch lookup already provided full subform data
                    zohoResult = await zoho.addQueryToRecordQuery(
                        existingRecord.ID,
                        queryData,
                        existingRecord.Query_fields || [],
                        reportLinkName,  // use configured report link name
                        existingRecord._hasFullSubformData || false  // skip API call if batch provided full data
                    );
                    action = 'updated';

                    // Update cache: add this query to existing record's Query_fields
                    // So subsequent emails for same Job in this batch will see updated data
                    // Store the FULL queryData object to preserve all fields correctly
                    if (zohoResult.success) {
                        existingRecord.Query_fields = existingRecord.Query_fields || [];
                        existingRecord.Query_fields.push(queryData);
                    }
                } else {
                    // Step 2c: CREATE new record
                    console.log(`   📤 Creating new Record_query...`);
                    console.log(`      Query Date: ${queryDate}`);
                    console.log(`      Query: ${query}`);

                    const recordData = {
                        Job_No: jobDetails.ID,  // Use record ID for lookup field
                        Importer: jobDetails.Importer,
                        Mode: jobDetails.Mode,
                        Query_fields: [queryData]
                    };

                    zohoResult = await zoho.createRecord({
                        formLinkName: formLinkName, // Use configService value, not static config
                        data: recordData
                    });
                    action = 'created';

                    // Update cache: add newly created record so subsequent emails 
                    // for same Job in this batch will UPDATE instead of CREATE duplicate
                    if (zohoResult.success && zohoResult.data?.data?.ID) {
                        const newRecordId = zohoResult.data.data.ID;
                        recordQueriesMap.set(jobDetails.ID, {
                            ID: newRecordId,
                            Job_No: jobDetails.Job_No,
                            Importer: jobDetails.Importer,
                            Mode: jobDetails.Mode,
                            Query_fields: [queryData]  // Store full query object to preserve all fields
                        });
                        console.log(`   📝 Cache updated: Job ${jobDetails.ID} → Record ${newRecordId}`);
                    }
                }

                zohoResults.push({
                    beNumber,
                    jobNo: jobDetails.Job_No,
                    importer: jobDetails.Importer,
                    mode: jobDetails.Mode,
                    queryDate,
                    query,
                    success: zohoResult.success,
                    action,
                    existingRecordId: existingRecord?.ID,
                    zohoResponse: zohoResult
                });

                if (zohoResult.success) {
                    console.log(`   ✅ Record ${action} successfully`);
                } else {
                    console.log(`   ❌ Failed to ${action.slice(0, -1)} record: ${JSON.stringify(zohoResult.error)}`);

                    // Add to failures for email notification
                    failuresForNotification.push({
                        beNumber,
                        queryDate,
                        query,
                        error: zohoResult.error?.message || JSON.stringify(zohoResult.error) || 'Unknown Zoho error',
                        jobNo: jobDetails.Job_No
                    });
                }
            }

            // Summary
            const successCount = zohoResults.filter(r => r.success).length;
            const createdCount = zohoResults.filter(r => r.success && r.action === 'created').length;
            const updatedCount = zohoResults.filter(r => r.success && r.action === 'updated').length;
            const failedCount = zohoResults.filter(r => !r.success).length;

            console.log(`\n${'='.repeat(60)}`);
            console.log(`📊 ZOHO PUSH SUMMARY`);
            console.log(`${'='.repeat(60)}`);
            console.log(`Total records: ${zohoResults.length}`);
            console.log(`Successful: ${successCount} (Created: ${createdCount}, Updated: ${updatedCount})`);
            console.log(`Failed: ${failedCount}`);
            console.log(`${'='.repeat(60)}\n`);

            // Send email notification for failures
            if (failuresForNotification.length > 0) {
                console.log(`\n📧 Sending failure notification email for ${failuresForNotification.length} failure(s)...`);
                try {
                    const notificationService = await getNotificationService();
                    const notificationResult = await notificationService.sendBatchFailureNotification(
                        failuresForNotification,
                        'Record Query'
                    );

                    if (notificationResult.success) {
                        console.log(`   ✅ Notification email sent successfully`);
                    } else {
                        console.log(`   ⚠️ Failed to send notification email: ${notificationResult.error}`);
                    }
                } catch (notificationError) {
                    console.error(`   ❌ Error sending notification: ${notificationError.message}`);
                }
            }
        }

        res.json({
            success: true,
            message: `Processed ${parseResult.successCount} email(s)`,
            data: {
                parsed: parseResult,
                zoho: {
                    totalRecords: zohoResults.length,
                    successCount: zohoResults.filter(r => r.success).length,
                    skippedCount: zohoResults.filter(r => r.skipped).length,
                    failedCount: zohoResults.filter(r => !r.success && !r.skipped).length,
                    results: zohoResults
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/record-query/health
 * Check if service is healthy
 */
const healthCheck = async (req, res, next) => {
    try {
        const processor = await getProcessor();
        const zoho = getZohoService();

        res.json({
            success: true,
            message: 'Record Query service is healthy',
            initialized: processor.initialized,
            zohoConfigured: zoho.isConfigured()
        });
    } catch (error) {
        res.status(503).json({
            success: false,
            message: 'Record Query service is not healthy',
            error: error.message
        });
    }
};

/**
 * GET /api/record-query/config
 * Get current Record Query configuration
 */
const getConfig = async (req, res, next) => {
    try {
        res.json({
            success: true,
            config: {
                subjectKeyword: config.recordQuery.subjectKeyword,
                hoursBack: config.recordQuery.hoursBack,
                maxResults: config.recordQuery.maxResults,
                formLinkName: config.recordQuery.formLinkName,
                jobReportLinkName: config.recordQuery.jobReportLinkName,
                pushEnabled: config.recordQuery.pushEnabled
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/record-query/test-parse
 * Test parsing a text file content (for debugging)
 */
const testParse = async (req, res, next) => {
    try {
        const { content } = req.body;

        if (!content) {
            return res.status(400).json({
                success: false,
                message: 'content is required in request body'
            });
        }

        const { parseTextFile, validateParsedData } = require('../../utils/record-query');

        const parsedData = parseTextFile(content);
        const validation = validateParsedData(parsedData);

        res.json({
            success: parsedData.success,
            parsed: parsedData,
            validation
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    processEmails,
    healthCheck,
    getConfig,
    testParse
};
