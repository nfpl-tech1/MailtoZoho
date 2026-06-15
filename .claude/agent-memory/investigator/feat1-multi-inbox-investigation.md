---
name: feat1-multi-inbox-investigation
description: "FEAT-1 investigation results — multi-inbox, dedup, pending buffer, Settings UI dark-to-light, audit findings EMAIL-2 and CC-1"
metadata:
  type: project
---

Investigated 2026-06-15. Key facts:

- GmailImapService constructor reads process.env.GMAIL_USER and GMAIL_APP_PASSWORD directly (L22-23). GmailService uses module-scope `const useImap = !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD)` at L16 — evaluated once at require() time, not per-call.
- Both IRN-DRN and Record Query EmailProcessor classes instantiate `new GmailService()` directly in their constructor with no credential arguments.
- The module-scope useImap flag in gmail.service.js is the primary blocker for per-inbox credential injection: it cannot switch IMAP mode per call.
- CC-1 singletons: both email.controller files use module-scope `let emailProcessor = null` / `let zohoService = null` — these are warm-instance caches on Vercel, not proper factories.
- SupabaseService.tableName is hardcoded 'config' (L10). The request() method builds URL as `${tableName}?...` so a different table needs either a new service instance with different tableName, or a parameter to request().
- IRN-DRN pending buffer stored in Supabase config table under key 'IRN_DRN_PENDING_RECORDS' as JSON string.
- DRN_no extracted inside processDocumentTable() in irn-drn emailProcessor.service.js, returned as field on result objects.
- Record Query beNumber and query extracted by textFileParser.js parseTextFile(), returned as beNumber/query/queryDate.
- Settings UI is currently dark mode (background: linear-gradient 1a1a2e to 16213e, purple accents #a855f7).
- No 'Email Inboxes' card exists in settings.html yet.
- saveSettings() collects ALL input/select values via querySelectorAll — a new card's inputs would be included automatically if given matching IDs registered in getConfigurableKeys().

**Why:** Multi-inbox requires credential injection per-inbox at GmailService instantiation time — the current module-scope useImap flag prevents this without architectural change.

**How to apply:** Architect must decide how GmailService accepts per-inbox credentials (constructor params vs factory function vs new class).
