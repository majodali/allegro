// The bindings of the present tree's src/test/base.ts. Each present text
// is an inner block, so each may bind x again; its value is printed.
// realises: test:base:simple binding
// realises: test:base:binding with expression
// realises: test:base:multiple bindings
// realises: test:base:binding chain
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
// end: completed
