// =============================================================================
// Allegro — Entry Point
// Supports both Base mode and Standard mode (default).
// Usage:
//   npx tsx src/index.ts                  # Standard REPL
//   npx tsx src/index.ts file.alg         # Standard file runner
//   npx tsx src/index.ts --base           # Base REPL
//   npx tsx src/index.ts --base file.alg  # Base file runner
// =============================================================================

import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { formatValue } from "./primitives.js";
import { evalSource, Extension } from "./runtime.js";
import { ContextValue } from "./types.js";
import { buildAllegroStandardExtensions, GrammarExtension } from "./grammar-ext.js";
import { createTypeSystem } from "./types-std.js";
import { ModuleLoader } from "./modules.js";

// --- Standard mode setup ---

let stdGrammar: GrammarExtension | undefined;
let stdExtensions: Extension[] | undefined;

function getStdGrammar(): GrammarExtension {
  if (!stdGrammar) stdGrammar = buildAllegroStandardExtensions();
  return stdGrammar;
}

function getStdExtensions(): Extension[] {
  if (!stdExtensions) stdExtensions = [createTypeSystem()];
  return stdExtensions;
}

// --- Module loading ---

/**
 * Discover modules in a lib/ directory relative to the source file.
 * Convention: import math → lib/math.alg
 */
async function loadModules(sourceDir: string): Promise<Extension[]> {
  const libDir = path.join(sourceDir, "lib");
  if (!fs.existsSync(libDir)) return [];

  const files = fs.readdirSync(libDir).filter(f => f.endsWith(".alg"));
  if (files.length === 0) return [];

  const modules = files.map(f => ({
    id: path.basename(f, ".alg"),
  }));

  const loader = new ModuleLoader({
    modules,
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
    let extensions = standard ? [...getStdExtensions()] : undefined;

    // In standard mode, load modules from lib/ directory
    if (standard) {
      const sourceDir = path.dirname(path.resolve(filename));
      const moduleExts = await loadModules(sourceDir);
      extensions = [...extensions!, ...moduleExts];
    }

    const { value } = standard
      ? evalSource(source, undefined, extensions, getStdGrammar(), true)
      : evalSource(source);
    void value;
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
    prompt: standard ? "allegro> " : "allegro-base> ",
  });

  const modeName = standard ? "Allegro Standard" : "Allegro Base";
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
            ? evalSource(buffer, ctx, getStdExtensions(), getStdGrammar(), true)
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
