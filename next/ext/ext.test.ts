// The tests of the extensions written in Allegretto under next/ext/.
//
// Whose: the kernel stream (lane R). Decision: "The parser engine and the
// module loader are written in Allegretto", test first and in small
// steps (docs/plans/book-pass.md section 10).
//
// A test is an Allegretto module, `<name>.test.alg`, beside what it
// tests. Each of its claims is an assertion. It states what it prints
// and how it ends in the lines the acceptance stream's corpus uses:
// `// expect:`, `// end:` and `// summary:`. It passes where it prints
// that, ends so, and every claim is decided.
//
// Reading a test's text and running it is the acceptance stream's code
// (next/corpus/allegretto.ts, next/launch/), called here and not changed.
// A module a test imports is `<name>.alg` in the test's own directory.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { emitted, runProgram } from "../corpus/allegretto.js";
import { launch } from "../launch/launcher.js";
import { output } from "../launch/output.js";
import { chosenVariant, createKernel } from "../kernel/create.js";
import { shipped } from "../prims/index.js";

const ROOT = "next/ext";

// These modules are run on the machine. The reference kernel evaluates on the host's own stack, and a
// map of fifty entries is already deeper than that stack allows: it ends such a run as out of budget.
// So where the environment asks for the reference, the tests that run a module are left out and say so.
const DEPTH = chosenVariant() === "reference" ? { skip: "the reference kernel evaluates on the host's stack, which these modules outgrow" } : {};

/** Every `*.test.alg` under next/ext/, in name order. */
function testFiles(dir: string): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((d) => (d.isDirectory() ? testFiles(path.join(dir, d.name)) : d.name.endsWith(".test.alg") ? [path.join(dir, d.name)] : []))
    .sort();
}

/** Runs a text with a budget of its own, and gives how it ended, what it printed, the steps and the time. */
async function timed(text: string, file: string, steps: number): Promise<{ end: string; lines: string[]; steps: number; ms: number }> {
  const e = emitted(text, file);
  if ("findings" in e) throw new Error(`the text is refused: ${e.findings.join("; ")}`);
  const before = Date.now();
  const outcome = await launch({ createKernel, program: e.program, imports: e.imports, configuration: { ceiling: ["output"], steps }, target: { capabilities: [output], primitives: shipped } });
  return { end: outcome.end.kind, lines: outcome.lines, steps: "steps" in outcome.end ? outcome.end.steps : -1, ms: Date.now() - before };
}

const files = testFiles(ROOT);

test("there are tests to run", () => {
  assert.ok(files.length >= 2, `${files.length} test module(s) under ${ROOT}`);
});

for (const file of files)
  test(`${file}: prints what it states, ends as it states, and every claim is decided`, DEPTH, async () => {
    const run = await runProgram(fs.readFileSync(file, "utf8"), file);
    assert.deepEqual(run.findings, [], "the text is read");
    assert.deepEqual(run.problems, []);
    assert.equal(run.end, "completed");
    assert.equal(run.result?.summary, "decided", "every claim is decided");
    assert.ok((run.result?.claims.length ?? 0) > 0, "it claims something");
  });

test("a test module with a claim that is not true does not pass", async () => {
  const text = 'capability output\nimport map\nclaim(map.size(map.store(map.empty, 3, 1)) == 2)\noutput.write("done")\n// expect: done\n// end: completed\n';
  const run = await runProgram(text, "next/ext/lib/failing.test.alg");
  assert.notEqual(run.end, "completed");
  assert.equal(run.result?.summary, "refuted");
});

test("a key of a map is a whole number from zero: storing under a key below zero is refuted, and does not run on", async () => {
  const text = 'capability output\nimport map\noutput.write(int.text(map.size(map.store(map.empty, 0 - 1, 1))))\n// end: completed\n';
  const run = await runProgram(text, "next/ext/lib/negative.test.alg");
  assert.equal(run.result?.summary, "refuted");
  assert.deepEqual(run.lines, []);
});

// ---- The map, measured ---------------------------------------------------------

/** A program that stores n values in a map and reads each back. */
const mapProgram = (n: number): string =>
  [
    "capability output",
    "import map",
    "fill(m, n) => if n == 0 then m else fill(map.store(m, n - 1, n), n - 1)",
    "sum(m, n, total) => if n == 0 then total else sum(m, n - 1, total + map.find(m, n - 1)[0])",
    `output.write(int.text(sum(fill(map.empty, ${n}), ${n}, 0)))`,
    "",
  ].join("\n");

test("a map of ten thousand entries is built and read, and the work grows with its size", DEPTH, async () => {
  const [small, large] = [await timed(mapProgram(2_500), "next/ext/lib/measure.alg", 50_000_000), await timed(mapProgram(10_000), "next/ext/lib/measure.alg", 50_000_000)];
  assert.equal(small.end, "completed");
  assert.equal(large.end, "completed");
  assert.deepEqual(small.lines, [String((2_500 * 2_501) / 2)]);
  assert.deepEqual(large.lines, [String((10_000 * 10_001) / 2)]);
  // Four times the entries: a little more than four times the steps, since a key four times as large is two nodes deeper.
  const growth = large.steps / small.steps;
  assert.ok(growth > 3.5 && growth < 5, `four times the entries took ${growth.toFixed(2)} times the steps (${small.steps} and ${large.steps})`);
  console.log(`map: 2,500 entries ${small.steps} steps ${small.ms} ms; 10,000 entries ${large.steps} steps ${large.ms} ms`);
});
