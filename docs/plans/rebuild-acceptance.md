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
  - npm run lint:corpus
  - npm run harness:present
  - npm run harness:next
  - npm run bench:next
chunks: [Q1, Q2, Q3, Q4, Q5, Q6, Q7, Q8, Q9, Q10, Q11, Q12, Q13, Q14, Q15, Q16, Q17, Q18, Q19, Q20, Q21, Q22]
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
> **Amended 2026-11-20**, as §5 said it would be once chunks Q1 to Q8
> were delivered: the work after milestone 3 is planned in §5, "After
> milestone 3", as chunks Q9 to Q22, and its questions are in §6.
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
| Of those, the programs the suite runs against their pins, and their pinned lines | 71, of 613 |
| Tests of the suite, `src/test/` and `src/boundary-tests.ts` | 1,379 |
| Demo scenes, rungs 1 to 4 | 11: ten programs and rung 1's prover-loop walkthrough |
| Libraries, `lib/*.alg` | 17, of 2,765 lines |

**Corrected at Q2, part 1.** The suite registers 1,379 tests, not
1,378: a full run's total is 1,379, of which one, the IR lint, needs a
methodology-tools checkout and fails without one; 1,378 was the count
of tests passing. Two programs carry 40 of the 653 pinned lines and
the suite does not run them: `tests/grammar-regex.alg` (12) and
`tests/stdlib.alg` (28). `basics.alg` has no pinned line; the suite
runs it against output pinned in the tests' own code. The corpus
therefore holds 613 pins.

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
| Q1 | **The decision map.** `next/decisions.json`, generated once from the inventory: one row per decision with its part, chapter, type, status against the present code, owning stream, state (none), unit and cases (the stored cases were dropped on 2026-11-20 and are derived from the corpus, by the ruling on question B4 of §6). Its check, `next/tools/decision-map.ts`, run as `npm run lint:decisions`: every decision of the inventory has exactly one row and every row a decision; an owner is R, Q or none; a state other than none names a path that exists. A CI step for the new tree's commands | the check passes on 231 rows; a probe with a row removed fails it | merge on green |
| Q2 | **The corpus, inventoried and classed.** `next/corpus/cases.json`: every [case](#def-case) with its source, its text and its [class](#def-class); a *changes* case names its ruled decision and states the new result; each case that survives or changes lists the decisions it tests, and the decision map's rows gain them. Its check: every pin and every test of the present tree has exactly one case | the check passes; the counts of §2 are met | merge on green; classes reviewed at their milestone (program plan, P5) |
| Q3 | **The scenarios.** Each of the eleven scenes of rungs 1 to 4 as a [scenario](#def-scenario) under `next/corpus/scenarios/`, with the cases that realise it and the milestone that must pass it | every scene has a scenario; every scenario names a milestone | the maintainer |
| Q4 | **The model specifications.** A [model specification](#def-model-specification) for the planning model and the loop over it, and one for the software system model (components, data, and the mappings between them and to a plan), under `next/models/specs/`. Each states its use cases first. The measurements of the planning-loop plan's §2b are their evidence; library-only probes may add more. They are the material for the 15 held planning decisions, which the review session rules | the documents' lints | the maintainer, per specification |
| Q5 | **The first notation and the bootstrap.** The first notation is Allegretto, whose forms the kernel stream's `next/ext/allegretto/forms.md` rules (amended 2026-11-16); under `next/bootstrap/`, a grammar for it made from the present base grammar, a reader of the present parser engine's parse tree, and an emitter that writes a saved program in the data form. The bootstrap's driver emits a text's imported texts first (amended 2026-11-20, PR #250 and PR #268) | the emitter's tests against the interface file's types; a round trip on fixture programs | the notation: the maintainer (a contract). The emitter: merge on green |
| Q6 | **The comparison harness.** Under `next/corpus/`. On the present tree it runs each pinned program and compares its printed lines with its pins by class. On the new tree it runs every Allegretto program under `next/corpus/allegretto/` and reports, per milestone, the cases those programs realise: a case is shown by an Allegretto program that passes, with the present expectation, or the case's stated new result where its class is *changes*. A program may hand a standard-language text to the parser engine once that engine exists in Allegretto (amended 2026-11-16, by the maintainer's ruling that the tests and code of milestones 4 to 7 are written in Allegretto) | its tests on a stub kernel, then on the kernel | merge on green |
| Q7 | **The minimal launcher and the output capability.** Under `next/launch/`: startup as the ruled decision "Startup, step by step" has it, as far as milestone 2 needs, and it supplies the inputs of the module being run, at the start or in a later phase (amended 2026-11-17, PR #238's ruling on inputs). It loads the records of imported modules (amended 2026-11-20, PR #250 and PR #268). The launcher ships a capability for waiting, `timer`, beside `output` (amended 2026-11-20) | milestone 2's command | merge on green; the milestone is the maintainer's |
| Q8 | **The speed tests of milestone 3.** A typed extension and a toy parser engine, written in the first notation with the kernel stream, measured against the present tree on the same programs | the measurements, recorded in §7 | the maintainer |

### After milestone 3 (amended 2026-11-20)

Chunks Q1 to Q8 are delivered. This part plans the rest of B-196: what
this stream owes to milestones 3 to 9. It is a proposal until the
maintainer merges it. Its open questions are in §6.

**What is left, measured** on `origin/main` at `705c232`.

| Measure | Count |
|---|---|
| Decisions this stream owns in the decision map | 69: Part V 27, Part VI 42 |
| Of those, rows whose state the map has moved | 0 |
| Cases due at milestones 1 to 3, and realised by a program | 165, and 132 |
| Cases due at milestones 4 to 9 | 1,681 |
| Scenarios due at milestones 5, 6 and 7 | 5, 3 and 3 |
| Backlog items classed as still needed in this stream | 18 |

The cases due, by milestone, with the sources that hold most of them:

| Milestone | Cases due | Of them classed *changes* | Largest sources |
|---|---|---|---|
| 4 | 653 | 25 | the three type test files (243), the language tests of the second grammar (70), six pinned programs (116) |
| 5 | 541 | 177 | proofs (78), effects (61), totality (59), the prover protocol (55), equality and laws (35) |
| 6 | 147 | 15 | the language tests of the second grammar (37), the units programs (62) |
| 7 | 244 | 28 | the planning programs (187), the prover protocol (35) |
| 8 | 94 | 5 | the parser engine's tests (61) |
| 9 | 2 | 0 | tooling |

Milestones 1 and 3 still hold 33 cases not yet realised. Eleven of
milestone 1's wait on metadata fields and their writers, which the
kernel stream builds with the rest of Part II. Four of milestone 3's
wait on the prompt of Q14. Each stays at its milestone and is realised
in the part of Q12 that follows what it waits on.

**What each milestone needs from each stream.**

| Milestone | From the kernel stream | From this stream |
|---|---|---|
| 3 | chunks K12 (the interface made one) to K15 (specialization, and the switch) of `docs/plans/book-pass.md` §5 | Q9; the bench run on both variants at each of those chunks |
| 4 | the chapters of Part IV on types, as extensions in `next/ext/`; the forms of the standard language's notation, ruled as Allegretto's were | Q10, Q11, and Q12 for milestone 4 |
| 5 | the rest of Part IV: refinements, claims and proofs, laws, effects, contracts, termination | Q13, Q14, Q15, Q16, and Q12 for milestone 5 |
| 6 | a text that changes the grammar it is read in, read on the kernel | Q17, and Q12 for milestone 6 |
| 7 | nothing new is named | Q18, Q19, and Q12 for milestone 7 |
| 8 | the parser engine and the module loader, written in Allegro | Q20, and Q12 for milestone 8 |
| 9 | the book's consumable chapters | Q21, Q22 |

**The chunks.**

| Chunk | Deliverable | Oracle | Gate |
|---|---|---|---|
| Q9 | **The launcher on the one interface.** This stream's side of chunk K12: `fill` takes up what waited, `scope()` is gone, and `steps` on `advance` is removed if the maintainer confirms it. One pull request on each side | `npm run test:next` on both variants; `npm run harness:next` on both | the maintainer: a contract change |
| Q10 | **The decision map made current.** Each row of this stream moved to the state its unit has earned, with the unit named. The stored `cases` lists go: the check derives them from the corpus, where each case already lists its decisions. From this chunk on, a chunk moves its rows in its own pull request (program plan §8, item 6) | `npm run lint:decisions` | merge on green; the dropped lists are question B4 (the map's stored lists of cases) of §6 |
| Q11 | **The standard language's notation in the bootstrap.** A grammar for the present parser engine, a reader and an emitter for the forms the kernel stream rules, as Q5 built Allegretto's. The emitter writes each form as what the forms document says it stands for. It reads the fixed notation only: a text that changes the grammar is read on the kernel: question B1 (how a text in the standard language is read) of §6 | the forms document's examples emit and run; `npm run test:next` | the maintainer: the notation is a contract |
| Q12 | **The cases of each milestone, realised.** In parts, one for each milestone and source. A pinned program is run on the new tree as it stands and compared with its pins by class. A test is restated as a program that shows what it asserts. A case that only host code can show is counted as question B2 (cases only host code can show) of §6 has it. Subagents do the restating; this session reviews every program against its case | the harness's line for the milestone: every case due is realised | merge on green; a change of class or milestone is the maintainer's; each milestone is the maintainer's |
| Q13 | **Check and run as configurations, and what a result holds.** Under `next/tools/`. A configuration from its sources in their ruled order: the command line, a project's file, the environment, what the launcher holds. Check, with no capability but the loader's file reading. Run, with the ceiling's capabilities. A pipeline whose residual the next evaluation takes, in one execution. The result as data: each claim as written, with its counts of decided, assumed, undecided and refuted, the reasons, and what the outcomes rest on; and the source of each configuration value. It closes B-059 (the project root file) | tests of each rule; the result of a fixture program, compared field by field | the maintainer: the result's form is what every tool reads |
| Q14 | **The commands.** Each names a configuration and a way of presenting its result: `allegro` with a file runs it, with no argument it starts a prompt, and one command for each of check and the listings of Q15. A module's summary is one word, the weakest strength among its claims. The prompt is a module, on one kernel that serves every entry. The default configuration is the standard language | each command on fixture programs; the prompt's cases of the corpus | the maintainer for the commands' names; then merge on green |
| Q15 | **The tools for proposing.** Readers of a check's result, with no analysis of their own. The list of open obligations, in a form for programs and one for people. One primer. A proposal that is only the missing value, placed, evaluated again and kept only if the claim is decided, for a bounded number of attempts. Where accepted values are stored is configuration, the store is never trusted, and the deriver holds no capability. The proposer that asks a language model runs `claude -p`; no test runs it or reaches a network. It replaces the present prover protocol and the planning-loop tooling | scenario rung 1's prover loop; the prover protocol's cases; tests with a scripted proposer | the maintainer: a design, and writing to the repository is an effect |
| Q16 | **The capabilities the launchers ship.** HTTP, proposed as `timer` was: its name, its parts, what each answers, and its failure as plain data of the one shape. File reading for the loader, bounded to the project's and the platform's directories. File writing only where Q15's store needs it. Tests use a transport and a file system they control | tests of each part; programs under `next/corpus/` | the maintainer: names and shapes are a proposal |
| Q17 | **The units library.** Under `next/models/units/`, from the present library and to the four decisions of "Units of measure" | scenarios rung 2, one to three; the harness's line for milestone 6 | merge on green; a change by ruling is the maintainer's |
| Q18 | **The planning library.** Under `next/models/planning/`, to the planning model's specification of Q4 and the decisions of "Plans as outcome graphs" and "Finding solutions to a plan". The decisions of "Models" and "Search and optimization" are realised as far as this model needs them | scenarios rung 3, one and two; the planning programs' cases | the maintainer for each design the specification left open; then merge on green |
| Q19 | **The loop over a plan.** Rung 4: a plan's gaps listed as obligations, and catalog entries proposed and checked, with the tools of Q15 | scenario rung 4; the two planning-loop programs' cases | the maintainer: milestone 7 |
| Q20 | **The bootstrap retired.** With the kernel stream. Every program of the corpus is read by both readers and runs the same. Then the driver gives way to the loader with Q16's file reading, `use name` is read, and `next/bootstrap/` is deleted | both readers agree on every program; then `npm run harness:next` without the bootstrap | the maintainer: milestone 8 |
| Q21 | **The browser launcher.** One bundle that sets one global object, on the core that runs in a browser. Where the pages live in the new tree is named when this chunk is in sight, since the site's directories are the present tree's | the bundle's calls on fixture programs, in a browser | the maintainer: a lane's paths change |
| Q22 | **The present tree's end.** With the kernel stream. A last recorded run of the comparison and of the bench against the present tree. Then the comparison's present side, the present suite's gate and its ratchets go, CI runs the new tree's gate alone, and the directories are deleted. Who deletes which directory is named when this chunk is in sight: the lanes split them | every case that survives or changes is realised; the new tree's gate | the maintainer: milestone 9 |

**Order.** Q9 follows the kernel stream's chunk. Q10, Q13 and Q16 wait
on nothing and start first. Q11 waits on the forms. Q12 for a milestone
waits on Q11 and on the kernel stream's chapters for it. Q14 follows
Q13, and Q15 follows Q14. Q17 to Q19 wait on their milestones'
notation. Q20 and Q22 are joint.

**The decisions, by chapter.** Each chapter's rows are moved by the
chunk named. "Later" is the list below.

| Chapter | Decisions | Chunk | Later |
|---|---|---|---|
| Configuration | 3 | Q13 | a configuration written as a model |
| Launching | 4 | Q7, Q14 for one kernel serving many entries, Q20 for the loader | |
| Capabilities and primitive functions | 5 | Q7, Q16 | loading host code; a reference definition for every pure primitive, which is the kernel stream's work on `next/prims/` |
| Phases | 3 | Q13 | export |
| Saved programs and export | 9 | Q5 and Q7 for the three on saved programs | the six on export, rewriting by a law and distribution |
| Trust | 6 | Q13 for what a result names and what a phase must leave decided | manifests, signatures, profiles, and the stronger grounds for a primitive's purity |
| Tools | 7 | Q14, Q15 | a trace read from origins |
| The launchers we ship | 5 | Q7, Q14, Q16, Q21 | |
| Models | 4 | Q18 | a change to a model as a mapping |
| Search and optimization | 3 | Q18, Q19 | |
| Analysing models | 1 | | all of it |
| Units of measure | 4 | Q17 | |
| Plans as outcome graphs | 11 | Q18 | |
| Finding solutions to a plan | 4 | Q18, Q19 | search beyond enumeration |

**Not owed to a milestone.** The program is done when the corpus
passes, the parser engine has replaced the bootstrap and the present
tree is deleted (program plan §1). The present tree does none of the
following, so no case asks for it, and this plan does not schedule
it. That is question B3 (what no milestone asks for) of §6.

- export to a target, saving as a case of export, and an exported
  program's equivalence to the program in a kernel;
- rewriting by a law, and how extensions are distributed;
- manifests, signatures, profiles of policies, and purity shown by
  sampling or by a confined target;
- a configuration written as a model and evaluated first, which the
  inventory marks a design to prove;
- loading host code as a capability;
- a trace read from origins, and the analysis of models;
- the software system model: its specification of Q4 stands, and it
  is not built before milestone 9;
- the backlog items B-054 (the proof catalog), B-055 (parallel prover
  strategies), B-056 (effort budgets for provers), B-063 (tree shaking),
  B-064 (tracing and stepping), B-066 (expression-graph processing),
  B-067 (editor integration), B-068 (the review surface), B-078 (module
  versions), B-080 (further model languages), B-082 (model composition)
  and B-086 (awareness of escape hatches).

Six of the 18 backlog items are taken by a chunk:

- B-059 (the project root file) by Q13;
- B-065 (the prompt's improvements) by Q14, as far as the corpus asks;
- B-083 (the AI iteration loop) by Q15 and Q19;
- B-070 (browser packaging) by Q21;
- B-071 (the capabilities for input and output) by Q16, for HTTP and
  the two file capabilities; its rest is later;
- B-151 (the planning pilot) by Q18.

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

**Put at the amendment's PR, each default taken** at the merge of
PR #283 on 2026-11-20, for the work after milestone 3.

- **B1 — How a text in the standard language is read at milestones 4
  to 7.** The parser engine written in Allegro replaces the bootstrap
  only at milestone 8, and at milestone 3 it reads 64 terms in about 15
  seconds. Three ways were weighed. (a) The bootstrap gains a second
  grammar for the standard language's fixed notation, and a text that
  changes the grammar is read on the kernel by the kernel stream's
  engine. (b) The engine written in Allegro reads every such text from
  milestone 4. (c) Every case is restated in Allegretto as calls on the
  extension's functions, and the notation waits for milestone 8.
  Default: (a). It keeps the suite fast, as (b) does not until
  specialization lands, and it tests the notation, as (c) does not. It
  needs the kernel stream to rule the forms and to have its engine read
  a text that changes its grammar by milestone 6. Both readers must
  agree before milestone 8, which Q20 checks.
- **B2 — How a case that only host code can show is counted.** 19 of
  the 25 cases of milestone 1 and 14 of the 131 of milestone 3 are not
  realised by a program. Most wait on something not yet built: metadata
  fields and their writers, the prompt, a second configuration. Some
  assert what only host code can observe, such as what a primitive
  function is handed or a second fill of one cell, and more such cases
  are due at milestones 4 to 8. Default: a list under `next/corpus/` names, for each such case, a test of the
  new tree that shows it, in either lane. The harness counts the case
  as realised when the test exists and passes, and its line says how
  many cases are shown by a program and how many by a test. The list is
  this stream's file; it edits no test of the kernel stream.
- **B3 — What is not owed to a milestone.** Default: the list of §5,
  "Not owed to a milestone", waits until milestone 9 is signed.
- **B4 — The decision map's stored `cases` lists.** They are empty, and
  each case of the corpus already lists its decisions. Default: the
  lists are dropped from the map's rows and the check derives them.
- **B5 — The gates of chunks Q9 to Q22**, as their rows say. A design
  of Part V or Part VI, a contract, a capability's name and shape, and
  each milestone are the maintainer's. Realising cases and porting to
  ruled decisions merge on green. Default: as written.

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
- **2026-11-13 — Q2, part 1 landed: the corpus inventoried.** The
  acceptance corpus `next/corpus/cases.json` holds one
  [case](#def-case) per pin of the 71 programs the suite runs against
  their pins and one per test the suite registers, every
  [class](#def-class) null; `next/corpus/registered-tests.json` lists
  the registrations. Its check, `next/tools/corpus.ts`, run as
  `npm run lint:corpus`, prints:
  `corpus: 1992 cases · pins 613 · tests 1379 · classed 0 (survives 0, changes 0, detail 0) · unclassed 1992 — consistent`.
  The registered names come from the suite itself, by a dry listing:
  the suite's index is imported in a child process with its name
  filter set to a pattern no name matches, so every test registers and
  no body runs; the listing takes about a second, and matched a full
  traced run name for name. Two tests of `src/test/types-battery.ts`
  share a name; the second's id ends in `#2`. The check catches a pin
  or a test with no case, or with two; a pin case whose pin is gone or
  whose line or text differs; a test case with no registration; a
  registered-tests list that differs from the dry listing; cases out of
  the stable order; and a class, ruling, result, decision or milestone
  outside the rules of §1 and §5. It cannot catch whether a test does
  what its name says, a test registered only inside another test's
  body, a pin compared by some runner other than the two it knows by
  their tests' names, or whether a class or a ruling is right.
- **2026-11-13 — Q2, part 2 landed: the pins classed.** Every pin
  [case](#def-case) has its [class](#def-class), the decisions it
  tests and its milestone. The check prints:
  `corpus: 1992 cases · pins 613 · tests 1379 · classed 613 (survives 589, changes 22, detail 2) · unclassed 1379 — consistent`.
  By milestone: 31 at milestone 3, 170 at 4, 133 at 5, 82 at 6, 195 at
  7, none at 8. `next/tools/corpus.ts` gains `--apply`, which classes
  cases from an overlay file and refuses an id that is no case.
  - **The 22 that change, by ruling.** Nine by "Constructing a refined
    value claims its predicate": a failed construction read as an
    error value becomes a refutation. Six by "The standard language's
    handled failure is an exception": the printed form of an error
    value. Five by "Four strengths, one vocabulary". One each by "Every
    value keeps its origin" (now "A value's origin is a description")
    and "An extension registers its own fields; the kernel has two"
    (now "An extension registers its own fields").
  - **The 2 that are detail** print through `observe`, which phase 1
    removed.
  - **151 surviving pins carry a note**, since the default class is
    survives where no ruling settles a line. The largest groups: 25
    pins print a plain value in a program that a ruling refutes
    elsewhere; 25 read a library's error value whose replacement the
    scenarios leave open; 13 read the message of a program's own error
    value, where the line stays and the program's source changes; 16
    turn on whether `use` stays one form for bindings and notation.
  - **277 pins rest on one open question**: all of milestones 6 and 7
    print values in programs that hold undecided claims. They are
    classed on the reading that such a run prints (the scenarios' shared
    question).
  - **The planning pins cite held decisions**, 195 of them. A held
    title that the review session restates is moved by the decision
    map's `--sync --rename`, and the corpus check then names every case
    to follow.
  - **What the 1,379 tests need that the pins did not**: rules for tool
    output and for pinned halt messages, a rule for a test of a held
    finding, a wide detail rule for host internals and lints, and
    milestones 1 and 2. The line between milestones 3 and 4 was drawn
    at "the untyped part"; every test program is in the surface
    notation, so the line is by content, not by notation.
- **2026-11-13 — Q2, part 3 landed: the tests classed.** Every
  [case](#def-case) of the corpus now has its [class](#def-class).
  The check prints:
  `corpus: 1992 cases · pins 613 · tests 1379 · classed 1992 (survives 1618, changes 229, detail 145) · unclassed 0 — consistent`.
  Of the 1,379 tests, 1,029 survive, 207 change and 143 are detail.
  All cases by milestone: 27 at milestone 1, 11 at 2, 216 at 3, 564 at
  4, 542 at 5, 147 at 6, 244 at 7, 94 at 8, 2 at 9. Six readers classed
  one group of modules each from one brief, read-only; the six results
  were reconciled before they were applied.
  - **The 207 that change, by ruling.** 68 by "Four strengths, one
    vocabulary": a replaced strength word asserted in output, in a
    message or in a command's data. 61 by "An effect is the use of a
    capability": effect labels as values, effect variables, `opaque`,
    the lattice. 15 by "Constructing a refined value claims its
    predicate". 13 by "The standard language's handled failure is an
    exception". 9 by "Termination is a claim". 6 by "A match where no
    arm matches is a refutation". 5 by "A module's summary is the
    weakest strength among its claims". The other 30 cite 21 more
    rulings, three cases or fewer each.
  - **The 143 that are detail** assert how the present tree is built:
    host layout and host helpers, lints and ratchets over the present
    source, the fixed pipeline's stages and counts, install operations,
    wire schemas of the present tools. 22 of them test the
    repository's own process tools.
  - **639 surviving tests carry a note.** 78 are file tests, whose
    pinned lines are separate cases. Most of the rest are asserted
    through a host interface and restate the behaviour a user
    observes.
  - **Rules the reconciliation fixed.** A test that asserts a halt
    survives: the halt is restated as the refutation of the named
    claim, and the message's words are the present tree's. All six
    readers reached this alone. A strength read through a host
    predicate survives where the ruled strength is decided; the word
    asserted in output or data changes. A failed parse read as an
    error value changes by "Parsing is evaluation", whose entry says a
    text that does not parse is a refutation; two readers had cited
    different rulings for it. A test that asserts what a pin asserts
    takes the pin's class; one case moved by this rule. A file test
    survives at the highest milestone of its pins, also where a pin
    changes. Effect labels as values of the language change; host
    helpers over label sets are detail. Milestones go by content: a
    test of the kernel's behaviour is at milestone 1 though a parsed
    program drives it; a grammar extended through a `grammar { … }`
    block is at 6, and a parser called on a grammar value is at 8.
  - **Left unsure, for the milestones' review.** Whether `decreases`
    offers a measure or makes a claim (6 cases); hints and strategy
    records a tool computes itself, against "A tool reads a phase's
    result and adds no analysis of its own" (9); clock time boxes
    against "Limits are step budgets" (4); recursion through
    higher-order calls, which "Termination by bounded decrease" does
    not name (4); the form of a failure no ruling settles, such as
    division by zero (3); whether a type remains for an unfilled cell
    (2). Each is classed survives with a note saying what is unsure.
  - **The cases by decision.** `next/tools/corpus.ts --by-decision`
    prints, for each decision of the map, the number of cases that
    list it, and with a title the cases themselves. 175 of the 231
    decisions are listed by a case. 56 are listed by none: 32 of the
    acceptance stream's, 12 of the kernel stream's and 12 that no
    stream owns. The present tree has no test for those, so their
    cases are written new.
  - **Not done in this part: the map's stored lists.** The Q2 row
    says the decision map's rows gain the cases. The stored `cases`
    lists stay empty. Filling them would copy about 4,700 ids into
    `next/decisions.json`, about 3,800 of them onto rows the kernel
    stream edits, and each later change of a class would touch those rows.
    The view above answers the same question from the corpus alone.
    Whether the stored lists are filled or the field goes is put to
    the maintainer with the next gated chunk.
- **2026-11-13 — Q6, part 1 landed: the comparison harness on a stub kernel.**
  `next/corpus/harness.ts` takes a runner: a function from a program,
  its path and its text, to the lines it printed and how its run ended,
  completed or stopped with a reason. It compares the i-th pin of a
  program with the i-th printed line, as the suite's `runAlgFile` does.
  A survives pin passes on the exact text. A changes pin is to review,
  with its ruling, its new result and the line produced; a produced
  line equal to the present pin is reported as a change that did not
  happen. A detail pin is not compared. A program that prints more
  lines than it has pins, or stops after a line for every pin, is a
  finding on the program. The report gives, per milestone, the cases
  due, the pins passing, failing and to review, the tests not yet
  realised, and the running total. The present tree's runner runs
  `src/index.ts` in a child process and imports nothing from `src/`.
  `npm run harness:present` runs 70 of the 71 pinned programs, four at
  a time, in about 25 seconds, and prints:
  `harness: present tree · programs 70 run, 0 stopped · pins 613 (passing 586, failing 0 of which 0 with no line, to review 22 of which 22 unchanged, not compared 2, not run 3) · tests 1379 (due 1236, not yet realised 1236; detail 143) — no failing pin`.
  No printed line differs from its pin.
  - **One program's command-line run differs from the suite's.**
    `tests/proofs-proven-demo.alg` declares `proven` clauses without
    `use proven`. The suite passes it `lib/proven.alg` as an
    extension; the file runner has no flag for that, so the run stops
    on a parse error and prints none of its 3 lines. With `use proven`
    added to a copy, the copy prints all 3. The program is the present
    tree's and is not changed. The harness names it with the reason in
    `PRESENT_RUN_DIFFERS`; the command prints that line and counts the
    3 pins as not run. A test holds that every program named there does
    stop under the present tree's runner.
  - **What part 2 needs.** The kernel's runner behind the same type,
    which needs the interface file, the saved-program data form, and
    a way for a pinned program in the surface notation to reach the
    kernel (the bootstrap of Q5). A rule by which a test of the new
    tree names the case it realises, so the harness can count tests.
    A rule for a program that a ruling stops part-way or whose detail
    pins no longer print: the comparison by ordinal then reads every
    later line against the wrong pin.
- **2026-11-13 — The new tree's gate takes the kernel stream's files.**
  Three things the kernel stream's first chunk (PR #207, the kernel's
  interface and the saved-program data form) asked of this lane.
  `npm run typecheck:next` now runs the gate's compiler over every
  `next/<dir>/tsconfig.json` (`next/tools/typecheck.ts`), so
  `next/kernel/` is checked when it lands. The decision map's test no
  longer pins 231 rows: the counts follow the inventory, which may
  gain a decision. A retitle now passes the gate without either
  stream editing the other's file: the map's `--sync --rename` records
  the former title on the moved row, in a field `was`; the corpus
  check accepts a case that cites a former title and counts it in its
  summary; `next/tools/corpus.ts --follow-renames` then moves the
  cases, in this stream's next chunk.
- **2026-11-13 — Q4, part 1 drafted: the planning model specified.**
  `next/models/specs/planning.md`, for the maintainer's ruling: five
  use cases; the model's values, each marked as taken from the pilot,
  changed by a named ruled decision, or open; its claims with who
  makes each and its strength; an open plan as a model with an
  unknown, the catalog remainder; search under "Feasible is decided;
  best says how strongly it holds", with the two designs for the bound
  set side by side; the notation, each form with the expression it
  stands for; every failure the pilot reports and what the ruled
  decisions make it; the mappings; what a phase's result must hold;
  a recommendation on each of the 15 held planning decisions; and 13
  questions, each with options and a recommendation. Its last section
  states the six issues of the review session's adversarial review of
  phase 1 (PR #199) that the specification rests on. One term is new,
  the catalog remainder. The software system model's specification is
  the chunk's second part.
  - **Ruled 2026-11-13.** The maintainer took the recommended option
    of each of the 13 questions and ratified the term, in a comment on
    PR #202: "All defaults accepted, "catalog remainder" ratified." A
    port's type is a type value. An open plan's unknown is the catalog
    remainder, and declaring the plan claims a feasible completion.
    The search's bound comes from the residual of the plan with its
    choices unknown. A model value's names live in a field of the
    value. The 15 held planning decisions stay the review session's.
- **2026-11-14 — Q4, part 2: the software system model specified and ruled.**
  `next/models/specs/software-system.md`.
  The first draft, of 2026-11-13, specified a structural model:
  components, ports, a dependency rule, data entities. The maintainer
  then described the model he has in mind, in a design session, and
  the second draft states it. Participants are users by role, system
  components and external systems. An activity is a set of one-to-one
  interactions toward a goal, with choices and loops, ordered by shared
  content and by explicit constraints, concurrent where unordered. A
  component is decomposed into interfaces, subcomponents and internal
  activities; an interaction is refined into an activity; modelling
  stops at any level. Domain models supply the language of content and
  goals and add attributes to elements. A goal is a description owned
  by the initiating participant, and a guarantee is a claim someone
  makes. The earlier partial use of the model is the chapter
  `docs/book/actors-and-activities.md`.
  - **Ruled in the session, 2026-11-14.** Six additions: valid and
    sound as two levels; a reachability claim; a flag on concurrent
    writes to one stateful component; a partial guarantee as clauses
    with their own strengths; quantitative attributes combined along an
    activity; an intermediary in a refinement only if declared at the
    enclosing level. The example is Allegro as the `next/` tree. The
    term stays "participant", written "system participant" where the
    vision's sense is near.
  - **The example.** Eight participants and three activities of the
    rebuilt Allegro, the first being milestone 2's run of a saved
    program, and the launcher decomposed one level with its agreement
    claim worked by hand. Four things it could not express are listed.
  - **Thirteen questions, all ruled 2026-11-14.** Three in the
    maintainer's words. An activity and a plan stay uncoupled: no
    mapping reads one as the other until a case needs it, and a
    generic graph library may serve both without stating a relation.
    A guarantee the check finds false is a flag, since a goal is a
    predicate and a guarantee is no claim in the platform's sense; the
    one claim is that a declared model is well-formed. An interaction
    is always directed. Of the other ten: "Everything else looks
    good", so each recommended option is taken.
  - **Carried from the first draft.** The mappings to plans, to code,
    to decisions and between versions, restated over the new elements,
    and the probe's finding: with the wildcard of
    `scripts/analyze/units.json` read as every unit, the permitted
    relation has a cycle through `pipeline`, `introspect` and `cli`,
    while the code's 43 unit-to-unit edges have none. The tree is
    frozen, so nothing changes.
- **2026-11-14 — Q7, part 1 landed: the minimal launcher against the kernel's interface.**
  `next/launch/launcher.ts` exports `launch`, a host-neutral function.
  It takes a kernel factory, a saved program as parsed JSON, a
  configuration (the capabilities the ceiling grants and a step budget)
  and a target (the capabilities it supplies and its pure primitives).
  It performs steps 2 to 7 of "Startup, step by step" for one saved
  program. It creates the kernel once. It checks the record and the
  needs it names, and refuses with the findings before any kernel call.
  It refuses a declared capability the ceiling does not grant, by name,
  before any value is made. It makes the ceiling's capabilities as
  effectful primitive functions and applies the module function to the
  declared ones, in the function's order, in a fresh scope, under the
  budget. While the kernel waits on cells it fills those whose answers
  have arrived and calls `advance`. It returns the lines printed and an
  end: completed, refuted, limit, waiting (a cell no capability will
  answer), refused, or fault (the kernel or a capability threw). A
  runner of
  `next/corpus/harness.ts` maps the end to its `RunEnd`. Inputs, module
  parameters and capabilities of more than one part are refused with a
  plain reason. `npm run launch -- <file>` runs
  `next/launch/terminal.ts`, which reads the file, writes the lines to
  stdout and exits 0 on completed, 1 otherwise. It takes the kernel
  factory from `next/kernel/create.ts`, export `createKernel`, which
  the kernel stream is asked to provide. Until that file exists it
  prints `no kernel is built yet: next/kernel/create.ts does not exist`
  and exits 2, as it does today on
  `next/launch/fixtures/hello.json`. The launcher's 17 tests run on a
  stand-in kernel, `next/launch/stand-in-kernel.for-tests.ts`, which
  evaluates by substitution only.
  - **The output capability's names.** The capability is `output` and
    its one part is `write`, from "supply capabilities for writing
    output" in "The terminal and the browser ship output, timers and
    HTTP" and the use case "a logging module declares output". The
    data form's own test already declares `output`. The part takes
    bits read as UTF-8 text, writes one line and answers with an empty
    structure. These names are a contract for every saved program that
    prints, so they are the maintainer's to confirm.
  - **What the interface and the data form did not allow.** The data
    form has no sequencing form: two effects in written order need a
    kernel primitive. The two-line test uses a structure of two
    applications as the body, which the stand-in evaluates in entry
    order; that order is the stand-in's. A refutation is a flag on
    `evaluate`'s result and a list of values on `advance`'s; the
    interface gives no explanation and no claim, so the launcher says
    only that a refutation is recorded. The interface does not say
    that `waiting` returns the same handle for a cell each time; the
    launcher keys the answers it awaits by handle. It does not say
    what a primitive function's throw becomes; the launcher reports it
    as a fault. A capability of several parts reaches a module as one
    value only with a way to select a part, which is a kernel
    primitive's; a capability of one part is handed as that part's
    primitive function.
  - **One reading to confirm.** "A value that arrives later fills a
    cell" says a call on a capability the phase lacks stays residual.
    The launcher refuses a module that declares a capability outside
    the ceiling, before it runs, as "Only the launcher sets the
    ceiling" has it. The two meet if the
    residual rule is read as one for a call inside an evaluation and
    the refusal as one for a declaration.
  - **Where the launcher differs from the software system
    specification's model** (`next/models/specs/software-system.md`
    §10). Reading the saved program from
    the host (interaction 3, the player's read at c) is the terminal
    entry's: the launcher is host-neutral and is given parsed JSON.
    Loading returns the module function, not the main expression
    (interaction 4); the launcher builds the main expression as the
    application of that function. The output part is not bound in the
    program's scope (interaction 5): it is an argument of the module
    function, as "A module is a function of the capabilities it
    declares" (now "A module is a function of its capabilities, inputs
    and imports") and the data form have it, and the scope is empty. There
    is no configuration reader: the configuration arrives as a value,
    and the terminal entry sets it (the ceiling `output`, a budget from
    `--steps`) without recording which source supplied each value.
    Writing to the terminal (interactions 8 and 10) is the sink the
    terminal entry passes. The starter, the ceiling and the cell
    deliverer are parts of the one function `launch`, with their state
    local to one run.
- **2026-11-14 — One case restated after the kernel stream's first chunk.**
  The cell decision was reworded there: the launcher fills a cell with
  plain data, and the standard language's wrapper makes a failure an
  exception. The one case that changes by it, the rejected request of
  `src/test/async-futures.ts`, now says so, and moves from milestone 2
  to 4, since the exception needs the standard language. The filling
  alone is held by the launcher's tests.
  - **No row of the decision map moved for the launcher.** It realises
    "Startup, step by step" and "Only the launcher sets the ceiling"
    as far as milestone 2 needs, on a stand-in kernel. This stream
    moves a row when the unit realises the decision's whole statement
    and a case passes on the kernel, as the kernel stream left its
    rows at none for an interface that is declared and not built.
- **2026-11-13 — Q3 drafted: the scenarios.** Eleven files under
  `next/corpus/scenarios/` and an index, for the maintainer's ruling:
  one [scenario](#def-scenario) per scene, each with who acts and why,
  its steps as what the actor does and what the platform must find,
  its break-it case, what changes by ruling with the decision's title,
  its open questions, and its program's pinned lines against the steps.
  The ten programs hold 65 pinned lines and every one is covered by a
  step. The index states eight changes that touch several scenes, and
  one question the rulings leave open: whether an effect waits on a
  claim that a run can never decide. The scenes are eleven, not the ten
  this plan first said: rung 1's prover loop is a walkthrough with no
  program. 37 open questions are put, four of them shared by several
  scenes and asked first.
  - **Ruled 2026-11-15.** The maintainer ruled the index's shared
    question and four questions the scenes share. Nine of the 37 are
    settled by them; the next entry records the rulings.
  - **The index's shared question is gone.** Its section is replaced
    by "Rulings of 2026-11-15" and a table of the scenes' questions,
    in `next/corpus/scenarios/README.md`.
- **2026-11-15 — Q3: five shared questions ruled, and the corpus follows.**
  The maintainer ruled five questions in a design discussion of this
  stream's session. They are stated in
  `next/corpus/scenarios/README.md`, "Rulings of 2026-11-15", and the
  scenes state the ruled behaviour as fact.
  - **The rulings.** (1) A strength (assumed, sampled, undecided) never
    prevents an effect unless a policy or configuration requires it; a
    refuted claim still does. (2) A refused proposal never refutes its
    claim; the claim's outcome is what evaluation gives, and a policy
    "no proposal in the source is refused" exists, off by default.
    (3) A predicate on a parameter stays a claim with one meaning at
    every phase, `d + t` is refuted when checked, a failed check is not
    catchable, and the policy "every parameter claim is decided before
    the run begins" is on by default. (4) `validate` on a plan is the
    plan's own predicate called as an ordinary function, answering true
    or its explanation as a value. (5) Bool's equality laws are decided
    by enumeration, those of Int, Float and String assumed and named
    until proved, and the standard deriver, the shipped proposer the
    build runs, evaluates, samples and derives within configurable step
    budgets.
  - **The corpus.** 37 cases restated by an overlay
    (`next/tools/corpus.ts --apply`): 13 by ruling 3, 13 changing class
    from survives to changes; 7 by ruling 4, the text kept; 3 by ruling
    2, one changing class; 12 by ruling 5; 1 by ruling 1; 1 for a
    question renumbered in its scene. 14 cases change class in all.
    The check prints:
    `corpus: 1992 cases · pins 613 · tests 1379 · classed 1992 (survives 1604, changes 243, detail 145) · unclassed 0 — consistent`.
  - **The questions.** Of the scenes' 37, nine are settled and 28 stay
    open, each with a recommended option. Five are new with the
    rulings, all open.
  - **For the kernel stream.** A guard must treat an explanation as
    not true (rulings 3 and 4). The standard deriver is an extension
    the build runs; it asks nothing of the kernel but the trial
    evaluation the kernel already owes.
  - **Round 2, the same day.** The maintainer took six recommendations
    on per-scene questions, A to F, in the stream's session: the
    contract and `effects` clauses need no `use`; rung 1, scene 2
    calls its predicates and prints their explanations, rendered as
    the clause written with the value; a build reports every
    refutation that rests on no earlier one; `effects output` names
    the capability; a function's capabilities are a reported fact.
    Seven more of the 37 questions are settled, 21 stay open. Three
    pins of rung 1, scene 2 restate their new result, and one note
    follows a renumbered question.
  - **Round 3 and the planning scenes, the same day.** Nine more
    recommendations, G to O, ruled: a bound proof value is no claim;
    an obligation is named by its module and claim name, and the hash
    over the proposition's text goes; a hint is the refusing rule's or
    the deriver's explanation; a scripted proposer passes milestone 5;
    the benchmark is a separate case; rung 1, scene 5 answers a claim
    evaluation cannot decide, first with the derivation budget at zero
    and last by the deriver; the coercion claims are assumed and named;
    a true claim whose term uses an assumed law is decided when
    evaluation decides it; the deriver does not attempt an assumed
    law. Seven questions of the planning scenes are settled by
    `next/models/specs/planning.md`, as ruled at PR #202, each cited
    by section. Of the 37, 29 are settled and eight stay open; of the
    five new questions, four are settled and one is open. 28 corpus
    cases are restated by a third overlay, 18 of them changing class.
    The check prints:
    `corpus: 1992 cases · pins 613 · tests 1379 · classed 1992 (survives 1586, changes 260, detail 146) · unclassed 0 — consistent`.
  - **Followed, not yet landed.** The maintainer ruled that milestone 7
    requires `solve` to read a residual over its unknowns, and that the
    enumeration is not ported. Milestone 7 waits on the kernel stream
    for a way to implement general solvers, since that stream has
    reversed "A function may take an argument unevaluated" (now "No
    argument can be inspected"). This stream follows when the reversal lands in the inventory: the
    planning specification's §5 cites that decision as a need.
  - **Round 4, the last.** Nine more recommendations, P to X, ruled:
    the dimension predicates name the value, its dimension and the one
    expected; `import` brings bindings and `use` bindings and notation;
    nobody has to claim a grammar unambiguous; milestone 6 has a
    notation break-it; a proposal for a library's law goes into the
    project's proof store, and the default obligation list shows the
    project's own claims; the tools still list obligations that rest
    on no refuted value; one recorded model run passes milestone 7;
    milestone 7 passes on the one-model scene; a refused proposal on a
    decided claim is offered for nothing. With them every question of
    the eleven scenes is settled: the draft's 37 and five raised by the
    write-up, 42 in all, none open. The index's table becomes "The
    scenes' questions, as settled".
  - **The corpus at the close of the day.** Overlays restated 37 cases
    for the five rulings, 4 for round 2, 28 for round 3 and 82 for
    round 4, which also rewrote 67 notes that cited a scenario's open
    question; no note now does. Before the rulings the check printed
    `classed 1992 (survives 1618, changes 229, detail 145)`; now it
    prints:
    `corpus: 1992 cases · pins 613 · tests 1379 · classed 1992 (survives 1586, changes 260, detail 146) · unclassed 0 — consistent`.
- **2026-11-15 — Q7, part 2 landed: the launcher on the reference kernel.**
  `next/launch/launcher.ts` now takes a factory of `Kernel2`, the
  second version of the kernel's interface, and refuses a kernel that
  lacks the calls of it the launcher uses. It checks a record with
  `check2`, so a record of the first or the second version loads. Key
  slots are the kernel's: `load` makes the module and its keys, and
  `declares` lists the parameters after them. The configuration has a
  new field, `restoreAs`: the builder whose stored outcomes it accepts
  for the saved program. The launcher passes it to `load`, and without
  it the stored outcomes are not looked at. A kernel that refuses to
  load the record, as on a stored key that does not match, ends the run
  as refused before anything is evaluated. The `refuted` end carries
  `reasons`, the reason `reasonOf` gives for each refuted value the run
  reported, and `reason` joins them. The `waiting` end carries
  `unanswered`, the count of cells no capability will answer, and
  `unbound`, the names nothing binds, read with `symbolName`. The
  launcher's 22 tests run on `createKernel` of `next/kernel/create.ts`,
  and `next/launch/stand-in-kernel.for-tests.ts` is deleted: no test
  needs it. New tests cover a false claim, a claim refuted once its
  answer arrives, a name nothing binds, a run that waits on a cell and
  a name, a record of the second version with and without a builder
  named and with a wrong stored key, and the committed fixture run
  through the terminal entry in a child process.
  - **Milestone 2's command.** `npm run launch -- next/launch/fixtures/hello.json`
    prints `hello, world` and exits 0.
  - **The five gaps of part 1.** The explanation of a refutation is
    closed: the kernel gives `reasonOf`, and the launcher reports it.
    The other four stay open. The data form still has no sequencing
    form; the reference kernel evaluates a structure's entries in order,
    a choice that awaits the maintainer's ruling, and the two-line test
    rests on it. The interface still does not say that `waiting`
    returns the same handle for a cell each time; the reference kernel
    does, and the test of an answer that arrives later holds it. The
    launcher's keying by handle rests on that, and the contract does not
    state it.
    The interface still does not say what a throw from a primitive
    function's `run` becomes; the reference kernel lets it out of
    `evaluate` or `advance`, and the launcher reports a fault. A
    capability of several parts still needs a way to select a part, and
    the kernel's primitives are `claim`, `if` and `quote`; the launcher
    still hands only a capability of one part.
  - **What the outcome can carry for the rulings of 2026-11-15.** Ruling
    D of `next/corpus/scenarios/README.md` (a build reports every
    refutation that does not rest on an earlier one, and performs no
    effect after the first) needs a list of refutations, and `reasons`
    is one. The launcher stops at the first `evaluate` or `advance`
    that reports one. On the reference kernel a refuted structure
    entry stops the structure, so the effect after it is not performed,
    and a test holds that. Ruling 1 (a strength never prevents an
    effect unless a policy requires it) needs nothing of the launcher:
    it builds no policy.
  - **The decision map.** No row moved. Of this stream's decisions the
    launcher realises "Only the launcher sets the ceiling" in whole for
    a run of one saved program. It realises in part: "Startup, step by
    step" (one saved program, no phase, no first extensions); "A module
    is a function of the capabilities it declares" (now "A module is a
    function of its capabilities, inputs and imports") (capabilities
    only); "A value that arrives later fills a cell, and a failure
    fills it with an exception" (now "A late answer or its failure
    fills a cell as plain data") (the launcher's filling with plain
    data; a call on a capability the phase lacks is refused before the
    run, not left residual); "A stored outcome is restored with its builder's name"
    (the configuration names one builder or withholds restore); "A
    capability is a named set of effectful primitives" (one part
    only); and "The terminal and the browser ship output, timers and
    HTTP" (output, on the terminal). The orchestrating session decides
    whether any row moves.
  - **Left for later parts.** Inputs, imported modules, the first
    extensions, and configuration sources, each with the record of which
    source supplied a value. The terminal entry does not yet set
    `restoreAs`.
- **2026-11-15 — The corpus follows the kernel stream's K4 (values and descriptions).** PR #216
  (values and descriptions, solving ruled, titles made accurate)
  retitled seven decisions and added three rows to the decision map.
  - **The titles followed.** `npx tsx next/tools/corpus.ts
    --follow-renames` moved 84 cases, 87 citations: 54 of "No argument
    can be inspected", 16 of "An extension registers its own fields",
    7 of "A value's origin is a description", 6 of "A late answer or
    its failure fills a cell as plain data", 4 of "A composed function
    is parameters and a body". No case cited the former titles of "A
    solver reads the residual of its problem" or "A module is a
    function of its capabilities, inputs and imports".
  - **The 54 of the replaced decision, read one by one.** 53 rest only
    on an operand being evaluated when needed: `&&`, `||` and `!` in
    `tests/logical.alg`, `tests/logical-error-demo.alg` and the tests
    that run them. They cite "An expression is evaluated when its value
    is needed" in its place and keep their class: 47 survive, and 6
    change by "The standard language's handled failure is an
    exception". One changes by "No argument can be inspected": the
    D47 (the source channel) test of a primitive that receives each
    argument's expression becomes a read of the value's origin as a
    description, by code that holds the inspection right. None rests on the order in which
    a structure's entries are evaluated.
  - **The sweep.** 172 cases match laziness, short-circuit,
    unevaluated, quote, source-of, solve, attempt, describe or inspect.
    3 gain a citation and none is reclassed: "Describing a function
    requires authority" for the test of `summarizeValue` reading a
    function's parameters and the reflection test of private members;
    "An evaluation can be returned as data" for the test of a diverging
    proposal ended by its budget. No case cites "A function can be
    specialized with its parameters unknown" or "A solver reads the
    residual of its problem": the present search enumerates.
  - **The documents.** The titles now stand in the launcher's header,
    both model specifications and two scenarios. The planning
    specification's design B is the ruled one: each choice a parameter
    of the problem function, `specialize` gives the residual, the
    solver describes it and calls it with candidates, not built yet.
    Both specifications cite the kernel primitive `attempt` ("An
    evaluation can be returned as data") for the trial evaluation.
    The check prints:
    `corpus: 1992 cases · pins 613 · tests 1379 · classed 1992 (survives 1585, changes 261, detail 146) · unclassed 0 — consistent`.
  - **Added in review.** Six cases about origins are restated under "A
    value's origin is a description": an origin is read under the
    inspection right, and a run keeps none unless its configuration
    says so. None changes class. Three passages of the planning
    specification that the rulings made false are corrected: the
    completion search (§4) specializes and describes where it took the
    claim unevaluated; question 13 and §13 say the origin issue is
    ruled. Left as written, for the maintainer: §2's "a choice is an
    unknown, one of a stated set of options", since unknowns that carry
    facts wait for metadata fields.
- **2026-11-16 — The corpus follows the retitle of PR #220, and what the rulings of 2026-11-16 change here.**
  PR #220 (the acceptance stream's rulings recorded) retitled "An
  effect consumes only values whose claims are decided" to "A refuted
  value never reaches an effect"; `npx tsx next/tools/corpus.ts
  --follow-renames` moved 4 cases, and three scenarios cite the title
  now. The nine lines of B-197 (evidence against a ruled decision) are
  recorded in the inventory by that PR.
  - **The first notation is Allegretto**, ruled at PR #222 in
    `next/ext/allegretto/forms.md`, which replaces the proposal of PR
    #218 as the basis. An operator stands for exactly one primitive
    function. A block is order-free bindings and statements in written
    order. A statement is a link of the kernel primitive `then` (PR
    #221). A capability is declared by a header line and its part is
    read as an entry, `output.write("hello")`; there is no `print`.
  - **What that settles of PR #218's eleven questions**: the claim form,
    the bits of a text and a number, an unbound name, bindings and
    order, a module's parameters, printing, what a module yields, a
    body's statements and what an operator stands for. Division by zero
    is a refutation, where question 9 recommended a named failure.
  - **This stream's part**, by that document's section 5: a grammar for
    Allegretto made from the present base grammar, a reader of the
    engine's parse tree that does not use the present tree builder, and
    the emitter. Three things of PR #218's emitter go: the choice of a
    primitive by an operand's sort, self-application for recursion, and
    statements as a structure's entries.
  - **Milestone 3's cases.** Its programs become Allegretto texts
    written for the purpose; a present-surface case that needs types
    moves to milestone 4. The census of chunk Q5 (the first notation
    and the bootstrap) is redone on that rule once the reader exists.
- **2026-11-16 — Q5, part 2: the Allegretto grammar, reader and emitter.**
  Built against `next/ext/allegretto/forms.md` as ruled that day, on
  `origin/main` at `f832812`. The present tree is not changed.
  - **The grammar.** `next/bootstrap/allegretto-grammar.ts` edits the
    value `buildLeftRecursiveBaseGrammar` returns, which is new on every
    call and is the form the present tree's own grammar extension edits.
    It removes the productions and alternatives forms.md §5 names, adds
    the five with the engine's own constructors, and has `ladderLevels`
    rewrite the precedence levels. It checks that every production
    referred to exists and that no level stays left recursive. Built
    this way, a change in the present base grammar shows as an error.
    Building a grammar from scratch with the constructors would copy
    about 400 lines of productions and drift from the base. One change
    forms.md §5 does not list: `then` is unreserved, since §2 binds the
    kernel primitive to that name. The keywords `and` and `or` and the
    number `0b…` stay in the grammar, as §5 does not remove them; the
    reader refuses them, since §2 gives them no meaning. A text may not
    hold `{`, so `"a{x}"` is refused rather than read with a new
    meaning.
  - **The reader.** `next/bootstrap/reader.ts` reads the engine's parse
    tree, never through the present tree builder. Literals come from
    their digits in the text; every node keeps its place.
  - **The emitter.** `next/bootstrap/emit.ts`, and `npm run emit -- <file>
    [-o out.json]`. Each form, checked against the reference kernel on
    this base:

    | Form of forms.md §2 | Today |
    |---|---|
    | `"text"`, `42`, `0xFF`, `1.5`, `true`, `false` | emitted: a bits node |
    | `{a: e}`, `[e, f]` | emitted: a structure node, keyed by symbols or with no keys |
    | `x`, `x => e`, `f(a, b)`, `a \|> f` | emitted: the parameter or kernel node bound; a function node; an expression node |
    | `if c then a else b`, `&&`, `\|\|`, `!` | emitted: the kernel's `if` |
    | `claim(e)`, `then`, `attempt`, `describe`, `build` | emitted: the kernel primitive |
    | a block's statements | emitted: a chain of `then` |
    | `x <- e` | emitted: `((x) => then(x, r))(e)`, `r` the rest of the block |
    | `capability`, `input`, `import` | emitted: the module function's parameters and `declares` |
    | `x = e`, `f(x, y) => e`, `export` | waits on item 1, the block of bindings |
    | `==`, `!=`, `++`, `bits.*` | waits on item 2, the kernel's primitives on bits |
    | `p.a`, `p[i]`, `output.write` | waits on item 3, reading a structure |
    | `+`, `-`, `*`, `<`, `>`, `<=`, `>=`, prefix `-`, `int.*`, `float.*`, `text.*` | waits on item 4, the shipped primitives; `/`, `%`, `int.div`, `int.mod` and `text.int` on item 5 as well |
    | `` `name `` | waits on a way to put a symbol in an expression as data, which §4 does not list |

    `x <- e` was verified on the kernel: `e` happens once, after the
    statements before it, and every use of `x` reads its value; on a
    cell, nothing after it is performed until the cell is filled. A
    module yields the structure of its bindings, empty today. The tests
    give a text effects through inputs: `input see` and its kin, handed
    effectful primitives made through the kernel's interface. Three
    tests marked todo hold the texts that run once §4 is supplied:
    hello, world through `output.write`, a block of bindings, recursion.
  - **The census.** `npx tsx next/bootstrap/census.ts` over the 216
    cases of milestone 3: 171 read as Allegretto unchanged (31 pins,
    140 tests), 42 do not (all tests), 3 are host code. Of the 171, 21
    emit today; emitted is not yet passing, since a case's assertion is
    made by the present host. Of those that do not read: 21 use `when`
    and patterns, 8 a type annotation, 6 text interpolation, 2 `Y of x`,
    2 `0b…`, 2 an escape §2 does not list, 2 `and` or `or`, 1 is a text
    the present parser refuses too. Of the 171 that read, the waits:
    item 1 for 103, item 2 for 50, item 3 for 6, item 4 for 114, item 5
    for 17. The name most used and bound nowhere is `print`, in 36.
    A text that reads may still mean something else: `"a" + "b"` reads,
    and `+` stands for `int.add`. The census as the chunk's agent ran
    it left `next/corpus/cases.json` unchanged.
  - **The launcher, once a structure can be read.** Nothing changed but
    the end at the kernel's own limit with no budget set, which now says
    so. Once item 3 is built: step 4 of `next/launch/launcher.ts` hands
    a capability as a structure of its parts keyed by the symbols of
    their names, and drops the refusal of a capability of more than one
    part; its header says so; `next/launch/fixtures/hello.json` becomes
    the emitted record of `capability output` and
    `output.write("hello, world")`; the hand-built records of
    `next/launch/launcher.test.ts` read the part, and the record of two
    lines uses `then` in place of a structure's entries; the test that
    the fixture equals `encode(HELLO)` follows. The kernel stream's
    milestone 2 test in `next/kernel/kernel.test.ts` runs the fixture
    and needs no change of its own.
  - **Read narrowly where forms.md is silent**, each a question for the
    kernel stream: `then` unreserved; `and`, `or`, `0b…` refused; `{`
    refused in a text; a whole number above the signed range refused
    even under a prefix `-`; a hex number refused above the signed range
    too; a statement `a <- b` is always the binding, never `a < -b`; a
    header name bound again in the module's block is refused; `export`
    in an inner block is refused; the name of `x <- e` is not a binding
    of the module's structure; a module's value is its statements
    chained before the structure of its bindings; an inner block's last
    `x <- e` gives `e`'s value; a block with no statement is refused;
    the pipe's right side is any expression whose value is a function;
    a record with one key twice is written as it stands; the record is
    of the first version, with no key slots.
  - **The cases moved, in review.** By the fifth answer of the ruled
    forms document, a present-surface case that needs types belongs to
    milestone 4. The census names them (`npx tsx
    next/bootstrap/census.ts --moves`): a case with a text that does
    not read as Allegretto, 41; and a case whose texts read and show a
    meaning chosen by a type, 37: `print`, which renders by type, in
    36 (all 31 pins among them), an integer operator on a decimal
    fraction in 14, and on a text in 13. 78 cases moved from milestone
    3 to milestone 4: 31 pins and 47 tests. No class changed.
    Milestone 3 now holds 138 present cases, all tests: 134 read as
    Allegretto, 21 of them emitted today, 3 assert through host code,
    and one tests a text the present parser refuses. An operand that is
    a name is not judged, so a case that reads may still rest on a type
    the text does not show; such a case shows when its Allegretto text
    is run.
- **2026-11-16 — The emitter's test no longer fails when the kernel gains a primitive.**
  PR #224 (the kernel reads structures and works on bits) failed one
  test in CI, and the test was this stream's: in
  `next/bootstrap/emit.test.ts`, the check of what the emitter refuses
  as waiting held the kernel's list of primitives at six names, and
  that PR adds six. The same test would have failed again when the
  data form gains a node for the block of bindings and when
  `next/prims/` appears. A test of lane Q must not fail on a change
  that lane R alone can make. The test now passes in each case and
  turns to a todo that names what the emitter can stop refusing. It
  still fails if a kernel primitive the emitter writes is missing.

- **2026-11-16 — Q5, part 3: the emitter writes every form; the launcher runs an Allegretto program.**
  Built on `origin/main` at `d2500b5`, after the kernel stream's PRs
  #224 (the kernel reads structures and works on bits), #226 (the
  block of bindings) and #228 (the shipped primitives). The present
  tree is not changed.
  - **The forms, each written.** `next/bootstrap/emit.ts`, checked by
    `next/bootstrap/emit.test.ts` on the reference kernel:

    | Form of forms.md §2 | Written as |
    |---|---|
    | literals, `{a: e}`, `[e, f]` | a bits node; a structure node |
    | `` `name `` | the node `datum` |
    | a name a block binds | a symbol node the kernel looks up |
    | a parameter, a header line | its param node |
    | `x => e`, `f(a, b)`, `a \|> f` | a function node; an expression node |
    | `p.a`, `output.write`, `p[i]` | ``get(p, `a)``, `get(p, i)` |
    | `if`, `&&`, `\|\|`, `!`, `claim` | the kernel's `if` and `claim` |
    | `==`, `!=`, `++`, `bits.*` | `same`; `if(same(a, b), false, true)`; `join`; `join`, `length`, `slice` |
    | the integer operators, prefix `-`, the names of §3 | the shipped primitive, listed in `needs` with the hash `shippedByName` gives |
    | `x = e`, `f(x) => e` | an entry of the block's bindings |
    | `x <- e` | `block({x: e}, then(x, rest))` |
    | a block, the module | `block(bindings, chain of then)`; the module ends with the structure of what it yields |
    | `export` | the module yields the bindings marked, or all |

    Nothing waits on the forms. One thing waits on the kernel: entries
    evaluated when read, the open part of forms.md §4 item 3. The
    structure a module yields is built at the module's end, so the
    kernel evaluates every binding it holds there. The smallest text:
    `capability output` and `unused = output.write("x")` writes `x`
    after the module's statements, and `bad = 1 / 0`, needed by
    nothing, refutes the run. A binding left out by `export` is never
    evaluated. No test of this stream pins the present order.
  - **The record.** Every record is of the second version, with no key
    slots and no outcomes. A text needs the node `datum` as soon as it
    reads a key with `.`, which every text that prints does. One rule
    for every text keeps a text's record from changing version when the
    text gains a `.`, and `load` makes each record a module with its
    identity.
  - **The launcher.** Step 4 of `next/launch/launcher.ts` hands a
    capability as a structure of its parts keyed by the symbols of the
    part names; the refusal of a capability of more than one part is
    gone, and a test runs one of two parts. The terminal's entry
    supplies `shipped` of `next/prims/index.ts` as the target's
    primitives; a record that needs a hash the target lacks is still
    refused, naming it. `next/launch/fixtures/hello.json` is the record
    the emitter writes for `next/launch/fixtures/hello.alg`, and a test
    holds the two equal. The hand-built records of
    `next/launch/launcher.test.ts` read the part, and the record of two
    lines uses `then`. The kernel stream's two tests in
    `next/kernel/kernel.test.ts` that run the fixture through `launch`
    pass with no change to that file. `npm run allegretto -- <file.alg>
    [--steps <n>]` (`next/launch/allegretto.ts`) emits and launches in
    one step.
  - **The programs of milestone 3.** Thirteen texts under
    `next/bootstrap/fixtures/`, each with its lines as `// expect:`
    comments and its end as `// end:`: hello world; a function and its
    application; order-free bindings; `=` and `<-` side by side;
    factorial and a sum through `int.text`; two functions that call
    each other; a recursion over a structure with `get` and `count`; a
    claim that holds; a claim refuted after a line is printed, ending
    refuted; `7 / 0`, refuted with "division by zero"; the operators at
    each precedence level; a module open and one with exports, whose
    yielded keys (`// yields:`) are read through the kernel's
    interface. `next/bootstrap/fixtures.test.ts` runs every one through
    the emitter and the launcher. The three tests part 2 marked as
    waiting are ordinary tests, and the test "what waits, against the
    kernel on this base" ends with nothing owed.
  - **For the kernel stream: recursion depth.** A recursion of a few
    hundred calls ends at the kernel's own limit with no step budget
    set: the host's stack runs out. The smallest text: `capability
    output`, `loop(n) => if n == 0 then 0 else loop(n - 1)`,
    `output.write(int.text(loop(2000)))`. A sum to 400 completes; a sum
    to 450 does not. The fixtures stay below it.
  - **The census.** `npx tsx next/bootstrap/census.ts` over the 138
    cases of milestone 3: 3 host, 1 does not read, 134 read. Of the
    134, 108 emit; the 26 that do not each use a name nothing binds
    (`abs` in 4, `double`, `math` and `max` in 3 each), and none uses a
    form the emitter refuses. Its `--moves` list is empty: no case newly
    shows that it needs types. `next/corpus/cases.json` is unchanged.
  - **Read narrowly where forms.md is silent**, each a question for the
    kernel stream: a name a block binds is the symbol of the name as
    written; `get` and `count` are names Allegretto binds, and `same`,
    `join`, `length`, `slice`, `block` and `if` are not, since each has
    a form; where `e` of `x <- e` reads an enclosing block's `x`, it is
    handed in as an argument, `((t) => block({x: t}, then(x, r)))(e)`,
    so it does not read itself; a binding written with `=` cannot read
    a name bound by `<-`, since the group is bound before any
    statement, and the name is refused as unbound; a yielded entry's
    value is its name, looked up; `needs` is in name order; prefix `-`
    on a number is `int.neg` applied to it; a capability's parts are
    keyed by `kernel.symbol` of the part names. Part 2's readings stand
    where this part does not change them.
- **2026-11-16 — Q6, part 2: Allegretto programs in the corpus; the harness counts the cases they realise.**
  Built on `origin/main` at `f55148c`. The present tree is not changed.
  - **The rulings**, by the maintainer that day. An Allegretto program
    may hand a text of the standard language to the parser engine: "Yes
    an Allegretto test can hand a standard language text to the parser
    engine." The engine is to be written in Allegretto by the kernel
    stream, and does not exist yet. The tests and other code of
    milestones 4 to 7 are written in "the Allegretto language", the
    first notation; milestone 3's programs already are. The programs
    live under `next/corpus/allegretto/`, by milestone: the location
    "works". So a case of `next/corpus/cases.json` is shown on the new
    kernel by an Allegretto program that exercises what the case tests
    and passes, not by running the present program there. The corpus
    stays the list of what must be shown.
  - **The convention**, in `next/corpus/allegretto/README.md`. A program
    is a `.alg` file in a directory `m<milestone>` directly under
    `next/corpus/allegretto/`, and its milestone is its directory's. It
    names each case it shows in a line `// realises: <case id>`, the id
    exactly as in the corpus. Its `// expect:`, `// end:` and
    `// yields:` lines are read as part 3 of Q5 read them. A case is
    realised when a program that names it passes: its printed lines and
    its end are the expected ones. A program names a case only if it
    shows what the case asserts, by the case's text or a faithful
    restatement, printing the value the present test compares, with the
    present expectation as its `// expect:` lines. For a case of class
    `changes` the expectation is the case's `becomes`.
  - **The move.** The thirteen programs moved from
    `next/bootstrap/fixtures/` to `next/corpus/allegretto/m3/` with
    `git mv`, and their test to `next/corpus/allegretto.test.ts`.
    `runProgram` of `next/corpus/allegretto.ts` reads a program's
    lines, emits it, launches it on the reference kernel and compares.
    The test and the harness both use it.
  - **The harness.** `npm run harness:next`, the mode `--next` of
    `next/corpus/harness.ts`, runs every program under
    `next/corpus/allegretto/` in process. It reports per milestone the
    programs passing and failing and, of the cases due there, those
    realised, those named only by a failing program and those not yet
    named. It exits 1 on a failing program, a `// realises:` line that
    names no case, one case named twice by a program, and a program
    outside a directory `m<milestone>`. A case named from another
    milestone's directory is reported and does not fail. A test in
    `next/corpus/harness.test.ts` runs the mode over the committed
    programs. It prints, for milestones 3 and 4 and in summary:
    `milestone 3: programs 21 (passing 21, failing 0) · cases due 138 · realised 45, named only by a failing program 0, not yet named 93 · up to 3: 45 of 175 realised`;
    `milestone 4: programs 0 (passing 0, failing 0) · cases due 643 · realised 0, named only by a failing program 0, not yet named 643 · up to 4: 45 of 818 realised`;
    `harness: new tree · programs 21 run (passing 21, failing 0) · cases due 1846 (realised 45, named only by a failing program 0, not yet named 1801) · realises lines 45 (no case 0, twice in one program 0, of another milestone's directory 0, due at no milestone 0) — no failing program`.
  - **The first batch**, from the 58 cases of milestone 3 in
    `src/test/base.ts`. 45 are realised. Eight new programs realise 43:
    `arithmetic.alg` 14, `calls.alg` 9, `comparisons.alg` 7,
    `conditionals.alg` 5, `bindings.alg` 4, `recursion.alg` 2,
    `block-body.alg` 1 and `modulo-by-zero.alg` 1. Two of the thirteen
    older programs gain a line: `factorial.alg` realises
    `test:base:factorial` with the present definition renamed, and
    `divide-by-zero.alg` realises `test:base:division by zero`, with
    `7 / 0` for the present `1 / 0`. The other eleven show no present
    case. Where present texts bind one name again, each is an inner
    block `name <-` of the present text unchanged. The present tree
    gives a comparison as 1 or 0; the programs print the truth value
    as "true" or "false". `int.mod` refuses with "division by zero", as
    the present test expects.
  - **The 13 left**, by kind:
    - a name a test's host extension supplied, 8: the `abs`, `max` and
      `min` of `mathExtension` in 7, and the `pi` and `tau` of two
      `Extension` values in 1. Two of the 8 are of class `changes`. The
      `becomes` of each is a conflict between two definitions of one
      name, and a text alone holds only one of them;
    - a host API of the present tree, 3: the three "persistent context"
      tests hand one `evalCtx` from one evaluation to the next, as the
      REPL does;
    - a refusal of a text, 2: "parse error on invalid syntax", whose
      text `+ +` no reader takes, and "extension: not available without
      being provided", where `abs(5)` must fail. The emitter refuses a
      name nothing binds before anything runs, so no program that holds
      either text passes. Both wait for a program that hands the text
      to the parser engine and reads its refusal as a value.
  - **What a text alone cannot realise**, the calibration for the
    chunks that realise the rest. A test that evaluates one closed text
    and compares its value is realised by that text: all 45 such tests
    of `src/test/base.ts` were, changed only by the printing and, where
    two texts bind one name, by an inner block. A text
    alone cannot realise a test whose assertion is made in its host
    code: the names it hands in, the context it carries between
    evaluations, or the refusal it expects. The first needs an `input`
    or an `import` the launcher supplies, which it refuses today. The
    second needs a host that runs one kernel over several texts. The
    third needs the parser engine.
  - **Cases that look misplaced**: none misclassed. The milestone of 12
    is in question: the three "persistent context" tests rest on "One
    kernel serves many invocations" and the REPL, and the nine
    "extension:" tests on extensions, which the launcher does not load
    before a later part. Neither is a program of the first notation
    running. `next/corpus/cases.json` is unchanged.
- **2026-11-16 — Q6, part 3: the rest of milestone 3's present cases, realised or left with a reason.**
  Built on `origin/main` at `d0b7955`. The present tree is not changed.
  `next/corpus/cases.json` is unchanged.
  - **The counts.** Of the 80 cases of milestone 3 outside
    `src/test/base.ts`, 49 are realised and 31 are left. The kinds of a
    case left: (a) it needs a type or another part of the standard
    language; (b) a name a test's host extension or another module
    supplied; (c) a host API of the present tree; (d) an expected
    refusal of a text; (e) something else.

    | Module | Realised | (a) | (b) | (c) | (d) | (e) |
    |---|---|---|---|---|---|---|
    | `src/test/grammar2-language.ts` | 19 | 1 | 0 | 0 | 0 | 1 |
    | `src/test/modules.ts` | 0 | 0 | 0 | 14 | 0 | 0 |
    | `src/test/types-core.ts` | 10 | 3 | 0 | 0 | 0 | 0 |
    | `src/test/language.ts` | 9 | 0 | 0 | 2 | 0 | 0 |
    | `src/test/types-battery.ts` | 3 | 0 | 0 | 2 | 0 | 1 |
    | `src/test/grammar-legacy.ts` | 4 | 0 | 1 | 0 | 0 | 0 |
    | `src/boundary-tests.ts` | 0 | 0 | 1 | 2 | 0 | 0 |
    | `src/test/refinements.ts` | 2 | 0 | 0 | 0 | 0 | 0 |
    | `src/test/types-construction.ts` | 2 | 0 | 0 | 0 | 0 | 0 |
    | `src/test/equality-laws.ts` | 0 | 0 | 1 | 0 | 0 | 0 |
    | `src/test/evaluator.ts` | 0 | 1 | 0 | 0 | 0 | 0 |
    | `src/test/pcp.ts` | 0 | 0 | 0 | 1 | 0 | 0 |
    | Total | 49 | 5 | 3 | 21 | 0 | 2 |

  - **The programs.** Six are new under `next/corpus/allegretto/m3/`:
    `multiline.alg` 9, `logical.alg` 11, `logical-demo.alg` 1,
    `pipe.alg` 3, `dot-access.alg` 3 and `plain-text.alg` 1. Eight
    older programs name 21 more cases of their topic:
    `arithmetic.alg` 6, `bindings.alg` 3, `calls.alg` 3,
    `comparisons.alg` 2, `conditionals.alg` 4, `block-body.alg` 1,
    `factorial.alg` 1 and `recursion.alg` 1. Where a present text is
    the text a program already held, the program names the case
    beside the older one. `logical-demo.alg` restates the present
    `tests/logical.alg` line by line. `dot-access.alg` binds the
    structures that the present tests hand in through a host
    `Extension`.
  - **The harness's line for milestone 3:**
    `milestone 3: programs 27 (passing 27, failing 0) · cases due 138 · realised 94, named only by a failing program 0, not yet named 44 · up to 3: 94 of 175 realised`.
  - **The cases of kind (a)**, candidates for milestone 4:
    - `test:grammar2-language:grammar2/std: types.alg runs end-to-end`:
      `tests/types.alg` joins texts with `+` and prints `1.5 + 2.5` as
      `4`, a number printed by its type;
    - `test:types-core:type system: formatValue shows string without quotes for typed string`:
      the present printer `formatValue` chooses the rendering by the
      value's `String` type;
    - `test:types-core:type system: formatValue shows int for typed int`:
      the same, by the `Int` type;
    - `test:types-core:type system: basics.alg works in typed mode`:
      the assertion is that the text evaluates under the standard
      language's type system;
    - the case of B-172 (the partial-evaluation rules as implemented
      against the spine),
      `test:evaluator:B-172 C3 evaluator: Rule 2 — a when inside an unfolded callee chain stays bounded (RR9, option C)`:
      the text is `when` arms with `Int` annotations, and the bound is
      the present evaluator's call count.
  - **The other cases left**, by kind:
    - (b), 3: `hybrid parser: dot access with function call` of
      `src/test/grammar-legacy.ts` calls a doubling host primitive the
      test's `Extension` supplies, and no shipped primitive doubles;
      `import satisfied by an extension (C2.3b)` of
      `src/boundary-tests.ts` reads `cfg` from an `Extension`, and the
      launcher supplies no input; `D47 chunk 2: explain` of
      `src/test/equality-laws.ts` calls the library function `explain`,
      which reads origins;
    - (c), 21: the 14 cases of `src/test/modules.ts` assert through
      `ModuleLoader`, and two of them also through `exportedSymbols`,
      `symbolFromWire` and `libExtensions`; the launcher supplies no
      imported module yet, so no program can restate them. The
      `reactive:` cases of `src/test/language.ts` read the host registry
      and call `applyPhase`. `UntypedFunction` and
      `compile: report lists unresolved imports` of `src/test/types-battery.ts` read
      `getTypeName` and the `compilationReport`. `REPL persistence` and
      `fqn symbols (C5.1)` of `src/boundary-tests.ts` hand an
      `evalCtx` on and call `registerScopeSymbol`. `Phase A: summarizeValue` of `src/test/pcp.ts` calls `summarizeValue`;
    - (e), 2: `grammar2/base: if-then-else selects branch` is
      `if 1 then 42 else 0`, and the kernel's conditional refutes a
      64-bit 1 with "a condition that is neither true nor false", as
      the forms rule; `partial eval: eval_if with unresolved condition propagates type from matching branches`
      asserts only that a
      function value is not null, which no program can print.
  - **Added in review.** The five cases of kind (a) moved from
    milestone 3 to milestone 4 in `next/corpus/cases.json`; no class
    changed. Milestone 3 then holds 133 present cases, 94 realised and
    39 not yet named: 13 of `src/test/base.ts`, and the 26 of kinds
    (b), (c) and (e) above. `yieldedKeys` in `next/corpus/allegretto.ts`
    handed every module one capability; it now hands a module what its
    header declares, so a module with no capability can state
    `// yields:`. Open for the maintainer: `if 1 then 42 else 0` is 42
    in the present tree and a refutation on the new kernel, and no
    ruled decision's title says which, so the case is neither realised
    nor reclassed.
- **2026-11-16 — Two tests follow a structure's entries being evaluated when read.**
  PR #229 (a structure's entries are evaluated when read) could not
  merge: tests of this stream failed on it. It named six, all in
  `next/launch/launcher.test.ts`; four of them had already been
  rewritten with `then` at part 3 of chunk Q5 (the first notation and
  the bootstrap). Two failed on that PR merged with main. The record of
  a run that waits on a cell and on a name still wrote its two
  statements as a structure's entries; it is a link of `then` now. One
  test of `next/bootstrap/emit.test.ts` took a yielded binding's value
  from `entriesOf`, where an entry nothing has read is still an
  expression; it reads the entry through the kernel's `get` now. Both
  pass on the kernel of main and on the kernel of that PR. Checked on
  that PR merged with main and with these two changes: 262 tests pass,
  the 27 programs of the corpus pass, and the speed tests of chunk Q8
  (the speed tests of milestone 3) pass. No statement of this stream is
  written as a structure's entry any more. A module that yields no
  longer evaluates every binding it holds once that PR merges, which
  closes the first finding of part 3 of chunk Q5.
- **2026-11-16 — Q8, part 1: the speed tests of milestone 3, measured.**
  Built on `origin/main` at `9aa0c78`. The present tree is not changed.
  The kernel, the shipped primitives, the emitter and the launcher are
  not changed.
  - **What runs.** Two Allegretto programs under `next/corpus/speed/`.
    `parser.alg` is a general parser engine: it takes a grammar as data,
    a parsing expression grammar of literal, sequence, choice,
    repetition and rule reference, and a text, and answers a parse tree
    or the farthest place it failed. Its driver parses arithmetic with
    `+ - * /`, parentheses and spaces, and prints the tree's value and
    node count. `typed.alg` builds typed values `{type, value}`; a type
    is a structure of a name and methods, `plus` and `times` read the
    method from the left operand's type, and the method claims the right
    operand's type. It runs a typed sum of squares over a counted loop, a
    typed fold that builds a text, and the same sum split in halves.
    `next/corpus/speed/speed.test.ts` runs both at their pinned size in
    `npm run test:next`. Their twins under `next/corpus/speed/present/`
    run the same algorithms in the present tree's base language; a
    comment at the top of each says what differs. The native baselines
    are the present tree's engine `src/grammar2/` on the same grammar
    (`present/parser-native.ts`) and its standard language on the same
    typed loop (`present/typed-native.alg`).
  - **How it was measured.** `npm run bench:next`
    (`next/corpus/speed/bench.ts`), one run of 8 minutes, on an Intel
    Xeon at 2.10 GHz with 4 cores and 16 GiB, Linux 6.18, node 22.22.0,
    at commit `06832a5` with the probes of the commit that adds this
    entry. Each time is the median of five runs after a warm-up, in
    process. The new kernel's time is the launch: kernel creation,
    loading the record, evaluation, with no step budget. The emit column
    is the bootstrap's emit of the text, which is not the kernel's. The
    present tree's time is `evalSource` in process: its parser reads the
    program text, then it is evaluated; start-up is left out. The file
    runner from start to exit takes 369 ms in the base language and
    330 ms in the standard language on the size-10 typed programs. A
    size whose warm-up passes 10 s is run once and ends that
    implementation's series. Times in ms.
  - **Test 1, the parser.** Size: copies of `12 * (3 + 4) - 10 / 2`
    joined by ` + `; 32 terms are 767 characters.

    | Terms | New steps | New ms | µs per step | Emit ms | Present ms | Native ms | New / present | New / native |
    |---|---|---|---|---|---|---|---|---|
    | 1 | 10,412 | 110 | 10.6 | 84.0 | 85.7 | 0.06 | 1.3 | 1,812 |
    | 2 | 20,741 | 234 | 11.3 | 22.2 | 97.8 | 0.09 | 2.4 | 2,707 |
    | 4 | 41,399 | 543 | 13.1 | 21.9 | 142 | 0.17 | 3.8 | 3,156 |
    | 8 | 82,715 | 1,330 | 16.1 | 27.8 | 266 | 0.31 | 5.0 | 4,295 |
    | 16 | 165,347 | 3,827 | 23.1 | 24.6 | 507 | 0.59 | 7.5 | 6,440 |
    | 32 | 330,611 | 12,065, one run | 36.5 | 26.7 | 994 | 1.15 | 12.1 | 10,468 |
    | 64 | not run | | | | 1,927 | 2.89 | | |
    | 128 | not run | | | | 3,642 | 10.1 | | |
    | 256 | not run | | | | stack overflow at 4,971 | 11.3 | | |

  - **Test 2a, the typed loop and fold.** Size: n for both the sum of
    squares and the text of n letters.

    | n | New steps | New ms | µs per step | Emit ms | Present ms | Native ms | New / present | New / native |
    |---|---|---|---|---|---|---|---|---|
    | 1 | 156 | 3.48 | 22.3 | 4.75 | 6.91 | 5.27 | 0.5 | 0.7 |
    | 4 | 351 | 4.21 | 12.0 | 5.01 | 14.8 | 9.33 | 0.3 | 0.5 |
    | 16 | 1,131 | 9.20 | 8.1 | 7.71 | 10.5 | 8.89 | 0.9 | 1.0 |
    | 32 | 2,172 | 31.5 | 14.5 | 9.18 | 13.8 | 6.79 | 2.3 | 4.6 |
    | 64 | 4,251 | 65.5 | 15.4 | 5.15 | 19.7 | 11.1 | 3.3 | 5.9 |
    | 128 | kernel limit at 3,725 steps | 81.3 | | 8.38 | 30.8 | 13.0 | | |
    | 256 | not run | | | | 53.7 | 24.1 | | |
    | 512 | not run | | | | 94.4 | stack overflow | | |
    | 1024 | not run | | | | stack overflow | not run | | |

    Sizes 2 and 8 are in the bench's output and left out here.
  - **Test 2b, the typed sum split in halves.** Size: n; the recursion
    is as deep as the logarithm of n.

    | n | New steps | New ms | µs per step | Emit ms | Present ms | Native ms | New / present | New / native |
    |---|---|---|---|---|---|---|---|---|
    | 1 | 156 | 5.88 | 37.7 | 6.73 | 10.1 | 5.29 | 0.6 | 1.1 |
    | 16 | 831 | 7.62 | 9.2 | 6.70 | 9.50 | 5.03 | 0.8 | 1.5 |
    | 256 | 11,631 | 78.2 | 6.7 | 6.97 | 33.4 | 16.5 | 2.3 | 4.7 |
    | 1,024 | 46,191 | 351 | 7.6 | 5.35 | 125 | 51.3 | 2.8 | 6.8 |
    | 4,096 | 184,431 | 1,548 | 8.4 | 12.7 | 391 | 143 | 4.0 | 10.8 |
    | 16,384 | 737,391 | 6,780 | 9.2 | 6.04 | 1,870 | 549 | 3.6 | 12.4 |
    | 65,536 | 2,949,231 | 30,360, one run | 10.3 | 6.58 | 6,930 | 2,217 | 4.4 | 13.7 |
    | 262,144 | not run | | | | 27,427, one run | 9,278 | | |

  - **The largest size each completes, and what stopped it.**

    | Test | New kernel | Present, same algorithm | Present, native |
    |---|---|---|---|
    | Parser | 32 terms; then time, 12.1 s at 32 | 128; the host stack at 256 | 256, every size run |
    | Typed loop | 64; the kernel's own limit at 128 | 512; the host stack at 1024 | 256; the host stack at 512 |
    | Typed halving | 65,536; then time, 30.4 s | 65,536; then time, 27.4 s at 262,144 | 262,144, every size run |

  - **Growth.** The exponent k of time ~ size^k, fitted over the runs of
    50 ms or more. The new kernel's steps grow linearly in all three
    tests (k 1.00 for the parser, 0.92 for halving). Its time does not:
    the parser's k is 1.35 overall and 1.66 between 16 and 32 terms; the
    typed loop's is 1.78 between 16 and 32; halving's is 1.07. The
    present twin's is 0.82 for the parser, 0.81 for the loop and 0.99
    for halving; the native baselines' 0.95 for halving and too few
    points above 50 ms elsewhere. So on the new kernel the time of one
    step grows with size: from 10.6 to 36.5 µs in the parser, from 8.1
    to 15.4 µs in the loop, and from 6.0 to 10.3 µs in halving.
  - **The recursion ceiling.** The largest n that completes, by doubling
    then halving, one run each:

    | Program | New kernel | Present, same algorithm |
    |---|---|---|
    | `sum(n) => if n == 0 then 0 else n + sum(n - 1)`, a fresh process per run | 422 | 222 |
    | the same, in the bench's process | 511 | 546 |
    | the parser on `n` nested parentheses around `7` | 41 | 30 |
    | the typed sum of squares alone | 384 | 635 |
    | the typed fold of letters alone | 385 | 636 |

    What hits the limit first in the parser is the nesting of
    parentheses, at 41 levels. Read from the grammar, not measured: each
    level holds a `sum`, a `product` and a `factor` open at once, each a
    rule reference, a sequence and a choice. The flat input reaches no
    stack limit up to 32 terms; there the repetition recurses once per
    term. In the typed programs it is the counted loop itself, one call
    per step. The new kernel ends at its own limit in every case, as a
    run ended `limit` with no budget set, and never faulted. The ceiling
    of one program differs between runs: the typed loop and fold of
    size 256 completed in one bench run and reached the limit at 128 in
    the run recorded here, and the same `sum(n)` reaches 422 in a fresh
    process and 511 in a warm one.
  - **Where the new kernel's time goes**, from probes that the
    interface allows, each the median of five runs:
    - the time of one step stays flat with recursion depth alone: 6.6 to
      8.8 µs for `n + sum(n - 1)` from n 50 to 350;
    - it grows with depth when the recursive call is an argument of a
      composed function: `pass(n, sum(n - 1))`, with
      `pass(a, b) => a + b`, takes 13.8 µs per step at n 50 and 49.8 at
      350. With a claim on that argument, `check(n, sum(n - 1))`, it
      takes 24.8 and 131.2. The parser and the typed loop recurse this
      way;
    - slicing one character off a text costs time in proportion to the
      whole text: 0.04 to 0.07 ms per call up to 1,000 characters, 1.33
      ms at 10,000 and 16.9 ms at 100,000. The parser's texts stay under
      800 characters, where this is not seen;
    - `==` on two equal texts grows with the square of their length:
      5.07 ms at 100 characters, 157 at 800 and 850 at 1,600;
    - `++` grows linearly: 0.79 ms for 1,000 characters, 93.0 ms for
      100,000;
    - a structure written in the text costs at load, not per call: 10,000
      entries take 132 ms with 6 calls and 140 with 60. A tree the
      program built costs nothing measurable per call when handed on.
  - **Not measured, and why.**
    - The parser's flat ceiling on the new kernel: time ran out first.
      One probe run of 64 terms completed in 44 s.
    - Memory: the interface reports none, and the bench reads none.
    - A larger host stack (`node --stack-size`): it changes the host,
      not the kernel, and would move the ceiling.
    - The present tree's steps: its evaluator counts differently, and
      no column compares them.
    - The native parser's node count: the engine's tree has other nodes,
      so its count is printed and not compared.
    - Garbage collection, other machines and other node versions.
  - **Findings for the kernel stream**, each with the smallest program
    that shows it:
    - The kernel's own limit is not a step budget and is not the same
      from run to run. `capability output`,
      `sum(n) => if n == 0 then 0 else n + sum(n - 1)`,
      `output.write(int.text(sum(423)))` ends at the limit in a fresh
      process, where 422 completes; in a process that has run other
      programs, 511 completes. "Limits are step budgets" calls a budget
      of steps deterministic.
    - The time of a step grows with the depth of nested arguments.
      `capability output`, `pass(a, b) => a + b`,
      `sum(n) => if n == 0 then 0 else pass(n, sum(n - 1))`,
      `output.write(int.text(sum(350)))` takes 49.8 µs per step, and
      13.8 at `sum(50)`. Read in `next/kernel/kernel.ts`, not measured:
      `rest` writes each primitive that runs into every open collector,
      and each argument evaluated when needed and each claim opens one.
    - `==` on two texts is quadratic in their length. `capability output`,
      `t = "<1,600 x>"`, `u = "<1,600 x>"`,
      `output.write(if t == u then "same" else "differ")` takes 850 ms
      in 7 steps. Read in the source: `same` builds the second value's
      list of bits once for each bit.
    - `bits.slice` costs time in the length of the whole value. The same
      header, `t = "<100,000 x>"` and one `bits.slice(t, 0, 8)` per call
      take 16.9 ms a call. Read in the source: it expands the value to a
      list of bits before it takes the part.
  - **A finding for this stream.** A program that binds the name `int`
    hides `int.text`: `capability output`, `int(n) => n`,
    `output.write(int.text(1))` is refuted with "only a structure has
    entries to read". `typed.alg` names its constructors `anInt` and
    `aText` for this reason. The emitter reads a dotted name as an entry
    of what the name is bound to, and forms.md does not say whether a
    program may bind the first part of a shipped primitive's name.
  - **A finding about the present tree**, for the comparison harness and
    not for a change. In its base language, inside a function,
    `r.at == bits_length(s)` answers false where both are 40;
    `present/parser.alg` tests the end of the text with `<`. And `true`
    is not bound there: a structure that holds it stays a residual that
    `print` does not print, so the twin's results hold 1 and 0.
  - **The oracle.** `npm run bench:next` is added to the oracle list of
    this plan's header; `npm run lint:streams` accepts it. It gates
    nothing and runs in no suite or CI step.
  - **Measured again in review, on the kernel after PR #229** (a
    structure's entries are evaluated when read), which merged after
    the run above: `npm run bench:next` on this branch merged with
    main at `57b6612`, the same machine. The new kernel is faster on
    every test and the findings stand.

    | Test, size | New kernel before | New kernel after | Present twin | After / twin | After / native |
    |---|---|---|---|---|---|
    | parser, 1 term | 112 ms | 94.7 ms | 68.7 ms | 1.4x | 1,607x |
    | parser, 16 terms | 3,915 ms | 1,848 ms | 528 ms | 3.5x | 2,361x |
    | parser, 32 terms | 11,946 ms | 4,714 ms | 1,047 ms | 4.5x | 2,719x |
    | parser, 64 terms | not run | 14,823 ms | 2,057 ms | 7.2x | 5,146x |
    | typed loop, 256 | 887 ms | 575 ms | 51.1 ms | 11.3x | 22.7x |
    | typed halving, 1,024 | 337 ms | 303 ms | 130 ms | 2.3x | 6.6x |
    | typed halving, 65,536 | 28,415 ms | 23,466 ms | 7,692 ms | 3.1x | 8.6x |

    The parser takes about nine steps in a hundred fewer (300,856 at 32
    terms, where it took 330,611), and its time per step at 32 terms
    is 15.7 microseconds, where it was 36.1. Time still grows faster
    than steps: the fitted exponent is 1.22 for the parser and 1.88
    for the typed loop. The ceilings: a plain sum completes to 394 in a
    fresh process and the parser to 41 nested parentheses, as before;
    the typed loop still reaches the kernel's limit at 512. A step still
    slows with nested arguments (16.0 microseconds at n 50, 54.8 at
    n 350), `==` on two texts of 1,600 characters still takes 771 ms,
    and one slice of a text of 100,000 characters 17.3 ms.
  - **Ruled by the maintainer on 2026-11-17**, in review of this
    record.
    - **What signs milestone 3.** "I agree with option (b)": the shape
      is fixed first, then the milestone is signed. Time grows in step
      with the work on both tests, the bench is run again, and the
      milestone is signed on that run. No ratio against the present
      tree is set.
    - **What stops a deep recursion.** "I agree with option (a)": no
      depth limit. A recursion's depth is bounded by the step budget
      and by memory only, as "Limits are step budgets" has it; the
      kernel's own limit at the host's stack goes. This is a
      requirement of the kernel stream, and the way to meet it is
      theirs.
    - **The other three findings** go to the kernel stream as its work
      list: "Yes to question 3". They are the step that slows as
      arguments nest, `==` on two texts, and `bits.slice`.
    - **A number as a condition.** "I agree with option (a)": the
      kernel's behaviour stands. A condition is a truth value, and
      `if 1 then 42 else 0` is a refutation. The corpus case
      `grammar2/base: if-then-else selects branch` changes once a
      decision's text says so; line 11 of B-197 (evidence against a
      ruled decision) asks for it.
- **2026-11-17 — The condition case changes, as ruled.**
  The maintainer ruled on 2026-11-17 that a condition is a truth value.
  The case `grammar2/base: if-then-else selects branch` is
  `if 1 then 42 else 0`, which the present tree answers with 42. It is
  class changes now, by "The kernel's primitives are pure and few": the
  new result is the refutation "a condition that is neither true nor
  false". The decision's text does not carry the sentence yet; line 11
  of B-197 (evidence against a ruled decision) asks the review session
  for it, and the case's note says so. The program
  `next/corpus/allegretto/m3/condition-not-truth.alg` realises it: it
  prints 42 for `if true then 42 else 0` and ends refuted on
  `if 1 then 42 else 0`. Measured:
  `corpus: 1992 cases · pins 613 · tests 1379 · classed 1992 (survives 1584, changes 262, detail 146) · unclassed 0 — consistent`;
  `milestone 3: programs 28 (passing 28, failing 0) · cases due 133 · realised 95, named only by a failing program 0, not yet named 38 · up to 3: 95 of 170 realised`.
- **2026-11-17 — Q7, part 3: the launcher supplies inputs.**
  The ruling of PR #238 on inputs left open how an input's name is found
  in a configuration, "taken when a case appears". This part is that
  case. The launcher (`next/launch/launcher.ts`) hands each parameter of
  role `input` the plain data the configuration supplies for it at the
  start (`inputs`), or else a fresh cell. A later phase (`later`, a list
  of the same records) is applied when the kernel waits and no
  capability's answer is due: its inputs fill their cells and `advance`
  runs under the same step budget. Phases are applied in order, one at
  a time, and none is applied once nothing waits. The `waiting` end
  names the inputs still waited on (`inputs`), and their cells are not
  counted in `unanswered`. The outcome counts the lines printed before
  each later phase (`linesBeforePhase`). A module that imports is still
  refused. `readLiteral` (`next/bootstrap/literal.ts`) reads one
  Allegretto literal as plain data, with the emitter's own encoding of
  each literal (`literalBits` of `next/bootstrap/emit.ts`).
  `npm run allegretto` takes `--input name=<literal>` and
  `--later name=<literal>`. The corpus convention
  (`next/corpus/allegretto/README.md`) gains `// input:`, `// later:`
  and `// end: waiting:` lines. The test that asserted an input is
  refused is replaced by twelve tests of the new behaviour.
  - **Read before this part.** PR #237: a notation a text uses can only
    add. No scene of rung 2 relies on a library replacing a form: the
    grammar block of every present library only adds forms, the units
    library included, so the scenarios stand. PR #238: it retitles no
    decision and rules inputs, which this part builds. PR #240: it adds
    the sentence on conditions to "The kernel's primitives are pure and
    few", which the condition case already cites; the case's note now
    says so. PR #242, the second adversarial review: nothing in it is
    ruled yet. Its first cluster says `scope` and `bind` are to leave
    the kernel's interface; the launcher calls `scope` once and follows
    when the kernel stream changes the interface.
  - **The five answers to the open question, ratified by the maintainer
    on 2026-11-17**: "I agree with all recommendations".
    1. An input is found in a configuration by its declared name. A
       module's input names are unique, and distinct from its
       capabilities' names: the emitter refuses a name bound twice.
    2. An input the module does not declare, or one supplied more than
       once, is refused before anything is evaluated, naming the input.
    3. A later phase runs in the same launch, on the same kernel, with
       the same capabilities and under one step budget. It supplies
       inputs and nothing else. The maintainer's note: "phases are not
       formal elements of this system, a value arriving later during a
       build process is the same as a phase. We use the term phase in a
       general sense as it relates to the concept in other languages
       and build systems." So `later` claims no more than inputs that
       arrive later, and the launcher's header and the convention say
       so.
    4. A value on the command is one Allegretto literal. This fixes the
       command's flags only: `Configuration.inputs` takes plain data,
       however it was read, and the form of a configuration file stays
       open.
    5. `npm run launch` takes no input flags: a saved program that
       declares an input ends waiting on it. Inputs as saved plain data
       are taken up when a case appears.
  - **Four tests follow "A free name never gets a value"** (the kernel
    stream's PR #244, open, ruled 2026-11-17). On its kernel a module
    with a free name is refused, `waiting` lists cells only, and
    `build` takes the values for a description's free names. Three
    tests of `next/launch/launcher.test.ts` asserted that a name
    nothing binds leaves a run waiting; one of
    `next/bootstrap/emit.test.ts` called `build` with one argument.
    They now rest on the ruling alone: such a run does not complete,
    writes nothing and is told the name; the emitter's test reads the
    record and builds nothing. All four pass on the kernel of main and
    on that PR's kernel. The launcher's `unbound` list is then always
    empty; it is removed in a later part, after that PR merges.
  - **A negative fraction is not a literal.** Prefix `-` stands for
    `int.neg` (`next/ext/allegretto/forms.md` §2), so `-1.5` in a program
    is `int.neg` of the bits of 1.5, which is the fraction -3. The
    reader refuses it as an input's value, so an input and the same text
    in a program never differ. A negative whole number is read. Handed
    to the kernel stream with the maintainer's agreement of 2026-11-17:
    the forms refuse `-` directly on a fraction, so one operator still
    stands for one primitive, and a program writes `float.neg(1.5)`.
  - **Cases realised.** Milestone 1, under the new directory
    `next/corpus/allegretto/m1/`: `boundary-tests:applyPhase (C2.3b)`
    (`phase-fills-input.alg`), `language:reactive: applyPhase triggers
    dependent re-evaluation` (`phase-re-evaluates.alg`),
    `boundary-tests:structure kind (C4.1): future cells stay the
    sanctioned monotonic exception` (`input-filled-once.alg`), and
    `evaluator:B-172 C1 evaluator: Rule 2 — eval_if at run time with an
    unresolved condition runs neither branch's effects`
    (`unknown-condition.alg`). Milestone 3: `boundary-tests:import
    satisfied by an extension (C2.3b)` (`input-at-start.alg`),
    `language:reactive: import binding starts incomplete`
    (`input-not-supplied.alg`), and `language:reactive: applyPhase
    provides binding and triggers re-eval` (`input-later-binding.alg`).
  - **Cases left, with the reason.**
    `boundary-tests:absent vs unresolved (C2.3b)`: the present test
    asserts that a declared import nothing supplies is a pending cell
    and that an undeclared name is absent. The maintainer ruled on
    2026-11-17 that the case changes, stated at the notation's level: a
    declared input not supplied is a cell, and a name bound nowhere is
    refused by the notation before anything is evaluated ("A language
    checks the names it cares about"). The kernel stream's PR #244
    rules the kernel's side, "A free name never gets a value"; the case
    cites that decision once it is on main. No program shows the second
    half yet: the convention has no line for a text the emitter
    refuses.
    The B-172 C1 cases of Rule 1 at milestone 1, and Rule 2's "eval_if
    with an unresolved condition evaluates both branches": each compares
    the shape of a residual, which only the kernel primitive `describe`
    reads, with a key no emitted program holds. The reference kernel
    also evaluates neither branch of an `if` whose condition is unknown.
    The case of `src/test/async-futures.ts` that future cells are
    write-once: the launcher refuses an input supplied twice before
    anything is evaluated, so no program shows the first value standing.
    `types-battery:compile: report lists unresolved imports`: its note
    restates a module that no loader supplies, and imports are refused.
    `pcp:Phase A: summarizeValue collects unresolved symbols`: it reads
    a function value without applying it, which needs `describe`; the
    unbound name it reads is refused by the emitter.
  - **Measured.**
    `milestone 1: programs 4 (passing 4, failing 0) · cases due 27 · realised 4, named only by a failing program 0, not yet named 23 · up to 1: 4 of 27 realised`;
    `milestone 3: programs 31 (passing 31, failing 0) · cases due 133 · realised 98, named only by a failing program 0, not yet named 35 · up to 3: 102 of 170 realised`.
- **2026-11-17 — The launcher and the corpus follow "A free name never gets a value".**
  PR #244 ruled it and built it in the reference kernel: a module with
  a free name is refused, a free name that is needed is a refutation,
  and `waiting` lists cells only. That PR asked three things of this
  stream. The launcher's list of unbound names is removed
  (`next/launch/launcher.ts`): the `waiting` end names the cells no
  capability answers and the inputs no phase supplied, and a record
  whose module uses a name nothing binds is refused at loading with the
  kernel's message. The emitter's test of the kernel primitive `build`
  evaluates it again, with its two arguments: the description, and the
  values for the names it leaves free. The emitter's own check for a
  name bound nowhere stays; it is where an author is told which name.
  Three corpus cases cite the new decision. The case
  `absent vs unresolved (C2.3b)` gains it beside "A language checks the
  names it cares about". Two notes said an unbound name leaves a
  residual: `extension: not available without being provided` of
  `src/test/base.ts`, and the new result of the Rule 1 case of B-172
  (the partial-evaluation rules as implemented against the spine) on an
  unresolved function position. Both now say the notation refuses the
  text and the kernel gives a free name no value. No class changes. No
  title changed: `--follow-renames` of `next/tools/corpus.ts` moved no
  case. Measured: 303 tests pass; 35 programs pass;
  `corpus: 1992 cases · pins 613 · tests 1379 · classed 1992 (survives 1583, changes 263, detail 146) · unclassed 0 — consistent`.
- **2026-11-20 — The emitter's test no longer reads what an attempt answers.**
  PR #261 could not merge: one test of this stream failed on it. The
  ruling of 2026-11-19 gives the kernel primitive `attempt` a new
  answer: the value itself, or a failure. The test "the kernel
  primitives Allegretto names" of `next/bootstrap/emit.test.ts` read
  the former answer, a structure of a tag and a value. What an attempt
  answers is the kernel's to state, and the kernel's own tests hold it.
  The test now holds what the emitter owes: the record names the kernel
  primitive `attempt`, the run goes on past the call, and the call
  answers something. It passes on the kernel of main and on that PR
  merged with main (350 tests, none failing). Nothing else of this
  stream reads an attempt's answer: the programs of the corpus, the
  speed tests, the scenarios and the specifications were searched.
- **2026-11-20 — The corpus follows two retitles, and 30 new results wait for Part IV.**
  Two decisions were retitled between 2026-11-18 and 2026-11-19.
  "Tail calls by sentinel and loop" is "A loop written as a recursion
  runs in constant space" (PR #256): 19 cases, all class survives, and
  none states anything the reworded decision changes. "A failure a
  program can handle is supplied by an extension" is "A failure a
  program can handle is plain data of one shape" (PR #257): 16 cases.
  `--follow-renames` of `next/tools/corpus.ts` moved the 35. The second
  decision was replaced, and it says nothing carries a failure to later
  results: a failure handed to a primitive function is a refutation. A
  note of 2026-11-19 on "The standard language's handled failure is an
  exception" says its sentence "carried to every result computed from
  it, in a field the standard extension owns" no longer stands, and
  that the decision is reworked with Part IV. Of the 73 cases that cite
  that decision, 30 state a new result or a restatement that rests on
  the carrying: 15 pins of `tests/logical-error-demo.alg`, 3 of
  `tests/metadata-channels-demo.alg`, 1 of `tests/arrays.alg`, and 11
  tests of `src/boundary-tests.ts`, `src/test/equality-laws.ts`,
  `src/test/grammar2-language.ts` and
  `src/test/types-construction.ts`. They sit at milestones 4 (15) and
  5 (15). Each now carries a note that says so. No class and no new
  result is changed here: the cases are restated when the decision is
  reworked, since the maintainer's direction for it (a failure is
  returned as a value of a union type, and a check refutes code that
  does not handle a declared failure) is not yet a decision's text.
  Measured:
  `corpus: 1992 cases · pins 613 · tests 1379 · classed 1992 (survives 1583, changes 263, detail 146) · unclassed 0 — consistent`.
- **2026-11-20 — Q5, part 4: the grammar, reader and emitter follow the forms as they stand.**
  The kernel stream's PRs #245 to #260 grew `next/ext/allegretto/forms.md`,
  and the waiting test of `next/bootstrap/emit.test.ts` named the kernel
  primitives the emitter did not write. Built, by item:
  - **Statements.** A block's statements are a chain of the kernel
    primitive `also`. `sync` before an indented block makes them a chain
    of `then`; it is read after `=`, `=>` and `<-`, and in a branch of
    `if`, where an indented block may stand.
  - **A dropped statement** is `claim(!is_failure(a))`, in both kinds of
    block. A block's last statement, `x <- e` and a statement that is
    itself a claim are not wrapped. Every statement of the module is
    dropped: the module yields the structure of its bindings.
  - **`is_failure` and `handle`** are kept as the forms write them, in
    one constant of `next/bootstrap/emit.ts` (`FAILURE_FUNCTIONS`), read
    with the same reader. A test reads the two definitions out of
    forms.md and compares. They are bound in a block around the module's
    own where the text uses either name, so a text may bind either again
    and hide it. A dropped statement's claim applies Allegretto's
    `is_failure` itself, so a text that hides the name does not change
    what a dropped statement means.
  - **`x <- e`** is `x: e` among its block's bindings and the statement
    `x` at its place. The reader refuses a statement above the arrow that
    needs the name, itself or through a binding of the block, and names
    the name and both places.
  - **The kernel's primitives as names**: `also`, `refuse`, `assume`,
    `undecided`, `put`, `key`, `kind`, `symbol`, `spelling`. The waiting
    test reports nothing owed.
  - **A computed key**: `{a: e, [k]: f}` is `put({a: e}, k, f)`, and an
    entry after it is put too.
  - **Keys**: a header line `key name` is a parameter before every other,
    in written order; the record's `keys` counts them; `declares` and the
    yielded structure leave them out. `[name]: e` with a key's name is the
    structure's entry keyed by the key's parameter. The forms' example
    prints `1` then `42` (`keys.alg`).
  - **`int`, `float`, `text` and `bits`** are structures where used as a
    value; `int.add` is still the primitive where the text does not bind
    `int` again, so `needs` lists only what the text names.
  - **Four primitives** named: `bits.int`, `float.eq`, `float.ge`,
    `float.gt`.
  - **Header lines anywhere** at the top level, in any order.
  - **The least integer**: prefix `-` on the whole number 2^63 is read as
    `-9223372036854775808`; `readLiteral` follows.
  - **Programs**: ten under `next/corpus/allegretto/m3/`, written for the
    purpose: `sync-block`, `dropped-failure`, `handle`, `arrow-binding`,
    `data`, `keys`, `refuse`, `assume-undecided`, `least-integer`,
    `namespaces`.
  - **Left, with the reason.** Imports (`import`, `with`, `without`,
    `use`): an import is a call of the imported module's function, which
    needs that module's declarations and identity and a way to find its
    text. The emitter still writes `import name` as a parameter declared
    a module, and the launcher refuses such a module. `sync` before the
    module's own block: the forms do not say where it would be written.
  - **What changed in a running program.** No printed line, end or
    yielded key of the 35 programs, the speed tests or `hello.alg`.
    Steps rose with the claims: the parser speed program from 23,299 to
    23,329, the typed one from 1,187 to 1,227, and `hello.json` from 4 to
    14. A test of `next/launch/launcher.test.ts` pinned the fixture's 4
    steps. It no longer pins a count: how many steps a run takes moves
    whenever the kernel or the emitter changes what a statement stands
    for. A module with no export now yields its `x <- e` bindings too.
  - **Readings taken where the forms are silent**, for the kernel stream
    and the maintainer to confirm:
    1. The module's last written statement is claimed like the others.
       The forms exempt "the last statement of a block", whose value
       goes to the caller. A module yields the structure of its
       bindings, so its last statement's value goes nowhere, and an
       unhandled failure there would be lost.
    2. A statement that is itself an application of `claim` gets no
       claim of its own. The hand-off of PR #257 says so; the forms do
       not list it.
    3. `sync` is the last word of the line before an indented block:
       after `=`, `=>` and `<-`, and in a branch of `if`. The module's
       own block cannot be written `sync`.
    4. A dropped statement's claim applies Allegretto's own
       `is_failure`, whatever the text binds that name to.
  - **Two things for the kernel stream**, each with its smallest text
    in the PR. The reference kernel holds a statement after
    `a <- f()` where `f`'s body is a `sync` block that waits: the forms
    say `<-` holds nothing and a claim holds only its own block. And
    `n <- n + 1` in an inner block now reads itself, as the forms' "one
    group" has it, and runs to the step limit with no refutation.
  - **Measured.**
    `milestone 3: programs 41 (passing 41, failing 0) · cases due 133 · realised 98, named only by a failing program 0, not yet named 35 · up to 3: 102 of 170 realised`.
- **2026-11-20 — The corpus follows the retitles of PR #265, and five symbol cases are restated.**
  PR #264 (part 4 of chunk Q5 (the first notation and the bootstrap))
  merged on the maintainer's auto-merge, so its four readings of the
  forms stand. PR #265 reworded and retitled decisions after the second
  adversarial review's cluster 14. `--follow-renames` of
  `next/tools/corpus.ts` moved 102 citations in 94 cases: 52 to "The standard
  extension decides without search, and a proposer searches", 23 to "A
  symbol names something, and the same spelling is the same symbol", 15
  to "Bindings and extensions may be written in any order", 5 to "There
  is no separate act of running, and a session at a prompt is a
  module", 4 to "Symbols interned by spelling", and 3 from the
  withdrawn "Transient reference symbols resolved by base name". The
  decision on symbols changed what it says: a fully-qualified name is a
  spelling a language's reader writes; Allegretto does not qualify and
  the standard language does. Five cases of `src/boundary-tests.ts`
  are restated to it. No class changes.
  - `fqn symbols (C5.1): same FQN is the same object`: the same
    spelling is the same symbol. It stays at milestone 1 and is realised
    by `next/corpus/allegretto/m1/symbol-same-spelling.alg`.
  - `fqn symbols (C5.1): distinct scopes mint distinct symbols with equal base names`
    and `fqn symbols (C5.1): evalSource registers top-level bindings under the scope FQN`:
    qualifying is the standard language's reader's. They move to
    milestone 4, from milestones 1 and 3.
  - `fqn symbols (C5.1): the ambiguity rule fires identically at all three surfaces`
    and `draw-from (C5.2b): multi-bind`: they cited the withdrawn
    decision, which the decision map sends to "A free name never gets a
    value". The ambiguity error is in a note of the decision on symbols,
    so they cite that. The first moves from milestone 1 to milestone 4.
  Measured:
  `corpus: 1992 cases · pins 613 · tests 1379 · classed 1992 (survives 1583, changes 263, detail 146) · unclassed 0 — consistent`;
  `milestone 1: programs 5 (passing 5, failing 0) · cases due 25 · realised 5, named only by a failing program 0, not yet named 20 · up to 1: 5 of 25 realised`;
  `milestone 3: programs 41 (passing 41, failing 0) · cases due 132 · realised 98, named only by a failing program 0, not yet named 34 · up to 3: 103 of 167 realised`.
- **2026-11-20 — Q8: the speed tests measured again.**
  The ruling of 2026-11-17 has milestone 3 signed on a run of the bench
  made after the shape is fixed: time grows in step with the work on
  both tests. This run shows where that stands. It does not meet the
  condition yet.
  - **How it was measured.** `npm run bench:next`, one run, on main at
    `c205239` (after part 4 of chunk Q5 (the first notation and the
    bootstrap) and PR #261, PR #265 and PR #266), on an Intel Xeon at
    2.30 GHz with 4 cores and 16 GiB, Linux 6.18, node 22.23.5. Each
    time is the median of five runs after a warm-up, in ms, as before.
    The machine differs from the run of 2026-11-17, so ratios and
    exponents compare across the two runs and plain times do not.
  - **Test 1, the parser.**

    | Terms | New steps | New ms | µs per step | Present ms | Native ms | New / present | New / native |
    |---|---|---|---|---|---|---|---|
    | 1 | 9,786 | 73.7 | 7.5 | 56.8 | 0.08 | 1.3 | 954 |
    | 4 | 38,820 | 274 | 7.1 | 108 | 0.10 | 2.5 | 2,643 |
    | 16 | 154,956 | 1,436 | 9.3 | 374 | 0.45 | 3.8 | 3,182 |
    | 32 | 309,804 | 3,639 | 11.7 | 618 | 0.81 | 5.9 | 4,492 |
    | 64 | 619,500 | 10,665, one run | 17.2 | 1,582 | 2.89 | 6.7 | 3,693 |

  - **Test 2a, the typed loop and fold.**

    | n | New steps | New ms | µs per step | Present ms | Native ms | New / present | New / native |
    |---|---|---|---|---|---|---|---|
    | 16 | 1,211 | 7.58 | 6.3 | 7.75 | 4.18 | 1.0 | 1.8 |
    | 32 | 2,321 | 13.0 | 5.6 | 8.76 | 4.72 | 1.5 | 2.8 |
    | 64 | 4,633 | 34.8 | 7.5 | 12.6 | 6.60 | 2.8 | 5.3 |
    | 128 | 9,645 | 120 | 12.4 | 22.8 | 9.49 | 5.2 | 12.6 |
    | 256 | kernel limit | | | 34.3 | 15.9 | | |

  - **Test 2b, the typed sum split in halves.**

    | n | New steps | New ms | µs per step | Present ms | Native ms | New / present | New / native |
    |---|---|---|---|---|---|---|---|
    | 256 | 12,186 | 43.5 | 3.6 | 26.0 | 10.6 | 1.7 | 4.1 |
    | 4,096 | 192,666 | 799 | 4.1 | 303 | 104 | 2.6 | 7.7 |
    | 65,536 | 3,080,346 | 15,936, one run | 5.2 | 4,990 | 1,906 | 3.2 | 8.4 |

  - **How time grows.** Steps grow linearly with the size on all three
    (the parser's fitted exponent is 1.00). Time grows faster than
    steps on the two that nest calls: the parser's fitted exponent is
    1.20, where it was 1.22, and a step costs 7.5 microseconds at 1 term
    and 17.2 at 64. The typed loop's step costs 5.6 microseconds at 32
    and 12.4 at 128; it reaches the kernel's limit before a fit can be
    made. The halving sum's exponent is 1.08, where it was 1.07.
  - **The four findings of 2026-11-16, now.**

    | Finding | Then | Now |
    |---|---|---|
    | `==` on two equal texts of 1,600 characters | 771 ms | 1.00 ms: fixed |
    | one slice of a text of 100,000 characters | 17.3 ms | 0.01 ms a call at every length: fixed |
    | a step slows as arguments nest (`pass(n, sum(n - 1))`, n 50 and n 350) | 16.0 and 54.8 µs | 9.4 and 36.9 µs: still there |
    | a recursion ends at the host's stack | plain sum to 394 in a fresh process; parser to 41 nested parentheses | plain sum to 245; parser to 25; typed loop to 268: still there, and lower |

    Why the ceiling is lower is not measured. Three things changed
    between the two runs: the kernel, the emitter (part 4 writes each
    dropped statement as a claim) and the version of node. The ruling
    of 2026-11-17 is that
    nothing bounds a recursion but its step budget and memory; "A loop
    written as a recursion runs in constant space" states it and its
    status says the reference kernel still uses the host's stack.
  - **What this means for milestone 3.** Two of the four findings are
    closed. The two that are open are the ones the signing condition
    names: the time of a step still grows with nesting, and a deep
    recursion still ends at the host's stack, at a depth that moves from
    run to run. The bench is run again when the kernel stream lands
    those two.
- **2026-11-20 — A `-` written before a fraction is part of the literal.**
  PR #268 answered what part 4 of chunk Q5 (the first notation and the
  bootstrap) handed over. The reference kernel no longer holds a
  statement after `a <- f()`, and a value that needs itself is refuted;
  the four readings are confirmed and written into
  `next/ext/allegretto/forms.md`. One thing came back to this stream,
  by the maintainer's ruling of 2026-11-20: `-1.5` is one literal, as
  the least integer is. The reader (`next/bootstrap/reader.ts`) reads a
  `-` written before a fraction as part of the literal, so
  `float.text(-1.5)` prints `-1.5`, where it printed `-3`, and `-0.0` is
  negative zero. Before anything but a number written out, prefix `-`
  is still `int.neg`. `readLiteral` (`next/bootstrap/literal.ts`) no
  longer refuses a negative fraction as an input's value. A program,
  `next/corpus/allegretto/m3/negative-fraction.alg`, shows it. Measured:
  383 tests pass, none waits; 47 programs pass. PR #268 also says how
  an importing text's emitter gets an imported module's declarations
  and identity before there is a loader: emit the imported text first,
  load its record, and read `moduleOf`. Imports are the next part.
- **2026-11-20 — Imports: part 5 of chunk Q5 and part 4 of chunk Q7.**
  Built, after the hand-offs of PR #250 and PR #268. The grammar and
  the reader (`next/bootstrap/allegretto-grammar.ts`, `reader.ts`) read
  `import name` with a `with` list and a `without` list, each
  comma-separated, in either order, anywhere at a module's top level.
  `use name` is refused with its reason: its notation needs the parser
  engine written in Allegretto. The emitter (`emit.ts`) takes, for each
  imported name, the imported module's declarations and identity. It
  writes the parameter declared `{ role: "module", name, identity }`
  and the binding `name = <that parameter>(arguments)`, with the
  importing module's own capability or input, a `with` expression, or a
  refusal for a name withheld. Its findings name the name and the
  place. An import is a binding, so an open module yields it, as the
  forms say. A new file, `next/bootstrap/driver.ts`, emits a text's
  imported texts first, in dependency order, each once, and takes each
  identity with `moduleOf` on the loaded record. It refuses an imported
  text not found, a cycle, naming it, and a finding of an imported text,
  with its file. The launcher (`next/launch/launcher.ts`) takes the
  imported records, loads each into the same kernel before the main
  one, calls none of them, and refuses an identity no supplied record
  has. The ceiling's capabilities go to the main module alone. The
  refusal "this launcher supplies no modules yet" is gone.
  Choices, for the maintainer to ratify at the PR:
  - Where a text is found: `import name` is the file `name.alg` in the
    directory of the importing text (`importedFile`), read through a
    function the caller passes in. Building showed no reason against it.
    One consequence: a text can import only a file beside it, so one
    program cannot import two files of the same name.
  - What `npm run emit` writes for a text that imports: the text's own
    record, as before, and on stderr one line for each imported text
    whose record it needs, in load order. Each emitted alone gives the
    same record. `npm run launch` takes the records by `--import`.
  - Where a program's imported texts live: a program that imports texts
    of its own is `main.alg` in a directory of its own under
    `m<milestone>`, and its imported texts are the other files there,
    which the harness does not run alone.
  - The new end: `// end: refused: <the finding>`, for a text the
    reader, the emitter or the driver refuses. Nothing is launched, and
    the program passes when one finding's message is the one stated.
    The part of a message before a colon may be stated alone, so a text
    that does not parse is stated as `not Allegretto`, without the
    parser engine's own words.
  Realised: eleven cases of `src/test/modules.ts` at milestone 3, ten
  of them here and the reclassed one below (load
  simple module, loaded functions work in evaluation, module with
  bindings and functions, transitive dependencies, circular dependency
  detected, caching prevents re-reads, a second loader returns the same
  Extension, unknown module ID, empty module produces empty
  extension, recursive function in module); seven `extension:` cases of
  `src/test/base.ts`, the six that use abs, max and min through an
  imported module and "not available without being provided" as an
  expected refusal; "parse error on invalid syntax"; and the boundary
  case "absent vs unresolved (C2.3b)", by two programs, one for each
  half. Four programs are written for the purpose: `with`, `without`,
  an import nothing needs, and a key handed out by an exported binding.
  Two imports of one module being one instance is
  `m3/module-shared/main.alg`.
  One case is reclassed, for the maintainer to confirm. "P2 — the same
  name in two directories is two keys" loads one text from two
  directories and asserts two extensions. On the new kernel a module's
  identity is its content ("A key is made with the module that holds
  it"), so two files with one text are one module, and with the same
  arguments one instance. The case is class changes, and
  `m3/module-same-text/main.alg` shows it: the top-level statement of
  the shared text happens once.
  For the kernel stream: the forms do not say whether `with` and
  `without` may come in either order (both are read); and the withheld
  refusal says "the capability c was withheld" also where `c` is an
  input, as the forms word it.
  Left, with the reason:
  - "C5.1 FQN symbols": Allegretto has no fully-qualified name.
  - "an edited file is a new key" and "the harness and the CLI loader
    share one cache": each is about two configurations, or two
    callers of the host, which one program's run cannot show.
  - "extension: source can shadow extension binding" and "extension:
    multiple extensions layer correctly": the conflict they become is
    between bare names, which `use` would bring and `import` does not.
  - "compile: report lists unresolved imports"
    (`src/test/types-battery.ts`): its restatement leaves a missing
    import in the residual; the driver refuses it before anything is
    evaluated, and whether a missing module is a cell or a refutation is
    not ruled.
  Measured: 435 tests pass, none waits; 65 programs pass;
  `milestone 1: programs 7 (passing 7, failing 0) · cases due 25 · realised 6, named only by a failing program 0, not yet named 19 · up to 1: 6 of 25 realised`;
  `milestone 3: programs 58 (passing 58, failing 0) · cases due 132 · realised 117, named only by a failing program 0, not yet named 15 · up to 3: 123 of 167 realised`.
- **2026-11-20 — Imports ratified; the four iteration functions shipped.**
  The maintainer confirmed every ask of the imports PR (PR #272) on
  2026-11-20: "All asks confirmed." So these stand: `import name` is the
  file `name.alg` beside the importing text; a corpus program that
  imports is `main.alg` in a directory of its own; the end
  `// end: refused: <the finding>`, whose first part before a colon may
  be stated alone; the seven `extension:` cases shown by an import; the
  reclass of "P2 — the same name in two directories is two keys"; rows
  Q5 and Q7. The entry above calls them choices to ratify; they are
  ratified.
  PR #271 ruled streams: a stream is a structure of an item and a rest,
  and `each`, `each_at_once`, `each_within` and `all` are Allegretto's
  functions for iteration, written out in
  `next/ext/allegretto/forms.md`. It asked this stream to ship them. The
  emitter (`next/bootstrap/emit.ts`) keeps their text in one constant
  (`STREAM_FUNCTIONS`) beside the two failure functions, and a test
  holds it to the forms' text. It binds, in the block around the
  module's own, the functions a text names and those they name in turn,
  and no others. The four helpers the forms write beside them (`window`,
  `go`, `without_first`, `start`) are bound there when needed and are no
  names of a text: a text that writes `window` is refused, and a text
  may bind any of these names itself. A program,
  `next/corpus/allegretto/m3/streams.alg`, runs the four on streams
  computed in the program, one ending in a failure. Not shown: the four
  over late answers, since no capability of the launcher answers late
  with a stream. Measured: 441 tests pass, none waits; 66 programs
  pass.
- **2026-11-20 — Q7, part 5: a capability for waiting.**
  Built. The launcher's target ships a second capability, `timer`
  (`next/launch/timer.ts`), beside `output`. Its clocks are in
  `next/launch/clock.ts`. `npm run allegretto` and the corpus runner
  (`runProgram` of `next/corpus/allegretto.ts`) grant both, and so
  does `npm run launch`. The launcher (`next/launch/launcher.ts`) is
  unchanged.
  The proposal, as built, for the maintainer to ratify at the PR:
  - The capability is `timer`, with one part, `wait`. `timer.wait(n)`
    takes a whole number of milliseconds and returns a cell, which the
    launcher fills once `n` milliseconds have passed. Its value is `n`
    itself. A value that is not bits, bits of another length than 64,
    or a negative number is outside the domain, and is a refutation
    with the part's reason. forms.md §1 rules that a primitive function
    applied outside its domain is a refutation, and the kernel makes
    one where host code throws `Refusal` (`next/kernel/interface.ts`).
    `output.write` threw a plain error until this chunk, which ended
    the run as a fault. Both parts now throw `Refusal`, and the test of
    `output.write` on bytes that are not UTF-8 text expects a
    refutation where it expected a fault.
  - Time is the target's. The capability is made with a clock: a
    function asked to call back after a number of milliseconds, given
    as a bigint so that any whole number of 64 bits is asked exactly.
    The terminal passes the host's timer (`realClock`). The tests and
    the corpus runner pass a clock that runs no real time
    (`virtualClock`), made anew for each run. It answers the waits in
    the order they fall due, the earlier asked first among equal ones,
    one at a time. Between two answers it lets the host's event loop
    take one turn, in which the launcher fills the cell and evaluates
    again what waited on it. A wait asked then falls due counted from
    that answer. Building showed no reason against it.
  - The ceiling. A program gets `timer` only where it declares
    `capability timer` and the ceiling grants it; otherwise it is
    refused, as for any capability. A program that does not declare it
    is unaffected, and the hello-world fixture's record is unchanged.
    The terminal has one ceiling for both of its commands
    (`TERMINAL_CEILING` of `next/launch/terminal.ts`): it grants every
    capability the terminal supplies.
  - The launcher needs no new rule. With several waits in flight each
    answer is filled when it arrives, what waited on it is evaluated
    again, a later phase is applied only when no wait is due, and the
    end `waiting` names the inputs left. A test holds each.
  The kernel did nothing the forms do not say, in any program here.
  Realised at milestone 2, all nine of its cases, by ten programs under
  `next/corpus/allegretto/m2/`. The present tree's `delay(n)` answers 0
  after `n` milliseconds, and the programs write it
  `then(timer.wait(n), 0)`. Where a case asserts that nothing is
  printed while a value waits, a line started after the waiting one
  prints first.
  - The six `async:` cases of `src/test/async-futures.ts`: a pending
    value, its propagation to a dependent, print deferred until the
    value arrives, two independent waits, and a chain of dependents.
  - The case of B-028 (completion effects and futures) F1, "a future
    resolving in a LATER pass": a session at a prompt is a module, so a
    later entry is a later line. It is evaluated and printed while the
    earlier entry waits, and the answer then completes the earlier
    entry's dependent, y = 1. A later phase
    cannot stand for the later entry: the launcher applies a phase only
    when no answer is due, so the answer always comes first.
  - "B-028 F2 (CE-R6)", class changes, by two programs, one for each
    half. A module whose top level waits on the timer is imported and
    loads, and its cell is filled when the timer answers. Imported with
    an input that no phase supplies in place of the timer, the call
    stays residual and the run ends waiting; nothing fails.
  - "print returns its argument", class changes: with the output
    capability the call writes 42, and with an input in place of a
    capability the call stays residual. An input stands for a
    capability not given because a module that declares a capability
    the ceiling does not grant is refused, and a later phase supplies
    plain data only.
  - "Stage F3a: top-level print fires immediately": the program prints
    99 once.
  Moved to milestone 4, for the maintainer to ratify at the PR: the
  boundary case on the wire, which cites D42 (evidence is possession),
  "the wire never mints", from milestone 2, and the case "module: C5.1
  FQN symbols" from milestone 3. Both ask of fully-qualified names.
  Allegretto has none: `symbol(t)` gives the symbol of any spelling, and
  qualifying is the standard language's reader's (PR #265). The first
  case's own note called milestone 2 a guess. The other cases on
  fully-qualified names moved the same way on 2026-11-20.
  Eight programs are written for the purpose, under
  `next/corpus/allegretto/m3/`, each a ruled form over answers that
  arrive late: two statements that do not wait for each other, where
  the shorter wait prints first; the same two in a `sync` block, in
  written order; `then(a, b)`, where `b` waits for a wait that `a` left
  going; a claim that waits and holds the line after it; and `each`,
  `each_at_once`, `each_within` and `all` over waits.
  Measured: 475 tests pass, none waits; 84 programs pass;
  `milestone 2: programs 10 (passing 10, failing 0) · cases due 9 · realised 9, named only by a failing program 0, not yet named 0 · up to 2: 15 of 34 realised`;
  `milestone 3: programs 67 (passing 67, failing 0) · cases due 131 · realised 117, named only by a failing program 0, not yet named 14 · up to 3: 132 of 165 realised`.
- **2026-11-20 — Q8: the bench's search is bounded by time, and both kernel variants are measured.**
  PR #277 gave the kernel a second variant, the machine, chosen by the
  environment variable `ALLEGRO_KERNEL`. The kernel stream reported
  that `npm run bench:next` did not finish on it: the search for the
  largest size that completes ran until the kernel stopped, and the
  machine stops at no depth.
  - **What changed in the bench** (`next/corpus/speed/bench.ts`). The
    search (`largest`) ends its doubling at 65,536 as before, and now
    also at the first run that completes but takes longer than 10
    seconds (`LONG_MS`). It then says how far it got and that it did
    not search further. A run in a fresh process is ended after 60
    seconds (`FRESH_MS`). The report names the kernel variant. Three
    tests hold the search, on a clock the test moves.
  - **How it was measured.** `npm run bench:next`, one run on each
    variant, one after the other, on main at `4268fd4` with this
    change, on an Intel Xeon at 2.10 GHz with 4 cores and 16 GiB,
    Linux 6.18, node 22.23.5. The run on the reference took 5 minutes
    55 seconds and the run on the machine 8 minutes 22 seconds. The
    host differs from the earlier runs, so ratios and exponents compare
    across runs and plain times do not. The step counts are the same
    on both variants at every size both complete.
  - **Test 1, the parser.**

    | Terms | Steps | Reference ms | µs per step | Machine ms | µs per step |
    |---|---|---|---|---|---|
    | 1 | 9,786 | 115 | 11.7 | 99.2 | 10.1 |
    | 4 | 38,820 | 394 | 10.2 | 405 | 10.4 |
    | 16 | 154,956 | 2,078 | 13.4 | 2,115 | 13.6 |
    | 32 | 309,804 | 5,131 | 16.6 | 5,552 | 17.9 |
    | 64 | 619,500 | 14,831, one run | 23.9 | 15,264, one run | 24.6 |

  - **Test 2a, the typed loop and fold.**

    | n | Steps | Reference ms | µs per step | Machine ms | µs per step |
    |---|---|---|---|---|---|
    | 32 | 2,321 | 17.2 | 7.4 | 18.5 | 8.0 |
    | 64 | 4,633 | 48.2 | 10.4 | 49.6 | 10.7 |
    | 128 | 9,645 | kernel limit | | 215 | 22.3 |
    | 256 | 21,201 | | | 655 | 30.9 |
    | 512 | 50,461 | | | 2,318 | 45.9 |
    | 1,024 | 133,553 | | | 9,269 | 69.4 |

    The reference completed 128 in the run before this one and ends at
    its limit there in this run.
  - **Test 2b, the typed sum split in halves.**

    | n | Steps | Reference ms | µs per step | Machine ms | µs per step |
    |---|---|---|---|---|---|
    | 256 | 12,186 | 56.9 | 4.7 | 64.8 | 5.3 |
    | 4,096 | 192,666 | 1,155 | 6.0 | 1,257 | 6.5 |
    | 65,536 | 3,080,346 | 23,025, one run | 7.5 | 25,313, one run | 8.2 |

  - **The largest size that completes.**

    | Program | Reference | Machine | Present tree |
    |---|---|---|---|
    | plain `sum(n)`, a fresh process each run | 243 | 65,536 and beyond | 226 |
    | plain `sum(n)`, in one process | 287 | 65,536 and beyond | 584 |
    | parser, parentheses nested n deep | 25 | 128 and beyond | 30 |
    | typed squares, a loop of n | 127 | 2,048 and beyond | 649 |
    | typed letters, a fold of n | 268 | 2,048 and beyond | 650 |

    On the machine the first two reached the search's cap, and the
    last three ended at a run past 10 seconds. No run on the machine
    ended at a limit.
  - **How time grows.** On the parser the steps grow linearly on both
    variants (fitted exponent 1.00) and the time faster: 1.18 on the
    reference and 1.21 on the machine. On the halving sum the time's
    exponent is 1.09 and 1.08. On the typed loop the machine now runs
    far enough to fit: the time's exponent is 1.81 over sizes 64 to
    1,024, and a step costs 10.7 microseconds at 64 and 69.4 at 1,024.
    The loop's steps also grow faster than n there, 2.65 times from 512
    to 1,024. The bench's line for one `++` of a text of n characters
    with itself counts 268 steps at 1,000 characters and 25,018 at
    100,000, and the fold appends to a text that grows. The time of a
    step written `pass(n, sum(n - 1))` is 14.4 microseconds at n 50 and
    51.2 at n 350 on the reference, and 11.5 and 47.7 on the machine.
  - **The two open findings, now.**

    | Finding | Reference | Machine |
    |---|---|---|
    | a step slows as arguments nest | still there | still there |
    | a recursion ends at the host's stack | still there | closed: no run ended at a limit |

  - **What this means for milestone 3.** The reference is still the
    default, and the signing condition is not met on either variant:
    the time of a step grows with nesting on both. The plan of the
    kernel stream (`docs/plans/book-pass.md` §5, from chunk K10 (the machine: waiting) to chunk K15 (specialization, and the switch))
    holds the work that is left. The bench now finishes on both
    variants, so it is run on both when a chunk of that plan lands.
  - **All else on both variants.** The 84 programs of
    `npm run harness:next` pass on both. This stream's tests pass on
    the machine but one, the launcher's test of a run with no step
    budget, which does not end there. What it should assert waits on
    the maintainer's ruling on ask 1 of PR #277.
- **2026-11-20 — A run with no step budget goes on: the ruling, and the launcher's test.**
  PR #277 asked what a run with no step budget does on the machine,
  where a program that never ends does not end. Ruled by the maintainer
  on 2026-11-20, to this stream: the launcher gives no default step
  budget. A run whose configuration sets none goes on, as a host
  program does. The terminal keeps `--steps`, and the corpus runner and
  the tests set a budget.
  - **The launcher** (`next/launch/launcher.ts`) is unchanged in what
    it does. Its header and the comment of `Configuration.steps` state
    the ruling.
  - **The test** "with no step budget a run that ends at the kernel's
    own limit says that no budget was set" ran a program that never
    ends and relied on the host's stack to end it, so it did not end
    on the machine. It now runs the same program on a kernel that
    stops at a limit of its own: the test's kernel gives every
    evaluation 50 steps that the launcher did not set. It asserts the
    same end and the same words, and that the launcher hands the
    kernel no budget. It passes on both variants.
  - **The inventory says the opposite.** PR #279 added a note under
    "Limits are step budgets" in `docs/plans/book-pass-inventory.md`:
    the launcher gives a default budget, and a run that reaches it
    says so. That note is the kernel stream's to correct; this stream
    does not edit the inventory.
  - **Measured.** `npm run test:next` passes on the reference. With
    `ALLEGRO_KERNEL=machine` every test file of this stream passes and
    ends, the launcher's included.
- **2026-11-20 — Milestone 2 signed.**
  The maintainer, on 2026-11-20: "I agree, milestone 2 is done".
  Milestone 2 of `docs/plans/rebuild.md` §5 is the state "The launcher
  runs a saved program that prints through a capability". Its command
  is `npm run launch -- next/launch/fixtures/hello.json`, which prints
  `hello, world` on both kernel variants. All nine corpus cases due at
  it are realised by the ten programs of `next/corpus/allegretto/m2/`.
  Milestone 1 was signed at PR #214 and is recorded in
  `docs/plans/book-pass.md` §7.
- **2026-11-20 — The plan amended for the work after milestone 3.**
  Asked for by the maintainer on 2026-11-20. Chunks Q1 to Q8 are
  delivered, and milestones 1 and 2 are signed. §5 gains "After
  milestone 3": what is left, measured; what each milestone needs from
  each stream; chunks Q9 to Q22; the chapter of each of this stream's 69
  decisions against the chunk that moves its rows; and what no
  milestone asks for. §6 gains five questions, B1 to B5, each with a
  default. The header's chunk list gains Q9 to Q22. No code changed.
- **2026-11-20 — Q10: the decision map made current.**
  - **The stored lists of cases are gone**, by the ruling on question
    B4 (the map's stored lists of cases). No row of
    `next/decisions.json` holds `cases`, the kernel stream's rows
    included: every list was empty. A row that stores one fails
    `npm run lint:decisions`. The cases of a decision are derived from
    `next/corpus/cases.json`, where each case lists its decisions:
    `npx tsx next/tools/decision-map.ts --cases` gives the count for
    each decision, and with a title the ids. A case that cites a title
    a row had before a rename counts for the row.
  - **Measured.** 181 of the 253 decisions have a case. Of this
    stream's 69, 36 have one and 33 have none. The most tested is "A
    plan is an outcome graph with derived wiring", with 114 cases.
  - **Three rows moved to written**, each with its unit
    `next/launch/launcher.ts`: "Only the launcher sets the ceiling", "A
    module is a function of its capabilities, inputs and imports" and
    "A module's top-level statements happen when it is instantiated".
    The launcher, with the emitter, does all each decides, and
    programs of the corpus show it.
  - **Rows begun and not moved.** The map has no state for a decision
    realised in part, so these stay at none until the chunk named
    finishes them:
    - "Startup, step by step": the seven steps run, as far as milestone
      2 needs; the loader of step 5 comes with Q20;
    - "A capability is a named set of effectful primitives": `output`
      and `timer` exist as host data; the definition in Allegro does
      not;
    - "The terminal and the browser ship output, timers and HTTP":
      output and timers ship on the terminal; HTTP is Q16 and the
      browser Q21;
    - "A late answer or its failure fills a cell as plain data": late
      answers are filled; no shipped capability gives a failure until
      Q16;
    - "A saved program names what it needs by content hash" and "A
      stored outcome is restored with its builder's name": the launcher
      refuses a record whose primitive or module it lacks, and restores
      only for a named builder; a mismatch is a refusal before
      anything is evaluated, where the decision says a refutation.
  - **From here** each chunk moves its rows in its own pull request.
  - `decision-map: 253 rows · R 161 · Q 69 · none 23 · state none 233, carried 0, adapted 0, written 20, proved 0 — consistent`.
- **2026-11-20 — The amendment merged; Q9: the launcher on the one interface.**
  The maintainer merged PR #283 the day it was opened, so questions B1
  to B5 of §6 stand at their defaults and chunks Q9 to Q22 are the
  plan. The same hour the kernel stream merged PR #282, the first half
  of its chunk K12 (the interface made one). It adds the new forms
  beside the old, names the launcher's lines to move, and waits for
  this stream before a third pull request removes the old forms.
  - **What moved**, as PR #282 lists it. The launcher
    (`next/launch/launcher.ts`) gives its step budget once, to
    `evaluate`. The kernel counts later work against it, so `advance`
    takes no steps, and an evaluation named in an advance's `limited`
    list ends the launch at its limit. Every `fill` states `hold`: the
    launcher and the corpus runner (`next/corpus/allegretto.ts`) fill
    the cells whose answers arrived and then call `advance`, as before.
    `evaluate` takes no scope. `Kernel2` and `CreateKernel2` give way
    to `Kernel` and `CreateKernel` in every file of this stream.
  - **One check removed.** The launcher refused a kernel that lacked
    the calls of the second interface version. The interface is one,
    so the check is gone; the version constant is still compared.
  - **Measured.** `npm run test:next`: 670 pass on the reference and
    671 with `ALLEGRO_KERNEL=machine`. The 84 programs pass on both.
    No assertion of this stream's tests changed; the test kernel that
    stops by itself reads the limits as the second argument of
    `evaluate`.
- **2026-11-20 — Q16, part 1: the HTTP capability.**
  Built. The launcher's target ships a third capability, `http`
  (`next/launch/http.ts`), beside `output` and `timer`. The transport
  that reaches no network is in `next/launch/scripted-transport.ts`.
  The terminal's two commands, `npm run launch` and
  `npm run allegretto`, and the corpus runner (`runProgram` of
  `next/corpus/allegretto.ts`) grant it. The launcher
  (`next/launch/launcher.ts`) is unchanged. Chunk Q16 (the
  capabilities the launchers ship) has two parts left: file reading
  for the loader and file writing.
  The proposal, as built, for the maintainer to ratify at the PR:
  1. **The capability.** It is `http`, with one part, `request`.
     `http.request(r)` takes a structure with the entries `method` and
     `url`, texts, which are required; `headers`, an array of pairs
     `[name, value]` of texts; and `body`, bits of whole bytes. It
     returns a cell, which the launcher fills with plain data: the
     structure `{status, headers, body}`, the status a whole number of
     64 bits. Any status is an answer, a 404 and a 500 included. A
     request that gets no answer fills the cell with
     ``{failure: `unreachable, reason: <a text>}``: the transport
     rejected, or threw. A value outside the domain is a refutation
     with a reason that names the part, thrown as the kernel's
     `Refusal`. Building showed one point the proposal does not state.
     A private entry of the request is outside no domain: the kernel
     passes it over when it hands a structure to a primitive function,
     as forms.md §4, "Keys and private entries", rules. So the part
     never sees it, and the request is made without it. A test holds
     this.
  2. **The transport is the target's.** The capability is made with a
     function from a request as host data to a promise of an answer as
     host data. The terminal passes `fetchTransport`, over
     `globalThis.fetch`. The tests and the corpus runner pass the
     scripted transport: a table from a method and a URL to an answer,
     every other request rejected with the reason
     `nothing serves <METHOD> <url>`. It answers in the order the
     requests were asked, one at a time, with one host turn between two
     answers (`nextTurn`, now exported by `next/launch/clock.ts`). Two
     points about `fetch` that no test can show, since none calls it.
     It follows a redirect by itself, so the status a program sees is
     the last one's and a 3xx is seldom seen. It rejects some requests
     the part accepts, a body on a GET among them, and such a request
     is then the failure `unreachable` with fetch's reason. Whether
     those belong to the part's domain is the maintainer's to say.
  3. **No test and no corpus run reaches a network.** No test calls
     `fetchTransport`. A test reads the two new files and finds that
     the capability reaches no host API but `globalThis.fetch`, and the
     scripted transport none but the host's turn.
  4. **The ceiling.** `TERMINAL_CEILING` of `next/launch/terminal.ts`
     gains `http`. A program that declares `capability http` where the
     ceiling does not grant it is refused, as for any capability, and
     a program that does not declare it is unaffected. The runner's
     `CEILING` gains it too. Building showed no reason against it.
  5. **The corpus convention.** A program states what the network
     serves in lines `// serves: <METHOD> <url> = <status> <literal>`,
     one for each request served (`readServes`). The status is a whole
     number of three digits, and the literal a text literal read by
     `readLiteral`, whose bytes are the body. The answer has no
     headers: no program here needed the optional form for them, so it
     is not built. A request no line serves is unreachable. A line not
     of the form, a body that is no text literal, and two lines for one
     request each fail the program, which is not launched. A run gives
     the requests the transport was handed (`ProgramRun.requests`).
     The README of `next/corpus/allegretto/` says this in the section
     "Requests".
  6. **The launcher needs no new rule.** With several requests in
     flight each answer is filled when it arrives, in any order, and
     what waited on it is evaluated again. A test holds it.
  Eight programs are written for the purpose, under
  `next/corpus/allegretto/m3/`, and none realises a case of
  `next/corpus/cases.json`: no case asserts an HTTP request.
  - `http-get.alg`: a GET answered; it prints the status and the body.
  - `http-not-found.alg`: a 404 is an answer, no failure, and nothing
    is refuted.
  - `http-unreachable-handled.alg`: a request no line serves is the
    failure `unreachable`, and `handle` answers it.
  - `http-unreachable-dropped.alg`: the same request as a statement
    whose value is dropped; its claim holds the line after it and is
    refuted, as forms.md "Failures" says.
  - `http-at-once.alg`: two requests whose values are bound, and a line
    after them that prints first.
  - `http-each.alg`: `each` over a stream of three URLs. Each call
    writes that it asks and then the answer, and the lines alternate,
    so one request is made at a time.
  - `http-headers-body.alg`: a POST with two headers and a body. Its
    served answer depends on nothing it sends. A test of
    `next/corpus/allegretto.test.ts` shows that both arrived: it reads
    what the runner's transport was handed, the headers in the order
    written and the body's bytes.
  - `http-outside-domain.alg`: a request with no `url`, refuted with
    the part's reason.
  The kernel and the launcher did nothing the forms or the decisions
  do not say, in any program or test here, on either variant.
  No existing test's assertion changed.
  Measured, after the merge of main with Q10 (the decision map made
  current): `npm run test:next` passes 701 tests on the reference and
  702 with `ALLEGRO_KERNEL=machine`; 92 programs pass on both;
  `milestone 3: programs 75 (passing 75, failing 0) · cases due 131 · realised 117, named only by a failing program 0, not yet named 14 · up to 3: 132 of 165 realised`.
  One row of the decision map moves to written, with the launcher as
  its unit: "A late answer or its failure fills a cell as plain data".
  A shipped capability now gives a failure in the one shape, which was
  what the row lacked. "The terminal and the browser ship output,
  timers and HTTP" stays at none until the browser launcher of Q21.
  **Confirmed by the maintainer on 2026-11-20, for now**: "I confirm
  all the asks for now, noting that this capability is not final, and
  we'll rework various features as it matures". Three reworks were
  named:
  - request and answer bodies that are streamed;
  - argument types and values checked more closely against the HTTP
    standard, a body on a GET request refused among them;
  - more transports and protocols.
  So a body on a GET stays the failure `unreachable` with the host's
  reason until the second rework, and the answer's body stays whole
  bytes until the first. None of the three is scheduled by this plan;
  each is taken up when a case or a library needs it.
- **2026-11-20 — Q13, part 1: what a result holds.**
  Built. The launcher (`next/launch/launcher.ts`) gives back, with how a
  run ended, what the run found: its result (`LaunchResult`). This is
  part 1 of chunk Q13 (check and run as configurations, and what a
  result holds). Configuration sources, check as a configuration and
  pipelines are later parts, and none is built. Nothing printed
  changes: `npm run launch` and `npm run allegretto` print what they
  printed. Showing a result is chunk Q14's (the commands).
  The proposal, as built, for the maintainer to ratify at the PR:
  1. **`LaunchOutcome` gains `result`.** It is present for every end
     but `refused`, a fault included. It is plain data: every field is
     a string, a number, or a list or record of those. A test holds
     that it survives `JSON.stringify` and `JSON.parse` unchanged.
     Building showed no reason against it.
  2. **`result.claims`.** One entry for each claim as written, in the
     order the run first reported it. An entry holds `module`, where
     the kernel gives it; the four counts, summed over the evaluation
     and every later call; `waiting`, the level of the last record;
     each reason once; and each thing it rests on once, as plain data.
     An assumption keeps `by` and loses its `at`, which is a kernel
     handle. So two assumptions made by one module are one thing in an
     entry's list. Records of one claim are matched by the handle
     `ClaimRecord.claim`. The claims of a `fill` that holds are summed
     too, though such a call reports none.
  3. **How a reader tells claims apart.** `at` is the claim's key in
     the function of its module, resting on nothing: `claimKey` with
     the module function the loader returned, an empty list of what it
     rests on, and the record's declarations. `originOf` gives nothing
     on either variant: neither keeps origins, and a saved program
     carries none. A key is a hash, so a tool can use it and a person
     can only compare it. It is computed from the claim's content and
     its module's, so it is the same on both variants and in every run
     of the same records. It looks like this: `claim(square(7) == 49)`
     of `m3/claim-holds.alg` is `sha256:f17efc297897…`, and the line
     `output.write("the claim holds")` after it, a claim by "Failures"
     of `next/ext/allegretto/forms.md`, is `sha256:ed828b2068d8…`. What is missing: two
     claims of the same content in the same function have the same
     key, so `output.write("x")` written twice gives two entries with
     one `at`; a claim of no module has none; and nothing gives the
     place in the text. A source position needs origins, which the
     saved program leaves out.
  4. **`result.summary`.** One word, the weakest strength among the
     claims, from weakest: refuted, undecided, assumed, sampled,
     decided (`summaryOf`). A claim with a refuted evaluation is
     refuted; else one with an undecided evaluation, or one that still
     waits, is undecided; else one with an assumed evaluation is
     assumed; else it is decided. The kernel's records have no count
     for sampled, so no run gives sampled yet. A run with no claim is
     decided, a choice the maintainer may change.
  5. **`result.restsOn`.** The kernel's `variant`; the pure primitives
     the loaded records name, each once, by hash and name; the identity
     of each imported module and then of the module run, in the order
     loaded; the capabilities the module run declares, which the
     ceiling grants; and the builder, where the configuration names one
     (`restoreAs`). The configuration's sources, the loader, the parser
     and the target come with configuration sources, a later part.
  6. **The launcher adds no analysis.** It sums what the kernel reports
     and names what it was given. `at` is the kernel's own answer to
     `claimKey`.
  7. **Nothing printed changes.** The terminal's files are unchanged.
  The corpus runner (`runProgram` of `next/corpus/allegretto.ts`) gives
  the result of a run (`ProgramRun.result`). A program may state its
  summary in a line `// summary: <word>` (`readSummary`), and passes
  only if the run's summary is that word. A word that is not a
  strength, two lines, and a line in a program that is not launched or
  that the launcher refuses each fail the program. The README of
  `next/corpus/allegretto/` says this in the section "The summary".
  Five programs state a summary: `m3/claim-holds.alg` decided,
  `m3/claim-refuted.alg` refuted, `m3/assume-undecided.alg` undecided,
  `m3/input-not-supplied.alg` undecided, for a claim that waits when
  the run ends, and the new `m3/result-assumed.alg` assumed. No
  existing program showed an assumed claim alone. None realises a case.
  **What the kernel did that the decisions do not say.** On the
  variant that keeps its own stack, a claim that a waiting claim holds
  keeps the level 1 after it is taken up and decided, though nothing
  waits any more. The reference gives 0. The smallest text:
  `capability output`, `capability timer`,
  `claim(timer.wait(15) == 15)`, `output.write("after")`. The run
  completes on both. The second claim's last record is decided 1,
  waiting 0 on the reference and decided 1, waiting 1 on the other
  (`ALLEGRO_KERNEL=machine`), so the summary is decided on one and undecided on the other.
  `m3/wait-claim.alg` shows it too, and states no summary for that
  reason. The launcher does not work around it.
  No existing test's assertion changed. No test branches on the
  variant.
  Measured: `npm run test:next` passes 718 tests on the reference and
  719 with `ALLEGRO_KERNEL=machine`; 93 programs pass on both;
  `milestone 3: programs 76 (passing 76, failing 0) · cases due 131 · realised 117, named only by a failing program 0, not yet named 14 · up to 3: 132 of 165 realised`.
  No row of the decision map moves in this part. The orchestrating
  session decides which rows it earns.
- **2026-11-20 — Q5: the notation writes `first`.**
  The kernel stream built the kernel primitive `first(a, b)` in PR #285
  and ruled its form in `next/ext/allegretto/forms.md` §4, item 13. The
  emitter (`next/bootstrap/emit.ts`) now binds the name, as it binds
  `then` and `also`. Three programs under `next/corpus/allegretto/m3/`
  show it on the timer: the earlier of two waits, whichever is written
  first, and a value known at once; the effect of the argument that
  loses is never performed; a refutation of either argument refutes it
  at once. None realises a case. `m3/wait-claim.alg` states its summary,
  decided, now that PR #285 fixed the waiting count of a held claim on
  the machine. The emitter's test of what waits has nothing left to do:
  every kernel primitive is one the emitter writes.
- **2026-11-20 — Q13, part 2: a configuration from its sources.**
  Built. The new tree reads a run's configuration from four sources in
  the ruled order, and a run's result says which source supplied each
  value. This is part 2 of chunk Q13 (check and run as configurations,
  and what a result holds), for B-196 (the rebuild's acceptance side).
  It closes B-059 (the project root file) as far as this part goes:
  the file sets a run's budget and inputs, and nothing of structure,
  phases or dependencies. Check as a configuration, and pipelines, are
  later parts, and neither is built. Nothing printed for a run changes:
  showing a result is chunk Q14's (the commands).
  The configuration is in host form. "A full configuration is a model,
  evaluated in a first phase" is a design to prove, and by the
  maintainer's ruling of 2026-11-20 not owed to a milestone, so no
  configuration language is built.
  The proposal, as built, for the maintainer to ratify at the PR:
  1. **The settings** (`SETTINGS` of `next/tools/configuration.ts`):
     `steps`, a whole number; `inputs`, a record from an input's name to
     its value; `later`, a list of such records, one for each later
     phase; `ceiling`, the names of the capabilities granted; `restore`,
     the builder whose stored outcomes are accepted; `kernel`, the
     kernel variant's name. No source sets `steps` by default, and where
     none does there is no budget. Building showed one point. The
     launcher's `Configuration` has no place for the kernel: the
     launcher is handed a kernel factory, not a name. So the resolver
     gives `kernel` beside the configuration, where a source sets it,
     and nothing reads it. No source on the terminal sets it today. A
     ceiling no source sets grants nothing.
  2. **The four sources, highest first** (`SOURCES`): the command line,
     the project's file, the environment, the launcher. A setting is
     taken whole from the highest source that sets it. `inputs` is
     merged by input name, so `--input b=…` replaces the file's `b` and
     keeps its `a`. Building showed one point. `later` is taken whole,
     so one `--later` replaces every later phase of the file. And an
     input the file supplies at the start with a `--later` of the same
     name is supplied twice: the launcher refuses the run, naming the
     input, as it refused before. Neither is silent.
  3. **Which source may set what** is one table, `MAY_SET`: `steps`,
     `inputs` and `later` from any source; `ceiling`, `restore` and
     `kernel` from the command line and the launcher only. A setting
     found in a source that may not set it is a finding that names both,
     for example "the setting ceiling is set by the project's file
     allegro.json, which may not set it: only the command line and the
     launcher may", and the run is refused before anything is emitted or
     evaluated. Building showed one point against the decision's words:
     the decision says "the launcher holds those rules", and the table
     is in `next/tools/configuration.ts`, which the terminal's entries
     call, not in `next/launch/launcher.ts`. The launcher does not
     resolve, as point 9 asks.
  4. **The project's file** is `allegro.json` (`PROJECT_FILE`), in the
     directory of the text being run, and optional. It is a JSON object
     whose keys are setting names. `inputs` and `later` hold each value
     as an Allegretto literal written as a JSON string, read by
     `readLiteral` (`readProjectFile`). JSON that does not parse, a file
     that is not an object, an unknown key, a value of the wrong shape
     and a literal that does not read are each a finding that starts
     with the file's name. A file may hold `ceiling`, `restore` or
     `kernel` in the right shape: it is read, and the resolver refuses
     it. Building showed no reason against it.
  5. **The environment** gives one setting: `ALLEGRO_STEPS`, a whole
     number (`readEnvironment`). A value that is not one is a finding.
     An empty variable is unset, as `next/kernel/create.ts` treats an
     empty `ALLEGRO_KERNEL`. The variable `ALLEGRO_KERNEL` is read by
     the kernel stream's `next/kernel/create.ts` and not here. As it
     stands it is at odds with the decision: the environment chooses the
     kernel, which the decision reserves to the launcher and the command
     line. It is the kernel stream's to change, and this part does not
     work around it or read it as a setting. A run's result names the
     variant in `restsOn.kernel`, and no `kernel` entry in its list of
     sources.
  6. **The launcher's own values**: the terminal's ceiling,
     `TERMINAL_CEILING` of `next/launch/terminal.ts`, every capability it
     supplies. Nothing else. Building showed no reason against it.
  7. **The command line** gains `--ceiling a,b` on both commands. A
     ceiling from a source other than the launcher may only narrow the
     launcher's: a name the terminal does not supply is a finding. It
     keeps `--steps`, and `npm run allegretto` keeps `--input` and
     `--later`. `--restore <builder>` and `--kernel <name>` are reserved
     to the command line by the decision and are not built.
  8. **The resolver is one host-neutral function**, `resolve` of
     `next/tools/configuration.ts`. It takes the four sources as data and
     gives the launcher's `Configuration` with the source of each value,
     or the findings. It reads no file, no environment and no argument
     list. A test reads the file and finds no `process`, `fs`, `path`,
     `Buffer` or `globalThis` in its code. Building showed no reason
     against it.
  9. **The result says where each value came from.** `Launch` takes
     `sources`, the caller's list, beside the configuration, and
     `LaunchResult.restsOn` gives it as `configuration`: a list of
     `{setting, source}` in the order of point 1, with one entry
     `inputs.<name>` for each input. Within `inputs` the order is that of
     the sources, highest first. Where the caller gives none, the result
     has none. The corpus runner (`runProgram` of
     `next/corpus/allegretto.ts`) gives none: a program of the corpus
     states its inputs in its own comment lines and reads no project
     file, and the runner is unchanged.
  10. **The two commands.** `npm run allegretto` reads `allegro.json`
     beside its text where there is one, the environment and its flags,
     resolves (`resolveOnTerminal` of `next/launch/terminal.ts`) and
     launches. `npm run launch` takes a saved program and no project, and
     resolves from its flags, the environment and the launcher's own
     values. A finding is written to stderr, one line each, and the
     command exits 1. Nothing either command prints for a run changes.
     Building showed no reason against it.
  What the decision names that is not built yet: the accepted keys, the
  inspection right, keeping origins, turning off a default policy, the
  parser's and the loader's choice by a project's file, `--restore`, and
  `--kernel`.
  No existing test's assertion changed. No test branches on the
  variant.
  Measured: `npm run test:next` passes 734 tests on the reference and
  735 with `ALLEGRO_KERNEL=machine`; 93 programs pass on both;
  `milestone 3: programs 76 (passing 76, failing 0) · cases due 131 · realised 117, named only by a failing program 0, not yet named 14 · up to 3: 132 of 165 realised`.
  No row of the decision map moves in this part. The orchestrating
  session decides which rows it earns.
- **2026-11-20 — The asks of PR #287 and PR #288 confirmed.**
  The maintainer, in session on 2026-11-20: the confirmation recorded
  under Q16, part 1 was for PR #287, and "I also confirm all asks on
  #288". So the result's form, the key by which a claim is told from
  another, the two choices about the summary, one entry for the
  assumptions of one module, and the corpus line `// summary:` stand as
  built. Both pull requests are merged.
- **2026-11-20 — Q13, part 3: check and run as phases.**
  Built, with one stop. The launcher (`next/launch/launcher.ts`) applies
  a sequence of phases, each supplying capabilities and inputs, and the
  resolver (`next/tools/configuration.ts`) ships two values: check alone
  and run alone. This is part 3 of chunk Q13 (check and run as
  configurations, and what a result holds), for B-196 (the rebuild's
  acceptance side).
  **The stop.** Point 3 asks the phase that supplies a capability to
  fill its cell with the capability, as a structure of its parts. Both
  kernel variants refuse: a cell takes plain data, bits, symbols and
  structures of them ("A late answer or its failure fills a cell as
  plain data"), and a capability's parts are primitive functions. The
  smallest program is `capability output`, `output.write("hello")`,
  with the phases check and then run: check ends waiting on the
  capability's cell, and a fill of that cell with the capability throws
  "what a cell is filled with is not plain data: bits, symbols and
  structures of them" on both variants. A value that faults on every
  program that prints is not shipped. So what is built is this. The
  launcher refuses, before anything is evaluated, a phase after the
  first that names a capability: "the phase run supplies the capability
  output after the first phase: the kernel fills a cell with plain data
  only, so a capability is supplied by the first phase or by none". The
  resolver gives `check, run` a finding of its own: "the setting phases
  is "check, run", which is not built yet: a later phase cannot supply a
  capability, since the kernel fills a cell with plain data only". The
  three programs of check then run are not written.
  Three ways a phase could supply a capability to what an earlier phase
  left waiting are open for the maintainer and the kernel stream, and
  built by neither:
  (a) a call of the kernel's interface by which the launcher puts a
  capability into a cell;
  (b) chunk K15 (specialization, and the switch) of the kernel stream:
  check as the module function specialized with its capabilities
  unknown, and run as a call of what is left;
  (c) the launcher handing, in check, parts that answer late and are
  performed when run begins. That needs no change to the kernel, but
  it calls a part during check.
  The proposal, as built, for the maintainer to ratify at the PR:
  1. **A phase is what it supplies.** `Configuration.phases` is a list,
     in order, of `{name, capabilities, inputs?}` (`Phase`). The first
     is applied at the start, and each later one when the kernel waits
     and no capability's answer is due. Building showed one point: an
     empty list is refused, "the configuration gives no phase", since a
     launch with no phase applies nothing.
  2. **`inputs` and `later` stay.** Without `phases` the launch has
     today's shape: a first phase named `run` that supplies every
     capability of the ceiling and `inputs`, and one named `later` for
     each entry of `later`. `phases` beside `inputs` or `later` is
     refused before anything is evaluated. Building showed no reason
     against it.
  3. **A declared capability no phase has supplied yet is a fresh
     cell.** A phase that names a capability the ceiling does not grant,
     and a capability named by two phases, are refused before anything
     is evaluated. A declared capability the ceiling does not grant is
     refused as before. A phase after the first that names a capability
     is refused, which is the stop above. It replaces the refusal of a
     capability named by two phases, which only a later phase could
     meet.
  4. **The end.** A launch left waiting gains `capabilities`, the
     declared capabilities no phase supplied that the program waits on,
     and its reason names them: "the program waits on the
     capability(ies) output, which no phase supplies". `unanswered`
     counts neither those cells nor the inputs'. Building showed one
     point. An existing test holds the whole waiting end of today's
     shape, which has no place for the new field, and point 2 says no
     test of the launcher changes. So `capabilities` is given where the
     configuration gives `phases`, and left out otherwise. Without
     `phases` every capability is supplied at the start, so it would be
     empty.
  5. **A result for each phase.** `LaunchOutcome.phases` gives, for each
     phase applied, `{name, linesBefore, result}`, the result as it stood
     when that phase was over. The last entry's result is the outcome's
     `result`, the same value. A refused launch has none.
     `linesBeforePhase` stays. Building showed no reason against it.
  6. **A refutation ends the launch** in the phase that finds it, and
     the phases after it are not applied. Building showed no reason
     against it.
  7. **The shipped phases.** The setting `phases`, which any source may
     set, has two values built (`PHASE_VALUES`, `shapeOf`): `run` alone,
     which is today's shape and what no setting gives, where each entry
     of `later` is a further phase after run; and `check` alone, a phase
     that supplies no capability and no input. `check, run` is a finding
     of its own, the stop above. Any other list is a finding that names
     the two values built. `later` with `check` alone is a finding.
     Building showed one point: inputs with `check` alone are supplied
     by no phase, so the run ends waiting on them, by name, and the
     result's list of sources still names where each came from. A
     finding there would be the same rule as for `later`, and the
     maintainer may want it.
  8. **The command line** gains `--phases run` and `--phases check` on
     both commands, and the project's file takes `"phases": ["check"]`.
     `--phases check,run` writes the finding of point 7 and exits 1.
     Nothing either command prints for a run changes, and each exits as
     the end says: under check a program that writes ends waiting on
     output and exits 1. What check shows, and how its command exits, is
     chunk Q14 (the commands).
  9. **The corpus convention** gains `// phases: check`
     (`readPhases` of `next/corpus/allegretto.ts`), made into the
     configuration by `shapeOf`. `// phases: check, run` fails the
     program with the resolver's finding. The `// expect:`, `// end:` and
     `// summary:` lines hold for the whole launch. A program with none
     runs as before. A malformed line, a list that is not built, two
     lines, and `// later:` with `check` alone each fail the program. The
     README of `next/corpus/allegretto/` says this in the section
     "Phases".
  10. **The launcher adds no analysis.** Under check it sums what the
     kernel reports. What is decided there is what the kernel decided.
  11. **The loader's file reading is not in this part.** The bootstrap's
     driver reads the imported texts in host code before the launch.
     Bounding it to the project's and the platform's directories is
     chunk Q16 (the capabilities the launchers ship), part 2.
  **What holds under check.** Measured on both variants, with the
  launcher of this part. Nothing is printed. A claim written before the
  first statement that needs the capability is decided, or refuted.
  After `shown <- output.write("hello")`, which holds nothing, a false
  claim on the next line is refuted. After a dropped
  `output.write("hello")`, which stands for a claim and holds what
  follows, what happens to a false claim depends on how it is written.
  `claim(2 + 2 == 5)` and `claim(false)` in that place are refuted
  under check on both variants: the kernel evaluates the held claim
  ahead and reports it. With a recursive function,
  `sum(n) => if n == 0 then 0 else n + sum(n - 1)`,
  `output.write("hello")`, `claim(sum(2) == 4)`, the claim waits, the
  launch ends waiting and the summary is undecided: check does not
  decide it. The forms say the claim is held until the write's answer
  comes, and say nothing of evaluating it ahead. The interface says
  the reference kernel evaluates what is held ahead, in `advance`; this
  is `evaluate`, and the variant that keeps its own stack does the
  same. So how much check decides after a dropped statement is the
  kernel's, and it is a question for the kernel stream and the
  maintainer. No test and no program of this stream holds the second
  case: it is a present limit of the kernel, and a test that held it
  would fail when the kernel decides more. The launcher works around
  neither.
  **Where the variants differ.** Under check, `output.write("before")`,
  `output.write(n)`, `output.write("after")` with the input `n` not
  supplied: the reference waits on the capability's cell and on `n`,
  the variant that keeps its own stack on the capability's cell alone,
  since it starts nothing held. No decision says which. The launcher
  reports the cells the kernel names, so the end's `inputs` is `n` on
  one and empty on the other. The launcher's test uses a statement bound
  with `<-` for the input, which both variants start.
  Three programs under `next/corpus/allegretto/m3/` state
  `// phases: check`: `phase-check-prints.alg`,
  `phase-check-refuted.alg` and `phase-check-bound.alg`. None realises
  a case.
  What the decisions name that is not built: export; a project defining
  or extending a phase; what a phase must leave decided before the next
  begins; the loader's capability in check; and supplying a capability
  in a later phase, so check then run, the stop above.
  Three existing assertions changed, each because `phases` is a new
  setting: the table of settings and its count of pairs in
  `next/tools/configuration.test.ts`, and the list of settings that an
  unknown key's finding names, there and in
  `next/launch/launcher.test.ts`. No test branches on the variant.
  Measured: `npm run test:next` passes 782 tests on the reference and
  783 with `ALLEGRO_KERNEL=machine`; 99 programs pass on both;
  `milestone 3: programs 82 (passing 82, failing 0) · cases due 131 · realised 117, named only by a failing program 0, not yet named 14 · up to 3: 132 of 165 realised`.
  No row of the decision map moves in this part: check alone is built,
  and the rows of the Phases chapter wait for a pipeline.
- **2026-11-20 — Q16, part 2: the loader's file reading, bounded.**
  Built. This is part 2 of chunk Q16 (the capabilities the launchers
  ship), for B-196 (the rebuild's acceptance side). The decision "The
  platform ships three phases: check, run and export" says the loader
  "reads files in the project's and the platform's directories and
  nowhere else", so that checking a project nobody trusts yet reads
  nothing else.
  What was there. The bootstrap's driver (`next/bootstrap/driver.ts`)
  reads an imported text through a function its caller hands it. Each
  caller handed it the host's whole file system. `import name` names
  `name.alg` beside the importing text, and a name is one word, so no
  text could name a file elsewhere. A link could: a file `lib.alg` in a
  cloned project that links to a file outside it was read.
  What is built.
  1. **A bounded reader** (`boundedReader` of `next/launch/files.ts`).
     It is given the directories it may read in. It reads a file only
     where the file's real path, with every link followed, is inside one
     of them, at any depth. A file that is not there is absent, as
     before. A file that is there and outside is refused, with a reason
     that names the file, the directories and where a link leads.
     Nothing of a refused file is read.
  2. **It is host-neutral.** It reaches the file system through the host
     it is handed (`FileHost`): the real path of a name, whether it is a
     file, its text. The terminal's host is `next/launch/node-files.ts`,
     the one place this reading touches the file system.
  3. **The driver reports a refusal** as a finding at the import, of
     kind `refused`: "the text lib.alg, which import lib names, is not
     read", with the reader's reason. The importing text is not emitted
     and nothing is launched.
  4. **The project's directory is the directory of the text being
     run**, which is where part 2 of Q13 (check and run as
     configurations, and what a result holds) looks for `allegro.json`.
     `npm run allegretto`, `npm run emit` and the corpus's runner read
     through the bounded reader. The runner's directory is the
     repository's root, as before.
  What is not built. The new tree has no platform directory yet, so
  the directories given are the project's alone. The loader is host
  code, so the reader is a host function it is handed and no capability
  a program can declare: when the module loader is written in Allegro
  it takes the same bound as a capability's part, and its name and
  shape are proposed then. The main text itself is read by the command
  from the path the user gave, which the bound does not cover. File
  writing is part 3, and waits for the store of chunk Q15 (the tools
  for proposing).
  B-071 (the capabilities for input and output) is taken by this chunk
  for HTTP and the two file capabilities. This part gives the reading
  its bound and no capability yet.
  Tested by `next/launch/files.test.ts`, eight tests: over a file
  system the test scripts, and over a temporary directory with a link
  that leads out of it, where the command is run end to end. Measured:
  `npm run test:next` passes 790 tests on the reference and 791 with
  `ALLEGRO_KERNEL=machine`; 99 programs pass on both.
- **2026-11-21 — PR #290 merged: the asks of Q13, part 2 stand as built.**
  The maintainer merged PR #290 on 2026-11-21, after merging the
  kernel's interface, version 2 (PR #289 of the kernel stream). A merged
  pull request is the approval. So these stand as built: the settings
  and their names; the project's file `allegro.json`; which source may
  set what; how sources combine; `--ceiling`; `ALLEGRO_STEPS`; and the
  table of rules in `next/tools/configuration.ts`. Nothing of this
  stream changed for version 2 of the interface: every `fill` of the
  launcher already stated `hold: true`. On the merged tree this branch
  passes 800 tests on the reference and 801 with
  `ALLEGRO_KERNEL=machine`, and 99 programs on both.
- **2026-11-21 — PR #293 merged: what stands of Q13, part 3, and what is open.**
  The maintainer merged PR #293 on 2026-11-21. A merged pull request is
  the approval, so the names and the launcher's form stand as built:
  the setting `phases`, its values `run` and `check`, `--phases`, the
  project file's `"phases"`, the corpus line `// phases: check`, a
  phase as what it supplies, the capabilities named in a waiting end,
  and a result for each phase. Four of its asks were questions, and a
  merge does not answer a question. They stay open:
  1. how a later phase supplies a capability, of the three ways the
     entry of part 3 names;
  2. what check should decide after a dropped statement that calls a
     capability;
  3. whether inputs given with `check` alone are a finding;
  4. what check prints and how its command exits, which is chunk Q14
     (the commands).
  Chunk Q14 waits on the last two.
- **2026-11-21 — Q8: the speed tests measured after sharing.**
  PR #292 of the kernel stream, chunk K14 (sharing), merged on
  2026-11-21. The bench is run on both variants when a chunk of that
  plan lands (the entry of 2026-11-20 above).
  - **How it was measured.** `npm run bench:next`, one run on each
    variant, the machine first, on main at `2f615b4`, on an Intel Xeon
    at 2.10 GHz with 4 cores and 16 GiB, Linux 6.18, node 22.23.5: the
    host of the run of 2026-11-20. The run on the machine took about 7
    minutes and the run on the reference about 5. The bench is
    unchanged.
  - **Test 1, the parser.**

    | Terms | Steps on the machine | Reference ms | µs per step | Machine ms | µs per step |
    |---|---|---|---|---|---|
    | 1 | 9,783 | 128 | 13.0 | 58.3 | 6.0 |
    | 4 | 38,817 | 408 | 10.5 | 172 | 4.4 |
    | 16 | 154,953 | 2,202 | 14.2 | 697 | 4.5 |
    | 32 | 309,801 | 5,846 | 18.9 | 1,129 | 3.6 |
    | 64 | 619,497 | 16,663, one run | 26.9 | 2,548 | 4.1 |
    | 128 | 1,238,890 | not run | | 4,706 | 3.8 |
    | 256 | 2,477,674 | not run | | 10,232, one run | 4.1 |

    The reference counts three more steps at each size. On the machine
    the parser takes as long as its twin in the present tree's base
    language, between 0.6 and 1.1 times, and it completes 256 terms,
    where the twin ends at the host's stack.
  - **Test 2a, the typed loop and fold.**

    | n | Reference steps | Reference ms | µs per step | Machine steps | Machine ms | µs per step |
    |---|---|---|---|---|---|---|
    | 64 | 4,633 | 130 | 28.1 | 4,409 | 49.7 | 11.3 |
    | 128 | 9,645 | 301 | 31.2 | 8,685 | 60.2 | 6.9 |
    | 256 | 21,201 | 975 | 46.0 | 17,233 | 106 | 6.1 |
    | 512 | kernel limit | | | 34,333 | 158 | 4.6 |
    | 1,024 | | | | 68,529 | 296 | 4.3 |

    On the machine the steps now grow with n: 68,529 at 1,024, where
    the run of 2026-11-20 counted 133,553. Joining a text no longer
    charges by its size.
  - **Test 2b, the typed sum split in halves.**

    | n | Steps | Reference ms | µs per step | Machine ms | µs per step |
    |---|---|---|---|---|---|
    | 256 | 12,186 | 91.6 | 7.5 | 71.1 | 5.8 |
    | 4,096 | 192,666 | 1,272 | 6.6 | 682 | 3.5 |
    | 16,384 | 770,202 | 5,874 | 7.6 | 2,793 | 3.6 |
    | 65,536 | 3,080,346 | 26,193, one run | 8.5 | 12,310, one run | 4.0 |

  - **The largest size that completes.**

    | Program | Reference | Machine | Present tree |
    |---|---|---|---|
    | plain `sum(n)`, a fresh process each run | 239 | 65,536 and beyond | 226 |
    | plain `sum(n)`, in one process | 922 | 65,536 and beyond | 634 |
    | parser, parentheses nested n deep | 25 | 2,048 and beyond | 31 |
    | typed squares, a loop of n | 268 | 65,536 and beyond | 656 |
    | typed letters, a fold of n | 268 | 65,536 and beyond | 657 |

    On the machine four reached the search's cap, and the parser ended
    at a run past 10 seconds. No run on the machine ended at a limit.
    The run of 2026-11-20 had the two typed programs at 2,048 and the
    parser at 128.
  - **How time grows.** On the parser the steps grow linearly on both
    variants (fitted exponent 1.00). The time's fitted exponent is
    0.95 on the machine, where it was 1.21, and 1.19 on the reference.
    On the machine a step of the parser costs between 3.6 and 4.5
    microseconds from 4 terms to 256, with no trend. On the two typed
    tests the machine's time per step falls as the size grows and then
    stays level, at about 4 microseconds. A step of `sum(n)` written
    `pass(n, sum(n - 1))` costs 8.2 microseconds at n 50 and 5.0 at
    n 350 on the machine, and 14.9 and 78.0 on the reference. One `++`
    of a text with itself counts 18 steps on the machine at every size,
    and 25,018 on the reference at 100,000 characters.
  - **The two open findings, now.**

    | Finding | Reference | Machine |
    |---|---|---|
    | a step slows as arguments nest | still there | closed: the time of a step does not grow with the size of the run |
    | a recursion ends at the host's stack | still there | closed: no run ended at a limit |

  - **What this means for milestone 3.** The maintainer's ruling of
    2026-11-17 signs the milestone on a run where time grows in step
    with the work on both tests. This run shows that on the machine,
    on both tests, and does not show it on the reference. The
    reference is still the kernel a run gets by default. The kernel
    stream's last chunk, K15 (specialization, and the switch), makes
    the machine the default. So the speed condition is met on the
    variant that is to be the default, and the milestone is brought
    for signing when K15 lands and the bench is run once more on the
    default. Whether to sign before the switch is the maintainer's.
  - **All else on both variants.** On main at `3529655`, with PR #293
    merged, the 99 programs of `npm run harness:next` pass on both, and
    `npm run test:next` passes 796 tests on the reference and 797 with
    `ALLEGRO_KERNEL=machine`.
- **2026-11-21 — Two asks of PR #296 agreed by the maintainer in session.**
  "I agree on asks 1 & 2." So: milestone 3 is brought for signing when
  chunk K15 (specialization, and the switch) of the kernel stream makes
  the machine the default, on one more run of the bench then. And a
  later phase supplies a capability by `specialize`: check is the
  module function specialized with its parameters unknown, and run is a
  call of the function that gives, with the capabilities and the
  inputs. `check, run` is built on it when PR #295 of the kernel stream
  is merged. The other three questions of PR #293 are being gone
  through with the maintainer.
- **2026-11-21 — PR #294 merged: the asks of Q16, part 2 confirmed.**
  The maintainer merged PR #294 on 2026-11-21 and wrote on it: "Both
  asks confirmed." So a file that is there and outside the directories
  the loader may read is a finding at the import, of kind `refused`,
  and the project's directory is the directory of the text being run.
- **2026-11-21 — The maintainer on check, in session.**
  This stream put five questions on check to the maintainer after the
  merge of PR #293. The answers, in the maintainer's words:
  - Check alone on `specialize`, with the largest budget where no
    source sets one: "Agreed".
  - What check decides after a dropped statement that calls a
    capability: "Needs a more detailed discussion. I believe we need to
    adjust how held capabilities' methods are handled, so we still get
    information that can be used in subsequent expressions. I assume
    that conversation should happen in the kernel session."
  - Inputs under check: "Same as 1. Check is useless if we can't decide
    any claims on missing inputs and capabilities. Deciding claims
    against sample inputs is not much better." So check leaves an input
    unknown and does not take a given value as known. What is decided
    over an unknown input or a missing capability's answer is the
    kernel stream's, with the point above.
  - What check prints and how it exits: "While check doesn't have any
    capability for program output, it should have a capability for
    check output to allow messaging, exit status and other integrations
    with external build tools."
  - Whether a plain run becomes check and then run: "if check
    capabilities and run capabilities are provided, then `run` does the
    same work as `check, run`."
  The maintainer then asked how check capabilities change things. That
  is under discussion, and nothing is built on it. One point this
  stream raised: `specialize` performs no effect, on a capability it is
  given as on one it lacks, so a module that calls a check capability
  would not act under a check that is `specialize` alone. Whether the
  first answer stands as built depends on who may call a check
  capability. "Check capabilities" and "check output" are the
  maintainer's words and are not yet defined in a decision.
- **2026-11-21 — Q13, part 4: a result counts sampled claims.**
  PR #295 of the kernel stream, the first part of chunk K15
  (specialization, and the switch), merged on 2026-11-21. It gives the
  kernel the primitive `sample`, a count `sampled` in each claim record,
  and the number of cases on the record of kind `kernel` among what a
  claim rests on. Its part for this stream said that the launcher's
  summary did not read the count, so a run whose only claims were
  sampled would have been summed up as decided. Built, in
  `next/launch/launcher.ts`:
  1. Each claim of a result has a fifth count, `sampled`, summed as the
     other four are.
  2. The summary reads it. Its rule is now: refuted; else undecided or
     waiting; else assumed; else sampled; else decided. This is the
     order of "A module's summary is the weakest strength among its
     claims".
  3. What a claim rests on keeps the number of cases: the entry of kind
     `kernel` has `sampled` where the kernel's record has it.
  The notation does not write `sample` or `specialize`: the forms
  (`next/ext/allegretto/forms.md`) do not state them, and the forms are
  the kernel stream's. The emitter's own test names both as kernel
  primitives it does not write, as a test marked to do. So no program
  of the corpus gives the summary `sampled` yet. The launcher's test
  takes a record the emitter wrote for a call of `first`, which also
  takes two arguments, and names `sample` in its place.
  One existing test's helper gained the new field, and no assertion
  changed. Measured on main at `d65d049` with this change:
  `npm run test:next` passes 823 tests on the reference and 824 with
  `ALLEGRO_KERNEL=machine`, with the one test to do on each; 99
  programs pass on both.
- **2026-11-21 — Milestone 3, brought for signing.**
  PR #297 of the kernel stream, the last part of chunk K15
  (specialization, and the switch), merged on 2026-11-21:
  `next/kernel/create.ts` gives the variant that keeps its own stack,
  and the reference with `ALLEGRO_KERNEL=reference`. The maintainer
  agreed on 2026-11-21 that milestone 3 is brought when the switch
  makes that variant the default, on one more run of the bench. This
  is that run.
  - **The milestone.** `docs/plans/rebuild.md` §5: "Programs in the
    first notation run: functions, recursion, claims. One speed test of
    a typed extension and one of a toy parser engine written in
    Allegro". Its commands are `npm run harness:next` and
    `npm run bench:next`.
  - **Programs in the first notation run.** On main at `ea64f65`,
    `npm run harness:next` runs 99 programs and all pass, on the default
    kernel and on the reference. Its line for the milestone:
    `milestone 3: programs 82 (passing 82, failing 0) · cases due 131 · realised 117, named only by a failing program 0, not yet named 14 · up to 3: 132 of 165 realised`.
    `npm run test:next` passes 823 tests by default and 822 on the
    reference, with one test marked to do on each: the emitter's, which
    names the kernel primitives `sample` and `specialize` as ones the
    notation does not write.
  - **The speed tests, measured.** `npm run bench:next`, one run on the
    default kernel and one on the reference, on main at `f525b4c`, on
    the host of the runs of 2026-11-20 and 2026-11-21. The run on the
    default took 8 minutes and the run on the reference 6. While the
    default ran, this session merged a branch and ran a typecheck on
    the same host, so the rows for 16 and 32 terms are a little high.

    | Test | Size | Default: ms | µs per step | Reference: ms | µs per step |
    |---|---|---|---|---|---|
    | parser | 4 terms | 163 | 4.2 | 432 | 11.1 |
    | parser | 16 | 818 | 5.3 | 2,274 | 14.7 |
    | parser | 64 | 2,578 | 4.2 | 16,071, one run | 25.9 |
    | parser | 256 | 11,285 | 4.6 | not run | |
    | typed loop | 64 | 45.5 | 10.3 | 78.5 | 17.0 |
    | typed loop | 256 | 81.0 | 4.7 | 675 | 31.8 |
    | typed loop | 1,024 | 223 | 3.2 | kernel limit at 512 | |
    | halving sum | 4,096 | 644 | 3.3 | 1,282 | 6.7 |
    | halving sum | 65,536 | 10,346, one run | 3.4 | 26,244, one run | 8.5 |

    The time's fitted exponent against size, on the default: 0.89 for
    the parser, with steps at 1.00; 0.66 for the typed loop; 0.88 for
    the halving sum. On the reference: 1.10, 1.55 and 1.01. On the
    default a step of the parser costs between 4.2 and 5.3 microseconds
    from 4 terms to 256, with no trend. The parser's series ends at
    256 terms because that run passed 10 seconds, which is the bench's
    own rule. A step of `sum(n)` written
    `pass(n, sum(n - 1))` costs 9.7 microseconds at n 50 and 4.9 at
    n 350. No run on the default ended at a limit: a plain `sum(n)`
    and the two typed programs reach the search's cap of 65,536, and
    the parser 2,048 nested parentheses, where the present tree ends
    at 226, 649, 650 and 30.
  - **The condition.** The maintainer's ruling of 2026-11-17 signs
    the milestone on a run where time grows in step with the work on
    both tests. On the default kernel it does, on both tests.
  - **The 14 cases due at milestone 3 that no program realises.** Each
    waits on something the milestone's state does not name. By what
    its decisions say it needs:
    - a session at a prompt, which is chunk Q14 (the commands): four,
      "REPL persistence (C2.3b)" and the three "persistent context"
      cases of the base tests;
    - extensions that layer and shadow, with metadata fields: two,
      "extension: source can shadow extension binding" and "extension:
      multiple extensions layer correctly";
    - the loader's own keeping of modules: two, the "module: P2" cases;
    - a value's origin: one, "D47 chunk 2: explain";
    - a tool that reads a result: two, "Phase A: summarizeValue
      collects unresolved symbols" and "compile: report lists
      unresolved imports";
    - the typed language: two, "UntypedFunction" and "partial eval:
      eval_if with unresolved condition";
    - one this stream has not placed: "hybrid parser: dot access with
      function call".
    Milestone 1 was signed with 6 of its 25 cases realised by a
    program. This stream proposes the same here: the 14 stay due at
    milestone 3 and stay counted as not yet named, and each is realised
    when what it waits on lands. Moving a case to a later milestone is
    the maintainer's.
- **2026-11-21 — The maintainer on check capabilities, in session.**
  This stream answered the question of how check capabilities change
  things and put four asks. The answers, in the maintainer's words:
  - Who may call check output, only the code that presents a result or
    also the module being checked: "I agree with (b), but you're right,
    this changes how we think about `specialize` and if it works for
    `check`. Check capabilities need to have no side effects and not
    provide any input values, so that skipping those methods have no
    effect on checking or running a program."
  - Whether check decides for every input and a run for the inputs
    given: "It's not feasible to check every value of every input, much
    less every combination of possible values across all inputs.
    However, holding claims that depend on inputs makes `check`
    potentially useless. For Allegro code this is resolved by using
    types, which are declared in the code and inputs can remain unknown.
    For Allegretto code we assume that any required correctness checks
    are built in to the code by explicitly. To support that practice,
    held claims should be flagged - either refuted or logged. So there
    is a formal difference between `run` and `claim, run.` Invoking
    `run` alone is aimed at scripting and iterative development." This
    stream reads `claim, run` as `check, run`.
  - The check-output capability: "Go ahead and draft a v1 check output
    capability. We'll likely add to it with test output and utility
    methods."
  - The points for the kernel session: the maintainer carries a message
    this stream drafts.
  What this changes of what this stream had concluded:
  1. `check, run` is a configuration of its own, with a formal
     difference from `run`, and is to be built. This stream had said it
     was no longer needed for the shipped commands.
  2. A plain run stays `run` alone.
  3. Under check a claim that is held is flagged. So the ratified rule
     stands for check too: a claim that still waits counts as
     undecided. This stream had proposed to leave such claims out of
     the word under check, and withdraws that.
  4. A phase is the capabilities it supplies and what it must leave
     decided, in the words of "Phases are configuration". Check must
     leave no claim held, or log each one.
  5. Check leaves an input unknown. Taking a given value as known is
     set aside.
  Open with the maintainer: who chooses whether a held claim is refuted
  or logged.
- **2026-11-21 — Q16, part 3: the check-output capability, first version.**
  The terminal ships a fourth capability, `report`
  (`next/launch/report.ts`), the maintainer's check output, and the
  corpus runner grants it. Its name,
  parts and shapes are this stream's proposal, for the maintainer to
  ratify. The launcher is unchanged. The nine points, as built:
  1. **The capability.** `report`, with the parts `message` and
     `status`. The file reaches no host API, and a test holds that.
  2. **Neither part gives a program anything.** Each answers at once
     with the empty structure, whatever it is given, a failure among
     them. Neither refuses a value, answers a failure or answers late.
     A test runs the same program with and without calls on `report`
     and gets the same lines, the same end and the same summary.
  3. **`report.message(m)`.** A structure with `level`, `text` and
     optionally `file`, `line` and `column`, in any order. A text alone
     is a note. Any other value is a note: "report.message was handed no
     message: a value of kind <kind>". No function reachable from
     `next/launch/` shows a value as the `// yields:` lines do, so the
     note names the kind alone, by the kernel interface's names
     (`composed-function` for a function). An entry under another key, a
     level outside the three, a `line` that is negative or not 64 bits,
     and a `file` that is no text each make the value no message. A
     message does not set the status.
  4. **`report.status(n)`.** A whole number of 64 bits from 0 to 255.
     The highest handed over stands, in either order. A value that is no
     status counts as 255, with the note "report.status was handed no
     status from 0 to 255: a value of kind <kind>, which counts as 255".
  5. **The sink.** The capability is made with a sink of two functions
     (`ReportSink`). `collector` keeps the messages in order and the
     highest status; the terminal, the corpus runner and the tests use
     it. The terminal's sink (`terminalReport`) writes each message to
     stderr as one line as it is handed over (`messageLine`):
     `file:line:column: level: text` with the parts it has, `level:
     text` where there is no file. This stream's reading of "the parts
     it has": a line is written only after a file, and a column only
     after a line.
  6. **The exit code** of both commands is the higher of 0 for a
     completed run or 1 otherwise, and the highest status (`exitCode`
     of `next/launch/terminal.ts`). Tested end to end on both commands:
     completed with status 3 exits 3, refuted with 0 exits 1, refuted
     with 7 exits 7. Nothing else they print changes.
  7. **The ceiling and the phases.** `TERMINAL_CEILING` gains `report`.
     `CHECK_CAPABILITIES` of `next/tools/configuration.ts` holds
     `report` alone, and `shapeOf` takes the ceiling: check supplies the
     check capabilities it grants and no other. Under `--phases check` a
     call on `report` acts and a call on `output` waits. A ceiling
     narrowed to leave `report` out refuses a module that declares it.
     A run under check that calls `output` still ends waiting and exits
     1 at least; what check's command shows is chunk Q14.
  8. **The corpus lines.** `// reports: <level>: <text>` and `// status:
     <n>`, documented in the README's section "Messages and status". A
     `// reports:` line is compared with the terminal's line for the
     message, so a message with a file is stated with its place first.
     This stream reads the point so; a line that held the level and the
     text alone could not show a file.
  9. **The launcher needs no new rule.** No line of `launcher.ts`
     changed.
  - **The programs.** Eleven, under `next/corpus/allegretto/m3/`, none
    with a `// realises:` line: no case of `next/corpus/cases.json`
    shows a check output. `report-levels` (one of each level),
    `report-place` (a file, a line and a column, and fewer),
    `report-text` (a text alone), `report-not-message` (values that are
    no message), `report-status-rising` and `report-status-falling`
    (the higher stands, written second or first), `report-status-invalid`
    (255 and a note), `report-error-no-status` (completed, status 0),
    `report-check` (under check: messages handed over, nothing printed,
    the write waits), `report-answer` (the answers bound, `count` of
    each 0) and `report-import/main.alg` (report handed on to an
    imported module, which reports).
  - **A fault of the bootstrap's reader, found and fixed here.** The
    reader refused a reserved word as a symbol literal: `` x = `error ``
    was "not Allegretto", as were `` `else ``, `` `if ``, `` `none `` and
    `` `when ``. forms.md §2 says `` `name `` is the symbol `name` and
    names no exception. The symbol literal was `` ` `` and an
    identifier, and an identifier excludes the reserved words. It is
    now `` ` `` and any word (`symbol_name` of
    `next/bootstrap/allegretto-grammar.ts`): a symbol's name is data
    and is never read as a name or a keyword. The reader's test holds
    seven such words. So a program writes the level `` `error ``.
  - **What follows from the forms and may surprise.** A text is bits of
    whole bytes, so a number written out is a text where its bytes are
    UTF-8: `report.message(42)` is a note whose text is seven NUL bytes
    and `*`. The programs use `true`, one bit, as a value that is no
    text. A key handed to a primitive function has the kind `structure`
    through the kernel's interface, where `kind(x)` in Allegretto gives
    `` `key ``, so the note names a key's kind as `structure`. The two
    kernel variants did the same in every program and test.
  - **Two ruled decisions now differ from what is built.** "The
    platform ships three phases: check, run and export" has check
    evaluate "with no capability but the loader's", and check now
    supplies the check capabilities. "The terminal and the browser ship
    output, timers and HTTP" names three, and the terminal now ships
    `report` too. Their wording is the kernel stream's file.
  - **What stands from the entries above.** `specialize` performs no
    effect, so when check is `specialize` alone a call on `report` will
    not act under it. The maintainer's answer above, that this changes
    how `specialize` serves check, stands open with the kernel stream.
  - **Measured.** `npm run test:next` passes 861 tests on the reference
    and 862 with `ALLEGRO_KERNEL=machine`, with one marked to do on
    each. 40 tests are new on each: 29 written here and one for each of
    the eleven programs. `npm run harness:next` runs 110 programs, and
    all pass on both variants.
- **2026-11-22 — Milestone 3 signed.**
  The maintainer, on PR #300, on 2026-11-22: "Milestone 3 is signed.
  The 14 cases not yet realized should be held over until they can be
  answered." Milestone 3 of `docs/plans/rebuild.md` §5 is the state
  "Programs in the first notation run: functions, recursion, claims.
  One speed test of a typed extension and one of a toy parser engine
  written in Allegro". Its commands are `npm run harness:next` and
  `npm run bench:next`, and the entry "Milestone 3, brought for
  signing" above holds what each showed. The 14 cases stay due at
  milestone 3 and counted as not yet named, and each is realised when
  what it waits on lands: that entry lists them by what they wait on.
  Milestones 1, 2 and 3 are signed. Milestone 4 is next: the typed
  part of the corpus passes. From this stream it needs chunk Q11 (the
  standard language's notation in the bootstrap), which waits on the
  forms the kernel stream rules, and chunk Q12 (the cases of each
  milestone, realised) for milestone 4.
- **2026-11-23 — The asks of PR #299 confirmed, and what the kernel stream's merges of the day open.**
  The maintainer, on PR #299 and in session, on 2026-11-23: "All asks
  confirmed", and the pull request is set to merge. So the check-output
  capability stands as built: the name `report` and its parts `message`
  and `status`; what a message is; that neither part gives a program
  anything or refuses a value; the highest status from 0 to 255; that a
  message does not set the status; the exit code of both commands; the
  terminal's line; and the reader's fix, a symbol literal that names any
  word.
  The kernel stream merged two pull requests the same day, after the
  maintainer carried this stream's message to that session.
  - PR #301: a part of a program can say where it was written, and a
    claim's record gives that place. A saved program's node of kind
    `expression`, `function` or `structure` may carry `at`. Three
    decisions are recorded in `docs/plans/book-pass-inventory.md`, and
    the decision map gives two of them to this stream: "Check reaches
    every claim" and "A phase leaves a capability out as not yet given
    or as not needed".
  - PR #302: `Kernel.observe`, a hook that tells the host of a branch,
    a call, a claim and an effect, each with its place.
  What this changes for this stream:
  1. **The emitter can write places**, and a result can then show a
     claim by its file and line. That is the next chunk, and it waits on
     nothing.
  2. **Check is to reach every claim**: it specializes with nothing
     bound, takes both branches of a conditional whose condition is
     unknown, and specializes every function a module binds. A claim
     comes out decided, refuted, or waiting with what it waits for
     named. A check has three phases: the specialization, an analysis by
     the host, and running tests. The kernel's part, an evaluation of a
     module that takes both branches, is the kernel stream's and is not
     built. The launcher's check follows it.
  3. **A phase leaves a capability out in one of two ways**, not yet
     given or not needed, and the choice is the phase's. Nothing of it
     is built, and the maintainer holds that it needs more analysis on
     real cases. One point to settle with it: the decision's use case
     has a run leave out, as not needed, a capability that check gives a
     module. The run of PR #299 supplies `report`, so that a script's
     messages and status are handed over.
- **2026-11-23 — Places: the notation writes where each part was written, and a result gives a claim's place.**
  B-196 (the rebuild's acceptance side), chunks Q5 (the first notation
  and the bootstrap) and Q13 (check and run as configurations, and what a
  result holds). The kernel stream's PR #301 lets a part say where it was
  written. The bootstrap's emitter now writes that place into every
  record, and the launcher's result copies it onto each claim. Nothing
  printed changes. The six points, as built:
  1. **The emitter writes a place on every node it may.** Each node of
     kind `expression`, `function` or `structure` that a part of the
     text gives rise to carries `at`, the kernel's `Place`. Its `source`
     is the name the text is emitted under: the file, as the driver has
     it, or `<text>` for a text emitted with no name (`UNNAMED` of
     `next/bootstrap/emit.ts`, the name `describeFinding` already gave
     such a text). `start` and `end` are the index, line and column of
     the part's first character and of the point after its last. The
     reader keeps offsets and the line and column of a start only, so
     `locationAt` of `next/bootstrap/reader.ts` gives the line and
     column of any offset; the reader's own places use it too. The
     reader's module keeps the text it read (`Module.text`), its line
     ends `\r\n` written `\n`, and every index counts in it. A node made
     for what a form stands for takes the form's place: the claim, the
     negation and the call of `is_failure` that a dropped statement
     stands for take the statement's; the call an operator stands for
     takes the operator expression's; `get` takes the place of `p.a`;
     the kernel's block, its bindings and each link of its chain take
     the block's; the module function and the structure it yields take
     the whole text's. The emitter shared no node that now carries a
     place, so no sharing was undone and the records have the same
     nodes. A test loads every record of the corpus with and without its
     places, on the kernel the environment chooses, and the identity is
     the same.
  2. **The driver** emits each text under its file, so an imported
     text's parts name their own file.
  3. **A result gives each claim's place.** `ClaimResult` gains `place`,
     copied field by field from the first record of the claim that gives
     `ClaimRecord.at`. The key `at` keeps its name. The comment says that
     the kernel's record names the two the other way round.
  4. **Nothing printed changes.** No command prints `place`, and no
     `// end:` line changed. Showing a place is chunk Q14 (the commands).
  5. **The corpus runner** reads `// claim at: <line>:<column> <word>`.
     The word is `claimWord` of `next/launch/launcher.ts`, the summary's
     rule for one claim, which `summaryOf` now reads too. It gives
     `waiting` where the summary's rule says undecided because the claim
     still waits. A line that names a place where no claim is written
     fails the program. Five programs gained two lines each:
     `claim-holds`, `claim-refuted`, `result-assumed`, `assume-undecided`
     and `input-not-supplied`. The line names a place of the program's
     own text only, so no line states a claim in an imported text.
  6. **The fixture** `next/launch/fixtures/hello.json` is regenerated with
     the emitter, since a test compares it with what the emitter writes
     for `hello.alg`. Its places name `<text>`, as that test emits it.
     `npm run launch -- next/launch/fixtures/hello.json` prints `hello,
     world`.
  - **The nodes that carry no place.** The nodes of the kinds that have
    no `at`: bits, symbol, datum, param, kernel and primitive. The nodes
    of Allegretto's own functions, `is_failure`, `handle`, `each` and
    the rest: their text is kept in the emitter, not in a file the
    program names. So a claim written inside `each` has no place in a
    result (`streams.alg` shows one). The structure of `int`, `float`,
    `text` or `bits`, which Allegretto binds and the emitter writes once.
    The block around the module's own that binds the own functions a
    text uses, which no part of the text writes.
  - **One existing assertion changed.** The driver's test that compares
    its record with the emitter's emits the text under the driver's file
    name, since every place names the file.
  - **What the kernel did.** Both variants gave every claim the place of
    the claim's node, and the same places in every program and test.
    Nothing was found that the interface or the forms do not say.
  - **Measured.** `npm run test:next` runs 893 tests on the default
    kernel and 892 with `ALLEGRO_KERNEL=reference`; all pass but one
    marked to do on each. 15 tests are new on each. `npm run harness:next` runs 110
    programs, and all pass on both variants. The corpus gives 124
    records, which hold 5,360 nodes of the three kinds; 3,758 carry a
    place.
- **2026-11-23 — A held claim is neither refuted nor logged.**
  The maintainer, in session, on 2026-11-23: "I worked through the
  check phase handling of claims with the kernel session. Held claims
  will neither be refused or logged." This closes the question this
  stream had put, who chooses whether a held claim is refuted or
  logged, and this stream withdraws the setting it proposed. It reads
  the ruling with the decision "Check reaches every claim": under check
  a claim comes out decided, refuted, or waiting, and the result names
  what it waits for. A claim that waits stays in the result as waiting,
  and the summary counts it as undecided, as ratified. Nothing refutes
  it and nothing writes a message about it. A configuration may require
  more, such as that no claim is left waiting. The word for one claim
  in a result has `waiting` among its values since the entry above
  (`claimWord`), which fits this.
  One question is open with the maintainer, asked the same day: whether
  a run supplies `report`, as PR #299 built it, or leaves it out as not
  needed, as the use case of "A phase leaves a capability out as not
  yet given or as not needed" has it.
- **2026-11-23 — Q13, part 5: the launcher's check reaches every claim, and check then run.**
  B-196 (the rebuild's acceptance side), chunk Q13 (check and run as
  configurations, and what a result holds). The kernel stream's PR #303
  gives the kernel `check`. The launcher's check now hands the module to
  it, so every claim of a module is reached, and `check, run` is built as
  a check followed by an ordinary run. The names and forms are this
  stream's proposal, for the maintainer to ratify. The eleven points, as
  built:
  1. **A phase may be a check.** `Phase` of `next/launch/launcher.ts`
     gains `check?: true`. A check after the first phase is refused before
     anything is evaluated: "the phase <name> is a check after the first
     phase: only the first phase may be a check". So is a check that names
     inputs: "the phase <name> is a check and supplies the input(s) <names>:
     a check supplies no input, and leaves every input unknown".
  2. **How a check is evaluated.** The launcher builds the module
     function applied to its capabilities and inputs and hands it to
     `kernel.check` once. Nothing is filled and nothing is advanced. Every
     input is a fresh cell. A capability the check names is not needed:
     a structure with an entry for each part, each a composed function of
     as many parameters as the part's primitive takes, whose body is the
     empty structure. Every other declared capability is a fresh cell, not
     yet given. The budget is the configuration's `steps`, or
     `Number.MAX_SAFE_INTEGER` where none is set. A test with a recording
     target holds that no part of any capability's implementation is
     called under a check.
  3. **How a check ends.** `refuted` where the whole is refuted, a claim
     has a refuted evaluation, or `refutations` has an entry. The reasons
     are, each once and in this order: the reason of the whole, the
     reasons of the refuted claims, the reasons of the refutations.
     `limit` where the budget ran out and nothing was refuted, with the
     reason a run gives. Otherwise the check is over: the launch goes on
     to the next phase, or ends `completed`.
  4. **The phase after a check is an ordinary run**: a fresh `evaluate` of
     the module function in the same kernel, with what that phase
     supplies, under the budget a run alone has. The rule that a phase
     after the first may name no capability counts from the first phase
     that is no check. The inputs are checked in the phases of the run, so
     the run's inputs are said to be supplied "at the start".
     `linesBeforePhase` counts the run after a check as a later phase, so
     the corpus runner reads a `// later:` line one entry further on under
     `check, run`.
  5. **Each phase has its own result.** `phases` gives the check's and the
     run's. The run's claims are summed apart from the check's, and the
     outcome's `result` is the run's. `LaunchResult` gains `refutations`,
     `{reason, place?}`, empty where there are none; its comment says only
     a check gives any. A test holds the refutation of a name nothing binds
     in a function nothing calls. The launcher refuses a module with a free
     name at loading, so the test uses a record of the first version, which
     makes no module.
  6. **The lines and the end** of `check, run` are the run's where the
     check found nothing. Where the check ends the launch nothing was
     performed: no line is printed and no request made.
  7. **The setting.** `PHASE_VALUES` of `next/tools/configuration.ts` is
     `run`, `check` and `check, run`. `check` is a check phase that names
     the check capabilities the ceiling grants. `check, run` is that phase,
     then a phase `run` with every capability of the ceiling and the
     inputs, then one phase `later` for each entry of `later`. `inputs` and
     `later` with `check` alone are no finding, and the list of sources
     names them as before. The finding for `later` with `check` alone is
     withdrawn, and so is the finding that `check, run` is not built.
  8. **Both commands** take `--phases check,run`. The exit code follows
     the end and the status as before. Under `check` alone a call on
     `report` is not performed, so no message is written and no status
     handed over.
  9. **The corpus convention.** `// phases: check, run` is built. The
     `// claim at:` and `// summary:` lines hold for the last phase's
     result. `// check claim at: <line>:<column> <word>` states a claim's
     word in the check's result where the phases are `check, run`; with
     other phases it fails the program. The README's section "Phases"
     says both.
  10. **The launcher adds no analysis.** It hands the kernel one
      expression and sums what the kernel reports.
  11. **The path that is left.** A first phase that is no check and does
      not supply a declared capability still hands a cell and may end
      `waiting`. Its tests stand unchanged, and the launcher's header says
      that nothing shipped uses it.
  - **What the kernel did that its interface does not say.** The two
    variants gave the same in every case below.
    - *A check leaves its claims' level of waiting standing.* After
      `check`, `waiting()` is empty, and a later `evaluate` in the same
      kernel reports for a claim the check left waiting the level the check
      left. Smallest case, through the interface: `f = composedFunction([x],
      claim(x))`; `check(f(cell))` gives the record decided 0, waiting 2;
      then `evaluate(f(true))` gives decided 1, waiting 2, where a fresh
      kernel gives decided 1, waiting 0. So under `check, run` a claim the
      run decides comes out `waiting` in the run's result, and the run's
      summary is undecided where run alone gives decided:
      `capability output` and `output.write("ok")` shows it. The launcher
      sums the counts apart, as point 5 says, and takes the level as the
      kernel gives it. No test and no program holds the level.
    - *A claim through a call of a composed function waits.* The measured
      table's last row, `claim(sum(2) == 4)`, is one case of it. The
      smallest program: `capability output`, `square(n) => n * n`,
      `claim(square(7) == 49)`. The check gives the claim one decided
      evaluation and one that waits, so its word is `waiting`, though
      nothing in it is unknown and a run decides it. `claim(7 * 7 == 49)`
      is decided. So `phase-check-prints` no longer says its claim is
      decided.
    - *A function held as an entry or an argument is not opened.*
      `capability output` and `x = [n => claim(1 == 2)]`: the check
      completes with no record of the claim. The same where the function
      is an argument that nothing calls: `k(f) => 0`,
      `y = k(n => claim(1 == 2))`. A function a block binds is opened.
      The decision says a claim is never passed over, and the interface
      says the check evaluates the body of every function met.
    - *A claim on a call of a capability that is not needed waits.* The
      check evaluates the module function again with its parameters
      unknown, by the first ruling of 2026-11-23. There the capability is
      unknown, so the claim a dropped `report.message("note")` stands for
      has one decided evaluation and one that waits. Its word is
      `waiting`, as with a cell. The stand-in shows in the counts, and in
      a claim the empty structure refutes: `x <- note.message("n")` and
      `claim(count(x) == 1)` are refuted under the stand-in and wait under
      a cell.
  - **What building showed against the points.** Point 2: by the last
    finding, not needed decides no claim's word under check that not yet
    given leaves waiting. Point 5: by the first finding, the run's result
    after a check holds the check's level of waiting. Point 8 says nothing
    either command prints changes; the message of `--phases` given no
    list now names `check,run` beside `run` and `check`.
  - **The existing programs changed.** In
    `next/corpus/allegretto/m3/`:
    - `phase-check-prints.alg`: `// end: waiting: the program waits on
      the capability(ies) output, which no phase supplies` became
      `// end: completed`. Its comment said the program has no capability,
      the claim is decided and the run ends waiting; it now says the
      kernel's check evaluates it, output is not yet given, the claim is
      reached, and the check finds no refutation.
    - `phase-check-refuted.alg`: its comment adds that the check ends the
      launch and that nothing is performed under check. Its lines stand.
    - `phase-check-bound.alg`: in its comment, "which no phase supplies"
      became "which is not yet given under check". Its lines stand.
    - `report-check.alg`: `// reports: warning: checked` is gone, since
      no message is handed over and a program that states none is not
      compared; `// status: 2` became `// status: 0`; `// end: waiting:
      the program waits on the capability(ies) output, which no phase
      supplies` became `// end: completed`. Its comment says report is
      not needed under check. A test holds that it hands no message.
  - **The existing tests changed.**
    - `next/launch/launcher.test.ts`. "both commands take --phases": under
      `--phases check` the fixture gave stderr `waiting: the program waits
      on the capability(ies) output, which no phase supplies` and exit 1,
      and gives nothing and exit 0, from both commands; `--phases
      check,run` gave the finding that it is not built yet and exit 1, and
      gives `hello, world` and exit 0; the value not built lists
      `"check, run"` too; the message for `--phases` with no list said
      "run or check" and says "run, check, or check,run". "npm run
      allegretto under --phases check": the project's file setting check
      gave the waiting line and exit 1, and gives nothing and exit 0.
      "both commands under --phases check": stderr `warning:
      checked` and the waiting line, exit 4, became nothing and exit 0;
      its name says report is not needed. The comment of the section on
      phases says that its phase `CHECK` is no check.
    - `next/tools/configuration.test.ts`. The values of the setting
      phases list three, and each check phase has `check: true`. The test
      that `check, run` is a finding became a test of what it resolves to,
      from each source. The test that `later` with `check` alone is a
      finding became one that `inputs` and `later` with `check` alone are
      none, and the values not built list `"check, run"`. The test value
      of phases for the environment was `["check"]` and is
      `["check", "run"]`.
    - `next/launch/report.test.ts`. "under check alone the phase supplies
      report": the messages were `warning: checked`, the status 2 and the
      end waiting; they are none, 0 and completed, and the test adds the
      same program under `check, run`, where the run's calls act.
    - `next/corpus/allegretto.test.ts`. "a program with a phases line":
      its program's end was waiting and is completed, and run alone is
      told apart by its printed line. "a malformed phases line": the
      cases of `check, run` and of `later` with `check` alone were
      findings, and are now launched; the value not built lists three.
      "the runner grants report": the program stated a message and the
      waiting end, and states status 0 and the end completed.
  - **The new programs.** Eight, under `next/corpus/allegretto/m3/`,
    none with a `// realises:` line. The cases of the present evaluator's
    Rule 2 (B-172 (the partial-evaluation rules as implemented against the spine)) are about its residual and its
    effects, which no program here shows. `check-uncalled` (a false claim
    in a function nothing calls), `check-unknown-condition` (one under a
    condition on an unknown input), `check-input-waits` (a claim over an
    input waits, one over nothing unknown is decided, the launch
    completes, the summary undecided), `check-dropped-write` (a false
    claim after a dropped write, nothing printed), `check-report` (report
    not needed: no message, status 0, the claim after the calls decided),
    `check-run-prints` (the lines and end of run alone),
    `check-run-refuted` (nothing printed, where run alone prints the line
    first), `check-run-input` (the input unknown to the check and given to
    the run).
  - **Measured.** `npm run test:next` runs 926 tests on the default
    kernel and 925 with `ALLEGRO_KERNEL=reference`; all pass but one
    marked to do on each. 24 tests are new on each: 16 written here and
    one for each of the eight programs. `npm run harness:next` runs 118
    programs, and all pass on both variants.
- **2026-11-23 — A result names a claim's key and its place as the kernel does.**
  The entry "Places" above built the result with `at` for the claim's
  key and `place` for where it was written, and said the kernel's record
  names the two the other way round. This stream asked the maintainer
  which names a result keeps, and recommended the kernel's. The
  maintainer, in session, on 2026-11-23: "1-3: I agree with your
  recommendations". So `ClaimResult` has `key`, the claim's key, and
  `at`, the plain data of `ClaimRecord.at`. Nothing else changed: no
  command prints either, the `// claim at:` line reads as before, and
  no program changed. Three assertions read the fields under their new
  names and hold what they held: the two that match a key against
  `sha256:` and 64 hexadecimal digits, and the ones that read a place.
- **2026-11-23 — Fifteen asks answered by the maintainer.**
  This stream put fifteen asks to the maintainer in session, grouped by
  PR #304 (a claim's place in a result), PR #306 (the launcher's check),
  the session and older housekeeping. The answers, in the maintainer's
  words, each with what this stream does on it:
  1. *The names of a claim's key and place in a result* (the kernel's
     names recommended), *the word for one claim* (`claimWord`, six
     words, as built) and *the corpus line `// claim at:`* (as built):
     "1-3: I agree with your recommendations". The entry above made the
     rename. A refutation in a result names its place `at` too.
  2. *A module's calls on `report` are not performed under check*
     (ask 4): "The solution arrived at in the kernel session changes the
     approach and naming for the check phase. `check` is now a kernel
     method that behaves similarly to `specialize` - it performs no
     effects, analyzes every reachable branch, returns a program
     specialized via PE. So `report` methods have little use there. The
     `check` method only performs some of the work of a full check
     phase, the rest is performed by the launcher on information passed
     from the `check` operation and via the host-side hook. As you say,
     the goal is to keep the launcher simple, so the actual checks are
     performed by a host-side module configured for a project's specific
     requirements. In the long term this host-side module will be
     implemented in Allegro, but for now you can implement it in host
     code to test the process." So the calls stay unperformed under the
     kernel's `check`, as built. The module that performs a project's
     checks on what `check` returns and on what the hook tells is not
     built: its shape is a proposal this stream owes.
  3. *How a check ends* and *the launcher's form* (asks 5 and 6): "5 &
     6: I agree with your recommendation." Both stand as built: any
     refutation ends a check refuted, a budget that runs out ends it at
     its limit, and a check that leaves claims waiting passes.
  4. *Inputs and later phases given with check alone are no finding*
     (ask 7): "Can you clarify this ask?" Answered in session: before
     PR #306 a project file that named later phases was refused when
     the command line asked for check alone, and an input given under
     check ended the launch waiting on it. Now a check leaves every
     input unknown, so neither setting is an error of the configuration.
     The maintainer, in session, on 2026-11-24: "PR#306 ask 7 - I agree
     we should allow the command line to specify check alone." So it
     stands as built, and every ask of PR #306 is answered.
  5. *The corpus line `// check claim at:`* (ask 8): "Agreed."
  6. *The four findings on the kernel's `check`* (ask 9): "Do you have
     examples for these four findings in the current acceptance tests?
     Please give the examples for each and I'll take them to the kernel
     session." No test of this stream holds them, by the rule that a
     test here never fails because the kernel gains something. The
     examples are in the entry "Q13, part 5" above and were given in
     session.
  7. *Does a run supply `report`* (ask 10): "The main use case for
     `report` is in the test phase. For Allegretto programs, the test
     phase is at least as important as the check phase. Let's implement
     it right away. `report` may still be of use to the run phase, but
     we need strong use cases for that to be a priority." So the test
     phase is this stream's next chunk. A run keeps supplying `report`
     as built, and nothing more is built on that.
  8. *The terms* (ask 11): "To clarify these terms perhaps we need
     different names for the `check` kernel method and the check phase.
     The capabilities should be named for the phase. For "held claim" go
     ahead and use the term "a claim that waits"." From this entry on
     the record says "a claim that waits". The entries before it keep
     their words. The two names are a proposal owed to the maintainer,
     and the kernel method's name is the kernel stream's.
  9. *The decision map* (ask 12): "I agree, let's hold them until we've
     resolved these questions." The four rows stay as they are.
  10. *The co-author line* (ask 13): "Agreed". *Branches* (ask 14):
      "I'll tidy up the branches".
  11. *`CLAUDE.md` and the choice of kernel* (ask 15): "Go ahead with
      the PR to update Claude.md. Let's standardize on command line
      only." This stream reads the second sentence as: the kernel
      variant is chosen on the command line and by the launcher, as the
      decision has it, and never from the environment. It builds
      `--kernel` on its commands and tells the kernel stream that the
      reading of `ALLEGRO_KERNEL` in `next/kernel/create.ts` is theirs
      to remove. The reading is put to the maintainer for confirmation.
- **2026-11-23 — Q13, part 6: the test phase, first version.**
  B-196 (the rebuild's acceptance side), chunk Q13 (check and run as
  configurations, and what a result holds). The maintainer, in session on
  2026-11-23: "The main use case for `report` is in the test phase. For
  Allegretto programs, the test phase is at least as important as the
  check phase. Let's implement it right away." So the launcher gains a
  test phase. It realises "A test is a claim, and its result is the
  claim's record", and the third phase of a check in the note of
  2026-11-23: running tests is ordinary evaluation, and a test run may be
  given test versions of capabilities. The names and forms are this
  stream's proposal, for the maintainer to ratify. The twelve points, as
  built:
  1. **The phase.** `Phase` of `next/launch/launcher.ts` gains
     `test?: true`. A test phase is the first phase, or the second after a
     check, and no phase follows it. Each other place is refused before
     anything is evaluated: "the phase <name> is a test phase after a
     phase that is no check: a test phase is the first phase, or follows
     a check", "the phase <name> follows the test phase <name>: no phase
     follows the tests", and "the phase <name> is both a check and a test
     phase". `check, test` is a check of the test module as `check, run`
     has it, and then the test phase, in a fresh evaluation.
  2. **A test module is an ordinary module.** The notation and the forms
     gain no line.
  3. **A test** is an entry of the structure the module yields, keyed by
     a symbol, whose value is a composed function of no parameters. Its
     name is the key. The tests are taken in the order the structure holds
     them. The launcher reads each entry by an evaluation of the kernel's
     `get` on the structure and the key's name as data, and tells a test
     by `kind` and `composedFunctionOf`. `entriesOf` alone does not tell
     it: an entry's value there is the name of its binding, a symbol, as
     the forms' "evaluated when the entry is read" has it. An entry with
     no key, or keyed by a key, is not read.
  4. **How a test phase evaluates.** The module function is called once
     with the capabilities and inputs of the phase: the load. It is
     advanced as a run is, with no later phase. Reading the entries is
     part of the load. Where the load does not complete, the phase ends as
     it ended, and no test is called. Then each test is called in order,
     in the same kernel and of the same module instance, by an evaluation
     of its own of the function applied to nothing, under the launch's
     budget, and advanced until its evaluation is over or nothing more is
     due. Its claims are summed in fresh tallies. When an evaluation of
     the phase is over, the answers it asked and has not had are not
     filled, and what it waited on is not waited for by the next one,
     unless the next one's own value is still a residual.
  5. **The outcome.** `LaunchOutcome` gains `tests`: `{load, tests}`.
     `load` is a `LoadOutcome`, `{end, lines, result}`. Each test is a
     `TestOutcome`, a `LoadOutcome` with its `name`. `PhaseOutcome` is
     unchanged: the test phase has one entry, named `test`, whose result
     is the load's. The launch's `end` is `completed` where the load and
     every test completed, with the steps of all summed. Otherwise it is
     the end of the first that did not complete, the load first. Its
     `lines` are the load's and then each test's, and its `result` is the
     load's.
  6. **Test capabilities.** The launcher takes the target as given. The
     terminal's target for a test phase is `testTarget` of
     `next/launch/terminal.ts`: `output` as in a run, with no line printed
     while the tests run; `timer` on `virtualClock`; `http` on
     `scriptedTransport` serving nothing, so every request answers
     `unreachable` with the reason "nothing serves <method> <url>"; and
     `report` as in a run. The virtual clock and the scripted transport
     were already in `next/launch/` (`clock.ts`, `scripted-transport.ts`),
     so nothing moved.
  7. **What the commands print.** `testLines` of the new
     `next/launch/test-output.ts`: `test <name>: passed`, or `test <name>:
     <the end>` with the test's lines under it, each indented by two
     spaces, and `tests: <n> passed, <m> failed`. Where the load did not
     complete, the commands print what a run prints: the load's lines on
     stdout and the end on stderr. Where the check before the tests ends
     the launch, they print what a check prints.
  8. **The exit code** is `exitCode` as before: a failing test exits 1
     with no status handed over.
  9. **`report` under test** acts as in a run. The terminal hands one
     message for each test that ended refuted, through the same sink
     (`testMessages`): level `error`, `test <name>: <the first reason>`,
     and the place of the first claim of its result whose word is
     `refuted` and which has one. The launcher hands no message.
  10. **The setting.** `TEST_PHASE_VALUES` of
      `next/tools/configuration.ts` is `test` and `check, test`;
      `PHASE_VALUES` keeps the three values that run the program. `test`
      is a phase `test` with `test: true`, every capability of the ceiling,
      and the inputs, which go to the load. `later` given with a test phase
      is a finding: "the setting later is given with the phases "<value>":
      no later phase follows the tests". An empty list of later phases is
      none.
  11. **The corpus convention.** `// phases: test`, `// phases: check,
      test`, and `// test: <name>: <end>`, with `passed` for a test that
      completed. A program that states any `// test:` line must state
      exactly the tests called. The `// expect:` lines are the load's and
      every test's lines, in order. A `// test:` line with phases that are
      no test phase fails the program. The README gains the section
      "Tests". A run gives the outcome of the tests (`ProgramRun.tests`).
  12. **Not built.** Coverage from the kernel's hook (`Kernel.observe`);
      the host-side module that performs a project's own checks on what
      `check` returns; a setting that names the test modules of a
      project; real capabilities under test; test versions a project
      supplies.
  - **What the kernel did that the forms or its interface do not say.**
    - *Reading an entry evaluates its binding.* `entriesOf` of the
      structure a module yields gives each entry's value as a symbol, the
      binding's name, on both variants: `capability output` and `export
      a() => claim(1 == 1)` give the entry `` `a `` with a value of kind
      `symbol`. So a host tells a function only by reading the entry with
      `get`, which evaluates the binding. The forms say an entry's value
      is evaluated when it is read; the interface's `entriesOf` says
      nothing of it. A test of the emitter already reads an entry the same
      way.
    - *The reference kernel's stack holds a tail call.* `capability
      output`, `loop(n) => if n == 0 then 0 else loop(n - 1)` and
      `output.write(int.text(loop(500)))` print `0` on the default kernel,
      and end at the reference kernel's own limit with no budget set. The
      forms say a call that is the value of the function's body takes no
      space. The interface allows the reference kernel a limit of its
      own, its host's stack. The budget test uses `loop(200)` under a
      budget of 200 steps, which both variants end at the budget.
    - *Under `check, test` a claim's level of waiting carries into the
      tests*, as the entry "Q13, part 5" found for `check, run`. The tests
      hold a test's end and its claims' counts above zero there. No
      carrying was found between two ordinary evaluations in one kernel:
      two tests that reach one claim of a function both call each give it
      a decided count and a level of zero, on both variants.
  - **What the launcher does that the decisions do not say.** A test
    that ends at its limit before its claim is evaluated has no record of
    the claim, so its summary is `decided`; its end says `limit`. A test
    whose value is a failure completes and passes: its value goes to
    nobody, and the statement that is its body's last is not claimed.
  - **What building showed against the points.** Point 3: a test is told
    only by reading the entry, and reading evaluates the binding. So in a
    module that marks no export, a binding nothing had read is evaluated
    at the load, with its effects: `capability output` and `h =
    output.write("bound")` print `bound` under a test phase, where a run
    prints nothing. Point 4: an answer an earlier test asked and did not
    get is not filled in a later test, so a later test that reads the
    same binding of the module instance ends waiting on it. With
    `capability timer`, `x = timer.wait(10)`, `export t1()` whose body is
    `v <- x` and `claim(1 == 2)`, and `export t2() => claim(x == 10)`,
    `t2` ends waiting on one cell that no capability will answer, on both
    variants.
  - **The existing tests changed.** The finding for a value of the setting
    `phases` that is not built names the values built, and now lists
    `"test"` and `"check, test"` after the three: one assertion each in
    `next/tools/configuration.test.ts` ("a value of phases that is not
    built"), `next/launch/launcher.test.ts` ("both commands take
    --phases") and `next/corpus/allegretto.test.ts` ("a malformed phases
    line"). The message for `--phases` with no list said "run, check, or
    check,run" and says "run, check, check,run, test, or check,test"
    (`next/launch/launcher.test.ts`, the same test).
  - **The new programs.** Eleven, under
    `next/corpus/allegretto/m3/`, none with a `// realises:` line: no case
    of `next/corpus/cases.json` names a decision on tests.
    `test-pass-fail` (three tests pass, and one is refuted at its claim's
    place, with the next still called), `test-exports` (a function with a parameter,
    a function not exported and a number are no tests), `test-open` (no
    export marked: every function of no parameters), `test-none` (no
    test), `test-load-refuted` (a false claim at the top level: no test
    called), `test-prints` (every line collected; the commands show only
    the failing test's), `test-timer` (a wait of a day ends at once),
    `test-http` (the request answers `unreachable`, and the test handles
    it), `test-report` (a message, and the highest status across the
    load and the tests), `test-import/main.alg` (imports
    `test-import/arith.alg` and tests its `gcd`), `test-check` (`check,
    test`: a false claim in a function no test calls ends the launch).
  - **Measured.** `npm run test:next` runs 969 tests on the default
    kernel and 968 with `ALLEGRO_KERNEL=reference`; all pass but one
    marked to do on each. 43 tests are new on each. `npm run
    harness:next` runs 129 programs, and all pass on both variants.
- **2026-11-24 — The nine asks of PR #313 answered: the test phase stands as built.**
  This stream set out the nine asks of PR #313 in session, each with a
  run of the PR's head and a recommendation. The maintainer, in session,
  on 2026-11-24: "1-9: I agree with your recommendations." And: "On ask
  3 - I can see some value in making (b), each test gets its own module
  instance, an option available via configuration. Not a priority now,
  we can revisit later if the need arises." What that settles, by ask:
  1. *What a test is.* A function of no parameters among what a module
     yields, named by its binding. A test passes when its evaluation
     completes, whether or not it evaluated a claim. Flagging a test
     that evaluates no claim is left as a later check.
  2. *How tests are evaluated.* One load, then each test by its own
     evaluation in the same kernel and of the same module instance, each
     with the step budget to itself.
  3. *An answer a finished test did not wait for* is dropped, as built.
     A fresh module instance for each test may become an option of the
     configuration later. It is not built and has no date.
  4. *The test versions of capabilities* the terminal gives. Serving
     canned answers to a project's tests through `http` is the first
     addition named, and is not built.
  5. *What the commands print and hand over*, the load's lines not shown
     for a passing run and a status handed through `report` standing
     where every test passes included.
  6. *The setting's values* `test` and `check, test`.
  7. *The corpus lines.*
  8. *Finding the tests evaluates the bindings read.* Accepted: a test
     module is written for the test phase. This stream carries to the
     kernel session the question whether a host can tell what a binding
     is without evaluating it.
  9. *The terms* "test module", "the load" and "test version of a
     capability" are ratified.
  The same day the maintainer answered the last ask of PR #306, and
  PR #304, PR #306 and PR #311 merged.
- **2026-11-25 — The command line alone chooses, and six names the emitter writes.**
  The maintainer, 2026-11-23: "Let's standardize on command line only."
  And on 2026-11-25: ""command line only" means `ALLEGRO_STEPS` should
  be removed." On the kernel stream's PR #316, as that stream's record
  has it (`docs/plans/book-pass.md` §7, the entry of 2026-11-28): "the
  acceptance stream adds the six names to its emitter." What is built:
  1. *Six names.* The emitter writes the shipped primitives
     `text.byte`, `text.span`, `text.starts` and `text.until` by their
     names, as it writes `text.int` (`SHIPPED_NAMES` of
     `next/bootstrap/emit.ts`), and the kernel primitives `specialize`
     and `sample` as it writes its other kernel names (`KERNEL_NAMES`
     and `KERNEL_WRITTEN`). The emitter's test of what waits against
     the kernel passes with no todo. Two tests beside it hold each of
     the six by its name and by what the record holds. Three programs
     under `next/corpus/allegretto/m3/` use them: `text-terminals.alg`,
     `specialize.alg` and `sample.alg`, the first program of the corpus
     that states `// summary: sampled`. `next/ext/allegretto/forms.md`
     does not state the six; that file is the kernel stream's.
  2. *`--kernel <name>`* on `npm run launch`, `npm run allegretto`,
     `npm run harness:next` and `npm run bench:next`. The name is one of
     `KERNEL_VARIANTS` of `next/kernel/create.ts`, and each command
     makes its kernel by `createKernelOf`. With no flag the variant is
     the launcher's default, `machine`, stated once as `DEFAULT_KERNEL`
     of `next/launch/kernel-variant.ts`. The two terminal commands
     resolve it as the setting `kernel`: the command line's value, else
     the launcher's, so the result's `restsOn` names the variant and the
     source of the setting. A project file that sets it is a finding. A
     name that is no variant is refused before anything is evaluated,
     with the variants listed, exit 1. The bench names the variant it
     ran from the flag.
  3. *No setting comes from the environment.* `readEnvironment`,
     `STEPS_VARIABLE` and the source `"environment"` are removed. The
     sources are the command line, the project's file and the launcher.
     A test end to end holds that with `ALLEGRO_STEPS` set each command
     runs as it does without it.
  4. *This stream's tests on both variants, with no environment.*
     `next/launch/kernel-variant.ts` gives the tests their kernel
     factory, `createKernel`, of the variant in use, and the driver,
     `runProgram`, `yieldedKeys` and `runNew` take a factory with it as
     the default. `next/launch/reference-run.ts` switches it to the
     reference with `useVariant` and loads this stream's thirteen test
     files that make a kernel. A test that spawns a command passes
     `--kernel`. `npm run test:next` took 70.9 s for 1,035 tests before,
     on the machine alone, and 21.8 s more for the run on the reference
     with the variable. With both variants in one command it took 72.6 s
     for 1,540 tests on this stream's machine. In CI that load slowed a
     test of the kernel stream that holds a time, a module of 200 lines
     read in under 10 seconds: 4.1 s on main, 9.2 s with this change, and
     12.5 s, a failure, with the next chunk's tests added. So the run on
     the reference is a command of its own, `npm run
     test:next:reference`, which CI runs after `npm run test:next`. The
     file's name does not end in `.test.ts`, so the first command's glob
     leaves it out.

  The assertions removed are those of the environment source, in
  `next/tools/configuration.test.ts` and `next/launch/launcher.test.ts`:
  the test that the environment gives the step budget from
  `ALLEGRO_STEPS`, whole; the check that `readEnvironment` of no
  variable sets nothing; the environment's budget under and over a flag
  in the test of `allegro.json`; and the environment's budget and its
  finding in the test of how `npm run launch` resolves. The tests that
  counted four sources count three.

  The kernel stream's files still read the variable, for their own
  tests: `next/kernel/create.ts` reads it in `chosenVariant` and
  `createKernel`, and `next/kernel/reference.test.ts` sets it. Through
  those two, `next/kernel/kernel.test.ts`,
  `next/kernel/saved-program.test.ts`, `next/prims/prims.test.ts`,
  `next/ext/ext.test.ts`, `next/ext/readers.test.ts` and
  `next/ext/readers.ts` depend on it. Of `next/kernel/create.ts` this
  stream's code uses `createKernelOf` and `KERNEL_VARIANTS` alone.
