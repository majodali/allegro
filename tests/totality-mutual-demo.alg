// Phase E Stage 4: mutual recursion via SCC.
//
// The analyzer computes strongly-connected components of the call graph
// and treats every cycle uniformly. Each cycle call must show structural
// decrease against the CALLEE's param types — so a function in a mutual-
// recursion cycle proves termination together with its partner.
//
// Stage 4 keeps the Stage 2 confidence policy: notifications fire only
// when the analyzer can prove the cycle is unbounded; partial / decreases
// opt-outs apply per-binding inside the cycle.

NonNeg = Int & _ >= 0

// Classic mutual recursion. Each step decreases n by 1; both params are
// NonNeg-bounded so the chain is bounded below. Stage 4 walks the SCC
// {isEven, isOdd} and discharges both cycle edges.
isEven(n: NonNeg): Int =>
  if n == 0 then 1 else isOdd(n - 1)

isOdd(n: NonNeg): Int =>
  if n == 0 then 0 else isEven(n - 1)

// Three-function cycle: f1 → f2 → f3 → f1. SCC = {f1, f2, f3}; each edge
// decreases. Clean.
f1(n: NonNeg): Int => if n == 0 then 0 else f2(n - 1)
f2(n: NonNeg): Int => if n == 0 then 0 else f3(n - 1)
f3(n: NonNeg): Int => if n == 0 then 0 else f1(n - 1)

// Runtime sanity — the totality analyzer doesn't change evaluation.
print(isEven(4))     // expect: 1
print(isOdd(7))      // expect: 1
print(f1(6))         // expect: 0
