// Phase F4 — the tactic library (lib/tactics.alg).
//
// Every tactic here is pure Allegro composing the F1–F3 proof
// primitives — no new host machinery. This file is the end-to-end
// demonstration that the combinator core is expressive enough to build
// reusable proof strategies in the language itself.

import tactics

// `same` — reflexivity as a tactic.
theorem refl9: 9 == 9 by tactics.same(9)

// `flip` — symmetry. `ab` is discharged by evaluation and carries its
// two sides, so the tactic can consume it.
theorem ab: 3 + 1 == 4
theorem ba: 4 == 3 + 1 by tactics.flip(ab)

// `chain` — equational reasoning over a list. The shared middle terms
// must line up; a mismatch would surface as a failed proof.
theorem e1: 1 + 1 == 2
theorem e2: 2 == 6 / 3
theorem e3: 6 / 3 == 2 * 1
theorem chained: 1 + 1 == 2 * 1 by tactics.chain([e1, e2, e3])

// `under` — congruence: lift an equality through a function.
sq(x: Int): Int => x * x
theorem base: 4 == 2 + 2
theorem lifted: sq(4) == sq(2 + 2) by tactics.under(sq, base)

// `rewrite` — substitute a == b inside f, given f(a) == c ⊢ f(b) == c.
inc(x: Int): Int => x + 1
theorem ab2: 3 == 1 + 2
theorem fac: inc(3) == 4
theorem fbc: inc(1 + 2) == 4 by tactics.rewrite(ab2, inc, fac)

// Runtime behaviour is unaffected by proofs.
print(sq(4))                       // expect: 16
print(inc(3))                      // expect: 4
