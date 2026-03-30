# Allegro — Project Summary & Instructions

## Build & Run

```bash
npx tsc --noEmit                    # type-check
npx tsx src/index.ts                # REPL (Allegro Standard — default)
npx tsx src/index.ts file.alg       # run a file (Allegro Standard)
npx tsx src/index.ts --base         # REPL (Allegro Base)
npx tsx src/index.ts --base file.alg  # run a file (Allegro Base)
npx tsx src/test.ts                 # run all tests
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
7. **Param** — A positional placeholder within function expressions, bound on invocation.
8. **Symbol** — A named reference, resolved during compilation via lexical scoping. Created by the parser for identifiers, resolved by `resolveSymbols` to bindings or Params.

## Type System (Allegro Standard)

Types are Context values with `__name`, `__check`, and method bindings. A typed value is a MultiValue where the primary is the data and the `"type"` component is the type Context.

### Ten Core Types
- **Int** — 64-bit signed integer. Arithmetic, comparison, toString.
- **Float** — IEEE 754 double. Arithmetic, comparison, toString.
- **String** — UTF-8 encoded Bits. Concat (+), length, slice, indexOf, trim, startsWith, endsWith, includes, split, replace (all by default, optional count), toUpperCase, toLowerCase, charAt, repeat, toCharCodes, toString.
- **Bool** — Int(0/1) with Bool type. Provided as `true`/`false` context bindings.
- **Array** — Generic type `Array[T]`. Context with numeric keys + `__length`. length, get, map, filter, reduce, concat, slice. Element type inferred from contents.
- **Object** — Typed Context. Field access via dot, keys, values, get.
- **Function** — Generic type `Function[ParamTypes, ReturnType]`. Attached to typed function definitions. Supports type variable unification at call sites.
- **UntypedFunction** — Wraps base language primitives entering standard context. Every value in standard mode has a type.
- **None** — Represents absence of a value. Singleton `none` keyword. Returned by `component_get` when a component is absent.
- **Error** — Represents a failed computation. Created via `error expr`. Error values propagate automatically through operations.
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
- Type methods return properly typed values — comparisons return Bool, arithmetic returns the operand type
- No implicit fallback — missing type method is an error
- Types can define `__getMember(self, fieldName)` as a fallback for fields not in the type's methods (like Python's `__getattr__`). Object uses this for field access. Types without `__getMember` enforce strict encapsulation.
- Types can define `__construct(args...)` — when a type Context is called as a function, the evaluator invokes `__construct`. Built-in types (Int, Float, String, Bool) have constructors that wrap values with the type.

### Type Propagation
- `typeLiterals` post-parse pass wraps raw Bits with type info (64-bit → Int, other → String)
- Float and Bool literals come from grammar extensions and type system bindings
- Type methods return properly typed values (not raw Bits)

### Type Annotations
- Function parameters: `f(x: Int, y: String) => body`
- Return types: `f(x: Int): String => body`
- Type expressions support generics: `f(arr: Array[Int]) => ...`
- Untyped functions via base grammar still work (`f(x) => x + 1`)
- Type checks at call site: `applyComposed` checks arg types against FunctionType param types before substitution. Handles unions, structural, generics with arg comparison. No type_check wrappers in function bodies.

### Type Hierarchy
- **Type** — base meta-type. Provides structural `instanceof`/`subtypeof`.
- **NamedType** — extends Type. Provides nominal `instanceof`/`subtypeof` via `__name` and `__extends` chain.
- All built-in types (Int, String, etc.) are NamedTypes with `__type = NamedType`.
- Type and NamedType are self-describing (bootstrap: Type has `__type = Type`).

### Nominal vs Structural Typing
- Named types use **nominal** checking by default: `f(x: Animal)` requires x to be Animal or extend it.
- **`~` operator** (structural wrap): `~Animal` uses structural checking — any type with Animal's fields matches.
- Four operations: nominal/structural × instanceof/subtypeof.
- `structuralWrap(type)` creates a wrapper that delegates to Type's structural methods instead of NamedType's nominal ones.
- Unnamed type expressions (inline `{ ... }`) are always structural.

## Parser (Hybrid: Pratt + Recursive Descent)

The parser is a hybrid design:
- **Lexer** (`src/lexer.ts`): tokenizer with maximal munch, keyword disambiguation, float vs int, source location tracking, indentation (offside rule) support. Token tables are dynamic via `LexerConfig` — extensions add new operators/keywords without modifying lexer code.
- **Pratt parser** (expression level): O(n) with data-driven precedence/associativity tables. Handles all operators, function calls, dot access, bracket access, array/object literals, if-then-else, lambdas.
- **Recursive descent** (statement level): file structure, statements, blocks, function declarations, import/export.
- **Earley parser** (`src/parser.ts`): retained as fallback for standalone grammars (JSON, custom DSLs). Grammar classes (`Grammar`, `Terminal`, `Phrase`, `Disjunction`, `Repetition`, `Optional`) and `parseGrammar` still exported.

### Keywords
Keywords (`if`, `then`, `else`, `when`, `is`, `of`, `import`, `export`, `true`, `false`, `none`, `error`, `instanceof`, `subtypeof`) are properly disambiguated from identifiers by the lexer. New keywords can be registered via `LexerConfig`.

### Grammar Extension
- **Earley extensions** (`GrammarBuilder`): still available for standalone grammars and grammar primitive tests
- **Hybrid extensions**: `HybridGrammarConfig` with prefix/infix parselet registrations and `LexerConfig` for new operators/keywords. Immutable layering via `extendLexerConfig`.

## Module System

- **Anonymous extensions**: named bindings injected by the execution context, layered between primitives and source
- **ModuleLoader**: loads `.alg` files as extensions with dependency resolution, caching, circular dependency detection
- **Import syntax**: `import name` — declarative, module values provided via extensions
- **Context layering**: primitives → extensions → base (REPL persistence) → source bindings
- **Export system**: `export("name", value)` primitive marks bindings for export. `buildModuleObject` wraps exported bindings as a typed Object. Planned: full typed module interfaces with encapsulation via type-directed dispatch.
- **Module objects**: imported modules are typed Objects — dot access dispatches through the module's type, exposing only exported fields.
- **Module encapsulation**: `type_dispatch` enforces encapsulation for typed values — only fields listed on the type are accessible. Types use `__getMember` for controlled field access; module types restrict to exported fields only.

## Partial Evaluation

Partial evaluation follows two rules:
1. **Rule 1**: If an expression results in an undefined value to be passed to a primitive, the partially evaluated expression is returned (with unbound symbols visible). If the args have type components, the result type is propagated to the residual expression.
2. **Rule 2**: If `eval_if` (or any lazy primitive) has an undefined condition, all branches are partially evaluated non-lazily, propagating type information through both paths.

After partial evaluation, an expression's type is its `"type"` MultiValue component — which may be fully resolved or itself a partially evaluated expression. No separate `typeOf` function is needed.

### Compile-Time Type Inference
- `precompileFunctions` pass in `evalSource` partially evaluates typed function bodies at definition time
- Typed params get placeholder MultiValues (unresolved primary + resolved type component)
- `type_check` proceeds when the type component is known, even if the primary is unresolved
- `applyPrimitive` propagates type components through residual Expressions
- Return type inferred from the partially evaluated body's type component
- `CompilationReport` returned from `evalSource`: inferred return types, type errors, unresolved bindings

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
- **`src/evaluator.ts`** — Recursive tree-walk evaluator, memoization, partial evaluation (Rule 1 + Rule 2 with type propagation through residuals), type-directed dispatch via `PRIM_TO_METHOD`, closure support, type variable unification at call sites, tail call optimization, `precompileFunction` for compile-time type inference
- **`src/primitives.ts`** — All primitives: bits ops, expression/context/multi-value ops, type system (type_dispatch, type_check, type_apply, typed_int/string/float/bool/array/object, typed_function, typed operators, logical ops, unification), grammar primitives, print (lazy for type preservation)
- **`src/types-std.ts`** — Eight core types as Context values with method bindings, generic type support (buildGenericType, memoized type constructors), type helpers (getType, getTypeName, withType), FunctionType, UntypedFunction, AnyType, makeArray, makeObject, createTypeSystem extension
- **`src/lexer.ts`** — Tokenizer with maximal munch, dynamic keyword/operator tables via `LexerConfig`, source location tracking, indentation (offside rule) support
- **`src/hybrid-parser.ts`** — Pratt + recursive descent parser. Data-driven precedence/parselets. Handles all Allegro Standard syntax. Exports `parseBase`, `parseStandard`, `HybridGrammarConfig`
- **`src/parser-helpers.ts`** — Shared value-construction helpers (makeInt, makeExpr, makeParam, buildFn, etc.) used by both hybrid parser and Earley fallback
- **`src/parser.ts`** — Earley parser (retained for standalone grammars). Exports Grammar classes, `parseGrammar`
- **`src/grammar-ext.ts`** — GrammarBuilder for Earley extensions, handle registry for grammar primitives. `parseExtended` for Earley fallback path
- **`src/runtime.ts`** — `evalSource` (hybrid parse → typeLiterals → resolveSymbols → markTailCalls → precompileFunctions → buildEvalCtx → evaluate), symbol resolution with lexical scoping, compile-time type inference via `precompileFunctions`, `CompilationReport`, UntypedFunction wrapping in standard mode
- **`src/modules.ts`** — ModuleLoader for .alg files with dependency resolution, caching, circular dependency detection. `buildModuleObject` for typed module exports with encapsulation
- **`src/index.ts`** — Entry point: file runner + REPL. Allegro Standard by default, `--base` flag for base mode. On-demand module loading from `lib/` directory
- **`src/test.ts`** — 322+ tests: core evaluator, extensions, modules, grammar, standalone grammars, type system, generics, function types, unification, partial evaluation, union types, structural types, binding annotations, pattern matching, destructuring, multivalue access, error propagation, none type, instanceof, subtypeof, constructors, fluent type API, guard clauses, nested patterns, file-based .alg tests

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
- `pattern-match.alg` — when/is/then pattern matching, multivalue access

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

// Pattern matching (when/is/then)
result = when x is 42 then "found" else "other"
result = when x
    is 1 then "one"
    is 2 then "two"
    is y then "other: " + y.toString()

// Type destructuring
when shape
    is Object(x, y) then x + y          // nominal: check type, extract fields
    is Object(x: a, y: b) then a + b    // with rename

// Structural destructuring
when point
    is {x, y} then x + y                // match any value with fields x, y
    is {x: a, y: b} then a + b          // with rename

// Nested destructuring (colon introduces sub-pattern)
when shape
    is {center: {x, y}, radius} then x + y + radius

// Guard clauses (and)
when x
    is n and n > 0 then "positive"
    is n and n < 0 then "negative"
    is _ then "zero"

// MultiValue component access (Y of x)
t = type of someValue        // access "type" component
e = error of someValue       // access "error" component (returns none if absent)

// Error values (propagate automatically through operations)
result = error "something went wrong"
result = error "bad" + 5     // error propagates — result is still an error

// Type operators
42 instanceof Int              // → true
"hello" instanceof String      // → true
NamedType subtypeof Type       // → true

// Type constructors (calls __construct)
Int(42)                        // wraps value with Int type
String("hello")                // wraps value with String type

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

// Export (module public interface)
export square = x => x * x
export pi = 3.14159

// String concatenation
"hello" + " " + "world" // → "hello world"

// String interpolation
name = "world"
"hello {name}"           // → "hello world"
"2 + 2 = {2 + 2}"       // → "2 + 2 = 4"
"\{escaped\}"            // → "{escaped}"

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

See `BACKLOG.md` for full roadmap. Key completed items:
- ✅ Symbol resolution / lexical scoping (compile-time, not runtime)
- ✅ eval_if Rule 2 (partial eval both branches)
- ✅ Tail call optimization (O(1) stack for tail-recursive functions)
- ✅ Parser reimplementation (hybrid Pratt + recursive descent)
- ✅ Keyword support (export, true/false properly disambiguated)
- ✅ Dynamic lexer config (extensions add operators/keywords)
- ✅ Pattern matching (when/is/then with resolve-first semantics, type/structural destructuring)
- ✅ MultiValue component access (Y of x syntax)
- ✅ Error propagation (error values as MultiValue components, automatic propagation)
- ✅ None type (singleton `none` keyword, returned for absent components)
- ✅ `instanceof` and `subtypeof` infix operators
- ✅ Type constructors via `__construct` (Int, Float, String, Bool)
- ✅ Fluent type API: `extend`, `where`, `distinct`, `constructor` methods on Type/NamedType
- ✅ Meta-type dispatch for type-level methods (e.g., `Int.where(...)`)
- ✅ Auto-naming: types bound to symbols get named automatically
- ✅ Guard clauses (`and` keyword in patterns)
- ✅ Nested destructuring (colon introduces sub-pattern, recursive matching)

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
