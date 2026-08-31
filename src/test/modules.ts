// =============================================================================
// The module loader: resolution, caching, cycles, export encapsulation.
//
// Extracted from the single-file suite (suite split, lane B). Registrations
// run at import time; src/test/index.ts imports this module in suite order.
// =============================================================================

import { asyncTest, asyncThrows, eq } from "./harness.js";
import { typeExt } from "./fixtures.js";
import { evalSource as runtimeEval } from "../runtime.js";
import * as path from "path";
import * as fs from "fs";
import { ModuleLoader } from "../modules.js";
import { evalNumExt, evalStd } from "./fixtures.js";
import { exportedSymbols, symbolFromWire } from "../symbols.js";
import { Extension } from "../runtime.js";
import { BitsValue } from "../types.js";

// == Module Loader ==

export async function runModuleTests(): Promise<void> {
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
    eq(Number((pubResult! as BitsValue).data), 42);

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
    eq(Number((sqResult! as BitsValue).data), 25);

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

