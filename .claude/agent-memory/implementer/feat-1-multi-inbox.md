---
name: feat-1-multi-inbox
description: FEAT-1 implementation notes: multi-inbox support, dedup, pending buffer extraction, light mode UI
metadata:
  type: project
---

FEAT-1 implemented 2026-06-15. Key decisions:

- pendingBuffer.service.js extracted from IRN-DRN email.controller.js — no getConfigService import (configService passed as param)
- GmailService and GmailImapService constructors take { user, password } = {} with env fallback
- EmailProcessor constructors take (gmailService = null) — null triggers new GmailService() inside
- SupabaseService got 4 generic table methods: getFromTable, insertToTable, updateInTable, deleteFromTable
- inbox.controller.js has loadInboxes() helper — approved to read process.env directly for fallback
- Record Query controller extracted pushResultsToZoho() helper to stay under 300 lines
- settings.html: public/ is ESLint-excluded, light mode only (no dark mode), inboxes card above IRN-DRN card

**Why:** ADR-1 approved process.env reads in GmailImapService and inbox fallback as explicit exceptions to the CLAUDE.md "never read process.env in services" rule.

**How to apply:** When touching inbox or gmail services, remember the dual credential path: Supabase table for runtime, env vars for fallback.
