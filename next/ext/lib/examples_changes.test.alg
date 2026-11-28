// Worked examples of the parser's rules, 4 of 6: changing a grammar.
//
// Decisions: "Every production can be extended" and "Grammars combine
// without regard to order" (docs/plans/book-pass-inventory.md). The
// index is next/ext/examples.md.
capability output
import change
import engine
import grammar
import levels

lit = grammar.lit
ref = grammar.ref
seq = grammar.seq
alt = grammar.alt

reads(g, text) => !is_failure(engine.parses(engine.prepared(g), text))

// The grammar the examples change: sums of names and numbers. A name is
// letters, and not the word "if".
//
//   sum    = value ("+" value)*
//   value  = name | number
base = grammar.with_reserved(grammar.grammar(`sum, {
  sum: seq([ref(`value), grammar.star(seq([lit("+"), ref(`value)]))]),
  value: alt([ref(`name), ref(`number)]),
  name: grammar.unless(grammar.run("a name", "az"), `words),
  number: grammar.run("a number", "09")
}), `words, ["if"])
claim(reads(base, "a+1") && !reads(base, "a+(1)") && !reads(base, "if"))

// ---- "Every production can be extended" ----
//
// A change is a list of operations on rules by name. Every rule is open
// to every operation: none is marked as one that may be changed.
// `changed(g, changes)` gives another grammar; `g` is as it was.
//
// append: one more alternative for a rule. Here a value may be a sum between brackets.
brackets = [change.append(`value, seq([lit("("), ref(`sum), lit(")")]))]
claim(reads(change.changed(base, [brackets]), "a+(1+(b))"))
claim(!reads(base, "a+(1)"))
// add: a rule the grammar does not have, which another rule may then name.
texts = [change.add(`text, seq([lit("'"), grammar.run("letters", "az"), lit("'")])), change.append(`value, ref(`text))]
claim(reads(change.changed(base, [texts]), "a+'b'"))
// replace: another form in place of the rule. Names are now capitals.
claim(reads(change.changed(base, [[change.replace(`name, grammar.run("a name", "AZ"))]]), "A+1"))
claim(!reads(change.changed(base, [[change.replace(`name, grammar.run("a name", "AZ"))]]), "a+1"))
// wrap: a form around the rule's form. A number may now have a minus before it.
signed = change.changed(base, [[change.wrap(`number, form => seq([grammar.opt(lit("-")), form]))]])
claim(reads(signed, "a+-1") && !reads(signed, "-a"))
// remove: the rule is gone. A rule that still names it leaves no grammar, and the change is refused before any text is read.
claim(attempt(change.changed(base, [[change.remove(`number)]]), 100000).reason == "the rule value names the rule number, which the grammar has not")
claim(reads(change.changed(base, [[change.remove(`number), change.replace(`value, ref(`name))]]), "a+b"))
// reserve: more words for a set. "of" is now no name; "off" is.
kept_out = change.changed(base, [[change.reserve(`words, ["of"])]])
claim(!reads(kept_out, "of") && reads(kept_out, "off"))

// ---- A level, and signs, for a rule that is a row ----
//
//   e = number, with a level sum: "+"
number = grammar.run("a number", "09")
bracketed = (sign, left, right, at) => "(" ++ left ++ sign ++ right ++ ")"
rows = grammar.grammar(`e, {e: levels.row(number, [levels.level(`sum, ["+"], `left)], lit, bracketed)})
product = levels.after(levels.level(`product, ["*"], `left), [`sum])
claim(engine.parse(engine.prepared(change.changed(rows, [[change.level(`e, product)]])), "1+2*3") == "(1+(2*3))")
claim(engine.parse(engine.prepared(change.changed(rows, [[change.signs(`e, `sum, ["-"])]])), "1-2+3") == "((1-2)+3)")

// ---- "Grammars combine without regard to order" ----
//
// Several changes give the same grammar in whatever order they are
// listed. What a rule becomes is worked out in a fixed order: what
// replaces it, then levels and signs, then what is wrapped around it,
// then what is appended.
one_way = change.changed(base, [brackets, texts])
other_way = change.changed(base, [texts, brackets])
claim(reads(one_way, "(a)+'b'") && reads(other_way, "(a)+'b'"))
// Where the order would have a say, the changes conflict, and that is
// refused before any text is read. `conflicts` gives them as texts.
shout = [change.replace(`name, grammar.run("a name", "AZ"))]
digits = [change.replace(`name, grammar.run("a name", "09"))]
claim(change.conflicts(base, [shout, digits])[0] == "the rule name is replaced or wrapped twice")
claim(attempt(change.changed(base, [shout, digits]), 100000).reason == "the rule name is replaced or wrapped twice")
claim(change.conflicts(base, [texts, texts])[0] == "two changes add the rule text")
// Appending to one rule twice is no conflict: the order of alternatives has no meaning.
claim(count(change.conflicts(base, [brackets, [change.append(`value, lit("#"))]])) == 0)

output.write("examples of changes: ok")
// expect: examples of changes: ok
// end: completed
// summary: decided
