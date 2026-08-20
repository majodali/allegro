// B-092 U1 — units core algebra (no grammar sugar; `use units` loads
// the lib's bindings). Dimensional soundness is refinement discharge;
// mismatches are domain-vocabulary errors.
use units

// Construction + display.
d = qty(3, m)
print(d.toString())                   // expect: 3 m
t = qty(2, s)
v = d.div(t)
print(v.toString())                   // expect: 1.5 m/s

// Operator dispatch on quantities: + - * / through the type's methods.
d2 = d + qty(150, cm)
print(d2.toString())                  // expect: 4.5 m
d3 = d - qty(50, cm)
print(d3.toString())                  // expect: 2.5 m
area = d * d
print(area.toString())                // expect: 9 m·m

// THE marquee domain error: adding incompatible dimensions.
bad = d + t
print(error of bad)                   // expect: cannot add m and s: length vs time

// Conversion within a dimension; refusal across dimensions.
print(qty(5, km).to(m).toString())    // expect: 5000 m
print(qty(90, minute).to(hour).toString())  // expect: 1.5 h
badc = d.to(s)
print(error of badc)                  // expect: cannot convert m to s: length vs time

// Normalized comparison.
print(qty(1, km).gt(qty(999, m)))     // expect: true
print(qty(1, km).eq(qty(1000, m)))    // expect: true

// Named dimensions are refinements — annotations check dimensional
// soundness through the standard refinement path.
speed_after(a: Acceleration, t: Duration): Velocity => a.mul(t)
g0 = qty(9.8, m.div(s.pow(2)))
print(speed_after(g0, qty(2, s)).to(m.div(s)).toString())  // expect: 19.6 m/s

// instanceof answers through the predicate re-check.
print(v instanceof Velocity)          // expect: true
print(v instanceof Force)             // expect: false
print(g0 instanceof Acceleration)     // expect: true

// Refinement refusal HALTS the build — passing the wrong dimension is
// a refinement check failure at the call site, the same machinery as
// PositiveInt ("build safety in"). Uncomment to see:
//
//   wrong = speed_after(qty(3, m), qty(2, s))
//
//   → Type error: argument 0 failed refinement predicate for
//     Acceleration
//
// Derived units compose: F = m·a in newtons.
f = qty(2, kg).mul(g0)
print(f.to(N).toString())             // expect: 19.6 N
print(f.to(N) instanceof Force)       // expect: true
