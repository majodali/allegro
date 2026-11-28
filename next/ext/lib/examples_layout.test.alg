// Worked examples of the parser's rules, 3 of 6: state beside the
// position, and layout by indentation.
//
// Decision: "Offside rule through stateful indent terminals"
// (docs/plans/book-pass-inventory.md). The index is next/ext/examples.md.
capability output
import class
import engine
import grammar
import offside

lit = grammar.lit
ref = grammar.ref
seq = grammar.seq
alt = grammar.alt
star = grammar.star

ways(g, text) => size(engine.parses(engine.prepared(g), text))
size(a) => if is_failure(a) then 0 else length(a.readings)
length(l) => if count(l) == 0 then 0 else 1 + length(l.t)

// ---- A state is carried beside the position ----
//
// A reading has a position and a state. The state is parts by name,
// each a bits value; a grammar says which parts it has and what each
// begins as. A terminal made with `stepper` names one part, is handed
// it, and gives how many bytes it reads and the part after, or nothing.
// Every other form hands the state on. Here the part `open` is the
// brackets open so far, and the grammar is a plain repetition: no rule
// names itself.
//
//   s     = (open | close | "x")* done
//   open  reads "<" and notes it
//   close reads ">" where a bracket is open, and forgets one
//   done  reads nothing, where none is open
open = grammar.stepper("an opening bracket", `open, (text, at, state) => if grammar.byte(text, at) == 60 then {read: 1, state: state ++ "<"} else [], true, class.pairs("<<"), false)
close = grammar.stepper("a closing bracket", `open, (text, at, state) => if grammar.byte(text, at) == 62 && bits.length(state) > 0 then {read: 1, state: bits.slice(state, 0, bits.length(state) - 8)} else [], true, class.pairs(">>"), false)
done = grammar.stepper("no bracket open", `open, (text, at, state) => if bits.length(state) == 0 then {read: 0, state: state} else [], false, class.no_ranges, true)
balanced = grammar.with_part(grammar.grammar(`s, {s: seq([star(alt([open, close, lit("x")])), done, grammar.end])}), `open, "")
claim(ways(balanced, "<x<x>>x") == 1 && ways(balanced, "") == 1)
claim(ways(balanced, "<x") == 0 && ways(balanced, "x>") == 0 && ways(balanced, "><") == 0)

// ---- Two parts, each its own terminals' ----
//
// A terminal reads and changes the one part it names, so two sets of
// terminals keep two states that know nothing of each other. Round
// brackets are counted in a part `round`, beside the angle brackets
// above: each closes where its own is open, whatever the other is.
round = grammar.stepper("a round bracket", `round, (text, at, n) => if grammar.byte(text, at) == 40 then {read: 1, state: n + 1} else [], true, class.pairs("(("), false)
unround = grammar.stepper("a closing round bracket", `round, (text, at, n) => if grammar.byte(text, at) == 41 && n > 0 then {read: 1, state: n - 1} else [], true, class.pairs("))"), false)
none_round = grammar.stepper("no round bracket open", `round, (text, at, n) => if n == 0 then {read: 0, state: n} else [], false, class.no_ranges, true)
two_kinds = grammar.with_part(grammar.with_part(grammar.grammar(`s, {s: seq([star(alt([open, close, round, unround, lit("x")])), done, none_round, grammar.end])}), `open, ""), `round, 0)
claim(ways(two_kinds, "<(>)") == 1 && ways(two_kinds, "(<x>)") == 1)
claim(ways(two_kinds, "<(>") == 0 && ways(two_kinds, "(>") == 0)

// ---- Layout: a block is the lines deeper than the line it begins on ----
//
// offside.alg makes the terminals from one function, which says what
// blank space on a line is. Their part of the state, `offside.part`, is
// the columns of the blocks open, innermost first.
//
//   indent    a line end, and a first line deeper than the block around
//   newline   a line end, and a line at the block's own column
//   dedent    reads nothing: where the next line is less deep, or the text ends
//   ending    the end of the text, every block closed
//
// A small language of names, each with a value or a block of its own:
//
//   module     = statements ending
//   statements = statement (newline statement)*
//   statement  = name "=" name | name ":" block
//   block      = indent statements dedent
blank(text, at) => if grammar.byte(text, at) == 32 then blank(text, at + 1) else at
o = offside.made(blank)
name = grammar.spaced(grammar.run("a name", "az"))
sign(t) => grammar.spaced(lit(t))
// What a reading gives: each statement's name, with its block between brackets.
spread(l, i) => if i == count(l) then "" else (if i == 0 then "" else " ") ++ l[i] ++ spread(l, i + 1)
blocks = grammar.with_part(grammar.with_space(grammar.grammar(`module, {
  module: grammar.giving(seq([ref(`statements), o.ending]), (v, at) => v[0]),
  statements: grammar.giving(seq([ref(`statement), star(grammar.giving(seq([o.newline, ref(`statement)]), (v, at) => v[1]))]), (v, at) => v[0] ++ (if count(v[1]) == 0 then "" else " " ++ spread(v[1], 0))),
  statement: alt([
    grammar.giving(seq([name, sign("="), name]), (v, at) => v[0]),
    grammar.giving(seq([name, sign(":"), ref(`block)]), (v, at) => v[0] ++ "(" ++ v[2] ++ ")")]),
  block: grammar.giving(seq([o.indent, ref(`statements), o.dedent]), (v, at) => v[1])
}), o.space, offside.part), offside.part, offside.begun)
read(text) => engine.parse(engine.prepared(blocks), text)
claim(read("a = x\nb = y\n") == "a b")
// A block ends where a line is less deep, and two may end at one line.
claim(read("a:\n  b = x\n  c:\n    d = y\ne = z\n") == "a(b c(d)) e")
// How deep a block is, its first line says: no number of spaces is the language's.
claim(read("a:\n        b = x\n        c = y\nd = z") == "a(b c) d")
// A line that fits no block open is no reading.
claim(ways(blocks, "a:\n    b = x\n  c = y\n") == 0)
// A line deeper than its block, where no block begins, carries on the line before it.
claim(read("a =\n    x\nb = y\n") == "a b")

// ---- A grammar with no layout pays nothing for it ----
//
// The state and its terminals are a grammar's own. The sums of
// examples_forms.test.alg carry the state they were given, untouched,
// and the engine remembers what a rule gave at a position only for
// rules that do not touch the state.
plain = grammar.grammar(`s, {s: seq([lit("a"), lit("b")])})
claim(ways(plain, "ab") == 1 && count(engine.prepared(plain).state) == 0)

output.write("examples of layout: ok")
// expect: examples of layout: ok
// end: completed
// summary: decided
