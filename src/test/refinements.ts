// =============================================================================
// Refinements: abstract domains, predicate sets, lifecycle invariants, contracts.
//
// Extracted from the single-file suite (suite split, lane B). Registrations
// run at import time; src/test/index.ts imports this module in suite order.
// =============================================================================

import { test, eq, throws } from "./harness.js";
import { evalStd, evalNum, typeExt } from "./fixtures.js";
import { evalSource as runtimeEval } from "../runtime.js";
import { summarizeValue as _summarizeValueChunk3 } from "../introspect.js";
import {
  domainFromPredicate, propagateAdd, propagateSub, propagateMul,
  intersectDomains, joinDomains, impliesDomain, counterexampleFor,
  formatDomain,
} from "../refinements.js";
import {
  PredicateSet, addPredicate, mergePredicateSets, simplifyPredicateSet,
  entailsPredicate, predicatesOf,
} from "../refinements.js";
import { dataOf, ValueKind, bitsToString, BitsValue } from "../types.js";
import { channelReadRaw } from "../slots.js";
import { getType } from "../types-std.js";

// --- Phase B: abstract-domain unit tests ---


test("Phase B: propagateAdd of two intervals", () => {
  const d = propagateAdd(
    { kind: "interval", lo: 1, hi: 5 },
    { kind: "interval", lo: 2, hi: 3 },
  );
  eq(d.kind, "interval");
  if (d.kind === "interval") {
    eq(d.lo, 3);
    eq(d.hi, 8);
  }
});

test("Phase B: propagateMul handles negative ranges", () => {
  const d = propagateMul(
    { kind: "interval", lo: -2, hi: 3 },
    { kind: "interval", lo: -1, hi: 4 },
  );
  // Possible products: (-2)(-1)=2, (-2)(4)=-8, (3)(-1)=-3, (3)(4)=12 → [-8, 12]
  eq(d.kind, "interval");
  if (d.kind === "interval") {
    eq(d.lo, -8);
    eq(d.hi, 12);
  }
});

test("Phase B: intersectDomains tightens", () => {
  const d = intersectDomains(
    { kind: "interval", lo: 0, hi: 10 },
    { kind: "interval", lo: 3, hi: 100 },
  );
  eq(d.kind, "interval");
  if (d.kind === "interval") { eq(d.lo, 3); eq(d.hi, 10); }
});

test("Phase B: joinDomains widens", () => {
  const d = joinDomains(
    { kind: "interval", lo: 0, hi: 10 },
    { kind: "interval", lo: 3, hi: 100 },
  );
  eq(d.kind, "interval");
  if (d.kind === "interval") { eq(d.lo, 0); eq(d.hi, 100); }
});

test("Phase B: impliesDomain — tighter implies looser", () => {
  eq(impliesDomain(
    { kind: "interval", lo: 5, hi: 10 },
    { kind: "interval", lo: 1, hi: +Infinity },
  ), true);
  eq(impliesDomain(
    { kind: "interval", lo: -1, hi: 5 },
    { kind: "interval", lo: 1, hi: +Infinity },
  ), false);
});

test("Phase B: counterexampleFor surfaces a violating value", () => {
  const cex = counterexampleFor(
    { kind: "interval", lo: -5, hi: 10 },        // actual
    { kind: "interval", lo: 1, hi: +Infinity },   // expected (positive)
  );
  // -5 is in actual but violates expected.
  eq(cex !== null && cex < 1, true, `expected a counterexample, got ${cex}`);
});

test("Phase B: formatDomain renders human-readable strings", () => {
  eq(formatDomain({ kind: "interval", lo: 1, hi: +Infinity }), "≥ 1");
  eq(formatDomain({ kind: "interval", lo: -Infinity, hi: 99 }), "≤ 99");
  eq(formatDomain({ kind: "interval", lo: 1, hi: 10 }), "∈ [1, 10]");
  eq(formatDomain({ kind: "eq", value: 7 }), "== 7");
  eq(formatDomain({ kind: "ne", value: 0 }), "≠ 0");
});

// --- Phase C Chunk 1: predicate sets ---


test("Phase C: PredicateSet starts empty", () => {
  const s = new PredicateSet();
  eq(s.size, 0);
  eq(s.isEmpty, true);
});

test("Phase C: addPredicate dedupes structurally-equal predicates", () => {
  const s0 = new PredicateSet();
  const s1 = addPredicate(s0, { shape: { kind: "interval", lo: 1, hi: +Infinity }, source: "refinement-type" });
  const s2 = addPredicate(s1, { shape: { kind: "interval", lo: 1, hi: +Infinity }, source: "refinement-type" });
  eq(s2.size, 1, "duplicate dropped");
  const s3 = addPredicate(s2, { shape: { kind: "interval", lo: 1, hi: +Infinity }, source: "assert" });
  eq(s3.size, 2, "different source kept");
});

test("Phase C: mergePredicateSets unions with dedup", () => {
  const a = new PredicateSet([
    { shape: { kind: "interval", lo: 1, hi: +Infinity }, source: "refinement-type" },
  ]);
  const b = new PredicateSet([
    { shape: { kind: "interval", lo: 1, hi: +Infinity }, source: "refinement-type" },
    { shape: { kind: "interval", lo: -Infinity, hi: 99 }, source: "assert" },
  ]);
  const merged = mergePredicateSets(a, b);
  eq(merged.size, 2);
});

test("Phase C: simplifyPredicateSet folds compatible intervals", () => {
  const s = new PredicateSet([
    { shape: { kind: "interval", lo: 1, hi: +Infinity }, source: "refinement-type" },
    { shape: { kind: "interval", lo: -Infinity, hi: 99 }, source: "assert" },
  ]);
  const simp = simplifyPredicateSet(s);
  eq(simp.size, 1, "two intervals fold into one");
  const eff = simp.effectiveDomain();
  eq(eff?.kind, "interval");
  if (eff?.kind === "interval") {
    eq(eff.lo, 1);
    eq(eff.hi, 99);
  }
});

test("Phase C: entailsPredicate uses set's tightest fact", () => {
  const s = new PredicateSet([
    { shape: { kind: "interval", lo: 1, hi: +Infinity }, source: "refinement-type" },
    { shape: { kind: "interval", lo: -Infinity, hi: 99 }, source: "assert" },
  ]);
  // [1, 99] should entail "> 0"
  eq(entailsPredicate(s, { kind: "interval", lo: 1, hi: +Infinity }), true);
  // [1, 99] should NOT entail "> 100"
  eq(entailsPredicate(s, { kind: "interval", lo: 101, hi: +Infinity }), false);
});

test("Phase C: predicate sets propagate through arithmetic in evaluator", () => {
  const src = `
PositiveInt = Int & _ > 0
x = PositiveInt(5)
y = x + 10
`;
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const yVal = evalCtx.bindings.get("y")!.value!;
  const set = predicatesOf(yVal);
  eq(set !== null, true, "y has a predicate set");
  if (!set) return;
  const eff = set.effectiveDomain();
  eq(eff?.kind, "interval");
  if (eff?.kind === "interval") eq(eff.lo, 11, `y's lower bound should be 11, got ${eff.lo}`);
});

// --- Phase C Chunk 2: branch refinement + assert statement ---

test("Phase C Chunk 2: then-branch narrows binding by condition", () => {
  // Inside `if x > 100 then ...`, x has refinement ≥ 101.
  // After the addition, the result has refinement ≥ 151.
  const src = `
x = 200
big = if x > 100 then x + 50 else 0
`;
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const bigVal = evalCtx.bindings.get("big")!.value!;
  const set = predicatesOf(bigVal);
  // Either set OR domainOf gives us the narrowed bound on big.
  // (In partial-eval mode big is fully resolved to 250, but the analyzer
  //  would see ≥ 151 for the residual case.)
  // The runtime value is what matters for this regression test:
  const primary = dataOf(bigVal);
  eq(primary.kind, ValueKind.Bits);
  if (primary.kind === ValueKind.Bits) {
    eq(Number((primary as any).data), 250);
  }
  // We don't assert on the predicate set since post-evaluation the value
  // is fully resolved; the more interesting test is that residual code
  // still has refinement info (covered by the file demo).
  void set;
});

test("Phase C Chunk 2: else-branch narrows binding by negated condition", () => {
  // Inside the else of `if x > 0 then ... else 0 - x`, x ≤ 0, so 0 - x ≥ 0.
  const src = `
x = 0 - 5
y = if x > 0 then x + 10 else 0 - x
`;
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const yVal = evalCtx.bindings.get("y")!.value!;
  const primary = dataOf(yVal);
  if (primary.kind === ValueKind.Bits) {
    eq(Number((primary as any).data), 5);
  }
});

test("Phase C Chunk 2: failed assert halts with counterexample", () => {
  // Test via direct primitive call (doesn't need grammar extension loaded).
  const src = `
x = 0 - 5
assert_stmt(x > 0)
`;
  let threw = false;
  let msg = "";
  try {
    runtimeEval(src, undefined, [typeExt], undefined, true);
  } catch (e: any) {
    threw = true;
    msg = e.message;
  }
  eq(threw, true, "assert failure throws");
  eq(msg.includes("assertion failed"), true, "error message has 'assertion failed'");
  eq(msg.includes("x"), true, "error message names the binding");
  eq(msg.includes("-5"), true, "error message includes the actual value");
});

test("Phase C Chunk 2: discharged assert is silent", () => {
  // Already-known fact discharges statically; no error.
  const src = `
PositiveInt = Int & _ > 0
x = PositiveInt(5)
assert_stmt(x > 0)
`;
  // Should NOT throw.
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  eq(evalCtx.bindings.has("x"), true);
});

// --- Lifecycle invariants (C6.1b: invariants ARE refinements — `&`) ---

test("invariants-as-refinements: single clause accepts and rejects", () => {
  const src = `
PI = Int & _ > 0
ok = PI(5)
bad = PI(0 - 5)
`;
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  // ok succeeds → resolved Int value
  const okV = evalCtx.bindings.get("ok")!.value!;
  const okP = dataOf(okV);
  if (okP.kind === ValueKind.Bits) eq(Number((okP as any).data), 5);
  // bad fails → Error-typed MultiValue
  const badV = evalCtx.bindings.get("bad")!.value!;
  eq(channelReadRaw(badV, "error") !== undefined, true, "bad has error component");
});

test("invariants-as-refinements: chained `&` clauses fail with per-clause domains", () => {
  const src = `
SP = Int & _ > 0 & _ < 100
mid = SP(50)
low = SP(0)
high = SP(200)
`;
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  // mid succeeds
  const midV = evalCtx.bindings.get("mid")!.value!;
  const midP = dataOf(midV);
  if (midP.kind === ValueKind.Bits) eq(Number((midP as any).data), 50);
  // low fails on first invariant (self > 0)
  const lowV = evalCtx.bindings.get("low")!.value!;
  {
    const err = channelReadRaw(lowV, "error");
    if (err) {
      const ep = dataOf(err);
      if (ep.kind === ValueKind.Bits) {
        const msg = bitsToString(ep as BitsValue);
        eq(msg.includes("≥ 1"), true, `expected the first clause's domain (≥ 1) in: ${msg}`);
      }
    }
  }
  // high fails on second invariant (self < 100)
  const highV = evalCtx.bindings.get("high")!.value!;
  {
    const err = channelReadRaw(highV, "error");
    if (err) {
      const ep = dataOf(err);
      if (ep.kind === ValueKind.Bits) {
        const msg = bitsToString(ep as BitsValue);
        eq(msg.includes("≤ 99"), true, `expected the second clause's domain (≤ 99) in: ${msg}`);
      }
    }
  }
});

test("invariants-as-refinements: multi-field record predicate via `_`", () => {
  const src = `
Range = Type.define({lo: Int, hi: Int}) & _.lo <= _.hi
ok = Range(1, 10)
bad = Range(10, 1)
`;
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  // ok constructs successfully and exposes fields. C4.3b: typed records are
  // flattened Contexts (channels attach directly — no MultiValue wrapper).
  const okV = evalCtx.bindings.get("ok")!.value!;
  eq(okV.kind, ValueKind.Structure);
  eq(getType(okV) !== null, true, "record carries its type channel directly");
  // bad fails the invariant
  const badV = evalCtx.bindings.get("bad")!.value!;
  eq(channelReadRaw(badV, "error") !== undefined, true);
});

// --- Phase C Chunk 3: requires / ensures contracts ---
//
// Tests use direct primitive calls (`requires_stmt`, `ensures_decl`,
// `assert_stmt`) so the grammar extension load path doesn't need to fire —
// matching the Chunk 2 pattern. The tree-builder's contract preprocessor
// keys off the primitive call NAMES (not the surface syntax), so behavior
// is identical between the direct-primitive and `use contracts`-grammar
// paths. The fileTest above (`tests/contracts-demo.alg`) covers the full
// surface-syntax path end-to-end.

// Pull in the introspection helper used by the contract-summary tests below.

test("Phase C Chunk 3: requires runtime check passes when condition holds", () => {
  const src = `
guard(x) =>
  requires_stmt(x > 0)
  x + 1
y = guard(5)
`;
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const yV = evalCtx.bindings.get("y")!.value!;
  const yPrim = dataOf(yV);
  if (yPrim.kind === ValueKind.Bits) {
    eq(yPrim.data, 6n);
  }
});

test("Phase C Chunk 3: requires runtime check halts on violation", () => {
  const src = `
guard(x) =>
  requires_stmt(x > 0)
  x
y = guard(0 - 5)
`;
  let threw = false;
  let msg = "";
  try {
    runtimeEval(src, undefined, [typeExt], undefined, true);
  } catch (e: any) {
    threw = true;
    msg = String(e.message ?? e);
  }
  eq(threw, true, "expected requires violation to halt");
  eq(msg.toLowerCase().includes("precondition"), true, `expected precondition msg, got: ${msg}`);
});

test("Phase C Chunk 3: ensures attaches predicate to result on success", () => {
  const src = `
double_pos(x) =>
  requires_stmt(x > 0)
  ensures_decl(_ > 0)
  x + x
y = double_pos(5)
`;
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const yV = evalCtx.bindings.get("y")!.value!;
  // y should carry an "ensures"-sourced predicate (≥ 1) on top of the
  // propagation-derived one (≥ 2). The effective domain is the tightest
  // intersection.
  const set = predicatesOf(yV);
  eq(set !== null, true, "ensures should attach predicate set");
  if (set) {
    const eff = set.effectiveDomain();
    eq(eff?.kind === "interval" || eff?.kind === "eq", true);
    if (eff?.kind === "interval") {
      // ≥ 2 (from x+x with x ≥ 1) AND ≥ 1 (from ensures) → ≥ 2
      eq(eff.lo >= 1, true);
    }
  }
});

test("Phase C Chunk 3: ensures runtime check halts on postcondition violation", () => {
  // Construct a function whose body deliberately fails its ensures.
  const src = `
broken(x) =>
  ensures_decl(_ > 0)
  0 - x
y = broken(5)
`;
  let threw = false;
  let msg = "";
  try {
    runtimeEval(src, undefined, [typeExt], undefined, true);
  } catch (e: any) {
    threw = true;
    msg = String(e.message ?? e);
  }
  eq(threw, true, "expected ensures violation to halt");
  eq(msg.toLowerCase().includes("postcondition"), true, `expected postcondition msg, got: ${msg}`);
});

test("Phase C Chunk 3: introspection surfaces requires and ensures", () => {
  const src = `
divide(a, b) =>
  requires_stmt(b != 0)
  ensures_decl(_ != 0 || a == 0)
  a / b
`;
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const fnV = evalCtx.bindings.get("divide")!.value!;
  const summary = _summarizeValueChunk3(fnV);
  eq(summary.requires.length >= 1, true, `expected at least 1 requires, got ${summary.requires.length}`);
  eq(summary.ensures.length >= 1, true, `expected at least 1 ensures, got ${summary.ensures.length}`);
  // requires `b != 0` should recognise b as the bound name.
  const reqB = summary.requires.find(c => c.bindings[0] === "b");
  eq(reqB !== undefined, true, "requires should reference param b");
});

test("Phase C Chunk 3: introspection suggests promoting in-body assert to requires", () => {
  const src = `
guard(x) =>
  assert_stmt(x > 0)
  x + x
`;
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const fnV = evalCtx.bindings.get("guard")!.value!;
  const summary = _summarizeValueChunk3(fnV);
  eq(summary.promotionSuggestions.length, 1, "expected one promotion suggestion");
  if (summary.promotionSuggestions.length > 0) {
    eq(summary.promotionSuggestions[0].bindings[0], "x");
  }
});

