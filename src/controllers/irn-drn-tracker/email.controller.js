/**
 * Email Controller for IRN-DRN Tracker
 * Handles HTTP requests for email-related operations
 */

const { EmailProcessor } = require('../../services/irn-drn-tracker');
const { ZohoService } = require('../../services/common');
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

const PENDING_RECORDS_KEY = 'IRN_DRN_PENDING_RECORDS';
const MAX_PENDING_RECORDS = 500;

const getRecordKey = (record) => {
    if (record.DRN_no) return `drn:${record.DRN_no}`;

    const documentsKey = (record.documents || [])
        .map(doc => `${doc.name || ''}|${doc.irn || ''}|${doc.type || ''}`)
        .join(';');

    return `fallback:${record.Job_No || 'no-job'}:${documentsKey}`;
};

const normalizePendingRecord = (record, reason = null) => {
    const now = new Date().toISOString();

    return {
        Job_No: record.Job_No || null,
        DRN_no: record.DRN_no || null,
        documents: Array.isArray(record.documents) ? record.documents : [],
        pendingReason: reason || record.pendingReason || null,
        pendingSince: record.pendingSince || now,
        lastSeenAt: now,
        attempts: Number(record.attempts || 0)
    };
};

const loadPendingRecords = (configService) => {
    const rawValue = configService.get(PENDING_RECORDS_KEY, '[]');

    try {
        const records = JSON.parse(rawValue);
        return Array.isArray(records)
            ? records.filter(record => record && Array.isArray(record.documents))
            : [];
    } catch (error) {
        console.warn(`Could not parse ${PENDING_RECORDS_KEY}; starting with empty queue: ${error.message}`);
        return [];
    }
};

const savePendingRecords = async (configService, pendingRecords) => {
    const recordsToSave = pendingRecords
        .slice(-MAX_PENDING_RECORDS)
        .map(record => normalizePendingRecord(record, record.pendingReason));

    if (!configService.isStorageAvailable()) {
        console.warn('Supabase not configured; pending IRN-DRN records cannot persist between runs');
        return false;
    }

    return configService.set(PENDING_RECORDS_KEY, JSON.stringify(recordsToSave));
};

const mergePendingWithCurrent = (pendingRecords, currentRecords) => {
    const merged = new Map();

    for (const record of pendingRecords) {
        merged.set(getRecordKey(record), normalizePendingRecord(record, record.pendingReason));
    }

    for (const record of currentRecords) {
        const key = getRecordKey(record);
        const previous = merged.get(key);

        merged.set(key, {
            ...normalizePendingRecord(record, previous?.pendingReason),
            pendingSince: previous?.pendingSince || new Date().toISOString(),
            attempts: previous?.attempts || 0
        });
    }

    return Array.from(merged.values());
};

/**
 * Push parsed results to Zoho Creator
 * OPTIMIZED: Uses batch record creation (API v2.1) - 1 API call instead of N
 * @param {Array} parsedResults - Parsed email results
 * @param {ZohoService} zoho - Zoho service instance
 * @param {string} formLinkName - Form link name from config
 */
const pushToZoho = async (parsedResults, zoho, formLinkName) => {
    console.log(`\n${'='.repeat(60)}`);
    console.log('📤 PUSHING TO ZOHO CREATOR (IRN-DRN Tracker) - BATCH MODE');
    console.log(`${'='.repeat(60)}`);

    // Step 1: Batch Lookup all Job_Nos (1 API call)
    const jobNosToLookup = parsedResults
        .map(r => r.Job_No)
        .filter(j => j);

    let jobsMap = new Map();
    if (jobNosToLookup.length > 0) {
        console.log(`\n📋 Batch looking up ${jobNosToLookup.length} Job Numbers...`);
        jobsMap = await zoho.batchLookupJobsByJobNos(jobNosToLookup);
        console.log(`   ✅ Found ${jobsMap.size / 2} jobs in batch lookup`);
    }

    // Step 2: Prepare all records for batch creation
    const recordsToCreate = [];
    const recordMeta = []; // Track metadata for result mapping
    const pendingRecords = [];

    for (const record of parsedResults) {
        let jobRecordId = null;

        // Check cache from batch lookup
        if (record.Job_No) {
            jobRecordId = jobsMap.get(String(record.Job_No)) || jobsMap.get(Number(record.Job_No));

            if (jobRecordId) {
                console.log(`   ✅ Job_No ${record.Job_No} → Record ID: ${jobRecordId}`);
            } else {
                // OPTIMIZED: Skip individual fallback (testing proved only batch works)
                console.log(`   ℹ️ Job_No ${record.Job_No} not found (job may not exist yet)`);
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

        // Transform to Zoho record format
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

    // Step 3: Batch create all records (1 API call instead of N!)
    console.log(`\n📤 Creating ${recordsToCreate.length} records in batch...`);

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

    // Step 4: Map batch results back to individual record info
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
    console.log(`📊 ZOHO PUSH SUMMARY (BATCH)`);
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

/**
 * POST /api/irn-drn-tracker/process
 * Process emails and optionally push to Zoho
 */
const processEmails = async (req, res, next) => {
    try {
        const configService = getConfigService();

        // IMPORTANT: Ensure config is loaded from Supabase (critical for serverless cold starts)
        await configService.ensureLoaded();

        // Get config values (Supabase overrides > ENV > defaults)
        const hoursBack = req.body.hoursBack ?? configService.getNumber('IRN_DRN_INTERVAL_HOURS', 3);
        const maxResults = req.body.maxResults ?? configService.getNumber('EMAIL_MAX_RESULTS', 20);
        const pushToZohoEnabled = req.body.pushToZoho ?? configService.getBoolean('ZOHO_PUSH_ENABLED', true);
        const subjectKeywordsStr = req.body.subjectKeywords ?? configService.get('EMAIL_SUBJECT_KEYWORDS', 'Document upload confirmation');
        const subjectKeywords = Array.isArray(subjectKeywordsStr)
            ? subjectKeywordsStr
            : subjectKeywordsStr.split(',').map(s => s.trim());

        // Log the config values being used (with source for debugging)
        console.log('\n' + '═'.repeat(70));
        console.log('🔧 IRN-DRN TRACKER - CONFIG VALUES BEING USED');
        console.log('═'.repeat(70));
        console.log('Config loaded:', configService.loaded ? 'YES' : 'NO');
        console.log('Cache keys:', Object.keys(configService.cache).length);
        console.log('─'.repeat(70));
        console.log(`IRN_DRN_INTERVAL_HOURS (hoursBack): ${hoursBack}`);
        console.log(`   ↳ Supabase: ${configService.cache['IRN_DRN_INTERVAL_HOURS'] || '(not set)'}`);
        console.log(`   ↳ ENV: ${process.env.IRN_DRN_INTERVAL_HOURS || '(not set)'}`);
        console.log(`EMAIL_MAX_RESULTS (maxResults): ${maxResults}`);
        console.log(`ZOHO_PUSH_ENABLED (pushToZoho): ${pushToZohoEnabled}`);
        console.log(`EMAIL_SUBJECT_KEYWORDS: ${subjectKeywords.join(', ')}`);
        console.log('═'.repeat(70) + '\n');

        const processor = await getProcessor();

        const parseResult = await processor.fetchAndParseTables({
            subjectKeywords,
            hoursBack: parseInt(hoursBack, 10),
            maxResults: parseInt(maxResults, 10)
        });

        let zohoResult = null;
        let pendingRecords = loadPendingRecords(configService);
        let pendingSaveResult = null;
        const parsedRecords = parseResult.results || [];
        const pendingBeforeCount = pendingRecords.length;

        // Push to Zoho if enabled and there are new or pending records to try.
        if (pushToZohoEnabled && (parsedRecords.length > 0 || pendingRecords.length > 0)) {
            const zoho = getZohoService();
            // Get formLinkName from Supabase config (not static config)
            const zohoFormLinkName = configService.get('ZOHO_FORM_LINK_NAME', config.zoho.formLinkName);
            console.log(`📌 Using Zoho Form: ${zohoFormLinkName}`);
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
                parsed: parseResult,
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

/**
 * GET /api/irn-drn-tracker/config
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
 * GET /api/irn-drn-tracker/health
 * Check if service is healthy
 */
const healthCheck = async (req, res, next) => {
    try {
        const processor = await getProcessor();
        const zoho = getZohoService();

        res.json({
            success: true,
            message: 'IRN-DRN Tracker service is healthy',
            initialized: processor.initialized,
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
