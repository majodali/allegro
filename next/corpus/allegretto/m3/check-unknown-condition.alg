// Under check alone the input mode is unknown, so the kernel's check
// takes both branches of the conditional on it. The false claim in the
// first branch is reached and refuted, and the check ends the launch. A
// run given a mode other than 1 would take the other branch only.
capability output
input mode
x = if mode == 1 then claim(1 == 2) else 0
output.write("ok")
// phases: check
// end: refuted: a claim that is not true
// claim at: 7:23 refuted
// summary: refuted
