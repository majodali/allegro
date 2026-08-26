// =============================================================================
// Out-of-tree tooling: the PCP benchmark, the doc-ref lint, check-deployed.
//
// Extracted from the single-file suite (suite split, lane B). Registrations
// run at import time; src/test/index.ts imports this module in suite order.
// =============================================================================

import { test, asyncTest, eq } from "./harness.js";
import { CORPUS, WRONG_SENTINEL_TERM } from "../../bench/manifest.js";
import { runBenchmark, stripProof } from "../../bench/harness.js";
import { lintDocRefs } from "../../scripts/doc-ref-lint.js";
import { assessDeployment, parseStamp } from "../../scripts/check-deployed.js";
import * as fs from "fs";
import * as path from "path";
import * as nodePath from "path";
import type { LlmClient as BenchLlmClient } from "../../pcp/llm-worker.js";

// --- PCP benchmark suite (bench/) ---
//
// The benchmark harness lives outside src/ (like pcp/), resolved by tsx at
// runtime. These tests pin the corpus shape and the deterministic baselines
// (reference + auto-PE + soundness gates) so a regression in the proof
// kernel surfaces here, and exercise the LLM-baseline path with a mock
// client (no API key needed).


export async function runBenchmarkTests(): Promise<void> {
  test("PCP benchmark: corpus has 10 graded entries spanning all categories", () => {
    eq(CORPUS.length, 10);
    const cats = new Set(CORPUS.map(e => e.category));
    eq(cats.has("refl-trivial"), true);
    eq(cats.has("combinator"), true);
    eq(cats.has("type-bound"), true);
    // Every entry targets a `goal` theorem and points at an existing file.
    for (const e of CORPUS) {
      eq(e.goalTheorem, "goal", `entry ${e.id} targets goal`);
      eq(fs.existsSync(path.resolve(e.file)), true, `entry ${e.id} file exists`);
    }
    // 8 entries carry a soundness-gated `by` slot; 2 are auto-PE-only.
    eq(CORPUS.filter(e => e.referenceProof !== null).length, 8);
    eq(CORPUS.filter(e => e.referenceProof === null).length, 2);
  });

  test("PCP benchmark: stripProof removes a by clause, leaves bare theorems alone", () => {
    eq(stripProof("theorem goal: 7 == 7 by proof_refl(7)\n", "goal").trim(),
       "theorem goal: 7 == 7");
    // No `by` clause → unchanged.
    eq(stripProof("theorem goal: 7 == 7\n", "goal").trim(), "theorem goal: 7 == 7");
    // Leaves other theorems untouched.
    const multi = "theorem ab: 1 == 1\ntheorem goal: 2 == 2 by proof_refl(2)\n";
    eq(stripProof(multi, "goal").includes("theorem ab: 1 == 1"), true);
    eq(stripProof(multi, "goal").includes("by proof_refl"), false);
  });

  await asyncTest("PCP benchmark: deterministic baselines all pass (corpus is healthy)", async () => {
    const report = await runBenchmark();
    eq(report.totals.entries, 10);
    eq(report.totals.referencePassed, 10, "every curated proof discharges");
    eq(report.totals.autoPePassed, 10, "auto-PE discharges every bare proposition");
    eq(report.totals.gatedEntries, 8);
    eq(report.totals.gateRejectedWrong, 8, "every soundness gate rejects the wrong term");
    eq(report.totals.llmRan, false, "no LLM baseline without a client");
  });

  await asyncTest("PCP benchmark: LLM baseline converges with a mock client", async () => {
    // A mock prover that answers each gated obligation with its reference
    // term, selected by matching the proposition text in the user message.
    const refByProp: Array<[string, string]> = CORPUS
      .filter(e => e.referenceProof !== null)
      .map(e => {
        // Recover the proposition from the bare form for matching.
        const src = fs.readFileSync(path.resolve(e.file), "utf-8");
        const m = src.match(new RegExp(`theorem\\s+${e.goalTheorem}\\s*:\\s*([^\\n]*?)(\\s+by\\s+|\\s*$)`, "m"));
        const prop = (m?.[1] ?? "").trim();
        return [prop, e.referenceProof!] as [string, string];
      });
    const client: BenchLlmClient = {
      modelId: () => "mock-bench",
      async send({ userMessage }: { userMessage: string }) {
        for (const [prop, term] of refByProp) {
          if (prop && userMessage.includes(prop)) return "```allegro\n" + term + "\n```";
        }
        return "```allegro\n" + WRONG_SENTINEL_TERM + "\n```";
      },
    };
    const report = await runBenchmark({ llm: true, client, only: ["t01", "t05", "t08"], maxAttempts: 3 });
    eq(report.totals.llmRan, true);
    eq(report.totals.llmAttempted, 3, "three gated obligations were given to the worker");
    eq(report.totals.llmDischarged, 3, "the mock prover converged on all three");
    for (const r of report.results) {
      eq(r.llm?.discharged, true, `entry ${r.id} converged`);
    }
  });
}

// --- Doc-reference lint (PROCESS §10) ---


export function runDocLintTests(): void {
  test("doc-ref lint: all tracked markdown doc references resolve", () => {
    const findings = lintDocRefs(nodePath.resolve(import.meta.dirname, "../.."));
    const rendered = findings.map((f) => `${f.file}:${f.line} → ${f.ref}`).join("; ");
    eq(rendered, "", "dangling doc references");
  });
}

// --- B-096: deployed-version verification — pure verdict logic (no network) ---


export function runCheckDeployedTests(): void {
  const stamp = (commit: string, opts: { branch?: string; dirty?: boolean } = {}) => ({
    commit,
    branch: opts.branch ?? "main",
    deployedAt: "2026-08-21T00:00:00Z",
    dirty: opts.dirty ?? false,
  });
  const MAIN = "a".repeat(40);
  const OLD = "b".repeat(40);

  test("B-096: live matching origin/main is current (exit 0)", () => {
    const v = assessDeployment({ stamp: stamp(MAIN), mainHead: MAIN, liveKnownLocally: true, behindMain: 0 });
    eq(v.status, "current");
    eq(v.exitCode, 0);
  });

  test("B-096: live behind main reports the commit count (exit 1)", () => {
    const v = assessDeployment({ stamp: stamp(OLD), mainHead: MAIN, liveKnownLocally: true, behindMain: 3 });
    eq(v.status, "stale");
    eq(v.exitCode, 1);
    eq(v.lines.some((l) => l.includes("3 commit(s) behind")), true, "behind count rendered");
  });

  test("B-096: missing stamp is unverifiable with redeploy guidance (exit 2)", () => {
    const v = assessDeployment({ stamp: null, mainHead: MAIN, liveKnownLocally: false, behindMain: null });
    eq(v.status, "unverifiable");
    eq(v.exitCode, 2);
    eq(v.lines.some((l) => l.includes("Redeploy")), true, "guidance rendered");
  });

  test("B-096: live commit unknown to the clone is a mismatch, not a crash", () => {
    const v = assessDeployment({ stamp: stamp("c".repeat(40)), mainHead: MAIN, liveKnownLocally: false, behindMain: null });
    eq(v.status, "stale");
    eq(v.lines.some((l) => l.includes("unknown to this clone")), true);
  });

  test("B-096: dirty deploy of main's commit is a mismatch with a warning", () => {
    const v = assessDeployment({ stamp: stamp(MAIN, { dirty: true }), mainHead: MAIN, liveKnownLocally: true, behindMain: 0 });
    eq(v.status, "stale");
    eq(v.lines.some((l) => l.includes("DIRTY working tree")), true, "dirty warning rendered");
  });

  test("B-096: non-main deploy branch warns even when current", () => {
    const v = assessDeployment({ stamp: stamp(MAIN, { branch: "hotfix" }), mainHead: MAIN, liveKnownLocally: true, behindMain: 0 });
    eq(v.status, "current");
    eq(v.lines.some((l) => l.includes("branch 'hotfix'")), true, "branch warning rendered");
  });

  test("B-096: parseStamp accepts the deploy.sh shape and rejects junk", () => {
    const ok = parseStamp('{"commit": "abc", "branch": "main", "deployedAt": "2026-08-21T00:00:00Z", "dirty": false}');
    eq(ok?.commit, "abc");
    eq(ok?.dirty, false);
    eq(parseStamp("<html>404</html>"), null);
    eq(parseStamp('{"unrelated": 1}'), null);
  });
}

