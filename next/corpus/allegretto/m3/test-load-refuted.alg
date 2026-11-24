// A test module whose load is refuted: the false claim at the top level is
// recorded when the module function is called, and it holds the statement
// after it. The load does not complete, so no test is called, and the
// line the test would print is not printed.
capability output
claim(2 + 2 == 5)
output.write("after the claim")
export prints() => output.write("the test was called")
// phases: test
// end: refuted: a claim that is not true
// claim at: 6:1 refuted
