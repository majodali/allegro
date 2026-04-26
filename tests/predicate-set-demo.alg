// Phase C, Chunk 1: predicate-set demo.
//
// A binding accumulates multiple facts as data flows through it. Each
// fact has a `source` attribution so the introspection surface can show
// where it came from. Subsequent facts merge into the same set (with
// dedup); the effective tightest fact is what gets used for proof
// discharge.

use invariants

PositiveInt = Int && _ > 0

x = PositiveInt(5)
   // predicates so far: ≥ 1 [refinement-type]

y = x + 10
   // predicates: ≥ 11 [propagation]

// `assume` attaches a fact without checking — adds to the set.
y_tight = assume (v => v < 100) then y
   // predicates: ≥ 11 [propagation], ≤ 99 [assert]
   // the set's effective tightest interval becomes [11, 99]

// Now the next propagation can use both bounds.
z = y_tight + 5
   // predicates: ≥ 16 (lo+5), but the upper bound IS knowable here:
   // [11, 99] + literal-5 → [16, 104] — propagation derives an interval
   // when both sides are bounded.

print(x)            // expect: 5
print(y)            // expect: 15
print(y_tight)      // expect: 15
print(z)            // expect: 20
