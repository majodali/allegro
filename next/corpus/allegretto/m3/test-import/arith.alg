// Imported by main.alg: the module under test. It knows nothing of the
// tests.
export gcd(a, b) => if b == 0 then a else gcd(b, a % b)
