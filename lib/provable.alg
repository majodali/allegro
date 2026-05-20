// Allegro Standard Library — Provable (Phase G pilot)
//
// A small set of utility functions whose correctness properties are
// expressed as named theorems checked at module load time. Each theorem
// discharges through the Phase F proof machinery:
//
//   - F1 PE-as-discharge for concrete-input facts (`abs(0) == 0`)
//   - F3 combinators (`proof_refl`) for reflexive equalities
//   - F5 universal-Bool quantification for involution laws
//
// No `use` headers and no cross-lib imports — every primitive used here
// (`proof_refl`, `prove_for_all_bool`, …) is in the standard env. The
// `theorem`/`verify` syntax is base-grammar.
//
// This is the demonstration: stdlib functions that walk the talk of the
// provability arc.

// =============================================================================
// Absolute value
// =============================================================================

export abs(x: Int): Int => if x >= 0 then x else 0 - x

// Concrete-input facts (F1 — discharged by partial evaluation).
theorem abs_zero:    abs(0) == 0
theorem abs_pos:     abs(7) == 7
theorem abs_neg:     abs(0 - 9) == 9
theorem abs_large:   abs(0 - 1000) == 1000

// Idempotence on a specific positive input: abs(abs(13)) == abs(13).
// PE folds both sides to 13; the equality holds reflexively.
theorem abs_idem_13: abs(abs(13)) == abs(13)

// =============================================================================
// Sign
// =============================================================================

export sign(x: Int): Int =>
  if x > 0 then 1
  else if x < 0 then 0 - 1
  else 0

theorem sign_pos_one:   sign(1) == 1
theorem sign_pos_large: sign(99) == 1
theorem sign_neg:       sign(0 - 7) == 0 - 1
theorem sign_zero:      sign(0) == 0

// =============================================================================
// Square
// =============================================================================

export square(x: Int): Int => x * x

theorem square_zero: square(0) == 0
theorem square_one:  square(1) == 1
theorem square_two:  square(2) == 4
theorem square_neg:  square(0 - 4) == 16  // negatives square to positives

// =============================================================================
// Min / max
// =============================================================================

export min2(a: Int, b: Int): Int => if a <= b then a else b
export max2(a: Int, b: Int): Int => if a >= b then a else b

theorem min2_pair: min2(3, 7) == 3
theorem min2_swap: min2(7, 3) == 3
theorem max2_pair: max2(3, 7) == 7
theorem max2_swap: max2(7, 3) == 7

// `min(a, a) == a` (idempotence on a specific input).
theorem min2_idem_5: min2(5, 5) == 5
theorem max2_idem_5: max2(5, 5) == 5

// =============================================================================
// Boolean negation — proved universal over Bool via F5
// =============================================================================

export negate(b: Bool): Bool => if b then false else true

// PE-discharged single cases.
theorem negate_true:  negate(true)  == false
theorem negate_false: negate(false) == true

// Involution: `negate(negate(b)) == b` for ALL b ∈ {true, false}.
// `prove_for_all_bool` enumerates the domain — both cases must hold.
theorem negate_involutive: prove_for_all_bool(b => negate(negate(b)) == b)

// =============================================================================
// Combinator demo — F3 in lib code
// =============================================================================

// Same fact, proved via `proof_refl` directly. Demonstrates that proof
// combinators are available without any import.
theorem square_refl: square(3) == square(3) by proof_refl(square(3))
