# Structures, Scopes & Channels — design decisions

> Tier 1 design doc — **draft, pending maintainer sign-off** (promoted from
> the design discussion in `.claude/plans/structured-values-unification.md`,
> which holds the full decision log D1–D40 and rationale; decision numbers
> below cite it). Status tags per `docs/design/README.md`. Everything here
> is **[designed]** unless tagged otherwise — this document describes the
> post-unification model, not current behavior (`CLAUDE.md` describes what
> ships today).

## 1. Overview [designed]

MultiValue (primary + named components) and Context (named bindings) are
both string-keyed slot collections serving three roles: data record,
annotated value, and evaluation environment. The unification replaces them
with two constructs sharing one substrate (D1, D19, D25):

- **Structure** — the data construct: one slot plane plus an extensible
  **channel plane** for annotations (type, error, effects, …).
- **Scope** — the evaluation environment: bindings, lexical parent chain,
  the forward-chaining substrate, and a scope-held facts plane.

Roles shrink 3 → 2; value kinds do not grow (Context + MultiValue →
Structure + Scope; whether Scope is a channel-tagged Structure or a thin
distinct kind is an implementation call — the commitment is *shared
substrate, distinct protocol*).

The deeper consequence (D27): the rewrite relocates the **entire type
system and provability stack out of the base**. Allegretto keeps ~40
primitives; types, proofs, effects, contracts, totality, and grammar
tooling become Standard-layer extensions built on channels. That is the
layering proof the architecture demands — extensions are where the
language lives.

## 2. Structure [designed]

**Slot plane.** Keys are `symbol | string | number` (D14). Channel keys are
always **namespaced symbols**, so user data (string/number keys) cannot
collide with channels — the transparency and duck-typing hazards of the old
`__*` convention disappear by key-sort partition.

**Transparency.** Scalar values (Bits etc.) are structures with an **empty
data plane** and a `primary` channel (D15). A structure can never have both
data slots and a `primary` channel (D17) — transparency is structural, not
a marker. The MultiValue wrapper is gone: channels attach directly, and a
function returning a structure annotates it in place with no nesting
(D10).

**Arrays** are numeric-keyed structures with an O(1) indexed host
implementation (D9, D18). There is no separate vector primitive and no
references inside Bits — Bits stays pure, reference-free data. Collection
types (`Array[T]`, `Map`, `Set`) are Standard-layer encapsulated types
choosing representations (packed Bits for primitive elements; dense
structure storage otherwise) — see §13/S4.

**Immutability.** Structures are **immutable by default** (D22) — born
immutable; there is no `seal` operation (D21; D13 retired). Deep
immutability holds: immutable values reference only immutable values,
checked O(1) via an immutable bit, **with one carve-out** — an unresolved
future cell counts as immutable (single-assignment/monotonic; the cell's
identity is its eventual value), so structures may hold pending futures
without violating the invariant (§10). Transient→immutable finalization is
deferred to the linear-types/mutability track.

**Base ops.** `struct_new`, `struct_get(key)`, `struct_with` (copy-on-write
derive), `struct_slots` (D27).

## 3. The channel plane [designed]

Channels are the annotation mechanism: named planes riding on values, each
with a **declared propagation rule** — `viral`, `union`, `computed`,
`positional`, or `drop` (D2). Per-channel propagation replaces the old
lazy/eager `primaryOf` stripping asymmetry (D3); the `*_attach` wrapper
family and the "register lazy to dodge `primaryOf`" workaround are deleted
wholesale (D28).

**Registration and writing** (D23, D24):

- `channel_register(symbol, rule, read_visibility?) → writer` — a base op
  returning the channel's **write operation as a closure** over private
  authority. There is **no** `channel_write` primitive; the writer IS the
  op.
- `channel_read(symbol, value)` and `channel_list(value)` are free —
  introspection and PCP need unrestricted reads.
- **Origination** (setting a channel from nothing) requires the writer.
  **Propagation** (deriving result channels through operations per the
  registered rule) is automatic, evaluator-performed, authority-free.

**The capability is a PrimitiveFunction closure** (D24): no new value
kind; unforgeable from Allegretto; **attenuation** = wrap the writer in a
re-checking closure (the proof kernel's canonical pattern); **delegation**
= pass it. Writers are non-serializable, print redacted, and identity-equal
only — so cross-process trust bottoms out in **re-verification** (PCP
hash-match), never transported authority. Scope-ambient ("module-private")
authority is recovered as a usage pattern: capture the writer in a private
binding and never export it.

**Integrity model** (D21): trust is global and structural — no per-value
brand bit. A value carrying `discharged: true` is trustworthy because the
system guarantees nobody without the capability could have originated it,
the data under it is immutable, and the channel's propagation rule is
**non-fabricating** (`drop` or `computed`-with-recheck; `viral`/`union` on
an authority channel would be a forgery vector). Verified against forgery
scenarios A–F (see the plan doc's B10 log).

**Standard channels** (registry to be specced under S6): `shape` and
`knowledge` (§6), `error` (public writer, **viral** — reproduces automatic
error propagation; D28), `warnings`, `source` (public), `effects`
(**gated** — a publicly writable effects channel would permit effect-erasure
forgery), `discharged` (kernel-private). Channel-removal/erasure rules
(e.g. error handling consumes the error channel) are S6 items.

## 4. Scope [partial]

*Status (2026-07, C2.1–C2.3): implemented host-side over the current
ContextValue representation — parent-chain layering + chain lookup (C2.1),
facts plane (C2.2), resolution unification with future cells + root
eval-context layering + `ctx_use`/`isUse` retirement + `ctx_resolve`
residualising semantics (C2.3a/b). Still pending: Allegro-surface
`scope_*` primitives and the Scope/Structure representation split (Phase
4); the flat-Context compile ctxs used by analyzers migrate then.*

Scope is the evaluation-environment role split out of Context (D25):
name→value bindings, **lexical parent-chain layering** (today's
flatten-copy is replaced by a real chain), the unresolved-binding /
forward-chaining substrate, and the **facts plane**. Evaluation
environments are not user data: there is no type-dispatch on `scope.x`.

**Ops** (D26): `scope_new(parent?)`, `scope_extend(scope, name, value)`
(O(1) immutable layer), `scope_lookup(scope, name)`,
`scope_bindings(scope)`, `scope_assume(scope, name, fact)`.

**Resolution semantics — one path, residualising.** Bound → value with
merged facts. Unresolved → **residual, never a throw** (D11). A genuinely
absent name is a compile-time lexical-resolution error for source-level
symbols; the reflective runtime op returns an error value. The old split
(evaluator residualises / `ctx_resolve` throws) is unified on the
evaluator's semantics.

**Facts plane.** `scope_assume` layers a fact about a name onto a *child
scope*; branch/assert/requires push a child and discard it on exit — no
in-place mutation (replaces today's mutate-and-pop `scopePredicates`).
Fact payloads are **opaque to the base**: the base stores and layers;
interpreting facts (predicate lattices, implication) is Standard-layer.

**Retired**: `ctx_use` and `Binding.isUse`. An unresolved binding is a slot
holding an unresolved future cell (§10) — one representation for REPL
declarations, forward-chaining, and async futures alike.

## 5. Symbols [designed]

Symbols are the existing value kind **redefined** as first-class runtime
values (D20, D29):

- **Identity = FQN** (defining Scope's fully-qualified name + base name;
  default FQN is the module file path). Same FQN = same symbol (interned).
  Symbols are *registered* in a scope, never constructed into foreign
  namespaces.
- Each symbol carries a **canonical base-name string projection** — used
  for printing, serialization (FQN on the wire, base name when
  unambiguous), and the loose structural-matching path (§8).
- **One governing rule**: the base name is a convenience projection, the
  symbol is identity; wherever a base name is ambiguous, **explicit
  qualification (`x[ns.name]`) is required, else error**. Ambiguity means
  multiple distinct *targets* — a single member multi-bound to several
  symbols (§8) is one target and stays unambiguous. The rule recurs
  identically at import resolution, member binding, and dot access.
- Scope *binding* keys may remain strings; only channels and type members
  must be symbols (D14).

## 6. Shape and knowledge [partial]

*Status (2026-07, C3.1+C3.2): the two channels exist as the canonical
read paths over the current storage — `shape` reads the computed dispatch
shape (member-transparent refinement layers walked off by `typeShape`; a
layer sharing its parent's member set by identity is knowledge, a layer
minting members — preserveOps/mixin/extend — is a shape); `knowledge` is
the unified carrier (`knowledgeOf`: refinement bound + domains +
predicates + occurrence bound, one lattice with `meetKnowledge`).
Dispatch (type_dispatch + the evaluator's operator dispatch) reads shape;
`withType` refuses cross-shape re-stamps post-construction. C3.2:
annotations are occurrence-knowledge upper-bounds — crossing a boundary
(`x: Animal` param, return annotation, binding annotation via
`type_check`) stamps a `bound` component (drop-propagation) when the
declared type is wider than the value's shape and clears it on own-shape
crossings; `type_dispatch` gates member AVAILABILITY on the bound (see the
Availability block below — "visibility" is reserved for S3 access
control) while dispatching available members through the shape (open
types exempt: base Object, fallback-only module types). `when … is T`
type patterns narrow
within the matched arm (scope shadow layer for Symbol subjects;
clone-on-write identity replacement for substituted-param subjects).
Intrinsic knowledge survives looser annotations (the meet never widens).
C3.3: observation semantics implemented — `instanceof` on
member-transparent refinements is a pure predicate re-check (recursive
chain; congruent over shape-and-data-equal values; preserveOps shapes
stay nominal), and `certificate_peek(v, T)` is the separate provenance
op, channel-aware and tagged with the "observe" effect label so the
effect calculus prices knowledge observation. **Phase 3 is complete over
the current representation.** Deferred: operator-dispatch availability
gating (interacts with PRIM_TO_METHOD fallback semantics),
knowledge-gated downcast refusal at call sites (runtime-sound today),
record undeclared-field openness through `__getMember`, generated-corpus
congruence property testing (grows with the D37 equality plan). Still
pending: physical storage under the knowledge channel (C4).*

The old `type` channel conflated two things; they split (D36):

- **`shape`** — the declared type: layout, member set, nominal identity.
  Fixed at construction, immutable, part of value identity. The dispatch
  member source and the hidden class (§12/I1).
- **`knowledge`** — everything established *about* a value: the imputed
  type bound, abstract domains, and predicates, unified into **one
  monotonic lattice**. Excluded from value identity and equality.

Knowledge has **two carriers**, same lattice: **intrinsic** (certified at
construction — `PositiveInt(5)`'s `> 0` — rides the value across scope
boundaries) and **occurrence** (flow-derived facts in the scope facts
plane, §4). Effective knowledge at a use site is the **meet** of the two.

**Dispatch.** Runtime dispatch is **virtual on the actual shape** —
overrides run (Liskov). Knowledge is the **static availability gate** and
PE-resolution enabler: `x.method()` resolves at compile time when knowledge
suffices, else residualises. Type annotations are **knowledge
upper-bounds** — `x: Animal` over a Dog hides Dog's members until narrowed
(`when x is Dog`); crossing an abstraction boundary sets the new
occurrence's starting knowledge.

**Availability** (terminology ratified 2026-07). What C3.2 gates is
AVAILABILITY — an epistemic notion, distinct from S3's access control
("visibility" is reserved for S3): *which members may this occurrence
refer to, given its effective knowledge?* Availability is a **resolution
outcome, not a property**. `a.m` in source is a base-name projection
(§5's governing rule) — the text alone determines neither *which* symbol
`m` is nor whether it is a symbol at all rather than a string data key.
Resolution is a function of (text, knowledge), with four outcomes:

1. **Member symbol** — knowledge names a closed (nominal) type whose
   declared members project exactly one match. Inputs: text + knowledge —
   never shape, never the instance's actual slots.
2. **String key / fallback policy** — knowledge says the value is an OPEN
   structure (Object, module): data-plane access under the structure's
   own policy. Same text, different key sort — decided by knowledge.
3. **Unavailable** — a closed type with no matching declaration (the
   C3.2 refusal). Multiple distinct matches → the §5 qualification error.
4. **Undetermined** — knowledge incomplete → **residual**, never a
   premature error (D11); the determination fires when knowledge lands.

**PE is the sole resolver.** There is no name table, no second checker:
availability IS what partial evaluation does with a member access under
current knowledge. "Compile time" vs "runtime" is not two mechanisms but
*when the inputs land* — phases are PE steps, so the same determination
may fire at precompile, at module load, or mid-execution after a future
resolves. **Confluence invariant** (falsifiable): resolution is confluent
over knowledge arrival — for fixed eventual knowledge, early (static) and
late (residual-then-completed) resolution agree.

**The full pipeline** (D41, one PE act, four stages): **project** (text →
symbol, §5 base-name rules — only the base resolver does name
resolution) → **availability** (knowledge gates reference, this section)
→ **mediate** (the shape's `getMember(symbol, instance, context)` maps
symbol → accessor per the member's declared modifiers; evidence is
possession, D42/D43) → **dispatch** (the accessor runs against the
shape — overrides run). Static inputs fold the whole pipeline away;
non-pure mediation is effectful and surfaces in the effect calculus. The
confluence invariant covers all four stages.

**Observation is effectful; re-checking is pure.** `x instanceof
PositiveInt` means **pure predicate re-check** (recomputes from data —
congruence-safe). Asking whether a value was *constructed* as a
PositiveInt (certificate-peeking) is a separate, **effectful**
introspection op — knowledge-observation would otherwise break congruence
(§7).

## 7. Equality [designed]

Equality **dispatches on shape, never knowledge** (D37) — required for a
globally stable equivalence relation. Consequently refinements are excluded:
`PositiveInt(5) == Int(5)` (same shape, same data; the certificate rides
along; sound because a bare value passed where the refinement is expected
is simply re-checked).

**Resolution:**
1. Same shape → that shape's `equals`.
2. Different shapes → coerce **both** operands to the **least common
   type** via *declared* coercions and run its `equals` — symmetric by
   construction, hence commutative.
3. No common type → **not equal**. A `distinct` type is unequal to
   everything until it declares a coherent coercion.

**Laws** (discharged per §8):
- Reflexivity/symmetry/transitivity of a custom `equals`: per-type
  theorems. The kernel-supplied structural `equals` is proven lawful once,
  parametrically.
- Each declared coercion carries **equality-preservation**
  (`x ==_A y ⟹ coerce(x) ==_B coerce(y)`) and **pairwise coherence**
  (composition triangles commute) obligations — the *new* declaration
  bears the proof; existing types never re-verify (open-world).
- **Monotonicity is structural, not a theorem**: `equals` must be pure and
  knowledge-independent (free of the §6 observation effect), checked
  mechanically at definition — so equality can never vary with refinement,
  and equality proofs cannot rot as knowledge accumulates.

**Value-equality is not Leibniz substitutivity**: equal values may differ
in knowledge; `proof_cong` applies only to knowledge-independent functions
(guaranteed by the effect check). Capability writers are identity-equal
only (§3). Proofs record **which equality and which law tier** they
discharged under — a `proof_trans` chain resting on an *admitted*
transitivity is verdict-visibly weaker than one resting on a proven one
(extends D8).

## 8. Conformance and lawful interfaces [designed]

**Member identity** (D30): type members are symbol-keyed. Types **draw
member symbols from declared contexts** (interfaces, base types, mixins): a
member whose base name matches a drawn context's symbol binds to that
imported symbol; non-matching members get type-local symbols. One member
definition may bind to **multiple symbols** (the diamond: independent
interfaces both declaring `toString`); multiple *distinct* matches error by
default, forcing explicit resolution.

**Conformance is declared, not accidental**: `instanceof`/interface checks
are symbol-identity membership over the type's members. Retroactive
conformance is via mixins / partial type declarations. The **loose
structural path** — `~T` and anonymous `{…}` pattern destructuring —
matches by base-name string projection and is aimed at data values, not
types. (Duck-typing earns its place only where declared conformance is
clumsy — a standing watch item for syntax design.)

**Lawful interfaces** (D38) — the mechanism D8 promised. Interfaces may
carry **law members**: named theorem templates quantified over the
implementing type —

```
Equatable = interface({
  equals: (T, T) => Bool [pure],
  law refl:  for_all (a: T)       => equals(a, a),
  law sym:   for_all (a, b: T)    => equals(a, b) == equals(b, a),
  law trans: for_all (a, b, c: T) => equals(a,b) && equals(b,c) => equals(a,c)
})
```

Binding an implementation instantiates each law into a pending
**Obligation** (PCP H1 schema) at definition time; coercion declarations
generate their §7 obligations the same way. **Discharge follows the
completion-effect spectrum** (D34): kernel-auto (PE / finite-domain
enumeration; parametric generic proofs for kernel-supplied defaults) →
witnessed (`by` proof term) → **sampled-falsification** (a counterexample
halts compilation with concrete inputs; a clean pass is survival, *not*
proof) → admitted (`assume law` / project-level pattern axioms;
verdict-visible) → pending (exported via `allegro obligations` to PCP
workers — law obligations are exactly the well-posed tasks the LLM-prover
loop targets).

**Strict by default**: unproven + unadmitted = pending, and law-dependent
contexts refuse it (`proof_trans` demands the equality's transitivity; a
sort demands `Ordered` totality). **Amortization**: unchanged inherited
implementations inherit their proofs; refinement subtypes are free; only
custom implementations and overrides bear fresh obligations.

Equality is instance #1. The same mechanism gives `Ordered`
(antisymmetry/totality/consistency-with-equals), `Monoid`, `Semiring`
(**distributivity — a cross-operation law lives on the interface declaring
all participating members**), and Functor laws for `map` — discharged laws
license PE rewrites, feeding compilation. Laws require effect-bounded
(`pure`) members for proposition stability.

## 9. Kinds are just types [designed]

**Instance-of = shape-of** (D40): a kind is a type whose instances are
type-values. `io : Effect`, `Int : Type`, `Effect : Type`, and `Type :
Type` is the fixed point (D7 — no `Kind` above `Type`, no universe tower;
stratification is handled by translation at the proof-export boundary).
**Subtype-of (`parent`) is orthogonal** to instance-of.

**Members live once, on the kind.** `io.union(time)` dispatches through
io's shape (Effect) exactly as `42.toString()` dispatches through Int — at
every meta-level, uniformly. The old per-instance member copying
(`buildEffect`) is deleted. Effect bounds in parameter positions are
**knowledge** (§6), never a function value's shape, so no member-merge
pressure exists and the multiple-inheritance revisit trigger is dissolved
(draw-from covers member composition; the MI memo needs updating).

**The define-a-kind recipe** — a Standard-layer, lawful-interface-driven
type definition (no host code), parameterized by:
- **name** and **instance-member declarations** (ordinary member
  declarations on the kind);
- **instance order** — a declared kind parameter: Type's is `subtypeof`,
  Effect's is lattice subset (join/meet, `pure` bottom / `opaque` top),
  Proof's is none. The checker consults *the kind's order* when instances
  appear in bound positions; lattice/order laws attach here via §8;
- **constructor authority** — minting an instance = stamping shape K,
  gated per kind by the ordinary channel capability (§3): Type and Effect
  public; **Proof kernel-private** — proof unforgeability becomes an
  ordinary capability instance, not a special arrangement;
- **operator-minted anonymous instances** — kinds may declare operators
  returning new instances (`io & time` → an anonymous Effect carrying the
  label set, closing the deferred conjunction debt); anonymous-instance
  equality falls out of §7 (same shape → the kind's `equals`);
- **kind-level laws** quantifying over instances, with §8 amortization
  (fixed kind-supplied ops proven once parametrically; new named atoms
  bear no fresh obligations; only overrides do).

**Slot disposition** (D39, completing D6): every `__*` slot becomes a
declared symbol-keyed member on its owning kind — `Type.name`,
`Type.members`, `Type.parent`, `Type.construct`, `Type.fallbackMember`,
`Type.structural`, `Type.invariants`, `Type.wraps`, `Type.variants`;
refinement types get `predicate`/`domain`; GenericType gets
`params`/`args`/back-link (`__isGeneric` deleted — the kind IS the flag);
Proof gets `proposition`/`reason`/`counterexample`/`lhs`/`rhs`; Effect gets
`kind` — **or** a channel (`__type` → shape, `__discharged` → discharged,
`__inferredEffects` → effects, value-side predicate sets → knowledge) —
**or** a base concept (`__length` → numeric-structure slot count;
`__future_N` → real future cells). Host-engine internals stay host-side.
**No new `__*` slot may be introduced**; new meta-slots are declared
members or registered channels from day one. The full disposition table is
in the plan doc (D39); as of C1.1 it is also **code** —
`src/slots.ts` — and mechanically enforced by the boundary harness.

*D39 addendum (maintainer-ratified 2026-07)* — three slots present in code
but absent from D39's original table: **`__effectBound`** → member on the
Effect instance for now; dissolves into the instance's canonical label-set
representation when Effect re-derives through the kind recipe (C6.2), the
annotation-bound reading becoming derived. **`exported`** → scope-binding
visibility metadata (S3), a base concept of the Scope protocol; the current
value-plane marker is a stopgap with a known aliasing wart (`y = x`
silently exports `y`) and dissolves at the Phase 2 scope split / module
rework. **`arity`** → deleted; it was write-only metadata never read
anywhere, and arity is derivable from `Function[ParamTypes, ReturnType]`.

**Validation criterion**: the recipe is done when **Effect and Proof are
re-derived through it with zero hand-rolled residue** (D39's field tables
are the checklist); GenericType and module-types are stretch targets.

## 10. Incompleteness, async, and completion [designed]

**Ground rules** (D11, D12): structures are always structurally complete —
incompleteness is a *value* (an unresolved future occupying a slot), never
a structure state. No operation errors on an incomplete value: "blocking"
always means **residual production**, never a throw.

**Futures** (D33): a future is the sole external locus of incompleteness —
a pending async result at the I/O boundary or an explicit `Future[T]` slot
— represented as a **write-once monotonic cell** (single-assignment ⇒
confluent; Oz/IVar precedent). `Future[Future[T]]` flattens; equality on an
unresolved future is a residual. Forward-chaining (the `FutureManager` /
`applyPhase` cascade) is retained as base evaluator machinery.
**Detection** (`is_resolved`, non-blocking select) is scheduling-dependent
and therefore **an effect** — extension-level, quarantining nondeterminism
from the confluent core.

**Completion = totality ∧ liveness** (D31). Two completion effects:
**blocking-read** (external — reading a value that may never resolve, D16)
and **divergence `div`** (internal — calling a function that may never
return). `div` is a first-class **computed** effect whose inference *is*
the termination analysis; it is discharge-only (no runtime handler).
Discharge is **strict by default** (D34): auto-proven total → witnessed
(`decreases`, kernel-checked) → admitted (`assume terminates`; liveness
axioms for external sources — irreducibly external) → undischarged
(`partial` always means this tier; only an explicit axiom lifts it).
**Project-level axiom patterns** (`fetch <url-pattern>`; "trust
`lib/legacy/` as total") provide blanket defaults for low-assurance
projects; every admitted axiom is **verdict-visible**.

**The triggered construction guard** (D32): fires only when a structure
carries a **value-inspecting invariant**. Without one, partial access is
free — resolved slots read, future slots residual (preserving PE
pipelining). With one, construction is held as a residual until the
referenced fields resolve, so the invariant is checked before the value
exists. Projections of fields untouched by a pending invariant are
admissible but stay **guarded by construction success**. Invariant
predicates must be total (`div`-free) or the guard could hang. The guard is
plausibly **emergent** from D11 + PE Rule 1 (the predicate's read of a
future residualises, so `construct` residualises) — only guarded
projection needs new machinery.

**Resource complexity is not a core effect** (D35): asymptotic bounds are
a deferred proof-genre extension over a cost measure; **resource budgets**
(fuel/space ceilings) are capabilities whose overflow is a catchable
`ResourceExhausted` outcome. Fuel is a `decreases` witness — budgeted code
is total by construction, converting unbounded `div` into bounded,
catchable failure.

## 11. The minimal base surface [designed]

Allegretto's irreducible base is ~40 primitives in five groups (D27):

| Group | Ops |
|---|---|
| Bits | `bits_*` (21: construct/inspect, bit-ops, arithmetic, comparison) |
| Expression | `expr_*` (8: DAG construct/introspect/eval) |
| Structure | `struct_new` / `struct_get` / `struct_with` / `struct_slots` |
| Channels | `channel_register → writer` / `channel_read` / `channel_list` (+ evaluator propagation) |
| Scope | `scope_new` / `scope_extend` / `scope_lookup` / `scope_bindings` / `scope_assume` |

plus core control (`eval_if`, `seq`, `id`), `Param`/`Symbol`, `immutable?`,
and the future-cell/forward-chaining machinery (evaluator-internal, not
primitives).

Everything else in today's `src/primitives.ts` is **not base**: the type
system, logical ops, proofs, refinements, effects, contracts, totality, and
pattern-matching are Standard-layer extensions; grammar tooling is a
library; `print`/`fetch`/`delay` are environment-provided capabilities
(which is why they carry effect labels). The full per-primitive audit
(keep / refactor / subsume / extension / env / delete) is in the plan doc
(B8). Notable subsumptions: `mv_*` → channel ops; `make_error` → the error
channel's public writer; the `*_attach` family → channel-writer
invocations; `ctx_use` deleted.

## 12. Migration [designed]

**Sequencing** (I2): (1) typed accessor layer + slot registry over the
current representation → (2) visibility/enforcement through accessors →
(3) representation swap. Steps 1–2 are valuable standalone; the channel
plane can land as the accessor layer's read/write shim.

**Representation** (I1): instance = (shape ref, flat slot storage, channel
storage, optional dense region); typed structures use the type AS the
shape; untyped structures get transitional inferred shapes. Propagation
rules live on the shape. PE payoff: known type ⇒ known shape ⇒ slot access
compiles to offsets (feeds codegen).

**Conscious behavior deltas** (test-condition changes discussed per
PROCESS §6 before modification, I3):
- `pure subtypeof Effect` (true today via the `__extends` hack) becomes
  **false**; `pure instanceof Effect` is the correct check (D40).
- `MultiValue(MultiValue(...))` nesting tests and `primaryOf` behaviors
  change meaning (D15/D3).
- Proof/typed primitives drop their lazy-registration workaround (D28).
- `buildEffect`'s member copying is deleted (D40); `GenericType` reframes
  as the kind of type constructors.

## 13. Deferred and open [designed]

- **S3 visibility / access control — SETTLED 2026-07 (D41–D43,
  maintainer-ratified).** Member access is a mediated protocol: the
  shape's `getMember(symbol, instance, context)` maps a resolved symbol
  to an accessor, consulting the member declaration's MODIFIERS (D43:
  declared attributes — private/protected/readonly/custom — defined per
  kind at the Standard layer, extensible for one's own kinds only).
  Evidence is POSSESSION (D42): the context is evaluator-supplied and a
  reachability capsule; the default test is symbol reachability
  (private = symbol stays in the defining scope; wire rule —
  deserialized foreign FQNs rebind against exported registries only);
  D24 closures remain the stronger tier for authority-bearing ops.
  Denial is an availability outcome, static when scope + knowledge are
  static. Non-pure mediation is allowed but EFFECTFUL (covered by the
  effect calculus); the expected vast majority of resolvers are pure
  possession checks that PE folds away. Reflection surfaces enumerate
  only reachable symbols; names public by default (proposed).
  Implementation rides C5 (symbols) + C6 (default mediator from
  type_dispatch; modifier vocabulary in the kind recipe).
- **S4 collections** (representation choices, persistent structures),
  **S5 variance/constraints** (`where T: Comparable` — note: constraints
  are knowledge on type-values, per §6/§9), **S6 channel registry**
  (standard set, gated `effects`, channel-removal/erasure rules) —
  mechanical specs, absorbed during promotion/implementation.
- **Transient mutation / linear types** — including transient→immutable
  finalization (the only seal-shaped operation).
- **Static asymptotic complexity** as a proof genre (D35).
- **Productive corecursion** (streams) — `div` is *unproductive*
  non-termination; the boundary is noted for when codata lands.
- **Syntax design track**: kind/interface/mixin surface keywords (one
  member-set-composition semantics underneath, D30/D40); the duck-typing
  ergonomics watch (§8); `use X in { block }` per-scope grammar activation
  (Phase 8).
