# Allegro — Backlog

> Tier 2. **One list, implementation order.** Layer/track tags and
> milestones (M1–M10) are defined in `docs/design/layers.md`; boundary
> contracts live in each layer's `docs/design/<layer>/README.md`. Items
> carry stable IDs (`B-###`) — reference them from commits, plans, and
> CHANGELOG entries; IDs never change meaning even when the list reorders.
> The **head** is sequenced; the **tail** is banded by layer/track in
> spine order and not yet sequenced. Completed work moves to
> `docs/CHANGELOG.md` — it does not accumulate here. The v1 feature set
> awaiting disposition through the rewrite lives in `V1-INVENTORY.md`.
>
> **Revalidation-register items** (tagged `[reval]`) carry v1 design whose
> only record is an archived plan (`docs/plans/archive/README.md` has
> the triage record). Working one means: read the archived source,
> revalidate against `docs/design/allegretto/structures.md` and the code,
> then incorporate into the named target doc or discard with a note here.

## Sequenced head

Implementation chunks reference `docs/plans/structures-implementation.md`
(status: **complete** — Phases 0–7 landed; M1 exited 2026-08).

**Current tranche sequence (maintainer-ratified 2026-08):**
- **Tranche A — M1 closeout (docs):** B-002 (appendices + archive the
  decision log), B-031 (primer verification + bench re-baseline),
  B-003, B-004.
- **Tranche B — kind-tower residue (chunk C7.2):** LANDED 2026-08 —
  GenericType through the recipe (`__isGeneric` retired, `params`
  declared, applier collapsed into `construct`); symbol-fresh `distinct`
  + reserved `construct` spec key (post-hoc `constructor` meta-method
  removed); `Param.effectVar` declared structure (`__effectvar:` markers
  + `__effectVarParams` side table deleted). D39 residue zero; rulings
  R1–R3 (plan §4) maintainer-ratified 2026-08 (R1 amended: deferred
  public surface, not kernel privacy). See CHANGELOG.
- **Tranche C — COMPLETE 2026-08.** B-027 equality + lawful interfaces
  closed (plan `equality-and-laws.md` closed; E-R1–E-R6 ratified and
  indexed in the decision register; chunks E1–E4 landed; residue →
  B-089). S3 visibility (D41–D43 — B-097) COMPLETE 2026-08 (plan
  `visibility.md` closed; all four chunks landed, forgery E live).
  B-028 completion effects COMPLETE 2026-08 (plan
  `completion-effects.md` closed; F1–F4 landed, D16/D31–D34 executed).
  B-018 totality reval COMPLETE 2026-08 (`totality.md` landed; T-R1–T-R6
  ratified; follow-ons routed to B-099 and B-087). M4 reval docs ride
  between chunks — B-014 contracts reval COMPLETE 2026-08
  (`contracts.md` landed; CT-R1–CT-R6 ratified; follow-ons routed to
  B-057, B-099 and B-101). **B-029 (PCP) remains** in the reval line.
- **Track R — public release (started 2026-08, runs alongside
  functional tranches):** positioning plan `release-track.md`
  (differentiator map + claims register + demo ladder); VISION §1a/§5
  amendment (three moves, substrate/surfaces, claims discipline —
  Tier-0, pending ratification). Items B-090–B-093 below. The ladder's
  higher rungs feed functional sequencing (constraint/units substrate,
  solution finding) rather than competing with it.
- **Parked consciously:** B-098 (predicate propagation onto residuals,
  awaiting use cases; renumbered from a duplicate B-087 at the 2026-08
  groom), full
  `ContextValue`→`StructureValue` reference migration (opportunistic),
  perf hard threshold (maintainer decision, any time).

### Parallel lanes (maintainer-ratified 2026-08)

Work proceeds in **lanes** that may run in separate sessions
concurrently. Lane membership is decided by the files an item edits, not by
its layer tag: two items share a lane when they edit the same files.
The grouping below comes from co-change measurement over the last 40
`src/`+`lib/` commits (CHANGELOG 2026-08), not from the layer spine.

| Lane | Contents | Concurrency |
|---|---|---|
| **A — reval docs** | ~~B-014 contracts~~ (COMPLETE 2026-08), then B-029 PCP; B-030/B-051 sweeps last | Runs anytime. Creates NEW `docs/design/standard/*.md`; touches no `src/` |
| **B — suite split** | ~~Break up `src/test.ts` (12,281 lines, in 88% of source commits)~~ **DONE 2026-08** — `src/test/`, 21 modules behind a thin index | **Lane C is open** |
| **C — capability tracks** | T-tooling (B-064/065/067, B-102, B-103), T-host (B-070/071), T-backend (B-072) | **Opens after B.** Mostly new files over stable public surfaces |
| **D — L2 semantics** | B-089, B-100, B-099, B-101, B-046, B-047, B-050, and the rest of the Standard band | **Internally serial, permanently** — these converge on `types-std.ts` / `primitives.ts` / `evaluator.ts`. One item at a time |

**What lane B unlocks:** C and D may then run *as lanes in parallel
with each other* (C touches new/track files, D the L2 monoliths — a
disjoint set once the suite is no longer shared). It does NOT make D
internally parallel; that coupling is architectural, and no tooling
change removes it.

**Lane B landed 2026-08** (CHANGELOG "The suite splits"). The suite is
`src/test/`: one module per area behind an index that registers nothing.
A lane-D session working `effects.ts` and a lane-C session adding a
tooling test now edit different files. Two follow-ons were filed rather
than absorbed: **B-103** (a registration-count check in CI) and **B-102**
(retire the dead `src/test.ts` entry in `SCAN_EXCLUDE`). *(Lane B filed the
first as B-101, colliding with lane A's B-101 — the two lanes minted the
same id concurrently. Lane A keeps it: its number is cited by ratified
CT-R3/CT-R5 rulings in `docs/decisions.md`, so it is the one that cannot
move. Renumbered here 2026-08.)*

**Gate policy per lane** — A, B and C run on **pre-ratified chunk
sequences**: the maintainer approves the chunk list once at the start of
an arc, and the lane lands them in order without stopping between each.
**Lane D keeps the per-chunk gate** (PROCESS §3): land, summarize, stop.
Everything else in the landing checklist is unchanged for every lane.

**Before starting in any lane** (PROCESS §7): check open PRs for
overlapping work. Sessions run in separate containers with separate
clones and cannot see each other's uncommitted work, so a collision
surfaces only at merge — the lane boundaries above are the mechanism
that prevents it.

- [x] **B-001** · L0 · Boundary-test harness + baseline (chunk C0.1):
  accessor lint w/ ratchet, invariant property checks, forgery-suite
  skeleton, perf floor — plan §Phase 0. Landed 2026-07
  (`src/boundary-tests.ts` + `src/boundary-baseline.json`); perf hard
  threshold still a pending maintainer decision (warn-only at 2×)
- [x] **B-002** · L0 · docs: inline the D39 slot-disposition, B8 primitive
  audit, and B10 forgery tables into `docs/design/allegretto/structures.md`
  as appendices; then archive `structured-values-unification.md`. Landed
  2026-08 — Appendices A–C added; decision log moved to
  `docs/plans/archive/structured-values-unification.md` (triage row in
  `archive/README.md`)
- [x] **B-003** · L1 · `[reval]` docs: sync shipped extension error codes +
  base-chain semantics into `docs/grammar-formalism.md` §6–7 (decisions:
  `docs/design/extension/grammar.md` §4; source:
  `docs/plans/archive/dappled-cascading-cantor.md`). Landed 2026-08:
  §6.2 base-chain compatibility, §6.2 `use` activation surface, new §7.5
  shipped-diagnostic-codes inventory
- [x] **B-004** · L2 · `[reval]` docs: effects nits — silent-capture
  rationale for explicit `[e: Effect]` into
  `docs/design/standard/effects.md` §2; `applyComposed` tracing hypothesis
  (archive: polyphonic-tracing-plotkin P9) filed or dropped. Landed
  2026-08: rationale added to §2 Declaration surfaces (incl. shipped
  opaque-auto-promotion deviation from the plan); P9 recorded in §6 as
  resolved — validated by construction by PE-driven inference (Slice 2
  F1–F3), no separate research piece remains
- [x] **B-005** · T-tooling · CI: typecheck + full suite on push. Landed
  2026-07 (pulled forward per maintainer, suite-cost discussion): the
  TS2300 duplicate imports and TS2304 `ExpressionValue` errors are FIXED;
  `scripts/typecheck.sh` is the sanctioned invocation (fails on
  everything except the documented TS6059 bench/pcp/scripts rootDir
  convention; negative-tested); `.github/workflows/ci.yml` runs
  typecheck + `npx tsx src/test.ts` on push/PR. Same landing: suite-cost
  pass — registry corpus walk piggybacks on the .alg file tests
  (156s → ~0), per-test/per-section timing in every summary,
  `ALLEGRO_TEST_FILTER` dev tier (8s targeted runs; floor suspended,
  DEV RUN banner)
- [x] **B-006** · L0 · Slot & channel registry + typed accessors (C1.1).
  Landed 2026-07: `src/slots.ts` (D39 table as code, 56 registrations),
  W3 registry-completeness invariant + corpus walk, accessor smoke tests.
  Three slots not in D39's table were reviewed with the maintainer and
  ratified 2026-07 (D39 addendum in structures.md): `__effectBound` →
  member dissolving at C6.2; `exported` → scope-binding visibility (S3,
  Phase 2); `arity` → deleted (write-only, removed from
  wrapAsUntypedFunction)
- [x] **B-007** · L0 · Accessor migration, core files (C1.2). Landed
  2026-07: evaluator.ts + types-std.ts fully migrated (~250 sites,
  both files at zero lint violations; ratchet 738 → 500), write-side
  accessor shims + SLOT_KEYS constants added to slots.ts; types.ts was
  already clean. 986/986 green — zero behavior change
- [x] **B-008** · L0 · Accessor migration, rest + lint hard-fail (C1.3).
  Landed 2026-07: all 12 remaining files migrated (~360 sites — 222
  mechanical `dataOf` renames + ~100 reviewed individually); every
  production file at ZERO violations except sanctioned `src/slots.ts`;
  `hardFail: true` — direct slot access outside the accessor layer now
  fails the suite (negative-tested). The base/extension boundary is
  mechanically enforced from here on
- [x] **B-009** · L0 · Channel writers — origination capabilities +
  forgery suite v1 (C1.4). Landed 2026-07: one-shot channel registry
  (epoch-sealed), kernel-private discharged writer at the two origination
  sites, construction-path gates (object literal, mv_set),
  `channel_register`/`channel_read`/`channel_list`/`channel_attenuate`
  primitives, forgery A/B/D/F live (A was a REAL hole — object-literal
  `{__discharged: 1}` forged a structurally-valid proof pre-C1.4)
- [x] **B-010** · L0 · Propagation table; `primaryOf` asymmetry +
  `*_attach` family; forgery suite v2 (C1.5) — first conscious-delta
  chunk, landed 2026-07 in two halves. C1.5a: deltas ruled + differential
  fixtures + table-driven viral scan + channel-aware mode (6 proof prims
  flipped; proof_check reclassified genuinely-lazy) + forgery C live.
  C1.5b: five-wrapper `*_attach` collapse — `collapseBodyMetadata` pass in
  evalSource stashes body-form metadata as host-internal function
  properties (clone-preserved via `PRESERVED_FN_META_KEYS`); all analyzers
  read properties; `findAttachWrapper` peeler family deleted; wrapper
  prims retained as inert passthroughs (defense). Peeler-shaped tests
  reworked to collapse-equivalents per ruling
- [x] **B-011** · L0 · Scope protocol + parent chain (C2.1). Landed
  2026-07: `src/scope.ts` (scopeNew/scopeExtend/scopeLookup/
  scopeBindings + chain-aware compile-mode and predicate reads),
  `parent`/`isScope` host-plane fields on ContextValue, chain-walking
  Symbol lookup, O(1) child layering at the unification enrichedCtx site
  (was a full flatten-copy per call), scope/structure mutual plane
  rejection (type_dispatch guard + shape-carrying-parent rejection),
  boundary tests (structural O(1), 2000-layer chains, shadowing).
  Root-eval-ctx layering (buildEvalCtx) deferred to C2.3 where its flat
  consumers (REPL, module extraction, forward chaining) get unified
- [x] **B-012** · L0 · Facts plane via `scope_assume` (C2.2). Landed
  2026-07: `scopeAssume` pushes immutable fact layers (child carries only
  new facts; parents never copied/mutated; branch exit = discard);
  `scopeFactsFor` merges across the chain rootmost-first (reproducing the
  former copy-then-merge byte-identically); `scopeOwnFacts` for assert/
  requires same-scope accumulation; entailment binding lookups made
  chain-aware; `.scopePredicates` opacity lint (scope.ts only)
- [x] **B-013** · L0 · Resolution unification; retire `ctx_use`;
  unresolved-binding-as-future-cell (C2.3). **C2.3a landed 2026-07**:
  `ctx_use` primitive deleted (zero consumers found anywhere) and
  `Binding.isUse` retired to optional. **C2.3b landed 2026-07** (Phase 2
  complete): the Binding IS the future cell (`value`/`incompleteDeps`/
  `isComplete`; registry shares the source layer's objects — no
  `currentValue` mirror, no dual writes; applyPhase resolves in place);
  buildEvalCtx builds a real scope chain (primitives ← extensions ← base
  ← source, source layer returned) with `scopeAllBindings` flatten for
  REPL persistence + resolveSymbols; unprovided imports get pending cells
  (absent vs unresolved distinguishable); `ctx_resolve` unified on
  residualising semantics (absent → error value, pending → residual —
  never a throw); `Binding.isUse` deleted with all literal sites;
  chain-aware `__futureManager`/proven-type lookups; 6 boundary tests
- [x] **B-014** · L2 · `[reval]` Contracts design revalidation —
  COMPLETE 2026-08 (`docs/design/standard/contracts.md`; CT-R1–CT-R6
  maintainer-ratified as recommended, indexed in the decision
  register). Original scope: predicate-set model, branch
  refinement, assert/requires/ensures lowering, sink-based checks,
  invariant inheritance, `assume` rejection + constructor pattern,
  refinement-vs-contract guidance (sources:
  `docs/plans/archive/lucid-discharging-lambek.md`,
  `docs/plans/archive/crystal-proving-curry.md` §Phase C; substrate:
  structures.md §4/§6) — natural slot: with Phases 2–3.
  **Doc delivered 2026-08** (`docs/design/standard/contracts.md`, lane
  A): the predicate model restated as the D36 knowledge lattice (two
  carriers, meet at the check), the lowering chain recorded as it
  shipped (marker prims → tree-builder contract preprocessor, not the
  planned let-wrapper), invariants-as-refinements replacing the deleted
  `Type.invariant` fluent API (D45) with inheritance restated over D44,
  and the mechanism-choice guidance the sources never wrote down.
  Sink-based checking split into discharge (shipped via PE) and
  relocation (not shipped); `assume` found never actually rejected —
  it is D34's admitted tier, with `assume_invariant` the one path that
  trusts silently. **CT-R1–CT-R6 ratified as recommended 2026-08** and
  indexed in `docs/decisions.md`. Follow-on implementation routed:
  CT-R1/CT-R3/CT-R6 → **B-057** (scope settled per this item);
  CT-R5 + the `assume_invariant` retirement → **B-101** (new);
  CT-R2's contract knobs → **B-099**
- [x] **B-015** · L0 · Shape/knowledge channel split; dispatch on shape
  (C3.1). Landed 2026-07: `typeShape` walk (member-transparent refinement
  layers = knowledge, identified by parent-member-set object identity;
  preserveOps/mixin/extend layers = shapes); `shape` channel reads the
  computed dispatch shape, `type` stays the raw stored view; `knowledge`
  channel + `knowledgeOf`/`knowledgeDomain`/`meetKnowledge` unified
  intrinsic carrier (bound + domains + predicates, one lattice);
  type_dispatch + evaluator operator dispatch read shape; `withType`
  refuses cross-shape re-stamps (typed_* literal wrappers are
  construction points via `withTypeReplacing`); 6 boundary tests. §6
  delta 5 (introspection format) not activated — deferred to the C3.2
  briefing
- [x] **B-016** · L0 · Annotations as knowledge bounds; narrowing; carrier
  meet (C3.2). Landed 2026-07: occurrence `bound` component stamped at
  annotation boundaries (call sites via applyComposed, returns + binding
  annotations via type_check; named nominal concrete types only;
  own-shape crossings reset), member-visibility gate in type_dispatch
  (shape dispatch preserved — Liskov; Object/module open types exempt),
  `when … is T` narrowing for Symbol subjects (scope shadow) AND
  substituted-param subjects (clone-on-write identity replace),
  knowledgeOf.occurrenceBound + three-source knowledgeDomain meet
  (intrinsic survives looser annotations). Delta 5 activated
  additive-only (`bound:` introspection line). Demo + 4 boundary tests;
  website "Knowledge Bounds" example. Deferred (recorded in structures.md
  §6): operator visibility, downcast gating, record-field openness
- [x] **B-016a** · L1 · S3 access-control design session — held 2026-07,
  outcome ratified as **D41–D43** (decision log) + structures.md §6
  pipeline / §13 rewrite. D41: mediated member protocol — one PE act,
  four stages (project → availability → mediate via
  `getMember(symbol, instance, context)` → dispatch); getMember never
  does name resolution; PE folds static mediation. D42: evidence is
  possession — evaluator-supplied reachability-capsule contexts, symbol
  reachability as the default test, wire rule (foreign FQNs rebind
  against exported registries only), D24 closures as the stronger tier.
  D43: modifiers as extensible per-kind member attributes; non-pure
  mediation allowed but effectful (effect calculus covers it); most
  resolvers are pure possession checks. Implementation rides C5
  (symbols) + C6 (default mediator, modifier vocabulary in the kind
  recipe); surface-syntax defaults (public-by-default, names-public)
  proposed, decided at the surface chunk. C3.3 unblocked
- [x] **B-017** · L0 · Observation effect; pure recheck vs certificate
  peek; congruence tests (C3.3). Landed 2026-07 (Phase 3 complete):
  instanceof on member-transparent refinements = pure predicate re-check
  (recursive chain; fixes the congruence violation where
  `5 instanceof PositiveInt` was false while the tagged twin was true);
  preserveOps shapes stay nominal (typeShape boundary);
  `certificate_peek(v, T)` new channel-aware primitive with the
  "observe" effect label (provenance question — distinguishes §7-equal
  values, priced by the effect calculus; `effects pure` + peek fails);
  congruence + equality-ignores-knowledge boundary tests (D37
  groundwork); demo + sandbox example
- [x] **B-018** · L2 · `[reval]` Totality design revalidation —
  COMPLETE 2026-08 (`docs/design/standard/totality.md`; T-R1–T-R6
  maintainer-ratified as recommended, indexed in the decision
  register). **Doc delivered 2026-08**:
  the reval of `phase-e-totality-plan.md` against the post-B-028 system
  — severity reconciliation ruled (strict binds at discharge accounting
  + contracts; info stays the migration default for UNDECLARED code;
  the flip is per-project config), exhaustiveness taxonomy (shipped
  tier + designed closed-sum/record/dead-case targets), mutual
  recursion (all-edges-decrease ratified over the archived common-lex
  requirement), totality polymorphism (subsumed by div-as-effect —
  `[t: Totality]` markers discarded), decreases obligations and
  counterexample shapes recorded as shipped. T-R1–T-R6 ratified as
  recommended; the D34 register row now points at the reconciliation,
  and the V-R / CE-R / T-R ruling families are indexed in
  `docs/decisions.md` per its own gate-pass rule. Follow-on
  implementation routed: T-R2 → **B-099** (project severity config);
  T-R6 → **B-087** (divergence-aware inlining cutoff)
- [x] **B-019** · L0 · Structure kind — representation swap behind
  accessors (C4.1). Landed 2026-07: one host class (`src/structure.ts`)
  behind makeMultiValue/makeContext (factory shims; 6 bypass sites
  converted); single declared hidden class for both roles + scope fields
  (~7% faster than the replaced literals); role fixed at construction;
  D22 immutable bit declared (scope/future-cell/construction carve-outs
  asserted); W4 structure-kind + W5 role-transparency corpus invariants +
  3 boundary tests (roles, hostile channel-named data keys, monotonic
  cell resolution). Physical plane separation + shape-ref field follow
  inside structure.ts at C4.3/C5
- [x] **B-020** · L0 · Arrays as numeric structures w/ dense region
  (C4.2). Landed 2026-07: dense region is the SOLE element storage
  (makeRawArrayCtx → makeDenseArrayCtx; no per-element Bindings, no
  string keys, no __length binding; count = dense.length cached);
  bindings/bindingList accessor-backed with lazy legacy view (immutable
  arrays ⇒ cache-once); ~10 sites migrated to indexGet/elementsOf/
  dense-aware getSlotCount; slot probes answer dense structures without
  materializing; W6 view-coherence invariant; O(1) scaling + duality
  boundary tests; existing array suites as differential oracle; ~3%
  faster on the A/B workload
- [x] **B-021** · L0 · Transparency cutover; retire `primaryOf` + wrapper
  shims (C4.3) — second conscious-delta chunk. Briefing ratified 2026-08
  (rulings R1–R6, plan §6). **C4.3a**: merge-policy activation — error
  virality rides every residual hop (incl. unresolved application +
  type_dispatch residuals), error-in-if-cond propagates, effects union
  on MultiValue re-evaluation; three differential-fixture expectations
  updated (pre-approved). **C4.3b**: MV-over-Context flattened —
  makeMultiValue derives copy-on-write for Context primaries
  (`deriveWithChannels`, given map authoritative); typed records/arrays/
  modules/proofs answer Context with channels riding directly; type
  bindings ARE the internal singletons (wrapType identity); getType
  total; channel accessors + ~20 kind guards widened; W-invariants
  reframed per R5. **C4.3c**: transparency at the eager boundary —
  applyPrimitive no longer strips args (impls receive full values, read
  via dataOf/asBits); `channelAware` mode deleted (universal default);
  lazy is purely evaluation control; `primaryOf` name retired (dataOf is
  THE accessor). Typed scalars keep the MultiValue tag per R6 (means
  "transparent scalar structure"; retirement expected at C6). All landed
  2026-08; 1033/1033 green
- [x] **B-022** · L0 · FQN symbols: interning, registration, projection
  (C5.1). Landed 2026-08: `src/symbols.ts` substrate — FQN interning
  (same FQN = same object across reload/loader instances), D42 export
  partition (wire rebinds ONLY against exported registries; private/
  unknown FQNs resolve to nothing, mint nothing), FQN serialization,
  and the §5 ambiguity rule as one resolver (`projectBaseName`,
  multi-bind target dedupe, qualification narrowing) verified identical
  across the three surface framings. evalSource registers top-level
  bindings under the defining scope (module path / `<main>`);
  SymbolValue gains optional `fqn`; parser symbols stay transient.
  Surface adoption (member binding, dot access, `x[ns.name]` syntax)
  lands with C5.2
- [x] **B-023** · L2 · Symbol-keyed members + draw-from binding; diamond
  multi-bind; ambiguity rule (C5.2). Briefing ratified 2026-08 (rulings
  R1–R6, plan §6). **C5.2a**: member sets symbol-keyed (FQN string
  keys, kernel scope, one addMember write chokepoint, projection at the
  read chokepoints); typeShape sharing invariant intact (implicit
  sharers made explicit); makeTypedBinOp typeShape pre-fix;
  memberDescriptorsOf projection view. **C5.2b**: draw-from binding —
  drawMemberKey at construction (match→bind drawn symbol,
  none→type-local scope, distinct targets→error); overrides keep member
  identity; lookup generalizes (kernel fast path + base-name scan +
  access-surface ambiguity); preserveOps meta-copy wart fixed.
  **C5.2c**: the declared-conformance split (the ratified conscious
  delta) — interface checks are symbol-identity membership (declared by
  drawing, e.g. `HasXY.extend`), `~T`/anonymous stay base-name
  (structuralWrap erases the interface marker); interfaces.alg /
  typed-types.alg / CLAUDE.md migrated per pre-approval. All landed
  2026-08; 1046/1046 green. Residue: retroactive conformance of
  built-in types to user interfaces waits for partial type
  declarations; `x[ns.name]` qualification syntax deferred (R4)
- [x] **B-024** · L2 · define-a-kind recipe; constructor authority;
  `Type : Type` fixed point (C6.1) — C6.1a landed 2026-08: unified
  conformance (nominal walk deleted), `__extends` → `__refines` with
  writers narrowed to refinement, name-stable per-type member scopes,
  `Type.define(spec, ...bundles)` replacing `extend`. C6.1b landed
  2026-08: Refinement + Interface as kinds (half-lotus battery green),
  `construct` authority + call-as-function at every level, fluent API
  removed (`&` mint absorbs where/invariant; Interface.define;
  method-valued define entries + bundles absorb mixin; Refinement
  spec's `preserve` absorbs preserveOps). In-chunk decisions
  maintainer-ratified: override-on-draw (with the order ruling —
  bundle order not significant, explicit-conflict error resolved by
  spec declaration), Refinement spec reserved keys, kind-hood =
  conformance to Type (no reified Kind, no convention). Residue:
  `distinct` / `constructor` kind-spec designs deferred with sketches
  in structures.md §9; `__invariantsList` slot swept in C6.3
- [x] **B-025** · L2 · Effect re-derived through the recipe; anonymous
  conjunctions; `pure subtypeof Effect` flip (C6.2) — landed 2026-08:
  Effect is a kind by construction (draws Type's kind API); instances
  ARE their label sets (memoized — label-set identity is physical
  identity); member copying + refines hack deleted; `io & time` mints
  anonymous instances; `pure subtypeof Effect` false / `instanceof`
  the check; `__effect_kind` slot retired. Residue for C6.3:
  `__effectvar:` markers / `__effectVarParams` disposition
- [x] **B-026** · L2 · Proof re-derived (kernel-private authority);
  slot-disposition sweep; forgery battery re-run (C6.3) — landed
  2026-08: Proof is a kind by construction with declared instance
  fields (D39 proof rows executed; `t.proposition` dispatches);
  constructor authority kernel-private (no `construct` — makeProof +
  discharged writer is the only mint; forge battery green through
  define / call / bundle-draw / literal); `__invariantsList` swept;
  MemberType deleted. Registered residue pinned to future owners:
  `__isGeneric` (GenericType re-derivation), `__effectvar:` /
  `__effectVarParams` (function-type generic params). MultiValue-kind
  + NominalType-alias decisions presented to maintainer — **M1 exit
  criterion**
- [x] **B-088** · L0 · C7.1 — MultiValue retirement (D15 execution;
  D46). Landed 2026-08: transparent-structure carrier replaces the
  MultiValue kind (`isCarrier` by primary presence);
  `ValueKind.MultiValue` deleted (~120-site compiler-driven audit +
  the two hazard classes tsc can't see: duplicate switch cases,
  string-literal kind comparisons); `ValueKind.Context` →
  `ValueKind.Structure` (D25 completes; ContextValue transitional
  alias); NominalType retired; W1/W5 restated; CLAUDE.md seven-kinds
  reframe. The original MultiValue/Context-collapse thesis is
  COMPLETE
- [x] **B-027** · L2 · Equality protocol + lawful interfaces — plan
  `equality-and-laws.md` (chunks E1–E4); E-R1–E-R6 maintainer-ratified
  2026-08. Landed 2026-08 (all four chunks): kernel structural equals +
  shape resolution (E1); declared coercions + least common type (E2);
  law members + for_all + D34 discharge tiers + Equatable + the E-R5
  purity gate (E3); admitted tier + the proof_trans strict gate + E-R6
  proof tier recording (E4). Follow-ons registered as B-089
- [ ] **B-089** · L2 · Lawful-interface follow-ons (B-027 residue):
  `Ordered` as law-mechanism instance #2
  (antisymmetry/totality/consistency-with-equals — mechanism generality
  already validated by Equatable + user laws + refinement laws, so this
  is a consumer, not a validation gate); `Monoid`/`Semiring`
  (cross-operation distributivity); witnessed-tier structural
  proposition-matching for quantified propositions; `assume law` /
  `law NAME:` statement sugar; sampled tier for record-domain
  quantifiers (instance construction); `distinct` newtype law
  obligations; proof-plane `proofValEqual` unification with protocol
  equality; further strict gates from the §6 pre-approved queue
  (`Ordered` totality for sorts)
- [x] **B-094** · L0 · Source channel — ASTs as channel payload
  (structures.md §3.1, D47 RATIFIED 2026-08). **Chunk 1 landed
  2026-08**: sourceAware registration + evaluator call-site attachment
  + binding-level attachment (non-Structure data) + drop rule +
  integrity gating (mv_set refusal, component_get key block) +
  observe-tagged `source of` returning rendered text
  (renderExprSource) + 7-test battery. Chunk-1 rulings: text at the
  read surface (quote carrier deferred), Structure bindings deferred
  (identity audit), residuals skipped. **Chunk 2 landed 2026-08** (B-094 CLOSED):
  migration reality recorded (§3.1 amendment — proof entry points are
  lazy NON-VALUE INTERPRETERS; the lazy-for-AST class was already
  empty post-C4.3c) + `explain` reference consumer (eager sourceAware
  registration, observe-tagged) + halt-not-residualize regression.
  Residue for rung-2 planning: inert quote carrier (user-level AST
  values), Structure-binding attachment (identity audit), attachment
  on completion-replacement. Superseded scope note (original chunk-2
  sketch):
  source-aware primitive registration + evaluator attachment at
  meta-function call sites; kernel-private writer, `drop` propagation,
  observe-tagged reads, `source of x` surface; migrate
  `proof_check`/`proof_by_eval`/combinators from lazy to eager
  source-aware; boundary battery (forgery: doctored-source display
  divergence; equality ignores source; pure-code read refusal).
  Opens AST access to user-level meta-functions without grammar
  productions
- [x] **B-097** · L0/L2 · S3 visibility arc (D41–D43) — own plan
  `docs/plans/visibility.md` (closed): mediated member
  pipeline (kernel default mediator; fallbackMember 3-ary with the
  evidence capsule), scope-binding visibility attribute (the
  `exported` stopgap + `y = x` wart die), private members via
  `private(...)` descriptor attributes, bespoke-reader closure
  (destructuring/print/conformance/reflection per V-R6/V-R7),
  forgery E live. V-R1–V-R8 + forgery-E criterion RATIFIED 2026-08
  (PR #14, as recommended). **V1 (visibility substrate) landed
  2026-08**: Binding.visibility, export migration off the value plane
  (aliasing wart dead), explicit open-module policy. **V2 (pipeline
  unification) landed 2026-08**: one dispatch ladder (shadow copy
  deleted, meta path gated), operator dispatch through the shared
  availability gate, 3-ary fallbackMember with the evidence capsule,
  hook effects propagate, typeMethod fallthrough narrowed. **V3
  (private members — the flip) landed 2026-08**: `private(...)` /
  reserved `readonly(...)` combinators → descriptor attributes;
  kernel mediation with dispatch-planted privilege layers (the D42
  possession test on the C2 chain); private symbols type-local (draw
  denial, no propagation); destructuring/printer/conformance closed
  per V-R6; reflection names-free/accessor-gated per V-R7. **V4
  (evidence hardening + release) landed 2026-08 — ARC COMPLETE, plan
  closed**: forgery E live (last D21 skeleton retired — unexported
  writer refused through dot access, flat injection, and the wire;
  the ocap discipline is language-enforced), capsule
  redaction/non-fabrication in the boundary battery, D41 stages-3–4
  confluence harness, design docs synced (structures.md,
  type-system.md §3, modules.md, language-reference), D41–D43 marked
  EXECUTED in the register. Riders with named owners: keyword syntax
  B-043, readonly B-046, sync/async B-047, internal/protected
  reserved (V-R3), downcast refusal (C3.2 deferred list). Website
  visibility example: owner decision at the arc gate
- [x] **B-028** · L0 · Completion effects & futures — COMPLETE 2026-08
  (plan `completion-effects.md` closed; CE-R1–CE-R8 ratified; F1
  substrate PR #24, F2 typed futures PR #25, F3 div flip PR #26, F4
  guarded projection + release). `div` rides the effect calculus with
  D34 tiers verdict-visible; `Future[T]` typed with both boundary
  seams; `is_resolved` under `sched` with per-source liveness axioms;
  D32 guard live end-to-end (tri-state construction, guarded
  projection with error-propagating failure arm, invariant div gate,
  arrival-order confluence via completion replacement + deferring io).
  D16/D31–D34 EXECUTED in the register; structures.md §10 stamped.
  Riders with named owners: sync/async modifiers B-047; algebraic
  effects B-048; resource budgets/`ResourceExhausted` D35 (deferred by
  its own terms); severity config + `total`-by-default flip B-018;
  `select`/cancellation/timers — mint at need; `Future` in interface
  conformance S5/B-050; precompile PE-inlining cutoff for divergent
  non-same-arg recursion (`loop(n+1)` ≈ 43s/compile measured at F4) —
  B-018's analyzer-rework bundle or mint at next totality-perf pass;
  nested-slot completion replacement (recorded §10 residue)
- [ ] **B-029** · L2 · `[reval]` PCP protocol design revalidation →
  `pcp.md` in `docs/design/standard/`: schemas, multi-prover authorship,
  trivial-pass prevention, hints, catalog (H5), budgets/escalation (H7),
  benchmark methodology (source:
  `docs/plans/archive/phase-h-plan.md`; shipping shape `src/pcp.ts`)
- [ ] **B-030** · L2 · M3 sweep: disposition every remaining `TBD` in
  `V1-INVENTORY.md`; re-verify canaries (provable.alg theorems, bench
  corpus, stdlib effects tags)
- [x] **B-031** · L2 · docs: revise `docs/proving-in-allegro.md` to the
  v2 surface (it is the PCP LLM worker's system primer — must track the
  shipping kernel); re-baseline `bench/`. Landed 2026-08 at the
  Tranche A closeout (primer verified current against the v2 kernel
  with an end-to-end smoke of its own examples; `bench/` re-baselined
  — see CHANGELOG "Tranche A docs closeout"); the primer was further
  audited publicly and gained the E3/E4 laws+gate section at B-091
  slice 2. This entry sat unchecked by oversight — closed at the
  2026-08 backlog groom

## Banded tail (not yet sequenced)

### L1 — extension substrate (M2)

- [ ] **B-032** · Grammar extension Phase 8: per-scope `use X in { block }`,
  single-pass `use` with mid-parse expressions, parse-time builder lambdas
  (parser/evaluator reentry); fold in the never-shipped Phase 6 ideas
  (`combine`/`override`/`without`, restricted-`use` whitelist — archive:
  dappled-cascading-cantor)
- [ ] **B-033** · Grammar 2 Phase 7+: indent-engine extensions, full GLL
  left recursion, precedence analyzer, remaining stratified-grammar
  migration
- [ ] **B-034** · Alt-order de-significance + label-directed tree-builder
  (the §2 corrections in `docs/design/extension/grammar.md`) — the parser
  design discussion track
- [ ] **B-035** · Earley parser retirement in favor of `grammar2_*`
- [ ] **B-036** · Parse error recovery (`@error` productions + `@sync`)
- [ ] **B-037** · Embeddable grammars (different parser mid-file/per-module)
- [ ] **B-038** · `modules.md` loading contract (the L1 half of the module
  split); circular-dependency policy
- [ ] **B-039** · Mid-statement grammar switching (low priority)

### L2 — Standard (M3)

- [ ] **B-040** · Qualified import (`import math.round`); re-exports
- [ ] **B-041** · Collections: Map/Set as typed generic structures;
  persistent representations (S4)
- [ ] **B-042** · Scalar type builder (`Scalar(bitLength)`) + packed Bits
  structures (S4)
- [ ] **B-043** · User-defined type declaration syntax (sugar for
  extend/where/distinct/interface — deferred until API patterns settle)
- [ ] **B-044** · Error handling surface (try/catch or channel-consuming
  equivalent — design with S6 error-channel removal rules)
- [ ] **B-045** · Regular expressions (stdlib + literal syntax)
- [ ] **B-046** · Configurable mutability: linear types, transient
  mutation, transient→immutable finalization (structures.md §13)
- [ ] **B-047** · Sync/async type modifiers (async-by-default + `sync`
  hint — revisit under completion effects)
- [ ] **B-048** · Algebraic effects (`perform`/`handle`/`resume`; needs
  continuations — see B-072)
- [ ] **B-049** · Patterns as boolean expressions with unification
- [ ] **B-050** · Variance + type constraints (`where T: Comparable`) —
  absorbed conceptually by knowledge-on-type-values (S5); surface design
  remains

### L2 — provability capability (M4)

- [ ] **B-051** · `[reval]` Roadmap remainder revalidation: D2 parametric
  capabilities, D3 information flow, D4 behavioral budgets, D5 declared
  intent (source: `docs/plans/archive/crystal-proving-curry.md`) —
  revalidate against v2 before scheduling
- [ ] **B-052** · F6 Lean export: proof terms → Lean, refinements →
  subtypes, verified-substrate `Allegro.lean` → `proofs.md` in
  `docs/design/standard/` (source:
  `docs/plans/archive/phase-f-plan.md` §F6)
- [ ] **B-053** · Phase G expansion: provable stdlib rewrite (sort/search
  + algebraic theorems on map/filter/reduce)
- [ ] **B-054** · PCP H5 proof catalog (`proofs.json` per project).
  v1 implementation preserved at branch `archive/v1-references`
  (parent 0546daa, `allegro catalog`) — pre-rework, reference only
- [ ] **B-055** · PCP H6 multi-strategy parallel prover orchestration
- [ ] **B-056** · PCP H7 effort budgets, escalation, reproducibility
- [ ] **B-057** · Phase C polish. **Scope SETTLED at B-014 (2026-08,
  CT-R gate passed)** — `docs/design/standard/contracts.md` §10:
  (a) relocate an UNDISCHARGED `requires` check to the call site, which
  also supplies the call-site origin missing from counterexamples
  (CT-R1 — discharge itself is already call-site-sensitive via PE, so
  this is codegen + diagnostics, not semantics); (b) relational
  predicates (`a < b`) so a two-binding condition narrows rather than
  merely checking; (c) an `assumes` trust-boundary form minted against
  D34's admitted tier with mandatory ledger visibility (CT-R3);
  (d) contracts in the verdict / `obligations` / assumption ledger — an
  undischarged `requires` is a pending obligation and today reaches
  `inspect` only (CT-R6); (e) `ensures` referencing params, not just `_`
- [ ] **B-101** · Predicate-carrier residue cleanup (filed at B-014,
  CT-R5 — **lane D**, touches `src/refinements.ts`): retire the legacy
  single-`domain` component now that predicate sets are the carrier
  (`domainOf`/`predicatesOf` still dual-read it — this was the v1 Phase-C
  Chunk-1 task 6 that never landed); drop or give a producer to the
  `type-invariant` predicate source, reserved and writerless since
  invariants became refinements (D45/C6.1b); retire the `assume_invariant`
  primitive, which has no grammar sugar, no caller anywhere in the tree,
  and attaches a fact without recording it (CT-R3). Unblocked — CT-R3
  and CT-R5 ratified 2026-08. Rides any pass already in
  `refinements.ts`/`primitives.ts`; the physical move of predicate
  storage under the `knowledge` channel remains C4's. Note for the lane
  table: this is **lane D** work, so it queues behind the Standard
  band's serial ordering rather than riding lane A
- [x] **B-058** · Per-project notification-severity config (kind →
  severity remap; substrate shipped in v1) — **SUPERSEDED by B-099**
  (2026-08). Same surface, described twice: B-099 was minted during the
  B-018 close-out without checking whether the item already existed.
  B-099 keeps the work because the ratified design docs point at it
  (`totality.md` §5/§8, decision register T-R2); this row stays as the
  pointer rather than being deleted, since IDs never change meaning

### T-build (M6)

- [ ] **B-059** · Project root file (structure, phases, deps)
- [ ] **B-060** · CLI modes: `allegro build` / `allegro test` (run/verify/
  prove/propose/inspect/obligations exist)
- [ ] **B-061** · Multi-phase build pipeline: design (per-layer
  capabilities per 2026-07 ruling) then implementation; phase-gate checks
- [ ] **B-062** · Typed phase-resource declarations (successor to retired
  `ctx_use` — design with B-013)
- [ ] **B-063** · Tree shaking via partial evaluation

### T-tooling (M7)

- [ ] **B-064** · Execution tracing + step-through debugging
- [ ] **B-065** · REPL improvements (multi-line, error display, completion)
- [ ] **B-066** · Expression-graph processing (query/transform/rewrite)
- [ ] **B-067** · LSP / IDE integration
- [ ] **B-068** · Review UX (v1 "Phase J"): semantic summary as the primary
  reviewable artifact, drill-down to code
- [x] **B-069** · CLAUDE.md slimming completion (history → CHANGELOG;
  session contract only). Landed 2026-08 at B-095 chunk 3: v1-era
  history migrated to CHANGELOG, CLAUDE.md reduced to the K-002
  bootstrap (commands, invariants, pointers). This entry sat
  unchecked by oversight — closed at the 2026-08 backlog groom
- [ ] **B-087** · Totality-analyzer performance: the Stage 2/3 termination
  tests cost ~200s of the suite (one 84s .alg file; a single factorial
  check 42s — profile from the 2026-07 suite-cost pass). Production-code
  change — needs its own verified chunk; also the natural moment for the
  B-018 severity reconciliation if the analyzer is being reworked anyway.
  **2026-08 (B-028 F1) — suspect REFUTED by measurement**: the
  `exhTypeLookup` memo landed (correct, and a prerequisite for div
  inference) but A/B shows ~2% on the 65s decreases demo — the
  per-call-site refinement re-evaluation was NOT the hotspot. The
  remaining cost needs a real profile (likely the demos' own deep
  recursive evaluation, or analyzer work off this lookup path).
  **2026-08 — T-R6 EXECUTED and broadened** (suite-performance pass):
  the cutoff shipped, and the ratified `undischarged`-only scope proved
  too narrow — it exempted precisely the functions PROVEN total, so
  `factorial(n: NonNeg)` cost 71.1s to compile (plus a spurious
  `precompile-type-error`) while the same function over bare `Int` took
  0.1s. Termination discharge was the wrong predicate: a recursive call
  with unresolved args cannot converge regardless. Broadened to CYCLE
  MEMBERSHIP with maintainer ratification; `analyzeDivergence` now
  reports `recursiveBindings`, and the cutoff is installed BEFORE
  precompile (which is where the speculation happens — a cutoff
  installed after it changed nothing). Suite 1015s → 324s.
  **Still open here**: the remaining profile. The top costs are now the
  boundary generated-program walk (27s) and the `.alg` units/dimensions
  files (12–14s each) — no longer totality analysis, so the item's
  original premise is spent and it needs re-scoping against the new
  profile rather than more guessing

### T-host

- [ ] **B-070** · Browser runtime packaging (core is browser-compatible)
- [ ] **B-071** · Async I/O capabilities: filesystem, networking, process,
  WebSocket, timers (env-provided, effect-labeled)

### T-backend (M8)

- [ ] **B-072** · Code generation: expression graph → JS first;
  continuations decision feeds B-048/B-073 (v1 "Phase I" — revalidate
  against v2 graph shapes; Grammar 2 "Phase 9" emitter folds in here).
  v1 Phase-I substrate + plan preserved at branch
  `archive/v1-references` (parent c553710) — pre-rework, reference only.
  Sequencing rationale (maintainer, recorded 2026-06): codegen sits
  after the safety machinery deliberately, so emission can be
  aggressive without forfeiting invariant/effect information

### T-perf

- [ ] **B-073** · Continuation-based TCO (Stage 2)
- [ ] **B-074** · Memoization as opt-in Standard feature (re-decide after
  Phase 4 representation data)
- [ ] **B-075** · Parser constants / tokenizer layer if 1–2k-line corpus
  demands (benchmark first)

### T-bootstrap (M9)

- [ ] **B-076** · Self-hosted parser (standard parser re-expressed via L3
  parser generator per 2026-07 ruling)
- [ ] **B-077** · Self-hosted type system / module system

### T-ecosystem (M10)

- [ ] **B-078** · Module versioning + compatibility; dependency
  resolution; registry

### Track R — public release

- [x] **B-090** · Release positioning: `release-track.md` plan (three-move
  cohesion frame, differentiator map D1–D7 with claims register, demo
  ladder rungs 1–4, derivation order) + VISION §1a/§5 amendment
  (substrate/surfaces terminology, principle 17 claims discipline —
  Tier 0, dedicated commit). R-R1–R-R5 all ratified 2026-08 (rung-2
  domain: units-of-measure physics)
- [x] **B-091** · `[stage: live]` Rung 1 release package: curated demo scripts +
  sandbox walkthroughs (theorem → break → counterexample → prove loop;
  effects refusal; laws + admitted tier), assumption-ledger roll-up
  view in `inspect`/Verdict (the D2 polish item), getting-started +
  language tour for outsiders, `proving-in-allegro.md` public audit,
  website refresh derived from the messaging skeleton, README/npm/
  versioning mechanics. Gate: every public claim at
  `delivered`/`demoable` in the register. **Slice 1 landed 2026-08**:
  messaging skeleton (`docs/messaging.md`), rung-1 demo package
  (`demos/rung1/` — suite-validated scripts + captured transcripts +
  prover-loop walkthrough), landing-page refresh (hero/three moves,
  Laws + Prover Loop sections, `&` migration; deploy pending
  maintainer). **Slice 2 landed 2026-08**: D2 assumption-ledger
  roll-up (transitive proof backing sets + Verdict ledger block +
  inspect rests-on; D2 register row → delivered); theorem-dropped-
  under-fragment-grammar soundness fix + regressions; sandbox
  walkthrough presets (both copies); `docs/getting-started.md`;
  `proving-in-allegro.md` E3/E4 laws+gate section. **Slice 3 (close-
  out) landed 2026-08**: README.md (repo front page from the
  skeleton), package.json metadata (0.1.0, CC0-1.0, private,
  description), web/website sandbox unified (deployed copy gets the
  async streaming runtime; only intended deltas = script path + docs
  nav link), full 36-example public sweep run — surfaced and fixed
  two expression-position generic gaps (bare `x instanceof Array`
  auto-applies Any; `Array[Int]` as an expression applies via a
  GenericType `get` member) with regressions. B-091 COMPLETE except
  the maintainer's manual deploy.sh pass
- [x] **B-092** · `[stage: merged]` Rung 2 flagship provable DSL (the seriousness proof):
  units-of-measure physics (R-R4 ratified). **Brief composed 2026-08**
  (`docs/plans/units-dsl.md`): dimensions as structural data +
  named-dimension REFINEMENTS over one Quantity record (U-R1 —
  pre-validated by entry test on the unmodified substrate),
  number-anchored literal sugar, laws at honest tiers with the
  admitted-ledger as demo content, chunks U1–U4. U-R1–U-R5 awaiting
  ratification 2026-08 (as recommended). **U1 landed 2026-08**:
  lib/units.alg + user-type operator-dispatch kernel fix +
  suite-registered demo. **U2 landed 2026-08**: quantity literal
  grammar (number-anchored, hws same-line) + two grammar-kernel
  refinements (explicit-ws interleave override; expr_form front
  splice). **U3 landed 2026-08**: Equatable draw + honest-pending
  laws + PE-tier physics theorems + the E4 gate/ledger over quantities
  in domain vocabulary. **U4 landed 2026-08 — B-092 CLOSED**:
  demos/rung2 (3 suite-validated scenes + transcripts), landing-page
  Units DSL section + sandbox preset (both copies), web lib registry
  synced from disk via scripts/sync-web-libs.ts (fixed: sandbox pages
  had NO lib registrations — B-091 presets using `use` would have
  failed on the deployed site), D4 register row → delivered,
  37-example site sweep clean. Residue routed: B-081 (refinement-
  failure domain detail), B-089 (record-domain law sampling flips the
  DSL's pending laws with zero DSL changes)
- [ ] **B-093** · Rung 3 Vivace pilot packaging: when the B-079/B-080
  pilot exists, derive the public story (stakeholder-readable failures,
  solution finding over one domain model); re-grade the claims register;
  rung 4 remains internal direction until then

### Track M — methodology (2026-08)

- [x] **B-095** · Methodology adoption (majodali/methodology v1.0.0) —
  plan `docs/plans/methodology-adoption.md` (the first resident of the
  new K-007 plan home). **Chunk 1 drafted 2026-08**:
  `docs/classification.md` (C2 / S0 / language-tool-platform /
  static-site, pinned 1.0.0, Workflow `in-dev → merged → live` +
  stage-reference convention, Article-7 transition designations on
  CLAUDE.md, docs/plans, .claude/memory, BACKLOG location, missing
  decision register) + Binding block in CLAUDE.md. **Gate passed
  2026-08**: C2 + convention + B-091 live confirmed; drafted DEV-1
  removed — W-006 adopted in full (single-use outcome-named branches
  from the next deliverable). **Chunk 2 drafted 2026-08** (branch
  `decision-register`, the first W-006 single-use branch):
  `docs/decisions.md` — K-004 register indexing D1–D47, E-R1–E-R6,
  U-R1–U-R5, R-R1–R-R5 + chunk/standing rulings under original IDs
  (no renumbering; K-004 status vocabulary; D48+ continues here);
  two stale ruling-status passages refreshed in sources during the
  sweep (structures.md C7.2, release-track §7 R-R3–5). **Chunk 2 gate
  passed 2026-08** (owner sampled for fidelity; PR #4). **Chunk 3
  landed 2026-08** in five per-move-reviewed PRs (#6–#9 + this one):
  plans tree → `docs/plans/` with K-007 statuses; memory audit
  (retargets, 13 stubs deleted, A6 banner); promotions (v1-era
  history → CHANGELOG; core-types/modules/implementation-map/
  language-reference docs); CLAUDE.md → 135-line K-002 bootstrap;
  Backlog → `docs/backlog.md` (this move). All four Article-7
  transition designations resolved. **Chunk 4 landed 2026-08 (arc
  CLOSED)**: PR template (practice D2), transition section emptied,
  form audit PASS across the applicable rule corpus (recorded in the
  plan), coordination drafts for the methodology repo (portfolio row,
  practices §5 census corrections — delivery is an owner action or a
  methodology-repo PR on request), risk register consciously NOT
  seeded (K-005). Plan closed → this entry
- [x] **B-096** · T-tooling · Deployed-version verification (owner,
  chunk-1 gate). Landed 2026-08: `deploy.sh` stamps
  `website/version.json` (commit / branch / deployedAt / dirty;
  gitignored, generated per deploy) and `npm run check-deployed`
  (`scripts/check-deployed.ts`) fetches it from the live site and
  compares to origin/main — current / stale-by-N / mismatch /
  unverifiable verdicts, only a clean 404 read as "predates the
  stamp"; pure verdict logic unit-tested (7 tests, no network in the
  suite). `[stage: live]` designations are auditable once the owner's
  NEXT deploy publishes the first stamp. Feeds Article 11 tooling

### L3 — Vivace (M5)

- [ ] **B-079** · `[reval]` Planning DSL revalidation → `planning-dsl.md`
  in `docs/design/vivace/`: outcome-DAG model, 12 conventions, rejections,
  `SoftwareRelease` example; Shape 1/2 + pilot roster proposed into
  VISION §4 (Tier 0 — propose, don't land). Source:
  `docs/plans/archive/project-1-planning-dsl-design.md`.
  `lib/planning.alg` stays paused until then
- [ ] **B-080** · Vivace DSL candidates (post-pilot roster): logic
  programming, constraint programming, data modeling, numerical methods,
  software-systems modeling, workflow/process, automatic reasoning, UI
  modeling, data/analytics; semantic-model variants (functional/
  imperative/mixed) as extensions
- [ ] **B-081** · Counterexample legibility — domain-specific failure
  rendering layer (foundational; coupled to the AI iteration loop; see
  `docs/VISION.md` §4). v1 rendering-hook sketch (`T.onFailure`)
  preserved at branch `archive/v1-references` (parent b838a89) —
  pre-rework, reference only
- [ ] **B-082** · Model composition patterns (cross-domain predicates,
  arbitration, multi-domain [impl, proof] explosion risk)
- [ ] **B-083** · AI iteration loop — usable failure modes (residuals the
  agent can't discharge; surfacing; time-boxing; shared artifact with
  B-081)
- [ ] **B-084** · Constraint-set completeness — organizational process
  research (external interviews; longest critical path)
- [ ] **B-085** · Bootstrap economics — Vivace value vs. domain-model
  maturity (roadmap question)
- [ ] **B-086** · Escape-hatch awareness tooling ("you're cycling on this
  rule — options"); posture per `docs/VISION.md` §5 principle 4
- [ ] **B-098** · Predicate/domain propagation onto residuals —
  (renumbered from a duplicate "B-087" at the 2026-08 backlog groom:
  the ID was minted twice — 2026-07 for the totality-analyzer
  performance item above, 2026-08 for this one; IDs never change
  meaning, so the earlier mint keeps B-087 and this item takes the
  next free ID) —
  `propagateSetForPrimitive` runs only on the fully-resolved path, so a
  residual's own `predicates` channel isn't pre-computed from operand
  domains (deferred precision, not unsoundness: operand values inside
  the residual keep their sets; propagation fires on completion, and
  existing compile-time discharges read domains off the TYPE channel,
  which Rule 1 does propagate). Maintainer ruling 2026-08: leave as-is
  until a concrete set of use cases requires early discharge of derived
  domains on unresolved arithmetic — then look deeply (likely a one-line
  reorder in `applyPrimitive`, but validate interaction with Rule 2
  branch predicates and precompile placeholders first)
- [ ] **B-100** · `[reval]` T-R6 soundness review + the checking
  algorithm itself. The broadened cutoff (cycle membership rather than
  D34 tier) shipped 2026-08 on measured evidence and maintainer
  ratification, but the reasoning deserves a deeper look than a perf
  pass gave it. **Two threads:**
  (a) **Cutoff soundness.** The claim is "a recursive call with
  unresolved arguments cannot converge, so residualizing loses
  nothing." Interrogate it: is it true for PARTIALLY-applied calls
  (some args concrete, some symbolic) where unfolding a few levels
  might reach a decidable base case? For mutual cycles where the SCC is
  entered at different points? For HOF-mediated edges? Does the cutoff
  change any FOLDING result the suite does not currently pin (it kept
  1197/1197 green, which is evidence, not proof)? Also review the
  `unresolved argument` predicate itself — `isResolved` on a carrier vs
  a residual vs a pending future — and whether the cutoff should
  reside in `precompileFunction` rather than `applyComposed`.
  (b) **The checking algorithm hitting STACK OVERFLOW is a bad sign.**
  Before the cutoff, precompiling a provably-total `factorial(n:
  NonNeg)` unfolded until the JS stack died, and the error surfaced as
  a `precompile-type-error` on correct code. The cutoff removes the
  trigger but not the underlying fragility: PE has a `MAX_DEPTH` of
  10000 that recursion depth can outrun, and a host-stack failure is
  reported as a user-facing type error. Wanted: a real termination
  discipline for the analyzer/PE itself (explicit work list or depth
  budget with a HONEST diagnostic), so that no input can turn an
  engine limit into a wrong answer about the user's program. Related:
  D35's fuel/budget framing may be the right shape.
  Sources: `docs/design/standard/totality.md` §3/§7/§8,
  `src/evaluator.ts` (`setInlineCutoff`, MAX_DEPTH), `src/runtime.ts`
  (analysis-before-precompile ordering), CHANGELOG 2026-08 perf entry
- [ ] **B-099** · Project severity configuration — the T-R2 surface
  (ratified 2026-08, `docs/design/standard/totality.md` §5/§8;
  subsumes **B-058**, the v1-era statement of the same surface). ONE
  per-project config declaration (shape open — likely a manifest read
  at session start, not a body form) providing: per-notification-kind
  severity promotion (`totality-nontermination: error`,
  `totality-exhaustiveness: error` — v1 Phase-E's promotion path);
  **`total`-by-default** (every binding treated as `total` unless
  marked `partial` — D34's strict enforcement, opt-in per project, and
  the reason this item exists); blanket axiom patterns (D34's text:
  trust `lib/legacy/` as total, `fetch <url-pattern>` liveness —
  recorded admissions en masse, still ledger-visible per binding); and
  the two CE-R8 severity knobs (construction-path invariant failure,
  non-exhaustive match over a finite type — promotion is exercised
  HERE, never by code drift, per T-R3). Blocked on nothing but a
  project-config substrate: Allegro has no manifest-level configuration
  surface yet, so this item owns designing one or deciding it rides
  an existing file. Never a global default change (T-R2).
  **Rider added at B-014 (CT-R2, ratified 2026-08)**: the contract
  knobs belong to this same surface — the construction-path knob above
  is a contracts knob, and v1's global `--strict` flag (never built, and
  not to be) is superseded here rather than revived
  (`docs/design/standard/contracts.md` §6/§7)

- [ ] **B-103** · T-tooling · CI: assert the suite's REGISTRATION COUNT,
  not just that it passes. The lane-B split lost nine tests to a bad cut
  and every gate stayed green — typecheck clean, suite 1188/1188, `GATE:
  PASSED` — because a uniformly smaller suite is self-consistent. Two
  things caught it, both manual: diffing `registered=` against the
  previous commit, and (once raised) the suite floor. Raising `suiteFloor`
  to the suite size closed the hole for DROPS, but the floor has to be
  bumped by hand whenever the suite grows, and a floor that drifts below
  the suite is exactly the state that made it useless. Options: have the
  aggregator fail when the total differs from `suiteFloor` in EITHER
  direction (turning it into a pin with an explicit-bump workflow), or
  have CI compare `registered=` against the base commit's value. The
  second catches drops on branches without a manual bump ritual
- [ ] **B-102** · T-tooling · `SCAN_EXCLUDE` in `src/boundary-tests.ts`
  still lists `src/test.ts`, a file that no longer exists. It is inert —
  the suite modules under `src/test/` are scanned like production code and
  carry zero violations since C0 — but a stale exemption invites someone
  to reintroduce the hole it used to hold open. Delete the entry (lane B
  could not: `boundary-tests.ts` is outside its file set)
- [ ] **B-104** · L0 · **Retire the `__*` (dunder) identifier convention
  from the source entirely** — maintainer directive 2026-08. The prefix
  was a temporary collision-avoidance measure and is no longer needed;
  it is also load-bearing in a way that a naming convention should not
  be. Two halves, and they are not the same problem. **Chunk 1 landed
  2026-08 — (a), (c) and (d) are DONE; (b) is what remains and needs a
  ruling.**
  - **(a) Host-plane names — free. ✅ DONE (chunk 1).** ~21 registered `js-property` slots
    (`__abstractDomain`, `__effectLabels`, `__effectBound`,
    `__inferredEffects`, `__genericParams`, `__partial`,
    `__decreasesMetric`, `__declaredEffectsAst`, `__paramEffectPairs`,
    `__provenClauses`, `__total`, `__assumeTerminates`, `__futureManager`,
    `__tailCall`, `__grammarValue`, `__grammarHandle`,
    `__grammar_fragment`, `__channelWriterFor`, `__lawBackings`,
    `__predicateSet`, `__effectSet`) plus unregistered host expandos
    (`__localMemberScope`, `__ownerShape`, `__memberNameIndex`,
    `__hasPrivateMembers`, `__memberPrivilege`, `__declarationOnly`).
    These are JS properties on host objects — they never share a
    namespace with Allegro user names, so the prefix buys nothing.
    Mechanical rename; no semantics. **Landed**: 27 names, ~180 sites,
    zero behaviour change. `__compileMode` joined them — it was
    registered as `context-binding` but every reader and writer is a JS
    expando, so its storage class was corrected with the rename. The
    dead `__grammar` / `__parse` PREFIX registry rows were retired at
    the same time: a prefix row matching nothing is not inert, it
    pre-approves every future `__grammar*` binding and hides it from
    the W3 completeness walk
  - **(b) Binding-plane meta slots — a design decision. ← THE REMAINING WORK.** `__name`,
    `__members`, `__refines`, `__construct`, `__getMember`, `__interface`,
    `__wraps`, `__union`, `__predicate`, `__args`, `__generic`, `__type`,
    `__discharged`, `__length`, `__compileMode`, plus the synthetic
    binding-name families (`__future_N`, `__bare_N`, `__anon_N`, `__el_N`,
    `__inline_grammar_N`, `__start__`, `__error__`). These live in the
    SAME `bindings` map as user fields, and `isMetaSlotKey(key) =
    key.startsWith("__")` is the partition test between the two — read by
    `types-std.ts` (member dispatch narrowing, spec walks, refinement key
    filters), `runtime.ts` (source attachment), `primitives.ts` (pending
    future scan) and the registry-completeness walk in
    `boundary-tests.ts`. Dropping the prefix requires REPLACING that
    partition, not renaming past it — separate storage plane, registry
    membership, or interned keys. Needs a ruling before any code moves.
    Three candidate answers, with the recommendation first:
    1. **A fourth plane on `Structure`** — a `meta` map beside
       `components` / `bindings` / `dense`. `isMetaSlotKey` stops being a
       name test and becomes a STORAGE question, which is the property
       that should have carried the partition all along; the names then
       drop the prefix because nothing depends on it. Compatible with
       D39: a slot dispositioned `member` later graduates out of the meta
       plane into a declared member, one dispositioned `host-internal`
       stays. Cost: every read/write path through the 15 slots, and the
       W3 walk changes subject
    2. **Registry membership** — keep one map, make the test
       `slotRegistration(key) !== undefined`. Cheapest, but it makes
       `name` / `members` / `length` unusable as ordinary user field
       names, which is a language-visible regression
    3. **Interned or symbol keys** — unforgeable by construction, but the
       bindings map is string-keyed throughout (serialization, the
       bindingList, module objects), so this is the largest change
    Note the synthetic binding-name families are a SEPARATE sub-problem:
    they are real names in the user namespace, not meta slots, so the
    answer there is likely a `Binding` attribute (alongside `cell`,
    `visibility`, `isComplete`) rather than a plane
  - **(c) Enforcement gaps found while surveying. ✅ DONE (chunk 1).**
    The `dunder-string-literal` pattern (`["']__[A-Za-z0-9_]*["']`)
    matched quote-delimited literals only. Three spellings were invisible
    to it and now have patterns: synthesized template keys
    (`` `__future_${n}` `` — five sites, none previously counted),
    property access, and primitive diagnostic names
    (`"record.__construct"`). `bindings-get-dunder` now covers
    `.has`/`.set`/`.delete` as well as `.get`. All three new patterns are
    `ratchetOnly` — they count PRE-EXISTING violations for the first
    time, so hard-failing them would fail the suite on the commit that
    made them visible; they ratchet until (b) drives them to zero, then
    the flag comes off. The property-access pattern matches against
    source with string literals blanked, so a diagnostic name is not
    miscounted as a host-plane read. *(Backticks were deliberately NOT
    folded into `dunder-string-literal`: in this codebase a backticked
    `__name` is nearly always a markdown code span in a doc comment —
    prose about a slot, not a use of one. Folding them in would have
    added ~30 false positives to a hard-fail pattern.)*
  - **(d) Two raw NUL bytes in `src/slots.ts`. ✅ DONE (chunk 1).**
    `unionBackings` built its dedup key with literal NUL bytes rather
    than `\x00` escapes, which made git and `grep` treat the whole file
    as binary — so `src/slots.ts`, the one file where every slot name
    lives, was silently absent from plain-text searches, dunder searches
    included. Now escaped; the file reads as text
  - **(e) Chunk 2 — the deletions, maintainer-ratified 2026-08. ✅ DONE.**
    The audit (artifact "The Meta Slot Audit") instrumented
    `isMetaSlotKey` over the whole suite: across 1197 tests it returned
    true for exactly ONE key, `__length`, 296 times. Every other slot —
    `__name`, `__members`, `__type`, `__construct`, `__refines`,
    `__predicate`, `__getMember`, `__interface`, `__wraps`, `__union`,
    `__args`, `__generic`, `__discharged` — never once. The reason is
    structural: type Contexts hold ONLY meta (a user field named `name`
    lands in `__members` under an FQN key), instances hold ONLY user
    fields (shape moved to the component plane at C4.3b), and
    `__members` is FQN-keyed. **The `meta`-plane recommendation was
    WITHDRAWN on this evidence** — a plane would be a new pile for old
    debris. Landed in chunk 2: union types removed entirely (below,
    B-105); `__union` deleted with them; `__invariantsList` accessors
    deleted (zero readers, zero writers since C6.1b); four registry rows
    reclassified from `context-binding` to `js-property` (`__el_`,
    `__start__`, `__error__` are JS locals and element `.name`
    properties in the generated Earley parser, `__anon_` is a grammar
    precedence-LEVEL name — none has ever been a binding, and the
    `__el_`/`__anon_` PREFIX rows carried the same pre-approval hazard
    removed for `__grammar`/`__parse` in chunk 1)
  - **(f) `__length` — the audit's own recommendation, RETRACTED.** The
    audit called it deletable. It is not. Its one arbitrary writer
    (`makeUnionType`) is gone, but `materializeView` emits it as part of
    the C4.2 legacy-view compatibility contract, pinned by the W6
    dense-view-coherence invariant and by boundary tests asserting the
    view carries it and that `bindingList` has 3 elements + `__length`.
    Deleting it would have weakened existing test conditions. It stays —
    and it is therefore the ENTIRE remaining job of `isMetaSlotKey`:
    hiding one derived slot from field walks. Whatever replaces the
    partition needs to handle exactly this case and nothing else.
    ~~GATED ON B-108~~ — **DECIDED (D48(a), 2026-08): DELETED, not re-keyed.**
    Option E dissolves the dense role, and `__length`, the materialized legacy
    view and the W6 invariant go with it. So nothing replaces the partition:
    `isMetaSlotKey`'s entire remaining job disappears rather than moving.
    **This sub-item now closes inside B-120** — and with it the `__*`
    convention, since `__length` was the last key it ever fired on
  - **(g) `__interface` — RESOLVED at concept-spine S3 (`concepts.md` §36).**
    Specified, not open. The definition — an interface is a **declaration-only
    type**, and `InterfaceKind` is literally `Type` refined by *"has no
    `construct`"* — makes the answer derivable rather than asserted: the
    marker does **two jobs with one bit**. `applyBoundaryBound` reads it for
    *is this an interface?*; `shapeAwareSubtypeof` reads it for *is this in
    the loose base-name world?*; `structuralWrap` erases the marker AND the
    name together, so one erasure answers both — but the facts are
    orthogonal. `~Printable` has no construct (interfaces have none to copy),
    so it satisfies InterfaceKind's own predicate: it IS an interface and it
    is ALSO loose, as the maintainer ruled. The change: drop the marker check
    in `shapeAwareSubtypeof` (measured 0-decisive — 42 interface encounters,
    none where it changed the outcome, because the name check beside it
    already carries the loose-world meaning); read the meta-type in
    `applyBoundaryBound` (a behaviour change, and a FIX — that path has ZERO
    suite coverage, so tests land first); leave `structuralWrap` alone
    (**retracting** the meta-type re-stamp proposed before the definition
    existed — anonymity already carries the loose-world signal); delete
    `__interface`. Original finding follows.
  - **(g-orig) `__interface` — NOT the same shape as `__union`.** The audit
    grouped them as pure presence-markers and the ratification covered
    both. On implementation the two diverge: `__union` was redundant with
    a kind, but `__interface` carries a distinction the meta-type does
    NOT. `structuralWrap` deliberately ERASES the marker while COPYING
    `__type`, so `~SomeInterface` keeps meta `Interface` while leaving the
    declared-conformance world for the loose base-name world (C5.2c,
    pinned by a boundary test). Deleting the marker therefore requires
    `structuralWrap` to re-stamp the wrapper's meta-type from
    `InterfaceKind` to `Type` — a semantic change to what `~Interface`
    IS, not a redundancy removal. Deferred to its own chunk with a
    maintainer gate rather than folded into the deletions

- [ ] **B-105** · L2 · **Union types — redesign or leave retired.**
  *(Note added 2026-08: whatever the redesign, it lands on the D48(a)
  entry-sequence composite, not on the map-plus-dense-region one — the
  original "if a union type is implemented as an array, why isn't it dense?"
  question dissolves with the dense role. Wait for B-120.)*
  Removed wholesale at B-104 chunk 2 (maintainer ruling: "if not used
  outside tests, remove it"). Usage at removal: **four test assertions,
  nothing else** — no `lib/`, no `tests/*.alg`, no demo, no bench, no
  entry in `language-reference.md` or `getting-started.md`. What was
  removed: the `A | B` production in `grammar2/base-grammar.ts` and its
  `grammar-ext.ts` Earley twin, the `type_union` tree-builder case and
  primitive, and `makeUnionType`. What was wrong with it, and what any
  redesign has to answer:
  - **It was array-shaped but not DENSE.** `makeUnionType` stored
    alternatives with `addBinding(union, String(i), …)` — the
    string-keyed path — and so needed an explicit `__length`. It predates
    the C4.2 dense region and was never migrated. A redesign should use
    the dense region, at which point the length member is derived and
    disappears (maintainer's question at ratification: *"if a union type
    is implemented as an array, why isn't it dense?"*)
  - **Its marker held the wrong thing.** `__union` stored `makeInt(1)`
    while the D39 registry named `Type.variants` as its target. The
    is-a-union test should be answered by a UnionType KIND (the
    `__isGeneric` ruling: the flag IS the kind), not a marker slot
  - **It was the only genuinely mixed Context in the system** — engine
    slots (`__name`, `__type`, `__length`, `__union`) beside plain names
    (`instanceof`, `subtypeof`) beside numeric element keys
  - **C6 carved it out and never came back.** The structures plan's
    ruling R6 kept `makeUnionType` outside member storage with dispatch
    via direct bindings, deferring `__union` → `Type.variants` to a
    re-derivation that never happened
  - `docs/grammar-formalism.md` already noted the feature's real problem
    in passing: "`Int | String` style unions, but pattern-matching
    ergonomics are awkward". Whether unions come back at all is open —
    variant types reached through `define` may be the better surface
  - **(h) Chunk 3 — `__type` to the component plane. ✅ DONE (2026-08).**
    Maintainer-ratified with the in-place-mutation constraint. Shape storage
    is now uniform: every value carries it as the `type` component, and
    `channelReadRaw` loses its binding-plane special case. The gated
    question — does this disturb shape declaration vs type knowledge? — is
    answered no: the C3.1/D36 split is a READ-time computation (`typeShape`
    walks `__refines`/`__members`/`__predicate`, all still binding-plane)
    over ONE stored value, so where that value lives is irrelevant to it.
    `writeShape` mutates `ctx.components` directly rather than routing
    through the registered channel writer, which derives a new value via
    `makeMultiValue` — type Contexts are identity-sensitive (memoized
    generics, law registries, and the `typeShape(stored) === typeShape(expected)`
    reference test in `applyBoundaryBound`). **The real hazard was not the
    read path**: `structuralWrap`, `preserveOps` and `buildMethodLayer`
    build derived types by copying bindings, and so had been inheriting the
    meta-type implicitly for free. Post-move those clones would have come out
    untyped with nothing in the types to say so; a `carryShape` helper makes
    the inheritance explicit at all three. Paths that re-stamp their own shape
    (`buildRefinedType`, `buildDistinctType`) needed nothing. Gate green at
    1197 on the first run

- [~] **B-107** · L0 · **Naming and declaration debt found by the concept
  spine (S1, T0–T1).** **(a)(b)(c)(e)(f) LANDED at campaign chunk C9,
  2026-08; (d) held for discussion, and delta 30's ENFORCEMENT half moved to
  B-104(f). The residue the pass measured is B-119.** Ruling-3 scope (maintainer-ratified 2026-08): the
  renames pulled forward ahead of the S5 triage, extended beyond the type
  name to the other **clear** cases — where the decision is already ratified
  and executed in the runtime and only the surface name lags. Anything whose
  right name is still an open question waits for its spine entry.
  - **(a) One concept, three names.** `Structure` (the class),
    `StructureValue` (the interface — **2** occurrences, its own declaration
    and the alias), and `ContextValue` (**701** occurrences), which exists
    only as `export type ContextValue = StructureValue`. The constructor is
    `makeContext` (**101**); `makeStructure` does not exist. D1 and D46 are
    recorded EXECUTED: the runtime unification was, the renaming was done by
    alias. Rename `ContextValue` → `StructureValue` and `makeContext` →
    `makeStructure`. **DONE C9**: alias deleted; 703 + 101 sites, plus
    `asContext`→`asStructure` (30), `makeDenseArrayCtx`→`makeDenseArray`,
    `makeRawArrayCtx`→`makeRawArray`, `makeCtxWith`→`makeStructureWith`,
    `newContextStructure`→`newRecordStructure`,
    `extensionToContext`→`extensionToStructure`, and primitives-local
    `asCtx`→`asStructureArg`. Green at 1197 on the first run
  - **(b) `MultiValueType`** (**25** uses) names the kind D46 retired; its
    own comment says it survives "so existing casts keep compiling". The
    concept is the CARRIER (`isCarrier` is already the host test), so the
    static shape should be named for it. **DONE C9**: → `CarrierStructure`,
    and `makeMultiValue` → **`withMetadata`** (68), named for what it does —
    the one metadata-attachment chokepoint — since only one of its three
    paths actually builds a carrier. Which surfaced a defect the rename was
    not looking for: **the function DECLARED a carrier return** while the
    derive path returns a non-carrier. Corrected to `StructureValue`;
    **exactly one site** — a test cast — depended on the fiction, which is
    the evidence it was never load-bearing
  - **(c) Stale file headers.** `src/types.ts` opens "Five value kinds +
    Param placeholder" — there are seven, and Param is one of them. The
    header predates both `Symbol` and the Context→Structure renaming.
    `src/structure.ts` describes **two** planes; there are four, and it says
    `__*` meta-slots "remain here until C5 re-keys them" — C5 did not, B-104
    is doing it two milestones later. **DONE C9**: both headers rewritten;
    `structure.ts` now names all four planes and points the host-plane row at
    `StructureHostFields`
  - **(d) `ParamValue.predicates`** — declared, documented "reserved",
    **no runtime reader**, and a test asserts it stays empty. A reservation
    nothing reads or writes is indistinguishable from dead code; move the
    reservation into prose and delete the field, or give it a reader.
    **HELD at C9 — needs a ruling.** Deleting the field requires deleting the
    test that asserts it stays empty, and PROCESS §6 makes removing a test
    condition a discussion, not a judgement call. The alternative (give it a
    reader) is a feature, not a naming fix. Either way it is out of a naming
    chunk's scope
  - **(e) Binding write disciplines.** `slotWrite` writes map + list,
    `slotSet` writes the map only (deliberately — the proof-kernel
    origination idiom), `removeName` deletes from the map and leaves the
    list entry, `removeConstruct` deletes from both. The
    leave-the-list-entry behaviour is documented on `renameInPlace` and
    nowhere else. Four disciplines, one comment, no stated rule for
    choosing. Needs a rule, not necessarily a change. **DONE C9 — and
    writing the rule found its CAUSE.** `slotWrite` and `addBinding` each
    construct **two separate `Binding` objects** for one key, so the map and
    the list are **not aliases** and an in-place mutation reaches exactly one
    view. All four disciplines follow from that one fact, which was
    documented nowhere. The rule is now stated above `slotWrite`, including
    why the map-only paths are safe today (nothing enumerates a type
    structure's `bindingList` as fields — the same measurement that found
    `isMetaSlotKey` fires on one key) and that the exemption is
    circumstantial, so B-104's partition retirement must preserve it. Note
    the item's own text was approximate: there is no `slotSet`
  - **(f) Host-plane fields declared on the value interface.** `parent`,
    `isScope` and `scopePredicates` sit on `StructureValue` while their own
    comments say they are "host-plane fields, never value slots". The plane
    distinction is asserted in prose and contradicted by the declaration.
    ~~Blocked on T2 §9~~ — **unblocked**: `concepts.md` §18 declares the
    planes. Scope confirmed by the S5 triage: these three are correctly
    PLACED and wrongly DECLARED, so the fix is declaration-side only.
    Host-plane data that is wrongly *placed* is **B-118**, a different item.
    **DONE C9**: `StructureHostFields` declares the three, and
    `StructureValue extends` it — the plane is legible in the type instead of
    only in per-field comments the declaration contradicted

- [x] **B-108** · L0 · `[reval]` **RULED 2026-08 → D48.** Review the
  Allegretto composite — IC-2 / IC-3 / IC-4 together.
  - **The ruling**, in one place: **(a) IC-2 → option E**; **(b) IC-3 → the
    alternative** (metadata as a field on every kind); **(c)** construction
    takes metadata and `withMetadata` splits into four named operations;
    **(d) IC-1 DISSOLVES** — it could not be decided, because (a) and (b)
    delete the roles it would have tagged, which is the item's own "cannot be
    judged separately" premise proving itself; **SC-5 upheld.**
  - **The item's central question is answered.** "Did unifying the composites
    simplify things?" — **yes at the specification level and no at the
    implementation level**, and it could not be answered while those were
    fused. Kinds went 2 → 1 (the win); configurations went 2 → 4, and 74% of
    all structures allocated became the configuration that exists solely to
    hold one metadata field.
  - **Execution**: NOT started. → **B-120** (option E) and **B-121** (metadata
    field + lifecycle). Each is an arc, not a chunk, and gets a plan first.
  - Full measurement record and reasoning: `docs/design/concepts.md` §3
    (IC-1, IC-2, IC-3, IC-3a) and "What B-108 settled (D48)"
  - *Original item text follows, kept as the record of what was asked.* Raised by the concept spine (S2a) at
  maintainer direction; the three choices interact and cannot be judged
  separately. The question is not "is the current design wrong" — the suite
  says it works — it is **how much of the implementation is visible from the
  specification**, which is the R7 criterion nobody applied when these were
  taken.
  - **The measurement.** `Structure` declares **11** fields in **4**
    role-groups (carrier, record, dense, scope) plus 2 universal, and role is
    read by field PRESENCE at **146** sites (`.primary` 67, `.dense` 21,
    `.components` 20, `isCarrier` 14, `isScope` 13, `isDense` 6,
    `viewMaterialized` 5), through 3 constructors. Representations went
    2 → 1; configurations went 2 → 4; the variation moved from an explicit
    kind tag to implicit field presence
  - **The recorded rationale was never simplification.** `structures.md` I1
    gives the payoff as "known type ⇒ known shape ⇒ slot access compiles to
    offsets (feeds codegen)" — future codegen — and the class comment gives
    "so every structure shares a single hidden class" — present V8. Both are
    performance arguments. The unification was read as a conceptual
    simplification because requirement / specification / implementation were
    not separated; that separation now exists (concepts.md Part 0)
  - **Options carried in `concepts.md` IC-2** (renumbered at S2b; the
    kind-count half of the old IC-2 is now **SC-5**, a SPECIFICATION choice,
    and the role-configuration half is **IC-1**. Separating them is what
    makes the doubt answerable: reducing kinds 2 → 1 was a specification win
    under R1; the cost was entirely at the implementation level): A map-first (current),
    B sequence-first (LISP-style, maintainer's suggestion), C two
    representations (the original), **E one entry-sequence** — a single
    composite of optionally-keyed entries that is both map and list, under
    which the dense region becomes a representation optimisation BELOW the
    spec and `__length` + the legacy view + the W6 invariant all dissolve.
    E was not previously on the table
  - **The B question worth measuring, not assuming**: O(n) name lookup is
    only costly if lookup is a RUNTIME operation. Under R2 most scope
    resolution happens once at `resolveSymbols`. The asymptotics that rule
    out association lists in an interpreter argue far more weakly in a
    partial evaluator. Counter-pressure: channel reads ARE hot and ARE
    by-name (R3+R5), which is exactly where B goes linear
  - **IC-3 (was IC-4) has no recorded criterion at all** — "channels by wrapping" was
    never written down as a choice. The alternative (an optional channel map
    on every value) deletes the carrier concept outright: no `primary`, no
    67 presence-checks, no W1 non-nesting invariant, no `dataOf`
    indirection — at the cost of an optional field on every representation,
    including Bits
  - **Deliverable**: a ruling on the composite, and whichever of SC-5 /
    IC-1 / IC-2 / IC-3 it settles moves to a recorded choice WITH a criterion
    and a revisit trigger. Informs T2 (planes) directly. **DELIVERED** — all
    four now carry a criterion and a revisit trigger
  - **It does NOT block nothing** (corrected by the S5 triage). Option E
    dissolves `__length`, the legacy view and the W6 invariant together, so
    whether **B-104(f)** means *re-key `__length`* or *delete it* is decided
    here. **B-108 gates the retirement of the last dunder** — the
    highest-leverage unruled question in the concept-spine set, and a ruling
    rather than code, so it can be taken at any time. Campaign chunk C12
    (`docs/plans/concept-spine.md` §9.3) waits on it

- [ ] **B-109** · L0 · **R6 and R12 are violated in the channel substrate.**
  Found by the concept spine (S2b) while resolving two objections to the
  requirement set. Both turned out to be **implementation** violations rather
  than design contradictions — the mechanism is layer-ignorant, the wiring is
  not — which is the good outcome: a contradiction would need a redesign.
  - **(a) The base registers the layers' channels (R6, R11).** `src/slots.ts`
    registers **eleven L2 channel names** itself at module init: `shape`,
    `error`, `effects`, `predicates`, `domain`, `knowledge`, `bound`,
    `discharged`, `warnings`, `source`, `exported`. It also special-cases
    `shape` / `type` / `discharged` **by name** in `channelReadRaw` and
    `buildWriter`. R11's whole point is that the base owns a fixed
    *vocabulary* of propagation disciplines over an opaque payload, and the
    LAYER registers `(name, rule)`. The base knowing "some channels are
    viral" is layer-ignorant; the base knowing "the error channel is viral"
    is not
  - **The correct pattern already exists and is used exactly once**:
    `src/effects.ts` calls `installChannelMerge("effects", …)` — the layer
    supplying its own merge to a base that cannot import the encoding without
    a cycle. That is R11 working, and it is the template for the other ten
  - **(b) Integrity is enforced by name, not by capability (R12).**
    `INTEGRITY_CHANNEL_NAMES = ["discharged", "source"]` is a hardcoded set in
    `slots.ts` consulted by `assertNotIntegrityKey`. R12 says authority is the
    **capability** — registration is one-shot and returns the writer closure,
    so whoever registers first holds it — under which the base never needs to
    enumerate sensitive channels. Protection by name is precisely the form
    that cannot survive externalising registration, which is the objection
    that surfaced this
  - **(c) The two sources of truth disagree.** `source` is in
    `INTEGRITY_CHANNEL_NAMES` but is registered as
    `{ name: "source", rule: "drop" }` — **without `integrity: true`**. The
    guard and the registry hold different beliefs about the same channel.
    Harmless today (its rule is `drop` either way), but it is two mechanisms
    where there should be one
  - **Fix direction** (small, and it removes (b) and (c) together): consult
    `channelSpec(name)?.integrity` instead of the hardcoded set, and mark
    `source` integrity at registration. (a) is larger — moving eleven
    registrations out of the base — and should follow the T2 planes entry
    rather than precede it
  - **Gated on**: R6, R11 and R12 surviving ratification in their current
    form. If any is amended these findings must be re-read

- [ ] **B-110** · L0 · **The L0 evaluator implements the L2 type system.**
  Found by the concept spine (S2d) while classifying every abort in the base
  per maintainer ruling. This is the largest delta the spine has produced and
  it violates the project's OWN stated invariant — `CLAUDE.md`: *"Dependencies
  point downward only."*
  - **(a) The measurement.** Three L0 modules import from L2:
    `evaluator.ts` from `types-std.js` (twice), `refinements.js` and
    `effects.js` — **27 symbols** including `getType`, `withType`,
    `typeMethod`, `applyBoundaryBound`, `unifyTypes`, `assertMemberAvailable`,
    `typePrivilegedCtx`, `PredicateSet`, `AbstractDomain`, `impliesDomain`,
    `effectsOf`, `unionEffectSets`; `scope.ts` from `refinements.js`
    (`PredicateSet`, `mergePredicateSets`); `futures.ts` from `types-std.js`
    (`withType`, `ErrorType`, `StringType`)
  - **(b) `checkArgType` lives in `src/evaluator.ts`.** It calls `getType`,
    reads `typeContextName`, EVALUATES REFINEMENT PREDICATES, dispatches
    through an `instanceof` binding, and throws `Type error: argument N
    expected X, got Y` (6 sites; 6 more in `primitives.ts`). The evaluator
    does not merely name a layer concept — it implements type checking
  - **(c) Not a naming leak.** B-109(a) is eleven hardcoded channel names in
    the channel substrate; this is a whole subsystem living one layer too low.
    Different scale, same root cause
  - **The question it must answer, recorded rather than pre-empted**:
    type-directed dispatch IS genuinely needed during evaluation — that is R2,
    discharge happens BY evaluating — so the fix is not "delete the import".
    It is to identify the concept-free capability the evaluator actually
    needs, in the shape of `installChannelMerge` (base holds an inspectable
    symbol, layer installs the meaning), so L2 supplies the semantics
  - **ABSORBED INTO THE CONCEPT SPINE'S T2 (maintainer ruling, 2026-08).** It
    is not a separate arc: it is §18's plane-placement rule not being applied
    to one subsystem. `concepts.md` §23 now scopes it, and the plane framing
    supplies the decomposition — see below
  - **(d) One exception class for six classes of failure.** `AllegroError` is
    the only error class and NOTHING in `src/` catches it outside the suite.
    A host-invariant assertion ("has unresolved stub — check resolvePrimitives")
    and a user's argument error are indistinguishable, so a tool cannot report
    "this is an interpreter bug" separately from "your program is wrong", and
    the S2d classification had to be done by reading 117 call sites. The abort
    classes in `concepts.md` §7 are the vocabulary; the mechanism should carry
    which one. Specification-level, and separable from (a)–(c)

- [ ] **B-111** · L0 · **Field vs channel — one word and one registry for two
  concepts.** Raised by the concept spine (S2f, maintainer terminology). The
  metadata plane holds **fields**; a **channel** is the whole apparatus by
  which one capability rides values through PE — its fields, their rules,
  their writer, and the layer-side semantics. Storage vs capability.
  - **The evidence that this is a real distinction, not a rename.** Eleven
    things are registered in one registry as if alike. They are five kinds:
    seven **stored fields** (`type`, `predicates`, `domain`, `bound`,
    `effects`, `error`, `discharged`, `source`); one **projection**
    (`shape` — no storage, a computed view of `type` with refinement layers
    walked off); one **capability with no field at all** (`knowledge` —
    nothing ever stores a `knowledge` component, and its own comment says its
    storage IS `predicates`/`domain` plus the refinement layers); one
    **retired** entry (`exported`, moved to `Binding.visibility` at B-097 V1);
    one **unused** (`warnings`)
  - `knowledge` is the proof: registered exactly like `predicates`, and not
    the same kind of thing at all
  - **The change**: `registerChannel` becomes field registration, and a
    channel-level registration is introduced — *these fields, these rules,
    this semantics, this owner*. **B-109(a)** (moving registration out of the
    base to the owning layers) is the natural moment, because a layer
    registering its own capability IS a channel registration
  - Nomenclature also affects `ChannelSpec`, `ChannelWriter`,
    `channelReadRaw`, `channelSpec`, `viralChannels`, `unionChannels`,
    `installChannelMerge`, `CHANNEL_TABLE`

- [ ] **B-112** · L0 · **The four owed plane interfaces.** Raised by the
  concept spine (S2f); `concepts.md` §24 carries the interface table.
  Supersedes the open "what capability does the evaluator need" question in
  B-110 by naming it. A plane interface is the sanctioned route to a plane;
  reaching one any other way is a plane violation whatever it computes
  correctly, and **every T2 delta is an instance of an absent interface**.
  - **(a) Dispatch hook.** The evaluator needs type-directed dispatch during
    evaluation (R2 — discharge happens BY evaluating) and must not know what
    a type is. A channel installs *how to dispatch on my field*; the evaluator
    calls it with an opaque field value
  - **(b) Check hook.** `checkArgType` lives in `evaluator.ts` today. Same
    shape: a channel installs *how to check a value against my field*
  - **(c) Projection hook.** `shape` is a computed projection of `type`,
    hardcoded in `channelReadRaw`. Channels should install their projections
  - **(d) Channel registration** — see B-111
  - **All four have one form**: the base holds an INSPECTABLE SYMBOL, the
    layer installs the meaning. That is SC-7's argument (inspectable symbols
    are what keep R12 enforceable) generalised from propagation to every plane
    boundary. A hook that handed the base an opaque closure AND made it the
    authority would lose the property, so hooks must be capability-gated the
    way writers are
  - Today two of eight interface rows have a real mechanism (`dataOf`,
    `channelReadRaw` + the propagation table); four are conventions enforced
    by lint or by nothing; the layer→base row has one instance
    (`installChannelMerge`) and no general form

- [ ] **B-113** · L0 · T-tooling · **TailCall forwarding is convention-only.**
  Body wrappers (`type_check`, the `*_attach` family) must forward the
  TailCall sentinel or a tail call silently degrades to an ordinary call — a
  performance cliff, not an error. Enforced today by a recurring-lesson note
  in `PROCESS.md` §6 and nothing else. Candidate boundary invariant: a wrapper
  that swallows the sentinel should fail the suite

- [ ] **B-114** · L0 · **Completion confluence is not guaranteed by
  construction.** The B-028 arc found an arrival-order bug (an instance kept a
  stale symbol when one field resolved before another) and FIXED it with
  completion replacement — but nothing establishes that arrival order cannot
  matter. This is candidate **R16** (determinism) with no specification item
  and no test that would catch a recurrence. Needs: the property stated, then
  either a construction that guarantees it or a test that samples orders

- [ ] **B-115** · L2 · **Law backings ride two carriers.** Raised by the
  concept spine (S3, `concepts.md` §39). A proof's OWN rule backing is a set
  of plain data bindings (`equality`, `lawName`, `lawTier` — the E-R6
  fields, dispatched as `p.lawTier`); the TRANSITIVE backing set the
  assumption ledger aggregates is a host-plane property (`lawBackings`, via
  `stampBackings`/`backingsOf`). Two carriers for one concept, split by
  aggregation depth rather than by meaning, and nothing tells a reader which
  to use. Either unify them or state the rule. **Closes inside B-118(d)**
  (S5 triage): the host-plane half is one of four carriers on the wrong
  plane, and moving it to a metadata field with an accumulating rule is the
  unification

- [ ] **B-116** · L2 · **Interface's two guarantees are enforced
  independently, and one of them fails silently.** Raised by the concept
  spine (S3b, `concepts.md` §36). An interface has two properties: **no
  construct** (tested by `InterfaceKind`'s predicate, checkable from any
  value) and **all members signature-only** (guaranteed only by
  `Interface.define`'s construction, not checkable from the value). Nothing
  ties them — a type could satisfy the kind's predicate without having been
  built by `Interface.define`.
  - **The silent failure**: `Interface.define({greet: self => "hi"})` accepts
    the lambda, records `greet` as a **signature**, and **discards the body**
    with no diagnostic (measured — the member has no `value`, only a
    `fieldType`). Either reject a body at declaration or state that it is
    read as a declaration
  - **Why the definitions collapse here**: "has no construct" reads like
    ABSTRACTNESS, and in a language with inheritance an abstract type and an
    interface are different things. Allegro has no abstract types — D44
    deleted the declared is-a edge, and abstractness is defined by what you
    can EXTEND. With nothing to extend, "cannot be instantiated" and "exists
    to be drawn from" coincide, so the predicate happens to select exactly
    the interfaces. A property of this type system, not a general truth, and
    worth stating because the type system is being rebuilt around the absence
    of `extends`

- [ ] **B-117** · L2 · **The verdict is assembled out-of-band rather than
  accumulated.** Raised by the concept spine (S4b, maintainer correction —
  `concepts.md` §45). S4 had claimed this as a REQUIREMENT gap (candidate
  R15: the requirement set is per-value, the verdict is program-level). That
  was wrong. **A program is a value**, and accumulating metadata across an
  expression is what channel operations already do — effects union upward,
  errors are viral, `div` is an effect and unions too. On that model the
  verdict simply IS the top-level value's accumulated metadata, and it is
  each channel's responsibility to define an accumulation that reaches it.
  R3' plus SC-7's `union` already say this; **R15 is withdrawn**.
  - **The evidence that the implementation does not work that way**:
    `buildVerdict` in `src/pcp.ts` WALKS `evalCtx.bindings` out-of-band,
    iterating top-level bindings looking for discharged proofs, rather than
    reading accumulated metadata off a value. And the `warnings` field is
    registered with rule **`union`** — precisely the accumulating discipline —
    and is **UNUSED**. The mechanism exists and nothing reaches for it
  - **This explains B-057/CT-R6.** Contracts are missing from the verdict
    BECAUSE contracts have no accumulating field. Under out-of-band assembly,
    adding them means adding a case to `buildVerdict`; under accumulation it
    means giving contracts a field with `union` propagation and they arrive
    for free. A channel that does not accumulate is simply absent from the
    verdict — a better account than "somebody forgot"
  - Interacts with **B-112** (plane interfaces): "accumulate toward the
    verdict" is arguably a fifth owed interface, or the `union` rule applied
    at whole-program scope. Sequencing question, not a separate problem

- [ ] **B-118** · L0 · **Four carriers ride the host plane that belong on the
  metadata plane.** Raised by the concept-spine S5 triage: four deltas filed
  against three different owners are one fix. `concepts.md` §18's placement
  rule — *a plane is chosen by who may write the data and what evaluation
  must do to it* — was never applied to these, and each was put on the host
  plane because the host plane is where a JS property goes when nobody asks
  the question.
  - **(a) Inferred effects** (delta 41). The inferred set is a
    ComposedFunction expando while the DECLARED set is a metadata field with
    a `union` rule. Two carriers for one capability, split by provenance
  - **(b) The abstract domain** (delta 34b). Rides a host property on a type
    while the knowledge it belongs to is a metadata channel (§34, §34b)
  - **(c) ComposedFunction's analysis metadata** (delta 7) — `partial`,
    `decreasesMetric`, `genericParams` and the rest of
    `PRESERVED_FN_META_KEYS`, kept across clones by a hand-maintained list
    precisely because propagation does not reach them
  - **(d) The transitive law backing set** (delta 39) — `lawBackings` via
    `stampBackings`/`backingsOf`, while a proof's OWN backing is plain data
    bindings. This is **B-115**'s "unify them or state the rule", and moving
    the host-plane half onto a metadata field with an accumulating rule IS
    the unification, so B-115 closes here rather than separately
  - **The test that distinguishes this item from B-107(f)**: deltas 15 and 18
    are host-plane data that is correctly PLACED and wrongly DECLARED
    (`parent`, `isScope`, `scopePredicates` on the value interface) — that is
    B-107(f). These four are wrongly PLACED. Undeclared planes made the two
    indistinguishable, which is why they were filed apart
  - **Gated on B-109(a)** (registration moving to the owning layers): a layer
    registering its own channel is what gives these a field to move onto.
    Campaign chunk C7 — `docs/plans/concept-spine.md` §9.3
  - **Not a blanket rule.** The host plane is legitimate and §18 says what
    belongs there. Each of (a)–(d) must be argued individually against the
    placement rule; the finding is that none of them ever was

- [ ] **B-119** · L0 · **`Context` still names three different things.**
  Measured by the C9 naming pass, which deliberately stopped at the line it
  could defend. C9 renamed every DECLARED name in which "Context"/"Ctx"
  denoted the retired composite KIND — a settled decision whose surface name
  lagged. What remains is **role-qualified** and could not be renamed
  mechanically, because the roles themselves are not all settled:
  - **(a) `evalCtx` — 603 occurrences, and a public field.** It is the
    evaluation **scope**: `evalCtx = scopeNew(below)`, it has a `parent`
    chain, and `concepts.md` §15 defines Scope. So the rename (`evalScope`)
    is *settled*, but it is an API change — `evalSource`'s result field, read
    by `pcp.ts`, the CLI, the web bundle and ~100 test sites — and it was not
    in B-107's ratified scope. Recommend doing it as its own single
    mechanical commit
  - **(b) `typeCtx` / `typeContextName` / `typePrivilegedCtx` / `intCtx` /
    `proofCtx` and ~45 more.** These denote a **type Context** — a term
    `concepts.md` itself still uses, in §30's own delta. Renaming them means
    first deciding what a Structure in the type role is called, which is a
    definition question for §30 and not a naming one. **Blocked on that
    entry**, per B-107's own scope rule: *anything whose right name is still
    an open question waits for its spine entry*
  - **(c) `src/parser.ts` has its own `makeContext`** — a **parse** context,
    unrelated to either, exported as `parserMakeContext`. Left alone (the
    file is generated and `@ts-nocheck`), and recorded because it is the
    third meaning and the reason the mechanical pass had to exclude a file
  - The finding worth keeping: one word carried three distinct concepts —
    the composite kind, four value ROLES, and a parser's own bookkeeping —
    and only the first was retired. Renaming the first makes the other two
    *more* visible, not less, which is the intended outcome

- [ ] **B-120** · L0 · **The entry-sequence composite (D48(a), IC-2 option E).**
  A Structure becomes a **sequence of optionally-keyed entries** — one thing
  that is both map and list — rather than a string-keyed map plus an ordered
  list view plus a dense special case. Ruled at B-108; **not designed in
  detail — this arc gets its own plan before any code.**
  - **What decided it** (measured, 50-file corpus through the real CLI): data
    structures average **4.6 slots**, 97% have ≤ 8 and the modal size is
    **2** — a `Map` is overhead at that size. Every large by-name lookup is
    in a **scope**, and there are **227** scope objects in the whole corpus.
    `scopeLookup` runs 10,309 times; `dataOf` runs 453,199 times. The O(n)
    objection that ruled out a sequence-first composite for years was about
    the rarer operation by a factor of 44
  - **The consequence that makes it E rather than B**: the O(1) by-name
    requirement belongs to ONE role, and that role is not data. A scope keeps
    an index; the index sits **below** the specification because a scope is
    host-plane machinery
  - **What dissolves with it**: the dense region stops being a ROLE and
    becomes a representation (which its level tag always said it was); the
    materialized legacy view goes; **`__length` goes**, and with it the W6
    dense-view-coherence invariant and the entire remaining job of
    `isMetaSlotKey`. **This closes B-104(f) and B-104(b)** — the last dunder
  - **Interacts with B-121**: together they leave **one role — record** —
    which is what SC-5 said it was buying. Neither alone gets there
  - **Open for the plan**: the entry representation itself; how the scope
    index is built and invalidated; whether positional (null-key) entries and
    the dense case are one thing or two; the migration order against the 146
    role-presence sites; whether `bindings`/`bindingList` survive as views
    during migration. **Revisit trigger on the ruling**: a measured workload
    that puts large by-name lookup on the DATA path rather than the scope
    path — that is the assumption E rests on

- [ ] **B-121** · L0 · **Metadata is a field on every value, supplied at
  construction (D48(b)(c), IC-3).** **PLAN: `docs/plans/metadata-on-values.md`
  (draft, 2026-08) — chunks C1–C7, four rulings needed at §6.** The plan adds
  four probes not in this entry: retyping `withMetadata` to return `Value`
  typechecks with **0 errors** (nothing depends on attachment producing a
  Structure); `newCarrierStructure` has exactly **2 callers, both inside
  `withMetadata`** (carriers can be eliminated atomically); the evaluator's
  carrier arm is a hand-written dispatch to the inner kind, which the new
  representation performs by construction; and **185** `kind ===/!==
  ValueKind.Structure` comparisons are the real — behavioural — risk surface. The carrier is deleted: a non-composite
  value no longer becomes something else in order to carry a field. Ruled at
  B-108; **arc, not a chunk — plan first.**
  - **What decided it**: of 240,820 value allocations, **56,123 are
    carriers** — 74% of all structures, and more than there are Bits values
    (35,060) — and **98.5% hold exactly one field** (99.4% of that is
    `type`). `dataOf` is called 453,199 times and really unwraps 182,311
    (40%). The most common act in the system is allocating an eleven-field
    `Structure` so a `Map` can hold one entry
  - *Baseline note (2026-08): **B-122 has since removed 17,169** of those, so
    the live figures are 38,954 carriers and 70.2% of structures. The ruling
    rests on the shape, which is unchanged — carriers still outnumber the
    Bits values they wrap*
  - **It is not a new mechanism.** Structures already work this way —
    `withMetadata` with a Structure primary takes `deriveWithChannels`, no
    carrier. The carrier exists only because the other six kinds have nowhere
    to put the field. The **read surface needs no change**: `channelReadRaw`,
    `componentsView` and `cloneComponents` already take a `Value`, cast, and
    read `.components`
  - **(a) Host shape.** `MetadataBearing { meta?: Metadata }` (with
    `Metadata = Map<string, Value>`) extended by all seven value interfaces;
    `Structure.components` renamed `meta` — `components` reads like *parts of
    a composite*, i.e. the data plane, which is what it is not
  - **(b) Why optional, and it is NOT laziness.** Allegretto defines no
    fields (R6/R11), so under `--base` a value legitimately carries nothing.
    The two populations without metadata are: every value in Allegretto mode,
    and engine intermediates that never become program values. It **cannot**
    be a required argument of `makeInt` — that would make L0 depend on a
    concept it does not have, B-110's violation in the construction path.
    Optional in the type, **always declared on the object**, per the stable-
    hidden-class convention `types.ts` already states on `makeParam`
  - **(c) Construction takes metadata.** 12 call sites literally read
    `withMetadata(makeInt(0), m)` — the value never exists without it — and
    one of them is **PE Rule 1** (`evaluator.ts:511`,
    `withMetadata(makeExpr(residualFn, evalArgs), components)`), on the path
    that allocates 101,611 Expressions. The factories already exist and are
    already an enforced chokepoint (W4); they simply do not take metadata
  - **(d) Four operations, four names.** Classifying all 45 non-test call
    sites: **create** (12), **derive** — same datum, new metadata (10),
    **map** — new datum, metadata carried (9), **stamp** (~14). The map case
    is spelled as TWO calls (`withMetadata(newP, cloneComponents(v))`) and
    omitting the second **silently drops metadata** — the same
    convention-only obligation as the TailCall sentinel (B-113). Naming it
    removes the way to get it wrong
  - **(e) The clone concerns are already solved, per kind.** Carriers wrap:
    Bits 50.5% (none), PrimitiveFunction 46.0% (host expandos — `primitives.ts`
    already clones one and re-stamps `CHANNEL_WRITER_BRAND`), ComposedFunction
    1.3% (`param.owner`, `PRESERVED_FN_META_KEYS` — the shared helper CLAUDE.md
    mandates), Expression 1.3% (`memo` — the clone must SHARE it), Param 0.8%,
    **Symbol 0.0%** — so the interning hazard (SC-4: identity = FQN) does not
    arise today. **RULED (maintainer, 2026-08): `param.owner` continues to
    represent the ORIGINAL function.** This is the behaviour-preserving
    answer and the one `remapParams` already implements; stated here rather
    than inherited, because PE's Param-call branch reads it and a clone that
    silently re-pointed it would change evaluation
  - **(f) Why copy-on-attach, stated once so it is not re-litigated.**
    Measured: 59,027 attachments, **19,817 (33.6%) targeting an object that
    has already been given metadata**. Metadata is a property of a value *in
    a position*, not of the datum. Both no-allocation designs fail on that
    one number — in-place mutation lets the second stamp overwrite the first
    everywhere the value is held, and a side table (`WeakMap<Value,
    Metadata>`) fails identically because its key is the object. D22 is the
    rule adopted *because* of this, not the reason itself
  - **(g) The legitimate in-place case, to be stated as a rule**: while a
    value is provably unshared — during construction, before it escapes. The
    carve-out already exists twice (`structure.ts`'s grandfathered builder
    idiom; `writeShape` for identity-sensitive type Contexts, ruled at B-104
    chunk 3) as an idiom rather than a rule. *Stamp in place only before the
    value escapes; after that, derive*
  - **Migration is strictly additive** and each step lands green: (1) add
    `meta?` to the six interfaces, rename `Structure.components` → `meta` —
    no behaviour change, nothing writes it yet, the readers already read it;
    (2) attach to a per-kind clone instead of a carrier — one function, the
    only risky step; `dataOf` still compiles and returns `v`; (3) delete
    `primary` (194 occurrences), `isCarrier` (14), `newCarrierStructure`, W1
    and its walker; (4) delete `dataOf` (902 occurrences) and its call sites
  - **Separate, and possibly bigger**: **25,842 carriers wrap
    PrimitiveFunctions** — registry singletons — each holding one `type`
    field, and 33.6% of all attachments hit an already-attached object. That
    smells like the same primitive being typed identically over and over.
    Memoizing `(datum, fields) → value` is orthogonal to this item and was
    not measured; do it as its own investigation, not inside this arc

- [x] **B-122** · L0 · **LANDED 2026-08.** `wrapAsUntypedFunction` rebuilds a
  constant, once per primitive per scope-layer build.
  - **Result, measured before and after on the same instrumentation:**
    carriers **56,123 → 38,954** across the corpus — **17,169 allocations
    removed, exactly the predicted hit count** — and total structure
    allocations 72,691 → 55,522 (**−23.6%**). Prediction and outcome agreeing
    to the unit is worth recording on its own: the memo key
    `(datum identity, field identities)` modelled the real duplication
    exactly, which is why the investigation could rule out the general memo
    with confidence rather than by taste.
  - **Implementation**: a `WeakMap<object, Value>` in `types-std.ts`,
    memoizing **only** `PrimitiveFunction` inputs, where determinism is
    *provable* rather than argued — a PrimitiveFunction has no `primary` (so
    `dataOf` is identity) and no `components` (so `cloneComponents` is
    empty), and `UntypedFunctionType` is a module-level const. Other inputs
    take the unmemoized path, because a Structure's components can still be
    populated during construction and a cache must not rest on a claim about
    every possible input.
  - **Test** (`types-battery.ts`) pins both halves: the same primitive
    answers the same wrapper object, and **two independent evaluations
    resolve `print` to the same object** — the property that makes the saving
    scale with scopes and modules rather than being per-call.
  - *Original analysis follows.* Result of the memoization investigation
  the D48 review flagged (2026-08). The investigation's answer is **do not
  build a memo** — the win is one loop-invariant, and hoisting it needs no
  cache at all.
  - **What was measured** (pre-landing). Keying every `withMetadata` call by
    `(datum identity, field names + field-value identities)` over the 50-file
    corpus: **19,070 of 59,027 attachments (32.3%) are exact repeats**. But
    they are not spread out — **17,169 of them (90%) are one kind**:
    PrimitiveFunction, at a **66.4%** repeat rate. Bits repeat only 5.8%,
    Structure 0%, Param 0%
  - **The single cause.** `wrapAsUntypedFunction(prim)` in `types-std.ts`
    does `dataOf(fn)` + `cloneComponents(fn)` + `set("type",
    UntypedFunctionType)`. For a bare registry primitive that is
    **deterministic** — same input object, same constant type, same result
    every time. It is called from **two** Layer-1 builders that each iterate
    every primitive (`runtime.ts:148`, the resolution map; `runtime.ts:743`,
    the primitive scope layer), and again per module load
  - **Single-process counts**: `tests/arrays.alg` → **354 calls over 177
    distinct primitives**; `tests/modules.alg` → **708 calls over the same
    177**. So the wrapper is rebuilt 2× per primitive per process, 4× with
    one module, and it scales with module count
  - **The fix is D48(c), not a cache.** Give the primitive its type where the
    primitive is created — once — and let both Layer-1 builders reference the
    same value. No content key, no 40k-entry table, no retention hazard.
    354 → 177 for a single file; the saving grows with modules
  - **Why sharing one wrapper object is safe**, by an argument the code
    already relies on: the untyped branch of both builders already binds the
    **same singleton** `prim` into every scope, visibility lives on the
    Binding not the value (D42/V-R4), and the wrapper is an immutable value —
    anything attaching further metadata derives a new one
  - **Why a general memo is NOT worth building.** After this hoist the
    residue is **1,901 repeats — 3.2% of attachments** (Bits 1,657,
    ComposedFunction 225, Expression 19). Capturing that would need a
    content-keyed table of ~40,000 entries holding values alive, to avoid 3%
    of allocations. The measurement argues against the general mechanism as
    clearly as it argues for the specific fix
  - **Independent of B-120/B-121** and survives both unchanged: in either
    representation the point is that the typed primitive is built once. Can
    land before them or inside B-121's construction work
