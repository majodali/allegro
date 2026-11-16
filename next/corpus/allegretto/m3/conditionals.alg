// The conditionals of the present tree's src/test/base.ts,
// src/test/types-battery.ts, src/test/language.ts and
// src/test/refinements.ts, each value printed through int.text. The texts
// that bind x are inner blocks. The text if 1 == 1 then 42 else 0 is also
// the case multiline: single-line if unchanged.
// realises: test:base:if true branch
// realises: test:base:if false branch
// realises: test:base:if with expressions
// realises: test:base:if with negative (else branch)
// realises: test:base:if-then-else low precedence (else captures full expr)
// realises: test:types-battery:partial eval: eval_if with resolved condition evaluates chosen branch
// realises: test:language:multiline: single-line if unchanged
// realises: test:refinements:Phase C Chunk 2: then-branch narrows binding by condition
// realises: test:refinements:Phase C Chunk 2: else-branch narrows binding by negated condition
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
show(if true then 42 else 0)
// expect: 42
big <-
  x = 200
  big = if x > 100 then x + 50 else 0
  big
show(big)
// expect: 250
narrowed <-
  x = 0 - 5
  y = if x > 0 then x + 10 else 0 - x
  y
show(narrowed)
// expect: 5
// end: completed
