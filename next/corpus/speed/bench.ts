// The speed tests of milestone 3 (B-196 (the rebuild's acceptance side),
// chunk Q8 (the speed tests of milestone 3), docs/plans/rebuild-acceptance.md
// §5): a toy parser engine and a typed extension written in Allegretto,
// measured on the new kernel and against the present tree on the same
// programs.
//
//   npm run bench:next
//   npx tsx next/corpus/speed/bench.ts
//
// It gates nothing and runs in no suite: `npm run test:next` runs the
// programs at their pinned size only (next/corpus/speed/speed.test.ts).
//
// What runs, for each test and each input size:
//   new kernel      the Allegretto program, emitted once by
//                   next/bootstrap/emit.ts and launched in process by
//                   next/launch/launcher.ts on the reference kernel, with the
//                   output capability, the shipped primitives and no step
//                   budget. The time is the launch: kernel creation, loading
//                   the record, evaluation. The emit time is the bootstrap's,
//                   reported in its own column.
//   present (same)  the twin under next/corpus/speed/present/, in the
//                   present tree's base language, run in process by
//                   `evalSource` of src/runtime.ts: the present parser reads
//                   the text, then it is evaluated. Start-up is left out.
//   present (native) what a user of the present tree gets today: for the
//                   parser, `parse` of src/grammar2/engine.ts on the same
//                   grammar (present/parser-native.ts); for the typed test,
//                   present/typed-native.alg in the standard language, run by
//                   `evalSource` with the type system created once.
// Each time is the median of five runs after one warm-up run. A size whose
// warm-up run passes LONG_MS is run once, and its row says so. An
// implementation stops at the first size that does not complete, that
// prints a wrong answer, or that passes LONG_MS; larger sizes are not run
// on it. The present tree is imported, read and run, never changed.

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { spawnSync } from "child_process";
import {
  emitTimed, endWord, flatInput, lettersTo, nestedInput, read, ROOT, runNew, SPEED_DIR, squaresTo, typedLines, UNIT, withInput, withSizes,
} from "./programs.js";

/** A run longer than this ends an implementation's series, and is run once. */
export const LONG_MS = 10_000;
/** Timed runs after the warm-up. */
export const RUNS = 5;

// ---- Running on the present tree -------------------------------------------

/** The present tree, imported by path at run time, so the new tree's typecheck does not reach into it. */
interface Present {
  evalSource(source: string, base?: unknown, extensions?: unknown[], grammar?: unknown, typed?: boolean): unknown;
  typeSystem: unknown;
  nativeParse(text: string): string;
}
async function present(): Promise<Present> {
  const at = (rel: string): string => path.join(ROOT, rel);
  const runtime = await import(at("src/runtime.ts"));
  const types = await import(at("src/types-std.ts"));
  const native = await import(at(`${SPEED_DIR}/present/parser-native.ts`));
  const grammar = native.arithmetic();
  return { evalSource: runtime.evalSource, typeSystem: types.createTypeSystem(), nativeParse: (t: string) => native.run(t, grammar) };
}

export interface PresentRun {
  readonly ms: number;
  readonly lines: string[];
  /** "completed", or the error it threw. */
  readonly end: string;
}

/** Runs host code that prints through console.log, collecting the lines. */
function capture(body: () => void): PresentRun {
  const lines: string[] = [];
  const log = console.log;
  console.log = (...a: unknown[]) => { lines.push(a.map(String).join(" ")); };
  const t0 = performance.now();
  let end = "completed";
  try {
    body();
  } catch (e) {
    end = e instanceof RangeError ? `stack: ${e.message}` : `error: ${e instanceof Error ? e.message.split("\n")[0] : String(e)}`;
  } finally {
    console.log = log;
  }
  return { ms: performance.now() - t0, lines, end };
}

// ---- Measuring ----------------------------------------------------------------

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 === 1 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

interface Cell {
  /** Median ms, or the single run's. */
  readonly ms: number;
  readonly runs: number;
  /** "completed", or how it stopped. */
  readonly end: string;
  /** False where it completed with a wrong answer. */
  readonly right: boolean;
  readonly steps?: number | null;
  readonly note?: string;
}

/** Times a run: a warm-up, then RUNS more and the median, unless the warm-up fails or passes LONG_MS. */
async function timed<R extends { ms: number }>(run: () => Promise<R> | R, judge: (r: R) => { end: string; right: boolean; steps?: number | null; note?: string }): Promise<Cell> {
  const warm = await run();
  const j = judge(warm);
  if (j.end !== "completed" || !j.right || warm.ms > LONG_MS) return { ms: warm.ms, runs: 1, ...j };
  const times: number[] = [];
  for (let i = 0; i < RUNS; i++) times.push((await run()).ms);
  return { ms: median(times), runs: RUNS, ...j };
}

const stops = (c: Cell | undefined): boolean => c === undefined || c.end !== "completed" || !c.right || c.ms > LONG_MS;

interface Row {
  readonly size: number;
  readonly emitMs?: number;
  readonly next?: Cell;
  readonly same?: Cell;
  readonly native?: Cell;
}

// ---- Formatting -----------------------------------------------------------------

const pad = (s: string, n: number): string => (s.length >= n ? s : s + " ".repeat(n - s.length));
const lpad = (s: string, n: number): string => (s.length >= n ? s : " ".repeat(n - s.length) + s);
const ms = (x: number): string => (x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2));
const cellText = (c: Cell | undefined): string => {
  if (c === undefined) return "not run";
  if (c.end !== "completed") return `${c.end.split(":")[0]} (${ms(c.ms)})`;
  if (!c.right) return `wrong (${ms(c.ms)})`;
  return `${ms(c.ms)}${c.runs === 1 ? " (1 run)" : ""}`;
};
const ratio = (a: Cell | undefined, b: Cell | undefined): string =>
  a !== undefined && b !== undefined && a.end === "completed" && b.end === "completed" && a.right && b.right ? `${(a.ms / b.ms).toFixed(1)}x` : "-";

function table(title: string, sizeName: string, rows: Row[]): string[] {
  const out = [title, ""];
  const head = [pad(sizeName, 8), lpad("steps", 10), lpad("new ms", 16), lpad("us/step", 8), lpad("emit ms", 8), lpad("present ms", 16), lpad("native ms", 16), lpad("new/present", 12), lpad("new/native", 11)];
  out.push(head.join(" "));
  out.push("-".repeat(head.join(" ").length));
  for (const r of rows) {
    const steps = r.next?.steps;
    const perStep = r.next !== undefined && steps != null && steps > 0 && r.next.end === "completed" ? ((r.next.ms * 1000) / steps).toFixed(1) : "-";
    out.push([
      pad(String(r.size), 8),
      lpad(steps == null ? "-" : String(steps), 10),
      lpad(cellText(r.next), 16),
      lpad(perStep, 8),
      lpad(r.emitMs === undefined ? "-" : ms(r.emitMs), 8),
      lpad(cellText(r.same), 16),
      lpad(cellText(r.native), 16),
      lpad(ratio(r.next, r.same), 12),
      lpad(ratio(r.next, r.native), 11),
    ].join(" "));
  }
  return out;
}

/** The largest size each completes, and what stopped it. */
function reach(rows: Row[], which: keyof Pick<Row, "next" | "same" | "native">, name: string): string {
  let largest: number | null = null;
  let stop = "it completed every size run";
  for (const r of rows) {
    const c = r[which];
    if (c === undefined) continue;
    if (c.end === "completed" && c.right) largest = r.size;
    if (c.end !== "completed") { stop = `at ${r.size}: ${c.end}`; break; }
    if (!c.right) { stop = `at ${r.size}: a wrong answer${c.note ? ` (${c.note})` : ""}`; break; }
    if (c.ms > LONG_MS) { stop = `at ${r.size}: ${ms(c.ms)} ms, past ${LONG_MS} ms`; break; }
  }
  return `  ${pad(name, 17)} largest completed ${largest ?? "none"}; stopped ${stop}`;
}

/** How time grows with size: the exponent k of time ~ size^k between successive sizes, and over the points above 50 ms. */
function growth(rows: Row[], which: keyof Pick<Row, "next" | "same" | "native">, name: string, what: "ms" | "steps" = "ms"): string {
  const pts = rows
    .map((r) => ({ size: r.size, c: r[which] }))
    .filter((p): p is { size: number; c: Cell } => p.c !== undefined && p.c.end === "completed" && p.c.right)
    .map((p) => ({ size: p.size, y: what === "ms" ? p.c.ms : p.c.steps ?? NaN }))
    .filter((p) => Number.isFinite(p.y) && p.y > 0);
  const local: string[] = [];
  for (let i = 1; i < pts.length; i++) local.push((Math.log(pts[i].y / pts[i - 1].y) / Math.log(pts[i].size / pts[i - 1].size)).toFixed(2));
  const big = pts.filter((p) => what === "steps" || p.y >= 50);
  let fit = "-";
  if (big.length >= 2) {
    const xs = big.map((p) => Math.log(p.size)), ys = big.map((p) => Math.log(p.y));
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
    const k = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / xs.reduce((a, x) => a + (x - mx) ** 2, 0);
    fit = k.toFixed(2);
  }
  return `  ${pad(`${name} ${what}`, 22)} exponent between successive sizes: ${local.join(" ") || "-"}; fitted${what === "ms" ? " over runs of 50 ms or more" : ""}: ${fit}`;
}

// ---- The tests ----------------------------------------------------------------------

/** Runs a series of sizes on the three implementations until the new kernel and the twin have both stopped. */
async function series(
  sizes: number[],
  next: (size: number) => Promise<{ emitMs: number; cell: Cell }>,
  same: (size: number) => Promise<Cell>,
  native: (size: number) => Promise<Cell>,
  log: (line: string) => void,
): Promise<Row[]> {
  const rows: Row[] = [];
  let nextOn = true, sameOn = true, nativeOn = true;
  for (const size of sizes) {
    if (!nextOn && !sameOn) break;
    const n = nextOn ? await next(size) : undefined;
    const s = sameOn ? await same(size) : undefined;
    const v = nativeOn ? await native(size) : undefined;
    rows.push({ size, emitMs: n?.emitMs, next: n?.cell, same: s, native: v });
    log(`  size ${size}: new ${cellText(n?.cell)}, present ${cellText(s)}, native ${cellText(v)}`);
    if (n !== undefined && stops(n.cell)) nextOn = false;
    if (s !== undefined && stops(s)) sameOn = false;
    if (v !== undefined && stops(v)) nativeOn = false;
  }
  return rows;
}

const doubling = (from: number, factor: number, to: number): number[] => {
  const out: number[] = [];
  for (let s = from; s <= to; s *= factor) out.push(s);
  return out;
};

async function parserTest(p: Present, log: (line: string) => void): Promise<Row[]> {
  const nextText = read(`${SPEED_DIR}/parser.alg`), sameText = read(`${SPEED_DIR}/present/parser.alg`);
  return series(
    doubling(1, 2, 1024),
    async (n) => {
      const { program, ms: emitMs } = emitTimed(withInput(nextText, flatInput(n)));
      const want = `value ${79 * n}, nodes `;
      const cell = await timed(() => runNew(program), (r) => ({
        end: r.end.kind === "completed" ? "completed" : endWord(r.end),
        right: r.lines.length === 1 && r.lines[0].startsWith(want),
        steps: r.steps,
        note: r.lines.join(" | ").slice(0, 80),
      }));
      return { emitMs, cell };
    },
    async (n) => {
      const text = withInput(sameText, flatInput(n));
      return timed(() => capture(() => p.evalSource(text)), (r) => ({ end: r.end, right: r.lines[0] === "value" && r.lines[1] === String(79 * n), note: r.lines.join(" | ").slice(0, 80) }));
    },
    async (n) => {
      const input = flatInput(n);
      return timed(() => capture(() => console.log(p.nativeParse(input))), (r) => ({ end: r.end, right: (r.lines[0] ?? "").startsWith(`value ${79 * n},`) }));
    },
    log,
  );
}

async function typedTest(p: Present, shape: "loop" | "halving", log: (line: string) => void): Promise<Row[]> {
  const nextText = read(`${SPEED_DIR}/typed.alg`), sameText = read(`${SPEED_DIR}/present/typed.alg`), nativeText = read(`${SPEED_DIR}/present/typed-native.alg`);
  const sizesOf = (n: number) => (shape === "loop" ? { squares: n, letters: n, halving: 1 } : { squares: 1, letters: 1, halving: n });
  return series(
    shape === "loop" ? doubling(1, 2, 1024) : doubling(1, 4, 4 ** 9),
    async (n) => {
      const { program, ms: emitMs } = emitTimed(withSizes(nextText, sizesOf(n)));
      const want = typedLines(sizesOf(n));
      const cell = await timed(() => runNew(program), (r) => ({
        end: r.end.kind === "completed" ? "completed" : endWord(r.end),
        right: JSON.stringify(r.lines) === JSON.stringify(want),
        steps: r.steps,
      }));
      return { emitMs, cell };
    },
    async (n) => {
      const text = withSizes(sameText, sizesOf(n));
      const want = typedLines(sizesOf(n));
      return timed(() => capture(() => p.evalSource(text)), (r) => ({ end: r.end, right: JSON.stringify(r.lines) === JSON.stringify(want) }));
    },
    async (n) => {
      const text = withSizes(nativeText, sizesOf(n));
      const want = typedLines(sizesOf(n));
      return timed(() => capture(() => p.evalSource(text, undefined, [p.typeSystem], undefined, true)), (r) => ({ end: r.end, right: JSON.stringify(r.lines) === JSON.stringify(want) }));
    },
    log,
  );
}

// ---- The recursion ceiling ----------------------------------------------------------

/** The largest n in [1, cap] for which `completes(n)` holds, assuming it holds up to some n and fails beyond; null if it fails at 1. */
async function largest(completes: (n: number) => Promise<boolean>, cap = 1 << 16): Promise<{ n: number | null; capped: boolean }> {
  if (!(await completes(1))) return { n: null, capped: false };
  let lo = 1, hi = 2;
  while (hi <= cap && (await completes(hi))) { lo = hi; hi *= 2; }
  if (hi > cap) return { n: lo, capped: true };
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (await completes(mid)) lo = mid;
    else hi = mid;
  }
  return { n: lo, capped: false };
}

/** The plain recursion of the known limit, `sum(n)`, in each language. */
const plainNext = (n: number): string => `capability output\nsum(n) => if n == 0 then 0 else n + sum(n - 1)\noutput.write(int.text(sum(${n})))\n`;
const plainSame = (n: number): string => `sum(n) => if n == 0 then 0 else n + sum(n - 1)\nprint(0 + sum(${n}))\n`;

async function ceilings(p: Present, log: (line: string) => void): Promise<string[]> {
  const nextText = read(`${SPEED_DIR}/parser.alg`), sameText = read(`${SPEED_DIR}/present/parser.alg`);
  const typedNext = read(`${SPEED_DIR}/typed.alg`), typedSame = read(`${SPEED_DIR}/present/typed.alg`);
  const onNext = async (text: string, want: (lines: string[]) => boolean): Promise<{ ok: boolean; end: string }> => {
    const r = await runNew(emitTimed(text).program);
    return { ok: r.end.kind === "completed" && want(r.lines), end: endWord(r.end) };
  };
  const onSame = (text: string, want: (lines: string[]) => boolean): { ok: boolean; end: string } => {
    const r = capture(() => p.evalSource(text));
    return { ok: r.end === "completed" && want(r.lines), end: r.end.split(":")[0] };
  };
  type Probe = { ok: boolean; end: string };
  // A fresh process for each run: the ceiling of a warm process differs from a cold one's.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "speed-ceiling-"));
  const fresh = (args: (file: string) => string[], text: string, want: string): Probe => {
    const file = path.join(dir, "probe.alg");
    fs.writeFileSync(file, text);
    const r = spawnSync(process.execPath, ["--import", "tsx", ...args(file)], { cwd: ROOT, encoding: "utf8" });
    const ok = r.status === 0 && r.stdout.trim() === want;
    const why = /limit|stack/i.exec(`${r.stdout}\n${r.stderr}`);
    return { ok, end: ok ? "completed" : why === null ? `exit ${r.status}` : /stack/i.test(why[0]) ? "stack" : "kernel limit" };
  };
  const cases: { name: string; next: (n: number) => Promise<Probe> | Probe; same: (n: number) => Promise<Probe> | Probe }[] = [
    {
      name: "plain sum(n), each run in a fresh process",
      next: (n) => fresh((f) => ["next/launch/allegretto.ts", f], plainNext(n), String((n * (n + 1)) / 2)),
      same: (n) => fresh((f) => ["src/index.ts", "--base", f], plainSame(n), String((n * (n + 1)) / 2)),
    },
    {
      name: "plain sum(n), in this process",
      next: (n) => onNext(plainNext(n), (l) => l[0] === String((n * (n + 1)) / 2)),
      same: (n) => onSame(plainSame(n), (l) => l[0] === String((n * (n + 1)) / 2)),
    },
    {
      name: "parser, parentheses nested n deep",
      next: (n) => onNext(withInput(nextText, nestedInput(n)), (l) => (l[0] ?? "").startsWith("value 7,")),
      same: (n) => onSame(withInput(sameText, nestedInput(n)), (l) => l[0] === "value" && l[1] === "7"),
    },
    {
      name: "typed squares, a loop of n",
      next: (n) => onNext(withSizes(typedNext, { squares: n, letters: 1, halving: 1 }), (l) => l[0] === String(squaresTo(n))),
      same: (n) => onSame(withSizes(typedSame, { squares: n, letters: 1, halving: 1 }), (l) => l[0] === String(squaresTo(n))),
    },
    {
      name: "typed letters, a fold of n",
      next: (n) => onNext(withSizes(typedNext, { squares: 1, letters: n, halving: 1 }), (l) => l[1] === lettersTo(n)),
      same: (n) => onSame(withSizes(typedSame, { squares: 1, letters: n, halving: 1 }), (l) => l[1] === lettersTo(n)),
    },
  ];
  const out: string[] = [];
  for (const c of cases) {
    let nextStop = "", sameStop = "";
    const a = await largest(async (n) => { const r = await c.next(n); if (!r.ok) nextStop = r.end; return r.ok; });
    const b = await largest(async (n) => { const r = await c.same(n); if (!r.ok) sameStop = r.end; return r.ok; });
    const say = (x: { n: number | null; capped: boolean }, stop: string): string => (x.capped ? `${x.n} and beyond (not reached)` : `${x.n ?? "none"}, then ${stop}`);
    const line = `  ${pad(c.name, 44)} new kernel ${say(a, nextStop)}; present ${say(b, sameStop)}`;
    log(line);
    out.push(line);
  }
  fs.rmSync(dir, { recursive: true, force: true });
  return out;
}

// ---- Where the new kernel's time goes -------------------------------------------------

/**
 * Each probe is a program at size n. A probe with `calls` is run at 6 and at
 * 60 calls; the difference over the 54 calls between them is the time of
 * one call, with the program's fixed cost (loading the record, building the
 * value once) taken out. A probe without `calls` does one operation once.
 */
const xs = (n: number): string => `[${Array.from({ length: n }, (_, i) => i).join(", ")}]`;
const probes: { name: string; sizes: number[]; calls: boolean | "per step"; text: (n: number, calls: number) => string }[] = [
  {
    name: "time per step of sum(n) written n + sum(n - 1)",
    sizes: [50, 100, 200, 350],
    calls: "per step",
    text: (n) => `capability output\nsum(n) => if n == 0 then 0 else n + sum(n - 1)\noutput.write(int.text(sum(${n})))\n`,
  },
  {
    name: "time per step of sum(n) written pass(n, sum(n - 1)), with pass(a, b) => a + b",
    sizes: [50, 100, 200, 350],
    calls: "per step",
    text: (n) => `capability output\npass(a, b) => a + b\nsum(n) => if n == 0 then 0 else pass(n, sum(n - 1))\noutput.write(int.text(sum(${n})))\n`,
  },
  {
    name: "time per step of sum(n) written check(n, sum(n - 1)), where check claims b >= 0 before a + b",
    sizes: [50, 100, 200, 350],
    calls: "per step",
    text: (n) => `capability output\ncheck(a, b) =>\n  claim(b >= 0)\n  a + b\nsum(n) => if n == 0 then 0 else check(n, sum(n - 1))\noutput.write(int.text(sum(${n})))\n`,
  },
  {
    name: "one call that slices one character off a text of n characters",
    sizes: [10, 100, 1000, 10000, 100000],
    calls: true,
    text: (n, c) => `capability output\nt = "${"x".repeat(n)}"\nwalk(i) => if i == 0 then 0 else bits.length(bits.slice(t, 0, 8)) + walk(i - 1)\noutput.write(int.text(walk(${c})))\n`,
  },
  {
    name: "one call that reads entry 0 of a structure of n entries written in the text",
    sizes: [10, 100, 1000, 10000],
    calls: true,
    text: (n, c) => `capability output\nxs = ${xs(n)}\nwalk(i, s) => if i == 0 then 0 else get(s, 0) + 1 + walk(i - 1, s)\noutput.write(int.text(walk(${c}, xs)))\n`,
  },
  {
    name: "one call that hands on a tree of n leaves the program built",
    sizes: [16, 256, 4096, 65536],
    calls: true,
    text: (n, c) =>
      `capability output\nbuild(lo, hi) => if lo == hi then {leaf: lo} else {left: build(lo, (lo + hi) / 2), right: build((lo + hi) / 2 + 1, hi)}\n` +
      `walk(i, s) => if i == 0 then 0 else 1 + walk(i - 1, s)\nt <- build(1, ${n})\noutput.write(int.text(walk(${c}, t)))\n`,
  },
  {
    name: "one == of two equal texts of n characters",
    sizes: [100, 200, 400, 800, 1600],
    calls: false,
    text: (n) => `capability output\nt = "${"x".repeat(n)}"\nu = "${"x".repeat(n)}"\noutput.write(if t == u then "same" else "differ")\n`,
  },
  {
    name: "one ++ of a text of n characters with itself",
    sizes: [1000, 10000, 100000],
    calls: false,
    text: (n) => `capability output\nt = "${"x".repeat(n)}"\noutput.write(int.text(bits.length(t ++ t)))\n`,
  },
];

async function whereTimeGoes(log: (line: string) => void): Promise<string[]> {
  const out: string[] = [];
  const time = async (text: string): Promise<Cell> => {
    const { program } = emitTimed(text);
    return timed(() => runNew(program), (r) => ({ end: r.end.kind === "completed" ? "completed" : endWord(r.end), right: true, steps: r.steps }));
  };
  for (const pr of probes) {
    const parts: string[] = [];
    for (const n of pr.sizes) {
      if (pr.calls === "per step") {
        const one = await time(pr.text(n, 0));
        parts.push(`n ${n}: ${one.steps != null && one.end === "completed" ? ((one.ms * 1000) / one.steps).toFixed(1) : "-"} us (${one.steps} steps, ${one.end})`);
      } else if (pr.calls) {
        const few = await time(pr.text(n, 6)), many = await time(pr.text(n, 60));
        const perCall = (many.ms - few.ms) / 54;
        const stepsPerCall = few.steps != null && many.steps != null ? (many.steps - few.steps) / 54 : NaN;
        const total = `6 calls ${ms(few.ms)} ms, 60 calls ${ms(many.ms)} ms`;
        parts.push(perCall > 0 ? `n ${n}: ${ms(perCall)} ms per call of ${stepsPerCall} steps (${total})` : `n ${n}: under the noise (${total})`);
      } else {
        const one = await time(pr.text(n, 0));
        parts.push(`n ${n}: ${ms(one.ms)} ms (${one.steps} steps)`);
      }
    }
    const line = `  ${pr.name}: ${parts.join("; ")}`;
    log(line);
    out.push(line);
  }
  return out;
}

// ---- The run --------------------------------------------------------------------------

function machine(): string[] {
  const cpus = os.cpus();
  const commit = spawnSync("git", ["rev-parse", "--short", "HEAD"], { cwd: ROOT, encoding: "utf8" }).stdout.trim();
  const dirty = spawnSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf8" }).stdout.trim() !== "";
  return [
    `machine: ${cpus[0]?.model ?? "unknown"} x ${cpus.length}, ${Math.round(os.totalmem() / 2 ** 30)} GiB, ${os.type()} ${os.release()}, node ${process.version}`,
    `commit: ${commit}${dirty ? " with uncommitted changes" : ""}`,
  ];
}

/** The present tree's file runner from start to exit, which the in-process times leave out. */
function startUp(): string {
  const once = (args: string[]): number => {
    const t0 = performance.now();
    const r = spawnSync(process.execPath, ["--import", "tsx", "src/index.ts", ...args], { cwd: ROOT, encoding: "utf8" });
    if (r.status !== 0) throw new Error(`the file runner failed: ${r.stderr}`);
    return performance.now() - t0;
  };
  const m = (args: string[]): number => median([0, 1, 2].map(() => once(args)));
  const base = m(["--base", `${SPEED_DIR}/present/typed.alg`]);
  const standard = m([`${SPEED_DIR}/present/typed-native.alg`]);
  return `  the present tree's file runner, from start to exit, on the typed programs at size 10 (median of 3): base ${ms(base)} ms, standard ${ms(standard)} ms`;
}

async function main(): Promise<void> {
  const lines: string[] = [];
  const say = (l: string): void => { lines.push(l); };
  const progress = (l: string): void => { process.stderr.write(l + "\n"); };
  for (const l of machine()) say(l);
  say(`timing: median of ${RUNS} runs after a warm-up, in ms; a run past ${LONG_MS} ms is run once and ends its series`);
  say("new: the reference kernel, in process, launch only; emit: the bootstrap's emit of the text; present: the twin in the present tree's base language, evalSource in process (its parse included, start-up left out); native: the present tree's own engine or typed language");
  say("");
  const p = await present();

  progress("parser…");
  const parser = await parserTest(p, progress);
  for (const l of table(`Test 1: the toy parser engine. Size: terms of "${UNIT}" joined by " + ".`, "terms", parser)) say(l);
  say("");
  progress("typed, counted loop…");
  const loop = await typedTest(p, "loop", progress);
  for (const l of table("Test 2a: the typed extension, counted loop and fold. Size: squares = letters = n.", "n", loop)) say(l);
  say("");
  progress("typed, halving…");
  const halving = await typedTest(p, "halving", progress);
  for (const l of table("Test 2b: the typed extension, the sum split in halves. Size: halving = n.", "n", halving)) say(l);
  say("");

  say("The largest size each completes, and what stopped it:");
  for (const [name, rows] of [["parser", parser], ["typed loop", loop], ["typed halving", halving]] as const) {
    say(` ${name}`);
    say(reach(rows, "next", "new kernel"));
    say(reach(rows, "same", "present (same)"));
    say(reach(rows, "native", "present (native)"));
  }
  say("");
  say("How time grows with size (time ~ size^k):");
  for (const [name, rows] of [["parser", parser], ["typed loop", loop], ["typed halving", halving]] as const) {
    say(` ${name}`);
    say(growth(rows, "next", "new kernel", "steps"));
    say(growth(rows, "next", "new kernel"));
    say(growth(rows, "same", "present (same)"));
    say(growth(rows, "native", "present (native)"));
  }
  say("");
  progress("ceilings…");
  say("The recursion ceiling: the largest n that completes, found by doubling then halving, one run each:");
  for (const l of await ceilings(p, progress)) say(l);
  say("");
  progress("where the time goes…");
  say("Where the new kernel's time goes: the time of one call or one operation as a value grows (median of 5 after a warm-up):");
  for (const l of await whereTimeGoes(progress)) say(l);
  say("");
  progress("start-up…");
  say("Left out of the tables:");
  say(startUp());
  process.stdout.write(lines.join("\n") + "\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) await main();
