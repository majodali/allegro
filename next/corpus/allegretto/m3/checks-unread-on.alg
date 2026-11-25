// The program of checks-unread.alg with unread on. The binding nothing
// reads is gone into, its false claim is refuted, and the check ends the
// launch.
capability output
x = claim(1 == 2)
output.write("hello")
// phases: check
// check: unread = on
// end: refuted: a claim that is not true
// broader claim at: 5:5 refuted
