// Allegro Base Language - Evaluator

import {
  Value, ValueKind, ExpressionValue, ContextValue,
  ComposedFunctionValue, ParamValue, MultiValueType,
  AllegroError, primaryOf, isResolved, makeExpr, makeMultiValue,
} from "./types.js";

const MAX_DEPTH = 10000;

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

  const fn = evaluate(expr.fn, ctx, depth + 1);

  // Primitive function
  if (fn.kind === ValueKind.PrimitiveFunction) {
    const result = applyPrimitive(fn, expr.args, ctx, depth);
    expr.memo.set("eval", result);
    return result;
  }

  // Composed function
  if (fn.kind === ValueKind.ComposedFunction) {
    const result = applyComposed(fn, expr.args, ctx, depth);
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

  // Unwrap multi-values for primitives
  const primaryArgs = evalArgs.map(primaryOf);
  return fn.fn(primaryArgs, ctx, evalFn);
}

// --- Apply composed function ---

function applyComposed(
  fn: ComposedFunctionValue,
  args: Value[],
  ctx: ContextValue,
  depth: number,
): Value {
  const evalArgs = args.map(a => evaluate(a, ctx, depth + 1));
  const substituted = substituteParams(fn, evalArgs);
  return evaluate(substituted, ctx, depth + 1);
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
      // Don't substitute into non-thunk inner functions (they have their own params)
      if (value.params.length > 0) return value;
      // Descend into thunks (zero-param composed functions like if-then-else branches)
      const newBody = subst(value.body, owner, posMap);
      if (newBody === value.body) return value;
      const newFn: ComposedFunctionValue = {
        kind: ValueKind.ComposedFunction,
        params: value.params,
        body: newBody,
      };
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