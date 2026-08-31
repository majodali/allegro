// =============================================================================
// The Standard type system: core types, the .alg corpus registrations, export visibility.
//
// Extracted from the single-file suite (suite split, lane B). Registrations
// run at import time; src/test/index.ts imports this module in suite order.
// =============================================================================

import { test, eq, throws } from "./harness.js";
import { evalStd, evalNum, evalStr, typeExt, makeStructureWith } from "./fixtures.js";
import { fileTest, primNames, typeNames, testsDir } from "./alg-files.js";
import { evalSource as runtimeEval, Extension, extensionToStructure } from "../runtime.js";
import { primitives as primRegistry } from "../primitives.js";
import { withType as tsWithType } from "../types-std.js";
import { effectsOf as tsEffectsOf, livenessDispositions } from "../effects.js";
import { runAlgFile, corpusWalk } from "./alg-files.js";
import * as fs from "fs";
import * as path from "path";
import { getTypeName, structuralWrap, typeMethod, Type, typeMemberDescriptor, memberDescriptorsOf } from "../types-std.js";
import { BitsValue, bitsToString, makeInt, Value, makeStructure, stringToBits, makePrimitive, makeExpr, StructureValue } from "../types.js";
import { formatValue } from "../primitives.js";
import { metaReadRaw, setName as slotSetName, setFallbackMember as slotSetFallbackMember } from "../slots.js";
import { evaluate } from "../evaluator.js";
import { buildModuleObject } from "../modules.js";

// == Allegro Standard — Type System ==

test("type system: int literal has Int type", () => {
  const result = evalStd("42");
  eq(result !== null, true);
  eq(getTypeName(result!), "Int");
  eq(Number(result! as any).valueOf !== undefined, true);
  const p = result! as BitsValue;
  eq(Number(p.data), 42);
});

test("type system: string literal has String type", () => {
  const result = evalStd('"hello"');
  eq(result !== null, true);
  eq(getTypeName(result!), "String");
  eq(bitsToString(result! as BitsValue), "hello");
});

test("type system: int arithmetic preserves type", () => {
  const result = evalStd("3 + 4");
  eq(result !== null, true);
  eq(getTypeName(result!), "Int");
  const p = result! as BitsValue;
  eq(Number(p.data), 7);
});

test("type system: int subtraction", () => {
  const result = evalStd("10 - 3");
  eq(getTypeName(result!), "Int");
  eq(Number((result! as BitsValue).data), 7);
});

test("type system: int multiplication", () => {
  const result = evalStd("6 * 7");
  eq(getTypeName(result!), "Int");
  eq(Number((result! as BitsValue).data), 42);
});

test("type system: int comparison returns typed Bool", () => {
  const result = evalStd("3 < 5");
  eq(getTypeName(result!), "Bool");
  eq(Number((result! as BitsValue).data), 1);
});

test("type system: string dot length", () => {
  const result = evalStd('"hello".length');
  eq(result !== null, true);
  const p = result! as BitsValue;
  eq(Number(p.data), 5);
});

test("type system: int dot toString", () => {
  const result = evalStd("42.toString()");
  eq(result !== null, true);
  eq(bitsToString(result! as BitsValue), "42");
});

test("type system: string dot slice", () => {
  const result = evalStd('"hello".slice(1, 3)');
  eq(result !== null, true);
  eq(bitsToString(result! as BitsValue), "el");
});

test("type system: string dot indexOf", () => {
  const result = evalStd('"hello".indexOf("ll")');
  eq(result !== null, true);
  eq(Number((result! as BitsValue).data), 2);
});

test("type system: string trim returns typed String", () => {
  const result = evalStd('"  hello  ".trim()');
  eq(getTypeName(result!), "String");
  eq(bitsToString(result! as BitsValue), "hello");
});

test("type system: string startsWith returns typed Bool", () => {
  const result = evalStd('"hello".startsWith("hel")');
  eq(getTypeName(result!), "Bool");
  eq(Number((result! as BitsValue).data), 1);
});

test("type system: string split returns typed Array", () => {
  const result = evalStd('"a,b,c".split(",")');
  eq(getTypeName(result!), "Array");
});

test("type system: string replace returns typed String", () => {
  const result = evalStd('"aabb".replace("b", "x")');
  eq(getTypeName(result!), "String");
  eq(bitsToString(result! as BitsValue), "aaxx");
});

test("type system: string toUpperCase returns typed String", () => {
  const result = evalStd('"hello".toUpperCase()');
  eq(getTypeName(result!), "String");
  eq(bitsToString(result! as BitsValue), "HELLO");
});

test("type system: string toCharCodes returns typed Array", () => {
  const result = evalStd('"AB".toCharCodes()');
  eq(getTypeName(result!), "Array");
});

test("type system: string concat with +", () => {
  const result = evalStd('"hello" + " world"');
  eq(result !== null, true);
  eq(getTypeName(result!), "String");
  eq(bitsToString(result! as BitsValue), "hello world");
});

test("type system: typed function calls", () => {
  const result = evalStd("f(x) => x + 1\nf(5)");
  eq(result !== null, true);
  eq(getTypeName(result!), "Int");
  eq(Number((result! as BitsValue).data), 6);
});

test("type system: typed recursion", () => {
  const result = evalStd("factorial(n) => if n == 0 then 1 else n * factorial(n - 1)\nfactorial(5)");
  eq(result !== null, true);
  eq(getTypeName(result!), "Int");
  eq(Number((result! as BitsValue).data), 120);
});

test("type system: formatValue shows string without quotes for typed string", () => {
  const result = evalStd('"hello"');
  eq(formatValue(result!), "hello");
});

test("type system: formatValue shows int for typed int", () => {
  const result = evalStd("42");
  eq(formatValue(result!), "42");
});

test("type system: dot access on untyped context falls back to ctx_resolve", () => {
  const mathCtx = makeStructureWith({ pi: makeInt(3) });
  const ext: Extension = { name: "test", bindings: { math: mathCtx } };
  const result = evalStd("math.pi", [ext]);
  eq(result !== null, true);
  eq(Number((result! as BitsValue).data), 3);
});

test("type system: basics.alg works in typed mode", () => {
  const basicsSource = `
3 + 4 * 2
42
factorial(n) => if n == 0 then 1 else n * factorial(n - 1)
factorial(5)
f(x) => x
f(42)
fib(n) => if n < 2 then n else fib(n - 1) + fib(n - 2)
fib(10)
g(x) => x
g(42)
add(a, b) => a + b
add(3, 4)
`;
  const printed: string[] = [];
  const origLog = console.log;
  console.log = (msg: any) => printed.push(String(msg));
  try {
    evalStd(basicsSource);
  } finally {
    console.log = origLog;
  }
});

// == Float Type ==

test("type system: float literal has Float type", () => {
  const result = evalStd("3.14");
  eq(result !== null, true);
  eq(getTypeName(result!), "Float");
  eq(formatValue(result!), "3.14");
});

test("type system: float arithmetic", () => {
  const result = evalStd("1.5 + 2.5");
  eq(result !== null, true);
  eq(getTypeName(result!), "Float");
  eq(formatValue(result!), "4");
});

test("type system: float multiplication", () => {
  const result = evalStd("2.0 * 3.5");
  eq(getTypeName(result!), "Float");
  eq(formatValue(result!), "7");
});

test("type system: float division", () => {
  const result = evalStd("7.0 / 2.0");
  eq(getTypeName(result!), "Float");
  eq(formatValue(result!), "3.5");
});

test("type system: float comparison", () => {
  const result = evalStd("3.14 > 2.71");
  eq(result !== null, true);
  eq(Number((result! as BitsValue).data), 1);
});

test("type system: float toString", () => {
  const result = evalStd("3.14.toString()");
  eq(bitsToString(result! as BitsValue), "3.14");
});

// == Bool Type ==

test("type system: true literal has Bool type", () => {
  const result = evalStd("true");
  eq(result !== null, true);
  eq(getTypeName(result!), "Bool");
  eq(formatValue(result!), "true");
});

test("type system: false literal has Bool type", () => {
  const result = evalStd("false");
  eq(getTypeName(result!), "Bool");
  eq(formatValue(result!), "false");
});

test("type system: bool toString", () => {
  const result = evalStd("true.toString()");
  eq(bitsToString(result! as BitsValue), "true");
});

// == Array Type ==

test("type system: empty array literal", () => {
  const result = evalStd("[]");
  eq(result !== null, true);
  eq(getTypeName(result!), "Array");
  eq(formatValue(result!), "[]");
});

test("type system: array with elements", () => {
  const result = evalStd("[1, 2, 3]");
  eq(getTypeName(result!), "Array");
  eq(formatValue(result!), "[1, 2, 3]");
});

test("type system: array length", () => {
  const result = evalStd("[10, 20, 30].length");
  eq(result !== null, true);
  eq(Number((result! as BitsValue).data), 3);
});

test("type system: array bracket access", () => {
  const result = evalStd("[10, 20, 30][1]");
  eq(result !== null, true);
  eq(Number((result! as BitsValue).data), 20);
});

test("type system: array of strings", () => {
  const result = evalStd('["a", "b", "c"]');
  eq(getTypeName(result!), "Array");
});

test("type system: array slice", () => {
  const result = evalStd("[1, 2, 3].slice(1, 3)");
  eq(getTypeName(result!), "Array");
  eq(formatValue(result!), "[2, 3]");
});

// == Object Type ==

test("type system: empty object literal", () => {
  const result = evalStd("{}");
  eq(result !== null, true);
  eq(getTypeName(result!), "Object");
});

test("type system: object with fields", () => {
  const result = evalStd("{x: 1, y: 2}");
  eq(getTypeName(result!), "Object");
});

test("type system: object field access via dot", () => {
  const result = evalStd("{x: 42, y: 7}.x");
  eq(result !== null, true);
  eq(Number((result! as BitsValue).data), 42);
});

test("type system: object bracket access", () => {
  const result = evalStd('{name: "alice"}["name"]');
  eq(result !== null, true);
  eq(bitsToString(result! as BitsValue), "alice");
});

test("type system: nested object", () => {
  const result = evalStd("{a: {x: 1}}.a.x");
  eq(Number((result! as BitsValue).data), 1);
});

test("type system: object keys", () => {
  const result = evalStd("{x: 1, y: 2}.keys()");
  eq(getTypeName(result!), "Array");
});

// == Repetition: arbitrary-length arrays and objects ==

test("type system: array with 5 elements", () => {
  const result = evalStd("[10, 20, 30, 40, 50]");
  eq(getTypeName(result!), "Array");
  eq(formatValue(result!), "[10, 20, 30, 40, 50]");
});

test("type system: array with 5 elements bracket access last", () => {
  const result = evalStd("[10, 20, 30, 40, 50][4]");
  eq(Number((result! as BitsValue).data), 50);
});

test("type system: object with 4 fields", () => {
  const result = evalStd("{a: 1, b: 2, c: 3, d: 4}.d");
  eq(Number((result! as BitsValue).data), 4);
});

// == Logical Operators ==

test("logical: true && true", () => {
  const result = evalStd("true && true");
  eq(getTypeName(result!), "Bool");
  eq(formatValue(result!), "true");
});

test("logical: true && false", () => {
  eq(formatValue(evalStd("true && false")!), "false");
});

test("logical: false && true (short-circuit)", () => {
  eq(formatValue(evalStd("false && true")!), "false");
});

test("logical: true || false", () => {
  eq(formatValue(evalStd("true || false")!), "true");
});

test("logical: false || true", () => {
  eq(formatValue(evalStd("false || true")!), "true");
});

test("logical: false || false", () => {
  eq(formatValue(evalStd("false || false")!), "false");
});

test("logical: !true", () => {
  eq(formatValue(evalStd("!true")!), "false");
});

test("logical: !false", () => {
  eq(formatValue(evalStd("!false")!), "true");
});

test("logical: comparison with &&", () => {
  const result = evalStd("3 > 1 && 5 < 10");
  eq(formatValue(result!), "true");
});

test("logical: comparison with ||", () => {
  const result = evalStd("3 > 100 || 5 < 10");
  eq(formatValue(result!), "true");
});

test("logical: != operator works", () => {
  eq(Number((evalStd("3 != 4")! as BitsValue).data), 1);
  eq(Number((evalStd("3 != 3")! as BitsValue).data), 0);
});

// == Array Higher-Order Methods ==

test("array: map", () => {
  const result = evalStd("[1, 2, 3].map(x => x * 2)");
  eq(getTypeName(result!), "Array");
  eq(formatValue(result!), "[2, 4, 6]");
});

test("array: filter", () => {
  const result = evalStd("[1, 2, 3, 4, 5].filter(x => x > 3)");
  eq(getTypeName(result!), "Array");
  eq(formatValue(result!), "[4, 5]");
});

test("array: reduce (sum)", () => {
  const result = evalStd("[1, 2, 3, 4].reduce((acc, x) => acc + x, 0)");
  eq(Number((result! as BitsValue).data), 10);
});

test("array: map with string", () => {
  const result = evalStd('[1, 2, 3].map(x => x.toString())');
  eq(getTypeName(result!), "Array");
});

test("array: chained map and filter", () => {
  const result = evalStd("[1, 2, 3, 4].map(x => x * 2).filter(x => x > 4)");
  eq(formatValue(result!), "[6, 8]");
});

// == File-based Tests (Allegro Standard .alg files) ==


// Run all .alg test files
fileTest(path.join(testsDir, "types.alg"));
fileTest(path.join(testsDir, "dot-access.alg"));
fileTest(path.join(testsDir, "arrays.alg"));
fileTest(path.join(testsDir, "objects.alg"));
fileTest(path.join(testsDir, "logical.alg"));
fileTest(path.join(testsDir, "functions.alg"));

// Module test needs a math extension
const mathSource = fs.readFileSync(path.join(testsDir, "lib", "mymath.alg"), "utf-8");
const mathResult = runtimeEval(mathSource, undefined, [typeExt], undefined, true);
const mathBindings: Record<string, Value> = {};
for (const [key, binding] of mathResult.evalCtx.bindings) {
  if (binding.value !== undefined && !primNames.has(key) && !typeNames.has(key)) {
    mathBindings[key] = binding.value;
  }
}
const mathModuleCtx = extensionToStructure({ name: "mymath", bindings: mathBindings });
fileTest(path.join(testsDir, "modules.alg"), [{ name: "modules", bindings: { mymath: mathModuleCtx } }]);
fileTest(path.join(testsDir, "type-annotations.alg"));
fileTest(path.join(testsDir, "generics.alg"));

// == Module Export Tests ==

test("module export: export keyword marks value with exported component", () => {
  // B-097 V1 collapse-equivalent (conscious delta 1, ratified at the
  // plan gate): the export keyword now marks the BINDING
  // (Binding.visibility), never the value — same observable contract
  // (export-ness recorded, value fully usable), new carrier.
  const r = runtimeEval("export x = 42\nx\n", undefined, [typeExt], undefined, true);
  const result = r.value;
  eq(result !== null, true);
  // Should still be usable as a number
  eq(Number((result! as BitsValue).data), 42);
  // Export-ness is recorded — on the binding
  eq(r.evalCtx.bindings.get("x")?.visibility, "exported");
  {
  }
});

test("module export: non-exported values don't have exported component", () => {
  const result = evalStd("x = 42\nx\n");
  // Should NOT have "exported" component
  {
    eq(metaReadRaw(result!, "exported") === undefined, true);
  }
});

test("B-097 V1: export marks the BINDING, not the value (no component)", () => {
  const r = runtimeEval("export x = 42\ny = x\n", undefined, [typeExt], undefined, true);
  eq(r.evalCtx.bindings.get("x")?.visibility, "exported");
  // The value itself carries NO exported marker any more.
  eq(metaReadRaw(r.evalCtx.bindings.get("x")!.value!, "exported") === undefined, true);
});

test("B-097 V1: y = x does NOT export y (the aliasing wart is dead)", () => {
  const r = runtimeEval("export x = 42\ny = x\n", undefined, [typeExt], undefined, true);
  eq(r.evalCtx.bindings.get("y")?.visibility === undefined, true, "alias binding is not exported");
});

test("B-097 V1: exported typed function declaration marks its binding", () => {
  const r = runtimeEval("export double(n: Int): Int => n * 2\ndouble(21)\n", undefined, [typeExt], undefined, true);
  eq(r.evalCtx.bindings.get("double")?.visibility, "exported");
  eq(Number((r.value! as BitsValue).data), 42);
});

// == B-097 V2: pipeline unification ==


test("B-097 V2: fallbackMember is 3-ary — the evidence capsule answers possession", () => {
  const r = runtimeEval("secret = 41\nsecret", undefined, [typeExt], undefined, true);
  const accessCtx = r.evalCtx;
  const t = makeStructure();
  slotSetName(t, stringToBits("Probe"));
  let arity = 0;
  const hook = makePrimitive("probe.__getMember", (hargs) => {
    arity = hargs.length;
    const capsule = hargs[2] as import("../types.js").PrimitiveFunctionValue;
    const holdsSecret = capsule.fn([stringToBits("secret")], undefined as any, undefined as any);
    const holdsNope = capsule.fn([stringToBits("no_such_name")], undefined as any, undefined as any);
    const score = (Number((holdsSecret as BitsValue).data) === 1 ? 10 : 0)
    + (Number((holdsNope as BitsValue).data) === 1 ? 1 : 0);
    return makeInt(score);
  });
  slotSetFallbackMember(t, hook);
  const inst = tsWithType(makeStructure(), t);
  const td = primRegistry.type_dispatch;
  const out = evaluate(makeExpr(td, [inst, stringToBits("anything")]), accessCtx);
  eq(arity, 3, "hook received (instance, name, capsule)");
  eq(Number((out as BitsValue).data), 10, "capsule: holds in-scope name, denies unknown");
});

test("B-097 V2: an effectful fallbackMember's tag survives dispatch (applyPrimitive path)", () => {
  const r = runtimeEval("x = 1", undefined, [typeExt], undefined, true);
  const t = makeStructure();
  slotSetName(t, stringToBits("FxProbe"));
  const hook = makePrimitive("fx.__getMember", () => makeInt(5), false, ["io"]);
  slotSetFallbackMember(t, hook);
  const inst = tsWithType(makeStructure(), t);
  const out = evaluate(makeExpr(primRegistry.type_dispatch, [inst, stringToBits("f")]), r.evalCtx);
  const eff = tsEffectsOf(out);
  eq(eff != null && eff.has("io"), true, "hook effect tag harvested (was silently dropped pre-V2)");
});

test("B-097 V2: typeMethod raw-binding fallthrough is narrowed to protocol slots", () => {
  const t = makeStructure();
  slotSetName(t, stringToBits("Leaky"));
  // a stray non-slot binding on the type Context — pre-V2 this was
  // name-reachable through dispatch; post-V2 it is not a member.
  t.bindings.set("stray", { key: "stray", value: makeInt(9) });
  const r = runtimeEval("x = 1", undefined, [typeExt], undefined, true);
  const inst = tsWithType(makeStructure(), t);
  let threw = false;
  try { evaluate(makeExpr(primRegistry.type_dispatch, [inst, stringToBits("stray")]), r.evalCtx); }
  catch (e: any) { threw = e.message.includes("not found"); }
  eq(threw, true, "stray type-Context binding no longer leaks through dispatch");
});

// == B-097 V3: private members (the flip) ==

/** Evaluate Standard source expecting an AllegroError; returns its message. */
function stdErrorMessage(source: string): string {
  try {
    evalStd(source);
  } catch (e: any) {
    return e.message ?? String(e);
  }
  return "<no error>";
}

test("B-097 V3: private field — the type's own method reads it; external dot access denies", () => {
  const out = evalStd(
    "Vault = Type.define({owner: String, secret: private(Int), reveal: (self) => self.secret})\n" +
    "v = Vault(\"alice\", 42)\nv.reveal()\n");
  eq(Number((out! as BitsValue).data), 42, "own method holds the member privilege");
  const msg = stdErrorMessage(
    "Vault = Type.define({owner: String, secret: private(Int)})\n" +
    "v = Vault(\"alice\", 42)\nv.secret\n");
  eq(msg.includes("'secret' is private to 'Vault'"), true, "denial names privacy and the type (names-public)");
});

test("B-097 V3: private method — internal call works, external call denies", () => {
  const out = evalStd(
    "Counter = Type.define({n: Int, bump: private((self) => self.n + 1), next: (self) => self.bump()})\n" +
    "c = Counter(41)\nc.next()\n");
  eq(Number((out! as BitsValue).data), 42);
  const msg = stdErrorMessage(
    "Counter = Type.define({n: Int, bump: private((self) => self.n + 1)})\n" +
    "c = Counter(41)\nc.bump()\n");
  eq(msg.includes("'bump' is private to 'Counter'"), true);
});

test("B-097 V3: private operator member — a + b denies outside, works from the type's own code", () => {
  const out = evalStd(
    "Money = Type.define({amt: Int, add: private((self, other) => Money(self.amt + other.amt)), plus: (self, other) => self + other})\n" +
    "Money(2).plus(Money(3)).amt\n");
  eq(Number((out! as BitsValue).data), 5, "operator dispatch inside a member body holds privilege");
  const msg = stdErrorMessage(
    "Money = Type.define({amt: Int, add: private((self, other) => Money(self.amt + other.amt))})\n" +
    "Money(2) + Money(3)\n");
  eq(msg.includes("'add' is private to 'Money'"), true, "PRIM_TO_METHOD dispatch shares the mediation gate");
});

test("B-097 V3: destructuring a private field outside its scope is an ERROR naming privacy (V-R6)", () => {
  const msg = stdErrorMessage(
    "Vault = Type.define({owner: String, secret: private(Int)})\n" +
    "v = Vault(\"alice\", 42)\n" +
    "when v is Vault(owner, secret) then owner else \"no\"\n");
  eq(msg.includes("'secret' is private to 'Vault'"), true, "not a silent no-match");
  // Public-only patterns keep working; inside a member body the private
  // field destructures normally (privilege held).
  const pub = evalStd(
    "Vault = Type.define({owner: String, secret: private(Int)})\n" +
    "v = Vault(\"alice\", 42)\n" +
    "when v is Vault(owner) then owner else \"no\"\n");
  eq(bitsToString(pub! as BitsValue), "alice");
  const inner = evalStd(
    "Vault = Type.define({owner: String, secret: private(Int), peek: (self) => when self is Vault(secret) then secret else 0 - 1})\n" +
    "Vault(\"alice\", 42).peek()\n");
  eq(Number((inner! as BitsValue).data), 42);
});

test("B-097 V3: printer omits private fields with an honest `…` marker (V-R6)", () => {
  const r = runtimeEval(
    "Vault = Type.define({owner: String, secret: private(Int)})\n" +
    "v = Vault(\"alice\", 42)\nv\n", undefined, [typeExt], undefined, true);
  const rendered = formatValue(r.value!);
  eq(rendered.includes("owner: alice"), true);
  eq(rendered.includes("42"), false, "private value never rendered");
  eq(rendered.includes("…"), true, "omission is marked");
  const ts = evalStd(
    "Vault = Type.define({owner: String, secret: private(Int)})\n" +
    "Vault(\"alice\", 42).toString()\n");
  const tsStr = bitsToString(ts! as BitsValue);
  eq(tsStr.includes("42"), false, "auto-toString omits private fields too");
  eq(tsStr.includes("…"), true);
});

test("B-097 V3: conformance counts only externally-reachable members (V-R6)", () => {
  // Actual side: a private `x` satisfies nothing through the loose
  // (structural-wrap) surface.
  const r = runtimeEval(
    "HasX = Interface.define({x: Int})\n" +
    "PrivX = Type.define({x2: Int, x: private(Int)})\n" +
    "PubX = Type.define({x: Int})\n" +
    "a = PrivX(1, 2)\nb = PubX(5)\nb\n", undefined, [typeExt], undefined, true);
  const iface = r.evalCtx.bindings.get("HasX")!.value! as StructureValue;
  const privInst = r.evalCtx.bindings.get("a")!.value!;
  const pubInst = r.evalCtx.bindings.get("b")!.value!;
  const looseIface = structuralWrap(iface);
  const instOf = typeMethod(Type, "instanceof")! as import("../types.js").PrimitiveFunctionValue;
  const privCheck = instOf.fn([looseIface, privInst], undefined as any, undefined as any);
  eq(Number((privCheck as BitsValue).data), 0, "private x does not satisfy ~{x}");
  const pubCheck = instOf.fn([looseIface, pubInst], undefined as any, undefined as any);
  eq(Number((pubCheck as BitsValue).data), 1, "public x does");
  // Expected side: an interface's own private declaration imposes no
  // requirement on conformers (its symbol is interface-local).
  const r2 = runtimeEval(
    "Wants = Interface.define({x: Int, hidden: private(Int)})\n" +
    "Impl = Type.define({x: Int}, Wants)\n" +
    "i = Impl(7)\ni\n", undefined, [typeExt], undefined, true);
  const wants = r2.evalCtx.bindings.get("Wants")!.value! as StructureValue;
  const impl = r2.evalCtx.bindings.get("i")!.value!;
  const declCheck = instOf.fn([wants, impl], undefined as any, undefined as any);
  eq(Number((declCheck as BitsValue).data), 1, "expected-side private is not required");
});

test("B-097 V3: a foreign type cannot draw a bundle's private member; privates never propagate", () => {
  const msg = stdErrorMessage(
    "Helpers = Type.define({calc: private((self) => 1), pub: (self) => 2})\n" +
    "User = Type.define({x: Int, calc: (self) => 3}, Helpers)\n");
  eq(msg.includes("private to 'Helpers'"), true, "draw-from of a foreign private is a denial");
  // The bundle's private member is not copied into a drawing type.
  const r = runtimeEval(
    "Helpers = Type.define({calc: private((self) => 1), pub: (self) => 2})\n" +
    "User = Type.define({x: Int}, Helpers)\n" +
    "u = User(9)\nu\n", undefined, [typeExt], undefined, true);
  const userType = r.evalCtx.bindings.get("User")!.value! as StructureValue;
  eq(typeMemberDescriptor(userType, "calc"), null, "private member stayed with the bundle");
  eq(typeMemberDescriptor(userType, "pub") !== null, true, "public bundle member copied as before");
});

test("B-097 V3: declaring a private member that shadows a drawn member is a define-time error", () => {
  const msg = stdErrorMessage(
    "Base = Type.define({tag: (self) => 1})\n" +
    "Shadow = Type.define({x: Int, tag: private(Int)}, Base)\n");
  eq(msg.includes("cannot declare 'tag' private"), true);
});

test("B-097 V3: reflection — names and flags free, accessors gated (V-R7)", () => {
  const r = runtimeEval(
    "Vault = Type.define({owner: String, secret: private(Int), code: private((self) => 7)})\n" +
    "v = Vault(\"alice\", 42)\nv\n", undefined, [typeExt], undefined, true);
  const vaultType = r.evalCtx.bindings.get("Vault")!.value! as StructureValue;
  // Enumeration lists private members (names-public), flags recorded —
  // introspection/PCP tooling keeps unrestricted name-level reads.
  const descs = memberDescriptorsOf(vaultType);
  eq(descs.has("secret") && descs.has("code"), true, "enumeration counts are unchanged by privacy");
  const codeDesc = descs.get("code")!;
  const listKeys = (v: Value): string[] => {
    const listing = primRegistry.ctx_bindings.fn([v], r.evalCtx, evaluate) as import("../types.js").ExpressionValue;
    return listing.args.map((pair) =>
      bitsToString((pair as import("../types.js").ExpressionValue).args[0] as BitsValue));
  };
  // The descriptor's reflective listing keeps name + flag pairs free but
  // withholds the ACCESSOR (the implementation) without possession
  // evidence — the one value-bearing reflective route.
  const descKeys = listKeys(codeDesc as unknown as Value);
  eq(descKeys.includes("name") && descKeys.includes("private"), true, "names and flags are free reads");
  eq(descKeys.includes("value"), false, "the private member's impl is withheld without evidence");
  // Same gate on instances: private (name, value) pairs are withheld.
  const inst = r.evalCtx.bindings.get("v")!.value!;
  const instKeys = listKeys(inst);
  eq(instKeys.includes("owner"), true);
  eq(instKeys.includes("secret"), false, "value-bearing reflection withholds the private pair");
  // A PUBLIC member's descriptor lists its impl freely, unchanged.
  const ownerDesc = descs.get("owner")!;
  eq(listKeys(ownerDesc as unknown as Value).includes("fieldType"), true, "public descriptors list everything");
});

test("B-097 V3: readonly(...) is reserved vocabulary — recorded on the descriptor, inert until B-046", () => {
  const r = runtimeEval(
    "Point = Type.define({x: readonly(Int), y: Int})\n" +
    "p = Point(3, 4)\np.x\n", undefined, [typeExt], undefined, true);
  eq(Number((r.value! as BitsValue).data), 3, "reads work unchanged");
  const pointType = r.evalCtx.bindings.get("Point")!.value! as StructureValue;
  const xDesc = typeMemberDescriptor(pointType, "x")!;
  eq(xDesc.bindings.get("readonly")?.value !== undefined, true, "attribute recorded for B-046");
});

test("module export: exported functions work normally", () => {
  const result = evalStd("export f = x => x * 2\nf(21)\n");
  eq(Number((result! as BitsValue).data), 42);
});

test("module export: typed module object exposes exports via dot", () => {
  // Build a module with exports
  const modSource = "private_val = 99\nexport pub_val = 42\nexport pub_fn = x => x * 2\n";
  const modResult = runtimeEval(modSource, undefined, [typeExt], undefined, true);

  // Extract and evaluate bindings, then build typed module.
  // B-097 V1: export-ness is read off the BINDING (visibility), never
  // the value — same derivation the module loader uses.
  const allBindings: Record<string, Value> = {};
  const exportedNames = new Set<string>();
  for (const [key, binding] of modResult.evalCtx.bindings) {
    if (binding.value !== undefined && !primNames.has(key) && !typeNames.has(key)) {
      const evaluated = evaluate(binding.value, modResult.evalCtx);
      allBindings[key] = evaluated;
      if (binding.visibility === "exported") {
        exportedNames.add(key);
      }
    }
  }

  const moduleObj = buildModuleObject("testmod", allBindings, exportedNames);

  // Access exported field via type_dispatch
  const ext: Extension = { name: "test", bindings: { testmod: moduleObj } };
  const pubResult = evalStd("testmod.pub_val", [ext]);
  eq(Number((pubResult! as BitsValue).data), 42);

  // Access exported function
  const fnResult = evalStd("testmod.pub_fn(21)", [ext]);
  eq(Number((fnResult! as BitsValue).data), 42);

  // Private field should NOT be accessible via type_dispatch
  let threw = false;
  try { evalStd("testmod.private_val", [ext]); }
  catch (e: any) { threw = e.message.includes("not found") || e.message.includes("not exported"); }
  eq(threw, true);
});

