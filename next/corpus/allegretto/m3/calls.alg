// The functions, lambdas and closures of the present tree's
// src/test/base.ts. Each present text is an inner block, so each may bind
// its function again; its value is printed.
// realises: test:base:simple function
// realises: test:base:two-param function
// realises: test:base:function call as argument
// realises: test:base:lambda: single param
// realises: test:base:lambda: multi param
// realises: test:base:lambda: zero param (thunk)
// realises: test:base:higher-order function
// realises: test:base:function returning value used in expression
// realises: test:base:function shadowing binding
capability output
show(n) => output.write(int.text(n))
simple <-
  double(n) => n * 2
  double(21)
show(simple)
// expect: 42
two <-
  add(x, y) => x + y
  add(3, 4)
show(two)
// expect: 7
nested <-
  double(n) => n * 2
  double(double(5))
show(nested)
// expect: 20
single <-
  apply(f, x) => f(x)
  apply(x => x + 1, 5)
show(single)
// expect: 6
multi <-
  apply(f, x, y) => f(x, y)
  apply((a, b) => a * b, 6, 7)
show(multi)
// expect: 42
thunk <-
  run(f) => f()
  run(() => 42)
show(thunk)
// expect: 42
higher <-
  apply(f, x) => f(x)
  apply(x => x + 10, 32)
show(higher)
// expect: 42
used <-
  double(n) => n * 2
  1 + double(20)
show(used)
// expect: 41
shadowing <-
  x = 100
  f(x) => x + 1
  f(5)
show(shadowing)
// expect: 6
// end: completed
