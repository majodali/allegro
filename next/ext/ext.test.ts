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
// that, ends so, and its claims come out as it states: all decided, but
// for a module that tests a claim being refuted, which says so.
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
import { shipped, shippedByName } from "../prims/index.js";
import { load } from "../kernel/saved-program.js";
import type { Kernel, Value } from "../kernel/interface.js";

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

/** Runs a text with a budget of its own, and gives how it ended, what it printed, the steps and the time. `source`, where given, is handed as the input of that name. */
async function timed(text: string, file: string, steps: number, source?: string): Promise<{ end: string; lines: string[]; steps: number; ms: number }> {
  const e = emitted(text, file);
  if ("findings" in e) throw new Error(`the text is refused: ${e.findings.join("; ")}`);
  const inputs = source === undefined ? {} : { inputs: { source: { bits: new TextEncoder().encode(source) } } };
  const before = Date.now();
  const outcome = await launch({ createKernel, program: e.program, imports: e.imports, configuration: { ceiling: ["output"], steps, ...inputs }, target: { capabilities: [output], primitives: shipped } });
  return { end: outcome.end.kind, lines: outcome.lines, steps: "steps" in outcome.end ? outcome.end.steps : -1, ms: Date.now() - before };
}

const files = testFiles(ROOT);

test("there are tests to run", () => {
  assert.ok(files.length >= 2, `${files.length} test module(s) under ${ROOT}`);
});

for (const file of files)
  test(`${file}: prints what it states, ends as it states, and its claims come out as it states`, DEPTH, async () => {
    const text = fs.readFileSync(file, "utf8");
    const run = await runProgram(text, file);
    assert.deepEqual(run.findings, [], "the text is read");
    assert.deepEqual(run.problems, []);
    assert.equal(run.end, "completed");
    // Every claim is decided, but in a module that tests a claim being refuted inside an attempt:
    // such a module is named for it, and states `// summary: refuted`. No other module may.
    const refutes = path.basename(file).startsWith("refuted_");
    assert.match(text, refutes ? /^\/\/ summary: refuted$/m : /^\/\/ summary: decided$/m);
    assert.equal(run.result?.summary, refutes ? "refuted" : "decided");
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

// ---- The engine, measured -------------------------------------------------------

/** A program that reads its input `source` as flat Allegretto and prints how many ways it reads, or minus where it failed. */
const READER = [
  "capability output",
  "input source",
  "import engine",
  "import flat",
  "size(a) => if is_failure(a) then 0 - a.at else length(a.readings)",
  "length(l) => if count(l) == 0 then 0 else 1 + length(l.t)",
  "output.write(int.text(size(engine.parses(engine.prepared(flat.allegretto), source))))",
  "",
].join("\n");

/** Three modules of this directory that are written flat, as one text: a little over 200 lines. */
const MODULE = ["grammar.alg", "class.alg", "map.alg"].map((f) => fs.readFileSync(path.join(ROOT, "lib", f), "utf8")).join("\n");

test("the speed target, with the grammar of flat Allegretto: a module of 200 lines is read, one way, in the steps of 10 seconds", DEPTH, async () => {
  assert.ok(MODULE.split("\n").length >= 200, `the text has ${MODULE.split("\n").length} lines`);
  const run = await timed(READER, "next/ext/lib/reader.alg", 50_000_000, MODULE);
  assert.equal(run.end, "completed");
  assert.deepEqual(run.lines, ["1"], "the text reads one way");
  console.log(`engine: ${MODULE.split("\n").length} lines, ${MODULE.length} bytes, read in ${run.steps} steps and ${run.ms} ms`);
  // The steps do not depend on the machine the test runs on, so they are what is held tight.
  assert.ok(run.steps < 2_600_000, `${run.steps} steps`);
  // The time does: the machine that runs the suite for a pull request took 13.4 seconds for these steps where the
  // one the target was measured on takes 6 to 7, and failed two pull requests that changed nothing here. So the
  // time is held only where it is asked for, with ALLEGRO_SPEED=1, on a machine one knows. (Until 2026-12-02 this
  // test held the time on every run; the maintainer ruled the change.)
  if (process.env.ALLEGRO_SPEED === "1") assert.ok(run.ms < 10_000, `${run.ms} ms`);
});

// With Allegretto's whole grammar (allegretto.alg), blocks by indentation among it, the same text takes
// about 1.6 times the steps, and the time is over the target: 13 seconds where this was measured. That
// is recorded and not hidden: the test holds the steps, so that they do not grow unseen, and prints the
// time. Whether the target stands, and what is done to meet it, is the maintainer's to rule.
test("the same module with Allegretto's whole grammar: read one way, the steps held, the time printed", DEPTH, async () => {
  const reader = READER.replace("import flat", "import allegretto").replace("flat.allegretto", "allegretto.language");
  assert.notEqual(reader, READER);
  const run = await timed(reader, "next/ext/lib/reader.alg", 50_000_000, MODULE);
  assert.equal(run.end, "completed");
  assert.deepEqual(run.lines, ["1"], "the text reads one way");
  console.log(`engine, whole grammar: ${MODULE.split("\n").length} lines, ${MODULE.length} bytes, read in ${run.steps} steps and ${run.ms} ms`);
  assert.ok(run.steps < 4_300_000, `${run.steps} steps`);
});

test("a text of twice the length takes about twice the steps", DEPTH, async () => {
  const one = fs.readFileSync(path.join(ROOT, "lib", "class.alg"), "utf8");
  const [once, twice] = [await timed(READER, "next/ext/lib/reader.alg", 50_000_000, one), await timed(READER, "next/ext/lib/reader.alg", 50_000_000, `${one}\n${one.replace(/^import class$/m, "")}`)];
  assert.deepEqual([once.lines, twice.lines], [["1"], ["1"]]);
  const growth = twice.steps / once.steps;
  assert.ok(growth > 1.7 && growth < 2.3, `twice the text took ${growth.toFixed(2)} times the steps (${once.steps} and ${twice.steps})`);
});

test("a rule that begins with itself costs in line with its text: twice the operands, about twice the steps", DEPTH, async () => {
  const program = [
    "capability output",
    "input source",
    "import engine",
    "import grammar",
    'g = grammar.grammar(`sum, {sum: grammar.alt([grammar.seq([grammar.ref(`sum), grammar.lit("+"), grammar.ref(`one)]), grammar.ref(`one)]), one: grammar.run("a number", "09")})',
    "size(a) => if is_failure(a) then 0 - a.at else length(a.readings)",
    "length(l) => if count(l) == 0 then 0 else 1 + length(l.t)",
    "output.write(int.text(size(engine.parses(engine.prepared(g), source))))",
    "",
  ].join("\n");
  const row = (n: number): string => Array.from({ length: n }, (_, i) => String(i)).join("+");
  const [forty, eighty] = [await timed(program, "next/ext/lib/row.alg", 5_000_000, row(40)), await timed(program, "next/ext/lib/row.alg", 5_000_000, row(80))];
  assert.deepEqual([forty.lines, eighty.lines], [["1"], ["1"]]);
  const growth = eighty.steps / forty.steps;
  assert.ok(growth > 1.7 && growth < 2.3, `twice the operands took ${growth.toFixed(2)} times the steps (${forty.steps} and ${eighty.steps})`);
});

// ---- The engine, specialized over a grammar -------------------------------------

/** A module that yields `reader`, the engine with a grammar already given: a function of a text. */
const readerOf = (rules: string): string =>
  ["capability output", "import engine", "import grammar", `p = engine.prepared(grammar.grammar(\`s, ${rules}))`, "export reader = text => engine.parses(p, text)", "export ways(a) => if count(a.readings) == 0 then 0 else 1 + ways({readings: a.readings.t})", ""].join("\n");

/** The `reader` a module yields and its `ways`, which counts the readings of an answer, in a kernel of their own. */
function yielded(text: string): { k: Kernel; reader: Value; ways: Value } {
  const e = emitted(text, "next/ext/lib/specialized.alg");
  if ("findings" in e) throw new Error(`the text is refused: ${e.findings.join("; ")}`);
  const k = createKernel();
  const byHash = new Map([...shippedByName.values()].map((p) => [p.hash, p] as const));
  const primitives = new Map([...e.imports, e.program].flatMap((doc) => doc.needs).map((n) => [n.hash, k.primitiveFunction(byHash.get(n.hash)!)] as const));
  for (const doc of e.imports) load(k, doc, primitives);
  const module = k.evaluate(k.expression(load(k, e.program, primitives), [k.structure([])]), { steps: 1_000_000 });
  const entry = (name: string): Value => {
    const found = k.entriesOf(k.current(module.value)).find(([key]) => key !== null && k.symbolName(key) === name);
    if (found === undefined) throw new Error(`the module yields no ${name}`);
    return found[1];
  };
  return { k, reader: entry("reader"), ways: entry("ways") };
}

/** How many readings a reader gives for a text, and the steps the reading took. */
function reading(k: Kernel, reader: Value, ways: Value, text: string): { trees: number; steps: number } {
  const r = k.evaluate(k.expression(reader, [k.bits(new TextEncoder().encode(text))]), { steps: 1_000_000 });
  assert.equal(r.ended, "complete");
  const counted = k.evaluate(k.expression(ways, [r.value]), { steps: 1_000_000 });
  const bytes = k.bitsOf(k.current(counted.value)).bytes;
  return { trees: Number(new DataView(bytes.buffer, bytes.byteOffset, 8).getBigInt64(0)), steps: r.steps };
}

test("the engine specialized over a grammar reads the same, in fewer steps; how few is recorded as a finding", DEPTH, () => {
  const cases: [string, string, string, number][] = [
    ["a sequence", '{s: grammar.seq([grammar.lit("a"), grammar.ref(`b), grammar.lit("c")]), b: grammar.run("bees", "bb")}', "abbbbc", 1],
    ["a rule that names itself", '{s: grammar.alt([grammar.seq([grammar.lit("("), grammar.ref(`s), grammar.lit(")")]), grammar.lit("x")])}', "(((x)))", 1],
    ["two readings", '{s: grammar.seq([grammar.ref(`a), grammar.ref(`a)]), a: grammar.alt([grammar.lit("x"), grammar.lit("xx")])}', "xxx", 2],
  ];
  for (const [name, rules, text, trees] of cases) {
    const { k, reader, ways } = yielded(readerOf(rules));
    // The first reading works the analysis of the grammar out, so the second is the one compared.
    reading(k, reader, ways, text);
    const plain = reading(k, reader, ways, text);
    const budget = new Uint8Array(4);
    new DataView(budget.buffer).setUint32(0, 100_000);
    const made = k.evaluate(k.expression(k.kernelPrimitive("specialize"), [reader, k.bits(budget)]), { steps: 1_000_000 });
    assert.equal(k.kind(k.current(made.value)), "composed-function", name);
    const special = reading(k, k.current(made.value), ways, text);
    assert.equal(plain.trees, trees, name);
    assert.equal(special.trees, trees, name);
    assert.ok(special.steps < plain.steps, `${name}: ${special.steps} steps specialized, ${plain.steps} plain`);
    console.log(`specialized: ${name}: ${plain.steps} steps plain, ${special.steps} specialized, ${made.steps} to specialize`);
  }
});
