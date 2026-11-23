// Tests of next/ext/lib/engine.alg.
capability output
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

output.write("engine: ok")
// expect: engine: ok
// end: completed
// summary: decided
