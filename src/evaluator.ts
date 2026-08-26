// Allegretto - Evaluator

import {
  Value, ValueKind, ExpressionValue, ContextValue,
  ComposedFunctionValue, ParamValue, MultiValueType,
  AllegroError, isResolved, makeExpr, makeMultiValue, makeContext,
  DepCollector,
} from "./types.js";
import {
  getType, getTypeName, withType, typeMethod, applyBoundaryBound, getFunctionParamTypes, getFunctionReturnType,
  unifyTypes, resolveTypeWithBindings, TypeBindings, typeContextName,
  protocolEquals,
  assertMemberAvailable,
  assertMemberReachable, typePrivilegedCtx,
  futureElementType, typeNameOnRefinesChain,
} from "./types-std.js";
import { propagateSetForPrimitive, withPredicates, PredicateSet, AbstractDomain, EffectsDomain, impliesDomain } from "./refinements.js";
import { effectsOf, withEffects, unionEffectSets, EffectSet } from "./effects.js";
import { getConstruct, getPredicate, getRefines, getGenericArgs, getSlotCount, getEffectBound, channelReadRaw, cloneComponents, componentsView, dataOf, viralChannels, channelSpec, channelMerge, typeShape, indexGet, PRESERVED_FN_META_KEYS, withSource } from "./slots.js";
import { scopeLookup, scopeExtend, scopeCompileMode, scopeFactsFor } from "./scope.js";
import { isCarrier } from "./structure.js";

const MAX_DEPTH = 10000;

// B-018 T-R6 (broadened): the recursion inlining cutoff hook. Injected
// per typed compilation from runtime.ts once the call-graph SCCs are
// known; answers, by function identity, whether a callee participates in
// a recursion cycle — self-recursive or mutual — regardless of its D34
// discharge tier. Mirrors the `setDivergenceProbe` pattern: no new value
// slot, no new `__*` property, and absent (null) it is simply the
// pre-T-R6 behavior.
let inlineCutoff: ((fn: Value) => boolean) | null = null;

/** Register the inlining cutoff (called per typed compilation). Pass
 *  null to clear it — an untyped compilation has no tier information and
 *  must not inherit the previous one's. */
export function setInlineCutoff(f: ((fn: Value) => boolean) | null): void {
  inlineCutoff = f;
}

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

export function isTailCall(v: any): v is TailCall {
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
    case ValueKind.ComposedFunction:
      return value;

    case ValueKind.Structure: {
      // C7.1: a CARRIER (primary present) re-evaluates its primary — a
      // residual under channels is still pending computation; plain
      // structures self-evaluate.
      if (!isCarrier(value)) return value;
      const mv = value as MultiValueType;
      const ep = evaluate(mv.primary, ctx, depth + 1, depCollector);
      if (ep === mv.primary) return value;
      // If re-evaluation produced another structure, FLATTEN rather than NEST.
      // Inner (freshly-evaluated) components shadow outer (stale) components —
      // fresh resolved type info should replace pre-computed partial-eval types.
      // C4.3a (R3): union-rule channels (effects) merge by union via the
      // registry-installed merge instead of inner-shadows-outer — effects
      // observed before re-evaluation are facts, not stale guesses.
      if (ep.kind === ValueKind.Structure) {
        const merged = cloneComponents(mv);
        for (const [k, v] of componentsView(ep)) {
          const prev = merged.get(k);
          const mergeFn = prev !== undefined && channelSpec(k)?.rule === "union"
            ? channelMerge(k) : undefined;
          merged.set(k, mergeFn ? mergeFn(prev!, v) : v);
        }
        return makeMultiValue(dataOf(ep), merged);
      }
      return makeMultiValue(ep, cloneComponents(mv));
    }

    case ValueKind.Param:
      return value;

    case ValueKind.Symbol: {
      const resolved = scopeLookup(ctx, value.name);
      if (resolved?.value !== undefined) {
        let result = evaluate(resolved.value, ctx, depth + 1, depCollector);
        // Phase C Chunk 2: augment with any scope-local predicates for this
        // name (from branch conditions or in-scope `assert` statements).
        // C2.1: chain-aware — nearest layer wins.
        const scopePred = scopeFactsFor(ctx, value.name);
        if (scopePred) {
          result = withPredicates(result, scopePred as PredicateSet);
        }
        return result;
      }
      // Symbol unresolved — record as incomplete dependency
      if (depCollector) depCollector.incompleteRefs.add(value.name);
      return value;
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
  const fn = dataOf(fnRaw);

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

  // Context as function — constructor call via __construct. `fn` is
  // already dataOf(fnRaw), so carriers are peeled.
  const fnCtx = fn.kind === ValueKind.Structure ? fn as ContextValue : null;
  if (fnCtx) {
    const ctorSlot = getConstruct(fnCtx);
    if (ctorSlot) {
      const ctor = ctorSlot;
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
  // F2c: when the unresolved function is a Param with an effectBound (set by
  // typed_function_impl from `f: pure` annotations or by Surface C's
  // `param_effects`), propagate those effects onto the residual so PE's
  // upward flow surfaces them in the enclosing function's inferred set.
  // Without this, polymorphic `apply[e](g: e, x): Int => g(x)` would lose
  // the e-effect when precompiling the body's residual `Param(g)(x)` call.
  let residualEffects: Set<string> | null = null;
  if (fn.kind === ValueKind.Param) {
    const evar = (fn as any).effectVar as string | undefined;
    const bound = (fn as any).effectBound as Set<string> | undefined;
    if (evar !== undefined) {
      // C7.2c: declared effect variable — the variable's bare name rides
      // the inferred set (matches an `effects e` declaration directly);
      // concrete call sites resolve it by ordinary PE substitution.
      residualEffects = new Set([evar]);
    } else if (bound && bound.size > 0) {
      residualEffects = new Set(bound);
    } else if (!bound) {
      // No effectBound — function-typed param could do anything. Match
      // the walker's conservative "opaque" semantics so PE-driven inference
      // doesn't silently zero out effects on forwarding cases. An empty
      // bound (set with size 0, e.g. `f: pure`) means literally pure and
      // is left empty.
      residualEffects = new Set(["opaque"]);
    }
  }
  // Also union any effects already on the evaluated args (deferred residuals
  // that were effectful upstream).
  for (const a of evalArgs) {
    const e = effectsOf(a);
    if (e && e.size > 0) {
      if (!residualEffects) residualEffects = new Set();
      for (const lbl of e) residualEffects.add(lbl);
    }
  }
  let residual: Value;
  if (fn === expr.fn && evalArgs.every((a, i) => a === expr.args[i])) {
    residual = expr;
  } else {
    residual = makeExpr(fn, evalArgs);
  }
  // C4.3a (R1): viral channels ride the unresolved-application residual too.
  // An error-carrying callee (e.g. the result of dispatching a method on an
  // error value — err-through-method) or argument propagates instead of
  // being dropped at the application hop. First hit wins, matching viralScan.
  for (const cand of [fnRaw, ...evalArgs]) {
    // C4.3b: flattened Contexts carry channels too.
    if (cand.kind !== ValueKind.Structure) continue;
    for (const chan of viralChannels()) {
      const comp = channelReadRaw(cand, chan);
      if (comp) {
        const components = new Map<string, Value>([[chan, comp]]);
        const typeComp = channelReadRaw(cand, "type");
        if (typeComp) components.set("type", typeComp);
        const out = makeMultiValue(residual, components);
        return residualEffects ? withEffects(out, residualEffects) : out;
      }
    }
  }
  return residualEffects ? withEffects(residual, residualEffects) : residual;
}

// --- Apply primitive ---

function applyPrimitive(
  fn: import("./types.js").PrimitiveFunctionValue,
  args: Value[],
  ctx: ContextValue,
  depth: number,
  depCollector?: DepCollector,
): Value {
  // Stage F1: track effects fired during this primitive's evaluation so we
  // can attach the union to the result via the `effects` MultiValue component.
  // For lazy primitives we wrap evalFn to harvest effects from each subcall;
  // for eager primitives we read effects off the evaluated args after the
  // fact (logic further down).
  const trackedEffects: EffectSet = new Set();
  const evalFn = (v: Value, c: ContextValue) => {
    const r = evaluate(v, c, depth + 1, depCollector);
    if (fn.lazy) {
      const e = effectsOf(r);
      if (e) for (const lbl of e) trackedEffects.add(lbl);
    }
    return r;
  };

  if (fn.lazy) {
    // F3a: compile-time deferral for lazy primitives that carry effects.
    // print/fetch/delay are lazy (they need access to the evalFn closure)
    // but ALSO effectful — without this branch, the eager-path deferral
    // check is bypassed and the side effect fires at compile time. We
    // still evaluate args (via the tracking evalFn so each arg's effects
    // propagate into the residual), then return `makeExpr(fn, evalArgs)`
    // instead of running the impl. The impl runs at runtime when the
    // residual evaluates outside compile-mode.
    if (scopeCompileMode(ctx) && fn.effects && fn.effects.length > 0) {
      const evalArgs = args.map(a => evalFn(a, ctx));
      // Add fn's effects + tracked subcall effects + arg effects.
      if (fn.effects) for (const e of fn.effects) trackedEffects.add(e);
      for (const a of evalArgs) {
        const e = effectsOf(a);
        if (e) for (const lbl of e) trackedEffects.add(lbl);
      }
      const residual = makeExpr(fn, evalArgs);
      return trackedEffects.size > 0 ? withEffects(residual, trackedEffects) : residual;
    }
    const result = fn.fn(args, ctx, evalFn);
    // Pick up the primitive's own effect tags AND any effects already
    // attached to the result (e.g. via a withEffects call inside the impl).
    if (fn.effects) for (const e of fn.effects) trackedEffects.add(e);
    const resultEff = effectsOf(result);
    if (resultEff) for (const e of resultEff) trackedEffects.add(e);
    return trackedEffects.size > 0 ? withEffects(result, trackedEffects) : result;
  }

  // Eager: evaluate all args. D47 (B-094): at call sites of a source-aware
  // primitive, each evaluated argument carries its ORIGINATING AST on the
  // `source` channel (kernel origination — the only attachment authority).
  // Discharge logic reads the evaluated value; rendering / shape detection
  // reads the original. Zero cost at every other call site.
  const evalArgs = fn.sourceAware
    ? args.map(a => withSource(evaluate(a, ctx, depth + 1, depCollector), a))
    : args.map(a => evaluate(a, ctx, depth + 1, depCollector));
  // Stage F1: pre-compute the unioned effect set from the primitive's static
  // tags + each evaluated arg's `effects` component. Used by every return
  // path below so deferred computations carry their effects forward.
  const eagerEffSet: EffectSet = unionEffectSets(
    fn.effects ? new Set(fn.effects) : null,
    ...evalArgs.map(a => effectsOf(a)),
  );
  const attachEff = (v: Value): Value =>
    eagerEffSet.size > 0 ? withEffects(v, eagerEffSet) : v;
  // Stage F3: compile-time deferral. When PE is operating inside a function
  // body being precompiled (`ctx.__compileMode = true`) and the primitive
  // has its own effect tags, return a residual instead of executing. The
  // residual carries the effects component so callers see the inferred
  // set; the actual side effect fires when the function is invoked at
  // runtime (the call site's ctx isn't compile-mode). Pure primitives
  // still fold eagerly — only effectful ones defer.
  if (scopeCompileMode(ctx) && fn.effects && fn.effects.length > 0) {
    return attachEff(makeExpr(fn, evalArgs));
  }
  // Viral channels (propagation table): today just `error` — see viralScan.
  // C4.3a (R1): runs BEFORE the unresolved-residual early return, so the
  // channel rides every hop of a residual chain instead of being lost after
  // the first (the legacy first-hop-only behavior was a bug, not a policy —
  // see differential fixtures err-viral-chain / err-through-method).
  const viralHit = viralScan(evalArgs, fn);
  if (viralHit) return attachEff(viralHit);
  if (!evalArgs.every(isResolved)) {
    const residual = makeExpr(fn, evalArgs);
    // Even though args aren't fully resolved, their type components
    // may be known. Use type-level dispatch to infer the result type.
    // C4.3b: flattened Contexts carry the type channel too.
    if (evalArgs[0]?.kind === ValueKind.Structure) {
      const typeComp = channelReadRaw(evalArgs[0], "type");
      if (typeComp && typeComp.kind === ValueKind.Structure) {
        const methodName = PRIM_TO_METHOD.get(fn.name);
        if (methodName) {
          // Propagate left operand's type as the residual's type.
          // For comparisons this is imprecise (should be Bool), but the
          // correct type will be determined when the expression fully evaluates.
          return attachEff(makeMultiValue(residual, new Map([["type", typeComp]])));
        }
      }
    }
    return attachEff(residual);
  }

  // Phase B: refinement-domain propagation. If the primitive is one of
  // bits_add / bits_sub / bits_mul and the operands carry abstract domains
  // (from refined types or literal values), compute the output domain so
  // downstream operations inherit the proof context.
  const propagatedSet = propagateSetForPrimitive(fn.name, evalArgs);

  // E1 (B-027, §7/D37): `==` and `!=` resolve through the EQUALITY
  // PROTOCOL when both operands are typed — shape resolution (equality
  // shape = full refinement-peel; distinct types don't unify), custom
  // `equals` dispatch, kernel structural equals for structures. Total:
  // typed Bool out, never a host crash, on any kind pair. Declines
  // (null) for untyped operands — base-mode bits_eq semantics keep.
  if (fn.name === "bits_eq" || fn.name === "bits_neq") {
    const r = protocolEquals(evalArgs[0], evalArgs[1], fn.name === "bits_neq", ctx, evalFn);
    if (r) {
      const out = attachEff(r);
      return propagatedSet ? withPredicates(out, propagatedSet) : out;
    }
  }

  // Type-directed dispatch: if the first arg has a type with a matching method,
  // dispatch through the type instead of calling the base primitive directly.
  // This enables operator overloading (e.g., String + String = concatenation).
  // C4.3b: flattened Contexts (typed records/arrays) dispatch too.
  if (evalArgs[0]?.kind === ValueKind.Structure) {
    const typeComp = channelReadRaw(evalArgs[0], "type");
    if (typeComp && typeComp.kind === ValueKind.Structure) {
      const methodName = PRIM_TO_METHOD.get(fn.name);
      if (methodName) {
        // B-097 V2 (V-R1): operator dispatch goes through the SAME
        // availability gate as dot access — the formerly deferred C3.2
        // item. An occurrence bound that lacks the operator member
        // denies, exactly as `x.add` would (conscious delta 3).
        assertMemberAvailable(evalArgs[0], methodName, typeComp as ContextValue);
        // C3.1 (D36): dispatch reads the SHAPE. Member-transparent
        // refinement layers share the parent's member set, so walking them
        // off never changes which method runs; preserveOps/mixin layers
        // mint their own members and ARE shapes (their overrides run).
        const opShape = typeShape(typeComp as ContextValue);
        // B-097 V3 (D41 stage 3): kernel mediation covers operators too —
        // `a + b` on a type whose `add` is private denies outside the
        // defining scope, exactly as `a.add` would.
        assertMemberReachable(opShape, methodName, ctx);
        const method = typeMethod(opShape, methodName);
        if (method?.kind === ValueKind.PrimitiveFunction) {
          const primaryArgs = evalArgs.map(dataOf);
          const result = (method as import("./types.js").PrimitiveFunctionValue).fn(primaryArgs, ctx, evalFn);
          // If the method already returned a typed value (MultiValue), use it as-is.
          // Methods know their return types (e.g., comparisons return Bool).
          let out: Value;
          if (result.kind === ValueKind.Structure) out = result;
          else if (result.kind === ValueKind.Bits)  out = makeMultiValue(result, new Map([["type", typeComp]]));
          else                                       out = result;
          out = attachEff(out);
          return propagatedSet ? withPredicates(out, propagatedSet) : out;
        }
        // B-092 U1: USER-DEFINED types get operator overloading too — a
        // `Type.define` spec's method impls are ComposedFunctions, and
        // this path previously handled only host-primitive methods, so
        // `q1 + q2` on a record type fell through to raw bits_add.
        // Dispatch the same way type_dispatch does for method members:
        // self is the first parameter, full values (channels intact).
        const mData = method != null ? dataOf(method) : undefined;
        if (mData?.kind === ValueKind.ComposedFunction) {
          // B-097 V3: a composed operator member is the type's own code —
          // its body runs with the type's member privilege planted.
          const out = attachEff(evalFn(makeExpr(mData, evalArgs), typePrivilegedCtx(opShape, ctx)));
          return propagatedSet ? withPredicates(out, propagatedSet) : out;
        }
      }
    }
  }

  // C4.3c (R4): TRANSPARENCY — eager impls receive the full values,
  // channels intact, and read data through the accessors (dataOf/asBits
  // are identity-or-unwrap). The boundary no longer strips; the
  // propagation table alone governs channels. This also retires the
  // C1.5 `channelAware` registration mode (it is now everyone's default)
  // and the "register lazy to dodge stripping" idiom — lazy is purely an
  // evaluation-control choice again.
  if (typeof fn.fn !== "function") {
    throw new AllegroError(`applyPrimitive: ${fn.name} has unresolved stub (fn=null). Check resolvePrimitives.`);
  }
  const result = fn.fn(evalArgs, ctx, evalFn);

  // Type propagation: if the first arg had a type and the result is Bits,
  // propagate the type to the result.
  let out: Value;
  if (result.kind === ValueKind.Bits
      && evalArgs[0]?.kind === ValueKind.Structure) {
    const typeComp = channelReadRaw(evalArgs[0], "type");
    if (typeComp) out = makeMultiValue(result, new Map([["type", typeComp]]));
    else          out = result;
  } else {
    out = result;
  }
  // Stage F1: union the primitive's tags + arg effects (computed at the top
  // of the function) + any effects the result itself carries from method
  // dispatch. Attach via `withEffects` so consumers read through `effectsOf`.
  const resultEff = effectsOf(out);
  if (resultEff && resultEff.size > 0) {
    for (const e of resultEff) eagerEffSet.add(e);
  }
  out = attachEff(out);
  return propagatedSet ? withPredicates(out, propagatedSet) : out;
}


// --- C1.5 propagation table: generic viral scan ---
//
// Consults the channel registry: any component-plane channel registered
// `viral` short-circuits the primitive when present on an arg — first arg
// wins, the channel (plus the arg's shape) is carried onto the residual.
// Today `error` is the only viral channel, so behavior is byte-identical
// to the former hand-rolled loop (differential fixtures pin it); a newly
// registered viral channel gets this path with zero evaluator changes.
// Table linkage for the grandfathered/bespoke rules lives in
// assertPropagationTableLinkage below.
function viralScan(evalArgs: Value[], residualFn: Value): Value | null {
  const viral = viralChannels();
  for (const arg of evalArgs) {
    // C4.3b: flattened Contexts carry channels too.
    if (arg.kind !== ValueKind.Structure) continue;
    for (const chan of viral) {
      const comp = channelReadRaw(arg, chan);
      if (comp) {
        const components = new Map<string, Value>([[chan, comp]]);
        const typeComp = channelReadRaw(arg, "type");
        if (typeComp) components.set("type", typeComp);
        return makeMultiValue(makeExpr(residualFn, evalArgs), components);
      }
    }
  }
  return null;
}

// The rules the evaluator still implements bespoke (shape/knowledge:
// `computed` — domain logic IS the rule; effects: `union`, grandfathered on
// its dedicated path until C4.3; discharged: `drop` — never propagates,
// verified by forgery test C). If the registry drifts from what this file
// implements, fail loudly at startup.
(function assertPropagationTableLinkage() {
  const expect: [string, string][] = [
    ["error", "viral"], ["effects", "union"], ["shape", "computed"],
    ["predicates", "computed"], ["domain", "computed"], ["discharged", "drop"],
  ];
  for (const [chan, rule] of expect) {
    const spec = channelSpec(chan);
    if (!spec || spec.rule !== rule) {
      throw new Error(`propagation-table linkage: evaluator implements '${chan}' as ${rule}, registry says ${spec?.rule ?? "unregistered"}`);
    }
  }
})();

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

    // Viral channels (propagation table): today just `error` — see viralScan.
    const viralHit = viralScan(evalArgs, currentFn as unknown as Value);
    if (viralHit) return viralHit;

    // Type variable unification
    let enrichedCtx = ctx;
    let inferredReturnType: Value | null = null;
    if (currentFnRaw && isCarrier(currentFnRaw)) {
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
            // C2.1: O(1) child layer over the call ctx — replaces the
            // former flatten-copy of every inherited binding. Compile-mode
            // reads are chain-aware (scopeCompileMode), so no flag copying.
            enrichedCtx = scopeExtend(
              ctx,
              [...bindings].map(([varName, typeVal]) =>
                [varName, { key: varName, value: typeVal }] as [string, import("./types.js").Binding]
              ),
            );
            if (returnTypeExpr && (returnTypeExpr.kind === ValueKind.Param || returnTypeExpr.kind === ValueKind.Symbol)) {
              inferredReturnType = resolveTypeWithBindings(returnTypeExpr, bindings);
            }
          }
          // Call-site type checking: verify args match param types
          // (after unification, so type variables are resolved)
          for (let i = 0; i < Math.min(evalArgs.length, paramTypes.length); i++) {
            const resolvedParamType = resolveTypeWithBindings(paramTypes[i], bindings);
            if (resolvedParamType.kind !== ValueKind.Structure) continue; // unresolved type var
            checkArgType(evalArgs[i], resolvedParamType as ContextValue, i, enrichedCtx, depth, depCollector);
            // C3.2 (D36): the annotation is a knowledge upper-bound — the
            // param crossing is an abstraction boundary. Stamp (widening)
            // or reset (own-shape) the occurrence bound on the value that
            // gets substituted into the body.
            evalArgs[i] = applyBoundaryBound(evalArgs[i], resolvedParamType as ContextValue);
            // Stage D — Surface C call-site enforcement (F2): when the
            // param-type slot has no `__effectBound` but `param_effects
            // f: pure` stamped an effect bound onto the Param.effectBound
            // slot, run the same actual ⊆ bound discharge so Surface C
            // matches Surface A's rejection of mismatched callbacks. F2
            // reads effects directly from the arg's `effects` MultiValue
            // component (PE-populated) rather than via the predicate-set
            // view. C7.2c: effect-VARIABLE params carry `effectVar` (a
            // declared reference, no bound labels), so `effectBound` here
            // is always concrete — the marker-sniffing skip is gone.
            const ptHasEffBound = getEffectBound(resolvedParamType) !== undefined;
            if (!ptHasEffBound && i < currentFn.params.length) {
              const surfaceCBound = (currentFn.params[i] as any).effectBound as EffectSet | undefined;
              if (surfaceCBound) {
                const argEff = effectsOf(evalArgs[i]) ?? new Set<string>();
                const boundDom: EffectsDomain = { kind: "effects", labels: surfaceCBound };
                const actualDom: EffectsDomain = { kind: "effects", labels: argEff };
                if (!impliesDomain(actualDom, boundDom)) {
                  const want = [...surfaceCBound].sort().join(", ") || "pure";
                  const got  = [...argEff].sort().join(", ") || "pure";
                  throw new AllegroError(
                    `Type error: argument ${i} expected effect bound \`${want}\` (from param_effects), got effects \`${got}\``,
                  );
                }
              }
            }
          }
        }
      }
    }

    // B-018 T-R6: the recursion inlining cutoff. PE inlines a call by
    // substituting args into the body and re-evaluating. With an
    // unresolved argument a RECURSIVE call cannot converge — the base
    // case is undecidable without a concrete argument — so unfolding it
    // only builds ever-larger expressions until MAX_DEPTH or the JS
    // stack gives out, and the result is discarded. Measured: 78.8s for
    // one divergent compile (33% of it GC) and 71.1s for a provably
    // TOTAL `factorial(n: NonNeg)`, the latter also emitting a spurious
    // `precompile-type-error`. Termination discharge is the wrong
    // predicate here; cycle membership is the right one.
    //
    // Only SPECULATIVE calls are cut. With every argument resolved this
    // is a real application — a `partial` function the program actually
    // calls must still run (and may legitimately diverge; that is what
    // the declaration opted into). Residualizing there would change
    // semantics, not just cost.
    if (
      inlineCutoff !== null &&
      evalArgs.some(a => !isResolved(a)) &&
      inlineCutoff(currentFn as unknown as Value)
    ) {
      const residual = makeExpr(currentFnRaw ?? currentFn, evalArgs);
      const calleeEffects = effectsOf(currentFn as unknown as Value);
      return calleeEffects ? withEffects(residual, calleeEffects) : residual;
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
    if (inferredReturnType && inferredReturnType.kind === ValueKind.Structure) {
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
    case ValueKind.Symbol:
      return value;
    case ValueKind.Structure: {
      // C7.1: carriers walk their primary; plain structures are inert.
      if (!isCarrier(value)) return value;
      const mv = value as MultiValueType;
      const newP = remapParams(mv.primary, paramMap);
      return newP === mv.primary ? value : makeMultiValue(newP, cloneComponents(mv));
    }
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
      const newFn: ComposedFunctionValue = { kind: ValueKind.ComposedFunction, params: value.params, body: newBody };
      if ((value as any).__genericParams) (newFn as any).__genericParams = (value as any).__genericParams;
      for (const k of PRESERVED_FN_META_KEYS) {
        if ((value as any)[k] !== undefined) (newFn as any)[k] = (value as any)[k];
      }
      return newFn;
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
    case ValueKind.Structure: {
      // C7.1: carriers walk their primary; plain structures are inert.
      if (!isCarrier(value)) return value;
      const mv = value as MultiValueType;
      const newP = subst(mv.primary, owner, posMap, seen);
      return newP === mv.primary ? value : makeMultiValue(newP, cloneComponents(mv));
    }
    case ValueKind.Bits:
    case ValueKind.PrimitiveFunction:
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
        predicates: p.predicates,
        effectBound: p.effectBound,
        effectVar: p.effectVar,
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
      // Preserve generic-param metadata across clones so Slice 2's
      // polymorphism resolution still works after substitution.
      if ((value as any).__genericParams) (newFn as any).__genericParams = (value as any).__genericParams;
      for (const k of PRESERVED_FN_META_KEYS) {
        if ((value as any)[k] !== undefined) (newFn as any)[k] = (value as any)[k];
      }
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

  }
}

// --- Context helpers ---

export function resolveInContext(ctx: ContextValue, name: string): Value | undefined {
  return scopeLookup(ctx, name)?.value;
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

  // Phase D1 Slice 2 Stage A (F2): effect-bound discharge. If the expected
  // type carries an `__effectBound` (an EffectsDomain attached at
  // construction by `buildEffect`), pull the arg's effects from its
  // `effects` MultiValue component (PE-populated in F1) and check actual ⊆
  // bound via the same `impliesDomain` path used for numeric refinements.
  // `opaque` has no bound — anything passes; we skip the check entirely.
  // Args without an effects component behave as pure.
  const effBound = getEffectBound(expected) as AbstractDomain | undefined;
  if (effBound && effBound.kind === "effects") {
    const argEff = effectsOf(arg) ?? new Set<string>();
    const actualDom: EffectsDomain = { kind: "effects", labels: argEff };
    if (!impliesDomain(actualDom, effBound)) {
      const expectedName = typeContextName(expected) ?? "<effect>";
      const actualLabels = [...argEff].sort().join(", ") || "pure";
      throw new AllegroError(
        `Type error: argument ${argIndex} expected effect bound \`${expectedName}\`, got effects \`${actualLabels}\``,
      );
    }
    return;
  }

  // Refinement type handling: if expected is a refined type, check the value
  // against the refinement's BASE (via __refines chain), then evaluate the predicate.
  // This allows a plain Int to satisfy PositiveInt if the predicate passes.
  const refinementPredicate = getPredicate(expected);
  if (refinementPredicate) {
    const base = getRefines(expected);
    if (base?.kind === ValueKind.Structure) {
      // Recurse on the base type (unwraps nested refinements)
      checkArgType(arg, base as ContextValue, argIndex, ctx, depth, depCollector);
      // Base check passed — evaluate the predicate (unless same refined type)
      const argType0 = getType(arg);
      if (argType0 !== expected && ctx && depth !== undefined) {
        const result = evaluate(makeExpr(refinementPredicate, [arg]), ctx, depth + 1, depCollector);
        const p = dataOf(result);
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

  // B-028 F2 (CE-R5, D11): a Future[T]-typed argument checks the
  // knowledge that HAS landed — its element type T — and defers the
  // rest with the value. Future[String] where Int is expected is a real
  // type error NOW; Future[Int] where Int (or a refinement of Int) is
  // expected flows into the body as a residual per PE Rule 1 — never a
  // premature throw at the boundary. The refinement predicate, which
  // needs the value, defers with it (checked at construction/annotation
  // sites when the value lands).
  const futEl = futureElementType(argType);
  if (futEl) {
    const elName = typeContextName(futEl);
    if (!elName || elName === "Any") return; // untyped future — defer entirely
    if (typeNameOnRefinesChain(expected, elName)) return; // shape fits — defer
    throw new AllegroError(
      `Type error: argument ${argIndex} expected ${expectedName}, got Future[${elName}] — ` +
      `the pending value's type cannot satisfy ${expectedName}`);
  }

  // Helper: evaluate refinement predicate on arg if expected type has one.
  // Short-circuits when argType is reference-equal to expected (same refined type).
  const checkRefinement = (): void => {
    const predicate = getPredicate(expected);
    if (!predicate) return;
    if (argType === expected) return; // same refined type — predicate already holds
    if (!ctx || depth === undefined) return; // no eval context — best-effort skip
    const result = evaluate(makeExpr(predicate, [arg]), ctx, depth + 1, depCollector);
    const p = dataOf(result);
    if (p.kind === ValueKind.Bits && p.data === 0n) {
      throw new AllegroError(`Type error: argument ${argIndex} failed refinement predicate for ${expectedName}`);
    }
    // If unresolved, best-effort accept (partial evaluation will retry)
  };

  const actualName = typeContextName(argType);
  if (actualName === expectedName) {
    // Names match — also check type args for generics (Array[Int] vs Array[String])
    const expectedArgs = getGenericArgs(expected);
    const actualArgs = getGenericArgs(argType);
    if (expectedArgs?.kind === ValueKind.Structure && actualArgs?.kind === ValueKind.Structure) {
      const expCtx = expectedArgs as ContextValue;
      const actCtx = actualArgs as ContextValue;
      const expLenV = getSlotCount(expCtx);
      const actLenV = getSlotCount(actCtx);
      const expLen = Number(expLenV?.kind === ValueKind.Bits ? (expLenV as any).data : 0n);
      const actLen = Number(actLenV?.kind === ValueKind.Bits ? (actLenV as any).data : 0n);
      for (let j = 0; j < Math.min(expLen, actLen); j++) {
        const expArg = indexGet(expCtx, j);
        const actArg = indexGet(actCtx, j);
        if (expArg?.kind === ValueKind.Structure && actArg?.kind === ValueKind.Structure) {
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
    const checkP = dataOf(checkResult);
    if (checkP.kind === ValueKind.Bits && checkP.data === 0n) {
      throw new AllegroError(`Type error: argument ${argIndex} expected ${expectedName}, got ${actualName}`);
    }
    checkRefinement();
    return;
  }

  // Use meta-type instanceof (Type's shape-aware check: nominal if both named, structural otherwise)
  const typeType = channelReadRaw(expected, "shape") as ContextValue | undefined;
  if (typeType) {
    const instanceofMethod = typeMethod(typeType, "instanceof");
    if (instanceofMethod?.kind === ValueKind.PrimitiveFunction) {
      const checkResult = instanceofMethod.fn([expected, arg], undefined as any, undefined as any);
      const checkP = dataOf(checkResult);
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
): { inferredReturnType: Value | null; inferredEffects: EffectSet | null; errors: string[] } {
  const errors: string[] = [];

  // Create typed placeholders for each param
  const placeholders: Value[] = [];
  for (let i = 0; i < fn.params.length; i++) {
    const param = fn.params[i];
    const paramType = i < paramTypes.length ? paramTypes[i] : null;

    if (paramType && paramType.kind === ValueKind.Structure) {
      // Typed param: create MultiValue(Param, type: paramType). If the type
      // is refined and carries an abstract domain (Phase B), seed the domain
      // on the placeholder so propagation rules fire during precompile.
      const components = new Map<string, Value>([["type", paramType]]);
      const dom = (paramType as any).__abstractDomain;
      if (dom && dom.kind !== "opaque") {
        const domCtx: ContextValue = makeContext();
        (domCtx as any).__abstractDomain = dom;
        components.set("domain", domCtx);
      }
      // F2: preserve effectBound/effectVar on the placeholder so PE's
      // Param-call residual path can attach the e-effect when the body
      // calls this param. Without this, polymorphic functions would lose
      // their declared effect variables during precompile.
      const innerParam = makeParamHelper(param.position, param._name);
      if (param.effectBound) (innerParam as any).effectBound = param.effectBound;
      if (param.effectVar !== undefined) (innerParam as any).effectVar = param.effectVar;
      const placeholder = makeMultiValue(innerParam, components);
      placeholders.push(placeholder);
    } else {
      // Untyped or type variable — leave as bare Param. Same
      // effectBound/effectVar copy so polymorphic params with no concrete
      // type annotation still propagate (C7.2c: declared effect variables
      // referencing __genericParams entries).
      const bare = makeParamHelper(param.position, param._name);
      if (param.effectBound) (bare as any).effectBound = param.effectBound;
      if (param.effectVar !== undefined) (bare as any).effectVar = param.effectVar;
      placeholders.push(bare);
    }
  }

  // Substitute typed placeholders into the body
  const substituted = substituteParams(fn, placeholders);

  // Partially evaluate the body
  // F3a: mark the ctx as compile-mode so applyPrimitive defers effectful
  // primitives. This prevents `print("trace")` inside a function body from
  // firing at compile time — the deferred residual still surfaces effects
  // upward via PE for inference, but the side effect waits until the
  // function is invoked at runtime (where ctx isn't compile-mode).
  // Restore on exit so the same compileCtx can be reused for other
  // bindings without leaking state.
  const wasCompileMode = (ctx as any).__compileMode;
  (ctx as any).__compileMode = true;
  try {
    let result: Value | TailCall = evaluate(substituted, ctx, 0);
    // Untyped functions like `forwarder(g, y) => apply(g, y)` produce a
    // TailCall at the body's top expression (markTailCalls flagged it).
    // applyComposed would normally consume the TailCall in its tco_loop,
    // but precompileFunction calls `evaluate` directly. Drive the loop
    // here so we land on a real Value whose effects component reflects
    // the tail-recursive call chain.
    let guard = 0;
    while (isTailCall(result)) {
      if (++guard > 10000) {
        errors.push("precompile tail-call loop exceeded bound");
        return { inferredReturnType: null, inferredEffects: null, errors };
      }
      const tc = result as TailCall;
      const next = substituteParams(tc.fn, tc.args);
      result = evaluate(next, ctx, 0);
    }
    const finalValue = result as Value;
    const inferredType = getType(finalValue);
    // Stage F1: read the body's accumulated effects from the result's
    // `effects` component (set by applyPrimitive's PE propagation) and
    // stash on the ComposedFunction so typed_function_impl can attach the
    // component to the function value's MultiValue. Caller (`precompileFunctions`
    // in runtime.ts) doesn't need to do anything extra; the next evaluation
    // of the typed_function expression picks up the stashed set.
    const inferredEffects = effectsOf(finalValue);
    if (inferredEffects && inferredEffects.size > 0) {
      (fn as any).__inferredEffects = inferredEffects;
    }
    return { inferredReturnType: inferredType, inferredEffects, errors };
  } catch (e: any) {
    // Compile-time type error detected
    errors.push(e.message);
    return { inferredReturnType: null, inferredEffects: null, errors };
  } finally {
    (ctx as any).__compileMode = wasCompileMode;
  }
}