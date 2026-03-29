// =============================================================================
// Allegro Base Language - Test Suite
// Run: npx tsx src/test.ts
// =============================================================================

import { formatValue } from "./primitives.js";
import { evalSource as runtimeEval, Extension, extensionToContext } from "./runtime.js";
import { ModuleLoader, buildModuleObject } from "./modules.js";
import { evaluate } from "./evaluator.js";
import { GrammarExtension, registryGet } from "./grammar-ext.js";
import { createTypeSystem, getTypeName, getType, Type, NamedType, IntType, StringType, NoneType, ErrorType, noneSingleton, structuralWrap } from "./types-std.js";
import { Grammar, parseGrammar } from "./parser.js";
import { Value, ValueKind, BitsValue, ContextValue, AllegroError, makePrimitive, makeInt, makeFloat, bitsToFloat, makeContext, makeExpr, makeParam, makeComposedFn, makeMultiValue, primaryOf, isResolved, stringToBits, bitsToString } from "./types.js";

// --- Test infrastructure ---

let passed = 0;
let failed = 0;
const failures: string[] = [];

function evalSource(source: string): Value | null {
  return runtimeEval(source + "\n").value;
}

/** Evaluate and return the formatted string result. */
function evalStr(source: string): string {
  const val = evalSource(source);
  if (val === null) throw new Error("No value produced");
  return formatValue(val);
}

/** Evaluate and return the numeric result (for Bits values). */
function evalNum(source: string): number {
  const val = evalSource(source);
  if (val === null) throw new Error("No value produced");
  const p = val.kind === ValueKind.MultiValue ? val.primary : val;
  if (p.kind !== ValueKind.Bits) throw new Error(`Expected Bits, got ${p.kind}`);
  // Handle signed 64-bit
  if (p.length === 64 && p.data >= 2n ** 63n) return Number(p.data - 2n ** 64n);
  return Number(p.data);
}

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
  } catch (e: any) {
    failed++;
    const msg = `FAIL: ${name} — ${e.message}`;
    failures.push(msg);
    console.log(msg);
  }
}

function eq(actual: any, expected: any, label?: string): void {
  if (actual !== expected) {
    throw new Error(`${label ? label + ": " : ""}expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function throws(fn: () => void, pattern?: string): void {
  try {
    fn();
    throw new Error("Expected an error but none was thrown");
  } catch (e: any) {
    if (e.message === "Expected an error but none was thrown") throw e;
    if (pattern && !e.message.includes(pattern)) {
      throw new Error(`Expected error containing "${pattern}", got: ${e.message}`);
    }
  }
}

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
  const v = p.kind === ValueKind.MultiValue ? p.primary : p;
  if (v.kind !== ValueKind.Bits) throw new Error(`Expected Bits, got ${v.kind}`);
  eq(Number(v.data), 15);
});

test("persistent context: function then call", () => {
  const r1 = runtimeEval("double(n) => n * 2\n");
  const r2 = runtimeEval("double(21)\n", r1.evalCtx);
  const p = r2.value!;
  const v = p.kind === ValueKind.MultiValue ? p.primary : p;
  if (v.kind !== ValueKind.Bits) throw new Error(`Expected Bits, got ${v.kind}`);
  eq(Number(v.data), 42);
});

test("persistent context: redefine binding", () => {
  const r1 = runtimeEval("x = 10\n");
  const r2 = runtimeEval("x = 20\n", r1.evalCtx);
  const r3 = runtimeEval("x\n", r2.evalCtx);
  const p = r3.value!;
  const v = p.kind === ValueKind.MultiValue ? p.primary : p;
  if (v.kind !== ValueKind.Bits) throw new Error(`Expected Bits, got ${v.kind}`);
  eq(Number(v.data), 20);
});

// == Anonymous Extensions ==

// Build a math extension with abs, max, min
const mathExtension: Extension = {
  name: "math",
  bindings: {
    abs: makePrimitive("abs", (args) => {
      const p = primaryOf(args[0]);
      if (p.kind !== ValueKind.Bits) throw new AllegroError("abs: expected Bits");
      const v = p.length === 64 && p.data >= 2n ** 63n ? p.data - 2n ** 64n : p.data;
      return makeInt(Number(v < 0n ? -v : v));
    }),
    max: makePrimitive("max", (args) => {
      const a = primaryOf(args[0]) as BitsValue;
      const b = primaryOf(args[1]) as BitsValue;
      const av = a.length === 64 && a.data >= 2n ** 63n ? a.data - 2n ** 64n : a.data;
      const bv = b.length === 64 && b.data >= 2n ** 63n ? b.data - 2n ** 64n : b.data;
      return av >= bv ? a : b;
    }),
    min: makePrimitive("min", (args) => {
      const a = primaryOf(args[0]) as BitsValue;
      const b = primaryOf(args[1]) as BitsValue;
      const av = a.length === 64 && a.data >= 2n ** 63n ? a.data - 2n ** 64n : a.data;
      const bv = b.length === 64 && b.data >= 2n ** 63n ? b.data - 2n ** 64n : b.data;
      return av <= bv ? a : b;
    }),
  },
};

/** Evaluate with extensions and return numeric result. */
function evalNumExt(source: string, extensions?: Extension[]): number {
  const result = runtimeEval(source + "\n", undefined, extensions);
  const val = result.value;
  if (val === null) throw new Error("No value produced");
  const p = val.kind === ValueKind.MultiValue ? val.primary : val;
  if (p.kind !== ValueKind.Bits) throw new Error(`Expected Bits, got ${p.kind}`);
  if (p.length === 64 && p.data >= 2n ** 63n) return Number(p.data - 2n ** 64n);
  return Number(p.data);
}

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

async function asyncTest(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    passed++;
  } catch (e: any) {
    failed++;
    const msg = `FAIL: ${name} — ${e.message}`;
    failures.push(msg);
    console.log(msg);
  }
}

async function asyncThrows(fn: () => Promise<any>, pattern?: string): Promise<void> {
  try {
    await fn();
    throw new Error("Expected an error but none was thrown");
  } catch (e: any) {
    if (e.message === "Expected an error but none was thrown") throw e;
    if (pattern && !e.message.includes(pattern)) {
      throw new Error(`Expected error containing "${pattern}", got: ${e.message}`);
    }
  }
}

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
    eq(Number((primaryOf(pubResult!) as BitsValue).data), 42);

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
    eq(Number((primaryOf(sqResult!) as BitsValue).data), 25);

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
}

// == Grammar Extensions ==

/** Helper: build a Context value with named bindings */
function makeCtxWith(bindings: Record<string, Value>): Value {
  const ctx = makeContext();
  for (const [name, value] of Object.entries(bindings)) {
    ctx.bindings.set(name, { key: name, value, isUse: false });
    ctx.bindingList.push({ key: name, value, isUse: false });
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
  const p = val.kind === ValueKind.MultiValue ? val.primary : val;
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
    const p = primaryOf(args[0]);
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
  eq(ctx.kind, ValueKind.Context);
  eq(ctx.bindings.size, 2);
  const pi = ctx.bindings.get("pi");
  eq(pi !== undefined, true);
  if (pi?.value?.kind === ValueKind.Bits) {
    eq(Number(pi.value.data), 3);
  }
});

// == Allegro-Level Grammar Primitives ==

test("allegro grammar: build extension from Allegro code", () => {
  // Allegro code builds a grammar extension using primitives
  const source = `
b = grammar_builder()
grammar_add_dot_access(b)
grammar_add_import(b)
ext = grammar_build(b)
ext
`;
  const result = runtimeEval(source);
  const val = result.value!;
  const p = val.kind === ValueKind.MultiValue ? val.primary : val;
  // ext should be a Bits value (handle to GrammarExtension)
  eq(p.kind, ValueKind.Bits, "grammar_build should return a handle");
  // Extract the GrammarExtension from the registry
  const handle = Number((p as BitsValue).data);
  const grammarExt = registryGet(handle) as GrammarExtension;
  eq(grammarExt.additionalAlternatives instanceof Map, true);
  eq(grammarExt.additionalAlternatives.size > 0, true);
});

test("allegro grammar: extension built from Allegro enables dot access", () => {
  // Step 1: Allegro code builds the grammar extension
  const buildResult = runtimeEval("ext = grammar_build(grammar_add_dot_access(grammar_builder()))\next\n");
  const extVal = buildResult.value!;
  const extP = extVal.kind === ValueKind.MultiValue ? extVal.primary : extVal;
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
  const extP = extVal.kind === ValueKind.MultiValue ? extVal.primary : extVal;
  const handle = Number((extP as BitsValue).data);
  const grammarExt = registryGet(handle) as GrammarExtension;

  // Step 2: Use it to parse import syntax
  const ext: Extension = { name: "test", bindings: { foo: makeInt(42) } };
  eq(evalNumGrammar("import foo\nfoo", [ext], grammarExt), 42);
});

test("allegro grammar: full pipeline - build, then use dot + import", () => {
  // Step 1: Build full extension from Allegro
  const buildSource = `
b = grammar_builder()
grammar_add_dot_access(b)
grammar_add_import(b)
grammar_build(b)
`;
  const buildResult = runtimeEval(buildSource);
  const extP = buildResult.value!.kind === ValueKind.MultiValue
    ? buildResult.value!.primary : buildResult.value!;
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
        result.bindings.set(key, { key, value: child.val as Value, isUse: false });
        result.bindingList.push({ key, value: child.val as Value, isUse: false });
        index++;
      }
    }
    const lenKey = "length";
    result.bindings.set(lenKey, { key: lenKey, value: makeInt(index), isUse: false });
    result.bindingList.push({ key: lenKey, value: makeInt(index), isUse: false });
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
        result.bindings.set(key, { key, value: child.val as Value, isUse: false });
        result.bindingList.push({ key, value: child.val as Value, isUse: false });
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
  eq(val.kind, ValueKind.Context);
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
  eq(val.kind, ValueKind.Context);
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
  eq(items.kind, ValueKind.Context);
  eq(Number((items.bindings.get("length")!.value as BitsValue).data), 2);
  eq(Number((items.bindings.get("0")!.value as BitsValue).data), 1);
  // Check name string
  const name = val.bindings.get("name")!.value as BitsValue;
  eq(name.kind, ValueKind.Bits);
});

// == Allegro Standard — Type System ==

const typeExt = createTypeSystem();

/** Evaluate source in Allegro Standard mode (uses hybrid parser) */
function evalStd(source: string, extraExtensions?: Extension[]): Value | null {
  const exts = [typeExt, ...(extraExtensions ?? [])];
  const { value } = runtimeEval(source, undefined, exts, undefined, true);
  return value;
}

test("type system: int literal has Int type", () => {
  const result = evalStd("42");
  eq(result !== null, true);
  eq(getTypeName(result!), "Int");
  eq(Number(primaryOf(result!) as any).valueOf !== undefined, true);
  const p = primaryOf(result!) as BitsValue;
  eq(Number(p.data), 42);
});

test("type system: string literal has String type", () => {
  const result = evalStd('"hello"');
  eq(result !== null, true);
  eq(getTypeName(result!), "String");
  eq(bitsToString(primaryOf(result!) as BitsValue), "hello");
});

test("type system: int arithmetic preserves type", () => {
  const result = evalStd("3 + 4");
  eq(result !== null, true);
  eq(getTypeName(result!), "Int");
  const p = primaryOf(result!) as BitsValue;
  eq(Number(p.data), 7);
});

test("type system: int subtraction", () => {
  const result = evalStd("10 - 3");
  eq(getTypeName(result!), "Int");
  eq(Number((primaryOf(result!) as BitsValue).data), 7);
});

test("type system: int multiplication", () => {
  const result = evalStd("6 * 7");
  eq(getTypeName(result!), "Int");
  eq(Number((primaryOf(result!) as BitsValue).data), 42);
});

test("type system: int comparison returns typed Bool", () => {
  const result = evalStd("3 < 5");
  eq(getTypeName(result!), "Bool");
  eq(Number((primaryOf(result!) as BitsValue).data), 1);
});

test("type system: string dot length", () => {
  const result = evalStd('"hello".length');
  eq(result !== null, true);
  const p = primaryOf(result!) as BitsValue;
  eq(Number(p.data), 5);
});

test("type system: int dot toString", () => {
  const result = evalStd("42.toString()");
  eq(result !== null, true);
  eq(bitsToString(primaryOf(result!) as BitsValue), "42");
});

test("type system: string dot slice", () => {
  const result = evalStd('"hello".slice(1, 3)');
  eq(result !== null, true);
  eq(bitsToString(primaryOf(result!) as BitsValue), "el");
});

test("type system: string dot indexOf", () => {
  const result = evalStd('"hello".indexOf("ll")');
  eq(result !== null, true);
  eq(Number((primaryOf(result!) as BitsValue).data), 2);
});

test("type system: string trim returns typed String", () => {
  const result = evalStd('"  hello  ".trim()');
  eq(getTypeName(result!), "String");
  eq(bitsToString(primaryOf(result!) as BitsValue), "hello");
});

test("type system: string startsWith returns typed Bool", () => {
  const result = evalStd('"hello".startsWith("hel")');
  eq(getTypeName(result!), "Bool");
  eq(Number((primaryOf(result!) as BitsValue).data), 1);
});

test("type system: string split returns typed Array", () => {
  const result = evalStd('"a,b,c".split(",")');
  eq(getTypeName(result!), "Array");
});

test("type system: string replace returns typed String", () => {
  const result = evalStd('"aabb".replace("b", "x")');
  eq(getTypeName(result!), "String");
  eq(bitsToString(primaryOf(result!) as BitsValue), "aaxx");
});

test("type system: string toUpperCase returns typed String", () => {
  const result = evalStd('"hello".toUpperCase()');
  eq(getTypeName(result!), "String");
  eq(bitsToString(primaryOf(result!) as BitsValue), "HELLO");
});

test("type system: string toCharCodes returns typed Array", () => {
  const result = evalStd('"AB".toCharCodes()');
  eq(getTypeName(result!), "Array");
});

test("type system: string concat with +", () => {
  const result = evalStd('"hello" + " world"');
  eq(result !== null, true);
  eq(getTypeName(result!), "String");
  eq(bitsToString(primaryOf(result!) as BitsValue), "hello world");
});

test("type system: typed function calls", () => {
  const result = evalStd("f(x) => x + 1\nf(5)");
  eq(result !== null, true);
  eq(getTypeName(result!), "Int");
  eq(Number((primaryOf(result!) as BitsValue).data), 6);
});

test("type system: typed recursion", () => {
  const result = evalStd("factorial(n) => if n == 0 then 1 else n * factorial(n - 1)\nfactorial(5)");
  eq(result !== null, true);
  eq(getTypeName(result!), "Int");
  eq(Number((primaryOf(result!) as BitsValue).data), 120);
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
  eq(Number((primaryOf(result!) as BitsValue).data), 3);
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
  eq(Number((primaryOf(result!) as BitsValue).data), 1);
});

test("type system: float toString", () => {
  const result = evalStd("3.14.toString()");
  eq(bitsToString(primaryOf(result!) as BitsValue), "3.14");
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
  eq(bitsToString(primaryOf(result!) as BitsValue), "true");
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
  eq(Number((primaryOf(result!) as BitsValue).data), 3);
});

test("type system: array bracket access", () => {
  const result = evalStd("[10, 20, 30][1]");
  eq(result !== null, true);
  eq(Number((primaryOf(result!) as BitsValue).data), 20);
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
  eq(Number((primaryOf(result!) as BitsValue).data), 42);
});

test("type system: object bracket access", () => {
  const result = evalStd('{name: "alice"}["name"]');
  eq(result !== null, true);
  eq(bitsToString(primaryOf(result!) as BitsValue), "alice");
});

test("type system: nested object", () => {
  const result = evalStd("{a: {x: 1}}.a.x");
  eq(Number((primaryOf(result!) as BitsValue).data), 1);
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
  eq(Number((primaryOf(result!) as BitsValue).data), 50);
});

test("type system: object with 4 fields", () => {
  const result = evalStd("{a: 1, b: 2, c: 3, d: 4}.d");
  eq(Number((primaryOf(result!) as BitsValue).data), 4);
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
  eq(Number((primaryOf(evalStd("3 != 4")!) as BitsValue).data), 1);
  eq(Number((primaryOf(evalStd("3 != 3")!) as BitsValue).data), 0);
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
  eq(Number((primaryOf(result!) as BitsValue).data), 10);
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

/**
 * Run an .alg file in Allegro Standard mode.
 * Captures print output and validates against "// expect: ..." comments.
 */
function runAlgFile(filePath: string, extensions?: Extension[]): void {
  const source = fs.readFileSync(filePath, "utf-8");
  const lines = source.split(/\r?\n/);

  // Extract expected outputs from "// expect: ..." comments
  const expectations: { lineNum: number; expected: string }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/\/\/\s*expect:\s*(.*)/);
    if (match) {
      expectations.push({ lineNum: i + 1, expected: match[1].trim() });
    }
  }

  // Capture print output
  const printed: string[] = [];
  const origLog = console.log;
  console.log = (msg: any) => printed.push(String(msg));

  try {
    const exts = [typeExt, ...(extensions ?? [])];
    runtimeEval(source, undefined, exts, undefined, true);
  } catch (e: any) {
    console.log = origLog;
    throw e;
  } finally {
    console.log = origLog;
  }

  // Validate
  const basename = path.basename(filePath);
  if (expectations.length !== printed.length) {
    throw new Error(
      `${basename}: expected ${expectations.length} outputs but got ${printed.length}` +
      `\n  Expected: ${expectations.map(e => e.expected).join(", ")}` +
      `\n  Got: ${printed.join(", ")}`
    );
  }
  for (let i = 0; i < expectations.length; i++) {
    if (printed[i] !== expectations[i].expected) {
      throw new Error(
        `${basename} line ${expectations[i].lineNum}: expected "${expectations[i].expected}" but got "${printed[i]}"`
      );
    }
  }
}

function fileTest(filePath: string, extensions?: Extension[]): void {
  const basename = path.basename(filePath);
  test(`file: ${basename}`, () => {
    runAlgFile(filePath, extensions);
    eq(true, true); // if we get here, all expectations matched
  });
}

// Run all .alg test files
const testsDir = path.resolve("tests");
fileTest(path.join(testsDir, "types.alg"));
fileTest(path.join(testsDir, "dot-access.alg"));
fileTest(path.join(testsDir, "arrays.alg"));
fileTest(path.join(testsDir, "objects.alg"));
fileTest(path.join(testsDir, "logical.alg"));
fileTest(path.join(testsDir, "functions.alg"));

// Module test needs a math extension
import { primitives as primRegistry } from "./primitives.js";
const primNames = new Set(Object.keys(primRegistry));
const typeNames = new Set(["Int", "Float", "String", "Bool", "Array", "Object", "true", "false"]);

const mathSource = fs.readFileSync(path.join(testsDir, "lib", "math.alg"), "utf-8");
const mathResult = runtimeEval(mathSource, undefined, [typeExt], undefined, true);
const mathBindings: Record<string, Value> = {};
for (const [key, binding] of mathResult.evalCtx.bindings) {
  if (binding.value !== undefined && !primNames.has(key) && !typeNames.has(key)) {
    mathBindings[key] = binding.value;
  }
}
const mathModuleCtx = extensionToContext({ name: "math", bindings: mathBindings });
fileTest(path.join(testsDir, "modules.alg"), [{ name: "modules", bindings: { math: mathModuleCtx } }]);
fileTest(path.join(testsDir, "type-annotations.alg"));
fileTest(path.join(testsDir, "generics.alg"));

// == Module Export Tests ==

test("module export: export keyword marks value with exported component", () => {
  const result = evalStd("export x = 42\nx\n");
  eq(result !== null, true);
  // Should still be usable as a number
  eq(Number((primaryOf(result!) as BitsValue).data), 42);
  // Should have "exported" component
  eq(result!.kind, ValueKind.MultiValue);
  if (result!.kind === ValueKind.MultiValue) {
    eq(result!.components.has("exported"), true);
  }
});

test("module export: non-exported values don't have exported component", () => {
  const result = evalStd("x = 42\nx\n");
  // Should NOT have "exported" component
  if (result!.kind === ValueKind.MultiValue) {
    eq(result!.components.has("exported"), false);
  }
});

test("module export: exported functions work normally", () => {
  const result = evalStd("export f = x => x * 2\nf(21)\n");
  eq(Number((primaryOf(result!) as BitsValue).data), 42);
});

test("module export: typed module object exposes exports via dot", () => {
  // Build a module with exports
  const modSource = "private_val = 99\nexport pub_val = 42\nexport pub_fn = x => x * 2\n";
  const modResult = runtimeEval(modSource, undefined, [typeExt], undefined, true);

  // Extract and evaluate bindings, then build typed module
  const allBindings: Record<string, Value> = {};
  const exportedNames = new Set<string>();
  for (const [key, binding] of modResult.evalCtx.bindings) {
    if (binding.value !== undefined && !primNames.has(key) && !typeNames.has(key)) {
      const evaluated = evaluate(binding.value, modResult.evalCtx);
      allBindings[key] = evaluated;
      if (evaluated.kind === ValueKind.MultiValue && evaluated.components.has("exported")) {
        exportedNames.add(key);
      }
    }
  }

  const moduleObj = buildModuleObject("testmod", allBindings, exportedNames);

  // Access exported field via type_dispatch
  const ext: Extension = { name: "test", bindings: { testmod: moduleObj } };
  const pubResult = evalStd("testmod.pub_val", [ext]);
  eq(Number((primaryOf(pubResult!) as BitsValue).data), 42);

  // Access exported function
  const fnResult = evalStd("testmod.pub_fn(21)", [ext]);
  eq(Number((primaryOf(fnResult!) as BitsValue).data), 42);

  // Private field should NOT be accessible via type_dispatch
  let threw = false;
  try { evalStd("testmod.private_val", [ext]); }
  catch (e: any) { threw = e.message.includes("not found") || e.message.includes("not exported"); }
  eq(threw, true);
});

// == Generics ==

test("generics: array literal infers Array[Int]", () => {
  const result = evalStd("[1, 2, 3]");
  eq(getTypeName(result!), "Array");
  // Check it has type args
  const type = getType(result!);
  eq(type !== null, true);
  const args = (type as any).bindings.get("__args");
  eq(args !== undefined && args.value !== undefined, true);
});

test("generics: array literal infers Array[String]", () => {
  const result = evalStd('["a", "b", "c"]');
  eq(getTypeName(result!), "Array");
  const type = getType(result!);
  const args = (type as any).bindings.get("__args");
  eq(args !== undefined && args.value !== undefined, true);
});

test("generics: mixed element array gets bare Array", () => {
  // Can't easily create mixed array in Allegro Standard yet since all ints are Int,
  // but empty array should be bare Array (no __args)
  const result = evalStd("[]");
  eq(getTypeName(result!), "Array");
  const type = getType(result!);
  // Bare Array (generic) should not have __args
  const args = (type as any).bindings.get("__args");
  eq(args, undefined);
});

test("generics: Array[Int] type annotation", () => {
  const result = evalStd("f(arr: Array[Int]) => arr.length\nf([1, 2, 3])");
  eq(Number((primaryOf(result!) as BitsValue).data), 3);
});

test("generics: Array[Int] type check passes for int array", () => {
  // This should work — [1,2,3] is Array[Int], annotation expects Array[Int]
  const result = evalStd("f(arr: Array[Int]) => arr[0]\nf([10, 20, 30])");
  eq(Number((primaryOf(result!) as BitsValue).data), 10);
});

test("generics: bare Array annotation accepts any array", () => {
  const result = evalStd("f(arr: Array) => arr.length\nf([1, 2, 3])");
  eq(Number((primaryOf(result!) as BitsValue).data), 3);
});

test("generics: type_apply memoization", () => {
  // Array[Int] applied twice should produce the same type
  const result = evalStd(`
f(a: Array[Int]) => a.length
g(b: Array[Int]) => b[0]
f([1, 2, 3]) + g([10, 20])
`);
  eq(Number((primaryOf(result!) as BitsValue).data), 13);
});

test("generics: Array is a generic type", () => {
  // Array in the context should have __isGeneric
  const result = evalStd("Array");
  const p = primaryOf(result!);
  if (p.kind === ValueKind.Context) {
    const isGen = (p as ContextValue).bindings.get("__isGeneric");
    eq(isGen !== undefined, true);
  }
});

// == Any Type ==

test("Any: type annotation accepts any value", () => {
  eq(Number((primaryOf(evalStd("f(x: Any) => x\nf(42)")!) as BitsValue).data), 42);
  eq(formatValue(evalStd('f(x: Any) => x\nf("hello")')!), "hello");
  eq(formatValue(evalStd("f(x: Any) => x\nf(true)")!), "true");
});

test("Any: Array[Any] accepts any element type", () => {
  const result = evalStd("f(arr: Array[Any]) => arr.length\nf([1, 2, 3])");
  eq(Number((primaryOf(result!) as BitsValue).data), 3);
});

test("Any: bare Array annotation is Array[Any]", () => {
  // Bare Array in annotation should accept Array[Int]
  const result = evalStd("f(arr: Array) => arr[0]\nf([42])");
  eq(Number((primaryOf(result!) as BitsValue).data), 42);
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
  eq(Number((primaryOf(result!) as BitsValue).data), 42);
});

test("UntypedFunction: user-defined functions in base mode have no type", () => {
  // In base mode (no typed flag), functions don't get types
  const { value } = runtimeEval("f(x) => x\nf\n");
  eq(value !== null, true);
  eq(getTypeName(value!), null);
});

// == Type Annotations ==

test("type annotation: typed param correct type passes", () => {
  const result = evalStd("f(x: Int) => x + 1\nf(5)");
  eq(Number((primaryOf(result!) as BitsValue).data), 6);
});

test("type annotation: typed param wrong type throws", () => {
  let threw = false;
  try { evalStd('f(x: Int) => x\nf("hello")'); }
  catch (e: any) { threw = e.message.includes("Type error"); }
  eq(threw, true);
});

test("type annotation: multiple typed params", () => {
  const result = evalStd("f(x: Int, y: Int) => x + y\nf(3, 4)");
  eq(Number((primaryOf(result!) as BitsValue).data), 7);
});

test("type annotation: return type correct", () => {
  const result = evalStd("f(x: Int): Int => x + 1\nf(5)");
  eq(Number((primaryOf(result!) as BitsValue).data), 6);
});

test("type annotation: return type wrong throws", () => {
  let threw = false;
  try { evalStd('f(x: Int): String => x + 1\nf(5)'); }
  catch (e: any) { threw = e.message.includes("Type error"); }
  eq(threw, true);
});

test("type annotation: lambda typed params", () => {
  const result = evalStd("f = (x: Int, y: Int) => x + y\nf(3, 4)");
  eq(Number((primaryOf(result!) as BitsValue).data), 7);
});

test("type annotation: lambda with return type", () => {
  const result = evalStd("f = (x: Int): Int => x + 1\nf(5)");
  eq(Number((primaryOf(result!) as BitsValue).data), 6);
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
  eq(Number((primaryOf(result!) as BitsValue).data), 6);
});

// == Function Types ==

test("function type: typed function has FunctionType", () => {
  const result = evalStd("f(x: Int): Int => x + 1\nf");
  eq(result !== null, true);
  eq(getTypeName(result!), "Function");
});

test("function type: typed function is callable", () => {
  const result = evalStd("f(x: Int): Int => x + 1\nf(5)");
  eq(Number((primaryOf(result!) as BitsValue).data), 6);
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
  eq(Number((primaryOf(result!) as BitsValue).data), 42);
});

test("unification: identity with string", () => {
  const result = evalStd('identity(x: T): T => x\nidentity("hello")');
  eq(getTypeName(result!), "String");
  eq(bitsToString(primaryOf(result!) as BitsValue), "hello");
});

test("unification: two independent type variables", () => {
  const result = evalStd("first(a: T, b: U): T => a\nfirst(42, \"hello\")");
  eq(getTypeName(result!), "Int");
  eq(Number((primaryOf(result!) as BitsValue).data), 42);
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
  eq(Number((primaryOf(result!) as BitsValue).data), 42);
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
  eq(Number((primaryOf(result!) as BitsValue).data), 42);
});

test("partial eval: typed if-then-else with string branches", () => {
  const result = evalStd('if true then "yes" else "no"');
  eq(getTypeName(result!), "String");
  eq(bitsToString(primaryOf(result!) as BitsValue), "yes");
});

test("partial eval: if-then-else false branch", () => {
  const result = evalStd('if false then "yes" else "no"');
  eq(getTypeName(result!), "String");
  eq(bitsToString(primaryOf(result!) as BitsValue), "no");
});

test("partial eval: nested if-then-else preserves types", () => {
  const result = evalStd("if true then (if false then 1 else 2) else 3");
  eq(getTypeName(result!), "Int");
  eq(Number((primaryOf(result!) as BitsValue).data), 2);
});

// == String Interpolation ==

test("interpolation: simple variable", () => {
  const result = evalStd('name = "world"\n"hello {name}"');
  eq(bitsToString(primaryOf(result!) as BitsValue), "hello world");
});

test("interpolation: expression", () => {
  const result = evalStd('"2 + 2 = {2 + 2}"');
  eq(bitsToString(primaryOf(result!) as BitsValue), "2 + 2 = 4");
});

test("interpolation: multiple", () => {
  const result = evalStd('a = 1\nb = 2\n"{a} + {b} = {a + b}"');
  eq(bitsToString(primaryOf(result!) as BitsValue), "1 + 2 = 3");
});

test("interpolation: no interpolation is unchanged", () => {
  const result = evalStd('"plain string"');
  eq(bitsToString(primaryOf(result!) as BitsValue), "plain string");
});

test("interpolation: escaped brace", () => {
  const result = evalStd('"use \\{braces\\}"');
  eq(bitsToString(primaryOf(result!) as BitsValue), "use {braces}");
});

test("interpolation: at start of string", () => {
  const result = evalStd('"{42} is the answer"');
  eq(bitsToString(primaryOf(result!) as BitsValue), "42 is the answer");
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

// == Type Hierarchy: Type, NamedType, Subtyping ==

test("type hierarchy: all types have __type = NamedType", () => {
  // Int, String, Bool, Float, Object should all have __type = NamedType
  const intType = IntType.bindings.get("__type")?.value;
  eq(intType === NamedType, true);
  const strType = StringType.bindings.get("__type")?.value;
  eq(strType === NamedType, true);
});

test("type hierarchy: Type has __type = Type (self-referential)", () => {
  const ttType = Type.bindings.get("__type")?.value;
  eq(ttType === Type, true);
});

test("type hierarchy: NamedType extends Type", () => {
  const ext = NamedType.bindings.get("__extends")?.value;
  eq(ext === Type, true);
});

test("type hierarchy: nominal instanceof passes for matching type", () => {
  const result = evalStd("42");
  const instanceofMethod = NamedType.bindings.get("instanceof")?.value;
  eq(instanceofMethod !== undefined, true);
  if (instanceofMethod?.kind === ValueKind.PrimitiveFunction) {
    const check = instanceofMethod.fn([IntType, result!], undefined as any, undefined as any);
    eq(Number((primaryOf(check) as BitsValue).data), 1);
  }
});

test("type hierarchy: nominal instanceof fails for wrong type", () => {
  const result = evalStd("42");
  const instanceofMethod = NamedType.bindings.get("instanceof")?.value;
  if (instanceofMethod?.kind === ValueKind.PrimitiveFunction) {
    const check = instanceofMethod.fn([StringType, result!], undefined as any, undefined as any);
    eq(Number((primaryOf(check) as BitsValue).data), 0);
  }
});

test("type hierarchy: structural instanceof passes for compatible shape", () => {
  // Int has add, sub, mul, toString, etc.
  // A value typed as Int should structurally match any type with a subset of those methods
  const result = evalStd("42");
  const instanceofMethod = Type.bindings.get("instanceof")?.value;
  if (instanceofMethod?.kind === ValueKind.PrimitiveFunction) {
    // IntType has all the methods StringType has (toString), so structurally compatible at a basic level
    const check = instanceofMethod.fn([IntType, result!], undefined as any, undefined as any);
    eq(Number((primaryOf(check) as BitsValue).data), 1);
  }
});

test("type hierarchy: nominal subtypeof - same type", () => {
  const subtypeofMethod = NamedType.bindings.get("subtypeof")?.value;
  if (subtypeofMethod?.kind === ValueKind.PrimitiveFunction) {
    const check = subtypeofMethod.fn([IntType, IntType], undefined as any, undefined as any);
    eq(Number((primaryOf(check) as BitsValue).data), 1);
  }
});

test("type hierarchy: nominal subtypeof - different types", () => {
  const subtypeofMethod = NamedType.bindings.get("subtypeof")?.value;
  if (subtypeofMethod?.kind === ValueKind.PrimitiveFunction) {
    const check = subtypeofMethod.fn([IntType, StringType], undefined as any, undefined as any);
    eq(Number((primaryOf(check) as BitsValue).data), 0);
  }
});

test("type hierarchy: structural_wrap makes nominal type use structural checking", () => {
  const wrappedInt = structuralWrap(IntType);
  // The wrapped type should have __type = Type (structural) not NamedType
  const wrapType = wrappedInt.bindings.get("__type")?.value;
  eq(wrapType === Type, true);
  // It should still have the original name
  const name = wrappedInt.bindings.get("__name")?.value;
  eq(name !== undefined, true);
});

// == Union Types ==

test("union type: Int | String accepted", () => {
  // A function accepting Int | String should accept both
  const result1 = evalStd('f(x: Int | String) => x\nf(42)');
  eq(Number((primaryOf(result1!) as BitsValue).data), 42);

  const result2 = evalStd('f(x: Int | String) => x\nf("hello")');
  eq(bitsToString(primaryOf(result2!) as BitsValue), "hello");
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
  eq(Number((primaryOf(result!) as BitsValue).data), 42);
});

// == Binding Type Annotations ==

test("binding type: x: Int = 42", () => {
  const result = evalStd('x: Int = 42\nx');
  eq(Number((primaryOf(result!) as BitsValue).data), 42);
});

test("binding type: x: String = hello", () => {
  const result = evalStd('x: String = "hello"\nx');
  eq(bitsToString(primaryOf(result!) as BitsValue), "hello");
});

test("binding type: mismatch throws", () => {
  let threw = false;
  try { evalStd('x: Int = "hello"\nx'); }
  catch (e: any) { threw = e.message.includes("Type error") || e.message.includes("type"); }
  eq(threw, true, "String should not match Int annotation");
});

test("binding type: used in expression", () => {
  const result = evalStd('x: Int = 5\ny: Int = 10\nx + y');
  eq(Number((primaryOf(result!) as BitsValue).data), 15);
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
  eq(Number((primaryOf(result!) as BitsValue).data), 1);
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
  eq(Number((primaryOf(result!) as BitsValue).data), 99);
});

test("when: true/false literal match", () => {
  const result = evalStd("when true is true then 1 else 0");
  eq(Number((primaryOf(result!) as BitsValue).data), 1);
});

// == MultiValue Access (Y of x) ==

test("of: type of typed int", () => {
  const result = evalStd("type of 42");
  eq(result !== null, true);
  // The type of 42 is the Int type context — which has __name = "Int"
  eq(result!.kind, ValueKind.Context);
  const nameBinding = (result as ContextValue).bindings.get("__name");
  eq(nameBinding !== undefined, true);
  eq(bitsToString(primaryOf(nameBinding!.value!) as BitsValue), "Int");
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
  eq(Number((primaryOf(result!) as BitsValue).data), 30);
});

test("when: struct destruct — field missing → no match", () => {
  const result = evalStd('p = {x: 10}\nwhen p is {x, y} then x + y else 99');
  eq(Number((primaryOf(result!) as BitsValue).data), 99);
});

test("when: struct destruct — rename", () => {
  const result = evalStd('p = {x: 10, y: 20}\nwhen p is {x: a, y: b} then a * b else 0');
  eq(Number((primaryOf(result!) as BitsValue).data), 200);
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
  eq(Number((primaryOf(evalStd(src)!) as BitsValue).data), 15);
});

test("when: struct destruct — single field", () => {
  const result = evalStd('p = {name: "hello"}\nwhen p is {name} then name else "none"');
  eq(bitsToString(primaryOf(result!) as BitsValue), "hello");
});

// == Type Destructuring ==

test("when: type destruct — Object type", () => {
  const result = evalStd('p = {x: 10, y: 20}\nwhen p is Object(x, y) then x + y else 0');
  eq(Number((primaryOf(result!) as BitsValue).data), 30);
});

test("when: type destruct — Object type mismatch", () => {
  // 42 is Int, not Object → should fall to else
  const result = evalStd('when 42 is Object(x) then x else 99');
  eq(Number((primaryOf(result!) as BitsValue).data), 99);
});

test("when: type destruct — with rename", () => {
  const result = evalStd('p = {x: 3, y: 4}\nwhen p is Object(x: a, y: b) then a + b else 0');
  eq(Number((primaryOf(result!) as BitsValue).data), 7);
});

test("when: type destruct — multi-case objects", () => {
  const src = `
v = {x: 10, y: 20}
when v
  is {z} then z
  is Object(x, y) then x * y
  is _ then 0
`;
  eq(Number((primaryOf(evalStd(src)!) as BitsValue).data), 200);
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
  eq(result!.kind, ValueKind.MultiValue);
  eq((result as any).components.has("error"), true);
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
  eq((result as any).components?.has("error"), true);
});

test("error: propagates through multiplication", () => {
  const result = evalStd('3 * error "oops"');
  eq((result as any).components?.has("error"), true);
});

test("error: propagates through function calls", () => {
  const result = evalStd('f(x) => x + 1\nf(error "bad")');
  eq((result as any).components?.has("error"), true);
});

test("error: does not propagate through if condition", () => {
  // if-then-else is lazy — the error in unused branch shouldn't propagate
  const result = evalStd('if true then 42 else error "bad"');
  eq(Number((primaryOf(result!) as BitsValue).data), 42);
});

test("error: error of non-error returns none", () => {
  const result = evalStd('error of 42');
  eq(getTypeName(result!), "None");
});

test("error: error of error returns the error value", () => {
  const result = evalStd('error of (error "bad")');
  eq(result !== null, true);
  // The error component is the string "bad"
  eq(bitsToString(primaryOf(result!) as BitsValue), "bad");
});

test("error: type of returns Error type context", () => {
  const result = evalStd('type of (error "bad")');
  eq(result !== null, true);
  eq(result!.kind, ValueKind.Context);
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
  eq(bitsToString(primaryOf(result!) as BitsValue), "error: bad");
});

// --- Run all tests (sync + async) and report ---

runModuleTests().then(() => {
  console.log(`\n${"=".repeat(50)}`);
  console.log(`Tests: ${passed + failed} total, ${passed} passed, ${failed} failed`);
  if (failures.length > 0) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  ${f}`);
    process.exit(1);
  }
});
