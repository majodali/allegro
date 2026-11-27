// Tests of next/ext/lib/engine.alg.
capability output
import change
import class
import engine
import grammar

lit = grammar.lit
ref = grammar.ref
seq = grammar.seq
alt = grammar.alt
star = grammar.star
opt = grammar.opt

// How many ways a text reads, and what its only reading gives, as a text:
// a terminal gives the text it read, a sequence and a repetition what
// their items give between brackets, an option [] or one thing between
// brackets, a guard [], and a rule and an alt what their form gives.
readings(p, text) => size(engine.parses(p, text))
size(a) => if is_failure(a) then 0 else length(a.readings)
length(l) => if count(l) == 0 then 0 else 1 + length(l.t)
tree(p, text) => engine.shown(engine.parses(p, text).readings.h)
failed_at(p, text) => engine.parses(p, text).at

// ---- A terminal, a rule, a sequence ----
one = engine.prepared(grammar.grammar(`s, {s: seq([lit("a"), ref(`b), lit("c")]), b: grammar.run("bees", "bb")}))
claim(tree(one, "abbc") == "[a bb c]")
claim(readings(one, "abbc") == 1)
// The whole text is read, or it is no parse.
claim(readings(one, "abbcc") == 0)
claim(readings(one, "") == 0)
// The farthest place a reading could not go on.
claim(failed_at(one, "abbx") == 3)
claim(failed_at(one, "ac") == 1)
claim(failed_at(one, "x") == 0)
claim(failed_at(one, "abb") == 3)
// Where every item is read and text is left over, it is where that text begins.
claim(failed_at(one, "abbcd") == 4)
claim(engine.parses(one, "x").failure == `no_parse)

// ---- Alternatives: every one is tried, and their order has no meaning ----
two = engine.prepared(grammar.grammar(`s, {s: alt([lit("ab"), seq([lit("a"), lit("b")]), lit("x")])}))
claim(tree(two, "x") == "x")
// "ab" reads two ways, and both are given.
claim(readings(two, "ab") == 2)
two_turned = engine.prepared(grammar.grammar(`s, {s: alt([lit("x"), seq([lit("a"), lit("b")]), lit("ab")])}))
claim(readings(two_turned, "ab") == 2 && readings(two_turned, "x") == 1)
// The first that matches does not hide a longer one: "a" and then "ab".
longer = engine.prepared(grammar.grammar(`s, {s: seq([alt([lit("a"), lit("ab")]), lit("c")])}))
claim(tree(longer, "abc") == "[ab c]")
claim(tree(longer, "ac") == "[a c]")
claim(failed_at(longer, "abd") == 2)

// An item that can read no byte is tried whatever the next byte is.
open = engine.prepared(grammar.grammar(`s, {s: seq([alt([opt(lit("a")), lit("b")]), lit("c")])}))
claim(readings(open, "c") == 1 && readings(open, "ac") == 1 && readings(open, "bc") == 1)
// The farthest place is the farthest of all the items, whichever is written first.
far = engine.prepared(grammar.grammar(`s, {s: alt([lit("ab"), seq([lit("a"), lit("c"), lit("d")])])}))
claim(failed_at(far, "acx") == 2)
far_turned = engine.prepared(grammar.grammar(`s, {s: alt([seq([lit("a"), lit("c"), lit("d")]), lit("ab")])}))
claim(failed_at(far_turned, "acx") == 2)

// ---- Repetition and option: every count is a result ----
many = engine.prepared(grammar.grammar(`s, {s: seq([star(lit("a")), opt(lit("a")), lit("b")])}))
// "aab": the star reads two and the option none, or the star one and the option one.
claim(readings(many, "aab") == 2)
claim(readings(many, "b") == 1)
claim(tree(many, "b") == "[[] [] b]")
items = engine.prepared(grammar.grammar(`s, {s: star(ref(`item)), item: alt([lit("a"), lit("b")])}))
claim(tree(items, "aba") == "[a b a]")
claim(tree(items, "") == "[]")
claim(failed_at(items, "abc") == 2)
// An item that reads no byte does not go round for ever.
idle = engine.prepared(grammar.grammar(`s, {s: seq([star(opt(lit("a"))), lit("b")])}))
claim(readings(idle, "aab") == 1 && readings(idle, "b") == 1)
// A text that reads two ways through one alt and two repetitions.
ways = engine.prepared(grammar.grammar(`s, {s: seq([ref(`a), ref(`a)]), a: alt([lit("x"), lit("xx")])}))
claim(readings(ways, "xxx") == 2 && readings(ways, "xx") == 1 && readings(ways, "xxxx") == 1)

// ---- A guard reads nothing ----
// A name is letters, and not the word "if" alone.
word = grammar.run("letters", "az")
names = engine.prepared(grammar.grammar(`s, {
  s: alt([ref(`key), ref(`name)]),
  key: seq([lit("if"), grammar.guard(word, false)]),
  name: seq([grammar.guard(ref(`key), false), word])
}))
claim(tree(names, "if") == "[if []]")
claim(tree(names, "iffy") == "[[] iffy]")
claim(readings(names, "if") == 1)
ahead = engine.prepared(grammar.grammar(`s, {s: seq([grammar.guard(lit("ab"), true), word])}))
claim(readings(ahead, "abc") == 1 && readings(ahead, "acb") == 0)

// ---- What is remembered gives the same trees ----
// call and name both begin with name, so name is remembered.
calls = grammar.grammar(`value, {
  value: alt([ref(`call), ref(`name), ref(`number), ref(`list)]),
  call: seq([ref(`name), lit("("), ref(`value), lit(")")]),
  name: grammar.run("a name", "az"),
  number: grammar.run("a number", "09"),
  list: seq([lit("["), opt(seq([ref(`value), star(seq([lit(","), ref(`value)]))])), lit("]")])
})
kept = engine.prepared(calls)
claim(count(kept.kept) == 1)
claim(tree(kept, "f(x)") == "[f ( x )]")
claim(tree(kept, "[f(1),[],g(h(x))]") == "[[ [[[f ( 1 )] [[, [[ [] ]]] [, [g ( [h ( x )] )]]]]] ]]")
claim(failed_at(kept, "[f(1),]") == 6)
claim(failed_at(kept, "f(") == 2)

// A rule remembered is read at the end of a text too.
digits = grammar.many("digits", "09")
ended = engine.prepared(grammar.grammar(`s, {s: alt([seq([ref(`n), lit("!")]), ref(`n)]), n: digits}))
claim(count(ended.kept) == 1)
claim(readings(ended, "") == 1 && readings(ended, "12") == 1 && readings(ended, "12!") == 1)

// ---- Arithmetic, with each level of binding a rule ----
sp = grammar.many("space", "  ")
sums = engine.prepared(grammar.grammar(`start, {
  start: seq([ref(`sum), sp, grammar.end]),
  sum: seq([ref(`product), star(seq([sp, alt([lit("+"), lit("-")]), ref(`product)]))]),
  product: seq([ref(`factor), star(seq([sp, alt([lit("*"), lit("/")]), ref(`factor)]))]),
  factor: seq([sp, alt([grammar.run("a number", "09"), seq([lit("("), ref(`sum), sp, lit(")")])])])
}))
claim(readings(sums, "12 * (3 + 4) - 10 / 2") == 1)
claim(readings(sums, "1") == 1)
claim(tree(sums, "1+2") == "[[[[ 1] []] [[ + [[ 2] []]]]]  ]")
claim(failed_at(sums, "1 + * 2") == 4)
claim(failed_at(sums, "(1 + 2") == 6)

// ---- A rule that begins with itself ----
number = grammar.run("a number", "09")
left = engine.prepared(grammar.grammar(`sum, {sum: alt([seq([ref(`sum), lit("+"), ref(`one)]), ref(`one)]), one: number}))
claim(tree(left, "7") == "7")
// Each sign takes all that is before it: (1+2)+3.
claim(tree(left, "1+2+3") == "[[1 + 2] + 3]")
claim(readings(left, "1+2+3+4+5+6") == 1)
claim(failed_at(left, "1+") == 2 && failed_at(left, "+1") == 0 && failed_at(left, "1+2+x") == 4)
// The same with the items of the alt written the other way round.
left_turned = engine.prepared(grammar.grammar(`sum, {sum: alt([ref(`one), seq([ref(`sum), lit("+"), ref(`one)])]), one: number}))
claim(tree(left_turned, "1+2") == "[1 + 2]")
// A rule that begins and ends with itself reads a row every way: two for three, five for four.
both_ends = engine.prepared(grammar.grammar(`e, {e: alt([seq([ref(`e), lit("+"), ref(`e)]), number])}))
claim(readings(both_ends, "1+2") == 1 && readings(both_ends, "1+2+3") == 2 && readings(both_ends, "1+2+3+4") == 5)
// Two rules that begin with each other.
pair = engine.prepared(grammar.grammar(`a, {a: alt([seq([ref(`b), lit("x")]), lit("y")]), b: alt([seq([ref(`a), lit("z")]), lit("w")])}))
claim(readings(pair, "y") == 1 && readings(pair, "wx") == 1 && readings(pair, "yzx") == 1 && readings(pair, "wxzxzx") == 1)
claim(readings(pair, "yz") == 0 && failed_at(pair, "yzy") == 2)
// A rule that begins with itself after an item that can read nothing.
hidden = engine.prepared(grammar.grammar(`a, {a: alt([seq([opt(lit("-")), ref(`a), lit("!")]), lit("x")])}))
claim(readings(hidden, "x!!") == 1 && readings(hidden, "-x!") == 1 && readings(hidden, "--x!!") == 1 && readings(hidden, "-x") == 0)
// "-x!!" reads two ways: the sign with x! and then !, or with x and then both.
claim(readings(hidden, "-x!!") == 2)
// A rule that begins with itself and is remembered: both items of s begin with it.
shared = engine.prepared(grammar.grammar(`s, {s: alt([seq([ref(`sum), lit(";")]), seq([ref(`sum), lit(".")])]), sum: alt([seq([ref(`sum), lit("+"), ref(`one)]), ref(`one)]), one: number}))
claim(count(shared.kept) == 2 && shared.kept[0].name == `sum && shared.kept[0].grows && !shared.kept[1].grows)
claim(readings(shared, "1+2+3.") == 1 && readings(shared, "1;") == 1 && failed_at(shared, "1+2,") == 3)
// Two rules that begin with each other, both remembered: two items of
// r begin with x, and so with r. What x gives where r is read in turns is not
// taken from the table, since it changes from turn to turn.
mutual = engine.prepared(grammar.grammar(`r, {r: alt([seq([ref(`x), lit("!")]), seq([ref(`x), lit("?")]), lit("a")]), x: seq([ref(`r), lit("+")])}))
claim(count(mutual.kept) == 2 && mutual.kept[0].name == `r && mutual.kept[1].name == `x)
claim(attempt(readings(mutual, "a+!+?"), 200000) == 1 && attempt(readings(mutual, "a"), 200000) == 1 && attempt(readings(mutual, "a+"), 200000) == 0)
// A rule that can read no byte, met twice at one position: after a
// result that read nothing, the rule is met again where it began. "xx"
// reads two ways, one of which follows the empty result with a new one.
again = engine.prepared(grammar.grammar(`a, {a: alt([seq([ref(`a), ref(`c)]), opt(lit("q"))]), c: seq([ref(`a), lit("x")])}))
claim(readings(again, "") == 1 && readings(again, "x") == 1 && readings(again, "xx") == 2 && readings(again, "qx") == 2)
// A rule with two items that begin with itself.
signs = engine.prepared(grammar.grammar(`e, {e: alt([seq([ref(`e), lit("+"), number]), seq([ref(`e), lit("-"), number]), seq([ref(`e), lit("!")]), number])}))
claim(tree(signs, "1-2!+3") == "[[[1 - 2] !] + 3]")
claim(readings(signs, "1+2-3+4-5!!") == 1 && failed_at(signs, "1+2-+") == 4)
// A rule that begins with itself inside an option, and inside a repetition.
in_opt = engine.prepared(grammar.grammar(`e, {e: seq([opt(seq([ref(`e), lit("+")])), number])}))
claim(readings(in_opt, "1") == 1 && readings(in_opt, "1+2+3") == 1 && readings(in_opt, "1+") == 0)
// "x,x,x" reads two ways: the repetition twice, or once around "x,x".
in_star = engine.prepared(grammar.grammar(`e, {e: seq([star(seq([ref(`e), lit(",")])), lit("x")])}))
claim(readings(in_star, "x") == 1 && readings(in_star, "x,x") == 1 && readings(in_star, "x,x,x") == 2)
// A rule that reads itself and no byte between has no end of readings, and is refused.
idle_rule = engine.prepared(grammar.grammar(`a, {a: alt([ref(`a), lit("x")])}))
claim(attempt(readings(idle_rule, "x"), 100000).reason == "a rule reads itself and no byte between")

// ---- A state beside the position ----
// The state counts the brackets open: one that closes is read where one
// is open, and the text ends where none is.
opened = grammar.stepper("(", (text, at, depth) => if grammar.byte(text, at) == 40 then {read: 1, state: depth + 1} else [], true, class.pairs("(("), false)
closed = grammar.stepper(")", (text, at, depth) => if grammar.byte(text, at) == 41 && depth > 0 then {read: 1, state: depth - 1} else [], true, class.pairs("))"), false)
level = grammar.stepper("no bracket open", (text, at, depth) => if depth == 0 then {read: 0, state: depth} else [], false, class.no_ranges, true)
brackets = engine.prepared(grammar.with_state(grammar.grammar(`s, {s: seq([star(alt([opened, closed, lit("x")])), level, grammar.end])}), 0))
claim(readings(brackets, "(x(x))x") == 1 && readings(brackets, "") == 1)
claim(readings(brackets, "(x") == 0 && failed_at(brackets, "(x") == 2)
claim(readings(brackets, "x)") == 0 && failed_at(brackets, "x)") == 1)
// A state the grammar begins with.
begun = engine.prepared(grammar.with_state(grammar.grammar(`s, {s: seq([star(alt([opened, closed, lit("x")])), level, grammar.end])}), 2))
claim(readings(begun, "x))") == 1 && readings(begun, "x)") == 0)
// A rule remembered touches no state, and what it gives is read with the
// state of whoever asks: `more` changes the state before n is read twice.
more = grammar.stepper("more", (text, at, n) => {read: 0, state: n + 1}, false, class.no_ranges, true)
is_one = grammar.stepper("the state 1", (text, at, n) => if n == 1 then {read: 0, state: n} else [], false, class.no_ranges, true)
asked = engine.prepared(grammar.with_state(grammar.grammar(`s, {s: seq([more, alt([seq([ref(`n), is_one]), seq([ref(`n), lit("!")])])]), n: number}), 0))
claim(count(asked.kept) == 1 && readings(asked, "12") == 1 && readings(asked, "12!") == 1)
// A rule that touches the state is not remembered, though two items begin with it.
touching = engine.prepared(grammar.with_state(grammar.grammar(`s, {s: alt([seq([ref(`n), lit("?")]), seq([ref(`n), lit("!")])]), n: seq([more, number])}), 0))
claim(count(touching.kept) == 0 && readings(touching, "12!") == 1)
// A rule met again at one position with another state is refused.
restless = engine.prepared(grammar.with_state(grammar.grammar(`a, {a: alt([seq([more, ref(`a), lit("!")]), lit("x")])}), 0))
claim(attempt(readings(restless, "x!"), 100000).reason == "a rule is met again at one position with another state")
// A guard leaves the state as it was, whatever its item would have made of it.
looking = engine.prepared(grammar.with_state(grammar.grammar(`s, {s: seq([grammar.guard(opened, true), level, opened, closed])}), 0))
claim(readings(looking, "()") == 1)

// ---- Space after a terminal, and reserved words ----
spaces = (text, at, state) => blanks(text, at, 0)
blanks(text, at, n) => if grammar.byte(text, at + n) == 32 then blanks(text, at, n + 1) else n
word_of = grammar.spaced(grammar.unless(grammar.run("a name", "az"), `words))
when_word = grammar.spaced(lit("when"))
plain_words = grammar.with_reserved(grammar.with_space(grammar.grammar(`s, {s: alt([seq([when_word, word_of]), seq([word_of, lit("="), word_of])])}), spaces, false), `words, ["if", "else"])
spaced_words = engine.prepared(plain_words)
// A terminal gives the word and not the space after it, and the reading goes on after the space.
claim(tree(spaced_words, "a   =b  ") == "[a = b]")
// A terminal not made spaced reads no space after it.
claim(readings(spaced_words, "a = b") == 0 && failed_at(spaced_words, "a = b") == 3)
claim(readings(spaced_words, "if =b") == 0 && readings(spaced_words, "iffy =b") == 1 && readings(spaced_words, "a =else") == 0)
// Words added to a set are kept out as the first are: "when x" read one way, not two.
claim(readings(spaced_words, "when =b") == 1 && readings(spaced_words, "when x") == 1)
with_when = engine.prepared(grammar.with_reserved(plain_words, `words, ["when"]))
claim(readings(with_when, "when =b") == 0 && readings(with_when, "when x") == 1 && readings(with_when, "if =b") == 0 && readings(with_when, "whence =b") == 1)

// ---- What a form is made to give ----
giving = grammar.giving
wide = (text, at, state) => wide_from(text, at, 0)
wide_from(text, at, n) => if grammar.byte(text, at + n) == 32 || grammar.byte(text, at + n) == 10 then wide_from(text, at, n + 1) else n
a_number = grammar.spaced(giving(number, (v, at) => {number: v, at: at}))
adds = engine.prepared(grammar.with_space(grammar.grammar(`sum, {
  sum: alt([giving(seq([ref(`sum), grammar.spaced(lit("+")), ref(`one)]), (v, at) => {add: [v[0], v[2]], sign: v[1], at: at}), ref(`one)]),
  one: a_number
}), wide, false))
added = engine.parse(adds, "1 + 23  ")
claim(added.add[0].number == "1" && added.add[1].number == "23" && added.sign == "+")
// A place is of what was read, the space after it not counted: bytes 0 to 6.
claim(added.at.start.index == 0 && added.at.end.index == 6)
claim(added.add[1].at.start.index == 4 && added.add[1].at.end.index == 6)
claim(added.at.start.line == 1 && added.at.start.column == 1 && added.add[1].at.start.column == 5 && added.add[1].at.end.column == 7)
// Lines and columns are from 1, and a column is counted in its own line.
lined = engine.parse_of(adds, "1 +\n  23 +\n4", "sums.txt")
claim(lined.add[1].number == "4" && lined.add[1].at.start.line == 3 && lined.add[1].at.start.column == 1 && lined.add[1].at.start.index == 11)
claim(lined.add[0].add[1].at.start.line == 2 && lined.add[0].add[1].at.start.column == 3 && lined.add[0].add[1].at.end.column == 5)
claim(lined.add[0].at.start.line == 1 && lined.add[0].at.end.line == 2 && lined.at.end.line == 3)
// What the text is called is part of every place; with none given it is the empty text.
claim(lined.at.source == "sums.txt" && lined.add[0].add[0].at.source == "sums.txt" && added.at.source == "")
// A form given a function twice gives what the second makes of what the first made.
twice_given = engine.prepared(grammar.grammar(`s, {s: giving(giving(lit("a"), (v, at) => v ++ "!"), (v, at) => v ++ "?")}))
claim(engine.parse(twice_given, "a") == "a!?")
// Each of the seven forms may be given one: here each says what it is.
said(what) => (v, at) => {what: what, from: v}
each_form = engine.prepared(grammar.grammar(`s, {
  s: giving(seq([giving(ref(`t), said(`ref)), giving(star(lit("b")), said(`star)), giving(opt(lit("c")), said(`opt)), giving(grammar.guard(lit("d"), true), said(`guard)), giving(alt([lit("d"), lit("e")]), said(`alt))]), said(`seq)),
  t: giving(lit("a"), said(`term))
}))
forms = engine.parse(each_form, "abbd")
claim(forms.what == `seq && count(forms.from) == 5)
claim(forms.from[0].what == `ref && forms.from[0].from.what == `term && forms.from[0].from.from == "a")
claim(forms.from[1].what == `star && count(forms.from[1].from) == 2 && forms.from[1].from[1] == "b")
claim(forms.from[2].what == `opt && count(forms.from[2].from) == 0)
claim(forms.from[3].what == `guard && count(forms.from[3].from) == 0)
claim(forms.from[4].what == `alt && forms.from[4].from == "d")
// A function is not called for a reading nothing reads: this one cannot be called at all.
never = engine.prepared(grammar.grammar(`s, {s: seq([giving(lit("a"), (v, at) => refuse("not read")), lit("b")])}))
claim(readings(never, "ab") == 1 && engine.parse(never, "ab")[1] == "b")

// ---- A text that reads one way ----
claim(engine.parse(two, "x") == "x")
claim(engine.parse(two, "q").failure == `no_parse && engine.parse(two, "q").at == 0)
// A text that reads two ways refutes the claim: refuted_claims.test.alg.

// ---- A rule marked settled has one result at most wherever it is read ----
// "xx!" reads one way, but the rule a has three results at its beginning:
// "x", "x" and no more, and "xx".
unsettled = grammar.grammar(`s, {s: seq([ref(`a), lit("!")]), a: alt([lit("x"), seq([lit("x"), opt(lit("x"))])])})
claim(readings(engine.prepared(unsettled), "xx!") == 1)
// With a marked settled the claim is refuted: refuted_claims.test.alg.
// The mark is on a, and s has one result.
claim(readings(engine.prepared(grammar.with_settled(unsettled, [`s])), "xx!") == 1)
// A settled rule with one result, and with none.
settled_one = engine.prepared(grammar.with_settled(grammar.grammar(`s, {s: star(ref(`a)), a: seq([number, lit(";")])}), [`a]))
claim(readings(settled_one, "1;22;") == 1 && readings(settled_one, "1;2") == 0)

// ---- Lines read in turns with the grammar ----

// A tiny language: lines of the letter a, a line `+x` that adds the
// letter x to what a line may be, and lines between brackets.
letters = grammar.grammar(`text, {
  text: seq([ref(`lines), grammar.end]),
  lines: grammar.turns(`lines, ref(`line), lit("\n"), asks_change),
  line: alt([lit("a"), grammar.giving(seq([lit("+"), grammar.one("letter", "bz")]), (v, at) => {add: v[1]}), seq([lit("(\n"), ref(`lines), lit("\n)")])])})
asks_change(v) => if kind(v) == `structure && count(v) == 1 && kind(key(v, 0)) == `symbol then [v] else []
// What a line asks is added to the grammar held, which is prepared again.
adding(held, asked) => if asked.add == "z" then {failure: `no_change, reason: "no z"} else held_and_prepared(change.changed(held, [[change.append(`line, lit(asked.add))]]))
held_and_prepared(g) => {held: g, prepared: engine.prepared(g)}
letters_ready = engine.prepared(letters)
turns_read(text) => size(engine.parses_with(letters_ready, text, "", letters, adding))
turns_tree(text) => engine.shown(engine.parses_with(letters_ready, text, "", letters, adding).readings.h)
turns_failed(text) => engine.parses_with(letters_ready, text, "", letters, adding).at
// Lines with no change read as a repetition does.
claim(turns_read("a") == 1 && turns_read("a\na\na") == 1 && turns_read("a\nb") == 0 && turns_failed("a\nb") == 2)
claim(turns_tree("a\na") == "[[a a] ]")
// A change holds from the line after it: not on its own line, and not before it.
claim(turns_read("+b\nb\na\nb") == 1 && turns_read("b\n+b") == 0 && turns_read("+b\nc") == 0)
// Two changes, each beside the one before.
claim(turns_read("+b\n+c\nc\nb\na") == 1)
// A change ends with its lines: one made between brackets holds there, and not after them.
claim(turns_read("(\n+b\nb\n)\na") == 1 && turns_read("(\n+b\nb\n)\nb") == 0 && turns_failed("(\n+b\nb\n)\nb") == 9)
// One made before the brackets holds between them and after them.
claim(turns_read("+b\n(\nb\n+c\nc\n)\nb") == 1 && turns_read("+b\n(\n+c\n)\nc") == 0)
// The same prepared grammar reads another text as it was: a change touches no grammar, it gives another.
claim(turns_read("+b\nb") == 1 && turns_read("b") == 0)
// A change that is refused refuses the reading, with its reason, also where the last of its lines asks it.
claim(attempt(turns_read("+z\na"), 200000).reason == "no z" && attempt(turns_read("a\n+z"), 200000).reason == "no z")
// Whoever begins a reading with `parses` takes no change.
claim(attempt(size(engine.parses(letters_ready, "+b\nb")), 200000).reason == "a line asks for a change of the grammar, and whoever began the reading takes none")
claim(size(engine.parses(letters_ready, "a\na")) == 1)

// ---- Lines read in the grammar before a change as well ----
// `+w` puts brackets around what every line gives: a change of what a line means. `+b` only adds.
wrapping(held, asked) => if asked.add == "w" then held_beside(change.changed(held, [[change.wrap(`line, f => grammar.giving(f, (v, at) => [v]))]])) else held_beside(change.changed(held, [[change.append(`line, lit(asked.add))]]))
held_beside(g) => {held: g, prepared: engine.prepared(g), beside: true}
unwatched(held, asked) => held_and_prepared(change.changed(held, [[change.wrap(`line, f => grammar.giving(f, (v, at) => [v]))]]))
beside_read(text) => size(engine.parses_with(letters_ready, text, "", letters, wrapping))
// A line the grammar before could not read, and a line both read alike: no harm.
claim(beside_read("+b\nb\na\n(\na\n)") == 1)
// A line both read, and not alike: refused, with where and both readings.
refusal = attempt(beside_read("+w\na"), 400000).reason
claim(refusal == "the line that ends at 2:2 reads one way before the change of the grammar and another after it. Before: a After: (a)")
// The same change, made by one who did not ask for the lines to be compared, goes through.
claim(size(engine.parses_with(letters_ready, "+w\na", "", letters, unwatched)) == 1)
// The comparison is with the grammar before the last change: after `+b`, a line `b` is read by both sides of `+c`.
claim(beside_read("+b\n+c\nb\nc") == 1)

// What is alike: the same keys, and the same bits at every leaf. A line `a` gives a structure, and `!` asks for
// the rule of a line to be replaced by one that gives another.
keyed_line(made) => alt([grammar.giving(lit("a"), (v, at) => made(v)), grammar.giving(lit("!"), (v, at) => `go)])
keyed = grammar.grammar(`lines, {lines: grammar.turns(`lines, ref(`line), lit(";"), v => if kind(v) == `symbol then [v] else []), line: keyed_line(v => {p: v})})
replacing(made) => (held, asked) => held_beside(change.changed(held, [[change.replace(`line, keyed_line(made))]]))
keyed_read(made) => attempt(size(engine.parses_with(engine.prepared(keyed), "!;a", "", keyed, replacing(made))), 400000)
claim(keyed_read(v => {p: v}) == 1)
claim(keyed_read(v => {q: v}).reason == "the line that ends at 1:4 reads one way before the change of the grammar and another after it. Before: (p:a) After: (q:a)")
claim(keyed_read(v => {p: "b"}).reason == "the line that ends at 1:4 reads one way before the change of the grammar and another after it. Before: (p:a) After: (p:b)")
// A place is left out of the comparison and of the outline: two readings of the same bytes that are alike in all else have the same places.
claim(keyed_read(v => {p: v, at: 7}).failure == `refuted && keyed_read(v => {at: 1, p: v}).failure == `refuted)

output.write("engine: ok")
// expect: engine: ok
// end: completed
// summary: decided
