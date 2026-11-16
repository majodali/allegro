// A block's bindings are one group: a binding may be used on a line
// before its own, and a function before it is written.
capability output
message = join(hello, "world")
output.write(message)
// expect: hello, world
join(a, b) => a ++ ", " ++ b
hello = "hello"
output.write(join(hello, again))
// expect: hello, again
again = "again"
inner <-
  hello = "an inner block binds hello again"
  join(hello, "inside")
output.write(inner)
// expect: an inner block binds hello again, inside
output.write(hello)
// expect: hello
// end: completed
