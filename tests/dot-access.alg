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

// String trim
print("  hello  ".trim())
// expect: hello

// String startsWith / endsWith
print("hello".startsWith("hel"))
// expect: true

print("hello".endsWith("llo"))
// expect: true

print("hello".startsWith("xyz"))
// expect: false

// String includes
print("hello world".includes("world"))
// expect: true

print("hello".includes("xyz"))
// expect: false

// String replace (replaces all by default)
print("aabbcc".replace("b", "x"))
// expect: aaxxcc

// String replace with count
print("aabbcc".replace("b", "x", 1))
// expect: aaxbcc

// String case
print("hello".toUpperCase())
// expect: HELLO

print("HELLO".toLowerCase())
// expect: hello

// String charAt
print("hello".charAt(1))
// expect: e

// String repeat
print("ab".repeat(3))
// expect: ababab

// String split
s = "a,b,c".split(",")
print(s.length)
// expect: 3

// String toCharCodes
codes = "ABC".toCharCodes()
print(codes.length)
// expect: 3
