# {TYPE}-{NUMBER}: {TITLE}

<!-- STATUS: {STATUS} -->
<!-- Last Updated: YYYY-MM-DD -->

<!--
PURPOSE
This file is the complete execution record for a single unit of work.
It captures everything that happened: what was discovered, what was decided,
what was built, how it was verified, and whether it passed review.

It serves three audiences:
  Current session  → knows exactly where work stands and what to do next
  Future session   → can reconstruct full context without re-investigation
  Historical record → preserved in docs/history/work-items/YYYY-MM/ after close

TYPES
  FEAT      New feature or capability
  BUG       Defect fix
  REFACTOR  Structural improvement without behavior change
             (includes audit finding remediation)

LIFECYCLE
  Created by /implement when user requests new work.
  Closed by /implement after Reviewer produces PASS verdict.
  Archived to docs/history/work-items/YYYY-MM/{ID}.md on close.
  A summary row is appended to docs/history/work/YYYY-MM.md on close.
  This file is never deleted — it is moved, not removed.

SECTION OWNERSHIP
  Metadata          → /implement creates and updates status fields
  Goal & Scope      → /implement creates, never modified after approval
  Related Audit     → /implement creates, /implement completion workflow
                       archives and resolves after Reviewer PASS
  Classification    → /implement sets, Architect may escalate
  Investigation     → Investigator owns exclusively
  Decision          → Architect owns exclusively
  Approval          → user decision, recorded by /implement
  Implementation    → Implementer owns exclusively
  Verification      → Implementer owns exclusively
  Review History    → Reviewer owns exclusively
  Follow-up         → Implementer may append, never implemented here
  Status History    → /implement appends on every status transition,
                       never modified after appending

No agent may modify a section it does not own.
-->

---

## Metadata

| Field | Value |
|-------|-------|
| ID | {TYPE}-{NUMBER} |
| Type | FEAT / BUG / REFACTOR |
| Status | INVESTIGATING |
| Classification | MICRO / MESO / MACRO |
| Created | YYYY-MM-DD |
| Updated | YYYY-MM-DD |
| Closed | — |

<!--
STATUS VOCABULARY (only these values are valid)
  INVESTIGATING       Investigator is gathering facts
  NEEDS_DECISION      Investigation complete, Architect deciding
  APPROVAL_PENDING    Decision complete, awaiting user approval
  APPROVED            User approved, implementation not yet started
  IMPLEMENTING        Implementer is writing code
  IMPLEMENTED         Code complete, verification passed, awaiting review
  BLOCKED             Cannot proceed — see Blocked Reason below
  CANCELLED           Work abandoned — archived to history, ID retired
  DONE                Review passed, work complete, ready to archive

CLASSIFICATION
  MICRO   Typo, dead import, trivial rename — normally does not require
          a work item. If a MICRO item has a work item, evaluate whether
          the tracking overhead is justified by the change's risk or
          visibility (e.g. critical production fix, security patch).
  MESO    Feature extension, single-module bug, file split.
          Uses inline decision. No ADR required.
  MACRO   Database change, API contract change, auth change, new subsystem,
          external integration, cross-layer communication change.
          ADR mandatory.

BLOCKED REASON (populate when Status = BLOCKED)
  State the specific blocking condition and what would unblock it.
  "Blocked" alone is never sufficient.
-->

| Blocked Reason | — |
|----------------|---|

---

## Success Criteria

<!--
How will we know this work item is complete?
List the specific, observable conditions that must be true for DONE to be valid.
These become the Reviewer's checklist — if a criterion is ambiguous here,
the review verdict will be ambiguous too.

Write criteria as verifiable facts, not intentions.
Bad:  "Export works correctly."
Good: "Export button appears on account settings page for all user roles.
       Clicking it downloads a valid UTF-8 encoded CSV.
       CSV columns match the documented schema in ARCHITECTURE.md.
       Existing account settings tests still pass."

Minimum one criterion. As many as needed to make DONE unambiguous.
-->

- [ ] Criterion

---

## Goal

<!--
What outcome should exist when this work is complete?
Write this as an observable end state, not a list of tasks.

Good: "Users can export their data as a CSV file from the account settings page."
Bad:  "Add export button, write CSV logic, add tests."

The goal is set at creation and never modified after approval.
If the goal needs to change, close this work item and open a new one.
-->

---

## Scope

### Included

<!--
What is explicitly in scope for this work item?
Be specific enough that the Implementer cannot accidentally expand scope.
-->

- Item

### Excluded

<!--
What is explicitly out of scope?
List things that might seem related but are not part of this work item.
Explicit exclusions prevent scope creep more effectively than silence.
-->

- Item

<!--
SCOPE CHANGE RULE
Scope is locked after user approval.
If implementation reveals that the correct solution requires scope expansion:
  1. Stop implementation
  2. Document the discovery in Follow-up Opportunities
  3. Set status to BLOCKED with reason "Scope expansion required"
  4. Return to user for decision
Do not silently expand scope. Ever.
-->

---

## Related Audit Findings

<!--
List audit findings from AUDIT_TRACKER.md that this work item addresses.
Leave empty if this work item was not triggered by an audit finding.

Format: {PREFIX}-{NUMBER} — one per line
Example:
  BE-7
  FE-3

When this work item reaches DONE (Reviewer PASS):
  The /implement completion workflow removes these findings from
  AUDIT_TRACKER.md and archives them to docs/history/audit/YYYY-MM.md.
  Do not modify AUDIT_TRACKER.md from inside this file.
-->

None.

---

## Classification Rationale

<!--
State which classification applies and why.
This prevents misclassification from causing wrong workflow execution.

MESO example:
  "Single module change. No API contract change. No schema change.
   No external integration. Inline decision sufficient."

MACRO example:
  "Requires database schema migration and changes to the public API contract.
   ADR mandatory per classification rules."

If Investigator discovers during investigation that the classification
is wrong, document the finding here and stop. Do not continue with
the wrong workflow. Return control to /implement for reclassification.
-->

---

## Investigation

<!-- Owned exclusively by Investigator. No other agent modifies this section. -->

### Findings

<!--
Document facts discovered about the current codebase state.
Every finding must follow this structure:

  Observation: What currently exists.
  Evidence:    Where it exists (file path + line numbers).
  Impact:      Why it matters to this work item.

Bad:  "User creation logic seems centralized."
Good:
  Observation: User creation occurs exclusively in UserService.
  Evidence:    src/services/user.service.ts L120–184, called by
               UserController (L67) and AdminImportService (L203).
  Impact:      Changes to user onboarding must modify this code path.
               AdminImportService will need coordinated updates.
-->

### Relevant Files

| File | Purpose | Relevance to This Work Item |
|------|---------|----------------------------|

### Unknowns Resolved

| Question | Answer | How Verified |
|----------|--------|--------------|

### Risks Identified

<!--
Document implementation risks discovered during investigation.
Risks must be evidence-based — never speculative.

Bad:  "This might be complicated."
Good: "Three independent services consume the interface being modified.
       Changes require coordinated updates to avoid runtime failures."

Each risk should note whether it is a blocker or a concern to watch.
-->

---

## Decision

<!-- Owned exclusively by Architect. No other agent modifies this section. -->

### ADR Threshold

<!--
MACRO work: ADR threshold MET — create ADR before implementation.
MESO work:  ADR threshold NOT MET — inline decision below is sufficient.
-->

MET / NOT MET

### Approach

<!--
Describe the approved implementation approach in enough detail that
the Implementer can execute it without making architectural decisions.

Include:
  What will be created (new files, modules, services, interfaces)
  What will be modified (existing components affected)
  What must not change (protected boundaries, critical contracts)
  Why this approach was chosen over alternatives considered

If ADR threshold is NOT MET, this section is the complete decision record.
If ADR threshold is MET, this section summarizes the ADR — full detail lives there.
-->

### ADR Reference

<!--
Populate only when ADR threshold is MET.
Format: ADR-{NUMBER}
The ADR file lives at docs/decisions/ADR-{NUMBER}-{title}.md
-->

None.

### Alternatives Considered

<!--
List alternatives evaluated and why they were rejected.
Even for MESO work, document at least one alternative to show the decision
was made deliberately rather than by default.

Format:
  Alternative: [description]
  Rejected because: [reason]
-->

---

## Approval

<!-- Owned exclusively by the user. No agent modifies this section. -->

### Approved By

User

### Approval Date

YYYY-MM-DD

### Approval Notes

<!--
Any conditions, constraints, or clarifications added at approval time.
These become binding constraints on the Implementer.
-->

---

## Implementation Notes

<!-- Owned exclusively by Implementer. No other agent modifies this section. -->

<!--
Document every file touched during implementation.
This becomes the audit trail for what changed and why.
Do not summarize — list each file with its specific change.
-->

| File | Change Description |
|------|--------------------|

### Notes

<!--
Document any implementation decisions made during coding that were not
covered by the Architect's decision. These should be rare — if the
Implementer is making architectural decisions, stop and return to Architect.

Acceptable: "Used lodash.debounce instead of custom debounce — same
             semantics, already a project dependency."
Not acceptable: "Decided to restructure the entire auth module while here."
-->

---

## Verification

<!--
Owned exclusively by Implementer.
All checks must be PASS before review may be requested.
A FAIL in any check means status remains IMPLEMENTING.
The Reviewer must not be invoked until this section is fully complete.

VERIFICATION CATEGORIES ARE CANONICAL.
The actual commands are project-specific — read them from CLAUDE.md.
Never invent verification commands. Never assume npm/cargo/pytest
unless explicitly defined in CLAUDE.md for this project.

If a category does not apply to this project, mark it N/A with a reason.
Example: Typecheck — N/A (Python project, mypy not configured)
-->

| Check | Result | Evidence |
|-------|--------|----------|
| Build | PASS / FAIL / N/A | |
| Tests | PASS / FAIL / N/A | |
| Lint | PASS / FAIL / N/A | |
| Typecheck | PASS / FAIL / N/A | |
| Scope Compliance | PASS / FAIL | All changes match approved scope |
| Documentation Sync | PASS / FAIL | All affected docs updated |

<!--
SCOPE COMPLIANCE CHECK
Verify:
  Every changed file was listed in the Architect's approved approach OR
  is a test file OR is a documentation file required by the change.
  No files were changed outside approved scope.

DOCUMENTATION SYNC CHECK
For every implementation change, ask:
  Did architecture change?    → ARCHITECTURE.md must be updated
  Did conventions change?     → CONVENTIONS.md must be updated
  Did testing approach change? → TESTING.md must be updated
  Did workflow rules change?  → CLAUDE.md must be updated
If any answer is yes and the update was not made, this check is FAIL.
-->

---

## Review History

<!-- Owned exclusively by Reviewer. No other agent modifies this section. -->

<!--
REVIEW FINDINGS RULE
Review findings are defects in the current implementation attempt.
They are NOT audit findings. They do NOT enter AUDIT_TRACKER.md.
They do NOT become work items.
They live only here, inside this work item, until the defect is fixed.
Once a subsequent review produces PASS, these findings are considered
resolved and require no further action.

If a review finding reveals a pre-existing codebase problem outside
this work item's scope, the Reviewer documents it as an observation
and recommends creating an audit finding via /audit. The Reviewer
does not create the audit finding directly.

REVIEW FINDING FORMAT
Every finding must include:
  ID:            RV-{N} — monotonic across the entire work item, never
                 reset between review rounds. RV-1, RV-2, RV-3 etc.
                 regardless of which review round produced the finding.
                 This prevents ambiguity when referencing findings across rounds.
  Observation:   What is wrong
  Evidence:      File path and line numbers
  Required Fix:  The outcome required — not the implementation
                 Bad:  "Create UserValidationService."
                 Good: "Separate validation responsibility from controller."
-->

### Review #1

**Verdict:** PASS / FAIL

**Findings:**

<!-- Populate only on FAIL -->

| ID | Observation | Evidence | Required Fix |
|----|-------------|----------|--------------|

**Observations:**

<!-- Optional notes for the Implementer even on PASS -->

---

<!--
Add Review #2, #3 etc. if needed. Each FAIL returns status to IMPLEMENTING.
Each review round gets its own section — do not overwrite previous rounds.
Review history is a permanent record of what was found and fixed.
-->

---

## Follow-up Opportunities

<!--
Improvements discovered during implementation that are outside approved scope.
These are observations only. They are not approved work.
They do not get implemented here. They do not automatically become work items.
The user decides whether to act on them.

If a follow-up opportunity is significant enough to track, the user may
invoke /implement with the follow-up as the new request.

Format:
### FO-{N}: {Short title}
Discovered during: [Implementation / Verification / Review]
Description: What was noticed.
Why not implemented: Outside approved scope of {TYPE}-{NUMBER}.
Suggested next step: [optional]
-->

---

## Status History

<!--
Append-only. Never modify existing entries.
Every status change must be recorded here with date and reason.
This is the audit trail for how the work item progressed.

Format: | YYYY-MM-DD | FROM → TO | Reason / Note |
-->

| Date | Transition | Note |
|------|------------|------|
| YYYY-MM-DD | Created → INVESTIGATING | Work item created by /implement |
