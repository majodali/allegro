// Rung 1, scene 1 — state facts in the code; watch the compiler
// discharge them. Claims are part of the program, in the program's own
// syntax: a refinement type, a contract, a theorem. Partial evaluation
// folds what it can — the discharged checks cost nothing at runtime.
use contracts

// A refinement: an Int constrained to be positive. `_` is the value.
// Construction checks the predicate; the proven fact (≥ 1) rides on
// the value and propagates through arithmetic.
PositiveInt = Int & _ > 0
print(PositiveInt(5))                 // expect: 5

// A contract. `requires` is the caller's obligation; `ensures` is the
// implementer's guarantee (`_` is the return value). With x ≥ 1 the
// result propagates ≥ 2, which entails both clauses — the checks are
// discharged statically. Run `allegro inspect` to see the predicate
// sets on every binding.
double_pos(x: PositiveInt): PositiveInt =>
  requires x > 0
  ensures _ > 0
  x + x

print(double_pos(PositiveInt(7)))     // expect: 14

// A theorem: a named proposition, discharged by evaluation at compile
// time. `2 + 2` folds to 4; the claim disappears into a proven fact.
theorem four: 2 + 2 == 4

// Proofs are ordinary values, so they compose. `by` supplies a proof
// term; the kernel checks it establishes exactly the stated fact.
theorem four_flipped: 4 == 2 + 2 by proof_sym(four)
theorem half_of_eight: 4 == 8 / 2
theorem chained: 2 + 2 == 8 / 2 by proof_trans(four, half_of_eight)

// Runtime behaviour is unaffected — proofs leave no trace in the run.
print(2 + 2)                          // expect: 4
