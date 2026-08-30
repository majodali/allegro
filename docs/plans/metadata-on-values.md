# Metadata on values — delete the carrier, build values with their metadata

> Status: **draft** — awaiting maintainer ratification of §6.
> Owner: **B-121**. Ruled at **D48(b)(c)** (B-108, 2026-08); the *whether*
> is settled, this plan is the *how*.
> Outcome (K-007): every representation kind carries its own metadata field,
> values that will carry metadata are constructed with it, and the carrier —
> together with `primary`, `isCarrier`, W1 and the `dataOf` indirection —
> no longer exists.

## 1. Why — settled, and restated only as much as the plan needs

D48(b) was ruled on measurement, not preference. Of 240,820 value
allocations in the corpus, **56,123 were carriers** — 74% of all structures,
more than there are Bits values — and **98.5% held exactly one field**
(99.4% of it `type`). `dataOf` runs 453,199 times and really unwraps 40% of
them. The most common act in the system was allocating an eleven-field
`Structure` so that a `Map` could hold one entry.

*(B-122 has since removed 17,169 of those — the live figures are 38,954
carriers, 70.2% of structures. The shape is unchanged: carriers still
outnumber the Bits values they wrap.)*

D48(c) added the lifecycle half, which came from a maintainer question
rather than from measurement: **12 call sites literally read
`withMetadata(makeInt(0), m)`** — the value never exists without its
metadata — and one of them is PE Rule 1 itself.

**The change is not a new mechanism.** Structures already work this way:
`withMetadata` with a Structure primary takes `deriveWithChannels` and the
metadata rides in `components`, with no carrier involved. The carrier exists
only because the other six kinds have nowhere to put that field.

## 2. Four probes run before writing this plan

Each one was a risk this plan would otherwise have had to hedge against.

| Probe | Result | Consequence |
|---|---|---|
| Change `withMetadata`'s return type from `StructureValue` to `Value` and typecheck | **0 errors** | **Nothing depends on attaching metadata producing a Structure.** The step feared most is type-safe |
| Who calls `newCarrierStructure`? | **2 sites, both inside `withMetadata`** | Carriers are constructed in exactly one function, so they can be eliminated atomically rather than hunted |
| What does the evaluator's carrier arm do? | `if (!isCarrier(value)) return value;` then **evaluate the primary and re-wrap** | It is a hand-written dispatch to the inner kind's behaviour — which the new representation performs by construction (§4.2) |
| How many `kind === / !== ValueKind.Structure` comparisons exist? | **185** | The real risk surface, and it is behavioural rather than type-level (§5.1) |

## 3. The target

### 3.1 Host types

```ts
/** METADATA PLANE (concepts.md §18/§19) — the fields a value carries
 *  through partial evaluation, keyed by registered field name. */
export type Metadata = Map<string, Value>;
export interface MetadataBearing { meta?: Metadata; }
```

extended by all seven value interfaces. `Structure.components` is renamed
`meta`: `components` always read like *parts of a composite*, which is the
data plane — exactly what it is not.

**`meta` is optional, and not out of laziness.** Allegretto defines no
fields (R6, R11: the base owns the mechanism, layers own the fields), so
under `--base` a value legitimately carries nothing. The two populations
without metadata are *every value in Allegretto mode* and *engine
intermediates that never become program values*. It **cannot** become a
required argument of `makeInt`: that would make L0 depend on a concept it
does not have, which is B-110's violation relocated into the construction
path. Optional in the type, **always declared on the object**, per the
stable-hidden-class convention `types.ts` already states on `makeParam`.

### 3.2 Four operations, four names

`withMetadata` is one name over four operations — 45 non-test call sites:

| operation | sites today | spelled |
|---|---|---|
| **create** — the value never exists without it | 12 | `makeInt(42, meta)`, `makeExpr(fn, args, meta)` |
| **derive** — same datum, new metadata | 10 | `deriveMeta(v, meta)` |
| **map** — new datum, metadata carried across | 9 | `mapDatum(v, newDatum)` |
| **stamp** — computed value, computed metadata | ~14 | `stampMeta(v, meta)` |

**The map case is the one that earns its name.** Today it is spelled as
*two* calls — `withMetadata(newP, cloneComponents(v))` — and omitting the
second **silently drops metadata with no error**. That is the same
convention-only obligation as the TailCall sentinel (B-113) and the
ComposedFunction clone helper. Naming it removes the way to get it wrong.

### 3.3 Per-kind construction, and why each is safe

Measured shares of what carriers wrap, with the clone concern for each:

| kind | share | concern | already solved by |
|---|---|---|---|
| Bits | 50.5% | none | — |
| PrimitiveFunction | 46.0% | host expandos (`CHANNEL_WRITER_BRAND`) | `primitives.ts` already clones one and re-stamps the brand |
| ComposedFunction | 1.3% | `param.owner`; `PRESERVED_FN_META_KEYS` | the shared clone helper CLAUDE.md mandates. **RULED: `param.owner` continues to represent the ORIGINAL function** (maintainer, 2026-08) |
| Expression | 1.3% | `memo` | the clone **shares** the map — same `fn`+`args` ⇒ same memo, preserving IC-6 |
| Param | 0.8% | `owner` | as ComposedFunction |
| **Symbol** | **0.0%** | interning (SC-4: identity = FQN ⇒ same object) would break under cloning | **does not arise** — measured zero. §6 ruling 2 decides what happens if it ever does |

### 3.4 Why copy-on-attach, recorded so it is not re-litigated

59,027 attachments, of which **19,817 (33.6%) target an object that has
already been given metadata**. Metadata is a property of a value *in a
position*, not of the datum. Both no-allocation designs fail on that one
number: in-place mutation lets a second stamp overwrite the first at every
position holding the value, and a side table (`WeakMap<Value, Metadata>`)
fails identically because its key is the object. D22 is the rule adopted
*because* of this, not the reason itself.

**The legitimate in-place case, which this plan states as a rule**: while a
value is provably unshared — during construction, before it escapes. The
carve-out already exists twice, as an idiom rather than a rule
(`structure.ts`'s grandfathered builder idiom; `writeShape` for
identity-sensitive type Contexts, ruled at B-104 chunk 3). *Stamp in place
only before the value escapes; after that, derive.*

## 4. Method

### 4.1 Strictly additive, and the read side never moves

The read surface needs **no change**: `channelReadRaw`, `componentsView` and
`cloneComponents` each take a `Value`, cast, and read `.components`. They
work the moment the field exists on every kind. So the migration adds the
field first and everything keeps working before anything writes it.

### 4.2 The carrier's evaluator arm is a manual dispatch

```ts
case ValueKind.Structure: {
  if (!isCarrier(value)) return value;      // plain structure: inert
  const mv = value as CarrierStructure;
  const ep = evaluate(mv.primary, ctx, …);  // carrier: evaluate the inner value
  …                                         // then re-wrap with its metadata
}
```

Three such arms exist (`evaluate`, `remapParams`, and the substitution walk).
Each forwards to the inner kind's behaviour and then carries the metadata
onto the result — which is exactly what the new representation does by
construction: a typed Bits *is* a Bits and takes the Bits branch.

**The one thing that must move rather than vanish** is the re-wrap. Today
only carriers get "evaluate the inner value, carry the metadata onto the
result"; afterwards, every kind needs it. Doing it once in `evaluate` — *if
the input carried metadata and the output is a different object, carry it* —
is one place instead of three, and is `mapDatum` applied uniformly. **This is
the single most important correctness step in the plan** and C3 exists for
it alone.

## 5. Risks

### 5.1 The 185 kind-comparisons — the real risk, and it points the safe way

`kind === ValueKind.Structure` appears 117 times and `!==` 68 more. Today a
typed `42` answers **Structure**; afterwards it answers **Bits**. Any site
meaning *"is this composite?"* is currently **wrong about carriers** and is
defended by peeling with `dataOf` first (903 uses) — those sites get *more*
correct, not less. The danger is the inverse: a site that relies on a typed
scalar answering Structure. **The suite is the oracle** and C2 is where this
surfaces; the plan does not claim to have found them all by reading, because
it has not.

### 5.2 Boundary invariants about a concept being deleted

W1 (carriers never nest) and W5 (a carrier's data plane is empty) become
vacuous — there is nothing left to violate. Removing them is **not**
weakening a test condition in PROCESS §6's sense, because the construction
they forbid becomes unconstructible, but it is close enough to the line that
§6 ruling 3 asks for it explicitly rather than assuming it.

### 5.3 Allocation is not obviously reduced, and the plan should not claim it is

Attachment count is unchanged (~1:1 with carriers today). What changes is
**what** is allocated: a same-kind clone (Bits: 3 fields) instead of an
eleven-field `Structure`, plus one fewer indirection on 453,199 `dataOf`
calls. The metadata `Map` itself is **not** removed. Any further win —
e.g. exploiting that 98.5% of metadata is a single `type` entry — is a
separate optimisation below this choice and is out of scope.

## 6. Rulings needed before C1

1. **Names.** `Metadata` / `MetadataBearing` / `meta`, and
   `deriveMeta` / `mapDatum` / `stampMeta` for the three non-construction
   operations. Naming is cheap to change now and expensive later, and C1 of
   the concept campaign (B-111) is about to settle *field* vs *channel* — so
   these should be chosen to sit correctly beside that vocabulary.
2. **Symbol.** Metadata on an interned Symbol is measured at **zero**. Do we
   (a) leave it unhandled and let it work by the generic path, silently
   breaking FQN identity if it ever happens; (b) assert against it; or
   (c) permit `meta` as the one field settable on the interned instance?
   Recommend **(b)** — an assertion costs nothing at zero occurrences and
   converts a silent identity break into a loud one.
3. **W1 / W5 retirement** (§5.2) — confirm that deleting invariants whose
   subject no longer exists is not a PROCESS §6 test weakening.
4. **Scope of C5.** Deleting `dataOf` touches ~903 sites mechanically. Land
   it inside this arc, or as its own C9-style rename chunk after it?
   Recommend **its own chunk** — it is pure churn with a count as its test,
   and mixing it into a semantic chunk makes that chunk unreviewable.

## 7. Chunk sequence

| Chunk | Delivers | Gate |
|---|---|---|
| **C1** | `Metadata` / `MetadataBearing` declared and extended by all seven interfaces; `Structure.components` → `meta`; every factory declares the field. **Nothing writes it yet** — the readers already read it | Suite green; **no behaviour change** is the claim, so a green suite on the first run is the evidence |
| **C2** | `withMetadata` attaches to a per-kind clone instead of a carrier. Carriers stop being created; `newCarrierStructure` loses its only two callers. `dataOf` still compiles and returns `v` | **The risky chunk.** Suite green; §5.1's kind-comparison failures surface here or nowhere |
| **C3** | The carrier's re-wrap moves into `evaluate` as one uniform carry (§4.2); the three carrier arms are deleted | Suite green; PE fixtures are the oracle for metadata surviving evaluation |
| **C4** | Delete `primary` (196), `isCarrier` (14), `CarrierStructure` (24), `newCarrierStructure`, W1/W5 and their walker. `concepts.md` §10 leaves the spine | Counts to zero; §6 ruling 3 applied |
| **C5** | Delete `dataOf` (903) and its call sites — mechanical, counts as the completion test | Counts to zero |
| **C6** | The four operations: factories take metadata, `deriveMeta` / `mapDatum` / `stampMeta` replace `withMetadata`'s 45 sites, and the 12 create-then-attach pairs collapse — **PE Rule 1 first** | Suite green; the `withMetadata` count reaches zero |
| **C7** | The in-place rule (§3.4) stated where `writeShape` and the builder idiom live; `concepts.md` §10/§11 updated and their deltas closed | doc-ref-lint; spine delta rows read `—` |

**Completion test** (concept-campaign §9.4): a chunk is done when the spine
delta rows it claims read `—`, and the renames carry counts —
`primary` 196 → 0, `dataOf` 903 → 0, `isCarrier` 14 → 0,
`CarrierStructure` 24 → 0, `withMetadata` 69 → 0.

## 8. What this plan is not

It is **not** a performance arc. The allocation shape improves, but §5.3 says
plainly what does and does not get cheaper, and no chunk is justified by a
benchmark. The justification is R7 — the distance between what the
specification says a value is and what the implementation makes it — and the
measured fact that 74% of all structures existed to work around a missing
field.

It is also **not** IC-2. B-120 (the entry-sequence composite) changes what a
*Structure* is; this changes where *metadata* lives. They meet only at the
end, where together they leave one role — record — which is what SC-5 said
it was buying.
