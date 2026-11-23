// A grammar as a value, written in Allegretto.
//
// Whose: the kernel stream (lane R). Decisions: "Grammars are values",
// "Scannerless parsing", "A terminal is a function, so a grammar can
// define its own" (docs/plans/book-pass.md section 10).
//
// A grammar is {start, rules}: `rules` is a structure of rules keyed by
// the symbols of their names, and `start` is the name of the rule a text
// is read as. A rule is one of seven forms, each a structure with the
// entry `op`:
//
//   {op: `term, name, match, known, ranges, empty}   a terminal
//   {op: `ref, name}                                 the rule of that name
//   {op: `seq, items}                                each item in order
//   {op: `alt, items}                                any one of the items
//   {op: `star, item}                                the item, zero times or more
//   {op: `opt, item}                                 the item, or nothing
//   {op: `guard, item, holds}                        nothing, where the item can
//                                                    be read here (`holds` true)
//                                                    or cannot (`holds` false)
//
// The order of the items of an `alt` has no meaning. `items` is a
// structure with no keys.
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
// This module makes the forms, and the terminals most grammars need.
// The terminals read a text with the kernel's primitives on bits. The
// shipped primitives text.span, text.starts and text.until do the same
// in one step each, and take their place when a text can name them.
import class

export grammar(start, rules) => {start: start, rules: rules}

export term(name, match, known, ranges, empty) => {op: `term, name: name, match: match, known: known, ranges: ranges, empty: empty}
export ref(name) => {op: `ref, name: name}
export seq(items) => {op: `seq, items: items}
export alt(items) => {op: `alt, items: items}
export star(item) => {op: `star, item: item}
export opt(item) => {op: `opt, item: item}
export guard(item, holds) => {op: `guard, item: item, holds: holds}

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
