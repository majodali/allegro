// A function held in a list, never called. The list is a binding nothing
// reads, so by default the shipped checks do not go into it, and the
// function in it is never told: the check completes, and tells the
// binding as untouched.
capability output
handlers = [(n) => claim(1 == 2)]
output.write("hello")
// phases: check
// end: completed
// untouched: binding 6:12
