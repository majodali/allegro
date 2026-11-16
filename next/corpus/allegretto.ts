// The Allegretto programs of the acceptance corpus (B-196 (the rebuild's
// acceptance side), chunk Q6 (the comparison harness), part 2): how a
// program under next/corpus/allegretto/ states what it must do, and how it
// is run and compared. The convention is next/corpus/allegretto/README.md.
// One implementation, used by the programs' test
// (next/corpus/allegretto.test.ts) and by the harness's mode `--next`
// (next/corpus/harness.ts).
//
// A program's comments state:
//   // realises: <case id>   a case of next/corpus/cases.json it shows, one per line;
//   // expect: <line>        each line it prints, in order;
//   // end: <how>            how the run ends: `completed`, or `refuted: <the
//                             reason the kernel gives>`;
//   // yields: a, b          the keys of the structure the module yields, in
//                             order, read through the kernel's interface.
// A program is emitted with next/bootstrap/emit.ts and its record run by
// the launcher of next/launch/launcher.ts on the reference kernel, with the
// output capability and the shipped primitives. It passes when its lines,
// its end and, where stated, its yielded keys are the expected ones.

import * as fs from "fs";
import * as path from "path";
import { createKernel } from "../kernel/create.js";
import { encode, load, type SavedProgram } from "../kernel/saved-program.js";
import { emit, describeFinding } from "../bootstrap/emit.js";
import { launch, type LaunchEnd } from "../launch/launcher.js";
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
}

export function readPins(text: string): Pins {
  const lines: string[] = [];
  const realises: string[] = [];
  let end: string | undefined;
  let yields: string[] | undefined;
  for (const line of text.split("\n")) {
    const m = /^\s*\/\/\s*(expect|end|yields|realises):\s?(.*)$/.exec(line);
    if (m === null) continue;
    if (m[1] === "expect") lines.push(m[2].trimEnd());
    else if (m[1] === "end") end = m[2].trim();
    else if (m[1] === "realises") realises.push(m[2].trim());
    else yields = m[2].split(",").map((s) => s.trim()).filter((s) => s !== "");
  }
  return { lines, end, yields, realises };
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
 * hand to an output capability, since nothing imports a module yet.
 */
export function yieldedKeys(program: SavedProgram): { keys: (string | null)[] } | { problem: string } {
  const k = createKernel();
  const byHash = new Map([...shippedByName.values()].map((p) => [p.hash, p] as const));
  const primitives = new Map(program.needs.map((n) => [n.hash, k.primitiveFunction(byHash.get(n.hash)!)] as const));
  const fn = load(k, program, primitives);
  // One argument for each header line: the output capability, and nothing else yet.
  const other = program.declares.find((d) => d.role !== "capability" || d.name !== "output");
  if (other !== undefined) return { problem: `the module declares the ${other.role} ${other.name}, which this reading of a yield cannot supply` };
  const args = program.declares.map(() => k.structure([[k.symbol("write"), k.primitiveFunction(outputWrite(() => {}))]]));
  const r = k.evaluate(k.expression(fn, args), k.scope(), { steps: STEPS });
  if (r.refuted) return { problem: "the module was refuted when instantiated by hand" };
  if (k.kind(r.value) !== "structure") return { problem: `the module yields a value of kind ${k.kind(r.value)}, not a structure` };
  return { keys: k.entriesOf(r.value).map(([key]) => (key === null ? null : k.symbolName(key))) };
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
  const outcome = await launch({
    createKernel,
    program: e.program,
    configuration: { ceiling: ["output"], steps: STEPS },
    target: { capabilities: [output], primitives: shipped },
  });
  const end = endText(outcome.end);
  if (JSON.stringify(outcome.lines) !== JSON.stringify(pins.lines))
    problems.push(`printed ${JSON.stringify(outcome.lines)}, expected ${JSON.stringify(pins.lines)}`);
  if (pins.end !== undefined && end !== pins.end) problems.push(`ended ${JSON.stringify(end)}, expected ${JSON.stringify(pins.end)}`);
  let yields: (string | null)[] | undefined;
  if (pins.yields !== undefined) {
    const y = yieldedKeys(e.program);
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
