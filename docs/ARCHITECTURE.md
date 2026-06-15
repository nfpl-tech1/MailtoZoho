<!-- STATUS: ACTIVE -->
<!-- Last Updated: 2026-06-15 -->

# Architecture — eSanchit Email Automation

## System Overview

eSanchit is a Node.js/Express backend that automates customs documentation workflows:

1. **Gmail IMAP** fetches emails matching configurable subject keywords
2. **Parsers** extract structured data (IRN/DRN numbers, customs queries) from email HTML tables and text attachments
3. **Zoho Creator API** pushes extracted data to the Shakti 3.0 app (forms, subforms, lookup fields)
4. **cron-job.org** triggers processing runs on a configurable schedule
5. **Supabase** stores configuration overrides editable via a web dashboard
6. **Nodemailer** sends error notification emails when processing fails

```
┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│  cron-job.org│────▶│  Express API │────▶│  Gmail IMAP  │
│  (scheduler) │     │  (Vercel)    │     │  (fetch)     │
└──────────────┘     └──────┬───────┘     └──────────────┘
                            │
                   ┌────────┼────────┐
                   ▼        ▼        ▼
             ┌─────────┐ ┌───────┐ ┌──────────┐
             │ Parsers  │ │ Zoho  │ │ Supabase │
             │ (utils)  │ │ API   │ │ (config) │
             └─────────┘ └───────┘ └──────────┘
```

**Deployment:** Vercel (serverless). Auto-deploys on push to `main`.
**Live URL:** `https://mailtozoho.vercel.app`

---

## Directory Structure

```
src/
├── index.js                          # Entry point — Express app setup, middleware, route mounting
├── config/
│   └── index.js                      # Reads .env into structured config object (static defaults)
├── middleware/
│   └── errorHandler.js               # 404 handler + global error handler
├── routes/                           # HTTP route definitions (zero business logic)
│   ├── index.js                      # Aggregates all route modules, health check
│   ├── irn-drn-tracker/index.js      # IRN-DRN feature routes
│   ├── record-query/index.js         # Record Query feature routes
│   ├── config.routes.js              # Settings API routes
│   ├── cron.routes.js                # Cron endpoints with secret validation
│   ├── auth.routes.js                # Password authentication routes
│   ├── inbox.routes.js               # Inbox CRUD routes (/api/inboxes)
│   ├── email.routes.js               # LEGACY — redirects to irn-drn-tracker
│   └── zoho.routes.js                # LEGACY — redirects to irn-drn-tracker
├── controllers/                      # Request handling + orchestration
│   ├── irn-drn-tracker/
│   │   ├── email.controller.js       # Email processing + Zoho push (multi-inbox + dedup)
│   │   └── zoho.controller.js        # Direct Zoho CRUD endpoints
│   ├── record-query/
│   │   ├── email.controller.js       # Email processing + batch Zoho push (multi-inbox + dedup)
│   │   └── zoho.controller.js        # Debug/lookup endpoints
│   ├── inbox.controller.js           # Inbox CRUD + loadInboxes helper (env-var fallback)
│   ├── auth.controller.js            # Settings page password verification
│   ├── config.controller.js          # Settings CRUD + cron sync
│   ├── email.controller.js           # LEGACY — unused dead code
│   └── zoho.controller.js            # LEGACY — unused dead code
├── services/                         # Business logic and external integrations
│   ├── common/                       # Shared across all features
│   │   ├── index.js                  # Re-exports all common services
│   │   ├── gmail.service.js          # Gmail gateway — constructor({ user, password }) with IMAP fallback
│   │   ├── gmail-imap.service.js     # IMAP email fetching — constructor({ user, password }) with env fallback
│   │   ├── config.service.js         # ConfigService singleton — Supabase overrides > .env
│   │   ├── supabase.service.js       # Supabase REST client — config + generic table methods
│   │   ├── cronjob.service.js        # cron-job.org API client
│   │   ├── zoho/                     # Zoho Creator API (modular)
│   │   │   ├── index.js              # ZohoService class — facade over all modules
│   │   │   ├── config.js             # Zoho config from ConfigService
│   │   │   ├── auth.js               # OAuth2 token refresh + caching
│   │   │   ├── records.js            # CRUD: getRecords, createRecord, updateRecord, batch
│   │   │   ├── batch-lookup.js       # Batch lookups: jobs by BE#, jobs by Job#, record queries
│   │   │   ├── irn-drn.js            # IRN-DRN specific: job lookup, push logic
│   │   │   └── record-query.js       # Record Query specific: lookup, append query
│   │   └── email-notification/       # Error alerting
│   │       ├── index.js              # Singleton factory
│   │       ├── service.js            # Send single/batch failure notifications
│   │       ├── templates.js          # HTML email templates
│   │       └── transporter.js        # Nodemailer Gmail transporter setup
│   ├── irn-drn-tracker/
│   │   ├── index.js                  # Re-export EmailProcessor
│   │   ├── emailProcessor.service.js # Fetch emails → parse HTML tables → extract Job/DRN/IRN
│   │   └── pendingBuffer.service.js  # Pending record buffer: load, save, merge, deduplicate
│   ├── record-query/
│   │   ├── index.js                  # Re-export RecordQueryEmailProcessor
│   │   └── emailProcessor.service.js # Fetch emails → download attachments → parse text files
│   └── emailProcessor.service.js     # LEGACY — old version, unused
├── utils/
│   ├── htmlTableParser.js            # LEGACY — duplicate of irn-drn-tracker version
│   ├── irn-drn-tracker/
│   │   ├── index.js                  # Re-export
│   │   └── htmlTableParser.js        # Extract tables from HTML, convert to JSON
│   └── record-query/
│       ├── index.js                  # Re-export
│       └── textFileParser.js         # Parse customs query text files; getRecordQueryKey for dedup
public/
└── settings.html                     # Web dashboard — light mode, Email Inboxes card
test/
├── irn-drn-parser.test.js            # IRN-DRN HTML table parser tests
├── auth.test.js                      # Auth timing-safe compare tests
├── pending-buffer.test.js            # IRN-DRN pending buffer pure function tests
└── record-query-key.test.js          # getRecordQueryKey utility tests
```

Items marked **LEGACY** are dead code from the pre-modular architecture. They are audit findings pending removal.

---

## Feature Module Structure

Each email-processing feature follows the same structure:

```
controllers/{feature}/
├── email.controller.js    # Orchestrates: fetch → parse → push to Zoho
└── zoho.controller.js     # Direct Zoho endpoints (debug, lookup, create)

services/{feature}/
├── index.js               # Re-exports
└── emailProcessor.service.js  # Core processing: fetch emails, parse content

utils/{feature}/
├── index.js               # Re-exports
└── {parser}.js            # Pure parsing functions (no side effects)

routes/{feature}/
└── index.js               # Route definitions delegating to controllers
```

To add a new feature, replicate this structure. Register the new routes in `src/routes/index.js` and add a cron endpoint in `src/routes/cron.routes.js`.

---

## Zoho Service Architecture

The `services/common/zoho/` directory is modular:

- **config.js** — Reads Zoho credentials from ConfigService (not from `process.env` directly)
- **auth.js** — Manages OAuth2 token refresh with in-memory caching (55-min TTL)
- **records.js** — Generic CRUD operations against any Zoho Creator form/report
- **batch-lookup.js** — Optimized multi-record lookups using OR criteria (1 API call instead of N)
- **irn-drn.js** — IRN-DRN specific operations (job lookup by Job_No, push with subforms)
- **record-query.js** — Record Query specific operations (lookup by Job ID, append queries)
- **index.js** — `ZohoService` class acts as a facade, re-exporting all module functions as methods

**Zoho API versions used:**
- v2 — Standard CRUD operations
- v2.1 — Batch record creation (up to 200 records) and full subform data retrieval

---

## Configuration System

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  .env file  │────▶│ ConfigService│◀────│  Supabase   │
│  (defaults) │     │  (singleton) │     │  (overrides)│
└─────────────┘     └──────┬───────┘     └─────────────┘
                           │
              ┌────────────┼───────────┐
              ▼            ▼           ▼
         Controllers   Services   Settings UI
```

**Priority:** Supabase override > `.env` value > hardcoded default

- **Read path:** `getConfigService().get(key, default)` — checks Supabase cache first, then `process.env`
- **Write path:** `getConfigService().set(key, value)` — writes to Supabase, updates in-memory cache
- **Cache:** Auto-reloads from Supabase if cache is older than 5 minutes
- **Settings UI:** `public/settings.html` reads/writes via `/api/config/settings` endpoints

---

## Data Flow — IRN-DRN Tracker

1. Cron triggers `POST /api/cron/irn-drn-tracker`
2. Controller loads config, merges pending records from Supabase buffer
3. `EmailProcessor.fetchAndParseTables()` connects to Gmail IMAP, searches by subject keyword
4. For each email: parse HTML → extract tables → find Job ID (IR pattern) → extract DRN + documents
5. Batch lookup all Job Numbers in Zoho (1 API call)
6. Batch create records in Zoho with subform data (1 API call)
7. Records that fail job lookup go to pending buffer (persisted in Supabase for retry)

## Data Flow — Record Query

1. Cron triggers `POST /api/cron/record-query`
2. Controller loads config
3. `RecordQueryEmailProcessor.fetchAndProcessEmails()` connects to Gmail IMAP, fetches emails with attachments
4. For each email: download `.txt` attachment → parse location code + BE Number + date + query text
5. Batch lookup all Jobs by BE Number (1 API call)
6. Batch lookup existing Record Queries (1 API call)
7. For each parsed query: update existing record (append to subform) or create new record
8. Send error notification email for any failures

---

## External Dependencies

| System | Purpose | Auth Method |
|--------|---------|-------------|
| Gmail | Email fetching | IMAP + App Password (never expires) |
| Zoho Creator | Data storage (Shakti 3.0) | OAuth2 refresh token |
| Supabase | Config storage | Anon key (REST API) |
| cron-job.org | Scheduling | Bearer token (API key) |
| Gmail (SMTP) | Error notifications | Same App Password as IMAP |

---

## References

- [Express.js API Reference](https://expressjs.com/en/4x/api.html) — Express 4.x
- [ImapFlow Documentation](https://imapflow.com/) — IMAP client
- [Zoho Creator API v2](https://www.zoho.com/creator/help/api/v2/) — Record CRUD
- [Zoho Creator API v2.1](https://www.zoho.com/creator/help/api/v2.1/) — Batch operations
- [Supabase REST API](https://supabase.com/docs/guides/api) — PostgREST
- [cron-job.org API](https://docs.cron-job.org/rest-api.html) — Cron management
