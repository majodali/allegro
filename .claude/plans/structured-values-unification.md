# Structured-values unification — design discussion

> Status: **design complete (D1–D44) — promotion in progress.**
> (D41–D43 — mediated member protocol / evidence-is-possession /
> extensible modifiers — added 2026-07 from the B-016a access-control
> session, maintainer-ratified.)
> This document is the decision log and rationale record. The distilled
> design is drafted in `docs/design/allegretto/structures.md` (pending maintainer
> sign-off); deltas to `type-system.md`, `effects.md`, and the rebuilt
> `BACKLOG.md` follow.
> Participants: maintainer + Claude, 2026-06 – 2026-07.

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
| D6 | `__*` prefixes are retired; meta-slots become declared slots with visibility/access attributes, recorded in a registry (`docs/design/standard/type-system.md` §4). |
| D7 | Internal `Type : Type` self-reference is kept; universe stratification is handled by translation at the proof-export boundary. |
| D8 | Equality is type-customizable, with declared laws; proofs record which equality they discharged under. Reference-equality-by-accident (the `proofValEqual` bug) is disallowed by design. |
| D9 | Arrays: no refs-inside-Bits (Bits stays pure reference-free data). Direction: base numeric-keyed structures with O(1) indexed host implementation + Standard encapsulated collection types choosing representations (packed Bits for primitive elements, dense structure storage otherwise). To ratify (B6/S4). |
| D10 | Functions keep returning annotated values: the return is a structure whose channels are populated per propagation rules. When the result is itself a structure, channels attach directly — no wrapper nesting. |
| D11 | **No operation errors on an incomplete value.** Operations on unresolved values produce residuals ("blocking" always means residual production, never throw). Explicit incompleteness *detection* is a separate introspection surface and is itself effectful (B12). |
| D12 | **Structures are always structurally complete.** Incompleteness is a value: an unresolved future occupying a slot, never a structure state. (Ratifies B3's core; downsides reviewed in B13 — headline: futures become write-once monotonic cells, confluent but interior-mutating.) |
| D13 | **RETIRED** (2026-06). The `seal` op was only ever discussed conceptually; D21 removed it (integrity = capability-gated channel origination + data-immutability, no seal primitive). The original concern — sealing a structure with unresolved future slots — cannot arise because there is no seal op. Any residual "freeze a transient" need is folded into the deferred transient→immutable finalization (D22). |
| D14 | **Slot keys are symbol \| string \| number; channel keys are always namespaced symbols.** Symbols gain optional namespaces; type-defined member identifiers become symbols rather than strings. Resolves B1: one slot space, partitioned by key sort — user data (string/number keys) cannot collide with channels. `primary` is a channel symbol, so duck-typed transparency is safe. |
| D15 | **MultiValue wrapper is flattened for structures**: channels attach directly. Scalar primaries (Bits etc.) use a *transparent structure* (empty data plane + `primary` channel) — same construct, not a distinct wrapper kind. |
| D16 | Reading a potentially-unresolvable value is an **effect**, dischargeable by a **resolvability/completion proof** — the first productive proofs×effects interaction (supersedes the orthogonality memo's claim for this case). Program correctness may not depend on unresolvable values. |
| D17 | A structure **cannot** have both data slots and a `primary` channel — transparent values have an empty data plane (closes B2). |
| D18 | Arrays are **numeric-keyed structures** — no separate vector primitive (ratifies D9/B6). |
| D19 | The unified construct is named **Structure** (closes B7). |
| D20 | **Symbols are unique values tied to their registering Scope** — the registering scope IS the namespace. Scopes that register symbols can carry FQNs and/or descriptive names; FQNs are unique and default to the module file path. Symbols are the **existing Symbol value kind, redefined** to meet these needs (not a new kind). Syntax: bare name where unambiguous (`x.type`); `x[type]` requires `type` bound via import (disambiguates across namespaces); namespace-qualified via imported namespace (`x[allegretto.type]` vs `x[algebra.type]`). |
| D21 | **No separate `seal` primitive.** The constructor-authority "brand" decomposes into (a) channel-write authority (B10/D23), (b) data-immutability (D22), and (c) non-fabricating propagation rules for integrity channels. Trust is **global and structural** — there is no per-value brand bit and no provenance tag; the base guarantees no one without the capability could have originated an integrity channel (memory-safety-style systemic guarantee). Channel→owner is static (from registration + D20 FQN) for audit. Verified against forgery scenarios A–F (proposition swap, channel copy, propagation fabrication, capability forgery). |
| D22 | **Structures are immutable by default.** Integrity guarantees (D21) assume data-immutability — born-immutable, so immutability is a property, not a `seal` op. Mutable/transient values (future linear-types work) cannot carry integrity channels without first *finalizing* to immutable (the only seal-shaped operation, deferred with the mutability story). Deep immutability: immutable values reference only immutable values (O(1) construction check via an immutable bit) — trivial under default-immutable, load-bearing once mutability lands (Risk 6). **Carve-out (from D32/D33)**: an unresolved **future cell counts as immutable** for the deep-immutability check — single-assignment/monotonic; the cell's identity is its eventual value — so shape-only immutable structures may hold future slots without violating the invariant. |
| D23 | **Channel writes are capability-gated; reads are free by default.** Registration is a base op `channel_register(symbol, propagation-rule, read-visibility?) → writer` returning the channel's write operation as a closure (D24); reads go through an unrestricted global `channel_read(symbol, value)`. **Origination** (setting a channel value from nothing) requires the writer; **propagation** (deriving result channels through operations per the registered rule) is automatic, performed by the evaluator, authority-free. **Constraint**: integrity-critical channels may only register **non-fabricating** propagation rules (`drop` or `computed`-with-recheck); `viral`/`union` on an authority channel is a forgery vector (scenario C). Read-visibility is a per-channel attribute (default public; read-gated/secret channels are S3 policy). **Capability shape RESOLVED by D24** (first-class delegable token, realized as a closure). |
| D24 | **Capability shape: first-class delegable token, realized as a PrimitiveFunction closure.** `channel_register` returns the channel's *writer* — a closure over private authority (existing value kind #2, so **no new kind**; satisfies Risk 5). The closure IS the write op; there is no separate `channel_write` primitive. Reads use an unrestricted global `channel_read(symbol, value)`. **Attenuation** = wrap the writer in a re-checking closure (the proof kernel's canonical pattern: stamp `discharged` only after re-running `proof_check`); **delegation** = pass the closure. Chosen over scope-ambient authority because (i) authority is a *value*, hence provable in-language (thesis fit) and trackable in the PE dataflow graph (+ future D3 taint); (ii) it unifies with the D2 effect-capability roadmap (`net[host:port]` budgets are attenuated tokens) — one authority mechanism, not two; (iii) **change-cost asymmetry**: scope-ambient is recoverable as a usage pattern (a module captures its writer privately and never exports it → module-private write), so token→ambient is ~free, while ambient→token would be a base-API + call-site + re-audit break that D2 forces anyway. Obligations (all follow from PrimitiveFunction, but stated as soundness requirements because the PCP serialization boundary is load-bearing): writers are **non-serializable**, **print redacted**, **identity-equal only** (S2). Cross-process trust therefore bottoms out in **re-verification** (PCP hash-match), never transported authority. Two writers always exist in the TCB: the user-facing writer closure (origination) and the trusted evaluator core (rule-governed propagation, D23) — the core is privileged under any scheme. |
| D25 | **Scope** is the evaluation-environment role of today's Context (D1's split): name→value bindings, lexical **parent-chain layering**, the unresolved-binding / forward-chaining substrate, and a scope-held **facts plane** (S9 knowledge applied to names). It shares the slot+channel substrate with Structure but is a **distinct role** with its own operations — resolution-through-parent, forward-chaining, and fact layering are scope behaviours with no meaning on data Structures, and the separation stops an evaluation environment being mistaken for user data (no type-dispatch on `scope.x`). The `Context` kind-name is retired: record-role → Structure (D1/D15), scope-role → Scope. Whether Scope is literally a Structure tagged with a `scope` channel or a thin distinct kind is an I-level call; the design commitment is *shared substrate + distinct protocol*. Kind count does not grow (Context + MultiValue → Structure + Scope; 3 roles → 2). |
| D26 | **Scope op surface + `ctx_*` disposition.** `scope_new(parent?)` (refactor `ctx_new` — explicit parent enables a real chain vs today's O(n) flatten-copy); `scope_extend(scope, name, value) → scope'` (refactor `ctx_bind` — O(1) immutable layer, not a whole-map copy); `scope_lookup(scope, name)` (refactor `ctx_resolve` — walk the chain; bound → value with merged facts; **unresolved → residual, never throw** per D11; a genuinely-absent name is a compile-time lexical-resolution error per D20 for *source-level* symbol resolution, while the *reflective* runtime op returns an **error value** on the public error channel, never throws); `scope_bindings(scope)` (keep `ctx_bindings` — introspection / REPL / module export; own slots by default). **RETIRE `ctx_use` and the `Binding.isUse` flag** — an unresolved binding is a slot holding an **unresolved future cell** (D12/B13), so the `isUse` / `value === undefined` duality collapses to one representation; the REPL carry-forward (isUse's only reader) keys off cell-resolved-state. New `scope_assume(scope, name, predicate) → scope'` replaces the in-place `scopePredicates` mutation: the **facts plane is immutable-layered** — branch-then / assert / requires push a *child scope* carrying the fact and discard it on exit (no mutate-and-pop), which is exactly S9's monotonic knowledge attached to occurrences. **Layering constraint**: the fact payload is **opaque to the base** — `scope_assume` stores and layers facts; *interpreting* them (predicate lattices, implication) is Standard-layer (D27), keeping the knowledge semantics out of Allegretto. The evaluator's internal Symbol resolution (already residualises on unresolved + merges scopePredicates) and the reflective `scope_*` primitives now share **one** resolution semantics, not the current two divergent paths (evaluator residualises; `ctx_resolve` throws). |
| D27 | **Minimal base surface (the layering proof).** Allegretto's irreducible base is ~40 primitives in five groups: **Bits** (arithmetic / comparison / bit-ops / encoding — `bits_*`); **Expression** (DAG construct / introspect / eval — `expr_*`); **Structure** (`struct_new`, `struct_get(key)`, `struct_with` CoW-derive, `struct_slots`; transparent/scalar values via the `primary` channel per D15/D17); **Channel plane** (`channel_register(symbol, rule, read_vis?) → writer` per D24, free `channel_read`, free `channel_list` enumeration — needed by introspection/PCP, evaluator-applied propagation); **Scope** (`scope_new/extend/lookup/bindings/assume` per D26); plus core control (`eval_if`, `seq`, `id`), `Param`/`Symbol`, and immutability (`immutable?`). The **future cell + forward-chaining completion cascade** (today's `FutureManager`/`applyPhase`, D33) is base *evaluator machinery*, not a primitive — futures have a base footprint even though their producers (`fetch` etc.) are ENV. **Everything else now in `src/primitives.ts` is NOT base**: the entire type system, logical ops, proofs, refinements, effects, contracts, totality, the grammar-tooling primitives, and IO (`print`/`fetch`/`delay`) are Standard-layer extensions or environment-provided capabilities. The unification therefore doesn't just merge value kinds — it **relocates the type system and the whole provability stack out of the base**, which is the layering proof B8 demanded. Validates Risk 5: the base shrinks from well over 100 registered primitives to ~40. |
| D28 | **Subsumption mechanics for the audit.** (Terminology per D24: there is no `channel_write` primitive — "write" below always means *invoking the channel's writer closure*.) (a) `mv_*` + `component_get` → channel/slot ops: `mv_primary`/`mv_get`/`component_get` → `channel_read`; `mv_set` → the channel's writer (capability-checked); `mv_components` → channel enumeration (`channel_list`, free). (b) `make_error` → the **error channel**'s writer — a *publicly-exported* writer whose **viral** propagation rule reproduces today's automatic error propagation. (c) The entire **`*_attach` passthrough family** (`effects_attach`, `partial_attach`, `decreases_attach`, `proven_attach`, `param_effects_attach`, and the transparent `seq`/`type_check` forwarding) **collapses into writer invocations** on the relevant channel (effects / predicates / totality); the matching `*_decl_marker` parse helpers move to the grammar/extension layer. (d) Channels span **gated** (integrity: `discharged` owned by the proof kernel, `type` owned by the type-system extension, **`effects` owned by the effects extension** — a publicly-writable effects channel would permit effect-erasure forgery, claiming `pure` while doing `io`; assign to S6) and **public** (error, warnings, source) — one mechanism (you need the writer), and policy is whether the owner exports it (D23/D24). **Finding**: the pervasive "registered lazy so it receives un-`primaryOf`'d args" workaround on every proof/typed primitive is a direct symptom of the D3 stripping asymmetry — per-channel propagation (D3/D15) removes the need, so the proof kernel and typed ops drop the lazy hack. |
| D29 | **Symbol redefinition (base — resolves B9-residual).** The existing Symbol kind becomes a first-class runtime value with **defining-context (Scope) identity** → an FQN (default: module path + name). **Same FQN = same symbol** (interned), so conformance/structural comparison is symbol-identity comparison. Each symbol carries a **canonical base-name string** projection, used for serialization, printing, and the string-projection matching path (D30). Resolution: a bare name binds to a symbol via the same scope/import layering that resolves bindings (extended with a symbol-registry layer). **Single governing principle**: base-name is a convenience projection, the symbol (FQN) is identity, and wherever a base-name is ambiguous **explicit qualification (`x[ns.name]`) is required, else error** — this recurs identically at import resolution, type-level member binding (D30 multi-match), and value-level dot-access. **Ambiguity = multiple distinct *targets***, not multiple symbols: a single member definition multi-bound to several symbols (D30 diamond) makes bare dot-access unambiguous — it has one target. Equality = FQN (declared; feeds S2/D8; never accidental reference equality). Serialization/print = FQN, abbreviated to the base name when unambiguous. Scope *binding* keys may stay strings (D14: only channels/members must be symbols). |
| D30 | **Member-symbol conformance model (Standard type-system layer, per D27 — resolves S7 + B9's crux).** Types **draw member symbols from declared contexts** (interfaces / base types / mixins): a member whose base name matches a drawn context's symbol **binds to that imported symbol**; non-matching members get a **type-local** symbol. A single member definition may bind to **multiple symbols** — the diamond (same base name across independent interfaces) and, generally, arbitrary symbols; extension/override may bind several inherited members with one definition. **Multiple matches → error by default**, forcing explicit resolution; an opt-in keyword/annotation may permit auto-multi-bind if verbosity warrants. Conformance (`instanceof`/interface) is a **symbol-identity** membership check over `__members` — therefore **declared, not accidental** (the maintainer's preferred default; retroactive/third-party conformance is via **mixins / partial type declarations**). The **loose/accidental** structural path — `~T` and anonymous `{…}` pattern destructuring — matches by **string-projection** and is aimed primarily at **data values, not types**. **Observation (forward to S1 / syntax track)**: type-extend, interface-implement, and mixin are the *same* operation — composing a set of member declarations (± definitions, ± new nominal identity, ± structural marker); whether distinct construction methods/keywords are needed is a syntax-design question, deferred. Duck-typing earns its place only where declared conformance is clumsy — watch for that in syntax design. |
| D31 | **Completion = totality ∧ liveness (async-cluster core frame).** A computation *completes* iff it **terminates** (internal, well-founded) **and** everything it awaits **resolves** (external, liveness). Incompleteness has exactly two sources, each a **completion effect**: the **blocking-read** effect (reading a value that may never resolve — external, D16) and the **divergence** effect `div` (calling a function that may never return — internal). Both are undecidable; both discharge by proof (liveness axiom / termination witness). An **incomplete value** is uniformly either an unresolved future (awaiting liveness) or a `div` residual (awaiting termination that may never come). Deadlock in the sync regime is a dependency **cycle** among unresolved bindings — statically detectable in the `DependencyRegistry` graph. Resolves B11's framing. |
| D32 | **Triggered construction guard (adopts B14 in triggered form; resolves B14+B15).** The guard fires only when a structure carries a **value-inspecting invariant** — a refinement / `Type.invariant` predicate that reads field *values* (field *types*, incl. `Future[T]`, discharge on the slot without the value and never trigger it). **No such invariant → no guard**: the structure is a D12 structure that may hold futures in slots, and **partial access is free** (resolved slots read, future slots residual per D11) — this preserves PE-thesis pipelining. **Has one → construction is held as a residual** until the referenced fields resolve, so the invariant is checked before the value exists (build safety in). **Partial access under the guard (B15)**: a projection `r.f` is admissible when `f` is not referenced by a still-pending invariant, but stays **guarded by construction success** (errors/residuals if the invariant ultimately fails — speculative, error-propagation as rollback); fields a pending invariant references block until it discharges. **Soundness link**: value-inspecting invariant predicates **must be total** (`div`-free) or the guard could hang — the guard needs both halves of completion (inputs resolve ∧ check terminates). **Implementation note**: the guard is plausibly *emergent* from existing PE rules, not new machinery — the invariant predicate reads a future-holding slot, residualises per D11, so `__construct` residualises per Rule 1, which *is* the held constructor; only B15's guarded projection needs genuinely new mechanism. |
| D33 | **Futures & incompleteness model (resolves B13 + B12).** A **future** is the sole *external* locus of incompleteness — a pending async result at the I/O boundary (`fetch`/`delay`) or an explicit `Future[T]` slot — represented as a **write-once monotonic cell** (single-assignment ⇒ confluent; Oz/IVar). It is the only surviving interior-mutating cell, confined to the I/O edge (invariant-bearing immutables contain none, per D32; shape-only structures may hold future slots — accepted, monotonic). `Future[Future[T]]` **flattens** (monadic join); equality on an unresolved future → **residual** (D11), never blocks. Forward-chaining (`FutureManager` / `applyPhase` / `propagateCompletions`) is retained as the resolution cascade. **Incompleteness detection** (`is_resolved`, non-blocking select) is scheduling-dependent → **must be an effect** (extension-level, not base), quarantining nondeterministic observation from the confluent pure core (resolves B12). |
| D34 | **Discharging completion effects (resolves B11 liveness + promotes totality; fork 2).** Both completion effects discharge by proof, **strict by default** (undischarged until discharged). **Divergence** (`div`): promoted from a Phase-E *info notification* to a first-class **computed** effect — its inference *is* the termination analysis (SCC + lexicographic metrics), not a flat union. Spectrum: (1) auto-proven total (Phase E checker); (2) user-witnessed total (`decreases <metric>`, kernel-*checked*); (3) admitted total (`assume terminates`, or a project axiom covering a `partial`-marked function) → axiom; (4) undischarged — `partial`-marked or unproven — caller inherits `div`, correctness may not depend on completion (D16, internal side). (`partial` itself always means case 4, "may not terminate"; only an explicit axiom lifts it to case 3.) `div` is **discharge-only** — no runtime handler (divergence is uncatchable in pure semantics). **Liveness** (blocking-read): discharged by a **declared liveness axiom** (irreducibly external — admitted, not proved). **Shared mechanism**: **project-level axiom patterns** (e.g. `fetch <url-pattern>`; "trust `lib/legacy/` as total") are blanket defaults for low-assurance projects; every admitted axiom is **verdict-visible** (Risk 7). |
| D35 | **Resource complexity is not a core effect.** Time/space growth is a **quantitative performance** property, orthogonal to the completion/correctness axis — kept out of the io/div tier. It splits: **static asymptotic bounds** (`O(g(n))`) = a *theorem over a cost measure* → a **deferred proof-genre extension** (needs a cost model + per-dimension input measures + recurrence solving; sound-but-incomplete like termination, heavier); **resource budgets** (fuel/step or live-space ceilings) = **capabilities** (D2 budget machinery) whose overflow is a **catchable `ResourceExhausted`** outcome (definite/observable, unlike `div`). Fuel is a `decreases` witness, so **budgeted code is total by construction** — budgets convert unbounded `div` into bounded, catchable failure, and a static bound (if available) sizes the budget. Distinct from the existing `time` effect (real-world clock observation). |
| D36 | **Shape/knowledge split (resolves S9).** The `type` channel's two roles separate: **`shape`** (declared type — layout, member set, nominal identity; fixed at construction, immutable, part of value identity; the I1 hidden class; the dispatch member source) and **`knowledge`** (imputed type + predicates unified into **one monotonic lattice**: base-type bound + abstract domains + predicate set; **excluded from value identity and equality**). Knowledge has **two carriers**, same lattice: **intrinsic** — certified at construction (e.g. `PositiveInt(5)`'s `>0`), rides the value across scope boundaries — and **occurrence** — flow-derived facts in D26's scope facts plane (`scope_assume`); effective knowledge at a use = **meet** of the two. This unifies the imputed half of `type`, on-value `predicates`, and `scopePredicates` into one construct with two carriers. **Dispatch**: runtime dispatch is **virtual on actual shape** (overrides run, Liskov); knowledge is the **static availability gate** + PE-resolution enabler (`x.method()` resolves at compile time when knowledge suffices, else residualises). **Annotations are knowledge upper-bounds** = member-hiding abstraction boundaries (`x: Animal` over a Dog hides Dog's members until narrowed; crossing a boundary sets the new occurrence's starting knowledge — monotonicity holds per scope). **Refinements are excluded from equality**: `PositiveInt(5) == Int(5)` (same shape, same data; the certificate rides along, sound because passing the bare value re-verifies). **Knowledge-observation is effectful**: `instanceof` on a refinement means **pure predicate re-check** (recomputes from data — congruence-safe, not effectful); **certificate-peeking** ("was this *constructed* as PositiveInt?") is a separate, *effectful* introspection op — keeping `proof_cong` sound (congruence holds only for knowledge-independent functions) without making a common operation noisy. |
| D37 | **Equality framework (resolves S2).** Equality **dispatches on shape, never knowledge** — required for a globally stable equivalence relation (knowledge-dispatch would make `a == b` vary by program point). Resolution: (1) **same shape** → that shape's `equals`; (2) **different shapes** → coerce **both** operands to the **least common type** via *declared* coercions and run its `equals` — symmetric by construction, hence commutative; (3) **no common type → not equal** (conservative default; a `distinct` type is unequal to everything until it declares a coherent coercion). **Laws and their discharge split by kind**: reflexivity/symmetry/transitivity of a custom `equals` = per-type theorems (D38 obligations; kernel-auto for the default structural equals); coercions carry **equality-preservation** (`x ==_A y ⟹ coerce(x) ==_B coerce(y)`) and **pairwise coherence** (commuting composition triangles) obligations — the *new* declaration bears the proof, existing types never re-verify (open-world, as D30/D23); **monotonicity/stability under knowledge refinement is structural, not a theorem** — `equals` must be **pure and knowledge-independent** (free of the D36 observation effect), checked mechanically at definition. **Value-equality is not Leibniz substitutivity**: equal values may differ in knowledge; `proof_cong` applies only to knowledge-independent functions (guaranteed by the effect check). Capability writers (D24) remain identity-equal only. Proofs record **which equality and which law tier** they discharged under (extends D8): a `proof_trans` chain resting on an *admitted* transitivity is verdict-visibly weaker than one resting on a proven one. Equality proofs are stable under knowledge narrowing (established at shape level ⟹ never invalidated by refinement). |
| D38 | **Lawful interfaces (generalizes D37's laws; the mechanism D8 promised).** Interfaces may carry **law members** — named theorem *templates* quantified over the implementing type — alongside operation signatures (`Equatable = interface({equals: (T,T) => Bool [pure], law refl: …, law sym: …, law trans: …})`). Drawing from a lawful interface (D30) makes conformance **semantic**: binding an implementation **instantiates each law into a pending Obligation** (H1 schema) attached to that implementation at definition time; coercion registration likewise generates its D37 obligations. **Discharge = the D34 spectrum, verbatim**: (1) kernel-auto (PE / `prove_for_all_bool` on finite domains; **generic proofs** for kernel-supplied default implementations — the structural `equals` is proven lawful once, parametrically); (2) witnessed (`by` proof term at the implementation site); (3) **sampled-falsification** (F7 machinery: a counterexample **halts compilation** with concrete inputs; a clean pass is survival, *not* proof); (4) admitted (`assume law` / **project-level pattern axioms** for low-assurance projects) — always verdict-visible; (5) pending → exported via `allegro obligations` to PCP workers (H4) — law obligations are exactly the well-posed proof tasks the LLM-prover loop targets. **Default is STRICT** (maintainer-confirmed, matching D34 fork 2): unproven + unadmitted = pending, and **law-dependent contexts refuse it** (`proof_trans` demands the equality's `trans`; sort demands `Ordered` totality). **Amortization**: unchanged inherited implementations inherit their proofs (same definition ⟹ same theorem); refinement subtypes are free (same shape, same `equals`); only *custom* implementations and overrides bear fresh obligations. **Generality**: equality is instance #1 — `Ordered` (antisymmetry/totality/consistency-with-equals), `Monoid` (associativity/identity), `Semiring` (**distributivity — a cross-operation law lives on the interface declaring all participating members**), Functor laws for `map` (`map(id)==id`, composition — discharged laws license PE rewrites, feeding compilation). Laws require effect-bounded (`pure`) members for proposition stability (Stage D bounds). Standalone facts remain plain `theorem`s; feeds S1's define-a-kind recipe. |
| D39 | **`__*` slot disposition (completes D6).** D6 retired the prefixes; D39 assigns every current `__*` slot (full inventory grepped 2026-07) a declared home. Slot names become **symbol-keyed members declared on the owning meta-type** (D14/D29/D30), with visibility per S3. **Type fields**: `__name` → `Type.name`; `__members` → `Type.members`; `__extends` → `Type.parent`; `__construct`/`__constructor` → `Type.construct` (per-kind minting authority, S1-R2); `__getMember` → `Type.fallbackMember`; `__interface` → `Type.structural`; `__invariantsList` → `Type.invariants`; `__wraps` → `Type.wraps`; `__union` marker → `Type.variants`. **Refinement-type fields** (on the type instance, distinct from value-side knowledge): `__predicate` → `predicate`, `__abstractDomain` → `domain`. **GenericType fields**: `__genericParams`/`__params` → `params`; `__args` → `args`; `__generic` → back-link field; `__isGeneric` → DELETE (the flag IS the kind — shape = GenericType). **Proof fields**: `__proposition`/`__reason`/`__counterexample`/`__eq_lhs`/`__eq_rhs` → declared Proof members (`proposition`, `reason`, `counterexample`, `lhs`, `rhs`). **Effect fields**: `__effect_kind` → `Effect.kind`; effect-variable metadata (`__effectvar`, `__effectVarParams`) → declared generic-param structure on function types. **Channels, not fields**: `__type` → the **shape** channel (D36); `__discharged` → the **discharged** integrity channel (D21–D24); `__effectSet`/`__inferredEffects` → the **effects** channel (F1's component made canonical); value-side predicate sets (`__predicateSet`) → the **knowledge** channel (D36). **Base concepts, not slots**: `__length` → numeric-structure slot count (base op / Array member, D18); `__future_N`/`__bare_N` synthetic bindings → future cells (D33) — the name-hack disappears. **Host-engine internals** (never value slots; stay host-side, renamed freely): `__el_`, `__grammar*`, `__parse*`, `__inline_grammar*`, `__start__`/`__error__`, `__grammarValue`/`__grammarHandle`/`__grammar_fragment`, `__compileMode`, `__futureManager`, `__tailCall`, `__anon_` gensyms. **Rule going forward**: no new `__*` slot may be introduced; a new meta-slot is a declared member on its owning kind (or a registered channel) from day one. The doc's own earlier references to `__members` etc. (D30, S7) are legacy shorthand for the post-D39 declared fields. |
| D40 | **Kinds are just Types (resolves S1).** A **kind is a type whose instances are type-values**, and instance-of = **shape-of** (D36): `io : Effect`, `Int : Type`, `Effect : Type`, `Type : Type` (D7 fixed point — no `Kind` above `Type`, no tower; the recipe is defined in terms of Type, which the type-system extension supplies as its own instance). **Subtype-of stays `Type.parent`** — orthogonal to instance-of. **Members live once, on the kind**: `io.union(time)` dispatches through io's shape (Effect) exactly as `42.toString()` dispatches through Int — `buildEffect`'s member-copying is deleted; the recipe's instance-member spec is the kind's ordinary member declarations, uniformly at every meta-level. Effect bounds in param positions are **knowledge** (D36), never the function value's shape, so no member-merge pressure exists and the **multiple-inheritance revisit trigger is dissolved** (D30 draw-from covers member composition; update the MI memo). **The define-a-kind recipe** (a Standard-layer lawful-interface-driven type definition, no host code) takes: name; instance-member declarations; **(R1) an instance ORDER as a declared kind parameter** — Type's is `subtypeof`, Effect's is lattice subset with join/meet + top/bottom, Proof's is none; the checker consults *the kind's order* when instances appear in bound positions, and D38 laws attach to the order ops (lattice axioms live here); **(R2) constructor authority** — minting an instance = stamping shape K, gated by the existing D23/D24 channel capability per kind: Type/Effect public, **Proof kernel-private** (proof unforgeability becomes an ordinary channel-capability instance, not a special arrangement); **(R3) operator-minted anonymous instances** — kinds may declare operators returning new instances (effect conjunction `io & time` → anonymous Effect carrying the label set — closes the deferred anonymous-conjunction debt); their equality falls out of D37 (same shape → the kind's `equals` → label-set equality); **(R4) kind-level laws quantify over instances** (type-values) with D38 amortization — kind-supplied fixed ops get one parametric kernel proof, new named atoms (`Effect("net")`) bear no fresh obligations, only overrides do. **(R5) Migration deltas** (conscious, per PROCESS §6): `pure subtypeof Effect` (today true via the `__extends` hack) becomes **false**; `pure instanceof Effect` becomes the correct check — tests/docs asserting the old behavior change meaning; `GenericType` re-frames as the kind of type-constructors (`Array : GenericType`, `Array[Int] : Type`, application = its construction protocol). **Validation criterion**: the recipe is done when **Effect and Proof are re-derived through it with zero hand-rolled residue** (D39's field tables are the checklist); GenericType and module-types are stretch targets. |
| D41 | **Mediated member protocol (resolves S3 mechanism, maintainer-ratified 2026-07).** Member access is a four-stage pipeline executed as ONE PE act: **(1) project** — text → symbol by base-name projection against reachable symbols (§5 rules; the base resolver, and ONLY it, does name resolution); **(2) availability** — the occurrence's effective knowledge gates whether the symbol may be referred to here (D36/C3.2); **(3) mediate** — the shape's `getMember(symbol, instance, context)` maps the resolved symbol to an ACCESSOR (getter / self-bound method / attenuated view), consulting the member declaration's modifiers; **(4) dispatch** — the accessor runs against the shape (overrides run, Liskov). `getMember` is the Standard-layer half of the single resolver, not a second mechanism: PE evaluates it and FOLDS it away when its inputs are static (the overwhelmingly common case — compiler-generated call sites specialize to the raw accessor; residual mediation remains only for genuinely dynamic cases). `getMember` never performs base-name resolution — its first argument is the already-resolved symbol; open/dynamic types (base Object, module objects) whose declared policy IS string-keyed dynamic access keep their fallback-member hook as that policy. Today's `type_dispatch` descriptor path becomes the default `getMember` implementation during Phase 6; the module type's export-enforcing `__getMember` is this protocol's existing production instance. The refusal invariant survives: a mediator with nothing to hand out = unavailable = error (no implicit fallback). The D36 confluence invariant extends to mediation: early (folded) and late (residual) mediation agree for fixed eventual inputs. |
| D42 | **Evidence is possession (resolves S3 enforcement, maintainer-ratified 2026-07).** Authorization is never principal-identity lookup; it is what the requesting context HOLDS. The `context` argument to `getMember` is **evaluator-supplied** — user code cannot fabricate the third argument of a dot access — and contexts are **reachability capsules**: under the C2 scope chain a context can only be extended from a scope one can reach, so a context that 'holds' module M's private symbols cannot be minted outside M. The **default evidence is symbol reachability**: private = the member symbol stays in the defining scope; internal = exported to the extension scope; protected = shared with subtype-declaring contexts at extends/draw-from time; public = exported with the type. Denial is therefore an AVAILABILITY outcome (nothing to resolve to), not a runtime permission event — static whenever scope + knowledge are static. Richer evidence (runtime credentials for identity-gated members) is still possession: a credential is a value the context holds; D24 capability closures remain the stronger tier for authority-bearing OPERATIONS where naming alone must not suffice (writers, kernel stamps). **Wire rule**: symbols serialize by FQN, but deserialization never mints reachability — foreign-FQN symbols rebind only against EXPORTED registries; a private symbol arriving over the wire resolves to nothing (same trust-boundary posture as D24 writers: cross-process trust bottoms out in re-verification). Composition with knowledge is conjunction: reachability(scope) ∧ availability(knowledge) must both hold — holding `Dog::tricks` does not help on an Animal-bounded occurrence until narrowed. |
| D43 | **Modifiers are declared member attributes, extensible per kind (maintainer-ratified 2026-07).** `private` / `protected` / `readonly` / sync-async / tracing / custom modifiers are NOT base-language constructs: they are attributes of member DECLARATIONS, defined at the Standard layer with the standard set itself carrying definitions, and the vocabulary is a kind-recipe input (D40 C6.1) — modules may define new modifiers or extend modifier behavior FOR THEIR OWN KINDS, never globally (extensions cannot be forced on unwitting consumers). Modifiers are what `getMember` consults at the mediation stage; they select accessors per context (e.g. writable-locally / read-only-externally = handing external contexts a D24-attenuated accessor; mutability write-semantics land with the transient-mutation track, the vocabulary reserves the slot now). **Purity/foldability rule**: mediation with static evidence (private/protected/readonly) is pure and folds at compile time — zero runtime cost, denial at PE time. Non-pure resolution is ALLOWED but fully covered by the effect calculus: a modifier consulting runtime state (identity gates, tracing wrappers) makes the member access EFFECTFUL — the modifier declares its effect label, D-arc inference propagates it, and enclosing functions cannot claim `effects pure` (same mechanical pattern as D37's knowledge-independent `equals`). The expected distribution: the vast majority of resolvers are pure, and most simply use possession of the right symbol as the only test (D42). Surface syntax (`private x: Int` in extend specs) lowers to symbol-export decisions + descriptor attributes; PROPOSED, pending the surface-syntax chunk: members public-by-default with opt-in `private`; member NAMES public by default so denial errors may say 'private to T' rather than feigning nonexistence (name-secrecy an opt-in later). |
| D44 | **Declared inheritance dissolves into conformance + refinement + composition (maintainer-ratified 2026-08; `Type.refines` name confirmed).** The subtype CHAIN (`__extends` as an is-a declaration between concrete types) is retired. What remains is exactly three relations plus kind membership: **(1) CONFORMANCE** — symbol-identity membership over member sets (D30/C5.2c), declared by DRAWING symbols; **(2) REFINEMENT** — a knowledge layer over a base (D36), carrying predicate/certificate structure; **(3) COMPOSITION** — member-bundle inclusion (the one construction operation D30 observed extend/interface/mixin already are); plus **instance-of = shape-of** (D40, unchanged: `Int : Type`, `io : Effect`). **Why the chain is now redundant**: nominal inheritance existed to make is-a DECLARED when conformance was name-based and accidental; C5.2c's symbol-identity conformance is exactly as declared as a subtype edge — same authority, same explicitness, one mechanism instead of two. **What falls out for free**: transitivity (B drew A's symbols ⇒ B's member set CONTAINS them ⇒ C drawing B's set holds A's — inclusion, no walk); overrides (an implementation bound under a drawn symbol IS the override; dispatch reads the shape); widening (`x: Animal` over a Dog-conformer is a C3.2 knowledge bound — no representation change, no coercion); diamonds (two bundles sharing a drawn base dedupe at the top — same symbols, one target; conflicting implementations hit the D30 multi-bind error demanding explicit resolution — multiple CONFORMANCE never needed multiple INHERITANCE). **The call-site audit (2026-08) is the evidence**: of every `__extends` consumer in production code, exactly ONE is genuine inheritance — the `nominalSubtypeof` name-string walk (which dies with the chain, dissolving its known name-collision false-positive rather than needing an FQN fix); five are refinement structure (type_check / type_instanceof refinement-base reads, certificate_peek's chain walk, checkArgType's base read, typeShape's transparency walk, preserveOps' base-of-refined read); three are the effect-lattice hack already scheduled to die at C6.2; the Method/Field→Member descriptor taxonomy dissolves with D39's descriptor migration. **Branding**: "only my descendants, not lookalikes" needs no chain — under symbol identity a lookalike cannot conform accidentally (it would have to deliberately draw your symbols, which IS the declaration), and `distinct` covers deliberate incompatibility. **Variance**: moves to S5 unchanged, restated over conformance (element-compatibility rule for `Array[T]`); D37's least-common-type comes from declared coercions only (already its stated preference). **Migration is DECISIVE (maintainer ruling 2026-08): no sugar.** `extend`-as-inheritance is REMOVED, not aliased — the composition operation gets its own name and surface at the C6.1 recipe design, and existing code migrates to it; the auto-generated record machinery (__construct, __getMember, toString) belongs to the composition operation, not to inheritance. `Type.parent` narrows to REFINEMENT STRUCTURE only — renamed **`Type.refines`** (ratified — "PositiveInt refines Int"; names the relation, not a hierarchy position). Effects stop using the link at C6.2 (D40 R5); interfaces keep their parent-DRAW at construction (a composition act) with no residual chain edge. **Ratification effects (now in force)**: supersedes the deferred-MI memo's trigger conditions (`.claude/memory/design_type_system_meta_types.md` — dissolved: multi-conformance needs no MI), reframes D39's `__extends → Type.parent` row to `→ Type.refines (refinement structure only)`, and becomes a first-class input to the C6.1 kind recipe (the recipe takes NO inheritance parameter; its instance-member spec + draw lists are the whole composition story). |

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
  async cluster split into B11–B15 (resolved by D31–D35).
- **B4. Sealing → immutability + brand (reframed).** Core **RESOLVED by
  D21+D22**: the brand reduces to B10 channel-write authority + data-
  immutability + non-fabricating propagation rules; no separate `seal` op.
  Verified against forgery scenarios A–F (see B10). Residual sub-questions:
  - *Depth*: immutable values may reference only immutable values (deep
    immutability). O(1) construction check via an immutable bit. Trivial
    under D22's default-immutable; becomes load-bearing once mutability
    lands and interacts with futures — under B14 immutables never reference
    unresolved cells (clean); without B14 the referenced future is a
    monotonic write-once cell (Risk 6).
  - *Channel narrowing vs immutability*: **RESOLVED by D26** (immutable-layered
    facts plane; S9 refines the semantics) — narrowing is
    knowledge-plane (derived references / scope-held facts, per
    scopePredicates), never value mutation; consistent with immutability.
    In-place narrowing would make observable channels depend on evaluation
    order (breaks confluence) and is disallowed.
  - *Identity equality* for branded immutables → **deferred to S2**:
    structural-including-integrity-channels is sound (channels are
    unforgeable, so structural equality can't admit a forged twin); identity
    is an opt-in per type; never accidental reference equality (D8).
- **B5. Scope kind.** **RESOLVED by D25+D26** — name **Scope**; the
  evaluation-environment role of Context, shared substrate with Structure,
  distinct protocol; op surface refactors `ctx_new/bind/resolve/bindings`,
  retires `ctx_use` + `isUse`, adds `scope_assume`.
  - *Current inventory* (src/primitives.ts §CONTEXT): `ctx_new`,
    `ctx_bind` (copy-on-write add), `ctx_resolve` (throws on missing or
    unbound), `ctx_bindings` (enumerate), `ctx_use` (declare a
    name-without-value slot: `{value: undefined, isUse: true}`).
  - *Findings (validated against the code, 2026-06)*:
    - `Binding.isUse` is vestigial — only `ctx_use` produces it (primitives.ts),
      only REPL carry-forward (runtime.ts) reads it. **Retired** (D26); an
      unresolved binding becomes a slot holding an unresolved future cell
      (D12/B13), unifying with futures' `__future_N` slots and the
      forward-chaining unresolved scan.
    - **No parent pointer exists today.** `ContextValue` carries only
      `bindings` / `bindingList` / `scopePredicates`; lexical layering is done
      by **flatten-copying** primitives + extensions + source into one flat
      map (runtime.ts), and `ctx_bind` / `ctx_use` copy the whole map per add
      (O(n)). The "parent layering" was aspirational — D25 commits to a real
      parent chain, which the immutable facts plane *requires* (flatten-copy
      can't represent discard-on-branch-exit).
    - **Two resolution paths exist.** The evaluator's Symbol case
      (evaluator.ts) already does D11 — unresolved → residual + records the
      incomplete dependency — and merges `scopePredicates`; the `ctx_resolve`
      primitive instead **throws** on missing/unbound. D26 unifies them on the
      evaluator's (residualising) semantics.
    - `scopePredicates` is **mutated in place** (`(ctx as any).scopePredicates
      = new Map()`, branch/assert push-and-pop). D26 replaces this with
      immutable child-scope layering — the S9 knowledge plane.
- **B6. Base array mechanism.** **RESOLVED by D18** — numeric-keyed
  structures, O(1) indexed host implementation, no vector primitive.
- **B7. Name.** **RESOLVED by D19** — **Structure**. (The evaluation
  construct is **Scope**, per D25/B5.)
- **B8. Minimal base surface.** **RESOLVED by D27+D28.** The base is the ~40
  primitives D27 enumerates; the full re-evaluation of every registered
  primitive (the maintainer-requested audit) follows. Disposition legend:
  **KEEP** (base), **REFACTOR** (base, reshaped per a Scope/Structure
  decision), **SUBSUME** (folds into channel/slot ops), **EXTENSION**
  (Standard-layer or grammar/module lib), **ENV** (environment-provided
  capability), **DELETE**.

  | Current primitives | Disposition | Target |
  |---|---|---|
  | `bits_*` (21: new/length/get/set/slice/concat, and/or/xor/not, eq/neq, add/sub/mul/div/mod, lt/gt/lte/gte) | KEEP | base Bits ops |
  | `expr_*` (8: apply/fn/args/arg/argc/param/function/eval) | KEEP | base Expression ops |
  | `eval_if`, `seq`, `id` | KEEP | base control / util |
  | `ctx_new/bind/resolve/bindings` | REFACTOR | `scope_new/extend/lookup/bindings` (D26) |
  | `ctx_use` | DELETE | unresolved = future-cell slot (D26) |
  | `mv_new/primary/get/set/components`, `component_get` | SUBSUME | `channel_read` / channel writers / `channel_list` (D28a) |
  | `make_error` | SUBSUME | the public, viral error channel's writer (D28b) |
  | `eval_when`, `when_wildcard`, `when_struct_destruct`, `when_no_match` | EXTENSION | pattern-matching lib over `eval_if` + struct reads (judgment call — could stay base control) |
  | `when_type_destruct` | EXTENSION | needs the Standard `type` channel |
  | `typed_int/string/float/bool/array/object/function`, `typed_add..gte`, `typed_and/amp/or/not` | EXTENSION | Standard type system (owns the gated `type` channel) |
  | `type_dispatch/of/check/instanceof/subtypeof/apply/function/union/refine`, `structural_wrap`, `type_check_binding` | EXTENSION | Standard type system |
  | `export` | EXTENSION | module system |
  | `assert_invariant`, `assume_invariant`, `assert_stmt`, `requires_stmt`, `ensures_decl/check` | EXTENSION | contracts/invariants lib; checks become predicate-channel writes + `scope_assume` |
  | `*_decl_marker` + `*_attach` (effects / param_effects / partial / decreases / proven) | SUBSUME / EXTENSION | `*_attach` → channel-writer invocations (D28c); `*_decl_marker` → grammar templates |
  | `proof_by_eval/refines/refl/sym/trans/cong/check`, `prove_for_all_bool/induction` | EXTENSION | proof kernel (canonical `discharged`-writer holder); drops the lazy hack (D28 finding) |
  | `grammar_*`, `grammar2*` (bundle), `register_*`, `grammar_fragment_*`, `grammar_rule_*`, `grammar_combine/override/without` | EXTENSION | grammar-tooling lib (engine stays host code) |
  | `print` (io), `fetch` (net), `delay` (time) | ENV | environment capabilities, effect-labelled |

  *Findings*: (1) the type system, proofs, effects, contracts, and totality —
  the bulk of `primitives.ts` — are all EXTENSION, confirming D4's
  mechanism-in-base / policy-in-extensions line concretely. (2) The `*_attach`
  zoo exists only to smuggle metadata through the `primaryOf`-stripping
  evaluator; channels delete the whole family (D28c). (3) IO is not base —
  `print`/`fetch`/`delay` are environment capabilities, which is why they carry
  effect labels.
- **B9. Symbol value semantics.** Core **RESOLVED by D20** (scope-as-
  namespace, FQNs, redefine the existing Symbol kind, bare/import/qualified
  syntax). Ownership/forgeability is answered: symbols are *registered* in a
  scope, not freely constructible into foreign namespaces. **Residual RESOLVED
  by D29** (base) **+ D30** (Standard type-system layer): the AST-reference-vs-
  runtime-value duality, resolution timing (bare name binds via the scope/
  import layering pass, extended with a symbol registry), cross-session
  identity (FQN, interned), serialization/printing (FQN, base-name shorthand
  when unambiguous), and the bare-name ambiguity rule (ambiguous → error,
  qualify with `x[ns.name]`) are all covered there.
- **B10. Channel write control.** Core **RESOLVED by D23**: capability-gated
  writes, free reads, registration returns a writer capability, origination
  vs propagation split, non-fabricating-rule constraint for integrity
  channels. Mechanism-in-base, policy-with-capability-holder. **Capability
  shape RESOLVED by D24** — first-class delegable token realized as a
  PrimitiveFunction closure (the registration-returned writer); scope-ambient
  authority is recovered as a usage pattern (module captures its writer
  privately and never exports it).
  *Forgery-scenario log* (the verification D21 cites):
  - **A** (forge `discharged` from nothing): blocked — origination requires
    the writer closure, held privately by the proof kernel.
  - **B** (swap a real proof's proposition, keep `discharged`): blocked —
    data-immutability (D22). This is why write-authority alone is
    insufficient; immutability is the second leg.
  - **C** (combine a real proof with a fake operand hoping `discharged`
    propagates): blocked iff the channel's propagation rule is non-fabricating
    (`drop`/`computed`-recheck) — hence D23's constraint. A `viral`/`union`
    rule here WOULD forge.
  - **D** (read a real `discharged` value, write it onto a fake): blocked —
    reads are free but the *write* still needs the capability. Confirms
    read-freedom is safe.
  - **E** (capability leaks): standard ocap risk; the base guarantees safety
    *given* the holder keeps it private (S3 encapsulation). Assumption, not a
    base flaw.
  - **F** (forge the capability itself): blocked — the writer is a
    PrimitiveFunction closure (D24), unconstructible from Allegretto.
- **B11. Completion semantics: sync vs async** (new, split from B3).
  **RESOLVED by D31 + D34.** The two cases are distinct; nearly all concerns stem from **async**. Headline:
  **deadlock — resolvability/completion must be provable.** Sync completion
  (forward-chaining within a pass) is deterministic; deadlock = dependency
  cycle, statically detectable. Async resolution depends on external events;
  liveness needs declared assumptions (e.g. "fetch eventually resolves or
  errors") as axioms feeding completion proofs. Possibly the most important
  proof use case (D16). Needs the dedicated session.
- **B12. Incompleteness detection** (new, split from B3). **RESOLVED by D33**
  (detection is an extension-level effect). Use cases needing
  to *observe* unresolvedness: non-blocking I/O, deadlock detection, effect
  accounting. An `is_resolved`-style op's result depends on scheduling — it
  breaks confluence/determinism, so it must itself be an effect. Enumerate
  the use cases and the minimal detection surface.
- **B13. Future value mechanics** (new, split from B3). **RESOLVED by D33.**
  Write-once monotonic
  cell (interior mutation, but single-assignment ⇒ confluent — Oz/IVar
  precedent) vs structure-replacement propagation (today's residual model);
  future-of-future flattening ruling; per-slot read overhead (is-it-a-future
  check — PE/shapes can discharge statically when type known); memory
  retention of resolution machinery; equality on futures → residual per D11.
- **B14. Async construction guard for immutables** (new, maintainer
  proposal, lean: adopt). **RESOLVED by D32 — adopted in *triggered* form
  (fires only on value-inspecting invariants), which recovers partial access.**
  Conservative route: transparent incomplete slots
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
  reservation). **RESOLVED by D32** (guarded projection; fields untouched by a
  pending invariant are projectable but stay guarded by construction success).
  Analyze PE shortcuts that recover pipelining on
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

- **S1. Meta-type construction.** **RESOLVED by D40** — kinds are just types
  (instance-of = shape-of; subtype-of = parent, orthogonal); members live once
  on the kind (dispatch-through-shape, no copying); the define-a-kind recipe
  is a Standard-layer lawful-interface-driven type definition parameterized by
  instance members, a declared instance ORDER (consulted at bound positions,
  laws attached), per-kind constructor authority (channel capability; Proof
  kernel-private), and operator-minted anonymous instances (closes the
  `io & time` conjunction debt). The multiple-inheritance revisit trigger is
  dissolved (D30 draw-from + effect-bounds-are-knowledge); update the MI memo.
  Validation: re-derive Effect and Proof with zero hand-rolled residue
  (D39's field tables as checklist).
- **S2. Equality framework.** **RESOLVED by D37 + D38**: shape-dispatch,
  symmetric coercion to a least common type (else unequal — conservative
  default), law/obligation split (per-type theorems; per-coercion
  preservation + coherence; structural monotonicity via the
  knowledge-independence effect check), capability writers identity-equal
  only, proofs record equality + law tier. (`~`'s role is answered by D30 —
  the loose string-projection structural path.) The original per-category
  defaults survive as: structural `equals` is the kernel-supplied lawful
  default; identity is per-type opt-in (memoized nominal types, capability
  writers); never accidental reference equality (D8).
- **S3. Visibility/access control.** Attribute set (public / internal-to-
  defining-extension / …); requires an ownership notion tied to the module
  system. ~~Enforcement point: dispatch reads slot attributes (Standard);
  sealing (base) backstops integrity.~~ **Reframed 2026-07 (maintainer):
  enforcement is PE evaluating the access with the call-site context as
  principal — no mechanism apart from PE resolves what member text refers
  to (symbol vs string key), whether it is available (knowledge), or
  whether the principal is admitted to it.** Candidate shapes: D24
  capability-guarded accessors (possession = permission) vs. declared
  attributes checked against the principal. Question set recorded in
  structures.md §13; design session sequenced before C3.3.
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
  **RESOLVED by D30**: not a single global member table but **FQN-interned
  symbols with a per-type draw-from import** — a member binds to an interface's
  symbol when the type declares the draw and the base name matches, so
  `__members`-comparison conformance is symbol-identity (declared, not
  accidental). The cross-type comparability S7 needs is met by *sharing the
  drawn interface's symbol*, not by a global namespace.
- **S8. Blocking-read effect ergonomics** (new, from D16). **RESOLVED by
  D31 + D34** — under the triggered guard most reads are of resolved values
  (no effect); genuine future-reads discharge via completion proof / liveness
  axiom, and undischarged residue surfaces in verdicts as "rests on axiom X".
  The effect fires
  on any read of a potentially-unresolvable value — noisy by default. Shape
  of the discharge: completion proofs remove the effect (like domain
  implication discharges refinement checks); declared liveness axioms for
  external sources (B11); what the undischarged residue looks like in
  introspection/verdicts so it informs without drowning. (If B14 is adopted,
  most of the noise vanishes structurally — reads of immutables never block.)
- **S9. Imputed vs declared type** (new, maintainer note). **RESOLVED by
  D36**: the `type` channel splits into **`shape`** (declared — fixed at
  construction, part of identity, the dispatch member source and I1 hidden
  class) and **`knowledge`** (imputed type + predicates unified into one
  monotonic lattice, two carriers — intrinsic on the value, occurrence in
  D26's scope facts; effective = meet). Runtime dispatch is virtual on
  actual shape with knowledge as the static availability gate; annotations
  are knowledge upper-bounds (member-hiding abstraction boundaries);
  refinements are excluded from equality; knowledge-*observation* is
  effectful, with `instanceof`-on-refinement defined as pure predicate
  re-check (certificate-peek is a separate effectful introspection op).
  Names chosen: **`shape`** / **`knowledge`**.

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
   time) — contained by D12 (incompleteness is a value). **Async cluster now
   closed (D31–D35)**: deadlock is a static dependency cycle (D31), and
   unresolvability is the blocking-read completion effect discharged by
   liveness axioms (D34).
2. **Namespace collision under duck typing** (user `type` field vs type
   channel; accidental `primary` transparency) — RESOLVED by D14 (key-sort
   partition); the forgeability residual is RESOLVED by D29 (symbols are
   *registered* in a scope, not constructible into foreign namespaces) +
   D23/D24 (writer capabilities).
3. **Forgery through the base door** — if sealing were Standard-layer policy
   only, Allegretto code could forge Proofs; hence D4's mechanism-in-base.
   **RESOLVED by D21+D23**: integrity = capability-gated channel origination
   + data-immutability + non-fabricating propagation; verified against
   forgery scenarios A–F (B10). Capability shape resolved (D24, delegable
   closure). Residual: capability privacy (ocap, S3 — the owner must not
   export its writer closure).
4. **Custom equality × proofs** — **RESOLVED by D37 + D38**: proofs record
   which equality *and which law tier* they discharged under; `proof_trans`
   demands the equality's discharged/admitted transitivity; monotonicity is
   structural (knowledge-independence effect check), so equality proofs can't
   rot under refinement. Residual: obligation-discharge honesty (a sampled
   law is survival, not proof — tiering must stay visible in verdicts).
5. **Base-simplicity erosion** — every addition to Allegretto must pass B8's
   layering proof; the unification must *shrink* the kind count, not grow it.
6. **Interior mutation via futures** (D12/B13) — write-once cells are
   monotonic and confluent (single-assignment dataflow precedent), but they
   are the first crack in pure immutability. **Contained by D32 + D33**: the
   triggered guard keeps invariant-bearing immutables cell-free, so the only
   surviving cells are I/O-edge write-once futures (monotonic/confluent).
   Shape-only structures may hold future slots — accepted, monotonic — which
   is the deliberate trade for partial access (D32).
7. **Unprovable liveness for async sources** — **RESOLVED by D34**: liveness
   bottoms out in declared, **verdict-visible** axioms, strict by default,
   with project-level axiom patterns (`fetch <url-pattern>`) as blanket
   defaults for low-assurance projects. The same mechanism admits internal
   termination axioms (`assume terminates`). A proof resting on an axiom is
   weaker than a closed proof and says so.

## Next steps

1. **Base design complete (D1–D35).** All base questions B1–B15 are resolved
   — the synchronous core (D1–D30) plus the async cluster (D31–D35). D13 is
   retired (not obsolete-pending — the `seal` op is gone).
2. **All substantive design questions are resolved** (B1–B15; S1/S2/S7/S8/S9
   by D36–D40). Remaining Standard-layer items — **S3** (visibility), **S4**
   (collections), **S5** (variance/constraints — note D36/D40: constraints are
   knowledge on type-values), **S6** (channel registry — incl. the gated
   `effects` channel and channel-removal/erasure rules) — are mechanical
   enough to spec during promotion.
3. Parser design discussion (separate track, `docs/design/extension/grammar.md` §2).
4. **Promotion (the natural next step)**: draft `docs/design/allegretto/structures.md`
   from D1–D40; rebuild `BACKLOG.md`; write the implementation plan with chunks
   per PROCESS §4 (I2's accessor-layer-first sequencing). Include the D40
   migration deltas (`pure subtypeof Effect` flips) and the MI-memo update in
   the promotion sweep.
