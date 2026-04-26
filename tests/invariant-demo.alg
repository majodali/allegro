// Phase C Chunk 4: Type.invariant — type-internal lifecycle invariants.
//
// Two complementary ways to declare typed constraints:
//   - `&&` refinement for single-value types (PositiveInt = Int && _ > 0)
//   - `.invariant(self => …)` for records / multi-predicate cases
// Mechanically the same: constructor checks; predicate's domain attaches
// to the value's predicate set; downstream propagation inherits the fact.

// Single-value invariant — equivalent to `Int && _ > 0` but composes via
// the fluent API so multiple constraints can chain.
PositiveInt = Int.invariant(self => self > 0)
ten = PositiveInt(10)
print(ten)              // expect: 10

// Multi-field record type with a relational invariant: `lo <= hi`.
// `invariant` is the natural shape here — refinement-via-`&&` doesn't
// extend cleanly to predicates that reference fields.
Range = Type.extend({lo: Int, hi: Int}).invariant(self => self.lo <= self.hi)
ok = Range(1, 100)
print(ok.lo)            // expect: 1
print(ok.hi)            // expect: 100

// Invariant violation produces a counterexample-bearing error.
bad = Range(50, 5)
print(error of bad)     // expect: invariant 1 failed

// Chaining: one type with multiple invariants. Each invariant is its own
// clause — failure points at which one tripped.
SmallPos = Int.invariant(self => self > 0).invariant(self => self < 100)
print(SmallPos(50))     // expect: 50
print(error of SmallPos(0))     // expect: invariant 1 failed
print(error of SmallPos(200))   // expect: invariant 2 failed
