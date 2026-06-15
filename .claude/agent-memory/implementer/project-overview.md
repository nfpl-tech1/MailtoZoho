---
name: project-overview
description: MailtoZoho project tech stack, deployment, and key architectural constraints
metadata:
  type: project
---

MailtoZoho is a Node.js/Express app deployed on Vercel (serverless) that processes Gmail emails via IMAP and pushes structured data to Zoho Creator (Shakti 3.0 app). Uses Supabase for config persistence. Cron triggered by cron-job.org.

**Why:** Automates customs documentation workflow for Nagarkot business units.

**How to apply:** All implementation must assume serverless cold-start context. Never use module-level singleton patterns for per-inbox state. ESLint max-lines is 500 (warn) but CLAUDE.md hard limits are controller=300, service=500, util=200, route=100.

Key constraint: `public/` directory is excluded from ESLint (in `.eslintrc.json` ignorePatterns).
