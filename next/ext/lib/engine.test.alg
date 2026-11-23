// Tests of next/ext/lib/engine.alg.
capability output
import class
import engine
import grammar

lit = grammar.lit
ref = grammar.ref
seq = grammar.seq
alt = grammar.alt
star = grammar.star
opt = grammar.opt

// How many trees a text has, and its only tree as a text.
readings(p, text) => size(engine.parses(p, text))
size(a) => if is_failure(a) then 0 else length(a.trees)
length(l) => if count(l) == 0 then 0 else 1 + length(l.t)
tree(p, text) => engine.shown(engine.parses(p, text).trees.h, text)
failed_at(p, text) => engine.parses(p, text).at

// ---- A terminal, a rule, a sequence ----
one = engine.prepared(grammar.grammar(`s, {s: seq([lit("a"), ref(`b), lit("c")]), b: grammar.run("bees", "bb")}))
claim(tree(one, "abbc") == "s([a \"a\" b(bees \"bb\") c \"c\"])")
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
claim(tree(two, "x") == "s(#2 x \"x\")")
// "ab" reads two ways, and both are given.
claim(readings(two, "ab") == 2)
two_turned = engine.prepared(grammar.grammar(`s, {s: alt([lit("x"), seq([lit("a"), lit("b")]), lit("ab")])}))
claim(readings(two_turned, "ab") == 2 && readings(two_turned, "x") == 1)
// The first that matches does not hide a longer one: "a" and then "ab".
longer = engine.prepared(grammar.grammar(`s, {s: seq([alt([lit("a"), lit("ab")]), lit("c")])}))
claim(tree(longer, "abc") == "s([#1 ab \"ab\" c \"c\"])")
claim(tree(longer, "ac") == "s([#0 a \"a\" c \"c\"])")
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
claim(tree(many, "b") == "s([<> ? b \"b\"])")
items = engine.prepared(grammar.grammar(`s, {s: star(ref(`item)), item: alt([lit("a"), lit("b")])}))
claim(tree(items, "aba") == "s(<item(#0 a \"a\") item(#1 b \"b\") item(#0 a \"a\")>)")
claim(tree(items, "") == "s(<>)")
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
claim(tree(names, "if") == "s(#0 key([if \"if\" !]))")
claim(tree(names, "iffy") == "s(#1 name([! letters \"iffy\"]))")
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
claim(tree(kept, "f(x)") == "value(#0 call([name(a name \"f\") ( \"(\" value(#1 name(a name \"x\")) ) \")\"]))")
claim(tree(kept, "[f(1),[],g(h(x))]") == "value(#3 list([[ \"[\" ?[value(#0 call([name(a name \"f\") ( \"(\" value(#2 number(a number \"1\")) ) \")\"])) <[, \",\" value(#3 list([[ \"[\" ? ] \"]\"]))] [, \",\" value(#0 call([name(a name \"g\") ( \"(\" value(#0 call([name(a name \"h\") ( \"(\" value(#1 name(a name \"x\")) ) \")\"])) ) \")\"]))]>] ] \"]\"]))")
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
claim(tree(sums, "1+2") == "start([sum([product([factor([space \"\" #0 a number \"1\"]) <>]) <[space \"\" #0 + \"+\" product([factor([space \"\" #0 a number \"2\"]) <>])]>]) space \"\" the end of the text \"\"])")
claim(failed_at(sums, "1 + * 2") == 4)
claim(failed_at(sums, "(1 + 2") == 6)

// ---- A rule that begins with itself ----
number = grammar.run("a number", "09")
left = engine.prepared(grammar.grammar(`sum, {sum: alt([seq([ref(`sum), lit("+"), ref(`one)]), ref(`one)]), one: number}))
claim(tree(left, "7") == "sum(#1 one(a number \"7\"))")
// Each sign takes all that is before it: (1+2)+3.
claim(tree(left, "1+2+3") == "sum(#0 [sum(#0 [sum(#1 one(a number \"1\")) + \"+\" one(a number \"2\")]) + \"+\" one(a number \"3\")])")
claim(readings(left, "1+2+3+4+5+6") == 1)
claim(failed_at(left, "1+") == 2 && failed_at(left, "+1") == 0 && failed_at(left, "1+2+x") == 4)
// The same with the items of the alt written the other way round.
left_turned = engine.prepared(grammar.grammar(`sum, {sum: alt([ref(`one), seq([ref(`sum), lit("+"), ref(`one)])]), one: number}))
claim(tree(left_turned, "1+2") == "sum(#1 [sum(#0 one(a number \"1\")) + \"+\" one(a number \"2\")])")
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
// The tree keeps where the word ended, and the reading goes on after the space.
claim(tree(spaced_words, "a   =b  ") == "s(#1 [a name \"a\" = \"=\" a name \"b\"])")
// A terminal not made spaced reads no space after it.
claim(readings(spaced_words, "a = b") == 0 && failed_at(spaced_words, "a = b") == 3)
claim(readings(spaced_words, "if =b") == 0 && readings(spaced_words, "iffy =b") == 1 && readings(spaced_words, "a =else") == 0)
// Words added to a set are kept out as the first are: "when x" read one way, not two.
claim(readings(spaced_words, "when =b") == 1 && readings(spaced_words, "when x") == 1)
with_when = engine.prepared(grammar.with_reserved(plain_words, `words, ["when"]))
claim(readings(with_when, "when =b") == 0 && readings(with_when, "when x") == 1 && readings(with_when, "if =b") == 0 && readings(with_when, "whence =b") == 1)

output.write("engine: ok")
// expect: engine: ok
// end: completed
// summary: decided
