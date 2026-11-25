// Check, then test. The shipped checks go into every function nothing
// calls, by default, so the check reaches the false claim in the function
// no test calls and refutes it. The check ends the launch, and no test is called.
// Under the test phase alone the test passes and its line is printed.
capability output
unused(n) => claim(1 == 2)
export greets() => output.write("the test was called")
// phases: check, test
// end: refuted: a claim that is not true
// broader claim at: 6:14 refuted
