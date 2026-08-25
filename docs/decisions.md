# Decision register

<!-- Methodology K-004 (C2+): numbered entries, one line each, a status,
     and a link to the design note holding the reasoning. Decisions are
     revisable; revision happens by superseding entry, never by silent
     edit. Statuses: accepted · superseded by D<n>, because … ·
     deprecated. -->

This register indexes the existing decision corpus under its original
IDs — nothing is renumbered; every ID cited in design docs, plans, and
the changelog remains citable exactly as written. Entries are one line:
ID, decision, status, pointer to the reasoning. Where a decision is
accepted but not yet fully implemented, the parenthetical names the
execution state and its backlog owner — acceptance and implementation
are distinct facts.

**Going forward**: new decisions continue the D-series here (next free
number: D48), entered at ratification time with reasoning in a design
note under `docs/design/`. Plan-scoped ruling families (the `X-R`
pattern) may still be minted inside plans; they are indexed here when
their plan's gate passes.

**Namespace warnings** (colliding labels that are NOT decision IDs):
the differentiator map in `docs/plans/release-track.md` numbers its
seven public-positioning claims D1–D7 — those are claims, not
decisions; and "Phase D1/D2" in `docs/design/standard/effects.md` and
the provability plans are roadmap phases. Neither series is indexed
here.

## D-series — core design decisions (D1–D47)

Origin: the structured-values-unification decision log
(`docs/plans/archive/structured-values-unification.md`, frozen —
the rationale record for D1–D46, 2026-06 → 2026-08). Current design
home: `docs/design/allegretto/structures.md` (D47 was minted there and
the series continues there). Pointers below name the design-doc
section holding the reasoning; the archived log holds the discussion
record.

- **D1** — Unify MultiValue + the record role of Context into one primitive (Structure); split the evaluation-scope role out; scopes remain first-class introspectable values — accepted (executed; kind retirement completed at C7.1/B-088) — reasoning: `docs/design/allegretto/structures.md` §1
- **D2** — Annotation channels are extensible: extensions register channels with declared propagation rules (viral / union / computed / positional / drop) — accepted (executed, C1.2) — reasoning: `docs/design/allegretto/structures.md` §3
- **D3** — The lazy/eager `primaryOf` stripping asymmetry is replaced by per-channel propagation semantics — accepted (executed; `primaryOf` deleted as default) — reasoning: `docs/design/allegretto/structures.md` §3 + §12
- **D4** — The type system (typing, visibility, variance, equality policy) stays outside Allegretto: mechanism in base, policy in extensions — accepted (in force; physical relocation rides M2/M3) — reasoning: `docs/design/allegretto/structures.md` Appendix B; `docs/design/layers.md`
- **D5** — Strict typing of all structures is a Standard-layer guarantee; Allegretto structures may be untyped (duck-typed over defined slot keys) — accepted — reasoning: `docs/plans/archive/structured-values-unification.md` decision log (sole definition site; no design-doc restatement yet)
- **D6** — `__*` prefixes are retired; meta-slots become declared slots with visibility/access attributes in a registry — accepted (executed; completed by D39, registry is `src/slots.ts`) — reasoning: `docs/design/allegretto/structures.md` §9 + Appendix A
- **D7** — Internal `Type : Type` self-reference is kept; universe stratification is handled by translation at the proof-export boundary — accepted (in force; no reified Kind, no tower) — reasoning: `docs/design/allegretto/structures.md` §9
- **D8** — Equality is type-customizable with declared laws; proofs record which equality they discharged under — accepted (executed; extended by D37/D38; `proofValEqual` unification residue → B-089) — reasoning: `docs/design/allegretto/structures.md` §7–§8
- **D9** — Arrays: no refs-inside-Bits; base numeric-keyed structures + Standard encapsulated collection types — accepted (array half executed via D18/B-020; collection half open, B-041) — reasoning: `docs/design/allegretto/structures.md` §2
- **D10** — Functions keep returning annotated values: the return is a structure whose channels populate per propagation rules, no wrapper nesting — accepted (executed) — reasoning: `docs/design/allegretto/structures.md` §2
- **D11** — No operation errors on an incomplete value: operations on unresolved values produce residuals; incompleteness detection is separate and effectful — accepted (executed, C2) — reasoning: `docs/design/allegretto/structures.md` §10 + §4
- **D12** — Structures are always structurally complete: incompleteness is a value (an unresolved future in a slot), never a structure state — accepted (executed) — reasoning: `docs/design/allegretto/structures.md` §10
- **D13** — A `seal` op for structures — superseded by D21 + D22, because the op was only ever conceptual: constructor trust decomposed into channel-write authority (D21) and the freeze-a-transient need folded into finalization (D22) — reasoning: `docs/plans/archive/structured-values-unification.md` decision log; `docs/design/allegretto/structures.md` §2
- **D14** — Slot keys are symbol | string | number; channel keys are always namespaced symbols: one slot space partitioned by key sort — accepted (executed; symbol keys at C5) — reasoning: `docs/design/allegretto/structures.md` §2 + §5
- **D15** — The MultiValue wrapper is flattened for structures; scalar primaries ride a transparent structure (empty data plane + `primary` channel) — accepted (executed at C7.1/B-088; reaffirmed by D46) — reasoning: `docs/design/allegretto/structures.md` §2
- **D16** — Reading a potentially-unresolvable value is an effect, dischargeable by a resolvability/completion proof — accepted (executed, B-028 F2/F3: under PE, reads residualize — what remains of blocking-read is the liveness question, discharged by per-source axioms in the ledger; detection is the `sched` label) — reasoning: `docs/design/allegretto/structures.md` §10
- **D17** — A structure cannot have both data slots and a `primary` channel; transparent values have an empty data plane — accepted (executed; W5 invariant asserted, C4.1) — reasoning: `docs/design/allegretto/structures.md` §2
- **D18** — Arrays are numeric-keyed structures, no separate vector primitive (ratifies D9's array half) — accepted (executed, B-020: dense region, O(1) `indexGet`) — reasoning: `docs/design/allegretto/structures.md` §2
- **D19** — The unified construct is named Structure — accepted (executed) — reasoning: `docs/design/allegretto/structures.md` §1
- **D20** — Symbols are unique values tied to their registering Scope (the scope IS the namespace); FQNs default to module path; the existing Symbol kind is redefined, not a new kind — accepted (executed, C5) — reasoning: `docs/design/allegretto/structures.md` §5
- **D21** — No separate `seal` primitive: the constructor brand decomposes into channel-write authority + data immutability + non-fabricating propagation; trust is global and structural — accepted (executed; forgery battery A–F live) — reasoning: `docs/design/allegretto/structures.md` §3 + Appendix C
- **D22** — Structures are immutable by default: born-immutable, deep immutability via an O(1) immutable bit; future-cell carve-out counts as immutable — accepted (executed, C4.1/B-019; carve-out amended by D32/D33) — reasoning: `docs/design/allegretto/structures.md` §2
- **D23** — Channel writes are capability-gated, reads free by default; origination needs the writer, propagation is evaluator-automatic; integrity channels may only register non-fabricating rules — accepted (executed, C1.2) — reasoning: `docs/design/allegretto/structures.md` §3
- **D24** — Capability shape: a first-class delegable token realized as a PrimitiveFunction closure; attenuation = wrapping; writers non-serializable, print-redacted, identity-equal only — accepted (executed; `channel_attenuate` brand-checked) — reasoning: `docs/design/allegretto/structures.md` §3
- **D25** — Scope is the evaluation-environment ROLE of the shared substrate: same slot+channel substrate, distinct protocol (parent-chain resolution, forward-chaining, facts plane); the Context kind-name retires — accepted (executed; retirement completed at C7.1) — reasoning: `docs/design/allegretto/structures.md` §4
- **D26** — Scope op surface: `scope_new/extend/lookup/bindings/assume`; retire `ctx_use` + `Binding.isUse`; facts plane is immutable-layered; one resolution semantics — accepted (executed at C2) — reasoning: `docs/design/allegretto/structures.md` §4 + Appendix B
- **D27** — Minimal base surface: Allegretto's irreducible base is ~40 primitives in five groups; types, proofs, effects, contracts, totality, grammar tooling, and IO are NOT base — accepted as design target (physical relocation rides M2/M3) — reasoning: `docs/design/allegretto/structures.md` §11 + Appendix B
- **D28** — Subsumption mechanics for the base audit: `mv_*`/`component_get` → channel ops, `make_error` → the viral error channel's writer, the `*_attach` family collapses into writer invocations — accepted (partly executed: `*_attach` collapse landed; relocation rides D27) — reasoning: `docs/design/allegretto/structures.md` §3 + Appendix B
- **D29** — Symbol redefinition: defining-Scope identity → FQN, same FQN = same symbol (interned), canonical base-name projection, ambiguity requires explicit qualification, equality = FQN — accepted (executed; interning stable across reloads) — reasoning: `docs/design/allegretto/structures.md` §5
- **D30** — Member-symbol conformance: types DRAW member symbols from declared contexts; conformance is symbol-identity membership (declared, not accidental); the loose `~T` path matches by string projection — accepted (executed, C5.2b/c) — reasoning: `docs/design/allegretto/structures.md` §5 + §8
- **D31** — Completion = totality ∧ liveness: incompleteness has exactly two sources, each a completion effect — blocking-read (external) and divergence `div` (internal); deadlock = dependency cycle — accepted (executed, B-028 F3: `div` is a computed effect riding the calculus, inference IS the termination analysis with call-graph closure) — reasoning: `docs/design/allegretto/structures.md` §10
- **D32** — Triggered construction guard: fires only when a structure carries a value-inspecting invariant; no invariant → no guard, partial access free; guarded projection under a pending invariant — accepted (executed, B-028 F1/F4: construction tri-state + guarded projection with error-propagating failure arm + invariant-predicate div gate; nested-slot completion replacement is the recorded residue) — reasoning: `docs/design/allegretto/structures.md` §10
- **D33** — Futures model: a future is a write-once monotonic cell at the I/O edge, `Future[Future[T]]` flattens, equality on unresolved → residual; incompleteness DETECTION is an effect — accepted (executed, B-028 F1/F2/F4: write-once enforced at the phase interface, `Future[T]` typed with boundary seams, `is_resolved` under `sched`, arrival-order confluence pinned) — reasoning: `docs/design/allegretto/structures.md` §10
- **D34** — Discharging completion effects: strict by default with a four-tier spectrum (auto-proven / user-witnessed / admitted / undischarged), `div` discharge-only, liveness by declared axiom, all verdict-visible — accepted (executed, B-028 F3: per-binding tiers in the div-obligation register, `decreases` verified-vs-trusted split, `total`/`assume terminates` forms, liveness axioms ledger-visible; the PROJECT-level severity flip stays with B-018) — reasoning: `docs/design/allegretto/structures.md` §10 + §8
- **D35** — Resource complexity is not a core effect: static asymptotic bounds are a deferred proof-genre extension; resource budgets are capabilities with catchable `ResourceExhausted` — accepted (deferred) — reasoning: `docs/design/allegretto/structures.md` §10 + §13
- **D36** — Shape/knowledge split: the type channel splits into `shape` (identity, dispatch) and `knowledge` (monotonic lattice, excluded from identity/equality); annotations are knowledge upper-bounds; knowledge-observation is effectful — accepted (executed, Phase 3) — reasoning: `docs/design/allegretto/structures.md` §6
- **D37** — Equality framework: dispatches on shape, never knowledge; different shapes coerce both operands to a least common type, else not-equal; laws split by kind; `equals` must be pure and knowledge-independent — accepted (executed; landed E1–E4, B-027; follow-ons B-089) — reasoning: `docs/design/allegretto/structures.md` §7
- **D38** — Lawful interfaces: interfaces may carry law members; drawing instantiates each law as a pending Obligation; discharge = D34's spectrum verbatim, default strict — accepted (executed; law members + tiers E3, admitted tier + first strict gate E4) — reasoning: `docs/design/allegretto/structures.md` §8
- **D39** — `__*` slot disposition (completes D6): every `__*` slot gets a declared home — members, channels, base concepts, or host-side; no new `__*` ever — accepted (executed, residue zero at C7.2; amended by the 2026-07 addendum and by D44's `__extends` reframe) — reasoning: `docs/design/allegretto/structures.md` §9 + Appendix A
- **D40** — Kinds are just Types: a kind is a type whose instances are type-values; instance-of = shape-of; members live once on the kind; the define-a-kind recipe R1–R5 — accepted (executed; Effect C6.2 + Proof C6.3 re-derived; sharpened by D45) — reasoning: `docs/design/allegretto/structures.md` §9
- **D41** — Mediated member protocol: member access is a four-stage pipeline as ONE partial-evaluation act — project → availability → mediate (`getMember`) → dispatch — accepted, maintainer-ratified 2026-07; EXECUTED 2026-08 at B-097 (kernel mediation inside `type_dispatch`'s one ladder; V-R1) — reasoning: `docs/design/allegretto/structures.md` §6 + §13
- **D42** — Evidence is possession: authorization is what the requesting context HOLDS, never principal identity; default evidence is symbol reachability; denial is an availability outcome — accepted, 2026-07; EXECUTED 2026-08 at B-097 (export partition + wire rule at C5; scope-binding visibility + injection filter at V1; evidence capsule + dispatch-planted privilege layers at V2/V3; forgery-E battery at V4) — reasoning: `docs/design/allegretto/structures.md` §13 + §6 + §5
- **D43** — Modifiers are declared member attributes, extensible per kind: `private`/`readonly`/etc. are Standard-layer declaration attributes, never base constructs; pure mediation folds at compile time — accepted, 2026-07; EXECUTED 2026-08 at B-097 V3 (`private(...)` / reserved `readonly(...)` descriptor attributes; keyword surface remains B-043) — reasoning: `docs/design/allegretto/structures.md` §13 + §6
- **D44** — Declared inheritance dissolves into conformance + refinement + composition: the subtype chain retires; `Type.parent` narrows to refinement structure, renamed `Type.refines`; migration decisive, no sugar — accepted, 2026-08 (executed, C6.1a) — reasoning: `docs/design/allegretto/structures.md` §8
- **D45** — One construction surface: `define` uniform at every meta-level; Interface = refinement of Type, Refinement = sub-kind of Type; `construct` is the standardized per-kind minting authority bottoming out in `struct_new` + the gated shape stamp — accepted, 2026-08 (executed, C6.1a/C7.2a) — reasoning: `docs/design/allegretto/structures.md` §9
- **D46** — MultiValue retirement = D15 execution: option B ratified (transparent Structure as scalar carrier), the definitional ladder (representations → values → types → kinds), `v.kind` demoted to a host discriminant — accepted, 2026-08 (executed, C7.1/B-088) — reasoning: `docs/design/allegretto/structures.md` §2
- **D47** — The source channel, ASTs as channel payload: six sub-decisions — Expression+span payload, demand-driven attachment, `drop` propagation, kernel-private writer / free reads, effectful observation (`observe`), `source of x` surface — accepted, 2026-08 (executed, B-094 chunks 1+2; amended at chunk 2: the what-migrates prediction corrected — the lazy-workaround class is empty in the kernel, payoff prospective) — reasoning: `docs/design/allegretto/structures.md` §3.1

## E-R series — equality and laws (plan rulings, ratified 2026-08)

Plan: `docs/plans/equality-and-laws.md` §3 (landed — chunks E1–E4
complete, B-027 closed; residue → B-089). All maintainer-ratified as
they stand, 2026-08.

- **E-R1** — Kernel structural equals is the default for every structure-backed type: same shape (D37), then field-wise recursion through each component's protocol equality; proven lawful once, parametrically; a user override bears the three obligations — accepted (executed, E1) — reasoning: `docs/plans/equality-and-laws.md` §3
- **E-R2** — Coercion declarations are type-level members with obligations, registered on the PAIR; `==` resolves same-shape → equals, else least common type over the declared coercion graph, else not-equal (never an error); numeric tower is instance #1 — accepted (executed, E2) — reasoning: `docs/plans/equality-and-laws.md` §3
- **E-R3** — `law` members ride the existing spec surface (`law_` prefix in define/Interface specs); `for_all` is a proposition form; drawing a law-bearing interface instantiates one Obligation per law — accepted (executed, E3; two ratification addenda: laws are member-set-general, and laws over abstract members are schemas instantiated at draw time; `law` statement sugar → B-089) — reasoning: `docs/plans/equality-and-laws.md` §3
- **E-R4** — Law discharge maps onto D34's spectrum with existing machinery; `assume` is new and verdict-visible; strictness ships incrementally (E3 records tiers, E4 turns on the first strict gate, `proof_trans`) — accepted (executed, E3+E4) — reasoning: `docs/plans/equality-and-laws.md` §3
- **E-R5** — The purity/knowledge-independence gate is mechanical: an `equals` implementation (and any coercion fn) must infer an EMPTY effect set including `observe`; violation is a compile error naming the label — accepted (executed) — reasoning: `docs/plans/equality-and-laws.md` §3
- **E-R6** — Proofs record equality identity + tier as plain instance-data bindings on the Proof value; chains resting on admitted transitivity render verdict-visibly weaker (extends D8) — accepted (executed, E4, with a recorded deviation: the two fields became three, `lawName` added) — reasoning: `docs/plans/equality-and-laws.md` §3

## U-R series — units DSL (plan rulings, ratified 2026-08)

Plan: `docs/plans/units-dsl.md` §5 (landed — chunks U1–U4 complete,
B-092 closed). All ratified as recommended, 2026-08.

- **U-R1** — Dimensions are structural DATA + named dimensions are REFINEMENTS over one Quantity record (not dynamically minted nominal types): dimensional soundness IS refinement discharge — accepted (executed, U1; accepted cost: `type of q` answers Quantity; nominal dimensions revisitable at the deferred user-generics surface, C7.2-R1) — reasoning: `docs/plans/units-dsl.md` §5
- **U-R2** — Literal syntax scope: number-anchored `3 m/s^2` only; all computed values go through the ordinary operator algebra — accepted (executed, U2) — reasoning: `docs/plans/units-dsl.md` §5
- **U-R3** — Law honesty: accept sampled/admitted tiers for the quantity laws, displayed loudly in the demo, rather than restricting to kernel-dischargeable laws — accepted (executed, U3: the pending `?` rows are the product) — reasoning: `docs/plans/units-dsl.md` §5
- **U-R4** — `in` conversion sugar is deferred to a later slice (`.to(m)` reads fine; `in` interacts with the syntax track) — accepted (deferred) — reasoning: `docs/plans/units-dsl.md` §5
- **U-R5** — Full 7-vector base dimension set from day one, with the shipped unit set mechanics-focused (m, km, cm, s, min, h, kg, g, N, J, W, Pa and derived velocities/accelerations) — accepted (executed, U1/U3) — reasoning: `docs/plans/units-dsl.md` §5

## R-R series — release track (plan rulings, ratified 2026-08)

Plan: `docs/plans/release-track.md` §7 (active; internal). R-R1/R-R2
ratified in-session; R-R3–R-R5 signed off at B-090 (§8 status log).

- **R-R1** — Terminology: "substrate / surfaces", with general-purpose vs. domain as breadth (VISION §1a amendment), including the seriousness claim — accepted — reasoning: `docs/plans/release-track.md` §7
- **R-R2** — Claims discipline: claims as big as we can usefully imagine, private until convincingly delivered; skeptics-first audience — accepted — reasoning: `docs/plans/release-track.md` §7 + §4
- **R-R3** — Differentiator map: the six + capstone, as merged — accepted (B-090 sign-off) — reasoning: `docs/plans/release-track.md` §3 + §7
- **R-R4** — Ladder order and the rung-2 domain choice: units-physics over state machines, for the rung-3 bridge and the mixed-model trajectory — accepted (B-090 sign-off; executed as B-092) — reasoning: `docs/plans/release-track.md` §5 + §7
- **R-R5** — Doc placement: durable → VISION §1a/§5; volatile → the release plan; items → Backlog Track R; no competing primary docs — accepted (B-090 sign-off, including the VISION amendment) — reasoning: `docs/plans/release-track.md` §7

## Chunk rulings — structures implementation arc

Ruling IDs below are qualified by their chunk (the bare R-numbers are
chunk-scoped in the sources); the qualified form is already how the
docs cite them (e.g. "C7.2 ruling R1").

- **C4.3-R1/R2/R3** — Merge policies activate at C4.3a: error virality survives residual chains; an error-carrying `if` condition propagates the error; union-rule channels merge by union on re-evaluation — accepted (executed, C4.3a) — reasoning: `docs/design/allegretto/structures.md` §2 rulings block; `docs/plans/structures-implementation.md` §6
- **C4.3-R4/R5** — `primaryOf`-strip retirement + the non-nesting reframe land at C4.3c — accepted (executed, C4.3c) — reasoning: `docs/design/allegretto/structures.md` §2 rulings block
- **C4.3-R6** — The host `ValueKind.MultiValue` tag stays through C4.3 but is not expected to survive C6 — accepted (outcome realized at C7.1: tag retired) — reasoning: `docs/design/allegretto/structures.md` §2 rulings block
- **C5.2-R1** — typeShape member-transparency stays member-set OBJECT identity — accepted (executed) — reasoning: `docs/design/allegretto/structures.md` §5 rulings block
- **C5.2-R2** — Only `__members`/`__extends` dissolve in this chunk — accepted (executed) — reasoning: `docs/design/allegretto/structures.md` §5 rulings block
- **C5.2-R3** — Sub-chunk order a→b→c with the declared-conformance flip LAST — accepted (executed) — reasoning: `docs/design/allegretto/structures.md` §5 rulings block
- **C5.2-R4** — `x[ns.name]` qualification syntax DEFERRED; ambiguity is a detected error — accepted (deferred) — reasoning: `docs/design/allegretto/structures.md` §5 rulings block
- **C5.2-R5** — Kernel member names register under one kernel-scope FQN — accepted (executed) — reasoning: `docs/design/allegretto/structures.md` §5 rulings block
- **C5.2-R6** — Unions stay outside member storage — accepted (executed) — reasoning: `docs/design/allegretto/structures.md` §5 rulings block
- **C6.1-P1** — Resolved as `Type.define` (the unified-recipe reading); P2–P4 stand as briefed — accepted (executed, C6.1) — reasoning: `docs/plans/structures-implementation.md` §4 Phase 6
- **C7.2-R1** — GenericType's lack of construct authority is a DEFERRED PUBLIC SURFACE, not kernel-private-by-design (maintainer-amended): kernel privacy is reserved for what integrity requires; exposure waits on surface design — accepted, as amended — reasoning: `docs/plans/structures-implementation.md` §4 Phase 6
- **C7.2-R2** — `distinct` is the symbol-fresh newtype mint: members re-declared under a fresh scope, non-conformance falls out of symbol-identity membership by construction — accepted (executed, C7.2b) — reasoning: `docs/plans/structures-implementation.md` §4 Phase 6
- **C7.2-R3** — One construction surface: the reserved `construct` define-spec key replaces post-hoc `.constructor()`; the meta-method leaves the kind API — accepted (executed, C7.2b) — reasoning: `docs/plans/structures-implementation.md` §4 Phase 6
- **B-094-1/2/3** — Source-channel chunk-1 rulings: reads render TEXT (a first-class inert AST needs a QUOTE carrier, deferred); binding-level attachment covers non-Structure data only (Structure identity audit deferred); residual bindings are skipped (attachment on completion-replacement is a follow-on) — accepted — reasoning: `docs/design/allegretto/structures.md` §3.1 chunk-1 status
- **Perf ruling (C1.1, 2026-07)** — Warn-only perf floor now, refined progressively — accepted — reasoning: `docs/plans/structures-implementation.md` header status log
- **§6 item-3 ruling** — Test-condition changes must be pre-discussed / collapse-equivalents (the conscious-delta queue) — accepted (standing practice) — reasoning: `docs/plans/structures-implementation.md` §6

## Standing rulings — layers, grammar, methodology

- **Layer rulings 1–4 (2026-07)** — Parser is L1 (L0's definition is syntax-free); module system SPLITS (loading L1, typed module objects L2); provability is an independent L2 capability cluster with its own milestone; build pipeline is a TRACK, not a layer — accepted — reasoning: `docs/design/layers.md` §1
- **W_PRODUCTION_REPLACED ruling (2026-06)** — Silent production replacement WARNS, does not error: replacement is a legitimate extension technique, but silent shadowing has bitten before — accepted (executed) — reasoning: `docs/design/extension/grammar.md` §4
- **Adoption gate rulings (owner, 2026-08, methodology chunk 1)** — C2 tier confirmed; the Backlog stage-reference convention confirmed; B-091 `[stage: live]` confirmed; W-006 adopted in full (single-use outcome-named branches, DEV-1 deviation withdrawn); deployed-version verification tooling registered as B-096 — accepted — reasoning: `docs/plans/methodology-adoption.md` §Chunk 1; `docs/classification.md` §Deviation register
