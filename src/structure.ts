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

const LENGTH_KEY = "__length";

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
  private _bindings: Map<string, Binding>;
  private _bindingList: Binding[];

  // --- C4.2 dense region (numeric-keyed structures — arrays) ---
  /** Element storage for array contexts. When present, this IS the slot
   *  plane; `_bindings`/`_bindingList` hold the lazily-materialized
   *  legacy view (or stay undefined until someone asks). */
  dense?: Value[];
  /** Cached Bits for the slot count (avoids re-allocating per read). */
  private _slotCountBits?: Value;

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
    this._bindings = undefined as unknown as Map<string, Binding>;
    this._bindingList = undefined as unknown as Binding[];
    this.dense = undefined;
    this._slotCountBits = undefined;
    this.parent = undefined;
    this.isScope = undefined;
    this.scopePredicates = undefined;
    this.immutable = immutable;
  }

  /** Legacy slot-plane view. For dense structures the map is materialized
   *  on first access (then cached; W6 asserts coherence). Non-dense
   *  structures return their storage directly — the getter is a
   *  monomorphic two-check fast path on the scope-lookup hot loop. */
  get bindings(): Map<string, Binding> {
    if (this._bindings === undefined) {
      if (this.dense !== undefined) materializeView(this);
    }
    return this._bindings;
  }
  set bindings(m: Map<string, Binding>) {
    this._bindings = m;
  }

  get bindingList(): Binding[] {
    if (this._bindingList === undefined) {
      if (this.dense !== undefined) materializeView(this);
    }
    return this._bindingList;
  }
  set bindingList(l: Binding[]) {
    this._bindingList = l;
  }

  /** True iff the legacy view has been materialized (dense structures). */
  get viewMaterialized(): boolean {
    return this.dense !== undefined && this._bindings !== undefined;
  }

  /** Slot count as a cached Bits value (dense structures only). */
  slotCountBits(): Value {
    if (this._slotCountBits === undefined) {
      this._slotCountBits = makeInt(this.dense!.length);
    }
    return this._slotCountBits;
  }
}

/** Build the legacy map/list view of a dense structure: one Binding per
 *  element under its decimal string key, plus the `__length` slot. The
 *  dense region stays authoritative for `indexGet`/`getSlotCount`. */
function materializeView(s: Structure): void {
  const bindings = new Map<string, Binding>();
  const bindingList: Binding[] = [];
  const dense = s.dense!;
  for (let i = 0; i < dense.length; i++) {
    const b: Binding = { key: String(i), value: dense[i] };
    bindings.set(b.key as string, b);
    bindingList.push(b);
  }
  const lenB: Binding = { key: LENGTH_KEY, value: s.slotCountBits() };
  bindings.set(LENGTH_KEY, lenB);
  bindingList.push(lenB);
  s.bindings = bindings;
  s.bindingList = bindingList;
}

/** Construct the Context role. Scopes are mutable evaluator state; data
 *  contexts carry the immutable bit (population-during-construction is
 *  the grandfathered builder idiom until the C6 recipe). */
export function newRecordStructure(): Structure {
  const s = new Structure(true);
  s.bindings = new Map();
  s.bindingList = [];
  return s;
}

/** C4.2: construct a dense numeric-keyed structure (array context). The
 *  element array is adopted, not copied — callers hand over ownership
 *  (arrays are immutable, D22). */
export function newDenseStructure(elements: Value[]): Structure {
  const s = new Structure(true);
  s.dense = elements;
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
  if (src.dense !== undefined) {
    s.dense = src.dense; // shared by reference — arrays are immutable
  } else {
    s.bindings = src.bindings;
    s.bindingList = src.bindingList;
  }
  // The given map is AUTHORITATIVE — it becomes the derived structure's
  // entire channel plane. Writers pre-clone via cloneMeta (total, so
  // a flattened source's channels are in the clone) and then set/delete;
  // merging here instead would make channel deletion (clearOccurrenceBound)
  // impossible. Callers overlaying a partial map onto an already-channeled
  // Context must clone-and-extend themselves (see evaluate's MV rebuild).
  s.meta = meta;
  return s;
}

/** O(1) element read on the dense region, with the legacy-map fallback
 *  for non-dense numeric-keyed contexts (unions, hand-built tests). */
export function denseIndexGet(ctx: StructureValue, i: number): Value | undefined {
  const s = ctx as unknown as Structure;
  if (s.dense !== undefined) return s.dense[i];
  return ctx.bindings.get(String(i))?.value;
}

/** Dense-aware slot count read (Bits), or undefined when neither a dense
 *  region nor a `__length` slot exists. */
export function denseSlotCount(ctx: StructureValue): Value | undefined {
  const s = ctx as unknown as Structure;
  if (s.dense !== undefined) return s.slotCountBits();
  return ctx.bindings.get(LENGTH_KEY)?.value;
}

/** All elements of a numeric-keyed structure (dense fast path). */
export function denseElements(ctx: StructureValue): Value[] {
  const s = ctx as unknown as Structure;
  if (s.dense !== undefined) return s.dense.slice();
  const lenV = denseSlotCount(ctx);
  if (!lenV) return [];
  const len = Number((lenV as BitsValue).data);
  const out: Value[] = [];
  for (let i = 0; i < len; i++) {
    const b = ctx.bindings.get(String(i));
    if (b?.value) out.push(b.value);
  }
  return out;
}

/** Is this value an instance of the unified representation? The W4
 *  boundary invariant asserts this for every MultiValue/Context reachable
 *  from the test corpus — a stray object literal fails the battery. */
export function isStructure(v: unknown): v is Structure {
  return v instanceof Structure;
}
