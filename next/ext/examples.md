# Worked examples of the parser's rules

Whose: the kernel stream (lane R). Each rule the parser engine holds to
has a worked example here: a small grammar, a text, and what the engine
reads. Every example is run by the suite, so none can drift from the
engine: the modules `lib/examples_*.test.alg` by `next/ext/ext.test.ts`,
and the texts of `examples/` by `next/ext/examples.test.ts`.

The rules are the decisions of `docs/plans/book-pass-inventory.md`,
chapters "Parsing", "Changing the grammar" and "The parser engine". Each
entry there names its example.

Read them in this order. Each file begins with the helpers it uses and
then goes rule by rule; a rule's section says the rule, gives the
grammar in a comment, and claims what a text reads as.

1. `lib/examples_forms.test.alg` — a grammar and its forms.
2. `lib/examples_rows.test.alg` — rules that name themselves, and levels of signs.
3. `lib/examples_layout.test.alg` — state beside the position, and layout by indentation.
4. `lib/examples_changes.test.alg` — changing a grammar.
5. `lib/examples_turns.test.alg` — a text that changes the grammar it is read in, and what a notation may do.
6. `examples/` — the same rules at work in Allegretto, with `use`. A text named `*.main.alg` is a program, and states what it writes or why it is refused; the others are the modules the programs use.

| Decision | Where | What the example shows |
|---|---|---|
| Grammars are values | `lib/examples_forms.test.alg` | a grammar made by a function; a grammar made from another leaves the first as it was |
| Parsing is evaluation | `lib/examples_forms.test.alg` | a reading is a call that gives every reading as data, or a failure with the farthest byte reached |
| Ambiguity is a claim | `lib/examples_forms.test.alg` | `parses` gives both readings of a text that reads two ways; `parse` claims there is one |
| Scannerless parsing | `lib/examples_forms.test.alg` | a number and a quoted text in one grammar, with no pass that cuts words first; space as a terminal |
| A terminal is a function, so a grammar can define its own | `lib/examples_forms.test.alg` | a terminal that reads the letter a an even number of times |
| Every notation stands for an expression | `lib/examples_forms.test.alg`; `examples/ratio.alg` | a sum whose form gives its total; a notation's sign that gives a call of its module's function, read through `from` |
| A parser records where each expression came from in its text | `lib/examples_forms.test.alg` | the place of a number on the second line of a text |
| Guards and reserved words separate keywords from identifiers | `lib/examples_forms.test.alg` | `if` is no name and `iffy` is; a name with no bracket after it |
| Any parsing algorithm will do that meets five conditions | `lib/examples_rows.test.alg` | a rule that begins with itself groups from the left, one that ends with itself from the right; one that reads itself and nothing between is refused |
| Named, partially ordered precedence levels | `lib/examples_rows.test.alg` | three levels each placed by the one it names; two with no order between them, read apart and refused side by side |
| Offside rule through stateful indent terminals | `lib/examples_layout.test.alg` | brackets balanced by a state and no recursion; blocks by indentation, however deep |
| Every production can be extended | `lib/examples_changes.test.alg` | each of the operations on a small grammar of sums |
| Grammars combine without regard to order | `lib/examples_changes.test.alg` | two changes in either order; two that conflict, refused before any text is read |
| A text can change the grammar it is read in | `lib/examples_turns.test.alg`; `examples/uses.main.alg`, `examples/before.main.alg` | a line that adds a letter to its language, from the next line on; `use` in Allegretto |
| A grammar change reaches to the end of its block | `lib/examples_turns.test.alg`; `examples/block.main.alg`, `examples/after-block.main.alg` | a change made between brackets holds there and not after them; `use` in a block |
| A notation a text uses can only add | `lib/examples_turns.test.alg`; `examples/carried.main.alg`, `examples/changing.main.alg`, `examples/two-ways.main.alg` | what a notation may do, checked on the grammar; a line that no longer reads as it did, refused with both readings; what is alike; a reading added beside one that stays |

Two cases are examples of a refuted claim, and a refuted claim is on a
run's record: they are in `lib/refuted_claims.test.alg`. A text that
reads two ways refutes `parse`. And a line that asks for a change of the
grammar, read two ways to the same end, refutes the claim that it is the
only reading of the text so far.

The modules of `examples/` import `change`, `grammar` and `levels`, the
engine's own modules, which are texts of `lib/` and not of that
directory. The runner hands them over as the reader holds them
(`next/ext/run.ts`). The bootstrap looks for an import beside the text
that imports it and finds none there, so the two comparisons with the
bootstrap count those modules, and the programs that use them, as
refused by both. Where a module is found is the loader's matter, chunk
E9 of the book pass.

Not here: speed, which `next/ext/ext.test.ts` measures; and the
comparisons with the bootstrap, `next/ext/readers.ts` and
`next/ext/modules.ts`.
