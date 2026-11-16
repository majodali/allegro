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
| Q5 | **The first notation and the bootstrap.** The first notation is Allegretto, whose forms the kernel stream's `next/ext/allegretto/forms.md` rules (amended 2026-11-16); under `next/bootstrap/`, a grammar for it made from the present base grammar, a reader of the present parser engine's parse tree, and an emitter that writes a saved program in the data form | the emitter's tests against the interface file's types; a round trip on fixture programs | the notation: the maintainer (a contract). The emitter: merge on green |
| Q6 | **The comparison harness.** Under `next/corpus/`. On the present tree it runs each pinned program and compares its printed lines with its pins by class. On the new tree it runs every Allegretto program under `next/corpus/allegretto/` and reports, per milestone, the cases those programs realise: a case is shown by an Allegretto program that passes, with the present expectation, or the case's stated new result where its class is *changes*. A program may hand a standard-language text to the parser engine once that engine exists in Allegretto (amended 2026-11-16, by the maintainer's ruling that the tests and code of milestones 4 to 7 are written in Allegretto) | its tests on a stub kernel, then on the kernel | merge on green |
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
