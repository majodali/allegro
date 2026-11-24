// A test module that marks exports. Its tests are the exported functions
// of no parameters, in the order written. The exported function with a
// parameter is no test, the function it does not export is no test, and
// the exported number is no test. The one that is not exported is never
// called, so its false claim refutes nothing.
capability output
export first() => claim(1 + 1 == 2)
export takes(n) => claim(n == n)
hidden() => claim(1 == 2)
export limit = 10
export second() => claim(10 - 1 == 9)
// phases: test
// test: first: passed
// test: second: passed
// end: completed
