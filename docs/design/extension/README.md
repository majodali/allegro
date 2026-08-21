# L1 — Extension substrate (boundary contract)

> Layer model: `docs/design/layers.md`. Milestone: **M2 Extension
> substrate formalized**.

## Provides

The machinery that makes the platform programmable: the grammar formalism
and engine (spec: `docs/grammar-formalism.md` — kept at `docs/` top level;
it is referenced by Tier-0 PROCESS and by source code), runtime grammar
extension (`grammar { … }` blocks, `use` activation, fragment merging,
conflict validation), the **standard parser** (concrete syntax is an
extension — maintainer ruling 2026-07; may eventually be re-hosted on
L3's parser generator), and **module/extension loading** (path resolution,
dependency resolution, caching, circular-dependency detection).

## May depend on

L0 only. The loader hands parsed, resolved bodies to evaluation; it does
not know about types.

## Explicitly NOT in this layer

**Typed module objects, export surfaces, encapsulation** — L2 (maintainer
ruling 2026-07: the module system is split; loading is L1, the typed
interface is L2). The type system itself is L2 content that this layer
merely *transports* as extensions.

## Invariants (boundary-tested)

- Grammar extension is immutable layering — base grammars are never
  mutated (structural sharing only).
- Extension merging validates before activation (`E_OPERATOR_CONFLICT`,
  `E_KEYWORD_CONFLICT`, `E_PRECEDENCE_CYCLE`, `E_INCOMPATIBLE_GRAMMARS`;
  see `grammar.md` §4).
- The loader gives libs and top-level files the same pipeline (one
  `evalSource` path; v1 lesson).

## Documents

- `grammar.md` — parser & grammar-extension design decisions
- `modules.md` — loading contract + module objects (the L1/L2 split doc)
- Formalism spec: `../../grammar-formalism.md` (top level, see above)
