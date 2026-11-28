// The worked examples of `use`, run.
//
// Whose: the kernel stream (lane R). The texts of next/ext/examples/ are
// examples of the rules by which a text changes the grammar it is read
// in, written to be read. A text named `*.main.alg` is a program: it
// states the lines it writes with `// expect:`, or why it is refused with
// `// refused:`, the beginning of the finding. The other texts are the
// modules the programs use. Each program is read by the engine in turns
// with its grammar and run through the kernel (next/ext/run.ts).
//
// The examples of the engine's other rules are the modules
// next/ext/lib/examples_*.test.alg, which next/ext/ext.test.ts runs. The
// index of all of them is next/ext/examples.md.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { runTexts } from "./run.js";

const DIR = "next/ext/examples";
const all = fs.readdirSync(DIR).filter((f) => f.endsWith(".alg")).sort();
const modules = Object.fromEntries(all.filter((f) => !f.endsWith(".main.alg")).map((f) => [f.replace(/\.alg$/, ""), fs.readFileSync(path.join(DIR, f), "utf8")]));
const programs = all.filter((f) => f.endsWith(".main.alg"));

test("there are programs to run, and each states what it writes or why it is refused", () => {
  assert.ok(programs.length >= 7, `${programs.length} programs`);
  for (const f of programs) assert.match(fs.readFileSync(path.join(DIR, f), "utf8"), /^\/\/ (expect|refused): /m, f);
});

for (const file of programs)
  test(`${DIR}/${file}: writes what it states, or is refused as it states`, () => {
    const text = fs.readFileSync(path.join(DIR, file), "utf8");
    const expected = [...text.matchAll(/^\/\/ expect: (.*)$/gm)].map((m) => m[1]);
    const refused = /^\/\/ refused: (.*)$/m.exec(text)?.[1];
    const r = runTexts("main", { main: text, ...modules });
    const told = JSON.stringify({ lines: r.lines, findings: r.findings, refuted: r.refuted });
    if (refused === undefined) {
      assert.deepEqual(r.findings, [], told);
      assert.equal(r.refuted, undefined, told);
      assert.deepEqual(r.lines, expected, told);
    } else {
      assert.deepEqual(r.lines, [], told);
      assert.equal(r.findings.length, 1, told);
      assert.ok(r.findings[0].startsWith(`main: ${refused}`), told);
    }
  });
