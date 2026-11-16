// The Allegretto programs of the acceptance corpus (B-196 (the rebuild's
// acceptance side)), under next/corpus/allegretto/, one directory per
// milestone; the convention is next/corpus/allegretto/README.md. Run by
// `npm run test:next`.
//
// Milestone 3's thirteen programs were written in chunk Q5 (the first
// notation and the bootstrap), part 3: "programs in the first notation
// run: functions, recursion, claims". By the fifth answer of
// next/ext/allegretto/forms.md §6 they are Allegretto texts written for the
// purpose. Chunk Q6 (the comparison harness), part 2, moved them here from
// next/bootstrap/fixtures/.
//
// Each program is emitted and launched by `runProgram` of
// next/corpus/allegretto.ts, the implementation the harness's mode
// `--next` uses too, and its lines, end and yielded keys are compared with
// its `// expect:`, `// end:` and `// yields:` lines.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { spawnSync } from "child_process";
import { createKernel } from "../kernel/create.js";
import type { Value } from "../kernel/interface.js";
import { load } from "../kernel/saved-program.js";
import { outputWrite } from "../launch/output.js";
import { shippedByName } from "../prims/index.js";
import { emit, FORMS, type FormId } from "../bootstrap/emit.js";
import { emitted, milestoneOf, programFiles, readPins, runProgram, PROGRAMS_DIR, STEPS } from "./allegretto.js";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const FILES = programFiles(ROOT);
const text = (file: string): string => fs.readFileSync(path.join(ROOT, file), "utf8");

test("the programs written for milestone 3 are there, each in its milestone's directory", () => {
  for (const name of [
    "hello", "function", "order-free", "effects", "factorial", "even-odd", "structure",
    "claim-holds", "claim-refuted", "divide-by-zero", "operators", "module-open", "module-export",
  ]) assert.ok(FILES.includes(`${PROGRAMS_DIR}/m3/${name}.alg`), name);
  for (const f of FILES) assert.notEqual(milestoneOf(f), null, `${f} is not under a directory m<milestone>`);
});

test("a program's comments are read as the convention states", () => {
  const pins = readPins([
    "// realises: test:base:addition",
    "//realises:   test:base:precedence: * before +  ",
    "capability output",
    "// expect: 7",
    "// expect:",
    "// yields: a, b",
    "// end: refuted: division by zero",
  ].join("\n"));
  assert.deepEqual(pins, { lines: ["7", ""], end: "refuted: division by zero", yields: ["a", "b"], realises: ["test:base:addition", "test:base:precedence: * before +"] });
  assert.equal(milestoneOf(`${PROGRAMS_DIR}/m3/a.alg`), 3);
  assert.equal(milestoneOf(`${PROGRAMS_DIR}/a.alg`), null);
  assert.equal(milestoneOf(`${PROGRAMS_DIR}/m3/x/a.alg`), null);
});

for (const file of FILES) {
  test(`program ${file}: the lines it prints, how it ends, and what it yields`, async () => {
    const run = await runProgram(text(file), file);
    assert.deepEqual(run.findings, []);
    assert.deepEqual(run.lines, run.pins.lines);
    assert.ok(run.pins.end !== undefined, "every program states how it ends");
    assert.equal(run.end, run.pins.end);
    if (run.pins.yields !== undefined) assert.deepEqual(run.yields, run.pins.yields);
    assert.deepEqual(run.problems, []);
  });
}

test("what a module yields, read through the kernel's interface: all its bindings, or those marked export", () => {
  const stated = FILES.filter((f) => readPins(text(f)).yields !== undefined);
  assert.ok(stated.length >= 2);
  for (const file of stated) {
    const e = emitted(text(file), file);
    assert.ok("program" in e, file);
    const doc = e.program;
    const k = createKernel();
    const byHash = new Map([...shippedByName.values()].map((p) => [p.hash, p] as const));
    const primitives = new Map(doc.needs.map((n) => [n.hash, k.primitiveFunction(byHash.get(n.hash)!)] as const));
    const fn = load(k, doc, primitives);
    assert.equal(typeof k.moduleOf(fn), "string", `${file}: the record is a module, with an identity`);
    const capability = k.structure([[k.symbol("write"), k.primitiveFunction(outputWrite(() => {}))]]);
    const r = k.evaluate(k.expression(fn, [capability]), k.scope(), { steps: STEPS });
    assert.equal(r.refuted, false, file);
    // A yielded function is the module's own value: apply it through the interface.
    const double = k.entriesOf(r.value).find(([key]) => key !== null && k.symbolName(key) === "double");
    if (double !== undefined) {
      const seven = k.bits(Uint8Array.of(0, 0, 0, 0, 0, 0, 0, 7));
      const applied = k.evaluate(k.expression(double[1] as Value, [seven]), k.scope());
      assert.deepEqual([...k.bitsOf(applied.value).bytes], [0, 0, 0, 0, 0, 0, 0, 14], file);
    }
  }
});

test("the programs write every form of forms.md §2 that the launcher can run: all but input and import", () => {
  const used = new Set<FormId>();
  for (const file of FILES) {
    const r = emit(text(file));
    if (r.ok) for (const f of r.forms) used.add(f);
  }
  const missing = (Object.keys(FORMS) as FormId[]).filter((f) => !used.has(f) && f !== "input" && f !== "import");
  assert.deepEqual(missing, []);
});

test("npm run allegretto emits and launches in one step: it prints the lines, and exits 0 on completed and 1 otherwise", () => {
  const run = (file: string) => spawnSync(process.execPath, ["--import", "tsx", "next/launch/allegretto.ts", file], { cwd: ROOT, encoding: "utf8", timeout: 30000 });
  const hello = run("next/launch/fixtures/hello.alg");
  assert.equal(hello.stderr, "");
  assert.equal(hello.stdout, "hello, world\n");
  assert.equal(hello.status, 0);
  const refuted = run(`${PROGRAMS_DIR}/m3/claim-refuted.alg`);
  assert.equal(refuted.stdout, "before the claim\n");
  assert.equal(refuted.stderr, "refuted: a claim that is not true\n");
  assert.equal(refuted.status, 1);
  const budget = spawnSync(process.execPath, ["--import", "tsx", "next/launch/allegretto.ts", `${PROGRAMS_DIR}/m3/factorial.alg`, "--steps", "3"], { cwd: ROOT, encoding: "utf8", timeout: 30000 });
  assert.equal(budget.stderr, "limit: the step budget of 3 ran out\n");
  assert.equal(budget.status, 1);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "allegretto-run-"));
  try {
    const bad = path.join(dir, "bad.alg");
    fs.writeFileSync(bad, "capability output\noutput.write(greeting)\n");
    const refusedText = run(bad);
    assert.equal(refusedText.stdout, "");
    assert.equal(refusedText.stderr, `${bad}:2:14: the name greeting is bound nowhere in the text\n`);
    assert.equal(refusedText.status, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
