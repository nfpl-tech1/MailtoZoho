const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
    getRecordKey,
    normalizePendingRecord,
    mergePendingWithCurrent
} = require('../src/services/irn-drn-tracker/pendingBuffer.service');

describe('getRecordKey', () => {
    it('returns drn: key when DRN_no is present', () => {
        assert.equal(getRecordKey({ DRN_no: 'DRN123' }), 'drn:DRN123');
    });

    it('returns fallback key when DRN_no is absent', () => {
        const record = {
            Job_No: 51921,
            documents: [{ name: 'doc.pdf', irn: '12345', type: 'Invoice' }]
        };
        const key = getRecordKey(record);
        assert.ok(key.startsWith('fallback:51921:'));
        assert.ok(key.includes('doc.pdf|12345|Invoice'));
    });

    it('returns fallback key with no-job placeholder when Job_No is absent', () => {
        const key = getRecordKey({ documents: [] });
        assert.ok(key.startsWith('fallback:no-job:'));
    });

    it('handles empty documents array in fallback', () => {
        const key = getRecordKey({ Job_No: 100, documents: [] });
        assert.equal(key, 'fallback:100:');
    });
});

describe('normalizePendingRecord', () => {
    it('sets defaults for missing fields', () => {
        const result = normalizePendingRecord({ Job_No: 42 });
        assert.equal(result.Job_No, 42);
        assert.equal(result.DRN_no, null);
        assert.deepEqual(result.documents, []);
        assert.equal(result.pendingReason, null);
        assert.equal(result.attempts, 0);
        assert.ok(typeof result.pendingSince === 'string');
        assert.ok(typeof result.lastSeenAt === 'string');
    });

    it('uses provided reason over record.pendingReason', () => {
        const result = normalizePendingRecord({ pendingReason: 'old_reason' }, 'new_reason');
        assert.equal(result.pendingReason, 'new_reason');
    });

    it('falls back to record.pendingReason when reason is null', () => {
        const result = normalizePendingRecord({ pendingReason: 'job_lookup_failed' }, null);
        assert.equal(result.pendingReason, 'job_lookup_failed');
    });

    it('preserves existing pendingSince when present', () => {
        const ts = '2026-01-01T00:00:00.000Z';
        const result = normalizePendingRecord({ pendingSince: ts });
        assert.equal(result.pendingSince, ts);
    });

    it('increments numeric attempts', () => {
        const result = normalizePendingRecord({ attempts: '3' });
        assert.equal(result.attempts, 3);
    });
});

describe('mergePendingWithCurrent', () => {
    it('returns combined unique records', () => {
        const pending = [{ DRN_no: 'A', documents: [], pendingReason: 'job_lookup_failed', attempts: 1 }];
        const current = [{ DRN_no: 'B', documents: [] }];
        const merged = mergePendingWithCurrent(pending, current);
        assert.equal(merged.length, 2);
    });

    it('deduplicates overlapping records by key — current wins', () => {
        const pending = [{ DRN_no: 'X', documents: [], pendingReason: 'job_lookup_failed', pendingSince: '2025-01-01T00:00:00.000Z', attempts: 2 }];
        const current = [{ DRN_no: 'X', documents: [{ name: 'f.pdf', irn: '1', type: 'T' }] }];
        const merged = mergePendingWithCurrent(pending, current);
        assert.equal(merged.length, 1);
        assert.equal(merged[0].DRN_no, 'X');
        assert.equal(merged[0].documents.length, 1);
        // pendingSince from pending record is preserved
        assert.equal(merged[0].pendingSince, '2025-01-01T00:00:00.000Z');
    });

    it('returns empty array for empty inputs', () => {
        assert.deepEqual(mergePendingWithCurrent([], []), []);
    });
});
