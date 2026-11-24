// A test module that imports the module it tests, arith.alg beside it, and
// tests one of its functions. A test module is an ordinary text: the
// import is a binding, and the tests read it.
capability output
import arith
export divides() => claim(arith.gcd(12, 18) == 6)
export coprime() => claim(arith.gcd(7, 9) == 1)
// phases: test
// test: divides: passed
// test: coprime: passed
// end: completed
