// A grammar for Allegretto written flat, as a value.
//
// Whose: the kernel stream (lane R). It is the text the engine's speed
// is measured on (docs/plans/book-pass.md section 10.6 item 1), and a
// first part of Allegretto's own grammar, which a later chunk completes.
//
// Flat means with no indented block: a module of declarations, bindings
// and statements, each beginning in the first column, where a line that
// begins with a space carries on the one before it. The forms are those
// of next/ext/allegretto/forms.md section 2, but for the block, `sync`,
// `<-`, `import` with `with` or `without`, and `use`.
//
// There is no scanner. A terminal that reads a word or a sign is made
// `spaced`, so it also reads the space after it: spaces, tabs, comments,
// and the end of a line where the next line with anything on it begins
// with a space. So what a
// rule can begin with is never a space, and the engine's test of one
// byte is of the byte that matters.
//
// Signs written between operands are read as one row: an operand, and
// then a sign and an operand any number of times. What the row gives is
// grouped by the levels of the signs (levels.alg), in the order forms.md
// gives, loosest first: `|>`; `||`; `&&`; `==` `!=`; `<` `>` `<=` `>=`;
// `++`; `+` `-`; `*` `/` `%`. A rule for each level would read the same
// texts with ten times the work for each operand. A conditional and a
// function are read where a whole expression may stand, and inside
// brackets anywhere else.
//
// The forms give no descriptions yet, but for the row: that is a later
// chunk's, with the rest of Allegretto's grammar.
import class
import grammar
import levels

byte = grammar.byte
ref = grammar.ref
seq = grammar.seq
alt = grammar.alt
star = grammar.star
opt = grammar.opt

// ---- Space ----

// The position after spaces, tabs and comments, on one line. 32 is the
// space, 9 the tab, 13 the return, 47 the stroke, 42 the star, 10 the
// end of a line.
blank(text, at) => blank_on(text, at, byte(text, at))
blank_on(text, at, b) =>
  if b == 32 || b == 9 || b == 13 then blank(text, at + 1)
  else if b == 47 then comment(text, at, byte(text, at + 1))
  else at
comment(text, at, b) =>
  if b == 47 then blank(text, line_end(text, at + 2))
  else if b == 42 then blank(text, comment_end(text, at + 2))
  else at
line_end(text, at) => if byte(text, at) == 10 || byte(text, at) == -1 then at else line_end(text, at + 1)
comment_end(text, at) =>
  if byte(text, at) == -1 then at
  else if byte(text, at) == 42 && byte(text, at + 1) == 47 then at + 2
  else comment_end(text, at + 1)

// How many bytes of space there are from `at`: the space on this line,
// and where the line ends there and the next line with anything on it
// begins with a space, the space up to what that line has.
space(text, at) => space_to(text, at, blank(text, at))
space_to(text, at, p) => if byte(text, p) == 10 then carried(text, at, p, carries(text, p + 1)) else p - at
carried(text, at, p, r) => if r < 0 then p - at else r - at
// `q` is where a line begins. Where the next line with anything on it
// begins with a space, the position of what it has; otherwise -1.
carries(text, q) => carries_at(text, q, blank(text, q))
carries_at(text, q, r) =>
  if byte(text, r) == 10 then carries(text, r + 1)
  else if byte(text, r) == -1 then -1
  else if byte(text, q) == 32 || byte(text, q) == 9 then r
  else -1

// The end of a statement: the end of the line, and all up to the next
// line that begins in the first column, or the end of the text.
ending = grammar.term("the end of a line", (text, at) => ended(text, at, blank(text, at)), false, class.no_ranges, true)
ended(text, at, p) =>
  if byte(text, p) == -1 then p - at
  else if byte(text, p) == 10 then first_column(text, at, p + 1, blank(text, p + 1))
  else -1
first_column(text, at, q, r) =>
  if byte(text, r) == 10 then first_column(text, at, r + 1, blank(text, r + 1))
  else if byte(text, r) == -1 then r - at
  else if byte(text, q) == 32 || byte(text, q) == 9 then -1
  else r - at
// What a module begins with: empty lines and comments, up to its first line.
opening = grammar.term("the beginning of a module", (text, at) => first_column(text, at, at, blank(text, at)), false, class.no_ranges, true)

// ---- Words and signs ----

spaced = grammar.spaced
sign(t) => spaced(grammar.lit(t))
// The sign of one byte b: a brace cannot be written in a text.
sign_of(b) => sign(bits.slice(b, 56, 8))

letters = class.made(class.pairs("azAZ__"))
word_bytes = class.made(class.pairs("azAZ__09"))
digits = class.made(class.pairs("09"))
span(text, c, at, n) => if class.has(c, byte(text, at + n)) then span(text, c, at, n + 1) else n

// A word written out, with no letter or digit after it.
word(t) => spaced(grammar.term(t, whole_word(grammar.lit(t).match), true, grammar.lit(t).ranges, false))
whole_word(match) => (text, at) => not_longer(text, at, match(text, at))
not_longer(text, at, n) => if n < 0 || class.has(word_bytes, byte(text, at + n)) then -1 else n

// A name: letters, digits and underscores, the first no digit, and not
// one of the words that are forms: the reserved set `forms`.
name = spaced(grammar.unless(grammar.term("a name", (text, at) => if class.has(letters, byte(text, at)) then span(text, word_bytes, at, 1) else -1, true, class.pairs("azAZ__"), false), `forms))

// A number: digits and letters after a digit, and a point with digits after it.
number = spaced(grammar.term("a number", (text, at) => a_number(text, at), true, class.pairs("09"), false))
a_number(text, at) => if class.has(digits, byte(text, at)) then fraction(text, at, span(text, word_bytes, at, 1)) else -1
fraction(text, at, n) =>
  if byte(text, at + n) == 46 && class.has(digits, byte(text, at + n + 1)) then n + 1 + span(text, digits, at + n + 1, 1)
  else n

// A text between quotes. 34 is the quote and 92 the stroke that makes
// the byte after it part of the text.
quoted = spaced(grammar.term("a text", (text, at) => if byte(text, at) == 34 then closing(text, at, 1) else -1, true, class.pairs("\"\""), false))
closing(text, at, n) =>
  if byte(text, at + n) == 34 then n + 1
  else if byte(text, at + n) == 92 then closing(text, at, n + 2)
  else if byte(text, at + n) == -1 || byte(text, at + n) == 10 then -1
  else closing(text, at, n + 1)

// A symbol as data: the mark and any word. 96 is the mark.
marked = spaced(grammar.term("a symbol", (text, at) => if byte(text, at) == 96 && class.has(letters, byte(text, at + 1)) then span(text, word_bytes, at, 2) else -1, true, class.with_range(class.no_ranges, 96, 96), false))

// ---- The rules ----

// The levels of the signs written between operands, loosest first, as
// forms.md has them: each binds tighter than the one before it, and all
// group from the left. Where one sign begins another, as `<` begins
// `<=`, both are tried, and one of them goes on.
binds(name, signs, looser) => levels.after(levels.level(name, signs, `left), [looser])
between = [
  levels.level(`piped, ["|>"], `left),
  binds(`either, ["||"], `piped),
  binds(`both, ["&&"], `either),
  binds(`equal, ["==", "!="], `both),
  binds(`ordered, ["<=", ">=", "<", ">"], `equal),
  binds(`joined, ["++"], `ordered),
  binds(`sum, ["+", "-"], `joined),
  binds(`product, ["*", "/", "%"], `sum)]
// What a sign with its two operands gives: for now the three, and the place.
signed = (sign, left, right, at) => {sign: sign, left: left, right: right, at: at}

// Items with commas between, or none.
listed(item) => opt(seq([item, star(seq([sign(","), item]))]))

export allegretto = grammar.with_space(grammar.with_reserved(grammar.grammar(`module, rules), `forms, ["if", "else", "true", "false"]), (text, at, state) => space(text, at), [])
rules = {
  module: seq([opening, star(seq([ref(`line), ending])), grammar.end]),
  line: alt([ref(`declaration), ref(`binding), ref(`expression)]),
  declaration: seq([alt([word("capability"), word("input"), word("key"), word("import")]), name]),
  binding: seq([opt(word("export")), name, alt([seq([sign("("), ref(`names), sign(")"), sign("=>"), ref(`expression)]), seq([sign("="), ref(`expression)])])]),
  names: listed(name),
  expression: alt([ref(`condition), ref(`function), ref(`operation)]),
  condition: seq([word("if"), ref(`expression), word("then"), ref(`expression), word("else"), ref(`expression)]),
  function: seq([alt([name, seq([sign("("), ref(`names), sign(")")])]), sign("=>"), ref(`expression)]),
  operation: levels.row(ref(`prefixed), between, sign, signed),
  prefixed: alt([seq([alt([sign("-"), sign("!")]), ref(`prefixed)]), ref(`applied)]),
  applied: seq([ref(`primary), star(alt([seq([sign("("), ref(`arguments), sign(")")]), seq([sign("."), name]), seq([sign("["), ref(`expression), sign("]")])]))]),
  primary: alt([number, quoted, marked, word("true"), word("false"), name, seq([sign("("), ref(`expression), sign(")")]), seq([sign("["), ref(`arguments), sign("]")]), seq([sign_of(123), ref(`fields), sign_of(125)])]),
  arguments: listed(ref(`expression)),
  fields: listed(ref(`field)),
  field: seq([alt([name, seq([sign("["), ref(`expression), sign("]")])]), sign(":"), ref(`expression)])}
