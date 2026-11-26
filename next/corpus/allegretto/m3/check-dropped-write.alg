// Under check alone a write is a call on output, which is not yet given:
// it waits, and nothing is printed. The write is a statement whose value
// is dropped, so in a run it holds the claim after it until it answers.
// The check evaluates what is held ahead, so the false claim
// written after the write is reached and refuted, and the check ends the
// launch.
capability output
output.write("hello")
claim(2 + 2 == 5)
// phases: check
// end: refuted: a claim that is not true
// claim at: 8:1 waiting
// claim at: 9:1 refuted
