const test = require('node:test');
const assert = require('node:assert/strict');

const EmailProcessor = require('../src/services/irn-drn-tracker/emailProcessor.service');

test('processDocumentTable parses legacy header-based tables', () => {
    const processor = new EmailProcessor();

    const result = processor.processDocumentTable([
        { Column_1: 'DRN : DRN123456789' },
        {
            Column_1: 'Document name',
            Column_2: 'IRN',
            Column_3: 'Document Type'
        },
        {
            Column_1: 'IR51921-Invoice.pdf',
            Column_2: 'IRN987654321',
            Column_3: 'Invoice'
        }
    ]);

    assert.equal(result.DRN_no, 'DRN123456789');
    assert.deepEqual(result.documents, [
        {
            name: 'IR51921-Invoice.pdf',
            irn: 'IRN987654321',
            type: 'Invoice'
        }
    ]);
});

test('processDocumentTable parses current headerless email rows', () => {
    const processor = new EmailProcessor();

    const result = processor.processDocumentTable([
        { Column_1: 'DRN : 2026042500025668' },
        {
            Column_1: 'AWB_Signed.pdf',
            Column_2: '2026042500082680',
            Column_3: '740000-Air waybill'
        },
        {
            Column_1: 'Certificate TEC_Signed.pdf',
            Column_2: '2026042500082681',
            Column_3: 'HAC005-Declarations'
        }
    ]);

    assert.equal(result.DRN_no, '2026042500025668');
    assert.deepEqual(result.documents, [
        {
            name: 'AWB_Signed.pdf',
            irn: '2026042500082680',
            type: '740000-Air waybill'
        },
        {
            name: 'Certificate TEC_Signed.pdf',
            irn: '2026042500082681',
            type: 'HAC005-Declarations'
        }
    ]);
});
