// The module loader, written in Allegretto.
//
// Whose: the kernel stream (lane R). Chunk E9 of docs/plans/book-pass.md
// section 10. Decisions: "A module is an extension that arrives as a
// file", "The loader reaches files through a capability", "The parser
// engine and the module loader are written in Allegretto".
//
// `load(file, given)` gives the module a text is:
//
//   {module, identity, declares}         the module function, its
//                                        identity, and what it declares
//   {failure: `not_loaded, findings}     each finding {file, message}
//
// It reads the text through the capability `files`, has the reader read
// it in turns with the grammar (reader.alg), loads every module the
// text needs first, has the meaning rules write the module's function
// (meaning.alg), builds it, and makes the module through the capability
// `modules`. Loading a text performs two kinds of effect and no other:
// it reads texts, and it makes modules.
//
// Where a module is found. `import m`, and `use m.a`, name the text
// `m.alg` beside the text that names it. Where there is none, m is one
// of the platform's modules, which are handed over already made
// (`given.platform`). Where it is neither, that is a finding, at the
// line that names it. A text of the program's own hides a platform
// module of the same name.
//
// One text is one module. A text loaded through two imports is read
// once: what is loaded is carried along, and found again by its file.
// (A module that a `use` line loads is the exception, until the reader
// can hand on what it loaded: it is read again where the text also
// needs it. The kernel makes the same module of the same text, so the
// second is the first.) A text that needs itself, through whatever
// others, is refused, with the files of the circle.
//
// A module used for its notation is instantiated with every capability
// and input it declares withheld: reading one refuses. The kernel
// supplies its imports, as for any module.
//
// `given` is what the loader is handed and does not find:
//
//   platform   the platform's modules, each {name, module, identity,
//              declares}, `declares` the capabilities and inputs
//   shipped    the shipped primitives, each {name, hash} (meaning.alg)
//   own        the text of the functions Allegretto writes for itself
//   names      the kernel's primitives a text may name (meaning.alg)
capability files
capability modules
import meaning
import reader

// ---- Loading a text ----

export load(file, given) => loaded_or(loading(file, with_own(given), [], []))
loaded_or(r) => if is_failure(r) then r else {module: r.entry.module, identity: r.entry.identity, declares: r.entry.declares}
// The tree of Allegretto's own functions is read once for a loading, when a text first needs it.
with_own(given) => {platform: given.platform, shipped: given.shipped, own: reader.read(given.own, "", no_notations), names: given.names}
no_notations = {notation: path => refuse("Allegretto's own functions use no notation")}

// What loading gives: {entry, loaded}, `loaded` everything loaded so
// far, or the failure. An entry is {file, name, module, identity,
// declares}. `above` is the files being loaded, this one last.
loading(file, given, above, loaded) =>
  if count(found_file(loaded, file, 0)) > 0 then {entry: found_file(loaded, file, 0)[0], loaded: loaded}
  else if has(above, file, 0) then not_loaded(file, "the texts need each other in a circle: " ++ circle(above, file, 0))
  else from_text(file, given, put(above, [], file), loaded, files.read(file))
from_text(file, given, above, loaded, text) =>
  if is_failure(text) then (if text.failure == `absent then not_loaded(file, "there is no such text") else not_loaded(file, text.reason))
  else from_tree(file, given, above, loaded, reader.read(text, file, {notation: notation_in(file, given, above, loaded)}))
from_tree(file, given, above, loaded, tree) =>
  if is_failure(tree) then not_loaded(file, tree.findings[0].message)
  else with_needs(file, given, above, tree, needs(file, given, above, meaning.needed(tree), tree, 0, {entries: [], loaded: loaded}))
with_needs(file, given, above, tree, n) =>
  if is_failure(n) then n
  else from_meaning(file, n, meaning.module_of(tree, {shipped: given.shipped, own: given.own, modules: n.entries, names: given.names}))
from_meaning(file, n, m) =>
  if is_failure(m) then {failure: `not_loaded, findings: in_file(file, m.findings, 0, [])}
  else made(file, n, m, attempt(modules.make(build(m.description, {}), m.keys, declared(m.declares, 0)), long))
made(file, n, m, module) =>
  if is_failure(module) then not_loaded(file, "the kernel makes no module of it: " ++ module.reason)
  else entered({file: file, name: name_of(file), module: module, identity: modules.identity(module), declares: plain_declares(m.declares, 0, [])}, n.loaded)
entered(entry, loaded) => {entry: entry, loaded: put(loaded, [], entry)}
long = 2000000000

not_loaded(file, message) => {failure: `not_loaded, findings: [{file: file, message: message}]}
in_file(file, findings, i, out) => if i == count(findings) then out else in_file(file, findings, i + 1, put(out, [], {file: file, message: where(findings[i].at) ++ findings[i].message}))
where(at) => if kind(at) == `structure && count(at) == 3 then int.text(at.start.line) ++ ":" ++ int.text(at.start.column) ++ ": " else ""
has(l, x, i) => i < count(l) && (l[i] == x || has(l, x, i + 1))
found_file(loaded, file, i) => if i == count(loaded) then [] else if loaded[i].file == file then [loaded[i]] else found_file(loaded, file, i + 1)
circle(above, file, i) => if above[i] == file then listed(above, i) ++ ", " ++ file else circle(above, file, i + 1)
listed(above, i) => if i + 1 == count(above) then above[i] else above[i] ++ ", " ++ listed(above, i + 1)

// ---- What a text needs ----

// Each module the text needs, loaded, in the order the meaning rules name them: {entries, loaded}, each of
// `entries` as the meaning rules take a module, {name, declares, identity}.
needs(file, given, above, names, tree, i, out) =>
  if i == count(names) then out
  else needed(file, given, above, names, tree, i, out, found(file, given, above, names[i], out.loaded))
needed(file, given, above, names, tree, i, out, r) =>
  if is_failure(r) then (if r.failure == `nowhere then not_loaded(file, where(place_of(tree.headers, names[i], 0, tree.at)) ++ "the module " ++ names[i] ++ " is found neither as " ++ beside(file, names[i]) ++ " nor among the platform's modules") else r)
  else needs(file, given, above, names, tree, i + 1, {entries: put(out.entries, [], {name: names[i], declares: r.entry.declares, identity: r.entry.identity}), loaded: r.loaded})
place_of(headers, name, i, otherwise) => if i == count(headers) then otherwise else if headers[i].name.name == name then headers[i].at else place_of(headers, name, i + 1, otherwise)

// The module of a name, for the text of a file: the text beside it, or the platform's module, or {failure: `nowhere}.
found(file, given, above, name, loaded) => found_beside(given, name, loaded, loading(beside(file, name), given, above, loaded))
found_beside(given, name, loaded, r) =>
  if !is_failure(r) then r
  else if absent(r) then of_platform(given.platform, name, loaded, 0)
  else r
absent(r) => count(r.findings) == 1 && r.findings[0].message == "there is no such text"
of_platform(platform, name, loaded, i) =>
  if i == count(platform) then {failure: `nowhere}
  else if platform[i].name == name then {entry: platform[i], loaded: loaded}
  else of_platform(platform, name, loaded, i + 1)

// The file `name.alg` in the directory of a file, and the name of a file's module.
beside(file, name) => directory(file, bits.length(file) / 8) ++ name ++ ".alg"
directory(file, n) => if n == 0 then "" else if bits.slice(file, (n - 1) * 8, 8) == "/" then bits.slice(file, 0, n * 8) else directory(file, n - 1)
name_of(file) => without_ending(bits.slice(file, bits.length(directory(file, bits.length(file) / 8)), bits.length(file) - bits.length(directory(file, bits.length(file) / 8))))
without_ending(t) => if bits.length(t) > 32 && bits.slice(t, bits.length(t) - 32, 32) == ".alg" then bits.slice(t, 0, bits.length(t) - 32) else t

// ---- What a module declares, as the capability and the meaning rules take it ----

// One line for each declaration: its role, its name, and for an import its identity.
declared(d, i) => if i == count(d) then "" else d[i].role ++ " " ++ d[i].name ++ (if count(d[i]) == 3 then " " ++ d[i].identity else "") ++ "\n" ++ declared(d, i + 1)
// The capabilities and inputs: what an importing module hands.
plain_declares(d, i, out) => if i == count(d) then out else plain_declares(d, i + 1, if d[i].role == "module" then out else put(out, [], {role: d[i].role, name: d[i].name}))

// ---- A notation ----

// The function the reader is handed: from the path of a `use` line in the text of `file` to the notation.
// It refuses where the module is not loaded or has no such value.
notation_in(file, given, above, loaded) => path => picked(bare(found(file, given, above, path[0].name, loaded), file, path[0].name), path, 1)
picked(v, path, i) => if i == count(path) then v else picked(get(v, symbol(path[i].name)), path, i + 1)
// The module with every capability and input withheld.
bare(r, file, name) =>
  if !is_failure(r) then applied(r.entry.module, withheld(r.entry.declares, 0))
  else if r.failure == `nowhere then refuse("the module " ++ name ++ " is found neither as " ++ beside(file, name) ++ " nor among the platform's modules")
  else refuse(r.findings[0].file ++ ": " ++ r.findings[0].message)
withheld(declares, i) =>
  if i == count(declares) then []
  else {h: refuse("the " ++ declares[i].role ++ " " ++ declares[i].name ++ " is not handed to a module read for its notation"), t: withheld(declares, i + 1)}
applied(f, l) =>
  if count(l) == 0 then f()
  else if count(l.t) == 0 then f(l.h)
  else if count(l.t.t) == 0 then f(l.h, l.t.h)
  else if count(l.t.t.t) == 0 then f(l.h, l.t.h, l.t.t.h)
  else if count(l.t.t.t.t) == 0 then f(l.h, l.t.h, l.t.t.h, l.t.t.t.h)
  else if count(l.t.t.t.t.t) == 0 then f(l.h, l.t.h, l.t.t.h, l.t.t.t.h, l.t.t.t.t.h)
  else if count(l.t.t.t.t.t.t) == 0 then f(l.h, l.t.h, l.t.t.h, l.t.t.t.h, l.t.t.t.t.h, l.t.t.t.t.t.h)
  else refuse("a module read for its notation declares more than six capabilities and inputs")
