// Simple regex-like pattern DSL built from grammar combinator primitives.
// Supports: literal chars [a-zA-Z0-9], | alternation, *, +, ? postfix.
// (Grouping via parentheses deferred — exposes an evaluator issue with
// mutual recursion between match_base and match_pattern.)
//
// Demonstrates:
//   - Building a full grammar from Allegro using parser combinators
//   - Post-processing parse trees in pure Allegro to implement semantics

// --- 1. Build the regex DSL grammar ---
g = grammar_new({whitespace: ""})

chr = grammar_terminal(g, "/[a-zA-Z0-9]/")
pipe = grammar_terminal(g, "|")
star = grammar_terminal(g, "*")
plus = grammar_terminal(g, "+")
qmark = grammar_terminal(g, "?")

// postfix := "*" | "+" | "?"
postfix = grammar_choice(g, [star, plus, qmark])

// atom := chr postfix?
atom = grammar_phrase(g, [chr, grammar_optional(g, postfix)])

// concat := atom+
concat_rule = grammar_repeat(g, atom, {min: 1})

// alt := concat ("|" concat)*
alt_rule = grammar_repeat(g, concat_rule, {min: 1, delimiter: pipe})

grammar_set_target(g, alt_rule)

// --- 2. Interpreter over parse trees ---

match_literal_char(ch, input) =>
  if input.length > 0 && input.charAt(0) == ch
    then input.slice(1, input.length)
    else none

match_atom(atom_node, input) =>
  ch = atom_node[0]
  post = atom_node[1]
  when post
    is none then match_literal_char(ch, input)
    is "*" then match_zero_or_more(ch, input)
    is "+" then match_one_or_more(ch, input)
    is "?" then match_zero_or_one(ch, input)
    is _ then match_literal_char(ch, input)

match_zero_or_more(ch, input) =>
  when match_literal_char(ch, input)
    is none then input
    is r then match_zero_or_more(ch, r)

match_one_or_more(ch, input) =>
  when match_literal_char(ch, input)
    is none then none
    is r then match_zero_or_more(ch, r)

match_zero_or_one(ch, input) =>
  when match_literal_char(ch, input)
    is none then input
    is r then r

match_concat_from(atoms, i, input) =>
  if i >= atoms.length
    then input
    else when match_atom(atoms[i], input)
      is none then none
      is r then match_concat_from(atoms, i + 1, r)

match_concat(atoms, input) => match_concat_from(atoms, 0, input)

match_pattern_from(concats, i, input) =>
  if i >= concats.length
    then none
    else when match_concat(concats[i], input)
      is none then match_pattern_from(concats, i + 1, input)
      is r then r

match_pattern(concats, input) => match_pattern_from(concats, 0, input)

// --- 3. Entry point ---
matches(pattern_str, input) =>
  tree = grammar_parse(g, pattern_str)
  r = match_pattern(tree, input)
  when r
    is none then false
    is _ then r.length == 0

// --- 4. Tests ---
print(matches("a", "a"))           // expect: true
print(matches("a", "b"))           // expect: false
print(matches("a*b", "aaab"))      // expect: true
print(matches("a*b", "b"))         // expect: true
print(matches("a*b", "ac"))        // expect: false
print(matches("ab+", "abbb"))      // expect: true
print(matches("ab+", "a"))         // expect: false
print(matches("a?b", "b"))         // expect: true
