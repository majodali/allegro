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
| **E3** | `bindings` becomes derived from `entries` (moved here from E1), and the §6a policy is implemented: build lazily on first lookup when size > 8 | Suite green; `scripts/bench-slot-lookup.ts` re-run; corpus lookup cost no worse than the 49.1 ms §6a models |
| **E4** | The dense role collapses into `entries`. `newDenseStructure` becomes a sequence with null keys; `denseIndexGet` / `denseSlotCount` / `denseElements` lose their dead fallbacks | Suite green; array demos are the oracle |
| **E5** | Delete `materializeView`, `viewMaterialized`, `__length`, W6 and `isMetaSlotKey`. Closes B-104(b) and B-104(f) | Counts to zero; boundary lint at baseline |
| **E6** | `concepts.md` §12 (structure roles), §16 (dense region), §17 (the legacy view) and IC-2 updated; deltas 17 and 22 closed | doc-ref lint; spine delta rows read `—` |

**Completion test**: `dense` 0, `__length` 0, `isMetaSlotKey` 0, `bindingList`
0 as a separate store, and `concepts.md` §16 and §17 retired the way §10 was.

## 8. What this plan is not

It is **not** a performance arc. The allocation and lookup shapes change, and
§5.1 requires a benchmark before the index policy is set, but no chunk is
justified by a speed claim. The justification is R7 — the distance between
what the specification says a composite is and what the implementation makes
it — plus one measured defect (§2.1) that the change removes by construction.

It is **not** a scope redesign. Scopes keep their parent chain, their
predicates and their mutability. Only where their index lives changes.
