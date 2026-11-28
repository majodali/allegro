// A module with a notation that puts a sign `+` before an operand: `+ 2`
// is 2. It only adds a form. In a text that carries a sum over two
// lines, with the `+` first on the second, it would change what the
// text means: see carried.main.alg.
import change
import grammar
export signs = [change.append(`prefixed, grammar.giving(grammar.seq([grammar.spaced(grammar.lit("+")), grammar.ref(`prefixed)]), (v, at) => v[1]))]
