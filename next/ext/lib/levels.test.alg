// Tests of next/ext/lib/levels.alg.
capability output
import engine
import grammar
import levels

number = grammar.run("a number", "09")
// What a sign with its operands gives here: the three between brackets.
bracketed = (sign, left, right, at) => "(" ++ left ++ sign ++ right ++ ")"
reader(ls, make) => engine.prepared(grammar.grammar(`e, {e: levels.row(number, ls, grammar.lit, make)}))

// Sums bind looser than products, and powers tighter than both. Each
// level names one neighbour, and that places it.
sum = levels.level(`sum, ["+", "-"], `left)
product = levels.after(levels.level(`product, ["*", "/"], `left), [`sum])
power = levels.after(levels.level(`power, ["^"], `right), [`product])
p = reader([sum, product, power], bracketed)
read(text) => engine.parse(p, text)

claim(read("7") == "7")
claim(read("1+2") == "(1+2)")
claim(read("1+2*3") == "(1+(2*3))" && read("1*2+3") == "((1*2)+3)")
// A row of one level groups from the side the level says.
claim(read("1-2-3") == "((1-2)-3)" && read("2^3^2") == "(2^(3^2))")
claim(read("8/4*2") == "((8/4)*2)")
// Power binds tighter than sum through product, though it names only product.
claim(read("1+2^3") == "(1+(2^3))" && read("2^3+1") == "((2^3)+1)")
claim(read("1+2*3^4^5-6") == "((1+(2*(3^(4^5))))-6)")
claim(engine.parses(p, "1+").failure == `no_parse)

// The order the levels are written in has no meaning, nor which of two names the other.
turned = reader([power, levels.before(levels.level(`sum, ["+", "-"], `left), [`product]), levels.level(`product, ["*", "/"], `left)], bracketed)
claim(engine.parse(turned, "1+2*3^4^5-6") == "((1+(2*(3^(4^5))))-6)")

// Two levels with no order between them may both be in a grammar. A
// text with their signs apart is read; side by side, it is refused.
// Here both product and compare bind tighter than sum, and nothing says which of the two is tighter.
compare = levels.after(levels.level(`compare, ["<"], `left), [`sum])
apart = reader([sum, product, compare], bracketed)
claim(engine.parse(apart, "1+2<3") == "(1+(2<3))" && engine.parse(apart, "1*2+3<4") == "((1*2)+(3<4))")
claim(attempt(engine.parse(apart, "1*2<3"), 100000).reason == "two signs are side by side whose levels have no order between them")
// One more name settles it: compare is tighter than product too.
settled = reader([sum, product, levels.after(compare, [`product])], bracketed)
claim(engine.parse(settled, "1*2<3") == "(1*(2<3))" && engine.parse(settled, "1<2*3") == "((1<2)*3)")
// Two levels that each bind tighter than the other are refused where their signs meet.
circle = reader([levels.after(sum, [`product]), product], bracketed)
claim(attempt(engine.parse(circle, "1+2*3"), 100000).reason == "two levels each bind tighter than the other")
claim(engine.parse(circle, "1+2+3") == "((1+2)+3)")

// What a sign gives has its place: from the beginning of its left
// operand to the end of its right, the space after not counted.
spaces = (text, at, state) => blanks(text, at, 0)
blanks(text, at, n) => if grammar.byte(text, at + n) == 32 then blanks(text, at, n + 1) else n
spaced_sign(t) => grammar.spaced(grammar.lit(t))
placing = engine.prepared(grammar.with_space(grammar.grammar(`e, {e: levels.row(grammar.spaced(number), [sum, product], spaced_sign, (sign, left, right, at) => {sign: sign, left: left, right: right, at: at})}), spaces, false))
v = engine.parse_of(placing, "10 + 2 * 345  ", "row")
claim(v.sign == "+" && v.left == "10" && v.right.sign == "*" && v.right.left == "2" && v.right.right == "345")
claim(v.at.start.index == 0 && v.at.end.index == 12 && v.at.source == "row")
claim(v.right.at.start.index == 5 && v.right.at.end.index == 12 && v.right.at.start.column == 6)

// ---- A row is open ----
plain_row = levels.row(number, [sum], grammar.lit, bracketed)
claim(levels.is_row(plain_row) && !levels.is_row(number) && !levels.is_row(grammar.seq([number])))
claim(levels.has_level(plain_row, `sum) && !levels.has_level(plain_row, `product))
by(row, text) => engine.parse(engine.prepared(grammar.grammar(`e, {e: row})), text)
// One more level, and it is a row still.
two = levels.with_level(plain_row, product)
claim(by(two, "1+2*3") == "(1+(2*3))" && levels.is_row(two) && levels.has_level(two, `product) && levels.has_level(two, `sum))
claim(by(levels.with_level(two, power), "1+2*3^4^5") == "(1+(2*(3^(4^5))))")
// More signs for a level, beside those it has.
claim(by(levels.with_signs(two, `product, ["%"]), "8%3*2+1/1") == "(((8%3)*2)+(1/1))")
// A level with a function of its own for what its signs give; the other levels keep the row's.
named_power = levels.making(power, (sign, left, right, at) => "pow(" ++ left ++ "," ++ right ++ ")")
claim(by(levels.with_level(two, named_power), "1+2^3*4") == "(1+(pow(2,3)*4))")
// Placing a level leaves its function as it was, and adding signs too.
claim(by(levels.with_signs(levels.with_level(two, levels.after(levels.making(levels.level(`power, ["^"], `right), (sign, left, right, at) => "p"), [`product])), `power, ["**"]), "2**3") == "p")

// ---- A row whose last operand may be of another form ----
// Here a last operand may be "all" and then letters: it takes whatever letters follow.
rest = grammar.giving(grammar.seq([grammar.lit("all"), grammar.run("letters", "az")]), (v, at) => "<" ++ v[1] ++ ">")
ended = levels.row_ending(number, rest, [sum, product], grammar.lit, bracketed)
claim(by(ended, "1+2*allxyz") == "(1+(2*<xyz>))" && by(ended, "1*2+allxyz") == "((1*2)+<xyz>)" && by(ended, "1+2") == "(1+2)" && by(ended, "7") == "7")
// It stands nowhere but last, and a row is not that form alone.
claim(is_failure(engine.parses(engine.prepared(grammar.grammar(`e, {e: ended})), "allx+1")) && is_failure(engine.parses(engine.prepared(grammar.grammar(`e, {e: ended})), "allx")))
// A level added to such a row leaves its last operand as it was.
claim(by(levels.with_level(ended, power), "2^allq") == "(2^<q>)")

output.write("levels: ok")
// expect: levels: ok
// end: completed
// summary: decided
