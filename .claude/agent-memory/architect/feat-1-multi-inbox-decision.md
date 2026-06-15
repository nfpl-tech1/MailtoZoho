---
name: feat-1-multi-inbox-decision
description: FEAT-1 multi-inbox support — key decisions on credential injection, SupabaseService extension, processor instantiation pattern, dedup placement, and UI inbox CRUD
metadata:
  type: project
---

ADR-1 produced for FEAT-1 (Multi-inbox Support, Email Dedup, Pending Buffer). Decided 2026-06-15.

Key choices:
- GmailImapService: constructor params with env-var fallback (not factory function)
- GmailService: accepts optional credentials object, falls through to existing module-scope useImap logic
- SupabaseService: extended with table-scoped request methods (getFromTable, insertToTable, etc.) rather than separate InboxService class — keeps one Supabase singleton
- EmailProcessor / RecordQueryEmailProcessor: refactored to accept optional gmailService instance parameter, falling back to default construction
- Multi-inbox loop: lives in processEmails handlers inside each feature controller; iterate inboxes, instantiate processors per inbox, aggregate results, dedup in-memory before Zoho push
- In-memory dedup: IRN-DRN uses getRecordKey() (already exists), Record Query uses beNumber+query — both deduplicated in a Map before the Zoho push call within the same processEmails invocation
- IRN-DRN pending buffer: unchanged — buffer keys are already globally unique (DRN_no-based)
- Inbox CRUD: new InboxController + /api/inboxes routes; NOT folded into config.controller.js (would exceed 300-line hard limit)
- UI: light mode redesign (background #F4F6FA, primary Blue #1A3E70, accent Red #D71F26), new Email Inboxes card with separate save path calling /api/inboxes
- Supabase schema: inboxes table created via SQL provided in ADR; no migration tooling

**Why:** See ADR-1 at docs/decisions/ADR-1-multi-inbox-gmail-support.md
