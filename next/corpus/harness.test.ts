// Tests of the comparison harness (next/corpus/harness.ts), run by Node's
// test runner through tsx (`npm run test:next`). The comparison is probed
// with stub runners that are wrong in known ways before one that is right;
// the report is built over a small corpus in memory; the present-tree
// runner runs three small programs of the present tree, one of which the
// file runner cannot run as the suite does. The whole calibration is the
// command `npm run harness:present`, not a test: it takes about half a
// minute.

import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import {
  compareProgram, buildReport, formatRows, formatSummary, failed, runAll, comparePrograms, presentTreeRunner, pinsByProgram, PRESENT_RUN_DIFFERS,
  type Runner, type RunResult, type Program,
} from "./harness.js";
import { CASES_PATH, type Corpus, type PinCase, type TestCase } from "../tools/corpus.js";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");

const pin = (file: string, ordinal: number, expect: string, fields: Partial<PinCase>): PinCase =>
  ({ id: `pin:${file}#${ordinal}`, kind: "pin", file, line: ordinal * 2, expect, class: "survives", decisions: [], milestone: 3, ...fields });
const tcase = (name: string, fields: Partial<TestCase>): TestCase =>
  ({ id: `test:m:${name}`, kind: "test", module: "src/test/m.ts", name, class: "survives", decisions: [], milestone: 3, ...fields });

const P = "tests/p.alg";
const PINS: PinCase[] = [
  pin(P, 1, "1", {}),
  pin(P, 2, "error(old)", { class: "changes", ruling: "Alpha", becomes: "a refutation of the claim", milestone: 4 }),
  pin(P, 3, "observed", { class: "detail", milestone: null }),
  pin(P, 4, "4", { milestone: 4 }),
];
const run = (lines: string[], end: RunResult["end"] = { kind: "completed" }): RunResult => ({ lines, end });
const outcomes = (r: ReturnType<typeof compareProgram>) => r.verdicts.map((v) => v.outcome);

// ── Probes with stub runners that are wrong in known ways ──

test("a runner that prints the wrong line fails that survives pin, naming the case, the expected text and what it found", () => {
  const r = compareProgram(P, PINS, run(["1", "x", "o", "five"]));
  assert.deepEqual(outcomes(r), ["passes", "to review", "not compared", "fails"]);
  assert.equal(r.verdicts[3].finding, 'pin:tests/p.alg#4: expected "4", found "five"');
  assert.deepEqual(r.findings, []);
});

test("a runner that prints too few lines and stops fails the pins past its last line, with the reason", () => {
  const r = compareProgram(P, PINS, run(["1"], { kind: "stopped", reason: "Error in tests/p.alg: boom (exit 1)" }));
  assert.deepEqual(outcomes(r), ["passes", "to review", "not compared", "fails"]);
  assert.equal(r.verdicts[3].finding, 'pin:tests/p.alg#4: expected "4", found no line (the run printed 1 line(s) and stopped: Error in tests/p.alg: boom (exit 1))');
  assert.equal(r.verdicts[1].finding, 'pin:tests/p.alg#2: to review by "Alpha"; becomes: a refutation of the claim; produced no line (the run printed 1 line(s) and stopped: Error in tests/p.alg: boom (exit 1))');
  assert.deepEqual(r.findings, [], "the stop is named on the pins it cut off, not again on the program");
});

test("a runner that prints too many lines is a finding on the program; a stop after every pin's line is one too", () => {
  const r = compareProgram(P, PINS, run(["1", "x", "o", "4", "extra", "more"]));
  assert.deepEqual(outcomes(r), ["passes", "to review", "not compared", "passes"]);
  assert.deepEqual(r.findings, ['tests/p.alg: printed 6 line(s) for 4 pin(s); the first line past the pins is "extra"']);
  const s = compareProgram(P, PINS, run(["1", "x", "o", "4"], { kind: "stopped", reason: "late (exit 1)" }));
  assert.deepEqual(s.findings, ["tests/p.alg: the run stopped after a line for every pin: late (exit 1)"]);
});

test("a runner that leaves a changes line unchanged raises the one finding a changes pin has, and stays to review", () => {
  const r = compareProgram(P, PINS, run(["1", "error(old)", "o", "4"]));
  assert.equal(r.verdicts[1].outcome, "to review");
  assert.equal(r.verdicts[1].unchanged, true);
  assert.equal(r.verdicts[1].finding, 'pin:tests/p.alg#2: the change did not happen: produced the present pin "error(old)" exactly; ruling "Alpha"; becomes: a refutation of the claim');
});

test("a runner that is right passes every survives pin, reports the changes pin to review with what it produced, and compares no detail pin", () => {
  const r = compareProgram(P, PINS, run(["1", "refuted: Alpha", "anything", "4"]));
  assert.deepEqual(outcomes(r), ["passes", "to review", "not compared", "passes"]);
  assert.deepEqual(r.verdicts.map((v) => v.finding), [null, 'pin:tests/p.alg#2: to review by "Alpha"; becomes: a refutation of the claim; produced "refuted: Alpha"', null, null]);
  assert.equal(r.verdicts[1].unchanged, false);
  assert.deepEqual(r.findings, []);
});

test("pins compare by ordinal whatever order they come in", () => {
  const r = compareProgram(P, [PINS[3], PINS[0]], run(["1", "x", "o", "4"]));
  assert.deepEqual(r.verdicts.map((v) => [v.id, v.outcome]), [["pin:tests/p.alg#1", "passes"], ["pin:tests/p.alg#4", "passes"]]);
});

// ── The report per milestone ──

const Q = "demos/r1/q.alg";
const CORPUS: Corpus = {
  _: "a small corpus",
  cases: [
    ...PINS,
    pin(Q, 1, "q1", { milestone: 5 }),
    tcase("kernel", { milestone: 1 }),
    tcase("changes at 3", { class: "changes", ruling: "Alpha", becomes: "b", milestone: 3 }),
    tcase("host layout", { class: "detail", milestone: null }),
    tcase("at 5", { milestone: 5 }),
  ],
};

test("the report counts a case at its own milestone only, keeps a running total, and counts the pins of a program not run", () => {
  const p = compareProgram(P, PINS, run(["2", "x", "o", "4"]));
  const report = buildReport(CORPUS, [p]);
  assert.deepEqual(report.rows.filter((r) => [1, 3, 4, 5].includes(r.milestone)), [
    { milestone: 1, pins: { due: 0, passing: 0, failing: 0, review: 0, notRun: 0 }, tests: 1 },
    { milestone: 3, pins: { due: 1, passing: 0, failing: 1, review: 0, notRun: 0 }, tests: 1 },
    { milestone: 4, pins: { due: 2, passing: 1, failing: 0, review: 1, notRun: 0 }, tests: 0 },
    { milestone: 5, pins: { due: 1, passing: 0, failing: 0, review: 0, notRun: 1 }, tests: 1 },
  ]);
  assert.deepEqual(report.findings, ['pin:tests/p.alg#1: expected "1", found "2"', 'pin:tests/p.alg#2: to review by "Alpha"; becomes: a refutation of the claim; produced "x"']);
  const rows = formatRows(report);
  assert.equal(rows.length, 9);
  assert.equal(rows[3], "milestone 4: due 2 (pins 2, tests 0) · pins passing 1, failing 0, to review 1, not run 0 · tests not yet realised 0 · up to 4: pins 1 of 3 passing, 1 failing, 1 to review, 0 not run; tests 0 of 2 realised");
  assert.equal(rows[8], "milestone 9: due 0 (pins 0, tests 0) · pins passing 0, failing 0, to review 0, not run 0 · tests not yet realised 0 · up to 9: pins 1 of 4 passing, 1 failing, 1 to review, 1 not run; tests 0 of 3 realised");
  assert.equal(formatSummary(report, "stub"),
    "harness: stub · programs 1 run, 0 stopped · pins 5 (passing 1, failing 1 of which 0 with no line, to review 1 of which 0 unchanged, not compared 1, not run 1) · tests 4 (due 3, not yet realised 3; detail 1) — 1 failing pin(s), 0 program finding(s)");
  assert.equal(failed(report), true);
});

test("a right run of every program reports no failing pin and does not fail; --milestone keeps rows 1 to N", async () => {
  const lines: Record<string, string[]> = { [P]: ["1", "refuted", "o", "4"], [Q]: ["q1"] };
  const runner: Runner = async (prog: Program) => run(lines[prog.path]);
  const pins = pinsByProgram(CORPUS);
  const results = await runAll(runner, [...pins.keys()].map((f) => ({ path: f, text: "" })), 2);
  const report = buildReport(CORPUS, [...pins.keys()].map((f, i) => compareProgram(f, pins.get(f)!, results[i])), 4);
  assert.deepEqual(report.rows.map((r) => r.milestone), [1, 2, 3, 4]);
  assert.match(formatSummary(report, "stub"), /pins 5 \(passing 3, failing 0 of which 0 with no line, to review 1 of which 0 unchanged, not compared 1, not run 0\) .* — no failing pin$/);
  assert.equal(failed(report), false);
});

test("the runs are bounded and keep their order; a runner that throws is a stopped run", async () => {
  let live = 0, peak = 0;
  const runner: Runner = async (prog) => {
    live++; peak = Math.max(peak, live);
    await new Promise((r) => setTimeout(r, 5));
    live--;
    if (prog.path === "bad") throw new Error("no kernel");
    return run([prog.path]);
  };
  const progs = ["a", "b", "bad", "c", "d"].map((p) => ({ path: p, text: "" }));
  const out = await runAll(runner, progs, 2);
  assert.equal(peak, 2);
  assert.deepEqual(out.map((r) => r.lines[0] ?? r.end), ["a", "b", { kind: "stopped", reason: "the runner threw: no kernel" }, "c", "d"]);
});

// ── The present-tree runner, on three small real programs ──

test("the present-tree runner runs programs as a user would; one that the suite runs with an extension stops", async () => {
  const corpus = JSON.parse(fs.readFileSync(path.join(ROOT, CASES_PATH), "utf-8")) as Corpus;
  const files = ["tests/match-demo.alg", "tests/hygiene-demo.alg", "tests/proofs-proven-demo.alg"];
  const compared = await comparePrograms(ROOT, corpus, presentTreeRunner(ROOT), files, 3);
  for (const c of compared.slice(0, 2)) {
    assert.deepEqual(c.end, { kind: "completed" });
    assert.ok(c.verdicts.length > 0 && c.verdicts.every((v) => v.outcome === "passes"), `${c.file}: ${JSON.stringify(c.verdicts)}`);
    assert.deepEqual(c.findings, []);
  }
  const proven = compared[2];
  assert.equal(proven.end.kind, "stopped");
  assert.match((proven.end as { reason: string }).reason, /^Error in tests\/proofs-proven-demo\.alg: Parse error .*\(exit 1\)$/);
  assert.deepEqual(proven.verdicts.map((v) => v.outcome), ["fails", "fails", "fails"]);
  // The calibration leaves out exactly the programs shown here to stop.
  assert.deepEqual(Object.keys(PRESENT_RUN_DIFFERS), ["tests/proofs-proven-demo.alg"]);
});

test("the present-tree runner refuses a text that differs from the file on disk, and a path that is no file", async () => {
  const runner = presentTreeRunner(ROOT);
  assert.deepEqual(await runner({ path: "tests/match-demo.alg", text: "print(1)\n" }),
    run([], { kind: "stopped", reason: "the present-tree runner runs the file on disk, and the text given differs from tests/match-demo.alg" }));
  assert.deepEqual(await runner({ path: "tests/no-such.alg", text: "" }),
    run([], { kind: "stopped", reason: "tests/no-such.alg is no file under the repository root" }));
});
