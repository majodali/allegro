// B-092 U3 — laws and physics theorems in domain terms.
//
// Scale facts discharge at the PE tier through the custom normalized
// equality; the E4 proof_trans gate arms over quantities (Quantity
// draws Equatable); the escape hatch is legal and LOUD.
use units

// Concrete physics facts, discharged by partial evaluation.
theorem km_scale: 1 km == 1000 m
theorem min_scale: 90 min == 1.5 h
theorem newton_ident: 1 N == 1 kg·m/s^2
verify (9.8 m/s^2).mul(2 s) == 19.6 m/s

// F = ma, end-to-end through the refinement-typed signature.
force_of(mass: Mass, acc: Acceleration): Force => mass.mul(acc)
theorem f_ma: force_of(2 kg, 9.8 m/s^2) == 19.6 N

// Quantity conforms to Equatable by declaration.
print((1 m) instanceof Equatable)     // expect: true

// The E4 strict gate over quantities: proof_trans is REFUSED while
// Quantity's transitivity is neither proven nor admitted. Uncomment
// (and remove the Law.assume below) to see:
//
//   qx = 5 m
//   theorem bad: qx == qx by proof_trans(proof_refl(qx), proof_refl(qx))
//
//   → `by` proof failed: transitivity of 'Quantity' is neither proven
//     nor admitted — witness it (Law.witness(Quantity, "trans",
//     proof)) or admit it (Law.assume(Quantity, "trans"))
//
// The escape hatch — legal, and loud in the verdict's ledger:
Law.assume(Quantity, "trans")

q = 5 m
theorem q_chain: q == q by proof_trans(proof_refl(q), proof_refl(q))
p = proof_trans(proof_refl(q), proof_refl(q))
print(p.lawTier)                      // expect: admitted

// Run `allegro verify` on this file: the laws block shows the admitted
// trans (`!`), the pending refl/sym and the record-domain algebraic
// laws (`?` — no sample construction for record quantifiers yet), and
// the assumption ledger maps the admitted law to q_chain and p.
print("laws carry their strength")    // expect: laws carry their strength
