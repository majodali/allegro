// Benchmark obligation t06 — transitivity chain (3 links).
//
// Category: combinator (trans-chain). Three equality lemmas chain
// through shared middle terms. The proof nests two `proof_trans`
// applications (right-associated): `a==b`, `b==c`, `c==d ⊢ a==d`.
// This is the `tactics.chain([e1, e2, e3])` shape expressed with raw
// combinators.
theorem e1: 1 + 1 == 2
theorem e2: 2 == 6 / 3
theorem e3: 6 / 3 == 2 * 1
theorem goal: 1 + 1 == 2 * 1 by proof_trans(e1, proof_trans(e2, e3))
