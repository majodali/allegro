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
| Q1 | **The decision map.** `next/decisions.json`, generated once from the inventory: one row per decision with its part, chapter, type, status against the present code, owning stream, state (none), unit and cases. Its check, `next/tools/decision-map.ts`, run as `npm run lint:decisions`: every decision of the inventory has exactly one row and every row a decision; an owner is R, Q or none; a state other than none names a path that exists. A CI step for the new tree's commands | the check passes on 231 rows; a probe with a row removed fails it | merge on green |
| Q2 | **The corpus, inventoried and classed.** `next/corpus/cases.json`: every [case](#def-case) with its source, its text and its [class](#def-class); a *changes* case names its ruled decision and states the new result; each case that survives or changes lists the decisions it tests, and the decision map's rows gain them. Its check: every pin and every test of the present tree has exactly one case | the check passes; the counts of §2 are met | merge on green; classes reviewed at their milestone (program plan, P5) |
| Q3 | **The scenarios.** Each of the eleven scenes of rungs 1 to 4 as a [scenario](#def-scenario) under `next/corpus/scenarios/`, with the cases that realise it and the milestone that must pass it | every scene has a scenario; every scenario names a milestone | the maintainer |
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
    value keeps its origin" and "An extension registers its own fields;
    the kernel has two".
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
    declares" and the data form have it, and the scope is empty. There
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
