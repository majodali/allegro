// Regex-like pattern DSL built from grammar combinator primitives.
// Supports: literal chars [a-zA-Z0-9], | alternation, *, +, ? postfix, (...) grouping.
//
// Demonstrates:
//   - Building a full grammar from Allegro using parser combinators
//   - Recursive grammars via the forward-declare + grammar_choice_add pattern
//   - Post-processing parse trees in pure Allegro to implement semantics

// --- 1. Build the regex DSL grammar ---
g = grammar_new({whitespace: ""})

chr = grammar_terminal(g, "/[a-zA-Z0-9]/")
pipe = grammar_terminal(g, "|")
star = grammar_terminal(g, "*")
plus = grammar_terminal(g, "+")
qmark = grammar_terminal(g, "?")
lparen = grammar_terminal(g, "(")
rparen = grammar_terminal(g, ")")

// Forward-declare `pattern` as an empty choice (recursion hook)
pattern = grammar_choice(g, [])

// base := chr | "(" pattern ")"
grouped = grammar_phrase(g, [lparen, pattern, rparen])
base = grammar_choice(g, [chr, grouped])

// postfix := "*" | "+" | "?"
postfix = grammar_choice(g, [star, plus, qmark])

// atom := base postfix?
atom = grammar_phrase(g, [base, grammar_optional(g, postfix)])

// concat := atom+
concat_rule = grammar_repeat(g, atom, {min: 1})

// alt := concat ("|" concat)*
alt_rule = grammar_repeat(g, concat_rule, {min: 1, delimiter: pipe})

// Close recursion: pattern is alt
grammar_choice_add(pattern, alt_rule)
grammar_set_target(g, pattern)

// --- 2. Interpreter over parse trees ---

match_literal_char(ch, input) =>
  if input.length > 0 && input.charAt(0) == ch
    then input.slice(1, input.length)
    else none

match_base(base_node, input) =>
  if base_node instanceof String
    then match_literal_char(base_node, input)
    else match_pattern(base_node[1], input)

match_atom(atom_node, input) =>
  base_node = atom_node[0]
  post = atom_node[1]
  when post
    is none then match_base(base_node, input)
    is "*" then match_zero_or_more(base_node, input)
    is "+" then match_one_or_more(base_node, input)
    is "?" then match_zero_or_one(base_node, input)
    is _ then match_base(base_node, input)

match_zero_or_more(base_node, input) =>
  when match_base(base_node, input)
    is none then input
    is r then match_zero_or_more(base_node, r)

match_one_or_more(base_node, input) =>
  when match_base(base_node, input)
    is none then none
    is r then match_zero_or_more(base_node, r)

match_zero_or_one(base_node, input) =>
  when match_base(base_node, input)
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
print(matches("(ab)+", "abab"))    // expect: true
print(matches("(ab)+", "abc"))     // expect: false
print(matches("a|b|c", "b"))       // expect: true
print(matches("a|b|c", "d"))       // expect: false
print(matches("a?b", "b"))         // expect: true
print(matches("a?b", "ab"))        // expect: true
print(matches("a?b", "aab"))       // expect: false
