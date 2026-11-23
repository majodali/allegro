// Tests of next/ext/lib/analysis.alg.
capability output
import analysis
import class
import grammar

lit = grammar.lit
ref = grammar.ref
seq = grammar.seq
alt = grammar.alt

// A small language: a call or a name, a number, a bracketed list.
//   value  = call | name | number | list
//   call   = name "(" value ")"
//   list   = "[" items "]"
//   items  = (value more*)?
//   more   = "," value
//   blank  = space?           can read no byte
//   padded = blank value      begins with what value begins with
g = grammar.grammar(`value, {
  value: alt([ref(`call), ref(`name), ref(`number), ref(`list)]),
  call: seq([ref(`name), lit("("), ref(`value), lit(")")]),
  name: grammar.run("a name", "az"),
  number: grammar.run("a number", "09"),
  list: seq([lit("["), ref(`items), lit("]")]),
  items: grammar.opt(seq([ref(`value), grammar.star(ref(`more))])),
  more: seq([lit(","), ref(`value)]),
  blank: grammar.opt(lit(" ")),
  padded: seq([ref(`blank), ref(`value)]),
  either: alt([ref(`blank), ref(`number)]),
  ahead: alt([seq([grammar.guard(lit("x"), false), ref(`name)]), ref(`number)])
})
p = analysis.prepared(g)

claim(p.start == `value)
claim(count(p.rules) == count(g.rules))

// Which rules can read no byte.
no_table = []
claim(analysis.can_be_empty(grammar.star(lit("a")), no_table))
claim(analysis.can_be_empty(grammar.opt(lit("a")), no_table))
claim(analysis.can_be_empty(grammar.guard(lit("a"), true), no_table))
claim(!analysis.can_be_empty(lit("a"), no_table))
claim(analysis.can_be_empty(seq([]), no_table))
claim(!analysis.can_be_empty(alt([]), no_table))
claim(analysis.can_be_empty(grammar.many("space", "  "), no_table))

// The items of value: what each can begin with. 97 is a, 48 is 0, 91 is [.
items = p.rules.value.items
claim(count(items) == 4)
claim(class.has(items[0].set, 97) && !class.has(items[0].set, 48) && !items[0].open)
claim(class.has(items[1].set, 122) && class.size(items[1].set) == 26)
claim(class.has(items[2].set, 48) && class.size(items[2].set) == 10)
claim(class.has(items[3].set, 91) && class.size(items[3].set) == 1)
claim(items[0].g.op == `ref && items[0].g.name == `call)

// A sequence whose first item can read no byte begins with the next too:
// padded begins with a space, and with all that value begins with.
// 26 letters, 10 digits, the bracket and the space.
begin_padded = analysis.prepared(grammar.grammar(`s, {
  s: alt([ref(`padded), lit("!")]),
  padded: seq([ref(`blank), ref(`value)]),
  blank: grammar.opt(lit(" ")),
  value: alt([grammar.run("a name", "az"), grammar.run("a number", "09"), lit("[")])
})).rules.s.items[0]
claim(class.size(begin_padded.set) == 38 && class.has(begin_padded.set, 32) && !begin_padded.open)

// An item that can read no byte is tried whatever the next byte is.
claim(p.rules.either.items[0].open && !p.rules.either.items[1].open)
// So is an item that begins with a terminal that does not say how it starts.
unknown = analysis.prepared(grammar.grammar(`s, {s: alt([seq([grammar.until("some", "!"), lit("!")]), lit("a")])}))
claim(unknown.rules.s.items[0].open)
// A guard reads no byte, so what follows it is what the item begins with.
claim(class.has(p.rules.ahead.items[0].set, 97) && !p.rules.ahead.items[0].open)

// A star and an option know what their item can begin with. 44 is the comma.
claim(g.rules.items.op == `opt && p.rules.items.op == `opt)
claim(class.size(p.rules.items.set) == 37 && !p.rules.items.open)
claim(class.has(p.rules.items.item.items[1].set, 44) && class.size(p.rules.items.item.items[1].set) == 1)
claim(p.rules.items.item.items[1].op == `star && !p.rules.items.item.items[1].open)
claim(analysis.prepared(grammar.grammar(`s, {s: grammar.star(grammar.opt(lit("a")))})).rules.s.open)

// A rule two items of one alt both begin with is remembered: name, with
// which both call and name begin. No other is.
claim(count(p.kept) == 1 && p.kept[0].name == `name && !p.kept[0].grows)
claim(p.rules.call.items[0].kept)
claim(!p.rules.list.items[1].kept && !p.rules.more.items[1].kept)
// Through other rules too: a and b both begin with c, which begins with d.
deep = analysis.prepared(grammar.grammar(`s, {
  s: alt([ref(`a), ref(`b)]),
  a: seq([ref(`c), lit("1")]),
  b: seq([ref(`c), lit("2")]),
  c: seq([ref(`d), lit("+")]),
  d: lit("d"),
  e: seq([ref(`s), ref(`s)])
}))
claim(count(deep.kept) == 2 && deep.kept[0].name == `c && deep.kept[1].name == `d)
// One item that reaches a rule twice does not make it remembered.
twice = analysis.prepared(grammar.grammar(`s, {s: alt([seq([grammar.opt(ref(`a)), ref(`a)]), lit("z")]), a: lit("a")}))
claim(count(twice.kept) == 0)
// A grammar where no two items begin with the same rule remembers none.
plain = analysis.prepared(grammar.grammar(`s, {s: alt([ref(`a), ref(`b)]), a: lit("a"), b: seq([lit("b"), ref(`a)])}))
claim(count(plain.kept) == 0)

// A rule that names itself is no trouble to the analysis.
loop = analysis.prepared(grammar.grammar(`s, {s: alt([seq([lit("("), ref(`s), lit(")")]), lit("x")])}))
claim(class.has(loop.rules.s.items[0].set, 40) && class.size(loop.rules.s.items[0].set) == 1)

// A rule that can begin with itself, straight or through others or after
// what can read no byte; and one that only holds itself further on.
turns = analysis.prepared(grammar.grammar(`a, {
  a: alt([seq([ref(`a), lit("+")]), lit("x")]),
  b: seq([ref(`c), lit("1")]),
  c: alt([ref(`b), lit("y")]),
  d: seq([grammar.opt(lit("-")), ref(`d)]),
  e: seq([lit("("), ref(`e), lit(")")]),
  f: seq([ref(`a), ref(`e)])
}))
claim(turns.rules.f.items[0].grows && turns.rules.b.items[0].grows && turns.rules.c.items[0].g.grows && turns.rules.d.items[1].grows)
claim(!turns.rules.e.items[1].grows && !turns.rules.f.items[1].grows)
claim(turns.top.op == `ref && turns.top.name == `a && turns.top.grows)
// What a rule that begins with itself can begin with is what its other items begin with.
claim(class.has(turns.rules.a.items[0].set, 120) && class.size(turns.rules.a.items[0].set) == 1)

// A rule that reads the state or changes it, itself or through another,
// is not remembered; nor one with a spaced terminal where space reads the state.
step = grammar.stepper("a step", (text, at, n) => {read: 0, state: n}, false, class.no_ranges, true)
twice_begun(rules) => grammar.grammar(`s, put(rules, `s, alt([seq([ref(`a), lit("1")]), seq([ref(`a), lit("2")])])))
claim(count(analysis.prepared(twice_begun({a: lit("a")})).kept) == 1)
claim(count(analysis.prepared(twice_begun({a: seq([lit("a"), step])})).kept) == 0)
claim(count(analysis.prepared(twice_begun({a: seq([lit("a"), ref(`b)]), b: grammar.opt(step)})).kept) == 0)
spaced_rule = twice_begun({a: grammar.spaced(lit("a"))})
claim(count(analysis.prepared(spaced_rule).kept) == 1)
claim(count(analysis.prepared(grammar.with_space(spaced_rule, (text, at, state) => 0, true)).kept) == 0)
claim(count(analysis.prepared(grammar.with_space(spaced_rule, (text, at, state) => 0, false)).kept) == 1)
// The state and the space of the grammar are handed on.
claim(analysis.prepared(grammar.with_state(spaced_rule, 5)).state == 5)

// The words a terminal does not read, by their length in bytes.
worded = analysis.prepared(grammar.with_reserved(grammar.grammar(`s, {s: grammar.unless(grammar.run("a name", "az"), `words), t: grammar.run("a name", "az")}), `words, ["if", "else", "of", "when"]))
claim(count(worded.rules.s.words) == 5 && count(worded.rules.s.words[2]) == 2 && count(worded.rules.s.words[4]) == 2 && count(worded.rules.s.words[3]) == 0)
claim(worded.rules.s.words[2][1] == "of" && worded.rules.s.words[4][0] == "else")
claim(count(worded.rules.t.words) == 0)

output.write("analysis: ok")
// expect: analysis: ok
// end: completed
// summary: decided
