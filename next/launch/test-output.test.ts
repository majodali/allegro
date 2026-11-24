// Tests of what the terminal's commands present of a test phase (B-196
// (the rebuild's acceptance side), chunk Q13 (check and run as
// configurations, and what a result holds), part 6): `testLines` and
// `testMessages` of next/launch/test-output.ts, on outcomes the launcher
// gives, and the test version of each capability the terminal's target
// for tests has (`testTarget` of next/launch/terminal.ts). Run by
// `npm run test:next`, on the kernel `createKernel` of
// next/kernel/create.ts gives. The two commands end to end are tested in
// next/launch/launcher.test.ts.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import { createKernel } from "../kernel/create.js";
import { encode, type SavedProgram } from "../kernel/saved-program.js";
import { emit } from "../bootstrap/emit.js";
import { launch, type LaunchOutcome } from "./launcher.js";
import { collector } from "./report.js";
import { testTarget } from "./terminal.js";
import { testLines, testMessages } from "./test-output.js";

const here = path.dirname(new URL(import.meta.url).pathname);
const CEILING = ["output", "timer", "http", "report"];

/** The record the emitter writes for a text named `tests.alg`, as JSON round-trips it. */
function emitted(text: string): SavedProgram {
  const r = emit(text, new Map(), "tests.alg");
  assert.ok(r.ok, r.ok ? "" : r.findings.map((f) => f.message).join("; "));
  return JSON.parse(encode(r.program)) as SavedProgram;
}
/** Launches a text under a test phase on the terminal's target for tests, with a sink that keeps the messages. */
async function tested(text: string): Promise<{ outcome: LaunchOutcome; reported: ReturnType<typeof collector> }> {
  const reported = collector();
  const outcome = await launch({
    createKernel,
    program: emitted(text),
    configuration: { ceiling: CEILING, phases: [{ name: "test", test: true, capabilities: CEILING }] },
    target: testTarget(reported.sink),
  });
  return { outcome, reported };
}

test("the lines: one for each test in order, the lines of a test that did not complete indented by two spaces, and the last line", async () => {
  const { outcome } = await tested('capability output\nexport passes() =>\n  output.write("not shown")\n  claim(1 == 1)\nexport fails() =>\n  output.write("first")\n  output.write("second")\n  claim(1 == 2)\nexport after() => claim(2 == 2)\n');
  assert.ok(outcome.tests !== undefined);
  assert.deepEqual(testLines(outcome.tests), [
    "test passes: passed",
    "test fails: refuted: a claim that is not true",
    "  first",
    "  second",
    "test after: passed",
    "tests: 2 passed, 1 failed",
  ]);
});

test("a module with no test: the last line alone", async () => {
  const { outcome } = await tested("capability output\nexport n = 1\n");
  assert.ok(outcome.tests !== undefined);
  assert.deepEqual(testLines(outcome.tests), ["tests: 0 passed, 0 failed"]);
  assert.deepEqual(testMessages(outcome.tests), []);
});

test("the messages: one for each refuted test, level error, its first reason, and the place of its first refuted claim", async () => {
  const { outcome } = await tested("capability output\nexport ok() => claim(1 == 1)\nexport bad() =>\n  claim(2 == 2)\n  claim(1 == 2)\nexport worse() => claim(3 == 4)\n");
  assert.ok(outcome.tests !== undefined);
  assert.deepEqual(testMessages(outcome.tests), [
    { level: "error", text: "test bad: a claim that is not true", file: "tests.alg", line: 5n, column: 3n },
    { level: "error", text: "test worse: a claim that is not true", file: "tests.alg", line: 6n, column: 19n },
  ]);
});

test("a test that ends at its limit or waiting gets a line and no message: only a refuted test is handed as a message", async () => {
  const reported = collector();
  const outcome = await launch({
    createKernel,
    program: emitted("capability output\ninput n\nloop(k) => if k == 0 then 0 else loop(k - 1)\nexport spins() => claim(loop(200) == 0)\nexport waits() => claim(n == 1)\n"),
    configuration: { ceiling: CEILING, steps: 200, phases: [{ name: "test", test: true, capabilities: CEILING }] },
    target: testTarget(reported.sink),
  });
  assert.ok(outcome.tests !== undefined);
  assert.deepEqual(testLines(outcome.tests), [
    "test spins: limit: the step budget of 200 ran out",
    "test waits: waiting: the program waits on the input(s) n, which the configuration does not supply",
    "tests: 0 passed, 2 failed",
  ]);
  assert.deepEqual(testMessages(outcome.tests), []);
});

test("the test versions: a wait ends at once and waits end in the order of their times; a request reaches nothing and answers unreachable; report acts", async () => {
  const { outcome, reported } = await tested([
    "capability output", "capability timer", "capability http", "capability report",
    "export waits() =>",
    "  a <- timer.wait(9000000000)",
    "  b <- then(timer.wait(1), output.write(\"short\"))",
    "  then(a, output.write(\"long\"))",
    "export requests() =>",
    "  r <- http.request({method: \"GET\", url: \"https://example.com/\"})",
    "  claim(r.failure == `unreachable)",
    "export reports() =>",
    "  report.message({level: `warning, text: \"from a test\"})",
    "  report.status(6)",
    "",
  ].join("\n"));
  assert.ok(outcome.tests !== undefined);
  assert.deepEqual(outcome.tests.tests.map((t) => [t.name, t.end.kind]), [["waits", "completed"], ["requests", "completed"], ["reports", "completed"]]);
  assert.deepEqual(outcome.tests.tests[0].lines, ["short", "long"]);
  assert.deepEqual(reported.messages, [{ level: "warning", text: "from a test" }]);
  assert.equal(reported.status(), 6);
});

test("what the commands present of a test phase reaches no host API", () => {
  const source = fs.readFileSync(path.join(here, "test-output.ts"), "utf8").replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(source, /\bprocess\.|from "fs"|from "path"|\bBuffer\b|\bglobalThis\b/);
});
