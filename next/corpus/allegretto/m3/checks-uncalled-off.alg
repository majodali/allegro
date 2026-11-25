// The program of checks-uncalled.alg with uncalled off. Nothing goes into
// the function nothing calls, so its false claim is not reached: the check
// completes, and tells the function as untouched.
capability output
unused(n) => claim(1 == 2)
output.write("hello")
// phases: check
// check: uncalled = off
// end: completed
// untouched: function 5:1
