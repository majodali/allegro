# Type system — design decisions

> Tier 1 design doc. Status tags per `docs/design/README.md`.
> Reference for current behavior: `CLAUDE.md` §Type System; implementation
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

### Access control [implemented]

No `public`/`private` keywords. Access is controlled by the type's member
lookup: a type exposes exactly what its member-access protocol returns
(fields listed in member descriptors; optionally a `__getMember` fallback
for computed access). Type methods operate on the raw Context and can reach
everything; consumers go through dispatch. This makes dynamic, computed,
context-sensitive access possible — module encapsulation (only exported
fields visible) is implemented this way.

## 4. The meta-property protocol [under revision]

Types and rich values communicate through string-keyed Context bindings —
currently `__`-prefixed: `__name`, `__type`, `__members`, `__extends`,
`__construct`, `__getMember`, `__interface`, `__predicate`,
`__abstractDomain`, `__invariantsList`, `__effectBound`, `__wraps`,
`__discharged`, `__eq_lhs`/`__eq_rhs`, `__genericParams`,
`__effectVarParams`, `__inferredEffects`, and others.

**Maintainer direction (2026-06):** the `__` prefix is an accreted artifact
— it gestures at privacy and clash-avoidance but provides neither.

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

## 5. Known consistency notes

- The value-kind list in `CLAUDE.md` says "seven value kinds" but enumerates
  eight (Symbol was added later). To reconcile when `architecture.md` is
  written.
- `Param.predicates` is reserved for future refinement bounds on parameters;
  effect bounds moved to the dedicated `Param.effectBound` slot (effects
  describe computations, refinements describe data — keep the lattices
  separate).

---

*Sources: `design_type_system_meta_types`, `design_type_definitions`
(memory, promoted 2026-06); meta-property revision direction from the
2026-06 project review.*
