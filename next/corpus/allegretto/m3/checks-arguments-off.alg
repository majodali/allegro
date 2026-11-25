// The program of checks-decided-waiting.alg with arguments off. The
// function a call opened is not gone into again for every argument, so
// the broader analysis has no record of its claim, and the check tells
// the function as untouched. The program as written decides the claim.
capability output
positive(n) => claim(n > 0)
positive(3)
positive(5)
// phases: check
// check: arguments = off
// end: completed
// claim at: 6:16 decided
// untouched: function 6:1
// summary: decided
