# Allegro — Backlog

## 1. Milestones

High-level goals, roughly ordered by dependency:

- **Allegro Standard complete** — all core types fully typed, type inference, pattern matching, error handling, string interpolation. The language is usable for real programs.
- **DSL ready** — grammar extension DSL defined in Allegro, embeddable grammars, custom syntax as importable modules.
- **Multi-phase build pipeline** — project configuration, phase-specific resources, phase gate checks. The partial evaluation compilation model works end-to-end.
- **Tracing and debugging** — execution tracing, expression graph inspection, source location in errors, step-through debugging.
- **Standard library** — filesystem, networking, process management, math, collections. Enough to write useful tools.
- **Fully bootstrapped** — parser, type system, module system all implemented in Allegro. TypeScript runtime is just a thin host.
- **In-browser sandbox** — core + standard library running in the browser, interactive REPL, shareable programs.
- **Target code generation** — expression graph → JavaScript / WASM / native. Partial evaluation as optimization.
- **Performance optimization** — memoization as Standard feature, continuation-based TCO (Stage 2), JIT-style hotspot optimization.
- **Package ecosystem** — versioning, dependency resolution, registry. Third-party modules.

## 2. Detailed Features

### Type System
- [x] Subtyping / extends — Type/NominalType hierarchy, nominal + structural instanceof/subtypeof, `~` structural operator
- [x] Interfaces — `Type.interface({...})`, structural type matching (no explicit `implements`), parent member inheritance, auto-naming
- [x] Mixins — `.mixin({method: fn, ...})` adds methods to types, ComposedFunction dispatch, error on conflict
- [x] Union types — `Int | String`, `type_union` primitive, union instanceof checks alternatives
- [x] Full type inference — evaluation IS type inference. Typed args flow into untyped functions, types propagate through call chains, polymorphic specialization at each call site. CompilationReport.bindingTypes records all inferred types.
- [x] Return type inference — via compile-time partial evaluation of typed function bodies
- [ ] Variance — covariant/contravariant/invariant type parameters
- [ ] Scalar type builder — `Scalar(bitLength)` for new Bits-backed types with custom encoding
- [ ] Packed Bits structures — buffers, tuples, vectors of same-type scalars as Bits representations
- [x] Rename NamedType → NominalType (clearer purpose: nominal vs structural checking)
- [ ] Type constraints — `where T: Comparable`
- [x] Binding type annotations — `x: Int = 42`, `type_check_binding` primitive
- [x] Pattern matching — `when/is/then` with resolve-first semantics, multi-case, wildcard, binding
- [x] Destructuring patterns — type `is Type(field)` and structural `is {field}`, nested sub-patterns
- [x] Guard clauses — `and` keyword in patterns, `and`/`or` as keyword synonyms for `&&`/`||`
- [x] Nested destructuring — colon introduces sub-pattern in field specs, recursive matching
- [ ] Patterns as boolean expressions with unification — full expression parsing in pattern mode (future)
- [x] Generics — `Array[T]`, `Function[ParamTypes, ReturnType]`, memoized type constructors
- [x] Function types and unification — type variables bind progressively at call sites
- [x] UntypedFunction — wraps base primitives in standard mode
- [x] Any type — matches any type, bare generics auto-apply Any
- [x] `instanceof` infix — `x instanceof T` returns Bool
- [x] `subtypeof` infix — `S subtypeof T` returns Bool
- [x] Type constructors — `__construct` mechanism, built-in constructors for Int/Float/String/Bool
- [x] Fluent type API — `extend`, `where`, `distinct`, `constructor` methods on Type/NominalType
- [x] Meta-type dispatch — type-level methods via `__type` binding on raw Contexts
- [x] Auto-naming — types bound to symbols get named after evaluation
- [x] Member descriptors (`__members`) — unified Method/Field descriptor types, type methods and fields in `__members` collection, structural checking via `__members` comparison, meta-type methods (instanceof, subtypeof, extend, where, distinct, constructor) in `__members`

### Partial Evaluation & Compilation
- [ ] Formalize multi-phase partial evaluation (invocation → config → compile → emit → package → deploy → execute)
- [x] Compile-time type inference — precompileFunctions pass, type propagation through residuals
- [x] Phase gate checks — CompilationReport with inferred types, errors, unresolved bindings
- [ ] Target code generation (expression graph → executable)
- [ ] Tree shaking via partial evaluation
- [x] Forward-chaining partial evaluation — DepCollector tracks incomplete dependencies during evaluation. DependencyRegistry tracks reactive bindings. propagateCompletions re-evaluates dependents when bindings complete. applyPhase provides new bindings and triggers cascading re-evaluation. Memoization disabled (replaced by this mechanism).
- [ ] Memoization as Standard feature (only for fully resolved expressions, optional optimization)
- [ ] Continuation-based TCO (Stage 2 — attach continuations for non-tail recursive calls)
- [x] eval_if Rule 2 — partial evaluation of both branches when condition undefined
- [x] Tail call optimization (Stage 1) — O(1) stack for tail-recursive functions
- [x] Symbol resolution — compile-time lexical scoping, direct references

### Parser & Grammar
- [ ] Grammar extension DSL — define new syntax from Allegro code
- [ ] Runtime grammar extension Phase 2 — multi-token prefix parselets (`match x with ...`), new statement forms, conflict detection, registration from the hosting file, operator/keyword name mangling, per-scope activation
- [ ] Embeddable grammars — switch to different parser mid-file or per-module
- [ ] Mid-statement grammar switching (low priority)
- [ ] Bootstrap parser in Allegro
- [ ] Error recovery improvements (currently skips to next statement)
- [x] Hybrid parser (Pratt + recursive descent) — O(n) expression parsing
- [x] Dynamic lexer config — extensions register new operators/keywords
- [x] Keyword disambiguation — true/false/import/export/when/is/of/none/error/instanceof/subtypeof properly handled
- [x] Float literals via maximal munch
- [x] Source location tracking in tokens
- [x] Expression continuation via offside rule — multi-line if/then/else, operator continuation, nested expressions. Lexer suppresses Newline before Indent, parser tracks continuationDepth.
- [x] Earley parser retained for standalone grammars
- [x] Runtime grammar extension Phase 1 — module-scoped `register_infix`/`register_prefix`/`register_postfix`/`register_expr_prefix`, `use_grammar NAME` header activates module's `GrammarFragment` before parsing, lambda body substituted as AST template (no eval at parse time). Demo: `lib/pow.alg` with `**` and `neg`.

### Execution Context & Build Pipeline
- [ ] Project root file (structure, phases, deps — replaces package.json + tsconfig)
- [ ] Phase-specific resource declarations (`ctx_use` with type annotations)
- [ ] CLI modes: `allegro run`, `allegro build`, `allegro test`
- [ ] Multi-phase build pipeline implementation

### Module System
- [x] Standard library — `lib/math.alg` (sqrt, pow, sin, cos, abs, floor, ceil, round, min, max, clamp, sign, PI, E, TAU), `lib/functional.alg` (identity, constant, flip, compose, pipe, apply, twice, thrice, on), `lib/collections.alg` (range, zip, flatten, take, drop, head, tail, last, reverse, sum, product, contains, indexOf)
- [x] System library resolution — local lib/ first, system lib/ fallback
- [x] Standard parser in modules — modules can use typed syntax (Float, Int, etc.)
- [ ] Qualified import (`import math.round`)
- [ ] Re-exports
- [ ] Module versioning and compatibility
- [ ] Circular dependency handling (currently prohibited)
- [x] Export keyword — `export name = value`
- [x] Module encapsulation — type-directed access, unexported bindings hidden
- [x] On-demand module loading from `lib/` directory

### Language Features
- [x] String interpolation — `"hello {name}"`, `"{expr}"`, escaped `\{`
- [x] Implicit async via futures — FutureManager bridges JS Promises to forward-chaining. `delay(ms)` primitive. Deferred print. No `await` keyword needed.
- [x] `fetch(url)` primitive — async HTTP GET, returns future resolving to String. Works in Node 18+ and browsers. Error responses become error values.
- [x] Browser async demos — web sandboxes use `evalAllegroAsync` with streaming output. Fetch and delay demos on allegrolang.org.
- [ ] Async I/O primitives — file read/write, WebSocket, timers (execution-context provided)
- [ ] Sync/async type modifiers — explore async-by-default with `sync` optimization hint
- [ ] Configurable mutability — linear types, transient mutation, semantic variants
- [x] Error values — `error` keyword, automatic propagation through operations, Error type
- [x] None type — `none` keyword, singleton value, returned for absent MultiValue components
- [ ] Error handling — try/catch syntax (deferred; can use `if error of x is E` for now)
- [ ] Algebraic effects — `perform`/`handle`/`resume` (requires continuations)
- [x] Pipe operator (`|>`) — `x |> f` desugars to `f(x)`, left-associative, bp=3
- [ ] Regular expressions
- [x] Logical operators — `&&`, `||`, `!` with short-circuit semantics
- [x] String operations — fully typed (17 methods)
- [x] Array higher-order methods — map, filter, reduce
- [x] Type annotations — function params and return types with generics
- [x] MultiValue component access — `Y of x` syntax (e.g., `type of value`, `error of value`)
- [x] Error propagation — errors as MultiValue components, auto-propagation in evaluator
- [x] None type — `none` keyword, returned for absent components

### Standard Libraries
- [ ] Filesystem (read/write, provided by execution context)
- [ ] Networking (HTTP, sockets)
- [ ] Process management (spawn, signals)
- [ ] Math (trig, pow, sqrt — as typed Allegro functions)
- [ ] Collections (Map, Set — as typed generic structures)
- [ ] Regex

### Runtime & Tooling
- [ ] Browser runtime (core is browser-compatible, needs packaging)
- [ ] Debugging and execution/evaluation tracing
- [ ] REPL improvements (multi-line input, better error display, tab completion)
- [ ] Expression graph processing (query, transform, rewriting)
- [ ] Language server protocol (LSP) for IDE integration

### Long-term / Allegro High
- [ ] Logic programming extensions/DSL
- [ ] Constraint programming
- [ ] Data modeling DSL
- [ ] Numerical methods
- [ ] Sophisticated declarative composition
- [ ] Multiple semantic models (functional, imperative, mixed) as extensions

## 3. Immediate To Do

Priority-ordered list of next items to implement:

1. **User-defined type declaration syntax** — syntax sugar for `extend`/`where`/`distinct`/`interface` (deferred until API patterns are clear)
2. ~~**Refinement types**~~ — ✅ Phase 1: `Int && _ > 0` syntax, predicate checks at construction/annotation/call sites, `.preserveOps()` operator lifting. Phase 2 deferred: algebraic constraint propagation (`y = x + 1` inheriting `_ > 1`), type parameter constraints (`Array[T] && T subtypeof Int`), flow-sensitive narrowing.
3. ~~**Migrate array methods to Allegro**~~ — ✅ map/filter/reduce as Allegro ComposedFunctions (recursive AST construction)
4. ~~**Mixins**~~ — ✅ `.mixin({method: fn})` adds Method descriptors to types, ComposedFunction method dispatch with self binding, error on name conflict
4b. ~~**Parser combinators from Allegro**~~ — ✅ Phase 1: `grammar_new`/`grammar_terminal`/`grammar_phrase`/`grammar_choice`/`grammar_choice_add`/`grammar_repeat`/`grammar_optional`/`grammar_set_target`/`grammar_parse` primitives expose the Earley parser to Allegro. Parse returns tree of Allegro values (Terminal→String, Phrase→Array, Disjunction→transparent, Repetition→Array with delimiters stripped, Optional→value or none, errors→typed Error). Demo: `tests/grammar-regex.alg`. Phase 2 deferred: inline Allegro semantic actions, runtime extension of Allegro's own grammar (`register_infix`).
5. ~~**Meta-type dispatch for ComposedFunction descriptors**~~ — ✅ `type_dispatch_impl`'s untyped-Context meta-type path now handles ComposedFunction method descriptors in addition to PrimitiveFunction, mirroring the typed-value path. Both the `__members` descriptor branch and the `typeMethod` direct-binding fallback handle both function kinds.
6. ~~**Nested refinement + mixin constructor unwinding**~~ — ✅ `buildMixinType` rebuilt: now delegates to `parentConstruct` (which already chains all predicate checks through nested refinements) and retags with the mixin type, rather than manually unwinding one level. Also fixed a related error-propagation bug in `refined.__construct` where an error from a parent refinement check would get silently retagged instead of propagated.
7. ~~**8-byte string literals collide with Int in `typeLiterals`**~~ — ✅ Fixed by wrapping string literals with `typed_string` primitive at parser time (hybrid-parser.ts lines 566, 666), so typeLiterals' length heuristic only applies to actual int literals.
8. ~~**Stack overflow in `seq(zero_or_more(m), m2)` parser combinators**~~ — ✅ Fixed via the Param-sharing fix in evaluator.ts (see note 9).
9. ~~**Mutual recursion between user functions and parse tree walkers fails silently**~~ — ✅ Root cause: in `subst()` (evaluator.ts), when descending into a ComposedFunction to substitute free variables, `newFn.params = value.params` shared the params array. Subsequent `p.owner = newFn` mutated the shared Param objects, so earlier closures created from the same factory had their params' owner overwritten to point to the *latest* closure. This caused inner-lambda param lookups to fail silently or stack-overflow. Fix: clone the params array AND each ParamValue, then remap Param references in the new body via a `paramMap` → newParam lookup. This is in `src/evaluator.ts` `subst()` ComposedFunction case, with a new `remapParams` helper. This fix also unlocks full mutual-recursion and combinator-composition patterns that previously failed.
