# L2 — Allegro Standard (boundary contract)

> Layer model: `docs/design/layers.md`. Milestones: **M3 Standard
> revalidated on v2** and **M4 Provability capability complete** —
> separate states by maintainer ruling (2026-07): provability is an
> independent capability cluster within L2.

## Provides

Everything users experience as "the language," expressed as L1 extensions
over L0: the type system (types as values, kinds, generics, refinements),
core types and collections, **typed module objects** (the L2 half of the
module split — export surfaces, encapsulation), the standard library, and
the **provability capability**: contracts, totality, effects, proof
terms, and the Proof Collaboration Protocol.

## May depend on

L0 and L1 public surfaces only. The layering proof (structures.md §1, §11)
is that this entire layer builds on the ~40 base primitives plus grammar
extension — no host back-doors. The kind recipe re-deriving Effect and
Proof with zero hand-rolled residue is the exit criterion
(structures-implementation Phase 6).

## Invariants (boundary-tested)

- Every value in Standard mode has a type; no implicit fallback in typed
  operators.
- Proof/`discharged` authority is kernel-private via ordinary channel
  capabilities — unforgeable from anywhere in or above this layer.
- Dispatch follows shape; knowledge gates visibility (structures.md §6).
- A failed proof, undeclared effect, or failing invariant halts
  compilation ("build safety in") — in libs exactly as in user code.

## Documents

- `type-system.md` — meta-types, definition mechanisms, meta-property
  registry
- `effects.md` — effect system schema, lattice, inference, subversion
- `pattern-matching.md` — `when/is/then`, destructuring, guards
- Planned, **revalidation-gated** (BACKLOG register): `contracts.md`,
  `totality.md`, `proofs.md`, `pcp.md`
- Proving primer (consumable, top level): `../../proving-in-allegro.md`
