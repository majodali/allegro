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
import * as readline from "readline";
import { formatValue } from "./primitives.js";
import { evalSource, Extension } from "./runtime.js";
import { ContextValue } from "./types.js";
import { buildAllegroStandardExtensions, GrammarExtension } from "./grammar-ext.js";
import { createTypeSystem } from "./types-std.js";

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

// --- File runner ---

function runFile(source: string, filename: string, standard: boolean): void {
  try {
    const { value } = standard
      ? evalSource(source, undefined, getStdExtensions(), getStdGrammar(), true)
      : evalSource(source);
    // File mode: bare expressions are evaluated for side effects (e.g. print).
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
  runFile(source, filename, standard);
} else {
  repl(standard);
}
