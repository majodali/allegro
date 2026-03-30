// Pattern matching tests

// Inline literal match
x = when 42 is 42 then 1 else 0
print(x) // expect: 1

// Inline literal miss
y = when 42 is 99 then 1 else 0
print(y) // expect: 0

// Wildcard
w = when 42 is _ then 99 else 0
print(w) // expect: 99

// Binding
b = when 10 is n then n + 5 else 0
print(b) // expect: 15

// Resolve-first: known var matches
known = 42
r = when 42 is known then 1 else 0
print(r) // expect: 1

// Multi-case
v = 2
m = when v
  is 1 then 10
  is 2 then 20
  is 3 then 30
print(m) // expect: 20

// Multi-case with binding fallthrough
v2 = 99
m2 = when v2
  is 1 then 10
  is other then other + 1
print(m2) // expect: 100

// Nested when
nested = when 1
  is 1 then when 10
    is 10 then 100
    is _ then 0
  is _ then 0
print(nested) // expect: 100

// Structural destructuring
point = {x: 3, y: 4}
d = when point is {x, y} then x + y else 0
print(d) // expect: 7

// Structural destructuring with sub-pattern binding
d2 = when point is {x: px, y: py} then x * y else 0
print(d2) // expect: 12

// Type destructuring
obj = {width: 5, height: 10}
area = when obj is Object(width, height) then width * height else 0
print(area) // expect: 50

// Multi-case destructuring
describe(val) => when val
  is {x, y} then x + y
  is n then n
print(describe({x: 100, y: 200})) // expect: 300
print(describe(42)) // expect: 42
