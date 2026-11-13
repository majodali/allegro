// The comparison harness (B-196 (the rebuild's acceptance side), chunk Q6
// (the comparison harness), docs/plans/rebuild-acceptance.md §5): it runs
// the programs of the acceptance corpus next/corpus/cases.json through a
// runner, compares what each prints with its pin cases by class, and
// reports the cases passing per milestone.
//
//   npx tsx next/corpus/harness.ts --present                 the calibration:
//                                                            every pinned program
//                                                            on the present tree
//   npm run harness:present                                  the same
//   npx tsx next/corpus/harness.ts --present --milestone N   only the programs with
//                                                            a pin due at 1 to N,
//                                                            and rows 1 to N
//   npx tsx next/corpus/harness.ts --present --file <program>
//                                                            one program
//
// The command prints the findings, one per line, then one row per
// milestone, then a summary line. It exits 1 on a failing survives pin or
// a finding on a program.
//
// One program the calibration does not run. The suite runs
// tests/proofs-proven-demo.alg with an extension the test passes; the file
// runner has no flag for one. PRESENT_RUN_DIFFERS names the program and the
// reason; the command prints it and counts its pins as not run. `--file`
// with that program runs it all the same and shows the stop.
//
// A runner is the one thing the harness asks of an implementation: a
// function from a program (its path relative to the repository root and
// its text) to the lines it printed, in order, and how the run ended. The
// present-tree runner runs the file runner `src/index.ts` in a child
// process, as a user would, and imports nothing from src/. The new tree's
// runner arrives with the kernel and sits behind the same type.
//
// How a pin is compared. The i-th pin of a program is compared with the
// i-th printed line, as src/test/alg-files.ts `runAlgFile` does.
//   survives  passes when the line equals the pin's text exactly.
//   changes   is to review: the finding names the ruling, the new result
//             and what the runner produced there. One finding is raised
//             on it: the produced line equals the present pin, so the
//             change did not happen. Neither passes nor fails.
//   detail    is not compared.
// A program printing more lines than it has pins is a finding on the
// program, and so is a run that stopped after printing a line for every
// pin; runAlgFile fails both.
//
// What it cannot do yet. A test case is counted as not yet realised: how
// a test of the new tree names the case it realises is part 2 of Q6. A
// program whose run a ruling ends early, or whose detail pins no longer
// print, shifts every later ordinal; the comparison by ordinal reports
// those lines as found elsewhere.
//
// Tested by next/corpus/harness.test.ts, against stub runners.

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { spawn } from "child_process";
import { CASES_PATH, type Case, type CaseClass, type Corpus, type PinCase } from "../tools/corpus.js";

// ── The runner ────────────────────────────────────────────────────────

/** A program as a runner receives it. */
export interface Program { path: string; text: string }

/** How a run ended: it completed, or it stopped, with the reason as text. */
export type RunEnd = { kind: "completed" } | { kind: "stopped"; reason: string };

/** What a runner returns: the lines the program printed, in order, and how the run ended. */
export interface RunResult { lines: string[]; end: RunEnd }

/** The one thing the harness asks of an implementation. */
export type Runner = (program: Program) => Promise<RunResult>;

// ── Comparison by class ───────────────────────────────────────────────

export type Outcome = "passes" | "fails" | "to review" | "not compared";

export interface PinVerdict {
  id: string;
  class: CaseClass | null;
  milestone: number | null;
  outcome: Outcome;
  /** The line at the pin's ordinal, or null when the run printed none there. */
  produced: string | null;
  /** True for a changes pin whose produced line equals the present pin. */
  unchanged: boolean;
  /** What a reader needs: for fails and to review, and for an unclassed pin. */
  finding: string | null;
}

export interface ProgramComparison {
  file: string;
  end: RunEnd;
  printed: number;
  verdicts: PinVerdict[];
  /** Findings on the program as a whole. */
  findings: string[];
}

/** The ordinal of a pin case, from its id `pin:<file>#<ordinal>`. */
export function ordinalOf(c: PinCase): number {
  const m = c.id.match(/#(\d+)$/);
  if (!m) throw new Error(`${c.id}: no ordinal in the id`);
  return Number(m[1]);
}

export function describeEnd(end: RunEnd): string {
  return end.kind === "completed" ? "completed" : `stopped: ${end.reason}`;
}

function noLine(result: RunResult): string {
  return `no line (the run printed ${result.lines.length} line(s) and ${describeEnd(result.end)})`;
}

/** Compare one program's pins, given a runner's result, by ordinal. */
export function compareProgram(file: string, pins: PinCase[], result: RunResult): ProgramComparison {
  const sorted = [...pins].sort((a, b) => ordinalOf(a) - ordinalOf(b));
  const verdicts: PinVerdict[] = sorted.map((c) => {
    const i = ordinalOf(c) - 1;
    const produced = i < result.lines.length ? result.lines[i] : null;
    const found = produced === null ? noLine(result) : JSON.stringify(produced);
    const v: PinVerdict = { id: c.id, class: c.class, milestone: c.milestone, outcome: "not compared", produced, unchanged: false, finding: null };
    if (c.class === "survives") {
      if (produced === c.expect) v.outcome = "passes";
      else { v.outcome = "fails"; v.finding = `${c.id}: expected ${JSON.stringify(c.expect)}, found ${found}`; }
    } else if (c.class === "changes") {
      v.outcome = "to review";
      const ruling = typeof c.ruling === "string" ? c.ruling : "?";
      const becomes = typeof c.becomes === "string" ? c.becomes : "?";
      if (produced === c.expect) {
        v.unchanged = true;
        v.finding = `${c.id}: the change did not happen: produced the present pin ${JSON.stringify(c.expect)} exactly; ruling "${ruling}"; becomes: ${becomes}`;
      } else {
        v.finding = `${c.id}: to review by "${ruling}"; becomes: ${becomes}; produced ${found}`;
      }
    } else if (c.class === null) {
      v.finding = `${c.id}: unclassed, not compared`;
    }
    return v;
  });
  const findings: string[] = [];
  const n = sorted.length === 0 ? 0 : Math.max(...sorted.map(ordinalOf));
  if (result.lines.length > n) {
    findings.push(`${file}: printed ${result.lines.length} line(s) for ${n} pin(s); the first line past the pins is ${JSON.stringify(result.lines[n])}`);
  }
  if (result.end.kind === "stopped" && result.lines.length >= n) {
    findings.push(`${file}: the run stopped after a line for every pin: ${result.end.reason}`);
  }
  return { file, end: result.end, printed: result.lines.length, verdicts, findings };
}

// ── The report per milestone ──────────────────────────────────────────

export const MILESTONES = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export interface PinCounts { due: number; passing: number; failing: number; review: number; notRun: number }
export interface MilestoneRow { milestone: number; pins: PinCounts; tests: number }

export interface Report {
  rows: MilestoneRow[];
  /** Pins of every milestone and none: by outcome, over the whole corpus. */
  pins: { total: number; passing: number; failing: number; noLine: number; review: number; unchanged: number; notCompared: number; notRun: number };
  tests: { total: number; due: number; notDue: number };
  programs: { run: number; stopped: number; findings: number };
  findings: string[];
}

const zero = (): PinCounts => ({ due: 0, passing: 0, failing: 0, review: 0, notRun: 0 });

/**
 * The report: for each milestone, the cases due at it (a case due at N
 * counts at N only) and the pins' outcomes; tests are not yet realised.
 * A pin of a program not in `compared` is not run. Findings come in the
 * corpus's order, each program's findings after its pins'.
 */
export function buildReport(corpus: Corpus, compared: ProgramComparison[], upTo = 9): Report {
  const byId = new Map<string, PinVerdict>();
  for (const p of compared) for (const v of p.verdicts) byId.set(v.id, v);
  const rows = new Map<number, MilestoneRow>(MILESTONES.filter((m) => m <= upTo).map((m) => [m, { milestone: m, pins: zero(), tests: 0 }]));
  const pins = { total: 0, passing: 0, failing: 0, noLine: 0, review: 0, unchanged: 0, notCompared: 0, notRun: 0 };
  const tests = { total: 0, due: 0, notDue: 0 };
  const due = (c: Case) => (c.class === "survives" || c.class === "changes") && c.milestone !== null;
  for (const c of corpus.cases) {
    if (c.kind === "test") {
      tests.total++;
      if (due(c)) { tests.due++; const r = rows.get(c.milestone!); if (r) r.tests++; } else tests.notDue++;
      continue;
    }
    pins.total++;
    const v = byId.get(c.id);
    const r = due(c) ? rows.get(c.milestone!) : undefined;
    if (r) r.pins.due++;
    if (v === undefined) { if (c.class !== "detail") { pins.notRun++; if (r) r.pins.notRun++; } else pins.notCompared++; continue; }
    if (v.outcome === "passes") { pins.passing++; if (r) r.pins.passing++; }
    else if (v.outcome === "fails") { pins.failing++; if (v.produced === null) pins.noLine++; if (r) r.pins.failing++; }
    else if (v.outcome === "to review") { pins.review++; if (v.unchanged) pins.unchanged++; if (r) r.pins.review++; }
    else pins.notCompared++;
  }
  const findings: string[] = [];
  const order = new Map(corpus.cases.map((c, i) => [c.id, i]));
  for (const p of [...compared].sort((a, b) => Math.min(...a.verdicts.map((v) => order.get(v.id) ?? 0)) - Math.min(...b.verdicts.map((v) => order.get(v.id) ?? 0)))) {
    for (const v of p.verdicts) if (v.finding !== null) findings.push(v.finding);
    findings.push(...p.findings);
  }
  return {
    rows: [...rows.values()], pins, tests,
    programs: { run: compared.length, stopped: compared.filter((p) => p.end.kind === "stopped").length, findings: compared.reduce((n, p) => n + p.findings.length, 0) },
    findings,
  };
}

/** One line per milestone, with the running total up to it. */
export function formatRows(report: Report): string[] {
  const acc = { due: 0, passing: 0, failing: 0, review: 0, notRun: 0, tests: 0 };
  return report.rows.map((r) => {
    acc.due += r.pins.due; acc.passing += r.pins.passing; acc.failing += r.pins.failing; acc.review += r.pins.review; acc.notRun += r.pins.notRun; acc.tests += r.tests;
    const p = r.pins;
    return `milestone ${r.milestone}: due ${p.due + r.tests} (pins ${p.due}, tests ${r.tests}) · pins passing ${p.passing}, failing ${p.failing}, to review ${p.review}, not run ${p.notRun} · tests not yet realised ${r.tests}` +
      ` · up to ${r.milestone}: pins ${acc.passing} of ${acc.due} passing, ${acc.failing} failing, ${acc.review} to review, ${acc.notRun} not run; tests 0 of ${acc.tests} realised`;
  });
}

/** The summary line, in the style of the corpus check's. */
export function formatSummary(report: Report, runnerName: string): string {
  const p = report.pins;
  const bad = p.failing + report.programs.findings;
  const verdict = bad === 0 ? "no failing pin" : `${p.failing} failing pin(s), ${report.programs.findings} program finding(s)`;
  return `harness: ${runnerName} · programs ${report.programs.run} run, ${report.programs.stopped} stopped · ` +
    `pins ${p.total} (passing ${p.passing}, failing ${p.failing} of which ${p.noLine} with no line, to review ${p.review} of which ${p.unchanged} unchanged, not compared ${p.notCompared}, not run ${p.notRun}) · ` +
    `tests ${report.tests.total} (due ${report.tests.due}, not yet realised ${report.tests.due}; detail ${report.tests.notDue}) — ${verdict}`;
}

/** Whether the command exits 1: a failing survives pin or a finding on a program. */
export function failed(report: Report): boolean {
  return report.pins.failing > 0 || report.programs.findings > 0;
}

// ── Running programs ──────────────────────────────────────────────────

/** The pin cases of the corpus, by program, in the corpus's order. */
export function pinsByProgram(corpus: Corpus): Map<string, PinCase[]> {
  const out = new Map<string, PinCase[]>();
  for (const c of corpus.cases) if (c.kind === "pin") out.set(c.file, [...(out.get(c.file) ?? []), c]);
  return out;
}

/** Run each program through the runner, at most `bound` at a time; results in the order given. */
export async function runAll(runner: Runner, programs: Program[], bound: number): Promise<RunResult[]> {
  const results: RunResult[] = new Array(programs.length);
  let next = 0;
  const worker = async () => {
    while (next < programs.length) {
      const i = next++;
      try { results[i] = await runner(programs[i]); }
      catch (e) { results[i] = { lines: [], end: { kind: "stopped", reason: `the runner threw: ${(e as Error).message}` } }; }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(bound, programs.length)) }, worker));
  return results;
}

/** Run and compare the given programs of the corpus. */
export async function comparePrograms(root: string, corpus: Corpus, runner: Runner, files: string[], bound: number): Promise<ProgramComparison[]> {
  const pins = pinsByProgram(corpus);
  const programs = files.map((f) => ({ path: f, text: fs.readFileSync(path.join(root, f), "utf-8") }));
  const results = await runAll(runner, programs, bound);
  return files.map((f, i) => compareProgram(f, pins.get(f) ?? [], results[i]));
}

// ── The present-tree runner ───────────────────────────────────────────

export const PRESENT_ENTRY = "src/index.ts";

/** The reason a stopped child gives: its standard error, or its exit. */
function stopReason(code: number | null, signal: NodeJS.Signals | null, stderr: string, timedOut: number | null): string {
  if (timedOut !== null) return `no exit after ${timedOut / 1000} s; killed`;
  const text = stderr.trim().split(/\r?\n/).filter((l) => l.trim() !== "").join(" | ");
  const exit = signal !== null ? `signal ${signal}` : `exit ${code}`;
  return text === "" ? exit : `${text} (${exit})`;
}

/**
 * The present tree's runner: `node --import tsx src/index.ts <path>` in a
 * child process at the repository root, as a user runs a program. The
 * lines are its standard output split at newlines; exit 0 is completed,
 * anything else stopped with its standard error as the reason. The file
 * runner reads the file on disk, so a text that differs from the file is
 * refused as a stopped run, and nothing is started.
 */
export function presentTreeRunner(root: string, options: { timeoutMs?: number } = {}): Runner {
  const timeoutMs = options.timeoutMs ?? 180000;
  return (program) => new Promise<RunResult>((resolve) => {
    const file = path.join(root, program.path);
    let onDisk: string | null = null;
    try { onDisk = fs.readFileSync(file, "utf-8"); } catch { /* reported below */ }
    if (onDisk === null) { resolve({ lines: [], end: { kind: "stopped", reason: `${program.path} is no file under the repository root` } }); return; }
    if (onDisk !== program.text) { resolve({ lines: [], end: { kind: "stopped", reason: `the present-tree runner runs the file on disk, and the text given differs from ${program.path}` } }); return; }
    const env = { ...process.env };
    for (const k of ["ALLEGRO_STACK", "ALLEGRO_TRACE_DEPTH", "ALLEGRO_PARSE_STATS", "ALLEGRO_EVAL_STATS"]) delete env[k];
    const child = spawn(process.execPath, ["--import", "tsx", PRESENT_ENTRY, program.path], { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.setEncoding("utf-8").on("data", (d: string) => { stdout += d; });
    child.stderr.setEncoding("utf-8").on("data", (d: string) => { stderr += d; });
    let timedOut: number | null = null;
    const timer = setTimeout(() => { timedOut = timeoutMs; child.kill("SIGKILL"); }, timeoutMs);
    child.on("error", (e) => { clearTimeout(timer); resolve({ lines: [], end: { kind: "stopped", reason: `the child did not start: ${e.message}` } }); });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      const lines = stdout === "" ? [] : stdout.replace(/\r?\n$/, "").split(/\r?\n/);
      const end: RunEnd = code === 0 && timedOut === null ? { kind: "completed" } : { kind: "stopped", reason: stopReason(code, signal, stderr, timedOut) };
      resolve({ lines, end });
    });
  });
}

/**
 * Programs the suite runs in a way the file runner cannot reproduce, each
 * with the reason. The calibration does not run them: it names each and
 * counts its pins as not run. The harness's tests hold that every program
 * named here does stop under the present-tree runner, so an entry cannot
 * outlive its reason.
 */
export const PRESENT_RUN_DIFFERS: Record<string, string> = {
  "tests/proofs-proven-demo.alg":
    "the suite passes it lib/proven.alg as an extension (src/test/proofs.ts); the program has no `use proven` and the file runner has no flag for an extension, so its run stops on a parse error",
};

// ── main ──────────────────────────────────────────────────────────────

function usage(msg: string): never {
  console.error(msg);
  console.error("usage: npx tsx next/corpus/harness.ts --present [--milestone N] [--file <program>]");
  process.exit(2);
}

async function main(): Promise<void> {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
  const argv = process.argv.slice(2);
  if (!argv.includes("--present")) usage("the harness needs a runner: --present is the one this part has");
  const value = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    if (i < 0) return undefined;
    if (i + 1 >= argv.length) usage(`${flag} takes a value`);
    return argv[i + 1];
  };
  const msArg = value("--milestone");
  const upTo = msArg === undefined ? 9 : Number(msArg);
  if (!Number.isInteger(upTo) || upTo < 1 || upTo > 9) usage(`--milestone takes 1 to 9, not ${msArg}`);
  const corpus = JSON.parse(fs.readFileSync(path.join(root, CASES_PATH), "utf-8")) as Corpus;
  const byProgram = pinsByProgram(corpus);
  let files = [...byProgram.keys()];
  const only = value("--file");
  if (only !== undefined) {
    if (!byProgram.has(only)) usage(`${only} is no pinned program of ${CASES_PATH}`);
    files = [only];
  }
  if (msArg !== undefined) files = files.filter((f) => byProgram.get(f)!.some((c) => c.milestone !== null && c.milestone <= upTo));
  const skipped = only !== undefined ? [] : files.filter((f) => f in PRESENT_RUN_DIFFERS);
  files = files.filter((f) => !skipped.includes(f));

  const bound = Math.max(1, Math.min(8, os.availableParallelism()));
  const started = Date.now();
  const compared = await comparePrograms(root, corpus, presentTreeRunner(root), files, bound);
  const report = buildReport(corpus, compared, upTo);
  for (const f of report.findings) console.log(f);
  for (const f of skipped) console.log(`not run: ${f}: ${PRESENT_RUN_DIFFERS[f]}`);
  for (const r of formatRows(report)) console.log(r);
  console.log(`${formatSummary(report, "present tree")} · ${((Date.now() - started) / 1000).toFixed(1)} s, ${bound} at a time`);
  if (failed(report)) process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) void main();
