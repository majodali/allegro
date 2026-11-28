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
// A state is carried beside the position (grammar.alg): parts by name,
// each a bits value. A terminal made with `stepper` reads the part it
// names and may change it; every other form hands on the state it was
// given, or the state its parts left.
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
export parses_of(p, text, source) => parses_with(p, text, source, [], no_change)
// The same, for a grammar with lines that may ask for a change
// (grammar.turns). `change(held, asked)` is handed what a line asks and
// gives {held, prepared}: the prepared grammar the lines after it are
// read in, and what it is handed the next time; or a failure with a
// `reason`, which refuses the reading. `held` is what it is handed the
// first time. Where it gives `beside: true` as well, each line after the
// change is also read in the grammar before it, and must mean the same
// where both read it. The engine changes the grammar nowhere else.
export parses_with(p, text, source, held, change) => read_all(context(p, text, source, held, change), p)
no_change = (held, asked) => {failure: `no_change, reason: "a line asks for a change of the grammar, and whoever began the reading takes none"}
export parse(p, text) => parse_of(p, text, "")
export parse_of(p, text, source) => only(parses_of(p, text, source))
only(a) => if is_failure(a) then a else then(claim(count(a.readings.t) == 0), a.readings.h)

// What a reading carries: the text, what it is called and its length in
// bytes, the rules, the function for space, the state a reading begins
// with, the table of what is remembered, and what the rules being read
// in turns have so far at the position `seed_at`.
context(p, text, source, held, change) => knot(p, text, source, bits.length(text) / 8, held, change)
// The table reads the context it is part of.
knot(p, text, source, len, held, change) =>
  c = {text: text, source: source, len: len, lines: line_starts(text, len, 0, [0]), rules: p.rules, space: p.space, space_part: p.space_part, state: p.state, rows: rows(c, p.kept, 0, []), seed_at: -1, seeds: [], held: held, change: change}
  c
// The context of the same text with another grammar: its own table, and no rule being read in turns.
regrammared(old, p, held) =>
  c = {text: old.text, source: old.source, len: old.len, lines: old.lines, rules: p.rules, space: p.space, space_part: p.space_part, state: p.state, rows: rows(c, p.kept, 0, []), seed_at: -1, seeds: [], held: held, change: old.change}
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
  else if g.op == `term then (if g.stateful then stepped(c, g, at, st, g.step(c.text, at, get(st, g.part))) else terminal(c, g, at, st, g.match(c.text, at)))
  else if g.op == `seq then in_order(c, g.items, at, st)
  else if g.op == `alt then branches(c, g.items, 0, at, st, grammar.byte(c.text, at))
  else if g.op == `turns then lines_begun(c, g, st, read(c, g.item, at, st))
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
  else one_at(if g.spaced then at + n + c.space(c.text, at + n, if kind(c.space_part) == `symbol then get(st, c.space_part) else []) else at + n, at + n, st, bits.slice(c.text, at * 8, n * 8))
barred(words, text, at, n) => count(words) > n && among(get(words, n), bits.slice(text, at * 8, n * 8), 0)
among(l, w, i) => i < count(l) && (get(l, i) == w || among(l, w, i + 1))
// A terminal that steps is handed the one part of the state it names, and what it gives for the part is put back.
stepped(c, g, at, st, r) =>
  if count(r) == 0 then none_at(at)
  else one_at(at + r.read, at + r.read, put(st, g.part, r.state), bits.slice(c.text, at * 8, r.read * 8))
// Two states are the same where each part of one is the same bits in the other.
same_parts(a, b, i) => i == count(a) || (get(a, i) == get(b, key(a, i)) && same_parts(a, b, i + 1))

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
  else if same_parts(seed.h.state, st, 0) then {rs: seed.h.rs, far: -1}
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
seeded(c, name, at, st, seed) => {text: c.text, source: c.source, len: c.len, lines: c.lines, rules: c.rules, space: c.space, space_part: c.space_part, state: c.state, rows: c.rows, seed_at: at, seeds: {name: name, state: st, rs: seed, t: if c.seed_at == at then c.seeds else []}, held: c.held, change: c.change}
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

// ---- Lines read in turns with the grammar ----
//
// As a repetition, with one thing more: each result not yet tried
// further carries the context its next line is read in, `w`, which is
// {c, g}: the context and this form as that context's grammar has it.
// A line that asks for a change is claimed to be the only reading of
// the text so far: no other reading of the line ends where it ends. A
// reading that ends elsewhere has read another text, and goes on in the
// grammar as it was. The change is made when the result is tried
// further, which every result is: so also for the last of its lines,
// and a change that is refused refuses the reading wherever it is asked.
lines_begun(c, g, st, p) => parts_ended(st, lines_grow(first_lines(c, g, p.rs, p.rs), [], p.far))
// A part of the state that a change among these lines brought ends with them, as the change does: what is
// read after the lines has the parts it had before them. Parts are only ever added, so a state with as many
// parts as before has the same ones.
parts_ended(st, p) => {rs: ended_each(st, p.rs), far: p.far}
ended_each(st, rs) =>
  if count(rs) == 0 then []
  else if count(rs.h.state) == count(st) then {h: rs.h, t: ended_each(st, rs.t)}
  else {h: {end: rs.h.end, stop: rs.h.stop, state: parts_of(st, rs.h.state, 0, []), via: rs.h.via, value: rs.h.value}, t: ended_each(st, rs.t)}
parts_of(st, state, i, out) => if i == count(st) then out else parts_of(st, state, i + 1, put(out, key(st, i), get(state, key(st, i))))
// True where one result of rs, and no more, ends at `end`.
alone(rs, end) => ending_at(rs, end, 0) == 1
ending_at(rs, end, n) => if count(rs) == 0 then n else ending_at(rs.t, end, if rs.h.end == end then n + 1 else n)
first_lines(c, g, rs, every) =>
  if count(rs) == 0 then []
  else {h: line_in(world({c: c, g: g, before: []}, g.asks(rs.h.value), every, rs.h.end), {end: rs.h.end, stop: rs.h.stop, state: rs.h.state, via: rs.h.via, value: {h: rs.h.value, t: []}}, g.asks(rs.h.value)), t: first_lines(c, g, rs.t, every)}
// A change may bring parts of the state the grammar before had not: each begins where the change is made.
line_in(w, r, asked) => if count(asked) == 0 then {r: r, w: w} else {r: {end: r.end, stop: r.stop, state: begun_parts(r.state, w.c.state, 0), via: r.via, value: r.value}, w: w}
begun_parts(st, parts, i) => if i == count(parts) then st else begun_parts(if has_part(st, key(parts, i), 0) then st else put(st, key(parts, i), get(parts, i)), parts, i + 1)
has_part(st, name, i) => i < count(st) && (key(st, i) == name || has_part(st, name, i + 1))
world(w, asked, every, end) => if count(asked) == 0 then w else then(claim(alone(every, end)), moved(w, w.c.change(w.c.held, asked[0])))
moved(w, to) => if is_failure(to) then refuse(to.reason) else same_lines(regrammared(w.c, to.prepared, to.held), w.g.rule, if count(to) > 2 && to.beside then [w] else [])
same_lines(c, rule, before) => as_lines(c, get(c.rules, rule), before)
as_lines(c, g, before) => if g.op == `turns then {c: c, g: g, before: before} else refuse("a change of the grammar left the rule of the lines being read no lines")
lines_grow(todo, done, far) =>
  if count(todo) == 0 then {rs: turned(done, []), far: far}
  else lines_grown(todo.h, todo.t, done, far, next_line(todo.h.w.c, todo.h.w.g, todo.h.r))
next_line(c, g, r) => if g.open || class.has(g.set, grammar.byte(c.text, r.end)) then read(c, g.more, r.end, r.state) else none_at(r.end)
lines_grown(e, todo, done, far, p) => lines_grow(more_lines(e, compared(e, p.rs), todo, p.rs), {h: e.r, t: done}, most(far, p.far))
// Where the change that made this context asked for it (`beside`), the line is read in the context before
// the change as well. Each reading the line had there must still be among its readings to the same end:
// where the line is read to that end and none of the readings is alike, what the text meant has changed, and
// that is refused. A reading the change adds beside one that stays is no harm here: if both live to the end,
// the text reads two ways, and that is refused there. A reading of a part of a line counts as one.
compared(e, rs) => if count(e.w.before) == 0 then rs else then(kept_all(e.w.c, next_line(e.w.before[0].c, e.w.before[0].g, e.r).rs, rs), rs)
kept_all(c, old, rs) => if count(old) == 0 then true else then(kept_one(c, old.h, rs, rs, []), kept_all(c, old.t, rs))
// `other` is a reading to the same end that is not alike, where one was met.
kept_one(c, o, rs, every, other) =>
  if count(rs) == 0 then (if count(other) == 0 then true else refuse("the line that ends at " ++ int.text(location(c, o.stop).line) ++ ":" ++ int.text(location(c, o.stop).column) ++ " reads one way before the change of the grammar and another after it. Before: " ++ outline(o.value, 6) ++ " After: " ++ outline(other[0].value, 6)))
  else if rs.h.end != o.end then kept_one(c, o, rs.t, every, other)
  else if alike(o.value, rs.h.value) then true
  else kept_one(c, o, rs.t, every, [rs.h])
// A value in outline, for a refusal: a structure as its entries between brackets, to a depth, each key before
// its entry and an entry keyed `at` left out; a symbol by its name; bits as the text they are where every byte
// is a letter, a digit or a sign, and as a dot otherwise.
outline(v, depth) =>
  if kind(v) == `structure then (if depth == 0 then "…" else "(" ++ outline_from(v, 0, depth) ++ ")")
  else if kind(v) == `symbol then spelling(v)
  else if kind(v) == `bits && bits.length(v) > 0 && bits.length(v) / 8 * 8 == bits.length(v) && written(v, 0) then v
  else "."
outline_from(v, i, depth) =>
  if i == count(v) then ""
  else if kind(key(v, i)) == `symbol && key(v, i) == `at then outline_from(v, i + 1, depth)
  else (if kind(key(v, i)) == `symbol then spelling(key(v, i)) ++ ":" else "") ++ outline(get(v, i), depth - 1) ++ (if i + 1 == count(v) then "" else " ") ++ outline_from(v, i + 1, depth)
written(t, i) => i * 8 >= bits.length(t) || (grammar.byte(t, i) > 32 && grammar.byte(t, i) < 127 && written(t, i + 1))
// Two values are alike where they are the same bits or the same symbol, or structures with the same keys
// in the same order and entries that are alike. A function is alike to nothing: a form's value is data.
alike(a, b) =>
  if kind(a) != kind(b) then false
  else if kind(a) == `structure then count(a) == count(b) && alike_from(a, b, 0)
  else if kind(a) == `bits || kind(a) == `symbol then a == b
  else false
// An entry keyed `at` is a place, by the forms' own convention (grammar.giving): two values that are alike in
// all else were read from the same bytes, and working out the places of both would be most of the cost.
alike_from(a, b, i) => i == count(a) || (alike_keys(key(a, i), key(b, i)) && (is_place(key(a, i)) || alike(get(a, i), get(b, i))) && alike_from(a, b, i + 1))
is_place(k) => kind(k) == `symbol && k == `at
alike_keys(j, k) => kind(j) == kind(k) && (kind(j) != `symbol || j == k)
more_lines(e, rs, todo, every) =>
  if count(rs) == 0 then todo
  else if rs.h.end > e.r.end then {h: line_in(world(e.w, e.w.g.asks(rs.h.value), every, rs.h.end), {end: rs.h.end, stop: rs.h.stop, state: rs.h.state, via: e.r.via || rs.h.via, value: {h: rs.h.value, t: e.r.value}}, e.w.g.asks(rs.h.value)), t: more_lines(e, rs.t, todo, every)}
  else more_lines(e, rs.t, todo, every)

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
