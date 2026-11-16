// The programs of milestone 3 (B-196 (the rebuild's acceptance side), chunk
// Q5 (the first notation and the bootstrap), part 3): "programs in the
// first notation run: functions, recursion, claims". By the fifth answer
// of next/ext/allegretto/forms.md §6 they are Allegretto texts written for
// the purpose, here under next/bootstrap/fixtures/. Run by
// `npm run test:next`.
//
// Each fixture states what it must do in comments, in the present tree's
// pin style:
//   // expect: <line>     each line the program prints, in order;
//   // end: <how>         how the run ends: `completed`, or `refuted: <the
//                          reason the kernel gives>`;
//   // yields: a, b       the keys of the structure the module yields, in
//                          order, read through the kernel's interface.
// The test emits each text with next/bootstrap/emit.ts and runs the record
// with the launcher of next/launch/launcher.ts on the reference kernel, the
// output capability and the shipped primitives, and compares the lines and
// the end. Where a fixture states `yields`, the record is also loaded
// into a kernel and the module instantiated by hand, since nothing imports
// a module yet.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { spawnSync } from "child_process";
import { createKernel } from "../kernel/create.js";
import type { Value } from "../kernel/interface.js";
import { encode, load, type SavedProgram } from "../kernel/saved-program.js";
import { launch } from "../launch/launcher.js";
import { output, outputWrite } from "../launch/output.js";
import { shipped, shippedByName } from "../prims/index.js";
import { emit, FORMS, type FormId } from "./emit.js";

const here = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(here, "../..");
const DIR = path.join(here, "fixtures");
const FILES = fs.readdirSync(DIR).filter((f) => f.endsWith(".alg")).sort();

interface Pins {
  readonly lines: string[];
  readonly end: string;
  readonly yields: string[] | undefined;
}

/** What a fixture's comments say it must do. */
function pins(text: string): Pins {
  const lines: string[] = [];
  let end: string | undefined;
  let yields: string[] | undefined;
  for (const line of text.split("\n")) {
    const m = /^\s*\/\/\s*(expect|end|yields):\s?(.*)$/.exec(line);
    if (m === null) continue;
    if (m[1] === "expect") lines.push(m[2].trimEnd());
    else if (m[1] === "end") end = m[2].trim();
    else yields = m[2].split(",").map((s) => s.trim()).filter((s) => s !== "");
  }
  assert.ok(end !== undefined, "every fixture states how it ends");
  return { lines, end, yields };
}

function emitted(file: string): SavedProgram {
  const r = emit(fs.readFileSync(path.join(DIR, file), "utf8"));
  assert.ok(r.ok, `${file}: ${r.ok ? "" : r.findings.map((f) => f.message).join("; ")}`);
  return JSON.parse(encode(r.program)) as SavedProgram;
}

test("the fixtures of milestone 3 are there", () => {
  for (const name of [
    "hello", "function", "order-free", "effects", "factorial", "even-odd", "structure",
    "claim-holds", "claim-refuted", "divide-by-zero", "operators", "module-open", "module-export",
  ]) assert.ok(FILES.includes(`${name}.alg`), name);
});

for (const file of FILES) {
  test(`fixture ${file}: the lines it prints and how it ends`, async () => {
    const expected = pins(fs.readFileSync(path.join(DIR, file), "utf8"));
    const outcome = await launch({
      createKernel,
      program: emitted(file),
      configuration: { ceiling: ["output"], steps: 1_000_000 },
      target: { capabilities: [output], primitives: shipped },
    });
    assert.deepEqual(outcome.lines, expected.lines);
    const end = outcome.end.kind === "refuted" ? `refuted: ${outcome.end.reason}` : outcome.end.kind === "completed" ? "completed" : `${outcome.end.kind}: ${"reason" in outcome.end ? outcome.end.reason : ""}`;
    assert.equal(end, expected.end);
  });
}

test("what a module yields, read through the kernel's interface: all its bindings, or those marked export", () => {
  const stated = FILES.map((f) => [f, pins(fs.readFileSync(path.join(DIR, f), "utf8")).yields] as const).filter(([, y]) => y !== undefined);
  assert.ok(stated.length >= 2);
  for (const [file, yields] of stated) {
    const doc = emitted(file);
    const k = createKernel();
    const byHash = new Map([...shippedByName.values()].map((p) => [p.hash, p] as const));
    const primitives = new Map(doc.needs.map((n) => [n.hash, k.primitiveFunction(byHash.get(n.hash)!)] as const));
    const fn = load(k, doc, primitives);
    assert.equal(typeof k.moduleOf(fn), "string", `${file}: the record is a module, with an identity`);
    const lines: string[] = [];
    const capability = k.structure([[k.symbol("write"), k.primitiveFunction(outputWrite((l) => lines.push(l)))]]);
    const r = k.evaluate(k.expression(fn, [capability]), k.scope(), { steps: 1_000_000 });
    assert.equal(r.refuted, false, file);
    assert.equal(k.kind(r.value), "structure", file);
    const entries = k.entriesOf(r.value);
    assert.deepEqual(entries.map(([key]) => (key === null ? null : k.symbolName(key))), yields, file);
    // A yielded function is the module's own value: apply it through the interface.
    const double = entries.find(([key]) => key !== null && k.symbolName(key) === "double");
    if (double !== undefined) {
      const seven = k.bits(Uint8Array.of(0, 0, 0, 0, 0, 0, 0, 7));
      const applied = k.evaluate(k.expression(double[1] as Value, [seven]), k.scope());
      assert.deepEqual([...k.bitsOf(applied.value).bytes], [0, 0, 0, 0, 0, 0, 0, 14], file);
    }
  }
});

test("the fixtures write every form of forms.md §2 that the launcher can run: all but input and import", () => {
  const used = new Set<FormId>();
  for (const file of FILES) {
    const r = emit(fs.readFileSync(path.join(DIR, file), "utf8"));
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
  const refuted = run("next/bootstrap/fixtures/claim-refuted.alg");
  assert.equal(refuted.stdout, "before the claim\n");
  assert.equal(refuted.stderr, "refuted: a claim that is not true\n");
  assert.equal(refuted.status, 1);
  const budget = spawnSync(process.execPath, ["--import", "tsx", "next/launch/allegretto.ts", "next/bootstrap/fixtures/factorial.alg", "--steps", "3"], { cwd: ROOT, encoding: "utf8", timeout: 30000 });
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
