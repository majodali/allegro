// Allegro Base Language - Primitive Functions

import {
  Value, ValueKind, BitsValue, ContextValue,
  PrimitiveFunctionValue, PrimitiveFnImpl, EvalFn,
  AllegroError, makeBits, makeInt, makeFloat, bitsToFloat, makePrimitive, makeExpr,
  makeParam, makeComposedFn, makeContext, makeMultiValue,
  primaryOf, stringToBits, bitsToString,
} from "./types.js";

// --- Value formatting ---

export function formatValue(v: Value): string {
  // Check for typed values (MultiValue with "type" component)
  if (v.kind === ValueKind.MultiValue) {
    const typeComp = v.components.get("type");
    if (typeComp && typeComp.kind === ValueKind.Context) {
      const nameBinding = typeComp.bindings.get("__name");
      if (nameBinding?.value && nameBinding.value.kind === ValueKind.Bits) {
        const typeName = bitsToString(nameBinding.value);
        if (typeName === "String") {
          return bitsToString(v.primary as BitsValue);
        }
        if (typeName === "Bool") {
          return (v.primary as BitsValue).data !== 0n ? "true" : "false";
        }
        if (typeName === "Float") {
          return String(bitsToFloat(v.primary as BitsValue));
        }
        if (typeName === "Array") {
          // Display array elements
          const ctx = v.primary as ContextValue;
          const lenB = ctx.bindings.get("__length");
          const len = lenB?.value ? Number((lenB.value as BitsValue).data) : 0;
          const elems: string[] = [];
          for (let i = 0; i < len && i < 10; i++) {
            const b = ctx.bindings.get(String(i));
            if (b?.value) elems.push(formatValue(b.value));
          }
          if (len > 10) elems.push("...");
          return `[${elems.join(", ")}]`;
        }
        if (typeName === "Object") {
          const ctx = v.primary as ContextValue;
          const fields: string[] = [];
          for (const [key, binding] of ctx.bindings) {
            if (binding.value && fields.length < 5) {
              fields.push(`${key}: ${formatValue(binding.value)}`);
            }
          }
          if (ctx.bindings.size > 5) fields.push("...");
          return `{${fields.join(", ")}}`;
        }
        if (typeName === "Function") {
          const p = v.primary;
          if (p.kind === ValueKind.ComposedFunction) {
            return `<function(${p.params.length})>`;
          }
          return `<function>`;
        }
        // Int — display the primary normally
      }
    }
  }
  const p = primaryOf(v);
  switch (p.kind) {
    case ValueKind.Bits: {
      // Try to display as signed 64-bit integer
      if (p.length === 64) return String(toSignedExport(p));
      return `Bits(${p.length}, 0x${p.data.toString(16)})`;
    }
    case ValueKind.PrimitiveFunction:
      return `<primitive:${p.name}>`;
    case ValueKind.ComposedFunction:
      return `<function(${p.params.length})>`;
    case ValueKind.Expression:
      return `<expression>`;
    case ValueKind.Context:
      return `<context(${p.bindings.size})>`;
    case ValueKind.MultiValue:
      return formatValue(p.primary);
    case ValueKind.Param:
      return `<param:${p._name ?? p.position}>`;
    case ValueKind.Symbol:
      return `<symbol:${p.name}>`;
  }
}

function toSignedExport(b: BitsValue): bigint {
  if (b.length === 64 && b.data >= 2n ** 63n) return b.data - 2n ** 64n;
  return b.data;
}

// --- Helpers ---

function asBits(v: Value, ctx: string): BitsValue {
  const p = primaryOf(v);
  if (p.kind !== ValueKind.Bits) throw new AllegroError(`${ctx}: expected Bits, got ${p.kind}`);
  return p;
}

function asCtx(v: Value, ctx: string): ContextValue {
  const p = primaryOf(v);
  if (p.kind !== ValueKind.Context) throw new AllegroError(`${ctx}: expected Context, got ${p.kind}`);
  return p;
}

function toSigned(b: BitsValue): bigint {
  if (b.length === 64 && b.data >= 2n ** 63n) return b.data - 2n ** 64n;
  return b.data;
}

function fromBool(v: boolean): BitsValue { return makeInt(v ? 1 : 0); }

// ============ BITS ============

const bits_new: PrimitiveFnImpl = (args) => {
  const len = Number(asBits(args[0], "bits_new").data);
  const val = asBits(args[1], "bits_new").data;
  return makeBits(len, val);
};

const bits_length: PrimitiveFnImpl = (args) => makeInt(asBits(args[0], "bits_length").length);

const bits_get: PrimitiveFnImpl = (args) => {
  const b = asBits(args[0], "bits_get"), i = Number(asBits(args[1], "bits_get").data);
  if (i < 0 || i >= b.length) throw new AllegroError(`bits_get: index ${i} out of range`);
  return makeInt(Number((b.data >> BigInt(i)) & 1n));
};

const bits_set: PrimitiveFnImpl = (args) => {
  const b = asBits(args[0], "bits_set"), i = Number(asBits(args[1], "bits_set").data);
  const val = asBits(args[2], "bits_set");
  if (i < 0 || i >= b.length) throw new AllegroError(`bits_set: index ${i} out of range`);
  const newData = (val.data & 1n) ? (b.data | (1n << BigInt(i))) : (b.data & ~(1n << BigInt(i)));
  return makeBits(b.length, newData);
};

const bits_slice: PrimitiveFnImpl = (args) => {
  const b = asBits(args[0], "bits_slice");
  const start = Number(asBits(args[1], "bits_slice").data);
  const end = Number(asBits(args[2], "bits_slice").data);
  const len = end - start;
  if (len < 0 || start < 0 || end > b.length) throw new AllegroError("bits_slice: invalid range");
  const mask = len === 0 ? 0n : (1n << BigInt(len)) - 1n;
  return makeBits(len, (b.data >> BigInt(start)) & mask);
};

const bits_concat: PrimitiveFnImpl = (args) => {
  const a = asBits(args[0], "bits_concat"), b = asBits(args[1], "bits_concat");
  return makeBits(a.length + b.length, a.data | (b.data << BigInt(a.length)));
};

const bits_and: PrimitiveFnImpl = (args) => {
  const a = asBits(args[0], "bits_and"), b = asBits(args[1], "bits_and");
  return makeBits(Math.max(a.length, b.length), a.data & b.data);
};

const bits_or: PrimitiveFnImpl = (args) => {
  const a = asBits(args[0], "bits_or"), b = asBits(args[1], "bits_or");
  return makeBits(Math.max(a.length, b.length), a.data | b.data);
};

const bits_xor: PrimitiveFnImpl = (args) => {
  const a = asBits(args[0], "bits_xor"), b = asBits(args[1], "bits_xor");
  return makeBits(Math.max(a.length, b.length), a.data ^ b.data);
};

const bits_not: PrimitiveFnImpl = (args) => {
  const b = asBits(args[0], "bits_not");
  const mask = b.length === 0 ? 0n : (1n << BigInt(b.length)) - 1n;
  return makeBits(b.length, ~b.data & mask);
};

const bits_eq: PrimitiveFnImpl = (args) => {
  const a = asBits(args[0], "bits_eq"), b = asBits(args[1], "bits_eq");
  return fromBool(a.data === b.data && a.length === b.length);
};

const bits_neq: PrimitiveFnImpl = (args) => {
  const a = asBits(args[0], "bits_neq"), b = asBits(args[1], "bits_neq");
  return fromBool(a.data !== b.data || a.length !== b.length);
};

// Arithmetic (signed 64-bit)
const bits_add: PrimitiveFnImpl = (args) => {
  const a = toSigned(asBits(args[0], "bits_add")), b = toSigned(asBits(args[1], "bits_add"));
  return makeInt(Number(a + b));
};

const bits_sub: PrimitiveFnImpl = (args) => {
  const a = toSigned(asBits(args[0], "bits_sub")), b = toSigned(asBits(args[1], "bits_sub"));
  return makeInt(Number(a - b));
};

const bits_mul: PrimitiveFnImpl = (args) => {
  const a = toSigned(asBits(args[0], "bits_mul")), b = toSigned(asBits(args[1], "bits_mul"));
  return makeInt(Number(a * b));
};

const bits_div: PrimitiveFnImpl = (args) => {
  const a = toSigned(asBits(args[0], "bits_div")), b = toSigned(asBits(args[1], "bits_div"));
  if (b === 0n) throw new AllegroError("bits_div: division by zero");
  return makeInt(Number(a / b));
};

const bits_mod: PrimitiveFnImpl = (args) => {
  const a = toSigned(asBits(args[0], "bits_mod")), b = toSigned(asBits(args[1], "bits_mod"));
  if (b === 0n) throw new AllegroError("bits_mod: division by zero");
  return makeInt(Number(a % b));
};

const bits_lt: PrimitiveFnImpl = (args) => fromBool(toSigned(asBits(args[0], "bits_lt")) < toSigned(asBits(args[1], "bits_lt")));
const bits_gt: PrimitiveFnImpl = (args) => fromBool(toSigned(asBits(args[0], "bits_gt")) > toSigned(asBits(args[1], "bits_gt")));
const bits_lte: PrimitiveFnImpl = (args) => fromBool(toSigned(asBits(args[0], "bits_lte")) <= toSigned(asBits(args[1], "bits_lte")));
const bits_gte: PrimitiveFnImpl = (args) => fromBool(toSigned(asBits(args[0], "bits_gte")) >= toSigned(asBits(args[1], "bits_gte")));

// ============ EXPRESSION ============

const expr_apply: PrimitiveFnImpl = (args) => {
  if (args.length < 1) throw new AllegroError("expr_apply: need at least a function");
  return makeExpr(args[0], args.slice(1));
};

const expr_fn: PrimitiveFnImpl = (args) => {
  const e = primaryOf(args[0]);
  if (e.kind !== ValueKind.Expression) throw new AllegroError("expr_fn: expected Expression");
  return e.fn;
};

const expr_args: PrimitiveFnImpl = (args) => {
  const e = primaryOf(args[0]);
  if (e.kind !== ValueKind.Expression) throw new AllegroError("expr_args: expected Expression");
  return makeExpr(id_prim, e.args);
};

const expr_arg: PrimitiveFnImpl = (args) => {
  const e = primaryOf(args[0]);
  if (e.kind !== ValueKind.Expression) throw new AllegroError("expr_arg: expected Expression");
  const i = Number(asBits(args[1], "expr_arg").data);
  if (i < 0 || i >= e.args.length) throw new AllegroError(`expr_arg: index ${i} out of range`);
  return e.args[i];
};

const expr_argc: PrimitiveFnImpl = (args) => {
  const e = primaryOf(args[0]);
  if (e.kind !== ValueKind.Expression) throw new AllegroError("expr_argc: expected Expression");
  return makeInt(e.args.length);
};

const expr_param: PrimitiveFnImpl = (args) => {
  return makeParam(Number(asBits(args[0], "expr_param").data));
};

const expr_function: PrimitiveFnImpl = (args) => {
  if (args.length < 1) throw new AllegroError("expr_function: need a body");
  const body = args[0];
  const unowned: import("./types.js").ParamValue[] = [];
  collectUnownedParams(body, unowned, new Set());
  unowned.sort((a, b) => a.position - b.position);
  // Deduplicate
  const seen = new Set<number>();
  const unique = unowned.filter(p => { if (seen.has(p.position)) return false; seen.add(p.position); return true; });
  return makeComposedFn(unique, body);
};

function collectUnownedParams(v: Value, out: import("./types.js").ParamValue[], seen: Set<Value>): void {
  if (seen.has(v)) return;
  seen.add(v);
  switch (v.kind) {
    case ValueKind.Param:
      if (v.owner === null) out.push(v);
      break;
    case ValueKind.Expression:
      collectUnownedParams(v.fn, out, seen);
      for (const a of v.args) collectUnownedParams(a, out, seen);
      break;
    case ValueKind.MultiValue:
      collectUnownedParams(v.primary, out, seen);
      break;
    case ValueKind.ComposedFunction:
      break; // don't descend - inner params are owned
    default:
      break;
  }
}

const expr_eval: PrimitiveFnImpl = (args, _ctx, evalFn) => {
  const expr = args[0];
  const ctx = asCtx(args[1], "expr_eval");
  return evalFn(expr, ctx);
};

// ============ CONTEXT ============

const ctx_new: PrimitiveFnImpl = () => makeContext();

const ctx_bind: PrimitiveFnImpl = (args) => {
  const ctx = asCtx(args[0], "ctx_bind");
  const key = bitsToString(asBits(args[1], "ctx_bind"));
  const value = args[2];
  const newCtx = makeContext();
  for (const [k, b] of ctx.bindings) {
    const copy = { ...b };
    newCtx.bindings.set(k, copy);
    newCtx.bindingList.push(copy);
  }
  const binding = { key, value, isUse: false };
  newCtx.bindings.set(key, binding);
  newCtx.bindingList.push(binding);
  return newCtx;
};

const ctx_resolve: PrimitiveFnImpl = (args) => {
  const ctx = asCtx(args[0], "ctx_resolve");
  const key = bitsToString(asBits(args[1], "ctx_resolve"));
  const b = ctx.bindings.get(key);
  if (!b) throw new AllegroError(`ctx_resolve: '${key}' not found`);
  if (b.value === undefined) throw new AllegroError(`ctx_resolve: '${key}' is unbound`);
  return b.value;
};

const ctx_bindings: PrimitiveFnImpl = (args) => {
  const ctx = asCtx(args[0], "ctx_bindings");
  const pairs: Value[] = [];
  for (const b of ctx.bindingList) {
    if (b.key !== null && b.value !== undefined) {
      pairs.push(makeExpr(id_prim, [stringToBits(b.key), b.value]));
    }
  }
  return makeExpr(id_prim, pairs);
};

const ctx_use: PrimitiveFnImpl = (args) => {
  const ctx = asCtx(args[0], "ctx_use");
  const key = bitsToString(asBits(args[1], "ctx_use"));
  const newCtx = makeContext();
  for (const [k, b] of ctx.bindings) {
    const copy = { ...b };
    newCtx.bindings.set(k, copy);
    newCtx.bindingList.push(copy);
  }
  const binding = { key, value: undefined, isUse: true };
  newCtx.bindings.set(key, binding);
  newCtx.bindingList.push(binding);
  return newCtx;
};

// ============ MULTI-VALUE ============

const mv_new: PrimitiveFnImpl = (args) => makeMultiValue(args[0]);

const mv_primary: PrimitiveFnImpl = (args) => primaryOf(args[0]);

const mv_get: PrimitiveFnImpl = (args) => {
  const key = bitsToString(asBits(args[1], "mv_get"));
  if (args[0].kind === ValueKind.MultiValue) {
    const c = args[0].components.get(key);
    if (c === undefined) throw new AllegroError(`mv_get: '${key}' not found`);
    return c;
  }
  throw new AllegroError(`mv_get: '${key}' not found`);
};

const mv_set: PrimitiveFnImpl = (args) => {
  const key = bitsToString(asBits(args[1], "mv_set"));
  const val = args[2];
  if (args[0].kind === ValueKind.MultiValue) {
    const nc = new Map(args[0].components);
    nc.set(key, val);
    return makeMultiValue(args[0].primary, nc);
  }
  return makeMultiValue(args[0], new Map([[key, val]]));
};

const mv_components: PrimitiveFnImpl = (args) => {
  if (args[0].kind === ValueKind.MultiValue) {
    const keys: Value[] = [];
    for (const k of args[0].components.keys()) keys.push(stringToBits(k));
    return makeExpr(id_prim, keys);
  }
  return makeExpr(id_prim, []);
};

// ============ EVAL_IF (lazy) ============

const eval_if_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  if (args.length !== 3) throw new AllegroError(`eval_if: need 3 args, got ${args.length}`);
  const cond = evalFn!(args[0], ctx!);
  const condP = primaryOf(cond);
  if (condP.kind === ValueKind.Bits) {
    const branch = condP.data !== 0n ? args[1] : args[2];
    // If branch is a thunk (composed fn with no params), evaluate its body
    const evalBranch = evalFn!(branch, ctx!);
    if (evalBranch.kind === ValueKind.ComposedFunction && evalBranch.params.length === 0) {
      return evalFn!(evalBranch.body, ctx!);
    }
    return evalBranch;
  }
  // Condition unresolved — Rule 2: partially evaluate BOTH branches
  // so that type information and other MultiValue components propagate.
  const evalThen = evalFn!(args[1], ctx!);
  const evalElse = evalFn!(args[2], ctx!);

  // Unwrap thunks after partial evaluation
  const thenVal = (evalThen.kind === ValueKind.ComposedFunction && evalThen.params.length === 0)
    ? evalFn!(evalThen.body, ctx!) : evalThen;
  const elseVal = (evalElse.kind === ValueKind.ComposedFunction && evalElse.params.length === 0)
    ? evalFn!(evalElse.body, ctx!) : evalElse;

  // Build the residual expression with partially evaluated branches
  const residual = makeExpr(eval_if_value, [
    cond,
    makeComposedFn([], thenVal),
    makeComposedFn([], elseVal),
  ]);

  // Propagate type info: if both branches have the same type, the result has that type
  const thenType = getType(thenVal);
  const elseType = getType(elseVal);
  if (thenType && elseType) {
    const thenName = getTypeName(thenVal);
    const elseName = getTypeName(elseVal);
    if (thenName === elseName) {
      return withType(residual, thenType);
    }
    // Different types — result type is ambiguous, leave untyped
    // (future: union types or common supertype)
  }

  return residual;
};

// ============ PRINT ============

const print_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  // Lazy so we get the full MultiValue (with type info) instead of primaryOf
  const v = evalFn ? evalFn(args[0], ctx!) : args[0];
  console.log(formatValue(v));
  return v;
};

// ============ IDENTITY (data structures) ============

const id_impl: PrimitiveFnImpl = (args) => {
  if (args.length === 1) return args[0];
  return makeExpr(id_prim, args);
};

// ============ GRAMMAR EXTENSION ============

import {
  GrammarBuilder, addDotAccess, addImport,
  registryStore, registryGet,
} from "./grammar-ext.js";

const grammar_builder_impl: PrimitiveFnImpl = () => {
  const builder = new GrammarBuilder();
  return makeInt(registryStore(builder));
};

const grammar_add_dot_access_impl: PrimitiveFnImpl = (args) => {
  const handle = Number(asBits(args[0], "grammar_add_dot_access").data);
  const builder = registryGet(handle) as GrammarBuilder;
  addDotAccess(builder);
  return args[0]; // return same handle
};

const grammar_add_import_impl: PrimitiveFnImpl = (args) => {
  const handle = Number(asBits(args[0], "grammar_add_import").data);
  const builder = registryGet(handle) as GrammarBuilder;
  addImport(builder);
  return args[0]; // return same handle
};

const grammar_build_impl: PrimitiveFnImpl = (args) => {
  const handle = Number(asBits(args[0], "grammar_build").data);
  const builder = registryGet(handle) as GrammarBuilder;
  const ext = builder.build();
  return makeInt(registryStore(ext));
};

// ============ TYPE SYSTEM ============

import {
  getType, getTypeName, withType, typeMethod,
  IntType, FloatType, StringType, BoolType, ArrayType, ObjectType,
  FunctionType, makeFunctionType, getFunctionParamTypes, getFunctionReturnType,
  AnyType, Type, NamedType, makeArray, makeObject,
  isGenericType, getTypeArgs, getGenericType, applyGenericType, normalizeType,
  structuralWrap, makeUnionType,
} from "./types-std.js";
import { isResolved } from "./types.js";

// --- typed_int / typed_string: wrap raw values with type ---

const typed_int_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  const v = evalFn!(args[0], ctx!);
  if (!isResolved(v)) return makeExpr(makePrimitive("typed_int", typed_int_impl, true), [v]);
  return withType(v, IntType);
};

const typed_string_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  const v = evalFn!(args[0], ctx!);
  if (!isResolved(v)) return makeExpr(makePrimitive("typed_string", typed_string_impl, true), [v]);
  return withType(v, StringType);
};

const typed_float_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  const v = evalFn!(args[0], ctx!);
  if (!isResolved(v)) return makeExpr(makePrimitive("typed_float", typed_float_impl, true), [v]);
  // If arg is a string (Bits from stringToBits), parse it as a float
  const p = primaryOf(v);
  if (p.kind === ValueKind.Bits) {
    // Check if it's a string representation (non-64-bit) that needs parsing
    if (p.length !== 64 || (v.kind === ValueKind.MultiValue && getTypeName(v) === "String")) {
      const str = bitsToString(p);
      return withType(makeFloat(parseFloat(str)), FloatType);
    }
    return withType(p, FloatType);
  }
  return withType(v, FloatType);
};

const typed_bool_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  const v = evalFn!(args[0], ctx!);
  if (!isResolved(v)) return makeExpr(makePrimitive("typed_bool", typed_bool_impl, true), [v]);
  return withType(v, BoolType);
};

const typed_array_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  // Evaluate all element args, build a typed array
  const elements: Value[] = [];
  for (const arg of args) {
    const v = evalFn!(arg, ctx!);
    if (!isResolved(v)) {
      return makeExpr(makePrimitive("typed_array", typed_array_impl, true), args);
    }
    elements.push(v);
  }
  return makeArray(elements);
};

const typed_object_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  // Args are [key1_bits, val1, key2_bits, val2, ...]
  const entries: [string, Value][] = [];
  for (let i = 0; i < args.length; i += 2) {
    const keyV = evalFn!(args[i], ctx!);
    const valV = evalFn!(args[i + 1], ctx!);
    if (!isResolved(keyV) || !isResolved(valV)) {
      return makeExpr(makePrimitive("typed_object", typed_object_impl, true), args);
    }
    entries.push([bitsToString(primaryOf(keyV) as BitsValue), valV]);
  }
  return makeObject(entries);
};

// --- typed_function: wrap composed function with FunctionType ---

const typed_function_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  // Args: [composedFn, paramCount, paramType1, ..., paramTypeN, returnType]
  const fn = evalFn!(args[0], ctx!);
  if (!isResolved(fn)) {
    return makeExpr(makePrimitive("typed_function", typed_function_impl, true), args);
  }
  const paramCount = Number(asBits(primaryOf(evalFn!(args[1], ctx!)), "typed_function").data);
  const paramTypes: Value[] = [];
  for (let i = 0; i < paramCount; i++) {
    const pt = evalFn!(args[2 + i], ctx!);
    // Type variables (unresolved Params) are kept as-is — they'll be
    // resolved during unification when the function is called
    if (isResolved(pt)) {
      const ptPrimary = primaryOf(pt);
      if (ptPrimary.kind === ValueKind.Context && isGenericType(ptPrimary as ContextValue)) {
        paramTypes.push(normalizeType(ptPrimary as ContextValue));
      } else {
        paramTypes.push(ptPrimary);
      }
    } else {
      // Unresolved — treat as type variable (store the Param/Expression as-is)
      paramTypes.push(pt);
    }
  }
  const returnTypeRaw = evalFn!(args[2 + paramCount], ctx!);
  let returnType: Value;
  if (!isResolved(returnTypeRaw)) {
    // Return type contains unresolved type variables — store as-is
    returnType = returnTypeRaw;
  } else {
    const rtp = primaryOf(returnTypeRaw);
    if (rtp.kind === ValueKind.Context && isGenericType(rtp as ContextValue)) {
      returnType = normalizeType(rtp as ContextValue);
    } else {
      returnType = rtp;
    }
  }
  const fnType = makeFunctionType(paramTypes, returnType);
  return withType(fn, fnType);
};

// --- Logical operators (short-circuiting) ---

const typed_and_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  // args[0] = left operand, args[1] = thunk (ComposedFunction) wrapping right operand
  const left = evalFn!(args[0], ctx!);
  if (!isResolved(left)) {
    return makeExpr(makePrimitive("typed_and", typed_and_impl, true), [left, args[1]]);
  }
  // Short-circuit: if left is falsy, return false without evaluating right
  const leftP = primaryOf(left);
  if (leftP.kind === ValueKind.Bits && leftP.data === 0n) {
    return withType(makeInt(0), BoolType);
  }
  // Evaluate the thunk (right operand)
  const right = evalFn!(args[1], ctx!);
  if (!isResolved(right)) {
    return makeExpr(makePrimitive("typed_and", typed_and_impl, true), [left, right]);
  }
  // If right is a thunk (ComposedFunction with no params), evaluate its body
  let rightVal = right;
  if (right.kind === ValueKind.ComposedFunction && right.params.length === 0) {
    rightVal = evalFn!(right.body, ctx!);
  }
  const rightP = primaryOf(rightVal);
  if (rightP.kind === ValueKind.Bits && rightP.data === 0n) {
    return withType(makeInt(0), BoolType);
  }
  return withType(makeInt(1), BoolType);
};

const typed_or_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  const left = evalFn!(args[0], ctx!);
  if (!isResolved(left)) {
    return makeExpr(makePrimitive("typed_or", typed_or_impl, true), [left, args[1]]);
  }
  // Short-circuit: if left is truthy, return true without evaluating right
  const leftP = primaryOf(left);
  if (leftP.kind === ValueKind.Bits && leftP.data !== 0n) {
    return withType(makeInt(1), BoolType);
  }
  // Evaluate the thunk
  const right = evalFn!(args[1], ctx!);
  if (!isResolved(right)) {
    return makeExpr(makePrimitive("typed_or", typed_or_impl, true), [left, right]);
  }
  let rightVal = right;
  if (right.kind === ValueKind.ComposedFunction && right.params.length === 0) {
    rightVal = evalFn!(right.body, ctx!);
  }
  const rightP = primaryOf(rightVal);
  if (rightP.kind === ValueKind.Bits && rightP.data !== 0n) {
    return withType(makeInt(1), BoolType);
  }
  return withType(makeInt(0), BoolType);
};

const typed_not_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  const val = evalFn!(args[0], ctx!);
  if (!isResolved(val)) {
    return makeExpr(makePrimitive("typed_not", typed_not_impl, true), [val]);
  }
  const p = primaryOf(val);
  if (p.kind === ValueKind.Bits && p.data === 0n) {
    return withType(makeInt(1), BoolType);
  }
  return withType(makeInt(0), BoolType);
};

// --- export: mark a value as exported from a module ---

const export_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  // export(value) — marks a value with an "exported" component
  // Used as: x = export(42), the binding x gets an exported marker
  const v = evalFn!(args[0], ctx!);
  if (!isResolved(v)) {
    return makeExpr(makePrimitive("export", export_impl, true), [v]);
  }
  // Wrap with exported marker
  const primary = primaryOf(v);
  const components = v.kind === ValueKind.MultiValue
    ? new Map(v.components)
    : new Map<string, Value>();
  components.set("exported", makeInt(1));
  return makeMultiValue(primary, components);
};

// --- type_dispatch: type-directed dot access ---

const type_dispatch_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  const obj = evalFn!(args[0], ctx!);
  const fieldArg = evalFn!(args[1], ctx!);
  if (!isResolved(obj) || !isResolved(fieldArg)) {
    return makeExpr(makePrimitive("type_dispatch", type_dispatch_impl, true), [obj, fieldArg]);
  }
  const fieldName = bitsToString(asBits(fieldArg, "type_dispatch"));
  const type = getType(obj);

  if (type) {
    const method = typeMethod(type, fieldName);
    if (method) {
      if (method.kind === ValueKind.PrimitiveFunction) {
        const selfVal = primaryOf(obj);
        // Check if this is a property getter (marked with __getter flag)
        if ((method as any).__getter) {
          // Call immediately with self
          return method.fn([selfVal], undefined as any, undefined as any);
        }
        // Return a bound method: partially apply self as first arg
        // Lazy so it receives unevaluated args and preserves type info
        const boundFn: PrimitiveFnImpl = (callArgs, callCtx, callEvalFn) => {
          // Evaluate args ourselves to preserve MultiValue type wrappers
          const evalArgs = callArgs.map(a => callEvalFn!(a, callCtx!));
          return method.fn([selfVal, ...evalArgs], callCtx, callEvalFn);
        };
        return makePrimitive(`bound:${fieldName}`, boundFn, true);
      }
      return method;
    }
  }

  // If the value has a type, check for __getMember fallback.
  // __getMember is called when the field isn't a type method — it lets
  // the type control access to instance fields (like Python's __getattr__).
  if (type) {
    const getMember = typeMethod(type, "__getMember");
    if (getMember?.kind === ValueKind.PrimitiveFunction) {
      return getMember.fn([primaryOf(obj), stringToBits(fieldName)], undefined as any, undefined as any);
    }
    // No __getMember — type enforces strict encapsulation
    const typeName = getTypeName(obj) ?? "unknown";
    throw new AllegroError(`type_dispatch: '${fieldName}' not found on ${typeName}`);
  }

  // Untyped Contexts: fall through to ctx_resolve (base language behavior)
  const p = primaryOf(obj);
  if (p.kind === ValueKind.Context) {
    const b = p.bindings.get(fieldName);
    if (!b) throw new AllegroError(`type_dispatch: '${fieldName}' not found`);
    if (b.value === undefined) throw new AllegroError(`type_dispatch: '${fieldName}' is unbound`);
    return b.value;
  }

  throw new AllegroError(`type_dispatch: '${fieldName}' not found on ${p.kind}`);
};

// --- type_of / type_check ---

const type_of_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  const v = evalFn!(args[0], ctx!);
  if (!isResolved(v)) return makeExpr(makePrimitive("type_of", type_of_impl, true), [v]);
  const t = getType(v);
  if (!t) throw new AllegroError("type_of: value has no type");
  return t;
};

const type_check_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  // Step 1: Evaluate
  const v = evalFn!(args[0], ctx!);
  const expectedType = evalFn!(args[1], ctx!);
  // If the expected type isn't resolved, defer completely
  if (!isResolved(expectedType)) {
    return makeExpr(makePrimitive("type_check", type_check_impl, true), [v, expectedType]);
  }
  // If the value isn't fully resolved but HAS a type component,
  // we can still check the type (partial evaluation: type check at compile time)
  if (!isResolved(v)) {
    const valueType = getType(v);
    if (!valueType) {
      // No type info at all — defer
      return makeExpr(makePrimitive("type_check", type_check_impl, true), [v, expectedType]);
    }
    // Type is known — proceed with the check (value stays as-is if it passes)
  }

  // Step 2: Normalize — resolve bare generics to Generic[Any, ...]
  const rawExpectedCtx = asCtx(primaryOf(expectedType), "type_check");
  const expectedCtx = normalizeType(rawExpectedCtx);

  const expectedNameBinding = expectedCtx.bindings.get("__name");
  if (!expectedNameBinding?.value) throw new AllegroError("type_check: expected type has no __name");
  const expectedName = bitsToString(asBits(expectedNameBinding.value, "type_check"));

  // Any matches everything
  if (expectedName === "Any") return v;

  // Step 3: Check using the type's instanceof method
  // The type hierarchy determines checking semantics:
  // - NamedType: nominal check (by __name and __extends chain)
  // - Type (or ~wrapped): structural check (by field compatibility)
  const actualType = getType(v);
  if (!actualType) throw new AllegroError("type_check: value has no type");
  const actualName = getTypeName(v);

  // Check if the expected type has its own instanceof method (e.g., UnionType)
  const directInstanceof = expectedCtx.bindings.get("instanceof")?.value;
  if (directInstanceof?.kind === ValueKind.PrimitiveFunction) {
    const checkResult = directInstanceof.fn([v], undefined as any, undefined as any);
    const checkP = primaryOf(checkResult);
    if (checkP.kind === ValueKind.Bits && checkP.data === 0n) {
      throw new AllegroError(`Type error: expected ${expectedName}, got ${actualName}`);
    }
    return v;
  }

  // Use the meta-type's instanceof method
  const typeType = expectedCtx.bindings.get("__type")?.value as ContextValue | undefined;
  if (typeType) {
    const instanceofMethod = typeType.bindings.get("instanceof")?.value;
    if (instanceofMethod?.kind === ValueKind.PrimitiveFunction) {
      const checkResult = instanceofMethod.fn([expectedCtx, v], undefined as any, undefined as any);
      const checkP = primaryOf(checkResult);
      if (checkP.kind === ValueKind.Bits && checkP.data === 0n) {
        throw new AllegroError(`Type error: expected ${expectedName}, got ${actualName}`);
      }
      return v;
    }
  }

  // Fallback: name-based check (for types without the hierarchy yet)
  if (actualName !== expectedName) {
    throw new AllegroError(`Type error: expected ${expectedName}, got ${actualName}`);
  }

  // Check type arguments if the expected type has them
  const expectedArgs = getTypeArgs(expectedCtx);
  if (expectedArgs && expectedArgs.length > 0) {
    const actualArgs = getTypeArgs(actualType);
    if (actualArgs && actualArgs.length === expectedArgs.length) {
      for (let i = 0; i < expectedArgs.length; i++) {
        const expArgCtx = primaryOf(expectedArgs[i]);
        const actArgCtx = primaryOf(actualArgs[i]);
        if (expArgCtx.kind === ValueKind.Context && actArgCtx.kind === ValueKind.Context) {
          const expArgName = (expArgCtx as ContextValue).bindings.get("__name");
          const actArgName = (actArgCtx as ContextValue).bindings.get("__name");
          if (expArgName?.value && actArgName?.value) {
            const en = bitsToString(asBits(expArgName.value, "type_check"));
            const an = bitsToString(asBits(actArgName.value, "type_check"));
            if (en !== "Any" && en !== an) {
              throw new AllegroError(`Type error: expected ${expectedName}[${en}], got ${expectedName}[${an}]`);
            }
          }
        }
      }
    }
  }

  return v;
};

// --- type_apply: apply type arguments to a generic type ---

const type_apply_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  const generic = evalFn!(args[0], ctx!);
  if (!isResolved(generic)) {
    return makeExpr(makePrimitive("type_apply", type_apply_impl, true), args);
  }
  const genericCtx = asCtx(primaryOf(generic), "type_apply");
  if (!isGenericType(genericCtx)) {
    const name = getTypeName(generic) ?? "unknown";
    throw new AllegroError(`type_apply: ${name} is not a generic type`);
  }
  // Evaluate all type arguments
  const typeArgs: Value[] = [];
  for (let i = 1; i < args.length; i++) {
    const arg = evalFn!(args[i], ctx!);
    if (!isResolved(arg)) {
      return makeExpr(makePrimitive("type_apply", type_apply_impl, true), [generic, ...args.slice(1)]);
    }
    typeArgs.push(primaryOf(arg));
  }
  return applyGenericType(genericCtx, typeArgs);
};

// --- type_union: create a union type from alternatives ---

const type_union_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  // Evaluate all alternative type args
  const alternatives: Value[] = [];
  for (const arg of args) {
    const v = evalFn!(arg, ctx!);
    if (!isResolved(v)) {
      return makeExpr(makePrimitive("type_union", type_union_impl, true), args);
    }
    alternatives.push(primaryOf(v));
  }
  return makeUnionType(alternatives as ContextValue[]);
};

// --- structural_wrap: ~ operator on types ---

const structural_wrap_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  const v = evalFn!(args[0], ctx!);
  if (!isResolved(v)) {
    return makeExpr(makePrimitive("structural_wrap", structural_wrap_impl, true), [v]);
  }
  const typeCtx = asCtx(primaryOf(v), "structural_wrap");
  return structuralWrap(typeCtx);
};

// --- type_check_binding: check value type for binding annotations ---

const type_check_binding_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  const v = evalFn!(args[0], ctx!);
  const expectedType = evalFn!(args[1], ctx!);
  if (!isResolved(v) || !isResolved(expectedType)) {
    return makeExpr(makePrimitive("type_check_binding", type_check_binding_impl, true), [v, expectedType]);
  }
  // Delegate to type_check_impl
  return type_check_impl([v, expectedType], ctx, evalFn);
};

// --- Typed binary operator helper ---

function makeTypedBinOp(opName: string): PrimitiveFnImpl {
  return (args, ctx, evalFn) => {
    const left = evalFn!(args[0], ctx!);
    const right = evalFn!(args[1], ctx!);
    if (!isResolved(left) || !isResolved(right)) {
      return makeExpr(makePrimitive(`typed_${opName}`, makeTypedBinOp(opName), true), [left, right]);
    }
    const leftType = getType(left);
    if (!leftType) {
      throw new AllegroError(`typed_${opName}: left operand has no type`);
    }
    const method = typeMethod(leftType, opName);
    if (!method) {
      const typeName = getTypeName(left) ?? "unknown";
      throw new AllegroError(`typed_${opName}: type ${typeName} has no '${opName}' method`);
    }
    if (method.kind !== ValueKind.PrimitiveFunction) {
      throw new AllegroError(`typed_${opName}: method is not a primitive function`);
    }
    // Call method with primaries (methods operate on raw values)
    const result = method.fn([primaryOf(left), primaryOf(right)], ctx, evalFn);
    // Re-wrap result with left operand's type (for arithmetic) or no type (for comparisons)
    if (opName === "eq" || opName === "neq" || opName === "lt" || opName === "gt" || opName === "lte" || opName === "gte") {
      return withType(result, IntType); // comparisons return Int (0 or 1)
    }
    return withType(result, leftType);
  };
}

// ============ Build primitive values ============

const id_prim = makePrimitive("id", id_impl);
const eval_if_value = makePrimitive("eval_if", eval_if_impl, true);

// ============ Registry ============

export const primitives: Record<string, PrimitiveFunctionValue> = {
  bits_new: makePrimitive("bits_new", bits_new),
  bits_length: makePrimitive("bits_length", bits_length),
  bits_get: makePrimitive("bits_get", bits_get),
  bits_set: makePrimitive("bits_set", bits_set),
  bits_slice: makePrimitive("bits_slice", bits_slice),
  bits_concat: makePrimitive("bits_concat", bits_concat),
  bits_and: makePrimitive("bits_and", bits_and),
  bits_or: makePrimitive("bits_or", bits_or),
  bits_xor: makePrimitive("bits_xor", bits_xor),
  bits_not: makePrimitive("bits_not", bits_not),
  bits_eq: makePrimitive("bits_eq", bits_eq),
  bits_neq: makePrimitive("bits_neq", bits_neq),
  bits_add: makePrimitive("bits_add", bits_add),
  bits_sub: makePrimitive("bits_sub", bits_sub),
  bits_mul: makePrimitive("bits_mul", bits_mul),
  bits_div: makePrimitive("bits_div", bits_div),
  bits_mod: makePrimitive("bits_mod", bits_mod),
  bits_lt: makePrimitive("bits_lt", bits_lt),
  bits_gt: makePrimitive("bits_gt", bits_gt),
  bits_lte: makePrimitive("bits_lte", bits_lte),
  bits_gte: makePrimitive("bits_gte", bits_gte),
  expr_apply: makePrimitive("expr_apply", expr_apply),
  expr_fn: makePrimitive("expr_fn", expr_fn),
  expr_args: makePrimitive("expr_args", expr_args),
  expr_arg: makePrimitive("expr_arg", expr_arg),
  expr_argc: makePrimitive("expr_argc", expr_argc),
  expr_param: makePrimitive("expr_param", expr_param),
  expr_function: makePrimitive("expr_function", expr_function),
  expr_eval: makePrimitive("expr_eval", expr_eval),
  ctx_new: makePrimitive("ctx_new", ctx_new),
  ctx_bind: makePrimitive("ctx_bind", ctx_bind),
  ctx_resolve: makePrimitive("ctx_resolve", ctx_resolve),
  ctx_bindings: makePrimitive("ctx_bindings", ctx_bindings),
  ctx_use: makePrimitive("ctx_use", ctx_use),
  mv_new: makePrimitive("mv_new", mv_new),
  mv_primary: makePrimitive("mv_primary", mv_primary),
  mv_get: makePrimitive("mv_get", mv_get),
  mv_set: makePrimitive("mv_set", mv_set),
  mv_components: makePrimitive("mv_components", mv_components),
  eval_if: eval_if_value,
  id: id_prim,
  print: makePrimitive("print", print_impl, true),
  grammar_builder: makePrimitive("grammar_builder", grammar_builder_impl),
  grammar_add_dot_access: makePrimitive("grammar_add_dot_access", grammar_add_dot_access_impl),
  grammar_add_import: makePrimitive("grammar_add_import", grammar_add_import_impl),
  grammar_build: makePrimitive("grammar_build", grammar_build_impl),
  // Type system
  typed_int: makePrimitive("typed_int", typed_int_impl, true),
  typed_string: makePrimitive("typed_string", typed_string_impl, true),
  typed_float: makePrimitive("typed_float", typed_float_impl, true),
  typed_bool: makePrimitive("typed_bool", typed_bool_impl, true),
  typed_array: makePrimitive("typed_array", typed_array_impl, true),
  typed_object: makePrimitive("typed_object", typed_object_impl, true),
  typed_function: makePrimitive("typed_function", typed_function_impl, true),
  typed_and: makePrimitive("typed_and", typed_and_impl, true),
  typed_or: makePrimitive("typed_or", typed_or_impl, true),
  typed_not: makePrimitive("typed_not", typed_not_impl, true),
  export: makePrimitive("export", export_impl, true),
  type_dispatch: makePrimitive("type_dispatch", type_dispatch_impl, true),
  type_of: makePrimitive("type_of", type_of_impl, true),
  type_check: makePrimitive("type_check", type_check_impl, true),
  type_apply: makePrimitive("type_apply", type_apply_impl, true),
  type_union: makePrimitive("type_union", type_union_impl, true),
  structural_wrap: makePrimitive("structural_wrap", structural_wrap_impl, true),
  type_check_binding: makePrimitive("type_check_binding", type_check_binding_impl, true),
  typed_add: makePrimitive("typed_add", makeTypedBinOp("add"), true),
  typed_sub: makePrimitive("typed_sub", makeTypedBinOp("sub"), true),
  typed_mul: makePrimitive("typed_mul", makeTypedBinOp("mul"), true),
  typed_div: makePrimitive("typed_div", makeTypedBinOp("div"), true),
  typed_mod: makePrimitive("typed_mod", makeTypedBinOp("mod"), true),
  typed_eq: makePrimitive("typed_eq", makeTypedBinOp("eq"), true),
  typed_neq: makePrimitive("typed_neq", makeTypedBinOp("neq"), true),
  typed_lt: makePrimitive("typed_lt", makeTypedBinOp("lt"), true),
  typed_gt: makePrimitive("typed_gt", makeTypedBinOp("gt"), true),
  typed_lte: makePrimitive("typed_lte", makeTypedBinOp("lte"), true),
  typed_gte: makePrimitive("typed_gte", makeTypedBinOp("gte"), true),
};