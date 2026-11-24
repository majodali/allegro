// A claim that holds lets the module go on.
capability output
square(n) => n * n
claim(square(7) == 49)
output.write("the claim holds")
// expect: the claim holds
claim(square(3) > square(2))
output.write("and so does this one")
// expect: and so does this one
// end: completed
// summary: decided
// Each claim as written is decided, at its place in this text.
// claim at: 4:1 decided
// claim at: 7:1 decided
