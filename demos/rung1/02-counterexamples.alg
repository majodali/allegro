// Rung 1, scene 2 — break a claim. Failures name concrete inputs, not
// type-error hieroglyphs. Some failures are values you can inspect;
// claims stated as theorems HALT the build (uncomment to see).

// A refinement with two clauses. Each violation reports the violated
// constraint and the actual value.
SmallPos = Int & _ > 0 & _ < 100
print(SmallPos(50))                   // expect: 50
print(error of SmallPos(0 - 5))       // expect: refinement check failed: expected ≥ 1 (got -5)
print(error of SmallPos(200))         // expect: refinement check failed: expected ≤ 99 (got 200)

// Record invariants tie fields together; same counterexample shape.
Range = Type.define({lo: Int, hi: Int}) & _.lo <= _.hi
print(Range(1, 100).hi)               // expect: 100
print(error of Range(50, 5))          // expect: refinement check failed

// A false theorem HALTS compilation — a failed proof is unsound by
// construction, so the build refuses to produce a program. Uncomment:
//
//   theorem wrong: 2 + 2 == 5
//
//   → proof check failed:
//     theorem `wrong`: `2 + 2 == 5` — proposition is false
//     (counterexample: `2 + 2 == 5` evaluates to false)
//
// See transcripts/02-broken.txt for the captured output.
print("still standing")               // expect: still standing
