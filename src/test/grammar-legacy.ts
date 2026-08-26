// =============================================================================
// The Earley combinator layer: grammar extensions, Allegro-level primitives, the JSON parser.
//
// Extracted from the single-file suite (suite split, lane B). Registrations
// run at import time; src/test/index.ts imports this module in suite order.
// =============================================================================

import { test, eq, throws } from "./harness.js";
import { evalNum, evalNumExt, makeCtxWith, typeExt } from "./fixtures.js";
import { evalSource as runtimeEval, Extension } from "../runtime.js";
import { GrammarExtension, registryGet } from "../grammar-ext.js";
import { dataOf, ValueKind, makeInt, makePrimitive, AllegroError, ContextValue, BitsValue, makeFloat, stringToBits, makeContext, Value, bitsToFloat, bitsToString } from "../types.js";
import { extensionToContext } from "../runtime.js";
import { Grammar, parseGrammar } from "../parser.js";

// == Grammar Extensions ==

/** Helper: build a Context value with named bindings */


/** Evaluate with Earley grammar extensions and return numeric result (for grammar primitive tests) */
function evalNumGrammar(
  source: string,
  extensions: Extension[],
  grammarExt: GrammarExtension,
): number {
  const result = runtimeEval(source + "\n", undefined, extensions, grammarExt);
  const val = result.value;
  if (val === null) throw new Error("No value produced");
  const p = dataOf(val);
  if (p.kind !== ValueKind.Bits) throw new Error(`Expected Bits, got ${p.kind}`);
  if (p.length === 64 && p.data >= 2n ** 63n) return Number(p.data - 2n ** 64n);
  return Number(p.data);
}

test("hybrid parser: base syntax", () => {
  eq(evalNumExt("3 + 4 * 2"), 11);
});

test("hybrid parser: dot access resolves from context", () => {
  const mathCtx = makeCtxWith({ pi: makeInt(3) });
  const ext: Extension = { name: "test", bindings: { math: mathCtx } };
  eq(evalNumExt("math.pi", [ext]), 3);
});

test("hybrid parser: dot access chained", () => {
  const inner = makeCtxWith({ x: makeInt(42) });
  const outer = makeCtxWith({ inner: inner });
  const ext: Extension = { name: "test", bindings: { outer: outer } };
  eq(evalNumExt("outer.inner.x", [ext]), 42);
});

test("hybrid parser: dot access with function call", () => {
  const mathCtx = makeCtxWith({ double: makePrimitive("double", (args) => {
    const p = dataOf(args[0]);
    if (p.kind !== ValueKind.Bits) throw new AllegroError("double: expected Bits");
    return makeInt(Number(p.data) * 2);
  }) });
  const ext: Extension = { name: "test", bindings: { math: mathCtx } };
  eq(evalNumExt("math.double(21)", [ext]), 42);
});

test("hybrid parser: dot access in arithmetic", () => {
  const mathCtx = makeCtxWith({ pi: makeInt(3), e: makeInt(2) });
  const ext: Extension = { name: "test", bindings: { math: mathCtx } };
  eq(evalNumExt("math.pi + math.e", [ext]), 5);
});

test("hybrid parser: import statement with extension binding", () => {
  const ext: Extension = { name: "test", bindings: { foo: makeInt(42) } };
  eq(evalNumExt("import foo\nfoo", [ext]), 42);
});

test("hybrid parser: import + dot access", () => {
  const mathCtx = makeCtxWith({ pi: makeInt(3) });
  const ext: Extension = { name: "test", bindings: { math: mathCtx } };
  eq(evalNumExt("import math\nmath.pi", [ext]), 3);
});

test("hybrid parser: import doesn't shadow extension binding", () => {
  const ext: Extension = { name: "test", bindings: { x: makeInt(99) } };
  eq(evalNumExt("import x\nx", [ext]), 99);
});

test("grammar ext: extensionToContext wraps bindings", () => {
  const ext: Extension = { name: "math", bindings: { pi: makeInt(3), tau: makeInt(6) } };
  const ctx = extensionToContext(ext) as ContextValue;
  eq(ctx.kind, ValueKind.Structure);
  eq(ctx.bindings.size, 2);
  const pi = ctx.bindings.get("pi");
  eq(pi !== undefined, true);
  if (pi?.value?.kind === ValueKind.Bits) {
    eq(Number(pi.value.data), 3);
  }
});

// == Allegro-Level Grammar Primitives ==

test("allegro grammar: build extension from Allegro code", () => {
  // Build grammar extension as a single chained expression (no named bindings
  // that would be re-evaluated without memoization)
  const source = `grammar_build(grammar_add_import(grammar_add_dot_access(grammar_builder())))`;
  const result = runtimeEval(source + "\n");
  const val = result.value!;
  const p = dataOf(val);
  eq(p.kind, ValueKind.Bits, "grammar_build should return a handle");
  const handle = Number((p as BitsValue).data);
  const grammarExt = registryGet(handle) as GrammarExtension;
  eq(grammarExt.additionalAlternatives instanceof Map, true);
  eq(grammarExt.additionalAlternatives.size > 0, true);
});

test("allegro grammar: extension built from Allegro enables dot access", () => {
  // Step 1: Allegro code builds the grammar extension
  const buildResult = runtimeEval("ext = grammar_build(grammar_add_dot_access(grammar_builder()))\next\n");
  const extVal = buildResult.value!;
  const extP = dataOf(extVal);
  const handle = Number((extP as BitsValue).data);
  const grammarExt = registryGet(handle) as GrammarExtension;

  // Step 2: Use the Allegro-built extension to parse code with dot access
  const mathCtx = makeCtxWith({ pi: makeInt(3) });
  const ext: Extension = { name: "test", bindings: { math: mathCtx } };
  eq(evalNumGrammar("math.pi", [ext], grammarExt), 3);
});

test("allegro grammar: extension built from Allegro enables import", () => {
  // Step 1: Build extension from Allegro
  const buildResult = runtimeEval("ext = grammar_build(grammar_add_import(grammar_builder()))\next\n");
  const extVal = buildResult.value!;
  const extP = dataOf(extVal);
  const handle = Number((extP as BitsValue).data);
  const grammarExt = registryGet(handle) as GrammarExtension;

  // Step 2: Use it to parse import syntax
  const ext: Extension = { name: "test", bindings: { foo: makeInt(42) } };
  eq(evalNumGrammar("import foo\nfoo", [ext], grammarExt), 42);
});

test("allegro grammar: full pipeline - build, then use dot + import", () => {
  // Step 1: Build full extension from Allegro (bare expression = direct result)
  const buildSource = `
grammar_build(grammar_add_import(grammar_add_dot_access(grammar_builder())))
`;
  const buildResult = runtimeEval(buildSource);
  const extP = dataOf(buildResult.value!);
  const grammarExt = registryGet(Number((extP as BitsValue).data)) as GrammarExtension;

  // Step 2: Use it to parse a program with import + dot access
  const mathCtx = makeCtxWith({ pi: makeInt(3), e: makeInt(2) });
  const ext: Extension = { name: "test", bindings: { math: mathCtx } };
  eq(evalNumGrammar("import math\nmath.pi + math.e", [ext], grammarExt), 5);
});

// == Standalone Grammar: JSON Parser ==
// Tests that entirely new grammars (not extending baseGrammar) can be built
// and used to parse non-Allegro languages.

function buildJsonGrammar(): Grammar {
  const g = new Grammar({ whitespace: /[ \t\n\r]+/ });

  // Terminals
  const numberLit = g.terminal(/\-?[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?/, "NumberLit");
  const stringLit = g.terminal(/"([^"\\]|\\.)*"/, "StringLit");
  const trueLit = g.terminal("true", "True");
  const falseLit = g.terminal("false", "False");
  const nullLit = g.terminal("null", "Null");

  // Value → NumberLit | StringLit | True | False | Null | Array | Object
  const jsonValue = g.disjunction([], "JsonValue");
  // Propagate val through the Disjunction
  (jsonValue as any).attribute("val", Object, function (node: any) {
    return node.children[0].val;
  });

  // Number: attribute extracts numeric value as Bits
  const numberVal = g.phrase([numberLit], "NumberVal");
  (numberVal as any).attribute("val", Object, function (node: any) {
    const n = parseFloat(node.children[0].text);
    return Number.isInteger(n) ? makeInt(n) : makeFloat(n);
  });

  // String: attribute extracts string content (without quotes) as Bits
  const stringVal = g.phrase([stringLit], "StringVal");
  (stringVal as any).attribute("val", Object, function (node: any) {
    const raw = node.children[0].text;
    // Strip surrounding quotes and unescape
    const content = raw.slice(1, -1).replace(/\\(.)/g, (_: string, c: string) => {
      if (c === "n") return "\n";
      if (c === "t") return "\t";
      if (c === "r") return "\r";
      return c;
    });
    return stringToBits(content);
  });

  // Boolean true
  const trueVal = g.phrase([trueLit], "TrueVal");
  (trueVal as any).attribute("val", Object, function () {
    return makeInt(1);
  });

  // Boolean false
  const falseVal = g.phrase([falseLit], "FalseVal");
  (falseVal as any).attribute("val", Object, function () {
    return makeInt(0);
  });

  // Null
  const nullVal = g.phrase([nullLit], "NullVal");
  (nullVal as any).attribute("val", Object, function () {
    return makeInt(0); // null → 0 for simplicity
  });

  // Array: "[" JsonValue ("," JsonValue)* "]" | "[" "]"
  const comma = g.terminal(",");
  const lbracket = g.terminal("[");
  const rbracket = g.terminal("]");

  const arrayElements = g.repeat(jsonValue, { min: 0, delimiter: comma });
  const arrayVal = g.phrase([lbracket, arrayElements, rbracket], "ArrayVal");
  (arrayVal as any).attribute("val", Object, function (node: any) {
    const elementsNode = node.children[1]; // the Repetition node
    const result = makeContext();
    let index = 0;
    for (const child of elementsNode.children) {
      if (child.val !== undefined) {
        const key = String(index);
        result.bindings.set(key, { key, value: child.val as Value });
        result.bindingList.push({ key, value: child.val as Value });
        index++;
      }
    }
    const lenKey = "length";
    result.bindings.set(lenKey, { key: lenKey, value: makeInt(index) });
    result.bindingList.push({ key: lenKey, value: makeInt(index) });
    return result;
  });

  // Object: "{" (pair ("," pair)*)? "}"
  const lbrace = g.terminal("{");
  const rbrace = g.terminal("}");
  const colon = g.terminal(":");

  const pair = g.phrase([stringLit, colon, jsonValue], "Pair");
  (pair as any).attribute("key", Object, function (node: any) {
    return node.children[0].text.slice(1, -1);
  });
  (pair as any).attribute("val", Object, function (node: any) {
    return node.children[2].val;
  });

  const objectEntries = g.repeat(pair, { min: 0, delimiter: comma });
  const objectVal = g.phrase([lbrace, objectEntries, rbrace], "ObjectVal");
  (objectVal as any).attribute("val", Object, function (node: any) {
    const entriesNode = node.children[1];
    const result = makeContext();
    for (const child of entriesNode.children) {
      if (child.key !== undefined && child.val !== undefined) {
        const key = child.key as string;
        result.bindings.set(key, { key, value: child.val as Value });
        result.bindingList.push({ key, value: child.val as Value });
      }
    }
    return result;
  });

  // Wire up JsonValue alternatives
  (jsonValue as any).alternatives.push(numberVal, stringVal, trueVal, falseVal, nullVal, arrayVal, objectVal);

  // Root: a single JsonValue
  const root = g.phrase([jsonValue], "Root");
  (root as any).attribute("val", Object, function (node: any) {
    return node.children[0].val;
  });

  g.target = root;
  return g;
}

test("standalone grammar: parse JSON number", () => {
  const g = buildJsonGrammar();
  const result = parseGrammar(g, "42");
  eq(result.errors.length, 0);
  const val = result.tree.val as BitsValue;
  eq(val.kind, ValueKind.Bits);
  eq(Number(val.data), 42);
});

test("standalone grammar: parse JSON negative number", () => {
  const g = buildJsonGrammar();
  const result = parseGrammar(g, "-3.14");
  eq(result.errors.length, 0);
  const val = result.tree.val as BitsValue;
  eq(bitsToFloat(val), -3.14);
});

test("standalone grammar: parse JSON string", () => {
  const g = buildJsonGrammar();
  const result = parseGrammar(g, '"hello world"');
  eq(result.errors.length, 0);
  const val = result.tree.val as BitsValue;
  eq(val.kind, ValueKind.Bits);
  eq(bitsToString(val), "hello world");
});

test("standalone grammar: parse JSON boolean", () => {
  const g = buildJsonGrammar();
  const trueResult = parseGrammar(g, "true");
  eq(Number((trueResult.tree.val as BitsValue).data), 1);
  const falseResult = parseGrammar(g, "false");
  eq(Number((falseResult.tree.val as BitsValue).data), 0);
});

test("standalone grammar: parse JSON array", () => {
  const g = buildJsonGrammar();
  const result = parseGrammar(g, "[1, 2, 3]");
  eq(result.errors.length, 0);
  const val = result.tree.val as ContextValue;
  eq(val.kind, ValueKind.Structure);
  // Check length
  const len = (val.bindings.get("length")!).value as BitsValue;
  eq(Number(len.data), 3);
  // Check elements
  eq(Number((val.bindings.get("0")!.value as BitsValue).data), 1);
  eq(Number((val.bindings.get("1")!.value as BitsValue).data), 2);
  eq(Number((val.bindings.get("2")!.value as BitsValue).data), 3);
});

test("standalone grammar: parse JSON empty array", () => {
  const g = buildJsonGrammar();
  const result = parseGrammar(g, "[]");
  eq(result.errors.length, 0);
  const val = result.tree.val as ContextValue;
  const len = (val.bindings.get("length")!).value as BitsValue;
  eq(Number(len.data), 0);
});

test("standalone grammar: parse JSON object", () => {
  const g = buildJsonGrammar();
  const result = parseGrammar(g, '{"x": 10, "y": 20}');
  eq(result.errors.length, 0);
  const val = result.tree.val as ContextValue;
  eq(val.kind, ValueKind.Structure);
  eq(Number((val.bindings.get("x")!.value as BitsValue).data), 10);
  eq(Number((val.bindings.get("y")!.value as BitsValue).data), 20);
});

test("standalone grammar: parse nested JSON", () => {
  const g = buildJsonGrammar();
  const result = parseGrammar(g, '{"items": [1, 2], "name": "test"}');
  eq(result.errors.length, 0);
  const val = result.tree.val as ContextValue;
  // Check items array
  const items = val.bindings.get("items")!.value as ContextValue;
  eq(items.kind, ValueKind.Structure);
  eq(Number((items.bindings.get("length")!.value as BitsValue).data), 2);
  eq(Number((items.bindings.get("0")!.value as BitsValue).data), 1);
  // Check name string
  const name = val.bindings.get("name")!.value as BitsValue;
  eq(name.kind, ValueKind.Bits);
});

