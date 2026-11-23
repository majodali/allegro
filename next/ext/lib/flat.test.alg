// Tests of next/ext/lib/flat.alg: Allegretto written flat is read, each
// text one way.
capability output
import engine
import flat

p = engine.prepared(flat.allegretto)
readings(text) => size(engine.parses(p, text))
size(a) => if is_failure(a) then 0 else length(a.readings)
length(l) => if count(l) == 0 then 0 else 1 + length(l.t)
failed_at(text) => engine.parses(p, text).at

// A module of nothing, and of comments alone.
claim(readings("") == 1)
claim(readings("// a comment\n\n/* and\n another */\n") == 1)

// Declarations, bindings and statements, each on a line of its own.
claim(readings("capability output\nimport map\nx = 1\n") == 1)
claim(readings("x = 1") == 1)
claim(readings("export f(a, b) => a + b\ng() => 0\nh(x) => x\n") == 1)
claim(readings("output.write(\"hello\")\n") == 1)
claim(readings("claim(x == 1)\n// said\nclaim(y)\n") == 1)

// Values.
claim(readings("x = [1, 0xFF, 1.5, \"a \\\" b\", `name, true, false, []]\n") == 1)
claim(readings("x = [a: 1]\n") == 0)
claim(readings("x = f(a)(b).c[0].d\n") == 1)
claim(readings("x = (a, b) => c => () => a\n") == 1)
claim(readings("x = if a then b else if c then d else e\n") == 1)

// Signs written between and before: one reading each, whatever binds.
claim(readings("x = a |> f || b && c == d != e < f > g <= h >= i ++ j + k - l * m / n % o\n") == 1)
claim(readings("x = -a - -b + !c\n") == 1)
claim(readings("x = (if a then b else c) + (y => y)(1)\n") == 1)
claim(readings("x = a ++ b + c\n") == 1)
claim(readings("x = a<=b\ny = a<b\nz=a==b\n") == 1)

claim(readings("x =\t1\t// with tabs\n") == 1)

// A word that begins as a form does is a name, and a name that begins
// as a word does is one name: `exportx` is not `export x`.
claim(readings("exportx = 1\n") == 1)
claim(readings("iffy = truest + elsewhere + falsehood\n") == 1)
claim(readings("if = 1\n") == 0)
claim(readings("x = then(a, b)\n") == 1)

// A line that begins with a space carries on the one before it, across
// empty lines and comments.
claim(readings("f(x) =>\n  if x\n  then 1\n\n  // or\n  else 2\ng = 1\n") == 1)
claim(readings("x = 1 +\n2\n") == 0)
// A line that begins with a space begins no statement.
claim(readings("x = 1\n  y = 2\n") == 0)
// So a module does not begin with one.
claim(readings("  x = 1\n") == 0)
// A line in the first column begins a statement: two on one line are refused.
claim(readings("x = 1 y = 2\n") == 0)

// Where a text is not read, the farthest place.
claim(failed_at("x = (1 + \ny = 2\n") == 9)
claim(failed_at("x = 1\ny = [1, 2\n") == 15)
claim(failed_at("x = 1 +* 2\n") == 7)
claim(failed_at("x = \"open\n") == 4)

// A row of signs is grouped by their levels. The value of `x = e` is
// [[] "x" ["=" e]], and of a module [[] [[line end] ...] []].
bound(text) => engine.parse(p, text)[1][0][0][2][1]
times = bound("x = a + b * c - d\n")
claim(times.sign == "-" && times.left.sign == "+" && times.left.right.sign == "*" && times.left.right.left[0] == "b")
claim(times.at.start.index == 4 && times.at.end.index == 17 && times.left.right.at.start.column == 9)
mixed = bound("x = a |> f || b && c == d < e ++ g + h * i\n")
claim(mixed.sign == "|>" && mixed.right.sign == "||" && mixed.right.right.sign == "&&" && mixed.right.right.right.sign == "==")
claim(mixed.right.right.right.right.sign == "<" && mixed.right.right.right.right.right.sign == "++" && mixed.right.right.right.right.right.right.sign == "+")
claim(mixed.right.right.right.right.right.right.right.sign == "*")
// The same levels the other way round, and signs of one level from the left.
claim(bound("x = a * b + c ++ d < e\n").sign == "<" && bound("x = a * b + c ++ d < e\n").left.left.left.sign == "*")
claim(bound("x = a - b + c - d\n").left.left.sign == "-" && bound("x = a - b + c - d\n").left.left.left[0] == "a")
claim(bound("x = a <= b == c >= d\n").sign == "==" && bound("x = a <= b == c >= d\n").left.sign == "<=")

output.write("flat: ok")
// expect: flat: ok
// end: completed
// summary: decided
