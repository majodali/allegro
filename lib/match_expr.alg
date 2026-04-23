// Grammar-extension module: adds a `match` expression.
//
//   match scrutinee with
//     p1 => e1
//     p2 => e2
//     p3 => e3
//
// desugars to a linear search: compare scrutinee against each pattern's
// expression value; when equal, return the corresponding result. If no
// match, returns an error.
//
// Patterns here are plain expression atoms (not the full pattern grammar
// of when/is/then). For `match_wildcard`, bind a pattern to any value by
// using any fresh identifier — it won't match equality against anything
// real, so put the intended catch-all clause last using a boolean
// `true` as the pattern plus always-true equality check.

match_helper(scrutinee, cases, idx) =>
  if idx == cases.length
    then error "match: no branch matched"
    else if scrutinee == cases[idx].p
      then cases[idx].e
      else match_helper(scrutinee, cases, idx + 1)

match_dispatch(scrutinee, cases) =>
  match_helper(scrutinee, cases, 0)

match_grammar = grammar {
  rule match_case = p:expr "=>" e:expr => (p, e) => {p: p, e: e}
  rule match_list = c:match_case ** "|" => c => c

  expr_form "match" s:expr "with" cs:match_list
    => (s, cs) => match_dispatch(s, cs)
}
