// Hygiene test: the consumer binds `pow_int` to a totally different function.
// Because templates are resolved hygienically at module-definition time, the
// `**` operator still calls the REAL pow_int from lib/pow.alg, not the
// consumer's local rebinding.

use pow

// Local rebinding that would hijack `**` under non-hygienic substitution.
pow_int(base, n) => 99999

print(2 ** 10)          // expect: 1024
print(3 ** 4)           // expect: 81
print(pow_int(2, 10))    // expect: 99999
