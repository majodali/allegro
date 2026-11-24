// The terminal's command that runs an Allegretto text (B-196 (the
// rebuild's acceptance side), chunk Q5 (the first notation and the
// bootstrap), part 3; chunk Q7 (the minimal launcher and the output
// capability), part 3, for the inputs, part 4, for imports, and part 5,
// for the timer capability; chunk Q13 (check and run as configurations,
// and what a result holds), part 2, for the configuration's sources,
// part 3, for `--phases`, and part 5, for `--phases check` as the kernel's
// check and for `--phases check,run`;
// chunk Q16 (the capabilities the launchers ship), part 3, for check
// output and the exit code): it emits
// the text and the texts it imports with the bootstrap's driver
// (next/bootstrap/driver.ts) and launches the records with
// next/launch/terminal.ts, in one step: the imported records are loaded
// first, in the order the driver gives, and the text's own is run.
//
//   npm run allegretto -- <file.alg> [--steps <n>] [--ceiling <a,b>] [--phases <run|check|check,run>] [--input name=<literal>]… [--later name=<literal>]…
//   npx tsx next/launch/allegretto.ts <file.alg> [--steps <n>] [--ceiling <a,b>] [--phases <run|check|check,run>] [--input name=<literal>]… [--later name=<literal>]…
//
// It prints the lines the program writes. Where the run did not complete
// it writes the end's reason to stderr. Each message the program hands to
// `report.message` is written to stderr, one line each, as
// next/launch/terminal.ts writes it. The exit code is the higher of 0 for
// a completed run or 1 otherwise, and the highest status the program
// handed to `report.status` (`exitCode` of next/launch/terminal.ts).
// A text the driver refuses, for a finding of the reader or the emitter in
// it or in a text it imports, an imported text not found or outside the
// project's directory, or a cycle of imports, prints each finding as `npm run emit` does,
// `file:line:column: message`, and exits 1; nothing is launched. An
// imported text is `name.alg` in the directory of the text that imports
// it (`importedFile` of the driver).
//
// The target is the terminal's: `output`, `timer` on the host's real
// timer, `http` on the host's `fetch` (part 1 of Q16), `report` on the
// terminal's sink (part 3 of Q16), and the shipped pure primitives.
//
// The configuration comes from four sources, highest first, resolved by
// `resolve` of next/tools/configuration.ts (`resolveOnTerminal` of
// next/launch/terminal.ts):
//   - the command line. `--steps` sets a step budget. `--ceiling a,b`
//     narrows the ceiling. `--phases` sets the phases: `run`, `check` or
//     `check,run`. Check hands the module to the kernel's `check`: it
//     performs nothing, leaves every input unknown, and hands the check
//     capabilities of the ceiling, `report` alone today, as not needed.
//     Run supplies every capability of the ceiling and the inputs.
//     `check,run` is the check and, where it finds nothing, the run, whose
//     lines and end are the command's. Each `--input name=<literal>` supplies
//     the input `name` at the start. Each `--later name=<literal>` is one
//     later phase that supplies it, in the order written. The value is
//     one Allegretto literal, read by `readLiteral` of
//     next/bootstrap/literal.ts. A value that is not a literal, or a flag
//     with no `=`, is a usage error and exits 1;
//   - the project's file, `allegro.json` in the directory of the text,
//     where there is one (`readProjectFile` of
//     next/tools/configuration.ts). It may set `steps`, `inputs`,
//     `later`, each literal written as a JSON string, and `phases`, a
//     list of names such as `["check"]`. An input it gives is
//     replaced by an `--input` of the same name;
//   - the environment: `ALLEGRO_STEPS`;
//   - the launcher's own value: the ceiling that grants all four
//     capabilities (`TERMINAL_CEILING` of next/launch/terminal.ts).
// A finding of the file or of the resolution, a setting the file may not
// set among them, is written to stderr, one line each, and exits 1;
// nothing is emitted or launched.

import * as fs from "fs";
import * as path from "path";
import { describeDriveFinding, drive } from "../bootstrap/driver.js";
import { readLiteral } from "../bootstrap/literal.js";
import { encode } from "../kernel/saved-program.js";
import { PROJECT_FILE, readProjectFile, type Settings } from "../tools/configuration.js";
import type { Inputs, Plain } from "./launcher.js";
import { projectReader } from "./node-files.js";
import { failFindings, resolveOnTerminal, runOnTerminal, terminalArguments } from "./terminal.js";

const USAGE = "usage: npm run allegretto -- <file.alg> [--steps <n>] [--ceiling <a,b>] [--phases <run|check|check,run>] [--input name=<literal>]... [--later name=<literal>]...";

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

/** The settings of the project's file beside the text, where there is one. */
function projectSettings(file: string): Settings | undefined {
  const project = path.join(path.dirname(file), PROJECT_FILE);
  if (!fs.existsSync(project)) return undefined;
  const r = readProjectFile(project, fs.readFileSync(project, "utf8"));
  if (!r.ok) failFindings(r.findings);
  return r.settings;
}

async function main(argv: readonly string[]): Promise<void> {
  const { rest, inputs, later } = inputArguments(argv);
  const { file, commandLine } = terminalArguments(rest, USAGE);
  // A source that sets no input, or no later phase, leaves it to the sources below.
  const resolved = resolveOnTerminal(
    { ...commandLine, ...(Object.keys(inputs).length === 0 ? {} : { inputs }), ...(later.length === 0 ? {} : { later }) },
    projectSettings(file),
  );
  let text: string;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch (e) {
    process.stderr.write(`cannot read ${file}: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  }
  // The imported texts are read in the project's directory and nowhere else.
  const r = drive(text, file, projectReader(file));
  if (!r.ok) {
    for (const f of r.findings) process.stderr.write(describeDriveFinding(f) + "\n");
    process.exit(1);
  }
  // Each record goes to the launcher as the saved program's JSON, as `npm run launch` reads it.
  const records = r.records.map((x) => JSON.parse(encode(x.program)) as unknown);
  await runOnTerminal(records[records.length - 1], resolved, records.slice(0, -1));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname))
  await main(process.argv.slice(2));
