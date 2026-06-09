# Phase C — Implementation Breakdown

Tactical companion to `crystal-proving-curry.md`. That doc is the strategic
vision; this one is the working plan: file-level changes, dependency order,
specific commits.

## Goals (from the strategic plan)

After Phase C ships, Allegro can demonstrate:

1. **Predicate sets visible** in the safety summary, accumulating through
   arithmetic, conditionals, and explicit asserts.
2. **Runtime checks fire at sinks**, not at every internal operation.
3. **`assert` promoted to `requires`** by user choice (analyzer suggests;
   user accepts; interface explicit).
4. **Type-internal `invariant` enforced** by every constructor and
   transformation, with counterexample-bearing errors on violation.

Estimated scope: 4 chunks, roughly 6–10 commits total.

## Chunk 1 — Predicate sets per binding

**Goal.** Replace the single `AbstractDomain` we attach to a value (Phase B)
with a *set* of predicates. The set is the substrate for all downstream
proof-search; the user-visible introspection summary is read off it.

### Design choices

- **Representation.** A `Predicate` is `{ shape: AbstractDomain, source?:
  PredicateSource, originalExpr?: Value }`. The `shape` is recognised
  algebraic form (interval, eq, ne, opaque) — same union as Phase B.
  `source` records where the predicate came from (refinement type, assert,
  branch condition, contract clause); used for introspection rendering.
  `originalExpr` keeps the raw predicate value for runtime checks where
  the shape is opaque.

- **PredicateSet.** A typed array of `Predicate`. Order is insertion-order
  for stability; lookup is linear (sets stay small in practice — set sizes
  > ~20 are a smell we should investigate). A wrapper type
  (`PredicateSet`) so we can swap the backing implementation later.

- **Operations.**
  - `addPredicate(set, p)` — insert with structural-equality dedup.
  - `mergePredicateSets(a, b)` — set union with dedup (used at branch
    rejoins; for now a simple concat-and-dedup; intersection-style merge
    is a later optimisation).
  - `simplifyPredicateSet(set)` — fold `_ > a` ∧ `_ < b` to interval `(a, b)`,
    drop redundant facts implied by tighter ones. Trivial Horn-clause-like
    folding only — no deeper reasoning.
  - `entailsPredicate(set, target)` — does the set imply `target`? Linear
    scan testing each predicate with `impliesDomain`.

- **Storage on values.** A new MultiValue component `predicates` holding
  the encoded set. Existing `domain` component (single AbstractDomain)
  stays for backward compatibility but is deprecated; it's the first
  predicate of the set when both are present. Cleanup pass at end of
  Phase C drops `domain`.

- **Storage on types.** Refinement types continue to carry
  `__abstractDomain`; in Chunk 4 we add `__invariants: Predicate[]` for
  multi-predicate type invariants.

### Files affected

- **`src/refinements.ts`** — add `Predicate`, `PredicateSet`, set ops; keep
  AbstractDomain functions as-is.
- **`src/evaluator.ts`** — `applyPrimitive` reads operand sets, propagates
  to result via existing `propagateForPrimitive` plus simple union for
  unrelated facts.
- **`src/primitives.ts`** — `assert_invariant_impl`,
  `assume_invariant_impl`, `checkRefinementPredicate` read from sets;
  set lookup replaces single-domain lookup.
- **`src/types-std.ts`** — `buildRefinedType` populates the refinement's
  predicate as a single-element set.
- **`src/introspect.ts`** — render the set in safety summaries: each
  predicate on its own indented line, with source attribution.

### Tasks (commit-sized)

1. **Add the data structures.** Predicate, PredicateSet types in
   refinements.ts. addPredicate/mergePredicateSets/entailsPredicate
   functions. Tests for dedup, merge, entailment edge cases.

2. **Surface in MultiValue components.** New `predicates` component
   (encoded as a Context with hidden field `__predicateSet`, like
   `__abstractDomain` today). Helpers `predicatesOf(v)` and
   `withPredicates(v, set)` parallel to `domainOf` / `withDomain`.
   Backward-compat: `domainOf` still works; reads first predicate when
   only `predicates` is set.

3. **Migrate Phase B propagation.** `applyPrimitive` constructs the
   result's set: take operand sets, apply propagation rule for each
   relevant pair, union the results. Drop the singleton `domain` write;
   write the full set instead.

4. **Migrate consumers.** `assert_invariant_impl`,
   `checkRefinementPredicate` use `entailsPredicate` against the set.

5. **Introspection rendering.** `formatModuleSummary` walks predicates
   per binding, formats each with its source attribution. CLI output
   updated; web sandbox Inspect output updated.

6. **Cleanup.** Remove `domain` component writes once all consumers use
   sets. (This commit is the cleanup pass — defer to end of Phase C if
   risk-averse.)

### Verification

- All 638 existing tests pass.
- New tests: predicate-set accumulation across `bits_add` / `bits_mul` /
  `bits_sub` chains. Dedup of structurally-identical predicates from
  different sources. Merge correctness on join.
- Existing demos (`tests/refinement-propagation-demo.alg`,
  `tests/refinement-subtype-demo.alg`, `tests/math-pilot-demo.alg`)
  still produce correct output.
- `allegro inspect` on the propagation demo shows multiple-predicate
  bindings where applicable.

## Chunk 2 — Branch-sensitive refinement + `assert` as statement

**Goal.** `if cond then A else B` adds `cond` to A's accumulated predicate
context and `not cond` to B's. `assert P` becomes a statement form whose
semantics is "add P to the predicate context of every binding referenced
in P; runtime-check P if not statically discharged."

These two features share machinery: both rely on a *scope-local predicate
context* — a side-map from binding names to predicates that hold within
some lexical region.

### Design choices

- **Scope-local predicate map.** A new structure `ScopePredicates: Map<
  string, PredicateSet>` carried on the eval context (or a parallel side-map).
  When evaluating an expression, the resolved value of a binding is
  augmented at lookup-time with the scope's predicates for that name.

- **Branch entry.** When `eval_if(cond, then, else)` is fired:
  - Recognise the bindings referenced in `cond` (and in `cond`'s
    sub-expressions if simple — start with top-level conjuncts).
  - For each, derive the predicate(s) implied by `cond` being true (then-
    branch) or false (else-branch).
  - Push a new scope frame onto the eval context with these predicates;
    pop on branch exit.

- **`assert P` semantics.** Same machinery as branch entry, but the
  "branch" is "rest of the enclosing scope":
  - Recognise bindings referenced in P.
  - Derive predicates each gains if P is true.
  - Add to the enclosing scope's predicate map for the rest of the
    scope.
  - Generate runtime check that errors on false.

- **Runtime vs compile-time.** If the predicate is already entailed by
  the binding's set + scope predicates, no runtime check is generated
  (the assert becomes a no-op). Otherwise a `bits_check_or_error`
  primitive is emitted at the assert site.

- **Shape recognition for `assert E`.** `E` is a boolean expression;
  match on its structure:
  - `bindingName op literal` (e.g., `y > 0`) — derive predicate on
    bindingName.
  - `bindingName1 op bindingName2` (e.g., `a < b`) — relational; goes
    into a relational predicate set (Phase D-like, but a basic version
    here for `<`, `>`, `==`, `!=`).
  - Conjunction (`&&`) — split, recurse on each.
  - Other shapes — opaque; runtime check; no scope-local refinement.

- **Surface syntax.** `assert P` parses as a stmt_form via grammar
  extension. Lives in `lib/invariants.alg` (rewritten from current
  expression-form version).

### Files affected

- **`src/evaluator.ts`** — extend `eval_if_impl` (and the lazy `if/then/else`
  evaluator) with branch-entry scope frames. Resolve names against scope
  predicates.
- **`src/primitives.ts`** — `assert_stmt_impl` (new) handling shape
  recognition + scope-map update. Existing `assert_invariant_impl` stays
  for the explicit-lambda form.
- **`lib/invariants.alg`** — rewrite to add `assert P` as `stmt_form`.
  Drop the expression-form `assert pred then body` (or keep alongside
  for higher-order use; stylistic call).
- **`src/types.ts`** — extend ContextValue with optional
  `scopePredicates: Map<string, PredicateSet>`.
- **`src/runtime.ts`** — propagate scope predicates through eval
  callbacks.
- **`src/introspect.ts`** — surface scope-local predicates per binding
  context in safety summaries.

### Tasks (commit-sized)

1. **Scope-predicate context infrastructure.** Add the field; thread
   it through `evaluate` / `applyPrimitive` / name resolution. No
   behavior change yet — the field is empty.

2. **Branch entry + exit.** `eval_if_impl` derives branch predicates
   from `cond`, pushes scope frame for the matched branch, pops on
   return. Tests: a binding referenced in cond is refined inside the
   then-branch.

3. **`when/is/then` cases.** Each `is` branch knows the pattern was
   matched; lifts to scope predicates (e.g., `is 5 then`: scope says
   subject == 5).

4. **`assert P` statement form.** Parse via stmt_form. Recognise simple
   shapes; update scope predicates; generate runtime check primitive
   for non-discharged cases. Suggestion: when `assert` references only
   parameters and module-level constants, the analyzer flags it as an
   implicit precondition (printed in safety summary).

5. **`--strict` flag.** Bump non-discharged asserts from warnings to
   errors when set. CLI flag in `src/index.ts`.

### Verification

- New tests: branch refinement narrows predicate sets in then- and else-
  branches. `assert` statement adds predicate to subsequent binding
  references. `assert` shape mismatch (opaque predicate) falls back to
  runtime check cleanly.
- A demo file `tests/branch-refinement-demo.alg` showing branches with
  visible predicate refinement in the inspect output.
- A demo file `tests/assert-statement-demo.alg` exercising the new
  syntax with both discharged and runtime-residual asserts.

### Risks

- Scope predicates can grow unboundedly if not pruned at branch exit.
  Mitigation: clear scope predicates on scope exit; don't propagate
  upward unless explicitly joined.
- Shape recognition for `assert E` needs to handle Allegro's typed
  primitives (`typed_gt` etc.) as well as raw bits_gt — same as Phase B.
  Reuse the existing pattern table.

## Chunk 3 — `requires` / `ensures` as body-form clauses

**Goal.** Function bodies can begin with `requires P` and/or `ensures P`
clauses. `requires` is a caller obligation (proof obligation generated at
call sites; runtime check at function entry if not discharged). `ensures`
is an implementer guarantee (proof obligation generated at function
return; attached to the result's predicate set so callers can use it).

### Design choices

- **Surface form.** Body-leading clauses, separated from the main body
  by newlines:

  ```alg
  divide(a, b) =>
    requires b != 0
    ensures _ != 0 || a == 0
    a / b
  ```

  `_` in `ensures` refers to the return value (consistent with
  refinement-type predicate convention).

- **Lowering.** Via grammar extension in a new module
  `lib/contracts.alg`:
  - `requires P` → `assert P` at the function's entry (plus annotation
    that this is a contract obligation, not an internal assert).
  - `ensures P` → wrap the body in `let __r = body in assert P[_/__r]; __r`
    where `_` is rewritten to `__r`.

- **Caller-side proof obligations.** When the analyzer sees a call to
  a function whose `requires P` couldn't be discharged from the call
  site's predicate sets, it generates a runtime check before the call.
  The check is at the call site (sink-based), not at the function body's
  entry.

- **Returning ensures.** When ensures is present, the analyzer attaches
  the predicate to the return value's predicate set so callers see the
  fact. If ensures is opaque, the predicate is attached as opaque-
  source (callers get a fact-with-runtime-source, not a static fact).

- **Suggestion machinery from Chunk 2.** When an `assert` inside a
  function is detected as an implicit precondition, the safety summary
  emits a suggestion: "consider promoting `assert b != 0` to
  `requires b != 0`."

### Files affected

- **`lib/contracts.alg`** (new) — grammar module adding `requires` and
  `ensures` body-form clauses via stmt_form. Templates lower to
  scope-modifying / wrapping primitives.
- **`src/primitives.ts`** — `requires_impl` (essentially assert with
  contract-source annotation), `ensures_impl` (wraps the rest of the
  body with a return-value check).
- **`src/runtime.ts`** — call-site analyzer hook that checks unresolved
  `requires` against caller predicate sets, generates check at call
  site if needed.
- **`src/introspect.ts`** — function summaries list contracts: caller
  obligations, implementer guarantees, what was discharged where.

### Tasks (commit-sized)

1. **`requires P` lowering.** Grammar form + lowering primitive.
   Behaves like assert at entry, but tagged as contract-source. Tests:
   `requires b != 0` discharged at call site `divide(x, 5)`; runtime
   check at `divide(x, get_input())`.

2. **`ensures P` lowering.** Slightly trickier — needs the body's
   result to bind to `_` in P. Done via wrapping (let-bind result;
   evaluate ensures; return result). Tests: ensures attached to return
   value's predicate set, caller-side observation works.

3. **Sink-based runtime check generation.** Analyzer pass after
   compilation: for each function call with unresolved requires,
   emit a runtime check at the call site. This may require a new
   compilation phase or extension of `precompileFunctions`.

4. **Promotion suggestion (closing the loop from Chunk 2).** When the
   safety summary lists implicit-precondition suggestions, link them
   to the function. (UX: "function `f` line 12 — `assert b != 0`
   could be promoted to `requires b != 0`.")

### Verification

- New tests: requires discharged + runtime case; ensures attached to
  return; promotion suggestion fires correctly.
- A demo `tests/contracts-demo.alg` showing `divide` with both clauses,
  inspect output showing the contract surface.
- `lib/math.alg` extended with `divide` example using requires/ensures.

### Risks

- Lowering `ensures` correctly requires careful AST manipulation to
  bind `_` to the return value. The grammar template needs to construct
  a let-binding wrapper. Needs careful test coverage.
- Caller-side proof obligations are a new analysis pass; should land
  with adequate timing tests so we know the perf cost.

## Chunk 4 — `Type.invariant(pred)` + `lib/math.alg` pilot

**Goal.** Type definitions can declare invariants that hold for every
instance throughout the instance's lifetime. Constructors check;
transformations re-check. Pilot in `lib/math.alg` to demonstrate
inheritance from library to user code.

### Design choices

- **Fluent API.** `Type.invariant(pred)` is a new method on Type/
  NominalType that returns a new type with the predicate added to its
  invariant list. Multiple invariants chain:

  ```alg
  Account = Type.fields({balance: Int, owner: String})
              .invariant(self => self.balance >= 0)
              .invariant(self => self.owner != "")
  ```

- **Storage.** A new `__invariants: Predicate[]` binding on the type's
  Context. Each invariant is a Predicate with `source: "type-invariant"`
  and the predicate value as a unary function over `self`.

- **Constructor check.** The type's `__construct` (built by
  `buildFieldType` or the like) wraps the parent constructor: parent
  constructs, then iterate `__invariants`, check each, error on first
  failure.

- **Transformation check.** When a method/transformation produces a
  value of the type (detected by the result having the type as its
  type component), re-check invariants. (Phase C MVP: only enforced
  via constructor; transformation-level checking is a later
  refinement once we hit cases that need it.)

- **Inheritance.** A type derived via `extend` inherits invariants by
  default — they're part of the type's structural commitment.

### Files affected

- **`src/types-std.ts`** — `Type.invariant` method; `__invariants`
  storage; `__construct` wrapping logic.
- **`lib/math.alg`** — pilot use: `PositiveInt` and `NonNeg` migrate
  from `Int && _ > 0` form to `Type.invariant(self => self > 0)` form
  for consistency. Add a multi-field type (e.g., `Range = Type.fields
  ({lo: Int, hi: Int}).invariant(self => self.lo <= self.hi)`).
- **`src/introspect.ts`** — type summaries list invariants, with
  per-binding "satisfies invariant ✓" indicators.
- **`tests/`** — new demo files exercising single and multi-field
  invariants, with success and failure cases.

### Tasks (commit-sized)

1. **Add `Type.invariant`.** New method, storage, predicate list. Tests
   for single-invariant and chained-invariant types.

2. **Constructor wrapping.** `__construct` checks all invariants;
   errors on first failure with counterexample. Tests for success
   path (invariant holds), failure path (counterexample message).

3. **Pilot rewrite of `lib/math.alg`.** Migrate existing PositiveInt /
   NonNeg to invariant form. Add Range as a multi-field example.
   Update any consumers.

4. **Inspect rendering.** Show invariants in type summaries; show
   "satisfies invariant ✓" / "violates: …" per binding.

### Verification

- All tests pass.
- New tests: single invariant, multi invariant, multi-field invariant,
  inheritance through extend, failure with counterexample.
- Pilot demo `tests/invariant-demo.alg` showing Range type with both
  successful and failing constructions.

### Risks

- Multi-field invariants reference field accessors (e.g.,
  `self.balance`). The predicate is a ComposedFunction; the dot-access
  needs to work correctly when the field is itself partially evaluated.
  Existing dot-access machinery should handle but worth testing.
- Existing `Int && _ > 0` continues to work (refinement-type form);
  invariant form is the new alternative. They produce the same
  predicate set internally — just different surface syntax.

## Order of work

Strict dependency order:

1. **Chunk 1** (predicate sets) is pre-requisite for everything else.
   Land first; it doesn't change user-visible behavior much but
   reshapes the substrate.

2. **Chunk 2** (branch refinement + assert statement) depends on 1.
   Land second.

3. **Chunks 3 and 4** are independent of each other; both depend on
   1+2. Order between them: do 4 first because it's smaller and
   exercises the type-invariant path; chunk 3 is the bigger
   architectural piece (caller-side proof obligation pass).

So: 1 → 2 → 4 → 3.

## Open design decisions to settle as we go

These I plan to revisit during implementation rather than pre-commit:

- **Predicate-set encoding format**: do we expose them as Allegro
  Object values for user-level introspection, or keep them as opaque
  context fields? Opaque is simpler; exposing lets `lib/grammar-
  analyzer.alg`-style modules write tools in Allegro. Probably
  opaque first.

- **Relational predicates** (`a < b` joining two bindings). Phase C
  needs a basic version for asserts that reference two parameters.
  Full relational machinery is Phase D/E. Where to draw the line?
  Probably: support binary comparisons of bindings; defer arithmetic
  combinations (`a + b > c`) to Phase D.

- **`ensures` substitution of `_`**. The cleanest implementation
  rewrites `_` references in the predicate to the result-binding name
  before evaluation. Or we keep `_` as a magic name that resolves at
  eval time. Either works; pick the simpler.

- **When does the analyzer suggest promoting an assert to requires?**
  Conservative: only when assert references *only* parameters and
  module-level constants. Aggressive: also propagate through
  intermediate computations whose definition we can see. Start
  conservative.

## Verification of the implementation as a whole

After all four chunks land, this should work:

```alg
// lib/banking.alg
Account = Type.fields({balance: Int, owner: String})
            .invariant(self => self.balance >= 0)

deposit(account, amount) =>
  requires amount > 0
  ensures _.balance > account.balance
  Account({balance: account.balance + amount, owner: account.owner})

// consumer.alg
use banking

acc = Account({balance: 100, owner: "Alice"})
new_acc = deposit(acc, 50)               // requires discharged statically
                                         // ensures attached to result

assert new_acc.balance > 100             // discharged from ensures
print(new_acc.balance)                   // 150
```

`allegro inspect consumer.alg` shows:
- `acc` with `balance >= 0` invariant satisfied
- `deposit` call: requires discharged at call site; ensures attached
  to `new_acc`'s predicate set
- `new_acc` predicate set including `balance >= 0` (from invariant) and
  `balance > 100` (from ensures)
- The `assert new_acc.balance > 100` evaporates — already in the set

That's the full Phase C value loop. Each chunk adds a piece;
all four together deliver the demo.

## Updates to the strategic plan

After Phase C lands, update `crystal-proving-curry.md`:
- Mark Phase C as [LANDED] with concrete deliverable summary.
- Update "What success looks like" with the actual demo above.
- Refine Phase D arc with what we learned (predicate-set encoding
  decisions, scope-predicate machinery, etc.) so D1 builds cleanly.
