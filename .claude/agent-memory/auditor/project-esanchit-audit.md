---
name: project-esanchit-audit
description: Initial audit findings for eSanchit Email Automation — layer inventory, severity map, and key observations
metadata:
  type: project
---

Initial /constitute audit performed 2026-06-15 against CLAUDE.md, ARCHITECTURE.md, CONVENTIONS.md, TESTING.md. Full findings reported in audit output — findings now assigned IDs API-1 through CC-4 in AUDIT_TRACKER.

**Key findings (not yet assigned IDs):**
- 3 dead-code files: src/controllers/email.controller.js, src/controllers/zoho.controller.js, src/services/emailProcessor.service.js
- src/utils/htmlTableParser.js is an exact duplicate of src/utils/irn-drn-tracker/htmlTableParser.js (byte-for-byte identical — old discovery claim of "missing headerless row support" is INCORRECT; both files are identical)
- src/services/common/gmail.service.js contains ~200 lines of OAuth2 dead code + imports googleapis unnecessarily
- config.json committed with live cron secret (OutlooktoZoho-DocUploadConfirm), account owner (nisarg_nagarkot182), app name (shakti-3-0), and cron job IDs — Critical severity
- config.json is NOT in .gitignore — file is tracked by git
- src/routes/cron.routes.js L35 uses === for cron secret comparison (timing-unsafe)
- package.json "test" script runs "jest" but tests use node:test — test suite cannot run via npm test
- eslint and prettier not in devDependencies, so pre-commit checks cannot run
- ZohoService and EmailProcessor instances manually cached in controllers using module-scope let variables instead of proper singleton factory functions
- debug=true hardcoded in ConfigService (L17), SupabaseService (L11), CronJobService (L35)
- src/services/common/zoho/config.js reads process.env directly (violates CLAUDE.md config rule)
- src/services/common/gmail-imap.service.js reads process.env directly (violates CLAUDE.md config rule)
- src/controllers/record-query/zoho.controller.js L239 reads process.env.RECORD_QUERY_REPORT_LINK_NAME directly
- auth.controller.js L72 compares passwords with === (timing-unsafe for settings page)
- No tests for record-query parser, no tests for services
- CRON_SECRET missing from .gitignore (config.json not excluded)
- config.controller.js has 443 lines (close to hard limit, multiple responsibility clusters)
- irn-drn email.controller.js has 401 lines (exceeds hard limit of 300 for controllers)

**Why:** Initial /constitute audit to establish baseline for all AUDIT_TRACKER findings.
**How to apply:** Use these as baseline; check AUDIT_TRACKER.md before flagging duplicates in future sessions.
