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
countdown(n: Int): Int =>
  decreases n
  if n == 0 then 0 else countdown(n - 1)

// Lexicographic metric via array literal. Ackermann's classic measure:
//   (m, n) decreases lex on every recursive call — either m strictly
//   decreases, or m stays and n strictly decreases.
ack_inner(m: Int, n: Int): Int =>
  decreases [m, n]
  if m == 0 then n + 1 else
    if n == 0 then ack_inner(m - 1, 1) else
      ack_inner(m - 1, ack_inner(m, n - 1))

// Runtime evaluation works regardless of the analyzer — the wrapper is
// a passthrough. (Note: `countdown` is tail-recursive AND uses a typed
// return; the type_check wrapper now forwards TailCalls so applyComposed's
// tco_loop can catch them, giving full TCO through the typed-return
// path.)
print(countdown(5))           // expect: 0
print(countdown(1000))        // expect: 0
print(ack_inner(2, 3))        // expect: 9
print(ack_inner(3, 2))        // expect: 29
