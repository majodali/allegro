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

<a id="def-choice"></a>
### 2.7 Choice

**Definition.** A *choice* is a node that can be done one of several
ways: it carries *options*, each a node (a leaf or a composite) with the
choice's ports. A plan with open choices is a *template*; a *resolution*
picks one option at every choice, and the solved plan is a plan like any
other. *Solution finding* is the search over the resolutions for one
that passes every check, the budget included, best by an objective.

**Rationale.** Vision §2 names solution finding as search through the
space the claims constrain. A plan as the author writes it is fully
specified and leaves nothing to find; the planning domain's natural
open thing is an alternative. Choices keep the model one model: an
option is an ordinary node, a template is checked by the checks of §7,
and a solved plan needs nothing new. Ruled 2026-10-26 (R3, the
solution-finding ruling, at stage D).

<a id="def-catalog"></a>
### 2.8 Catalog and completion

**Definition.** A *gap* is what the checks of §7 already name: an input
of a node that nothing in its scope produces, or a declared outcome no
node produces. A *catalog* is a list of nodes a plan may draw on; a plan
in a catalog is borrowed, as `uses` borrows. A *completion* of a plan
fills each gap of the plan's own scope with a catalog node that produces
the missing port, chained backward when that node opens gaps of its own,
within a depth. A completion is a plan like any other: checked by the
same checks, solved over its choices by the same search, ranked by the
same objective.

**Rationale.** The second search, stage D2 (completion from a
catalog). A choice is a closed
catalog at one point of the graph; a gap is an open one. Nothing marks
either: the wiring and outcome findings are the queries, and the catalog
is the space, so the author writes the plan they have and names what may
fill it. This is the shape Vision §4 wants for the iteration loop
(B-083, the AI iteration loop): a proposer adds entries to the catalog,
and the checks say what still misses. Only the plan's own scope is
completed; a gap inside a composite stays a finding, because the
composite is the author's unit of design. Ruled 2026-10-27 at stage D2.

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
   grammar formalism carries the stateful terminals for it (§6); the
   surface was staged after the library (plan, stage B) and built at
   stage B1 (the surface) as the first offside-rule fragment in `lib/`
   (`planning_grammar` in `lib/planning.alg`).
3. **Bracket form for constraints.** `[predicate]` after an identifier
   in an `inputs:` or `outcomes:` block constrains the value.
   *Revalidation:* a bracket constraint is a refinement over the
   input's or outcome's type, and refinements over a record type exist
   (`Refinement.define`, guarded construction).
4. **Reserved lowercase keywords inside a plan body:** `inputs`,
   `outcomes`, `estimate`, `instructions`, `budget`, `on`, `retry`,
   `uses`. Capitalised identifiers are nodes; lowercase identifiers are
   configuration keys. *Revalidation (stage A4):* one key is added,
   `fails`, by which a node declares the failure types it can raise. A
   handler is checked against what is declared beneath it (§7), so the
   declaration is part of a leaf's contract, as its estimate is. The
   stage-B surface carries it; in the library it is `with_failure`.
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
    files it is the module system's `import` (`../extension/modules.md`):
    `Build: uses build_pipeline.BuildPipeline` borrows a plan declared
    in `lib/build_pipeline.alg` beside the using file, which the module
    system resolves local-first. Confirmed at B2 (cross-file `uses`;
    `tests/planning-split-demo.alg`): a module carries its `use` headers
    and its `plan` statements, the borrowed plan arrives checked, and
    its handler and estimates come with it. The archived item 4 closes.
11. **Predicate fixtures are snake_case identifiers.** `[all_tests_pass]`,
    `[valid_semver]` name ordinary predicate functions defined in a
    planning library, in the manner of behaviour-driven test fixtures:
    a readable phrase backed by a formal predicate.
12. **Retry is an explicit configuration block.** `retry: max 5
    attempts, 30s backoff` in the simple form; `iterate: until
    <condition>; max N; backoff Xs` in the richer form. The budget
    rollup takes `estimate × max_attempts` as the node's upper bound.
13. **A choice declares its options under `options:`** (§2.7; added at
    stage D1). Each option is a node block; an option written without
    ports takes the choice's. A choice may sit anywhere in the main
    graph; a borrowed plan is solved before it is borrowed, and a
    recovery's graph holds no choice. `options` joins convention 4's
    reserved keys.
14. **A gap is a query; a catalog is the space** (§2.8; added at stage
    D2). No syntax marks a gap: the plan as written is checked, and what
    the wiring and outcome checks report is what `solve_from` fills from
    the catalog the caller passes. A catalog is a value, a list of nodes
    and plans, built in the library; a surface form for it waits for a
    plan that needs one, as the `plan` form waited for stage A.

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
    fails:    CompilationError

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
        fails:    HealthCheckFailed

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

The two `fails:` lines were added at stage A4 (convention 4): the
handlers are checked against them. `tests/planning-release-demo.alg` is
this text, verbatim, built and checked through the surface. What a
reader should be able to check by eye, and the kernel will check
mechanically (§7): every input of every node is produced by an
earlier outcome or by the plan's inputs; `Validate` is the explicit
fan-in; `Build`'s outcomes are `BuildPipeline`'s; the `HealthCheck`
retry contributes five times its estimate to the budget rollup; both
handlers produce the outcome of the composite they sit in.

## 6. What Allegro provides today, checked [implemented]

The archived design listed what the pilot would and would not push on.
Re-checked against the code at 2026-10-25:

| The pilot needs | Today | Where |
|---|---|---|
| Record types with methods and laws | `Type.define({...}, Interface)`; the units DSL's `Quantity` is the model; the planning types (`Plan`, `PlanNode`, `Port`, `Fixture`, `Estimate`, `Retry`, `Handler`) exist since stage A1 | `lib/planning.alg`, `lib/units.alg`, `../standard/type-system.md` §3 |
| Constraints on values | refinement types (`Int & p`), `Refinement.define`, guarded construction (`Type.define({...}) & _.field >= 0`, D32) | `../standard/core-types.md`, `../standard/contracts.md` |
| Grammar extension from a library | `grammar { rule … expr_form … stmt_form … }`, activated by `use NAME`; libraries and top-level files share one pipeline | `../extension/grammar.md` §4, `lib/units.alg`, `lib/proven.alg` |
| Offside-rule blocks | the formalism's `NEWLINE`/`INDENT`/`DEDENT` terminals exist in the engine and, since stage B1, are reachable from a library's `grammar { }` by name; `planning_grammar` is the first fragment to use them (`SAMELINE` is still unimplemented and unneeded) | `../grammar-formalism.md` §5, `../extension/grammar.md` §4 |
| Custom analyzers in Allegro | the planning checks are one (`check_plan`, stage A2), a pure library over the plan value in the manner of `lib/grammar-analyzer.alg`; failures are error values with domain text (`validate`), or halts through the `WellFormedPlan` annotation. A refinement predicate's callees must be total: every walk over the node tree is `assume terminates`, because no verified `decreases` metric describes a walk into a child list | `lib/planning.alg`, `lib/grammar-analyzer.alg`; `../process.md` §6 on CE-R8; `../standard/totality.md` |
| Quantities for estimates and budgets | durations are the units DSL's `Duration` (R2: `30 min` with `use units`); effort and money are the planning library's `Effort` (`person_hours(n)`) and `Money` (`money(n, currency)`) (R1), records with their own arithmetic in the manner of `Quantity`, so a mismatch is an error in planning vocabulary; the rollup and the budget check exist since stage A3 | `lib/units.alg` (rung 2, B-092), `lib/planning.alg` |
| Compile-time checks inside libraries | proofs, effects, exhaustiveness and termination fire in libraries as in user code | `../extension/modules.md` |
| Cross-file references | `import NAME` with local-then-system resolution; `use NAME.MEMBER` | `../extension/modules.md` |
| Domain-specific failure rendering | **present since stage C1**: a refinement predicate that answers an error value explains the refusal in its own words at every refusal site, and `well_formed` does, so a `plan` statement that does not check halts with the findings in planning vocabulary | `../standard/contracts.md` §7 ("A predicate can say why"); B-081 (counterexample legibility) for what remains |
| Solution finding | **not present** | plan, stage D |

Six findings from the check, the last three made by stages A2 and A3
while building the checks:

- **Estimates are quantities, and two of the three measures are not
  SI.** Wall-clock duration is the units DSL's time dimension. Effort
  (person-hours) and money are not among the seven SI base dimensions
  the library encodes, so the pilot needed either planning-local
  `Effort` and `Money` types or a generalisation of the units library to
  named base dimensions. Ruled and built at stage A3, R1 (planning-local
  measures) and R2 (durations through the units DSL):
  planning-local types, because the generalisation is a units design
  question and not a planning one; durations reuse the units DSL, which
  is the bridge from rung 2. `est(3 m, …)` is refused as "a duration is a
  time quantity such as 30 min, not a length quantity (3 m)".
- **The surface syntax is the first offside-rule fragment.** The
  engine had the terminals; no `grammar { … }` block in `lib/` used
  them. Built at stage B1; it surfaced three engine gaps, each closed
  in the chunk: the EBNF mini-grammar had no way to name a layout
  terminal (now `INDENT`, `NEWLINE`, `DEDENT` by name, treated as
  explicit whitespace by the interleave); a statement form could not
  declare a binding (now `binding_decl(name, value, type)`, the
  expansion `plan NAME:` uses); and a label's matched text was a bare
  Bits, typed by its length, so an eight-byte node name read as an
  integer (now a string literal). One more, a template's `none` arriving
  pre-typed in the consumer's tree, is in the changelog.
- **Well-formedness has two enforcement shapes available**, and the
  pilot uses both (§7).
- **Short-circuit `&&` and `||` were wrong when the right operand was a
  call.** `p && f(x)` was true whatever `f` answered and `p || f(x)` was
  false whatever `f` answered, because the operators unwrapped the
  right-hand thunk by evaluating its body, which hands back the tail-call
  sentinel for a call in tail position. Fixed in stage A2 (they apply the
  thunk); pinned in `tests/logical.alg`.
- **A kernel fault on one shape of call.** A function that binds the
  result of an inline filter-then-map chain locally and then uses the
  binding more than once, under a method call, an index and a lambda,
  failed with "`type_dispatch` has unresolved stub". Filed as
  **B-152** (the kernel fault on one call shape) with the pair and fixed
  in a bounded chunk after stage A3: the parser leaves primitive stubs
  that `resolvePrimitives` replaces, and it skipped a stub it had already
  seen under another parent, although a local binding substituted into
  several use sites puts one stub under several expressions. The stub is
  resolved before the seen check now; pinned in `tests/functions.alg`;
  the library's workarounds are gone.
- **A local binding of an `if` or `when` whose chosen branch was a call
  held a pending call, not a value.** `y = if c then f(x) else 0` bound
  the evaluator's tail-call sentinel as `y`, and every later use of `y`
  crashed the evaluator. The tail-call marking marks every branch thunk's
  body as a tail position, and `if` and `when` evaluate that body in
  place, so a branching expression that was not itself in tail position
  passed the sentinel on as its value. Fixed at stage A3 in the evaluator
  (`src/evaluator.ts`): a sentinel may leave an expression only when that
  expression is in tail position, and the marking descends through the
  body wrappers so a typed function's `if` keeps its tail-call
  optimisation. Pinned in `tests/functions.alg`. Distinct from B-152,
  which reproduces with the fix in place.

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

Stage A2 built the first four and applies them to the plan's graph, to
every composite's internal graph (convention 6) and to a borrowed plan's
own (convention 10); `check_plan` answers a list of findings, each naming
the scope, the node and what is wrong, in planning vocabulary. Two
readings were settled on the way, both by the worked example:

- **A fixture on a declared outcome is a promise, not a structural
  requirement on the producer.** `BuildPipeline` declares
  `BuildArtifacts [signed_and_version_stamped]` over a `Sign` node that
  promises nothing. The promise is established when the outcome is
  produced (Shape 2). A fixture on an **input**, by contrast, is a
  requirement: its producer must carry the same fixture, or the edge is
  incompatible.
- **Every node outcome is consumed or declared.** An outcome a sibling
  does not consume and the scope does not declare is reported; the
  example has none, and a plan that wants a side outcome declares it.

Stage A3 built the budget check over typed measures. The rollup
(`rollup`, `node_rollup`) is an upper bound: a leaf contributes its
estimate, a composite the rollup of its inner graph, a `uses` node the
rollup of the borrowed plan, and a node with a retry policy
`max_attempts` times that (convention 12). Three readings, recorded
here:

- **A measure an estimate leaves out contributes nothing.** The worked
  example estimates `Test`'s leaves in duration only; its effort rollup
  is the sum of the leaves that state one. A budget measure left out is
  unconstrained.
- **Durations add serially.** The bound assumes no two nodes run at
  once; a scheduler that overlaps them only tightens it.
- **Handlers are outside the bound for now.** They are alternate graphs;
  what they add is settled with handler validity at stage A4, where
  their semantics are decided.

A budget finding reads "budget of `Deploy`: duration 165 min exceeds
2 h": the comparison is dimensional, through the units DSL, so a budget
in hours checks a rollup in minutes.

Stage A4 built handler validity and settled what handlers add to the
bound. A node declares the failure types it can raise (`with_failure`;
the `fails` key, convention 4). A failure propagates to the nearest
enclosing scope with a handler for its type; `escalations` renders that
as a property of the graph ("`HealthCheckFailed` raised by `HealthCheck`
is handled in `Production`"; "`ReviewRejected` raised by
`ReleaseReview` escalates to the caller of `SoftwareRelease`"), and
`unhandled_failures` lists what leaves the plan. A handler's graph is
checked as a scope of its own, with the scope's declared outcomes as its
outcomes: wired, compatible, acyclic, and producing every declared
outcome. Four readings, settled by the worked example:

- **What a handler may consume** is the scope's inputs plus the outcomes
  of the nodes upstream of every node that raises its failure type:
  those had been produced when the failure occurred. `Rollback` consumes
  `BlueEnvironmentReady`, produced by `BlueDeploy` before `HealthCheck`
  failed; a rollback that consumed `BlueHealthy`, which the failing node
  would have produced, is refused.
- **A handler must be able to produce the scope's outcomes.**
  Re-escalation is what happens at run time when the handler's own graph
  fails, not a shape the check accepts: a handler whose graph produces
  something else is refused in the outcome vocabulary of §7.
- **A handler for a failure no node beneath the scope declares is
  refused.** It can never run.
- **A failure that no scope handles escalates to the plan's caller, and
  that is not a finding**: a plan may fail by design, and the chapter's
  own `Rollback` says so in its instructions. A failure raised inside a
  handler's graph escalates past the scope it recovers; a recovery does
  not recover itself.

A handler is an alternate path, so the bound a budget promises must
include it: `rollup_bound` adds every handler's graph at the handler's
retry, at every scope, and the budget check verifies the bound, while
`rollup` stays the main graph. For the worked example the main graph is
440 min and 8.75 person-hours; with the `CompilationError` recovery at
three attempts and the rollback, the bound is 1345 min and 24
person-hours, within the declared 200.

Stage D1 built solution finding over choices (§2.7). A template is
well-formed when its choices are sound (every option carries the
choice's ports; no choice in a borrowed plan or a recovery), the
structural checks pass over the template, and **some resolution passes
every check, the budget included**; a budget on a scope with open
choices beneath it is held back until the solver settles it. `solve`
enumerates the resolutions, keeps the well-formed ones, and answers the
best by the objective, the bound's effort and then its duration, as a
`Solution`: the solved plan, the decisions ("`Test` via `Quick`,
`Deploy` via `Direct`") and the bound. The chosen option takes the
choice's name, so the solved plan reads as the author wrote it, and it
brings its own graph, handlers included. When no resolution passes, the
counterexample names the cheapest resolution and the measure it misses
("no choice of `Test` and `Deploy` fits the budget of
`SoftwareRelease`; the cheapest, `Test` via `Quick`, `Deploy` via
`Direct`, is duration 1460 min against 21 h"), or its first finding when
something other than the budget fails. Enumeration is the library's own
and honest at the pilot's size: the worked example with two choices of
two options has four resolutions.

Stage D2 added the second search, completion from a catalog (§2.8), and
made the enumeration check only what a resolution can change. Options
carry the choice's ports, so the wiring, compatibility, cycle and outcome
checks of every scope above a choice read the same for every resolution:
they run once, over the template, and each option's own graph is checked
once and charged to the resolutions that pick it. A candidate re-checks
only the budgets and the handlers of the scopes above its picks. The
semantics are D1's exactly; the cost per resolution halved at the sizes
measured, and the library's load time, not the search, is what a demo
spends its seconds on. `solve_from(plan, catalog)` completes, then
resolves: every completion that closes the gaps becomes a template, every
resolution of every template a candidate, and the best well-formed one
is the `Solution`, whose record now opens with the completion steps
("`Delivered` from `LastMile`, `Shipped` from `Ship`, `Labelled` from
`Label`; `Label` via `PrintLabel`"). A plan with no gaps completes to
itself, so `solve_from` on a solved plan is `solve`. Three
counterexamples: the dead end ("no completion of `Fulfil` from the
catalog: nothing produces `Shipped`, which `LastMile` needs"), the depth
("within 2 steps: nothing produces `Labelled`, which `Ship` needs"), and
the cheapest completion that fails, named with its steps and the measure
it misses or its first finding, as for a choice. A completion that the
checks refuse (a catalog node whose extra outcome nothing consumes) is
a candidate that fails, not a plan the search quietly drops.

The kernel's residuals and interval domains were weighed at D2 and not
taken. Leaving the choices unresolved and reading an interval off the
residual rollup would need interval arithmetic over quantities (today's
`IntervalDomain` in `src/refinements.ts` is over `Int` predicates on one
parameter), predicate propagation onto residuals (B-098), and a surface
that reads the knowledge back; and it would give a bound, not a
selection: it can refute a template but cannot pick a resolution. The
library computes the same bound directly, and branch-and-bound over
partial resolutions is the library's next step if a template ever grows
past the enumerable. Revisit when a Vivace model's constraint is a
predicate the kernel already reasons about.

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
  statement form (stage B1) expands to exactly such a binding, so a plan
  file that does not check does not build, which is the behaviour Vision
  §4 promises.

Stage C1 (legibility, 2026-10-27) made the halt say what the analyzer
found. The ruling of 2026-10-25 had deferred rendering until the
primitive version had run, and until then a halt said only "Type error:
refinement predicate failed for `WellFormedPlan`", the findings lost,
because a predicate answers a boolean. The hook is the kernel's own
channel for "no, and here is why": `well_formed` answers an **error
value** naming the plan and every finding when the plan does not check,
and the kernel carries that text into the refusal at every site
(`../standard/contracts.md` §7): the `plan` statement halts with "Type
error: refinement predicate failed for `WellFormedPlan`: `Broken` is not
well-formed: input `Missing` of `Work` is not produced by any node of
`Broken` or by its inputs", a parameter annotated `WellFormedPlan` halts
the same way, and `validate` yields the same sentence as its error
value. No registered slot and no renderer registry: the explanation
lives in the predicate, so a model's assurance and its legibility travel
together when its type is imported. What B-081 (counterexample
legibility) still holds: the `inspect` channel, the call-site origin
(B-057), and rendering the refused value itself.

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
- *Closed at stage B2:* **cross-file plan references.** `uses` across
  files rides `import`, and a plan declaration imports cleanly
  (convention 10, revalidation).
- *Added:* **non-SI measures** (§6: effort and money).
- *Closed at stage D1:* **what solution finding means for a plan.**
  Search over the resolutions of a template's choices (§2.7) for the
  best one that passes every check (§7). Scheduling under a resource
  limit, completion from a catalog, and retry tuning were weighed and
  deferred (the plan's §3, R3).
- *Closed at stage D2:* **completion from a catalog** (§2.8, §7), and
  **the kernel's residuals as the search** (§7: weighed, not taken; the
  reasons are recorded there). Still open: branch-and-bound over partial
  resolutions, when a template outgrows enumeration; a surface form for
  catalogs; completion inside a composite.

## 9. Status and pointers [partial]

Stage A, the library, is built (A1 to A4), and B1, the surface:
`planning_grammar` in `lib/planning.alg` is the `plan NAME:` form of §5,
and `tests/planning-release-demo.alg` is the worked example verbatim
through it. `lib/planning.alg` holds the
types as records, the constructors (`leaf`, `composite`, `uses`, `plan`,
the `with_*` builders including `with_failure`, `handler`, `retry`, `est`,
`budget`, `port`, `port_where`, `fixture`), the measures (`person_hours`,
`money`; durations from `lib/units.alg`), the queries (`node_count`,
`leaf_count`, `node_names`, `find_node`, `handler_count`, `rollup`,
`rollup_bound`, `unhandled_failures`, `escalations`), the one-line
renderings, and the checks: wiring derivation (`producers_of`,
`scope_edges`), the four graph checks, the budget check (`check_budget`),
handler validity (`check_handlers`), `check_plan`, `plan_errors`,
`well_formed`, `validate` and the `WellFormedPlan` type.
`tests/planning-core-demo.alg` builds the `BuildPipeline` sub-plan of §5
by hand; `tests/planning-checks-demo.alg` builds the whole worked example,
checks it clean through both enforcement shapes, and refuses five plans
each broken in one way; `tests/planning-budget-demo.alg` builds it with
every estimate and retry, discharges its budget, and refuses it under a
tighter one, a composite under a duration budget, a plan over a money
budget, and wrong measures at the point they are written;
`tests/planning-handlers-demo.alg` checks both handlers as graphs,
renders every failure's escalation, shows the bound with handlers, and
refuses three handlers each wrong in one way. Plans are values: two plans
built the same way are equal, and `instanceof` names their types. The
stages surfaced four substrate findings (§6): `Array.length` untyped
(fixed, A1), short-circuit operators wrong with a call on the right
(fixed, A2), a kernel fault on one call shape (B-152, fixed in its own
chunk after A3), and a local binding of a branching expression holding a
pending call (fixed, A3). Stage B is complete:
`tests/planning-split-demo.alg` borrows `BuildPipeline` from
`tests/lib/build_pipeline.alg` through `import`. Stage D1 built choices
and `solve` (§2.7, §7): `tests/planning-solve-demo.alg` solves the
worked example with `Test` and `Deploy` as choices under three budgets
and refuses unsound choices. Two more substrate findings, both fixed in
that chunk: a library's `when` pattern variable was looked up in the
calling file's scope, and a local binding's expression was shared
between its use sites so a tail mark at one leaked a pending call at
another. Stage D2 built completion from a catalog (§2.8, §7):
`tests/planning-complete-demo.alg` completes an order with its last step
missing from a catalog of leaves, a choice and a borrowed plan, solves it
under a deadline, and refuses it at a dead end, at the depth, over the
budget and for an unsound completion; the enumeration now checks the
template once. Stage C1 made the refusals explain themselves:
`well_formed` answers an error value with every finding, and the `plan`
statement's halt carries it (§7; the halt test in
`src/test/language.ts`). Stage E1 packaged the rung: `demos/rung3/`
holds two suite-validated scenes with their break-it halts, and the
public story is `docs/messaging.md`'s rung-3 section. Not yet built: the rest of B-081
(counterexample legibility) beyond the refusal sites, branch-and-bound
when a template outgrows enumeration, a surface form for catalogs.
The work plan, its stages, the rulings it asks for and its chunk log are
`docs/plans/planning-pilot.md`. The backlog items are B-079 (this
revalidation), B-151 (the pilot's stages), B-081 (legibility, deferred),
B-093 (packaging). The proposal that Vision §4 name the pilot roster and
the Shape 1/Shape 2 staging is in the plan, for the maintainer to land
or decline; this chapter does not pre-empt it.
