/**
 * Zoho Batch Lookup Module
 * Optimized batch operations for looking up multiple records in single API calls
 */

const { getConfig, isConfigured } = require('./config');
const { getAccessToken } = require('./auth');
const { getRecords } = require('./records');

/**
 * BATCH: Lookup multiple Jobs by BE Numbers in a single API call
 * @param {Array<string>} beNumbers - Array of BE Numbers to lookup
 * @param {string} reportLinkName - Optional report name override
 * @returns {Map<string, Object>} - Map of BE Number -> Job details
 */
async function batchLookupJobsByBENumbers(beNumbers, reportLinkName = null) {
    if (!beNumbers || beNumbers.length === 0) {
        return new Map();
    }

    console.log(`🔍 Batch looking up ${beNumbers.length} Jobs by BE Numbers`);

    const report = reportLinkName || process.env.RECORD_QUERY_JOB_REPORT_LINK_NAME || 'View_All_Jobs';

    // Build OR criteria: (BE_No == 123 || BE_No == 456 || ...)
    const criteria = '(' + beNumbers.map(be => `BE_No == ${be}`).join(' || ') + ')';
    console.log(`   Criteria: ${criteria}`);

    const result = await getRecords({
        reportLinkName: report,
        criteria,
        limit: beNumbers.length + 10 // Extra buffer
    });

    const jobsMap = new Map();

    if (result.success && result.data.length > 0) {
        console.log(`   ✓ Found ${result.data.length} job(s)`);

        for (const record of result.data) {
            const beNo = String(record.BE_No || '');

            let jobNo = record.Job_No || '';
            if (typeof jobNo === 'object' && jobNo.display_value) {
                jobNo = jobNo.display_value;
            }

            let importer = record.Importer || '';
            if (typeof importer === 'object' && importer.display_value) {
                importer = importer.display_value;
            }

            jobsMap.set(beNo, {
                ID: record.ID,
                Job_No: jobNo,
                Importer: importer,
                Mode: record.Mode || '',
                BE_No: beNo
            });
        }
    }

    console.log(`   ✓ Mapped ${jobsMap.size} jobs`);
    return jobsMap;
}

/**
 * BATCH: Lookup multiple Record Queries by Job Record IDs in a single API call
 * Uses API v2.1 to get FULL subform data (Response, Tags, Keyword, etc.)
 * @param {Array<string>} jobRecordIds - Array of Job Record IDs to lookup
 * @param {string} reportLinkName - Optional report name override
 * @returns {Map<string, Object>} - Map of Job Record ID -> Record Query details (with FULL subform data)
 */
async function batchLookupRecordQueriesByJobIds(jobRecordIds, reportLinkName = null) {
    if (!jobRecordIds || jobRecordIds.length === 0) {
        return new Map();
    }

    console.log(`🔍 Batch looking up ${jobRecordIds.length} Record Queries by Job IDs`);

    const config = getConfig();
    const report = reportLinkName || process.env.RECORD_QUERY_REPORT_LINK_NAME || 'All_Record_Queries';

    // Build OR criteria: (Job_No == id1 || Job_No == id2 || ...)
    const criteria = '(' + jobRecordIds.map(id => `Job_No == ${id}`).join(' || ') + ')';
    console.log(`   Criteria: ${criteria}`);

    // Use API v2.1 to get FULL subform data (Response, Tags, Keyword, etc.)
    // This allows us to skip individual getRecordById calls later
    const accessToken = await getAccessToken();
    const limit = jobRecordIds.length + 10;
    const url = `${config.zohoCreatorDomain}/api/v2.1/${config.accountOwner}/${config.appLinkName}/report/${report}?limit=${limit}&criteria=${encodeURIComponent(criteria)}`;

    console.log(`📥 Fetching records via API v2.1 for full subform data`);
    console.log(`   URL: ${url}`);

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Zoho-oauthtoken ${accessToken}`
            }
        });

        const result = await response.json();
        console.log(`   Response status: ${response.status}`);
        console.log(`   Response code: ${result.code}`);

        const recordQueriesMap = new Map();

        if ((result.code === 3000 || response.ok) && result.data && result.data.length > 0) {
            console.log(`   ✓ Found ${result.data.length} existing Record Query(ies)`);

            // Check if we got full subform data
            if (result.data[0]?.Query_fields?.[0]) {
                const sampleKeys = Object.keys(result.data[0].Query_fields[0]);
                console.log(`   Subform fields in batch: ${sampleKeys.join(', ')}`);
            }

            for (const record of result.data) {
                // Job_No is a lookup field, extract the ID
                let jobId = record.Job_No;
                if (typeof jobId === 'object') {
                    jobId = jobId.ID || jobId.display_value;
                }
                jobId = String(jobId);

                let jobNoDisplay = record.Job_No;
                if (typeof jobNoDisplay === 'object' && jobNoDisplay.display_value) {
                    jobNoDisplay = jobNoDisplay.display_value;
                }

                recordQueriesMap.set(jobId, {
                    ID: record.ID,
                    Job_No: jobNoDisplay,
                    Importer: record.Importer,
                    Mode: record.Mode,
                    Query_fields: record.Query_fields || [],
                    _hasFullSubformData: true  // Flag to indicate we have full subform data from v2.1
                });
            }
        } else {
            console.log(`   ℹ️ No existing Record Queries found`);
        }

        console.log(`   ✓ Mapped ${recordQueriesMap.size} Record Queries`);
        return recordQueriesMap;
    } catch (error) {
        console.error('❌ Failed to batch lookup Record Queries:', error.message);
        return new Map();
    }
}

/**
 * Query View_All_Jobs report by BE Number to get Job details (single lookup)
 * @param {string} beNumber - The BE Number to lookup
 * @param {string} reportLinkName - Optional report name override
 * @returns {Object|null} - Job details (Job_No, Importer, Mode) or null
 */
async function lookupJobByBENumber(beNumber, reportLinkName = null) {
    console.log(`🔍 Looking up Job details for BE_No: ${beNumber}`);

    const report = reportLinkName || process.env.RECORD_QUERY_JOB_REPORT_LINK_NAME || 'View_All_Jobs';

    const criteria = `BE_No == ${beNumber}`;
    console.log(`   Criteria: ${criteria}`);

    const result = await getRecords({
        reportLinkName: report,
        criteria,
        limit: 1
    });

    if (result.success && result.data.length > 0) {
        const record = result.data[0];
        console.log(`   ✓ Found record with keys: ${Object.keys(record).join(', ')}`);

        const recordId = record.ID;

        let jobNo = record.Job_No || record.Job_no || record.JobNo || record.job_no || '';
        if (typeof jobNo === 'object' && jobNo.display_value) {
            jobNo = jobNo.display_value;
        }

        let importer = record.Importer || record.importer || '';
        if (typeof importer === 'object' && importer.display_value) {
            importer = importer.display_value;
        }

        const mode = record.Mode || record.mode || '';
        const beNo = record.BE_No || record.BE_Number || record.BENo || record.be_no || beNumber;

        const jobDetails = {
            ID: recordId,
            Job_No: jobNo,
            Importer: importer,
            Mode: mode,
            BE_No: beNo
        };
        console.log(`✓ Found Job details:`, jobDetails);
        return jobDetails;
    }

    console.log(`⚠️  No record found for BE_No: ${beNumber}`);
    return null;
}

/**
 * BATCH: Lookup multiple Jobs by Job Numbers in a single API call
 * OPTIMIZED: Uses View_All_Jobs (verified as only report containing jobs)
 * @param {Array<string|number>} jobNos - Array of Job Numbers to lookup
 * @param {string} reportLinkName - Optional report name override
 * @returns {Map<string, string>} - Map of Job_No -> Record ID
 */
async function batchLookupJobsByJobNos(jobNos, reportLinkName = null) {
    if (!jobNos || jobNos.length === 0) {
        return new Map();
    }

    // Filter out null/undefined
    const validJobNos = jobNos.filter(j => j);
    if (validJobNos.length === 0) return new Map();

    console.log(`🔍 Batch looking up ${validJobNos.length} Jobs by Job Numbers`);

    // OPTIMIZED: Use View_All_Jobs (verified via performance testing)
    const report = reportLinkName || process.env.ZOHO_JOB_REPORT_LINK_NAME || 'View_All_Jobs';
    const jobsMap = new Map();

    // 1. Numeric Search
    const numericJobNos = validJobNos.filter(j => !isNaN(j));

    if (numericJobNos.length > 0) {
        const criteria = '(' + numericJobNos.map(j => `Job_No == ${j}`).join(' || ') + ')';

        const result = await getRecords({
            reportLinkName: report,
            criteria,
            limit: numericJobNos.length + 10
        });

        if (result.success && result.data) {
            for (const record of result.data) {
                // Map both original format and string format
                const jobNoVal = record.Job_No;
                if (jobNoVal) {
                    jobsMap.set(String(jobNoVal), record.ID);
                    jobsMap.set(Number(jobNoVal), record.ID); // Support numeric lookup
                }
            }
        }
    }

    // 2. String Search (for remaining or non-numeric)
    // Find which ones we missed
    const missing = validJobNos.filter(j => !jobsMap.has(j) && !jobsMap.has(String(j)));

    if (missing.length > 0) {
        console.log(`   Trying string search for ${missing.length} missing Job Nos`);
        const criteria = '(' + missing.map(j => `Job_No == "${j}"`).join(' || ') + ')';

        const result = await getRecords({
            reportLinkName: report,
            criteria,
            limit: missing.length + 10
        });

        if (result.success && result.data) {
            for (const record of result.data) {
                const jobNoVal = record.Job_No;
                if (jobNoVal) {
                    jobsMap.set(String(jobNoVal), record.ID);
                }
            }
        }
    }

    console.log(`   ✓ Mapped ${jobsMap.size / 2} jobs (approx)`); // /2 because we doubled keys
    return jobsMap;
}

module.exports = {
    batchLookupJobsByBENumbers,
    batchLookupRecordQueriesByJobIds,
    lookupJobByBENumber,
    batchLookupJobsByJobNos
};
