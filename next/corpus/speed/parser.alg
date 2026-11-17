// A toy parser engine, one of the two speed tests of milestone 3 (B-196
// (the rebuild's acceptance side), chunk Q8 (the speed tests of milestone
// 3)). The engine is general: it takes a grammar as data and a text, and
// answers a parse tree as a structure, or where it failed. The driver
// below is the only part that knows the grammar.
//
// The grammar formalism, a parsing expression grammar of five forms, each
// a structure with the entry `op`:
//   {op: `lit, text: t}       the literal text t
//   {op: `seq, items: [...]}  each item in order
//   {op: `alt, items: [...]}  the first item that matches
//   {op: `star, item: g}      g as many times as it matches, zero or more
//   {op: `ref, name: `r}      the rule r of the grammar's rules
// The rules are a structure keyed by the rule names.
//
// The tree, each node a structure with the entry `kind`:
//   {kind: `text, text: t}               a literal matched
//   {kind: `seq, items: list}            a sequence; list holds one tree per item
//   {kind: `star, items: list}           a repetition; list holds one tree per match
//   {kind: `choice, index: i, tree: t}   the alternative at place i matched
//   {kind: `rule, name: `r, tree: t}     the rule r matched
// A list is {kind: `nil} or {kind: `cons, head: t, tail: list}.
//
// A result is {ok: true, tree: t, at: p, far: f} or {ok: false, at: f,
// far: f}: p is where the match ends and f the farthest place at which a
// part of the parse failed, both places in the text in bits. The text is read with bits.slice, bits.length and
// ==, a character being 8 bits.
//
// The test grammar: arithmetic over whole numbers with + - * /,
// parentheses and spaces, * and / binding tighter, each level grouping to
// the left.
//
// The bench (next/corpus/speed/bench.ts) replaces the line `input = ...`
// with a longer text and leaves out the checks after the line that says
// so. The lines below pin the size the suite runs
// (next/corpus/speed/speed.test.ts).
capability output

// ---- The engine ----

// `far` is the farthest place at which any part of the parse failed.
ok(tree, at, far) => {ok: true, tree: tree, at: at, far: far}
fail(at) => {ok: false, at: at, far: at}
max(a, b) => if a > b then a else b
nil = {kind: `nil}
cons(head, tail) => {kind: `cons, head: head, tail: tail}

parse(rules, g, src, at) =>
  op = g.op
  if op == `lit then literal(g.text, src, at)
    else if op == `seq then sequence(rules, g.items, 0, src, at)
    else if op == `alt then choice(rules, g.items, 0, src, at, 0)
    else if op == `star then repeat(rules, g.item, src, at)
    else if op == `ref then rule(g.name, parse(rules, get(rules, g.name), src, at))
    else fail(at)

literal(t, src, at) =>
  n = bits.length(t)
  if at + n <= bits.length(src) && bits.slice(src, at, n) == t
    then ok({kind: `text, text: t}, at + n, 0)
    else fail(at)

sequence(rules, items, i, src, at) =>
  if i == count(items) then ok({kind: `seq, items: nil}, at, 0)
  else sequenceNext(rules, items, i, src, parse(rules, get(items, i), src, at))
sequenceNext(rules, items, i, src, first) =>
  if first.ok then sequenceJoin(first, sequence(rules, items, i + 1, src, first.at))
  else first
sequenceJoin(first, rest) =>
  if rest.ok then ok({kind: `seq, items: cons(first.tree, rest.tree.items)}, rest.at, max(first.far, rest.far))
  else fail(max(first.far, rest.far))

choice(rules, items, i, src, at, far) =>
  if i == count(items) then fail(far)
  else choiceNext(rules, items, i, src, at, far, parse(rules, get(items, i), src, at))
choiceNext(rules, items, i, src, at, far, r) =>
  if r.ok then ok({kind: `choice, index: i, tree: r.tree}, r.at, max(far, r.far))
  else choice(rules, items, i + 1, src, at, max(far, r.far))

repeat(rules, g, src, at) => repeatNext(rules, g, src, at, parse(rules, g, src, at))
repeatNext(rules, g, src, at, r) =>
  if r.ok && r.at > at then repeatJoin(r, repeat(rules, g, src, r.at))
  else ok({kind: `star, items: nil}, at, r.far)
repeatJoin(r, rest) => ok({kind: `star, items: cons(r.tree, rest.tree.items)}, rest.at, max(r.far, rest.far))

rule(name, r) =>
  if r.ok then ok({kind: `rule, name: name, tree: r.tree}, r.at, r.far)
  else r

// The nodes of a tree, list cells left out.
nodes(t) =>
  k = t.kind
  if k == `text then 1
    else if k == `seq || k == `star then 1 + listNodes(t.items)
    else 1 + nodes(t.tree)
listNodes(l) => if l.kind == `nil then 0 else nodes(l.head) + listNodes(l.tail)

// ---- The grammar, as data ----

lit(t) => {op: `lit, text: t}
seq(xs) => {op: `seq, items: xs}
alt(xs) => {op: `alt, items: xs}
star(g) => {op: `star, item: g}
ref(name) => {op: `ref, name: name}

arithmetic = {
  start: seq([ref(`sum), ref(`sp)]),
  sum: seq([ref(`product), star(seq([ref(`sp), ref(`addop), ref(`product)]))]),
  product: seq([ref(`factor), star(seq([ref(`sp), ref(`mulop), ref(`factor)]))]),
  factor: seq([ref(`sp), alt([ref(`number), seq([lit("("), ref(`sum), ref(`sp), lit(")")])])]),
  number: seq([ref(`digit), star(ref(`digit))]),
  digit: alt([lit("0"), lit("1"), lit("2"), lit("3"), lit("4"), lit("5"), lit("6"), lit("7"), lit("8"), lit("9")]),
  addop: alt([lit("+"), lit("-")]),
  mulop: alt([lit("*"), lit("/")]),
  sp: star(lit(" "))
}

// ---- The driver: the value a tree of this grammar stands for ----

// The tree under a rule node, and the item at place i of a sequence node.
under(t) => t.tree
item(t, i) => nth(t.items, i)
nth(l, i) => if i == 0 then l.head else nth(l.tail, i - 1)

// start = sum sp; sum and product = operand (sp op operand)*.
value(start) => sum(item(start, 0))
sum(t) => level(under(t), product, (op, a, b) => if op == 0 then a + b else a - b)
product(t) => level(under(t), factor, (op, a, b) => if op == 0 then a * b else a / b)
level(s, operand, apply) => fold(item(s, 1).items, operand(item(s, 0)), operand, apply)
fold(l, acc, operand, apply) =>
  if l.kind == `nil then acc
  else fold(l.tail, apply(under(item(l.head, 1)).index, acc, operand(item(l.head, 2))), operand, apply)
// factor = sp (number | "(" sum sp ")")
factor(t) =>
  c = item(under(t), 1)
  if c.index == 0 then number(c.tree) else sum(item(c.tree, 1))
// number = digit digit*
number(t) => digits(item(under(t), 1).items, digit(item(under(t), 0)))
digits(l, acc) => if l.kind == `nil then acc else digits(l.tail, acc * 10 + digit(l.head))
digit(t) => under(t).index

run(text) =>
  r = parse(arithmetic, arithmetic.start, text, 0)
  if r.ok && r.at == bits.length(text)
    then "value " ++ int.text(value(r.tree)) ++ ", nodes " ++ int.text(nodes(r.tree))
    else "failed at character " ++ int.text(max(r.at, r.far) / 8)

input = "12 * (3 + 4) - 10 / 2"
output.write(run(input))
// expect: value 79, nodes 124
// ---- Checks at the suite's size only: the bench leaves out what follows ----
output.write(run("2 + 3 * 4 - (8 - 2) / 3"))
// expect: value 12, nodes 140
output.write(run("1 + * 2"))
// expect: failed at character 4
// end: completed
