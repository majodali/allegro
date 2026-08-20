# Structures, Scopes & Channels — design decisions

> Tier 1 design doc. The full decision log D1–D46 with rationale is
> ARCHIVED at `docs/plans/archive/structured-values-unification.md`
> (complete; every decision executed or pinned to a named owner —
> B-002); decision numbers below cite it, and Appendices A–C carry the
> three load-bearing tables. Status tags per `docs/design/README.md`.
> This document describes the post-unification model; `CLAUDE.md`
> describes what ships today — as of C7.1 the two have converged for
> the substrate.

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

## 2. Structure [partial]

*Status (2026-07, C4.1+C4.2): the KIND exists — every MultiValue and
Context is a Structure instance, and the DENSE REGION is live: array
contexts store elements in a plain JS array as the SOLE storage (no
per-element Bindings, no string keys; count = dense.length); the legacy
bindings view materializes lazily for stragglers (W6 asserts coherence;
slot probes answer dense structures without materializing); element
access via slots.ts `indexGet`/`elementsOf`, O(1) by scaling test.
C4.1 details: every MultiValue and Context
is an instance of one host class (`src/structure.ts`), constructed
exclusively through the `makeMultiValue`/`makeContext` factory shims
(six bypass sites converted; the W4 boundary invariant fails any future
stray literal). One declared hidden class for all structures (measurably
faster than the per-shape literals it replaced); role fixed at
construction; D17 role-transparency (W5) and the D22 immutable bit (with
the scope + future-cell + construction-phase carve-outs) asserted by the
battery. Still pending: physical plane separation + shape ref field
(inside structure.ts, with C4.3's transparency cutover), symbol keys
(C5).*

*D46 (maintainer-ratified 2026-08) — the retirement design and the
definitional ladder.* The MultiValue kind retires by EXECUTING D15
(reaffirmed unchanged): the scalar/function/residual channel carrier is
a TRANSPARENT STRUCTURE — empty data plane + `primary` CHANNEL — the
same construct, not a distinct wrapper kind. The empty data plane is
what keeps a carrier unmistakable for a record with no reserved member
name. The competing design (a channel-plane field on every leaf
representation) was evaluated and rejected: it saves no allocation
(per-occurrence channels force copy-on-write clones of immutable
leaves), smears the channel machinery from one hidden class across six
object shapes, and re-opens function-identity hazards. The "MultiValue
interface" intuition survives as a HOST-LEVEL protocol — a value is
(representation, channel plane); non-Structure representations take the
transparent carrier when channels attach — named here, never reified in
the kind tower (the same reasoning that keeps Scope out of it).

*The definitional ladder* (the C6 vocabulary, recorded): host
REPRESENTATIONS — `Bits`, the two function representations, and
`Structure` as the one composite (the ValueKind taxonomy, BELOW the
type system) → VALUES (representation + channels) → TYPES
(language-level classifiers over representations: Int over Bits,
`Function[P,R]` over functions, record types over Structures) → KINDS
(types whose instances are type-values). `Scope` sits on a parallel
plane (D25): shared substrate, own protocol, barred from dispatch and
typing — neither type nor kind. None of Bits / Function / Structure /
Scope is a Kind, and that is correct: which representation a value has
is a host fact; which TYPE it has is a language fact on the channel
plane.

*`v.kind` is demoted to a host discriminant.* At the language level it
does not exist — no primitive exposes it; `type of`, when/is patterns,
data access, and channel reads answer every observable question — and
the language-level taxonomy is DATA vs COMPUTATION FORMS (Expression /
Symbol / Param). At the host level the discriminant is irreducible (the
evaluator must tell computation forms from self-evaluating data; the TS
union narrows on it), but it is an implementation detail, not spec. The
"seven value kinds" framing retires with chunk C7.1.

*Status (2026-08, C7.1 — EXECUTED): the MultiValue kind is retired. The
carrier is the D15 transparent structure (empty data plane + primary),
answering the one structure kind, discriminated host-side by primary
presence (`isCarrier` — the D46 host-level protocol). `ValueKind` is
now: four leaf representations + `Structure` + the three computation
forms; `ValueKind.Context` renamed `ValueKind.Structure` (D25's name
retirement completed; `ContextValue` is a transitional alias of
`StructureValue`). `makeMultiValue` remains the one channel-attachment
chokepoint with three shapes: record data derives (C4.3b), carrier data
re-wraps its inner primary (W1: carriers never nest), leaf data takes
the carrier. W1/W5 restated: carriers never nest and their data plane
is EMPTY (the lazily-materialized bindings view may exist but holds no
slots). The `NominalType` alias is retired with it (nothing nominal
left to name). Audit notes for the record: four pre-existing duplicate
`case Context` clauses silently shadowed new carrier cases (JS permits
duplicate switch cases — caught by the suite, not tsc), and three
stealth string-literal kind comparisons (`v.kind === "MultiValue"`)
hid from the compiler-driven audit in tree-builder/runtime — the
class of hazard the kind-demotion doc note now warns about. The
original thesis — MultiValue and Context collapse into Structure +
Scope — is COMPLETE.*


*C4.3 rulings (2026-08, maintainer-ratified — recorded in the
implementation plan §6): merge policies activate at C4.3a — error
virality survives residual chains (the first-hop-only loss was a bug),
an error-carrying `if` condition propagates the error rather than
silently taking the else branch, and union-rule channels (effects) merge
by union on MultiValue re-evaluation instead of inner-shadows-outer.
`primaryOf` strip retirement and the non-nesting reframe land at C4.3c
as planned. The host `ValueKind.MultiValue` tag stays through C4.3 but
is not expected to survive beyond C6 — retirement is an expected outcome
of the C6 kind-recipe work.*

*C4.3b status (2026-08): MV-over-Context is UNCONSTRUCTIBLE — a Context
primary handed to `makeMultiValue` flattens into a copy-on-write derive
(`deriveWithChannels`: new Structure sharing the source's data planes by
reference, the given channel map authoritative — deletion stays
expressible). Typed records, arrays, module objects, and proof contexts
answer `ValueKind.Context` with channels riding directly; `dataOf` is
identity for them. User-visible type bindings ARE the internal type
Contexts (the `wrapType` MV wrap is gone — one object, so identity
short-circuits hold); `getType` is total (bare type Contexts answer
their meta-type through the `__type` binding-plane fallback). The
channel plane is universal: `channelReadRaw` / `componentsView` /
`cloneComponents` / `channelList` answer any Structure; ~20 MV kind
guards widened (dispatch, viral scans, formatValue, `type of`,
exhaustiveness, export detection, boundary bounds). W-invariants
reframed per R5: data planes role-exclusive, channel plane universal;
W1 extended (MV primary can never be a Context); W3 covers Context-role
component keys. Scalars (Bits primaries) remain MultiValues until
C4.3c.*

*C4.3c status (2026-08): TRANSPARENCY AT THE EAGER BOUNDARY (R4) —
`applyPrimitive` no longer strips args for eager primitives; every impl
receives full values (channels intact) and reads data through the
accessors (`dataOf`/`asBits`/`asCtx` — the C1.2/C1.3 migration made
this a zero-change flip). The C1.5 `channelAware` registration mode is
DELETED (it is now everyone's default) and the D3 lazy/eager
arg-asymmetry is gone: `lazy` is purely an evaluation-control choice
(receive arg ASTs + evalFn). `primaryOf` is RETIRED as a name — `dataOf`
is the one data-plane accessor, defined in types.ts and re-exported
through slots.ts. The propagation table alone governs channels (D28).
A typed scalar remains a `ValueKind.MultiValue`-tagged Structure (per
ruling R6 the tag now simply means "transparent scalar structure";
retirement expected with the C6 kind recipe). The physical plane
separation inside structure.ts (primary as a true channel-map entry,
shape ref field) remains an internal-layout follow-on — observable
semantics are already transparent.*

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
error propagation; D28), `warnings`, `source` (§3.1, D47 — the earlier
"(public)" sketch is superseded there), `effects`
(**gated** — a publicly writable effects channel would permit effect-erasure
forgery), `discharged` (kernel-private). Channel-removal/erasure rules
(e.g. error handling consumes the error channel) are S6 items.

### 3.1 The source channel — ASTs as channel payload [D47 RATIFIED 2026-08; chunk 1 landed]

*Maintainer direction 2026-08: meta-functions (proofs first) should
receive the AST of an operand through a channel on the value, not
through dedicated grammar productions or lazy registration. Ratified
as proposed ("exactly how I saw this feature playing out"); B-094
chunk 1 (substrate) landed 2026-08 — see the status stamp at the end
of this subsection.*

**Motivation.** Today exactly two mechanisms give a function access to
the expression that produced its argument: a dedicated grammar
production that captures the AST at parse time (`theorem`/`verify`
statement forms), and lazy primitive registration (the primitive
receives unevaluated args and evaluates them itself — `proof_check`,
the proof combinators). Both couple "I want the AST" to special forms:
user-level meta-functions — tactics, domain-specific proof surfaces,
DSL error renderers, symbolic reasoning — cannot get AST access
without host TypeScript or a grammar extension. The source channel
generalizes the capability: the AST rides on the value; an ordinary
eager function reads it.

**D47 (proposed) — the mechanism, six sub-decisions:**

- **(a) Payload.** The channel holds the unevaluated **Expression
  value itself** (the immutable DAG node the evaluator had in hand),
  plus its source span. Source *text* is a rendering derived from the
  node + span — not a second payload. Expressions already occupy value
  positions (residuals), so no new value kind and no quoting form:
  attachment is an O(1) reference capture.

- **(b) Attachment is demand-driven, declared by the consumer.**
  Universal attachment is rejected: it would carrier-wrap (D15) every
  scalar on every hot path. Instead a primitive/function registers as
  **source-aware** (the data-plane analogue of lazy registration); at
  call sites of a source-aware function the evaluator attaches each
  argument's originating AST to the evaluated argument value. Cost is
  zero everywhere except meta-function call sites. A near-free
  complement (follow-on): binding-level attachment — the RHS AST of a
  top-level binding is already retained by the runtime and can ride
  the binding's value for introspection/verdict use.

- **(c) Propagation rule: `drop`** (D2 vocabulary). A value derived
  from a source-carrying value (`x + 1`) is NOT produced by the
  recorded expression; propagating source would fabricate provenance.
  The channel means "the expression this value evaluated from, at this
  attachment boundary" — nothing more. Drop is also the cheap rule.

- **(d) Writer: kernel-private origination; reads free.** This
  supersedes the "(public)" sketch in the §3 registry, and it is the
  soundness-relevant call: the proof surface consumes source for
  *what claim is being stated* (proposition rendering, equality-shape
  detection). With a public writer, a doctored source channel could
  make the verdict display a different proposition than the one
  checked — a display/claim divergence, which is exactly a forgery
  vector under the D21 integrity model (`viral`/`union`/public
  origination on an authority-adjacent channel). User metaprogramming
  does not need to forge provenance: constructing an Expression value
  and passing it is already ordinary data flow. Reads stay free
  (D23).

- **(e) Observation is effectful.** Reading `source of x`
  distinguishes `4`-computed-as-`2+2` from `4`-written-as-`4` —
  extensionally equal values become distinguishable, the same
  referential-transparency breach as `certificate_peek` (C3.3). Same
  treatment, uniformly: source reads carry the `observe` effect
  label; `effects pure` code cannot read source. Structural equality
  ignores the channel (E1: equality reads data planes; the
  equality-ignores-knowledge battery extends to source). Theorem/
  verify statements sit at module top level, so no existing
  `effects pure` function body is affected by the kernel's own reads.

- **(f) Surface.** `source of x` — the existing `Y of x`
  component-access form; no new syntax. Absent channel → `none`,
  consistent with `error of`.

**What migrates — AMENDED at chunk 2 (2026-08).** The prediction that
`proof_check`/`proof_by_eval` would go eager+source-aware was wrong,
for a reason worth recording. The proof combinators had ALREADY
migrated to plain eager at C4.3c (the lazy-for-components workaround
died with the eager-boundary flip). The two remaining lazy proof
primitives are lazy for a DIFFERENT, load-bearing property: they are
**non-value interpreters** — a proposition that evaluates to a
residual or an error must become a FAILED PROOF ("could not be
discharged by evaluation"), and the eager path's Rule-1 residual
guard and error-virality would intercept before the impl runs,
silently weakening failure into an unresolved binding or a viral
error ("build safety in" broken). Lazy registration is today the only
guard-opt-out surface, and for these two that IS genuine control-flow
laziness: they give meaning to non-values. So the workaround class
D47 targets — lazy-for-AST-access — is empty in the kernel, and
D47's payoff is prospective: NEW meta-functions (domain-DSL error
surfaces, tactics, renderers) get AST access as ordinary eager
source-aware registrations. The reference consumer is `explain`
(chunk 2): `explain(x * 3)` → `"x * 3 = 12"` — one registration
line, no grammar production, no laziness, observe-tagged. Non-goals
unchanged: `requires`/`ensures`/`assert`/`proven` keep their
body-forms (hoisting, not AST access); PE residual semantics
unchanged.

**Open at ratification:** whether binding-level attachment (the (b)
complement) lands in chunk 1 or follows; whether `source of` on an
absent channel should instead attach lazily at statement level
(rejected tentatively — post-hoc attachment is impossible once the
evaluator has moved on, and magic-on-read violates (b)'s cost
model).

**Chunk 1 status (landed 2026-08, B-094).** Substrate complete:
`sourceAware` registration on PrimitiveFunction; evaluator attaches
each arg's originating AST at source-aware call sites (eager path);
binding-level attachment included (the (b) complement — resolved
top-level bindings carry their RHS AST); registry rule flipped to
`drop`; `source` added to the integrity-channel set (mv_set refusal);
`source of x` lowers to the observe-tagged `source_get`, and the
generic `component_get` answers none for the key so the effect cannot
be laundered. Three chunk-1 rulings recorded:

- **Reads render TEXT** (via a new canonical `renderExprSource`
  renderer — infix-aware, lexically faithful): a raw Expression
  returned as a user value reads as an unresolved residual to the
  completion machinery (print defers on it, forward chaining may
  re-evaluate it). A first-class inert AST value needs a QUOTE
  carrier — deferred until user-level meta-functions land; kernel
  meta-functions (chunk 2) read the AST host-side via `sourceOf`.
- **Binding-level attachment covers non-Structure data only**:
  Structures (types, records, proofs) carry channels directly and
  are identity-sensitive (memoized generics, law registries keyed by
  identity) — wrapping them at the binding boundary needs an identity
  audit, deferred to the chunk-2+ pass.
- **Residual bindings are skipped**: forward chaining REPLACES
  residuals on completion, so anything attached to them would drop;
  attachment on completion-replacement is a follow-on.

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

## 5. Symbols [partial]

*Status (2026-08, C5.1): the identity substrate is live in
`src/symbols.ts` — FQN interning (`registerScopeSymbol`; same FQN is the
same object across re-evaluation, module reload, and loader instances),
the D42 export partition (registration and exporting are separate acts on
separate maps; `symbolFromWire` answers ONLY from the exported registry —
a private or unknown FQN resolves to nothing and mints nothing),
serialization (`symbolToWire` = the FQN; transient parser-minted symbols
have no wire identity), and the §5 governing rule as ONE resolver
(`projectBaseName`: distinct-target counting with multi-bind dedupe,
explicit-qualification narrowing, identical behavior asserted across the
three surface framings by the battery). `evalSource` registers every
top-level binding under its defining scope's FQN (module file path via
ModuleLoader, `<main>` otherwise); `SymbolValue` gained the optional
`fqn` field. Parser-minted Symbols remain transient references resolved
by base name against lexical scope (§5 allows string binding keys).
Pending at C5.2: symbol-keyed type members, resolver adoption at member
binding + dot access, draw-from/multi-bind.*

*C5.2 rulings (2026-08, maintainer-ratified — recorded in the
implementation plan §6): R1 — typeShape's member-transparency test stays
member-set OBJECT IDENTITY (the sharing invariant is preserved across
the re-keying; the two implicit sharers become explicit). R2 — only
`__members`/`__extends` dissolve here; descriptor internals and the
remaining D39 table wait for C6; instance field storage stays
string-keyed and pattern matching stays on the loose base-name path by
design. R3 — sub-chunk order a→b→c with the declared-conformance flip
LAST (draw-from must exist first); the flip's test/doc migration is
pre-approved; `~T` is the duck-typing path for core types until partial
type declarations. R4 — the `x[ns.name]` qualification syntax is
DEFERRED (collides with bracket indexing); ambiguity is a detected
error. R5 — kernel member names register under one kernel scope FQN.
R6 — unions stay outside member storage and re-derive at C6.*

*C5.2a status (2026-08): member storage is SYMBOL-KEYED — member sets
store descriptors under the member symbol's FQN string (interning makes
string-key identity symbol identity; the host map stays
Map<string, Binding>). Every member registers in the kernel scope
(`<kernel>`), so each base name projects to exactly one symbol and the
re-keying is observable-zero by construction. One write chokepoint
(`addMember`) covers every origination site; copy loops carry FQN keys
verbatim; the name-based filters/lookups (meta-method exclusion, mixin
conflict check, preserveOps op lift, formatValue's instance reads)
project through `fqnBaseName`/`kernelMemberFqn`. typeShape's sharing
invariant is intact and the two former implicit sharers
(invariant layers, structuralWrap) now share the parent's member-set
object EXPLICITLY (ruling R1). Pre-fix landed: makeTypedBinOp
dispatches through typeShape, matching the evaluator.*

*C5.2b status (2026-08): DRAW-FROM BINDING is live (D30). Member
declarations resolve their symbol at construction via `drawMemberKey`:
a base name matching exactly one drawn (parent/base) member BINDS that
symbol — override/implement keeps member identity (Dog re-declaring
Animal's `name` stores under Animal's key; a preserveOps lift stores
under the parent op's key); zero matches mint a TYPE-LOCAL symbol in
the type's own member scope (`<type:N>`, per-construction — the name
arrives after construction via auto-naming, so scopes are
counter-keyed; name-stable scopes integrate later); several distinct
targets error (§5 — a descriptor multi-bound to several symbols dedupes
to one target and stays legal). Lookup chokepoints
(`typeMethod`/`typeMemberDescriptor`) generalize: kernel fast path,
then base-name projection scan with distinct-target ambiguity errors at
the access surface. `structuralSubtypeof` compares by EXPLICIT
base-name projection (behavior-preserving; C5.2c splits declared
conformance off to symbol identity, leaving this as the loose path).
Mixin's conflict check is projection-based; preserveOps' unfiltered
copy wart is fixed (meta-methods no longer ride into instance member
sets).*

*C5.2c status (2026-08): THE CONFORMANCE SPLIT IS LIVE (D30 — the
ratified conscious delta, migration pre-approved at the C5.2 briefing).
An interface check is DECLARED conformance: symbol-identity membership
(every member symbol the interface declares must BE a member symbol of
the actual type) — a type conforms by drawing the interface's symbols
(extending it binds them), never by accident. The LOOSE path (`~T`
structural wraps, anonymous inline types) matches by base-name
projection — the duck-typing surface; `structuralWrap` now erases the
`__interface` marker along with the name, so `~Interface` projects into
the loose world. Migrated per the pre-approval: `interfaces.alg` and
`typed-types.alg` document the flip (`42 instanceof Printable` → false;
declared conformance via `Type.define(..., HasXY)`; `~Printable` duck-typing);
CLAUDE.md examples updated. §8's declared-vs-loose boundary contract is
asserted by the battery (same-named member from an undeclared context
does NOT satisfy the interface; `~T` still matches it). Phase 5 C5.2 is
COMPLETE; the residue per ruling R3: retroactive conformance of
built-in types to user interfaces waits for partial type declarations —
`~T` is the duck-typing path until then.*

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

## 7. Equality [landed — E1–E4 complete (B-027); follow-ons B-089]

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

*E1 implementation notes (2026-08): steps 1+3 live at one chokepoint
(`protocolEquals`, `src/types-std.ts`), shared by the evaluator's
`bits_eq`/`bits_neq` dispatch and the `typed_eq` path; the E2 coercion
lookup slots between them. The equality shape (`equalityShape`,
`src/slots.ts`) walks the FULL `__refines` chain — past preserve-lifted
layers too, unlike dispatch's `typeShape` — so operator-lifting
refinements never separate equal values; `distinct` mints no refines
edge and so falls to step 3. Kernel structural equals is the same-shape
default when no custom `eq` member exists: dense elements + non-meta
fields, recursing through the protocol. Type values (member-set or
construct-authority holders) are identity-only — minted once/memoized,
identity IS their equality. `!=` is the derived negation. Untyped
source functions still fall to base `bits_eq` (no type channel) — a
known limit, revisit with E3's `Equatable`.*

*E2 implementation notes (2026-08): step 2 lands in the seam — a
declared-coercion registry keyed by equality-shape identity, BFS
reachability with composed edge paths (first-found shortest wins;
coherence is what makes path choice semantically irrelevant), least =
the common candidate from which every other is reachable; no unique
least → error demanding an explicit declaration. Surface:
`Coercion.declare(From, To, fn)` (the standalone form — pairs stay
first-class, define specs stay closed). The kernel Int→Float edge
ships with both obligations discharged at tier "kernel"
(`1 == 1.0` true); user declarations instantiate
preservation+coherence PENDING (`coercionObligationRecords()`; PCP
routing arrives with E3). Same-shape containers coerce their
components through the protocol recursion; differently-parameterized
generic concretes are distinct shapes with no edge (element coercion
only under a common container shape).*

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

## 8. Conformance and lawful interfaces [landed — law members + tiers (E3), admitted tier + first strict gate (E4); follow-ons B-089]

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

*The loose path's long-term charter (maintainer discussion, 2026-08):
declared conformance is for ABSTRACTIONS (semantics, laws, provability);
structural matching is for DATA — the same axis as reference equality vs
deep equality. The loose path earns permanent residence exactly where no
authority could have declared anything: (1) data at boundaries — ingested
JSON, parse trees, config records, wire payloads, values that arrive
without declarations; (2) pattern matching and anonymous annotations —
`is {x, y}` and `f(p: {x: Int})` are shape DESCRIPTIONS, not abstraction
references; (3) the marked escape hatch (`~T`) that makes the strict
default liveable — bridging independently-declared lookalike interfaces,
using members of types that predate an interface; every occurrence is
greppable and means either "promote me to a declaration" or "genuinely
boundary data"; (4) the negotiation gradient — the project's thesis has
humans and agents sketching shapes before codifying abstractions, and
the loose path is the rung between untyped and declared. It is never the
tool for law-bearing abstractions, proof obligations, or access control.
Expectation: its share of ABSTRACTION checks trends toward zero as
declaration surfaces mature; its data half is permanent.*

*D44 (maintainer-ratified 2026-08): declared
INHERITANCE dissolves — symbol-identity conformance is exactly as
declared as a subtype edge, so the `__extends` chain between concrete
types is redundant. The remaining relations: conformance (this
section), refinement (§6 knowledge layers — the base link narrows to
refinement structure, renamed `Type.refines` (ratified)), composition
(member-bundle inclusion — the one construction operation), and
instance-of = shape-of (§9). Transitivity holds by member-set inclusion;
diamonds dedupe by symbol identity or error explicitly; widening is a
knowledge bound, not a representation change. Migration is decisive (no
`extend` sugar). Full case analysis + call-site audit in the decision
log D44.*

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

*Generality (maintainer Q&A at B-027 ratification, 2026-08): "lawful
interfaces" names the flagship home, not a restriction. A law is an
ordinary member descriptor in a member SET, so every member-set-minting
surface can carry laws — interfaces, concrete `Type.define` types
(laws about their own members), methods-only bundles/mixins (laws drawn
along with the methods they constrain), refinement specs. Laws attach
to scopes rather than to individual members because a law may reference
several members (distributivity above); the referenced members need not
be abstract — kernel-supplied defaults carry their parametric
certificates — but must be pure.*

*E3 implementation notes (2026-08): the surface is `law_`-prefixed spec
keys + `for_all(fn)` (an eager primitive, host-side marker — no new
slot, no new statement grammar; the §8 sketch's `law refl:` statement
form remains available as later sugar). Law descriptors are ordinary
members (`LawType`) drawn like any other; refinement-spec laws
instantiate against the refined type WITHOUT descriptor storage (the
shared member set IS shape transparency — laws live at the obligation
layer there). Discharge tiers at instantiation: kernel (parametric
certificate + kernel-supplied equality resolution), enumerated (Bool
domain), sampled (interval/Int domains — survival recorded as its own
status, never "discharged"; counterexamples halt with concrete
inputs), witnessed (`Law.witness`/`Coercion.witness` + discharged
Proof; quantified-proposition matching deferred to E4/H), pending
(H2 export). `Equatable` is instance #1 — its law propositions run
through the `protocolEquals` chokepoint; kernel scalars draw it
retroactively (eq multi-bound under Equatable's symbol, obligations
kernel-tier). The E-R5 gate is live (empty inferred effect set incl.
`observe`, definition-time error). Verdict carries law + coercion
obligations scoped to the compilation unit.*

*E4 implementation notes (2026-08 — arc complete): the admitted tier
is `Law.assume(T, "name")` / `Coercion.assume(From, To, obligation)`
(statement sugar deferred) — flips pending/sampled to admitted, or
registers an admitted entry for a never-instantiated law; proven beats
admitted; rendered loudly in the Verdict, excluded from the
pendingOnly obligations export. The first strict gate is live:
`proof_trans` refuses a custom equality whose `trans` law is neither
proven, sampled, nor admitted (kernel equalities auto-prove through
the parametric certificate — existing programs stay green); the
refusal names both escape hatches. E-R6 executed: equality proofs
carry `equality`/`lawName`/`lawTier` as declared Proof fields;
`proof_check`'s relabel preserves them; a theorem resting on
admitted/sampled backing renders verdict-visibly weaker. Follow-ons
(Ordered/Monoid/Semiring, quantified-proposition matching for the
witnessed tier, further gates) live on BACKLOG B-089.*

## 9. Kinds are just types [designed]

*D45 (maintainer-ratified 2026-08) extends this section — one
construction surface, uniform at every meta-level: `define` IS the kind
recipe's instance construction for Type (no separate `define_kind`; one
implementation reading policy from the kind it is called on). Interface
and Refinement become KINDS, related to Type by D44's own relations —
Interface = a refinement of Type (restriction: declaration-only, no
constructor authority), Refinement = a sub-kind of Type (extension:
draws Type's kind-members, adds `refines` + `constraints`). Instance-of
sharpens to SHAPE CONFORMS TO KIND (not shape identity) — required for
the tower: the ratified "half-lotus" matrix is `Type : Type`,
`Refinement : Type`, `Interface : Refinement : Type`, and `Refinement :
Interface` is FALSE (Refinement holds constructor authority); the
matrix is a C6.1b battery test. Constructor model: `construct` is the
standardized per-kind minting-authority member (D39's `Type.construct`;
the R2 capability); call-as-function invokes it at every level
(`Int(42)`, `Effect("net")`, `Type({…})`); named constructors are
static factories — own-members of the type value with NO independent
minting power, delegating to `construct`; `Type.define` is Type's
canonical named factory. Every `construct` bottoms out in `struct_new`
plus the GATED shape stamp — the stamp is the mint, and Proof
unforgeability becomes an ordinary capability instance (C6.3). The
fluent API (`extend`/`interface`/`where`/`invariant`/`mixin`/
`preserveOps`) is removed decisively in favor of `define` +
kind-specific specs; the `&` operator survives as the R3 operator mint
(`Int & _ > 0` mints an anonymous Refinement exactly as `io & time`
mints an anonymous Effect — one conjunction story); `distinct`'s
sub-kind spec is a C6.1b design item.*

*Status (2026-08, C6.1a): the D44/D45 implementation slice landed.
Conformance is ONE check (`shapeAwareSubtypeof`): identity → loose path
(anonymous expected) → `__refines` chain → symbol-identity membership;
the nominal name-walk (`nominalSubtypeof`) is deleted. Built-ins declare
members in name-stable per-type scopes (`<type#Int>::add`); bound user
types stabilize their counter scope onto the declaration site
(`<type#<main>::Point>`) at auto-naming, so fixpoint re-evaluation
converges. The physical edge renamed `__extends` → `__refines` and its
writers narrowed to refinement layers only — composition
(`Type.define`), records, and interfaces mint NO is-a edge.
`Type.define(spec, ...bundles)` replaced `extend` as the record
construction surface (self = the kind; bundles = drawn member sets;
non-kind dispatch errors with the migration form; multi-bundle
interface diamonds resolve via draw-from, concrete-bundle conflicts
error explicitly). Guards preserve pre-C6.2/C6.3 semantics: effect
types keep chain-only subtyping until Effect is re-derived, and
predicate-carrying shapes keep C3.3's construction-through-chain
`instanceof`.*

*Status (2026-08, C6.1b): the kind tower lands. Refinement is minted as
a sub-kind of Type (draws Type's kind-members verbatim + declares
`refines`/`constraints`); Interface is minted THROUGH the refinement
mint itself (member-transparent over Type, restricted by the
declaration-only predicate). `buildRefinedType` stamps `__type =
Refinement`, `buildInterfaceType` stamps `__type = Interface`; the
half-lotus matrix is a boundary battery and every cell answers as
ratified — `Refinement : Interface` is FALSE precisely because the C3.3
predicate re-check sees Refinement's constructor authority. Constructor
authority is uniform: `construct` is the per-kind minting member,
call-as-function invokes it at every level (`Type({v: Int})`,
`Refinement(Int, p => p > 0)`), and `define` is a pure named factory
delegating to it. The fluent API is REMOVED: `where`/`invariant` are
the `&` mint (chained `&` = per-clause layers; record predicates reach
fields via `_`); `interface` is `Interface.define(spec, ...bundles)`;
`mixin` is method-valued `define` spec entries (same-name = override
binding the drawn symbol) plus methods-only BUNDLE types drawn like any
bundle; `preserveOps` is the Refinement spec's `preserve` option
(`Refinement.define({refines, where, preserve: [...]|"all",
...methods})`). The `&` operator IS `Refinement.construct`'s operator
form — one conjunction story (Effect's `&` unifies through the same
mint when C6.2 re-derives it). Both in-chunk spec decisions
maintainer-ratified (2026-08): (1) override-on-draw supersedes mixin's
refuse-same-name, WITH the order ruling — bundle order in a define call
is NOT significant. A spec declaration binds ALL keys of a multi-bound
drawn target (no order-dependent pick); two bundles providing different
descriptors for one symbol is a define-time explicit-conflict error in
either order, resolved by declaring the member in the spec (the spec
declaration owns its keys). (2) the Refinement spec's reserved keys are
`refines`/`where`/`preserve`, all other entries method implementations.
Kind-hood ruling: there is NO reified `Kind` (D7 — no universe above
Type) and it is not left as convention either — a kind is exactly a
type holding Type's kind-member symbols (Type by identity, Refinement
by drawing, Interface by transparency; the meta filter keeps ordinary
types from acquiring them), so `K subtypeof Type` IS the kind test,
answerable from Allegro; `isKind` in the implementation is that
conformance predicate.
`distinct` and `constructor` remain as Type members pending their own
kind-spec designs — `distinct`'s sketch: a Distinct kind whose
instances share the base's member set with fresh identity
(`UserId = Distinct.define({base: Int})`); deferred until a consumer
demands it (C6.2's Effect re-derivation may inform the spec).
`__invariantsList` has no remaining writer; its slot-registry entry is
swept in C6.3's disposition pass.*

*Status (2026-08, C6.2): Effect re-derived through the recipe (D40) —
the first external validation of the kind tower, joining it BY
CONSTRUCTION (draws Type's kind-members → `Effect subtypeof Type` →
isKind, no whitelist). Instances stamp `__type = Effect` and ARE their
label sets (`pure` = {}, `Effect("io")` = {io}, `opaque` = top/null),
memoized so label-set identity is physical identity (D37 equality by
identity; `Effect("io") === Effect("io")`; the two operand orders of a
conjunction are one Context). Members live once on the kind (§6 delta
7): `io.union(time)` dispatches through shape; buildEffect's
per-instance member copying and the `__refines = Effect` chain hack are
deleted, and the D39 checklist advances — the `__effect_kind` slot is
retired (→ the `kind` data field declared on Effect) and
`__effectBound` becomes derived-at-mint from the label set. The R3
operator mint closes the anonymous-conjunction debt: `io & time` mints
an anonymous instance carrying the union set (typed_amp's opaque
coercion gone). §6 deltas ruled and landed: `pure subtypeof Effect` is
FALSE (instances do not CONFORM to their kind; `instanceof` is the
relation) and `pure subtypeof opaque` stays false (instances of an
order-carrying kind relate by the KIND'S ORDER — label-set inclusion
via `subset_of`/`implies` — never by conformance; the C6.1a effect-kind
guard is re-derived on that principle). Lattice ops are label-set ops:
subset = inclusion, union/intersect = set join/meet with pure/opaque as
bottom/top. formatValue renders type values (values whose meta is a
kind) by name. The D39 Effect rows remaining for C6.3's sweep:
`__effectvar:` markers / `__effectVarParams` (→ declared generic-param
structure on function types).*

*Status (2026-08, C6.3): Proof re-derived; Phase 6's validation
criterion met — Effect AND Proof rebuilt through the recipe with zero
hand-rolled residue in their kind structure. Proof draws Type's
kind-members (a kind by construction) and declares its instances'
fields per the executed D39 table: `proposition` / `reason` /
`counterexample` / `lhs` / `rhs` are PLAIN instance-data bindings
(typed Strings where textual) declared as Field members — `t.proposition`
dispatches; the five `__*` proof rows are gone from the registry.
Constructor authority is KERNEL-PRIVATE (D40 R2): Proof holds NO
`construct` — `Proof.define` refuses ("no constructor authority"),
call-as-function residualises inertly (ordinary PE; the result carries
no shape stamp and no discharged channel — `instanceof Proof` false),
and drawing Proof as a bundle mints a non-conforming lookalike whose
instances never hold the discharged channel. The only mint is
`makeProof` + the module-private discharged writer — unforgeability is
an ordinary capability instance, re-verified by a forge-through-every-
kind-surface battery. Sweep: `__invariantsList` registry row executed
(no writer since C6.1b); the Method/Field descriptor taxonomy's
refines edges removed and `MemberType` deleted (D44 audit item);
`__isGeneric` (disposition: delete) stays registered pending
GenericType's own re-derivation; `__effectvar:`/`__effectVarParams`
stay registered pending the function-type generic-param structure.
Decisions presented to the maintainer at this landing: MultiValue-kind
retirement and the NominalType alias.*

*Status (2026-08, C7.2): the D39 residue is zero. GenericType re-derived
through the recipe (C7.2a): draws Type's kind-members, declares `params`;
generic types stamp shape = GenericType (`type of Array` answers it;
`Array instanceof Type` holds by conformance); the applier lives in the
generic's own `construct` (the `__constructor` alias collapsed);
`__isGeneric` deleted — the kind IS the flag. GenericType holds no
construct authority yet — per ruling R1 as maintainer-amended, this is a
DEFERRED PUBLIC SURFACE, not kernel-privacy-by-design: unlike Proof
(whose privacy IS the soundness mechanism), nothing breaks if users mint
generic types; exposure waits on surface design (per-generic gensym'd
member scopes — the kernel mint keys them by name — plus a spec form),
and the refactor is additive. Applied concretes stay shape Type with
host-read `__args`/`__generic` (member surface consciously deferred).
`distinct` re-derived as the SYMBOL-FRESH newtype mint (ruling R2):
members re-declared under a gensym'd scope, so non-conformance falls out
of C5.2 symbol-identity membership by construction — the
shared-member-set guard now carries only `structuralWrap`. The post-hoc
`constructor` meta-method removed; construction authority is the
reserved `construct` define-spec key (ruling R3). Effect variables
(C7.2c): `Param.effectVar` is a declared reference into
`__genericParams`; bare variable names ride inferred effect sets; the
`__effectvar:` marker strings and `__effectVarParams` side table are
deleted. Rulings R1–R3 maintainer-ratified 2026-08, R1 as amended
(recorded in the structures plan §4).*

**Instance-of = shape-of** (D40; sharpened by D45 to shape-CONFORMS-TO):
a kind is a type whose instances are
type-values. `io : Effect`, `Int : Type`, `Effect : Type`, and `Type :
Type` is the fixed point (D7 — no `Kind` above `Type`, no universe tower;
stratification is handled by translation at the proof-export boundary).
**The `refines` relation (D44) is orthogonal** to instance-of.

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


---

## Appendix A — D39 slot disposition (executed; the table is code)

The authoritative disposition table is **`src/slots.ts` `SLOT_REGISTRY`** —
it has been executable since C1.1 (the W3 corpus invariant fails any
unregistered `__*` key) and each row was updated in place as its
disposition EXECUTED. Post-C7.1 state of the original D39 inventory:

- **Executed (row removed or rewritten)**: `__effect_kind` → the `kind`
  field declared on Effect (C6.2); the five Proof fields → plain
  instance-data bindings declared on the Proof kind (C6.3);
  `__invariantsList` → swept, no writer since C6.1b; `arity` → deleted
  (D39 addendum); `__extends` → `__refines`, writers narrowed to
  refinement (C6.1a); the MultiValue component plane → the carrier's
  channel plane (C7.1); `__isGeneric` → DELETED, generic-ness IS the
  kind (shape = GenericType, C7.2a); `__params` → the `params` declared
  binding on generic types (C7.2a); `__constructor` → collapsed into
  `construct` (D45 one-surface, C7.2a); `__effectvar:` markers +
  `__effectVarParams` side table → `Param.effectVar` declared reference
  into `__genericParams` (C7.2c; the side table had no functional
  reader since the F1-F3 walker deletion).
- **Registered, pinned to a future owner**: `__args`/`__generic`
  (host-read instance data on applied concretes; the language-level
  member surface for applied generic types is consciously deferred —
  C7.2 ruling R1), `exported` (S3 scope-binding visibility),
  `__predicate`/`__abstractDomain` (Refinement members — physical
  rename pending the same treatment Proof's fields got).
- **Channels (stay)**: `__type` (shape), `__discharged` (integrity,
  kernel-private writer), effects/knowledge host carriers.
- **Host internals (stay, renamed freely)**: the engine-side `__*`
  properties (grammar machinery, compile flags, tail-call sentinel,
  memo caches, member-scope markers).

## Appendix B — B8 minimal-base primitive audit (D27/D28; design target)

The layering proof: Allegretto's irreducible base is **~40 primitives**;
everything else in `src/primitives.ts` is Standard-layer extension or
environment capability. This is the D27 DESIGN TARGET — the physical
relocation of extension primitives out of the base registry is future
work (it rides the M2/M3 formalization), but every subsequent design
decision has been made against this table. Disposition legend: KEEP
(base) · REFACTOR (base, reshaped) · SUBSUME (folds into channel/slot
ops) · EXTENSION (Standard/lib) · ENV (environment capability) ·
DELETE.

| Primitives | Disposition | Target |
|---|---|---|
| `bits_*` (21) | KEEP | base Bits ops |
| `expr_*` (8) | KEEP | base Expression ops |
| `eval_if`, `seq`, `id` | KEEP | base control / util |
| `ctx_new/bind/resolve/bindings` | REFACTOR | `scope_new/extend/lookup/bindings` (D26 — executed at C2) |
| `ctx_use` | DELETE | executed at C2.3a |
| `mv_new/primary/get/set/components`, `component_get` | SUBSUME | `channel_read` / channel writers / `channel_list` (D28a) |
| `make_error` | SUBSUME | the public viral error channel's writer (D28b) |
| `eval_when` + `when_*` | EXTENSION | pattern-matching lib over `eval_if` + struct reads |
| `typed_*`, `type_*`, `structural_wrap` | EXTENSION | Standard type system (owns the gated `type` channel) |
| `export` | EXTENSION | module system |
| contract/invariant prims (`assert_stmt`, `requires_stmt`, `ensures_*`, …) | EXTENSION | contracts lib; checks = predicate-channel writes + `scope_assume` |
| `*_decl_marker` + `*_attach` families | SUBSUME / EXTENSION | collapsed at C1.5b (metadata as host fn properties); markers → grammar templates |
| proof prims (`proof_*`, `prove_*`) | EXTENSION | proof kernel (canonical `discharged`-writer holder) |
| `grammar_*` / `grammar2_*` / `register_*` bundles | EXTENSION | grammar-tooling lib (engine stays host code) |
| `print` (io), `fetch` (net), `delay` (time) | ENV | environment capabilities, effect-labelled |

Findings that shaped the arc: the bulk of `primitives.ts` is EXTENSION
(D4's mechanism-in-base line, concretely); the `*_attach` zoo existed
only to smuggle metadata past the pre-C4.3c stripping boundary and is
gone; IO is not base.

## Appendix C — B10 forgery scenarios A–F (the soundness battery)

The verification D21 cites, maintained live in `src/boundary-tests.ts`
(grown v1 → v2 → the C6.3 re-run through every kind surface):

| # | Attack | Verdict | Mechanism |
|---|---|---|---|
| A | Forge `discharged` from nothing (object literal) | BLOCKED (live test) | origination requires the writer closure, held privately by the proof kernel; the construction gate THROWS |
| B | Swap a real proof's proposition, keep `discharged` | BLOCKED (live) | data-immutability (D22) — write-authority alone is insufficient; immutability is the second leg |
| C | Combine a real proof with a fake operand hoping `discharged` propagates | BLOCKED (live) | integrity channels use non-fabricating propagation (`drop`/recheck) — a `viral`/`union` rule here WOULD forge, hence D23's registration-time constraint |
| D | Read a real `discharged`, write it onto a fake | BLOCKED (live) | reads are free; the WRITE needs the capability — read-freedom is safe |
| E | Capability leak through an export surface | SKELETON | standard ocap risk; the base is safe GIVEN holders keep writers private — unlocks as a live test at S3 visibility enforcement |
| F | Forge the capability itself | BLOCKED (live) | the writer is a PrimitiveFunction closure (D24), unconstructible from Allegretto |

C6.3 additions: forge-through-every-kind-surface (`Proof.define`
refused, call-as-function inert, bundle-draw lookalikes non-conforming
and channel-less).
