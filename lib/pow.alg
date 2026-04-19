// Grammar-extension module: adds the `**` exponentiation operator and the
// `neg` prefix keyword. Files that `use_grammar pow` get these syntactic
// additions before parsing their own source.

// Helper: integer exponentiation by repeated multiplication.
pow_helper(base, n, acc) =>
  if n == 0
    then acc
    else pow_helper(base, n - 1, acc * base)

pow_int(base, n) => pow_helper(base, n, 1)

// `a ** b` — exponentiation at BP 40 (between * at 20 and call at 50).
// The lambda is substituted (NOT evaluated) at parse time; `pow_int` resolves
// during normal evaluation.
register_infix("**", 40, (l, r) => pow_int(l, r))

// `neg EXPR` — keyword-led unary negation.
register_expr_prefix("neg", x => 0 - x)
