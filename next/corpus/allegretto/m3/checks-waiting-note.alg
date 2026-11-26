// A claim that waits, reported at the level note (waiting = note). Under
// check the input n is unknown, so the claim over it waits, and so does
// the write's, since output is not yet given. Each is one message of that
// level, with its place.
capability output
input n
claim(n == 1)
output.write("ran")
// phases: check, run
// input: n = 1
// check: waiting = note
// expect: ran
// end: completed
// reports: next/corpus/allegretto/m3/checks-waiting-note.alg:7:1: note: a claim of the program as written waits: the check could not decide it
// reports: next/corpus/allegretto/m3/checks-waiting-note.alg:8:1: note: a claim of the program as written waits: the check could not decide it
// check claim at: 7:1 waiting
// claim at: 7:1 decided
