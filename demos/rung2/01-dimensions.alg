// Rung 2, scene 1 — dimensional soundness IS refinement discharge.
//
// The units DSL is ~200 lines of Allegro (lib/units.alg) — zero host
// code. Dimensions are structural data; named dimensions (Length,
// Velocity, Force…) are ordinary REFINEMENTS over one Quantity record,
// so the kernel checks physics the same way it checks PositiveInt.
use units

// Quantities with units; arithmetic combines dimensions.
d = qty(3, m)
t = qty(2, s)
v = d.div(t)
print(v.toString())                   // expect: 1.5 m/s
print(v instanceof Velocity)          // expect: true
print(v instanceof Force)             // expect: false

// Addition converts within a dimension...
print((d + qty(150, cm)).toString())  // expect: 4.5 m

// ...and REFUSES across dimensions, in the domain's vocabulary.
bad = d + t
print(error of bad)                   // expect: cannot add m and s: length vs time

// Conversion is dimension-checked the same way.
print(qty(5, km).to(m).toString())    // expect: 5000 m
badc = d.to(s)
print(error of badc)                  // expect: cannot convert m to s: length vs time

// Signatures state physics; the refinement path enforces it. Passing a
// length where acceleration is expected HALTS the build — uncomment:
//
//   speed(a: Acceleration, t: Duration): Velocity => a.mul(t)
//   wrong = speed(qty(3, m), qty(2, s))
//
//   → Type error: argument 0 failed refinement predicate for
//     Acceleration
//
// See transcripts/01-halt.txt for the captured output.
speed(a: Acceleration, t: Duration): Velocity => a.mul(t)
g0 = qty(9.8, m.div(s.pow(2)))
print(speed(g0, t).to(m.div(s)).toString())  // expect: 19.6 m/s
