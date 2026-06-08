// Benchmark obligation t08 — rewrite (cong + sym + trans).
//
// Category: combinator (rewrite). The hardest combinator obligation:
// given `3 == 1 + 2` (ab2) and `inc(3) == 4` (fac), prove
// `inc(1 + 2) == 4`. The proof rewrites `1 + 2` back to `3` under
// `inc` (`proof_cong(inc, proof_sym(ab2))` gives `inc(1+2) == inc(3)`)
// then chains with `fac` via `proof_trans`. This is `tactics.rewrite`
// unfolded into raw combinators.
inc(x: Int): Int => x + 1
theorem ab2: 3 == 1 + 2
theorem fac: inc(3) == 4
theorem goal: inc(1 + 2) == 4 by proof_trans(proof_cong(inc, proof_sym(ab2)), fac)
