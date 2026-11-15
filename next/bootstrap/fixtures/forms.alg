// The forms of the first notation that the reference kernel evaluates
// today (next/bootstrap/first-notation.md §2). Each line a program
// prints is pinned below it.

// A text, and a binding of a name.
greeting = "hello"
print(greeting)
// expect: hello

// Truth values and the logical forms, built on the kernel's conditional.
print(true && !false)
// expect: true
print(false || false)
// expect: false

// A function, used before its definition; a conditional.
print(choose(true))
// expect: yes
choose(c) => if c then "yes" else "no"

// A function that takes a function; a lambda.
apply(f, x) => f(x)
print(if apply(b => !b, false) then "applied" else "not")
// expect: applied

// A function of no parameters, whose body prints.
shout() => print("shout")
shout()
// expect: shout

// A block: its statements in written order.
twice() =>
  print("one")
  print("two")
twice()
// expect: one
// expect: two

// A structure literal and an array.
point = {x: "1", y: "2"}
pair = [true, false]
print("built")
// expect: built

// A claim that holds.
claim(true && true)
print("claimed")
// expect: claimed
