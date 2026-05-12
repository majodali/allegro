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

Types are Context values with `__name`, `__type`, `__members`, and other meta-bindings. A typed value is a MultiValue where the primary is the data and the `"type"` component is the type Context. **Types themselves are typed** — user-visible type bindings are MultiValues with their meta-type as the type component (e.g., `Int` is `MultiValue(IntType, {type: Type})`). `Int instanceof Type` returns true, and `type of Int` returns Type. `NominalType` is preserved as a back-compat alias of `Type` (`NominalType === Type`), so `Int instanceof NominalType` and `NominalType.extend(...)` continue to work. Internally, type infrastructure uses the primary Context via `primaryOf()`.

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
- The Type meta-type stores its methods (instanceof, subtypeof, extend, where, distinct, constructor, interface, preserveOps, mixin, invariant) in `__members`. `instanceof` and `subtypeof` are shape-aware; the rest are pure builders.
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
- **Type** — the single meta-type. All types have `__type = Type`. Type self-types (`Type.__type = Type`).
- `instanceof`/`subtypeof` on Type are **shape-aware**: nominal when both operands carry a `__name` (compares names + walks `__extends` chain), structural when the expected type is anonymous (`~T`, inline `{x: Int}`) or carries the `__interface` marker (compares `__members`).
- **`NominalType`** is retained as a back-compat alias (`NominalType === Type`); existing code reading `Int instanceof NominalType` keeps working. The named-vs-anonymous distinction is now a property of the type value, not of its meta-type.
- Multiple inheritance is deferred — see `memory/design_type_system_meta_types.md` for the explicit-conflict design and trigger conditions.

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
- **Interfaces** are inherently structural via the `__interface` marker on the type, even when named.
- Dispatch happens inside Type's shape-aware `instanceof`/`subtypeof`: if the expected type carries `__interface` or has no `__name`, structural; if both operands are named concrete types, nominal.
- `structuralWrap(type)` clones the type and erases its `__name`. Absence of `__name` is what triggers structural dispatch; `__wraps` keeps a back-link to the original named type.
- Unnamed type expressions (inline `{ ... }`) are always structural.

### Refinement Types
- Declared via `Type & <predicate>` where `_` in the predicate refers to the value being checked: `PositiveInt = Int & _ > 0`. Equivalent to `Int.where(_ => _ > 0)`. (`&` is the type/effect conjunction operator, distinct from `&&` which is purely logical AND since Slice 2 Stage 0.)
- `&&` in expression position is overloaded: if the left operand is a type (has meta-type Type), it creates a refined type via `buildRefinedType`. Otherwise it's logical AND. `typed_and_impl` dispatches at runtime.
- Compound predicates: `Int & _ > 0 && _ < 100` parses as `Int & ((_ > 0) && (_ < 100))` because `&` is at a looser precedence than `&&`. The whole `_ > 0 && _ < 100` becomes a single predicate body; `domainFromPredicate` recognises the conjunction as a single interval (`[1, 99]`) for compile-time reasoning.
- Predicate is an Allegro lambda with parameter `_`. `buildRefinedType` stores it as `__predicate` on the refined type.
- **Construction check**: `__construct` wrapper evaluates the predicate on the constructed value. If false, returns an error value instead of the refined value.
- **Annotation/call-site check**: `type_check_impl` and `checkArgType` evaluate `__predicate` after the nominal/structural base check passes. Short-circuits when `actualType === expectedType` (value was already refined through the same type).
- **Partial evaluation integration**: predicates are Allegro expressions, so they partially evaluate naturally with known values. Unresolved predicates produce residual type checks.
- **`preserveOps`**: `(Int & _ > 0).preserveOps(add, sub)` or `.preserveOps()` (all numeric ops). Creates a new refined type where named operators are lifted: after the parent op runs, the result is fed through `__construct`, re-running the predicate check and tagging with the refined type. This makes `x + 3` where `x: PositiveInt` produce a `PositiveInt` instead of bare `Int`.

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
- **Runtime grammar extension** (Phase 6 + 6b): modules declare syntax additions in a `grammar { … }` block:
  - **Operators** (Phase 6): `infix S prec(X) left/right/none => (l,r) => ast`, `prefix S at(X) => …`, `postfix S at(X) => …`, `expr_prefix KW => …`. Precedence clauses accept named levels (`prec(pow)`), positional constraints (`above(mul) below(unary)`, single or combined), and operator-symbol lookup (`at("*")`). Anonymous levels get gensym'd names. Level insertion in `src/grammar2/fragments.ts` splices new productions into the stratified stack via surgery on the base grammar (LEVELS array in `base-grammar.ts`).
  - **User rules + multi-token forms** (Phase 6b): `rule NAME = ebnf_body => template` adds/replaces a production; `rule NAME += …` appends an alternative. `expr_form parts => template` adds a new multi-token expression alternative (e.g. `match x with p => e | …`); `stmt_form parts => template` adds a new statement alternative. EBNF inside rule bodies supports `"lit"`, `/regex/`, ident refs, `s:rule` labels, `a*`/`a+`/`a?` postfix, `a ** sep` sep-rep, `(a | b)` grouping. Labels bind positionally to the template's params; `substituteParams` injects matched sub-ASTs at parse time. Whitespace between seq items and around rep separators is auto-interleaved.
  - **Activation**: top-of-file `use NAME` / `use import NAME` header. The pre-scanner loads the named module and harvests any `grammar { … }` Grammar values from its bindings.
  - **Validation**: cross-fragment validator runs before merging and reports `E_OPERATOR_CONFLICT` / `E_KEYWORD_CONFLICT` / `E_PRECEDENCE_CYCLE` at `use` time with aggregated messages.
  - Phase 1 `register_infix` / `register_prefix` / `register_postfix` / `register_expr_prefix` primitives retain as a lower-level back-compat path.
  - Demos: `lib/pow.alg` (adds `**` and `neg`, consumed by `tests/grammar-runtime.alg`), `lib/match_expr.alg` (adds `match x with p1 => e1 | … | pn => en`, consumed by `tests/match-demo.alg`).

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
  - **`src/grammar2/analyzer.ts`** — Static grammar analyzer (Phase 3 per `docs/grammar-formalism.md` §7). Checks: reachability, defined-ness, nullability, FIRST sets, left recursion classification, infinite-Rep detection, reserved-set consistency. Alt-disjointness analysis machinery is in place but not enabled by default — our stratified grammar intentionally uses ordered-alt semantics in several places that would false-positive; opt-in via `analyzeWithDisjointnessCheck`. The analyzer runs once per unique Grammar identity (cached by WeakMap) and its `assertClean` hook is called from `evalSource` before parsing, so grammar extensions that break structural invariants (undefined nonterm, undefined reserved set, etc.) fail with clear diagnostics rather than opaque parse errors.
  - **`src/grammar2/to-allegro.ts`** — TS Grammar → Allegro Value bridge used by Phase 5's Allegro-native analyzer. Produces nested typed Objects mirroring the TS Rule/Production/Grammar shapes, so Allegro code can walk them with when/is/then pattern matching.
- **`lib/grammar-analyzer.alg`** — Phase 5: Allegro-native port of the static grammar analyzer (~320 LOC). Exports `check_defined`, `check_reachable`, `compute_nullability` (fixed-point), `check_infinite_rep`, `check_reservations`, `check_left_recursion`, and a top-level `analyze(grammar) → {errors, warnings, nullable, leftRec}`. Consumes the TS-built Grammar converted via `to-allegro.ts`, returns arrays and records matching the TS analyzer's output one-for-one (verified by 11 parity tests in `src/test.ts`). FIRST-set computation is the only check not ported — it depends on finer-grained character-class analysis and is deferred. Parse+eval is ~3.7s on the current interpreter (down from ~40s before the memo-bucketing fix); amortized via module-level caching at test harness load.
- **`src/runtime.ts`** — `evalSource` (hybrid parse → typeLiterals → resolveSymbols → markTailCalls → precompileFunctions → buildEvalCtx → evaluate), symbol resolution with lexical scoping, compile-time type inference via `precompileFunctions`, `CompilationReport`, UntypedFunction wrapping in standard mode
- **`src/modules.ts`** — ModuleLoader for .alg files with dependency resolution, caching, circular dependency detection. `buildModuleObject` for typed module exports with encapsulation
- **`src/futures.ts`** — FutureManager: bridges JavaScript Promises to forward-chaining evaluation. Creates synthetic `__future_N` bindings, attaches `.then()` handlers that call `applyPhase`
- **`src/index.ts`** — Entry point: file runner + REPL. Allegro Standard by default, `--base` flag for base mode. On-demand module loading from `lib/` directory
- **`src/test.ts`** — 600+ tests: core evaluator, extensions, modules, grammar, standalone grammars, type system, generics, function types, unification, partial evaluation, union types, structural types, binding annotations, pattern matching, destructuring, multivalue access, error propagation, none type, instanceof, subtypeof, constructors, fluent type API, guard clauses, nested patterns, member descriptors, interfaces, typed types, refinement types, preserveOps, file-based .alg tests

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
- `refinements.alg` — refinement types via `&`, compound predicates, preserveOps operator lifting
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

// Refinement types (Int & predicate, _ is the value)
PositiveInt = Int & _ > 0
PositiveInt(5)                    // → 5
PositiveInt(0 - 1)                // → error(refinement check failed)

// Compound predicates
SmallPos = Int & _ > 0 && _ < 100
SmallPos(50)                      // → 50
SmallPos(150)                     // → error

// Refinement in function annotation
double(x: PositiveInt): Int => x * 2
double(5)                         // → 10 (bare Int passes predicate check)

// preserveOps — lift operators to preserve the refinement
PI = (Int & _ > 0).preserveOps()
x = PI(5)
y = x + 3                         // y: PositiveInt, re-checked after +
y instanceof PI                   // → true
x - 10                            // → error (predicate fails after subtraction)

// Grammar extension — add new operators from a module (Phase 6)
// lib/pow.alg:
pow_grammar = grammar {
  infix "**" prec(pow) above(mul) below(unary) right => (l, r) => pow_int(l, r)
  expr_prefix "neg" => x => 0 - x
}

// Consumer file activates the grammar via `use`:
use pow
print(2 ** 10)        // → 1024
print(2 * 3 ** 2)     // → 18 (** binds tighter than *)
print(neg (2 ** 3))   // → -8

// Multi-token forms (Phase 6b)
// lib/match_expr.alg:
match_grammar = grammar {
  rule match_case = p:expr "=>" e:expr       => (p, e) => {p: p, e: e}
  rule match_list = c:match_case ** "|"      => c => c

  expr_form "match" s:expr "with" cs:match_list
    => (s, cs) => match_dispatch(s, cs)
}

// Consumer:
use match_expr
describe(n) =>
  match n with
    1 => "one"
  | 2 => "two"
  | 3 => "three"
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
- ✅ Refinement types: `Type & _ > 0` syntax, predicate checking at construction/annotation/call sites, `preserveOps` operator lifting for refinement preservation through operators (`&&` was the original operator; migrated to `&` in Slice 2 Stage 0 to free `&&` for purely logical AND)
- ✅ Mixins: `.mixin({method: fn, ...})` adds method implementations to types, ComposedFunction method dispatch with self binding
- ✅ Runtime grammar extension Phase 1: module-scoped `register_infix`/`register_prefix`/`register_postfix`/`register_expr_prefix` primitives; `use_grammar NAME` top-of-file header activated a module's `GrammarFragment` before parsing (superseded by Phase 6)
- ✅ Runtime grammar extension Phase 6: `grammar { infix/prefix/postfix/expr_prefix … }` block syntax with named precedence (`prec(pow)`, `at(X)`, `above(X)`, `below(Y)`, combined forms), operator-symbol lookup (`at("*")`), anonymous levels, and data-driven stratified-stack level insertion. `use X` pre-scanner (replaces `use_grammar`; accepts `use NAME` and `use import NAME`, extensible to full expressions later). Conflict detection: `E_OPERATOR_CONFLICT`, `E_KEYWORD_CONFLICT`, `E_PRECEDENCE_CYCLE` surface at `use` time with aggregated messages.
- ✅ Runtime grammar extension Phase 6b: EBNF mini-grammar for rule bodies (`"lit"`, `/regex/`, ident refs, `s:rule` labels, `a*`/`a+`/`a?` postfix, `a ** sep` sep-rep, `(a | b)` groups). Multi-token `expr_form parts => template` (e.g. `match x with p => e | …`) and `stmt_form parts => template` for statement-level forms. User sub-rules via `rule NAME = body => template` (new production) and `rule NAME += body => template` (append alternative). Template params are positional matching the order of EBNF labels; `substituteParams` injects the matched sub-ASTs at parse time. Demo: `lib/match_expr.alg` implements a `match … with …` expression in 3 lines.
- ✅ Runtime grammar extension Phase 7: `new grammar { … }` for fresh grammars (baseChain=[empty]) and `grammar extends X { … }` for composition; `use grammar { … }` hosting-file literal grammars (no separate module needed); `use NAME.MEMBER` selects one Grammar binding from a multi-grammar module. Analyzer gains `W_PRODUCTION_REPLACED` (silent shadowing of base productions) and `E_INCOMPATIBLE_GRAMMARS` (fragment base-chain mismatches) checks. Hygienic template substitution: free Symbols in grammar templates resolve against the module's evalCtx at definition time, so consumer rebindings can't hijack the extension. Selector-based rule surgery: `rule foo -= alt_name` removes a named alternative, `rule foo[alt_name] = body => template` replaces one. Deferred to Phase 8 (needs parser/evaluator reentry): per-scope activation (`use X in { block }`), single-pass `use X` with arbitrary mid-parse expressions, parse-time builder lambdas.
- ✅ Provability arc — Phase A (introspection surface): `src/introspect.ts` walks an evaluated Value tree and produces a `ValueSummary` (kind, typeName, resolved status, node count, depth, external symbols referenced, primitives called, short description) and a `ModuleSummary` with a `SafetyGrade` classification (`proven-safe` | `partial` | `has-warnings` | `has-errors`). New CLI subcommand `allegro inspect <file>` emits the rendered summary. Web sandbox gets an Inspect button on every demo that shows the same summary with a coloured grade badge. This is Layer 0 of the "code is the wrong reviewable artifact" arc (see `.claude/plans/crystal-proving-curry.md`).
- ✅ Provability arc — Phase B (refinements as a proof substrate): `src/refinements.ts` adds an `AbstractDomain` representation (interval, equality, inequality, opaque) alongside the existing runtime predicate. `domainFromPredicate` recognises common shapes (`_ > k`, `_ >= k`, `_ < k`, `_ <= k`, `_ == k`, `_ != k`, conjunctions via `&&`) and lattice operations (`intersectDomains`, `joinDomains`, `impliesDomain`) reason at compile time. `propagateAdd` / `propagateSub` / `propagateMul` derive output domains for arithmetic on refined operands. The evaluator's `applyPrimitive` propagates a domain onto results when at least one operand carries one — pure-literal arithmetic stays uninstrumented so untyped Allegretto and unrefined Standard code see no behaviour change. Subtyping check: `type_check_impl` and `checkRefinementPredicate` now try abstract-domain implication BEFORE the runtime predicate, so a value with domain `≥ 4` passed to a function expecting `_ > 0` discharges the refinement statically. Counterexamples: a failing refinement check now reports both the violated constraint and the actual value (`refinement check failed: expected ≥ 1 (got -5)`). Pilot: `lib/math.alg` adds `PositiveInt`, `NonNeg`, and a `double_pos(x: PositiveInt): PositiveInt` whose return-type check is discharged purely by domain implication. Demos: `tests/refinement-propagation-demo.alg`, `tests/refinement-subtype-demo.alg`, `tests/math-pilot-demo.alg`.
- ✅ Provability arc — Phase C Chunks 1+2 (predicate sets + branch refinement + `assert`): `src/refinements.ts` `PredicateSet` carries a list of `Predicate` (shape + source attribution: `refinement-type` / `type-invariant` / `assert` / `branch-then` / `branch-else` / `match-case` / `requires` / `ensures` / `propagation` / `literal`) on each binding's MultiValue. `applyPrimitive` propagates predicate sets through arithmetic. `eval_if` derives branch predicates via `deriveBranchPredicates` (recognises `x op k` / `k op x` / conjunctions; both `bits_*` and `typed_*` comparison shapes), pushes them onto a scope-local `scopePredicates: Map<string, PredicateSet>` carried on `ContextValue`, and pops on branch exit. `assert P` is a stmt_form (in `lib/invariants.alg`) lowering to `assert_stmt(P)`: tries static discharge from accumulated predicates; on success or runtime-pass updates the scope-local predicates so the rest of the scope inherits the proven facts; on failure throws `AllegroError` with a counterexample message (build safety in — no silent error values). The introspection summary renders single predicates compactly and multi-predicate sets with per-source attribution.
- ✅ Provability arc — Phase C Chunk 4 (`Type.invariant`): `src/types-std.ts` adds `Type.invariant(self => P)` (and `NominalType.invariant`) that returns a new type with `__invariantsList: Value[]` and a wrapped `__construct` checking each invariant on creation. Multi-clause chaining (`Int.invariant(self > 0).invariant(self < 100)`) reports per-clause failures (`invariant 1 failed`, `invariant 2 failed`). Multi-field record invariants reference fields via `self.field` (`Range = Type.extend({lo, hi}).invariant(self => self.lo <= self.hi)`). `extend` carries `__invariantsList` forward so derived types inherit. Pilot: `lib/math.alg` `Range`. Introspection: types with invariants render `[N invariants]`; `safetyGradeForSummary` flags Error-typed bindings as `has-errors`. Demos: `tests/invariant-demo.alg`, `tests/predicate-set-demo.alg`.
- ✅ Provability arc — Phase D1 (effect types): function bodies declare the categories of side effects they can produce via an `effects` body-form clause; the analyzer infers the actual set from the primitives transitively called and verifies the declaration is a superset (under-promising halts compilation).
  ```
  use effects
  square(x) =>
    effects pure
    x * x
  greet(name) =>
    effects io
    print("Hello, " + name)
  ```
  Effect labels are EXTENSIBLE, not a fixed enum. `src/types.ts` `PrimitiveFunctionValue` gains an optional `effects: string[]`; `makePrimitive(name, fn, lazy?, effects?)` accepts the labels. Core declares no labels; the standard library tags `print` with `io`, `fetch` with `net`, `delay` with `time`. Domain-specific extensions register their own labels (`build-io`, `funds-mutation`) by attaching them to their primitives. `src/effects.ts` provides `EffectSet` (plain `Set<string>`), set ops (`effectUnion`, `effectSubset`, `effectDifference`), bottom-up inference (`inferFunctionEffects` walks ComposedFunction bodies, recurses into transitively called functions with cycle detection), and the `effects_attach` wrapper unwrap helpers. Surface syntax via `lib/effects.alg` grammar (stmt_form `effects` parsing comma-separated identifiers); the block-expression preprocessor recognises `effects_decl_marker(labels)` markers, extracts them, and wraps the body's result with `effects_attach(result, labels)` (a runtime passthrough that's metadata for the analyzer). `evalSource` runs `checkEffectsDeclarations` after `precompileFunctions`; mismatches throw an `Error` listing every binding's declared/inferred/missing sets. Introspection: `ValueSummary.inferredEffects` and `.declaredEffects` populate for any function value; the renderer surfaces three formats — `effects: pure (inferred)`, `effects: io (declared, verified)`, `effects: io (declared) ⊇ pure (inferred) ✓`. Pilot: `lib/math.alg` adds `effects pure` to `sqrt`, `pow`, `abs`, `double_pos`. Demo: `tests/effects-demo.alg`. Phase D2 will refine flat labels into parametric capabilities (`net[example.com:443]`) and per-module capability budgets — D1 is the substrate.
- ✅ Provability arc — Phase D1 sub-chunk 1.1 (Effect meta-type substrate): `src/types-std.ts` adds the `Effect` meta-type (`__type = Type`, lattice members in `__members`) and the two core absolutes — `pureEffect` (lattice bottom, kind `"pure"`) and `opaqueEffect` (lattice top, kind `"opaque"`) — built via `buildEffect(name, kind?)` which sets `__extends = Effect` and copies the lattice methods into the new type's `__members`. TS lattice helpers `effectSubsetOf`, `effectImplies`, `effectIntersect`, `effectUnion` operate on Context values; subset/implies walk the `__extends` chain by identity; intersect/union return `pureEffect` (no overlap) or `opaqueEffect` (sound over-approximation pending Slice 2's anonymous conjunctions). Standard extension binds `Effect`, `pure`, `opaque` so Allegro source sees them as values. `pure subtypeof Effect` and `opaque subtypeof Effect` discharge through the existing nominal subtype check via `__extends`; sibling subtypes (`pure subtypeof opaque`) correctly return false. Anonymous conjunction creation (`io & time`) and `&` operator surface deferred to Slice 2.
- ✅ Provability arc — Phase D1 sub-chunk 1.2 (effects in PredicateSet): `src/refinements.ts` `AbstractDomain` gains an `EffectsDomain` variant (`{ kind: "effects", labels: Set<string> }`) carrying the chunk-1 flat-label representation. Lattice ops generalised: `intersectDomains` does set intersection on effect-effect, opaque on mixed-kind; `joinDomains` does set union; `impliesDomain` returns `b.labels ⊆ a.labels` (wider implies narrower) for effect-effect, false on mixed-kind. `PredicateSet` gains `effectiveEffects()` (unions all effects-source predicates) alongside the existing `effectiveDomain()` (which now skips effects predicates). `PredicateSource` adds `"effects-declared"` and `"effects-inferred"`. `src/effects.ts` adds `effectPredicatesForFunction(fn): PredicateSet` and `effectPredicatesForValue(v)` — derive a uniform predicate-set view from the chunk-1 storage (`effects_attach` body wrap + `inferFunctionEffects` walker), one predicate per source. Underlying chunk-1 storage unchanged; this layer is on-demand derivation. Storage migration (replacing `effects_attach` with direct predicate attachment on the function MultiValue) deferred to Slice 2 where it interacts with HOF param-effect bounds. All chunk-1 tests pass under their existing API; 13 new tests verify the EffectsDomain machinery and helper extraction.
- ✅ Tail-call forwarding through typed-return wrappers (`type_check` / `ensures_check`): pre-existing latent bug. When a typed function has a tail-position recursive call (e.g. `countdown(n: Int): Int => if n == 0 then 0 else countdown(n - 1)`), the body's shape is `type_check(eval_if(…), Int)`. The inner recursive call is marked `_tailPosition` (markTailCallsInValue eagerly marks every ComposedFunction body's top expression — including eval_if's 0-param thunks). At runtime the TailCall sentinel propagates up through eval_if's return into `type_check_impl`'s `evalFn(args[0])` call, but type_check tried to read `.kind` on the sentinel and produced an unresolved residual instead of looping back to applyComposed's tco_loop. Fix: `isTailCall` is now exported from `src/evaluator.ts`; `type_check_impl` and `ensures_check_impl` detect TailCalls and forward them unchanged. Soundness preserved — the intermediate type / ensures check is skipped on TailCalls but the eventual base-case value still passes through the same wrapper (the return type is fixed; intermediate recursive results are already typed). Performance preserved — TCO works through typed returns, verified with 100k-deep recursion. The transparent passthroughs (`effects_attach` / `partial_attach` / `decreases_attach` / `param_effects_attach` / `seq`) were already correct since they `return evalFn(args[0], ctx)` directly. 2 new regression tests; 828/828 green.
- ✅ Provability arc — Phase E Stage 3 (`decreases <metric>` body-form): new `stmt_form` in `lib/totality.alg` lowers `decreases <expr>` to `decreases_decl_marker(expr)`; the block preprocessor extracts the marker and wraps the function body with `decreases_attach(body, metric)`. `unwrapDecreasesAttach` peels via a shared `findAttachWrapper` helper that handles any combination of `type_check` / `partial_attach` / `decreases_attach` / `effects_attach` / `param_effects_attach` decorators on the head — `unwrapPartialAttach` now uses the same helper so `partial` + `decreases` (or any combination) coexist without order dependence. Analyzer semantics: `decreases` is a user commitment. Stage 3 verifies recognised shapes — (1) bare `Param`: positional decrease via `recognizeParamMinusK`, NO type-bound check (the explicit clause IS the commitment, looser than Stage 2's policy which requires `: NonNeg`); (2) `typed_array(p1, p2, …)` (i.e. array-literal `decreases [a, b]`): lexicographic decrease via `findLexDecreasePosition` — earlier components must pass through unchanged, then some component strictly decreases. Anything else: silent (trust the user). When `decreases` is present, Stage 2's auto-detection is skipped entirely. `partial` opt-out overrides everything. Stage 3 minimum doesn't yet handle `arr.length`, `expr.field`, or general expression metrics — those are recognised as unverified user commitments. 9 new unit tests + demo (`tests/totality-decreases-demo.alg`); 826/826 green.
- ✅ Provability arc — Phase E Stage 2 (structural termination check): `checkTermination` in `src/totality.ts` walks every function binding's body, collects `Expression(Symbol(fnName), …)` recursive calls, and tries to find a position `i` whose arg is `bits_sub(Param(pos=i), Bits k)` with `k > 0` where the param's type's `__abstractDomain` has `lo >= 0` (interval) or `value >= 0` (equal). When found, the call is provably decreasing on a well-founded order. Confidence policy: emit `totality-nontermination` (severity `info` default) only when (a) recursion exists AND no parameter decreases, OR (b) decrease detected but the param's static type is unbounded below — message names the param and suggests `NonNeg` / similar. Silent on non-recursive functions and on untyped recursion (existing Allegro code stays clean). Symbol-typed annotations (`n: NonNeg` where `NonNeg = Int & _ >= 0` is a top-level binding) resolve via a `totalityCompileCtx` mirroring `precompileFunctions`' setup (primitives + extensions + source bindings), so user-defined refinement types evaluate on demand and yield Contexts carrying `__abstractDomain`. `lib/totality.alg`'s `partial` opt-out skips the termination check too. Stage 2 minimum recognises the `param - K` arithmetic pattern only; Stage 3 adds user-supplied `decreases` metrics for non-structural recursion, Stage 4 handles mutual recursion via call-graph analysis with lexicographic measures, Stage 5 propagates totality through stdlib HOFs. 7 new unit tests + demo (`tests/totality-termination-demo.alg`); 817/817 green.
- ✅ Provability arc — Phase E Stage 0+1 (totality substrate + exhaustiveness for `when/is/then`): `partial` body-form (via `lib/totality.alg`) opts a function out of the totality analyzer; lowers to a `partial_attach(body)` wrapper that `isFunctionPartial` / `unwrapPartialAttach` in `src/totality.ts` peel. Three notification kinds reserved (`totality-exhaustiveness`, `totality-nontermination`, `totality-needs-annotation`), all default to `info` so adoption is non-breaking. Stage 1: `checkExhaustiveness` walks every function binding's `eval_when` chains; for each chain without an explicit `else` or wildcard / bind-to-name catch-all, resolves the subject's static type (Param via the typed_function signature's paramType ASTs + Symbol lookup against extensions) and emits a notification when the type is finite-domain Bool with missing literals (e.g. `is true` without `is false`), or uncountable (Int/Float/String) with no fallback. Confidence policy: stay silent when the subject type can't be determined — false positives erode trust. Prerequisite fix: `eval_when` now returns a residual when its subject is unresolved (Rule 2 analogue) — previously fell through to `when_no_match` which threw, producing spurious precompile errors that masked the totality issue. 9 new unit tests + 2 demos (`tests/totality-partial-demo.alg`, `tests/totality-exhaustiveness-demo.alg`); 809/809 green. Stages 2-6 pending: structural termination, `decreases` body-form, mutual recursion, higher-order propagation, counterexample rendering.
- ✅ Provability arc — Phase D1 Slice 2 F1-F3 cleanup (walker removal + notification migration + universalize precompile): the walker is now deleted — `inferFunctionEffects`, `walkValueEffects`, `effectsOfFunctionArg`, `effectsOfWithFallback`, `effectPredicatesForFunction`, `effectPredicatesForValue` (~290 LOC) all removed from `src/effects.ts`. Effects flow purely through PE: `applyPrimitive` propagation (F1), Param-call residual effects reading `Param.effectBound` (F2), and compile-time deferral of effectful primitives (F3a) cover every shape the walker handled. To get there cleanly: (1) `precompileFunctions` driver now precompiles untyped top-level functions and bare ComposedFunction bindings too (passes empty paramTypes → bare-Param placeholders; effect inference works, return-type inference is weaker without typed args); (2) `effectsOf` reads `__inferredEffects` from ComposedFunction primaries as a fallback to the MultiValue component, so bare ComposedFunctions surface their stashed effects through the same canonical accessor; (3) `precompileFunction` consumes TailCalls in its own loop — untyped tail-recursive bodies like `forwarder(g, y) => apply(g, y)` previously returned an unconsumed TailCall sentinel and dropped the inferred effects. `CompilationReport` migration: `errors[]` collapsed into `notifications[]` where each entry carries a stable `kind` tag and `severity: "error" | "warning" | "info"`; helpers `notificationsBySeverity` / `reportErrors` / `reportHasErrors` filter by tier. Push sites tag with `effects-mismatch` / `return-type-mismatch` / `precompile-eval` / `precompile-type-error` (error) and `effects-opaque-from-stdlib-hof` (info). Per-project severity remap by `kind` is the next step; substrate is ready. `Param.predicates` slot stays reserved for future refinement bounds (F2 moved effect bounds to `Param.effectBound`). Stage C3's auto-promotion test reframed: PE now resolves inline lambdas precisely on BOTH annotated and auto-promoted sides — the explicit `[e: Effect]` declaration still matters when the cb is a forwarded param (the case PE alone can't resolve). 9 files touched, 254 added / 420 removed; 793/793 green; demos pass.
- ✅ Provability arc — Phase D1 Slice 2 Stage F3b (stdlib HOF migration): with F1 PE-driven effects + F2 polymorphic Param-call propagation + F3a compile-time deferral all in place, the Slice-1.3 `opaque` placeholders on Array.map/filter/reduce + the walker's `type_dispatch(obj, "map" | "filter" | "reduce")` heuristic become unnecessary. Both removed. `arr.map(io_cb)` now propagates the cb's io effect to the caller's inferred set instead of conservatively marking opaque. Mechanism: `arr.map(cb)` evaluates the bound primitive (no effects tag now), which delegates to the Allegro-built `mapAllegro` whose body's `fn(arr[i])` is a Param-call. PE's F2c Param-call branch reads `Param.effectBound` (or, for unannotated Params, defaults to opaque) — but mapAllegro's `fn` Param has no annotation, so it'd be opaque without one more piece. The new piece (F3b): `typed_function_impl` precompiles inline typed lambdas on first evaluation via a precompile-on-evaluate hook, so the cb's body PE'd effects component populates and the `applyPrimitive` arg-effects loop sees `{io}`. A `_precompileInProgress` WeakSet guards against infinite recursion on self-referential bodies (`factorial(n) => factorial(n-1)`). Pre-existing tests that explicitly verified the opaque-tag behavior (`Phase D1.3: function calling Array.map gets opaque in inferred set`, `Phase D1.3: opaque-from-stdlib-hof emits a notification`) updated to verify the new precise propagation. 6 new tests + end-to-end demo (`tests/hof-effect-propagation-demo.alg`); 793/793 green; basics.alg unchanged.
- ✅ Provability arc — Phase D1 Slice 2 Stage F3a (compile-time deferral of effectful primitives): when PE evaluates a primitive's args inside a function body being precompiled (`ctx.__compileMode = true`) and the primitive carries a non-empty `.effects` tag, `applyPrimitive` returns a residual `makeExpr(fn, evalArgs)` instead of executing the impl. The residual still carries the effects component so the inferred set surfaces upward via PE; the side effect fires when the function is invoked at runtime where ctx isn't compile-mode. Fixes a long-standing latent issue where `print("trace")` inside a function body fired during precompile (precompile evaluates the body for type/effect inference; lazy primitives like print bypassed any deferral check). `precompileFunction` sets/restores `__compileMode` on its ctx around the body evaluation; `applyComposed`'s `enrichedCtx` and `augmentScopePredicates` propagate the flag through ctx-creation points so deferral applies in transitively-called function bodies and inside if-branches during precompile. Both eager and lazy primitive paths in `applyPrimitive` honor the flag — the lazy path was the actual culprit since print/fetch/delay are all lazy. Pure primitives still fold eagerly (deferral keys off `.effects` length); only effectful ones defer. Top-level bare expressions execute as before (they're not under precompile, so no flag is set). Declaration check still works because effects propagate through the residual via the effects component. 6 new tests covering capture-stdout verification of compile-time non-firing, runtime fire-on-call, top-level immediate fire, pure-primitive folding, deferred-residual effects component, and declaration-check still firing under deferral.
- ✅ Provability arc — Phase D1 Slice 2 Stage F2 (consumer migration to effects component + Param.effectBound + PE polymorphic propagation): Param storage migrates from `predicates: PredicateSet` (carrying effect bounds as effects-bound predicates) to a dedicated `effectBound: EffectSet` slot — refinement bounds stay reserved on `predicates` for future use, effects describe computations and live separately. `typed_function_impl` now writes effect bounds (Stage A `f: pure`, Stage C2 `__effectvar:NAME` markers, Stage D `param_effects` peel-and-stamp) directly to `Param.effectBound`. The walker (`walkValueEffects`) and PE Param-call handling read from `effectBound` directly. `subst`/`remapParams` clones preserve `effectBound` across substitution. PE Param-call propagation: when `evaluateExpr` reaches a residual `Expression(fn=unresolvedParam, args)` (typical inside polymorphic function bodies after precompile placeholder substitution), the residual carries the param's `effectBound` labels via the effects component — without this, polymorphic forwarders like `apply[e](g: e, x): Int => g(x)` would lose their effect-variable markers and `caller(x): Int => apply(printer, x)` would not infer io. Unannotated function-typed Params default to `opaque` in this path, matching the walker's conservative semantics. `precompileFunction` now copies `effectBound` onto the placeholder Params it creates so the substituted body reads the right metadata. Consumer migration: `checkEffectsDeclarations` reads `cFn.__inferredEffects` (PE-stashed) before falling back to the walker; introspection (`summarizeValue`) does the same. `checkArgType` (Stage A bound) and `type_check_impl` read effects via `effectsOfWithFallback(arg)` — direct component first, walker fallback for legacy untyped functions. The Stage D Surface C call-site enforcement skips Stage C2 marker bounds (labels starting with `__effectvar:`) since those are placeholders the walker resolves at call sites, not concrete bounds. Walker stays alive as the legacy fallback path; F3 will add compile-time deferral and remove the parallel infrastructure.
- ✅ Provability arc — Phase D1 Slice 2 Stage F1 (effects-as-component substrate, PE-driven): effects move from a parallel walker pass into a first-class MultiValue component named `"effects"`, alongside `type` and `error`. `src/effects.ts` adds `EFFECTS_COMPONENT_KEY`, `withEffects(v, eff)`, `effectsOf(v): EffectSet | null`, and `unionEffectSets(...)`; storage mirrors `withPredicates` (Context with JS-side `__effectSet`). `applyPrimitive` in `src/evaluator.ts` propagates effects via PE: eager primitives union the primitive's static `.effects` tags + each evaluated arg's `effects` component + the result's own component (set when method dispatch attaches it directly); lazy primitives accumulate via a tracking `evalFn` wrapper so `seq`, `eval_if` (Rule 2 unions both branches naturally), `effects_attach`, `type_check` all flow without per-primitive bookkeeping. Function values get their inferred effect set stamped at precompile time: `precompileFunction` now returns `inferredEffects: EffectSet | null` and stashes the body-result's effects on `cFn.__inferredEffects`; `typed_function_impl` reads the stash and attaches the `effects` component to the returned MultiValue, so `effectsOf(fn)` returns the PE-derived set directly. The existing predicate-set / walker machinery stays alive in parallel during the F1→F2 migration; consumers (`checkEffectsDeclarations`, introspection) still use the walker today and migrate in the next slice. Pure-literal arithmetic stays uninstrumented (no effects component appears unless something fires). Architectural payoff: effects describe COMPUTATIONS (function values, deferred residuals) — refinements describe DATA — the component split makes the distinction structural, prevents the lattice cross-contamination from earlier inversions (1.2 / Stage A), and sets up compile-time deferral as a one-component-lookup decision in F3. Two design memos to consult before F2: (1) the orthogonality argument — types and effects share infrastructure today but have no productive reasoning interplay; (2) effects naturally live on function values, not on data values.
- ✅ Provability arc — Phase D1 Slice 2 Stage E (function-type-expression syntax): `(A) => B` is now parseable in any type-expression position. Lowers to `type_function(paramType1, …, paramTypeN, returnType)`, which evaluates to a concrete `Function[ParamTypes, ReturnType]` identical to what `makeFunctionType` produces in TypeScript. Multi-param `(A, B) => C`, zero-param `() => A`, and curried `(A) => (B) => C` (right-recursive on return type) all work. Composes with generics: `Array[(Int) => Int]` is an array of `Int → Int` functions. Grammar lives in `type_expr_atom` (tried before `type_generic` so the `(` opener is unambiguous); lambda parsing only fires in expression position so there's no clash. Tree-builder finds nested `type_function` branches via the existing `findTypeExpr` helper (extended to recognise the new tag) and lowers them via `buildTypeExpr`. New `type_function` primitive evaluates each arg, takes the last as the return type, and builds the FunctionType. Type compatibility falls out of the existing FunctionType machinery — type_check, unification, and call-site enforcement work unchanged. Limit: `instanceof (Int) => Int` doesn't work since `instanceof`'s right side parses as an expression, where `(Int) => Int` is read as a lambda; use `instanceof Function[…]` for that case once generic args resolve cleanly. Stage E does NOT yet improve Array.map/filter/reduce effect propagation (still tagged `opaque` per Slice 1.3); that's the follow-on slice that uses this syntax to express polymorphic stdlib HOF types.
- ✅ Provability arc — Phase D1 Slice 2 Stage D (Surface C `param_effects` body-form): the effect-bound declaration alternative to Surface A's param-type slot. Useful when the param has a non-trivial type and you don't want to fold the effect into the type expression. `lib/effects.alg` adds a stmt_form `param_effects n:ident ":" e:ident` (paired with the existing `effects` clause; multi-param via repeated declarations). Block-expr preprocessor (`src/grammar2/tree-builder.ts buildBlockExpr`) extracts `param_effects_decl_marker(paramRef, effSym)` calls and wraps the body's result with `param_effects_attach(body, paramRef1, effSym1, …)` (lazy passthrough at runtime, metadata for the analyzer). `typed_function_impl` peels one `type_check` layer (matching `unwrapEffectsAttach`'s peel from C3) then peels `param_effects_attach`, evaluates each effect Symbol against the call ctx so `pure`/`io`/etc. resolve via extensions, and stamps the matching Param's predicates from the Effect type's `__effectBound` — by-name match against `cFn.params[i]._name` survives `remapParams` clones since names are preserved. Call-site enforcement: `evaluator.applyComposed` checks Param.predicates as a fallback when the param-type slot lacks `__effectBound`, running the same `impliesDomain` discharge with attribution `(from param_effects)` in error messages so users can tell which surface produced the bound. Walker propagation works automatically — the existing Stage B `Expression(Param(p), …)` branch reads `p.predicates.effectiveEffects()` regardless of which surface stamped it. Surface A and C can coexist on the same param (both stamp; C runs last so it wins on identical declarations; conflict detection is future polish). Demo: `tests/effects-surface-c-demo.alg`.
- ✅ Provability arc — Phase D1 Slice 2 Stage C3 (multi-variable polymorphism + effect-conjunction at value level + declaration-check repair): multi-variable cases (`apply2[e1: Effect, e2: Effect](g1: e1, g2: e2, …)`) and idempotence (`twice[e: Effect](f: e, x): f(f(x))`) fall out of Stage C2's walker for free — per-marker positional resolution and Set-based dedup handle them without new code. Effect-conjunction at the value level: `typed_amp_impl` detects Effect-extending operands (via `__extends` chain identity check `isEffectExtending`), evaluates the right-side thunk, and dispatches to `effectUnion` (lattice join: `pure & pure = pure`, `io & opaque = opaque`, anonymous compounds coerce to `opaque` until anonymous-conjunction representation lands). Two declaration-check repairs surfaced while validating: (1) `asFunction` in `src/effects.ts` peels unevaluated `typed_function(ComposedFunction(…), …)` Expressions so `checkEffectsDeclarations` reaches typed function bodies pre-evaluation — previously the check silently skipped any function with a return-type annotation; (2) `unwrapEffectsAttach` peels one layer of `type_check(…, returnType)` (the wrapper `maybeTyped` adds for typed-return functions). `__effectvar:NAME` markers in the inferred set are normalised to bare names against the declared set so polymorphic `effects e` declarations verify at definition time without false-positive mismatch. Auto-promotion: an unannotated function-typed param produces `opaque` honestly (no silent zero) — the explicit `[e: Effect]` declaration is what enables precise propagation, validating the falsifiable hypothesis that explicit declaration is the contract surface, not the auto-promoted form.
- ✅ Provability arc — Phase D1 Slice 2 Stage C2 (effect-variable unification at call sites): when a paramType is a Symbol matching an Effect-kinded entry in the function's `__genericParams`, `typed_function_impl` stamps the Param's predicates with a variable marker (`{labels: ["__effectvar:NAME"]}`) and records `__effectVarParams: Map<string, number[]>` on the ComposedFunction. The walker (`walkValueEffects`) detects ComposedFunction calls whose callee carries `__effectVarParams`, and at each call site replaces variable-marker labels in the recursed inferred set with the actual effects of the corresponding arg via `effectsOfFunctionArg`. Cross-binding Symbol references (e.g. `forwarder` calling `apply`) resolve through an optional `EffectsLookup` callback (`(name) => evalCtx.bindings.get(name)?.value`) threaded through `inferFunctionEffects` / `walkValueEffects` / `effectsOfFunctionArg`. `effectsOfFunctionArg` also peers into `typed_function(fn, …)` call expressions so inline annotated lambdas (`(y: Int): Int => y * 2`) resolve precisely. Critical correctness fix: `typeLiterals`, `resolveSymbols`, `subst`, and `remapParams` now preserve `__genericParams` and `__effectVarParams` across ComposedFunction clones — without this, the metadata was being stripped during pre-evaluation passes and polymorphic resolution silently fell back to opaque. Result: `apply((y) => y * 2, 7)` infers pure; `apply((y) => print(y), 7)` infers `io`; forwarding an unbounded param infers opaque (conservative); forwarding a `f: pure` param infers pure precisely.
- ✅ Provability arc — Phase D1 Slice 2 Stage C1 (generic param list grammar): function declarations now accept an optional `[generic_decl]` between the function name and the parameter parens — `id[T](x: T): T => x`, `apply[e: Effect](g: e, x: Int): Int => g(x)`, `pair[T, U](x: T, y: U): T => x`. Each generic param is `id` (kind defaults to `Type`) or `id : type_expr` (explicit kind). Grammar (`base-grammar.ts`) adds `generic_param`, `generic_param_list`, `generic_decl` productions and threads `opt(generic_decl)` into `fn_decl` and `export_fn_decl`. Tree-builder (`tree-builder.ts`) collects the params via `collectGenericParams` and stamps the underlying `ComposedFunction` with a `__genericParams: { name, kind? }[]` array — survives `typed_function` envelope wrapping since the ComposedFunction identity persists. Behaviour change is minimal: existing auto-promotion (unannotated identifiers in type positions = type variables) continues to work as before; the explicit declaration is documentation today and the substrate Stage C2 consumes for effect-variable unification dispatch. The `f[T]` parsing ambiguity at expression position is moot — declaration position has the unambiguous `name [generic_decl] (` shape.
- ✅ Provability arc — Phase D1 Slice 2 Stage B (HOF inference walker): when the static walker encounters `Expression(Param(p), …)` (a function-typed parameter being called), it pulls `p.predicates.effectiveEffects()` and adds those labels to the inferred set. With no bound declared, the param is treated as `opaque` — honest about the unknown rather than silently zero-effect. `typed_function_impl` stamps `Param.predicates` from each paramType's `__effectBound` at definition time, so `f: pure` flows from annotation through to walker visibility. New `PredicateSource` value `"effects-bound"` distinguishes param annotations from `"effects-declared"` (function-body clause) and `"effects-inferred"` (computed). The 1.3 `type_dispatch(obj, "map" | …)` heuristic stays — it handles a different case (stdlib HOFs called on dynamic receivers) and gets cleaner only when stdlib HOFs land in `lib/collections.alg` with full polymorphic types (Stage E). Alias tracking (`g = f; arr.map(g)`) falls out of normal predicate propagation — no new code. Functions with `effects pure` declarations on unbounded param calls emit the existing `effects-opaque-from-stdlib-hof` notification; with `f: pure` bounds the inferred set is precise and no notification fires.
- ✅ Provability arc — Phase D1 Slice 2 Stage A (effect bounds via `type_check`): `f: pure` and binding annotations `x: pure = …` now discharge through the same `type_check_impl` / `checkArgType` path numeric refinements use — no parallel infrastructure. `buildEffect` attaches an `__effectBound: EffectsDomain` to each Effect-extending type at construction (`pure` → `{labels: ∅}`; `opaque` → no bound, universal pass; named effects → `{labels: {name}}`). The discharge pulls the arg's effect predicate set via `effectPredicatesForFunction` (the on-demand derivation from D1.2), takes its `effectiveEffects()`, and runs `impliesDomain(actual, bound)` — predicate-implication semantics: actual ⊆ bound. The 1.2 inversion in `impliesDomain` for effects (which had used capability semantics, opposite of numerics) is fixed; the user-facing `effectImplies` in `types-std.ts` keeps capability semantics as the value-side `Effect.implies` operator. `ParamValue` gains an optional `predicates: PredicateSet` field — initialised to undefined at `makeParam`, carried through `subst()`'s `remapParams` clone — so the HOF walker (Stage B) can read param-level effect bounds directly without a side-table on `ComposedFunctionValue`.
- ✅ Provability arc — Phase D1 Slice 2 Stage 0 (`&` for type/effect conjunction): added `&` as a distinct infix operator at a new precedence level (`amp`, between `or` and `and`) so refinements and effect conjunctions read on a separate axis from logical AND. `typed_amp_impl` handles the type-side cases (refinement creation now; type intersection and effect conjunction in later stages). `typed_and_impl` simplified to purely logical AND. All existing refinement uses (`Int && _ > 0`) migrated to `&` (`Int & _ > 0`) across `lib/math.alg`, `lib/contracts.alg` (comment), and the `tests/refinements.alg` / `tests/contracts-demo.alg` / `tests/refinement-propagation-demo.alg` / `tests/refinement-subtype-demo.alg` / `tests/predicate-set-demo.alg` / `tests/math-pilot-demo.alg` / `tests/invariant-demo.alg` files plus inline test-suite assertions. Compound predicates (`Int & _ > 0 && _ < 100`) now build a *single* refinement with a compound predicate body — `domainFromPredicate` recognises the conjunction as one interval `[1, 99]`, more precise than the previous chained-refinement form's per-clause domain.
- ✅ Provability arc — Phase D1 sub-chunk 1.3 (Notification category + opaque marking on stdlib HOFs): `CompilationReport` gains a `notifications: Notification[]` collection (`Notification = { kind, message, binding? }`) for informational diagnostics that don't halt compilation. `buildType` / `buildGenericType` accept `methodEffects: Record<string, string[]>`; `Array.map` / `Array.filter` / `Array.reduce` are tagged `effects: ["opaque"]` so callers' inferred sets reflect the soundness limit until Slice 2's effect polymorphism resolves precisely. Bound primitives produced by `type_dispatch` propagate the underlying primitive's effects (previously stripped). Static walker in `src/effects.ts` recognises `type_dispatch(obj, "map" | "filter" | "reduce")` patterns and adds `opaque` (necessary because the static walk can't follow runtime dot-dispatch through `type_dispatch`). `checkEffectsDeclarations` filters `opaque` out of mismatch computation so `effects pure` functions calling stdlib HOFs don't halt; `opaqueEffectNotices` emits a separate `effects-opaque-from-stdlib-hof` notification for visibility. Per-project notification severity (notification → error/warning/ignore) tracked separately on the backlog.
- ✅ Provability arc — Phase C Chunk 3 (`requires` / `ensures` body-form contracts): function bodies can declare contracts at the head:
  ```
  divide(a, b) =>
    requires b != 0
    ensures _ != 0 || a == 0
    a / b
  ```
  Surface syntax via `use contracts` activates `lib/contracts.alg` grammar (stmt_forms `requires`, `ensures` lowering to `requires_stmt(P)` / `ensures_decl(P)` markers). The block-expression tree-builder (`src/grammar2/tree-builder.ts buildBlockExpr`) preprocesses contract markers at parse time: `requires_stmt(P)` calls are hoisted to the front of the body so preconditions check before any body statement runs; `ensures_decl(P)` calls are extracted, their predicate is compiled via `buildFn(["_"], P)` into a one-param lambda, and the body's result expression is wrapped with `ensures_check(result, lambda)`. `seq` primitive sequences the requires checks, body statements, and ensures-wrapped result so side effects fire in source order. `requires_stmt` mirrors `assert_stmt` but tags discharged predicates with `source: "requires"` and reports failures as "precondition failed". `ensures_check` runs the lambda against the result; on success attaches the predicate domain to the result's set with `source: "ensures"` so callers see the post-condition; on failure throws `AllegroError("postcondition failed")`. Static discharge via predicate-set entailment short-circuits both runtime checks. Introspection: `ValueSummary` gains `requires` / `ensures` / `promotionSuggestions` arrays; the rendered summary lists each contract; in-body asserts that reference only function parameters get flagged as candidates for promotion to `requires`. Pilot: `lib/math.alg` adds `divide`. Demo: `tests/contracts-demo.alg`. Phases D–J build on this: effect types, totality, proofs, provable stdlib, AI collaboration protocol, codegen, review UX.

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
