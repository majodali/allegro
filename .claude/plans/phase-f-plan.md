# Phase F — Proof Terms as First-Class Values (Plan)

Status: draft for user review. Not yet sliced into commits.

## Thesis

Phase E made the analyzer prove totality automatically. Phase F lets users *state*
properties the analyzer can't infer and provide proofs the compiler can check.
A proof is a Value (like an Effect or a Type), produced by proof-building
primitives or tactic combinators, and verified by partial evaluation +
predicate-set entailment — the *same* machinery refinements, contracts, and
effects already use.

Aligns with the thesis in `memory/design_provability_thesis.md`:
- **PE-as-discharge is primary.** A proof reduces (via PE) to evidence the
  compiler can mechanically check.
- **AI [impl, proof] pairs are the bet.** Phase F is the substrate for the
  proof half of those pairs.
- **SMT is a use-case fallback**, not foundational. Phase F's MVP does not
  depend on SMT.

And the design constraint from `memory/design_proof_exportability.md`:
- Proof terms should be shaped so they translate cleanly to external checkers
  (Lean / Coq). This is a *long-term* design goal — don't bake in
  evaluation-only constructs.

## What "proof" means here

A proposition is an Allegro expression that, when partially evaluated, reduces
to a Bool. Examples:
- `5 > 0` (literal — reduces to `true`)
- `factorial(5) == 120` (call — PE evaluates both sides)
- `forall x: PositiveInt, x * x > 0` (universally quantified — needs
  inductive / refinement-domain reasoning)

A proof is a Value of type `Proof[<proposition>]` that witnesses the
proposition's truth. Internally a proof carries enough information for the
compiler to mechanically check it. Externally, it can (long-term) be exported
to Lean / Coq.

## Two-property surface

| Question | Mechanism | Today's machinery it reuses |
|---|---|---|
| Does `prop` hold for *concrete* values? | `proof_by_eval(prop)` — PE the expression; check it folds to `true`. | The interpreter (Stages A/F1 of effects use this). |
| Does `prop` hold for all values in a *refined domain*? | `proof_refines(value, refinedType)` — abstract-domain entailment via `impliesDomain`. | Phase B/C predicate-set machinery. |
| Does `prop` hold *by induction* over a recursive structure? | `proof_induction(prop, base, step)` — base + step proofs combined. | Stage E2 structural-decrease reasoning (the well-foundedness witness). |
| Composition (modus ponens, refl, trans, sym) | Proof-combinator primitives. | None — new infrastructure. |

## Proposed chunks (smallest → largest)

### F1 — Proof meta-type + `proof_by_eval` + `theorem` body-form (MVP)

**What.** A `Proof` core type (analogous to `Effect`, `Type`). A primitive
`proof_by_eval(prop)` that PEs the proposition; succeeds if it folds to
`true`; otherwise emits a compilation error with the counterexample (reusing
Stage 6 machinery). A surface body-form: `theorem name: <prop> => <proof>`
that binds the proof at the module level.

**Storage.** A theorem is just a binding. The proof Value's type carries a
reference to the proposition it witnesses. Failed proofs become
`Notification`s with `kind = "proof-failure"` and a counterexample.

**Bytes.** ~150–200 lines: a new `proof_by_eval` primitive, the `theorem`
stmt_form, and `checkTheorems` in a new `src/proofs.ts`.

**Test surface.** `theorem _: 5 > 0 => proof_by_eval(5 > 0)` succeeds.
`theorem _: 5 < 0 => proof_by_eval(5 < 0)` fails with a counterexample.

### F2 — `proof_refines` for refinement membership

**What.** `proof_refines(value, refinedType)` — witnesses that `value`'s
abstract domain entails `refinedType`'s predicate. Discharges via the
existing `impliesDomain` lattice. Lets users name and reuse such proofs.

**Bytes.** ~80 lines, all reuse — primitive + tests.

**Composes with F1**: `theorem positive_sum: forall a b: PositiveInt, a + b > 0
=> proof_refines(a + b, PositiveInt)` (with universal-quantification surface
deferred to F5).

### F3 — Proof combinators (refl / sym / trans / congruence)

**What.** Primitives that build proofs from proofs:
- `proof_refl(x)`: `x == x` (reflexivity).
- `proof_sym(p)`: from `a == b`, produce `b == a`.
- `proof_trans(p1, p2)`: from `a == b` and `b == c`, produce `a == c`.
- `proof_cong(f, p)`: from `a == b`, produce `f(a) == f(b)`.

Each combinator is checked structurally at AST level (the typecheck on the
proof primitive's args verifies the shape).

**Bytes.** ~200 lines (one primitive per combinator + structural checks).

### F4 — Allegro-side tactic library

**What.** `lib/tactics.alg` builds higher-level helpers from F1–F3:
- `tactic_by_cases(scrutinee, proofs_per_case)` — discharges a proposition
  by case-splitting a finite-domain scrutinee.
- `tactic_by_rewrite(eq_proof, target_proof)` — substitutes via an equality.

Pure Allegro code; no new primitives.

**Bytes.** ~150 lines of `.alg`.

### F5 — Universal quantification + inductive proofs

**What.** Surface syntax `forall x: T, prop(x)`. Two new discharge mechanisms:
- For finite domains (Bool): `tactic_by_cases` from F4.
- For Int / Array: `proof_induction(prop, base_proof, step_proof)` where
  step is `forall n, prop(n) -> prop(n+1)`.

The well-foundedness comes from the same `NonNeg` / typed-param machinery
Stage E2 uses for termination.

**Bytes.** ~300 lines (grammar, primitives, predicate-set integration).

### F6 — Lean term export

**What.** `allegro export <file> --target lean`. Map proofs to Lean proof
terms; map refinement types to Lean `{x : Int // P x}`. Ship a
verified-substrate `Allegro.lean` library that the exported terms reference.

This is the design-driven, long-term chunk. It's substantial and orthogonal
to F1–F5; could be deferred to its own phase.

**Bytes.** ~500+ lines + the verified substrate.

### F7 — `proven` clause on function declarations ([impl, proof] pairs)

**What.** A function declaration carries a proof about itself:
```
square(x: Int): Int =>
  proven (square(x) >= 0)
  x * x
```
Compiler checks the proof at definition time. Connects directly to Phase H
(AI proposes [impl, proof] pairs).

**Bytes.** ~150 lines (grammar surface + analyzer hook into existing
theorem-checking machinery).

## Suggested first chunk

**F1** is the smallest deliverable that lands the substrate. After it ships,
the user has a usable `theorem` form for concrete propositions, and the
infrastructure for F2–F7 is in place.

## Open design questions

1. **Surface for proofs.** Do users write proofs directly (`theorem _ =>
   proof_by_eval(P)`), or are they auto-derived for the common case
   (`verify P`)? Plan assumes both; `verify` is sugar.
2. **Proof storage.** Inline value vs. side-table? Plan favors inline
   (a binding like any other).
3. **Failure severity.** Failed proofs as `error` (halt compilation) or
   `info` (visible but non-blocking)? Plan favors `error` — a failed proof
   is unsound by construction.
4. **Counterexample propagation.** Reuse Stage 6's machinery? Yes — every
   failed `proof_by_eval` should carry the falsifying assignment.
