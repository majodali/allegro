// =============================================================================
// Allegro Standard — Core Type Definitions
// Defines Int and String types as Context values with method bindings.
// Types are attached to values as MultiValue "type" components.
// =============================================================================

import {
  Value, ValueKind, BitsValue, ContextValue, PrimitiveFnImpl,
  makeInt, makePrimitive, makeContext, makeMultiValue,
  primaryOf, stringToBits, bitsToString, AllegroError,
  Extension,
} from "./types.js";

// --- Helpers ---

/** Get the type component from a value (if it's a MultiValue with "type") */
export function getType(v: Value): ContextValue | null {
  if (v.kind === ValueKind.MultiValue) {
    const t = v.components.get("type");
    if (t && t.kind === ValueKind.Context) return t;
  }
  return null;
}

/** Get the type name from a value's type component */
export function getTypeName(v: Value): string | null {
  const t = getType(v);
  if (!t) return null;
  const nameBinding = t.bindings.get("__name");
  if (!nameBinding?.value || nameBinding.value.kind !== ValueKind.Bits) return null;
  return bitsToString(nameBinding.value);
}

/** Wrap a raw value with a type component */
export function withType(v: Value, type: ContextValue): Value {
  const primary = primaryOf(v);
  const components = v.kind === ValueKind.MultiValue
    ? new Map(v.components)
    : new Map<string, Value>();
  components.set("type", type);
  return makeMultiValue(primary, components);
}

/** Look up a method on a type Context */
export function typeMethod(type: ContextValue, name: string): Value | null {
  const binding = type.bindings.get(name);
  if (!binding || binding.value === undefined) return null;
  return binding.value;
}

// --- Type builder helper ---

/** Names of properties that should be treated as getters (auto-called with self) */
const getterNames = new Set(["length"]);

function buildType(name: string, methods: Record<string, PrimitiveFnImpl>): ContextValue {
  const ctx = makeContext();
  // __name
  const nameKey = "__name";
  const nameVal = stringToBits(name);
  ctx.bindings.set(nameKey, { key: nameKey, value: nameVal, isUse: false });
  ctx.bindingList.push({ key: nameKey, value: nameVal, isUse: false });
  // methods
  for (const [key, fn] of Object.entries(methods)) {
    const prim = makePrimitive(`${name}.${key}`, fn);
    if (getterNames.has(key)) {
      (prim as any).__getter = true;
    }
    ctx.bindings.set(key, { key, value: prim, isUse: false });
    ctx.bindingList.push({ key, value: prim, isUse: false });
  }
  return ctx;
}

// --- Bits helpers (duplicated from primitives to avoid circular dep) ---

function toSigned(b: BitsValue): bigint {
  if (b.length === 64 && b.data >= 2n ** 63n) return b.data - 2n ** 64n;
  return b.data;
}

function asBitsTyped(v: Value, ctx: string): BitsValue {
  const p = primaryOf(v);
  if (p.kind !== ValueKind.Bits) throw new AllegroError(`${ctx}: expected Bits, got ${p.kind}`);
  return p;
}

// =============================================================================
// Int Type
// =============================================================================

const intMethods: Record<string, PrimitiveFnImpl> = {
  // Arithmetic — self is first arg, other is second
  add: (args) => {
    const a = toSigned(asBitsTyped(args[0], "Int.add"));
    const b = toSigned(asBitsTyped(args[1], "Int.add"));
    return makeInt(Number(a + b));
  },
  sub: (args) => {
    const a = toSigned(asBitsTyped(args[0], "Int.sub"));
    const b = toSigned(asBitsTyped(args[1], "Int.sub"));
    return makeInt(Number(a - b));
  },
  mul: (args) => {
    const a = toSigned(asBitsTyped(args[0], "Int.mul"));
    const b = toSigned(asBitsTyped(args[1], "Int.mul"));
    return makeInt(Number(a * b));
  },
  div: (args) => {
    const a = toSigned(asBitsTyped(args[0], "Int.div"));
    const b = toSigned(asBitsTyped(args[1], "Int.div"));
    if (b === 0n) throw new AllegroError("Int.div: division by zero");
    // Integer division truncates toward zero
    const result = a / b;
    return makeInt(Number(result));
  },
  mod: (args) => {
    const a = toSigned(asBitsTyped(args[0], "Int.mod"));
    const b = toSigned(asBitsTyped(args[1], "Int.mod"));
    if (b === 0n) throw new AllegroError("Int.mod: division by zero");
    return makeInt(Number(a % b));
  },

  // Comparison
  eq: (args) => {
    const a = asBitsTyped(args[0], "Int.eq");
    const b = asBitsTyped(args[1], "Int.eq");
    return makeInt(a.data === b.data ? 1 : 0);
  },
  neq: (args) => {
    const a = asBitsTyped(args[0], "Int.neq");
    const b = asBitsTyped(args[1], "Int.neq");
    return makeInt(a.data !== b.data ? 1 : 0);
  },
  lt: (args) => {
    const a = toSigned(asBitsTyped(args[0], "Int.lt"));
    const b = toSigned(asBitsTyped(args[1], "Int.lt"));
    return makeInt(a < b ? 1 : 0);
  },
  gt: (args) => {
    const a = toSigned(asBitsTyped(args[0], "Int.gt"));
    const b = toSigned(asBitsTyped(args[1], "Int.gt"));
    return makeInt(a > b ? 1 : 0);
  },
  lte: (args) => {
    const a = toSigned(asBitsTyped(args[0], "Int.lte"));
    const b = toSigned(asBitsTyped(args[1], "Int.lte"));
    return makeInt(a <= b ? 1 : 0);
  },
  gte: (args) => {
    const a = toSigned(asBitsTyped(args[0], "Int.gte"));
    const b = toSigned(asBitsTyped(args[1], "Int.gte"));
    return makeInt(a >= b ? 1 : 0);
  },

  // Conversion
  toString: ((args: Value[]) => {
    const a = toSigned(asBitsTyped(args[0], "Int.toString"));
    return stringToBits(String(a));
  }) as PrimitiveFnImpl,
};

// =============================================================================
// String Type
// =============================================================================

const stringMethods: Record<string, PrimitiveFnImpl> = {
  // String + String concatenation
  add: (args) => {
    const a = bitsToString(asBitsTyped(args[0], "String.add"));
    const b = bitsToString(asBitsTyped(args[1], "String.add"));
    return stringToBits(a + b);
  },

  // Comparison
  eq: (args) => {
    const a = bitsToString(asBitsTyped(args[0], "String.eq"));
    const b = bitsToString(asBitsTyped(args[1], "String.eq"));
    return makeInt(a === b ? 1 : 0);
  },
  neq: (args) => {
    const a = bitsToString(asBitsTyped(args[0], "String.neq"));
    const b = bitsToString(asBitsTyped(args[1], "String.neq"));
    return makeInt(a !== b ? 1 : 0);
  },

  // Properties / methods
  length: (args) => {
    const s = bitsToString(asBitsTyped(args[0], "String.length"));
    return makeInt(s.length);
  },
  slice: (args) => {
    const s = bitsToString(asBitsTyped(args[0], "String.slice"));
    const start = Number(toSigned(asBitsTyped(args[1], "String.slice")));
    const end = args.length > 2
      ? Number(toSigned(asBitsTyped(args[2], "String.slice")))
      : s.length;
    return stringToBits(s.slice(start, end));
  },
  indexOf: (args) => {
    const s = bitsToString(asBitsTyped(args[0], "String.indexOf"));
    const search = bitsToString(asBitsTyped(args[1], "String.indexOf"));
    return makeInt(s.indexOf(search));
  },
  toString: ((args: Value[]) => {
    return args[0]; // strings are already strings
  }) as PrimitiveFnImpl,
};

// =============================================================================
// Build Type Contexts
// =============================================================================

export const IntType: ContextValue = buildType("Int", intMethods);
export const StringType: ContextValue = buildType("String", stringMethods);

// =============================================================================
// Type System Extension
// =============================================================================

export function createTypeSystem(): Extension {
  return {
    name: "types",
    bindings: {
      Int: IntType,
      String: StringType,
    },
  };
}
