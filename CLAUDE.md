# Allegro — Project Summary & Instructions

## Build & Run

```bash
npx tsc --noEmit                    # type-check
npx tsx src/index.ts                # REPL (Allegro Standard — default)
npx tsx src/index.ts file.alg       # run a file (Allegro Standard)
npx tsx src/index.ts --base         # REPL (Allegretto)
npx tsx src/index.ts --base file.alg  # run a file (Allegretto)
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

Allegro is a **programmable language platform** — a minimal, flexible core ("Allegretto") that serves as a substrate for building higher-level languages and DSLs. The standard language ("Allegro Standard") is a curated stack of extensions providing familiar syntax, a type system, and common data types.

- **Allegretto** — the primitive language: 7 value kinds, expression DAGs, recursive evaluator
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

Types are Context values with `__name`, `__type`, `__members`, and other meta-bindings. A typed value is a MultiValue where the primary is the data and the `"type"` component is the type Context. **Types themselves are typed** — user-visible type bindings are MultiValues with their meta-type as the type component (e.g., `Int` is `MultiValue(IntType, {type: NominalType})`). This means `Int instanceof NominalType` returns true, and `type of Int` returns NominalType. Internally, type infrastructure uses the primary Context via `primaryOf()`.

### Ten Core Types
- **Int** — 64-bit signed integer. Arithmetic, comparison, toString, abs, toFloat.
- **Float** — IEEE 754 double. Arithmetic, comparison, toString, sqrt, pow, abs, floor, ceil, round, sin, cos, tan, log, log2, log10, exp.
- **String** — UTF-8 encoded Bits. Concat (+), length, slice, indexOf, trim, startsWith, endsWith, includes, split, replace (all by default, optional count), toUpperCase, toLowerCase, charAt, repeat, toCharCodes, toString.
- **Bool** — Int(0/1) with Bool type. Provided as `true`/`false` context bindings.
- **Array** — Generic type `Array[T]`. Context with numeric keys + `__length`. length, get, map, filter, reduce, concat, slice. Element type inferred from contents. map/filter/reduce are Allegro ComposedFunctions (recursive, built via AST construction); length/get/concat/slice are primitives.
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

### Member Descriptors (__members)
- Every type has a `__members` Context containing named member descriptors
- **Method descriptors**: `{__type: MethodType, name: String, value: PrimitiveFunction, getter?: 1}` — executable methods with optional getter flag
- **Field descriptors**: `{__type: FieldType, name: String, fieldType: Type}` — typed field declarations (on record types)
- `typeMethod(type, name)` reads from `__members` first, falls back to direct bindings — the single bridge function for all member access
- `typeMemberDescriptor(type, name)` returns the full descriptor for dispatch-level access
- Meta-types (Type, NominalType) store their methods (instanceof, subtypeof, extend, where, distinct, constructor) in `__members`
- Structural checking compares `__members` collections: every member in the expected type must exist in the actual type

### Type-Directed Dispatch
- `type_dispatch` checks the value's type component, looks up member descriptor from `__members`, returns a self-bound closure
- Getter descriptors are called immediately with self; method descriptors return bound functions
- Field descriptors look up the field value on the instance's primary Context
- The evaluator's `PRIM_TO_METHOD` mapping dispatches base operators (`bits_add` etc.) through `typeMethod()` when operands are typed
- Type methods return properly typed values — comparisons return Bool, arithmetic returns the operand type
- No implicit fallback — missing type method is an error
- Types can define `__getMember(self, fieldName)` as a fallback for fields not in `__members` (like Python's `__getattr__`). Object uses this for field access. Types without `__getMember` enforce strict encapsulation.
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
- **NominalType** — extends Type. Provides nominal `instanceof`/`subtypeof` via `__name` and `__extends` chain.
- All built-in types (Int, String, etc.) are NominalTypes with `__type = NominalType`.
- Type and NominalType are self-describing (bootstrap: Type has `__type = Type`).

### Interfaces
- Declared via `Type.interface({member: Type, ...})` — produces a structural type with `__type = Type`
- `__members` contains Field descriptors for declared members, plus inherited non-meta members from parent
- No `__construct`, `__getMember`, or auto-generated methods — interfaces declare structure only
- `__interface` marker binding distinguishes interfaces from record types
- Conformance via structural `instanceof`: `42 instanceof Printable` checks that Int has all members Printable declares
- Parent inheritance: `Int.interface({extra: Int})` requires all of Int's members plus `extra`
- Auto-named when bound to a symbol: `Printable = Type.interface(...)` → name is "Printable"

### Mixins
- Declared via `Type.mixin({method: fn, ...})` — adds Method descriptors to a type's `__members`
- Returns a new type with the mixin methods added; does not mutate the base type
- **Error on name conflict**: if a mixin method name already exists in the type's `__members`, throws an error
- Mixin methods receive `self` (the full typed MultiValue) as first argument — enables field access (`self.x`) and method calls (`self.otherMethod()`) via type dispatch
- Mixin methods are ComposedFunctions stored in Method descriptors; `type_dispatch_impl` handles self-binding for both PrimitiveFunction and ComposedFunction method descriptors
- Reusable: put the spec in a variable and pass it to multiple `.mixin()` calls

### Nominal vs Structural Typing
- Named types use **nominal** checking by default: `f(x: Animal)` requires x to be Animal or extend it.
- **`~` operator** (structural wrap): `~Animal` uses structural checking — any type with Animal's fields matches.
- **Interfaces** are inherently structural (`__type = Type`) — no `~` needed.
- Four operations: nominal/structural × instanceof/subtypeof.
- `structuralWrap(type)` creates a wrapper that delegates to Type's structural methods instead of NominalType's nominal ones.
- Unnamed type expressions (inline `{ ... }`) are always structural.

### Refinement Types
- Declared via `Type && <predicate>` where `_` in the predicate refers to the value being checked: `PositiveInt = Int && _ > 0`. Equivalent to `Int.where(_ => _ > 0)`.
- `&&` in expression position is overloaded: if the left operand is a type (has meta-type Type or NominalType), it creates a refined type via `buildRefinedType`. Otherwise it's logical AND. `typed_and_impl` dispatches at runtime.
- Compound predicates via repeated `&&`: `Int && _ > 0 && _ < 100` — the second `&&` is expression-level logical AND inside the predicate body. Parsed as `Int && (_ > 0 && _ < 100)`.
- Predicate is an Allegro lambda with parameter `_`. `buildRefinedType` stores it as `__predicate` on the refined type.
- **Construction check**: `__construct` wrapper evaluates the predicate on the constructed value. If false, returns an error value instead of the refined value.
- **Annotation/call-site check**: `type_check_impl` and `checkArgType` evaluate `__predicate` after the nominal/structural base check passes. Short-circuits when `actualType === expectedType` (value was already refined through the same type).
- **Partial evaluation integration**: predicates are Allegro expressions, so they partially evaluate naturally with known values. Unresolved predicates produce residual type checks.
- **`preserveOps`**: `(Int && _ > 0).preserveOps(add, sub)` or `.preserveOps()` (all numeric ops). Creates a new refined type where named operators are lifted: after the parent op runs, the result is fed through `__construct`, re-running the predicate check and tagging with the refined type. This makes `x + 3` where `x: PositiveInt` produce a `PositiveInt` instead of bare `Int`.

## Parser (Hybrid: Pratt + Recursive Descent)

The parser is a hybrid design:
- **Lexer** (`src/lexer.ts`): tokenizer with maximal munch, keyword disambiguation, float vs int, source location tracking, indentation (offside rule) support. Token tables are dynamic via `LexerConfig` — extensions add new operators/keywords without modifying lexer code. Indent tokens suppress Newline for expression continuation.
- **Pratt parser** (expression level): O(n) with data-driven precedence/associativity tables. Handles all operators, function calls, dot access, bracket access, array/object literals, if-then-else, lambdas. Expression continuation via `continuationDepth` — indented lines are treated as continuation within expressions.
- **Recursive descent** (statement level): file structure, statements, blocks, function declarations, import/export.
- **Earley parser** (`src/parser.ts`): retained as fallback for standalone grammars (JSON, custom DSLs). Grammar classes (`Grammar`, `Terminal`, `Phrase`, `Disjunction`, `Repetition`, `Optional`) and `parseGrammar` still exported.

### Keywords
Keywords (`if`, `then`, `else`, `when`, `is`, `of`, `import`, `export`, `true`, `false`, `none`, `error`, `instanceof`, `subtypeof`) are properly disambiguated from identifiers by the lexer. New keywords can be registered via `LexerConfig`.

### Grammar Extension
- **Earley extensions** (`GrammarBuilder`): still available for standalone grammars and grammar primitive tests
- **Hybrid extensions**: `HybridGrammarConfig` with prefix/infix parselet registrations and `LexerConfig` for new operators/keywords. Immutable layering via `extendLexerConfig`.
- **Parser combinators from Allegro** (Phase 1 DSL primitives): `grammar_new`, `grammar_terminal`, `grammar_phrase`, `grammar_choice`, `grammar_choice_add` (mutable append for recursion), `grammar_repeat`, `grammar_optional`, `grammar_set_target`, `grammar_parse`. Build grammars at runtime, parse strings, receive a tree of Allegro values — Terminal→String, Phrase→Array (positional), Disjunction→transparent (unwrapped), Repetition→Array (delimiters stripped), Optional→value or none. Parse errors become typed Error values. Example demo: `tests/grammar-regex.alg` implements a regex DSL end-to-end.
- **Grammar 2 formalism (new, Phase 1 in progress)** — scannerless formalism described in `docs/grammar-formalism.md`. Will replace Pratt + Earley in Phase 2. Rule union (Terminal/NonTerm/Seq/Alt/Rep/Opt/Guarded), named productions, symbolic precedence, stateful indent terminals, grammar-value extension via `Operation` deltas, user-defined `@error` productions with `@sync` panic recovery. Phase 1 status: types + engine + Allegro primitives (`grammar2_*`) + tests covering the §10.3 regex DSL. Not yet: analyzer, indent engine, left recursion via full GLL, migration of existing Allegro grammar.
- **Runtime grammar extension** (Phase 1): modules can register new host-language syntax via four primitives — `register_infix(op, bp, (l, r) => ast)`, `register_prefix(op, bp, x => ast)`, `register_postfix(op, bp, x => ast)`, `register_expr_prefix(kw, x => ast)`. Files opt in with a top-of-file `use_grammar NAME` header, which loads the named module and applies its `GrammarFragment` to parsing. The lambda supplied to each register is a ComposedFunction whose body is an AST template; at parse time `substituteParams` injects the operand ASTs without evaluating, producing a new AST node the evaluator processes normally. Lexer gets two new token kinds: `TokenType.UserOp` (matched by operator-char string) and `TokenType.UserKeyword` (matched by identifier string). Parser dispatches via `userPrefixParselets`/`userInfixParselets` keyed by token text. Extension type grows `grammarFragment?: GrammarFragment`. Demo: `lib/pow.alg` adds `**` and `neg`, used in `tests/grammar-runtime.alg`.

## Module System

- **Anonymous extensions**: named bindings injected by the execution context, layered between primitives and source
- **ModuleLoader**: loads `.alg` files as extensions with dependency resolution, caching, circular dependency detection
- **Import syntax**: `import name` — declarative, module values provided via extensions
- **Context layering**: primitives → extensions → base (REPL persistence) → source bindings
- **Export system**: `export("name", value)` primitive marks bindings for export. `buildModuleObject` wraps exported bindings as a typed Object. Planned: full typed module interfaces with encapsulation via type-directed dispatch.
- **Module objects**: imported modules are typed Objects — dot access dispatches through the module's type, exposing only exported fields.
- **Module encapsulation**: `type_dispatch` enforces encapsulation for typed values — only fields listed on the type are accessible. Types use `__getMember` for controlled field access; module types restrict to exported fields only.
- **System library**: `lib/` directory alongside `src/` provides standard library modules. Module resolution: local `lib/` first, then system `lib/` fallback. Modules are parsed with the standard parser and have full access to the type system (Float, Int, etc.).
- **Standard library modules**: `math` (sqrt, pow, sin, cos, etc. + constants PI, E), `functional` (compose, pipe, identity, etc.), `collections` (range, zip, flatten, reverse, sum, etc.)

## Partial Evaluation

Partial evaluation follows two rules:
1. **Rule 1**: If an expression results in an undefined value to be passed to a primitive, the partially evaluated expression is returned (with unbound symbols visible). If the args have type components, the result type is propagated to the residual expression.
2. **Rule 2**: If `eval_if` (or any lazy primitive) has an undefined condition, all branches are partially evaluated non-lazily, propagating type information through both paths.

After partial evaluation, an expression's type is its `"type"` MultiValue component — which may be fully resolved or itself a partially evaluated expression. No separate `typeOf` function is needed.

### Forward-Chaining Reactive Evaluation
- `DepCollector` tracks incomplete symbol references during evaluation
- `DependencyRegistry` maps incomplete bindings to their dependents
- `propagateCompletions` re-evaluates dependent residuals when bindings complete (cascading)
- `applyPhase` provides new bindings and triggers re-evaluation — used for imports, REPL, multi-phase builds
- Residuals are replaced (not mutated) on re-evaluation — no stale state
- Memoization disabled — forward-chaining replaces it for incomplete expressions

### Implicit Async via Futures
- `FutureManager` (`src/futures.ts`) bridges JavaScript Promises to forward-chaining
- Async primitives (e.g., `delay(ms)`, `fetch(url)`) create synthetic bindings (`__future_N`) with `value: undefined`
- The evaluator treats them as unresolved Symbols — produces residuals naturally
- When the Promise resolves, `applyPhase` provides the value and cascades re-evaluation
- `print` defers on unresolved args — returns a residual that fires when the value resolves
- No `await` keyword — async is implicit through forward-chaining
- Bare expressions with futures are tracked via synthetic `__bare_N` bindings
- **`fetch(url)`** — HTTP GET, returns a future that resolves to the response body (String). Errors become error values. Works in both Node (18+) and browsers via `globalThis.fetch`.
- **Web sandboxes** use `evalAllegroAsync` with streaming output — print output appears incrementally as futures resolve

### Compile-Time Type Inference
- `precompileFunctions` pass in `evalSource` partially evaluates typed function bodies at definition time
- Typed params get placeholder MultiValues (unresolved primary + resolved type component)
- `type_check` proceeds when the type component is known, even if the primary is unresolved
- `applyPrimitive` propagates type components through residual Expressions
- Return type inferred from the partially evaluated body's type component
- `CompilationReport` returned from `evalSource`: inferred return types, type errors, unresolved bindings

### Full-Program Type Inference
- The evaluation loop IS the compilation pass — types propagate through all bindings naturally
- `CompilationReport.bindingTypes` records the inferred type for every binding
- Untyped functions infer types at each call site — typed args flow in via substituteParams, type-directed dispatch produces typed results
- Polymorphic: same function at different call sites produces different types (each specializes independently)
- Recursive functions: return type inferred through execution (eval_if Rule 2 propagates common branch types)
- No separate type inference algorithm — partial evaluation IS type inference

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
- **`src/parser-helpers.ts`** — Shared value-construction helpers (makeInt, makeExpr, makeParam, buildFn, substName, etc.) used by the grammar2 tree builder and Earley fallback primitives
- **`src/parser.ts`** — Earley parser (retained for standalone user-defined grammars via `grammar_*` primitives, not for parsing Allegro source). Exports Grammar classes, `parseGrammar`
- **`src/grammar-ext.ts`** — GrammarBuilder for Earley extensions, handle registry for the `grammar_*` combinator primitives. `parseExtended` is the Earley entry point (standalone DSL grammars only)
- **`src/grammar2/`** — The grammar and parser for Allegro source per `docs/grammar-formalism.md`. Replaced the former Pratt+Earley hybrid in Phase 2c-7.
  - **`src/grammar2/types.ts`** — Rule union (Terminal/NonTerm/Seq/Alt/Rep/Opt/Guarded), RuleAttrs, Grammar, Production, GrammarDelta + Operation union, constructor helpers (`lit`, `cls`, `regex`, `seq`, `alt`, `rep`, `opt`, `nonterm`, `guarded`, `notFollowedBy`, `followedBy`, `reserved`), ParseTree output type.
  - **`src/grammar2/engine.ts`** — Recursive scannerless parser with memoization, Warth-style left recursion, stateful indent terminals (NEWLINE/INDENT/DEDENT/CONT_NL), farthest-advance error reporting. Exports `parse(grammar, input)` → `ParseResult`.
  - **`src/grammar2/builder.ts`** — Allegro primitive wrappers (`grammar2_*`) for building standalone grammars at runtime (separate from Allegro source parsing).
  - **`src/grammar2/base-grammar.ts`** — The Allegro grammar as a `Grammar` value. Stratified precedence via layered productions (pipe → or → and → eq → cmp → add → mul → of → unary → post → atom). Covers base + standard Allegro: typed literals, collections, string interpolation, typed params/returns, when/is/then pattern matching, refinement types, structural wrap, import/export, blocks-as-values, multi-line continuation via CONT_NL indent terminal.
  - **`src/grammar2/tree-builder.ts`** — Converts grammar2 ParseTrees into Allegro Value trees (Expression, ComposedFunction, Symbol, Param, Bits). Dispatches by tree-tag through builder cases.
  - **`src/grammar2/fragments.ts`** — Merges `GrammarFragment`s (from `use_grammar` / `register_infix` / `register_prefix` / `register_postfix` / `register_expr_prefix`) into extended grammar2 grammars. User-registered operators get unique tags whose associated substitution templates are looked up by the tree builder via `getUserOp(tag)`.
- **`src/runtime.ts`** — `evalSource` (hybrid parse → typeLiterals → resolveSymbols → markTailCalls → precompileFunctions → buildEvalCtx → evaluate), symbol resolution with lexical scoping, compile-time type inference via `precompileFunctions`, `CompilationReport`, UntypedFunction wrapping in standard mode
- **`src/modules.ts`** — ModuleLoader for .alg files with dependency resolution, caching, circular dependency detection. `buildModuleObject` for typed module exports with encapsulation
- **`src/futures.ts`** — FutureManager: bridges JavaScript Promises to forward-chaining evaluation. Creates synthetic `__future_N` bindings, attaches `.then()` handlers that call `applyPhase`
- **`src/index.ts`** — Entry point: file runner + REPL. Allegro Standard by default, `--base` flag for base mode. On-demand module loading from `lib/` directory
- **`src/test.ts`** — 400+ tests: core evaluator, extensions, modules, grammar, standalone grammars, type system, generics, function types, unification, partial evaluation, union types, structural types, binding annotations, pattern matching, destructuring, multivalue access, error propagation, none type, instanceof, subtypeof, constructors, fluent type API, guard clauses, nested patterns, member descriptors, interfaces, typed types, refinement types, preserveOps, file-based .alg tests

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
- `interfaces.alg` — Type.interface, structural conformance, parent inheritance
- `typed-types.alg` — types as typed values, Int instanceof NominalType, meta-type checks
- `refinements.alg` — refinement types via `&&`, compound predicates, preserveOps operator lifting
- `mixins.alg` — mixin methods, field access via self, reusable specs, multi-arg methods
- `grammar-runtime.alg` — `use_grammar pow` header plus `**`/`neg` from `lib/pow.alg`

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
NominalType subtypeof Type       // → true

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

// Interfaces (structural type matching)
Printable = Type.interface({toString: Function})
42 instanceof Printable           // true — Int has toString
Sized = Type.interface({length: Int})
"hello" instanceof Sized          // true — String has length

// Refinement types (Int && predicate, _ is the value)
PositiveInt = Int && _ > 0
PositiveInt(5)                    // → 5
PositiveInt(0 - 1)                // → error(refinement check failed)

// Compound predicates
SmallPos = Int && _ > 0 && _ < 100
SmallPos(50)                      // → 50
SmallPos(150)                     // → error

// Refinement in function annotation
double(x: PositiveInt): Int => x * 2
double(5)                         // → 10 (bare Int passes predicate check)

// preserveOps — lift operators to preserve the refinement
PI = (Int && _ > 0).preserveOps()
x = PI(5)
y = x + 3                         // y: PositiveInt, re-checked after +
y instanceof PI                   // → true
x - 10                            // → error (predicate fails after subtraction)
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
- ✅ Fluent type API: `extend`, `where`, `distinct`, `constructor` methods on Type/NominalType
- ✅ Meta-type dispatch for type-level methods (e.g., `Int.where(...)`)
- ✅ Auto-naming: types bound to symbols get named automatically
- ✅ Guard clauses (`and` keyword in patterns)
- ✅ Nested destructuring (colon introduces sub-pattern, recursive matching)
- ✅ Member descriptors (`__members`): unified Method/Field types, structural checking via member comparison, meta-type methods in `__members`
- ✅ Interfaces: `Type.interface({...})` — structural type matching, no `implements` keyword needed
- ✅ Types as typed values: `Int instanceof NominalType`, `type of Int` → NominalType, all type bindings wrapped as MultiValues
- ✅ Array map/filter/reduce as Allegro ComposedFunctions (recursive AST construction, not imperative TypeScript loops)
- ✅ Refinement types: `Type && _ > 0` syntax, predicate checking at construction/annotation/call sites, `preserveOps` operator lifting for refinement preservation through operators
- ✅ Mixins: `.mixin({method: fn, ...})` adds method implementations to types, ComposedFunction method dispatch with self binding
- ✅ Runtime grammar extension Phase 1: module-scoped `register_infix`/`register_prefix`/`register_postfix`/`register_expr_prefix` primitives; `use_grammar NAME` top-of-file header activates a module's `GrammarFragment` before parsing

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
