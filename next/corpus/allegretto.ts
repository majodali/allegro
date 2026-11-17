// The Allegretto programs of the acceptance corpus (B-196 (the rebuild's
// acceptance side), chunk Q6 (the comparison harness), part 2; chunk Q7
// (the minimal launcher and the output capability), part 3, for the
// inputs): how a
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
//                             reason the kernel gives>`, or `waiting: <the
//                             launcher's reason>`;
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
//                             (`linesBeforePhase`) shows.
// A program is emitted with next/bootstrap/emit.ts and its record run by
// the launcher of next/launch/launcher.ts on the reference kernel, with the
// output capability, the shipped primitives and its inputs. It passes when
// its lines, its end, the lines printed before each later phase and, where
// stated, its yielded keys are the expected ones.

import * as fs from "fs";
import * as path from "path";
import { createKernel } from "../kernel/create.js";
import type { Cell } from "../kernel/interface.js";
import { encode, load, type SavedProgram } from "../kernel/saved-program.js";
import { emit, describeFinding } from "../bootstrap/emit.js";
import { readLiteral } from "../bootstrap/literal.js";
import { launch, plainValue, type Inputs, type LaunchEnd, type Plain } from "../launch/launcher.js";
import { output, outputWrite } from "../launch/output.js";
import { shipped, shippedByName } from "../prims/index.js";

/** Where the programs are, relative to the repository root. */
export const PROGRAMS_DIR = "next/corpus/allegretto";

/** The step budget every program runs under. */
export const STEPS = 1_000_000;

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

/** A run's end as a program's `// end:` line writes it. */
export function endText(end: LaunchEnd): string {
  if (end.kind === "refuted") return `refuted: ${end.reason}`;
  if (end.kind === "completed") return "completed";
  return `${end.kind}: ${"reason" in end ? end.reason : ""}`;
}

/** The emitted record of a text, as JSON round-trips it, or the emitter's findings. */
export function emitted(text: string, file = "<text>"): { program: SavedProgram } | { findings: string[] } {
  const r = emit(text);
  if (!r.ok) return { findings: r.findings.map((f) => describeFinding(f, file)) };
  return { program: JSON.parse(encode(r.program)) as SavedProgram };
}

/**
 * The keys of the structure a module yields, read through the kernel's
 * interface: the record is loaded into a kernel and the module applied by
 * hand to an output capability and its inputs, since nothing imports a
 * module yet. An input supplied at the start is its plain data; any other
 * is a cell, filled by the later phase that supplies it, in order.
 */
export function yieldedKeys(program: SavedProgram, given: { inputs: Inputs; later: Inputs[] } = { inputs: {}, later: [] }): { keys: (string | null)[] } | { problem: string } {
  const k = createKernel();
  const byHash = new Map([...shippedByName.values()].map((p) => [p.hash, p] as const));
  const primitives = new Map(program.needs.map((n) => [n.hash, k.primitiveFunction(byHash.get(n.hash)!)] as const));
  const fn = load(k, program, primitives);
  // One argument for each header line: the output capability, and the inputs.
  const other = program.declares.find((d) => d.role !== "input" && (d.role !== "capability" || d.name !== "output"));
  if (other !== undefined) return { problem: `the module declares the ${other.role} ${other.name}, which this reading of a yield cannot supply` };
  const cells = new Map<string, Cell>();
  const args = program.declares.map((d) => {
    if (d.role === "capability") return k.structure([[k.symbol("write"), k.primitiveFunction(outputWrite(() => {}))]]);
    if (Object.hasOwn(given.inputs, d.name)) return plainValue(k, given.inputs[d.name]);
    const cell = k.cell();
    cells.set(d.name, cell);
    return cell;
  });
  const r = k.evaluate(k.expression(fn, args), k.scope(), { steps: STEPS });
  if (r.refuted) return { problem: "the module was refuted when instantiated by hand" };
  for (const phase of given.later) {
    for (const [name, plain] of Object.entries(phase)) {
      const cell = cells.get(name);
      if (cell !== undefined && !k.filled(cell)) k.fill(cell, plainValue(k, plain));
    }
    if (k.advance({ steps: STEPS }).refuted.length > 0) return { problem: "the module was refuted when instantiated by hand" };
  }
  const value = k.current(r.value);
  if (k.kind(value) !== "structure") return { problem: `the module yields a value of kind ${k.kind(value)}, not a structure` };
  return { keys: k.entriesOf(value).map(([key]) => (key === null ? null : k.symbolName(key))) };
}

/** What a run of one program gave, and what differs from its pins. */
export interface ProgramRun {
  readonly pins: Pins;
  /** The emitter's findings; empty when the text emitted. */
  readonly findings: string[];
  readonly lines: string[];
  /** The end as `// end:` writes it; null when nothing was launched. */
  readonly end: string | null;
  /** The yielded keys, when the program states `// yields:`. */
  readonly yields: (string | null)[] | undefined;
  /** Each way the run differs from the pins; empty when the program passes. */
  readonly problems: string[];
}

/** Emits a text, launches it, and compares lines, end and yields with its pins. */
export async function runProgram(text: string, file = "<text>"): Promise<ProgramRun> {
  const pins = readPins(text);
  const problems: string[] = [];
  if (pins.end === undefined) problems.push("the program states no `// end:` line");
  const e = emitted(text, file);
  if ("findings" in e) {
    problems.push(`the emitter refuses the text: ${e.findings.join("; ")}`);
    return { pins, findings: e.findings, lines: [], end: null, yields: undefined, problems };
  }
  const given = inputsOf(pins);
  if ("problems" in given) {
    problems.push(...given.problems);
    return { pins, findings: [], lines: [], end: null, yields: undefined, problems };
  }
  const outcome = await launch({
    createKernel,
    program: e.program,
    configuration: { ceiling: ["output"], steps: STEPS, inputs: given.inputs, later: given.later },
    target: { capabilities: [output], primitives: shipped },
  });
  const end = endText(outcome.end);
  if (JSON.stringify(outcome.lines) !== JSON.stringify(pins.lines))
    problems.push(`printed ${JSON.stringify(outcome.lines)}, expected ${JSON.stringify(pins.lines)}`);
  // Each `// later:` line: applied, and with the `// expect:` lines above it printed before it.
  pins.later.forEach((l, i) => {
    const before = outcome.linesBeforePhase[i];
    if (before === undefined) problems.push(`the later phase that supplies ${l.name} (phase ${i + 1}) was not applied`);
    else if (before !== l.expectsAbove)
      problems.push(`${before} line(s) were printed before the later phase that supplies ${l.name} (phase ${i + 1}), and ${l.expectsAbove} \`// expect:\` line(s) are above it`);
  });
  if (pins.end !== undefined && end !== pins.end) problems.push(`ended ${JSON.stringify(end)}, expected ${JSON.stringify(pins.end)}`);
  let yields: (string | null)[] | undefined;
  if (pins.yields !== undefined) {
    const y = yieldedKeys(e.program, given);
    if ("problem" in y) problems.push(y.problem);
    else {
      yields = y.keys;
      if (JSON.stringify(y.keys) !== JSON.stringify(pins.yields)) problems.push(`yields ${JSON.stringify(y.keys)}, expected ${JSON.stringify(pins.yields)}`);
    }
  }
  return { pins, findings: [], lines: outcome.lines, end, yields, problems };
}

/** Every program under next/corpus/allegretto/, relative to the repository root, in name order. */
export function programFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (rel: string): void => {
    for (const d of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
      const r = `${rel}/${d.name}`;
      if (d.isDirectory()) walk(r);
      else if (d.name.endsWith(".alg")) out.push(r);
    }
  };
  if (fs.existsSync(path.join(root, PROGRAMS_DIR))) walk(PROGRAMS_DIR);
  return out.sort();
}

/** A program's milestone: its directory's, `m<milestone>` directly under next/corpus/allegretto/; null elsewhere. */
export function milestoneOf(file: string): number | null {
  const m = new RegExp(`^${PROGRAMS_DIR}/m([1-9])/[^/]+\\.alg$`).exec(file);
  return m === null ? null : Number(m[1]);
}
