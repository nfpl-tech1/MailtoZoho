/**
 * Zoho Creator Service (Modular)
 * Main entry point that composes all Zoho modules into a unified service
 * Maintains backward compatibility with the original ZohoService class
 */

const { getConfig, isConfigured } = require('./config');
const { getAccessToken, clearTokenCache } = require('./auth');
const { getRecords, getRecordById, createRecord, createRecordsBatch, updateRecord } = require('./records');
const { batchLookupJobsByBENumbers, batchLookupRecordQueriesByJobIds, lookupJobByBENumber, batchLookupJobsByJobNos } = require('./batch-lookup');
const { lookupRecordQueryByJobId, lookupRecordQueryByJobNo, addQueryToRecordQuery } = require('./record-query');
const { lookupJobRecordId, pushToZoho } = require('./irn-drn');

/**
 * ZohoService class - provides unified access to all Zoho operations
 * All methods delegate to the underlying modular functions
 */
class ZohoService {
    constructor() {
        const config = getConfig();
        this.clientId = config.clientId;
        this.clientSecret = config.clientSecret;
        this.refreshToken = config.refreshToken;
        this.accountOwner = config.accountOwner;
        this.appLinkName = config.appLinkName;
        this.formLinkName = config.formLinkName;
        this.zohoAccountsDomain = config.zohoAccountsDomain;
        this.zohoCreatorDomain = config.zohoCreatorDomain;
    }

    // ==================== Auth ====================

    isConfigured() {
        return isConfigured(getConfig());
    }

    async getAccessToken() {
        return getAccessToken();
    }

    // ==================== Basic CRUD ====================

    async getRecords(options) {
        return getRecords(options);
    }

    async getRecordById(options) {
        return getRecordById(options);
    }

    async createRecord(options) {
        return createRecord(options);
    }

    async updateRecord(options) {
        return updateRecord(options);
    }

    async createRecordsBatch(options) {
        return createRecordsBatch(options);
    }

    // ==================== Batch Lookups ====================

    async batchLookupJobsByBENumbers(beNumbers, reportLinkName = null) {
        return batchLookupJobsByBENumbers(beNumbers, reportLinkName);
    }

    async batchLookupRecordQueriesByJobIds(jobRecordIds, reportLinkName = null) {
        return batchLookupRecordQueriesByJobIds(jobRecordIds, reportLinkName);
    }

    async lookupJobByBENumber(beNumber, reportLinkName = null) {
        return lookupJobByBENumber(beNumber, reportLinkName);
    }

    async batchLookupJobsByJobNos(jobNos, reportLinkName = null) {
        return batchLookupJobsByJobNos(jobNos, reportLinkName);
    }

    // ==================== Record Query Operations ====================

    async lookupRecordQueryByJobId(jobRecordId, jobNoDisplay = '', reportLinkName = null) {
        return lookupRecordQueryByJobId(jobRecordId, jobNoDisplay, reportLinkName);
    }

    async lookupRecordQueryByJobNo(jobNo, reportLinkName = null) {
        return lookupRecordQueryByJobNo(jobNo, reportLinkName);
    }

    async addQueryToRecordQuery(recordId, queryData, existingQueryFields = [], reportLinkName = null, hasFullSubformData = false) {
        return addQueryToRecordQuery(recordId, queryData, existingQueryFields, reportLinkName, hasFullSubformData);
    }

    // ==================== IRN-DRN Operations ====================

    async lookupJobRecordId(jobNo) {
        return lookupJobRecordId(jobNo);
    }

    async pushToZoho(parsedResults) {
        return pushToZoho(parsedResults);
    }
}

// Export both the class and individual modules for flexibility
module.exports = ZohoService;

// Also export as named exports for direct module access
module.exports.config = require('./config');
module.exports.auth = require('./auth');
module.exports.records = require('./records');
module.exports.batchLookup = require('./batch-lookup');
module.exports.recordQuery = require('./record-query');
module.exports.irnDrn = require('./irn-drn');
