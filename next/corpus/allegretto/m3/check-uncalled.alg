// Under check alone the kernel's check opens every function a module
// binds, called or not. So the false claim in a function nothing calls is
// reached and refuted, and the check ends the launch. Run alone never
// calls the function, prints the line and completes. Nothing is performed
// under check, so nothing is printed.
capability output
unused(n) => claim(1 == 2)
output.write("hello")
// phases: check
// end: refuted: a claim that is not true
// claim at: 7:14 refuted
// summary: refuted
