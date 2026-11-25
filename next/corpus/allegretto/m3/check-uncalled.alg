// Under check alone the shipped checks go into every function nothing
// calls, by default. So the false claim in a function nothing calls is
// reached and refuted in the broader analysis, and the check ends the
// launch. Run alone never calls the function, prints the line and
// completes. Nothing is performed under check, so nothing is printed.
capability output
unused(n) => claim(1 == 2)
output.write("hello")
// phases: check
// end: refuted: a claim that is not true
// broader claim at: 7:14 refuted
// summary: undecided
