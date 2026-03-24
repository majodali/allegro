# Allegro — Project Summary & Instructions

## Build & Run

```bash
npx tsc --noEmit                    # type-check
npx tsx src/index.ts                # REPL (Allegro Standard — default)
npx tsx src/index.ts file.alg       # run a file (Allegro Standard)
npx tsx src/index.ts --base         # REPL (Allegro Base)
npx tsx src/index.ts --base file.alg  # run a file (Allegro Base)
npx tsx src/test.ts                 # run tests (199 tests)
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

### Eight Core Types
- **Int** — 64-bit signed integer. Arithmetic, comparison, toString.
- **Float** — IEEE 754 double. Arithmetic, comparison, toString.
- **String** — UTF-8 encoded Bits. Concat (+), length, slice, indexOf, toString.
- **Bool** — Int(0/1) with Bool type. Provided as `true`/`false` context bindings.
- **Array** — Generic type `Array[T]`. Context with numeric keys + `__length`. length, get, map, filter, reduce, concat, slice. Element type inferred from contents.
- **Object** — Typed Context. Field access via dot, keys, values, get.
- **Function** — Generic type `Function[ParamTypes, ReturnType]`. Attached to typed function definitions. Supports type variable unification at call sites.
- **UntypedFunction** — Wraps base language primitives entering standard context. Every value in standard mode has a type.
- **Any** — Matches any type. Used when generic types are used without explicit parameters (e.g., bare `Array` → `Array[Any]`).

### Generics
- Generic types are type constructors: `Array` is a function from type params to concrete types
- `Array[Int]` is a concrete type produced by applying `Array` to `Int`
- Type parameters can be types or values (e.g., `Vector[3]`)
- Concrete types are memoized — `Array[Int]` always returns the same Context
- Generic types have `type = GenericType` (subtype of `Type`)
- Bare generic in annotations auto-applies `Any`: `arr: Array` → `arr: Array[Any]`

### Function Types and Unification
- `Function[ParamTypes, ReturnType]` — parameterized type for typed functions
- Type variables (unresolved Params in type expressions) bind progressively during function calls
- Unification: match arg types against param types, accumulate type variable bindings
- Bidirectional flow: `T` determined from one arg propagates to constrain others
- Contradictory bindings (e.g., `T = Int` and `T = String`) produce type errors

### Type-Directed Dispatch
- `type_dispatch` checks the value's type component, finds the method, returns a self-bound closure
- Getters (e.g., `length`) are called immediately; methods return bound functions
- The evaluator's `PRIM_TO_METHOD` mapping dispatches base operators (`bits_add` etc.) through type methods when operands are typed
- No implicit fallback — missing type method is an error

### Type Propagation
- `typeLiterals` post-parse pass wraps raw Bits with type info (64-bit → Int, other → String)
- Float and Bool literals come from grammar extensions and type system bindings
- Type methods return properly typed values (not raw Bits)

### Type Annotations
- Function parameters: `f(x: Int, y: String) => body`
- Return types: `f(x: Int): String => body`
- Type expressions support generics: `f(arr: Array[Int]) => ...`
- Untyped functions via base grammar still work (`f(x) => x + 1`)
- Type checks inserted at param use sites via `type_check` primitive

## Grammar Extension

- **GrammarBuilder** creates extensions without mutating the base grammar (immutable layering with structural sharing)
- Extensions add new alternatives to existing Disjunctions
- `repeat(element, { delimiter })` for variable-length constructs
- Current extensions: dot access, import, float literals, array/object literals, bracket access, logical operators, type annotations

### Known Limitations
- **Earley scanner can't handle overlapping token lengths** — float literals use `int.digits` pattern instead of a regex terminal
- **Keywords vs identifiers** — `true`, `false` handled as context bindings; `export` will use same workaround. Proper keyword support deferred to parser reimplementation.
- **Logical operators at Expr level** — `&&`/`||` are at the same precedence (both below comparison). The `LambdaExpr` Disjunction is NOT in the pass-through chain from CompareExpr to Expr.

## Module System

- **Anonymous extensions**: named bindings injected by the execution context, layered between primitives and source
- **ModuleLoader**: loads `.alg` files as extensions with dependency resolution, caching, circular dependency detection
- **Import syntax**: `import name` — declarative, module values provided via extensions
- **Context layering**: primitives → extensions → base (REPL persistence) → source bindings
- **Export system**: `export("name", value)` primitive marks bindings for export. `buildModuleObject` wraps exported bindings as a typed Object. Planned: full typed module interfaces with encapsulation via type-directed dispatch.
- **Module objects**: imported modules are typed Objects — dot access dispatches through the module's type, exposing only exported fields.

## Partial Evaluation

Partial evaluation follows two rules:
1. **Rule 1**: If an expression results in an undefined value to be passed to a primitive, the partially evaluated expression is returned (with unbound symbols visible).
2. **Rule 2**: If `eval_if` (or any lazy primitive) has an undefined condition, all branches are partially evaluated non-lazily, propagating type information through both paths.

After partial evaluation, an expression's type is its `"type"` MultiValue component — which may be fully resolved or itself a partially evaluated expression. No separate `typeOf` function is needed.

## Build/Execution Context

Each build phase is a successive partial evaluation where phase-specific resources become available:
- **Invocation**: build tool selection
- **Configuration**: CLI args, env vars, config files, folder structure
- **Compilation**: extensions, type system, module system, source files bound; type checking via partial evaluation
- **Emitting**: target configuration, debug symbols, target-specific optimization
- **Packaging**: third-party dependency implementations bound; tree shaking
- **Deployment**: environment resources, datastores, config bound
- **Execution**: runtime I/O, process, filesystem bound; final evaluation

Phases are not strictly defined — a scripting environment may have only one phase where all bindings are available at once. Phase gate checks (postconditions) scan the expression graph for unresolved elements.

Anonymous extensions are pre-loaded into the compilation context. Extension modules may consume bindings internally (e.g., module system uses a filesystem).

## Current Implementation State

### Files

- **`src/types.ts`** — Value types, constructors, utilities, Extension interface, string↔bits, float↔bits
- **`src/evaluator.ts`** — Recursive tree-walk evaluator, memoization, partial evaluation (Rule 1 + Rule 2), type-directed dispatch via `PRIM_TO_METHOD`, closure support, type variable unification at call sites
- **`src/primitives.ts`** — All primitives: bits ops, expression/context/multi-value ops, type system (type_dispatch, type_check, type_apply, typed_int/string/float/bool/array/object, typed_function, typed operators, logical ops, unification), grammar primitives, print (lazy for type preservation)
- **`src/types-std.ts`** — Eight core types as Context values with method bindings, generic type support (buildGenericType, memoized type constructors), type helpers (getType, getTypeName, withType), FunctionType, UntypedFunction, AnyType, makeArray, makeObject, createTypeSystem extension
- **`src/parser.ts`** — Auto-generated Earley parser. Exports Grammar classes, parse functions, helpers. `collectParams` descends into all composed functions for closure support.
- **`src/grammar-ext.ts`** — GrammarBuilder (terminal, phrase, repeat, disjunction, addAlternative), built-in extensions (dot access, import, float literals, array/object literals, bracket access, logical ops, type annotations with generics), typed function builder (buildTypedFn), Allegro Standard grammar builder, handle registry
- **`src/runtime.ts`** — `evalSource` (parse → typeLiterals → buildEvalCtx → evaluate), `typeLiterals` post-parse type wrapping, `resolvePrimitives`, `extensionToContext`, UntypedFunction wrapping in standard mode
- **`src/modules.ts`** — ModuleLoader for .alg files with dependency resolution, caching, circular dependency detection. `buildModuleObject` for typed module exports.
- **`src/index.ts`** — Entry point: file runner + REPL. Allegro Standard by default, `--base` flag for base mode.
- **`src/test.ts`** — 199 tests: core evaluator, extensions, modules, grammar, standalone grammars, type system, generics, function types, unification, partial evaluation, file-based .alg tests

### Test Files (tests/)
- `types.alg` — typed literals, arithmetic, comparisons
- `dot-access.alg` — string methods, toString, getters
- `arrays.alg` — literals, bracket access, map/filter/reduce, chaining
- `objects.alg` — literals, dot access, nesting, keys
- `logical.alg` — &&, ||, !, with comparisons and if-then-else
- `functions.alg` — closures, composition, higher-order, recursion
- `modules.alg` — import + dot access on module
- `type-annotations.alg` — typed params, return types, typed recursion
- `generics.alg` — Array[Int], generic type annotations, type_apply
- `function-types.alg` — function type signatures, type variable unification

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

// Type annotations on functions
add(x: Int, y: Int): Int => x + y
greet(name: String): String => "Hello, " + name

// Generic type annotations
head(arr: Array[Int]): Int => arr[0]

// Lambdas with type annotations
nums.map(x: Int => x * 2)
(x: Int, y: Int): Int => x + y
```

## What's Next

1. **Module exports with encapsulation** — typed module interfaces where exports define the public type, private bindings hidden via type-directed dispatch
2. **Formalize partial evaluation phases** — explicit phase control in `evalSource`, phase gate checks (postconditions)
3. **Tail call optimization** — evaluator detects tail-position self-calls and loops instead of recursing
4. **Migrate array methods to Allegro** — map/filter/reduce as typed Allegro functions (not primitives)
5. **Keyword support** — proper keyword vs identifier disambiguation (deferred to parser reimplementation)
6. **Parser reimplementation** — bootstrapping Allegro's parser within Allegro itself
7. **Subtyping** — `extends`, `__extends` prototype chain in type dispatch
8. **Interfaces** — structural type matching
9. **String interpolation** — `"hello {name}"`
10. **Binding type annotations** — `x: Int = 42`

## Design Philosophy

- The base language is a **specification**, not a user-facing language
- **Extensions are where the language lives** — everything beyond the seven kinds and their primitives is an extension
- **Partial evaluation is the compilation model** — each build phase binds more symbols
- **Types as values** — type checking happens during evaluation via type components, not a separate pass
- **Immutable grammar extension** — new grammars share structure with the base, never mutate it
- **Browser-compatible** — core uses `TextEncoder`/`TextDecoder`, not `Buffer`
- **No implicit fallback** in typed operators — missing type method is an error
- **Immutable bindings and values** (for now) — mutation semantics to be explored later (linear types, transient mutation)
- **Every value in Standard mode has a type** — base primitives wrapped as UntypedFunction
- **Generic types are type constructors** — functions from type parameters to concrete types, memoized
