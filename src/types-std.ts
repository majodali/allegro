// =============================================================================
// Allegro Standard — Core Type Definitions
// Defines Int and String types as Context values with method bindings.
// Types are attached to values as MultiValue "type" components.
// =============================================================================

import {
  Value, ValueKind, BitsValue, ContextValue, PrimitiveFnImpl,
  makeInt, makeFloat, bitsToFloat, makeBits, makePrimitive, makeExpr, makeContext, makeMultiValue,
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
  // All return typed values (IntType referenced via closure, initialized before any call)
  add: (args) => {
    const a = toSigned(asBitsTyped(args[0], "Int.add"));
    const b = toSigned(asBitsTyped(args[1], "Int.add"));
    return withType(makeInt(Number(a + b)), IntType);
  },
  sub: (args) => {
    const a = toSigned(asBitsTyped(args[0], "Int.sub"));
    const b = toSigned(asBitsTyped(args[1], "Int.sub"));
    return withType(makeInt(Number(a - b)), IntType);
  },
  mul: (args) => {
    const a = toSigned(asBitsTyped(args[0], "Int.mul"));
    const b = toSigned(asBitsTyped(args[1], "Int.mul"));
    return withType(makeInt(Number(a * b)), IntType);
  },
  div: (args) => {
    const a = toSigned(asBitsTyped(args[0], "Int.div"));
    const b = toSigned(asBitsTyped(args[1], "Int.div"));
    if (b === 0n) throw new AllegroError("Int.div: division by zero");
    return withType(makeInt(Number(a / b)), IntType);
  },
  mod: (args) => {
    const a = toSigned(asBitsTyped(args[0], "Int.mod"));
    const b = toSigned(asBitsTyped(args[1], "Int.mod"));
    if (b === 0n) throw new AllegroError("Int.mod: division by zero");
    return withType(makeInt(Number(a % b)), IntType);
  },

  // Comparison — return typed Bool
  eq: (args) => {
    const a = asBitsTyped(args[0], "Int.eq");
    const b = asBitsTyped(args[1], "Int.eq");
    return withType(makeInt(a.data === b.data ? 1 : 0), BoolType);
  },
  neq: (args) => {
    const a = asBitsTyped(args[0], "Int.neq");
    const b = asBitsTyped(args[1], "Int.neq");
    return withType(makeInt(a.data !== b.data ? 1 : 0), BoolType);
  },
  lt: (args) => {
    const a = toSigned(asBitsTyped(args[0], "Int.lt"));
    const b = toSigned(asBitsTyped(args[1], "Int.lt"));
    return withType(makeInt(a < b ? 1 : 0), BoolType);
  },
  gt: (args) => {
    const a = toSigned(asBitsTyped(args[0], "Int.gt"));
    const b = toSigned(asBitsTyped(args[1], "Int.gt"));
    return withType(makeInt(a > b ? 1 : 0), BoolType);
  },
  lte: (args) => {
    const a = toSigned(asBitsTyped(args[0], "Int.lte"));
    const b = toSigned(asBitsTyped(args[1], "Int.lte"));
    return withType(makeInt(a <= b ? 1 : 0), BoolType);
  },
  gte: (args) => {
    const a = toSigned(asBitsTyped(args[0], "Int.gte"));
    const b = toSigned(asBitsTyped(args[1], "Int.gte"));
    return withType(makeInt(a >= b ? 1 : 0), BoolType);
  },

  // Conversion
  toString: ((args: Value[]) => {
    const a = toSigned(asBitsTyped(args[0], "Int.toString"));
    return withType(stringToBits(String(a)), StringType);
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
    return withType(stringToBits(a + b), StringType);
  },

  // Comparison — return typed Bool
  eq: (args) => {
    const a = bitsToString(asBitsTyped(args[0], "String.eq"));
    const b = bitsToString(asBitsTyped(args[1], "String.eq"));
    return withType(makeInt(a === b ? 1 : 0), BoolType);
  },
  neq: (args) => {
    const a = bitsToString(asBitsTyped(args[0], "String.neq"));
    const b = bitsToString(asBitsTyped(args[1], "String.neq"));
    return withType(makeInt(a !== b ? 1 : 0), BoolType);
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
    return withType(stringToBits(s.slice(start, end)), StringType);
  },
  indexOf: (args) => {
    const s = bitsToString(asBitsTyped(args[0], "String.indexOf"));
    const search = bitsToString(asBitsTyped(args[1], "String.indexOf"));
    return withType(makeInt(s.indexOf(search)), IntType);
  },
  toString: ((args: Value[]) => {
    return args[0]; // strings are already strings
  }) as PrimitiveFnImpl,
};

// =============================================================================
// Float Type
// =============================================================================

const floatMethods: Record<string, PrimitiveFnImpl> = {
  add: (args) => withType(makeFloat(bitsToFloat(asBitsTyped(args[0], "Float.add")) + bitsToFloat(asBitsTyped(args[1], "Float.add"))), FloatType),
  sub: (args) => withType(makeFloat(bitsToFloat(asBitsTyped(args[0], "Float.sub")) - bitsToFloat(asBitsTyped(args[1], "Float.sub"))), FloatType),
  mul: (args) => withType(makeFloat(bitsToFloat(asBitsTyped(args[0], "Float.mul")) * bitsToFloat(asBitsTyped(args[1], "Float.mul"))), FloatType),
  div: (args) => {
    const b = bitsToFloat(asBitsTyped(args[1], "Float.div"));
    if (b === 0) throw new AllegroError("Float.div: division by zero");
    return withType(makeFloat(bitsToFloat(asBitsTyped(args[0], "Float.div")) / b), FloatType);
  },
  mod: (args) => {
    const b = bitsToFloat(asBitsTyped(args[1], "Float.mod"));
    if (b === 0) throw new AllegroError("Float.mod: division by zero");
    return withType(makeFloat(bitsToFloat(asBitsTyped(args[0], "Float.mod")) % b), FloatType);
  },
  eq: (args) => withType(makeInt(bitsToFloat(asBitsTyped(args[0], "Float.eq")) === bitsToFloat(asBitsTyped(args[1], "Float.eq")) ? 1 : 0), BoolType),
  neq: (args) => withType(makeInt(bitsToFloat(asBitsTyped(args[0], "Float.neq")) !== bitsToFloat(asBitsTyped(args[1], "Float.neq")) ? 1 : 0), BoolType),
  lt: (args) => withType(makeInt(bitsToFloat(asBitsTyped(args[0], "Float.lt")) < bitsToFloat(asBitsTyped(args[1], "Float.lt")) ? 1 : 0), BoolType),
  gt: (args) => withType(makeInt(bitsToFloat(asBitsTyped(args[0], "Float.gt")) > bitsToFloat(asBitsTyped(args[1], "Float.gt")) ? 1 : 0), BoolType),
  lte: (args) => withType(makeInt(bitsToFloat(asBitsTyped(args[0], "Float.lte")) <= bitsToFloat(asBitsTyped(args[1], "Float.lte")) ? 1 : 0), BoolType),
  gte: (args) => withType(makeInt(bitsToFloat(asBitsTyped(args[0], "Float.gte")) >= bitsToFloat(asBitsTyped(args[1], "Float.gte")) ? 1 : 0), BoolType),
  toString: ((args: Value[]) => withType(stringToBits(String(bitsToFloat(asBitsTyped(args[0], "Float.toString")))), StringType)) as PrimitiveFnImpl,
};

// =============================================================================
// Bool Type
// =============================================================================

const boolMethods: Record<string, PrimitiveFnImpl> = {
  and: (args) => {
    const a = asBitsTyped(args[0], "Bool.and").data !== 0n;
    const b = asBitsTyped(args[1], "Bool.and").data !== 0n;
    return withType(makeInt(a && b ? 1 : 0), BoolType);
  },
  or: (args) => {
    const a = asBitsTyped(args[0], "Bool.or").data !== 0n;
    const b = asBitsTyped(args[1], "Bool.or").data !== 0n;
    return withType(makeInt(a || b ? 1 : 0), BoolType);
  },
  not: (args) => {
    const a = asBitsTyped(args[0], "Bool.not").data !== 0n;
    return withType(makeInt(a ? 0 : 1), BoolType);
  },
  eq: (args) => withType(makeInt(asBitsTyped(args[0], "Bool.eq").data === asBitsTyped(args[1], "Bool.eq").data ? 1 : 0), BoolType),
  neq: (args) => withType(makeInt(asBitsTyped(args[0], "Bool.neq").data !== asBitsTyped(args[1], "Bool.neq").data ? 1 : 0), BoolType),
  toString: ((args: Value[]) => {
    const a = asBitsTyped(args[0], "Bool.toString").data !== 0n;
    return withType(stringToBits(a ? "true" : "false"), StringType);
  }) as PrimitiveFnImpl,
};

// =============================================================================
// Array Type
// Arrays are Contexts with numeric string keys ("0", "1", ...) and "__length".
// =============================================================================

/** Create a typed Array value from a list of Allegro values */
export function makeArray(elements: Value[]): Value {
  const ctx = makeContext();
  for (let i = 0; i < elements.length; i++) {
    const key = String(i);
    ctx.bindings.set(key, { key, value: elements[i], isUse: false });
    ctx.bindingList.push({ key, value: elements[i], isUse: false });
  }
  const lenKey = "__length";
  const lenVal = makeInt(elements.length);
  ctx.bindings.set(lenKey, { key: lenKey, value: lenVal, isUse: false });
  ctx.bindingList.push({ key: lenKey, value: lenVal, isUse: false });
  // Lazily reference ArrayType — it's defined below
  return withType(ctx, ArrayType);
}

function arrayElements(ctx: ContextValue): Value[] {
  const lenBinding = ctx.bindings.get("__length");
  if (!lenBinding?.value) return [];
  const len = Number((lenBinding.value as BitsValue).data);
  const result: Value[] = [];
  for (let i = 0; i < len; i++) {
    const b = ctx.bindings.get(String(i));
    if (b?.value) result.push(b.value);
  }
  return result;
}

const arrayMethods: Record<string, PrimitiveFnImpl> = {
  length: (args) => {
    const ctx = args[0] as ContextValue;
    const lenBinding = ctx.bindings.get("__length");
    return lenBinding?.value ?? makeInt(0);
  },
  get: (args) => {
    const ctx = args[0] as ContextValue;
    const idx = Number(toSigned(asBitsTyped(args[1], "Array.get")));
    const b = ctx.bindings.get(String(idx));
    if (!b?.value) throw new AllegroError(`Array.get: index ${idx} out of bounds`);
    return b.value;
  },
  concat: (args) => {
    const aCtx = args[0] as ContextValue;
    const bCtx = args[1] as ContextValue;
    return makeArray([...arrayElements(aCtx), ...arrayElements(bCtx)]);
  },
  slice: (args) => {
    const ctx = args[0] as ContextValue;
    const elems = arrayElements(ctx);
    const start = Number(toSigned(asBitsTyped(args[1], "Array.slice")));
    const end = args.length > 2
      ? Number(toSigned(asBitsTyped(args[2], "Array.slice")))
      : elems.length;
    return makeArray(elems.slice(start, end));
  },
  map: (args, ctx, evalFn) => {
    const arrCtx = args[0] as ContextValue;
    const fn = args[1];
    const elems = arrayElements(arrCtx);
    const results: Value[] = [];
    for (const elem of elems) {
      const result = evalFn!(makeExpr(fn, [elem]), ctx!);
      results.push(result);
    }
    return makeArray(results);
  },
  filter: (args, ctx, evalFn) => {
    const arrCtx = args[0] as ContextValue;
    const fn = args[1];
    const elems = arrayElements(arrCtx);
    const results: Value[] = [];
    for (const elem of elems) {
      const result = evalFn!(makeExpr(fn, [elem]), ctx!);
      const p = primaryOf(result);
      if (p.kind === ValueKind.Bits && p.data !== 0n) {
        results.push(elem);
      }
    }
    return makeArray(results);
  },
  reduce: (args, ctx, evalFn) => {
    const arrCtx = args[0] as ContextValue;
    const fn = args[1];
    const initial = args[2];
    const elems = arrayElements(arrCtx);
    let acc = initial;
    for (const elem of elems) {
      acc = evalFn!(makeExpr(fn, [acc, elem]), ctx!);
    }
    return acc;
  },
  eq: (args) => {
    // Reference equality for now (arrays are Contexts)
    return makeInt(args[0] === args[1] ? 1 : 0);
  },
  toString: ((args: Value[]) => {
    const ctx = args[0] as ContextValue;
    const elems = arrayElements(ctx);
    return stringToBits(`[Array(${elems.length})]`);
  }) as PrimitiveFnImpl,
};

// =============================================================================
// Object Type
// Objects are typed Contexts. Fields are accessed via dot notation.
// =============================================================================

/** Create a typed Object value from key-value pairs */
export function makeObject(entries: [string, Value][]): Value {
  const ctx = makeContext();
  for (const [key, value] of entries) {
    ctx.bindings.set(key, { key, value, isUse: false });
    ctx.bindingList.push({ key, value, isUse: false });
  }
  return withType(ctx, ObjectType);
}

const objectMethods: Record<string, PrimitiveFnImpl> = {
  keys: (args) => {
    const ctx = args[0] as ContextValue;
    const keys = [...ctx.bindings.keys()];
    return makeArray(keys.map(k => stringToBits(k)));
  },
  values: (args) => {
    const ctx = args[0] as ContextValue;
    const vals = [...ctx.bindings.values()].filter(b => b.value !== undefined).map(b => b.value!);
    return makeArray(vals);
  },
  get: (args) => {
    const ctx = args[0] as ContextValue;
    const key = bitsToString(asBitsTyped(args[1], "Object.get"));
    const b = ctx.bindings.get(key);
    if (!b?.value) throw new AllegroError(`Object.get: '${key}' not found`);
    return b.value;
  },
  eq: (args) => makeInt(args[0] === args[1] ? 1 : 0),
  toString: ((args: Value[]) => {
    const ctx = args[0] as ContextValue;
    return stringToBits(`{Object(${ctx.bindings.size})}`);
  }) as PrimitiveFnImpl,
};

// =============================================================================
// Build Type Contexts
// =============================================================================

export const IntType: ContextValue = buildType("Int", intMethods);
export const FloatType: ContextValue = buildType("Float", floatMethods);
export const StringType: ContextValue = buildType("String", stringMethods);
export const BoolType: ContextValue = buildType("Bool", boolMethods);
export const ArrayType: ContextValue = buildType("Array", arrayMethods);
export const ObjectType: ContextValue = buildType("Object", objectMethods);

// =============================================================================
// Type System Extension
// =============================================================================

export function createTypeSystem(): Extension {
  return {
    name: "types",
    bindings: {
      Int: IntType,
      Float: FloatType,
      String: StringType,
      Bool: BoolType,
      Array: ArrayType,
      Object: ObjectType,
      // Bool literals as context bindings (parsed as identifiers, resolved here)
      true: withType(makeInt(1), BoolType) as any,
      false: withType(makeInt(0), BoolType) as any,
    },
  };
}
