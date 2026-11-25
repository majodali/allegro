// The kernel variant this stream's code makes a kernel of (B-196 (the
// rebuild's acceptance side), chunk Q13 (check and run as configurations,
// and what a result holds)). By the maintainer's ruling of 2026-11-23 the
// command line alone chooses: four commands take `--kernel <name>`
// (`npm run launch`, `npm run allegretto`, `npm run harness:next` and
// `npm run bench:next`), each makes its kernel by `createKernelOf` of
// next/kernel/create.ts, and none reads the environment for it.
//
// `DEFAULT_KERNEL` is the launcher's default, the variant a command makes
// where no `--kernel` names one. It is stated here and nowhere else.
// `variantFinding` is the refusal of a name that is no variant, which each
// command gives before anything is evaluated.
//
// The tests. This stream's tests make their kernel by `createKernel` of
// this file, and so does the code they call with no kernel given: the
// driver's `drive` (next/bootstrap/driver.ts), `runProgram` and
// `yieldedKeys` (next/corpus/allegretto.ts) and `runNew`
// (next/corpus/speed/programs.ts). It makes a kernel of the variant in
// use, `DEFAULT_KERNEL` until `useVariant` names another. A test that
// spawns a command passes `--kernel` with `usedVariant()`.
// next/launch/reference.test.ts calls `useVariant("reference")` and loads
// this stream's test files that make a kernel, so `npm run test:next`
// runs them on both variants. The node test runner gives each test file a
// process of its own, so the switch reaches no other file's run.
//
// Tested by next/launch/launcher.test.ts and next/launch/reference.test.ts.

import { KERNEL_VARIANTS, createKernelOf } from "../kernel/create.js";
import type { CreateKernel } from "../kernel/interface.js";

/** The launcher's default kernel variant: the one a command makes where no `--kernel` names one. */
export const DEFAULT_KERNEL = "machine";

/** The refusal of a name that is no kernel variant, listing the variants; undefined where the name is one. */
export function variantFinding(name: string): string | undefined {
  if ((KERNEL_VARIANTS as readonly string[]).includes(name)) return undefined;
  return `the setting kernel is ${JSON.stringify(name)}, which names no kernel variant: the variants are ${KERNEL_VARIANTS.join(" and ")}`;
}

/** A kernel factory of the variant named, by `createKernelOf`. */
export function kernelOf(variant: string): CreateKernel {
  return () => createKernelOf(variant);
}

let inUse: string = DEFAULT_KERNEL;

/** Makes `createKernel` give the variant named from now on, in this process. A name that is no variant is refused. */
export function useVariant(name: string): void {
  const finding = variantFinding(name);
  if (finding !== undefined) throw new Error(finding);
  inUse = name;
}

/** The variant `createKernel` gives: `DEFAULT_KERNEL`, or the one `useVariant` named. */
export function usedVariant(): string {
  return inUse;
}

/** A kernel of the variant in use. */
export const createKernel: CreateKernel = () => createKernelOf(inUse);
