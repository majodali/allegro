// The speed tests of milestone 3 (B-196 (the rebuild's acceptance side),
// chunk Q8 (the speed tests of milestone 3)), at their pinned size: each
// Allegretto program under next/corpus/speed/ prints its `// expect:` lines
// and ends as its `// end:` line says, on every `npm run test:next`. The
// measured sizes are run by `npm run bench:next` (next/corpus/speed/bench.ts)
// only, never here.
// The bench's search for the largest size that completes (`largest`) is
// tested here on a clock the test moves, with no real run. Its `--kernel`
// is tested on a name that is no variant, which it refuses before it runs
// anything.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "child_process";
import { runProgram } from "../allegretto.js";
import { largest } from "./bench.js";
import { emitTimed, flatInput, nestedInput, read, ROOT, runNew, SPEED_DIR, typedLines, withInput, withSizes } from "./programs.js";

for (const name of ["parser", "typed"]) {
  test(`speed program ${name}.alg at its pinned size: the lines it prints and how it ends`, async () => {
    const file = `${SPEED_DIR}/${name}.alg`;
    const run = await runProgram(read(file), file);
    assert.deepEqual(run.problems, []);
    assert.ok(run.pins.lines.length > 0);
  });
}

test("the bench's texts: the parser at two terms and nested twice, the typed program at sizes of its own", async () => {
  const parser = read(`${SPEED_DIR}/parser.alg`);
  const flat = await runNew(emitTimed(withInput(parser, flatInput(2))).program);
  assert.equal(flat.end.kind, "completed");
  assert.deepEqual(flat.lines, ["value 158, nodes 250"]);
  const nested = await runNew(emitTimed(withInput(parser, nestedInput(2))).program);
  assert.deepEqual(nested.lines, ["value 7, nodes 52"]);
  const sizes = { squares: 4, letters: 5, halving: 6 };
  const typed = await runNew(emitTimed(withSizes(read(`${SPEED_DIR}/typed.alg`), sizes)).program);
  assert.equal(typed.end.kind, "completed");
  assert.deepEqual(typed.lines, typedLines(sizes));
  assert.deepEqual(typedLines(sizes), ["30", "bcabc", "91", "dispatch by type"]);
});

test("dispatch is by the left operand's type, and a right operand of another type is refuted by the claim", async () => {
  const typed = read(`${SPEED_DIR}/typed.alg`);
  const head = typed.slice(0, typed.search(/^squares = /m));
  for (const [line, end] of [
    ["output.write(show(plus(anInt(2), anInt(3))))", ["5"]],
    ["output.write(show(plus(aText(\"2\"), aText(\"3\"))))", ["23"]],
  ] as const) {
    const r = await runNew(emitTimed(`${head}${line}\n`).program);
    assert.deepEqual(r.lines, end);
  }
  const mixed = await runNew(emitTimed(`${head}output.write(show(plus(anInt(1), aText("a"))))\n`).program);
  assert.equal(mixed.end.kind, "refuted");
  assert.equal(mixed.end.kind === "refuted" ? mixed.end.reason : "", "a claim that is not true");
});

// ---- The bench's search for the largest size that completes ---------------------------

test("the search finds the largest size that completes, by doubling then halving", async () => {
  assert.deepEqual(await largest(async (n) => n <= 37), { n: 37, capped: false, long: false });
  assert.deepEqual(await largest(async (n) => n <= 1), { n: 1, capped: false, long: false });
  assert.deepEqual(await largest(async () => false), { n: null, capped: false, long: false });
});

test("the search ends its doubling at the cap where every run completes", async () => {
  const asked: number[] = [];
  const found = await largest(async (n) => { asked.push(n); return true; }, 64);
  assert.deepEqual(found, { n: 64, capped: true, long: false });
  assert.equal(Math.max(...asked), 64);
});

test("the search ends at the first run that completes but takes too long, and asks no larger size", async () => {
  // A clock the test moves: a run of size n takes n of its units.
  let clock = 0;
  const asked: number[] = [];
  const found = await largest(async (n) => { asked.push(n); clock += n; return true; }, 1 << 16, 10, () => clock);
  assert.deepEqual(found, { n: 16, capped: false, long: true });
  assert.deepEqual(asked, [1, 2, 4, 8, 16]);
});

test("the bench refuses a kernel variant's name that is no variant before it runs anything, exit 1, and takes no other argument", () => {
  const bench = (...args: string[]) => spawnSync(process.execPath, ["--import", "tsx", `${SPEED_DIR}/bench.ts`, ...args], { cwd: ROOT, encoding: "utf8", timeout: 60000 });
  const refused = bench("--kernel", "neither");
  assert.equal(refused.stdout, "");
  assert.equal(refused.stderr, 'the setting kernel is "neither", which names no kernel variant: the variants are reference and machine\n');
  assert.equal(refused.status, 1);
  const other = bench("--fast");
  assert.equal(other.stderr, "usage: npm run bench:next [-- --kernel <reference|machine>]\n");
  assert.equal(other.status, 1);
});
