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
// A reading has a position and a state, which is one bits value. A
// terminal made with `stepper` is handed the state, and gives how many
// bytes it reads and the state after, or nothing. Every other form hands
// the state on. Here the state is the brackets open so far, and the
// grammar is a plain repetition: no rule names itself.
//
//   s     = (open | close | "x")* done
//   open  reads "<" and notes it
//   close reads ">" where a bracket is open, and forgets one
//   done  reads nothing, where none is open
open = grammar.stepper("an opening bracket", (text, at, state) => if grammar.byte(text, at) == 60 then {read: 1, state: state ++ "<"} else [], true, class.pairs("<<"), false)
close = grammar.stepper("a closing bracket", (text, at, state) => if grammar.byte(text, at) == 62 && bits.length(state) > 0 then {read: 1, state: bits.slice(state, 0, bits.length(state) - 8)} else [], true, class.pairs(">>"), false)
done = grammar.stepper("no bracket open", (text, at, state) => if bits.length(state) == 0 then {read: 0, state: state} else [], false, class.no_ranges, true)
balanced = grammar.grammar(`s, {s: seq([star(alt([open, close, lit("x")])), done, grammar.end])})
claim(ways(balanced, "<x<x>>x") == 1 && ways(balanced, "") == 1)
claim(ways(balanced, "<x") == 0 && ways(balanced, "x>") == 0 && ways(balanced, "><") == 0)

// ---- Layout: a block is the lines deeper than the line it begins on ----
//
// offside.alg makes the terminals from one function, which says what
// blank space on a line is. Their state is the columns of the blocks
// open, innermost first.
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
blocks = grammar.with_state(grammar.with_space(grammar.grammar(`module, {
  module: grammar.giving(seq([ref(`statements), o.ending]), (v, at) => v[0]),
  statements: grammar.giving(seq([ref(`statement), star(grammar.giving(seq([o.newline, ref(`statement)]), (v, at) => v[1]))]), (v, at) => v[0] ++ (if count(v[1]) == 0 then "" else " " ++ spread(v[1], 0))),
  statement: alt([
    grammar.giving(seq([name, sign("="), name]), (v, at) => v[0]),
    grammar.giving(seq([name, sign(":"), ref(`block)]), (v, at) => v[0] ++ "(" ++ v[2] ++ ")")]),
  block: grammar.giving(seq([o.indent, ref(`statements), o.dedent]), (v, at) => v[1])
}), o.space, true), offside.begun)
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
claim(ways(plain, "ab") == 1 && engine.prepared(plain).state == "")

output.write("examples of layout: ok")
// expect: examples of layout: ok
// end: completed
// summary: decided
