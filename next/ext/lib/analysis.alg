// An analysis of a grammar, written in Allegretto.
//
// Whose: the kernel stream (lane R). Two of the four things that make
// the engine fast (docs/plans/book-pass.md section 10.4): what cannot
// match is not tried, and only what pays is remembered.
//
// `prepared(g)` reads a grammar (grammar.alg) and gives the same grammar
// with what the engine needs written on it:
//
//   {start, top, rules, kept, state, space}
//
// `rules` is the grammar's rules in the same forms, with these changes.
// An item of an `alt` is {g, set, open}: `g` is the item; `set` is the
// class of the bytes the item can start with; `open` is true where the
// item is tried whatever the next byte is, because it can read no byte
// at all or begins with a terminal that does not say how it starts. A
// `star` and an `opt` have `set` and `open` too, for their one item. A
// `ref` has two more entries: `kept`, true where the results of its
// rule at a position are remembered, and `grows`, true where its rule
// can begin with itself, and `settles`, true where the grammar marks
// its rule settled. Every form has `acts`, true where it has a function
// for what it gives. A terminal has `words`: the words it does not
// read, as a list for each length in bytes, or [] where it reads all.
// `top` is a `ref` to the start rule. `kept` at the top is the rules
// remembered, each {name, grows}, a structure with no keys.
//
// A rule is remembered where two items of one `alt` can both begin with
// it: then the rule is read twice at one position, and so is all that
// follows from it. A rule that only one path reaches is read once, and
// remembering it would cost and save nothing. A rule that reads the
// state or changes it is not remembered: what it gives at a position
// is not the same for every state.
//
// Nothing here parses a text. Each part is worked out when it is first
// read, and once. A grammar that names a rule or a reserved set it has
// not is refused (`errors`, at the end).
import class
import grammar
import set

export prepared(g) => sound(g, errors(g))
sound(g, found) => if count(found) > 0 then refuse(found[0]) else made(g, facts(g))
made(g, x) => {start: g.start, top: ready(grammar.ref(g.start), x), rules: readied(g.rules, x, 0, []), kept: kept_names(g.rules, x, 0, []), state: g.state, space: g.space, space_part: g.space_part}

// What the analysis knows of a grammar: its rules, the number of each
// rule by name, which rules can read no byte, which read or change the
// state, which can begin with themselves, and the rules remembered.
facts(g) => known(g, numbered(g.rules, 0, []), settled(g.rules, cleared(g.rules, 0, []), 0, (r, table) => can_be_empty(r, table)))
known(g, numbers, empties) => knot(g, numbers, empties, settled(g.rules, cleared(g.rules, 0, []), 0, (r, table) => touches(r, table, g.space_reads)))
knot(g, numbers, empties, touched) =>
  x = {rules: g.rules, numbers: numbers, empties: empties, touched: touched, reserved: g.reserved, settled: g.settled, grows: growing(x, 0, []), kept: remembered(x)}
  x
numbered(rules, i, out) => if i == count(rules) then out else numbered(rules, i + 1, put(out, key(rules, i), i))

// ---- A table of true or false for each rule ----

// Begun with false for each rule and worked over until a turn changes
// nothing. `holds(rule, table)` says what is true of a rule, by the table.
cleared(rules, i, out) => if i == count(rules) then out else cleared(rules, i + 1, put(out, key(rules, i), false))
settled(rules, table, n, holds) => settled_next(rules, turn(rules, table, 0, [], holds), n, holds)
settled_next(rules, next, n, holds) => if how_many(next, 0, 0) == n then next else settled(rules, next, how_many(next, 0, 0), holds)
turn(rules, table, i, out, holds) =>
  if i == count(rules) then out
  else turn(rules, table, i + 1, put(out, key(rules, i), holds(get(rules, key(rules, i)), table)), holds)
how_many(table, i, n) => if i == count(table) then n else how_many(table, i + 1, if get(table, i) then n + 1 else n)

// ---- Which rules read the state or change it ----

touches(g, table, space_reads) =>
  if g.op == `turns then touches(grammar.spelled(g), table, space_reads)
  else if g.op == `term then g.stateful || (g.spaced && space_reads)
  else if g.op == `ref then get(table, g.name)
  else if g.op == `seq || g.op == `alt then any_touches(g.items, 0, table, space_reads)
  else touches(g.item, table, space_reads)
any_touches(items, i, table, space_reads) => i < count(items) && (touches(items[i], table, space_reads) || any_touches(items, i + 1, table, space_reads))

// ---- Which rules can begin with themselves ----

growing(x, i, out) =>
  if i == count(x.rules) then out
  else growing(x, i + 1, put(out, key(x.rules, i), set.has(begins(nothing_yet, get(x.rules, i), x).seen, i)))

// ---- Which rules can read no byte ----

// True where the form g can read no byte, by a table of the rules.
export can_be_empty(g, table) =>
  if g.op == `turns then can_be_empty(g.item, table)
  else if g.op == `term then g.empty
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
  if g.op == `turns then begins(a, grammar.spelled(g), x)
  else if g.op == `term then begins_term(a, g)
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
  if g.op == `turns then remembered_in(grammar.spelled(g), x, kept)
  else if g.op == `term || g.op == `ref then kept
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

// A rule is remembered where it is shared and does not touch the state.
is_kept(x, name) => set.has(x.kept, get(x.numbers, name)) && !get(x.touched, name)
kept_names(rules, x, i, out) =>
  if i == count(rules) then out
  else if is_kept(x, key(rules, i)) then kept_names(rules, x, i + 1, put(out, [], {name: key(rules, i), grows: get(x.grows, key(rules, i))}))
  else kept_names(rules, x, i + 1, out)

// ---- The grammar with the analysis written on it ----

readied(rules, x, i, out) =>
  if i == count(rules) then out
  else readied(rules, x, i + 1, put(out, key(rules, i), ready(get(rules, i), x)))
ready(g, x) =>
  if g.op == `term then {op: `term, acts: kind(g.gives) == `function, gives: g.gives, name: g.name, match: g.match, step: g.step, part: g.part, stateful: g.stateful, spaced: g.spaced, words: by_length(g.unless, x.reserved), known: g.known, ranges: g.ranges, empty: g.empty}
  else if g.op == `ref then {op: `ref, acts: kind(g.gives) == `function, gives: g.gives, name: g.name, kept: is_kept(x, g.name), grows: get(x.grows, g.name), settles: is_among(x.settled, g.name, 0)}
  else if g.op == `seq then {op: `seq, acts: kind(g.gives) == `function, gives: g.gives, items: ready_items(g.items, 0, x, [])}
  else if g.op == `alt then {op: `alt, acts: kind(g.gives) == `function, gives: g.gives, items: ready_choices(g.items, 0, x, [])}
  else if g.op == `guard then {op: `guard, acts: kind(g.gives) == `function, gives: g.gives, item: ready(g.item, x), holds: g.holds}
  else if g.op == `turns then in_turns(g, begins(nothing_yet, grammar.seq([g.between, g.item]), x), x)
  else gated(g, begins(nothing_yet, g.item, x), x)
gated(g, b, x) => {op: g.op, acts: kind(g.gives) == `function, gives: g.gives, item: ready(g.item, x), set: class.made(b.ranges), open: b.any || can_be_empty(g.item, x.empties)}
// Lines read in turns: `more` is a line after the first, and `set` and `open` say how one begins.
in_turns(g, b, x) => {op: `turns, acts: kind(g.gives) == `function, gives: g.gives, rule: g.rule, asks: g.asks, item: ready(g.item, x), more: ready(grammar.giving(grammar.seq([g.between, g.item]), (v, at) => v[1]), x), set: class.made(b.ranges), open: b.any || (can_be_empty(g.between, x.empties) && can_be_empty(g.item, x.empties))}
is_among(names, name, i) => i < count(names) && (names[i] == name || is_among(names, name, i + 1))
ready_items(items, i, x, out) =>
  if i == count(items) then out
  else ready_items(items, i + 1, x, put(out, [], ready(items[i], x)))
ready_choices(items, i, x, out) =>
  if i == count(items) then out
  else ready_choices(items, i + 1, x, put(out, [], choice(items[i], begins(nothing_yet, items[i], x), x)))
choice(g, b, x) => {g: ready(g, x), set: class.made(b.ranges), open: b.any || can_be_empty(g, x.empties)}

// ---- The words a terminal does not read ----

// The words of a reserved set as a list for each length in bytes: the
// words of n bytes are at place n. [] where the terminal names no set.
by_length(unless, reserved) => if kind(unless) == `symbol then sized(grammar.words_of(reserved, unless, 0), 0, longest(grammar.words_of(reserved, unless, 0), 0, 0), []) else []
longest(words, i, n) => if i == count(words) then n else longest(words, i + 1, if bits.length(words[i]) / 8 > n then bits.length(words[i]) / 8 else n)
sized(words, n, last, out) => if n > last then out else sized(words, n + 1, last, put(out, [], of_size(words, n, 0, [])))
of_size(words, n, i, out) =>
  if i == count(words) then out
  else if bits.length(words[i]) == n * 8 then of_size(words, n, i + 1, put(out, [], words[i]))
  else of_size(words, n, i + 1, out)

// ---- What is wrong with a grammar, before any text is read ----

// `errors(g)` gives what no grammar means, as texts, and none where
// nothing is: a rule named that the grammar has not, the start among
// them, and a reserved set a terminal names that the grammar has not.
// Preparing a grammar refuses the first, and so does changing one, so
// an error is found before any text is read.
//
// `faults(g)` gives those and one thing more, which may be meant: a rule
// nothing reaches from the start. A grammar may hold a rule for a
// notation to name later. Nothing refuses it; it is for a tool to show.
export errors(g) => reached(g, has_rule(g.rules, g.start, 0), unknown(g, 0, [])).faults
export faults(g) => unreached(g, 0, reached(g, has_rule(g.rules, g.start, 0), unknown(g, 0, [])))
has_rule(rules, name, i) => i < count(rules) && (key(rules, i) == name || has_rule(rules, name, i + 1))
listed(l, x, i) => i < count(l) && (l[i] == x || listed(l, x, i + 1))
// Every name a form holds that is no rule, and every set that is none.
unknown(g, i, out) => if i == count(g.rules) then out else unknown(g, i + 1, unknown_in(g, key(g.rules, i), get(g.rules, i), out))
unknown_in(g, rule, f, out) =>
  if f.op == `turns then unknown_in(g, rule, f.between, unknown_in(g, rule, f.item, out))
  else if f.op == `term then (if kind(f.unless) == `symbol && !has_rule(g.reserved, f.unless, 0) then put(out, [], "the rule " ++ spelling(rule) ++ " names the reserved set " ++ spelling(f.unless) ++ ", which the grammar has not") else out)
  else if f.op == `ref then (if has_rule(g.rules, f.name, 0) then out else put(out, [], "the rule " ++ spelling(rule) ++ " names the rule " ++ spelling(f.name) ++ ", which the grammar has not"))
  else if f.op == `seq || f.op == `alt then unknown_items(g, rule, f.items, 0, out)
  else unknown_in(g, rule, f.item, out)
unknown_items(g, rule, items, i, out) => if i == count(items) then out else unknown_items(g, rule, items, i + 1, unknown_in(g, rule, items[i], out))
reached(g, has_start, out) => if has_start then {faults: out, names: reach(g.rules, grammar.ref(g.start), [])} else {faults: put(out, [], "the grammar begins with the rule " ++ spelling(g.start) ++ ", which it has not"), names: []}
// The names of the rules a form reaches, through whatever rules.
reach(rules, f, out) =>
  if f.op == `turns then reach(rules, grammar.spelled(f), out)
  else if f.op == `term then out
  else if f.op == `ref then (if listed(out, f.name, 0) || !has_rule(rules, f.name, 0) then out else reach(rules, get(rules, f.name), put(out, [], f.name)))
  else if f.op == `seq || f.op == `alt then reach_items(rules, f.items, 0, out)
  else reach(rules, f.item, out)
reach_items(rules, items, i, out) => if i == count(items) then out else reach_items(rules, items, i + 1, reach(rules, items[i], out))
// With no start there is nothing to reach from, and no rule is called unreached.
unreached(g, i, r) =>
  if i == count(g.rules) || count(r.names) == 0 then r.faults
  else if listed(r.names, key(g.rules, i), 0) then unreached(g, i + 1, r)
  else unreached(g, i + 1, {faults: put(r.faults, [], "nothing reaches the rule " ++ spelling(key(g.rules, i))), names: r.names})
