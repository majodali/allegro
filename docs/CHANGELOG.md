# Allegro — Changelog

> Tier 2. Append an entry per landed chunk (see `docs/PROCESS.md` §5).
> Newest first. Each entry: what landed, key decisions, deviations from
> plan, test count.

*Stub — the per-phase history currently embedded in `CLAUDE.md` ("What's
Next" / completed-items section) will be migrated here verbatim during the
2026-06 documentation refactor; new entries are appended here from now on.*

## 2026-07 — C4.1: Structure kind — one host representation behind the factories (structures Phase 4, B-019)

The representation swap begins. Every MultiValue and every Context is now
an instance of ONE host class — `Structure` (`src/structure.ts`) — with
`makeMultiValue`/`makeContext` as the promised constructor shims. The
public field surface is unchanged (the 1000-test suite is the oracle);
the object layout is now a single declared hidden class covering both
roles plus the scope fields, which the A/B benchmark shows is ~7% FASTER
than the per-shape object literals it replaced (the I1 hidden-class
motivation, paying out at step one).

- **Role fixed at construction** — `kind` is a plain field; the
  evaluator's hot switch is untouched. Channel plane = `components`
  (MultiValue role), slot plane = `bindings`/`bindingList` (Context
  role); physical separation and the direct shape-ref field land inside
  structure.ts with C4.3/C5 where the interception points exist.
- **Six bypass sites converted** to the factories (encodePredicates /
  encodeDomain / encodeEffects stashes, the evaluator's placeholder
  domain ctx, the channel-writer wrap in slots.ts, proven.ts's
  spread-clone). slots.ts + structure.ts are the two sanctioned
  representation modules in the lint baseline.
- **Invariant battery grows**: W4 structure-kind (every corpus
  MultiValue/Context is a Structure instance — a stray literal anywhere
  fails the walk), W5 role-transparency (D17: MultiValue role carries no
  slot plane, Context role no primary), plus three C4.1 tests — factory
  construction across roles (typed literal, object, refined type, eval
  scope), hostile data keys named after channels living on the slot
  plane without touching the channel plane, and the D22 future-cell
  carve-out (in-place monotonic resolution).
- **Immutable bit (D22)**: declared state — born-immutable default with
  the standing carve-outs (scopes as mutable evaluator state, future
  cells, grandfathered construction-phase population) documented and
  asserted; freeze-enforcement tightens at C4.3.

1020/1020 green; perf floor clean.

## 2026-07 — C3.3: Observation effect — instanceof is a pure re-check; certificate_peek is effectful (structures Phase 3 complete, B-017)

D36's third leg: **re-checking is pure; observation is effectful.**

- **`instanceof` on a member-transparent refinement is now a PURE
  PREDICATE RE-CHECK** from data — recursive base check down the
  refinement chain, then each layer's predicate (the identity/domain fast
  paths are sound over immutable data). This fixes a real congruence
  violation: previously `PositiveInt(5) instanceof PositiveInt` → true
  but `5 instanceof PositiveInt` → false — a certificate peek disguised
  as a type check, letting two shape-and-data-equal values answer
  differently. Now both answer true (and `-3` answers false, by
  re-check). Nested refinements re-check the whole chain
  (`150 instanceof SmallPos` → false). **Shape-minting refined types
  (preserveOps) stay nominal** — instanceof on a SHAPE is a shape
  question, per the C3.1 typeShape boundary (`8 instanceof PI` remains
  false; construction is the way in). No existing test asserted the old
  peek semantics; the flip is the chunk's mandated behavior change.
- **`certificate_peek(v, T)`** — the provenance question ("was v
  CONSTRUCTED as T?") — is a new primitive, eager but channel-aware (the
  certificate rides the value's channels), tagged with the **"observe"**
  effect label. It distinguishes §7-equal values — exactly what a pure
  function must not do — so the effect calculus prices it: a function
  using it infers `observe` and cannot claim `effects pure`; F3a
  compile-time deferral applies automatically. The walk covers refinement
  certificate layers only (shape questions belong to instanceof).
- **Congruence + equality groundwork** (for the D37 equality plan):
  boundary tests assert pure-op interchangeability over §7-equal pairs
  (arithmetic, toString, ==, instanceof) and that equality ignores
  knowledge (`PositiveInt(5) == 5`).

Demo `tests/observation-demo.alg`; 3 new boundary tests; sandbox example
extended. **Phase 3 (shape/knowledge split) is complete over the current
representation** — physical knowledge-channel storage moves at C4.
1017/1017 green.

## 2026-07 — D41–D43: S3 access control settled — mediated member protocol, evidence is possession, extensible modifiers (B-016a session)

The B-016a design session concluded; outcome ratified by the maintainer
and recorded as three decision-log entries + the structures.md §6
pipeline block and §13 rewrite.

- **D41 — mediated member protocol.** Member access is ONE PE act with
  four stages: project (text → symbol, §5 base-name rules — only the
  base resolver does name resolution) → availability (knowledge, D36) →
  mediate (the shape's `getMember(symbol, instance, context)` maps the
  resolved symbol to an accessor per the member's declared modifiers) →
  dispatch (the accessor runs against the shape). PE folds the pipeline
  when inputs are static — compiler-generated call sites specialize to
  the raw accessor. Today's `type_dispatch` descriptor path becomes the
  default mediator (C6); module types' export-enforcing `__getMember` is
  the protocol's existing production instance. The no-implicit-fallback
  refusal and the confluence invariant extend to mediation.
- **D42 — evidence is possession.** No principal-identity lookup: the
  context argument is evaluator-supplied and contexts are reachability
  capsules (you cannot extend a scope you cannot reach). Default
  evidence is symbol reachability (private = the member symbol stays in
  the defining scope); denial is an availability outcome, static when
  scope + knowledge are static. Wire rule: deserialized foreign-FQN
  symbols rebind only against exported registries. D24 capability
  closures stay as the stronger tier for authority-bearing operations.
  Reachability ∧ availability compose by conjunction (holding
  `Dog::tricks` doesn't help on an Animal-bounded occurrence).
- **D43 — modifiers as extensible member attributes.** private /
  protected / readonly / custom modifiers are Standard-layer attributes
  of member declarations, defined per kind (D40 recipe input), never
  redefinable globally. Static-evidence mediation is pure and folds at
  compile time; non-pure mediation (runtime identity, tracing) is
  ALLOWED but fully covered by the effect calculus — the modifier
  declares its label and enclosing functions can't claim `effects pure`.
  Expected distribution: the vast majority of resolvers are pure
  possession checks. Surface defaults (public-by-default, names-public
  in errors) recorded as proposed, decided at the surface-syntax chunk.

Implementation rides C5 (symbols — C5.1 carries the wire-rule note) and
C6 (default mediator + modifier vocabulary). C3.3 is unblocked. Docs
only — no code change.

## 2026-07 — Availability: terminology + PE-sole-resolver semantics ratified (design delta to §6; S3 reframed)

Maintainer discussion sharpened what C3.2's gate IS. Recorded in
structures.md §6 as the **Availability** block:

- **Availability is a resolution outcome, not a property** — `a.m` is a
  base-name projection (§5); which symbol `m` is, or whether it is a
  string data key at all, is decided by the occurrence's effective
  knowledge, never by the text. Four outcomes: member symbol / string key
  under an open structure's own policy / unavailable (closed type, no
  declaration — the C3.2 refusal; multiple matches → §5 qualification
  error) / undetermined → residual (D11).
- **PE is the sole resolver.** No name table, no second checker — the
  determination is what PE does with a member access under current
  knowledge, firing whenever its inputs land (precompile, module load, or
  after a future resolves). **Confluence invariant** (falsifiable): for
  fixed eventual knowledge, early and late resolution agree. Dispatch is
  stage two of the same act (symbol → implementation, by shape).
- **S3 reframed** (structures.md §13 + the decision doc's S3 item):
  access-control enforcement is NOT "dispatch reads slot attributes" — it
  is PE evaluating the access with the call-site context as principal, in
  the same act. Open questions (principal identity, capability-accessors
  vs declared attributes, static vs residualising denial, authorization
  under knowledge, reflection surfaces vs the C3.3 observation effect)
  recorded there; design session filed as B-016a, sequenced before C3.3.
- **Terminology**: "visibility" is reserved for S3; C3.2's concept is
  availability. Error message renamed (`'tricks' is not available through
  annotation 'Animal'`), comments and demo updated. Doc + rename only —
  no semantic change. 1013/1013 green.

## 2026-07 — C3.2: Annotations as knowledge bounds + narrowing (structures Phase 3, B-016)

Type annotations become what D36 says they are: KNOWLEDGE UPPER-BOUNDS —
member-hiding abstraction boundaries. A Dog crossing `a: Animal` keeps
its shape (dispatch, equality, `when` matching all unchanged) but the
occurrence may only touch Animal's members until narrowed. First
user-visible behavior change of the structures arc, mandated by the
ratified design.

- **Boundary crossing**: `applyComposed` (call-site params) and
  `type_check` (return annotations, binding annotations) stamp an
  occurrence `bound` component (drop-propagation — bounds constrain the
  occurrence, never derived results) when the declared type is WIDER than
  the value's shape, and clear any inherited bound on own-shape crossings
  ("the new occurrence's starting knowledge"). Only named nominal
  concrete types participate — Any, function types, Effect annotations,
  interfaces, unions, and generics are pass-throughs.
- **Visibility gate**: `type_dispatch` refuses members absent from the
  bound's declared surface with a teaching error (`'tricks' is not
  visible through annotation 'Animal' — narrow with \`when … is Dog\`»);
  visible members dispatch through the SHAPE as before (Liskov). Open
  types are exempt: the base Object type (dynamic fields by design) and
  fallback-only types with no declared members (module objects — their
  `__getMember` is already the visibility policy).
- **Narrowing**: a matched `when … is T` type pattern (bare or
  destructuring) lifts the bound within the arm, both subject forms:
  Symbol subjects get an O(1) scope shadow layer (C2.1 machinery — arm
  exit is discard, the else arm keeps the outer view); substituted-param
  subjects get a clone-on-write identity replacement of the subject value
  inside the arm (substitution clones former param positions per call, so
  the walk never touches shared ASTs).
- **The meet never widens**: intrinsic knowledge (refinement
  certificates, predicates) survives passage through looser annotations —
  `PositiveInt(5)` through `x: Int` keeps its certificate; `knowledgeOf`
  gains the `occurrenceBound` carrier and `knowledgeDomain` meets all
  three sources.
- **Delta 5 activated, additive-only**: introspection gains a
  `bound: Animal (annotation)` line on bounded values; every existing
  output is byte-identical. Website sandbox gains a "Knowledge Bounds"
  example.
- **Deferred, recorded in §6's status note**: operator-dispatch
  visibility gating, knowledge-gated downcast refusal at call sites
  (runtime-sound today), record undeclared-field openness.

Demo `tests/knowledge-bounds-demo.alg`; 4 new boundary tests (two-sided
visibility/dispatch matrix, both narrowing forms + arm-locality, boundary
reset, intrinsic survival). 1013/1013 green.

## 2026-07 — C3.1: Shape/knowledge split — two channels, dispatch on shape (structures Phase 3, B-015)

The old `type` channel conflated the declared shape with what's known
about a value (D36). C3.1 splits the READ paths over the current storage;
the physical representation moves at C4.

- **The shape boundary, mechanically**: `typeShape(t)` walks `__extends`
  past member-transparent refinement layers. The transparency test is
  object identity — `buildRefinedType` shares the parent's `__members` by
  reference, so a predicate-carrying layer whose member set === its
  parent's is knowledge; a layer that mints its own member set
  (`preserveOps` lifted operators, `mixin`, `extend`) IS a shape and its
  overrides dispatch (Liskov). Walking a transparent layer can never
  change which member runs — the split defines where shape ends and
  knowledge begins without touching behavior.
- **Two channel reads**: `channelReadRaw(v, "shape")` now returns the
  computed dispatch shape (identity for every non-refined type, so the
  existing meta-type readers are unaffected); `type` stays the raw stored
  view (bound included). New `knowledge` channel (computed) registered;
  `knowledgeOf(v)` returns the unified intrinsic carrier — refinement
  bound (the construction certificate) + predicate set — with
  `knowledgeDomain` (meet of bound domain and predicate domain) and
  `meetKnowledge` (one lattice; the occurrence carrier in the scope facts
  plane merges through the same `mergePredicateSets`).
- **Dispatch reads shape**: `type_dispatch_impl` and the evaluator's
  `PRIM_TO_METHOD` operator dispatch resolve members through
  `typeShape(storedType)`. Observable behavior identical (transparent
  layers share the member object; error messages keep the stored type's
  name); the dispatch/knowledge independence is now structural rather
  than incidental.
- **Shape is fixed at construction**: `withType` — the type channel's
  origination chokepoint — refuses re-stamping a value with a
  DIFFERENT-shaped type. Same-shape re-stamps (refinement certificate
  tagging, preserveOps result re-tagging) remain legal. The guard flushed
  out one real construction path: `typeLiterals` provisionally guesses
  every 64-bit literal as Int, and the `typed_*` wrappers correct the
  guess (an 8-character string literal arrives Int-guessed) — those are
  construction points, now explicit via `withTypeReplacing`.
- **Boundary tests** (6 new): stored-vs-shape reads on refined values
  (shape identity with the base Int object), preserveOps-type-is-a-shape
  (+ lifted op still re-tags), writer refusal on cross-shape re-stamp with
  knowledge re-bounds passing, dispatch under attached knowledge
  (narrowing never changes the member; refined values run the shape's
  methods), certificates riding across a typed function boundary, and the
  knowledge-lattice meet ([≥1] ∧ [≤99] = [1,99]).

§6 delta 5 (introspection output format change) was NOT needed and is not
activated — introspection still renders the stored type; the format
question goes to the C3.2 briefing where annotations make knowledge
user-visible. 1008/1008 green.

## 2026-07 — C2.3b: Resolution unification — future cells + root layering (structures Phase 2 complete, B-013 part 2)

An unresolved binding is now a **future cell**, and there is exactly one
of it per name: the `Binding` object itself carries the reactive state
(`value` — undefined while pending, `incompleteDeps`, `isComplete`), and
the `DependencyRegistry` tracks the SAME objects the eval scope's source
layer holds. The former `ReactiveBinding.currentValue` mirror and its
dual-write dance (propagateCompletions updating registry + ctx separately)
are gone; `applyPhase` resolves cells in place, which also fixes a
pre-existing wart where it left stale `value: undefined` binding objects
in `bindingList` while replacing the map entry.

- **Root layering**: `buildEvalCtx` builds a real scope chain — primitives
  ← extensions ← base ← source — and returns the source layer (`scopeNew`/
  O(1) layers from C2.1). The own map of the returned ctx holds exactly
  the source-level bindings, which simplified every "filter out the
  primitives" consumer (module extraction, introspect, PCP verdict walk)
  into correct-by-construction reads. The REPL base is flattened into a
  fresh layer per pass (`scopeAllBindings` + copies) so completions in a
  later pass can never mutate an earlier pass's ctx — byte-compatible with
  the old flat copy, including carrying unresolved REPL bindings forward
  as pending cells.
- **Absent vs unresolved, distinguishable**: a declared-but-unprovided
  `import foo` now installs a pending cell on the source layer (tracked by
  the registry); a never-declared name has no binding on any layer. The
  evaluator's observable behavior is unchanged (both residualise), but the
  reflective `ctx_resolve` now surfaces the distinction per design §4/D11:
  absent → Error-typed value, pending → residual Symbol — the old throw
  path is retired (the §4-mandated delta deferred from C2.3a).
- **Consumer migration**: `resolveSymbols` + `buildEvalCtx` flatten base
  chains; `proven.ts` type lookup and the three `__futureManager` reads
  became chain-aware (`scopeLookup` / `scopeHostRead` + `HOST_KEYS` —
  fixing a latent miss where `print`/`delay`/`fetch` under a
  unification-enriched child ctx couldn't see the manager);
  `markTailCallsInContext` needed no change (it consumes the parser's
  file context, not the eval scope). `Binding.isUse` deleted along with
  all ~60 literal sites (C2.3a's parked cleanup).
- **Boundary tests** (6 new): own-layer/chain-reach split, ctx↔registry
  object identity for named/future/bare bindings, pending-cell vs absent
  (including both `ctx_resolve` outcomes), applyPhase in-place resolution
  + forward-chained dependents, extension-satisfied imports get no cell,
  REPL pass mutation-isolation. Two C1.1/C2.1-era tests adjusted
  internals-shaped only (`bindings.get("Int")` → `scopeLookup`) since Int
  now lives on the extensions layer; one reactive test's hand-built
  registry record reworked to the unified cell shape (assertions kept).

Phase 2 (scope split) is complete. 1002/1002 green.

## 2026-07 — C2.3a: `ctx_use` + `isUse` retirement (structures Phase 2, B-013 part 1)

Recon for C2.3 found the `ctx_use` surface already dead: the primitive
has zero consumers anywhere (src, lib, tests), and the `isUse` flag it
minted was write-only cargo — one passive forward in buildEvalCtx, zero
semantic readers. Deleted the primitive and its registration; the
`Binding.isUse` field is optional with a retirement note (full deletion
with C2.3b's future-cell unification, which cleans the literal sites).
C2.3b working spec (future cells, root layering, flat-view consumer
migration, absent-vs-unresolved tests) recorded in the plan chunk log.

## 2026-07 — C2.2: Facts plane via scopeAssume (structures Phase 2, B-012)

The Phase-C predicate-narrowing machinery moves onto the scope chain as
immutable fact layers.

- **`scopeAssume(parent, facts)`**: pushes a child layer carrying ONLY
  the new facts — no copying of parent facts (the old
  `augmentScopePredicates` copied every inherited entry per branch).
  Branch exit is discarding the child; parents are never mutated.
- **`scopeFactsFor`** merges fact sets across the whole chain, rootmost
  first — reproducing the former copy-parent-then-merge read semantics
  byte-identically (per §6 delta 4: observable behavior unchanged,
  internals-shaped change only). The C2.1 nearest-layer-wins read was
  superseded by this merge — with single-layer storage they were
  equivalent; with real layers, merging is the faithful semantics.
- **`scopeOwnFacts`** is the sanctioned write path for assert/requires
  mid-scope accumulation — the scope's own layer state, never a parent.
- **Chain-aware entailment**: the four static-discharge binding lookups
  in assert/requires previously read the own-layer map only — under
  layering they now chain-walk (without this, static discharge would
  silently degrade to runtime checks inside branches).
- **Opacity lint**: direct `.scopePredicates` access outside `scope.ts`
  fails the suite — fact payloads are opaque to everything but the facts
  API (the plan's "base ops never inspect them" boundary).
- Boundary tests: sibling-branch isolation, parent-untouched-after-
  branch, nested-layer chain merge, own-layer accumulation isolation.

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
