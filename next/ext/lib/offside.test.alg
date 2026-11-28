// Tests of next/ext/lib/offside.alg, on a small language of blocks:
//
//   module    = statements ending
//   statements = statement (newline statement)*
//   statement = name "=" value | name ":" block
//   block     = indent statements dedent
//
// A comment is `#` to the end of the line.
capability output
import engine
import grammar
import offside

ref = grammar.ref
seq = grammar.seq
alt = grammar.alt

blank(text, at) =>
  if grammar.byte(text, at) == 32 || grammar.byte(text, at) == 9 then blank(text, at + 1)
  else if grammar.byte(text, at) == 35 then to_line_end(text, at)
  else at
to_line_end(text, at) => if grammar.byte(text, at) == 10 || grammar.byte(text, at) == -1 then at else to_line_end(text, at + 1)

o = offside.made(blank)
name = grammar.spaced(grammar.run("a name", "az"))
value = grammar.spaced(grammar.run("a value", "az09"))
sign(t) => grammar.spaced(grammar.lit(t))
blocks = grammar.with_part(grammar.with_space(grammar.grammar(`module, {
  module: seq([ref(`statements), o.ending]),
  statements: seq([ref(`statement), grammar.star(seq([o.newline, ref(`statement)]))]),
  statement: alt([seq([name, sign("="), value]), seq([name, sign(":"), ref(`block)])]),
  block: seq([o.indent, ref(`statements), o.dedent])
}), o.space, offside.part), offside.part, offside.begun)
p = engine.prepared(blocks)

readings(text) => size(engine.parses(p, text))
size(a) => if is_failure(a) then 0 else length(a.readings)
length(l) => if count(l) == 0 then 0 else 1 + length(l.t)
failed_at(text) => engine.parses(p, text).at
tree(text) => engine.shown(engine.parses(p, text).readings.h)

// Statements in the first column.
claim(readings("a = 1\nb = 2\n") == 1)
claim(readings("a = 1") == 1)
claim(tree("a = 1\nb = 2") == "[[[a = 1] [[\n [b = 2]]]] ]")

// A block is deeper than its line, and ends where a line is less deep.
claim(readings("a:\n  b = 1\n  c = 2\nd = 3\n") == 1)
// Blocks in blocks; two end at one line.
claim(readings("a:\n  b = 1\n  c:\n    d = 2\n    e = 3\nf = 4\n") == 1)
// A text may end inside its blocks, with a last line end or none.
claim(readings("a:\n  b:\n    c = 1") == 1)
claim(readings("a:\n  b:\n    c = 1\n\n") == 1)
// However deep a block is, it is a block: its first line says how deep.
claim(readings("a:\n        b = 1\n        c = 2\nd = 3") == 1)
// Empty lines and comments are no lines of a block, whatever their column.
claim(readings("a:   # the first\n\n  b = 1\n# in the first column\n\n  c = 2\n       # deep\nd = 3\n") == 1)

// A line deeper than its block carries on the line before it.
claim(readings("a =\n    1\nb = 2\n") == 1)
claim(readings("a:\n  b =\n      1\n  c\n   = 2\nd = 3\n") == 1)
// So a statement does not begin deeper than its block.
claim(readings("a = 1\n  b = 2\n") == 0)

// A line between two blocks' columns belongs to neither.
claim(readings("a:\n    b = 1\n  c = 2\n") == 0)
// The reading stops at the end of the line before it.
claim(failed_at("a:\n    b = 1\n  c = 2\n") == 12)
// A block has a statement, and is deeper than its line.
claim(readings("a:\nb = 1\n") == 0)
claim(readings("a:\n") == 0)
// Two statements are not on one line.
claim(readings("a = 1 b = 2\n") == 0)

// Every rule here reads the state or space that does, so none is remembered.
claim(count(p.kept) == 0)

// The terminals, each by itself. The state [2, 0] is a block at column 2 in one at 0.
inner = 2 ++ 0
t = "a:\n  b = 1\n  c = 2\nd = 3"
// After "b = 1", at 10: a new line at the block's column reads to "c".
claim(o.newline.step(t, 10, inner).read == 3)
// After "c = 2", at 18: the next line is less deep, so no new line here, and the block ends.
claim(count(o.newline.step(t, 18, inner)) == 0)
claim(o.dedent.step(t, 18, inner).read == 0 && o.dedent.step(t, 18, inner).state == 0)
// The outermost block has no end.
claim(count(o.dedent.step(t, 24, 0)) == 0)
// At "b", at 5: a deeper line than column 0, and no deeper than column 2.
claim(o.indent.step(t, 5, 0).state == inner && count(o.indent.step(t, 5, inner)) == 0)
// Not at "=", which is not the first thing on its line.
claim(count(o.indent.step(t, 7, 0)) == 0)
claim(o.sameline.match(t, 7) == 0 && o.sameline.match(t, 5) == -1 && o.sameline.match(t, 2) == -1)
// Space: after "a:" in the outermost block the deeper line is carried on to; in the inner block the next line is not.
claim(o.space(t, 2, 0) == 3 && o.space(t, 10, inner) == 0 && o.space(t, 6, inner) == 1)

output.write("offside: ok")
// expect: offside: ok
// end: completed
// summary: decided
