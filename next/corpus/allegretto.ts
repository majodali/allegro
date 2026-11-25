// The Allegretto programs of the acceptance corpus (B-196 (the rebuild's
// acceptance side), chunk Q6 (the comparison harness), part 2; chunk Q7
// (the minimal launcher and the output capability), part 3, for the
// inputs, part 4, for imports and the expected refusal, and part 5, for
// the timer capability; chunk Q16 (the capabilities the launchers ship),
// part 1, for the HTTP capability and the `// serves:` lines; chunk Q13
// (check and run as configurations, and what a result holds), part 1, for
// the result and the `// summary:` line, and part 3, for the `// phases:`
// line; chunk Q16, part 3, for the check-output capability and the
// `// reports:` and `// status:` lines; chunk Q5 (the first notation and
// the bootstrap) with chunk Q13, for the `// claim at:` line; chunk Q13,
// part 5, for `// phases: check, run` and the `// check claim at:` line;
// chunk Q13, part 6, for `// phases: test`, `// phases: check, test` and
// the `// test:` line): how a
// program under next/corpus/allegretto/ states what it must do, and how it
// is run and compared. The convention is next/corpus/allegretto/README.md.
// One implementation, used by the programs' test
// (next/corpus/allegretto.test.ts) and by the harness's mode `--next`
// (next/corpus/harness.ts).
//
// A program's comments state:
//   // realises: <case id>   a case of next/corpus/cases.json it shows, one per line;
//   // expect: <line>        each line it prints, in order;
//   // end: <how>            how the run ends: `completed`, `refuted: <the
//                             reason the kernel gives>`, `waiting: <the
//                             launcher's reason>`, or `refused: <a
//                             finding's message>` for a text the reader, the
//                             emitter or the driver refuses, or `refused:
//                             <the launcher's reason>`;
//   // yields: a, b          the keys of the structure the module yields, in
//                             order, read through the kernel's interface;
//   // input: n = <literal>  the configuration supplies the input n at the
//                             start, the value an Allegretto literal read by
//                             next/bootstrap/literal.ts;
//   // later: n = <literal>  a later phase supplies the input n; one phase
//                             per line, in order. An `// expect:` line above
//                             it is printed before that phase is applied, one
//                             below it in that phase or after, as the
//                             launcher's count of lines before each phase
//                             (`linesBeforePhase`) shows;
//   // serves: GET <url> = <status> <literal>
//                             the network answers the request of this
//                             method and URL with this status and, as the
//                             body, the bytes of the text literal, read by
//                             next/bootstrap/literal.ts; one line per
//                             request served. Any other request is
//                             unreachable.
//   // summary: <word>       the run's summary, the weakest strength among
//                             its claims (`summaryOf` of
//                             next/launch/launcher.ts): `refuted`,
//                             `undecided`, `assumed`, `sampled` or
//                             `decided`. At most one line. A program that
//                             states none is not compared on it;
//   // claim at: <line>:<column> <word>
//                             the claim written at that line and column
//                             of the program's own text came out with
//                             that word (`claimWord` of
//                             next/launch/launcher.ts, the rule the
//                             summary uses for one claim): `decided`,
//                             `sampled`, `assumed`, `undecided`,
//                             `refuted` or `waiting`. A program may state
//                             several. A line that names a place where no
//                             claim of the result is written fails the
//                             program;
//   // phases: check         the phases the launch applies, as the setting
//                             `phases` of next/tools/configuration.ts names
//                             them: `check` alone, `check, run`, `test`
//                             or `check, test`, the values built beside
//                             `run`. At most one line.
//                             A program that states none runs as `run`
//                             alone. Check is the kernel's check
//                             (`Phase.check` of next/launch/launcher.ts):
//                             it performs nothing, leaves every input
//                             unknown, and hands the check capabilities of
//                             the ceiling, `report` alone, as not needed.
//                             Under `check, run` the `// input:` lines are
//                             the run's, and each `// later:` line is a
//                             phase after the run. The `// expect:`,
//                             `// end:`, `// reports:` and `// status:`
//                             lines hold for the whole launch, and the
//                             `// summary:` and `// claim at:` lines for
//                             the last phase's result. Under `test` and
//                             `check, test` the module is a test module:
//                             it is loaded, with the `// input:` lines,
//                             and each of its tests is called
//                             (`Phase.test` of next/launch/launcher.ts).
//                             The `// expect:` lines are then the lines of
//                             the load and of every test, in order, and
//                             the `// summary:` and `// claim at:` lines
//                             hold for the load's result;
//   // test: <name>: <end>   one test the test phase called, in order:
//                             its name and how it ended, `passed` where it
//                             completed, else the end as `// end:` writes
//                             it. A program that states any must state
//                             exactly the tests called. One with phases
//                             that are no test phase fails;
//   // check claim at: <line>:<column> <word>
//                             as `// claim at:`, for the check's result,
//                             where the phases are `check, run`. A program
//                             with other phases that states one fails;
//   // reports: <level>: <text>
//                             a message the program hands to
//                             `report.message`, one line for each, in the
//                             order handed over, compared as `// expect:`
//                             lines are. A message with a file is written
//                             as the terminal writes it, with its place
//                             first (`messageLine` of
//                             next/launch/report.ts). A program that states
//                             no such line is not compared on its
//                             messages; one that states any must hand over
//                             exactly those;
//   // status: <n>           the highest status the program hands to
//                             `report.status`, 0 where it hands none: a
//                             whole number from 0 to 255. At most one line.
//                             A program that states none is not compared
//                             on it.
// A program is emitted with the texts it imports by the bootstrap's driver
// (next/bootstrap/driver.ts), and its records run by the launcher of
// next/launch/launcher.ts on a kernel of the variant the caller gives,
// by default the variant in use (`createKernel` of
// next/launch/kernel-variant.ts), the imported ones loaded first, with the output capability, the timer capability, the
// HTTP capability, the check-output capability, the shipped primitives and
// its inputs. It passes when its lines, its end, the lines printed before
// each later phase and, where stated, its yielded keys, its summary, the
// word of each claim it names by its place, its messages and its status
// are the expected ones. A run gives the launcher's result
// (`ProgramRun.result`): its claims, each with its place, its summary and
// what it rests on.
//
// The ceiling grants `output`, `timer`, `http` and `report`. The timer capability
// (next/launch/timer.ts) is made, for each run, with a new virtual clock
// (`virtualClock` of next/launch/clock.ts): it runs no real time, and
// answers the waits in the order they fall due, the earlier asked first
// among waits due at the same time. So a program's printed order under
// waits is the order its waits fall due, and a run takes no wall-clock
// time for them. The HTTP capability (next/launch/http.ts) is made, for
// each run, with a new scripted transport (`scriptedTransport` of
// next/launch/scripted-transport.ts) that serves the program's
// `// serves:` lines and reaches no network. It answers in the order the
// requests were asked, so two runs print the same. The requests it was
// handed are part of what a run gives (`ProgramRun.requests`). The
// check-output capability (next/launch/report.ts) is made, for each run,
// with a sink that keeps the messages and the highest status (`collector`),
// and both are part of what a run gives (`ProgramRun.messages` and
// `ProgramRun.status`).
//
// Where a program is, and where its imported texts are: a program is a
// `.alg` file directly in a directory `m<milestone>`, or the file
// `main.alg` in a directory directly under one. The other `.alg` files of
// such a directory are the texts `main.alg` imports, found by the driver's
// rule (`importedFile`): they are no programs of their own. A program
// directly in `m<milestone>` may import another file there, which is then
// a program too.

import * as fs from "fs";
import * as path from "path";
import type { Cell, CreateKernel } from "../kernel/interface.js";
import { createKernel as variantInUse } from "../launch/kernel-variant.js";
import { encode, load, type SavedProgram } from "../kernel/saved-program.js";
import { describeDriveFinding, drive, type ReadText } from "../bootstrap/driver.js";
import { boundedReader } from "../launch/files.js";
import { nodeFiles } from "../launch/node-files.js";
import { readLiteral } from "../bootstrap/literal.js";
import { CLAIM_WORDS, claimWord, launch, plainValue, STRENGTHS, type ClaimWord, type Inputs, type LaunchEnd, type LaunchOutcome, type LaunchResult, type Plain, type Strength } from "../launch/launcher.js";
import { shapeOf } from "../tools/configuration.js";
import { output, outputWrite } from "../launch/output.js";
import { timer } from "../launch/timer.js";
import { virtualClock } from "../launch/clock.js";
import { http, type HttpRequest } from "../launch/http.js";
import { scriptedTransport, type Served } from "../launch/scripted-transport.js";
import { collector, HIGHEST_STATUS, LEVELS, messageLine, report, type ReportMessage } from "../launch/report.js";
import { shipped, shippedByName } from "../prims/index.js";

/** Where the programs are, relative to the repository root. */
export const PROGRAMS_DIR = "next/corpus/allegretto";

/** The repository root. */
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");

/**
 * A reader of the texts under a root: a path relative to it, or absolute;
 * undefined where there is no such file. It is bounded to the root
 * (next/launch/files.ts): a file whose real path is outside it is refused.
 */
export function readUnder(root: string): ReadText {
  const bounded = boundedReader([root], nodeFiles);
  return (file) => bounded(path.isAbsolute(file) ? file : path.join(root, file));
}

/** The step budget every program runs under. */
export const STEPS = 1_000_000;

/** The capabilities the ceiling grants every program. */
export const CEILING: readonly string[] = ["output", "timer", "http", "report"];

/** What a program's comments say it must do, and the cases it names. */
export interface Pins {
  readonly lines: string[];
  /** How it must end; undefined when no `// end:` line is written. */
  readonly end: string | undefined;
  readonly yields: string[] | undefined;
  /** The ids of its `// realises:` lines, in order, as written. */
  readonly realises: string[];
  /** Its `// input:` lines: each input's name and literal, as written. */
  readonly inputs: Array<{ readonly name: string; readonly literal: string }>;
  /** Its `// later:` lines, one later phase each, in order, with the number of `// expect:` lines above each. */
  readonly later: Array<{ readonly name: string; readonly literal: string; readonly expectsAbove: number }>;
  /** The `// input:` and `// later:` lines not of the form `name = <literal>`, as written. */
  readonly malformed: string[];
}

export function readPins(text: string): Pins {
  const lines: string[] = [];
  const realises: string[] = [];
  let end: string | undefined;
  let yields: string[] | undefined;
  const inputs: Pins["inputs"] = [];
  const later: Pins["later"] = [];
  const malformed: string[] = [];
  for (const line of text.split("\n")) {
    const m = /^\s*\/\/\s*(expect|end|yields|realises|input|later):\s?(.*)$/.exec(line);
    if (m === null) continue;
    if (m[1] === "expect") lines.push(m[2].trimEnd());
    else if (m[1] === "end") end = m[2].trim();
    else if (m[1] === "realises") realises.push(m[2].trim());
    else if (m[1] === "input" || m[1] === "later") {
      const s = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(m[2]);
      if (s === null) malformed.push(line.trim());
      else if (m[1] === "input") inputs.push({ name: s[1], literal: s[2] });
      else later.push({ name: s[1], literal: s[2], expectsAbove: lines.length });
    } else yields = m[2].split(",").map((s) => s.trim()).filter((s) => s !== "");
  }
  return { lines, end, yields, realises, inputs, later, malformed };
}

/** A program's inputs as the launcher's configuration takes them, or why they cannot be. */
export function inputsOf(pins: Pins): { inputs: Inputs; later: Inputs[] } | { problems: string[] } {
  const problems = pins.malformed.map((l) => `the line ${JSON.stringify(l)} is not of the form name = <literal>`);
  const value = (literal: string): Plain | undefined => {
    const r = readLiteral(literal);
    if (!r.ok) problems.push(r.finding);
    return r.ok ? r.value : undefined;
  };
  const inputs: Record<string, Plain> = {};
  for (const i of pins.inputs) {
    if (Object.hasOwn(inputs, i.name)) problems.push(`the input ${i.name} has two \`// input:\` lines`);
    const v = value(i.literal);
    if (v !== undefined) inputs[i.name] = v;
  }
  const later: Inputs[] = [];
  for (const l of pins.later) {
    const v = value(l.literal);
    if (v !== undefined) later.push({ [l.name]: v });
  }
  return problems.length > 0 ? { problems } : { inputs, later };
}

/**
 * A program's `// serves:` lines: each the answer to one request, as the
 * scripted transport takes it, and the problems of the lines that cannot
 * be read. A line is `<METHOD> <url> = <status> <literal>`: the status a
 * whole number of three digits, the literal a text literal, whose bytes are
 * the body. The answer has no headers. Two lines for one method and URL are
 * a problem.
 */
export function readServes(text: string): { served: Served[]; problems: string[] } {
  const served: Served[] = [];
  const problems: string[] = [];
  for (const line of text.split("\n")) {
    const m = /^\s*\/\/\s*serves:\s?(.*)$/.exec(line);
    if (m === null) continue;
    const s = /^(\S+)\s+(\S+)\s*=\s*([1-9][0-9][0-9])\s+(.*?)\s*$/.exec(m[1]);
    if (s === null) {
      problems.push(`the line ${JSON.stringify(line.trim())} is not of the form <METHOD> <url> = <status> <literal>`);
      continue;
    }
    const [, method, url, status, literal] = s;
    const r = readLiteral(literal);
    if (!r.ok) {
      problems.push(r.finding);
      continue;
    }
    if (!literal.startsWith('"') || !("bits" in r.value)) {
      problems.push(`the line ${JSON.stringify(line.trim())} serves a body that is no text literal`);
      continue;
    }
    if (served.some((x) => x.method === method && x.url === url)) {
      problems.push(`the request ${method} ${url} has two \`// serves:\` lines`);
      continue;
    }
    served.push({ method, url, answer: { status: Number(status), headers: [], body: r.value.bits } });
  }
  return { served, problems };
}

/**
 * A program's `// summary:` line: the word it states, and the problems of
 * the lines that cannot be read. The word is a strength of `STRENGTHS`.
 * Two lines are a problem.
 */
export function readSummary(text: string): { summary: Strength | undefined; problems: string[] } {
  let summary: Strength | undefined;
  const problems: string[] = [];
  let lines = 0;
  for (const line of text.split("\n")) {
    const m = /^\s*\/\/\s*summary:\s?(.*)$/.exec(line);
    if (m === null) continue;
    if (++lines === 2) problems.push("the program has two `// summary:` lines");
    const word = m[1].trim();
    if ((STRENGTHS as readonly string[]).includes(word)) summary ??= word as Strength;
    else problems.push(`the line ${JSON.stringify(line.trim())} states no summary: the words are ${STRENGTHS.join(", ")}`);
  }
  return { summary, problems };
}

/** One `// claim at:` line: the line and column of the program's own text where the claim is written, and its word. */
export interface ClaimLine {
  readonly line: number;
  readonly column: number;
  readonly word: ClaimWord;
}

/**
 * A program's `// claim at:` lines, in order, and the problems of the
 * lines that cannot be read. A line is `<line>:<column> <word>`: the line
 * and column whole numbers from 1, the word one of `CLAIM_WORDS`. With
 * `label` `check claim at`, its `// check claim at:` lines, read the same
 * way.
 */
export function readClaimLines(text: string, label: "claim at" | "check claim at" = "claim at"): { claims: ClaimLine[]; problems: string[] } {
  const claims: ClaimLine[] = [];
  const problems: string[] = [];
  const start = new RegExp(`^\\s*\\/\\/\\s*${label}:\\s?(.*)$`);
  for (const line of text.split("\n")) {
    const m = start.exec(line);
    if (m === null) continue;
    const s = /^([1-9][0-9]*):([1-9][0-9]*)\s+(\S+)\s*$/.exec(m[1].trim());
    if (s === null || !(CLAIM_WORDS as readonly string[]).includes(s[3]))
      problems.push(`the line ${JSON.stringify(line.trim())} is not of the form ${label}: <line>:<column> <word>, the word one of ${CLAIM_WORDS.join(", ")}`);
    else claims.push({ line: Number(s[1]), column: Number(s[2]), word: s[3] as ClaimWord });
  }
  return { claims, problems };
}

/**
 * The problems of a run's claims against the `// claim at:` lines: for
 * each line, every claim of the result written at that line and column of
 * `file` must have the word stated, and there must be one. The launcher's
 * `at` says where a claim was written; nothing here reads more.
 */
export function claimProblems(result: LaunchResult, file: string, stated: readonly ClaimLine[]): string[] {
  const problems: string[] = [];
  for (const s of stated) {
    const there = result.claims.filter((c) => c.at !== undefined && c.at.source === file && c.at.start.line === s.line && c.at.start.column === s.column);
    if (there.length === 0) problems.push(`no claim of the result is written at ${s.line}:${s.column} of ${file}`);
    for (const c of there) {
      const word = claimWord(c);
      if (word !== s.word) problems.push(`the claim at ${s.line}:${s.column} came out ${word}, expected ${s.word}`);
    }
  }
  return problems;
}

/**
 * A program's `// phases:` line: the names it states, in order, and the
 * problems of the lines that cannot be read. The names are separated by
 * commas. Two lines are a problem. Whether the list is built is the
 * resolver's to say (`shapeOf` of next/tools/configuration.ts).
 */
export function readPhases(text: string): { phases: string[] | undefined; problems: string[] } {
  let phases: string[] | undefined;
  const problems: string[] = [];
  let lines = 0;
  for (const line of text.split("\n")) {
    const m = /^\s*\/\/\s*phases:\s?(.*)$/.exec(line);
    if (m === null) continue;
    if (++lines === 2) problems.push("the program has two `// phases:` lines");
    const names = m[1].split(",").map((n) => n.trim());
    if (names.some((n) => !/^[a-z]+$/.test(n))) problems.push(`the line ${JSON.stringify(line.trim())} is not of the form phases: <name>, <name>`);
    else phases ??= names;
  }
  return { phases, problems };
}

/**
 * A program's `// reports:` lines: each message as the line states it, in
 * order, or undefined where it states none; and the problems of the lines
 * that cannot be read. A line is `<level>: <text>`, with the place first
 * where the message has one, as `messageLine` writes it: so it holds one
 * of the levels `error`, `warning` and `note`, followed by a colon and a
 * space, at the start or after a place.
 */
export function readReports(text: string): { reports: string[] | undefined; problems: string[] } {
  let reports: string[] | undefined;
  const problems: string[] = [];
  const level = new RegExp(`(?:^|: )(?:${LEVELS.join("|")}):(?: |$)`);
  for (const line of text.split("\n")) {
    const m = /^\s*\/\/\s*reports:\s?(.*)$/.exec(line);
    if (m === null) continue;
    const stated = m[1].trimEnd();
    if (!level.test(stated)) problems.push(`the line ${JSON.stringify(line.trim())} is not of the form reports: <level>: <text>, the level one of ${LEVELS.join(", ")}`);
    else (reports ??= []).push(stated);
  }
  return { reports, problems };
}

/**
 * A program's `// status:` line: the status it states, and the problems of
 * the lines that cannot be read. The status is a whole number from 0 to
 * 255. Two lines are a problem.
 */
export function readStatus(text: string): { status: number | undefined; problems: string[] } {
  let status: number | undefined;
  const problems: string[] = [];
  let lines = 0;
  for (const line of text.split("\n")) {
    const m = /^\s*\/\/\s*status:\s?(.*)$/.exec(line);
    if (m === null) continue;
    if (++lines === 2) problems.push("the program has two `// status:` lines");
    const word = m[1].trim();
    if (/^(0|[1-9][0-9]{0,2})$/.test(word) && Number(word) <= HIGHEST_STATUS) status ??= Number(word);
    else problems.push(`the line ${JSON.stringify(line.trim())} states no status: a status is a whole number from 0 to ${HIGHEST_STATUS}`);
  }
  return { status, problems };
}

/** One `// test:` line: a test's name and its end, `passed` or as `// end:` writes it. */
export interface TestLine {
  readonly name: string;
  readonly end: string;
}

/**
 * A program's `// test:` lines, in order, or undefined where it states
 * none; and the problems of the lines that cannot be read. A line is
 * `<name>: <end>`: the name a symbol's name, the end `passed` or one an
 * `// end:` line may state.
 */
export function readTestLines(text: string): { tests: TestLine[] | undefined; problems: string[] } {
  let tests: TestLine[] | undefined;
  const problems: string[] = [];
  for (const line of text.split("\n")) {
    const m = /^\s*\/\/\s*test:\s?(.*)$/.exec(line);
    if (m === null) continue;
    const s = /^([A-Za-z_][A-Za-z0-9_]*):\s+(passed|(?:refuted|limit|waiting|fault|refused): .*\S)\s*$/.exec(m[1].trim());
    if (s === null) problems.push(`the line ${JSON.stringify(line.trim())} is not of the form test: <name>: <end>, the end passed or one an \`// end:\` line states`);
    else (tests ??= []).push({ name: s[1], end: s[2] });
  }
  return { tests, problems };
}

/** A test's end as a program's `// test:` line writes it: `passed` where it completed. */
export function testEndText(end: LaunchEnd): string {
  return end.kind === "completed" ? "passed" : endText(end);
}

/** A run's end as a program's `// end:` line writes it. */
export function endText(end: LaunchEnd): string {
  if (end.kind === "refuted") return `refuted: ${end.reason}`;
  if (end.kind === "completed") return "completed";
  return `${end.kind}: ${"reason" in end ? end.reason : ""}`;
}

/**
 * The emitted record of a text and the records of the texts it imports, in
 * the order they are loaded, as JSON round-trips them; or the driver's
 * findings, each as a person reads it and as its message alone.
 */
export function emitted(text: string, file = "<text>", readText: ReadText = readUnder(ROOT), createKernel: CreateKernel = variantInUse): { program: SavedProgram; imports: SavedProgram[] } | { findings: string[]; messages: string[] } {
  const r = drive(text, file, readText, createKernel);
  if (!r.ok) return { findings: r.findings.map(describeDriveFinding), messages: r.findings.map((f) => f.message) };
  const records = r.records.map((x) => JSON.parse(encode(x.program)) as SavedProgram);
  return { program: records[records.length - 1], imports: records.slice(0, -1) };
}

/**
 * The keys of the structure a module yields, read through the kernel's
 * interface: the records it imports and then its own are loaded into a
 * kernel, and the module applied by hand to an output capability and its
 * inputs, with no argument for an import, which the kernel supplies. An
 * input supplied at the start is its plain data; any other is a cell,
 * filled by the later phase that supplies it, in order.
 */
export function yieldedKeys(
  program: SavedProgram,
  given: { inputs: Inputs; later: Inputs[] } = { inputs: {}, later: [] },
  imports: readonly SavedProgram[] = [],
  createKernel: CreateKernel = variantInUse,
): { keys: (string | null)[] } | { problem: string } {
  const k = createKernel();
  const byHash = new Map([...shippedByName.values()].map((p) => [p.hash, p] as const));
  const primitives = new Map([...imports, program].flatMap((doc) => doc.needs).map((n) => [n.hash, k.primitiveFunction(byHash.get(n.hash)!)] as const));
  for (const doc of imports) load(k, doc, primitives);
  const fn = load(k, program, primitives);
  // One argument for each capability and input: the output capability, and the inputs.
  const other = program.declares.find((d) => d.role === "capability" && d.name !== "output");
  if (other !== undefined) return { problem: `the module declares the ${other.role} ${other.name}, which this reading of a yield cannot supply` };
  const cells = new Map<string, Cell>();
  const args = program.declares.filter((d) => d.role !== "module").map((d) => {
    if (d.role === "capability") return k.structure([[k.symbol("write"), k.primitiveFunction(outputWrite(() => {}))]]);
    if (Object.hasOwn(given.inputs, d.name)) return plainValue(k, given.inputs[d.name]);
    const cell = k.cell();
    cells.set(d.name, cell);
    return cell;
  });
  const r = k.evaluate(k.expression(fn, args), { steps: STEPS });
  if (r.refuted) return { problem: "the module was refuted when instantiated by hand" };
  for (const phase of given.later) {
    for (const [name, plain] of Object.entries(phase)) {
      const cell = cells.get(name);
      if (cell !== undefined && !k.filled(cell)) k.fill(cell, plainValue(k, plain), { hold: true });
    }
    if (k.advance().refuted.length > 0) return { problem: "the module was refuted when instantiated by hand" };
  }
  const value = k.current(r.value);
  if (k.kind(value) !== "structure") return { problem: `the module yields a value of kind ${k.kind(value)}, not a structure` };
  return { keys: k.entriesOf(value).map(([key]) => (key === null ? null : k.symbolName(key))) };
}

/** What a run of one program gave, and what differs from its pins. */
export interface ProgramRun {
  readonly pins: Pins;
  /** The driver's findings, for the text or a text it imports; empty when the text emitted. */
  readonly findings: string[];
  readonly lines: string[];
  /**
   * The end as `// end:` writes it. Where the driver refused the text and
   * nothing was launched, `refused:` and the refusal as the program states
   * it where a finding matches, else the first finding's message.
   */
  readonly end: string | null;
  /** The yielded keys, when the program states `// yields:`. */
  readonly yields: (string | null)[] | undefined;
  /** The requests the program handed the HTTP capability's transport, in the order asked; empty when it was not launched. */
  readonly requests: HttpRequest[];
  /** The launcher's result: the claims, the summary and what the run rests on. Undefined where nothing was launched or the launcher refused. */
  readonly result: LaunchResult | undefined;
  /** The messages the program handed to `report.message`, in order, as host data; empty when it was not launched. */
  readonly messages: ReportMessage[];
  /** The highest status the program handed to `report.status`; 0 where it handed none or was not launched. */
  readonly status: number;
  /** Under a test phase, the load's outcome and each test's, as the launcher gives them; undefined otherwise, or where the load was not started. */
  readonly tests?: NonNullable<LaunchOutcome["tests"]>;
  /** Each way the run differs from the pins; empty when the program passes. */
  readonly problems: string[];
}

/**
 * Emits a text with the texts it imports, launches it, and compares lines,
 * end and yields with its pins. `readText` reads the imported texts; by
 * default, files relative to the repository root. A text the driver
 * refuses is launched not at all: it passes where its `// end: refused:`
 * line states the message of one of the findings, or the part of one
 * before a colon, and it states no line. `createKernel` makes the kernel
 * of the drive, of the run and of reading the yield.
 */
export async function runProgram(text: string, file = "<text>", readText: ReadText = readUnder(ROOT), createKernel: CreateKernel = variantInUse): Promise<ProgramRun> {
  const pins = readPins(text);
  const problems: string[] = [];
  if (pins.end === undefined) problems.push("the program states no `// end:` line");
  const summaryLine = readSummary(text);
  const claimLines = readClaimLines(text);
  const checkClaimLines = readClaimLines(text, "check claim at");
  const e = emitted(text, file, readText, createKernel);
  if ("findings" in e) {
    const stated = pins.end !== undefined && pins.end.startsWith("refused: ") ? pins.end.slice("refused: ".length) : undefined;
    // The message itself, or its part before a colon: a failed parse is stated as `not Allegretto`, without the engine's own words.
    const states = (message: string): boolean => stated !== undefined && (message === stated || message.startsWith(`${stated}: `));
    if (!e.messages.some(states)) problems.push(`the emitter refuses the text: ${e.findings.join("; ")}`);
    if (pins.lines.length > 0) problems.push(`nothing was launched, and ${pins.lines.length} \`// expect:\` line(s) are stated`);
    if (pins.later.length > 0 || pins.yields !== undefined) problems.push("nothing was launched, and the program states a `// later:` or `// yields:` line");
    if (summaryLine.summary !== undefined) problems.push("nothing was launched, and the program states a `// summary:` line");
    if (claimLines.claims.length > 0) problems.push("nothing was launched, and the program states a `// claim at:` line");
    if (checkClaimLines.claims.length > 0) problems.push("nothing was launched, and the program states a `// check claim at:` line");
    if (readPhases(text).phases !== undefined) problems.push("nothing was launched, and the program states a `// phases:` line");
    if (readReports(text).reports !== undefined || readStatus(text).status !== undefined) problems.push("nothing was launched, and the program states a `// reports:` or `// status:` line");
    if (readTestLines(text).tests !== undefined) problems.push("nothing was launched, and the program states a `// test:` line");
    // The end is the refusal as the program states it where a finding matches, and the first finding's message otherwise.
    return { pins, findings: e.findings, lines: [], end: `refused: ${e.messages.some(states) ? stated : e.messages[0]}`, yields: undefined, requests: [], result: undefined, messages: [], status: 0, problems };
  }
  const given = inputsOf(pins);
  const network = readServes(text);
  const phaseLine = readPhases(text);
  const reportLines = readReports(text);
  const statusLine = readStatus(text);
  const testLines = readTestLines(text);
  // The phases, as the resolver makes them of the setting `phases`.
  const shape = "problems" in given || phaseLine.problems.length > 0 ? undefined : shapeOf(phaseLine.phases, given.inputs, given.later, CEILING);
  const shapeProblems = shape === undefined || shape.ok ? [] : [...shape.findings];
  // A `// check claim at:` line states a word of the check's result, which a launch has beside the run's only under check, run.
  const checkThenRun = JSON.stringify(phaseLine.phases) === JSON.stringify(["check", "run"]);
  const checkLineProblems = checkClaimLines.claims.length > 0 && !checkThenRun ? ["the program states a `// check claim at:` line, and its phases are not check, run"] : [];
  // A `// test:` line states a test the test phase called: the phases must have one.
  const testing = phaseLine.phases?.includes("test") === true;
  const testLineProblems = testLines.tests !== undefined && !testing ? ["the program states a `// test:` line, and its phases are not test or check, test"] : [];
  const lineProblems = [...network.problems, ...summaryLine.problems, ...claimLines.problems, ...checkClaimLines.problems, ...checkLineProblems, ...phaseLine.problems, ...shapeProblems, ...reportLines.problems, ...statusLine.problems, ...testLines.problems, ...testLineProblems];
  if ("problems" in given || lineProblems.length > 0) {
    problems.push(...("problems" in given ? given.problems : []), ...lineProblems);
    return { pins, findings: [], lines: [], end: null, yields: undefined, requests: [], result: undefined, messages: [], status: 0, problems };
  }
  const transport = scriptedTransport(network.served);
  const reported = collector();
  const outcome = await launch({
    createKernel,
    program: e.program,
    imports: e.imports,
    configuration: { ceiling: CEILING, steps: STEPS, ...(shape !== undefined && shape.ok ? shape.shape : {}) },
    target: { capabilities: [output, timer(virtualClock().clock), http(transport.transport), report(reported.sink)], primitives: shipped },
  });
  const end = endText(outcome.end);
  if (JSON.stringify(outcome.lines) !== JSON.stringify(pins.lines))
    problems.push(`printed ${JSON.stringify(outcome.lines)}, expected ${JSON.stringify(pins.lines)}`);
  // Each `// later:` line: applied, and with the `// expect:` lines above it printed before it.
  // It follows run: under check, run the launcher counts the run itself as the first later phase.
  pins.later.forEach((l, i) => {
    const before = outcome.linesBeforePhase[checkThenRun ? i + 1 : i];
    if (before === undefined) problems.push(`the later phase that supplies ${l.name} (phase ${i + 1}) was not applied`);
    else if (before !== l.expectsAbove)
      problems.push(`${before} line(s) were printed before the later phase that supplies ${l.name} (phase ${i + 1}), and ${l.expectsAbove} \`// expect:\` line(s) are above it`);
  });
  if (pins.end !== undefined && end !== pins.end) problems.push(`ended ${JSON.stringify(end)}, expected ${JSON.stringify(pins.end)}`);
  // The summary, where the program states one: the launcher's word, compared as it is.
  if (summaryLine.summary !== undefined) {
    if (outcome.result === undefined) problems.push(`the launcher refused the run, and the program states the summary ${summaryLine.summary}`);
    else if (outcome.result.summary !== summaryLine.summary)
      problems.push(`the summary is ${JSON.stringify(outcome.result.summary)}, expected ${JSON.stringify(summaryLine.summary)}`);
  }
  // Each claim the program states by its place: the launcher's place and the summary's rule for one claim.
  if (claimLines.claims.length > 0) {
    if (outcome.result === undefined) problems.push("the launcher refused the run, and the program states a `// claim at:` line");
    else problems.push(...claimProblems(outcome.result, file, claimLines.claims));
  }
  // Each claim the program states by its place in the check's result, under check, run: the first phase's.
  if (checkClaimLines.claims.length > 0) {
    const checked = outcome.phases?.[0];
    if (checked === undefined) problems.push("the launcher refused the run, and the program states a `// check claim at:` line");
    else problems.push(...claimProblems(checked.result, file, checkClaimLines.claims).map((p) => `in the check's result, ${p}`));
  }
  // The messages and the status, where the program states them: compared as `// expect:` lines are.
  // A line's trailing spaces are not stated, as for `// expect:` lines.
  const handed = reported.messages.map((m) => messageLine(m).trimEnd());
  if (reportLines.reports !== undefined && JSON.stringify(handed) !== JSON.stringify(reportLines.reports))
    problems.push(`reported ${JSON.stringify(handed)}, expected ${JSON.stringify(reportLines.reports)}`);
  if (statusLine.status !== undefined && reported.status() !== statusLine.status) problems.push(`the status is ${reported.status()}, expected ${statusLine.status}`);
  // The tests called, where the program states any: each name and end, in order, and no other.
  if (testLines.tests !== undefined) {
    const called = (outcome.tests?.tests ?? []).map((t) => `${t.name}: ${testEndText(t.end)}`);
    const stated = testLines.tests.map((t) => `${t.name}: ${t.end}`);
    if (JSON.stringify(called) !== JSON.stringify(stated)) problems.push(`the tests called are ${JSON.stringify(called)}, expected ${JSON.stringify(stated)}`);
  }
  let yields: (string | null)[] | undefined;
  if (pins.yields !== undefined) {
    const y = yieldedKeys(e.program, given, e.imports, createKernel);
    if ("problem" in y) problems.push(y.problem);
    else {
      yields = y.keys;
      if (JSON.stringify(y.keys) !== JSON.stringify(pins.yields)) problems.push(`yields ${JSON.stringify(y.keys)}, expected ${JSON.stringify(pins.yields)}`);
    }
  }
  return {
    pins, findings: [], lines: outcome.lines, end, yields, requests: transport.asked, result: outcome.result, messages: [...reported.messages], status: reported.status(),
    ...(outcome.tests === undefined ? {} : { tests: outcome.tests }), problems,
  };
}

/**
 * True for a text a program imports and no program of its own: a `.alg`
 * file in a directory directly under `m<milestone>`, other than `main.alg`.
 */
export function isImportedText(file: string): boolean {
  return new RegExp(`^${PROGRAMS_DIR}/m[1-9]/[^/]+/[^/]+\\.alg$`).test(file) && path.basename(file) !== "main.alg";
}

/** Every program under next/corpus/allegretto/, relative to the repository root, in name order: every `.alg` file but the imported texts. */
export function programFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (rel: string): void => {
    for (const d of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
      const r = `${rel}/${d.name}`;
      if (d.isDirectory()) walk(r);
      else if (d.name.endsWith(".alg") && !isImportedText(r)) out.push(r);
    }
  };
  if (fs.existsSync(path.join(root, PROGRAMS_DIR))) walk(PROGRAMS_DIR);
  return out.sort();
}

/**
 * A program's milestone: its directory's, `m<milestone>` directly under
 * next/corpus/allegretto/, for a file directly in it or the `main.alg` of
 * a directory directly under it; null elsewhere.
 */
export function milestoneOf(file: string): number | null {
  const m = new RegExp(`^${PROGRAMS_DIR}/m([1-9])/(?:[^/]+\\.alg|[^/]+/main\\.alg)$`).exec(file);
  return m === null ? null : Number(m[1]);
}
