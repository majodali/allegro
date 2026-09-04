# The entry-sequence composite — one storage, an index below the spec

> Status: **active** — §6 ruled 2026-09-01; chunk E1 has its go-ahead.
> Owner: **B-120**. Ruled at **D48(a)** (B-108, 2026-08); the *whether* is
> settled, this plan is the *how*.
> Outcome (K-007): a Structure is an ordered sequence of optionally-keyed
> entries. The map is an index built where lookup is hot, and it sits below
> the specification. The dense role, the materialized legacy view, `__length`
> and the W6 invariant are gone.

## 1. Why — settled, and restated only as much as the plan needs

D48(a) ruled option E on measurement. Data structures are small, every large
by-name lookup is in a scope, and scopes are host machinery rather than data.
So the O(1) requirement that shaped the whole composite comes from the one role
that is not a value.

The ruling's numbers stand. §2 refreshes them post-B-121 and adds four the
ruling did not have.

## 2. Probes run before writing this plan

Each probe answers a question this plan would otherwise have had to hedge.
All were run over the 29 self-contained files in `tests/`, through the real
`evalSource` pipeline, walking every reachable value.

| Probe | Result | Consequence |
|---|---|---|
| Slot count per data structure | mean **2.85**, median **2**, mode **2** (1699 of 2540), 97.1% ≤ 8, max 29 | A linear scan over the entries beats a `Map` at this size. The ruling's premise holds and is stronger than it was measured to be |
| Scope size | **87** scope objects, mean **70.7**, median 28, max 176 | Matches D48(a)'s profile (mean 70, max 177). The index has one customer |
| Dense structures ever materializing the legacy view | **166** dense structures, **0** materialized | `materializeView`, `viewMaterialized`, the `__length` binding and the W6 invariant are unexercised. W6 is vacuous today |
| Numeric-keyed structures that are not dense | **0** | The fallback arms in `denseIndexGet`, `denseSlotCount` and `denseElements` are dead |
| Map and list agreement | **2254 of 2540** record structures disagree | §2.1 |

### 2.1 The map and the list are not two views — they are two stores

This is the finding that changes the arc's shape, and it is a defect rather
than an inefficiency.

`slotWrite` allocates **two** objects for one slot:

```ts
function slotWrite(ctx: StructureValue, key: string, value: Value): void {
  ctx.bindings.set(key, { key, value });
  ctx.bindingList.push({ key, value });
}
```

They disagree in three measured ways:

| Class | Count | What it is |
|---|---|---|
| Different objects for one key | **2254** | Writing through one view is invisible to the other |
| List holds stale entries | **28** | `__name` and `<type#Int>::toString` appear twice; the map has the current value, the list has both |
| Map holds entries the list lacks | **15** | Proof contexts — `proposition`, `__discharged`, `lhs`, `rhs` — written to the map only |

So a reader iterating `bindingList` sees a different structure from a reader
iterating `bindings`. Delta 49 (C9) recorded this as the root of the four
binding write disciplines. It is now quantified, and it affects almost every
record in the corpus.

**The entry sequence deletes the class**, because there is one store and
nothing to disagree with.

### 2.2 The entry sequence already exists, unnamed

`Binding` is already `{ key: string | null; value: Value | undefined; … }` —
an optionally-keyed entry. `bindingList` is already a sequence of them.
`parser.ts` already pushes `{ key: null, value }` for a bare statement, and
`grammar2/tree-builder.ts` reads `key === null` in twelve places to separate
bare statements from bindings.

That work is done against the list, because **the map cannot hold a null key
at all**. The composite already has an entry sequence and an index over it;
the index simply cannot represent everything the sequence holds, and the two
are maintained by hand.

This reframes the arc. It is not "introduce a new representation". It is
*make the sequence the storage, derive the index from it, and stop maintaining
two stores by convention*.

## 3. The target

### 3.1 Host types

```ts
class Structure {
  entries: Binding[];            // THE storage: ordered, optionally keyed
  private _index?: Map<string, number>;   // host plane; built where lookup is hot
  meta: Metadata;
  // host-plane scope fields unchanged: parent, isScope, scopePredicates
  immutable: boolean;
}
```

`Binding` keeps its name and its shape. Nothing new is introduced at the value
level, which is the point: D48(a) removes a representation rather than adding
one.

### 3.2 The index sits below the specification

A scope keeps an index. A data structure does not, because 97% of them hold
eight entries or fewer and a scan is faster than a hash.

The index is host-plane state: not part of the value, never observable from
Allegro, and free to appear or disappear. That placement is what D48(a) means
by *below the specification*, and it is why the O(1) requirement stops shaping
the composite.

**Invalidation is bounded because mutability is.** Scopes are the only mutable
role (D22), and scope writes go through `scopeExtend` and `addBinding`. Those
are the maintenance points. A data structure is immutable after construction,
so an index built for one can never go stale.

### 3.3 What dissolves

| Thing | Why it goes |
|---|---|
| The dense role | An array is `entries` with every key null. The role becomes a representation, which its level tag always said it was |
| `materializeView` and the legacy view | There is one store; nothing to materialize. Measured at 0 uses |
| `__length` | Length is `entries.length`. This closes **B-104(f)** |
| `isMetaSlotKey` | `__length` is the only key it ever answers true for. This closes **B-104(b)** — the last dunder |
| The **W6** dense-view-coherence invariant | Its subject is the disagreement between the view and the dense region |
| The four binding write disciplines | One store has one discipline |

## 4. Method

### 4.1 Chunk 1 is a bug fix that is independent of the representation

Make `bindings` a **derived, cached index** over `entries` instead of a second
store. `slotWrite` writes one object. The 2254 divergences go to zero, and
`.bindings`'s 193 call sites keep working unchanged.

This lands on its own, fixes a live defect, and is worth doing even if the
rest of the arc is deferred. It also converts the risky part of the migration
into a rename.

### 4.2 The read surface is where the risk is

`.bindings` has **193** non-test call sites and `.bindingList` has **56**.
That is five times B-121's `.primary` surface, and B-121's lesson applies
directly: the danger is not the sites that name the storage, it is the sites
that ask a plane question in a spelling no search will match.

**B-127 (code analysis is grep-based) should be built before the migration
chunks.** Its first three queries — static type of a subject, symbol flow,
property access through an `any` cast — are exactly what this surface needs,
and B-121 C2 is the evidence for what happens without them. This plan does not
require B-127, but it recommends the sequencing.

### 4.3 Chunk 1 makes the rest strictly additive

Once `bindings` is derived, `entries` is already the storage. The remaining
chunks move call sites from the index to the sequence, then delete the dense
role. Each is mechanical and each lands green.

## 5. Risks

### 5.1 The scan/index crossover — MEASURED at E2, and it moves the policy

Run `npx tsx scripts/bench-slot-lookup.ts`. Two measurements, 2026-09.

**Microbenchmark — lookup and build.** Milliseconds per 2,000,000 operations;
`hit` is the last key, the scan's worst case.

| N | scan hit | map hit | scan miss | map miss | build index | break-even lookups |
|---|---|---|---|---|---|---|
| 1 | 13 | 18 | 14 | 19 | 195 | never |
| 2 | 16 | 15 | 16 | 16 | 143 | 164 |
| 3 | 17 | 15 | 17 | 21 | 149 | 75 |
| 4 | 19 | 15 | 20 | 23 | 172 | 44 |
| 8 | 27 | 14 | 28 | 20 | 461 | 34 |
| 16 | 186 | 14 | 76 | 19 | 1049 | 6 |
| 32 | 688 | 14 | 130 | 18 | 2718 | 4 |
| 64 | 1553 | 13 | 233 | 23 | 5283 | 3 |

The scan wins outright to N=4 and stays within 2× to N=8. Past N=12 the map
dominates. But *building* the index costs 30 to 160 lookups' worth at the
sizes structures actually are, so how often a structure is looked up decides
more than how big it is.

**Corpus measurement — lookups per structure.** Counted by subclassing the
slot map to tally `get`, over the same 29 files.

| | |
|---|---|
| Data structures constructed | **277,378** |
| …never looked up once | **166,558 (60%)** |
| Total data lookups | **5,341,280** |
| Total scope lookups | **13,693** |
| Share of all lookups landing in a scope | **0.3%** |
| Lookups held by the top 10 structures | **68.1%** |

### 5.1a The ruling's revisit trigger has fired

D48(a) said the O(1) requirement belongs to one role and that role is not
data, and it named its own revisit condition: *a measured workload that puts
large by-name lookup on the DATA path rather than the scope path*.

That is what the corpus shows. **Scopes take 0.3% of lookups.** The other
99.7% are on data structures, and the traffic is extraordinarily concentrated:
ten structures hold 68% of it. The hottest is a **three-slot type Context**
(`__name`, `__members`, `__construct`) taking 1.92M lookups by itself. Two
more are the compile context — 227 primitive bindings, `isScope === false`,
immutable — which is a large by-name lookup that is not a scope at all.

**What survives, and what does not.** The ruling's conclusion holds: a scan
beats a map at the sizes that matter, and the hot structures are *small*
(three to five slots), which is exactly where the scan wins. What does not
hold is the reason given for it. Lookups are not rare on data; they are almost
all on data. E is still the right shape, on better evidence than it was ruled
on.

**§6 ruling 3 (index scopes only) is superseded** by §6a. Indexing scopes only
would leave 99.7% of lookups unindexed, including the 227-entry compile
context, and would build indexes for 92 scopes that take 13,693 lookups
between them.

### 5.2 Duplicate keys become expressible rather than accidental

The list holds duplicates today, in 28 structures, as stale write-log entries.
An entry sequence can hold them legitimately. §6 asks whether it should.

Getting this wrong is quiet: if writes stop deduplicating, a stale entry
shadows a current one on a linear scan, exactly as it does in the list today.

### 5.3 Order becomes observable

With one store, iteration order is insertion order, always. Today `bindings`
and `bindingList` can disagree on order (28 structures measured). Some
consumer may depend on the map's order, which is also insertion order but over
a different set. Chunk 1 surfaces this, which is a reason to land it first.

### 5.4 W6 is vacuous, so it protects nothing

Zero dense structures materialize a view in the corpus, so the invariant
guarding view/dense coherence never fires. Deleting it removes no coverage.
This is the C4 lesson from B-121 repeating: **check whether an invariant has a
live subject before treating its deletion as a loss.**

### 5.2 What E3 measured on the real implementation, not the model

The model in §6a predicted the *policy*; these are the numbers the code
actually produces over the 29-file corpus.

| | |
|---|---|
| Slot views allocated | 110,133 |
| Lookups | 4,238,700 |
| …served by a scan | **3,959,000 (93.4%)** |
| …served by an index | 279,700 (6.6%) |
| Indexes built | **268** |
| Mean entries examined per scan | **3.63** |

The shape is what §6a predicted: a scan handles almost everything at under four
entries, and a couple of hundred structures carry the index.

**Wall clock is within noise of the previous representation**, per file:

| file | E3 | main |
|---|---|---|
| `arrays.alg` | 4396 ms | 4374 ms |
| `dot-access.alg` | 1188 ms | 1159 ms |
| `effects-demo.alg` | 49 ms | 51 ms |
| `contracts-demo.alg` | 56 ms | 49 ms |

*A caution recorded because it nearly became a false alarm.* The first E3
reading compared the corpus's **total** wall clock (235 s for 29 full
`evalSource` runs) against §6a's **49 ms**, and read it as a 50× regression.
Those are different quantities: §6a models slot lookup and index construction
alone, not evaluation. Per-file A/B against `main` is the comparison that
answers the question, and it shows no regression.

### 5.3 An empty array needs a flag, which the plan missed

§3.3 said an array is *`entries` with every key null*. True, and not sufficient:
**an empty array and an empty record are then the same object**, so
`getSlotCount` cannot tell "zero elements" from "not a sequence".

E4 keeps one host-plane bit, `Structure.positional`, set by
`newDenseStructure`. It replaces the `dense` **array**, not the question the
array answered. The dense ROLE — a second storage shape with its own
accessors and a materialized legacy view — is what D48(a) deletes; *are these
entries positional?* survives as a boolean, the way `isScope` does.

The flag also buys O(1) indexing. A wholly-positional structure reads
`entries[i]` directly; anything else walks the unkeyed subsequence. A keyed
write clears the flag, because after one the index and the position disagree.
The existing 200-vs-200,000-element scaling test is what holds this honest.

### 5.4 The string-key protocol had consumers after all

E3's write-up said an array's elements being reachable as `bindings.get("0")`
had no consumer, citing E2's measurement that **0 of 166** dense structures
ever materialized their view, and that no `.alg` source indexes an array by
string.

**Both facts were true and the conclusion was wrong.** E2's corpus walk covers
`tests/*.alg`; it does not cover the TypeScript test harness, which read
analyzer output positionally through `bindings.get(String(i))` in three places.
Those broke, and they were right to break — they consume an Allegro array, so
they move to `indexGet`.

One case went the other way and is the more useful half. `grammar-legacy.ts`'s
JSON grammar builds an array-shaped value as a **genuine string-keyed record**
— `"0"`, `"1"`, `"2"`, plus a `length` key — using `makeStructure`. Migrating
it to `indexGet` broke it, because it never was a positional structure.
`bindings.get(String(i))` is *not* reliably the retired array protocol; it is
sometimes an ordinary record read that happens to use numeric keys.

The lesson generalises past this chunk: **a measurement's scope is part of its
claim.** "Zero in the corpus" was reported as "zero", and the gap between those
is where the nine failures lived.

### 5.5 The host-plane audit — E4's open question

At the E4 gate the maintainer challenged `positional` and generalised it: these
properties are type indicators, they will compete with type information at L2
and above, and reasoning over host properties will complicate code generation.
Two routes were named — *two getters, one by index and one by key, with L0
callers knowing what they hold*, and *new `ValueKind` entries if L0 genuinely
needs type information*. This section is the audit that was asked for. It takes
no ruling; §6b records one when it is made.

`Structure` carries seven host-plane fields. They are not one problem.

| Field | Writers | Behavioural readers | What it really is |
|---|---|---|---|
| `immutable` | constructor only | **none** | dead |
| `isScope` | `scopeNew` | 5 | a kind, worn as a flag |
| `parent` | `scopeNew` | 7, all in `scope.ts` | scope payload |
| `scopePredicates` | `scope.ts` | 3, all in `scope.ts` | scope payload |
| `memberPrivilege` | `scope.ts:155` (`as any`) | 1 (`as any`) | scope payload, undeclared |
| `positional` | `newDenseStructure`, `deriveWithMeta`, `putEntry` | 3, all in `structure.ts` | a cache doing a second job |
| `_view` | `structure.ts` | `structure.ts` | a cache, and only that |

**`immutable` is not a property, it is a comment.** It is written once, in the
constructor. Every factory passes `true` — `newRecordStructure`,
`newDenseStructure`, and `deriveWithMeta` by copying. It is read once, to be
copied. Nothing anywhere branches on it. Worse, its documented contract is
false in the field: the header says scopes are mutable, but `scopeNew` calls
`makeStructure`, so **every scope carries `immutable: true`**. A field that has
been wrong on every scope since C4.1 without a single consequence is not
carrying information. D22 is a real rule; this bit is not its enforcement —
the boundary battery is. Deleting it leaves D22 exactly as enforced as it is
today, and costs one slot less on every structure.

**`isScope`, `parent`, `scopePredicates` and `memberPrivilege` are one
property, not four.** Every one is written only by the scope constructors and
read only when the structure is a scope. And the five `isScope` reads outside
`scope.ts` all ask the same question in the same shape — *skip this, it is not
data* (`resolveDataSlots`, `hasPendingFutureSlot`, `collectSymbolRefs`) or
*refuse this, it is not data* (`deriveWithMeta`, `assertNotScope`).

This one is **not** a type indicator, and it will never compete with L2. A
scope is not a value of any type; it is evaluator state stored in the value
representation. No L2 type can ever answer "is this a scope", so nothing is
being duplicated — a kind distinction is simply being carried as a boolean.
That is precisely the maintainer's second route, and it lands well here:
`ValueKind.Scope` would collapse four fields into one tag, move the three
payload fields onto a `Scope` class that data structures stop paying for,
retire an `as any` expando that appears in no interface, and turn
`if (!ctx.isScope)` into a switch the compiler can check exhaustively — the
same "enumeration by compiler, not grep" property E1 and E3 both relied on.

It also **reopens D25**, which ruled the other way: *Scope is the
evaluation-environment ROLE of the shared substrate … the Context kind-name
retires*. `types.ts` records that ruling inside the enum itself. This is a
decision-register change and a maintainer call; the case is stated here and
goes no further.

**`positional` is the real instance, and the prediction has already come
true.** The field is not on `StructureValue` or `StructureHostFields` — only
`structure.ts` reads it, through a cast — so the *property* does not leak. Its
*effect* does, because `getSlotCount` returns `undefined` for a non-positional
structure and two callers use exactly that as a type test:

- `grammar2/builder.ts:83` — `if (!lengthV) throw "value is not an Array (no
  length slot)"`. A type test written against a storage bit.
- `types-std.ts:3647` — `// Array-like Context`, then `lenV?.kind === Bits` to
  decide whether to key a cache as an array.

The other eleven callers do not: they already hold an array and write
`?? makeInt(0)`. So eleven sites are the case the maintainer describes — the
caller knows what it has — and two are shape tests that should be asking the
type. One of those two is the awkward one: `grammar2/builder.ts` is **L1**,
which validates a user-supplied argument and has no type system to ask.

**What the two-getters route means concretely.** The two getters already exist
— `indexGet` by index, `bindings.get` by key. What is missing is a *count*:
`getSlotCount` conflates "how many positional entries" with "is this positional
at all" by overloading `undefined`. Split it and the problem dissolves:

- `positionalCount(ctx): number` — always answers, `0` for a record. Serves all
  eleven knowing callers with no flag involved.
- the two shape tests move to whatever L1 argument validation becomes.

Then `positional` survives only as an **optimisation**: `entries.every(e =>
e.key === null)`, cached, keeping `denseIndexGet` and the count O(1) instead of
O(n). Private, unexported, wholly derivable — the same status as `_view`, and
defensible on exactly the terms `_view` is. §5.3's argument that an empty array
and an empty record are indistinguishable turns out to be an artefact of the
overload, not a fact about the representation: `positionalCount` answers `0`
for both, which is **correct** for both. The array/record distinction leaves L0
entirely and moves to the type, which is where the maintainer said it belongs.

One thing is genuinely lost: `grammar2/builder.ts` stops rejecting a record
passed where an array is expected, and reads it as empty instead. That is a
diagnostic, not a semantic — and it is a type error that L2 should be catching.
It should not be paid for with a storage bit.

**The code-generation argument, stated at full strength.** A generator emitting
from `entries` must know whether index `i` means `entries[i]`. If that answer
lives in a host bit, the generator has to model the interpreter's private
state — a side channel outside both the value and its type. If it is derived
from the entry sequence, the generator reads the same thing the specification
says a composite *is*, and needs no side channel at all. The identical argument
applies to scopes: a generator asking "is this `Structure` a scope" is
reasoning about the interpreter, while one that sees `ValueKind.Scope` is
reasoning about the program. The argument points the same way in both cases,
which is the reason to treat them as one audit rather than two fixes.

**Recommendation, and where each item went.** Three separable items, none of
them E4's deliverable. E4 merged as it stood — its deliverable is sound
independently of all three, and the flag it introduced is no worse than the
`dense` array it replaced.

1. `positional` — split `getSlotCount` into an always-answering
   `positionalCount`, move the two shape tests, demote the flag to a private
   derived cache. → **B-133**.
2. `immutable` — delete, or give it a reader. D22 is unaffected. → **B-134**.
3. Scope — **ruled 2026-09 as D49**: a scope leaves `Value` entirely and
   becomes a non-value L0 host construct. → **B-136**. §5.6 records the
   argument.

The maintainer generalised the audit at the same gate — *we may want to define
some tighter rules to validate host-plane properties and design across all L0
types* — which is **B-135**. The plane turns out to exist on almost every
representation (`Binding` carries four such fields, `ParamValue` five,
`PrimitiveFunctionValue` three) with no stated rule for what may live there,
and a second survey (§5.7) found it is far larger than the declared fields:
**185** property accesses through `as any` reach a field declared nowhere.

### 5.6 Scope is not a value — the argument behind D49

The question was posed as *value versus non-value L0 construct*. Three options
were on the table: keep Scope as a role of `Structure` (the D25 status quo),
make it `ValueKind.Scope` (a kind in the tower, non-denotable, on the `Param`
precedent), or take it out of `Value` entirely with its own host type. The
maintainer ruled the third.

**Two of the three original motivations for scope-as-value already shipped
without it.** The design intent recorded at the gate was that extensions could
define custom scope kinds — packages, namespaces, dynamic scoping — and that
member access would be mediated by *(member key, owner, calling scope)*. The
second exists today: `assertMemberAccessible(type, fieldName, ctx, desc)` is
that signature, and `typePrivilegedCtx` plants the kernel-minted privilege
layer the check walks. D42's *evidence is possession* is its executed form.
The scope is threaded implicitly down the evaluation chain rather than reified
as something user code holds — which is the only difference, and it is the
difference V-R2 already required: *the mediation context is an opaque,
kernel-minted evidence capsule … never the raw scope*.

**What survives is the extensibility motivation**, and the maintainer's ruling
sets it aside as unjustified for now: no use case demands custom scope
behaviour, and the feature is confusing and forgery-prone. If one arises, the
expected route is extending the Scope host type with optional functionality,
not readmitting Scope to `Value`.

**The arguments against valuehood, in the order they carry weight:**

- **The code already spends effort undoing it.** `assertNotScope` is a runtime
  guard; `deriveWithMeta` throws a plane rejection; `resolveDataSlots`,
  `hasPendingFutureSlot` and `collectSymbolRefs` each branch to skip scopes.
  Five sites whose whole job is saying *this is not really a value*. Off the
  `Value` union they become unrepresentable rather than checked.
- **Metadata is meaningless on a scope.** D48(b) put `meta` on every kind, and
  metadata is a property of a value *in a position*. A scope has no position.
- **Mutability.** D22 says born-immutable and scopes are the standing
  carve-out — a value category with one mutable member.
- **Cost on every data structure.** Scopes need `parent`, `isScope`,
  `scopePredicates`, `memberPrivilege`, `compileMode` and host-key expandos
  (`futureManager`, read through `scopeHostRead`) — six scope-only concerns on
  the class every record, array and type instance also pays for, three of them
  undeclared.
- **Code generation**, the concern that opened the audit: a generator emitting
  for a structure should not have to ask *but is this one a scope?*

**The fact that settled it.** No scope ever reaches user code as a value.
There is no `scope_new` or `scope_extend` primitive; nothing returns a ctx as
an Allegro result. Scope-as-value pays every cost of valuehood and collects
the one benefit — extensibility — that the ruling declines.

**What D49 does not disturb.** D25's substance stands apart from its
representation clause: a scope is a distinct protocol (parent-chain
resolution, forward chaining, the facts plane), and the `Context` kind-name
stays retired. Only *shared substrate, distinct role* is superseded.

### 5.7 The host plane is larger than its declaration, by an order of magnitude

The maintainer set the target at the same gate: *eliminate ALL weak typing
(`as any` etc.) in the L0 host implementation*. A scan of `src/` (excluding
the generated `parser.ts`) found **399** `as any` occurrences, of which 305
are property accesses. Classified against `src/types.ts`:

- **120 reach a field that IS declared** on a narrower type — `name`, `data`,
  `position`, `args`, `fn`, `_name`, `effectBound`, `effectVar`, `kind`.
  These are narrowing casts written as `any`, and each is mechanically
  replaceable with the real type.
- **185 reach a field declared nowhere in `types.ts`.** `genericParams` (19),
  `abstractDomain` (14), `inferredEffects` (9), `localMemberScope` (7),
  `_tailPosition` (6), `ownerShape` (5), `memberNameIndex` (5),
  `hasPrivateMembers` (5), `grammarValue` (5), `decreasesMetric` (4),
  `compileMode` (4), `grammarFragment`, `grammarHandle`, `memberPrivilege`,
  and a long tail. Of the top counts only `attribute` (39) is not an L0 value
  at all — it is `grammar-ext.ts`'s phrase-builder API.

**Correction, from executing B-137's mechanical half.** Two of those counts
were misclassified in both directions, and fixing them changes the picture.
`effectBound` and `grammarFragment` ARE declared in `types.ts` — on
`ParamValue` and `Extension` — but the sites counted as declared read them off
a `Structure`. Same name, different owner: those are expandos.

Recounting the 185 against `src/slots.ts` as well as `types.ts`: **79 reach a
property that IS declared, in the SLOT_REGISTRY, as a `js-property`
storage** — `genericParams`, `abstractDomain`, `inferredEffects`,
`grammarValue`, `compileMode`, `decreasesMetric` among them. Only **106** are
declared in neither place.

So the host plane already has a partial census; what it lacks is a TypeScript
declaration. That narrows B-135's job considerably — for 79 of these the
question is not *what is this property* but *why does the registry know and
the type not*.

So §5.5's *seven host-plane fields on `Structure`* was an undercount of the
plane, not of the class. The declared host plane is a small, reviewed subset
of a much larger undeclared one that exists only in `as any` expressions,
which is why B-135 needs the census before it can state a rule.

**One structural finding, verified.** `Structure` (the class) and
`StructureValue` (the interface) are the same object, and `structure.ts`
bridges them with six `as unknown as Structure` double casts. Adding
`implements StructureValue` to the class typechecks clean, and every double
cast then collapses to a single one. Probed and reverted — it belongs to
B-137, not here.

Two other forms are worth the census: **43** `as unknown as` double casts, and
**225** bare `: any` annotations outside catch clauses. There are no
`@ts-ignore` or `@ts-expect-error` suppressions anywhere in `src/`.

## 6. Rulings — taken 2026-09-01

All five recommendations accepted by the maintainer as written.

1. **`entries` is the authoritative store**; `bindings` becomes a derived,
   cached index (§4.1). The alternative — keep the map authoritative and derive
   the list — would have preserved the hot path but left null-key entries
   unrepresentable, which is the thing §2.2 shows the code already needs.

2. **Duplicate keys are not legal.** A keyed write replaces its entry in place;
   positional entries append. The 28 duplicates measured today are stale
   write-log residue, not intent, so nothing is designed for them.

3. ~~**Index scopes only**, revisited on the §5.1 benchmark at E2.~~
   **SUPERSEDED by §6a** — the E2 benchmark revisited it, as the ruling
   anticipated, and the measurement went the other way.

4. **E1 lands as its own PR** under B-120. It fixes a measured defect affecting
   2254 structures and depends on nothing else in the arc, so it is not gated
   on the representation change.

5. **B-127 (code analysis is grep-based) comes before the call-site
   migration**, with this arc as its first customer. An ordering, not a
   dependency: E1 does not need it, and E4 onward does.

## 6a. The index policy — measured at E2, awaiting ratification

§6 ruling 3 said index scopes only, and reserved the question for this
benchmark. The benchmark reopened it (§5.1a), and the maintainer's question —
*why not trigger on count and size?* — is what produced the answer below.

**Proposed: build the index lazily on first lookup, if the structure has more
than 8 entries. No counting.**

### Every policy costed against the corpus

Total lookup and index-construction time for all 277,378 data structures,
modelled from the per-operation costs in §5.1 and the measured
`(size, lookups)` of every structure. The counter's own cost is charged at the
measured **1.79 ns per lookup** — 9.5 ms across the corpus's 5,341,280 data
lookups.

| Policy | Total | Indexes built |
|---|---|---|
| **Lazy, size > 8, no counter** | **49.1 ms** | **86** |
| Lazy, size > 16 | 49.1 ms | 83 |
| Lazy, size > 6 | 49.1 ms | 129 |
| Count ≥ 16 | 55.2 ms | 832 |
| Count ≥ 32 | 57.7 ms | 772 |
| Count ≥ 32 **and** size > 4 | 61.2 ms | 708 |
| Always index (today) | 74.8 ms | 277,347 |
| Never index | 771.0 ms | 0 |

### Why counting loses

The counter taxes **every** lookup to sharpen a decision that size already
predicts. 5.34M lookups at 1.79 ns is 9.5 ms, which is more than counting ever
recovers. Size is free: the structure already knows how many entries it has.

This retires §6a's earlier open question — *does the counter pay for itself?*
Measured, it does not.

### Why the count-and-size conjunction loses too

It inherits the counter's cost and adds a second gate that mostly removes
indexes worth building. At 61.2 ms it is the most expensive of the
count-based options.

### Why no count-based rule can win, however well graded

Raised in review: a *graded* rule tracking the break-even boundary — something
like `(N>8 && C>32) || (N>7 && C>35) || … || (C>100)` — rather than the flat
conjunction costed above. It is the better shape, and it still cannot win. The
bound closes the whole family, so this is settled rather than merely untuned.

| | |
|---|---|
| Oracle — index exactly when it pays, with foreknowledge | **43.3 ms** |
| Lazy size > 8 | **49.1 ms** |
| Headroom any smarter rule could recover | **5.8 ms** |
| Cost of the counter it would need | **9.5 ms** |

A graded curve approaches the oracle's *decisions*, but it must read `C`, and
reading `C` costs 1.79 ns on every one of 5,341,280 lookups. Its floor is
therefore 43.3 + 9.5 = **52.8 ms** — worse than the flat size gate, and worse
before any tuning is applied. That is why every count policy measured landed
between 55 and 61 ms: they were not badly chosen, they were paying a tax
larger than the prize.

**The tuning stops here**, and it stops on a bound rather than on a judgement
that the numbers are good enough.

### The threshold is not a tuning knob

Every threshold from 6 to 64 costs 49.1–49.2 ms. The choice is flat because
**the case for an index rests on a handful of structures**: 86 of 277,378, and
one of them — the 227-entry compile context — is most of it. Eight is chosen
because 97% of structures hold eight entries or fewer, so the rule reads as
*index the exceptions*.

### The correction this makes to §5.1a

§5.1a argued that no size threshold could work, because the hottest structure
in the corpus has three slots. That argument was wrong, and the numbers say so:
indexing that structure saves **1.92 ms** across its 1.92M lookups, because at
size 3 a scan and a map lookup differ by about a nanosecond. Being hot and
being worth indexing are different properties, and only the second one matters.

### What "never index" would cost, since the option was raised

771 ms against 49 ms — but **~600 ms of that is one structure**, the compile
context, scanned 219,000 times at 227 entries. Deferring the index entirely is
survivable and would be dominated by a single object, which is worth knowing if
the arc is ever paused mid-way.

## 7. Chunk sequence

Provisional — the maintainer sets the boundaries (W-001).

| Chunk | Delivers | Gate |
|---|---|---|
| **E1** | One write path (`putEntry` / `setEntry` / `removeEntry`); every Structure writer routed through it, so both containers hold one object. The 2254 divergences go to zero | **DONE 2026-09.** Suite 1202/1202. W7 slot-store-coherence added and verified to fail on the reintroduced defect. Deriving the map from `entries` moves to E3, where the index policy is set |
| **E2** | Benchmark the scan/index crossover (§5.1); set the index policy from the result | **DONE 2026-09.** `scripts/bench-slot-lookup.ts` committed and its results recorded in §5.1. The measurement fired D48(a)'s own revisit trigger (§5.1a) and supersedes §6 ruling 3; §6a proposes the replacement policy and awaits ratification. No behaviour change |
| **E3** | `bindings` becomes derived from `entries` (moved here from E1), and the §6a policy is implemented: build lazily on first lookup when size > 8 | **DONE 2026-09.** Suite 1202/1202. `SlotView` replaces the stored map; measured on the real implementation, **93.4%** of 4.24M lookups are served by a scan averaging **3.63** entries and 268 indexes are built. Per-file wall clock within noise of main (§5.2) |
| **E4** | The dense role collapses into `entries`. `newDenseStructure` becomes a sequence with null keys; `denseIndexGet` / `denseSlotCount` / `denseElements` lose their dead fallbacks | **DONE 2026-09.** Suite 1202/1202. `dense`, `materializeView`, `viewMaterialized`, `slotCountBits`, `__length`, `isDense` and **W6** all deleted — E5's list arrived with the region rather than after it. Two things the plan did not anticipate: §5.3 (the positional flag) and §5.4 (the string-key protocol had consumers) |
| **E5** | ~~Delete `materializeView`, `viewMaterialized`, `__length`, W6~~ **done at E4** — they went with the region. E5 is now only `isMetaSlotKey`, whose last key (`__length`) is gone. Closes **B-104(b)**; B-104(f) closed at E4 | Counts to zero; boundary lint at baseline |
| **E6** | `concepts.md` §12 (structure roles), §16 (dense region), §17 (the legacy view) and IC-2 updated; deltas 17 and 22 closed | doc-ref lint; spine delta rows read `—` |

**Completion test**: `dense` 0, `__length` 0, `isMetaSlotKey` 0, `bindingList`
0 as a separate store, and `concepts.md` §16 and §17 retired the way §10 was.

The host-plane audit (§5.5) raised three follow-on items. Only the first is
this plan's business — `positional` is E4's own surface — and it is proposed
as a chunk after E6 rather than a reopening of E4. The other two (`immutable`,
and scope as a `ValueKind`) belong to the backlog and the decision register
respectively, and wait on a ruling.

## 8. What this plan is not

It is **not** a performance arc. The allocation and lookup shapes change, and
§5.1 requires a benchmark before the index policy is set, but no chunk is
justified by a speed claim. The justification is R7 — the distance between
what the specification says a composite is and what the implementation makes
it — plus one measured defect (§2.1) that the change removes by construction.

It is **not** a scope redesign. Scopes keep their parent chain, their
predicates and their mutability. Only where their index lives changes. §5.5
records an argument for making Scope a `ValueKind`, which would be exactly such
a redesign; it is stated there so it is not lost, and it is not carried here.
