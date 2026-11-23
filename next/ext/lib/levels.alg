// Levels of binding for signs written between operands.
//
// Whose: the kernel stream (lane R). Decision: "Named, partially ordered
// precedence levels" (docs/plans/book-pass.md section 10).
//
// A level is {name, signs, side, after, before}. `signs` are the texts
// of its signs. `side` is `left where a row of its signs groups from the
// left, a - b - c as (a - b) - c, and `right where it groups from the
// right. `after` names levels this one binds tighter than, and `before`
// levels it binds looser than. No level has a number: a level is placed
// by the levels it names, and a level that names one neighbour is placed
// as far as that says. Two levels with no order between them, directly
// or through others, may both be in a grammar; a text that writes their
// signs side by side is what cannot be read, and reading it is refused.
//
// `row(operand, levels, sign, make)` gives a form: an operand, and then
// a sign and an operand any number of times. The engine reads it as one
// row, with no rule for each level, and what it gives is the row
// grouped by the levels. `sign(text)` makes the terminal for a sign.
// `make(sign, left, right, at)` makes what a sign with its two operands
// gives, `at` being the place from the beginning of the left operand to
// the end of the right. A row of one operand gives what the operand
// gives.
//
// Not here yet: a level whose signs do not group at all, so that
// a < b < c is no reading.
import grammar

export level(name, signs, side) => {name: name, signs: signs, side: side, after: [], before: []}
export after(l, names) => {name: l.name, signs: l.signs, side: l.side, after: names, before: l.before}
export before(l, names) => {name: l.name, signs: l.signs, side: l.side, after: l.after, before: names}

export row(operand, levels, sign, make) => made(placed(operand), levels, sign, make, tighter_table(levels, 0, []))
made(operand, levels, sign, make, table) =>
  grammar.giving(grammar.seq([operand, grammar.star(grammar.seq([grammar.alt(signs_of(levels, sign, 0, [])), operand]))]), (v, at) => grouped(levels, table, make, v[1], 0, {h: v[0], t: []}, []))
// An operand with its place beside what it gives.
placed(operand) => grammar.giving(operand, (v, at) => {v: v, at: at})

// A terminal for each sign of each level, giving the sign and the number of its level.
signs_of(levels, sign, i, out) => if i == count(levels) then out else signs_of(levels, sign, i + 1, signs_in(levels[i].signs, sign, i, 0, out))
signs_in(signs, sign, level, k, out) =>
  if k == count(signs) then out
  else signs_in(signs, sign, level, k + 1, put(out, [], grammar.giving(sign(signs[k]), (v, at) => {sign: v, level: level})))

// ---- Which level binds tighter ----

// For each level, for each level: true where the first binds tighter
// than the second, directly or through others.
tighter_table(levels, i, out) => if i == count(levels) then out else tighter_table(levels, i + 1, put(out, [], tighter_row(levels, i, 0, [])))
tighter_row(levels, i, j, out) => if j == count(levels) then out else tighter_row(levels, i, j + 1, put(out, [], reaches(levels, {h: i, t: []}, [], j)))
// `todo` is levels the first binds tighter than, or is; `seen` those looked at.
reaches(levels, todo, seen, j) =>
  if count(todo) == 0 then false
  else if is_in(seen, todo.h) then reaches(levels, todo.t, seen, j)
  else below(levels, todo.h, todo.t, {h: todo.h, t: seen}, j, 0)
// Each level k that the level i binds tighter than at one step: named in i's `after`, or naming i in its `before`.
below(levels, i, todo, seen, j, k) =>
  if k == count(levels) then reaches(levels, todo, seen, j)
  else if k != i && (names(levels[i].after, levels[k].name, 0) || names(levels[k].before, levels[i].name, 0)) then (k == j || below(levels, i, {h: k, t: todo}, seen, j, k + 1))
  else below(levels, i, todo, seen, j, k + 1)
names(l, name, i) => i < count(l) && (l[i] == name || names(l, name, i + 1))
is_in(l, x) => count(l) > 0 && (l.h == x || is_in(l.t, x))

// ---- Grouping a row ----

// `operands` and `signs` are what is read and not yet grouped, last
// first. Before a sign is put with them, every sign that binds tighter,
// or as tight and from the left, is given its two operands.
grouped(levels, table, make, rest, i, operands, signs) =>
  if i == count(rest) then closed(make, operands, signs)
  else settled(levels, table, make, rest, i, operands, signs, rest[i][0])
settled(levels, table, make, rest, i, operands, signs, s) =>
  if count(signs) > 0 && first(levels, table, signs.h, s) then settled(levels, table, make, rest, i, joined(make, operands, signs.h), signs.t, s)
  else grouped(levels, table, make, rest, i + 1, {h: rest[i][1], t: operands}, {h: s, t: signs})
closed(make, operands, signs) => if count(signs) == 0 then operands.h.v else closed(make, joined(make, operands, signs.h), signs.t)
// The two last operands as one, under a sign.
joined(make, operands, s) => {h: both(make, s.sign, operands.t.h, operands.h), t: operands.t.t}
both(make, sign, left, right) => under(make, sign, left, right, {source: left.at.source, start: left.at.start, end: right.at.end})
under(make, sign, left, right, at) => {v: make(sign, left.v, right.v, at), at: at}
// True where the sign a, written before the sign b, takes its operands first.
first(levels, table, a, b) =>
  if a.level == b.level then sided(levels[a.level].side)
  else if table[a.level][b.level] && table[b.level][a.level] then refuse("two levels each bind tighter than the other")
  else if table[a.level][b.level] then true
  else if table[b.level][a.level] then false
  else refuse("two signs are side by side whose levels have no order between them")
sided(side) => if side == `left then true else if side == `right then false else refuse("a level groups from the left or from the right")
