// Where a launcher finds the kernel: `createKernel`, of type
// `CreateKernel` (next/kernel/interface.ts). The acceptance stream's
// terminal entry, next/launch/terminal.ts, loads this file by path.
//
// There are two kernel variants (docs/plans/book-pass.md section 9). The
// one given is the machine (next/kernel/machine.ts), which evaluates with
// a stack of its own. The reference kernel (next/kernel/kernel.ts) stays
// in the tree, small and slow, to compare against: "One reference kernel
// is the root of trust". Until 2026-11-21 the reference was the one given.
//
// Nothing here reads the environment. A command that takes the variant
// as an argument makes its kernel with `createKernelOf`. `useVariant`
// makes `createKernel` give another variant from then on, in this
// process: the kernel's tests are run on the reference that way
// (next/kernel/reference.test.ts). Until 2026-12-02 the environment
// variable ALLEGRO_KERNEL chose; by the maintainer's ruling of 2026-11-23
// the command line alone chooses, and the last reader of the variable
// outside this file went with the acceptance stream's PR #320.

import type { CreateKernel } from "./interface.js";
import { createKernel as createReference } from "./kernel.js";
import { createMachine } from "./machine.js";

/** The names a kernel variant is chosen by. */
export const KERNEL_VARIANTS = ["reference", "machine"] as const;

let inUse: (typeof KERNEL_VARIANTS)[number] = "machine";

/** Makes `createKernel` give the variant named from now on, in this process. A name that is no variant is refused. */
export function useVariant(name: string): void {
  if (name !== "machine" && name !== "reference") throw new Error(`"${name}" names no kernel variant. The variants are ${KERNEL_VARIANTS.join(" and ")}.`);
  inUse = name;
}

/** The variant `createKernel` gives: the machine, or the one `useVariant` named. */
export function chosenVariant(): (typeof KERNEL_VARIANTS)[number] {
  return inUse;
}

/**
 * A kernel of the variant named. A command that takes the variant as an
 * argument uses this.
 */
export function createKernelOf(variant: string): ReturnType<CreateKernel> {
  if (variant === "machine") return createMachine();
  if (variant === "reference") return createReference();
  throw new Error(`"${variant}" names no kernel variant. The variants are ${KERNEL_VARIANTS.join(" and ")}.`);
}

export const createKernel: CreateKernel = () => createKernelOf(chosenVariant());
