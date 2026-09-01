// =============================================================================
// Structure — the unified host representation (structures Phase 4, C4.1–C4.2 / B-019–B-020)
//
// Design (docs/design/allegretto/structures.md §2, I1): an instance is
// (shape ref, flat slot storage, metadata storage, immutable bit, optional
// dense region). C4.1 landed the KIND: every composite value is an
// instance of ONE host class, constructed exclusively through the
// types.ts factories (`withMeta` / `makeStructure` / `makeDenseArray`
// are the shims the plan promised). The public field surface is unchanged
// (the ~1000-test suite is the oracle) — the object layout is a single
// declared hidden class, and every later physical change happens inside
// this module.
//
// C4.2 lands the DENSE REGION (D18: arrays are numeric-keyed structures):
// array contexts store their elements in a plain JS array (`dense`) — no
// per-element Binding objects, no string keys, no `__length` binding. The
// slot count IS `dense.length`. Compatibility: `bindings`/`bindingList`
// are accessor-backed; for a dense structure the legacy map view is
// MATERIALIZED LAZILY on first access (and then cached — arrays are
// immutable, D22, and recon confirmed zero post-construction numeric
// mutations). Hot paths use the slots.ts `indexGet`/`getSlotCount`
// accessors and never materialize the view; stragglers (reflection,
// struct-destructure patterns, walkers) hit the view once per array and
// behave exactly as before. The W6 invariant asserts view/dense
// coherence whenever a view exists.
//
// Role is FIXED at construction (a carrier never becomes a record);
// `kind` is a plain field so the evaluator's hot switch is unaffected.
// There are FOUR planes (docs/design/concepts.md §18), and three of them
// are stored here:
//   - data plane     → `bindings` + `bindingList` (+ `dense` for
//     numeric-keyed structures). B-121 C5 deleted `dataOf`, the accessor
//     that used to project it: a value's data IS the value now
//   - binding plane  → the same maps, keyed by NAME: what a scope
//     resolves and what a type's members hang off
//   - metadata plane → `meta` (carrier role; every key is
//     registry-checked by the W3 walker)
//   - host plane     → NOT part of the value: `parent`, `isScope`,
//     `scopePredicates` (declared as `StructureHostFields` in types.ts)
//     and `viewMaterialized`
// The one binding-plane/metadata straggler is `__length` on a
// materialized dense view — B-104(f), gated on B-108.
//
// Immutable bit (D22): structures are born-immutable BY DEFAULT; the bit
// is DECLARED state at C4.1, with the standing carve-outs enforced by the
// boundary battery rather than by freezing (enforcement tightens at C4.3):
//   - evaluation scopes are mutable evaluator state (not data — plane
//     split, C2.1);
//   - future cells are single-assignment monotonic (D33) — a pending
//     cell inside an immutable structure does not violate deep
//     immutability (the D22 carve-out);
//   - construction-phase population (addBinding after makeStructure) is
//     the grandfathered builder idiom until construction protocols
//     migrate (C6 recipe).
//
// THE IN-PLACE RULE (B-121 C7, plan §3.4). The carve-out above is an
// instance of a general rule, stated here because it was previously an
// idiom in two places and a rule in none:
//
//     Write in place only while the value is provably UNSHARED — during
//     construction, before it escapes. After it escapes, derive.
//
// It is not a style preference; it follows from one measurement. Of 59,027
// metadata attachments, 19,817 (33.6%) target an object that has ALREADY
// been given metadata. Metadata is a property of a value *in a position*,
// not of the datum, so a post-escape in-place write would overwrite the
// first stamp at every position holding that value. (A side table keyed by
// the object fails identically, since its key is the object.) D22 is the
// rule adopted BECAUSE of this, and the pre-escape window is the one place
// the argument does not apply.
//
// The other instance is `writeShape` in slots.ts, which states its own
// version of this argument for identity-sensitive type Contexts.
// =============================================================================

import type { Value, Binding, StructureValue, BitsValue } from "./types.js";
import { ValueKind, makeInt } from "./types.js";

/** The one host representation behind every composite value. All fields
 *  are declared up front so every structure shares a single hidden class
 *  (the I1 motivation), whichever role it plays. */
export class Structure {
  // C7.1 (D15/D46): ONE kind. B-121 C4 deleted the CARRIER configuration —
  // `primary`, its constructor initializer, the two empty-view branches on
  // the binding getters, `isCarrier` and `newCarrierStructure`. A composite
  // is the only role left, so a Structure is now what its name says.
  kind: ValueKind.Structure;

  // --- Metadata plane (universal since C2: every kind carries one) ---
  meta: Map<string, Value>;

  // --- Context role (record/type/scope: slot plane) ---
  /** THE slot store (B-120 E3): an ordered sequence of optionally-keyed
   *  entries. The map that used to sit beside it is now derived — see
   *  `SlotView` and the `bindings` getter. */
  entries: Binding[];
  /** Cached derived view over `entries`. One per structure, built on first
   *  `.bindings` access, so the 60% of structures never looked up allocate
   *  nothing (B-120 E2 measurement). */
  private _view?: SlotView;

  /** Host plane: these entries are POSITIONAL — every one unkeyed, so index
   *  `i` is `entries[i]` and the slot count is `entries.length`. Set by
   *  `newDenseStructure`; cleared the moment a keyed entry is written, which
   *  drops positional reads onto the general subsequence path.
   *
   *  B-120 E4: this replaces the `dense` array. The dense ROLE — a second
   *  storage shape with its own accessors and a materialized legacy view —
   *  is what D48(a) deletes. The QUESTION it answered, *are these entries
   *  positional?*, survives as one host-plane bit, the way `isScope` does.
   *  Without it an empty array and an empty record are the same object. */
  positional?: boolean;

  // --- Scope-role fields (C2.1/C2.2; host-plane, never value slots) ---
  parent?: StructureValue;
  isScope?: boolean;
  scopePredicates?: Map<string, unknown>;

  // --- C4.1 substrate ---
  /** D22: born-immutable by default. Scopes (evaluation state) are
   *  mutable; future cells are the sanctioned monotonic exception. */
  immutable: boolean;

  constructor(immutable: boolean) {
    this.kind = ValueKind.Structure;
    this.meta = undefined as unknown as Map<string, Value>;
    this.entries = undefined as unknown as Binding[];
    this._view = undefined;
    this.positional = undefined;
    this.parent = undefined;
    this.isScope = undefined;
    this.scopePredicates = undefined;
    this.immutable = immutable;
  }

  /** The by-name view over `entries` — DERIVED, not stored (B-120 E3).
   *  Cached per structure and built on first access. */
  get bindings(): SlotView {
    let v = this._view;
    if (v === undefined) v = this._view = new SlotView(this);
    return v;
  }

  get bindingList(): Binding[] { return this.entries; }
  set bindingList(l: Binding[]) {
    this.entries = l;
    this._view = undefined;
  }

  /** Invalidate the derived view after a write to `entries`. */
  invalidateView(): void { this._view?.invalidate(); }
}

/**
 * The by-name view over a Structure's entries (B-120 E3).
 *
 * Reads satisfy the `ReadonlyMap` surface the 193 `.bindings` call sites
 * already use, so nothing above this file changed. What changed is beneath:
 * there is no stored map. A lookup SCANS the entries, and builds a hash index
 * only when the structure is big enough for the index to repay its
 * construction.
 *
 * THE INDEX THRESHOLD (plan §6a, ruled 2026-09 on measurement).
 *
 * Costed over all 277,378 data structures the corpus builds, against the
 * per-operation numbers in `scripts/bench-slot-lookup.ts`:
 *
 *   lazy, size > 8, no counter    49.1 ms      86 indexes
 *   count >= 16                   55.2 ms     832
 *   count >= 32 AND size > 4      61.2 ms     708
 *   always index (the old code)   74.8 ms  277,347
 *   never index                  771.0 ms       0
 *
 * Counting lookups loses, and no graded count rule can win: reading a counter
 * costs 1.79 ns on every one of 5.34M lookups (9.5 ms), while the entire gap
 * between this policy and a perfect oracle is 5.8 ms. The tax exceeds the
 * prize, so size alone decides.
 *
 * The threshold is not a tuning knob — every value from 6 to 64 costs the
 * same 49.1 ms, because 86 structures of 277,378 carry the whole case for an
 * index and one of them (the 227-entry compile context) is most of it. Eight
 * is chosen because 97% of structures hold eight entries or fewer, so the rule
 * reads as *index the exceptions*.
 */
const INDEX_THRESHOLD = 8;

export class SlotView implements ReadonlyMap<string, Binding> {
  private _index?: Map<string, Binding>;
  private _size = -1;
  constructor(private readonly s: Structure) {}

  /** Dropped when `entries` is written; rebuilt on the next lookup. */
  invalidate(): void { this._index = undefined; this._size = -1; }

  private index(): Map<string, Binding> | undefined {
    const es = this.s.entries;
    if (es.length <= INDEX_THRESHOLD) return undefined;
    let ix = this._index;
    if (ix === undefined) {
      ix = this._index = new Map<string, Binding>();
      for (let i = 0; i < es.length; i++) {
        const k = es[i].key;
        if (k !== null) ix.set(k, es[i]);
      }
    }
    return ix;
  }

  get(key: string): Binding | undefined {
    const ix = this.index();
    if (ix !== undefined) return ix.get(key);
    const es = this.s.entries;
    for (let i = 0; i < es.length; i++) if (es[i].key === key) return es[i];
    return undefined;
  }

  has(key: string): boolean { return this.get(key) !== undefined; }

  get size(): number {
    if (this._size < 0) {
      const es = this.s.entries;
      let n = 0;
      for (let i = 0; i < es.length; i++) if (es[i].key !== null) n++;
      this._size = n;
    }
    return this._size;
  }

  *keys(): MapIterator<string> {
    for (const e of this.s.entries) if (e.key !== null) yield e.key;
  }
  *values(): MapIterator<Binding> {
    for (const e of this.s.entries) if (e.key !== null) yield e;
  }
  *entries(): MapIterator<[string, Binding]> {
    for (const e of this.s.entries) if (e.key !== null) yield [e.key, e];
  }
  [Symbol.iterator](): MapIterator<[string, Binding]> { return this.entries(); }
  forEach(f: (v: Binding, k: string, m: ReadonlyMap<string, Binding>) => void, thisArg?: unknown): void {
    for (const e of this.s.entries) if (e.key !== null) f.call(thisArg, e, e.key, this);
  }
  get [Symbol.toStringTag](): string { return "SlotView"; }
}

/** Construct the Context role. Scopes are mutable evaluator state; data
 *  contexts carry the immutable bit (population-during-construction is
 *  the grandfathered builder idiom until the C6 recipe). */
export function newRecordStructure(): Structure {
  const s = new Structure(true);
  s.entries = [];
  return s;
}

/** C4.2: construct a dense numeric-keyed structure (array context). The
 *  element array is adopted, not copied — callers hand over ownership
 *  (arrays are immutable, D22). */
export function newDenseStructure(elements: Value[]): Structure {
  // B-120 E4: an array IS the entry sequence, with every key null. The dense
  // role is gone — it was a second storage shape for the one case the
  // sequence always described, and D48(a)'s level tag said so all along.
  const s = new Structure(true);
  const entries: Binding[] = new Array(elements.length);
  for (let i = 0; i < elements.length; i++) entries[i] = { key: null, value: elements[i] };
  s.entries = entries;
  s.positional = true;
  return s;
}

/** C4.3b: copy-on-write derive — a new Context-role structure SHARING the
 *  source's data planes by reference (sound: data contexts are immutable,
 *  D22) with the given channel plane attached. This is how channels attach
 *  to records/types without a MultiValue wrapper: `withMeta` with a
 *  Context primary flattens through here, so MV-over-Context is
 *  unconstructible. Scopes are evaluator state, not data — the channel
 *  plane never attaches to them (C2.1 plane rejection). */
export function deriveWithMeta(ctx: StructureValue, meta: Map<string, Value>): Structure {
  const src = ctx as unknown as Structure;
  if (src.isScope) {
    throw new Error("deriveWithMeta: channels cannot attach to an evaluation scope (plane rejection)");
  }
  const s = new Structure(src.immutable);
  // Shares the entry array by reference — sound because data contexts are
  // immutable (D22). The derived view is per-structure and rebuilds.
  s.entries = src.entries;
  s.positional = src.positional;   // metadata does not stop an array being one
  // The given map is AUTHORITATIVE — it becomes the derived structure's
  // entire channel plane. Writers pre-clone via cloneMeta (total, so
  // a flattened source's channels are in the clone) and then set/delete;
  // merging here instead would make channel deletion (clearOccurrenceBound)
  // impossible. Callers overlaying a partial map onto an already-channeled
  // Context must clone-and-extend themselves (see evaluate's MV rebuild).
  s.meta = meta;
  return s;
}

// POSITIONAL ACCESS (B-120 E4).
//
// A positional structure is one whose entries carry no key. The three readers
// below lost their fallback arms with the dense region: those arms served
// numeric STRING keys ("0", "1", …) on a non-dense structure, and the corpus
// has **zero** of those — the fallback was dead before it was deleted.
//
// `__length` goes with them. An array's length is `entries.length`; it was
// only ever a derived slot the materialized view had to emit.

/** The i-th positional entry's value. O(1) on a wholly-positional structure,
 *  which is what an array is; a subsequence walk otherwise. */
export function denseIndexGet(ctx: StructureValue, i: number): Value | undefined {
  const s = ctx as unknown as Structure;
  const es = s.entries;
  if (s.positional === true) return es[i]?.value;
  let n = 0;
  for (let j = 0; j < es.length; j++) {
    if (es[j].key === null && n++ === i) return es[j].value;
  }
  return undefined;
}

/** Slot count for a positional structure, or undefined when it is not one.
 *  An EMPTY array still answers 0 — which is why the flag exists rather than
 *  the count being inferred from the entries. */
export function denseSlotCount(ctx: StructureValue): Value | undefined {
  const s = ctx as unknown as Structure;
  if (s.positional !== true) return undefined;
  return makeInt(s.entries.length);
}

/** All values of a positional structure. */
export function denseElements(ctx: StructureValue): Value[] {
  const s = ctx as unknown as Structure;
  const es = s.entries;
  const out: Value[] = [];
  for (let i = 0; i < es.length; i++) if (es[i].key === null) out.push(es[i].value as Value);
  return out;
}

/** Is this value an instance of the unified representation? The W4
 *  boundary invariant asserts this for every MultiValue/Context reachable
 *  from the test corpus — a stray object literal fails the battery. */
export function isStructure(v: unknown): v is Structure {
  return v instanceof Structure;
}

// =============================================================================
// THE ENTRY WRITE PATH (B-120 chunk E1)
//
// A Structure's slot plane was TWO stores that had to be kept in step by
// convention: a `Map` and an array, written by adjacent lines. `slotWrite`
// allocated a separate `{ key, value }` object for each, so the two held
// different objects for the same slot and a write through one was invisible
// to the other. E1 made every write go through one path; E3 deleted the
// second store outright, so `entries` is the slot plane and the map is a
// derived view (`SlotView`).
//
// Measured over the 29 self-contained `tests/*.alg` files: **2254 of 2540**
// record structures held different objects for one slot; 28 had stale
// duplicate entries in the list; 15 had entries the map held and the list did
// not. Anything iterating the list saw a different structure from anything
// iterating the map. That is delta 49 (C9), and these three functions are the
// single place a slot is written from now on.
//
// The plan is `docs/plans/entry-sequence-composite.md`. E1 fixes the
// divergence without changing the representation; later chunks make the
// sequence the storage and the map an index below the specification.
// =============================================================================

/**
 * Write a slot: replace the entry under `key` if one exists, otherwise
 * append. **One `Binding` object goes into both stores**, which is what
 * makes them agree.
 *
 * Duplicate keys are not legal (plan §6 ruling 2). A keyed write replaces
 * in place rather than appending a second entry, so the stale-duplicate class
 * cannot recur.
 */
export function putEntry(ctx: StructureValue, entry: Binding): void {
  const s = ctx as unknown as Structure;
  const es = s.entries;
  if (entry.key !== null) {
    // A keyed write ends the positional guarantee: index `i` is no longer
    // `entries[i]`, so positional reads take the subsequence path.
    s.positional = undefined;
    for (let i = 0; i < es.length; i++) {
      if (es[i].key === entry.key) { es[i] = entry; s.invalidateView(); return; }
    }
  }
  es.push(entry);
  s.invalidateView();
}

/** Write a slot from a key and a value — the common case, and the shape
 *  `slotWrite` had. */
export function setEntry(ctx: StructureValue, key: string, value: Value | undefined): void {
  putEntry(ctx, { key, value });
}

/** Remove the entry under `key`. Returns whether one went. */
export function removeEntry(ctx: StructureValue, key: string): boolean {
  const s = ctx as unknown as Structure;
  const es = s.bindingList;
  for (let i = 0; i < es.length; i++) {
    if (es[i].key === key) { es.splice(i, 1); s.invalidateView(); return true; }
  }
  return false;
}
