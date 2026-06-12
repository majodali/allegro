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
| D17 | A structure **cannot** have both data slots and a `primary` channel — transparent values have an empty data plane (closes B2). |
| D18 | Arrays are **numeric-keyed structures** — no separate vector primitive (ratifies D9/B6). |
| D19 | The unified construct is named **Structure** (closes B7). |
| D20 | **Symbols are unique values tied to their registering Scope** — the registering scope IS the namespace. Scopes that register symbols can carry FQNs and/or descriptive names; FQNs are unique and default to the module file path. Symbols are the **existing Symbol value kind, redefined** to meet these needs (not a new kind). Syntax: bare name where unambiguous (`x.type`); `x[type]` requires `type` bound via import (disambiguates across namespaces); namespace-qualified via imported namespace (`x[allegretto.type]` vs `x[algebra.type]`). |

## Open questions — base language (resolve first)

- **B1. Channel/data namespace.** **RESOLVED by D14** (distinguished key
  sorts: channels are namespaced symbols, data slots are string/number/symbol).
  Residual sub-questions moved to B9 (symbol semantics) and B10 (channel
  write control).
- **B2. Transparency marker.** **RESOLVED by D17** — no structure has both
  data slots and a primary.
- **B3. Absence and incompleteness.** Core **RESOLVED by D11+D12**: structures
  always structurally complete; incompleteness is a future value in a slot;
  absent-optional = `none`; no operation throws on incompleteness. Remaining
  async cluster split into B11–B14 (dedicated session).
- **B4. Sealing → immutability + brand (reframed).** Maintainer: sealing may
  be nothing more than immutability; prefer general **immutability support**
  — easy to adopt, define, detect, and obvious to users (all-values-immutable
  preferred personally, but Allegro stays flexible). Claude's decomposition
  proposal: seal = **immutability + constructor-authority brand**; the brand
  half may fall out of B10's channel-write capabilities (you cannot forge
  `type: Proof` without the type-channel writer), in which case no separate
  `seal` op exists — base provides immutability + channel control only.
  Verify against the forgery scenarios before adopting. Sub-questions:
  - *Depth*: immutable values may reference only immutable values (deep
    immutability — maintainer assumption, Claude agrees). O(1) construction
    check via an immutable bit on referenced values.
  - *Channel narrowing vs immutability*: see S9 / the knowledge-channel
    split — narrowing must be flow-knowledge on derived references or
    scope-held facts, never in-place channel mutation (in-place would make
    observable channels depend on evaluation order — breaks confluence).
  - *Identity equality* for branded immutables (interacts with S2).
- **B5. Scope kind.** Scopes keep `Binding.isUse`, unresolved bindings,
  scopePredicates, parent layering. Name: **Scope** (proposed) vs keep
  Context. What of today's Context primitives (`ctx_*`) — do they target
  scopes, structures, or both?
  - *Current inventory* (src/primitives.ts §CONTEXT): `ctx_new`,
    `ctx_bind` (copy-on-write add), `ctx_resolve` (throws on missing or
    unbound), `ctx_bindings` (enumerate), `ctx_use` (declare a
    name-without-value slot: `{value: undefined, isUse: true}`).
  - *Finding*: `Binding.isUse` is near-vestigial — `ctx_use` is its only
    producer and REPL carry-forward its only reader; everything that
    matters (forward-chaining, unresolved scan, futures' `__future_N`
    slots) keys off `value === undefined` instead. The pair is an ad-hoc
    precursor of the **unresolved channel** concept — the rewrite should
    subsume both into channel-resolution state rather than port them.
- **B6. Base array mechanism.** **RESOLVED by D18** — numeric-keyed
  structures, O(1) indexed host implementation, no vector primitive.
- **B7. Name.** **RESOLVED by D19** — **Structure**. (Scope for the
  evaluation construct still pending under B5.)
- **B8. Minimal base surface.** Enumerate exactly what Allegretto must provide:
  structure construction/read, channel plane + propagation hook registration,
  sealing, scope ops. Everything else (typing, visibility, equality policy,
  collections) must be expressible as extensions — this is the layering proof.
  Maintainer note: the rewrite's scale means **every existing primitive gets
  re-evaluated** against the new model (keep / re-target to Structure or
  Scope / subsume into channels / drop) — B8 should produce that full audit
  table, not just the new-surface list.
- **B9. Symbol value semantics.** Core **RESOLVED by D20** (scope-as-
  namespace, FQNs, redefine the existing Symbol kind, bare/import/qualified
  syntax). Ownership/forgeability is answered: symbols are *registered* in a
  scope, not freely constructible into foreign namespaces. Residual design
  work: the redefinition itself — today's Symbol is a compile-time-resolved
  AST reference; the new Symbol is also a runtime unique value. Resolution
  timing (when does a bare `type` in source bind to a registered symbol —
  same lexical-scoping pass?), identity across re-evaluation/sessions,
  serialization/printing of namespaced symbols, and the ambiguity rule for
  bare names (error vs innermost-scope-wins when two imports register the
  same simple name).
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
- **B14. Async construction guard for immutables** (new, maintainer
  proposal, lean: adopt). Conservative route: transparent incomplete slots
  allowed only in **synchronous** construction (knot-tying within a pass);
  in the async case the **constructor invocation is held as the residual**
  — the immutable value never exists in incomplete state, so immutable
  values contain no interior-mutating cells at all, and reading an immutable
  value is never a blocking effect (blocking concentrates at the
  construction guard — simplifies effect calculation). Known downsides to
  weigh: (1) loss of partial access/pipelining — a 10-slot record with one
  pending fetch makes all 10 slots wait; escape hatch: declare the slot
  **explicitly `Future[T]`-typed** (the future IS the complete value; its
  interior state is owned by future semantics, not the structure); (2)
  mutually-referencing immutable structures across an async boundary become
  unconstructible (sync knot-tying still works); (3) consumers shift from
  reading-residuals to construction-residuals — roughly neutral churn.
  Settle alongside B11–B13 in the async session.
  **Maintainer caveat (adopted-with-reservation)**: downside (1) cuts
  against the PE thesis — partial access is critical to it. Candidate
  PE shortcuts (compiler sees through the construction guard and
  residualizes `s.x` against the already-resolved channel) exist but
  need a soundness analysis before adoption: the key hazard is that
  construction-time invariant/refinement checks run AT the guard — a
  partial read could observe a field of a structure that ultimately
  fails its invariant and never exists. Tracked as **B15**.
- **B15. Partial access under the construction guard** (new, from B14
  reservation). Analyze PE shortcuts that recover pipelining on
  under-construction immutables without reintroducing interior mutation.
  Sketch: projecting an already-resolved channel out of a held
  constructor is referentially sound *iff* the projection cannot be
  observed when construction would fail — i.e. either (a) the structure
  has no construction-time invariants (shape-only), provable statically,
  or (b) the projected residual stays guarded (entangled with the
  constructor's success), making it a proof obligation, not a semantics
  change. Decide which shortcuts are admissible and what the kernel must
  prove for each. Belongs to the async session alongside B11–B14.

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
  introspection/verdicts so it informs without drowning. (If B14 is adopted,
  most of the noise vanishes structurally — reads of immutables never block.)
- **S9. Imputed vs declared type** (new, maintainer note). The `type`
  channel as used so far is the **imputed type** — always the same as or
  narrower than the **declared type** (the shape/class definition), and
  narrowable at each operation in an expression. The declared type must be
  maintained separately because it carries member definitions (dispatch).
  The imputed type overlaps in purpose with the `predicates` channel —
  unify or distinguish, and disambiguate the two names. Claude's lean:
  **declared type = the shape**, fixed at construction, part of value
  identity, lives with the data plane (I1: the type IS the hidden class);
  **imputed type + predicates unify into flow knowledge** — a monotonic
  knowledge lattice (base-type bound + abstract domains + predicate set)
  attached to *occurrences* (derived references / scope-held facts per B4),
  excluded from value identity and equality. Naming candidates: declared →
  `shape` or `class`; imputed+predicates → `knowledge` / `facts` /
  `refinement`.

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
   are the first crack in pure immutability. **B14's construction guard, if
   adopted, eliminates the crack for immutable values entirely** (immutables
   never contain unresolved cells); the cell discipline then applies only to
   mutable/transient values and the construction-residual machinery.
7. **Unprovable liveness for async sources** — completion proofs for
   external events bottom out in declared axioms (B11); axioms must be
   visible in verdicts (a proof resting on "fetch eventually resolves" is
   weaker than a closed proof and must say so).

## Next steps

1. Ratify D17–D20 follow-ons: the B4 sealing→immutability decomposition
   (does the brand reduce to B10 channel capabilities?) and the S9
   knowledge-channel split — both proposed by Claude this round, awaiting
   maintainer review.
2. Remaining base questions in queue: **B4 (immutability semantics)**,
   B5 (Scope), B8 (minimal base surface), B10 (channel write control),
   B9-residual (Symbol redefinition details).
3. Dedicated session: async cluster **B11–B15** (+S8) — deadlock,
   resolvability proofs, liveness axioms, detection effects, construction
   guard ratification, partial-access PE shortcuts soundness.
4. Dedicated session: meta-types + equality (S1, S2) — feeds the
   meta-protocol registry. S9 likely joins this session (identity/equality
   must exclude knowledge channels).
5. Parser design discussion (separate track, `docs/design/grammar.md` §2).
6. Then: finalize BACKLOG rebuild; draft `docs/design/structures.md`;
   implementation plan with chunks per PROCESS §4.
