// Worked examples of the parser's rules, 2 of 6: rules that name
// themselves, and levels of signs.
//
// Decisions: "Any parsing algorithm will do that meets five conditions"
// and "Named, partially ordered precedence levels"
// (docs/plans/book-pass-inventory.md). The index is next/ext/examples.md.
capability output
import engine
import grammar
import levels

lit = grammar.lit
ref = grammar.ref
seq = grammar.seq
alt = grammar.alt

number = grammar.run("a number", "09")
// What a sign with its two operands gives here: the three between brackets.
bracketed = (sign, left, right, at) => "(" ++ left ++ sign ++ right ++ ")"
pair(v) => "(" ++ v[0] ++ v[1] ++ v[2] ++ ")"

// ---- A rule that begins with itself ----
//
// One of the five conditions: a rule may name itself first. The engine
// reads such a rule in turns at a position, each turn handing the rule
// what the turn before found, until a turn finds nothing new. The
// grouping is the grammar's: a rule that begins with itself groups from
// the left.
//
//   minus = minus "-" number | number
from_left = grammar.grammar(`minus, {minus: alt([grammar.giving(seq([ref(`minus), lit("-"), number]), (v, at) => pair(v)), number])})
claim(engine.parse(engine.prepared(from_left), "9-3-2") == "((9-3)-2)")
// A rule that ends with itself groups from the right.
//
//   power = number "^" power | number
from_right = grammar.grammar(`power, {power: alt([grammar.giving(seq([number, lit("^"), ref(`power)]), (v, at) => pair(v)), number])})
claim(engine.parse(engine.prepared(from_right), "2^3^2") == "(2^(3^2))")
// A rule that reads itself and nothing between would go round for ever, and is refused.
//
//   idle = idle | "x"
idle = grammar.grammar(`idle, {idle: alt([ref(`idle), lit("x")])})
claim(attempt(engine.parses(engine.prepared(idle), "x"), 100000).reason == "a rule reads itself and no byte between")

// ---- Levels with names, each placed by the levels it names ----
//
// A row is an operand, then a sign and an operand any number of times.
// A level is a name, its signs, and the side a row of them groups from.
// No level has a number: a level says which levels it binds tighter
// than (`after`) or looser than (`before`), and that places it.
//
//   sum      "+" "-"   from the left
//   product  "*" "/"   from the left, tighter than sum
//   power    "^"       from the right, tighter than product
sum = levels.level(`sum, ["+", "-"], `left)
product = levels.after(levels.level(`product, ["*", "/"], `left), [`sum])
power = levels.after(levels.level(`power, ["^"], `right), [`product])
row(ls) => engine.prepared(grammar.grammar(`e, {e: levels.row(number, ls, lit, bracketed)}))
read(ls, text) => engine.parse(row(ls), text)
claim(read([sum, product, power], "1+2*3") == "(1+(2*3))")
claim(read([sum, product, power], "9-3-2") == "((9-3)-2)" && read([sum, product, power], "2^3^2") == "(2^(3^2))")
// Power names only product, and is tighter than sum through it.
claim(read([sum, product, power], "1+2^3") == "(1+(2^3))")
// The order the levels are listed in has no meaning.
claim(read([power, sum, product], "1+2*3^4") == "(1+(2*(3^4)))")

// ---- Two levels with no order between them ----
//
// Both may be in one grammar: nobody has to rank every sign against
// every other. A text that keeps their signs apart is read. A text that
// puts them side by side has no reading the grammar gives, and is
// refused; it is not read one way by an accident of how the levels were
// listed.
//
//   compare  "<"   tighter than sum; nothing says how it stands to product
compare = levels.after(levels.level(`compare, ["<"], `left), [`sum])
claim(read([sum, product, compare], "1+2<3") == "(1+(2<3))")
claim(attempt(read([sum, product, compare], "1*2<3"), 100000).reason == "two signs are side by side whose levels have no order between them")
// One more name settles it.
claim(read([sum, product, levels.after(compare, [`product])], "1*2<3") == "(1*(2<3))")

// ---- A level added to a row ----
//
// A row is open: a level can be added to it, with a function of its own
// for what its signs give. This is how a notation brings an operator
// (examples_changes.test.alg, examples of `use` in next/ext/examples/).
with_ratio = levels.with_level(levels.row(number, [sum, product], lit, bracketed), levels.making(levels.after(levels.level(`ratio, [":/"], `left), [`product]), (sign, left, right, at) => "<" ++ left ++ " over " ++ right ++ ">"))
claim(engine.parse(engine.prepared(grammar.grammar(`e, {e: with_ratio})), "1+2*3:/4") == "(1+(2*<3 over 4>))")

output.write("examples of rows: ok")
// expect: examples of rows: ok
// end: completed
// summary: decided
