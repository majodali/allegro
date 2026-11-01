// B-159 R1 precompile corpus: Phase E Stage 2, `factorial(n: Int)`
// (src/test/totality.ts, "factorial with unbounded Int").

factorial(n: Int): Int =>
  if n == 0 then 1 else n * factorial(n - 1)
