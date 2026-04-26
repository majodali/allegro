// Allegro Standard Library — Invariants
//
// Phase C of the provability arc: pervasive `assert` syntax, implemented as
// a grammar extension on top of the `assert_stmt` primitive.
//
// Compile-time discharge piggybacks on Phase B's abstract-domain reasoning
// and Phase C Chunk 1's predicate sets — provable assertions become free at
// runtime; failing ones produce concrete counterexamples; succeeding ones
// add their derived predicates to the bindings' scope-local sets so
// subsequent code inherits the proven facts.
//
// Surface form (added to the host grammar):
//
//     assert <bool-expr>
//
// The condition is a boolean expression that may reference any in-scope
// bindings. Recognised shapes (single-binding comparisons against a literal,
// conjunctions thereof) narrow the relevant bindings' predicate sets within
// the rest of the enclosing scope.
//
// Example:
//
//     y = compute(x)
//     assert y > 0           // narrows y's predicate set to ≥ 1
//     z = y * 2              // z's predicate set inherits ≥ 2 via propagation
//
// Multi-binding / opaque conditions still runtime-check on failure but do
// not narrow individual binding predicates — relational tracking is Phase D.

invariants_grammar = grammar {
  stmt_form "assert" cond:expr
    => cond => assert_stmt(cond)
}
