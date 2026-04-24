// Allegretto - Primitive Functions

import {
  Value, ValueKind, BitsValue, ContextValue,
  PrimitiveFunctionValue, PrimitiveFnImpl, EvalFn,
  AllegroError, makeBits, makeInt, makeFloat, bitsToFloat, makePrimitive, makeExpr,
  makeParam, makeComposedFn, makeContext, makeMultiValue,
  primaryOf, stringToBits, bitsToString,
} from "./types.js";
import { buildFn } from "./parser-helpers.js";
import { grammar2Primitives } from "./grammar2/builder.js";
import { BASE_OPERATORS_TO_LEVEL } from "./grammar2/base-grammar.js";

// --- Value formatting ---

export function formatValue(v: Value): string {
  // Check for typed values (MultiValue with "type" component)
  if (v.kind === ValueKind.MultiValue) {
    // Error values — show error component
    if (v.components.has("error")) {
      return `error(${formatValue(v.components.get("error")!)})`;
    }
    const typeComp = v.components.get("type");
    if (typeComp && typeComp.kind === ValueKind.Context) {
      const nameBinding = typeComp.bindings.get("__name");
      if (nameBinding?.value && nameBinding.value.kind === ValueKind.Bits) {
        const typeName = bitsToString(nameBinding.value);
        if (typeName === "None") {
          return "none";
        }
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
        // Record types — check __members for Field descriptors
        const membersBinding = typeComp.bindings.get("__members");
        if (membersBinding?.value?.kind === ValueKind.Context && v.primary.kind === ValueKind.Context) {
          const membersCtx = membersBinding.value as ContextValue;
          const instanceCtx = v.primary as ContextValue;
          const parts: string[] = [];
          for (const [key, binding] of membersCtx.bindings) {
            if (binding.value?.kind === ValueKind.Context && isFieldDescriptor(binding.value as ContextValue)) {
              const fieldVal = instanceCtx.bindings.get(key)?.value;
              if (fieldVal) parts.push(`${key}: ${formatValue(fieldVal)}`);
            }
          }
          if (parts.length > 0) return `${typeName}(${parts.join(", ")})`;
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

// ============ EVAL_WHEN (lazy — pattern matching) ============

/**
 * Helper: check if an Expression is a specific primitive pattern marker.
 */
function isPatternPrim(v: Value, name: string): boolean {
  return v.kind === ValueKind.Expression &&
    v.fn.kind === ValueKind.PrimitiveFunction &&
    (v.fn as PrimitiveFunctionValue).name === name;
}

/**
 * Helper: match a value against a sub-pattern.
 * Returns extracted values (possibly empty for non-binding matches), or null for no match.
 */
function matchSubPattern(
  value: Value, subPattern: Value, evalFn: EvalFn, ctx: ContextValue,
): Value[] | null {
  const subP = primaryOf(subPattern);

  // Wildcard
  if (isPatternPrim(subPattern, "when_wildcard")) {
    return [];
  }

  // Symbol (unresolved) → binding
  if (subPattern.kind === ValueKind.Symbol) {
    return [value];
  }

  // Nested struct destruct
  if (isPatternPrim(subPattern, "when_struct_destruct")) {
    const innerCtx = primaryOf(value);
    if (innerCtx.kind !== ValueKind.Context) return null;
    return extractFields(innerCtx as ContextValue, (subPattern as any).args, evalFn, ctx);
  }

  // Nested type destruct
  if (isPatternPrim(subPattern, "when_type_destruct")) {
    const typeValue = (subPattern as any).args[0];
    const fieldSpecs = (subPattern as any).args.slice(1);
    const valTypeName = getTypeName(value);
    const patTypeName = typeValue.kind === ValueKind.Context
      ? bitsToString(primaryOf(
          (typeValue as ContextValue).bindings.get("__name")?.value ?? stringToBits("")
        ) as BitsValue)
      : null;
    if (!valTypeName || !patTypeName || valTypeName !== patTypeName) return null;
    const innerCtx = primaryOf(value);
    if (innerCtx.kind !== ValueKind.Context) return null;
    return extractFields(innerCtx as ContextValue, fieldSpecs, evalFn, ctx);
  }

  // Type context → instanceof check
  if (subP.kind === ValueKind.Context &&
      (subP as ContextValue).bindings.has("__name") &&
      (subP as ContextValue).bindings.has("__type")) {
    const valTypeName = getTypeName(value);
    const patName = bitsToString(primaryOf(
      (subP as ContextValue).bindings.get("__name")!.value!
    ) as BitsValue);
    if (valTypeName === patName) return [value]; // match + bind
    return null;
  }

  // Bits literal → equality check
  if (subP.kind === ValueKind.Bits) {
    const valP = primaryOf(value);
    if (valP.kind === ValueKind.Bits &&
        (valP as BitsValue).length === (subP as BitsValue).length &&
        (valP as BitsValue).data === (subP as BitsValue).data) {
      return []; // match, no binding
    }
    return null;
  }

  // Reference equality fallback
  if (primaryOf(value) === subP) return [];
  return null;
}

/**
 * Helper: extract field values from a Context by field spec pairs.
 * fieldSpecs are [fieldName, subPattern] pairs where subPattern is always
 * a pattern value (Symbol for binding, Expression for destruct, etc.).
 * Returns extracted values in binding order, or null if a field is missing.
 */
function extractFields(
  ctx: ContextValue, specArgs: Value[], evalFn: EvalFn, evalCtx: ContextValue,
): Value[] | null {
  const values: Value[] = [];
  for (let i = 0; i < specArgs.length; i += 2) {
    const fieldName = bitsToString(primaryOf(specArgs[i]) as BitsValue);
    const b = ctx.bindings.get(fieldName);
    if (!b?.value) return null; // field not found → no match

    const subValues = matchSubPattern(b.value, specArgs[i + 1], evalFn, evalCtx);
    if (!subValues) return null; // sub-pattern match failed
    if (subValues.length === 0) {
      // Sub-pattern matched but produced no bindings (wildcard, literal match, type check).
      // Use the field value as the binding (field name is the binding name).
      values.push(b.value);
    } else {
      values.push(...subValues);
    }
  }
  return values;
}

/**
 * Helper: evaluate the else-branch (unwrap thunk).
 */
function evalElseBranch(elseBranch: Value, ctx: ContextValue, evalFn: EvalFn): Value {
  const evalElse = evalFn(elseBranch, ctx);
  if (evalElse.kind === ValueKind.ComposedFunction && evalElse.params.length === 0) {
    return evalFn(evalElse.body, ctx);
  }
  return evalElse;
}

/**
 * Helper: evaluate the then-branch, applying extracted values for bindings.
 */
function evalThenBranch(
  thenBranch: Value, extractedValues: Value[],
  ctx: ContextValue, evalFn: EvalFn,
): Value {
  const evalThen = evalFn(thenBranch, ctx);
  if (evalThen.kind === ValueKind.ComposedFunction) {
    if (evalThen.params.length === 0) {
      // Thunk — unwrap
      return evalFn(evalThen.body, ctx);
    }
    if (evalThen.params.length > 0 && extractedValues.length >= evalThen.params.length) {
      // Apply function with extracted values (may have more values than params
      // if some bindings aren't referenced in the body)
      return evalFn(makeExpr(evalThen, extractedValues), ctx);
    }
  }
  return evalThen;
}

const eval_when_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  if (args.length !== 5) throw new AllegroError(`eval_when: need 5 args, got ${args.length}`);
  const subject = evalFn!(args[0], ctx!);
  const pattern = evalFn!(args[1], ctx!);
  const guardFn = args[2];     // guard function or literal Int(1) for no guard
  const thenBranch = args[3];
  const elseBranch = args[4];

  const subjectP = primaryOf(subject);
  let matched = false;
  let extractedValues: Value[] = [];

  if (isPatternPrim(pattern, "when_wildcard")) {
    matched = true;

  } else if (isPatternPrim(pattern, "when_type_destruct")) {
    const patternExpr = pattern as import("./types.js").ExpressionValue;
    const typeValue = patternExpr.args[0];
    const fieldSpecs = patternExpr.args.slice(1);

    const subjectTypeName = getTypeName(subject);
    const typeCtx = primaryOf(typeValue);
    const patternTypeName = typeCtx.kind === ValueKind.Context
      ? bitsToString(primaryOf(
          (typeCtx as ContextValue).bindings.get("__name")?.value ?? stringToBits("")
        ) as BitsValue)
      : null;

    if (subjectTypeName && patternTypeName && subjectTypeName === patternTypeName) {
      if (subjectP.kind === ValueKind.Context) {
        const values = extractFields(subjectP as ContextValue, fieldSpecs, evalFn!, ctx!);
        if (values) {
          matched = true;
          extractedValues = values;
        }
      }
    }

  } else if (isPatternPrim(pattern, "when_struct_destruct")) {
    const patternExpr = pattern as import("./types.js").ExpressionValue;
    const fieldSpecs = patternExpr.args;

    if (subjectP.kind === ValueKind.Context) {
      const values = extractFields(subjectP as ContextValue, fieldSpecs, evalFn!, ctx!);
      if (values) {
        matched = true;
        extractedValues = values;
      }
    }

  } else if (pattern.kind === ValueKind.Symbol) {
    matched = true;
    extractedValues = [subject];

  } else {
    // Literal or type match
    const patternP = primaryOf(pattern);

    // Type context → instanceof check (for patterns like `is Int`)
    if (patternP.kind === ValueKind.Context &&
        (patternP as ContextValue).bindings.has("__name") &&
        (patternP as ContextValue).bindings.has("__type")) {
      const subjectTypeName = getTypeName(subject);
      const patternName = bitsToString(primaryOf(
        (patternP as ContextValue).bindings.get("__name")!.value!
      ) as BitsValue);
      if (subjectTypeName === patternName) {
        matched = true;
        extractedValues = [subject]; // bind the value
      }
    } else if (subjectP.kind === ValueKind.Bits && patternP.kind === ValueKind.Bits) {
      matched = (subjectP as BitsValue).length === (patternP as BitsValue).length &&
                (subjectP as BitsValue).data === (patternP as BitsValue).data;
    } else {
      matched = subjectP === patternP;
    }
  }

  if (matched) {
    // Evaluate guard if present
    const evalGuard = evalFn!(guardFn, ctx!);
    const guardP = primaryOf(evalGuard);
    if (guardP.kind === ValueKind.ComposedFunction && (guardP as any).params?.length > 0) {
      // Guard is a function — apply with extracted values
      const guardResult = evalFn!(makeExpr(evalGuard, extractedValues), ctx!);
      const guardRP = primaryOf(guardResult);
      if (guardRP.kind === ValueKind.Bits && (guardRP as BitsValue).data === 0n) {
        // Guard failed — fall through
        return evalElseBranch(elseBranch, ctx!, evalFn!);
      }
    } else if (guardP.kind === ValueKind.Bits && (guardP as BitsValue).data === 0n) {
      // Guard is a literal false
      return evalElseBranch(elseBranch, ctx!, evalFn!);
    }
    // Guard passed (or is literal 1 / non-function truthy)
    return evalThenBranch(thenBranch, extractedValues, ctx!, evalFn!);
  }

  return evalElseBranch(elseBranch, ctx!, evalFn!);
};

// ============ COMPONENT_GET (lazy — for "Y of x" syntax) ============

const component_get_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  if (args.length !== 2) throw new AllegroError(`component_get: need 2 args, got ${args.length}`);
  const value = evalFn!(args[0], ctx!);
  const key = bitsToString(primaryOf(args[1]) as BitsValue);
  if (value.kind === ValueKind.MultiValue) {
    const c = value.components.get(key);
    if (c !== undefined) return c;
  }
  // Component not found — return none instead of throwing
  return noneSingleton;
};

// ============ MAKE_ERROR (lazy — for "error expr" syntax) ============

const make_error_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  if (args.length !== 1) throw new AllegroError(`make_error: need 1 arg, got ${args.length}`);
  const errorValue = evalFn!(args[0], ctx!);
  // Create MultiValue with error component and Error type, sentinel primary
  const components = new Map<string, Value>();
  components.set("error", errorValue);
  components.set("type", ErrorType);
  return makeMultiValue(makeInt(0), components);
};

const when_wildcard_impl: PrimitiveFnImpl = () => {
  // Marker — returned as an Expression by the parser, recognized by eval_when
  return makeExpr(makePrimitive("when_wildcard", when_wildcard_impl), []);
};

const when_type_destruct_impl: PrimitiveFnImpl = (args) => {
  // Marker — recognized by eval_when. Args: [TypeSymbol, fieldName1, bindingName1, ...]
  return makeExpr(makePrimitive("when_type_destruct", when_type_destruct_impl), args);
};

const when_struct_destruct_impl: PrimitiveFnImpl = (args) => {
  // Marker — recognized by eval_when. Args: [fieldName1, bindingName1, ...]
  return makeExpr(makePrimitive("when_struct_destruct", when_struct_destruct_impl), args);
};

const when_no_match_impl: PrimitiveFnImpl = (args, _ctx, _evalFn) => {
  throw new AllegroError(`when: no matching case for value`);
};

// ============ PRINT ============

const print_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  // Lazy so we get the full MultiValue (with type info) instead of primaryOf
  const v = evalFn ? evalFn(args[0], ctx!) : args[0];
  if (!isResolved(v)) {
    // Value is pending (async future or other residual) — defer print
    return makeExpr(makePrimitive("print", print_impl, true), [v]);
  }
  // Use FutureManager's onOutput if available (for async/web streaming)
  const fm = (ctx as any)?.__futureManager;
  if (fm?.onOutput) {
    fm.onOutput(formatValue(v));
  } else {
    console.log(formatValue(v));
  }
  return v;
};

// ============ ASYNC PRIMITIVES ============

const delay_impl: PrimitiveFnImpl = (args) => {
  // delay(ms) — returns a future that resolves after ms milliseconds
  // The future resolves to none (Int 0)
  const ctx = args.length > 1 ? args[1] : undefined; // ctx passed by evaluator
  throw new AllegroError("delay: internal — should be called through delay_wrapper");
};

// Wrapper that accesses FutureManager from the evaluation context
const delay_wrapper: PrimitiveFnImpl = (args, ctx, evalFn) => {
  const v = evalFn!(args[0], ctx!);
  if (!isResolved(v)) {
    return makeExpr(makePrimitive("delay", delay_wrapper, true), [v]);
  }
  const ms = Number(asBits(primaryOf(v), "delay").data);
  const fm = (ctx as any)?.__futureManager as import("./futures.js").FutureManager | undefined;
  if (!fm) {
    throw new AllegroError("delay: requires async runtime (no FutureManager available)");
  }
  const promise = new Promise<Value>((resolve) => {
    setTimeout(() => resolve(withType(makeInt(0), IntType)), ms);
  });
  return fm.createFuture(promise);
};

// ============ FETCH (async HTTP) ============

const fetch_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  const v = evalFn!(args[0], ctx!);
  if (!isResolved(v)) {
    return makeExpr(makePrimitive("fetch", fetch_impl, true), [v]);
  }
  const url = bitsToString(asBits(primaryOf(v), "fetch"));
  const fm = (ctx as any)?.__futureManager as import("./futures.js").FutureManager | undefined;
  if (!fm) {
    throw new AllegroError("fetch: requires async runtime (no FutureManager available)");
  }
  const promise = globalThis.fetch(url)
    .then(r => {
      if (!r.ok) throw new Error(`fetch: HTTP ${r.status} ${r.statusText}`);
      return r.text();
    })
    .then(text => withType(stringToBits(text), StringType))
    .catch(err => {
      // Return error value instead of throwing
      const components = new Map<string, Value>();
      components.set("error", withType(stringToBits(String(err)), StringType));
      components.set("type", ErrorType);
      return makeMultiValue(makeInt(0), components);
    });
  return fm.createFuture(promise);
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
  makeGrammarHandle, makeTerminalHandle, makePhraseHandle, makeChoiceHandle,
  addChoiceAlternative, makeRepeatHandle, makeOptionalHandle,
  setGrammarTarget, parseGrammarToAllegro,
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

// ============ PARSER COMBINATORS (Phase 1 grammar extensions) ============
// Handle-based primitives for building grammars from Allegro code.
// All handles are Int values referencing grammar-ext.ts's registry.

// Helpers to extract options from Allegro Object contexts
function optionalStringFromCtx(ctx: ContextValue, key: string): string | undefined {
  const b = ctx.bindings.get(key);
  if (!b?.value) return undefined;
  const p = primaryOf(b.value);
  if (p.kind !== ValueKind.Bits) return undefined;
  return bitsToString(p as BitsValue);
}
function optionalIntFromCtx(ctx: ContextValue, key: string): number | undefined {
  const b = ctx.bindings.get(key);
  if (!b?.value) return undefined;
  const p = primaryOf(b.value);
  if (p.kind !== ValueKind.Bits) return undefined;
  return Number((p as BitsValue).data);
}
function arrayHandlesFromValue(v: Value, fnName: string): number[] {
  const p = primaryOf(v);
  if (p.kind !== ValueKind.Context) {
    throw new AllegroError(`${fnName}: expected Array of handles`);
  }
  const ctx = p as ContextValue;
  const lenB = ctx.bindings.get("__length")?.value;
  const len = lenB?.kind === ValueKind.Bits ? Number((lenB as BitsValue).data) : 0;
  const handles: number[] = [];
  for (let i = 0; i < len; i++) {
    const itemB = ctx.bindings.get(String(i));
    if (!itemB?.value) continue;
    const ip = primaryOf(itemB.value);
    if (ip.kind !== ValueKind.Bits) {
      throw new AllegroError(`${fnName}: element ${i} is not a handle`);
    }
    handles.push(Number((ip as BitsValue).data));
  }
  return handles;
}

const grammar_new_impl: PrimitiveFnImpl = (args) => {
  // Optional options object as first arg
  let opts: { whitespace?: string } = {};
  if (args.length > 0) {
    const p = primaryOf(args[0]);
    if (p.kind === ValueKind.Context) {
      const ws = optionalStringFromCtx(p as ContextValue, "whitespace");
      if (ws !== undefined) opts.whitespace = ws;
    }
  }
  return makeInt(makeGrammarHandle(opts));
};

const grammar_terminal_impl: PrimitiveFnImpl = (args) => {
  const gHandle = Number(asBits(args[0], "grammar_terminal").data);
  const pattern = bitsToString(asBits(args[1], "grammar_terminal"));
  return makeInt(makeTerminalHandle(gHandle, pattern));
};

const grammar_phrase_impl: PrimitiveFnImpl = (args) => {
  const gHandle = Number(asBits(args[0], "grammar_phrase").data);
  const elementHandles = arrayHandlesFromValue(args[1], "grammar_phrase");
  return makeInt(makePhraseHandle(gHandle, elementHandles));
};

const grammar_choice_impl: PrimitiveFnImpl = (args) => {
  const gHandle = Number(asBits(args[0], "grammar_choice").data);
  const altHandles = arrayHandlesFromValue(args[1], "grammar_choice");
  return makeInt(makeChoiceHandle(gHandle, altHandles));
};

const grammar_choice_add_impl: PrimitiveFnImpl = (args) => {
  const disjHandle = Number(asBits(args[0], "grammar_choice_add").data);
  const altHandle = Number(asBits(args[1], "grammar_choice_add").data);
  addChoiceAlternative(disjHandle, altHandle);
  return args[0];
};

const grammar_repeat_impl: PrimitiveFnImpl = (args) => {
  const gHandle = Number(asBits(args[0], "grammar_repeat").data);
  const elementHandle = Number(asBits(args[1], "grammar_repeat").data);
  let opts: { min?: number; max?: number; delimiter?: number } = {};
  if (args.length > 2) {
    const p = primaryOf(args[2]);
    if (p.kind === ValueKind.Context) {
      const ctx = p as ContextValue;
      opts.min = optionalIntFromCtx(ctx, "min");
      opts.max = optionalIntFromCtx(ctx, "max");
      opts.delimiter = optionalIntFromCtx(ctx, "delimiter");
    }
  }
  return makeInt(makeRepeatHandle(gHandle, elementHandle, opts));
};

const grammar_optional_impl: PrimitiveFnImpl = (args) => {
  const gHandle = Number(asBits(args[0], "grammar_optional").data);
  const elementHandle = Number(asBits(args[1], "grammar_optional").data);
  return makeInt(makeOptionalHandle(gHandle, elementHandle));
};

const grammar_set_target_impl: PrimitiveFnImpl = (args) => {
  const gHandle = Number(asBits(args[0], "grammar_set_target").data);
  const elementHandle = Number(asBits(args[1], "grammar_set_target").data);
  setGrammarTarget(gHandle, elementHandle);
  return args[0];
};

const grammar_parse_impl: PrimitiveFnImpl = (args) => {
  const gHandle = Number(asBits(args[0], "grammar_parse").data);
  const input = bitsToString(asBits(args[1], "grammar_parse"));
  return parseGrammarToAllegro(gHandle, input);
};

// ============ RUNTIME GRAMMAR EXTENSIONS ============
// Module-scoped primitives that register new parselets/operators/keywords.
// The module's ctx carries a hidden `__grammar_fragment` binding that
// accumulates registrations; the module loader extracts it and attaches
// the fragment to the Extension returned for this module.

import type { GrammarFragment } from "./types.js";
import { emptyGrammarFragment } from "./types.js";

/** Get the current module's grammar fragment, creating it on ctx if absent. */
function getOrCreateFragment(ctx: ContextValue): GrammarFragment {
  const existing = (ctx as any).__grammar_fragment as GrammarFragment | undefined;
  if (existing) return existing;
  const fresh = emptyGrammarFragment();
  (ctx as any).__grammar_fragment = fresh;
  return fresh;
}

/** Extract the grammar fragment from a ctx if any registrations happened. */
export function extractGrammarFragment(ctx: ContextValue): GrammarFragment | undefined {
  return (ctx as any).__grammar_fragment as GrammarFragment | undefined;
}

const register_infix_impl: PrimitiveFnImpl = (args, ctx) => {
  if (args.length !== 3) throw new AllegroError(`register_infix: expected 3 args, got ${args.length}`);
  const op = bitsToString(asBits(args[0], "register_infix"));
  const bp = Number(asBits(args[1], "register_infix").data);
  const fn = args[2];
  const fragment = getOrCreateFragment(ctx!);
  fragment.infix.push({ token: op, bp, fn });
  if (!fragment.operators.includes(op)) fragment.operators.push(op);
  return noneSingleton;
};

const register_prefix_impl: PrimitiveFnImpl = (args, ctx) => {
  if (args.length !== 3) throw new AllegroError(`register_prefix: expected 3 args, got ${args.length}`);
  const op = bitsToString(asBits(args[0], "register_prefix"));
  const bp = Number(asBits(args[1], "register_prefix").data);
  const fn = args[2];
  const fragment = getOrCreateFragment(ctx!);
  fragment.prefixOp.push({ token: op, bp, fn });
  if (!fragment.operators.includes(op)) fragment.operators.push(op);
  return noneSingleton;
};

const register_postfix_impl: PrimitiveFnImpl = (args, ctx) => {
  if (args.length !== 3) throw new AllegroError(`register_postfix: expected 3 args, got ${args.length}`);
  const op = bitsToString(asBits(args[0], "register_postfix"));
  const bp = Number(asBits(args[1], "register_postfix").data);
  const fn = args[2];
  const fragment = getOrCreateFragment(ctx!);
  fragment.postfixOp.push({ token: op, bp, fn });
  if (!fragment.operators.includes(op)) fragment.operators.push(op);
  return noneSingleton;
};

const register_expr_prefix_impl: PrimitiveFnImpl = (args, ctx) => {
  if (args.length !== 2) throw new AllegroError(`register_expr_prefix: expected 2 args, got ${args.length}`);
  const kw = bitsToString(asBits(args[0], "register_expr_prefix"));
  const fn = args[1];
  const fragment = getOrCreateFragment(ctx!);
  fragment.exprPrefix.push({ keyword: kw, fn });
  if (!fragment.keywords.includes(kw)) fragment.keywords.push(kw);
  return noneSingleton;
};

// --- Phase 6 grammar-building primitives ---
//
// `grammar { … }` blocks compile to a chain of calls on a fragment handle:
//
//   grammar_fragment_finalize(
//     grammar_infix_add(
//       grammar_fragment_new("allegro"),
//       "**", {at: "mul"}, "right", <fn>
//     )
//   )
//
// Each `*_add` primitive mutates the handle in place and returns it, so the
// chain threads through. `grammar_fragment_finalize` converts the handle to
// a Grammar Value (opaque Context with a hidden `__grammarValue` field the
// `use X` pre-scanner recognizes at compile time).
//
// Step 4 implements the Phase 1 subset: infix/prefix/postfix/expr_prefix
// registration with `at(existing_level)` prec specs. Named precedence
// (`prec(pow)`), new-level creation (`above(X) below(Y)`), multi-token
// forms, and user sub-rules land in steps 5–6.

/** Data packed inside a fragment handle Context. */
interface GrammarHandleData {
  fragment:         GrammarFragment;
  base:             string;     // "allegro" | "empty" | <name>
  /** Counter for gensym'd anonymous level names (e.g. __anon_1, __anon_2). */
  anonLevelCounter: number;
}

/** Data packed inside a finalized Grammar value Context. */
export interface GrammarValueData {
  fragment:  GrammarFragment;
  baseChain: string[];
}

function makeFragmentBuilderHandle(base: string): ContextValue {
  const ctx = makeContext() as ContextValue;
  const fragment = emptyGrammarFragment();
  fragment.base = base;             // propagate to fragment for validator checks
  const data: GrammarHandleData = { fragment, base, anonLevelCounter: 0 };
  (ctx as any).__grammarHandle = data;
  return ctx;
}

function asGrammarHandle(v: Value, fnName: string): GrammarHandleData {
  const p = primaryOf(v);
  if (p.kind !== ValueKind.Context) {
    throw new AllegroError(`${fnName}: expected grammar fragment handle, got ${p.kind}`);
  }
  const h = (p as any).__grammarHandle as GrammarHandleData | undefined;
  if (!h) throw new AllegroError(`${fnName}: value is not a grammar fragment handle`);
  return h;
}

/** Public accessor: inspect a Value to see if it carries a finalized Grammar.
 *  Returns the Grammar data if so, otherwise undefined. Used by the `use X`
 *  pre-scanner (step 8) and fragment merger. */
export function asGrammarValue(v: Value): GrammarValueData | undefined {
  const p = primaryOf(v);
  if (p.kind !== ValueKind.Context) return undefined;
  return (p as any).__grammarValue as GrammarValueData | undefined;
}

function makeGrammarValue(fragment: GrammarFragment, base: string): ContextValue {
  const ctx  = makeContext() as ContextValue;
  const data: GrammarValueData = { fragment, baseChain: [base] };
  (ctx as any).__grammarValue = data;
  return ctx;
}

/** Read a prec_spec object `{at: "mul"}` / `{above: "mul", below: "unary"}` /
 *  `{prec: "pow", above: "mul"}` etc. Returns whichever fields are present. */
interface PrecSpecRead {
  at?:    string;
  above?: string;
  below?: string;
  prec?:  string;
}

function readPrecSpec(v: Value, fnName: string): PrecSpecRead {
  const p = primaryOf(v);
  if (p.kind !== ValueKind.Context) {
    throw new AllegroError(`${fnName}: expected prec_spec object, got ${p.kind}`);
  }
  const out: PrecSpecRead = {};
  for (const key of ["at", "above", "below", "prec"] as const) {
    const b = p.bindings.get(key);
    if (b?.value) {
      const bp = primaryOf(b.value);
      if (bp.kind === ValueKind.Bits) out[key] = bitsToString(bp);
    }
  }
  if (out.at === undefined && out.above === undefined &&
      out.below === undefined && out.prec === undefined) {
    throw new AllegroError(`${fnName}: prec_spec has no at/above/below/prec fields`);
  }
  return out;
}

/**
 * Resolve a prec_spec into a level name AND (if needed) record a precedence
 * declaration on the fragment. Accepts all Phase 6 spec forms:
 *
 *   {at: X}                        — reference existing level X (or base
 *                                    operator's level if X looks like an op)
 *   {prec: X}                      — reference/declare named level X; no
 *                                    ordering constraints
 *   {prec: X, above: Y}            — declare X tighter than Y
 *   {prec: X, below: Z}            — declare X looser than Z
 *   {prec: X, above: Y, below: Z}  — declare X with both constraints
 *   {above: Y}                     — anonymous level above Y (gensym'd name)
 *   {below: Z}                     — anonymous level below Z
 *   {above: Y, below: Z}           — anonymous level between Y and Z
 *
 * `at(X)` and `prec(X)` without constraints are distinct semantically: the
 * former appends to X's existing level; the latter declares X as a level
 * (idempotent if already declared). In practice they behave the same when
 * X is a known base-grammar level.
 */
function resolveLevelFromPrecSpec(
  spec:   PrecSpecRead,
  handle: GrammarHandleData,
  fnName: string,
): string {
  // `at(X)`: reference existing level by name, or the level an operator lives at.
  if (spec.at !== undefined &&
      spec.above === undefined && spec.below === undefined && spec.prec === undefined) {
    return resolveLevelRef(spec.at);
  }

  // Named level — declare (idempotent) and optionally add constraints.
  if (spec.prec !== undefined) {
    const name = spec.prec;
    addPrecedenceDecl(handle.fragment, name, spec, fnName);
    return name;
  }

  // Anonymous level — gensym and declare with whichever constraints present.
  if (spec.above !== undefined || spec.below !== undefined) {
    handle.anonLevelCounter++;
    const name = `__anon_${handle.anonLevelCounter}`;
    addPrecedenceDecl(handle.fragment, name, spec, fnName);
    return name;
  }

  throw new AllegroError(`${fnName}: empty prec_spec`);
}

/** Resolve a target referenced by `at(X)`. If X is a known operator symbol
 *  in the base grammar, return the level it lives at; otherwise return X
 *  itself (treated as a level name). */
function resolveLevelRef(target: string): string {
  return BASE_OPERATORS_TO_LEVEL[target] ?? target;
}

function addPrecedenceDecl(
  fragment: GrammarFragment,
  name:     string,
  spec:     PrecSpecRead,
  _fnName:  string,
): void {
  const constraints: Array<
    | { kind: "at";    target: string }
    | { kind: "above"; target: string }
    | { kind: "below"; target: string }
  > = [];
  if (spec.above !== undefined) constraints.push({ kind: "above", target: resolveLevelRef(spec.above) });
  if (spec.below !== undefined) constraints.push({ kind: "below", target: resolveLevelRef(spec.below) });
  if (!fragment.precedence) fragment.precedence = [];
  // Merge with an existing decl if one with the same name already exists.
  const existing = fragment.precedence.find(p => p.name === name);
  if (existing) {
    for (const c of constraints) {
      if (!existing.constraints.some(ec => ec.kind === c.kind && ec.target === c.target)) {
        existing.constraints.push(c);
      }
    }
  } else {
    fragment.precedence.push({ name, constraints });
  }
}

const grammar_fragment_new_impl: PrimitiveFnImpl = (args) => {
  if (args.length !== 1) throw new AllegroError(`grammar_fragment_new: expected 1 arg, got ${args.length}`);
  const base = bitsToString(asBits(args[0], "grammar_fragment_new"));
  return makeFragmentBuilderHandle(base);
};

/**
 * `grammar extends X { … }` desugars to this primitive: it takes an existing
 * Grammar value X and seeds a fresh fragment whose base identity chains onto
 * X's. The resulting Grammar — produced by finalize — has `baseChain` equal
 * to X's chain plus an anonymous "extends_<N>" tail marker for validator
 * compatibility checks.
 */
const grammar_fragment_new_from_impl: PrimitiveFnImpl = (args) => {
  if (args.length !== 1) throw new AllegroError(`grammar_fragment_new_from: expected 1 arg, got ${args.length}`);
  const data = asGrammarValue(args[0]);
  if (!data) throw new AllegroError(`grammar_fragment_new_from: argument is not a Grammar value`);
  // The fragment's "base" field is now a composite — we store the chain
  // itself so finalize can reproduce it. Use a sentinel base name that
  // encodes the chain length; finalize reads the full chain from the handle.
  const handle = makeFragmentBuilderHandle(data.baseChain.join("/"));
  const h = (handle as any).__grammarHandle as GrammarHandleData;
  // Attach the chain directly so finalize can use it verbatim.
  (h as any).extendsChain = data.baseChain;
  // Also copy the underlying fragment's declarations into the new one so
  // extensions stack cumulatively. (This differs from Phase 6's `use NAME`
  // merge which keeps fragments separate — here the new Grammar IS the old
  // one plus additions.)
  const src = data.fragment;
  h.fragment.keywords.push(...src.keywords);
  h.fragment.operators.push(...src.operators);
  h.fragment.infix.push(...src.infix);
  h.fragment.prefixOp.push(...src.prefixOp);
  h.fragment.postfixOp.push(...src.postfixOp);
  h.fragment.exprPrefix.push(...src.exprPrefix);
  if (src.precedence) {
    if (!h.fragment.precedence) h.fragment.precedence = [];
    h.fragment.precedence.push(...src.precedence);
  }
  if (src.exprForms) {
    if (!h.fragment.exprForms) h.fragment.exprForms = [];
    h.fragment.exprForms.push(...src.exprForms);
  }
  if (src.stmtForms) {
    if (!h.fragment.stmtForms) h.fragment.stmtForms = [];
    h.fragment.stmtForms.push(...src.stmtForms);
  }
  if (src.rules) {
    if (!h.fragment.rules) h.fragment.rules = [];
    h.fragment.rules.push(...src.rules);
  }
  return handle;
};

const grammar_infix_add_impl: PrimitiveFnImpl = (args) => {
  if (args.length !== 5) throw new AllegroError(`grammar_infix_add: expected 5 args, got ${args.length}`);
  const h      = asGrammarHandle(args[0], "grammar_infix_add");
  const op     = bitsToString(asBits(args[1], "grammar_infix_add"));
  const spec   = readPrecSpec(args[2], "grammar_infix_add");
  const assoc  = bitsToString(asBits(args[3], "grammar_infix_add")) as "left" | "right" | "none";
  const fn     = args[4];
  const level  = resolveLevelFromPrecSpec(spec, h, "grammar_infix_add");
  h.fragment.infix.push({ token: op, level, assoc, fn });
  if (!h.fragment.operators.includes(op)) h.fragment.operators.push(op);
  return args[0];
};

const grammar_prefix_add_impl: PrimitiveFnImpl = (args) => {
  if (args.length !== 4) throw new AllegroError(`grammar_prefix_add: expected 4 args, got ${args.length}`);
  const h      = asGrammarHandle(args[0], "grammar_prefix_add");
  const op     = bitsToString(asBits(args[1], "grammar_prefix_add"));
  const spec   = readPrecSpec(args[2], "grammar_prefix_add");
  const fn     = args[3];
  const level  = resolveLevelFromPrecSpec(spec, h, "grammar_prefix_add");
  h.fragment.prefixOp.push({ token: op, level, fn });
  if (!h.fragment.operators.includes(op)) h.fragment.operators.push(op);
  return args[0];
};

const grammar_postfix_add_impl: PrimitiveFnImpl = (args) => {
  if (args.length !== 4) throw new AllegroError(`grammar_postfix_add: expected 4 args, got ${args.length}`);
  const h      = asGrammarHandle(args[0], "grammar_postfix_add");
  const op     = bitsToString(asBits(args[1], "grammar_postfix_add"));
  const spec   = readPrecSpec(args[2], "grammar_postfix_add");
  const fn     = args[3];
  const level  = resolveLevelFromPrecSpec(spec, h, "grammar_postfix_add");
  h.fragment.postfixOp.push({ token: op, level, fn });
  if (!h.fragment.operators.includes(op)) h.fragment.operators.push(op);
  return args[0];
};

const grammar_expr_prefix_add_impl: PrimitiveFnImpl = (args) => {
  if (args.length !== 3) throw new AllegroError(`grammar_expr_prefix_add: expected 3 args, got ${args.length}`);
  const h  = asGrammarHandle(args[0], "grammar_expr_prefix_add");
  const kw = bitsToString(asBits(args[1], "grammar_expr_prefix_add"));
  const fn = args[2];
  h.fragment.exprPrefix.push({ keyword: kw, fn });
  if (!h.fragment.keywords.includes(kw)) h.fragment.keywords.push(kw);
  return args[0];
};

const grammar_fragment_finalize_impl: PrimitiveFnImpl = (args) => {
  if (args.length !== 1) throw new AllegroError(`grammar_fragment_finalize: expected 1 arg, got ${args.length}`);
  const h = asGrammarHandle(args[0], "grammar_fragment_finalize");
  // If the handle was created via grammar_fragment_new_from, use the full
  // chain it captured; otherwise use the single-step base name.
  const extendsChain: string[] | undefined = (h as any).extendsChain;
  if (extendsChain) {
    return makeGrammarValueWithChain(h.fragment, extendsChain);
  }
  return makeGrammarValue(h.fragment, h.base);
};

function makeGrammarValueWithChain(fragment: GrammarFragment, baseChain: string[]): ContextValue {
  const ctx  = makeContext() as ContextValue;
  const data: GrammarValueData = { fragment, baseChain };
  (ctx as any).__grammarValue = data;
  return ctx;
}

// --- Phase 6b primitives: user rules and multi-token forms ---

const grammar_rule_add_impl: PrimitiveFnImpl = (args) => {
  if (args.length !== 5) throw new AllegroError(`grammar_rule_add: expected 5 args, got ${args.length}`);
  const h       = asGrammarHandle(args[0], "grammar_rule_add");
  const name    = bitsToString(asBits(args[1], "grammar_rule_add"));
  const opStr   = bitsToString(asBits(args[2], "grammar_rule_add"));
  const ruleObj = args[3];
  const builder = args[4];
  const op: "add" | "append" = opStr === "append" ? "append" : "add";

  if (!h.fragment.rules) h.fragment.rules = [];
  h.fragment.rules.push({ name, op, rule: ruleObj, builder });
  return args[0];
};

const grammar_expr_form_add_impl: PrimitiveFnImpl = (args) => {
  if (args.length !== 3) throw new AllegroError(`grammar_expr_form_add: expected 3 args, got ${args.length}`);
  const h       = asGrammarHandle(args[0], "grammar_expr_form_add");
  const ruleObj = args[1];
  const builder = args[2];

  if (!h.fragment.exprForms) h.fragment.exprForms = [];
  h.fragment.exprForms.push({ rule: ruleObj, fn: builder });
  return args[0];
};

const grammar_stmt_form_add_impl: PrimitiveFnImpl = (args) => {
  if (args.length !== 3) throw new AllegroError(`grammar_stmt_form_add: expected 3 args, got ${args.length}`);
  const h       = asGrammarHandle(args[0], "grammar_stmt_form_add");
  const ruleObj = args[1];
  const builder = args[2];

  if (!h.fragment.stmtForms) h.fragment.stmtForms = [];
  h.fragment.stmtForms.push({ rule: ruleObj, fn: builder });
  return args[0];
};

// Remaining Phase 6 primitives still stubbed.

function notYet(name: string, step: string): AllegroError {
  return new AllegroError(`${name}: Phase 6 primitive not yet implemented (${step})`);
}
const grammar_precedence_add_impl:     PrimitiveFnImpl = () => { throw notYet("grammar_precedence_add", "step 5"); };
const grammar_rule_replace_impl:       PrimitiveFnImpl = () => { throw notYet("grammar_rule_replace",   "step 6c"); };
const grammar_rule_append_impl:        PrimitiveFnImpl = () => { throw notYet("grammar_rule_append",    "step 6c"); };
const grammar_combine_impl:            PrimitiveFnImpl = () => { throw notYet("combine",                "Phase 7");  };
const grammar_override_impl:           PrimitiveFnImpl = () => { throw notYet("override",               "Phase 7");  };
const grammar_without_impl:            PrimitiveFnImpl = () => { throw notYet("without",                "Phase 7");  };

// ============ TYPE SYSTEM ============

import {
  getType, getTypeName, withType, typeMethod, typeMemberDescriptor,
  isMethodDescriptor, isFieldDescriptor, isGetterDescriptor,
  IntType, FloatType, StringType, BoolType, ArrayType, ObjectType,
  FunctionType, makeFunctionType, getFunctionParamTypes, getFunctionReturnType,
  AnyType, Type, NominalType, makeArray, makeObject, NoneType, ErrorType, noneSingleton,
  isGenericType, getTypeArgs, getGenericType, applyGenericType, normalizeType,
  structuralWrap, makeUnionType, wrapType, buildRefinedType,
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
  // args[0] = left operand, args[1] = zero-param thunk wrapping right operand
  // If left is a type, this is a refinement: Type && <predicate-expression>
  // Otherwise, logical AND: left && right (short-circuit via thunk)
  const left = evalFn!(args[0], ctx!);
  if (!isResolved(left)) {
    return makeExpr(makePrimitive("typed_and", typed_and_impl, true), [left, args[1]]);
  }

  // Type refinement: if left is a type, extract the raw body from the thunk
  // and build a one-param predicate lambda (_ => body).
  const leftType = getType(left);
  if (leftType && (leftType === Type || leftType === NominalType)) {
    const thunk = args[1];
    if (thunk.kind === ValueKind.ComposedFunction && thunk.params.length === 0) {
      // Extract raw body and wrap as a one-param lambda with `_`
      const predicate = buildFn(["_"], thunk.body) as Value;
      const parentType = primaryOf(left) as ContextValue;
      return wrapType(buildRefinedType(parentType, predicate));
    }
    // Already a one-param lambda (rare path) — use directly
    const predicate = evalFn!(args[1], ctx!);
    if (!isResolved(predicate)) {
      return makeExpr(makePrimitive("typed_and", typed_and_impl, true), [left, predicate]);
    }
    const parentType = primaryOf(left) as ContextValue;
    return wrapType(buildRefinedType(parentType, predicate));
  }

  // Logical AND path (short-circuit)
  const leftP = primaryOf(left);
  if (leftP.kind === ValueKind.Bits && leftP.data === 0n) {
    return withType(makeInt(0), BoolType);
  }
  const right = evalFn!(args[1], ctx!);
  if (!isResolved(right)) {
    return makeExpr(makePrimitive("typed_and", typed_and_impl, true), [left, right]);
  }
  // Unwrap thunk
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
    // Look up member descriptor from __members
    const desc = typeMemberDescriptor(type, fieldName);
    if (desc) {
      if (isMethodDescriptor(desc)) {
        const impl = desc.bindings.get("value")?.value;
        if (impl?.kind === ValueKind.PrimitiveFunction) {
          const selfVal = primaryOf(obj);
          if (isGetterDescriptor(desc)) {
            return (impl as PrimitiveFunctionValue).fn([selfVal], undefined as any, undefined as any);
          }
          const boundFn: PrimitiveFnImpl = (callArgs, callCtx, callEvalFn) => {
            const evalArgs = callArgs.map(a => callEvalFn!(a, callCtx!));
            return (impl as PrimitiveFunctionValue).fn([selfVal, ...evalArgs], callCtx, callEvalFn);
          };
          return makePrimitive(`bound:${fieldName}`, boundFn, true);
        }
        if (impl?.kind === ValueKind.ComposedFunction) {
          // Mixin/user-defined method — pass full typed obj as self for field/method access
          if (isGetterDescriptor(desc)) {
            return evalFn!(makeExpr(impl, [obj]), ctx!);
          }
          const boundFn: PrimitiveFnImpl = (callArgs, callCtx, callEvalFn) => {
            const evalArgs = callArgs.map(a => callEvalFn!(a, callCtx!));
            return callEvalFn!(makeExpr(impl, [obj, ...evalArgs]), callCtx!);
          };
          return makePrimitive(`bound:${fieldName}`, boundFn, true);
        }
        if (impl) return impl;
      } else if (isFieldDescriptor(desc)) {
        // Field descriptor — look up field value on the instance's primary Context
        const instanceCtx = primaryOf(obj);
        if (instanceCtx.kind === ValueKind.Context) {
          const b = (instanceCtx as ContextValue).bindings.get(fieldName);
          if (b?.value !== undefined) return b.value;
        }
      }
    }

    // Fallback: typeMethod for backward compat (direct bindings like __getMember)
    const method = typeMethod(type, fieldName);
    if (method) {
      if (method.kind === ValueKind.PrimitiveFunction) {
        const selfVal = primaryOf(obj);
        const boundFn: PrimitiveFnImpl = (callArgs, callCtx, callEvalFn) => {
          const evalArgs = callArgs.map(a => callEvalFn!(a, callCtx!));
          return method.fn([selfVal, ...evalArgs], callCtx, callEvalFn);
        };
        return makePrimitive(`bound:${fieldName}`, boundFn, true);
      }
      return method;
    }

    // __getMember fallback for Object/module types
    const getMember = type.bindings.get("__getMember")?.value;
    if (getMember?.kind === ValueKind.PrimitiveFunction) {
      return (getMember as PrimitiveFunctionValue).fn([primaryOf(obj), stringToBits(fieldName)], undefined as any, undefined as any);
    }
    const typeName = getTypeName(obj) ?? "unknown";
    throw new AllegroError(`type_dispatch: '${fieldName}' not found on ${typeName}`);
  }

  // Untyped Contexts: check meta-type dispatch first (for method binding),
  // then direct binding lookup (for data fields)
  const p = primaryOf(obj);
  if (p.kind === ValueKind.Context) {
    // Meta-type dispatch: check __type for type-level methods (e.g., Int.extend)
    // This must come first so methods get proper self-binding
    const metaTypeBinding = (p as ContextValue).bindings.get("__type");
    if (metaTypeBinding?.value?.kind === ValueKind.Context) {
      const metaType = metaTypeBinding.value as ContextValue;
      const metaDesc = typeMemberDescriptor(metaType, fieldName);
      if (metaDesc) {
        if (isMethodDescriptor(metaDesc)) {
          const metaImpl = metaDesc.bindings.get("value")?.value;
          const selfVal = p;
          if (metaImpl?.kind === ValueKind.PrimitiveFunction) {
            if (isGetterDescriptor(metaDesc)) {
              return (metaImpl as PrimitiveFunctionValue).fn([selfVal], undefined as any, undefined as any);
            }
            const boundFn: PrimitiveFnImpl = (callArgs, callCtx, callEvalFn) => {
              const evalArgs = callArgs.map(a => callEvalFn!(a, callCtx!));
              return (metaImpl as PrimitiveFunctionValue).fn([selfVal, ...evalArgs], callCtx, callEvalFn);
            };
            return makePrimitive(`bound:${fieldName}`, boundFn, true);
          }
          if (metaImpl?.kind === ValueKind.ComposedFunction) {
            // User-defined meta-method (e.g., a type-level method added via
            // Type-mixin). Pass the type Context as self; mirrors the typed-
            // value path above which handles ComposedFunction descriptors.
            if (isGetterDescriptor(metaDesc)) {
              return evalFn!(makeExpr(metaImpl, [selfVal]), ctx!);
            }
            const boundFn: PrimitiveFnImpl = (callArgs, callCtx, callEvalFn) => {
              const evalArgs = callArgs.map(a => callEvalFn!(a, callCtx!));
              return callEvalFn!(makeExpr(metaImpl, [selfVal, ...evalArgs]), callCtx!);
            };
            return makePrimitive(`bound:${fieldName}`, boundFn, true);
          }
        }
      }
      // Fallback: direct binding on meta-type (for non-__members methods)
      const metaMethod = typeMethod(metaType, fieldName);
      if (metaMethod) {
        const selfVal = p;
        if (metaMethod.kind === ValueKind.PrimitiveFunction) {
          const boundFn: PrimitiveFnImpl = (callArgs, callCtx, callEvalFn) => {
            const evalArgs = callArgs.map(a => callEvalFn!(a, callCtx!));
            return (metaMethod as PrimitiveFunctionValue).fn([selfVal, ...evalArgs], callCtx, callEvalFn);
          };
          return makePrimitive(`bound:${fieldName}`, boundFn, true);
        }
        if (metaMethod.kind === ValueKind.ComposedFunction) {
          const boundFn: PrimitiveFnImpl = (callArgs, callCtx, callEvalFn) => {
            const evalArgs = callArgs.map(a => callEvalFn!(a, callCtx!));
            return callEvalFn!(makeExpr(metaMethod, [selfVal, ...evalArgs]), callCtx!);
          };
          return makePrimitive(`bound:${fieldName}`, boundFn, true);
        }
      }
    }

    // Direct binding lookup (for data fields like __name, non-method bindings)
    const b = p.bindings.get(fieldName);
    if (b && b.value !== undefined) return b.value;

    throw new AllegroError(`type_dispatch: '${fieldName}' not found`);
  }

  throw new AllegroError(`type_dispatch: '${fieldName}' not found on ${p.kind}`);
};

// --- refinement predicate helper ---

/**
 * Evaluate a refinement type's __predicate against a value.
 * Returns:
 *   { ok: true }          — predicate holds (or type has no predicate)
 *   { ok: false }         — predicate fails (type error)
 *   { ok: null, residual } — predicate unresolved (partial eval)
 *
 * Short-circuits when actualType is reference-equal to expectedType,
 * since the value was constructed/checked via this exact refined type.
 */
function checkRefinementPredicate(
  v: Value,
  expectedCtx: ContextValue,
  actualType: ContextValue | null,
  ctx: ContextValue,
  evalFn: (v: Value, ctx: ContextValue) => Value,
): { ok: boolean | null; residual?: Value } {
  const predicate = expectedCtx.bindings.get("__predicate")?.value;
  if (!predicate) return { ok: true };
  // Short-circuit: same refined type by reference → predicate already holds
  if (actualType === expectedCtx) return { ok: true };
  // Evaluate predicate against the value
  const result = evalFn(makeExpr(predicate, [v]), ctx);
  const p = primaryOf(result);
  if (p.kind === ValueKind.Bits) {
    return { ok: (p as BitsValue).data !== 0n };
  }
  // Unresolved — residual
  return { ok: null, residual: result };
}

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
  // - NominalType: nominal check (by __name and __extends chain)
  // - Type (or ~wrapped): structural check (by field compatibility)
  const actualType = getType(v);
  if (!actualType) throw new AllegroError("type_check: value has no type");
  const actualName = getTypeName(v);

  // Check if the expected type has its own instanceof (direct binding, e.g., UnionType)
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
    const instanceofMethod = typeMethod(typeType, "instanceof");
    if (instanceofMethod?.kind === ValueKind.PrimitiveFunction) {
      const checkResult = instanceofMethod.fn([expectedCtx, v], undefined as any, undefined as any);
      const checkP = primaryOf(checkResult);
      if (checkP.kind === ValueKind.Bits && checkP.data === 0n) {
        throw new AllegroError(`Type error: expected ${expectedName}, got ${actualName}`);
      }
      // Check refinement predicate if present
      const predCheck = checkRefinementPredicate(v, expectedCtx, actualType, ctx!, evalFn!);
      if (predCheck.ok === false) {
        throw new AllegroError(`Type error: refinement predicate failed for ${expectedName}`);
      }
      if (predCheck.ok === null) {
        // Unresolved predicate — return a residual type_check
        return makeExpr(makePrimitive("type_check", type_check_impl, true), [v, expectedType]);
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

// --- type_instanceof: boolean-returning type check (for `instanceof` infix) ---

const type_instanceof_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  const v = evalFn!(args[0], ctx!);
  const expectedType = evalFn!(args[1], ctx!);
  if (!isResolved(expectedType) || !isResolved(v)) {
    return makeExpr(makePrimitive("type_instanceof", type_instanceof_impl, true), [v, expectedType]);
  }

  const expectedCtx = primaryOf(expectedType);
  if (expectedCtx.kind !== ValueKind.Context) return withType(makeInt(0), BoolType);

  const expectedNameBinding = (expectedCtx as ContextValue).bindings.get("__name");
  if (!expectedNameBinding?.value) return withType(makeInt(0), BoolType);
  const expectedName = bitsToString(asBits(expectedNameBinding.value, "type_instanceof"));

  if (expectedName === "Any") return withType(makeInt(1), BoolType);

  const actualType = getType(v);
  if (!actualType) return withType(makeInt(0), BoolType);

  // Check via expected type's own instanceof (e.g., UnionType has direct binding, not in __members)
  const directInstanceof = (expectedCtx as ContextValue).bindings.get("instanceof")?.value;
  if (directInstanceof?.kind === ValueKind.PrimitiveFunction) {
    const result = directInstanceof.fn([v], undefined as any, undefined as any);
    const rp = primaryOf(result);
    return withType(makeInt(rp.kind === ValueKind.Bits && (rp as BitsValue).data !== 0n ? 1 : 0), BoolType);
  }

  // Use meta-type's instanceof
  const typeType = (expectedCtx as ContextValue).bindings.get("__type")?.value as ContextValue | undefined;
  if (typeType) {
    const instanceofMethod = typeMethod(typeType, "instanceof");
    if (instanceofMethod?.kind === ValueKind.PrimitiveFunction) {
      const result = instanceofMethod.fn([expectedCtx as ContextValue, v], undefined as any, undefined as any);
      const rp = primaryOf(result);
      const baseOk = rp.kind === ValueKind.Bits && (rp as BitsValue).data !== 0n;
      if (!baseOk) return withType(makeInt(0), BoolType);
      // Base check passed — also check refinement predicate if present
      const predCheck = checkRefinementPredicate(v, expectedCtx as ContextValue, actualType, ctx!, evalFn!);
      if (predCheck.ok === false) return withType(makeInt(0), BoolType);
      if (predCheck.ok === null) {
        // Unresolved predicate — return a residual instanceof
        return makeExpr(makePrimitive("type_instanceof", type_instanceof_impl, true), [v, expectedType]);
      }
      return withType(makeInt(1), BoolType);
    }
  }

  // Fallback: name-based
  const actualName = getTypeName(v);
  return withType(makeInt(actualName === expectedName ? 1 : 0), BoolType);
};

// --- type_subtypeof: check if type S is a subtype of type T ---

const type_subtypeof_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  const typeA = evalFn!(args[0], ctx!);
  const typeB = evalFn!(args[1], ctx!);
  if (!isResolved(typeA) || !isResolved(typeB)) {
    return makeExpr(makePrimitive("type_subtypeof", type_subtypeof_impl, true), [typeA, typeB]);
  }

  const ctxA = primaryOf(typeA);
  const ctxB = primaryOf(typeB);
  if (ctxA.kind !== ValueKind.Context || ctxB.kind !== ValueKind.Context) {
    return withType(makeInt(0), BoolType);
  }

  // If typeB uses structural checking (~wrapped or Type-based), use its subtypeof method
  const metaTypeB = (ctxB as ContextValue).bindings.get("__type")?.value as ContextValue | undefined;
  if (metaTypeB) {
    const bSubtypeof = typeMethod(metaTypeB, "subtypeof");
    if (bSubtypeof?.kind === ValueKind.PrimitiveFunction) {
      const result = bSubtypeof.fn([ctxA as ContextValue, ctxB as ContextValue], undefined as any, undefined as any);
      const rp = primaryOf(result);
      if (rp.kind === ValueKind.Bits && (rp as BitsValue).data !== 0n) {
        return withType(makeInt(1), BoolType);
      }
    }
  }

  // Otherwise use typeA's meta-type subtypeof method
  const metaType = (ctxA as ContextValue).bindings.get("__type")?.value as ContextValue | undefined;
  if (metaType) {
    const subtypeofMethod = typeMethod(metaType, "subtypeof");
    if (subtypeofMethod?.kind === ValueKind.PrimitiveFunction) {
      const result = subtypeofMethod.fn([ctxA as ContextValue, ctxB as ContextValue], undefined as any, undefined as any);
      const rp = primaryOf(result);
      return withType(makeInt(rp.kind === ValueKind.Bits && (rp as BitsValue).data !== 0n ? 1 : 0), BoolType);
    }
  }

  return withType(makeInt(0), BoolType);
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
  return wrapType(applyGenericType(genericCtx, typeArgs));
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
  return wrapType(makeUnionType(alternatives as ContextValue[]));
};

// --- structural_wrap: ~ operator on types ---

const structural_wrap_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  const v = evalFn!(args[0], ctx!);
  if (!isResolved(v)) {
    return makeExpr(makePrimitive("structural_wrap", structural_wrap_impl, true), [v]);
  }
  const typeCtx = asCtx(primaryOf(v), "structural_wrap");
  return wrapType(structuralWrap(typeCtx));
};

// --- type_refine: && operator on types (refinement types) ---

const type_refine_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  const typeVal = evalFn!(args[0], ctx!);
  const predicate = evalFn!(args[1], ctx!);
  if (!isResolved(typeVal) || !isResolved(predicate)) {
    return makeExpr(makePrimitive("type_refine", type_refine_impl, true), [typeVal, predicate]);
  }
  const parentType = asCtx(primaryOf(typeVal), "type_refine");
  return wrapType(buildRefinedType(parentType, predicate));
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
    // Type methods already return properly typed values (e.g., comparisons return Bool,
    // arithmetic returns the operand type). If the result is already a MultiValue, use it.
    if (result.kind === ValueKind.MultiValue) return result;
    // Otherwise wrap with the left operand's type (for raw Bits results)
    return withType(result, leftType);
  };
}

// ============ Build primitive values ============

const id_prim = makePrimitive("id", id_impl);
const eval_if_value = makePrimitive("eval_if", eval_if_impl, true);
const eval_when_value = makePrimitive("eval_when", eval_when_impl, true);

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
  component_get: makePrimitive("component_get", component_get_impl, true),
  make_error: makePrimitive("make_error", make_error_impl, true),
  eval_when: eval_when_value,
  when_wildcard: makePrimitive("when_wildcard", when_wildcard_impl),
  when_type_destruct: makePrimitive("when_type_destruct", when_type_destruct_impl),
  when_struct_destruct: makePrimitive("when_struct_destruct", when_struct_destruct_impl),
  when_no_match: makePrimitive("when_no_match", when_no_match_impl, true),
  id: id_prim,
  print: makePrimitive("print", print_impl, true),
  grammar_builder: makePrimitive("grammar_builder", grammar_builder_impl),
  grammar_add_dot_access: makePrimitive("grammar_add_dot_access", grammar_add_dot_access_impl),
  grammar_add_import: makePrimitive("grammar_add_import", grammar_add_import_impl),
  grammar_build: makePrimitive("grammar_build", grammar_build_impl),
  // Parser combinators (Phase 1)
  grammar_new: makePrimitive("grammar_new", grammar_new_impl),
  grammar_terminal: makePrimitive("grammar_terminal", grammar_terminal_impl),
  grammar_phrase: makePrimitive("grammar_phrase", grammar_phrase_impl),
  grammar_choice: makePrimitive("grammar_choice", grammar_choice_impl),
  grammar_choice_add: makePrimitive("grammar_choice_add", grammar_choice_add_impl),
  grammar_repeat: makePrimitive("grammar_repeat", grammar_repeat_impl),
  grammar_optional: makePrimitive("grammar_optional", grammar_optional_impl),
  grammar_set_target: makePrimitive("grammar_set_target", grammar_set_target_impl),
  grammar_parse: makePrimitive("grammar_parse", grammar_parse_impl),
  // Grammar 2 (new formalism, Phase 1) — scannerless parser, see docs/grammar-formalism.md
  ...grammar2Primitives,
  // Runtime grammar extensions (Phase 1: simple combinators — retained as the
  // low-level API; `grammar { … }` blocks (Phase 6) compile down to the
  // Phase 6 primitives below.)
  register_infix: makePrimitive("register_infix", register_infix_impl),
  register_prefix: makePrimitive("register_prefix", register_prefix_impl),
  register_postfix: makePrimitive("register_postfix", register_postfix_impl),
  register_expr_prefix: makePrimitive("register_expr_prefix", register_expr_prefix_impl),
  // Phase 6 grammar-building primitives (stubs; implemented step-by-step).
  grammar_fragment_new:       makePrimitive("grammar_fragment_new",       grammar_fragment_new_impl),
  grammar_fragment_new_from:  makePrimitive("grammar_fragment_new_from",  grammar_fragment_new_from_impl),
  grammar_fragment_finalize:  makePrimitive("grammar_fragment_finalize",  grammar_fragment_finalize_impl),
  grammar_precedence_add:    makePrimitive("grammar_precedence_add",    grammar_precedence_add_impl),
  grammar_infix_add:         makePrimitive("grammar_infix_add",         grammar_infix_add_impl),
  grammar_prefix_add:        makePrimitive("grammar_prefix_add",        grammar_prefix_add_impl),
  grammar_postfix_add:       makePrimitive("grammar_postfix_add",       grammar_postfix_add_impl),
  grammar_expr_prefix_add:   makePrimitive("grammar_expr_prefix_add",   grammar_expr_prefix_add_impl),
  grammar_expr_form_add:     makePrimitive("grammar_expr_form_add",     grammar_expr_form_add_impl),
  grammar_stmt_form_add:     makePrimitive("grammar_stmt_form_add",     grammar_stmt_form_add_impl),
  grammar_rule_add:          makePrimitive("grammar_rule_add",          grammar_rule_add_impl),
  grammar_rule_replace:      makePrimitive("grammar_rule_replace",      grammar_rule_replace_impl),
  grammar_rule_append:       makePrimitive("grammar_rule_append",       grammar_rule_append_impl),
  // Grammar combinators (accepted on the `use X` RHS whitelist).
  grammar_combine:           makePrimitive("grammar_combine",           grammar_combine_impl),
  grammar_override:          makePrimitive("grammar_override",          grammar_override_impl),
  grammar_without:           makePrimitive("grammar_without",           grammar_without_impl),
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
  type_instanceof: makePrimitive("type_instanceof", type_instanceof_impl, true),
  type_subtypeof: makePrimitive("type_subtypeof", type_subtypeof_impl, true),
  type_apply: makePrimitive("type_apply", type_apply_impl, true),
  type_union: makePrimitive("type_union", type_union_impl, true),
  structural_wrap: makePrimitive("structural_wrap", structural_wrap_impl, true),
  type_refine: makePrimitive("type_refine", type_refine_impl, true),
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
  // Async
  delay: makePrimitive("delay", delay_wrapper, true),
  fetch: makePrimitive("fetch", fetch_impl, true),
};