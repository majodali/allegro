// Allegretto - Evaluator

import { renderExprSource, primitives } from "./primitives.js";
import {
  Value, ValueKind, ExpressionValue, StructureValue,
  ComposedFunctionValue, ParamValue,
  AllegroError, isResolved, makeExpr, withMeta, makeStructure,
  DepCollector, ownsParam, Metadata} from "./types.js";
import { propagateSetForPrimitive, withPredicates, PredicateSet } from "./refinements.js";
import { effectsOf, withEffects, unionEffectSets, EffectSet } from "./effects.js";
import { getConstruct } from "./slot-accessors.js";
import { metaReadRaw, cloneMeta, metaOf, metaFieldSpec, fieldChecks, CheckSite, dispatchers, CallBinding, viralOnto, mergeOverMeta, PRESERVED_FN_META_KEYS, withSource, carryMeta } from "./metadata.js";
import { scopeLookup, scopeCompileMode, scopeFactsFor } from "./scope.js";

const MAX_DEPTH = 10000;

// ALLEGRO_TRACE_DEPTH=1: print the body of the composed function being
// applied each time the evaluation depth first passes another 500 levels,
// so a runaway recursion names the Allegro functions on its chain (the JS
// stack only names the evaluator). B-151 D1 found a cross-module pattern
// capture this way.
const TRACE_DEPTH = typeof process !== "undefined" && !!process.env?.ALLEGRO_TRACE_DEPTH;
const TRACE_STEP = Math.max(1, Number(process.env?.ALLEGRO_TRACE_DEPTH) || 500);
let traceWaterline = TRACE_STEP;

// B-018 T-R6 (broadened): the recursion inlining cutoff hook. Injected
// per typed compilation from runtime.ts once the call-graph SCCs are
// known; answers, by function identity, whether a callee participates in
// a recursion cycle — self-recursive or mutual — regardless of its D34
// discharge tier. No new value slot, no new `__*` property, and absent
// (null) it is simply the pre-T-R6 behavior. B-112 C5 turned the two
// analogous probes in types-std into gated `installAnalysis` answers; this
// one is the same pattern (plan §9.7, finding 4) and should follow when
// the code is next touched.
let inlineCutoff: ((fn: Value) => boolean) | null = null;

/** Register the inlining cutoff (called per typed compilation). Pass
 *  null to clear it — an untyped compilation has no tier information and
 *  must not inherit the previous one's. */
export function setInlineCutoff(f: ((fn: Value) => boolean) | null): void {
  inlineCutoff = f;
}

// --- Evaluation stats (B-157 P10) ---
//
// `ALLEGRO_EVAL_STATS=1` prints one stderr line per run, at process exit,
// with deterministic counts of the evaluator's work; a sink receives one
// report per `evalSource` call (a program or a library). The shape mirrors
// the parse stats (`parseSource` in `src/grammar2/engine.ts`). Off, with no
// sink, nothing is counted: every counting site tests `evalStats` for null.

/** Counts of the evaluator's work. All are deterministic for a given
 *  program and library set. */
export interface EvalStats {
  /** `evaluate` calls. */
  evaluateCalls:        number;
  /** `applyComposed` calls (each TCO loop round is one more expansion, not
   *  one more call). */
  applyComposedCalls:   number;
  /** `applyPrimitive` calls. */
  applyPrimitiveCalls:  number;
  /** Bodies a composed function's application expanded (`substituteParams`
   *  then `evaluate`) while the precompile pass was running: its
   *  speculative inlining. */
  inlineExpansions:     number;
  /** Evaluations of a top-level binding's expression, by binding name.
   *  Only a binding whose expression computes (an application or a name)
   *  is watched; a literal value evaluates to itself and costs nothing. */
  bindingEvaluations:   Map<string, number>;
  /** Of `bindingEvaluations`, the ones made inside the precompile pass. */
  precompileBindingEvals: number;
}

/** One `evalSource` call's share: the counters' growth during the call,
 *  and the evaluations of that call's own top-level bindings. */
export interface EvalReport {
  source: string;
  stats:  EvalStats;
}

export type EvalStatsSink = (report: EvalReport) => void;

/** The evaluations of one watched binding, in one `evalSource` call. */
interface BindingTally { n: number; }

/** The run's counters. */
interface RunCounters {
  evaluateCalls: number; applyComposedCalls: number; applyPrimitiveCalls: number;
  inlineExpansions: number; precompileBindingEvals: number;
  /** Every binding watched in the run, for the exit line. */
  tallies: BindingTally[];
}
/** Null while nothing is counting. */
let evalStats: RunCounters | null = null;
/** A watched binding expression → its tally. */
let watchedBindings: WeakMap<object, BindingTally> = new WeakMap();
let inPrecompile = false;
let evalStatsSink: EvalStatsSink | null = null;
let exitLineRegistered = false;

/** Install a sink that receives every `evalSource` call's report. Returns
 *  the previous sink; `null` removes it. */
export function setEvalStatsSink(sink: EvalStatsSink | null): EvalStatsSink | null {
  const previous = evalStatsSink;
  evalStatsSink = sink;
  return previous;
}

/** `ALLEGRO_EVAL_STATS=1` (any value but empty or `0`). Guarded so the
 *  evaluator stays browser-compatible. */
function evalStatsSwitchOn(): boolean {
  if (typeof process === "undefined") return false;
  const v = process.env?.ALLEGRO_EVAL_STATS;
  return v !== undefined && v !== "" && v !== "0";
}

/** The one-line summary the switch prints for the run. Fields are
 *  `key=value` so `bench/load.ts` can read them back. `bindings` counts the
 *  watched top-level bindings of every program and library the run
 *  evaluated; `maxPerBinding` is the most times any one of them was
 *  evaluated; `reEvaluated` is how many were evaluated more than once. */
function formatRunStats(s: RunCounters): string {
  let total = 0, max = 0, again = 0;
  for (const t of s.tallies) {
    total += t.n;
    if (t.n > max) max = t.n;
    if (t.n > 1) again++;
  }
  return `eval-stats evaluates=${s.evaluateCalls} applyComposed=${s.applyComposedCalls}` +
    ` applyPrimitive=${s.applyPrimitiveCalls} inlineExpansions=${s.inlineExpansions}` +
    ` bindings=${s.tallies.length} bindingEvals=${total}` +
    ` precompileBindingEvals=${s.precompileBindingEvals}` +
    ` maxPerBinding=${max} reEvaluated=${again}`;
}

/** An open `evalSource` call's view of the counters. */
export interface EvalStatsFrame {
  source: string;
  start:  Omit<RunCounters, "tallies">;
  own:    Map<string, BindingTally>;
}

/** Called by `evalSource` on entry: starts counting when the switch is on
 *  or a sink is installed, and returns the frame `endEvalStats` closes.
 *  Null when nothing counts. */
export function beginEvalStats(source: string): EvalStatsFrame | null {
  const switchOn = evalStatsSwitchOn();
  if (!switchOn && evalStatsSink === null) return null;
  if (evalStats === null) {
    evalStats = {
      evaluateCalls: 0, applyComposedCalls: 0, applyPrimitiveCalls: 0,
      inlineExpansions: 0, precompileBindingEvals: 0, tallies: [],
    };
  }
  if (switchOn && !exitLineRegistered && typeof process !== "undefined" && typeof process.on === "function") {
    exitLineRegistered = true;
    process.on("exit", () => { if (evalStats !== null) console.error(formatRunStats(evalStats)); });
  }
  const s = evalStats;
  return {
    source,
    start: {
      evaluateCalls: s.evaluateCalls, applyComposedCalls: s.applyComposedCalls,
      applyPrimitiveCalls: s.applyPrimitiveCalls, inlineExpansions: s.inlineExpansions,
      precompileBindingEvals: s.precompileBindingEvals,
    },
    own: new Map(),
  };
}

/** Watch a top-level binding's expression: every later `evaluate` of that
 *  object counts as one evaluation of the binding. */
export function watchBindingExpr(frame: EvalStatsFrame, expr: Value, name: string): void {
  if (evalStats === null) return;
  const tally: BindingTally = { n: 0 };
  watchedBindings.set(expr, tally);
  frame.own.set(name, tally);
  evalStats.tallies.push(tally);
}

/** Mark the precompile pass (runtime.ts `precompileFunctions`). */
export function setEvalStatsPrecompile(on: boolean): void {
  inPrecompile = on;
}

/** Called by `evalSource` on return: hands the call's report to the sink.
 *  Counting stops once neither the switch nor a sink wants it. */
export function endEvalStats(frame: EvalStatsFrame | null): void {
  if (frame === null || evalStats === null) return;
  const s = evalStats;
  const own = new Map<string, number>();
  for (const [name, t] of frame.own) own.set(name, t.n);
  const report: EvalReport = {
    source: frame.source,
    stats: {
      evaluateCalls:          s.evaluateCalls - frame.start.evaluateCalls,
      applyComposedCalls:     s.applyComposedCalls - frame.start.applyComposedCalls,
      applyPrimitiveCalls:    s.applyPrimitiveCalls - frame.start.applyPrimitiveCalls,
      inlineExpansions:       s.inlineExpansions - frame.start.inlineExpansions,
      bindingEvaluations:     own,
      precompileBindingEvals: s.precompileBindingEvals - frame.start.precompileBindingEvals,
    },
  };
  if (evalStatsSink !== null) evalStatsSink(report);
  if (evalStatsSink === null && !evalStatsSwitchOn()) {
    evalStats = null;
    watchedBindings = new WeakMap();
  }
}

// --- Tail Call Optimization ---

/**
 * TailCall marker: returned by the evaluator when a tail-position call
 * to a ComposedFunction is detected. The enclosing applyComposed catches
 * it and loops instead of recursing.
 */
interface TailCall {
  tailCall: true;
  fn: ComposedFunctionValue;
  args: Value[];
  fnRaw?: Value;
}

export function isTailCall(v: any): v is TailCall {
  return v && v.tailCall === true;
}

function makeTailCall(fn: ComposedFunctionValue, args: Value[], fnRaw?: Value): TailCall {
  return { tailCall: true, fn, args, fnRaw };
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
    // A body wrapper's result IS the body's result: the wrapped expression
    // is in tail position too. The wrappers forward a TailCall sentinel
    // (type_check, ensures_check) or return their last argument's value
    // (seq, the *_attach passthroughs), so marking through them records
    // what already happens at runtime. B-151 A3: evaluateExpr now resolves
    // a sentinel that would escape an expression NOT in tail position, so
    // the `if` under a typed function's `type_check` has to carry the mark
    // itself, or the 100k-deep TCO through the wrapper is lost.
    // Only a branching expression (or a further wrapper) takes the mark
    // through a wrapper, never a bare call: `bad(n: Int): Int => bad(n)`
    // marked under its `type_check` would hand precompile a sentinel on
    // every pass and spin its tail-call loop to the bound, where today the
    // inline cutoff residualizes the speculative call at once.
    if (fn.kind === ValueKind.PrimitiveFunction) {
      const idx = forwardedArgIndex(fn.name, body.args.length);
      const inner = idx !== null ? body.args[idx] : null;
      if (inner && inner.kind === ValueKind.Expression && inner.fn.kind === ValueKind.PrimitiveFunction &&
          (isBranchingPrimitive(inner) || forwardedArgIndex(inner.fn.name, inner.args.length) !== null)) {
        markTailCalls(inner, seen);
      }
    }
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

/** Which argument of a body wrapper is the body whose value the wrapper
 *  hands back unchanged: the first for the check and attach wrappers, the
 *  last for `seq`. Null for anything else. */
function forwardedArgIndex(name: string, argCount: number): number | null {
  if (argCount === 0) return null;
  switch (name) {
    case "type_check":
    case "ensures_check":
    case "effects_attach":
    case "param_effects_attach":
    case "partial_attach":
    case "decreases_attach":
    case "total_attach":
    case "assume_terminates_attach":
    case "proven_attach":
      return 0;
    case "seq":
      return argCount - 1;
    default:
      return null;
  }
}

function isBranchingPrimitive(expr: ExpressionValue): boolean {
  const fn = expr.fn;
  if (fn.kind !== ValueKind.PrimitiveFunction) return false;
  return (fn.name === "eval_if" && expr.args.length === 3) ||
         (fn.name === "eval_when" && expr.args.length === 5);
}

/**
 * Mark the binders among a scope's `when` patterns (B-151 D1).
 *
 * A pattern written as a bare name is either a binder (`is x then …`) or a
 * reference to a value in scope (`is none`, `is Dog`, `is limit`), and the
 * two are told apart at run time by looking the name up in the EVALUATION
 * scope. For a library that scope is the calling file's, so a binding of
 * the same name there captured the library's binder: `is x and x
 * instanceof Duration` read the consumer's `x`, and when that `x` was the
 * value being built the match recursed without bound. The resolver knows
 * every name the module can see (`known`); a pattern name it cannot see is
 * a binder, and is marked as one here, before any consumer scope exists.
 * A name the module CAN see stays a Symbol and resolves at run time as
 * before (same-file names, including forward references, are dynamic).
 */
export function markPatternBinders(value: Value, known: Set<string>, seen: Set<Value> = new Set()): void {
  if (!value || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  switch (value.kind) {
    case ValueKind.Expression: {
      const fn = value.fn;
      if (fn.kind === ValueKind.PrimitiveFunction && fn.name === "eval_when" && value.args.length === 5) {
        const pat = value.args[1];
        if (pat.kind === ValueKind.Symbol && !known.has(pat.name)) {
          value.args[1] = makeExpr(primitives["when_bind"] as Value, []);
        }
      }
      markPatternBinders(value.fn, known, seen);
      for (const a of value.args) markPatternBinders(a, known, seen);
      return;
    }
    case ValueKind.ComposedFunction:
      markPatternBinders(value.body, known, seen);
      return;
    default:
      return;
  }
}

// --- Core evaluation ---

export function evaluate(
  value: Value, ctx: StructureValue, depth: number = 0, depCollector?: DepCollector,
): Value {
  if (depth > MAX_DEPTH) throw new AllegroError("Maximum evaluation depth exceeded");
  if (evalStats !== null) {
    evalStats.evaluateCalls++;
    const tally = watchedBindings.get(value);
    if (tally !== undefined) {
      tally.n++;
      if (inPrecompile) evalStats.precompileBindingEvals++;
    }
  }

  switch (value.kind) {
    case ValueKind.Bits:
    case ValueKind.PrimitiveFunction:
    case ValueKind.ComposedFunction:
      return value;

    case ValueKind.Structure:
      // Structures self-evaluate. B-121 C4 deleted the CARRIER arm that stood
      // here — it re-evaluated the wrapped value, because a residual under
      // metadata was still pending computation. A residual now carries its own
      // metadata as an Expression and is handled by that case; `mergeOverMeta`,
      // extracted from this arm at C2, is what it calls.
      return value;

    case ValueKind.Param:
      return value;

    case ValueKind.Symbol: {
      const resolved = scopeLookup(ctx, value.name);
      if (resolved?.value !== undefined) {
        let result = evaluate(resolved.value, ctx, depth + 1, depCollector);
        // B-121 C2: a Symbol carries its own metadata now (pre-C2 those
        // fields rode an enclosing carrier Structure and merged in the
        // Structure case). Lay them under the resolved value's own.
        const ownMeta = metaOf(value);
        if (ownMeta.size > 0) result = mergeOverMeta(new Map(ownMeta), result);
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
      // B-121 C2: as for Symbol — an Expression's own fields used to ride an
      // enclosing carrier. A TailCall sentinel passes through untouched.
      const ownMeta = metaOf(value);
      if (ownMeta.size > 0 && !isTailCall(result)) {
        return mergeOverMeta(new Map(ownMeta), result as Value);
      }
      return result as Value;
    }
  }
}

function evaluateExpr(
  expr: ExpressionValue, ctx: StructureValue, depth: number, depCollector?: DepCollector,
): Value | TailCall {
  const fnRaw = evaluate(expr.fn, ctx, depth + 1, depCollector);
  const fn = fnRaw;

  if (fn.kind === ValueKind.PrimitiveFunction) {
    const result = applyPrimitive(fn, expr.args, ctx, depth, depCollector);
    // A TailCall sentinel may leave an expression only when that expression
    // is itself in tail position, where the enclosing applyComposed loop
    // consumes it. `if` and `when` evaluate a branch thunk's BODY in place,
    // and markTailCalls marks every thunk body as a tail position (the mark
    // is what stops a typed recursive function's precompile from unfolding
    // forever), so a branching expression that is NOT in tail position —
    // `y = if c then f(x) else 0`, `print(if c then f(x) else 0)` — handed
    // the sentinel back as a value and every use of it crashed the
    // evaluator (B-151 A3 finding). Run the call here instead.
    if (isTailCall(result) && !(expr as any)._tailPosition) {
      return applyComposed(result.fn, result.args, ctx, depth, result.fnRaw, depCollector);
    }
    return result;
  }

  if (fn.kind === ValueKind.ComposedFunction) {
    if ((expr as any)._tailPosition) {
      const evalArgs = expr.args.map(a => evaluate(a, ctx, depth + 1, depCollector));
      return makeTailCall(fn, evalArgs, fnRaw);
    }
    return applyComposed(fn, expr.args, ctx, depth, fnRaw, depCollector);
  }

  // Context as function — constructor call via __construct.
  const fnCtx = fn.kind === ValueKind.Structure ? fn as StructureValue : null;
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
    const evar = fn.effectVar as string | undefined;
    const bound = fn.effectBound as Set<string> | undefined;
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
  // being dropped at the application hop. First hit wins (`viralOnto`, the
  // propagation table's rule, in the metadata unit since B-112's exit).
  const viral = viralOnto([fnRaw, ...evalArgs], residual);
  if (viral) return residualEffects ? withEffects(viral, residualEffects) : viral;
  return residualEffects ? withEffects(residual, residualEffects) : residual;
}

// --- Apply primitive ---

function applyPrimitive(
  fn: import("./types.js").PrimitiveFunctionValue,
  args: Value[],
  ctx: StructureValue,
  depth: number,
  depCollector?: DepCollector,
): Value {
  if (evalStats !== null) evalStats.applyPrimitiveCalls++;
  // Stage F1: track effects fired during this primitive's evaluation so we
  // can attach the union to the result via the `effects` MultiValue component.
  // For lazy primitives we wrap evalFn to harvest effects from each subcall;
  // for eager primitives we read effects off the evaluated args after the
  // fact (logic further down).
  const trackedEffects: EffectSet = new Set();
  const evalFn = (v: Value, c: StructureValue) => {
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
  // body being precompiled (`ctx.compileMode = true`) and the primitive
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
  const viralHit = viralOnto(evalArgs, makeExpr(fn, evalArgs));
  if (viralHit) return attachEff(viralHit);
  if (!evalArgs.every(isResolved)) {
    const residual = makeExpr(fn, evalArgs);
    // B-112 C3 (hook (a)): a residual's type is the dispatcher's to infer —
    // the base knows neither which primitives have typed methods nor what
    // the result type would be. First installed dispatcher to answer wins.
    for (const [, d] of dispatchers()) {
      const typed = d.primitive(fn, evalArgs, ctx, evalFn, residual);
      if (typed !== null) return attachEff(typed);
    }
    return attachEff(residual);
  }

  // Phase B: refinement-domain propagation. If the primitive is one of
  // bits_add / bits_sub / bits_mul and the operands carry abstract domains
  // (from refined types or literal values), compute the output domain so
  // downstream operations inherit the proof context.
  const propagatedSet = propagateSetForPrimitive(fn.name, evalArgs);

  // B-112 C3 (hook (a)): type-directed dispatch — the equality protocol
  // on `==`/`!=`, operator dispatch through a typed operand's method, the
  // availability and reachability gates, user-defined operator members —
  // is installed by the type channel and run here without the base knowing
  // what a type is. A dispatcher that declines returns null and the base
  // calls the primitive. With nothing installed (Allegretto alone) every
  // primitive runs as itself, which is the base's own semantics.
  for (const [, d] of dispatchers()) {
    const answered = d.primitive(fn, evalArgs, ctx, evalFn, null);
    if (answered !== null) {
      const out = attachEff(answered);
      return propagatedSet ? withPredicates(out, propagatedSet) : out;
    }
  }

  // C4.3c (R4): TRANSPARENCY — eager impls receive the full values,
  // metadata intact, and read data through the accessors (`asBits` and
  // friends narrow a kind; nothing peels). The boundary no longer strips; the
  // propagation table alone governs channels. This also retires the
  // C1.5 `metaAware` registration mode (it is now everyone's default)
  // and the "register lazy to dodge stripping" idiom — lazy is purely an
  // evaluation-control choice again.
  if (typeof fn.fn !== "function") {
    throw new AllegroError(`applyPrimitive: ${fn.name} has unresolved stub (fn=null). Check resolvePrimitives.`);
  }
  const result = fn.fn(evalArgs, ctx, evalFn);

  // Type propagation: if the first arg had a type and the result is Bits,
  // propagate the type to the result.
  // B-121 C2: two corrections. The argument guard was `kind === Structure`
  // meaning "carries a type"; and `result.kind === Bits` implied "untyped",
  // because a primitive returning a TYPED scalar returned a carrier. Both are
  // metadata questions now — `float(x)` returns a Float-typed Bits, which the
  // old shape would re-stamp with its argument's Int.
  let out: Value;
  if (result.kind === ValueKind.Bits
      && metaReadRaw(result, "type") === undefined
      && evalArgs[0] !== undefined) {
    const typeComp = metaReadRaw(evalArgs[0], "type");
    if (typeComp) out = withMeta(result, new Map([["type", typeComp]]));
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


// The rules this file still implements BESPOKE after B-112's exit, pinned
// against the registry so the two cannot drift silently: `effects` is
// `union` but rides its own inference path here (the primitive's static
// tags, Param bounds, the precompile stash — L2 labels the base constructs);
// `predicates`/`domain` are `computed` through refinements'
// `propagateSetForPrimitive`; `shape` is `computed` by the installed
// projection; `discharged` is `drop` and nothing carries it (forgery test
// C). The generic rules, `viral` and `union`-over-metadata, live in the
// metadata unit (`viralOnto`, `mergeOverMeta`). The bespoke `effects` and
// knowledge paths are the evaluator's two remaining L2 edges and are owned
// by B-146 (knowledge propagation; plan §9.8).
(function assertPropagationTableLinkage() {
  const expect: [string, string][] = [
    ["error", "viral"], ["effects", "union"], ["shape", "computed"],
    ["predicates", "computed"], ["domain", "computed"], ["discharged", "drop"],
  ];
  for (const [chan, rule] of expect) {
    const spec = metaFieldSpec(chan);
    if (!spec || spec.rule !== rule) {
      throw new Error(`propagation-table linkage: evaluator implements '${chan}' as ${rule}, registry says ${spec?.rule ?? "unregistered"}`);
    }
  }
})();

// --- Apply composed function ---

function applyComposed(
  fn: ComposedFunctionValue,
  args: Value[],
  ctx: StructureValue,
  depth: number,
  fnRaw?: Value,
  depCollector?: DepCollector,
): Value {
  let currentFn = fn;
  let currentArgs = args;
  let currentFnRaw = fnRaw;
  if (evalStats !== null) evalStats.applyComposedCalls++;

  // TCO loop: re-enters when a tail call to the same (or different) function is detected
  tco_loop: while (true) {
    const evalArgs = currentArgs.map(a => evaluate(a, ctx, depth + 1, depCollector));

    // Viral channels (propagation table): today just `error` — see viralScan.
    const viralHit = viralOnto(evalArgs, makeExpr(currentFn as unknown as Value, evalArgs));
    if (viralHit) return viralHit;

    // B-112 C3 (hook (a), maintainer ruling 2026-10-22): binding a callee's
    // declared constraints to its arguments — type-variable unification,
    // the per-argument checks, the boundary bound, the inferred return
    // type — is the type channel's and is installed. The base hands over
    // the check loop and takes back the context the body evaluates in,
    // the arguments as substituted, and a finisher for the result. A
    // callee declaring nothing binds nothing.
    let enrichedCtx = ctx;
    let binding: CallBinding | null = null;
    if (currentFnRaw) {
      for (const [, d] of dispatchers()) {
        const b = d.call(currentFn, currentFnRaw, evalArgs, enrichedCtx, {
          check: (arg, expected, argIndex, param, c) => checkArg(arg, expected, argIndex, param, c, depth, depCollector),
        });
        if (b) {
          enrichedCtx = b.ctx;
          for (let i = 0; i < b.args.length; i++) evalArgs[i] = b.args[i];
          binding = b;
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

    if (TRACE_DEPTH && depth >= traceWaterline) {
      traceWaterline = depth + TRACE_STEP;
      let body = "<unrenderable>";
      try { body = renderExprSource(currentFn.body).slice(0, 120).replace(/\n/g, " "); } catch { /* diagnostic only */ }
      console.error(`[evaluation depth ${depth}] ${body}`);
    }
    if (evalStats !== null && inPrecompile) evalStats.inlineExpansions++;
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

    return binding ? binding.result(result) : result;
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
    case ValueKind.Structure:
      // Structures are inert. B-121 C4: the carrier arm that walked `primary`
      // is deleted — an Expression carrying metadata is walked by its own case.
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
      const newFn: ComposedFunctionValue = carryMeta(value, { kind: ValueKind.ComposedFunction, params: value.params, body: newBody });
      if ((value as any).genericParams) (newFn as any).genericParams = (value as any).genericParams;
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
    case ValueKind.Structure:
      // Structures are inert — see `remapParams` above.
      return value;
    case ValueKind.Bits:
    case ValueKind.PrimitiveFunction:
      return value;

    case ValueKind.Param: {
      // Match by position for params this function OWNS (membership, not the
      // `owner` back-pointer — see `ownsParam`) or that are not yet claimed.
      if ((ownsParam(owner, value) || value.owner === null) && posMap.has(value.position)) {
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
      const newFn: ComposedFunctionValue = carryMeta(value, {
        kind: ValueKind.ComposedFunction,
        params: newParams,
        body: remappedBody,
      });
      for (const p of newFn.params) p.owner = newFn;
      // Preserve generic-param metadata across clones so Slice 2's
      // polymorphism resolution still works after substitution.
      if ((value as any).genericParams) (newFn as any).genericParams = (value as any).genericParams;
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

export function resolveInContext(ctx: StructureValue, name: string): Value | undefined {
  return scopeLookup(ctx, name)?.value;
}

// --- Call-site type checking ---

/**
 * Check an argument against its declared parameter type (B-112 C2, hook (b)).
 * The evaluator decides nothing here: it runs every installed field check
 * with a free reader and a site-bound evaluator, and each field's owner
 * decides (type-core: structure, generics, futures, refinement predicates;
 * effects: the effect bound). A declared constraint with no check installed
 * at all is a wiring error and fails loudly rather than passing silently.
 */
function checkArg(
  arg: Value,
  expected: StructureValue,
  argIndex: number,
  param: Value | undefined,
  ctx?: StructureValue,
  depth?: number,
  depCollector?: DepCollector,
): void {
  const site: CheckSite = {
    argIndex,
    param,
    evaluate: ctx && depth !== undefined
      ? (expr: Value) => evaluate(expr, ctx, depth + 1, depCollector)
      : undefined,
  };
  let ran = false;
  for (const [, check] of fieldChecks()) {
    ran = true;
    check(expected, arg, metaReadRaw, site);
  }
  if (!ran) {
    throw new AllegroError(`argument ${argIndex}: a parameter type is declared but no field check is installed (B-112 hook (b))`);
  }
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
  ctx: StructureValue,
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
      const meta = new Map<string, Value>([["type", paramType]]);
      const dom = (paramType as any).abstractDomain;
      if (dom && dom.kind !== "opaque") {
        const domCtx: StructureValue = makeStructure();
        (domCtx as any).abstractDomain = dom;
        meta.set("domain", domCtx);
      }
      // F2: preserve effectBound/effectVar on the placeholder so PE's
      // Param-call residual path can attach the e-effect when the body
      // calls this param. Without this, polymorphic functions would lose
      // their declared effect variables during precompile.
      const innerParam = makeParamHelper(param.position, param._name);
      if (param.effectBound) innerParam.effectBound = param.effectBound;
      if (param.effectVar !== undefined) innerParam.effectVar = param.effectVar;
      const placeholder = withMeta(innerParam, meta);
      placeholders.push(placeholder);
    } else {
      // Untyped or type variable — leave as bare Param. Same
      // effectBound/effectVar copy so polymorphic params with no concrete
      // type annotation still propagate (C7.2c: declared effect variables
      // referencing genericParams entries).
      const bare = makeParamHelper(param.position, param._name);
      if (param.effectBound) bare.effectBound = param.effectBound;
      if (param.effectVar !== undefined) bare.effectVar = param.effectVar;
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
  const wasCompileMode = (ctx as any).compileMode;
  (ctx as any).compileMode = true;
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
    // The base reads the field it carries and interprets nothing: a type
    // is whatever Structure the `type` field holds (hook (c)/B-145 own
    // the name; `viralScan` reads it the same way).
    const inferredTypeRaw = metaReadRaw(finalValue, "type");
    const inferredType = inferredTypeRaw?.kind === ValueKind.Structure ? (inferredTypeRaw as StructureValue) : null;
    // Stage F1: read the body's accumulated effects from the result's
    // `effects` component (set by applyPrimitive's PE propagation) and
    // stash on the ComposedFunction so typed_function_impl can attach the
    // component to the function value's MultiValue. Caller (`precompileFunctions`
    // in runtime.ts) doesn't need to do anything extra; the next evaluation
    // of the typed_function expression picks up the stashed set.
    const inferredEffects = effectsOf(finalValue);
    if (inferredEffects && inferredEffects.size > 0) {
      (fn as any).inferredEffects = inferredEffects;
    }
    return { inferredReturnType: inferredType, inferredEffects, errors };
  } catch (e: any) {
    // Compile-time type error detected
    errors.push(e.message);
    return { inferredReturnType: null, inferredEffects: null, errors };
  } finally {
    (ctx as any).compileMode = wasCompileMode;
  }
}