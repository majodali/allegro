// Allegro Standard Library — Math
// Free-standing math functions and constants.
//
// Phase B pilot: refinement-annotated function signatures where domain
// propagation alone suffices to discharge the return-type check (without
// flow-sensitive narrowing — that's a future phase). Functions whose
// implementation needs case-split reasoning (`abs`, `clamp`) currently
// retain their plain Int signatures; their refinements unlock when
// totality / pattern-narrowing land.

export PI = 3.141592653589793
export E = 2.718281828459045
export TAU = 6.283185307179586

export PositiveInt = Int && _ > 0
export NonNeg      = Int && _ >= 0

export sqrt(x) => Float(x).sqrt()
export pow(x, n) => Float(x).pow(Float(n))
export abs(x) => if x >= 0 then x else 0 - x

// `double_pos` exemplifies the propagation pilot: x is PositiveInt (`_ > 0`,
// domain `≥ 1`); x + x has domain `≥ 2`; `≥ 2` implies `≥ 1`, so the
// PositiveInt return type-checks statically with no runtime predicate call.
export double_pos(x: PositiveInt): PositiveInt => x + x
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
