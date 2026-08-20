// Rung 2, scene 2 — the domain's own syntax, as a library.
//
// `use units` activates a grammar block DECLARED IN THE LIBRARY:
// a numeric literal followed by a same-line unit expression reads as
// a quantity. No parser changes, no host code — the grammar rules are
// ~10 lines of lib/units.alg, merged with conflict validation at
// `use` time.
use units

// Literals: simple, scaled, compound.
print((3 m).toString())               // expect: 3 m
print((9.8 m/s^2).toString())         // expect: 9.8 m/s^2
print((1.5 km).to(m).toString())      // expect: 1500 m
print((2 kg·m/s^2).to(N).toString())  // expect: 2 N

// The sugar composes with the algebra, the refinements, the errors.
print((3 m + 400 cm).toString())      // expect: 7 m
print((5 J) instanceof Energy)        // expect: true
mismatch = 3 m + 4 s
print(error of mismatch)              // expect: cannot add m and s: length vs time

// Number-anchored and same-line only: ordinary code is untouched.
a = 3
zz = 5
print(a + zz)                         // expect: 8
print(when a is 3 then "three" else "other")  // expect: three
