// B-159 R1 precompile corpus: Phase E Stage 3, `f(n: Int)` with `decreases n`
// (src/test/totality.ts, "`decreases n` trusts unbounded Int").

f(n: Int): Int =>
  decreases_attach(
    if n == 0 then 0 else n + f(n - 1),
    n
  )
