// The bindings of the present tree's src/test/base.ts and
// src/test/grammar2-language.ts. Each present text is an inner block, so
// each may bind x again; its value is printed. The text x = 42 then x is
// also the two cases of grammar2/base named below.
// realises: test:base:simple binding
// realises: test:base:binding with expression
// realises: test:base:multiple bindings
// realises: test:base:binding chain
// realises: test:grammar2-language:grammar2/base: simple binding
// realises: test:grammar2-language:grammar2/base: binding evaluates
// realises: test:grammar2-language:grammar2/std: continuation doesn't cross back to base column
capability output
simple <-
  x = 42
  x
output.write(int.text(simple))
// expect: 42
expression <-
  x = 3 + 4 * 2
  x
output.write(int.text(expression))
// expect: 11
multiple <-
  x = 10
  y = 20
  x + y
output.write(int.text(multiple))
// expect: 30
chain <-
  x = 5
  y = x + 1
  z = y * 2
  z
output.write(int.text(chain))
// expect: 12
separate <-
  x = 1
  y = 2
  x + y
output.write(int.text(separate))
// expect: 3
// end: completed
