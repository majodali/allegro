// A grammar as a value, written in Allegretto.
//
// Whose: the kernel stream (lane R). Decisions: "Grammars are values",
// "Scannerless parsing", "A terminal is a function, so a grammar can
// define its own" (docs/plans/book-pass.md section 10).
//
// A grammar is {start, rules, state, reserved, space, space_reads,
// settled}.
// `rules` is a structure of rules keyed by the symbols of their names,
// and `start` is the name of the rule a text is read as. The other four
// are below. A rule is one of seven forms, each a structure with the
// entry `op`:
//
//   {op: `term, gives, name, ...}   a terminal
//   {op: `ref, gives, name}         the rule of that name
//   {op: `seq, gives, items}        each item in order
//   {op: `alt, gives, items}        any one of the items
//   {op: `star, gives, item}        the item, zero times or more
//   {op: `opt, gives, item}         the item, or nothing
//   {op: `guard, gives, item, holds} nothing, where the item can be read
//                                   here (`holds` true) or cannot (false)
//
// The order of the items of an `alt` has no meaning. `items` is a
// structure with no keys. A rule may begin with itself.
//
// A terminal is a function. `match(text, at)` gives how many bytes of
// the text the terminal reads from the byte position `at`, or -1 where
// it reads nothing there; 0 is a terminal that matches and reads no
// byte. The rest of a terminal's entries say what the function is, for
// an analysis that cannot look inside one: `name` is what a failure
// calls it; `empty` is true where it can match and read no byte; and
// where `known` is true, `ranges` are the bytes it can start with
// (class.alg), so where the next byte is none of them it is not tried.
// A terminal with `known` false is always tried.
//
// A state is carried through a reading beside the position: `state` is
// the state a reading begins with. A state is a bits value, so that two
// can be compared. A terminal made with `stepper` reads the state and
// may change it: `step(text, at, state)` gives {read, state}, the bytes
// read and the state after, or [] where it reads nothing there.
//
// `space(text, at, state)` gives how many bytes of space there are at a
// position. A terminal made `spaced` reads the space after what it
// reads; a tree keeps where the terminal itself ended. `space_reads` is
// true where the space depends on the state.
//
// `reserved` holds sets of words by name. A terminal made with `unless`
// and the name of a set reads no word of that set. `with_reserved` adds
// words to a set, so a grammar that adds a word of its own keeps it out
// of every name.
//
// What a reading gives is made by the forms (engine.alg). A form made
// with `giving` has a function that makes something of what the form
// gives without one: so a form gives the description of an expression,
// and the names the function uses mean what they meant where it was
// written.
//
// `settled` is the names of the rules marked settled: a rule that is
// claimed to have one result at most wherever it is read.
//
// This module makes the forms, and the terminals most grammars need.
// The terminals read a text with the kernel's primitives on bits. The
// shipped primitives text.span, text.starts and text.until do the same
// in one step each, and take their place when a text can name them.
import class

export grammar(start, rules) => {start: start, rules: rules, state: "", reserved: [], space: no_space, space_reads: false, settled: []}
no_space = (text, at, state) => 0
export with_state(g, state) => {start: g.start, rules: g.rules, state: state, reserved: g.reserved, space: g.space, space_reads: g.space_reads, settled: g.settled}
export with_space(g, space, reads) => {start: g.start, rules: g.rules, state: g.state, reserved: g.reserved, space: space, space_reads: reads, settled: g.settled}
export with_reserved(g, name, words) => {start: g.start, rules: g.rules, state: g.state, reserved: put(g.reserved, name, added(words, 0, words_of(g.reserved, name, 0))), space: g.space, space_reads: g.space_reads, settled: g.settled}
// The grammar with the rules of these names marked settled, beside those marked already.
export with_settled(g, names) => {start: g.start, rules: g.rules, state: g.state, reserved: g.reserved, space: g.space, space_reads: g.space_reads, settled: added(names, 0, g.settled)}
// The words of the set of that name, or none where there is no such set.
export words_of(reserved, name, i) =>
  if i == count(reserved) then []
  else if key(reserved, i) == name then get(reserved, i)
  else words_of(reserved, name, i + 1)
added(words, i, out) => if i == count(words) then out else added(words, i + 1, put(out, [], words[i]))

export term(name, match, known, ranges, empty) => {op: `term, gives: [], name: name, match: match, step: [], stateful: false, spaced: false, unless: [], known: known, ranges: ranges, empty: empty}
// A terminal that reads the state, and may change it.
export stepper(name, step, known, ranges, empty) => {op: `term, gives: [], name: name, match: [], step: step, stateful: true, spaced: false, unless: [], known: known, ranges: ranges, empty: empty}
// The terminal t, reading the space after what it reads.
export spaced(t) => {op: `term, gives: t.gives, name: t.name, match: t.match, step: t.step, stateful: t.stateful, spaced: true, unless: t.unless, known: t.known, ranges: t.ranges, empty: t.empty}
// The terminal t, reading no word of the reserved set of that name.
export unless(t, set) => {op: `term, gives: t.gives, name: t.name, match: t.match, step: t.step, stateful: t.stateful, spaced: t.spaced, unless: set, known: t.known, ranges: t.ranges, empty: t.empty}
export ref(name) => {op: `ref, gives: [], name: name}
export seq(items) => {op: `seq, gives: [], items: items}
export alt(items) => {op: `alt, gives: [], items: items}
export star(item) => {op: `star, gives: [], item: item}
export opt(item) => {op: `opt, gives: [], item: item}
export guard(item, holds) => {op: `guard, gives: [], item: item, holds: holds}

// The form g, giving what the function f makes of what it gave before:
// f(value, at), with `at` the place the form read. A form given a
// function twice gives what the second makes of what the first made.
export giving(g, f) => given(g, if kind(g.gives) == `function then after(g.gives, f) else f)
after(first, second) => (value, at) => second(first(value, at), at)
given(g, f) =>
  if g.op == `term then {op: `term, gives: f, name: g.name, match: g.match, step: g.step, stateful: g.stateful, spaced: g.spaced, unless: g.unless, known: g.known, ranges: g.ranges, empty: g.empty}
  else if g.op == `ref then {op: `ref, gives: f, name: g.name}
  else if g.op == `seq || g.op == `alt then {op: g.op, gives: f, items: g.items}
  else if g.op == `guard then {op: `guard, gives: f, item: g.item, holds: g.holds}
  else {op: g.op, gives: f, item: g.item}

// The byte of a text at a byte position, or -1 at its end.
export byte(text, at) => if at * 8 >= bits.length(text) then -1 else bits.int(bits.slice(text, at * 8, 8))

// ---- Terminals ----

// The text t, written out. Its name is the text.
export lit(t) => term(t, literal(t, bits.length(t)), true, class.with_range(class.no_ranges, first_byte(t), first_byte(t)), bits.length(t) == 0)
first_byte(t) => if bits.length(t) == 0 then 0 else bits.int(bits.slice(t, 0, 8))
literal(t, n) => (text, at) => if starts(text, at * 8, t, n) then n / 8 else -1
starts(text, i, t, n) => i + n <= bits.length(text) && bits.slice(text, i, n) == t

// One byte or more of a class, as many as there are. `pairs` is the
// class as a text of pairs of bytes (class.alg).
export run(name, pairs) => term(name, counted(class.made(class.pairs(pairs)), 1), true, class.pairs(pairs), false)
// The same, and no byte at all is a match too.
export many(name, pairs) => term(name, counted(class.made(class.pairs(pairs)), 0), false, class.no_ranges, true)
// Exactly one byte of a class.
export one(name, pairs) => term(name, single(class.made(class.pairs(pairs))), true, class.pairs(pairs), false)
counted(c, least) => (text, at) => at_least(span(text, c, at, 0), least)
at_least(n, least) => if n >= least then n else -1
span(text, c, at, n) => if class.has(c, byte(text, at + n)) then span(text, c, at, n + 1) else n
single(c) => (text, at) => if class.has(c, byte(text, at)) then 1 else -1

// The bytes before the next place the text `stop` begins, or to the end
// of the text where it begins nowhere. It reads no byte where `stop`
// begins at once.
export until(name, stop) => term(name, before(stop, bits.length(stop)), false, class.no_ranges, true)
before(stop, n) => (text, at) => gap(text, stop, n, at, 0)
gap(text, stop, n, at, k) =>
  if (at + k) * 8 >= bits.length(text) || starts(text, (at + k) * 8, stop, n) then k
  else gap(text, stop, n, at, k + 1)

// The end of the text: it matches there, and reads nothing.
export end = term("the end of the text", (text, at) => if at * 8 == bits.length(text) then 0 else -1, false, class.no_ranges, true)
