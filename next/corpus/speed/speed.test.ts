// The speed tests of milestone 3 (B-196 (the rebuild's acceptance side),
// chunk Q8 (the speed tests of milestone 3)), at their pinned size: each
// Allegretto program under next/corpus/speed/ prints its `// expect:` lines
// and ends as its `// end:` line says, on every `npm run test:next`. The
// measured sizes are run by `npm run bench:next` (next/corpus/speed/bench.ts)
// only, never here.

import { test } from "node:test";
import assert from "node:assert/strict";
import { runProgram } from "../allegretto.js";
import { emitTimed, flatInput, nestedInput, read, runNew, SPEED_DIR, typedLines, withInput, withSizes } from "./programs.js";

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
