# Audit Tracker

<!-- STATUS: OPEN FINDINGS ONLY -->
<!-- Last Updated: 2026-06-15 -->
<!-- Audit Pass #: 1 -->
<!-- Layers Covered: Backend/API, Email Processing, External API Integration (Zoho), Data Parsing/Utils, Configuration System, External Scheduling, Error Notification, Web UI (Settings), Cloud Storage (Supabase), Tests, Deployment/Infrastructure, Cross-Cutting -->

<!--
PURPOSE
This file contains ONLY open audit findings.
It answers one question: "What is currently known to be wrong with the codebase?"

FINDING ID PREFIXES
  API-x     Backend/API
  EMAIL-x   Email Processing
  ZOHO-x    External API Integration (Zoho)
  PARSE-x   Data Parsing/Utils
  CFG-x     Configuration System
  CRON-x    External Scheduling
  NOTIF-x   Error Notification
  UI-x      Web UI (Settings)
  SUPA-x    Cloud Storage (Supabase)
  TEST-x    Tests
  INFRA-x   Deployment/Infrastructure
  CC-x      Cross-Cutting

Numbers come from docs/meta/COUNTERS.md. Read current value, increment, use.

SEVERITY DEFINITIONS
  Critical — Security vulnerabilities, auth bypasses, data corruption, exposed secrets
  High     — Major architectural violations, dead code with confusion risk, missing critical tests
  Medium   — Maintainability concerns, moderate duplication, approaching size limits
  Low      — Naming inconsistencies, minor doc drift, cosmetic issues

OWNERSHIP
  /constitute — initial audit
  /audit      — re-audits
-->

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0     |
| High     | 10    |
| Medium   | 12    |
| Low      | 7     |
| **Total**| **29**|

---

## Priority Rules for /implement

```
Rule 1 — Critical Block
If any Critical finding exists: STOP. Critical findings block all feature work.

Rule 2 — Related High Block
If any High finding overlaps the requested work scope: STOP. Resolve first.

Rule 3 — Unrelated High (Advisory)
Surface them. Do not block. User decides.

Rule 4 — Medium and Low (Non-blocking)
Surface only when directly relevant to the work being requested.
```

---

## Findings

### Layer: Backend/API

| ID | Sev | Issue | Location | Evidence | Recommended Fix |
|----|-----|-------|----------|----------|-----------------|
| API-1 | High | LEGACY controller and route files are live-routed and reachable in production | `src/controllers/email.controller.js`, `src/controllers/zoho.controller.js`, `src/routes/email.routes.js`, `src/routes/zoho.routes.js`, `src/routes/index.js` L43–44 | Routes mounted in index.js: `router.use('/email', emailRoutes); router.use('/zoho', zohoRoutes)`. Legacy `zoho.controller.js` calls `service.pushEmailDataToZoho()` — method no longer exists on modular ZohoService, would throw TypeError in production. ARCHITECTURE.md marks these as "LEGACY — unused dead code" | Remove legacy route, controller, and service files; un-mount `/email` and `/zoho` prefixes from `src/routes/index.js` |
| API-2 | Medium | `irn-drn-tracker/email.controller.js` exceeds 300-line hard limit for controllers (401 lines) | `src/controllers/irn-drn-tracker/email.controller.js` L1–401 | Two distinct responsibility clusters: (1) pending-record buffer management L36–88, (2) Zoho push orchestration L118–256. Both belong in service layer. CLAUDE.md size trigger: controller hard limit 300 | Extract pending-buffer logic and `pushToZoho` orchestration into service-layer modules |
| API-3 | Low | `GET /api/auth/session-stats` is unprotected — any caller can enumerate active session count | `src/routes/auth.routes.js` L36–38; `src/controllers/auth.controller.js` L183–197 | `getSessionStats` handler requires no token, no password, no cron secret. Returns `totalSessions`, `activeSessions`, `expiredSessions` to any HTTP caller | Require valid session token before returning session stats, or remove endpoint |
| API-4 | Medium | `config.controller.js` has three responsibility clusters and exceeds 300-line hard limit (443 lines) | `src/controllers/config.controller.js` L1–443 | Three clusters: (1) config CRUD L14–99, (2) cron-job orchestration L104–232, (3) connection testing/debug L267–428. CLAUDE.md: single-responsibility rule and 300-line hard limit | Separate cron-job management and debug/test endpoints into their own controller files |

### Layer: Email Processing

| ID | Sev | Issue | Location | Evidence | Recommended Fix |
|----|-----|-------|----------|----------|-----------------|
| EMAIL-1 | High | LEGACY `emailProcessor.service.js` is a live module creating a second unshared GmailService instance path | `src/services/emailProcessor.service.js` L1–271; `src/controllers/email.controller.js` L6 | Legacy controller imports this service. Instantiates fresh GmailService via old dual-path (IMAP vs OAuth2). Compounds dead-code confusion from API-1 | Remove `src/services/emailProcessor.service.js` along with dependent legacy controller and routes |
| EMAIL-2 | High | Gmail service files read `process.env` directly, violating configuration rule | `src/services/common/gmail-imap.service.js` L23–24; `src/services/common/gmail.service.js` L16, L35–40 | IMAP service: `this.user = process.env.GMAIL_USER; this.password = process.env.GMAIL_APP_PASSWORD`. Gmail service: reads multiple `process.env.GOOGLE_*` keys. CLAUDE.md: "Never read `process.env` directly in services" | Replace all direct `process.env` reads with `getConfigService().get(key, default)` calls |

### Layer: External API Integration (Zoho)

| ID | Sev | Issue | Location | Evidence | Recommended Fix |
|----|-----|-------|----------|----------|-----------------|
| ZOHO-1 | High | `zoho/config.js` reads `process.env` directly — Zoho credentials unoverridable via Supabase | `src/services/common/zoho/config.js` L11–19 | `getConfig()` reads `process.env.ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`, etc. directly. CLAUDE.md: "Never read `process.env` directly in services" | Replace all `process.env` reads with `getConfigService().get(key, default)` calls |
| ZOHO-2 | High | `batch-lookup.js`, `record-query.js`, and `irn-drn.js` read `process.env` directly for report link names | `src/services/common/zoho/batch-lookup.js` L23,82,163,227; `zoho/record-query.js` L19,64,110; `zoho/irn-drn.js` L21 | Direct `process.env` reads bypass Supabase overrides. A user changing `RECORD_QUERY_REPORT_LINK_NAME` via dashboard will not have it respected | Use `getConfigService().get(key, default)` instead of `process.env` fallbacks |
| ZOHO-3 | High | `createRecordsBatch()` mutates the `data` array parameter passed by caller | `src/services/common/zoho/records.js` L377 | `data.length = 200` truncates caller's array. Caller maps results by index; truncation causes undefined entries. CLAUDE.md Never Do: "Mutate the `data` array parameter inside batch functions" | Replace `data.length = 200` with `const safeData = data.slice(0, 200)` and use `safeData` for subsequent operations |
| ZOHO-4 | Medium | `getRecordById()` reads feature-specific `process.env.RECORD_QUERY_FORM_LINK_NAME` inside generic CRUD function | `src/services/common/zoho/records.js` L103 | `formName = process.env.RECORD_QUERY_FORM_LINK_NAME || formName` — introduces Record Query concern into generic function, violating Separation of Concerns and config rule | Remove `process.env` fallback; callers should pass form name explicitly |
| ZOHO-5 | Low | `zoho/config.js` hardcodes `formLinkName` default as `'Email_Records'` while `getConfigurableKeys()` registers `'IRN_DRN_Tracker'` | `src/services/common/zoho/config.js` L17; `src/services/common/config.service.js` L322 | Two different defaults for same key: `'Email_Records'` vs `'IRN_DRN_Tracker'`. When not set in `.env` and no Supabase override, modules disagree | Align defaults to a single authoritative value |

### Layer: Data Parsing/Utils

| ID | Sev | Issue | Location | Evidence | Recommended Fix |
|----|-----|-------|----------|----------|-----------------|
| PARSE-1 | High | LEGACY `src/utils/htmlTableParser.js` is an exact duplicate of `src/utils/irn-drn-tracker/htmlTableParser.js` | `src/utils/htmlTableParser.js` (172 lines); `src/utils/irn-drn-tracker/htmlTableParser.js` (172 lines) | Both export identical functions. Legacy `emailProcessor.service.js` imports from legacy location. ARCHITECTURE.md labels it "LEGACY — duplicate" | Delete `src/utils/htmlTableParser.js`; all consumers use `src/utils/irn-drn-tracker/` |
| PARSE-2 | Medium | Controller imports directly from `utils/` in violation of module boundary rule | `src/controllers/record-query/email.controller.js` L369 | `const { parseTextFile, validateParsedData } = require('../../utils/record-query')` — CLAUDE.md: "Controllers never import from `utils/` directly — they call services" | Move parsing into a service-layer method; controller calls the service |

### Layer: Configuration System

| ID | Sev | Issue | Location | Evidence | Recommended Fix |
|----|-----|-------|----------|----------|-----------------|
| CFG-1 | Medium | `cronjob.service.js` reads `process.env.CRONJOB_API_KEY` directly inside a service | `src/services/common/cronjob.service.js` L41–44 | `getApiKey() { return process.env.CRONJOB_API_KEY; }` — CLAUDE.md: "Never read `process.env` directly in services." Key also not registered in `getConfigurableKeys()` | Use `getConfigService().get('CRONJOB_API_KEY', '')` and add to `getConfigurableKeys()` |
| CFG-2 | Medium | `debug: true` hardcoded in three services — production logging cannot be toggled without code change | `src/services/common/config.service.js` L17; `supabase.service.js` L11; `cronjob.service.js` L35 | All three have `this.debug = true` in constructor. In Vercel serverless, produces verbose output on every cold start. No config key for controlling debug verbosity | Drive `debug` from a config key or remove flag and use structured log levels |
| CFG-3 | Low | `src/config/index.js` includes full `google.oauth2` config block for disabled legacy path | `src/config/index.js` L43–51 | Fields only consumed when `useImap` is false (disabled). CLAUDE.md Never Do: "Use Gmail OAuth2 API calls — IMAP with App Password is the active path." Config block for permanently-deprecated auth path invites accidental reactivation | Remove `google:` block from `src/config/index.js` and OAuth2 code path from `gmail.service.js` |

### Layer: External Scheduling

| ID | Sev | Issue | Location | Evidence | Recommended Fix |
|----|-----|-------|----------|----------|-----------------|
| CRON-1 | Medium | `validateCronSecret` silently bypasses authentication when `CRON_SECRET` is not configured | `src/routes/cron.routes.js` L26–30 | `if (!expectedSecret) { console.log('⚠️ CRON_SECRET not configured - allowing request'); return next(); }` — unconfigured or fresh deployment exposes cron endpoints to unauthenticated invocation triggering Gmail IMAP and Zoho writes | Require `CRON_SECRET` to be set; reject with 401 if unconfigured |

### Layer: Error Notification

| ID | Sev | Issue | Location | Evidence | Recommended Fix |
|----|-----|-------|----------|----------|-----------------|
| NOTIF-1 | Low | `email-notification/service.js` reads `process.env` before `configService.get()` — priority reversed | `src/services/common/email-notification/service.js` L32–33 | `process.env.GMAIL_USER \|\| configService.get('GMAIL_USER')` — checks env first, so Supabase override never takes effect. CLAUDE.md: "Config priority: Supabase override > .env value > hardcoded default" | Replace with `configService.get('GMAIL_USER')` which implements correct priority |

### Layer: Web UI (Settings)

| ID | Sev | Issue | Location | Evidence | Recommended Fix |
|----|-----|-------|----------|----------|-----------------|
| UI-1 | Low | CORS configured with wildcard origin `'*'` — permits cross-origin requests from any domain | `src/config/index.js` L67–71 | `origin: process.env.CORS_ORIGIN \|\| '*'` — allows any origin. Vercel deployment URL is known (`mailtozoho.vercel.app`) and should be the only permitted origin | Set `CORS_ORIGIN` to production Vercel URL with non-wildcard default |

### Layer: Cloud Storage (Supabase)

| ID | Sev | Issue | Location | Evidence | Recommended Fix |
|----|-----|-------|----------|----------|-----------------|
| SUPA-1 | Medium | `supabase.service.js` reads `process.env.SUPABASE_URL` and `SUPABASE_ANON_KEY` directly in constructor | `src/services/common/supabase.service.js` L8–9 | `this.url = process.env.SUPABASE_URL; this.anonKey = process.env.SUPABASE_ANON_KEY` — CLAUDE.md: "Never read `process.env` directly in services." Bootstrap keys present chicken-and-egg problem but pattern should be consistent | Read from `src/config/index.js` (static config module) instead of direct `process.env` in service class |

### Layer: Tests

| ID | Sev | Issue | Location | Evidence | Recommended Fix |
|----|-----|-------|----------|----------|-----------------|
| TEST-1 | High | `npm test` runs `jest` but jest is not installed — test suite unrunnable via standard script | `package.json` L9 | `"test": "jest"` but `jest` not in dependencies or devDependencies. CLAUDE.md: tests use `node:test`. Running `npm test` fails with `jest: command not found` | Change `"test"` script to `"node --test test/"` |
| TEST-2 | High | `textFileParser.js` has zero tests despite being highest-priority untested parser | `test/` directory; `src/utils/record-query/textFileParser.js` | TESTING.md Priority #1. CLAUDE.md: "Every parser and utility function must have tests." No `record-query-parser.test.js` exists | Create `test/record-query-parser.test.js` covering `parseTextFile()`, `formatQueryDate()`, `validateParsedData()` |
| TEST-3 | Medium | `irn-drn-parser.test.js` tests service method, not parser utility functions directly | `test/irn-drn-parser.test.js` L1–63 | Tests `EmailProcessor.processDocumentTable()` (service). Parser functions in `htmlTableParser.js` (`extractAndParseTables`, `looksLikeData`, `sanitizeHeaders`) have no direct test coverage | Add direct parser unit tests for `extractAndParseTables`, `looksLikeData`, `sanitizeHeaders` with edge-case inputs |
| TEST-4 | Medium | `eslint` and `prettier` absent from `devDependencies` — pre-commit checks use unpinned `npx` downloads | `package.json` L31–33 | `devDependencies` contains only `nodemon`. Running `npx eslint .` and `npx prettier --check .` downloads latest version each time, making linting non-deterministic | Add `eslint` and `prettier` as pinned `devDependencies` |

### Layer: Deployment/Infrastructure

| ID | Sev | Issue | Location | Evidence | Recommended Fix |
|----|-----|-------|----------|----------|-----------------|
| INFRA-1 | Low | `vercel.json` nearly empty — no function timeout, route rewrites, or region configuration | `vercel.json` L1–3 | Only `{ "version": 2 }`. App makes IMAP connections and multiple Zoho API calls. Default Vercel timeout (10s Hobby, 60s Pro) may cause silent timeouts on batch processing | Add `functions` config with appropriate `maxDuration` for cron endpoints |
| INFRA-2 | Low | `.env.example` contains stale defaults that don't match runtime defaults in code | `.env.example` L48, L82 | `ZOHO_JOB_REPORT_LINK_NAME=ERP_Data_Report` vs code default `'View_All_Jobs'` vs config.service default `'Billing_manager'`. Three sources, three different values | Align `.env.example` defaults with `getConfigurableKeys()` values |

### Layer: Cross-Cutting

| ID | Sev | Issue | Location | Evidence | Recommended Fix |
|----|-----|-------|----------|----------|-----------------|
| CC-1 | High | ZohoService and EmailProcessor use manual module-scope singleton caching instead of factory functions | `src/controllers/irn-drn-tracker/email.controller.js` L12–34; `record-query/email.controller.js` L12–34; both `zoho.controller.js` files L9–19 | Four controllers implement `let service = null; const getService = () => { if (!service) service = new Service(); }`. CLAUDE.md: "Use singleton factory functions — never `new Service()` inline" | Add `getZohoService()` factory to `zoho/index.js` and processor factories to feature service index files |
| CC-2 | Medium | Auth sessions are in-memory-only — lost on every serverless cold start | `src/controllers/auth.controller.js` L20–30 | `const activeSessions = new Map(); setInterval(...)` — instance-local in Vercel serverless. Session tokens from one cold-start instance unknown to subsequent instance | Persist sessions in Supabase so tokens survive across serverless invocations |
| CC-3 | Medium | Systemic `process.env` direct-read pattern across 8+ service files (root cause of EMAIL-2, ZOHO-1, ZOHO-2, ZOHO-4, CFG-1, SUPA-1, NOTIF-1) | `gmail.service.js`, `gmail-imap.service.js`, `supabase.service.js`, `cronjob.service.js`, `zoho/config.js`, `zoho/batch-lookup.js`, `zoho/record-query.js`, `zoho/irn-drn.js` | CLAUDE.md config rule violated in 8 files across two service directories. Pattern is systemic — Zoho module suite and Gmail services were written before this rule was applied | Systematically replace all `process.env` reads in `src/services/` with `getConfigService().get()` calls |
