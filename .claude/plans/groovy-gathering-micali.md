# Runtime Grammar Extension — Phase 1

## Context

The hybrid Pratt/recursive-descent parser (`src/hybrid-parser.ts`) uses cached, immutable singleton configs (`_baseConfig`, `_stdConfig`). There's no mechanism to add parselets or operators from Allegro code, and module loading happens AFTER parsing (so imports can't affect syntax). Phase 1 changes this so that a module can register new operators and simple prefix keywords; files that `use_grammar`-declare such a module get those syntactic additions.

Scope for Phase 1: **module-scoped, four kinds of registrations**. All are "simple combinators" — user supplies a lambda that maps AST operands to a new AST node, executed via `substituteParams` at parse time. No evaluator needed during parsing.

- `register_infix(op, bp, (l, r) => ast)` — binary operator, e.g. `**`, `^^`
- `register_prefix(op, bp, (x) => ast)` — unary prefix symbol, e.g. `#x`, `@x`
- `register_postfix(op, bp, (x) => ast)` — unary postfix symbol, e.g. `n!` factorial
- `register_expr_prefix(kw, (x) => ast)` — unary prefix KEYWORD followed by one expression, e.g. `lazy x`, `await x`

Deferred to Phase 2+: multi-token forms (`match x with ...`), conflict detection, registration from the hosting file itself, new statement forms.

## Activation: `use_grammar` header

Files that want grammar extensions declare them at the very top:

```allegro
use_grammar extra_ops
use_grammar sql_syntax

x = 2 ** 10                           // ** from extra_ops
q = sql "SELECT * FROM users"         // sql prefix from sql_syntax
```

`use_grammar NAME` must appear before any non-`use_grammar`, non-comment, non-blank line. The file runner pre-scans for these via a tiny regex before the main parse. Each `use_grammar` is equivalent to an `import` PLUS applying the module's grammar extension to the rest of the file.

## Architecture

### Extension-type augmentation

Extend `Extension` in `src/types.ts`:

```typescript
export interface Extension {
  name: string;
  bindings: Record<string, Value>;
  moduleObject?: Value;
  grammarFragment?: GrammarFragment;   // NEW
}

export interface GrammarFragment {
  // Lexer additions
  keywords: Array<{ name: string }>;           // new identifiers treated as keywords
  operators: Array<{ symbol: string }>;        // new operator-char sequences
  // Parselet registrations — each `fn` is a user-supplied ComposedFunction
  infix:      Array<{ token: string; bp: number; fn: Value }>;
  prefixOp:   Array<{ token: string; bp: number; fn: Value }>;
  postfixOp:  Array<{ token: string; bp: number; fn: Value }>;
  exprPrefix: Array<{ keyword: string; fn: Value }>;
}
```

### New TokenType values

Add to `src/lexer.ts`:
- `TokenType.UserOp` — user-registered operator (matched as a string)
- `TokenType.UserKeyword` — user-registered keyword identifier

For these two tokens, the parser dispatches by `token.text` (not by type alone). A new parallel parselet map keyed by text handles them:

```typescript
interface HybridGrammarConfig {
  // ... existing
  userPrefixParselets: Map<string, PrefixParseFn>;   // keyed by token text
  userInfixParselets:  Map<string, InfixParselet>;
}
```

In the Pratt loop, when the next token is `UserOp` or `UserKeyword`, look up in `userInfixParselets.get(token.text)` before falling through.

### New primitives (in `src/primitives.ts`)

Each stores its registration in a module-local "grammar fragment" slot. The slot lives as a hidden binding `__grammar_fragment` on the current evaluation context (or its own handle in the registry, if simpler). Module loader reads this slot after module eval and attaches to the returned `Extension`.

```typescript
// All four follow the same pattern:
const register_infix_impl: PrimitiveFnImpl = (args, ctx) => {
  const [opVal, bpVal, fnVal] = args.map(primaryOf);
  const op = bitsToString(asBits(opVal, "register_infix"));
  const bp = Number(toSigned(asBits(bpVal, "register_infix")));
  // fnVal should be a ComposedFunction with 2 params
  const fragment = getOrCreateFragment(ctx);
  fragment.infix.push({ token: op, bp, fn: fnVal });
  fragment.operators.push({ symbol: op });
  return noneSingleton;
};
```

### Substituteparam-based dispatch (parse time)

When the Pratt parser fires a user parselet, it does:

```typescript
// For infix:
{ bp, parse: (parser, left, token) => {
    const right = parser.parseExpression(bp);
    return substituteParams(userFn, [left, right]);   // AST template → AST
}}

// For prefix-op:
(parser, token) => {
  const arg = parser.parseExpression(bp);
  return substituteParams(userFn, [arg]);
}

// Similarly for postfix and expr-prefix.
```

`substituteParams` is already exported from `src/evaluator.ts`. It substitutes Param values in the user's ComposedFunction body with the AST operands and returns a new Expression. **No evaluation happens** — the result is still an AST; the normal evaluator processes it later.

### File-runner two-pass flow (`src/index.ts`)

Current flow (for typed mode):
1. Parse file with `parseStandard`
2. Discover imports from fileCtx
3. Load modules → extensions
4. `evalSource(source, undefined, extensions, ...)`

New flow:
1. **Pre-scan source** for `use_grammar NAME` lines at the top (regex: `^use_grammar\s+(\w+)` before first non-empty/non-comment non-`use_grammar` line).
2. For each discovered name: `ModuleLoader.load(name)`. Collect each module's `grammarFragment`.
3. Merge all fragments into a new `HybridGrammarConfig` based on `getStandardGrammarConfig()`.
4. Also continue to discover normal `import`s (light parse with the NOW-MERGED config — succeeds because extension syntax is recognized).
5. Load those modules too.
6. Call `evalSource(source, undefined, allExtensions, undefined, true, fm)` with a new optional `grammarConfig` parameter that overrides the default.

Actually, simpler: if grammar fragments exist, bypass the cached config. Build a custom config, call `parseWithConfig(source, customConfig)` directly in `evalSource`. Plumb `grammarConfig?: HybridGrammarConfig` through `evalSource`.

### Module loader changes (`src/modules.ts`)

After evaluating a module's bare expressions, extract the grammar fragment (from `__grammar_fragment` binding in the module's evalCtx) and attach to the returned Extension. Modules WITHOUT registrations return `grammarFragment: undefined`, everything works as before.

### Merging `HybridGrammarConfig`

New helper `mergeGrammarFragments(base, fragments): HybridGrammarConfig`:

```typescript
function mergeGrammarFragments(
  base: HybridGrammarConfig,
  fragments: GrammarFragment[],
): HybridGrammarConfig {
  // Combine lexer additions
  const newKeywords = new Map<string, TokenType>();
  const newOperators: [string, TokenType][] = [];
  for (const f of fragments) {
    for (const k of f.keywords)  newKeywords.set(k.name, TokenType.UserKeyword);
    for (const o of f.operators) newOperators.push([o.symbol, TokenType.UserOp]);
  }
  const lexerConfig = extendLexerConfig(base.lexerConfig, {
    keywords: newKeywords,
    operators: newOperators,
  });

  // Combine parselet maps
  const userPrefixParselets = new Map<string, PrefixParseFn>();
  const userInfixParselets  = new Map<string, InfixParselet>();
  for (const f of fragments) {
    for (const i of f.infix)     userInfixParselets.set(i.token, buildInfix(i));
    for (const p of f.prefixOp)  userPrefixParselets.set(p.token, buildPrefixOp(p));
    for (const p of f.postfixOp) userInfixParselets.set(p.token, buildPostfix(p));
    for (const e of f.exprPrefix) userPrefixParselets.set(e.keyword, buildExprPrefix(e));
  }

  return { ...base, lexerConfig, userPrefixParselets, userInfixParselets };
}
```

## Demo

### Module `lib/pow.alg` (user-writable, but we ship it as a standard example)

```allegro
register_infix("**", 40, (l, r) =>
  // l ** r is a placeholder for now; use repeated multiplication
  when r == 0
    is true then 1
    is _    then l * pow_helper(l, r, 1)
)

pow_helper(base, n, acc) =>
  if n == 0 then acc else pow_helper(base, n - 1, acc * base)
```

Actually, the lambda body is substituted AS AST, so recursion via `pow_helper` works naturally — the substituted AST just references the symbol, which resolves at eval time.

### Demo file

```allegro
use_grammar pow

print(2 ** 10)          // 1024
print(3 ** 4)           // 81
```

### Website sandbox section

New "Runtime Grammar" section between Grammar Extensions and Recursive Algorithms on allegrolang.org. Shows the `use_grammar` example plus an inline registration demo.

## Critical files

| File | Change |
|------|--------|
| `src/lexer.ts` | Add `UserOp`, `UserKeyword` TokenTypes; treat as identifier-like in tokenizer |
| `src/hybrid-parser.ts` | Add `userPrefixParselets`, `userInfixParselets` to config; check in Pratt loop when token type is User* |
| `src/types.ts` | Add `grammarFragment?` to `Extension` |
| `src/primitives.ts` | Add 4 `register_*` primitives |
| `src/runtime.ts` | Plumb optional `grammarConfig` through `evalSource`; merge extensions' fragments |
| `src/modules.ts` | Extract `__grammar_fragment` from module after eval; attach to Extension |
| `src/index.ts` | Pre-scan for `use_grammar` header; two-pass module loading |
| `lib/pow.alg` | Sample grammar-extension module (new) |
| `tests/grammar-runtime.alg` | End-to-end test using `use_grammar` |
| `src/test.ts` | Unit tests for each primitive and the merge logic |
| `website/index.html` | Runtime Grammar section |

## Reusable pieces

- `substituteParams` in `src/evaluator.ts` — map template ComposedFunction + AST args → AST
- `extendLexerConfig` in `src/lexer.ts` — immutable layered lexer config
- `parseWithConfig` in `src/hybrid-parser.ts` — already accepts a custom config
- `ModuleLoader` in `src/modules.ts` — exists; we just read a new slot from the module's evalCtx
- Existing `import`-discovery flow in `src/index.ts:loadImportedModules` — extended to also produce grammar-augmented config

## Verification

1. `npx tsc --noEmit` — clean compile
2. `npx tsx src/test.ts` — all 411 tests pass + new unit tests for each register_* primitive and mergeGrammarFragments
3. `npx tsx src/index.ts tests/grammar-runtime.alg` — end-to-end test prints expected outputs (`2 ** 10 == 1024`, etc.)
4. `bash deploy.sh` — site rebuilds
5. Browser smoke-test: open allegrolang.org, click Run on the Runtime Grammar sandbox, see new operators working
6. Existing regex-DSL demo still works (it uses Earley, not the hybrid extension path)

## Scope boundaries (Phase 2+)

- Multi-token prefix parselets (`match x with ...`, `for x in xs { ... }`)
- New statement forms (register_statement)
- Conflict detection and helpful error messages
- Registration from the hosting file (not just from modules)
- Operator/keyword name mangling to allow shadowing built-ins
- Per-scope (block-local) grammar activation
