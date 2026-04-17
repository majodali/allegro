// Allegro Standard - Module / Import Tests
// Tests import syntax and dot access on imported modules.

import mymath

// Access module fields via dot notation
print(mymath.pi)
// expect: 3

print(mymath.e)
// expect: 2

// Use module functions
print(mymath.square(5))
// expect: 25

print(mymath.double(7))
// expect: 14
