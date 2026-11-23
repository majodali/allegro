// Check, then run, with an input. The check leaves the input n unknown,
// so the claim over it waits in the check's result. The run is given n,
// and prints it.
capability output
input n
claim(n == "given")
output.write(n)
// phases: check, run
// input: n = "given"
// check claim at: 6:1 waiting
// expect: given
// end: completed
