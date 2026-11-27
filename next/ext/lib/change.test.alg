// Tests of next/ext/lib/change.alg.
capability output
import change
import class
import engine
import grammar
import levels

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

// ---- A change that leaves a rule named and gone is refused, with no text read ----
claim(attempt(change.changed(base, [[change.remove(`number)]]), 100000).reason == "the rule value names the rule number, which the grammar has not")
claim(attempt(change.changed(base, [[change.append(`value, ref(`nowhere))]]), 100000).reason == "the rule value names the rule nowhere, which the grammar has not")
claim(attempt(change.changed(base, [[change.add(`worded, grammar.unless(name, `others))], [change.append(`value, ref(`worded))]]), 100000).reason == "the rule worded names the reserved set others, which the grammar has not")

// ---- Levels and signs added to a row ----
bracketed = (sign, left, right, at) => "(" ++ left ++ sign ++ right ++ ")"
rowed = grammar.grammar(`e, {e: levels.row(grammar.run("a number", "09"), [levels.level(`sum, ["+"], `left)], lit, bracketed), other: lit("o")})
read_row(g, text) => engine.parse(engine.prepared(g), text)
// A level says where it binds and what its signs give.
power = [change.level(`e, levels.after(levels.making(levels.level(`power, ["^"], `right), (sign, left, right, at) => "pow(" ++ left ++ "," ++ right ++ ")"), [`sum]))]
claim(read_row(change.changed(rowed, [power]), "1+2^3^4") == "(1+pow(2,pow(3,4)))")
claim(read_row(rowed, "1+2") == "(1+2)" && is_failure(engine.parses(engine.prepared(rowed), "1+2^3")))
// More signs for a level the row has.
minus = [change.signs(`e, `sum, ["-"])]
claim(read_row(change.changed(rowed, [minus]), "1-2+3") == "((1-2)+3)")
// Two changes, each with a level, in either order; and a level with signs for a level.
times = [change.level(`e, levels.after(levels.before(levels.level(`product, ["*"], `left), [`power]), [`sum]))]
claim(read_row(change.changed(rowed, [power, times, minus]), "1-2*3^4") == "(1-(2*pow(3,4)))")
claim(read_row(change.changed(rowed, [minus, times, power]), "1-2*3^4") == "(1-(2*pow(3,4)))")
claim(count(change.conflicts(rowed, [power, times, minus])) == 0)
// What cannot be added.
claim(change.conflicts(rowed, [[change.level(`other, levels.level(`x, ["x"], `left))]])[0] == "a level is added to the rule other, which is no row of signs")
claim(change.conflicts(rowed, [[change.signs(`e, `product, ["*"])]])[0] == "signs are added to the level product, which the rule e has not")
claim(change.conflicts(rowed, [[change.level(`e, levels.level(`sum, ["-"], `left))]])[0] == "a change adds the level sum, which the rule e has")
claim(change.conflicts(rowed, [power, power])[0] == "two changes add the level power to the rule e")
claim(change.conflicts(rowed, [power, [change.replace(`e, lit("e"))]])[0] == "the rule e is replaced or wrapped, and changed besides")
claim(change.conflicts(rowed, [[change.level(`nothing, levels.level(`x, ["x"], `left))]])[0] == "a change is to the rule nothing, which the grammar has not")
// A notation may add a level, as it may append an item; not to a row a guard in force tests cannot be read.
claim(count(change.breaches(rowed, power, nothing_named)) == 0)
guarded_row = grammar.with_rules(rowed, put(rowed.rules, `other, seq([grammar.guard(ref(`e), false), lit("o")])))
claim(count(change.breaches(guarded_row, power, nothing_named)) == 1 && count(change.breaches(guarded_row, minus, nothing_named)) == 1)
claim(count(change.breaches(guarded_row, power, {rules: [`e], words: []})) == 0)

// ---- A conflict is settled by the text that uses the changes together ----
// Two notations each wrap `number`: one for a unit after it, one for a sign of money before it.
units = [change.wrap(`number, form => seq([form, grammar.opt(lit("kg"))]))]
money = [change.wrap(`number, form => seq([grammar.opt(lit("$")), form]))]
claim(count(change.conflicts(base, [units, money])) == 1)
// The using text says what `number` is, and what the two do to it is set aside.
own = [change.replace(`number, seq([grammar.opt(lit("$")), grammar.run("a number", "09"), grammar.opt(lit("kg"))]))]
claim(count(change.conflicts_by(base, [units, money], own)) == 0)
settled_by_text = change.changed_by(base, [units, money, brackets], own)
claim(reads(settled_by_text, "$3kg+(a)") && reads(settled_by_text, "3") && !reads(base, "$3kg"))
// What the notations do to other rules is still done, and what they reserve.
claim(count(settled_by_text.rules.value.items) == 3)
claim(!reads(change.changed_by(base, [units, [change.reserve(`words, ["of"])]], own), "of"))
// A reserved set is no rule: words reserved in a set that has a replaced rule's name are still reserved.
claim(count(change.changed_by(base, [[change.reserve(`number, ["x"])]], own).reserved.number) == 1)
// A rule the text removes: what a notation does to it is set aside too.
claim(count(change.changed_by(base, [[change.wrap(`plain, f => f)], [change.append(`plain, lit("p"))]], [change.remove(`plain)]).rules) == 4)
// The text's own change is judged as any other.
claim(change.conflicts_by(base, [units], [change.replace(`number, lit("n")), change.replace(`number, lit("m"))])[0] == "the rule number is replaced or wrapped twice")
claim(change.conflicts_by(base, [], [change.append(`nothing, lit("n"))])[0] == "a change is to the rule nothing, which the grammar has not")

// A notation brings no lines that change the grammar, whatever the text names: that right is not a notation's.
turning = [change.append(`value, grammar.turns(`value, lit("x"), lit(";"), v => []))]
claim(breach(turning) == "the notation brings lines that change the grammar, in the rule value: that right is the grammar's a reading began with")
claim(count(change.breaches(base, turning, {rules: [`value], words: []})) == 1)
claim(count(change.breaches(base, [change.add(`fresh, seq([lit("("), grammar.opt(grammar.turns(`fresh, lit("x"), lit(";"), v => []))]))], nothing_named)) == 1)

// ---- A notation whose lines are compared ----
// Adding to a rule that a rule in force tests cannot be read is no breach where the lines are compared; the other rules hold.
claim(count(change.breaches(deep, [change.append(`b, lit("d"))], nothing_named)) == 1 && !is_failure(attempt(count(change.used_compared(deep, [change.append(`b, lit("d"))]).rules), 100000)))
claim(attempt(change.used_compared(base, [change.replace(`value, lit("n"))]), 100000).reason == "the notation changes the rule value, which it did not add and the text does not name")
claim(attempt(change.used_compared(base, turning), 100000).reason == "the notation brings lines that change the grammar, in the rule value: that right is the grammar's a reading began with")

output.write("change: ok")
// expect: change: ok
// end: completed
// summary: decided
