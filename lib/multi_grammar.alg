// Module that defines two separate grammar values — `use math.grammar_a`
// activates only one of them, leaving the other inert.

grammar_a = grammar {
  infix "++" at(mul) left => (l, r) => l + r + 1
}

grammar_b = grammar {
  infix "--" at(mul) left => (l, r) => l - r - 1
}
