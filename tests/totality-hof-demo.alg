// Phase E Stage 5: HOF-mediated recursion via stdlib map/filter/reduce.
//
// Recursive references can reach the analyzer indirectly when passed as
// callbacks to stdlib HOFs. Stage 5 detects these and verifies the HOF call
// is well-founded — the receiver array must be structurally smaller than a
// caller parameter (recognised shape: `param.field` access).

// Provably terminating: callback is non-recursive — no cycle.
double_self(x: Int): Int => x * 2
double_list(arr: Array[Int]): Array[Int] => arr.map(double_self)

// Provably terminating via structural induction: `t.children.map(self)` —
// `t.children` is a field access on the parameter `t`, so each recursive
// invocation operates on a sub-component. The cycle terminates when a tree
// node has no children. (Field-type checking is deferred — Stage 5 minimum
// accepts any `param.field` receiver.)
tree_sum(t: Object): Int =>
  t.children.map(tree_sum).reduce((a, x) => a + x, 0)

// Runtime sanity — totality analysis doesn't affect evaluation.
print(double_list([1, 2, 3]).reduce((a, x) => a + x, 0))    // expect: 12
print(tree_sum({value: 5, children: []}))                   // expect: 0
