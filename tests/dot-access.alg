// Allegro Standard - Dot Access and Method Calls
// Tests type-directed dot dispatch, getters, and bound methods.

// String length (getter)
print("hello".length)
// expect: 5

print("".length)
// expect: 0

// String methods
print("hello world".slice(0, 5))
// expect: hello

print("hello".indexOf("ll"))
// expect: 2

print("hello".indexOf("xyz"))
// expect: -1

// Int toString
print(42.toString())
// expect: 42

// Float toString
print(3.14.toString())
// expect: 3.14

// Bool toString
print(true.toString())
// expect: true

// String concat via method-style (+ operator)
a = "foo"
b = "bar"
print(a + b)
// expect: foobar
