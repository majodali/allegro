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
- [x] Subtyping / extends — Type/NamedType hierarchy, nominal + structural instanceof/subtypeof, `~` structural operator
- [ ] Interfaces — structural type matching (no explicit `implements`)
- [ ] Mixins — types with default implementations
- [ ] Algebraic types — sum types (tagged unions), product types
- [ ] Full type inference — Hindley-Milner style for unannotated functions
- [x] Return type inference — via compile-time partial evaluation of typed function bodies
- [ ] Variance — covariant/contravariant/invariant type parameters
- [ ] Type constraints — `where T: Comparable`
- [ ] Binding type annotations — `x: Int = 42`
- [ ] Pattern matching — destructuring, match expressions
- [x] Generics — `Array[T]`, `Function[ParamTypes, ReturnType]`, memoized type constructors
- [x] Function types and unification — type variables bind progressively at call sites
- [x] UntypedFunction — wraps base primitives in standard mode
- [x] Any type — matches any type, bare generics auto-apply Any

### Partial Evaluation & Compilation
- [ ] Formalize multi-phase partial evaluation (invocation → config → compile → emit → package → deploy → execute)
- [x] Compile-time type inference — precompileFunctions pass, type propagation through residuals
- [x] Phase gate checks — CompilationReport with inferred types, errors, unresolved bindings
- [ ] Target code generation (expression graph → executable)
- [ ] Tree shaking via partial evaluation
- [ ] Memoization as Standard feature (remove from base evaluator)
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
- [x] Keyword disambiguation — true/false/import/export properly handled
- [x] Float literals via maximal munch
- [x] Source location tracking in tokens
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
- [ ] Error handling — try/catch or effect-based surface syntax
- [ ] Pipe/chaining operator (`|>`)
- [ ] Regular expressions
- [x] Logical operators — `&&`, `||`, `!` with short-circuit semantics
- [x] String operations — fully typed (17 methods)
- [x] Array higher-order methods — map, filter, reduce
- [x] Type annotations — function params and return types with generics

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

1. **Algebraic types** — union constraints (`Shape = Circle | Rectangle`), refinement types (`Int & _ > 0`)
2. **`~` syntax in grammar** — structural type modifier in annotations (needs parser reimplementation)
3. **Binding type annotations** — `x: Int = 42`
4. **Pattern matching** — destructuring in bindings and function params
5. **Error handling** — try/catch or effect-based surface syntax
