# Structured-values unification — design discussion

> Status: **draft — active design discussion** (pre-implementation).
> This is the "backlog for the pre-backlog discussion": settled decisions,
> open questions (base language first), and risks. Outcome will be promoted
> to `docs/design/structures.md` (new) + deltas to `type-system.md`,
> `effects.md`, and the rebuilt `BACKLOG.md`.
> Participants: maintainer + Claude, 2026-06.

## Context

MultiValue (primary + named components) and Context (named bindings) are
both string-keyed slot collections. Proposal under discussion: replace them
with a single structured-value primitive, split the evaluation-scope role
out of Context, replace `__*` meta-bindings with declared slots, and make
annotation channels extensible with declared propagation rules.

## Decisions so far (settled in discussion; ratify before implementation)

| # | Decision |
|---|---|
| D1 | Unify MultiValue + the record role of Context into one primitive; split the evaluation-scope role out. Scopes remain first-class introspectable values. |
| D2 | Annotation **channels are extensible** — extensions register channels with declared propagation rules (viral / union / computed / positional / drop). The layered architecture depends on this (e.g. D3 info-flow taint as a channel). |
| D3 | The lazy/eager `primaryOf` stripping asymmetry is replaced by per-channel propagation semantics. |
| D4 | The type system (typing, visibility, variance, equality policy) stays OUTSIDE Allegretto. The base carries only: the structure kind, the channel plane substrate, and the **sealing mechanism** (mechanism in base, policy in extensions). |
| D5 | Strict typing of all structures is a Standard-layer guarantee; Allegretto structures may be untyped (duck-typed with a limited set of defined slot keys). |
| D6 | `__*` prefixes are retired; meta-slots become declared slots with visibility/access attributes, recorded in a registry (`docs/design/type-system.md` §4). |
| D7 | Internal `Type : Type` self-reference is kept; universe stratification is handled by translation at the proof-export boundary. |
| D8 | Equality is type-customizable, with declared laws; proofs record which equality they discharged under. Reference-equality-by-accident (the `proofValEqual` bug) is disallowed by design. |
| D9 | Arrays: no refs-inside-Bits (Bits stays pure reference-free data). Direction: base numeric-keyed structures with O(1) indexed host implementation + Standard encapsulated collection types choosing representations (packed Bits for primitive elements, dense structure storage otherwise). To ratify (B6/S4). |
| D10 | Functions keep returning annotated values: the return is a structure whose channels are populated per propagation rules. When the result is itself a structure, channels attach directly — no wrapper nesting. |

## Open questions — base language (resolve first)

- **B1. Channel/data namespace.** One namespace (channels are slots; collision
  hazards: user field named `type`, accidental transparency via a `primary`
  key) vs **two planes in one construct** (data slots + annotation channels —
  current lean) vs distinguished key values (symbol-like keys). DECIDE FIRST —
  most other questions depend on it.
- **B2. Transparency marker.** Presence of `primary` (duck) vs explicit flag.
  If B1 = two planes, `primary` lives in the annotation plane and duck-typing
  is safe. Interaction: can a structure have both data slots and a primary?
  (Lean: no — transparent values have an empty data plane; ratify.)
- **B3. Absence and incompleteness.** Proposed resolution to ratify:
  structures are always structurally complete — a slot is present or absent;
  *incompleteness is a value, not a structure state* (futures/unresolved as a
  first-class value kind occupying slots, unifying scope forward-chaining
  `__future_N` machinery). Absent-optional = `none`. Blocking-read semantics,
  async-by-default visibility, and whether reading a future is an effect —
  needs its own session (known: maintainer sees records completed over time,
  sync and async; design must support that via slot-valued futures).
- **B4. Sealing primitive.** Shape of the base mechanism: seal-at-construction
  bit + host-side brand; sealed ⇒ complete (no future-valued slots)? sealed ⇒
  identity equality? Who can unseal (nobody)?
- **B5. Scope kind.** Scopes keep `Binding.isUse`, unresolved bindings,
  scopePredicates, parent layering. Name: **Scope** (proposed) vs keep
  Context. What of today's Context primitives (`ctx_*`) — do they target
  scopes, structures, or both?
- **B6. Base array mechanism.** Ratify: numeric-keyed structures with
  guaranteed O(1) indexed access in the host implementation (dense-elements
  region); no separate vector primitive.
- **B7. Name for the unified construct.** Candidates: **Structure**
  (front-runner), Composite, Frame, Object, NamedTuple, StructuredValue.
  Record vetoed (persistence connotation).
- **B8. Minimal base surface.** Enumerate exactly what Allegretto must provide:
  structure construction/read, channel plane + propagation hook registration,
  sealing, scope ops. Everything else (typing, visibility, equality policy,
  collections) must be expressible as extensions — this is the layering proof.

## Open questions — Standard layer

- **S1. Meta-type construction.** Kinds are types-of-types and must be built
  with the same construction as ordinary types (today Effect/Proof are
  hand-rolled copies). Self-reference + inheritance subtleties; may pull on
  multiple inheritance (revisit trigger in `type-system.md` §2). Define a
  "define a kind" recipe as a library operation.
- **S2. Equality framework.** Default equality per category (structural for
  unsealed structures, identity for sealed and for memoized nominal types);
  type-customizable `equals` with declared laws (reflexivity/symmetry/
  transitivity as dischargeable theorems); proof terms carry the equality
  they used; `proof_trans` requires matching equalities. Role of `~`:
  re-purpose as selection of the structural-comparison view? |
- **S3. Visibility/access control.** Attribute set (public / internal-to-
  defining-extension / …); requires an ownership notion tied to the module
  system. Enforcement point: dispatch reads slot attributes (Standard);
  sealing (base) backstops integrity.
- **S4. Collection types.** `Array[T]` / `Map` / `Set` as encapsulated types
  choosing representations (packed Bits for primitive element types; dense
  structure storage for reference elements; persistent structures — HAMT/RRB
  — to reconcile immutability with effectively-O(1) update). Links to future
  transient-mutation work.
- **S5. Variance + type constraints** (`where T: Comparable`) — necessary
  Allegro semantics; design within the layering constraint (B8).
- **S6. Channel registry.** Standard channel set (type, error, effects,
  predicates, source, warnings) with propagation rules; registration surface
  for extension channels; interaction with introspection and PCP verdicts.

## Implementation questions (after design settles)

- **I1. Shape/hidden-class representation.** Instances = (shape ref, flat slot
  storage, channel storage, optional dense region); typed structures use the
  type AS the shape; untyped structures get transitional inferred shapes.
  Channel propagation rules stored on the shape. PE payoff: known type ⇒
  known shape ⇒ slot access compiles to offsets (feeds Phase I codegen).
- **I2. Migration sequencing.** (1) typed accessor layer + slot registry over
  the current representation → (2) visibility/sealing enforcement through
  accessors → (3) representation swap. Steps 1–2 are valuable standalone.
- **I3. Test-suite impact.** The `MultiValue(MultiValue(...))` nesting tests
  and `primaryOf` behaviors change meaning; per PROCESS §6, test-condition
  changes get discussed before modification.

## Risks raised (with current mitigations)

1. **Dataflow semantics leaking into structures** (records completed over
   time) — mitigated by B3's "incompleteness is a value" proposal; needs the
   dedicated absence/async session before ratification.
2. **Namespace collision under duck typing** (user `type` field vs type
   channel; accidental `primary` transparency) — mitigated by B1 two-plane
   lean.
3. **Forgery through the base door** — if sealing were Standard-layer policy
   only, Allegretto code could forge Proofs; hence D4's mechanism-in-base.
4. **Custom equality × proofs** — proofs must name their equality (S2), else
   `proof_trans` becomes unsound across equality views.
5. **Base-simplicity erosion** — every addition to Allegretto must pass B8's
   layering proof; the unification must *shrink* the kind count, not grow it.

## Next steps

1. Resolve B1–B8 (base first, per maintainer direction), starting with B1.
2. Dedicated session: absence/futures/async semantics (B3).
3. Dedicated session: meta-types + equality (S1, S2) — feeds the
   meta-protocol registry.
4. Parser design discussion (separate track, `docs/design/grammar.md` §2).
5. Then: finalize BACKLOG rebuild; draft `docs/design/structures.md`;
   implementation plan with chunks per PROCESS §4.
