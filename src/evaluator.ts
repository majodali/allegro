// Allegro Base Language - Evaluator

import {
  Value, ValueKind, ExpressionValue, ContextValue,
  ComposedFunctionValue, ParamValue, MultiValueType,
  AllegroError, primaryOf, isResolved, makeExpr, makeMultiValue, makeContext,
  DepCollector,
} from "./types.js";
import {
  getType, getTypeName, withType, getFunctionParamTypes, getFunctionReturnType,
  unifyTypes, resolveTypeWithBindings, TypeBindings, typeContextName,
} from "./types-std.js";

const MAX_DEPTH = 10000;

// --- Tail Call Optimization ---

/**
 * TailCall marker: returned by the evaluator when a tail-position call
 * to a ComposedFunction is detected. The enclosing applyComposed catches
 * it and loops instead of recursing.
 */
interface TailCall {
  __tailCall: true;
  fn: ComposedFunctionValue;
  args: Value[];
  fnRaw?: Value;
}

function isTailCall(v: any): v is TailCall {
  return v && v.__tailCall === true;
}

function makeTailCall(fn: ComposedFunctionValue, args: Value[], fnRaw?: Value): TailCall {
  return { __tailCall: true, fn, args, fnRaw };
}

/**
 * Mark tail-position Expressions in a function body.
 * A tail-position Expression is one whose result IS the function's result.
 */
export function markTailCalls(body: Value, seen?: Set<Value>): void {
  if (!body || typeof body !== "object") return;
  if (!seen) seen = new Set();
  if (seen.has(body)) return;
  seen.add(body);

  if (body.kind === ValueKind.Expression) {
    // This expression is in tail position — mark it
    (body as any)._tailPosition = true;

    // If this is eval_if, mark both branch thunks' bodies as tail position
    const fn = body.fn;
    if (fn.kind === ValueKind.PrimitiveFunction && fn.name === "eval_if" && body.args.length === 3) {
      // args[1] and args[2] are thunks (ComposedFn with no params)
      for (const branchIdx of [1, 2]) {
        const branch = body.args[branchIdx];
        if (branch.kind === ValueKind.ComposedFunction && branch.params.length === 0) {
          markTailCalls(branch.body, seen);
        }
      }
    }
  }
}

// Map base primitive names to type method names for type-directed dispatch
const PRIM_TO_METHOD = new Map<string, string>([
  ["bits_add", "add"], ["bits_sub", "sub"], ["bits_mul", "mul"],
  ["bits_div", "div"], ["bits_mod", "mod"],
  ["bits_eq", "eq"], ["bits_neq", "neq"], ["bits_lt", "lt"], ["bits_gt", "gt"],
  ["bits_lte", "lte"], ["bits_gte", "gte"],
]);

// --- Core evaluation ---

export function evaluate(
  value: Value, ctx: ContextValue, depth: number = 0, depCollector?: DepCollector,
): Value {
  if (depth > MAX_DEPTH) throw new AllegroError("Maximum evaluation depth exceeded");

  switch (value.kind) {
    case ValueKind.Bits:
    case ValueKind.PrimitiveFunction:
    case ValueKind.Context:
    case ValueKind.ComposedFunction:
      return value;

    case ValueKind.Param:
      return value;

    case ValueKind.Symbol: {
      const resolved = ctx.bindings.get(value.name);
      if (resolved?.value !== undefined) return evaluate(resolved.value, ctx, depth + 1, depCollector);
      // Symbol unresolved — record as incomplete dependency
      if (depCollector) depCollector.incompleteRefs.add(value.name);
      return value;
    }

    case ValueKind.MultiValue: {
      const ep = evaluate(value.primary, ctx, depth + 1, depCollector);
      return ep === value.primary ? value : makeMultiValue(ep, new Map(value.components));
    }

    case ValueKind.Expression: {
      const result = evaluateExpr(value, ctx, depth, depCollector);
      return result as Value;
    }
  }
}

function evaluateExpr(
  expr: ExpressionValue, ctx: ContextValue, depth: number, depCollector?: DepCollector,
): Value | TailCall {
  const fnRaw = evaluate(expr.fn, ctx, depth + 1, depCollector);
  const fn = primaryOf(fnRaw);

  if (fn.kind === ValueKind.PrimitiveFunction) {
    return applyPrimitive(fn, expr.args, ctx, depth, depCollector);
  }

  if (fn.kind === ValueKind.ComposedFunction) {
    if ((expr as any)._tailPosition) {
      const evalArgs = expr.args.map(a => evaluate(a, ctx, depth + 1, depCollector));
      return makeTailCall(fn, evalArgs, fnRaw);
    }
    return applyComposed(fn, expr.args, ctx, depth, fnRaw, depCollector);
  }

  // Context as function — constructor call via __construct
  if (fn.kind === ValueKind.Context) {
    const constructBinding = (fn as ContextValue).bindings.get("__construct");
    if (constructBinding?.value) {
      const ctor = constructBinding.value;
      if (ctor.kind === ValueKind.PrimitiveFunction) {
        return applyPrimitive(ctor, expr.args, ctx, depth, depCollector);
      }
      if (ctor.kind === ValueKind.ComposedFunction) {
        return applyComposed(ctor, expr.args, ctx, depth, undefined, depCollector);
      }
    }
  }

  // Function not resolved — partially evaluate args
  const evalArgs = expr.args.map(a => evaluate(a, ctx, depth + 1, depCollector));
  if (fn === expr.fn && evalArgs.every((a, i) => a === expr.args[i])) {
    return expr;
  }
  return makeExpr(fn, evalArgs);
}

// --- Apply primitive ---

function applyPrimitive(
  fn: import("./types.js").PrimitiveFunctionValue,
  args: Value[],
  ctx: ContextValue,
  depth: number,
  depCollector?: DepCollector,
): Value {
  const evalFn = (v: Value, c: ContextValue) => evaluate(v, c, depth + 1, depCollector);

  if (fn.lazy) {
    return fn.fn(args, ctx, evalFn);
  }

  // Eager: evaluate all args
  const evalArgs = args.map(a => evaluate(a, ctx, depth + 1, depCollector));
  if (!evalArgs.every(isResolved)) {
    const residual = makeExpr(fn, evalArgs);
    // Even though args aren't fully resolved, their type components
    // may be known. Use type-level dispatch to infer the result type.
    if (evalArgs[0]?.kind === ValueKind.MultiValue) {
      const typeComp = (evalArgs[0] as MultiValueType).components.get("type");
      if (typeComp && typeComp.kind === ValueKind.Context) {
        const methodName = PRIM_TO_METHOD.get(fn.name);
        if (methodName) {
          // Propagate left operand's type as the residual's type.
          // For comparisons this is imprecise (should be Bool), but the
          // correct type will be determined when the expression fully evaluates.
          return makeMultiValue(residual, new Map([["type", typeComp]]));
        }
      }
    }
    return residual;
  }

  // Error propagation: if any evaluated arg has an error component, propagate
  // the error without executing this primitive.
  for (const arg of evalArgs) {
    if (arg.kind === ValueKind.MultiValue) {
      const errComp = (arg as MultiValueType).components.get("error");
      if (errComp) {
        const components = new Map<string, Value>([["error", errComp]]);
        const typeComp = (arg as MultiValueType).components.get("type");
        if (typeComp) components.set("type", typeComp);
        return makeMultiValue(makeExpr(fn, evalArgs), components);
      }
    }
  }

  // Type-directed dispatch: if the first arg has a type with a matching method,
  // dispatch through the type instead of calling the base primitive directly.
  // This enables operator overloading (e.g., String + String = concatenation).
  if (evalArgs[0]?.kind === ValueKind.MultiValue) {
    const typeComp = (evalArgs[0] as MultiValueType).components.get("type");
    if (typeComp && typeComp.kind === ValueKind.Context) {
      const methodName = PRIM_TO_METHOD.get(fn.name);
      if (methodName) {
        const methodBinding = (typeComp as ContextValue).bindings.get(methodName);
        if (methodBinding?.value?.kind === ValueKind.PrimitiveFunction) {
          const primaryArgs = evalArgs.map(primaryOf);
          const result = (methodBinding.value as import("./types.js").PrimitiveFunctionValue).fn(primaryArgs, ctx, evalFn);
          // If the method already returned a typed value (MultiValue), use it as-is.
          // Methods know their return types (e.g., comparisons return Bool).
          if (result.kind === ValueKind.MultiValue) return result;
          // Otherwise wrap with the left operand's type (arithmetic results)
          if (result.kind === ValueKind.Bits) {
            return makeMultiValue(result, new Map([["type", typeComp]]));
          }
          return result;
        }
      }
    }
  }

  // Unwrap multi-values for primitives
  const primaryArgs = evalArgs.map(primaryOf);
  if (typeof fn.fn !== "function") {
    throw new AllegroError(`applyPrimitive: ${fn.name} has unresolved stub (fn=null). Check resolvePrimitives.`);
  }
  const result = fn.fn(primaryArgs, ctx, evalFn);

  // Type propagation: if the first arg had a type and the result is Bits,
  // propagate the type to the result.
  if (result.kind === ValueKind.Bits && evalArgs[0]?.kind === ValueKind.MultiValue) {
    const typeComp = (evalArgs[0] as MultiValueType).components.get("type");
    if (typeComp) {
      return makeMultiValue(result, new Map([["type", typeComp]]));
    }
  }

  return result;
}

// --- Apply composed function ---

function applyComposed(
  fn: ComposedFunctionValue,
  args: Value[],
  ctx: ContextValue,
  depth: number,
  fnRaw?: Value,
  depCollector?: DepCollector,
): Value {
  let currentFn = fn;
  let currentArgs = args;
  let currentFnRaw = fnRaw;

  // TCO loop: re-enters when a tail call to the same (or different) function is detected
  tco_loop: while (true) {
    const evalArgs = currentArgs.map(a => evaluate(a, ctx, depth + 1, depCollector));

    // Error propagation: if any arg has an error component, propagate without executing
    for (const arg of evalArgs) {
      if (arg.kind === ValueKind.MultiValue) {
        const errComp = (arg as MultiValueType).components.get("error");
        if (errComp) {
          const components = new Map<string, Value>([["error", errComp]]);
          const typeComp = (arg as MultiValueType).components.get("type");
          if (typeComp) components.set("type", typeComp);
          return makeMultiValue(makeExpr(currentFn, evalArgs), components);
        }
      }
    }

    // Type variable unification
    let enrichedCtx = ctx;
    let inferredReturnType: Value | null = null;
    if (currentFnRaw && currentFnRaw.kind === ValueKind.MultiValue) {
      const fnType = getType(currentFnRaw);
      const _fnTypeName = fnType ? getTypeName(currentFnRaw) : null;
      if (fnType && _fnTypeName === "Function") {
        const paramTypes = getFunctionParamTypes(fnType);
        const returnTypeExpr = getFunctionReturnType(fnType);
        if (paramTypes) {
          const bindings: TypeBindings = new Map();
          for (let i = 0; i < Math.min(evalArgs.length, paramTypes.length); i++) {
            const argType = getType(evalArgs[i]);
            unifyTypes(argType, paramTypes[i], bindings);
          }
          if (bindings.size > 0) {
            enrichedCtx = makeContext();
            for (const [key, binding] of ctx.bindings) {
              enrichedCtx.bindings.set(key, binding);
              enrichedCtx.bindingList.push(binding);
            }
            for (const [varName, typeVal] of bindings) {
              const binding = { key: varName, value: typeVal, isUse: false };
              enrichedCtx.bindings.set(varName, binding);
              enrichedCtx.bindingList.push(binding);
            }
            if (returnTypeExpr && (returnTypeExpr.kind === ValueKind.Param || returnTypeExpr.kind === ValueKind.Symbol)) {
              inferredReturnType = resolveTypeWithBindings(returnTypeExpr, bindings);
            }
          }
          // Call-site type checking: verify args match param types
          // (after unification, so type variables are resolved)
          for (let i = 0; i < Math.min(evalArgs.length, paramTypes.length); i++) {
            const resolvedParamType = resolveTypeWithBindings(paramTypes[i], bindings);
            if (resolvedParamType.kind !== ValueKind.Context) continue; // unresolved type var
            checkArgType(evalArgs[i], resolvedParamType as ContextValue, i);
          }
        }
      }
    }

    const substituted = substituteParams(currentFn, evalArgs);
    let result: Value | TailCall = evaluate(substituted, enrichedCtx, depth + 1, depCollector);

    // Check for TailCall from tail-position evaluation
    if (isTailCall(result)) {
      // Tail call detected — loop instead of recursing
      currentFn = result.fn;
      currentArgs = result.args;
      currentFnRaw = result.fnRaw;
      continue tco_loop;
    }

    // Apply inferred return type
    if (inferredReturnType && inferredReturnType.kind === ValueKind.Context) {
      const currentType = getType(result);
      if (!currentType) {
        result = withType(result, inferredReturnType as ContextValue);
      }
    }

    return result;
  }
}

// --- Parameter substitution ---

function substituteParams(fn: ComposedFunctionValue, args: Value[]): Value {
  // Build a position-based map for substitution
  const posMap = new Map<number, Value>();
  for (const p of fn.params) {
    if (p.position < args.length) {
      posMap.set(p.position, args[p.position]);
    }
  }
  return subst(fn.body, fn, posMap, new Set());
}

function subst(value: Value, owner: ComposedFunctionValue, posMap: Map<number, Value>, seen: Set<Value>): Value {
  // Note: no circular reference guard needed now that self-references stay as Symbols
  // (no circular function references in expression tree)

  switch (value.kind) {
    case ValueKind.Bits:
    case ValueKind.PrimitiveFunction:
    case ValueKind.Context:
      return value;

    case ValueKind.Param: {
      // Match params by position if they belong to this function (by identity or by being unowned)
      if ((value.owner === owner || value.owner === null) && posMap.has(value.position)) {
        return posMap.get(value.position)!;
      }
      return value;
    }

    case ValueKind.Symbol:
      return value; // Symbols are resolved by name, not substituted by position

    case ValueKind.ComposedFunction: {
      // Descend into all composed functions to substitute free variables.
      // Inner functions' own params won't match (different owner).
      const newBody = subst(value.body, owner, posMap, seen);
      if (newBody === value.body) return value;
      const newFn: ComposedFunctionValue = {
        kind: ValueKind.ComposedFunction,
        params: value.params,
        body: newBody,
      };
      // Re-bind params to new function
      for (const p of newFn.params) p.owner = newFn;
      return newFn;
    }

    case ValueKind.Expression: {
      const newFn = subst(value.fn, owner, posMap, seen);
      const newArgs = value.args.map(a => subst(a, owner, posMap, seen));
      if (newFn === value.fn && newArgs.every((a, i) => a === value.args[i])) return value;
      const newExpr = makeExpr(newFn, newArgs);
      // Propagate tail position flag through substitution
      if ((value as any)._tailPosition) (newExpr as any)._tailPosition = true;
      return newExpr;
    }

    case ValueKind.MultiValue: {
      const newP = subst(value.primary, owner, posMap, seen);
      return newP === value.primary ? value : makeMultiValue(newP, new Map(value.components));
    }
  }
}

// --- Context helpers ---

export function resolveInContext(ctx: ContextValue, name: string): Value | undefined {
  const b = ctx.bindings.get(name);
  return b?.value;
}

// --- Call-site type checking ---

import { normalizeType } from "./types-std.js";

/**
 * Check that an argument value matches the expected parameter type.
 * Called at function call sites. Handles named types, unions, structural,
 * generic type args — mirrors type_check_impl but without lazy evaluation.
 */
function checkArgType(arg: Value, expectedType: ContextValue, argIndex: number): void {
  // Normalize bare generics to Generic[Any]
  const expected = normalizeType(expectedType);
  const expectedName = typeContextName(expected);
  if (!expectedName || expectedName === "Any") return;

  const argType = getType(arg);
  if (!argType) return; // untyped arg — skip

  const actualName = typeContextName(argType);
  if (actualName === expectedName) {
    // Names match — also check type args for generics (Array[Int] vs Array[String])
    const expectedArgs = expected.bindings.get("__args")?.value;
    const actualArgs = argType.bindings.get("__args")?.value;
    if (expectedArgs?.kind === ValueKind.Context && actualArgs?.kind === ValueKind.Context) {
      const expCtx = expectedArgs as ContextValue;
      const actCtx = actualArgs as ContextValue;
      const expLen = Number(expCtx.bindings.get("__length")?.value?.kind === ValueKind.Bits ? (expCtx.bindings.get("__length")!.value! as any).data : 0n);
      const actLen = Number(actCtx.bindings.get("__length")?.value?.kind === ValueKind.Bits ? (actCtx.bindings.get("__length")!.value! as any).data : 0n);
      for (let j = 0; j < Math.min(expLen, actLen); j++) {
        const expArg = expCtx.bindings.get(String(j))?.value;
        const actArg = actCtx.bindings.get(String(j))?.value;
        if (expArg?.kind === ValueKind.Context && actArg?.kind === ValueKind.Context) {
          const expArgName = typeContextName(expArg);
          const actArgName = typeContextName(actArg);
          if (expArgName && actArgName && expArgName !== "Any" && actArgName !== "Any" && expArgName !== actArgName) {
            throw new AllegroError(`Type error: argument ${argIndex} expected ${expectedName}[${expArgName}], got ${expectedName}[${actArgName}]`);
          }
        }
      }
    }
    return;
  }

  // Check using the expected type's own instanceof (handles unions)
  const directInstanceof = expected.bindings.get("instanceof")?.value;
  if (directInstanceof?.kind === ValueKind.PrimitiveFunction) {
    const checkResult = directInstanceof.fn([arg], undefined as any, undefined as any);
    const checkP = primaryOf(checkResult);
    if (checkP.kind === ValueKind.Bits && checkP.data === 0n) {
      throw new AllegroError(`Type error: argument ${argIndex} expected ${expectedName}, got ${actualName}`);
    }
    return;
  }

  // Use meta-type instanceof (NominalType nominal check)
  const typeType = expected.bindings.get("__type")?.value as ContextValue | undefined;
  if (typeType) {
    const instanceofMethod = typeType.bindings.get("instanceof")?.value;
    if (instanceofMethod?.kind === ValueKind.PrimitiveFunction) {
      const checkResult = instanceofMethod.fn([expected, arg], undefined as any, undefined as any);
      const checkP = primaryOf(checkResult);
      if (checkP.kind === ValueKind.Bits && checkP.data === 0n) {
        throw new AllegroError(`Type error: argument ${argIndex} expected ${expectedName}, got ${actualName}`);
      }
      return;
    }
  }

  // Name mismatch with no instanceof to check
  throw new AllegroError(`Type error: argument ${argIndex} expected ${expectedName}, got ${actualName}`);
}

// --- Function pre-compilation (compile-time partial evaluation) ---

import { makeParam as makeParamHelper } from "./types.js";

/**
 * Pre-compile a typed function by partially evaluating its body with
 * typed param placeholders. Each param gets a MultiValue with the
 * declared type but an unresolved primary (Param). The evaluator's
 * existing partial evaluation behavior handles the rest:
 * - Type checks pass (type component matches)
 * - Arithmetic on typed-but-valueless params produces typed Expressions
 * - eval_if with unknown condition propagates types through branches
 *
 * Returns the inferred return type (from the result's type component),
 * or null if the return type couldn't be determined.
 */
export function precompileFunction(
  fn: ComposedFunctionValue,
  paramTypes: Value[],
  ctx: ContextValue,
): { inferredReturnType: Value | null; errors: string[] } {
  const errors: string[] = [];

  // Create typed placeholders for each param
  const placeholders: Value[] = [];
  for (let i = 0; i < fn.params.length; i++) {
    const param = fn.params[i];
    const paramType = i < paramTypes.length ? paramTypes[i] : null;

    if (paramType && paramType.kind === ValueKind.Context) {
      // Typed param: create MultiValue(Param, type: paramType)
      const placeholder = makeMultiValue(
        makeParamHelper(param.position, param._name),
        new Map([["type", paramType]]),
      );
      placeholders.push(placeholder);
    } else {
      // Untyped or type variable — leave as bare Param
      placeholders.push(makeParamHelper(param.position, param._name));
    }
  }

  // Substitute typed placeholders into the body
  const substituted = substituteParams(fn, placeholders);

  // Partially evaluate the body
  try {
    const result = evaluate(substituted, ctx, 0);
    const inferredType = getType(result);
    return { inferredReturnType: inferredType, errors };
  } catch (e: any) {
    // Compile-time type error detected
    errors.push(e.message);
    return { inferredReturnType: null, errors };
  }
}