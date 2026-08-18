// Lifecycle invariants (C6.1b: invariants ARE refinements — one
// conjunction story via the `&` mint; chained `&` gives per-clause
// layers, and record predicates reference fields through `_`).
//
// Mechanically unchanged from the Phase C Chunk 4 semantics: the
// constructor checks each clause; a recognised predicate's domain
// attaches to the value's predicate set; downstream propagation
// inherits the fact.

// Single-value clause.
PositiveInt = Int & _ > 0
ten = PositiveInt(10)
print(ten)              // expect: 10

// Multi-field record type with a relational constraint: `lo <= hi`.
// The refinement predicate reaches fields through `_` — the same mint
// covers scalars and records.
Range = Type.define({lo: Int, hi: Int}) & _.lo <= _.hi
ok = Range(1, 100)
print(ok.lo)            // expect: 1
print(ok.hi)            // expect: 100

// Violation produces a counterexample-bearing error.
bad = Range(50, 5)
print(error of bad)     // expect: refinement check failed

// Chaining: `&` is left-associative, so each clause is its own layer —
// failure points at the clause that tripped via its rendered domain.
SmallPos = Int & _ > 0 & _ < 100
print(SmallPos(50))     // expect: 50
print(error of SmallPos(0))     // expect: refinement check failed: expected ≥ 1 (got 0)
print(error of SmallPos(200))   // expect: refinement check failed: expected ≤ 99 (got 200)
