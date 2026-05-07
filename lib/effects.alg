// Allegro Standard Library — Effects (Phase D1)
//
// Function-body effect declarations. Each function may state the
// categories of side effects it can produce; the analyzer infers the
// actual set from the primitives transitively called and verifies the
// declaration is a superset (under-promising is an error).
//
// Surface form (added to the host grammar):
//
//     effects io
//     effects io, net
//     effects pure
//
// Lowers to a parse-time marker that the block-expression preprocessor
// extracts and uses to wrap the function body with `effects_attach(body,
// labels)`. At runtime the wrapper is a passthrough; at compile time the
// inference walker peels it to recover the declared set.
//
// Effect labels are extension-provided strings, not a fixed enum. Core
// ships only the implicit `pure` (the empty set). Extensions register
// labels alongside the primitives that produce them — the standard
// library's `print` carries `io`, `fetch` carries `net`, `delay` carries
// `time`. Domain-specific extensions register their own (`build-io`,
// `funds-mutation`, …).
//
// Example:
//
//     use effects
//
//     square(x) =>
//       effects pure
//       x * x
//
//     greet(name) =>
//       effects io
//       print("Hello, " + name)
//       name
//
// See `previews/d1-effects.alg` for the full design rationale, including
// the boundary with Phase D2 (parametric capabilities).

effects_grammar = grammar {
  stmt_form "effects" labels:ident ** ","
    => labels => effects_decl_marker(labels)

  // Stage D — Surface C param-bound declaration. Useful when the param has a
  // non-trivial type and you don't want to fold the effect into the type
  // expression. `param_effects f: pure` lowers to a marker the block-expr
  // preprocessor extracts; the bound is stamped on the Param at typed_function
  // setup time, identical predicate shape to `f: pure` in the param-type slot.
  //
  //   process(arr: Array[Int], f) =>
  //     param_effects f: pure
  //     arr.map(f)
  stmt_form "param_effects" n:ident ":" e:ident
    => (n, e) => param_effects_decl_marker(n, e)
}
