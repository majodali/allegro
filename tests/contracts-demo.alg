// Phase C Chunk 3: function-body contracts.
//
// `requires P`  — caller obligation. Runtime check fires at function entry
//                 unless statically discharged from the call site's
//                 predicate set.
// `ensures P`   — implementer guarantee. `_` refers to the result; the
//                 predicate is checked at function return and (when
//                 recognisable) attached to the result so callers see it.
//
// Mechanically the same machinery as `assert`: predicate-set entailment
// short-circuits redundant runtime checks, failing checks halt with a
// concrete counterexample, and the introspection summary surfaces every
// contract distinctly via its source attribution.

use contracts

PositiveInt = Int && _ > 0

// Both clauses present. `requires` runs as a runtime check at entry;
// `ensures` is statically discharged because `x + x` with `x ≥ 1`
// propagates to `_ ≥ 2`, which entails `_ ≥ 1`.
double_pos(x) =>
  requires x > 0
  ensures _ > 0
  x + x

print(double_pos(5))            // expect: 10
print(double_pos(100))          // expect: 200

// Multi-clause ensures. Both post-conditions check at return; both attach
// to the result's predicate set on success.
clamp_to_range(x, lo, hi) =>
  requires lo < hi
  ensures _ >= lo
  ensures _ <= hi
  if x < lo then lo
    else if x > hi then hi
    else x

print(clamp_to_range(50, 0, 100))     // expect: 50
print(clamp_to_range(150, 0, 100))    // expect: 100
print(clamp_to_range(0 - 50, 0, 100)) // expect: 0

// Static discharge of `requires` from the caller side: the value's type
// already proves the obligation, so the runtime check no-ops on entry.
abs_pos(x: PositiveInt) =>
  requires x > 0
  x

print(abs_pos(PositiveInt(7)))  // expect: 7
