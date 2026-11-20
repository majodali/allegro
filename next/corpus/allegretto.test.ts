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
// next/bootstrap/fixtures/. Chunk Q7 (the minimal launcher and the output
// capability), part 3, added the `// input:`, `// later:` and
// `// end: waiting:` lines and the programs that use them, under m1/ and
// m3/. Chunk Q5, part 4, added the programs for the forms as they stood
// on 2026-11-19, under m3/. Chunk Q5, part 5, and chunk Q7, part 4, added
// imports and the `// end: refused:` line, and the programs that use
// them: a program that imports texts of its own is `main.alg` in a
// directory beside them. Chunk Q7, part 5, added the timer capability,
// which the runner grants on a virtual clock (`virtualClock` of
// next/launch/clock.ts), the programs of milestone 2 under m2/, and the
// programs under m3/ that show the forms over answers that arrive late.
//
// Each program is emitted, with the texts it imports, and launched by `runProgram` of
// next/corpus/allegretto.ts, the implementation the harness's mode
// `--next` uses too, and its lines, end and yielded keys are compared with
// its `// expect:`, `// end:` and `// yields:` lines, and the lines printed
// before each later phase with the place of its `// later:` line.

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
import { FORMS, type FormId } from "../bootstrap/emit.js";
import { drive } from "../bootstrap/driver.js";
import { emitted, isImportedText, milestoneOf, programFiles, readPins, readUnder, runProgram, PROGRAMS_DIR, STEPS } from "./allegretto.js";

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

test("the programs written for the forms as they stood on 2026-11-19 are there, in milestone 3's directory", () => {
  for (const name of ["sync-block", "dropped-failure", "handle", "arrow-binding", "data", "keys", "refuse", "assume-undecided", "least-integer", "namespaces"])
    assert.ok(FILES.includes(`${PROGRAMS_DIR}/m3/${name}.alg`), name);
});

test("the programs that use inputs are there, in milestone 1's directory and milestone 3's", () => {
  for (const name of ["m1/phase-fills-input", "m1/phase-re-evaluates", "m1/input-filled-once", "m1/unknown-condition", "m3/input-at-start", "m3/input-not-supplied", "m3/input-later-binding"])
    assert.ok(FILES.includes(`${PROGRAMS_DIR}/${name}.alg`), name);
  assert.equal(milestoneOf(`${PROGRAMS_DIR}/m1/a.alg`), 1);
});

test("the programs that wait on the timer are there: milestone 2's under m2/, and the forms over late answers under m3/", () => {
  for (const name of [
    "m2/delay-pending", "m2/delay-propagates", "m2/print-defers", "m2/independent-waits", "m2/dependent-chain", "m2/later-entry",
    "m2/module-waits/main", "m2/module-without-timer/main", "m2/print-capability", "m2/top-level-print",
    "m3/wait-statements", "m3/wait-sync", "m3/wait-then", "m3/wait-claim", "m3/wait-each", "m3/wait-each-at-once", "m3/wait-each-within", "m3/wait-all",
  ]) assert.ok(FILES.includes(`${PROGRAMS_DIR}/${name}.alg`), name);
});

test("the runner grants timer on a virtual clock: the lines print in the order the waits fall due, and no wait is waited in real time", async () => {
  const program = [
    "capability output",
    "capability timer",
    'slow <- output.write("slow " ++ int.text(timer.wait(9223372036854775807)))',
    'fast <- output.write("fast " ++ int.text(timer.wait(4611686018427387904)))',
    'equal <- output.write("equal " ++ int.text(timer.wait(4611686018427387904)))',
    "// expect: fast 4611686018427387904",
    "// expect: equal 4611686018427387904",
    "// expect: slow 9223372036854775807",
    "// end: completed",
  ].join("\n");
  assert.deepEqual((await runProgram(program)).problems, []);
});

test("the input lines are read as the convention states: at the start, and each later phase with the expect lines above it", () => {
  const pins = readPins([
    "capability output",
    "// input: a = 1",
    "//input:b=`x",
    "// expect: one",
    "// later: c = {k: [1, 2]}",
    "// expect: two",
    "// expect: three",
    "// later: d = \"t\"",
    "// later: nothing here",
    "// end: waiting: the program waits on the input(s) e, which the configuration does not supply",
  ].join("\n"));
  assert.deepEqual(pins.inputs, [{ name: "a", literal: "1" }, { name: "b", literal: "`x" }]);
  assert.deepEqual(pins.later, [{ name: "c", literal: "{k: [1, 2]}", expectsAbove: 1 }, { name: "d", literal: '"t"', expectsAbove: 3 }]);
  assert.deepEqual(pins.malformed, ["// later: nothing here"]);
  assert.equal(pins.end, "waiting: the program waits on the input(s) e, which the configuration does not supply");
});

test("a program that waits on an input it is not given passes with its end: waiting line, and fails with another", async () => {
  const program = "capability output\ninput n\noutput.write(\"before\")\n// expect: before\noutput.write(n)\n";
  const end = "// end: waiting: the program waits on the input(s) n, which the configuration does not supply\n";
  const run = await runProgram(program + end);
  assert.deepEqual(run.problems, []);
  assert.equal(run.end, "waiting: the program waits on the input(s) n, which the configuration does not supply");
  const wrong = await runProgram(program + "// end: completed\n");
  assert.deepEqual(wrong.problems, ['ended "waiting: the program waits on the input(s) n, which the configuration does not supply", expected "completed"']);
});

test("an input line supplies the input at the start, and each later line one phase, in order", async () => {
  const program = "capability output\ninput a\ninput b\noutput.write(\"start\")\n// expect: start\noutput.write(a)\n// later: a = \"one\"\n// expect: one\noutput.write(int.text(b.n))\n// input: b = {n: -3}\n// expect: -3\n// end: completed\n";
  const run = await runProgram(program);
  assert.deepEqual(run.problems, []);
  assert.deepEqual(run.lines, ["start", "one", "-3"]);
});

test("an expect line on the wrong side of a later line fails the program", async () => {
  // "one" is printed only once the phase supplies a, so its expect line belongs below the later line.
  const above = "capability output\ninput a\noutput.write(a)\n// expect: one\n// later: a = \"one\"\n// end: completed\n";
  const run = await runProgram(above);
  assert.deepEqual(run.lines, ["one"]);
  assert.deepEqual(run.problems, ["0 line(s) were printed before the later phase that supplies a (phase 1), and 1 `// expect:` line(s) are above it"]);
  // "start" is printed before the phase, so its expect line belongs above it.
  const below = "capability output\ninput a\noutput.write(\"start\")\noutput.write(a)\n// later: a = \"one\"\n// expect: start\n// expect: one\n// end: completed\n";
  assert.deepEqual((await runProgram(below)).problems, ["1 line(s) were printed before the later phase that supplies a (phase 1), and 0 `// expect:` line(s) are above it"]);
});

test("a later line whose phase is never applied, a value that is not a literal, and a malformed line each fail the program", async () => {
  const unused = await runProgram("capability output\ninput a\noutput.write(\"done\")\n// expect: done\n// later: a = 1\n// end: completed\n");
  assert.deepEqual(unused.problems, ["the later phase that supplies a (phase 1) was not applied"]);
  const notLiteral = await runProgram("capability output\ninput a\noutput.write(a)\n// input: a = x\n// end: completed\n");
  assert.equal(notLiteral.problems.length, 1);
  assert.match(notLiteral.problems[0], /^an input's value is a literal: .*; "x" holds the name x$/);
  const malformed = await runProgram("capability output\ninput a\noutput.write(a)\n// input: a\n// end: completed\n");
  assert.deepEqual(malformed.problems, ['the line "// input: a" is not of the form name = <literal>']);
  const twice = await runProgram("capability output\ninput a\noutput.write(a)\n// input: a = \"x\"\n// input: a = \"y\"\n// end: completed\n");
  assert.deepEqual(twice.problems, ["the input a has two `// input:` lines"]);
});

test("what a module yields is read with its inputs handed in: at the start, and filled by its later phases", async () => {
  const run = await runProgram("capability output\ninput a\ninput b\nsum = a + b\noutput.write(int.text(sum))\n// input: a = 1\n// later: b = 2\n// expect: 3\n// yields: sum\n// end: completed\n");
  assert.deepEqual(run.problems, []);
  assert.deepEqual(run.yields, ["sum"]);
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
  assert.deepEqual(pins, {
    lines: ["7", ""],
    end: "refuted: division by zero",
    yields: ["a", "b"],
    realises: ["test:base:addition", "test:base:precedence: * before +"],
    inputs: [],
    later: [],
    malformed: [],
  });
  assert.equal(milestoneOf(`${PROGRAMS_DIR}/m3/a.alg`), 3);
  assert.equal(milestoneOf(`${PROGRAMS_DIR}/a.alg`), null);
  assert.equal(milestoneOf(`${PROGRAMS_DIR}/m3/x/a.alg`), null);
});

for (const file of FILES) {
  test(`program ${file}: the lines it prints, how it ends, and what it yields`, async () => {
    const run = await runProgram(text(file), file);
    // A text the driver refuses has findings, and its end states one of them; any other has none.
    if (run.findings.length > 0) assert.match(run.pins.end ?? "", /^refused: /);
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
    const primitives = new Map([...e.imports, doc].flatMap((d) => d.needs).map((n) => [n.hash, k.primitiveFunction(byHash.get(n.hash)!)] as const));
    for (const d of e.imports) load(k, d, primitives);
    const fn = load(k, doc, primitives);
    assert.equal(typeof k.moduleOf(fn), "string", `${file}: the record is a module, with an identity`);
    const capability = k.structure([[k.symbol("write"), k.primitiveFunction(outputWrite(() => {}))]]);
    const r = k.evaluate(k.expression(fn, [capability]), { steps: STEPS });
    assert.equal(r.refuted, false, file);
    // A yielded function is the module's own value: apply it through the interface.
    const double = k.entriesOf(r.value).find(([key]) => key !== null && k.symbolName(key) === "double");
    if (double !== undefined) {
      const seven = k.bits(Uint8Array.of(0, 0, 0, 0, 0, 0, 0, 7));
      const applied = k.evaluate(k.expression(double[1] as Value, [seven]));
      assert.deepEqual([...k.bitsOf(applied.value).bytes], [0, 0, 0, 0, 0, 0, 0, 14], file);
    }
  }
});

test("a program may import: its imported texts are in a directory of its own beside main.alg, and they are no programs", () => {
  assert.equal(milestoneOf(`${PROGRAMS_DIR}/m3/x/main.alg`), 3);
  assert.equal(milestoneOf(`${PROGRAMS_DIR}/m3/x/lib.alg`), null);
  assert.equal(isImportedText(`${PROGRAMS_DIR}/m3/x/lib.alg`), true);
  assert.equal(isImportedText(`${PROGRAMS_DIR}/m3/x/main.alg`), false);
  assert.equal(isImportedText(`${PROGRAMS_DIR}/m3/lib.alg`), false);
  assert.equal(isImportedText(`${PROGRAMS_DIR}/m3/x/y/lib.alg`), false);
  for (const f of FILES) assert.equal(isImportedText(f), false, f);
  for (const name of ["module-load", "module-constants", "module-transitive", "module-cycle", "module-shared", "module-empty", "module-recursive", "extension", "import-with", "import-without", "import-key", "import-unused"])
    assert.ok(FILES.includes(`${PROGRAMS_DIR}/m3/${name}/main.alg`), name);
  assert.ok(!FILES.includes(`${PROGRAMS_DIR}/m3/module-shared/shared.alg`));
});

test("a program that imports is emitted with its imported texts and launched with their records, read through the reader it is given", async () => {
  const files: Record<string, string> = { [path.join("dir", "lib.alg")]: 'capability output\noutput.write("lib")\nexport n = 41\n' };
  const main = "capability output\nimport lib\noutput.write(int.text(lib.n + 1))\n// expect: lib\n// expect: 42\n// yields: lib\n// end: completed\n";
  const run = await runProgram(main, path.join("dir", "main.alg"), (f) => files[f]);
  assert.deepEqual(run.problems, []);
  assert.deepEqual(run.yields, ["lib"]);
});

test("an expected refusal: a text the driver refuses passes where its end states one finding's message and nothing else is stated", async () => {
  const text = "capability output\noutput.write(x)\noutput.write(y)\n";
  const first = await runProgram(text + "// end: refused: the name x is bound nowhere in the text\n");
  assert.deepEqual(first.problems, []);
  assert.equal(first.end, "refused: the name x is bound nowhere in the text");
  assert.deepEqual((await runProgram(text + "// end: refused: the name y is bound nowhere in the text\n")).problems, []);
  const wrong = await runProgram(text + "// end: refused: the name z is bound nowhere in the text\n");
  assert.deepEqual(wrong.problems, ["the emitter refuses the text: <text>:2:14: the name x is bound nowhere in the text; <text>:3:14: the name y is bound nowhere in the text"]);
  const completed = await runProgram(text + "// end: completed\n");
  assert.equal(completed.problems.length, 1);
  const withLine = await runProgram(text + "// expect: never\n// end: refused: the name x is bound nowhere in the text\n");
  assert.deepEqual(withLine.problems, ["nothing was launched, and 1 `// expect:` line(s) are stated"]);
  const notFound = await runProgram("import lib\n// end: refused: the text lib.alg, which import lib names, is not found in the directory of main.alg\n", "dir/main.alg", () => undefined);
  assert.deepEqual(notFound.problems, []);
});

test("a module that declares no capability still yields: it is handed only what it declares", async () => {
  const run = await runProgram("double(n) => n * 2\ndouble(2)\n// yields: double\n// end: completed\n");
  assert.deepEqual(run.problems, []);
  assert.deepEqual(run.yields, ["double"]);
});

test("the programs and the texts they import write every form of forms.md §2, import and its with and without among them", () => {
  const used = new Set<FormId>();
  for (const file of FILES) {
    const r = drive(text(file), file, readUnder(ROOT));
    if (r.ok) for (const record of r.records) for (const f of record.forms) used.add(f);
  }
  const missing = (Object.keys(FORMS) as FormId[]).filter((f) => !used.has(f));
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
