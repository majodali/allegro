// Allegro Standard - Object Tests
// Tests object literals, field access, and nested objects.

// Empty object
empty = {}

// Object with fields
point = {x: 10, y: 20}
print(point.x)
// expect: 10
print(point.y)
// expect: 20

// Object with computed values
a = 5
b = 10
pair = {first: a * 2, second: b + 1}
print(pair.first)
// expect: 10
print(pair.second)
// expect: 11

// Nested objects
person = {name: "alice", age: 30}
print(person.name)
// expect: alice
print(person.age)
// expect: 30

// Deep nesting
nested = {a: {b: {c: 42}}}
print(nested.a.b.c)
// expect: 42

// Object with many fields
record = {a: 1, b: 2, c: 3, d: 4, e: 5}
print(record.e)
// expect: 5

// Object keys
k = {x: 1, y: 2}.keys()
print(k.length)
// expect: 2

// Bracket access on objects
print(person["name"])
// expect: alice
