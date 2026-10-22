# Metadata and capability

> **Reader.** Someone who has read the Part I chapters and
> `structures.md`, and now wants to know what a value carries *about*
> itself, who may put it there, and what evaluation does with it. The
> chapter is the design truth for two [units](../units.md#def-unit),
> `metadata` (unit 10) and `capability` (unit 11), and it is the
> definition site of four terms the rest of the book uses: *metadata
> field*, *channel*, *propagation* and *writer capability*. Terms used
> without definition here are defined earlier: [value](../concepts.md#def-value),
> [representation kind](../concepts.md#def-representation-kind),
> [Structure](../concepts.md#def-structure), [binding](../concepts.md#def-binding),
> [plane](../concepts.md#def-plane) and
> [residual](../concepts.md#def-resolved-unresolved-residual).
>
> **Authority.** Tier 1. The decisions this chapter executes, all in
> `docs/decisions.md`: D21 — constructor trust decomposes into write
> authority, immutability and non-fabricating propagation; D23 — writes
> are capability-gated, reads free; D24 — the capability is a delegable
> closure; D47 — the source field; D48(b)(c) — metadata is a field on
> every kind, supplied at construction. The requirements are
> [R3](../concepts.md#def-r3) (metadata channels are independent) and
> [R12](../concepts.md#def-r12) (metadata origination is
> capability-controlled). Each section carries the status tag
> `../README.md` defines. The examples are
> `tests/metadata-channels-demo.alg`, pinned by the suite.

## 1. The two units and the line between them [implemented]

A value is what it is, and it may also carry named information about
itself: that it has a type, that it is an error, that a proof discharged
it, which expression produced it. [R3](../concepts.md#def-r3) requires
that each such piece of information be handled independently of every
other, by its own declaration rather than by the operation touching the
value. [R12](../concepts.md#def-r12) requires that information carrying
authority be unforgeable by code that does not hold the authority to
write it.

Two units answer those two requirements, and the line between them is
the line between a symbol and a meaning:

| Unit | File | Holds | Must not know |
|---|---|---|---|
| **`metadata`** (10) | `src/metadata.ts` | the field registry (name, rule, integrity), the propagation vocabulary, the free reads, the carry idioms, the base's `source` field, the table of installed merges | what any field *means*: it knows that `effects` merges by `union` and asks the installed merge; it does not know an effect set is a set |
| **`capability`** (11) | `src/capability.ts` | the minting of writers, one-shot registration, the integrity gate, the gated installation of meaning into the base, the base's own field registrations | nothing about layers either; it is the mechanism by which a layer that owns a field proves it |

`capability` imports `metadata`; `metadata` never imports `capability`.
The registry is a table that `capability` mints into (`defineMetaField`
is exported for that one caller), so authority is created in exactly one
unit. Nothing below the base imports either unit, and every unit of
Allegro Standard reaches the base through these two rather than through
a kind's representation (`units.md` §5): that is
[R6](../concepts.md#def-r6), the base does not know about the layers,
stated as a graph property.

Both units sit above `kinds`, the assembly of the seven representation
kinds, because the `meta` slot they manage is on every kind. D51 (`Value`
is a contract, seven kind units and one assembly) says the slot is *not*
part of the `Value` contract: the `metadata` unit mixes it
in by declaration merging, and the kind units never name it. Today the
slot is still declared in `src/types.ts` (`MetadataBearing`), which is
the `types.ts` split that `units.md` §7 schedules; the representation is
the same either way.

## 2. The metadata plane on every value [implemented]

Every representation kind carries an optional `meta` slot, a map from
field name to value (IC-3, implementation choice 3 in `concepts.md`
Part 0; D48(b)). A typed `42` is a `Bits` with a `type` field in its
`meta`, not a wrapper around a `Bits`. A value that carries nothing has
the slot undefined, so plain contexts and scopes pay nothing.

Metadata is supplied at construction, not attached afterwards (IC-3a,
D48(c)). The factories take an optional metadata argument; `withMeta` in
`src/types.ts` is the one attachment operation and yields a new value of
the same kind, deriving a Structure and cloning a leaf; `carryMeta` in
`src/metadata.ts` moves one value's metadata onto a value derived from
it. Writing the slot in place is permitted only while the value is
provably unshared, during construction and before it escapes; after
that, derive. `src/structure.ts` states the rule and why. The one
sanctioned in-place case on this plane is `writeShape` in
`src/metadata.ts`, which stamps a type Context's `type` field on a
Context that has just been minted and not yet escaped: type Contexts are
identity-sensitive (memoised generics, law registries), so deriving a
new one is not an option, and every call site stamps before anything
else can hold the value.

Reads are free (D23). `metaReadRaw(v, name)` answers the field or
`undefined` and demands nothing of the caller; `metaOf(v)` is the
read-only view; `metaFieldList(v)` names the fields present. From
Allegro, `channel_read(value, name)` and `channel_list(value)` are the
same reads, answering `none` for an absent field:

```
audit = channel_register("audit", "union")
v = audit(42, "checked")
print(channel_read(v, "audit"))     // checked
print(v)                            // 42
print(channel_read(42, "audit"))    // none
print(channel_list(42))             // [type]
```

Two reads are not plain lookups, and `metaReadRaw` serves both without
naming a field. `shape` is a projection of `type` with the
member-transparent refinement layers walked off, computed on read rather
than stored twice: the type system installs it (§7) and the base serves
the name. `discharged` is stored on the binding plane of a Structure
under a registered slot key rather than in `meta`, because the proof
kernel predates the universal `meta` slot: the base finds it through its
registration's `bindingKey` and reads it through the accessor layer. The
read order is the value's own `meta`, then a registered binding-plane
slot, then an installed projection. The binding-plane storage itself is
an item of B-104 (retiring the `__*` slot names).

<a id="def-metadata-field"></a>
## 3. Metadata field [implemented]

**Definition.** A *metadata field* is one named slot of the metadata
plane, with a **declared propagation rule** (§5) and a **writer
capability** (§6). Registration is one-shot: the first registrant
receives the writer and no one else can obtain it. Reads are free.

**Rationale.** One-shot registration is what lets R12 hold without the
base keeping a list of which fields matter. Authority is *the writer*,
not the name, so "who may write `discharged`" is answered by possession
rather than by a list the base would have to maintain, and would have to
be told to maintain, which R6 forbids.

**As implemented.** `MetaFieldSpec` in `src/metadata.ts` is the
registration: `name`, `rule`, an optional `integrity` flag (origination
requires the writer; §6), an optional `bindingKey` for the one field
stored on the binding plane, and a recorded-but-unenforced
`readVisibility`. `registerMetaField(spec)` in `src/capability.ts` mints
the writer and inserts a `MetaFieldEntry` (spec, writer, registration
epoch, whether Allegro minted it) into the table; `metaFieldSpec(name)`
and `metaFieldEntry(name)` read it back. The epoch exists because the
evaluation loop legitimately re-evaluates a top-level binding within one
pass: re-registration from Allegro with the same rule in the same pass
returns the held writer, and any later pass is refused. Kernel
registrations use epoch −1 and never re-issue. `bumpMetaEpoch` is called
at the start of each `evalSource` pass in `src/runtime.ts`.

```
again = channel_register("audit", "union")   // same pass, same rule
print(channel_read(again(1, "x"), "audit"))  // x — the held writer came back
```

**Who registers what.** The base owns the mechanism and each layer owns
its fields (R6), so a field is registered where its concept lives:

| Field | Rule | Integrity | Registered by | Serves |
|---|---|---|---|---|
| `source` | `drop` | yes | `src/capability.ts` | provenance (§8) |
| `error` | `viral` | | `src/capability.ts` | error propagation (§8) |
| `type` | `computed` | yes | `src/types-std.ts` | typing |
| `shape` | `computed` | | `src/types-std.ts` | typing, as an installed projection of `type` (§7); nothing stores it |
| `discharged` | `drop` | yes | `src/types-std.ts`, stored under a binding-plane key | proof |
| `effects` | `union` | | `src/effects.ts` | effect analysis; installs the merge |
| `predicates` | `computed` | | `src/refinements.ts` | knowledge; installs the facts merge (§7) |
| `domain` | `computed` | | `src/refinements.ts` | knowledge |
| `bound` | `drop` | | `src/refinements.ts` | knowledge, the occurrence bound |
| `knowledge` | `computed` | | `src/capability.ts`, no owner | nothing stores it; its storage *is* `predicates`, `domain` and the refinement layers |
| `warnings` | `union` | | `src/capability.ts`, no owner | nothing writes it |
| `exported` | `drop` | | `src/capability.ts`, no owner | nothing; visibility is a property of the binding |

The boundary battery pins this table ("field ownership", in
`src/boundary-tests.ts`) so that a field cannot drift back into the base
without the move being a visible change.

**Delta.** The last three rows are registrations without an owner, and
each is a finding rather than a relocation: one is a capability with no
storage, one is unused, one outlived its concept. **B-111** (field versus
channel registration) says what they are before they can move. The
`bindingKey` storage of `discharged` and the `shape` projection inside
`metaReadRaw` are the two name-specific reads §2 records.

<a id="def-channel"></a>
## 4. Channel [implemented]

**Definition.** A *channel* is the whole apparatus by which one
capability of the language rides values through
[partial evaluation](../concepts.md#def-partial-evaluation): **one or
more metadata fields**, their propagation rules, their writer, and the
layer-side code that interprets them. Typing is a channel. Effect
analysis is a channel. Proof discharge is a channel. A field is
storage; a channel is a feature built on storage.

**Rationale.** [R3](../concepts.md#def-r3) says a layer's information
rides on values independently, and a channel is what one layer's
participation actually consists of, which is more than a slot. The
distinction is not cosmetic: a capability may need several fields
(knowledge needs three), a field may be read through more than one
projection (`shape` over `type`), and a channel may have no field of
its own at all (`knowledge`).

**As implemented.** The table in §3, read by column: the *Serves*
column names the channels, and a channel is the set of rows that name
it plus the module that registers them. There is no channel-level
registration in the code. Each layer registers its fields one by one at
module init and installs its merges one by one; what makes those
registrations one channel is that one module performs them.

**Delta.** The code has field registration and no channel registration.
A registration that says *these fields, these rules, this semantics, this
owner* is **B-111**'s shape, and it is also where the three ownerless
rows of §3 are decided, since deciding what `knowledge` is means saying
which channel it belongs to.

<a id="def-propagation"></a>
## 5. Propagation [partial]

**Definition.** A field's *propagation rule* says what an operation does
with that field, drawn from a **fixed, inspectable vocabulary** (SC-7,
specification choice 7 in `concepts.md` Part 0):

| Rule | Meaning |
|---|---|
| `viral` | present on any argument, present on the result; the first occurrence wins |
| `union` | the arguments' values are combined by the merge the field's owner installed |
| `computed` | the field's owner derives it at the sites it annotates; the generic table does nothing |
| `positional` | reserved; no field registers it and no path applies it |
| `drop` | never carried forward; a derived value does not have it |

The base applies the rule without knowing what the field means. The
semantics a rule needs, a merge for `union`, are installed by the field's
owner (§7).

**Rationale.** The vocabulary is fixed rather than open, and the reason
is R12, not convenience. `registerMetaField` refuses a `viral` or `union`
rule on an integrity field, because those rules **fabricate**: they
place a value on a result that no holder of the writer put there. That
refusal is decidable only over an inspectable symbol. Over a registered
closure it is unwritable, and R12 degrades from enforced to hoped-for.
The argument is in `docs/records/concepts-analyses.md` §4.2. `union` is
in the vocabulary because effect sets union and knowledge meets; a
discipline the vocabulary cannot express extends the vocabulary rather
than opening it to closures.

**As implemented.** `PropagationRule` in `src/metadata.ts`;
`viralFields()` and `unionFields()` are cached filters over the registry,
invalidated by registration. The evaluator applies the table in two
places, both in `src/evaluator.ts` and both owed to this unit at
the exit of B-112 (the four owed plane interfaces): `viralScan` carries the first viral field found on any
argument onto an application's residual (and the argument's `type` with
it), and the unresolved-application path does the same for the callee;
`mergeOverMeta` merges the fields a value carries onto the value it
re-evaluates to, applying the installed merge where the rule is `union`
and letting the inner value's field win otherwise. `drop` needs no code:
nothing carries the field, and forgery scenario C in the boundary
battery pins that `discharged` never propagates. `computed` fields are
derived at annotated evaluator sites, which is what the word means.

```
e = make_error("boom")
print(channel_read((e + 1) * 2, "error"))          // boom   — through primitives
sq = x => x * x
print(channel_read(sq(e), "error"))                // boom   — through a user function
print(channel_read(if e then 1 else 2, "error"))   // boom   — through a conditional's test

note = channel_register("note", "drop")
n = note(7, 1)
print(channel_read(n, "note"))                     // 1
print(channel_read(n + 1, "note"))                 // none   — drop
```

**Delta.** Three gaps, one owner each.

- The rule and the path are not yet one mechanism. `union` is applied
  generically only when a field-carrying value re-evaluates
  (`mergeOverMeta`); the `effects` field rides its own dedicated path
  through primitive application, so a user-registered `union` field
  written on a leaf does not survive `v + 1` the way `effects` does.
  `assertPropagationTableLinkage` in the evaluator pins six fields by
  name so that the registry and the bespoke paths cannot drift apart
  silently. **B-112**'s exit moves `viralScan` and `mergeOverMeta` into
  this unit, and the generalisation of the `union` path is that chunk's
  question.
- `positional` is vocabulary without a path. It stays until a field
  needs it; the alternative, removing it, is a maintainer decision.
- The `computed` rule's "annotated sites" are the evaluator's L2
  imports (`units.md` misalignment M11 (the evaluator holds type-system activities)),
  which B-112 chunks C2 to C4 replace with installed hooks.

<a id="def-writer-capability"></a>
## 6. Writer capability [implemented]

**Definition.** The authority to *originate* a field value is a closure
handed to whoever registered the field. Reads require nothing (D23).
Origination on a user-reachable construction path is refused unless the
writer is held. The capability is the closure itself (D24): delegable by
passing it, attenuable by wrapping it, and unconstructible from
Allegretto, which cannot make a host closure.

**Rationale.** Metadata that anything can write cannot be evidence (R12).
Trust is global and structural, with no per-value brand bit (D21): a
value carrying `discharged` is trustworthy because nobody without the
capability could have originated it, the data under it is immutable, and
the field's rule is non-fabricating. Denial is an **abort, not an error
value** (SC-8, specified aborts, class C): an error value would be
forgeable, since the forger chooses what to do with it.

**As implemented.** `MetaFieldWriter` in `src/metadata.ts` is the type:
a `channel` name and a `write(target, fieldValue)` operation. The type
lives in the `metadata` unit because the table stores it and the gated
installs (§7) check it by identity; the minting is `buildWriter` in
`src/capability.ts`. A writer for a metadata-plane field clones the
target's `meta`, sets the field and derives a new value through
`withMeta`; the writer for the one binding-plane field stamps the
registered slot on a Structure in place, on a fresh kernel value.

Four surfaces hand out or guard writers:

- `registerMetaField(spec)` mints and returns one, once (§3).
- `kernelFieldWriter(name)` is the host kernel's acquisition path; the
  boundary lint fails any call site outside `src/types-std.ts` and
  `src/primitives.ts`.
- From Allegro, `channel_register(name, rule)` returns the writer as a
  `PrimitiveFunction` branded with its field name, and
  `channel_attenuate(writer, predicate)` wraps a held writer in one that
  evaluates the predicate on the field value first and halts on
  rejection. Writers are non-serialisable, print redacted and
  identity-equal only, so cross-process trust bottoms out in
  re-verification, never transported authority. Module-private authority
  is a usage pattern: capture the writer in a private binding and never
  export it.
- `assertNotIntegrityKey(key, site)` guards the user-reachable
  construction paths. It reads the registry, not a name list: the keys
  it refuses are the binding-plane storage keys of fields registered
  with `integrity`. An object literal writes the binding plane and
  cannot originate a metadata field at all, so a record may freely name
  a field `type`, `source` or `discharged`; what stays refused is the
  storage key `__discharged`.

```
ok_only = channel_attenuate(audit, x => x == "ok")
good = ok_only(5, "ok")
print(channel_read(good, "audit"))   // ok
ok_only(5, "nope")                   // halts: attenuation predicate rejected the write
```

The soundness battery is forgery scenarios A to G in
`src/boundary-tests.ts`, all live: (A) originating `discharged` without
the writer is refused; (B) a proof's proposition cannot be swapped under
`discharged`; (C) `discharged` never propagates; (D) a free read cannot
be written back onto a fake; (E) a module-private writer is unreachable
through every export surface; (F) the writer cannot be forged, by
re-registration or by attenuating a look-alike; (G) the metadata write
surface is exactly the minted writers, since the unguarded `mv_set` path
was deleted (B-125).

**Delta.** `readVisibility` is recorded on the registration and
enforced nowhere; reads are free for every field. Whether a field may
restrict its reads is the question that ruling V-R7 (reflection: flags
free, value-bearing reads need possession evidence) settled for
reflection and no item owns for fields.

## 7. Installing meaning into the base [implemented]

The base holds symbols; a layer installs what they mean. That is
the plane-interfaces plan's principle P2 (the layer installs, the base
never imports), and this unit holds its first five instances. All are
gated by the same rule, its principle P4 (capability-gated
registration): an install is authority, so the installer proves
ownership by holding the field's writer. The gate is identity
against the table, `metaFieldEntry(name).writer === writer`, so a
structurally similar object is not the capability (D24).

- **`installFieldMerge(writer, merge)`** in `src/capability.ts` defines
  how two values of the writer's field combine under `union`, by
  writing into the `FIELD_MERGES` table that `fieldMerge(name)` serves to
  the evaluator. `src/effects.ts` is the one caller and installs effect
  union with the writer it minted. Before the gate, any module could
  install a merge for any field by name, and so any module could decide
  what merging `effects` meant.
- **`installFieldCheck(writer, check)`** in `src/capability.ts` defines
  how an argument is checked against a declared constraint that names the
  writer's field. A check receives the expected type, the argument, a free
  reader over every field (ruling 1 of the plan: checks are not
  independent, so a check may consult other fields) and the site (the
  argument's position, the parameter as an opaque handle, an evaluator
  bound to the site's context). The evaluator runs every installed check
  at a typed call site and throws if none is installed; it does not know
  which field matters. `src/types-std.ts` installs the `type` check
  (structure, generics, futures, refinement predicates); `src/effects.ts`
  installs the `effects` check (the effect bound on an effect type or on
  the parameter).
- **`installDispatch(writer, dispatch)`** in `src/capability.ts` defines
  how the evaluator dispatches on the writer's field: at a primitive
  application (the dispatcher may type a residual whose operand is
  unresolved, or answer instead of the primitive) and at a composed call
  (the dispatcher binds the callee's declared constraints to the
  arguments, running the base's check loop, and returns the context, the
  substituted arguments and a result finisher). A dispatcher declines
  with null and the base proceeds as Allegretto, so nothing installed is
  not an error. `src/types-std.ts` installs both entry points: operator
  and equality dispatch behind the member gates, and call-site
  unification.
- **`installProjection(writer, project)`** in `src/capability.ts` defines
  how the writer's field is computed on read when nothing stores it. A
  projection receives the value and the free reader, so it can be built
  from any field. `src/types-std.ts` installs `shape` over `type`, using
  the refinement-chain walk `typeShape` that lives in `src/refinements.ts`
  (where knowledge ends and shape begins is that unit's line).
- **`installFactsMerge(writer, merge)`** in `src/scope.ts` is the same
  gate guarding one install into the scope unit: how facts about a name
  combine across scope layers. `src/refinements.ts` installs it with the
  `predicates` writer. The facts plane itself belongs to the scope
  chapter; what belongs here is that the gate is this unit's and the
  check runs through `metaFieldEntry`, so the scope unit imports the
  registry and never the owner.

The boundary battery pins the gates ("merge installation is
capability-gated", "check installation is capability-gated", "dispatch
installation is capability-gated", "projection installation is
capability-gated"): a foreign writer is refused by each installer, the
holder's merge is the one served, the facts merge installs once, a check
for a field the base has never heard of runs at a typed call site, a
dispatcher for such a field answers an operator application, and a
projection for such fields reads through the free reader.

**Delta.** A fact is a host `PredicateSet` object, not an encoded value,
so the facts merge is a second function beside the `predicates` field's
value-merge rather than the field merge read back through the
propagation table. **B-146** (knowledge propagation) decides whether the
two become one. The other installs the base owes, dispatch, check and
projection, are **B-112** chunks C2 to C4.

## 8. The base's own fields [implemented]

The base registers a field only if the concept it serves survives in
Allegretto, and that test was run rather than argued: `make_error` and
`source of` both work under `--base`. Two fields pass.

**`error`** is `viral`, with a public writer: `make_error(text)`
originates it, and §5's examples show it riding every derived result.
That reproduces automatic error propagation without a special form; an
error-carrying `if` condition propagates the error rather than taking a
branch.

**`source`** carries the originating Expression of a value (D47;
`structures.md` §3.1 is the design). It is `drop`, because a derived
value was not produced by the recorded expression and propagating it
would fabricate provenance. Its writer is kernel-private: `withSource` in
`src/metadata.ts` is not a primitive, and only the evaluator attaches it,
at call sites of source-aware primitives and on resolved top-level
bindings. It is an integrity field so that no doctored source can make a
verdict display a different proposition from the one checked. Reads are
`sourceOf` in the kernel and `source of x` in the language, which is
observe-tagged (D47(e)) and renders the expression as text.

## 9. Where the code is, and what pins it [implemented]

| What | Where |
|---|---|
| The registry, the vocabulary, the free reads, the carry idioms, the merge table | `src/metadata.ts` |
| Writers, registration, the integrity gate, `installFieldMerge`, `installFieldCheck`, `installDispatch`, `installProjection`, the base's fields | `src/capability.ts` |
| The `meta` slot and `withMeta` | `src/types.ts` (owed to this unit by the `types.ts` split) |
| The table applied: `viralScan`, `mergeOverMeta`, the linkage assertion; the check loop `checkArg`; the dispatcher loops | `src/evaluator.ts` (the first three owed to this unit at B-112's exit) |
| The Allegro surface: `channel_register`, `channel_read`, `channel_list`, `channel_attenuate` | `src/primitives.ts`, "Channel plane" |
| Forgery scenarios A to G, field ownership, the two gates, the differential propagation fixtures | `src/boundary-tests.ts` |
| The examples above, pinned by `// expect:` | `tests/metadata-channels-demo.alg` |
| The storage plane reached only through the accessor layer, which includes `src/metadata.ts` | `npm run lint:planes` |
