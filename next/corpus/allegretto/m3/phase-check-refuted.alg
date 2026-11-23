// Under check alone a false claim written before any effect is refuted,
// and the check ends the launch. Nothing is performed under check, so the
// write after it never happens, and nothing is printed.
capability output
claim(2 + 2 == 5)
output.write("never")
// phases: check
// end: refuted: a claim that is not true
// summary: refuted
