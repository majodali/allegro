// A test module with no test: no entry it yields is a function of no
// parameters. The load completes, no test is called, and the launch
// completes. The commands print "tests: 0 passed, 0 failed".
capability output
export double(n) => n * 2
export limit = 3
// phases: test
// end: completed
