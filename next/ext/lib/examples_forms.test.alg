// Worked examples of the parser's rules, 1 of 6: a grammar and its forms.
//
// Each example names the decision it shows (docs/plans/book-pass-inventory.md,
// chapter "Parsing"), gives a grammar and a text, and claims what the
// engine reads. The suite runs every claim, so no example can drift from
// the engine. The index of all six files is next/ext/examples.md.
capability output
import class
import engine
import grammar

lit = grammar.lit
ref = grammar.ref
seq = grammar.seq
alt = grammar.alt
star = grammar.star
opt = grammar.opt

// How the examples look at a reading. A value is shown as text: what a
// terminal read as it is, a sequence or a repetition between brackets.
ways(g, text) => size(engine.parses(engine.prepared(g), text))
size(a) => if is_failure(a) then 0 else length(a.readings)
length(l) => if count(l) == 0 then 0 else 1 + length(l.t)
gives(g, text) => engine.shown(engine.parses(engine.prepared(g), text).readings.h)
stops(g, text) => engine.parses(engine.prepared(g), text).at

// ---- "Grammars are values" ----
//
// A grammar is a structure: the name of the rule a text is read as, and
// the rules by name. Nothing is declared and nothing is registered. A
// function may make one, and a grammar made from another leaves the
// first as it was.
//
//   sum    = number ("+" number)*
//   number = one digit or more
number = grammar.run("a number", "09")
sums = grammar.grammar(`sum, {sum: seq([ref(`number), star(seq([lit("+"), ref(`number)]))]), number: number})
claim(gives(sums, "1+22") == "[1 [[+ 22]]]")
// A function that gives a grammar: the same sums with another sign.
sums_with(sign) => grammar.grammar(`sum, {sum: seq([ref(`number), star(seq([lit(sign), ref(`number)]))]), number: number})
claim(ways(sums_with("&"), "1&2") == 1 && ways(sums_with("&"), "1+2") == 0)
claim(ways(sums, "1+2") == 1)

// ---- "Parsing is evaluation" ----
//
// Reading is a function call: a prepared grammar and a text go in, and
// every way the whole text can be read comes out, as data. A text that
// cannot be read gives a failure, as data too, which says the farthest
// byte a reading reached.
claim(ways(sums, "1+2+3") == 1)
claim(ways(sums, "1+") == 0 && stops(sums, "1+") == 2)
claim(engine.parses(engine.prepared(sums), "1+").failure == `no_parse)
// The whole text is read, or it is no reading: here the text goes on after a sum.
claim(ways(sums, "1+2x") == 0 && stops(sums, "1+2x") == 3)

// ---- The forms: a sequence, alternatives, a repetition, an option ----
//
// Every form gives every result it has. So every alternative is tried,
// the order they are written in has no meaning, and a repetition gives a
// result for each count.
//
//   word = "ab" | "a" "b"          "ab" is read two ways
two = grammar.grammar(`word, {word: alt([lit("ab"), seq([lit("a"), lit("b")])])})
turned = grammar.grammar(`word, {word: alt([seq([lit("a"), lit("b")]), lit("ab")])})
claim(ways(two, "ab") == 2 && ways(turned, "ab") == 2)
// The first alternative that matches does not hide a longer one.
//   s = ("a" | "ab") "c"
longer = grammar.grammar(`s, {s: seq([alt([lit("a"), lit("ab")]), lit("c")])})
claim(gives(longer, "abc") == "[ab c]" && gives(longer, "ac") == "[a c]")
// A repetition and an option after it: "aab" is two a's and none, or one and one.
//   s = "a"* "a"? "b"
counts = grammar.grammar(`s, {s: seq([star(lit("a")), opt(lit("a")), lit("b")])})
claim(ways(counts, "aab") == 2 && ways(counts, "b") == 1)

// ---- "Ambiguity is a claim" ----
//
// `parses` gives every reading. `parse` gives the one reading, and
// claims there is one: a text that reads two ways refutes the claim, and
// the fault is the grammar's. (A refuted claim is on a run's record, so
// the refuted case is in refuted_claims.test.alg.)
claim(ways(two, "ab") == 2)
claim(engine.parse(engine.prepared(sums), "1+2")[0] == "1")

// ---- A guard: what follows is looked at, and not read ----
//
// A guard reads nothing. `guard(item, true)` goes on where the item
// could be read there; `guard(item, false)` where it could not.
//
//   call  = name "(" ")"
//   plain = name, where no "(" follows
//   s     = call | plain
name = grammar.run("a name", "az")
called = grammar.grammar(`s, {s: alt([seq([name, lit("("), lit(")")]), seq([name, grammar.guard(lit("("), false)])])})
claim(gives(called, "f()") == "[f ( )]" && gives(called, "f") == "[f []]")
// Without the guard "f" would be read as a plain name with "()" left over: no reading either way, but for another reason.
claim(ways(called, "f(") == 0)

// ---- "Scannerless parsing" ----
//
// There is no pass that cuts a text into words first. A terminal reads
// bytes where the grammar comes to it, so one text may hold parts whose
// words are cut differently: here a number, and a text between quotes
// in which a digit is a letter like any other.
//
//   pair   = number "=" quoted
//   quoted = "'" bytes up to the next "'" "'"
pairs = grammar.grammar(`pair, {pair: seq([ref(`number), lit("="), lit("'"), grammar.until("the text", "'"), lit("'")]), number: number})
claim(gives(pairs, "7='it is 7'") == "[7 = ' it is 7 ']")
// Space is a terminal too. A grammar may say what space is and which terminals read it after themselves.
spaced = grammar.with_space(grammar.grammar(`sum, {sum: seq([grammar.spaced(number), star(seq([grammar.spaced(lit("+")), grammar.spaced(number)]))])}), (text, at, state) => blanks(text, at, 0), false)
blanks(text, at, n) => if grammar.byte(text, at + n) == 32 then blanks(text, at, n + 1) else n
claim(gives(spaced, "1 +  2") == "[1 [[+ 2]]]" && ways(spaced, "1+2") == 1)

// ---- "A terminal is a function, so a grammar can define its own" ----
//
// A terminal is a function from a text and a position to how many bytes
// it reads there, or -1. This one reads the letter a an even number of
// times, which no class of bytes says.
pairs_of_a(text, at, n) => if grammar.byte(text, at + n) == 97 && grammar.byte(text, at + n + 1) == 97 then pairs_of_a(text, at, n + 2) else n
even = grammar.term("an even number of a", (text, at) => if pairs_of_a(text, at, 0) == 0 then -1 else pairs_of_a(text, at, 0), true, class.pairs("aa"), false)
evens = grammar.grammar(`s, {s: seq([even, lit("b")])})
claim(gives(evens, "aaaab") == "[aaaa b]" && ways(evens, "aaab") == 0)

// ---- "Every notation stands for an expression": a form gives a value ----
//
// A form made with `giving` has a function, which makes what the form
// gives out of what it read. So a grammar's forms give whatever the
// language's meaning is written in, and the engine knows nothing of it.
// Here a sum gives its total.
total(first, more, i) => if i == count(more) then first else total(first + more[i], more, i + 1)
adding = grammar.grammar(`sum, {
  sum: grammar.giving(seq([ref(`number), star(grammar.giving(seq([lit("+"), ref(`number)]), (v, at) => v[1]))]), (v, at) => total(v[0], v[1], 0)),
  number: grammar.giving(number, (v, at) => text.int(v))})
claim(engine.parse(engine.prepared(adding), "1+22+300") == 323)

// ---- "A parser records where each expression came from in its text" ----
//
// The function of a form is handed the place the form read: the name of
// the text, and where it starts and ends, each as a byte from 0 and a
// line and a column from 1.
placed = grammar.grammar(`sum, {sum: seq([ref(`number), lit("+\n"), ref(`number)]), number: grammar.giving(number, (v, at) => at)})
second = engine.parse_of(engine.prepared(placed), "10+\n234", "sums.txt")[2]
claim(second.source == "sums.txt" && second.start.index == 4 && second.start.line == 2 && second.start.column == 1 && second.end.index == 7 && second.end.column == 4)

// ---- "Guards and reserved words separate keywords from identifiers" ----
//
// A set of reserved words has a name. A terminal made with `unless`
// reads no word of the set, so `if` is no name; `iffy` is.
words = grammar.with_reserved(grammar.grammar(`s, {s: alt([lit("if"), grammar.unless(name, `keywords)])}), `keywords, ["if", "then"])
claim(ways(words, "if") == 1 && ways(words, "iffy") == 1 && ways(words, "then") == 0)
// Without the set, "if" reads two ways: as the word and as a name.
claim(ways(grammar.grammar(`s, {s: alt([lit("if"), name])}), "if") == 2)

output.write("examples of the forms: ok")
// expect: examples of the forms: ok
// end: completed
// summary: decided
