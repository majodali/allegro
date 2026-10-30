// =============================================================================
// Out-of-tree tooling: the PCP benchmark, the doc-ref lint, check-deployed.
//
// Extracted from the single-file suite (suite split, lane B). Registrations
// run at import time; src/test/index.ts imports this module in suite order.
// =============================================================================

import { test, asyncTest, eq, SHARD } from "./harness.js";
import { CORPUS, WRONG_SENTINEL_TERM } from "../../bench/manifest.js";
import { runBenchmark, stripProof } from "../../bench/harness.js";
import { lintDocRefs } from "../../scripts/doc-ref-lint.js";
import { checkAll as checkStreamPlans, checkStreamPlan, loadContext as loadStreamPlanContext, parseFrontMatter, streamPlans } from "../../scripts/stream-plan.js";
import { backlogIdOf, checkFiles, checkManifest, declaredLane, globToRegExp, loadManifest } from "../../scripts/analyze/lane-lint.js";
import { assessDeployment, parseStamp } from "../../scripts/check-deployed.js";
import * as fs from "fs";
import * as path from "path";
import { execFileSync } from "node:child_process";
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

  // --- Stream plans (B-166): the machine-readable header is well-formed ---
  const repoRoot = nodePath.resolve(import.meta.dirname, "../..");
  test("stream plans (B-166): every header in docs/plans validates against the repository", () => {
    const results = checkStreamPlans(repoRoot);
    eq(results.length >= 2, true, "the two first instances (fast-library-load, parallel-streams) carry headers");
    const rendered = results.flatMap((r) => r.findings.map((f) => `${r.file}: ${f}`)).join("; ");
    eq(rendered, "", "stream-plan findings");
    // The template is listed but never checked: its values are placeholders.
    eq(streamPlans(repoRoot).some((p) => p.header.template === "true"), true, "the template carries template: true");
  });
  test("stream plans (B-166): a known-bad header is refused, field by field", () => {
    const ctx = loadStreamPlanContext(repoRoot);
    const bad = parseFrontMatter([
      "---",
      "type: stream-plan",
      "status: running",
      "backlog: B-999999",
      "lane: Z",
      "merge: auto",
      "oracle:",
      "  - npm run no-such-script",
      "chunks: [S1, S1]",
      "reserves: [B-162, B-999998]",
      "extra: field",
      "---",
      "# body",
    ].join("\n"));
    eq(bad.errors.length, 0, "syntax is fine; the content is not");
    const findings = checkStreamPlan(bad.header!, ctx);
    const expect = ["status running", "B-999999 has no entry", "lane Z", "merge auto", "no npm script no-such-script", "duplicate chunk S1", "B-999998 has no entry", "unknown field: extra"];
    for (const e of expect) eq(findings.some((f) => f.includes(e)), true, `refuses: ${e} — got ${findings.join(" | ")}`);
    eq(findings.length, expect.length, `exactly these findings: ${findings.join(" | ")}`);
    // A missing field and a syntax error are findings too.
    const missing = parseFrontMatter("---\ntype: stream-plan\nstatus: active\n---\n");
    eq(checkStreamPlan(missing.header!, ctx).filter((f) => f.startsWith("missing field")).length, 6, "six required fields missing");
    const unclosed = parseFrontMatter("---\ntype: stream-plan\n");
    eq(unclosed.errors.some((e) => e.includes("never closed")), true, "unclosed front matter is a finding");
    const noHeader = parseFrontMatter("# A plan without front matter\n");
    eq(noHeader.header, null, "a plan without front matter is not a stream plan");
  });

  // --- The lane manifest and its check (B-163) ---
  test("lane lint (B-163): the manifest agrees with the lane table and the stream plans", () => {
    eq(checkManifest(repoRoot).join("; "), "", "manifest findings");
    const manifest = loadManifest(repoRoot);
    eq(manifest.shared.includes("docs/CHANGELOG.md") && manifest.shared.includes("docs/backlog.md"), true, "the status documents are shared");
    eq(manifest.lanes.S !== undefined && manifest.lanes.P !== undefined, true, "the two streamed lanes have entries");
  });
  test("lane lint (B-163): globs match segments the way the manifest's note says", () => {
    eq(globToRegExp("src/grammar2/**").test("src/grammar2/engine.ts"), true);
    eq(globToRegExp("src/grammar2/**").test("src/grammar2/deep/x.ts"), true);
    eq(globToRegExp("src/*.ts").test("src/evaluator.ts"), true);
    eq(globToRegExp("src/*.ts").test("src/test/base.ts"), false, "one star stops at a slash");
    eq(globToRegExp("docs/**").test("docs/CHANGELOG.md"), true);
    eq(globToRegExp("src/test/grammar2-*.ts").test("src/test/grammar2-engine.ts"), true);
    eq(globToRegExp("src/test/grammar2-*.ts").test("src/test/modules.ts"), false);
    eq(globToRegExp("CLAUDE.md").test("docs/CLAUDE.md"), false, "a literal is anchored");
  });
  test("lane lint (B-163): a known-bad file list is refused; shared documents and the plan are not", () => {
    const manifest = loadManifest(repoRoot);
    eq(backlogIdOf("B-163: the lane manifest and its check (the pre-stream arc, S4)"), "B-163");
    eq(backlogIdOf("docs: fix a typo"), null, "no id, unstreamed");
    const decl = declaredLane(repoRoot, "B-163");
    eq(decl?.lane, "S", "B-163 is reserved by the pre-stream arc, lane S");
    eq(decl?.plan, "docs/plans/parallel-streams.md");
    eq(declaredLane(repoRoot, "B-999999"), null, "an unreserved id declares no lane");
    const findings = checkFiles(
      ["docs/CHANGELOG.md", "docs/plans/parallel-streams.md", "scripts/analyze/lanes.json", "src/evaluator.ts", "lib/planning.alg"],
      decl!, manifest,
    );
    eq(findings.map((f) => f.file).join(","), "src/evaluator.ts,lib/planning.alg", `exactly the two files outside lane S: ${findings.map((f) => `${f.file} ${f.reason}`).join(" | ")}`);
    // A boundary narrows the lane and never widens it: a plan in lane S
    // declaring `src/**` still cannot touch the evaluator.
    const widened = { lane: "S", plan: "docs/plans/parallel-streams.md", backlog: "B-163", boundary: ["src/**", "docs/**"] };
    const w = checkFiles(["src/evaluator.ts", "docs/book/units.md", "docs/plans/fast-library-load.md"], widened, manifest);
    eq(w.map((f) => `${f.file}: ${f.reason}`).join("; "), "src/evaluator.ts: outside lane S (the pre-stream arc)", "the lane bounds the boundary");
    // And a boundary narrower than the lane refuses a lane file outside it.
    const narrowed = { lane: "S", plan: "docs/plans/parallel-streams.md", backlog: "B-163", boundary: ["docs/plans/**"] };
    eq(checkFiles(["docs/book/units.md"], narrowed, manifest)[0]?.reason, "outside the boundary of docs/plans/parallel-streams.md");
    // Without a plan boundary the lane's own globs apply.
    const bare = { lane: "P", plan: "", backlog: "", boundary: null };
    eq(checkFiles(["src/grammar2/engine.ts", "bench/load.ts", "docs/backlog.md"], bare, manifest).length, 0, "lane P's files pass");
    eq(checkFiles(["web/index.html"], bare, manifest).length, 1, "a lane-C file is outside lane P");
    eq(checkFiles(["x.ts"], { lane: "Z", plan: "", backlog: "", boundary: null }, manifest)[0]?.reason.includes("not in scripts/analyze/lanes.json"), true, "an unknown lane refuses every file");
  });
}

/** B-128(a): the storage plane is reached only through the accessor layer.
 *
 *  Spawned rather than imported: the check builds a TypeScript Program via
 *  `ts-compiler`, which the suite has no other reason to load. SKIPPED when
 *  sharded — it inspects the whole program, so running it once per shard
 *  would cost three Program builds for one answer, and
 *  `scripts/test-shards.mjs` runs it once after the shards instead. */
export function runPlaneLintTests(): void {
  if (SHARD !== null) return;
  test("plane lint (B-128a): storage reached only through the accessor layer", () => {
    let out = "";
    let failed = false;
    try {
      out = execFileSync("npx", ["tsx", "scripts/analyze/plane-lint.ts"], {
        cwd: path.resolve(import.meta.dirname, "../.."),
        encoding: "utf8",
      });
    } catch (e) {
      failed = true;
      out = String((e as { stdout?: string }).stdout ?? e);
    }
    eq(failed ? out.trim() : "", "", "plane-lint violations");
  });
}

/** B-149: the unit DAG (docs/book/units.md) holds at its committed
 *  baseline — no new edge the DAG forbids, no new mixed file, no rise in
 *  kind comparisons outside the allowed units, no file without a unit.
 *  Spawned and sharding-skipped for the same reasons as the plane lint;
 *  `scripts/test-shards.mjs` runs it once after the shards. */
export function runUnitsLintTests(): void {
  if (SHARD !== null) return;
  test("units lint (B-149): the unit DAG holds at its baseline", () => {
    let out = "";
    let failed = false;
    try {
      out = execFileSync("npx", ["tsx", "scripts/analyze/index.ts", "units", "--check"], {
        cwd: path.resolve(import.meta.dirname, "../.."),
        encoding: "utf8",
      });
    } catch (e) {
      failed = true;
      out = String((e as { stdout?: string }).stdout ?? e);
    }
    eq(failed ? out.trim() : "", "", "units-lint violations");
  });
}

/** B-157 P1: the load ratchet — the engine's deterministic parse counts
 *  over the load corpus (`bench/load.ts --check`) stay at or below
 *  `bench/load-baseline.json`. Spawned and sharding-skipped for the same
 *  reasons as the plane lint; `scripts/test-shards.mjs` runs it once after
 *  the shards. */
export function runLoadLintTests(): void {
  if (SHARD !== null) return;
  test("load lint (B-157 P1): parse counts at or below the load baseline", () => {
    let out = "";
    let failed = false;
    try {
      out = execFileSync("npx", ["tsx", "bench/load.ts", "--check"], {
        cwd: path.resolve(import.meta.dirname, "../.."),
        encoding: "utf8",
      });
    } catch (e) {
      failed = true;
      out = String((e as { stdout?: string }).stdout ?? e);
    }
    eq(failed ? out.trim() : "", "", "load-lint violations");
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

