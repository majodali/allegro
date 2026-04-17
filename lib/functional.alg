// Allegro Standard Library — Functional
// Common higher-order function combinators. Pure Allegro — no primitives.

export identity(x) => x
export constant(x) => _ => x
export flip(f) => (a, b) => f(b, a)

export compose(f, g) => x => f(g(x))
export pipe(f, g) => x => g(f(x))

export apply(f, x) => f(x)
export twice(f) => x => f(f(x))
export thrice(f) => x => f(f(f(x)))

export on(f, g) => (a, b) => f(g(a), g(b))
