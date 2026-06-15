/**
 * Gmail Service (Common)
 * Handles Gmail API authentication and email fetching
 * Shared across all features
 * 
 * Supports TWO authentication methods:
 * 1. IMAP with App Password (PREFERRED - never expires!)
 *    - Set GMAIL_USER and GMAIL_APP_PASSWORD
 * 2. OAuth2 (legacy - tokens expire in testing mode)
 *    - Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, etc.
 */

const { google } = require('googleapis');

// Check if IMAP should be used (App Password is configured)
const useImap = !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);

// Gmail API scope for read-only access (OAuth2 only)
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

class GmailService {
    constructor({ user, password } = {}) {
        this.auth = null;
        this.gmail = null;
        this.imapService = null;

        // When explicit credentials are provided, always use IMAP for that instance
        const hasInjectedCreds = !!(user && password);
        this.useImap = hasInjectedCreds || useImap;

        if (this.useImap) {
            // Use IMAP with App Password
            const GmailImapService = require('./gmail-imap.service');
            this.imapService = new GmailImapService(hasInjectedCreds ? { user, password } : {});
            console.log('📧 Gmail: Using IMAP with App Password (tokens never expire!)');
        } else {
            // Use OAuth2 (legacy)
            this.clientId = process.env.GOOGLE_CLIENT_ID;
            this.clientSecret = process.env.GOOGLE_CLIENT_SECRET;
            this.redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost';
            this.accessToken = process.env.GOOGLE_ACCESS_TOKEN;
            this.refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
            this.tokenUri = process.env.GOOGLE_TOKEN_URI || 'https://oauth2.googleapis.com/token';
            console.log('📧 Gmail: Using OAuth2 (tokens may expire)');
        }
    }

    /**
     * Validate that required environment variables are set
     */
    validateConfig() {
        if (this.useImap) {
            return this.imapService.validateConfig();
        }

        const required = {
            GOOGLE_CLIENT_ID: this.clientId,
            GOOGLE_CLIENT_SECRET: this.clientSecret,
            GOOGLE_ACCESS_TOKEN: this.accessToken,
            GOOGLE_REFRESH_TOKEN: this.refreshToken
        };

        const missing = Object.entries(required)
            .filter(([key, value]) => !value)
            .map(([key]) => key);

        if (missing.length > 0) {
            throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
        }
    }

    /**
     * Initialize and authenticate with Gmail
     */
    async initialize() {
        try {
            if (this.useImap) {
                await this.imapService.initialize();
                this.initialized = true;
                return true;
            }

            this.validateConfig();
            this.auth = await this.authorize();
            this.gmail = google.gmail({ version: 'v1', auth: this.auth });
            this.initialized = true;
            console.log('✓ Gmail service initialized successfully');
            return true;
        } catch (error) {
            console.error('❌ Gmail initialization failed:', error.message);
            throw error;
        }
    }

    /**
     * Authorize with OAuth2 using environment variables
     */
    async authorize() {
        const oAuth2Client = new google.auth.OAuth2(
            this.clientId,
            this.clientSecret,
            this.redirectUri
        );

        // Set credentials from environment variables
        oAuth2Client.setCredentials({
            access_token: this.accessToken,
            refresh_token: this.refreshToken,
            token_type: 'Bearer',
            scope: SCOPES.join(' ')
        });

        // Setup automatic token refresh
        oAuth2Client.on('tokens', (tokens) => {
            if (tokens.access_token) {
                console.log('✓ Access token refreshed automatically');
            }
        });

        // Force a token refresh to ensure we have a valid token
        try {
            await oAuth2Client.getAccessToken();
            console.log('✓ Token validated/refreshed successfully');
        } catch (error) {
            console.error('Token refresh failed:', error.message);
            throw new Error('Failed to refresh access token. Please update GOOGLE_ACCESS_TOKEN and GOOGLE_REFRESH_TOKEN in .env');
        }

        return oAuth2Client;
    }

    /**
     * Build Gmail search query from options
     */
    buildQuery(options = {}) {
        const queryParts = [];

        // Date filter - supports both hoursBack and daysBack
        if (options.hoursBack) {
            queryParts.push(`newer_than:${options.hoursBack}h`);
            console.log(`   Using filter: newer_than:${options.hoursBack}h`);
        } else if (options.daysBack) {
            queryParts.push(`newer_than:${options.daysBack}d`);
            console.log(`   Using filter: newer_than:${options.daysBack}d`);
        }

        // Subject keywords
        if (options.subjectKeywords && options.subjectKeywords.length > 0) {
            const formattedKeywords = options.subjectKeywords.map(keyword => {
                if (keyword.includes(' ')) {
                    return `subject:"${keyword}"`;
                }
                return `subject:${keyword}`;
            });
            queryParts.push(`(${formattedKeywords.join(' OR ')})`);
        }

        // Sender filter
        if (options.senderEmail) {
            queryParts.push(`from:${options.senderEmail}`);
        }

        // Unread filter
        if (options.isUnread === true) {
            queryParts.push('is:unread');
        } else if (options.isUnread === false) {
            queryParts.push('is:read');
        }

        // Attachment filter
        if (options.hasAttachment === true) {
            queryParts.push('has:attachment');
        } else if (options.hasAttachment === false) {
            queryParts.push('-has:attachment');
        }

        return queryParts.join(' ');
    }

    /**
     * Fetch emails based on various criteria
     */
    async fetchEmails(options = {}) {
        // Delegate to IMAP service if using App Password
        if (this.useImap) {
            return this.imapService.fetchEmails(options);
        }

        const {
            subjectKeywords = null,
            senderEmail = null,
            maxResults = 10,
            daysBack = null,
            hoursBack = null,
            isUnread = null,
            hasAttachment = null
        } = options;

        try {
            const query = this.buildQuery({
                subjectKeywords,
                senderEmail,
                daysBack,
                hoursBack,
                isUnread,
                hasAttachment
            });

            console.log(`\n🔍 Search Query: ${query || 'all emails'}`);

            // Fetch message list
            const response = await this.gmail.users.messages.list({
                userId: 'me',
                q: query || undefined,
                maxResults
            });

            const messages = response.data.messages || [];

            if (messages.length === 0) {
                console.log('No messages found.');
                return [];
            }

            console.log(`✓ Found ${messages.length} email(s) from Gmail API`);

            // Fetch full details for each message
            let emails = await Promise.all(
                messages.map(msg => this.getEmailDetails(msg.id))
            );

            emails = emails.filter(email => email !== null);

            // Additional client-side filtering for hoursBack
            if (hoursBack && emails.length > 0) {
                const cutoffTime = new Date();
                cutoffTime.setHours(cutoffTime.getHours() - hoursBack);

                const beforeFilter = emails.length;
                emails = emails.filter(email => {
                    const emailDate = new Date(email.date);
                    return emailDate >= cutoffTime;
                });

                console.log(`   Filtered by time (last ${hoursBack}h): ${beforeFilter} → ${emails.length} email(s)`);
            }

            return emails;
        } catch (error) {
            console.error('Error fetching emails:', error.message);
            throw error;
        }
    }

    /**
     * Get detailed information about a specific email
     */
    async getEmailDetails(messageId) {
        try {
            const response = await this.gmail.users.messages.get({
                userId: 'me',
                id: messageId,
                format: 'full'
            });

            const message = response.data;
            const headers = message.payload.headers;

            // Extract headers
            const getHeader = (name) => {
                const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
                return header ? header.value : 'Unknown';
            };

            // Get email body
            const body = this.getEmailBody(message.payload);

            // Get attachments info
            const attachments = this.getAttachmentsList(message.payload, messageId);

            return {
                id: messageId,
                subject: getHeader('subject'),
                from: getHeader('from'),
                to: getHeader('to'),
                date: getHeader('date'),
                snippet: message.snippet || '',
                body,
                attachments,
                labels: message.labelIds || []
            };
        } catch (error) {
            console.error(`Error fetching email ${messageId}:`, error.message);
            return null;
        }
    }

    /**
     * Extract email body from payload - returns both plain text and HTML
     */
    getEmailBody(payload) {
        let plainText = '';
        let htmlContent = '';

        const extractBodyRecursive = (payloadPart) => {
            if (payloadPart.parts) {
                for (const part of payloadPart.parts) {
                    if (part.mimeType === 'text/plain' && part.body?.data) {
                        plainText = Buffer.from(part.body.data, 'base64').toString('utf-8');
                    } else if (part.mimeType === 'text/html' && part.body?.data) {
                        htmlContent = Buffer.from(part.body.data, 'base64').toString('utf-8');
                    } else if (part.parts) {
                        extractBodyRecursive(part);
                    }
                }
            } else if (payloadPart.body?.data) {
                const mimeType = payloadPart.mimeType || '';
                const decodedContent = Buffer.from(payloadPart.body.data, 'base64').toString('utf-8');

                if (mimeType.includes('text/plain')) {
                    plainText = decodedContent;
                } else if (mimeType.includes('text/html')) {
                    htmlContent = decodedContent;
                }
            }
        };

        extractBodyRecursive(payload);

        return {
            plain: plainText,
            html: htmlContent,
            display: plainText || htmlContent
        };
    }

    /**
     * Get list of attachments from email payload
     */
    getAttachmentsList(payload, messageId) {
        const attachments = [];

        const extractAttachments = (parts) => {
            if (!parts) return;

            for (const part of parts) {
                if (part.filename && part.body && part.body.attachmentId) {
                    attachments.push({
                        filename: part.filename,
                        mimeType: part.mimeType,
                        size: part.body.size,
                        attachmentId: part.body.attachmentId,
                        messageId: messageId
                    });
                }
                if (part.parts) {
                    extractAttachments(part.parts);
                }
            }
        };

        if (payload.parts) {
            extractAttachments(payload.parts);
        }

        return attachments;
    }

    /**
     * Download attachment content
     * @param {string} messageId - The email message ID
     * @param {string} attachmentId - The attachment ID
     * @returns {string} - The decoded attachment content
     */
    async downloadAttachment(messageId, attachmentId) {
        // Delegate to IMAP service if using App Password
        if (this.useImap) {
            return this.imapService.downloadAttachment(messageId, attachmentId);
        }

        try {
            const response = await this.gmail.users.messages.attachments.get({
                userId: 'me',
                messageId: messageId,
                id: attachmentId
            });

            // Decode base64 content
            const data = response.data.data;
            const decodedContent = Buffer.from(data, 'base64').toString('utf-8');

            return decodedContent;
        } catch (error) {
            console.error(`Error downloading attachment:`, error.message);
            throw error;
        }
    }
}

module.exports = GmailService;
