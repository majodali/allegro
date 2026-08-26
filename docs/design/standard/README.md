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
- A failed proof, undeclared effect (`div` included — CE-R1), or a
  failed refinement/type annotation halts compilation ("build safety
  in") — in libs exactly as in user code. Two paths are consciously
  weaker (CE-R8): construction-path invariant failure yields an error
  VALUE (`contracts.md` §7), and non-exhaustive match is an info
  notification — promotion is a maintainer decision (`totality.md` §5).

## Documents

- `type-system.md` — meta-types, definition mechanisms, meta-property
  registry
- `effects.md` — effect system schema, lattice, inference, subversion
- `pattern-matching.md` — `when/is/then`, destructuring, guards
- `totality.md` — discharge spectrum (D34), the divergence analyzer,
  exhaustiveness taxonomy, severity reconciliation (B-018 reval)
- `contracts.md` — predicate/knowledge model, `assert`/`requires`/
  `ensures` lowering, invariants as refinements, discharge and failure
  semantics, mechanism-choice guidance (B-014 reval; CT-R1–CT-R6
  ratified)
- Planned, **revalidation-gated** (BACKLOG register): `proofs.md`,
  `pcp.md`
- Proving primer (consumable, top level): `../../proving-in-allegro.md`
