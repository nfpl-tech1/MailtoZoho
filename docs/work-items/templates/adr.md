# ADR-{NUMBER}: {TITLE}

<!-- Status: PROPOSED -->
<!-- Created: YYYY-MM-DD -->
<!-- Last Updated: YYYY-MM-DD -->
<!-- Work Item: {TYPE}-{NUMBER} -->

<!--
PURPOSE
An Architectural Decision Record documents a significant architectural
decision: what was decided, why, what alternatives were considered, and
what the decision requires and implies going forward.

ADRs are permanent historical records. They are never deleted, never
archived, and never renumbered. A superseded ADR remains in place with
its status updated — the chain of decisions is the value.

WHY ADRS EXIST
Without recorded decisions, the same architectural debates recur in every
session. Future agents and developers encounter the current structure
without knowing whether it was intentional or accidental, whether
alternatives were considered, or whether constraints still apply.
An ADR answers: "We built it this way deliberately, because of X,
and we explicitly rejected Y for reason Z."

WHEN AN ADR IS REQUIRED (MACRO threshold)
ADR is mandatory when the work involves any of the following:
  - New subsystem or major module
  - Database schema change
  - API contract change (breaking or additive)
  - Authentication or authorization change
  - Security boundary change
  - External service integration
  - Architecturally significant AI/ML integration that introduces new
    system boundaries, workflows, or long-term constraints
  - Cross-layer communication change
  - Anything that constrains how future features must be built

MESO and MICRO work items never produce ADRs.
If investigation reveals MACRO scope in a MESO work item, the work item
must be reclassified before this document is created.

STATUS VOCABULARY
  PROPOSED     Created, not yet reviewed or approved
  APPROVED     Accepted by user — implementation may proceed
  SUPERSEDED   Replaced by a newer ADR (add Superseded By field)
  REJECTED     Considered and explicitly not adopted

ADRs move forward only. APPROVED never reverts to PROPOSED.
A bad decision gets a new ADR that supersedes it — not an edit.

STATUS TRANSITION OWNERSHIP
  PROPOSED → APPROVED    User decision, recorded by /implement
  PROPOSED → REJECTED    User decision, recorded by /implement
  APPROVED → SUPERSEDED  Recorded by /implement when a newer ADR
                         explicitly supersedes this one — update the
                         Superseded By field in the Status section

OWNERSHIP
  Architect agent creates and populates this document during /implement.
  User approves (changes status from PROPOSED to APPROVED).
  /implement records the approval.
  No other agent modifies this document after approval.

  Every ADR must reference exactly one originating work item in the
  header's Work Item field. A work item may reference multiple ADRs
  only when explicitly split by user approval — floating ADRs with no
  originating work item are a governance defect.

  Post-approval changes require a superseding ADR, never an edit.
  Editing an approved ADR destroys the historical record.
-->

---

## Status

PROPOSED

<!--
When superseded, update to:
  Status: SUPERSEDED
  Superseded By: ADR-{NUMBER} — {Title of superseding ADR}
  Superseded Date: YYYY-MM-DD

Never delete superseded ADRs. The fact that this decision existed,
was used, and was later replaced is part of the architectural history.
-->

---

## Context

<!--
Why is this decision required now?
Describe the situation, constraint, or problem that forced a decision.
Write this for a reader who has no context — a future agent or developer
encountering this ADR months later must understand why this was needed
without reading the work item or the codebase.

Include:
  The problem being solved
  Any constraints that shaped the decision space
  Why the status quo is insufficient
  Any relevant prior decisions that this builds on or reacts to

This section describes the world as it was before the decision.
Do not describe the solution here.
-->

---

## Decision Drivers

<!--
The forces that shaped the decision. Not requirements — forces.
Requirements say what must be true. Drivers explain what trade-offs matter.

Examples:
  - Must not break existing mobile clients (backward compatibility)
  - Session startup time must stay under 200ms (performance)
  - Single engineer must be able to maintain this subsystem (simplicity)
  - Must comply with SOC 2 requirements (compliance)

List only drivers that genuinely influenced the decision.
Do not list generic aspirations ("maintainability", "scalability")
unless they represent a specific, measurable constraint for this decision.
-->

- Driver
- Driver

---

## Options Considered

<!--
List every option that was genuinely evaluated.
Do not include strawman options created to be discarded.
Every option here must have had a legitimate case for adoption.

If only one option was considered, this is not an ADR — it is a
implementation note. ADRs exist because real trade-offs were made.

OPTION FORMAT (repeat for each option):
-->

### Option 1: {Name}

**Description:**
What this option entails. Specific enough that someone could implement it
without guessing. Vague descriptions ("use a service") are not options.

**Advantages:**
- Advantage with reasoning

**Disadvantages:**
- Disadvantage with reasoning

**Why not chosen:** *(omit for the chosen option)*

---

### Option 2: {Name}

**Description:**

**Advantages:**
- Advantage

**Disadvantages:**
- Disadvantage

**Why not chosen:**

---

## Decision

<!--
Which option was selected and why.
This is the most important section — it must be unambiguous.

Include:
  The chosen option by name
  The primary reason it was chosen over alternatives
  The key trade-offs accepted by making this choice
  Any conditions that would cause this decision to be revisited

Do not hedge. A decision record that says "we chose X but Y might also
work" is not a decision — it is a note of confusion.
-->

**Chosen:** Option {N} — {Name}

**Rationale:**

**Trade-offs accepted:**

**Conditions for revisiting this decision:**

---

## Implementation Guidance

<!--
What the Implementer must do to execute this decision correctly.
Specific enough to eliminate architectural ambiguity during implementation.
Not so specific that it prescribes implementation details the Implementer
should determine (file organization, variable names, etc.).
-->

### Create

<!--
New files, modules, services, or interfaces that must exist.
List with purpose, not implementation details.
-->

- `path/to/file` — purpose

### Modify

<!--
Existing components that must change and how.
Be specific about the boundary of the change.
-->

- `path/to/file` — what changes and why

### Do Not Change

<!--
Components that must remain unchanged despite appearing related.
Explicit protection prevents well-intentioned scope creep.
-->

- `path/to/file` — why it must not change

### Contracts and Boundaries

<!--
Interfaces, APIs, schemas, or communication patterns that this decision
establishes and that future work must respect.

These become constraints on future ADRs and work items.
Write them as rules: "X must always Y" or "Z must never W."
-->

---

## Verification Criteria

<!--
How will we know the implementation correctly reflects this decision?
These criteria are used by the Reviewer to validate ADR compliance.

Every criterion must be objectively verifiable — the Reviewer must be
able to check it mechanically without making judgment calls.

Bad:  "Code is clean and follows the decision."
Good: "Processor is registered in the factory at src/factories/processor.ts."
Good: "No route handler imports from src/repositories/ directly."
Good: "Migration file exists and is reversible."

Minimum two criteria. If you cannot write two verifiable criteria,
the decision is not specific enough to implement.
-->

| ID | Criterion | How to Verify |
|----|-----------|---------------|
| VC-1 | | |
| VC-2 | | |

---

## Consequences

<!--
What becomes true after this decision is implemented?
Include both intended consequences and known costs.
Future teams and agents need to understand what constraints this decision
imposes on work that comes after it.
-->

### Positive

- Benefit

### Negative

- Cost or constraint imposed on future work

### Risks

<!--
What could go wrong with this decision?
What assumptions does it rely on that might not hold?
-->

- Risk

### Future Considerations

<!--
What decisions will likely be needed as a follow-on to this one?
What parts of this decision are most likely to need revisiting?
-->

- Consideration

---

## References

<!--
Sources that informed this decision.
Required for decisions based on external standards, research, or prior art.
Use the source hierarchy:
  Tier 1: Official framework/language/tool documentation
  Tier 2: Widely adopted style guides and standards bodies
  Tier 3: Community conventions (only when Tier 1/2 don't apply)

Never cite "industry standard" without naming the specific standard.

If no external references informed this decision, state explicitly:
"No external references used — decision based on project context only."
Leaving this section blank is ambiguous and not permitted.
-->

| Claim | Source | URL |
|-------|--------|-----|
