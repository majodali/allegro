// Basic arithmetic
x = 3 + 4 * 2
print(x)

// Function definition and call
double(n) => n * 2
print(double(21))

// Factorial (recursive)
factorial(n) => if n == 0 then 1 else n * factorial(n - 1)
print(factorial(5))

// Lambda
apply(f, x) => f(x)
print(apply(x => x + 10, 32))

// Fibonacci
fib(n) => if n <= 1 then n else fib(n - 1) + fib(n - 2)
print(fib(10))

// Absolute value
abs(x) => if x < 0 then 0 - x else x
print(abs(-42))
print(abs(7))
