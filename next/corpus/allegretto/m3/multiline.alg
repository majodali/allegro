// Expressions that span lines, from the present tree's
// src/test/grammar2-language.ts and src/test/language.ts. Each present
// text is an inner block, so each may bind its names again; its value is
// printed through int.text.
// realises: test:grammar2-language:grammar2/std: if-then-else can span lines
// realises: test:grammar2-language:grammar2/std: function body spans lines
// realises: test:grammar2-language:grammar2/std: binary operator continues onto next line
// realises: test:grammar2-language:grammar2/std: function call args spread across lines
// realises: test:language:multiline: if/then/else across lines
// realises: test:language:multiline: if with expression condition
// realises: test:language:multiline: binary operator continuation
// realises: test:language:multiline: function with multi-line if body
// realises: test:language:multiline: nested if in function with block
capability output
show(n) => output.write(int.text(n))
spanning <-
  x = 5
  if x > 0
    then x
    else 0 - x
show(spanning)
// expect: 5
body <-
  f(n) =>
    if n == 0
      then 1
      else n + 1
  f(0)
show(body)
// expect: 1
continued <-
  x = 1 +
      2 +
      3
  x
show(continued)
// expect: 6
spread <-
  f(a, b, c) => a + b + c
  f(
    1,
    2,
    3)
show(spread)
// expect: 6
across <-
  if true
      then 42
      else 0
show(across)
// expect: 42
condition <-
  x = 5
  if x > 0
      then x
      else 0 - x
show(condition)
// expect: 5
continuation <-
  a = 1 +
      2 +
      3
  a
show(continuation)
// expect: 6
absolute <-
  abs(x) =>
      if x > 0
          then x
          else 0 - x
  abs(0 - 5)
show(absolute)
// expect: 5
nested <-
  f(x) =>
      y = if x > 0
          then x * 2
          else 0
      y + 1
  f(5)
show(nested)
// expect: 11
// end: completed
