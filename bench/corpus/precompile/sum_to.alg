// B-159 R1 precompile corpus: `sum_to(n: NonNeg)`, the second recursive
// definition of tests/totality-termination-demo.alg, on its own.

NonNeg = Int & _ >= 0
sum_to(n: NonNeg): Int =>
  if n == 0 then 0 else n + sum_to(n - 1)
