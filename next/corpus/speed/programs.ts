// The two speed programs of milestone 3 (B-196 (the rebuild's acceptance
// side), chunk Q8 (the speed tests of milestone 3)), as the bench and the
// test run them: the texts at a chosen size, the lines they must print, and
// a run on the new kernel. Used by next/corpus/speed/bench.ts and
// next/corpus/speed/speed.test.ts.

import * as fs from "fs";
import * as path from "path";
import type { CreateKernel } from "../../kernel/interface.js";
import { encode, type SavedProgram } from "../../kernel/saved-program.js";
import { describeFinding, emit } from "../../bootstrap/emit.js";
import { createKernel as variantInUse } from "../../launch/kernel-variant.js";
import { launch, type LaunchEnd } from "../../launch/launcher.js";
import { output } from "../../launch/output.js";
import { shipped } from "../../prims/index.js";

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
/** Where the programs are, relative to the repository root. */
export const SPEED_DIR = "next/corpus/speed";

// ---- The programs and their inputs ----------------------------------------

/** One unit of the parser's flat input; it evaluates to 79. */
export const UNIT = "12 * (3 + 4) - 10 / 2";
export const flatInput = (n: number): string => Array(n).fill(UNIT).join(" + ");
export const nestedInput = (n: number): string => `${"(".repeat(n)}7${")".repeat(n)}`;
const MARKER = /^\/\/ ---- Checks at the suite's size only.*$/m;

export const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), "utf8");

/** A parser program with its `input` line replaced and the suite's own checks left out. */
export function withInput(text: string, input: string): string {
  if (!/^input = .*$/m.test(text)) throw new Error("the program has no line `input = ...`");
  const m = MARKER.exec(text);
  const kept = m === null ? text : text.slice(0, m.index);
  return kept.replace(/^input = .*$/m, () => `input = "${input}"`);
}

/** A typed program with its size lines replaced. */
export function withSizes(text: string, sizes: { squares: number; letters: number; halving: number }): string {
  let t = text;
  for (const [k, v] of Object.entries(sizes)) {
    const re = new RegExp(`^${k} = .*$`, "m");
    if (!re.test(t)) throw new Error(`the program has no line \`${k} = ...\``);
    t = t.replace(re, `${k} = ${v}`);
  }
  return t;
}

export const squaresTo = (n: number): bigint => (BigInt(n) * BigInt(n + 1) * BigInt(2 * n + 1)) / 6n;
export const lettersTo = (n: number): string => Array.from({ length: n }, (_, k) => "abc"[(k + 1) % 3]).join("");

/** The lines the typed programs print, at these sizes. */
export function typedLines(sizes: { squares: number; letters: number; halving: number }): string[] {
  return [String(squaresTo(sizes.squares)), lettersTo(sizes.letters), String(squaresTo(sizes.halving)), "dispatch by type"];
}

// ---- Running on the new kernel ---------------------------------------------

export interface NewRun {
  readonly ms: number;
  readonly lines: string[];
  readonly end: LaunchEnd;
  readonly steps: number | null;
}

/** Emits a text: the record, and how long the bootstrap took. */
export function emitTimed(text: string): { program: SavedProgram; ms: number } {
  const t0 = performance.now();
  const r = emit(text);
  if (!r.ok) throw new Error(`the emitter refuses the text: ${r.findings.map((f) => describeFinding(f, "<text>")).join("; ")}`);
  const program = JSON.parse(encode(r.program)) as SavedProgram;
  return { program, ms: performance.now() - t0 };
}

/** Launches a record on a kernel `createKernel` makes, by default of the variant in use (next/launch/kernel-variant.ts), with no step budget. */
export async function runNew(program: SavedProgram, createKernel: CreateKernel = variantInUse): Promise<NewRun> {
  const t0 = performance.now();
  const o = await launch({
    createKernel,
    program,
    configuration: { ceiling: ["output"] },
    target: { capabilities: [output], primitives: shipped },
  });
  const ms = performance.now() - t0;
  return { ms, lines: o.lines, end: o.end, steps: "steps" in o.end ? o.end.steps : null };
}

export const endWord = (end: LaunchEnd): string =>
  end.kind === "limit" && end.reason.startsWith("the kernel reached its own limit") ? "kernel limit" : end.kind === "refuted" ? `refuted: ${end.reason}` : end.kind;
