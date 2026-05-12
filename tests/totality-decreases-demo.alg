// Phase E Stage 3: `decreases <metric>` body-form.
//
// User-supplied termination metrics. The analyzer verifies the metric where
// it can (bare param, lex tuple via array literal); anything more complex is
// trusted — the explicit clause is the user's commitment that recursion is
// well-founded.
//
// Compared to Stage 2's auto-detection:
//   - Stage 2 requires the recursion to be `param - K` on a non-negative
//     bounded type. That works for factorial-like cases but not for
//     anything non-obvious.
//   - Stage 3 lets you express the metric explicitly. Useful when the
//     decreasing measure is a derived value, a lex tuple, or just
//     non-obvious to the auto-detector.

use totality

// Bare-param metric — verifies same as Stage 2, but the clause says it
// explicitly. With `decreases n` we trust the user about the bound, so
// even un-refined Int is accepted (this would fire on Stage 2 alone).
sum_down(n: Int): Int =>
  decreases n
  if n == 0 then 0 else n + sum_down(n - 1)

// Lexicographic metric via array literal. Useful when no single param
// strictly decreases but a tuple does.
sum_two_down(m: Int, n: Int): Int =>
  decreases [m, n]
  if m == 0 then n else m + sum_two_down(m - 1, n)

// Runtime evaluation works regardless of the analyzer — the wrapper is
// a passthrough.
print(sum_down(5))                  // expect: 15
print(sum_two_down(3, 10))          // expect: 16
