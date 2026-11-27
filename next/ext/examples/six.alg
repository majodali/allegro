// A module with a notation that makes the word `six` an operand, the
// number 6. `six` is a name already: see two-ways.main.alg.
import change
import grammar
export word = [change.append(`primary, grammar.giving(grammar.spaced(grammar.lit("six")), (v, at) => {k: `int, value: 6, at: at}))]
