// Allegro Standard - Logical Operators
// Tests &&, ||, ! with short-circuit semantics.

// Basic logical operations
print(true && true)
// expect: true

print(true && false)
// expect: false

print(false && true)
// expect: false

print(false || true)
// expect: true

print(false || false)
// expect: false

print(!true)
// expect: false

print(!false)
// expect: true

// Logical with comparisons
print(3 > 1 && 5 < 10)
// expect: true

print(3 > 100 && 5 < 10)
// expect: false

print(3 > 100 || 5 < 10)
// expect: true

// Chained logical
print(true && true && true)
// expect: true

print(true && false && true)
// expect: false

// Not with comparison
print(!(3 > 5))
// expect: true

// Logical in if-then-else (using parenthesized condition)
in_range(x) => x > 0 && x < 10
check(x) => if in_range(x) then "yes" else "no"
print(check(5))
// expect: yes

print(check(15))
// expect: no

// Short-circuit with a function CALL on the right (B-151 A2 finding):
// the thunk is applied, not evaluated as a body, so a tail-position call
// answers as a value rather than as a tail-call sentinel.
is_b(x) => x == "b"
print(("a" != "b") && is_b("a"))
// expect: false

print(true && is_b("b"))
// expect: true

print(false || is_b("b"))
// expect: true

print(false || is_b("a"))
// expect: false
