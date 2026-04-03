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
- [ ] Interfaces — structural type matching (no explicit `implements`)
- [ ] Mixins — types with default implementations
- [x] Union types — `Int | String`, `type_union` primitive, union instanceof checks alternatives
- [ ] Full type inference — Hindley-Milner style for unannotated functions
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

### Partial Evaluation & Compilation
- [ ] Formalize multi-phase partial evaluation (invocation → config → compile → emit → package → deploy → execute)
- [x] Compile-time type inference — precompileFunctions pass, type propagation through residuals
- [x] Phase gate checks — CompilationReport with inferred types, errors, unresolved bindings
- [ ] Target code generation (expression graph → executable)
- [ ] Tree shaking via partial evaluation
- [ ] Forward-chaining partial evaluation — residual expressions re-evaluate when dependencies complete. Replaces memoization for incomplete expressions. Symbol binding and phase-provided bindings use the same mechanism. Residuals are replaced (not mutated) on each re-evaluation, so no stale state or circular dependency issues.
- [ ] Memoization as Standard feature (only for fully resolved expressions, remove from base evaluator)
- [ ] Continuation-based TCO (Stage 2 — attach continuations for non-tail recursive calls)
- [x] eval_if Rule 2 — partial evaluation of both branches when condition undefined
- [x] Tail call optimization (Stage 1) — O(1) stack for tail-recursive functions
- [x] Symbol resolution — compile-time lexical scoping, direct references

### Parser & Grammar
- [ ] Grammar extension DSL — define new syntax from Allegro code
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

### Execution Context & Build Pipeline
- [ ] Project root file (structure, phases, deps — replaces package.json + tsconfig)
- [ ] Phase-specific resource declarations (`ctx_use` with type annotations)
- [ ] CLI modes: `allegro run`, `allegro build`, `allegro test`
- [ ] Multi-phase build pipeline implementation

### Module System
- [ ] Qualified import (`import math.round`)
- [ ] Re-exports
- [ ] Module versioning and compatibility
- [ ] Circular dependency handling (currently prohibited)
- [x] Export keyword — `export name = value`
- [x] Module encapsulation — type-directed access, unexported bindings hidden
- [x] On-demand module loading from `lib/` directory

### Language Features
- [x] String interpolation — `"hello {name}"`, `"{expr}"`, escaped `\{`
- [ ] Async evaluation — promises/futures, await syntax
- [ ] Configurable mutability — linear types, transient mutation, semantic variants
- [x] Error values — `error` keyword, automatic propagation through operations, Error type
- [x] None type — `none` keyword, singleton value, returned for absent MultiValue components
- [ ] Error handling — try/catch syntax (deferred; can use `if error of x is E` for now)
- [ ] Algebraic effects — `perform`/`handle`/`resume` (requires continuations)
- [ ] Pipe/chaining operator (`|>`)
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

1. **User-defined type declaration syntax** — syntax sugar for `extend`/`where`/`distinct` (deferred until API patterns are clear)
2. **Pattern matching — nested patterns and guards** — nested destructuring, `when x is Int(n) if n > 0`
3. **Refinement types** — `Int & _ > 0`, constraint expressions
4. **Interfaces** — structural type matching (no explicit `implements`)
5. **Migrate array methods to Allegro** — map/filter/reduce as typed Allegro functions
