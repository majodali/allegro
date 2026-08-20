# Plan: Provability by Construction — Phase C and the dual arcs

## Context

Allegro's foundation (Phases 1–7) gave us types, pattern matching, refinement
types, partial evaluation, an extensible grammar, modules with hygienic
templates, and an analyzer that runs over the language's own grammar. The
language can express real programs and extend itself. What was missing was the
**thesis** that justifies this particular combination of features.

The thesis: **provable correctness and safety, framed as the positive and
negative aspects of one unified property.** Yin and yang of the same story:

- **Positive — "the code does what it claims."** Verified through refinement
  types, contracts, predicate sets accumulated per binding, partial evaluation
  discharging predicates statically where possible.
- **Negative — "the code does *only* what it claims."** Verified through
  effect types, capability surfaces, taint tracking, behavioral budgets,
  intent declarations, and inferred-vs-declared behavior comparison.

Both halves rest on the same machinery: predicates flow through every binding,
partial evaluation discharges what it can and leaves runtime checks where it
can't, AI provides proof-search muscle by generating `[implementation, proof]`
pairs the compiler verifies independently, the human reviews semantic
summaries.

**The reviewability claim, refined:** *bottom-up disjointed code review is the
wrong approach.* The artifact a developer or reviewer sees is still code —
but presented through a cohesive, trustworthy, top-down view that surfaces
inferred types, effects, discharged invariants, predicate sets, semantic
diffs, and behavioral boundaries. The code is the substrate; the layered
semantic view is the lens. Allegro's architecture is uniquely positioned for
this because code IS a traversable expression graph, types ARE values
computed via partial evaluation, grammars ARE user-extensible, and proofs
CAN be structural.

**The user experience stays simple.** A developer writes what looks like plain
Allegro Vivace. The formal machinery lives in the standard library and the
analyzer, not in user code. The developer inherits safety guarantees without
writing formal specifications. They see a **safety grade** — "proven safe;
behavioral surface: pure" — backed by the layered view they can drill into
when they want detail. Not a theorem-prover transcript.

## Design principles

These are the rules every Phase C-and-beyond decision is checked against:

1. **Formal work concentrates in libraries and DSLs.** A developer writing a
   web app should not be typing `requires`/`ensures`. Library functions carry
   the contracts; the developer's code inherits and composes them.

2. **Inferences visible, annotations optional.** What the compiler proved is
   always available to display; what the user must write stays minimal.

3. **Safety grade, not proof transcript.** The default is "this module is
   proven safe" or "X warnings about Y unproven sub-expressions." The
   theorem-prover detail is opt-in.

4. **Escape hatches are loud.** Code that can't be proven is tagged
   `partial`/`unsafe`/`unproven`. Default gradient: fully-proven →
   partially-proven → explicitly-unsafe.

5. **Progressive disclosure.** Beginner writes normal code; everything
   inferred; "looks good." Intermediate adds targeted invariants. Advanced
   writes proof tactics. Every level is stable on its own.

6. **Performance never traded for safety.** If an invariant check is expensive
   at runtime, the answer is "better proof" or "better algorithm," not
   "drop the check."

7. **AI as collaborator, not replacement.** AI generates `[implementation,
   proof]` pairs; the compiler verifies; the human reviews semantic
   summaries. All three first-class.

8. **Positive and negative are one property.** A function's *correctness
   contract* (what it computes, the positive) and its *effect surface* (what
   it touches, the negative) are two faces of the same provability. Both are
   verified through the same predicate-set + partial-evaluation machinery;
   both are visible in the same safety summary; both feed the same review
   workflow. The system never separates them.

## Status

### Phase A — Reviewable foundation [LANDED]

Surfaced what the compiler already knows.

- `src/introspect.ts`: graph-walker producing `ValueSummary` and
  `ModuleSummary`, including type names, resolution status, node count,
  external symbols, primitives called.
- `safetyGrade(report)`: `proven-safe` / `partial` / `has-warnings` /
  `has-errors`. Placeholder grade made richer by Phase B+.
- CLI: `allegro inspect <file>` emits the rendered summary.
- Web sandbox: "Inspect" button on every demo; coloured grade badge.

### Phase B — Refinements as proof substrate [LANDED]

Refinements moved from runtime-only predicate checks to a real proof
substrate the compiler reasons about.

- `src/refinements.ts`: `AbstractDomain` (interval, equality, inequality,
  opaque); `domainFromPredicate` recogniser; `intersectDomains` /
  `joinDomains` / `impliesDomain` lattice ops; `propagateAdd` / `propagateSub`
  / `propagateMul` for arithmetic.
- Evaluator's `applyPrimitive` propagates domains onto results when at least
  one operand carries one. Pure-literal arithmetic stays uninstrumented so
  Allegretto and unrefined Standard code see no behaviour change.
- Subtyping check: `type_check_impl` and `checkRefinementPredicate` try
  abstract-domain implication BEFORE the runtime predicate. A value with
  domain `≥ 4` passed to a function expecting `_ > 0` discharges statically.
- Counterexample messages: failing checks include the violated constraint and
  the actual value (`refinement check failed: expected ≥ 1 (got -5)`).
- Pilot: `lib/math.alg` adds `PositiveInt`, `NonNeg`, `double_pos`. Demos:
  `tests/refinement-propagation-demo.alg`, `tests/refinement-subtype-demo.alg`,
  `tests/math-pilot-demo.alg`.

### Phase C — Invariants as first-class pervasive syntax [LANDED]

Phase C ships in four chunks (see `docs/plans/lucid-discharging-lambek.md`
for the tactical plan).

- **Chunk 1 — predicate sets per binding.** `PredicateSet` carries multiple
  `Predicate`s with source attribution (refinement-type, type-invariant,
  assert, branch-then, branch-else, requires, ensures, propagation, …).
  `applyPrimitive` propagates sets through arithmetic; the introspection
  summary surfaces each fact with its source.
- **Chunk 2 — branch-sensitive refinement + `assert` as statement.**
  `eval_if` derives branch predicates from the condition and pushes them
  onto a scope-local `scopePredicates` map carried on `ContextValue`.
  `assert P` (stmt_form in `lib/invariants.alg`) tries static discharge,
  narrows scope on success, halts with a counterexample on failure.
- **Chunk 3 — `requires` / `ensures` body-form contracts.** Function bodies
  declare contracts at the head; the tree-builder preprocessor hoists
  `requires` checks ahead of the body and wraps the result with
  `ensures_check` so the post-condition runs against the return value
  (with `_` bound to the result via a parse-time-built one-param lambda).
  Static discharge via predicate-set entailment short-circuits both
  runtime checks. Introspection lists requires/ensures distinctly and
  flags in-body asserts that reference only function params as
  candidates for promotion to `requires`.
- **Chunk 4 — `Type.invariant`.** Type-internal lifecycle invariants
  checked on construction (and re-checked when transformations produce a
  value of the type). Multi-clause chaining; per-clause failure messages.

Below is the original finalised scope.

## Phase C — Detailed spec

**Scope.** Invariants — predicates the user states about values and operations
— become first-class throughout the language. Partial evaluation either
discharges them or generates runtime checks; both paths leave the predicate
in the binding's predicate set so downstream code can rely on it. The set is
the substrate the AI prover will reason over.

### Operators delivered in Phase C

#### `assert P` — the universal predicate operator

Statement form. References in-scope bindings by name in `P`. Semantics:

- Partial evaluation tries to discharge `P` from the binding's accumulated
  predicate set. Success → no residual, no runtime cost; `P` is added to the
  set so downstream code can rely on it.
- Failure to discharge → a residual runtime check. The check is a branch:
  the success path (after the check) has `P` in its predicate set; the
  failure path produces an error value with a counterexample.

Crucial unification: there is **no separate "contract attachment" form**.
Under proper partial evaluation, an `assert` either evaporates or becomes a
branch — and in both cases downstream code accumulates `P` as a fact.
"Assert" and "contract attachment" are the same operator viewed from
different ends of the discharge.

```alg
y = compute(x)
assert y > 0           // unambiguous: refers to the binding y
result = process(y)    // process inherits the fact y > 0 in its scope
```

```alg
result = divide(a, b)
assert result * b == a    // multi-binding predicate; both result and b
                          // are in scope and contribute to the predicate set
```

#### `requires P` — caller's obligation

Body-form clause at function entry. Semantically equivalent to `assert P` of
the function arguments — but communicates a *contract role* the type-checker
uses to:

- generate proof obligations at every call site (caller verifies `P` from
  caller-context predicate sets);
- *assume* `P` inside the function body without further checking;
- surface in the function's published interface (the safety summary).

```alg
divide(a, b) =>
  requires b != 0
  a / b
```

#### `ensures P` — implementer's guarantee

Body-form clause at function exit. Semantically equivalent to `assert P` on
the return value — `_` references the result. Type-checker uses it to:

- generate proof obligations at every return point (implementer verifies
  `P` holds);
- attach `P` to caller's predicate set on the result, so the caller can rely
  on it without re-checking;
- surface in the function's published interface.

```alg
abs(x: Int): Int =>
  ensures _ >= 0
  if x >= 0 then x else 0 - x
```

#### `invariant P` — type-internal lifecycle predicate (Phase C MVP)

Attached to a *type definition* via the fluent API (initially). Holds for
every instance of the type, throughout that instance's lifetime: every
constructor checks; every transformation that produces a new instance of
the type re-checks `P` against the new value.

```alg
Account = Type.fields({balance: Int, owner: String})
            .invariant(self => self.balance >= 0)
```

This is structurally a refinement that lives on the type rather than on a
single binding. It composes with refinement types: a typed value of
`Account` can never be in a state violating the invariant.

Other forms of `invariant` (function-context, module-internal, loop /
recursion as distinct constructs) are deferred to Phase D — see "Deferred
from Phase C" below.

### Operators deliberately deferred from Phase C

- **`assume P`** — no escape hatch from provability yet. Trust boundaries
  use the *constructor pattern*: the validator IS the type's constructor;
  values of the type are provably valid by construction. We'll see how far
  this gets us before reintroducing `assume`. If real cases force its
  return, it'll come back with mandatory justification + safety-grade
  penalty.

- **Function-context invariants** — "throughout this function, account.balance
  ≥ 0." Needs tracking value derivations through arbitrary code; substantial
  machinery beyond Phase C. → Phase D.

- **Inline-signature `requires` / `ensures`** — `f(x) requires P =>` style.
  Body-form first; signature integration when concrete demand emerges.

- **Module-level strictness annotations** — single global `--strict` flag
  for now; per-module annotation when noise volume tells us we need it.

- **Paranoid runtime mode** (`--paranoid` running every assert regardless of
  static discharge) — useful for testing/CI/fuzz, not for normal builds.
  Build later when we have soak-test infrastructure to feed it.

- **Loop-invariant abstraction distinct from `assert`** — asserts cover the
  use case for now. The classical-formal-methods notion (deliberately
  weakened invariant designed to enable inductive proof) gets a `weaken`
  form when we hit cases that need it.

- **Weakening assertions for provability** — file for later. Real cases
  will tell us whether we need a special form or whether the prover can
  derive weaker forms automatically.

- **Change-scope statements** — file for later. Some functions will benefit
  from saying "these properties hold across the entire function call;
  these other things are subject to change." Anchors stable contracts in
  the face of internal evolution. Filed.

### Machinery delivered in Phase C

#### Predicate sets per binding

Each binding accumulates a *set* of predicates as facts. The set is built
by:

- the binding's type (refinement domains contribute facts);
- explicit `assert` / `requires` / `ensures` along the binding's path;
- branch refinement (entering an `if` branch adds the condition or its
  negation);
- propagation through partial evaluation (Phase B's domain rules apply, but
  generalised — facts not just intervals).

Basic processing in Phase C:
- Deduplication (factual equivalence via simple algebraic identity).
- Simple Horn-clause merging where it falls out trivially (`p > 0` and
  `p < 10` combine to `0 < p < 10`).
- **No deeper reasoning online.** The set is preserved verbatim until the
  prover (or the AI proof search) is invoked.

Key principle the user articulated: *carry around whole phonebooks of metadata
and let downstream proof attempts use what they need.* The system isn't
trying to keep predicates in canonical minimal form; it's trying to keep
them *available* so the prover has material to work with.

#### Branch-sensitive refinement

`if cond then A else B`: at A's entry, `cond` is added to the in-scope
predicate set; at B's entry, `not cond`. At branch exit, the join is the
disjunction of the two paths' resulting sets.

This is non-negotiable for Phase C — without it, control flow erodes most
predicate knowledge and the system is significantly less useful.

#### Sink-based runtime check generation

The user's principle: *don't check at every internal operation; check at
the last possible point — the call site or boundary that demands the
property.*

When a value enters a function with a `requires P`, the analyzer either
discharges `P` from the value's accumulated predicate set or generates a
runtime check **at the call site**. Internal operations on the value don't
re-check; the value carries `P` as a fact through the predicate set. Only
sinks (call sites with stronger requires, return values feeding stricter
ensures, etc.) trigger checks.

This is the practical answer to the "predicates everywhere" cost: the
predicates are *tracked* everywhere, but *checked* only at sinks.

#### Predicate-set introspection

The Phase A safety report extends to display each binding's accumulated
predicate set (in addition to its type and effective domain). The AI proof
search reads this to know what facts are available; human reviewers see
which facts are proved versus runtime-residual.

#### `--strict` global flag

CLI flag that turns "unresolved assert" warnings into errors. In dev mode
unresolved asserts (those that became runtime residuals) are reported as
*warnings* in the safety summary; with `--strict` they become *errors*
that fail the build. CI / pre-merge typically run `--strict`.

Per-call-site granularity: a predicate that's "unresolvable in general"
might be discharge-able at specific call sites because of context. The
warning fires per-call-site, not per-source-definition.

### Suggestion-based assert propagation (warning, not contract)

When an `assert P(x)` inside a function references *only* parameters and
module-level constants, the analyzer flags it as an "implicit precondition"
and emits a *suggestion* to promote it to `requires`. The user either
accepts (the contract becomes explicit; callers must satisfy `P`) or
ignores (the assert remains local; runtime check fires from the body).

Critical that this is a suggestion, not silent contract-drift: function
interfaces stay explicit; refactoring the body doesn't change the visible
contract.

### Failure mode: counterexamples at sinks

When a runtime check fires at a sink and fails, the error message must
convey:

- the predicate that failed (rendered from its abstract domain or from the
  source);
- the concrete value (the counterexample);
- the call-site origin (where the check was generated);
- the binding's accumulated predicate set (what facts WERE known) — to
  help the developer see whether they missed a `requires` upstream.

This UX is non-trivial and ships best-effort in Phase C with refinement
in later phases.

### Implementation outline

Roughly four commit-sized chunks:

1. **Predicate sets per binding.** Replace `domain` (single AbstractDomain)
   with a `predicates` set on `MultiValue` components, holding multiple
   facts. Update `applyPrimitive` to merge predicate sets through arithmetic
   propagation. Basic dedup via `intersectDomains`-style structural
   equality. Update `introspect.ts` to render the set.

2. **Branch-sensitive refinement + assert as statement.** Extend the
   when/is/then and if/then/else evaluators to push branch conditions onto
   the in-scope predicate context. Add `assert P` as a statement that
   evaluates `P` against the current scope's predicate context, attaching
   `P` to the relevant binding's set on success-path. Wire to
   `--strict` flag for residual-assert warnings.

3. **`requires` / `ensures` as body-form clauses.** Grammar extension
   adding `requires P` and `ensures P` at the start of a function body.
   Lower to assert-at-entry / assert-at-exit semantics. Update the
   safety summary to list the function's contract obligations and what
   each call site discharged.

4. **`invariant` via fluent API + `lib/math.alg` extensions.** Add
   `Type.invariant(self => P)` that retypes the constructor to enforce
   `P`. Use it to add an invariant on `PositiveInt` / `NonNeg`. Then
   pilot a couple of richer types in the standard library.

### Verification

- Existing tests pass.
- New tests exercise: predicate-set accumulation across arithmetic,
  branch-sensitive refinement, sink-based check generation, contract
  promotion suggestions, type-invariant enforcement.
- A new sandbox demo shows `inspect` displaying predicate sets and
  contract status on a function-rich example.
- `lib/math.alg` pilot: a function with `requires` discharged statically
  at a call site that satisfies it; a runtime check at a call site that
  doesn't.

## Phase D arc — the negative aspect (D1 through D5)

Phase D was originally "effect types." Conversation revealed it's better
viewed as a **five-step sub-arc** delivering the negative aspect of the
unified provability story. Each step adds another layer to "what does this
code do, and is that all it does?"

### Phase D1 — Effect types (basic categories)

Function signatures include effect sets: `pure`, `io`, `net`, `time`,
`rand`, `mutation`. Inferred from the primitives transitively called. A
`pure` subtype-check accepts `pure` where `io` isn't allowed. Effect sets
flow through compositions and are visible in the safety summary.

This is the first piece of "what does this function actually do?" the
analyzer can answer with confidence.

### Phase D2 — Capability types (refined effects)

Not just `network` but `connects to api.example.com:443`. Not just
`filesystem` but `reads /etc/config`, `writes /var/log/app.log`. A
function's signature lists exact resources it can reach. Module-level
*capability budget* — the union of every function's capabilities, the
auditable surface.

This is what catches the "library that claims to be a date parser but
makes a network call" case.

### Phase D3 — Information flow / taint tracking

Secret-tagged values cannot reach untrusted-output primitives without
explicit declassification. A logger that logs passwords fails compilation.
Form: types carry taint labels; primitives are tagged with the labels they
sink/source; the type checker enforces the flow constraints.

This catches the "auth helper that accidentally logs secrets" case.

### Phase D4 — Behavioral budgets

Every function has a *budget*: node count, primitive calls, complexity
class, recursion depth, allocation count. A "simple sort" that suddenly
has 5000 nodes and reaches into the network primitive trips an alarm.
The safety summary shows the budgets; CI can enforce.

This catches *bloat* — code that does more than its declared role
suggests.

### Phase D5 — Behavioral specs (declared intent)

Intent declared in the function header (or alongside the contract):
machine-readable, the analyzer verifies inferred behavior matches.
Discrepancies between *declared* intent and *inferred* behavior are
warnings or errors — depending on strictness mode.

This is where AI-generated code becomes safely review-able: the AI
declares intent; the analyzer verifies the implementation matches; the
human reviews the matched/unmatched delta.

## Phase E–J — Outline (unchanged)

These remain as outlined originally:

- **Phase E — Totality and termination analysis.** All functions provably
  total or explicitly marked `partial`. Exhaustive pattern matching;
  termination metrics for recursive functions.

- **Phase F — Proof infrastructure.** Proof terms as first-class values.
  Tactic library. Counterexample-driven iteration. Proof audit trail.

- **Phase G — Provable standard library rewrite.** Every `lib/` module
  annotated with refinements, effects, totality proofs.

- **Phase H — AI collaboration protocol.** Machine-readable interface for
  AI to propose `[implementation, proof]` pairs; compiler verifies;
  iteration loop.

- **Phase I — Performance and code generation.** Now informed by both
  correctness proofs AND behavioral surfaces, codegen can specialise
  aggressively. Tree-shaking, bounds-elimination, unboxed numerics for
  refined types, dead-code removal proven safe.

- **Phase J — Review UX.** Semantic summary as the primary artifact;
  proof status, effect surface, behavioral budget, intent vs. inferred
  behavior delta. Drill-down to code only when needed.

## Future considerations (filed, not scoped)

Items raised during design discussion, deferred until evidence makes the
right design clearer:

- **`assume`** — under what conditions, with what justification format,
  with what safety-grade penalty. Wait for cases where constructor pattern
  + paranoid mode genuinely fails.

- **Weakening assertions for provability** — when the strongest fact is
  too specific to induct on, the prover may need a deliberately-weaker
  invariant. Surface form (`weaken P`?), automatic derivation, or both.

- **Change-scope statements** — declare what's stable vs. what's in flux
  across a function's evolution. Refactoring within stable scope is
  invisible to callers; refactoring across stable scope is a contract
  change.

- **Function-context invariants** — once we have stronger value-derivation
  tracking, "throughout this function, X ≥ 0" becomes expressible.

- **Per-module strictness annotations** — when global `--strict` is too
  blunt.

- **Multi-typed predicate language** — beyond simple integer intervals;
  predicates over collections, strings, custom types.

## Risks acknowledged (captured for ongoing attention)

- **Predicate set explosion.** Aggressive dedup is required; deep online
  reasoning is forbidden; AI-driven offline proof search is the safety
  valve. We will measure set sizes early and cap if necessary.

- **Counterexample UX is hard.** "Predicate set on the value didn't
  include the needed fact, but did include something close" — needs
  thought. Ship best-effort first; refine.

- **Combinatorial blow-up during exploratory reasoning.** When AI proof
  search is invoked, the explosion can make tooling unusable. Cap
  iteration depth; cap candidate-rule evaluation; surface "search budget
  exhausted" cleanly.

- **Paranoid mode performance.** Running every assert at every call is
  expensive in production. Restrict to soak / fuzz / troubleshooting
  contexts; never normal builds.

- **Predicate-vs-type proliferation.** Two ways to express constraints
  (refinement type vs. body-form contract) means stylistic decisions
  become design questions. Provide guidance: "shape-of-thing" → type;
  "relationship-among-things" → contract.

- **Non-local contract drift via assert promotion.** Mitigated by
  suggestion-not-silent: contracts only become explicit when the user
  promotes them.

## What success looks like

After Phase C ships, this should be writeable on the website:

> Define `divide(a, b) => requires b != 0; a / b`. Call `divide(x, 5)` and
> observe: no runtime check generated, the requires was discharged at
> compile time. Call `divide(x, get_user_input())` and observe a runtime
> check generated AT THE CALL SITE, with a counterexample message if it
> fails. Look at the safety summary: every binding shows its accumulated
> predicate set. Hover any expression: see what facts are known about it.

After Phase D2 lands:

> This module declares effects: `[pure]`. The analyzer infers `[pure]`. ✓
> declared = inferred. This other module declares `[network]` but the
> analyzer infers `[network, filesystem]`. Mismatch: build fails. The
> developer either updates the declaration (now visible to consumers) or
> fixes the unintended filesystem access.

After Phase D5 lands:

> AI generates a function. Declared intent: "validate an email address
> string." Inferred behavior: "regex-matches; accesses no I/O; complexity
> O(n)." Match. Reviewed in 8 seconds.

After Phase J:

> Pull request review: 3 functions, 47 lines. Semantic diff: tightened a
> refinement; added input validation that promotes a previously-implicit
> precondition to an explicit `requires`. All proofs still discharge. New
> behavioral surface unchanged from main: still `[pure]`. No effects added.
> Estimated review time: 30 seconds.

That's the payoff. Phase C is the next concrete step.

## Verification of the plan itself

The plan succeeds if, after Phase C ships, we can demo:

1. Predicate sets visible in the safety summary, accumulating through
   arithmetic, conditionals, and explicit asserts.
2. A runtime check generated AT a call site (sink), not at every
   internal operation, when a value's accumulated set doesn't entail the
   target requires.
3. A contract promoted from `assert` to explicit `requires` by user choice
   (analyzer suggested; user accepted; interface now explicit).
4. A type-internal `invariant` enforced by every constructor and
   transformation; an attempt to construct a value violating it produces
   a counterexample-bearing error.

If we hit those four checkpoints, Phase C has validated the architecture
for the rest of the arc.

## Scope boundaries

Out of scope for Phase C (deferred to specific later phases as listed
above): `assume`, function-context invariants, signature-form `requires`/
`ensures`, module-level strictness, paranoid mode, weakening, change-scope,
loop-invariant-distinct-from-assert, the full negative-aspect arc (Phases
D1–D5: effects, capabilities, information flow, behavioral budgets,
behavioral specs), totality / termination (Phase E), proof terms (Phase F),
provable stdlib rewrite (Phase G), AI proof protocol (Phase H), codegen
(Phase I), review UX refinements (Phase J).

This keeps Phase C tractable — estimated 6–10 commits — while delivering
genuine value: every binding has visible facts; every contract is checked
where it matters; every counterexample says enough to act on.
