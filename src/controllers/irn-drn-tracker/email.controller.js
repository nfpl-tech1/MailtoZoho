const { EmailProcessor } = require('../../services/irn-drn-tracker');
const { ZohoService, GmailService } = require('../../services/common');
const { getConfigService } = require('../../services/common/config.service');
const {
    getRecordKey,
    normalizePendingRecord,
    loadPendingRecords,
    savePendingRecords,
    mergePendingWithCurrent
} = require('../../services/irn-drn-tracker/pendingBuffer.service');
const { loadInboxes } = require('../inbox.controller');
const config = require('../../config');

let zohoService = null;

const getZohoService = () => {
    if (!zohoService) {
        zohoService = new ZohoService();
    }
    return zohoService;
};

const pushToZoho = async (parsedResults, zoho, formLinkName) => {
    console.log(`\n${'='.repeat(60)}`);
    console.log('PUSHING TO ZOHO CREATOR (IRN-DRN Tracker) - BATCH MODE');
    console.log(`${'='.repeat(60)}`);

    const jobNosToLookup = parsedResults
        .map(r => r.Job_No)
        .filter(j => j);

    let jobsMap = new Map();
    if (jobNosToLookup.length > 0) {
        console.log(`\nBatch looking up ${jobNosToLookup.length} Job Numbers...`);
        jobsMap = await zoho.batchLookupJobsByJobNos(jobNosToLookup);
        console.log(`   Found ${jobsMap.size / 2} jobs in batch lookup`);
    }

    const recordsToCreate = [];
    const recordMeta = [];
    const pendingRecords = [];

    for (const record of parsedResults) {
        let jobRecordId = null;

        if (record.Job_No) {
            jobRecordId = jobsMap.get(String(record.Job_No)) || jobsMap.get(Number(record.Job_No));

            if (jobRecordId) {
                console.log(`   Job_No ${record.Job_No} -> Record ID: ${jobRecordId}`);
            } else {
                console.log(`   Job_No ${record.Job_No} not found (job may not exist yet)`);
            }
        }

        if (record.Job_No && !jobRecordId) {
            console.log(`   Holding DRN ${record.DRN_no || '(no DRN)'}: Job_No ${record.Job_No} not found in Zoho`);
            pendingRecords.push(normalizePendingRecord(record, 'job_lookup_failed'));
            continue;
        }

        if (!record.documents || record.documents.length === 0) {
            console.log(`   Holding DRN ${record.DRN_no || '(no DRN)'}: no documents parsed`);
            pendingRecords.push(normalizePendingRecord(record, 'no_documents'));
            continue;
        }

        const zohoData = {
            DRN_no: record.DRN_no,
            SubForm: record.documents.map(doc => ({
                Document_name: doc.name,
                IRN: doc.irn,
                Document_type: doc.type
            }))
        };

        if (jobRecordId) {
            zohoData.Job_No = jobRecordId;
        }

        recordsToCreate.push(zohoData);
        recordMeta.push({
            originalJobNo: record.Job_No,
            DRN_no: record.DRN_no,
            documentCount: record.documents.length,
            jobRecordId: jobRecordId || null,
            sourceRecord: record
        });
    }

    console.log(`\nCreating ${recordsToCreate.length} records in batch...`);

    const batchResult = recordsToCreate.length > 0
        ? await zoho.createRecordsBatch({
            formLinkName: formLinkName,
            data: recordsToCreate
        })
        : {
            success: pendingRecords.length === 0,
            results: [],
            duration: 0
        };

    const results = recordMeta.map((meta, index) => {
        const batchRecord = batchResult.results?.[index] || {};
        if (!batchRecord.success) {
            pendingRecords.push(normalizePendingRecord(meta.sourceRecord, 'zoho_create_failed'));
        }

        return {
            Job_No: meta.originalJobNo,
            DRN_no: meta.DRN_no,
            documentCount: meta.documentCount,
            jobRecordId: meta.jobRecordId,
            originalJobNo: meta.originalJobNo,
            jobLookupFailed: false,
            zohoResponse: {
                success: batchRecord.success || false,
                recordId: batchRecord.recordId,
                message: batchRecord.message
            }
        };
    });

    const successCount = results.filter(r => r.zohoResponse.success).length;
    const lookupFailedCount = pendingRecords.filter(r => r.pendingReason === 'job_lookup_failed').length;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`ZOHO PUSH SUMMARY (BATCH)`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Total parsed records considered: ${parsedResults.length}`);
    console.log(`Attempted creates: ${results.length}`);
    console.log(`Successful: ${successCount}`);
    console.log(`Failed: ${results.length - successCount}`);
    if (lookupFailedCount > 0) {
        console.log(`Held for missing Zoho job record: ${lookupFailedCount}`);
    }
    console.log(`Pending for retry/manual review: ${pendingRecords.length}`);
    console.log(`Batch API duration: ${batchResult.duration ? (batchResult.duration / 1000).toFixed(2) + 's' : 'N/A'}`);
    console.log(`${'='.repeat(60)}\n`);

    return {
        success: batchResult.success,
        totalRecords: parsedResults.length,
        attemptedRecords: results.length,
        successCount,
        failedCount: results.length - successCount,
        lookupFailedCount,
        pendingCount: pendingRecords.length,
        pendingRecords,
        batchDuration: batchResult.duration,
        results
    };
};

const processEmails = async (req, res, next) => {
    try {
        const configService = getConfigService();
        await configService.ensureLoaded();

        const hoursBack = req.body.hoursBack ?? configService.getNumber('IRN_DRN_INTERVAL_HOURS', 3);
        const maxResults = req.body.maxResults ?? configService.getNumber('EMAIL_MAX_RESULTS', 20);
        const pushToZohoEnabled = req.body.pushToZoho ?? configService.getBoolean('ZOHO_PUSH_ENABLED', true);
        const subjectKeywordsStr = req.body.subjectKeywords ?? configService.get('EMAIL_SUBJECT_KEYWORDS', 'Document upload confirmation');
        const subjectKeywords = Array.isArray(subjectKeywordsStr)
            ? subjectKeywordsStr
            : subjectKeywordsStr.split(',').map(s => s.trim());

        console.log('\n' + '='.repeat(70));
        console.log('IRN-DRN TRACKER - CONFIG VALUES BEING USED');
        console.log('='.repeat(70));
        console.log('Config loaded:', configService.loaded ? 'YES' : 'NO');
        console.log(`IRN_DRN_INTERVAL_HOURS (hoursBack): ${hoursBack}`);
        console.log(`EMAIL_MAX_RESULTS (maxResults): ${maxResults}`);
        console.log(`ZOHO_PUSH_ENABLED (pushToZoho): ${pushToZohoEnabled}`);
        console.log(`EMAIL_SUBJECT_KEYWORDS: ${subjectKeywords.join(', ')}`);
        console.log('='.repeat(70) + '\n');

        // Load inboxes and filter for IRN-DRN feature
        const allInboxes = await loadInboxes();
        const inboxes = allInboxes.filter(inbox => inbox.irn_drn_enabled);
        console.log(`Processing ${inboxes.length} inbox(es) for IRN-DRN Tracker`);

        // Fetch and parse emails from each inbox
        const allParsedResults = [];
        for (const inbox of inboxes) {
            console.log(`\nInbox: ${inbox.label || inbox.email}`);
            const gmailService = new GmailService({ user: inbox.email, password: inbox.app_password });
            const processor = new EmailProcessor(gmailService);
            await processor.initialize();

            const parseResult = await processor.fetchAndParseTables({
                subjectKeywords,
                hoursBack: parseInt(hoursBack, 10),
                maxResults: parseInt(maxResults, 10)
            });

            allParsedResults.push(...(parseResult.results || []));
        }

        // Dedup: first occurrence wins, keyed by getRecordKey
        const dedupMap = new Map();
        for (const record of allParsedResults) {
            const key = getRecordKey(record);
            if (!dedupMap.has(key)) {
                dedupMap.set(key, record);
            }
        }
        const parsedRecords = Array.from(dedupMap.values());

        let zohoResult = null;
        let pendingRecords = loadPendingRecords(configService);
        let pendingSaveResult = null;
        const pendingBeforeCount = pendingRecords.length;

        if (pushToZohoEnabled && (parsedRecords.length > 0 || pendingRecords.length > 0)) {
            const zoho = getZohoService();
            const zohoFormLinkName = configService.get('ZOHO_FORM_LINK_NAME', config.zoho.formLinkName);
            console.log(`Using Zoho Form: ${zohoFormLinkName}`);
            const recordsToProcess = mergePendingWithCurrent(pendingRecords, parsedRecords);
            console.log(`IRN-DRN pending queue: ${pendingRecords.length} existing + ${parsedRecords.length} current => ${recordsToProcess.length} unique record(s)`);

            zohoResult = await pushToZoho(recordsToProcess, zoho, zohoFormLinkName);
            pendingRecords = zohoResult.pendingRecords || [];
            pendingSaveResult = await savePendingRecords(configService, pendingRecords);
        }

        res.json({
            success: true,
            message: parsedRecords.length > 0
                ? `Processed ${parsedRecords.length} email(s)`
                : pendingBeforeCount > 0
                    ? `Retried ${pendingBeforeCount} pending record(s)`
                    : 'No matching emails found',
            data: {
                parsed: { results: parsedRecords, emailsProcessed: parsedRecords.length },
                zoho: zohoResult,
                pending: {
                    count: pendingRecords.length,
                    saved: pendingSaveResult,
                    records: pendingRecords.map(record => ({
                        Job_No: record.Job_No,
                        DRN_no: record.DRN_no,
                        documentCount: record.documents?.length || 0,
                        pendingReason: record.pendingReason,
                        pendingSince: record.pendingSince,
                        lastSeenAt: record.lastSeenAt,
                        attempts: record.attempts
                    }))
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

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

const healthCheck = async (req, res, next) => {
    try {
        const zoho = getZohoService();

        res.json({
            success: true,
            message: 'IRN-DRN Tracker service is healthy',
            zohoConfigured: zoho.isConfigured()
        });
    } catch (error) {
        res.status(503).json({
            success: false,
            message: 'IRN-DRN Tracker service is not healthy',
            error: error.message
        });
    }
};

module.exports = {
    processEmails,
    getConfig,
    healthCheck
};
