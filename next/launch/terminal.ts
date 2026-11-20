// The terminal's entry to the minimal launcher (B-196 (the rebuild's
// acceptance side), chunk Q7 (the minimal launcher), parts 1 to 5). The only
// file of next/launch/ that touches process and fs, with
// next/launch/allegretto.ts.
//
//   npm run launch -- <saved-program.json> [--import <record.json>]... [--steps <n>]
//   npx tsx next/launch/terminal.ts <saved-program.json> [--import <record.json>]... [--steps <n>]
//
// Each `--import` names the saved program of a module the program
// imports, directly or through another, in the order they are loaded: a
// module before every module that imports it. `npm run emit` names the
// texts whose records a program needs.
//
// The command that runs an Allegretto text directly, next/launch/allegretto.ts,
// uses `terminalArguments` and `runOnTerminal` of this file.
//
// It takes no input flags. A saved program whose module declares an input
// ends waiting on that input, which is how the launcher reports an input
// the configuration does not supply. `npm run allegretto` takes them.
//
// It reads the saved program, runs it with the launcher of
// next/launch/launcher.ts, writes each line the program prints to
// stdout, and exits 0 when the run completed. Otherwise it writes the
// reason to stderr and exits 1.
//
// The target supplies two capabilities: `output` (next/launch/output.ts)
// and `timer` (next/launch/timer.ts), made with the host's real timer
// (`realClock` of next/launch/clock.ts). Its pure primitives are the
// shipped ones, `shipped` of next/prims/index.ts.
//
// The configuration, as far as milestone 2 needs it: the ceiling of
// `npm run launch` grants `output` alone, as before part 5; the ceiling
// of `npm run allegretto` grants `output` and `timer` (`runOnTerminal`
// takes the ceiling). `--steps` sets a step budget, and without it there
// is none.
//
// The kernel. The kernel stream provides the factory at KERNEL_MODULE,
// exporting `createKernel` of type `CreateKernel2`
// (next/kernel/interface.ts). Until that file exists the entry prints
// one line saying so and exits 2. It never loads the stand-in kernel of
// the launcher's tests.

import * as fs from "fs";
import * as path from "path";
import { pathToFileURL } from "url";
import type { CreateKernel2 } from "../kernel/interface.js";
import { shipped } from "../prims/index.js";
import { describe, launch, type Configuration } from "./launcher.js";
import { output } from "./output.js";
import { realClock } from "./clock.js";
import { timer } from "./timer.js";

/** Where the kernel stream provides the kernel factory, relative to the repository root. */
export const KERNEL_MODULE = "next/kernel/create.ts";

const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(here, "../..");

function fail(message: string, code = 1): never {
  process.stderr.write(message + "\n");
  process.exit(code);
}

async function kernelFactory(): Promise<CreateKernel2> {
  const file = path.join(root, KERNEL_MODULE);
  if (!fs.existsSync(file)) fail(`no kernel is built yet: ${KERNEL_MODULE} does not exist`, 2);
  const mod = (await import(pathToFileURL(file).href)) as { createKernel?: unknown };
  if (typeof mod.createKernel !== "function") fail(`${KERNEL_MODULE} does not export a function createKernel`);
  return mod.createKernel as CreateKernel2;
}

/** Reads the arguments every terminal entry takes: one file, and `--steps <n>`. */
export function terminalArguments(argv: readonly string[], usage: string): { file: string; steps: number | undefined } {
  let file: string | undefined;
  let steps: number | undefined;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--steps") {
      steps = Number(argv[++i]);
      if (!Number.isInteger(steps) || steps < 0) fail("--steps takes a whole number");
    } else if (file === undefined) file = argv[i];
    else fail(`unexpected argument ${argv[i]}`);
  }
  if (file === undefined) fail(usage);
  return { file, steps };
}

/** The ceiling of `npm run launch`. */
export const LAUNCH_CEILING: readonly string[] = ["output"];
/** The ceiling of `npm run allegretto`. */
export const ALLEGRETTO_CEILING: readonly string[] = ["output", "timer"];

/**
 * Runs a saved program, as parsed JSON, on the kernel stream's kernel, with
 * the terminal's target, the ceiling given, and the inputs given: those
 * supplied at the start and each later phase. Writes each line to stdout;
 * on any end but completed, writes the reason to stderr and exits 1.
 */
export async function runOnTerminal(
  program: unknown,
  steps: number | undefined,
  inputs: Pick<Configuration, "inputs" | "later"> = {},
  imports: readonly unknown[] = [],
  ceiling: readonly string[] = LAUNCH_CEILING,
): Promise<void> {
  const createKernel = await kernelFactory();
  const outcome = await launch({
    createKernel,
    program,
    imports,
    configuration: { ceiling, steps, ...inputs },
    target: { capabilities: [output, timer(realClock)], primitives: shipped },
    onLine: (line) => process.stdout.write(line + "\n"),
  });
  if (outcome.end.kind !== "completed") fail(describe(outcome.end));
}

/** Reads a saved program's JSON, or fails saying why. */
function readRecord(file: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    fail(`cannot read ${file} as JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function main(argv: readonly string[]): Promise<void> {
  const usage = "usage: npm run launch -- <saved-program.json> [--import <record.json>]... [--steps <n>]";
  const rest: string[] = [];
  const imported: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] !== "--import") rest.push(argv[i]);
    else if (argv[i + 1] === undefined) fail(`--import takes a saved program's file\n${usage}`);
    else imported.push(argv[++i]);
  }
  const { file, steps } = terminalArguments(rest, usage);
  await runOnTerminal(readRecord(file), steps, {}, imported.map(readRecord));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname))
  await main(process.argv.slice(2));
