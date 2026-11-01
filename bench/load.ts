// The load corpus — B-157 (the performance stream), chunk P1
// (instrumentation and the corpus). Plan: docs/plans/fast-library-load.md §3.
//
//   npx tsx bench/load.ts                    # npm run bench:load — full runs, report only
//   npx tsx bench/load.ts --check            # npm run lint:load  — parse-only ratchet
//   npx tsx bench/load.ts --check --update-baseline
//
// Report mode runs each corpus entry the way the CLI does
// (`node --import tsx src/index.ts FILE`) with ALLEGRO_PARSE_STATS=1 and
// ALLEGRO_EVAL_STATS=1, and prints the wall clock, the summed engine counts
// of every parse the run performed, and the run's evaluation counts (B-157
// P10). It may take several minutes and gates nothing.
//
// Check mode parses only, in-process: each corpus program's body, and every
// library it `use`s or `import`s, each library source ONCE across the whole
// corpus (one shared module loader). A library is evaluated after its parse
// because its `grammar { }` values are what extend the grammar of the files
// that use it. The deterministic counts of each parse are compared with
// bench/load-baseline.json: any gated count (`GATED`) above its baseline
// fails; the final memo size is recorded and printed, never gated (B-157 P5).
// Wall clock is printed, never gated. `--update-baseline` rewrites the file; it is run
// only to LOWER the baseline after a chunk lands (or when the corpus changes).
//
// The precompile corpus (B-159 (precompile of recursive definitions), chunk
// R1 (the measurement lands); plan docs/plans/recursive-precompile.md §5):
// report mode runs and prints it after the load corpus. Since chunk R2 (one
// object per definition) check mode also gates it (ruling RR3 (whether and
// how the counts are gated)): each source runs through the CLI with
// ALLEGRO_EVAL_STATS=1, one fresh process per source, and its evaluation
// counts are compared with the `precompile` section of
// bench/load-baseline.json. `evaluates`, `inlineExpansions` and `precompiles`
// fail when they rise; `cutoffResiduals` fails when it falls, since a fall is
// a call the inline cutoff stopped recognising. A fresh process per source,
// not one in-process loop, because a compilation's counts depend on what an
// earlier compilation in the same process left behind (the refinement
// predicate of `NonNeg` is expanded once more after the first).

import * as fs from "fs";
import * as path from "path";
import { spawnSync } from "child_process";
import {
  parseSource, setParseStatsSink, type ParseReport,
} from "../src/grammar2/engine.js";
import { getBaseGrammar } from "../src/grammar2/base-grammar.js";
import { getGrammarWithFragments } from "../src/grammar2/fragments.js";
import { buildProgram } from "../src/grammar2/tree-builder.js";
import { ModuleLoader } from "../src/modules.js";
import { createTypeSystem } from "../src/types-std.js";
import { scanUses } from "../src/use-scanner.js";
import { asGrammarValue } from "../src/primitives.js";
import { createFutureManager } from "../src/futures.js";
import type { Extension } from "../src/runtime.js";
import type { GrammarFragment } from "../src/types.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const BASELINE = path.join(ROOT, "bench", "load-baseline.json");
const SYSTEM_LIB = path.join(ROOT, "lib");

/** A corpus group. `load` is the plan's §3 corpus, run by report mode and
 *  ratcheted by check mode's parse counts. `precompile` (B-159 R1) is run by
 *  report mode and, since R2, by check mode for its evaluation counts. */
type CorpusGroup = "load" | "precompile";

/** The corpus of the plan's §3, then the precompile corpus. A `library` entry
 *  is loaded as a module (`use NAME`); a `program` entry is a file the CLI
 *  runs. */
const CORPUS: { file: string; kind: "library" | "program"; group: CorpusGroup }[] = [
  { file: "lib/units.alg",                 kind: "library", group: "load" },
  { file: "lib/planning.alg",              kind: "library", group: "load" },
  { file: "tests/planning-solve-demo.alg", kind: "program", group: "load" },
  { file: "demos/rung3/01-model.alg",      kind: "program", group: "load" },
  { file: "demos/rung3/02-solve.alg",      kind: "program", group: "load" },
  // The six Phase E sources of docs/plans/recursive-precompile.md §2.2 and
  // the two totality demos that unfold a typed recursive definition.
  { file: "bench/corpus/precompile/factorial-nonneg.alg", kind: "program", group: "precompile" },
  { file: "bench/corpus/precompile/factorial-int.alg",    kind: "program", group: "precompile" },
  { file: "bench/corpus/precompile/f-decreases.alg",      kind: "program", group: "precompile" },
  { file: "bench/corpus/precompile/k-lex.alg",            kind: "program", group: "precompile" },
  { file: "bench/corpus/precompile/sum_to.alg",           kind: "program", group: "precompile" },
  { file: "bench/corpus/precompile/bad.alg",              kind: "program", group: "precompile" },
  { file: "tests/totality-termination-demo.alg",          kind: "program", group: "precompile" },
  { file: "tests/totality-decreases-demo.alg",            kind: "program", group: "precompile" },
];

/** The entries check mode parses and ratchets: the load group only. */
const CHECKED = CORPUS.filter(e => e.group === "load");
/** The entries check mode runs for their evaluation counts (B-159 R2). */
const PRECOMPILE_CHECKED = CORPUS.filter(e => e.group === "precompile");

/** The counts the ratchet gates: the engine's work. All are deterministic
 *  for a given grammar and source; wall clock is not among them.
 *  `lrIterations` is gated as an identity check on the growth loop. */
const GATED = ["matchAttempts", "memoWrites", "invalidationEntries", "lrIterations"] as const;
/** Counts recorded and printed but not gated. `finalMemoSize` is a
 *  footprint, not work: a chunk that stops redoing work keeps more entries
 *  (B-157 P5, dependency-tracked invalidation). */
const REPORTED = ["finalMemoSize"] as const;
type Counted = typeof GATED[number] | typeof REPORTED[number];
type Counts = Record<Counted, number>;
interface SourceRow extends Counts { chars: number; }

function countsOf(r: ParseReport): Counts {
  return {
    matchAttempts:       r.stats.matchRuleCalls,
    memoWrites:          r.stats.memoWrites,
    invalidationEntries: r.stats.invalidationCount,
    lrIterations:        r.stats.lrIterations,
    finalMemoSize:       r.stats.finalMemoSize,
  };
}

/** Repo-relative form of a label that may hold an absolute path. */
function rel(label: string): string {
  return label.split(ROOT + path.sep).join("");
}

function pad(s: string, n: number): string { return s.length >= n ? s : s + " ".repeat(n - s.length); }
function lpad(s: string, n: number): string { return s.length >= n ? s : " ".repeat(n - s.length) + s; }
function num(n: number): string { return n.toLocaleString("en-US"); }
/** The width of the report's entry column. */
const W = 48;

// --- Report mode: full runs ---------------------------------------------------

interface RunParse { source: string; chars: number; ms: number; attempts: number; memoWrites: number; invEntries: number; lrIters: number; }

function readReportLines(stderr: string): RunParse[] {
  const out: RunParse[] = [];
  for (const line of stderr.split("\n")) {
    const m = /^parse-stats source=(.*) chars=(\d+) ok=\w+ ms=(\d+) attempts=(\d+) memoWrites=(\d+) invRounds=\d+ invEntries=(\d+) lrIters=(\d+) memoFinal=\d+$/.exec(line);
    if (!m) continue;
    out.push({
      source: rel(m[1]), chars: Number(m[2]), ms: Number(m[3]), attempts: Number(m[4]),
      memoWrites: Number(m[5]), invEntries: Number(m[6]), lrIters: Number(m[7]),
    });
  }
  return out;
}

interface RunEval { evaluates: number; applyComposed: number; applyPrimitive: number; inlineExpansions: number; bindings: number; bindingEvals: number; maxPerBinding: number; reEvaluated: number; cutoffResiduals: number; precompiles: number; }

/** The run's one `eval-stats` line (`formatRunStats` in src/evaluator.ts). */
function readEvalLine(stderr: string): RunEval | null {
  for (const line of stderr.split("\n")) {
    if (!line.startsWith("eval-stats ")) continue;
    const field = (k: string): number => Number(new RegExp(`\\b${k}=(\\d+)`).exec(line)?.[1] ?? NaN);
    return {
      evaluates: field("evaluates"), applyComposed: field("applyComposed"), applyPrimitive: field("applyPrimitive"),
      inlineExpansions: field("inlineExpansions"), bindings: field("bindings"), bindingEvals: field("bindingEvals"),
      maxPerBinding: field("maxPerBinding"), reEvaluated: field("reEvaluated"),
      cutoffResiduals: field("cutoffResiduals"), precompiles: field("precompiles"),
    };
  }
  return null;
}

// --- Check mode: the precompile corpus's evaluation counts (B-159 R2) --------

/** The evaluation counts the precompile ratchet gates against a RISE. */
const PRECOMPILE_GATED = ["evaluates", "inlineExpansions", "precompiles"] as const;
/** The counts it gates against a FALL: the cutoff's residuals are a floor. */
const PRECOMPILE_FLOOR = ["cutoffResiduals"] as const;
type PrecompileRow = Record<typeof PRECOMPILE_GATED[number] | typeof PRECOMPILE_FLOOR[number], number>;

/** Run each precompile-corpus source through the CLI, a fresh process each,
 *  and read its `eval-stats` line. */
function measurePrecompile(): { rows: Map<string, PrecompileRow>; failures: string[] } {
  const rows = new Map<string, PrecompileRow>();
  const failures: string[] = [];
  for (const entry of PRECOMPILE_CHECKED) {
    const r = spawnSync(process.execPath, ["--import", "tsx", "src/index.ts", entry.file], {
      cwd: ROOT, encoding: "utf-8", maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, ALLEGRO_EVAL_STATS: "1" },
    });
    const e = readEvalLine(r.stderr ?? "");
    if (r.status !== 0 || !e) {
      failures.push(`${entry.file}: exited ${r.status}${e ? "" : " with no eval-stats line"}`);
      continue;
    }
    rows.set(entry.file, {
      evaluates: e.evaluates, inlineExpansions: e.inlineExpansions,
      precompiles: e.precompiles, cutoffResiduals: e.cutoffResiduals,
    });
  }
  return { rows, failures };
}

function runReport(): number {
  console.log("Load corpus — full runs (parse + evaluation), ALLEGRO_PARSE_STATS=1 ALLEGRO_EVAL_STATS=1");
  console.log("Wall clock is reported, never gated (docs/plans/fast-library-load.md §3).\n");
  const rows: { file: string; group: CorpusGroup; wall: number; code: number | null; parses: RunParse[]; evals: RunEval | null; tail: string }[] = [];
  let group: CorpusGroup | null = null;
  for (const entry of CORPUS) {
    if (entry.group !== group) {
      group = entry.group;
      console.log(group === "load" ? "Load corpus (ratcheted by npm run lint:load):"
        : "Precompile corpus (B-159; evaluation counts ratcheted by npm run lint:load since R2):");
    }
    const t0 = Date.now();
    const r = spawnSync(process.execPath, ["--import", "tsx", "src/index.ts", entry.file], {
      cwd: ROOT, encoding: "utf-8", maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, ALLEGRO_PARSE_STATS: "1", ALLEGRO_EVAL_STATS: "1" },
    });
    const wall = (Date.now() - t0) / 1000;
    const parses = readReportLines(r.stderr ?? "");
    const evals = readEvalLine(r.stderr ?? "");
    const tail = (r.stderr ?? "").split("\n")
      .filter(l => l && !l.startsWith("parse-stats ") && !l.startsWith("eval-stats ")).slice(-8).join("\n");
    rows.push({ file: entry.file, group: entry.group, wall, code: r.status, parses, evals, tail });
    console.log(`  ${pad(entry.file, W)} ${lpad(wall.toFixed(1), 7)} s  exit ${r.status}  (${parses.length} parses)`);
  }

  console.log("");
  const header = "  " + pad("entry", W) + lpad("wall s", 8) + lpad("parses", 8) + lpad("parse s", 9) +
    lpad("attempts", 14) + lpad("memo writes", 14) + lpad("inv entries", 13) + lpad("LR iters", 10);
  console.log(header);
  console.log("  " + "-".repeat(header.length - 2));
  for (const row of rows) {
    const sum = (k: keyof RunParse) => row.parses.reduce((a, p) => a + (p[k] as number), 0);
    console.log("  " + pad(row.file, W) + lpad(row.wall.toFixed(1), 8) + lpad(String(row.parses.length), 8) +
      lpad((sum("ms") / 1000).toFixed(1), 9) + lpad(num(sum("attempts")), 14) + lpad(num(sum("memoWrites")), 14) +
      lpad(num(sum("invEntries")), 13) + lpad(num(sum("lrIters")), 10));
  }

  console.log("\nEvaluation per run (B-157 P10; a binding is a top-level binding whose expression computes;");
  console.log("cutoff res. and precompiles are B-159 R1's counters):");
  const eheader = "  " + pad("entry", W) + lpad("evaluate", 12) + lpad("applyComposed", 15) + lpad("applyPrimitive", 16) +
    lpad("inline exp.", 13) + lpad("cutoff res.", 13) + lpad("precompiles", 13) +
    lpad("bindings", 10) + lpad("binding evals", 15) + lpad("max", 8) + lpad("re-eval'd", 11);
  console.log(eheader);
  console.log("  " + "-".repeat(eheader.length - 2));
  for (const row of rows) {
    const e = row.evals;
    if (!e) { console.log("  " + pad(row.file, W) + "  (no eval-stats line)"); continue; }
    console.log("  " + pad(row.file, W) + lpad(num(e.evaluates), 12) + lpad(num(e.applyComposed), 15) +
      lpad(num(e.applyPrimitive), 16) + lpad(num(e.inlineExpansions), 13) +
      lpad(num(e.cutoffResiduals), 13) + lpad(num(e.precompiles), 13) + lpad(num(e.bindings), 10) +
      lpad(num(e.bindingEvals), 15) + lpad(String(e.maxPerBinding), 8) + lpad(String(e.reEvaluated), 11));
  }

  console.log("\nParses per run:");
  for (const row of rows) {
    console.log(`  ${row.file}`);
    for (const p of row.parses) {
      console.log(`    ${pad(p.source, 52)} ${lpad(num(p.chars), 7)} chars ${lpad((p.ms / 1000).toFixed(1), 6)} s ${lpad(num(p.attempts), 12)} attempts`);
    }
  }

  const failed = rows.filter(r => r.code !== 0);
  for (const f of failed) {
    console.error(`\n${f.file} exited ${f.code}:\n${f.tail}`);
  }
  console.log(failed.length ? `\nbench:load: ${failed.length} run(s) FAILED` : `\nbench:load: ${rows.length} runs completed`);
  return failed.length ? 1 : 0;
}

// --- Check mode: parse only, ratcheted ----------------------------------------

function collectFragments(extensions: Extension[]): GrammarFragment[] {
  const out: GrammarFragment[] = [];
  for (const ext of extensions) {
    if (ext.grammarFragment) out.push(ext.grammarFragment);
    for (const key of Object.keys(ext.bindings ?? {})) {
      const data = asGrammarValue(ext.bindings[key]);
      if (data) out.push(data.fragment);
    }
  }
  return out;
}

async function measure(): Promise<{ rows: Map<string, SourceRow>; ms: Map<string, number>; failures: string[] }> {
  const rows = new Map<string, SourceRow>();
  const ms = new Map<string, number>();
  const failures: string[] = [];
  const record = (r: ParseReport): void => {
    const key = rel(r.source);
    if (rows.has(key)) {
      failures.push(`${key}: parsed twice in one check (each source is parsed once)`);
      return;
    }
    if (!r.ok) failures.push(`${key}: parse FAILED`);
    rows.set(key, { chars: r.chars, ...countsOf(r) });
    ms.set(key, r.stats.durationMs);
  };

  // One loader for the whole corpus: its cache (by resolved path) is what
  // makes each library source parse once. `currentDir` mirrors the CLI's
  // resolution: the file's own `lib/` first, then the system `lib/`.
  let currentDir = ROOT;
  const stdExtensions: Extension[] = [createTypeSystem()];
  const loader = new ModuleLoader({
    modules: [],
    resolve: (id) => {
      const local = path.join(currentDir, "lib", `${id}.alg`);
      if (fs.existsSync(local)) return local;
      const system = path.join(SYSTEM_LIB, `${id}.alg`);
      if (fs.existsSync(system)) return system;
      return null;
    },
    readFile: async (p) => fs.readFileSync(p, "utf-8"),
    extensions: stdExtensions,
    futureManager: createFutureManager(),
  });

  const previous = setParseStatsSink(record);
  try {
    for (const entry of CHECKED) {
      const file = path.join(ROOT, entry.file);
      currentDir = path.dirname(file);
      try {
        if (entry.kind === "library") {
          await loader.loadModule(path.basename(file, ".alg"), new Set());
          continue;
        }
        // A program: its `use`d libraries extend its grammar, so they load
        // (parse + evaluate) first; its body is then parsed only.
        const source = fs.readFileSync(file, "utf-8");
        const scan = scanUses(source);
        const useNames = new Set<string>();
        for (const d of scan.directives) {
          if (d.kind === "module") useNames.add(d.name!);
          else if (d.kind === "member") useNames.add(d.moduleName!);
        }
        const useExts: Extension[] = [];
        for (const name of useNames) useExts.push(await loader.loadModule(name, new Set()));
        const extensions = [...stdExtensions, ...useExts];
        const fragments = collectFragments(extensions);
        const grammar = fragments.length > 0 ? getGrammarWithFragments(fragments) : getBaseGrammar();
        const body = source.slice(scan.headerEnd).replace(/\r\n/g, "\n");
        const result = parseSource(grammar, body, entry.file);
        if (!result.ok) continue;
        // Its `import`ed modules load as the CLI loads them (the
        // bindings the program leaves undefined and no extension provides).
        const fileCtx: any = buildProgram(result.tree);
        const provided = new Set<string>();
        for (const ext of extensions) {
          for (const name of Object.keys(ext.bindings)) provided.add(name);
          if (ext.moduleObject) provided.add(ext.name);
        }
        for (const b of fileCtx?.bindingList ?? []) {
          if (b.key !== null && b.value === undefined && !provided.has(b.key)) {
            await loader.loadModule(b.key, new Set());
          }
        }
      } catch (e: any) {
        failures.push(`${entry.file}: ${e.message}`);
      }
    }
  } finally {
    setParseStatsSink(previous);
  }
  return { rows, ms, failures };
}

async function runCheck(update: boolean): Promise<number> {
  const t0 = Date.now();
  const { rows, ms, failures } = await measure();
  const pre = measurePrecompile();
  failures.push(...pre.failures);
  const wall = (Date.now() - t0) / 1000;

  const header = "  " + pad("source", 34) + lpad("chars", 8) + lpad("parse s", 9) +
    lpad("attempts", 14) + lpad("memo writes", 14) + lpad("inv entries", 13) + lpad("LR iters", 10) + lpad("memo final", 12);
  console.log("Load ratchet — parse only, each source once (counts gated, clock not)");
  console.log(header);
  console.log("  " + "-".repeat(header.length - 2));
  for (const [src, r] of rows) {
    console.log("  " + pad(src, 34) + lpad(num(r.chars), 8) + lpad(((ms.get(src) ?? 0) / 1000).toFixed(1), 9) +
      lpad(num(r.matchAttempts), 14) + lpad(num(r.memoWrites), 14) + lpad(num(r.invalidationEntries), 13) +
      lpad(num(r.lrIterations), 10) + lpad(num(r.finalMemoSize), 12));
  }
  const parseSeconds = [...ms.values()].reduce((a, b) => a + b, 0) / 1000;

  const pheader = "  " + pad("precompile source", W) + lpad("evaluate", 10) + lpad("inline exp.", 13) +
    lpad("precompiles", 13) + lpad("cutoff res.", 13);
  console.log("Precompile ratchet (B-159 R2) — evaluation counts, one CLI run per source");
  console.log(pheader);
  console.log("  " + "-".repeat(pheader.length - 2));
  for (const [src, r] of pre.rows) {
    console.log("  " + pad(src, W) + lpad(num(r.evaluates), 10) + lpad(num(r.inlineExpansions), 13) +
      lpad(num(r.precompiles), 13) + lpad(num(r.cutoffResiduals), 13));
  }

  if (failures.length) {
    for (const f of failures) console.log(`  FAIL ${f}`);
    console.log(`load lint: FAILED — ${failures.length} source(s) did not load`);
    return 1;
  }

  if (update) {
    const sources: Record<string, SourceRow> = {};
    for (const [src, r] of rows) sources[src] = r;
    const precompileSources: Record<string, PrecompileRow> = {};
    for (const [src, r] of pre.rows) precompileSources[src] = r;
    const doc = {
      _: "B-157 (the performance stream) P1: the load ratchet's baseline, written by `npm run lint:load -- --update-baseline`. Per corpus source, the engine's deterministic parse counts. Four are gated (match attempts, memo writes, invalidation entries, left-recursion iterations): `npm run lint:load` fails when any rises. The final memo size is recorded and reported, not gated (since P5). Lower it after a chunk lands; never raise it to pass. docs/plans/fast-library-load.md §3.",
      gated: GATED,
      reported: REPORTED,
      sources,
      precompile: {
        _: "B-159 (precompile of recursive definitions) R2: the precompile corpus's evaluation counts, one CLI run per source with ALLEGRO_EVAL_STATS=1. `gated` fail when they rise, `floor` when it falls (a cutoff residual lost is a call the inline cutoff stopped recognising). Lower `gated` / raise `floor` only in its own commit (B-164). docs/plans/recursive-precompile.md §3 and ruling RR3.",
        gated: PRECOMPILE_GATED,
        floor: PRECOMPILE_FLOOR,
        sources: precompileSources,
      },
    };
    fs.writeFileSync(BASELINE, JSON.stringify(doc, null, 2) + "\n");
    console.log(`load lint: baseline written for ${rows.size} sources and ${pre.rows.size} precompile sources (bench/load-baseline.json; parse ${parseSeconds.toFixed(1)} s, check ${wall.toFixed(1)} s)`);
    return 0;
  }

  if (!fs.existsSync(BASELINE)) {
    console.log("load lint: FAILED — bench/load-baseline.json is missing (run with --update-baseline)");
    return 1;
  }
  const baselineDoc = JSON.parse(fs.readFileSync(BASELINE, "utf-8"));
  const baseline = baselineDoc.sources as Record<string, SourceRow>;
  const rises: string[] = [];
  const falls: string[] = [];
  for (const [src, r] of rows) {
    const b = baseline[src];
    if (!b) { rises.push(`${src}: not in the baseline (corpus changed? run with --update-baseline)`); continue; }
    for (const k of GATED) {
      if (r[k] > b[k]) rises.push(`${src}: ${k} ${num(r[k])} > baseline ${num(b[k])}`);
      else if (r[k] < b[k]) falls.push(`${src}: ${k} ${num(r[k])} < baseline ${num(b[k])}`);
    }
  }
  for (const src of Object.keys(baseline)) {
    if (!rows.has(src)) rises.push(`${src}: in the baseline but no longer parsed (corpus changed? run with --update-baseline)`);
  }
  const preBaseline = baselineDoc.precompile?.sources as Record<string, PrecompileRow> | undefined;
  if (!preBaseline) {
    rises.push("precompile: bench/load-baseline.json has no `precompile` section (run with --update-baseline)");
  } else {
    for (const [src, r] of pre.rows) {
      const b = preBaseline[src];
      if (!b) { rises.push(`${src}: not in the precompile baseline (corpus changed? run with --update-baseline)`); continue; }
      for (const k of PRECOMPILE_GATED) {
        if (r[k] > b[k]) rises.push(`${src}: ${k} ${num(r[k])} > baseline ${num(b[k])}`);
        else if (r[k] < b[k]) falls.push(`${src}: ${k} ${num(r[k])} < baseline ${num(b[k])}`);
      }
      for (const k of PRECOMPILE_FLOOR) {
        if (r[k] < b[k]) rises.push(`${src}: ${k} ${num(r[k])} < baseline floor ${num(b[k])}`);
        else if (r[k] > b[k]) falls.push(`${src}: ${k} ${num(r[k])} > baseline floor ${num(b[k])}`);
      }
    }
    for (const src of Object.keys(preBaseline)) {
      if (!pre.rows.has(src)) rises.push(`${src}: in the precompile baseline but no longer run (corpus changed? run with --update-baseline)`);
    }
  }
  for (const f of falls) console.log(`  below baseline: ${f}`);
  for (const r of rises) console.log(`  ABOVE BASELINE: ${r}`);
  if (falls.length && !rises.length) console.log("  (lower the baseline with `npm run lint:load -- --update-baseline`)");
  const summary = `${rows.size} sources and ${pre.rows.size} precompile sources, parse ${parseSeconds.toFixed(1)} s, check ${wall.toFixed(1)} s (clock not gated)`;
  if (rises.length) {
    console.log(`load lint: FAILED — ${rises.length} count(s) above baseline; ${summary}`);
    return 1;
  }
  console.log(`load lint: counts at or below baseline; ${summary}`);
  return 0;
}

const argv = process.argv.slice(2);
const code = argv.includes("--check")
  ? await runCheck(argv.includes("--update-baseline"))
  : runReport();
process.exit(code);
