// =============================================================================
// Construction and matching: unions, destructuring, errors, define/where/distinct, preserveOps.
//
// Extracted from the single-file suite (suite split, lane B). Registrations
// run at import time; src/test/index.ts imports this module in suite order.
// =============================================================================

import { test, eq, throws } from "./harness.js";
import { evalStd, evalNum, typeExt } from "./fixtures.js";
import { evalSource as runtimeEval } from "../runtime.js";
import { dataOf, BitsValue, bitsToString, ValueKind, ContextValue, Value } from "../types.js";
import { getTypeName, getType, createTypeSystem } from "../types-std.js";
import { getName, componentsView, getMembers } from "../slots.js";
import { formatValue } from "../primitives.js";
import { fqnBaseName } from "../symbols.js";

// == Union Types ==

test("union type: Int | String accepted", () => {
  // A function accepting Int | String should accept both
  const result1 = evalStd('f(x: Int | String) => x\nf(42)');
  eq(Number((dataOf(result1!) as BitsValue).data), 42);

  const result2 = evalStd('f(x: Int | String) => x\nf("hello")');
  eq(bitsToString(dataOf(result2!) as BitsValue), "hello");
});

test("union type: rejects non-matching type", () => {
  let threw = false;
  try { evalStd('f(x: Int | String) => x\nf(true)'); }
  catch (e: any) { threw = e.message.includes("Type error") || e.message.includes("type"); }
  eq(threw, true, "Bool should not match Int | String");
});

// == Structural Type (~) ==

test("structural type: ~Type in annotation", () => {
  // ~Int should accept any type with Int's structure
  // For now just verify the syntax parses and ~Int can be used
  const result = evalStd('f(x: ~Int) => x\nf(42)');
  eq(Number((dataOf(result!) as BitsValue).data), 42);
});

// == Binding Type Annotations ==

test("binding type: x: Int = 42", () => {
  const result = evalStd('x: Int = 42\nx');
  eq(Number((dataOf(result!) as BitsValue).data), 42);
});

test("binding type: x: String = hello", () => {
  const result = evalStd('x: String = "hello"\nx');
  eq(bitsToString(dataOf(result!) as BitsValue), "hello");
});

test("binding type: mismatch throws", () => {
  let threw = false;
  try { evalStd('x: Int = "hello"\nx'); }
  catch (e: any) { threw = e.message.includes("Type error") || e.message.includes("type"); }
  eq(threw, true, "String should not match Int annotation");
});

test("binding type: used in expression", () => {
  const result = evalStd('x: Int = 5\ny: Int = 10\nx + y');
  eq(Number((dataOf(result!) as BitsValue).data), 15);
});

// == Pattern Matching (when/is/then) ==

test("when: literal match — hit", () => {
  eq(evalNum("when 42 is 42 then 1 else 0"), 1);
});

test("when: literal match — miss", () => {
  eq(evalNum("when 42 is 99 then 1 else 0"), 0);
});

test("when: literal string match", () => {
  const result = evalStd('when "hello" is "hello" then 1 else 0');
  eq(Number((dataOf(result!) as BitsValue).data), 1);
});

test("when: wildcard always matches", () => {
  eq(evalNum("when 42 is _ then 99 else 0"), 99);
});

test("when: binding captures value", () => {
  eq(evalNum("when 42 is y then y + 1 else 0"), 43);
});

test("when: resolve-first — known var matches its value", () => {
  eq(evalNum("x = 42\nwhen 42 is x then 1 else 0"), 1);
});

test("when: resolve-first — known var mismatch", () => {
  eq(evalNum("x = 99\nwhen 42 is x then 1 else 0"), 0);
});

test("when: multi-case literal", () => {
  const src = `
v = 2
when v
  is 1 then 10
  is 2 then 20
  is 3 then 30
`;
  eq(evalNum(src), 20);
});

test("when: multi-case with binding fallthrough", () => {
  const src = `
v = 99
when v
  is 1 then 10
  is 2 then 20
  is other then other + 1
`;
  eq(evalNum(src), 100);
});

test("when: multi-case with wildcard", () => {
  const src = `
v = 99
when v
  is 1 then 10
  is _ then 0
`;
  eq(evalNum(src), 0);
});

test("when: no match throws", () => {
  throws(() => evalNum(`
when 5
  is 1 then 10
  is 2 then 20
`), "no matching case");
});

test("when: negative literal", () => {
  eq(evalNum("when 0 - 5 is -5 then 1 else 0"), 1);
});

test("when: typed mode preserves types", () => {
  const result = evalStd("when 42 is _ then 99 else 0");
  eq(getTypeName(result!), "Int");
  eq(Number((dataOf(result!) as BitsValue).data), 99);
});

test("when: true/false literal match", () => {
  const result = evalStd("when true is true then 1 else 0");
  eq(Number((dataOf(result!) as BitsValue).data), 1);
});

// == MultiValue Access (Y of x) ==

test("of: type of typed int", () => {
  const result = evalStd("type of 42");
  eq(result !== null, true);
  // The type of 42 is the Int type context — which has __name = "Int"
  eq(result!.kind, ValueKind.Structure);
  const nameBinding = getName(result as ContextValue);
  eq(nameBinding !== undefined, true);
  eq(bitsToString(dataOf(nameBinding!) as BitsValue), "Int");
});

test("of: type of typed string", () => {
  const result = evalStd('type of "hello"');
  eq(result !== null, true);
});

test("of: used in expression", () => {
  // type of 42 should return the Int type, which has __name = "Int"
  const result = evalStd('x = 42\ntype of x');
  eq(result !== null, true);
});

// == Structural Destructuring ==

test("when: struct destruct — extract fields", () => {
  const result = evalStd('p = {x: 10, y: 20}\nwhen p is {x, y} then x + y else 0');
  eq(Number((dataOf(result!) as BitsValue).data), 30);
});

test("when: struct destruct — field missing → no match", () => {
  const result = evalStd('p = {x: 10}\nwhen p is {x, y} then x + y else 99');
  eq(Number((dataOf(result!) as BitsValue).data), 99);
});

test("when: struct destruct — sub-pattern binding uses field name", () => {
  // {x: a} means extract field x, match against pattern a (unresolved → binding)
  // The binding name is x (field name), not a
  const result = evalStd('p = {x: 10, y: 20}\nwhen p is {x: a, y: b} then x * y else 0');
  eq(Number((dataOf(result!) as BitsValue).data), 200);
});

test("when: struct destruct — multi-case", () => {
  const src = `
p = {x: 5, y: 10}
when p
  is {z} then z
  is {x, y} then x + y
  is _ then 0
`;
  // {z} won't match because p doesn't have field z... wait, p has x and y not z
  // Actually {z} checks if field "z" exists — it doesn't, so falls through
  eq(Number((dataOf(evalStd(src)!) as BitsValue).data), 15);
});

test("when: struct destruct — single field", () => {
  const result = evalStd('p = {name: "hello"}\nwhen p is {name} then name else "none"');
  eq(bitsToString(dataOf(result!) as BitsValue), "hello");
});

// == Type Destructuring ==

test("when: type destruct — Object type", () => {
  const result = evalStd('p = {x: 10, y: 20}\nwhen p is Object(x, y) then x + y else 0');
  eq(Number((dataOf(result!) as BitsValue).data), 30);
});

test("when: type destruct — Object type mismatch", () => {
  // 42 is Int, not Object → should fall to else
  const result = evalStd('when 42 is Object(x) then x else 99');
  eq(Number((dataOf(result!) as BitsValue).data), 99);
});

test("when: type destruct — sub-pattern uses field name", () => {
  const result = evalStd('p = {x: 3, y: 4}\nwhen p is Object(x: a, y: b) then x + y else 0');
  eq(Number((dataOf(result!) as BitsValue).data), 7);
});

test("when: type destruct — multi-case objects", () => {
  const src = `
v = {x: 10, y: 20}
when v
  is {z} then z
  is Object(x, y) then x * y
  is _ then 0
`;
  eq(Number((dataOf(evalStd(src)!) as BitsValue).data), 200);
});

// == None Type ==

test("none: literal has None type", () => {
  const result = evalStd("none");
  eq(result !== null, true);
  eq(getTypeName(result!), "None");
});

test("none: formatValue", () => {
  const result = evalStd("none");
  eq(formatValue(result!), "none");
});

test("none: print", () => {
  const printed: string[] = [];
  const origLog = console.log;
  console.log = (msg: any) => printed.push(String(msg));
  try {
    evalStd("print(none)");
  } finally {
    console.log = origLog;
  }
  eq(printed[0], "none");
});

// == Error Values ==

test("error: creates error MultiValue", () => {
  const result = evalStd('error "something went wrong"');
  eq(result !== null, true);
  eq(result!.kind, ValueKind.Structure);
  eq(getType(result!) !== null, true);
  eq(componentsView(result!).has("error"), true);
});

test("error: has Error type", () => {
  const result = evalStd('error "bad"');
  eq(getTypeName(result!), "Error");
});

test("error: formatValue shows error", () => {
  const result = evalStd('error "bad"');
  eq(formatValue(result!), "error(bad)");
});

test("error: propagates through arithmetic", () => {
  const result = evalStd('error "bad" + 5');
  eq(result !== null, true);
  eq(componentsView(result!).has("error"), true);
});

test("error: propagates through multiplication", () => {
  const result = evalStd('3 * error "oops"');
  eq(componentsView(result!).has("error"), true);
});

test("error: propagates through function calls", () => {
  const result = evalStd('f(x) => x + 1\nf(error "bad")');
  eq(componentsView(result!).has("error"), true);
});

test("error: does not propagate through if condition", () => {
  // if-then-else is lazy — the error in unused branch shouldn't propagate
  const result = evalStd('if true then 42 else error "bad"');
  eq(Number((dataOf(result!) as BitsValue).data), 42);
});

test("error: error of non-error returns none", () => {
  const result = evalStd('error of 42');
  eq(getTypeName(result!), "None");
});

test("error: error of error returns the error value", () => {
  const result = evalStd('error of (error "bad")');
  eq(result !== null, true);
  // The error component is the string "bad"
  eq(bitsToString(dataOf(result!) as BitsValue), "bad");
});

test("error: type of returns Error type context", () => {
  const result = evalStd('type of (error "bad")');
  eq(result !== null, true);
  eq(result!.kind, ValueKind.Structure);
});

test("error: when/is can inspect error", () => {
  const src = `
result = error "bad"
e = error of result
when e
  is none then "ok"
  is msg then "error: " + msg
`;
  // 'none' resolves to the none value, so this is a literal match
  // 'msg' is a binding since it's not in scope
  const result = evalStd(src);
  eq(bitsToString(dataOf(result!) as BitsValue), "error: bad");
});

// == instanceof ==

test("instanceof: int is Int", () => {
  const result = evalStd("42 instanceof Int");
  eq(getTypeName(result!), "Bool");
  eq(Number((dataOf(result!) as BitsValue).data), 1);
});

test("instanceof: string is String", () => {
  const result = evalStd('"hello" instanceof String');
  eq(Number((dataOf(result!) as BitsValue).data), 1);
});

test("instanceof: int is not String", () => {
  const result = evalStd("42 instanceof String");
  eq(Number((dataOf(result!) as BitsValue).data), 0);
});

test("instanceof: bool is Bool", () => {
  const result = evalStd("true instanceof Bool");
  eq(Number((dataOf(result!) as BitsValue).data), 1);
});

test("instanceof: object is Object", () => {
  const result = evalStd("{x: 1} instanceof Object");
  eq(Number((dataOf(result!) as BitsValue).data), 1);
});

test("instanceof: Any matches everything", () => {
  const result = evalStd("42 instanceof Any");
  eq(Number((dataOf(result!) as BitsValue).data), 1);
});

test("instanceof: none is None", () => {
  const result = evalStd("none instanceof None");
  eq(Number((dataOf(result!) as BitsValue).data), 1);
});

test("instanceof: in if condition", () => {
  const result = evalStd('if 42 instanceof Int then "yes" else "no"');
  eq(bitsToString(dataOf(result!) as BitsValue), "yes");
});

// == subtypeof ==

test("subtypeof: Type subtypeof Type", () => {
  const result = evalStd("Type subtypeof Type");
  eq(getTypeName(result!), "Bool");
  eq(Number((dataOf(result!) as BitsValue).data), 1);
});

test("subtypeof: Int not subtypeof String", () => {
  const result = evalStd("Int subtypeof String");
  eq(Number((dataOf(result!) as BitsValue).data), 0);
});

// == Constructors ==

test("constructor: Int(42)", () => {
  const result = evalStd("Int(42)");
  eq(getTypeName(result!), "Int");
  eq(Number((dataOf(result!) as BitsValue).data), 42);
});

test("constructor: String(42) wraps as String", () => {
  const result = evalStd('String("hello")');
  eq(getTypeName(result!), "String");
  eq(bitsToString(dataOf(result!) as BitsValue), "hello");
});

test("constructor: Bool(1)", () => {
  const result = evalStd("Bool(1)");
  eq(getTypeName(result!), "Bool");
  eq(Number((dataOf(result!) as BitsValue).data), 1);
});

test("constructor: result passes instanceof", () => {
  const result = evalStd("Int(42) instanceof Int");
  eq(Number((dataOf(result!) as BitsValue).data), 1);
});

// == Type construction API (define, where, distinct, constructor) ==

test("define: create nominal record type", () => {
  const result = evalStd(`
Point = Type.define({x: Int, y: Int})
p = Point(10, 20)
p.x
`);
  eq(Number((dataOf(result!) as BitsValue).data), 10);
});

test("define: field access y", () => {
  const result = evalStd(`
Point = Type.define({x: Int, y: Int})
p = Point(10, 20)
p.y
`);
  eq(Number((dataOf(result!) as BitsValue).data), 20);
});

test("define: instanceof works", () => {
  const result = evalStd(`
Point = Type.define({x: Int, y: Int})
p = Point(10, 20)
p instanceof Point
`);
  eq(Number((dataOf(result!) as BitsValue).data), 1);
});

test("define: auto-naming propagates to instances", () => {
  // Auto-naming now works correctly: Symbols resolve from evalCtx which
  // has the named type. Instances share the same type object.
  const result = evalStd(`
Point = Type.define({x: Int, y: Int})
p = Point(1, 2)
type of p
`);
  eq(result!.kind, ValueKind.Structure);
  const nameB = getName(result as ContextValue);
  eq(bitsToString(dataOf(nameB!) as BitsValue), "Point");
});

test("define: wrong arg count throws", () => {
  throws(() => evalStd(`
Point = Type.define({x: Int, y: Int})
Point(10)
`), "expects 2 args");
});

test("define: formatValue shows named record", () => {
  const result = evalStd(`
Point = Type.define({x: Int, y: Int})
Point(10, 20)
`);
  eq(formatValue(result!), "Point(x: 10, y: 20)");
});

test("define: print shows record (name finalized after eval)", () => {
  const printed: string[] = [];
  const origLog = console.log;
  console.log = (msg: any) => printed.push(String(msg));
  try {
    evalStd(`
Point = Type.define({x: Int, y: Int})
print(Point(3, 4))
`);
  } finally {
    console.log = origLog;
  }
  // During evaluation, name is still <anonymous>; auto-naming runs after eval
  eq(printed[0].includes("x: 3, y: 4"), true);
});

test("define: structural type", () => {
  const result = evalStd(`
Pair = Type.define({a: Int, b: Int})
p = Pair(1, 2)
p.a
`);
  eq(Number((dataOf(result!) as BitsValue).data), 1);
});

test("define: subtypeof chain", () => {
  const result = evalStd(`
Shape = Type.define({})
Point = Type.define({x: Int, y: Int}, Shape)
Point subtypeof Shape
`);
  eq(Number((dataOf(result!) as BitsValue).data), 1);
});

test("where: refinement passes", () => {
  const result = evalStd(`
PositiveInt = Int & _ > 0
x = PositiveInt(5)
x
`);
  eq(Number((dataOf(result!) as BitsValue).data), 5);
});

test("where: refinement fails → error", () => {
  const result = evalStd(`
PositiveInt = Int & _ > 0
PositiveInt(0 - 1)
`);
  eq(componentsView(result!).has("error"), true);
});

test("where: refined type instanceof parent", () => {
  const result = evalStd(`
PositiveInt = Int & _ > 0
PositiveInt(5) instanceof Int
`);
  eq(Number((dataOf(result!) as BitsValue).data), 1);
});

// == Refinement types: && syntax ==

test("refinement: && syntax creates refined type", () => {
  const result = evalStd(`PositiveInt = Int & _ > 0
PositiveInt(5)`);
  eq(Number((dataOf(result!) as BitsValue).data), 5);
});

test("refinement: && syntax fails on invalid value", () => {
  const result = evalStd(`PositiveInt = Int & _ > 0
PositiveInt(0 - 5)`);
  eq(componentsView(result!).has("error"), true);
});

test("refinement: compound predicate with && and &&", () => {
  const result = evalStd(`SmallPos = Int & _ > 0 && _ < 100
SmallPos(50)`);
  eq(Number((dataOf(result!) as BitsValue).data), 50);
});

test("refinement: compound predicate rejects out-of-range", () => {
  const result = evalStd(`SmallPos = Int & _ > 0 && _ < 100
SmallPos(150)`);
  eq(componentsView(result!).has("error"), true);
});

test("refinement: bare Int satisfies refined type at call site if predicate passes", () => {
  const result = evalStd(`PositiveInt = Int & _ > 0
double(x: PositiveInt): Int => x * 2
double(5)`);
  eq(Number((dataOf(result!) as BitsValue).data), 10);
});

test("refinement: call site rejects value failing predicate", () => {
  let threw = false;
  try {
    evalStd(`PositiveInt = Int & _ > 0
f(x: PositiveInt): Int => x
f(0 - 5)`);
  } catch (e) {
    threw = true;
  }
  eq(threw, true);
});

test("refinement: already-refined value passes without re-checking", () => {
  const result = evalStd(`PositiveInt = Int & _ > 0
f(x: PositiveInt): Int => x
x = PositiveInt(7)
f(x)`);
  eq(Number((dataOf(result!) as BitsValue).data), 7);
});

test("refinement: logical AND still works for bools", () => {
  const result = evalStd(`true && false`);
  eq(Number((dataOf(result!) as BitsValue).data), 0);
});

test("refinement: logical AND short-circuits", () => {
  const result = evalStd(`true && true`);
  eq(Number((dataOf(result!) as BitsValue).data), 1);
});

// == preserveOps ==

test("preserveOps: lifted add preserves refined type", () => {
  const result = evalStd(`PositiveInt = Refinement.define({refines: Int, where: p => p > 0, preserve: "all"})
x = PositiveInt(5)
y = x + 3
y instanceof PositiveInt`);
  eq(Number((dataOf(result!) as BitsValue).data), 1);
});

test("preserveOps: lifted op produces error on predicate failure", () => {
  const result = evalStd(`PositiveInt = Refinement.define({refines: Int, where: p => p > 0, preserve: "all"})
x = PositiveInt(5)
x - 10`);
  eq(componentsView(result!).has("error"), true);
});

test("preserveOps: lifted op value is still correct", () => {
  const result = evalStd(`PositiveInt = Refinement.define({refines: Int, where: p => p > 0, preserve: "all"})
x = PositiveInt(5)
x + 3`);
  eq(Number((dataOf(result!) as BitsValue).data), 8);
});

test("preserveOps: specific ops can be lifted", () => {
  const result = evalStd(`PositiveInt = Refinement.define({refines: Int, where: p => p > 0, preserve: ["add"]})
x = PositiveInt(5)
y = x + 3
y instanceof PositiveInt`);
  eq(Number((dataOf(result!) as BitsValue).data), 1);
});

test("distinct: breaks instanceof", () => {
  const result = evalStd(`
UserId = Int.distinct()
UserId(42) instanceof Int
`);
  eq(Number((dataOf(result!) as BitsValue).data), 0);
});

test("distinct: instanceof self works", () => {
  const result = evalStd(`
UserId = Int.distinct()
UserId(42) instanceof UserId
`);
  eq(Number((dataOf(result!) as BitsValue).data), 1);
});

test("distinct: value preserved", () => {
  const result = evalStd(`
UserId = Int.distinct()
x = UserId(42)
x + 0
`);
  // Addition may or may not work depending on whether methods are copied
  // At minimum the primary value should be 42
  eq(Number((dataOf(result!) as BitsValue).data), 42);
});

test("distinct: symbol-fresh mint — no shared member symbols (C7.2b)", () => {
  // Ruling R2: distinct re-declares the parent's members under a fresh
  // scope. Non-conformance falls out of symbol-identity membership by
  // construction — no member-symbol key overlaps with the parent's.
  const ext = createTypeSystem();
  const intT = dataOf(ext.bindings["Int"] as unknown as Value) as ContextValue;
  const result = evalStd(`UserId = Int.distinct()\nUserId`);
  const distinctT = dataOf(result!) as ContextValue;
  const membersOf = (t: ContextValue) => getMembers(t) as ContextValue | undefined;
  const parentMembers = membersOf(intT);
  const distinctMembers = membersOf(distinctT);
  eq(parentMembers !== undefined && distinctMembers !== undefined, true);
  for (const key of distinctMembers!.bindings.keys()) {
    eq(parentMembers!.bindings.has(key), false);
  }
  // Same base-name surface: dispatch still finds every parent member.
  // (E3: the parent's `eq` is MULTI-BOUND — Int's own key plus Equatable's
  // drawn symbol point at ONE descriptor — while the fresh mint collapses
  // each member to a single fresh symbol. Compare base-name surfaces, not
  // raw key counts.)
  const baseNames = (m: ContextValue) => new Set([...m.bindings.keys()].map(fqnBaseName));
  eq(baseNames(distinctMembers!).size, baseNames(parentMembers!).size);
});

test("distinct: subtypeof fails in both directions (C7.2b)", () => {
  const result = evalStd(`
UserId = Int.distinct()
a = UserId subtypeof Int
b = Int subtypeof UserId
a || b
`);
  eq(Number((dataOf(result!) as BitsValue).data), 0);
});

test("distinct: dispatch works through fresh symbols (C7.2b)", () => {
  const result = evalStd(`
UserId = Int.distinct()
x = UserId(41)
(x + 1).toString()
`);
  eq(bitsToString(dataOf(result!) as BitsValue), "42");
});

test("construct spec key: custom construction authority", () => {
  // C7.2b (ruling R3): construction authority is DECLARED at mint time
  // via the reserved `construct` spec key — the post-hoc `.constructor()`
  // meta-method (which mutated a built type) is removed.
  const result = evalStd(`
Point = Type.define({x: Int, y: Int, construct: (a, b) => {x: a * 2, y: b * 2}})
p = Point(5, 10)
p.x
`);
  eq(Number((dataOf(result!) as BitsValue).data), 10);
});

test("construct spec key: result is tagged with the defined type", () => {
  const result = evalStd(`
Point = Type.define({x: Int, y: Int, construct: (a, b) => {x: a, y: b}})
p = Point(1, 2)
p instanceof Point
`);
  eq(Number((dataOf(result!) as BitsValue).data), 1);
});

test("constructor meta-method is removed (C7.2b)", () => {
  let threw = false;
  try {
    evalStd(`Type.define({x: Int}).constructor((a) => {x: a})`);
  } catch {
    threw = true;
  }
  eq(threw, true);
});

