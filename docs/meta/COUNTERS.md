# Counters

<!-- Last Updated: 2026-06-15 -->

<!--
PURPOSE
This file is the single source of truth for all ID generation in this project.
It eliminates the need for any agent or command to scan history directories
to determine the next available ID. Scanning is unreliable under context
pressure — agents miss files, misread numbers, and produce duplicate IDs.
This file makes ID generation deterministic and crash-safe.

COUNTER SEMANTICS
Each counter stores the LAST ASSIGNED ID.
The next available ID is always: Last Assigned + 1

USAGE PROTOCOL
Every command and agent that creates a new artifact must follow this
sequence exactly — no exceptions, no reordering:

  1. Read the current counter value from this file
  2. Compute next ID: current value + 1
  3. Create the artifact using the new ID
  4. If artifact creation fails: stop. Do not update the counter.
  5. Update the counter in this file to the new value

Never update the counter without a successfully created artifact.
Never create an artifact without updating the counter afterward.

OWNERSHIP
  /constitute   → creates this file, initializes all counters
  /implement    → reads and increments FEAT, BUG, REFACTOR counters
  /implement    → Architect agent reads and increments ADR counter
  /audit        → reads and increments audit finding counters
  /constitute   → reads and increments audit finding counters
                  during initial audit
-->

---

## Work Items

| Type | Last Assigned |
|------|--------------|
| FEAT | 1 |
| BUG | 1 |
| REFACTOR | 0 |

---

## Architectural Decision Records

| Type | Last Assigned |
|------|--------------|
| ADR | 1 |

---

## Audit Findings

| Prefix | Layer | Last Assigned |
|--------|-------|--------------|
| API | Backend/API | 5 |
| EMAIL | Email Processing | 2 |
| ZOHO | External API Integration (Zoho) | 5 |
| PARSE | Data Parsing/Utils | 2 |
| CFG | Configuration System | 3 |
| CRON | External Scheduling | 1 |
| NOTIF | Error Notification | 1 |
| UI | Web UI (Settings) | 1 |
| SUPA | Cloud Storage (Supabase) | 1 |
| TEST | Tests | 4 |
| INFRA | Deployment/Infrastructure | 2 |
| CC | Cross-Cutting | 3 |
