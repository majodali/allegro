# Allegro — Backlog

## Next Milestone: Parser Reimplementation

Prerequisites:
- [ ] Symbol resolution / lexical scoping (replace Param(-1, "name") with properly scoped Symbols)
- [ ] eval_if Rule 2 (partial evaluation of both branches when condition undefined)
- [ ] Tail call optimization (parser uses recursion heavily)
- [ ] String operations fully typed (parser manipulates strings)

Parser work:
- [ ] Design new parser architecture (hybrid TypeScript/Allegro-informed)
- [ ] Implement scannerless Earley (or alternative) with proper keyword support
- [ ] Grammar as Allegro values — parser driven by grammar Contexts
- [ ] Mid-statement grammar switching (low priority — rare use case)
- [ ] Bootstrap: translate TypeScript parser to Allegro

## Type System

- [ ] Subtyping / extends — `__extends` prototype chain, `isSubtypeOf` predicate
- [ ] Interfaces — structural type matching (no explicit `implements`)
- [ ] Mixins — types with default implementations
- [ ] Algebraic types — sum types (tagged unions), product types
- [ ] Type inference — Hindley-Milner style, built on partial evaluation + unification
- [ ] Variance — covariant/contravariant/invariant type parameters
- [ ] Type constraints — `where T: Comparable`
- [ ] Binding type annotations — `x: Int = 42`
- [ ] Pattern matching — destructuring, match expressions

## Partial Evaluation & Compilation

- [ ] Formalize partial evaluation phases (invocation → config → compile → emit → package → deploy → execute)
- [ ] Phase gate checks (postconditions that scan expression graphs)
- [ ] Target code generation (expression graph → executable)
- [ ] Tree shaking via partial evaluation
- [ ] Tail call optimization in evaluator
- [ ] Memoization as Standard feature (remove from base evaluator)

## Execution Context & Build Pipeline

- [ ] Project root file (structure, phases, deps — replaces package.json + tsconfig)
- [ ] Phase-specific resource declarations (`ctx_use` with type annotations)
- [ ] CLI modes: `allegro run`, `allegro build`, `allegro test`
- [ ] Multi-phase build pipeline implementation

## Module System

- [ ] Export syntax sugar (`export` keyword — requires parser keyword support)
- [ ] Qualified import (`import math.round`)
- [ ] Re-exports
- [ ] Module versioning and compatibility
- [ ] Circular dependency handling (currently prohibited)

## Language Features

- [ ] String interpolation — `"hello {name}"`
- [ ] Async evaluation — promises/futures, await syntax
- [ ] Configurable mutability — linear types, transient mutation, semantic variants
- [ ] Error handling — try/catch or effect-based surface syntax
- [ ] Pipe/chaining operator
- [ ] Unary minus as proper operator (currently `0 - x`)

## Standard Libraries

- [ ] Filesystem (read/write, provided by execution context)
- [ ] Networking (HTTP, sockets)
- [ ] Process management (spawn, signals)
- [ ] Math (trig, pow, sqrt — as typed Allegro functions)
- [ ] String utilities (regex, split, join, trim)
- [ ] Collections (Map, Set — as typed generic structures)

## Runtime & Tooling

- [ ] Browser runtime (core is browser-compatible, needs packaging)
- [ ] Debugging and execution/evaluation tracing
- [ ] REPL improvements (multi-line input, better error display, tab completion)
- [ ] Expression graph processing (query, transform, rewriting)
- [ ] Language server protocol (LSP) for IDE integration

## Long-term / Allegro High

- [ ] Logic programming extensions/DSL
- [ ] Constraint programming
- [ ] Data modeling DSL
- [ ] Numerical methods
- [ ] Sophisticated declarative composition
- [ ] Grammar extension DSL (define new syntax from Allegro code)
- [ ] Multiple semantic models (functional, imperative, mixed) as extensions
