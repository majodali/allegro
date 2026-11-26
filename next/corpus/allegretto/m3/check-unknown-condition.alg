// Under check alone the input mode is unknown, so the check takes both
// branches of the conditional on it. Nothing reads x: unread on goes into
// it. The false claim in the first branch is reached and refuted, and the
// check ends the launch. A run would take one branch only.
capability output
input mode
x = if mode == 1 then claim(1 == 2) else 0
output.write("ok")
// phases: check
// check: unread = on
// end: refuted: a claim that is not true
// broader claim at: 7:23 refuted
// summary: undecided
