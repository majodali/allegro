// Allegro Standard Library — Math
// Free-standing math functions and constants.

export PI = 3.141592653589793
export E = 2.718281828459045
export TAU = 6.283185307179586

export sqrt(x) => Float(x).sqrt()
export pow(x, n) => Float(x).pow(Float(n))
export abs(x) => if x >= 0 then x else 0 - x
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
