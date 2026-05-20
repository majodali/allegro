// Allegro Standard Library — Proven (Phase F7)
//
// `proven <prop>` body-form clause: attach a theorem about the function
// being defined. Compiler verifies the property at definition time by
// bounded sampling (Stage-7 minimum, K=4); failure halts compilation
// with a concrete counterexample input.
//
// This is the user-visible [implementation, proof] pair contract — the
// surface AI agents target in Phase H. The function body says what it
// does; the proven clause says what's TRUE about it.
//
// Surface:
//
//     use proven
//
//     square(x: NonNeg): NonNeg =>
//       proven square(x) >= 0
//       x * x
//
// Multiple `proven` clauses on one function are checked independently.
// Each predicate references the function's params in scope; the analyzer
// substitutes sample values per param and evaluates the predicate.
//
// Lowers to a parse-time marker that the block-expression preprocessor
// extracts and uses to wrap the body with `proven_attach(body, p1, ...)`.
// At runtime the wrapper is a passthrough; the analyzer
// (`checkProvenClauses` in src/proven.ts) peels it and samples.

proven_grammar = grammar {
  stmt_form "proven" cond:expr
    => cond => proven_decl_marker(cond)
}
