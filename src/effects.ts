// =============================================================================
// Allegro — Effect types (Phase D1 of the provability arc)
//
// Phase D is the *negative* aspect of provability — what code DOESN'T do.
// D1 starts the arc with extensible flat effect labels.
//
// An effect label is a plain string (`io`, `net`, `time`, `build-io`, …).
// Core defines none beyond the implicit `pure` (the empty set). Every
// other label is registered by the extension that provides the relevant
// primitives — stdlib registers `io` alongside `print`, networking
// extensions register `net` alongside `fetch`, and so on.
//
// A function's INFERRED effect set is the union of labels from every
// primitive the function transitively calls. The user can also DECLARE
// the effect set via the `effects` body-form clause (see `lib/effects.alg`);
// the analyzer checks that inferred ⊆ declared (over-promising is safe,
// under-promising is an error).
//
// Phase D2 will refine flat labels into parametric capabilities
// (`net[api.example.com:443]`) and per-module capability budgets — built
// on D1's substrate.
//
// See `previews/d1-effects.alg` for the design rationale and surface
// syntax.
// =============================================================================

import {
  Value, ValueKind, ComposedFunctionValue, ContextValue, MultiValueType,
  primaryOf, makeMultiValue, BitsValue, bitsToString,
} from "./types.js";
import {
  EffectsDomain, Predicate, PredicateSet, makePredicate,
} from "./refinements.js";

// =============================================================================
// EffectSet — a set of label strings.
// =============================================================================

/** A function's effect set: labels of all observable side effects.
 *  Empty set = `pure`. Order is irrelevant; comparisons are set-based. */
export type EffectSet = Set<string>;

export const PURE: EffectSet = new Set();

export function effectUnion(a: EffectSet, b: EffectSet): EffectSet {
  if (a.size === 0) return new Set(b);
  if (b.size === 0) return new Set(a);
  const out = new Set(a);
  for (const e of b) out.add(e);
  return out;
}

export function effectSubset(sub: EffectSet, sup: EffectSet): boolean {
  for (const e of sub) if (!sup.has(e)) return false;
  return true;
}

export function effectEquals(a: EffectSet, b: EffectSet): boolean {
  return a.size === b.size && effectSubset(a, b);
}

/** Render an EffectSet for human display. Empty → "pure"; otherwise
 *  alphabetised comma-separated labels. */
export function formatEffects(e: EffectSet): string {
  if (e.size === 0) return "pure";
  return [...e].sort().join(", ");
}

// =============================================================================
// `effects_attach` recognition
// =============================================================================
//
// The block preprocessor wraps a function body that has an `effects` clause
// with `effects_attach(real_body, declared_labels_array)`. The wrapper is
// transparent at runtime (returns the first arg) but visible to inference
// and introspection. Helpers below extract the wrapped body and the
// declared label list at compile time.

/** If `v` is `effects_attach(body, labels_array)`, return the inner body
 *  and the extracted label set. Otherwise null.
 *
 *  Typed function bodies are wrapped by `maybeTyped` in the tree-builder:
 *  `type_check(effects_attach(body, labels), returnType)`. Peel one layer of
 *  `type_check` so the declaration check fires on typed functions just like
 *  untyped ones — needed for Stage C3 polymorphic functions whose return
 *  type annotations always trigger the type_check wrap. */
export function unwrapEffectsAttach(v: Value): { body: Value; declared: EffectSet } | null {
  if (v.kind !== ValueKind.Expression) return null;
  let target = v;
  let fn = primaryOf(target.fn);
  if (fn.kind === ValueKind.PrimitiveFunction && fn.name === "type_check"
      && target.args.length >= 1
      && target.args[0].kind === ValueKind.Expression) {
    target = target.args[0] as any;
    fn = primaryOf(target.fn);
  }
  if (fn.kind !== ValueKind.PrimitiveFunction || fn.name !== "effects_attach") return null;
  if (target.args.length !== 2) return null;
  const declared = extractLabelArray(target.args[1]);
  return { body: target.args[0], declared };
}

/** Extract a set of label strings from a `typed_array(Symbol(L1), Symbol(L2), …)`
 *  Expression. Used to pull declared labels out of an effects_attach call's
 *  metadata argument. Unrecognised shapes silently yield an empty set —
 *  the analyzer treats that as "no declaration". */
function extractLabelArray(v: Value): EffectSet {
  const out: EffectSet = new Set();
  const e = primaryOf(v);
  if (e.kind !== ValueKind.Expression) return out;
  const fn = primaryOf(e.fn);
  if (fn.kind !== ValueKind.PrimitiveFunction || fn.name !== "typed_array") return out;
  for (const a of e.args) {
    const p = primaryOf(a);
    if (p.kind === ValueKind.Symbol) out.add(p.name);
    // Bits-encoded string literals would be `String "label"` — also accept.
    // (Not currently emitted by the grammar, but cheap to support.)
  }
  return out;
}

// =============================================================================
// Inference walker
// =============================================================================
//
// Compute the inferred effect set for a function value by walking its body
// and accumulating effects from every primitive call and every transitively
// called ComposedFunction. Cycles (self / mutual recursion) are broken via
// a seen-set; recursive self-calls contribute nothing extra (their effects
// come entirely from the body we're already walking).
//
// Limitation: mutual recursion may under-estimate — function f's effects
// computed first might miss effects from g that re-enter f. A fixpoint
// iteration would be sound; for D1 chunk 1 we accept the conservative
// approximation. The rare-in-practice case is documented; future work
// can switch to fixpoint when it bites.

/** Infer a function's effect set by walking its body. Used by the
 *  precompile pass (declaration check) and by introspection (display).
 *
 *  Optional `lookup` callback resolves source-binding `Symbol("name")`
 *  references encountered as call targets — necessary for cross-binding
 *  effect-variable resolution (Slice 2 Stage C2). When omitted, source
 *  Symbols are treated as opaque (the chunk-1 behaviour). Runtime call
 *  sites pass `(n) => evalCtx.bindings.get(n)?.value` so polymorphic
 *  functions defined in one binding propagate effects through callers.
 */
export type EffectsLookup = (name: string) => Value | undefined;

export function inferFunctionEffects(
  fn: ComposedFunctionValue,
  seen: Set<ComposedFunctionValue> = new Set(),
  lookup?: EffectsLookup,
): EffectSet {
  if (seen.has(fn)) return PURE;
  seen.add(fn);
  return walkValueEffects(fn.body, seen, lookup);
}


/** Compute the effects of a value being passed as a function argument — the
 *  effects it would produce if called. Used by Stage C2 to resolve
 *  `__effectvar:NAME` markers at call sites: walk the arg, get effects.
 *
 *  - ComposedFunction: recurse via `inferFunctionEffects`
 *  - PrimitiveFunction: read `.effects` directly
 *  - MultiValue: peel and retry
 *  - Param with predicates: pull effective effects (covers nested polymorphism)
 *  - Anything else (unresolved Symbol, untyped literal): conservative `opaque`
 */
function effectsOfFunctionArg(
  v: Value,
  seen: Set<ComposedFunctionValue>,
  lookup?: EffectsLookup,
): EffectSet {
  const p = primaryOf(v);
  // Peel `typed_function(fn, …)` call expressions — common for inline lambdas
  // with annotations like `(y: Int): Int => y * 2` which become a typed_function
  // call rather than a bare ComposedFunction at the AST level.
  if (p.kind === ValueKind.Expression) {
    const callTarget = primaryOf((p as any).fn);
    if (callTarget.kind === ValueKind.PrimitiveFunction
        && (callTarget as any).name === "typed_function"
        && (p as any).args.length >= 1) {
      return effectsOfFunctionArg((p as any).args[0], seen, lookup);
    }
  }
  if (p.kind === ValueKind.ComposedFunction) {
    return inferFunctionEffects(p, seen, lookup);
  }
  if (p.kind === ValueKind.Symbol && lookup) {
    const resolved = lookup((p as any).name);
    if (resolved) return effectsOfFunctionArg(resolved, seen, lookup);
  }
  if (p.kind === ValueKind.PrimitiveFunction) {
    const out = new Set<string>();
    if (p.effects) for (const e of p.effects) out.add(e);
    return out;
  }
  if (p.kind === ValueKind.Param) {
    // F2: read directly from Param.effectBound (was Param.predicates).
    const bound = (p as any).effectBound as EffectSet | undefined;
    if (bound) return new Set(bound);
  }
  // Unknown — conservative opaque.
  return new Set(["opaque"]);
}

/** Walk an arbitrary Value tree and accumulate the effects from its
 *  primitive calls and transitively-called functions. Used internally
 *  by inferFunctionEffects; exposed for tests. */
export function walkValueEffects(
  v: Value,
  seen: Set<ComposedFunctionValue>,
  lookup?: EffectsLookup,
): EffectSet {
  switch (v.kind) {
    case ValueKind.Bits:
    case ValueKind.Symbol:
    case ValueKind.Param:
    case ValueKind.Context:
    case ValueKind.PrimitiveFunction:
      return PURE;
    case ValueKind.ComposedFunction:
      // A function VALUE (not a call). Its effects fire only when invoked;
      // for the purpose of the enclosing function's effects, having a
      // closure literal in scope contributes nothing. Higher-order calls
      // (function passed in, then called somewhere) are out of scope for
      // D1 chunk 1 — they'll need analysis through call sites in chunk 2.
      return PURE;
    case ValueKind.MultiValue:
      return walkValueEffects(v.primary, seen, lookup);
    case ValueKind.Expression: {
      // Special-case effects_attach: skip the metadata arg, walk the body.
      let fn0 = primaryOf(v.fn);
      // Slice 2 Stage C2: resolve source-binding Symbol call targets via
      // optional lookup. Without this, cross-binding polymorphism inference
      // can't follow `apply` from `forwarder`'s body to apply's value.
      if (fn0.kind === ValueKind.Symbol && lookup) {
        const resolved = lookup((fn0 as any).name);
        if (resolved) fn0 = primaryOf(resolved);
      }
      if (fn0.kind === ValueKind.PrimitiveFunction && fn0.name === "effects_attach") {
        if (v.args.length === 2) return walkValueEffects(v.args[0], seen, lookup);
      }
      let result: EffectSet = new Set();
      // Effects from the function being called.
      if (fn0.kind === ValueKind.PrimitiveFunction) {
        if (fn0.effects) for (const e of fn0.effects) result.add(e);
        // F3b: the type_dispatch HOF special-case is no longer needed.
        // PE-driven propagation (F1) + polymorphic Param-call handling
        // (F2c) flow `arr.map(cb)`'s callback effects through `mapAllegro`'s
        // body without the conservative opaque marker. The walker still
        // needs to honor the receiver's type-dispatch resolution when it
        // shows up — but that's covered by recursing into v.fn below.
      } else if (fn0.kind === ValueKind.ComposedFunction) {
        // Phase D1 Slice 2 Stage C2: effect-variable resolution. The callee
        // may have stamped `__effectvar:NAME` markers in its inferred set
        // (one per effect-variable param). Resolve each marker by walking
        // the corresponding arg as a function value — its effects flow into
        // the caller's set in place of the marker.
        const effectVarParams = (fn0 as any).__effectVarParams as Map<string, number[]> | undefined;
        const calleeEffects = inferFunctionEffects(fn0, seen, lookup);
        for (const lbl of calleeEffects) {
          if (effectVarParams && lbl.startsWith("__effectvar:")) {
            const varName = lbl.slice("__effectvar:".length);
            const positions = effectVarParams.get(varName);
            if (positions) {
              for (const pos of positions) {
                if (pos < v.args.length) {
                  const argEff = effectsOfFunctionArg(v.args[pos], seen, lookup);
                  for (const e of argEff) result.add(e);
                }
              }
              continue;
            }
          }
          result.add(lbl);
        }
      } else if (fn0.kind === ValueKind.Param) {
        // Phase D1 Slice 2 Stage B (F2): function-typed param being called.
        // Read its declared effect bound from `Param.effectBound` directly
        // (migrated from `Param.predicates` in F2). Without a bound, we
        // treat it as opaque — honest about the unknown rather than
        // silently zero-effect.
        const bound = (fn0 as any).effectBound as EffectSet | undefined;
        if (bound) {
          for (const l of bound) result.add(l);
        } else {
          result.add("opaque");
        }
      }
      // If `v.fn` is itself a complex expression (e.g. a `type_dispatch` call
      // producing a bound method, an `if-then-else` choosing between funcs,
      // a higher-order pipeline), walk it too so its constituent effects are
      // collected. Without this, `arr.map(cb)` would lose Array.map's tag
      // entirely because the call's `fn` is an Expression rather than a
      // direct PrimitiveFunction reference.
      if (v.fn.kind === ValueKind.Expression) {
        for (const e of walkValueEffects(v.fn, seen, lookup)) result.add(e);
      }
      // Effects from evaluating each argument (since they may contain
      // primitive calls themselves — Allegro is eager for non-lazy prims).
      for (const arg of v.args) {
        const argEffects = walkValueEffects(arg, seen, lookup);
        for (const e of argEffects) result.add(e);
      }
      return result;
    }
  }
}

// =============================================================================
// Effects mismatch — error type for failed declaration check
// =============================================================================

export interface EffectsMismatch {
  binding:  string;
  declared: EffectSet;
  inferred: EffectSet;
  /** Labels in inferred but not in declared — the under-promised set. */
  missing:  EffectSet;
}

export function formatMismatch(m: EffectsMismatch): string {
  return `effects mismatch in ${m.binding}: declared \`${formatEffects(m.declared)}\`, ` +
         `inferred \`${formatEffects(m.inferred)}\` ` +
         `(undeclared: ${formatEffects(m.missing)})`;
}

/** Compute the missing labels (inferred \\ declared). Empty if declared
 *  is a superset of inferred. */
export function effectDifference(inferred: EffectSet, declared: EffectSet): EffectSet {
  const missing: EffectSet = new Set();
  for (const e of inferred) if (!declared.has(e)) missing.add(e);
  return missing;
}

// =============================================================================
// Top-level declaration check
// =============================================================================
//
// Walk every binding in a context; for each ComposedFunction (or MultiValue
// wrapping one) whose body is wrapped in `effects_attach(body, labels)`,
// compute the inferred set and verify inferred ⊆ declared. Returns the
// list of mismatches; callers decide whether to throw or just record.

/** Locate a ComposedFunction inside a value, peeling MultiValue wrappers
 *  (typed-function envelope) and `typed_function(fn, …)` call expressions.
 *
 *  Source bindings often arrive at compile-time as unevaluated Expressions of
 *  the shape `typed_function(ComposedFunction(...), paramCount, paramTypes...,
 *  returnType)` — even though by runtime they evaluate to a MultiValue
 *  wrapping the inner function. This helper walks both shapes so the
 *  declaration check fires on declared functions before evaluation, not only
 *  after. Slice 2 Stage C3: covers polymorphic functions whose declared
 *  effect sets need to be checked at compile time, not deferred to a callsite. */
function asFunction(v: Value): ComposedFunctionValue | null {
  const p = primaryOf(v);
  if (p.kind === ValueKind.ComposedFunction) return p;
  if (p.kind === ValueKind.Expression) {
    const target = primaryOf(p.fn);
    if (target.kind === ValueKind.PrimitiveFunction
        && (target as any).name === "typed_function"
        && p.args.length >= 1) {
      return asFunction(p.args[0]);
    }
  }
  return null;
}

// =============================================================================
// Predicate-set bridge (Phase D1 sub-chunk 1.2)
// =============================================================================
//
// The chunk-1 representation stores effect data via two channels: a body wrap
// (`effects_attach(body, labels)`) for declared sets, and a transitive walk
// (`inferFunctionEffects`) for inferred sets. Sub-chunk 1.2 lifts both into
// PredicateSet entries so introspection, asserts, and (in Slice 2) HOF
// annotations see a single uniform "facts about this binding" surface.
//
// The underlying chunk-1 storage is unchanged — this layer derives predicates
// on demand. Storage migration (replacing `effects_attach` with a direct
// predicate attachment on the function MultiValue) is deferred to Slice 2,
// where it interacts with the param-effect-bound work.

/** Build a `PredicateSet` view of a function's effect data: one predicate per
 *  source (declared / inferred), shape = EffectsDomain over the underlying
 *  flat label set. Returns an empty set if the function has neither a declared
 *  bound nor any inferred effects. */
export function effectPredicatesForFunction(fn: ComposedFunctionValue): PredicateSet {
  const preds: Predicate[] = [];
  const wrap = unwrapEffectsAttach(fn.body);
  if (wrap) {
    const dom: EffectsDomain = { kind: "effects", labels: new Set(wrap.declared) };
    preds.push(makePredicate(dom, "effects-declared"));
  }
  const inferred = inferFunctionEffects(fn);
  // Always emit an inferred predicate (even when empty = pure) so consumers
  // can distinguish "no inference run" from "inference produced pure". This
  // mirrors how introspection's three render formats treat the inferred set
  // as always present for function values.
  const infDom: EffectsDomain = { kind: "effects", labels: new Set(inferred) };
  preds.push(makePredicate(infDom, "effects-inferred"));
  return new PredicateSet(preds);
}

/** Locate the effects declaration on a function value (peeling typed-function
 *  envelope) and return its `PredicateSet`. Convenience wrapper that handles
 *  the common MultiValue-wrapped function case. */
export function effectPredicatesForValue(v: Value): PredicateSet | null {
  const p = primaryOf(v);
  if (p.kind !== ValueKind.ComposedFunction) return null;
  return effectPredicatesForFunction(p);
}

/** For each named binding in `ctx`, if it's a function with an `effects`
 *  declaration, check inferred ⊆ declared and collect mismatches.
 *
 *  Phase D1 sub-chunk 1.3: `"opaque"` labels in the inferred set come from
 *  stdlib HOFs (Array.map, etc.) until Slice 2's effect polymorphism lands.
 *  They're filtered from the mismatch computation here so callers' explicit
 *  `effects pure` declarations don't fail spuriously; an opaque-only inferred
 *  set is surfaced via a notification instead (see `opaqueEffectNotices`). */
export function checkEffectsDeclarations(
  bindings: Iterable<{ key: string | null; value: Value | undefined }>,
): EffectsMismatch[] {
  const mismatches: EffectsMismatch[] = [];
  for (const b of bindings) {
    if (!b.key || !b.value) continue;
    const fn = asFunction(b.value);
    if (!fn) continue;
    const wrap = unwrapEffectsAttach(fn.body);
    if (!wrap) continue;
    // F2: prefer the PE-stashed inferred set (`__inferredEffects`, set by
    // precompileFunction) over running the walker. Fall back to the walker
    // for legacy paths that didn't precompile (rare in practice — every
    // typed function definition goes through precompileFunctions).
    const stashed = (fn as any).__inferredEffects as EffectSet | undefined;
    const inferred = stashed ?? inferFunctionEffects(fn);
    const inferredHard = new Set(inferred);
    inferredHard.delete("opaque");
    // Slice 2 Stage C3: polymorphic declarations like `effects e` for a
    // function declared `[e: Effect]` see the walker's symbolic marker
    // `__effectvar:e` in the inferred set. Normalise the marker to its bare
    // name (`e`) so the declared set's symbolic labels match. The marker
    // form is only meaningful at call sites where it resolves to actual
    // effect labels — at definition time the bare name is the contract.
    for (const lbl of [...inferredHard]) {
      if (lbl.startsWith("__effectvar:")) {
        const bare = lbl.slice("__effectvar:".length);
        inferredHard.delete(lbl);
        inferredHard.add(bare);
      }
    }
    const missing = effectDifference(inferredHard, wrap.declared);
    if (missing.size > 0) {
      mismatches.push({
        binding:  b.key,
        declared: wrap.declared,
        inferred,
        missing,
      });
    }
  }
  return mismatches;
}

/** Phase D1 sub-chunk 1.3: scan bindings for functions whose inferred effect
 *  set carries `"opaque"` (introduced by stdlib HOFs). Returns one notice per
 *  binding so the runtime can surface them in `CompilationReport.notifications`.
 *  Independent of whether the function has an `effects` declaration. */
export function opaqueEffectNotices(
  bindings: Iterable<{ key: string | null; value: Value | undefined }>,
): { binding: string; message: string }[] {
  const notices: { binding: string; message: string }[] = [];
  for (const b of bindings) {
    if (!b.key || !b.value) continue;
    const fn = asFunction(b.value);
    if (!fn) continue;
    const inferred = inferFunctionEffects(fn);
    if (!inferred.has("opaque")) continue;
    notices.push({
      binding: b.key,
      message: `inferred effects include 'opaque' (likely from a stdlib HOF call); will refine in Slice 2 once effect polymorphism lands`,
    });
  }
  return notices;
}

// =============================================================================
// Effects-as-component substrate (Stage F1)
// =============================================================================
//
// Effects live as a first-class MultiValue component named `"effects"`,
// alongside `type` and `error`. This separates them from refinement predicates
// (which describe data) — effects describe COMPUTATIONS (functions and
// deferred residuals).
//
// PE propagates the component through `applyPrimitive`: a primitive carrying
// `effects: ["io"]` produces a result whose `effects` component is `{io}`,
// unioned with any effects already present on its evaluated args. Lazy
// primitives accumulate via a tracking `evalFn` wrapper so seq / eval_if /
// other branchers naturally propagate without per-primitive bookkeeping.
//
// Storage mirrors `withPredicates`: the component value is a Context with a
// JS-side `__effectSet` field. Encoding is hidden behind `withEffects` /
// `effectsOf`; consumers shouldn't reach into the component directly.

export const EFFECTS_COMPONENT_KEY = "effects";

function encodeEffects(eff: EffectSet): Value {
  const ctx: ContextValue = {
    kind: ValueKind.Context,
    bindings: new Map(),
    bindingList: [],
  };
  (ctx as any).__effectSet = eff;
  return ctx;
}

function decodeEffects(v: Value): EffectSet | null {
  if (v.kind !== ValueKind.Context) return null;
  const set = (v as any).__effectSet as EffectSet | undefined;
  return set ?? null;
}

/** Read a value's effect set from its `effects` component. Returns null when
 *  the value carries no effect annotation (treat as `pure` at consumer
 *  discretion — most consumers want a defined-but-empty set rather than
 *  null). */
export function effectsOf(v: Value): EffectSet | null {
  if (v.kind !== ValueKind.MultiValue) return null;
  const c = (v as MultiValueType).components.get(EFFECTS_COMPONENT_KEY);
  return c ? decodeEffects(c) : null;
}

/** Read effects with a walker fallback for functions whose effects component
 *  isn't populated (e.g. untyped functions that didn't go through the
 *  typed-function precompile path). The component is the canonical source
 *  in F2; this helper exists to bridge legacy producers during the migration
 *  and will narrow to plain `effectsOf` once every function value carries
 *  its effects component. */
export function effectsOfWithFallback(v: Value): EffectSet | null {
  const direct = effectsOf(v);
  if (direct !== null) return direct;
  const p = primaryOf(v);
  if (p.kind === ValueKind.ComposedFunction) {
    return inferFunctionEffects(p);
  }
  return null;
}

/** Attach an effect set as a MultiValue component, unioning with any prior
 *  set on the value. No-op when `eff` is empty AND the value has no prior
 *  effects (to avoid wrapping pure values in MultiValues unnecessarily). */
export function withEffects(v: Value, eff: EffectSet): Value {
  const prior = effectsOf(v);
  if (eff.size === 0 && prior === null) return v;
  const merged = prior ? effectUnion(prior, eff) : eff;
  if (merged.size === 0) return v;
  const existing = v.kind === ValueKind.MultiValue ? v.components : new Map<string, Value>();
  const comps = new Map(existing);
  comps.set(EFFECTS_COMPONENT_KEY, encodeEffects(merged));
  return makeMultiValue(primaryOf(v), comps);
}

/** Compute the union of multiple effect sets. Null and undefined entries are
 *  treated as empty sets so callers can pass `effectsOf(v)` directly without
 *  null-checking. */
export function unionEffectSets(...sets: (EffectSet | null | undefined)[]): EffectSet {
  const out: EffectSet = new Set();
  for (const s of sets) {
    if (!s) continue;
    for (const e of s) out.add(e);
  }
  return out;
}
