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

/** Get the __name from a type Context directly (not from a typed value) */
function typeContextName(v: Value): string | null {
  const ctx = v.kind === ValueKind.Context ? v : (v.kind === ValueKind.MultiValue ? primaryOf(v) : null);
  if (!ctx || ctx.kind !== ValueKind.Context) return null;
  const nb = (ctx as ContextValue).bindings.get("__name");
  if (nb?.value?.kind === ValueKind.Bits) return bitsToString(nb.value);
  return null;
}

/** Look up a method on a type Context */
export function typeMethod(type: ContextValue, name: string): Value | null {
  const binding = type.bindings.get(name);
  if (!binding || binding.value === undefined) return null;
  return binding.value;
}

// =============================================================================
// Type Hierarchy: Type, NamedType
//
// Type — base meta-type. All type values have type = Type.
//   Provides structural instanceof/subtypeof.
// NamedType — extends Type. Named types have type = NamedType.
//   Overrides instanceof/subtypeof for nominal checking via __name and __extends.
// ConcreteType — interface (not a position in hierarchy). Concrete types have __construct.
//
// Bootstrap: Type and NamedType are created as raw Contexts first,
// then retroactively given their own type components.
// =============================================================================

/** Helper to add a binding to a Context */
function addBinding(ctx: ContextValue, key: string, value: Value): void {
  ctx.bindings.set(key, { key, value, isUse: false });
  ctx.bindingList.push({ key, value, isUse: false });
}

/**
 * Structural instanceof: does the value's type have all the methods/fields
 * that the expected type has? Checks by comparing binding names.
 */
function structuralInstanceof(value: Value, expectedType: ContextValue): boolean {
  const actualType = getType(value);
  if (!actualType) return false;
  // Check that actualType has all bindings that expectedType has (except __ internals)
  for (const [key] of expectedType.bindings) {
    if (key.startsWith("__")) continue;
    if (!actualType.bindings.has(key)) return false;
  }
  return true;
}

/**
 * Structural subtypeof: does typeA have all the methods/fields of typeB?
 */
function structuralSubtypeof(typeA: ContextValue, typeB: ContextValue): boolean {
  for (const [key] of typeB.bindings) {
    if (key.startsWith("__")) continue;
    if (!typeA.bindings.has(key)) return false;
  }
  return true;
}

/**
 * Nominal instanceof: does the value's type match the expected type
 * by name, or nominally extend it?
 */
function nominalInstanceof(value: Value, expectedType: ContextValue): boolean {
  const actualType = getType(value);
  if (!actualType) return false;
  return nominalSubtypeof(actualType, expectedType);
}

/**
 * Nominal subtypeof: is typeA the same as typeB (by name and type args),
 * or does typeA's __extends chain include typeB?
 */
function nominalSubtypeof(typeA: ContextValue, typeB: ContextValue): boolean {
  const nameB = getTypeNameFromCtx(typeB);
  if (!nameB) return false;
  // Walk typeA's extends chain
  let current: ContextValue | null = typeA;
  while (current) {
    const nameA = getTypeNameFromCtx(current);
    if (nameA === nameB) {
      // Names match — also check type arguments if present
      return typeArgsMatch(current, typeB);
    }
    // Check __extends
    const extendsBinding = current.bindings.get("__extends");
    if (extendsBinding?.value?.kind === ValueKind.Context) {
      current = extendsBinding.value as ContextValue;
    } else {
      current = null;
    }
  }
  return false;
}

/** Check that type arguments match (if the expected type has them) */
function typeArgsMatch(actual: ContextValue, expected: ContextValue): boolean {
  const expectedArgsB = expected.bindings.get("__args");
  if (!expectedArgsB?.value || expectedArgsB.value.kind !== ValueKind.Context) return true; // no args to check
  const actualArgsB = actual.bindings.get("__args");
  if (!actualArgsB?.value || actualArgsB.value.kind !== ValueKind.Context) return true; // actual has no args — accept (bare generic)

  const expectedArgsCtx = expectedArgsB.value as ContextValue;
  const actualArgsCtx = actualArgsB.value as ContextValue;
  const expElems = arrayElements(expectedArgsCtx);
  const actElems = arrayElements(actualArgsCtx);

  if (expElems.length !== actElems.length) return false;

  for (let i = 0; i < expElems.length; i++) {
    const expArg = primaryOf(expElems[i]);
    const actArg = primaryOf(actElems[i]);
    if (expArg.kind !== ValueKind.Context || actArg.kind !== ValueKind.Context) continue;
    const expName = getTypeNameFromCtx(expArg as ContextValue);
    const actName = getTypeNameFromCtx(actArg as ContextValue);
    if (expName && actName && expName !== "Any" && expName !== actName) return false;
  }
  return true;
}

/** Get __name from a type Context */
function getTypeNameFromCtx(type: ContextValue): string | null {
  const nb = type.bindings.get("__name");
  if (nb?.value?.kind === ValueKind.Bits) return bitsToString(nb.value);
  return null;
}

// --- Build Type (structural instanceof/subtypeof) ---

export const Type: ContextValue = makeContext();
addBinding(Type, "__name", stringToBits("Type"));
addBinding(Type, "instanceof", makePrimitive("Type.instanceof", (args) => {
  // args[0] = the type itself (self), args[1] = the value to check
  const type = args[0] as ContextValue;
  const value = args[1];
  return withType(makeInt(structuralInstanceof(value, type) ? 1 : 0), BoolType);
}));
addBinding(Type, "subtypeof", makePrimitive("Type.subtypeof", (args) => {
  // args[0] = the type itself (self), args[1] = the other type
  const typeA = args[0] as ContextValue;
  const typeB = args[1] as ContextValue;
  return withType(makeInt(structuralSubtypeof(typeA, typeB) ? 1 : 0), BoolType);
}));

// --- Build NamedType (nominal instanceof/subtypeof) ---

export const NamedType: ContextValue = makeContext();
addBinding(NamedType, "__name", stringToBits("NamedType"));
addBinding(NamedType, "__extends", Type);
addBinding(NamedType, "instanceof", makePrimitive("NamedType.instanceof", (args) => {
  const type = args[0] as ContextValue;
  const value = args[1];
  return withType(makeInt(nominalInstanceof(value, type) ? 1 : 0), BoolType);
}));
addBinding(NamedType, "subtypeof", makePrimitive("NamedType.subtypeof", (args) => {
  const typeA = args[0] as ContextValue;
  const typeB = args[1] as ContextValue;
  return withType(makeInt(nominalSubtypeof(typeA, typeB) ? 1 : 0), BoolType);
}));

// --- Structural wrap (~): wraps a NamedType to use structural checking ---

/**
 * Create a structural wrapper around a named type.
 * The wrapper uses Type's structural instanceof/subtypeof instead of
 * NamedType's nominal checking. This is the ~ operator.
 */
export function structuralWrap(type: ContextValue): ContextValue {
  const wrapper = makeContext();
  // Copy all bindings from the original type
  for (const [key, binding] of type.bindings) {
    if (key === "__type") continue; // override the type's type
    wrapper.bindings.set(key, { ...binding });
    wrapper.bindingList.push({ ...binding });
  }
  // Set __type to Type (structural) instead of NamedType (nominal)
  addBinding(wrapper, "__type", Type);
  // Mark as structural wrapper
  addBinding(wrapper, "__structural", makeInt(1));
  // Reference the original type
  addBinding(wrapper, "__wraps", type);
  return wrapper;
}

// --- Union Type ---

/**
 * Create a union type from alternatives: `A | B | C`
 * A union type's instanceof checks if the value satisfies ANY alternative.
 * A union type's subtypeof checks if ALL alternatives are subtypes of the target.
 */
export function makeUnionType(alternatives: ContextValue[]): ContextValue {
  const union = makeContext();
  addBinding(union, "__name", stringToBits(
    alternatives.map(a => {
      const n = a.bindings.get("__name")?.value;
      return n && n.kind === ValueKind.Bits ? bitsToString(n) : "?";
    }).join(" | ")
  ));
  // Store alternatives as an array-like Context
  for (let i = 0; i < alternatives.length; i++) {
    addBinding(union, String(i), alternatives[i]);
  }
  addBinding(union, "__length", makeInt(alternatives.length));
  addBinding(union, "__union", makeInt(1)); // marker

  // instanceof: value matches if it matches ANY alternative
  addBinding(union, "instanceof", makePrimitive("UnionType.instanceof", (args) => {
    const value = args[0];
    const valueType = getType(value);
    if (!valueType) return makeInt(0);
    const valueName = getTypeName(value);
    for (let i = 0; i < alternatives.length; i++) {
      const alt = alternatives[i];
      const altName = alt.bindings.get("__name")?.value;
      const altNameStr = altName && altName.kind === ValueKind.Bits ? bitsToString(altName) : null;
      if (altNameStr && altNameStr === valueName) return makeInt(1);
      // Also check structural compatibility via the alternative's own instanceof
      const altInstanceof = alt.bindings.get("instanceof")?.value;
      if (altInstanceof?.kind === ValueKind.PrimitiveFunction) {
        const result = altInstanceof.fn([value], undefined as any, undefined as any);
        if (result.kind === ValueKind.Bits && (result as BitsValue).data !== 0n) return makeInt(1);
      }
    }
    return makeInt(0);
  }));

  // subtypeof: this union is a subtype of target if ALL alternatives are subtypes
  addBinding(union, "subtypeof", makePrimitive("UnionType.subtypeof", (args) => {
    const target = args[0] as ContextValue;
    for (const alt of alternatives) {
      const altSubtype = alt.bindings.get("subtypeof")?.value;
      if (!altSubtype || altSubtype.kind !== ValueKind.PrimitiveFunction) return makeInt(0);
      const result = altSubtype.fn([target], undefined as any, undefined as any);
      if (result.kind === ValueKind.Bits && (result as BitsValue).data === 0n) return makeInt(0);
    }
    return makeInt(1);
  }));

  // Set __type to Type (unions are structural)
  addBinding(union, "__type", Type);

  return union;
}

// Bootstrap: Type and NamedType get their own type components
// Type's type is Type (self-referential)
// NamedType's type is NamedType (it's a named type itself)
// We can't use withType (returns MultiValue) since these are Contexts used directly.
// Instead, we store a __type binding that type_dispatch can check.
addBinding(Type, "__type", Type);
addBinding(NamedType, "__type", NamedType);

// --- Type builder helper ---

/** Names of properties that should be treated as getters (auto-called with self) */
const getterNames = new Set(["length"]);

/**
 * Build a named type. All types built this way are NamedTypes with nominal
 * instanceof/subtypeof semantics. The type's own type is NamedType.
 *
 * @param name     Type name (e.g., "Int", "String")
 * @param methods  Instance methods (dispatched via type_dispatch on values of this type)
 * @param options  Optional: extends (parent type)
 */
function buildType(
  name: string,
  methods: Record<string, PrimitiveFnImpl>,
  options?: { extends?: ContextValue },
): ContextValue {
  const ctx = makeContext();
  // __name
  addBinding(ctx, "__name", stringToBits(name));
  // __type = NamedType (this type is a named type)
  addBinding(ctx, "__type", NamedType);
  // __extends (optional parent type for nominal subtyping chain)
  if (options?.extends) {
    addBinding(ctx, "__extends", options.extends);
  }
  // methods
  for (const [key, fn] of Object.entries(methods)) {
    const prim = makePrimitive(`${name}.${key}`, fn);
    if (getterNames.has(key)) {
      (prim as any).__getter = true;
    }
    addBinding(ctx, key, prim);
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
    return withType(makeInt(s.length), IntType);
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
  trim: (args) => {
    const s = bitsToString(asBitsTyped(args[0], "String.trim"));
    return withType(stringToBits(s.trim()), StringType);
  },
  startsWith: (args) => {
    const s = bitsToString(asBitsTyped(args[0], "String.startsWith"));
    const prefix = bitsToString(asBitsTyped(args[1], "String.startsWith"));
    return withType(makeInt(s.startsWith(prefix) ? 1 : 0), BoolType);
  },
  endsWith: (args) => {
    const s = bitsToString(asBitsTyped(args[0], "String.endsWith"));
    const suffix = bitsToString(asBitsTyped(args[1], "String.endsWith"));
    return withType(makeInt(s.endsWith(suffix) ? 1 : 0), BoolType);
  },
  includes: (args) => {
    const s = bitsToString(asBitsTyped(args[0], "String.includes"));
    const search = bitsToString(asBitsTyped(args[1], "String.includes"));
    return withType(makeInt(s.includes(search) ? 1 : 0), BoolType);
  },
  split: (args) => {
    const s = bitsToString(asBitsTyped(args[0], "String.split"));
    const delimiter = bitsToString(asBitsTyped(args[1], "String.split"));
    const parts = s.split(delimiter);
    return makeArray(parts.map(p => withType(stringToBits(p), StringType)));
  },
  replace: (args) => {
    const s = bitsToString(asBitsTyped(args[0], "String.replace"));
    const search = bitsToString(asBitsTyped(args[1], "String.replace"));
    const replacement = bitsToString(asBitsTyped(args[2], "String.replace"));
    // Optional count parameter: default replaces all occurrences
    const count = args.length > 3
      ? Number(toSigned(asBitsTyped(args[3], "String.replace")))
      : -1; // -1 = replace all
    let result = s;
    if (count === -1) {
      result = result.split(search).join(replacement);
    } else {
      for (let i = 0; i < count; i++) {
        const idx = result.indexOf(search);
        if (idx === -1) break;
        result = result.slice(0, idx) + replacement + result.slice(idx + search.length);
      }
    }
    return withType(stringToBits(result), StringType);
  },
  toUpperCase: (args) => {
    const s = bitsToString(asBitsTyped(args[0], "String.toUpperCase"));
    return withType(stringToBits(s.toUpperCase()), StringType);
  },
  toLowerCase: (args) => {
    const s = bitsToString(asBitsTyped(args[0], "String.toLowerCase"));
    return withType(stringToBits(s.toLowerCase()), StringType);
  },
  charAt: (args) => {
    const s = bitsToString(asBitsTyped(args[0], "String.charAt"));
    const idx = Number(toSigned(asBitsTyped(args[1], "String.charAt")));
    if (idx < 0 || idx >= s.length) return withType(stringToBits(""), StringType);
    return withType(stringToBits(s.charAt(idx)), StringType);
  },
  repeat: (args) => {
    const s = bitsToString(asBitsTyped(args[0], "String.repeat"));
    const count = Number(toSigned(asBitsTyped(args[1], "String.repeat")));
    if (count < 0) throw new AllegroError("String.repeat: count must be non-negative");
    return withType(stringToBits(s.repeat(count)), StringType);
  },
  toCharCodes: (args) => {
    const s = bitsToString(asBitsTyped(args[0], "String.toCharCodes"));
    const codes: Value[] = [];
    for (let i = 0; i < s.length; i++) {
      codes.push(withType(makeInt(s.charCodeAt(i)), IntType));
    }
    return makeArray(codes);
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

/** Build a raw array Context (without type wrapping). Used internally. */
function makeRawArrayCtx(elements: Value[]): ContextValue {
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
  return ctx;
}

/** Create a typed Array value from a list of Allegro values.
 *  Infers element type: if all elements have the same type, uses Array[T].
 *  Otherwise uses bare Array (unparameterized). */
export function makeArray(elements: Value[]): Value {
  const ctx = makeRawArrayCtx(elements);

  // Infer element type from elements
  // Note: ArrayType may not be initialized during module loading (circular),
  // so we check before using it for parameterized types.
  let arrayType: ContextValue = ArrayType;
  if (elements.length > 0 && isGenericType(ArrayType)) {
    const firstType = getType(elements[0]);
    if (firstType && elements.every(e => {
      const t = getType(e);
      return t !== null && getTypeName(e) === getTypeName(elements[0]);
    })) {
      arrayType = applyGenericType(ArrayType, [firstType]);
    }
  }

  return withType(ctx, arrayType);
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
// UntypedFunction Type
// Wraps base language / extension primitives that enter Standard mode.
// These are callable but have no type information about params or return.
// The arity is tracked when known.
// =============================================================================

const untypedFnMethods: Record<string, PrimitiveFnImpl> = {
  toString: ((args: Value[]) => {
    return withType(stringToBits("<untyped function>"), StringType);
  }) as PrimitiveFnImpl,
};

// =============================================================================
// Any Type
// Matches any value. Used for unparameterized generics (Array = Array[Any])
// and explicit opt-out of type checking.
// =============================================================================

const anyMethods: Record<string, PrimitiveFnImpl> = {
  toString: ((args: Value[]) => {
    return withType(stringToBits("<any>"), StringType);
  }) as PrimitiveFnImpl,
};

// =============================================================================
// Build Type Contexts
// =============================================================================

export const AnyType: ContextValue = buildType("Any", anyMethods);
export const IntType: ContextValue = buildType("Int", intMethods);
export const FloatType: ContextValue = buildType("Float", floatMethods);
export const StringType: ContextValue = buildType("String", stringMethods);
export const BoolType: ContextValue = buildType("Bool", boolMethods);
export const ObjectType: ContextValue = buildType("Object", objectMethods);
// Object __getMember: allows access to any field on the underlying Context.
// Called by type_dispatch when the field isn't a type method.
const objectGetMember = makePrimitive("Object.__getMember", (args) => {
  const ctx = args[0] as ContextValue;
  const fieldName = bitsToString(args[1] as BitsValue);
  const b = ctx.bindings.get(fieldName);
  if (!b?.value) throw new AllegroError(`Object: field '${fieldName}' not found`);
  return b.value;
});
addBinding(ObjectType, "__getMember", objectGetMember);
export const UntypedFunctionType: ContextValue = buildType("UntypedFunction", untypedFnMethods);

// =============================================================================
// Generic Type Infrastructure
// =============================================================================

/**
 * Build a GenericType: a type constructor that takes type parameters and
 * produces concrete types. Each unique parameterization is memoized.
 *
 * @param name       Base name (e.g., "Array")
 * @param paramNames Parameter names (e.g., ["T"])
 * @param methods    Method implementations (shared by all concrete types)
 * @param makeConcreteType  Function that builds a concrete type given args
 */
export function buildGenericType(
  name: string,
  paramNames: string[],
  methods: Record<string, PrimitiveFnImpl>,
  makeConcreteType?: (generic: ContextValue, args: Value[]) => ContextValue,
): ContextValue {
  // Memoization cache: keyed by arg identity (reference equality)
  const cache = new Map<string, ContextValue>();

  function cacheKey(args: Value[]): string {
    return args.map((a, idx) => cacheKeyOne(a, idx)).join(",");
  }

  function cacheKeyOne(a: Value, idx: number): string {
    if (a.kind === ValueKind.Context) {
      const ctx = a as ContextValue;
      // Named type (Int, String, Array, etc.)
      const nb = ctx.bindings.get("__name");
      if (nb?.value?.kind === ValueKind.Bits) {
        const typeName = bitsToString(nb.value);
        // Check for type args (concrete generic like Array[Int])
        const argsB = ctx.bindings.get("__args");
        if (argsB?.value?.kind === ValueKind.Context) {
          const argsCtx = argsB.value as ContextValue;
          const argElems = arrayElements(argsCtx);
          return `${typeName}[${argElems.map((e, i) => cacheKeyOne(e, i)).join(";")}]`;
        }
        return typeName;
      }
      // Array-like Context (used as param types list)
      const lenB = ctx.bindings.get("__length");
      if (lenB?.value?.kind === ValueKind.Bits) {
        const len = Number((lenB.value as BitsValue).data);
        const elems: string[] = [];
        for (let i = 0; i < len; i++) {
          const eb = ctx.bindings.get(String(i));
          if (eb?.value) elems.push(cacheKeyOne(eb.value, i));
        }
        return `arr(${elems.join(";")})`;
      }
      // Generic Context — use binding count as rough key
      return `ctx:${ctx.bindings.size}:${idx}`;
    }
    if (a.kind === ValueKind.Bits) return `v:${(a as BitsValue).data}`;
    if (a.kind === ValueKind.MultiValue) {
      const p = primaryOf(a);
      if (p.kind === ValueKind.Bits) return `v:${(p as BitsValue).data}`;
      return cacheKeyOne(p, idx);
    }
    // Params and Symbols (type variables) — unique per name
    if (a.kind === ValueKind.Param) return `param:${(a as any)._name ?? idx}`;
    if (a.kind === ValueKind.Symbol) return `sym:${(a as any).name}`;
    return `unk:${idx}`;
  }

  // Build the base type with methods + generic metadata
  const ctx = buildType(name, methods);

  // Add __params (use raw array to avoid circular dep with ArrayType)
  const paramsKey = "__params";
  const paramsVal = makeRawArrayCtx(paramNames.map(n => stringToBits(n)));
  ctx.bindings.set(paramsKey, { key: paramsKey, value: paramsVal, isUse: false });
  ctx.bindingList.push({ key: paramsKey, value: paramsVal, isUse: false });

  // Add __constructor
  const constructorFn = makePrimitive(`${name}.__constructor`, (args: Value[]) => {
    const key = cacheKey(args);
    const cached = cache.get(key);
    if (cached) return cached;

    let concrete: ContextValue;
    if (makeConcreteType) {
      concrete = makeConcreteType(ctx, args);
    } else {
      concrete = defaultConcreteType(ctx, name, args, methods);
    }
    cache.set(key, concrete);
    return concrete;
  });
  const ctorKey = "__constructor";
  ctx.bindings.set(ctorKey, { key: ctorKey, value: constructorFn, isUse: false });
  ctx.bindingList.push({ key: ctorKey, value: constructorFn, isUse: false });

  // Mark as generic
  const genericKey = "__isGeneric";
  const genericVal = makeInt(1);
  ctx.bindings.set(genericKey, { key: genericKey, value: genericVal, isUse: false });
  ctx.bindingList.push({ key: genericKey, value: genericVal, isUse: false });

  return ctx;
}

/**
 * Default concrete type builder: creates a type Context that inherits
 * methods from the generic and records the applied type arguments.
 */
function defaultConcreteType(
  generic: ContextValue,
  name: string,
  args: Value[],
  methods: Record<string, PrimitiveFnImpl>,
): ContextValue {
  const concrete = buildType(name, methods);

  // __generic: reference to the generic type
  const genKey = "__generic";
  concrete.bindings.set(genKey, { key: genKey, value: generic, isUse: false });
  concrete.bindingList.push({ key: genKey, value: generic, isUse: false });

  // __args: the applied type arguments (raw array to avoid circular deps)
  const argsKey = "__args";
  const argsVal = makeRawArrayCtx(args);
  concrete.bindings.set(argsKey, { key: argsKey, value: argsVal, isUse: false });
  concrete.bindingList.push({ key: argsKey, value: argsVal, isUse: false });

  return concrete;
}

/**
 * Check if a type is a generic type (has __isGeneric).
 */
export function isGenericType(type: ContextValue): boolean {
  const b = type.bindings.get("__isGeneric");
  return b?.value !== undefined;
}

/**
 * Get the type arguments from a concrete parameterized type.
 * Returns null if the type has no __args.
 */
export function getTypeArgs(type: ContextValue): Value[] | null {
  const b = type.bindings.get("__args");
  if (!b?.value) return null;
  const ctx = primaryOf(b.value);
  if (ctx.kind !== ValueKind.Context) return null;
  return arrayElements(ctx as ContextValue);
}

/**
 * Get the generic type from a concrete parameterized type.
 */
export function getGenericType(type: ContextValue): ContextValue | null {
  const b = type.bindings.get("__generic");
  if (!b?.value || b.value.kind !== ValueKind.Context) return null;
  return b.value;
}

/**
 * Get the number of type parameters on a generic type.
 */
function getGenericParamCount(generic: ContextValue): number {
  const paramsBinding = generic.bindings.get("__params");
  if (!paramsBinding?.value) return 0;
  const paramsCtx = primaryOf(paramsBinding.value);
  if (paramsCtx.kind !== ValueKind.Context) return 0;
  const lenBinding = (paramsCtx as ContextValue).bindings.get("__length");
  return lenBinding?.value ? Number((lenBinding.value as BitsValue).data) : 0;
}

/**
 * Normalize a type for use in type checking. If the type is a bare generic
 * (e.g., Array without type arguments), resolve it to Generic[Any, ...] by
 * applying AnyType for each parameter.
 */
export function normalizeType(type: ContextValue): ContextValue {
  if (!isGenericType(type)) return type;
  const paramCount = getGenericParamCount(type);
  if (paramCount === 0) return type;
  const anyArgs = Array.from({ length: paramCount }, () => AnyType as Value);
  return applyGenericType(type, anyArgs);
}

/**
 * Apply type arguments to a generic type, returning the concrete type.
 */
export function applyGenericType(generic: ContextValue, args: Value[]): ContextValue {
  const ctor = generic.bindings.get("__constructor");
  if (!ctor?.value || ctor.value.kind !== ValueKind.PrimitiveFunction) {
    throw new AllegroError(`Not a generic type: ${bitsToString(generic.bindings.get("__name")?.value as BitsValue ?? stringToBits("unknown"))}`);
  }
  return ctor.value.fn(args, undefined as any, undefined as any) as ContextValue;
}

// =============================================================================
// Array as GenericType
// =============================================================================

export const ArrayType: ContextValue = buildGenericType("Array", ["T"], arrayMethods);

// =============================================================================
// Function Type (Generic)
// Function[ParamTypes, ReturnType] where ParamTypes is an Array of types.
// e.g., Function[[Int, String], Bool] for (Int, String) -> Bool
// =============================================================================

const functionTypeMethods: Record<string, PrimitiveFnImpl> = {
  toString: ((args: Value[]) => {
    return withType(stringToBits("<function type>"), StringType);
  }) as PrimitiveFnImpl,
};

export const FunctionType: ContextValue = buildGenericType("Function", ["ParamTypes", "ReturnType"], functionTypeMethods);

/** Create a concrete FunctionType from param types and return type. */
export function makeFunctionType(paramTypes: Value[], returnType: Value): ContextValue {
  const paramTypesArr = makeRawArrayCtx(paramTypes);
  return applyGenericType(FunctionType, [paramTypesArr, returnType]);
}

/** Extract param types from a concrete FunctionType. Returns null if not a FunctionType. */
export function getFunctionParamTypes(fnType: ContextValue): Value[] | null {
  const args = getTypeArgs(fnType);
  if (!args || args.length < 2) return null;
  const paramTypesCtx = primaryOf(args[0]);
  if (paramTypesCtx.kind !== ValueKind.Context) return null;
  return arrayElements(paramTypesCtx as ContextValue);
}

/** Extract return type from a concrete FunctionType. Returns null if not a FunctionType. */
export function getFunctionReturnType(fnType: ContextValue): Value | null {
  const args = getTypeArgs(fnType);
  if (!args || args.length < 2) return null;
  return args[1];
}

// =============================================================================
// Unification
// Type variable bindings accumulate in a Map<string, Value> (varName → type).
// =============================================================================

export type TypeBindings = Map<string, Value>;

/**
 * Unify an actual type against an expected type expression.
 * Type variables (Params) in expectedType get bound in the bindings map.
 * Returns updated bindings. Throws on contradiction.
 */
export function unifyTypes(
  actualType: Value | null,
  expectedType: Value,
  bindings: TypeBindings,
): TypeBindings {
  // If expected is a type variable (Symbol or unresolved Param)
  if (expectedType.kind === ValueKind.Symbol) {
    const varName = (expectedType as any).name;
    if (!varName) return bindings;
    const existing = bindings.get(varName);
    if (existing) {
      const existingName = typeContextName(existing);
      const actualName = actualType ? typeContextName(actualType) : null;
      if (existingName && actualName && existingName !== actualName) {
        throw new AllegroError(`Type variable ${varName}: conflicting bindings ${existingName} vs ${actualName}`);
      }
      return bindings;
    }
    if (actualType) {
      bindings.set(varName, actualType);
    }
    return bindings;
  }
  // Legacy: Param as type variable
  if (expectedType.kind === ValueKind.Param) {
    const varName = (expectedType as any)._name;
    if (!varName) return bindings; // positional param, can't unify
    const existing = bindings.get(varName);
    if (existing) {
      // Check consistency — both existing and actual are type Contexts
      const existingName = typeContextName(existing);
      const actualName = actualType ? typeContextName(actualType) : null;
      if (existingName && actualName && existingName !== actualName) {
        throw new AllegroError(`Type variable ${varName}: conflicting bindings ${existingName} vs ${actualName}`);
      }
      return bindings;
    }
    if (actualType) {
      bindings.set(varName, actualType);
    }
    return bindings;
  }

  // If expected is Any, always matches
  if (expectedType.kind === ValueKind.Context) {
    const expectedName = bitsToString(
      ((expectedType as ContextValue).bindings.get("__name")?.value as BitsValue) ?? stringToBits(""),
    );
    if (expectedName === "Any") return bindings;
  }

  // If expected is a concrete type
  if (expectedType.kind === ValueKind.Context && actualType) {
    const expectedCtx = expectedType as ContextValue;
    const actualCtx = getType(actualType);
    if (!actualCtx) return bindings; // no type on actual, can't unify

    // Check base name
    const expectedName = bitsToString(
      (expectedCtx.bindings.get("__name")?.value as BitsValue) ?? stringToBits(""),
    );
    const actualName = bitsToString(
      (actualCtx.bindings.get("__name")?.value as BitsValue) ?? stringToBits(""),
    );
    if (expectedName !== actualName) {
      throw new AllegroError(`Type mismatch: expected ${expectedName}, got ${actualName}`);
    }

    // Recursively unify type arguments
    const expectedArgs = getTypeArgs(expectedCtx);
    const actualArgs = getTypeArgs(actualCtx);
    if (expectedArgs && actualArgs) {
      const len = Math.min(expectedArgs.length, actualArgs.length);
      for (let i = 0; i < len; i++) {
        unifyTypes(actualArgs[i], expectedArgs[i], bindings);
      }
    }
  }

  return bindings;
}

/**
 * Resolve a type expression by substituting bound type variables.
 * Returns the resolved type value, or the original if no variables to substitute.
 */
export function resolveTypeWithBindings(typeExpr: Value, bindings: TypeBindings): Value {
  if (typeExpr.kind === ValueKind.Symbol) {
    const varName = (typeExpr as any).name;
    if (varName && bindings.has(varName)) return bindings.get(varName)!;
    return typeExpr;
  }
  if (typeExpr.kind === ValueKind.Param) {
    const varName = (typeExpr as any)._name;
    if (varName && bindings.has(varName)) {
      return bindings.get(varName)!;
    }
    return typeExpr;
  }

  if (typeExpr.kind === ValueKind.Context) {
    const ctx = typeExpr as ContextValue;
    const argsBinding = ctx.bindings.get("__args");
    if (argsBinding?.value) {
      const argsCtx = primaryOf(argsBinding.value);
      if (argsCtx.kind === ValueKind.Context) {
        const args = arrayElements(argsCtx as ContextValue);
        const resolvedArgs = args.map(a => resolveTypeWithBindings(a, bindings));
        if (resolvedArgs.some((a, i) => a !== args[i])) {
          // Need to reconstruct the concrete type with resolved args
          const generic = getGenericType(ctx);
          if (generic) {
            return applyGenericType(generic, resolvedArgs);
          }
        }
      }
    }
  }

  return typeExpr;
}

// =============================================================================
// Type System Extension
// =============================================================================

/**
 * Wrap a function value (PrimitiveFunction or ComposedFunction) as UntypedFunction.
 * Attaches arity as a component when known.
 */
export function wrapAsUntypedFunction(fn: Value, arity?: number): Value {
  const primary = primaryOf(fn);
  const components = fn.kind === ValueKind.MultiValue
    ? new Map(fn.components)
    : new Map<string, Value>();
  components.set("type", UntypedFunctionType);
  if (arity !== undefined) {
    components.set("arity", makeInt(arity));
  }
  return makeMultiValue(primary, components);
}

/**
 * Check if a value is a function (PrimitiveFunction or ComposedFunction).
 */
function isFunctionValue(v: Value): boolean {
  const p = primaryOf(v);
  return p.kind === ValueKind.PrimitiveFunction || p.kind === ValueKind.ComposedFunction;
}

export function createTypeSystem(): Extension {
  return {
    name: "types",
    bindings: {
      Any: AnyType,
      Int: IntType,
      Float: FloatType,
      String: StringType,
      Bool: BoolType,
      Array: ArrayType,
      Object: ObjectType,
      Function: FunctionType,
      UntypedFunction: UntypedFunctionType,
      // Meta-types
      Type: Type,
      NamedType: NamedType,
      // Bool literals as context bindings (parsed as identifiers, resolved here)
      true: withType(makeInt(1), BoolType) as any,
      false: withType(makeInt(0), BoolType) as any,
    },
  };
}
