// Grammar-extension module: adds the `**` exponentiation operator and the
// `neg` prefix keyword. Files that `use pow` (or `use import pow`) get
// these syntactic additions before parsing.

// Helper: integer exponentiation by repeated multiplication.
pow_helper(base, n, acc) =>
  if n == 0
    then acc
    else pow_helper(base, n - 1, acc * base)

pow_int(base, n) => pow_helper(base, n, 1)

// Grammar additions. `pow_grammar` is the exported Grammar value; the
// `use pow` pre-scanner picks up any Grammar-valued binding in the module.
//
// Precedence: `**` sits between multiplication and unary — binds tighter
// than `*` / `/`, looser than `-x`. Right-associative so `a ** b ** c`
// parses as `a ** (b ** c)`.
pow_grammar = grammar {
  infix "**" prec(pow) above(mul) below(unary) right => (l, r) => pow_int(l, r)
  expr_prefix "neg" => x => 0 - x
}
