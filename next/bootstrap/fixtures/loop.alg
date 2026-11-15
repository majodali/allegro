// A recursion whose state of knowledge repeats. The reference kernel
// opens every call, so only the step budget ends it (kernel chunk K5).
loop(x) => loop(x)
loop(true)
