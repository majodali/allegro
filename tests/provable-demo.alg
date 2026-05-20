// Phase G — provable stdlib pilot demo.
//
// `lib/provable.alg` ships utility functions WITH 23 named theorems
// about their correctness. Loading the module checks every theorem at
// definition time (F1 PE-discharge for concrete inputs, F3 combinators,
// F5 universal-Bool). Importing the module here both makes the functions
// usable and re-verifies the theorems through the standard load path.

import provable

print(provable.abs(0 - 5))        // expect: 5
print(provable.abs(42))           // expect: 42
print(provable.sign(99))          // expect: 1
print(provable.sign(0 - 7))       // expect: -1
print(provable.sign(0))           // expect: 0
print(provable.square(7))         // expect: 49
print(provable.min2(3, 9))        // expect: 3
print(provable.max2(3, 9))        // expect: 9
print(provable.negate(true))      // expect: false
print(provable.negate(false))     // expect: true

// Theorems about the lib's functions can be stated locally too — they
// discharge via PE on the imported function values.
theorem local_abs:   provable.abs(0 - 100) == 100
theorem local_sq:    provable.square(5) == 25
theorem local_min:   provable.min2(1, 2) == 1
