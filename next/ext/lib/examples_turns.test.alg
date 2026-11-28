// Worked examples of the parser's rules, 5 of 6: a text that changes
// the grammar it is read in, and what a notation may do.
//
// Decisions: "A text can change the grammar it is read in", "A grammar
// change reaches to the end of its block", "A notation a text uses can
// only add" (docs/plans/book-pass-inventory.md). The same rules at work
// in Allegretto, with `use`, are the texts of next/ext/examples/. The
// index is next/ext/examples.md.
capability output
import change
import class
import engine
import grammar

lit = grammar.lit
ref = grammar.ref
seq = grammar.seq
alt = grammar.alt

size(a) => if is_failure(a) then 0 else length(a.readings)
length(l) => if count(l) == 0 then 0 else 1 + length(l.t)

// A tiny language. A text is lines; a line is the letter a, a line
// `+x` that asks for the letter x to be a line from then on, or lines
// between brackets.
//
//   text  = lines
//   lines = line, and a line after each line end      (grammar.turns)
//   line  = "a" | "+" letter | "(" lines ")"
//
// `turns` is a repetition whose lines may ask for a change. The last of
// its four parts says which lines ask: here a line that gave a structure.
letters = grammar.grammar(`text, {
  text: seq([ref(`lines), grammar.end]),
  lines: grammar.turns(`lines, ref(`line), lit("\n"), v => if kind(v) == `structure && count(v) == 1 && kind(key(v, 0)) == `symbol then [v] else []),
  line: alt([lit("a"), grammar.giving(seq([lit("+"), grammar.one("a letter", "bz")]), (v, at) => {add: v[1]}), seq([lit("(\n"), ref(`lines), lit("\n)")])])})
ready = engine.prepared(letters)

// ---- "A text can change the grammar it is read in" ----
//
// Whoever begins a reading hands the engine a function. Where a line
// asks, the engine hands the function the grammar held and what the line
// asked, and reads the lines after it in the grammar the function gives
// back. Nothing is scanned ahead: the change is made when its line has
// been read. Here the function appends the letter to what a line may be.
adding = (held, asked) => held_as(change.changed(held, [[change.append(`line, lit(asked.add))]]), false)
held_as(g, beside) => {held: g, prepared: engine.prepared(g), beside: beside}
read(text) => size(engine.parses_with(ready, text, "", letters, adding))
// The change holds from the line after it: not before it, and not on its own line.
claim(read("+b\nb\na\nb") == 1)
claim(read("b\n+b") == 0)
// The prepared grammar is as it was: a change gives another grammar, and the next text begins anew.
claim(read("b") == 0)
// A reading begun with no such function takes no change, and says so.
claim(attempt(size(engine.parses(ready, "+b\nb")), 100000).reason == "a line asks for a change of the grammar, and whoever began the reading takes none")
// The right to change the grammar is the grammar's a reading begins with. A change a notation brings may hold no lines that ask.
again = [change.append(`line, grammar.turns(`line, lit("x"), lit(";"), v => []))]
claim(change.breaches(letters, again, {rules: [`line], words: []})[0] == "the notation brings lines that change the grammar, in the rule line: that right is the grammar's a reading began with")

// ---- "A grammar change reaches to the end of its block" ----
//
// A change holds for the lines it was made among, and the lines inside
// them. Here the brackets are a block.
// Made between the brackets, it holds there and not after them.
claim(read("(\n+b\nb\n)\na") == 1)
claim(read("(\n+b\nb\n)\nb") == 0)
// Made before the brackets, it holds between them and after them.
claim(read("+b\n(\nb\n)\nb") == 1)

// ---- "A notation a text uses can only add": checked on the grammar ----
//
// A notation is a list of changes that a text brings in. `used` gives
// the grammar changed by one, or refuses it. The text may name rules the
// notation is meant to change.
named(rules) => {rules: rules, words: []}
// It may add a rule and append to one.
claim(!is_failure(attempt(count(change.used(letters, [change.append(`line, lit("b"))], named([])).rules), 100000)))
// It replaces a rule it did not add only where the text names the rule.
claim(attempt(change.used(letters, [change.replace(`line, lit("b"))], named([])), 100000).reason == "the notation changes the rule line, which it did not add and the text does not name")
claim(!is_failure(attempt(count(change.used(letters, [change.replace(`line, lit("b"))], named([`line])).rules), 100000)))
// It adds no word to a set of reserved words a rule in force keeps out, unless the text names the word.
name = grammar.unless(grammar.run("a name", "az"), `words)
worded = grammar.with_reserved(grammar.grammar(`s, {s: name}), `words, ["if"])
claim(change.breaches(worded, [change.reserve(`words, ["of"])], named([]))[0] == "the notation reserves the word of, which the text does not name")
claim(count(change.breaches(worded, [change.reserve(`words, ["of"])], {rules: [], words: ["of"]})) == 0)

// A terminal it brings keeps a state only in a part of the state that the notation adds itself.
counting = grammar.stepper("a count", `seen, (text, at, n) => if grammar.byte(text, at) == 115 && n < 2 then {read: 1, state: n + 1} else [], true, class.pairs("ss"), false)
claim(change.breaches(letters, [change.append(`line, counting)], named([]))[0] == "the notation brings a terminal that reads or changes the part seen of the state, which it does not add, in the rule line")
claim(count(change.breaches(letters, [change.part(`seen, 0), change.append(`line, counting)], named([]))) == 0)
// The part begins where the change is made: the line `s` is read twice after `+s`, and no more.
counted = (held, asked) => held_as(change.changed(held, [[change.part(`seen, 0), change.append(`line, counting)]]), false)
claim(size(engine.parses_with(ready, "+s\ns\ns", "", letters, counted)) == 1 && size(engine.parses_with(ready, "+s\ns\ns\ns", "", letters, counted)) == 0)

// ---- "A notation a text uses can only add": checked on the text ----
//
// Where a change asks for it (`beside`), each line after it is read in
// the grammar before it as well. Each reading the line had there must
// still be among its readings to the same end. This is how a notation
// that only adds is held to adding: what the text meant before, it
// means after, or the text is refused.
//
// `+w` puts brackets around what every line gives: every line means
// something else. `+b` only adds.
watched = (held, asked) => if asked.add == "w" then held_as(change.changed(held, [[change.wrap(`line, f => grammar.giving(f, (v, at) => [v]))]]), true) else held_as(change.changed(held, [[change.append(`line, lit(asked.add))]]), true)
watch(text) => attempt(size(engine.parses_with(ready, text, "", letters, watched)), 400000)
// A line the grammar before could not read (b), and a line both read alike (a): no harm.
claim(watch("+b\nb\na") == 1)
// A line both read, and no longer as it was: refused, with the place and both readings.
claim(watch("+w\na").reason == "the line that ends at 2:2 reads one way before the change of the grammar and another after it. Before: a After: (a)")
// The same change where no comparison was asked for goes through: this is `use` with `changing`.
unwatched = (held, asked) => held_as(change.changed(held, [[change.wrap(`line, f => grammar.giving(f, (v, at) => [v]))]]), false)
claim(size(engine.parses_with(ready, "+w\na", "", letters, unwatched)) == 1)

// ---- What is alike ----
//
// Two readings are alike where they are the same bits or the same
// symbol, or structures with the same keys in the same order and
// entries that are alike. A place, an entry keyed `at`, is left out. A
// language whose line `a` gives a structure, and whose line `!` asks
// for the rule of a line to be replaced by one that gives another:
keyed_line(made) => alt([grammar.giving(lit("a"), (v, at) => made(v)), grammar.giving(lit("!"), (v, at) => `go)])
keyed = grammar.grammar(`lines, {lines: grammar.turns(`lines, ref(`line), lit(";"), v => if kind(v) == `symbol then [v] else []), line: keyed_line(v => {p: v})})
replacing(made) => (held, asked) => held_as(change.changed(held, [[change.replace(`line, keyed_line(made))]]), true)
after(made) => attempt(size(engine.parses_with(engine.prepared(keyed), "!;a", "", keyed, replacing(made))), 400000)
// The same structure: alike.
claim(after(v => {p: v}) == 1)
// Another key, and another leaf: not alike.
claim(after(v => {q: v}).reason == "the line that ends at 1:4 reads one way before the change of the grammar and another after it. Before: (p:a) After: (q:a)")
claim(after(v => {p: "b"}).reason == "the line that ends at 1:4 reads one way before the change of the grammar and another after it. Before: (p:a) After: (p:b)")
// A reading added beside the one the line keeps is let by here. The text then reads two ways, and whoever
// asked for its one reading is told so at the end, as for any text that reads two ways.
beside_it = (held, asked) => held_as(change.changed(held, [[change.append(`line, grammar.giving(lit("a"), (v, at) => {q: v}))]]), true)
claim(size(engine.parses_with(engine.prepared(keyed), "!;a", "", keyed, beside_it)) == 2)

output.write("examples of turns: ok")
// expect: examples of turns: ok
// end: completed
// summary: decided
