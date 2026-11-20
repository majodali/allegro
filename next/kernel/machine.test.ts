// The kernel's tests, run on the variant that evaluates with a stack of
// its own (next/kernel/machine.ts).
//
// The tests are the same files the reference kernel is tested by. Each
// makes its kernel through next/kernel/create.ts, which reads the
// environment variable ALLEGRO_KERNEL. This file sets it and loads them.
// The test runner gives each test file a process of its own, so the
// reference's run of the same files is not touched.

import assert from "node:assert/strict";
import { test } from "node:test";

process.env.ALLEGRO_KERNEL = "machine";

const { chosenVariant, createKernel } = await import("./create.js");

test("the variable chooses the variant, and a name that is no variant is refused", () => {
  assert.equal(chosenVariant(), "machine");
  assert.match(createKernel().variant, /^machine-/, "the kernel these tests run on is the machine");
  process.env.ALLEGRO_KERNEL = "reference";
  assert.match(createKernel().variant, /^reference-/);
  process.env.ALLEGRO_KERNEL = "neither";
  assert.throws(() => createKernel(), /ALLEGRO_KERNEL/);
  process.env.ALLEGRO_KERNEL = "machine";
});

await import("./kernel.test.js");
await import("./saved-program.test.js");
await import("../prims/prims.test.js");
