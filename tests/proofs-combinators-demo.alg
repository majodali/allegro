// Phase F3 — proof combinators + `theorem NAME: P by <proofterm>`.
//
// refl / sym / trans / cong build equality proofs from equality proofs.
// The `by` clause checks the proof term against the stated proposition:
// it must establish *exactly* that fact, not merely be some discharged
// proof (so `theorem bad: 1 == 2 by proof_refl(5)` is rejected). Named
// theorems are ordinary referenceable bindings, so proofs compose.

// Reflexivity.
theorem refl_7: 7 == 7 by proof_refl(7)

// An equality discharged by evaluation carries its two sides, so it can
// feed the combinators.
theorem ab: 2 + 2 == 4
theorem ba: 4 == 2 + 2 by proof_sym(ab)

// Transitivity chains two named equality proofs through a shared term.
theorem bc: 4 == 8 / 2
theorem ac: 2 + 2 == 8 / 2 by proof_trans(ab, bc)

// Congruence lifts an equality through any function.
triple(x: Int): Int => x * 3
theorem t3: 3 == 1 + 2
theorem ft3: triple(3) == triple(1 + 2) by proof_cong(triple, t3)

// Combinators nest — the proof term is an ordinary expression.
theorem e1: 1 + 1 == 2
theorem e2: 2 == 6 / 3
theorem nested: 1 + 1 == 6 / 3 by proof_trans(e1, e2)

// Runtime behaviour is unaffected by proofs.
print(triple(3))                  // expect: 9
print(2 + 2)                      // expect: 4
