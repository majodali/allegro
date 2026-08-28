# Conceptual model as a permanent practice — proposed methodology amendment

> Status: **draft proposal** (awaiting maintainer sign-off, then submission
> upstream to `majodali/methodology`)
> Scope: a new methodology practice, not an Allegro-local convention.
> Evidence: `docs/plans/concept-spine.md` §1 and `docs/design/concepts.md`.

## 1. What is being proposed

That every project bound to the methodology maintain a **conceptual model**:
a single dependency-ordered document defining every salient concept, in which
each entry is explicitly one of **requirement**, **specification**, or
**implementation**, traces upward to what justifies it, and records the
**delta** between what it says and what the code does.

Two checks, and the proposal is that both are required:

- **(a) Internal consistency** — every specification item traces to a
  requirement; every implementation choice traces to a specification item;
  orphans in either direction are findings.
- **(b) Code fidelity** — every entry states what the code actually does, and
  the gap between that and the definition is a recorded, owned defect.

Existing practice has neither. It has design documents (which state intent),
a decision register (which states rulings), and a test suite (which states
behaviour) — and nothing that holds the three against each other.

## 2. The evidence this is worth doing

From one project, in one pass over the tier it understood best:

| Finding | Measure |
|---|---|
| Concepts defined nowhere in the design docs | **93 of 136** exported types |
| A decision recorded "executed" whose rename never happened | `ContextValue` **701** uses vs `StructureValue` **2** |
| A retired kind still naming a live type | `MultiValueType`, **25** uses |
| Entries mis-levelled — implementation written as design | **4 of 17** |
| Deltas found in T0–T1 alone | **9** |

Every one of these passed every gate the project has. The suite is green,
the typecheck is clean, the decision register says the work is done. They are
invisible to testing **by construction**: none of them is a behaviour.

## 3. The mechanism, and why it is cheap

### 3.1 The three levels

| Level | Falsified by | Alternatives |
|---|---|---|
| **Requirement** | Showing the system can be built without it | **None** |
| **Specification** | Showing it fails the requirement it claims | **Few**, and visible |
| **Implementation** | Showing it violates the spec, or is dominated on its selecting criterion | **Many**; replaceable silently |

**The alternatives test** is the whole enforcement mechanism and it costs one
question per entry: *can I list plausible alternatives?* If yes for something
called a requirement, it is a specification. If no for something called an
implementation choice, it is probably specification. Cheap, and it catches
the error the practice exists to prevent.

### 3.2 The entry format

Five parts: **Level** (and what it traces to), **Definition** (using only
concepts defined above it), **Rationale**, **As implemented**, **Delta**.

### 3.3 Two constraints that do the real work

**Dependency order.** No entry may use a concept defined later. This is a
design check, not a presentation preference: a concept that cannot be defined
without a forward reference is telling you something, and it should be
recorded where it happens rather than written around. In the pilot it
immediately exposed a genuine cycle (carrier ↔ data plane) that resolved
cleanly once forced into the open.

**Implementation-first authorship.** Read the code, write *As implemented*
from that reading, and only then write the definition. Reversing this order
produces a document that says what we wish were true — which is the failure
being corrected, not a new safeguard against it.

### 3.4 Implementation choices carry alternatives and a revisit trigger

A choice recorded as "we decided X" cannot later be evaluated. A choice
recorded as *X, over alternatives Y and Z, on criterion C, revisit if D* can.

This is the single highest-value element and the pilot proved it by
counter-example: the project's central representational decision — condensing
two composite types into one — was doubted years later by the person who took
it, and the doubt could not be resolved because **nothing recorded what the
alternatives were or which criterion selected one.** Reconstruction found
the recorded rationale was entirely about performance (a future codegen
payoff and a present hidden-class layout), and that nothing had ever claimed
it simplified the concept. It had been *read* as a simplification for years,
by its own author, purely because the levels were not separated.

## 4. Where it sits in the lifecycle

- **Created** once per project, as its own arc, at whatever point the
  concept count makes it worth having. It does not need to precede the code —
  the pilot ran on a mature codebase and that is arguably where it pays most,
  since the deltas are already there to be found.
- **Maintained** in the same PR as the change that alters a concept, exactly
  as design docs are today.
- **Checked** at the landing gate: an entry may not be left with an unowned
  delta.

## 5. What this replaces, and what it does not

It **does not** replace design documents. The spine holds definitions and
short rationale; the area docs keep the deep treatment. Nothing is
duplicated — a disagreement between them is itself a delta.

It **does** replace the implicit practice of holding the conceptual model in
the maintainer's head. That practice failed silently and for a long time: the
model was coherent, the code was correct, and they had drifted apart with no
mechanism that could notice.

## 6. Cost, honestly

- Part 0 plus T0–T1 (17 entries, the requirement set, and a 7-entry
  implementation register) took roughly one working session on a codebase
  the author already knew well.
- The full inventory is ~28 clusters across 6 tiers.
- Ongoing cost is per-concept-change, comparable to the existing design-doc
  update rule.
- The deltas it produces are **added work**, not removed work. That is the
  point, and it should be stated plainly rather than sold as a saving: the
  practice converts invisible debt into a visible list. A project that would
  rather not see the list should not adopt it.

## 6a. Amendments the pilot itself produced

Added after the cohesion pass, because each was found by the practice failing
in a specific way rather than by reasoning about it.

- **Requirements carry an *As implemented* row too.** Part 0 was written with
  Level / Definition / Rationale only — no code column — and it is the one
  part of the pilot document that stated something **false**: a requirement
  claiming "failure is a value, not a control-flow escape" in a codebase that
  throws 117 times in its base layers. Every other entry had an *As
  implemented* row and none of them made that mistake. A requirement nothing
  in the code answers to is either aspirational or wrong, and there is no way
  to tell which without looking.
- **Run the cohesion check as its own pass, not per entry.** It finds a
  different class of defect from the per-entry delta: the delta check compares
  a statement to the code, cohesion compares statements to each other. In the
  pilot, cohesion retired **seven of fourteen** proposed requirements — as
  derived, conflated, or not requirements at all — and surfaced three needed
  capabilities that nothing in the set enabled. None of that is visible one
  entry at a time.
- **Expect the requirement count to fall.** A smaller independent set is a
  stronger one. Every item the pilot removed was removed by an argument that
  also said where it now belongs, so nothing was lost — the model got shorter
  and more load-bearing at once. A practice that only ever *adds* requirements
  is not being checked.

## 6b. The target form — machine-checkable

The pilot's maintainer intends the model to become **formal**: logical
statements over requirements, specification, implementation choices,
constraints and test cases, with coverage, traceability and correctness
checks automated. The amendment should not require that — most projects will
not have a checker — but it should require the properties that make it
*possible* later, because they cost nothing now:

- **Traceability links in a fixed position**, not in prose.
- **Stable, unique identifiers** for every requirement, choice and entry;
  they are the join keys.
- **The three orphan checks stated as rules**, since they are graph queries
  and are the first thing a checker would run.
- **A "Verified by" row** linking entries to the tests that hold them, so
  requirement ↔ test coverage is derivable. The pilot has not added this yet
  and records the gap rather than guessing at the format.

The point is not to write pseudo-formal prose. It is that a model written
with regular structure and stable identifiers can be *translated*, and one
written as flowing argument cannot.

## 7. Open questions for the amendment

1. **Is the practice mandatory, tiered, or recommended?** Suggestion: tie it
   to the classification — required at C2 and above, recommended below.
2. **Does an unowned delta block a landing?** Suggestion: yes for entries the
   change touches, no globally — otherwise the first adoption blocks
   everything.
3. **Where does the document live?** In the pilot, `docs/design/concepts.md`,
   registered as the read-this-first Tier-1 document.
4. **Does the decision register absorb the implementation-choice register, or
   stay separate?** They overlap: a D-number records a ruling, an IC-number
   records alternatives + criterion + revisit trigger. Suggestion: separate,
   because most implementation choices are never big enough to warrant a
   decision entry — and those are exactly the ones that go unrecorded today.

## 8. Suggested improvements to the surrounding process

Raised by the pilot, adoptable independently of the amendment:

- **A decision may not be marked "executed" on a partial execution.** D1 and
  D46 were both recorded executed when the runtime half had landed and the
  naming half had not. A decision should carry its own falsifiable completion
  test — for a rename, a count.
- **Prefer measurement to reasoning on questions about the running system.**
  Three times in the pilot arc, instrumenting the suite settled in one run a
  question that repeated reasoning had got wrong — twice in *opposite*
  directions. Cheap, and it is the difference between a claim and a finding.
- **A lint that cannot see the artifact being added is a false negative.**
  Found the hard way: a doc-reference check scanned tracked files only, so a
  new document's references were unverifiable until after the commit. The
  same repository's other lint had already made the opposite (correct) call.
  Checks should see uncommitted work by default.
