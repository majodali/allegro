// The toy parser engine of next/corpus/speed/parser.alg, written for the
// present tree's file runner in its base language:
//   npx tsx src/index.ts --base next/corpus/speed/present/parser.alg
// Part of B-196 (the rebuild's acceptance side), chunk Q8 (the speed tests
// of milestone 3). The same grammar formalism, the same recursive engine,
// the same trees and the same driver, function for function.
//
// What differs, and why:
//   - a tag is a text ("lit"), since the base language has no symbol
//     literal; `==` compares two texts as it compares two symbols there;
//   - a text is read with bits_slice(t, from, to), whose third argument is
//     an end place, not a count, and with bits_length; a place is in bits
//     as in the twin;
//   - an entry is read with `rules[name]` and `items[i]`, a count with
//     `items.length`;
//   - no block binds a name: the present tree builder puts a block
//     binding's value at each place it is used, so a binding read twice
//     would be evaluated twice. Each value read more than once is handed to
//     a helper function as an argument instead (`parseOp`, `literalFits`,
//     `nodesOf`, `factorOf`, `runResult`);
//   - a truth value in a result is 1 or 0: `true` is not bound in the base
//     language, and a structure that holds it stays a residual that
//     `print` does not print;
//   - the end of the text is tested with `r.at < bits_length(text)` where
//     the twin writes `==`: in the base language, inside a function,
//     `r.at == bits_length(s)` answers false where both are 40, for a
//     parameter `r` holding {at: 40} and s = "1 + 2";
//   - `a && b` is written as a nested `if`, so the text is never sliced
//     past its end whatever the order of evaluation;
//   - a line is printed with `print`, and a number by itself, as
//     `0 + n`: the base language has no `int.text`, and `print` renders an
//     integer as digits only when it is 64 bits wide. So the twin prints
//     `value`, the value, `nodes` and the count on four lines where
//     parser.alg prints one.
//
// The bench (next/corpus/speed/bench.ts) replaces the line `input = ...`
// and leaves out the checks after the line that says so.

// ---- The engine ----

ok(tree, at, far) => {ok: 1, tree: tree, at: at, far: far}
fail(at) => {ok: 0, at: at, far: at}
max(a, b) => if a > b then a else b
nil = {kind: "nil"}
cons(head, tail) => {kind: "cons", head: head, tail: tail}

parse(rules, g, src, at) => parseOp(rules, g, src, at, g.op)
parseOp(rules, g, src, at, op) =>
  if op == "lit" then literal(g.text, src, at)
    else if op == "seq" then sequence(rules, g.items, 0, src, at)
    else if op == "alt" then choice(rules, g.items, 0, src, at, 0)
    else if op == "star" then repeat(rules, g.item, src, at)
    else if op == "ref" then rule(g.name, parse(rules, rules[g.name], src, at))
    else fail(at)

literal(t, src, at) => literalFits(t, src, at, bits_length(t))
literalFits(t, src, at, n) =>
  if at + n <= bits_length(src)
    then (if bits_slice(src, at, at + n) == t then ok({kind: "text", text: t}, at + n, 0) else fail(at))
    else fail(at)

sequence(rules, items, i, src, at) =>
  if i == items.length then ok({kind: "seq", items: nil}, at, 0)
  else sequenceNext(rules, items, i, src, parse(rules, items[i], src, at))
sequenceNext(rules, items, i, src, first) =>
  if first.ok then sequenceJoin(first, sequence(rules, items, i + 1, src, first.at))
  else first
sequenceJoin(first, rest) =>
  if rest.ok then ok({kind: "seq", items: cons(first.tree, rest.tree.items)}, rest.at, max(first.far, rest.far))
  else fail(max(first.far, rest.far))

choice(rules, items, i, src, at, far) =>
  if i == items.length then fail(far)
  else choiceNext(rules, items, i, src, at, far, parse(rules, items[i], src, at))
choiceNext(rules, items, i, src, at, far, r) =>
  if r.ok then ok({kind: "choice", index: i, tree: r.tree}, r.at, max(far, r.far))
  else choice(rules, items, i + 1, src, at, max(far, r.far))

repeat(rules, g, src, at) => repeatNext(rules, g, src, at, parse(rules, g, src, at))
repeatNext(rules, g, src, at, r) =>
  if r.ok then (if r.at > at then repeatJoin(r, repeat(rules, g, src, r.at)) else ok({kind: "star", items: nil}, at, r.far))
  else ok({kind: "star", items: nil}, at, r.far)
repeatJoin(r, rest) => ok({kind: "star", items: cons(r.tree, rest.tree.items)}, rest.at, max(r.far, rest.far))

rule(name, r) =>
  if r.ok then ok({kind: "rule", name: name, tree: r.tree}, r.at, r.far)
  else r

// The nodes of a tree, list cells left out.
nodes(t) => nodesOf(t, t.kind)
nodesOf(t, k) =>
  if k == "text" then 1
    else if k == "seq" then 1 + listNodes(t.items)
    else if k == "star" then 1 + listNodes(t.items)
    else 1 + nodes(t.tree)
listNodes(l) => if l.kind == "nil" then 0 else nodes(l.head) + listNodes(l.tail)

// ---- The grammar, as data ----

lit(t) => {op: "lit", text: t}
seq(xs) => {op: "seq", items: xs}
alt(xs) => {op: "alt", items: xs}
star(g) => {op: "star", item: g}
ref(name) => {op: "ref", name: name}

arithmetic = {
  start: seq([ref("sum"), ref("sp")]),
  sum: seq([ref("product"), star(seq([ref("sp"), ref("addop"), ref("product")]))]),
  product: seq([ref("factor"), star(seq([ref("sp"), ref("mulop"), ref("factor")]))]),
  factor: seq([ref("sp"), alt([ref("number"), seq([lit("("), ref("sum"), ref("sp"), lit(")")])])]),
  number: seq([ref("digit"), star(ref("digit"))]),
  digit: alt([lit("0"), lit("1"), lit("2"), lit("3"), lit("4"), lit("5"), lit("6"), lit("7"), lit("8"), lit("9")]),
  addop: alt([lit("+"), lit("-")]),
  mulop: alt([lit("*"), lit("/")]),
  sp: star(lit(" "))
}

// ---- The driver: the value a tree of this grammar stands for ----

under(t) => t.tree
item(t, i) => nth(t.items, i)
nth(l, i) => if i == 0 then l.head else nth(l.tail, i - 1)

value(start) => sum(item(start, 0))
sum(t) => level(under(t), product, (op, a, b) => if op == 0 then a + b else a - b)
product(t) => level(under(t), factor, (op, a, b) => if op == 0 then a * b else a / b)
level(s, operand, apply) => fold(item(s, 1).items, operand(item(s, 0)), operand, apply)
fold(l, acc, operand, apply) =>
  if l.kind == "nil" then acc
  else fold(l.tail, apply(under(item(l.head, 1)).index, acc, operand(item(l.head, 2))), operand, apply)
factor(t) => factorOf(item(under(t), 1))
factorOf(c) => if c.index == 0 then number(c.tree) else sum(item(c.tree, 1))
number(t) => digits(item(under(t), 1).items, digit(item(under(t), 0)))
digits(l, acc) => if l.kind == "nil" then acc else digits(l.tail, acc * 10 + digit(l.head))
digit(t) => under(t).index

run(text) => runResult(text, parse(arithmetic, arithmetic.start, text, 0))
runResult(text, r) =>
  if r.ok then (if r.at < bits_length(text) then failed(r) else report(r.tree)) else failed(r)
report(tree) => [print("value"), print(0 + value(tree)), print("nodes"), print(0 + nodes(tree))]
failed(r) => [print("failed at character"), print(0 + max(r.at, r.far) / 8)]

input = "12 * (3 + 4) - 10 / 2"
run(input)
// ---- Checks at the suite's size only: the bench leaves out what follows ----
run("2 + 3 * 4 - (8 - 2) / 3")
run("1 + * 2")
