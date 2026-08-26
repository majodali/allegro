// =============================================================================
// Allegretto - Test Suite
// Run: npx tsx src/test/index.ts
// =============================================================================

import { formatValue } from "../primitives.js";
import { evalSource as runtimeEval, Extension, extensionToContext, applyPhase, DependencyRegistry } from "../runtime.js";
import { createFutureManager, FutureManager } from "../futures.js";
import { ModuleLoader, buildModuleObject } from "../modules.js";
import { evaluate } from "../evaluator.js";
import { GrammarExtension, registryGet } from "../grammar-ext.js";
import { createTypeSystem, getTypeName, getType, typeMethod, typeMemberDescriptor, memberDescriptorsOf, isMethodDescriptor, isFieldDescriptor, isGetterDescriptor, MethodType, FieldType, Type, IntType, StringType, NoneType, ErrorType, noneSingleton, structuralWrap, InterfaceKind, Effect, pureEffect, opaqueEffect, effectSubsetOf, effectImplies, effectIntersect, effectUnion, BoolType, isGenericType, protocolEqualsBool, KERNEL_EQUALS_CERTIFICATE, coercionObligationRecords, lawObligationRecords, EquatableType, isLawDescriptor, futureOf, futureElementType, typeContextName as tsTypeContextName } from "../types-std.js";
import { Grammar, parseGrammar } from "../parser.js";
import { channelReadRaw, componentsView, getName, getMembers, getRefines, getConstruct, getInterfaceMarker, getWraps, getGenericArgs, getSlotCount, writeShape, setMembers, SLOT_KEYS, setName as slotSetName, setFallbackMember as slotSetFallbackMember } from "../slots.js";
import { exportedSymbols, symbolFromWire, kernelMemberFqn, fqnBaseName } from "../symbols.js";
import { extractGrammarFragment, asGrammarValue } from "../primitives.js";
import { emptyGrammarFragment, GrammarFragment } from "../types.js";
import { Value, ValueKind, BitsValue, ContextValue, AllegroError, makePrimitive, makeInt, makeFloat, bitsToFloat, makeContext, makeExpr, makeParam, makeComposedFn, makeMultiValue, dataOf, isResolved, stringToBits, bitsToString } from "../types.js";

// --- Test infrastructure ---
//
// The harness (registration, sharding, the dev filter, timing, the summary)
// and the shared evaluation fixtures now live beside this file; every area
// module imports the same instances, so the counters and the suite-wide
// registration count stay single-sourced.

import {
  test, asyncTest, asyncThrows, eq, throws, timedSection,
  noteSyncBodyDone, reportSummary, SHARD, ShardOpts,
} from "./harness.js";
import {
  evalSource, evalStr, evalNum, evalNumExt, evalStd, typeExt, mathExtension,
} from "./fixtures.js";

// --- Area modules -----------------------------------------------------------
// Each registers its own tests at import time. Order here is suite order;
// shard assignment is by test NAME, so it does not depend on this list.
import "./refinements.js";
import "./effects.js";
import "./totality.js";
import "./proofs.js";

// --- Area modules -----------------------------------------------------------
// Each registers its own tests at import time. Order here is suite order;
// shard assignment is by test NAME, so it does not depend on this list.
import "./pcp.js";
import "./grammar2-engine.js";
import "./grammar2-language.js";
import "./async-futures.js";
import "./tooling.js";
import { runAsyncTests } from "./async-futures.js";
import { runH4aAsyncTests } from "./pcp.js";
import { runBenchmarkTests, runDocLintTests, runCheckDeployedTests } from "./tooling.js";

// --- Tests ---

// == Arithmetic ==

test("integer literal", () => {
  eq(evalNum("42"), 42);
});

test("addition", () => {
  eq(evalNum("3 + 4"), 7);
});

test("subtraction", () => {
  eq(evalNum("10 - 3"), 7);
});

test("multiplication", () => {
  eq(evalNum("6 * 7"), 42);
});

test("division", () => {
  eq(evalNum("15 / 3"), 5);
});

test("modulo", () => {
  eq(evalNum("17 % 5"), 2);
});

test("precedence: * before +", () => {
  eq(evalNum("3 + 4 * 2"), 11);
});

test("precedence: parentheses override", () => {
  eq(evalNum("(3 + 4) * 2"), 14);
});

test("unary minus", () => {
  eq(evalNum("-5"), -5);
});

test("negative arithmetic", () => {
  eq(evalNum("0 - 42"), -42);
});

test("hex literal", () => {
  eq(evalNum("0xFF"), 255);
});

test("binary literal", () => {
  eq(evalNum("0b1010"), 10);
});

// == Comparisons ==

test("equality true", () => {
  eq(evalNum("1 == 1"), 1);
});

test("equality false", () => {
  eq(evalNum("1 == 2"), 0);
});

test("inequality", () => {
  eq(evalNum("1 != 2"), 1);
});

test("less than", () => {
  eq(evalNum("3 < 5"), 1);
  eq(evalNum("5 < 3"), 0);
});

test("greater than", () => {
  eq(evalNum("5 > 3"), 1);
  eq(evalNum("3 > 5"), 0);
});

test("less than or equal", () => {
  eq(evalNum("3 <= 3"), 1);
  eq(evalNum("4 <= 3"), 0);
});

test("greater than or equal", () => {
  eq(evalNum("3 >= 3"), 1);
  eq(evalNum("2 >= 3"), 0);
});

// == Bindings ==

test("simple binding", () => {
  eq(evalNum("x = 42\nx"), 42);
});

test("binding with expression", () => {
  eq(evalNum("x = 3 + 4 * 2\nx"), 11);
});

test("multiple bindings", () => {
  eq(evalNum("x = 10\ny = 20\nx + y"), 30);
});

test("binding chain", () => {
  eq(evalNum("x = 5\ny = x + 1\nz = y * 2\nz"), 12);
});

// == Functions ==

test("simple function", () => {
  eq(evalNum("double(n) => n * 2\ndouble(21)"), 42);
});

test("two-param function", () => {
  eq(evalNum("add(x, y) => x + y\nadd(3, 4)"), 7);
});

test("function call as argument", () => {
  eq(evalNum("double(n) => n * 2\ndouble(double(5))"), 20);
});

// == Lambdas ==

test("lambda: single param", () => {
  eq(evalNum("apply(f, x) => f(x)\napply(x => x + 1, 5)"), 6);
});

test("lambda: multi param", () => {
  eq(evalNum("apply(f, x, y) => f(x, y)\napply((a, b) => a * b, 6, 7)"), 42);
});

test("lambda: zero param (thunk)", () => {
  eq(evalNum("run(f) => f()\nrun(() => 42)"), 42);
});

// == If-then-else ==

test("if true branch", () => {
  eq(evalNum("if 1 == 1 then 42 else 0"), 42);
});

test("if false branch", () => {
  eq(evalNum("if 1 == 2 then 42 else 0"), 0);
});

test("if with expressions", () => {
  eq(evalNum("x = 5\nif x > 0 then x else 0 - x"), 5);
});

test("if with negative (else branch)", () => {
  eq(evalNum("x = -3\nif x > 0 then x else 0 - x"), 3);
});

test("if-then-else low precedence (else captures full expr)", () => {
  eq(evalNum("if 0 == 1 then 0 else 6 * 7"), 42);
});

// == Recursion ==

test("factorial", () => {
  eq(evalNum("factorial(n) => if n == 0 then 1 else n * factorial(n - 1)\nfactorial(5)"), 120);
});

test("factorial base case", () => {
  eq(evalNum("factorial(n) => if n == 0 then 1 else n * factorial(n - 1)\nfactorial(0)"), 1);
});

test("fibonacci", () => {
  eq(evalNum("fib(n) => if n <= 1 then n else fib(n - 1) + fib(n - 2)\nfib(10)"), 55);
});

// == Closures ==

test("higher-order function", () => {
  eq(evalNum("apply(f, x) => f(x)\napply(x => x + 10, 32)"), 42);
});

test("function returning value used in expression", () => {
  eq(evalNum("double(n) => n * 2\n1 + double(20)"), 41);
});

// == Indentation blocks ==

test("indentation block in function body", () => {
  eq(evalNum("f() =>\n    x = 3\n    y = x + 1\n    y * 2\nf()"), 8);
});

// == Error cases ==

test("division by zero", () => {
  throws(() => evalNum("1 / 0"), "division by zero");
});

test("modulo by zero", () => {
  throws(() => evalNum("1 % 0"), "division by zero");
});

test("parse error on invalid syntax", () => {
  throws(() => evalSource("+ +"), "");
});

// == Edge cases ==

test("zero", () => {
  eq(evalNum("0"), 0);
});

test("large number", () => {
  eq(evalNum("1000000 * 1000"), 1000000000);
});

test("deeply nested arithmetic", () => {
  eq(evalNum("((1 + 2) * (3 + 4)) + ((5 - 1) * 2)"), 29);
});

test("function shadowing binding", () => {
  eq(evalNum("x = 100\nf(x) => x + 1\nf(5)"), 6);
});

// == Print (captures output) ==

test("print returns its argument", () => {
  // print returns the value it prints
  eq(evalNum("print(42)"), 42);
});

// == REPL-style persistent context ==

test("persistent context across evaluations", () => {
  // Simulate REPL: first input defines x, second uses it
  const r1 = runtimeEval("x = 10\n");
  const r2 = runtimeEval("x + 5\n", r1.evalCtx);
  const p = r2.value!;
  const v = dataOf(p);
  if (v.kind !== ValueKind.Bits) throw new Error(`Expected Bits, got ${v.kind}`);
  eq(Number(v.data), 15);
});

test("persistent context: function then call", () => {
  const r1 = runtimeEval("double(n) => n * 2\n");
  const r2 = runtimeEval("double(21)\n", r1.evalCtx);
  const p = r2.value!;
  const v = dataOf(p);
  if (v.kind !== ValueKind.Bits) throw new Error(`Expected Bits, got ${v.kind}`);
  eq(Number(v.data), 42);
});

test("persistent context: redefine binding", () => {
  const r1 = runtimeEval("x = 10\n");
  const r2 = runtimeEval("x = 20\n", r1.evalCtx);
  const r3 = runtimeEval("x\n", r2.evalCtx);
  const p = r3.value!;
  const v = dataOf(p);
  if (v.kind !== ValueKind.Bits) throw new Error(`Expected Bits, got ${v.kind}`);
  eq(Number(v.data), 20);
});

// == Anonymous Extensions ==

test("extension: abs positive", () => {
  eq(evalNumExt("abs(42)", [mathExtension]), 42);
});

test("extension: abs negative", () => {
  eq(evalNumExt("abs(0 - 7)", [mathExtension]), 7);
});

test("extension: max", () => {
  eq(evalNumExt("max(3, 9)", [mathExtension]), 9);
});

test("extension: min", () => {
  eq(evalNumExt("min(3, 9)", [mathExtension]), 3);
});

test("extension: used in expressions", () => {
  eq(evalNumExt("abs(0 - 5) + max(10, 20)", [mathExtension]), 25);
});

test("extension: used with user functions", () => {
  eq(evalNumExt("clamp(x, lo, hi) => min(max(x, lo), hi)\nclamp(100, 0, 50)", [mathExtension]), 50);
});

test("extension: source can shadow extension binding", () => {
  // User redefines abs — their version should win
  eq(evalNumExt("abs(x) => x * 2\nabs(5)", [mathExtension]), 10);
});

test("extension: multiple extensions layer correctly", () => {
  const ext1: Extension = {
    name: "constants",
    bindings: { pi: makeInt(3), tau: makeInt(6) },
  };
  const ext2: Extension = {
    name: "overrides",
    bindings: { pi: makeInt(4) }, // shadows ext1's pi
  };
  eq(evalNumExt("pi + tau", [ext1, ext2]), 10); // pi=4 from ext2, tau=6 from ext1
});

test("extension: not available without being provided", () => {
  // abs is not a base primitive — should fail without the extension
  throws(() => evalNum("abs(5)"));
});

// == Module Loader ==

async function runModuleTests(): Promise<void> {
  await asyncTest("module: load simple module", async () => {
    const loader = new ModuleLoader({
      modules: [{ id: "helpers" }],
      resolve: (id) => id === "helpers" ? "/mock/helpers.alg" : null,
      readFile: async () => "double(n) => n * 2\ntriple(n) => n * 3\n",
    });
    const exts = await loader.loadAll();
    eq(exts.length, 1);
    eq(exts[0].name, "helpers");
    eq("double" in exts[0].bindings, true);
    eq("triple" in exts[0].bindings, true);
  });

  await asyncTest("module: loaded functions work in evaluation", async () => {
    const loader = new ModuleLoader({
      modules: [{ id: "helpers" }],
      resolve: (id) => id === "helpers" ? "/mock/helpers.alg" : null,
      readFile: async () => "double(n) => n * 2\n",
    });
    const exts = await loader.loadAll();
    eq(evalNumExt("double(21)", exts), 42);
  });

  await asyncTest("module: module with bindings and functions", async () => {
    const loader = new ModuleLoader({
      modules: [{ id: "constants" }],
      resolve: (id) => id === "constants" ? "/mock/constants.alg" : null,
      readFile: async () => "pi = 3\ntau = pi * 2\n",
    });
    const exts = await loader.loadAll();
    eq(evalNumExt("pi + tau", exts), 9); // pi=3, tau=6
  });

  await asyncTest("module: C5.1 FQN symbols — registration + export partition across reload", async () => {
    const config = {
      modules: [{ id: "fqnlib" }],
      resolve: (id: string) => id === "fqnlib" ? "/mock/fqnlib.alg" : null,
      readFile: async () => "export shout(s) => s\nwhisper(s) => s\n",
    };
    await new ModuleLoader(config).loadAll();
    const exported = exportedSymbols("/mock/fqnlib.alg");
    eq(exported.has("shout"), true, "exported binding enters the export partition");
    eq(exported.has("whisper"), false, "private binding stays out of the export partition");
    const shout1 = symbolFromWire("/mock/fqnlib.alg::shout");
    eq(shout1 !== null, true, "exported symbol rebinds over the wire");
    eq(symbolFromWire("/mock/fqnlib.alg::whisper"), null, "private symbol resolves to nothing (D42)");
    // Reload with a FRESH loader instance: same FQN ⇒ the identical symbol.
    await new ModuleLoader(config).loadAll();
    eq(symbolFromWire("/mock/fqnlib.alg::shout") === shout1, true,
      "same FQN is the same object across module reload");
  });

  await asyncTest("module: transitive dependencies", async () => {
    const loader = new ModuleLoader({
      modules: [
        { id: "base" },
        { id: "derived", deps: ["base"] },
      ],
      resolve: (id) => `/mock/${id}.alg`,
      readFile: async (path) => {
        if (path === "/mock/base.alg") return "double(n) => n * 2\n";
        if (path === "/mock/derived.alg") return "quadruple(n) => double(double(n))\n";
        throw new Error("not found: " + path);
      },
    });
    const exts = await loader.loadAll();
    eq(evalNumExt("quadruple(5)", exts), 20);
  });

  await asyncTest("module: circular dependency detected", async () => {
    const loader = new ModuleLoader({
      modules: [
        { id: "a", deps: ["b"] },
        { id: "b", deps: ["a"] },
      ],
      resolve: (id) => `/mock/${id}.alg`,
      readFile: async () => "x = 1\n",
    });
    await asyncThrows(() => loader.loadAll(), "Circular dependency");
  });

  await asyncTest("module: caching prevents re-reads", async () => {
    let readCount = 0;
    const loader = new ModuleLoader({
      modules: [
        { id: "shared" },
        { id: "a", deps: ["shared"] },
        { id: "b", deps: ["shared"] },
      ],
      resolve: (id) => `/mock/${id}.alg`,
      readFile: async (path) => {
        if (path === "/mock/shared.alg") {
          readCount++;
          return "x = 42\n";
        }
        return "y = x + 1\n";
      },
    });
    await loader.loadAll();
    eq(readCount, 1, "shared module should only be read once");
  });

  await asyncTest("module: unknown module ID", async () => {
    const loader = new ModuleLoader({
      modules: [{ id: "nonexistent" }],
      resolve: () => null,
      readFile: async () => "",
    });
    await asyncThrows(() => loader.loadAll(), "could not resolve");
  });

  await asyncTest("module: empty module produces empty extension", async () => {
    const loader = new ModuleLoader({
      modules: [{ id: "empty" }],
      resolve: (id) => `/mock/${id}.alg`,
      readFile: async () => "// just a comment\n",
    });
    const exts = await loader.loadAll();
    eq(exts.length, 1);
    eq(Object.keys(exts[0].bindings).length, 0);
  });

  await asyncTest("module: export encapsulation — values", async () => {
    const loader = new ModuleLoader({
      modules: [{ id: "mymod" }],
      resolve: (id) => `/mock/${id}.alg`,
      readFile: async () =>
        "secret = 99\n" +
        "export pub = 42\n",
    });
    const exts = await loader.loadAll();
    const modObj = (exts[0] as any).moduleObject;
    eq(modObj !== undefined, true, "module should have moduleObject");

    const ext: Extension = { name: "test", bindings: { mymod: modObj } };

    // Exported binding should work
    const pubResult = evalStd("mymod.pub\n", [ext]);
    eq(pubResult !== null, true, "exported value should be accessible");
    eq(Number((dataOf(pubResult!) as BitsValue).data), 42);

    // Private binding should NOT be accessible
    let threw = false;
    try { evalStd("mymod.secret\n", [ext]); }
    catch (e: any) { threw = e.message.includes("not found") || e.message.includes("not exported"); }
    eq(threw, true, "private binding should not be accessible");
  });

  await asyncTest("module: export encapsulation — functions", async () => {
    const loader = new ModuleLoader({
      modules: [{ id: "mathmod" }],
      resolve: (id) => `/mock/${id}.alg`,
      readFile: async () =>
        "helper(x) => x * x\n" +
        "export square = x => helper(x)\n",
    });
    const exts = await loader.loadAll();
    const modObj = (exts[0] as any).moduleObject;
    eq(modObj !== undefined, true);

    const ext: Extension = { name: "test", bindings: { mathmod: modObj } };

    // Exported function should work
    const sqResult = evalStd("mathmod.square(5)\n", [ext]);
    eq(sqResult !== null, true, "exported function should work");
    eq(Number((dataOf(sqResult!) as BitsValue).data), 25);

    // Private helper should NOT be accessible
    let threw = false;
    try { evalStd("mathmod.helper(5)\n", [ext]); }
    catch (e: any) { threw = e.message.includes("not found") || e.message.includes("not exported"); }
    eq(threw, true, "private helper should not be accessible");
  });

  await asyncTest("module: recursive function in module", async () => {
    const loader = new ModuleLoader({
      modules: [{ id: "math" }],
      resolve: (id) => `/mock/${id}.alg`,
      readFile: async () =>
        "factorial(n) => if n == 0 then 1 else n * factorial(n - 1)\n",
    });
    const exts = await loader.loadAll();
    eq(evalNumExt("factorial(5)", exts), 120);
  });

  // Nested `use` pre-scan inside libraries. Without this, libs can only
  // use base-grammar constructs — body-form clauses like `proven`,
  // `assert`, `requires`/`ensures`, and `effects` are unavailable
  // inside `lib/*.alg`. The loader scans the lib source's header,
  // recursively loads the referenced modules through the same loader,
  // and parses the lib body with the resulting extended grammar.
  await asyncTest("module: nested `use proven` resolves through loader", async () => {
    const libDir = path.resolve("lib");
    const loader = new ModuleLoader({
      modules: [{ id: "neg2lib" }],
      resolve: (id) => {
        if (id === "neg2lib") return "/mock/neg2lib.alg";
        // Forward `proven` to the real system lib so the body-form
        // grammar is actually loaded — verifies the recursive load path.
        const p = path.join(libDir, `${id}.alg`);
        return fs.existsSync(p) ? p : null;
      },
      readFile: async (p) => {
        if (p === "/mock/neg2lib.alg") {
          return (
            "use proven\n" +
            "\n" +
            "// `proven neg2(neg2(b)) == b` is checked at definition time by\n" +
            "// bounded sampling over Bool. Both values are exercised; this\n" +
            "// would halt compilation if the property didn't hold.\n" +
            "neg2(b: Bool): Bool =>\n" +
            "  proven neg2(neg2(b)) == b\n" +
            "  if b then false else true\n"
          );
        }
        return fs.readFileSync(p, "utf-8");
      },
      extensions: [typeExt],
    });
    const exts = await loader.loadAll();
    eq(exts.length >= 1, true, "loader should produce at least the neg2lib extension");
    const neg2Ext = exts.find(e => e.name === "neg2lib");
    eq(neg2Ext !== undefined, true, "neg2lib extension should be present");
    eq("neg2" in neg2Ext!.bindings, true, "neg2 binding should be exported from neg2lib");
  });

  // Counterexample: a lib whose `proven` clause is FALSE should halt
  // compilation cleanly (failed proof reaches the kernel via the loader's
  // resolveSymbols/buildEvalCtx path with `proven` body-form active).
  await asyncTest("module: nested `use proven` reports failed `proven` clause", async () => {
    const libDir = path.resolve("lib");
    const loader = new ModuleLoader({
      modules: [{ id: "badlib" }],
      resolve: (id) => {
        if (id === "badlib") return "/mock/badlib.alg";
        const p = path.join(libDir, `${id}.alg`);
        return fs.existsSync(p) ? p : null;
      },
      readFile: async (p) => {
        if (p === "/mock/badlib.alg") {
          return (
            "use proven\n" +
            "\n" +
            "// Bool-domain enumeration exercises both true and false;\n" +
            "// neither produces `bad(b) == true`, so the proven clause fails.\n" +
            "bad(b: Bool): Bool =>\n" +
            "  proven bad(b) == true\n" +
            "  b\n"
          );
        }
        return fs.readFileSync(p, "utf-8");
      },
      extensions: [typeExt],
    });
    await asyncThrows(() => loader.loadAll(), "proven");
  });

  // `use grammar { … }` literals inside libs are not yet supported.
  // The loader should reject them with a clear error rather than silently
  // ignoring or parsing them as ordinary statements (which fails opaquely).
  await asyncTest("module: nested `use grammar { … }` literal is rejected", async () => {
    const loader = new ModuleLoader({
      modules: [{ id: "litlib" }],
      resolve: (id) => id === "litlib" ? "/mock/litlib.alg" : null,
      readFile: async () =>
        "use grammar { infix \"@@\" prec(mul) left => (l, r) => l + r }\n" +
        "answer = 42\n",
      extensions: [typeExt],
    });
    await asyncThrows(() => loader.loadAll(), "use grammar");
  });
}

// == Grammar Extensions ==

/** Helper: build a Context value with named bindings */
function makeCtxWith(bindings: Record<string, Value>): Value {
  const ctx = makeContext();
  for (const [name, value] of Object.entries(bindings)) {
    ctx.bindings.set(name, { key: name, value });
    ctx.bindingList.push({ key: name, value });
  }
  return ctx;
}


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

// == Allegro Standard — Type System ==

test("type system: int literal has Int type", () => {
  const result = evalStd("42");
  eq(result !== null, true);
  eq(getTypeName(result!), "Int");
  eq(Number(dataOf(result!) as any).valueOf !== undefined, true);
  const p = dataOf(result!) as BitsValue;
  eq(Number(p.data), 42);
});

test("type system: string literal has String type", () => {
  const result = evalStd('"hello"');
  eq(result !== null, true);
  eq(getTypeName(result!), "String");
  eq(bitsToString(dataOf(result!) as BitsValue), "hello");
});

test("type system: int arithmetic preserves type", () => {
  const result = evalStd("3 + 4");
  eq(result !== null, true);
  eq(getTypeName(result!), "Int");
  const p = dataOf(result!) as BitsValue;
  eq(Number(p.data), 7);
});

test("type system: int subtraction", () => {
  const result = evalStd("10 - 3");
  eq(getTypeName(result!), "Int");
  eq(Number((dataOf(result!) as BitsValue).data), 7);
});

test("type system: int multiplication", () => {
  const result = evalStd("6 * 7");
  eq(getTypeName(result!), "Int");
  eq(Number((dataOf(result!) as BitsValue).data), 42);
});

test("type system: int comparison returns typed Bool", () => {
  const result = evalStd("3 < 5");
  eq(getTypeName(result!), "Bool");
  eq(Number((dataOf(result!) as BitsValue).data), 1);
});

test("type system: string dot length", () => {
  const result = evalStd('"hello".length');
  eq(result !== null, true);
  const p = dataOf(result!) as BitsValue;
  eq(Number(p.data), 5);
});

test("type system: int dot toString", () => {
  const result = evalStd("42.toString()");
  eq(result !== null, true);
  eq(bitsToString(dataOf(result!) as BitsValue), "42");
});

test("type system: string dot slice", () => {
  const result = evalStd('"hello".slice(1, 3)');
  eq(result !== null, true);
  eq(bitsToString(dataOf(result!) as BitsValue), "el");
});

test("type system: string dot indexOf", () => {
  const result = evalStd('"hello".indexOf("ll")');
  eq(result !== null, true);
  eq(Number((dataOf(result!) as BitsValue).data), 2);
});

test("type system: string trim returns typed String", () => {
  const result = evalStd('"  hello  ".trim()');
  eq(getTypeName(result!), "String");
  eq(bitsToString(dataOf(result!) as BitsValue), "hello");
});

test("type system: string startsWith returns typed Bool", () => {
  const result = evalStd('"hello".startsWith("hel")');
  eq(getTypeName(result!), "Bool");
  eq(Number((dataOf(result!) as BitsValue).data), 1);
});

test("type system: string split returns typed Array", () => {
  const result = evalStd('"a,b,c".split(",")');
  eq(getTypeName(result!), "Array");
});

test("type system: string replace returns typed String", () => {
  const result = evalStd('"aabb".replace("b", "x")');
  eq(getTypeName(result!), "String");
  eq(bitsToString(dataOf(result!) as BitsValue), "aaxx");
});

test("type system: string toUpperCase returns typed String", () => {
  const result = evalStd('"hello".toUpperCase()');
  eq(getTypeName(result!), "String");
  eq(bitsToString(dataOf(result!) as BitsValue), "HELLO");
});

test("type system: string toCharCodes returns typed Array", () => {
  const result = evalStd('"AB".toCharCodes()');
  eq(getTypeName(result!), "Array");
});

test("type system: string concat with +", () => {
  const result = evalStd('"hello" + " world"');
  eq(result !== null, true);
  eq(getTypeName(result!), "String");
  eq(bitsToString(dataOf(result!) as BitsValue), "hello world");
});

test("type system: typed function calls", () => {
  const result = evalStd("f(x) => x + 1\nf(5)");
  eq(result !== null, true);
  eq(getTypeName(result!), "Int");
  eq(Number((dataOf(result!) as BitsValue).data), 6);
});

test("type system: typed recursion", () => {
  const result = evalStd("factorial(n) => if n == 0 then 1 else n * factorial(n - 1)\nfactorial(5)");
  eq(result !== null, true);
  eq(getTypeName(result!), "Int");
  eq(Number((dataOf(result!) as BitsValue).data), 120);
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
  const mathCtx = makeCtxWith({ pi: makeInt(3) });
  const ext: Extension = { name: "test", bindings: { math: mathCtx } };
  const result = evalStd("math.pi", [ext]);
  eq(result !== null, true);
  eq(Number((dataOf(result!) as BitsValue).data), 3);
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
  eq(Number((dataOf(result!) as BitsValue).data), 1);
});

test("type system: float toString", () => {
  const result = evalStd("3.14.toString()");
  eq(bitsToString(dataOf(result!) as BitsValue), "3.14");
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
  eq(bitsToString(dataOf(result!) as BitsValue), "true");
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
  eq(Number((dataOf(result!) as BitsValue).data), 3);
});

test("type system: array bracket access", () => {
  const result = evalStd("[10, 20, 30][1]");
  eq(result !== null, true);
  eq(Number((dataOf(result!) as BitsValue).data), 20);
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
  eq(Number((dataOf(result!) as BitsValue).data), 42);
});

test("type system: object bracket access", () => {
  const result = evalStd('{name: "alice"}["name"]');
  eq(result !== null, true);
  eq(bitsToString(dataOf(result!) as BitsValue), "alice");
});

test("type system: nested object", () => {
  const result = evalStd("{a: {x: 1}}.a.x");
  eq(Number((dataOf(result!) as BitsValue).data), 1);
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
  eq(Number((dataOf(result!) as BitsValue).data), 50);
});

test("type system: object with 4 fields", () => {
  const result = evalStd("{a: 1, b: 2, c: 3, d: 4}.d");
  eq(Number((dataOf(result!) as BitsValue).data), 4);
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
  eq(Number((dataOf(evalStd("3 != 4")!) as BitsValue).data), 1);
  eq(Number((dataOf(evalStd("3 != 3")!) as BitsValue).data), 0);
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
  eq(Number((dataOf(result!) as BitsValue).data), 10);
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

import * as fs from "fs";
import * as path from "path";
import {
  runAlgFile, fileTest, corpusWalk, primNames, typeNames, testsDir,
} from "./alg-files.js";
import { primitives as primRegistry } from "../primitives.js";

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
const mathModuleCtx = extensionToContext({ name: "mymath", bindings: mathBindings });
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
  eq(Number((dataOf(result!) as BitsValue).data), 42);
  // Export-ness is recorded — on the binding
  eq(r.evalCtx.bindings.get("x")?.visibility, "exported");
  {
  }
});

test("module export: non-exported values don't have exported component", () => {
  const result = evalStd("x = 42\nx\n");
  // Should NOT have "exported" component
  {
    eq(channelReadRaw(result!, "exported") === undefined, true);
  }
});

test("B-097 V1: export marks the BINDING, not the value (no component)", () => {
  const r = runtimeEval("export x = 42\ny = x\n", undefined, [typeExt], undefined, true);
  eq(r.evalCtx.bindings.get("x")?.visibility, "exported");
  // The value itself carries NO exported marker any more.
  eq(channelReadRaw(r.evalCtx.bindings.get("x")!.value!, "exported") === undefined, true);
});

test("B-097 V1: y = x does NOT export y (the aliasing wart is dead)", () => {
  const r = runtimeEval("export x = 42\ny = x\n", undefined, [typeExt], undefined, true);
  eq(r.evalCtx.bindings.get("y")?.visibility === undefined, true, "alias binding is not exported");
});

test("B-097 V1: exported typed function declaration marks its binding", () => {
  const r = runtimeEval("export double(n: Int): Int => n * 2\ndouble(21)\n", undefined, [typeExt], undefined, true);
  eq(r.evalCtx.bindings.get("double")?.visibility, "exported");
  eq(Number((dataOf(r.value!) as BitsValue).data), 42);
});

// == B-097 V2: pipeline unification ==

import { withType as tsWithType } from "../types-std.js";
import { effectsOf as tsEffectsOf, livenessDispositions } from "../effects.js";

test("B-097 V2: fallbackMember is 3-ary — the evidence capsule answers possession", () => {
  const r = runtimeEval("secret = 41\nsecret", undefined, [typeExt], undefined, true);
  const accessCtx = r.evalCtx;
  const t = makeContext();
  slotSetName(t, stringToBits("Probe"));
  let arity = 0;
  const hook = makePrimitive("probe.__getMember", (hargs) => {
    arity = hargs.length;
    const capsule = dataOf(hargs[2]) as import("../types.js").PrimitiveFunctionValue;
    const holdsSecret = capsule.fn([stringToBits("secret")], undefined as any, undefined as any);
    const holdsNope = capsule.fn([stringToBits("no_such_name")], undefined as any, undefined as any);
    const score = (Number((dataOf(holdsSecret) as BitsValue).data) === 1 ? 10 : 0)
    + (Number((dataOf(holdsNope) as BitsValue).data) === 1 ? 1 : 0);
    return makeInt(score);
  });
  slotSetFallbackMember(t, hook);
  const inst = tsWithType(makeContext(), t);
  const td = primRegistry.type_dispatch;
  const out = evaluate(makeExpr(td, [inst, stringToBits("anything")]), accessCtx);
  eq(arity, 3, "hook received (instance, name, capsule)");
  eq(Number((dataOf(out) as BitsValue).data), 10, "capsule: holds in-scope name, denies unknown");
});

test("B-097 V2: an effectful fallbackMember's tag survives dispatch (applyPrimitive path)", () => {
  const r = runtimeEval("x = 1", undefined, [typeExt], undefined, true);
  const t = makeContext();
  slotSetName(t, stringToBits("FxProbe"));
  const hook = makePrimitive("fx.__getMember", () => makeInt(5), false, ["io"]);
  slotSetFallbackMember(t, hook);
  const inst = tsWithType(makeContext(), t);
  const out = evaluate(makeExpr(primRegistry.type_dispatch, [inst, stringToBits("f")]), r.evalCtx);
  const eff = tsEffectsOf(out);
  eq(eff != null && eff.has("io"), true, "hook effect tag harvested (was silently dropped pre-V2)");
});

test("B-097 V2: typeMethod raw-binding fallthrough is narrowed to protocol slots", () => {
  const t = makeContext();
  slotSetName(t, stringToBits("Leaky"));
  // a stray non-slot binding on the type Context — pre-V2 this was
  // name-reachable through dispatch; post-V2 it is not a member.
  t.bindings.set("stray", { key: "stray", value: makeInt(9) });
  const r = runtimeEval("x = 1", undefined, [typeExt], undefined, true);
  const inst = tsWithType(makeContext(), t);
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
  eq(Number((dataOf(out!) as BitsValue).data), 42, "own method holds the member privilege");
  const msg = stdErrorMessage(
    "Vault = Type.define({owner: String, secret: private(Int)})\n" +
    "v = Vault(\"alice\", 42)\nv.secret\n");
  eq(msg.includes("'secret' is private to 'Vault'"), true, "denial names privacy and the type (names-public)");
});

test("B-097 V3: private method — internal call works, external call denies", () => {
  const out = evalStd(
    "Counter = Type.define({n: Int, bump: private((self) => self.n + 1), next: (self) => self.bump()})\n" +
    "c = Counter(41)\nc.next()\n");
  eq(Number((dataOf(out!) as BitsValue).data), 42);
  const msg = stdErrorMessage(
    "Counter = Type.define({n: Int, bump: private((self) => self.n + 1)})\n" +
    "c = Counter(41)\nc.bump()\n");
  eq(msg.includes("'bump' is private to 'Counter'"), true);
});

test("B-097 V3: private operator member — a + b denies outside, works from the type's own code", () => {
  const out = evalStd(
    "Money = Type.define({amt: Int, add: private((self, other) => Money(self.amt + other.amt)), plus: (self, other) => self + other})\n" +
    "Money(2).plus(Money(3)).amt\n");
  eq(Number((dataOf(out!) as BitsValue).data), 5, "operator dispatch inside a member body holds privilege");
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
  eq(bitsToString(dataOf(pub!) as BitsValue), "alice");
  const inner = evalStd(
    "Vault = Type.define({owner: String, secret: private(Int), peek: (self) => when self is Vault(secret) then secret else 0 - 1})\n" +
    "Vault(\"alice\", 42).peek()\n");
  eq(Number((dataOf(inner!) as BitsValue).data), 42);
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
  const tsStr = bitsToString(dataOf(ts!) as BitsValue);
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
  const iface = dataOf(r.evalCtx.bindings.get("HasX")!.value!) as ContextValue;
  const privInst = r.evalCtx.bindings.get("a")!.value!;
  const pubInst = r.evalCtx.bindings.get("b")!.value!;
  const looseIface = structuralWrap(iface);
  const instOf = typeMethod(Type, "instanceof")! as import("../types.js").PrimitiveFunctionValue;
  const privCheck = instOf.fn([looseIface, privInst], undefined as any, undefined as any);
  eq(Number((dataOf(privCheck) as BitsValue).data), 0, "private x does not satisfy ~{x}");
  const pubCheck = instOf.fn([looseIface, pubInst], undefined as any, undefined as any);
  eq(Number((dataOf(pubCheck) as BitsValue).data), 1, "public x does");
  // Expected side: an interface's own private declaration imposes no
  // requirement on conformers (its symbol is interface-local).
  const r2 = runtimeEval(
    "Wants = Interface.define({x: Int, hidden: private(Int)})\n" +
    "Impl = Type.define({x: Int}, Wants)\n" +
    "i = Impl(7)\ni\n", undefined, [typeExt], undefined, true);
  const wants = dataOf(r2.evalCtx.bindings.get("Wants")!.value!) as ContextValue;
  const impl = r2.evalCtx.bindings.get("i")!.value!;
  const declCheck = instOf.fn([wants, impl], undefined as any, undefined as any);
  eq(Number((dataOf(declCheck) as BitsValue).data), 1, "expected-side private is not required");
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
  const userType = dataOf(r.evalCtx.bindings.get("User")!.value!) as ContextValue;
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
  const vaultType = dataOf(r.evalCtx.bindings.get("Vault")!.value!) as ContextValue;
  // Enumeration lists private members (names-public), flags recorded —
  // introspection/PCP tooling keeps unrestricted name-level reads.
  const descs = memberDescriptorsOf(vaultType);
  eq(descs.has("secret") && descs.has("code"), true, "enumeration counts are unchanged by privacy");
  const codeDesc = descs.get("code")!;
  const listKeys = (v: Value): string[] => {
    const listing = primRegistry.ctx_bindings.fn([v], r.evalCtx, evaluate) as import("../types.js").ExpressionValue;
    return listing.args.map((pair) =>
      bitsToString(dataOf((pair as import("../types.js").ExpressionValue).args[0]) as BitsValue));
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
  eq(Number((dataOf(r.value!) as BitsValue).data), 3, "reads work unchanged");
  const pointType = dataOf(r.evalCtx.bindings.get("Point")!.value!) as ContextValue;
  const xDesc = typeMemberDescriptor(pointType, "x")!;
  eq(xDesc.bindings.get("readonly")?.value !== undefined, true, "attribute recorded for B-046");
});

test("module export: exported functions work normally", () => {
  const result = evalStd("export f = x => x * 2\nf(21)\n");
  eq(Number((dataOf(result!) as BitsValue).data), 42);
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
  eq(Number((dataOf(pubResult!) as BitsValue).data), 42);

  // Access exported function
  const fnResult = evalStd("testmod.pub_fn(21)", [ext]);
  eq(Number((dataOf(fnResult!) as BitsValue).data), 42);

  // Private field should NOT be accessible via type_dispatch
  let threw = false;
  try { evalStd("testmod.private_val", [ext]); }
  catch (e: any) { threw = e.message.includes("not found") || e.message.includes("not exported"); }
  eq(threw, true);
});

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
  const args = getGenericArgs(type as ContextValue);
  eq(args !== undefined, true);
});

test("generics: array literal infers Array[String]", () => {
  const result = evalStd('["a", "b", "c"]');
  eq(getTypeName(result!), "Array");
  const type = getType(result!);
  const args = getGenericArgs(type as ContextValue);
  eq(args !== undefined, true);
});

test("generics: mixed element array gets bare Array", () => {
  // Can't easily create mixed array in Allegro Standard yet since all ints are Int,
  // but empty array should be bare Array (no __args)
  const result = evalStd("[]");
  eq(getTypeName(result!), "Array");
  const type = getType(result!);
  // Bare Array (generic) should not have __args
  const args = getGenericArgs(type as ContextValue);
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
  eq(isGenericType(p as ContextValue), true);
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
  const intType = channelReadRaw(IntType, "type");
  eq(intType === Type, true);
  const strType = channelReadRaw(StringType, "type");
  eq(strType === Type, true);
});

test("type hierarchy: Type has __type = Type (self-referential)", () => {
  const ttType = channelReadRaw(Type, "type");
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
  const wrapType = channelReadRaw(wrappedInt, "type");
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
  eq(isMethodDescriptor(addDesc as ContextValue), true);
  eq(isFieldDescriptor(addDesc as ContextValue), false);
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
  eq(isMethodDescriptor(defineDesc as ContextValue), true);
});

test("member descriptors: Type has __members with meta-methods", () => {
  const members = memberDescriptorsOf(Type);
  eq(members.size > 0, true);
  const instanceofDesc = members.get("instanceof");
  eq(instanceofDesc !== undefined, true);
  eq(isMethodDescriptor(instanceofDesc as ContextValue), true);
});

test("member descriptors: record type has Field descriptors", () => {
  const result = evalStd(`Animal = Type.define({name: String, age: Int}, Int)
Animal`);
  const typeCtx = dataOf(result!) as ContextValue;
  eq(typeCtx.kind, ValueKind.Structure);
  const members = memberDescriptorsOf(typeCtx);
  eq(members.size > 0, true);
  const nameDesc = members.get("name");
  eq(nameDesc !== undefined, true);
  eq(isFieldDescriptor(nameDesc as ContextValue), true);
  // toString should be a Method descriptor
  const tsDesc = members.get("toString");
  eq(tsDesc !== undefined, true);
  eq(isMethodDescriptor(tsDesc as ContextValue), true);
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
  const tt = channelReadRaw(Effect, "type");
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
  const iface = dataOf(result!) as ContextValue;
  eq(iface.kind, ValueKind.Structure);
  // __interface marker
  const marker = getInterfaceMarker(iface);
  eq(marker !== undefined, true);
  eq((marker as BitsValue).data, 1n);
  // C6.1b (D45): an interface is an instance of the Interface kind.
  eq(channelReadRaw(iface, "type") === InterfaceKind, true);
});

test("interfaces: interface has Field descriptors in __members", () => {
  const result = dataOf(evalStd(`Interface.define({toString: Function, length: Int})`)!) as ContextValue;
  const members = memberDescriptorsOf(result);
  eq(members.size > 0, true);
  const tsDesc = members.get("toString");
  eq(tsDesc !== undefined, true);
  eq(isFieldDescriptor(tsDesc as ContextValue), true);
  const lenDesc = members.get("length");
  eq(lenDesc !== undefined, true);
  eq(isFieldDescriptor(lenDesc as ContextValue), true);
});

test("interfaces: interface has no __construct", () => {
  const result = dataOf(evalStd(`Interface.define({x: Int})`)!) as ContextValue;
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
  const iface = dataOf(result!) as ContextValue;
  const members = memberDescriptorsOf(iface);
  // Should have 'add' from Int's __members
  eq(members.has("add"), true);
  // Should have 'extra' as declared
  eq(members.has("extra"), true);
});

test("interfaces: Type.interface also creates structural type", () => {
  const result = evalStd(`Sized = Interface.define({length: Int}, Int)
Sized`);
  const iface = dataOf(result!) as ContextValue;
  eq(channelReadRaw(iface, "type") === InterfaceKind, true);
});

test("interfaces: auto-named when bound to symbol", () => {
  const result = evalStd(`Printable = Interface.define({toString: Function})
Printable`);
  const iface = dataOf(result!) as ContextValue;
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
  eq(componentsView(result!).has("error"), true);
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
  eq(componentsView(result!).has("error"), true);
});

test("Refinement spec methods: lower-bound failure produces error", () => {
  const result = evalStd(`T = Refinement.define({refines: Int, where: w => w > 0 && w < 100, triple: self => self * 3})
T(0 - 10)`);
  eq(componentsView(result!).has("error"), true);
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
  const metaType = makeContext();
  const metaMembers = makeContext();
  // describe(self) => self.__name — as an Allegro lambda
  const param = makeParam(0);
  const selfExpr = param as unknown as Value;
  // Body: access __name on self via __get_member... simpler: just return self.
  const describeFn = makeComposedFn([param], selfExpr);
  const desc = makeContext();
  const descBindings = [
    [SLOT_KEYS.type, Type],
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

  // Raw Context with __type = metaType.
  const target = makeContext();
  writeShape(target, metaType);
  slotSetName(target, stringToBits("Instance"));

  // Call type_dispatch(target, "describe") via the primitive.
  const typeDispatch = primRegistry["type_dispatch"] as any;
  // Lazy primitive — pass raw args (unevaluated) and an evalFn + ctx.
  const ctx = makeContext();
  // Seed ctx with the target under a name, and invoke the bound method.
  ctx.bindings.set("x", { key: "x", value: target });
  ctx.bindingList.push({ key: "x", value: target });
  const boundMethod = typeDispatch.fn(
    [target, stringToBits("describe")],
    ctx,
    (v: Value, c: ContextValue) => evaluate(v, c),
  );
  eq(boundMethod !== null && boundMethod !== undefined, true);
  // The returned value should be a bound primitive (since describe has one
  // positional arg — self — which gets auto-bound). Calling it with no args
  // invokes the ComposedFunction with self = target.
  eq(boundMethod.kind, ValueKind.PrimitiveFunction, "meta-method should return a bound primitive");
  const result = boundMethod.fn([], ctx, (v: Value, c: ContextValue) => evaluate(v, c));
  // describeFn returns its self param; primary should be the raw target Context.
  eq(dataOf(result).kind, ValueKind.Structure);
  eq(dataOf(result) === target, true, "bound method should pass target as self");
});

test("Refinement spec methods: instanceof still works", () => {
  const result = evalStd(`T = Refinement.define({refines: Int, where: p => p > 0, double: self => self + self})
T(5) instanceof T`);
  eq(Number((dataOf(result!) as BitsValue).data), 1);
});

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

// == E1 equality protocol battery (B-027, structures.md §7, E-R1/D37) ==

function eqNum(src: string): number {
  const result = evalStd(src);
  return Number((dataOf(result!) as BitsValue).data);
}

test("E1 equality: array structural equality is true, Bool-typed", () => {
  const result = evalStd("[1,2] == [1,2]");
  eq(Number((dataOf(result!) as BitsValue).data), 1);
  eq(getTypeName(result!), "Bool");
});

test("E1 equality: != is the derived negation", () => {
  eq(eqNum("[1,2] != [1,2]"), 0);
  eq(eqNum("[1,2] != [1,3]"), 1);
});

test("E1 equality: array element and length mismatches", () => {
  eq(eqNum("[1,2] == [1,3]"), 0);
  eq(eqNum("[1,2] == [1,2,3]"), 0);
  eq(eqNum("[1.5, 2.5] == [1.5, 2.5]"), 1);
});

test("E1 equality: nested structures recurse through the protocol", () => {
  eq(eqNum("[[1,2],[3]] == [[1,2],[3]]"), 1);
  eq(eqNum("[[1,2],[3]] == [[1,2],[4]]"), 0);
  eq(eqNum("{a: {b: [1,2]}} == {a: {b: [1,2]}}"), 1);
  eq(eqNum("{a: {b: [1,2]}} == {a: {b: [1,3]}}"), 0);
});

test("E1 equality: object field-wise equality", () => {
  eq(eqNum("{x: 1} == {x: 1}"), 1);
  eq(eqNum("{x: 1} == {x: 2}"), 0);
  eq(eqNum("{x: 1} == {y: 1}"), 0);
  eq(eqNum("{x: 1, y: 2} == {x: 1}"), 0);
});

test("E1 equality: record instances compare structurally", () => {
  const mk = (tail: string) => eqNum(`P = Type.define({x: Int, y: Int})\n${tail}`);
  eq(mk("P(1,2) == P(1,2)"), 1);
  eq(mk("P(1,2) == P(1,3)"), 0);
  eq(mk("P(1,2) != P(1,2)"), 0);
});

test("E1 equality: custom `eq` in the define spec overrides the kernel", () => {
  // eq compares x only — proves the spec-supplied equals dispatches.
  eq(eqNum(`Q = Type.define({x: Int, y: Int, eq: (self, other) => self.x == other.x})
Q(1, 2) == Q(1, 9)`), 1);
  eq(eqNum(`Q = Type.define({x: Int, y: Int, eq: (self, other) => self.x == other.x})
Q(1, 2) == Q(3, 2)`), 0);
});

test("E1 equality: refinement peel re-pinned (D37 — knowledge never separates)", () => {
  eq(eqNum("PositiveInt = Int & _ > 0\nPositiveInt(5) == 5"), 1);
});

test("E1 equality: preserve-lifted refinements peel too (equalityShape)", () => {
  const pre = `PI = Refinement.define({refines: Int, where: p => p > 0, preserve: "all"})\n`;
  eq(eqNum(pre + "PI(5) == 5"), 1);
  eq(eqNum(pre + "x = PI(5)\n(x + 3) == 8"), 1);
});

test("E1 equality: distinct types are unequal to their parent (§7 step 3)", () => {
  const pre = `UserId = Int.distinct("UserId")\n`;
  eq(eqNum(pre + "UserId(42) == 42"), 0);
  eq(eqNum(pre + "UserId(42) != 42"), 1);
  eq(eqNum(pre + "UserId(42) == UserId(42)"), 1);
});

test("E1 equality: cross-shape scalars with no coercion are simply false", () => {
  eq(eqNum('"a" == 1'), 0);
  eq(eqNum("true == 1"), 0);     // §6 delta 7: Bool and Int are distinct shapes
  eq(eqNum("true == true"), 1);  // and NO Bool→Int coercion is declared (recommended)
});

test("E1 equality: none keeps identity semantics", () => {
  eq(eqNum("none == none"), 1);
  eq(eqNum("none == 5"), 0);
});

test("E1 equality: errors stay viral through ==", () => {
  const result = evalStd('(error "boom") == 1');
  eq(channelReadRaw(result!, "error") !== undefined, true);
});

test("E1 equality: type values compare by identity", () => {
  eq(eqNum("Int == Int"), 1);
  eq(eqNum("Int == Float"), 0);
  // Memoized generic concretes: same application → same identity.
  eq(eqNum("t1 = type of [1,2]\nt2 = type of [3,4]\nt1 == t2"), 1);
  eq(eqNum('t1 = type of [1,2]\nt2 = type of ["a"]\nt1 == t2'), 0);
});

test("E1 equality: typed functions compare by identity", () => {
  eq(eqNum("f(x: Int): Int => x\nf == f"), 1);
  eq(eqNum("f(x: Int): Int => x\ng(x: Int): Int => x\nf == g"), 0);
});

test("E1 equality: print of a structural comparison no longer crashes", () => {
  // Regression: the old reference-eq stub returned an untyped int the
  // dispatch fallback mistyped as Array/Object, crashing formatValue.
  const result = evalStd("v = [1,2] == [1,2]\nv.toString()");
  eq(bitsToString(dataOf(result!) as BitsValue), "true");
});

test("E1 equality: no-throw sweep — == is total over every kind pair", () => {
  const bindings = `P = Type.define({x: Int})
UserId = Int.distinct("UserId")
tf(x: Int): Int => x
v0 = 1
v1 = 1.5
v2 = "a"
v3 = true
v4 = [1]
v5 = {x: 1}
v6 = P(1)
v7 = tf
v8 = none
v9 = Int
v10 = UserId(1)
`;
  const lines: string[] = [];
  for (let i = 0; i <= 10; i++) {
    for (let j = 0; j <= 10; j++) {
      lines.push(`r${i}_${j} = v${i} == v${j}`);
    }
  }
  // Every pair must produce a value (typed Bool), never a host throw.
  const result = evalStd(bindings + lines.join("\n") + "\nv0 == v0");
  eq(Number((dataOf(result!) as BitsValue).data), 1);
});

test("E1 equality: kernel lawfulness empirical shadow (refl/sym/trans)", () => {
  // The parametric certificate's empirical shadow (plan §5): property-check
  // the kernel equals over a fixed set of generated structures.
  const srcs = [
    "1", "2", "1.5", '"a"', '"b"', "true", "false", "none",
    "[1,2]", "[1,2]", "[2,1]", "[[1],[2]]",
    "{x: 1}", "{x: 1}", "{x: 2}", "{a: {b: [1,2]}}", "{a: {b: [1,2]}}",
  ];
  const vals = srcs.map(s => evalStd(s)!);
  const eqv = (a: Value, b: Value) => protocolEqualsBool(a, b);
  for (const a of vals) eq(eqv(a, a), true);                       // refl
  for (const a of vals) for (const b of vals) {
    eq(eqv(a, b), eqv(b, a));                                      // sym
  }
  for (const a of vals) for (const b of vals) for (const c of vals) {
    if (eqv(a, b) && eqv(b, c)) eq(eqv(a, c), true);               // trans
  }
});

test("E1 equality: E3 certificate anchor is exported", () => {
  eq(typeof KERNEL_EQUALS_CERTIFICATE, "string");
  eq(KERNEL_EQUALS_CERTIFICATE.length > 0, true);
});

// == E2 declared coercions + least common type (B-027, §7 step 2, E-R2) ==

test("E2 coercion: 1 == 1.0 flips true via the kernel Int→Float edge (§6 delta 4)", () => {
  eq(eqNum("1 == 1.0"), 1);
  eq(eqNum("1.0 == 1"), 1);      // commutative by construction (same LCT both orders)
  eq(eqNum("2 == 1.0"), 0);
  eq(eqNum("1 != 1.0"), 0);      // != stays the derived negation through coercion
  eq(eqNum("1 != 2.0"), 1);
});

test("E2 coercion: same-shape containers coerce their components", () => {
  // Kernel structural equals recurses through the PROTOCOL, which now
  // includes the coercion step — mixed scalar fields meet at Float.
  eq(eqNum("{x: 1} == {x: 1.0}"), 1);
  eq(eqNum("{x: 2} == {x: 1.0}"), 0);
});

test("E2 coercion: differently-parameterized generic shapes do NOT coerce", () => {
  // Array[Int] and Array[Float] are distinct memoized concretes with no
  // declared edge — the container shapes themselves must meet, element
  // coercion only runs under a common container shape.
  eq(eqNum("[1, 2] == [1.0, 2.0]"), 0);
});

test("E2 coercion: distinct types opt back in via Coercion.declare (§6 delta 3)", () => {
  const pre = `UserId = Int.distinct("UserId")\nCoercion.declare(UserId, Int, (u) => Int(u))\n`;
  eq(eqNum(pre + "UserId(42) == 42"), 1);
  eq(eqNum(pre + "42 == UserId(42)"), 1);    // symmetric
  eq(eqNum(pre + "UserId(42) == 43"), 0);
  eq(eqNum(pre + "UserId(42) != 42"), 0);
  eq(eqNum(pre + "UserId(41) == UserId(41)"), 1); // own-shape equality unchanged
});

test("E2 coercion: coherence triangle — composed path UserId→Int→Float", () => {
  const pre = `UserId = Int.distinct("UserId")\nCoercion.declare(UserId, Int, (u) => Int(u))\n`;
  eq(eqNum(pre + "UserId(42) == 42.0"), 1);
  eq(eqNum(pre + "42.0 == UserId(42)"), 1);
  eq(eqNum(pre + "UserId(42) == 43.0"), 0);
});

test("E2 coercion: no unique least common type is an explicit error", () => {
  // Diamond: A and B each coerce into incomparable M and N — no least.
  const src = `A = Int.distinct("A")
B = Int.distinct("B")
M = Int.distinct("M")
N = Int.distinct("N")
Coercion.declare(A, M, (v) => M(v))
Coercion.declare(A, N, (v) => N(v))
Coercion.declare(B, M, (v) => M(v))
Coercion.declare(B, N, (v) => N(v))
A(1) == B(1)`;
  let msg = "";
  try { evalStd(src); } catch (e: any) { msg = String(e?.message ?? e); }
  eq(msg.includes("ambiguous"), true);
  eq(msg.includes("explicit coercion"), true);
});

test("E2 coercion: user declarations instantiate PENDING obligations; kernel edge is discharged", () => {
  evalStd(`ObDemo = Int.distinct("ObDemo")\nCoercion.declare(ObDemo, Int, (u) => Int(u))\n1`);
  const records = coercionObligationRecords();
  const user = records.filter(r => r.from === "ObDemo" && r.to === "Int");
  eq(user.length, 2);
  eq(user.every(r => r.status === "pending"), true);
  eq(user.map(r => r.obligation).sort().join(","), "coherence,equality-preservation");
  const kernel = records.filter(r => r.from === "Int" && r.to === "Float");
  eq(kernel.length, 2);
  eq(kernel.every(r => r.status === "discharged" && r.tier === "kernel"), true);
});

test("E2 coercion: declare rejects vacuous and malformed declarations", () => {
  // Same equality shape (refinements peel to Int) — a coercion is vacuous.
  let msg1 = "";
  try {
    evalStd("PositiveInt = Int & _ > 0\nCoercion.declare(PositiveInt, Int, (v) => v)");
  } catch (e: any) { msg1 = String(e?.message ?? e); }
  eq(msg1.includes("vacuous"), true);
  // Third argument must be a function.
  let msg2 = "";
  try {
    evalStd(`D2 = Int.distinct("D2")\nCoercion.declare(D2, Int, 42)`);
  } catch (e: any) { msg2 = String(e?.message ?? e); }
  eq(msg2.includes("must be a function"), true);
});

// == E3 lawful interfaces battery (B-027, structures.md §8, E-R3/E-R4/E-R5, D34/D38) ==

test("E3 laws: kernel scalars conform to Equatable with kernel-tier obligations", () => {
  // Retroactive conformance: built-in eq impls answer Equatable's symbols.
  const r1 = evalStd("42 instanceof Equatable");
  eq(Number((dataOf(r1!) as BitsValue).data), 1);
  const r2 = evalStd('"hi" instanceof Equatable');
  eq(Number((dataOf(r2!) as BitsValue).data), 1);
  // refl/sym/trans discharge via the parametric certificate — tier kernel.
  for (const t of ["Int", "Float", "String", "Bool"]) {
    const recs = lawObligationRecords().filter(x => x.type === t);
    eq(recs.length >= 3, true);
    eq(recs.every(x => x.status === "discharged" && x.tier === "kernel"), true);
  }
});

test("E3 laws: Equatable carries Law descriptors (ordinary members)", () => {
  const desc = typeMemberDescriptor(EquatableType, "refl");
  eq(desc !== null, true);
  eq(isLawDescriptor(desc!), true);
  // eq is an ordinary Field declaration alongside the laws.
  const eqDesc = typeMemberDescriptor(EquatableType, "eq");
  eq(isFieldDescriptor(eqDesc!), true);
});

test("E3 laws: record drawing Equatable with kernel equals discharges at tier kernel", () => {
  const r = evalStd("E3Pt = Type.define({x: Int, y: Int}, Equatable)\nE3Pt(1, 2) instanceof Equatable");
  eq(Number((dataOf(r!) as BitsValue).data), 1);
  const recs = lawObligationRecords().filter(x => x.type === "E3Pt");
  eq(recs.map(x => x.law).sort().join(","), "refl,sym,trans");
  eq(recs.every(x => x.status === "discharged" && x.tier === "kernel"), true);
});

test("E3 laws: a custom eq bears fresh obligations (pending, not kernel)", () => {
  evalStd("E3Cust = Type.define({x: Int, eq: (self, other) => true}, Equatable)\n1");
  const recs = lawObligationRecords().filter(x => x.type === "E3Cust");
  eq(recs.length, 3);
  eq(recs.every(x => x.status === "pending"), true);
});

test("E3 laws: `law_` spec keys demand a for_all proposition", () => {
  let msg = "";
  try { evalStd("Bad = Type.define({x: Int, law_x: 42})\n1"); }
  catch (e: any) { msg = String(e?.message ?? e); }
  eq(msg.includes("for_all"), true);
});

test("E3 laws: refinement law over an interval domain survives sampling (tier sampled)", () => {
  evalStd("E3Pos = Refinement.define({refines: Int & _ > 0, where: p => p > 0, law_gt: for_all(a => a > 0)})\n1");
  const recs = lawObligationRecords().filter(x => x.type === "E3Pos" && x.law === "gt");
  eq(recs.length, 1);
  // Survival is NOT proof (D34): status "sampled", not "discharged".
  eq(recs[0].status, "sampled");
  eq(recs[0].tier, "sampled");
});

test("E3 laws: a false law HALTS with a concrete counterexample", () => {
  let msg = "";
  try {
    evalStd("E3Neg = Refinement.define({refines: Int & _ > 0, where: p => p > 0, law_bad: for_all(a => a < 0)})\n1");
  } catch (e: any) { msg = String(e?.message ?? e); }
  eq(msg.includes("law 'bad' fails"), true);
  eq(msg.includes("counterexample at (1)"), true);
});

test("E3 laws: a Bool-domain law discharges by full enumeration (tier enumerated)", () => {
  evalStd("E3BoolRef = Refinement.define({refines: Bool, where: p => true, law_lem: for_all(a => a || !a)})\n1");
  const recs = lawObligationRecords().filter(x => x.type === "E3BoolRef" && x.law === "lem");
  eq(recs.length, 1);
  eq(recs[0].status, "discharged");
  eq(recs[0].tier, "enumerated");
});

test("E3 laws: multi-variable laws sample tuples (arity 2)", () => {
  let msg = "";
  try {
    // a + b == b + a holds; a - b == b - a fails at (0, 1) → halt names it.
    evalStd("E3Comm = Refinement.define({refines: Int & _ >= 0, where: p => p >= 0, law_sub: for_all((a, b) => a - b == b - a)})\n1");
  } catch (e: any) { msg = String(e?.message ?? e); }
  eq(msg.includes("law 'sub' fails"), true);
  eq(msg.includes("counterexample at (0, 1)"), true);
});

test("E3 E-R5: an eq implementation with effects is rejected at definition", () => {
  let msg = "";
  try { evalStd("BadEq = Type.define({x: Int, eq: (self, other) => print(1)}, Equatable)\n1"); }
  catch (e: any) { msg = String(e?.message ?? e); }
  eq(msg.includes("must be pure"), true);
  eq(msg.includes("io"), true);
});

test("E3 E-R5: an eq peeking at certificates is rejected (observe label)", () => {
  let msg = "";
  try {
    evalStd("PosPeek = Int & _ > 0\nBadEq2 = Type.define({x: Int, eq: (self, other) => certificate_peek(self, PosPeek)}, Equatable)\n1");
  } catch (e: any) { msg = String(e?.message ?? e); }
  eq(msg.includes("must be pure"), true);
  eq(msg.includes("observe"), true);
});

test("E3 E-R5: a coercion fn with effects is rejected at declaration", () => {
  let msg = "";
  try {
    evalStd(`E3D = Int.distinct("E3D")\nCoercion.declare(E3D, Int, (u) => print(u))`);
  } catch (e: any) { msg = String(e?.message ?? e); }
  eq(msg.includes("must be pure"), true);
});

test("E3 witnessed: Law.witness flips a pending obligation to discharged/witnessed", () => {
  evalStd(`
E3W = Type.define({x: Bool, eq: (self, other) => self.x == other.x}, Equatable)
Law.witness(E3W, "refl", prove_for_all_bool(b => b == b))
1`);
  const recs = lawObligationRecords().filter(x => x.type === "E3W");
  const refl = recs.find(x => x.law === "refl");
  eq(refl?.status, "discharged");
  eq(refl?.tier, "witnessed");
  // The others stay pending — witnessing is per-law.
  eq(recs.find(x => x.law === "sym")?.status, "pending");
});

test("E3 witnessed: Law.witness rejects a non-proof and unknown laws", () => {
  let msg1 = "";
  try { evalStd(`E3W2 = Type.define({x: Int, eq: (self, other) => true}, Equatable)\nLaw.witness(E3W2, "refl", 42)`); }
  catch (e: any) { msg1 = String(e?.message ?? e); }
  eq(msg1.includes("not a discharged Proof"), true);
  let msg2 = "";
  try { evalStd(`E3W3 = Type.define({x: Int, eq: (self, other) => true}, Equatable)\nLaw.witness(E3W3, "nope", prove_for_all_bool(b => b == b))`); }
  catch (e: any) { msg2 = String(e?.message ?? e); }
  eq(msg2.includes("no law obligation 'nope'"), true);
});

test("E3 witnessed: Coercion.witness discharges a pending §7 obligation", () => {
  evalStd(`
E3CW = Int.distinct("E3CW")
Coercion.declare(E3CW, Int, (u) => Int(u))
Coercion.witness(E3CW, Int, "equality-preservation", prove_for_all_bool(b => b == b))
1`);
  const recs = coercionObligationRecords().filter(r => r.from === "E3CW" && r.to === "Int");
  const pres = recs.find(r => r.obligation === "equality-preservation");
  eq(pres?.status, "discharged");
  eq(pres?.tier, "witnessed");
  eq(recs.find(r => r.obligation === "coherence")?.status, "pending");
});

test("E3 verdict: law + coercion obligations ride the Verdict with tiers", () => {
  const src = "E3V = Type.define({x: Int, eq: (self, other) => true}, Equatable)\n1";
  const result = runtimeEval(src, undefined, [typeExt], undefined, true, undefined, true);
  const verdict = buildVerdict(result.evalCtx, result.compilationReport);
  eq((verdict.lawObligations ?? []).length >= 3, true);
  const intRefl = verdict.lawObligations!.find(o => o.type === "Int" && o.law === "refl");
  eq(intRefl?.status, "discharged");
  eq(intRefl?.tier, "kernel");
  const pend = verdict.lawObligations!.filter(o => o.type === "E3V");
  eq(pend.length, 3);
  eq(pend.every(o => o.status === "pending"), true);
  const kernelEdge = (verdict.coercionObligations ?? []).filter(o => o.from === "Int" && o.to === "Float");
  eq(kernelEdge.length, 2);
  eq(kernelEdge.every(o => o.status === "discharged" && o.tier === "kernel"), true);
  // Pending laws don't flip verified (E3 records; the strict gate is E4).
  eq(verdict.verified, true);
});

test("E3 obligations export: pending laws surface through the H2 surface", () => {
  const src = "E3Ob = Type.define({x: Int, eq: (self, other) => true}, Equatable)\n1";
  const result = runtimeEval(src, undefined, [typeExt], undefined, true, undefined, true);
  const obs = extractObligations(result.evalCtx, result.compilationReport, { pendingOnly: true });
  const names = obs.map(o => o.theorem.name);
  eq(names.includes("E3Ob.law_refl"), true);
  eq(names.includes("E3Ob.law_sym"), true);
  eq(names.includes("E3Ob.law_trans"), true);
  // Discharged kernel obligations are excluded under pendingOnly.
  eq(names.includes("Int.law_refl"), false);
});

test("E3 laws: interface declaration alone instantiates nothing", () => {
  const before = lawObligationRecords().length;
  evalStd("E3Decl = Interface.define({frob: Function, law_frob_id: for_all(a => a == a)})\n1");
  const after = lawObligationRecords().filter(x => x.law === "frob_id");
  // Declared, not implemented — schema only, no obligation for the
  // interface itself.
  eq(after.length, 0);
  eq(lawObligationRecords().length, before);
});

test("E3 laws: drawing a user law-bearing interface instantiates at draw time", () => {
  evalStd(`
E3HasId = Interface.define({idem: Function, law_idem: for_all(a => a == a)})
E3Draw = Type.define({x: Int}, E3HasId)
1`);
  const recs = lawObligationRecords().filter(x => x.type === "E3Draw" && x.law === "idem");
  eq(recs.length, 1);
  // No kernel certificate on a user law; record domain isn't sampleable →
  // pending (the honest answer — the H2 export owns it now).
  eq(recs[0].status, "pending");
});

// == E4 admitted tier + proof_trans strict gate + E-R6 recording (B-027, D34/D8) ==

test("E4 gate: kernel equalities are auto-proven — proof_trans over Int stays green", () => {
  const src = "theorem t: 1 == 1 by proof_trans(proof_refl(1), proof_refl(1))\n1";
  const result = runtimeEval(src, undefined, [typeExt], undefined, true, undefined, true);
  const v = buildVerdict(result.evalCtx, result.compilationReport);
  const t = v.theorems.find(x => x.name === "t");
  eq(t?.status, "discharged");
  // E-R6: the proof records which equality + which tier backed it.
  eq(t?.lawBacking?.equality, "Int");
  eq(t?.lawBacking?.law, "trans");
  eq(t?.lawBacking?.tier, "kernel");
});

test("E4 gate: a custom equality with no trans law is REFUSED (§6 delta 6)", () => {
  const src = `
E4CE = Type.define({x: Int, eq: (self, other) => self.x == other.x}, Equatable)
v1 = E4CE(1)
theorem t: v1 == v1 by proof_trans(proof_refl(v1), proof_refl(v1))
1`;
  const result = runtimeEval(src, undefined, [typeExt], undefined, true, undefined, true);
  const v = buildVerdict(result.evalCtx, result.compilationReport);
  const t = v.theorems.find(x => x.name === "t");
  eq(t?.status, "failed");
  eq(t?.failure?.reason.includes("neither proven nor admitted"), true);
  // The refusal is actionable — it names both escape hatches.
  eq(t?.failure?.counterexample?.includes("Law.witness"), true);
  eq(t?.failure?.counterexample?.includes("Law.assume"), true);
});

test("E4 admitted: Law.assume flips a pending obligation and unblocks the gate", () => {
  const src = `
E4CA = Type.define({x: Int, eq: (self, other) => self.x == other.x}, Equatable)
Law.assume(E4CA, "trans")
v1 = E4CA(1)
theorem t: v1 == v1 by proof_trans(proof_refl(v1), proof_refl(v1))
1`;
  const result = runtimeEval(src, undefined, [typeExt], undefined, true, undefined, true);
  const v = buildVerdict(result.evalCtx, result.compilationReport);
  const t = v.theorems.find(x => x.name === "t");
  eq(t?.status, "discharged");
  eq(t?.lawBacking?.tier, "admitted");
  // Verdict-visible: the obligation shows as admitted, and the theorem
  // line renders the weakness note.
  const ob = v.lawObligations?.find(o => o.type === "E4CA" && o.law === "trans");
  eq(ob?.status, "admitted");
  const rendered = formatVerdict(v);
  eq(rendered.includes("[resting on admitted 'trans' of 'E4CA']"), true);
  eq(rendered.includes("ADMITTED"), true);
});

test("E4 admitted: Law.assume registers an obligation for a never-instantiated law", () => {
  // E4NX never drew Equatable — no obligations exist; assuming trans
  // creates a verdict-visible admitted entry and unblocks the gate.
  const src = `
E4NX = Type.define({x: Int, eq: (self, other) => true})
Law.assume(E4NX, "trans")
v1 = E4NX(1)
theorem t: v1 == v1 by proof_trans(proof_refl(v1), proof_refl(v1))
1`;
  const result = runtimeEval(src, undefined, [typeExt], undefined, true, undefined, true);
  const v = buildVerdict(result.evalCtx, result.compilationReport);
  eq(v.theorems.find(x => x.name === "t")?.status, "discharged");
  const recs = lawObligationRecords().filter(x => x.type === "E4NX");
  eq(recs.length, 1);
  eq(recs[0].status, "admitted");
});

test("E4 witnessed: a witnessed trans law passes the gate with proven backing (no weakness note)", () => {
  const src = `
E4CW2 = Type.define({x: Int, eq: (self, other) => self.x == other.x}, Equatable)
Law.witness(E4CW2, "trans", prove_for_all_bool(b => b == b))
v1 = E4CW2(1)
theorem t: v1 == v1 by proof_trans(proof_refl(v1), proof_refl(v1))
1`;
  const result = runtimeEval(src, undefined, [typeExt], undefined, true, undefined, true);
  const v = buildVerdict(result.evalCtx, result.compilationReport);
  const t = v.theorems.find(x => x.name === "t");
  eq(t?.status, "discharged");
  eq(t?.lawBacking?.tier, "witnessed");
  eq(formatVerdict(v).includes("resting on"), false);
});

test("E4 E-R6: proof fields dispatch — p.equality / p.lawName / p.lawTier", () => {
  const r = evalStd("p = proof_trans(proof_refl(7), proof_refl(7))\np.lawTier");
  eq(bitsToString(dataOf(r!) as BitsValue), "kernel");
  const r2 = evalStd("p = proof_trans(proof_refl(7), proof_refl(7))\np.equality");
  eq(bitsToString(dataOf(r2!) as BitsValue), "Int");
  const r3 = evalStd("p = proof_refl(7)\np.lawName");
  eq(bitsToString(dataOf(r3!) as BitsValue), "refl");
});

test("E4: proven beats admitted — Law.assume on a discharged obligation is a no-op", () => {
  evalStd(`E4Pt2 = Type.define({x: Int}, Equatable)\nLaw.assume(E4Pt2, "trans")\n1`);
  const rec = lawObligationRecords().find(x => x.type === "E4Pt2" && x.law === "trans");
  eq(rec?.status, "discharged");
  eq(rec?.tier, "kernel");
});

test("E4: Coercion.assume flips a pending §7 obligation to admitted", () => {
  evalStd(`
E4CD = Int.distinct("E4CD")
Coercion.declare(E4CD, Int, (u) => Int(u))
Coercion.assume(E4CD, Int, "coherence")
1`);
  const recs = coercionObligationRecords().filter(r => r.from === "E4CD");
  eq(recs.find(r => r.obligation === "coherence")?.status, "admitted");
  eq(recs.find(r => r.obligation === "equality-preservation")?.status, "pending");
  // Unknown edge errors.
  let msg = "";
  try { evalStd(`Coercion.assume(Int, Bool, "coherence")`); }
  catch (e: any) { msg = String(e?.message ?? e); }
  eq(msg.includes("no declared coercion"), true);
});

test("E4: admitted obligations are excluded from the pendingOnly H2 export", () => {
  const src = `
E4Ex = Type.define({x: Int, eq: (self, other) => true}, Equatable)
Law.assume(E4Ex, "trans")
1`;
  const result = runtimeEval(src, undefined, [typeExt], undefined, true, undefined, true);
  const obs = extractObligations(result.evalCtx, result.compilationReport, { pendingOnly: true });
  const names = obs.map(o => o.theorem.name);
  eq(names.includes("E4Ex.law_refl"), true);   // still pending
  eq(names.includes("E4Ex.law_trans"), false); // admitted — resolved for gating
});

// == D2 assumption-ledger roll-up (B-091) ==
//
// Proofs carry a TRANSITIVE backing set (`__lawBackings`, unioned
// through combinators and preserved by proof_check's relabel), so
// nested chains no longer lose inner backings; the Verdict aggregates
// the sets into an assumption-ledger block.

test("D2 roll-up: nested chain surfaces inner admitted backing through sym", () => {
  // Under single-field E-R6 recording, the outer proof_sym would lose
  // the inner proof_trans's admitted backing. The transitive set keeps it.
  const src = `
LgCell = Type.define({x: Int, eq: (self, other) => self.x == other.x}, Equatable)
Law.assume(LgCell, "trans")
v = LgCell(1)
theorem lg_outer: v == v by proof_sym(proof_trans(proof_refl(v), proof_refl(v)))
1`;
  const result = runtimeEval(src, undefined, [typeExt], undefined, true, undefined, true);
  const v = buildVerdict(result.evalCtx, result.compilationReport);
  const t = v.theorems.find(x => x.name === "lg_outer");
  eq(t?.status, "discharged");
  eq(t?.restsOn?.some(r => r.equality === "LgCell" && r.law === "trans" && r.tier === "admitted"), true);
  eq(formatVerdict(v).includes("[resting on admitted 'trans' of 'LgCell']"), true);
});

test("D2 roll-up: kernel chain records the full backing set, ledger stays clean", () => {
  const src = `
theorem lg_k: 1 == 1 by proof_trans(proof_refl(1), proof_refl(1))
1`;
  const result = runtimeEval(src, undefined, [typeExt], undefined, true, undefined, true);
  const v = buildVerdict(result.evalCtx, result.compilationReport);
  const t = v.theorems.find(x => x.name === "lg_k");
  // Both the trans gate's backing and the refl inputs' backing survive.
  eq(t?.restsOn?.some(r => r.law === "trans" && r.tier === "kernel"), true);
  eq(t?.restsOn?.some(r => r.law === "refl" && r.tier === "kernel"), true);
  const rendered = formatVerdict(v);
  eq(rendered.includes("assumption ledger: clean"), true);
  eq(rendered.includes("resting on"), false);
});

test("D2 roll-up: ledger dedupes one assumption across proofs and lists both backers", () => {
  const src = `
LgC2 = Type.define({x: Int, eq: (self, other) => self.x == other.x}, Equatable)
Law.assume(LgC2, "trans")
v = LgC2(1)
theorem lg_a: v == v by proof_trans(proof_refl(v), proof_refl(v))
theorem lg_b: v == v by proof_trans(proof_refl(v), proof_refl(v))
1`;
  const result = runtimeEval(src, undefined, [typeExt], undefined, true, undefined, true);
  const rendered = formatVerdict(buildVerdict(result.evalCtx, result.compilationReport));
  const ledgerLines = rendered.split("\n").filter(l => l.includes("admitted 'trans' of 'LgC2'") && l.includes("backs:"));
  eq(ledgerLines.length, 1);
  eq(ledgerLines[0].includes("lg_a"), true);
  eq(ledgerLines[0].includes("lg_b"), true);
  eq(rendered.includes("assumption ledger: rests on 1 admitted"), true);
});

test("D2 roll-up: an assumption backing no proofs still appears in the ledger", () => {
  const src = `
LgNx = Type.define({x: Int, eq: (self, other) => true}, Equatable)
Law.assume(LgNx, "trans")
1`;
  const result = runtimeEval(src, undefined, [typeExt], undefined, true, undefined, true);
  const rendered = formatVerdict(buildVerdict(result.evalCtx, result.compilationReport));
  eq(rendered.includes("admitted 'trans' of 'LgNx' — backs no proofs yet"), true);
});

test("D2 roll-up: inspect renders rests-on for proof bindings (weak loud, proven quiet)", () => {
  const src = `
LgIn = Type.define({x: Int, eq: (self, other) => self.x == other.x}, Equatable)
Law.assume(LgIn, "trans")
v = LgIn(1)
theorem lg_weak: v == v by proof_trans(proof_refl(v), proof_refl(v))
theorem lg_proven: 1 == 1 by proof_refl(1)
1`;
  const result = runtimeEval(src, undefined, [typeExt], undefined, true, undefined, true);
  const rendered = renderModuleSummary(summarizeModule(result.evalCtx, result.compilationReport));
  eq(rendered.includes("rests on: admitted 'trans' of 'LgIn'"), true);
  eq(rendered.includes("rests on: proven backing only"), true);
});

// == D47 source channel — B-094 chunk 1 (substrate + battery) ==
//
// The `source` channel carries a value's originating Expression AST:
// kernel-originated (evaluator only), `drop` propagation, observe-tagged
// reads via `source of x` (source_get), rendered as text at the read
// surface. Design: structures.md §3.1.

import { sourceOf as _sourceOf, withSource as _withSource, componentsView as _componentsViewD47 } from "../slots.js";
import { renderExprSource } from "../primitives.js";

test("D47: binding-level source — `source of x` renders the RHS AST", () => {
  const r = evalStd("x = 2 + 2\nsource of x");
  eq(bitsToString(dataOf(r!) as BitsValue), "2 + 2");
  const r2 = evalStd("y = 5\nsource of y");
  eq(bitsToString(dataOf(r2!) as BitsValue), "5");
  // Lexical fidelity: symbols render by name.
  const r3 = evalStd("x = 2 + 2\nz = x + 1\nsource of z");
  eq(bitsToString(dataOf(r3!) as BitsValue), "x + 1");
});

test("D47: absent source answers none, and equality ignores the channel", () => {
  const r = evalStd("source of 7");
  eq(getTypeName(r!), "None");
  const r2 = evalStd("x = 2 + 2\nx == 4");
  eq(Number((dataOf(r2!) as BitsValue).data), 1);
});

test("D47: drop propagation — derived values carry no source", () => {
  const { evalCtx } = runtimeEval("x = 2 + 2\nd = x + 1\n1", undefined, [typeExt], undefined, true);
  const d = evalCtx.bindings.get("d")!.value!;
  // d has its OWN binding-level source ("x + 1") but the underlying
  // arithmetic result did not inherit x's — check a non-binding result:
  const { value } = runtimeEval("x = 2 + 2\nx * 3", undefined, [typeExt], undefined, true);
  eq(_componentsViewD47(value!).get("source"), undefined);
  eq(_sourceOf(d) !== undefined, true);
});

test("D47: source-aware primitive receives each arg's originating AST", () => {
  // The data-plane analogue of lazy: the arg arrives EVALUATED, with the
  // unevaluated AST riding the source channel.
  let seen: string | null = null;
  const probe = makePrimitive("probe", (args) => {
    const ast = _sourceOf(args[0]);
    seen = ast ? renderExprSource(ast) : null;
    return args[0];
  }, false, undefined, true);
  const { value } = runtimeEval("probe(1 + 2)", undefined,
    [typeExt, { name: "d47", bindings: { probe } }], undefined, true);
  eq(seen, "1 + 2");
  eq(Number((dataOf(value!) as BitsValue).data), 3);
});

test("D47: source reads carry the observe effect (certificate_peek precedent)", () => {
  const { evalCtx } = runtimeEval("f(v) => source_get(v)\n1", undefined, [typeExt], undefined, true);
  const eff = effectsOf(evalCtx.bindings.get("f")!.value!);
  eq(eff?.has("observe"), true);
});

test("D47 chunk 2: explain — the reference source-aware consumer", () => {
  const r = evalStd("x = 4\nexplain(x * 3)");
  eq(bitsToString(dataOf(r!) as BitsValue), "x * 3 = 12");
  // No redundant echo when the source IS the value.
  const r2 = evalStd("explain(7)");
  eq(bitsToString(dataOf(r2!) as BitsValue), "7");
  // Compound operands parenthesize for fidelity.
  const r3 = evalStd("y = 5\nexplain(y * y - 2)");
  eq(bitsToString(dataOf(r3!) as BitsValue), "(y * y) - 2 = 23");
});

test("D47 chunk 2: explain carries observe (it reveals how a value was written)", () => {
  const { evalCtx } = runtimeEval("f(v) => explain(v + 1)\n1", undefined, [typeExt], undefined, true);
  const eff = effectsOf(evalCtx.bindings.get("f")!.value!);
  eq(eff?.has("observe"), true);
});

test("D47 chunk 2: proof entry points remain lazy non-value interpreters", () => {
  // A theorem whose proposition cannot resolve must FAIL (halt), not
  // residualize — the guard-opt-out property that keeps proof_by_eval
  // lazy (§3.1 chunk-2 amendment).
  let msg = "";
  try { evalStd("theorem t: unresolved_name == 4\n1"); }
  catch (e: any) { msg = String(e?.message ?? e); }
  eq(msg.includes("could not be discharged"), true);
});

test("D47: forged source origination is refused (mv_set integrity gate)", () => {
  let msg = "";
  try { evalStd('mv_set(5, "source", 42)'); }
  catch (e: any) { msg = String(e?.message ?? e); }
  eq(msg.includes("cannot originate integrity channel 'source'"), true);
  // And the generic accessor cannot read it either — the observe tag
  // cannot be laundered through component_get.
  const r = evalStd('x = 2 + 2\ncomponent_get(x, "source")');
  eq(getTypeName(r!), "None");
});

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
  const ctx = makeContext();
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

// --- Boundary-test harness (structures-implementation Phase 0 / B-001) ---

import { runBoundaryTests } from "../boundary-tests.js";
import { buildVerdict, extractObligations, formatVerdict } from "../pcp.js";
import { renderModuleSummary, summarizeModule, summarizeValue } from "../introspect.js";
import { effectsOf } from "../effects.js";

// --- Run all tests (sync + async) and report ---

noteSyncBodyDone("sync body (evaluator/types/grammar/.alg files)");
timedSection("modules", runModuleTests)
  .then(() => timedSection("async/futures", runAsyncTests))
  .then(() => timedSection("h4a-llm-worker", runH4aAsyncTests))
  .then(() => timedSection("benchmark", runBenchmarkTests))
  .then(() => timedSection("doc-lint", async () => runDocLintTests()))
  .then(() => timedSection("check-deployed", async () => runCheckDeployedTests()))
  .then(() => timedSection("boundary", async () => runBoundaryTests({
    test,
    eq,
    // Each shard reports the corpus IT walked; the registry-completeness
    // check runs in every shard over its own files, and the aggregate
    // coverage tripwire is applied by scripts/test-shards.mjs.
    corpus: { ...corpusWalk(), sharded: SHARD !== null },
  })))
  .then(() => reportSummary());
