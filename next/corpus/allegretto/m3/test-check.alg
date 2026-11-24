// Check, then test. The check opens every function the module binds,
// called or not, so it reaches the false claim in the function no test
// calls and refutes it. The check ends the launch, and no test is called.
// Under the test phase alone the test passes and its line is printed.
capability output
unused(n) => claim(1 == 2)
export greets() => output.write("the test was called")
// phases: check, test
// end: refuted: a claim that is not true
// claim at: 6:14 refuted
