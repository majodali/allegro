// Allegro Base Language - Primitive Functions

import {
  Value, ValueKind, BitsValue, ContextValue,
  PrimitiveFunctionValue, PrimitiveFnImpl, EvalFn,
  AllegroError, makeBits, makeInt, makePrimitive, makeExpr,
  makeParam, makeComposedFn, makeContext, makeMultiValue,
  primaryOf, stringToBits, bitsToString,
} from "./types.js";

// --- Value formatting ---

export function formatValue(v: Value): string {
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
  const cond = evalFn(args[0], ctx);
  const condP = primaryOf(cond);
  if (condP.kind === ValueKind.Bits) {
    const branch = condP.data !== 0n ? args[1] : args[2];
    // If branch is a thunk (composed fn with no params), evaluate its body
    const evalBranch = evalFn(branch, ctx);
    if (evalBranch.kind === ValueKind.ComposedFunction && evalBranch.params.length === 0) {
      return evalFn(evalBranch.body, ctx);
    }
    return evalBranch;
  }
  // Condition unresolved
  return makeExpr(eval_if_value, [cond, args[1], args[2]]);
};

// ============ PRINT ============

const print_impl: PrimitiveFnImpl = (args) => {
  console.log(formatValue(args[0]));
  return args[0];
};

// ============ IDENTITY (data structures) ============

const id_impl: PrimitiveFnImpl = (args) => {
  if (args.length === 1) return args[0];
  return makeExpr(id_prim, args);
};

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
  print: makePrimitive("print", print_impl),
};