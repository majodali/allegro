# Module system — loading and module objects

> Tier 1 design doc (the `modules.md` the extension README lists;
> promoted from the session bootstrap at the K-002 slim, B-095
> chunk 3). Layer split per `docs/book/layers.md` ruling 2: module
> LOADING is L1 (this doc's first half); typed module OBJECTS and
> encapsulation are L2 (second half, shared with
> `docs/book/standard/type-system.md` §3 access control).
> Implementation: `src/modules.ts`, `src/use-scanner.ts`,
> `src/scope.ts`.

## Loading (L1)

- **Anonymous extensions** are the substrate: named bindings injected
  by the execution context, layered between primitives and source.
  Modules are just extensions built from `.alg` files.
- **ModuleLoader** (`src/modules.ts`) loads `.alg` files with
  dependency resolution, caching, and circular-dependency detection.
- **Loaded once per process** (B-157 P2 (a library loads once per
  run)): a module file's extension (its bindings, grammar fragment and
  module object) is built by the first load in a process and shared by
  every program and module that uses or imports the file afterwards,
  whichever `ModuleLoader` instance asks: the file runner's `use` and
  `import` loaders and the test harness read one cache. The cache is
  keyed by the resolved path and the file's content, so an edited file
  loads afresh and two files of one name in different directories stay
  two modules. The extension served is the one the first load built,
  under that load's base extensions and future manager.
- <a id="def-owner-module"></a>**Owner module** (B-158 (in-place write
  through a library alias), ruled 2026-10-29): the module whose
  evaluation constructed a value. Sharing rests on one invariant: **a
  library's values are immutable after load; a module writes only into
  values it owns.** The in-place passes that reach a module's values
  from a consumer (tail-position marks, body-metadata collapse) are
  idempotent. Three writers in the program pipeline were not, and each
  was reached through a consumer's top-level alias of a library value
  (`T = LibType`, `f = lib_f`); each now has a guard:
  - **Member re-keying** (`stabilizeTypeMemberScope` in
    `src/types-std.ts`) is write-once. A type's `localMemberScope` is
    its construction's counter scope (`<type:N>`) until the first
    binding that names it moves its members onto a name-stable scope
    (`<type#…>`); a type already on a name-stable scope is never
    re-keyed. A library type keeps the scope its load gave it.
  - **The divergence stamp** in `evalSource` (the program pipeline)
    adds `div` only to functions the evaluation owns. The values
    reachable from the `extensions` it was handed (each extension's
    bindings and each module object's fields) are library-owned, and
    the stamp skips them by reference. A program's analysis therefore
    no longer stamps a library function through an alias; the
    library's contract is the one its own load stamped.
  - **The precompile write** (`precompileFunction` (precompile) stores
    the inferred effect set on the function it is given) skips a
    library-owned function the same way. An alias evaluates to the
    library's own function object, which the library's load already
    precompiled in its own scope.
  - **The check**: the test `module: B-158` in `src/test/modules.ts`
    snapshots every own host field, metadata field, effect set and
    member key of every value `units` and a scratch library bind, runs
    two programs that alias those values, and asserts the snapshot is
    unchanged and that the second program's `instanceof` and member
    dispatch on the aliased type still work. A writer added later that
    reaches a library value through a program fails it.
- **Import syntax**: `import name` — declarative; module values are
  provided via extensions, not by an imperative load at the site.
- **Resolution order**: local `lib/` first, then the system `lib/`
  fallback. Modules parse with the standard parser and see the full
  type system (Float, Int, …).
- **One pipeline** (invariant, extension README): libs and top-level
  files go through the same `evalSource` path — the `use NAME` /
  `use import NAME` / `use NAME.MEMBER` header pre-scan is shared
  (`src/use-scanner.ts`), transitive `use` chains resolve through the
  loader's own resolver and cache, and every compile-time check
  (proofs, effects, exhaustiveness, termination) fires inside libs
  exactly as in user code.
- **Known limit**: `use grammar { … }` literal blocks inside libs are
  rejected with a clear error (needs a bootstrap `evalSource`
  recursion; deferred until a lib needs it).
- **Context layering** (C2.3b): real scope-chain layers — primitives
  ← extensions ← base (REPL persistence) ← source — via `src/scope.ts`
  parent links (O(1) extend, chain-walking lookup), not a flat copy.
  The returned eval ctx IS the source layer; flat-view consumers use
  `scopeAllBindings`. Full design: `structures.md` §4.

## Module objects and encapsulation (L2)

- **Export** (B-097 V1): `export NAME = …` marks the BINDING in the
  module scope (`Binding.visibility` — never the value, so `y = x`
  copies no export-ness); `buildModuleObject` wraps the exported set
  as a typed Object. Open-module policy: a module declaring no
  exports is fully open; any `export` closes it to its export set.
- **Module objects**: imported modules are typed Objects — dot access
  dispatches through the module's type, exposing only exported
  fields.
- **Encapsulation**: `type_dispatch` enforces it — only fields listed
  on the type are accessible; module types implement the
  `fallbackMember` hook (3-ary since B-097 V2) restricted to exported
  fields. The general mediated-member design (D41–D43) EXECUTED at
  B-097: flat `use`-injection is filtered to the same export set the
  module object exposes (V1 — the second leak route closed), and the
  wire resolves foreign FQNs against the exported registry only (D42,
  C5.1). The three routes together are the live forgery-E guarantee:
  a module-private binding — the ocap writer discipline — is
  unreachable through dot access, injection, and the wire alike.
- **Type-member privacy** (B-097 V3) is a separate, finer tier: see
  `docs/book/standard/type-system.md` §3 — `private(...)` members
  are scoped to the TYPE's own member bodies, not to the module
  around the type.

## Standard library roster (`lib/`)

`math` (sqrt, pow, sin, cos, … + PI, E — plus the Phase B refinement
pilots), `functional` (compose, pipe, identity, …), `collections`
(range, zip, flatten, reverse, sum, …), plus the grammar/body-form
libs (`effects`, `contracts`, `invariants`, `totality`, `proven`,
`tactics`, `provable`, `units`, `pow`, `match_expr`).
