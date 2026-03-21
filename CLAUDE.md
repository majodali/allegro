# Allegro Base Language — Project Summary & Instructions

## Build & Run

```bash
npx tsc --noEmit                    # type-check
npx tsx src/index.ts                # REPL
npx tsx src/index.ts basics.alg     # run a file
npx tsx src/test.ts                 # run tests (once test.ts exists)
```

**Expected output from `basics.alg`:**
```
11
42
120
42
55
42
7
```

## Project Setup

- ESM modules (`"type": "module"` in package.json, `"module": "nodenext"` in tsconfig)
- All imports use `.js` extensions (required by nodenext resolution)
- `parser.ts` is auto-generated and uses `// @ts-nocheck` — do not add type annotations to it
- `TextEncoder`/`TextDecoder` for string↔bits (web-standard, works in Node and browsers)
- The Earley parser in `parser.ts` handles its own lexing (no separate lexer)

## What is Allegro?

Allegro is a **programmable language platform** — a minimal, flexible core (the "base language") that serves as a substrate for building higher-level languages and DSLs on top of. What most developers will experience as "Allegro" is a curated stack of extensions providing familiar syntax, rich type systems, and domain-specific features.

The base language sits below even its own parser — it is fundamentally an API for constructing and evaluating expression DAGs. The text parser is the first client of that API.

### Key Design Goals
- **Human-AI collaboration**: Humans and AI agents negotiate domain abstractions, codify them as DSLs/type extensions, then both work within shared formalisms
- **Extensible grammar**: New syntactic constructs defined within the language itself, importable as modules
- **Configurable semantics**: Functional/non-functional, sync/async, type systems — all as extensions
- **Partial evaluation as compilation**: Extensions (types, grammars, optimizers) run as Allegro code during partial evaluation, then get eliminated from runtime output

## Architecture

The dependency chain (no cycles allowed):

```
Base language API (expression DAGs, evaluation contexts)
  → Base parser (first grammar, offside-rule blocks)
    → Grammar extension mechanism
      → Type system extension
        → Async semantics / functional semantics
          → Standard library & DSLs
```

## The Seven Value Kinds

1. **Bits** — Vector of bits with a length. The only kind that reliably survives to runtime as data.
2. **PrimitiveFunction** — Opaque host-language function.
3. **ComposedFunction** — Expression body with declared parameter placeholders. Created via `expr.function()` which claims unowned params in its body expression.
4. **Expression** — A DAG node: a function reference + ordered arguments. This is the intermediate representation. Expressions are the core computational construct.
5. **Context** — Evaluation context with named bindings. Organizational scaffolding that typically gets compiled away.
6. **MultiValue** — A primary value (any kind) plus named string-keyed components. Multi-values are what evaluation produces — they carry metadata (types, source info, errors, warnings) alongside the primary value. Components are flat (no nesting). Primitive functions operate on the primary transparently.
7. **Param** — A placeholder within expressions, bound on function invocation. Has a position (integer) and an owner (the ComposedFunction it belongs to).

(Param is technically a sub-kind used within expressions, not a standalone value kind in the same sense as the other six.)

## Key Design Decisions

### Evaluation Model
- **Recursive tree-walk with memoization**. When a node is evaluated, the result can be attached as a memo.
- **Partial evaluation is fundamental**, not an optimization. When an expression has unresolved elements, the evaluator reduces as far as possible and returns the partially reduced form.
- **Interleaved parsing and evaluation**: As a file is parsed, expressions are constructed and potentially partially evaluated immediately. Constant expressions are fully evaluated before the next token is read.

### Functions
- A **composed function** is created with `makeComposedFn(params, body)`. Each param has a `position` (integer) and an `owner` (set to the function).
- `expr.function(body)` claims all unowned params in the body — ownership is assigned inside-out (inner functions before outer).
- **Recursion** works through lazy context bindings: a function references itself by name through the context, and by the time it's invoked, the binding exists.

### Error Handling
- Errors are **multi-value components**, not special binding states.
- Every function application produces a value with a potential `"error"` component.
- Primitive functions are **"dumb"** — they don't handle errors, they just fail if inputs are wrong types. Smarts are built in extensions.
- **Eager propagation**: when a primitive receives an argument with an error component, it propagates without executing.
- Explicit error catching via inspecting the error component of a value. No implicit distant handlers at the base level.
- **Algebraic effects** map naturally onto the existing model: effect handlers are unbound elements in evaluation contexts, bound when effects are raised. This requires no new primitives — it's the same mechanism as function params, imports, and dependency injection.

### Binding States
At the base level, a binding is either:
- **Unbound** — declared but not yet resolved (via `ctx_use`)
- **Bound** — resolved to a value

That's it. Async "pending" is just unbound-with-a-process-attached. Stream completion is handled through value components, not binding states.

### Warnings
Warnings propagate as multi-value components (key: `"warnings"`), not as thrown errors. Operations like grammar extension, parsing, partial evaluation, and type checking all return results with potential warning components. Only final evaluation throws errors that end processing.

### Grammar Extension
- The parser is not privileged infrastructure — it's the first client of the base language API.
- Grammar extensions are functions that take existing grammars + new productions and return new grammars.
- `grammar_set()` changes the active parser before the next token is read.
- **Operator expressions** use a Pratt parser with operator definitions bound in context (not individual productions per operator). Static precedence per operator; semantic dispatch by type.
- **Type-directed parsing**: type information serves as precedence indicators for ambiguous productions. Types must be defined before the text requiring disambiguation is parsed.
- Grammar extensions should ideally be block-style agnostic (work with both braces and indentation).

### Modules & Imports
- `import allegro.math` binds `math` to a namespace of exports
- `import allegro.math.round` binds `round` directly
- Module resolution mechanism is environment-defined, not baked into the language
- Exports are marked via multi-value components (extension-defined)
- `ctx_use(ctx, key)` declares unbound bindings — the environment resolves these at the appropriate lifecycle phase

### Multi-Component Values
- Exist at the **evaluation** level, not the construction level
- When building expression DAGs, nodes contain raw values
- Components get attached during evaluation/analysis
- Conventional components: `"error"`, `"warnings"`, `"type"`, `"source"`
- `value.kind()` was deliberately **excluded** — it works against partial evaluation. Type info should come from metadata components, not runtime inspection.

## Base Parser Syntax

```
// Bindings
x = 42
name = "hello"

// Function declarations
f(x, y) => x + y
factorial(n) => if n == 0 then 1 else n * factorial(n - 1)

// Anonymous functions (lambdas)
x => x * 2
(x, y) => x + y
() => 42

// If-then-else (branches auto-wrapped in thunks)
result = if x > 0 then x else -x

// Operators: + - * / % == != < > <= >=
// Standard precedence, left-associative

// Function calls
print(42)
f(3, 4)

// Indentation blocks (offside rule)
result =
    x = 3
    y = x + 1
    y

// C-style comments
// line comment
/* block comment */
```

## Current Implementation State

### What exists (in TypeScript):
- **`src/types.ts`** — All type definitions, constructors, utilities (`primaryOf`, `isResolved`), string↔bits conversion, `AllegroError`
- **`src/evaluator.ts`** — Recursive tree-walk evaluator with memoization, partial evaluation, position-based param substitution (with thunk descent), named param resolution from context
- **`src/primitives.ts`** — All primitive function implementations (bits, arithmetic, expression, context, multi-value, eval_if, id, print), `formatValue()` for display
- **`src/parser.ts`** — Auto-generated Earley parser (from `grammar/generate-parser.ts`). Self-contained, no imports. Exports `parse(input) → { tree, errors }`. Builds expression DAGs via attribute evaluation during parse tree construction. Grammar helpers (`buildFn`, `substName`, `cloneVal`, `collectParams`) handle function building and name substitution.
- **`src/runtime.ts`** — Bridge between parser and evaluator. Exports `resolvePrimitives()` (replaces parser stub primitives with real ones), `buildEvalCtx()` (builds evaluation context from parse output with optional base context for REPL persistence), and `evalSource()` (parse + evaluate in one call).
- **`src/index.ts`** — Entry point: file runner + REPL with persistent context across inputs.
- **`src/test.ts`** — Test suite (48 core tests + 3 REPL persistence tests). Run with `npx tsx src/test.ts`.

### Parser ↔ Evaluator bridge (in index.ts):
The parser creates stub `PrimitiveFunction` values with `fn: null` (e.g., `prim('bits_add')`). `index.ts` walks the parse output and replaces these with real primitives from `primitives.ts`. Named references (identifiers) become `Param` values with `position: -1` and `_name` set — the evaluator resolves these from the evaluation context at runtime.

### What's needed next:

1. **Testing**: Write test cases to verify:
   - Basic arithmetic: `3 + 4 * 2` → `11`
   - Function definition and calls: `f(x) => x * 2` then `f(5)` → `10`
   - Recursion: `factorial(5)` → `120`
   - If-then-else: `if 1 == 1 then 42 else 0` → `42`
   - Lambdas: `(x => x + 1)(5)` → `6`
   - Closures: outer function referencing inner params correctly
   - Error propagation: division by zero propagates
   - Partial evaluation: expressions with unbound elements reduce correctly
   - Indentation blocks

2. **Known issues to investigate**:
   - Deferred references don't memoize (by design — they're context-dependent). Verify this doesn't cause performance issues with deep recursion.

3. **Grammar extension primitives**: `grammar_current()`, `grammar_extend()`, `grammar_set()`, `production()`, and pattern constructors. These are complex and should be tackled after the core interpreter is solid.

4. **Module system**: File loading, import resolution, export marking. Environment-specific.

## Design Philosophy Reminders

- The base language is a **specification**, not a user-facing language. It's the contract any implementation must satisfy.
- **Extensions are where the language lives.** Everything beyond the seven kinds and their primitives is an extension.
- **Partial evaluation is the compilation model.** Extensions run as Allegro code during partial evaluation, produce validations/annotations, then get eliminated.
- **Evaluation contexts are modeling constructs**, not runtime artifacts. They exist during analysis and compilation, then disappear.
- **Don't add primitives for things extensions can handle.** The base should be minimal. If in doubt, leave it out.
- **Parse structure should be obvious by sight.** Operator precedence is static. No dynamic precedence based on types.
- **Browser-compatible**: Core types and evaluator should work in both Node.js and browser environments. Avoid Node-only APIs (e.g., use `TextEncoder`/`TextDecoder`, not `Buffer`).
