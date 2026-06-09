// PCP benchmark runner — CLI entry point.
//
//   npx tsx bench/run.ts                 # auto-PE + reference baselines
//   npx tsx bench/run.ts --llm           # also run the Claude worker
//   npx tsx bench/run.ts --llm --model claude-opus-4-8
//   npx tsx bench/run.ts --json          # machine-readable report
//   npx tsx bench/run.ts --only t05,t08  # subset of obligations
//
// Exit code is 0 when the corpus is healthy (every reference proof
// discharges and every soundness gate holds), 1 otherwise. The LLM
// baseline never affects the exit code — a prover failing to converge is
// a measurement, not a corpus fault.

import { runBenchmark, type BenchReport, type RunOptions } from "./harness.js";

function parseArgs(argv: string[]): { opts: RunOptions; json: boolean; model?: string } {
  const json = argv.includes("--json");
  const llm = argv.includes("--llm");
  const maxIdx = argv.indexOf("--max-attempts");
  const maxAttempts = maxIdx >= 0 ? Number(argv[maxIdx + 1]) : undefined;
  const modelIdx = argv.indexOf("--model");
  const model = modelIdx >= 0 ? argv[modelIdx + 1] : undefined;
  const onlyIdx = argv.indexOf("--only");
  const only = onlyIdx >= 0 ? argv[onlyIdx + 1]?.split(",").map(s => s.trim()) : undefined;
  return { opts: { llm, maxAttempts, only }, json, model };
}

function mark(b: boolean): string { return b ? "✓" : "✗"; }
function pad(s: string, n: number): string { return s.length >= n ? s : s + " ".repeat(n - s.length); }

function renderReport(report: BenchReport, llmRequested: boolean): string {
  const lines: string[] = [];
  lines.push("PCP benchmark — provability arc baselines");
  lines.push("=".repeat(72));
  lines.push("");
  // Column legend.
  lines.push("  ref    = curated reference proof discharges (corpus validity)");
  lines.push("  autoPE = bare proposition discharges with no prover");
  lines.push("  gate   = wrong sentinel term is rejected (· = no by slot)");
  if (report.totals.llmRan) {
    lines.push("  llm    = Claude worker converged (attempts) (· = not run)");
  }
  lines.push("");

  const header =
    "  " + pad("id", 5) + pad("category", 15) + pad("ref", 6) +
    pad("autoPE", 9) + pad("gate", 7) +
    (report.totals.llmRan ? pad("llm", 14) : "") + "description";
  lines.push(header);
  lines.push("  " + "-".repeat(70));

  for (const r of report.results) {
    let llmCell = "";
    if (report.totals.llmRan) {
      if (r.llm === null) {
        llmCell = pad("·", 14);
      } else if (r.llm.error) {
        llmCell = pad("err", 14);
      } else {
        llmCell = pad(`${mark(r.llm.discharged)} (${r.llm.attempts})`, 14);
      }
    }
    const gateCell = r.gateRejectsWrong === null ? "·" : mark(r.gateRejectsWrong);
    lines.push(
      "  " + pad(r.id, 5) + pad(r.category, 15) +
      pad(mark(r.referenceDischarged), 6) +
      pad(mark(r.autoPeBareDischarged), 9) +
      pad(gateCell, 7) +
      llmCell + r.description,
    );
  }

  lines.push("");
  const t = report.totals;
  lines.push("Totals");
  lines.push("  " + "-".repeat(70));
  lines.push(`  reference discharged : ${t.referencePassed}/${t.entries}  (corpus validity)`);
  lines.push(`  auto-PE discharged   : ${t.autoPePassed}/${t.entries}  (kernel free coverage)`);
  lines.push(`  soundness gates held : ${t.gateRejectedWrong}/${t.gatedEntries}  (wrong terms rejected)`);
  if (t.llmRan) {
    lines.push(`  LLM converged        : ${t.llmDischarged}/${t.llmAttempted}  (gated obligations)`);
  } else if (llmRequested) {
    lines.push("  LLM baseline         : requested but not run (no client / API key)");
  }
  lines.push("");

  // Interpretation note — the headline finding.
  lines.push("Reading: auto-PE discharges every closed proposition for free;");
  lines.push("the prover's measurable work is on the soundness-gated `by` terms");
  lines.push("(the `gate`/`llm` columns), which is exactly the `allegro prove` loop.");

  return lines.join("\n");
}

async function main() {
  const argv = process.argv.slice(2);
  const { opts, json, model } = parseArgs(argv);

  // Build the LLM client lazily, only when --llm is set.
  if (opts.llm && !opts.client) {
    try {
      const { createAnthropicClient } = await import("../pcp/llm-worker.js");
      opts.client = await createAnthropicClient({ model });
    } catch (e: any) {
      if (json) {
        // Keep JSON clean: emit the report without the LLM baseline.
        opts.llm = false;
      } else {
        console.error(`note: --llm requested but client unavailable (${e.message}); running deterministic baselines only.`);
        opts.llm = false;
      }
    }
  }

  const report = await runBenchmark(opts);

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(renderReport(report, argv.includes("--llm")));
  }

  // Corpus health gates the exit code; the LLM measurement does not.
  const t = report.totals;
  const corpusHealthy =
    t.referencePassed === t.entries && t.gateRejectedWrong === t.gatedEntries;
  process.exit(corpusHealthy ? 0 : 1);
}

main().catch(e => {
  console.error(e?.stack ?? e?.message ?? String(e));
  process.exit(1);
});
