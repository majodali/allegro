// Allegro Standard - Type System Tests
// Tests typed literals, type-directed dispatch, and type propagation.

// Int literals are typed
x = 42
print(x)
// expect: 42

// Int arithmetic preserves types
print(3 + 4 * 2)
// expect: 11

// String literals are typed
greeting = "hello"
print(greeting)
// expect: hello

// String concatenation via +
print("hello" + " " + "world")
// expect: hello world

// Float literals
pi = 3.14
print(pi)
// expect: 3.14

// Float arithmetic
print(1.5 + 2.5)
// expect: 4

print(7.0 / 2.0)
// expect: 3.5

// Bool literals
print(true)
// expect: true

print(false)
// expect: false

// Comparisons (return Bool)
print(3 < 5)
// expect: true

print(10 == 10)
// expect: true

print(3 != 4)
// expect: true
