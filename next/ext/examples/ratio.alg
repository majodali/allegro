// A module with a notation, used by the examples beside it.
//
// `fractions` is a notation: a list of changes to a grammar, exported
// like any value. It adds a level to Allegretto's row of signs: the sign
// `:/`, binding tighter than a product, from the left.
//
// What the sign gives is a part of the using text's tree: a call of this
// module's function `ratio`. The node `from` names the binding by its
// module, so it is this module's `ratio` whatever the using text has
// bound under that name.
import change
import levels
export ratio(a, b) => {top: a, bottom: b}
made(sign, left, right, at) => {k: `apply, fn: {k: `from, module: "ratio", name: "ratio", at: at}, args: [left, right], at: at}
export fractions = [change.level(`operators, levels.making(levels.after(levels.level(`ratio, [":/"], `left), [`product]), made))]
