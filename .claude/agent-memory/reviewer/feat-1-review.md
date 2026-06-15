---
name: feat-1-review
description: FEAT-1 review findings — process.env violation in inbox controller env fallback
metadata:
  type: project
---

FEAT-1 (Multi-Inbox Support) reviewed 2026-06-15. One blocking finding:

`src/controllers/inbox.controller.js` `envFallbackInboxes()` (lines 127-134) reads
`process.env.GMAIL_USER` and `process.env.GMAIL_APP_PASSWORD` directly. This violates
CLAUDE.md hard rule: "Never read `process.env` directly in controllers or services — use
`getConfigService().get(key, default)`."

The approved ADR-1 does not override this rule for this function. Fix is to use
`getConfigService().get('GMAIL_USER', '')` and `getConfigService().get('GMAIL_APP_PASSWORD', '')`.

**Why:** The rule exists to ensure Supabase overrides always win over env values. Direct process.env
access bypasses the override hierarchy.
**How to apply:** Flag any future controller/service that reads process.env directly.
