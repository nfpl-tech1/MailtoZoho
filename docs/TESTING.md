<!-- STATUS: ACTIVE -->
<!-- Last Updated: 2026-06-15 -->

# Testing — eSanchit Email Automation

## Test Runner

This project uses **Node's built-in test runner** (`node:test`), not Jest.

```bash
# Run all tests
node --test test/

# Run a specific test file
node --test test/irn-drn-parser.test.js
```

The `npm test` script should be configured to run `node --test test/`.

## Test File Location

All test files live in the `test/` directory at the project root:

```
test/
├── irn-drn-parser.test.js        # IRN-DRN HTML table parser tests
├── auth.test.js                  # Auth timing-safe compare tests
├── pending-buffer.test.js        # IRN-DRN pending buffer pure function tests
└── record-query-key.test.js      # getRecordQueryKey dedup utility tests
```

**Pattern:** `test/{feature-name}.test.js`

## Writing Tests

Use `node:test` and `node:assert/strict`:

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');

test('descriptive name of what is being tested', () => {
    const result = functionUnderTest(input);
    assert.equal(result.field, expectedValue);
    assert.deepEqual(result.array, expectedArray);
});
```

## What Must Be Tested

| Category | Coverage Requirement | Current State |
|----------|---------------------|---------------|
| Parsers (`utils/`) | Every parser function must have tests | IRN-DRN: 2 tests. Record Query: getRecordQueryKey tested |
| Service logic | Core processing paths should have tests | pendingBuffer.service.js: 11 tests |
| Controllers | Not required (thin orchestration layer) | — |
| External integrations | Not required (would need mocks/stubs) | — |

**Priority for new tests:**
1. `utils/record-query/textFileParser.js` — `parseTextFile()`, `formatQueryDate()`, `validateParsedData()`
2. `utils/irn-drn-tracker/htmlTableParser.js` — edge cases (empty tables, malformed HTML)
3. `services/*/emailProcessor.service.js` — `extractJobId()`, `processDocumentTable()`

## Test Data

Use inline test data, not fixtures files. Parsers are pure functions — pass input directly:

```javascript
test('parseTextFile extracts BE number from continuous format', () => {
    const content = 'FINNSA1593723226112025203122025IRN FOR BIS PLEASE Query Raised By : 10XXXXXX';
    const result = parseTextFile(content);
    assert.equal(result.beNumber, '5937232');
    assert.equal(result.queryDate, '03-Dec-2025');
});
```

## Pre-Merge Requirements

Before merging any change:
- `node --test test/` must pass with zero failures
- New parser functions must include tests
- Bug fixes to parsers must include a regression test

## References

- [Node.js Test Runner](https://nodejs.org/api/test.html) — Official docs
- [Node.js Assert (strict)](https://nodejs.org/api/assert.html#strict-assertion-mode) — Assertion API
