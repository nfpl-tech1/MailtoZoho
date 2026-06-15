# FEAT-1: Multi-Inbox Support, Email Deduplication & Pending Buffer

<!-- STATUS: DONE -->
<!-- Last Updated: 2026-06-15 -->

---

## Metadata

| Field | Value |
|-------|-------|
| ID | FEAT-1 |
| Type | FEAT |
| Status | DONE |
| Classification | MACRO |
| Created | 2026-06-15 |
| Updated | 2026-06-15 |
| Closed | 2026-06-15 |

| Blocked Reason | — |
|----------------|---|

---

## Success Criteria

- [ ] Multiple Gmail inboxes can be added, edited, enabled/disabled, and deleted via the Settings UI
- [ ] Each inbox has: label, Gmail address, App Password, per-feature toggles (IRN-DRN, Record Query)
- [ ] Inbox credentials are stored in Supabase `inboxes` table
- [ ] Both IRN-DRN and Record Query cron triggers iterate over all enabled inboxes
- [ ] In-memory deduplication per cron run: IRN-DRN by DRN number, Record Query by BE number + query content
- [ ] Falls back to `GMAIL_USER`/`GMAIL_APP_PASSWORD` env vars when no inboxes configured in Supabase
- [ ] Settings UI is converted from dark mode to light mode with Nagarkot brand colors (Blue #1A3E70, Red #D71F26)
- [ ] Existing IRN-DRN pending buffer and Record Query notification emails unchanged
- [ ] Existing IRN-DRN and Record Query functionality is not broken

---

## Goal

### Feature Brief (Approved 2026-06-15)

**Purpose:** Nagarkot Forwarder added a second icegate portal account. eSanchit emails now arrive across two Gmail addresses. The system only monitors one, so emails from the second account have been missed for ~a week.

**Users:** Internal operations staff managing the system via the Settings page.

**Feature Lifecycle:**
1. Operator adds inboxes in Settings (label, Gmail address, App Password, feature toggles)
2. Inboxes stored in Supabase `inboxes` table; falls back to env vars if none configured
3. On cron trigger, system iterates all enabled inboxes and collects emails
4. In-memory dedup before processing: IRN-DRN by DRN number; Record Query by BE number + query content
5. Deduplicated emails processed normally (Zoho push, pending buffer for IRN-DRN, notification email for Record Query failures)
6. Dedup memory discarded after each run

**Business Rules:**
1. Each inbox: label + email + app password + at least one feature toggle on
2. Inboxes with a feature toggled off are not checked for that feature
3. No Supabase inboxes → fallback to GMAIL_USER/GMAIL_APP_PASSWORD env vars
4. Dedup is in-memory only, per cron run, first occurrence wins
5. All inboxes share the same Zoho credentials
6. IMAP auth only (no OAuth2)
7. IRN-DRN pending buffer unchanged; Record Query keeps notification-email approach (no buffer added)

**UI:**
- Dark → Light mode conversion
- Brand colors: Blue #1A3E70, Red #D71F26, White #FFFFFF, Black #000000
- New "Email Inboxes" card with list view, add/edit/delete actions

---

## Scope

### Included

- Supabase `inboxes` table (CRUD for inbox management)
- API endpoints for inbox management (list, create, update, delete)
- Multi-inbox iteration in both email processor services
- In-memory deduplication per cron run for both features
- Settings UI: inbox management card + dark-to-light mode conversion with Nagarkot brand colors
- Fallback to env var credentials when no Supabase inboxes exist

### Excluded

- Inbox credential encryption (plain text in Supabase per user decision)
- Per-inbox Zoho credentials (all inboxes share the same Zoho account)
- Persistent dedup storage (dedup is in-memory only, per cron run)
- Record Query pending buffer (keep existing notification email approach)
- Gmail OAuth2 path changes (IMAP-only)

---

## Related Audit Findings

EMAIL-2
CC-1

---

## Classification Rationale

MACRO: Requires new Supabase tables (schema change), new API endpoints for inbox CRUD (API contract change), cross-layer change to how email processors obtain credentials, and this architectural decision constrains how all future email features must be built (must support multi-inbox path). ADR mandatory.

---

## Investigation

### Findings

**F1: GmailImapService credentials hardcoded from process.env**
- Evidence: `gmail-imap.service.js` L22-24 reads `process.env.GMAIL_USER`/`GMAIL_APP_PASSWORD` in constructor
- `gmail.service.js` L16 evaluates `useImap` at module load time
- Impact: No mechanism to pass per-inbox credentials. Root cause of EMAIL-2.

**F2: Both EmailProcessors instantiate GmailService with no credential arguments**
- Evidence: `irn-drn-tracker/emailProcessor.service.js` L11, `record-query/emailProcessor.service.js` L12
- Impact: Must accept credentials or accept a pre-constructed GmailService

**F3: Module-scope singleton caching in both controllers (CC-1)**
- Evidence: Both `email.controller.js` files L12-14, L18-24 use `let emailProcessor = null` pattern
- Impact: Incompatible with per-inbox processor instantiation

**F4: SupabaseService hardcoded to 'config' table**
- Evidence: `supabase.service.js` L10 `this.tableName = 'config'`
- Impact: No support for `inboxes` table without changes

**F5: Cron flow is single-inbox — one fetch per processEmails call**
- Evidence: `cron.routes.js` L51, L58 call controllers once; controllers call processors once
- Impact: Multi-inbox requires iteration loop in processEmails handlers

**F6: DRN dedup key already exists — getRecordKey() in IRN-DRN controller**
- Evidence: `irn-drn-tracker/email.controller.js` L39-47 — keys by `drn:{DRN_no}`
- Impact: Can reuse for in-memory dedup across inboxes

**F7: Record Query has beNumber + query available for dedup**
- Evidence: `textFileParser.js` returns `{ beNumber, query }`; controller uses at L105
- Impact: Dedup key = `beNumber:query` after aggregating all inbox results

**F8: IRN-DRN pending buffer uses configService — already working**
- Evidence: `irn-drn-tracker/email.controller.js` L36-88 — load/save/merge pattern
- Impact: No change needed

**F9: Record Query notification emails work independently of inbox source**
- Evidence: `record-query/email.controller.js` L268-286; notification service uses separate SMTP credential
- Impact: No change needed for notification path

**F10: Settings UI dark mode, no Inboxes card, saveSettings() collects all inputs globally**
- Evidence: `settings.html` L22-26 (dark bg), L1444-1456 (querySelectorAll collection)
- Impact: Inbox card needs separate CRUD path, not global saveSettings()

**F11: No inbox CRUD API endpoints exist**
- Evidence: `config.routes.js` has no inbox routes; `config.controller.js` has no inbox handlers
- Impact: New routes + controller needed

### Relevant Files

| File | Purpose | Relevance |
|------|---------|-----------|
| `src/services/common/gmail-imap.service.js` | IMAP email fetch | Must accept per-inbox credentials |
| `src/services/common/gmail.service.js` | Gmail wrapper | Module-scope useImap flag needs rework |
| `src/services/irn-drn-tracker/emailProcessor.service.js` | IRN-DRN fetch+parse | Instantiates GmailService; needs credential injection |
| `src/services/record-query/emailProcessor.service.js` | Record Query fetch+parse | Same as above |
| `src/controllers/irn-drn-tracker/email.controller.js` | IRN-DRN cron handler | Inbox iteration loop + dedup insertion point |
| `src/controllers/record-query/email.controller.js` | Record Query cron handler | Inbox iteration loop + dedup insertion point |
| `src/routes/cron.routes.js` | Cron trigger endpoints | Entry points, no changes needed |
| `src/services/common/supabase.service.js` | Supabase REST client | Needs multi-table support for `inboxes` |
| `src/controllers/config.controller.js` | Settings API | Needs inbox CRUD handlers (or new controller) |
| `src/routes/config.routes.js` | Settings routes | Needs inbox CRUD routes (or new route file) |
| `public/settings.html` | Settings UI | Dark→light conversion, new Inboxes card |
| `src/services/common/index.js` | Common service re-exports | Must export any new inbox service |

### Unknowns Resolved

| Question | Answer | How Verified |
|----------|--------|--------------|
| Does SupabaseService support other tables? | No — hardcoded to 'config' | `supabase.service.js` L10 |
| Where is DRN_no extracted? | `emailProcessor.service.js` L198 in processDocumentTable() | Code read |
| Where is beNumber extracted? | `textFileParser.js` parseTextFile() returns `{ beNumber, query }` | Code read |
| Existing dedup in either feature? | IRN-DRN: partial via getRecordKey() for pending merge. RQ: none | Code read |
| Inbox API routes exist? | No — config routes only | `config.routes.js` inspection |

### Risks Identified

1. **Backward compatibility (significant):** Changing GmailService credential loading must preserve fallback to env vars when no Supabase inboxes are configured.
2. **Supabase schema (blocking):** `inboxes` table must be created via SQL before inbox CRUD can function. No migration tooling exists.
3. **saveSettings() coupling (significant):** Settings UI collects all inputs globally — inbox card inputs would be accidentally POSTed to config table unless excluded.
4. **Test coverage gap (significant):** No integration tests exist for the full email processing flow. Multi-inbox changes have no test harness.

---

## Decision

### ADR Threshold

MET

### Approach

Constructor parameter injection with env-var fallback across GmailImapService, GmailService, and both EmailProcessor classes. Table-scoped methods added to SupabaseService. Per-run processor instantiation replacing module-scope singletons. New InboxController + inbox.routes.js for CRUD. In-memory dedup in each controller's processEmails handler. IRN-DRN controller split (extract pending buffer) as prerequisite. Settings UI light theme with separate inbox card.

### ADR Reference

ADR-1 — `docs/decisions/ADR-1-multi-inbox-gmail-support.md`

### Alternatives Considered

1. **Factory function for GmailImapService** — Rejected: naming convention conflict, no benefit over constructor params.
2. **Separate InboxService class** — Rejected: pure delegation wrapper, zero encapsulation value.
3. **Extend config.controller.js** — Rejected: already 443 lines (143 over hard limit).

---

## Approval

### Approved By

User

### Approval Date

2026-06-15

### Approval Notes

Approved without modifications.

---

## Implementation Notes

| File | Change Description |
|------|--------------------|
| `src/services/irn-drn-tracker/pendingBuffer.service.js` | CREATED — extracted pending buffer logic from controller |
| `src/controllers/inbox.controller.js` | CREATED — CRUD handlers + loadInboxes() helper with env fallback |
| `src/routes/inbox.routes.js` | CREATED — GET/POST/PATCH/DELETE /api/inboxes |
| `test/pending-buffer.test.js` | CREATED — 11 tests for pending buffer functions |
| `test/record-query-key.test.js` | CREATED — 6 tests for getRecordQueryKey |
| `src/services/common/gmail-imap.service.js` | MODIFIED — constructor accepts {user, password} with env fallback |
| `src/services/common/gmail.service.js` | MODIFIED — constructor accepts {user, password}, forces IMAP when injected |
| `src/services/irn-drn-tracker/emailProcessor.service.js` | MODIFIED — constructor accepts gmailService param |
| `src/services/record-query/emailProcessor.service.js` | MODIFIED — constructor accepts gmailService param |
| `src/services/common/supabase.service.js` | MODIFIED — added getFromTable, insertToTable, updateInTable, deleteFromTable |
| `src/controllers/irn-drn-tracker/email.controller.js` | MODIFIED — multi-inbox loop, dedup, extracted pending buffer (299 lines) |
| `src/controllers/record-query/email.controller.js` | MODIFIED — multi-inbox loop, dedup, extracted Zoho push helper (219 lines) |
| `src/utils/record-query/textFileParser.js` | MODIFIED — added getRecordQueryKey() |
| `src/routes/index.js` | MODIFIED — registered /api/inboxes |
| `public/settings.html` | MODIFIED — light mode + Email Inboxes card with CRUD |

### Notes

---

## Verification

| Check | Result | Evidence |
|-------|--------|----------|
| Build | N/A | No build step — Node.js runtime project |
| Tests | PASS | `node --test test/*.test.js` — 28 tests, 0 failures (includes new pending-buffer and record-query-key tests) |
| Lint | PASS | `npx eslint@8 .` — 0 errors, 33 warnings (all pre-existing, none introduced) |
| Typecheck | N/A | No TypeScript in project |
| Scope Compliance | PASS | All changes match approved scope — multi-inbox, dedup, UI light mode, inbox CRUD |
| Documentation Sync | PASS | ADR-1 created, work item fully populated |

---

## Review History

### Review #1

**Verdict:** FAIL

**Findings:**

| ID | Observation | Evidence | Required Fix |
|----|-------------|----------|--------------|
| RV-1 | `envFallbackInboxes()` reads `process.env.GMAIL_USER` and `process.env.GMAIL_APP_PASSWORD` directly, bypassing config priority | `inbox.controller.js` L128-129 | Replace with `getConfigService().get()` calls |

**Observations:**
1. ADR-1 approved `new GmailService()` inline in handlers (tension with Principle 4, but ADR governs)
2. Controller imports `getRecordQueryKey` from `utils/` (tension with module boundary rule, but ADR governs)
3. `loadInboxes()` imported cross-controller — cleaner as a service, but ADR rejected InboxService
4. Inboxes route not in health check features object (non-blocking cleanup)

**Fix applied:** Replaced `process.env` reads with `getConfigService().get()` in `inbox.controller.js`. Re-verification: 28 tests pass, 0 lint errors.

### Review #2

**Verdict:** PASS

**Findings:**

| ID | Observation | Evidence | Required Fix |
|----|-------------|----------|--------------|
| — | RV-1 fix verified | `inbox.controller.js` L2, L127-138 — no `process.env` reads remain | — |

**Observations:** None. Minimal targeted fix, no regressions.

---

## Follow-up Opportunities

---

## Status History

| Date | Transition | Note |
|------|------------|------|
| 2026-06-15 | Created → INVESTIGATING | Work item created by /implement. Related High findings EMAIL-2 and CC-1 overlap scope but will be resolved by this feature. User chose to proceed. |
| 2026-06-15 | INVESTIGATING → FEATURE_ANALYSIS_COMPLETE | Feature Brief approved by user. Dedup is in-memory only (no persistent table). Record Query keeps notification email approach (no pending buffer). UI uses Nagarkot brand colors. |
| 2026-06-15 | FEATURE_ANALYSIS_COMPLETE → NEEDS_DECISION | Investigation complete. Key decisions: credential injection architecture, SupabaseService multi-table support, inbox CRUD placement. |
| 2026-06-15 | NEEDS_DECISION → APPROVAL_PENDING | ADR-1 created. Approach: constructor param injection, table-scoped Supabase methods, new InboxController, per-run processor instantiation, in-memory dedup. |
| 2026-06-15 | APPROVAL_PENDING → APPROVED | User approved without modifications. |
| 2026-06-15 | APPROVED → IMPLEMENTING | Implementer invoked. |
| 2026-06-15 | IMPLEMENTING → IMPLEMENTED | All 15 files created/modified. 28 tests pass, 0 lint errors. Verification complete. |
| 2026-06-15 | IMPLEMENTED → IMPLEMENTING | Review #1 FAIL: RV-1 process.env read in inbox.controller.js. Fix applied. |
| 2026-06-15 | IMPLEMENTING → IMPLEMENTED | RV-1 fix applied. Re-verification: 28 tests pass, 0 lint errors. |
| 2026-06-15 | IMPLEMENTED → DONE | Review #2 PASS. Archiving. |
