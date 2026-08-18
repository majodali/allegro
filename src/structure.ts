// =============================================================================
// Structure — the unified host representation (structures Phase 4, C4.1–C4.2 / B-019–B-020)
//
// Design (docs/design/allegretto/structures.md §2, I1): an instance is
// (shape ref, flat slot storage, channel storage, immutable bit, optional
// dense region). C4.1 landed the KIND: every MultiValue and every Context
// is an instance of ONE host class, constructed exclusively through the
// types.ts factories (`makeMultiValue` / `makeContext` / `makeDenseArrayCtx`
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
// Role is FIXED at construction (a MultiValue never becomes a Context);
// `kind` is a plain field so the evaluator's hot switch is unaffected.
// The two planes map onto the current storage:
//   - channel plane  → `components` (MultiValue role; every key is
//     registry-checked by the W3 walker)
//   - slot/data plane → `bindings` + `bindingList` (+ `dense` for
//     numeric-keyed structures; legacy `__*` meta-slots remain here
//     until C5 re-keys them)
//
// Immutable bit (D22): structures are born-immutable BY DEFAULT; the bit
// is DECLARED state at C4.1, with the standing carve-outs enforced by the
// boundary battery rather than by freezing (enforcement tightens at C4.3):
//   - evaluation scopes are mutable evaluator state (not data — plane
//     split, C2.1);
//   - future cells are single-assignment monotonic (D33) — a pending
//     cell inside an immutable structure does not violate deep
//     immutability (the D22 carve-out);
//   - construction-phase population (addBinding after makeContext) is
//     the grandfathered builder idiom until construction protocols
//     migrate (C6 recipe).
// =============================================================================

import type { Value, Binding, ContextValue, BitsValue } from "./types.js";
import { ValueKind, makeInt } from "./types.js";

const LENGTH_KEY = "__length";

/** The one host representation behind MultiValue and Context. All fields
 *  are declared up front so every structure shares a single hidden class
 *  (the I1 motivation), whichever role it plays. */
export class Structure {
  // C7.1 (D15/D46): ONE kind. The former MultiValue role is the CARRIER
  // configuration — primary set, empty data plane — and it answers the
  // same kind as every structure. `isCarrier` is the host-level
  // discriminant (primary presence), not the kind tag.
  kind: ValueKind.Structure;

  // --- Carrier configuration (transparent value: primary + channel plane) ---
  primary: Value;
  components: Map<string, Value>;

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
  parent?: ContextValue;
  isScope?: boolean;
  scopePredicates?: Map<string, unknown>;

  // --- C4.1 substrate ---
  /** D22: born-immutable by default. Scopes (evaluation state) are
   *  mutable; future cells are the sanctioned monotonic exception. */
  immutable: boolean;

  constructor(immutable: boolean) {
    this.kind = ValueKind.Structure;
    this.primary = undefined as unknown as Value;
    this.components = undefined as unknown as Map<string, Value>;
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
      // C7.1: a carrier's data plane is EMPTY (D15) — materialize the
      // empty view on first ask so record-shaped consumers see no slots.
      else if (this.primary !== undefined) { this._bindings = new Map(); this._bindingList = []; }
    }
    return this._bindings;
  }
  set bindings(m: Map<string, Binding>) {
    this._bindings = m;
  }

  get bindingList(): Binding[] {
    if (this._bindingList === undefined) {
      if (this.dense !== undefined) materializeView(this);
      else if (this.primary !== undefined) { this._bindings = new Map(); this._bindingList = []; }
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

/** C7.1: the host-level carrier discriminant — a structure whose data is
 *  a non-Structure primary riding under an (empty) data plane. This is
 *  the "MultiValue interface" as protocol, not kind (D46). */
export function isCarrier(v: unknown): boolean {
  return v instanceof Structure && (v as Structure).primary !== undefined;
}

/** Construct the CARRIER configuration (the D15 transparent structure:
 *  empty data plane + primary channel). */
export function newMultiValueStructure(primary: Value, components: Map<string, Value>): Structure {
  const s = new Structure(true);
  s.primary = primary;
  s.components = components;
  return s;
}

/** Construct the Context role. Scopes are mutable evaluator state; data
 *  contexts carry the immutable bit (population-during-construction is
 *  the grandfathered builder idiom until the C6 recipe). */
export function newContextStructure(): Structure {
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
 *  to records/types without a MultiValue wrapper: `makeMultiValue` with a
 *  Context primary flattens through here, so MV-over-Context is
 *  unconstructible. Scopes are evaluator state, not data — the channel
 *  plane never attaches to them (C2.1 plane rejection). */
export function deriveWithChannels(ctx: ContextValue, components: Map<string, Value>): Structure {
  const src = ctx as unknown as Structure;
  if (src.isScope) {
    throw new Error("deriveWithChannels: channels cannot attach to an evaluation scope (plane rejection)");
  }
  const s = new Structure(src.immutable);
  if (src.dense !== undefined) {
    s.dense = src.dense; // shared by reference — arrays are immutable
  } else {
    s.bindings = src.bindings;
    s.bindingList = src.bindingList;
  }
  // The given map is AUTHORITATIVE — it becomes the derived structure's
  // entire channel plane. Writers pre-clone via cloneComponents (total, so
  // a flattened source's channels are in the clone) and then set/delete;
  // merging here instead would make channel deletion (clearOccurrenceBound)
  // impossible. Callers overlaying a partial map onto an already-channeled
  // Context must clone-and-extend themselves (see evaluate's MV rebuild).
  s.components = components;
  return s;
}

/** O(1) element read on the dense region, with the legacy-map fallback
 *  for non-dense numeric-keyed contexts (unions, hand-built tests). */
export function denseIndexGet(ctx: ContextValue, i: number): Value | undefined {
  const s = ctx as unknown as Structure;
  if (s.dense !== undefined) return s.dense[i];
  return ctx.bindings.get(String(i))?.value;
}

/** Dense-aware slot count read (Bits), or undefined when neither a dense
 *  region nor a `__length` slot exists. */
export function denseSlotCount(ctx: ContextValue): Value | undefined {
  const s = ctx as unknown as Structure;
  if (s.dense !== undefined) return s.slotCountBits();
  return ctx.bindings.get(LENGTH_KEY)?.value;
}

/** All elements of a numeric-keyed structure (dense fast path). */
export function denseElements(ctx: ContextValue): Value[] {
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
