---
name: project-overview
description: eSanchit/MailtoZoho project overview — runtime, deployment, key constraints
metadata:
  type: project
---

Node.js/Express backend, deployed on Vercel (serverless). Auto-deploys on push to main.
Uses Gmail IMAP (App Password only, no OAuth2) to fetch emails, parses content, pushes to Zoho Creator.
Supabase stores config overrides; ConfigService is the sole gateway to env/Supabase config values.

**Why:** Serverless deployment means no persistent state between runs; all state goes through Supabase.
**How to apply:** Check that any new code uses `getConfigService().get()` rather than `process.env` directly in controllers/services.
