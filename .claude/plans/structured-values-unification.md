# Structured-values unification — design discussion

> Status: **draft — active design discussion** (pre-implementation).
> This is the "backlog for the pre-backlog discussion": settled decisions,
> open questions (base language first), and risks. Outcome will be promoted
> to `docs/design/structures.md` (new) + deltas to `type-system.md`,
> `effects.md`, and the rebuilt `BACKLOG.md`.
> Participants: maintainer + Claude, 2026-06.

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
| D6 | `__*` prefixes are retired; meta-slots become declared slots with visibility/access attributes, recorded in a registry (`docs/design/type-system.md` §4). |
| D7 | Internal `Type : Type` self-reference is kept; universe stratification is handled by translation at the proof-export boundary. |
| D8 | Equality is type-customizable, with declared laws; proofs record which equality they discharged under. Reference-equality-by-accident (the `proofValEqual` bug) is disallowed by design. |
| D9 | Arrays: no refs-inside-Bits (Bits stays pure reference-free data). Direction: base numeric-keyed structures with O(1) indexed host implementation + Standard encapsulated collection types choosing representations (packed Bits for primitive elements, dense structure storage otherwise). To ratify (B6/S4). |
| D10 | Functions keep returning annotated values: the return is a structure whose channels are populated per propagation rules. When the result is itself a structure, channels attach directly — no wrapper nesting. |
| D11 | **No operation errors on an incomplete value.** Operations on unresolved values produce residuals ("blocking" always means residual production, never throw). Explicit incompleteness *detection* is a separate introspection surface and is itself effectful (B12). |
| D12 | **Structures are always structurally complete.** Incompleteness is a value: an unresolved future occupying a slot, never a structure state. (Ratifies B3's core; downsides reviewed in B13 — headline: futures become write-once monotonic cells, confluent but interior-mutating.) |
| D13 | **RETIRED** (2026-06). The `seal` op was only ever discussed conceptually; D21 removed it (integrity = capability-gated channel origination + data-immutability, no seal primitive). The original concern — sealing a structure with unresolved future slots — cannot arise: under D21 there is no seal op, and under B14's construction guard immutables never contain unresolved cells. Any residual "freeze a transient" need is folded into the deferred transient→immutable finalization (D22). |
| D14 | **Slot keys are symbol \| string \| number; channel keys are always namespaced symbols.** Symbols gain optional namespaces; type-defined member identifiers become symbols rather than strings. Resolves B1: one slot space, partitioned by key sort — user data (string/number keys) cannot collide with channels. `primary` is a channel symbol, so duck-typed transparency is safe. |
| D15 | **MultiValue wrapper is flattened for structures**: channels attach directly. Scalar primaries (Bits etc.) use a *transparent structure* (empty data plane + `primary` channel) — same construct, not a distinct wrapper kind. |
| D16 | Reading a potentially-unresolvable value is an **effect**, dischargeable by a **resolvability/completion proof** — the first productive proofs×effects interaction (supersedes the orthogonality memo's claim for this case). Program correctness may not depend on unresolvable values. |
| D17 | A structure **cannot** have both data slots and a `primary` channel — transparent values have an empty data plane (closes B2). |
| D18 | Arrays are **numeric-keyed structures** — no separate vector primitive (ratifies D9/B6). |
| D19 | The unified construct is named **Structure** (closes B7). |
| D20 | **Symbols are unique values tied to their registering Scope** — the registering scope IS the namespace. Scopes that register symbols can carry FQNs and/or descriptive names; FQNs are unique and default to the module file path. Symbols are the **existing Symbol value kind, redefined** to meet these needs (not a new kind). Syntax: bare name where unambiguous (`x.type`); `x[type]` requires `type` bound via import (disambiguates across namespaces); namespace-qualified via imported namespace (`x[allegretto.type]` vs `x[algebra.type]`). |
| D21 | **No separate `seal` primitive.** The constructor-authority "brand" decomposes into (a) channel-write authority (B10/D23), (b) data-immutability (D22), and (c) non-fabricating propagation rules for integrity channels. Trust is **global and structural** — there is no per-value brand bit and no provenance tag; the base guarantees no one without the capability could have originated an integrity channel (memory-safety-style systemic guarantee). Channel→owner is static (from registration + D20 FQN) for audit. Verified against forgery scenarios A–F (proposition swap, channel copy, propagation fabrication, capability forgery). |
| D22 | **Structures are immutable by default.** Integrity guarantees (D21) assume data-immutability — born-immutable, so immutability is a property, not a `seal` op. Mutable/transient values (future linear-types work) cannot carry integrity channels without first *finalizing* to immutable (the only seal-shaped operation, deferred with the mutability story). Deep immutability: immutable values reference only immutable values (O(1) construction check via an immutable bit) — trivial under default-immutable, load-bearing once mutability lands and under futures (B13/B14/Risk 6). |
| D23 | **Channel writes are capability-gated; reads are free by default.** Registration is a base op `channel_register(symbol, propagation-rule, read-visibility?) → writer` returning the channel's write operation as a closure (D24); reads go through an unrestricted global `channel_read(symbol, value)`. **Origination** (setting a channel value from nothing) requires the writer; **propagation** (deriving result channels through operations per the registered rule) is automatic, performed by the evaluator, authority-free. **Constraint**: integrity-critical channels may only register **non-fabricating** propagation rules (`drop` or `computed`-with-recheck); `viral`/`union` on an authority channel is a forgery vector (scenario C). Read-visibility is a per-channel attribute (default public; read-gated/secret channels are S3 policy). **Capability shape RESOLVED by D24** (first-class delegable token, realized as a closure). |
| D24 | **Capability shape: first-class delegable token, realized as a PrimitiveFunction closure.** `channel_register` returns the channel's *writer* — a closure over private authority (existing value kind #2, so **no new kind**; satisfies Risk 5). The closure IS the write op; there is no separate `channel_write` primitive. Reads use an unrestricted global `channel_read(symbol, value)`. **Attenuation** = wrap the writer in a re-checking closure (the proof kernel's canonical pattern: stamp `discharged` only after re-running `proof_check`); **delegation** = pass the closure. Chosen over scope-ambient authority because (i) authority is a *value*, hence provable in-language (thesis fit) and trackable in the PE dataflow graph (+ future D3 taint); (ii) it unifies with the D2 effect-capability roadmap (`net[host:port]` budgets are attenuated tokens) — one authority mechanism, not two; (iii) **change-cost asymmetry**: scope-ambient is recoverable as a usage pattern (a module captures its writer privately and never exports it → module-private write), so token→ambient is ~free, while ambient→token would be a base-API + call-site + re-audit break that D2 forces anyway. Obligations (all follow from PrimitiveFunction, but stated as soundness requirements because the PCP serialization boundary is load-bearing): writers are **non-serializable**, **print redacted**, **identity-equal only** (S2). Cross-process trust therefore bottoms out in **re-verification** (PCP hash-match), never transported authority. Two writers always exist in the TCB: the user-facing writer closure (origination) and the trusted evaluator core (rule-governed propagation, D23) — the core is privileged under any scheme. |
| D25 | **Scope** is the evaluation-environment role of today's Context (D1's split): name→value bindings, lexical **parent-chain layering**, the unresolved-binding / forward-chaining substrate, and a scope-held **facts plane** (S9 knowledge applied to names). It shares the slot+channel substrate with Structure but is a **distinct role** with its own operations — resolution-through-parent, forward-chaining, and fact layering are scope behaviours with no meaning on data Structures, and the separation stops an evaluation environment being mistaken for user data (no type-dispatch on `scope.x`). The `Context` kind-name is retired: record-role → Structure (D1/D15), scope-role → Scope. Whether Scope is literally a Structure tagged with a `scope` channel or a thin distinct kind is an I-level call; the design commitment is *shared substrate + distinct protocol*. Kind count does not grow (Context + MultiValue → Structure + Scope; 3 roles → 2). |
| D26 | **Scope op surface + `ctx_*` disposition.** `scope_new(parent?)` (refactor `ctx_new` — explicit parent enables a real chain vs today's O(n) flatten-copy); `scope_extend(scope, name, value) → scope'` (refactor `ctx_bind` — O(1) immutable layer, not a whole-map copy); `scope_lookup(scope, name)` (refactor `ctx_resolve` — walk the chain; bound → value with merged facts; **unresolved → residual, never throw** per D11; a genuinely-absent name is a compile-time lexical-resolution error per D20, not a runtime throw); `scope_bindings(scope)` (keep `ctx_bindings` — introspection / REPL / module export; own slots by default). **RETIRE `ctx_use` and the `Binding.isUse` flag** — an unresolved binding is a slot holding an **unresolved future cell** (D12/B13), so the `isUse` / `value === undefined` duality collapses to one representation; the REPL carry-forward (isUse's only reader) keys off cell-resolved-state. New `scope_assume(scope, name, predicate) → scope'` replaces the in-place `scopePredicates` mutation: the **facts plane is immutable-layered** — branch-then / assert / requires push a *child scope* carrying the fact and discard it on exit (no mutate-and-pop), which is exactly S9's monotonic knowledge attached to occurrences. The evaluator's internal Symbol resolution (already residualises on unresolved + merges scopePredicates) and the reflective `scope_*` primitives now share **one** resolution semantics, not the current two divergent paths (evaluator residualises; `ctx_resolve` throws). |
| D27 | **Minimal base surface (the layering proof).** Allegretto's irreducible base is ~40 primitives in five groups: **Bits** (arithmetic / comparison / bit-ops / encoding — `bits_*`); **Expression** (DAG construct / introspect / eval — `expr_*`); **Structure** (`struct_new`, `struct_get(key)`, `struct_with` CoW-derive, `struct_slots`; transparent/scalar values via the `primary` channel per D15/D17); **Channel plane** (`channel_register(symbol, rule, read_vis?) → writer` per D24, free `channel_read`, evaluator-applied propagation); **Scope** (`scope_new/extend/lookup/bindings/assume` per D26); plus core control (`eval_if`, `seq`, `id`), `Param`/`Symbol`, and immutability (`immutable?`). **Everything else now in `src/primitives.ts` is NOT base**: the entire type system, logical ops, proofs, refinements, effects, contracts, totality, the grammar-tooling primitives, and IO (`print`/`fetch`/`delay`) are Standard-layer extensions or environment-provided capabilities. The unification therefore doesn't just merge value kinds — it **relocates the type system and the whole provability stack out of the base**, which is the layering proof B8 demanded. Validates Risk 5: the base shrinks from well over 100 registered primitives to ~40. |
| D28 | **Subsumption mechanics for the audit.** (a) `mv_*` + `component_get` → channel/slot ops: `mv_primary`/`mv_get`/`component_get` → `channel_read`; `mv_set` → `channel_write` (now capability-checked); `mv_components` → channel enumeration (free). (b) `make_error` → `channel_write` on the **error channel** — a *public-writer* channel (no capability) whose **viral** propagation rule reproduces today's automatic error propagation. (c) The entire **`*_attach` passthrough family** (`effects_attach`, `partial_attach`, `decreases_attach`, `proven_attach`, `param_effects_attach`, and the transparent `seq`/`type_check` forwarding) **collapses into `channel_write`** on the relevant channel (effects / predicates / totality); the matching `*_decl_marker` parse helpers move to the grammar/extension layer. (d) Channels span **gated** (integrity: `discharged` owned by the proof kernel, `type` owned by the type-system extension) and **public** (error, warnings, source) — one mechanism (you need the writer), and policy is whether the owner exports it (D23/D24). **Finding**: the pervasive "registered lazy so it receives un-`primaryOf`'d args" workaround on every proof/typed primitive is a direct symptom of the D3 stripping asymmetry — per-channel propagation (D3/D15) removes the need, so the proof kernel and typed ops drop the lazy hack. |

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
  async cluster split into B11–B14 (dedicated session).
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
  - *Channel narrowing vs immutability*: **RESOLVED via S9** — narrowing is
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
- **B7. Name.** **RESOLVED by D19** — **Structure**. (Scope for the
  evaluation construct still pending under B5.)
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
  | `mv_new/primary/get/set/components`, `component_get` | SUBSUME | `channel_read` / `channel_write` / channel-enum (D28a) |
  | `make_error` | SUBSUME | `channel_write` on the public, viral error channel (D28b) |
  | `eval_when`, `when_wildcard`, `when_struct_destruct`, `when_no_match` | EXTENSION | pattern-matching lib over `eval_if` + struct reads (judgment call — could stay base control) |
  | `when_type_destruct` | EXTENSION | needs the Standard `type` channel |
  | `typed_int/string/float/bool/array/object/function`, `typed_add..gte`, `typed_and/amp/or/not` | EXTENSION | Standard type system (owns the gated `type` channel) |
  | `type_dispatch/of/check/instanceof/subtypeof/apply/function/union/refine`, `structural_wrap`, `type_check_binding` | EXTENSION | Standard type system |
  | `export` | EXTENSION | module system |
  | `assert_invariant`, `assume_invariant`, `assert_stmt`, `requires_stmt`, `ensures_decl/check` | EXTENSION | contracts/invariants lib; checks become predicate-channel writes + `scope_assume` |
  | `*_decl_marker` + `*_attach` (effects / param_effects / partial / decreases / proven) | SUBSUME / EXTENSION | `*_attach` → `channel_write` (D28c); `*_decl_marker` → grammar templates |
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
  scope, not freely constructible into foreign namespaces. Residual design
  work: the redefinition itself — today's Symbol is a compile-time-resolved
  AST reference; the new Symbol is also a runtime unique value. Resolution
  timing (when does a bare `type` in source bind to a registered symbol —
  same lexical-scoping pass?), identity across re-evaluation/sessions,
  serialization/printing of namespaced symbols, and the ambiguity rule for
  bare names (error vs innermost-scope-wins when two imports register the
  same simple name).
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
- **B11. Completion semantics: sync vs async** (new, split from B3). The two
  cases are distinct; nearly all concerns stem from **async**. Headline:
  **deadlock — resolvability/completion must be provable.** Sync completion
  (forward-chaining within a pass) is deterministic; deadlock = dependency
  cycle, statically detectable. Async resolution depends on external events;
  liveness needs declared assumptions (e.g. "fetch eventually resolves or
  errors") as axioms feeding completion proofs. Possibly the most important
  proof use case (D16). Needs the dedicated session.
- **B12. Incompleteness detection** (new, split from B3). Use cases needing
  to *observe* unresolvedness: non-blocking I/O, deadlock detection, effect
  accounting. An `is_resolved`-style op's result depends on scheduling — it
  breaks confluence/determinism, so it must itself be an effect. Enumerate
  the use cases and the minimal detection surface.
- **B13. Future value mechanics** (new, split from B3). Write-once monotonic
  cell (interior mutation, but single-assignment ⇒ confluent — Oz/IVar
  precedent) vs structure-replacement propagation (today's residual model);
  future-of-future flattening ruling; per-slot read overhead (is-it-a-future
  check — PE/shapes can discharge statically when type known); memory
  retention of resolution machinery; equality on futures → residual per D11.
- **B14. Async construction guard for immutables** (new, maintainer
  proposal, lean: adopt). Conservative route: transparent incomplete slots
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
  reservation). Analyze PE shortcuts that recover pipelining on
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

- **S1. Meta-type construction.** Kinds are types-of-types and must be built
  with the same construction as ordinary types (today Effect/Proof are
  hand-rolled copies). Self-reference + inheritance subtleties; may pull on
  multiple inheritance (revisit trigger in `type-system.md` §2). Define a
  "define a kind" recipe as a library operation.
- **S2. Equality framework.** Default equality per category (structural for
  unsealed structures, identity for sealed and for memoized nominal types);
  type-customizable `equals` with declared laws (reflexivity/symmetry/
  transitivity as dischargeable theorems); proof terms carry the equality
  they used; `proof_trans` requires matching equalities. Role of `~`:
  re-purpose as selection of the structural-comparison view?
  **Capability writers** (D24) are **identity-equal only** — never
  structurally compared, never reference-equal-by-accident (D8) — so authority
  cannot be reconstructed by building a structurally-equal value (moot for
  opaque closures, but stated as a framework requirement). |
- **S3. Visibility/access control.** Attribute set (public / internal-to-
  defining-extension / …); requires an ownership notion tied to the module
  system. Enforcement point: dispatch reads slot attributes (Standard);
  sealing (base) backstops integrity.
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
- **S8. Blocking-read effect ergonomics** (new, from D16). The effect fires
  on any read of a potentially-unresolvable value — noisy by default. Shape
  of the discharge: completion proofs remove the effect (like domain
  implication discharges refinement checks); declared liveness axioms for
  external sources (B11); what the undischarged residue looks like in
  introspection/verdicts so it informs without drowning. (If B14 is adopted,
  most of the noise vanishes structurally — reads of immutables never block.)
- **S9. Imputed vs declared type** (new, maintainer note). The `type`
  channel as used so far is the **imputed type** — always the same as or
  narrower than the **declared type** (the shape/class definition), and
  narrowable at each operation in an expression. The declared type must be
  maintained separately because it carries member definitions (dispatch).
  The imputed type overlaps in purpose with the `predicates` channel —
  unify or distinguish, and disambiguate the two names. Claude's lean:
  **declared type = the shape**, fixed at construction, part of value
  identity, lives with the data plane (I1: the type IS the hidden class);
  **imputed type + predicates unify into flow knowledge** — a monotonic
  knowledge lattice (base-type bound + abstract domains + predicate set)
  attached to *occurrences* (derived references / scope-held facts per B4),
  excluded from value identity and equality. Naming candidates: declared →
  `shape` or `class`; imputed+predicates → `knowledge` / `facts` /
  `refinement`.

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
   time) — contained by D12 (incompleteness is a value); residual risk is
   the async cluster (deadlock/unresolvability), addressed by B11 + D16
   (resolvability proofs).
2. **Namespace collision under duck typing** (user `type` field vs type
   channel; accidental `primary` transparency) — RESOLVED by D14 (key-sort
   partition); residual risk is symbol-namespace **forgeability**, owned by
   B9/B10 (ownership + writer capabilities).
3. **Forgery through the base door** — if sealing were Standard-layer policy
   only, Allegretto code could forge Proofs; hence D4's mechanism-in-base.
   **RESOLVED by D21+D23**: integrity = capability-gated channel origination
   + data-immutability + non-fabricating propagation; verified against
   forgery scenarios A–F (B10). Capability shape resolved (D24, delegable
   closure). Residual: capability privacy (ocap, S3 — the owner must not
   export its writer closure).
4. **Custom equality × proofs** — proofs must name their equality (S2), else
   `proof_trans` becomes unsound across equality views.
5. **Base-simplicity erosion** — every addition to Allegretto must pass B8's
   layering proof; the unification must *shrink* the kind count, not grow it.
6. **Interior mutation via futures** (D12/B13) — write-once cells are
   monotonic and confluent (single-assignment dataflow precedent), but they
   are the first crack in pure immutability. **B14's construction guard, if
   adopted, eliminates the crack for immutable values entirely** (immutables
   never contain unresolved cells); the cell discipline then applies only to
   mutable/transient values and the construction-residual machinery.
7. **Unprovable liveness for async sources** — completion proofs for
   external events bottom out in declared axioms (B11); axioms must be
   visible in verdicts (a proof resting on "fetch eventually resolves" is
   weaker than a closed proof and must say so).

## Next steps

1. Ratify the B4+B10 round (D21–D24): brand reduces to B10 (no `seal` op),
   default-immutability, capability-gated channels, capability = delegable
   closure (D24). **Remaining explicit call**: **D13 is now obsolete** — it
   was framed around a `seal` op over possibly-incomplete structures; under
   D21 (no seal op) + B14 (construction guard) the scenario can't arise, so
   D13 should be retired or rewritten as a construction-time warning. Plus the
   still-open S9 knowledge-channel split.
2. Remaining base question in queue: B9-residual (Symbol redefinition
   details — resolution timing, identity across sessions, and whether Scope
   keys become symbols per D20). With B8 resolved (D27/D28) the base surface is
   fully enumerated and the type/proof/effect stack is confirmed
   extension-layer; the **synchronous base design is essentially complete** —
   only the async cluster (B11–B15) and B9-residual remain.
3. Dedicated session: async cluster **B11–B15** (+S8) — deadlock,
   resolvability proofs, liveness axioms, detection effects, construction
   guard ratification, partial-access PE shortcuts soundness.
4. Dedicated session: meta-types + equality (S1, S2) — feeds the
   meta-protocol registry. S9 likely joins this session (identity/equality
   must exclude knowledge channels).
5. Parser design discussion (separate track, `docs/design/grammar.md` §2).
6. Then: finalize BACKLOG rebuild; draft `docs/design/structures.md`;
   implementation plan with chunks per PROCESS §4.
