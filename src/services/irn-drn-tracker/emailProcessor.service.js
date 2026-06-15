/**
 * Email Processor Service for IRN-DRN Tracker
 * Combines Gmail fetching with table parsing
 */

const { GmailService } = require('../common');
const { extractAndParseTables } = require('../../utils/irn-drn-tracker/htmlTableParser');

class EmailProcessor {
    constructor(gmailService = null) {
        this.gmailService = gmailService || new GmailService();
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
     * Strategy: Collect ALL IR numbers and return the most frequent one
     */
    extractJobId(emailData, tablesData) {
        const pattern = /IR(\d+)/gi;
        const irCounts = {};  // Track frequency of each IR number

        /**
         * Helper to add IR numbers to count
         */
        const addMatches = (text) => {
            if (!text || typeof text !== 'string') return;
            const matches = text.match(pattern);
            if (matches) {
                matches.forEach(match => {
                    const normalized = match.toUpperCase();
                    irCounts[normalized] = (irCounts[normalized] || 0) + 1;
                });
            }
        };

        // 1. Check Subject
        addMatches(emailData.subject);

        // 2. Check Body (Plain text)
        if (emailData.body && typeof emailData.body === 'object') {
            addMatches(emailData.body.plain || '');
            addMatches(emailData.body.display || '');
            addMatches(emailData.body.html || '');
        }

        // 3. Check Table Content (including document names which have IR numbers)
        for (const table of tablesData) {
            for (const row of table.data) {
                for (const value of Object.values(row)) {
                    addMatches(value);
                }
            }
        }

        // If no IR numbers found
        if (Object.keys(irCounts).length === 0) {
            return null;
        }

        // Log all found IR numbers for debugging
        console.log(`   🔍 IR numbers found: ${JSON.stringify(irCounts)}`);

        // Find the most frequent IR number
        let mostFrequentIR = null;
        let maxCount = 0;

        for (const [ir, count] of Object.entries(irCounts)) {
            if (count > maxCount) {
                maxCount = count;
                mostFrequentIR = ir;
            } else if (count === maxCount) {
                // In case of tie, prefer the higher number (more recent job)
                const currentNum = parseInt(ir.replace('IR', ''), 10);
                const maxNum = parseInt(mostFrequentIR.replace('IR', ''), 10);
                if (currentNum > maxNum) {
                    mostFrequentIR = ir;
                }
            }
        }

        console.log(`   ✅ Selected IR: ${mostFrequentIR} (appeared ${maxCount} time(s))`);
        return mostFrequentIR;
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

        const isDrnRow = (row) =>
            row.length >= 1 &&
            typeof row[0] === 'string' &&
            /drn/i.test(row[0]) &&
            row[0].includes(':');

        const isHeaderRow = (row) => {
            const normalized = row.map(cell => String(cell || '').trim().toLowerCase());
            return (
                normalized.includes('document name') &&
                normalized.includes('irn') &&
                normalized.includes('document type')
            );
        };

        const isHeaderlessDocumentRow = (row) => {
            if (row.length < 3) return false;

            const [name, irn, type] = row.map(cell => String(cell || '').trim());
            if (!name || !irn || !type) return false;

            // Newer eSanchit emails omit the header row and send document rows directly.
            // Those rows consistently contain a filename, a numeric IRN/document reference,
            // and a document type/HSN-like descriptor.
            const looksLikeFilename = /\.[A-Za-z0-9]{2,5}$/.test(name);
            const looksLikeReference = /^\d{10,}$/.test(irn) || /^IRN/i.test(irn);

            return looksLikeFilename && looksLikeReference;
        };

        const addDocument = (name, irn, type) => {
            documents.push({
                name: name || '',
                irn: irn || '',
                type: type || ''
            });
        };

        // Process the raw rows
        for (const row of rawRows) {
            // Case 1: DRN Row (Metadata) - extract DRN number
            if (isDrnRow(row)) {
                const parts = row[0].split(':');
                if (parts.length >= 2) {
                    drnNo = parts.slice(1).join(':').trim();
                }
            }
            // Case 2: Header Row - identify column positions
            else if (isHeaderRow(row)) {
                currentHeaders = row;
            }
            // Case 3: Data Row - extract document info
            else if (currentHeaders && row.length === currentHeaders.length) {
                const normalizedHeaders = currentHeaders.map(header => String(header || '').trim().toLowerCase());
                const nameIdx = normalizedHeaders.indexOf('document name');
                const irnIdx = normalizedHeaders.indexOf('irn');
                const typeIdx = normalizedHeaders.indexOf('document type');

                if (nameIdx !== -1) {
                    addDocument(
                        row[nameIdx] || '',
                        irnIdx !== -1 ? row[irnIdx] || '' : '',
                        typeIdx !== -1 ? row[typeIdx] || '' : ''
                    );
                }
            }
            // Case 4: Headerless row format used by current emails
            else if (isHeaderlessDocumentRow(row)) {
                addDocument(row[0], row[1], row[2]);
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
            daysBack = null,
            hoursBack = null,
            maxResults = 10
        } = options;

        console.log('=' .repeat(80));
        console.log('📧 IRN-DRN TRACKER - EMAIL TABLE EXTRACTOR');
        console.log('=' .repeat(80));

        // Ensure initialized
        await this.initialize();

        // Fetch emails
        console.log(`\n🔍 Searching for emails with: ${subjectKeywords.join(', ')}`);
        if (hoursBack) {
            console.log(`   Time filter: last ${hoursBack} hour(s)`);
        } else if (daysBack) {
            console.log(`   Time filter: last ${daysBack} day(s)`);
        }
        
        const emails = await this.gmailService.fetchEmails({
            subjectKeywords,
            daysBack,
            hoursBack,
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
                        Job_No: jobNo,
                        DRN_no: drnNo,
                        documents: allDocuments
                    };
                    results.push(result);

                    // Print preview
                    console.log(`\n   📊 Parsed Data:`);
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
