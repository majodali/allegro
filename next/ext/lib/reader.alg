// Reading a text of Allegretto in turns with its grammar.
//
// Whose: the kernel stream (lane R). Chunk E8 of docs/plans/book-pass.md
// section 10. Decisions: "A text can change the grammar it is read in",
// "A grammar change reaches to the end of its block", "A notation a text
// uses can only add".
//
// `read(text, name, given)` gives the tree of a text (allegretto.alg), or
//
//   {failure: `not_read, findings}       each finding {message, at}
//
// A line `use m.a` asks for a change of the grammar. The engine hands
// what the line asks to this module, which reads the text of the module
// m, has the meaning rules write its function, builds it, and makes an
// instance with no capability and no input. `m.a` of that instance is a
// notation: a list of changes (change.alg). The grammar in force is
// changed by it, as far as a notation may change one. The lines after
// the `use`, to the end of its block, are read in that grammar. A `use`
// with no `changing` only adds, and the engine reads each of those
// lines in the grammar before it as well: a line that no longer has the
// reading it had is refused. A `use` with `changing` may replace,
// remove or wrap the rules it names, and its lines are not compared.
// So the text of m is read while this text is being read, and nothing
// is scanned ahead.
//
// The right to change the grammar is the grammar's a reading begins
// with: Allegretto's, whose lines are the one form that asks. A change a
// notation brings holds no such form (`change.used` refuses it), so no
// notation changes the grammar again.
//
// `given` is what a text does not say, until a loader finds texts:
//
//   texts     the texts a `use` may name, each {name, text}
//   shipped   the shipped primitives, each {name, hash} (meaning.alg)
//   own       the tree of Allegretto's own functions (meaning.alg)
//
// A module of the engine's own (grammar, change, levels and the rest)
// is not read again where a text that is used imports it: the instance
// this module holds is handed over. A module that is used and has a key
// waits for the loader, since only the kernel makes a key.
import allegretto
import analysis
import change
import class
import engine
import grammar
import levels
import map
import meaning
import offside
import set

base = engine.prepared(allegretto.language)
// The steps an attempt may take: more than any reading here takes.
long = 2000000000

export read(text, name, given) => read_in(text, name, given, [])
// `above` is the modules being read for their notation, this text among them: a module that uses itself, through whatever others, is refused.
read_in(text, name, given, above) => answered(attempt(engine.parses_with(base, text, name, allegretto.language, taking(given, above)), long))
answered(a) =>
  if !is_failure(a) then (if count(a.readings.t) > 0 then unread("the text reads two ways", []) else a.readings.h)
  else if a.failure == `no_parse then unread("no reading at " ++ int.text(a.at), [])
  else unread(a.reason, [])
unread(message, at) => {failure: `not_read, findings: [{message: message, at: at}]}

// What the engine is handed where a line asks: the grammar held, changed by the notation the line names.
taking(given, above) => (held, asked) => taken(held, asked, attempt(changed_grammar(held, asked, notation(given, asked.path, above)), long))
taken(held, asked, g) => if is_failure(g) then {failure: `no_change, reason: line_column(asked.at) ++ ": use " ++ asked.name.name ++ ": " ++ g.reason} else {held: g, prepared: engine.prepared(g), beside: count(asked.changing) == 0}
line_column(at) => int.text(at.start.line) ++ ":" ++ int.text(at.start.column)
// The grammar is worked out here, inside the attempt: a grammar is a value whose parts are read late.
// A `use` with no `changing` only adds, and its lines are compared with the grammar before it. One with
// `changing` means to change what the rules it names read, and is checked on the grammar alone.
changed_grammar(held, asked, n) =>
  if count(asked.changing) == 0 then whole(change.used_compared(held, n))
  else whole(change.used(held, n, {rules: rule_names(asked.changing, 0, []), words: words(asked.changing, 0, [])}))
whole(g) => then(count(analysis.errors(g)), g)
rule_names(names, i, out) => if i == count(names) then out else rule_names(names, i + 1, put(out, [], symbol(names[i].name)))
words(names, i, out) => if i == count(names) then out else words(names, i + 1, put(out, [], names[i].name))

// ---- The notation a line names ----

notation(given, path, above) => a_notation(path, picked(bare(given, path[0].name, above).instance, path, 1))
picked(v, path, i) => if i == count(path) then v else picked(get(v, symbol(path[i].name)), path, i + 1)
a_notation(path, n) => if kind(n) == `structure && changes_only(n, 0) then n else refuse(path_text(path, 0) ++ " is no notation: a notation is a list of changes to a grammar")
changes_only(n, i) => i == count(n) || (kind(n[i]) == `structure && count(n[i]) == 3 && kind(key(n[i], 0)) == `symbol && key(n[i], 0) == `op && changes_only(n, i + 1))
path_text(path, i) => if i + 1 == count(path) then path[i].name else path[i].name ++ "." ++ path_text(path, i + 1)

// ---- A module read for its notation ----

// {name, declares, identity, fn, instance}. `fn` takes one argument for
// each capability and input the module declares, as an importing module
// hands them; `instance` is the module with every one withheld.
bare(given, name, above) =>
  if has(above, name, 0) then refuse("the module " ++ name ++ " is used while it is being read for its notation")
  else if count(own_module(name)) > 0 then own_module(name)[0]
  else bare_text(given, name, above, text_of(given.texts, name, 0))
has(l, x, i) => i < count(l) && (l[i] == x || has(l, x, i + 1))
text_of(texts, name, i) => if i == count(texts) then [] else if texts[i].name == name then [texts[i].text] else text_of(texts, name, i + 1)
bare_text(given, name, above, t) =>
  if count(t) == 0 then refuse("the text of the module " ++ name ++ " was not handed to the reader")
  else bare_tree(given, name, put(above, [], name), read_in(t[0], name ++ ".alg", given, put(above, [], name)))
bare_tree(given, name, above, tree) =>
  if is_failure(tree) then refuse("the module " ++ name ++ " is not read: " ++ tree.findings[0].message)
  else bare_module(given, name, tree, needed(given, meaning.needed(tree), above, 0, []))
needed(given, names, above, i, out) => if i == count(names) then out else needed(given, names, above, i + 1, put(out, [], bare(given, names[i], above)))
bare_module(given, name, tree, deps) => bare_built(name, meaning.module_of(tree, {shipped: given.shipped, own: given.own, modules: deps}), deps)
bare_built(name, m, deps) =>
  if is_failure(m) then refuse("the module " ++ name ++ " is no module: " ++ m.findings[0].message)
  else if m.keys > 0 then refuse("the module " ++ name ++ " has a key: a module that is used is instantiated by the loader, which is not written yet")
  else bare_made(name, m.declares, build(m.description, {}), deps)
bare_made(name, declares, built, deps) => bare_with(name, declares, closed(built, declares, deps))
bare_with(name, declares, fn) => {name: name, declares: declares, identity: "", fn: fn, instance: applied(fn, withheld(declares, 0))}

// The function a module's text gives takes an argument for everything
// the module declares, its imports among them. An importing module
// hands only capabilities and inputs, and the kernel supplies a
// module's imports. Here the imports are supplied by hand.
closed(built, declares, deps) => taking_args(handed(declares, 0, 0), args => applied(built, every(declares, deps, args, 0)))
handed(declares, i, n) => if i == count(declares) then n else handed(declares, i + 1, if declares[i].role == "module" then n else n + 1)
taking_args(n, f) =>
  if n == 0 then () => f([])
  else if n == 1 then (a) => f({h: a, t: []})
  else if n == 2 then (a, b) => f({h: a, t: {h: b, t: []}})
  else if n == 3 then (a, b, d) => f({h: a, t: {h: b, t: {h: d, t: []}}})
  else if n == 4 then (a, b, d, e) => f({h: a, t: {h: b, t: {h: d, t: {h: e, t: []}}}})
  else refuse("a module read for its notation declares more than four capabilities and inputs")
// An argument for each declaration, in order: an import's module, or the next argument handed.
every(declares, deps, args, i) =>
  if i == count(declares) then []
  else if declares[i].role == "module" then {h: dep(deps, declares[i].name, 0).fn, t: every(declares, deps, args, i + 1)}
  else {h: args.h, t: every(declares, deps, args.t, i + 1)}
dep(deps, name, i) => if deps[i].name == name then deps[i] else dep(deps, name, i + 1)
applied(f, l) =>
  if count(l) == 0 then f()
  else if count(l.t) == 0 then f(l.h)
  else if count(l.t.t) == 0 then f(l.h, l.t.h)
  else if count(l.t.t.t) == 0 then f(l.h, l.t.h, l.t.t.h)
  else if count(l.t.t.t.t) == 0 then f(l.h, l.t.h, l.t.t.h, l.t.t.t.h)
  else if count(l.t.t.t.t.t) == 0 then f(l.h, l.t.h, l.t.t.h, l.t.t.t.h, l.t.t.t.t.h)
  else if count(l.t.t.t.t.t.t) == 0 then f(l.h, l.t.h, l.t.t.h, l.t.t.t.h, l.t.t.t.t.h, l.t.t.t.t.t.h)
  else refuse("a module read for its notation declares more than six things")
// Each capability and input withheld: reading one refuses.
withheld(declares, i) =>
  if i == count(declares) then []
  else if declares[i].role == "module" then withheld(declares, i + 1)
  else {h: refuse("the " ++ declares[i].role ++ " " ++ declares[i].name ++ " is not handed to a module read for its notation"), t: withheld(declares, i + 1)}

// The engine's own modules, as this module holds them.
own_module(name) =>
  if name == "grammar" then [held("grammar", grammar)] else if name == "change" then [held("change", change)] else if name == "levels" then [held("levels", levels)]
  else if name == "class" then [held("class", class)] else if name == "engine" then [held("engine", engine)] else if name == "analysis" then [held("analysis", analysis)]
  else if name == "set" then [held("set", set)] else if name == "map" then [held("map", map)] else if name == "offside" then [held("offside", offside)]
  else if name == "allegretto" then [held("allegretto", allegretto)] else if name == "meaning" then [held("meaning", meaning)]
  else []
held(name, instance) => {name: name, declares: [], identity: "", fn: () => instance, instance: instance}
