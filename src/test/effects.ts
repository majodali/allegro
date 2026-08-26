// =============================================================================
// Effects: the D1 slices — bounds, HOF inference, effect variables, components.
//
// Extracted from the single-file suite (suite split, lane B). Registrations
// run at import time; src/test/index.ts imports this module in suite order.
// =============================================================================

import { test, eq, throws } from "./harness.js";
import { evalStd, evalNum, typeExt } from "./fixtures.js";
import { evalSource as runtimeEval } from "../runtime.js";
import { ComposedFunctionValue } from "../types.js";
import { effectsDomain, makePredicate } from "../refinements.js";
import {
  PURE, effectUnion as effectLabelSetUnion, effectSubset as effectLabelSetSubset,
  effectDifference, formatEffects,
  unwrapEffectsAttach,
  effectsOf, withEffects,
  EffectSet,
} from "../effects.js";
import { Value, dataOf, makeParam, BitsValue, ValueKind, bitsToString, makeInt } from "../types.js";
import { summarizeValue as _summarizeValueChunk3, summarizeValue } from "../introspect.js";
import { formatDomain, intersectDomains, joinDomains, impliesDomain, PredicateSet, entailsPredicate } from "../refinements.js";
import { pureEffect, opaqueEffect } from "../types-std.js";
import { getName } from "../slots.js";

// --- Phase D1: effect types ---


// Helper: read the precompile-stashed effects from a function value,
// returning an empty set when no effects are recorded. After walker removal,
// tests verify the same property by reading the `effects` MultiValue
// component (or the `__inferredEffects` stash on bare ComposedFunctions)
// instead of invoking the walker directly.
function inferredEffectsOf(v: Value): EffectSet {
  return effectsOf(v) ?? new Set<string>();
}

test("Phase D1: empty EffectSet formats as 'pure'", () => {
  eq(formatEffects(PURE), "pure");
});

test("Phase D1: effectSubset and effectUnion basic ops", () => {
  const a = new Set(["io"]);
  const b = new Set(["io", "net"]);
  eq(effectLabelSetSubset(a, b), true, "io ⊆ {io,net}");
  eq(effectLabelSetSubset(b, a), false, "{io,net} ⊄ {io}");
  const u = effectLabelSetUnion(a, b);
  eq(u.size, 2);
  eq(u.has("io") && u.has("net"), true);
});

test("Phase D1: pure function has empty inferred effect set", () => {
  const src = `f(x) => x + 1\n`;
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const fn = evalCtx.bindings.get("f")!.value as Value;
  const fnP = dataOf(fn) as ComposedFunctionValue;
  const inferred = inferredEffectsOf(fnP);
  eq(inferred.size, 0, "no effects from arithmetic");
});

test("Phase D1: function calling print infers io", () => {
  const src = `f(x) =>
  print(x)
  x
`;
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const fn = evalCtx.bindings.get("f")!.value as Value;
  const fnP = dataOf(fn) as ComposedFunctionValue;
  const inferred = inferredEffectsOf(fnP);
  eq(inferred.has("io"), true, `expected io inferred, got: ${[...inferred].join(",")}`);
});

test("Phase D1: matching declaration verifies (does not halt)", () => {
  // Directly hand-build the post-preprocessing shape so the test doesn't
  // need the grammar extension loaded. effects_attach(body, typed_array(io))
  // declares `io`; the body uses print which infers `io`. Matched.
  const src = `f(msg) =>
  effects_attach(
    seq(print(msg), msg),
    typed_array(io)
  )
`;
  let threw = false;
  try {
    runtimeEval(src, undefined, [typeExt], undefined, true);
  } catch (e: any) {
    threw = true;
  }
  eq(threw, false, "matching declaration should not throw");
});

test("Phase D1: declaring pure when print is used halts compilation", () => {
  const src = `bad(msg) =>
  effects_attach(
    seq(print(msg), msg),
    typed_array()
  )

bad("x")
`;
  // typed_array() with no args = empty declared set = pure.
  // Inferred: io (from print). pure ⊋ io → mismatch.
  let threw = false;
  let msg = "";
  try {
    runtimeEval(src, undefined, [typeExt], undefined, true);
  } catch (e: any) {
    threw = true;
    msg = String(e.message ?? e);
  }
  eq(threw, true, "pure declaration with io body should halt");
  eq(msg.toLowerCase().includes("effects") && msg.toLowerCase().includes("io"), true,
     `expected effects mismatch mentioning io, got: ${msg}`);
});

test("Phase D1: introspection surfaces inferred and declared effects", () => {
  const src = `f(x) =>
  effects_attach(
    seq(print(x), x),
    typed_array(io)
  )
`;
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const fn = evalCtx.bindings.get("f")!.value!;
  const summary = _summarizeValueChunk3(fn);
  eq(summary.inferredEffects?.has("io") ?? false, true);
  eq(summary.declaredEffects?.has("io") ?? false, true);
});

test("Phase D1: unwrapEffectsAttach extracts declared label set", () => {
  const src = `f(x) =>
  effects_attach(
    x + 1,
    typed_array(io, net)
  )
`;
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const fn = evalCtx.bindings.get("f")!.value!;
  const fnP = dataOf(fn) as ComposedFunctionValue;
  const wrap = unwrapEffectsAttach(fnP);
  eq(wrap !== null, true, "expected effects_attach wrapper");
  if (wrap) {
    eq(wrap.declared.has("io"), true);
    eq(wrap.declared.has("net"), true);
    eq(wrap.declared.size, 2);
  }
});

// --- Phase D1 sub-chunk 1.2: effects in PredicateSet ---


test("Phase D1.2: effectsDomain constructor builds EffectsDomain", () => {
  const d = effectsDomain(["io", "time"]);
  eq(d.kind, "effects");
  eq(d.labels.has("io"), true);
  eq(d.labels.has("time"), true);
});

test("Phase D1.2: effectsDomain empty renders as 'pure'", () => {
  eq(formatDomain(effectsDomain()), "pure");
});

test("Phase D1.2: effectsDomain renders alphabetised", () => {
  eq(formatDomain(effectsDomain(["time", "io", "net"])), "io, net, time");
});

test("Phase D1.2: intersectDomains effects ∩ effects = label intersection", () => {
  const r = intersectDomains(effectsDomain(["io", "time"]), effectsDomain(["io", "net"]));
  eq(r.kind, "effects");
  if (r.kind === "effects") {
    eq(r.labels.size, 1);
    eq(r.labels.has("io"), true);
  }
});

test("Phase D1.2: joinDomains effects ∪ effects = label union", () => {
  const r = joinDomains(effectsDomain(["io"]), effectsDomain(["net", "time"]));
  eq(r.kind, "effects");
  if (r.kind === "effects") {
    eq(r.labels.size, 3);
  }
});

test("Phase D1.2: impliesDomain on effects (predicate semantics, matches numerics)", () => {
  // Predicate-implication semantics: a implies b iff a.labels ⊆ b.labels —
  // "actual fits inside the wider bound". This matches how impliesDomain
  // works for numerics (a's interval ⊆ b's interval) so type_check_impl
  // discharges effect predicates the same way it discharges numeric ones.
  //
  // The user-facing capability operator on Effect VALUES (`Effect.implies`,
  // backed by `effectImplies` in types-std.ts) has the opposite orientation
  // — that's a deliberately different helper for the user-level method.

  // {io} fits inside the wider bound {io, net}
  eq(impliesDomain(effectsDomain(["io"]), effectsDomain(["io", "net"])), true);
  // {io, net} does NOT fit inside the tighter bound {io}
  eq(impliesDomain(effectsDomain(["io", "net"]), effectsDomain(["io"])), false);
  // Equal sets imply each other
  eq(impliesDomain(effectsDomain(["io"]), effectsDomain(["io"])), true);
  // pure (∅) implies pure
  eq(impliesDomain(effectsDomain(), effectsDomain()), true);
  // pure (∅) fits inside any wider bound
  eq(impliesDomain(effectsDomain(), effectsDomain(["io"])), true);
  // {io} does NOT fit inside pure (∅)
  eq(impliesDomain(effectsDomain(["io"]), effectsDomain()), false);
});

test("Phase D1.2: entailsPredicate on effect predicate set (consumer test)", () => {
  // Integration check: a PredicateSet carrying an effect predicate should
  // discharge a target effect domain when actual ⊆ target. This exercises
  // the path type_check_impl uses in Slice 2 Stage A — the test missing from
  // 1.2 that would have caught the impliesDomain orientation bug.
  const pureSet = new PredicateSet([
    makePredicate(effectsDomain(), "effects-inferred"),
  ]);
  // Pure function fits a {io} bound
  eq(entailsPredicate(pureSet, effectsDomain(["io"])), true);
  // Pure function fits a pure bound
  eq(entailsPredicate(pureSet, effectsDomain()), true);

  const ioSet = new PredicateSet([
    makePredicate(effectsDomain(["io"]), "effects-inferred"),
  ]);
  // {io} function does NOT fit a pure bound
  eq(entailsPredicate(ioSet, effectsDomain()), false);
  // {io} function fits a {io, net} bound
  eq(entailsPredicate(ioSet, effectsDomain(["io", "net"])), true);
});

test("Phase D1.2: mixed-kind operations don't pollute results", () => {
  const intv = { kind: "interval" as const, lo: 0, hi: 10 };
  const fx = effectsDomain(["io"]);
  // Mixed-kind intersect/join → opaque (no useful combination)
  eq(intersectDomains(intv, fx).kind, "opaque");
  eq(joinDomains(intv, fx).kind, "opaque");
  // Mixed-kind implies → false
  eq(impliesDomain(intv, fx), false);
  eq(impliesDomain(fx, intv), false);
});

test("Phase D1.2: PredicateSet.effectiveEffects unions effects predicates", () => {
  const set = new PredicateSet([
    makePredicate(effectsDomain(["io"]), "effects-declared"),
    makePredicate(effectsDomain(["time"]), "effects-inferred"),
    // Numeric predicate should be ignored by effectiveEffects
    makePredicate({ kind: "interval", lo: 0, hi: 10 }, "refinement-type"),
  ]);
  const fx = set.effectiveEffects();
  eq(fx !== null, true);
  if (fx) {
    eq(fx.kind, "effects");
    eq(fx.labels.size, 2);
    eq(fx.labels.has("io"), true);
    eq(fx.labels.has("time"), true);
  }
});

test("Phase D1.2: PredicateSet.effectiveDomain skips effects predicates", () => {
  const set = new PredicateSet([
    makePredicate(effectsDomain(["io"]), "effects-declared"),
    makePredicate({ kind: "interval", lo: 0, hi: 10 }, "refinement-type"),
  ]);
  const dom = set.effectiveDomain();
  eq(dom !== null, true);
  // Should be the interval, not the effects domain
  eq(dom!.kind, "interval");
});

test("Phase D1.2: entailsPredicate works for effects targets", () => {
  // Predicate-implication semantics: an actual effect set entails a target
  // bound iff actual ⊆ bound (actual fits inside the wider/equal bound).
  const set = new PredicateSet([
    makePredicate(effectsDomain(["io", "net"]), "effects-declared"),
  ]);
  // Actual {io, net} fits a wider bound {io, net, time}
  eq(entailsPredicate(set, effectsDomain(["io", "net", "time"])), true);
  // Actual {io, net} does NOT fit a tighter bound {io}
  eq(entailsPredicate(set, effectsDomain(["io"])), false);
  // Actual {io, net} does NOT fit a disjoint bound {time}
  eq(entailsPredicate(set, effectsDomain(["time"])), false);
});

// Post-walker-removal: the predicate-set bridge is gone. The inferred set
// lives directly on the function value (effects MultiValue component, or
// __inferredEffects stash on bare ComposedFunctions). These three tests now
// verify the same effect-inference property via `effectsOf`.
test("Phase D1.2: pure body yields empty inferred effects", () => {
  const src = `
sq(x) =>
  x * x
sq
`;
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const fn = evalCtx.bindings.get("sq")!.value!;
  const eff = inferredEffectsOf(fn);
  eq(eff.size, 0);
});

test("Phase D1.2: print body yields inferred io", () => {
  const src = `
greet(name) =>
  print("hi " + name)
  name
greet
`;
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const fn = evalCtx.bindings.get("greet")!.value!;
  const eff = inferredEffectsOf(fn);
  eq(eff.has("io"), true);
});

test("Phase D1.2: declared and inferred coexist on function value", () => {
  // Use the same direct primitive shape the chunk-1 tests use, to avoid
  // depending on the `use effects` grammar load path here.
  const src = `f(x) =>
  effects_attach(
    seq(print(x), x),
    typed_array(io)
  )
`;
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const fn = evalCtx.bindings.get("f")!.value!;
  // Inferred set on the function — io from the print call.
  const inferred = inferredEffectsOf(fn);
  eq(inferred.has("io"), true);
  // Declared set on the body — io from the effects_attach metadata.
  const fnP = dataOf(fn) as ComposedFunctionValue;
  const wrap = unwrapEffectsAttach(fnP);
  eq(wrap !== null, true);
  if (wrap) eq(wrap.declared.has("io"), true);
});

// --- Phase D1 Slice 2 Stage A: effect bounds via type_check ---

test("Stage A: pureEffect carries an empty-labels effect bound", () => {
  // The bound is what type_check pulls when discharging `f: pure`.
  const bound = (pureEffect as any).__effectBound;
  eq(bound !== undefined, true);
  eq(bound.kind, "effects");
  eq(bound.labels.size, 0);
});

test("Stage A: opaqueEffect carries no effect bound (universal)", () => {
  const bound = (opaqueEffect as any).__effectBound;
  eq(bound, undefined);
});

test("Stage A: ParamValue carries optional predicates field", () => {
  // makeParam declares the field at construction so V8 hidden classes stay
  // stable. Default is undefined (no bound).
  const p = makeParam(0, "f");
  eq("predicates" in p, true);
  eq(p.predicates, undefined);
});

test("Stage A: f: pure accepts a pure function", () => {
  const src = `pure_caller(f: pure) =>
  42
sq(x) =>
  x * x
pure_caller(sq)
`;
  const result = evalStd(src);
  eq(Number((dataOf(result!) as BitsValue).data), 42);
});

test("Stage A: f: pure rejects a function that uses print", () => {
  // print is tagged with effects=["io"]; greet's inferred set is {io}, so
  // the bound `pure` ({}) is exceeded.
  const src = `pure_caller(f: pure) =>
  42
greet(name) =>
  print("hi " + name)
  name
pure_caller(greet)
`;
  let threw = false;
  let msg = "";
  try { runtimeEval(src, undefined, [typeExt], undefined, true); }
  catch (e: any) { threw = true; msg = e.message; }
  eq(threw, true, "expected effect-bound rejection");
  eq(msg.includes("pure"), true, "error mentions the expected bound");
  eq(msg.includes("io"), true, "error mentions the actual effect");
});

test("Stage A: f: opaque accepts any function", () => {
  // opaque has no bound — universal — so any function passes.
  const src = `any_caller(f: opaque) =>
  42
greet(name) =>
  print("hi " + name)
  name
any_caller(greet)
`;
  const result = evalStd(src);
  eq(Number((dataOf(result!) as BitsValue).data), 42);
});

test("Stage A: x: pure binding accepts a pure function", () => {
  // Binding annotation goes through type_check_impl rather than
  // applyComposed's checkArgType — same effect-bound discharge.
  const src = `sq(x) =>
  x * x
y: pure = sq
42
`;
  const result = evalStd(src);
  eq(Number((dataOf(result!) as BitsValue).data), 42);
});

test("Stage A: x: pure binding rejects an io function", () => {
  const src = `greet(name) =>
  print("hi " + name)
  name
y: pure = greet
42
`;
  let threw = false;
  try { runtimeEval(src, undefined, [typeExt], undefined, true); }
  catch (e: any) { threw = true; }
  eq(threw, true);
});

// --- Phase D1 Slice 2 Stage B: HOF inference walker ---

test("Stage B: unbounded function-typed param → opaque inferred", () => {
  // caller calls `f` (no bound) — inference must mark opaque, since we
  // don't statically know what `f` does.
  const src = `caller(f) =>
  f(42)
caller
`;
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const fn = dataOf(evalCtx.bindings.get("caller")!.value!);
  eq(fn.kind, ValueKind.ComposedFunction);
  if (fn.kind === ValueKind.ComposedFunction) {
    const inferred = inferredEffectsOf(fn);
    eq(inferred.has("opaque"), true);
  }
});

test("Stage B: f: pure bound → pure inferred", () => {
  // The bound stamps the Param with predicates {effects: ∅}; the walker
  // pulls them when seeing Expression(Param(f), …) and adds nothing.
  const src = `pure_caller(f: pure) =>
  f(42)
pure_caller
`;
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const fn = dataOf(evalCtx.bindings.get("pure_caller")!.value!);
  eq(fn.kind, ValueKind.ComposedFunction);
  if (fn.kind === ValueKind.ComposedFunction) {
    const inferred = inferredEffectsOf(fn);
    eq(inferred.size, 0, "expected pure inferred set");
  }
});

test("Stage B (F2): typed_function stamps Param.effectBound from __effectBound", () => {
  // F2 storage migration: effect bounds now live on Param.effectBound (a
  // plain Set<string>) instead of Param.predicates (a PredicateSet).
  // Refinement bounds stay reserved on Param.predicates for future use.
  const src = `bounded(f: pure) =>
  f(0)
bounded
`;
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const fn = dataOf(evalCtx.bindings.get("bounded")!.value!);
  if (fn.kind === ValueKind.ComposedFunction) {
    const p = fn.params[0];
    eq(p.effectBound !== undefined, true);
    eq(p.effectBound?.size, 0, `pure has empty labels`);
  }
});

test("Stage B: declared `effects pure` on unbounded param call emits notification, no halt", () => {
  // The opaque label from the param call gets filtered (1.3's tolerance);
  // the user gets a notification rather than an error.
  const src = `caller(f) =>
  effects_attach(
    f(0),
    typed_array()
  )
`;
  let threw = false;
  let report: any;
  try {
    const r = runtimeEval(src, undefined, [typeExt], undefined, true);
    report = r.compilationReport;
  } catch (e: any) {
    threw = true;
  }
  eq(threw, false, "opaque-from-param shouldn't halt declaration check");
  const notes = report.notifications.filter(
    (n: any) => n.kind === "effects-opaque-from-stdlib-hof" && n.binding === "caller",
  );
  eq(notes.length >= 1, true);
});

test("Stage B: declared `effects pure` on `f: pure` param verifies cleanly (no notification)", () => {
  // With the bound, inferred = pure too; declared = pure matches; the
  // opaque notification doesn't fire since opaque isn't in inferred.
  const src = `caller(f: pure) =>
  effects_attach(
    f(0),
    typed_array()
  )
`;
  const { compilationReport } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const notes = compilationReport!.notifications.filter(
    n => n.kind === "effects-opaque-from-stdlib-hof" && n.binding === "caller",
  );
  eq(notes.length, 0, "no opaque notification when bound matches declaration");
});

// --- Phase D1 Slice 2 Stage C1: generic param list grammar ---

test("Stage C1: id[T](x: T): T parses and runs", () => {
  // Explicit type-variable declaration. Should behave identically to the
  // auto-promoted form for now (Stage C2 will introduce kind-based dispatch).
  const result = evalStd(`id[T](x: T): T => x\nid(42)`);
  eq(Number((dataOf(result!) as BitsValue).data), 42);
});

test("Stage C1: f[e: Effect] declared, function call works", () => {
  // Effect-kinded generic param. Stage C1 just declares it; effect-variable
  // unification is Stage C2. The function still runs end-to-end.
  const result = evalStd(`apply[e: Effect](g: e, x: Int): Int => g(x)
apply((x: Int): Int => x * 2, 21)`);
  eq(Number((dataOf(result!) as BitsValue).data), 42);
});

test("Stage C1: multi-variable generic params parse", () => {
  const result = evalStd(`pair[T, U](x: T, y: U): T => x
pair(7, "hello")`);
  eq(Number((dataOf(result!) as BitsValue).data), 7);
});

test("Stage C1: auto-promoted type variable still works (no decl)", () => {
  // Existing unannotated mechanism — `T` in `x: T` is auto-promoted as a
  // type variable. Generic-param decl is opt-in for clarity.
  const result = evalStd(`id(x: T): T => x\nid(99)`);
  eq(Number((dataOf(result!) as BitsValue).data), 99);
});

test("Stage C1: __genericParams metadata stamped on the underlying ComposedFunction", () => {
  // The metadata lives on the ComposedFunction identity — it survives the
  // typed_function envelope at runtime since the envelope just wraps the
  // same ComposedFunction with type info. Stage C2 reads this to drive
  // effect-variable unification dispatch.
  const src = `id[T, e: Effect](x: T): T => x\nid`;
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const fn = evalCtx.bindings.get("id")!.value!;
  const cFn = dataOf(fn);
  const meta = (cFn as any).__genericParams;
  eq(Array.isArray(meta), true);
  if (Array.isArray(meta)) {
    eq(meta.length, 2);
    eq(meta[0].name, "T");
    eq(meta[1].name, "e");
    // First has no kind (defaults to Type); second has explicit Effect.
    eq(meta[0].kind, undefined);
    eq(meta[1].kind !== undefined, true);
  }
});

test("Stage C1: export NAME[generic_decl](...) parses", () => {
  // Make sure the generic-decl path also works through the export grammar.
  const result = evalStd(`export id[T](x: T): T => x\nid(123)`);
  eq(Number((dataOf(result!) as BitsValue).data), 123);
});

// --- Phase D1 Slice 2 Stage C2: effect-variable unification at call sites ---

test("C7.2c: effect-variable params carry the declared effectVar reference", () => {
  // For `apply[e: Effect](g: e, x: Int): Int`, position 0 is the e-bound
  // param. C7.2c: the declared structure is `Param.effectVar` referencing
  // the Effect-kinded __genericParams entry by name — the __effectVarParams
  // side table and `__effectvar:` marker labels are retired.
  const src = `apply[e: Effect](g: e, x: Int): Int => g(x)\napply`;
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const fn = dataOf(evalCtx.bindings.get("apply")!.value!);
  eq((fn as any).__effectVarParams === undefined, true);
  if (fn.kind === ValueKind.ComposedFunction) {
    eq((fn.params[0] as any).effectVar, "e");
    eq((fn.params[1] as any).effectVar, undefined);
    const bound = (fn.params[0] as any).effectBound as Set<string> | undefined;
    eq(bound === undefined, true, "effect-var param carries no concrete bound");
  }
});

test("Stage C2: pure-callback call resolves effect var to pure", () => {
  // `apply` is polymorphic. caller calls apply with a pure lambda. The
  // walker should resolve `__effectvar:e` to pure (empty), making caller's
  // inferred set pure too. Lookup resolves cross-binding `apply` reference.
  const src = `apply[e: Effect](g: e, x: Int): Int => g(x)
caller(arr) =>
  apply((y: Int): Int => y * 2, 7)
caller
`;
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const lookup = (n: string) => evalCtx.bindings.get(n)?.value;
  const fn = dataOf(evalCtx.bindings.get("caller")!.value!);
  if (fn.kind === ValueKind.ComposedFunction) {
    const inferred = inferredEffectsOf(fn);
    eq(inferred.size, 0, "expected pure inferred from pure-callback resolution");
  }
});

test("Stage C2: io-callback call resolves effect var to io", () => {
  // Same shape, but the lambda uses print → walker resolves to {io}.
  // One-line lambda body to avoid indentation parsing issues.
  const src = `apply[e: Effect](g: e, x: Int): Int => g(x)
caller(arr) =>
  apply((y: Int): Int => print(y), 7)
caller
`;
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const lookup = (n: string) => evalCtx.bindings.get(n)?.value;
  const fn = dataOf(evalCtx.bindings.get("caller")!.value!);
  if (fn.kind === ValueKind.ComposedFunction) {
    const inferred = inferredEffectsOf(fn);
    eq(inferred.has("io"), true, "expected io propagated from print callback");
  }
});

test("Stage C2: unknown function arg resolves to opaque", () => {
  // When the caller forwards an unbounded param into a polymorphic call,
  // we can't resolve concretely — the var becomes opaque (conservative).
  const src = `apply[e: Effect](g: e, x: Int): Int => g(x)
forwarder(unknown_fn, n) =>
  apply(unknown_fn, n)
forwarder
`;
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const lookup = (n: string) => evalCtx.bindings.get(n)?.value;
  const fn = dataOf(evalCtx.bindings.get("forwarder")!.value!);
  if (fn.kind === ValueKind.ComposedFunction) {
    const inferred = inferredEffectsOf(fn);
    eq(inferred.has("opaque"), true);
  }
});

test("Stage C2: bounded-param forward resolves precisely", () => {
  // forwarder declares `f: pure`, so the param's predicates carry pure;
  // when forwarded into apply, the var resolves to pure (not opaque).
  const src = `apply[e: Effect](g: e, x: Int): Int => g(x)
forwarder(f: pure, n: Int) =>
  apply(f, n)
forwarder
`;
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const lookup = (n: string) => evalCtx.bindings.get(n)?.value;
  const fn = dataOf(evalCtx.bindings.get("forwarder")!.value!);
  if (fn.kind === ValueKind.ComposedFunction) {
    const inferred = inferredEffectsOf(fn);
    eq(inferred.has("opaque"), false, "expected precise pure, not opaque");
    eq(inferred.size, 0, "expected empty inferred set");
  }
});

// --- Phase D1 Slice 2 Stage C3: multi-variable polymorphism + effect
//                                 expressions in return position ---

test("Stage C3: multi-variable apply2[e1, e2] propagates each var independently", () => {
  // Walker iterates inferred labels and resolves each marker via its own
  // positions list — multi-variable falls out of the existing infrastructure.
  const src = `apply2[e1: Effect, e2: Effect](g1: e1, g2: e2, x: Int): Int =>
  g2(g1(x))
io_then_pure(x: Int) =>
  apply2((y: Int): Int => print(y), (y: Int): Int => y + 1, x)
`;
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const lookup = (n: string) => evalCtx.bindings.get(n)?.value;
  const fn = dataOf(evalCtx.bindings.get("io_then_pure")!.value!);
  if (fn.kind === ValueKind.ComposedFunction) {
    const inferred = inferredEffectsOf(fn);
    eq(inferred.has("io"), true, `expected io from g1, got: ${[...inferred].join(",")}`);
    eq(inferred.has("opaque"), false, "expected precise resolution, not opaque");
  }
});

test("Stage C3: multi-variable resolution is positional, not pooled", () => {
  // apply2[e1, e2] should not contaminate position 0's effect with position 1's.
  // Callsite passes pure at pos 0, io at pos 1 → caller infers exactly {io}.
  const src = `apply2[e1: Effect, e2: Effect](g1: e1, g2: e2, x: Int): Int =>
  g2(g1(x))
pure_then_io(x: Int) =>
  apply2((y: Int): Int => y + 1, (y: Int): Int => print(y), x)
`;
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const lookup = (n: string) => evalCtx.bindings.get(n)?.value;
  const fn = dataOf(evalCtx.bindings.get("pure_then_io")!.value!);
  if (fn.kind === ValueKind.ComposedFunction) {
    const inferred = inferredEffectsOf(fn);
    eq(inferred.has("io"), true);
    eq(inferred.size, 1, `expected just {io}, got: ${[...inferred].join(",")}`);
  }
});

test("Stage C3: idempotent twice[e](f: e, x): same effect var, no duplication", () => {
  // f(f(x)) calls f twice — inferred set's marker labels naturally dedupe via
  // Set semantics, so e & e == e falls out without special handling.
  const src = `twice[e: Effect](f: e, x: Int): Int =>
  f(f(x))
twice_io(x: Int) =>
  twice((y: Int): Int => print(y), x)
`;
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const lookup = (n: string) => evalCtx.bindings.get(n)?.value;
  const fn = dataOf(evalCtx.bindings.get("twice_io")!.value!);
  if (fn.kind === ValueKind.ComposedFunction) {
    const inferred = inferredEffectsOf(fn);
    eq(inferred.has("io"), true);
    eq(inferred.size, 1, `expected single io, got: ${[...inferred].join(",")}`);
  }
});

test("Stage C3: typed_amp(pure, opaque) returns opaque (effect lattice top)", () => {
  // Effect & Effect dispatches to effectUnion. opaque absorbs everything.
  const src = `result = pure & opaque\nresult\n`;
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const v = evalCtx.bindings.get("result")!.value!;
  const p = dataOf(v);
  eq(p.kind, ValueKind.Structure);
  if (p.kind === ValueKind.Structure) {
    const name = getName(p);
    eq(name?.kind === ValueKind.Bits ? bitsToString(name as BitsValue) : null, "opaque");
  }
});

test("Stage C3: typed_amp(pure, pure) returns pure (idempotence at value level)", () => {
  const src = `result = pure & pure\nresult\n`;
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const v = evalCtx.bindings.get("result")!.value!;
  const p = dataOf(v);
  if (p.kind === ValueKind.Structure) {
    const name = getName(p);
    eq(name?.kind === ValueKind.Bits ? bitsToString(name as BitsValue) : null, "pure");
  }
});

test("Stage C3: typed_amp on Effect with non-Effect right operand errors", () => {
  // `pure & 42` — left is an Effect, but right resolves to an Int. The
  // Effect-conjunction branch evaluates the thunk and rejects non-Effect.
  let threw = false;
  let msg = "";
  try {
    runtimeEval(`result = pure & 42\nresult\n`, undefined, [typeExt], undefined, true);
  } catch (e: any) {
    threw = true; msg = String(e.message ?? e);
  }
  eq(threw, true, "expected error on Effect & non-Effect");
  eq(msg.toLowerCase().includes("effect"), true,
     `expected message about Effect, got: ${msg}`);
});

test("Stage C3: auto-promotion (no [e: Effect] decl) yields opaque, not silent zero", () => {
  // Honest soundness: an unannotated function-typed param has no Param
  // predicates, so the walker's Param-call branch falls through to opaque.
  const src = `forwarder(f, x: Int): Int => f(x)\nforwarder\n`;
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const fn = dataOf(evalCtx.bindings.get("forwarder")!.value!);
  if (fn.kind === ValueKind.ComposedFunction) {
    const inferred = inferredEffectsOf(fn);
    eq(inferred.has("opaque"), true,
       `expected opaque for unannotated function param, got: ${[...inferred].join(",")}`);
  }
});

test("Stage C3: explicit [e: Effect] annotation propagates through forwarded params, auto-promotion stays opaque", () => {
  // Side-by-side: same shape, different declarations. When the cb is a
  // forwarded param (not an inline lambda), only the explicit `[e: Effect]`
  // form propagates the cb's actual effects up to the caller; the auto-
  // promoted form has no way to express the dependency and stays opaque.
  //
  // Inline-lambda cb cases now resolve precisely on BOTH sides via PE — that
  // case lives in the C2 tests above. This test focuses on the case where
  // PE alone is insufficient: forwarding an unbounded function-typed param.
  const src = `apply_poly[e: Effect](g: e, x: Int): Int => g(x)
apply_auto(g, x: Int): Int => g(x)
ann_caller(f: pure, x: Int): Int =>
  apply_poly(f, x)
auto_caller(f, x: Int): Int =>
  apply_auto(f, x)
`;
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const ann = dataOf(evalCtx.bindings.get("ann_caller")!.value!);
  const auto = dataOf(evalCtx.bindings.get("auto_caller")!.value!);
  if (ann.kind === ValueKind.ComposedFunction) {
    const inferred = inferredEffectsOf(ann);
    eq(inferred.has("opaque"), false,
       `annotated form should resolve precisely from f: pure: got ${[...inferred].join(",")}`);
    eq(inferred.size, 0,
       `annotated form should be pure: got ${[...inferred].join(",")}`);
  }
  if (auto.kind === ValueKind.ComposedFunction) {
    const inferred = inferredEffectsOf(auto);
    eq(inferred.has("opaque"), true,
       `unannotated forwarded param stays opaque: got ${[...inferred].join(",")}`);
  }
});

test("Stage C3: polymorphic function declaring `effects e` verifies (bare variable name matches)", () => {
  // C7.2c: PE surfaces the effect variable's BARE name (`e`) in the
  // inferred set directly (from the Param's declared `effectVar`), so the
  // symbolic declaration matches at definition time with no marker
  // normalisation. Concrete resolution happens at call sites by ordinary
  // PE substitution.
  //
  // Hand-built effects_attach since the test harness doesn't load the
  // effects grammar; mirrors existing Phase D1 tests' shape.
  const src = `apply[e: Effect](g: e, x: Int): Int =>
  effects_attach(g(x), typed_array(e))
`;
  let threw = false;
  try {
    runtimeEval(src, undefined, [typeExt], undefined, true);
  } catch (e: any) {
    threw = true;
  }
  eq(threw, false, "polymorphic effects e should verify against the declared variable");
});

test("Stage C3: polymorphic body with extra effect under-declared fires mismatch", () => {
  // bad_apply declares `effects e` but its body also runs print (io) outside
  // the polymorphic call. inferred = {e, io} (C7.2c: bare variable name);
  // declared = {e}; missing = {io} → halt.
  const src = `bad_apply[e: Effect](g: e, x: Int): Int =>
  effects_attach(seq(print("trace"), g(x)), typed_array(e))
`;
  let threw = false;
  let msg = "";
  try {
    runtimeEval(src, undefined, [typeExt], undefined, true);
  } catch (e: any) {
    threw = true; msg = String(e.message ?? e);
  }
  eq(threw, true, "extra io should produce mismatch");
  eq(msg.toLowerCase().includes("io"), true,
     `expected io in mismatch, got: ${msg}`);
});

// --- Phase D1 Slice 2 Stage D: param_effects body-form (Surface C) ---
//
// The test harness doesn't load the `lib/effects.alg` grammar extension, so
// the surface form `param_effects f: pure` isn't parseable here. Tests
// hand-build the lowered shape `param_effects_attach(body, paramRef, effSym, …)`
// to verify the typed_function_impl peel-and-stamp pass and the call-site
// enforcement path. End-to-end surface verification is in tests/effects-demo.alg.

test("Stage D (F2): param_effects_attach stamps Param.effectBound with effect bound", () => {
  // Hand-built lowered shape mirroring what the block preprocessor emits.
  // F2 stores effect bounds on Param.effectBound directly (was Param.predicates).
  const src = `apply_pure(g, x: Int): Int =>
  param_effects_attach(g(x), g, pure)

apply_pure
`;
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const fn = dataOf(evalCtx.bindings.get("apply_pure")!.value!);
  eq(fn.kind, ValueKind.ComposedFunction);
  if (fn.kind === ValueKind.ComposedFunction) {
    const gBound = (fn.params[0] as any).effectBound as Set<string> | undefined;
    eq(gBound !== undefined, true, "g should have effectBound stamped");
    eq(gBound?.size, 0, `pure has empty labels, got: ${[...(gBound ?? [])].join(",")}`);
  }
});

test("Stage D: pure-bound param accepts pure callback at call site", () => {
  const src = `apply_pure(g, x: Int): Int =>
  param_effects_attach(g(x), g, pure)

apply_pure((y: Int): Int => y + 1, 5)
`;
  let threw = false;
  try {
    runtimeEval(src, undefined, [typeExt], undefined, true);
  } catch (e: any) {
    threw = true;
  }
  eq(threw, false, "pure callback should pass pure-bound param");
});

test("Stage D: pure-bound param rejects io callback at call site", () => {
  const src = `apply_pure(g, x: Int): Int =>
  param_effects_attach(g(x), g, pure)

apply_pure((y: Int): Int => print(y), 5)
`;
  let threw = false;
  let msg = "";
  try {
    runtimeEval(src, undefined, [typeExt], undefined, true);
  } catch (e: any) {
    threw = true; msg = String(e.message ?? e);
  }
  eq(threw, true, "io callback should fail pure-bound param");
  eq(msg.toLowerCase().includes("effect bound"), true,
     `expected 'effect bound' in message, got: ${msg}`);
  eq(msg.toLowerCase().includes("param_effects"), true,
     `expected 'param_effects' attribution in message, got: ${msg}`);
});

test("Stage D: opaque-bound param leaves predicates unset (universal)", () => {
  // Mirrors Surface A's behaviour: `f: opaque` has no `__effectBound`, so
  // predicates stay undefined — any effects allowed.
  const src = `forwarder(g, x: Int): Int =>
  param_effects_attach(g(x), g, opaque)

forwarder
`;
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const fn = dataOf(evalCtx.bindings.get("forwarder")!.value!);
  if (fn.kind === ValueKind.ComposedFunction) {
    const bound = (fn.params[0] as any).effectBound;
    eq(bound === undefined, true, "opaque should not stamp effectBound");
  }
});

test("Stage D: walker reads Surface C bound and propagates effects to caller", () => {
  // Inside `apply_pure`, `g(x)` is a Param call. The walker reads
  // g.predicates (stamped by Stage D) and treats the call as pure.
  // Without Surface C the param call would be opaque.
  const src = `apply_pure(g, x: Int): Int =>
  param_effects_attach(g(x), g, pure)

apply_pure
`;
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const fn = dataOf(evalCtx.bindings.get("apply_pure")!.value!);
  if (fn.kind === ValueKind.ComposedFunction) {
    const inferred = inferredEffectsOf(fn);
    eq(inferred.has("opaque"), false, `Surface C should give precise pure, got: ${[...inferred].join(",")}`);
    eq(inferred.size, 0, `expected pure (∅), got: ${[...inferred].join(",")}`);
  }
});

test("Stage D (F2): multiple param_effects markers stamp Param.effectBound independently", () => {
  // Two separate markers, each stamping a different param.
  const src = `pipe(f, g, x: Int): Int =>
  param_effects_attach(g(f(x)), f, pure, g, pure)

pipe
`;
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const fn = dataOf(evalCtx.bindings.get("pipe")!.value!);
  if (fn.kind === ValueKind.ComposedFunction) {
    const fBound = (fn.params[0] as any).effectBound as Set<string> | undefined;
    const gBound = (fn.params[1] as any).effectBound as Set<string> | undefined;
    eq(fBound !== undefined, true, "f should have effectBound");
    eq(gBound !== undefined, true, "g should have effectBound");
    eq(fBound?.size, 0, "f bound is pure");
    eq(gBound?.size, 0, "g bound is pure");
  }
});

// --- Phase D1 Slice 2 Stage E: function-type-expression syntax ---
//
// `(A) => B` in type-expression position lowers to `type_function(A, B)`,
// which evaluates to a concrete `Function[ParamTypes, ReturnType]`. Curried
// types (`(A) => (B) => C`) parse right-recursively. The grammar lives in
// `type_expr_atom`; lambda parsing only fires at expression positions, so
// `(Int) => Int` in type-position is unambiguous.

test("Stage E: single-param function-type annotation accepts matching arg", () => {
  const src = `inc(x: Int): Int => x + 1
apply1(f: (Int) => Int, x: Int): Int => f(x)
apply1(inc, 41)
`;
  const result = evalStd(src);
  eq(Number((dataOf(result!) as BitsValue).data), 42);
});

test("Stage E: multi-param function-type annotation accepts matching arg", () => {
  const src = `add(x: Int, y: Int): Int => x + y
apply2(f: (Int, Int) => Int, a: Int, b: Int): Int => f(a, b)
apply2(add, 3, 4)
`;
  const result = evalStd(src);
  eq(Number((dataOf(result!) as BitsValue).data), 7);
});

test("Stage E: zero-param function-type annotation works", () => {
  const src = `get_99(): Int => 99
run(f: () => Int): Int => f()
run(get_99)
`;
  const result = evalStd(src);
  eq(Number((dataOf(result!) as BitsValue).data), 99);
});

test("Stage E: curried function-type return parses right-recursively", () => {
  // `(Int) => (Int) => Int` parses as `(Int) => ((Int) => Int)` — a
  // function from Int returning a function from Int to Int.
  const src = `add(x: Int, y: Int): Int => x + y
apply_curried(f: (Int) => (Int) => Int, a: Int, b: Int): Int =>
  (f(a))(b)
make_adder(n: Int): (Int) => Int =>
  (x: Int): Int => x + n
apply_curried(make_adder, 3, 4)
`;
  const result = evalStd(src);
  eq(Number((dataOf(result!) as BitsValue).data), 7);
});

test("Stage E: function-type as binding annotation accepts matching value", () => {
  const src = `id_int(x: Int): Int => x
y: (Int) => Int = id_int
y(42)
`;
  const result = evalStd(src);
  eq(Number((dataOf(result!) as BitsValue).data), 42);
});

test("Stage E: function-type rejects non-function arg at call site", () => {
  // Passing a non-function where a function-type is expected fires the
  // standard type_check rejection.
  const src = `apply1(f: (Int) => Int, x: Int): Int => f(x)
apply1(42, 5)
`;
  let threw = false;
  try { runtimeEval(src, undefined, [typeExt], undefined, true); }
  catch (e: any) { threw = true; }
  eq(threw, true, "passing 42 instead of a function should fail");
});

test("Stage E: type_function primitive lowers to FunctionType[paramTypes, returnType]", () => {
  // The grammar emits `type_function(paramType1, …, returnType)`; the
  // primitive turns it into a concrete FunctionType identical to what
  // `makeFunctionType` produces in TypeScript.
  const src = `t = type_function(Int, Int)
t
`;
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const v = evalCtx.bindings.get("t")!.value!;
  const p = dataOf(v);
  eq(p.kind, ValueKind.Structure);
  if (p.kind === ValueKind.Structure) {
    const name = getName(p);
    eq(name?.kind === ValueKind.Bits ? bitsToString(name as BitsValue) : null, "Function");
  }
});

test("Stage E: zero-param type_function emits Function[arr(), R]", () => {
  const src = `t = type_function(Int)
t
`;
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const v = evalCtx.bindings.get("t")!.value!;
  const p = dataOf(v);
  if (p.kind === ValueKind.Structure) {
    const name = getName(p);
    eq(name?.kind === ValueKind.Bits ? bitsToString(name as BitsValue) : null, "Function");
  }
});

test("Stage E: function-type used as Array element type", () => {
  // Compose with generics: `Array[(Int) => Int]` — array of functions.
  const src = `inc(x: Int): Int => x + 1
dbl(x: Int): Int => x * 2
fns: Array[(Int) => Int] = [inc, dbl]
fns[0](5) + fns[1](5)
`;
  const result = evalStd(src);
  eq(Number((dataOf(result!) as BitsValue).data), 16);
});

test("Stage E: function-type compatible with return-type annotation", () => {
  // make_adder: returns a function (closure over n). Annotation `(Int) => Int`
  // verifies the lambda's inferred type matches.
  const src = `make_adder(n: Int): (Int) => Int =>
  (x: Int): Int => x + n
add5 = make_adder(5)
add5(10)
`;
  const result = evalStd(src);
  eq(Number((dataOf(result!) as BitsValue).data), 15);
});

// --- Phase D1 Slice 2 Stage F1: effects-as-component substrate (PE-driven) ---
//
// Effects move from a parallel walker pass into a first-class MultiValue
// component populated by partial evaluation. `applyPrimitive` propagates
// effects from the primitive's static tags + each evaluated arg's `effects`
// component + the result's own component (when method dispatch attaches it).
// Lazy primitives accumulate via a tracking `evalFn` wrapper — seq, eval_if
// (Rule 2), effects_attach all union effects from their subcalls without
// per-primitive bookkeeping. Function values get their inferred effect set
// stamped at precompile time so `effectsOf(fn)` returns it directly without
// invoking the walker.

test("Stage F1: print result carries io effect via component", () => {
  const { value } = runtimeEval(`print(42)\n`, undefined, [typeExt], undefined, true);
  eq(value !== null, true);
  const eff = effectsOf(value!);
  eq(eff !== null, true);
  eq(eff?.has("io"), true, `expected io, got: ${[...(eff ?? [])].join(",")}`);
});

test("Stage F1: pure arithmetic carries no effects component", () => {
  const { value } = runtimeEval(`1 + 2\n`, undefined, [typeExt], undefined, true);
  const eff = value ? effectsOf(value) : null;
  eq(eff === null || eff.size === 0, true,
     `expected no effects, got: ${eff ? [...eff].join(",") : "null"}`);
});

test("Stage F1: effects propagate through deferred residual into outer call", () => {
  // print returns its arg; `0 + print(5)` evaluates print eagerly (firing io)
  // and threads the {io} component through bits_add's arg-effect union.
  const { value } = runtimeEval(`0 + print(5)\n`, undefined, [typeExt], undefined, true);
  const eff = value ? effectsOf(value) : null;
  eq(eff?.has("io"), true, `expected io to propagate, got: ${eff ? [...eff].join(",") : "null"}`);
});

test("Stage F1: eval_if Rule 2 unions effects from both branches in residual", () => {
  // Cond unresolved at compile time (function-param) → both branches PE'd →
  // residual carries union of branch effects.
  const src = `maybe_log(x: Int, flag: Int): Int =>
  if flag == 0 then print(x) else x
maybe_log
`;
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const fn = evalCtx.bindings.get("maybe_log")!.value!;
  const eff = effectsOf(fn);
  eq(eff?.has("io"), true, `expected io from then-branch, got: ${eff ? [...eff].join(",") : "null"}`);
});

test("Stage F1: pure function value has no effects component", () => {
  const src = `sq(x: Int): Int => x * x\nsq\n`;
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const fn = evalCtx.bindings.get("sq")!.value!;
  const eff = effectsOf(fn);
  eq(eff === null || eff.size === 0, true,
     `expected no effects on pure fn, got: ${eff ? [...eff].join(",") : "null"}`);
});

test("Stage F1: io function value carries io effects component", () => {
  const src = `greet(x: Int): Int => print(x)\ngreet\n`;
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const fn = evalCtx.bindings.get("greet")!.value!;
  const eff = effectsOf(fn);
  eq(eff?.has("io"), true, `expected io on greet, got: ${eff ? [...eff].join(",") : "null"}`);
});

test("Stage F1: transitive call propagates effects through PE", () => {
  // outer calls inner; inner calls print. PE evaluates outer's body, which
  // evaluates inner's call, which propagates print's io effect upward.
  const src = `inner(x: Int): Int => print(x)
outer(x: Int): Int => inner(x)
outer
`;
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const fn = evalCtx.bindings.get("outer")!.value!;
  const eff = effectsOf(fn);
  eq(eff?.has("io"), true, `expected io to propagate through outer, got: ${eff ? [...eff].join(",") : "null"}`);
});

test("Stage F1: withEffects union with prior set", () => {
  // Direct unit test on the helper.
  const v = makeInt(42);
  const v1 = withEffects(v, new Set(["io"]));
  const v2 = withEffects(v1, new Set(["net"]));
  const eff = effectsOf(v2);
  eq(eff?.has("io"), true);
  eq(eff?.has("net"), true);
  eq(eff?.size, 2);
});

test("Stage F1: empty effects on a value with no prior set is a no-op", () => {
  const v = makeInt(42);
  const v1 = withEffects(v, new Set());
  // No wrapping should occur when there's nothing to add.
  eq(v1, v, "expected the same value back");
});

// --- Phase D1 Slice 2 Stage F2: consumer migration to the effects
//                                 component + Param.effectBound + PE-driven
//                                 polymorphic propagation ---

test("Stage F2: Param.effectBound carries Surface A pure annotation", () => {
  const src = `bounded(f: pure): Int => f(0)\nbounded\n`;
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const fn = dataOf(evalCtx.bindings.get("bounded")!.value!);
  if (fn.kind === ValueKind.ComposedFunction) {
    const bound = (fn.params[0] as any).effectBound;
    eq(bound !== undefined, true, "f should carry effectBound");
    eq(bound?.size, 0, "pure has empty labels");
    // Predicate-set-based storage is no longer used for effects.
    eq(fn.params[0].predicates, undefined, "predicates slot stays empty");
  }
});

test("Stage F2: PE residual at unresolved-Param call carries the effect variable", () => {
  // F2c: when PE evaluates `Expression(Param_with_effectVar, args)`, the
  // residual carries the declared variable's BARE name via the effects
  // component (C7.2c: no marker prefix). This is what lets polymorphic
  // functions populate __inferredEffects for the outer function during
  // precompile.
  const src = `apply[e: Effect](g: e, x: Int): Int => g(x)\napply\n`;
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const fn = evalCtx.bindings.get("apply")!.value!;
  const eff = effectsOf(fn);
  eq(eff?.has("e"), true,
     `expected effect variable 'e' on apply, got: ${eff ? [...eff].join(",") : "none"}`);
});

test("Stage F2: polymorphic apply propagates io callback's effects to caller", () => {
  // End-to-end: caller calls apply with an io-tagged callback. PE walks
  // through apply's body (using Param-call effect propagation), substitutes
  // the callback at the call site, and surfaces io on caller's effects.
  const src = `apply[e: Effect](g: e, x: Int): Int => g(x)
caller(x: Int): Int => apply((y: Int): Int => print(y), x)
caller
`;
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const fn = evalCtx.bindings.get("caller")!.value!;
  const eff = effectsOf(fn);
  eq(eff?.has("io"), true,
     `expected io to propagate, got: ${eff ? [...eff].join(",") : "none"}`);
});

test("Stage F2: unannotated function-typed Param stays opaque", () => {
  // No effectBound on f → PE Param-call branch defaults to opaque,
  // matching the walker's conservative semantics.
  const src = `forwarder(f, x: Int): Int => f(x)\nforwarder\n`;
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const fn = evalCtx.bindings.get("forwarder")!.value!;
  const eff = effectsOf(fn);
  eq(eff?.has("opaque"), true,
     `expected opaque from unannotated param call, got: ${eff ? [...eff].join(",") : "none"}`);
});

test("Stage F2: checkEffectsDeclarations reads __inferredEffects (no walker call)", () => {
  // Hand-built effects_attach to declare a mismatching pure bound. If
  // checkEffectsDeclarations reads the PE-stashed set correctly, the
  // mismatch should still fire (inferred io ⊄ declared pure).
  const src = `bad(x: Int): Int =>
  effects_attach(seq(print(x), x), typed_array())
`;
  let threw = false;
  try { runtimeEval(src, undefined, [typeExt], undefined, true); }
  catch (e: any) { threw = true; }
  eq(threw, true, "pure declaration with io body should still halt under F2");
});

test("Stage F2: introspection reads inferred effects from component (when populated)", () => {
  // After precompile, the function value's __inferredEffects is set; the
  // inspector reads it directly.
  const src = `greet(x: Int): Int => print(x)\n`;
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const fn = evalCtx.bindings.get("greet")!.value!;
  const summary = summarizeValue(fn);
  eq(summary.inferredEffects?.has("io"), true);
});

// --- Phase D1 Slice 2 Stage F3a: compile-time deferral of effectful primitives ---
//
// When PE evaluates a primitive's args inside a function body being
// precompiled (`ctx.__compileMode = true`) and the primitive carries a
// non-empty `.effects` tag, applyPrimitive returns a residual `makeExpr(fn,
// evalArgs)` instead of executing the impl. The residual still carries the
// effects component so callers see the inferred set; the side effect itself
// fires when the function is invoked at runtime, where ctx isn't compile-mode.
//
// This fixes a long-standing latent issue where `print("trace")` inside a
// function body fired during compile (precompile evaluated the body for
// type/effect inference, and lazy primitives like print bypassed any
// deferral check).

test("Stage F3a: print inside a function body does NOT fire at compile time", () => {
  // Capture stdout to verify nothing prints during precompile.
  const captured: string[] = [];
  const origLog = console.log;
  console.log = (...args: any[]) => { captured.push(args.join(" ")); };
  try {
    runtimeEval(`unused(x: Int): Int =>
  print(x)
`, undefined, [typeExt], undefined, true);
  } finally {
    console.log = origLog;
  }
  eq(captured.length, 0, `expected no compile-time prints, got: ${captured.join(",")}`);
});

test("Stage F3a: print fires when the function is actually called at runtime", () => {
  const captured: string[] = [];
  const origLog = console.log;
  console.log = (...args: any[]) => { captured.push(args.join(" ")); };
  try {
    runtimeEval(`f(x: Int): Int =>
  print(x)
f(42)
`, undefined, [typeExt], undefined, true);
  } finally {
    console.log = origLog;
  }
  eq(captured.length, 1, `expected exactly one print, got: ${captured.join(",")}`);
  eq(captured[0], "42");
});

test("Stage F3a: top-level print fires immediately (not in compile-mode)", () => {
  const captured: string[] = [];
  const origLog = console.log;
  console.log = (...args: any[]) => { captured.push(args.join(" ")); };
  try {
    runtimeEval(`print(99)\n`, undefined, [typeExt], undefined, true);
  } finally {
    console.log = origLog;
  }
  eq(captured.length, 1, "top-level print should fire");
  eq(captured[0], "99");
});

test("Stage F3a: pure primitives still fold at compile time", () => {
  // Arithmetic on resolved literals continues to evaluate eagerly during
  // precompile — only effectful primitives defer.
  const src = `sq(x: Int): Int => x * x\nsq(7)\n`;
  const result = evalStd(src);
  eq(Number((dataOf(result!) as BitsValue).data), 49);
});

test("Stage F3a: deferred residual carries effects component", () => {
  // The residual `print("trace")` inside a function body still surfaces
  // its io effect upward via the effects MultiValue component, so the
  // function value's __inferredEffects picks it up.
  const src = `f(x: Int): Int =>
  effects_attach(seq(print(x), x), typed_array(io))
f
`;
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const fn = evalCtx.bindings.get("f")!.value!;
  const eff = effectsOf(fn);
  eq(eff?.has("io"), true,
     `expected io on f even with deferred print, got: ${eff ? [...eff].join(",") : "none"}`);
});

test("Stage F3a: declaration check still fires under deferral (mismatch detected)", () => {
  // `print` doesn't fire during precompile, but its effect tag flows
  // through PE into the inferred set, so a `pure` declaration mismatch
  // is still caught.
  const src = `bad(x: Int): Int =>
  effects_attach(seq(print(x), x), typed_array())
`;
  let threw = false;
  try { runtimeEval(src, undefined, [typeExt], undefined, true); }
  catch (e: any) { threw = true; }
  eq(threw, true, "mismatch check should still fire under F3a deferral");
});

// --- Phase D1 Slice 2 Stage F3b: stdlib HOF migration ---
//
// With F1 PE-driven effects + F2 polymorphic propagation + F3a compile-time
// deferral all in place, the Slice-1.3 `opaque` placeholders on Array.map /
// filter / reduce + the walker's HOF heuristic become unnecessary. F3b
// removes both. Inline typed lambdas (`arr.map((x: Int): Int => print(x))`)
// get their own __inferredEffects via a precompile-on-evaluate hook in
// `typed_function_impl`, so callers see the precise propagation.

test("Stage F3b: arr.map(pure_cb) yields no effects", () => {
  const src = `dbl(arr: Array[Int]): Array[Int] =>
  arr.map((x: Int): Int => x * 2)
dbl
`;
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const fn = evalCtx.bindings.get("dbl")!.value!;
  const eff = effectsOf(fn);
  // No opaque (it's gone) and no io (the cb is pure).
  eq(eff?.has("opaque") ?? false, false);
  eq(eff?.has("io") ?? false, false);
});

test("Stage F3b: arr.map(io_cb) propagates io to caller", () => {
  const src = `print_each(arr: Array[Int]): Array[Int] =>
  arr.map((x: Int): Int => print(x))
print_each
`;
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const fn = evalCtx.bindings.get("print_each")!.value!;
  const eff = effectsOf(fn);
  eq(eff?.has("io"), true,
     `expected io from arr.map(print_cb), got: ${eff ? [...eff].join(",") : "none"}`);
});

test("Stage F3b: arr.filter(io_cb) propagates io", () => {
  const src = `noisy(arr: Array[Int]): Array[Int] =>
  arr.filter((x: Int): Int => print(x))
noisy
`;
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const fn = evalCtx.bindings.get("noisy")!.value!;
  const eff = effectsOf(fn);
  eq(eff?.has("io"), true);
});

test("Stage F3b: arr.reduce(io_combiner, init) propagates io", () => {
  const src = `dump(arr: Array[Int]): Int =>
  arr.reduce((a: Int, x: Int): Int => print(x), 0)
dump
`;
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const fn = evalCtx.bindings.get("dump")!.value!;
  const eff = effectsOf(fn);
  eq(eff?.has("io"), true);
});

test("Stage F3b: typed_function_impl precompiles inline lambdas (effects component populated)", () => {
  // Direct test of the precompile-on-evaluate hook: an inline typed lambda
  // gets its __inferredEffects set when the typed_function expression is
  // evaluated, even though it isn't a top-level binding for
  // precompileFunctions to see.
  const src = `f(): (Int) => Int =>
  (x: Int): Int => print(x)
f
`;
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  // f returns the inline lambda when called; for direct verification call
  // f() and check the returned lambda's effects component.
  const f = evalCtx.bindings.get("f")!.value!;
  const fnPrim = dataOf(f);
  if (fnPrim.kind === ValueKind.ComposedFunction) {
    // f is pure (returns a function value, doesn't fire io itself).
    // But the lambda it returns carries io. f's __inferredEffects is none;
    // the returned lambda's effects (eventually surfaced through the call)
    // come from PE walking the body. Direct test below.
    const eff = effectsOf(f);
    eq(eff?.has("opaque") ?? false, false);
  }
});

test("Stage F3b: declaration check via PE catches mismatch through HOF", () => {
  // Effects-attach with a pure declaration; body uses arr.map(io_cb).
  // F3b: precise propagation means the io effect surfaces and the mismatch
  // fires. (Pre-F3b this would be filtered as opaque and emit a notification.)
  const src = `bad(arr: Array[Int]): Array[Int] =>
  effects_attach(arr.map((x: Int): Int => print(x)), typed_array())
`;
  let threw = false;
  let msg = "";
  try { runtimeEval(src, undefined, [typeExt], undefined, true); }
  catch (e: any) { threw = true; msg = String(e.message ?? e); }
  eq(threw, true, "expected mismatch to fire via HOF callback effect propagation");
  eq(msg.includes("io"), true, `expected io in mismatch, got: ${msg}`);
});

test("Stage F2: f: pure rejection still works against the new effects component", () => {
  // checkArgType now reads effectsOf(arg) instead of effectPredicatesForValue.
  // For typed functions whose effects component is populated by PE, the
  // bound discharge runs against the component.
  const src = `pure_caller(f: pure): Int => 42
greet(name: String): String =>
  print("hi " + name)
  name
pure_caller(greet)
`;
  let threw = false;
  let msg = "";
  try { runtimeEval(src, undefined, [typeExt], undefined, true); }
  catch (e: any) { threw = true; msg = e.message; }
  eq(threw, true, "expected effect-bound rejection");
  eq(msg.includes("pure"), true);
  eq(msg.includes("io"), true);
});

test("Stage C3: typed function declaration check now fires (asFunction peels typed_function)", () => {
  // Pre-C3, typed function bindings stayed as `typed_function(…)` Expressions
  // at compile time, so checkEffectsDeclarations couldn't reach the body.
  // Stage C3's asFunction peels the Expression to find the inner function.
  // The block preprocessor wraps `effects_attach(body, …)` inside the
  // `type_check(…, returnType)` envelope `maybeTyped` adds; Stage C3's
  // unwrapEffectsAttach peels the type_check layer too.
  const src = `bad(x: Int): Int =>
  effects_attach(seq(print(x), x), typed_array())
`;
  let threw = false;
  let msg = "";
  try {
    runtimeEval(src, undefined, [typeExt], undefined, true);
  } catch (e: any) {
    threw = true; msg = String(e.message ?? e);
  }
  eq(threw, true, "typed-function mismatch should now halt");
  eq(msg.toLowerCase().includes("effects mismatch"), true,
     `expected 'effects mismatch' in message, got: ${msg}`);
  eq(msg.toLowerCase().includes("undeclared: io"), true,
     `expected 'undeclared: io' in message, got: ${msg}`);
});

// --- Phase D1 sub-chunk 1.3: opaque marking + Notification category ---

test("Phase D1.3: CompilationReport carries notifications array", () => {
  const src = `x = 42\n`;
  const { compilationReport } = runtimeEval(src, undefined, [typeExt], undefined, true);
  eq(Array.isArray(compilationReport!.notifications), true);
});

test("Phase D1.3 (F3b): pure callback through Array.map does NOT mark caller opaque", () => {
  // F3b removed the opaque tags + walker heuristic. PE-driven propagation +
  // inline-lambda precompile make `arr.map(pure_cb)` infer no effects.
  const src = `dbl(arr: Array[Int]): Array[Int] => arr.map((x: Int): Int => x * 2)\ndbl\n`;
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const fn = evalCtx.bindings.get("dbl")!.value!;
  const eff = effectsOf(fn);
  // No opaque, no io — pure callback transparently propagates.
  eq(eff?.has("opaque") ?? false, false, `expected no opaque, got: ${eff ? [...eff].join(",") : "none"}`);
});

test("Phase D1.3 (F3b): io callback through Array.map propagates io to caller", () => {
  // F3b: this is the precise replacement for the old "opaque inferred"
  // behaviour. The callback's io effect flows through the HOF.
  const src = `dump(arr: Array[Int]): Array[Int] => arr.map((x: Int): Int => print(x))\ndump\n`;
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const fn = evalCtx.bindings.get("dump")!.value!;
  const eff = effectsOf(fn);
  eq(eff?.has("io"), true,
     `expected io to propagate through arr.map, got: ${eff ? [...eff].join(",") : "none"}`);
});

test("Phase D1.3 (F3b): no opaque-from-stdlib-hof notification fires after the migration", () => {
  // The notification was a Slice-1.3 placeholder for the soundness gap.
  // F3b closes the gap; no notification should fire for normal HOF use.
  const src = `dbl(arr: Array[Int]): Array[Int] => arr.map((x: Int): Int => x * 2)\n`;
  const { compilationReport } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const notes = compilationReport!.notifications.filter(n => n.kind === "effects-opaque-from-stdlib-hof");
  eq(notes.length, 0, `expected no opaque notifications, got ${notes.length}`);
});

test("Phase D1.3: function with effects pure calling map does NOT halt (notification only)", () => {
  // Without 1.3's filter, this would error: declared pure but inferred {opaque}.
  // With the filter, opaque is excluded from mismatch check; instead a
  // notification is emitted. The user's pure declaration is accepted.
  const src = `dbl(arr) =>
  effects_attach(
    arr.map(x => x * 2),
    typed_array()
  )
`;
  let threw = false;
  try {
    runtimeEval(src, undefined, [typeExt], undefined, true);
  } catch (e: any) {
    threw = true;
  }
  eq(threw, false, "opaque-only mismatch should not halt compilation");
});

test("Phase D1.3: pure function NOT calling stdlib HOF emits no opaque notification", () => {
  const src = `sq(x) =>
  x * x
`;
  const { compilationReport } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const notes = compilationReport!.notifications.filter(
    n => n.kind === "effects-opaque-from-stdlib-hof" && n.binding === "sq"
  );
  eq(notes.length, 0);
});

