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
import { ContextValue, GrammarFragment } from "./types.js";
import { createTypeSystem } from "./types-std.js";
import { ModuleLoader } from "./modules.js";
import { createFutureManager, FutureManager } from "./futures.js";

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
 * Pre-scan source for `use X` directives at the top of the file (Phase 6).
 * Accepted forms in step 8's whitelist:
 *   use NAME            — loads module NAME, applies its grammar
 *   use import NAME     — same; `import` is accepted but currently does the
 *                         same thing (module bindings always land in scope
 *                         as an extension; step 11+ may distinguish).
 * Each directive must appear before any non-`use`, non-comment, non-blank
 * line. Returns the list of grammar-extension module names to load first.
 */
function scanUses(source: string): string[] {
  const names: string[] = [];
  const lines = source.split(/\r?\n/);
  let inBlockComment = false;
  for (const rawLine of lines) {
    let line = rawLine;
    if (inBlockComment) {
      const end = line.indexOf("*/");
      if (end >= 0) { line = line.slice(end + 2); inBlockComment = false; } else continue;
    }
    const bcStart = line.indexOf("/*");
    if (bcStart >= 0) {
      const bcEnd = line.indexOf("*/", bcStart + 2);
      if (bcEnd >= 0) line = line.slice(0, bcStart) + line.slice(bcEnd + 2);
      else { line = line.slice(0, bcStart); inBlockComment = true; }
    }
    const lcStart = line.indexOf("//");
    if (lcStart >= 0) line = line.slice(0, lcStart);
    const trimmed = line.trim();
    if (trimmed === "") continue;
    // Match `use NAME` or `use import NAME`.
    const m = /^use\s+(?:import\s+)?(\w+)\s*$/.exec(trimmed);
    if (m) { names.push(m[1]); continue; }
    break;
  }
  return names;
}

/** Strip `use …` directive lines from source before the main parse. */
function stripUses(source: string): string {
  return source.replace(/^\s*use\s+(?:import\s+)?\w+\s*$/gm, "");
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
    const grammarNames = scanUses(source);
    if (grammarNames.length > 0) {
      const grammarExts = await loadGrammarModules(grammarNames, sourceDir, extensions);
      extensions = [...extensions, ...grammarExts];
    }

    // 2. Strip `use …` lines from source before parsing (they're directives,
    //    not statements the parser should try to understand).
    const cleanSource = stripUses(source);

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
const files = argv.filter(a => !a.startsWith("--"));
const standard = !baseMode;

if (files.length > 0) {
  const filename = files[0];
  const source = fs.readFileSync(filename, "utf-8");
  runFile(source, filename, standard).catch(e => {
    console.error(e.message);
    process.exit(1);
  });
} else {
  repl(standard);
}
