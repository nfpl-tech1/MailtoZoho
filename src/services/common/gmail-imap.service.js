/**
 * Gmail IMAP Service (Common)
 * Handles email fetching via IMAP with App Password authentication
 * No OAuth2 required - App Password never expires!
 * 
 * Required ENV variables:
 *   - GMAIL_USER: Your Gmail address (e.g., user@gmail.com)
 *   - GMAIL_APP_PASSWORD: 16-character app password from Google
 * 
 * Based on ImapFlow best practices for Gmail
 */

const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');

class GmailImapService {
    constructor({ user, password } = {}) {
        this.client = null;
        this.initialized = false;

        this.user = user || process.env.GMAIL_USER;
        this.password = password || process.env.GMAIL_APP_PASSWORD;
        this.host = 'imap.gmail.com';
        this.port = 993;
    }

    /**
     * Validate that required environment variables are set
     */
    validateConfig() {
        const required = {
            GMAIL_USER: this.user,
            GMAIL_APP_PASSWORD: this.password
        };

        const missing = Object.entries(required)
            .filter(([key, value]) => !value)
            .map(([key]) => key);

        if (missing.length > 0) {
            throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
        }
    }

    /**
     * Create a new IMAP client
     */
    createClient() {
        return new ImapFlow({
            host: this.host,
            port: this.port,
            secure: true,
            auth: {
                user: this.user,
                pass: this.password
            },
            logger: false // Set to true for debugging
        });
    }

    /**
     * Initialize and validate config
     */
    async initialize() {
        try {
            this.validateConfig();
            this.initialized = true;
            console.log('✓ Gmail IMAP service initialized successfully');
            return true;
        } catch (error) {
            console.error('❌ Gmail IMAP initialization failed:', error.message);
            throw error;
        }
    }

    /**
     * Fetch emails based on various criteria
     */
    async fetchEmails(options = {}) {
        const {
            subjectKeywords = null,
            senderEmail = null,
            maxResults = 50,
            daysBack = null,
            hoursBack = null,
            isUnread = null,
            hasAttachment = null
        } = options;

        // Create fresh client for each request (more reliable for serverless)
        const client = this.createClient();

        try {
            await client.connect();

            // Use mailbox lock for stable connection
            const lock = await client.getMailboxLock('INBOX');

            try {
                // Build IMAP search query using array syntax (more reliable)
                const searchQuery = this.buildSearchQuery({
                    subjectKeywords,
                    senderEmail,
                    hoursBack,
                    daysBack,
                    isUnread
                });

                console.log(`\n🔍 IMAP Search query:`, JSON.stringify(searchQuery));

                // Execute search
                const messageUids = await client.search(searchQuery);

                // Convert to array with robust handling
                let uids = [];
                if (messageUids) {
                    if (Array.isArray(messageUids)) {
                        uids = messageUids;
                    } else if (typeof messageUids[Symbol.iterator] === 'function') {
                        uids = [...messageUids];
                    } else if (typeof messageUids === 'number') {
                        uids = [messageUids];
                    } else if (typeof messageUids === 'object') {
                        // Try to extract values
                        uids = Object.values(messageUids);
                    }
                }

                if (uids.length === 0) {
                    console.log('No messages found.');
                    return [];
                }

                console.log(`✓ Found ${uids.length} email(s) via IMAP`);

                // Get the most recent emails (higher UIDs are typically newer)
                // Fetch more than maxResults to account for filtering
                const fetchLimit = Math.min(uids.length, maxResults * 2);
                const recentUids = uids.slice(-fetchLimit).reverse();

                console.log(`   Fetching details for ${recentUids.length} emails...`);

                // Fetch full details for each message
                // Fetch full details for each message in PARALLEL
                // We use a concurrency limit to avoid overwhelming the connection/server
                let emails = [];
                const CONCURRENCY_LIMIT = 5;

                // Process in chunks of CONCURRENCY_LIMIT
                for (let i = 0; i < recentUids.length; i += CONCURRENCY_LIMIT) {
                    const chunk = recentUids.slice(i, i + CONCURRENCY_LIMIT);
                    console.log(`   Processing chunk ${Math.floor(i / CONCURRENCY_LIMIT) + 1}/${Math.ceil(recentUids.length / CONCURRENCY_LIMIT)} (${chunk.length} emails)...`);

                    const chunkPromises = chunk.map(uid =>
                        this.fetchEmailDetails(client, uid)
                            .then(email => {
                                if (!email) return null;
                                // Filter by attachment if specified
                                if (hasAttachment === true && email.attachments.length === 0) return null;
                                if (hasAttachment === false && email.attachments.length > 0) return null;
                                return email;
                            })
                            .catch(err => {
                                console.error(`   Error fetching UID ${uid}:`, err.message);
                                return null;
                            })
                    );

                    const chunkResults = await Promise.all(chunkPromises);
                    emails.push(...chunkResults.filter(e => e !== null));
                }

                // Sort by date (newest first)
                emails.sort((a, b) => new Date(b.date) - new Date(a.date));

                // Filter by date if specified
                if (hoursBack || daysBack) {
                    const cutoffTime = new Date();
                    if (hoursBack) {
                        cutoffTime.setHours(cutoffTime.getHours() - hoursBack);
                    } else if (daysBack) {
                        cutoffTime.setDate(cutoffTime.getDate() - daysBack);
                    }

                    const beforeFilter = emails.length;
                    emails = emails.filter(email => {
                        const emailDate = new Date(email.date);
                        return emailDate >= cutoffTime;
                    });
                    console.log(`   Filtered by time: ${beforeFilter} → ${emails.length} email(s)`);
                }

                // Limit to maxResults
                if (emails.length > maxResults) {
                    emails = emails.slice(0, maxResults);
                    console.log(`   Limited to ${maxResults} results`);
                }

                return emails;

            } finally {
                // Always release the lock
                lock.release();
            }

        } catch (error) {
            console.error('Error fetching emails:', error.message);
            throw error;
        } finally {
            // Always logout
            try {
                await client.logout();
            } catch (e) {
                // Ignore logout errors
            }
        }
    }

    /**
     * Build IMAP search query using OBJECT syntax (works with ImapFlow)
     * NOTE: Array syntax like ['HEADER', ...] returns boolean, not results!
     * Only use object syntax like { subject: 'xxx' }
     */
    buildSearchQuery(options = {}) {
        const { subjectKeywords, senderEmail, hoursBack, daysBack, isUnread } = options;

        // Build object-based query (ImapFlow auto-ANDs multiple conditions)
        const query = {};

        // Subject search
        if (subjectKeywords && subjectKeywords.length > 0) {
            // Get the first keyword and strip any FW:/RE: prefix
            let keyword = subjectKeywords[0];
            keyword = keyword.replace(/^(FW:|RE:|Fwd:|Re:)\s*/i, '').trim();
            query.subject = keyword;
        }

        // Sender filter
        if (senderEmail) {
            query.from = senderEmail;
        }

        // Unread filter
        if (isUnread === true) {
            query.seen = false;
        } else if (isUnread === false) {
            query.seen = true;
        }

        // Date filter optimization (SINCE)
        // NOTE: Most IMAP servers only support date-level precision (ignore time)
        // But we pass the exact timestamp anyway - some servers may support it
        // The post-filtering (lines 178-192) handles exact time matching
        const now = new Date();
        if (hoursBack) {
            // Calculate exact cutoff time (e.g., 3 hours ago)
            const sinceDate = new Date(now.getTime() - (hoursBack * 60 * 60 * 1000));
            query.since = sinceDate;
        } else if (daysBack) {
            // Calculate exact cutoff date
            const sinceDate = new Date();
            sinceDate.setDate(sinceDate.getDate() - daysBack);
            query.since = sinceDate;
        }

        // If no conditions, return 'ALL'
        if (Object.keys(query).length === 0) {
            return 'ALL';
        }

        return query;
    }

    /**
     * Fetch detailed information about a specific email
     */
    async fetchEmailDetails(client, uid) {
        try {
            // Fetch with source for full parsing
            const message = await client.fetchOne(uid, {
                uid: true,
                envelope: true,
                source: true,
                bodyStructure: true
            });

            if (!message) {
                return null;
            }

            // Use envelope for quick access to headers
            const envelope = message.envelope || {};

            // Parse the full source for body and attachments
            let body = { plain: '', html: '', display: '' };
            let attachments = [];

            if (message.source) {
                const parsed = await simpleParser(message.source);
                body = {
                    plain: parsed.text || '',
                    html: parsed.html || '',
                    display: parsed.text || parsed.html || ''
                };

                attachments = (parsed.attachments || []).map((att, index) => ({
                    filename: att.filename || `attachment_${index}`,
                    mimeType: att.contentType,
                    size: att.size,
                    attachmentId: `${uid}_${index}`,
                    messageId: uid.toString(),
                    content: att.content // Buffer with attachment data
                }));
            }

            return {
                id: uid.toString(),
                subject: envelope.subject || '(No Subject)',
                from: envelope.from?.[0]?.address || envelope.from?.[0]?.name || 'Unknown',
                to: envelope.to?.[0]?.address || envelope.to?.[0]?.name || 'Unknown',
                date: envelope.date?.toISOString() || new Date().toISOString(),
                snippet: (body.plain || '').substring(0, 200),
                body,
                attachments,
                labels: []
            };

        } catch (error) {
            console.error(`Error fetching email ${uid}:`, error.message);
            return null;
        }
    }

    /**
     * Download attachment content
     */
    async downloadAttachment(messageId, attachmentId) {
        const client = this.createClient();

        try {
            await client.connect();
            const lock = await client.getMailboxLock('INBOX');

            try {
                // Parse the attachment ID to get UID and index
                const [uid, indexStr] = attachmentId.split('_');
                const index = parseInt(indexStr, 10);

                // Fetch the message
                const message = await client.fetchOne(parseInt(uid, 10), {
                    uid: true,
                    source: true
                });

                if (!message || !message.source) {
                    throw new Error('Message not found');
                }

                // Parse and get attachment
                const parsed = await simpleParser(message.source);
                const attachment = parsed.attachments?.[index];

                if (!attachment) {
                    throw new Error('Attachment not found');
                }

                // Return as string - try to decode as UTF-8 for text files
                // Check by content type OR filename extension
                const filename = attachment.filename || '';
                const isTextByType = attachment.contentType?.includes('text');
                const isTextByExt = /\.(txt|out|log|csv|json|xml|html|htm)$/i.test(filename);
                const isOctetStream = attachment.contentType?.includes('octet-stream');

                // For octet-stream, try UTF-8 first (commonly text files)
                if (isTextByType || isTextByExt || isOctetStream) {
                    return attachment.content.toString('utf-8');
                } else {
                    return attachment.content.toString('base64');
                }

            } finally {
                lock.release();
            }

        } catch (error) {
            console.error(`Error downloading attachment:`, error.message);
            throw error;
        } finally {
            try {
                await client.logout();
            } catch (e) {
                // Ignore logout errors
            }
        }
    }
}

module.exports = GmailImapService;
