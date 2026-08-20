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
- **Tranche C — next arc (in progress):** B-027 equality + lawful
  interfaces — plan `equality-and-laws.md`, decisions E-R1–E-R6
  maintainer-ratified 2026-08 (with E-R3 generality note: laws are
  member-set-general, not interface-only); chunks E1–E4 underway. Then
  S3 visibility (D41–D43, designed+ratified), then B-028 completion
  effects. M4 reval docs (B-014, B-018, B-029) ride between chunks.
- **Track R — public release (started 2026-08, runs alongside
  functional tranches):** positioning plan `release-track.md`
  (differentiator map + claims register + demo ladder); VISION §1a/§5
  amendment (three moves, substrate/surfaces, claims discipline —
  Tier-0, pending ratification). Items B-090–B-093 below. The ladder's
  higher rungs feed functional sequencing (constraint/units substrate,
  solution finding) rather than competing with it.
- **Parked consciously:** B-087 (awaiting use cases), full
  `ContextValue`→`StructureValue` reference migration (opportunistic),
  perf hard threshold (maintainer decision, any time).

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
- [ ] **B-014** · L2 · `[reval]` Contracts design revalidation →
  `contracts.md` in `docs/design/standard/`: predicate-set model, branch
  refinement, assert/requires/ensures lowering, sink-based checks,
  invariant inheritance, `assume` rejection + constructor pattern,
  refinement-vs-contract guidance (sources:
  `docs/plans/archive/lucid-discharging-lambek.md`,
  `docs/plans/archive/crystal-proving-curry.md` §Phase C; substrate:
  structures.md §4/§6) — natural slot: with Phases 2–3
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
- [ ] **B-018** · L2 · `[reval]` Totality design revalidation →
  `totality.md` in `docs/design/standard/`: severity policy (**reconcile
  v1 info-by-default with structures.md D34 strict-by-default as an
  explicit migration decision**), exhaustiveness taxonomy, mutual-recursion
  lexicographic design, totality polymorphism, decreases obligations,
  counterexample shapes (source:
  `docs/plans/archive/phase-e-totality-plan.md`)
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
- [ ] **B-028** · L0 · Completion effects & futures — own plan
  (`completion-effects.md`): `div`, blocking-read, triggered guard,
  discharge tiers (structures.md §10)
- [ ] **B-029** · L2 · `[reval]` PCP protocol design revalidation →
  `pcp.md` in `docs/design/standard/`: schemas, multi-prover authorship,
  trivial-pass prevention, hints, catalog (H5), budgets/escalation (H7),
  benchmark methodology (source:
  `docs/plans/archive/phase-h-plan.md`; shipping shape `src/pcp.ts`)
- [ ] **B-030** · L2 · M3 sweep: disposition every remaining `TBD` in
  `V1-INVENTORY.md`; re-verify canaries (provable.alg theorems, bench
  corpus, stdlib effects tags)
- [ ] **B-031** · L2 · docs: revise `docs/proving-in-allegro.md` to the
  v2 surface (it is the PCP LLM worker's system primer — must track the
  shipping kernel); re-baseline `bench/`

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
- [ ] **B-057** · Phase C polish (scope decided during B-014): sink-based
  check generation at call sites, relational predicates (`a < b`),
  `assumes` trust-boundary form, ensures referencing params
- [ ] **B-058** · Per-project notification-severity config (kind →
  severity remap; substrate shipped in v1)

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
- [ ] **B-069** · CLAUDE.md slimming completion (history → CHANGELOG;
  session contract only)
- [ ] **B-087** · Totality-analyzer performance: the Stage 2/3 termination
  tests cost ~200s of the suite (one 84s .alg file; a single factorial
  check 42s — profile from the 2026-07 suite-cost pass). Looks
  pathological (suspect: per-call-site refinement-type re-evaluation in
  `totalityCompileCtx` without caching). Production-code change — needs
  its own verified chunk; also the natural moment for the B-018 severity
  reconciliation if the analyzer is being reworked anyway

### T-host

- [ ] **B-070** · Browser runtime packaging (core is browser-compatible)
- [ ] **B-071** · Async I/O capabilities: filesystem, networking, process,
  WebSocket, timers (env-provided, effect-labeled)

### T-backend (M8)

- [ ] **B-072** · Code generation: expression graph → JS first;
  continuations decision feeds B-048/B-073 (v1 "Phase I" — revalidate
  against v2 graph shapes; Grammar 2 "Phase 9" emitter folds in here).
  v1 Phase-I substrate + plan preserved at branch
  `archive/v1-references` (parent c553710) — pre-rework, reference only

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

- [ ] **B-095** · Methodology adoption (majodali/methodology v1.0.0) —
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
  sweep (structures.md C7.2, release-track §7 R-R3–5). Gate: owner
  samples entries for fidelity. Remaining chunks: 3 authority
  relocation (K-001/K-002/K-007 — plans/memory/CLAUDE.md slim/backlog
  move), 4 close-out + coordination (portfolio register row,
  practices §5 stale-data amendment)
- [ ] **B-096** · T-tooling · Deployed-version verification (owner,
  chunk-1 gate): make "what is live at allegrolang.org" checkable —
  e.g. deploy.sh stamps the git commit/version into the published site
  (a `/version.json` or footer stamp) and a verify step compares it to
  main, so `[stage: live]` designations are auditable instead of
  attested. Feeds the methodology's form-audit tooling picture
  (Constitution Article 11)

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
- [ ] **B-087** · Predicate/domain propagation onto residuals —
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
