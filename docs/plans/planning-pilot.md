# The planning pilot: rung 3 of the demo ladder

> **Status: active** (K-007). Created 2026-10-25 from B-079 (the
> planning-DSL revalidation). The design truth is `docs/book/vivace/planning-dsl.md`;
> this plan is the intent: stages, chunks, the rulings it asks for, the
> proposal for Vision §4, and the chunk log. It is sequenced ahead of
> B-146 (knowledge propagation), B-145 (type vocabulary), B-111 (field
> versus channel registration) and B-136 (scope leaves `Value`) by the
> maintainer's ruling of 2026-10-25 ("continue on track to get to rung 3
> as quickly as possible").
>
> **Reader.** The maintainer, to rule; the agent that builds each stage.
> Terms: *plan*, *plan node*, *wiring* and *failure handler* are defined
> in the chapter; *rung* is the demo ladder's (`release-track.md` §5).

## 1. Context

Rung 3 is the hypothesis test: one domain model with rich constraints,
solution finding over it, failures a non-programmer can read (Vision
§4; `release-track.md` §5). The archived v1 design chose the planning
DSL as the first pilot and settled its model and conventions; B-079
revalidated it (the chapter). What remains is to build it, in the
primitive form first.

Three rulings taken on 2026-10-25 shape the sequence:

- The planning DSL is the right first pilot.
- The renderer hook (B-081) is delayed: the primitive version of the
  DSL is tested with the diagnostics as they are, and rendering is an
  incremental improvement after.
- B-136 (scope leaves `Value`) and the book's evaluator chapter are
  deferred the same way.

## 2. Settled decisions

From the chapter (B-079) and the rulings above:

1. Shape 1: specify and verify in Allegro; execution external.
2. The twelve conventions and the SoftwareRelease example as the
   design target (chapter §3, §5).
3. **Library before surface.** `lib/planning.alg` is built and tested as
   plain Allegro (plans constructed through the library's API) before
   the `plan NAME:` grammar, because the surface is the first
   offside-rule fragment and may surface engine work, and because the
   model is what rung 3 tests.
4. **Two enforcement shapes** for well-formedness: construction yields
   an error value in domain terms; annotation halts (chapter §7).
5. No renderer hook until the primitive version has been exercised.

## 3. Rulings requested

| # | Question | Options | Recommendation |
|---|---|---|---|
| **R1** | How are effort (person-hours) and money measured? The units DSL encodes SI dimensions only | (a) planning-local `Effort` and `Money` types, refinement-typed numbers with their own arithmetic; (b) generalise `lib/units.alg` to named base dimensions beyond SI; (c) represent all three measures as plain numbers in the first stage | **(a)** now. (b) is a units design question that the physics pilot may want anyway; take it there. (c) loses the dimensional error the rung-2 bridge exists to show |
| **R2** | Wall-clock durations: the units DSL's time dimension, or planning-local? | (a) reuse `lib/units.alg` (`30 min` is already a quantity); (b) planning-local `Duration` | **(a)**: it is the bridge from rung 2, and it costs nothing |
| **R3** | What does solution finding mean for a plan? | decided at stage D from the pilot's own constraints, not now | defer, as Vision §4 directs ("don't over-design ahead of evidence") — **taken 2026-10-26**: choice, not inference. A node with options; a template; search over the resolutions for the best that passes every check, budget included (chapter §2.7, §7). Scheduling, completion from a catalog and retry tuning weighed and deferred; library enumeration first, kernel residuals considered at D2 |
| **R4** | Vision §4 amendment (Tier 0): name the pilot roster and the Shape 1 / Shape 2 staging | land §7's text, amend it, or decline | land it, since the rung is being built against it — **taken 2026-10-25, landed in `docs/book/vision.md` §4** (the maintainer noted the text becomes obsolete once the pilots have run) |

## 4. Stages and chunks

| Stage | Chunk | What lands | Exit measured by |
|---|---|---|---|
| **A. The library** | A1 ✅ **landed 2026-10-25** | `lib/planning.alg`: the types (Plan, PlanNode, Port, Fixture, Estimate, Retry, Handler) as `Type.define` records; construction through the library's API; a demo `tests/planning-core-demo.alg` building `BuildPipeline` by hand | the demo is suite-pinned; the types print and compare — **met** |
| | A2 ✅ **landed 2026-10-25** | Wiring derivation and the graph checks: acyclicity, wiring completeness, type compatibility, composite resolution; each failure an error value in domain terms | demo lines for each check passing and each check refusing a deliberately broken plan — **met** (`tests/planning-checks-demo.alg`: the worked example clean, five broken plans refused) |
| | A3 ✅ **landed 2026-10-26** | Estimates and budgets: durations through the units DSL (R2), effort and money per R1; rollup with retry upper bounds; the budget check | `SoftwareRelease` built through the API with its budget discharged; a budget-exceeding variant refused — **met** (`tests/planning-budget-demo.alg`: the example with every estimate, budget discharged; refused at the plan, at a composite, over money, and for wrong measures) |
| | A4 ✅ **landed 2026-10-26** | Failure handlers: `on <FailureType>` graphs, handler validity, re-escalation as a graph property | both handlers of the worked example checked — **met** (`tests/planning-handlers-demo.alg`: both handlers clean, escalation rendered, the bound with handlers, three handlers refused) |
| **B. The surface** | B1 ✅ **landed 2026-10-26** | The grammar fragment: `plan NAME:` with offside blocks, `inputs:`/`outcomes:`, bracket constraints, `estimate:`, `budget:`, `retry:`, `fails:`, `instructions:`, `on`, `uses`; the statement form expands to an annotated binding (halts on failure) | `tests/planning-release-demo.alg` is the worked example verbatim, suite-pinned; the first offside-rule fragment works or the engine gap is named — **met**: it works, after three engine gaps were closed in the chunk (chunk log) |
| | B2 ✅ **landed 2026-10-26** | Cross-file `uses` through `import`; the archived item 4 | the worked example split across two files — **met** (`tests/planning-split-demo.alg` borrows `tests/lib/build_pipeline.alg`; no engine work) |
| **C. Legibility** | C1 | B-081 slice: the renderer hook, now with evidence of what the messages must say | the demo's refusals read in planning vocabulary |
| **D. Solution finding** | D1 ✅ **landed 2026-10-26** | Define it from stage A's constraints (R3): choices with options (convention 13), templates, `solve` by enumeration with the bound as objective, counterexamples naming the cheapest resolution | one solved plan in the demo — **met** (`tests/planning-solve-demo.alg`: the worked example solved under three budgets, refused under a fourth, unsound choices refused) |
| | D2 ✅ **landed 2026-10-27** | A larger search, decided on D1's evidence (maintainer, 2026-10-27, three rulings): completion from a catalog (the AI-loop shape; chapter §2.8, convention 14), the gap being the existing wiring or outcome finding, library first with chaining to a depth; the enumeration checks the template once; the kernel's residuals weighed and not taken (chapter §7) | a plan with a gap completed from a catalog and solved — **met** (`tests/planning-complete-demo.alg`: an order completed from leaves, a choice and a borrowed plan; solved under a deadline; refused at a dead end, at the depth, over the budget, and for an unsound completion) |
| | D3 | Branch-and-bound over partial resolutions, when a template outgrows enumeration; a surface form for catalogs | not before a pilot plan needs either |
| **E. Packaging** | — | B-093: the public story, the claims register, `demos/rung3`, the website loop | owner's deploy |

Stage A is the primitive version the maintainer asked for. Stages are
ordered; chunks within a stage may merge if small. Each chunk follows
PROCESS §3: land, summarise, stop for the gate.

## 5. Verification

Per chunk: `scripts/typecheck.sh`; the full sharded suite, which pins
every `tests/*.alg` demo by `// expect:` and runs the plane and units
lints; `npm run lint:docs` and the doc-ref lint when documents change.
The pilot's demos are the oracle: every check has a passing line and a
refusing line. Stage B additionally runs the grammar analyzer over the
fragment.

## 6. Documents to update on landing

- Per stage: `docs/book/vivace/planning-dsl.md` §6 (what Allegro
  provides) and §9 (status); this plan's §8 chunk log; `docs/CHANGELOG.md`.
- Stage A1: `docs/book/vivace/README.md` documents list;
  `docs/book/implementation-map.md` for `lib/planning.alg`.
- Stage B1: `docs/book/language-reference.md` gains the `plan` form;
  `docs/book/extension/grammar.md` if the offside fragment surfaces
  engine work.
- Stage E: `docs/plans/release-track.md` §8; the claims register;
  `docs/messaging.md` if public copy changes.
- `docs/backlog.md` B-151 (the planning pilot) progress per chunk.

## 7. Proposed amendment to Vision §4 (Tier 0; propose, do not land)

For the maintainer to land, amend or decline. The text would follow the
existing bullets of §4 and precede the paragraph on the seven gaps.

> **The pilots.** Three domain pilots test the hypothesis, chosen to be
> different so that they surface different gaps: a project planning
> workflow (a self-contained DSL with rich structural constraints), a
> software system model (several interconnected DSLs), and physics
> simulations (logic and processing intensive, over the units
> substrate). Each starts as *Shape 1*, specification and verification
> in Allegro with execution external, and may later become *Shape 2*,
> in which Allegro runs the model. Shape 1 is sufficient to test every
> claim above except execution, which is a separable concern.

## 8. Chunk log

- **2026-10-27 — D2 (completion from a catalog) landed.** The second
  search, on the three rulings of 2026-10-27: completion rather than the
  kernel's residuals; the gap is the wiring or outcome finding itself,
  no marker; a catalog is a library value (a list of nodes and plans),
  completion chains backward to a depth. `lib/planning.alg`: `gaps`,
  `gaps_show`, `catalog`, `fillers`, `completions`,
  `completions_within`, `solve_from`, `solve_from_within`, `complete`;
  `Solution` gained the completion steps, and `solution_show` opens with
  them ("`Delivered` from `LastMile`, `Shipped` from `Ship`, `Labelled`
  from `Label`; `Label` via `PrintLabel`"). The enumeration now checks
  the template once (`template_findings`, `option_table`,
  `resolved_findings`): a candidate re-checks only the budgets and
  handlers of the scopes above its picks, same semantics as D1
  (solution finding).
  `tests/planning-complete-demo.alg` (19 pinned lines): an order with
  its last step missing, completed from a catalog of leaves, a choice
  and a borrowed plan (two completions; the three-step chain wins on
  effort), solved under a deadline (the courier), refused at a dead end,
  at the depth, over the budget, and for a catalog node with a dangling
  outcome; a gap on the input side; a solved plan completes to itself.
  Measured, not assumed: the earlier figure of seconds per candidate was
  wrong. The planning library loads in about 68 s, and a demo that
  `import`s a module which itself uses the library loads it a second
  time (another 70 s; B-155 (library load per module)); the enumeration costs a fraction of
  a second per candidate, halved by the once-only check at 64
  resolutions. No kernel work; no surface change.

- **2026-10-26 — D1 (solution finding) landed.** `choice(name, options)`
  and `with_options`; `options:` in the surface (an option without ports
  takes the choice's; a composite option is a node block with inner
  nodes). A plan with open choices is a template: `choices`,
  `resolutions`, `candidates`; `check_plan` on a template checks the
  choices' soundness (`check_choice`, `choice_findings`), the structure,
  and feasibility over every resolution, with budgets on scopes that
  hold open choices held back for the solver; `solve` answers a
  `Solution` (plan, decisions, bound) or the counterexample
  (`infeasible_message`: the cheapest resolution against the measures
  it misses). `tests/planning-solve-demo.alg` (19 pinned lines): the
  worked example with `Test` (thorough or quick) and `Deploy`
  (blue-green or direct) as choices, solved at 200 person-hours (quick
  and direct, 20.75 person-hours, 1460 min), under a 23 h deadline
  (quick and blue-green, since direct is slow), refused under 21 h and
  under 20 person-hours, and three unsound choices refused. Two kernel
  findings, both fixed in the chunk and pinned: (1) `eval_when`
  evaluated a Symbol pattern through the dynamic scope, so a library's
  `is x and x instanceof Duration` read the calling file's `x`, and when
  that `x` was the value being built the match recursed without bound
  (`x = e` after `e = est(30 min, …)` crashed). A pattern name is still
  looked up dynamically when the module can see it (same-file names,
  forward references, type names), which two existing tests pin; so the
  resolver now marks a pattern name the module CANNOT see as a binder
  (`markPatternBinders`, the `when_bind` marker) before any consumer
  scope exists (pinned in `tests/units-core.alg`); (2) the block builder
  substituted a local binding's expression into every use site as one
  object, so the tail-call mark set at a tail site (`then unsound`)
  leaked a pending call at an argument site (`unsound.length`); each
  site gets its own copy now (`cloneExprTree`, pinned in
  `tests/functions.alg`). Two footguns recorded, not fixed: a binding
  named like a unit (`s = solve(…)`) is what a quantity literal
  (`30s backoff`) in the same file resolves to, by the units DSL's
  consumer-scope rule, and the result was an unbounded recursion rather
  than an error (backlog); and a top-level binding is re-evaluated at
  every reference, so a plan referenced ten times is built ten times,
  which is why the demo binds `best = solve(…)` once (backlog). New dev
  aid: `ALLEGRO_TRACE_DEPTH=<step>` names the Allegro functions on a
  runaway recursion's chain.

- **2026-10-26 — B2 (cross-file `uses`) landed; stage B complete.** The
  `uses` target is any expression now (`target:expr`), so `Build: uses
  build_pipeline.BuildPipeline` borrows a plan from an imported module.
  `tests/lib/build_pipeline.alg` is `BuildPipeline` as a module (its
  `use` headers, its fixtures, its `plan` statement);
  `tests/planning-split-demo.alg` imports it and declares
  `SoftwareRelease` against it (8 pinned lines: the borrowed plan is the
  module's checked binding; the using plan has the same counts, rollup,
  bound and escalations as the one-file version). The module system
  needed nothing: `import` resolves `lib/` beside the file first, a
  module goes through the same pipeline as a file, and an open module
  (no `export`) exposes its bindings. The harness gained the same
  local-first import loading for demo files (`src/test/alg-files.ts`),
  so the demo is suite-pinned. The archived item 4 closes.

- **2026-10-26 — B1 landed: the surface.** `planning_grammar` in
  `lib/planning.alg`, the first offside-rule fragment in `lib/`: `plan
  NAME:` opens an INDENT block of NEWLINE-separated items; `inputs:` and
  `outcomes:` take an inline list or a block of lines; `[ fixture ]`
  names a predicate in the consumer's scope; `estimate:` and `budget:`
  take measures (`30 min` through the units sugar, `1 person-hour` and
  `0.5 person-hours` as effort); `retry:` takes `max N attempts[, Q
  backoff]`; `fails:` a list of names; `instructions:` a block of text
  lines; `on NAME:` a handler block; `Name: uses Other` a borrowed plan;
  `Name:` a node block, a composite when it holds nodes. Each item lowers
  to a tagged record and `build_node`/`build_handler`/`build_plan` fold
  them into the library's own values, so the surface adds no second
  model. The statement form expands to `binding_decl(name, build_plan(…),
  WellFormedPlan)`: a plan that does not check halts the build (the
  negative case is a harness test, since a demo file can only pin plans
  that build). `tests/planning-release-demo.alg` is the chapter's §5
  text verbatim (13 pinned lines). Engine gaps, each closed in the
  chunk: (1) the EBNF mini-grammar could not name a layout terminal, now
  `INDENT`/`NEWLINE`/`DEDENT` by name, explicit for the whitespace
  interleave; (2) a statement form could not declare a binding, now
  `binding_decl`; (3) a label's matched text was a bare Bits typed by
  length, so `Validate` read as an Int, now a string literal; (4) a
  template's `none` arrives in the consumer's tree already typed and the
  literal-typing pass refused to re-stamp it, now skipped. Library
  findings: labels must be unique across nested rules (the deep label
  search finds the innermost first); a `**` list's separator is wrapped
  in newline-eating whitespace, so NEWLINE-separated lists are written as
  right-recursive rules. `lib/units.alg` gains `hours`, `minutes`,
  `seconds`. The grammar analyzer runs on every `use` (it is in the
  pipeline), so the fragment is analyzed by every demo.

- **2026-10-26 — A4 landed; stage A complete.** A node declares the
  failure types it can raise (`with_failure`; the `fails` key joins
  convention 4's reserved keywords for stage B). Escalation is computed
  as a graph property (`escalations`, `unhandled_failures`): a failure
  goes to the nearest enclosing scope with a handler for its type, a
  borrowed plan's unhandled failures are the `uses` node's, a failure
  inside a handler's graph escalates past the scope it recovers, and a
  failure no scope handles leaves the plan without being a finding.
  Handler validity (`check_handlers`): each handler is checked as a scope
  of its own, wired from the scope's inputs plus the outcomes upstream of
  every raiser, producing the scope's declared outcomes, and refused when
  no node beneath the scope declares its failure. The bound
  (`rollup_bound`) adds each handler's graph at the handler's retry and
  the budget check verifies the bound; `rollup` stays the main graph.
  Four readings recorded in the chapter §7. `tests/planning-handlers-demo.alg`
  (18 pinned lines). The A2 and A3 demos declare `CompilationError` on
  `Compile` and `HealthCheckFailed` on `HealthCheck` (construction only);
  three A3 pins changed because the budget now checks the bound: 8.75
  became 24 person-hours twice and `Deploy`'s 160 min became 165
  (flagged in the PR). No substrate finding; the two fixed faults of A3
  and B-152 were both exercised by the new code (`escalation_line` binds
  its arm as `handled_in`, since a bare `s` in a pattern is the units
  DSL's second under `use units`).

- **2026-10-26 — B-152 closed (bounded chunk, by ruling).** The
  maintainer asked whether to pause for B-152 (the kernel fault on one
  call shape) and ruled a bounded diagnosis chunk before A4. Cause:
  `resolvePrimitives` checked its `seen` set before resolving a parser
  stub, and one stub object sits under several expressions once the
  block builder substitutes a local binding into its use sites and
  rebuilds the enclosing expressions around the new argument; the
  second parent kept the stub and evaluation failed. A nine-line
  library-free reproducer showed eight shared stubs. The fix is the
  order of the two checks; pinned in `tests/functions.alg`;
  `names_producing` and `compatibility_with` removed from
  `lib/planning.alg`, their call sites back in the natural shape. The
  chunk stayed within its bound: diagnosis, one-line fix, pin, cleanup.

- **2026-10-26 — A3 landed.** The measures: `Effort` (`person_hours`)
  and `Money` (`money(n, currency)`) as planning-local records with their
  own arithmetic (R1); durations are `lib/units.alg`'s `Duration` (R2),
  so `lib/planning.alg` now says `use units`. `est` and `budget` guard
  each measure and refuse a wrong one in the units DSL's vocabulary. The
  rollup (`rollup`, `node_rollup`): leaves, composites, borrowed plans,
  retry at `max_attempts` times; `check_budget` joins `check_scope`, at
  the plan and at any composite (`with_budget` serves both). Three
  readings recorded in the chapter §7: an omitted measure contributes
  nothing; durations add serially; handlers stay outside the bound until
  A4. `tests/planning-budget-demo.alg` (23 pinned lines). The A1 demo's
  estimates became typed, so its one `estimate_show` pin changed from
  `duration 30, effort 1, money none` to `duration 30 min, effort 1
  person-hours, money none` (flagged in the PR). One substrate finding,
  fixed: a local binding of an `if`/`when` whose chosen branch was a call
  held the tail-call sentinel; `evaluateExpr` (`src/evaluator.ts`) now
  runs a sentinel that would leave an expression not in tail position,
  and the marking descends through the body wrappers to a branching
  expression (never to a bare call). Two attempts were dropped on the
  way, each caught by the suite: stopping the marking of branch thunks
  hung the typed recursive functions of
  `tests/totality-termination-demo.alg` at precompile; marking a bare
  call under the wrapper spun precompile's tail-call loop on
  `bad(n: Int): Int => bad(n)`.
  Pinned in `tests/functions.alg`. B-152 (the kernel fault on one call
  shape) was checked against the fix: distinct, still open. `own_rollup`
  was split out of `node_rollup` while the fault stood and stays as a
  named function because it reads well.

- **2026-10-25 — A2 landed.** Wiring derivation (`producers_of`,
  `scope_edges`), the four checks (`check_wiring`, `check_compatibility`,
  `check_acyclic`, `check_outcomes`), recursion into composites and
  borrowed plans (`check_scope`, `check_plan`), `plan_errors`,
  `well_formed`, `validate` (error value) and `WellFormedPlan`
  (annotation halt). Two readings settled by the worked example and
  recorded in the chapter §7: a fixture on a declared outcome is a
  promise, not a producer requirement; every node outcome is consumed or
  declared. Three substrate findings: (1) the invariant-totality gate
  (D32/CE-R7) refuses a refinement predicate whose callees may diverge,
  so every tree walk in the library is `assume terminates` — correct
  behaviour, worth knowing before writing analyzers; (2) `&&`/`||` were
  wrong when the right operand was a call (tail-call sentinel read as a
  value) — fixed in `src/primitives.ts`, pinned in `tests/logical.alg`;
  (3) a kernel fault on one call shape — **B-152**, worked around in the
  library with the two places marked. Lambda bodies are one expression:
  each per-input judgement is a named function and the folds concatenate.

- **2026-10-25 — A1 landed.** `lib/planning.alg` (types, constructors,
  builders, queries, renderings) and `tests/planning-core-demo.alg`
  (the `BuildPipeline` sub-plan by hand, 22 pinned lines). Rulings R1 to
  R4 taken as recommended the same day. One substrate finding, fixed in
  the chunk: `Array.length` returned an untyped number
  (`xs.length.toString()` failed), against the invariant that every
  Standard-mode value has a type; it is typed `Int` now. Design notes:
  one record for all three node kinds, told apart by what they carry
  (`node_kind`); `uses` copies the borrowed plan's ports onto the node;
  a port's fixture is a named predicate so that renderings can say
  `[valid_semver]`; records are immutable, so the `with_*` builders return
  copies.

- **2026-10-25 — B-079 landed.** The archived design revalidated into
  `docs/book/vivace/planning-dsl.md`; this plan created; B-151 filed
  for the stages; the archive row marked incorporated.
