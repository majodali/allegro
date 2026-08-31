// =============================================================================
// Totality: exhaustiveness, termination, decreases, SCC, counterexamples.
//
// Extracted from the single-file suite (suite split, lane B). Registrations
// run at import time; src/test/index.ts imports this module in suite order.
// =============================================================================

import { test, eq, throws } from "./harness.js";
import { evalStd, evalNum, typeExt } from "./fixtures.js";
import { evalSource as runtimeEval } from "../runtime.js";
import {
  isFunctionPartial, collapseBodyMetadata,
  NOTIF_TOTALITY_EXHAUSTIVENESS, NOTIF_TOTALITY_NONTERMINATION,
  NOTIF_TOTALITY_NEEDS_ANNOTATION,
} from "../totality.js";
import * as path from "path";
import { makeInt, makeExpr, makePrimitive, makeComposedFn, ValueKind, BitsValue } from "../types.js";
import { fileTest, testsDir } from "./alg-files.js";
import { primitives as primRegistry } from "../primitives.js";
import { summarizeModule, renderModuleSummary } from "../introspect.js";

// --- Phase E Stage 0: totality substrate (`partial` opt-out) ---


test("Phase E Stage 0: notification kind constants exist", () => {
  eq(NOTIF_TOTALITY_EXHAUSTIVENESS, "totality-exhaustiveness");
  eq(NOTIF_TOTALITY_NONTERMINATION, "totality-nontermination");
  eq(NOTIF_TOTALITY_NEEDS_ANNOTATION, "totality-needs-annotation");
});

test("C1.5b: collapseBodyMetadata stashes `partial` and unwraps the body", () => {
  // Hand-build a function whose body is `partial_attach(42)` and verify the
  // collapse pass stashes partial and leaves the bare body.
  const inner = makeInt(42);
  const wrapped = makeExpr(makePrimitive("partial_attach", () => inner, true), [inner]);
  const cfn = makeComposedFn([], wrapped);
  collapseBodyMetadata(cfn);
  eq(isFunctionPartial(cfn), true);
  eq(cfn.body === inner, true);
});

test("C1.5b: collapse descends through a type_check layer", () => {
  const inner = makeInt(7);
  const wrapped = makeExpr(makePrimitive("partial_attach", () => inner, true), [inner]);
  const typed = makeExpr(makePrimitive("type_check", () => wrapped, true), [wrapped, makeInt(0)]);
  const cfn = makeComposedFn([], typed);
  collapseBodyMetadata(cfn);
  eq(isFunctionPartial(cfn), true);
  // the type_check layer remains; the attach beneath it is gone
  eq((cfn.body as any).args[0] === inner, true);
});

test("C1.5b: collapse leaves unwrapped bodies untouched", () => {
  const plain = makeInt(5);
  const cfn = makeComposedFn([], plain);
  collapseBodyMetadata(cfn);
  eq(isFunctionPartial(cfn), false);
  eq(cfn.body === plain, true);
});
test("Phase E Stage 0 (C1.5b form): isFunctionPartial reads the collapsed property", () => {
  // Construct: a ComposedFunction whose body is `partial_attach(42)`; the
  // collapse pass (run by evalSource in real pipelines) stashes partial.
  const body = makeInt(42);
  const wrapped = makeExpr(makePrimitive("partial_attach", () => body, true), [body]);
  const fn = makeComposedFn([], wrapped);
  collapseBodyMetadata(fn);
  eq(isFunctionPartial(fn), true);
});

test("Phase E Stage 0: isFunctionPartial returns false for un-annotated functions", () => {
  const fn = makeComposedFn([], makeInt(42));
  eq(isFunctionPartial(fn), false);
});

fileTest(path.join(testsDir, "totality-partial-demo.alg"));

// --- Phase E Stage 1: exhaustiveness check for when/is/then ---

test("Phase E Stage 1: non-exhaustive Bool fires totality-exhaustiveness", () => {
  const src = `classify(b: Bool): String =>
  when b is true then "yes"
`;
  const { compilationReport } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const notes = compilationReport!.notifications.filter(
    n => n.kind === "totality-exhaustiveness" && n.binding === "classify"
  );
  eq(notes.length, 1, `expected 1 notification, got ${notes.length}`);
  eq(notes[0].severity, "info");
  eq(notes[0].message.includes("Bool"), true);
  eq(notes[0].message.includes("false"), true);
});

test("Phase E Stage 1: complete Bool coverage is clean", () => {
  const src = `classify(b: Bool): String =>
  when b
    is true then "yes"
    is false then "no"
`;
  const { compilationReport } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const notes = compilationReport!.notifications.filter(
    n => n.kind === "totality-exhaustiveness"
  );
  eq(notes.length, 0);
});

test("Phase E Stage 1: explicit else discharges the check", () => {
  const src = `classify(b: Bool): String =>
  when b is true then "yes" else "no"
`;
  const { compilationReport } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const notes = compilationReport!.notifications.filter(
    n => n.kind === "totality-exhaustiveness"
  );
  eq(notes.length, 0);
});

test("Phase E Stage 1: wildcard `is _` discharges the check", () => {
  const src = `classify(b: Bool): String =>
  when b
    is true then "yes"
    is _ then "other"
`;
  const { compilationReport } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const notes = compilationReport!.notifications.filter(
    n => n.kind === "totality-exhaustiveness"
  );
  eq(notes.length, 0);
});

test("Phase E Stage 1: bind-to-name pattern discharges the check", () => {
  // `is n` binds the subject to `n` — matches anything, so the chain is
  // total even without an explicit else.
  const src = `classify(x: Int): String =>
  when x
    is 1 then "one"
    is n then "other"
`;
  const { compilationReport } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const notes = compilationReport!.notifications.filter(
    n => n.kind === "totality-exhaustiveness"
  );
  eq(notes.length, 0);
});

test("Phase E Stage 1: Int with no fallback fires generic note", () => {
  const src = `classify(n: Int): String =>
  when n is 0 then "zero"
`;
  const { compilationReport } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const notes = compilationReport!.notifications.filter(
    n => n.kind === "totality-exhaustiveness" && n.binding === "classify"
  );
  eq(notes.length, 1);
  eq(notes[0].message.includes("Int"), true);
});

test("Phase E Stage 1: unknown subject type stays silent", () => {
  // Untyped param: no type signature, subject type unknown — analyzer
  // doesn't emit (avoids false positives).
  const src = `classify(x) =>
  when x is 1 then "one"
`;
  const { compilationReport } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const notes = compilationReport!.notifications.filter(
    n => n.kind === "totality-exhaustiveness"
  );
  eq(notes.length, 0);
});

test("Phase E Stage 1: missing both `true` and `false`", () => {
  // Pattern is a literal that's neither true nor false (impossible, but
  // exercises the both-missing path). Use a non-Bool literal to verify
  // the message reports both missing.
  const src = `classify(b: Bool): String =>
  when b is 5 then "huh"
`;
  const { compilationReport } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const notes = compilationReport!.notifications.filter(
    n => n.kind === "totality-exhaustiveness" && n.binding === "classify"
  );
  eq(notes.length, 1);
  eq(notes[0].message.includes("both"), true);
});

fileTest(path.join(testsDir, "totality-exhaustiveness-demo.alg"));

// --- Phase E Stage 2: structural termination check ---

test("Phase E Stage 2: factorial with bounded NonNeg is provably terminating", () => {
  const src = `
NonNeg = Int & _ >= 0
factorial(n: NonNeg): Int =>
  if n == 0 then 1 else n * factorial(n - 1)
`;
  const { compilationReport } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const notes = compilationReport!.notifications.filter(
    n => n.kind === "totality-nontermination"
  );
  eq(notes.length, 0, `expected clean, got: ${JSON.stringify(notes)}`);
});

test("Phase E Stage 2: factorial with unbounded Int fires nontermination notification", () => {
  const src = `factorial(n: Int): Int =>
  if n == 0 then 1 else n * factorial(n - 1)
`;
  const { compilationReport } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const notes = compilationReport!.notifications.filter(
    n => n.kind === "totality-nontermination" && n.binding === "factorial"
  );
  eq(notes.length, 1);
  eq(notes[0].severity, "info");
  eq(notes[0].message.includes("non-negative"), true);
});

test("Phase E Stage 2: non-recursive function is silent", () => {
  const src = `square(n: Int): Int => n * n\n`;
  const { compilationReport } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const notes = compilationReport!.notifications.filter(
    n => n.kind === "totality-nontermination"
  );
  eq(notes.length, 0);
});

test("Phase E Stage 2: recursive call with no decreasing param fires", () => {
  const src = `bad(n: Int): Int => bad(n)\n`;
  const { compilationReport } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const notes = compilationReport!.notifications.filter(
    n => n.kind === "totality-nontermination" && n.binding === "bad"
  );
  eq(notes.length, 1);
  eq(notes[0].message.includes("no parameter strictly decreases"), true);
});

test("Phase E Stage 2: untyped recursive function stays silent", () => {
  // Conservative: with no static type on the param, the analyzer can't
  // prove or disprove termination, so it stays silent. Existing untyped
  // Allegro code keeps running without spurious info-notifications.
  const src = `factorial(n) => if n == 0 then 1 else n * factorial(n - 1)\n`;
  const { compilationReport } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const notes = compilationReport!.notifications.filter(
    n => n.kind === "totality-nontermination"
  );
  eq(notes.length, 0);
});

test("Phase E Stage 2: partial opt-out skips termination check", () => {
  // Build the partial_attach wrapping directly to avoid the use-totality
  // header (which the test harness doesn't pre-scan).
  const src = `loop(n: Int): Int => partial_attach(loop(n))\n`;
  const { compilationReport } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const notes = compilationReport!.notifications.filter(
    n => n.kind === "totality-nontermination"
  );
  eq(notes.length, 0);
});

test("Phase E Stage 2: recursion on a different position than the bounded one fires", () => {
  // `f(static, n: NonNeg)` — recursion passes static unchanged, n - 1.
  // Position 1 decreases; should be clean.
  const src = `
NonNeg = Int & _ >= 0
loop_n(static: Int, n: NonNeg): Int =>
  if n == 0 then static else loop_n(static, n - 1)
`;
  const { compilationReport } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const notes = compilationReport!.notifications.filter(
    n => n.kind === "totality-nontermination"
  );
  eq(notes.length, 0, `expected clean, got: ${notes.map(n => n.message).join("; ")}`);
});

fileTest(path.join(testsDir, "totality-termination-demo.alg"));

// --- Phase E Stage 3: decreases body-form ---
//
// These tests build the post-preprocessing shape directly
// (`decreases_attach(body, metric)`) to avoid pre-scanning a `use totality`
// header. The runtime semantics + analyzer hooks are what we're exercising.


test("C1.5b: collapse stashes the `decreases` metric", () => {
  const body = makeInt(42);
  const metric = makeInt(7);
  const wrapped = makeExpr(
    makePrimitive("decreases_attach", () => body, true),
    [body, metric],
  );
  const cfn = makeComposedFn([], wrapped);
  collapseBodyMetadata(cfn);
  eq((cfn as any).decreasesMetric === metric, true);
  eq(cfn.body === body, true);
});

test("C1.5b: collapse peels a stacked wrapper chain under type_check", () => {
  // decreases_attach nested under type_check + partial_attach.
  const body = makeInt(1);
  const metric = makeInt(0);
  const decW = makeExpr(makePrimitive("decreases_attach", () => body, true), [body, metric]);
  const partW = makeExpr(makePrimitive("partial_attach", () => decW, true), [decW]);
  const typed = makeExpr(makePrimitive("type_check", () => partW, true), [partW, makeInt(0)]);
  const cfn = makeComposedFn([], typed);
  collapseBodyMetadata(cfn);
  eq((cfn as any).partial === true, true);
  eq((cfn as any).decreasesMetric === metric, true);
  eq((cfn.body as any).args[0] === body, true);
});

test("Phase E Stage 3: `decreases n` trusts unbounded Int (no Stage 2 notification)", () => {
  // Build factorial-shape with decreases_attach(body, Param(n)) directly.
  // The analyzer sees the bare-Param metric and verifies positional
  // decrease without the type-bound check Stage 2 requires.
  const src = `f(n: Int): Int =>
  decreases_attach(
    if n == 0 then 0 else n + f(n - 1),
    n
  )
`;
  const { compilationReport } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const notes = compilationReport!.notifications.filter(
    n => n.kind === "totality-nontermination"
  );
  eq(notes.length, 0, `expected clean, got: ${notes.map(n => n.message).join("; ")}`);
});

test("Phase E Stage 3: `decreases n` catches non-decreasing recursive call", () => {
  // Function recurses on `n` unchanged — even with `decreases n`, the
  // analyzer sees that n doesn't decrease and fires.
  const src = `bad(n: Int): Int =>
  decreases_attach(
    bad(n),
    n
  )
`;
  const { compilationReport } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const notes = compilationReport!.notifications.filter(
    n => n.kind === "totality-nontermination" && n.binding === "bad"
  );
  eq(notes.length, 1);
  eq(notes[0].message.includes("does not decrease"), true);
});

test("Phase E Stage 3: lex-tuple metric verifies positional decrease", () => {
  // decreases [a, b] — for the recursive call to decrease, the analyzer
  // checks each position's recursive arg against the corresponding param.
  // Here `a` decreases (a - 1) so the lex tuple is decreasing.
  const src = `k(a: Int, b: Int): Int =>
  decreases_attach(
    if a == 0 then b else b + k(a - 1, b),
    typed_array(a, b)
  )
`;
  const { compilationReport } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const notes = compilationReport!.notifications.filter(
    n => n.kind === "totality-nontermination"
  );
  eq(notes.length, 0, `expected clean, got: ${notes.map(n => n.message).join("; ")}`);
});

test("Phase E Stage 3: lex-tuple with no decreasing component fires", () => {
  // a passes through unchanged, b passes through unchanged — no
  // position decreases. Lex check fails.
  const src = `bad(a: Int, b: Int): Int =>
  decreases_attach(
    bad(a, b),
    typed_array(a, b)
  )
`;
  const { compilationReport } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const notes = compilationReport!.notifications.filter(
    n => n.kind === "totality-nontermination" && n.binding === "bad"
  );
  eq(notes.length, 1);
});

test("Phase E Stage 3: unrecognised metric is trusted (no notification)", () => {
  // Metric is a runtime expression the analyzer can't statically pattern-
  // match. Per Stage 3 policy, trust the user — don't fire.
  const src = `f(n: Int, m: Int): Int =>
  decreases_attach(
    if n == 0 then m else f(n - 1, m + 1),
    n + m
  )
`;
  const { compilationReport } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const notes = compilationReport!.notifications.filter(
    n => n.kind === "totality-nontermination"
  );
  eq(notes.length, 0);
});

test("Phase E Stage 3: `partial` overrides `decreases`", () => {
  // A function marked both partial AND decreases gets no notification —
  // partial is the strongest opt-out.
  const src = `loop(n: Int): Int =>
  partial_attach(
    decreases_attach(loop(n), n)
  )
`;
  const { compilationReport } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const notes = compilationReport!.notifications.filter(
    n => n.kind === "totality-nontermination"
  );
  eq(notes.length, 0);
});

fileTest(path.join(testsDir, "totality-decreases-demo.alg"));

// --- Phase E Stage 4: mutual recursion via SCC ---
//
// The call-graph analyzer groups bindings into strongly-connected meta.
// Within each SCC, EVERY call to an SCC member must be provably decreasing
// (against the callee's param types) for the whole cycle to terminate.

test("Phase E Stage 4: mutual recursion with NonNeg decreases is provably terminating", () => {
  // isEven/isOdd: classic even/odd. Each call decreases n by 1; both params
  // are NonNeg-bounded so the chain is bounded below.
  const src = `
NonNeg = Int & _ >= 0
isEven(n: NonNeg): Int =>
  if n == 0 then 1 else isOdd(n - 1)
isOdd(n: NonNeg): Int =>
  if n == 0 then 0 else isEven(n - 1)
`;
  const { compilationReport } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const notes = compilationReport!.notifications.filter(
    n => n.kind === "totality-nontermination"
  );
  eq(notes.length, 0, `expected clean, got: ${notes.map(n => n.message).join("; ")}`);
});

test("Phase E Stage 4: mutual recursion with no decrease fires on both", () => {
  // Each function has a base case but the recursive call doesn't decrease.
  // SCC contains both; neither cycle call decreases; both fire.
  const src = `
a(n: Int): Int => if n == 0 then 0 else b(n)
b(n: Int): Int => if n == 0 then 0 else a(n)
`;
  const { compilationReport } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const notes = compilationReport!.notifications.filter(
    n => n.kind === "totality-nontermination"
  );
  eq(notes.length, 2);
  for (const n of notes) {
    eq(n.message.includes("mutual recursion cycle"), true,
       `expected mutual-cycle message, got: ${n.message}`);
  }
});

test("Phase E Stage 4: mutual recursion where one side doesn't decrease fires", () => {
  // a→b decreases, b→a does not. The cycle isn't shown to terminate so
  // `b` reports.
  const src = `
NonNeg = Int & _ >= 0
a(n: NonNeg): Int => if n == 0 then 0 else b(n - 1)
b(n: NonNeg): Int => if n == 0 then 0 else a(n)
`;
  const { compilationReport } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const notes = compilationReport!.notifications.filter(
    n => n.kind === "totality-nontermination"
  );
  // `a` calls `b` with n-1 (decreases against b's NonNeg) — clean.
  // `b` calls `a` with n unchanged — fires.
  const bNote = notes.find(n => n.binding === "b");
  eq(bNote !== undefined, true,
    `expected b to fire, got: ${notes.map(n => `${n.binding}: ${n.message}`).join("; ")}`);
  if (bNote) eq(bNote.message.includes("mutual recursion cycle"), true);
});

test("Phase E Stage 4: self-recursion still reported as such (SCC size 1)", () => {
  // SCC contains only `bad`. The message should NOT mention a mutual cycle
  // — Stage 2's wording is preserved for the self-recursion case.
  const src = `bad(n: Int): Int => bad(n)\n`;
  const { compilationReport } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const notes = compilationReport!.notifications.filter(
    n => n.kind === "totality-nontermination" && n.binding === "bad"
  );
  eq(notes.length, 1);
  eq(notes[0].message.includes("mutual recursion cycle"), false,
    `self-recursion shouldn't mention mutual cycle: ${notes[0].message}`);
});

test("Phase E Stage 4: three-function mutual cycle terminates correctly", () => {
  // A→B→C→A — all three in one SCC. Each call decreases n by 1 against
  // NonNeg. Should be clean across all three.
  const src = `
NonNeg = Int & _ >= 0
f1(n: NonNeg): Int => if n == 0 then 0 else f2(n - 1)
f2(n: NonNeg): Int => if n == 0 then 0 else f3(n - 1)
f3(n: NonNeg): Int => if n == 0 then 0 else f1(n - 1)
`;
  const { compilationReport } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const notes = compilationReport!.notifications.filter(
    n => n.kind === "totality-nontermination"
  );
  eq(notes.length, 0, `expected clean, got: ${notes.map(n => n.message).join("; ")}`);
});

fileTest(path.join(testsDir, "totality-mutual-demo.alg"));

// --- Phase E Stage 5: HOF-mediated recursion ---
//
// Recursive references reach the analyzer indirectly when passed as callbacks
// to stdlib HOFs (`arr.map(self)`, `arr.filter(self)`, `arr.reduce(self, …)`).
// Stage 5 detects these and verifies the HOF call is well-founded — the
// receiver must be structurally smaller than a caller parameter.

test("Phase E Stage 5: non-recursive HOF call stays silent", () => {
  const src = `
double_self(x: Int): Int => x * 2
double_list(arr: Array[Int]): Array[Int] => arr.map(double_self)
`;
  const { compilationReport } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const notes = compilationReport!.notifications.filter(
    n => n.kind === "totality-nontermination"
  );
  eq(notes.length, 0);
});

test("Phase E Stage 5: arr.map(self) with bare-Param receiver fires", () => {
  // The receiver `arr` is the function's own param, so the recursion
  // would loop on the same data — not structurally smaller.
  const src = `recursive_map(arr: Array[Int]): Array[Int] => arr.map(recursive_map)\n`;
  const { compilationReport } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const notes = compilationReport!.notifications.filter(
    n => n.kind === "totality-nontermination" && n.binding === "recursive_map"
  );
  eq(notes.length, 1);
  eq(notes[0].message.includes("HOF-mediated"), true);
  eq(notes[0].message.includes(".map"), true);
});

test("Phase E Stage 5: structurally-smaller receiver discharges the check", () => {
  // `t.children.map(tree_sum)` — receiver is `t.children`, a field access
  // on a parameter. Treated as structurally smaller (sub-component of t).
  const src = `tree_sum(t: Object): Int => t.children.map(tree_sum).reduce((a, x) => a + x, 0)\n`;
  const { compilationReport } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const notes = compilationReport!.notifications.filter(
    n => n.kind === "totality-nontermination"
  );
  eq(notes.length, 0, `expected clean, got: ${notes.map(n => n.message).join("; ")}`);
});

test("Phase E Stage 5: decreases clause overrides HOF check", () => {
  const src = `recursive_map(arr: Array[Int]): Array[Int] =>
  decreases_attach(arr.map(recursive_map), arr)
`;
  const { compilationReport } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const notes = compilationReport!.notifications.filter(
    n => n.kind === "totality-nontermination"
  );
  eq(notes.length, 0);
});

test("Phase E Stage 5: partial overrides HOF check", () => {
  const src = `loop_map(arr: Array[Int]): Array[Int] =>
  partial_attach(arr.map(loop_map))
`;
  const { compilationReport } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const notes = compilationReport!.notifications.filter(
    n => n.kind === "totality-nontermination"
  );
  eq(notes.length, 0);
});

test("Phase E Stage 5: filter and reduce are detected too", () => {
  const src = `
keep_evens(arr: Array[Int]): Array[Int] => arr.filter(keep_evens)
sum_all(arr: Array[Int]): Int => arr.reduce(sum_all, 0)
`;
  const { compilationReport } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const notes = compilationReport!.notifications.filter(
    n => n.kind === "totality-nontermination"
  );
  // Both bindings are recursive via HOFs on bare-Param receivers.
  const names = notes.map(n => n.binding).sort();
  eq(names.join(","), "keep_evens,sum_all");
  for (const n of notes) {
    eq(n.message.includes("HOF-mediated"), true);
  }
});

test("Phase E Stage 5: mutual HOF cycle fires on both", () => {
  // a.map → b, b.map → a. SCC = {a, b}; each cycle edge is HOF-mediated
  // with a bare-Param receiver. Both fire.
  const src = `
a(arr: Array[Int]): Array[Int] => arr.map(b)
b(arr: Array[Int]): Array[Int] => arr.map(a)
`;
  const { compilationReport } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const notes = compilationReport!.notifications.filter(
    n => n.kind === "totality-nontermination"
  );
  eq(notes.length, 2);
  for (const n of notes) {
    eq(n.message.includes("mutual recursion cycle"), true);
    eq(n.message.includes("HOF-mediated"), true);
  }
});

test("Phase E Stage 5: HOF callback to non-cycle member stays silent", () => {
  // `b` doesn't call back to `a`, so no cycle exists — non-recursive HOF
  // use is fine.
  const src = `
a(arr: Array[Int]): Array[Int] => arr.map(b)
b(x: Int): Int => x + 1
`;
  const { compilationReport } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const notes = compilationReport!.notifications.filter(
    n => n.kind === "totality-nontermination"
  );
  eq(notes.length, 0);
});

fileTest(path.join(testsDir, "totality-hof-demo.alg"));

// --- Phase E Stage 6: counterexample rendering ---
//
// Totality notifications now carry a `counterexample` field — a concrete
// trace or sample input illustrating the failure shape. Renderers surface
// it inline; programmatic consumers read it structurally.

test("Phase E Stage 6: Bool exhaustiveness emits missing-literal counterexample", () => {
  const src = `f(b: Bool): Int => when b is true then 1\n`;
  const { compilationReport } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const note = compilationReport!.notifications.find(
    n => n.kind === "totality-exhaustiveness" && n.binding === "f"
  );
  eq(note !== undefined, true);
  if (note) {
    eq(note.counterexample !== undefined, true);
    eq(note.counterexample!.includes("false"), true);
    eq(note.counterexample!.includes("f("), true);
  }
});

test("Phase E Stage 6: self-recursion no-decrease emits trace counterexample", () => {
  const src = `bad(n: Int): Int => bad(n)\n`;
  const { compilationReport } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const note = compilationReport!.notifications.find(
    n => n.kind === "totality-nontermination" && n.binding === "bad"
  );
  eq(note !== undefined, true);
  if (note) {
    eq(note.counterexample !== undefined, true);
    eq(note.counterexample!.includes("bad(n)"), true);
    eq(note.counterexample!.includes("same input"), true);
  }
});

test("Phase E Stage 6: mutual recursion emits cycle-path counterexample", () => {
  const src = `
a(n: Int): Int => if n == 0 then 0 else b(n)
b(n: Int): Int => if n == 0 then 0 else a(n)
`;
  const { compilationReport } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const aNote = compilationReport!.notifications.find(
    n => n.kind === "totality-nontermination" && n.binding === "a"
  );
  eq(aNote !== undefined, true);
  if (aNote) {
    eq(aNote.counterexample !== undefined, true);
    eq(aNote.counterexample!.includes("a("), true);
    eq(aNote.counterexample!.includes("b("), true);
    eq(aNote.counterexample!.includes("cycle"), true);
  }
});

test("Phase E Stage 6: HOF non-decrease emits receiver-shape counterexample", () => {
  const src = `recursive_map(arr: Array[Int]): Array[Int] => arr.map(recursive_map)\n`;
  const { compilationReport } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const note = compilationReport!.notifications.find(
    n => n.kind === "totality-nontermination" && n.binding === "recursive_map"
  );
  eq(note !== undefined, true);
  if (note) {
    eq(note.counterexample !== undefined, true);
    eq(note.counterexample!.includes("arr.map(recursive_map)"), true);
    eq(note.counterexample!.includes("not smaller"), true);
  }
});

test("Phase E Stage 6: failing `decreases` clause emits metric counterexample", () => {
  const src = `bad(n: Int): Int => decreases_attach(bad(n), n)\n`;
  const { compilationReport } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const note = compilationReport!.notifications.find(
    n => n.kind === "totality-nontermination" && n.binding === "bad"
  );
  eq(note !== undefined, true);
  if (note) {
    eq(note.counterexample !== undefined, true);
    eq(note.counterexample!.includes("decreases n"), true);
  }
});

test("Phase E Stage 6: rendered summary surfaces counterexamples per binding", () => {
  const src = `bad(n: Int): Int => bad(n)\nfc(b: Bool): Int => when b is true then 1\n`;
  const { evalCtx, compilationReport } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const excluded = new Set<string>([...Object.keys(primRegistry), ...Object.keys(typeExt.bindings)]);
  const summary = summarizeModule(evalCtx, compilationReport, { excludeBindings: excluded });
  const rendered = renderModuleSummary(summary);
  eq(rendered.includes("totality:"), true, `rendered should mention totality block:\n${rendered}`);
  eq(rendered.includes("counterexample:"), true);
  eq(rendered.includes("bad(n)"), true);
  // The Bool counterexample should also appear.
  eq(rendered.includes("fc(false)"), true);
});

test("Phase E Stage 6: non-totality notifications carry no counterexample by default", () => {
  // Effects-mismatch notifications shouldn't get a counterexample —
  // Stage 6 only populates the field for totality / exhaustiveness today.
  // (This anchors the API contract: counterexample is optional.)
  const note: any = { kind: "effects-mismatch", message: "x", severity: "error" };
  eq(note.counterexample, undefined);
});

test("Phase E Stage 4: non-recursive helper alongside mutual cycle stays silent", () => {
  // `id` is non-recursive (no edge into the SCC) — should be untouched.
  // Mutual cycle of a/b fires on its own.
  const src = `
id(n: Int): Int => n
a(n: Int): Int => if n == 0 then 0 else b(n)
b(n: Int): Int => if n == 0 then 0 else a(n)
`;
  const { compilationReport } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const notes = compilationReport!.notifications.filter(
    n => n.kind === "totality-nontermination"
  );
  const ids = notes.map(n => n.binding).sort();
  eq(ids.join(","), "a,b",
    `expected only a,b to fire, got: ${notes.map(n => n.binding).join(",")}`);
});

// --- Tail-call through typed-return wrapper (type_check forwards TailCalls) ---

test("Tail-recursive typed function returns correctly", () => {
  // The body `countdown(n - 1)` is in tail position; the recursive call
  // produces a TailCall sentinel inside the eval_if else thunk. Before the
  // type_check / ensures_check TailCall-forwarding fix, the sentinel
  // propagated through the type_check wrapper as a fake Value and the
  // function returned an unresolved Expression.
  const src = `countdown(n: Int): Int =>
  if n == 0 then 0 else countdown(n - 1)
countdown(5)
`;
  const { value } = runtimeEval(src, undefined, [typeExt], undefined, true);
  eq(value !== null, true);
  if (value) {
    const p = value;
    eq(p.kind, ValueKind.Bits);
    eq(Number((p as BitsValue).data), 0);
  }
});

test("Deep tail-recursion through type_check doesn't blow the stack", () => {
  // 100k deep recursion would overflow without TCO. With the fix, the
  // TailCall sentinel bubbles up through type_check to applyComposed's
  // tco_loop and the call resolves in O(1) stack.
  const src = `countdown(n: Int): Int =>
  if n == 0 then 0 else countdown(n - 1)
countdown(100000)
`;
  const { value } = runtimeEval(src, undefined, [typeExt], undefined, true);
  if (value) {
    const p = value;
    eq(p.kind, ValueKind.Bits);
    eq(Number((p as BitsValue).data), 0);
  }
});

