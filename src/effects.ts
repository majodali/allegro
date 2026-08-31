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

import { metaOf, cloneMeta, installFieldMerge, registerMetaField } from "./slots.js";
import {
  Value, ValueKind, ComposedFunctionValue, StructureValue,
  withMeta, makeStructure,
} from "./types.js";

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
export function unwrapEffectsAttach(fn: import("./types.js").ComposedFunctionValue): { declared: EffectSet } | null {
  // C1.5b: the declared-effects clause is stashed on the function by
  // collapseBodyMetadata (totality.ts) — no AST peeling.
  const ast = (fn as any).declaredEffectsAst as Value | undefined;
  if (ast === undefined) return null;
  return { declared: extractLabelArray(ast) };
}


/** Extract a set of label strings from a `typed_array(Symbol(L1), Symbol(L2), …)`
 *  Expression. Used to pull declared labels out of an effects_attach call's
 *  metadata argument. Unrecognised shapes silently yield an empty set —
 *  the analyzer treats that as "no declaration". */
function extractLabelArray(v: Value): EffectSet {
  const out: EffectSet = new Set();
  const e = v;
  if (e.kind !== ValueKind.Expression) return out;
  const fn = e.fn;
  if (fn.kind !== ValueKind.PrimitiveFunction || fn.name !== "typed_array") return out;
  for (const a of e.args) {
    const p = a;
    if (p.kind === ValueKind.Symbol) out.add(p.name);
    // Bits-encoded string literals would be `String "label"` — also accept.
    // (Not currently emitted by the grammar, but cheap to support.)
  }
  return out;
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
  const p = v;
  if (p.kind === ValueKind.ComposedFunction) return p;
  if (p.kind === ValueKind.Expression) {
    const target = p.fn;
    if (target.kind === ValueKind.PrimitiveFunction
        && (target as any).name === "typed_function"
        && p.args.length >= 1) {
      return asFunction(p.args[0]);
    }
  }
  return null;
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
    const wrap = unwrapEffectsAttach(fn);
    if (!wrap) continue;
    // Inferred set comes from `precompileFunction`'s stash on the
    // ComposedFunction. `precompileFunctions` precompiles every function
    // binding (typed and untyped) so the stash is the canonical source —
    // empty when the body has no effects.
    const stashed = (fn as any).inferredEffects as EffectSet | undefined;
    const inferred = stashed ?? new Set<string>();
    const inferredHard = new Set(inferred);
    inferredHard.delete("opaque");
    // C7.2c: polymorphic declarations like `effects e` for a function
    // declared `[e: Effect]` now surface the variable's BARE name in the
    // PE-inferred set directly (the Param carries a declared `effectVar`
    // reference; the `__effectvar:` marker strings are retired), so the
    // declared set's symbolic labels match without normalisation.
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
    const inferred = (fn as any).inferredEffects as EffectSet | undefined;
    if (!inferred || !inferred.has("opaque")) continue;
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
// JS-side `effectSet` field. Encoding is hidden behind `withEffects` /
// `effectsOf`; consumers shouldn't reach into the component directly.

export const EFFECTS_FIELD = "effects";

// C1.5: the effects channel's union-merge, installed into the propagation
// table so generic executors can merge encoded effect sets without this
// module's encoding leaking into slots.ts.
// --- This layer's field (B-109(a), concept-campaign C3) ----------------------
// The effects extension owns `effects`. `union` is the discipline: a result's
// effects are the union of its operands' — which is also why the merge below
// is INSTALLED by this layer rather than known to the base. Registered at
// module scope; registration is one-shot, so it must not sit inside a
// per-evaluation factory.
registerMetaField({ name: "effects", rule: "union" });

installFieldMerge("effects", (a: Value, b: Value) => {
  const merged = effectUnion(decodeEffects(a) ?? new Set(), decodeEffects(b) ?? new Set());
  return encodeEffects(merged);
});

function encodeEffects(eff: EffectSet): Value {
  const ctx: StructureValue = makeStructure();
  (ctx as any).effectSet = eff;
  return ctx;
}

function decodeEffects(v: Value): EffectSet | null {
  if (v.kind !== ValueKind.Structure) return null;
  const set = (v as any).effectSet as EffectSet | undefined;
  return set ?? null;
}

/** Read a value's effect set, in order of preference:
 *    1. The `effects` MultiValue component (canonical — set by
 *       `typed_function_impl` from `precompileFunction`'s stash).
 *    2. The ComposedFunction's `inferredEffects` stash (for bare
 *       ComposedFunctions and MultiValue-wrapped functions whose effects
 *       component hasn't been populated, e.g. untyped user-defined
 *       functions in standard mode).
 *  Returns null when neither source has effects (consumer treats as pure). */
export function effectsOf(v: Value): EffectSet | null {
  // C4.3b: metaOf is total — flattened Contexts answer directly.
  const c = metaOf(v).get(EFFECTS_FIELD);
  if (c) return decodeEffects(c);
  const p = v;
  if (p.kind === ValueKind.ComposedFunction) {
    const stash = (p as any).inferredEffects as EffectSet | undefined;
    if (stash) return stash;
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
  const comps = cloneMeta(v);
  comps.set(EFFECTS_FIELD, encodeEffects(merged));
  return withMeta(v, comps);
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

// --- Liveness dispositions (B-028 F2 — CE-R4/D16/D34) --------------------------
//
// Under PE semantics, reads of pending values residualize — never block —
// so what remains of D31's "blocking-read" is the LIVENESS question: may
// this source's futures never resolve? That is discharged by DECLARED
// AXIOM, not inference (D34's admitted tier for the irreducibly
// external): each async source registers its disposition here. `live` =
// resolution is guaranteed by construction (a timer fires); `admitted` =
// resolution rests on a named external assumption, verdict-visible. F3
// wires this registry into the assumption ledger.

export type LivenessTier = "live" | "admitted";

export interface LivenessDisposition {
  source: string;
  tier: LivenessTier;
  /** The external assumption an `admitted` disposition rests on. */
  axiom?: string;
}

const livenessRegistry = new Map<string, LivenessDisposition>();

/** Declare an async source's liveness disposition (registration-time). */
export function declareLiveness(source: string, tier: LivenessTier, axiom?: string): void {
  livenessRegistry.set(source, { source, tier, axiom });
}

/** All declared liveness dispositions (for the ledger and tests). */
export function livenessDispositions(): LivenessDisposition[] {
  return [...livenessRegistry.values()];
}
