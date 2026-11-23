// A class of bytes, written in Allegretto.
//
// Whose: the kernel stream (lane R). What the parser engine stands on
// (docs/plans/book-pass.md section 10.4): a terminal says which bytes it
// can start with as a class, and the engine tests one byte of the text
// against a class before it tries an alternative.
//
// A class is 256 bits, one for each byte, 1 where the byte belongs. So
// asking whether a byte belongs is one part taken and one comparison.
//
// A class is made from ranges. A range is {lo, hi}: the bytes from lo to
// hi, both among them. `ranges` is a list of them in any order, which
// may overlap: [] or {lo, hi, t} with t the ranges that follow.

zeros = 0 ++ 0 ++ 0 ++ 0
ones = -1 ++ -1 ++ -1 ++ -1

export nothing = zeros
export every = ones

// True where the byte b belongs to the class c. No byte below 0 belongs:
// the engine reads the end of a text as the byte -1.
export has(c, b) => b >= 0 && bits.slice(c, b, 1) == true

// No ranges, and the ranges l with one more.
export no_ranges = []
export with_range(l, lo, hi) => {lo: lo, hi: hi, t: l}

// The ranges of a text of pairs of bytes, each pair the lowest and the
// highest byte of a range: "azAZ__" is the letters and the underscore.
export pairs(t) => pairs_from(t, 0, no_ranges)
pairs_from(t, i, l) =>
  if i >= bits.length(t) then l
  else pairs_from(t, i + 16, with_range(l, byte_at(t, i), byte_at(t, i + 8)))
byte_at(t, i) => bits.int(bits.slice(t, i, 8))

// The ranges of both lists.
export both(a, b) => if count(a) == 0 then b else both(a.t, with_range(b, a.lo, a.hi))

// The class of a list of ranges.
export made(l) => laid(ordered(l, []), 0)

// The ranges in order of their lowest byte, with ranges that touch or
// overlap made one.
ordered(l, sorted) => if count(l) == 0 then sorted else ordered(l.t, placed(sorted, l.lo, l.hi))
placed(s, lo, hi) =>
  if count(s) == 0 then {lo: lo, hi: hi, t: []}
  else if hi + 1 < s.lo then {lo: lo, hi: hi, t: s}
  else if s.hi + 1 < lo then after(s, placed(s.t, lo, hi))
  else placed(s.t, least(lo, s.lo), most(hi, s.hi))
after(s, t) => then(t, {lo: s.lo, hi: s.hi, t: t})
least(a, b) => if a < b then a else b
most(a, b) => if a > b then a else b

// The bits of ordered ranges, from the byte `at` on.
laid(s, at) =>
  if count(s) == 0 then bits.slice(zeros, 0, 256 - at)
  else bits.slice(zeros, 0, s.lo - at) ++ bits.slice(ones, 0, s.hi - s.lo + 1) ++ laid(s.t, s.hi + 1)

// How many bytes belong to the class c.
export size(c) => size_from(c, 0, 0)
size_from(c, b, n) => if b == 256 then n else size_from(c, b + 1, if has(c, b) then n + 1 else n)
