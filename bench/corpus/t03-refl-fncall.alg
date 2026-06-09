// Benchmark obligation t03 — refl-trivial through a function call.
//
// Category: refl-trivial. PE evaluates `sq(5)` to `25`, so the goal is
// the identity `25 == 25` and reflexivity over `sq(5)` discharges it.
sq(x: Int): Int => x * x
theorem goal: sq(5) == 25 by proof_refl(sq(5))
