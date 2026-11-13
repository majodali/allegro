---
type: stream-plan
status: active
backlog: B-196
lane: Q
merge: merge-on-green
oracle:
  - npm test
  - npm run lint:streams
  - npm run lint:docs:check
  - npx tsx scripts/doc-ref-lint.ts
  - npx tsx scripts/analyze/lane-lint.ts --check
  - npm run lint:decisions
  - npm run test:next
  - npm run typecheck:next
chunks: [Q1, Q2, Q3, Q4, Q5, Q6, Q7, Q8]
reserves: [B-197, B-198, B-199]
boundary:
  - docs/plans/rebuild-acceptance.md
  - next/decisions.json
  - next/corpus/**
  - next/bootstrap/**
  - next/launch/**
  - next/tools/**
  - next/models/**
  - package.json
  - .github/workflows/ci.yml
---

# What the rebuilt kernel must pass, and what runs on it — the acceptance stream

> **Status: active** since the merge of PR #197 (2026-11-13) — written
> that day by the orchestrating session with the program plan
> `docs/plans/rebuild.md`, from the maintainer's rulings of that day.
> Chunk Q1 (the decision map) is its first chunk. The status line and
> the header's `status` say the same thing.
>
> **Reader**: the maintainer, and the session that runs the stream.
> Assumed known: the program plan, whose §1 defines
> [present tree](rebuild.md#def-present-tree),
> [new tree](rebuild.md#def-new-tree),
> [acceptance corpus](rebuild.md#def-acceptance-corpus),
> [decision map](rebuild.md#def-decision-map),
> [first notation](rebuild.md#def-first-notation) and
> [milestone](rebuild.md#def-milestone); and the decision inventory
> `docs/plans/book-pass-inventory.md`.

## 1. Outcome and terms

**Outcome.** B-196 (the rebuild's acceptance side) is met when
milestone 9 of the program is signed. Until then the stream is measured
by the milestones it owes work to (program plan §5), and by three
things it alone supplies:

- **What the new kernel must pass**: the acceptance corpus, every case
  classed and tied to the decisions it tests.
- **How a program reaches the new kernel before a parser exists on
  it**: the first notation and the emitter of saved programs.
- **What runs on the kernel from outside**: the launcher, the
  capabilities, the phases and the tools of the inventory's Part VI,
  and the models of Part V, specified before they are built.

**Terms.** Proposed here, ratified at the merge. Each uses only terms
defined before it or in the program plan.

- <a id="def-case"></a>**Case**: one unit of the acceptance corpus: a
  pinned output line of a demo or test program, or a test of the
  present tree's suite.
- <a id="def-class"></a>**Class** (of a [case](#def-case)): *survives*,
  the new tree must give the same result; *changes*, a named ruled
  decision changes the result, and the case states the new one;
  *detail*, the case tests how the present tree is built and ends with
  it.
- <a id="def-scenario"></a>**Scenario**: a demo scene restated as who
  acts, what they do and what the platform must find, in the
  inventory's vocabulary, with no dependence on exact output text.
- <a id="def-model-specification"></a>**Model specification**: the
  definition of one pilot model and its language: its values, its
  claims, its notation, the mappings it takes part in and the
  obligations it can leave open, written against the decisions of the
  inventory's Part V.

## 2. What the corpus is built from, measured

On `origin/main` at `e399222`, 2026-11-13.

| Measure | Count |
|---|---|
| Demo and test programs, `tests/*.alg` and `demos/*/*.alg` | 73 |
| Pinned output lines in them and in `basics.alg` | 653 |
| Tests of the suite, `src/test/` | 1,378 |
| Demo scenes, rungs 1 to 4 | 10 |
| Libraries, `lib/*.alg` | 17, of 2,765 lines |

**Pins are exact text, and the rulings change text.** Fourteen programs
use the strength words that the ruling "Four strengths, one
vocabulary" replaces, and five of their pinned lines carry them. The planning and units libraries use the
error-value idiom 33 times, where the rulings make a failed
construction a refutation and a handled failure an exception. A pin
therefore cannot bind the new tree as written; its
[class](#def-class) says how it binds.

**The pilots are thinly specified.** The planning model's design truth
is a chapter of about 900 lines whose 15 decisions phase 1 left held. The
software system model exists as five proposed rows and seven measured
findings (§2b of `docs/plans/planning-loop.md`). Neither is stated
against the Part V decisions "A model is a value", "Two models relate
only through a declared mapping" and "Solving is proposing a value for
an unknown, and the kernel checks it".

## 3. Oracle, gate and stop conditions

**The oracle grows with the stream.** The header lists the commands
that exist today. Q1 adds `npm run lint:decisions`; Q2 adds the corpus
check; Q6 adds the comparison run. Each joins the header in the chunk
that creates it, and CI runs the new tree's commands in a step of
their own, beside the present tree's gate.

**The gate.** Merge on green, under the program plan's §3, for a chunk
whose row in §5 says so. A row marked for the maintainer is one of the
three gated events, a ruling, or a design.

**Stop conditions.** Those of the program plan's §3, and two of the
stream's own:

- **A case classed *changes* with no ruled decision to cite.** The case
  is one that survives until a ruling says otherwise.
- **New pilot code on the present tree beyond a library-only probe.**
  A probe is a new `.alg` file under `next/models/` run by the present
  tree's CLI; it edits no file of the present tree.

## 4. File boundary

**Lane Q**, the header's `boundary`. Every path is in the new tree
except the stream's plan, `package.json` and the CI workflow.

Outside, on purpose: `next/kernel/**`, `next/prims/**` and
`next/ext/**`, which are the kernel stream's; the present tree, under
the freeze; `docs/book/**` and the inventory, which are the review
session's. A need in one of them is stated in the PR's "For the other
stream" part, or filed under B-197 (evidence against a ruled decision)
when it is evidence against a ruling.

## 5. Chunk sequence

Q1 to Q4 start at once and do not wait for the kernel. Q5 to Q7 wait
for the kernel stream's first chunk, the interface file and the
saved-program data form.

| Chunk | Deliverable | Oracle | Gate |
|---|---|---|---|
| Q1 | **The decision map.** `next/decisions.json`, generated once from the inventory: one row per decision with its part, chapter, type, status against the present code, owning stream, state (none), unit and cases. Its check, `next/tools/decision-map.ts`, run as `npm run lint:decisions`: every decision of the inventory has exactly one row and every row a decision; an owner is R, Q or none; a state other than none names a path that exists. A CI step for the new tree's commands | the check passes on 231 rows; a probe with a row removed fails it | merge on green |
| Q2 | **The corpus, inventoried and classed.** `next/corpus/cases.json`: every [case](#def-case) with its source, its text and its [class](#def-class); a *changes* case names its ruled decision and states the new result; each case that survives or changes lists the decisions it tests, and the decision map's rows gain them. Its check: every pin and every test of the present tree has exactly one case | the check passes; the counts of §2 are met | merge on green; classes reviewed at their milestone (program plan, P5) |
| Q3 | **The scenarios.** Each of the ten scenes of rungs 1 to 4 as a [scenario](#def-scenario) under `next/corpus/scenarios/`, with the cases that realise it and the milestone that must pass it | every scene has a scenario; every scenario names a milestone | the maintainer |
| Q4 | **The model specifications.** A [model specification](#def-model-specification) for the planning model and the loop over it, and one for the software system model (components, data, and the mappings between them and to a plan), under `next/models/specs/`. Each states its use cases first. The measurements of the planning-loop plan's §2b are their evidence; library-only probes may add more. They are the material for the 15 held planning decisions, which the review session rules | the documents' lints | the maintainer, per specification |
| Q5 | **The first notation and the bootstrap.** The notation's forms, each standing for one kernel expression; an emitter under `next/bootstrap/` that has the present tree's parser read a text in it and writes a saved program in the data form | the emitter's tests against the interface file's types; a round trip on fixture programs | the notation: the maintainer (a contract). The emitter: merge on green |
| Q6 | **The comparison harness.** Under `next/corpus/`: runs a program on the present tree and on the new one and compares by class; reports the cases passing per milestone | its tests on a stub kernel, then on the kernel | merge on green |
| Q7 | **The minimal launcher and the output capability.** Under `next/launch/`: startup as the ruled decision "Startup, step by step" has it, as far as milestone 2 needs | milestone 2's command | merge on green; the milestone is the maintainer's |
| Q8 | **The speed tests of milestone 3.** A typed extension and a toy parser engine, written in the first notation with the kernel stream, measured against the present tree on the same programs | the measurements, recorded in §7 | the maintainer |

**After milestone 3**, by amendment of this plan: the phases as
configurations, the commands, the tools for proposing rebuilt as
readers of results, the capabilities the launchers ship, and the units
and planning libraries ported at milestones 6 and 7.

## 6. Rulings

**Taken 2026-11-13**: those of the program plan's §6. The stream's merge
policy is the gate ruled there.

**Put at the plans' PR, each default taken** at the merge of PR #197 on
2026-11-13, where the maintainer wrote "All defaults accepted":

- **A1 — The four terms of §1.** Default: ratified.
- **A2 — Reserves.** B-197 is the hand-off item of the program plan's
  §8. B-198 (first out-of-scope finding of the acceptance stream) and
  B-199 (second out-of-scope finding of the acceptance stream) are
  placeholders. Default: as written.
- **A3 — Q4 before any pilot code.** The software system model's rows
  proposed at PR #194 are input to its specification, not chunks.
  Default: as written.

## 7. Record

- **2026-11-13 — planned.** Written with the program plan on
  `origin/main` at `e399222`. No code changed.
- **2026-11-13 — Q1 landed.** The decision map `next/decisions.json`,
  generated from the inventory, and its check
  `next/tools/decision-map.ts`. The check prints:
  `decision-map: 231 rows · R 141 · Q 67 · none 23 · state none 231, carried 0, adapted 0, written 0, proved 0 — consistent`.
  The owner split: Part I, 23 rows, none; Parts II, III and IV, 51, 23
  and 63 rows, R; Part V, 27 rows, Q; Part VI, 44 rows, of which the 4
  of "The kernel's interface" are R and 40 are Q. The status against the
  present code reproduces the inventory's count: 93 settled, 62 partly
  built, 76 open; 15 rows are held. No entry's `- Chapter:` line
  disagrees with the heading it sits under; no title appears twice; every
  entry has a `- Type:` and a `- Status:` line. Oracle, each green:
  `npm run typecheck:next`, `npm run test:next` (19 tests, among them
  probes with a row removed, duplicated, orphaned, misowned, out of
  order, a state with no unit and a unit outside `next/`),
  `npm run lint:decisions`, `npm run lint:streams`,
  `npm run lint:docs:check`, `npx tsx scripts/doc-ref-lint.ts`,
  `npx tsx scripts/analyze/lane-lint.ts --check`, the lane check of the
  PR's files against lane Q, and
  `ALLEGRO_TEST_FILTER="tooling|lane|stream" npm test`.
