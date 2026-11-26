// Allegretto's grammar, as a value, written in Allegretto.
//
// Whose: the kernel stream (lane R). Decision: "The parser engine and the
// module loader are written in Allegretto" (docs/plans/book-pass.md
// section 10, chunk E7). The forms are those of
// next/ext/allegretto/forms.md section 2.
//
// `language` is the grammar. What a text gives, read as it, is the tree
// of the text: what is written, form by form, each part with its place.
// Nothing is given a meaning here: which names are bound, what an
// operator stands for and what a block becomes are for what reads the
// tree. `shown(tree)` writes a tree as a text, for comparing two
// readers.
//
// A module's tree is {headers, items, at}, `at` the place of the whole
// text. A header is
// {k, name, pairs, without, at}, with k one of `capability, `input,
// `key, `import and `use. A `use` has two things more: `path`, the names
// of `use m.a.b` in order, and `changing`, the names after that word. A
// `use` in a block is an item of the block, in its place. A line `use`
// asks for a change of the grammar (grammar.turns): the lines after it,
// to the end of its lines, are read in the grammar whoever began the
// reading gives for it (reader.alg).
//
// The rules a notation may name: `lines` and `line`; `body` and `block`;
// `expression`, which is `taking` (a form that takes all that follows:
// `if`, a function, a sign before an operand) or `operators`, the row
// of signs, whose levels are `piped`, `either`, `both`, `equal`,
// `ordered`, `joined`, `sum` and `product`, each binding tighter than
// the one before; `prefixed` and `applied`, an operand with what stands
// before and after it; `primary`, an operand by itself; and `field`.
// An item is one of
//
//   {k: `binding, name, value, exported, at}
//   {k: `function, name, params, body, exported, at}
//   {k: `arrow, name, value, at}
//   {k: `statement, expr, at}
//
// and an expression one of
//
//   {k: `text, bytes, at}       {k: `int, value, at}      {k: `float, value, at}
//   {k: `truth, value, at}      {k: `symbol, name, at}    {k: `name, name, at}
//   {k: `lambda, params, body, at}
//   {k: `apply, fn, args, at}   {k: `pipe, value, fn, at}
//   {k: `dot, object, name, at} {k: `index, object, index, at}
//   {k: `if, condition, then, otherwise, at}
//   {k: `binary, op, left, right, at}   {k: `unary, op, operand, at}
//   {k: `record, fields, at}    {k: `list, items, at}
//   {k: `block, items, sync, at}
//
// A name where it is bound or read as a key is {name, at}. A field of a
// record is {k: `named, name, value} or {k: `computed, key, value, at}.
//
// Layout. Blocks are by indentation (offside.alg). A word or a sign
// reads the space after it, and a line deeper than its block carries on
// the line before it. Inside brackets, after the opening one, around a
// comma and before the closing one, any space is read, line ends among
// it. A body, after `=`, `=>`, `<-`, `then` and `else`, is a block where
// one can be read there, and an expression otherwise. A block's place
// begins at the end of the line before it, and with `sync` before it,
// straight after the sign.
//
// A conditional and a function take all that follows them. So among
// signs written between operands they stand last or not at all, and
// anywhere inside brackets.
import class
import grammar
import levels
import offside

byte = grammar.byte
ref = grammar.ref
seq = grammar.seq
alt = grammar.alt
star = grammar.star
opt = grammar.opt
giving = grammar.giving
spaced = grammar.spaced

// ---- Space ----

// The position after spaces, tabs and comments. A comment between
// strokes and stars may run over lines.
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

o = offside.made(blank)

// Any space: spaces, tabs, comments and line ends, whatever the block.
wide = grammar.term("space", (text, at) => widely(text, at, blank(text, at)), false, class.no_ranges, true)
widely(text, at, p) => if byte(text, p) == 10 then widely(text, at, blank(text, p + 1)) else p - at
// The space the grammar's own function reads, as a terminal: after a block ends, under the block around it.
gap = grammar.stepper("space", (text, at, st) => {read: o.space(text, at, st), state: st}, false, class.no_ranges, true)

// ---- Words and signs ----

letters = class.made(class.pairs("azAZ__"))
word_bytes = class.made(class.pairs("azAZ__09"))
digits = class.made(class.pairs("09"))
hex_digits = class.made(class.pairs("09afAF"))
span(text, c, at, n) => if class.has(c, byte(text, at + n)) then span(text, c, at, n + 1) else n

sign(t) => spaced(grammar.lit(t))
// The sign of one byte b: a brace cannot be written in a text.
one_byte(b) => bits.slice(b, 56, 8)
// A word written out, with no letter or digit after it.
word(t) => spaced(grammar.term(t, whole_word(grammar.lit(t).match), true, grammar.lit(t).ranges, false))
whole_word(match) => (text, at) => not_longer(text, at, match(text, at))
not_longer(text, at, n) => if n < 0 || class.has(word_bytes, byte(text, at + n)) then -1 else n

// A name: letters, digits and underscores, the first no digit, and no reserved word.
plain_name = giving(grammar.unless(grammar.term("a name", (text, at) => if class.has(letters, byte(text, at)) then span(text, word_bytes, at, 1) else -1, true, class.pairs("azAZ__"), false), `keywords), (v, at) => {name: v, at: at})
name = spaced(plain_name)
name_used = giving(name, (v, at) => {k: `name, name: v.name, at: at})

// A number: 0x and hex digits, digits with a point and digits, or digits.
number = spaced(giving(grammar.term("a number", (text, at) => a_number(text, at), true, class.pairs("09"), false), (v, at) => numbered(v, at)))
a_number(text, at) =>
  if !class.has(digits, byte(text, at)) then -1
  else if byte(text, at) == 48 && (byte(text, at + 1) == 120 || byte(text, at + 1) == 88) && class.has(hex_digits, byte(text, at + 2)) then span(text, hex_digits, at, 3)
  else fraction(text, at, span(text, digits, at, 1))
fraction(text, at, n) => if byte(text, at + n) == 46 && class.has(digits, byte(text, at + n + 1)) then n + 1 + span(text, digits, at + n + 1, 1) else n
// `written` is the digits as written, kept for a minus before the number.
numbered(v, at) =>
  if point_in(v, 0) >= 0 then {k: `float, value: float_of(v, point_in(v, 0)), at: at, written: v, bare: true}
  else if bits.length(v) > 16 && bits.slice(v, 8, 8) != "0" && bits.slice(v, 8, 8) != "1" && class.has(letters, bits.int(bits.slice(v, 8, 8))) then {k: `int, value: hex_of(v, 2, 0), at: at, written: v, bare: true}
  else {k: `int, value: text.int(v), at: at, written: v, bare: true}
point_in(v, i) => if i * 8 >= bits.length(v) then -1 else if bits.slice(v, i * 8, 8) == "." then i else point_in(v, i + 1)
// The digits before the point and after it as one whole number, over ten to the count of those after.
float_of(v, p) => float.div(int.float(text.int(bits.slice(v, 0, p * 8) ++ bits.slice(v, (p + 1) * 8, bits.length(v) - (p + 1) * 8))), int.float(ten_to(bits.length(v) / 8 - p - 1)))
ten_to(n) => if n == 0 then 1 else 10 * ten_to(n - 1)
hex_of(v, i, n) => if i * 8 >= bits.length(v) then n else hex_of(v, i + 1, n * 16 + hex_digit(bits.int(bits.slice(v, i * 8, 8))))
hex_digit(b) => if b <= 57 then b - 48 else if b <= 70 then b - 55 else b - 87

// A text between quotes, with no brace in it. 34 is the quote, 92 the
// stroke that marks one of four: a quote, a stroke, n for the end of a
// line, t for a tab.
quoted = spaced(giving(grammar.term("a text", (text, at) => if byte(text, at) == 34 then closing(text, at, 1) else -1, true, class.pairs("\"\""), false), (v, at) => {k: `text, bytes: unmarked(v, 1, 1, ""), at: at}))
closing(text, at, n) =>
  if byte(text, at + n) == 34 then n + 1
  else if byte(text, at + n) == 92 && byte(text, at + n + 1) != -1 then closing(text, at, n + 2)
  else if byte(text, at + n) == -1 || byte(text, at + n) == 123 then -1
  else closing(text, at, n + 1)
// The bytes of a quoted text v: from `from`, the bytes up to i are plain and not yet put to `out`.
unmarked(v, from, i, out) =>
  if (i + 1) * 8 >= bits.length(v) then out ++ bits.slice(v, from * 8, (i - from) * 8)
  else if bits.slice(v, i * 8, 8) == "\\" then unmarked(v, i + 2, i + 2, out ++ bits.slice(v, from * 8, (i - from) * 8) ++ marked_byte(bits.int(bits.slice(v, (i + 1) * 8, 8))))
  else unmarked(v, from, i + 1, out)
marked_byte(b) => if b == 34 then "\"" else if b == 92 then "\\" else if b == 110 then "\n" else if b == 116 then "\t" else refuse("a text marks a byte that is none of the four")

// A symbol as data: the mark and any word, a reserved one among them. 96 is the mark.
marked = spaced(giving(grammar.term("a symbol", (text, at) => if byte(text, at) == 96 && class.has(letters, byte(text, at + 1)) then span(text, word_bytes, at, 2) else -1, true, class.with_range(class.no_ranges, 96, 96), false), (v, at) => {k: `symbol, name: bits.slice(v, 8, bits.length(v) - 8), at: at}))

// ---- Brackets ----

// What stands between an opening bracket and its closing one, with any space inside them.
between(open, inside, close) => giving(seq([grammar.lit(open), wide, inside, wide, sign(close)]), (v, at) => {v: v[2], at: at})
// Items with commas between and any space around the commas, with one more comma allowed after the last; or none.
listed(item) => giving(opt(seq([item, star(giving(seq([wide, grammar.lit(","), wide, item]), (v, at) => v[3])), opt(seq([wide, grammar.lit(",")]))])), (v, at) => if count(v) == 0 then [] else with_first(v[0][0], v[0][1], 0, [v[0][0]]))
with_first(first, more, i, out) => if i == count(more) then out else with_first(first, more, i + 1, put(out, [], more[i]))
// Items with commas between, the space the grammar reads after each; or none.
in_line(item) => giving(opt(seq([item, star(giving(seq([sign(","), item]), (v, at) => v[1]))])), (v, at) => if count(v) == 0 then [] else with_first(v[0][0], v[0][1], 0, [v[0][0]]))

// ---- Signs between operands ----

binds(name, signs, looser) => levels.after(levels.level(name, signs, `left), [looser])
ladder = [
  levels.level(`piped, ["|>"], `left),
  binds(`either, ["||"], `piped),
  binds(`both, ["&&"], `either),
  binds(`equal, ["==", "!="], `both),
  binds(`ordered, ["<=", ">=", "<", ">"], `equal),
  binds(`joined, ["++"], `ordered),
  binds(`sum, ["+", "-"], `joined),
  binds(`product, ["*", "/", "%"], `sum)]
signed = (sign, left, right, at) => if sign == "|>" then {k: `pipe, value: left, fn: right, at: at} else {k: `binary, op: sign, left: left, right: right, at: at}

// ---- What the forms give ----

// A minus before a number written out: with a fraction it is part of
// the number, and before the one whole number that is too large by one
// it gives the least integer.
minus(v, at) =>
  if v.k == `float && v.bare then {k: `float, value: float.neg(v.value), at: at, written: v.written, bare: false}
  else if v.k == `int && v.bare && v.written == "9223372036854775808" then {k: `int, value: -9223372036854775807 - 1, at: at, written: v.written, bare: false}
  else {k: `unary, op: "-", operand: v, at: at}
// A number in brackets is no longer written out.
covered(v) =>
  if v.k == `float then {k: `float, value: v.value, at: v.at, written: v.written, bare: false}
  else if v.k == `int then {k: `int, value: v.value, at: v.at, written: v.written, bare: false}
  else v
// What follows an operand: arguments, a name after a point, or a place in brackets, each from where the operand began.
followed(base, more, i) => if i == count(more) then base.v else followed({v: one_more(base, more[i]), at: base.at}, more, i + 1)
one_more(base, m) =>
  if m.k == `call then {k: `apply, fn: base.v, args: m.v, at: {source: base.at.source, start: base.at.start, end: m.at.end}}
  else if m.k == `dot then {k: `dot, object: base.v, name: m.v, at: {source: base.at.source, start: base.at.start, end: m.at.end}}
  else {k: `index, object: base.v, index: m.v, at: {source: base.at.source, start: base.at.start, end: m.at.end}}
// The lines of a module: its header lines apart from its items.
sorted(lines, i, headers, items, at) =>
  if i == count(lines) then {headers: headers, items: items, at: at}
  else if lines[i].header then sorted(lines, i + 1, put(headers, [], lines[i]), items, at)
  else sorted(lines, i + 1, headers, put(items, [], lines[i]), at)
// A header line with its two lists, each clause {with, v}.
headed(k, v, at) => {header: true, k: k, name: v[1], pairs: gathered(v[2], true, 0, []), without: gathered(v[2], false, 0, []), at: at}
gathered(clauses, with, i, out) =>
  if i == count(clauses) then out
  else if clauses[i].with == with then gathered(clauses, with, i + 1, with_first([], clauses[i].v, 0, out))
  else gathered(clauses, with, i + 1, out)

// ---- The rules ----

// A line `use` asks for a change of the grammar: the lines after it, to the end of its lines, are read in the grammar changed.
asks_change(v) => if v.header && v.k == `use then [v] else []
// The space on one line: what stands between a sign and a block, which begins at the end of that line.
level_space = grammar.term("space", (text, at) => blank(text, at) - at, false, class.no_ranges, true)
// A word and a sign that a body follows read no space: the body says what space it takes.
bare_word(t) => grammar.term(t, whole_word(grammar.lit(t).match), true, grammar.lit(t).ranges, false)
block = giving(seq([o.indent_from, ref(`lines), o.dedent]), (v, at) => v[1])
with_clause = giving(seq([word("with"), giving(seq([name, sign(":"), ref(`expression)]), (v, at) => {name: v[0], value: v[2]}), star(giving(seq([wide, grammar.lit(","), wide, giving(seq([name, sign(":"), ref(`expression)]), (v, at) => {name: v[0], value: v[2]})]), (v, at) => v[3]))]), (v, at) => {with: true, v: with_first(v[1], v[2], 0, [v[1]])})
without_clause = giving(seq([word("without"), name, star(giving(seq([wide, grammar.lit(","), wide, name]), (v, at) => v[3]))]), (v, at) => {with: false, v: with_first(v[1], v[2], 0, [v[1]])})
module_line(w, k) => giving(seq([word(w), name, star(alt([with_clause, without_clause]))]), (v, at) => headed(k, v, at))
header_line(w, k) => giving(seq([word(w), name]), (v, at) => {header: true, k: k, name: v[1], pairs: [], without: [], at: at})
// `use m.a` with the rules it may change beyond adding: the path as names, the first of them the module's.
// The line asks for a change of the grammar, so it ends at one place: each repetition is read as far as it goes.
use_line = giving(seq([word("use"), name, star(giving(seq([sign("."), name]), (v, at) => v[1])), grammar.guard(grammar.lit("."), false), opt(use_changing), grammar.guard(grammar.lit("changing"), false)]), (v, at) => {header: true, k: `use, name: v[1], path: with_first(v[1], v[2], 0, [v[1]]), changing: if count(v[4]) == 0 then [] else v[4][0], pairs: [], without: [], at: at})
use_changing = giving(seq([word("changing"), name, star(giving(seq([wide, grammar.lit(","), wide, name]), (v, at) => v[3])), grammar.guard(seq([wide, grammar.lit(",")]), false)]), (v, at) => with_first(v[1], v[2], 0, [v[1]]))
parameters = between("(", listed(name), ")")

export language = grammar.with_state(grammar.with_space(grammar.with_reserved(grammar.grammar(`module, rules), `keywords, ["if", "else", "when", "is", "of", "and", "import", "export", "true", "false", "none", "error", "instanceof", "subtypeof"]), o.space, true), offside.begun)
rules = {
  lines: grammar.turns(`lines, ref(`line), o.newline, asks_change),
  module: giving(seq([wide, opt(ref(`lines)), o.ending]), (v, at) => if count(v[1]) == 0 then {headers: [], items: [], at: at} else sorted(v[1][0], 0, [], [], at)),
  line: alt([
    header_line("capability", `capability), header_line("input", `input), header_line("key", `key), module_line("import", `import), use_line,
    giving(seq([opt(word("export")), plain_name, parameters, grammar.lit("=>"), ref(`body)]), (v, at) => {header: false, k: `function, name: v[1], params: v[2].v, body: v[4], exported: count(v[0]) == 1, at: at}),
    giving(seq([opt(word("export")), name, grammar.lit("="), ref(`body)]), (v, at) => {header: false, k: `binding, name: v[1], value: v[3], exported: count(v[0]) == 1, at: at}),
    giving(seq([name, grammar.lit("<-"), ref(`body)]), (v, at) => {header: false, k: `arrow, name: v[0], value: v[2], at: at}),
    giving(seq([grammar.guard(seq([name, sign("<-")]), false), ref(`expression)]), (v, at) => {header: false, k: `statement, expr: v[1], at: at})]),
  body: alt([
    giving(seq([level_space, giving(ref(`block), (v, at) => {k: `block, items: v, sync: false, at: at})]), (v, at) => v[1]),
    giving(ref(`sync_block), (v, at) => {k: `block, items: v[3], sync: true, at: at}),
    giving(seq([grammar.guard(alt([seq([level_space, ref(`block)]), ref(`sync_block)]), false), gap, ref(`expression)]), (v, at) => v[2])]),
  sync_block: seq([level_space, bare_word("sync"), level_space, ref(`block)]),
  block: block,
  expression: alt([ref(`taking), ref(`operators)]),
  operators: levels.row_ending(ref(`prefixed), ref(`taking), ladder, sign, signed),
  taking: alt([
    giving(seq([word("if"), ref(`expression), bare_word("then"), ref(`body), gap, bare_word("else"), ref(`body)]), (v, at) => {k: `if, condition: v[1], then: v[3], otherwise: v[6], at: at}),
    giving(seq([name, sign("=>"), ref(`expression)]), (v, at) => {k: `lambda, params: [v[0]], body: v[2], at: at}),
    giving(seq([parameters, sign("=>"), ref(`expression)]), (v, at) => {k: `lambda, params: v[0].v, body: v[2], at: at}),
    giving(seq([sign("-"), ref(`taking)]), (v, at) => {k: `unary, op: "-", operand: v[1], at: at}),
    giving(seq([sign("!"), ref(`taking)]), (v, at) => {k: `unary, op: "!", operand: v[1], at: at})]),
  prefixed: alt([
    giving(seq([sign("-"), ref(`prefixed)]), (v, at) => minus(v[1], at)),
    giving(seq([sign("!"), ref(`prefixed)]), (v, at) => {k: `unary, op: "!", operand: v[1], at: at}),
    ref(`applied)]),
  applied: giving(seq([giving(ref(`primary), (v, at) => {v: v, at: at}), star(alt([
    giving(between("(", in_line(ref(`expression)), ")"), (v, at) => {k: `call, v: v.v, at: at}),
    giving(seq([sign("."), name]), (v, at) => {k: `dot, v: v[1], at: at}),
    giving(between("[", ref(`expression), "]"), (v, at) => {k: `index, v: v.v, at: at})]))]), (v, at) => followed(v[0], v[1], 0)),
  primary: alt([
    number, quoted, marked,
    giving(word("true"), (v, at) => {k: `truth, value: true, at: at}),
    giving(word("false"), (v, at) => {k: `truth, value: false, at: at}),
    name_used,
    giving(between("(", ref(`expression), ")"), (v, at) => covered(v.v)),
    giving(between("[", listed(ref(`expression)), "]"), (v, at) => {k: `list, items: v.v, at: at}),
    giving(seq([grammar.lit(one_byte(123)), wide, listed(ref(`field)), wide, sign(one_byte(125))]), (v, at) => {k: `record, fields: v[2], at: at})]),
  field: alt([
    giving(seq([name, sign(":"), ref(`expression)]), (v, at) => {k: `named, name: v[0], value: v[2]}),
    giving(seq([between("[", ref(`expression), "]"), sign(":"), ref(`expression)]), (v, at) => {k: `computed, key: v[0].v, value: v[2], at: at})])}

// ---- A tree as a text ----
//
// One form for every part, so that two readers that give the same tree
// write the same text: (k parts @start-end:line:column). The numbers of a
// place are of its beginning, but for the end; a text's bytes are
// written as hex.
export shown(m) => "(module (" ++ each(m.headers, shown_header, 0) ++ ") (" ++ each(m.items, shown_item, 0) ++ "))"
each(l, f, i) => if i == count(l) then "" else (if i == 0 then "" else " ") ++ f(l[i]) ++ each(l, f, i + 1)
placed(at) => "@" ++ int.text(at.start.index) ++ "-" ++ int.text(at.end.index) ++ ":" ++ int.text(at.start.line) ++ ":" ++ int.text(at.start.column)
shown_name(n) => n.name ++ placed(n.at)
shown_header(h) => "(" ++ spelling(h.k) ++ " " ++ shown_name(h.name) ++ " (" ++ each(h.pairs, p => "(" ++ shown_name(p.name) ++ " " ++ shown_expr(p.value) ++ ")", 0) ++ ") (" ++ each(h.without, shown_name, 0) ++ ") " ++ placed(h.at) ++ ")"
truth(b) => if b then "true" else "false"
shown_item(i) =>
  if i.k == `binding then "(binding " ++ shown_name(i.name) ++ " " ++ truth(i.exported) ++ " " ++ shown_expr(i.value) ++ " " ++ placed(i.at) ++ ")"
  else if i.k == `function then "(function " ++ shown_name(i.name) ++ " (" ++ each(i.params, shown_name, 0) ++ ") " ++ truth(i.exported) ++ " " ++ shown_expr(i.body) ++ " " ++ placed(i.at) ++ ")"
  else if i.k == `arrow then "(arrow " ++ shown_name(i.name) ++ " " ++ shown_expr(i.value) ++ " " ++ placed(i.at) ++ ")"
  else "(statement " ++ shown_expr(i.expr) ++ " " ++ placed(i.at) ++ ")"
shown_expr(e) => "(" ++ spelling(e.k) ++ " " ++ parts(e) ++ " " ++ placed(e.at) ++ ")"
parts(e) =>
  if e.k == `text then hex(e.bytes, 0)
  else if e.k == `int then int.text(e.value)
  else if e.k == `float then float.text(e.value)
  else if e.k == `truth then truth(e.value)
  else if e.k == `symbol || e.k == `name then e.name
  else if e.k == `lambda then "(" ++ each(e.params, shown_name, 0) ++ ") " ++ shown_expr(e.body)
  else if e.k == `apply then shown_expr(e.fn) ++ " (" ++ each(e.args, shown_expr, 0) ++ ")"
  else if e.k == `pipe then shown_expr(e.value) ++ " " ++ shown_expr(e.fn)
  else if e.k == `dot then shown_expr(e.object) ++ " " ++ shown_name(e.name)
  else if e.k == `index then shown_expr(e.object) ++ " " ++ shown_expr(e.index)
  else if e.k == `if then shown_expr(e.condition) ++ " " ++ shown_expr(e.then) ++ " " ++ shown_expr(e.otherwise)
  else if e.k == `binary then e.op ++ " " ++ shown_expr(e.left) ++ " " ++ shown_expr(e.right)
  else if e.k == `unary then e.op ++ " " ++ shown_expr(e.operand)
  else if e.k == `record then "(" ++ each(e.fields, shown_field, 0) ++ ")"
  else if e.k == `list then "(" ++ each(e.items, shown_expr, 0) ++ ")"
  else truth(e.sync) ++ " (" ++ each(e.items, shown_item, 0) ++ ")"
shown_field(f) => if f.k == `named then "(named " ++ shown_name(f.name) ++ " " ++ shown_expr(f.value) ++ ")" else "(computed " ++ shown_expr(f.key) ++ " " ++ shown_expr(f.value) ++ " " ++ placed(f.at) ++ ")"
hex(b, i) => if i * 8 >= bits.length(b) then "" else nibble(bits.int(bits.slice(b, i * 8, 8)) / 16) ++ nibble(bits.int(bits.slice(b, i * 8, 8)) % 16) ++ hex(b, i + 1)
nibble(n) => bits.slice("0123456789abcdef", n * 8, 8)
