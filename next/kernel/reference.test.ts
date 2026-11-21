// The kernel's tests, run on the reference kernel (next/kernel/kernel.ts).
//
// The tests are the same files the machine is tested by. Each makes its
// kernel through next/kernel/create.ts, which gives the machine unless
// the environment variable ALLEGRO_KERNEL says "reference". This file
// sets it and loads them. The test runner gives each test file a process
// of its own, so the machine's run of the same files is not touched.
//
// "One reference kernel is the root of trust": the machine is right
// where it answers as the reference does, and where a ruled decision
// makes the two differ, the test says so and names the decision.

import assert from "node:assert/strict";
import { test } from "node:test";

process.env.ALLEGRO_KERNEL = "reference";

const { chosenVariant, createKernel } = await import("./create.js");

test("the variable chooses the variant, and a name that is no variant is refused", () => {
  assert.equal(chosenVariant(), "reference");
  assert.match(createKernel().variant, /^reference-/, "the kernel these tests run on is the reference");
  process.env.ALLEGRO_KERNEL = "machine";
  assert.match(createKernel().variant, /^machine-/);
  delete process.env.ALLEGRO_KERNEL;
  assert.match(createKernel().variant, /^machine-/, "with nothing asked for, the machine is given");
  process.env.ALLEGRO_KERNEL = "neither";
  assert.throws(() => createKernel(), /ALLEGRO_KERNEL/);
  process.env.ALLEGRO_KERNEL = "reference";
});

await import("./kernel.test.js");
await import("./saved-program.test.js");
await import("../prims/prims.test.js");
