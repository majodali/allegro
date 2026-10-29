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
import { ModuleLoader, forgetLibrary } from "../modules.js";
import { scanImports } from "../use-scanner.js";
import { libExtensions } from "./alg-files.js";
import { evalNumExt, evalStd } from "./fixtures.js";
import { exportedSymbols, symbolFromWire } from "../symbols.js";
import { Extension } from "../runtime.js";
import { BitsValue, Value } from "../types.js";
import { effectsOf } from "../effects.js";
import { metaFieldList, metaReadRaw } from "../metadata.js";
import { asStructure, getMembers } from "../slot-accessors.js";

// == Module Loader ==

/** B-158: evaluate a typed program and answer what it printed, one entry
 *  per `print`, or the first line of the error that halted it. */
function runCapturing(src: string, exts: Extension[]): string {
  const out: string[] = [];
  const orig = console.log;
  console.log = (...a: unknown[]) => { out.push(a.map(String).join(" ")); };
  try {
    runtimeEval(src, undefined, exts, undefined, true);
  } catch (e: any) {
    out.push("ERROR: " + String(e?.message ?? e).split("\n").slice(0, 2).join(" "));
  } finally {
    console.log = orig;
  }
  return out.join(" ; ");
}

/** B-158: a structural snapshot of the host plane of every value the given
 *  extensions bind (and of each module object's fields): each own field by
 *  value or by object identity, a Set's contents, the metadata fields by
 *  identity, the effect set, and a type's member keys with their values by
 *  identity. Identities are numbered by one table per snapshotter, so two
 *  snapshots compare entry by entry. Excluded: the derived caches a read
 *  builds on first access (`_view`, `_positional` in `src/structure.ts`;
 *  the members' lazy `memberNameIndex` is not on the value itself). */
function hostPlaneSnapshotter(exts: Extension[]): () => Map<string, string> {
  const ids = new Map<object, number>();
  const id = (o: object): string => {
    let n = ids.get(o);
    if (n === undefined) { n = ids.size; ids.set(o, n); }
    return `#${n}`;
  };
  const show = (x: unknown): string => {
    if (x === null || typeof x !== "object") return typeof x === "function" ? `fn${id(x as object)}` : String(x);
    if (x instanceof Set) return `${id(x)}{${[...x].map(String).sort().join(",")}}`;
    return id(x);
  };
  const CACHES = new Set(["_view", "_positional"]);
  const record = (out: Map<string, string>, at: string, v: Value): void => {
    for (const k of Object.keys(v).sort()) {
      if (!CACHES.has(k)) out.set(`${at} .${k}`, show((v as any)[k]));
    }
    for (const f of metaFieldList(v).sort()) out.set(`${at} meta:${f}`, show(metaReadRaw(v, f)));
    out.set(`${at} effects`, [...(effectsOf(v) ?? [])].sort().join(","));
    const asType = asStructure(v);
    const members = asType ? asStructure(getMembers(asType)) : null;
    if (members) {
      out.set(`${at} members`, [...members.bindings.keys()].sort().join(" "));
      for (const [k, b] of members.bindings) out.set(`${at} member ${k}`, show(b.value));
    }
  };
  return () => {
    const out = new Map<string, string>();
    for (const ext of exts) {
      for (const [name, v] of Object.entries(ext.bindings)) record(out, `${ext.name}.${name}`, v);
      const mo = asStructure(ext.moduleObject);
      if (mo) for (const [k, b] of mo.bindings) if (b.value) record(out, `${ext.name} module.${k}`, b.value);
    }
    return out;
  };
}

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
    // B-157 P2: the process cache would answer a second load of the same
    // file without evaluating it; forget it so the reload is genuine.
    forgetLibrary("/mock/fqnlib.alg");
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

  // B-157 P2: one library cache per process, keyed by path and content.
  await asyncTest("module: P2 — a second loader returns the same Extension", async () => {
    let reads = 0;
    const mk = () => new ModuleLoader({
      modules: [{ id: "p2shared" }],
      resolve: (id) => id === "p2shared" ? "/mock/p2shared.alg" : null,
      readFile: async () => { reads++; return "p2_answer = 42\n"; },
      extensions: [typeExt],
    });
    const [first] = await mk().loadAll();
    const [second] = await mk().loadAll();
    eq(second === first, true, "the process cache answers a second loader with the first load's Extension");
    eq(reads, 2, "each loader reads the file (the content is part of the key)");
    const sync = new ModuleLoader({
      modules: [],
      resolve: (id) => id === "p2shared" ? "/mock/p2shared.alg" : null,
      readFileSync: () => "p2_answer = 42\n",
      extensions: [typeExt],
    }).loadModuleSync("p2shared");
    eq(sync === first, true, "the synchronous load reads the same cache");
  });

  await asyncTest("module: P2 — an edited file is a new key, never a stale hit", async () => {
    const at = (source: string) => new ModuleLoader({
      modules: [{ id: "p2edit" }],
      resolve: (id) => id === "p2edit" ? "/mock/p2edit.alg" : null,
      readFile: async () => source,
      extensions: [typeExt],
    }).loadAll();
    const [before] = await at("p2_value = 1\n");
    const [after] = await at("p2_value = 2\n");
    eq(after !== before, true, "new text, new load");
    eq(evalNumExt("p2_value", [after]), 2, "the edited file's value is served");
    const [again] = await at("p2_value = 1\n");
    eq(again === before, true, "the original text still answers its own load");
  });

  await asyncTest("module: P2 — the same name in two directories is two keys", async () => {
    const at = (dir: string) => new ModuleLoader({
      modules: [{ id: "p2dup" }],
      resolve: (id) => id === "p2dup" ? `/mock/${dir}/p2dup.alg` : null,
      readFile: async () => "p2_dup = 7\n",
      extensions: [typeExt],
    }).loadAll();
    const [a] = await at("one");
    const [b] = await at("two");
    eq(a !== b, true, "the resolved path is part of the key");
  });

  await asyncTest("module: P2 — the harness and the CLI loader share one cache", async () => {
    const [harness] = libExtensions(["totality"]);
    const [again] = libExtensions(["totality"]);
    eq(again === harness, true, "a second harness load of a library is the first");
    const [cli] = await new ModuleLoader({
      modules: [{ id: "totality" }],
      resolve: (id) => {
        const p = path.join(path.resolve("lib"), `${id}.alg`);
        return fs.existsSync(p) ? p : null;
      },
      readFile: async (p) => fs.readFileSync(p, "utf-8"),
      extensions: [typeExt],
    }).loadAll();
    eq(cli === harness, true, "an async ModuleLoader over the same file is served the same Extension");
  });

  await asyncTest("module: P2 — scanImports finds the top-level imports a parse would", async () => {
    const body = [
      "import alpha",
      "import beta   // trailing comment",
      "x = \"multi-line string",
      "import not_a_statement",
      "\"",
      "/* a block comment",
      "import not_either",
      "*/",
      "f(n) =>",
      "  import nested_is_not_top_level",
      "  n",
      "important = 1",
      "import gamma",
      "",
    ].join("\n");
    eq(scanImports(body).join(","), "alpha,beta,gamma", "column-0 imports outside strings and comments");
  });

  // B-158 (in-place write through a library alias): the owner-module
  // invariant. A library's values are immutable after its load, and an
  // evaluation writes only into values it constructed. Two programs in one
  // process alias a library's types and functions; the library's host
  // plane reads the same afterwards, and the second program sees the
  // library as its load left it. The snapshot covers every own host field
  // of every value the libraries bind, so a writer added later that
  // reaches a library value through a program fails here too.
  await asyncTest("module: B-158 — programs that alias a library's values leave them as loaded", async () => {
    // `lib_f` calls `helper` by name, so a program that defines its own
    // diverging `helper` and aliases `lib_f` gets a divergence verdict for
    // the alias that is not the library's; `spin` is a function the
    // analysis cannot discharge, stamped `div` by the library's own load;
    // `loud` has an inferred effect set for precompile to write.
    const ownerSrc = "helper(n) => n + 1\nlib_f(n) => helper(n)\nspin(n: Int): Int => spin(n + 1)\n" +
      "loud(n) =>\n  print(n)\n  n\n";
    const owner = new ModuleLoader({
      modules: [],
      resolve: (id) => id === "b158_owner" ? "/mock/b158_owner.alg" : null,
      readFileSync: () => ownerSrc,
      extensions: [typeExt],
    }).loadModuleSync("b158_owner");
    const [units] = libExtensions(["units"]);
    const [effects] = libExtensions(["effects"]);
    const exts = [typeExt, units, effects, owner];
    const snapshot = hostPlaneSnapshotter([units, owner]);
    const before = snapshot();
    eq(effectsOf(owner.bindings["spin"])?.has("div"), true, "the library's load stamps its own function");

    const outA = runCapturing([
      "T = Quantity",
      "L = Length",
      "f = qty",
      "x = f(3, m)",
      "print(x instanceof T)",
      "print(x.add(x).mag)",
      "helper(n: Int): Int => helper(n + 1)",
      "g = lib_f",
      "s = spin",
      "k = loud",
      "",
    ].join("\n"), exts);
    eq(outA, "true ; 6", "the aliasing program runs");
    const outB = runCapturing([
      "U = Quantity",
      "y = qty(2, m)",
      "print(y instanceof Quantity)",
      "print(y instanceof U)",
      "print(y.add(y).mag)",
      "print(y.to(cm).mag)",
      "h(xs) =>",
      "  effects pure",
      "  xs.map(lib_f)",
      "print(h([1, 2]))",
      "",
    ].join("\n"), exts);
    // Before B-158 the first program re-keyed Quantity's members onto
    // `<main>::T` and stamped `div` on `lib_f`, so this program halted:
    // `effects mismatch in h: declared pure, inferred div`.
    eq(outB, "true ; true ; 4 ; 200 ; [2, 3]", "instanceof and member dispatch on the aliased type; the alias leaked no verdict");

    const after = snapshot();
    eq(after.size, before.size, "the libraries bind the same values");
    for (const [k, v] of before) eq(after.get(k), v, `library value ${k} unchanged`);
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

