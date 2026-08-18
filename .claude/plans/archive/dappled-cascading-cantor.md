# Phase 6 — Grammar extension syntax

## Context

Phase 5 completed the Allegro-native analyzer port. Phase 6 redesigns the
user-facing syntax for grammar extensions. Current state:

- Runtime grammar extension Phase 1 exists: `register_infix`, `register_prefix`,
  `register_postfix`, `register_expr_prefix`, activated via `use_grammar NAME`
  pre-scanner header. Works but limited — only single-token operators/keywords,
  numeric binding power, and module-name references.
- Grammar2 formalism (scannerless parser) is the parsing substrate; its
  `Operation` delta union already supports add/append/replace/replaceAlt/remove.
- Base grammar (`src/grammar2/base-grammar.ts`) has stratified precedence via
  named productions (`expr_pipe` → `expr_or` → … → `expr_atom`), but the ordering
  is hardcoded in rule bodies rather than driven by a level list.

Scope for Phase 6: **in-scope use cases 1–5** (operators, keyword-prefix,
multi-token inline forms, bracketed DSL bodies with local rules, block/statement
forms). Explicitly deferred: new literal kinds, pattern extensions,
type-expression extensions, whole-file grammar substitution, arbitrary builder
lambdas, hygienic substitution, single-pass `use` (remains two-pass pre-scan).

## Design summary (settled)

### `use X` — replaces `use_grammar NAME`

```
use my_dsl                      // symbol bound to Grammar in scope
use import math                 // import expression, use its default grammar
use import math.regex           // sub-binding that is a Grammar
use combine(g1, g2)             // restricted expression (Phase 6 whitelist)
```

- Pre-scanner accepts `use <expr>` lines at the top of a file, ending at the
  first non-`use` / non-blank / non-comment line.
- X must evaluate at compile time to a `Grammar` value using only primitives,
  already-loaded modules, and a small whitelist of grammar combinators
  (`combine`, `override`, `without` — added as primitives).
- Non-whitelist expressions → `E_USE_EXPR_TOO_COMPLEX`.
- No transitive export: consumers `use` their own grammars; modules may
  re-export imported grammars explicitly.

### `grammar { … }` — the registration form

```
grammar { … }                   // default extends `allegro` in Allegro context
grammar extends X { … }         // explicit base
new grammar { … }               // fresh, no base — equivalent to extends empty
```

A grammar expression produces a `Grammar` value that carries its base identity.
Compatibility at `use` time: merge if bases are in each other's chain; else
`E_INCOMPATIBLE_GRAMMARS`.

Both block forms accepted:

```
grammar { … }                   // braces, inline
grammar:                        // offside rule, multiline
    infix "**" prec(pow) right => …
```

### Inside the block — declarative forms

| Form | Meaning | Underlying Operation |
|---|---|---|
| `precedence NAME { above X, below Y }` | declare new level | fragment-level precedence decl |
| `infix S prec(L) left/right/none => T` | binary operator | append alt to expr_L |
| `prefix S at(L) => T` | prefix operator | append alt to expr_L |
| `postfix S at(L) => T` | postfix operator | append alt to expr_L |
| `expr_prefix KW => T` | keyword + expr | append alt to expr_unary (or similar) |
| `expr_form parts… => T` | multi-token inline expression | append alt to expr_atom / entry point |
| `stmt_form parts… => T` | statement-level form | append alt to stmt |
| `rule NAME = body [=> T]` | add/replace production | `add` or `replace` Operation |
| `rule NAME += body [=> T]` | append alternative | `append` Operation |

Precedence clauses: `prec(NAME)` (named), `at(X)` (same level as X — name or
operator symbol), `above(X)`, `below(X)`, or combined `above(X) below(Y)`.
Symbol lookup: `at("*")` resolves to the level that `*` lives at.

Associativity: `left` (default for infix), `right`, `none`.

### EBNF mini-grammar inside rule bodies

| Syntax | Compiles to |
|---|---|
| `"text"` | `lit("text")` |
| `/[a-z]/` | `regex(...)` |
| `ident` (bare name) | `nonterm("ident")` |
| `s:rule` | labeled part (becomes named Param in template) |
| `a b c` | `seq([a, b, c])` |
| `a \| b` | `alt([a, b])` |
| `a?` | `opt(a)` |
| `a*` | `rep(a)` |
| `a+` | `rep(a, min=1)` |
| `a ** s` | `rep(a, sep=s)` |
| `(a b)` | seq grouping |

Template arrow `=> <expr>` supplies a ComposedFunction whose parameters are the
labeled parts. At parse time, `substituteParams` injects the matched subtree
values into the template body, exactly as Phase 1 does for single-operand forms.

### Conflict detection (Phase 6 analyzer additions)

- `E_PRECEDENCE_CYCLE` — named levels' constraint graph has a cycle.
- `E_OPERATOR_CONFLICT` — two registrations for the same infix/prefix/postfix
  symbol across the merged fragments.
- `E_KEYWORD_CONFLICT` — two registrations for the same `expr_prefix` /
  `expr_form` / `stmt_form` leading keyword.
- `W_PRODUCTION_REPLACED` — `rule foo = …` silently overwrote an existing
  production in the base grammar.
- `E_INCOMPATIBLE_GRAMMARS` — `use X` where X's base chain is incompatible
  with current grammar.
- `E_USE_EXPR_TOO_COMPLEX` — `use` RHS isn't in the Phase 6 whitelist.

Deferred in Phase 6 syntax, kept in grammar2 internals: `rule foo -= …`
(remove alternative), `rule foo[name] = …` (replace specific alternative).
Selectors design revisited in Phase 7 with concrete use cases.

## Architecture

### Compilation model

A `grammar { … }` block is sugar for a sequence of primitive calls on a fresh
fragment accumulator:

```
grammar extends allegro {
  precedence pow { above mul, below unary }
  infix "**" prec(pow) right => (l, r) => pow_impl(l, r)
}
```

desugars to:

```
__frag = grammar_fragment_new("allegro")
grammar_precedence_add(__frag, "pow", [above("mul"), below("unary")])
grammar_infix_add(__frag, "**", prec_spec("pow"), "right",
                  (l, r) => pow_impl(l, r))
grammar_fragment_finalize(__frag)    // returns a Grammar value
```

The block is just an expression; it can be bound to a symbol, returned from
functions, passed around. A module with exactly one top-level grammar expression
auto-exports it as the module's default for `use import <module>`.

### Base grammar refactor (prerequisite — step 1)

The stratified precedence stack needs a data-driven ordering. Currently:

```typescript
addProduction(g, { name: "expr_add",
  rule: leftBinary("expr_add", "expr_mul", [
    { op: "+", tag: "add" }, { op: "-", tag: "sub" },
  ]),
});
```

After refactor (semantics unchanged):

```typescript
const LEVELS: LevelSpec[] = [
  { name: "pipe", build: (tighter) => /* pipe rule using tighter */ },
  { name: "or",   build: (tighter) => /* … */ },
  // …
  { name: "atom", build: () => /* terminal level */ },
];

for (let i = 0; i < LEVELS.length; i++) {
  const level   = LEVELS[i];
  const tighter = LEVELS[i + 1]?.name;
  addProduction(g, { name: "expr_" + level.name,
    rule: level.build(tighter ? "expr_" + tighter : undefined) });
}
```

Split points to preserve (from existing grammar): pipe, or, and, eq, cmp, add,
mul, of, unary, post, atom. 11 levels. All existing `{name: tag}` attrs on
alternatives stay as-is; tree-builder dispatch unaffected.

**Size**: one file, ~80 LOC moved into a new LEVELS array + build loop.

### Fragment representation extension

`src/types.ts` — extend `GrammarFragment`:

```typescript
export interface GrammarFragment {
  // Base identity
  base?: string;                  // "allegro" | "empty" | "<module-name>"

  // Lexer additions
  keywords:  Array<{ name: string }>;
  operators: Array<{ symbol: string }>;

  // Precedence declarations
  precedence: Array<{
    name:        string;           // anonymous gets gensym "__anon_N"
    constraints: Array<
      | { kind: "at";    target: string }
      | { kind: "above"; target: string }
      | { kind: "below"; target: string }
    >;
  }>;

  // Operator registrations
  infix:      Array<{ token: string; level: string; assoc: Assoc; fn: Value }>;
  prefixOp:   Array<{ token: string; level: string; fn: Value }>;
  postfixOp:  Array<{ token: string; level: string; fn: Value }>;
  exprPrefix: Array<{ keyword: string; fn: Value }>;

  // Multi-token entry points
  exprForms:  Array<{ parts: LabeledRule[]; fn: Value }>;
  stmtForms:  Array<{ parts: LabeledRule[]; fn: Value }>;

  // User-defined sub-rules (local nonterms)
  rules: Array<{
    name:    string;
    op:      "add" | "replace" | "append";   // maps to grammar2 Operation kind
    rule:    Rule;                             // full rule or alternative for append
    builder?: Value;                           // optional template
  }>;
}

type Assoc = "left" | "right" | "none";

interface LabeledRule {
  label?: string;                  // name of the binding (Param key)
  rule:   Rule;
}
```

### Grammar value with base chain

Update `Grammar` to carry provenance (either in `meta` or as a first-class
field):

```typescript
export interface Grammar {
  productions: Map<string, Production>;
  start:       string;
  reserved:    Map<string, Set<string>>;
  precedence:  PrecedenceInfo;
  meta: Record<string, unknown>;
  baseChain?:  string[];           // e.g. ["allegro"] or ["sql_base", "sql"]
}
```

Compatibility check at `use` time: `current.baseChain` and `X.baseChain` are
compatible iff one is a prefix of the other.

### Merger in `src/grammar2/fragments.ts`

Updated flow:

1. **Collect** registrations and precedence declarations from all fragments.
2. **Linearize precedence**:
   - Build a DAG over all levels (built-ins + user).
   - `at(X)` edges → aliasing (same rank).
   - `above(X)` / `below(X)` edges → strict ordering.
   - Topological sort; cycle → `E_PRECEDENCE_CYCLE`.
3. **Conflict detection**:
   - Map `(form, token)` → registration. Collision → `E_OPERATOR_CONFLICT` or
     `E_KEYWORD_CONFLICT`.
   - Map level name → precedence constraints. Contradiction →
     `E_PRECEDENCE_CONSTRAINT_CONFLICT`.
4. **Insert new precedence levels**:
   - Given ordered LEVELS and user inserts, build the new ordered list.
   - For each inserted level L (between looser A and tighter B): synthesize
     `expr_L = expr_B (op expr_B)*`-shaped production using the fragment's
     operators at L.
   - Rewrite A's tighter-neighbor reference to point at L (not B).
5. **Add user-rule productions**: prefix with fragment-id namespace if needed to
   avoid collision with base grammar names (e.g. `frag_pow__match_case`).
6. **Wire entry-point forms**: `expr_form` registrations become new alternatives
   on the atom level (or a dedicated `user_expr_form` nonterm that atom falls
   through to). `stmt_form` on the statement nonterm.

Level insertion is the most substantive new code — rough estimate 150–200 LOC in
`fragments.ts`, plus 40–60 LOC test grammar setup.

### Parser changes — recognizing `grammar { … }` and `use X`

`src/grammar2/base-grammar.ts` gains:

- Reserved keywords: `grammar`, `new`, `extends`, `use`, `infix`, `prefix`,
  `postfix`, `expr_prefix`, `expr_form`, `stmt_form`, `rule`, `precedence`,
  `above`, `below`, `at`, `prec`, `left`, `right`, `none`.
  - Note: some of these (`left`, `right`, `none`) are context-sensitive —
    only reserved inside a grammar block. Phase 6 makes them globally reserved
    for simplicity; if it breaks existing code, revisit.
- New productions:
  - `grammar_expr` — top-level, recognized in expression position.
  - `grammar_body` — sequence of `grammar_decl`s.
  - `grammar_decl` — union of `precedence_decl`, `infix_decl`, `prefix_decl`,
    `postfix_decl`, `expr_prefix_decl`, `expr_form_decl`, `stmt_form_decl`,
    `rule_decl`.
  - `ebnf_body` — the EBNF mini-grammar (covers table in design summary).
  - `prec_spec` — `prec(NAME)` / `at(X)` / `above(X)` / `below(X)` / combined.
  - `use_expr` — dedicated start production for the `use X` pre-scanner
    (whitelist-restricted expression subset).
- Atom-level handling: `grammar { … }` and `new grammar { … }` as primary
  expressions.

Tree-builder (`src/grammar2/tree-builder.ts`): new cases for each `grammar_decl`
tag, lowering to the fragment-primitive call sequence from the compilation model.

### New primitives

`src/primitives.ts` — add:

- `grammar_fragment_new(base: String): FragmentHandle`
- `grammar_fragment_finalize(handle): Grammar`
- `grammar_precedence_add(handle, name, constraints)`
- `grammar_infix_add(handle, symbol, level_spec, assoc, fn)`
- `grammar_prefix_add(handle, symbol, level_spec, fn)`
- `grammar_postfix_add(handle, symbol, level_spec, fn)`
- `grammar_expr_prefix_add(handle, keyword, fn)`
- `grammar_expr_form_add(handle, parts, fn)`
- `grammar_stmt_form_add(handle, parts, fn)`
- `grammar_rule_add(handle, name, rule, builder?)`
- `grammar_rule_replace(handle, name, rule, builder?)`
- `grammar_rule_append(handle, name, rule, builder?)`
- Grammar combinators: `combine(g1, g2)`, `override(g, name, rule)`, `without(g, name)`.

Phase 1 primitives (`register_infix`, `register_prefix`, `register_postfix`,
`register_expr_prefix`) retained as back-compat shims — each creates a transient
fragment and adds one registration. Marked deprecated in CLAUDE.md.

### `use X` pre-scanner rewrite

`src/runtime.ts` / `src/index.ts`:

- Delete the current `use_grammar NAME` regex.
- Add a `preScanUses(source): { uses: string[]; rest: string }` that:
  1. Iterates lines top-down.
  2. For each line matching `^use\b`, parse from that position using grammar2's
     `use_expr` start production.
  3. Collect the parsed expression strings; stop at first non-`use` line.
- For each collected expression:
  1. Evaluate in a bootstrap context (primitives + imports processed so far).
  2. Expect the result to be a Grammar or Grammar-producing import.
  3. Extract the Grammar and add to the fragment list.
- Merge fragments, compatibility-check, extend the grammar, then proceed with
  the main parse.

### Analyzer additions

`src/grammar2/analyzer.ts`:

- `checkPrecedence(grammar)` — topological sort of precedence constraints;
  produces `E_PRECEDENCE_CYCLE` / `E_PRECEDENCE_CONSTRAINT_CONFLICT`.
- `checkConflicts(fragments)` — runs during merge, not on finalized grammar;
  produces `E_OPERATOR_CONFLICT` / `E_KEYWORD_CONFLICT`.
- `checkBaseChain(currentGrammar, X)` — `E_INCOMPATIBLE_GRAMMARS`.
- `checkReplacedProductions(grammar, replacements)` — emits
  `W_PRODUCTION_REPLACED` for each rule in a fragment whose name already
  existed in the base grammar.

Not yet ported to the Allegro analyzer in `lib/grammar-analyzer.alg` — that
catches up in a later phase.

### Migration

| File | Change |
|---|---|
| `lib/pow.alg` | Rewrite with `grammar { infix "**" prec(pow) right => … }` syntax. |
| `tests/grammar-runtime.alg` | `use_grammar pow` → `use import pow`. |
| `src/grammar2/base-grammar.ts` | Level-data refactor (step 1); add `grammar_expr`, `use_expr`, EBNF productions; new keywords. |
| `src/grammar2/tree-builder.ts` | New handlers for grammar_decl tags. |
| `src/grammar2/fragments.ts` | Extended merger (precedence linearization, level insertion, conflict checks). |
| `src/grammar2/analyzer.ts` | New checks listed above. |
| `src/grammar2/types.ts` | `GrammarFragment` extension; `Grammar.baseChain`. |
| `src/types.ts` | Re-export `GrammarFragment`. |
| `src/primitives.ts` | New grammar-building primitives; deprecate Phase 1 register_* (keep as shims). |
| `src/runtime.ts` | `preScanUses` replaces `use_grammar` handling; fragment merge + compat check. |
| `src/index.ts` | Same — replace `use_grammar` references. |
| `CLAUDE.md` | Update grammar-extension description; note `use_grammar` removal and Phase 1 API deprecation. |
| `BACKLOG.md` | Mark Phase 6 done in the grammar2 line. |

`use_grammar` is deleted outright. Single in-tree caller (`tests/grammar-runtime.alg`)
migrates in the same commit.

## Reusable pieces

- `substituteParams` in `src/evaluator.ts` — unchanged; drives template
  substitution for all registration forms.
- `grammar2/types.ts` Operation union — already supports add/append/replace;
  Phase 6 exposes add/append/full-replace only.
- Grammar2 analyzer caching (WeakMap) — merged grammars cached per identity.
- `evalSource` already runs `assertGrammarClean` pre-parse; Phase 6 checks
  piggyback on that.

## Verification

1. `npx tsc --noEmit` — clean.
2. `npx tsx src/test.ts` — all existing 581 tests pass.
3. New tests (target ~12–15 added):
   - `grammar { infix "**" prec(pow) right => … }` parses and registers.
   - `use import pow` activates; `2 ** 10 == 1024`.
   - `prec(pow) above mul below unary` — `2 ** 3 * 4` parses `(2**3)*4`.
   - `at("*")` — operator-symbol lookup equals `at(mul)`.
   - `expr_form "match" s:expr "with" body:match_body` — end-to-end.
   - `stmt_form "for" x:ident "in" xs:expr ":" body:block` — offside body.
   - `new grammar { rule start = … }` — standalone grammar.
   - `grammar extends empty { … }` — equivalent to `new grammar`.
   - Two modules register `**` → `E_OPERATOR_CONFLICT` at `use` time.
   - Cyclic `precedence a { above b }; precedence b { above a }` →
     `E_PRECEDENCE_CYCLE`.
   - `use 2 + 2` → `E_USE_EXPR_TOO_COMPLEX`.
   - `use import pow` in a file whose current grammar is non-Allegro →
     `E_INCOMPATIBLE_GRAMMARS`.
   - `rule expr_add = …` in a fragment → `W_PRODUCTION_REPLACED`.
   - `rule expr_add += seq([…])` appends correctly.
4. Migration test: `tests/grammar-runtime.alg` under new syntax still passes.
5. `bash deploy.sh` site build; browser smoke-test of any updated sandbox.

## Order of work

Broken into steps that each land clean and tested:

1. **LEVELS refactor** in `base-grammar.ts`. Semantics unchanged; tests still pass.
2. **Extend `GrammarFragment` type** and `Grammar.baseChain`. Stub new primitives
   with "not implemented" errors.
3. **EBNF mini-grammar + grammar_expr / use_expr productions** in base-grammar.ts;
   tree-builder cases. Smoke test: parse a trivial `grammar { infix … }` block
   into its AST representation.
4. **Primitive implementations** for Phase 1 subset (`grammar_infix_add` etc.)
   driving the fragment accumulator. Migrate `lib/pow.alg` to new syntax; old
   `use_grammar` path deleted; `tests/grammar-runtime.alg` passes with new syntax.
5. **Named precedence** — `prec(name)`, `at(X)`, `above(X)`, `below(X)`; level
   insertion in `fragments.ts`. Add pow-above-mul test. Operator-symbol lookup.
6. **Multi-token forms** — `expr_form` and `stmt_form` plus user sub-rules.
   Match-expression and for-loop tests.
7. **Conflict detection** — operator conflicts, precedence cycles,
   incompatible-base, production-replacement warnings. Dedicated tests for each
   error code.
8. **`use X` pre-scanner** — replace `use_grammar` path. Restricted expression
   subset (symbol / import / whitelisted combinators). Compatibility check.
   `E_USE_EXPR_TOO_COMPLEX` test.
9. **CLAUDE.md + BACKLOG.md update**; commit Phase 6.

Steps 1, 2, 3, 5, 6, 8 are the substantial ones; 4, 7 are mostly wiring; 9 is docs.

## Scope boundaries (deferred)

- **Selectors for `-=` and `[name] =`** — designed alongside real use cases.
- **New literal kinds** (dates, units, hex) — case 6 deferred.
- **Pattern extensions** inside when/is/then — case 7 deferred.
- **Type-expression extensions** — case 8 deferred.
- **Whole-file grammar substitution** — case 9 deferred; `new grammar` provides
  the building block but file-level activation needs more thought.
- **Arbitrary parse-time builder lambdas** — Phase 1 template-substitution only.
- **Hygienic substitution** — templates still capture parse-site names.
- **Single-pass `use`** — pre-scanner remains two-pass.
- **Allegro port of the new analyzer checks** — TS only for Phase 6.
- **Runtime-extension from the hosting file** — grammar expressions still live
  in modules; file can only `use` them. Hosting-file registrations Phase 7+.
- **Per-scope / block-local activation** — file-scope only.
