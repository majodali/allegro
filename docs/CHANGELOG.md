# Allegro — Changelog

> Tier 2. Append an entry per landed chunk (see `docs/PROCESS.md` §5).
> Newest first. Each entry: what landed, key decisions, deviations from
> plan, test count.

*Stub — the per-phase history currently embedded in `CLAUDE.md` ("What's
Next" / completed-items section) will be migrated here verbatim during the
2026-06 documentation refactor; new entries are appended here from now on.*

## 2026-07 — C2.1: Scope protocol + parent chain (structures Phase 2, B-011)

Phase 2 opens: scopes (evaluation) and structures (data) become distinct
planes with real layering.

- **`src/scope.ts`**: `scopeNew`/`scopeExtend`/`scopeLookup`/
  `scopeBindings` over the current ContextValue, plus chain-aware reads
  for the compile-mode flag and Phase-C scope predicates. `parent`/
  `isScope` are host-plane fields on ContextValue — never value slots.
- **Chain-walking Symbol lookup** in the evaluator (nearest layer wins;
  degrades to today's flat lookup on legacy contexts — zero behavior
  change, full suite as oracle).
- **The unification flatten-copy is gone**: call-site type-variable
  enrichment (`enrichedCtx`) previously copied every inherited binding —
  hundreds per call — to add a few type variables; it now layers an O(1)
  child scope. Structurally verified by boundary test (10k-binding
  parent → child owns exactly its own entries; 2000-layer chain lookup;
  shadowing semantics).
- **Plane rejection both ways**: `scopeExtend` refuses shape-carrying
  data Contexts; `type_dispatch` refuses evaluation scopes
  (`assertNotScope`) — the "no type-dispatch on scopes" boundary test.
- **Scoping deferral (recorded)**: the root evaluation context
  (buildEvalCtx's primitives → extensions → base → source flattening)
  stays flat until C2.3, whose resolution unification owns exactly the
  consumers that iterate that flat view (REPL persistence, module
  extraction, forward chaining). The root is marked `isScope` now.

## 2026-07 — C1.5b: `*_attach` collapse — body-form metadata off the AST (B-010 part 2; Phase 1 complete)

The five metadata wrappers (`partial_attach`, `decreases_attach`,
`effects_attach`, `param_effects_attach`, `proven_attach`) are now a
parse-time encoding only. A new `collapseBodyMetadata` pass in
`evalSource` — after symbol resolution (so metric/predicate ASTs carry
resolved Params), before tail-call marking (which now sees real bodies) —
peels the wrapper chain off every reachable function body, descending
through `type_check` layers, and stashes the metadata as host-internal
function properties (registered in SLOT_REGISTRY; preserved across
subst/remapParams clones via `PRESERVED_FN_META_KEYS`).

- Analyzers read properties instead of walking AST shapes: totality
  (`isFunctionPartial`, the decreases-metric site), proven, effects
  (`unwrapEffectsAttach` reimplemented over the property, same name),
  introspection, and `typed_function_impl`'s param-effects stamping.
- The peeler family is deleted (`findAttachWrapper`,
  `unwrapPartialAttach`, `unwrapDecreasesAttach`, `unwrapProvenAttach`,
  `_WRAPPER_NAMES`). The wrapper primitives stay registered as inert
  passthroughs — defense for any uncollapsed path.
- Six peeler-shaped unit tests reworked into collapse-equivalents, per
  the §6 item-3 ruling (test-condition changes pre-discussed).
- `type_check` and `requires`/`ensures` untouched (runtime checks, per
  ruling).

With C1.5b, **Phase 1 (accessor layer + channel plane) is complete**:
registry, accessors, hard-fail lint, capability-gated origination,
propagation table, and body-form metadata all live behind the boundary.

## 2026-07 — C1.5a: Propagation table + channel-aware mode (structures Phase 1, B-010 part 1)

First conscious-delta chunk, first half. The three §6 deltas were
discussed and ruled with the maintainer before work started (rulings
recorded in the plan §6): observable-zero at C1.5 with principled-rule
divergences deferred to C4.3; flip the strip-dodging proof primitives to
a new eager-but-channel-aware mode; `*_attach` collapse scoped to the
five metadata wrappers.

- **Differential safety net first**: 11 byte-for-byte fixtures of channel
  propagation recorded BEFORE any evaluator change — including two legacy
  warts preserved deliberately (chained-residual error loss;
  error-in-if-condition silently taking the else branch). Asserted every
  suite run; revisited at C4.3.
- **Propagation table**: generic `viralScan` driven by the channel
  registry replaces both hand-rolled error loops — a newly registered
  viral channel now propagates with zero evaluator changes. Union merges
  are installable per channel (`installChannelMerge`; effects installs
  its own encoding-aware merge). `assertPropagationTableLinkage` fails
  startup if the registry ever drifts from what the evaluator implements
  (shape/knowledge stay bespoke — that is what `computed` means; effects
  grandfathered on its dedicated path until C4.3; discharged is `drop`).
- **Channel-aware registration mode** (third mode on `makePrimitive`):
  eager evaluation, but args arrive as full values with channels intact.
  Six strip-dodging proof primitives flipped
  (refl/sym/trans/cong, prove_for_all_bool, prove_induction). **Briefing
  correction**: `proof_check` stays lazy — it reads the *unevaluated*
  proposition AST (`eqExprSides`), making it genuinely lazy, not a
  strip-dodge (the ruling said 7; the code says 6).
- **Forgery C live** (5 of 6 scenarios now real attack tests): the
  authority channel is excluded from both propagation executors,
  fabricating rules are rejected at registration for integrity channels,
  and combining a real proof with other values through operations never
  yields a discharged result.

C1.5b (the five-wrapper `*_attach` collapse onto function-value channels)
follows as its own landable unit.

## 2026-07 — C1.4: Channel writers — origination capabilities (structures Phase 1, B-009)

The channel plane gets its capability model (D21–D24), and the forgery
suite goes live.

- **Headline finding: forgery scenario A was a real hole.** Before this
  chunk, the Allegro object literal `{__discharged: 1, __proposition:
  "forged"}` produced a Context structurally indistinguishable from a
  discharged proof — `proofCtx`'s structural check accepted it. Closed by
  construction-path gates: object literals and `mv_set` refuse integrity-
  channel keys with a clear D21–D24 error.
- **Channel registry** (`src/slots.ts`): all 9 built-in channels
  registered with their propagation rules (shape computed, error viral,
  effects union, knowledge computed, discharged drop+integrity, …) —
  recorded now, consulted by C1.5's propagation table. Registration is
  one-shot and returns the write capability as a closure (D24);
  integrity channels reject fabricating rules (viral/union) at
  registration (D23).
- **Kernel-private discharged writer**: acquired via
  `kernelChannelWriter("discharged")` at exactly the two origination
  sites — primitives.ts (failed proofs) and types-std.ts (`makeProof`).
  A new lint pattern restricts acquisition to those two modules; the raw
  stampers are no longer exported. The writer is never bound into any
  Allegro extension.
- **Allegro surface**: `channel_register(name, rule) → writer`,
  `channel_read(value, name)` / `channel_list(value)` (authority-free,
  D23), `channel_attenuate(writer, predicate)` (delegable attenuation,
  D24 — brand-checked, so a hand-rolled lambda is refused). Registration
  is epoch-sealed: the evaluator's fixpoint loop re-evaluates top-level
  bindings within a pass, so same-pass identical re-registration returns
  the held writer; a later program's re-registration throws (capability
  held).
- **Forgery suite v1**: A, B, D, F are live attack tests (object-literal
  forge, proposition swap under discharge, free-read/gated-write,
  writer counterfeit + cross-program re-mint). C unlocks at C1.5, E at
  S3. The hard-fail lint proved itself mid-chunk by catching a drive-by
  dunder literal in this chunk's own new code.
- **Scoping decision** (recorded for review): non-integrity channels keep
  their existing single-function origination chokepoints (withType,
  error creation, withEffects, withPredicates); full writer indirection
  for them lands with C1.5's propagation table, where those functions
  collapse into writer + table entries.

## 2026-07 — C1.3: Accessor migration complete + lint hard-fail (structures Phase 1, B-008)

The enforcement moment for the base/extension boundary. All 12 remaining
files migrated (~360 sites: 222 mechanical `primaryOf` → `dataOf` renames
plus ~100 individually-reviewed literal/component sites across
primitives, totality, refinements, introspect, runtime, proofs, effects,
pcp, proven, modules, and the two grammar2 files). Every production file
is now at ZERO forbidden-access occurrences except the sanctioned
`src/slots.ts`, and the baseline's `hardFail` flag is flipped: **direct
slot access outside the accessor layer is a suite failure from this
commit on** (negative-tested — a single injected occurrence trips it).

Accessor layer additions: presence checks (`hasName`, `hasShapeSlot`,
`hasDischarged`); set-only proof stampers (`stampProposition`,
`stampDischarged`, `stampProofReason`, `stampProofCounterexample`,
`stampEqOperands`) that mirror the proof kernel's map-only origination
idiom exactly — these are the chokepoints C1.4 wraps with the
discharged-channel writer capability; `renameInPlace` preserving the
auto-naming pass's deliberate mutate-map-entry-only semantics.

tsc clean under the sanctioned invocation; 986/986 green — zero behavior
change. Phase 1 remaining: C1.4 (channel writers + forgery suite v1),
C1.5 (propagation table — first conscious-delta chunk).

## 2026-07 — Suite-cost pass + CI (B-005, pulled forward)

Response to the maintainer's verification-cost concern. Profile findings
(from the new per-test timing): 542s wall clock — 156s of it the boundary
registry corpus walk *re-evaluating* .alg files the file tests had already
evaluated, and ~200s in the totality-analyzer tests (pre-existing,
tracked separately).

- **Registry walk piggyback**: `runAlgFile` now walks each file's values
  for registry completeness at evaluation time (memory traversal, ~ms);
  the boundary section consumes the collected results instead of
  re-evaluating the corpus. Coverage *improved* — all ~45 file tests are
  walked now, including the `use`/`import` ones the standalone corpus
  skipped. Standalone `runRegistryCompletenessCorpus` retained for
  harness-independent use.
- **Two-tier verification**: `ALLEGRO_TEST_FILTER=<regex>` runs only
  matching tests for dev iteration (measured: 8s vs ~9min). Filtered runs
  print a `DEV RUN` banner and suspend the suite floor — they are
  explicitly not a landing gate. Landings still use the full suite, one
  run per landed group, in the background.
- **Timing in every summary**: wall clock, per-section times, 15 slowest
  tests — suite-cost regressions are now visible on every run.
- **tsc debt paid**: the TS2300 duplicate-import block in test.ts and the
  TS2304 missing `ExpressionValue` import in primitives.ts are fixed. The
  only remaining diagnostics are the 4 sanctioned TS6059s from the
  documented bench/pcp/scripts out-of-rootDir convention.
- **CI (B-005)**: `scripts/typecheck.sh` — the sanctioned invocation —
  fails on any diagnostic except that TS6059 family (negative-tested with
  an injected type error). `.github/workflows/ci.yml` runs typecheck +
  the full suite on every push/PR; `npm run typecheck` added.

Known remaining hotspot, deliberately untouched here (production-code
change → own chunk): the totality-analyzer tests (~200s — an 84s single
.alg file among them) look pathological and deserve investigation.

## 2026-07 — C1.2: Accessor migration, core files (structures Phase 1, B-007)

`evaluator.ts` and `types-std.ts` — the two files that define how state is
accessed — now go entirely through the accessor layer. Zero lint
violations in both; the ratchet drops 738 → 500 total occurrences.

- **Write side added to `slots.ts`**: `setName` … `setSlotCount`,
  `writeShape`/`writeDischarged` channel-plane shims (C1.4 gates
  origination with capabilities on top of these), removal helpers
  (`removeConstruct` collapses the delete + bindingList-splice triple),
  `SLOT_KEYS` constants for residual key-filter idioms (copy loops,
  bindingList lookups), `isMetaSlotKey`, `getInterfaceMarker`,
  `isGenericTypeSlot`, `getGenericConstructor`/`setGenericConstructor`
  (GenericType's `__constructor` is semantically distinct from a concrete
  type's `__construct` — kept as separate accessors).
- **`dataOf`** — the accessor-layer name for today's `primaryOf`. All ~60
  core-file call sites renamed; the C1.5/C4.3 semantics change
  (strip-vs-preserve retirement, then transparency cutover) now happens in
  exactly one place. `cloneComponents`/`componentsView` cover the
  component-carry idioms; effect-var label helpers absorb the
  `"__effectvar:"` marker literals.
- **Migration**: ~250 sites total (92 regular shapes mechanically, the
  rest individually reviewed — binding-object reads, generic-type
  readers, delete triples, error-component peeks, property-style
  `__effectBound`/`__abstractDomain` accesses). `types.ts` was already
  clean. One incidental cleanup: buildGenericType had a duplicate
  bindingList push in its mark-as-generic block; collapsed into the shim.

tsc at the pre-existing baseline; 986/986 green — zero behavior change,
full suite as the oracle.

## 2026-07 — D39 addendum: three slot dispositions ratified (follow-up to C1.1)

Detailed maintainer review of the three slots C1.1 flagged as absent from
D39's table; all three rulings recorded in `structures.md` (D39 addendum)
and `src/slots.ts`:

- **`__effectBound`** → member on the Effect instance for now; dissolves
  into the instance's canonical label-set representation when Effect
  re-derives through the kind recipe (C6.2) — the bound is derivable
  (pure → ∅, named → {name}), so it won't survive as standing storage.
- **`exported`** → scope-binding visibility metadata (S3, base concept of
  the Scope protocol), NOT a value channel: export-ness belongs to the
  binding, and the current value-plane marker has an aliasing wart
  (`y = x` silently exports `y`). Stopgap dissolves at the Phase 2 scope
  split / module rework.
- **`arity`** → deleted. It was write-only — set in
  `wrapAsUntypedFunction`, read nowhere in the repo. The write and the
  unused parameter are removed; registry entry retained as audit record.

986/986 green.

## 2026-07 — C1.1: Slot & channel registry + typed accessors (structures Phase 1, B-006)

New `src/slots.ts` — the D39 disposition table as code, and the seam the
Phase 4 representation swap will happen under.

- **Registry**: 56 registrations covering every `__*` slot and MultiValue
  component in production code (inventoried by grep, cross-checked against
  D39). Each entry: current name, physical storage (context-binding /
  js-property / mv-component / binding-name-prefix / label-marker), owning
  kind, disposition (member / channel / base-concept / host-internal /
  delete), and post-migration target. Exact + prefix matching
  (`__future_`, `__grammar`, `__anon_`, …).
- **Typed accessors** (read side): `getName`, `getMembers`, `getParent`,
  `getConstruct`, `getPredicate`, proof/effect/generic field readers,
  `asContext` (MultiValue peel), and channel-plane reads
  (`channelReadRaw`, `channelList`) that treat `__type`/`__discharged` as
  the shape/discharged channels they will become. No call-site migration
  yet (that's C1.2/C1.3).
- **W3 registry-completeness invariant** in the harness walker: any `__*`
  Context-binding key or MultiValue component key not covered by the
  registry is a violation — the D39 "no new `__*` slot" rule enforced
  mechanically. Negative-tested (forged `__bogusSlot` + bogus component
  both fire). Corpus walk: all 27 self-contained tests/*.alg files
  evaluated and walked — zero unregistered keys on first pass.
- **Lint hardening**: scan now includes untracked files (a new module full
  of violations was previously invisible until committed). `src/slots.ts`
  is the first `allowedFiles` entry — exempt from the ratchet as the
  sanctioned home (its 74 dunder literals + 3 components accesses are
  recorded transparently in the baseline).
- **Three dispositions proposed, not in D39's table** (flagged for
  maintainer review): `__effectBound` → Effect.bound (member, by analogy
  to the refinement predicate/domain pair); `exported` component →
  visibility/exports channel (module system); `arity` component →
  Function member.

986/986 green (2 new tests). Zero production-code behavior change.

## 2026-07 — C0.1: Boundary-test harness + baseline (structures Phase 0, B-001)

First chunk of the structures-unification implementation plan. New
`src/boundary-tests.ts` wired into the suite, four instruments:

- **Boundary lint** — counts forbidden direct-access patterns
  (`.components`, `__*` string literals, `bindings.get("__…")`,
  `primaryOf` outside its definition site) across production sources
  (excludes generated `parser.ts`, `test.ts`, and the harness itself)
  against a committed baseline (`src/boundary-baseline.json`: 14 files,
  661 occurrences). Ratchet semantics: an increase fails the suite
  (negative-tested); a decrease prints a tighten note; regenerate with
  `npx tsx src/boundary-tests.ts --write-baseline`. A `hardFail` flag +
  `allowedFiles` allowlist are in place for C1.3's flip to zero-tolerance.
- **Invariant property checks** — deterministic (mulberry32, fixed seed)
  generator builds 40 small well-typed-by-construction programs, evaluates
  them through the public `evalSource` surface, and walks every result +
  binding asserting W1 (a MultiValue's primary is never a MultiValue) and
  W2 (a resolved `type` component's primary is a Context). Invariant set
  grows per phase (transparency, key-sort partition, immutability).
- **Forgery-suite skeleton** — D21's scenarios A–F as named, visible,
  skipped entries with their blocking mechanism and unlock chunk recorded
  (A/B/D/F → C1.4, C → C1.5, E → S3 enforcement).
- **Baseline snapshot** — basics.alg print-output equivalence under the
  standard type system; a suite-count floor (979, enforced in test.ts's
  summary as a mass-disablement tripwire); a coarse perf floor over three
  fixed workloads (basics, 50k TCO recursion, map/filter/reduce chain),
  **warn-only at 2×** — the hard regression threshold is flagged as a
  pending maintainer decision per plan §5.

Plan status flipped to **active** (maintainer approved Phase 0). No
production-code changes; zero behavior change. 984/984 green (979 + 5
harness tests).

## 2026-07 — Layer model, docs reorg, backlog rebuild

- `docs/design/layers.md`: the architectural spine — L0 Allegretto / L1
  extension substrate / L2 Standard / L3 Vivace with strict one-way
  dependencies; capability tracks (build, tooling, host, backend, perf,
  bootstrap, ecosystem); milestone register M1–M10 with
  validated/aspirational tags. Maintainer rulings: parser is L1 (concrete
  syntax is an extension), module system split (loading L1 / typed objects
  L2), provability is an independent L2 capability, build pipeline is a
  track.
- `docs/design/` reorganized into layer subfolders (allegretto/,
  extension/, standard/, vivace/, platform/), each README a **boundary
  contract**. `grammar-formalism.md` and `proving-in-allegro.md` stay at
  `docs/` (Tier-0 + runtime references). Reference sweep across Tiers 1–3;
  one Tier-0 path touch-up (PROCESS §6 registry pointer) landed as a
  dedicated flagged commit (36197b8) and was maintainer-ratified 2026-07.
- Doc-reference lint (`scripts/doc-ref-lint.ts`) added and wired into the
  test suite — PROCESS §10 debt; caught and fixed 20+ dangling references
  (stale `memory/…` paths, archived-plan paths in CLAUDE.md/bench/primer).
- `BACKLOG.md` rebuilt: single list, stable IDs (B-001…B-086), sequenced
  head mirroring the structures implementation plan with revalidation
  items interleaved, banded tail by layer/track. V1 completed-items ledger
  converted to `V1-INVENTORY.md` (migration matrix: keep / revalidate /
  rework / drop / TBD per feature). Full v1 landing narratives remain in
  git history (pre-rebuild `BACKLOG.md`).
- Earlier in 2026-07 (same arc): v1-era plans archived with triage record
  (`.claude/plans/archive/README.md`); revalidation register established
  (now folded into the backlog as `[reval]` items); shipped
  grammar-extension decisions recovered into
  `docs/design/extension/grammar.md` §4; `structures.md` drafted from the
  D1–D40 design log; `structures-implementation.md` plan drafted
  (boundary-test-first).

## 2026-06 — Documentation governance (Tier-0 docs)

- Created `docs/VISION.md` and `docs/PROCESS.md` (Tier 0); `docs/design/`
  (type-system, effects, pattern-matching, grammar) promoted from
  `.claude/memory/` files and plan docs; promoted memory files shrunk to
  pointers; `.claude/plans/README.md` manifest added.
- Maintainer rulings recorded: descriptive plan-doc names supersede
  evocative codenames; `__` meta-property prefixes are accreted artifacts
  (redesign pending — `docs/design/standard/type-system.md` §4); parser alt-order
  significance is accreted, not intended (`docs/design/extension/grammar.md` §2);
  [impl, proof] pairs are participant-neutral, not AI-specific
  (`docs/VISION.md` §2).
- Recovered untracked deferred items: when-branch predicate refinement,
  brace/offside dual modes (to be filed in BACKLOG during the refactor).
