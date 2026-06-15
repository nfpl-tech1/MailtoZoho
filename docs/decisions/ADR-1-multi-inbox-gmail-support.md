# ADR-1: Multi-Inbox Gmail Support with In-Memory Deduplication

<!-- Status: PROPOSED -->
<!-- Created: 2026-06-15 -->
<!-- Last Updated: 2026-06-15 -->
<!-- Work Item: FEAT-1 -->

---

## Status

PROPOSED

---

## Context

eSanchit processes emails from a single Gmail inbox per feature (IRN-DRN Tracker, Record Query), with credentials loaded from GMAIL_USER and GMAIL_APP_PASSWORD environment variables at module load time. This is hardwired in two places: GmailImapService (L22-24 reads process.env in constructor) and GmailService (L16 evaluates useImap at module load).

Multiple Nagarkot business units share the same Zoho Creator instance but use separate Gmail inboxes. The current architecture cannot serve more than one inbox without running separate deployments.

Additionally, when multiple inboxes process email in the same run, the same email may appear from two inboxes (forwarding, shared senders), or two inboxes may produce records with the same business key (DRN number for IRN-DRN, BE number + query for Record Query). Without deduplication, Zoho receives duplicate records.

The settings UI is dark-themed and has no inbox management card. Inbox credentials cannot be managed through the existing saveSettings() path because that path writes flat key-value pairs to the config table; inboxes are structured rows in a separate table.

---

## Decision Drivers

- GmailImapService and GmailService must accept runtime credentials without breaking the existing env-var-based initialization path
- SupabaseService is a singleton; its existing methods must not be disrupted
- Both feature email controllers exceed or approach the 300-line hard limit
- config.controller.js is already at 443 lines — cannot absorb inbox CRUD
- The IRN-DRN pending buffer must continue to work without modification
- Feature folders must not import from each other
- Utils are pure functions with no side effects

---

## Decision

**Constructor parameter injection with env-var fallback** across GmailImapService, GmailService, and both EmailProcessor classes; table-scoped request methods added to SupabaseService; per-run processor instantiation replacing module-scope singletons; new InboxController and inbox.routes.js for CRUD; in-memory dedup in each controller's processEmails handler before Zoho push.

### Implementation Approach

#### Prerequisites

Extract pending buffer helpers from IRN-DRN email controller (401 lines, hard limit 300) into `src/services/irn-drn-tracker/pendingBuffer.service.js`.

#### Create

1. **`src/services/irn-drn-tracker/pendingBuffer.service.js`** — extracted pending buffer logic (getRecordKey, normalizePendingRecord, loadPendingRecords, savePendingRecords, mergePendingWithCurrent)

2. **`src/controllers/inbox.controller.js`** — CRUD handlers for inboxes Supabase table (listInboxes, createInbox, updateInbox, deleteInbox). Redacts app_password in list responses.

3. **`src/routes/inbox.routes.js`** — GET/POST/PATCH/DELETE `/api/inboxes`

4. **Supabase `inboxes` table:**
```sql
create table inboxes (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  email text not null,
  app_password text not null,
  irn_drn_enabled boolean not null default true,
  record_query_enabled boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

#### Modify

5. **`src/services/common/gmail-imap.service.js`** — Constructor `({ user, password } = {})` with env-var fallback

6. **`src/services/common/gmail.service.js`** — Constructor `({ user, password } = {})`, pass through to GmailImapService

7. **`src/services/irn-drn-tracker/emailProcessor.service.js`** — Constructor `(gmailService = null)`, fallback to `new GmailService()`

8. **`src/services/record-query/emailProcessor.service.js`** — Same pattern

9. **`src/services/common/supabase.service.js`** — Add table-scoped methods: getFromTable, insertToTable, updateInTable, deleteFromTable

10. **`src/controllers/irn-drn-tracker/email.controller.js`** — Remove pending buffer code (imported from service), multi-inbox loop, in-memory dedup via Map before pushToZoho

11. **`src/controllers/record-query/email.controller.js`** — Multi-inbox loop, in-memory dedup via Map before Zoho push

12. **`src/utils/record-query/textFileParser.js`** — Add `getRecordQueryKey(parsedResult)` pure function

13. **`src/routes/index.js`** — Register `/api/inboxes`

14. **`public/settings.html`** — Light mode (bg #F4F6FA, primary #1A3E70, accent #D71F26), new Email Inboxes card with own CRUD buttons

#### Do Not Change

- `src/services/common/config.service.js` — inbox data does not flow through ConfigService
- `src/controllers/config.controller.js` — already over hard limit, no new code
- `src/routes/cron.routes.js` — same endpoints, handlers modified internally
- IRN-DRN pending buffer logic (moved, not redesigned)

#### Contracts

- GmailImapService MUST fall back to process.env when no credentials passed
- Module-scope emailProcessor singletons are retired from both controllers
- app_password MUST be redacted in GET /api/inboxes responses
- Dedup occurs within a single processEmails invocation only, never across runs
- Feature folders must not import from each other for dedup logic

---

## Alternatives Considered

### Factory function pattern for GmailImapService
Rejected: naming convention conflict (`getXxxService()` = singleton, but this is not a singleton). No structural benefit over constructor params.

### Separate InboxService wrapping SupabaseService
Rejected: pure delegation wrapper with zero encapsulation value. Table-scoped methods on SupabaseService achieve same result with less code.

### Extending config.controller.js with inbox CRUD
Rejected: file is at 443 lines, 143 lines over 300-line hard limit. Constitutionally prohibited.

---

## Consequences

### Positive
- Multiple Gmail inboxes without separate deployments
- In-memory dedup prevents duplicate Zoho records
- IRN-DRN controller brought within 300-line hard limit
- Brand-consistent light theme UI

### Negative
- Per-run processor instantiation cost (negligible for 2-5 inboxes)
- Two credential locations (env vars + Supabase)
- app_password plaintext in Supabase (consistent with existing config storage)

### Risks
- Supabase unavailable at cron time → falls back to env-var single inbox
- Supabase compromise exposes inbox credentials → mitigate with RLS (follow-up)
