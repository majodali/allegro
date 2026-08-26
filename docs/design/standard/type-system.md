# Type system — design decisions

> Tier 1 design doc. Status tags per `docs/design/README.md`.
> Reference for current behavior: `core-types.md` (the roster) +
> `docs/design/allegretto/structures.md` §6/§8/§9; implementation
> in `src/types-std.ts`, `src/primitives.ts` (dispatch), `src/evaluator.ts`.

## 1. Types are predicates [implemented]

The fundamental model: a type is a predicate/constraint over values.
Concrete types additionally provide constructors (`__construct` enables
`T(args)` syntax) and a hierarchy (`subtypeof`). `instanceof` and
`subtypeof` are infix operators desugaring to primitives.

Refinement types make the predicate view literal: `Int & _ > 0` is Int's
predicate conjoined with one more clause, carrying an abstract domain for
compile-time entailment.

## 2. Single meta-type with optional name [implemented]

**Decision (2026-05):** `NominalType` collapsed into `Type` with an optional
`__name`. Named-vs-anonymous is a *value-shape distinction* (one bit of
state: name present or not), not a type-of-types distinction.

- `instanceof` / `subtypeof` are shape-aware: nominal comparison when both
  operands carry a name, structural when the expected type is anonymous or
  carries the interface marker. *(Superseded detail, D44/C6.1a 2026-08:
  the `__extends` name-walk is DELETED — conformance is now identity →
  loose base-name path → `__refines` chain → symbol-identity membership
  over `__members`. There is no declared is-a edge outside refinement.
  See `docs/decisions.md` D44 and
  `docs/design/allegretto/structures.md` §8.)*
- `~T` (structural wrap) projects to anonymous by erasing the name,
  preserving members/construct; a back-link records the original.
- `NominalType` is RETIRED (C7.1) — after D44 there is no nominal
  checking left for the name to name; `Type` is the one root kind.

**Why it came up:** `Effect` needed a meta-type handling both named effects
(`io`, `time`) and anonymous conjunctions (`io & time`). The same shape-aware
framing settled for Effect lifts one level to Type itself. The pattern is
expected to recur for `Predicate`, `Function`, `Symbol`.

### Multiple inheritance [dissolved — D44, 2026-08]

The deferred MI design (explicit-error-on-conflict, `__extends: Type[]`,
graph-reachability `instanceof`) was DISSOLVED by D44: declared
inheritance itself decomposed into conformance (drawing member symbols)
+ refinement (`__refines`) + composition (bundles), so multi-conformance
needs no MI — a type draws symbols from any number of bundles today.
The old trigger conditions no longer apply. Rationale record:
`docs/plans/archive/structured-values-unification.md` D44;
register entry `docs/decisions.md` D44.

Also parked (still live): modeling nominal-vs-structural as a *mixin*
(the comparison methods as an additive behavior set).

## 3. Type definition mechanisms [implemented (API); syntax deferred]

Three distinct mechanisms:

1. **`extends`** — new type inheriting the subtypeof chain; adds/overrides
   fields and methods.
2. **`distinct`** (the "newtype" mechanism) — fresh nominal identity, same
   representation, breaks the subtypeof chain.
3. **`where` / `&`** — refinement: same type plus a predicate constraint;
   constructor inherited and checked by default.

**Fluent API first, syntax later.** Type declarations are built through the
fluent API (`Type.extend / .where / .distinct / .interface / .mixin /
.invariant / .constructor`) until usage patterns make the right declaration
syntax obvious. User-defined type declaration *syntax* is deliberately
deferred (backlog).

### Access control [implemented — B-097, D41–D43]

Access is controlled by the type's member lookup: a type exposes exactly
what its member-access protocol returns (fields listed in member
descriptors; optionally a `__getMember`/`fallbackMember` hook for
computed access — 3-ary since B-097 V2: `(instance, name, evidence
capsule)`). Type methods operate on the raw Context and can reach
everything; consumers go through dispatch. This makes dynamic, computed,
context-sensitive access possible — module encapsulation (only exported
fields visible) is implemented this way.

Since B-097 V3, members can be declared **private** in the define spec
via the combinator surface (no keywords yet — keyword syntax is B-043
and lowers to the same attributes):

```
Vault = Type.define({
  owner:  String,
  secret: private(Int),                     // private field
  code:   private((self) => self.secret),   // private method
  reveal: (self) => self.secret,            // public, reads the private
})
```

The attribute rides the member DESCRIPTOR (the `getter` precedent);
`readonly(...)` is reserved vocabulary — recorded but inert until B-046.
The kernel mediator (D41 stage 3) enforces it: a private member resolves
only for evaluation contexts holding the type's member privilege, which
dispatch plants when it runs the type's own member bodies. Denial names
privacy (`'secret' is private to 'Vault'` — member names are public by
design). Enforcement covers every reader: dot/bracket/interpolation,
operator dispatch, destructuring (an error, not a silent no-match),
printing (`…` marks omitted private fields), conformance (only
externally-reachable members count, both sides), and value-bearing
reflection (`ctx_bindings` withholds private pairs; enumeration and
flags stay free). Private symbols are type-local: they never draw, a
foreign private cannot be drawn, and bundle privates do not propagate.
Full design truth: `docs/design/allegretto/structures.md` §6/§13; the
ratified decisions are V-R1–V-R8 in `docs/plans/visibility.md`.

## 4. The meta-property protocol [under revision]

Types and rich values communicate through string-keyed Context bindings —
still `__`-prefixed on the BINDING plane: `__name`, `__type`, `__members`,
`__construct`, `__getMember`, `__interface`, `__predicate`, `__refines`,
`__wraps`, `__union`, `__args`, `__generic`, `__discharged`, `__length`.

**Maintainer direction (2026-06):** the `__` prefix is an accreted artifact
— it gestures at privacy and clash-avoidance but provides neither.

**Retirement in progress (B-104, 2026-08).** The direction above is now a
directive, and the survey behind it separated two populations that the one
prefix had been hiding:

- **Host plane — retired 2026-08 (chunk 1).** `abstractDomain`,
  `effectBound`, `effectLabels`, `effectSet`, `inferredEffects`,
  `predicateSet`, `lawBackings`, `genericParams`, `partial`,
  `decreasesMetric`, `declaredEffectsAst`, `paramEffectPairs`,
  `provenClauses`, `total`, `assumeTerminates`, `futureManager`,
  `tailCall`, `compileMode`, the three `grammar*` properties and the
  member-dispatch expandos are JS properties on host objects. They share a
  namespace with nothing, so the prefix bought nothing; 27 names were
  renamed with no behaviour change.
- **Binding plane — open.** The names listed above sit in the SAME
  `bindings` map as user fields, and `isMetaSlotKey(key) =
  key.startsWith("__")` is the partition test between the two. Here the
  prefix IS load-bearing, so retiring it means replacing the partition —
  a storage plane, registry membership, or interned keys — not renaming
  past it. B-104(b) carries the options and awaits a ruling.

**The redesign discussion has since concluded (2026-07)** — outcome in
`docs/design/allegretto/structures.md`; the questions this section
enumerated resolved as follows:

- **central registry** → becomes code: `src/slots.ts`, the D39
  slot-disposition table as the registry, with a completeness walker
  enforcing it mechanically (chunk C1.1 / backlog B-006);
- **replacement naming scheme** → declared **symbol-keyed members** on the
  owning kind (`Type.members`, `Effect.kind`, …) or registered
  **channels** (`shape`, `knowledge`, `error`, `effects`, `discharged`) —
  the full per-slot disposition is structures.md §9 (D39);
- **access discipline** → the typed accessor layer, lint-enforced from
  chunk C1.3;
- **sealing** → no seal op: capability-gated channel origination +
  immutability + non-fabricating propagation (structures.md §3, D21);
  Proof unforgeability becomes an ordinary kernel-private capability;
- **which channel carries what** → structures.md §3/§6 + the S6 channel
  registry (specced during implementation).

The retirement is **not yet implemented** — the shipping code still uses
`__*` throughout, and this document describes that shipping behavior. The
prefixes disappear as each slot's owning mechanism is rebuilt
(B-006–B-026); the M1 exit sweep requires `__*` to survive only as
registered host-side internals. Until then: **no new meta-property without
recording it here**, and follow the existing conventions for consistency
rather than inventing variants.

## 5. Generics [implemented]

Promoted from the session bootstrap at the K-002 slim (B-095 chunk 3);
kind-tower truth (GenericType as a kind, `params` field, applier =
`construct`, deferred user-generics surface — C7.2 ruling R1 as
amended) is `docs/design/allegretto/structures.md` §9. The facts that
live here:

- Generic types are type constructors: `Array` is a function from type
  params to concrete types; `Array[Int]` is the applied concrete.
- **Concretes are memoized** — `Array[Int]` always returns the same
  Context, so applied-generic identity is physical identity.
- Type parameters can be types or **values** (e.g. `Vector[3]`).
- Bare generic in annotation position auto-applies `Any`:
  `arr: Array` → `arr: Array[Any]`.
- Applied concretes answer shape Type and carry host-read
  `__args`/`__generic` back-links.

## 6. Function types and unification [implemented]

`Function[ParamTypes, ReturnType]` is the parameterized type attached
to typed function definitions. Type variables (unresolved Params in
type expressions) bind progressively at call sites:

- Unification matches arg types against param types, accumulating
  type-variable bindings.
- Flow is **bidirectional**: `T` determined from one argument
  propagates to constrain the others in the same call.
- Contradictory bindings (`T = Int` and `T = String` in one call)
  produce type errors at the call site.

Checks run in `applyComposed` before substitution — no `type_check`
wrappers inside function bodies. Effect-variable unification rides the
same generic-param surface (`docs/design/standard/effects.md` §2).

## 7. Member descriptor shapes [implemented]

The literal descriptor forms stored in every type's `__members`
Context (the symbol-keyed member registry — identity and conformance
semantics in `structures.md` §8):

- Method: `{__type: MethodType, name: String, value: fn, getter?: 1}`
  — executable member; the getter flag makes dispatch call it
  immediately with self.
- Field: `{__type: FieldType, name: String, fieldType: Type}` — typed
  field declaration on record types.

`typeMethod(type, name)` reads `__members` first and falls back to
direct bindings — the single bridge for member access;
`typeMemberDescriptor(type, name)` returns the full descriptor for
dispatch-level use. The kind API itself (instanceof, subtypeof,
define, distinct, construct authority) lives in `__members` the same
way — `structures.md` §9 holds that design.

## 8. Known consistency notes

- (Resolved 2026-08, K-002 slim: the bootstrap's "seven value kinds"
  list is deleted; the representation taxonomy is
  `structures.md` §2 — host discriminants, D46.)
- `Param.predicates` is reserved for future refinement bounds on parameters;
  effect bounds moved to the dedicated `Param.effectBound` slot (effects
  describe computations, refinements describe data — keep the lattices
  separate).

---

*Sources: `design_type_system_meta_types`, `design_type_definitions`
(memory, promoted 2026-06); meta-property revision direction from the
2026-06 project review.*
