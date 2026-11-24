// A claim that is refuted ends the run there: what is printed before it
// is printed, and nothing after it happens.
capability output
square(n) => n * n
output.write("before the claim")
// expect: before the claim
claim(square(3) == 10)
output.write("after the claim")
// end: refuted: a claim that is not true
// summary: refuted
// The claim on line 7 is the refuted one. The write before it is a
// dropped statement, and its claim is decided.
// claim at: 5:1 decided
// claim at: 7:1 refuted
