// A function and its application: a binding of a function, a function
// written in place, a function of two parameters, and one as a value.
capability output
greet(name) => "hello, " ++ name
output.write(greet("world"))
// expect: hello, world
output.write(((a, b) => b ++ a)("one", "two"))
// expect: twoone
twice(f, x) => f(f(x))
output.write(twice(s => s ++ "!", "hey"))
// expect: hey!!
output.write((() => "no parameters")())
// expect: no parameters
// end: completed
