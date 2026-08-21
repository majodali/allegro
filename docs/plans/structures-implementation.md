# Structures unification — implementation plan

> Status: **closed** → Backlog entries B-001…B-031 + tranche B
> (Phases 0–7 + chunk C7.2 landed; M1 exited 2026-08 — see
> `docs/CHANGELOG.md`). Kept as the chunk record (§4) and
> conscious-delta log (§6) until content promotion.
> Design: `docs/design/allegretto/structures.md` (decision log D1–D46,
> archived: `archive/structured-values-unification.md`).
> Related backlog: items B-001…B-031 (sequenced head) mirror this plan's
> phases; absorbed items noted in §7.
>
> **Chunk log:**
> - C0.1 (B-001) landed 2026-07 — `src/boundary-tests.ts`: boundary lint
>   (4 patterns, 14 files, 661-occurrence ratchet baseline in
>   `src/boundary-baseline.json`, negative-tested), invariant property
>   checks (deterministic generator, 40 programs, W1+W2), forgery skeleton
>   A–F (visible, skipped, unlock chunks assigned), baseline snapshot
>   (basics.alg output, suite floor 979 enforced in test.ts summary, perf
>   floor warn-only at 2× — hard threshold pending maintainer decision).
>   984/984 green.
> - C1.1 (B-006) landed 2026-07 — `src/slots.ts`: D39 disposition table as
>   code (56 registrations: type/refinement/generic/proof/effect fields,
>   channels, base concepts, host internals; exact + prefix matching),
>   read-side typed accessors over the current representation,
>   `channelReadRaw`/`channelList`. W3 registry-completeness invariant
>   added to the harness walker (negative-tested) + corpus walk over 27
>   self-contained tests/*.alg files — zero unregistered keys. Lint scan
>   now includes untracked files; `src/slots.ts` is the sanctioned
>   `allowedFiles` entry (exempt from ratchet; counts recorded — 74 dunder
>   literals, 3 components accesses). Three slots absent from D39's table
>   given proposed dispositions, then reviewed in detail with the
>   maintainer and **ratified 2026-07** (D39 addendum recorded in
>   structures.md): `__effectBound` → member, dissolving into the instance
>   label-set representation at C6.2; `exported` → scope-binding
>   visibility metadata (S3, base concept; value-plane marker is a stopgap
>   with a known aliasing wart, dissolves at Phase 2); `arity` → deleted
>   (write-only, never read; write removed from `wrapAsUntypedFunction`).
>   Maintainer perf ruling recorded: warn-only floor now, refined
>   progressively. 986/986 green.
> - C1.2 (B-007) landed 2026-07 — core-file accessor migration.
>   `slots.ts` gained the write side (`setName`…`writeShape`/
>   `writeDischarged` shims mirroring addBinding exactly; C1.4 gates
>   origination on top), removal helpers, `SLOT_KEYS` constants for
>   residual key-filter idioms, `isMetaSlotKey`, `dataOf` (the accessor-
>   layer name for primaryOf — the C1.5/C4.3 semantics change now happens
>   in one place), `cloneComponents`/`componentsView`, effect-var label
>   helpers, `getInterfaceMarker`/`isGenericTypeSlot`. `evaluator.ts`
>   (39 sites incl. 2 property-style effectBound reads) and
>   `types-std.ts` (~215 sites) migrated to accessors; `types.ts` was
>   already clean. Both files now at ZERO lint violations; ratchet
>   738 → 500 total. One incidental cleanup: a duplicate bindingList
>   push in buildGenericType's markGeneric block collapsed into the
>   shim. tsc at pre-existing baseline; 986/986 green — zero behavior
>   change, suite as oracle.
> - C1.3 (B-008) landed 2026-07 — remaining-file migration + hard-fail
>   flip. All 12 files (primitives 200 sites, totality, refinements,
>   introspect, runtime, proofs, effects, pcp, proven, modules, grammar2
>   builder + fragments) migrated: 222 mechanical `dataOf` renames,
>   ~100 reviewed sites. New accessors: `hasName`/`hasShapeSlot`/
>   `hasDischarged`, set-only proof stampers (`stampProposition`/
>   `stampDischarged`/`stampEqOperands` — deliberately map-only, no
>   bindingList entry, mirroring the proof kernel's origination idiom;
>   these are C1.4's capability chokepoints), `renameInPlace` (auto-
>   naming's binding-object mutation, map-entry only). Every production
>   file at ZERO violations except sanctioned slots.ts; `hardFail: true`
>   flipped and negative-tested — the enforcement moment: direct slot
>   access outside the accessor layer is now a suite failure.
> - C1.4 (B-009) landed 2026-07 — channel writers + forgery suite v1.
>   Channel registry in slots.ts: all 9 built-in channels registered with
>   propagation rules (recorded now, consulted by C1.5); one-shot
>   registration returns the writer closure (D24); integrity channels
>   reject fabricating rules at registration (D23). `discharged` writer is
>   kernel-private: acquired via `kernelChannelWriter` at exactly the two
>   origination sites (primitives.ts failed proofs, types-std.ts
>   makeProof), lint-restricted to those modules. Construction-path gates:
>   object literals and mv_set refuse `__discharged`/`discharged` keys —
>   closing a REAL pre-existing hole (an Allegro object literal
>   `{__discharged: 1, __proposition: "forged"}` produced a structurally
>   valid discharged proof; forgery A was live in the wild). Allegro
>   surface: `channel_register(name, rule) → writer`,
>   `channel_read`/`channel_list` (free, D23), `channel_attenuate(w, pred)`
>   (delegable attenuation, D24; brand-checked). Registration is
>   epoch-sealed: the evaluator's fixpoint loop re-evaluates top-level
>   bindings within one pass, so same-pass identical re-registration
>   returns the held writer; any later program's re-registration throws.
>   Forgery A/B/D/F live as real attack tests (C unlocks at C1.5, E at
>   S3). Scoping note: non-integrity channels (shape/error/effects/
>   knowledge) keep their existing single-function origination chokepoints
>   (withType, error creation, withEffects, withPredicates) — full writer
>   indirection for them lands with C1.5's propagation table, where those
>   functions collapse into writer + table entries. The hard-fail lint
>   caught one drive-by dunder literal in my own new code (brand constant)
>   — relocated to slots.ts.
> - C1.5a (B-010 part 1) landed 2026-07 — propagation table + channel-
>   aware mode. §6 deltas 1–3 ruled by maintainer (recorded in §6 above);
>   11 differential fixtures recorded pre-change (incl. two legacy warts:
>   chain-residual error loss, error-in-if-cond else-branch) and asserted
>   every run. Generic table-driven `viralScan` replaces both hand-rolled
>   error loops (applyPrimitive + applyComposed); union merges installable
>   per channel (`installChannelMerge`; effects installs its own);
>   `assertPropagationTableLinkage` fails startup if the registry drifts
>   from what the evaluator implements (computed/grandfathered rules
>   documented at the assertion). Third registration mode
>   `channelAware` on makePrimitive: eager, args arrive with channels
>   intact; 6 strip-dodging proof prims flipped (refl/sym/trans/cong,
>   prove_for_all_bool, prove_induction). **Briefing correction**:
>   proof_check reclassified as genuinely lazy — it reads the UNEVALUATED
>   proposition AST via eqExprSides, so it keeps lazy registration (ruling
>   said 7; investigation found 6 true strip-dodges). Forgery C live
>   (drop-rule: executor exclusion + registration gate + combination
>   test) — 5 of 6 scenarios now live. C1.5b (five-wrapper *_attach
>   collapse) follows as its own landable unit.
> - C1.5b (B-010 part 2) landed 2026-07 — the *_attach collapse. New
>   `collapseBodyMetadata` pass in evalSource (post-resolveSymbols,
>   pre-markTailCalls — tail marking now sees real bodies): peels the
>   five-wrapper chain off every reachable ComposedFunction body
>   (descending through type_check layers), stashing metadata as
>   host-internal properties (__partial, __decreasesMetric,
>   __declaredEffectsAst, __paramEffectPairs, __provenClauses; registered
>   in SLOT_REGISTRY; clone-preserved via PRESERVED_FN_META_KEYS in
>   subst/remapParams). Analyzers migrated to property reads: totality
>   (isFunctionPartial, decreases site), proven (checkProvenClauses),
>   effects (unwrapEffectsAttach reimplemented over the property),
>   introspect, typed_function_impl (param_effects stamping). Peeler
>   family deleted (findAttachWrapper, unwrapPartialAttach,
>   unwrapDecreasesAttach, unwrapProvenAttach, _WRAPPER_NAMES). Wrapper
>   primitives retained as inert runtime passthroughs (defense for
>   uncollapsed paths). Six peeler-shaped tests reworked into
>   collapse-equivalents per the §6 item-3 ruling. B-010 complete;
>   Phase 1 complete.
> - C2.1 (B-011) landed 2026-07 — scope protocol + parent chain.
>   `src/scope.ts` ops over ContextValue (`parent`/`isScope` host-plane
>   fields); chain-walking Symbol lookup + chain-aware compile-mode and
>   scope-predicate reads; the unification enrichedCtx flatten-copy
>   replaced with O(1) child layering; scope/structure mutual plane
>   rejection (type_dispatch guard; shape-carrying-parent refusal);
>   boundary tests: structural O(1) (10k-parent → 1-entry child),
>   2000-layer chain lookup, shadowing, plane rejection both ways.
>   Deferral recorded: buildEvalCtx root layering moves to C2.3 with its
>   flat-view consumers (REPL, module extraction, forward chaining); the
>   root is marked isScope now.
> - C2.2 (B-012) landed 2026-07 — facts plane. `scopeAssume` immutable
>   fact layers (no parent copying; branch exit = discard);
>   `scopeFactsFor` chain-merge reads (rootmost first — byte-identical to
>   the former copy-then-merge); `scopeOwnFacts` sanctioned own-layer
>   writes for assert/requires; augmentScopePredicates delegates to
>   scopeAssume; four entailment binding lookups made chain-aware (static
>   discharge would otherwise silently degrade inside branches);
>   `.scopePredicates` opacity lint restricted to scope.ts. Boundary
>   tests: sibling isolation, parent-untouched, nested chain merge,
>   own-layer isolation. §6 delta 4 honored: observable behavior
>   identical, internals-shaped tests only.
> - C2.3b (B-013 part 2) landed 2026-07 — future cells + root layering;
>   **Phase 2 complete**. Unification: `Binding` gains the cell fields
>   (`incompleteDeps`, `isComplete`; `value: undefined` = pending) and the
>   `DependencyRegistry` tracks the SAME objects the eval scope's source
>   layer holds — `ReactiveBinding`/`currentValue` deleted, dual writes
>   collapsed to `resolveCell` in-place resolution (also fixes applyPhase's
>   stale-bindingList wart). `buildEvalCtx` builds the real chain
>   (primitives ← extensions ← base ← source; source layer returned; base
>   flattened per pass into fresh copies so passes stay mutation-isolated,
>   unresolved REPL bindings carried forward as pending cells).
>   Unprovided imports install pending cells (absent-vs-unresolved now
>   structurally distinguishable); `ctx_resolve` unified on residualising
>   semantics per §4/D11 (absent → error value, pending → residual Symbol
>   — the throw path retired; the one observable delta, mandated by the §4
>   chunk description). Flat-view consumers: resolveSymbols + buildEvalCtx
>   use new `scopeAllBindings`; proven.ts type lookup + the three
>   `__futureManager` reads became chain-aware (`scopeHostRead` +
>   slots.ts `HOST_KEYS`; fixes a latent miss under unification-enriched
>   child ctxs); module extraction / introspect / PCP verdict walks now
>   read the source layer correct-by-construction; markTailCallsInContext
>   needed no migration (consumes the parser's file ctx, not the eval
>   scope). `Binding.isUse` deleted with all ~60 literal sites. 6 new
>   boundary tests (own-layer/chain-reach, ctx↔registry identity,
>   pending-vs-absent incl. ctx_resolve, in-place applyPhase +
>   forward-chain, ext-satisfied import, REPL isolation); 3 existing
>   tests adjusted internals-shaped only (chain-aware lookups; unified
>   cell construction — assertions unchanged). 1002/1002 green.
> - C3.3 (B-017) landed 2026-07 — observation effect; **Phase 3
>   complete** (over the current representation; physical
>   knowledge-channel storage moves at C4). `instanceof` on
>   member-transparent refinements is now a PURE PREDICATE RE-CHECK:
>   recursive base check down the chain + per-layer predicate via
>   checkRefinementPredicate (identity/domain fast paths kept — sound
>   over immutable data). Fixed a REAL congruence violation recon
>   surfaced: `5 instanceof PositiveInt` was false while
>   `PositiveInt(5) instanceof PositiveInt` was true — a certificate
>   peek; both now answer by re-check (the flip is the chunk's mandated
>   delta; no existing test asserted the peek). preserveOps types stay
>   nominal — instanceof on a SHAPE is a shape question (same typeShape
>   boundary as C3.1). New `certificate_peek(v, T)` primitive: the
>   provenance question, channel-aware (certificate rides the channels;
>   primaryOf would strip it), tagged effects ["observe"] — inference
>   prices it, `effects pure` + peek fails, F3a deferral applies; walk
>   covers refinement layers only. 3 boundary tests (congruence flip +
>   pure-op interchangeability + equality-ignores-knowledge D37
>   groundwork; nested chain + shapes-nominal; peek-effectful /
>   instanceof-pure via effectsOf). Demo tests/observation-demo.alg.
>   Deferred: full generated-corpus congruence property test (current
>   corpus is a fixed pure-op list) — grows with the D37 equality plan.
>   1017/1017 green.
> - C3.2 (B-016) landed 2026-07 — annotations as knowledge bounds +
>   narrowing. Occurrence `bound` component (drop rule) stamped at
>   annotation boundaries: applyComposed after checkArgType (params) and
>   type_check's success returns (return + binding annotations) via
>   `applyBoundaryBound` — wider-than-shape stamps, own-shape clears
>   (boundary reset), non-nominal annotations (Any/Function/effects/
>   interfaces/unions/generics) pass through. type_dispatch gates member
>   VISIBILITY on the bound (declared-member surface; base Object +
>   fallback-only module types exempt as open) while dispatching visible
>   members through the SHAPE. Narrowing: matched `when … is T` type
>   patterns lift the bound in-arm — Symbol subjects via an O(1)
>   scopeExtend shadow (C2.1 machinery); substituted-param subjects via
>   `replaceValueIdentity` clone-on-write (sound because substituteParams
>   clones former param positions per call — recon initially found the
>   substituted-subject idiom broken and this closed it). knowledgeOf
>   gains `occurrenceBound`; knowledgeDomain meets bound + occurrence +
>   predicates; intrinsic certificates survive looser annotations.
>   **§6 delta 5 activated additive-only**: introspection adds a
>   `bound: T (annotation)` line on bounded values; all existing outputs
>   byte-identical. First user-visible behavior change of the arc
>   (member hiding — D36-mandated); demo tests/knowledge-bounds-demo.alg,
>   4 boundary tests, website "Knowledge Bounds" example. Deferred +
>   recorded in structures.md §6 status: operator-dispatch visibility,
>   knowledge-gated downcast refusal (runtime-sound today), record
>   undeclared-field openness via __getMember. 1013/1013 green.
> - C3.1 (B-015) landed 2026-07 — shape/knowledge split, dispatch on
>   shape. The shape boundary is mechanical: `typeShape` (slots.ts) walks
>   `__extends` past refinement layers whose `__members` is the SAME
>   OBJECT as the parent's (buildRefinedType shares by reference) —
>   those layers are knowledge; preserveOps/mixin/extend mint their own
>   member sets and ARE shapes (overrides dispatch, Liskov). Channel
>   reads: `shape` → computed dispatch shape (identity on non-refined
>   types, so the existing meta-type readers were unaffected); `type` →
>   raw stored view; new `knowledge` channel (computed) + refinements.ts
>   `Knowledge` record (`knowledgeOf` = bound certificate + predicate
>   set; `knowledgeDomain` meet; `meetKnowledge` lattice op — the
>   occurrence carrier already merges through the same
>   mergePredicateSets in scopeFactsFor). Dispatch migrated:
>   type_dispatch_impl + the evaluator PRIM_TO_METHOD site read
>   typeShape(stored); error messages keep the stored name; zero
>   observable change (transparent layers share the member object).
>   `withType` gains the shape-fixed-at-construction refusal
>   (cross-shape re-stamp throws; same-shape knowledge re-bounds pass).
>   The guard flushed out the one real coercion path: typeLiterals
>   guesses 64-bit literals as Int and the typed_* wrappers correct it
>   (8-char string literals!) — made explicit as `withTypeReplacing`
>   (construction-point semantics). 6 boundary tests (shape identity,
>   preserveOps-is-a-shape, writer refusal, dispatch-ignores-knowledge,
>   certificates ride a typed function boundary, lattice meet).
>   **§6 delta 5 NOT activated**: no introspection change was needed —
>   introspection renders the stored type as before; the output-format
>   question moves to the C3.2 briefing (annotations make knowledge
>   user-visible there). 1008/1008 green.
> - C2.3 (B-013) opened 2026-07 — working spec from recon:
>   Surface is smaller than feared: `isUse: true` originates at ONE site
>   (primitives.ts:376, the `ctx_use` primitive at :367); everything else
>   stamps `isUse: false`. Sub-steps: (1) map ctx_use's consumers (who
>   calls the primitive; who reads `.isUse` downstream — grep shows only
>   runtime.ts:733 forwarding it in a copy loop) and confirm the Earley/
>   REPL paths that used it are dead or migratable; (2) retire
>   `Binding.isUse` (types.ts:106) + ctx_use primitive, or park with a
>   deprecation error if Allegro-reachable; (3) unresolved-binding =
>   future-cell: unify `value: undefined` bindings, `__future_N`, and
>   `__bare_N` on one representation consumed by applyPhase
>   (runtime.ts:858) + DependencyRegistry; (4) buildEvalCtx root layering
>   via scopeExtend chain (primitives → extensions → base → source as
>   layers), migrating flat-view consumers: modules.ts source-binding
>   extraction, REPL persistence (index.ts), markTailCallsInContext,
>   propagateCompletions; add `scopeAllBindings` chain-flatten helper for
>   them; (5) boundary tests: absent-vs-unresolved distinguished (lexical
>   error vs residual), every unresolved-consumer exercised (REPL,
>   forward-chain, futures, imports) on the one representation.
>   Ordering: (1-2) first (small, independently landable), then (3),
>   then (4), then (5); land as C2.3a (isUse retirement) + C2.3b
>   (future-cells + root layering) if size demands.

## 1. Context

The design is settled (D1–D40): MultiValue + Context unify into Structure
(data + channel plane) and Scope (evaluation), with symbols as FQN identity,
the shape/knowledge split, capability-gated channels, and kinds-as-types.
This plan sequences the implementation.

**Governing constraint (maintainer directive): the layer boundaries get
tested really thoroughly.** The plan treats boundary verification as a
deliverable in its own right — the harness lands *first* (Phase 0), every
phase adds adversarial cases to it, and the representation swap (Phase 4)
is gated on the accessor layer being both complete and mechanically
enforced. The migration-safety premise: phases 0–3 change *how* state is
accessed, not what the ~980 existing tests observe; every behavioral delta
is enumerated up front (§6) and discussed per PROCESS §6 before any test
condition changes.

## 2. Settled decisions

All in `docs/design/allegretto/structures.md`; not re-litigated here. The plan-relevant
ones:

- **Sequencing** (I2): accessor layer + slot registry first (valuable
  standalone) → visibility/enforcement through accessors → representation
  swap. The channel plane lands as the accessor layer's read/write shim.
- **Representation** (I1): instance = (shape ref, flat slot storage,
  channel storage, optional dense region); propagation rules live on the
  shape.
- **Conscious deltas** (I3, §6 below): `pure subtypeof Effect` flips,
  `primaryOf` semantics change, lazy-registration workaround removed,
  `buildEffect` copying deleted.
- **Validation criterion** (D39/D40): Effect and Proof re-derived through
  the kind recipe with zero hand-rolled residue.

## 3. Out of scope (follow-on plans, not this one)

- **Equality protocol + lawful interfaces** (D37/D38) — needs Phase 3's
  shape/knowledge split and Phase 6's kind recipe; gets its own plan
  (`equality-and-laws.md`) when Phase 6 lands. Groundwork only here
  (equality-ignores-knowledge boundary tests in Phase 3).
- **Completion effects / futures rework** (D31–D35: `div`, blocking-read,
  triggered guard, future cells beyond what Phase 2.3 needs) — own plan
  (`completion-effects.md`). Phase 2.3 lands only the unresolved-binding =
  future-cell representation the scope split requires.
- **S3 visibility enforcement** beyond module-private writer patterns; S4
  collections (Map/Set, packed Bits); transient mutation; codegen payoffs.

## 4. Phases and chunks

Chunk sizing follows project history (one landable unit per chunk, one
commit, landing checklist per PROCESS §5). Maintainer approves each phase's
go-ahead; "land a chunk, summarize, stop" applies.

### Phase 0 — Boundary-test harness (before any migration)

**C0.1 — Harness + baseline.** New `src/boundary-tests.ts` wired into
`src/test.ts`:
- **Boundary lint**: reads `src/*.ts` sources and fails on forbidden access
  patterns outside an explicit allowlist (regexes per boundary: direct
  `.components` access, `__`-prefixed string literals used as slot keys,
  `bindings.get("__…")`, `primaryOf` outside the accessor module). Starts
  in **warning mode** with a committed violation-count baseline — the count
  may only go DOWN; each migration chunk ratchets it until Phase 1
  completes and the lint hard-fails.
- **Invariant property checks**: a small generator loop (deterministic
  seed) building random structures/values via public ops and asserting the
  standing invariants after every op sequence (initially: MultiValue
  non-nesting, type-component well-formedness; grows per phase —
  transparency, key-sort partition, immutability, channel/slot disjointness).
- **Forgery suite skeleton**: the D21 scenario table (A–F) encoded as named,
  initially-skipped test cases so coverage is visible from day one and each
  phase un-skips the scenarios it makes testable.
- **Baseline snapshot**: current suite green count + `basics.alg` output +
  a coarse perf floor (suite wall-clock recorded, regression threshold
  agreed with maintainer) so representation changes can't silently degrade.

### Phase 1 — Accessor layer + registries (over the current representation)

**C1.1 — Slot & channel registry + typed accessors.** New `src/slots.ts`:
the D39 disposition table as code — every `__*` slot and MultiValue
component registered with owner, disposition (member / channel / base
concept / host-internal), and target name. Typed accessors over the
CURRENT representation (`getTypeOf`, `getMembers`, `getParent`,
`channelReadRaw`, …). No call-site migration yet; lint baseline recorded.
*Boundary tests: registry completeness (a walker asserts no unregistered
`__*` key ever appears on a value built by the test corpus — catches
drive-by meta-slots, enforcing the "no new `__*`" rule mechanically).*

**C1.2 — Call-site migration, core.** `src/types.ts`, `src/evaluator.ts`,
`src/types-std.ts` migrate to accessors; lint ratchets. Zero behavior
change intended — full suite is the oracle.

**C1.3 — Call-site migration, rest + lint hard-fail.** `src/primitives.ts`,
`src/refinements.ts`, `src/effects.ts`, `src/proofs.ts`, `src/totality.ts`,
`src/introspect.ts`, grammar2 tree-builder, remaining files. Lint moves to
hard-fail: direct slot access outside `src/slots.ts` is now a test failure.
*This is the enforcement moment for the base/extension boundary — from here
on, every layer above the accessor module provably goes through it.*

**C1.4 — Channel writers (origination capabilities).**
`channel_register(symbol, rule, read_vis?) → writer` implemented as a shim
over the accessor layer; `channel_read` / `channel_list` free. Existing
origination sites (error creation, `__discharged` stamping, effects
attachment, type stamping) migrate to held writers; kernel-private writers
(`discharged`) captured in module scope and not exported.
*Boundary tests — forgery suite v1 (un-skip A/B/C-class scenarios):
origination without the writer fails; writers print redacted; attenuation
wrapper restricts as specified; `channel_read` works without any authority;
a writer smuggled through serialization round-trip does not survive.*

**C1.5 — Propagation table.** Per-channel propagation rules
(viral/union/computed/positional/drop) as a data table consulted by
`applyPrimitive` — replacing the `primaryOf` strip-vs-preserve asymmetry
and the "register lazy to dodge `primaryOf`" workaround. The `*_attach`
wrapper family collapses into writer invocations + table entries. **First
conscious-delta chunk** — the §6 deltas that belong here are discussed
before the chunk starts.
*Boundary tests — forgery suite v2 (un-skip D/E/F-class): no propagation
rule can originate an authority channel (viral/union on `discharged` is
rejected at registration); error-channel virality reproduces today's
propagation exactly (differential test against recorded Phase-0 behavior);
effects flow through eager AND lazy paths identically.*

### Phase 2 — Scope split

**C2.1 — Scope protocol + parent chain.** Scope ops (`scope_new`,
`scope_extend`, `scope_lookup`, `scope_bindings`) over the current
ContextValue, with real parent-chain layering replacing flatten-copy.
Evaluation-context creation sites migrate.
*Boundary tests: no type-dispatch on scopes (dot access on a scope is an
error, not a member lookup); scope ops reject data structures and struct
ops reject scopes; O(1) extend verified by a depth-scaling property test.*

**C2.2 — Facts plane.** `scope_assume` with immutable layering replaces
the mutate-and-pop `scopePredicates` map; branch/assert/requires push
child scopes.
*Boundary tests: fact payloads opaque to base (base ops never inspect
them — lint pattern); branch-exit discards facts (no leakage across
branches — the D32-adjacent regression suite); predicate-set behavior
byte-identical on the existing refinement tests.*

**C2.3 — Resolution unification.** Unresolved binding = future-cell slot;
`ctx_use` / `Binding.isUse` retired; `ctx_resolve`-style throw path
unified on residualising semantics.
*Boundary tests: every consumer of unresolved bindings (REPL persistence,
forward-chaining, `__future_N`, imports) exercised against the one
representation; absent-vs-unresolved distinguished (lexical error vs
residual).*

### Phase 3 — Shape/knowledge split

**C3.1 — Two channels.** `shape` (declared type, fixed at construction) and
`knowledge` (imputed bound + domains + predicates, one lattice) split from
today's `type` component; intrinsic-knowledge carrier on values. Dispatch
reads shape.
*Boundary tests: shape immutable post-construction (writer refuses);
dispatch never consults knowledge (a value with narrowed knowledge still
runs its shape's override — Liskov cases); refinement certificates ride
values across function boundaries.*

**C3.2 — Annotations as knowledge bounds + narrowing.** `x: Animal` sets
occurrence knowledge; `when x is Dog` narrows; effective knowledge = meet
of intrinsic and occurrence.
*Boundary tests: member visibility follows knowledge while dispatch
follows shape (the two-sided test matrix from D36); abstraction-boundary
crossing resets occurrence knowledge; meet computed not overwritten
(intrinsic facts survive a looser annotation).*

**C3.3 — Observation effect.** `instanceof` = pure predicate re-check;
certificate-peek is a separate effectful op.
*Boundary tests: congruence — two values equal-by-§7 are interchangeable
under every pure function in the corpus (property test); the effectful
peek is flagged by effect inference; equality ignores knowledge
(groundwork asserts for the D37 plan).*

### Phase 4 — Representation swap

**C4.1 — Structure kind.** (shape ref, flat slots, channel storage,
immutable bit, optional dense region) behind the accessor layer; accessors
re-pointed; MultiValue/Context constructors become shims.
*Boundary tests: full invariant battery on the new representation —
transparency (never data slots + `primary`), key-sort partition (channel
symbols can never collide with string/number data keys, tested
adversarially with hostile key names), deep immutability O(1) bit with the
future-cell carve-out. Perf checked against the Phase-0 floor.*

**C4.2 — Arrays as numeric structures.** Dense-region implementation;
`__length` → slot count; Array type re-pointed.
*Boundary tests: O(1) index access verified by scaling test; array/object
duality (numeric-keyed structure answers both protocols consistently);
existing arrays.alg / collections tests as differential oracle.*

**C4.3 — Transparency cutover + shim retirement.** Scalars become
empty-data-plane structures with `primary`; `primaryOf` retired in favor of
transparency-aware accessors; the MultiValue/Context shims and their
non-nesting hacks deleted. **Second conscious-delta chunk** (§6 items
discussed first — briefing delivered and ratified 2026-08, rulings R1–R6
recorded in §6). Sub-chunks: **C4.3a** merge-policy activation (error
virality through residual chains, error-in-if propagation, effects union
on re-evaluation — the three pre-approved fixture expectation changes);
**C4.3b** flatten MV-over-Context + audit the ~76 `ValueKind.MultiValue`
checks (records answer Context protocol); **C4.3c** scalar transparency —
retire `primaryOf` across ~285 `dataOf` sites, delete non-nesting
hacks/shims.

### Phase 5 — Symbols + member identity

**C5.1 — FQN symbols.** Interning, scope registration, base-name
projection, serialization by FQN.
*D42 note (2026-07): deserialization never mints reachability — foreign
FQNs rebind only against EXPORTED symbol registries; a private symbol
arriving over the wire resolves to nothing. Design the registry surface
with the export partition from day one.*
*Boundary tests: same FQN ⇒ identity (across module reload); distinct
scopes ⇒ distinct symbols with equal base names; the ambiguity rule fires
identically at import resolution, member binding, and dot access (one test
matrix, three surfaces).*

**C5.2 — Symbol-keyed members + draw-from.** Type members keyed by
symbols; declared-context draw-from binding; multi-bind (diamond) support;
multiple-distinct-match error; `~`/pattern matching stays on base-name
projection. This is the dissolution point for the `__members`/`__extends`
string keys (D39: they become the declared members `Type.members` /
`Type.parent`).
*C3.1 dependency note (2026-07): `typeShape`'s shape/knowledge boundary
keys on MEMBER-SET OBJECT IDENTITY — a refinement layer is
member-transparent iff its member set is the SAME object as its parent's
(`buildRefinedType` shares by reference; preserveOps/mixin/extend mint
fresh sets). The C5.2 member-representation migration must either
preserve that sharing invariant across the re-keying or replace the
identity test with an explicit transparency marker on the type — decide
in the C5.2 briefing before touching member storage, and carry the C3.1
boundary tests (shape identity, preserveOps-is-a-shape) as the oracle.*
*Boundary tests: declared-conformance vs loose-path separation (a
same-named member from an undeclared context does NOT satisfy an
interface check; `~T` still matches it); diamond multi-bind dispatches to
one implementation through both symbols.*

### Phase 6 — Kinds + validation (the exit criterion)

**C6.1 — define-a-kind recipe.** Standard-layer recipe: instance-member
declarations, declared instance order, constructor authority via channel
capability, operator-minted anonymous instances. `Type : Type` fixed point
verified.
*D44 note (2026-08, RATIFIED — `Type.refines` name confirmed): the
recipe is designed against the three-relation model (conformance +
refinement + composition).
D45 note (2026-08, RATIFIED): ONE construction surface — `define` IS
the recipe (no separate define_kind); Interface and Refinement become
kinds (refinement-of-Type / sub-kind-of-Type respectively); instance-of
= shape CONFORMS TO kind; the half-lotus matrix is a C6.1b battery
test; constructor model: `construct` = the R2 authority member,
call-as-function invokes it at every level, named factories delegate,
everything bottoms out in struct_new + the gated shape stamp. C6.1b
scope grows accordingly: Interface/Refinement kinds + fluent-API
migration/removal + `&` as the R3 operator mint + `distinct` sub-kind
spec design. C6.1 briefing rulings P2–P4 stand as briefed; P1 resolved
as `Type.define` (unified-recipe reading). The recipe takes NO inheritance parameter; `extend`
is removed decisively (no sugar — the composition operation gets its
own name at the recipe's surface design); `Type.parent` narrows to
refinement structure (renamed `Type.refines` (ratified)); the
`nominalSubtypeof` name-string walk dies with the chain (dissolving
its name-collision false positive); the deferred-MI memo's trigger
conditions are superseded on ratification.*

**C6.2 — Effect re-derived.** `buildEffect` member copying deleted;
dispatch-through-shape for `io.union(time)`; anonymous conjunction
instances (`io & time`) close the deferred debt; **`pure subtypeof Effect`
flips** (§6 delta, discussed first); D39 Effect field table checked off
item-by-item.

**C6.3 — Proof re-derived + slot-disposition sweep.** Proof's constructor
authority = kernel-private capability (attenuated writer pattern);
soundness suite re-run adversarially (forge-a-proof attempts through every
channel/op). Final sweep: grep for `__*` returns only registered host-side
internals; the C1.1 registry walker confirms zero unregistered slots.
**Validation criterion met = Effect and Proof rebuilt with zero
hand-rolled residue.**

**C7.1 — MultiValue retirement (D15 execution; D46).** The closing
chunk of the original thesis: the kind that started the journey
retires. Scope (maintainer-ratified 2026-08, D46):
1. *Recon*: enumerate `ValueKind.MultiValue` consumers (evaluator
   branches, `makeMultiValue` call sites, wire/introspect/format
   paths); decide `primary`-channel storage (I-level: register
   `primary` in the channel registry; the existing class field may
   remain its physical storage — the registry already maps storages).
2. *Carrier flip*: the scalar/function/residual carrier is the D15
   transparent structure — empty data plane + `primary` channel; it
   answers the Structure kind. `ValueKind.MultiValue` is DELETED from
   the enum; a C4.3b-style kind-check audit re-routes every
   `=== ValueKind.MultiValue` site (consumers already read data via
   `dataOf`, so most sites collapse or widen mechanically).
3. *Kind-name retirement (D25 completes)*: `ValueKind.Context` renames
   to `ValueKind.Structure` (`ContextValue` → `StructureValue` with a
   transitional type alias); mechanical, tsc-guided, its own commit.
4. *Shims*: `makeMultiValue` retires or narrows to the carrier factory;
   W1 restates as "carriers never nest" (a carrier's primary is never a
   carrier); W2 restates over the carrier; wire/JSON representation
   updated.
5. *NominalType alias retirement* (ratified with this plan): delete the
   export + extension binding; migrate the ~15 remaining test/sandbox
   sites to `Type`.
6. *Docs*: CLAUDE.md's "Seven Value Kinds" reframes as
   representations + computation forms (`kind` demoted to host
   discriminant per D46); §2 status updated; CHANGELOG.
Battery: carrier-duality tests (typed scalar answers Structure; dataOf
reads primary; channels ride), non-nesting, forgery re-run over the
carrier path, suite green.

**C7.2 — kind-tower residue (Tranche B, maintainer-ratified sequence
2026-08).** Drives the D39 checklist to zero. Three sub-parts:

*C7.2a — GenericType through the recipe.* The GenericType kind (Effect
pattern): draws Type's kind-member symbols, declares the `params`
instance field; generic types (Array, Function) stamp shape =
GenericType, so `isGenericType` is a SHAPE check and `__isGeneric` is
DELETED. The applier collapses into the generic's `construct` slot
(D45 one-surface; `__constructor` retired — `getConstruct`'s read
fallback was already the alias, so call-as-function behavior is
unchanged). `__params` → the `params` declared instance binding.
Applied concretes (`Array[Int]`) stay shape Type.

*C7.2b — distinct + constructor kind specs* (the C6.1b deferral).
`Base.distinct()` re-derives as a SYMBOL-FRESH mint: members
re-declared in the distinct type's own gensym'd scope (same
descriptors, new symbol identity), so newtype non-conformance falls
out of C5.2 symbol-identity membership BY CONSTRUCTION instead of the
shared-member-set guard (the guard remains for structuralWrap).
`Type.constructor` (post-hoc, MUTATED the type against D22) is
REMOVED; construct authority is declared at mint time via the reserved
`construct` spec key: `Type.define({x: Int, construct: (a, b) => …})`
(Refinement.define reserved-key precedent).

*C7.2c — effect vars → declared generic-param structure.* The
`__effectvar:` string markers inside effect-label sets and the
`__effectVarParams` side table dissolve into the C1 `__genericParams`
declared structure on function values; PE's Param-call effect
propagation reads the declared param, not marker strings.

**C7.2 rulings (maintainer-ratified 2026-08, R1 as amended):**
- *R1 (GenericType construct authority — DEFERRED SURFACE, not
  kernel-private-by-design)*: maintainer amendment — kernel-private
  features are restricted to those REQUIRED for language integrity, and
  GenericType does not qualify: unlike Proof (where privacy IS the
  soundness mechanism — a forged discharged Proof breaks the system), a
  user-minted generic type breaks nothing; conformance, dispatch, and
  memoization all work through public mechanisms. The current absence
  of construct authority on GenericType is a DEFERRED PUBLIC SURFACE:
  GenericType is intended to eventually hold public construct authority
  like Type itself. What blocks exposure today is surface design, not
  principle — chiefly that `buildGenericType` keys concrete member
  scopes by the generic's NAME (fine for kernel built-ins, colliding
  for same-named user generics; the user path needs gensym'd scopes à
  la `distinct`, plus a decided spec form). The refactor is additive
  (`setConstruct(GenericType, …)` + a define path; no stored-state
  migration), so revisiting the kernel/type-system boundary later is
  cheap. `__args`/`__generic` on applied concretes remain host-read
  instance data — the language-level member surface for applied types
  stays consciously deferred (avoids leaking `.args` into every
  applied-generic value via the typeMethod direct-binding fallback).
- *R2 (distinct = symbol-fresh)*: RATIFIED — newtype identity is fresh
  member symbols, not a guard special-case.
- *R3 (construct spec key)*: RATIFIED — one construction surface; the
  reserved `construct` key in define specs replaces post-hoc
  `.constructor()`; the meta-method leaves the kind API.

## 5. Verification strategy (the boundary contract)

Standing rules, every chunk:
- `tsc --noEmit` + full suite green; **no existing test condition changes
  without prior discussion** (PROCESS §6) — the §6 delta list is the
  pre-approved discussion queue, anything else that fails is a plan bug.
- New behavior gets unit tests + a demo `.alg` where user-visible.
- Boundary lint + invariant property checks + forgery suite run as part of
  `src/test.ts` — they are suite members, not a side script.

Per-boundary summary (details in the chunks above):

| Boundary | Enforced by | Adversarial coverage |
|---|---|---|
| Base / extension layering | accessor lint (hard-fail from C1.3); registry walker | mini type-system built from public base ops only (C6.1 recipe IS this test) |
| Slot plane / channel plane | key-sort partition invariant | hostile key names; channel ops vs struct ops cross-calls (C4.1) |
| Origination / propagation | writer capabilities; registration-time rule checks | forgery scenarios A–F, grown v1 (C1.4) → v2 (C1.5) → final re-run (C6.3) |
| Scope / Structure | protocol rejection tests; no-dispatch rule | dot-access on scopes; struct ops on scopes (C2.1) |
| Shape / knowledge | dispatch-vs-visibility test matrix | Liskov overrides under narrowed knowledge; congruence property (C3) |
| Immutability | O(1) bit + property checks | mutation attempts post-construction; future-cell carve-out (C4.1) |
| Authority (capabilities) | redaction, non-serialization, attenuation tests | proof forgery battery (C6.3) |
| Incompleteness | no-throw-on-incomplete sweep | every op × unresolved-operand grid (C2.3) |

## 6. Conscious behavior deltas (pre-approved discussion queue)

Each is raised for explicit sign-off *before* its chunk starts, per
PROCESS §6; the owning chunk is noted:

1. `MultiValue(MultiValue(...))` non-nesting tests → reframed under
   transparency (C1.5 partially, C4.3 fully).
   **RULED 2026-07 (C1.5 briefing):** C1.5 stays observable-zero — table
   entries carry legacy-faithful merge policies (inner-shadows-outer)
   with the principled rule (e.g. effects union) documented inline;
   divergences activate at C4.3.
2. `primaryOf` strip behaviors in eager primitives → propagation table
   (C1.5); lazy-registration workaround removal for proof/typed prims
   (C1.5).
   **RULED 2026-07:** flip the 7 strip-dodging proof primitives
   (`proof_refl/sym/trans/cong`, `proof_check`, `prove_for_all_bool`,
   `prove_induction`) to a new eager-but-channel-aware registration mode;
   `proof_by_eval`/`print`/`eval_if`/`seq` stay genuinely lazy. Impl args
   stay data-plane for ordinary eager prims (transparency is C4.3).
3. `*_attach` wrapper peeling tests (`findAttachWrapper` family) →
   writer/table equivalents (C1.5).
   **RULED 2026-07:** five metadata wrappers only (`partial_attach`,
   `decreases_attach`, `effects_attach`, `param_effects_attach`,
   `proven_attach`); `type_check` and `requires`/`ensures` are real
   runtime checks and keep their current form.
4. `scopePredicates` mutate-and-pop internals → facts plane (C2.2;
   observable behavior should be identical — internals-shaped tests only).
5. `type` component reads split into shape/knowledge (C3.1) —
   introspection output format changes.
6. `pure subtypeof Effect` → false; `instanceof` becomes the check (C6.2).
7. `buildEffect` per-instance member copying deleted (C6.2).
8. `NominalType` alias: retained through Phase 6, retirement decided with
   the maintainer at C6.3.

**RULED 2026-08 (C4.3 briefing — all recommendations ratified):**
- **R1 (error virality through residual chains, activates C4.3a):** the
  legacy behavior — the error channel is lost after the first residual hop
  (`err-viral-chain`, `err-through-method` fixtures) — is a bug, not a
  policy. Viral-channel scan runs before the unresolved-residual early
  return; the channel rides every hop.
- **R2 (error in `if` condition, C4.3a):** an error-carrying condition
  propagates the error instead of silently taking the else branch
  (`err-in-if-cond`).
- **R3 (effects on MultiValue re-evaluation, C4.3a):** union-rule channels
  merge by union on the flatten path (registry-installed merge), replacing
  legacy inner-shadows-outer for `effects`. Non-union channels keep
  inner-shadows-outer (fresh type info replaces stale).
- **R4 (item 2 above, confirmed):** strip-semantics retirement proceeds at
  C4.3c as planned — `primaryOf` retired for transparency-aware accessors.
- **R5 (item 1 above, confirmed):** non-nesting tests reframed under
  transparency at C4.3c.
- **R6 (MultiValue kind):** `ValueKind.MultiValue` kept through C4.3 —
  but maintainer sees no reason to keep it beyond C6; retirement is the
  expected outcome of the C6 kind-recipe work (decide the exact chunk at
  the C6.1 briefing).
- The three affected DIFFERENTIAL_FIXTURES expectation changes
  (`err-viral-chain`, `err-in-if-cond`, `err-through-method`) are
  pre-approved test-condition changes per this briefing.

**RULED 2026-08 (C5.2 briefing — all recommendations ratified):**
- **R1 (typeShape transparency test):** member-set OBJECT IDENTITY stays
  the shape/knowledge boundary — the sharing invariant is preserved
  across the re-keying (only the key type changes). The two implicit
  sharers (buildInvariantedType, structuralWrap — blanket copy loops)
  are made explicit as part of C5.2a. The C3.1 boundary oracles carry
  over unchanged.
- **R2 (D39 scope):** C5.2 dissolves `__members`/`__extends` ONLY.
  Descriptor-internal fields (name/value/getter/fieldType), `__name`,
  `__construct`, proof/effect fields, and the nominal walk's name-string
  parent comparison stay until C6 (D39's field tables are C6's
  checklist). Explicit non-goals: instance field storage stays
  string-keyed (symbol-keyed members carry the base-name projection for
  instance reads); pattern matching stays on strings by design (D30's
  loose path).
- **R3 (conformance flip + ordering):** sub-chunk order is a → b → c
  with the declared-conformance flip LAST — draw-from must exist before
  accidental matching is removed, or no interface check could ever be
  true. The flip's test/doc migration (CLAUDE.md examples,
  interfaces.alg, the interface test block; duck-typing migrates to
  `~T`) is pre-approved per this briefing. Honest residue: retroactive
  conformance of built-in types to user interfaces needs partial type
  declarations (D30) — until that surface exists, `~T` is the
  duck-typing path for core types.
- **R4 (qualification syntax):** `x[ns.name]` DEFERRED to the
  surface-syntax chunk (it collides with bracket indexing; nothing
  in-tree can produce two same-named member symbols until draw-from
  ships). Ambiguity lands as a detected error; the symbols.ts error
  message is fixed to stop promising the unshipped syntax.
- **R5 (kernel scope):** hardcoded operator/member names (add, toString,
  get, …) register under one kernel scope FQN in C5.2a; string entry
  points project into it deterministically.
- **R6 (unions):** carved out explicitly — makeUnionType stays outside
  member storage (dispatch via direct bindings) and re-derives at C6
  (D39: `__union` → Type.variants).

## 7. Backlog impact (input to the rebuild)

Absorbed/dissolved by this plan: variance + type constraints (→ S5,
knowledge on type-values), packed Bits structures (→ S4 follow-on),
multiple inheritance + NominalType-as-mixin (dissolved by D40 draw-from),
`ctx_use` phase-specific resource declarations (retired by C2.3),
memoization-as-Standard-feature (re-evaluate after Phase 4 perf data).
Unaffected tracks (grammar Phase 8, PCP H5–H7, website loop, codegen)
carry over as-is. The rebuilt BACKLOG mirrors this plan's phases as its
"current arc" section.

## 8. Doc-update checklist

- `docs/design/allegretto/structures.md`: status tags flip per section as phases land
  ([designed] → [partial] → [implemented]); deviations recorded same-commit.
- `docs/design/standard/type-system.md`: meta-property registry updated per C1.1
  (the registry module becomes its implementation); shape/knowledge section
  after Phase 3; kind recipe after Phase 6.
- `docs/design/standard/effects.md`: effect-channel + Effect-re-derivation deltas
  (C1.5, C6.2).
- `docs/CHANGELOG.md`: entry per chunk. `docs/backlog.md`: rebuilt on plan
  approval, then ticked per chunk.
- `CLAUDE.md`: architecture map updates at phase boundaries (esp. Phases 2
  and 4); invariants section gains the boundary-lint rule at C1.3.
- This plan: status → active on approval; chunk log appended as landed.
- **Expected Tier-0 touch-ups** (flag for dedicated maintainer-ratified
  commits when their chunks land): PROCESS §6's evaluator-invariant
  bullets reference mechanisms this plan deletes — the lazy-primitive
  `primaryOf` bullet and the `*_attach` peeler/TailCall bullet die at
  C1.5; the `__genericParams`/`__effectVarParams` clone-preservation
  bullet is superseded at C5/C6. Each is a propose-and-ratify edit, never
  bundled silently.
