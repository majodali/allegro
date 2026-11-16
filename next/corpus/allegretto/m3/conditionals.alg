// The conditionals of the present tree's src/test/base.ts, each value
// printed through int.text. The two texts that bind x are inner blocks.
// realises: test:base:if true branch
// realises: test:base:if false branch
// realises: test:base:if with expressions
// realises: test:base:if with negative (else branch)
// realises: test:base:if-then-else low precedence (else captures full expr)
capability output
show(n) => output.write(int.text(n))
show(if 1 == 1 then 42 else 0)
// expect: 42
show(if 1 == 2 then 42 else 0)
// expect: 0
positive <-
  x = 5
  if x > 0 then x else 0 - x
show(positive)
// expect: 5
negative <-
  x = -3
  if x > 0 then x else 0 - x
show(negative)
// expect: 3
show(if 0 == 1 then 0 else 6 * 7)
// expect: 42
// end: completed
