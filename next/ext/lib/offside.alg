// Blocks by indentation, as terminals that read a state.
//
// Whose: the kernel stream (lane R). Decision: "Offside rule through
// stateful indent terminals" (docs/plans/book-pass.md section 10).
//
// The state is the columns of the blocks being read, the innermost
// first, each a number of 64 bits: `begun` is the state of a text whose
// outermost block is in the first column. The column of a line is the
// number of bytes before what the line has, so a tab counts as one.
//
// `made(blank)` gives the terminals for a language. `blank(text, at)` is
// the language's own: the position after the spaces and comments on one
// line, never past the end of a line.
//
//   space      for grammar.with_space: the space on this line, and where
//              the line ends there and the next line with anything on it
//              is deeper than the block, the space up to what it has. So
//              a line carries on the one before it by being deeper than
//              its block, and needs no form of its own.
//   newline    the end of a line, up to the next line with anything on
//              it, where that line is at the block's column.
//   indent     reads nothing: holds at the first thing on a line that is
//              deeper than the block. That column is the new block's.
//   dedent     reads nothing: holds at the end of a line where the next
//              line with anything on it is less deep than the block, or
//              there is none. The block before is the block again.
//   sameline   reads nothing: holds where something came before on this
//              line.
//   ending     the empty lines and comments up to the end of the text.
//
// A block is `indent`, its statements with `newline` between, `dedent`.
// A text that ends inside three blocks has three `dedent` at its end.
import class
import grammar

byte = grammar.byte

export begun = 0
top(st) => bits.int(bits.slice(st, 0, 64))

// The position of what the next line with anything on it has, from the
// beginning q of a line; -1 where no line has anything.
content(text, blank, q) => content_at(text, blank, blank(text, q))
content_at(text, blank, r) =>
  if byte(text, r) == 10 then content(text, blank, r + 1)
  else if byte(text, r) == -1 then -1
  else r
// The column of a position: the bytes between it and the beginning of its line.
column(text, r) => r - line_start(text, r)
line_start(text, r) => if r == 0 || byte(text, r - 1) == 10 then r else line_start(text, r - 1)
// True where nothing but spaces and tabs is before a position on its line.
leads(text, at) =>
  if at == 0 || byte(text, at - 1) == 10 then true
  else if byte(text, at - 1) == 32 || byte(text, at - 1) == 9 then leads(text, at - 1)
  else false

export made(blank) => {
  space: (text, at, st) => space_to(text, blank, at, st, blank(text, at)),
  newline: grammar.stepper("a new line", (text, at, st) => line_to(text, blank, at, st, blank(text, at)), false, class.no_ranges, false),
  indent: grammar.stepper("a deeper line", (text, at, st) => deeper(text, at, st), false, class.no_ranges, true),
  dedent: grammar.stepper("the end of a block", (text, at, st) => shallower(text, blank, st, blank(text, at)), false, class.no_ranges, true),
  sameline: grammar.term("more on the line", (text, at) => if leads(text, at) || byte(text, at) == 10 || byte(text, at) == -1 then -1 else 0, false, class.no_ranges, true),
  ending: grammar.term("the end of the text", (text, at) => if content(text, blank, at) < 0 then bits.length(text) / 8 - at else -1, false, class.no_ranges, true)}

space_to(text, blank, at, st, p) => if byte(text, p) == 10 then carried(text, at, st, p, content(text, blank, p + 1)) else p - at
carried(text, at, st, p, r) => if r >= 0 && column(text, r) > top(st) then r - at else p - at

line_to(text, blank, at, st, p) => if byte(text, p) == 10 then level(text, at, st, content(text, blank, p + 1)) else []
level(text, at, st, r) => if r >= 0 && column(text, r) == top(st) then {read: r - at, state: st} else []

deeper(text, at, st) =>
  if leads(text, at) && byte(text, at) != 10 && byte(text, at) != -1 && column(text, at) > top(st) then {read: 0, state: column(text, at) ++ st}
  else []

shallower(text, blank, st, p) =>
  if bits.length(st) <= 64 then []
  else if byte(text, p) == -1 then left(st)
  else if byte(text, p) == 10 then out_of(text, st, content(text, blank, p + 1))
  else []
out_of(text, st, r) => if r < 0 || column(text, r) < top(st) then left(st) else []
left(st) => {read: 0, state: bits.slice(st, 64, bits.length(st) - 64)}
