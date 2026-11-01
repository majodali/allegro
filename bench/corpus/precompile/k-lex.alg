// B-159 R1 precompile corpus: Phase E Stage 3, `k(a, b)` with `decreases [a, b]`
// (src/test/totality.ts, "lex-tuple metric verifies positional decrease").

k(a: Int, b: Int): Int =>
  decreases_attach(
    if a == 0 then b else b + k(a - 1, b),
    typed_array(a, b)
  )
