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

// (Until 2026-12-04 the state was one value, set by `with_state`, and these claims held it as 7. It is now
// parts by name, added by `with_part`; the claims hold the same of a part named `count`.)
// A grammar begins with no part of a state, no space and no reserved word.
claim(count(g.state) == 0 && count(g.reserved) == 0 && !g.space_reads && g.space(t, 3, "") == 0)
// Each of the three is given by a function that leaves the rest as it was.
stated = grammar.with_part(g, `count, 7)
claim(stated.state.count == 7 && stated.start == `s && count(stated.rules) == 2)
// A second part is beside the first.
claim(count(grammar.with_part(stated, `depth, 0).state) == 2 && grammar.with_part(stated, `depth, 0).state.count == 7)
// Space that reads a part names it; space that reads none names none.
spaced_g = grammar.with_space(stated, (text, at, part) => 1, `count)
claim(spaced_g.space(t, 0, 0) == 1 && spaced_g.space_reads && spaced_g.space_part == `count && spaced_g.state.count == 7)
claim(!grammar.with_space(stated, (text, at, part) => 1, []).space_reads)
// Words are added to a set: the second call keeps the words of the first.
kept = grammar.with_reserved(grammar.with_reserved(spaced_g, `words, ["if", "else"]), `words, ["when"])
claim(count(kept.reserved) == 1 && count(kept.reserved.words) == 3 && kept.reserved.words[0] == "if" && kept.reserved.words[2] == "when")
claim(kept.state.count == 7 && kept.space_reads)
other = grammar.with_reserved(kept, `signs, ["+"])
claim(count(other.reserved) == 2 && count(other.reserved.words) == 3 && count(other.reserved.signs) == 1)
claim(count(grammar.words_of(other.reserved, `signs, 0)) == 1 && count(grammar.words_of(other.reserved, `none_such, 0)) == 0)

// A terminal made spaced, or kept from a set of words, is the same terminal otherwise.
claim(!word.spaced && !word.stateful && count(word.unless) == 0)
marked = grammar.unless(grammar.spaced(word), `words)
claim(marked.spaced && marked.unless == `words && marked.name == "a word" && marked.match(t, 0) == 3 && marked.known && !marked.empty)
claim(grammar.spaced(marked).unless == `words && grammar.unless(marked, `others).spaced)
// A terminal that reads the state.
counting = grammar.stepper("a count", `count, (text, at, n) => {read: 1, state: n + 1}, false, word.ranges, false)
claim(counting.stateful && counting.part == `count && counting.op == `term && counting.step(t, 0, 4).state == 5 && counting.step(t, 0, 4).read == 1)

// A form given a function is the same form otherwise, whichever of the seven it is.
twice = (v, at) => v ++ v
claim(kind(word.gives) == `structure && kind(grammar.giving(word, twice).gives) == `function)
given_word = grammar.giving(marked, twice)
claim(given_word.spaced && given_word.unless == `words && given_word.match(t, 0) == 3 && given_word.gives("ab", 0) == "abab")
claim(grammar.spaced(given_word).gives("a", 0) == "aa" && grammar.unless(given_word, `others).gives("a", 0) == "aa")
claim(grammar.giving(grammar.ref(`w), twice).name == `w && grammar.giving(grammar.ref(`w), twice).op == `ref)
claim(count(grammar.giving(grammar.seq([word, digit]), twice).items) == 2 && grammar.giving(grammar.alt([word]), twice).op == `alt)
claim(grammar.giving(grammar.star(word), twice).item.name == "a word" && grammar.giving(grammar.opt(word), twice).op == `opt)
claim(!grammar.giving(grammar.guard(word, false), twice).holds && grammar.giving(grammar.guard(word, true), twice).holds)
// Given twice, the second is handed what the first made.
claim(grammar.giving(grammar.giving(word, twice), (v, at) => v ++ "!").gives("a", 0) == "aa!")

// Rules are marked settled by name, beside those marked already.
claim(count(g.settled) == 0)
marks = grammar.with_settled(grammar.with_settled(other, [`s]), [`w, `x])
claim(count(marks.settled) == 3 && marks.settled[0] == `s && marks.settled[2] == `x && count(marks.reserved) == 2 && marks.state.count == 7)
claim(count(grammar.with_part(marks, `depth, 1).settled) == 3 && count(grammar.with_reserved(marks, `words, ["a"]).settled) == 3 && count(grammar.with_space(marks, marks.space, []).settled) == 3)

// ---- Lines read in turns with the grammar ----
lines_form = grammar.turns(`lines, grammar.ref(`line), grammar.lit(";"), v => [])
claim(lines_form.op == `turns && lines_form.rule == `lines && lines_form.item.name == `line && count(lines_form.asks(1)) == 0)
// Written out it is the item, and then the item after what stands between, any number of times.
claim(grammar.spelled(lines_form).op == `seq && grammar.spelled(lines_form).items[0].name == `line && grammar.spelled(lines_form).items[1].op == `star)
// Every other form is what it is.
claim(grammar.spelled(grammar.lit("a")).op == `term)
// Given a function it keeps its parts.
claim(grammar.giving(lines_form, (v, at) => v).rule == `lines && kind(grammar.giving(lines_form, (v, at) => v).gives) == `function)

output.write("grammar: ok")
// expect: grammar: ok
// end: completed
// summary: decided
