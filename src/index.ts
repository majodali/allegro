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
 * Pre-scan source for `use X` directives at the top of the file. Returns
 * the parsed directives plus the offset in `source` where the header ends
 * (so callers can strip or slice cleanly).
 *
 * Accepted forms:
 *   use NAME              — module reference; loads NAME.alg
 *   use import NAME       — same; `import` accepted for symmetry with imports
 *   use grammar { … }     — Phase 7a hosting-file literal: a grammar block
 *                           evaluated at bootstrap time (primitives + type
 *                           system only — file-local bindings resolve later
 *                           at the template's normal eval time).
 * Each directive must appear before any non-`use`, non-comment, non-blank
 * line.
 */
interface UseDirective {
  kind: "module" | "literal";
  /** For kind "module": the module name. */
  name?:    string;
  /** For kind "literal": the source of the `grammar { … }` expression. */
  source?:  string;
}
interface UseScanResult {
  directives: UseDirective[];
  headerEnd:  number;   // byte offset in `source` where the header stops
}

function scanUses(source: string): UseScanResult {
  const directives: UseDirective[] = [];
  let i = 0;
  const n = source.length;

  while (i < n) {
    // Skip blanks / whitespace / comments.
    const wsEnd = skipWsComments(source, i);
    if (wsEnd >= n) { i = wsEnd; break; }

    // `use` keyword?
    if (source.slice(wsEnd, wsEnd + 4) === "use " || source.slice(wsEnd, wsEnd + 4) === "use\t") {
      const afterUse = skipHSpaces(source, wsEnd + 4);

      // `use import NAME` or `use NAME`
      const identMatch = /^(?:import\s+)?(\w+)\s*(\r?\n|$)/.exec(source.slice(afterUse));
      // `use grammar { … }` — inline literal; brace-count to find end.
      if (source.slice(afterUse, afterUse + 8) === "grammar " ||
          source.slice(afterUse, afterUse + 8) === "grammar\t" ||
          source.slice(afterUse, afterUse + 8) === "grammar{") {
        const braceStart = source.indexOf("{", afterUse);
        if (braceStart < 0) break;
        const braceEnd = findMatchingBrace(source, braceStart);
        if (braceEnd < 0) break;
        const body = source.slice(afterUse, braceEnd + 1);
        directives.push({ kind: "literal", source: body });
        // Advance past the end of the block + following newline.
        i = braceEnd + 1;
        while (i < n && (source[i] === " " || source[i] === "\t")) i++;
        if (i < n && source[i] === "\n") i++;
        continue;
      }
      if (identMatch) {
        directives.push({ kind: "module", name: identMatch[1] });
        i = afterUse + identMatch[0].length;
        continue;
      }
      // `use …` with unrecognised form — stop header scan.
      break;
    }
    break;
  }
  return { directives, headerEnd: i };
}

/** Advance past whitespace, line comments, and block comments. */
function skipWsComments(src: string, from: number): number {
  let i = from;
  while (i < src.length) {
    const c = src[i];
    if (c === " " || c === "\t" || c === "\n" || c === "\r") { i++; continue; }
    if (src.slice(i, i + 2) === "//") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (src.slice(i, i + 2) === "/*") {
      const end = src.indexOf("*/", i + 2);
      i = end < 0 ? src.length : end + 2;
      continue;
    }
    break;
  }
  return i;
}

function skipHSpaces(src: string, from: number): number {
  let i = from;
  while (i < src.length && (src[i] === " " || src[i] === "\t")) i++;
  return i;
}

/**
 * Find the matching close-brace for the open-brace at the given start
 * position, accounting for nested braces but NOT for braces inside
 * strings or comments (best-effort, good enough for typical grammar-block
 * contents).
 */
function findMatchingBrace(src: string, start: number): number {
  let depth = 0;
  let i = start;
  let inString = false;
  let stringQuote = "";
  while (i < src.length) {
    const c = src[i];
    if (inString) {
      if (c === "\\") { i += 2; continue; }
      if (c === stringQuote) { inString = false; i++; continue; }
      i++;
      continue;
    }
    if (c === '"' || c === "'") { inString = true; stringQuote = c; i++; continue; }
    if (src.slice(i, i + 2) === "//") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (src.slice(i, i + 2) === "/*") {
      const end = src.indexOf("*/", i + 2);
      i = end < 0 ? src.length : end + 2;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return i;
    }
    i++;
  }
  return -1;
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

    // Load module references.
    const moduleNames = directives.filter(d => d.kind === "module").map(d => d.name!);
    if (moduleNames.length > 0) {
      const grammarExts = await loadGrammarModules(moduleNames, sourceDir, extensions);
      extensions = [...extensions, ...grammarExts];
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
