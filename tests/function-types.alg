// Function types and type variable unification tests

// Typed function with explicit param and return types
add(a: Int, b: Int): Int => a + b
print(add(3, 4))
// expect: 7

// Identity function with type variable
identity(x: T): T => x
print(identity(42))
// expect: 42

print(identity("hello"))
// expect: hello

// Two independent type variables
first(a: T, b: U): T => a
print(first(10, "world"))
// expect: 10

// Type variable with arithmetic
double(x: T): T => x + x
print(double(21))
// expect: 42

// Typed lambda
f = (x: Int, y: Int): Int => x * y
print(f(6, 7))
// expect: 42
