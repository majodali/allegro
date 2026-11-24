// Check, then run, where the check finds a false claim written after a
// write. The check performs nothing and reaches the claim, so it ends the
// launch before the run, and nothing is printed. Run alone prints the
// line first, and is refuted only when the write has answered and the
// claim it held is evaluated. That is what check adds.
capability output
output.write("hello")
claim(2 + 2 == 5)
// phases: check, run
// end: refuted: a claim that is not true
// claim at: 8:1 refuted
