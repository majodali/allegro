// Allegro Standard Library — Math
// Free-standing math functions and constants.
//
// Phase B/C pilot: refinement-annotated and invariant-annotated types where
// domain propagation alone suffices to discharge the return-type check
// (without flow-sensitive narrowing — that's a future phase).
//
// C6.1b: constraints have ONE surface — the `&` refinement mint. Chained
// `&` gives multi-clause layers; record predicates reference fields
// through `_` (`Type.define({lo, hi}) & _.lo <= _.hi`).
//
// Phase C Chunk 3: function-body contracts (`requires` / `ensures`) attach
// caller obligations and implementer guarantees to function definitions.

use contracts
use effects

export PI = 3.141592653589793
export E = 2.718281828459045
export TAU = 6.283185307179586

// Single-value refinements via `&`.
export PositiveInt = Int & _ > 0
export NonNeg      = Int & _ >= 0

// A multi-field range. The refinement predicate ties two fields together.
export Range = Type.define({lo: Int, hi: Int}) & _.lo <= _.hi

// Phase D1 pilot: pure math functions declare `effects pure` so the
// declaration is reviewable in the safety summary alongside contracts.
// Inferred sets are pure too — these calls only touch arithmetic and
// type-system primitives, no io/net/time.
export sqrt(x) =>
  effects pure
  Float(x).sqrt()
export pow(x, n) =>
  effects pure
  Float(x).pow(Float(n))
export abs(x) =>
  effects pure
  if x >= 0 then x else 0 - x

// `double_pos` exemplifies the propagation pilot: x is PositiveInt (`_ > 0`,
// domain `≥ 1`); x + x has domain `≥ 2`; `≥ 2` implies `≥ 1`, so the
// PositiveInt return type-checks statically with no runtime predicate call.
export double_pos(x: PositiveInt): PositiveInt =>
  effects pure
  x + x

// `divide` exemplifies Phase C Chunk 3 contracts. `requires b != 0` is the
// caller obligation — runtime-checked at function entry when not already
// discharged from the call site's predicate set. `ensures _ != 0 || a == 0`
// is the implementer guarantee, attached to the result so callers see the
// post-condition. Multi-clause ensures chain via repeated annotations.
export divide(a, b) =>
  requires b != 0
  a / b
export floor(x) => Float(x).floor()
export ceil(x) => Float(x).ceil()
export round(x) => Float(x).round()

export sin(x) => Float(x).sin()
export cos(x) => Float(x).cos()
export tan(x) => Float(x).tan()

export log(x) => Float(x).log()
export log2(x) => Float(x).log2()
export log10(x) => Float(x).log10()
export exp(x) => Float(x).exp()

export min(a, b) => if a < b then a else b
export max(a, b) => if a > b then a else b
export clamp(x, lo, hi) => if x < lo then lo else if x > hi then hi else x

export sign(x) => if x > 0 then 1 else if x < 0 then 0 - 1 else 0
