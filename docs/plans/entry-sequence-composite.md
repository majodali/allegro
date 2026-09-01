# The entry-sequence composite — one storage, an index below the spec

> Status: **draft** — awaiting ratification of §6.
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

### 5.1 The scan/index crossover is measured, not assumed

The plan claims a scan beats a `Map` at 2.85 entries. That is the ruling's
premise and this plan's §2 confirms the size distribution, but neither
measures the crossover directly. **Chunk 2 must benchmark it** before the
index is restricted to scopes. If the crossover sits below the observed mean,
the index policy changes and nothing else in the plan does.

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

## 6. Open questions — for ratification before chunk 1

1. **Which store is authoritative during migration?** Recommendation: `entries`
   is the store and `bindings` becomes a derived cached index (§4.1). The
   alternative — keep the map authoritative and derive the list — preserves
   the hot path but keeps the null-key entries unrepresentable.

2. **Do duplicate keys stay legal?** Recommendation: no. A keyed write replaces
   the entry in place; positional entries are appended. The 28 duplicates today
   are stale write-log residue, not intent. Ruling this now avoids designing
   for a case nobody wants.

3. **Index policy.** Recommendation: index scopes only, and revisit on the
   §5.1 benchmark. The alternative is a size threshold on any structure, which
   is more general and harder to reason about.

4. **Is chunk 1 its own deliverable?** It fixes a measured defect affecting
   2254 structures and does not depend on the rest of the arc. Recommendation:
   land it as its own PR under **B-120**, so the fix is not gated on the
   representation change.

5. **Sequencing against B-127.** Recommendation: build B-127's analysis before
   the call-site migration (§4.2), and treat this arc as its first customer.
   This is a recommendation about order, not a dependency.

## 7. Chunk sequence

Provisional — the maintainer sets the boundaries (W-001).

| Chunk | Delivers | Gate |
|---|---|---|
| **E1** | `bindings` becomes a derived cached index over `entries`; `slotWrite` writes one object. The 2254 divergences go to zero | Suite green; a new battery test asserts map and list agree for every corpus structure |
| **E2** | Benchmark the scan/index crossover (§5.1); set the index policy from the result | Bench recorded in the plan; no behaviour change |
| **E3** | Scope index: built and invalidated at `scopeExtend` / `addBinding`; data structures stop carrying one | Suite green; scope-heavy bench no worse |
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
