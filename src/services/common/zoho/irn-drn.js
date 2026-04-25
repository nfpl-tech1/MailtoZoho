/**
 * Zoho IRN-DRN Module
 * Operations specific to IRN-DRN Tracker: job lookup, push to Zoho
 */

const { getRecords, createRecord } = require('./records');

/**
 * Lookup Job record ID by Job_No
 * OPTIMIZED: Only searches View_All_Jobs (verified as the only report containing jobs)
 * Previous 5-strategy approach wasted 1.5+ seconds on reports that never contain jobs
 * 
 * @param {number} jobNo - The job number to lookup
 * @returns {string|null} - The record ID or null if not found
 */
async function lookupJobRecordId(jobNo) {
    console.log(`🔍 Looking up record ID for Job_No: ${jobNo}`);

    // OPTIMIZED: Use View_All_Jobs directly (verified via performance testing)
    // Previous strategies tried Book_Pre_Alert_Report, All_Jobs, Billing_manager - none worked
    const report = process.env.ZOHO_JOB_REPORT_LINK_NAME || 'View_All_Jobs';

    console.log(`   📋 Searching in ${report}`);
    const criteria = `Job_No == ${jobNo}`;

    const result = await getRecords({
        reportLinkName: report,
        criteria: criteria,
        limit: 1
    });

    if (result.success && result.data.length > 0) {
        const recordId = result.data[0].ID;
        console.log(`   ✅ Found: Record ID ${recordId}`);
        return recordId;
    }

    // If not found with numeric, try string (just in case field type varies)
    console.log(`   📋 Trying string format...`);
    const stringCriteria = `Job_No == "${jobNo}"`;

    const stringResult = await getRecords({
        reportLinkName: report,
        criteria: stringCriteria,
        limit: 1
    });

    if (stringResult.success && stringResult.data.length > 0) {
        const recordId = stringResult.data[0].ID;
        console.log(`   ✅ Found (string match): Record ID ${recordId}`);
        return recordId;
    }

    console.log(`   ℹ️ Job_No ${jobNo} not found in ${report}`);
    return null;
}

/**
 * Push parsed email data to Zoho Creator (IRN-DRN Tracker format)
 * @param {Array} parsedResults - The parsed email results array
 */
async function pushToZoho(parsedResults) {
    const results = [];

    console.log(`\n${'='.repeat(60)}`);
    console.log('📤 PUSHING TO ZOHO CREATOR');
    console.log(`${'='.repeat(60)}`);

    for (const record of parsedResults) {
        const jobNo = record.Job_No ? String(record.Job_No) : null;

        const zohoData = {
            DRN_no: record.DRN_no,
            SubForm: record.documents.map(doc => ({
                Document_name: doc.name,
                IRN: doc.irn,
                Document_type: doc.type
            }))
        };

        console.log(`\n📋 Pushing record (Job_No: ${jobNo} - skipped for lookup)`);
        console.log(`   DRN_no: ${record.DRN_no}`);
        console.log(`   Documents: ${record.documents.length}`);

        const result = await createRecord({
            data: zohoData
        });

        results.push({
            Job_No: jobNo,
            DRN_no: record.DRN_no,
            documentCount: record.documents.length,
            zohoResponse: result
        });
    }

    const successCount = results.filter(r => r.zohoResponse.success).length;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 ZOHO PUSH SUMMARY`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Total records: ${results.length}`);
    console.log(`Successful: ${successCount}`);
    console.log(`Failed: ${results.length - successCount}`);
    console.log(`${'='.repeat(60)}\n`);

    return {
        success: successCount === results.length,
        totalRecords: results.length,
        successCount,
        failedCount: results.length - successCount,
        results
    };
}

module.exports = {
    lookupJobRecordId,
    pushToZoho
};
