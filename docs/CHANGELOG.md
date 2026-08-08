# Allegro — Changelog

> Tier 2. Append an entry per landed chunk (see `docs/PROCESS.md` §5).
> Newest first. Each entry: what landed, key decisions, deviations from
> plan, test count.

*Stub — the per-phase history currently embedded in `CLAUDE.md` ("What's
Next" / completed-items section) will be migrated here verbatim during the
2026-06 documentation refactor; new entries are appended here from now on.*

## 2026-08 — C6.3: Proof re-derived, kernel-private authority; slot sweep (structures Phase 6, B-026; M1 exit criterion)

Phase 6's validation criterion met: Effect AND Proof rebuilt through
the kind recipe with zero hand-rolled residue in their kind structure.

- **Proof is a kind by construction**: draws Type's kind-member symbols
  (`Proof subtypeof Type` by membership) and declares its instances'
  fields — the D39 Proof table EXECUTED: `proposition` / `reason` /
  `counterexample` / `lhs` / `rhs` are plain instance-data bindings
  (typed Strings where textual) declared as Field members on the kind,
  so `t.proposition` dispatches. The five `__*` proof rows leave the
  registry; the physical renames happened inside the slots accessors
  (consumers untouched).
- **Constructor authority is KERNEL-PRIVATE** (D40 R2 / D45): Proof
  holds NO `construct`. `Proof.define(...)` refuses ("holds no
  constructor authority"); `Proof(...)` residualises inertly (ordinary
  PE — no shape stamp, no discharged channel, `instanceof Proof`
  false); drawing Proof as a bundle mints a non-conforming lookalike
  (kind-API symbols are meta-filtered from draws) whose instances never
  hold the discharged channel. The only mint is `makeProof` holding the
  module-private discharged writer — holding a kind's construct IS
  holding its mint, and not exporting it IS unforgeability: an ordinary
  capability instance, not a special arrangement.
- **Forgery battery re-run**: forge-a-proof attempted through every
  kind surface (define, call-as-function, bundle-draw, object literal)
  — all dead; the C1.4 construction gates stand.
- **Slot sweep** (D39): `__invariantsList` row executed (no writer
  since C6.1b); `__effect_kind` already retired at C6.2; the
  Method/Field descriptor taxonomy's refines edges removed and
  `MemberType` DELETED (the D44 audit's last taxonomy item);
  `SLOT_KEYS` trimmed to match. Registered residue, each pinned to its
  owner's future re-derivation: `__isGeneric` (GenericType),
  `__effectvar:` / `__effectVarParams` (function-type generic-param
  structure).
- Battery additions: Proof-in-the-tower matrix, the four forge surfaces,
  and a sweep test pinning the executed dispositions.

1051/1051 green. Decisions presented to the maintainer at this
landing: MultiValue-kind retirement; NominalType alias disposition.

## 2026-08 — C6.2: Effect re-derived through the kind recipe (structures Phase 6, B-025)

D40 executed: the first external validation of the kind tower — Effect
rebuilt with zero hand-rolled residue in its kind structure.

- **Effect is a KIND by construction**: it draws Type's kind-member
  symbols, so `Effect subtypeof Type` holds by membership and
  `isKind(Effect)` is true with no whitelist — `Effect.define("net")` /
  `Effect("net")` work through the same construct-authority machinery
  as every other kind.
- **An instance IS its label set** (the D39 `__effectBound` note's
  collapse): `pure` = {} (bottom), `Effect("io")` = {io}, `opaque` =
  top. Instances stamp `__type = Effect`, carry `kind`/`labels` as
  declared data fields, and are MEMOIZED by label set — label-set
  identity is physical identity (`Effect("io") === Effect("io")`; both
  operand orders of a conjunction are one Context), so D37 equality
  falls out of identity.
- **Members live once, on the kind** (§6 delta 7): `io.union(time)`
  dispatches through io's shape exactly as `42.toString()` dispatches
  through Int. buildEffect's per-instance member copying is DELETED;
  so is the `__refines = Effect` chain hack (the D44 audit's "three
  effect-lattice sites scheduled to die" are dead).
- **Anonymous conjunctions land** (D40 R3 — the deferred debt closed):
  `io & time` mints an anonymous Effect instance carrying the union
  label set; typed_amp's opaque coercion is gone. Lattice ops are
  label-set ops — subset = inclusion, union/intersect = join/meet with
  pure/opaque as bottom/top.
- **§6 deltas 6 (pre-approved) landed**: `pure subtypeof Effect` →
  FALSE (an instance does not CONFORM to its kind; `pure instanceof
  Effect` is the check). `pure subtypeof opaque` stays false — the
  C6.1a effect-kind guard is re-derived on the principle that instances
  of an order-carrying kind relate by the KIND'S ORDER
  (`subset_of`/`implies`), never by conformance.
- **D39 Effect checklist**: `__effect_kind` slot RETIRED (→ the `kind`
  field declared on Effect); `__effectBound` derived-at-mint from the
  label set; `__effectLabels` registered as the host-side carrier.
  Remaining for C6.3's sweep: `__effectvar:` markers /
  `__effectVarParams`.
- **formatValue**: type values (values whose meta is a kind) render by
  name — `print(io & time)` → "io & time"; kinds declaring instance
  fields no longer push their instances into the record rendering.

Battery: Effect-in-the-tower matrix, conjunction mint + memo identity
both operand orders, order-vs-conformance split, no-copies/no-chain
pins. 1049/1049 green.

## 2026-08 — C6.1b: The kind tower — Refinement, Interface, construct authority, fluent API removed (structures Phase 6, B-024 part 2)

D45's kind tower: kinds are just types, one construction surface at
every meta-level.

- **Refinement** — a SUB-KIND of Type: draws Type's kind-members
  verbatim (conformance by symbol membership) and declares the instance
  data every refined type carries (`refines`, `constraints`). Refined
  types answer `__type = Refinement`; `type of (Int & _ > 0)` IS the
  Refinement kind.
- **Interface** — a REFINEMENT of Type, built through the refinement
  mint itself: member-transparent over Type's kind API, restricted by
  the declaration-only predicate (an instance of Interface holds no
  value-constructor authority). Interfaces answer `__type = Interface`.
- **The half-lotus matrix** (ratified, now a boundary battery):
  `Type : Type` ✓, `Refinement : Type` ✓, `Interface : Refinement :
  Type` ✓, `Refinement : Interface` ✗ — the last cell answers through
  C3.3's predicate re-check seeing Refinement's constructor authority.
- **Constructor authority (D45 R2)**: `construct` is the per-kind
  minting member; call-as-function invokes it at every level —
  `Type({v: Int})` mints a record type, `Refinement(Int, p => p > 0)`
  is the mint `&` sugars, `Interface(spec, ...bundles)` mints
  declarations. `define` is a pure NAMED FACTORY: validates the
  dispatch target is a kind, delegates to its construct.
- **The fluent API is REMOVED** (decisive, no sugar):
  - `where`/`invariant` → the `&` mint. Chained `&` (left-assoc) gives
    per-clause layers with domain-rendered counterexamples
    (`refinement check failed: expected ≥ 1 (got 0)` replaces
    `invariant 1 failed`); record predicates reach fields through `_`
    (`Type.define({lo, hi}) & _.lo <= _.hi`). `buildInvariantedType`
    deleted; `__invariantsList` has no writer (slot swept in C6.3).
  - `interface` → `Interface.define(spec, ...bundles)`;
    `buildInterfaceType` generalized from single parent to drawn
    bundles.
  - `mixin` → method-valued `define` spec entries (`{x: Int, mag:
    (self) => ...}`); function VALUES are methods, function TYPES
    (`toString: Function`) stay fields; a same-name method OVERRIDES
    the drawn member (C5.2b declaration-override supersedes mixin's
    refuse-same-name — flagged for ratification). Reusable mixins are
    BUNDLES: a methods-only spec mints a pure member set (no
    auto-generated construct/toString — which also keeps bundles
    diamond-safe), drawn like any bundle and conferring declared
    conformance. Methods on refined scalars go through the Refinement
    spec's non-reserved entries. `buildMixinType` deleted; its core
    survives as `buildMethodLayer`.
  - `preserveOps` → the Refinement spec's `preserve` option
    (`Refinement.define({refines, where, preserve: ["add"] | "all",
    ...methods})`).
- **Supporting**: `&`'s left-operand gate is kind-conformance
  (`isTypeMeta`) so chained refinements stay types; the C3.3 subtypeof
  guard generalized (ANY predicate-carrying expected demands
  identity/chain — membership cannot discharge a predicate);
  introspection's `__invariantsList` rendering removed; `Refinement` /
  `Interface` bound in the standard extension.
- **Deferred with design sketches**: `distinct` as a Distinct kind
  (shared member set, fresh identity) and `constructor`'s spec —
  recorded in structures.md §9; C6.2's Effect re-derivation may inform
  both.

Follow-up (maintainer rulings, same chunk): (1) override-on-draw
ratified WITH order-insensitivity — bundle order in a define call is
NOT significant: a spec declaration binds ALL keys of a multi-bound
drawn target, and two bundles providing different descriptors for one
symbol error at define time in either order ("bundle order is not
significant; resolve by declaring '<member>' in the spec" — the spec
declaration is the explicit resolution and owns its keys).
(2) Refinement spec shape ratified as-is. (3) Kind-hood: no reified
`Kind` (D7), and no convention either — a kind is exactly a type
holding Type's kind-member symbols, so `K subtypeof Type` is the kind
test from Allegro; `isKind` becomes that conformance predicate
(replacing the whitelist). Battery: order-swap symmetry, both-ways
conflict, spec resolution, kind test.

Landed in two commits (kind tower + construct authority ecc83fa; fluent
removal + migration ca725ea) plus the rulings follow-up. 1048/1048
green (1049 with the order battery).

## 2026-08 — C6.1a: Unified conformance, `__refines`, and `Type.define` (structures Phase 6, B-024 part 1)

The D44/D45 implementation slice: inheritance dissolves; one
construction surface.

- **One conformance check** (`shapeAwareSubtypeof`): identity → loose
  base-name path (anonymous expected) → `__refines` chain → symbol-
  identity membership over `__members`. `nominalSubtypeof` (the name
  walk) is DELETED — there is no declared is-a edge outside refinement.
  Two guards preserve ruled pre-C6.2/C6.3 semantics: effect types stay
  chain-only until Effect is re-derived through the kind recipe, and
  predicate-carrying shapes keep C3.3's construction-through-chain
  `instanceof` (`5 instanceof PI` stays false untagged).
- **Name-stable per-type member scopes**: built-ins declare members in
  their own scopes (`<type#Int>::add`), so near-identical built-ins
  never conform accidentally (`3.14 instanceof Int` → false). Bound
  user types stabilize their construction-time counter scope onto the
  declaration site (`<type#<main>::Point>`) at auto-naming
  (`stabilizeTypeMemberScope`) — fixpoint re-evaluation of a
  declaration converges instead of minting fresh symbols per pass.
- **`__extends` → `__refines`**: the physical edge is the refinement
  relation (D44). Writers narrowed to refinement layers only —
  `buildRecordType` / `buildInterfaceType` mint NO edge (composition
  draws member symbols; conformance is membership, not ancestry).
  Remaining writers: `buildRefinedType` (legitimate), the descriptor
  taxonomy (dies C6.3), `buildEffect` (dies C6.2).
- **`Type.define(spec, ...bundles)` replaces `extend`** (D45,
  decisive — no sugar): self is the KIND, the spec declares fields,
  bundles are drawn member sets. `X.extend(spec)` migrated to
  `Type.define(spec, X)` across ~42 sites (tests/*.alg, lib/math.alg,
  test.ts, boundary-tests, web sandboxes, docs). Non-kind dispatch
  (`Int.define(…)`) errors with the migration form. Multi-bundle
  interface diamonds resolve per-member via draw-from; two concrete
  bundles with distinct same-named symbols (every record's own
  `toString`) error explicitly at define time — D44's no-silent-
  linearization rule, surfaced.
- **Boundary contract asserted**: define's three forms (fresh, drawn,
  interface diamond) + no-refines-edge invariant; non-kind guidance;
  explicit concrete conflict; `extend` gone; per-type scope keys; the
  stabilized-scope declaration-site invariant.

Landed in three commits (unified conformance f8e6af9; rename 9d70ca1;
define + migration). 1048/1048 green.

## 2026-08 — C5.2c: The declared-conformance split (structures Phase 5, B-023 part 3; B-023 complete)

The ratified conscious delta lands (D30; migration pre-approved at the
C5.2 briefing, sequenced flip-last per ruling R3).

- **Interface conformance is DECLARED**: the check is symbol-identity
  membership — every member symbol the interface declares must BE a
  member symbol of the actual type. A type conforms by DRAWING the
  interface's symbols (`Point = HasXY.extend({x, y})` binds them);
  spelling the same member names is no longer enough. `42 instanceof
  Printable` is now false: Int spells a `toString` but never declared
  Printable's symbol.
- **The loose path stays**: `~T` structural wraps and anonymous inline
  types match by base-name projection — the explicit duck-typing
  surface, aimed at data values. `structuralWrap` now erases the
  `__interface` marker along with the name, so `~Printable` projects an
  interface into the loose world (`v: ~Printable` accepts 42).
- **Migration per the pre-approval**: `tests/interfaces.alg` rewritten
  to document the split (accidental → false; declared via
  extend-the-interface; `~T` duck-typing); `tests/typed-types.alg`'s
  accidental assertion flipped with a comment; the two test.ts
  accidental-conformance tests reframed as declared/loose pairs;
  CLAUDE.md's interface + nominal-vs-structural sections and syntax
  examples updated.
- **Boundary contract asserted** (the plan's C5.2 matrix): a same-named
  member from an undeclared context does NOT satisfy an interface
  check; `~T` still matches it; the wrap provably erases the marker.
- **Harness fix surfaced by the flip**: the legacy grammar2 end-to-end
  harness (`evalStandard2` in test.ts) discarded evaluation results, so
  every reference re-ran construction expressions — re-running
  `Type.interface(...)` mints a fresh member scope, making
  symbol-identity conformance spuriously fail against a second
  construction of the "same" interface. It now writes evaluated values
  back through the eval ctx, mirroring evalSource's loop (the real
  pipeline was never affected).
- Residue (recorded per ruling R3): retroactive conformance of built-in
  types to user-defined interfaces needs partial type declarations —
  until that surface exists, `~T` is the duck-typing path for core
  types.

1 new boundary test (the declared-vs-loose matrix); 1046/1046 green;
tsc at the 4-error rootDir baseline. B-023 and the C5.2 chunk are
complete.

## 2026-08 — C5.2b: Draw-from binding (structures Phase 5, B-023 part 2)

D30's draw-from lands: member declarations resolve their SYMBOL at
construction time instead of blindly minting names.

- **`drawMemberKey(drawnContexts, baseName, localScope)`** — the
  resolution: a base name matching exactly one drawn (parent/base)
  member BINDS that symbol, so overrides keep member identity (Dog
  re-declaring Animal's `name` stores under Animal's key; a record's
  `toString` binds the parent's toString symbol; a preserveOps lift
  binds the parent op's symbol — asserted by the battery); zero matches
  mint a TYPE-LOCAL symbol in the type's own member scope; several
  distinct targets error per §5 (a descriptor multi-bound to several
  symbols dedupes to ONE target and stays legal).
- **Per-type member scopes** (`<type:N>`, per-construction counter —
  the user-visible name arrives after construction via auto-naming, so
  scopes cannot key on it; name-stable scopes integrate with module
  FQNs in a later chunk; nothing compares type-local symbols across
  evaluations yet, documented in symbols.ts).
- **Lookup generalizes**: `typeMethod`/`typeMemberDescriptor` do a
  kernel-scope fast path (the hot built-in dispatch case) then a
  base-name projection scan; multiple DISTINCT targets under one base
  name is the §5 ambiguity error at the access surface — the diamond
  machinery is live and tested even though no surface syntax can
  produce a diamond yet.
- **`structuralSubtypeof` compares by explicit base-name projection** —
  behavior-preserving under per-type scopes; this is the marked C5.2c
  flip site (declared conformance moves to symbol identity, leaving
  this function as the loose `~T`/anonymous path).
- Mixin's conflict check is projection-based (multi-bind-aware);
  mixin methods mint type-local symbols (new members by definition).
  preserveOps' unfiltered member copy is fixed — Type's meta-method
  names no longer ride into instance member sets (the latent wart the
  re-keying made visible).

3 new boundary tests (draw/override identity + local-scope
distinctness; preserveOps symbol-drawing + wart fix; multi-bind
one-target resolution + distinct-target ambiguity error); 1044/1044
green; tsc at the 4-error rootDir baseline.

## 2026-08 — C5.2a: Symbol-keyed member storage (structures Phase 5, B-023 part 1)

The C5.2 briefing's rulings R1–R6 were ratified (recorded in the plan §6
and structures.md §5) and the first sub-chunk lands: member sets are
SYMBOL-KEYED, observable-zero by construction.

- **Storage**: member descriptors live under the member symbol's FQN
  string (`<kernel>::add`, …) — interning makes string-key identity
  symbol identity, so the host map stays `Map<string, Binding>`. Every
  member registers in the kernel scope (ruling R5), so each base name
  projects to exactly one symbol and no ambiguity is possible yet;
  C5.2b generalizes to drawn/type-local scopes via `projectBaseName`.
- **One write chokepoint** (`addMember`) covers every origination site
  (record fields, interface declarations, preserveOps lifts, mixin
  methods, Type's ten meta-methods, Effect's lattice methods,
  buildType). Inheritance copy loops carry FQN keys verbatim; the
  name-based logic projects: meta-method exclusion filters and
  formatValue's instance reads via `fqnBaseName`, the mixin conflict
  check and preserveOps' parent-op lookup via `kernelMemberFqn`.
  `typeMethod`/`typeMemberDescriptor` keep their name-based signatures —
  projection happens inside. New `memberDescriptorsOf(type)` gives
  tests/tooling a baseName→descriptor view so nothing reaches through
  raw bindings anymore.
- **Ruling R1 enforced**: typeShape's member-transparency-by-identity is
  untouched — refinement/distinct layers still share the parent's
  member-set object, and the two former IMPLICIT sharers
  (buildInvariantedType, structuralWrap — blanket copy loops) now share
  explicitly via `setMembers(child, parentMembers)`.
- **Pre-fix**: `makeTypedBinOp` now dispatches through
  `typeShape(leftType)`, matching the evaluator's PRIM_TO_METHOD path —
  the two agreed before only via the sharing invariant.
- **Ruling R4 applied**: the symbols.ts ambiguity message no longer
  promises the deferred `x[ns.name]` qualification syntax.
- Unions stay outside member storage (ruling R6, re-derived at C6);
  instance field storage stays string-keyed and pattern matching stays
  on the loose base-name path (ruling R2 non-goals).

2 new boundary tests (FQN-keyed storage + projection roundtrip; sharing
invariant across refined/invariant/wrap layers); 8 test.ts
representation-reaching sites migrated to the projection view
(assertions unchanged); 1041/1041 green; tsc at the 4-error baseline.

## 2026-08 — C5.1: FQN symbols — the identity substrate (structures Phase 5, B-022)

Phase 5 opens with the symbol identity substrate (`src/symbols.ts`),
implementing structures.md §5 with the D42 wire rule designed in from
day one.

- **Identity = FQN, enforced by interning.** `registerScopeSymbol(scope,
  base)` returns THE symbol for `scope::base` — the same object across
  re-evaluation, module reload, and fresh loader instances (the intern
  table outlives them). `SymbolValue` gains an optional `fqn`; the base
  name stays the convenience projection (printing, lexical resolution).
  Parser-minted symbols (`makeSymbol`) remain TRANSIENT references with
  no identity beyond their occurrence — §5 explicitly allows scope
  binding keys to stay strings, so the hot resolution path is untouched.
- **Registration is automatic at the defining scope.** `evalSource`
  gains a `moduleFqn` parameter (default `<main>`) and registers every
  top-level binding name under it; `ModuleLoader` passes the resolved
  module file path (§5's default scope FQN).
- **D42 export partition.** Registration and exporting are separate acts
  on separate maps. `markExported` (called by the module loader for the
  module's public interface) populates the export registry;
  `symbolFromWire(fqn)` answers ONLY from it — a private
  (registered-but-not-exported) or unknown FQN resolves to null, and a
  failed rebind mints nothing (asserted by an intern-count check).
  `symbolToWire` is the FQN; serializing a transient symbol is an error.
- **The §5 governing rule as one resolver.** `projectBaseName(candidates,
  base, qualifier?)` — zero targets → none; one distinct target → match
  (a member multi-bound to several symbols dedupes to ONE target, §8);
  multiple distinct targets → explicit qualification required, else an
  ambiguity error naming every candidate FQN. The battery runs the same
  matrix through three surface framings (import resolution, member
  binding, dot access) and asserts identical outcomes — C5.2 adopts the
  resolver at the latter two surfaces when members become symbol-keyed.

5 new boundary tests + 1 module-loader integration test (registration +
export partition + reload identity end-to-end); 1039/1039 green; tsc at
the 4-error rootDir baseline. Deferred to C5.2: symbol-keyed members,
`x[ns.name]` qualification syntax, draw-from binding.

## 2026-08 — C4.3c: Transparency at the eager boundary — primaryOf retired (structures Phase 4, B-021 part 3; B-021 complete)

The last C4.3 sub-chunk lands scalar transparency (R4) and closes B-021.

- **The eager boundary no longer strips.** `applyPrimitive` passes eager
  impls the FULL values — channels intact; impls read data through the
  accessors (`dataOf`/`asBits`/`asCtx`). The C1.2/C1.3 accessor
  migration made this a zero-change flip: no production impl read args
  raw, so the suite was green on the first run. The propagation table
  alone governs channels (D28).
- **`channelAware` registration mode DELETED** — it is now everyone's
  default. The seven registrations (proof_refl/sym/trans/cong,
  prove_for_all_bool, prove_induction, certificate_peek) became plain
  eager primitives; the `PrimitiveFunctionValue.channelAware` field and
  `makePrimitive`'s fifth parameter are gone. The D3 lazy/eager
  arg-shape asymmetry with it: `lazy` is purely an evaluation-control
  choice (receive arg ASTs + evalFn) — the "register lazy to dodge
  stripping" idiom is dead.
- **`primaryOf` RETIRED as a name.** `dataOf` is the one data-plane
  accessor — defined in types.ts (identity for everything except a
  transparent scalar structure), re-exported through slots.ts. The
  remaining ~380 references (test suite + one import) renamed
  mechanically; no `primaryOf` identifier survives in code.
- Typed scalars keep the `ValueKind.MultiValue` tag per ruling R6 — the
  tag now simply means "transparent scalar structure"; its retirement is
  expected with the C6 kind recipe. The evaluator's MV re-evaluation
  merge stays as the table-driven merge policy (it is the R3 rule, not a
  nesting hack). Physical plane separation inside structure.ts (primary
  as a channel-map entry) remains an internal-layout follow-on.
- **Tier-0 touch-up flagged for maintainer ratification** (not bundled,
  per plan §8): PROCESS.md's evaluator-invariants bullet "Eager
  primitives receive `primaryOf`'d args … must be registered lazy" now
  states a false invariant and needs its propose-and-ratify replacement.

2 new boundary tests (an eager impl observes its args' channel plane;
proof combinators are plain eager and still see Proof channels);
1033/1033 green; tsc at the 4-error rootDir baseline.

## 2026-08 — C4.3b: MV-over-Context flattened — records answer Context (structures Phase 4, B-021 part 2)

The MultiValue-over-Context wrapper is gone: channels attach DIRECTLY to
record/type structures, so a typed object is one structure with both a
slot plane and a channel plane (D15/D17 — the first half of the
transparency cutover; scalars follow at C4.3c).

- **One chokepoint**: `makeMultiValue` with a Context primary flattens
  through the new `structure.ts deriveWithChannels` — a copy-on-write
  derive sharing the source's data planes by reference (immutable, D22)
  with the given channel map attached. The given map is AUTHORITATIVE
  (writers pre-clone via the now-total `cloneComponents`, then
  set/delete — merging in the derive would make channel deletion, e.g.
  `clearOccurrenceBound`, inexpressible). Every wrapper site (withType,
  withEffects, withPredicates, channel writers, mv_set, export) flows
  through it, so MV-over-Context is UNCONSTRUCTIBLE — asserted by the
  extended W1 invariant.
- **Records/arrays/modules/proofs answer `ValueKind.Context`** with
  `dataOf` as identity. The dense region (C4.2) coexists with the
  channel plane on the same structure.
- **Type bindings ARE the internal singletons**: `wrapType` is identity
  — `Int` is IntType itself. A bare type Context already answers its
  meta-type through the `__type` binding-plane fallback, so `type of
  Int`, `Int instanceof Type`, and meta-method dispatch read the same
  storage internal code uses, and identity short-circuits
  (`actualType === expectedType`, member-set sharing, memoization) hold
  by construction.
- **`getType` is total** (reads `channelReadRaw(v, "type")` for any
  value). One consequence: bare Contexts carrying `__type` now route
  through type_dispatch's TYPED path instead of the untyped meta-dispatch
  fallback — the typed path's `typeMethod` fallback learned to self-bind
  ComposedFunction methods so the two paths agree on the returned shape.
  One legacy-exact carve-out: `unifyTypes` keeps its MV-only actual-type
  participation (a bare type Context's meta-type is not what name
  unification compares; the call-site checkArgType does the real check).
- **Channel accessors are universal**: `channelReadRaw`,
  `componentsView`, `cloneComponents`, `channelList` answer any
  Structure (lazy — plain contexts and scopes pay one undefined check).
  ~20 MV kind guards widened across evaluator (dispatch gate, viral
  scans, residual typing), primitives (formatValue, mv_get/mv_set/
  mv_components, `Y of x`, eval_if error guard, type_dispatch viral
  branch, makeTypedBinOp), modules (export detection), totality
  (when-subject type resolution), refinements/effects readers
  (predicatesOf/domainOf/occurrenceBoundOf/effectsOf), and
  `applyBoundaryBound` (the C3.2 availability gate applies to flattened
  records).
- **Hazard A resolved**: the six `__construct` re-tag sites
  (refined/invarianted/distinct/preserveOps/mixin/custom-constructor)
  switched to `withTypeReplacing` — they are construction points
  re-tagging a parent-constructed instance, and `withType`'s
  shape-immutability guard is now LIVE for Contexts (it was dead before
  because a Context input's channels lived on the discarded wrapper).
- **R5 reframe (pre-approved)**: W5 restated — the DATA planes are
  role-exclusive (Context never carries `primary`; MV never carries
  slots), the CHANNEL plane is universal. W1 extended: an MV primary can
  never be a Context. W3 covers Context-role component keys + recurses
  into their values. One internals-shaped test updated (record instance
  kind: MultiValue → Context — the chunk's stated outcome).
- Scope guard: `deriveWithChannels` rejects evaluation scopes (channels
  never attach to scopes — C2.1 plane rejection).

6 new boundary tests (records/arrays answer Context + print correctly;
type-binding identity; `type of` uniformity; unconstructibility + data
plane sharing; channels survive withPredicates); 1031/1031 green; tsc at
the 4-error rootDir baseline.

## 2026-08 — C4.3a: Merge-policy activation — error virality + effects union (structures Phase 4, B-021 part 1)

The first C4.3 sub-chunk activates the principled propagation rules that
C1.5 recorded but deferred (maintainer rulings R1–R3, ratified 2026-08 at
the C4.3 briefing; recorded in the implementation plan §6).

- **R1 — error virality rides every residual hop.** The legacy behavior
  lost the error channel after the first residual hop: `applyPrimitive`'s
  unresolved-args early return ran BEFORE the viral scan, so
  `(error "boom" + 5) * 2` produced a bare residual with the channel
  dropped. The viral scan now runs first. Two further drop sites fixed
  with the same rule: the unresolved-application residual path in
  `evaluateExpr` (an error-carrying callee or argument propagates — this
  is how `r.toString()` on an error-carrying residual now works) and
  `type_dispatch`'s unresolved-object residual (the dispatch residual
  carries the object's viral channels; RESOLVED error values still
  dispatch normally, so Error's own members stay callable).
- **R2 — error-in-if propagates.** `eval_if` checks the evaluated
  condition for an error channel before branching: `if (error "boom")
  then 1 else 2` now propagates the error instead of silently taking the
  else branch on the error value's meaningless primary.
- **R3 — effects union on MultiValue re-evaluation.** The
  flatten-on-re-evaluation path in `evaluate` now merges union-rule
  channels via the registry-installed channel merge (effects observed
  before re-evaluation are facts, not stale guesses); all other channels
  keep inner-shadows-outer (fresh type info replaces stale).
- **Differential fixtures updated** (pre-approved test-condition changes
  per the briefing): `err-viral-chain`, `err-in-if-cond`,
  `err-through-method` now pin the principled `fmt=error(boom) |
  err=boom` behavior. The C1.5 "recorded warts" comments in slots.ts and
  boundary-tests.ts updated to match.
- **Scaling-test robustness fix** (measurement methodology, not a
  behavior condition): the C4.2 O(1) index-access test compared one
  timed round of cache-resident (200-element) vs cache-missing
  (200k-element) access with a 5× threshold — the honest cache-miss
  ratio is 2–8× depending on heap state, so the test straddled its own
  threshold (confirmed by A/B: baseline and patched trees both produce
  ratios across the band in isolation). Now min-of-3 rounds per side
  with a 20× threshold — far above cache noise, far below the ~1000×
  an O(n) scan would show.
- Rulings R4–R6 recorded for the following sub-chunks: strip-semantics
  retirement and the non-nesting reframe land at C4.3c; the
  `ValueKind.MultiValue` host tag stays through C4.3 but is not expected
  to survive beyond C6 (retirement is an expected outcome of the C6
  kind-recipe work — exact chunk decided at the C6.1 briefing).

2 new boundary tests (deep-chain virality; effects-union flatten);
1025/1025 green; tsc at the 4-error rootDir baseline.

## 2026-07 — C4.2: Arrays as numeric structures — the dense region (structures Phase 4, B-020)

D18 lands physically: array contexts store their elements in the
Structure's DENSE REGION — a plain JS array — with no per-element Binding
objects, no decimal string keys, and no `__length` binding. The slot
count IS `dense.length` (cached as Bits on first read).

- **Single chokepoint, sole storage**: recon confirmed every
  numeric-keyed context flows through `makeRawArrayCtx` (user arrays,
  generic params/args, function param-type lists) and that NOTHING
  mutates an array context after construction — so the dense region is
  the only storage, not a mirror. `makeDenseArrayCtx` is the new
  types.ts factory shim.
- **Compatibility by lazy view**: `bindings`/`bindingList` on the
  Structure class are now accessor-backed; a dense structure materializes
  the legacy map/list view (elements under string keys + `__length`) on
  first access and caches it — sound because arrays are immutable (D22).
  Hot paths never touch it: ~10 element-access sites migrated to the new
  slots.ts accessors (`indexGet` / dense-aware `getSlotCount` /
  `elementsOf`), and every slot PROBE (`hasShapeSlot`, `getName`, … — the
  auto-naming pass probes every binding value) answers dense structures
  without materializing, since they can only ever hold numeric keys +
  `__length`. The boundary test asserts a full bracket/length/map/reduce
  pipeline runs with the view still unmaterialized.
- **W6 dense-view-coherence** joins the walker: whenever a view exists it
  must agree with the dense region (the region is authoritative).
- **Boundary tests**: O(1) index access verified by a scaling test (50k
  reads on 200 vs 200,000 elements, length-independent); array/object
  duality (the string-key protocol answers from the materialized view,
  dense stays authoritative after); existing arrays.alg / collections /
  HOF tests as the differential oracle — all pass untouched. A/B
  benchmark: mixed array+recursion workload ~3% faster than pre-C4.2.

1023/1023 green.

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
