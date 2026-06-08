// PCP benchmark harness.
//
// Measures the provability arc across baselines on the `bench/corpus`
// obligations (see `bench/manifest.ts`). For each entry it derives three
// forms from the solved-form file and runs them through the SAME
// verification kernel the `allegro verify` / `allegro prove` commands use:
//
//   1. reference  — the solved file as-is. Sanity check: the curated
//                   proof must discharge. A failure here means the corpus
//                   is broken, not that a prover is weak.
//   2. auto-PE    — the goal with its `by` term stripped. Measures what
//                   the kernel discharges with no prover at all.
//   3. LLM        — the goal with its `by` term replaced by a wrong
//                   sentinel (a real pending obligation), handed to the
//                   LLM worker to solve. Optional; needs ANTHROPIC_API_KEY.
//
// The harness is deterministic without the LLM baseline (reference +
// auto-PE need no API key), so it runs in CI and in the test suite.

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { fileURLToPath } from "url";

import { evalSource } from "../src/runtime.js";
import { createTypeSystem } from "../src/types-std.js";
import { buildVerdict } from "../src/pcp.js";
import type { TheoremStatus } from "../src/pcp.js";
import {
  spliceProof, runLlmWorker,
  type LlmClient,
} from "../pcp/llm-worker.js";
import { CORPUS, WRONG_SENTINEL_TERM, type BenchEntry, type BenchCategory } from "./manifest.js";

/** Repo root — `bench/` sits directly under it. */
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// =============================================================================
// Result shapes
// =============================================================================

export interface LlmMeasurement {
  /** Did the worker converge on a discharging proof term? */
  discharged: boolean;
  /** Iterations consumed (1 .. maxAttempts). */
  attempts: number;
  /** The winning proof term, if any. */
  finalTerm?: string;
  /** Set when the worker errored (e.g. API failure) rather than just
   *  failing to converge. */
  error?: string;
}

export interface BenchEntryResult {
  id: string;
  file: string;
  category: BenchCategory;
  description: string;
  goalTheorem: string;
  /** Whether this entry has a soundness-gated `by` slot a prover targets. */
  hasGate: boolean;
  /** Reference baseline: solved file as-is discharges the goal. */
  referenceDischarged: boolean;
  /** Auto-PE baseline: bare proposition (no proof term) discharges. */
  autoPeBareDischarged: boolean;
  /** Gate check: the wrong sentinel term is rejected (goal → failed).
   *  null for auto-PE-only entries (no `by` slot to gate). */
  gateRejectsWrong: boolean | null;
  /** LLM baseline, when run. null when not run (no key / disabled / no gate). */
  llm: LlmMeasurement | null;
}

export interface BenchReport {
  results: BenchEntryResult[];
  totals: {
    entries: number;
    /** Entries whose reference proof discharged (corpus validity). */
    referencePassed: number;
    /** Entries auto-PE discharged in bare form. */
    autoPePassed: number;
    /** Gated entries whose wrong sentinel was correctly rejected. */
    gatedEntries: number;
    gateRejectedWrong: number;
    /** LLM baseline aggregates, when run. */
    llmRan: boolean;
    llmAttempted: number;
    llmDischarged: number;
  };
}

export interface RunOptions {
  /** Run the LLM baseline (requires a client). Default false. */
  llm?: boolean;
  /** Pre-built client; when omitted and `llm` is true, the runner
   *  constructs an Anthropic client (needs ANTHROPIC_API_KEY). */
  client?: LlmClient;
  /** Max attempts per obligation for the LLM worker. Default 5. */
  maxAttempts?: number;
  /** Restrict to a subset of corpus entries by id. Default: all. */
  only?: string[];
}

// =============================================================================
// Form derivation
// =============================================================================

/** Remove a `by <term>` clause from a `theorem NAME:` line, yielding the
 *  bare proposition. Mirrors `spliceProof`'s line regex. Returns the
 *  source unchanged if the theorem has no `by` clause. */
export function stripProof(source: string, theoremName: string): string {
  const escName = theoremName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const lineRe = new RegExp(
    `^([ \\t]*theorem\\s+${escName}\\s*:[^\\n]*?)(\\s+by\\s+[^\\n]+?)?(\\s*)$`,
    "m",
  );
  return source.replace(lineRe, (_full, head, _by, trailing) => `${head}${trailing ?? ""}`);
}

// =============================================================================
// Verification
// =============================================================================

/** Load a candidate source in softFail mode and report the status of one
 *  theorem. Uses only the type-system extension — the corpus relies on
 *  proof primitives in the standard env, no module imports. */
function goalStatus(source: string, goalTheorem: string): TheoremStatus | "absent" {
  const result = evalSource(
    source, undefined, [createTypeSystem()], undefined,
    /*standard*/ true, undefined, /*softFail*/ true,
  );
  const verdict = buildVerdict(result.evalCtx, result.compilationReport);
  const t = verdict.theorems.find(t => t.name === goalTheorem);
  return t ? t.status : "absent";
}

// =============================================================================
// Per-entry measurement
// =============================================================================

async function measureEntry(entry: BenchEntry, opts: RunOptions): Promise<BenchEntryResult> {
  const absPath = path.resolve(REPO_ROOT, entry.file);
  const solved = fs.readFileSync(absPath, "utf-8");
  const hasGate = entry.referenceProof !== null;

  // 1. Reference baseline — solved file as-is.
  const referenceDischarged = goalStatus(solved, entry.goalTheorem) === "discharged";

  // 2. Auto-PE baseline — bare proposition.
  const bare = stripProof(solved, entry.goalTheorem);
  const autoPeBareDischarged = goalStatus(bare, entry.goalTheorem) === "discharged";

  // 3. Gate check + LLM baseline — only for entries with a `by` slot.
  let gateRejectsWrong: boolean | null = null;
  let llm: LlmMeasurement | null = null;

  if (hasGate) {
    const gated = spliceProof(solved, entry.goalTheorem, WRONG_SENTINEL_TERM);
    gateRejectsWrong = goalStatus(gated, entry.goalTheorem) === "failed";

    if (opts.llm && opts.client) {
      llm = await runLlmBaseline(entry, gated, opts.client, opts.maxAttempts ?? 5);
    }
  }

  return {
    id: entry.id,
    file: entry.file,
    category: entry.category,
    description: entry.description,
    goalTheorem: entry.goalTheorem,
    hasGate,
    referenceDischarged,
    autoPeBareDischarged,
    gateRejectsWrong,
    llm,
  };
}

/** Drive the LLM worker against the gated (pending) form via a temp file,
 *  then read the goal's outcome out of the worker result. */
async function runLlmBaseline(
  entry: BenchEntry,
  gatedSource: string,
  client: LlmClient,
  maxAttempts: number,
): Promise<LlmMeasurement> {
  const tmp = path.join(os.tmpdir(), `bench-${entry.id}-${process.pid}-${Date.now()}.alg`);
  fs.writeFileSync(tmp, gatedSource, "utf-8");
  try {
    const result = await runLlmWorker({
      filename: tmp, maxAttempts, enableLlm: true, client,
    });
    const ob = result.perObligation.find(o => o.name === entry.goalTheorem);
    if (!ob) {
      return { discharged: false, attempts: 0, error: "worker saw no pending obligation for goal" };
    }
    return {
      discharged: ob.discharged,
      attempts: ob.attempts,
      finalTerm: ob.finalTerm,
    };
  } catch (e: any) {
    return { discharged: false, attempts: 0, error: e?.message ?? String(e) };
  } finally {
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
  }
}

// =============================================================================
// Top-level runner
// =============================================================================

export async function runBenchmark(opts: RunOptions = {}): Promise<BenchReport> {
  const entries = opts.only
    ? CORPUS.filter(e => opts.only!.includes(e.id))
    : CORPUS;

  const results: BenchEntryResult[] = [];
  for (const entry of entries) {
    results.push(await measureEntry(entry, opts));
  }

  const gated = results.filter(r => r.hasGate);
  const llmRows = results.filter(r => r.llm !== null);
  return {
    results,
    totals: {
      entries: results.length,
      referencePassed: results.filter(r => r.referenceDischarged).length,
      autoPePassed: results.filter(r => r.autoPeBareDischarged).length,
      gatedEntries: gated.length,
      gateRejectedWrong: gated.filter(r => r.gateRejectsWrong === true).length,
      llmRan: llmRows.length > 0,
      llmAttempted: llmRows.length,
      llmDischarged: llmRows.filter(r => r.llm!.discharged).length,
    },
  };
}
