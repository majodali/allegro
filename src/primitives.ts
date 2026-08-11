// Allegretto - Primitive Functions

import { dataOf, getName, getMembers, getSlotCount, getRefines, getFallbackMember, getPredicate, getEqLhs, getEqRhs, getProofReason, getProofCounterexample, getAbstractDomain, getEffectBound, hasName, hasShapeSlot, hasDischarged, channelReadRaw, componentsView, cloneComponents, stampProposition, stampProofReason, stampProofCounterexample, stampEqOperands, kernelChannelWriter, registerChannel, channelList, assertNotIntegrityKey, typeShape, indexGet, PRESERVED_FN_META_KEYS, CHANNEL_WRITER_BRAND, HOST_KEYS, viralChannels } from "./slots.js";
import {
  Value, ValueKind, BitsValue, ContextValue, ComposedFunctionValue,
  PrimitiveFunctionValue, PrimitiveFnImpl, EvalFn, ExpressionValue,
  AllegroError, makeBits, makeInt, makeFloat, bitsToFloat, makePrimitive, makeExpr,
  makeParam, makeComposedFn, makeContext, makeMultiValue, makeSymbol,
  stringToBits, bitsToString,
} from "./types.js";
import { buildFn } from "./parser-helpers.js";
import { fqnBaseName } from "./symbols.js";
import { assertNotScope, scopeAssume, scopeExtend, scopeFactsFor, scopeOwnFacts, scopeLookup, scopeHostRead, isPendingCell } from "./scope.js";

// Held write capability for the discharged integrity channel (C1.4, D21-D24).
// Module-scope, never exported, never bound into any Allegro extension —
// the proof kernel's failed-proof constructor is the only origination site
// in this module.
const dischargedWriter = kernelChannelWriter("discharged");
import { grammar2Primitives } from "./grammar2/builder.js";
import { BASE_OPERATORS_TO_LEVEL } from "./grammar2/base-grammar.js";

// --- Value formatting ---

export function formatValue(v: Value): string {
  // Typed-value display. C4.3b: flattened Contexts (typed records/arrays)
  // carry channels directly, so the gate covers both roles and data reads
  // go through dataOf (identity for Contexts) instead of `.primary`.
  if (v.kind === ValueKind.Structure) {
    // Error values — show error component
    const errComp = channelReadRaw(v, "error");
    if (errComp !== undefined) {
      return `error(${formatValue(errComp)})`;
    }
    const typeComp = channelReadRaw(v, "type");
    if (typeComp && typeComp.kind === ValueKind.Structure) {
      const nameV = getName(typeComp as ContextValue);
      if (nameV && nameV.kind === ValueKind.Bits) {
        const typeName = bitsToString(nameV);
        const data = dataOf(v);
        // C6.2: a TYPE VALUE — its meta is a KIND (Type, Refinement,
        // Interface, Effect, …) — renders as its own name: `print(pure)`
        // → "pure", `print(io & time)` → "io & time", `print(Int)` →
        // "Int". Without this, kinds that declare instance fields (Effect's
        // kind/labels) would render their instances through the record path.
        if (data.kind === ValueKind.Structure && isTypeMeta(typeComp as ContextValue)) {
          const ownName = getName(data as ContextValue);
          if (ownName?.kind === ValueKind.Bits) return bitsToString(ownName as BitsValue);
        }
        if (typeName === "None") {
          return "none";
        }
        if (typeName === "String") {
          return bitsToString(data as BitsValue);
        }
        if (typeName === "Bool") {
          return (data as BitsValue).data !== 0n ? "true" : "false";
        }
        if (typeName === "Float") {
          return String(bitsToFloat(data as BitsValue));
        }
        if (typeName === "Array") {
          // Display array elements
          const ctx = data as ContextValue;
          const lenV = getSlotCount(ctx);
          const len = lenV ? Number((lenV as BitsValue).data) : 0;
          const elems: string[] = [];
          for (let i = 0; i < len && i < 10; i++) {
            const ev = indexGet(ctx, i);
            if (ev !== undefined) elems.push(formatValue(ev));
          }
          if (len > 10) elems.push("...");
          return `[${elems.join(", ")}]`;
        }
        if (typeName === "Object") {
          const ctx = data as ContextValue;
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
          const p = data;
          if (p.kind === ValueKind.ComposedFunction) {
            return `<function(${p.params.length})>`;
          }
          return `<function>`;
        }
        // Record types — check __members for Field descriptors
        const membersV = getMembers(typeComp as ContextValue);
        if (membersV?.kind === ValueKind.Structure && data.kind === ValueKind.Structure) {
          const membersCtx = membersV as ContextValue;
          const instanceCtx = data as ContextValue;
          const parts: string[] = [];
          // C5.2a: member keys are symbol FQNs; the instance stays
          // string-keyed (ruling R2) — project the base name for the read.
          for (const [key, binding] of membersCtx.bindings) {
            if (binding.value?.kind === ValueKind.Structure && isFieldDescriptor(binding.value as ContextValue)) {
              const fieldName = fqnBaseName(key);
              const fieldVal = instanceCtx.bindings.get(fieldName)?.value;
              if (fieldVal) parts.push(`${fieldName}: ${formatValue(fieldVal)}`);
            }
          }
          if (parts.length > 0) return `${typeName}(${parts.join(", ")})`;
        }
        // Int — display the primary normally
      }
    }
  }
  const p = dataOf(v);
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
    case ValueKind.Structure:
      return `<context(${p.bindings.size})>`;
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
  const p = dataOf(v);
  if (p.kind !== ValueKind.Bits) throw new AllegroError(`${ctx}: expected Bits, got ${p.kind}`);
  return p;
}

function asCtx(v: Value, ctx: string): ContextValue {
  const p = dataOf(v);
  if (p.kind !== ValueKind.Structure) throw new AllegroError(`${ctx}: expected Context, got ${p.kind}`);
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
  const e = dataOf(args[0]);
  if (e.kind !== ValueKind.Expression) throw new AllegroError("expr_fn: expected Expression");
  return e.fn;
};

const expr_args: PrimitiveFnImpl = (args) => {
  const e = dataOf(args[0]);
  if (e.kind !== ValueKind.Expression) throw new AllegroError("expr_args: expected Expression");
  return makeExpr(id_prim, e.args);
};

const expr_arg: PrimitiveFnImpl = (args) => {
  const e = dataOf(args[0]);
  if (e.kind !== ValueKind.Expression) throw new AllegroError("expr_arg: expected Expression");
  const i = Number(asBits(args[1], "expr_arg").data);
  if (i < 0 || i >= e.args.length) throw new AllegroError(`expr_arg: index ${i} out of range`);
  return e.args[i];
};

const expr_argc: PrimitiveFnImpl = (args) => {
  const e = dataOf(args[0]);
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
    case ValueKind.Structure: {
      // C7.1: carriers walk their primary; plain structures are inert.
      const pp = (v as { primary?: Value }).primary;
      if (pp !== undefined) collectUnownedParams(pp, out, seen);
      break;
    }
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
  const binding = { key, value };
  newCtx.bindings.set(key, binding);
  newCtx.bindingList.push(binding);
  return newCtx;
};

// C2.3b resolution unification (design §4, D11): the old throw path is
// retired. Absent name → error VALUE (a lexical matter; the reflective op
// reports it, propagating like any error). Declared-but-unresolved (a
// pending future cell) → residual Symbol, never a throw — it completes
// when a later phase resolves the cell. Chain-aware for layered scopes.
const ctx_resolve: PrimitiveFnImpl = (args) => {
  const ctx = asCtx(args[0], "ctx_resolve");
  const key = bitsToString(asBits(args[1], "ctx_resolve"));
  const b = scopeLookup(ctx, key);
  if (!b) {
    const components = new Map<string, Value>();
    components.set("error", withType(stringToBits(`ctx_resolve: '${key}' not found`), StringType));
    components.set("type", ErrorType);
    return makeMultiValue(makeInt(0), components);
  }
  if (isPendingCell(b)) return makeSymbol(key);
  return b.value!;
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

// C2.3a: ctx_use retired — zero consumers anywhere (src, lib, tests);
// the isUse flag it minted was write-only cargo. Unresolved bindings are
// future-cells (C2.3b), not use-markers.


// ============ MULTI-VALUE ============

const mv_new: PrimitiveFnImpl = (args) => makeMultiValue(args[0]);

const mv_primary: PrimitiveFnImpl = (args) => dataOf(args[0]);

const mv_get: PrimitiveFnImpl = (args) => {
  const key = bitsToString(asBits(args[1], "mv_get"));
  // C4.3b: channelReadRaw is total — flattened Contexts answer their
  // channel plane (and binding-plane channels like a type value's meta-type).
  const c = channelReadRaw(args[0], key) ?? componentsView(args[0]).get(key);
  if (c === undefined) throw new AllegroError(`mv_get: '${key}' not found`);
  return c;
};


// --- Channel plane: registration, free reads, attenuation (C1.4, D23/D24) ---
//
// `channel_register(name, rule) → writer` mints the write capability for a
// NEW channel; re-registration throws (forgery vector F). Reads are free.
// The writer is a PrimitiveFunction closure — unconstructible from
// Allegretto (D24); `channel_attenuate` wraps a held writer with a
// predicate, restricting what it may write (delegable attenuation).

const channel_register_impl: PrimitiveFnImpl = (args) => {
  const name = bitsToString(asBits(args[0], "channel_register"));
  const rule = bitsToString(asBits(args[1], "channel_register"));
  const writer = registerChannel({ name, rule: rule as import("./slots.js").PropagationRule }, true);
  const prim = makePrimitive(`<channel:${name} writer>`, (wargs) => {
    if (wargs.length !== 2) throw new AllegroError(`channel writer '${name}': expected (value, channelValue)`);
    return writer.write(wargs[0], wargs[1]);
  });
  (prim as any)[CHANNEL_WRITER_BRAND] = name;
  return prim;
};

const channel_read_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  const v = evalFn!(args[0], ctx!);
  const name = bitsToString(asBits(dataOf(evalFn!(args[1], ctx!)), "channel_read"));
  const c = channelReadRaw(v, name);
  return c === undefined ? noneSingleton : c;
};

const channel_list_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  const v = evalFn!(args[0], ctx!);
  return makeArray(channelList(v).map((n) => withType(stringToBits(n), StringType)));
};

const channel_attenuate_impl: PrimitiveFnImpl = (args) => {
  const base = dataOf(args[0]);
  const brand = (base as any)[CHANNEL_WRITER_BRAND];
  if (base.kind !== ValueKind.PrimitiveFunction || !brand) {
    throw new AllegroError("channel_attenuate: first argument is not a channel writer");
  }
  const pred = dataOf(args[1]);
  const prim = makePrimitive(`<channel:${brand} writer (attenuated)>`, (wargs, wctx, wevalFn) => {
    const ok = wevalFn!(makeExpr(pred, [wargs[1]]), wctx!);
    const okP = dataOf(ok);
    if (okP.kind !== ValueKind.Bits || (okP as BitsValue).data === 0n) {
      throw new AllegroError(`channel writer '${brand}': attenuation predicate rejected the write`);
    }
    return (base as PrimitiveFunctionValue).fn(wargs, wctx, wevalFn);
  });
  (prim as any)[CHANNEL_WRITER_BRAND] = brand;
  return prim;
};

const mv_set: PrimitiveFnImpl = (args) => {
  const key = bitsToString(asBits(args[1], "mv_set"));
  assertNotIntegrityKey(key, "mv_set");
  const val = args[2];
  // C4.3b: cloneComponents is total and makeMultiValue flattens Context
  // primaries, so one path covers MV, flattened Context, and bare values.
  const nc = cloneComponents(args[0]);
  nc.set(key, val);
  return makeMultiValue(dataOf(args[0]), nc);
};

const mv_components: PrimitiveFnImpl = (args) => {
  // C4.3b: componentsView is total — flattened Contexts report their keys.
  const keys: Value[] = [];
  for (const k of componentsView(args[0]).keys()) keys.push(stringToBits(k));
  return makeExpr(id_prim, keys);
};

// ============ EVAL_IF (lazy) ============

const eval_if_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  if (args.length !== 3) throw new AllegroError(`eval_if: need 3 args, got ${args.length}`);
  const cond = evalFn!(args[0], ctx!);
  // C4.3a (R2): an error-carrying condition propagates the error instead of
  // branching on its (meaningless) primary — the legacy behavior silently
  // took the else branch (differential fixture err-in-if-cond).
  if (cond.kind === ValueKind.Structure
      && channelReadRaw(cond, "error") !== undefined) {
    return cond;
  }
  const condP = dataOf(cond);
  if (condP.kind === ValueKind.Bits) {
    const took_then = condP.data !== 0n;
    const branch = took_then ? args[1] : args[2];
    // Phase C Chunk 2: derive branch predicates from the condition. Symbols
    // referenced in cond gain the implied predicate within the chosen
    // branch; the branch's evaluation context carries the scope predicates.
    const branchPreds = _deriveBranchPredicates(args[0], took_then,
      took_then ? "branch-then" : "branch-else");
    const branchCtx = branchPreds.size > 0 ? augmentScopePredicates(ctx!, branchPreds) : ctx!;
    // If branch is a thunk (composed fn with no params), evaluate its body
    const evalBranch = evalFn!(branch, branchCtx);
    if (evalBranch.kind === ValueKind.ComposedFunction && evalBranch.params.length === 0) {
      return evalFn!(evalBranch.body, branchCtx);
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
  const subP = dataOf(subPattern);

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
    const innerCtx = dataOf(value);
    if (innerCtx.kind !== ValueKind.Structure) return null;
    return extractFields(innerCtx as ContextValue, (subPattern as any).args, evalFn, ctx);
  }

  // Nested type destruct
  if (isPatternPrim(subPattern, "when_type_destruct")) {
    const typeValue = (subPattern as any).args[0];
    const fieldSpecs = (subPattern as any).args.slice(1);
    const valTypeName = getTypeName(value);
    const patTypeName = typeValue.kind === ValueKind.Structure
      ? bitsToString(dataOf(
          getName(typeValue as ContextValue) ?? stringToBits("")
        ) as BitsValue)
      : null;
    if (!valTypeName || !patTypeName || valTypeName !== patTypeName) return null;
    const innerCtx = dataOf(value);
    if (innerCtx.kind !== ValueKind.Structure) return null;
    return extractFields(innerCtx as ContextValue, fieldSpecs, evalFn, ctx);
  }

  // Type context → instanceof check
  if (subP.kind === ValueKind.Structure &&
      hasName(subP as ContextValue) &&
      hasShapeSlot(subP as ContextValue)) {
    const valTypeName = getTypeName(value);
    const patName = bitsToString(dataOf(
      getName(subP as ContextValue)!
    ) as BitsValue);
    if (valTypeName === patName) return [value]; // match + bind
    return null;
  }

  // Bits literal → equality check
  if (subP.kind === ValueKind.Bits) {
    const valP = dataOf(value);
    if (valP.kind === ValueKind.Bits &&
        (valP as BitsValue).length === (subP as BitsValue).length &&
        (valP as BitsValue).data === (subP as BitsValue).data) {
      return []; // match, no binding
    }
    return null;
  }

  // Reference equality fallback
  if (dataOf(value) === subP) return [];
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
    const fieldName = bitsToString(dataOf(specArgs[i]) as BitsValue);
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
/** C3.2 narrowing for substituted-value subjects: clone-on-write walk
 *  replacing object-identity occurrences of `target` with `replacement`.
 *  Clones only the path to each occurrence; ComposedFunctions get fresh
 *  params + remapped bodies (the standard clone pattern — see
 *  resolveNamedParams / typeLiterals). Data-plane Contexts are NOT
 *  entered: narrowing narrows this occurrence's uses, not values stored
 *  inside data structures. */
function replaceValueIdentity(v: Value, target: Value, replacement: Value, seen?: Set<Value>): Value {
  if (v === target) return replacement;
  if (!v || typeof v !== "object") return v;
  if (!seen) seen = new Set();
  if (v.kind === ValueKind.ComposedFunction && seen.has(v)) return v;

  switch (v.kind) {
    case ValueKind.Expression: {
      const newFn = replaceValueIdentity(v.fn, target, replacement, seen);
      const newArgs = v.args.map(a => replaceValueIdentity(a, target, replacement, seen));
      if (newFn === v.fn && newArgs.every((a, i) => a === v.args[i])) return v;
      return makeExpr(newFn, newArgs);
    }
    case ValueKind.ComposedFunction: {
      seen.add(v);
      const newBody = replaceValueIdentity(v.body, target, replacement, seen);
      if (newBody === v.body) return v;
      const newParams = v.params.map(p => ({
        kind: ValueKind.Param, position: p.position, owner: null as any, _name: p._name,
      } as import("./types.js").ParamValue));
      const paramMap = new Map<import("./types.js").ParamValue, import("./types.js").ParamValue>();
      for (let i = 0; i < v.params.length; i++) paramMap.set(v.params[i], newParams[i]);
      const remapped = _remapParams(newBody, paramMap);
      const newFn: ComposedFunctionValue = { kind: ValueKind.ComposedFunction, params: newParams, body: remapped };
      for (const p of newFn.params) p.owner = newFn;
      for (const k of PRESERVED_FN_META_KEYS) {
        if ((v as any)[k] !== undefined) (newFn as any)[k] = (v as any)[k];
      }
      return newFn;
    }
    case ValueKind.Structure: {
      // C7.1: carriers walk their primary; plain structures are inert.
      const pp = (v as { primary?: Value }).primary;
      if (pp === undefined) return v;
      const newP = replaceValueIdentity(pp, target, replacement, seen);
      if (newP === pp) return v;
      return makeMultiValue(newP, cloneComponents(v));
    }
    default:
      return v;
  }
}

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

  // Phase E prerequisite: when the subject is unresolved (e.g., inside
  // `precompileFunction` with a typed Param placeholder, or any other
  // pre-runtime PE), defer matching by returning a residual eval_when
  // expression. Without this, a chain whose patterns can't be statically
  // decided would fall through to `when_no_match` and throw — turning a
  // legitimate compile-time scenario into a spurious precompile error.
  // The residual evaluates normally once the subject is resolved.
  if (!isResolved(subject)) {
    return makeExpr(eval_when_value, [subject, args[1], args[2], args[3], args[4]]);
  }

  const pattern = evalFn!(args[1], ctx!);
  const guardFn = args[2];     // guard function or literal Int(1) for no guard
  const thenBranch = args[3];
  const elseBranch = args[4];

  const subjectP = dataOf(subject);
  let matched = false;
  let extractedValues: Value[] = [];
  // C3.2 (D36): a matched TYPE pattern narrows the subject's occurrence
  // knowledge within the arm — the annotation bound is lifted on the value
  // bound into the branch, and (for Symbol subjects) on references to the
  // subject's name inside the arm via an O(1) scope shadow layer.
  let narrowedSubject: Value | null = null;

  if (isPatternPrim(pattern, "when_wildcard")) {
    matched = true;

  } else if (isPatternPrim(pattern, "when_type_destruct")) {
    const patternExpr = pattern as import("./types.js").ExpressionValue;
    const typeValue = patternExpr.args[0];
    const fieldSpecs = patternExpr.args.slice(1);

    const subjectTypeName = getTypeName(subject);
    const typeCtx = dataOf(typeValue);
    const patternTypeName = typeCtx.kind === ValueKind.Structure
      ? bitsToString(dataOf(
          getName(typeCtx as ContextValue) ?? stringToBits("")
        ) as BitsValue)
      : null;

    if (subjectTypeName && patternTypeName && subjectTypeName === patternTypeName) {
      if (subjectP.kind === ValueKind.Structure) {
        const values = extractFields(subjectP as ContextValue, fieldSpecs, evalFn!, ctx!);
        if (values) {
          matched = true;
          extractedValues = values;
          narrowedSubject = clearOccurrenceBound(subject);
        }
      }
    }

  } else if (isPatternPrim(pattern, "when_struct_destruct")) {
    const patternExpr = pattern as import("./types.js").ExpressionValue;
    const fieldSpecs = patternExpr.args;

    if (subjectP.kind === ValueKind.Structure) {
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
    const patternP = dataOf(pattern);

    // Type context → instanceof check (for patterns like `is Int`)
    if (patternP.kind === ValueKind.Structure &&
        hasName(patternP as ContextValue) &&
        hasShapeSlot(patternP as ContextValue)) {
      const subjectTypeName = getTypeName(subject);
      const patternName = bitsToString(dataOf(
        getName(patternP as ContextValue)!
      ) as BitsValue);
      if (subjectTypeName === patternName) {
        matched = true;
        // The pattern names the subject's own type — narrowed: the arm
        // has full knowledge, so the occurrence bound is lifted both on
        // the bound-into-branch value and (below) on the subject's name.
        narrowedSubject = clearOccurrenceBound(subject);
        extractedValues = [narrowedSubject]; // bind the value
      }
    } else if (subjectP.kind === ValueKind.Bits && patternP.kind === ValueKind.Bits) {
      matched = (subjectP as BitsValue).length === (patternP as BitsValue).length &&
                (subjectP as BitsValue).data === (patternP as BitsValue).data;
    } else {
      matched = subjectP === patternP;
    }
  }

  if (matched) {
    // C3.2: within the matched arm, the subject's occurrence knowledge is
    // narrowed. Two subject forms, two mechanisms:
    //   - SYMBOL subject (scope-resolved binding): an O(1) child scope
    //     layer shadows the name with the narrowed value (arm exit =
    //     discard; the else arm keeps the outer view).
    //   - VALUE subject (a substituted function param): occurrences of
    //     the subject inside the arm are the SAME object substitution
    //     placed there — a clone-on-write identity replacement swaps in
    //     the narrowed value. Substitution clones the nodes on former
    //     param positions per call, so the walk never touches shared ASTs.
    let matchCtx = ctx!;
    let armThen = thenBranch;
    let armGuard = guardFn;
    if (narrowedSubject && narrowedSubject !== subject) {
      if (args[0].kind === ValueKind.Symbol) {
        const subjectName = (args[0] as { name: string }).name;
        matchCtx = scopeExtend(ctx!, [[subjectName, { key: subjectName, value: narrowedSubject }]]);
      } else {
        armThen = replaceValueIdentity(thenBranch, subject, narrowedSubject);
        armGuard = replaceValueIdentity(guardFn, subject, narrowedSubject);
      }
    }
    // Evaluate guard if present
    const evalGuard = evalFn!(armGuard, matchCtx);
    const guardP = dataOf(evalGuard);
    if (guardP.kind === ValueKind.ComposedFunction && (guardP as any).params?.length > 0) {
      // Guard is a function — apply with extracted values
      const guardResult = evalFn!(makeExpr(evalGuard, extractedValues), matchCtx);
      const guardRP = dataOf(guardResult);
      if (guardRP.kind === ValueKind.Bits && (guardRP as BitsValue).data === 0n) {
        // Guard failed — fall through
        return evalElseBranch(elseBranch, ctx!, evalFn!);
      }
    } else if (guardP.kind === ValueKind.Bits && (guardP as BitsValue).data === 0n) {
      // Guard is a literal false
      return evalElseBranch(elseBranch, ctx!, evalFn!);
    }
    // Guard passed (or is literal 1 / non-function truthy)
    return evalThenBranch(armThen, extractedValues, matchCtx, evalFn!);
  }

  return evalElseBranch(elseBranch, ctx!, evalFn!);
};

// ============ COMPONENT_GET (lazy — for "Y of x" syntax) ============

const component_get_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  if (args.length !== 2) throw new AllegroError(`component_get: need 2 args, got ${args.length}`);
  const value = evalFn!(args[0], ctx!);
  const key = bitsToString(dataOf(args[1]) as BitsValue);
  // C4.3b: channelReadRaw is total — flattened Contexts answer their channel
  // plane, and bare type Contexts answer `type of Int` through the `__type`
  // binding-plane fallback. componentsView covers ad-hoc mv_set keys.
  const c = channelReadRaw(value, key) ?? componentsView(value).get(key);
  if (c !== undefined) return c;
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
  // Lazy for evaluation control: print defers on unresolved args (futures)
  const v = evalFn ? evalFn(args[0], ctx!) : args[0];
  if (!isResolved(v)) {
    // Value is pending (async future or other residual) — defer print
    return makeExpr(makePrimitive("print", print_impl, true), [v]);
  }
  // Use FutureManager's onOutput if available (for async/web streaming).
  // C2.3b: chain-aware — the manager lives on the root evaluation scope,
  // but print may run under a child layer (e.g. a unification-enriched ctx).
  const fm = ctx ? scopeHostRead(ctx, HOST_KEYS.futureManager) as any : undefined;
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
  const ms = Number(asBits(dataOf(v), "delay").data);
  const fm = (ctx ? scopeHostRead(ctx, HOST_KEYS.futureManager) : undefined) as import("./futures.js").FutureManager | undefined;
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
  const url = bitsToString(asBits(dataOf(v), "fetch"));
  const fm = (ctx ? scopeHostRead(ctx, HOST_KEYS.futureManager) : undefined) as import("./futures.js").FutureManager | undefined;
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
  const p = dataOf(b.value);
  if (p.kind !== ValueKind.Bits) return undefined;
  return bitsToString(p as BitsValue);
}
function optionalIntFromCtx(ctx: ContextValue, key: string): number | undefined {
  const b = ctx.bindings.get(key);
  if (!b?.value) return undefined;
  const p = dataOf(b.value);
  if (p.kind !== ValueKind.Bits) return undefined;
  return Number((p as BitsValue).data);
}
function arrayHandlesFromValue(v: Value, fnName: string): number[] {
  const p = dataOf(v);
  if (p.kind !== ValueKind.Structure) {
    throw new AllegroError(`${fnName}: expected Array of handles`);
  }
  const ctx = p as ContextValue;
  const lenB = getSlotCount(ctx);
  const len = lenB?.kind === ValueKind.Bits ? Number((lenB as BitsValue).data) : 0;
  const handles: number[] = [];
  for (let i = 0; i < len; i++) {
    const itemV = indexGet(ctx, i);
    if (itemV === undefined) continue;
    const ip = dataOf(itemV);
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
    const p = dataOf(args[0]);
    if (p.kind === ValueKind.Structure) {
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
    const p = dataOf(args[2]);
    if (p.kind === ValueKind.Structure) {
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
  const p = dataOf(v);
  if (p.kind !== ValueKind.Structure) {
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
  const p = dataOf(v);
  if (p.kind !== ValueKind.Structure) return undefined;
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
  const p = dataOf(v);
  if (p.kind !== ValueKind.Structure) {
    throw new AllegroError(`${fnName}: expected prec_spec object, got ${p.kind}`);
  }
  const out: PrecSpecRead = {};
  for (const key of ["at", "above", "below", "prec"] as const) {
    const b = p.bindings.get(key);
    if (b?.value) {
      const bp = dataOf(b.value);
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

/**
 * Hygienic resolution: walk a template ComposedFunction's body and replace
 * free Symbols with their resolved values from the enclosing eval context.
 *
 * Why: grammar templates like `(s, cs) => match_dispatch(s, cs)` contain
 * Symbols (`match_dispatch`) that, if left unresolved, get looked up in the
 * CONSUMER'S scope at parse time. If the consumer accidentally binds the
 * same name, the grammar extension silently misbehaves.
 *
 * With hygienic resolution, at registration time we bind Symbols in the
 * template body to their module-scope Values — so a consumer binding of the
 * same name can't hijack the template.
 *
 * Symbols that don't resolve at registration time (either not yet defined,
 * or genuinely intended to resolve in the consumer scope) are left as
 * Symbols; they'll look up in the consumer's scope as before.
 */
function resolveFreeSymbols(v: Value, ctx: ContextValue, seen: Set<Value> = new Set()): Value {
  if (!v || typeof v !== "object") return v;
  if (v.kind === ValueKind.ComposedFunction && seen.has(v)) return v;

  switch (v.kind) {
    case ValueKind.Symbol: {
      const b = ctx.bindings.get(v.name);
      if (b?.value !== undefined && isResolved(b.value)) {
        return b.value;
      }
      return v;
    }
    case ValueKind.Expression: {
      const newFn = resolveFreeSymbols(v.fn, ctx, seen);
      const newArgs = v.args.map(a => resolveFreeSymbols(a, ctx, seen));
      if (newFn === v.fn && newArgs.every((a, i) => a === v.args[i])) return v;
      return makeExpr(newFn, newArgs);
    }
    case ValueKind.ComposedFunction: {
      seen.add(v);
      const newBody = resolveFreeSymbols(v.body, ctx, seen);
      if (newBody === v.body) return v;
      const newFn: any = { kind: ValueKind.ComposedFunction, params: v.params, body: newBody };
      // Retarget Params' owner to the new fn so substituteParams can find them.
      for (const p of newFn.params) p.owner = newFn;
      return newFn;
    }
    case ValueKind.Structure: {
      // C7.1: carriers walk their primary; plain structures are inert.
      const pp = (v as { primary?: Value }).primary;
      if (pp === undefined) return v;
      const newPrimary = resolveFreeSymbols(pp, ctx, seen);
      if (newPrimary === pp) return v;
      return makeMultiValue(newPrimary, cloneComponents(v));
    }
    default:
      return v;
  }
}

const grammar_infix_add_impl: PrimitiveFnImpl = (args, ctx) => {
  if (args.length !== 5) throw new AllegroError(`grammar_infix_add: expected 5 args, got ${args.length}`);
  const h      = asGrammarHandle(args[0], "grammar_infix_add");
  const op     = bitsToString(asBits(args[1], "grammar_infix_add"));
  const spec   = readPrecSpec(args[2], "grammar_infix_add");
  const assoc  = bitsToString(asBits(args[3], "grammar_infix_add")) as "left" | "right" | "none";
  const fn     = ctx ? resolveFreeSymbols(args[4], ctx) : args[4];
  const level  = resolveLevelFromPrecSpec(spec, h, "grammar_infix_add");
  h.fragment.infix.push({ token: op, level, assoc, fn });
  if (!h.fragment.operators.includes(op)) h.fragment.operators.push(op);
  return args[0];
};

const grammar_prefix_add_impl: PrimitiveFnImpl = (args, ctx) => {
  if (args.length !== 4) throw new AllegroError(`grammar_prefix_add: expected 4 args, got ${args.length}`);
  const h      = asGrammarHandle(args[0], "grammar_prefix_add");
  const op     = bitsToString(asBits(args[1], "grammar_prefix_add"));
  const spec   = readPrecSpec(args[2], "grammar_prefix_add");
  const fn     = ctx ? resolveFreeSymbols(args[3], ctx) : args[3];
  const level  = resolveLevelFromPrecSpec(spec, h, "grammar_prefix_add");
  h.fragment.prefixOp.push({ token: op, level, fn });
  if (!h.fragment.operators.includes(op)) h.fragment.operators.push(op);
  return args[0];
};

const grammar_postfix_add_impl: PrimitiveFnImpl = (args, ctx) => {
  if (args.length !== 4) throw new AllegroError(`grammar_postfix_add: expected 4 args, got ${args.length}`);
  const h      = asGrammarHandle(args[0], "grammar_postfix_add");
  const op     = bitsToString(asBits(args[1], "grammar_postfix_add"));
  const spec   = readPrecSpec(args[2], "grammar_postfix_add");
  const fn     = ctx ? resolveFreeSymbols(args[3], ctx) : args[3];
  const level  = resolveLevelFromPrecSpec(spec, h, "grammar_postfix_add");
  h.fragment.postfixOp.push({ token: op, level, fn });
  if (!h.fragment.operators.includes(op)) h.fragment.operators.push(op);
  return args[0];
};

const grammar_expr_prefix_add_impl: PrimitiveFnImpl = (args, ctx) => {
  if (args.length !== 3) throw new AllegroError(`grammar_expr_prefix_add: expected 3 args, got ${args.length}`);
  const h  = asGrammarHandle(args[0], "grammar_expr_prefix_add");
  const kw = bitsToString(asBits(args[1], "grammar_expr_prefix_add"));
  const fn = ctx ? resolveFreeSymbols(args[2], ctx) : args[2];
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

const grammar_rule_add_impl: PrimitiveFnImpl = (args, ctx) => {
  if (args.length !== 5) throw new AllegroError(`grammar_rule_add: expected 5 args, got ${args.length}`);
  const h       = asGrammarHandle(args[0], "grammar_rule_add");
  const name    = bitsToString(asBits(args[1], "grammar_rule_add"));
  const opStr   = bitsToString(asBits(args[2], "grammar_rule_add"));
  const ruleObj = args[3];
  const builder = ctx ? resolveFreeSymbols(args[4], ctx) : args[4];
  const op: "add" | "append" = opStr === "append" ? "append" : "add";

  if (!h.fragment.rules) h.fragment.rules = [];
  h.fragment.rules.push({ name, op, rule: ruleObj, builder });
  return args[0];
};

const grammar_expr_form_add_impl: PrimitiveFnImpl = (args, ctx) => {
  if (args.length !== 3) throw new AllegroError(`grammar_expr_form_add: expected 3 args, got ${args.length}`);
  const h       = asGrammarHandle(args[0], "grammar_expr_form_add");
  const ruleObj = args[1];
  const builder = ctx ? resolveFreeSymbols(args[2], ctx) : args[2];

  if (!h.fragment.exprForms) h.fragment.exprForms = [];
  h.fragment.exprForms.push({ rule: ruleObj, fn: builder });
  return args[0];
};

const grammar_stmt_form_add_impl: PrimitiveFnImpl = (args, ctx) => {
  if (args.length !== 3) throw new AllegroError(`grammar_stmt_form_add: expected 3 args, got ${args.length}`);
  const h       = asGrammarHandle(args[0], "grammar_stmt_form_add");
  const ruleObj = args[1];
  const builder = ctx ? resolveFreeSymbols(args[2], ctx) : args[2];

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

const grammar_rule_replace_alt_impl: PrimitiveFnImpl = (args, ctx) => {
  if (args.length !== 5) throw new AllegroError(`grammar_rule_replace_alt: expected 5 args, got ${args.length}`);
  const h        = asGrammarHandle(args[0], "grammar_rule_replace_alt");
  const name     = bitsToString(asBits(args[1], "grammar_rule_replace_alt"));
  const selector = bitsToString(asBits(args[2], "grammar_rule_replace_alt"));
  const ruleObj  = args[3];
  const builder  = ctx ? resolveFreeSymbols(args[4], ctx) : args[4];

  if (!h.fragment.rules) h.fragment.rules = [];
  h.fragment.rules.push({
    name,
    op: "replaceAlt" as any,
    rule: ruleObj,
    builder,
    selector,
  } as any);
  return args[0];
};

const grammar_rule_remove_impl: PrimitiveFnImpl = (args) => {
  if (args.length !== 3) throw new AllegroError(`grammar_rule_remove: expected 3 args, got ${args.length}`);
  const h        = asGrammarHandle(args[0], "grammar_rule_remove");
  const name     = bitsToString(asBits(args[1], "grammar_rule_remove"));
  const selector = bitsToString(asBits(args[2], "grammar_rule_remove"));

  if (!h.fragment.rules) h.fragment.rules = [];
  h.fragment.rules.push({
    name,
    op: "remove" as any,
    rule: undefined as any,
    selector,
  } as any);
  return args[0];
};
const grammar_combine_impl:            PrimitiveFnImpl = () => { throw notYet("combine",                "Phase 7");  };
const grammar_override_impl:           PrimitiveFnImpl = () => { throw notYet("override",               "Phase 7");  };
const grammar_without_impl:            PrimitiveFnImpl = () => { throw notYet("without",                "Phase 7");  };

// ============ TYPE SYSTEM ============

import {
  getType, getTypeName, withType, withTypeReplacing, applyBoundaryBound, typeContextName, typeMethod, typeMemberDescriptor,
  isMethodDescriptor, isFieldDescriptor, isGetterDescriptor,
  IntType, FloatType, StringType, BoolType, ArrayType, ObjectType,
  FunctionType, makeFunctionType, getFunctionParamTypes, getFunctionReturnType,
  AnyType, Type, makeArray, makeObject, NoneType, ErrorType, noneSingleton,
  isGenericType, getTypeArgs, getGenericType, applyGenericType, normalizeType,
  structuralWrap, makeUnionType, wrapType, buildRefinedType, isTypeMeta,
  Effect as _Effect, effectUnion as _effectUnion, isEffectInstance as _isEffectInstance,
  makeProof as _makeProof, isProof as _isProof, Proof as _Proof,
} from "./types-std.js";
import { isResolved } from "./types.js";
import {
  withEffects as _withEffects,
  effectsOf as _effectsOf,
} from "./effects.js";
import { precompileFunction as _precompileFunction, isTailCall as _isTailCall, remapParams as _remapParams } from "./evaluator.js";

// F3b: tracks ComposedFunctions whose body is currently being precompiled,
// so the recursive call inside `factorial(n) => factorial(n-1)` doesn't
// re-enter precompile and loop forever. Cleared when the precompile call
// completes or throws.
const _precompileInProgress = new WeakSet<ComposedFunctionValue>();
import {
  domainOf as _domainOf, impliesDomain as _impliesDomain,
  AbstractDomain as _AbstractDomain, EffectsDomain as _EffectsDomain,
  domainFromPredicate,
  predicatesOf as _predicatesOf, withPredicates as _withPredicates,
  PredicateSet as _PredicateSet, entailsPredicate as _entailsPredicate,
  mergePredicateSets as _mergePredicateSets,
  deriveBranchPredicates as _deriveBranchPredicates,
  PredicateSource as _PredicateSource,
  domainOrFromValue as _domainOrFromValue,
  counterexampleFor as _counterexampleFor,
  occurrenceBoundOf, clearOccurrenceBound,
} from "./refinements.js";

/**
 * Phase C Chunk 2: build a child ContextValue inheriting `parent`'s
 * bindings (shared) but with `extra` scope predicates merged in. Used by
 * branch refinement to push narrowing down into a branch's evaluation.
 *
 * Existing scope predicates in `parent` are inherited; new entries are
 * merged via `mergePredicateSets`. Mutations to the returned ctx do not
 * affect the parent.
 */
function augmentScopePredicates(parent: ContextValue, extra: Map<string, _PredicateSet>): ContextValue {
  // C2.2: immutable fact layering — the child carries ONLY the new facts;
  // reads merge across the chain (scopeFactsFor), reproducing the former
  // copy-parent-then-merge semantics without the copy. Compile-mode reads
  // are chain-aware (scopeCompileMode), so no flag propagation needed.
  // NOTE: the child shares the parent's BINDINGS via the scope chain, not
  // via shared Maps — scopeAssume creates a real (empty-binding) layer.
  return scopeAssume(parent, extra);
}

// --- typed_int / typed_string: wrap raw values with type ---

// The typed_* literal wrappers are the literal's real construction point:
// typeLiterals provisionally guesses 64-bit literals as Int, and these
// wrappers REPLACE the guess (withTypeReplacing) rather than re-stamp —
// C3.1's shape-fixed-at-construction guard applies only after this point.
const typed_int_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  const v = evalFn!(args[0], ctx!);
  if (!isResolved(v)) return makeExpr(makePrimitive("typed_int", typed_int_impl, true), [v]);
  return withTypeReplacing(v, IntType);
};

const typed_string_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  const v = evalFn!(args[0], ctx!);
  if (!isResolved(v)) return makeExpr(makePrimitive("typed_string", typed_string_impl, true), [v]);
  return withTypeReplacing(v, StringType);
};

const typed_float_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  const v = evalFn!(args[0], ctx!);
  if (!isResolved(v)) return makeExpr(makePrimitive("typed_float", typed_float_impl, true), [v]);
  // If arg is a string (Bits from stringToBits), parse it as a float
  const p = dataOf(v);
  if (p.kind === ValueKind.Bits) {
    // Check if it's a string representation (non-64-bit) that needs parsing
    if (p.length !== 64 || (v.kind === ValueKind.Structure && getTypeName(v) === "String")) {
      const str = bitsToString(p);
      return withType(makeFloat(parseFloat(str)), FloatType);
    }
    return withType(p, FloatType);
  }
  return withTypeReplacing(v, FloatType);
};

const typed_bool_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  const v = evalFn!(args[0], ctx!);
  if (!isResolved(v)) return makeExpr(makePrimitive("typed_bool", typed_bool_impl, true), [v]);
  return withTypeReplacing(v, BoolType);
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
    entries.push([bitsToString(dataOf(keyV) as BitsValue), valV]);
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
  const paramCount = Number(asBits(dataOf(evalFn!(args[1], ctx!)), "typed_function").data);
  const paramTypes: Value[] = [];
  for (let i = 0; i < paramCount; i++) {
    const pt = evalFn!(args[2 + i], ctx!);
    // Type variables (unresolved Params) are kept as-is — they'll be
    // resolved during unification when the function is called
    if (isResolved(pt)) {
      const ptPrimary = dataOf(pt);
      if (ptPrimary.kind === ValueKind.Structure && isGenericType(ptPrimary as ContextValue)) {
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
    const rtp = dataOf(returnTypeRaw);
    if (rtp.kind === ValueKind.Structure && isGenericType(rtp as ContextValue)) {
      returnType = normalizeType(rtp as ContextValue);
    } else {
      returnType = rtp;
    }
  }
  // Stamp param-level effect bounds on each ParamValue. The annotation
  // `f: pure` flows through paramTypes here; PE's Param-call branch reads
  // `Param.effectBound` to propagate effects when the param is called.
  // Without this, function-typed params would always look effect-less
  // inside their declarer.
  //
  // C7.2c (was Stage C2): effect-variable param types (paramType is a Symbol
  // matching an Effect-kinded entry in the function's `__genericParams`) set
  // the Param's DECLARED `effectVar` reference — the variable's bare name
  // rides inferred effect sets; concrete call sites resolve it by ordinary
  // PE substitution. The `__effectvar:` marker strings and the
  // `__effectVarParams` side table are retired (D39).
  const fnPrimary = dataOf(fn);
  if (fnPrimary.kind === ValueKind.ComposedFunction) {
    const cFn = fnPrimary as any;
    const params = cFn.params as Array<{ effectBound?: Set<string>; effectVar?: string }>;
    const genericParams = (cFn as any).__genericParams as Array<{ name: string; kind?: any }> | undefined;
    const effectVarNames = new Set<string>();
    if (genericParams) {
      for (const gp of genericParams) {
        if (gp.kind && gp.kind.kind === ValueKind.Symbol && (gp.kind as any).name === "Effect") {
          effectVarNames.add(gp.name);
        }
      }
    }
    for (let i = 0; i < Math.min(params.length, paramTypes.length); i++) {
      const pt = paramTypes[i];
      if (!pt) continue;
      // Concrete Effect-extending type (pure / opaque / named effect): stamp
      // the literal bound (F2: writes to Param.effectBound directly, not
      // wrapped in a PredicateSet).
      if (pt.kind === ValueKind.Structure) {
        const bound = (pt as any).__effectBound as _AbstractDomain | undefined;
        if (bound && bound.kind === "effects") {
          params[i].effectBound = new Set(bound.labels);
        }
        continue;
      }
      // Effect variable: paramType is a Symbol whose name matches an Effect-
      // kinded generic-param declaration. Set the declared reference; PE's
      // Param-call branch surfaces the bare variable name in inferred sets.
      if (pt.kind === ValueKind.Symbol) {
        const symName = (pt as any).name as string;
        if (effectVarNames.has(symName)) {
          params[i].effectVar = symName;
        }
      }
    }
    // Stage D — Surface C `param_effects f: pure` body-form. C1.5b: the
    // (paramRef, effSym) pairs are stashed on the function by
    // collapseBodyMetadata — no AST peeling. Evaluate each effect Symbol in
    // the call ctx (so `pure`/`io`/etc. resolve via extensions) and stamp
    // the matching Param's effectBound. By-name match against
    // `cFn.params[i].name` survives `remapParams` clones.
    const pePairs = (cFn as any).__paramEffectPairs as Value[] | undefined;
    if (pePairs) {
      for (let i = 0; i + 1 < pePairs.length; i += 2) {
        const paramRef = dataOf(pePairs[i]);
        if (paramRef.kind !== ValueKind.Param) continue;
        const paramName = (paramRef as any)._name as string | undefined;
        if (!paramName) continue;
        const idx = (cFn.params as any[]).findIndex(p => p._name === paramName);
        if (idx < 0) continue;
        const effVal = evalFn!(pePairs[i + 1], ctx!);
        const effPrim = dataOf(effVal);
        if (effPrim.kind !== ValueKind.Structure) continue;
        const bound = getEffectBound(effPrim as ContextValue) as _AbstractDomain | undefined;
        if (bound && bound.kind === "effects") {
          (cFn.params[idx] as any).effectBound = new Set(bound.labels);
        }
        // bound absent = opaque (universal) — leave unset, matching Surface A.
      }
    }
  }

  // F3b: trigger PE-driven body inference on inline typed functions too.
  // Top-level functions get this via `precompileFunctions` in runtime.ts;
  // inline lambdas like `arr.map((x: Int): Int => print(x))` need it here
  // so the cb's effects component is populated when the outer call's
  // applyPrimitive runs its arg-effects loop.
  if (fnPrimary.kind === ValueKind.ComposedFunction
      && (fnPrimary as any).__inferredEffects === undefined
      && !_precompileInProgress.has(fnPrimary as ComposedFunctionValue)) {
    _precompileInProgress.add(fnPrimary as ComposedFunctionValue);
    try {
      _precompileFunction(fnPrimary as ComposedFunctionValue, paramTypes, ctx!);
    } catch (_e) {
      // Body PE may fail (e.g. type errors that surface only at full
      // resolution). Leave __inferredEffects undefined; downstream paths
      // treat the absence as pure / no effects recorded.
    } finally {
      _precompileInProgress.delete(fnPrimary as ComposedFunctionValue);
    }
  }
  const fnType = makeFunctionType(paramTypes, returnType);
  let typed = withType(fn, fnType);
  // Stage F1: attach the body's inferred effect set (stashed by
  // `precompileFunction` after PE) as the `effects` MultiValue component.
  // Callers see the function's effects via `effectsOf` — the canonical
  // location for the function's effects (replacing the predicate-set/walker
  // path during the F1 → F2 migration).
  const inferredEff = (fnPrimary as any).__inferredEffects as Set<string> | undefined;
  if (inferredEff && inferredEff.size > 0) {
    typed = _withEffects(typed, inferredEff);
  }
  return typed;
};

// --- Logical operators (short-circuiting) ---

const typed_and_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  // args[0] = left operand, args[1] = zero-param thunk wrapping right operand.
  // Pure logical AND with short-circuit. Type-axis conjunction is `&` →
  // `typed_amp` since Slice 2 Stage 0; `&&` no longer creates refinements.
  const left = evalFn!(args[0], ctx!);
  if (!isResolved(left)) {
    return makeExpr(makePrimitive("typed_and", typed_and_impl, true), [left, args[1]]);
  }
  const leftP = dataOf(left);
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
  const rightP = dataOf(rightVal);
  if (rightP.kind === ValueKind.Bits && rightP.data === 0n) {
    return withType(makeInt(0), BoolType);
  }
  return withType(makeInt(1), BoolType);
};

// `&` — type/effect conjunction. For Stage 0, the supported shape is
// refinement: `Type & <predicate-body>`. The right operand is a zero-arg
// thunk; we extract its body and wrap it as a one-param predicate lambda
// (`_ => body`) before passing to `buildRefinedType`. Type intersection
// (two types) and effect conjunction (anonymous compound effects) are
// scheduled for later Slice 2 stages and currently raise an error.
const typed_amp_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  const left = evalFn!(args[0], ctx!);
  if (!isResolved(left)) {
    return makeExpr(makePrimitive("typed_amp", typed_amp_impl, true), [left, args[1]]);
  }
  const leftType = getType(left);
  // C6.1b: refined types answer meta `Refinement` (which conforms to
  // Type), so the gate is kind-conformance, not identity — chained
  // refinements (`PI & _ < 100`) stay types.
  if (!leftType || leftType.kind !== ValueKind.Structure || !isTypeMeta(leftType as ContextValue)) {
    const ln = leftType ? getTypeName(left) : "untyped";
    throw new AllegroError(`'&' requires a type on the left (got ${ln})`);
  }
  const thunk = args[1];
  // Stage C3: if `left` is an Effect-extending type, evaluate the right operand
  // (peeling the thunk wrapper) and dispatch to effect conjunction. The walker
  // reads body-level effects via __effectvar markers; this branch handles
  // value-level effect arithmetic (`pure & io`, `e1 & e2` in return positions
  // once both resolve, etc.). When the right side is unresolved (a symbolic
  // effect variable), return a residual so the expression survives until call
  // sites bind concrete values.
  const leftPrim = dataOf(left);
  if (leftPrim.kind === ValueKind.Structure && isEffectExtending(leftPrim as ContextValue)) {
    const right = (thunk.kind === ValueKind.ComposedFunction && thunk.params.length === 0)
      ? evalFn!(thunk.body, ctx!)
      : evalFn!(args[1], ctx!);
    if (!isResolved(right)) {
      return makeExpr(makePrimitive("typed_amp", typed_amp_impl, true), [left, right]);
    }
    const rightPrim = dataOf(right);
    if (rightPrim.kind === ValueKind.Structure && isEffectExtending(rightPrim as ContextValue)) {
      return wrapType(_effectUnion(leftPrim as ContextValue, rightPrim as ContextValue));
    }
    throw new AllegroError(`'&' on an Effect type expects another Effect on the right (got ${getTypeName(right) ?? "untyped"})`);
  }
  if (thunk.kind === ValueKind.ComposedFunction && thunk.params.length === 0) {
    // Refinement: extract the raw body and wrap as `_ => body`.
    const predicate = buildFn(["_"], thunk.body) as Value;
    const parentType = dataOf(left) as ContextValue;
    return wrapType(buildRefinedType(parentType, predicate));
  }
  // Right operand is a resolved type or other value — type-intersection /
  // effect-conjunction. Deferred to later Slice 2 stages.
  const right = evalFn!(args[1], ctx!);
  if (!isResolved(right)) {
    return makeExpr(makePrimitive("typed_amp", typed_amp_impl, true), [left, right]);
  }
  throw new AllegroError("'&' between two types not yet supported (Stage 0); use a predicate body like 'Int & _ > 0'");
};

/** True if `t` is the Effect kind or one of its instances (`pure`,
 *  `opaque`, named effects, operator-minted conjunctions). C6.2: the
 *  `__refines = Effect` chain hack is gone — instances are identified by
 *  their label set (the shape stamp's carrier). */
function isEffectExtending(t: ContextValue): boolean {
  return t === _Effect || _isEffectInstance(t);
}

const typed_or_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  const left = evalFn!(args[0], ctx!);
  if (!isResolved(left)) {
    return makeExpr(makePrimitive("typed_or", typed_or_impl, true), [left, args[1]]);
  }
  // Short-circuit: if left is truthy, return true without evaluating right
  const leftP = dataOf(left);
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
  const rightP = dataOf(rightVal);
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
  const p = dataOf(val);
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
  // Wrap with exported marker. C4.3b: cloneComponents is total, so an
  // exported record/module value keeps its channels (type included).
  const primary = dataOf(v);
  const components = cloneComponents(v);
  components.set("exported", makeInt(1));
  return makeMultiValue(primary, components);
};

// --- type_dispatch: type-directed dot access ---

const type_dispatch_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  // C2.1: struct ops reject evaluation scopes (plane violation guard).
  if (args[0]?.kind === ValueKind.Structure) assertNotScope(args[0], "type_dispatch");
  const obj = evalFn!(args[0], ctx!);
  const fieldArg = evalFn!(args[1], ctx!);
  if (!isResolved(obj) || !isResolved(fieldArg)) {
    // C4.3a (R1): viral channels ride the dispatch residual — dispatching a
    // member on an unresolved error-carrying value propagates the error
    // instead of dropping it (err-through-method). Resolved error values
    // still dispatch normally (Error's own members stay callable).
    if (obj.kind === ValueKind.Structure) {
      for (const chan of viralChannels()) {
        const comp = channelReadRaw(obj, chan);
        if (comp !== undefined) {
          const components = new Map<string, Value>([[chan, comp]]);
          const typeComp = channelReadRaw(obj, "type");
          if (typeComp) components.set("type", typeComp);
          return makeMultiValue(
            makeExpr(makePrimitive("type_dispatch", type_dispatch_impl, true), [obj, fieldArg]),
            components,
          );
        }
      }
    }
    return makeExpr(makePrimitive("type_dispatch", type_dispatch_impl, true), [obj, fieldArg]);
  }
  const fieldName = bitsToString(asBits(fieldArg, "type_dispatch"));
  // C3.1 (D36): dispatch reads the SHAPE — member-transparent refinement
  // layers (predicate-only, member set shared with the parent) never
  // affect member lookup; preserveOps/mixin layers mint their own member
  // sets and ARE shapes. Error messages keep the stored type's name.
  const storedType = getType(obj);
  const type = storedType ? typeShape(storedType) : null;

  if (type) {
    // C3.2 (D36): member AVAILABILITY follows KNOWLEDGE — an epistemic
    // gate, not access control (that's S3). An occurrence bound (stamped
    // at an annotation boundary — `x: Animal` receiving a Dog) determines
    // which members this occurrence may refer to; a member that resolves
    // still dispatches through the SHAPE, so overrides run (Liskov).
    // This gate is the current-representation form of the single PE
    // resolver (design §6): availability resolves text → symbol by
    // knowledge; dispatch resolves symbol → implementation by shape.
    // Open types are exempt: the base Object type (dynamic fields by
    // design) and fallback-only types with no declared member set
    // (module objects — their __getMember IS their own policy).
    const bound = occurrenceBoundOf(obj);
    if (bound && bound !== storedType && bound !== dataOf(ObjectType as unknown as Value)) {
      const boundMembers = getMembers(bound);
      const membersEmpty = !boundMembers ||
        (boundMembers.kind === ValueKind.Structure && (boundMembers as ContextValue).bindings.size === 0);
      const openType = membersEmpty && getFallbackMember(bound) !== undefined;
      if (!openType) {
        const visible = typeMemberDescriptor(bound, fieldName) !== null
          || typeMethod(bound, fieldName) !== null;
        if (!visible) {
          const boundName = typeContextName(bound) ?? "<anonymous>";
          const shapeName = getTypeName(obj) ?? "<unknown>";
          throw new AllegroError(
            `type_dispatch: '${fieldName}' is not available through annotation '${boundName}' ` +
            `(the value's type is '${shapeName}') — narrow with \`when … is ${shapeName}\``,
          );
        }
      }
    }
    // Look up member descriptor from __members
    const desc = typeMemberDescriptor(type, fieldName);
    if (desc) {
      if (isMethodDescriptor(desc)) {
        const impl = desc.bindings.get("value")?.value;
        if (impl?.kind === ValueKind.PrimitiveFunction) {
          const selfVal = dataOf(obj);
          if (isGetterDescriptor(desc)) {
            return (impl as PrimitiveFunctionValue).fn([selfVal], undefined as any, undefined as any);
          }
          const boundFn: PrimitiveFnImpl = (callArgs, callCtx, callEvalFn) => {
            const evalArgs = callArgs.map(a => callEvalFn!(a, callCtx!));
            return (impl as PrimitiveFunctionValue).fn([selfVal, ...evalArgs], callCtx, callEvalFn);
          };
          // Propagate the underlying primitive's effects so dot-dispatch
          // doesn't strip them. Critical for stdlib HOFs (Array.map, etc.)
          // tagged opaque in sub-chunk 1.3.
          return makePrimitive(`bound:${fieldName}`, boundFn, true, (impl as PrimitiveFunctionValue).effects);
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
        const instanceCtx = dataOf(obj);
        if (instanceCtx.kind === ValueKind.Structure) {
          const b = (instanceCtx as ContextValue).bindings.get(fieldName);
          if (b?.value !== undefined) return b.value;
        }
      }
    }

    // Fallback: typeMethod for backward compat (direct bindings like __getMember)
    const method = typeMethod(type, fieldName);
    if (method) {
      if (method.kind === ValueKind.PrimitiveFunction) {
        const selfVal = dataOf(obj);
        const boundFn: PrimitiveFnImpl = (callArgs, callCtx, callEvalFn) => {
          const evalArgs = callArgs.map(a => callEvalFn!(a, callCtx!));
          return method.fn([selfVal, ...evalArgs], callCtx, callEvalFn);
        };
        return makePrimitive(`bound:${fieldName}`, boundFn, true, method.effects);
      }
      // C4.3b: bind ComposedFunction methods with self too — mirrors both
      // this path's descriptor branch and the untyped meta-dispatch fallback
      // (which custom-meta-typed Contexts used to reach before getType went
      // total; the two paths must agree on the returned shape).
      if (method.kind === ValueKind.ComposedFunction) {
        const boundFn: PrimitiveFnImpl = (callArgs, callCtx, callEvalFn) => {
          const evalArgs = callArgs.map(a => callEvalFn!(a, callCtx!));
          return callEvalFn!(makeExpr(method, [obj, ...evalArgs]), callCtx!);
        };
        return makePrimitive(`bound:${fieldName}`, boundFn, true);
      }
      return method;
    }

    // __getMember fallback for Object/module types
    const getMember = getFallbackMember(type);
    if (getMember?.kind === ValueKind.PrimitiveFunction) {
      return (getMember as PrimitiveFunctionValue).fn([dataOf(obj), stringToBits(fieldName)], undefined as any, undefined as any);
    }
    const typeName = getTypeName(obj) ?? "unknown";
    throw new AllegroError(`type_dispatch: '${fieldName}' not found on ${typeName}`);
  }

  // Untyped Contexts: check meta-type dispatch first (for method binding),
  // then direct binding lookup (for data fields)
  const p = dataOf(obj);
  if (p.kind === ValueKind.Structure) {
    // Meta-type dispatch: check __type for type-level methods (e.g., Int.extend)
    // This must come first so methods get proper self-binding
    const metaTypeV = channelReadRaw(p, "shape");
    if (metaTypeV?.kind === ValueKind.Structure) {
      const metaType = metaTypeV as ContextValue;
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
            return makePrimitive(`bound:${fieldName}`, boundFn, true, (metaImpl as PrimitiveFunctionValue).effects);
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
          return makePrimitive(`bound:${fieldName}`, boundFn, true, (metaMethod as PrimitiveFunctionValue).effects);
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
  const predicate = getPredicate(expectedCtx);
  if (!predicate) return { ok: true };
  // Short-circuit: same refined type by reference → predicate already holds
  if (actualType === expectedCtx) return { ok: true };

  // Phase B: subtyping via abstract domains. If the value carries a domain
  // and the expected type has one too, and the value's domain implies the
  // expected one, the predicate is proved without a runtime call.
  const expectedDom = (expectedCtx as any).__abstractDomain as _AbstractDomain | undefined;
  if (expectedDom && expectedDom.kind !== "opaque") {
    const valueDom = _domainOf(v);
    const actualTypeDom = actualType ? (actualType as any).__abstractDomain as _AbstractDomain | undefined : undefined;
    const effective = valueDom ?? actualTypeDom ?? null;
    if (effective && _impliesDomain(effective, expectedDom)) {
      return { ok: true };
    }
  }

  // Evaluate predicate against the value
  const result = evalFn(makeExpr(predicate, [v]), ctx);
  const p = dataOf(result);
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
  // Forward TailCalls untouched so applyComposed's tco_loop can catch them.
  // Without this, a typed-return function whose body's tail call goes through
  // type_check (the wrapper that `: ReturnType` adds) would crash on the
  // sentinel — the intermediate type check is bypassed but the eventual
  // base-case value is still type-checked through the same wrapper, so
  // correctness is preserved.
  if (_isTailCall(v)) return v as any;
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
  const rawExpectedCtx = asCtx(dataOf(expectedType), "type_check");
  const expectedCtx = normalizeType(rawExpectedCtx);

  const expectedNameV = getName(expectedCtx);
  if (!expectedNameV) throw new AllegroError("type_check: expected type has no __name");
  const expectedName = bitsToString(asBits(expectedNameV, "type_check"));

  // Any matches everything
  if (expectedName === "Any") return v;

  // Phase D1 Slice 2 Stage A: effect-bound discharge. Same shape as the
  // checkArgType path in evaluator.ts — `__effectBound` on the expected type
  // (set by buildEffect for `pure` / named effects; absent on `opaque`)
  // triggers an actual ⊆ bound check via impliesDomain. Reuses the predicate
  // entailment infrastructure rather than introducing a parallel channel.
  const effBound = (expectedCtx as any).__effectBound as _AbstractDomain | undefined;
  if (effBound && effBound.kind === "effects") {
    // F2: read effects from the value's `effects` MultiValue component
    // (PE-populated) rather than via the predicate-set view. `effectsOf`
    // also reads `__inferredEffects` from bare ComposedFunctions so
    // untyped functions are covered through the same path.
    const argEff = _effectsOf(v) ?? new Set<string>();
    const actualDom: _EffectsDomain = { kind: "effects", labels: argEff };
    if (!_impliesDomain(actualDom, effBound)) {
      const actualLabels = [...argEff].sort().join(", ") || "pure";
      throw new AllegroError(
        `Type error: expected effect bound \`${expectedName}\`, got effects \`${actualLabels}\``,
      );
    }
    return v;
  }

  // Refinement-type handling: if expected is a refined type, check the value
  // against the BASE (via __refines), then either (a) discharge via abstract
  // domain (Phase B subtyping), or (b) evaluate the predicate at runtime.
  // This lets a plain Int value satisfy PositiveInt when the predicate holds
  // — the standard refinement-as-subtype-of-base semantics.
  const refinementPredicate = getPredicate(expectedCtx);
  if (refinementPredicate) {
    const base = getRefines(expectedCtx);
    if (base?.kind === ValueKind.Structure) {
      // Recurse on the base (unwraps nested refinements)
      const baseChecked = type_check_impl([v, base], ctx, evalFn);
      const actualType0 = getType(v);
      // Phase B fast path: if abstract domains can prove the implication,
      // skip the runtime predicate evaluation.
      const expectedDom = (expectedCtx as any).__abstractDomain as _AbstractDomain | undefined;
      if (expectedDom && expectedDom.kind !== "opaque") {
        const valueDom = _domainOf(v);
        const actualTypeDom = actualType0 ? (actualType0 as any).__abstractDomain as _AbstractDomain | undefined : undefined;
        const effective = valueDom ?? actualTypeDom ?? null;
        if (effective && _impliesDomain(effective, expectedDom)) return baseChecked;
      }
      // Fall back to runtime predicate evaluation.
      if (actualType0 !== expectedCtx) {
        const result = evalFn!(makeExpr(refinementPredicate, [v]), ctx!);
        const p = dataOf(result);
        if (p.kind === ValueKind.Bits && (p as BitsValue).data === 0n) {
          throw new AllegroError(`Type error: refinement predicate failed for ${expectedName}`);
        }
        if (!(p.kind === ValueKind.Bits)) {
          // Predicate unresolved — return residual type_check.
          return makeExpr(makePrimitive("type_check", type_check_impl, true), [v, expectedType]);
        }
      }
      return baseChecked;
    }
  }

  // Step 3: Check using the type's instanceof method
  // Type's instanceof is shape-aware:
  // - Both operands named → nominal check (by __name and __refines chain)
  // - Either operand anonymous (~wrapped, interface, union, …) → structural check
  const actualType = getType(v);
  if (!actualType) throw new AllegroError("type_check: value has no type");
  const actualName = getTypeName(v);

  // Check if the expected type has its own instanceof (direct binding, e.g., UnionType)
  const directInstanceof = expectedCtx.bindings.get("instanceof")?.value;
  if (directInstanceof?.kind === ValueKind.PrimitiveFunction) {
    const checkResult = directInstanceof.fn([v], undefined as any, undefined as any);
    const checkP = dataOf(checkResult);
    if (checkP.kind === ValueKind.Bits && checkP.data === 0n) {
      throw new AllegroError(`Type error: expected ${expectedName}, got ${actualName}`);
    }
    return applyBoundaryBound(v, expectedCtx);
  }

  // Use the meta-type's instanceof method
  const typeType = channelReadRaw(expectedCtx, "shape") as ContextValue | undefined;
  if (typeType) {
    const instanceofMethod = typeMethod(typeType, "instanceof");
    if (instanceofMethod?.kind === ValueKind.PrimitiveFunction) {
      const checkResult = instanceofMethod.fn([expectedCtx, v], undefined as any, undefined as any);
      const checkP = dataOf(checkResult);
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
      // C3.2: successful passage through an annotation (return type,
      // binding annotation) is a boundary crossing — stamp/reset the
      // occurrence bound.
      return applyBoundaryBound(v, expectedCtx);
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
        const expArgCtx = dataOf(expectedArgs[i]);
        const actArgCtx = dataOf(actualArgs[i]);
        if (expArgCtx.kind === ValueKind.Structure && actArgCtx.kind === ValueKind.Structure) {
          const expArgName = getName(expArgCtx as ContextValue);
          const actArgName = getName(actArgCtx as ContextValue);
          if (expArgName && actArgName) {
            const en = bitsToString(asBits(expArgName, "type_check"));
            const an = bitsToString(asBits(actArgName, "type_check"));
            if (en !== "Any" && en !== an) {
              throw new AllegroError(`Type error: expected ${expectedName}[${en}], got ${expectedName}[${an}]`);
            }
          }
        }
      }
    }
  }

  return applyBoundaryBound(v, expectedCtx);
};

// --- type_instanceof: boolean-returning type check (for `instanceof` infix) ---

const type_instanceof_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  const v = evalFn!(args[0], ctx!);
  const expectedType = evalFn!(args[1], ctx!);
  if (!isResolved(expectedType) || !isResolved(v)) {
    return makeExpr(makePrimitive("type_instanceof", type_instanceof_impl, true), [v, expectedType]);
  }

  const expectedCtx = dataOf(expectedType);
  if (expectedCtx.kind !== ValueKind.Structure) return withType(makeInt(0), BoolType);

  const expectedNameV = getName(expectedCtx as ContextValue);
  if (!expectedNameV) return withType(makeInt(0), BoolType);
  const expectedName = bitsToString(asBits(expectedNameV, "type_instanceof"));

  if (expectedName === "Any") return withType(makeInt(1), BoolType);

  const actualType = getType(v);
  if (!actualType) return withType(makeInt(0), BoolType);

  // C3.3 (D36): instanceof on a MEMBER-TRANSPARENT refinement is a PURE
  // PREDICATE RE-CHECK from data — never a certificate peek. Two values
  // equal in shape and data answer identically regardless of how they
  // were constructed (congruence; the identity/domain fast paths inside
  // checkRefinementPredicate are sound over immutable data — a re-check
  // would agree). The base check recurses on the parent, unwinding nested
  // refinements down to the shape. Shape-minting refined types
  // (preserveOps — own member sets, per the C3.1 typeShape boundary)
  // stay nominal: instanceof on a SHAPE is a shape question, answered
  // purely from the value's own shape. Certificate-peeking is the
  // separate, EFFECTFUL `certificate_peek` op.
  if (getPredicate(expectedCtx as ContextValue) !== undefined
      && typeShape(expectedCtx as ContextValue) !== expectedCtx) {
    const base = getRefines(expectedCtx as ContextValue);
    if (base?.kind === ValueKind.Structure) {
      const baseRes = type_instanceof_impl([v, base], ctx, evalFn);
      const brp = dataOf(baseRes);
      if (brp.kind !== ValueKind.Bits) {
        return makeExpr(makePrimitive("type_instanceof", type_instanceof_impl, true), [v, expectedType]);
      }
      if ((brp as BitsValue).data === 0n) return withType(makeInt(0), BoolType);
      const predCheck = checkRefinementPredicate(v, expectedCtx as ContextValue, actualType, ctx!, evalFn!);
      if (predCheck.ok === false) return withType(makeInt(0), BoolType);
      if (predCheck.ok === null) {
        return makeExpr(makePrimitive("type_instanceof", type_instanceof_impl, true), [v, expectedType]);
      }
      return withType(makeInt(1), BoolType);
    }
  }

  // Check via expected type's own instanceof (e.g., UnionType has direct binding, not in __members)
  const directInstanceof = (expectedCtx as ContextValue).bindings.get("instanceof")?.value;
  if (directInstanceof?.kind === ValueKind.PrimitiveFunction) {
    const result = directInstanceof.fn([v], undefined as any, undefined as any);
    const rp = dataOf(result);
    return withType(makeInt(rp.kind === ValueKind.Bits && (rp as BitsValue).data !== 0n ? 1 : 0), BoolType);
  }

  // Use meta-type's instanceof
  const typeType = channelReadRaw(expectedCtx, "shape") as ContextValue | undefined;
  if (typeType) {
    const instanceofMethod = typeMethod(typeType, "instanceof");
    if (instanceofMethod?.kind === ValueKind.PrimitiveFunction) {
      const result = instanceofMethod.fn([expectedCtx as ContextValue, v], undefined as any, undefined as any);
      const rp = dataOf(result);
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

// --- certificate_peek: knowledge observation (C3.3, D36) ---
//
// "Was this value CONSTRUCTED as T?" — reads the refinement-certificate
// chain riding the value's stored type. This is knowledge observation and
// therefore EFFECTFUL (label "observe"): two shape-and-data-equal values
// may answer differently (`certificate_peek(PositiveInt(5), PositiveInt)`
// → true; `certificate_peek(5, PositiveInt)` → false), so a pure function
// consulting it would break congruence — proof_cong applies only to
// knowledge-independent functions (D36/D37). `instanceof` is the pure,
// congruence-safe question ("does the data satisfy T?"); this op answers
// the provenance question and pays for it in the effect calculus.
// The certificate lives on the value's channels — since C4.3c every eager
// impl receives the full value, so nothing special is needed to see it.
// Only refinement layers carry certificates: the walk stops at the first
// non-predicate layer (shape questions belong to instanceof).
const certificate_peek_impl: PrimitiveFnImpl = (args) => {
  if (args.length !== 2) throw new AllegroError(`certificate_peek: need 2 args, got ${args.length}`);
  const v = args[0];
  const t = dataOf(args[1]);
  if (t.kind !== ValueKind.Structure) return withType(makeInt(0), BoolType);
  const stored = getType(v);
  if (!stored) return withType(makeInt(0), BoolType);
  const tName = typeContextName(t as ContextValue);
  let cur: ContextValue | null = stored;
  for (let guard = 0; cur && guard < 64; guard++) {
    if (cur === (t as ContextValue)) return withType(makeInt(1), BoolType);
    if (tName !== null && typeContextName(cur) === tName) return withType(makeInt(1), BoolType);
    if (getPredicate(cur) === undefined) break; // reached the shape — no more certificate layers
    const p = getRefines(cur);
    cur = p !== undefined && dataOf(p).kind === ValueKind.Structure ? (dataOf(p) as ContextValue) : null;
  }
  return withType(makeInt(0), BoolType);
};

// --- type_subtypeof: check if type S is a subtype of type T ---

const type_subtypeof_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  const typeA = evalFn!(args[0], ctx!);
  const typeB = evalFn!(args[1], ctx!);
  if (!isResolved(typeA) || !isResolved(typeB)) {
    return makeExpr(makePrimitive("type_subtypeof", type_subtypeof_impl, true), [typeA, typeB]);
  }

  const ctxA = dataOf(typeA);
  const ctxB = dataOf(typeB);
  if (ctxA.kind !== ValueKind.Structure || ctxB.kind !== ValueKind.Structure) {
    return withType(makeInt(0), BoolType);
  }

  // If typeB uses structural checking (~wrapped or Type-based), use its subtypeof method
  const metaTypeB = channelReadRaw(ctxB, "shape") as ContextValue | undefined;
  if (metaTypeB) {
    const bSubtypeof = typeMethod(metaTypeB, "subtypeof");
    if (bSubtypeof?.kind === ValueKind.PrimitiveFunction) {
      const result = bSubtypeof.fn([ctxA as ContextValue, ctxB as ContextValue], undefined as any, undefined as any);
      const rp = dataOf(result);
      if (rp.kind === ValueKind.Bits && (rp as BitsValue).data !== 0n) {
        return withType(makeInt(1), BoolType);
      }
    }
  }

  // Otherwise use typeA's meta-type subtypeof method
  const metaType = channelReadRaw(ctxA, "shape") as ContextValue | undefined;
  if (metaType) {
    const subtypeofMethod = typeMethod(metaType, "subtypeof");
    if (subtypeofMethod?.kind === ValueKind.PrimitiveFunction) {
      const result = subtypeofMethod.fn([ctxA as ContextValue, ctxB as ContextValue], undefined as any, undefined as any);
      const rp = dataOf(result);
      return withType(makeInt(rp.kind === ValueKind.Bits && (rp as BitsValue).data !== 0n ? 1 : 0), BoolType);
    }
  }

  return withType(makeInt(0), BoolType);
};

// --- type_apply: apply type arguments to a generic type ---

// --- Stage E: type_function — build a concrete FunctionType from a type
//     expression like `(A, B) => C`. Args are the parameter types in source
//     order followed by the return type as the LAST arg. Empty `()` means a
//     zero-param function. Curried `(A) => (B) => C` parses right-recursively
//     so the return type itself is a `type_function` call.

const type_function_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  if (args.length < 1) {
    throw new AllegroError("type_function: expected at least the return type");
  }
  const evalArgs: Value[] = [];
  for (const a of args) {
    const v = evalFn!(a, ctx!);
    if (!isResolved(v)) {
      return makeExpr(makePrimitive("type_function", type_function_impl, true), args);
    }
    evalArgs.push(dataOf(v));
  }
  const returnType = evalArgs[evalArgs.length - 1];
  const paramTypes = evalArgs.slice(0, -1);
  return wrapType(makeFunctionType(paramTypes, returnType));
};

const type_apply_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  const generic = evalFn!(args[0], ctx!);
  if (!isResolved(generic)) {
    return makeExpr(makePrimitive("type_apply", type_apply_impl, true), args);
  }
  const genericCtx = asCtx(dataOf(generic), "type_apply");
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
    typeArgs.push(dataOf(arg));
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
    alternatives.push(dataOf(v));
  }
  return wrapType(makeUnionType(alternatives as ContextValue[]));
};

// --- structural_wrap: ~ operator on types ---

const structural_wrap_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  const v = evalFn!(args[0], ctx!);
  if (!isResolved(v)) {
    return makeExpr(makePrimitive("structural_wrap", structural_wrap_impl, true), [v]);
  }
  const typeCtx = asCtx(dataOf(v), "structural_wrap");
  return wrapType(structuralWrap(typeCtx));
};

// --- type_refine: && operator on types (refinement types) ---

const type_refine_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  const typeVal = evalFn!(args[0], ctx!);
  const predicate = evalFn!(args[1], ctx!);
  if (!isResolved(typeVal) || !isResolved(predicate)) {
    return makeExpr(makePrimitive("type_refine", type_refine_impl, true), [typeVal, predicate]);
  }
  const parentType = asCtx(dataOf(typeVal), "type_refine");
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

// --- Phase C: invariant primitives ---
//
// `assert_invariant(value, predicate)` evaluates the predicate against the
// value. If the value's abstract domain (from Phase B) implies the predicate's
// recognised domain, the runtime call is elided — the invariant is discharged
// at compile time. Otherwise the predicate runs; if it returns false, an
// error value is produced with a counterexample.
//
// `assume_invariant(value, predicate)` claims the predicate holds without
// checking. The predicate's recognised domain (if any) is attached to the
// value so downstream uses inherit the assumption. Use only at trust
// boundaries (external input, FFI, etc.).

const assert_invariant_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  if (args.length !== 2) throw new AllegroError(`assert_invariant: expected 2 args, got ${args.length}`);
  const value = evalFn!(args[0], ctx!);
  const predicate = evalFn!(args[1], ctx!);
  if (!isResolved(value) || !isResolved(predicate)) {
    return makeExpr(makePrimitive("assert_invariant", assert_invariant_impl, true), [value, predicate]);
  }

  // Compile-time discharge: try the value's full predicate SET first
  // (multiple facts may collectively entail the target), falling back to
  // the legacy single-domain check.
  const predDom = domainFromPredicate(predicate);
  const valSet  = _predicatesOf(value);
  if (predDom.kind !== "opaque" && valSet && _entailsPredicate(valSet, predDom)) {
    // Discharged. Attach the proven predicate to the value's set so
    // downstream code inherits the new fact (e.g., `assert x > 0` lets
    // the next `assert x > 0` skip).
    return _withPredicates(value, new _PredicateSet([{ shape: predDom, source: "assert" }]));
  }
  const valDom = _domainOf(value);
  if (predDom.kind !== "opaque" && valDom && _impliesDomain(valDom, predDom)) {
    return _withPredicates(value, new _PredicateSet([{ shape: predDom, source: "assert" }]));
  }

  // Runtime evaluation of the predicate against the value.
  const checkResult = evalFn!(makeExpr(predicate, [value]), ctx!);
  const checkP = dataOf(checkResult);
  if (checkP.kind === ValueKind.Bits && (checkP as BitsValue).data === 0n) {
    // Build a counterexample-style error message.
    let cexDesc = "";
    const primary = dataOf(value);
    if (primary.kind === ValueKind.Bits && (primary as BitsValue).length === 64) {
      const data = (primary as BitsValue).data;
      const signed = data >= 0x8000000000000000n ? data - 0x10000000000000000n : data;
      cexDesc = ` (got ${signed})`;
    }
    let constraintDesc = "";
    if (predDom.kind !== "opaque") {
      const fmt = (d: any): string => {
        if (d.kind === "interval") {
          if (d.lo === d.hi) return `== ${d.lo}`;
          if (d.lo === -Infinity) return `≤ ${d.hi}`;
          if (d.hi === +Infinity) return `≥ ${d.lo}`;
          return `∈ [${d.lo}, ${d.hi}]`;
        }
        if (d.kind === "ne") return `≠ ${d.value}`;
        if (d.kind === "eq") return `== ${d.value}`;
        return "<predicate>";
      };
      constraintDesc = `: expected ${fmt(predDom)}`;
    }
    const msg = `invariant failed${constraintDesc}${cexDesc}`;
    const components = new Map<string, Value>();
    components.set("error", withType(stringToBits(msg), StringType));
    components.set("type", ErrorType);
    return makeMultiValue(makeInt(0), components);
  }
  if (checkP.kind !== ValueKind.Bits) {
    // Predicate unresolved (depends on incomplete bindings) — keep as residual.
    return makeExpr(makePrimitive("assert_invariant", assert_invariant_impl, true), [value, predicate]);
  }
  // Runtime check passed: attach the proven predicate to the value's set
  // so downstream code knows the fact (success branch of the implicit
  // runtime-check "branch").
  if (predDom.kind !== "opaque") {
    return _withPredicates(value, new _PredicateSet([{ shape: predDom, source: "assert" }]));
  }
  return value;
};

/**
 * Phase C Chunk 2: `assert P` as a statement form.
 *
 * Takes the condition expression unevaluated. Two parallel jobs:
 *
 * 1. CHECK — try static discharge from referenced bindings' predicate sets.
 *    If all narrowing predicates derived from P are entailed by the bindings'
 *    existing facts, we know P holds; no runtime call needed. Otherwise
 *    evaluate P; if false, error with counterexample.
 *
 * 2. NARROW — for predicates derived from P, record scope facts (scopeOwnFacts) so
 *    subsequent symbol references in this scope see the narrowed facts. The
 *    mutation is intentional: ctx is shared across statements in a scope, so
 *    later statements pick up the assertion's facts.
 *
 * In branch contexts (where ctx was already child-augmented by eval_if), the
 * mutation is local to the branch — the parent ctx's scopePredicates is a
 * separate Map.
 *
 * Multi-binding / relational predicates (e.g. `a < b`) don't narrow
 * individual bindings under the current recogniser; they fall back to plain
 * runtime check without scope-narrowing. Relational tracking arrives in
 * Phase D.
 */
const assert_stmt_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  if (args.length !== 1) throw new AllegroError(`assert: expected 1 arg, got ${args.length}`);
  const condExpr = args[0];

  // Try static discharge from existing predicate sets.
  const narrowing = _deriveBranchPredicates(condExpr, true, "assert");
  let allEntailed = narrowing.size > 0;
  if (allEntailed) {
    for (const [name, pset] of narrowing) {
      const binding = scopeLookup(ctx!, name);
      if (!binding?.value) { allEntailed = false; break; }
      // For accurate entailment, also fold in any in-scope predicates from
      // the parent (e.g. earlier asserts within this same scope).
      let effectiveSet = _predicatesOf(binding.value);
      {
        // C2.2: chain-merged facts (branch layers + earlier same-scope asserts).
        const scoped = scopeFactsFor(ctx!, name);
        if (scoped) {
          effectiveSet = effectiveSet ? _mergePredicateSets(effectiveSet, scoped) : scoped;
        }
      }
      const target = pset.effectiveDomain();
      if (!target || target.kind === "opaque") { allEntailed = false; break; }
      if (!effectiveSet || !_entailsPredicate(effectiveSet, target)) { allEntailed = false; break; }
    }
  }

  if (!allEntailed) {
    // Runtime check.
    const cond = evalFn!(condExpr, ctx!);
    const condP = dataOf(cond);
    if (condP.kind !== ValueKind.Bits) {
      // Unresolved — keep as residual.
      return makeExpr(makePrimitive("assert_stmt", assert_stmt_impl, true), [cond]);
    }
    if ((condP as BitsValue).data === 0n) {
      // Failed — build a counterexample-style error and HALT. assert is a
      // verification statement, not a value-producing expression; silent
      // failure would defeat the purpose. Mid-program halt is the right
      // default ("build safety in").
      let msg = `assertion failed`;
      if (narrowing.size > 0) {
        const parts: string[] = [];
        for (const [name, pset] of narrowing) {
          const dom = pset.effectiveDomain();
          if (dom && dom.kind !== "opaque") {
            const fmt = (d: any): string => {
              if (d.kind === "interval") {
                if (d.lo === d.hi) return `== ${d.lo}`;
                if (d.lo === -Infinity) return `≤ ${d.hi}`;
                if (d.hi === +Infinity) return `≥ ${d.lo}`;
                return `∈ [${d.lo}, ${d.hi}]`;
              }
              if (d.kind === "ne") return `≠ ${d.value}`;
              if (d.kind === "eq") return `== ${d.value}`;
              return "?";
            };
            // Surface the actual value if available.
            const binding = scopeLookup(ctx!, name);
            let actualDesc = "";
            if (binding?.value) {
              const p = dataOf(binding.value);
              if (p.kind === ValueKind.Bits && (p as BitsValue).length === 64) {
                const data = (p as BitsValue).data;
                const signed = data >= 0x8000000000000000n ? data - 0x10000000000000000n : data;
                actualDesc = ` (got ${name}=${signed})`;
              }
            }
            parts.push(`expected ${name} ${fmt(dom)}${actualDesc}`);
          }
        }
        if (parts.length > 0) msg = `assertion failed: ${parts.join(", ")}`;
      }
      throw new AllegroError(msg);
    }
  }

  // Statically discharged or runtime check passed: narrow scope predicates
  // for the rest of this scope.
  if (narrowing.size > 0) {
    const sp = scopeOwnFacts(ctx!);
    for (const [name, pset] of narrowing) {
      const existing = sp.get(name) as _PredicateSet | undefined;
      sp.set(name, existing ? _mergePredicateSets(existing, pset) : pset);
    }
  }

  return noneSingleton;
};

const assume_invariant_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  if (args.length !== 2) throw new AllegroError(`assume_invariant: expected 2 args, got ${args.length}`);
  const value = evalFn!(args[0], ctx!);
  const predicate = evalFn!(args[1], ctx!);
  if (!isResolved(value) || !isResolved(predicate)) {
    return makeExpr(makePrimitive("assume_invariant", assume_invariant_impl, true), [value, predicate]);
  }
  // Attach the predicate's recognised domain (if any) to the value's
  // predicate set without checking. The set's mergePredicateSets handles
  // intersection naturally — adding a tighter fact to a looser set just
  // means the effective domain narrows.
  const predDom = domainFromPredicate(predicate);
  if (predDom.kind === "opaque") return value;
  return _withPredicates(value, new _PredicateSet([{ shape: predDom, source: "assert" }]));
};

// --- Phase C Chunk 3: requires / ensures contracts ---
//
// Contracts are body-leading clauses on function bodies. The grammar form
// (in `lib/contracts.alg`) lowers to bare-expression markers in the function's
// block_expr; the tree-builder's contract preprocessor (in `tree-builder.ts`)
// rewrites the block to:
//
//   requires checks   (sequenced first, before the body proper)
//   body              (last expression)
//   ensures checks    (wrapped around the result)
//
// `requires P`: caller obligation. Runtime check at function entry. Same
// shape as `assert P`, but tagged "requires" — the introspection summary
// surfaces the contract distinctly. Phase D / sink-based generation will
// move the runtime check to the call site when not statically discharged.
//
// `ensures P`: implementer guarantee. The predicate references `_`, which
// the tree-builder rewrites at parse time into a one-param lambda over `_`.
// `ensures_check(result, lambda)` invokes the lambda with the result; on
// failure it errors; on success it attaches the predicate domain to the
// result's predicate set so callers see the post-condition.

/**
 * Sequence-and-return-last. Lazy primitive — we evaluate each arg explicitly
 * so we can return the last value with its full MultiValue wrapping (type,
 * predicates) intact. The eager primitive path strips MultiValues before
 * calling the impl and then re-wraps via type propagation from the first
 * arg, which would mis-tag the result with the (often noneSingleton) first
 * arg's type. By being lazy we sidestep that path entirely.
 *
 * Side effects (assert recording scope facts, print emitting output)
 * fire left-to-right because we evaluate args sequentially with the same
 * ctx. Used by the block-expression builder to preserve non-last bare
 * expressions, and by the contract preprocessor to splice requires checks
 * ahead of the function body.
 */
const seq_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  if (args.length === 0) return noneSingleton;
  let last: Value = noneSingleton;
  for (const a of args) {
    last = evalFn!(a, ctx!);
  }
  return last;
};

/**
 * `requires P` — caller obligation. Mechanically identical to `assert_stmt`
 * but tags discharged predicates with `source: "requires"` and reports
 * failures as "precondition failed" rather than "assertion failed".
 *
 * Static discharge tries the same predicate-set entailment path as
 * assert_stmt; the difference is purely cosmetic (introspection tagging) and
 * the message wording. When the predicate references only the function's
 * parameters (the common case), the analyzer / safety summary can suggest
 * the equivalent compile-time obligation upstream — that's why we keep the
 * contract source distinct.
 */
const requires_stmt_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  if (args.length !== 1) throw new AllegroError(`requires: expected 1 arg, got ${args.length}`);
  const condExpr = args[0];

  const narrowing = _deriveBranchPredicates(condExpr, true, "requires");
  let allEntailed = narrowing.size > 0;
  if (allEntailed) {
    for (const [name, pset] of narrowing) {
      const binding = scopeLookup(ctx!, name);
      if (!binding?.value) { allEntailed = false; break; }
      let effectiveSet = _predicatesOf(binding.value);
      {
        // C2.2: chain-merged facts (branch layers + earlier same-scope asserts).
        const scoped = scopeFactsFor(ctx!, name);
        if (scoped) {
          effectiveSet = effectiveSet ? _mergePredicateSets(effectiveSet, scoped) : scoped;
        }
      }
      const target = pset.effectiveDomain();
      if (!target || target.kind === "opaque") { allEntailed = false; break; }
      if (!effectiveSet || !_entailsPredicate(effectiveSet, target)) { allEntailed = false; break; }
    }
  }

  if (!allEntailed) {
    const cond = evalFn!(condExpr, ctx!);
    const condP = dataOf(cond);
    if (condP.kind !== ValueKind.Bits) {
      return makeExpr(makePrimitive("requires_stmt", requires_stmt_impl, true), [cond]);
    }
    if ((condP as BitsValue).data === 0n) {
      let msg = `precondition failed`;
      if (narrowing.size > 0) {
        const parts: string[] = [];
        for (const [name, pset] of narrowing) {
          const dom = pset.effectiveDomain();
          if (dom && dom.kind !== "opaque") {
            const fmt = (d: any): string => {
              if (d.kind === "interval") {
                if (d.lo === d.hi) return `== ${d.lo}`;
                if (d.lo === -Infinity) return `≤ ${d.hi}`;
                if (d.hi === +Infinity) return `≥ ${d.lo}`;
                return `∈ [${d.lo}, ${d.hi}]`;
              }
              if (d.kind === "ne") return `≠ ${d.value}`;
              if (d.kind === "eq") return `== ${d.value}`;
              return "?";
            };
            const binding = scopeLookup(ctx!, name);
            let actualDesc = "";
            if (binding?.value) {
              const p = dataOf(binding.value);
              if (p.kind === ValueKind.Bits && (p as BitsValue).length === 64) {
                const data = (p as BitsValue).data;
                const signed = data >= 0x8000000000000000n ? data - 0x10000000000000000n : data;
                actualDesc = ` (got ${name}=${signed})`;
              }
            }
            parts.push(`expected ${name} ${fmt(dom)}${actualDesc}`);
          }
        }
        if (parts.length > 0) msg = `precondition failed: ${parts.join(", ")}`;
      }
      throw new AllegroError(msg);
    }
  }

  if (narrowing.size > 0) {
    const sp = scopeOwnFacts(ctx!);
    for (const [name, pset] of narrowing) {
      // Re-tag with "requires" source — deriveBranchPredicates already used
      // "requires" as the source argument, but ensure consistency.
      const tagged = new _PredicateSet(pset.preds.map(p => ({ ...p, source: "requires" as const })));
      const existing = sp.get(name) as _PredicateSet | undefined;
      sp.set(name, existing ? _mergePredicateSets(existing, tagged) : tagged);
    }
  }

  return noneSingleton;
};

/**
 * `ensures P` marker. Lowered from the `ensures` stmt_form. The tree-builder's
 * contract preprocessor recognises this primitive call by name, extracts the
 * predicate AST, builds a one-param lambda over `_`, and rewrites the block
 * so the predicate fires against the function's result via `ensures_check`.
 *
 * If this primitive is ever evaluated at runtime (e.g., used outside a
 * function-body block where the preprocessor doesn't reach), it's a no-op
 * — the user just doesn't get the post-condition enforcement. We don't
 * error: declarative contracts shouldn't break code that uses them in
 * unexpected positions.
 */
const ensures_decl_impl: PrimitiveFnImpl = (_args, _ctx, _evalFn) => {
  return noneSingleton;
};

/**
 * `ensures_check(result, lambda)` — the runtime check. The tree-builder's
 * contract preprocessor inserts these around the result expression of any
 * function body that has `ensures` clauses.
 *
 * Static discharge: if the result already carries a predicate set that
 * entails the post-condition's domain (e.g., the function body is itself
 * a refined-type construction), no runtime call is needed. Otherwise the
 * lambda runs against the result; on failure we throw an AllegroError
 * (postcondition failed); on success we attach the predicate domain to
 * the result's set with `source: "ensures"` so the caller sees the fact.
 */
const ensures_check_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  if (args.length !== 2) throw new AllegroError(`ensures_check: expected 2 args, got ${args.length}`);
  const result = evalFn!(args[0], ctx!);
  // Forward TailCalls (tail-position calls inside the function body). The
  // ensures lambda's check runs at the eventual base-case value through
  // the same wrapper, so soundness is preserved.
  if (_isTailCall(result)) return result as any;
  const lambda = evalFn!(args[1], ctx!);
  if (!isResolved(result) || !isResolved(lambda)) {
    return makeExpr(makePrimitive("ensures_check", ensures_check_impl, true), [result, lambda]);
  }

  // Try static discharge from the result's predicate set.
  const predDom = domainFromPredicate(lambda);
  const valSet  = _predicatesOf(result);
  if (predDom.kind !== "opaque" && valSet && _entailsPredicate(valSet, predDom)) {
    return _withPredicates(result, new _PredicateSet([{ shape: predDom, source: "ensures" }]));
  }

  // Runtime check.
  const checkResult = evalFn!(makeExpr(lambda, [result]), ctx!);
  const checkP = dataOf(checkResult);
  if (checkP.kind === ValueKind.Bits && (checkP as BitsValue).data === 0n) {
    let cexDesc = "";
    const primary = dataOf(result);
    if (primary.kind === ValueKind.Bits && (primary as BitsValue).length === 64) {
      const data = (primary as BitsValue).data;
      const signed = data >= 0x8000000000000000n ? data - 0x10000000000000000n : data;
      cexDesc = ` (got ${signed})`;
    }
    let constraintDesc = "";
    if (predDom.kind !== "opaque") {
      const fmt = (d: any): string => {
        if (d.kind === "interval") {
          if (d.lo === d.hi) return `== ${d.lo}`;
          if (d.lo === -Infinity) return `≤ ${d.hi}`;
          if (d.hi === +Infinity) return `≥ ${d.lo}`;
          return `∈ [${d.lo}, ${d.hi}]`;
        }
        if (d.kind === "ne") return `≠ ${d.value}`;
        if (d.kind === "eq") return `== ${d.value}`;
        return "<predicate>";
      };
      constraintDesc = `: expected ${fmt(predDom)}`;
    }
    throw new AllegroError(`postcondition failed${constraintDesc}${cexDesc}`);
  }
  if (checkP.kind !== ValueKind.Bits) {
    return makeExpr(makePrimitive("ensures_check", ensures_check_impl, true), [result, lambda]);
  }
  // Passed; attach predicate so callers see the post-condition fact.
  if (predDom.kind !== "opaque") {
    return _withPredicates(result, new _PredicateSet([{ shape: predDom, source: "ensures" }]));
  }
  return result;
};

// --- Phase D1: effect-declaration markers ---
//
// `effects E1, E2` body-form clauses lower to `effects_decl_marker(labels)`
// at parse time. The block-expression preprocessor recognises these markers,
// extracts the label list, and wraps the function body's result expression
// with `effects_attach(body, labels)`. At runtime `effects_attach` is a
// transparent passthrough; the wrapper is metadata for the analyzer and
// the introspection summary.
//
// See `src/effects.ts` for the inference walker and declaration check.

const effects_decl_marker_impl: PrimitiveFnImpl = (_args, _ctx, _evalFn) => {
  // Marker. The block preprocessor extracts and consumes these at parse
  // time; if one survives to runtime (e.g. used outside a function body
  // block), it's a no-op. Mirrors `ensures_decl` for the same reason.
  return noneSingleton;
};

const effects_attach_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  if (args.length !== 2) {
    throw new AllegroError(`effects_attach: expected 2 args, got ${args.length}`);
  }
  // Transparent passthrough: evaluate the wrapped body and return its
  // value. The second arg (declared-labels metadata) is recovered at
  // compile time by the inference walker via `unwrapEffectsAttach` —
  // never evaluated here. TailCalls (from tail-position recursive calls
  // inside the body) propagate unchanged so applyComposed's tco_loop
  // catches them.
  return evalFn!(args[0], ctx!);
};

// Stage D — param_effects body-form (Surface C).
//
// `param_effects f: pure` lowers to `param_effects_decl_marker(Param(f), pure)`
// at parse time. The block preprocessor collects these markers and wraps the
// body's result with `param_effects_attach(body, paramRef1, effSym1, …)` —
// the metadata is recovered by `typed_function_impl` to stamp each named
// param's `predicates` with an effect bound, identical shape to Surface A's
// `f: pure` param-type-slot stamping.

const param_effects_decl_marker_impl: PrimitiveFnImpl = (_args, _ctx, _evalFn) => {
  // Marker. The block preprocessor extracts and consumes these at parse time;
  // a stray marker at runtime is a no-op. Mirrors `effects_decl_marker`.
  return noneSingleton;
};

const param_effects_attach_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  // Transparent passthrough at runtime: evaluate args[0] (the body) and
  // return. The remaining args are metadata for `typed_function_impl`'s
  // peel-and-stamp pass.
  return evalFn!(args[0], ctx!);
};

// Phase E Stage 0 — totality opt-out (`partial` body-form).
//
// `partial` body-form clauses lower to `partial_decl_marker()` at parse time
// (zero-arg marker). The block-expression preprocessor recognises these
// markers and wraps the function body's result expression with
// `partial_attach(body)`. At runtime `partial_attach` is a transparent
// passthrough; the wrapper is metadata for the totality analyzer (Stage 1+)
// which peels it to skip exhaustiveness / termination checks for the
// annotated function.

const partial_decl_marker_impl: PrimitiveFnImpl = (_args, _ctx, _evalFn) => {
  // Marker. The block preprocessor extracts and consumes these at parse
  // time; if one survives to runtime, it's a no-op.
  return noneSingleton;
};

const partial_attach_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  if (args.length !== 1) {
    throw new AllegroError(`partial_attach: expected 1 arg, got ${args.length}`);
  }
  // Transparent passthrough at runtime; analyzer recovers the partial
  // annotation at compile time via `unwrapPartialAttach`.
  return evalFn!(args[0], ctx!);
};

// Phase E Stage 3 — `decreases <metric>` body-form for hand-rolled
// termination metrics. The body preprocessor extracts the marker and wraps
// the function body with `decreases_attach(body, metric)`. The runtime
// behaviour is a passthrough; the analyzer recovers the metric expression
// at compile time via `unwrapDecreasesAttach` to verify (or trust) the
// decrease across recursive calls.

const decreases_decl_marker_impl: PrimitiveFnImpl = (_args, _ctx, _evalFn) => {
  // Marker. Extracted by the block preprocessor at parse time; surviving
  // markers at runtime are no-ops (mirrors `effects_decl_marker`).
  return noneSingleton;
};

const decreases_attach_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  if (args.length !== 2) {
    throw new AllegroError(`decreases_attach: expected 2 args, got ${args.length}`);
  }
  // Transparent passthrough at runtime; the metric (args[1]) is metadata
  // for the totality analyzer and is never evaluated here.
  return evalFn!(args[0], ctx!);
};

// Phase F7 — `proven <prop>` body-form clauses lower to
// `proven_decl_marker(predicate)` at parse time. The block preprocessor
// extracts these markers and wraps the function body with
// `proven_attach(body, pred1, pred2, ...)` (variadic — multiple proven
// clauses compose). At runtime `proven_attach` is a transparent
// passthrough; `checkProvenClauses` (src/proven.ts) peels it at compile
// time, samples the function with K=4 inputs, and verifies each predicate.

const proven_decl_marker_impl: PrimitiveFnImpl = (_args, _ctx, _evalFn) => {
  // Marker. The block preprocessor extracts it; if one survives to
  // runtime, it's a no-op (mirrors the other body-form markers).
  return noneSingleton;
};

const proven_attach_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  if (args.length < 1) {
    throw new AllegroError(`proven_attach: expected at least 1 arg (body), got ${args.length}`);
  }
  // Transparent passthrough at runtime; the predicates (args[1..]) are
  // metadata for `checkProvenClauses` and are never evaluated here.
  return evalFn!(args[0], ctx!);
};

// --- Phase F1: proof terms ---
//
// `proof_by_eval(propSrc, propExpr)` — the F1 proof constructor. Lazy on
// the proposition (arg 1, unevaluated). Discharge-by-partial-evaluation:
// evaluate the proposition; if it folds to `true` (Bits 1) the proof is
// established and we return a discharged `Proof` value. If it folds to
// `false` or stays unresolved, we return a *failed* Proof — a Proof-typed
// Context with `__discharged = 0` carrying the reason + counterexample.
// `checkProofs` (src/proofs.ts) scans bindings for failed proofs and
// surfaces them as error-severity notifications that halt compilation
// (a failed proof is unsound by construction — "build safety in").
//
// `propSrc` is the source-rendered text of the proposition (captured by
// the tree-builder via `textOf`), used for display / counterexamples /
// future Lean export. It is NOT re-parsed — purely a label.

function makeFailedProof(prop: string, reason: string, counterexample?: string): Value {
  const p = makeContext();
  stampProposition(p, withType(stringToBits(prop), StringType));
  dischargedWriter.write(p, makeInt(0));
  stampProofReason(p, withType(stringToBits(reason), StringType));
  if (counterexample !== undefined) {
    stampProofCounterexample(p, withType(stringToBits(counterexample), StringType));
  }
  return withType(p, _Proof);
}

// --- Phase F3: equality-structured proofs + combinators ---
//
// F1/F2 proofs carry only a `__proposition` string. The combinators
// (refl/sym/trans/cong) operate on EQUALITY proofs, which additionally
// carry the two sides as evaluated Values (`__eq_lhs` / `__eq_rhs`) so a
// proof can be mechanically composed with another. `proof_by_eval` is
// extended to stash these when the proposition is structurally `L == R`.

function _valDesc(v: Value): string {
  const p = dataOf(v);
  if (p.kind === ValueKind.Bits && (p as BitsValue).length === 64) {
    const d = (p as BitsValue).data;
    return String(d >= 0x8000000000000000n ? d - 0x10000000000000000n : d);
  }
  if (p.kind === ValueKind.Bits) {
    try { return `"${bitsToString(p as BitsValue)}"`; } catch { return "value"; }
  }
  return "value";
}

/** Attach equality operands to a discharged proof (mutates its primary
 *  Context — the proof is freshly built by its constructor). */
function attachEqOperands(proof: Value, lhs: Value, rhs: Value): Value {
  const ctx = dataOf(proof) as ContextValue;
  stampEqOperands(ctx, lhs, rhs);
  return proof;
}

/** Read the equality operands off a proof, or null if it isn't an
 *  equality proof. */
function eqOperandsOf(v: Value): { lhs: Value; rhs: Value } | null {
  const ctx = proofCtx(v);
  if (!ctx) return null;
  const l = getEqLhs(ctx);
  const r = getEqRhs(ctx);
  if (!l || !r) return null;
  return { lhs: l, rhs: r };
}

/** Recognise a proof Context structurally — a Context carrying the proof
 *  marker bindings. Structural (not type-component-based) so it works on
 *  any residual-stripped view of a proof as well as the full value. */
function proofCtx(v: Value): ContextValue | null {
  const p = dataOf(v);
  if (p.kind !== ValueKind.Structure) return null;
  const c = p as ContextValue;
  return hasDischarged(c) ? c : null;
}

/** Is `v` a discharged Proof? */
function isDischargedProofVal(v: Value): boolean {
  const c = proofCtx(v);
  if (!c) return false;
  const d = channelReadRaw(c, "discharged");
  return !!d && dataOf(d).kind === ValueKind.Bits
    && (dataOf(d) as BitsValue).data === 1n;
}

/** Value-level equality for proof operands (concrete Bits, else identity). */
function proofValEqual(a: Value, b: Value): boolean {
  const pa = dataOf(a), pb = dataOf(b);
  if (pa.kind === ValueKind.Bits && pb.kind === ValueKind.Bits) {
    return (pa as BitsValue).data === (pb as BitsValue).data
      && (pa as BitsValue).length === (pb as BitsValue).length;
  }
  return pa === pb;
}

/** Recognise `Expression(bits_eq | typed_eq, [L, R])` and return the two
 *  side ASTs (unevaluated). */
function eqExprSides(propExpr: Value): { l: Value; r: Value } | null {
  if (!propExpr || propExpr.kind !== ValueKind.Expression) return null;
  const fn = dataOf((propExpr as ExpressionValue).fn);
  if (fn.kind !== ValueKind.PrimitiveFunction) return null;
  const n = (fn as any).name as string;
  if (n !== "bits_eq" && n !== "typed_eq") return null;
  const a = (propExpr as ExpressionValue).args;
  if (a.length !== 2) return null;
  return { l: a[0], r: a[1] };
}

/** Build a discharged equality proof for `lhs == rhs`. */
function makeEqProof(lhs: Value, rhs: Value, propSrc?: string): Value {
  const src = propSrc ?? `${_valDesc(lhs)} == ${_valDesc(rhs)}`;
  return attachEqOperands(_makeProof(src), lhs, rhs);
}

const proof_by_eval_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  if (args.length !== 2) {
    throw new AllegroError(`proof_by_eval: expected 2 args (propSrc, prop), got ${args.length}`);
  }
  const srcP = dataOf(args[0]);
  const propSrc = srcP.kind === ValueKind.Bits ? bitsToString(srcP as BitsValue) : "<proposition>";

  const result = evalFn!(args[1], ctx!);
  const rp = dataOf(result);

  // Composition (F2+): the proposition may itself evaluate to a Proof —
  // e.g. `theorem t: proof_refines(5, PositiveInt)` or any future proof
  // combinator. A discharged Proof passes straight through (re-labelled
  // with the theorem's source); a failed one propagates its reason.
  if (_isProof(result)) {
    return result;
  }

  if (rp.kind === ValueKind.Bits) {
    const data = (rp as BitsValue).data;
    if (data === 1n) {
      // Discharged by evaluation. If the proposition is structurally an
      // equality, stash the two sides so combinators (F3) can compose it.
      const sides = eqExprSides(args[1]);
      if (sides) {
        const lv = evalFn!(sides.l, ctx!);
        const rv = evalFn!(sides.r, ctx!);
        if (isResolved(lv) && isResolved(rv)) {
          return makeEqProof(lv, rv, propSrc);
        }
      }
      return _makeProof(propSrc);
    }
    if (data === 0n) {
      // Definitively false — a disproof. Render the counterexample.
      return makeFailedProof(
        propSrc,
        `proposition is false`,
        `\`${propSrc}\` evaluates to false`,
      );
    }
  }
  // Unresolved (or non-Bool primary) — PE could not discharge it. F1's
  // contract is "provable BY EVALUATION"; anything that doesn't fold is a
  // failure of this specific proof strategy (F2/F3 add other strategies).
  return makeFailedProof(
    propSrc,
    `could not be discharged by evaluation`,
    `\`${propSrc}\` did not reduce to a constant Bool (PE left a residual)`,
  );
};

// --- Phase F2: proof by refinement-domain entailment ---
//
// `proof_refines(value, refinedType)` — witnesses that `value` provably
// inhabits `refinedType`, discharged through the SAME abstract-domain
// lattice used by Phase B/C refinement checks (`impliesDomain`). This is
// the second proof strategy (F1 = proof_by_eval); both produce the same
// Proof / failed-Proof shape so `checkProofs` stays the single surfacing
// point and composition under `theorem` / `verify` is automatic.
//
// The discharge: read `value`'s effective abstract domain (predicate set,
// propagated domain, or — for a bare literal — `eq(k)`), read the refined
// type's `__abstractDomain`, and check entailment. On failure, reuse the
// Phase B counterexample generator to produce a concrete breaking value.

function fmtDomain(d: any): string {
  if (!d) return "?";
  if (d.kind === "interval") {
    if (d.lo === d.hi) return `== ${d.lo}`;
    if (d.lo === -Infinity) return `≤ ${d.hi}`;
    if (d.hi === Infinity)  return `≥ ${d.lo}`;
    return `∈ [${d.lo}, ${d.hi}]`;
  }
  if (d.kind === "eq") return `== ${d.value}`;
  if (d.kind === "ne") return `≠ ${d.value}`;
  if (d.kind === "effects") return `effects {${[...d.labels].join(", ")}}`;
  return "opaque";
}

const proof_refines_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  if (args.length !== 2) {
    throw new AllegroError(`proof_refines: expected 2 args (value, refinedType), got ${args.length}`);
  }
  const value = evalFn!(args[0], ctx!);
  const refined = evalFn!(args[1], ctx!);

  // The refined type's OWN name (its `__name` binding), not its meta-type.
  const rtCtx = dataOf(refined) as any;
  const nameBinding = rtCtx?.kind === ValueKind.Structure ? getName(rtCtx) : undefined;
  const typeName = (nameBinding && dataOf(nameBinding).kind === ValueKind.Bits)
    ? bitsToString(dataOf(nameBinding) as BitsValue)
    : (getTypeName(refined) ?? "<type>");
  // Render the value: a 64-bit Int as its signed integer, else "value".
  const litP = dataOf(value);
  let valDesc = "value";
  if (litP.kind === ValueKind.Bits && (litP as BitsValue).length === 64) {
    const d = (litP as BitsValue).data;
    const signed = d >= 0x8000000000000000n ? d - 0x10000000000000000n : d;
    valDesc = String(signed);
  }
  const propSrc = `${valDesc} refines ${typeName}`;

  if (!isResolved(value) || !isResolved(refined)) {
    return makeFailedProof(propSrc, `operands did not resolve`,
      `\`proof_refines\` needs both the value and the refined type resolved`);
  }

  // Expected: the refined type's abstract domain (set by buildRefinedType /
  // Type.invariant via domainFromPredicate).
  const rt = dataOf(refined) as any;
  const rtPredicate = rt?.kind === ValueKind.Structure ? getPredicate(rt) : undefined;
  const expected = (rt && getAbstractDomain(rt))
    ? getAbstractDomain(rt)
    : (rtPredicate ? domainFromPredicate(rtPredicate) : null);
  if (!expected || expected.kind === "opaque") {
    return makeFailedProof(propSrc,
      `\`${typeName}\` is not a refinement type with a recognised domain`,
      `proof_refines discharges refinement membership (interval / eq / ne shapes); for base-type facts use proof_by_eval`);
  }

  // Actual: the value's effective domain — predicate set, propagated
  // domain, or a bare literal lifted to `eq(k)`.
  const actual = _domainOrFromValue(value);
  if (!actual) {
    return makeFailedProof(propSrc,
      `value has no recognised abstract domain`,
      `\`${valDesc}\` carries neither a refinement predicate nor a concrete literal the lattice can reason about`);
  }

  if (_impliesDomain(actual, expected)) {
    return _makeProof(propSrc);
  }

  // Not entailed — produce a concrete counterexample where possible.
  const cex = _counterexampleFor(actual, expected);
  const cexStr = cex !== null
    ? `${cex} satisfies the value's domain (${fmtDomain(actual)}) but violates \`${typeName}\` (${fmtDomain(expected)})`
    : `value's domain ${fmtDomain(actual)} does not entail \`${typeName}\`'s ${fmtDomain(expected)}`;
  return makeFailedProof(propSrc,
    `domain does not entail \`${typeName}\``, cexStr);
};

// --- Phase F3: proof combinators ---
//
// refl / sym / trans / cong build equality proofs from equality proofs.
// Each is sound by construction: the resulting `__eq_lhs` / `__eq_rhs`
// follow from the equational rule, and the inputs are required to be
// discharged equality proofs (else a failed Proof propagates, surfaced
// by `checkProofs` like any other proof failure).

/** `proof_refl(x)` — reflexivity: `x == x`, always discharged. */
const proof_refl_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  if (args.length !== 1) throw new AllegroError(`proof_refl: expected 1 arg, got ${args.length}`);
  const x = args[0];
  if (!isResolved(x)) {
    return makeFailedProof(`refl`, `operand did not resolve`,
      `proof_refl needs its operand resolved`);
  }
  return makeEqProof(x, x);
};

/** `proof_sym(p)` — symmetry: from `a == b`, derive `b == a`. */
const proof_sym_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  if (args.length !== 1) throw new AllegroError(`proof_sym: expected 1 arg, got ${args.length}`);
  const p = args[0];
  if (!isDischargedProofVal(p)) {
    return makeFailedProof(`sym`, `argument is not a discharged proof`,
      `proof_sym(p) requires p to be a discharged equality proof`);
  }
  const ops = eqOperandsOf(p);
  if (!ops) {
    return makeFailedProof(`sym`, `argument is not an equality proof`,
      `proof_sym only applies to proofs of \`a == b\``);
  }
  return makeEqProof(ops.rhs, ops.lhs);
};

/** `proof_trans(p1, p2)` — transitivity: from `a == b` and `b == c`,
 *  derive `a == c`. Requires p1's RHS to value-match p2's LHS. */
const proof_trans_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  if (args.length !== 2) throw new AllegroError(`proof_trans: expected 2 args, got ${args.length}`);
  const p1 = args[0];
  const p2 = args[1];
  if (!isDischargedProofVal(p1) || !isDischargedProofVal(p2)) {
    return makeFailedProof(`trans`, `arguments must be discharged proofs`,
      `proof_trans(p1, p2) requires both to be discharged equality proofs`);
  }
  const a = eqOperandsOf(p1);
  const b = eqOperandsOf(p2);
  if (!a || !b) {
    return makeFailedProof(`trans`, `arguments must be equality proofs`,
      `proof_trans only chains proofs of \`a == b\``);
  }
  if (!proofValEqual(a.rhs, b.lhs)) {
    return makeFailedProof(
      `${_valDesc(a.lhs)} == ${_valDesc(b.rhs)}`,
      `transitivity middle terms differ`,
      `p1 proves \`… == ${_valDesc(a.rhs)}\` but p2 proves \`${_valDesc(b.lhs)} == …\` — the shared term must match`,
    );
  }
  return makeEqProof(a.lhs, b.rhs);
};

/** `proof_cong(f, p)` — congruence: from `a == b`, derive `f(a) == f(b)`
 *  for any function `f` (sound for pure f; the new equality is recorded
 *  from the actual applications). */
const proof_cong_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  if (args.length !== 2) throw new AllegroError(`proof_cong: expected 2 args (f, p), got ${args.length}`);
  const f = args[0];
  const p = args[1];
  if (!isDischargedProofVal(p)) {
    return makeFailedProof(`cong`, `second argument is not a discharged proof`,
      `proof_cong(f, p) requires p to be a discharged equality proof`);
  }
  const ops = eqOperandsOf(p);
  if (!ops) {
    return makeFailedProof(`cong`, `second argument is not an equality proof`,
      `proof_cong only applies to proofs of \`a == b\``);
  }
  const fa = evalFn!(makeExpr(f, [ops.lhs]), ctx!);
  const fb = evalFn!(makeExpr(f, [ops.rhs]), ctx!);
  if (!isResolved(fa) || !isResolved(fb)) {
    return makeFailedProof(`cong`, `f(a) / f(b) did not resolve`,
      `proof_cong needs f applied to both sides to reduce`);
  }
  return makeEqProof(fa, fb);
};

// --- Phase F3: `theorem NAME: P by <proofterm>` checker ---
//
// `proof_check(propSrc, propExpr, proofExpr)` — lazy on propExpr (needs
// the AST to detect the equality shape) and on proofExpr (evaluated here).
// Soundness: the proof term must actually establish the stated
// proposition, not merely be *some* discharged proof — otherwise
// `theorem bad: 1 == 2 by proof_refl(5)` would pass.
const proof_check_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  if (args.length !== 3) {
    throw new AllegroError(`proof_check: expected 3 args (propSrc, prop, proof), got ${args.length}`);
  }
  const srcP = dataOf(args[0]);
  const propSrc = srcP.kind === ValueKind.Bits ? bitsToString(srcP as BitsValue) : "<proposition>";

  const proof = evalFn!(args[2], ctx!);
  if (!isDischargedProofVal(proof)) {
    // If the proof term is itself a *failed* proof (e.g. a combinator
    // rejected its inputs), propagate that specific reason rather than the
    // generic message — the user wants to know WHY the term didn't hold.
    const fctx = proofCtx(proof);
    if (fctx) {
      const rv = getProofReason(fctx);
      const cv = getProofCounterexample(fctx);
      const reason = rv && dataOf(rv).kind === ValueKind.Bits
        ? bitsToString(dataOf(rv) as BitsValue) : "proof term did not discharge";
      const cex = cv && dataOf(cv).kind === ValueKind.Bits
        ? bitsToString(dataOf(cv) as BitsValue) : undefined;
      return makeFailedProof(propSrc, `\`by\` proof failed: ${reason}`, cex);
    }
    return makeFailedProof(propSrc, `proof term is not a Proof`,
      `\`theorem … by <term>\` requires <term> to evaluate to a discharged Proof`);
  }

  // Equality proposition: the proof must establish exactly L == R (value-
  // level), not some unrelated equality.
  const sides = eqExprSides(args[1]);
  if (sides) {
    const L = evalFn!(sides.l, ctx!);
    const R = evalFn!(sides.r, ctx!);
    const ops = eqOperandsOf(proof);
    if (!ops) {
      return makeFailedProof(propSrc, `proof term is not an equality proof`,
        `the proposition is an equality but the supplied proof doesn't carry equality operands`);
    }
    if (isResolved(L) && isResolved(R)
        && proofValEqual(ops.lhs, L) && proofValEqual(ops.rhs, R)) {
      // Relabel with the theorem's source and return the (already
      // discharged, eq-structured) proof.
      const relabeled = makeEqProof(ops.lhs, ops.rhs, propSrc);
      return relabeled;
    }
    return makeFailedProof(propSrc,
      `proof term establishes a different equality`,
      `theorem claims \`${propSrc}\` but the proof proves \`${_valDesc(ops.lhs)} == ${_valDesc(ops.rhs)}\``);
  }

  // Non-equality proposition: fall back to eval-consistency. The proof
  // term is already known discharged (checked above); accept when the
  // proposition itself folds true, OR is itself a discharged Proof
  // (composition — e.g. `theorem p: proof_refines(5, T) by proof_refines(5, T)`).
  const propVal = evalFn!(args[1], ctx!);
  const pv = dataOf(propVal);
  if (pv.kind === ValueKind.Bits && (pv as BitsValue).data === 1n) {
    return _makeProof(propSrc);
  }
  if (isDischargedProofVal(propVal)) {
    return _makeProof(propSrc);
  }
  return makeFailedProof(propSrc,
    `proposition not established`,
    `the \`by\` proof term is discharged but the proposition \`${propSrc}\` did not reduce to true`);
};

// --- Phase F5: universal quantification + induction ---
//
// Two new proof constructors, both returning a discharged Proof when the
// universal claim holds and a failed Proof otherwise. Both compose with
// `theorem` / `verify` via the F2 passthrough (`proof_by_eval` accepts a
// proposition that already evaluates to a Proof).
//
// `prove_for_all_bool(predicate)` — proves `∀b: Bool, predicate(b)` by
// evaluating predicate(true) and predicate(false). Bool is the canonical
// finite-domain quantification.
//
// `prove_induction(predicate, base_proof, step_fn)` — proves
// `∀n: NonNeg, predicate(n)`. Stage-5 minimum uses BOUNDED SAMPLE
// VERIFICATION: verify base, then invoke `step_fn(n, ih)` for n = 0..K-1
// (K=4), threading the previous step's proof as the induction hypothesis.
// Each step must return a discharged Proof AND `predicate(n+1)` must fold
// to true. Full symbolic induction (reasoning over an unbounded n) is F5+.
//
// The induction-step contract: `step_fn(n, ih_proof) => proof_of_P(n+1)`.
// The user is responsible for the step's correctness over all n; the
// sample verification catches obvious bugs but isn't a soundness proof.
// Documented as such in the rendered counterexamples on failure.

const _INDUCTION_SAMPLE_K = 4;

const prove_for_all_bool_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  if (args.length !== 1) {
    throw new AllegroError(`prove_for_all_bool: expected 1 arg (predicate), got ${args.length}`);
  }
  const pred = args[0];
  if (!isResolved(pred)) {
    return makeFailedProof(`forall b: Bool, p(b)`, `predicate did not resolve`,
      `prove_for_all_bool needs the predicate function resolved`);
  }
  // Allegro Bool values are typed `MultiValue(Bits(0|1), {type: Bool})`.
  // Bare Bits work too — the predicate's type check will wrap as needed.
  const trueRes  = evalFn!(makeExpr(pred, [fromBool(true)]),  ctx!);
  const falseRes = evalFn!(makeExpr(pred, [fromBool(false)]), ctx!);
  const tp = dataOf(trueRes), fp = dataOf(falseRes);
  const tOk = tp.kind === ValueKind.Bits && (tp as BitsValue).data === 1n;
  const fOk = fp.kind === ValueKind.Bits && (fp as BitsValue).data === 1n;
  if (tOk && fOk) {
    return _makeProof(`forall b: Bool, p(b)`);
  }
  const missing = !tOk && !fOk ? "both `true` and `false`"
    : !tOk ? "`true`" : "`false`";
  return makeFailedProof(`forall b: Bool, p(b)`,
    `predicate fails for ${missing}`,
    `the universal claim breaks on the case(s) ${missing} — predicate must reduce to true for every value of the quantified domain`);
};

const prove_induction_impl: PrimitiveFnImpl = (args, ctx, evalFn) => {
  if (args.length !== 3) {
    throw new AllegroError(`prove_induction: expected 3 args (predicate, base_proof, step_fn), got ${args.length}`);
  }
  const pred      = args[0];
  const baseProof = args[1];
  const stepFn    = args[2];

  if (!isResolved(pred) || !isResolved(stepFn)) {
    return makeFailedProof(`forall n: NonNeg, p(n)`,
      `predicate or step function did not resolve`,
      `prove_induction needs both the predicate and step function resolved at call time`);
  }
  if (!isDischargedProofVal(baseProof)) {
    return makeFailedProof(`forall n: NonNeg, p(n)`,
      `base case is not a discharged proof`,
      `the first argument must be a discharged Proof of \`predicate(0)\``);
  }
  // Sanity-check the base case: predicate(0) must fold to true.
  const p0 = evalFn!(makeExpr(pred, [makeInt(0)]), ctx!);
  const p0p = dataOf(p0);
  if (p0p.kind !== ValueKind.Bits || (p0p as BitsValue).data !== 1n) {
    return makeFailedProof(`forall n: NonNeg, p(n)`,
      `predicate(0) does not hold`,
      `the base case proof claims P(0) but PE of \`predicate(0)\` did not reduce to true`);
  }

  // Bounded sample verification. For n = 0..K-1, invoke step_fn(n, ih)
  // and require: result is a discharged Proof; predicate(n+1) folds true.
  // Thread the step's output as the next ih.
  let ih = baseProof;
  for (let n = 0; n < _INDUCTION_SAMPLE_K; n++) {
    const stepResult = evalFn!(makeExpr(stepFn, [makeInt(n), ih]), ctx!);
    if (!isDischargedProofVal(stepResult)) {
      return makeFailedProof(`forall n: NonNeg, p(n)`,
        `step proof failed at n=${n}`,
        `step(${n}, ih) did not produce a discharged proof — the inductive step doesn't construct a witness at this sample`);
    }
    const pn1 = evalFn!(makeExpr(pred, [makeInt(n + 1)]), ctx!);
    const pn1p = dataOf(pn1);
    if (pn1p.kind !== ValueKind.Bits || (pn1p as BitsValue).data !== 1n) {
      return makeFailedProof(`forall n: NonNeg, p(n)`,
        `predicate(${n + 1}) does not hold`,
        `the step at n=${n} claims P(${n + 1}) but PE of \`predicate(${n + 1})\` did not reduce to true`);
    }
    ih = stepResult;
  }
  return _makeProof(`forall n: NonNeg, p(n) [verified base + ${_INDUCTION_SAMPLE_K} inductive steps]`);
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
    // C5.2a pre-fix: dispatch reads the SHAPE, matching the evaluator's
    // PRIM_TO_METHOD path — the two agreed before only because refinement
    // layers share the member-set object (C3.1).
    const method = typeMethod(typeShape(leftType), opName);
    if (!method) {
      const typeName = getTypeName(left) ?? "unknown";
      throw new AllegroError(`typed_${opName}: type ${typeName} has no '${opName}' method`);
    }
    if (method.kind !== ValueKind.PrimitiveFunction) {
      throw new AllegroError(`typed_${opName}: method is not a primitive function`);
    }
    // Call method with primaries (methods operate on raw values)
    const result = method.fn([dataOf(left), dataOf(right)], ctx, evalFn);
    // Type methods already return properly typed values (e.g., comparisons return Bool,
    // arithmetic returns the operand type). C4.3b: a typed result may be an
    // MV (scalar) or a flattened Context (record/array) — check the channel,
    // not the kind, so an already-typed result is never re-stamped.
    if (getType(result) !== null) return result;
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
  mv_new: makePrimitive("mv_new", mv_new),
  mv_primary: makePrimitive("mv_primary", mv_primary),
  mv_get: makePrimitive("mv_get", mv_get),
  mv_set: makePrimitive("mv_set", mv_set),
  channel_register: makePrimitive("channel_register", channel_register_impl),
  channel_read: makePrimitive("channel_read", channel_read_impl, true),
  channel_list: makePrimitive("channel_list", channel_list_impl, true),
  channel_attenuate: makePrimitive("channel_attenuate", channel_attenuate_impl),
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
  // Phase D1: `print` produces an `io` effect; `fetch` produces `net`;
  // `delay` produces `time`. Effect labels surface in function-effect
  // inference via the `effects` field on the primitive value.
  print: makePrimitive("print", print_impl, true, ["io"]),
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
  grammar_rule_replace_alt:  makePrimitive("grammar_rule_replace_alt",  grammar_rule_replace_alt_impl),
  grammar_rule_remove:       makePrimitive("grammar_rule_remove",       grammar_rule_remove_impl),
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
  typed_amp: makePrimitive("typed_amp", typed_amp_impl, true),
  typed_or: makePrimitive("typed_or", typed_or_impl, true),
  typed_not: makePrimitive("typed_not", typed_not_impl, true),
  export: makePrimitive("export", export_impl, true),
  type_dispatch: makePrimitive("type_dispatch", type_dispatch_impl, true),
  type_of: makePrimitive("type_of", type_of_impl, true),
  type_check: makePrimitive("type_check", type_check_impl, true),
  type_instanceof: makePrimitive("type_instanceof", type_instanceof_impl, true),
  type_subtypeof: makePrimitive("type_subtypeof", type_subtypeof_impl, true),
  // C3.3: knowledge observation — eager but channel-aware (certificate
  // rides the channels), tagged with the "observe" effect label.
  certificate_peek: makePrimitive("certificate_peek", certificate_peek_impl, false, ["observe"]),
  type_apply: makePrimitive("type_apply", type_apply_impl, true),
  type_function: makePrimitive("type_function", type_function_impl, true),
  type_union: makePrimitive("type_union", type_union_impl, true),
  structural_wrap: makePrimitive("structural_wrap", structural_wrap_impl, true),
  type_refine: makePrimitive("type_refine", type_refine_impl, true),
  type_check_binding: makePrimitive("type_check_binding", type_check_binding_impl, true),
  assert_invariant: makePrimitive("assert_invariant", assert_invariant_impl, true),
  assume_invariant: makePrimitive("assume_invariant", assume_invariant_impl, true),
  assert_stmt: makePrimitive("assert_stmt", assert_stmt_impl, true),
  // Phase C Chunk 3: contracts.
  seq: makePrimitive("seq", seq_impl, true),
  requires_stmt: makePrimitive("requires_stmt", requires_stmt_impl, true),
  ensures_decl: makePrimitive("ensures_decl", ensures_decl_impl, true),
  ensures_check: makePrimitive("ensures_check", ensures_check_impl, true),
  // Phase D1: effect-declaration markers.
  effects_decl_marker: makePrimitive("effects_decl_marker", effects_decl_marker_impl, true),
  effects_attach: makePrimitive("effects_attach", effects_attach_impl, true),
  param_effects_decl_marker: makePrimitive("param_effects_decl_marker", param_effects_decl_marker_impl, true),
  param_effects_attach: makePrimitive("param_effects_attach", param_effects_attach_impl, true),
  partial_decl_marker: makePrimitive("partial_decl_marker", partial_decl_marker_impl, true),
  partial_attach: makePrimitive("partial_attach", partial_attach_impl, true),
  decreases_decl_marker: makePrimitive("decreases_decl_marker", decreases_decl_marker_impl, true),
  decreases_attach: makePrimitive("decreases_attach", decreases_attach_impl, true),
  // Phase F7: `proven` clause marker + passthrough wrapper.
  proven_decl_marker: makePrimitive("proven_decl_marker", proven_decl_marker_impl, true),
  proven_attach: makePrimitive("proven_attach", proven_attach_impl, true),
  // Phase F1: proof by partial evaluation. Lazy on the proposition arg.
  proof_by_eval: makePrimitive("proof_by_eval", proof_by_eval_impl, true),
  // Phase F2: proof by refinement-domain entailment. Eager — both operands
  // are ordinary values.
  proof_refines: makePrimitive("proof_refines", proof_refines_impl),
  // Phase F3: proof combinators + the `theorem … by <term>` checker.
  // Plain eager (C4.3c: every eager impl receives full values, channels
  // intact — the former channelAware mode is the universal default).
  proof_refl:  makePrimitive("proof_refl",  proof_refl_impl),
  proof_sym:   makePrimitive("proof_sym",   proof_sym_impl),
  proof_trans: makePrimitive("proof_trans", proof_trans_impl),
  proof_cong:  makePrimitive("proof_cong",  proof_cong_impl),
  // Lazy on the proposition (needs the AST) and proof term.
  proof_check: makePrimitive("proof_check", proof_check_impl, true),
  // Phase F5: universal quantification — plain eager since C4.3c.
  prove_for_all_bool: makePrimitive("prove_for_all_bool", prove_for_all_bool_impl),
  prove_induction:    makePrimitive("prove_induction",    prove_induction_impl),
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
  delay: makePrimitive("delay", delay_wrapper, true, ["time"]),
  fetch: makePrimitive("fetch", fetch_impl, true, ["net"]),
};