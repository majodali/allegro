// Where a launcher finds the kernel: `createKernel`, of type
// `CreateKernel` (next/kernel/interface.ts). The acceptance stream's
// terminal entry, next/launch/terminal.ts, loads this file by path.
//
// There are two kernel variants (docs/plans/book-pass.md section 9). The
// one given is the machine (next/kernel/machine.ts), which evaluates with
// a stack of its own. The reference kernel (next/kernel/kernel.ts) stays
// in the tree, small and slow, to compare against: "One reference kernel
// is the root of trust". The environment variable ALLEGRO_KERNEL set to
// "reference" gives it. Until 2026-11-21 the reference was the one given.
// The variable is read each time a kernel is made, so one process can
// make both.

import type { CreateKernel } from "./interface.js";
import { createKernel as createReference } from "./kernel.js";
import { createMachine } from "./machine.js";

/** The names a kernel variant is chosen by. */
export const KERNEL_VARIANTS = ["reference", "machine"] as const;

/** The variant the environment asks for: the machine where it asks for none. */
export function chosenVariant(): (typeof KERNEL_VARIANTS)[number] {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  const name = env?.ALLEGRO_KERNEL;
  if (name === undefined || name === "" || name === "machine") return "machine";
  if (name === "reference") return "reference";
  throw new Error(`ALLEGRO_KERNEL names no kernel variant: "${name}". The variants are ${KERNEL_VARIANTS.join(" and ")}.`);
}

export const createKernel: CreateKernel = () => (chosenVariant() === "machine" ? createMachine() : createReference());
