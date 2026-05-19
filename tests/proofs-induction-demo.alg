// Phase F5 — universal quantification + bounded induction.
//
// Two new proof constructors:
//   prove_for_all_bool(predicate)
//     — enumerates the Bool domain (∀b: Bool, predicate(b)).
//   prove_induction(predicate, base_proof, step_fn)
//     — proves ∀n: NonNeg, predicate(n) by BOUNDED SAMPLE VERIFICATION
//       (Stage-5 minimum: verifies base + 4 inductive steps). Full
//       symbolic induction over an unbounded n is a follow-on chunk.
//
// Both compose with `theorem` / `verify` because `proof_by_eval` passes
// Proof values through (F2). The tactics module re-exports them as
// `by_cases_bool` and `by_induction` for nicer reading.

import tactics

// Finite-domain quantification: tautology over Bool.
theorem bool_refl: prove_for_all_bool(b => b == b)

// Same, through the tactic wrapper.
theorem bool_refl_t: tactics.by_cases_bool(b => b == b)

// Bounded induction: P(n) = n + 0 == n. At each sample, PE folds
// `(n+1) + 0` to `n+1`, so `proof_refl(n+1)` discharges the step. The
// induction hypothesis isn't structurally needed for this PE-friendly
// claim — richer step proofs (using `ih`) become essential as predicates
// stop folding directly.
theorem base: 0 + 0 == 0
theorem add_zero_right: prove_induction(
  n => n + 0 == n,
  base,
  (n, ih) => proof_refl(n + 1))

// Same via the tactic wrapper.
theorem base2: 0 + 0 == 0
theorem add_zero_t: tactics.by_induction(
  n => n + 0 == n,
  base2,
  (n, ih) => proof_refl(n + 1))

// Runtime behaviour is unaffected by proofs.
print(5 + 0)                       // expect: 5
print(0 == 0)                      // expect: true
