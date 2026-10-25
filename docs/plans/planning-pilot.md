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
| **R3** | What does solution finding mean for a plan? | decided at stage D from the pilot's own constraints, not now | defer, as Vision §4 directs ("don't over-design ahead of evidence") |
| **R4** | Vision §4 amendment (Tier 0): name the pilot roster and the Shape 1 / Shape 2 staging | land §7's text, amend it, or decline | land it, since the rung is being built against it — **taken 2026-10-25, landed in `docs/book/vision.md` §4** (the maintainer noted the text becomes obsolete once the pilots have run) |

## 4. Stages and chunks

| Stage | Chunk | What lands | Exit measured by |
|---|---|---|---|
| **A. The library** | A1 | `lib/planning.alg`: the types (Plan, PlanNode, Input, Outcome, Estimate, Budget, Handler) as `Type.define` records; construction through the library's API; a demo `tests/planning-core-demo.alg` building `BuildPipeline` by hand | the demo is suite-pinned; the types print and compare |
| | A2 | Wiring derivation and the graph checks: acyclicity, wiring completeness, type compatibility, composite resolution; each failure an error value in domain terms | demo lines for each check passing and each check refusing a deliberately broken plan |
| | A3 | Estimates and budgets: durations through the units DSL (R2), effort and money per R1; rollup with retry upper bounds; the budget check | `SoftwareRelease` built through the API with its budget discharged; a budget-exceeding variant refused |
| | A4 | Failure handlers: `on <FailureType>` graphs, handler validity, re-escalation as a graph property | both handlers of the worked example checked |
| **B. The surface** | B1 | The grammar fragment: `plan NAME:` with offside blocks, `inputs:`/`outcomes:`, bracket constraints, `estimate:`, `budget:`, `retry:`, `on`, `uses`; the statement form expands to an annotated binding (halts on failure) | `tests/planning-release-demo.alg` is the worked example verbatim, suite-pinned; the first offside-rule fragment works or the engine gap is named |
| | B2 | Cross-file `uses` through `import`; the archived item 4 | the worked example split across two files |
| **C. Legibility** | C1 | B-081 slice: the renderer hook, now with evidence of what the messages must say | the demo's refusals read in planning vocabulary |
| **D. Solution finding** | D1 | Define it from stage A's constraints (R3): the smallest primitive that finds assignments satisfying budget and reachability over residuals | one solved plan in the demo |
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

- **2026-10-25 — B-079 landed.** The archived design revalidated into
  `docs/book/vivace/planning-dsl.md`; this plan created; B-151 filed
  for the stages; the archive row marked incorporated.
