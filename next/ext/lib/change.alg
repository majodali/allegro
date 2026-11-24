// Changes to a grammar, written in Allegretto.
//
// Whose: the kernel stream (lane R). Decisions: "Every production can be
// extended", "Grammars combine without regard to order", "A notation a
// text uses can only add" (docs/plans/book-pass.md section 10).
//
// A change is a structure with no keys of operations on rules by name.
// Every rule is open to them; none is marked as one that may be changed.
//
//   add(name, form)        a rule the grammar does not have
//   append(name, form)     one more item for the rule: it becomes an
//                          `alt` of what it was and the form
//   replace(name, form)    the form in place of the rule
//   remove(name)           the rule is gone
//   wrap(name, around)     around(form) in place of the rule's form
//   reserve(set, words)    more words for a reserved set
//
// `changed(g, changes)` gives the grammar with every change of a list
// made. The grammar it is given is untouched: a grammar is a value.
// Changes give the same grammar in whatever order they are listed, or
// they conflict, and a conflict is refused here, before any text is
// read. `conflicts(g, changes)` gives the conflicts as texts, and none
// where there is none. These conflict:
//
//   two changes add a rule of one name, or one adds a rule the grammar has
//   a change to a rule the grammar has not and no change adds
//   a rule replaced or wrapped twice
//   a rule replaced or wrapped, and also appended to, removed or added
//   a rule removed, and also appended to or added
//
// Appending to one rule twice is no conflict, since the order of the
// items of an `alt` has no meaning; nor is appending to a rule another
// change adds, nor removing a rule twice.
//
// `used(g, change, named)` is for a notation a text brings in, which
// can only add. `named` is {rules, words}: the names of rules and the
// words that the using text itself names. It gives the changed grammar,
// or refuses; `breaches(g, change, named)` gives what it would refuse
// for, as texts. All of it is read off the grammar and the change: no
// text is parsed. A breach is one of:
//
//   it replaces, removes or wraps a rule it did not add, and the rule
//   is not named
//   it appends to a rule that a rule in force tests with a guard that
//   holds where the rule cannot be read, and the rule is not named
//   it adds a word to a reserved set a terminal in force keeps out, and
//   the word is not named
//   a form it brings has a terminal that reads or changes the state,
//   and its rule is not named
//
// The decision's first rule, that neither longest match nor precedence
// prefers between an item in force and an added one, needs no check:
// the engine tries every item and keeps every result, so an added item
// can only add a reading, and a text that then reads two ways refutes
// the claim that it reads one way.
import grammar

export add(name, form) => {op: `add, name: name, form: form}
export append(name, form) => {op: `append, name: name, form: form}
export replace(name, form) => {op: `replace, name: name, form: form}
export remove(name) => {op: `remove, name: name, form: []}
export wrap(name, around) => {op: `wrap, name: name, form: around}
export reserve(set, words) => {op: `reserve, name: set, form: words}

// ---- Small things on structures with no keys ----

has(l, x, i) => i < count(l) && (l[i] == x || has(l, x, i + 1))
has_key(s, k, i) => i < count(s) && (key(s, i) == k || has_key(s, k, i + 1))
joined(a, i, out) => if i == count(a) then out else joined(a, i + 1, put(out, [], a[i]))
// Every operation of every change, as one list.
all(changes, i, out) => if i == count(changes) then out else all(changes, i + 1, joined(changes[i], 0, out))
// How many operations of the kind `op` are on the name.
how_many(ops, op, name, i, n) =>
  if i == count(ops) then n
  else how_many(ops, op, name, i + 1, if ops[i].op == op && ops[i].name == name then n + 1 else n)
// The names the operations are on, each once, reserved sets left out.
names_of(ops, i, out) =>
  if i == count(ops) then out
  else if ops[i].op == `reserve || has(out, ops[i].name, 0) then names_of(ops, i + 1, out)
  else names_of(ops, i + 1, put(out, [], ops[i].name))

// ---- Conflicts ----

export conflicts(g, changes) => conflicts_in(g, all(changes, 0, []))
conflicts_in(g, ops) => each_name(g, ops, names_of(ops, 0, []), 0, [])
each_name(g, ops, names, i, out) =>
  if i == count(names) then out
  else each_name(g, ops, names, i + 1, judged(g, names[i], has_key(g.rules, names[i], 0), how_many(ops, `add, names[i], 0, 0), how_many(ops, `append, names[i], 0, 0), how_many(ops, `replace, names[i], 0, 0) + how_many(ops, `wrap, names[i], 0, 0), how_many(ops, `remove, names[i], 0, 0), out))
// `had`: the grammar has the rule. Then how many operations add it,
// append to it, replace or wrap it, and remove it.
judged(g, name, had, adds, appends, remakes, removes, out) =>
  if adds > 1 then put(out, [], "two changes add the rule " ++ spelling(name))
  else if adds == 1 && had then put(out, [], "a change adds the rule " ++ spelling(name) ++ ", which the grammar has")
  else if adds == 0 && !had then put(out, [], "a change is to the rule " ++ spelling(name) ++ ", which the grammar has not")
  else if remakes > 1 then put(out, [], "the rule " ++ spelling(name) ++ " is replaced or wrapped twice")
  else if remakes == 1 && (appends > 0 || removes > 0 || adds > 0) then put(out, [], "the rule " ++ spelling(name) ++ " is replaced or wrapped, and changed besides")
  else if removes > 0 && (appends > 0 || adds > 0) then put(out, [], "the rule " ++ spelling(name) ++ " is removed, and changed besides")
  else out

// ---- Making the changes ----

export changed(g, changes) => made(g, all(changes, 0, []), conflicts(g, changes))
made(g, ops, found) =>
  if count(found) > 0 then refuse(found[0])
  else reserved(grammar.with_rules(g, added(ops, 0, kept(g.rules, ops, 0, []), ops)), ops, 0)
// The rules the grammar has, each as the operations leave it.
kept(rules, ops, i, out) =>
  if i == count(rules) then out
  else if how_many(ops, `remove, key(rules, i), 0, 0) > 0 then kept(rules, ops, i + 1, out)
  else kept(rules, ops, i + 1, put(out, key(rules, i), remade(get(rules, i), key(rules, i), ops, 0)))
// The rules the operations add, each with what is appended to it.
added(ops, i, out, every) =>
  if i == count(ops) then out
  else if ops[i].op == `add then added(ops, i + 1, put(out, ops[i].name, remade(ops[i].form, ops[i].name, every, 0)), every)
  else added(ops, i + 1, out, every)
// A form after every operation on its name.
remade(form, name, ops, i) =>
  if i == count(ops) then form
  else if ops[i].name != name || ops[i].op == `reserve then remade(form, name, ops, i + 1)
  else if ops[i].op == `replace then remade(ops[i].form, name, ops, i + 1)
  else if ops[i].op == `wrap then remade(wrapped(ops[i].form, form), name, ops, i + 1)
  else if ops[i].op == `append then remade(with_item(form, ops[i].form), name, ops, i + 1)
  else remade(form, name, ops, i + 1)
wrapped(around, form) => around(form)
// One more item: in the `alt` itself where the form is one that gives
// what its items give, and in an `alt` around the form otherwise.
with_item(form, item) =>
  if form.op == `alt && kind(form.gives) != `function then grammar.alt(put(form.items, [], item))
  else grammar.alt([form, item])
reserved(g, ops, i) =>
  if i == count(ops) then g
  else if ops[i].op == `reserve then reserved(grammar.with_reserved(g, ops[i].name, ops[i].form), ops, i + 1)
  else reserved(g, ops, i + 1)

// ---- A notation can only add ----

export used(g, change, named) => allowed(g, change, breaches(g, change, named))
allowed(g, change, found) => if count(found) > 0 then refuse(found[0]) else changed(g, [change])

export breaches(g, change, named) => breach(g, change, named, tested(g.rules, 0, []), 0, [])
breach(g, change, named, tested_names, i, out) =>
  if i == count(change) then out
  else breach(g, change, named, tested_names, i + 1, weighed(g, change, named, tested_names, change[i], out))
weighed(g, change, named, tested_names, o, out) =>
  if o.op == `reserve then barred_words(g, o.name, o.form, named.words, 0, out)
  else if has(named.rules, o.name, 0) then out
  else if (o.op == `replace || o.op == `remove || o.op == `wrap) && how_many(change, `add, o.name, 0, 0) == 0 then put(out, [], "the notation changes the rule " ++ spelling(o.name) ++ ", which it did not add and the text does not name")
  else if o.op == `append && has(tested_names, o.name, 0) then put(out, [], "the notation adds to the rule " ++ spelling(o.name) ++ ", which a rule in force tests cannot be read")
  else if (o.op == `add || o.op == `append || o.op == `replace) && touches(o.form) then put(out, [], "the notation brings a terminal that reads or changes the state, in the rule " ++ spelling(o.name))
  else out
// A word added to a set that a terminal in force keeps out.
barred_words(g, set, words, named_words, i, out) =>
  if i == count(words) || !keeps_out(g.rules, set, 0) then out
  else if has(named_words, words[i], 0) then barred_words(g, set, words, named_words, i + 1, out)
  else barred_words(g, set, words, named_words, i + 1, put(out, [], "the notation reserves the word " ++ words[i] ++ ", which the text does not name"))
keeps_out(rules, set, i) => i < count(rules) && (form_keeps_out(get(rules, i), set) || keeps_out(rules, set, i + 1))
form_keeps_out(f, set) =>
  if f.op == `term then kind(f.unless) == `symbol && f.unless == set
  else if f.op == `ref then false
  else if f.op == `seq || f.op == `alt then any_keeps_out(f.items, set, 0)
  else form_keeps_out(f.item, set)
any_keeps_out(items, set, i) => i < count(items) && (form_keeps_out(items[i], set) || any_keeps_out(items, set, i + 1))
// True where a form holds a terminal that reads or changes the state.
touches(f) =>
  if f.op == `term then f.stateful
  else if f.op == `ref then false
  else if f.op == `seq || f.op == `alt then any_touches(f.items, 0)
  else touches(f.item)
any_touches(items, i) => i < count(items) && (touches(items[i]) || any_touches(items, i + 1))

// The names of the rules that a guard in force tests cannot be read:
// each rule that can be reached from the item of a guard whose `holds`
// is false, through whatever rules.
tested(rules, i, out) => if i == count(rules) then out else tested(rules, i + 1, tested_in(rules, get(rules, i), false, out))
// `under` is true inside such a guard: there every rule named is noted, and followed once.
tested_in(rules, f, under, out) =>
  if f.op == `term then out
  else if f.op == `ref then (if under && !has(out, f.name, 0) && has_key(rules, f.name, 0) then tested_in(rules, get(rules, f.name), true, put(out, [], f.name)) else out)
  else if f.op == `seq || f.op == `alt then tested_items(rules, f.items, under, 0, out)
  else if f.op == `guard then tested_in(rules, f.item, under || !f.holds, out)
  else tested_in(rules, f.item, under, out)
tested_items(rules, items, under, i, out) => if i == count(items) then out else tested_items(rules, items, under, i + 1, tested_in(rules, items[i], under, out))
