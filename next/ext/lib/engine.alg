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
// What a form gives at a position is every result it has there, and not
// the first: a result is {end, tree}, the position after what was read
// and what was read. So every item of an `alt` is tried and every result
// kept, the order of the items has no meaning, and a text that can be
// read two ways has two trees.
//
// A tree is a structure with the entry `kind`:
//
//   {kind: `term, name, start, end}        a terminal read the bytes from start to end
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
// Not yet here: a rule that begins with itself, and a state carried
// beside the position.
import analysis
import class
import grammar

export prepared(g) => analysis.prepared(g)

export parses(p, text) => read_all(context(p, text), p.start)

// What a reading carries: the text and its length in bytes, the rules,
// and the table of what is remembered.
context(p, text) => tabled(p, text, bits.length(text) / 8)
tabled(p, text, len) => with_table(p, text, len, c => rows(c, p.kept, 0, []))
// The table reads the context it is part of: `c` below is the context
// with its own table in it.
with_table(p, text, len, table) => knot(p, text, len, table)
knot(p, text, len, table) =>
  c = {text: text, len: len, rules: p.rules, rows: table(c)}
  c

read_all(c, start) => answer(c, rule(c, start, false, 0))
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

// ---- The table of what is remembered ----

// A row for each position from 0 to the length. A row has an entry for
// each rule remembered, keyed by its name: what the rule gives there.
rows(c, kept, at, out) =>
  if count(kept) == 0 || at > c.len then out
  else rows_next(c, kept, at, put(out, [], row(c, kept, at, 0, [])))
rows_next(c, kept, at, out) => then(out, rows(c, kept, at + 1, out))
row(c, kept, at, k, out) =>
  if k == count(kept) then out
  else row(c, kept, at, k + 1, put(out, kept[k], parse(c, get(c.rules, kept[k]), at)))

// ---- What a form gives at a position: {rs, far} ----
//
// `rs` is its results, [] or {h, t}. `far` is the farthest position at
// which something tried here could not go on, or -1.

parse(c, g, at) =>
  if g.op == `ref then rule(c, g.name, g.kept, at)
  else if g.op == `term then terminal(g, at, g.match(c.text, at))
  else if g.op == `seq then in_order(c, g.items, at)
  else if g.op == `alt then branches(c, g.items, 0, at, grammar.byte(c.text, at))
  else if g.op == `star then grow(c, g, {h: {end: at, tree: []}, t: []}, [], -1)
  else if g.op == `opt then maybe(at, gate(c, g, at))
  else guarded(g.holds, at, parse(c, g.item, at))

none_at(at) => {rs: [], far: at}
one_at(end, tree) => {rs: {h: {end: end, tree: tree}, t: []}, far: -1}

terminal(g, at, n) => if n < 0 then none_at(at) else one_at(at + n, {kind: `term, name: g.name, start: at, end: at + n})

rule(c, name, kept, at) => named(name, at, if kept then get(get(c.rows, at), name) else parse(c, get(c.rules, name), at))
named(name, at, p) => {rs: named_each(name, at, p.rs), far: p.far}
named_each(name, at, rs) =>
  if count(rs) == 0 then []
  else {h: {end: rs.h.end, tree: {kind: `rule, name: name, start: at, end: rs.h.end, tree: rs.h.tree}}, t: named_each(name, at, rs.t)}

// A sequence: for each result of an item, the items after it from where
// that result ends.
in_order(c, items, at) => as_seq(sequence(c, items, 0, at))
as_seq(p) => {rs: as_seq_each(p.rs), far: p.far}
as_seq_each(rs) => if count(rs) == 0 then [] else {h: {end: rs.h.end, tree: {kind: `seq, items: rs.h.tree}}, t: as_seq_each(rs.t)}
sequence(c, items, i, at) =>
  if i == count(items) then one_at(at, [])
  else chain(c, items, i, parse(c, items[i], at))
chain(c, items, i, p) => link(c, items, i, p.rs, p.far)
link(c, items, i, rs, far) =>
  if count(rs) == 0 then {rs: [], far: far}
  else joined(rs.h.tree, sequence(c, items, i + 1, rs.h.end), link(c, items, i, rs.t, far))
joined(tree, rest, more) => {rs: fronted(tree, rest.rs, more.rs), far: most(rest.far, more.far)}
fronted(tree, rs, more) =>
  if count(rs) == 0 then more
  else {h: {end: rs.h.end, tree: {h: tree, t: rs.h.tree}}, t: fronted(tree, rs.t, more)}

// The item of a `star` or an `opt`, where the next byte is one it can
// begin with or it is open.
gate(c, g, at) => if g.open || class.has(g.set, grammar.byte(c.text, at)) then parse(c, g.item, at) else none_at(at)

// The items of an `alt`: each that can begin with the byte b, or is open.
branches(c, items, i, at, b) =>
  if i == count(items) then none_at(at)
  else branch(c, items, i, at, b, items[i])
branch(c, items, i, at, b, it) =>
  if it.open || class.has(it.set, b) then either(i, parse(c, it.g, at), branches(c, items, i + 1, at, b))
  else branches(c, items, i + 1, at, b)
either(i, p, q) => {rs: chosen(i, p.rs, q.rs), far: most(p.far, q.far)}
chosen(i, rs, more) =>
  if count(rs) == 0 then more
  else {h: {end: rs.h.end, tree: {kind: `alt, index: i, tree: rs.h.tree}}, t: chosen(i, rs.t, more)}

// A repetition. `todo` is the results not yet tried further and `done`
// those that were; each holds its trees last first. A result is tried
// further by reading the item where it ends, and a reading that reads no
// byte is dropped, so the work ends.
grow(c, g, todo, done, far) =>
  if count(todo) == 0 then {rs: turned(done, []), far: far}
  else grown(c, g, todo.h, todo.t, done, far, gate(c, g, todo.h.end))
grown(c, g, r, todo, done, far, p) => grow(c, g, longer(p.rs, r, todo), {h: r, t: done}, most(far, p.far))
longer(rs, r, todo) =>
  if count(rs) == 0 then todo
  else if rs.h.end > r.end then {h: {end: rs.h.end, tree: {h: rs.h.tree, t: r.tree}}, t: longer(rs.t, r, todo)}
  else longer(rs.t, r, todo)
turned(done, out) =>
  if count(done) == 0 then out
  else turned(done.t, {h: {end: done.h.end, tree: {kind: `star, items: reversed(done.h.tree, [])}}, t: out})
reversed(l, out) => if count(l) == 0 then out else reversed(l.t, {h: l.h, t: out})

maybe(at, p) => {rs: {h: {end: at, tree: {kind: `opt, items: []}}, t: maybe_each(p.rs)}, far: p.far}
maybe_each(rs) =>
  if count(rs) == 0 then []
  else {h: {end: rs.h.end, tree: {kind: `opt, items: {h: rs.h.tree, t: []}}}, t: maybe_each(rs.t)}

guarded(holds, at, p) => if (count(p.rs) > 0) == holds then one_at(at, {kind: `guard}) else none_at(at)

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
