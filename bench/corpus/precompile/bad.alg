// B-159 R1 precompile corpus: Phase E Stage 2, `bad(n: Int): Int => bad(n)`
// (src/test/totality.ts, "recursive call with no decreasing param fires").

bad(n: Int): Int => bad(n)
