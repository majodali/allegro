// A condition is a truth value. A number as a condition is a refutation,
// by the maintainer's ruling of 2026-11-17: the present tree's
// src/test/grammar2-language.ts takes 1 as true and answers 42.
// realises: test:grammar2-language:grammar2/base: if-then-else selects branch
capability output
output.write(int.text(if true then 42 else 0))
// expect: 42
output.write(int.text(if 1 then 42 else 0))
output.write("never printed")
// end: refuted: a condition that is neither true nor false
