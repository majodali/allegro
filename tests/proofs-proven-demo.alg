// Phase F7 — `proven` clause on function declarations.
//
// `proven <prop>` attaches a theorem to the function being defined; the
// compiler verifies it at definition time by bounded sampling (K=4
// inputs over the param's type, Stage-7 minimum). This is the
// user-visible [implementation, proof] pair contract — AI agents in
// Phase H produce `impl + proven prop`, the compiler discharges by
// sampling, failure halts compilation with a concrete counterexample.

NonNeg = Int & _ >= 0

// Provably true on all NonNeg samples [0, 1, 2, 3].
sq(x: NonNeg): Int =>
  proven sq(x) >= 0
  x * x

// Two proven clauses compose — each is checked independently.
inc(x: NonNeg): NonNeg =>
  proven inc(x) > 0
  proven inc(x) > x
  x + 1

// Bool params enumerate the two values exhaustively.
neg(b: Bool): Bool =>
  proven neg(neg(b)) == b
  if b then false else true

// Runtime behaviour is unaffected by proofs.
print(sq(3))                       // expect: 9
print(inc(5))                      // expect: 6
print(neg(true))                   // expect: false
