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
number: D49), entered at ratification time with reasoning in a design
note under `docs/design/`. Plan-scoped ruling families (the `X-R`
pattern) may still be minted inside plans; they are indexed here when
their plan's gate passes.

**Namespace warnings** (colliding labels that are NOT decision IDs):
the differentiator map in `docs/plans/release-track.md` numbers its
seven public-positioning claims D1–D7 — those are claims, not
decisions; and "Phase D1/D2" in `docs/design/standard/effects.md` and
the provability plans are roadmap phases. Neither series is indexed
here.

## D-series — core design decisions (D1–D48)

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
- **D34** — Discharging completion effects: strict by default with a four-tier spectrum (auto-proven / user-witnessed / admitted / undischarged), `div` discharge-only, liveness by declared axiom, all verdict-visible — accepted (executed, B-028 F3: per-binding tiers in the div-obligation register, `decreases` verified-vs-trusted split, `total`/`assume terminates` forms, liveness axioms ledger-visible; the PROJECT-level severity flip ruled at T-R1/T-R2 — strict binds at discharge accounting and at contracts, info stays the migration default for UNDECLARED code, and the flip itself is per-project config, deferred) — reasoning: `docs/design/allegretto/structures.md` §10 + §8; severity reconciliation: `docs/design/standard/totality.md` §5
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
- **D48** — The Allegretto composite, ruled as one question (B-108): **(a) IC-2 → option E** — the composite is a sequence of optionally-keyed entries; the dense region and the materialized legacy view become representation below the specification, taking `__length` and the W6 invariant with them, and a scope keeps its by-name index because a scope is not data; **(b) IC-3 → the alternative** — metadata is a `meta` field on every representation kind rather than on a carrier that wraps the value, deleting the carrier concept, `primary`, `isCarrier`, W1 and the `dataOf` indirection; **(c) construction lifecycle** — factories take metadata so a value that will carry it is built with it, and the four operations currently sharing the name `withMetadata` (create / derive / map / stamp) get four names; **(d) IC-1 dissolves** rather than being decided, because (a) and (b) delete the roles it would have tagged; **SC-5 upheld** — one composite kind was never the thing in doubt — accepted, 2026-08 (ruled, NOT executed — owners **B-120** (a) and **B-121** (b)(c); each arc gets its own plan before code) — reasoning: `docs/design/concepts.md` §3 (IC-1, IC-2, IC-3, IC-3a) and the B-108 measurement record

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

## V-R series — S3 visibility (plan rulings, ratified 2026-07/08)

Plan: `docs/plans/visibility.md` §3 (closed — chunks V1–V4 complete,
B-097 closed; D41–D43 EXECUTED). All maintainer-ratified as
recommended; indexed here at the arc's close.

- **V-R1** — One pipeline, kernel-internal mediation: `type_dispatch`'s descriptor path IS the D41 mediator; `fallbackMember` stays the only user policy hook (2→3 arity, invoked through the evaluator so its effects propagate); untyped meta-dispatch unified into the typed ladder; operator dispatch shares the gate — accepted (executed, V1/V2) — reasoning: `docs/plans/visibility.md` §3
- **V-R2** — The mediation context is an opaque, kernel-minted evidence CAPSULE answering only `holds(name)` — print-redacted, non-enumerable, never the raw scope (D25 introspection stays a property of scopes you hold) — accepted (executed, V2) — reasoning: `docs/plans/visibility.md` §3
- **V-R3** — Two tiers this arc, private and public; `internal` and `protected` are RESERVED vocabulary deferred to a concrete consumer (`protected` needs restating over draw-from post-D44) — accepted (executed, V1–V3) — reasoning: `docs/plans/visibility.md` §3
- **V-R4** — Export-ness is a SCOPE-BINDING attribute (the `exported` value-plane channel and its `y = x` aliasing wart deleted); "no export statements = open module" becomes stated policy; flat `use`-injection filtered to the declared export set — accepted (executed, V1) — reasoning: `docs/plans/visibility.md` §3
- **V-R5** — D43 attributes ride DESCRIPTORS via wrapper combinators (`private(...)`, reserved `readonly(...)`) pending keyword syntax (B-043); public-by-default and names-public-by-default ratified as shipped defaults — accepted (executed, V3) — reasoning: `docs/plans/visibility.md` §3
- **V-R6** — Bespoke readers close per policy: destructuring a private field outside its scope is an ERROR naming privacy (never a silent no-match), `formatValue` omits privates with a `…` marker, conformance counts only externally-reachable members — accepted (executed, V3) — reasoning: `docs/plans/visibility.md` §3
- **V-R7** — Reflection resolves the D23/D42 tension: enumeration and visibility FLAGS stay free and caller-independent; only value/impl-bearing reads demand possession evidence — accepted (executed, V3) — reasoning: `docs/plans/visibility.md` §3
- **V-R8** — Mediation effects are per-mediator: kernel default mediation is pure and PE-folds; an impure user fallback mediator declares its own label (`observe` stays reserved); `type_dispatch` is never blanket-tagged — accepted (executed, V2) — reasoning: `docs/plans/visibility.md` §3

## CE-R series — completion effects & futures (plan rulings, ratified 2026-08)

Plan: `docs/plans/completion-effects.md` §3 (closed — chunks F1–F4
complete, B-028 closed; D16/D31–D34 EXECUTED). All maintainer-ratified
as recommended; indexed here at the arc's close.

- **CE-R1** — `div` rides the effect calculus verbatim: the termination analysis writes it into inferred sets BEFORE the declaration check, so the existing inferred-⊆-declared machinery and its halt carry it — a declaration is a contract; undeclared code carries `div` visibly without halting; kernel primitives are axiomatically total — accepted (executed, F3) — reasoning: `docs/plans/completion-effects.md` §3
- **CE-R2** — Discharge tiers recorded PER BINDING and ledger-visible (D34's four): `auto` / `witnessed` (kernel-verified `decreases`) / `admitted` (`assume terminates`, or an unverifiable metric — the formerly silent trust) / `undischarged`; verdict block + additive `pcp/1` obligations fields — accepted (executed, F3) — reasoning: `docs/plans/completion-effects.md` §3
- **CE-R3** — Surface forms `assume terminates` (admitted axiom) and `total` (per-function strict opt-in) land as body forms in `lib/totality.alg` through the sanctioned lowering chain; the PROJECT-level default flip stays with B-018 — accepted (executed, F3; B-018 half ruled at T-R2) — reasoning: `docs/plans/completion-effects.md` §3
- **CE-R4** — Incompleteness detection gets ONE new label, `sched` (lazy `is_resolved`, the `observe` precedent); D31's blocking-read needs no label of its own under PE — what remains is LIVENESS, discharged per-source by declared axiom (delay: live; fetch: admitted) — accepted (executed, F2) — reasoning: `docs/plans/completion-effects.md` §3
- **CE-R5** — `Future[T]` is minted through `buildGenericType` (memoized, flattening); async primitives stamp their futures; the call boundary residualizes rather than throwing — accepted (executed, F2, with the recorded refinement that the seam is TWO sites: `checkArgType` defers by skip, `type_check_impl` by re-firing residual) — reasoning: `docs/plans/completion-effects.md` §3
- **CE-R6** — Modules evaluate with the session's FutureManager; base mode without one keeps the explicit "requires async runtime" error (absent host capability is a configuration error, not value incompleteness — D11 does not apply) — accepted (executed, F2) — reasoning: `docs/plans/completion-effects.md` §3
- **CE-R7** — The mechanical purity gates see `div` (conscious delta): an `eq`/coercion — and, per D32, a value-inspecting invariant predicate — whose termination is undischarged fails the E-R5 gate; corpus-swept before the flip — accepted (executed, F3/F4) — reasoning: `docs/plans/completion-effects.md` §3
- **CE-R8** — D32 lands in two moves: the construction tri-state soundness fix first (an unresolved predicate residualizes construction instead of mis-tagging), guarded projection second. Also ratified: CLAUDE.md's halt invariant is CORRECTED to shipped reality (construction-path invariant failure = error value; non-exhaustive match = info) rather than silently strengthened — promoting either is a separate maintainer decision — accepted (executed, F1/F4; the promotion knobs ruled at T-R2/T-R3) — reasoning: `docs/plans/completion-effects.md` §3

## T-R series — totality revalidation (design rulings, ratified 2026-08)

Design note: `docs/design/standard/totality.md` §8 (B-018 closed). All
maintainer-ratified as recommended.

- **T-R1** — Severity reconciliation: D34's strict-by-default binds at discharge ACCOUNTING (always on, nothing silently trusted) and at the CONTRACT (declarations, `total`, annotations — strict since B-028 F3); v1's notify-by-default remains the migration-era default for UNDECLARED code. The two designs compose; neither is overturned — accepted — reasoning: `docs/design/standard/totality.md` §5 + §8
- **T-R2** — The flip is PER-PROJECT CONFIG, deferred: `total`-by-default, per-kind severity promotion, blanket axiom patterns (D34's text) and the CE-R8 severity knobs are one designed config surface, implemented when a project-config substrate exists — never as a global default change — accepted (deferred; owner B-018 rider) — reasoning: `docs/design/standard/totality.md` §5 + §8
- **T-R3** — Exhaustiveness stays `info` until T-R2 lands; promoting non-exhaustive-over-finite-type (or construction-path invariant failure) is exercised through the config surface, not by code drift — accepted — reasoning: `docs/design/standard/totality.md` §4 + §8
- **T-R4** — All-edges-decrease is the ratified mutual-recursion criterion (every in-cycle call decreases individually, over Tarjan SCCs); the archived common-lexicographic-measure requirement is replaced and kept as the recorded fallback — accepted (executed — describes shipped behavior) — reasoning: `docs/design/standard/totality.md` §3 + §8
- **T-R5** — Totality polymorphism is SUBSUMED by the effect calculus: the planned `[t: Totality]` marker system is discarded — `div` rides effect propagation and effect variables; the stdlib-HOF structural check stays an analyzer precision aid, not a polymorphism mechanism — accepted (discards v1 Phase-E Stage 5) — reasoning: `docs/design/standard/totality.md` §3 + §8
- **T-R6** — Inlining cutoff for the measured precompile pathology — accepted, then **AMENDED and BROADENED 2026-08** (maintainer-ratified on measurement): discharge tier was the wrong predicate, because a recursive call with unresolved arguments cannot converge whatever its tier, so restricting the cutoff to `undischarged` penalized PROVEN-total functions ~700× (`factorial(n: NonNeg)` 71.1s plus a spurious `precompile-type-error`, against 0.1s for the same function over bare `Int`). Shipped form keys on CYCLE MEMBERSHIP, fires only when an argument is unresolved (a fully-applied call still executes), and is installed BEFORE precompile, where the speculation happens — accepted (executed; **soundness review pending — B-100**, covering both the cutoff's reasoning and the analyzer's own lack of a termination discipline, which let a host stack overflow surface as a user-facing type error) — reasoning: `docs/design/standard/totality.md` §7 + §8

## CT-R series — contracts revalidation (design rulings, ratified 2026-08)

Design note: `docs/design/standard/contracts.md` §10 (B-014 closed). All
maintainer-ratified as recommended.

- **CT-R1** — "Sink-based checking" splits in two, and only relocation remains open: function-ENTRY/return checking is the ratified default, because the v1 principle's substance (check where the property is demanded) already ships as DISCHARGE — PE evaluates the check against the knowledge the actual arguments carry, so the same `requires` discharges at one call site and residualizes at another. What remains is emitting an undischarged check at the call site rather than the boundary — codegen and diagnostics (and the source of the call-site origin missing from counterexamples), not a change to what is proved — accepted (deferred; owner B-057) — reasoning: `docs/design/standard/contracts.md` §6 + §10
- **CT-R2** — Contract failure HALTS while construction failure yields an error VALUE, and the split is CE-R8's rather than a contracts inconsistency: a statement-form contract has no value to produce, a constructor does, and D11 governs the latter. v1's global `--strict` flag (never built) is superseded by the per-project severity surface, which carries the contract knobs alongside the totality ones — accepted (promotion exercised only through T-R2's config, never by code drift; owner B-099) — reasoning: `docs/design/standard/contracts.md` §6/§7 + §10
- **CT-R3** — `assume` was never actually rejected; it is D34's ADMITTED tier: `Law.assume` (E-R4) and `assume terminates` (CE-R3) both ship as recorded, ledger-visible admissions, and v1's constructor-pattern answer stands as the DEFAULT rather than a prohibition. The outlier `assume_invariant` — callable by name, no grammar sugar, no caller in the tree, and attaching a fact without recording anything — is the one path that trusts silently, and is retired rather than surfaced; a future `assumes` trust-boundary form is minted against the admitted tier with mandatory ledger visibility — accepted (retirement → B-101; surface form → B-057) — reasoning: `docs/design/standard/contracts.md` §2/§7 + §10
- **CT-R4** — Invariant inheritance is REFINEMENT LAYERING: the `Type.invariant` fluent API is deleted (D45/C6.1b), invariants are refinements (`T & pred`, chained per clause, records reaching fields through `_`), and an invariant persists down a chain because the refinement layer is structurally present — not because an inheritance policy carries it. v1's "extend inherits invariants" language is discarded, D44 having retired the declared is-a edge — accepted (executed — describes shipped behaviour) — reasoning: `docs/design/standard/contracts.md` §5 + §10
- **CT-R5** — Contracts are KNOWLEDGE: one D36 lattice, two carriers (intrinsic on the value, occurrence in the §4 facts plane), meeting at each check — superseding the v1 plan's standalone `predicates` component as the model. Two residues follow and are code, not design: the dual `domain`/`predicates` read (v1's own Chunk-1 cleanup task, never landed) and the writerless `type-invariant` predicate source — accepted (cleanups → B-101; physical storage under the `knowledge` channel remains C4's) — reasoning: `docs/design/standard/contracts.md` §3 + §10
- **CT-R6** — Contracts' absence from the verdict and the assumption ledger is a GAP, not a design choice: an undischarged `requires` is a pending obligation in D34's sense, yet theorems, law obligations, coercion obligations, div obligations and liveness axioms all reach the ledger while contracts reach only `inspect` — so a project can read a clean verdict while carrying unproven preconditions, contradicting "nothing is silently trusted" — accepted (recorded as a gap; folded into B-057 rather than minting a separate item, since it shares that machinery) — reasoning: `docs/design/standard/contracts.md` §7 + §10

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
