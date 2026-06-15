# Work Tracker

<!-- STATUS: ACTIVE OPERATIONAL STATE ONLY -->
<!-- Last Updated: 2026-06-15 -->

<!--
PURPOSE
This file contains ONLY active operational work state.
It answers one question: "What work is currently in flight?"

It does NOT contain:
- Completed work
    Summary rows → docs/history/work/YYYY-MM.md
    Full WI files → docs/history/work-items/YYYY-MM/FEAT-XX.md
- Micro changes → docs/history/micro/YYYY-MM.md
- Audit findings → AUDIT_TRACKER.md
- Historical records of any kind

WHY ACTIVE-STATE-ONLY
Claude reads this file at the start of every session. A file that grows
with every completed work item eventually becomes expensive to read and
difficult to scan. Active state only means this file stays small forever
without any manual cleanup.
-->

---

## Session Start Protocol

At the start of every /implement session, surface items in this order:
1. Ready For Approval → highest priority, human action required
2. Blocked → work that cannot proceed
3. Active → work currently in progress

Then follow the full Session Start Protocol in /implement, which includes
the audit priority gate (Critical block, Related High block) and new work
classification. The tracker surfaces items; /implement governs what to do next.

The tracker is the session state. Chat history is not.
A new session with only this file and the work item files must be able to
reconstruct exactly where work stands.

---

## Ready For Approval

Items that have completed investigation and architectural decision, and are
waiting for explicit human approval before implementation begins.

These are the highest priority items because a human decision is required
before any work can proceed. Surface these first at every session start.

Do not begin new work while APPROVAL_PENDING items exist, unless the user
explicitly instructs otherwise.

Status for all items in this section: `APPROVAL_PENDING`

| ID | Type | Description | ADR | Waiting Since |
|----|------|-------------|-----|---------------|

---

## Active

Items currently being worked on by an agent.

Valid statuses for this section:

| Status | Meaning |
|--------|---------|
| `INVESTIGATING` | Investigator is gathering facts about the codebase |
| `NEEDS_DECISION` | Investigation complete, Architect has not yet decided |
| `APPROVED` | Decision approved by user, implementation not yet started |
| `IMPLEMENTING` | Implementer is writing code and tests |
| `IMPLEMENTED` | Code complete, all verification passed, awaiting review |

An item must not appear here with status APPROVAL_PENDING, BLOCKED, or DONE.
Those belong in their respective sections or are archived.

| ID | Type | Status | Description | Related Audit | Updated |
|----|------|--------|-------------|---------------|---------|

---

## Blocked

Items that cannot proceed. Every blocked item must have a specific,
actionable blocking reason. "Blocked" alone is never sufficient.

Surface blocked items at every session start. Blocked items that are never
surfaced become invisible work debt.

Common blocking reasons:
- Waiting for external API credentials or access
- Prerequisite work item not yet complete (list the ID)
- Root cause not yet reproducible
- Scope requires approval before proceeding
- External team decision required

| ID | Type | Description | Blocking Reason | Blocked Since |
|----|------|-------------|-----------------|---------------|

---

<!--
STATUS VOCABULARY
The following statuses are the only valid statuses in this system.
Agents must never invent new statuses.

APPROVAL_PENDING  Awaiting human approval (lives in Ready For Approval section)
INVESTIGATING     Investigator active (lives in Active section)
NEEDS_DECISION    Architect needed (lives in Active section)
APPROVED          Ready to implement (lives in Active section)
IMPLEMENTING      Implementer active (lives in Active section)
IMPLEMENTED       Verification passed, review pending (lives in Active section)
BLOCKED           Cannot proceed (lives in Blocked section)
CANCELLED         Work abandoned — immediately archived, never appears here
DONE              Complete — immediately archived, never appears here

STATUS FLOW (forward path):
  INVESTIGATING → NEEDS_DECISION → APPROVAL_PENDING
  → APPROVED → IMPLEMENTING → IMPLEMENTED → DONE

STATUS FLOW (review failure):
  IMPLEMENTED → IMPLEMENTING

BLOCK PATH (from any status):
  ANY → BLOCKED → (restored to original status when unblocked)

CANCELLATION PATH (from any status):
  ANY → CANCELLED → archived to history, removed from tracker
  ID is permanently retired. See /implement Phase 3 for cancellation procedure.

ARCHIVE TRIGGER
When a work item reaches DONE or CANCELLED status, /implement performs
the archive procedure. See /implement Phase 3 (cancellation) and Phase 6
(completion) for the full steps.
DONE and CANCELLED items never appear in this file after archiving.

WORK ITEM IDS
  Format: {TYPE}-{NUMBER}
  Types:  FEAT, BUG, REFACTOR
  Source: docs/meta/COUNTERS.md — always read current counter, increment after use
  Never invent IDs. Never reuse IDs. Never derive IDs by scanning history.

MICRO CHANGES
  Changes classified as MICRO never get a work item.
  Log directly to docs/history/micro/YYYY-MM.md
  Format: | YYYY-MM-DD | Description | Scope |
  Scope examples: single file path, or directory name for multi-file changes
-->
