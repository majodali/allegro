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
// what the line asks to this module, which asks `given.notation` for
// the notation the line names: the names of its path, the first of them
// the module's. The loader gives that function (loader.alg): it loads
// the module while this text is being read, and takes the notation from
// an instance with no capability and no input. The grammar in force is
// changed by the notation, as far as a notation may change one. The
// lines after the `use`, to the end of its block, are read in that
// grammar. A `use` with no `changing` only adds, and the engine reads
// each of those lines in the grammar before it as well: a line that no
// longer has the reading it had is refused. A `use` with `changing` may
// replace, remove or wrap the rules it names, and its lines are not
// compared. Nothing is scanned ahead.
//
// The right to change the grammar is the grammar's a reading begins
// with: Allegretto's, whose lines are the one form that asks. A change a
// notation brings holds no such form (`change.used` refuses it), so no
// notation changes the grammar again.
//
// `given` is {notation}: a function from the path of a `use` line to
// the notation, which refuses where there is none. A text with no `use`
// never calls it.
import allegretto
import analysis
import change
import engine

base = engine.prepared(allegretto.language)
// The steps an attempt may take: more than any reading here takes.
long = 2000000000

export read(text, name, given) => answered(attempt(engine.parses_with(base, text, name, allegretto.language, taking(given)), long))
answered(a) =>
  if !is_failure(a) then (if count(a.readings.t) > 0 then unread("the text reads two ways", []) else a.readings.h)
  else if a.failure == `no_parse then unread("no reading at " ++ int.text(a.at), [])
  else unread(a.reason, [])
unread(message, at) => {failure: `not_read, findings: [{message: message, at: at}]}

// What the engine is handed where a line asks: the grammar held, changed by the notation the line names.
taking(given) => (held, asked) => taken(held, asked, attempt(changed_grammar(held, asked, a_notation(asked.path, given.notation(asked.path))), long))
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

a_notation(path, n) => if kind(n) == `structure && changes_only(n, 0) then n else refuse(path_text(path, 0) ++ " is no notation: a notation is a list of changes to a grammar")
changes_only(n, i) => i == count(n) || (kind(n[i]) == `structure && count(n[i]) == 3 && kind(key(n[i], 0)) == `symbol && key(n[i], 0) == `op && changes_only(n, i + 1))
path_text(path, i) => if i + 1 == count(path) then path[i].name else path[i].name ++ "." ++ path_text(path, i + 1)
