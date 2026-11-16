// The terminal's command that runs an Allegretto text (B-196 (the
// rebuild's acceptance side), chunk Q5 (the first notation and the
// bootstrap), part 3): it emits the text with next/bootstrap/emit.ts and
// launches the record with next/launch/terminal.ts, in one step.
//
//   npm run allegretto -- <file.alg> [--steps <n>]
//   npx tsx next/launch/allegretto.ts <file.alg> [--steps <n>]
//
// It prints the lines the program writes and exits 0 when the run
// completed. Otherwise it writes the end's reason to stderr and exits 1.
// A text the emitter refuses prints each finding as `npm run emit` does,
// `file:line:column: message`, and exits 1; nothing is launched.
//
// The configuration and the target are the terminal's: the ceiling grants
// `output`, the target's pure primitives are the shipped ones, and
// `--steps` sets a step budget.

import * as fs from "fs";
import * as path from "path";
import { describeFinding, emit } from "../bootstrap/emit.js";
import { encode } from "../kernel/saved-program.js";
import { runOnTerminal, terminalArguments } from "./terminal.js";

async function main(argv: readonly string[]): Promise<void> {
  const { file, steps } = terminalArguments(argv, "usage: npm run allegretto -- <file.alg> [--steps <n>]");
  let text: string;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch (e) {
    process.stderr.write(`cannot read ${file}: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  }
  const r = emit(text);
  if (!r.ok) {
    for (const f of r.findings) process.stderr.write(describeFinding(f, file) + "\n");
    process.exit(1);
  }
  // The record goes to the launcher as the saved program's JSON, as `npm run launch` reads it.
  await runOnTerminal(JSON.parse(encode(r.program)), steps);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname))
  await main(process.argv.slice(2));
