// Phase E Stage 2: structural termination check.
//
// For each recursive function, the analyzer looks for a parameter that
// strictly decreases on every recursive call AND has a refined type with a
// non-negative lower bound. Functions whose termination can't be proven
// surface a `totality-nontermination` notification (severity `info` by
// default).
//
// Stage 2 recognises the canonical arithmetic pattern (`n - K` for K > 0
// on a non-negative-bounded param). Stages 3-5 broaden this with user-
// supplied `decreases` metrics, mutual recursion, and higher-order
// propagation.

NonNeg = Int & _ >= 0

// Provably terminating: n: NonNeg decreases by 1 each call.
factorial(n: NonNeg): Int =>
  if n == 0 then 1 else n * factorial(n - 1)

// Provably terminating: same shape, different name.
sum_to(n: NonNeg): Int =>
  if n == 0 then 0 else n + sum_to(n - 1)

// Trivially terminating: non-recursive.
square(n: Int): Int => n * n

// Runtime behaviour — totality analyzer doesn't affect evaluation.
print(factorial(5))    // expect: 120
print(sum_to(10))      // expect: 55
print(square(7))       // expect: 49
