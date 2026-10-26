// Allegro Standard - Functions and Closures
// Tests function features with the type system active.

// Basic function
add(a, b) => a + b
print(add(3, 4))
// expect: 7

// Higher-order function
apply(f, x) => f(x)
print(apply(x => x * 2, 21))
// expect: 42

// Closure
make_adder(n) => x => x + n
add5 = make_adder(5)
print(add5(10))
// expect: 15
print(add5(100))
// expect: 105

// Function composition
compose(f, g) => x => f(g(x))
double(x) => x * 2
inc(x) => x + 1
double_then_inc = compose(inc, double)
print(double_then_inc(5))
// expect: 11

// Recursion with typed values
factorial(n) => if n == 0 then 1 else n * factorial(n - 1)
print(factorial(6))
// expect: 720

// Fibonacci
fib(n) => if n <= 1 then n else fib(n - 1) + fib(n - 2)
print(fib(10))
// expect: 55

// Functions with string operations
greet(name) => "Hello, " + name + "!"
print(greet("Alice"))
// expect: Hello, Alice!

// Conditional returning different types of expressions
abs(x) => if x < 0 then 0 - x else x
print(abs(-42))
// expect: 42
print(abs(7))
// expect: 7

// A local binding of an `if` or `when` whose chosen branch is a call: the
// branch is not in tail position, so the binding holds the call's VALUE and
// later uses of it read a value, not a pending call.
pick(q) => q
bump(v) => v + 1
via_if(q) =>
  y = if q > 1 then pick(q) else 0
  bump(y)
print(via_if(5))
// expect: 6
via_when(q) =>
  y = when q is 5 then pick(q) is _ then 0
  bump(y)
print(via_when(5))
// expect: 6
top = if true then pick(41) else 0
print(bump(top))
// expect: 42

// A local binding used more than once, where the uses include a method
// call, an index and a lambda: every use resolves (B-152: a primitive stub
// shared under two expressions was resolved under one and left under the
// other).
Item = Type.define({ name: String, parts: Array })
pair(a, b) => [a, b]
first_with_parts(items) =>
  names = items.filter(i => i.parts.length > 0).map(i => i.name)
  if names.length == 0 then [] else pair(names[0], items.filter(i => i.name == names[0])[0].parts)
found = first_with_parts([Item("a", [1, 2]), Item("b", [])])
print(found[0])
// expect: a
print(found[1])
// expect: [1, 2]
