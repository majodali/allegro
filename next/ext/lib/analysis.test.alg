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
claim(count(p.kept) == 1 && p.kept[0] == `name)
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
claim(count(deep.kept) == 2 && deep.kept[0] == `c && deep.kept[1] == `d)
// One item that reaches a rule twice does not make it remembered.
twice = analysis.prepared(grammar.grammar(`s, {s: alt([seq([grammar.opt(ref(`a)), ref(`a)]), lit("z")]), a: lit("a")}))
claim(count(twice.kept) == 0)
// A grammar where no two items begin with the same rule remembers none.
plain = analysis.prepared(grammar.grammar(`s, {s: alt([ref(`a), ref(`b)]), a: lit("a"), b: seq([lit("b"), ref(`a)])}))
claim(count(plain.kept) == 0)

// A rule that names itself is no trouble to the analysis.
loop = analysis.prepared(grammar.grammar(`s, {s: alt([seq([lit("("), ref(`s), lit(")")]), lit("x")])}))
claim(class.has(loop.rules.s.items[0].set, 40) && class.size(loop.rules.s.items[0].set) == 1)

output.write("analysis: ok")
// expect: analysis: ok
// end: completed
// summary: decided
