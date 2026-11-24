// The terminal's entry to the minimal launcher (B-196 (the rebuild's
// acceptance side), chunk Q7 (the minimal launcher), parts 1 to 5; chunk
// Q13 (check and run as configurations, and what a result holds), part 2,
// for the configuration's sources, part 3, for `--phases`, and part 5, for
// `--phases check` as the kernel's check and for `--phases check,run`;
// chunk Q16 (the capabilities the launchers ship), part 3, for check
// output and the exit code; chunk Q13, part 6, for `--phases test` and
// `--phases check,test`). The only
// file of next/launch/ that touches process and fs, with
// next/launch/allegretto.ts.
//
//   npm run launch -- <saved-program.json> [--import <record.json>]... [--steps <n>] [--ceiling <a,b>] [--phases <run|check|check,run|test|check,test>]
//   npx tsx next/launch/terminal.ts <saved-program.json> [--import <record.json>]... [--steps <n>] [--ceiling <a,b>] [--phases <run|check|check,run|test|check,test>]
//
// Each `--import` names the saved program of a module the program
// imports, directly or through another, in the order they are loaded: a
// module before every module that imports it. `npm run emit` names the
// texts whose records a program needs.
//
// The command that runs an Allegretto text directly, next/launch/allegretto.ts,
// uses `terminalArguments` and `runOnTerminal` of this file.
//
// It takes no input flags. A saved program whose module declares an input
// ends waiting on that input, which is how the launcher reports an input
// the configuration does not supply. `npm run allegretto` takes them.
//
// It reads the saved program, runs it with the launcher of
// next/launch/launcher.ts, and writes each line the program prints to
// stdout. Where the run did not complete it writes the reason to stderr.
// Each message the program hands to `report.message` is written to stderr
// as it is handed over, one line each, `file:line:column: level: text`
// with the parts it has, or `level: text` where it has no file
// (`messageLine` of next/launch/report.ts): the form build tools read.
// The exit code is the higher of two numbers: 0 for a completed run and 1
// for any other end, and the highest status the program handed to
// `report.status`, 0 where it handed none (`exitCode`).
//
// The target supplies four capabilities: `output` (next/launch/output.ts);
// `timer` (next/launch/timer.ts), made with the host's real timer
// (`realClock` of next/launch/clock.ts); `http` (next/launch/http.ts,
// part 1 of Q16), made with the host's `fetch` (`fetchTransport`); and
// `report` (next/launch/report.ts, part 3 of Q16), the check-output
// capability, made with the terminal's sink (`terminalReport`). Its pure
// primitives are the shipped ones, `shipped` of next/prims/index.ts.
//
// The configuration is resolved from its sources by `resolve` of
// next/tools/configuration.ts, which reads nothing itself; this file reads
// the sources and hands them in (`resolveOnTerminal`). `npm run launch`
// takes a saved program and no project, so it has three sources, highest
// first:
//   - the command line: `--steps <n>` sets the step budget,
//     `--ceiling a,b` the ceiling, which may only narrow the terminal's,
//     and `--phases` the phases: `run`, `check`, `check,run`, `test` or
//     `check,test` (the
//     setting `phases` of next/tools/configuration.ts). A name the
//     terminal does not supply, and a list of phases that is not built,
//     are findings;
//   - the environment: `ALLEGRO_STEPS`, a whole number, sets the step
//     budget;
//   - what is built into the launcher: the ceiling that grants every
//     capability the terminal supplies (`TERMINAL_CEILING`). Nothing else.
// No source sets a step budget by default: where none does, there is
// none. `npm run allegretto` adds the project's file, `allegro.json`
// beside its text. A finding of the sources is written to stderr, one
// line each, and the entry exits 1; nothing is launched. The run's result
// names the source of each value (`restsOn.configuration` of
// next/launch/launcher.ts), and nothing printed for a run changes. Under
// `--phases check` the launcher hands the module to the kernel's `check`
// (`Phase.check` of next/launch/launcher.ts). Nothing is performed: no
// line is printed, no request is made, and a call on `report` hands no
// message and no status, since the check hands the check capabilities
// (`CHECK_CAPABILITIES` of next/tools/configuration.ts) as not needed. A
// check that finds a refutation writes the end's reason and exits 1; one
// that finds none completes and exits 0. Under `--phases check,run` the
// check comes first, and where it finds nothing the lines, the messages,
// the end and the exit code are the run's. The exit code follows the end
// and the status as for any run. What else check shows is chunk Q14 (the
// commands).
//
// Under `--phases test` the program is a test module, and the launcher
// loads it and calls each of its tests (`Phase.test` of
// next/launch/launcher.ts). The target then has a test version of each
// capability but `report` (`testTarget`): `output` as in a run, whose
// lines the command collects and prints none of while the tests run;
// `timer` on a clock the target moves itself (`virtualClock`), so a wait
// ends at once and waits end in the order of their times; `http` on a
// transport that reaches nothing (`scriptedTransport` serving no
// request), so every request answers `unreachable`; and `report` as in a
// run. Where the load completed, the command prints on stdout one line
// for each test, `test <name>: passed` or `test <name>: <the end>`, the
// lines of each test that did not complete indented by two spaces, and a
// last line `tests: <n> passed, <m> failed` (`testLines` of
// next/launch/test-output.ts). For each test that ended refuted it hands
// the sink one message of level `error`, with the place of the test's
// first refuted claim (`testMessages`). Where the load did not complete,
// it prints what a run prints. A test's calls on `report` act as in a run.
// The exit code is `exitCode`, so a failing test exits 1 with no status
// handed over. `--phases check,test` is a check of the test module and
// then the test phase, as `check,run` is a check and then the run.
// `--restore <builder>` and `--kernel <name>` are reserved to the command
// line by the decision and are not built. The environment variable
// `ALLEGRO_KERNEL` is read by next/kernel/create.ts, not here.
//
// The kernel. The kernel stream provides the factory at KERNEL_MODULE,
// exporting `createKernel` of type `CreateKernel`
// (next/kernel/interface.ts). Until that file exists the entry prints
// one line saying so and exits 2. It never loads the stand-in kernel of
// the launcher's tests.

import * as fs from "fs";
import * as path from "path";
import { pathToFileURL } from "url";
import type { CreateKernel } from "../kernel/interface.js";
import { shipped } from "../prims/index.js";
import { readEnvironment, resolve, type Settings } from "../tools/configuration.js";
import { describe, launch, type Configuration, type ConfigurationSource, type LaunchEnd, type Target } from "./launcher.js";
import { output } from "./output.js";
import { realClock, virtualClock } from "./clock.js";
import { timer } from "./timer.js";
import { fetchTransport, http } from "./http.js";
import { scriptedTransport } from "./scripted-transport.js";
import { collector, messageLine, report, type ReportMessage, type ReportSink } from "./report.js";
import { testLines, testMessages } from "./test-output.js";

/** Where the kernel stream provides the kernel factory, relative to the repository root. */
export const KERNEL_MODULE = "next/kernel/create.ts";

const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(here, "../..");

function fail(message: string, code = 1): never {
  process.stderr.write(message + "\n");
  process.exit(code);
}

async function kernelFactory(): Promise<CreateKernel> {
  const file = path.join(root, KERNEL_MODULE);
  if (!fs.existsSync(file)) fail(`no kernel is built yet: ${KERNEL_MODULE} does not exist`, 2);
  const mod = (await import(pathToFileURL(file).href)) as { createKernel?: unknown };
  if (typeof mod.createKernel !== "function") fail(`${KERNEL_MODULE} does not export a function createKernel`);
  return mod.createKernel as CreateKernel;
}

/**
 * Reads the arguments every terminal entry takes: one file, `--steps <n>`,
 * `--ceiling a,b` and `--phases a,b`. Gives the file and what the command
 * line sets.
 */
export function terminalArguments(argv: readonly string[], usage: string): { file: string; commandLine: { steps?: number; ceiling?: readonly string[]; phases?: readonly string[] } } {
  let file: string | undefined;
  let steps: number | undefined;
  let ceiling: string[] | undefined;
  let phases: string[] | undefined;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--steps") {
      steps = Number(argv[++i]);
      if (!Number.isSafeInteger(steps) || steps < 0) fail("--steps takes a whole number");
    } else if (argv[i] === "--ceiling") {
      const names = argv[++i];
      if (names === undefined) fail(`--ceiling takes the names of capabilities, separated by commas\n${usage}`);
      ceiling = names.split(",").map((n) => n.trim()).filter((n) => n !== "");
    } else if (argv[i] === "--phases") {
      const names = argv[++i];
      if (names === undefined) fail(`--phases takes the names of phases, separated by commas: run, check, check,run, test, or check,test\n${usage}`);
      phases = names.split(",").map((n) => n.trim()).filter((n) => n !== "");
    } else if (file === undefined) file = argv[i];
    else fail(`unexpected argument ${argv[i]}`);
  }
  if (file === undefined) fail(usage);
  return { file, commandLine: { ...(steps === undefined ? {} : { steps }), ...(ceiling === undefined ? {} : { ceiling }), ...(phases === undefined ? {} : { phases }) } };
}

/** Writes each finding to stderr, one line each, and exits 1. */
export function failFindings(findings: readonly string[]): never {
  for (const f of findings) process.stderr.write(f + "\n");
  process.exit(1);
}

/** The ceiling of both terminal commands: every capability the terminal supplies. It is the launcher's own value, and the command line may narrow it. */
export const TERMINAL_CEILING: readonly string[] = ["output", "timer", "http", "report"];

/** A configuration resolved from its sources, and the source of each value. */
export interface TerminalConfiguration {
  readonly configuration: Configuration;
  readonly sources: readonly ConfigurationSource[];
}

/**
 * Resolves the configuration from the command line, the project's file
 * where there is one, the environment of this process, and the launcher's
 * own values. On a finding writes each to stderr and exits 1.
 */
export function resolveOnTerminal(commandLine: Settings, file?: Settings): TerminalConfiguration {
  const environment = readEnvironment(process.env);
  if (!environment.ok) failFindings(environment.findings);
  const r = resolve({ "command line": commandLine, ...(file === undefined ? {} : { file }), environment: environment.settings, launcher: { ceiling: TERMINAL_CEILING } });
  if (!r.ok) failFindings(r.findings);
  return { configuration: r.configuration, sources: r.sources };
}

/**
 * The exit code of both terminal commands: the higher of the code the end
 * gives, 0 for a completed run and 1 for any other, and the highest status
 * handed to `report.status`.
 */
export function exitCode(end: LaunchEnd, status: number): number {
  return Math.max(end.kind === "completed" ? 0 : 1, status);
}

/** The terminal's sink for `report`: each message written to stderr as one line as it is handed over, and the highest status kept. */
export function terminalReport(write: (line: string) => void = (line) => process.stderr.write(line + "\n")): ReturnType<typeof collector> {
  return collector((m: ReportMessage) => write(messageLine(m)));
}

/** The terminal's target for a run: output, timer on the host's real timer, http on the host's fetch, report on `sink`. */
export function runTarget(sink: ReportSink): Target {
  return { capabilities: [output, timer(realClock), http(fetchTransport), report(sink)], primitives: shipped };
}

/**
 * The terminal's target for a test phase, with a test version of each
 * capability but `report`: output as in a run, whose lines the command
 * collects and prints none of while the tests run; timer on a clock the
 * target moves itself (`virtualClock`), so a wait ends at once and waits
 * end in the order of their times; http on a transport that reaches
 * nothing (`scriptedTransport` serving no request), so every request
 * answers `unreachable`; and report on `sink`, as in a run.
 */
export function testTarget(sink: ReportSink): Target {
  return { capabilities: [output, timer(virtualClock().clock), http(scriptedTransport([]).transport), report(sink)], primitives: shipped };
}

/**
 * Runs a saved program, as parsed JSON, on the kernel stream's kernel, with
 * the configuration resolved and the source of each value, and the
 * terminal's target. Writes each line to stdout and each message of
 * `report` to stderr; on any end but completed, writes the reason to
 * stderr. Exits with `exitCode`.
 *
 * Under a test phase (`Phase.test`) the target is `testTarget`, and no line
 * is printed while the tests run. Where the load completed, it hands a
 * message for each test that ended refuted to the sink (`testMessages`),
 * prints the test lines (`testLines`) and exits with `exitCode`. Where the
 * load did not complete, it prints what a run prints: the load's lines, and
 * the end on stderr.
 */
export async function runOnTerminal(program: unknown, resolved: TerminalConfiguration, imports: readonly unknown[] = []): Promise<void> {
  const createKernel = await kernelFactory();
  const reported = terminalReport();
  const testing = resolved.configuration.phases?.some((p) => p.test === true) === true;
  const print = (line: string): void => void process.stdout.write(line + "\n");
  const outcome = await launch({
    createKernel,
    program,
    imports,
    configuration: resolved.configuration,
    sources: resolved.sources,
    target: testing ? testTarget(reported.sink) : runTarget(reported.sink),
    ...(testing ? {} : { onLine: print }),
  });
  if (testing && outcome.tests !== undefined && outcome.tests.load.end.kind === "completed") {
    for (const m of testMessages(outcome.tests)) reported.sink.message(m);
    for (const line of testLines(outcome.tests)) print(line);
    process.exitCode = exitCode(outcome.end, reported.status());
    return;
  }
  if (testing) for (const line of outcome.lines) print(line);
  const code = exitCode(outcome.end, reported.status());
  if (outcome.end.kind !== "completed") fail(describe(outcome.end), code);
  process.exitCode = code;
}

/** Reads a saved program's JSON, or fails saying why. */
function readRecord(file: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    fail(`cannot read ${file} as JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function main(argv: readonly string[]): Promise<void> {
  const usage = "usage: npm run launch -- <saved-program.json> [--import <record.json>]... [--steps <n>] [--ceiling <a,b>] [--phases <run|check|check,run|test|check,test>]";
  const rest: string[] = [];
  const imported: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] !== "--import") rest.push(argv[i]);
    else if (argv[i + 1] === undefined) fail(`--import takes a saved program's file\n${usage}`);
    else imported.push(argv[++i]);
  }
  const { file, commandLine } = terminalArguments(rest, usage);
  const resolved = resolveOnTerminal(commandLine);
  await runOnTerminal(readRecord(file), resolved, imported.map(readRecord));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname))
  await main(process.argv.slice(2));
