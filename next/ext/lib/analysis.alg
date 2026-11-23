// An analysis of a grammar, written in Allegretto.
//
// Whose: the kernel stream (lane R). Two of the four things that make
// the engine fast (docs/plans/book-pass.md section 10.4): what cannot
// match is not tried, and only what pays is remembered.
//
// `prepared(g)` reads a grammar (grammar.alg) and gives the same grammar
// with what the engine needs written on it:
//
//   {start, rules, kept}
//
// `rules` is the grammar's rules in the same forms, with two changes.
// An item of an `alt` is {g, set, open}: `g` is the item; `set` is the
// class of the bytes the item can start with; `open` is true where the
// item is tried whatever the next byte is, because it can read no byte
// at all or begins with a terminal that does not say how it starts. A
// `star` and an `opt` have `set` and `open` too, for their one item. A
// `ref` has the entry `kept`: true where the results of its rule at a
// position are remembered. `kept` at the top is the names of the rules
// remembered, a structure with no keys.
//
// A rule is remembered where two items of one `alt` can both begin with
// it: then the rule is read twice at one position, and so is all that
// follows from it. A rule that only one path reaches is read once, and
// remembering it would cost and save nothing.
//
// Nothing here parses a text. Each part is worked out when it is first
// read, and once.
import class
import set

export prepared(g) => made(g, facts(g.rules))
made(g, x) => {start: g.start, rules: readied(g.rules, x, 0, []), kept: kept_names(g.rules, x.kept, 0, [])}

// What the analysis knows of a grammar: its rules, the number of each
// rule by name, which rules can read no byte, and the rules remembered.
facts(rules) => known(rules, numbered(rules, 0, []), settled(rules, cleared(rules, 0, []), 0))
known(rules, numbers, empties) => {rules: rules, numbers: numbers, empties: empties, kept: remembered({rules: rules, numbers: numbers, empties: empties})}
numbered(rules, i, out) => if i == count(rules) then out else numbered(rules, i + 1, put(out, key(rules, i), i))

// ---- Which rules can read no byte ----

// A table from a rule's name to true or false, begun with false for
// each and worked over until a turn changes nothing.
cleared(rules, i, out) => if i == count(rules) then out else cleared(rules, i + 1, put(out, key(rules, i), false))
settled(rules, table, n) => settled_next(rules, turn(rules, table, 0, []), n)
settled_next(rules, next, n) => if how_many(next, 0, 0) == n then next else settled(rules, next, how_many(next, 0, 0))
turn(rules, table, i, out) =>
  if i == count(rules) then out
  else turn(rules, table, i + 1, put(out, key(rules, i), can_be_empty(get(rules, key(rules, i)), table)))
how_many(table, i, n) => if i == count(table) then n else how_many(table, i + 1, if get(table, i) then n + 1 else n)

// True where the form g can read no byte, by a table of the rules.
export can_be_empty(g, table) =>
  if g.op == `term then g.empty
  else if g.op == `ref then get(table, g.name)
  else if g.op == `seq then all_empty(g.items, 0, table)
  else if g.op == `alt then any_empty(g.items, 0, table)
  else true
all_empty(items, i, table) => i == count(items) || (can_be_empty(items[i], table) && all_empty(items, i + 1, table))
any_empty(items, i, table) => i < count(items) && (can_be_empty(items[i], table) || any_empty(items, i + 1, table))

// ---- What a form can begin with ----

// What is gathered: the rules met, as a set of their numbers and as a
// list; the ranges of bytes of the terminals met; and whether one of
// them does not say how it starts.
nothing_yet = {seen: set.empty, met: [], ranges: class.no_ranges, any: false}

// What the form g can begin with, added to what is gathered in a. A
// rule is followed once: what it begins with is already gathered.
begins(a, g, x) =>
  if g.op == `term then begins_term(a, g)
  else if g.op == `ref then begins_rule(a, g.name, get(x.numbers, g.name), x)
  else if g.op == `seq then begins_seq(a, g.items, 0, x)
  else if g.op == `alt then begins_each(a, g.items, 0, x)
  else begins(a, g.item, x)
begins_term(a, g) =>
  if g.known then {seen: a.seen, met: a.met, ranges: class.both(g.ranges, a.ranges), any: a.any}
  else {seen: a.seen, met: a.met, ranges: a.ranges, any: true}
begins_rule(a, name, n, x) =>
  if set.has(a.seen, n) then a
  else begins({seen: set.with_member(a.seen, n), met: {h: n, t: a.met}, ranges: a.ranges, any: a.any}, get(x.rules, name), x)
// A sequence begins with its first item, and with the next too where
// the first can read no byte, and so on.
begins_seq(a, items, i, x) =>
  if i == count(items) then a
  else if can_be_empty(items[i], x.empties) then begins_seq(begins(a, items[i], x), items, i + 1, x)
  else begins(a, items[i], x)
begins_each(a, items, i, x) => if i == count(items) then a else begins_each(begins(a, items[i], x), items, i + 1, x)

// ---- Which rules are remembered ----

// The set of the numbers of the rules that two items of one `alt` can
// both begin with, over every `alt` of every rule.
remembered(x) => remembered_rules(x, 0, set.empty)
remembered_rules(x, i, kept) =>
  if i == count(x.rules) then kept
  else remembered_rules(x, i + 1, remembered_in(get(x.rules, i), x, kept))
remembered_in(g, x, kept) =>
  if g.op == `term || g.op == `ref then kept
  else if g.op == `seq then remembered_items(g.items, 0, x, kept)
  else if g.op == `alt then remembered_items(g.items, 0, x, shared(g.items, 0, x, set.empty, kept))
  else remembered_in(g.item, x, kept)
remembered_items(items, i, x, kept) =>
  if i == count(items) then kept
  else remembered_items(items, i + 1, x, remembered_in(items[i], x, kept))
// `once` is the rules an earlier item begins with. A rule met again goes
// to `kept`.
shared(items, i, x, once, kept) =>
  if i == count(items) then kept
  else shared_next(items, i, x, noted(begins(nothing_yet, items[i], x).met, once, kept))
shared_next(items, i, x, n) => shared(items, i + 1, x, n.once, n.kept)
noted(met, once, kept) =>
  if count(met) == 0 then {once: once, kept: kept}
  else if set.has(once, met.h) then noted(met.t, once, set.with_member(kept, met.h))
  else noted(met.t, set.with_member(once, met.h), kept)

kept_names(rules, kept, i, out) =>
  if i == count(rules) then out
  else if set.has(kept, i) then kept_names(rules, kept, i + 1, put(out, [], key(rules, i)))
  else kept_names(rules, kept, i + 1, out)

// ---- The grammar with the analysis written on it ----

readied(rules, x, i, out) =>
  if i == count(rules) then out
  else readied(rules, x, i + 1, put(out, key(rules, i), ready(get(rules, i), x)))
ready(g, x) =>
  if g.op == `term then g
  else if g.op == `ref then {op: `ref, name: g.name, kept: set.has(x.kept, get(x.numbers, g.name))}
  else if g.op == `seq then {op: `seq, items: ready_items(g.items, 0, x, [])}
  else if g.op == `alt then {op: `alt, items: ready_choices(g.items, 0, x, [])}
  else if g.op == `guard then {op: `guard, item: ready(g.item, x), holds: g.holds}
  else gated(g.op, g.item, begins(nothing_yet, g.item, x), x)
gated(op, item, b, x) => {op: op, item: ready(item, x), set: class.made(b.ranges), open: b.any || can_be_empty(item, x.empties)}
ready_items(items, i, x, out) =>
  if i == count(items) then out
  else ready_items(items, i + 1, x, put(out, [], ready(items[i], x)))
ready_choices(items, i, x, out) =>
  if i == count(items) then out
  else ready_choices(items, i + 1, x, put(out, [], choice(items[i], begins(nothing_yet, items[i], x), x)))
choice(g, b, x) => {g: ready(g, x), set: class.made(b.ranges), open: b.any || can_be_empty(g, x.empties)}
