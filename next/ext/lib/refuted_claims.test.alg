// Tests of the two claims next/ext/lib/engine.alg makes, each refuted
// inside an attempt. A refuted claim is on the run's record though the
// attempt handles it, so this module's summary is `refuted`, and it is
// kept apart from the tests whose every claim is decided.
capability output
import engine
import grammar

lit = grammar.lit
seq = grammar.seq
alt = grammar.alt

// ---- A text that reads one way ----
// "ab" reads two ways in this grammar: the claim that it reads one way is refuted.
two = engine.prepared(grammar.grammar(`s, {s: alt([lit("ab"), seq([lit("a"), lit("b")]), lit("x")])}))
claim(engine.parse(two, "x") == "x")
claim(attempt(engine.parse(two, "ab"), 100000).failure == `refuted)
// Every reading is still given to whoever asks for all of them.
claim(count(engine.parses(two, "ab").readings.t) == 2)

// ---- A rule marked settled has one result at most wherever it is read ----
// "xx!" reads one way, but the rule a has three results at its beginning.
unsettled = grammar.grammar(`s, {s: seq([grammar.ref(`a), lit("!")]), a: alt([lit("x"), seq([lit("x"), grammar.opt(lit("x"))])])})
claim(count(engine.parses(engine.prepared(unsettled), "xx!").readings.t) == 0)
claim(attempt(engine.parses(engine.prepared(grammar.with_settled(unsettled, [`a])), "xx!"), 100000).failure == `refuted)

// ---- A line that asks for a change is the only reading of the text so far ----
// The line "+" is read two ways, both ending where it ends, and each asks: the claim is refuted.
asks_twice = grammar.grammar(`lines, {lines: grammar.turns(`lines, grammar.ref(`line), lit(";"), v => [v]), line: alt([lit("+"), seq([lit("+"), grammar.opt(lit("!"))])])})
taking_any = (held, asked) => {held: held, prepared: engine.prepared(held)}
claim(attempt(engine.parses_with(engine.prepared(asks_twice), "+;+", "", asks_twice, taking_any), 100000).failure == `refuted)

output.write("refuted claims: ok")
// expect: refuted claims: ok
// end: completed
// summary: refuted
