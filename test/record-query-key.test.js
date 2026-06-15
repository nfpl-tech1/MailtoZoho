const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { getRecordQueryKey } = require('../src/utils/record-query/textFileParser');

describe('getRecordQueryKey', () => {
    it('returns beNumber|query in lowercase', () => {
        const result = getRecordQueryKey({ beNumber: '1234567', query: 'IS IRN AVAILABLE' });
        assert.equal(result, '1234567|is irn available');
    });

    it('trims whitespace from query', () => {
        const result = getRecordQueryKey({ beNumber: '9999999', query: '  check status  ' });
        assert.equal(result, '9999999|check status');
    });

    it('uses empty string for missing beNumber', () => {
        const result = getRecordQueryKey({ query: 'test query' });
        assert.equal(result, '|test query');
    });

    it('uses empty string for missing query', () => {
        const result = getRecordQueryKey({ beNumber: '1234567' });
        assert.equal(result, '1234567|');
    });

    it('handles both fields missing', () => {
        const result = getRecordQueryKey({});
        assert.equal(result, '|');
    });

    it('is case-insensitive for query', () => {
        const a = getRecordQueryKey({ beNumber: '1', query: 'Query Text Here' });
        const b = getRecordQueryKey({ beNumber: '1', query: 'query text here' });
        assert.equal(a, b);
    });
});
