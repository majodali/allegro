// Allegro Standard Library — Contracts
//
// Phase C of the provability arc, Chunk 3: function-body contract clauses.
//
// Two new statement forms attach contracts to a function body:
//
//     requires <bool-expr>           // caller obligation
//     ensures  <bool-expr-with-_>    // implementer guarantee
//
// They lower to bare-expression markers (`requires_stmt(P)` / `ensures_decl(P)`)
// at the head of the function body. The tree-builder's contract preprocessor
// recognises these markers and rewrites the block:
//
//   - `requires` checks fire at function entry (sequenced ahead of the body).
//   - `ensures` checks wrap the result: the result is bound to `_`, the
//     predicate runs against it, and the result is returned with the proven
//     post-condition attached to its predicate set so callers can see it.
//
// Static discharge: predicate-set entailment short-circuits both directions.
// If the call site's predicates already entail `requires P`, the runtime
// check at entry no-ops. If the body's result already carries a set that
// entails `ensures P`, the runtime check at exit no-ops. Either way the
// post-condition propagates to the caller.
//
// Surface form:
//
//     divide(a, b) =>
//       requires b != 0
//       ensures _ != 0 || a == 0
//       a / b
//
// `_` in `ensures` refers to the function's return value, matching the
// refinement-predicate convention (`Int && _ > 0`). At parse time the
// preprocessor rewrites `_` references inside ensures predicates into a
// one-param lambda over `_`, so a single result evaluation feeds every
// post-condition check.
//
// Failures: a violated precondition halts with `precondition failed: …`;
// a violated post-condition halts with `postcondition failed: …`. In both
// cases the message includes the constraint and (when the value is a 64-bit
// Int) the actual counterexample.

contracts_grammar = grammar {
  stmt_form "requires" cond:expr
    => cond => requires_stmt(cond)
  stmt_form "ensures" cond:expr
    => cond => ensures_decl(cond)
}
