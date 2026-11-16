// An indented block as a function's body, from the present tree's
// src/test/base.ts and src/test/grammar2-language.ts. The second is an
// inner block, so it may bind f again.
// realises: test:base:indentation block in function body
// realises: test:grammar2-language:grammar2/std: block expression as function body
capability output
f() =>
    x = 3
    y = x + 1
    y * 2
output.write(int.text(f()))
// expect: 8
again <-
  f() =>
    x = 3
    y = x + 1
    y * 2
  f()
output.write(int.text(again))
// expect: 8
// end: completed
