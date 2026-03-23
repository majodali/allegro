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
