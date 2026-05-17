// Phase F2 — proof by refinement-domain entailment.
//
// `proof_refines(value, refinedType)` witnesses that a value provably
// inhabits a refinement type. The discharge runs through the SAME
// abstract-domain lattice (`impliesDomain`) that Phase B/C refinement
// checks use — no parallel proof infrastructure. It composes under
// `theorem` / `verify` because `proof_by_eval` passes Proof values
// through unchanged.

PositiveInt = Int & _ > 0
NonNeg      = Int & _ >= 0
SmallPos    = Int & _ > 0 && _ < 100

// Literal entailment: 5's domain (== 5) entails PositiveInt's (≥ 1).
theorem five_is_positive: proof_refines(5, PositiveInt)

// Boundary: 0 entails NonNeg (≥ 0) but would NOT entail PositiveInt.
theorem zero_is_nonneg: proof_refines(0, NonNeg)

// Predicate-set entailment: a constructed SmallPos carries domain [1, 99],
// which is a subset of NonNeg's [0, ∞) — the proof discharges statically.
half = SmallPos(50)
theorem half_is_nonneg: proof_refines(half, NonNeg)

// Anonymous one-shot form.
verify proof_refines(42, PositiveInt)

// Runtime behaviour is unaffected by proofs.
print(half)                          // expect: 50
print(SmallPos(50) + 0)              // expect: 50
