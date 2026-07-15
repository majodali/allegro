# Structures unification — implementation plan

> Status: **active** (maintainer approved Phase 0 start, 2026-07; per
> PROCESS §3 each subsequent phase needs its own go-ahead).
> Design: `docs/design/allegretto/structures.md` (decision log:
> `structured-values-unification.md`, D1–D40).
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
discussed first).

### Phase 5 — Symbols + member identity

**C5.1 — FQN symbols.** Interning, scope registration, base-name
projection, serialization by FQN.
*Boundary tests: same FQN ⇒ identity (across module reload); distinct
scopes ⇒ distinct symbols with equal base names; the ambiguity rule fires
identically at import resolution, member binding, and dot access (one test
matrix, three surfaces).*

**C5.2 — Symbol-keyed members + draw-from.** Type members keyed by
symbols; declared-context draw-from binding; multi-bind (diamond) support;
multiple-distinct-match error; `~`/pattern matching stays on base-name
projection.
*Boundary tests: declared-conformance vs loose-path separation (a
same-named member from an undeclared context does NOT satisfy an
interface check; `~T` still matches it); diamond multi-bind dispatches to
one implementation through both symbols.*

### Phase 6 — Kinds + validation (the exit criterion)

**C6.1 — define-a-kind recipe.** Standard-layer recipe: instance-member
declarations, declared instance order, constructor authority via channel
capability, operator-minted anonymous instances. `Type : Type` fixed point
verified.

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
2. `primaryOf` strip behaviors in eager primitives → propagation table
   (C1.5); lazy-registration workaround removal for proof/typed prims
   (C1.5).
3. `*_attach` wrapper peeling tests (`findAttachWrapper` family) →
   writer/table equivalents (C1.5).
4. `scopePredicates` mutate-and-pop internals → facts plane (C2.2;
   observable behavior should be identical — internals-shaped tests only).
5. `type` component reads split into shape/knowledge (C3.1) —
   introspection output format changes.
6. `pure subtypeof Effect` → false; `instanceof` becomes the check (C6.2).
7. `buildEffect` per-instance member copying deleted (C6.2).
8. `NominalType` alias: retained through Phase 6, retirement decided with
   the maintainer at C6.3.

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
- `docs/CHANGELOG.md`: entry per chunk. `BACKLOG.md`: rebuilt on plan
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
