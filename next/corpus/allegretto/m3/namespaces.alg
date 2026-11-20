// int, float, text and bits are structures Allegretto binds, whose entries
// are the primitives (next/ext/allegretto/forms.md §2, "Names, functions
// and application"). One may be handed as a value, and a block that binds
// one of the four names hides it. The four primitives added on
// 2026-11-19 are among the entries: bits.int, float.eq, float.ge and
// float.gt.
capability output
apply(ops, a, b) => ops.add(a, b)
output.write(int.text(apply(int, 2, 3)) ++ " " ++ float.text(apply(float, 0.5, 0.25)))
// expect: 5 0.75
output.write(int.text(text.int("12") + bits.int(bits.slice("A", 0, 8))))
// expect: 77
yes(b) => if b then "true" else "false"
output.write(yes(float.eq(0.0, float.neg(0.0))) ++ " " ++ yes(0.0 == float.neg(0.0)) ++ " " ++ yes(float.ge(2.0, 2.0)) ++ " " ++ yes(float.gt(2.0, 2.0)))
// expect: true false true false
hidden <-
  int = {text: n => "int is bound again here"}
  int.text(1)
output.write(hidden)
// expect: int is bound again here
// end: completed
