// A claim that waits, reported at the level warning (waiting = warning). Under
// check the input n is unknown, so the claim over it waits, and so does
// the write's, since output is not yet given. Each is one message of that
// level, with its place.
capability output
input n
claim(n == 1)
output.write("ran")
// phases: check, run
// input: n = 1
// check: waiting = warning
// expect: ran
// end: completed
// reports: next/corpus/allegretto/m3/checks-waiting-warning.alg:7:1: warning: a claim of the program as written waits: the check could not decide it
// reports: next/corpus/allegretto/m3/checks-waiting-warning.alg:8:1: warning: a claim of the program as written waits: the check could not decide it
// check claim at: 7:1 waiting
// claim at: 7:1 decided
