// Rung 1, scene 4 — laws, tiers, and the loud escape hatch.
// There is no boolean "verified": every law obligation resolves to a
// TIER (kernel / enumerated / sampled / witnessed / admitted /
// pending), and proofs record which tier backed them.

// Kernel equalities are auto-proven: transitivity over Int is backed
// at tier `kernel`, and the proof value says so.
theorem t_int: 1 == 1 by proof_trans(proof_refl(1), proof_refl(1))
p = proof_trans(proof_refl(7), proof_refl(7))
print(p.lawTier)                      // expect: kernel

// A custom equality: Cell draws Equatable and supplies its own eq.
// The refl/sym/trans obligations are RECORDED as pending — visible in
// `allegro verify` — never silently granted.
Cell = Type.define({x: Int, eq: (self, other) => self.x == other.x}, Equatable)
v = Cell(1)

// The strict gate: proof_trans over Cell values is REFUSED while
// Cell's transitivity is neither proven nor admitted. Uncomment:
//
//   theorem t_bad: v == v by proof_trans(proof_refl(v), proof_refl(v))
//
//   → proof check failed: theorem `t_bad`: `v == v` — `by` proof
//     failed: transitivity of 'Cell' is neither proven nor admitted
//     (counterexample: the custom equality 'Cell' has no discharged,
//     sampled, or admitted 'trans' law — witness it
//     (Law.witness(Cell, "trans", proof)) or admit it
//     (Law.assume(Cell, "trans")))
//
// See transcripts/04-gate.txt for the captured output.

// The escape hatch is legal — and loud. Admit the assumption:
Law.assume(Cell, "trans")

// The gate opens, but nothing is upgraded for free: the proof records
// `admitted` backing, and `allegro verify` renders the obligation as
// ADMITTED plus a weakness note on every proof resting on it.
theorem t_cell: v == v by proof_trans(proof_refl(v), proof_refl(v))
q = proof_trans(proof_refl(v), proof_refl(v))
print(q.lawTier)                      // expect: admitted

// Or do it properly: witness a real proof and the note disappears.
Cell2 = Type.define({x: Bool, eq: (self, other) => self.x == other.x}, Equatable)
Law.witness(Cell2, "refl", prove_for_all_bool(b => b == b))
print("laws carry their strength")    // expect: laws carry their strength
