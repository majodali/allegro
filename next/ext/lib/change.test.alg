// Tests of next/ext/lib/change.alg.
capability output
import change
import class
import engine
import grammar

lit = grammar.lit
ref = grammar.ref
seq = grammar.seq
alt = grammar.alt

// A small language: a value is a name or a number; a name is letters,
// and not the word "if"; a sum is values with + between.
name = grammar.unless(grammar.run("a name", "az"), `words)
base = grammar.with_reserved(grammar.grammar(`sum, {
  sum: seq([ref(`value), grammar.star(seq([lit("+"), ref(`value)]))]),
  value: alt([ref(`name), ref(`number)]),
  name: name,
  number: grammar.run("a number", "09"),
  plain: seq([grammar.guard(ref(`number), false), ref(`name)])
}), `words, ["if"])
reads(g, text) => !is_failure(engine.parses(engine.prepared(g), text))
ways(g, text) => length(engine.parses(engine.prepared(g), text).readings)
length(l) => if count(l) == 0 then 0 else 1 + length(l.t)
claim(reads(base, "a+1") && !reads(base, "a+(1)") && !reads(base, "if"))

// ---- The five changes ----
// Append: one more item for a rule.
brackets = [change.append(`value, seq([lit("("), ref(`sum), lit(")")]))]
with_brackets = change.changed(base, [brackets])
claim(reads(with_brackets, "a+(1+(b))") && reads(with_brackets, "a+1"))
claim(count(with_brackets.rules.value.items) == 3)
// The grammar it was made from is untouched.
claim(!reads(base, "a+(1)") && count(base.rules.value.items) == 2)
// Add: a rule the grammar does not have, which another rule may then name.
texts = [change.add(`text, seq([lit("'"), grammar.run("letters", "az"), lit("'")])), change.append(`value, ref(`text))]
with_texts = change.changed(base, [texts])
claim(reads(with_texts, "a+'b'") && count(with_texts.rules) == 6)
// Replace: the form in place of the rule.
upper = change.changed(base, [[change.replace(`name, grammar.run("a name", "AZ"))]])
claim(reads(upper, "A+1") && !reads(upper, "a+1"))
// Remove: the rule is gone.
claim(count(change.changed(base, [[change.remove(`plain)]]).rules) == 4)
// Wrap: a form around the rule's form.
signed = change.changed(base, [[change.wrap(`number, form => seq([grammar.opt(lit("-")), form]))]])
claim(reads(signed, "a+-1") && reads(signed, "1") && !reads(signed, "-a"))
// Reserve: more words for a set.
kept_out = change.changed(base, [[change.reserve(`words, ["of"])]])
claim(!reads(kept_out, "of") && !reads(kept_out, "if") && reads(kept_out, "off"))
// An item appended to a rule that is not an alt, and to one that gives something.
claim(reads(change.changed(base, [[change.append(`number, lit("#"))]]), "a+#"))
given = grammar.with_rules(base, put(base.rules, `value, grammar.giving(alt([ref(`name), ref(`number)]), (v, at) => "v")))
claim(count(change.changed(given, [[change.append(`value, lit("#"))]]).rules.value.items) == 2)
claim(engine.parse(engine.prepared(change.changed(given, [[change.append(`value, lit("#"))]])), "#")[0] == "#")

// ---- Changes in any order, or a conflict ----
both = change.changed(base, [brackets, texts])
turned = change.changed(base, [texts, brackets])
claim(reads(both, "(a)+'b'") && reads(turned, "(a)+'b'") && count(both.rules.value.items) == 4 && count(turned.rules.value.items) == 4)
claim(count(change.conflicts(base, [brackets, texts])) == 0)
// Appending to a rule another change adds, whichever is listed first.
more_texts = [change.append(`text, lit("''"))]
claim(reads(change.changed(base, [more_texts, texts]), "a+''") && reads(change.changed(base, [texts, more_texts]), "a+''"))
// Removing a rule twice, and reserving in two changes.
claim(count(change.changed(base, [[change.remove(`plain)], [change.remove(`plain)]]).rules) == 4)
claim(count(change.changed(base, [[change.reserve(`words, ["of"])], [change.reserve(`words, ["is"])]]).reserved.words) == 3)

// Each kind of conflict, found before any text is read.
conflict(changes) => change.conflicts(base, changes)[0]
claim(conflict([texts, texts]) == "two changes add the rule text")
claim(conflict([[change.add(`name, lit("n"))]]) == "a change adds the rule name, which the grammar has")
claim(conflict([[change.append(`nothing, lit("n"))]]) == "a change is to the rule nothing, which the grammar has not")
claim(conflict([[change.remove(`nothing)]]) == "a change is to the rule nothing, which the grammar has not")
claim(conflict([[change.replace(`name, lit("n"))], [change.replace(`name, lit("m"))]]) == "the rule name is replaced or wrapped twice")
claim(conflict([[change.wrap(`name, f => f)], [change.wrap(`name, f => f)]]) == "the rule name is replaced or wrapped twice")
claim(conflict([[change.replace(`name, lit("n"))], [change.wrap(`name, f => f)]]) == "the rule name is replaced or wrapped twice")
claim(conflict([[change.replace(`value, lit("n"))], brackets]) == "the rule value is replaced or wrapped, and changed besides")
claim(conflict([[change.wrap(`value, f => f)], [change.remove(`value)]]) == "the rule value is replaced or wrapped, and changed besides")
claim(conflict([texts, [change.replace(`text, lit("t"))]]) == "the rule text is replaced or wrapped, and changed besides")
claim(conflict([[change.remove(`value)], brackets]) == "the rule value is removed, and changed besides")
claim(conflict([texts, [change.remove(`text)]]) == "the rule text is removed, and changed besides")
// A conflict found either way round, and every conflict listed.
claim(conflict([brackets, [change.replace(`value, lit("n"))]]) == "the rule value is replaced or wrapped, and changed besides")
claim(count(change.conflicts(base, [texts, texts, [change.remove(`nothing)]])) == 2)
// Changing is refused where there is one.
claim(attempt(change.changed(base, [texts, texts]), 100000).reason == "two changes add the rule text")

// ---- A notation can only add ----
nothing_named = {rules: [], words: []}
allowed(c, named) => count(change.breaches(base, c, named)) == 0
breach(c) => change.breaches(base, c, nothing_named)[0]
claim(allowed(brackets, nothing_named) && allowed(texts, nothing_named))
claim(reads(change.used(base, texts, nothing_named), "a+'b'"))
// It replaces, removes or wraps a rule it did not add only where the text names the rule.
claim(breach([change.replace(`name, lit("n"))]) == "the notation changes the rule name, which it did not add and the text does not name")
claim(breach([change.remove(`plain)]) == "the notation changes the rule plain, which it did not add and the text does not name")
claim(breach([change.wrap(`number, f => f)]) == "the notation changes the rule number, which it did not add and the text does not name")
claim(allowed([change.replace(`name, lit("n"))], {rules: [`name], words: []}))
// A rule it added is its own.
claim(allowed([change.add(`text, lit("t")), change.wrap(`text, f => f)], nothing_named))
// It adds no item to a rule that a guard in force tests cannot be read:
// `plain` reads a name where no number can be read, so one more kind of
// number would stop a name from being read there.
claim(breach([change.append(`number, lit("#"))]) == "the notation adds to the rule number, which a rule in force tests cannot be read")
claim(allowed([change.append(`number, lit("#"))], {rules: [`number], words: []}))
// Through other rules too, and not under a guard that holds where the item can be read.
deep = grammar.grammar(`s, {s: seq([grammar.guard(ref(`a), false), grammar.guard(ref(`c), true), lit("x")]), a: ref(`b), b: lit("b"), c: lit("c")})
claim(count(change.breaches(deep, [change.append(`b, lit("d"))], nothing_named)) == 1 && count(change.breaches(deep, [change.append(`c, lit("d"))], nothing_named)) == 0)
// It reserves no word in a set a terminal in force keeps out, unless the text names the word.
claim(breach([change.reserve(`words, ["unit"])]) == "the notation reserves the word unit, which the text does not name")
claim(allowed([change.reserve(`words, ["unit"])], {rules: [], words: ["unit"]}))
claim(count(change.breaches(base, [change.reserve(`words, ["unit", "of", "is"])], {rules: [], words: ["of"]})) == 2)
// A set no terminal in force keeps out is the notation's own.
claim(allowed([change.reserve(`others, ["unit"])], nothing_named))
// It brings no terminal that reads or changes the state.
step = grammar.stepper("a step", (text, at, n) => {read: 0, state: n}, false, class.no_ranges, true)
claim(breach([change.add(`stepping, seq([lit("s"), grammar.opt(step)]))]) == "the notation brings a terminal that reads or changes the state, in the rule stepping")
claim(count(change.breaches(base, [change.append(`value, step)], nothing_named)) == 1)
claim(allowed([change.add(`stepping, step)], {rules: [`stepping], words: []}))
// Using a notation with a breach is refused, before any text is read.
claim(attempt(change.used(base, [change.remove(`plain)], nothing_named), 100000).reason == "the notation changes the rule plain, which it did not add and the text does not name")

// ---- An added item can only add a reading ----
// A notation whose new item reads what an item in force reads makes
// two readings of a text that had one: the text that read before still
// reads as it did, and the claim that it reads one way is what fails.
doubled = change.used(base, [change.append(`value, grammar.run("digits", "09"))], nothing_named)
claim(ways(base, "a+1") == 1 && ways(doubled, "a+1") == 2 && ways(doubled, "a") == 1)

output.write("change: ok")
// expect: change: ok
// end: completed
// summary: decided
