/**
 * Email Processor Service
 * Combines Gmail fetching with table parsing
 */

const { GmailService } = require('./common');
const { extractAndParseTables } = require('../utils/htmlTableParser');

class EmailProcessor {
    constructor() {
        this.gmailService = new GmailService();
        this.initialized = false;
    }

    /**
     * Initialize the processor
     */
    async initialize() {
        if (!this.initialized) {
            await this.gmailService.initialize();
            this.initialized = true;
        }
        return this;
    }

    /**
     * Extract Job ID (e.g., IR51921) from email data or tables
     * Pattern: IR followed by digits
     */
    extractJobId(emailData, tablesData) {
        const pattern = /IR\d+/;

        // 1. Check Subject
        const subjectMatch = emailData.subject.match(pattern);
        if (subjectMatch) {
            return subjectMatch[0];
        }

        // 2. Check Body (Plain text)
        if (emailData.body && typeof emailData.body === 'object') {
            const textBody = emailData.body.plain || emailData.body.display || '';
            const bodyMatch = textBody.match(pattern);
            if (bodyMatch) {
                return bodyMatch[0];
            }
        }

        // 3. Check Table Content
        for (const table of tablesData) {
            for (const row of table.data) {
                for (const value of Object.values(row)) {
                    if (typeof value === 'string') {
                        const tableMatch = value.match(pattern);
                        if (tableMatch) {
                            return tableMatch[0];
                        }
                    }
                }
            }
        }

        return null;
    }

    /**
     * Process document table and extract clean structured data
     * Returns: { DRN_no, documents: [{name, irn, type}] }
     */
    processDocumentTable(tableData) {
        let drnNo = null;
        const documents = [];
        let currentHeaders = null;

        // Reconstruct raw rows from the dictionary format
        const rawRows = [];
        for (const rowDict of tableData) {
            const values = [];
            let i = 1;
            while (true) {
                const key = `Column_${i}`;
                if (rowDict[key] !== undefined) {
                    values.push(rowDict[key]);
                    i++;
                } else {
                    break;
                }
            }
            if (values.length > 0) {
                rawRows.push(values);
            }
        }

        // Process the raw rows
        for (const row of rawRows) {
            // Case 1: DRN Row (Metadata) - extract DRN number
            if (row.length >= 1 && row[0].includes('DRN') && row[0].includes(':')) {
                const parts = row[0].split(':');
                if (parts.length >= 2) {
                    drnNo = parts.slice(1).join(':').trim();
                }
            }
            // Case 2: Header Row - identify column positions
            else if (row.includes('Document name')) {
                currentHeaders = row;
            }
            // Case 3: Data Row - extract document info
            else if (currentHeaders && row.length === currentHeaders.length) {
                const nameIdx = currentHeaders.indexOf('Document name');
                const irnIdx = currentHeaders.indexOf('IRN');
                const typeIdx = currentHeaders.indexOf('Document Type');

                if (nameIdx !== -1) {
                    documents.push({
                        name: row[nameIdx] || '',
                        irn: irnIdx !== -1 ? row[irnIdx] || '' : '',
                        type: typeIdx !== -1 ? row[typeIdx] || '' : ''
                    });
                }
            }
        }

        return { DRN_no: drnNo, documents };
    }

    /**
     * Extract Job Number from Job ID (e.g., IR51921 -> 51921)
     */
    extractJobNumber(jobId) {
        if (!jobId) return null;
        const match = jobId.match(/IR(\d+)/);
        return match ? parseInt(match[1], 10) : null;
    }

    /**
     * Fetch emails and extract all tables from them
     */
    async fetchAndParseTables(options = {}) {
        const {
            subjectKeywords = ['Document upload confirmation'],
            daysBack = 30,
            maxResults = 10
        } = options;

        console.log('=' .repeat(80));
        console.log('📧 EMAIL TABLE EXTRACTOR');
        console.log('=' .repeat(80));

        // Ensure initialized
        await this.initialize();

        // Fetch emails
        console.log(`\n🔍 Searching for emails with: ${subjectKeywords.join(', ')}`);
        const emails = await this.gmailService.fetchEmails({
            subjectKeywords,
            daysBack,
            maxResults
        });

        if (!emails || emails.length === 0) {
            console.log('❌ No emails found');
            return {
                success: true,
                emailsProcessed: 0,
                results: []
            };
        }

        console.log(`✓ Found ${emails.length} email(s)\n`);

        // Extract tables from each email
        const results = [];

        for (let idx = 0; idx < emails.length; idx++) {
            const email = emails[idx];
            console.log(`\n${'='.repeat(80)}`);
            console.log(`📧 Email ${idx + 1}/${emails.length}`);
            console.log(`${'='.repeat(80)}`);
            console.log(`Subject: ${email.subject}`);

            const body = email.body;

            // Check if email has HTML content
            if (body && typeof body === 'object' && body.html) {
                const htmlContent = body.html;

                // Extract tables
                const tables = extractAndParseTables(htmlContent);

                if (tables.tableCount > 0) {
                    console.log(`\n✓ Found ${tables.tableCount} table(s) in this email`);

                    // Extract Job ID first
                    const jobId = this.extractJobId(email, tables.tables);
                    const jobNo = this.extractJobNumber(jobId);
                    
                    if (jobId) {
                        console.log(`   🆔 Job ID found: ${jobId} (Job_No: ${jobNo})`);
                    } else {
                        console.log('   ⚠️  No Job ID found');
                    }

                    // Process tables and extract clean document data
                    let drnNo = null;
                    let allDocuments = [];

                    for (const table of tables.tables) {
                        const hasGenericColumns = table.data.some(row => 
                            Object.keys(row).some(k => k.startsWith('Column_'))
                        );
                        
                        if (hasGenericColumns) {
                            console.log('   ⚙️  Processing document table structure...');
                            const processed = this.processDocumentTable(table.data);
                            
                            if (processed.DRN_no) {
                                drnNo = processed.DRN_no;
                            }
                            allDocuments = allDocuments.concat(processed.documents);
                        }
                    }

                    // Create clean result entry
                    const result = {
                        Job_Id: jobId,  // Full job ID (e.g., "IR51921") for Zoho lookup field
                        Job_No: jobNo,
                        DRN_no: drnNo,
                        documents: allDocuments
                    };
                    results.push(result);

                    // Print preview
                    console.log(`\n   📊 Parsed Data:`);
                    console.log(`      Job_Id: ${jobId}`);
                    console.log(`      Job_No: ${jobNo}`);
                    console.log(`      DRN_no: ${drnNo}`);
                    console.log(`      Documents: ${allDocuments.length}`);
                    allDocuments.slice(0, 3).forEach((doc, idx) => {
                        console.log(`        ${idx + 1}. ${doc.name}`);
                    });
                    if (allDocuments.length > 3) {
                        console.log(`        ... and ${allDocuments.length - 3} more`);
                    }
                } else {
                    console.log('   ℹ️  No tables found in this email');
                }
            } else {
                console.log('   ℹ️  Email does not contain HTML content');
            }
        }

        // Summary
        const totalDocuments = results.reduce((sum, r) => sum + r.documents.length, 0);

        console.log(`\n${'='.repeat(80)}`);
        console.log('📊 SUMMARY');
        console.log(`${'='.repeat(80)}`);
        console.log(`Total emails processed: ${results.length}`);
        console.log(`Total documents extracted: ${totalDocuments}`);
        console.log(`${'='.repeat(80)}\n`);

        return {
            success: true,
            emailsProcessed: results.length,
            totalDocuments,
            results
        };
    }
}

module.exports = EmailProcessor;
