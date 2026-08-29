// =============================================================================
// Language surface: guards, destructuring, the offside rule, reactivity, pipes, inference, combinators.
//
// Extracted from the single-file suite (suite split, lane B). Registrations
// run at import time; src/test/index.ts imports this module in suite order.
// =============================================================================

import { test, eq, throws } from "./harness.js";
import { evalStd, evalNum, evalNumExt, typeExt } from "./fixtures.js";
import { evalSource as runtimeEval, Extension } from "../runtime.js";
import * as path from "path";
import { bitsToString, dataOf, BitsValue, makeInt, makeStructure, makeExpr, ValueKind, Value } from "../types.js";
import { applyPhase } from "../runtime.js";
import { evaluate } from "../evaluator.js";
import { getTypeName } from "../types-std.js";
import { componentsView } from "../slots.js";
import { extractGrammarFragment } from "../primitives.js";
import { primNames, typeNames, fileTest, testsDir } from "./alg-files.js";

// == Guard Clauses (and) ==

test("guard: basic guard passes", () => {
  const result = evalStd('when 5 is n and n > 0 then "pos" else "neg"');
  eq(bitsToString(dataOf(result!) as BitsValue), "pos");
});

test("guard: basic guard fails → else", () => {
  const result = evalStd('when 0 - 5 is n and n > 0 then "pos" else "neg"');
  eq(bitsToString(dataOf(result!) as BitsValue), "neg");
});

test("guard: with destructuring", () => {
  const result = evalStd('when {x: 5} is {x} and x > 3 then "big" else "small"');
  eq(bitsToString(dataOf(result!) as BitsValue), "big");
});

test("guard: fails with destructuring → else", () => {
  const result = evalStd('when {x: 1} is {x} and x > 3 then "big" else "small"');
  eq(bitsToString(dataOf(result!) as BitsValue), "small");
});

test("guard: multi-case fallthrough", () => {
  const src = `
classify(n) => when n
  is x and x > 0 then "positive"
  is x and x < 0 then "negative"
  is _ then "zero"
classify(5)
`;
  eq(bitsToString(dataOf(evalStd(src)!) as BitsValue), "positive");
});

test("guard: multi-case fallthrough to second", () => {
  const src = `
classify(n) => when n
  is x and x > 0 then "positive"
  is x and x < 0 then "negative"
  is _ then "zero"
classify(0 - 3)
`;
  eq(bitsToString(dataOf(evalStd(src)!) as BitsValue), "negative");
});

test("guard: multi-case fallthrough to wildcard", () => {
  const src = `
classify(n) => when n
  is x and x > 0 then "positive"
  is x and x < 0 then "negative"
  is _ then "zero"
classify(0)
`;
  eq(bitsToString(dataOf(evalStd(src)!) as BitsValue), "zero");
});

test("guard: no guard (backward compat)", () => {
  eq(evalNum("when 42 is _ then 99 else 0"), 99);
});

// == Nested Destructuring ==

test("nested: struct in struct", () => {
  const result = evalStd('when {a: {b: 42}} is {a: {b}} then b else 0');
  eq(Number((dataOf(result!) as BitsValue).data), 42);
});

test("nested: struct fail falls through", () => {
  const result = evalStd('when {a: 1} is {a: {b}} then b else 99');
  eq(Number((dataOf(result!) as BitsValue).data), 99);
});

test("nested: mixed fields", () => {
  const result = evalStd(`
p = {center: {x: 10, y: 20}, radius: 5}
when p is {center: {x, y}, radius} then x + y + radius else 0
`);
  eq(Number((dataOf(result!) as BitsValue).data), 35);
});

test("nested: type sub-pattern", () => {
  const result = evalStd('when {x: 42} is {x: Int} then x else 0');
  eq(Number((dataOf(result!) as BitsValue).data), 42);
});

test("nested: type sub-pattern mismatch", () => {
  const result = evalStd('when {x: "hello"} is {x: Int} then x else 0');
  eq(Number((dataOf(result!) as BitsValue).data), 0);
});

test("nested: literal sub-pattern match", () => {
  const result = evalStd('when {x: 42} is {x: 42} then "yes" else "no"');
  eq(bitsToString(dataOf(result!) as BitsValue), "yes");
});

test("nested: literal sub-pattern mismatch", () => {
  const result = evalStd('when {x: 42} is {x: 99} then "yes" else "no"');
  eq(bitsToString(dataOf(result!) as BitsValue), "no");
});

test("nested: wildcard sub-pattern", () => {
  const result = evalStd('when {x: 42, y: 10} is {x: _, y} then y else 0');
  eq(Number((dataOf(result!) as BitsValue).data), 10);
});

test("nested: binding sub-pattern uses field name", () => {
  // {x: val} — val is the pattern (unresolved → binding), x is the binding name
  const result = evalStd('when {x: 42} is {x: val} then x + 1 else 0');
  eq(Number((dataOf(result!) as BitsValue).data), 43);
});

// == Combined Guards + Nested ==

test("guard + nested: combined", () => {
  const result = evalStd(`
p = {x: 5, y: 10}
when p is {x, y} and x + y > 10 then "big" else "small"
`);
  eq(bitsToString(dataOf(result!) as BitsValue), "big");
});

// == Multi-Line Expressions (Offside Rule) ==

test("multiline: if/then/else across lines", () => {
  const result = evalStd("if true\n    then 42\n    else 0");
  eq(Number((dataOf(result!) as BitsValue).data), 42);
});

test("multiline: if with expression condition", () => {
  const result = evalStd("x = 5\nif x > 0\n    then x\n    else 0 - x");
  eq(Number((dataOf(result!) as BitsValue).data), 5);
});

test("multiline: binary operator continuation", () => {
  const result = evalStd("a = 1 +\n    2 +\n    3\na");
  eq(Number((dataOf(result!) as BitsValue).data), 6);
});

test("multiline: function with multi-line if body", () => {
  const result = evalStd("abs(x) =>\n    if x > 0\n        then x\n        else 0 - x\nabs(0 - 5)");
  eq(Number((dataOf(result!) as BitsValue).data), 5);
});

test("multiline: nested if in function with block", () => {
  const result = evalStd("f(x) =>\n    y = if x > 0\n        then x * 2\n        else 0\n    y + 1\nf(5)");
  eq(Number((dataOf(result!) as BitsValue).data), 11);
});

test("multiline: when multi-case still works", () => {
  const result = evalStd("v = 2\nwhen v\n    is 1 then 10\n    is 2 then 20\n    is _ then 0");
  eq(Number((dataOf(result!) as BitsValue).data), 20);
});

test("multiline: single-line if unchanged", () => {
  eq(evalNum("if 1 == 1 then 42 else 0"), 42);
});

// == Reactive Forward-Chaining Evaluation ==

test("reactive: all bindings complete → registry has no incomplete", () => {
  const { registry } = runtimeEval("x = 42\ny = x + 1\n", undefined, [typeExt], undefined, true);
  eq(registry.dependents.size, 0, "no incomplete dependencies");
  const xb = registry.bindings.get("x");
  eq(xb?.isComplete, true, "x is complete");
  const yb = registry.bindings.get("y");
  eq(yb?.isComplete, true, "y is complete");
});

test("reactive: import binding starts incomplete", () => {
  // 'import foo' creates a binding with value: undefined
  // If foo is not provided by extensions, it stays incomplete
  const { registry, evalCtx } = runtimeEval("import foo\nx = 42\n", undefined, [typeExt], undefined, true);
  const xb = registry.bindings.get("x");
  eq(xb?.isComplete, true, "x is complete");
  // foo is an import (value: undefined) — not tracked as a reactive binding
  // But x doesn't depend on foo, so x should still be complete
});

test("reactive: applyPhase provides binding and triggers re-eval", () => {
  // Evaluate code where 'config' is not available
  const { registry, evalCtx } = runtimeEval("x = 42\n", undefined, [typeExt], undefined, true);

  // Apply a new phase with a binding
  applyPhase(registry, evalCtx, new Map([["extra", makeInt(100)]]));

  // The new binding should be in evalCtx
  const extraB = evalCtx.bindings.get("extra");
  eq(extraB?.value !== undefined, true, "extra binding available");
  eq(Number((dataOf(extraB!.value!) as BitsValue).data), 100);
});

test("reactive: applyPhase triggers dependent re-evaluation", () => {
  // Create a source that references an unavailable binding
  // Use ctx_use to declare 'config' as needed but undefined
  const { registry, evalCtx } = runtimeEval("x = 42\n", undefined, [typeExt], undefined, true);

  // Manually add an incomplete binding to simulate a dependency.
  // C2.3b: ONE cell object, shared by the eval scope and the registry —
  // the binding IS the future cell.
  const configSymbol = { kind: "Symbol" as const, name: "config" };
  const cell = {
    key: "result",
    value: configSymbol as any,
    incompleteDeps: new Set(["config"]),
    isComplete: false,
  };
  evalCtx.bindings.set("result", cell);
  registry.bindings.set("result", cell);
  // Register dependency
  let deps = registry.dependents.get("config");
  if (!deps) { deps = new Set(); registry.dependents.set("config", deps); }
  deps.add("result");

  // Apply phase with config
  applyPhase(registry, evalCtx, new Map([["config", makeInt(99)]]));

  // result should now be re-evaluated
  const rb = registry.bindings.get("result");
  eq(rb?.isComplete, true, "result should be complete after config provided");
  eq(Number((dataOf(rb!.value!) as BitsValue).data), 99, "result should be 99");
});

test("reactive: depCollector records incomplete symbols during evaluation", () => {
  // Evaluate an expression that references an undefined symbol
  const ctx = makeStructure();
  ctx.bindings.set("a", { key: "a", value: makeInt(5) });
  ctx.bindingList.push({ key: "a", value: makeInt(5) });
  // 'b' is NOT defined

  const collector = { incompleteRefs: new Set<string>() };
  const expr = makeExpr(
    { kind: "PrimitiveFunction" as const, name: "bits_add", fn: (args: any[]) => makeInt(Number(args[0].data + args[1].data)), lazy: undefined } as any,
    [{ kind: "Symbol" as const, name: "a" } as any, { kind: "Symbol" as const, name: "b" } as any]
  );
  const result = evaluate(expr, ctx, 0, collector);
  eq(collector.incompleteRefs.has("b"), true, "b should be recorded as incomplete");
  eq(collector.incompleteRefs.has("a"), false, "a should not be incomplete");
});

// == Pipe Operator ==

test("pipe: simple function application", () => {
  const result = evalStd("double(x) => x * 2\n5 |> double");
  eq(Number((dataOf(result!) as BitsValue).data), 10);
});

test("pipe: chained", () => {
  const result = evalStd("double(x) => x * 2\nadd1(x) => x + 1\n5 |> double |> add1");
  eq(Number((dataOf(result!) as BitsValue).data), 11);
});

test("pipe: with lambda", () => {
  const result = evalStd("5 |> (x => x * 3)");
  eq(Number((dataOf(result!) as BitsValue).data), 15);
});

test("pipe: preserves types", () => {
  const result = evalStd("5 |> (x => x + 1)");
  eq(getTypeName(result!), "Int");
});

test("pipe: with string", () => {
  const result = evalStd('"hello" |> (s => s.length)');
  eq(Number((dataOf(result!) as BitsValue).data), 5);
});

// == Full Type Inference ==

test("inference: literal binding has inferred type", () => {
  const { compilationReport: r } = runtimeEval("x = 42\n", undefined, [typeExt], undefined, true);
  eq(r?.bindingTypes.get("x"), "Int");
});

test("inference: string binding has inferred type", () => {
  const { compilationReport: r } = runtimeEval('s = "hello"\n', undefined, [typeExt], undefined, true);
  eq(r?.bindingTypes.get("s"), "String");
});

test("inference: expression binding type propagates", () => {
  const { compilationReport: r } = runtimeEval("x = 3 + 4\n", undefined, [typeExt], undefined, true);
  eq(r?.bindingTypes.get("x"), "Int");
});

test("inference: untyped function called with typed arg — result typed", () => {
  const { compilationReport: r } = runtimeEval("f(x) => x + 1\nresult = f(5)\n", undefined, [typeExt], undefined, true);
  eq(r?.bindingTypes.get("result"), "Int");
});

test("inference: cross-function type propagation", () => {
  const { compilationReport: r } = runtimeEval("double(x) => x * 2\nwrap(n) => double(n) + 1\nresult = wrap(5)\n", undefined, [typeExt], undefined, true);
  eq(r?.bindingTypes.get("result"), "Int");
});

test("inference: recursive function return type", () => {
  const { compilationReport: r } = runtimeEval("factorial(n) => if n == 0 then 1 else n * factorial(n - 1)\nresult = factorial(5)\n", undefined, [typeExt], undefined, true);
  eq(r?.bindingTypes.get("result"), "Int");
});

test("inference: polymorphic — Int call site", () => {
  const { compilationReport: r } = runtimeEval("f(x) => x + x\nresult = f(5)\n", undefined, [typeExt], undefined, true);
  eq(r?.bindingTypes.get("result"), "Int");
});

test("inference: polymorphic — String call site", () => {
  const { compilationReport: r } = runtimeEval('f(x) => x + x\nresult = f("hi")\n', undefined, [typeExt], undefined, true);
  eq(r?.bindingTypes.get("result"), "String");
});

test("inference: array operations", () => {
  const { compilationReport: r } = runtimeEval("nums = [1, 2, 3]\nresult = nums.map(x => x * 2)\n", undefined, [typeExt], undefined, true);
  eq(r?.bindingTypes.get("nums"), "Array");
  eq(r?.bindingTypes.get("result"), "Array");
});

test("inference: object type", () => {
  const { compilationReport: r } = runtimeEval("p = {x: 1, y: 2}\n", undefined, [typeExt], undefined, true);
  eq(r?.bindingTypes.get("p"), "Object");
});

test("inference: bool from comparison", () => {
  const { compilationReport: r } = runtimeEval("result = 3 > 2\n", undefined, [typeExt], undefined, true);
  eq(r?.bindingTypes.get("result"), "Bool");
});

test("inference: custom type", () => {
  const { compilationReport: r } = runtimeEval("Point = Type.define({x: Int, y: Int})\np = Point(1, 2)\n", undefined, [typeExt], undefined, true);
  eq(r?.bindingTypes.get("p"), "Point");
});

test("inference: error value", () => {
  const { compilationReport: r } = runtimeEval('e = error "bad"\n', undefined, [typeExt], undefined, true);
  eq(r?.bindingTypes.get("e"), "Error");
});

test("inference: none", () => {
  const { compilationReport: r } = runtimeEval("n = none\n", undefined, [typeExt], undefined, true);
  eq(r?.bindingTypes.get("n"), "None");
});

// == Parser Combinators (Phase 1 grammar extensions from Allegro) ==

test("grammar combinators: terminal matches regex pattern", () => {
  const result = evalStd(`g = grammar_new({whitespace: ""})
t = grammar_terminal(g, "/[0-9]+/")
grammar_set_target(g, t)
grammar_parse(g, "42")`);
  const pv = dataOf(result!);
  eq(pv.kind === ValueKind.Bits && bitsToString(pv as BitsValue) === "42", true);
});

test("grammar combinators: terminal matches literal text", () => {
  const result = evalStd(`g = grammar_new({whitespace: ""})
t = grammar_terminal(g, "hello")
grammar_set_target(g, t)
grammar_parse(g, "hello")`);
  const pv = dataOf(result!);
  eq(pv.kind === ValueKind.Bits && bitsToString(pv as BitsValue) === "hello", true);
});

test("grammar combinators: phrase returns Array of children", () => {
  const result = evalStd(`g = grammar_new({whitespace: ""})
a = grammar_terminal(g, "a")
b = grammar_terminal(g, "b")
p = grammar_phrase(g, [a, b])
grammar_set_target(g, p)
grammar_parse(g, "ab")`);
  const pv = dataOf(result!) as any;
  eq(pv.kind === ValueKind.Structure, true);
});

test("grammar combinators: choice is transparent (unwraps matched alternative)", () => {
  const result = evalStd(`g = grammar_new({whitespace: ""})
a = grammar_terminal(g, "a")
b = grammar_terminal(g, "b")
c = grammar_choice(g, [a, b])
grammar_set_target(g, c)
grammar_parse(g, "b")`);
  const pv = dataOf(result!);
  eq(pv.kind === ValueKind.Bits && bitsToString(pv as BitsValue) === "b", true);
});

test("grammar combinators: repeat strips delimiters", () => {
  const result = evalStd(`g = grammar_new({whitespace: ""})
a = grammar_terminal(g, "a")
comma = grammar_terminal(g, ",")
rep = grammar_repeat(g, a, {min: 1, delimiter: comma})
grammar_set_target(g, rep)
tree = grammar_parse(g, "a,a,a")
tree.length`);
  eq(Number((dataOf(result!) as BitsValue).data), 3);
});

test("grammar combinators: optional returns matched value", () => {
  const result = evalStd(`g = grammar_new({whitespace: ""})
a = grammar_terminal(g, "a")
opt = grammar_optional(g, a)
grammar_set_target(g, opt)
grammar_parse(g, "a")`);
  const pv = dataOf(result!);
  eq(pv.kind === ValueKind.Bits && bitsToString(pv as BitsValue) === "a", true);
});

test("grammar combinators: choice_add mutable forward-ref works", () => {
  const result = evalStd(`g = grammar_new({whitespace: ""})
digit = grammar_terminal(g, "/[0-9]/")
choice = grammar_choice(g, [])
grammar_choice_add(choice, digit)
grammar_set_target(g, choice)
grammar_parse(g, "5")`);
  const pv = dataOf(result!);
  eq(pv.kind === ValueKind.Bits && bitsToString(pv as BitsValue) === "5", true);
});

test("grammar combinators: parse failure returns error value", () => {
  const result = evalStd(`g = grammar_new({whitespace: ""})
a = grammar_terminal(g, "a")
grammar_set_target(g, a)
grammar_parse(g, "b")`);
  eq(componentsView(result!).has("error"), true);
});

// == Runtime Grammar Extension (Phase 1) ==

test("register_infix: stores a fragment on the eval ctx", () => {
  const r = runtimeEval(`register_infix("**", 40, (l, r) => l * r)`, undefined, [typeExt], undefined, true);
  const frag = extractGrammarFragment(r.evalCtx);
  eq(frag !== undefined, true);
  eq(frag!.infix.length, 1);
  eq(frag!.infix[0].token, "**");
  eq(frag!.infix[0].bp, 40);
  eq(frag!.operators.length, 1);
  eq(frag!.operators[0], "**");
});

test("register_prefix: stores a prefix-op fragment", () => {
  const r = runtimeEval(`register_prefix("#", 60, x => x + 1)`, undefined, [typeExt], undefined, true);
  const frag = extractGrammarFragment(r.evalCtx);
  eq(frag !== undefined, true);
  eq(frag!.prefixOp.length, 1);
  eq(frag!.prefixOp[0].token, "#");
  eq(frag!.prefixOp[0].bp, 60);
  eq(frag!.operators.length, 1);
});

test("register_postfix: stores a postfix-op fragment", () => {
  const r = runtimeEval(`register_postfix("!", 70, x => x)`, undefined, [typeExt], undefined, true);
  const frag = extractGrammarFragment(r.evalCtx);
  eq(frag !== undefined, true);
  eq(frag!.postfixOp.length, 1);
  eq(frag!.postfixOp[0].token, "!");
  eq(frag!.postfixOp[0].bp, 70);
});

test("register_expr_prefix: stores a keyword-prefix fragment", () => {
  const r = runtimeEval(`register_expr_prefix("neg", x => 0 - x)`, undefined, [typeExt], undefined, true);
  const frag = extractGrammarFragment(r.evalCtx);
  eq(frag !== undefined, true);
  eq(frag!.exprPrefix.length, 1);
  eq(frag!.exprPrefix[0].keyword, "neg");
  eq(frag!.keywords.length, 1);
  eq(frag!.keywords[0], "neg");
});

test("register_*: multiple registrations accumulate in one fragment", () => {
  const r = runtimeEval(`
register_infix("**", 40, (l, r) => l * r)
register_infix("^^", 40, (l, r) => l - r)
register_expr_prefix("neg", x => 0 - x)
`, undefined, [typeExt], undefined, true);
  const frag = extractGrammarFragment(r.evalCtx);
  eq(frag !== undefined, true);
  eq(frag!.infix.length, 2);
  eq(frag!.exprPrefix.length, 1);
  eq(frag!.operators.length, 2);
  eq(frag!.keywords.length, 1);
});

// Note: the Phase 1 hybrid-parser `mergeGrammarFragments` tests were deleted
// along with the hybrid parser in Phase 2c-7. Grammar fragments now extend
// grammar2 values via `getGrammarWithFragments` (see src/grammar2/fragments.ts)
// and are exercised via the end-to-end `grammar-runtime.alg` test below.

test("runtime grammar: module-scoped infix operator applied at parse time", () => {
  // Simulate a module that registers ** and exposes pow_int; then use it
  // in a consumer source through a merged config.
  const modSource = `
pow_helper(base, n, acc) =>
  if n == 0
    then acc
    else pow_helper(base, n - 1, acc * base)

pow_int(base, n) => pow_helper(base, n, 1)

register_infix("**", 40, (l, r) => pow_int(l, r))
`;
  const modResult = runtimeEval(modSource, undefined, [typeExt], undefined, true);
  const frag = extractGrammarFragment(modResult.evalCtx);
  eq(frag !== undefined, true);
  // Build extension with the module's bindings as sibling extension
  const bindings: Record<string, Value> = {};
  for (const [key, b] of modResult.evalCtx.bindings) {
    if (b.value !== undefined && !primNames.has(key) && !typeNames.has(key)) {
      bindings[key] = b.value;
    }
  }
  const ext: Extension = { name: "pow_test", bindings, grammarFragment: frag };
  const consumerResult = runtimeEval("2 ** 10", undefined, [typeExt, ext], undefined, true);
  eq(Number((dataOf(consumerResult.value!) as BitsValue).data), 1024);
});

test("runtime grammar: module-scoped expr-prefix keyword applied at parse time", () => {
  const modSource = `register_expr_prefix("negate", x => 0 - x)`;
  const modResult = runtimeEval(modSource, undefined, [typeExt], undefined, true);
  const frag = extractGrammarFragment(modResult.evalCtx);
  eq(frag !== undefined, true);
  const ext: Extension = { name: "neg_test", bindings: {}, grammarFragment: frag };
  const consumerResult = runtimeEval("negate 7", undefined, [typeExt, ext], undefined, true);
  eq(Number((dataOf(consumerResult.value!) as BitsValue).data), -7);
});

// Run the end-to-end grammar-runtime.alg test (uses `use pow` header, Phase 6)
fileTest(path.join(testsDir, "grammar-runtime.alg"));

// Phase 6b multi-token demo — `match x with …` expression
fileTest(path.join(testsDir, "match-demo.alg"));

// Phase 7a thread 2: hosting-file grammar via `use grammar { … }`
fileTest(path.join(testsDir, "inline-grammar-demo.alg"));

// Phase 7b thread 5: hygienic template substitution — consumer can't hijack
// a module's grammar template by rebinding a referenced name.
fileTest(path.join(testsDir, "hygiene-demo.alg"));

// Phase 7d: `use NAME.MEMBER` — select specific Grammar binding from a module.
fileTest(path.join(testsDir, "dotted-use-demo.alg"));

// Phase B: refinement propagation through arithmetic.
fileTest(path.join(testsDir, "refinement-propagation-demo.alg"));

// Phase B: subtyping via abstract domains (no runtime predicate evaluation).
fileTest(path.join(testsDir, "refinement-subtype-demo.alg"));
fileTest(path.join(testsDir, "knowledge-bounds-demo.alg"));
fileTest(path.join(testsDir, "observation-demo.alg"));

// Phase B: lib/math.alg pilot — `double_pos` discharges its PositiveInt
// return type via abstract-domain implication.
fileTest(path.join(testsDir, "math-pilot-demo.alg"));

// Phase C Chunk 1: predicate sets per binding.
fileTest(path.join(testsDir, "predicate-set-demo.alg"));

// Phase C Chunk 4: Type.invariant + multi-field record invariants.
fileTest(path.join(testsDir, "invariant-demo.alg"));

// Phase C Chunk 3: requires / ensures function-body contracts.
fileTest(path.join(testsDir, "contracts-demo.alg"));

// Phase D1: function-body effect declarations.
fileTest(path.join(testsDir, "effects-demo.alg"));
fileTest(path.join(testsDir, "effects-surface-c-demo.alg"));
fileTest(path.join(testsDir, "fn-type-demo.alg"));
fileTest(path.join(testsDir, "hof-effect-propagation-demo.alg"));

