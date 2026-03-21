// =============================================================================
// Allegro Base Language - Entry Point
// =============================================================================

import * as fs from "fs";
import * as readline from "readline";
import { formatValue } from "./primitives.js";
import { evalSource } from "./runtime.js";
import { ContextValue } from "./types.js";

function runFile(source: string, filename: string): void {
  try {
    const { value } = evalSource(source);
    // File mode: bare expressions are evaluated for side effects (e.g. print).
    // No implicit output of the last value.
    void value;
  } catch (e: any) {
    console.error(`Error in ${filename}: ${e.message}`);
    process.exit(1);
  }
}

function repl(): void {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "allegro> ",
  });

  console.log("Allegro Base Language REPL (Ctrl+D to exit)");
  rl.prompt();

  let buffer = "";
  let ctx: ContextValue | undefined;

  rl.on("line", (line) => {
    buffer += line + "\n";

    const trimmed = line.trim();
    if (trimmed === "" || !trimmed.match(/[+\-*/%=<>,(&|]$/)) {
      if (buffer.trim()) {
        try {
          const result = evalSource(buffer, ctx);
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
const args = process.argv.slice(2);

if (args.length > 0) {
  const filename = args[0];
  const source = fs.readFileSync(filename, "utf-8");
  runFile(source, filename);
} else {
  repl();
}
