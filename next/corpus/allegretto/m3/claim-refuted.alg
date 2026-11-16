// A claim that is refuted ends the run there: what is printed before it
// is printed, and nothing after it happens.
capability output
square(n) => n * n
output.write("before the claim")
// expect: before the claim
claim(square(3) == 10)
output.write("after the claim")
// end: refuted: a claim that is not true
