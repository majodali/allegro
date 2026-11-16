// Two functions that call each other.
capability output
even(n) => if n == 0 then true else odd(n - 1)
odd(n) => if n == 0 then false else even(n - 1)
say(b) => if b then "true" else "false"
output.write(say(even(10)))
// expect: true
output.write(say(odd(10)))
// expect: false
output.write(say(even(7)))
// expect: false
// end: completed
