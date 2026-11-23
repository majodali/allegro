// A test module with three tests, run under the test phase. Each export
// that is a function of no parameters is a test, called in order by an
// evaluation of its own. Two pass. The second is refuted by its false
// claim, written at line 13, column 3, and that ends it alone: the third
// is still called. The launch ends as the refuted test ended.
capability output
square(n) => n * n
export squares() => claim(square(7) == 49)
export adds() =>
  claim(2 + 2 == 4)
export wrong() =>
  claim(square(3) == 9)
  claim(square(3) == 10)
export last() => claim(square(0) == 0)
// phases: test
// test: squares: passed
// test: adds: passed
// test: wrong: refuted: a claim that is not true
// test: last: passed
// end: refuted: a claim that is not true
