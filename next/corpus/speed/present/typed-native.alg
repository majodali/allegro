// The native baseline of the typed speed test (B-196 (the rebuild's
// acceptance side), chunk Q8 (the speed tests of milestone 3)): the three
// computations of next/corpus/speed/typed.alg in the present tree's
// standard language, whose own type system types each value and chooses
// the method of `+` and `*` by type. Run as
//   npx tsx src/index.ts next/corpus/speed/present/typed-native.alg
// It is what a user of the present tree gets today, not the same algorithm:
// no typed value is built by hand, and the type system is host code.
//
// The bench (next/corpus/speed/bench.ts) replaces the three lines
// `squares = ...`, `letters = ...` and `halving = ...`.

sumSquares(i: Int, n: Int): Int => if i > n then 0 else i * i + sumSquares(i + 1, n)
letter(i: Int): String => if i % 3 == 0 then "a" else if i % 3 == 1 then "b" else "c"
spell(i: Int, n: Int): String => if i > n then "" else letter(i) + spell(i + 1, n)
halves(lo: Int, hi: Int): Int =>
  if lo == hi then lo * lo
  else halves(lo, (lo + hi) / 2) + halves((lo + hi) / 2 + 1, hi)
sumHalving(n: Int): Int => if n < 1 then 0 else halves(1, n)

squares = 10
letters = 10
halving = 10
print(sumSquares(1, squares))
print(spell(1, letters))
print(sumHalving(halving))
print("dispatch " + "by type")
