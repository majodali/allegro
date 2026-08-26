// Allegro Standard Library — Totality (Phase E substrate; D34 discharge
// forms live since B-028 F3)
//
// Function-body completion-discharge annotations. The termination
// analysis runs on every typed compilation and IS the `div` effect's
// inference (D31/CE-R1); these clauses are the D34 discharge spectrum's
// surface (design: docs/design/standard/totality.md).
//
// Each form lowers to a parse-time marker that the block-expression
// preprocessor extracts and uses to wrap the function body with the
// matching `*_attach(body)`; `collapseBodyMetadata` then collapses the
// wrapper to a host function property the analyzer reads.
//
// Example:
//
//     use totality
//
//     loop(n) =>
//       partial
//       loop(n)        // declared undischarged: div inferred, findings
//                      // suppressed, tier recorded in the ledger
//
//     down(n: Int) =>
//       decreases n
//       if n == 0 then 0 else down(n - 1)   // witnessed (kernel-checked)
//
//     poll(n) =>
//       assume terminates                    // admitted liveness axiom
//       if ready(n) then n else poll(n)
//
//     safe(n: Int) =>
//       total                                // strict: undischarged div
//       n + 1                                // (own or inherited) is an ERROR

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

  // B-028 F3 (D34): the completion-discharge clauses.
  // `total` — per-function STRICT opt-in: an undischarged `div` on this
  // function is a compile error (auto-proof, verified `decreases`, or an
  // admitted axiom all satisfy it).
  stmt_form "total"
    => () => total_decl_marker()

  // `assume terminates` — the admitted tier: a declared liveness axiom
  // for the whole function. Lifts `div` (inherited included) and is
  // verdict-visible in the assumption ledger.
  stmt_form "assume" "terminates"
    => () => assume_terminates_decl_marker()
}
