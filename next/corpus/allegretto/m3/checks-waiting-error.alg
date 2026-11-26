// A claim that waits, reported at the level error (waiting = error). Under
// check the input n is unknown, so the claim over it waits, and so does
// the write's, since output is not yet given. Each is one message of that
// level, with its place. At the level error the check ends the launch
// at the end findings, and the run does not follow: nothing is printed.
capability output
input n
claim(n == 1)
output.write("ran")
// phases: check, run
// input: n = 1
// check: waiting = error
// end: findings: the check's findings hold 2 error(s)
// reports: next/corpus/allegretto/m3/checks-waiting-error.alg:8:1: error: a claim of the program as written waits: the check could not decide it
// reports: next/corpus/allegretto/m3/checks-waiting-error.alg:9:1: error: a claim of the program as written waits: the check could not decide it
// summary: undecided
