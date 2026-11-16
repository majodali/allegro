// The operators at each precedence level, loosest first: |>; ||; &&;
// == !=; < > <= >=; ++; + -; * / %; prefix - and !; application, . and [ ].
capability output
show(b) => if b then "true" else "false"
"piped" |> output.write
// expect: piped
"twice" |> (s => s ++ s) |> output.write
// expect: twicetwice
output.write(show(false || true && false))
// expect: false
output.write(show(1 < 2 == 2 < 3))
// expect: true
output.write(show(1 + 2 * 3 == 7))
// expect: true
output.write(show(1 + 2 <= 3 && !(2 > 3)))
// expect: true
output.write(int.text(10 - 3 - 2))
// expect: 5
output.write(int.text(-7 % 3))
// expect: -1
output.write(int.text(-(2 + 3) * 4))
// expect: -20
output.write(int.text(100 / 7 / 2))
// expect: 7
output.write(show("abc" == "abc"))
// expect: true
output.write(show("abc" != "abd"))
// expect: true
output.write(show(42 == 42))
// expect: true
output.write(show(1 == 1.0))
// expect: false
output.write("con" ++ "cat" ++ "enated")
// expect: concatenated
output.write(bits.join("ab", "c") ++ " " ++ bits.slice("abcdef", 8, 16) ++ " " ++ int.text(bits.length("abc")))
// expect: abc bc 24
point = {x: 3, y: 4, name: "p"}
output.write(point.name ++ " " ++ int.text(point.x * point.x + point.y * point.y))
// expect: p 25
output.write(int.text(point[1]))
// expect: 4
output.write(["a", "b", "c"][2])
// expect: c
output.write(show(`a == `a))
// expect: true
output.write(float.text(float.add(1.5, 2.25)))
// expect: 3.75
// end: completed
