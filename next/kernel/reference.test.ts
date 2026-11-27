// The kernel's tests, run on the reference kernel (next/kernel/kernel.ts).
//
// The tests are the same files the machine is tested by. Each makes its
// kernel through next/kernel/create.ts, which gives the machine unless
// `useVariant` has named another. This file names the reference and
// loads them. The test runner gives each test file a process of its own,
// so the machine's run of the same files is not touched. Nothing reads
// the environment: until 2026-12-02 the variable ALLEGRO_KERNEL chose,
// and this file set it.
//
// "One reference kernel is the root of trust": the machine is right
// where it answers as the reference does, and where a ruled decision
// makes the two differ, the test says so and names the decision.

import assert from "node:assert/strict";
import { test } from "node:test";
import { chosenVariant, createKernel, createKernelOf, useVariant } from "./create.js";

useVariant("reference");

// (Until 2026-12-02 this test set the environment variable and held that the kernel followed it, and that an
// unknown name in it was refused. The variable is no longer read, so it holds the same of `useVariant`, and
// that the variable changes nothing.)
test("`useVariant` chooses the variant, a name that is no variant is refused, and the environment is not read", () => {
  assert.equal(chosenVariant(), "reference");
  assert.match(createKernel().variant, /^reference-/, "the kernel these tests run on is the reference");
  useVariant("machine");
  assert.match(createKernel().variant, /^machine-/);
  assert.throws(() => useVariant("neither"), /"neither" names no kernel variant/);
  assert.equal(chosenVariant(), "machine", "a refused name changes nothing");
  process.env.ALLEGRO_KERNEL = "reference";
  assert.match(createKernel().variant, /^machine-/, "the variable is not read");
  delete process.env.ALLEGRO_KERNEL;
  assert.match(createKernelOf("reference").variant, /^reference-/);
  assert.throws(() => createKernelOf("neither"), /names no kernel variant/);
  useVariant("reference");
});

await import("./kernel.test.js");
await import("./saved-program.test.js");
await import("../prims/prims.test.js");
