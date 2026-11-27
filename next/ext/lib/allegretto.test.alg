// Tests of next/ext/lib/allegretto.alg. That the tree is the one the
// bootstrap gives, for every text of the corpus, is next/ext/readers.ts
// and its test; here are the grammar's own parts.
capability output
import allegretto
import analysis
import engine

p = engine.prepared(allegretto.language)
tree(text) => engine.parse(p, text)
ways(text) => size(engine.parses(p, text))
size(a) => if is_failure(a) then 0 else length(a.readings)
length(l) => if count(l) == 0 then 0 else 1 + length(l.t)

// The grammar names no rule and no reserved set it has not, and every rule is reached.
claim(count(analysis.faults(allegretto.language)) == 0)

// A module is its header lines and its items, whichever is written first.
m = tree("capability output\nx = 1\nimport lib\ninput n\nkey k\nf(a) => a\ny <- f(x)\noutput.write(\"hi\")\n")
claim(count(m.headers) == 4 && count(m.items) == 4)
claim(m.headers[0].k == `capability && m.headers[1].k == `import && m.headers[2].k == `input && m.headers[3].k == `key && m.headers[1].name.name == "lib")
claim(m.items[0].k == `binding && m.items[1].k == `function && m.items[2].k == `arrow && m.items[3].k == `statement)
claim(m.items[0].name.name == "x" && m.items[0].value.k == `int && m.items[0].value.value == 1 && !m.items[0].exported)
claim(count(m.items[1].params) == 1 && m.items[1].params[0].name == "a" && m.items[1].body.k == `name)
claim(m.items[3].expr.k == `apply && m.items[3].expr.fn.k == `dot && m.items[3].expr.fn.name.name == "write" && m.items[3].expr.args[0].bytes == "hi")
// Places: the name `lib` is on line 3, bytes 31 to 34.
claim(m.headers[1].name.at.start.line == 3 && m.headers[1].name.at.start.index == 31 && m.headers[1].name.at.end.index == 34 && m.headers[1].name.at.start.column == 8)
// A module of nothing, and of comments.
claim(count(tree("").items) == 0 && count(tree("// one\n\n/* two\n lines */\n").items) == 0)

// Numbers and texts.
// Hex digits in either case.
claim(tree("v = 0xff + 0xAb\n").items[0].value.left.value == 255 && tree("v = 0xff + 0xAb\n").items[0].value.right.value == 171)
values = tree("v = [42, 0xFF, 0x10, 1.5, 10.25, \"a\\\"b\\\\c\\n\\t\", `if, true, false]\n").items[0].value.items
claim(values[0].value == 42 && values[1].value == 255 && values[2].value == 16)
claim(float.text(values[3].value) == "1.5" && float.text(values[4].value) == "10.25")
claim(values[5].bytes == "a\"b\\c\n\t" && values[6].k == `symbol && values[6].name == "if" && values[7].value && !values[8].value)
// A minus before a fraction is part of the number; before a whole number it is a sign.
minus = tree("v = [-1.5, -2, -(1.5), -9223372036854775808]\n").items[0].value.items
claim(minus[0].k == `float && float.text(minus[0].value) == "-1.5" && minus[1].k == `unary && minus[2].k == `unary && minus[3].k == `int && minus[3].value + 1 == -9223372036854775807)

// The signs bind as forms.md has them, and `|>` is a pipe.
bound = tree("v = a |> f || b && c == d < e ++ g + h * i\n").items[0].value
claim(bound.k == `pipe && bound.fn.op == "||" && bound.fn.right.op == "&&" && bound.fn.right.right.op == "==" && bound.fn.right.right.right.op == "<")
claim(bound.fn.right.right.right.right.op == "++" && bound.fn.right.right.right.right.right.op == "+" && bound.fn.right.right.right.right.right.right.op == "*")
claim(tree("v = a - b - c\n").items[0].value.left.op == "-")

// One reading, where a grammar that tries every item could find two.
claim(ways("f(x) =>\n  a\n  -b\n") == 1 && tree("f(x) =>\n  a\n  -b\n").items[0].body.k == `block && count(tree("f(x) =>\n  a\n  -b\n").items[0].body.items) == 2)
claim(ways("f(x) =>\n  a\n    -b\n") == 1 && count(tree("f(x) =>\n  a\n    -b\n").items[0].body.items) == 1)
claim(ways("g = x => x + 1\n") == 1 && tree("g = x => x + 1\n").items[0].value.body.k == `binary)
claim(ways("n <- a\n") == 1 && tree("n <- a\n").items[0].k == `arrow && tree("m = n < -a\n").items[0].value.op == "<")
claim(ways("h = 1 + if a then b else c + d\n") == 1 && tree("h = 1 + if a then b else c + d\n").items[0].value.right.otherwise.k == `binary)
// A body on the next line that is no block is the expression carried on.
claim(tree("u =\n  if a then b\n  else c\n").items[0].value.k == `if)
// `sync` before a block, and as a name.
claim(tree("s() => sync\n  a\n").items[0].body.sync && !tree("s() =>\n  a\n").items[0].body.sync && tree("v = sync\n").items[0].value.name == "sync")
// Not read: a reserved word as a name, two statements on a line, a brace in a text, a block less deep.
claim(ways("if = 1\n") == 0 && ways("x = 1 y = 2\n") == 0 && ways("x = \"a" ++ bits.slice(123, 56, 8) ++ "b\"\n") == 0 && ways("f() =>\n    a\n  b\n") == 0)
// Records, with a key that is worked out, and one more comma after the last.
record = tree("r = " ++ bits.slice(123, 56, 8) ++ "a: 1, [k]: 2,\n" ++ bits.slice(125, 56, 8) ++ "\n").items[0].value
claim(record.k == `record && count(record.fields) == 2 && record.fields[0].k == `named && record.fields[0].name.name == "a" && record.fields[1].k == `computed && record.fields[1].key.name == "k")
// An import with its two lists.
lists = tree("import m with a: 1, b: x without c, d\n").headers[0]
claim(count(lists.pairs) == 2 && lists.pairs[1].name.name == "b" && lists.pairs[1].value.name == "x" && count(lists.without) == 2 && lists.without[1].name == "d")

// A tree as a text.
claim(allegretto.shown(tree("x = 1 + 2\n")) == "(module () ((binding x@0-1:1:1 false (binary + (int 1 @4-5:1:5) (int 2 @8-9:1:9) @4-9:1:5) @0-9:1:1)))")

// ---- A line `use` ----
// It asks for a change of the grammar, so it is read with someone to take one: here one who changes nothing.
unchanged = (held, asked) => {held: held, prepared: p}
u = engine.parses_with(p, "use a.b.c changing x, y\nf() =>\n  use d.e\n  1\n", "", [], unchanged).readings.h
// The path as names, and the rules named after `changing`.
claim(count(u.headers) == 1 && u.headers[0].k == `use && count(u.headers[0].path) == 3 && u.headers[0].path[2].name == "c" && u.headers[0].name.name == "a")
claim(count(u.headers[0].changing) == 2 && u.headers[0].changing[0].name == "x" && u.headers[0].changing[1].name == "y")
// In a block it is a line of the block, in its place.
claim(count(u.items[0].body.items) == 2 && u.items[0].body.items[0].k == `use && u.items[0].body.items[0].header && count(u.items[0].body.items[0].changing) == 0)
// Read with no one to take a change, the text is refused.
claim(attempt(tree("use a.b\n"), 1000000).reason == "a line asks for a change of the grammar, and whoever began the reading takes none")
// The line ends at one place: a path or a list cut short is no reading of it.
claim(is_failure(engine.parses_with(p, "use a. \n", "", [], unchanged)) && is_failure(engine.parses_with(p, "use a changing\n", "", [], unchanged)))
// `use` is a reserved word, as `import` is: no name, so a notation that adds a line beginning with a name leaves a `use` line one reading.
claim(is_failure(engine.parses(p, "use = 1\n")) && is_failure(engine.parses(p, "x = use\n")) && !is_failure(engine.parses(p, "used = 1\n")))
// The lines of a module and of a block are one rule, and the operators are a rule a notation can add a level to.
claim(allegretto.language.rules.lines.op == `turns && kind(allegretto.language.rules.operators) == `structure)

output.write("allegretto: ok")
// expect: allegretto: ok
// end: completed
// summary: decided
