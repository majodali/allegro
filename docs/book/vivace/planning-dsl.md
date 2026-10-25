# The planning DSL: the first Vivace pilot

> **Reader.** Someone who will build or review the rung-3 pilot: the
> first domain model written in Allegro Vivace, a planning language in
> which a plan is a graph of outcomes rather than a list of tasks. The
> chapter is the design truth for that language. It states the model,
> the conventions the design settled, what was tried and rejected, the
> worked example the library is built against, and what the Allegro of
> today provides and lacks for it. Terms used without definition are
> defined earlier: [refinement](../concepts.md#def-refinement),
> [contract](../concepts.md#def-contract),
> [effect](../concepts.md#def-effect), the layer model in `../layers.md`
> and the L3 contract in `README.md`.
>
> **Authority.** Tier 1. This chapter is the revalidation (B-079) of the
> archived v1 design `docs/plans/archive/project-1-planning-dsl-design.md`
> against `docs/book/allegretto/structures.md` and the code as of
> 2026-10-25. Every pinned decision below was re-checked; where the code
> has moved since the archive was written, the chapter says so. The
> rung it serves is rung 3 of the demo ladder
> (`docs/plans/release-track.md` §5); the work plan is
> `docs/plans/planning-pilot.md`. Each section carries the status tag
> `../README.md` defines.

## 1. What the pilot is for [designed]

Vision §4 states the Vivace hypothesis: application developers work in
the highest-abstraction model that expresses their problem, the models
and their constraints are the review artifacts, failures are build
errors with counterexamples every stakeholder can read, and the same
machinery that proves a function total proves a model consistent. Rung
3 of the demo ladder tests that hypothesis on one domain model with
rich constraints, solution finding over it, and failures a
non-programmer can read.

The archived design chose three pilots, deliberately different, to
surface different gaps:

| Pilot | Why |
|---|---|
| Project planning workflow | A self-contained DSL with rich structural constraints; the first |
| Software system model | Several interconnected DSLs (data, components, UI); tests composition |
| Physics simulations | Logic and processing intensive; float refinements; the rung-2 units DSL is its substrate |

This chapter is the first. The maintainer confirmed the choice on
2026-10-25.

**Shape 1 before Shape 2.** Every pilot starts as *Shape 1*: the model
is specified and verified in Allegro, and execution is external. *Shape
2*, in which Allegro itself runs the model, is a later evolution and a
separable concern. Shape 1 is enough to drive the roadmap: everything
the hypothesis claims about review artifacts, counterexamples and
verification is testable without execution.

## 2. The model [designed]

<a id="def-plan"></a>
### 2.1 Plan

**Definition.** A *plan* is a directed acyclic graph of plan nodes, each
with typed inputs and typed outcomes. Dependencies between nodes are
not written as edges; they are *derived* from the wiring of one node's
outcomes into another's inputs. A plan has inputs and outcomes of its
own, an optional budget, and optional failure handlers.

**Rationale.** The model is outcome-focused, not task-focused. A task
list says what to do; an outcome graph says what must become true and
lets the order follow from the data. That is what makes the same plan
executable by humans, AI agents, mixed teams or pipelines: the
performer is metadata, never structure. It is also what makes a plan
checkable: reachability, completeness and budget are properties of a
graph, and the kernel can decide them.

<a id="def-plan-node"></a>
### 2.2 Plan node

**Definition.** A *plan node* is either a *leaf*, which carries an
estimate and instructions, or a *composite*, which contains its own
internal graph of nodes. A composite's declared outcomes must be the
outcomes its internal graph produces. Tasks live at leaves only.

**Rationale.** Hierarchical decomposition without a separate notion of
sub-plan. A composite is a plan node that happens to contain a plan,
and `uses` (convention 10) lets a composite's internal graph be a
top-level plan declared elsewhere, which keeps nesting depth under the
author's control.

<a id="def-outcome-wiring"></a>
### 2.3 Wiring

**Definition.** *Wiring* is the derivation of edges: within a scope, an
outcome flows into every input of the same type, by name. A name is
assigned explicitly only when the match is ambiguous.

**Rationale.** Type-only wiring is the convention that makes plans
short. Its cost is ambiguity when two outcomes of one type are in
scope, and the design pays that cost locally, at the ambiguous site,
rather than everywhere.

### 2.4 Estimates and budgets

**Definition.** An *estimate* is a leaf's declared cost in one or more
measures (wall-clock duration, effort in person-hours, money). A
*budget* is a constraint declared at a composite or at the plan: the
rollup of the estimates beneath it may not exceed it. Where a node
declares a retry policy, its contribution to the rollup is its estimate
times the maximum number of attempts.

**Rationale.** Estimates roll up from the leaves; budgets are proved,
not reported. `rollup(estimates) ≤ budget` is a refinement the kernel
discharges, in the same way the rung-2 units DSL discharges dimensional
soundness.

<a id="def-failure-handler"></a>
### 2.5 Failure handlers

**Definition.** A *failure handler* is an alternate internal graph,
declared inside a composite with `on <FailureType>:`, that produces the
composite's outcome when a node beneath it fails with that failure
type. Failure propagates up to the nearest ancestor with a matching
handler. If the handler's own graph cannot reach the outcome, the
failure re-escalates.

**Rationale.** Throw and catch, over outcomes. The handler is held to
the same contract as the composite it rescues (it must produce the
same outcome), so a plan with handlers is still one graph with one set
of outcomes, and the checks of §7 apply to the handler's graph as they
apply to the main one.

### 2.6 What the model leaves optional

Scheduling (dates, calendars), resource management (reserving people
or equipment across the graph), performer assignment and latitude
grading (how strictly a leaf's instructions bind) are all absent from a
valid plan and explicit when needed. None is designed yet (§8).

## 3. The conventions [designed]

Twelve decisions, settled iteratively in the archived design and
re-checked here. Each is stated as pinned; the revalidation note says
what today's code has to say about it.

1. **One declaration keyword, `plan`.** No `process`, `procedure` or
   `project`. Add a second only when a strong need surfaces.
2. **No keyword for sub-units.** A capitalised identifier followed by
   `:` and an indented block is a node. `node`, `step`, `action` and
   `sub-plan` were tried and each had a downside; the empty keyword
   won. *Revalidation:* this makes the surface offside-rule syntax. The
   grammar formalism carries the stateful terminals for it (§6), and
   no library fragment has used them yet, so the surface is staged
   after the library (plan, stage B).
3. **Bracket form for constraints.** `[predicate]` after an identifier
   in an `inputs:` or `outcomes:` block constrains the value.
   *Revalidation:* a bracket constraint is a refinement over the
   input's or outcome's type, and refinements over a record type exist
   (`Refinement.define`, guarded construction).
4. **Reserved lowercase keywords inside a plan body:** `inputs`,
   `outcomes`, `estimate`, `instructions`, `budget`, `on`, `retry`,
   `uses`. Capitalised identifiers are nodes; lowercase identifiers are
   configuration keys.
5. **Type-only wiring by default** (§2.3). Assigned names only when
   ambiguous.
6. **Composite outcomes resolve by name and type.** A composite's
   declared outcomes must match what its internal graph produces.
7. **Fan-in only through an explicit aggregator node** (or a
   conditional branch, or a handler). `Validate` in the worked example
   is one. The shorthand is a known wart (§8).
8. **Estimates and budgets are separate** (§2.4). Estimates roll up;
   budgets are verified.
9. **Failure handler scope is `on <FailureType>:`** inside a composite
   (§2.5). Re-escalation on an unreachable outcome is the default; an
   explicit `raise` is deferred.
10. **Sub-plans can be declared separately and referenced with `uses
    NAME`.** `Build: uses BuildPipeline` makes the top-level plan
    `BuildPipeline` the internal graph of node `Build`. Its inputs must
    be available at the site; its outcomes become the node's.
    *Revalidation:* within one file this is a binding reference. Across
    files it is the module system's `import` (`../extension/modules.md`),
    whose fitness for plan declarations is the open item the archived
    design numbered 4 (§8).
11. **Predicate fixtures are snake_case identifiers.** `[all_tests_pass]`,
    `[valid_semver]` name ordinary predicate functions defined in a
    planning library, in the manner of behaviour-driven test fixtures:
    a readable phrase backed by a formal predicate.
12. **Retry is an explicit configuration block.** `retry: max 5
    attempts, 30s backoff` in the simple form; `iterate: until
    <condition>; max N; backoff Xs` in the richer form. The budget
    rollup takes `estimate × max_attempts` as the node's upper bound.

## 4. What was tried and rejected [designed]

- **Explicit dependency edges.** Rejected in favour of derived wiring;
  explicit edges duplicate what the types already say and drift from
  them.
- **A task-focused model.** Rejected; see §2.1.
- **Keywords for sub-units** (`node`, `step`, `action`, `sub-plan`).
  Rejected for the empty keyword; each named one either implied a
  performer or a granularity the model does not have.
- **Several declaration keywords** (`process`, `procedure`, `project`).
  Rejected until a distinction earns one.
- **Universal fan-in shorthand.** Deferred, not designed; the explicit
  aggregator is the current answer.

## 5. The worked example [designed]

`SoftwareRelease` is the canonical example and the design target for
the library. It goes three deep in the `Deploy` branch, references a
separately declared sub-plan (`Build: uses BuildPipeline`), exercises
`retry:`, carries two failure handlers (`on CompilationError:` inside
the sub-plan, `on HealthCheckFailed:` inside `Production`) and uses
snake_case predicate fixtures. An earlier strawman, `BuildFence`,
surfaced the core shape without hierarchy or handlers and is kept only
in the archive.

```
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

What a reader should be able to check by eye, and the kernel will
check mechanically (§7): every input of every node is produced by an
earlier outcome or by the plan's inputs; `Validate` is the explicit
fan-in; `Build`'s outcomes are `BuildPipeline`'s; the `HealthCheck`
retry contributes five times its estimate to the budget rollup; both
handlers produce the outcome of the composite they sit in.

## 6. What Allegro provides today, checked [implemented]

The archived design listed what the pilot would and would not push on.
Re-checked against the code at 2026-10-25:

| The pilot needs | Today | Where |
|---|---|---|
| Record types with methods and laws | `Type.define({...}, Interface)`; the units DSL's `Quantity` is the model | `lib/units.alg`, `../standard/type-system.md` §3 |
| Constraints on values | refinement types (`Int & p`), `Refinement.define`, guarded construction (`Type.define({...}) & _.field >= 0`, D32) | `../standard/core-types.md`, `../standard/contracts.md` |
| Grammar extension from a library | `grammar { rule … expr_form … stmt_form … }`, activated by `use NAME`; libraries and top-level files share one pipeline | `../extension/grammar.md` §4, `lib/units.alg`, `lib/proven.alg` |
| Offside-rule blocks | the formalism's `NEWLINE`/`INDENT`/`DEDENT`/`SAMELINE` terminals exist in the engine; **no library fragment uses them yet** | `../grammar-formalism.md` §5 |
| Custom analyzers in Allegro | the pattern exists: a pure library over a value (`lib/grammar-analyzer.alg`); failures are error values with domain text, or halts through a refinement annotation | `lib/grammar-analyzer.alg`; `../process.md` §6 on CE-R8 |
| Quantities for estimates and budgets | the units DSL: dimensions as data, refinement-typed quantities, operator dispatch, domain-vocabulary errors; **SI dimensions only** | `lib/units.alg` (rung 2, B-092) |
| Compile-time checks inside libraries | proofs, effects, exhaustiveness and termination fire in libraries as in user code | `../extension/modules.md` |
| Cross-file references | `import NAME` with local-then-system resolution; `use NAME.MEMBER` | `../extension/modules.md` |
| Domain-specific failure rendering | **not present**; failures carry the analyzer's message string | B-081, deferred by ruling (plan) |
| Solution finding | **not present** | plan, stage D |

Three findings from the check:

- **Estimates are quantities, and two of the three measures are not
  SI.** Wall-clock duration is the units DSL's time dimension. Effort
  (person-hours) and money are not among the seven SI base dimensions
  the library encodes, so the pilot needs either planning-local
  `Effort` and `Money` types (refinement-typed numbers with their own
  arithmetic) or a generalisation of the units library to named base
  dimensions. The plan asks for a ruling; the recommendation is
  planning-local types first, because the generalisation is a units
  design question and not a planning one.
- **The surface syntax is the first offside-rule fragment.** The
  engine has the terminals; no `grammar { … }` block in `lib/` uses
  them, and `use grammar { … }` literal blocks inside libraries are
  rejected today (`../extension/modules.md`, known limit). So the
  grammar is a stage of its own, after the library has proved the
  model, and may surface engine work.
- **Well-formedness has two enforcement shapes available**, and the
  pilot should use both (§7).

## 7. Well-formedness: what is checked and how [designed]

The checks, each a property of the graph:

| Check | Statement |
|---|---|
| Acyclicity | the derived edges form a DAG |
| Wiring completeness | every input of every node is produced by an outcome in scope or by the plan's inputs; every declared outcome of the plan is produced |
| Type compatibility | every derived edge joins an outcome to an input of the same type, and a bracket constraint on the outcome implies the one on the input |
| Composite resolution | a composite's declared outcomes are exactly what its internal graph produces (convention 6); a `uses` node's inputs are available at the site |
| Budget | for every budget, the rollup of estimates beneath it, with retry upper bounds (convention 12), does not exceed it |
| Handler validity | a handler's graph produces the outcome of the composite it sits in; its failure type is declared |

Two enforcement shapes, both existing:

- **Construction.** The plan constructor validates and, on failure,
  yields an **error value** carrying the check's message in domain
  terms ("outcome `DeployedRelease` is declared but no node produces
  it"). This is the guarded-construction path (D32), consciously weaker
  than a halt (CE-R8, `../process.md` §6): the error propagates virally
  and surfaces wherever the plan is used.
- **Annotation.** A binding annotated with the well-formed plan type
  (`SoftwareRelease: WellFormedPlan = …`) **halts** compilation on
  failure, as every failed refinement annotation does. The `plan`
  statement form of stage B expands to such a binding, so a plan file
  that does not check does not build, which is the behaviour Vision §4
  promises.

Until the renderer hook lands (B-081, deferred by the maintainer's
ruling of 2026-10-25), the message a halt shows is the kernel's
refinement message wrapping the analyzer's text. That is accepted for
the primitive version of the pilot: the point of the first stages is
to learn whether the model holds under implementation, with the
diagnostics as they are.

## 8. Open questions [designed]

Carried from the archived design, with two added by the revalidation:

- **Aggregator shorthand.** `Validate` is structurally required and
  reads as noise. Revisit once a few more plans exist.
- **Explicit `raise`.** Today a handler's failure auto-escalates; a
  directive that says "cannot recover, propagate" may be wanted.
- **Latitude grading.** How strictly a leaf's instructions bind. Surface
  undecided.
- **Resource management, scheduling, performer assignment.** Deferred
  until a pilot needs them; performer is probably metadata.
- **Failure-context access from handlers.** Whether a handler's graph
  can read what failed. Today it only runs an alternate path.
- **Cross-file plan references.** `uses` across files rides `import`;
  whether a plan declaration imports cleanly is to be confirmed when
  the first multi-file plan is written (the archived item 4).
- *Added:* **non-SI measures** (§6: effort and money).
- *Added:* **what solution finding means for a plan.** The ladder
  names it; nothing defines it. The plan's stage D lets the pilot's
  constraints say what is to be found (assignments of estimates or
  choices that satisfy budget and reachability) before any primitive is
  built.

## 9. Status and pointers [designed]

The language is designed and not built. `lib/planning.alg` does not
exist; the archived design's scaffolding list is the plan's stage A.
The work plan, its stages, the rulings it asks for and its chunk log are
`docs/plans/planning-pilot.md`. The backlog items are B-079 (this
revalidation), B-151 (the pilot's stages), B-081 (legibility, deferred),
B-093 (packaging). The proposal that Vision §4 name the pilot roster and
the Shape 1/Shape 2 staging is in the plan, for the maintainer to land
or decline; this chapter does not pre-empt it.
