const PENDING_RECORDS_KEY = 'IRN_DRN_PENDING_RECORDS';
const MAX_PENDING_RECORDS = 500;

const getRecordKey = (record) => {
    if (record.DRN_no) return `drn:${record.DRN_no}`;

    const documentsKey = (record.documents || [])
        .map(doc => `${doc.name || ''}|${doc.irn || ''}|${doc.type || ''}`)
        .join(';');

    return `fallback:${record.Job_No || 'no-job'}:${documentsKey}`;
};

const normalizePendingRecord = (record, reason = null) => {
    const now = new Date().toISOString();

    return {
        Job_No: record.Job_No || null,
        DRN_no: record.DRN_no || null,
        documents: Array.isArray(record.documents) ? record.documents : [],
        pendingReason: reason || record.pendingReason || null,
        pendingSince: record.pendingSince || now,
        lastSeenAt: now,
        attempts: Number(record.attempts || 0)
    };
};

const loadPendingRecords = (configService) => {
    const rawValue = configService.get(PENDING_RECORDS_KEY, '[]');

    try {
        const records = JSON.parse(rawValue);
        return Array.isArray(records)
            ? records.filter(record => record && Array.isArray(record.documents))
            : [];
    } catch (error) {
        console.warn(`Could not parse ${PENDING_RECORDS_KEY}; starting with empty queue: ${error.message}`);
        return [];
    }
};

const savePendingRecords = async (configService, pendingRecords) => {
    const recordsToSave = pendingRecords
        .slice(-MAX_PENDING_RECORDS)
        .map(record => normalizePendingRecord(record, record.pendingReason));

    if (!configService.isStorageAvailable()) {
        console.warn('Supabase not configured; pending IRN-DRN records cannot persist between runs');
        return false;
    }

    return configService.set(PENDING_RECORDS_KEY, JSON.stringify(recordsToSave));
};

const mergePendingWithCurrent = (pendingRecords, currentRecords) => {
    const merged = new Map();

    for (const record of pendingRecords) {
        merged.set(getRecordKey(record), normalizePendingRecord(record, record.pendingReason));
    }

    for (const record of currentRecords) {
        const key = getRecordKey(record);
        const previous = merged.get(key);

        merged.set(key, {
            ...normalizePendingRecord(record, previous?.pendingReason),
            pendingSince: previous?.pendingSince || new Date().toISOString(),
            attempts: previous?.attempts || 0
        });
    }

    return Array.from(merged.values());
};

module.exports = {
    PENDING_RECORDS_KEY,
    MAX_PENDING_RECORDS,
    getRecordKey,
    normalizePendingRecord,
    loadPendingRecords,
    savePendingRecords,
    mergePendingWithCurrent
};
