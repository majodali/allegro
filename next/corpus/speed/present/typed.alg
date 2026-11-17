// The typed extension of next/corpus/speed/typed.alg, written for the
// present tree's file runner in its base language:
//   npx tsx src/index.ts --base next/corpus/speed/present/typed.alg
// Part of B-196 (the rebuild's acceptance side), chunk Q8 (the speed tests
// of milestone 3). The same types as structures of a name and methods, the
// same typed values {type: T, value: v}, the same operators that read the
// method from the left operand's type, and the same three computations.
//
// What differs, and why:
//   - a type's name is a text ("int"), since the base language has no
//     symbol literal;
//   - the check of the right operand is a conditional whose other branch
//     divides by zero, which halts the run as the claim's refutation ends
//     the twin's: the base language has no claim. So a method is one
//     expression, `if hasType(Int, b) then ... else 1 / 0`, where the
//     twin writes the claim and the value as two statements;
//   - two texts are joined with bits_concat, the twin's `++`;
//   - a result is printed with `print`, a number as `0 + n`: the base
//     language has no `int.text`, and `print` renders an integer as digits
//     only when it is 64 bits wide. `show` answers the value itself.
//
// The bench (next/corpus/speed/bench.ts) replaces the three lines
// `squares = ...`, `letters = ...` and `halving = ...`.

// ---- The types ----

typed(t, v) => {type: t, value: v}
hasType(t, x) => x.type.name == t.name

intAdd(a, b) => if hasType(Int, b) then typed(Int, a.value + b.value) else 1 / 0
intMul(a, b) => if hasType(Int, b) then typed(Int, a.value * b.value) else 1 / 0
intShow(a) => 0 + a.value
Int = {name: "int", add: intAdd, mul: intMul, show: intShow}

textAdd(a, b) => if hasType(Text, b) then typed(Text, bits_concat(a.value, b.value)) else 1 / 0
textShow(a) => a.value
Text = {name: "text", add: textAdd, show: textShow}

// ---- The operators: the method is the left operand's type's ----

plus(a, b) => a.type.add(a, b)
times(a, b) => a.type.mul(a, b)
show(a) => a.type.show(a)

anInt(n) => typed(Int, n)
aText(t) => typed(Text, t)

// ---- The computations ----

sumSquares(i, n) => if i > n then anInt(0) else plus(times(anInt(i), anInt(i)), sumSquares(i + 1, n))
letter(i) => if i % 3 == 0 then aText("a") else if i % 3 == 1 then aText("b") else aText("c")
spell(i, n) => if i > n then aText("") else plus(letter(i), spell(i + 1, n))
halves(lo, hi) =>
  if lo == hi then times(anInt(lo), anInt(lo))
  else plus(halves(lo, (lo + hi) / 2), halves((lo + hi) / 2 + 1, hi))
sumHalving(n) => if n < 1 then anInt(0) else halves(1, n)

squares = 10
letters = 10
halving = 10
print(show(sumSquares(1, squares)))
print(show(spell(1, letters)))
print(show(sumHalving(halving)))
print(show(plus(aText("dispatch "), aText("by type"))))
