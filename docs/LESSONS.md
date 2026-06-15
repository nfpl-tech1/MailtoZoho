# Lessons

<!-- Last Updated: 2026-06-15 -->

<!--
PURPOSE
This file captures recurring governance observations and promotes validated
patterns into constitutional rules via explicit user approval.

It solves a specific problem: AI sessions encounter the same edge cases and
rule gaps repeatedly, but observations evaporate at session end. This file
is the staging area — observations live here until they recur and earn
promotion. Nothing enters CLAUDE.md automatically or without user approval.

RELATIONSHIP TO CLAUDE.md
This file is a staging area. CLAUDE.md is the constitution.
An observation here is not a rule. It becomes a rule only after:
  1. It recurs (Count reaches 2)
  2. It passes a basic quality check
  3. The user explicitly approves it

Until promoted, no agent may treat a lesson as a constitutional rule.

WHO MAY CREATE GOVERNANCE OBSERVATIONS
The following agents may produce governance observations in their reports:
  Auditor     → gaps discovered during audit that CLAUDE.md doesn't address
  Reviewer    → defect patterns appearing across multiple work items
  Architect   → decision patterns that should become standing rules

The Implementer agent may NOT produce governance observations.
Implementers are execution agents — governance observations from execution
create noise that buries real patterns.

WHO WRITES TO THIS FILE
Agents report observations. Commands write to this file.
  /audit      → writes Auditor governance observations
  /review     → writes Reviewer governance observations
  /implement  → writes Architect governance observations (produced during
                the Architect phase of /implement)

The Implementer agent does not produce governance observations.
/implement does not write to LESSONS.md on the Implementer's behalf.
If /implement writes here, it is acting on an Auditor or Architect observation
captured during that session — not an Implementer observation.

PROMOTION TRIGGER
When a lesson reaches Count: 2, move it to the Promotion Queue.
Present it to the user at the end of the current session.
Do not surface mid-session — it breaks implementation flow.

PROMOTION RULE
Count >= 2 + explicit user approval = promotion to target document.
No exceptions. No inferred approval. No automatic promotion.
-->

---

## Promotion Queue

Lessons at Count: 2 or higher, awaiting user review.
Surface at the end of the session in which a lesson was incremented to 2.

Present each candidate in this format:

```
LESSON PROMOTION CANDIDATE

Observed: [what happened — one sentence]
Count: [N] ([dates observed])
Source: [Auditor / Reviewer / Architect]

Proposed Rule:
"[Exact rule text as it would appear in the target document.
 Must be specific and mechanical — a fresh session with zero context
 must be able to follow it without judgment calls.]"

Target Document: [CLAUDE.md / ARCHITECTURE.md / CONVENTIONS.md / TESTING.md]
Target Section:  [Exact section name]

Conflicts with existing rules: [list any, or NONE]

Approve? yes / reject / defer
```

User responds with:
  yes    → add rule to target document exactly as proposed,
           move lesson to Promoted Lessons table
  reject → move lesson to Rejected Lessons table with user's reason
  defer  → lesson stays in Promotion Queue for next session

*No lessons currently awaiting promotion.*

---

## Active Lessons

Observations being tracked. Start here at Count: 1.
When Count reaches 2, move to Promotion Queue immediately.

Before creating a new entry, scan for a matching existing lesson.
If a match exists: increment its Count and add the new observation date.
If no match exists: create a new entry.

Increment an existing lesson only when the underlying pattern is
materially the same — same rule gap, same failure mode, same boundary
being crossed. If reasonable disagreement exists about whether two
observations describe the same pattern, create a new entry rather than
merging. A false merge inflates a Count artificially; a false split
costs nothing extra.

**Pruning rule:** During every /audit run, scan Active Lessons.
Any lesson older than 2 months with Count still at 1 should be moved
to the Archived Lessons section below. Do not delete — the observation
may recur. Add a note: "Archived [date] — Count: 1 after [N] months."
Restoring an archived lesson requires a new observation — increment the
archived entry's Count and move it back to Active Lessons.

<!--
Entry format:

### L-[N]: [Short title]
- First observed: YYYY-MM-DD
- Last observed:  YYYY-MM-DD
- Count: 1
- Source: [Auditor / Reviewer / Architect]
- What happened: [One sentence describing the observation or violation]
- Candidate rule: "[Proposed rule in final constitutional form]"
- Target document: [CLAUDE.md / ARCHITECTURE.md / CONVENTIONS.md / TESTING.md]
-->

### L-1: ESLint enforcement of process.env ban in services
- First observed: 2026-06-15
- Last observed: 2026-06-15
- Count: 1
- Source: Auditor
- What happened: The Zoho module suite (4 files) and Gmail services (2 files) systematically violate the "never read `process.env` in services" rule in 8+ files. The rule exists in CLAUDE.md but has no automated enforcement — ESLint only checks `max-lines`.
- Candidate rule: "Add an ESLint `no-restricted-syntax` rule targeting `process.env` scoped to `src/services/` and `src/controllers/`. Any `process.env` access outside of `src/config/index.js` and `src/services/common/config.service.js` is a blocking pre-commit violation."
- Target document: CLAUDE.md — Hard Rules / Configuration section

### L-2: Controllers must consume service factories, never implement singleton caching
- First observed: 2026-06-15
- Last observed: 2026-06-15
- Count: 1
- Source: Auditor
- What happened: Four controller files independently implemented module-scope singleton caching (`let service = null; const getService = () => { if (!service) service = new Service(); }`), duplicating the factory pattern without a shared implementation. CONVENTIONS.md documents the singleton factory pattern but does not prescribe that controllers must consume factories rather than implement them.
- Candidate rule: "Controllers must obtain service instances exclusively by calling an exported factory function from the service module (`getZohoService()`, `getEmailProcessor()`). Controllers may never implement their own singleton caching. If a factory does not exist, create one in the service's `index.js`."
- Target document: CLAUDE.md — Module Boundaries section

---

## Promoted Lessons

Rules that were approved and added to constitutional documents.
Kept as a record of what was learned and when.

| Date | Rule Summary | Target Document | Section | Status |
|------|-------------|-----------------|---------|--------|

---

## Rejected Lessons

Observations that reached Count: 2 but were reviewed and rejected.
Kept so the same lesson is not re-proposed without new evidence.
If the pattern recurs significantly after rejection, start a new entry
rather than reopening the rejected one.

| Date Rejected | Observation | Proposed Rule | Reason for Rejection |
|---------------|-------------|---------------|----------------------|

---

## Archived Lessons

Observations that did not recur within 2 months (Count: 1 at pruning time).
Not deleted — they may recur. If a pattern reappears, move the entry back
to Active Lessons and increment its Count.

| Date Archived | Observation | Candidate Rule | Months Active |
|---------------|-------------|----------------|---------------|
