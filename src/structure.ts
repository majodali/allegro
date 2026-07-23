// =============================================================================
// Structure — the unified host representation (structures Phase 4, C4.1 / B-019)
//
// Design (docs/design/allegretto/structures.md §2, I1): an instance is
// (shape ref, flat slot storage, channel storage, immutable bit, optional
// dense region). C4.1 lands the KIND: every MultiValue and every Context
// is now an instance of ONE host class, constructed exclusively through
// the types.ts factories (`makeMultiValue` / `makeContext` are the shims
// the plan promised). The public field surface (`primary`/`components`,
// `bindings`/`bindingList`, scope fields) is unchanged — the ~1000-test
// suite is the oracle — but the object layout is now a single declared
// hidden class, and every later physical change (dense regions C4.2,
// transparency cutover C4.3, symbol keys C5) happens inside this module.
//
// Role is FIXED at construction (a MultiValue never becomes a Context);
// `kind` is a plain field so the evaluator's hot switch is unaffected.
// The two planes map onto the current storage:
//   - channel plane  → `components` (MultiValue role; every key is
//     registry-checked by the W3 walker)
//   - slot/data plane → `bindings` + `bindingList` (Context role;
//     legacy `__*` meta-slots remain here until C5 re-keys them)
//
// Immutable bit (D22): structures are born-immutable BY DEFAULT; the bit
// is DECLARED state at C4.1, with the standing carve-outs enforced by the
// boundary battery rather than by freezing (enforcement tightens at C4.3):
//   - evaluation scopes are mutable evaluator state (not data — plane
//     split, C2.1); `makeContext` marks them mutable when flagged;
//   - future cells are single-assignment monotonic (D33) — a pending
//     cell inside an immutable structure does not violate deep
//     immutability (the D22 carve-out);
//   - construction-phase population (addBinding after makeContext) is
//     the grandfathered builder idiom until construction protocols
//     migrate (C6 recipe).
// =============================================================================

import type { Value, Binding, ContextValue } from "./types.js";
import { ValueKind } from "./types.js";

/** The one host representation behind MultiValue and Context. All fields
 *  are declared up front so every structure shares a single hidden class
 *  (the I1 motivation), whichever role it plays. */
export class Structure {
  kind: ValueKind.MultiValue | ValueKind.Context;

  // --- MultiValue role (transparent value: primary + channel plane) ---
  primary: Value;
  components: Map<string, Value>;

  // --- Context role (record/type/scope: slot plane) ---
  bindings: Map<string, Binding>;
  bindingList: Binding[];

  // --- Scope-role fields (C2.1/C2.2; host-plane, never value slots) ---
  parent?: ContextValue;
  isScope?: boolean;
  scopePredicates?: Map<string, unknown>;

  // --- C4.1 substrate ---
  /** D22: born-immutable by default. Scopes (evaluation state) are
   *  mutable; future cells are the sanctioned monotonic exception. */
  immutable: boolean;

  constructor(kind: ValueKind.MultiValue | ValueKind.Context, immutable: boolean) {
    this.kind = kind;
    this.primary = undefined as unknown as Value;
    this.components = undefined as unknown as Map<string, Value>;
    this.bindings = undefined as unknown as Map<string, Binding>;
    this.bindingList = undefined as unknown as Binding[];
    this.parent = undefined;
    this.isScope = undefined;
    this.scopePredicates = undefined;
    this.immutable = immutable;
  }
}

/** Construct the MultiValue role. */
export function newMultiValueStructure(primary: Value, components: Map<string, Value>): Structure {
  const s = new Structure(ValueKind.MultiValue, true);
  s.primary = primary;
  s.components = components;
  return s;
}

/** Construct the Context role. Scopes are mutable evaluator state; data
 *  contexts carry the immutable bit (population-during-construction is
 *  the grandfathered builder idiom until the C6 recipe). */
export function newContextStructure(): Structure {
  const s = new Structure(ValueKind.Context, true);
  s.bindings = new Map();
  s.bindingList = [];
  return s;
}

/** Is this value an instance of the unified representation? The W4
 *  boundary invariant asserts this for every MultiValue/Context reachable
 *  from the test corpus — a stray object literal fails the battery. */
export function isStructure(v: unknown): v is Structure {
  return v instanceof Structure;
}
