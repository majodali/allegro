// Runtime grammar extension demo.
// The `use pow` header loads lib/pow.alg's grammar extensions before this
// file is parsed, so the `**` operator and `neg` keyword are recognized
// in the code below.

use pow

print(2 ** 10)       // expect: 1024
print(3 ** 4)        // expect: 81
print(5 ** 0)        // expect: 1

// Unary keyword prefix
print(neg 7)         // expect: -7
print(neg (2 ** 3))  // expect: -8

// Compose with built-in operators (2**3 = 8, then + 1)
print(2 ** 3 + 1)    // expect: 9

// `**` binds tighter than `*`, so 3**2=9, 2*9=18
print(2 * 3 ** 2)    // expect: 18
