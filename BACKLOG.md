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
> only record is an archived plan (`.claude/plans/archive/README.md` has
> the triage record). Working one means: read the archived source,
> revalidate against `docs/design/allegretto/structures.md` and the code,
> then incorporate into the named target doc or discard with a note here.

## Sequenced head

Implementation chunks reference `.claude/plans/structures-implementation.md`
(status: active — Phases 0–1 approved; PROCESS §3 go-ahead required per
phase).

- [x] **B-001** · L0 · Boundary-test harness + baseline (chunk C0.1):
  accessor lint w/ ratchet, invariant property checks, forgery-suite
  skeleton, perf floor — plan §Phase 0. Landed 2026-07
  (`src/boundary-tests.ts` + `src/boundary-baseline.json`); perf hard
  threshold still a pending maintainer decision (warn-only at 2×)
- [ ] **B-002** · L0 · docs: inline the D39 slot-disposition, B8 primitive
  audit, and B10 forgery tables into `docs/design/allegretto/structures.md`
  as appendices; then archive `structured-values-unification.md`
- [ ] **B-003** · L1 · `[reval]` docs: sync shipped extension error codes +
  base-chain semantics into `docs/grammar-formalism.md` §6–7 (decisions:
  `docs/design/extension/grammar.md` §4; source:
  `.claude/plans/archive/dappled-cascading-cantor.md`)
- [ ] **B-004** · L2 · `[reval]` docs: effects nits — silent-capture
  rationale for explicit `[e: Effect]` into
  `docs/design/standard/effects.md` §2; `applyComposed` tracing hypothesis
  (archive: polyphonic-tracing-plotkin P9) filed or dropped
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
  `.claude/plans/archive/lucid-discharging-lambek.md`,
  `.claude/plans/archive/crystal-proving-curry.md` §Phase C; substrate:
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
- [ ] **B-017** · L0 · Observation effect; pure recheck vs certificate
  peek; congruence tests (C3.3)
- [ ] **B-018** · L2 · `[reval]` Totality design revalidation →
  `totality.md` in `docs/design/standard/`: severity policy (**reconcile
  v1 info-by-default with structures.md D34 strict-by-default as an
  explicit migration decision**), exhaustiveness taxonomy, mutual-recursion
  lexicographic design, totality polymorphism, decreases obligations,
  counterexample shapes (source:
  `.claude/plans/archive/phase-e-totality-plan.md`)
- [ ] **B-019** · L0 · Structure kind — representation swap behind
  accessors (C4.1)
- [ ] **B-020** · L0 · Arrays as numeric structures w/ dense region (C4.2)
- [ ] **B-021** · L0 · Transparency cutover; retire `primaryOf` + wrapper
  shims (C4.3) — second conscious-delta chunk
- [ ] **B-022** · L0 · FQN symbols: interning, registration, projection
  (C5.1)
- [ ] **B-023** · L2 · Symbol-keyed members + draw-from binding; diamond
  multi-bind; ambiguity rule (C5.2)
- [ ] **B-024** · L2 · define-a-kind recipe; constructor authority;
  `Type : Type` fixed point (C6.1)
- [ ] **B-025** · L2 · Effect re-derived through the recipe; anonymous
  conjunctions; `pure subtypeof Effect` flip (C6.2)
- [ ] **B-026** · L2 · Proof re-derived (kernel-private authority);
  slot-disposition sweep; forgery battery re-run (C6.3) — **M1 exit
  criterion**
- [ ] **B-027** · L2 · Equality protocol + lawful interfaces — design
  ratification pass on structures.md §7–8, then own plan
  (`equality-and-laws.md`) per structures-implementation §3
- [ ] **B-028** · L0 · Completion effects & futures — own plan
  (`completion-effects.md`): `div`, blocking-read, triggered guard,
  discharge tiers (structures.md §10)
- [ ] **B-029** · L2 · `[reval]` PCP protocol design revalidation →
  `pcp.md` in `docs/design/standard/`: schemas, multi-prover authorship,
  trivial-pass prevention, hints, catalog (H5), budgets/escalation (H7),
  benchmark methodology (source:
  `.claude/plans/archive/phase-h-plan.md`; shipping shape `src/pcp.ts`)
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
  intent (source: `.claude/plans/archive/crystal-proving-curry.md`) —
  revalidate against v2 before scheduling
- [ ] **B-052** · F6 Lean export: proof terms → Lean, refinements →
  subtypes, verified-substrate `Allegro.lean` → `proofs.md` in
  `docs/design/standard/` (source:
  `.claude/plans/archive/phase-f-plan.md` §F6)
- [ ] **B-053** · Phase G expansion: provable stdlib rewrite (sort/search
  + algebraic theorems on map/filter/reduce)
- [ ] **B-054** · PCP H5 proof catalog (`proofs.json` per project)
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
  against v2 graph shapes; Grammar 2 "Phase 9" emitter folds in here)

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

### L3 — Vivace (M5)

- [ ] **B-079** · `[reval]` Planning DSL revalidation → `planning-dsl.md`
  in `docs/design/vivace/`: outcome-DAG model, 12 conventions, rejections,
  `SoftwareRelease` example; Shape 1/2 + pilot roster proposed into
  VISION §4 (Tier 0 — propose, don't land). Source:
  `.claude/plans/archive/project-1-planning-dsl-design.md`.
  `lib/planning.alg` stays paused until then
- [ ] **B-080** · Vivace DSL candidates (post-pilot roster): logic
  programming, constraint programming, data modeling, numerical methods,
  software-systems modeling, workflow/process, automatic reasoning, UI
  modeling, data/analytics; semantic-model variants (functional/
  imperative/mixed) as extensions
- [ ] **B-081** · Counterexample legibility — domain-specific failure
  rendering layer (foundational; coupled to the AI iteration loop; see
  `docs/VISION.md` §4)
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
