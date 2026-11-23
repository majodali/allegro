// The parser engine, written in Allegretto.
//
// Whose: the kernel stream (lane R). Decisions: "Any parsing algorithm
// will do that meets five conditions", "Parsing is evaluation",
// "Scannerless parsing" (docs/plans/book-pass.md section 10.4).
//
// `parses(p, text)` reads a text as the start rule of a prepared grammar
// (analysis.alg) and gives every way the whole text can be read:
//
//   {trees}                        one tree for each reading, [] or {h, t}
//   {failure: `no_parse, at}       where there is none: `at` is the
//                                  farthest byte position at which a
//                                  reading could not go on
//
// What a form gives at a position and a state is every result it has
// there, and not the first: a result is {end, state, tree}, the position
// after what was read, the state after it, and what was read. So every item of an `alt` is tried and every result
// kept, the order of the items has no meaning, and a text that can be
// read two ways has two trees.
//
// A tree is a structure with the entry `kind`:
//
//   {kind: `term, name, start, end}        a terminal read the bytes from start to end,
//                                          the space after them not counted
//   {kind: `rule, name, start, end, tree}  the rule of that name read them, as `tree`
//   {kind: `seq, items}                    a tree for each item, in order
//   {kind: `alt, index, tree}              the item at place `index` was read, as `tree`
//   {kind: `star, items}                   a tree for each time the item was read
//   {kind: `opt, items}                    one tree, or none
//   {kind: `guard}                         a guard held
//
// `items` is a list, [] or {h, t}.
//
// Three things keep the work small. An item of an `alt`, a `star` or an
// `opt` is tried only where the next byte is one it can begin with. A terminal is one
// function call. And the results of a rule the analysis marks are
// remembered: they are the entries of a table with a row for each
// position, each entry worked out when it is first read, and once.
//
// A rule may begin with itself. Such a rule is read in turns at a
// position: the first turn gives the rule nothing where it meets itself
// there, and each turn after gives it the results of the turn before,
// until a turn adds none. So `sum = sum "+" one | one` reads "1+2+3" as
// (1+2)+3. A rule met again at one position with another state is
// refused, and so is a rule that reads itself and no byte between.
//
// A state is carried beside the position (grammar.alg). A terminal made
// with `stepper` reads it and may change it; every other form hands on
// the state it was given, or the state its parts left.
import analysis
import class
import grammar

export prepared(g) => analysis.prepared(g)

export parses(p, text) => read_all(context(p, text), p)

// What a reading carries: the text and its length in bytes, the rules,
// the function for space, the state a reading begins with, the table of
// what is remembered, and what the rules being read in turns have so far
// at the position `seed_at`.
context(p, text) => knot(p, text, bits.length(text) / 8)
// The table reads the context it is part of.
knot(p, text, len) =>
  c = {text: text, len: len, rules: p.rules, space: p.space, state: p.state, rows: rows(c, p.kept, 0, []), seed_at: -1, seeds: []}
  c

read_all(c, p) => answer(c, parse(c, p.top, 0, p.state))
answer(c, r) => answered(whole(r.rs, c.len), c, r)
answered(trees, c, r) =>
  if count(trees) > 0 then {trees: trees}
  else {failure: `no_parse, at: most(r.far, farthest_end(r.rs, -1))}
whole(rs, len) =>
  if count(rs) == 0 then []
  else if rs.h.end == len then {h: rs.h.tree, t: whole(rs.t, len)}
  else whole(rs.t, len)
farthest_end(rs, far) => if count(rs) == 0 then far else farthest_end(rs.t, most(far, rs.h.end))
most(a, b) => if a > b then a else b
length(l, n) => if count(l) == 0 then n else length(l.t, n + 1)

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
// `rs` is its results, [] or {h, t}. `far` is the farthest position at
// which something tried here could not go on, or -1.

parse(c, g, at, st) =>
  if g.op == `ref then rule(c, g, at, st)
  else if g.op == `term then (if g.stateful then stepped(g, at, g.step(c.text, at, st)) else terminal(c, g, at, st, g.match(c.text, at)))
  else if g.op == `seq then in_order(c, g.items, at, st)
  else if g.op == `alt then branches(c, g.items, 0, at, st, grammar.byte(c.text, at))
  else if g.op == `star then grow(c, g, {h: {end: at, state: st, tree: []}, t: []}, [], -1)
  else if g.op == `opt then maybe(at, st, gate(c, g, at, st))
  else guarded(g.holds, at, st, parse(c, g.item, at, st))

none_at(at) => {rs: [], far: at}
one_at(end, st, tree) => {rs: {h: {end: end, state: st, tree: tree}, t: []}, far: -1}

// A terminal: what it read is no reserved word, and where it is spaced
// the space after it is read too.
terminal(c, g, at, st, n) =>
  if n < 0 || barred(g.words, c.text, at, n) then none_at(at)
  else one_at(if g.spaced then at + n + c.space(c.text, at + n, st) else at + n, st, {kind: `term, name: g.name, start: at, end: at + n})
barred(words, text, at, n) => count(words) > n && among(get(words, n), bits.slice(text, at * 8, n * 8), 0)
among(l, w, i) => i < count(l) && (get(l, i) == w || among(l, w, i + 1))
stepped(g, at, r) =>
  if count(r) == 0 then none_at(at)
  else one_at(at + r.read, r.state, {kind: `term, name: g.name, start: at, end: at + r.read})

// A rule. Where it is being read in turns at this position, it gives
// what the turn before gave. Where it is remembered, the table has it;
// but not at a position where a rule is being read in turns, since what
// a rule gives there is not settled.
rule(c, g, at, st) => if g.grows then growing(c, g, at, st, seed_of(c, g.name, at)) else settled(c, g, at, st)
settled(c, g, at, st) =>
  if g.kept && at != c.seed_at then named(g.name, at, true, st, get(get(c.rows, at), g.name))
  else named(g.name, at, false, st, body_of(c, g.name, g.grows, at, st))
growing(c, g, at, st, seed) =>
  if count(seed) == 0 then settled(c, g, at, st)
  else if seed.h.state == st then named(g.name, at, false, st, {rs: seed.h.rs, far: -1})
  else refuse("a rule is met again at one position with another state")
body_of(c, name, grows, at, st) => if grows then in_turns(c, name, get(c.rules, name), at, st, [], 0, 0) else parse(c, get(c.rules, name), at, st)

// `restate` is true where the results are from the table: each takes the state st.
named(name, at, restate, st, p) => {rs: named_each(name, at, restate, st, p.rs), far: p.far}
named_each(name, at, restate, st, rs) =>
  if count(rs) == 0 then []
  else {h: {end: rs.h.end, state: if restate then st else rs.h.state, tree: {kind: `rule, name: name, start: at, end: rs.h.end, tree: rs.h.tree}}, t: named_each(name, at, restate, st, rs.t)}

// A rule that can begin with itself, read in turns. `seed` is what the
// turn before gave, n how many results that is, and k the turns so far.
// A turn that adds a result when every byte left has been a turn reads
// itself and nothing between.
in_turns(c, name, body, at, st, seed, n, k) => after_turn(c, name, body, at, st, n, k, parse(seeded(c, name, at, st, seed), body, at, st))
after_turn(c, name, body, at, st, n, k, p) => next_turn(c, name, body, at, st, n, k, p, length(p.rs, 0))
next_turn(c, name, body, at, st, n, k, p, m) =>
  if m == n then p
  else if k > c.len - at + 1 then refuse("a rule reads itself and no byte between")
  else in_turns(c, name, body, at, st, p.rs, m, k + 1)
// The context with one more rule being read in turns at this position.
seeded(c, name, at, st, seed) => {text: c.text, len: c.len, rules: c.rules, space: c.space, state: c.state, rows: c.rows, seed_at: at, seeds: {name: name, state: st, rs: seed, t: if c.seed_at == at then c.seeds else []}}
// What a rule being read in turns at this position has so far, as {h}, or [].
seed_of(c, name, at) => if at == c.seed_at then seed_in(c.seeds, name) else []
seed_in(l, name) => if count(l) == 0 then [] else if l.name == name then {h: l} else seed_in(l.t, name)

// A sequence: for each result of an item, the items after it from where
// that result ends, with the state it left.
in_order(c, items, at, st) => as_seq(sequence(c, items, 0, at, st))
as_seq(p) => {rs: as_seq_each(p.rs), far: p.far}
as_seq_each(rs) => if count(rs) == 0 then [] else {h: {end: rs.h.end, state: rs.h.state, tree: {kind: `seq, items: rs.h.tree}}, t: as_seq_each(rs.t)}
sequence(c, items, i, at, st) =>
  if i == count(items) then one_at(at, st, [])
  else chain(c, items, i, parse(c, items[i], at, st))
chain(c, items, i, p) => link(c, items, i, p.rs, p.far)
link(c, items, i, rs, far) =>
  if count(rs) == 0 then {rs: [], far: far}
  else joined(rs.h.tree, sequence(c, items, i + 1, rs.h.end, rs.h.state), link(c, items, i, rs.t, far))
joined(tree, rest, more) => {rs: fronted(tree, rest.rs, more.rs), far: most(rest.far, more.far)}
fronted(tree, rs, more) =>
  if count(rs) == 0 then more
  else {h: {end: rs.h.end, state: rs.h.state, tree: {h: tree, t: rs.h.tree}}, t: fronted(tree, rs.t, more)}

// The item of a `star` or an `opt`, where the next byte is one it can
// begin with or it is open.
gate(c, g, at, st) => if g.open || class.has(g.set, grammar.byte(c.text, at)) then parse(c, g.item, at, st) else none_at(at)

// The items of an `alt`: each that can begin with the byte b, or is open.
branches(c, items, i, at, st, b) =>
  if i == count(items) then none_at(at)
  else branch(c, items, i, at, st, b, items[i])
branch(c, items, i, at, st, b, it) =>
  if it.open || class.has(it.set, b) then either(i, parse(c, it.g, at, st), branches(c, items, i + 1, at, st, b))
  else branches(c, items, i + 1, at, st, b)
either(i, p, q) => {rs: chosen(i, p.rs, q.rs), far: most(p.far, q.far)}
chosen(i, rs, more) =>
  if count(rs) == 0 then more
  else {h: {end: rs.h.end, state: rs.h.state, tree: {kind: `alt, index: i, tree: rs.h.tree}}, t: chosen(i, rs.t, more)}

// A repetition. `todo` is the results not yet tried further and `done`
// those that were; each holds its trees last first. A result is tried
// further by reading the item where it ends, and a reading that reads no
// byte is dropped, so the work ends.
grow(c, g, todo, done, far) =>
  if count(todo) == 0 then {rs: turned(done, []), far: far}
  else grown(c, g, todo.h, todo.t, done, far, gate(c, g, todo.h.end, todo.h.state))
grown(c, g, r, todo, done, far, p) => grow(c, g, longer(p.rs, r, todo), {h: r, t: done}, most(far, p.far))
longer(rs, r, todo) =>
  if count(rs) == 0 then todo
  else if rs.h.end > r.end then {h: {end: rs.h.end, state: rs.h.state, tree: {h: rs.h.tree, t: r.tree}}, t: longer(rs.t, r, todo)}
  else longer(rs.t, r, todo)
turned(done, out) =>
  if count(done) == 0 then out
  else turned(done.t, {h: {end: done.h.end, state: done.h.state, tree: {kind: `star, items: reversed(done.h.tree, [])}}, t: out})
reversed(l, out) => if count(l) == 0 then out else reversed(l.t, {h: l.h, t: out})

maybe(at, st, p) => {rs: {h: {end: at, state: st, tree: {kind: `opt, items: []}}, t: maybe_each(p.rs)}, far: p.far}
maybe_each(rs) =>
  if count(rs) == 0 then []
  else {h: {end: rs.h.end, state: rs.h.state, tree: {kind: `opt, items: {h: rs.h.tree, t: []}}}, t: maybe_each(rs.t)}

// A guard reads nothing and leaves the state as it was.
guarded(holds, at, st, p) => if (count(p.rs) > 0) == holds then one_at(at, st, {kind: `guard}) else none_at(at)

// ---- A tree as a text, for a test or a person ----
//
//   a terminal    its name and what it read: a number "12"
//   a rule        name(tree)
//   a sequence    [tree tree]
//   an alt        #index tree
//   a repetition  <tree tree>
//   an option     ?tree, or ? where there is none
//   a guard       !
export shown(tree, text) =>
  if tree.kind == `term then tree.name ++ " \"" ++ bits.slice(text, tree.start * 8, (tree.end - tree.start) * 8) ++ "\""
  else if tree.kind == `rule then spelling(tree.name) ++ "(" ++ shown(tree.tree, text) ++ ")"
  else if tree.kind == `seq then "[" ++ shown_each(tree.items, text) ++ "]"
  else if tree.kind == `alt then "#" ++ int.text(tree.index) ++ " " ++ shown(tree.tree, text)
  else if tree.kind == `star then "<" ++ shown_each(tree.items, text) ++ ">"
  else if tree.kind == `opt then "?" ++ shown_each(tree.items, text)
  else "!"
shown_each(l, text) =>
  if count(l) == 0 then ""
  else if count(l.t) == 0 then shown(l.h, text)
  else shown(l.h, text) ++ " " ++ shown_each(l.t, text)
