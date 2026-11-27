// What a tree of Allegretto means, written in Allegretto.
//
// Whose: the kernel stream (lane R). Chunk E7 of docs/plans/book-pass.md
// section 10, second part. The forms and what each stands for are those
// of next/ext/allegretto/forms.md sections 2 and 4.
//
// `module_of(tree, given)` takes the tree of a text (allegretto.alg) and
// gives what the kernel makes a module from:
//
//   {description, declares, keys}
//
// `description` is the description of the module's function, as the
// kernel's `build` reads one. `declares` says what each parameter after
// the keys is: {role, name}, and for a module that is imported its
// identity too. `keys` is how many of the first parameters are keys.
// Where the text is not a module it gives
//
//   {failure: `not_a_module, findings}
//
// each finding {message, at}.
//
// `given` is what a text does not say:
//
//   shipped   the shipped primitives a text may name, each {name, hash}
//   modules   the modules the text imports, each {name, declares,
//             identity}, `declares` as above
//   own       the tree of Allegretto's own functions: `is_failure` and
//             `handle`, the four for iteration and their helpers
//
// How each form is written is one line of `expr` below. A name is one of
// two things, as the kernel has them: a parameter of a function, written
// by how many functions out it is and its place among that function's
// parameters; or a name a block binds, which the kernel looks up from
// where it is used. A name Allegretto binds is what it stands for.
//
// A notation's part of the tree may be a node the reader gives no text:
// {k: `from, module, name, at}, which reads a binding of the notation's
// module, whatever the text has bound ("What a notation's parts read").
// A line `use` is passed over: the reader has made its change already.
// `needed(tree)` gives the names of the modules a text needs emitted
// before it: its imports, and the modules its `from` nodes read.
//
// A name nothing binds, a name bound twice in a block, and an import
// that does not fit what it imports are findings. A finding is written
// into the description where it is met, and gathered when the
// description is done: so nothing is carried through every function for
// the texts that have none.

// ---- Small things ----

has(l, x, i) => i < count(l) && (l[i] == x || has(l, x, i + 1))
joined(a, i, out) => if i == count(a) then out else joined(a, i + 1, put(out, [], a[i]))
mapped(l, f, i, out) => if i == count(l) then out else mapped(l, f, i + 1, put(out, [], f(l[i])))

// ---- Descriptions ----

bits_of(v) => {form: `bits, value: v}
datum(name) => {form: `symbol, value: symbol(name)}
named(name) => {form: `name, name: symbol(name)}
kernel(name) => {form: `kernel, name: name}
param(depth, index) => {form: `param, function: depth, index: index}
// A part of the text has its place; a part of Allegretto's own functions has none.
apply(c, f, args, at) => if c.placing then {form: `apply, function: f, arguments: args, at: at} else {form: `apply, function: f, arguments: args}
function(c, n, body, at) => if c.placing then {form: `function, parameters: n, body: body, at: at} else {form: `function, parameters: n, body: body}
structure(c, entries, at) => if c.placing then {form: `structure, entries: entries, at: at} else {form: `structure, entries: entries}
finding(message, at) => {form: `finding, message: message, at: at}
cond(c, test, yes, no, at) => apply(c, kernel("if"), [test, yes, no], at)
truth(b) => bits_of(b)

// ---- Names ----

// A scope is the names of a block or a function, {names, outer}, with
// `outer` the scope around it or []. Each name is {name, m}. What a name
// means, m, is one of
//   {k: `param, level, index, role}   a parameter of the function at that level
//   {k: `bound}                       a name a block binds
//   {k: `kernel, name}                a kernel primitive
//   {k: `namespace}                   int, float, text or bits
//   {k: `own}                         one of Allegretto's own functions
looked(scope, name) => if count(scope) == 0 then [] else found_in(scope, name, in_names(scope.names, name, 0))
found_in(scope, name, m) => if count(m) > 0 then m else looked(scope.outer, name)
in_names(names, name, i) => if i == count(names) then [] else if names[i].name == name then names[i].m else in_names(names, name, i + 1)
has_name(names, name, i) => i < count(names) && (names[i].name == name || has_name(names, name, i + 1))

kernel_names = ["then", "also", "first", "attempt", "describe", "build", "refuse", "assume", "undecided", "get", "count", "claim", "put", "key", "kind", "symbol", "spelling", "specialize", "sample"]
namespaces = ["int", "float", "text", "bits"]
own_public = ["is_failure", "handle", "each", "each_at_once", "each_within", "all"]
allegretto_scope = {names: joined(mapped(namespaces, n => {name: n, m: {k: `namespace}}, 0, []), 0, mapped(kernel_names, n => {name: n, m: {k: `kernel, name: n}}, 0, [])), outer: []}
own_names(items, i, out) => if i == count(items) then out else own_names(items, i + 1, put(out, [], {name: items[i].name.name, m: {k: `own}}))

// What a name stands for where it is used. A parameter is written by how
// many functions out its own is: c.level is how many are around the use.
standing(c, name, m) =>
  if m.k == `param then param(c.level - 1 - m.level, m.index)
  else if m.k == `bound then named(name)
  else if m.k == `kernel then kernel(m.name)
  else if m.k == `namespace then namespace(c, name)
  else {form: `name, name: symbol(name), own: name}

// The structure one of int, float, text and bits stands for: its entries
// keyed by the names after the dot.
namespace(c, name) => {form: `structure, entries: bits_entries(name, shipped_entries(c.given.shipped, name ++ ".", 0, []))}
shipped_entries(shipped, prefix, i, out) =>
  if i == count(shipped) then out
  else if begins(shipped[i].name, prefix) then shipped_entries(shipped, prefix, i + 1, put(out, symbol(after(shipped[i].name, prefix)), {form: `primitive, hash: shipped[i].hash}))
  else shipped_entries(shipped, prefix, i + 1, out)
bits_entries(name, out) => if name == "bits" then put(put(put(out, `join, kernel("join")), `length, kernel("length")), `slice, kernel("slice")) else out
begins(t, prefix) => bits.length(t) >= bits.length(prefix) && bits.slice(t, 0, bits.length(prefix)) == prefix
after(t, prefix) => bits.slice(t, bits.length(prefix), bits.length(t) - bits.length(prefix))
// The shipped primitive of a name, or a finding where the platform ships none of that name.
shipped(c, name, at) => shipped_in(c.given.shipped, name, at, 0)
shipped_in(shipped, name, at, i) =>
  if i == count(shipped) then finding("the name " ++ name ++ " is bound nowhere in the text", at)
  else if shipped[i].name == name then {form: `primitive, hash: shipped[i].hash}
  else shipped_in(shipped, name, at, i + 1)

// ---- Expressions ----

int_operator(op) =>
  if op == "+" then "int.add" else if op == "-" then "int.sub" else if op == "*" then "int.mul" else if op == "/" then "int.div" else if op == "%" then "int.mod"
  else if op == "<" then "int.lt" else if op == ">" then "int.gt" else if op == "<=" then "int.le" else "int.ge"

expr(e, c) =>
  if e.k == `text then bits_of(e.bytes)
  else if e.k == `int || e.k == `float || e.k == `truth then bits_of(e.value)
  else if e.k == `symbol then datum(e.name)
  else if e.k == `name then name_used(e, c, looked(c.scope, e.name))
  else if e.k == `lambda then lambda(c, e.params, e.body, e.at)
  else if e.k == `apply then apply(c, expr(e.fn, c), mapped(e.args, a => expr(a, c), 0, []), e.at)
  else if e.k == `pipe then apply(c, expr(e.fn, c), [expr(e.value, c)], e.at)
  else if e.k == `dot then dotted(e, c)
  else if e.k == `index then apply(c, kernel("get"), [expr(e.object, c), expr(e.index, c)], e.at)
  else if e.k == `if then cond(c, expr(e.condition, c), expr(e.then, c), expr(e.otherwise, c), e.at)
  else if e.k == `unary then unary(e, c, expr(e.operand, c))
  else if e.k == `binary then binary(e.op, c, expr(e.left, c), expr(e.right, c), e.at)
  else if e.k == `record then record(e.fields, c, e.at, 0, [])
  else if e.k == `list then structure(c, mapped(e.items, i => expr(i, c), 0, []), e.at)
  else if e.k == `from then apply(c, kernel("get"), [named(hidden(e.module)), datum(e.name)], e.at)
  else block_value(e, c)

name_used(e, c, m) => if count(m) == 0 then finding("the name " ++ e.name ++ " is bound nowhere in the text", e.at) else standing(c, e.name, m)

// A function: its parameters are of the function at the level c.level, and its body is one function further in.
lambda(c, params, body, at) => faulty(twice(params, 0, []), function(c, count(params), expr(body, inside(c, params)), at))
inside(c, params) => {scope: {names: param_names(params, c.level, 0, []), outer: c.scope}, level: c.level + 1, placing: c.placing, given: c.given}
param_names(params, level, i, out) => if i == count(params) then out else param_names(params, level, i + 1, put(out, [], {name: params[i].name, m: {k: `param, level: level, index: i, role: `none_of}}))
// A finding for each name written twice among names that are bound together.
twice(names, i, out) =>
  if i == count(names) then out
  else if earlier(names, names[i].name, i, 0) then twice(names, i + 1, put(out, [], finding("the name " ++ names[i].name ++ " is bound twice in one block", names[i].at)))
  else twice(names, i + 1, out)
earlier(names, name, i, k) => k < i && (names[k].name == name || earlier(names, name, i, k + 1))
// A description with the findings met beside it, where there are any.
faulty(found, d) => if count(found) == 0 then d else {form: `faulty, findings: found, inner: d}

// `p.a`: where p is one of Allegretto's four structures and nothing has
// bound the name again, the primitive itself; otherwise the entry read.
dotted(e, c) =>
  if e.object.k == `name && is_namespace(looked(c.scope, e.object.name)) then of_namespace(c, e.object.name ++ "." ++ e.name.name, e.at)
  else apply(c, kernel("get"), [expr(e.object, c), datum(e.name.name)], e.at)
is_namespace(m) => count(m) > 0 && m.k == `namespace
of_namespace(c, full, at) =>
  if full == "bits.join" then kernel("join") else if full == "bits.length" then kernel("length") else if full == "bits.slice" then kernel("slice")
  else shipped(c, full, at)

unary(e, c, operand) => if e.op == "!" then cond(c, operand, truth(false), truth(true), e.at) else apply(c, shipped(c, "int.neg", e.at), [operand], e.at)
binary(op, c, left, right, at) =>
  if op == "&&" then cond(c, left, right, truth(false), at)
  else if op == "||" then cond(c, left, truth(true), right, at)
  else if op == "==" then apply(c, kernel("same"), [left, right], at)
  else if op == "!=" then cond(c, apply(c, kernel("same"), [left, right], at), truth(false), truth(true), at)
  else if op == "++" then apply(c, kernel("join"), [left, right], at)
  else apply(c, shipped(c, int_operator(op), at), [left, right], at)

// A structure written out. The entries up to the first key that is
// worked out are the structure; each entry from there on is put on what
// comes before it. An entry keyed by a module's key is written with no
// key, as {form: `keyed, key, value}, which the kernel's `build` reads.
record(fields, c, at, i, entries) =>
  if i == count(fields) then structure(c, entries, at)
  else if fields[i].k == `named then record(fields, c, at, i + 1, put(entries, symbol(fields[i].name.name), expr(fields[i].value, c)))
  else if count(key_param(fields[i].key, c)) > 0 then record(fields, c, at, i + 1, put(entries, [], {form: `keyed, key: key_param(fields[i].key, c)[0], value: expr(fields[i].value, c)}))
  else put_each(fields, c, at, i, structure(c, entries, at))
put_each(fields, c, at, i, built) =>
  if i == count(fields) then built
  else if fields[i].k == `named then put_each(fields, c, at, i + 1, apply(c, kernel("put"), [built, datum(fields[i].name.name), expr(fields[i].value, c)], at))
  else if count(key_param(fields[i].key, c)) > 0 then put_each(fields, c, at, i + 1, apply(c, kernel("put"), [built, key_param(fields[i].key, c)[0], expr(fields[i].value, c)], at))
  else put_each(fields, c, at, i + 1, apply(c, kernel("put"), [built, expr(fields[i].key, c), expr(fields[i].value, c)], at))
// Where a key that is worked out is the name of a key's header line, the
// entry is private: its key is that parameter. [parameter], or [].
key_param(k, c) => if k.k == `name then key_meant(c, looked(c.scope, k.name)) else []
key_meant(c, m) => if count(m) > 0 && m.k == `param && m.role == `key then [param(c.level - 1 - m.level, m.index)] else []

// ---- Blocks ----

// A block written as an expression has a scope of its own.
block_value(e, c) => faulty(out_of_place(e.items, 0, []), or_refused(block(e.items, {scope: {names: [], outer: c.scope}, level: c.level, placing: c.placing, given: c.given}, false, [], e.sync, e.at, []), e.at))
or_refused(b, at) => if count(b) == 0 then finding("a block with no statement has no value", at) else b[0]

is_binding(i) => i.k == `binding || i.k == `function || i.k == `arrow
kept(items, keep, i, out) => if i == count(items) then out else kept(items, keep, i + 1, if keep(items[i]) then put(out, [], items[i]) else out)
item_names(items, i, out) => if i == count(items) then out else item_names(items, i + 1, put(out, [], items[i].name))

// A block: [] where it has no statement and no tail, and [description]
// otherwise. Its bindings are one group, bound before anything is
// written. Its statements are a chain of `also` in written order, or of
// `then` after `sync`. `tail` ends the chain where `has_tail` is true:
// the module's structure of what it yields. `more` is bindings beside
// those written: the module's imports, each {name, value}, `value` a
// function of the context.
block(items, c, has_tail, tail, sync, at, more) => block_in(kept(items, is_binding, 0, []), items, grouped(c, joined(more, 0, item_names(kept(items, is_binding, 0, []), 0, []))), has_tail, tail, sync, at, more, c)
// The context inside the block: its names bound, beside those the scope it was given has already.
grouped(c, names) => {scope: {names: joined(c.scope.names, 0, bound_names(names, 0, [])), outer: c.scope.outer}, level: c.level, placing: c.placing, given: c.given}
bound_names(names, i, out) => if i == count(names) then out else bound_names(names, i + 1, put(out, [], {name: names[i].name, m: {k: `bound}}))
block_in(group, items, c, has_tail, tail, sync, at, more, outer) =>
  chained(c, more_values(more, c, 0, values(group, c, 0, [])), parts(kept(items, i => i.k == `statement || i.k == `arrow, 0, []), c, has_tail, 0, []), has_tail, tail, sync, at, misplaced(items, more, twice_bound(outer.scope.names, item_names(group, 0, []))))
// The names of a block's group that are bound twice, among themselves or with what its scope holds already:
// the header lines of a module, its imports among them.
twice_bound(held, names) => twice(joined(names, 0, held_names(held, 0, [])), count(held), [])
held_names(held, i, out) => if i == count(held) then out else held_names(held, i + 1, put(out, [], {name: held[i].name, at: []}))
values(group, c, i, out) =>
  if i == count(group) then out
  else values(group, c, i + 1, put(out, symbol(group[i].name.name), binding_value(group[i], c)))
more_values(more, c, i, out) => if i == count(more) then out else more_values(more, c, i + 1, put(out, symbol(more[i].name), more[i].value(c)))
binding_value(it, c) => if it.k == `function then lambda(c, it.params, it.body, it.at) else expr(it.value, c)
// The statements, in order. One whose value is dropped is a claim that it is no failure.
parts(lines, c, has_tail, i, out) =>
  if i == count(lines) then out
  else if lines[i].k == `arrow then parts(lines, c, has_tail, i + 1, put(out, [], named(lines[i].name.name)))
  else if (!has_tail && i + 1 == count(lines)) || is_claim(lines[i].expr, c) then parts(lines, c, has_tail, i + 1, put(out, [], expr(lines[i].expr, c)))
  else parts(lines, c, has_tail, i + 1, put(out, [], dropped(c, expr(lines[i].expr, c), lines[i].at)))
dropped(c, value, at) => apply(c, kernel("claim"), [cond(c, apply(c, own_function(c, "is_failure"), [value], at), truth(false), truth(true), at)], at)
is_claim(e, c) => e.k == `apply && e.fn.k == `name && claims(looked(c.scope, e.fn.name))
claims(m) => count(m) > 0 && m.k == `kernel && m.name == "claim"
chained(c, values, parts, has_tail, tail, sync, at, found) => linked(c, values, if has_tail then put(parts, [], tail) else parts, sync, at, found)
linked(c, values, parts, sync, at, found) =>
  if count(parts) == 0 then []
  else [faulty(found, with_bindings(c, values, chain(c, parts, count(parts) - 2, parts[count(parts) - 1], sync, at), at))]
chain(c, parts, i, out, sync, at) => if i < 0 then out else chain(c, parts, i - 1, apply(c, kernel(if sync then "then" else "also"), [parts[i], out], at), sync, at)
with_bindings(c, values, chain, at) => if count(values) == 0 then chain else apply(c, kernel("block"), [structure(c, values, at), chain], at)

// ---- Lines in their place ----

// A header line belongs to the module, and so does `export`: in a block
// inside it each is a finding. `use` is the one a block may hold: it
// brings a notation to the end of that block, and the rules here pass
// over it, since whoever read the text has made the change already.
out_of_place(items, i, out) =>
  if i == count(items) then out
  else if items[i].header && items[i].k == `use then out_of_place(items, i + 1, out)
  else if items[i].header then out_of_place(items, i + 1, put(out, [], finding("the header line " ++ spelling(items[i].k) ++ " belongs at the top level of the module, not in a block", items[i].at)))
  else if (items[i].k == `binding || items[i].k == `function) && items[i].exported then out_of_place(items, i + 1, put(out, [], finding("export marks a binding of the module, and this one is in a block inside it", items[i].at)))
  else out_of_place(items, i + 1, out)

// The names a part of the tree uses that nothing inside it binds, added to `out`.
free(e, out) =>
  if e.k == `name then with_name(out, e.name)
  else if e.k == `lambda then less(free(e.body, []), param_texts(e.params, 0, []), 0, out)
  else if e.k == `apply then free_each(e.args, 0, free(e.fn, out))
  else if e.k == `pipe then free(e.fn, free(e.value, out))
  else if e.k == `dot then free(e.object, out)
  else if e.k == `index then free(e.index, free(e.object, out))
  else if e.k == `if then free(e.otherwise, free(e.then, free(e.condition, out)))
  else if e.k == `binary then free(e.right, free(e.left, out))
  else if e.k == `unary then free(e.operand, out)
  else if e.k == `record then free_fields(e.fields, 0, out)
  else if e.k == `list then free_each(e.items, 0, out)
  else if e.k == `block then less(free_items(e.items, 0, []), bound_texts(e.items, 0, []), 0, out)
  else out
with_name(out, n) => if has(out, n, 0) then out else put(out, [], n)
// Each of `names` that is not among `bound`, added to `out`.
less(names, bound, i, out) => if i == count(names) then out else less(names, bound, i + 1, if has(bound, names[i], 0) then out else with_name(out, names[i]))
free_each(es, i, out) => if i == count(es) then out else free_each(es, i + 1, free(es[i], out))
free_fields(fs, i, out) => if i == count(fs) then out else free_fields(fs, i + 1, free(fs[i].value, if fs[i].k == `named then out else free(fs[i].key, out)))
free_pairs(pairs, i, out) => if i == count(pairs) then out else free_pairs(pairs, i + 1, free(pairs[i].value, out))
free_items(items, i, out) => if i == count(items) then out else free_items(items, i + 1, free_item(items[i], out))
// The names one line of a block uses: of its value, or of its function's body less the parameters.
free_item(it, out) =>
  if it.header then out
  else if it.k == `statement then free(it.expr, out)
  else if it.k == `function then less(free(it.body, []), param_texts(it.params, 0, []), 0, out)
  else free(it.value, out)
param_texts(params, i, out) => if i == count(params) then out else param_texts(params, i + 1, put(out, [], params[i].name))
bound_texts(items, i, out) =>
  if i == count(items) then out
  else if items[i].header || items[i].k == `statement then bound_texts(items, i + 1, out)
  else bound_texts(items, i + 1, put(out, [], items[i].name.name))

// A statement written above `x <- e` in its block that needs x, itself
// or through a binding of the block, would start e before its place: a
// finding for each, added to `out`. `more` is the module's imports, each
// a binding of its block that uses the names of its `with` values.
misplaced(items, more, out) => misplaced_in(kept(items, i => !i.header && (i.k == `statement || i.k == `arrow), 0, []), joined(more, 0, uses_of(items, 0, [])), 0, out)
uses_of(items, i, out) =>
  if i == count(items) then out
  else if !items[i].header && (items[i].k == `binding || items[i].k == `function) then uses_of(items, i + 1, put(out, [], {name: items[i].name.name, uses: free_item(items[i], [])}))
  else uses_of(items, i + 1, out)
misplaced_in(lines, uses, j, out) => if j == count(lines) then out else misplaced_in(lines, uses, j + 1, if lines[j].k == `arrow then above(lines, uses, j, 0, out) else out)
above(lines, uses, j, i, out) =>
  if i == j then out
  else if has(needs(uses, free_item(lines[i], []), 0, []), lines[j].name.name, 0) then above(lines, uses, j, i + 1, put(out, [], finding("the statement at " ++ line_column(lines[i].at) ++ " needs " ++ lines[j].name.name ++ ", which " ++ lines[j].name.name ++ " <- … binds below it at " ++ line_column(lines[j].at) ++ ": it would start that line's value before its place", lines[i].at)))
  else above(lines, uses, j, i + 1, out)
line_column(at) => int.text(at.start.line) ++ ":" ++ int.text(at.start.column)
// The names a line needs: those it uses, and those the bindings it uses use. Of two bindings of one name the later is meant.
needs(uses, names, i, out) => if i == count(names) then out else needs(uses, names, i + 1, if has(out, names[i], 0) then out else needs(uses, used_by(uses, names[i], count(uses) - 1), 0, put(out, [], names[i])))
used_by(uses, n, i) => if i < 0 then [] else if uses[i].name == n then uses[i].uses else used_by(uses, n, i - 1)

// ---- Allegretto's own functions ----

// The function of one of them: written in the scope that binds them
// all, with no place, since no text the reader was given holds it.
own_function(c, name) => own_from(c.given.own.items, name, 0, {scope: {names: own_names(c.given.own.items, 0, []), outer: allegretto_scope}, level: 1, placing: false, given: c.given})
own_from(items, name, i, c) => if items[i].name.name == name then lambda(c, items[i].params, items[i].body, []) else own_from(items, name, i + 1, c)

// ---- The module ----

export module_of(tree, given) => gathered(module(tree, given))
gathered(m) => judged(m, findings(m.description, m.findings))
judged(m, found) => if count(found) > 0 then {failure: `not_a_module, findings: found} else {description: m.description, declares: m.declares, keys: m.keys}

is_key(h) => h.k == `key
not_key(h) => h.k != `key && h.k != `use
// The header lines are the module function's parameters: the keys
// first, then the others, each in written order.
module(tree, given) => module_with(tree, given, joined(kept(tree.headers, not_key, 0, []), 0, kept(tree.headers, is_key, 0, [])), count(kept(tree.headers, is_key, 0, [])))
module_with(tree, given, params, keys) => module_in(tree, params, keys, used_modules(tree), {scope: {names: header_names(params, keys, 0, []), outer: {names: mapped(own_public, n => {name: n, m: {k: `own}}, 0, []), outer: allegretto_scope}}, level: 1, placing: true, given: given})
header_names(params, keys, i, out) =>
  if i == count(params) then out
  else if params[i].k == `import then header_names(params, keys, i + 1, put(out, [], {name: params[i].name.name, m: {k: `bound}}))
  else header_names(params, keys, i + 1, put(out, [], {name: params[i].name.name, m: {k: `param, level: 0, index: i, role: params[i].k}}))
// `used` is the modules a notation's parts of the tree read (`from`).
// One the text does not import is a parameter after those written, and
// declared as an import is.
module_in(tree, params, keys, used, c) => module_as(tree, params, joined(unwritten(tree, params, used, 0, []), 0, params), keys, used, c)
module_as(tree, params, all, keys, used, c) =>
  {description: function(c, count(all), around(c, with_hidden(c, tree, all, used, block(tree.items, c, true, yielded(c, tree, params), false, tree.at, imports(params, c, 0, []))[0])), tree.at),
   declares: declared(all, c.given.modules, keys, []),
   keys: keys,
   findings: twice(item_names(params, 0, []), 0, [])}
unwritten(tree, params, used, i, out) =>
  if i == count(used) then out
  else if place_of_import(params, used[i], 0) >= 0 then unwritten(tree, params, used, i + 1, out)
  else unwritten(tree, params, used, i + 1, put(out, [], unwritten_import(used[i], tree.at)))
unwritten_import(name, at) => {header: true, k: `import, name: {name: name, at: at}, pairs: [], without: [], at: at}
place_of_import(params, name, i) => if i == count(params) then -1 else if params[i].k == `import && params[i].name.name == name then i else place_of_import(params, name, i + 1)

// ---- What a notation's parts read ----

// A part of the tree a notation made reads a binding of the notation's
// module with {k: `from, module, name, at}. The module is bound a second
// time for it, in a block around the module's own, under a name no text
// can write: so nothing the text binds stands between the part and what
// it reads, and the text need not import the module. The binding is the
// module as `import` with no list gives it.
hidden(name) => "use " ++ name
with_hidden(c, tree, all, used, body) => if count(used) == 0 then body else {form: `apply, function: kernel("block"), arguments: [{form: `structure, entries: hidden_entries(c, tree, all, used, 0, [])}, body]}
hidden_entries(c, tree, all, used, i, out) =>
  if i == count(used) then out
  else hidden_entries(c, tree, all, used, i + 1, put(out, symbol(hidden(used[i])), imported(c, unwritten_import(used[i], tree.at), place_of_import(all, used[i], 0), module_given(c.given.modules, used[i], 0))))
// The modules read so, each once, in the order met.
used_modules(tree) => froms_items(tree.items, 0, froms_items(tree.headers, 0, []))
// The modules a text needs emitted before it: those it imports, and those its notations' parts read.
export needed(tree) => joined(used_less(used_modules(tree), tree.headers, 0, []), 0, import_names(tree.headers, 0, []))
import_names(headers, i, out) => if i == count(headers) then out else import_names(headers, i + 1, if headers[i].k == `import then put(out, [], headers[i].name.name) else out)
used_less(used, headers, i, out) => if i == count(used) then out else used_less(used, headers, i + 1, if place_of_import(headers, used[i], 0) >= 0 then out else put(out, [], used[i]))
froms(e, out) =>
  if e.k == `from then with_name(out, e.module)
  else if e.k == `lambda then froms(e.body, out)
  else if e.k == `apply then froms_each(e.args, 0, froms(e.fn, out))
  else if e.k == `pipe then froms(e.fn, froms(e.value, out))
  else if e.k == `dot then froms(e.object, out)
  else if e.k == `index then froms(e.index, froms(e.object, out))
  else if e.k == `if then froms(e.otherwise, froms(e.then, froms(e.condition, out)))
  else if e.k == `binary then froms(e.right, froms(e.left, out))
  else if e.k == `unary then froms(e.operand, out)
  else if e.k == `record then froms_fields(e.fields, 0, out)
  else if e.k == `list then froms_each(e.items, 0, out)
  else if e.k == `block then froms_items(e.items, 0, out)
  else out
froms_each(es, i, out) => if i == count(es) then out else froms_each(es, i + 1, froms(es[i], out))
froms_fields(fs, i, out) => if i == count(fs) then out else froms_fields(fs, i + 1, froms(fs[i].value, if fs[i].k == `named then out else froms(fs[i].key, out)))
froms_pairs(pairs, i, out) => if i == count(pairs) then out else froms_pairs(pairs, i + 1, froms(pairs[i].value, out))
froms_items(items, i, out) => if i == count(items) then out else froms_items(items, i + 1, froms_item(items[i], out))
froms_item(it, out) =>
  if it.header then froms_pairs(it.pairs, 0, out)
  else if it.k == `statement then froms(it.expr, out)
  else if it.k == `function then froms(it.body, out)
  else froms(it.value, out)

declared(params, modules, i, out) =>
  if i == count(params) then out
  else if params[i].k == `import then declared(params, modules, i + 1, put(out, [], declared_module(params[i].name.name, module_given(modules, params[i].name.name, 0))))
  else declared(params, modules, i + 1, put(out, [], {role: spelling(params[i].k), name: params[i].name.name}))
declared_module(name, m) => if count(m) == 0 then {role: "module", name: name} else {role: "module", name: name, identity: m[0].identity}
module_given(modules, name, i) => if i == count(modules) then [] else if modules[i].name == name then [modules[i]] else module_given(modules, name, i + 1)

// What the module yields: the structure of its bindings, keyed by their
// names, in written order: those marked `export`, or all of them, the
// imports among them, where none is.
yielded(c, tree, params) => yielding(c, tree, kept(tree.items, i => (i.k == `binding || i.k == `function) && i.exported, 0, []), params)
yielding(c, tree, exported, params) =>
  if count(exported) > 0 then structure(c, each_yielded(item_names(exported, 0, []), 0, []), tree.at)
  else structure(c, each_yielded(in_written_order(joined(item_names(kept(params, h => h.k == `import, 0, []), 0, []), 0, item_names(kept(tree.items, is_binding, 0, []), 0, [])), 0, []), 0, []), tree.at)
each_yielded(names, i, out) => if i == count(names) then out else each_yielded(names, i + 1, put(out, symbol(names[i].name), named(names[i].name)))
// Names in the order they are written in the text.
in_written_order(names, i, out) => if i == count(names) then out else in_written_order(names, i + 1, placed_in(out, names[i], 0, []))
placed_in(sorted, n, i, out) =>
  if i == count(sorted) then put(out, [], n)
  else if sorted[i].at.start.index > n.at.start.index then joined_from(sorted, i, put(out, [], n))
  else placed_in(sorted, n, i + 1, put(out, [], sorted[i]))
joined_from(a, i, out) => if i == count(a) then out else joined_from(a, i + 1, put(out, [], a[i]))

// An import is a binding of the module's block: the imported module's
// function, which is a parameter, called with one argument for each
// capability and input it declares, in its order.
imports(params, c, i, out) =>
  if i == count(params) then out
  else if params[i].k == `import then imports(params, c, i + 1, put(out, [], import_binding(params[i], i)))
  else imports(params, c, i + 1, out)
import_binding(h, index) => {name: h.name.name, at: h.name.at, uses: free_pairs(h.pairs, 0, []), value: c => imported(c, h, index, module_given(c.given.modules, h.name.name, 0))}
imported(c, h, index, m) =>
  if count(m) == 0 then finding("the module " ++ h.name.name ++ " is imported, and its declarations and identity were not supplied: the text it is read from is emitted first", h.at)
  else faulty(misfits(h, m[0].declares), apply(c, param(c.level - 1, index), arguments(c, h, kept(m[0].declares, d => d.role != "module", 0, []), 0, []), h.at))
arguments(c, h, takes, i, out) => if i == count(takes) then out else arguments(c, h, takes, i + 1, put(out, [], argument(c, h, takes[i], handed(h.pairs, takes[i].name, 0), withheld(h.without, takes[i].name, 0), in_names(c.scope.names, takes[i].name, 0))))
handed(pairs, name, i) => if i == count(pairs) then [] else if pairs[i].name.name == name then [pairs[i].value] else handed(pairs, name, i + 1)
withheld(names, name, i) => if i == count(names) then [] else if names[i].name == name then [names[i]] else withheld(names, name, i + 1)
argument(c, h, d, given, without, mine) =>
  if count(given) > 0 then expr(given[0], c)
  else if count(without) > 0 then apply(c, kernel("refuse"), [bits_of("the capability " ++ d.name ++ " was withheld by the importing module")], without[0].at)
  else if count(mine) > 0 && mine.k == `param && (mine.role == `capability || mine.role == `input) then param(c.level - 1 - mine.level, mine.index)
  else finding(h.name.name ++ " declares the " ++ d.role ++ " " ++ d.name ++ ", which this module neither holds under that name, nor hands with with, nor withholds", h.at)
// What an import hands or withholds that the imported module does not declare, or names twice.
misfits(h, declares) => misfit_without(h, declares, 0, misfit_with(h, declares, 0, []))
declares_one(declares, name, i) => i < count(declares) && ((declares[i].role != "module" && declares[i].name == name) || declares_one(declares, name, i + 1))
misfit_with(h, declares, i, out) =>
  if i == count(h.pairs) then out
  else if !declares_one(declares, h.pairs[i].name.name, 0) then misfit_with(h, declares, i + 1, put(out, [], finding("the import of " ++ h.name.name ++ " hands " ++ h.pairs[i].name.name ++ " with with, and " ++ h.name.name ++ " declares no capability or input " ++ h.pairs[i].name.name, h.pairs[i].name.at)))
  else if earlier(item_names(h.pairs, 0, []), h.pairs[i].name.name, i, 0) then misfit_with(h, declares, i + 1, put(out, [], finding("the import of " ++ h.name.name ++ " hands " ++ h.pairs[i].name.name ++ " twice", h.pairs[i].name.at)))
  else misfit_with(h, declares, i + 1, out)
misfit_without(h, declares, i, out) =>
  if i == count(h.without) then out
  else if !declares_one(declares, h.without[i].name, 0) then misfit_without(h, declares, i + 1, put(out, [], finding("the import of " ++ h.name.name ++ " withholds " ++ h.without[i].name ++ ", and " ++ h.name.name ++ " declares no capability or input " ++ h.without[i].name, h.without[i].at)))
  else if count(handed(h.pairs, h.without[i].name, 0)) > 0 then misfit_without(h, declares, i + 1, put(out, [], finding("the import of " ++ h.name.name ++ " both hands and withholds " ++ h.without[i].name, h.without[i].at)))
  else if earlier(h.without, h.without[i].name, i, 0) then misfit_without(h, declares, i + 1, put(out, [], finding("the import of " ++ h.name.name ++ " withholds " ++ h.without[i].name ++ " twice", h.without[i].at)))
  else misfit_without(h, declares, i + 1, out)

// The module's block inside the block that binds the own functions the
// text names, and those they name in turn. With none named, the block alone.
around(c, body) => around_with(c, body, own_used(c, used_in(body, []), 0))
around_with(c, body, used) => if count(used) == 0 then body else {form: `apply, function: kernel("block"), arguments: [{form: `structure, entries: own_entries(c, c.given.own.items, used, 0, [])}, body]}
own_entries(c, items, used, i, out) =>
  if i == count(items) then out
  else if has(used, items[i].name.name, 0) then own_entries(c, items, used, i + 1, put(out, symbol(items[i].name.name), own_function(c, items[i].name.name)))
  else own_entries(c, items, used, i + 1, out)
// The own functions named, and those the ones at place i onward name, until none is added.
own_used(c, used, i) => if i == count(used) then used else own_used(c, used_in(own_function(c, used[i]), used), i + 1)

// ---- Going over a description ----

// The names of own functions a description uses, added to `out`, each once.
used_in(d, out) =>
  if d.form == `name then (if count(d) == 3 && !has(out, d.own, 0) then put(out, [], d.own) else out)
  else if d.form == `apply then used_each(d.arguments, 0, used_in(d.function, out))
  else if d.form == `function then used_in(d.body, out)
  else if d.form == `structure then used_each(d.entries, 0, out)
  else if d.form == `keyed then used_in(d.value, out)
  else if d.form == `faulty then used_in(d.inner, out)
  else out
used_each(l, i, out) => if i == count(l) then out else used_each(l, i + 1, used_in(get(l, i), out))

// The findings in a description, added to `out`, in the order met.
findings(d, out) =>
  if d.form == `finding then put(out, [], {message: d.message, at: d.at})
  else if d.form == `faulty then findings(d.inner, joined(mapped(d.findings, f => {message: f.message, at: f.at}, 0, []), 0, out))
  else if d.form == `apply then findings_each(d.arguments, 0, findings(d.function, out))
  else if d.form == `function then findings(d.body, out)
  else if d.form == `structure then findings_each(d.entries, 0, out)
  else if d.form == `keyed then findings(d.value, out)
  else out
findings_each(l, i, out) => if i == count(l) then out else findings_each(l, i + 1, findings(get(l, i), out))
