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
| D11 | **No operation errors on an incomplete value.** Operations on unresolved values produce residuals ("blocking" always means residual production, never throw). Explicit incompleteness *detection* is a separate introspection surface and is itself effectful (B12). |
| D12 | **Structures are always structurally complete.** Incompleteness is a value: an unresolved future occupying a slot, never a structure state. (Ratifies B3's core; downsides reviewed in B13 — headline: futures become write-once monotonic cells, confluent but interior-mutating.) |
| D13 | `seal` on a structure containing unresolved future-valued slots: emit a **warning and invalidate any proofs derived from the seal**. (The residual-seal alternative — seal completes when slots resolve — would require proving resolved values are not causally downstream of the seal; no known use case, deferred.) |
| D14 | **Slot keys are symbol \| string \| number; channel keys are always namespaced symbols.** Symbols gain optional namespaces; type-defined member identifiers become symbols rather than strings. Resolves B1: one slot space, partitioned by key sort — user data (string/number keys) cannot collide with channels. `primary` is a channel symbol, so duck-typed transparency is safe. |
| D15 | **MultiValue wrapper is flattened for structures**: channels attach directly. Scalar primaries (Bits etc.) use a *transparent structure* (empty data plane + `primary` channel) — same construct, not a distinct wrapper kind. |
| D16 | Reading a potentially-unresolvable value is an **effect**, dischargeable by a **resolvability/completion proof** — the first productive proofs×effects interaction (supersedes the orthogonality memo's claim for this case). Program correctness may not depend on unresolvable values. |

## Open questions — base language (resolve first)

- **B1. Channel/data namespace.** **RESOLVED by D14** (distinguished key
  sorts: channels are namespaced symbols, data slots are string/number/symbol).
  Residual sub-questions moved to B9 (symbol semantics) and B10 (channel
  write control).
- **B2. Transparency marker.** Largely resolved by D14+D15: `primary` is a
  channel symbol, duck-typing safe. Remaining to ratify: can a structure have
  both data slots and a primary? (Lean: no — transparent values have an empty
  data plane.)
- **B3. Absence and incompleteness.** Core **RESOLVED by D11+D12**: structures
  always structurally complete; incompleteness is a future value in a slot;
  absent-optional = `none`; no operation throws on incompleteness. Remaining
  async cluster split into B11–B13 (dedicated session).
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
- **B9. Symbol value semantics** (new, from D14). Interning/identity rules;
  namespace **ownership** (who may construct symbols in a namespace — likely
  tied to the registering module/extension; unowned construction =
  forgeability, reopening the collision/forgery risk); relationship to the
  existing Symbol value kind (compile-time-resolved named *reference* / AST
  node) — disentangle (new interned-identifier kind?) or unify carefully;
  literal syntax for symbols and namespaced symbols.
- **B10. Channel write control** (new). How extensions get controlled access
  to channel functionality. Current lean: channel *registration* is a base op
  (symbol + propagation rule) returning a **writer capability**; writes
  require the capability; reads are unrestricted (introspection/PCP need
  them). Mechanism-in-base, policy-with-capability-holder — avoids both
  free-for-all forgery and base-surface bloat from bespoke per-channel ops.
  Alternative (all channel ops through base operations) on the table.
- **B11. Completion semantics: sync vs async** (new, split from B3). The two
  cases are distinct; nearly all concerns stem from **async**. Headline:
  **deadlock — resolvability/completion must be provable.** Sync completion
  (forward-chaining within a pass) is deterministic; deadlock = dependency
  cycle, statically detectable. Async resolution depends on external events;
  liveness needs declared assumptions (e.g. "fetch eventually resolves or
  errors") as axioms feeding completion proofs. Possibly the most important
  proof use case (D16). Needs the dedicated session.
- **B12. Incompleteness detection** (new, split from B3). Use cases needing
  to *observe* unresolvedness: non-blocking I/O, deadlock detection, effect
  accounting. An `is_resolved`-style op's result depends on scheduling — it
  breaks confluence/determinism, so it must itself be an effect. Enumerate
  the use cases and the minimal detection surface.
- **B13. Future value mechanics** (new, split from B3). Write-once monotonic
  cell (interior mutation, but single-assignment ⇒ confluent — Oz/IVar
  precedent) vs structure-replacement propagation (today's residual model);
  future-of-future flattening ruling; per-slot read overhead (is-it-a-future
  check — PE/shapes can discharge statically when type known); memory
  retention of resolution machinery; equality on futures → residual per D11.

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
- **S7. Member-identifier namespace** (new, from D14). Type members become
  symbol-keyed: which namespace do member names live in — per-type,
  per-module, or a shared/global member namespace? Constraint: **structural
  typing requires member names comparable across independently defined
  types**, which argues for a shared namespace (per-type symbols would break
  `__members`-comparison conformance). Dot-dispatch interning point; back
  compat with string-keyed `typeMethod` lookups during migration.
- **S8. Blocking-read effect ergonomics** (new, from D16). The effect fires
  on any read of a potentially-unresolvable value — noisy by default. Shape
  of the discharge: completion proofs remove the effect (like domain
  implication discharges refinement checks); declared liveness axioms for
  external sources (B11); what the undischarged residue looks like in
  introspection/verdicts so it informs without drowning.

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
   time) — contained by D12 (incompleteness is a value); residual risk is
   the async cluster (deadlock/unresolvability), addressed by B11 + D16
   (resolvability proofs).
2. **Namespace collision under duck typing** (user `type` field vs type
   channel; accidental `primary` transparency) — RESOLVED by D14 (key-sort
   partition); residual risk is symbol-namespace **forgeability**, owned by
   B9/B10 (ownership + writer capabilities).
3. **Forgery through the base door** — if sealing were Standard-layer policy
   only, Allegretto code could forge Proofs; hence D4's mechanism-in-base.
4. **Custom equality × proofs** — proofs must name their equality (S2), else
   `proof_trans` becomes unsound across equality views.
5. **Base-simplicity erosion** — every addition to Allegretto must pass B8's
   layering proof; the unification must *shrink* the kind count, not grow it.
6. **Interior mutation via futures** (D12/B13) — write-once cells are
   monotonic and confluent (single-assignment dataflow precedent), but they
   are the first crack in pure immutability; keep the discipline explicit
   and host-enforced.
7. **Unprovable liveness for async sources** — completion proofs for
   external events bottom out in declared axioms (B11); axioms must be
   visible in verdicts (a proof resting on "fetch eventually resolves" is
   weaker than a closed proof and must say so).

## Next steps

1. Ratify D11–D16 (this round's resolutions: B1, B2-core, B3-core).
2. Next base questions in queue: **B9 (symbol semantics) + B10 (channel
   write control)** — they gate D14's soundness; then B4 (sealing shape),
   B5–B8.
3. Dedicated session: async cluster **B11–B13** (+S8) — deadlock,
   resolvability proofs, liveness axioms, detection effects.
4. Dedicated session: meta-types + equality (S1, S2) — feeds the
   meta-protocol registry.
5. Parser design discussion (separate track, `docs/design/grammar.md` §2).
6. Then: finalize BACKLOG rebuild; draft `docs/design/structures.md`;
   implementation plan with chunks per PROCESS §4.
