// Tests of next/ext/lib/grammar.alg: the terminals, each a function of a
// text and a byte position.
capability output
import grammar

t = "let x1 = 42 // note\nnext"

claim(grammar.byte(t, 0) == 108)
claim(grammar.byte(t, 24) == -1)

// A literal.
let_word = grammar.lit("let")
claim(let_word.op == `term)
claim(let_word.match(t, 0) == 3)
claim(let_word.match(t, 1) == -1)
claim(grammar.lit("next").match(t, 20) == 4)
// A literal longer than what is left of the text.
claim(grammar.lit("extra").match(t, 21) == -1)
claim(grammar.lit("x").match(t, 24) == -1)
claim(!let_word.empty && let_word.known)
claim(grammar.lit("").empty && grammar.lit("").match(t, 24) == 0)

// A run of a class: as many bytes as belong, and one at least.
word = grammar.run("a word", "azAZ09__")
claim(word.match(t, 0) == 3)
claim(word.match(t, 4) == 2)
claim(word.match(t, 3) == -1)
claim(word.match(t, 20) == 4)
claim(word.match(t, 24) == -1)
claim(word.name == "a word" && !word.empty)

// The same with none allowed.
space = grammar.many("space", "  \n\n")
claim(space.match(t, 3) == 1)
claim(space.match(t, 0) == 0)
claim(space.match(t, 24) == 0)
claim(space.empty && !space.known)

// One byte of a class.
digit = grammar.one("a digit", "09")
claim(digit.match(t, 9) == 1 && digit.match(t, 8) == -1 && digit.match(t, 24) == -1)

// The bytes before a text, or to the end.
line = grammar.until("the rest of the line", "\n")
claim(line.match(t, 12) == 7)
claim(line.match(t, 19) == 0)
claim(line.match(t, 20) == 4)
claim(grammar.until("a comment", "*/").match("a*b*/c", 0) == 3)

// The end of the text.
claim(grammar.end.match(t, 24) == 0 && grammar.end.match(t, 23) == -1)

// The other six forms are data.
g = grammar.grammar(`s, {s: grammar.seq([grammar.ref(`w), grammar.star(grammar.alt([grammar.opt(word), grammar.guard(digit, false)]))]), w: word})
claim(g.start == `s && g.rules.s.op == `seq && count(g.rules.s.items) == 2)
claim(g.rules.s.items[0].name == `w && g.rules.s.items[1].item.op == `alt)
claim(!g.rules.s.items[1].item.items[1].holds)

output.write("grammar: ok")
// expect: grammar: ok
// end: completed
// summary: decided
