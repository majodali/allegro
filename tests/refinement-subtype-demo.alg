// Demo: Phase B refinement subtyping via abstract domains.
//
// `BigInt` is refined `_ > 100`. `VeryBigInt` is refined `_ > 1000`.
// Passing a VeryBigInt to a function expecting BigInt type-checks
// STATICALLY — the compiler proves `_ > 1000` implies `_ > 100` without
// executing the predicate. No runtime check, no performance cost.

BigInt     = Int & _ > 100
VeryBigInt = Int & _ > 1000

describe(x: BigInt): String => "big"

// VeryBigInt value passed where BigInt is expected.
v = VeryBigInt(5000)
print(describe(v))   // expect: big

// Arithmetic on a VeryBigInt preserves ≥ 1001 which still implies > 100.
w = v + 50
print(describe(w))   // expect: big
