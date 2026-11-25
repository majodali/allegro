// A false claim in a binding nothing reads. By default (unread off) the
// shipped checks do not go into it: the check completes, and tells the
// binding as untouched.
capability output
x = claim(1 == 2)
output.write("hello")
// phases: check
// end: completed
// untouched: binding 5:5
