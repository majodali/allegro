// =============================================================================
// Allegro — Entry Point
// Supports both Allegretto (base) and Allegro Standard (default) modes.
// Usage:
//   npx tsx src/index.ts                  # Allegro Standard REPL
//   npx tsx src/index.ts file.alg         # Allegro Standard file runner
//   npx tsx src/index.ts --base           # Allegretto REPL
//   npx tsx src/index.ts --base file.alg  # Allegretto file runner
// =============================================================================

import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { formatValue, asGrammarValue } from "./primitives.js";
import { evalSource, Extension } from "./runtime.js";
import { ContextValue, GrammarFragment, Value } from "./types.js";
import { createTypeSystem } from "./types-std.js";
import { ModuleLoader } from "./modules.js";
import { createFutureManager, FutureManager } from "./futures.js";
import { scanUses, UseDirective, UseScanResult } from "./use-scanner.js";

// --- Standard mode setup ---

let stdExtensions: Extension[] | undefined;

function getStdExtensions(): Extension[] {
  if (!stdExtensions) stdExtensions = [createTypeSystem()];
  return stdExtensions;
}

// --- Module loading ---

/**
 * Load modules on demand for a parsed file context.
 * Only loads modules that are actually imported (bindings with value: undefined)
 * and not already provided by existing extensions.
 * Convention: import math → lib/math.alg relative to source file.
 */
async function loadImportedModules(
  fileCtx: any,
  sourceDir: string,
  existingExtensions: Extension[],
): Promise<Extension[]> {
  const libDir = path.join(sourceDir, "lib");

  // Find import bindings that need loading
  const existingNames = new Set<string>();
  for (const ext of existingExtensions) {
    for (const name of Object.keys(ext.bindings)) existingNames.add(name);
    if (ext.moduleObject) existingNames.add(ext.name);
  }

  const needed: string[] = [];
  for (const b of fileCtx.bindingList) {
    if (b.key !== null && b.value === undefined && !existingNames.has(b.key)) {
      needed.push(b.key);
    }
  }

  if (needed.length === 0) return [];

  // System library directory: lib/ alongside src/ (the Allegro installation)
  const systemLibDir = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")), "..", "lib");

  const loader = new ModuleLoader({
    modules: needed.map(id => ({ id })),
    resolve: (id) => {
      // 1. Local lib (user's project)
      const local = path.join(libDir, `${id}.alg`);
      if (fs.existsSync(local)) return local;
      // 2. System lib (alongside Allegro source)
      const system = path.join(systemLibDir, `${id}.alg`);
      if (fs.existsSync(system)) return system;
      return null;
    },
    readFile: async (p) => fs.readFileSync(p, "utf-8"),
    extensions: existingExtensions,
  });

  return loader.loadAll();
}

/**
 * Collect grammar fragments contributed by extensions. Two sources:
 *   1. `ext.grammarFragment` — set by Phase 1 register_* primitives.
 *   2. `ext.bindings[name] = grammar { … }` — Phase 6 Grammar values
 *      produced by the new syntax. We scan bindings for any value that
 *      `asGrammarValue` recognises.
 */
function collectFragments(extensions: Extension[]): GrammarFragment[] {
  const out: GrammarFragment[] = [];
  for (const ext of extensions) {
    if (ext.grammarFragment) out.push(ext.grammarFragment);
    const bindings = ext.bindings ?? {};
    for (const key of Object.keys(bindings)) {
      const data = asGrammarValue(bindings[key]);
      if (data) out.push(data.fragment);
    }
  }
  return out;
}

/**
 * Load grammar-extension modules listed in `use …` directives.
 * Returns their Extensions (with grammarFragment populated by register_* calls).
 */
async function loadGrammarModules(
  names: string[],
  sourceDir: string,
  existingExtensions: Extension[],
): Promise<Extension[]> {
  if (names.length === 0) return [];
  const libDir = path.join(sourceDir, "lib");
  const systemLibDir = path.join(
    path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")),
    "..",
    "lib",
  );
  const loader = new ModuleLoader({
    modules: names.map(id => ({ id })),
    resolve: (id) => {
      const local = path.join(libDir, `${id}.alg`);
      if (fs.existsSync(local)) return local;
      const system = path.join(systemLibDir, `${id}.alg`);
      if (fs.existsSync(system)) return system;
      return null;
    },
    readFile: async (p) => fs.readFileSync(p, "utf-8"),
    extensions: existingExtensions,
  });
  return loader.loadAll();
}

// --- File runner ---

async function runFile(source: string, filename: string, standard: boolean): Promise<void> {
  try {
    if (!standard) {
      evalSource(source);
      return;
    }

    const sourceDir = path.dirname(path.resolve(filename));
    let extensions = [...getStdExtensions()];

    // 1. Pre-scan for `use …` directives and load those modules FIRST so
    //    their grammar extensions are available when we parse the main file.
    const { directives, headerEnd } = scanUses(source);

    // Load module references. `use NAME` grabs the whole module's fragments;
    // `use NAME.MEMBER` selects only the named Grammar binding so unrelated
    // grammar values in the module don't bleed in.
    const moduleNames = directives.filter(d => d.kind === "module").map(d => d.name!);
    const memberRefs  = directives
      .filter(d => d.kind === "member")
      .map(d => ({ module: d.moduleName!, member: d.memberName! }));
    const allModuleNames = [...new Set([...moduleNames, ...memberRefs.map(m => m.module)])];
    if (allModuleNames.length > 0) {
      const grammarExts = await loadGrammarModules(allModuleNames, sourceDir, extensions);
      // For whole-module `use`s, include the extension as-is.
      // For member `use`s, include only a filtered extension exposing just
      // the named binding — prevents sibling Grammar values from joining.
      const filtered: Extension[] = [];
      for (const ext of grammarExts) {
        const mems = memberRefs.filter(m => m.module === ext.name);
        if (moduleNames.includes(ext.name) && mems.length === 0) {
          filtered.push(ext);
          continue;
        }
        if (mems.length > 0) {
          const narrowedBindings: Record<string, Value> = { ...ext.bindings };
          for (const m of mems) {
            const v = ext.bindings[m.member];
            if (!v) throw new Error(`use ${m.module}.${m.member}: binding not found`);
            if (!asGrammarValue(v)) {
              throw new Error(`use ${m.module}.${m.member}: binding is not a Grammar value`);
            }
          }
          // Keep all bindings (so templates can still resolve sibling symbols
          // hygienically) but mark which Grammar binding(s) are active via a
          // synthetic whitelist — collectFragments only picks up Grammar
          // values whose key matches.
          const allowed = new Set(mems.map(m => m.member));
          for (const key of Object.keys(narrowedBindings)) {
            const b = narrowedBindings[key];
            if (asGrammarValue(b) && !allowed.has(key)) {
              delete narrowedBindings[key];
            }
          }
          filtered.push({ ...ext, bindings: narrowedBindings });
        }
      }
      extensions = [...extensions, ...filtered];
    }

    // Evaluate inline `use grammar { … }` literals in a bootstrap context
    // (just primitives + the type system). The resulting Grammar values are
    // added as fragments without a module wrapper; templates inside can
    // reference file-local bindings — those resolve at normal eval time.
    const literalExts: Extension[] = [];
    for (let idx = 0; idx < directives.length; idx++) {
      const d = directives[idx];
      if (d.kind !== "literal") continue;
      const result = evalSource(d.source!, undefined, [...getStdExtensions()], undefined, true);
      // The bootstrap source is a single bare-expression `grammar { … }` — so
      // `result.value` is the produced Grammar value. (Bare-expression
      // evaluation stashes the last value into `value`.)
      const gv = result.value;
      if (!gv) {
        throw new Error(`use grammar { … }: evaluation produced no Grammar value`);
      }
      const data = asGrammarValue(gv);
      if (!data) {
        throw new Error(`use grammar { … }: evaluation produced a non-Grammar value`);
      }
      literalExts.push({
        name: `__inline_grammar_${idx}`,
        bindings: { __inline_grammar: gv },
      });
    }
    extensions = [...extensions, ...literalExts];

    // 2. Strip the header (all `use …` directives — both module and literal
    //    forms) from the source before the main parse.
    const cleanSource = source.slice(headerEnd);

    // Standard mode: parse first to discover imports, then load on demand.
    const normalized = cleanSource.replace(/\r\n/g, "\n");

    // Gather any grammar fragments from loaded modules. An extension can
    // contribute fragments from both the Phase 1 register_* path (attached
    // as `grammarFragment`) AND Phase 6 `grammar { … }` values bound in the
    // module — we pick the latter up from the extension's bindings.
    const g2Fragments = collectFragments(extensions);

    const { parse: g2parse } = await import("./grammar2/engine.js");
    const { getBaseGrammar } = await import("./grammar2/base-grammar.js");
    const { getGrammarWithFragments } = await import("./grammar2/fragments.js");
    const { buildProgram } = await import("./grammar2/tree-builder.js");
    const grammar = g2Fragments.length > 0
      ? getGrammarWithFragments(g2Fragments)
      : getBaseGrammar();
    const result = g2parse(grammar, normalized);
    if (!result.ok) {
      throw new Error(`Parse error at position ${result.error.position}: ${result.error.message}`);
    }
    const fileCtx: any = buildProgram(result.tree);

    if (fileCtx) {
      const moduleExts = await loadImportedModules(fileCtx, sourceDir, extensions);
      extensions = [...extensions, ...moduleExts];
    }

    const fm = createFutureManager();
    evalSource(cleanSource, undefined, extensions, undefined, true, fm);
    if (fm.hasPending()) {
      await fm.waitForAll();
    }
  } catch (e: any) {
    console.error(`Error in ${filename}: ${e.message}`);
    process.exit(1);
  }
}

// --- REPL ---

function repl(standard: boolean): void {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: standard ? "allegro> " : "allegretto> ",
  });

  const modeName = standard ? "Allegro Standard" : "Allegretto";
  console.log(`${modeName} REPL (Ctrl+D to exit)`);
  rl.prompt();

  let buffer = "";
  let ctx: ContextValue | undefined;
  const fm = standard ? createFutureManager() : undefined;

  rl.on("line", (line) => {
    buffer += line + "\n";

    const trimmed = line.trim();
    if (trimmed === "" || !trimmed.match(/[+\-*/%=<>,(&|]$/)) {
      if (buffer.trim()) {
        try {
          const result = standard
            ? evalSource(buffer, ctx, getStdExtensions(), undefined, true, fm)
            : evalSource(buffer, ctx);
          ctx = result.evalCtx;
          if (result.value !== null) {
            console.log(formatValue(result.value));
          }
        } catch (e: any) {
          console.error(`Error: ${e.message}`);
        }
      }
      buffer = "";
    }

    // Defer prompt if futures are pending
    if (fm?.hasPending()) {
      fm.onDrain = () => {
        fm.onDrain = null;
        rl.prompt();
      };
    } else {
      rl.prompt();
    }
  });

  rl.on("close", () => {
    console.log("\nBye!");
    process.exit(0);
  });
}

// -- Main --
const argv = process.argv.slice(2);
const baseMode = argv.includes("--base");
const flagless = argv.filter(a => !a.startsWith("--"));
const standard = !baseMode;

// Subcommand detection: first positional arg can be a subcommand.
//   allegro inspect <file>          — Phase A: emit a module summary
//   allegro verify <file> [...]      — Phase H2: PCP verification verdict
//   allegro obligations <file> [...] — Phase H2: PCP obligation enumeration
//   allegro <file>                   — run the file (existing behaviour)
if (flagless[0] === "inspect") {
  const filename = flagless[1];
  if (!filename) {
    console.error("usage: allegro inspect <file>");
    process.exit(1);
  }
  runInspect(filename, standard).catch(e => {
    console.error(e.message);
    process.exit(1);
  });
} else if (flagless[0] === "emit") {
  const filename = flagless[1];
  if (!filename) {
    console.error("usage: allegro emit <file> [--out FILE.js] [--run]");
    process.exit(1);
  }
  const outIdx = argv.indexOf("--out");
  const outPath = outIdx >= 0 ? argv[outIdx + 1] : undefined;
  const run = argv.includes("--run");
  runEmit(filename, standard, outPath, run).catch(e => {
    console.error(e.message);
    process.exit(1);
  });
} else if (flagless[0] === "verify") {
  const filename = flagless[1];
  if (!filename) {
    console.error("usage: allegro verify <file> [--obligation O.json] [--json]");
    process.exit(1);
  }
  const obligationPath = (() => {
    const i = argv.indexOf("--obligation");
    return i >= 0 ? argv[i + 1] : undefined;
  })();
  const asJson = argv.includes("--json");
  runPcpVerify(filename, standard, obligationPath, asJson).catch(e => {
    console.error(e.message);
    process.exit(1);
  });
} else if (flagless[0] === "obligations") {
  const filename = flagless[1];
  if (!filename) {
    console.error("usage: allegro obligations <file> [--pending] [--json]");
    process.exit(1);
  }
  const pendingOnly = argv.includes("--pending");
  const asJson = argv.includes("--json");
  runPcpObligations(filename, standard, pendingOnly, asJson).catch(e => {
    console.error(e.message);
    process.exit(1);
  });
} else if (flagless[0] === "propose") {
  // Phase H4b: human-interactive worker. Emits a Markdown TODO for
  // pending obligations + their hints. The user edits the source file,
  // re-runs `allegro verify`, iterates.
  const filename = flagless[1];
  if (!filename) {
    console.error("usage: allegro propose <file> [--output FILE.md] [--all]");
    process.exit(1);
  }
  const outputIdx = argv.indexOf("--output");
  const outputPath = outputIdx >= 0 ? argv[outputIdx + 1] : undefined;
  const includeAll = argv.includes("--all");
  runPcpPropose(filename, standard, includeAll, outputPath).catch(e => {
    console.error(e.message);
    process.exit(1);
  });
} else if (flagless[0] === "prove") {
  // Phase H4a: LLM worker. Asks Claude to fill in pending proof terms,
  // verifies each via the kernel, iterates up to --max-attempts.
  const filename = flagless[1];
  if (!filename) {
    console.error(
      "usage: allegro prove <file> [--max-attempts N] [--model MODEL] [--output FILE.alg] [--json]");
    process.exit(1);
  }
  const maxIdx = argv.indexOf("--max-attempts");
  const maxAttempts = maxIdx >= 0 ? Number(argv[maxIdx + 1]) : 5;
  const modelIdx = argv.indexOf("--model");
  const model = modelIdx >= 0 ? argv[modelIdx + 1] : undefined;
  const outputIdx = argv.indexOf("--output");
  const outputPath = outputIdx >= 0 ? argv[outputIdx + 1] : undefined;
  const asJson = argv.includes("--json");
  runPcpProve(filename, maxAttempts, model, outputPath, asJson).catch(e => {
    console.error(e.message);
    process.exit(1);
  });
} else if (flagless.length > 0) {
  const filename = flagless[0];
  const source = fs.readFileSync(filename, "utf-8");
  runFile(source, filename, standard).catch(e => {
    console.error(e.message);
    process.exit(1);
  });
} else {
  repl(standard);
}

/**
 * Evaluate the file and emit a semantic summary of its top-level bindings:
 * inferred types, safety grade, primitives called, unresolved references.
 * No program side effects are executed because `print` / deferred futures
 * are never awaited — the point is to see what the compiler understood.
 */
async function runInspect(filename: string, isStandard: boolean): Promise<void> {
  const source = fs.readFileSync(filename, "utf-8");
  const sourceDir = path.dirname(path.resolve(filename));
  let extensions: Extension[] = isStandard ? [...getStdExtensions()] : [];

  // Handle `use …` directives the same way runFile does — so inspect works
  // on files that use grammar extensions.
  const { directives, headerEnd } = scanUses(source);
  const moduleNames = directives.filter(d => d.kind === "module").map(d => d.name!);
  if (moduleNames.length > 0) {
    const grammarExts = await loadGrammarModules(moduleNames, sourceDir, extensions);
    extensions = [...extensions, ...grammarExts];
  }
  const cleanSource = source.slice(headerEnd);

  // Discover and load `import …` modules first so the inspected file's
  // references resolve cleanly. Mirror the runFile flow but skip evaluation
  // of program prints.
  if (isStandard) {
    const { parse: g2parse } = await import("./grammar2/engine.js");
    const { getBaseGrammar } = await import("./grammar2/base-grammar.js");
    const { getGrammarWithFragments } = await import("./grammar2/fragments.js");
    const { buildProgram } = await import("./grammar2/tree-builder.js");
    const g2Fragments = collectFragments(extensions);
    const grammar = g2Fragments.length > 0 ? getGrammarWithFragments(g2Fragments) : getBaseGrammar();
    const result0 = g2parse(grammar, cleanSource.replace(/\r\n/g, "\n"));
    if (result0.ok) {
      const fileCtx: any = buildProgram(result0.tree);
      if (fileCtx) {
        const moduleExts = await loadImportedModules(fileCtx, sourceDir, extensions);
        extensions = [...extensions, ...moduleExts];
      }
    }
  }

  // Swallow print output during inspect — we want the summary, not program I/O.
  const origLog = console.log;
  const suppress: string[] = [];
  console.log = (...args: any[]) => suppress.push(args.map(String).join(" "));
  let result;
  try {
    result = evalSource(cleanSource, undefined, extensions, undefined, isStandard);
  } finally {
    console.log = origLog;
  }

  // Filter out primitives/type bindings injected by extensions so the user
  // sees only their source-defined bindings.
  const { primitives: primRegistry } = await import("./primitives.js");
  const primNames = new Set(Object.keys(primRegistry));
  const typeExtNames = new Set<string>();
  for (const ext of extensions) {
    for (const k of Object.keys(ext.bindings)) typeExtNames.add(k);
  }
  const excluded = new Set<string>([...primNames, ...typeExtNames]);

  const { summarizeModule, renderModuleSummary } = await import("./introspect.js");
  const summary = summarizeModule(result.evalCtx, result.compilationReport, {
    excludeBindings: excluded,
  });
  console.log(`allegro inspect — ${filename}`);
  console.log("=".repeat(60));
  console.log(renderModuleSummary(summary));
}

/**
 * Phase I: code generation. Lower a source file to a JavaScript (ESM)
 * module. Loads the same grammar / module pipeline `inspect` uses, refuses
 * to emit if compilation reports error-severity findings ("build safety
 * in"), then resolves the pre-evaluation program and emits JS.
 *
 *   allegro emit <file> [--out FILE.js] [--run]
 */
async function runEmit(
  filename: string,
  isStandard: boolean,
  outPath: string | undefined,
  run: boolean,
): Promise<void> {
  const source = fs.readFileSync(filename, "utf-8");
  const sourceDir = path.dirname(path.resolve(filename));
  let extensions: Extension[] = isStandard ? [...getStdExtensions()] : [];

  // Resolve `use …` grammar modules (same as runInspect).
  const { directives, headerEnd } = scanUses(source);
  const moduleNames = directives.filter(d => d.kind === "module").map(d => d.name!);
  if (moduleNames.length > 0) {
    const grammarExts = await loadGrammarModules(moduleNames, sourceDir, extensions);
    extensions = [...extensions, ...grammarExts];
  }
  const cleanSource = source.slice(headerEnd);

  // Load `import …` modules so references resolve (same as runInspect).
  if (isStandard) {
    const { parse: g2parse } = await import("./grammar2/engine.js");
    const { getBaseGrammar } = await import("./grammar2/base-grammar.js");
    const { getGrammarWithFragments } = await import("./grammar2/fragments.js");
    const { buildProgram } = await import("./grammar2/tree-builder.js");
    const g2Fragments = collectFragments(extensions);
    const grammar = g2Fragments.length > 0 ? getGrammarWithFragments(g2Fragments) : getBaseGrammar();
    const result0 = g2parse(grammar, cleanSource.replace(/\r\n/g, "\n"));
    if (result0.ok) {
      const fileCtx: any = buildProgram(result0.tree);
      if (fileCtx) {
        const moduleExts = await loadImportedModules(fileCtx, sourceDir, extensions);
        extensions = [...extensions, ...moduleExts];
      }
    }
  }

  // Error gate: compile the program exactly as `allegro run` would (no
  // softFail), suppressing program output. evalSource throws on the
  // genuine "don't emit unsound code" failures — effects-declaration
  // mismatches, failed proofs, failed `proven` clauses. (Benign
  // precompile-eval notices, e.g. PE recursion limits on untyped recursive
  // functions, are recorded but not thrown — the program still runs, so we
  // still emit.) A throw here means refuse to emit.
  const origLog = console.log;
  console.log = () => {};
  try {
    evalSource(cleanSource, undefined, extensions, undefined, isStandard);
  } catch (e: any) {
    throw new Error(`refusing to emit — compilation failed:\n  ${e.message}`);
  } finally {
    console.log = origLog;
  }

  // Resolve the pre-evaluation program and emit JS.
  const { resolveProgram } = await import("./codegen/resolve.js");
  const { emitProgram } = await import("./codegen/js.js");
  const program = resolveProgram(cleanSource, extensions, isStandard);
  const js = emitProgram(program);

  if (outPath) {
    fs.writeFileSync(outPath, js);
    console.error(`wrote ${outPath}`);
  } else if (!run) {
    process.stdout.write(js);
  }

  if (run) {
    const os = await import("os");
    const { spawnSync } = await import("child_process");
    const tmp = path.join(os.tmpdir(), `allegro-emit-${process.pid}-${Date.now()}.mjs`);
    fs.writeFileSync(tmp, js);
    try {
      const r = spawnSync(process.execPath, [tmp], { stdio: "inherit" });
      if (r.status !== 0) process.exitCode = r.status ?? 1;
    } finally {
      try { fs.unlinkSync(tmp); } catch { /* ignore */ }
    }
  }
}

/**
 * Phase H2: load a file with the same grammar / module pipeline `inspect`
 * uses, but evaluate in softFail mode so we see failed proofs without
 * the throw. Returns the evaluator's outputs for the verify / obligations
 * subcommands to convert into PCP shapes.
 */
async function pcpLoadAndEval(filename: string, isStandard: boolean) {
  const source = fs.readFileSync(filename, "utf-8");
  const sourceDir = path.dirname(path.resolve(filename));
  let extensions: Extension[] = isStandard ? [...getStdExtensions()] : [];

  const { directives, headerEnd } = scanUses(source);
  const moduleNames = directives.filter(d => d.kind === "module").map(d => d.name!);
  if (moduleNames.length > 0) {
    const grammarExts = await loadGrammarModules(moduleNames, sourceDir, extensions);
    extensions = [...extensions, ...grammarExts];
  }
  const cleanSource = source.slice(headerEnd);

  if (isStandard) {
    const { parse: g2parse } = await import("./grammar2/engine.js");
    const { getBaseGrammar } = await import("./grammar2/base-grammar.js");
    const { getGrammarWithFragments } = await import("./grammar2/fragments.js");
    const { buildProgram } = await import("./grammar2/tree-builder.js");
    const g2Fragments = collectFragments(extensions);
    const grammar = g2Fragments.length > 0 ? getGrammarWithFragments(g2Fragments) : getBaseGrammar();
    const result0 = g2parse(grammar, cleanSource.replace(/\r\n/g, "\n"));
    if (result0.ok) {
      const fileCtx: any = buildProgram(result0.tree);
      if (fileCtx) {
        const moduleExts = await loadImportedModules(fileCtx, sourceDir, extensions);
        extensions = [...extensions, ...moduleExts];
      }
    }
  }

  // Suppress program prints — the PCP commands surface structured data,
  // not user-program I/O.
  const origLog = console.log;
  console.log = () => {};
  let result;
  try {
    // softFail=true: failed proofs / proven / effects push notifications
    // but do NOT throw, so the verdict can describe them.
    result = evalSource(cleanSource, undefined, extensions, undefined, isStandard, undefined, true);
  } finally {
    console.log = origLog;
  }
  return result;
}

async function runPcpVerify(
  filename: string,
  isStandard: boolean,
  obligationPath: string | undefined,
  asJson: boolean,
): Promise<void> {
  const { buildVerdict, parseObligation, checkObligationSatisfied,
          serializeVerdict, formatVerdict } = await import("./pcp.js");
  const result = await pcpLoadAndEval(filename, isStandard);
  // If an obligation is supplied, pass it through to buildVerdict so
  // iteration hints reflect the lemma context + prior-attempt strategies.
  let obligation = undefined;
  if (obligationPath) {
    const obligationText = fs.readFileSync(obligationPath, "utf-8");
    obligation = parseObligation(obligationText);
  }
  const verdict = buildVerdict(result.evalCtx, result.compilationReport, obligation);

  // Cross-check the obligation: the candidate must satisfy the named
  // theorem with a matching propositionHash (blocks trivial-pass).
  if (obligation) {
    const err = checkObligationSatisfied(obligation, verdict);
    if (err) {
      (verdict as any).verified = false;
      (verdict as any).obligationMismatch = err;
    }
  }

  if (asJson) {
    console.log(serializeVerdict(verdict));
  } else {
    console.log(formatVerdict(verdict));
    if ((verdict as any).obligationMismatch) {
      console.log(`  obligation mismatch: ${(verdict as any).obligationMismatch}`);
    }
  }
  process.exit(verdict.verified ? 0 : 1);
}

async function runPcpObligations(
  filename: string,
  isStandard: boolean,
  pendingOnly: boolean,
  asJson: boolean,
): Promise<void> {
  const { extractObligations, serializeObligation, formatObligation } =
    await import("./pcp.js");
  const result = await pcpLoadAndEval(filename, isStandard);
  const obligations = extractObligations(result.evalCtx, result.compilationReport, {
    pendingOnly,
    sourceFile: filename,
  });

  if (asJson) {
    // One JSON object per line — easy to stream / pipe.
    for (const o of obligations) console.log(serializeObligation(o));
  } else {
    if (obligations.length === 0) {
      console.log(`(no ${pendingOnly ? "pending " : ""}obligations in ${filename})`);
    } else {
      for (const o of obligations) {
        console.log(formatObligation(o));
        console.log("-".repeat(40));
      }
    }
  }
}

/**
 * Phase H4b: human-interactive worker. Loads the file, builds a Verdict
 * (so we have hints), enumerates obligations, and emits a Markdown TODO
 * showing each pending obligation with its failure context + suggestions.
 * The developer reads the TODO, edits the source, re-runs `verify` to
 * iterate.
 */
async function runPcpPropose(
  filename: string,
  isStandard: boolean,
  includeAll: boolean,
  outputPath: string | undefined,
): Promise<void> {
  const { buildVerdict, extractObligations, formatTodo } = await import("./pcp.js");
  const result = await pcpLoadAndEval(filename, isStandard);
  const verdict = buildVerdict(result.evalCtx, result.compilationReport);

  // Total = ALL obligations (the denominator). Sections = pending only,
  // unless --all was supplied (then everything goes into the TODO).
  const allObligations = extractObligations(result.evalCtx, result.compilationReport,
                                            { sourceFile: filename });
  const sectionObligations = includeAll
    ? allObligations
    : extractObligations(result.evalCtx, result.compilationReport,
                          { pendingOnly: true, sourceFile: filename });

  // Group hints by theorem name so each section sees only its own.
  const hintsByName = new Map<string, any[]>();
  for (const s of verdict.iterationHints?.suggestions ?? []) {
    const arr = hintsByName.get(s.theoremName) ?? [];
    arr.push(s);
    hintsByName.set(s.theoremName, arr);
  }
  // Failure context per theorem.
  const failureByName = new Map<string, any>();
  for (const t of verdict.theorems) {
    if (t.failure) failureByName.set(t.name, t.failure);
  }

  const sections = sectionObligations.map(o => ({
    obligation: o,
    hints:      hintsByName.get(o.theorem.name),
    failure:    failureByName.get(o.theorem.name),
  }));

  const md = formatTodo({
    filename,
    totalObligations: allObligations.length,
    sections,
  });

  if (outputPath) {
    fs.writeFileSync(outputPath, md, "utf-8");
    console.log(`wrote ${outputPath} (${sections.length} pending of ${allObligations.length})`);
  } else {
    console.log(md);
  }
}


/**
 * Phase H4a: LLM worker. Runs the proof loop against Claude, splices
 * each successful proof term into the source, optionally writes the
 * proved source to --output (default: stdout summary).
 */
async function runPcpProve(
  filename: string,
  maxAttempts: number,
  model: string | undefined,
  outputPath: string | undefined,
  asJson: boolean,
): Promise<void> {
  const { runLlmWorker, createAnthropicClient } = await import("../pcp/llm-worker.js");
  const client = await createAnthropicClient({ model });
  const result = await runLlmWorker({
    filename,
    maxAttempts,
    enableLlm: true,
    client,
  });
  if (outputPath) {
    fs.writeFileSync(outputPath, result.sourceAfter, "utf-8");
  }
  if (asJson) {
    console.log(JSON.stringify({
      filename,
      allDischarged: result.allDischarged,
      summary: result.summary,
      perObligation: result.perObligation.map(o => ({
        name: o.name, discharged: o.discharged, attempts: o.attempts,
        finalTerm: o.finalTerm,
        authorship: o.authorship,
      })),
    }));
  } else {
    console.log(`allegro prove — ${filename}`);
    console.log("=".repeat(60));
    console.log(`Summary: ${result.summary.discharged} discharged, ${result.summary.pending} pending`);
    for (const o of result.perObligation) {
      const mark = o.discharged ? "✓" : "✗";
      console.log(`  ${mark} ${o.name} (${o.attempts} attempt(s))`);
      if (o.finalTerm) console.log(`      proof: ${o.finalTerm.split("\\n")[0]}`);
      if (!o.discharged && o.history.length > 0) {
        const last = o.history[o.history.length - 1];
        if (last.reason) console.log(`      last failure: ${last.reason}`);
      }
    }
    if (outputPath) console.log(`Wrote proved source to ${outputPath}`);
  }
  process.exit(result.allDischarged ? 0 : 1);
}
