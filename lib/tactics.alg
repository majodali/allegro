// Allegro Standard Library — Tactics (Phase F4)
//
// Higher-level proof tactics, composed purely from the F1–F3 proof
// primitives (`proof_refl` / `proof_sym` / `proof_trans` / `proof_cong`).
// No new host primitives — this module is the demonstration that the
// combinator core is expressive enough to build reusable proof
// strategies in Allegro itself.
//
// Every tactic returns a Proof. Pass them as the `by` term of a theorem
// (`theorem ac: a == c by tactics.chain([ab, bc])`) or bind them
// directly — `checkProofs` surfaces a failed tactic like any other
// failed proof.
//
//   import tactics
//
//   theorem ab: 2 + 2 == 4
//   theorem bc: 4 == 8 / 2
//   theorem ac: 2 + 2 == 8 / 2 by tactics.chain([ab, bc])

// `same(x)` — reflexivity, read as a tactic: prove `x == x`.
export same(x) => proof_refl(x)

// `flip(p)` — symmetry: from a proof of `a == b`, get `b == a`.
export flip(p) => proof_sym(p)

// `under(f, p)` — congruence: lift `a == b` to `f(a) == f(b)`.
export under(f, p) => proof_cong(f, p)

// `step(p1, p2)` — a single transitivity step (binary `chain`).
export step(p1, p2) => proof_trans(p1, p2)

// `chain(ps)` — equational reasoning over a list of equality proofs.
// `[a==b, b==c, c==d]` folds to a proof of `a == d`. The shared middle
// terms must line up (proof_trans enforces this; a mismatch produces a
// failed proof that checkProofs reports).
export chain(ps) =>
  ps.slice(1, ps.length).reduce((acc, p) => proof_trans(acc, p), ps[0])

// `rewrite(eqAB, f, eqFAC)` — substitute `a` by `b` inside `f`.
// Given `a == b` and `f(a) == c`, derive `f(b) == c`:
//   f(b) == f(a)   [cong f over (sym eqAB)]
//   f(a) == c      [eqFAC]
//   ∴ f(b) == c    [trans]
export rewrite(eqAB, f, eqFAC) =>
  proof_trans(proof_cong(f, proof_sym(eqAB)), eqFAC)

// Phase F5 wrappers — readable aliases for the universal-quantification
// proof constructors. `by_cases_bool(p)` proves `∀b: Bool, p(b)` by
// enumerating the two values. `by_induction(p, base, step)` proves
// `∀n: NonNeg, p(n)` via bounded sample verification (Stage F5 minimum
// — full symbolic induction is a follow-on).
export by_cases_bool(p) => prove_for_all_bool(p)
export by_induction(p, base, step) => prove_induction(p, base, step)
