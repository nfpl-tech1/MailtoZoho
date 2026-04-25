/**
 * Zoho Records Module
 * Basic CRUD operations: getRecords, getRecordById, createRecord, updateRecord
 */

const { getConfig, isConfigured } = require('./config');
const { getAccessToken } = require('./auth');

/**
 * Get records from a Zoho Creator form/report
 * @param {Object} options - Options for fetching records
 * @param {string} options.reportLinkName - The report link name in Zoho Creator
 * @param {string} options.criteria - Optional criteria to filter records (Zoho format)
 * @param {number} options.limit - Max records to return (default 200)
 */
async function getRecords(options) {
    const { reportLinkName, criteria = '', limit = 200 } = options;
    const config = getConfig();

    if (!isConfigured(config)) {
        console.log('⚠️  Zoho Creator not configured - cannot fetch records');
        return { success: false, error: 'Zoho not configured', data: [] };
    }

    try {
        const accessToken = await getAccessToken();
        let url = `${config.zohoCreatorDomain}/api/v2/${config.accountOwner}/${config.appLinkName}/report/${reportLinkName}?limit=${limit}`;

        if (criteria) {
            url += `&criteria=${encodeURIComponent(criteria)}`;
        }

        console.log(`📥 Fetching records from Zoho Creator: ${reportLinkName}`);
        console.log(`   URL: ${url}`);
        if (criteria) {
            console.log(`   Criteria: ${criteria}`);
        }

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Zoho-oauthtoken ${accessToken}`
            }
        });

        const result = await response.json();
        console.log(`   Response status: ${response.status}`);
        console.log(`   Response code: ${result.code}`);

        if (result.code === 3000 || response.ok) {
            const records = result.data || [];
            console.log(`✓ Fetched ${records.length} record(s) from ${reportLinkName}`);
            if (records.length > 0) {
                console.log(`   First record keys: ${Object.keys(records[0]).join(', ')}`);
            }
            return {
                success: true,
                data: records
            };
        } else {
            console.error('❌ Zoho Creator API error:', JSON.stringify(result, null, 2));
            return {
                success: false,
                error: result,
                data: []
            };
        }
    } catch (error) {
        console.error('❌ Failed to fetch records from Zoho:', error.message);
        return {
            success: false,
            error: error.message,
            data: []
        };
    }
}

/**
 * Get a single record by ID with full subform data
 * First tries API v2.1, then v2 FORM endpoint, then v2 REPORT endpoint
 * @param {Object} options - Options for fetching the record
 * @param {string} options.reportLinkName - The report link name in Zoho Creator
 * @param {string} options.formLinkName - Optional form link name
 * @param {string} options.recordId - The ID of the record to fetch
 * @returns {Object} - The full record data including subforms
 */
async function getRecordById(options) {
    const { reportLinkName, formLinkName, recordId } = options;
    const config = getConfig();

    if (!isConfigured(config)) {
        console.log('⚠️  Zoho Creator not configured - cannot fetch record');
        return { success: false, error: 'Zoho not configured', data: null };
    }

    try {
        const accessToken = await getAccessToken();

        // Derive form name from report name if not provided
        let formName = formLinkName;
        if (!formName && reportLinkName) {
            formName = reportLinkName.replace('_Report', '').replace('Testing_', '');
            formName = process.env.RECORD_QUERY_FORM_LINK_NAME || formName;
        }

        // Strategy 1: Try API v2.1 REPORT endpoint (returns FULL subform data)
        const v21Url = `${config.zohoCreatorDomain}/api/v2.1/${config.accountOwner}/${config.appLinkName}/report/${reportLinkName}/${recordId}`;
        console.log(`📥 Trying API v2.1 for full subform data: ${reportLinkName}/${recordId}`);
        console.log(`   URL: ${v21Url}`);

        let response = await fetch(v21Url, {
            method: 'GET',
            headers: {
                'Authorization': `Zoho-oauthtoken ${accessToken}`
            }
        });

        let result = await response.json();

        if (result.code === 3000 || (response.ok && result.data)) {
            console.log(`✓ Fetched record successfully via API v2.1`);
            console.log(`   Fields returned: ${Object.keys(result.data || {}).join(', ')}`);

            // Enrich subform rows with flat field values if present
            const data = result.data;
            if (data?.Query_fields && Array.isArray(data.Query_fields)) {
                console.log(`   Query_fields count: ${data.Query_fields.length}`);

                const fieldMappings = ['Response', 'Tags', 'Keyword', 'Query_by', 'Query_date', 'Query'];
                for (const fieldName of fieldMappings) {
                    const flatKey = `Query_fields.${fieldName}`;
                    if (data[flatKey]) {
                        console.log(`   Found flat field: ${flatKey} = ${JSON.stringify(data[flatKey])}`);
                        if (Array.isArray(data[flatKey])) {
                            data.Query_fields.forEach((row, idx) => {
                                if (data[flatKey][idx] !== undefined) {
                                    row[fieldName] = data[flatKey][idx];
                                }
                            });
                        }
                    }
                }

                if (data.Query_fields[0]) {
                    const firstRow = data.Query_fields[0];
                    console.log(`   First query row keys: ${Object.keys(firstRow).join(', ')}`);
                }
            }
            return {
                success: true,
                data: data
            };
        }

        console.log(`   API v2.1 returned: ${result.code}, trying v2 FORM endpoint...`);

        // Strategy 2: Try v2 FORM endpoint
        const formUrl = `${config.zohoCreatorDomain}/api/v2/${config.accountOwner}/${config.appLinkName}/form/${formName}/${recordId}`;
        console.log(`📥 Trying v2 FORM endpoint: ${formName}/${recordId}`);
        console.log(`   URL: ${formUrl}`);

        response = await fetch(formUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Zoho-oauthtoken ${accessToken}`
            }
        });

        result = await response.json();

        if (result.code === 3000 || (response.ok && result.data)) {
            console.log(`✓ Fetched record successfully via FORM endpoint`);
            console.log(`   Fields returned: ${Object.keys(result.data || {}).join(', ')}`);
            return {
                success: true,
                data: result.data
            };
        }

        console.log(`   Form endpoint returned: ${result.code}, trying v2 report endpoint...`);

        // Strategy 3: Fallback to v2 REPORT endpoint
        const reportUrl = `${config.zohoCreatorDomain}/api/v2/${config.accountOwner}/${config.appLinkName}/report/${reportLinkName}/${recordId}`;
        console.log(`📥 Fallback: v2 REPORT endpoint: ${reportLinkName}/${recordId}`);
        console.log(`   URL: ${reportUrl}`);

        response = await fetch(reportUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Zoho-oauthtoken ${accessToken}`
            }
        });

        result = await response.json();

        if (result.code === 3000 || response.ok) {
            console.log(`✓ Fetched record successfully via v2 REPORT endpoint`);
            return {
                success: true,
                data: result.data
            };
        } else {
            console.error('❌ Zoho Creator API error:', JSON.stringify(result, null, 2));
            return {
                success: false,
                error: result,
                data: null
            };
        }
    } catch (error) {
        console.error('❌ Failed to fetch record from Zoho:', error.message);
        return {
            success: false,
            error: error.message,
            data: null
        };
    }
}

/**
 * Create a record in Zoho Creator
 * @param {Object} options - Options for creating the record
 * @param {string} options.formLinkName - The form link name in Zoho Creator
 * @param {Object} options.data - The record data to create
 */
async function createRecord(options) {
    const config = getConfig();
    const defaultFormLinkName = config.formLinkName;
    const { formLinkName = defaultFormLinkName, data } = options;

    if (!isConfigured(config)) {
        console.log('⚠️  Zoho Creator not configured - returning mock response');
        return {
            success: true,
            mock: true,
            message: 'Mock response - Zoho Creator not configured',
            data: {
                formLinkName,
                recordData: data,
                createdAt: new Date().toISOString(),
                mockRecordId: `MOCK_${Date.now()}`
            }
        };
    }

    try {
        const accessToken = await getAccessToken();
        const url = `${config.zohoCreatorDomain}/api/v2/${config.accountOwner}/${config.appLinkName}/form/${formLinkName}`;

        console.log(`📤 Creating record in Zoho Creator: ${formLinkName}`);
        console.log(`   URL: ${url}`);
        console.log(`   Data:`, JSON.stringify(data, null, 2));

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Zoho-oauthtoken ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ data })
        });

        const result = await response.json();

        if (result.code === 3000 || response.ok) {
            console.log('✓ Record created successfully in Zoho Creator');
            return {
                success: true,
                mock: false,
                data: result
            };
        } else {
            console.error('❌ Zoho Creator API error:', result);
            return {
                success: false,
                mock: false,
                error: result
            };
        }
    } catch (error) {
        console.error('❌ Failed to create record in Zoho:', error.message);
        return {
            success: false,
            mock: false,
            error: error.message
        };
    }
}

/**
 * Update a record in Zoho Creator
 * @param {Object} options - Options for updating the record
 * @param {string} options.reportLinkName - The report link name in Zoho Creator
 * @param {string} options.recordId - The ID of the record to update
 * @param {Object} options.data - The record data to update
 */
async function updateRecord(options) {
    const { reportLinkName, recordId, data } = options;
    const config = getConfig();

    if (!isConfigured(config)) {
        console.log('⚠️  Zoho Creator not configured - returning mock response');
        return {
            success: true,
            mock: true,
            message: 'Mock response - Zoho Creator not configured'
        };
    }

    try {
        const accessToken = await getAccessToken();
        const url = `${config.zohoCreatorDomain}/api/v2/${config.accountOwner}/${config.appLinkName}/report/${reportLinkName}/${recordId}`;

        console.log(`📝 Updating record in Zoho Creator: ${reportLinkName}/${recordId}`);
        console.log(`   URL: ${url}`);
        console.log(`   Data:`, JSON.stringify(data, null, 2));

        const response = await fetch(url, {
            method: 'PATCH',
            headers: {
                'Authorization': `Zoho-oauthtoken ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ data })
        });

        const result = await response.json();

        if (result.code === 3000 || response.ok) {
            console.log('✓ Record updated successfully in Zoho Creator');
            return {
                success: true,
                mock: false,
                data: result
            };
        } else {
            console.error('❌ Zoho Creator API error:', result);
            return {
                success: false,
                mock: false,
                error: result
            };
        }
    } catch (error) {
        console.error('❌ Failed to update record in Zoho:', error.message);
        return {
            success: false,
            mock: false,
            error: error.message
        };
    }
}

/**
 * Create multiple records in Zoho Creator using API v2.1 (batch)
 * OPTIMIZED: Creates up to 200 records in a single API call
 * @param {Object} options - Options for creating records
 * @param {string} options.formLinkName - The form link name in Zoho Creator
 * @param {Array} options.data - Array of record objects to create
 * @param {boolean} options.skipWorkflow - Optional, skip form workflows (default: false)
 * @returns {Object} - Result with success status and created record IDs
 */
async function createRecordsBatch(options) {
    const config = getConfig();
    const defaultFormLinkName = config.formLinkName;
    const { formLinkName = defaultFormLinkName, data, skipWorkflow = false } = options;

    if (!data || !Array.isArray(data) || data.length === 0) {
        return {
            success: false,
            error: 'No data provided for batch creation'
        };
    }

    if (data.length > 200) {
        console.warn(`⚠️  Batch size ${data.length} exceeds Zoho limit of 200. Truncating.`);
        data.length = 200;
    }

    if (!isConfigured(config)) {
        console.log('⚠️  Zoho Creator not configured - returning mock response');
        return {
            success: true,
            mock: true,
            message: 'Mock response - Zoho Creator not configured',
            data: data.map((record, i) => ({
                ...record,
                mockRecordId: `MOCK_BATCH_${Date.now()}_${i}`
            }))
        };
    }

    try {
        const accessToken = await getAccessToken();

        // Use API v2.1 for batch creation (supports up to 200 records)
        let url = `${config.zohoCreatorDomain}/api/v2.1/${config.accountOwner}/${config.appLinkName}/form/${formLinkName}`;

        if (skipWorkflow) {
            url += '?skip_workflow=all';
        }

        console.log(`📤 Batch creating ${data.length} records in Zoho Creator: ${formLinkName}`);
        console.log(`   URL: ${url}`);
        console.log(`   Records to create: ${data.length}`);

        const startTime = Date.now();

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Zoho-oauthtoken ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ data })
        });

        const duration = Date.now() - startTime;
        const result = await response.json();

        console.log(`   Response received in ${(duration / 1000).toFixed(2)}s`);
        console.log(`   Response code: ${result.code}`);

        if (result.code === 3000 || response.ok) {
            // Count successes and failures from the result array
            const results = result.result || [];
            const successCount = results.filter(r => r.code === 3000).length;
            const failedCount = results.length - successCount;

            console.log(`✓ Batch creation complete: ${successCount} success, ${failedCount} failed`);

            return {
                success: successCount > 0,
                mock: false,
                totalRequested: data.length,
                successCount,
                failedCount,
                duration,
                results: results.map((r, i) => ({
                    index: i,
                    success: r.code === 3000,
                    recordId: r.data?.ID,
                    message: r.message,
                    code: r.code
                }))
            };
        } else {
            console.error('❌ Zoho Creator batch API error:', result);
            return {
                success: false,
                mock: false,
                error: result
            };
        }
    } catch (error) {
        console.error('❌ Failed to batch create records in Zoho:', error.message);
        return {
            success: false,
            mock: false,
            error: error.message
        };
    }
}

module.exports = {
    getRecords,
    getRecordById,
    createRecord,
    createRecordsBatch,
    updateRecord
};
