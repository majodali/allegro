# Allegro Grammar Formalism — Design Spec (Phase 0)

**Status:** Draft for review. Not implemented.
**Scope:** Defines the grammar model Allegro will use going forward — replacing the
current Pratt + Earley hybrid. Covers the formalism, extension semantics, static
analysis requirements, parse semantics, and error handling. Does NOT cover
implementation (engine, generator, migration — those are later phases).

## 1. Goals and constraints

The formalism must support:

- **Arbitrary CFG expressiveness** — left and right recursion, mutual recursion,
  nullable productions, infinite lookahead via the parser algorithm.
- **Scannerless parsing** — grammars consume characters directly; no separate
  lexer phase. Terminals are character-level patterns.
- **Banned ambiguity** — every grammar must be provably unambiguous, modulo
  explicit precedence/associativity/longest-match resolution. Ambiguity is a
  compile-time error, not a runtime surprise.
- **User-friendly extension** — grammars are Allegro values. New productions
  compose into existing grammars; conflicts are reported with source locations
  on both the extension and the conflicting rule.
- **Offside-rule and free-form modes in the same grammar** — indentation-based
  blocks and brace-delimited blocks must both be expressible, ideally in a way
  that lets a single grammar support both.
- **User-friendly error reporting** — farthest-advance parse failures plus
  user-defined error productions that capture malformed syntax for recovery.

Non-goals for Phase 0:
- Picking implementation strategy (GLL is chosen; engine details are Phase 1).
- Syntactic sugar for writing grammars (deferred to Phase 6).
- Performance targets (Phase 8 concern).

## 2. Core formalism

A grammar is an Allegro Object. All constructors below are Allegro types —
their structural shape is what the formalism defines; concrete syntactic sugar
for writing them comes later.

### 2.1 Grammar

```
Grammar = {
  productions: Object[String, Production],   // name → production
  start:       String,                       // name of start production
  meta:        Object,                       // name, version, doc, etc.
}
```

A grammar is a collection of named productions plus a designated start symbol.
Production names are the only namespace — no hierarchical scoping at this level
(scoping is a user-space concern via naming conventions).

### 2.2 Production

```
Production = {
  name:   String,
  rule:   Rule,           // the top-level rule expression
  attrs:  Object,          // precedence, associativity, etc. (see §3)
}
```

### 2.3 Rule expressions

All rule expressions are Allegro values of type `Rule` (a union). The core set:

```
Terminal   = { kind: "terminal", match: TerminalMatch }
NonTerm    = { kind: "nonterm",  name:  String }
Seq        = { kind: "seq",      items: Array[Rule] }
Alt        = { kind: "alt",      options: Array[Rule] }
Rep        = { kind: "rep",      item: Rule, min: Int, max: Int | Inf, sep: Rule | None }
Opt        = { kind: "opt",      item: Rule }
Guarded    = { kind: "guarded",  item: Rule, guard: Guard }
```

`TerminalMatch` is:
- `LiteralMatch(str)` — exact character sequence.
- `CharClass(pattern)` — single character matching the class (e.g. `[a-z]`).
- `RegexMatch(pattern)` — arbitrary regex applied to the character stream;
  matches greedily up to the longest substring at the current position that
  satisfies the pattern.
- `EofMatch` — end of input, zero-width.
- `IndentDirective(kind)` — one of `NEWLINE`, `INDENT`, `DEDENT`, `SAMELINE` —
  stateful terminals defined in §5.

### 2.4 Guards

A `Guard` attaches an assertion to a rule without consuming characters:

```
Guard = NotFollowedBy(Rule) | FollowedBy(Rule) | Reserved(SetName)
```

- `NotFollowedBy(r)` — succeeds iff `r` does not match at the current position.
  Used for keyword/identifier edges: `ident = /[a-zA-Z_][a-zA-Z0-9_]*/ @not_followed_by(id_char)`.
- `FollowedBy(r)` — dual; succeeds iff `r` does match.
- `Reserved(set_name)` — parameterized lookup. The production matches only if
  the consumed text is not in the named reserved set. Used to exclude keywords
  from an identifier production without listing them all in the rule body.

Guards are zero-width — they never consume input, only constrain whether a
match is accepted.

### 2.5 Rule example

A simple arithmetic grammar (conceptual representation; the surface syntax
for writing this is not defined here):

```
productions:
  expr   = Alt[
              Seq[NonTerm("expr"), Terminal("+"), NonTerm("expr")] @prec(20) @left
              Seq[NonTerm("expr"), Terminal("*"), NonTerm("expr")] @prec(30) @left
              NonTerm("number")
           ]
  number = Terminal(/[0-9]+/)

start: "expr"
```

## 3. Resolution annotations

Annotations attach to rules or productions as `attrs` bindings. They do three
jobs: (a) resolve would-be ambiguities without rewriting the grammar, (b) shape
the parse tree, (c) guide error reporting.

### 3.1 Precedence and associativity

Precedence levels are **named and partially ordered**, not integers. Grammar
authors declare levels by name; extensions slot new levels between existing
ones via before/after constraints.

- `@prec(name)` — names the level for this rule.
- `@assoc(left | right | none)` — associativity. `none` forbids chaining
  without parentheses.

**Declaring levels** on a grammar:

```
grammar.precedence = [
  "assign"  < "logical_or" < "logical_and" < "compare"
            < "add" < "mul" < "unary" < "application"
]
```

Each pair is a binary ordering constraint. The analyzer topologically sorts
them into an effective integer order for the engine.

**Extending levels** via a grammar delta:

```
// `pow` slots strictly between `mul` and `unary`
delta.precedence_adds = [
  { name: "pow", after: "mul", before: "unary" }
]
```

Constraints may be one-sided (`before: "unary"` or `after: "mul"` alone).
The analyzer accepts one-sided specification **when the resulting partial
order is sufficient to resolve every actual ambiguity in the grammar** — it
does not require a total order. Three common cases where one-sided is
enough:

1. **Endpoint insertion.** `after: "application"` (new top level) or
   `before: "assign"` (new bottom level) — nothing exists on the other side.
2. **The new level only competes with one existing level.** If the
   ambiguity analysis finds the new alternative conflicts only with `mul`,
   then `after: "mul"` resolves it — the relation to `unary`, `add`, etc. is
   immaterial because those alternatives don't compete with the new one.
3. **The new operator doesn't share grammatical context with the main
   expression ladder** — e.g., a scoped operator that appears only in
   specific productions.

When one-sided specification is insufficient, the analyzer reports the
specific competing alternative and asks for the missing relation:

```
error: precedence `pow` is underconstrained [E_PREC_UNDERCONSTRAINED]
  at pow.alg:6  @prec(pow)  with  after: "mul"
  Alternative `expr.pow` (expr '**' expr) competes with `expr.unary`
  (`-expr`) for input of the form `a ** -b`. Add one of:
    before: "unary"   (pow binds looser)
    after:  "unary"   (pow binds tighter)
    same_as: "unary"  (requires compatible @assoc)
```

In other words: specify what you know; the analyzer demands more only when
the grammar actually creates an ambiguity the current constraints can't
resolve.

Semantics (applied during static analysis):

- Two alternatives of the same production that would be ambiguous without
  annotation are resolved by comparing `@prec` levels (higher binds tighter),
  then by `@assoc`.
- Within a single alternative at precedence `p` and left associativity, the
  left recursive position accepts rules of precedence `>= p`, the right accepts
  `> p`. Mirror for right associativity. For `none`, both sides must be `> p`.
- If two conflicting alternatives have the same precedence level and no
  compatible associativity, the analyzer emits an ambiguity error.
- Undeclared precedence names are errors.

### 3.2 Longest-match

`@longest` on an `Alt` means: try all alternatives that succeed; pick the one
consuming the most characters. If a tie in length: error (ambiguity).

This is the scannerless escape hatch for cases where multiple tokens share a
prefix but differ in length (e.g. `==` vs `=`, `-->` vs `--`).

`@longest` alts are still analyzed for conflicts: the analyzer must prove that
no pair of alternatives can match the SAME length at the SAME position.

### 3.3 Reservation sets

A grammar may declare named reserved sets:

```
Grammar.reserved = {
  keywords: ["if", "then", "else", "when", "is", ...]
}
```

A rule invokes `@reserved(keywords)` to exclude matches in that set.
Extensions can add to reserved sets; the analyzer re-checks on each change.

### 3.4 Name / result shape

- `@name(s)` — the rule's result is tagged with `s` in the parse tree (useful
  for alt branches).
- `@unwrap` — the rule's result is passed through untagged (useful for
  transparent rules like `Alt` branches that just forward).
- `@flatten` — for `Rep`, the element arrays are concatenated into the parent's
  sequence.

These shape the parse tree. They don't affect analysis.

### 3.5 Error annotation

- `@error(message)` on a rule marks it as an "error production" — matching
  it succeeds (for recovery) but flags an error in the output. See §8.

## 4. Scannerless terminals and token hygiene

All terminals consume characters. There is no tokenizer.

### 4.1 Implications

- Whitespace is NEVER implicit. Every production that allows optional
  whitespace between elements must include it explicitly. In practice this
  means most productions invoke a whitespace nonterminal:

  ```
  ws        = Rep(Alt[" ", "\t", "\n", CommentRule], min: 0)
  expr_add  = Seq[expr, ws, "+", ws, expr]
  ```

  Later, a grammar DSL (Phase 6) will add sugar for implicit inter-token
  whitespace. Until then, explicit.

- Keywords and identifiers share character space. Use `@reserved` or
  `@not_followed_by` to separate them. The standard idiom:

  ```
  id_char  = CharClass("[a-zA-Z0-9_]")
  ident    = Seq[CharClass("[a-zA-Z_]"), Rep(id_char)] @reserved(keywords)
  kw_if    = Seq["if", @not_followed_by(id_char)]
  ```

### 4.2 Built-in terminals

The formalism provides a small set of built-in terminal constructors that the
engine and analyzer understand natively:

- `lit(s)` — literal string match.
- `cls(p)` — character class match.
- `regex(p)` — regex match (single match at current position).
- `eof` — end of input.
- `empty` — zero-width success.
- `fail` — always fails (useful as a placeholder).

## 5. Indentation and offside rule

A fundamental requirement: grammars can express both free-form (brace-
delimited) and offside (indentation-delimited) block structure, ideally within
the same grammar.

### 5.1 Design approach — stateful terminals

Pure scannerless CFG cannot express offside rule without state, because
"this line is indented deeper than the enclosing block" depends on the
current indent stack. We extend the formalism with four stateful terminals
the engine treats specially:

- `NEWLINE` — matches a newline character followed by any horizontal
  whitespace. Records the leading-whitespace count of the following line as
  the "indent level" of the next non-whitespace character.
- `INDENT` — zero-width. Succeeds iff the next `NEWLINE`'s recorded indent
  is strictly deeper than the current indent on the stack. On success, pushes
  that indent level onto the stack.
- `DEDENT` — zero-width. Succeeds iff the next non-whitespace character's
  indent is at or below the top of the indent stack. Pops the stack.
- `SAMELINE` — zero-width. Succeeds iff no `NEWLINE` has been consumed since
  the start of the current "statement" context.

The parser's position is therefore `(offset, indent_stack)`, not just `offset`.
Two parse descriptors at the same offset with different indent stacks are
distinct. GLL memoization keys on the full pair.

### 5.2 Block idiom

Both free-form and offside block syntaxes are expressible as an `Alt` on how
a block is opened and closed:

```
block = Alt[
  Seq[lit("{"),  ws, Rep(statement, sep: ws), ws, lit("}")]       @name("braced")
  Seq[INDENT,    Rep(statement, sep: NEWLINE),              DEDENT] @name("offside")
] @longest
```

`@longest` resolves the case where both could match — e.g. a braced block
that also happens to be followed by an INDENT (impossible in practice, but the
analyzer can't know that). In typical grammars, only one form matches at a
given position, and the analyzer verifies that.

### 5.3 Nested blocks and mixed modes

Because indent state is parser-carried, nested blocks of different modes work
naturally:

```
def foo():
  if cond { print(1); print(2) }
  else:
    print(3)
```

The `if` branch opens a brace block (no INDENT change). The `else` opens an
offside block (INDENT pushed). No grammar-level coordination required.

### 5.4 Open design questions for Phase 0

- How do tab characters interact with indent? **Proposed:** tabs forbidden
  in indentation by default; the `Grammar.meta.tab_width` setting allows
  explicit tab-to-space equivalence for grammars that want it. Mixing tabs
  and spaces in the same block's leading whitespace is always an error.
- What happens if a `NEWLINE` is never consumed (e.g., single-line programs)?
  **Proposed:** the indent stack starts at `[0]` and stays there until the
  first `NEWLINE`. `DEDENT` and `INDENT` before any `NEWLINE` both fail.
- How does the `SAMELINE` terminal interact with `ws` that includes newlines?
  **Proposed:** the engine maintains a per-statement "seen newline?" flag.
  `ws` that includes newlines sets it; `NEWLINE` sets it; `SAMELINE` checks it.

### 5.5 Multi-line expression continuation

Offside-mode programs routinely continue expressions across lines:

```
x = 1 + 2
      + 3
```

The formalism handles this **without a dedicated continuation construct** by
making `NEWLINE` context-sensitive:

> `NEWLINE` fires only if the next non-whitespace content is at an indent
> `<= indent_stack.top()`. If the next content is indented deeper, the
> newline character and its trailing whitespace are consumed silently,
> as ordinary inter-token whitespace.

The indent stack's top is the indent level of the currently-open block.
Anything indented strictly deeper is part of the current statement, so
`NEWLINE` doesn't terminate it. Worked cases:

**Continuation, top-level statement:**
```
x = 1 + 2
      + 3
y = 4
```
Stack: `[0]`. After `1 + 2`, next content at col 6, `6 > 0` — no NEWLINE.
Expression continues with `+ 3`. Next newline, next content `y = 4` at col 0,
`0 <= 0` — NEWLINE fires, statement ends.

**Continuation, inside a block:**
```
if cond:
    x = 1 + 2
          + 3
    y = 4
```
Stack inside the `if` block: `[0, 4]`. After `1 + 2` (at col 4), next content
at col 10, `10 > 4` — continuation. Next newline, `y = 4` at col 4, `4 <= 4`
— NEWLINE fires, statement ends but block continues.

**Transparent to nested blocks:**
```
if a:
    x = foo(b
            + c)
```
Inside the `if` body, stack is `[0, 4]`. During the call to `foo(...)`, the
parser is inside a paren group — which the grammar can define to use the
ordinary `expr` rule, NOT `NEWLINE`-separated. So the newline inside the
parens is just whitespace per the paren group's ws rule, regardless of indent.
No special handling needed in the formalism; the grammar chooses which
separator rule applies at each position.

Implication for grammars: **writers of offside-aware grammars use `NEWLINE`
as a sequence separator for statements, and use ordinary `ws` (which may or
may not include raw newlines) for expression-internal spacing.** The NEWLINE
rule's context-sensitive firing does the rest.

Implication for extensions: no grammar change required to support continuation;
any extension that introduces new statement forms inherits the behavior as long
as it uses `NEWLINE` for statement boundaries and `ws` for internal spacing.

## 6. Grammar extension

Grammars are values. Extension is a function:

```
extend(base: Grammar, delta: GrammarDelta) → Grammar
```

A `GrammarDelta` is a map from production name to `Operation`, plus auxiliary
maps for reserved sets, precedence levels, and metadata:

```
GrammarDelta = {
  productions:       Object[String, Operation]
  reserved:          Object[String, Set[String]]
  precedence_adds:   Array[PrecedenceInsert]
  meta:              Object
}

Operation = Add(Production)
          | Append(Array[Alternative])
          | Replace(Rule)
          | ReplaceAlt(Selector, Rule)
          | Remove(Selector)
          | Wrap(GrammarFn)

Selector = ByName(String)    // matches alternative's @name tag
         | ByIndex(Int)       // positional; discouraged

Alternative = { rule: Rule, attrs: Object }
GrammarFn   = Grammar → Grammar    // escape hatch

PrecedenceInsert = { name: String, before: Opt(String), after: Opt(String) }
```

### 6.1 Operation semantics

- **`Add(production)`** — introduces a new production by name. Error if the
  name already exists.
- **`Append(alts)`** — appends alternatives to the named production's
  top-level `Alt`. If the existing production is not an `Alt` at top level
  (e.g., `number = regex(/[0-9]+/)`), the engine automatically wraps:
  `Alt[<original>, <new alts>...]`. This means a grammar author doesn't have
  to pre-declare an `Alt` wrapper to be extensible.
- **`Replace(rule)`** — swaps out the named production's rule entirely.
  Intended for targeted overrides; use with care.
- **`ReplaceAlt(selector, rule)`** — finds one alternative in the production's
  top-level `Alt` via a `Selector` (name tag preferred, index as fallback) and
  replaces just that alternative. Error if the selector doesn't match exactly
  one alternative.
- **`Remove(selector)`** — deletes one alternative. Same selector rules.
- **`Wrap(fn)`** — the escape hatch. `fn` is a grammar-to-grammar
  transformation. The analyzer cannot inspect inside `fn`, so wrapped grammars
  re-run the full analysis from scratch on the result.

### 6.2 Composition and conflicts

- Reserved-set additions are cumulative: `base.reserved[k] ∪ delta.reserved[k]`.
- Precedence-level additions accumulate into the grammar's precedence relation;
  the analyzer topo-sorts the combined constraints. A cycle or
  underdetermination introduced by extension is an error against the
  extension's `precedence_adds` entry.
- Two deltas can conflict with each other, not just with the base. Composition
  is:
  ```
  effective = extend(extend(extend(base, d1), d2), d3)
  ```
  and the analyzer runs on `effective`, so conflicts are reported whatever
  the composition order. `Wrap` operations are applied in composition order.

### 6.2 `use_grammar` semantics

A module that `use_grammar NAME`-includes grammar `NAME` effectively runs:

```
new_grammar = extend(active_grammar, NAME.grammar_delta)
verify(new_grammar)   // runs analyzer
```

before parsing the rest of the file. If `verify` returns conflicts, parsing
aborts with the conflict report and the file does not run.

### 6.3 Scope of extensions

Extensions are per-compilation-unit (per file, effectively). Two files that
both `use_grammar pow` each get their own extended grammar; they don't leak
into each other, into modules they import, or into the REPL session.

Future (deferred): per-block or per-production activation via annotations.

## 7. Static analysis

The analyzer is a pure function:

```
analyze(grammar: Grammar) → GrammarReport
```

Where:

```
GrammarReport = {
  errors:   Array[GrammarError],
  warnings: Array[GrammarWarning],
  sets:     {
    first:     Object[String, Set[TerminalMatch]],
    follow:    Object[String, Set[TerminalMatch]],
    nullable:  Set[String],
  }
}
```

### 7.1 Required checks

- **Reachability.** Every production in `productions` must be reachable from
  `start`. Unreachable productions are a warning (not error) — they may be
  intentional extension hooks.
- **Defined-ness.** Every `NonTerm(name)` must resolve to a production. A
  reference to an undefined name is an error.
- **Nullability computation.** Fixed-point over `empty | rule* | (nullable_a, nullable_b) | alt_with_nullable_branch`.
- **FIRST sets.** Per-production computation, following the standard CFG
  algorithm generalized for scannerless (FIRST is a set of terminal-match
  predicates, not tokens).
- **FOLLOW sets.** Same.
- **Alternative disjointness.** For each `Alt[a, b, c, ...]` in the grammar,
  verify no two alternatives can match the same input. Two alternatives
  overlap iff:
  - Their FIRST sets intersect (both can start the same way), AND
  - They are not disambiguated by `@prec` / `@assoc` / `@longest`.

  For `@prec`-resolved overlaps: the analyzer verifies the precedence relation
  is consistent (higher precedence wins; same precedence needs `@assoc`; same
  precedence without compatible `@assoc` is an error).

  For `@longest`-resolved overlaps: the analyzer verifies no two alts can match
  the same input to the SAME length. This is conservative — an inexact proof
  may require a runtime tie-check in the engine; we accept that.

- **Left recursion classification.** Left-recursive productions are allowed
  (GLL handles them) but classified and reported in the warnings. Hidden
  left recursion (via nullable intermediate) is flagged as a readability
  concern.
- **Infinite loop check.** `Rep(nullable, min: 0, sep: empty_or_nullable)` is
  an error (infinite parse).
- **Reservation consistency.** Every reserved set referenced by `@reserved(name)`
  must be declared. Every entry in a reserved set must actually be matchable by
  the rule it's applied to (e.g., "if" satisfies `ident`'s character class).

### 7.2 Optional checks (warnings)

- Productions with no producing alternative (only references to undefined
  names): "production `foo` is effectively empty".
- Duplicate alternatives: two alts with the same rule value.
- Unused reserved sets: a `reserved` entry declared on the grammar but never
  referenced by any `@reserved(name)` guard.
- Unused reserved entries: a string in a reserved set whose inclusion is
  unreachable (e.g., can't be produced by any rule that invokes
  `@reserved(name)`).
- Unnamed alternatives in an `@extensible`-style production — warn the
  author that extensions using `ReplaceAlt(ByName(...))` won't find them.

### 7.3 Precedence-related checks

- **Undeclared precedence names** — error.
- **Precedence underconstraint** — if an extension's `PrecedenceInsert` leaves
  its position ambiguous relative to existing levels (e.g., `after("mul")` but
  no relation to `unary`, and both `mul < new < unary` and `new > unary` are
  consistent), error.
- **Precedence cycles** — error.
- **`Opt` + `@prec` interaction** — an alternative's precedence-distinguishing
  structure (the operator tokens or other tokens that make this alternative
  shape recognizable) cannot be inside an `Opt`. If the Opt can produce
  nothing, the alt loses its distinguishing shape. Concrete rule: for an
  alternative `alt` with `@prec(level)`, compute the minimum-match set of `alt`
  (the set of matches when every `Opt` is empty and every `Rep(min=0)` is
  empty). If the minimum-match set overlaps with any other alternative's
  minimum-match set, error with pointer at the offending `Opt`/`Rep`. The
  grammar author must split the optional into separate alternatives.

### 7.4 Error shape

Every error includes:

- Affected production name(s).
- Affected rule(s) — source locations on the rule literals if available
  (grammars built via the DSL carry source locations; grammars built via
  primitives may not).
- A short machine-readable code (e.g. `E_AMBIG_ALT`, `E_UNDEFINED_NAME`).
- A human-readable message with at least two "pointing" spans — one for each
  conflicting rule.

Example (for the report, not the file):

```
error: alternatives overlap and cannot be resolved by precedence [E_AMBIG_ALT]
  expr                 ← production
    ├── at pow.alg:12  base alternative: expr '*' expr  @prec(30)
    └── at pow.alg:16  added alternative: expr '**' expr @prec(30)
  Both have precedence 30 and are left-associative, so either could match
  the same input. Either make them different precedences, or declare
  non-associative, or group under @longest if they never overlap.
```

## 8. Parse semantics

### 8.1 Success

The engine produces a single parse tree (there's no ambiguity because the
analyzer banned it) rooted at `start`. The tree's node types correspond to
`Rule` kinds:

- `Terminal` match → a leaf carrying the matched string and its source range.
- `Seq` match → a branch with children in sequence order.
- `Alt` match → a branch tagged with which alternative matched.
- `Rep` match → a list of children, with optional separator children included
  or stripped per `@flatten`.
- `Opt` match → one child or a sentinel `none`.

Tree-shape annotations (`@name`, `@unwrap`, `@flatten`) rewrite the tree at
production time (the engine consults them, so the analyzer doesn't need to).

### 8.2 Failure — farthest advance

When parsing fails, the engine reports:

- The farthest character position reached by any descriptor.
- The set of rules active at that position (what the parser was trying to
  match).
- A best-effort "expected X, got Y" message derived from the rules' FIRST sets
  and the character at that position.

This is classic farthest-advance error reporting and handles the common case
of "syntactically fine until position N, then unexpected character".

### 8.3 Failure — error productions

Users can define error-tolerant productions using `@error`:

```
// Recover from a missing semicolon
stmt = Alt[
  Seq[expr, ws, ";"],
  Seq[expr, ws, @error("expected ';'")] @error("missing semicolon")
]
```

When the engine matches an `@error` rule, the match succeeds for parsing
purposes, but the node is tagged with an `error` component (MultiValue-style)
whose "error" field carries the message and location. Downstream passes see
errors in the tree without aborting parse.

### 8.4 Failure — panic recovery via `@sync`

If the engine cannot advance even via `@error` productions, it skips
characters to the next synchronizing token and resumes. Skipped content
becomes a single error node in the tree with a machine-readable `skipped`
span.

**`@sync` is a core feature, not optional.** The base Allegro grammar
declares sync points at natural recovery boundaries — statement terminators
(`NEWLINE` at statement level, `;`), block delimiters (`}`, `DEDENT`), and
top-level keywords (`if`, `when`, `def`). Extensions inherit these
automatically; extensions that introduce their own recovery-worthy structure
can add their own `@sync` annotations.

**Semantics.** `@sync` on a terminal or production means: "when panic-recovering,
skip forward until this rule matches, then resume parsing from there." The
engine maintains a runtime set of active sync points based on which
productions are currently on the parse stack; only those sync points are
candidates, so e.g. a `}` inside a string literal isn't a valid resync target.

**Sync-to-multiple-candidates resolution.** When multiple sync rules could
match at the same position, the engine picks the longest-matching one. This
mirrors `@longest` semantics elsewhere.

## 9. Relationship to existing Allegro types

This formalism is expressible in Allegro's current type system:

```
// Rule is a tagged union
Rule = Terminal | NonTerm | Seq | Alt | Rep | Opt | Guarded

// Each variant is a nominal type with specific fields
Terminal = Type.define({ match: TerminalMatch })
Seq      = Type.define({ items: Array[Rule] })
Alt      = Type.define({ options: Array[Rule], attrs: Object })
// ...

// Grammar is a record type
Grammar = Type.define({
  productions: Object[String, Production],
  start:       String,
  reserved:    Object[String, Array[String]],
  meta:        Object,
})
```

Phase 1 builds constructor primitives that produce these values. Phase 6
adds syntactic sugar for writing them directly.

**Type-system feedback:** drafting this spec, two mild gaps became visible in
the current type system that Phase 1 will hit:

- `Object[String, Array[Alternative]]` — we need generic `Object` with a
  value-type parameter (like TS's `Record<string, V>`). Currently `Object`
  has `__getMember` field-by-field; no notion of uniform value type.
- Tagged unions (`Rule = Terminal | NonTerm | ...`) are expressible via
  `Int | String` style unions, but pattern-matching ergonomics are awkward
  without sugar. Worth revisiting the pattern-matching syntax around tagged
  union cases.

Neither blocks the Phase 0 formalism; both are candidates for platform
improvements triggered by Phase 2 or Phase 5 pain.

## 10. Worked examples

### 10.1 Base expression grammar (abbreviated)

```
Grammar {
  start: "program"
  reserved: {
    keywords: ["if", "then", "else", "when", "is", "of", "true", "false"]
  }
  precedence: [
    "compare" < "add" < "mul" < "unary" < "atom"
  ]

  productions:
    program = Rep(stmt, sep: NEWLINE) @flatten

    stmt    = Alt[
                Seq[ident, ws, "=", ws, expr]           @name("assign") @sync
                expr                                     @name("bare") @sync
              ]

    expr    = Alt[
                Seq[expr, ws, "+", ws, expr]            @prec(add)     @left @name("add")
                Seq[expr, ws, "*", ws, expr]            @prec(mul)     @left @name("mul")
                Seq[expr, ws, "==", ws, expr]           @prec(compare) @left @name("eq")
                atom                                     @prec(atom)
              ]

    atom    = Alt[
                number
                Seq["(", ws, expr, ws, ")"]             @name("paren") @sync
                ident
              ]

    number  = regex(/[0-9]+/)
    ident   = Seq[cls("[a-zA-Z_]"), Rep(cls("[a-zA-Z0-9_]"))] @reserved(keywords)
    ws      = Rep(Alt[" ", "\t"], min: 0)
}
```

Named precedence levels ensure extensions can slot in new operators without
renumbering. `@sync` annotations let the recovery system resume at statement
or parenthesized-expression boundaries.

### 10.2 `pow.alg` extension

```
GrammarDelta {
  productions: {
    expr: Append([
      { rule: Seq[expr, ws, "**", ws, expr],
        attrs: @prec(pow) @right @name("pow") }
    ])
  }
  precedence_adds: [
    { name: "pow", after: "mul", before: "unary" }
  ]
  reserved: {
    keywords: []   // no new keywords
  }
}
```

Analyzer result:
- `pow` slots between `mul` and `unary` per the `precedence_adds` entry.
- The new alternative's FIRST intersects with existing `expr` alts (all start
  with `expr`), but precedence resolves cleanly: `pow > mul > add > compare`
  means any input where `**` appears is unambiguously tighter than the other
  operators.
- `@right` associativity for `pow` (so `2 ** 3 ** 2` parses as `2 ** (3 ** 2)`).

If the user had written `@prec(mul)` (same level as `*`) without changing
associativity, the analyzer would report:

```
error: alternatives overlap at precedence `mul` [E_AMBIG_ALT]
  expr
    ├── at grammar.alg:12  base: expr '*' expr   @prec(mul) @left
    └── at pow.alg:6       added: expr '**' expr @prec(mul) @left
  Both are left-associative at the same level, so either could match the
  same input. Raise `**` to a higher level (e.g. `@prec(pow)` slotted
  via `precedence_adds`), or declare one non-associative.
```

### 10.3 Regex DSL grammar (standalone, not an extension)

```
Grammar {
  start: "pattern"

  productions:
    pattern = Rep(concat, sep: "|", min: 1) @name("alternation")
    concat  = Rep(atom, min: 1)             @name("concat")
    atom    = Seq[base, Opt(postfix)]
    postfix = Alt[ "*", "+", "?" ]
    base    = Alt[ cls("[a-z]"), group ]    @name("base")
    group   = Seq["(", pattern, ")"]        @name("group")
}
```

No indentation, no keywords — the simplest useful grammar. Directly replaces
`tests/grammar-regex.alg`.

### 10.4 Hypothetical `match x with | ...` extension

A multi-token pattern that the current Phase 1 runtime extension can't
express:

```
GrammarDelta {
  productions: {
    expr: Append([
      {
        rule: Seq[
          "match", ws, NonTerm("expr"), ws,
          "with", INDENT,
          Rep(NonTerm("match_arm"), sep: NEWLINE),
          DEDENT
        ],
        attrs: @prec(compare) @name("match") @sync
      }
    ])
    match_arm: Add({
      rule: Seq["|", ws, NonTerm("pattern"), ws, "=>", ws, NonTerm("expr")]
    })
    pattern: Add({
      rule: /* ... */
    })
  }
  reserved: {
    keywords: ["match", "with"]
  }
}
```

Note the indent-aware `INDENT`/`DEDENT` terminals; the grammar supports both
brace and offside styles if the body were `Alt[braced_arms, offside_arms]`
as in §5.2. The `@sync` on the match alternative marks it as a valid recovery
point — if the body contains a malformed arm, the recovery system can re-sync
to the next `match` keyword.

### 10.5 Mixed offside/free-form block grammar

```
block = Alt[
  Seq["{", ws, Rep(stmt, sep: Seq[ws, ";", ws]), ws, "}"]   @name("braced")
  Seq[INDENT, Rep(stmt, sep: NEWLINE),                 DEDENT] @name("offside")
] @longest @name("block")
```

Both forms live in the same grammar. A program can mix them, and the engine
chooses per occurrence based on the next character after the opener.

## 11. Open items — resolutions for Phase 0

These were open questions in the initial draft; all are now resolved, with
rationale below. Future spec revisions may revisit.

1. **Resolved: everything is extensible by default.** No `@extensible` gate for
   now. A grammar author signaling "this rule should not be extended" can be
   added later as an opt-out `@frozen` / `@sealed` annotation. Worth considering
   for rules like whitespace, comment syntax, and core terminal character
   classes — extending these would break most grammars depending on them.
2. **Resolved: unified under `productions: Object[String, Operation]`.** Six
   operations cover the spectrum: `Add`, `Append`, `Replace`, `ReplaceAlt`,
   `Remove`, `Wrap`. `Append` auto-wraps a non-`Alt` production to accept new
   alts, so authors don't need to pre-declare a single-alt `Alt` wrapper. See §6.
3. **Resolved: reserved sets are `Set[String]` values, composable via grammar
   scope.** A grammar's `reserved` map is a dictionary of named sets; sets can
   be imported from other grammars or extensions. Unused sets and unused
   entries both produce analyzer warnings.
4. **Resolved: symbolic precedence with partial-order constraints.** Named
   levels, declared as pairwise ordering constraints, composed via
   `precedence_adds` with `before`/`after`. The analyzer topologically sorts;
   underdetermined placement is an error. No integers in user-visible spec.
5. **Resolved: `Opt` + `@prec` conflict is an analyzer error.** An
   alternative's precedence-distinguishing shape cannot be inside an `Opt`
   (or `Rep(min=0)`). If the minimum-match of an alt overlaps with any other
   alt's minimum-match, the author must split into two separate alternatives.
6. **Resolved: `@sync` is a core feature.** The base grammar declares sync
   points at all natural recovery boundaries; extensions inherit them and can
   add their own.

## 12. Acceptance criteria for Phase 0

This spec is accepted when:

- The five worked examples in §10 are complete and internally consistent.
- Every open item in §11 has a resolution (even if "deferred to Phase N").
- The formalism can express the current Allegro Standard grammar. (This will
  be re-verified during Phase 2; failures there feed back as Phase 0 revisions.)
- Two review passes with the language designer.

---

*End of Phase 0 draft. Next: review, revise, then begin Phase 1 — grammar
values and the GLL engine in TypeScript.*
