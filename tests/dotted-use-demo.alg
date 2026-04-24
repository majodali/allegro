// `use X.Y` — select a specific Grammar binding from a module.

use multi_grammar.grammar_a

// Only `++` is active; `--` is NOT because we selected only grammar_a.
// `++` computes (l + r + 1), so 3 ++ 4 = 8, 10 ++ 20 = 31.
print(3 ++ 4)        // expect: 8
print(10 ++ 20)      // expect: 31
