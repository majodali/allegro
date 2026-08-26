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
  evalSource, evalStr, evalNum, evalNumExt, evalStd, typeExt, mathExtension, makeCtxWith,
} from "./fixtures.js";

// --- Area modules -----------------------------------------------------------
// Each registers its own tests at import time. Order here is suite order;
// shard assignment is by test NAME, so it does not depend on this list.
import "./types-core.js";
import "./types-battery.js";
import "./types-construction.js";
import "./equality-laws.js";

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
import * as path from "path";
import * as fs from "fs";
import { primNames, typeNames, fileTest, testsDir, corpusWalk } from "./alg-files.js";

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
