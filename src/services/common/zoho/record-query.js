/**
 * Zoho Record Query Module
 * Operations specific to Record_query form: lookup, addQuery
 */

const { getRecords, getRecordById, updateRecord } = require('./records');

/**
 * Lookup existing Record_query by Job Record ID (from View_All_Jobs)
 * Optimized: Uses record ID directly for lookup field matching (1 API call)
 * @param {string} jobRecordId - The Job record ID (e.g., "340763000000912031")
 * @param {string} jobNoDisplay - The Job_No display value for logging
 * @param {string} reportLinkName - The report to search in
 * @returns {Object|null} - Existing record with ID and Query_fields, or null
 */
async function lookupRecordQueryByJobId(jobRecordId, jobNoDisplay = '', reportLinkName = null) {
    console.log(`🔍 Looking up existing Record_query for Job ID: ${jobRecordId} (Job_No: ${jobNoDisplay})`);

    const report = reportLinkName || process.env.RECORD_QUERY_REPORT_LINK_NAME || 'All_Record_Queries';
    console.log(`   Report: ${report}`);

    // Lookup fields store record ID internally
    const criteria = `Job_No == ${jobRecordId}`;
    console.log(`   Criteria: ${criteria}`);

    const result = await getRecords({
        reportLinkName: report,
        criteria,
        limit: 1
    });

    if (result.success && result.data.length > 0) {
        const record = result.data[0];

        let jobNoValue = record.Job_No;
        if (typeof jobNoValue === 'object' && jobNoValue.display_value) {
            jobNoValue = jobNoValue.display_value;
        }

        console.log(`   ✓ Found existing Record_query with ID: ${record.ID}`);
        console.log(`   ✓ Job_No: ${jobNoValue}`);
        console.log(`   ✓ Existing Query_fields count: ${record.Query_fields?.length || 0}`);

        return {
            ID: record.ID,
            Job_No: jobNoValue,
            Importer: record.Importer,
            Mode: record.Mode,
            Query_fields: record.Query_fields || []
        };
    }

    console.log(`   ℹ️ No existing Record_query found for Job ID: ${jobRecordId}`);
    return null;
}

/**
 * @deprecated Use lookupRecordQueryByJobId instead for better performance
 * Lookup existing Record_query by Job_No display value (legacy - 3 API calls)
 */
async function lookupRecordQueryByJobNo(jobNo, reportLinkName = null) {
    console.log(`⚠️ lookupRecordQueryByJobNo is deprecated. Use lookupRecordQueryByJobId for better performance.`);

    const report = reportLinkName || process.env.RECORD_QUERY_REPORT_LINK_NAME || 'All_Record_Queries';

    const result = await getRecords({
        reportLinkName: report,
        limit: 200
    });

    if (result.success && result.data.length > 0) {
        const matchingRecord = result.data.find(record => {
            let recordJobNo = record.Job_No;
            if (typeof recordJobNo === 'object' && recordJobNo.display_value) {
                recordJobNo = recordJobNo.display_value;
            }
            return String(recordJobNo) === String(jobNo);
        });

        if (matchingRecord) {
            let jobNoValue = matchingRecord.Job_No;
            if (typeof jobNoValue === 'object' && jobNoValue.display_value) {
                jobNoValue = jobNoValue.display_value;
            }
            return {
                ID: matchingRecord.ID,
                Job_No: jobNoValue,
                Importer: matchingRecord.Importer,
                Mode: matchingRecord.Mode,
                Query_fields: matchingRecord.Query_fields || []
            };
        }
    }
    return null;
}

/**
 * Add a new query to an existing Record_query's subform
 * Preserves ALL existing fields (Response, Tags, Keyword, Query_by)
 * @param {string} recordId - The Record_query record ID
 * @param {Object} queryData - The query data to add (Query_date, Query, etc.)
 * @param {Array} existingQueryFields - Existing Query_fields from cache/batch lookup
 * @param {string} reportLinkName - The report link name
 * @param {boolean} hasFullSubformData - If true, skip getRecordById (data from v2.1 batch)
 * @returns {Object} - Result of the update operation
 */
async function addQueryToRecordQuery(recordId, queryData, existingQueryFields = [], reportLinkName = null, hasFullSubformData = false) {
    console.log(`📝 Adding query to existing Record_query: ${recordId}`);

    const report = reportLinkName || process.env.RECORD_QUERY_REPORT_LINK_NAME || 'All_Record_Queries';

    let allQueries = [];
    let fullQueryFields = [];

    // OPTIMIZATION: If batch lookup provided full subform data, skip getRecordById
    if (hasFullSubformData && existingQueryFields.length > 0) {
        console.log(`   ✓ Using cached batch lookup data (SKIPPING getRecordById API call)`);
        console.log(`   📊 API calls saved: 1`);
        fullQueryFields = existingQueryFields;
        console.log(`   ✓ Using ${fullQueryFields.length} existing query entries from batch cache`);
    } else {
        // Need to fetch full record data via API
        console.log(`   Fetching full record data to preserve all existing fields...`);

        const fullRecordResult = await getRecordById({
            reportLinkName: report,
            recordId
        });

        if (fullRecordResult.success && fullRecordResult.data) {
            const fullRecord = fullRecordResult.data;
            console.log(`   DEBUG: Full record keys: ${Object.keys(fullRecord).join(', ')}`);
            console.log(`   DEBUG: Query_fields raw:`, JSON.stringify(fullRecord.Query_fields, null, 2));
            fullQueryFields = fullRecord.Query_fields || [];

            // If API returned empty but we have cached data, use cache
            if (fullQueryFields.length === 0 && existingQueryFields.length > 0) {
                console.log(`   ⚠️ getRecordById returned empty Query_fields, using cached data instead`);
                fullQueryFields = existingQueryFields;
            }
            console.log(`   ✓ Fetched ${fullQueryFields.length} existing query entries`);
        } else {
            // Fallback to cached data
            console.log(`   ⚠️ Failed to fetch record, using cached data`);
            fullQueryFields = existingQueryFields;
        }
    }

    // Map existing queries preserving ALL fields
    console.log(`   ✓ Processing ${fullQueryFields.length} existing query entries with ALL fields`);
    allQueries = fullQueryFields.map(q => {
        const preservedQuery = {};

        // Always include required fields
        preservedQuery.Query_date = q.Query_date || '';
        preservedQuery.Query = q.Query || '';

        // Only include optional fields if they have values
        if (q.Query_by !== undefined && q.Query_by !== null) {
            preservedQuery.Query_by = q.Query_by;
        }
        if (q.Response !== undefined && q.Response !== null) {
            preservedQuery.Response = q.Response;
        }
        if (q.Tags !== undefined && q.Tags !== null) {
            preservedQuery.Tags = q.Tags;
        }
        if (q.Keyword !== undefined && q.Keyword !== null) {
            preservedQuery.Keyword = q.Keyword;
        }

        // Parse from display_value if needed
        if (!q.Query && q.zc_display_value) {
            const pipeIndex = q.zc_display_value.indexOf('|');
            if (pipeIndex > 0) {
                preservedQuery.Query_date = q.zc_display_value.substring(0, pipeIndex).trim();
                preservedQuery.Query = q.zc_display_value.substring(pipeIndex + 1).trim();
            }
        }

        if (!q.Query && q.display_value) {
            const pipeIndex = q.display_value.indexOf('|');
            if (pipeIndex > 0) {
                preservedQuery.Query_date = q.display_value.substring(0, pipeIndex).trim();
                preservedQuery.Query = q.display_value.substring(pipeIndex + 1).trim();
            }
        }

        const responsePreview = preservedQuery.Response ? preservedQuery.Response.substring(0, 20) : '(not in API)';
        console.log(`      Preserved: ${preservedQuery.Query_date} | Query: "${preservedQuery.Query?.substring(0, 30)}..." | Response: "${responsePreview}"`);

        return preservedQuery;
    });

    // Add new query
    allQueries.push(queryData);

    console.log(`   Total queries after merge: ${allQueries.length}`);
    console.log(`   Adding new query: ${queryData.Query_date} | ${queryData.Query}`);

    const data = {
        Query_fields: allQueries
    };

    console.log(`   Request data:`, JSON.stringify(data, null, 2));

    return await updateRecord({
        reportLinkName: report,
        recordId,
        data
    });
}

module.exports = {
    lookupRecordQueryByJobId,
    lookupRecordQueryByJobNo,
    addQueryToRecordQuery
};
