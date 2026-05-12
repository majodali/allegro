// Allegro Standard Library — Totality (Phase E)
//
// Function-body totality annotations. Phase E will prove every function call
// terminates and produces a defined output for every input. Until then, the
// `partial` clause opts a function out of the totality check — explicit
// acknowledgement that the function may not terminate or may not handle every
// input.
//
// Surface form (added to the host grammar):
//
//     partial
//
// Lowers to a parse-time marker that the block-expression preprocessor
// extracts and uses to wrap the function body with `partial_attach(body)`.
// At runtime the wrapper is a passthrough; at compile time the analyzer
// (Stage 1+) peels it to skip totality checks for the annotated function.
//
// `total` is reserved for the inverse opt-in once the project-wide default
// policy is settled (today's default is notify-on-failure with `info`
// severity, so an explicit `total` would only ever upgrade to `error` per
// project config).
//
// Example:
//
//     use totality
//
//     loop(n) =>
//       partial
//       loop(n)        // intentionally non-terminating; no analyzer complaint
//
//     branch(b) =>
//       partial
//       when b is true then 1   // intentionally non-exhaustive (no `else`);
//                               // returns `none` on `false` without analyzer
//                               // notification
//
// Phase E stages build on this substrate:
//   - Stage 1: exhaustiveness check for `when/is/then`
//   - Stage 2: structural recursion termination check
//   - Stage 3: `decreases <expr>` body-form for hand-rolled metrics
//   - Stages 4-6: mutual recursion, higher-order propagation, counterexample
//                  rendering

totality_grammar = grammar {
  // Opt-out: skip the totality analyzer for this function.
  stmt_form "partial"
    => () => partial_decl_marker()

  // User-supplied termination metric. The metric is an expression in scope
  // of the function's params (and any other bindings). The analyzer verifies
  // the metric strictly decreases on each recursive call when it can, and
  // trusts the user otherwise. Use an array literal for lexicographic
  // tuples: `decreases [m, n]` checks `(m, n)` decreases lexicographically.
  stmt_form "decreases" metric:expr
    => metric => decreases_decl_marker(metric)
}
