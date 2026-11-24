// The parser engine, written in Allegretto.
//
// Whose: the kernel stream (lane R). Decisions: "Any parsing algorithm
// will do that meets five conditions", "Parsing is evaluation",
// "Scannerless parsing", "Every notation stands for an expression",
// "Ambiguity is a claim" (docs/plans/book-pass.md section 10.4).
//
// `parses(p, text)` reads a text as the start rule of a prepared grammar
// (analysis.alg) and gives every way the whole text can be read:
//
//   {readings}                     what each reading gives, [] or {h, t}
//   {failure: `no_parse, at}       where there is none: `at` is the
//                                  farthest byte position at which a
//                                  reading could not go on
//
// `parse(p, text)` gives what the one reading gives, or the same
// failure. It claims that the text reads one way: a text that reads two
// ways refutes the claim, and the fault is the grammar's. `parses_of`
// and `parse_of` take one thing more, what the text is called, for the
// places.
//
// What a form gives at a position and a state is every result it has
// there, and not the first. So every item of an `alt` is tried and every
// result kept, the order of the items has no meaning, and a text that
// can be read two ways has two readings.
//
// What a reading gives is a value, made from what each form read:
//
//   a terminal    the text it read, the space after it not counted
//   a rule        what its form gives
//   a `seq`       what each item gives, in order, as a structure with no keys
//   an `alt`      what the item read gives
//   a `star`      what the item gives each time, as a structure with no keys
//   an `opt`      [] or [what the item gives]
//   a `guard`     []
//
// A form made with grammar.giving has a function, and gives what the
// function makes of that: `gives(value, at)`, where `at` is the place
// the form read, {source, start, end}, each end {index, line, column}
// with the index in bytes from 0 and the line and column from 1. So a
// grammar's forms give descriptions, and nothing here knows what one is.
// A value is worked out when it is read, and a place when it is read.
//
// Three things keep the work small. An item of an `alt`, a `star` or an
// `opt` is tried only where the next byte is one it can begin with. A
// terminal is one function call. And the results of a rule the analysis
// marks are remembered: they are the entries of a table with a row for
// each position, each entry worked out when it is first read, and once.
//
// A rule may begin with itself. Such a rule is read in turns at a
// position: the first turn gives the rule nothing where it meets itself
// there, and each turn after gives it the results the turn before
// added, until a turn adds none. So `sum = sum "+" one | one` reads
// "1+2+3" as (1+2)+3. A rule met again at one position with another
// state is refused, and so is a rule that reads itself and no byte
// between.
//
// A state is carried beside the position (grammar.alg). A terminal made
// with `stepper` reads it and may change it; every other form hands on
// the state it was given, or the state its parts left.
//
// A rule the grammar marks settled is claimed to have one result at
// most wherever it is read: "Ambiguity is a claim" calls the mark
// `unambiguous`. A text is read one way up to the end of such a rule
// where the rules around it are read one after another.
import analysis
import class
import grammar

export prepared(g) => analysis.prepared(g)

export parses(p, text) => parses_of(p, text, "")
export parses_of(p, text, source) => read_all(context(p, text, source), p)
export parse(p, text) => parse_of(p, text, "")
export parse_of(p, text, source) => only(parses_of(p, text, source))
only(a) => if is_failure(a) then a else then(claim(count(a.readings.t) == 0), a.readings.h)

// What a reading carries: the text, what it is called and its length in
// bytes, the rules, the function for space, the state a reading begins
// with, the table of what is remembered, and what the rules being read
// in turns have so far at the position `seed_at`.
context(p, text, source) => knot(p, text, source, bits.length(text) / 8)
// The table reads the context it is part of.
knot(p, text, source, len) =>
  c = {text: text, source: source, len: len, lines: line_starts(text, len, 0, [0]), rules: p.rules, space: p.space, state: p.state, rows: rows(c, p.kept, 0, []), seed_at: -1, seeds: []}
  c

read_all(c, p) => answer(c, read(c, p.top, 0, p.state))
answer(c, r) => answered(whole(r.rs, c.len), c, r)
answered(values, c, r) =>
  if count(values) > 0 then {readings: values}
  else {failure: `no_parse, at: most(r.far, farthest_end(r.rs, -1))}
whole(rs, len) =>
  if count(rs) == 0 then []
  else if rs.h.end == len then {h: rs.h.value, t: whole(rs.t, len)}
  else whole(rs.t, len)
farthest_end(rs, far) => if count(rs) == 0 then far else farthest_end(rs.t, most(far, rs.h.end))
most(a, b) => if a > b then a else b
length(l, n) => if count(l) == 0 then n else length(l.t, n + 1)

// ---- Places ----

// The place from the byte `start` to the byte `stop` of the text.
place(c, start, stop) => {source: c.source, start: location(c, start), end: location(c, stop)}
// The line of a position is found in `lines`, the positions at which the
// lines of the text begin: the last that is not after it. The list is
// made once for a text, when a line is first asked for.
location(c, i) => located(c, i, line_at(c.lines, i, 0, count(c.lines) - 1))
located(c, i, n) => {index: i, line: n + 1, column: i - get(c.lines, n) + 1}
line_at(lines, i, low, high) => if low >= high then low else line_half(lines, i, low, high, (low + high + 1) / 2)
line_half(lines, i, low, high, mid) => if get(lines, mid) <= i then line_at(lines, i, mid, high) else line_at(lines, i, low, mid - 1)
line_starts(text, len, i, out) =>
  if i >= len then out
  else if grammar.byte(text, i) == 10 then line_starts_next(text, len, i + 1, put(out, [], i + 1))
  else line_starts(text, len, i + 1, out)
line_starts_next(text, len, i, out) => then(out, line_starts(text, len, i, out))

// ---- The table of what is remembered ----

// A row for each position from 0 to the length. A row has an entry for
// each rule remembered, keyed by its name: what the rule gives there.
// A rule remembered touches no state, so the state it is read with here
// does not matter, and whoever reads an entry puts its own state on the
// results.
rows(c, kept, at, out) =>
  if count(kept) == 0 || at > c.len then out
  else rows_next(c, kept, at, put(out, [], row(c, kept, at, 0, [])))
rows_next(c, kept, at, out) => then(out, rows(c, kept, at + 1, out))
row(c, kept, at, k, out) =>
  if k == count(kept) then out
  else row(c, kept, at, k + 1, put(out, kept[k].name, body_of(c, kept[k].name, kept[k].grows, at, c.state)))

// ---- What a form gives at a position and a state: {rs, far} ----
//
// `rs` is its results, [] or {h, t}. A result is {end, stop, state, via,
// value}: the position after what was read and the space after it; the
// position after what was read alone; the state after; a mark for rules
// read in turns; and what the form gives. `far` is the farthest position
// at which something tried here could not go on, or -1.

read(c, g, at, st) => if g.acts then acted(c, g.gives, at, plain(c, g, at, st)) else plain(c, g, at, st)
plain(c, g, at, st) =>
  if g.op == `ref then rule(c, g, at, st)
  else if g.op == `term then (if g.stateful then stepped(c, at, g.step(c.text, at, st)) else terminal(c, g, at, st, g.match(c.text, at)))
  else if g.op == `seq then in_order(c, g.items, at, st)
  else if g.op == `alt then branches(c, g.items, 0, at, st, grammar.byte(c.text, at))
  else if g.op == `star then grow(c, g, {h: {end: at, stop: at, state: st, via: false, value: []}, t: []}, [], -1)
  else if g.op == `opt then maybe(at, st, gate(c, g, at, st))
  else guarded(g.holds, at, st, read(c, g.item, at, st))

// What the function of a form makes of each result.
acted(c, gives, at, p) => {rs: acted_each(c, gives, at, p.rs), far: p.far}
acted_each(c, gives, at, rs) =>
  if count(rs) == 0 then []
  else {h: {end: rs.h.end, stop: rs.h.stop, state: rs.h.state, via: rs.h.via, value: gives(rs.h.value, place(c, at, rs.h.stop))}, t: acted_each(c, gives, at, rs.t)}

none_at(at) => {rs: [], far: at}
one_at(end, stop, st, value) => {rs: {h: {end: end, stop: stop, state: st, via: false, value: value}, t: []}, far: -1}

// A terminal: what it read is no reserved word, and where it is spaced
// the space after it is read too.
terminal(c, g, at, st, n) =>
  if n < 0 || barred(g.words, c.text, at, n) then none_at(at)
  else one_at(if g.spaced then at + n + c.space(c.text, at + n, st) else at + n, at + n, st, bits.slice(c.text, at * 8, n * 8))
barred(words, text, at, n) => count(words) > n && among(get(words, n), bits.slice(text, at * 8, n * 8), 0)
among(l, w, i) => i < count(l) && (get(l, i) == w || among(l, w, i + 1))
stepped(c, at, r) =>
  if count(r) == 0 then none_at(at)
  else one_at(at + r.read, at + r.read, r.state, bits.slice(c.text, at * 8, r.read * 8))

// A rule. Where it is being read in turns at this position, it gives
// what the turn before gave. Where it is remembered, the table has it;
// but not at a position where a rule is being read in turns, since what
// a rule gives there is not settled.
rule(c, g, at, st) => if g.settles then one_at_most(ruled(c, g, at, st)) else ruled(c, g, at, st)
one_at_most(p) => then(claim(count(p.rs) == 0 || count(p.rs.t) == 0), p)
ruled(c, g, at, st) => if g.grows then growing(c, g, at, st, seed_of(c, g.name, at)) else settled(c, g, at, st)
settled(c, g, at, st) =>
  if g.kept && at != c.seed_at then restated(st, get(get(c.rows, at), g.name))
  else body_of(c, g.name, g.grows, at, st)
growing(c, g, at, st, seed) =>
  if count(seed) == 0 then settled(c, g, at, st)
  else if seed.h.state == st then {rs: seed.h.rs, far: -1}
  else refuse("a rule is met again at one position with another state")
body_of(c, name, grows, at, st) =>
  if !grows then read(c, get(c.rules, name), at, st)
  else if c.seed_at == at then in_turns(c, name, get(c.rules, name), at, st, [], 0, 0)
  else from_new(c, name, get(c.rules, name), at, st)

// The results of the table, each with the state st and no mark.
restated(st, p) => {rs: restated_each(st, p.rs), far: p.far}
restated_each(st, rs) =>
  if count(rs) == 0 then []
  else {h: {end: rs.h.end, stop: rs.h.stop, state: st, via: false, value: rs.h.value}, t: restated_each(st, rs.t)}

// A rule that can begin with itself, read in turns. A turn reads the
// rule's body once, with the rule giving, where it meets itself at this
// position, the results of the turn before. A result carries `via`: true
// where it was read through a result marked new. So a turn is given only
// the results the turn before added, marked new, and keeps of what it
// reads only what came through them: nothing is read on from twice, and
// a row of n operands takes n turns of one operand each. The older
// results that read no byte are given at every turn too, unmarked,
// since a new result may follow one of them at this same position.
//
// `all` is every result so far, `fresh` those of the last turn, `zero`
// those of the turns before it that read no byte, `far` the farthest failure and k the turns. A
// turn that adds a result when every byte left has been a turn reads
// itself and nothing between.
from_new(c, name, body, at, st) => begun(c, name, body, at, st, read(seeded(c, name, at, st, []), body, at, st))
begun(c, name, body, at, st, p) => widen(c, name, body, at, st, unmarked(p.rs, false, []), unmarked(p.rs, false, []), [], p.far, 0)
widen(c, name, body, at, st, all, fresh, zero, far, k) =>
  if count(fresh) == 0 then {rs: all, far: far}
  else if k > c.len - at + 1 then refuse("a rule reads itself and no byte between")
  else widened(c, name, body, at, st, all, unread(fresh, at, zero), far, k, read(seeded(c, name, at, st, marked(fresh, zero)), body, at, st))
widened(c, name, body, at, st, all, zero, far, k, p) => added(c, name, body, at, st, all, zero, most(far, p.far), k, unmarked(p.rs, true, []))
added(c, name, body, at, st, all, zero, far, k, fresh) => widen(c, name, body, at, st, onto(fresh, all), fresh, zero, far, k + 1)
// The results rs, unmarked, put before `out`: all of them, or with `only_new` those marked new.
unmarked(rs, only_new, out) =>
  if count(rs) == 0 then out
  else if only_new && !rs.h.via then unmarked(rs.t, only_new, out)
  else unmarked(rs.t, only_new, {h: {end: rs.h.end, stop: rs.h.stop, state: rs.h.state, via: false, value: rs.h.value}, t: out})
// The results rs marked new, put before `out`.
marked(rs, out) => if count(rs) == 0 then out else marked(rs.t, {h: {end: rs.h.end, stop: rs.h.stop, state: rs.h.state, via: true, value: rs.h.value}, t: out})
// Those of rs that read no byte, put before `out`.
unread(rs, at, out) => if count(rs) == 0 then out else unread(rs.t, at, if rs.h.end == at then {h: rs.h, t: out} else out)
onto(rs, out) => if count(rs) == 0 then out else onto(rs.t, {h: rs.h, t: out})

// The same for a rule met while another is being read in turns at this
// position: each turn is given every result so far, and ends when one
// adds none. Marks pass through it untouched, so they stay the outer
// rule's.
in_turns(c, name, body, at, st, seed, n, k) => after_turn(c, name, body, at, st, n, k, read(seeded(c, name, at, st, seed), body, at, st))
after_turn(c, name, body, at, st, n, k, p) => next_turn(c, name, body, at, st, n, k, p, length(p.rs, 0))
next_turn(c, name, body, at, st, n, k, p, m) =>
  if m == n then p
  else if k > c.len - at + 1 then refuse("a rule reads itself and no byte between")
  else in_turns(c, name, body, at, st, p.rs, m, k + 1)
// The context with one more rule being read in turns at this position.
seeded(c, name, at, st, seed) => {text: c.text, source: c.source, len: c.len, lines: c.lines, rules: c.rules, space: c.space, state: c.state, rows: c.rows, seed_at: at, seeds: {name: name, state: st, rs: seed, t: if c.seed_at == at then c.seeds else []}}
// What a rule being read in turns at this position has so far, as {h}, or [].
seed_of(c, name, at) => if at == c.seed_at then seed_in(c.seeds, name) else []
seed_in(l, name) => if count(l) == 0 then [] else if l.name == name then {h: l} else seed_in(l.t, name)

// A sequence: for each result of an item, the items after it from where
// that result ends, with the state it left. What it gives is built last
// item first, and laid out as a structure when it is read.
in_order(c, items, at, st) => as_seq(sequence(c, items, 0, at, st))
as_seq(p) => {rs: as_seq_each(p.rs), far: p.far}
as_seq_each(rs) => if count(rs) == 0 then [] else {h: {end: rs.h.end, stop: rs.h.stop, state: rs.h.state, via: rs.h.via, value: laid(rs.h.value, [])}, t: as_seq_each(rs.t)}
laid(l, out) => if count(l) == 0 then out else laid(l.t, put(out, [], l.h))
sequence(c, items, i, at, st) =>
  if i == count(items) then one_at(at, at, st, [])
  else chain(c, items, i, read(c, items[i], at, st))
chain(c, items, i, p) => link(c, items, i, p.rs, p.far)
link(c, items, i, rs, far) =>
  if count(rs) == 0 then {rs: [], far: far}
  else joined(rs.h, sequence(c, items, i + 1, rs.h.end, rs.h.state), link(c, items, i, rs.t, far))
joined(r, rest, more) => {rs: fronted(r, rest.rs, more.rs), far: most(rest.far, more.far)}
// Where the items after read nothing, what was read ends where r ended.
fronted(r, rs, more) =>
  if count(rs) == 0 then more
  else {h: {end: rs.h.end, stop: if rs.h.end > r.end then rs.h.stop else r.stop, state: rs.h.state, via: r.via || rs.h.via, value: {h: r.value, t: rs.h.value}}, t: fronted(r, rs.t, more)}

// The item of a `star` or an `opt`, where the next byte is one it can
// begin with or it is open.
gate(c, g, at, st) => if g.open || class.has(g.set, grammar.byte(c.text, at)) then read(c, g.item, at, st) else none_at(at)

// The items of an `alt`: each that can begin with the byte b, or is open.
branches(c, items, i, at, st, b) =>
  if i == count(items) then none_at(at)
  else branch(c, items, i, at, st, b, items[i])
branch(c, items, i, at, st, b, it) =>
  if it.open || class.has(it.set, b) then either(read(c, it.g, at, st), branches(c, items, i + 1, at, st, b))
  else branches(c, items, i + 1, at, st, b)
either(p, q) => {rs: before(p.rs, q.rs), far: most(p.far, q.far)}
before(rs, more) => if count(rs) == 0 then more else if count(more) == 0 then rs else {h: rs.h, t: before(rs.t, more)}

// A repetition. `todo` is the results not yet tried further and `done`
// those that were; each holds what its items gave last first. A result
// is tried further by reading the item where it ends, and a reading that
// reads no byte is dropped, so the work ends.
grow(c, g, todo, done, far) =>
  if count(todo) == 0 then {rs: turned(done, []), far: far}
  else grown(c, g, todo.h, todo.t, done, far, gate(c, g, todo.h.end, todo.h.state))
grown(c, g, r, todo, done, far, p) => grow(c, g, longer(p.rs, r, todo), {h: r, t: done}, most(far, p.far))
longer(rs, r, todo) =>
  if count(rs) == 0 then todo
  else if rs.h.end > r.end then {h: {end: rs.h.end, stop: rs.h.stop, state: rs.h.state, via: r.via || rs.h.via, value: {h: rs.h.value, t: r.value}}, t: longer(rs.t, r, todo)}
  else longer(rs.t, r, todo)
turned(done, out) =>
  if count(done) == 0 then out
  else turned(done.t, {h: {end: done.h.end, stop: done.h.stop, state: done.h.state, via: done.h.via, value: laid(reversed(done.h.value, []), [])}, t: out})
reversed(l, out) => if count(l) == 0 then out else reversed(l.t, {h: l.h, t: out})

maybe(at, st, p) => {rs: {h: {end: at, stop: at, state: st, via: false, value: []}, t: maybe_each(p.rs)}, far: p.far}
maybe_each(rs) =>
  if count(rs) == 0 then []
  else {h: {end: rs.h.end, stop: rs.h.stop, state: rs.h.state, via: rs.h.via, value: [rs.h.value]}, t: maybe_each(rs.t)}

// A guard reads nothing and leaves the state as it was.
guarded(holds, at, st, p) => if (count(p.rs) > 0) == holds then one_at(at, at, st, []) else none_at(at)

// ---- A value as a text, for a test or a person ----
//
// Bits are shown as the text they are, a symbol by its name with a mark
// before it, and a structure as its entries between brackets, each key
// before its entry.
export shown(v) =>
  if kind(v) == `bits then v
  else if kind(v) == `symbol then "`" ++ spelling(v)
  else if kind(v) == `structure then "[" ++ shown_from(v, 0) ++ "]"
  else "?"
shown_from(v, i) =>
  if i == count(v) then ""
  else shown_entry(v, i) ++ (if i + 1 == count(v) then "" else " " ++ shown_from(v, i + 1))
shown_entry(v, i) => if kind(key(v, i)) == `symbol then spelling(key(v, i)) ++ ":" ++ shown(get(v, i)) else shown(get(v, i))
