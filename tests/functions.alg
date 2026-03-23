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
