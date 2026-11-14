// The terminal's entry to the minimal launcher (B-196 (the rebuild's
// acceptance side), chunk Q7 (the minimal launcher), part 1). The only
// file of next/launch/ that touches process and fs.
//
//   npm run launch -- <saved-program.json> [--steps <n>]
//   npx tsx next/launch/terminal.ts <saved-program.json> [--steps <n>]
//
// It reads the saved program, runs it with the launcher of
// next/launch/launcher.ts, writes each line the program prints to
// stdout, and exits 0 when the run completed. Otherwise it writes the
// reason to stderr and exits 1.
//
// The configuration, as far as milestone 2 needs it: the ceiling grants
// `output`, the one capability the terminal supplies; `--steps` sets a
// step budget, and without it there is none.
//
// The kernel. The kernel stream provides the factory at KERNEL_MODULE,
// exporting `createKernel` of type `CreateKernel`
// (next/kernel/interface.ts). Until that file exists the entry prints
// one line saying so and exits 2. It never loads the stand-in kernel of
// the launcher's tests.

import * as fs from "fs";
import * as path from "path";
import { pathToFileURL } from "url";
import type { CreateKernel } from "../kernel/interface.js";
import { describe, launch } from "./launcher.js";
import { output } from "./output.js";

/** Where the kernel stream provides the kernel factory, relative to the repository root. */
export const KERNEL_MODULE = "next/kernel/create.ts";

const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(here, "../..");

function fail(message: string, code = 1): never {
  process.stderr.write(message + "\n");
  process.exit(code);
}

async function kernelFactory(): Promise<CreateKernel> {
  const file = path.join(root, KERNEL_MODULE);
  if (!fs.existsSync(file)) fail(`no kernel is built yet: ${KERNEL_MODULE} does not exist`, 2);
  const mod = (await import(pathToFileURL(file).href)) as { createKernel?: unknown };
  if (typeof mod.createKernel !== "function") fail(`${KERNEL_MODULE} does not export a function createKernel`);
  return mod.createKernel as CreateKernel;
}

async function main(argv: readonly string[]): Promise<void> {
  let file: string | undefined;
  let steps: number | undefined;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--steps") {
      steps = Number(argv[++i]);
      if (!Number.isInteger(steps) || steps < 0) fail("--steps takes a whole number");
    } else if (file === undefined) file = argv[i];
    else fail(`unexpected argument ${argv[i]}`);
  }
  if (file === undefined) fail("usage: npm run launch -- <saved-program.json> [--steps <n>]");

  let program: unknown;
  try {
    program = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    fail(`cannot read ${file} as JSON: ${e instanceof Error ? e.message : String(e)}`);
  }

  const createKernel = await kernelFactory();
  const outcome = await launch({
    createKernel,
    program,
    configuration: { ceiling: ["output"], steps },
    target: { capabilities: [output] },
    onLine: (line) => process.stdout.write(line + "\n"),
  });
  if (outcome.end.kind !== "completed") fail(describe(outcome.end));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname))
  await main(process.argv.slice(2));
