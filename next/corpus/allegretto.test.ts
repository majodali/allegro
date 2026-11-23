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
// Chunk Q16 (the capabilities the launchers ship), part 1, added the HTTP
// capability, which the runner grants on a scripted transport that serves
// a program's `// serves:` lines (`scriptedTransport` of
// next/launch/scripted-transport.ts), and the programs `m3/http-*.alg`.
// Chunk Q13 (check and run as configurations, and what a result holds),
// part 1, added the launcher's result to a run (`ProgramRun.result`), the
// `// summary:` line, and the program `m3/result-assumed.alg`. Chunk Q13,
// part 3, added the `// phases:` line and the programs `m3/phase-*.alg`.
// Chunk Q16, part 3, added the check-output capability, which the runner
// grants on a sink that keeps the messages and the highest status, the
// `// reports:` and `// status:` lines, and the programs `m3/report-*`.
// Chunk Q13, part 5, made `// phases: check` the kernel's check, added
// `// phases: check, run`, the `// check claim at:` line and the programs
// `m3/check-*.alg`.
//
// Each program is emitted, with the texts it imports, and launched by `runProgram` of
// next/corpus/allegretto.ts, the implementation the harness's mode
// `--next` uses too, and its lines, end, yielded keys and summary are
// compared with its `// expect:`, `// end:`, `// yields:` and `// summary:`
// lines, and the lines printed before each later phase with the place of
// its `// later:` line.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { spawnSync } from "child_process";
import { createKernel } from "../kernel/create.js";
import type { Value } from "../kernel/interface.js";
import { check2, encode, load, type SavedProgram } from "../kernel/saved-program.js";
import { outputWrite } from "../launch/output.js";
import { shippedByName } from "../prims/index.js";
import { FORMS, type FormId } from "../bootstrap/emit.js";
import { drive } from "../bootstrap/driver.js";
import { emitted, isImportedText, milestoneOf, programFiles, readClaimLines, readPhases, readPins, readReports, readServes, readStatus, readSummary, readUnder, runProgram, PROGRAMS_DIR, STEPS } from "./allegretto.js";

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

test("the programs that make requests are there, in milestone 3's directory", () => {
  for (const name of ["get", "not-found", "unreachable-handled", "unreachable-dropped", "at-once", "each", "headers-body", "outside-domain"])
    assert.ok(FILES.includes(`${PROGRAMS_DIR}/m3/http-${name}.alg`), name);
});

test("the serves lines are read as the convention states: each answers one request, its body the literal's bytes, with no headers", () => {
  const r = readServes([
    "capability http",
    '// serves: GET https://example.org/?a=1 = 200 "hello"',
    '//serves:POST u = 404 ""',
    "// expect: x",
  ].join("\n"));
  assert.deepEqual(r.problems, []);
  assert.deepEqual(r.served, [
    { method: "GET", url: "https://example.org/?a=1", answer: { status: 200, headers: [], body: new TextEncoder().encode("hello") } },
    { method: "POST", url: "u", answer: { status: 404, headers: [], body: new Uint8Array(0) } },
  ]);
});

test("a malformed serves line, a body that is no text literal, and two lines for one request each fail the program, which is not launched", async () => {
  const body = 'capability output\ncapability http\noutput.write("launched")\n// expect: launched\n// end: completed\n';
  for (const [line, problem] of [
    ["// serves: GET u", 'the line "// serves: GET u" is not of the form <METHOD> <url> = <status> <literal>'],
    ['// serves: GET u = 2000 "x"', 'the line "// serves: GET u = 2000 \\"x\\"" is not of the form <METHOD> <url> = <status> <literal>'],
    ["// serves: GET u = 200 42", 'the line "// serves: GET u = 200 42" serves a body that is no text literal'],
    ['// serves: GET u = 200 "a"\n// serves: GET u = 201 "b"', "the request GET u has two `// serves:` lines"],
  ] as const) {
    const run = await runProgram(body + line + "\n");
    assert.ok(run.problems.includes(problem), `${line}: ${JSON.stringify(run.problems)}`);
    assert.deepEqual(run.lines, [], line);
  }
  const notLiteral = await runProgram(body + "// serves: GET u = 200 x\n");
  assert.ok(notLiteral.problems.some((p) => /^an input's value is a literal: .*; "x" holds the name x$/.test(p)), JSON.stringify(notLiteral.problems));
});

test("the runner grants http on a scripted transport: a served request is answered, any other is unreachable, and the requests are part of the run", async () => {
  const program = [
    "capability output",
    "capability http",
    'a <- http.request({method: "GET", url: "https://example.org/served"})',
    'b <- http.request({method: "GET", url: "https://example.org/unserved"})',
    "output.write(int.text(a.status) ++ \" \" ++ a.body)",
    'output.write(handle(b, `unreachable, f => {reason: "unreachable: " ++ f.reason}).reason)',
    '// serves: GET https://example.org/served = 503 "busy"',
    "// expect: 503 busy",
    "// expect: unreachable: nothing serves GET https://example.org/unserved",
    "// end: completed",
  ].join("\n");
  const run = await runProgram(program);
  assert.deepEqual(run.problems, []);
  assert.deepEqual(run.requests.map((r) => r.url), ["https://example.org/served", "https://example.org/unserved"]);
});

test("program m3/http-headers-body.alg hands the transport both headers, in the order written, and the body's bytes", async () => {
  const file = `${PROGRAMS_DIR}/m3/http-headers-body.alg`;
  const run = await runProgram(text(file), file);
  assert.deepEqual(run.problems, []);
  assert.deepEqual(run.requests, [
    { method: "POST", url: "https://example.org/notes", headers: [["content-type", "text/plain"], ["x-trace", "7"]], body: new TextEncoder().encode("a note") },
  ]);
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

test("every record of the programs and their imported texts checks, carries places, and has the identity it has with every place taken out", () => {
  const byHash = new Map([...shippedByName.values()].map((p) => [p.hash, p] as const));
  /** The identity of a record's module, loaded into a new kernel after the records it imports. */
  const identity = (records: readonly SavedProgram[]): string | undefined => {
    const k = createKernel();
    const primitives = new Map(records.flatMap((doc) => doc.needs).map((n) => [n.hash, k.primitiveFunction(byHash.get(n.hash)!)] as const));
    let last: Value | undefined;
    for (const doc of records) last = load(k, doc, primitives);
    return k.moduleOf(last as Value);
  };
  /** The record with `at` taken out of every node. */
  const unplaced = (doc: SavedProgram): SavedProgram => ({ ...doc, nodes: doc.nodes.map((n) => ("at" in n ? (({ at: _, ...rest }) => rest)(n) : n) as SavedProgram["nodes"][number]) });
  let records = 0;
  for (const file of FILES) {
    const r = drive(text(file), file, readUnder(ROOT));
    if (!r.ok) continue;
    const docs = r.records.map((x) => JSON.parse(encode(x.program)) as SavedProgram);
    docs.forEach((doc, i) => {
      const where = r.records[i].file;
      assert.deepEqual(check2(doc), [], where);
      assert.ok(doc.nodes.some((n) => "at" in n && n.at?.source === where), `${where}: a node carries a place in its own file`);
      const placedId = identity(docs.slice(0, i + 1));
      assert.match(placedId ?? "", /^sha256:[0-9a-f]{64}$/, where);
      assert.equal(identity([...docs.slice(0, i), unplaced(doc)]), placedId, `${where}: a place is no part of the module's identity`);
      assert.equal(placedId, r.records[i].identity, `${where}: the identity the driver took`);
      records++;
    });
  }
  assert.ok(records > 0);
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


// ── The result of a run and the summary line (chunk Q13, part 1) ──────

test("the summary line is read as the convention states: one word, a strength", () => {
  assert.deepEqual(readSummary("capability output\n//summary:   assumed  \n"), { summary: "assumed", problems: [] });
  assert.deepEqual(readSummary("capability output\n"), { summary: undefined, problems: [] });
  assert.deepEqual(readSummary("// summary: proven\n").problems, ['the line "// summary: proven" states no summary: the words are refuted, undecided, assumed, sampled, decided']);
  assert.deepEqual(readSummary("// summary: decided\n// summary: refuted\n").problems, ["the program has two `// summary:` lines"]);
});

test("a run gives the launcher's result, and a program that states a summary passes only with that word", async () => {
  const program = "capability output\nassume(1 == 1)\noutput.write(\"after\")\n// expect: after\n// end: completed\n";
  const plain = await runProgram(program);
  assert.deepEqual(plain.problems, [], "a program that states no summary is not compared on it");
  assert.equal(plain.result?.summary, "assumed");
  assert.ok(plain.result?.claims.some((c) => c.assumed > 0));
  assert.deepEqual((await runProgram(program + "// summary: assumed\n")).problems, []);
  assert.deepEqual((await runProgram(program + "// summary: decided\n")).problems, ['the summary is "assumed", expected "decided"']);
  const bad = await runProgram(program + "// summary: fine\n");
  assert.deepEqual(bad.problems, ['the line "// summary: fine" states no summary: the words are refuted, undecided, assumed, sampled, decided']);
  assert.deepEqual(bad.lines, [], "a program whose lines cannot be read is not launched");
});

test("a summary line where nothing is launched, or where the launcher refuses, fails the program", async () => {
  const notEmitted = await runProgram("capability output\noutput.write(x)\n// end: refused: the name x is bound nowhere in the text\n// summary: decided\n");
  assert.deepEqual(notEmitted.problems, ["nothing was launched, and the program states a `// summary:` line"]);
  assert.equal(notEmitted.result, undefined);
  const refusedRun = await runProgram("capability output\ninput a\noutput.write(a)\n// input: b = 1\n// end: refused: the configuration supplies the input b at the start, which the module does not declare\n// summary: decided\n");
  assert.deepEqual(refusedRun.problems, ["the launcher refused the run, and the program states the summary decided"]);
});

test("the programs that state a summary: a claim that holds, one refuted, one assumed, one undecided, and one that waits when the run ends", async () => {
  for (const [name, summary] of [
    ["claim-holds", "decided"], ["claim-refuted", "refuted"], ["result-assumed", "assumed"], ["assume-undecided", "undecided"], ["input-not-supplied", "undecided"],
  ] as const) {
    const file = `${PROGRAMS_DIR}/m3/${name}.alg`;
    assert.equal(readSummary(text(file)).summary, summary, file);
    const run = await runProgram(text(file), file);
    assert.deepEqual(run.problems, [], file);
    assert.equal(run.result?.summary, summary, file);
  }
});


// ── The claim at line (chunks Q5 and Q13, 2026-11-23) ─────────────────

test("the claim at lines are read as the convention states: a line, a column and a word, several in order", () => {
  assert.deepEqual(readClaimLines("// claim at: 2:1 decided\n//claim at:  10:7   waiting  \n"), {
    claims: [{ line: 2, column: 1, word: "decided" }, { line: 10, column: 7, word: "waiting" }],
    problems: [],
  });
  assert.deepEqual(readClaimLines("capability output\n"), { claims: [], problems: [] });
  const form = "is not of the form claim at: <line>:<column> <word>, the word one of refuted, undecided, waiting, assumed, sampled, decided";
  assert.deepEqual(readClaimLines("// claim at: 2 decided\n// claim at: 0:1 decided\n// claim at: 2:1 proven\n// claim at: 2:1\n").problems, [
    `the line "// claim at: 2 decided" ${form}`,
    `the line "// claim at: 0:1 decided" ${form}`,
    `the line "// claim at: 2:1 proven" ${form}`,
    `the line "// claim at: 2:1" ${form}`,
  ]);
});

test("a program that states a claim at a place passes only with that word; a place where no claim is written fails it", async () => {
  const program = 'capability output\nclaim(1 == 1)\nassume(2 == 2)\noutput.write("after")\nclaim(1 == 2)\n// expect: after\n// end: refuted: a claim that is not true\n';
  const plain = await runProgram(program, "dir/claims.alg");
  assert.deepEqual(plain.problems, []);
  assert.ok(plain.result?.claims.some((c) => c.at?.source === "dir/claims.alg" && c.at.start.line === 2), "each claim has its place in the program's own file");
  assert.deepEqual((await runProgram(program + "// claim at: 2:1 decided\n// claim at: 3:1 assumed\n// claim at: 5:1 refuted\n", "dir/claims.alg")).problems, []);
  assert.deepEqual((await runProgram(program + "// claim at: 2:1 assumed\n", "dir/claims.alg")).problems, ["the claim at 2:1 came out decided, expected assumed"]);
  assert.deepEqual((await runProgram(program + "// claim at: 2:2 decided\n", "dir/claims.alg")).problems, ["no claim of the result is written at 2:2 of dir/claims.alg"]);
  assert.deepEqual((await runProgram(program + "// claim at: 9:1 decided\n")).problems, ["no claim of the result is written at 9:1 of <text>"]);
  const malformed = await runProgram(program + "// claim at: two:one decided\n");
  assert.equal(malformed.problems.length, 1);
  assert.match(malformed.problems[0], /is not of the form claim at: <line>:<column> <word>/);
  assert.deepEqual(malformed.lines, [], "a program whose lines cannot be read is not launched");
});

test("a claim that still waits when the run ends is stated waiting; a claim at line where nothing is launched fails the program", async () => {
  const waits = await runProgram(
    "capability output\ninput n\nclaim(n == 1)\n// end: waiting: the program waits on the input(s) n, which the configuration does not supply\n// claim at: 3:1 waiting\n",
  );
  assert.deepEqual(waits.problems, []);
  const notEmitted = await runProgram("capability output\noutput.write(x)\n// end: refused: the name x is bound nowhere in the text\n// claim at: 2:1 decided\n");
  assert.deepEqual(notEmitted.problems, ["nothing was launched, and the program states a `// claim at:` line"]);
  const refusedRun = await runProgram("capability output\ninput a\nclaim(a == 1)\n// input: b = 1\n// end: refused: the configuration supplies the input b at the start, which the module does not declare\n// claim at: 3:1 decided\n");
  assert.deepEqual(refusedRun.problems, ["the launcher refused the run, and the program states a `// claim at:` line"]);
});


test("the programs that state claims by their place: claims that hold, one refuted, one assumed, one undecided, and one that waits when the run ends", async () => {
  for (const [name, stated] of [
    ["claim-holds", ["4:1 decided", "7:1 decided"]],
    ["claim-refuted", ["5:1 decided", "7:1 refuted"]],
    ["result-assumed", ["7:1 decided", "8:1 assumed"]],
    ["assume-undecided", ["7:1 assumed", "10:1 undecided"]],
    ["input-not-supplied", ["8:1 decided", "10:1 waiting"]],
  ] as const) {
    const file = `${PROGRAMS_DIR}/m3/${name}.alg`;
    assert.deepEqual(readClaimLines(text(file)).claims.map((c) => `${c.line}:${c.column} ${c.word}`), stated, file);
    const run = await runProgram(text(file), file);
    assert.deepEqual(run.problems, [], file);
  }
});


// ── The phases line (chunk Q13, part 3) ───────────────────────────────

test("the phases line is read as the convention states: names separated by commas, at most one line", () => {
  assert.deepEqual(readPhases("capability output\n// phases: check\n"), { phases: ["check"], problems: [] });
  assert.deepEqual(readPhases("//phases:check ,  run \n"), { phases: ["check", "run"], problems: [] });
  assert.deepEqual(readPhases("capability output\n"), { phases: undefined, problems: [] });
  assert.deepEqual(readPhases("// phases: check run\n").problems, ['the line "// phases: check run" is not of the form phases: <name>, <name>']);
  assert.deepEqual(readPhases("// phases: check\n// phases: run\n").problems, ["the program has two `// phases:` lines"]);
});

test("a program with a phases line runs those phases, and its lines hold for the whole launch", async () => {
  // Under check the write waits on output, which is not yet given, so its claim waits and the summary is undecided.
  const program = 'capability output\nclaim(1 == 1)\noutput.write("hello")\n// end: completed\n// summary: undecided\n';
  const checked = await runProgram(program + "// phases: check\n");
  assert.deepEqual(checked.problems, []);
  assert.deepEqual(checked.lines, []);
  const unstated = await runProgram(program);
  assert.deepEqual(unstated.lines, ["hello"], "a program with no phases line runs as run alone");
  assert.ok(unstated.problems.includes('printed ["hello"], expected []'), JSON.stringify(unstated.problems));
});

test("a malformed phases line, a list that is not built, and two lines each fail the program, which is not launched", async () => {
  const body = 'capability output\ninput a\noutput.write("launched")\n// end: completed\n';
  for (const [lines, problem] of [
    ["// phases: check run", 'the line "// phases: check run" is not of the form phases: <name>, <name>'],
    ["// phases: run, check", 'the setting phases is "run, check", which is not built: the values built are "run", "check", "check, run", "test", "check, test"'],
    ["// phases: check\n// phases: run", "the program has two `// phases:` lines"],
  ] as const) {
    const run = await runProgram(body + lines + "\n");
    assert.ok(run.problems.includes(problem), `${lines}: ${JSON.stringify(run.problems)}`);
    assert.deepEqual(run.lines, [], lines);
  }
  const notLaunched = await runProgram("capability output\noutput.write(x)\n// end: refused: the name x is bound nowhere in the text\n// phases: check\n");
  assert.deepEqual(notLaunched.problems, ["nothing was launched, and the program states a `// phases:` line"]);
  // Check, run is built: the program is launched, and its run prints.
  const both = await runProgram('capability output\noutput.write("launched")\n// expect: launched\n// end: completed\n// phases: check, run\n');
  assert.deepEqual(both.problems, []);
  // A later line with check alone is no finding: the program is launched under check, and the later phase is never applied.
  const later = await runProgram(body + '// phases: check\n// later: a = "x"\n');
  assert.deepEqual(later.problems, ["the later phase that supplies a (phase 1) was not applied"]);
});

test("under check, run a later line follows the run: the lines above it are printed before it", async () => {
  const program = 'capability output\ninput a\noutput.write("start")\noutput.write(a)\n// phases: check, run\n// expect: start\n// later: a = "one"\n// expect: one\n// end: completed\n';
  const run = await runProgram(program);
  assert.deepEqual(run.problems, []);
  assert.deepEqual(run.lines, ["start", "one"]);
});

test("the programs of a check are there, in milestone 3's directory, each with its phases, and none names a case", () => {
  const phases: Array<[string, string[]]> = [
    ["uncalled", ["check"]], ["unknown-condition", ["check"]], ["input-waits", ["check"]], ["dropped-write", ["check"]], ["report", ["check"]],
    ["run-prints", ["check", "run"]], ["run-refuted", ["check", "run"]], ["run-input", ["check", "run"]],
  ];
  for (const [name, stated] of phases) {
    const file = `${PROGRAMS_DIR}/m3/check-${name}.alg`;
    assert.ok(FILES.includes(file), name);
    assert.deepEqual(readPhases(text(file)).phases, stated, file);
    assert.deepEqual(readPins(text(file)).realises, [], file);
  }
});

test("program m3/check-report.alg hands no message under check, and m3/check-run-refuted.alg prints a line when run alone", async () => {
  const report = `${PROGRAMS_DIR}/m3/check-report.alg`;
  const checked = await runProgram(text(report), report);
  assert.deepEqual(checked.problems, []);
  assert.deepEqual(checked.messages, []);
  // The same text with no phases line runs alone, and its calls on report act.
  const alone = await runProgram(text(report).replace("// phases: check\n", ""), report);
  assert.deepEqual(alone.messages.map((m) => m.text), ["noted"]);
  assert.equal(alone.status, 3);
  const refuted = `${PROGRAMS_DIR}/m3/check-run-refuted.alg`;
  const ran = await runProgram(text(refuted).replace("// phases: check, run\n", ""), refuted);
  assert.deepEqual(ran.lines, ["hello"], "run alone prints the line before the false claim");
  assert.equal(ran.end, "refuted: a claim that is not true");
});

// ── The check claim at line (chunk Q13, part 5) ───────────────────────

test("the check claim at lines are read as the claim at lines are, apart from them", () => {
  const text = "// check claim at: 2:1 refuted\n// claim at: 3:1 decided\n//check claim at:  4:7   waiting \n";
  assert.deepEqual(readClaimLines(text, "check claim at"), { claims: [{ line: 2, column: 1, word: "refuted" }, { line: 4, column: 7, word: "waiting" }], problems: [] });
  assert.deepEqual(readClaimLines(text), { claims: [{ line: 3, column: 1, word: "decided" }], problems: [] });
  assert.deepEqual(readClaimLines("// check claim at: 2 decided\n", "check claim at").problems, [
    'the line "// check claim at: 2 decided" is not of the form check claim at: <line>:<column> <word>, the word one of refuted, undecided, waiting, assumed, sampled, decided',
  ]);
});

test("a check claim at line states a word of the check's result under check, run; the claim at lines hold for the run's", async () => {
  const program = "capability output\ninput n\nclaim(n == 1)\nclaim(2 + 2 == 4)\noutput.write(\"x\")\nunused(m) => claim(2 == 2)\n// phases: check, run\n// input: n = 1\n// expect: x\n// end: completed\n";
  assert.deepEqual((await runProgram(program + "// check claim at: 3:1 waiting\n// check claim at: 4:1 decided\n// claim at: 4:1 decided\n")).problems, []);
  // The claim in the function nothing calls is in the check's result and not in the run's.
  assert.deepEqual((await runProgram(program + "// claim at: 6:14 decided\n")).problems, ["no claim of the result is written at 6:14 of <text>"]);
  assert.ok(!(await runProgram(program + "// check claim at: 6:14 decided\n")).problems.some((p) => p.includes("no claim of the result is written")));
  assert.deepEqual((await runProgram(program + "// check claim at: 3:1 decided\n")).problems, ["in the check's result, the claim at 3:1 came out waiting, expected decided"]);
  assert.deepEqual((await runProgram(program + "// check claim at: 9:1 waiting\n")).problems, ["in the check's result, no claim of the result is written at 9:1 of <text>"]);
  const malformed = await runProgram(program + "// check claim at: two decided\n");
  assert.match(malformed.problems[0], /is not of the form check claim at: <line>:<column> <word>/);
  assert.deepEqual(malformed.lines, [], "a malformed line: the program is not launched");
  const alone = await runProgram("capability output\nclaim(1 == 1)\n// phases: check\n// end: completed\n// check claim at: 2:1 decided\n");
  assert.deepEqual(alone.problems, ["the program states a `// check claim at:` line, and its phases are not check, run"]);
  const notEmitted = await runProgram("capability output\noutput.write(x)\n// end: refused: the name x is bound nowhere in the text\n// check claim at: 2:1 decided\n");
  assert.ok(notEmitted.problems.includes("nothing was launched, and the program states a `// check claim at:` line"), JSON.stringify(notEmitted.problems));
});

test("the programs that run under check are there, in milestone 3's directory, and each states its phases", () => {
  for (const name of ["prints", "refuted", "bound"]) {
    const file = `${PROGRAMS_DIR}/m3/phase-check-${name}.alg`;
    assert.ok(FILES.includes(file), name);
    assert.deepEqual(readPhases(text(file)).phases, ["check"], file);
  }
});


// ── The reports and status lines (chunk Q16, part 3) ──────────────────

test("the reports lines are read as the convention states: level: text, with the place first where there is one, in order", () => {
  assert.deepEqual(readReports(["capability report", "// reports: error: e", "//reports:a.alg:3:7: warning: w  ", "// reports: note:", "// reports: a.alg: note: n"].join("\n")), {
    reports: ["error: e", "a.alg:3:7: warning: w", "note:", "a.alg: note: n"],
    problems: [],
  });
  assert.deepEqual(readReports("capability report\n"), { reports: undefined, problems: [] });
  assert.deepEqual(readReports("// reports: fatal: x\n// reports: just a text\n").problems, [
    'the line "// reports: fatal: x" is not of the form reports: <level>: <text>, the level one of error, warning, note',
    'the line "// reports: just a text" is not of the form reports: <level>: <text>, the level one of error, warning, note',
  ]);
});

test("the status line is read as the convention states: a whole number from 0 to 255, at most one line", () => {
  assert.deepEqual(readStatus("capability report\n//status:  7 \n"), { status: 7, problems: [] });
  assert.deepEqual(readStatus("// status: 0\n"), { status: 0, problems: [] });
  assert.deepEqual(readStatus("// status: 255\n"), { status: 255, problems: [] });
  assert.deepEqual(readStatus("capability report\n"), { status: undefined, problems: [] });
  for (const bad of ["256", "-1", "07", "x", ""])
    assert.deepEqual(readStatus(`// status: ${bad}\n`).problems, [`the line ${JSON.stringify(`// status: ${bad}`.trim())} states no status: a status is a whole number from 0 to 255`], bad);
  assert.deepEqual(readStatus("// status: 1\n// status: 2\n").problems, ["the program has two `// status:` lines"]);
});

test("a program that states reports lines must hand over exactly those; one that states none is not compared on its messages", async () => {
  const program = 'capability report\nreport.message("one")\nreport.message({level: `warning, text: "two", file: "f.alg", line: 1})\n// end: completed\n';
  const unstated = await runProgram(program);
  assert.deepEqual(unstated.problems, []);
  assert.deepEqual(unstated.messages, [{ level: "note", text: "one" }, { level: "warning", text: "two", file: "f.alg", line: 1n }]);
  assert.deepEqual((await runProgram(program + "// reports: note: one\n// reports: f.alg:1: warning: two\n")).problems, []);
  assert.deepEqual((await runProgram(program + "// reports: note: one\n")).problems, ['reported ["note: one","f.alg:1: warning: two"], expected ["note: one"]']);
  assert.deepEqual((await runProgram(program + "// reports: f.alg:1: warning: two\n// reports: note: one\n")).problems, ['reported ["note: one","f.alg:1: warning: two"], expected ["f.alg:1: warning: two","note: one"]']);
  const none = await runProgram("capability report\n// end: completed\n// reports: note: one\n");
  assert.deepEqual(none.problems, ['reported [], expected ["note: one"]']);
});

test("a program that states a status passes only with the highest status handed over, 0 where none is; one that states none is not compared on it", async () => {
  const program = "capability report\nreport.status(5)\nreport.status(2)\n// end: completed\n";
  const unstated = await runProgram(program);
  assert.deepEqual(unstated.problems, []);
  assert.equal(unstated.status, 5);
  assert.deepEqual((await runProgram(program + "// status: 5\n")).problems, []);
  assert.deepEqual((await runProgram(program + "// status: 2\n")).problems, ["the status is 5, expected 2"]);
  assert.deepEqual((await runProgram("capability report\n// end: completed\n// status: 1\n")).problems, ["the status is 0, expected 1"]);
  assert.deepEqual((await runProgram("capability report\n// end: completed\n// status: 0\n")).problems, []);
});

test("a malformed reports or status line fails the program, which is not launched; and either line where nothing is launched fails it", async () => {
  const body = 'capability output\ncapability report\noutput.write("launched")\n// expect: launched\n// end: completed\n';
  for (const [line, problem] of [
    ["// reports: loud: x", 'the line "// reports: loud: x" is not of the form reports: <level>: <text>, the level one of error, warning, note'],
    ["// status: 300", 'the line "// status: 300" states no status: a status is a whole number from 0 to 255'],
    ["// status: 1\n// status: 1", "the program has two `// status:` lines"],
  ] as const) {
    const run = await runProgram(body + line + "\n");
    assert.ok(run.problems.includes(problem), `${line}: ${JSON.stringify(run.problems)}`);
    assert.deepEqual(run.lines, [], line);
  }
  const notLaunched = await runProgram("capability report\nreport.message(x)\n// end: refused: the name x is bound nowhere in the text\n// status: 0\n");
  assert.deepEqual(notLaunched.problems, ["nothing was launched, and the program states a `// reports:` or `// status:` line"]);
});

test("the runner grants report, and under a phases line of check it is not needed, so no message is handed over, while output waits", async () => {
  const run = await runProgram('capability output\ncapability report\nreport.message("checked")\noutput.write("never")\n// phases: check\n// status: 0\n// end: completed\n');
  assert.deepEqual(run.problems, []);
  assert.deepEqual(run.lines, []);
  assert.deepEqual(run.messages, []);
  const checked = await runProgram(text(`${PROGRAMS_DIR}/m3/report-check.alg`), `${PROGRAMS_DIR}/m3/report-check.alg`);
  assert.deepEqual(checked.messages, [], "m3/report-check.alg hands no message under check");
});

test("the programs that hand messages and statuses are there, in milestone 3's directory, and none names a case", () => {
  for (const name of ["levels", "place", "text", "not-message", "status-rising", "status-falling", "status-invalid", "error-no-status", "check", "answer"]) {
    const file = `${PROGRAMS_DIR}/m3/report-${name}.alg`;
    assert.ok(FILES.includes(file), name);
    assert.deepEqual(readPins(text(file)).realises, [], file);
  }
  assert.ok(FILES.includes(`${PROGRAMS_DIR}/m3/report-import/main.alg`));
  assert.deepEqual(readPhases(text(`${PROGRAMS_DIR}/m3/report-check.alg`)).phases, ["check"]);
});

test("program m3/report-place.alg hands its messages with the file, the line and the column as given", async () => {
  const file = `${PROGRAMS_DIR}/m3/report-place.alg`;
  const run = await runProgram(text(file), file);
  assert.deepEqual(run.problems, []);
  assert.deepEqual(run.messages, [
    { level: "warning", text: "unused binding", file: "main.alg", line: 3n, column: 7n },
    { level: "note", text: "here", file: "main.alg", line: 4n },
    { level: "note", text: "in this file", file: "main.alg" },
    { level: "note", text: "no file", line: 9n, column: 2n },
  ]);
});
