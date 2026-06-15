const { RecordQueryEmailProcessor } = require('../../services/record-query');
const { ZohoService, GmailService, getNotificationService } = require('../../services/common');
const { getConfigService } = require('../../services/common/config.service');
const { getRecordQueryKey } = require('../../utils/record-query');
const { loadInboxes } = require('../inbox.controller');
const config = require('../../config');

let zohoService = null;

const getZohoService = () => {
    if (!zohoService) {
        zohoService = new ZohoService();
    }
    return zohoService;
};

const pushResultsToZoho = async (successfulParsed, zoho, formLinkName, reportLinkName) => {
    const zohoResults = [];
    const failuresForNotification = [];

    const beNumbers = successfulParsed.map(r => r.data.beNumber);
    const jobsMap = await zoho.batchLookupJobsByBENumbers(beNumbers);
    const jobRecordIds = Array.from(jobsMap.values()).map(j => j.ID);
    const recordQueriesMap = await zoho.batchLookupRecordQueriesByJobIds(jobRecordIds, reportLinkName);

    for (const result of successfulParsed) {
        const { beNumber, queryDate, query } = result.data;
        const jobDetails = jobsMap.get(beNumber);

        if (!jobDetails) {
            const errorMsg = `No job found in View_All_Jobs for BE_No: ${beNumber}`;
            zohoResults.push({ beNumber, success: false, error: errorMsg });
            failuresForNotification.push({ beNumber, queryDate, query, error: errorMsg, jobNo: null });
            continue;
        }

        const existingRecord = recordQueriesMap.get(jobDetails.ID);
        const queryData = { Query_date: queryDate, Query: query };
        let zohoResult;
        let action;

        if (existingRecord) {
            zohoResult = await zoho.addQueryToRecordQuery(
                existingRecord.ID,
                queryData,
                existingRecord.Query_fields || [],
                reportLinkName,
                existingRecord._hasFullSubformData || false
            );
            action = 'updated';
            if (zohoResult.success) {
                existingRecord.Query_fields = existingRecord.Query_fields || [];
                existingRecord.Query_fields.push(queryData);
            }
        } else {
            zohoResult = await zoho.createRecord({
                formLinkName,
                data: { Job_No: jobDetails.ID, Importer: jobDetails.Importer, Mode: jobDetails.Mode, Query_fields: [queryData] }
            });
            action = 'created';
            if (zohoResult.success && zohoResult.data?.data?.ID) {
                recordQueriesMap.set(jobDetails.ID, {
                    ID: zohoResult.data.data.ID,
                    Job_No: jobDetails.Job_No,
                    Query_fields: [queryData]
                });
            }
        }

        zohoResults.push({
            beNumber, jobNo: jobDetails.Job_No, importer: jobDetails.Importer, mode: jobDetails.Mode,
            queryDate, query, success: zohoResult.success, action,
            existingRecordId: existingRecord?.ID, zohoResponse: zohoResult
        });

        if (!zohoResult.success) {
            failuresForNotification.push({
                beNumber, queryDate, query,
                error: zohoResult.error?.message || JSON.stringify(zohoResult.error) || 'Unknown Zoho error',
                jobNo: jobDetails.Job_No
            });
        }
    }

    return { zohoResults, failuresForNotification };
};

const processEmails = async (req, res, next) => {
    try {
        const configService = getConfigService();
        await configService.ensureLoaded();

        const hoursBack = req.body.hoursBack ?? configService.getNumber('RECORD_QUERY_INTERVAL_HOURS', 3);
        const maxResults = req.body.maxResults ?? configService.getNumber('RECORD_QUERY_MAX_RESULTS', 30);
        const pushToZoho = req.body.pushToZoho ?? configService.getBoolean('RECORD_QUERY_PUSH_ENABLED', true);
        const formLinkName = configService.get('RECORD_QUERY_FORM_LINK_NAME', 'Record_query');
        const reportLinkName = configService.get('RECORD_QUERY_REPORT_LINK_NAME', 'Record_query_Report');

        const allInboxes = await loadInboxes();
        const inboxes = allInboxes.filter(inbox => inbox.record_query_enabled);
        console.log(`Processing ${inboxes.length} inbox(es) for Record Query`);

        const allResults = [];
        for (const inbox of inboxes) {
            console.log(`\nInbox: ${inbox.label || inbox.email}`);
            const gmailService = new GmailService({ user: inbox.email, password: inbox.app_password });
            const processor = new RecordQueryEmailProcessor(gmailService);
            await processor.initialize();
            const parseResult = await processor.fetchAndProcessEmails({
                hoursBack: parseInt(hoursBack, 10),
                maxResults: parseInt(maxResults, 10)
            });
            allResults.push(...(parseResult.results || []));
        }

        const dedupMap = new Map();
        for (const result of allResults) {
            if (!result.success) continue;
            const key = getRecordQueryKey(result.data);
            if (!dedupMap.has(key)) dedupMap.set(key, result);
        }
        const successfulParsed = Array.from(dedupMap.values());
        const failedParsed = allResults.filter(r => !r.success);

        const parseResult = {
            success: true,
            successCount: successfulParsed.length,
            results: [...successfulParsed, ...failedParsed]
        };

        if (parseResult.successCount === 0) {
            return res.json({ success: true, message: 'No emails processed successfully', data: { parsed: parseResult, zoho: null } });
        }

        let zohoResults = [];
        let failuresForNotification = [];

        if (pushToZoho) {
            const zoho = getZohoService();
            const pushed = await pushResultsToZoho(successfulParsed, zoho, formLinkName, reportLinkName);
            zohoResults = pushed.zohoResults;
            failuresForNotification = pushed.failuresForNotification;

            if (failuresForNotification.length > 0) {
                try {
                    const notificationService = await getNotificationService();
                    await notificationService.sendBatchFailureNotification(failuresForNotification, 'Record Query');
                } catch (notificationError) {
                    console.error(`Error sending notification: ${notificationError.message}`);
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

const healthCheck = async (req, res, next) => {
    try {
        const zoho = getZohoService();
        res.json({ success: true, message: 'Record Query service is healthy', zohoConfigured: zoho.isConfigured() });
    } catch (error) {
        res.status(503).json({ success: false, message: 'Record Query service is not healthy', error: error.message });
    }
};

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

const testParse = async (req, res, next) => {
    try {
        const { content } = req.body;

        if (!content) {
            return res.status(400).json({ success: false, message: 'content is required in request body' });
        }

        const { parseTextFile, validateParsedData } = require('../../utils/record-query');
        const parsedData = parseTextFile(content);
        const validation = validateParsedData(parsedData);

        res.json({ success: parsedData.success, parsed: parsedData, validation });
    } catch (error) {
        next(error);
    }
};

module.exports = { processEmails, healthCheck, getConfig, testParse };
