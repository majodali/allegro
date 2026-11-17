// The terminal's command that runs an Allegretto text (B-196 (the
// rebuild's acceptance side), chunk Q5 (the first notation and the
// bootstrap), part 3; chunk Q7 (the minimal launcher and the output
// capability), part 3, for the inputs): it emits the text with
// next/bootstrap/emit.ts and launches the record with
// next/launch/terminal.ts, in one step.
//
//   npm run allegretto -- <file.alg> [--steps <n>] [--input name=<literal>]… [--later name=<literal>]…
//   npx tsx next/launch/allegretto.ts <file.alg> [--steps <n>] [--input name=<literal>]… [--later name=<literal>]…
//
// It prints the lines the program writes and exits 0 when the run
// completed. Otherwise it writes the end's reason to stderr and exits 1.
// A text the emitter refuses prints each finding as `npm run emit` does,
// `file:line:column: message`, and exits 1; nothing is launched.
//
// The configuration and the target are the terminal's: the ceiling grants
// `output`, the target's pure primitives are the shipped ones, and
// `--steps` sets a step budget. Each `--input name=<literal>` supplies the
// input `name` at the start. Each `--later name=<literal>` is one later
// phase that supplies it, in the order written. The value is one
// Allegretto literal, read by `readLiteral` of next/bootstrap/literal.ts.
// A value that is not a literal, or a flag with no `=`, is a usage error
// and exits 1.

import * as fs from "fs";
import * as path from "path";
import { describeFinding, emit } from "../bootstrap/emit.js";
import { readLiteral } from "../bootstrap/literal.js";
import { encode } from "../kernel/saved-program.js";
import type { Inputs, Plain } from "./launcher.js";
import { runOnTerminal, terminalArguments } from "./terminal.js";

const USAGE = "usage: npm run allegretto -- <file.alg> [--steps <n>] [--input name=<literal>]... [--later name=<literal>]...";

function usageError(message: string): never {
  process.stderr.write(`${message}\n${USAGE}\n`);
  process.exit(1);
}

/** Reads `name=<literal>` as an input's name and its plain data. */
function inputOf(flag: string, arg: string | undefined): readonly [string, Plain] {
  if (arg === undefined) usageError(`${flag} takes name=<literal>`);
  const eq = arg.indexOf("=");
  if (eq < 0) usageError(`${flag} ${arg}: no = between the input's name and its value`);
  const name = arg.slice(0, eq).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) usageError(`${flag} ${arg}: ${JSON.stringify(name)} is not an input's name`);
  const r = readLiteral(arg.slice(eq + 1));
  if (!r.ok) usageError(`${flag} ${arg}: ${r.finding}`);
  return [name, r.value];
}

/** Takes the input flags out of the arguments, and leaves the rest to `terminalArguments`. */
export function inputArguments(argv: readonly string[]): { rest: string[]; inputs: Record<string, Plain>; later: Inputs[] } {
  const rest: string[] = [];
  const inputs: Record<string, Plain> = {};
  const later: Inputs[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--input" || argv[i] === "--later") {
      const [name, value] = inputOf(argv[i], argv[i + 1]);
      if (argv[i] === "--later") later.push({ [name]: value });
      else if (Object.hasOwn(inputs, name)) usageError(`--input ${name} is given twice`);
      else inputs[name] = value;
      i++;
    } else rest.push(argv[i]);
  }
  return { rest, inputs, later };
}

async function main(argv: readonly string[]): Promise<void> {
  const { rest, inputs, later } = inputArguments(argv);
  const { file, steps } = terminalArguments(rest, USAGE);
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
  await runOnTerminal(JSON.parse(encode(r.program)), steps, { inputs, later });
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname))
  await main(process.argv.slice(2));
