// Tests of the check-output capability, first version (B-196 (the
// rebuild's acceptance side), chunk Q16 (the capabilities the launchers
// ship), part 3; chunk Q13 (check and run as configurations, and what a
// result holds), part 5, for report under check): next/launch/report.ts, through the launcher of
// next/launch/launcher.ts on the kernel `createKernel` of
// next/kernel/create.ts gives: the reference, or the variant that keeps its
// own stack with `ALLEGRO_KERNEL=machine`. Run by `npm run test:next`.
//
// Every test here passes on both kernel variants and asserts what must be
// present. No test pins a step count or a wall-clock duration. The two
// commands end to end are tested in next/launch/launcher.test.ts, and the
// check capabilities of the setting `phases` in
// next/tools/configuration.test.ts.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import type { Entry, Kind, PrimitiveContext, Value } from "../kernel/interface.js";
import { createKernel } from "../kernel/create.js";
import { encode, type SavedProgram } from "../kernel/saved-program.js";
import { emit } from "../bootstrap/emit.js";
import { drive } from "../bootstrap/driver.js";
import { shipped } from "../prims/index.js";
import { CHECK_CAPABILITIES, shapeOf } from "../tools/configuration.js";
import { describe, launch, type CapabilityHost, type Configuration, type LaunchOutcome } from "./launcher.js";
import { output } from "./output.js";
import { collector, messageLine, REPORT, report, type ReportMessage } from "./report.js";
import { exitCode, TERMINAL_CEILING, terminalReport } from "./terminal.js";

const here = path.dirname(new URL(import.meta.url).pathname);

/** The record the emitter writes for an Allegretto text, as JSON round-trips it. */
function emitted(text: string): SavedProgram {
  const r = emit(text);
  assert.ok(r.ok, r.ok ? "" : r.findings.map((f) => f.message).join("; "));
  return JSON.parse(encode(r.program)) as SavedProgram;
}

const CEILING: Configuration = { ceiling: ["output", "report"], steps: 1_000_000 };
/** Runs a program that declares output and report, with these lines, and gives the outcome, the messages and the status. */
async function run(lines: readonly string[], configuration: Configuration = CEILING): Promise<{ outcome: LaunchOutcome; messages: ReportMessage[]; status: number }> {
  const c = collector();
  const outcome = await launch({
    createKernel,
    program: emitted(["capability output", "capability report", ...lines, ""].join("\n")),
    configuration,
    target: { capabilities: [output, report(c.sink)], primitives: shipped },
  });
  return { outcome, messages: c.messages, status: c.status() };
}
const lines = (messages: readonly ReportMessage[]) => messages.map(messageLine);
/** The level `error`, as a program writes its symbol. */
const ERROR = "`error";

test("the check-output capability is report, with two parts, message and status, and it is a check capability", () => {
  assert.deepEqual(REPORT, { name: "report", parts: ["message", "status"] });
  assert.deepEqual([...CHECK_CAPABILITIES], ["report"]);
  assert.ok(TERMINAL_CEILING.includes("report"));
});

/** Values of every kind a program can hand a part, a failure among them, each as Allegretto writes it. */
const VALUES = [
  '"a text"', "42", "true", "1.5", "`a_symbol", "{}", "[1, 2]", "{a: 1}", '{failure: `missing, reason: "gone"}',
  "attempt(1 / 0, 100)", "x => x", "int.add", "k", `{level: ${ERROR}, text: "a message"}`, "300", "-1", "7",
];

test("each part answers at once with the empty structure, whatever it is given, a failure among them, and nothing after it is held", async () => {
  for (const part of ["message", "status"])
    for (const v of VALUES) {
      const r = await run([
        "key k",
        `r <- report.${part}(${v})`,
        'output.write(if kind(r) == `structure && count(r) == 0 && !is_failure(r) then "empty" else "other")',
        `report.${part}(${v})`,
        'output.write("after")',
      ]);
      assert.deepEqual(r.outcome.lines, ["empty", "after"], `${part}(${v}): ${describe(r.outcome.end)}`);
      assert.equal(r.outcome.end.kind, "completed", `${part}(${v})`);
    }
});

/** A context of plain host objects, to call a part's host code directly: it makes no cell. */
function stubContext(): { context: PrimitiveContext; made: Value[] } {
  type Stub = { kind: Kind; bits?: Uint8Array; bitLength?: number; name?: string; entries?: readonly Entry[] };
  const made: Value[] = [];
  const as = (v: Value) => v as unknown as Stub;
  const context: PrimitiveContext = {
    bits: (bytes, bitLength) => ({ kind: "bits", bits: bytes, bitLength: bitLength ?? bytes.length * 8 }) as unknown as Value,
    symbol: (name) => ({ kind: "symbol", name }) as unknown as Value,
    structure: (entries) => {
      const v = { kind: "structure", entries } as unknown as Value;
      made.push(v);
      return v;
    },
    kind: (v) => as(v).kind,
    bitsOf: (v) => ({ bytes: as(v).bits!, bitLength: as(v).bitLength! }),
    symbolName: (v) => as(v).name!,
    entriesOf: (v) => as(v).entries!,
    cell: () => {
      throw new Error("a part of report made a cell");
    },
  };
  return { context, made };
}

test("neither part answers late: each returns the empty structure itself, makes no cell, and asks the launcher for no later answer", () => {
  const host: CapabilityHost = {
    line: () => assert.fail("a part of report printed a line"),
    later: () => assert.fail("a part of report asked for a later answer"),
  };
  const c = collector();
  const parts = report(c.sink).create(host);
  assert.deepEqual(parts.map((p) => p.purity === "effectful" && [p.capability, p.part, p.arity]), [["report", "message", 1], ["report", "status", 1]]);
  const { context, made } = stubContext();
  const text = context.bits(new TextEncoder().encode("t"));
  const fn = { kind: "composed-function" } as unknown as Value;
  for (const part of parts)
    for (const v of [text, fn, context.symbol("s")]) {
      const answer = part.run([v], context);
      assert.equal(answer, made[made.length - 1]);
      assert.deepEqual(context.entriesOf(answer), []);
    }
  // A text of 8 bits, a function and a symbol: none is a status.
  assert.equal(c.messages.length, 6, "a message for each call on message, and a note for each value that is no status");
  assert.equal(c.status(), 255);
});

test("a message is a structure with a level and a text, and optionally a file, a line and a column, in any order; the host data holds what it gives", async () => {
  const r = await run([
    `report.message({level: ${ERROR}, text: "e"})`,
    'report.message({level: `warning, text: "w", file: "a.alg"})',
    'report.message({level: `note, text: "n", file: "a.alg", line: 3})',
    'report.message({column: 7, line: 3, file: "a.alg", text: "all", level: `warning})',
    'report.message({level: `note, text: "", line: 0, column: 9223372036854775807})',
  ]);
  assert.equal(r.outcome.end.kind, "completed");
  assert.deepEqual(r.messages, [
    { level: "error", text: "e" },
    { level: "warning", text: "w", file: "a.alg" },
    { level: "note", text: "n", file: "a.alg", line: 3n },
    { level: "warning", text: "all", file: "a.alg", line: 3n, column: 7n },
    { level: "note", text: "", line: 0n, column: 9223372036854775807n },
  ]);
});

test("a text alone is a note with that text", async () => {
  const r = await run(['report.message("plain")', 'report.message("")']);
  assert.deepEqual(r.messages, [{ level: "note", text: "plain" }, { level: "note", text: "" }]);
});

test("any other value is a note that says it was no message and names its kind", async () => {
  const note = (kind: string): ReportMessage => ({ level: "note", text: `report.message was handed no message: a value of kind ${kind}` });
  for (const [v, kind] of [
    ["true", "bits"],
    ["bits.slice(255, 56, 8)", "bits"],
    ["`note", "symbol"],
    ["x => x", "composed-function"],
    ["{}", "structure"],
    ['{failure: `missing, reason: "gone"}', "structure"],
    ['{level: `fatal, text: "x"}', "structure"],
    ['{level: "note", text: "x"}', "structure"],
    ["{level: `note}", "structure"],
    ['{text: "x"}', "structure"],
    ["{level: `note, text: true}", "structure"],
    ['{level: `note, text: "x", file: 1.5}', "structure"],
    ['{level: `note, text: "x", file: true}', "structure"],
    ['{level: `note, text: "x", line: -1}', "structure"],
    ['{level: `note, text: "x", column: true}', "structure"],
    ['{level: `note, text: "x", severity: 1}', "structure"],
    ['put({level: `note, text: "x"}, [], 1)', "structure"],
    ['["note", "x"]', "structure"],
  ] as const) {
    const r = await run([`report.message(${v})`]);
    assert.deepEqual(r.messages, [note(kind)], v);
    assert.equal(r.outcome.end.kind, "completed", v);
  }
});

test("a private entry is passed over by a primitive function (forms.md §4, \"Keys and private entries\"), so it does not spoil a message", async () => {
  const r = await run(["key k", 'report.message({level: `note, text: "kept", [k]: 1})']);
  assert.deepEqual(r.messages, [{ level: "note", text: "kept" }]);
});

test("a message does not set the status, whatever its level", async () => {
  const r = await run([`report.message({level: ${ERROR}, text: "an error"})`, 'report.message({level: `warning, text: "a warning"})']);
  assert.equal(r.outcome.end.kind, "completed");
  assert.equal(r.status, 0);
});

test("the highest status handed over stands, whichever is written first; 0 where none is", async () => {
  for (const order of [["3", "7"], ["7", "3"]]) {
    const r = await run(order.map((n) => `report.status(${n})`));
    assert.equal(r.status, 7, order.join(", "));
    assert.deepEqual(r.messages, []);
  }
  // Two statements that do not wait for each other: the higher still stands.
  const free = await run(["a <- report.status(9)", "b <- report.status(2)", "output.write(int.text(count(a) + count(b)))"]);
  assert.equal(free.status, 9);
  assert.equal((await run(['output.write("no status")'])).status, 0);
  assert.equal((await run(["report.status(0)"])).status, 0);
  assert.equal((await run(["report.status(255)"])).status, 255);
});

test("a value that is no status counts as 255, and a note says so and names its kind", async () => {
  const note = (kind: string): ReportMessage => ({ level: "note", text: `report.status was handed no status from 0 to 255: a value of kind ${kind}, which counts as 255` });
  for (const [v, kind] of [["256", "bits"], ["-1", "bits"], ["true", "bits"], ['"3"', "bits"], ["`three", "symbol"], ["{}", "structure"], ["x => 3", "composed-function"]] as const) {
    const r = await run(["report.status(1)", `report.status(${v})`]);
    assert.equal(r.status, 255, v);
    assert.deepEqual(r.messages, [note(kind)], v);
  }
});

test("leaving the calls on report out changes nothing the program computes: the same lines, the same end, the same claims decided", async () => {
  const body = ["double(n) => n * 2", "claim(double(21) == 42)", 'output.write("one")', "x <- double(4)", "output.write(int.text(x))"];
  const calls = [`report.message({level: ${ERROR}, text: "e"})`, "report.status(5)", "r <- report.message(true)", "report.status(`no)"];
  const without = await run(body);
  const interleaved = await run([calls[0], body[0], body[1], calls[1], body[2], calls[2], body[3], calls[3], body[4]]);
  assert.deepEqual(interleaved.outcome.lines, without.outcome.lines);
  assert.equal(interleaved.outcome.end.kind, without.outcome.end.kind);
  assert.equal(interleaved.outcome.result?.summary, without.outcome.result?.summary);
  assert.ok(interleaved.outcome.result?.claims.some((c) => c.decided > 0 && c.refuted === 0));
  assert.deepEqual(without.outcome.lines, ["one", "8"]);
});

test("under check alone report is not needed: no message and no status is handed over, a call on output waits and nothing is printed; under check, run the run's calls act", async () => {
  const shape = shapeOf(["check"], undefined, undefined, ["output", "report"]);
  assert.ok(shape.ok);
  assert.deepEqual(shape.shape.phases, [{ name: "check", check: true, capabilities: ["report"] }]);
  const body = ['report.message({level: `warning, text: "checked"})', "report.status(2)", 'output.write("printed by the run")', 'report.message("held")'];
  const r = await run(body, { ceiling: ["output", "report"], ...shape.shape });
  assert.deepEqual(r.outcome.lines, []);
  assert.deepEqual(r.messages, []);
  assert.equal(r.status, 0);
  assert.equal(r.outcome.end.kind, "completed");
  const both = shapeOf(["check", "run"], undefined, undefined, ["output", "report"]);
  assert.ok(both.ok);
  const ran = await run(body, { ceiling: ["output", "report"], ...both.shape });
  assert.deepEqual(ran.outcome.lines, ["printed by the run"]);
  assert.deepEqual(lines(ran.messages), ["warning: checked", "note: held"]);
  assert.equal(ran.status, 2);
  assert.equal(ran.outcome.end.kind, "completed");
});

test("a module that hands report on to an imported module: the imported module reports through it", async () => {
  const d = drive("capability report\nimport lint\nlint.warn(\"from lint\")\n", "dir/main.alg", () => 'capability report\nexport warn(t) => report.message({level: `warning, text: t})\n');
  assert.ok(d.ok);
  const records = d.records.map((x) => JSON.parse(encode(x.program)) as SavedProgram);
  const c = collector();
  const outcome = await launch({ createKernel, program: records[1], imports: [records[0]], configuration: { ceiling: ["report"] }, target: { capabilities: [report(c.sink)], primitives: shipped } });
  assert.equal(outcome.end.kind, "completed");
  assert.deepEqual(lines(c.messages), ["warning: from lint"]);
});

test("a program that declares report where the ceiling does not grant it is refused, as for any capability", async () => {
  const r = await run(['report.message("x")'], { ceiling: ["output"] });
  assert.equal(describe(r.outcome.end), "refused: the module declares the capability report, which the ceiling does not grant");
  assert.deepEqual(r.messages, []);
});

test("a program that does not declare report is unaffected by a ceiling that grants it", async () => {
  const c = collector();
  const outcome = await launch({ createKernel, program: emitted('capability output\noutput.write("hello, world")\n'), configuration: CEILING, target: { capabilities: [output, report(c.sink)], primitives: shipped } });
  assert.deepEqual(outcome.lines, ["hello, world"]);
  assert.equal(outcome.end.kind, "completed");
  assert.deepEqual(c.messages, []);
  assert.equal(c.status(), 0);
});

test("the terminal's line for each shape of message: file:line:column: level: text with the parts it has, level: text where there is no file", () => {
  assert.equal(messageLine({ level: "error", text: "e" }), "error: e");
  assert.equal(messageLine({ level: "warning", text: "w", file: "a.alg" }), "a.alg: warning: w");
  assert.equal(messageLine({ level: "note", text: "n", file: "a.alg", line: 3n }), "a.alg:3: note: n");
  assert.equal(messageLine({ level: "error", text: "e", file: "a.alg", line: 3n, column: 7n }), "a.alg:3:7: error: e");
  assert.equal(messageLine({ level: "note", text: "n", line: 3n, column: 7n }), "note: n");
  assert.equal(messageLine({ level: "note", text: "n", file: "a.alg", column: 7n }), "a.alg: note: n");
  const written: string[] = [];
  const t = terminalReport((line) => written.push(line));
  t.sink.message({ level: "warning", text: "w", file: "a.alg", line: 1n, column: 2n });
  t.sink.status(4);
  t.sink.message({ level: "note", text: "n" });
  t.sink.status(1);
  assert.deepEqual(written, ["a.alg:1:2: warning: w", "note: n"], "one line for each message, as it is handed over, and nothing for a status");
  assert.equal(t.status(), 4, "the terminal's sink keeps the highest status");
});

test("the exit code is the higher of the end's code, 0 for a completed run and 1 otherwise, and the highest status", () => {
  assert.equal(exitCode({ kind: "completed", steps: 1 }, 0), 0);
  assert.equal(exitCode({ kind: "completed", steps: 1 }, 3), 3);
  assert.equal(exitCode({ kind: "refuted", steps: 1, reason: "r", reasons: ["r"] }, 0), 1);
  assert.equal(exitCode({ kind: "refuted", steps: 1, reason: "r", reasons: ["r"] }, 7), 7);
  assert.equal(exitCode({ kind: "waiting", steps: 1, reason: "w", unanswered: 0, inputs: [] }, 1), 1);
  assert.equal(exitCode({ kind: "refused", reason: "r", findings: [] }, 0), 1);
});

test("the check-output capability reaches no host API", () => {
  // The code alone: comments and the texts of string literals left out.
  const text = fs.readFileSync(path.join(here, "report.ts"), "utf8");
  const code = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g, '""');
  assert.deepEqual([...text.matchAll(/^import .* from "([^"]+)";$/gm)].map((m) => m[1]), ["../kernel/interface.js", "./launcher.js"]);
  assert.doesNotMatch(code, /\bprocess\b|\bimport\(|\brequire\(|\bBuffer\b|\bfetch\b|\bglobalThis\b|\bsetTimeout\b|\bsetImmediate\b|\bconsole\b/);
});
