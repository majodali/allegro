// A typed extension, one of the two speed tests of milestone 3 (B-196 (the
// rebuild's acceptance side), chunk Q8 (the speed tests of milestone 3)).
// Values carry a type, written as "Allegretto is a small language for the
// kernel and nothing else" has it: the check is written out as calls.
//
//   A type is a structure of its name and its methods.
//   A typed value is a structure {type: T, value: v}.
//   An operator is a call that reads the method from the left operand's
//   type; the method checks the right operand's type with a claim.
//
// Two types, an integer type and a text type, so the same operator `plus`
// adds two integers and joins two texts. A right operand of the wrong type
// is refuted by the claim.
//
// Three computations, each with its own size:
//   squares   the typed sum of i * i for i from 1 to the size, a counted
//             loop of one call per step;
//   letters   a typed fold that builds a text of the size's length, the
//             letter at place i being a, b or c by i % 3;
//   halving   the typed sum of i * i over the same range, split in halves,
//             so the recursion is as deep as the size's logarithm.
//
// The bench (next/corpus/speed/bench.ts) replaces the three lines
// `squares = ...`, `letters = ...` and `halving = ...`. The lines below pin
// the sizes the suite runs (next/corpus/speed/speed.test.ts).
capability output

// ---- The types ----

typed(t, v) => {type: t, value: v}
hasType(t, x) => x.type.name == t.name

intAdd(a, b) =>
  claim(hasType(Int, b))
  typed(Int, a.value + b.value)
intMul(a, b) =>
  claim(hasType(Int, b))
  typed(Int, a.value * b.value)
intShow(a) => int.text(a.value)
Int = {name: `int, add: intAdd, mul: intMul, show: intShow}

textAdd(a, b) =>
  claim(hasType(Text, b))
  typed(Text, a.value ++ b.value)
textShow(a) => a.value
Text = {name: `text, add: textAdd, show: textShow}

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
output.write(show(sumSquares(1, squares)))
// expect: 385
output.write(show(spell(1, letters)))
// expect: bcabcabcab
output.write(show(sumHalving(halving)))
// expect: 385
output.write(show(plus(aText("dispatch "), aText("by type"))))
// expect: dispatch by type
// end: completed
