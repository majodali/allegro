# Allegro — Project Summary & Instructions

## Build & Run

```bash
npx tsc --noEmit                    # type-check
npx tsx src/index.ts                # REPL (base mode)
npx tsx src/index.ts basics.alg     # run a file (base mode)
npx tsx src/test.ts                 # run tests (154 tests)
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

**Test .alg files** are in `tests/` and exercise Allegro Standard features.
They are validated automatically by the test suite via `// expect:` comments.

## Project Setup

- ESM modules (`"type": "module"` in package.json, `"module": "nodenext"` in tsconfig)
- All imports use `.js` extensions (required by nodenext resolution)
- `parser.ts` is auto-generated and uses `// @ts-nocheck` — do not add type annotations to it
- `TextEncoder`/`TextDecoder` for string↔bits (web-standard, works in Node and browsers)
- The Earley parser in `parser.ts` handles its own lexing (no separate lexer)

## What is Allegro?

Allegro is a **programmable language platform** — a minimal, flexible core ("Allegro Base") that serves as a substrate for building higher-level languages and DSLs. The standard language ("Allegro Standard") is a curated stack of extensions providing familiar syntax, a type system, and common data types.

- **Allegro Base** — the primitive language: 7 value kinds, expression DAGs, recursive evaluator
- **Allegro Standard** — the standard language with types, modules, and extensions
- In normal use, "Allegro" refers to the standard language

### Key Design Goals
- **Human-AI collaboration**: Humans and AI agents negotiate domain abstractions, codify them as DSLs/type extensions, then both work within shared formalisms
- **Extensible grammar**: New syntactic constructs via grammar extensions, importable as modules
- **Configurable semantics**: Functional/non-functional, sync/async, type systems — all as extensions
- **Partial evaluation as compilation**: Each build phase is a partial evaluation step where phase-specific resources become available

## Architecture

```
Base language API (expression DAGs, evaluation contexts)
  → Base parser (first grammar, offside-rule blocks)
    → Grammar extension mechanism (GrammarBuilder, immutable layering)
      → Type system (types as MultiValue "type" components)
        → Module system (anonymous extensions, module loader)
          → Allegro Standard (typed literals, dot dispatch, logical ops, collections)
```

## The Seven Value Kinds

1. **Bits** — Vector of bits with a length. Encodes integers (64-bit), floats (IEEE 754), and strings (UTF-8).
2. **PrimitiveFunction** — Opaque host-language function. May be `lazy` (receives unevaluated args).
3. **ComposedFunction** — Expression body with declared parameter placeholders.
4. **Expression** — A DAG node: function reference + ordered arguments. The core computational construct.
5. **Context** — Evaluation context with named bindings. Also serves as the representation for Objects and Arrays.
6. **MultiValue** — A primary value plus named string-keyed components (type, error, warnings, source).
7. **Param** — A placeholder within expressions, bound on function invocation.

## Type System (Allegro Standard)

Types are Context values with `__name`, `__check`, and method bindings. A typed value is a MultiValue where the primary is the data and the `"type"` component is the type Context.

### Six Core Types
- **Int** — 64-bit signed integer. Arithmetic, comparison, toString.
- **Float** — IEEE 754 double. Arithmetic, comparison, toString.
- **String** — UTF-8 encoded Bits. Concat (+), length, slice, indexOf, toString.
- **Bool** — Int(0/1) with Bool type. Provided as `true`/`false` context bindings.
- **Array** — Context with numeric keys + `__length`. length, get, map, filter, reduce, concat, slice.
- **Object** — Typed Context. Field access via dot, keys, values, get.

### Type-Directed Dispatch
- `type_dispatch` checks the value's type component, finds the method, returns a self-bound closure
- Getters (e.g., `length`) are called immediately; methods return bound functions
- The evaluator's `PRIM_TO_METHOD` mapping dispatches base operators (`bits_add` etc.) through type methods when operands are typed
- No implicit fallback — missing type method is an error

### Type Propagation
- `typeLiterals` post-parse pass wraps raw Bits with type info (64-bit → Int, other → String)
- Float and Bool literals come from grammar extensions and type system bindings
- Type methods should return properly typed values (not raw Bits)

## Grammar Extension

- **GrammarBuilder** creates extensions without mutating the base grammar (immutable layering with structural sharing)
- Extensions add new alternatives to existing Disjunctions
- `repeat(element, { delimiter })` for variable-length constructs
- Current extensions: dot access, import, float literals, array/object literals, bracket access, logical operators

### Known Limitations
- **Earley scanner can't handle overlapping token lengths** — float literals use `int.digits` pattern instead of a regex terminal
- **Keywords vs identifiers** — `true`, `false` handled as context bindings; `export` will use same workaround. Proper keyword support deferred to parser reimplementation.
- **Logical operators at Expr level** — `&&`/`||` are at the same precedence (both below comparison). The `LambdaExpr` Disjunction is NOT in the pass-through chain from CompareExpr to Expr.

## Module System

- **Anonymous extensions**: named bindings injected by the execution context, layered between primitives and source
- **ModuleLoader**: loads `.alg` files as extensions with dependency resolution, caching, circular dependency detection
- **Import syntax**: `import name` — declarative, module values provided via extensions
- **Context layering**: primitives → extensions → base (REPL persistence) → source bindings
- **Export system**: not yet implemented — currently all bindings are visible. Planned: export as a primitive that builds a typed module interface.

## Build/Execution Context

Each build phase is a successive partial evaluation where phase-specific resources become available:
- **Compilation**: extensions, type system, module system, source files
- **Packaging**: third-party dependency implementations
- **Deployment**: environment resources, datastores, config
- **Execution**: runtime I/O, process, filesystem

Anonymous extensions are pre-loaded into the compilation context. Extension modules may consume bindings internally (e.g., module system uses a filesystem).

## Current Implementation State

### Files

- **`src/types.ts`** — Value types, constructors, utilities, Extension interface, string↔bits, float↔bits
- **`src/evaluator.ts`** — Recursive tree-walk evaluator, memoization, partial evaluation, type-directed dispatch via `PRIM_TO_METHOD`, closure support (substitution descends into inner functions)
- **`src/primitives.ts`** — All primitives: bits ops, expression/context/multi-value ops, type system (type_dispatch, typed_int/string/float/bool/array/object, typed operators, logical ops), grammar primitives, print (lazy for type preservation)
- **`src/types-std.ts`** — Six core types as Context values with method bindings, type helpers (getType, getTypeName, withType), makeArray, makeObject, createTypeSystem extension
- **`src/parser.ts`** — Auto-generated Earley parser. Exports Grammar classes, parse functions, helpers. `collectParams` descends into all composed functions for closure support.
- **`src/grammar-ext.ts`** — GrammarBuilder (terminal, phrase, repeat, addAlternative), built-in extensions (dot access, import, float literals, array/object literals, bracket access, logical ops), Allegro Standard grammar builder, handle registry for Allegro-level grammar primitives
- **`src/runtime.ts`** — `evalSource` (parse → typeLiterals → buildEvalCtx → evaluate), `typeLiterals` post-parse type wrapping, `resolvePrimitives`, `extensionToContext`
- **`src/modules.ts`** — ModuleLoader for .alg files with dependency resolution
- **`src/index.ts`** — Entry point: file runner + REPL (base mode only currently)
- **`src/test.ts`** — 154 tests: core evaluator, extensions, modules, grammar, standalone grammars, type system, file-based .alg tests

### Test Files (tests/)
- `types.alg` — typed literals, arithmetic, comparisons
- `dot-access.alg` — string methods, toString, getters
- `arrays.alg` — literals, bracket access, map/filter/reduce, chaining
- `objects.alg` — literals, dot access, nesting, keys
- `logical.alg` — &&, ||, !, with comparisons and if-then-else
- `functions.alg` — closures, composition, higher-order, recursion
- `modules.alg` — import + dot access on module

## Base Parser Syntax

```
// Bindings
x = 42
name = "hello"

// Function declarations
f(x, y) => x + y
factorial(n) => if n == 0 then 1 else n * factorial(n - 1)

// Anonymous functions (lambdas) and closures
x => x * 2
(x, y) => x + y
make_adder(n) => x => x + n

// If-then-else (branches auto-wrapped in thunks)
result = if x > 0 then x else 0 - x

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

## Allegro Standard Syntax (extensions)

```
// Dot access (type-directed dispatch)
"hello".length          // getter → 5
"hello".slice(0, 3)     // bound method → "hel"
42.toString()            // → "42"

// Float literals
pi = 3.14

// Bool literals
flag = true

// Array literals and methods
nums = [1, 2, 3, 4, 5]
nums[0]                  // bracket access → 1
nums.map(x => x * 2)    // → [2, 4, 6, 8, 10]
nums.filter(x => x > 3) // → [4, 5]
nums.reduce((a, x) => a + x, 0) // → 15

// Object literals
point = {x: 10, y: 20}
point.x                  // → 10
nested = {a: {b: 42}}
nested.a.b               // → 42

// Logical operators (short-circuiting)
true && false            // → false
false || true            // → true
!true                    // → false
x > 0 && x < 10         // comparisons with logical

// Import
import math
math.pi

// String concatenation
"hello" + " " + "world" // → "hello world"
```

## Design Philosophy

- The base language is a **specification**, not a user-facing language
- **Extensions are where the language lives** — everything beyond the seven kinds and their primitives is an extension
- **Partial evaluation is the compilation model** — each build phase binds more symbols
- **Types as values** — type checking happens during evaluation via type components, not a separate pass
- **Immutable grammar extension** — new grammars share structure with the base, never mutate it
- **Browser-compatible** — core uses `TextEncoder`/`TextDecoder`, not `Buffer`
- **No implicit fallback** in typed operators — missing type method is an error
- **Immutable bindings and values** (for now) — mutation semantics to be explored later

## What's Next

1. **Module exports** — `export` primitive that builds typed module interface for encapsulation
2. **Type annotations** — `f(x: Int) => ...` (requires design work)
3. **Keyword support** — proper keyword vs identifier disambiguation (deferred to parser reimplementation)
4. **Parser reimplementation** — bootstrapping Allegro's parser within Allegro itself
5. **String interpolation** — `"hello {name}"`
6. **`index.ts` update** — `--std` flag for Allegro Standard mode
