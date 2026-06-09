# Phase E — Totality and Termination Analysis (Plan)

Status: draft for user review. Not yet sliced into commits.

## Thesis

Show — at compile time — that every function call **terminates** and **produces a
defined output for every input in its domain**. Partial functions exist but
require explicit opt-in (`partial` keyword). The check piggybacks on PE: the
analysis runs as a pass over the precompiled bodies, the way effect inference
does today.

This is the natural sibling to Phase D1: D1 made effects an inferred,
declarable property; E makes totality the same way.

## Two sub-properties

| | Question | Failure mode |
|---|---|---|
| **Exhaustiveness** | Does every input have a defined output? | `when x is 1 then …` falls through on `x = 2`; returns `none` silently today. |
| **Termination**     | Does every call return in finite time? | `loop(n) => loop(n)` runs forever; `divide(a, b) => a / b` is fine but only because the host language errors on `b = 0`. |

Both have well-studied substrates. We can stage them independently.

## Design questions to settle before code

1. **Default policy.** Three options:
   - **(a) Strict** — all functions must be provably total unless marked `partial`. Most informative; biggest break.
   - **(b) Opt-in** — `total f(x) => …` enables the check. Cheapest to ship.
   - **(c) Notify-by-default** — analyzer always runs; failures land in `notifications` with severity `info` by default; project config can promote to `error`. Consistent with how effect mismatches work after the F-cleanup.

   Recommendation: **(c)**. Matches the notification substrate just built; lets us ship the analyzer without breaking existing tests.

2. **Coverage policy on partial `when`.** Today `when x is 1 then "one"` returns `none` on miss. Does Phase E demand an `else` branch always, or only when the type isn't statically covered by the cases? (e.g., `when b is true then x is false then y` is total over Bool; no `else` needed.)

3. **Termination check defaults.** Structural recursion on a parameter is the easy case (`factorial(n)` decreases on `n`). General recursion (mutual, higher-order, non-structural) is hard. Three positions:
   - Auto-detect structural; require `decreases <expr>` clause for non-structural; `partial` for everything else.
   - Auto-detect structural; everything else is `partial` until proven.
   - Always require a `decreases` or `partial` annotation; no inference.

   Recommendation: auto-detect structural; `decreases` for hand-rolled metrics; `partial` opt-out otherwise.

4. **Refinement integration.** `n: PositiveInt; recurse on n - 1` — domain reasoning shows `n - 1 ≥ 0` and `< n`. Phase B's `AbstractDomain` already does this for arithmetic. Phase E can reuse it to discharge termination side-conditions.

5. **HOF totality.** `arr.map(f)` is total iff `f` is total and `arr` is finite (it is). This needs effect-style polymorphism: `map`'s totality depends on its callback's totality. Slice E should not block on this — start with first-order, generalise later.

6. **Counterexample shape.** When a function isn't provably total, what do we show?
   - For exhaustiveness: the missing input (`b: Bool, b = false` falls through).
   - For termination: a sample recursion chain that doesn't decrease (`loop(n) → loop(n)`).
   Reuses Phase J's eventual counterexample-rendering work.

## Suggested staging

### Stage 0 — Substrate
- `partial`/`total` keywords as no-op annotations (so source files can adopt them ahead of analysis).
- New `Notification.kind` tags reserved: `"totality-exhaustiveness"`, `"totality-nontermination"`, `"totality-needs-annotation"`.
- Default severity `info` for all three.
- Tests cover keyword parsing + annotation attachment; no real analysis yet.

Outcome: source files can be annotated; future stages plug in the analysis without surface-syntax churn.

### Stage 1 — Exhaustiveness for `when/is/then`
- Coverage check: for a `when expr is …` statement, walk the case list, verify the value's static type is covered.
- Cases: Bool (2 cases), tagged unions (sum types — currently we have nominal types with `__extends`; treat extending types as a closed sum if they share a single root), records (always single-case, so destructuring is exhaustive), Int / String / Float (uncountable — require `else`).
- Emit `totality-exhaustiveness` notification (severity per config) listing missing input shapes.
- Refinement-aware: if `n: PositiveInt`, `when n is 0 then …` is dead code (counterexample-free); analyzer marks it.

Outcome: `when` statements opt-in to totality through coverage. Existing code that lacks `else` runs unchanged at `info` severity; projects that want hardness promote to `error`.

### Stage 2 — Structural termination for recursion
- Detect recursive calls in function bodies.
- Identify a "recursion variable" that decreases: a param `n` such that every recursive call passes `n - k` for `k > 0`, or a subterm of a structurally smaller value (`arr.slice(1)`).
- Domain-aware: use the abstract domain from Phase B (`PositiveInt` → `Int & _ > 0`) to verify the recursion variable stays non-negative.
- Emit `totality-nontermination` notification when no decreasing variable can be found.
- Mutual recursion: a chain `f → g → f` requires a common lexicographic measure; skip for Stage 2, defer to Stage 4.

Outcome: first-order, single-recursion functions get proven total automatically; everything else needs `decreases` or `partial`.

### Stage 3 — `decreases` body-form clause
- `decreases <expr>` body-form, parallel to `requires`/`ensures`/`effects`.
- Body preprocessor extracts the clause; analyzer uses the user-supplied metric instead of (or in addition to) auto-detected ones.
- Metric must itself be total; abstract-domain check proves the metric decreases on each recursive call.
- Example: `ackermann(m, n) => decreases (m, n); …` (lexicographic pair).

Outcome: hand-rolled metrics for non-structural recursion.

### Stage 4 — Mutual recursion + lexicographic
- Detect call cycles via a static call graph over the function bindings.
- Each cycle needs a shared metric; require `decreases` annotations on each function in the cycle, all decreasing in a common lexicographic order.
- Emit notification when the cycle has no consistent measure.

Outcome: state machines and small-step interpreters become provably terminating.

### Stage 5 — Higher-order propagation
- `arr.map(f)`: total iff `f` is total. Polymorphic totality, structurally like effects polymorphism with `[t: Totality]` markers.
- Stdlib HOFs annotated polymorphic; user HOFs can declare.
- Bare param call (`g(x)` on unbounded `g`) is conservatively partial.

Outcome: stdlib HOFs propagate totality precisely; user HOFs explicit.

### Stage 6 — Counterexample rendering
- For non-terminating loops: a sample recursion trace (`loop(5) → loop(5) → loop(5) …`).
- For partial coverage: a witness input (`when b is true then … missing: b = false`).
- Surfaces in the introspect summary + notification message.

Outcome: failures legible to non-experts.

## What Phase E does NOT include

- Proof certificates (deferred to Phase F).
- Coq/Lean export (Phase F or later).
- Termination of effectful loops driven by external state (deferred — needs algebraic effects).
- Sized types as a first-class type-level concept (could come later; Stage 2+3 use abstract domains as the lightweight substitute).

## What's adjacent in the backlog

- Provability arc Phase E (this plan).
- "Patterns as boolean expressions with unification" — distant relative; could simplify pattern matching but not on the critical path.
- "Continuation-based TCO Stage 2" — orthogonal; totality is about whether it terminates, TCO is about how cheaply.

## Recommendation for entry point

Stages 0 → 1 → 2 land the substrate and the highest-value checks. Stage 3 (`decreases`) gives users an escape hatch when auto-detection fails. Stages 4–6 are refinement work that can ship later.

I'd suggest **Stage 0 + Stage 1 as a single first commit** (substrate + exhaustiveness): the substrate is mechanical and the exhaustiveness check is the most visible win for `when/is/then` users. Stage 2 (structural termination) is the second commit — bigger, but well-bounded.
