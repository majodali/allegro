// B-092 U2 — quantity literal grammar sugar. Number-anchored (U-R2):
// only a numeric LITERAL followed by a unit expression on the same
// line reads as a quantity; everything else is untouched.
use units

// Literals: int and float magnitudes, simple and compound units.
d = 3 m
print(d.toString())                   // expect: 3 m
g0 = 9.8 m/s^2
print(g0.toString())                  // expect: 9.8 m/s^2
k = 1.5 km
print(k.to(m).toString())             // expect: 1500 m
force = 2 kg·m/s^2
print(force.to(N).toString())         // expect: 2 N

// Sugar composes with the algebra and the refinements.
total = 3 m + 400 cm
print(total.toString())               // expect: 7 m
print((2 km).to(m).toString())        // expect: 2000 m
print((5 J) instanceof Energy)        // expect: true
print(g0 instanceof Acceleration)     // expect: true

// The marquee domain error, now in literal syntax.
bad = 3 m + 4 s
print(error of bad)                   // expect: cannot add m and s: length vs time

// Non-interference: the sugar is horizontal-only and number-anchored,
// so ordinary code is untouched.
a = 3
zz = 5
print(a + zz)                         // expect: 8
print(when a is 3 then "three" else "other")  // expect: three
print(if a > 2 then 10 else 20)       // expect: 10
f(x, y) => x + y
print(f(3, 4))                        // expect: 7
arr = [1, 2, 3]
print(arr[2])                         // expect: 3
