# Project 1 — Planning DSL Design

Status as of the lib loader unification commit (`ef29c51`). Tests at 974/974
green. The lib loader pipeline-unification chunk is the last code that has
landed; everything below is design state for the next implementation chunk.

## 1. Context — Working backwards from Vivace pilots

The provability arc landed Phases A through H4a/b. The F-arc is feature-
complete for AI collaboration (`proven` body-form, proof combinators,
universal-Bool quantification, bounded induction, tactics library), the
H-arc (PCP — Proof Collaboration Protocol) has its schemas, CLI surfaces
(`verify` / `obligations` / `propose` / `prove`), and iteration hints
wired in.

Rather than continuing to push linearly through the provability arc, we
agreed to **work backwards from Vivace tier use cases** — i.e., pick a
small number of domain pilots that exercise the model-driven, AI-
collaborative shape Allegro Vivace is meant to enable, and let those
pilots drive the next round of implementation priorities.

The pilots are deliberately diverse to surface different gaps:

| # | Pilot                       | Why                                                     |
| - | --------------------------- | ------------------------------------------------------- |
| 1 | Project planning workflow   | Straightforward, self-contained DSL                     |
| 2 | Software system model       | Multiple interconnected DSLs (data, components, UI)     |
| 3 | Physics simulations         | Logic and processing intensive (float refinements)      |

User has existing non-model versions of all three; designing the DSLs
from scratch with learnings from those rather than migrating directly.

### Shape 1 vs Shape 2

All pilots start as **Shape 1: spec + verify, execution external**. Later
they may evolve to **Shape 2: spec + verify + execute** (Allegro itself
runs the model). Shape 1 is sufficient to drive the roadmap — execution
is a separable concern.

## 2. Project 1 — Planning DSL: the model

Crucially **not** a conventional task-tracking model. The planning model
is:

- **Outcome-focused, not task-focused.** A plan is a DAG of plan-nodes,
  each with typed *inputs* and typed *outcomes*. Dependencies are not
  explicit edges — they're *derived* from outcome-to-input wiring.
- **Hierarchical decomposition.** Composite nodes contain their own
  internal DAG of sub-nodes. Tasks live at leaves only. A composite's
  outcome is the outcome of its sub-DAG.
- **Performer-agnostic.** Same plan can be executed by humans, AI agents,
  hybrid teams, or fully automated pipelines. Performer is metadata, not
  structural.
- **Latitude-graded.** Each leaf can declare how strictly its
  instructions must be followed — strict procedure vs. broad guideline.
  (Surface for this is TBD.)
- **Optional scheduling / resource management / failure handling.** None
  of these are required to write a valid plan; all are explicit when
  needed.
- **Failure handlers as throw/catch.** A node failure propagates up to
  the nearest ancestor with a matching `on <FailureType>:` handler.
  Handler runs an alternate sub-DAG producing the same outcome as the
  catching node. If the handler's DAG itself can't complete, the failure
  re-escalates.
- **Highly formal** — supports planning and execution by AI agents with
  verification, hints, and human-in-the-loop collaboration.

## 3. DSL conventions — pinned decisions

These were settled iteratively across several rounds. Decisions captured
verbatim so the next chunk can scaffold against them without re-litigation.

1. **Single keyword for declaration: `plan`.** No `process` / `procedure`
   / `project` distinctions yet. Add only if a strong need surfaces.
2. **No keyword for sub-unit declarations.** A capitalized identifier
   followed by `:` and an indented block is a sub-unit. (Tried `node`,
   `step`, `action`, `sub-plan` — all had downsides. Empty keyword wins
   for now.)
3. **Bracket form for refinement constraints.** `[predicate]` after an
   identifier in `inputs:` / `outcomes:` blocks declares a constraint
   the value must satisfy.
4. **Reserved lowercase keywords inside a plan body:** `inputs`,
   `outcomes`, `estimate`, `instructions`, `budget`, `on`, `retry`,
   `uses`. Capitalized identifiers are sub-units; lowercase identifiers
   are config keys.
5. **Type-only wiring by default.** Outcomes flow into matching-typed
   inputs by name within scope. Assigned names only when ambiguous.
6. **Composite outcomes resolve by name and type.** A composite's
   declared `outcomes:` must match the outcome(s) produced by its
   internal DAG.
7. **Fan-in only via conditional branching / failure handlers.** Parallel
   work streams that need to merge use an explicit aggregator sub-unit.
   (Shorthand for this is a known wart — revisit later.)
8. **Estimates vs budgets are separate.** Estimates roll up from leaves;
   budgets are verifiable constraints at composite or top level. The
   kernel proves `rollup(estimates) ≤ budget`.
9. **Failure handler scope: `on <FailureType>:`** inside a composite
   introduces an alternate sub-DAG producing the composite's outcome.
   Default behavior: if the handler's DAG can't reach the outcome, the
   failure re-escalates automatically. Explicit `raise` directive is
   deferred.
10. **Sub-plans can be broken out separately, referenced via `uses
    NAME`.** This controls nesting depth — instead of inlining a
    composite, declare it as a top-level `plan NAME:` and reference it
    inline as `Build: uses BuildPipeline`. Plan B's inputs must match
    what's available at the call site; its outcomes become the sub-unit's
    outcomes.
11. **Predicate fixtures are snake_case identifiers.** Bracket
    constraints reference named predicates: `[all_tests_pass]`,
    `[valid_semver]`, `[tagged_with_version]`. These resolve to ordinary
    Allegro predicate functions defined in a planning-domain library.
    (Inspired by BDD test fixtures — readable English-ish phrases
    backed by formal predicate functions.)
12. **Iteration / retry is an explicit config block.**
    - Simple: `retry: max 5 attempts, 30s backoff`
    - Richer: `iterate: until <condition>; max N; backoff Xs`
    - When present, the analyzer accounts for `estimate × max_attempts`
      as the budget rollup upper bound.

## 4. Worked example 1 — BuildFence (early strawman)

The fence-building example was the first strawman. It surfaced the
core DSL shape but didn't stress hierarchy or failure handlers. Kept
here for reference.

```
plan BuildFence:
  inputs:
    SiteSurvey
    FenceDesign [ length < 100ft ]
    Budget [ amount < $5000 ]

  outcomes:
    Fence

  budget: 80 person-hours, $5000

  Permit:
    inputs:   SiteSurvey, FenceDesign
    outcomes: BuildingPermit
    estimate: 5 days, 4 person-hours, $200
    instructions:
      Submit application with site survey and design to the
      building authority. Follow up weekly until approved.

  Materials:
    inputs:   FenceDesign
    outcomes: Lumber, Hardware
    estimate: 2 days, 2 person-hours, $1800

  DigHoles:
    inputs:   BuildingPermit, SiteSurvey
    outcomes: PostHoles [ count matches FenceDesign ]
    estimate: 1 day, 6 person-hours, $0

  SetPosts:
    inputs:   PostHoles, Lumber, Hardware
    outcomes: PostsSet
    estimate: 1 day, 8 person-hours, $300

  InstallPanels:
    inputs:   PostsSet, Lumber, Hardware
    outcomes: Fence
    estimate: 3 days, 24 person-hours, $200
```

## 5. Worked example 2 — SoftwareRelease (latest)

This is the **current canonical example** — the design target for
`lib/planning.alg` scaffolding. Goes to depth 3 in the Deploy branch,
uses a sub-plan reference (`Build: uses BuildPipeline`), exercises
`retry:` config, two failure handlers (`on CompilationError:` and
`on HealthCheckFailed:`), and snake_case predicate fixtures.

```
# Separately defined sub-plan — referenced from SoftwareRelease via `uses`
plan BuildPipeline:
  inputs:   SourceCommit, ReleaseVersion
  outcomes: BuildArtifacts [ signed_and_version_stamped ]

  Compile:
    inputs:   SourceCommit
    outcomes: CompiledBinaries
    estimate: 30 min, 1 person-hour

  Package:
    inputs:   CompiledBinaries, ReleaseVersion
    outcomes: PackagedArtifacts [ tagged_with_version ]
    estimate: 15 min, 0.5 person-hours

  Sign:
    inputs:   PackagedArtifacts
    outcomes: BuildArtifacts
    estimate: 5 min, 0.25 person-hours

  on CompilationError:
    retry: max 3 attempts
    Diagnose:
      inputs:   SourceCommit
      outcomes: Diagnosis
      estimate: 1 hour, 1 person-hour
    ApplyFix:
      inputs:   Diagnosis, SourceCommit
      outcomes: PatchedCommit
      estimate: 3 hours, 3 person-hours
    Rebuild:
      inputs:   PatchedCommit, ReleaseVersion
      outcomes: BuildArtifacts
      estimate: 1 hour, 1 person-hour


plan SoftwareRelease:
  inputs:
    SourceCommit
    ReleaseVersion       [ valid_semver ]
    ReleaseApproval

  outcomes:
    DeployedRelease      [ version_matches_release_version ]

  budget: 200 person-hours

  Build: uses BuildPipeline

  Test:
    inputs:   BuildArtifacts
    outcomes: ValidatedBuild

    UnitTests:
      inputs:   BuildArtifacts
      outcomes: UnitTestResults    [ all_tests_pass ]
      estimate: 20 min

    IntegrationTests:
      inputs:   BuildArtifacts
      outcomes: IntegrationResults [ all_tests_pass ]
      estimate: 1 hour

    SmokeTests:
      inputs:   BuildArtifacts
      outcomes: SmokeResults       [ all_tests_pass ]
      estimate: 30 min

    Validate:
      inputs:   UnitTestResults, IntegrationResults, SmokeResults
      outcomes: ValidatedBuild

  ReleaseReview:
    inputs:   ValidatedBuild, ReleaseApproval
    outcomes: ApprovedRelease
    estimate: 2 hours, 2 person-hours

  Deploy:
    inputs:   ApprovedRelease
    outcomes: DeployedRelease

    StagingDeploy:
      inputs:   ApprovedRelease
      outcomes: StagedRelease
      estimate: 30 min, 1 person-hour

    StagingValidation:
      inputs:   StagedRelease
      outcomes: ValidatedStaging
      estimate: 1 hour, 2 person-hours

    Production:
      inputs:   ValidatedStaging
      outcomes: DeployedRelease

      BlueDeploy:
        inputs:   ValidatedStaging
        outcomes: BlueEnvironmentReady
        estimate: 15 min, 0.5 person-hours

      HealthCheck:
        inputs:   BlueEnvironmentReady
        outcomes: BlueHealthy [ traffic_handling_capable ]
        retry:    max 5 attempts, 30s backoff
        estimate: 10 min, 0.25 person-hours

      Cutover:
        inputs:   BlueHealthy
        outcomes: DeployedRelease
        estimate: 5 min, 0.25 person-hours
        instructions:
          Switch load balancer to route 100% of traffic to blue.

      on HealthCheckFailed:
        Rollback:
          inputs:   BlueEnvironmentReady
          outcomes: DeployedRelease
          estimate: 5 min, 0.25 person-hours
          instructions:
            Tear down blue deployment, leave green serving traffic.
            Raise DeploymentFailure to caller.
```

## 6. Open / deferred design questions

These are intentional follow-ons, not blockers for the first
implementation:

- **Aggregator shorthand.** `Validate` inside `Test` is structurally
  required but reads as noise. Look at simpler syntax once a few more
  plans exist.
- **Explicit `raise` directive.** Today: handler-DAG failure auto-
  escalates. Eventually: a `raise <FailureType>` directive that lets
  a handler explicitly signal "cannot recover, propagate up."
- **Latitude grading.** How strictly leaf instructions must be followed
  (strict procedure vs. broad guideline). Surface TBD.
- **Resource management.** Reserving humans/equipment across the DAG.
  Deferred until a pilot needs it.
- **Scheduling.** Wall-clock dates, working hours, calendar constraints.
  Deferred.
- **Performer assignment.** Who/what executes a leaf. Probably
  metadata; surface TBD.
- **Failure-context access from handlers.** Whether a handler's sub-DAG
  can read what specifically failed in the catching node. Today the
  handler just runs an alternate path; eventually may want a richer
  failure value.

## 7. Allegro implementation priorities surfaced

In rough priority order. (1) is the chunk just landed in `ef29c51`.

1. ✅ **Lib loader nested-`use` pre-scanning.** Required so `lib/
   planning.alg` can use `proven` / `assert` / `effects` / `requires` /
   `ensures` / `partial` body-forms internally. Lib files and top-level
   files now share the `evalSource` entry point. Done.

2. **Domain-specific counterexample rendering hook.** When a plan
   analyzer rejects a plan, the message must read in planning
   vocabulary, not Allegro internals. E.g., `outcome BlueHealthy of
   HealthCheck not reachable within retry budget` — not `Expression(seq,
   [...])`. The planning library should be able to register its own
   renderers. This is the Vivace usability research gap "counterexample
   legibility" and a precondition for any pilot library being
   genuinely usable.

3. **`lib/planning.alg` scaffolding** against the SoftwareRelease worked
   example. Includes:
   - Plan / PlanNode / Input / Outcome types
   - DAG construction from outcome→input wiring (by type within scope)
   - Acyclicity verification analyzer
   - Type-compatibility check at every wired edge
   - Verification that all declared inputs are wired and all declared
     outcomes are produced
   - Estimate rollup computation
   - Budget verification (`rollup(estimates) ≤ budget`)
   - `retry:` config recognition + budget upper-bound math
   - Failure handler structural validation
   - Grammar extension for the surface syntax (`plan NAME:`,
     `inputs:` / `outcomes:` blocks, `on <Failure>:`, `uses NAME`,
     `retry:`, bracket constraints)

4. **Cross-file plan references.** `Build: uses BuildPipeline` where
   `BuildPipeline` lives in a different file. Needs basic module-system
   polish (qualified imports or cleanly working `import other_plans`
   for plan declarations). Not blocking the first iteration if we keep
   the first worked example in one file; needed before Project 2's
   multi-domain composition.

What the planning pilot does **not** push on (already exists in core):
- Refinement types ✓
- Invariants on types ✓
- Grammar extension (stmt_form/expr_form/rule) ✓
- Custom analyzers via lib code (`lib/grammar-analyzer.alg` shows the
  pattern) ✓
- `proven` body-form ✓ (now usable in libs after the loader fix)
- Effect tracking ✓

What the planning pilot does **not** require yet:
- Codegen (Shape 1, not Shape 2)
- Runtime execution / real I/O
- Performance optimization

## 8. Status & next steps

**Just landed (`ef29c51`):** Lib loader unification — `proven`, `assert`,
`requires`, `ensures`, `effects`, `decreases`, `partial` body-forms now
work inside any lib file. 974/974 green. Unblocks `lib/planning.alg`.

**Next chunk (suggested ordering):**

1. Domain counterexample renderer hook — small infrastructure piece in
   `src/runtime.ts` / `src/introspect.ts` so libs can register
   per-notification-kind renderers. Probably ~50-100 LOC.
2. `lib/planning.alg` scaffolding — types + grammar + DAG analyzer.
   Larger; might split into stages (types first, then grammar, then
   each analyzer check as its own stage).
3. Worked example `tests/planning-release-demo.alg` running through
   the new lib against the SoftwareRelease example.

User can pick ordering. Either "renderer hook first, then planning lib"
or "planning lib first, eat the ugly diagnostics, fix later" is
defensible. The first ordering produces a more usable result; the
second has tighter feedback on whether the DSL design holds up under
real implementation pressure.

## 9. Pointers for the next session

- Latest commit: `ef29c51` Lib loader unification: nested-\`use\`
  pre-scan + evalSource delegation
- Worked example in this doc: SoftwareRelease (Section 5) — design
  target for the planning lib
- Existing infrastructure to draw from:
  - `lib/grammar-analyzer.alg` — pattern for a custom Allegro-native
    analyzer (~320 LOC, fixed-point computation, structural checks)
  - `lib/tactics.alg` — pattern for a small composition library
  - `lib/proven.alg`, `lib/effects.alg`, `lib/contracts.alg` — patterns
    for body-form grammar extensions
  - `src/totality.ts` `checkTermination` — pattern for a TS-side
    analyzer (SCC computation, structural induction)
  - `src/proven.ts` `checkProvenClauses` — pattern for body-form
    notification emission
- The agreed user preferences: terse responses, no trailing summaries,
  validate before claiming, keep design simple enough for non-technical
  readers, save design decisions to memory when they recur
