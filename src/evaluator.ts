// Allegretto - Evaluator

import {
  Value, ValueKind, ExpressionValue, ContextValue,
  ComposedFunctionValue, ParamValue, MultiValueType,
  AllegroError, primaryOf, isResolved, makeExpr, makeMultiValue, makeContext,
  DepCollector,
} from "./types.js";
import {
  getType, getTypeName, withType, typeMethod, getFunctionParamTypes, getFunctionReturnType,
  unifyTypes, resolveTypeWithBindings, TypeBindings, typeContextName,
} from "./types-std.js";
import { propagateSetForPrimitive, withPredicates, PredicateSet } from "./refinements.js";

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

    const fn = body.fn;
    // eval_if: args[1] and args[2] are thunks; their bodies are in tail position
    if (fn.kind === ValueKind.PrimitiveFunction && fn.name === "eval_if" && body.args.length === 3) {
      for (const branchIdx of [1, 2]) {
        const branch = body.args[branchIdx];
        if (branch.kind === ValueKind.ComposedFunction && branch.params.length === 0) {
          markTailCalls(branch.body, seen);
        }
      }
    }
    // eval_when: args are [subject, pattern, guardFn, thenBranch, elseBranch].
    // thenBranch and elseBranch are ComposedFunctions (with possible pattern-
    // extracted params); their bodies are in tail position relative to the when.
    if (fn.kind === ValueKind.PrimitiveFunction && fn.name === "eval_when" && body.args.length === 5) {
      for (const branchIdx of [3, 4]) {
        const branch = body.args[branchIdx];
        if (branch.kind === ValueKind.ComposedFunction) {
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
      if (resolved?.value !== undefined) {
        let result = evaluate(resolved.value, ctx, depth + 1, depCollector);
        // Phase C Chunk 2: augment with any scope-local predicates for this
        // name (from branch conditions or in-scope `assert` statements).
        if (ctx.scopePredicates) {
          const scopePred = ctx.scopePredicates.get(value.name);
          if (scopePred) {
            result = withPredicates(result, scopePred as PredicateSet);
          }
        }
        return result;
      }
      // Symbol unresolved — record as incomplete dependency
      if (depCollector) depCollector.incompleteRefs.add(value.name);
      return value;
    }

    case ValueKind.MultiValue: {
      const ep = evaluate(value.primary, ctx, depth + 1, depCollector);
      if (ep === value.primary) return value;
      // If re-evaluation produced another MultiValue, FLATTEN rather than NEST.
      // Inner (freshly-evaluated) components shadow outer (stale) components —
      // fresh resolved type info should replace pre-computed partial-eval types.
      if (ep.kind === ValueKind.MultiValue) {
        const merged = new Map(value.components);
        for (const [k, v] of (ep as MultiValueType).components) merged.set(k, v);
        return makeMultiValue((ep as MultiValueType).primary, merged);
      }
      return makeMultiValue(ep, new Map(value.components));
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
  // Types may be wrapped as MultiValues (e.g., Int is MultiValue(IntType, {type: NominalType}))
  const fnCtx = fn.kind === ValueKind.Context ? fn as ContextValue
    : (fn.kind === ValueKind.MultiValue && (fn as MultiValueType).primary.kind === ValueKind.Context)
      ? (fn as MultiValueType).primary as ContextValue : null;
  if (fnCtx) {
    const constructBinding = fnCtx.bindings.get("__construct");
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

  // Phase B: refinement-domain propagation. If the primitive is one of
  // bits_add / bits_sub / bits_mul and the operands carry abstract domains
  // (from refined types or literal values), compute the output domain so
  // downstream operations inherit the proof context.
  const propagatedSet = propagateSetForPrimitive(fn.name, evalArgs);

  // Type-directed dispatch: if the first arg has a type with a matching method,
  // dispatch through the type instead of calling the base primitive directly.
  // This enables operator overloading (e.g., String + String = concatenation).
  if (evalArgs[0]?.kind === ValueKind.MultiValue) {
    const typeComp = (evalArgs[0] as MultiValueType).components.get("type");
    if (typeComp && typeComp.kind === ValueKind.Context) {
      const methodName = PRIM_TO_METHOD.get(fn.name);
      if (methodName) {
        const method = typeMethod(typeComp as ContextValue, methodName);
        if (method?.kind === ValueKind.PrimitiveFunction) {
          const primaryArgs = evalArgs.map(primaryOf);
          const result = (method as import("./types.js").PrimitiveFunctionValue).fn(primaryArgs, ctx, evalFn);
          // If the method already returned a typed value (MultiValue), use it as-is.
          // Methods know their return types (e.g., comparisons return Bool).
          let out: Value;
          if (result.kind === ValueKind.MultiValue) out = result;
          else if (result.kind === ValueKind.Bits)  out = makeMultiValue(result, new Map([["type", typeComp]]));
          else                                       out = result;
          return propagatedSet ? withPredicates(out, propagatedSet) : out;
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
  let out: Value;
  if (result.kind === ValueKind.Bits && evalArgs[0]?.kind === ValueKind.MultiValue) {
    const typeComp = (evalArgs[0] as MultiValueType).components.get("type");
    if (typeComp) out = makeMultiValue(result, new Map([["type", typeComp]]));
    else          out = result;
  } else {
    out = result;
  }
  return propagatedSet ? withPredicates(out, propagatedSet) : out;
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
            checkArgType(evalArgs[i], resolvedParamType as ContextValue, i, enrichedCtx, depth, depCollector);
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

/**
 * Walk an expression tree and replace Param references per paramMap.
 * Used by subst when cloning inner ComposedFunctions to avoid sharing
 * param arrays (which would cause owner-mutation to corrupt the original).
 */
export function remapParams(value: Value, paramMap: Map<ParamValue, ParamValue>): Value {
  if (paramMap.size === 0) return value;
  switch (value.kind) {
    case ValueKind.Bits:
    case ValueKind.PrimitiveFunction:
    case ValueKind.Context:
    case ValueKind.Symbol:
      return value;
    case ValueKind.Param: {
      const replacement = paramMap.get(value);
      return replacement ?? value;
    }
    case ValueKind.Expression: {
      const newFn = remapParams(value.fn, paramMap);
      const newArgs = value.args.map(a => remapParams(a, paramMap));
      if (newFn === value.fn && newArgs.every((a, i) => a === value.args[i])) return value;
      const newExpr = makeExpr(newFn, newArgs);
      if ((value as any)._tailPosition) (newExpr as any)._tailPosition = true;
      return newExpr;
    }
    case ValueKind.ComposedFunction: {
      const newBody = remapParams(value.body, paramMap);
      if (newBody === value.body) return value;
      return { kind: ValueKind.ComposedFunction, params: value.params, body: newBody };
    }
    case ValueKind.MultiValue: {
      const newP = remapParams(value.primary, paramMap);
      return newP === value.primary ? value : makeMultiValue(newP, new Map(value.components));
    }
  }
}

export function substituteParams(fn: ComposedFunctionValue, args: Value[]): Value {
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
      // CRITICAL: clone the params array AND each param, so re-binding owner
      // below doesn't corrupt the original function's params. Without this,
      // mutating p.owner affects every previous substitution result that
      // shared the same params (e.g., two closures from the same factory
      // would end up pointing to each other's inner lambdas).
      const newParams = value.params.map(p => ({
        kind: ValueKind.Param,
        position: p.position,
        owner: null as any,
        _name: p._name,
      } as ParamValue));
      // Rewrite Param references in the new body that point to old params,
      // remapping them to the cloned params (matched by position).
      const paramMap = new Map<ParamValue, ParamValue>();
      for (let i = 0; i < value.params.length; i++) paramMap.set(value.params[i], newParams[i]);
      const remappedBody = remapParams(newBody, paramMap);
      const newFn: ComposedFunctionValue = {
        kind: ValueKind.ComposedFunction,
        params: newParams,
        body: remappedBody,
      };
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
function checkArgType(
  arg: Value,
  expectedType: ContextValue,
  argIndex: number,
  ctx?: ContextValue,
  depth?: number,
  depCollector?: DepCollector,
): void {
  // Normalize bare generics to Generic[Any]
  let expected = normalizeType(expectedType);

  // Refinement type handling: if expected is a refined type, check the value
  // against the refinement's BASE (via __extends chain), then evaluate the predicate.
  // This allows a plain Int to satisfy PositiveInt if the predicate passes.
  const refinementPredicate = expected.bindings.get("__predicate")?.value;
  if (refinementPredicate) {
    const base = expected.bindings.get("__extends")?.value;
    if (base?.kind === ValueKind.Context) {
      // Recurse on the base type (unwraps nested refinements)
      checkArgType(arg, base as ContextValue, argIndex, ctx, depth, depCollector);
      // Base check passed — evaluate the predicate (unless same refined type)
      const argType0 = getType(arg);
      if (argType0 !== expected && ctx && depth !== undefined) {
        const result = evaluate(makeExpr(refinementPredicate, [arg]), ctx, depth + 1, depCollector);
        const p = primaryOf(result);
        if (p.kind === ValueKind.Bits && p.data === 0n) {
          const name = typeContextName(expected) ?? "<refined>";
          throw new AllegroError(`Type error: argument ${argIndex} failed refinement predicate for ${name}`);
        }
      }
      return;
    }
  }

  const expectedName = typeContextName(expected);
  if (!expectedName || expectedName === "Any") return;

  const argType = getType(arg);
  if (!argType) return; // untyped arg — skip

  // Helper: evaluate refinement predicate on arg if expected type has one.
  // Short-circuits when argType is reference-equal to expected (same refined type).
  const checkRefinement = (): void => {
    const predicate = expected.bindings.get("__predicate")?.value;
    if (!predicate) return;
    if (argType === expected) return; // same refined type — predicate already holds
    if (!ctx || depth === undefined) return; // no eval context — best-effort skip
    const result = evaluate(makeExpr(predicate, [arg]), ctx, depth + 1, depCollector);
    const p = primaryOf(result);
    if (p.kind === ValueKind.Bits && p.data === 0n) {
      throw new AllegroError(`Type error: argument ${argIndex} failed refinement predicate for ${expectedName}`);
    }
    // If unresolved, best-effort accept (partial evaluation will retry)
  };

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
    checkRefinement();
    return;
  }

  // Check using the expected type's own instanceof (direct binding, e.g., UnionType)
  const directInstanceof = expected.bindings.get("instanceof")?.value;
  if (directInstanceof?.kind === ValueKind.PrimitiveFunction) {
    const checkResult = directInstanceof.fn([arg], undefined as any, undefined as any);
    const checkP = primaryOf(checkResult);
    if (checkP.kind === ValueKind.Bits && checkP.data === 0n) {
      throw new AllegroError(`Type error: argument ${argIndex} expected ${expectedName}, got ${actualName}`);
    }
    checkRefinement();
    return;
  }

  // Use meta-type instanceof (NominalType nominal check)
  const typeType = expected.bindings.get("__type")?.value as ContextValue | undefined;
  if (typeType) {
    const instanceofMethod = typeMethod(typeType, "instanceof");
    if (instanceofMethod?.kind === ValueKind.PrimitiveFunction) {
      const checkResult = instanceofMethod.fn([expected, arg], undefined as any, undefined as any);
      const checkP = primaryOf(checkResult);
      if (checkP.kind === ValueKind.Bits && checkP.data === 0n) {
        throw new AllegroError(`Type error: argument ${argIndex} expected ${expectedName}, got ${actualName}`);
      }
      checkRefinement();
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
      // Typed param: create MultiValue(Param, type: paramType). If the type
      // is refined and carries an abstract domain (Phase B), seed the domain
      // on the placeholder so propagation rules fire during precompile.
      const components = new Map<string, Value>([["type", paramType]]);
      const dom = (paramType as any).__abstractDomain;
      if (dom && dom.kind !== "opaque") {
        const domCtx: ContextValue = { kind: ValueKind.Context, bindings: new Map(), bindingList: [] };
        (domCtx as any).__abstractDomain = dom;
        components.set("domain", domCtx);
      }
      const placeholder = makeMultiValue(
        makeParamHelper(param.position, param._name),
        components,
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