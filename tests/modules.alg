// Allegro Standard - Module / Import Tests
// Tests import syntax and dot access on imported modules.

import math

// Access module fields via dot notation
print(math.pi)
// expect: 3

print(math.e)
// expect: 2

// Use module functions
print(math.square(5))
// expect: 25

print(math.double(7))
// expect: 14
