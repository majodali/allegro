// Phase C, Chunks 1+2: predicate-set demo.
//
// Each binding accumulates a *set* of facts that the compiler tracks
// through arithmetic, conditional branches, and `assert` statements.
// Facts have source attribution visible in the introspection summary.

use invariants

PositiveInt = Int & _ > 0

// Refinement-type predicate flows through arithmetic propagation.
x = PositiveInt(5)         // ≥ 1 [refinement-type]
y = x + 10                 // ≥ 11 [propagation]

// Branch refinement: within the then-branch, the compiler proves x > 100,
// so x + 50 is provably > 150.
big = if x > 100
        then x + 50
        else 0
// This run takes the else branch (x = 5, not > 100).
print(big)                 // expect: 0

// `assert` statement narrows the bindings it references.
z = x + 5                  // ≥ 6 [propagation]
assert z > 5               // discharged statically: ≥ 6 entails > 5
print(z)                   // expect: 10

print(x)                   // expect: 5
print(y)                   // expect: 15
