const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

function timingSafeCompare(a, b) {
    const bufA = Buffer.from(String(a), 'utf8');
    const bufB = Buffer.from(String(b), 'utf8');
    if (bufA.length !== bufB.length) {
        const hashA = crypto.createHash('sha256').update(bufA).digest();
        const hashB = crypto.createHash('sha256').update(bufB).digest();
        return crypto.timingSafeEqual(hashA, hashB);
    }
    return crypto.timingSafeEqual(bufA, bufB);
}

describe('timingSafeCompare', () => {
    it('returns true for equal same-length strings', () => {
        assert.equal(timingSafeCompare('password123', 'password123'), true);
    });

    it('returns false for unequal same-length strings', () => {
        assert.equal(timingSafeCompare('password123', 'password456'), false);
    });

    it('returns false for strings of different lengths', () => {
        assert.equal(timingSafeCompare('short', 'muchlongerpassword'), false);
    });

    it('returns true for two empty strings', () => {
        assert.equal(timingSafeCompare('', ''), true);
    });

    it('returns false for empty vs non-empty string', () => {
        assert.equal(timingSafeCompare('', 'something'), false);
        assert.equal(timingSafeCompare('something', ''), false);
    });

    it('handles null input without throwing', () => {
        assert.equal(timingSafeCompare(null, 'password'), false);
        assert.equal(timingSafeCompare('password', null), false);
        assert.equal(timingSafeCompare(null, null), true);
    });

    it('handles undefined input without throwing', () => {
        assert.equal(timingSafeCompare(undefined, 'password'), false);
        assert.equal(timingSafeCompare('password', undefined), false);
        assert.equal(timingSafeCompare(undefined, undefined), true);
    });

    it('handles unicode strings correctly', () => {
        assert.equal(timingSafeCompare('pässwörd', 'pässwörd'), true);
        assert.equal(timingSafeCompare('pässwörd', 'password'), false);
    });
});
