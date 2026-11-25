// A claim decided on every call the program makes, and waiting for every
// argument. Under check the program as written calls positive with 3 and
// with 5, and the claim is decided on each. The shipped checks then go
// into positive for every argument, by default (arguments on): there n is
// unknown, and the claim waits. The two lists are kept apart. A claim that
// waits refutes nothing, so the check completes.
capability output
positive(n) => claim(n > 0)
positive(3)
positive(5)
// phases: check
// end: completed
// claim at: 8:16 decided
// broader claim at: 8:16 waiting
// summary: decided
