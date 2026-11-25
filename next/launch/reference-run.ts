// This stream's tests, run on the reference kernel (B-196 (the rebuild's
// acceptance side), chunk Q13 (check and run as configurations, and what a
// result holds)). The maintainer ruled on 2026-11-23 that the command line
// alone chooses, so no test here reads or sets the environment.
//
// The tests are the same files `npm run test:next` runs on the launcher's
// default, the machine. Each makes its kernel by `createKernel` of
// next/launch/kernel-variant.ts, and each that spawns a command passes it
// `--kernel` with the variant in use. This file switches the helper to the
// reference with `useVariant` and loads them again. The node test runner
// gives each test file a process of its own, so the machine's run of the
// same files is not touched.
//
// Run by `npm run test:next:reference`, a command of its own, and by no
// glob of `npm run test:next`: its name does not end in `.test.ts` on
// purpose. Run beside the other tests it doubled the load on the machine,
// and a test of the kernel stream that holds a time (a module of 200 lines
// read in under 10 seconds) took 9.2 s in CI where it takes 4.1 s on main,
// and then 12.5 s. CI runs the two commands one after the other.
//
// The files loaded are those of next/launch/, next/corpus/,
// next/bootstrap/ and next/tools/ that make a kernel, directly or through
// the code they call. The kernel stream's own tests run on the reference
// through next/kernel/reference.test.ts.

import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_KERNEL, createKernel, useVariant, usedVariant, variantFinding } from "./kernel-variant.js";

useVariant("reference");

test("the helper gives the variant switched to, and refuses a name that is no variant", () => {
  assert.equal(DEFAULT_KERNEL, "machine", "the launcher's default");
  assert.equal(usedVariant(), "reference");
  assert.match(createKernel().variant, /^reference-/, "the kernel these tests run on is the reference");
  assert.throws(() => useVariant("neither"), /"neither", which names no kernel variant: the variants are reference and machine/);
  assert.equal(variantFinding("machine"), undefined);
  useVariant("machine");
  assert.match(createKernel().variant, /^machine-/);
  useVariant("reference");
  assert.equal(usedVariant(), "reference");
});

await import("./files.test.js");
await import("./http.test.js");
await import("./launcher.test.js");
await import("./report.test.js");
await import("./test-output.test.js");
await import("./timer.test.js");
await import("../corpus/allegretto.test.js");
await import("../corpus/harness.test.js");
await import("../corpus/speed/speed.test.js");
await import("../bootstrap/driver.test.js");
await import("../bootstrap/emit.test.js");
await import("../bootstrap/literal.test.js");
await import("../tools/configuration.test.js");
