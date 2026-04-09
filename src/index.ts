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
import { formatValue } from "./primitives.js";
import { evalSource, Extension } from "./runtime.js";
import { ContextValue } from "./types.js";
import { createTypeSystem } from "./types-std.js";
import { ModuleLoader } from "./modules.js";

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

  const loader = new ModuleLoader({
    modules: needed.map(id => ({ id })),
    resolve: (id) => {
      const p = path.join(libDir, `${id}.alg`);
      return fs.existsSync(p) ? p : null;
    },
    readFile: async (p) => fs.readFileSync(p, "utf-8"),
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

    // Standard mode: parse first to discover imports, then load on demand
    const normalized = source.replace(/\r\n/g, "\n");
    const { parseStandard } = await import("./hybrid-parser.js");
    const parseResult = parseStandard(normalized);
    if (parseResult.errors.length > 0) {
      throw new Error(`Parse error: ${parseResult.errors[0].message}`);
    }

    const fileCtx = (parseResult.tree as any).ctx;
    let extensions = [...getStdExtensions()];

    if (fileCtx) {
      const sourceDir = path.dirname(path.resolve(filename));
      const moduleExts = await loadImportedModules(fileCtx, sourceDir, extensions);
      extensions = [...extensions, ...moduleExts];
    }

    evalSource(source, undefined, extensions, undefined, true);
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

  rl.on("line", (line) => {
    buffer += line + "\n";

    const trimmed = line.trim();
    if (trimmed === "" || !trimmed.match(/[+\-*/%=<>,(&|]$/)) {
      if (buffer.trim()) {
        try {
          const result = standard
            ? evalSource(buffer, ctx, getStdExtensions(), undefined, true)
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

    rl.prompt();
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
