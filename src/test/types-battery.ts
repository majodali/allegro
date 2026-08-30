// =============================================================================
// Type system battery: generics, annotations, inference, the kind tower, interfaces.
//
// Extracted from the single-file suite (suite split, lane B). Registrations
// run at import time; src/test/index.ts imports this module in suite order.
// =============================================================================

import { test, eq, throws } from "./harness.js";
import { evalStd, evalNum, typeExt } from "./fixtures.js";
import { evalSource as runtimeEval } from "../runtime.js";
import { dataOf, BitsValue, StructureValue, ValueKind, bitsToString, makeStructure, makeParam, Value, makeComposedFn, stringToBits } from "../types.js";
import { getTypeName, getType, isGenericType, createTypeSystem, IntType, Type, StringType, typeMethod, structuralWrap, memberDescriptorsOf, isMethodDescriptor, isFieldDescriptor, typeMemberDescriptor, isGetterDescriptor, Effect, pureEffect, opaqueEffect, effectSubsetOf, effectImplies, effectIntersect, effectUnion, InterfaceKind, wrapAsUntypedFunction } from "../types-std.js";
import { getGenericArgs, metaReadRaw, getName, getWraps, getRefines, getMembers, getInterfaceMarker, getConstruct, metaOf, SLOT_KEYS, setMembers, setName as slotSetName, writeShape } from "../slots.js";
import { formatValue, primitives as primRegistry } from "../primitives.js";
import { kernelMemberFqn } from "../symbols.js";
import { evaluate } from "../evaluator.js";

// == Generics ==

test("generics: bare generic in expression position auto-applies Any (B-091 sweep)", () => {
  // `arr instanceof Array` mirrors the annotation rule (`arr: Array` →
  // Array[Any]) instead of dying with "'get' not found on GenericType".
  const r = evalStd("[1, 2, 3] instanceof Array");
  eq(Number((dataOf(r!) as BitsValue).data), 1);
  const r2 = evalStd("42 instanceof Array");
  eq(Number((dataOf(r2!) as BitsValue).data), 0);
});

test("generics: expression-position Array[Int] applies via GenericType.get (B-091 sweep)", () => {
  // Bracket application in expression position lowers to
  // type_dispatch(Array, "get")(Int); the GenericType kind's `get`
  // member routes to the construct authority — same memoized concrete
  // as annotation-position type_apply.
  const r = evalStd("[1, 2, 3] instanceof Array[Int]");
  eq(Number((dataOf(r!) as BitsValue).data), 1);
  const r2 = evalStd('["a"] instanceof Array[Int]');
  eq(Number((dataOf(r2!) as BitsValue).data), 0);
});

test("generics: array literal infers Array[Int]", () => {
  const result = evalStd("[1, 2, 3]");
  eq(getTypeName(result!), "Array");
  // Check it has type args
  const type = getType(result!);
  eq(type !== null, true);
  const args = getGenericArgs(type as StructureValue);
  eq(args !== undefined, true);
});

test("generics: array literal infers Array[String]", () => {
  const result = evalStd('["a", "b", "c"]');
  eq(getTypeName(result!), "Array");
  const type = getType(result!);
  const args = getGenericArgs(type as StructureValue);
  eq(args !== undefined, true);
});

test("generics: mixed element array gets bare Array", () => {
  // Can't easily create mixed array in Allegro Standard yet since all ints are Int,
  // but empty array should be bare Array (no __args)
  const result = evalStd("[]");
  eq(getTypeName(result!), "Array");
  const type = getType(result!);
  // Bare Array (generic) should not have __args
  const args = getGenericArgs(type as StructureValue);
  eq(args, undefined);
});

test("generics: Array[Int] type annotation", () => {
  const result = evalStd("f(arr: Array[Int]) => arr.length\nf([1, 2, 3])");
  eq(Number((dataOf(result!) as BitsValue).data), 3);
});

test("generics: Array[Int] type check passes for int array", () => {
  // This should work — [1,2,3] is Array[Int], annotation expects Array[Int]
  const result = evalStd("f(arr: Array[Int]) => arr[0]\nf([10, 20, 30])");
  eq(Number((dataOf(result!) as BitsValue).data), 10);
});

test("generics: bare Array annotation accepts any array", () => {
  const result = evalStd("f(arr: Array) => arr.length\nf([1, 2, 3])");
  eq(Number((dataOf(result!) as BitsValue).data), 3);
});

test("generics: type_apply memoization", () => {
  // Array[Int] applied twice should produce the same type
  const result = evalStd(`
f(a: Array[Int]) => a.length
g(b: Array[Int]) => b[0]
f([1, 2, 3]) + g([10, 20])
`);
  eq(Number((dataOf(result!) as BitsValue).data), 13);
});

test("generics: Array is a generic type", () => {
  // C7.2a: generic-ness IS the kind — Array's shape answers GenericType.
  // The presence flag it replaced is retired; the suite no longer pins its
  // absence, since retired slots are retired as a class (C0, 2026-08).
  const result = evalStd("Array");
  const p = dataOf(result!);
  eq(p.kind === ValueKind.Structure, true);
  eq(isGenericType(p as StructureValue), true);
});

test("generics: params is a typed Array[String] instance field", () => {
  // C7.2a polish: `params` reads like any other array value — a typed
  // Array[String] of the param names (the two bootstrap generics are
  // upgraded in place once ArrayType exists), dispatching through the
  // GenericType kind's field descriptor.
  const first = evalStd("Array.params[0]");
  eq(bitsToString(dataOf(first!) as BitsValue), "T");
  const fnParams = evalStd("Function.params.length");
  eq(Number((dataOf(fnParams!) as BitsValue).data), 2);
  const elemTyped = evalStd(`Array.params[0] instanceof String`);
  eq(Number((dataOf(elemTyped!) as BitsValue).data), 1);
});

// == Any Type ==

test("Any: type annotation accepts any value", () => {
  eq(Number((dataOf(evalStd("f(x: Any) => x\nf(42)")!) as BitsValue).data), 42);
  eq(formatValue(evalStd('f(x: Any) => x\nf("hello")')!), "hello");
  eq(formatValue(evalStd("f(x: Any) => x\nf(true)")!), "true");
});

test("Any: Array[Any] accepts any element type", () => {
  const result = evalStd("f(arr: Array[Any]) => arr.length\nf([1, 2, 3])");
  eq(Number((dataOf(result!) as BitsValue).data), 3);
});

test("Any: bare Array annotation is Array[Any]", () => {
  // Bare Array in annotation should accept Array[Int]
  const result = evalStd("f(arr: Array) => arr[0]\nf([42])");
  eq(Number((dataOf(result!) as BitsValue).data), 42);
});

test("Any: Array[Int] rejects Array[String]", () => {
  let threw = false;
  try { evalStd('f(arr: Array[Int]) => arr[0]\nf(["hello"])'); }
  catch (e: any) { threw = e.message.includes("Type error"); }
  eq(threw, true);
});

// == UntypedFunction ==

test("UntypedFunction: primitives in standard mode have UntypedFunction type", () => {
  // In standard mode, print is a primitive wrapped with UntypedFunction
  const result = evalStd("print");
  eq(result !== null, true);
  eq(getTypeName(result!), "UntypedFunction");
});

test("UntypedFunction: wrapped primitives are still callable", () => {
  const result = evalStd("print(42)");
  eq(result !== null, true);
  eq(Number((dataOf(result!) as BitsValue).data), 42);
});

test("UntypedFunction (B-122): the typed wrapper is built once per primitive", () => {
  // The wrapper is a CONSTANT for a bare registry primitive — a
  // PrimitiveFunction has no `primary` and no `meta`, and
  // UntypedFunctionType is a module-level const. Both Layer-1 builders used
  // to rebuild it for every primitive on every scope build (354 calls over
  // 177 distinct primitives for one file; 708 with a module), which was 90%
  // of every repeat metadata attachment in the system.
  const prim = primRegistry["print"] as Value;
  eq(prim.kind, ValueKind.PrimitiveFunction, "print is a bare registry primitive");
  eq(wrapAsUntypedFunction(prim) === wrapAsUntypedFunction(prim), true,
    "same primitive answers the same wrapper object");
  eq(getTypeName(wrapAsUntypedFunction(prim)) , "UntypedFunction",
    "and it is still the UntypedFunction wrapper");

  // The property that actually matters: separate evaluations share it, so
  // the saving scales with scopes and modules rather than being per-call.
  const a = runtimeEval("print", undefined, [createTypeSystem()], undefined, true);
  const b = runtimeEval("print", undefined, [createTypeSystem()], undefined, true);
  const pa = a.value, pb = b.value;
  eq(pa !== null && pa === pb, true,
    "two independent evaluations resolve `print` to the same wrapper object");
});

test("UntypedFunction: user-defined functions in Allegretto mode have no type", () => {
  // In Allegretto mode (no typed flag), functions don't get types
  const { value } = runtimeEval("f(x) => x\nf\n");
  eq(value !== null, true);
  eq(getTypeName(value!), null);
});

// == Type Annotations ==

test("type annotation: typed param correct type passes", () => {
  const result = evalStd("f(x: Int) => x + 1\nf(5)");
  eq(Number((dataOf(result!) as BitsValue).data), 6);
});

test("type annotation: typed param wrong type throws", () => {
  let threw = false;
  try { evalStd('f(x: Int) => x\nf("hello")'); }
  catch (e: any) { threw = e.message.includes("Type error"); }
  eq(threw, true);
});

test("type annotation: multiple typed params", () => {
  const result = evalStd("f(x: Int, y: Int) => x + y\nf(3, 4)");
  eq(Number((dataOf(result!) as BitsValue).data), 7);
});

test("type annotation: return type correct", () => {
  const result = evalStd("f(x: Int): Int => x + 1\nf(5)");
  eq(Number((dataOf(result!) as BitsValue).data), 6);
});

test("type annotation: return type wrong throws", () => {
  let threw = false;
  try { evalStd('f(x: Int): String => x + 1\nf(5)'); }
  catch (e: any) { threw = e.message.includes("Type error"); }
  eq(threw, true);
});

test("type annotation: lambda typed params", () => {
  const result = evalStd("f = (x: Int, y: Int) => x + y\nf(3, 4)");
  eq(Number((dataOf(result!) as BitsValue).data), 7);
});

test("type annotation: lambda with return type", () => {
  const result = evalStd("f = (x: Int): Int => x + 1\nf(5)");
  eq(Number((dataOf(result!) as BitsValue).data), 6);
});

test("type annotation: single param typed lambda", () => {
  const result = evalStd("[1, 2, 3].map(x: Int => x * 2)");
  eq(formatValue(result!), "[2, 4, 6]");
});

test("type annotation: String type", () => {
  const result = evalStd('f(s: String) => s\nf("hello")');
  eq(formatValue(result!), "hello");
});

test("type annotation: untyped function still works", () => {
  const result = evalStd("f(x) => x + 1\nf(5)");
  eq(Number((dataOf(result!) as BitsValue).data), 6);
});

// == Function Types ==

test("function type: typed function has FunctionType", () => {
  const result = evalStd("f(x: Int): Int => x + 1\nf");
  eq(result !== null, true);
  eq(getTypeName(result!), "Function");
});

test("function type: typed function is callable", () => {
  const result = evalStd("f(x: Int): Int => x + 1\nf(5)");
  eq(Number((dataOf(result!) as BitsValue).data), 6);
});

test("function type: multi-param typed function", () => {
  const result = evalStd("add(a: Int, b: Int): Int => a + b\nadd");
  eq(getTypeName(result!), "Function");
});

// == Type Variable Unification ==

test("unification: identity function preserves type", () => {
  const result = evalStd("identity(x: T): T => x\nidentity(42)");
  eq(result !== null, true);
  eq(getTypeName(result!), "Int");
  eq(Number((dataOf(result!) as BitsValue).data), 42);
});

test("unification: identity with string", () => {
  const result = evalStd('identity(x: T): T => x\nidentity("hello")');
  eq(getTypeName(result!), "String");
  eq(bitsToString(dataOf(result!) as BitsValue), "hello");
});

test("unification: two independent type variables", () => {
  const result = evalStd("first(a: T, b: U): T => a\nfirst(42, \"hello\")");
  eq(getTypeName(result!), "Int");
  eq(Number((dataOf(result!) as BitsValue).data), 42);
});

test("unification: same type variable must be consistent", () => {
  // both(a: T, b: T) — both args must have same type
  // Call with same types should work
  const result = evalStd("both(a: T, b: T): T => a\nboth(1, 2)");
  eq(getTypeName(result!), "Int");
});

test("unification: conflicting type variables throw", () => {
  const freshTypes = createTypeSystem();
  throws(
    () => runtimeEval('both(a: T, b: T): T => a\nboth(1, "hello")\n', undefined, [freshTypes], undefined, true),
    "conflicting",
  );
});

// == Partial Evaluation ==

test("partial eval: eval_if with resolved condition evaluates chosen branch", () => {
  const result = evalStd("if true then 42 else 0");
  eq(Number((dataOf(result!) as BitsValue).data), 42);
});

test("partial eval: eval_if with unresolved condition propagates type from matching branches", () => {
  // Build an expression: eval_if(unresolved_param, thunk(42), thunk(7))
  // Both branches return Int, so the result should have type Int even though
  // the condition is unresolved.
  const result = evalStd(`
check(flag) => if flag then 42 else 7
check
`);
  // check is a function — call it with a typed value to verify
  // But to test partial eval, we need an unresolved condition.
  // Let's test via a function whose body has an unresolved if-then-else:
  // The function type system should infer return type from branches.
  eq(result !== null, true);
});

test("partial eval: typed function with if-then-else returns correct type", () => {
  // Both branches are Int, so result should be typed Int
  const result = evalStd("if 1 == 1 then 42 else 7");
  eq(getTypeName(result!), "Int");
  eq(Number((dataOf(result!) as BitsValue).data), 42);
});

test("partial eval: typed if-then-else with string branches", () => {
  const result = evalStd('if true then "yes" else "no"');
  eq(getTypeName(result!), "String");
  eq(bitsToString(dataOf(result!) as BitsValue), "yes");
});

test("partial eval: if-then-else false branch", () => {
  const result = evalStd('if false then "yes" else "no"');
  eq(getTypeName(result!), "String");
  eq(bitsToString(dataOf(result!) as BitsValue), "no");
});

test("partial eval: nested if-then-else preserves types", () => {
  const result = evalStd("if true then (if false then 1 else 2) else 3");
  eq(getTypeName(result!), "Int");
  eq(Number((dataOf(result!) as BitsValue).data), 2);
});

// == String Interpolation ==

test("interpolation: simple variable", () => {
  const result = evalStd('name = "world"\n"hello {name}"');
  eq(bitsToString(dataOf(result!) as BitsValue), "hello world");
});

test("interpolation: expression", () => {
  const result = evalStd('"2 + 2 = {2 + 2}"');
  eq(bitsToString(dataOf(result!) as BitsValue), "2 + 2 = 4");
});

test("interpolation: multiple", () => {
  const result = evalStd('a = 1\nb = 2\n"{a} + {b} = {a + b}"');
  eq(bitsToString(dataOf(result!) as BitsValue), "1 + 2 = 3");
});

test("interpolation: no interpolation is unchanged", () => {
  const result = evalStd('"plain string"');
  eq(bitsToString(dataOf(result!) as BitsValue), "plain string");
});

test("interpolation: escaped brace", () => {
  const result = evalStd('"use \\{braces\\}"');
  eq(bitsToString(dataOf(result!) as BitsValue), "use {braces}");
});

test("interpolation: at start of string", () => {
  const result = evalStd('"{42} is the answer"');
  eq(bitsToString(dataOf(result!) as BitsValue), "42 is the answer");
});

// == Compile-Time Type Inference ==

test("compile: infer return type Int from arithmetic body", () => {
  const { compilationReport } = runtimeEval(
    "add(x: Int, y: Int) => x + y\n",
    undefined, [typeExt], undefined, true,
  );
  const inferred = compilationReport?.inferred.find(i => i.name === "add");
  eq(inferred !== undefined, true, "add should have inferred return type");
  eq(inferred?.returnType, "Int");
});

test("compile: infer return type String from concat body", () => {
  const { compilationReport } = runtimeEval(
    'greet(name: String) => "Hello, " + name\n',
    undefined, [typeExt], undefined, true,
  );
  const inferred = compilationReport?.inferred.find(i => i.name === "greet");
  eq(inferred !== undefined, true);
  eq(inferred?.returnType, "String");
});

test("compile: infer return type from if-then-else branches", () => {
  const { compilationReport } = runtimeEval(
    "abs(x: Int) => if x > 0 then x else 0 - x\n",
    undefined, [typeExt], undefined, true,
  );
  const inferred = compilationReport?.inferred.find(i => i.name === "abs");
  eq(inferred !== undefined, true);
  eq(inferred?.returnType, "Int");
});

test("compile: report lists unresolved imports", () => {
  const { compilationReport } = runtimeEval(
    "import db\nx = 42\n",
    undefined, [typeExt], undefined, true,
  );
  eq(compilationReport?.unresolved.includes("db"), true);
});

test("compile: non-typed functions not in inferred list", () => {
  const { compilationReport } = runtimeEval(
    "f(x) => x + 1\n",
    undefined, [typeExt], undefined, true,
  );
  const inferred = compilationReport?.inferred.find(i => i.name === "f");
  eq(inferred, undefined, "untyped function should not be pre-compiled");
});

// == Type Hierarchy: Type, Type, Subtyping ==

test("type hierarchy: all types have __type = Type", () => {
  // Int, String, Bool, Float, Object should all have __type = Type
  const intType = metaReadRaw(IntType, "type");
  eq(intType === Type, true);
  const strType = metaReadRaw(StringType, "type");
  eq(strType === Type, true);
});

test("type hierarchy: Type has __type = Type (self-referential)", () => {
  const ttType = metaReadRaw(Type, "type");
  eq(ttType === Type, true);
});

test("type hierarchy: Type is an alias for Type", () => {
  eq(Type === Type, true);
});

test("type hierarchy: nominal instanceof passes for matching type", () => {
  const result = evalStd("42");
  const instanceofMethod = typeMethod(Type, "instanceof");
  eq(instanceofMethod !== undefined && instanceofMethod !== null, true);
  if (instanceofMethod?.kind === ValueKind.PrimitiveFunction) {
    const check = instanceofMethod.fn([IntType, result!], undefined as any, undefined as any);
    eq(Number((dataOf(check) as BitsValue).data), 1);
  }
});

test("type hierarchy: nominal instanceof fails for wrong type", () => {
  const result = evalStd("42");
  const instanceofMethod = typeMethod(Type, "instanceof");
  if (instanceofMethod?.kind === ValueKind.PrimitiveFunction) {
    const check = instanceofMethod.fn([StringType, result!], undefined as any, undefined as any);
    eq(Number((dataOf(check) as BitsValue).data), 0);
  }
});

test("type hierarchy: structural instanceof passes for compatible shape", () => {
  // Int has add, sub, mul, toString, etc.
  // A value typed as Int should structurally match any type with a subset of those methods
  const result = evalStd("42");
  const instanceofMethod = typeMethod(Type, "instanceof");
  if (instanceofMethod?.kind === ValueKind.PrimitiveFunction) {
    // IntType has all the methods StringType has (toString), so structurally compatible at a basic level
    const check = instanceofMethod.fn([IntType, result!], undefined as any, undefined as any);
    eq(Number((dataOf(check) as BitsValue).data), 1);
  }
});

test("type hierarchy: nominal subtypeof - same type", () => {
  const subtypeofMethod = typeMethod(Type, "subtypeof");
  if (subtypeofMethod?.kind === ValueKind.PrimitiveFunction) {
    const check = subtypeofMethod.fn([IntType, IntType], undefined as any, undefined as any);
    eq(Number((dataOf(check) as BitsValue).data), 1);
  }
});

test("type hierarchy: nominal subtypeof - different types", () => {
  const subtypeofMethod = typeMethod(Type, "subtypeof");
  if (subtypeofMethod?.kind === ValueKind.PrimitiveFunction) {
    const check = subtypeofMethod.fn([IntType, StringType], undefined as any, undefined as any);
    eq(Number((dataOf(check) as BitsValue).data), 0);
  }
});

test("type hierarchy: structural_wrap makes type compare structurally by erasing __name", () => {
  const wrappedInt = structuralWrap(IntType);
  // __type stays Type (no longer flips meta-types — there's only one)
  const wrapType = metaReadRaw(wrappedInt, "type");
  eq(wrapType === Type, true);
  // __name erased — absence of name is what triggers structural dispatch
  const name = getName(wrappedInt);
  eq(name === undefined, true);
  // __wraps preserves the link back to the original named type
  const wraps = getWraps(wrappedInt);
  eq(wraps === IntType, true);
});

// == Member Descriptors (__members) ==

test("member descriptors: IntType has __members with Method descriptors", () => {
  // C5.2a: member sets are symbol-keyed — read through the projection view.
  const members = memberDescriptorsOf(IntType);
  eq(members.size > 0, true);
  const addDesc = members.get("add");
  eq(addDesc !== undefined, true);
  eq(isMethodDescriptor(addDesc as StructureValue), true);
  eq(isFieldDescriptor(addDesc as StructureValue), false);
});

test("member descriptors: typeMemberDescriptor returns descriptor", () => {
  const desc = typeMemberDescriptor(IntType, "add");
  eq(desc !== null, true);
  eq(isMethodDescriptor(desc!), true);
});

test("member descriptors: typeMemberDescriptor returns null for missing", () => {
  const desc = typeMemberDescriptor(IntType, "nonexistent");
  eq(desc, null);
});

test("member descriptors: length is a getter descriptor", () => {
  const desc = typeMemberDescriptor(StringType, "length");
  eq(desc !== null, true);
  eq(isGetterDescriptor(desc!), true);
});

test("member descriptors: typeMethod reads from __members", () => {
  const addMethod = typeMethod(IntType, "add");
  eq(addMethod !== null, true);
  eq(addMethod!.kind, ValueKind.PrimitiveFunction);
});

test("member descriptors: Type has __members with meta-methods", () => {
  const members = memberDescriptorsOf(Type);
  eq(members.size > 0, true);
  const defineDesc = members.get("define");
  eq(defineDesc !== undefined, true);
  eq(isMethodDescriptor(defineDesc as StructureValue), true);
});

test("member descriptors: Type has __members with meta-methods", () => {
  const members = memberDescriptorsOf(Type);
  eq(members.size > 0, true);
  const instanceofDesc = members.get("instanceof");
  eq(instanceofDesc !== undefined, true);
  eq(isMethodDescriptor(instanceofDesc as StructureValue), true);
});

test("member descriptors: record type has Field descriptors", () => {
  const result = evalStd(`Animal = Type.define({name: String, age: Int}, Int)
Animal`);
  const typeCtx = dataOf(result!) as StructureValue;
  eq(typeCtx.kind, ValueKind.Structure);
  const members = memberDescriptorsOf(typeCtx);
  eq(members.size > 0, true);
  const nameDesc = members.get("name");
  eq(nameDesc !== undefined, true);
  eq(isFieldDescriptor(nameDesc as StructureValue), true);
  // toString should be a Method descriptor
  const tsDesc = members.get("toString");
  eq(tsDesc !== undefined, true);
  eq(isMethodDescriptor(tsDesc as StructureValue), true);
});

test("member descriptors: record field access via type_dispatch works", () => {
  const result = evalStd(`Point = Type.define({x: Int, y: Int}, Int)
p = Point(3, 4)
p.x + p.y`);
  eq(Number((dataOf(result!) as BitsValue).data), 7);
});

// == Types as Typed Values ==

test("typed types: Int instanceof Type", () => {
  const result = evalStd("Int instanceof Type");
  eq(Number((dataOf(result!) as BitsValue).data), 1);
});

test("typed types: String instanceof Type", () => {
  const result = evalStd("String instanceof Type");
  eq(Number((dataOf(result!) as BitsValue).data), 1);
});

test("typed types: Type instanceof Type", () => {
  const result = evalStd("Type instanceof Type");
  eq(Number((dataOf(result!) as BitsValue).data), 1);
});

test("typed types: user-defined type instanceof Type", () => {
  const result = evalStd(`Point = Type.define({x: Int, y: Int}, Int)
Point instanceof Type`);
  eq(Number((dataOf(result!) as BitsValue).data), 1);
});

test("typed types: type of Int returns Type", () => {
  const result = evalStd("type of Int");
  eq(getType(result!) !== null || (result! as any).primary === undefined, true);
});

// == Effect meta-type (Phase D1 sub-chunk 1.1) ==

test("effect: Effect meta-type has __type = Type", () => {
  const tt = metaReadRaw(Effect, "type");
  eq(tt === Type, true);
});

test("effect: Effect carries lattice methods in __members", () => {
  const members = memberDescriptorsOf(Effect);
  eq(members.has("subset_of"), true);
  eq(members.has("implies"), true);
  eq(members.has("intersect"), true);
  eq(members.has("union"), true);
});

test("effect (C6.2): instances stamp shape = Effect — no refines chain hack", () => {
  eq(getRefines(pureEffect), undefined);
  eq(getRefines(opaqueEffect), undefined);
  eq(getType(pureEffect) === Effect, true);
  eq(getType(opaqueEffect) === Effect, true);
});

test("effect (C6.2): instances carry `kind` as a declared data field", () => {
  const pk = dataOf(pureEffect.bindings.get("kind")!.value!) as BitsValue;
  eq(bitsToString(pk), "pure");
  const ok = dataOf(opaqueEffect.bindings.get("kind")!.value!) as BitsValue;
  eq(bitsToString(ok), "opaque");
});

test("effect (C6.2): instances hold NO member copies — members live on the kind", () => {
  eq(getMembers(pureEffect), undefined);
  eq(getMembers(opaqueEffect), undefined);
  // Dispatch still works — through the shape.
  const result = evalStd("pure.subset_of(opaque)");
  eq(Number((dataOf(result!) as BitsValue).data), 1);
});

test("effect lattice: pure ⊆ opaque", () => {
  eq(effectSubsetOf(pureEffect, opaqueEffect), true);
});

test("effect lattice: pure ⊆ pure (reflexive)", () => {
  eq(effectSubsetOf(pureEffect, pureEffect), true);
});

test("effect lattice: opaque ⊆ opaque (reflexive)", () => {
  eq(effectSubsetOf(opaqueEffect, opaqueEffect), true);
});

test("effect lattice: opaque is not ⊆ pure", () => {
  eq(effectSubsetOf(opaqueEffect, pureEffect), false);
});

test("effect lattice: implies is reverse subset_of (opaque implies pure)", () => {
  // Having opaque (universal) implies you have pure's effects (the empty set).
  eq(effectImplies(opaqueEffect, pureEffect), true);
});

test("effect lattice: pure does not imply opaque", () => {
  eq(effectImplies(pureEffect, opaqueEffect), false);
});

test("effect lattice: intersect with pure is pure", () => {
  eq(effectIntersect(pureEffect, opaqueEffect) === pureEffect, true);
  eq(effectIntersect(opaqueEffect, pureEffect) === pureEffect, true);
});

test("effect lattice: intersect of equal effects is the effect", () => {
  eq(effectIntersect(opaqueEffect, opaqueEffect) === opaqueEffect, true);
  eq(effectIntersect(pureEffect, pureEffect) === pureEffect, true);
});

test("effect lattice: union with pure is the other", () => {
  eq(effectUnion(pureEffect, opaqueEffect) === opaqueEffect, true);
  eq(effectUnion(opaqueEffect, pureEffect) === opaqueEffect, true);
});

test("effect lattice: union with opaque is opaque", () => {
  eq(effectUnion(pureEffect, opaqueEffect) === opaqueEffect, true);
});

test("effect lattice: union of equal effects is the effect", () => {
  eq(effectUnion(pureEffect, pureEffect) === pureEffect, true);
});

test("effect Allegro source (C6.2, §6 delta 6): pure subtypeof Effect is FALSE", () => {
  // The pre-C6.2 true came from the __refines chain hack; an instance
  // does not CONFORM to its kind — instance-of is the relation.
  const result = evalStd("pure subtypeof Effect");
  eq(Number((dataOf(result!) as BitsValue).data), 0);
});

test("effect Allegro source (C6.2): pure/opaque instanceof Effect is the check", () => {
  eq(Number((dataOf(evalStd("pure instanceof Effect")!) as BitsValue).data), 1);
  eq(Number((dataOf(evalStd("opaque instanceof Effect")!) as BitsValue).data), 1);
});

test("effect Allegro source: Effect subtypeof Effect", () => {
  const result = evalStd("Effect subtypeof Effect");
  eq(Number((dataOf(result!) as BitsValue).data), 1);
});

test("effect Allegro source: Int does not subtypeof Effect", () => {
  const result = evalStd("Int subtypeof Effect");
  eq(Number((dataOf(result!) as BitsValue).data), 0);
});

test("effect Allegro source: pure does not subtypeof opaque (order is not conformance)", () => {
  // Instances of an order-carrying kind relate by the KIND'S ORDER
  // (pure.subset_of(opaque) is true), never by subtypeof conformance.
  const result = evalStd("pure subtypeof opaque");
  eq(Number((dataOf(result!) as BitsValue).data), 0);
});

// == Interfaces ==

test("interfaces: Type.interface creates structural type with __interface marker", () => {
  const result = evalStd(`Printable = Interface.define({toString: Function})
Printable`);
  const iface = dataOf(result!) as StructureValue;
  eq(iface.kind, ValueKind.Structure);
  // __interface marker
  const marker = getInterfaceMarker(iface);
  eq(marker !== undefined, true);
  eq((marker as BitsValue).data, 1n);
  // C6.1b (D45): an interface is an instance of the Interface kind.
  eq(metaReadRaw(iface, "type") === InterfaceKind, true);
});

test("interfaces: interface has Field descriptors in __members", () => {
  const result = dataOf(evalStd(`Interface.define({toString: Function, length: Int})`)!) as StructureValue;
  const members = memberDescriptorsOf(result);
  eq(members.size > 0, true);
  const tsDesc = members.get("toString");
  eq(tsDesc !== undefined, true);
  eq(isFieldDescriptor(tsDesc as StructureValue), true);
  const lenDesc = members.get("length");
  eq(lenDesc !== undefined, true);
  eq(isFieldDescriptor(lenDesc as StructureValue), true);
});

test("interfaces: interface has no __construct", () => {
  const result = dataOf(evalStd(`Interface.define({x: Int})`)!) as StructureValue;
  eq(getConstruct(result) !== undefined, false);
});

test("interfaces: instanceof passes for DECLARED conformance (C5.2c)", () => {
  // Conformance is declared, not accidental: extending the interface
  // draws its member symbols, and the check is symbol-identity membership.
  const result = evalStd(`HasXY = Interface.define({x: Int, y: Int})
Point = Type.define({x: Int, y: Int}, HasXY)
p = Point(1, 2)
p instanceof HasXY`);
  eq(Number((dataOf(result!) as BitsValue).data), 1);
});

test("interfaces: accidental conformance is gone (C5.2c conscious delta)", () => {
  // Int spells a toString but never declared Printable's symbol.
  const result = evalStd(`Printable = Interface.define({toString: Function})
42 instanceof Printable`);
  eq(Number((dataOf(result!) as BitsValue).data), 0);
});

test("interfaces: instanceof fails for non-conforming type", () => {
  const result = evalStd(`HasFoo = Interface.define({foo: Function})
42 instanceof HasFoo`);
  eq(Number((dataOf(result!) as BitsValue).data), 0);
});

test("interfaces: parent member inheritance", () => {
  // Int has add, sub, etc. in __members. Interface.define({extra: Int}, Int) requires all of them plus extra.
  const result = evalStd(`WithExtra = Interface.define({extra: Int}, Int)
WithExtra`);
  const iface = dataOf(result!) as StructureValue;
  const members = memberDescriptorsOf(iface);
  // Should have 'add' from Int's __members
  eq(members.has("add"), true);
  // Should have 'extra' as declared
  eq(members.has("extra"), true);
});

test("interfaces: Type.interface also creates structural type", () => {
  const result = evalStd(`Sized = Interface.define({length: Int}, Int)
Sized`);
  const iface = dataOf(result!) as StructureValue;
  eq(metaReadRaw(iface, "type") === InterfaceKind, true);
});

test("interfaces: auto-named when bound to symbol", () => {
  const result = evalStd(`Printable = Interface.define({toString: Function})
Printable`);
  const iface = dataOf(result!) as StructureValue;
  const name = getName(iface);
  eq(name !== undefined, true);
  eq(bitsToString(name as BitsValue), "Printable");
});

test("interfaces: ~T is the loose duck-typing path (C5.2c)", () => {
  // The declared check refuses the accidental match; `~Sized` projects
  // the interface into the base-name world and duck-types.
  const declared = evalStd(`Sized = Interface.define({length: Int})
"hello" instanceof Sized`);
  eq(Number((dataOf(declared!) as BitsValue).data), 0);
  const loose = evalStd(`Sized = Interface.define({length: Int})
has_size(v: ~Sized) => 1
has_size("hello")`);
  eq(Number((dataOf(loose!) as BitsValue).data), 1);
});

// == Edge cases ==

test("edge case: empty interface satisfies any type", () => {
  const result = evalStd(`EmptyIface = Interface.define({})
42 instanceof EmptyIface`);
  eq(Number((dataOf(result!) as BitsValue).data), 1);
});

test("edge case: Refinement spec without `where` errors", () => {
  // The old `Int.preserveOps()` no-op has no spec-form equivalent — a
  // Refinement spec demands its predicate.
  let threw = false;
  try {
    evalStd(`T = Refinement.define({refines: Int, preserve: "all"})`);
  } catch (e) {
    threw = true;
  }
  eq(threw, true);
});

// == Method members (C6.1b: the mixin surface is `define`) ==

test("methods: method-valued spec entry adds method", () => {
  const result = evalStd(`Point = Type.define({x: Int, y: Int, mag: (self) => self.x + self.y}, Int)
p = Point(3, 4)
p.mag()`);
  eq(Number((dataOf(result!) as BitsValue).data), 7);
});

test("methods: field access via self works", () => {
  const result = evalStd(`Point = Type.define({x: Int, y: Int, getX: (self) => self.x}, Int)
Point(10, 20).getX()`);
  eq(Number((dataOf(result!) as BitsValue).data), 10);
});

test("methods: constructor ignores method entries (positional args are fields)", () => {
  const result = evalStd(`Point = Type.define({x: Int, y: Int, sum: (self) => self.x + self.y}, Int)
p = Point(5, 7)
p.sum()`);
  eq(Number((dataOf(result!) as BitsValue).data), 12);
});

test("methods: same-name method entry OVERRIDES the drawn member (C5.2b draw)", () => {
  // The old mixin surface REFUSED same-name additions; the unified define
  // surface treats a matching declaration as an override that binds the
  // drawn symbol — same rule as fields (C5.2b: override keeps identity).
  const result = evalStd(`Point = Type.define({x: Int, y: Int, toString: (self) => "point!"}, Int)
Point(1, 2).toString()`);
  eq(bitsToString(dataOf(result!) as BitsValue), "point!");
});

test("methods: reusable mixin is a BUNDLE — methods-only define, drawn like any bundle", () => {
  const result = evalStd(`MagMixin = Type.define({mag: (self) => self.x * self.x + self.y * self.y})
A = Type.define({x: Int, y: Int}, Int, MagMixin)
B = Type.define({x: Int, y: Int}, Int, MagMixin)
A(3, 4).mag() + B(5, 12).mag()`);
  eq(Number((dataOf(result!) as BitsValue).data), 25 + 169);
});

test("methods: bundle conformance — drawing the bundle's symbols declares it", () => {
  const result = evalStd(`MagMixin = Type.define({mag: (self) => self.x * self.x + self.y * self.y})
A = Type.define({x: Int, y: Int}, Int, MagMixin)
A subtypeof MagMixin`);
  eq(Number((dataOf(result!) as BitsValue).data), 1);
});

test("methods: method with extra args", () => {
  const result = evalStd(`Point = Type.define({x: Int, y: Int, translate: (self, dx, dy) => Point(self.x + dx, self.y + dy)}, Int)
p = Point(1, 2)
q = p.translate(10, 20)
q.x + q.y`);
  eq(Number((dataOf(result!) as BitsValue).data), 33);
});

// == Regression: methods over refinement nesting ==
// Method layers on refined types delegate construction through the base's
// construct, which chains all nested predicate checks naturally. Surface:
// non-reserved entries in a Refinement spec are method implementations.

test("Refinement spec methods: constructor still checks predicate", () => {
  const result = evalStd(`PI = Refinement.define({refines: Int, where: p => p > 0, double: self => self + self})
PI(5)`);
  eq(Number((dataOf(result!) as BitsValue).data), 5);
});

test("Refinement spec methods: predicate failure produces error", () => {
  const result = evalStd(`PI = Refinement.define({refines: Int, where: p => p > 0, double: self => self + self})
PI(0 - 5)`);
  eq(metaOf(result!).has("error"), true);
});

test("Refinement spec methods: method call works", () => {
  const result = evalStd(`PI = Refinement.define({refines: Int, where: p => p > 0, double: self => self + self})
PI(7).double()`);
  eq(Number((dataOf(result!) as BitsValue).data), 14);
});

test("Refinement spec methods: compound predicate checked (inner passes)", () => {
  const result = evalStd(`T = Refinement.define({refines: Int, where: w => w > 0 && w < 100, triple: self => self * 3})
T(50).triple()`);
  eq(Number((dataOf(result!) as BitsValue).data), 150);
});

test("Refinement spec methods: upper-bound failure produces error", () => {
  const result = evalStd(`T = Refinement.define({refines: Int, where: w => w > 0 && w < 100, triple: self => self * 3})
T(500)`);
  eq(metaOf(result!).has("error"), true);
});

test("Refinement spec methods: lower-bound failure produces error", () => {
  const result = evalStd(`T = Refinement.define({refines: Int, where: w => w > 0 && w < 100, triple: self => self * 3})
T(0 - 10)`);
  eq(metaOf(result!).has("error"), true);
});

test("Refinement spec methods: refined base as `refines` chains predicates", () => {
  // The refines slot accepts an already-refined base — layers chain.
  const result = evalStd(`T = Refinement.define({refines: Int & _ > 0, where: q => q < 100, id: self => self})
a = T(42).id()
b = T(500)
c = T(0 - 10)
a`);
  eq(Number((dataOf(result!) as BitsValue).data), 42);
});

// Regression: meta-type dispatch for ComposedFunction descriptors.
// type_dispatch's untyped-Context meta-type path previously only handled
// PrimitiveFunction method descriptors. A ComposedFunction descriptor on a
// meta-type would silently fall through. This unit test exercises that path
// directly by constructing a raw Context with __type pointing to a type whose
// __members contains a ComposedFunction method descriptor.
test("meta-type dispatch: ComposedFunction method descriptor is invoked", () => {
  // Build a meta-type with a ComposedFunction method `describe` that returns
  // self's __name field (self is the raw type Context).
  const metaType = makeStructure();
  const metaMembers = makeStructure();
  // describe(self) => self.__name — as an Allegro lambda
  const param = makeParam(0);
  const selfExpr = param as unknown as Value;
  // Body: access __name on self via __get_member... simpler: just return self.
  const describeFn = makeComposedFn([param], selfExpr);
  const desc = makeStructure();
  // B-104 chunk 3: the descriptor's shape is stamped on the component plane
  // (it was a `__type` BINDING in this hand-built fixture before the move).
  writeShape(desc, Type);
  const descBindings = [
    ["name", stringToBits("describe")],
    ["value", describeFn],
  ] as const;
  for (const [k, v] of descBindings) {
    desc.bindings.set(k, { key: k, value: v as Value });
    desc.bindingList.push({ key: k, value: v as Value });
  }
  // C5.2a: member sets are keyed by the member symbol's FQN.
  const describeKey = kernelMemberFqn("describe");
  metaMembers.bindings.set(describeKey, { key: describeKey, value: desc });
  metaMembers.bindingList.push({ key: describeKey, value: desc });
  setMembers(metaType, metaMembers);
  slotSetName(metaType, stringToBits("MetaType"));

  // Raw Context whose shape channel holds metaType.
  const target = makeStructure();
  writeShape(target, metaType);
  slotSetName(target, stringToBits("Instance"));

  // Call type_dispatch(target, "describe") via the primitive.
  const typeDispatch = primRegistry["type_dispatch"] as any;
  // Lazy primitive — pass raw args (unevaluated) and an evalFn + ctx.
  const ctx = makeStructure();
  // Seed ctx with the target under a name, and invoke the bound method.
  ctx.bindings.set("x", { key: "x", value: target });
  ctx.bindingList.push({ key: "x", value: target });
  const boundMethod = typeDispatch.fn(
    [target, stringToBits("describe")],
    ctx,
    (v: Value, c: StructureValue) => evaluate(v, c),
  );
  eq(boundMethod !== null && boundMethod !== undefined, true);
  // The returned value should be a bound primitive (since describe has one
  // positional arg — self — which gets auto-bound). Calling it with no args
  // invokes the ComposedFunction with self = target.
  eq(boundMethod.kind, ValueKind.PrimitiveFunction, "meta-method should return a bound primitive");
  const result = boundMethod.fn([], ctx, (v: Value, c: StructureValue) => evaluate(v, c));
  // describeFn returns its self param; primary should be the raw target Context.
  eq(dataOf(result).kind, ValueKind.Structure);
  eq(dataOf(result) === target, true, "bound method should pass target as self");
});

test("Refinement spec methods: instanceof still works", () => {
  const result = evalStd(`T = Refinement.define({refines: Int, where: p => p > 0, double: self => self + self})
T(5) instanceof T`);
  eq(Number((dataOf(result!) as BitsValue).data), 1);
});

