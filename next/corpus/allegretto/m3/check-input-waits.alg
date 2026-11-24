// Under check alone every input is unknown. The claim over the input n
// waits on it, and the claim over nothing unknown is decided. A claim
// that waits is neither refuted nor logged (the maintainer, 2026-11-23),
// so the check finds no refutation and the launch completes. The summary
// counts the claim that waits as undecided.
capability output
input n
claim(n == 1)
claim(2 + 2 == 4)
// phases: check
// end: completed
// claim at: 8:1 waiting
// claim at: 9:1 decided
// summary: undecided
