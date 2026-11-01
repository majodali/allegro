// B-159 R1 precompile corpus: Phase E Stage 2, `factorial(n: NonNeg)`
// (src/test/totality.ts, "factorial with bounded NonNeg").

NonNeg = Int & _ >= 0
factorial(n: NonNeg): Int =>
  if n == 0 then 1 else n * factorial(n - 1)
