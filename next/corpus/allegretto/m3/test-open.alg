// A test module that marks no export: it yields every binding, so every
// function of no parameters it binds is a test, in the order written. The
// function with a parameter is no test, and neither is the number.
capability output
double(n) => n * 2
doubles() => claim(double(4) == 8)
base = 5
adds_base() => claim(base + 1 == 6)
// phases: test
// test: doubles: passed
// test: adds_base: passed
// end: completed
