const { getSupabaseService } = require('../services/common/supabase.service');
const { getConfigService } = require('../services/common/config.service');

const INBOXES_TABLE = 'inboxes';

const redactInbox = (inbox) => ({
    ...inbox,
    app_password: '***'
});

const listInboxes = async (req, res, next) => {
    try {
        const envInbox = envFallbackInboxes()[0];
        const envRow = envInbox.email
            ? { ...redactInbox(envInbox), source: 'env' }
            : null;

        const supabase = getSupabaseService();
        const result = await supabase.getFromTable(INBOXES_TABLE, 'select=*&order=created_at.asc');

        const supaRows = (result.success ? result.data || [] : []).map(redactInbox);
        const all = envRow ? [envRow, ...supaRows] : supaRows;

        res.json({ success: true, data: all });
    } catch (error) {
        next(error);
    }
};

const createInbox = async (req, res, next) => {
    try {
        const { label, email, app_password, irn_drn_enabled, record_query_enabled } = req.body;

        if (!label || !email || !app_password) {
            return res.status(400).json({
                success: false,
                error: 'label, email, and app_password are required'
            });
        }

        const supabase = getSupabaseService();
        const result = await supabase.insertToTable(INBOXES_TABLE, {
            label,
            email,
            app_password,
            irn_drn_enabled: irn_drn_enabled !== undefined ? Boolean(irn_drn_enabled) : true,
            record_query_enabled: record_query_enabled !== undefined ? Boolean(record_query_enabled) : false
        });

        if (!result.success) {
            return res.status(502).json({ success: false, error: result.error });
        }

        const created = Array.isArray(result.data) ? result.data[0] : result.data;
        res.status(201).json({ success: true, data: redactInbox(created) });
    } catch (error) {
        next(error);
    }
};

const updateInbox = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { label, email, app_password, irn_drn_enabled, record_query_enabled } = req.body;

        const updates = {};
        if (label !== undefined) updates.label = label;
        if (email !== undefined) updates.email = email;
        if (app_password !== undefined) updates.app_password = app_password;
        if (irn_drn_enabled !== undefined) updates.irn_drn_enabled = Boolean(irn_drn_enabled);
        if (record_query_enabled !== undefined) updates.record_query_enabled = Boolean(record_query_enabled);

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ success: false, error: 'No fields to update' });
        }

        const supabase = getSupabaseService();
        const result = await supabase.updateInTable(INBOXES_TABLE, `id=eq.${encodeURIComponent(id)}`, updates);

        if (!result.success) {
            return res.status(502).json({ success: false, error: result.error });
        }

        const updated = Array.isArray(result.data) ? result.data[0] : result.data;
        res.json({ success: true, data: updated ? redactInbox(updated) : null });
    } catch (error) {
        next(error);
    }
};

const deleteInbox = async (req, res, next) => {
    try {
        const { id } = req.params;

        const supabase = getSupabaseService();
        const result = await supabase.deleteFromTable(INBOXES_TABLE, `id=eq.${encodeURIComponent(id)}`);

        if (!result.success) {
            return res.status(502).json({ success: false, error: result.error });
        }

        res.json({ success: true });
    } catch (error) {
        next(error);
    }
};

/**
 * Load inboxes from Supabase. Falls back to single env-var inbox when Supabase
 * is unavailable or the inboxes table is empty.
 */
const loadInboxes = async () => {
    const envInbox = envFallbackInboxes()[0];
    const all = envInbox.email ? [envInbox] : [];

    try {
        const supabase = getSupabaseService();
        if (supabase.isConfigured()) {
            const result = await supabase.getFromTable(INBOXES_TABLE, 'select=*&order=created_at.asc');
            if (result.success && Array.isArray(result.data)) {
                const envEmail = (envInbox.email || '').toLowerCase();
                for (const row of result.data) {
                    if (row.email.toLowerCase() !== envEmail) {
                        all.push(row);
                    }
                }
            }
        }
    } catch (err) {
        console.warn('loadInboxes: Supabase unavailable, using env fallback:', err.message);
    }

    return all;
};

const envFallbackInboxes = () => {
    const configService = getConfigService();
    return [
        {
            email: configService.get('GMAIL_USER', ''),
            app_password: configService.get('GMAIL_APP_PASSWORD', ''),
            irn_drn_enabled: true,
            record_query_enabled: true,
            label: 'Default (ENV)'
        }
    ];
};

module.exports = {
    listInboxes,
    createInbox,
    updateInbox,
    deleteInbox,
    loadInboxes
};
