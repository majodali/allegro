// Allegro Base Language - Evaluator

import {
  Value, ValueKind, ExpressionValue, ContextValue,
  ComposedFunctionValue, ParamValue, MultiValueType,
  AllegroError, primaryOf, isResolved, makeExpr, makeMultiValue, makeContext,
} from "./types.js";
import {
  getType, getTypeName, withType, getFunctionParamTypes, getFunctionReturnType,
  unifyTypes, resolveTypeWithBindings, TypeBindings,
} from "./types-std.js";

const MAX_DEPTH = 10000;

// Map base primitive names to type method names for type-directed dispatch
const PRIM_TO_METHOD = new Map<string, string>([
  ["bits_add", "add"], ["bits_sub", "sub"], ["bits_mul", "mul"],
  ["bits_div", "div"], ["bits_mod", "mod"],
  ["bits_eq", "eq"], ["bits_lt", "lt"], ["bits_gt", "gt"],
  ["bits_lte", "lte"], ["bits_gte", "gte"],
]);

// --- Core evaluation ---

export function evaluate(value: Value, ctx: ContextValue, depth: number = 0): Value {
  if (depth > MAX_DEPTH) throw new AllegroError("Maximum evaluation depth exceeded");

  switch (value.kind) {
    case ValueKind.Bits:
    case ValueKind.PrimitiveFunction:
    case ValueKind.Context:
    case ValueKind.ComposedFunction:
      return value;

    case ValueKind.Param: {
      // Try to resolve named params against the context
      if (value._name && value.position === -1) {
        const resolved = ctx.bindings.get(value._name);
        if (resolved?.value !== undefined) return evaluate(resolved.value, ctx, depth + 1);
      }
      return value; // unbound param
    }

    case ValueKind.MultiValue: {
      const ep = evaluate(value.primary, ctx, depth + 1);
      return ep === value.primary ? value : makeMultiValue(ep, new Map(value.components));
    }

    case ValueKind.Expression:
      return evaluateExpr(value, ctx, depth);
  }
}

function evaluateExpr(expr: ExpressionValue, ctx: ContextValue, depth: number): Value {
  // Check memo
  const cached = expr.memo.get("eval");
  if (cached !== undefined) return cached;

  const fnRaw = evaluate(expr.fn, ctx, depth + 1);
  // Unwrap MultiValue to get the callable (e.g., exported functions)
  const fn = primaryOf(fnRaw);

  // Primitive function
  if (fn.kind === ValueKind.PrimitiveFunction) {
    const result = applyPrimitive(fn, expr.args, ctx, depth);
    expr.memo.set("eval", result);
    return result;
  }

  // Composed function
  if (fn.kind === ValueKind.ComposedFunction) {
    const result = applyComposed(fn, expr.args, ctx, depth, fnRaw);
    expr.memo.set("eval", result);
    return result;
  }

  // Function not resolved - partially evaluate args
  const evalArgs = expr.args.map(a => evaluate(a, ctx, depth + 1));
  if (fn === expr.fn && evalArgs.every((a, i) => a === expr.args[i])) {
    expr.memo.set("eval", expr);
    return expr;
  }
  const reduced = makeExpr(fn, evalArgs);
  expr.memo.set("eval", reduced);
  return reduced;
}

// --- Apply primitive ---

function applyPrimitive(
  fn: import("./types.js").PrimitiveFunctionValue,
  args: Value[],
  ctx: ContextValue,
  depth: number,
): Value {
  const evalFn = (v: Value, c: ContextValue) => evaluate(v, c, depth + 1);

  if (fn.lazy) {
    return fn.fn(args, ctx, evalFn);
  }

  // Eager: evaluate all args
  const evalArgs = args.map(a => evaluate(a, ctx, depth + 1));
  if (!evalArgs.every(isResolved)) {
    return makeExpr(fn, evalArgs);
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
          // Re-wrap with appropriate type
          if (result.kind === ValueKind.Bits) {
            if (methodName === "eq" || methodName === "neq" || methodName === "lt" || methodName === "gt" || methodName === "lte" || methodName === "gte") {
              return makeMultiValue(result, new Map([["type", typeComp]])); // comparison returns same type context for now
            }
            return makeMultiValue(result, new Map([["type", typeComp]]));
          }
          return result;
        }
      }
    }
  }

  // Unwrap multi-values for primitives
  const primaryArgs = evalArgs.map(primaryOf);
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
): Value {
  const evalArgs = args.map(a => evaluate(a, ctx, depth + 1));

  // Type variable unification: if the function has a FunctionType,
  // match arg types against param types to bind type variables
  let enrichedCtx = ctx;
  let inferredReturnType: Value | null = null;
  if (fnRaw && fnRaw.kind === ValueKind.MultiValue) {
    const fnType = getType(fnRaw);
    const _fnTypeName = fnType ? getTypeName(fnRaw) : null;
    if (fnType && _fnTypeName === "Function") {
      const paramTypes = getFunctionParamTypes(fnType);
      const returnTypeExpr = getFunctionReturnType(fnType);
      if (paramTypes) {
        const bindings: TypeBindings = new Map();
        // Unify each arg type against the corresponding param type
        for (let i = 0; i < Math.min(evalArgs.length, paramTypes.length); i++) {
          const argType = getType(evalArgs[i]);
          unifyTypes(argType, paramTypes[i], bindings);
        }
        // If we have bindings, enrich the context
        if (bindings.size > 0) {
          enrichedCtx = makeContext();
          // Copy all bindings from original context
          for (const [key, binding] of ctx.bindings) {
            enrichedCtx.bindings.set(key, binding);
            enrichedCtx.bindingList.push(binding);
          }
          // Add type variable bindings
          for (const [varName, typeVal] of bindings) {
            const binding = { key: varName, value: typeVal, isUse: false };
            enrichedCtx.bindings.set(varName, binding);
            enrichedCtx.bindingList.push(binding);
          }
          // Resolve return type with bindings
          if (returnTypeExpr && returnTypeExpr.kind === ValueKind.Param) {
            inferredReturnType = resolveTypeWithBindings(returnTypeExpr, bindings);
          }
        }
      }
    }
  }

  const substituted = substituteParams(fn, evalArgs);
  let result = evaluate(substituted, enrichedCtx, depth + 1);

  // If we inferred a return type from unification, apply it
  if (inferredReturnType && inferredReturnType.kind === ValueKind.Context) {
    const currentType = getType(result);
    if (!currentType) {
      result = withType(result, inferredReturnType as ContextValue);
    }
  }

  return result;
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
  return subst(fn.body, fn, posMap);
}

function subst(value: Value, owner: ComposedFunctionValue, posMap: Map<number, Value>): Value {
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

    case ValueKind.ComposedFunction: {
      // Descend into all composed functions to substitute free variables.
      // Inner functions' own params won't match (different owner).
      const newBody = subst(value.body, owner, posMap);
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
      const newFn = subst(value.fn, owner, posMap);
      const newArgs = value.args.map(a => subst(a, owner, posMap));
      if (newFn === value.fn && newArgs.every((a, i) => a === value.args[i])) return value;
      return makeExpr(newFn, newArgs);
    }

    case ValueKind.MultiValue: {
      const newP = subst(value.primary, owner, posMap);
      return newP === value.primary ? value : makeMultiValue(newP, new Map(value.components));
    }
  }
}

// --- Context helpers ---

export function resolveInContext(ctx: ContextValue, name: string): Value | undefined {
  const b = ctx.bindings.get(name);
  return b?.value;
}