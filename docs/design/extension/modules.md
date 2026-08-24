# Module system — loading and module objects

> Tier 1 design doc (the `modules.md` the extension README lists;
> promoted from the session bootstrap at the K-002 slim, B-095
> chunk 3). Layer split per `docs/design/layers.md` ruling 2: module
> LOADING is L1 (this doc's first half); typed module OBJECTS and
> encapsulation are L2 (second half, shared with
> `docs/design/standard/type-system.md` §3 access control).
> Implementation: `src/modules.ts`, `src/use-scanner.ts`,
> `src/scope.ts`.

## Loading (L1)

- **Anonymous extensions** are the substrate: named bindings injected
  by the execution context, layered between primitives and source.
  Modules are just extensions built from `.alg` files.
- **ModuleLoader** (`src/modules.ts`) loads `.alg` files with
  dependency resolution, caching, and circular-dependency detection.
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
  on the type are accessible; module types implement `__getMember`
  restricted to exported fields. (The general mediated-member design
  this grows into is D41–D43, S3 tranche.)

## Standard library roster (`lib/`)

`math` (sqrt, pow, sin, cos, … + PI, E — plus the Phase B refinement
pilots), `functional` (compose, pipe, identity, …), `collections`
(range, zip, flatten, reverse, sum, …), plus the grammar/body-form
libs (`effects`, `contracts`, `invariants`, `totality`, `proven`,
`tactics`, `provable`, `units`, `pow`, `match_expr`).
