/**
 * Email Processor Service for Record Query
 * Fetches emails with subject "Outbound file generated"
 * Downloads and parses text file attachments
 */

const { GmailService } = require('../common');
const { parseTextFile, validateParsedData } = require('../../utils/record-query');
const { getConfigService } = require('../common/config.service');

class RecordQueryEmailProcessor {
    constructor(gmailService = null) {
        this.gmailService = gmailService || new GmailService();
        this.initialized = false;
    }

    /**
     * Get subject keyword from config (supports Supabase override)
     */
    getSubjectKeyword() {
        const configService = getConfigService();
        return configService.get('RECORD_QUERY_SUBJECT_KEYWORD', 'Outbound file generated');
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
     * Fetch and process emails with attachments
     * @param {Object} options - Fetch options
     * @returns {Object} - Processing results
     */
    async fetchAndProcessEmails(options = {}) {
        const {
            daysBack = null,
            hoursBack = 24,
            maxResults = 10
        } = options;

        console.log('='.repeat(80));
        console.log('📧 RECORD QUERY - EMAIL PROCESSOR');
        console.log('='.repeat(80));

        // Ensure initialized
        await this.initialize();

        // Fetch emails with the subject
        const subjectKeyword = this.getSubjectKeyword();
        console.log(`\n🔍 Searching for emails with subject: "${subjectKeyword}"`);
        if (hoursBack) {
            console.log(`   Time filter: last ${hoursBack} hour(s)`);
        } else if (daysBack) {
            console.log(`   Time filter: last ${daysBack} day(s)`);
        }

        const emails = await this.gmailService.fetchEmails({
            subjectKeywords: [subjectKeyword],
            hasAttachment: true,
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

        // Process each email
        const results = [];

        for (let idx = 0; idx < emails.length; idx++) {
            const email = emails[idx];
            console.log(`\n${'='.repeat(80)}`);
            console.log(`📧 Email ${idx + 1}/${emails.length}`);
            console.log(`${'='.repeat(80)}`);
            console.log(`Subject: ${email.subject}`);
            console.log(`From: ${email.from}`);
            console.log(`Date: ${email.date}`);

            // Check for attachments
            const attachments = email.attachments || [];
            console.log(`   Attachments: ${attachments.length}`);

            if (attachments.length === 0) {
                console.log('   ⚠️ No attachments found in this email');
                continue;
            }

            // Process each text file attachment
            for (const attachment of attachments) {
                console.log(`\n   📎 Processing attachment: ${attachment.filename}`);
                console.log(`      MIME Type: ${attachment.mimeType}`);
                console.log(`      Size: ${attachment.size} bytes`);

                // Download attachment content
                try {
                    const content = await this.gmailService.downloadAttachment(
                        attachment.messageId,
                        attachment.attachmentId
                    );

                    console.log(`      ✓ Downloaded attachment (${content.length} chars)`);

                    // Parse the text file
                    console.log(`      📝 Content preview: ${content.substring(0, 200).replace(/\n/g, '\\n')}...`);
                    const parsedData = parseTextFile(content);

                    if (!parsedData.success) {
                        console.log(`      ❌ Failed to parse: ${parsedData.error}`);
                        results.push({
                            emailId: email.id,
                            subject: email.subject,
                            date: email.date,
                            attachment: attachment.filename,
                            success: false,
                            error: parsedData.error
                        });
                        continue;
                    }

                    // Validate parsed data
                    const validation = validateParsedData(parsedData);
                    if (!validation.isValid) {
                        console.log(`      ❌ Validation failed: ${validation.errors.join(', ')}`);
                        results.push({
                            emailId: email.id,
                            subject: email.subject,
                            date: email.date,
                            attachment: attachment.filename,
                            success: false,
                            error: `Validation failed: ${validation.errors.join(', ')}`
                        });
                        continue;
                    }

                    console.log(`\n      ✅ Successfully parsed:`);
                    console.log(`         BE Number: ${parsedData.beNumber}`);
                    console.log(`         Query Date: ${parsedData.queryDate}`);
                    console.log(`         Query: ${parsedData.query}`);

                    results.push({
                        emailId: email.id,
                        subject: email.subject,
                        date: email.date,
                        attachment: attachment.filename,
                        success: true,
                        data: {
                            beNumber: parsedData.beNumber,
                            queryDate: parsedData.queryDate,
                            query: parsedData.query
                        }
                    });
                } catch (error) {
                    console.log(`      ❌ Error processing attachment: ${error.message}`);
                    results.push({
                        emailId: email.id,
                        subject: email.subject,
                        date: email.date,
                        attachment: attachment.filename,
                        success: false,
                        error: error.message
                    });
                }
            }
        }

        // Summary
        const successCount = results.filter(r => r.success).length;

        console.log(`\n${'='.repeat(80)}`);
        console.log('📊 SUMMARY');
        console.log(`${'='.repeat(80)}`);
        console.log(`Total emails processed: ${emails.length}`);
        console.log(`Total attachments processed: ${results.length}`);
        console.log(`Successful: ${successCount}`);
        console.log(`Failed: ${results.length - successCount}`);
        console.log(`${'='.repeat(80)}\n`);

        return {
            success: true,
            emailsProcessed: emails.length,
            attachmentsProcessed: results.length,
            successCount,
            failedCount: results.length - successCount,
            results
        };
    }
}

module.exports = RecordQueryEmailProcessor;
