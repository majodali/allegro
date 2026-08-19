// Rung 2, scene 3 — physics theorems and the honest ledger.
//
// The DSL inherited the entire proof surface by drawing ONE bundle:
// Quantity draws Equatable, so its law obligations are recorded, the
// proof_trans gate arms over quantities, and every tier renders in
// the verdict — in domain vocabulary.
use units

// Physics facts discharge at compile time through partial evaluation.
theorem km_scale: 1 km == 1000 m
theorem min_scale: 90 min == 1.5 h
theorem newton_ident: 1 N == 1 kg·m/s^2
verify (9.8 m/s^2).mul(2 s) == 19.6 m/s

// F = ma through the refinement-typed signature.
force_of(mass: Mass, acc: Acceleration): Force => mass.mul(acc)
theorem f_ma: force_of(2 kg, 9.8 m/s^2) == 19.6 N

// The strict gate: proof_trans over quantities is REFUSED while
// Quantity's transitivity is neither proven nor admitted. Uncomment
// (and remove the Law.assume) to see the refusal name both outs:
//
//   qx = 5 m
//   theorem bad: qx == qx by proof_trans(proof_refl(qx), proof_refl(qx))
//
// See transcripts/03-gate.txt. The escape hatch — legal, and loud:
Law.assume(Quantity, "trans")

q = 5 m
theorem q_chain: q == q by proof_trans(proof_refl(q), proof_refl(q))
p = proof_trans(proof_refl(q), proof_refl(q))
print(p.lawTier)                      // expect: admitted

// `allegro verify` on this file renders the whole epistemic state:
// PE-discharged physics theorems, the ADMITTED trans with its backers
// in the assumption ledger, and the algebraic laws (mul_comm,
// conv_roundtrip) honestly PENDING — record-domain quantifiers await
// sample construction, and the verdict says so instead of rounding up.
print("physics with receipts")        // expect: physics with receipts
