// =============================================================================
// Proof Collaboration Protocol (H1-H4) + introspection (Phase A).
//
// Extracted from the single-file suite (suite split, lane B). Registrations
// run at import time; src/test/index.ts imports this module in suite order.
// =============================================================================

import { test, asyncTest, eq, throws } from "./harness.js";
import { evalStd, typeExt } from "./fixtures.js";
import { evalSource as runtimeEval, Extension } from "../runtime.js";
import { Value, ValueKind, BitsValue, StructureValue, dataOf, bitsToString, makeInt } from "../types.js";
import { formatValue } from "../primitives.js";
import { spawnSync } from "child_process";
import { generateHints, IterationHints } from "../pcp.js";
import { formatTodo, TodoSection } from "../pcp.js";
import {
  PCP_VERSION,
  Obligation, Verdict, Authorship,
  makeObligation, makeAuthorship, AUTO_PE_AUTHORSHIP,
  hashProposition,
  serializeObligation, parseObligation,
  serializeVerdict,    parseVerdict,
  serializeAuthorship, parseAuthorship,
  formatObligation, formatVerdict, formatAuthorship,
} from "../pcp.js";
import {
  buildVerdict, extractObligations, checkObligationSatisfied,
} from "../pcp.js";
import {
  extractCodeBlocks, spliceProof, buildIterationMessage,
  classifyStrategy, loadPrimer, runLlmWorker, LlmClient,
} from "../../pcp/llm-worker.js";
import { testsDir } from "./alg-files.js";
import { primitives as primRegistry } from "../primitives.js";
import {
  summarizeValue, summarizeModule, safetyGradeFor, renderModuleSummary,
} from "../introspect.js";
import * as fs from "fs";
import * as path from "path";

// --- Phase H1: Proof Collaboration Protocol — JSON formats ---
//
// Three canonical schemas (Obligation, Verdict, Authorship). JSON is
// the wire format; basic plain-text renderers are also exercised.


test("Phase H1: hashProposition is whitespace-insensitive and deterministic", () => {
  const a = hashProposition("abs(0) == 0");
  const b = hashProposition("abs(0)   ==   0");   // extra spaces
  const c = hashProposition(" abs(0) == 0\n");   // leading + trailing
  const d = hashProposition("abs(0) == 1");      // genuinely different
  eq(a, b);
  eq(a, c);
  eq(a !== d, true);
  eq(/^[0-9a-f]+$/.test(a), true, "hash is hex");
});

test("Phase H1: Obligation round-trips through JSON", () => {
  const o: Obligation = makeObligation({
    theoremName: "abs_idem_13",
    proposition: "abs(abs(13)) == abs(13)",
    function:    {
      name: "abs", signature: "(x: Int): Int",
      paramTypes: ["Int"], returnType: "Int",
    },
    imports: ["provable"],
    lemmas:  ["abs_zero", "abs_pos"],
  });
  const wire = serializeObligation(o);
  const back = parseObligation(wire);
  // Re-serialize and assert byte-identical (canonical round-trip).
  eq(serializeObligation(back), wire);
  eq(back.theorem.name, "abs_idem_13");
  eq(back.theorem.propositionHash.length > 0, true);
  eq(back.function?.name, "abs");
  eq(back.context.lemmas.length, 2);
});

test("Phase H1: Obligation rejects wrong version", () => {
  const malformed = `{"version":"pcp/9","theorem":{"name":"t","proposition":"x","propositionHash":"0"},"context":{"imports":[],"lemmas":[]}}`;
  throws(() => parseObligation(malformed), "unsupported version");
});

test("Phase H1: Obligation validates required fields", () => {
  // Missing context entirely.
  throws(() => parseObligation(`{"version":"pcp/1","theorem":{"name":"t","proposition":"x","propositionHash":"0"}}`),
    "context missing");
});

test("Phase H1: Verdict round-trips", () => {
  const v: Verdict = {
    version: PCP_VERSION,
    verified: false,
    theorems: [
      {
        name: "abs_zero",
        proposition: "abs(0) == 0",
        status: "discharged",
        authorship: AUTO_PE_AUTHORSHIP(),
      },
      {
        name: "bad",
        proposition: "1 == 2",
        status: "failed",
        failure: {
          kind: "proof-failure",
          reason: "proposition is false",
          counterexample: "`1 == 2` evaluates to false",
        },
      },
    ],
    totalityFindings: [
      { binding: "loop", kind: "totality-nontermination",
        message: "loops on n", counterexample: "loop(n) → loop(n)" },
    ],
  };
  const wire = serializeVerdict(v);
  const back = parseVerdict(wire);
  eq(back.verified, false);
  eq(back.theorems.length, 2);
  eq(back.theorems[0].status, "discharged");
  eq(back.theorems[1].failure?.counterexample?.includes("evaluates to false"), true);
  eq(back.totalityFindings?.[0].binding, "loop");
  eq(serializeVerdict(back), wire);
});

test("Phase H1: Verdict rejects malformed status", () => {
  const bad = `{"version":"pcp/1","verified":false,"theorems":[{"name":"t","proposition":"x","status":"bogus"}]}`;
  throws(() => parseVerdict(bad), "status must be");
});

test("Phase H1: Authorship round-trips with single prover", () => {
  const a: Authorship = makeAuthorship({
    prover: "claude-opus-4-7",
    proverVersion: "2026-05",
    attemptsUsed: 3,
    effortBudgetUsed: { tokens: 1500, attempts: 3 },
    role: "primary",
    verifiedAt: "2026-05-20T12:00:00.000Z",
  });
  const wire = serializeAuthorship(a);
  const back = parseAuthorship(wire);
  eq(serializeAuthorship(back), wire);
  eq(back.provers[0].prover, "claude-opus-4-7");
  eq(back.provers[0].attemptsUsed, 3);
  eq(back.provers[0].effortBudgetUsed?.tokens, 1500);
});

test("Phase H1: Authorship supports multiple provers (hybrid workflows)", () => {
  const a: Authorship = {
    provers: [
      { prover: "claude-opus-4-7", role: "primary",    attemptsUsed: 2 },
      { prover: "user:alice",      role: "review" },
    ],
    verifiedAt: "2026-05-20T12:00:00.000Z",
  };
  const wire = serializeAuthorship(a);
  const back = parseAuthorship(wire);
  eq(back.provers.length, 2);
  eq(back.provers[0].role, "primary");
  eq(back.provers[1].role, "review");
});

test("Phase H1: Authorship rejects empty prover list", () => {
  const bad = `{"provers":[],"verifiedAt":"2026-05-20T12:00:00Z"}`;
  throws(() => parseAuthorship(bad), "non-empty array");
});

test("Phase H1: AUTO_PE_AUTHORSHIP yields valid round-trippable record", () => {
  const a = AUTO_PE_AUTHORSHIP();
  const wire = serializeAuthorship(a);
  const back = parseAuthorship(wire);
  eq(back.provers[0].prover, "auto-PE");
  eq(typeof back.verifiedAt, "string");
});

test("Phase H1: formatObligation produces a readable summary", () => {
  const o = makeObligation({
    theoremName: "abs_idem_13",
    proposition: "abs(abs(13)) == abs(13)",
    function: { name: "abs", signature: "(x: Int): Int", paramTypes: ["Int"], returnType: "Int" },
    imports: ["provable"],
    lemmas:  ["abs_zero"],
  });
  const text = formatObligation(o);
  eq(text.includes("abs_idem_13"), true);
  eq(text.includes("abs(abs(13))"), true);
  eq(text.includes("provable"), true);
  eq(text.includes("abs_zero"), true);
});

test("Phase H1: formatVerdict surfaces success ratio + counterexamples", () => {
  const v: Verdict = {
    version: PCP_VERSION,
    verified: false,
    theorems: [
      { name: "good", proposition: "1 == 1", status: "discharged", authorship: AUTO_PE_AUTHORSHIP() },
      { name: "bad",  proposition: "1 == 2", status: "failed",
        failure: { kind: "proof-failure", reason: "evaluates false", counterexample: "1 ≠ 2" } },
    ],
  };
  const text = formatVerdict(v);
  eq(text.includes("1/2 discharged"), true);
  eq(text.includes("✓ good"), true);
  eq(text.includes("✗ bad"), true);
  eq(text.includes("evaluates false"), true);
  eq(text.includes("counterexample: 1 ≠ 2"), true);
});

test("Phase H1: formatAuthorship lists ordered contributors with effort", () => {
  const a = makeAuthorship({
    prover: "claude-opus-4-7", proverVersion: "2026-05",
    attemptsUsed: 4, effortBudgetUsed: { tokens: 2200 },
  });
  const text = formatAuthorship(a);
  eq(text.includes("claude-opus-4-7"), true);
  eq(text.includes("@2026-05"), true);
  eq(text.includes("4 attempts"), true);
  eq(text.includes("2200 tokens"), true);
});

// --- Phase H2: verify / obligations CLI helpers ---
//
// We test the conversion helpers (buildVerdict, extractObligations,
// checkObligationSatisfied) directly. The CLI subcommands are also
// smoke-tested via child_process to confirm the wiring.


test("Phase H2: buildVerdict captures discharged + failed theorems from soft-fail eval", () => {
  // Mix of passing + failing top-level theorems, evaluated with softFail.
  const src = `theorem ok: 3 + 5 == 8\ntheorem bad: 1 == 2\n`;
  const result = runtimeEval(src, undefined, [typeExt], undefined, true,
                             undefined, /*softFail*/ true);
  const verdict = buildVerdict(result.evalCtx, result.compilationReport);
  eq(verdict.verified, false);
  const names = verdict.theorems.map(t => t.name).sort();
  eq(names.includes("ok"), true);
  eq(names.includes("bad"), true);
  const ok = verdict.theorems.find(t => t.name === "ok");
  eq(ok?.status, "discharged");
  eq(ok?.authorship?.provers[0].prover, "auto-PE");
  const bad = verdict.theorems.find(t => t.name === "bad");
  eq(bad?.status, "failed");
  eq(bad?.failure?.kind, "proof-failure");
});

test("Phase H2: buildVerdict surfaces anonymous verify failures", () => {
  // `verify P` is a bare expr — failures appear as proof-failure
  // notifications rather than bindings. buildVerdict must still find them.
  const src = `verify 1 == 2\n`;
  const result = runtimeEval(src, undefined, [typeExt], undefined, true,
                             undefined, /*softFail*/ true);
  const verdict = buildVerdict(result.evalCtx, result.compilationReport);
  eq(verdict.verified, false);
  const v = verdict.theorems.find(t => t.name === "<verify>");
  eq(v !== undefined, true);
  eq(v?.status, "failed");
});

test("Phase H2: buildVerdict returns verified=true on a clean module", () => {
  const src = `theorem t: 3 + 4 == 7\n`;
  const result = runtimeEval(src, undefined, [typeExt], undefined, true,
                             undefined, /*softFail*/ true);
  const verdict = buildVerdict(result.evalCtx, result.compilationReport);
  eq(verdict.verified, true);
  eq(verdict.theorems.length, 1);
});

test("Phase H2: extractObligations enumerates every theorem by default", () => {
  const src = `theorem a: 1 == 1\ntheorem b: 1 == 2\n`;
  const result = runtimeEval(src, undefined, [typeExt], undefined, true,
                             undefined, /*softFail*/ true);
  const obligations = extractObligations(result.evalCtx, result.compilationReport);
  const names = obligations.map(o => o.theorem.name).sort();
  eq(names.length >= 2, true);
  eq(names.includes("a"), true);
  eq(names.includes("b"), true);
});

test("Phase H2: extractObligations --pending omits discharged proofs", () => {
  const src = `theorem a: 1 == 1\ntheorem b: 1 == 2\n`;
  const result = runtimeEval(src, undefined, [typeExt], undefined, true,
                             undefined, /*softFail*/ true);
  const pending = extractObligations(result.evalCtx, result.compilationReport,
                                     { pendingOnly: true });
  const names = pending.map(o => o.theorem.name).sort();
  eq(names.includes("a"), false, "discharged `a` should be omitted");
  eq(names.includes("b"), true);
});

test("Phase H2: extractObligations populates lemma list for the prover", () => {
  const src = `theorem a: 1 == 1\ntheorem b: 2 == 2\ntheorem c: 1 == 2\n`;
  const result = runtimeEval(src, undefined, [typeExt], undefined, true,
                             undefined, /*softFail*/ true);
  const oblig = extractObligations(result.evalCtx, result.compilationReport);
  const cOb = oblig.find(o => o.theorem.name === "c");
  // c is failed; lemmas should include the two discharged theorems.
  eq(cOb?.context.lemmas.includes("a"), true);
  eq(cOb?.context.lemmas.includes("b"), true);
  eq(cOb?.context.lemmas.includes("c"), false, "self-exclude");
});

test("Phase H2: checkObligationSatisfied — match", () => {
  const obligation = makeObligation({
    theoremName: "t",
    proposition: "3 + 5 == 8",
  });
  const verdict: Verdict = {
    version: PCP_VERSION,
    verified: true,
    theorems: [{
      name: "t",
      proposition: "3 + 5 == 8",
      status: "discharged",
      authorship: AUTO_PE_AUTHORSHIP(),
    }],
  };
  eq(checkObligationSatisfied(obligation, verdict), null);
});

test("Phase H2: checkObligationSatisfied — missing theorem", () => {
  const obligation = makeObligation({ theoremName: "t", proposition: "x" });
  const verdict: Verdict = { version: PCP_VERSION, verified: true, theorems: [] };
  const err = checkObligationSatisfied(obligation, verdict);
  eq(err !== null && err.includes("not present"), true);
});

test("Phase H2: checkObligationSatisfied — proposition mismatch (different fact)", () => {
  const obligation = makeObligation({ theoremName: "t", proposition: "3 + 5 == 8" });
  const verdict: Verdict = {
    version: PCP_VERSION,
    verified: true,
    theorems: [{
      name: "t",
      proposition: "1 == 1",       // different proposition — trivial-pass attack
      status: "discharged",
      authorship: AUTO_PE_AUTHORSHIP(),
    }],
  };
  const err = checkObligationSatisfied(obligation, verdict);
  eq(err !== null && err.includes("different proposition"), true);
});

test("Phase H2: checkObligationSatisfied — theorem not discharged", () => {
  const obligation = makeObligation({ theoremName: "t", proposition: "1 == 2" });
  const verdict: Verdict = {
    version: PCP_VERSION,
    verified: false,
    theorems: [{
      name: "t",
      proposition: "1 == 2",
      status: "failed",
      failure: { kind: "proof-failure", reason: "false" },
    }],
  };
  const err = checkObligationSatisfied(obligation, verdict);
  eq(err !== null && err.includes("is failed"), true);
});

test("Phase H2: CLI `verify` exits 0 on success, 1 on failure", () => {
  const okFile  = path.join(testsDir, "proofs-demo.alg");
  const failTmp = path.join("/tmp", `pcp-fail-${Date.now()}.alg`);
  fs.writeFileSync(failTmp, "verify 1 == 2\n");
  try {
    const ok = spawnSync("npx", ["tsx", "src/index.ts", "verify", okFile, "--json"],
                         { encoding: "utf-8" });
    eq(ok.status, 0, `verify on passing file should exit 0, got ${ok.status}: ${ok.stderr}`);
    const fail = spawnSync("npx", ["tsx", "src/index.ts", "verify", failTmp, "--json"],
                           { encoding: "utf-8" });
    eq(fail.status, 1, `verify on failing file should exit 1, got ${fail.status}`);
    // JSON parses (no extra text on stdout).
    const v = JSON.parse(fail.stdout.trim());
    eq(v.verified, false);
  } finally {
    fs.unlinkSync(failTmp);
  }
});

test("Phase H2: CLI `obligations --json` emits one JSON per theorem", () => {
  const r = spawnSync("npx", ["tsx", "src/index.ts", "obligations",
                              path.join(testsDir, "proofs-demo.alg"), "--json"],
                      { encoding: "utf-8" });
  eq(r.status, 0);
  // Each line is one JSON object.
  const lines = r.stdout.trim().split("\n").filter(l => l.length > 0);
  eq(lines.length >= 2, true);
  for (const line of lines) {
    const o = JSON.parse(line);
    eq(o.version, PCP_VERSION);
    eq(typeof o.theorem.name, "string");
  }
});

// --- Phase H3: iteration hints ---
//
// Compiler-side, transparent heuristics that nudge the prover past
// common pitfalls. The Verdict carries them in `iterationHints`.
// generateHints also folds in `strategiesUsed` from prior attempts.


test("Phase H3: false-proposition failure gets a 'revise theorem' hint", () => {
  const src = `theorem bad: 5 == 6\n`;
  const result = runtimeEval(src, undefined, [typeExt], undefined, true,
                             undefined, /*softFail*/ true);
  const verdict = buildVerdict(result.evalCtx, result.compilationReport);
  const hints = verdict.iterationHints!;
  eq(hints !== undefined, true);
  const sug = hints.suggestions.find(s => s.theoremName === "bad");
  eq(sug !== undefined, true);
  eq(sug!.message.includes("revise the theorem"), true);
});

test("Phase H3: PE-residual failure suggests a combinator", () => {
  const src = `theorem t: unknown_var > 0\n`;
  const result = runtimeEval(src, undefined, [typeExt], undefined, true,
                             undefined, /*softFail*/ true);
  const verdict = buildVerdict(result.evalCtx, result.compilationReport);
  const sug = verdict.iterationHints!.suggestions.find(s => s.theoremName === "t");
  eq(sug !== undefined, true);
  eq(sug!.message.includes("combinator"), true);
  eq(sug!.suggestedConstruct, "proof_trans");
});

test("Phase H3: proof_trans middle-term mismatch hint suggests tactics.chain", () => {
  const src = `theorem ab: 1 + 1 == 2
theorem cd: 5 == 5
theorem bad: 1 + 1 == 9 by proof_trans(ab, cd)
`;
  const result = runtimeEval(src, undefined, [typeExt], undefined, true,
                             undefined, /*softFail*/ true);
  const verdict = buildVerdict(result.evalCtx, result.compilationReport);
  const sug = verdict.iterationHints!.suggestions.find(s => s.theoremName === "bad");
  eq(sug !== undefined, true);
  eq(sug!.message.includes("intermediate term"), true);
  eq(sug!.suggestedConstruct, "tactics.chain");
});

test("Phase H3: wrong proof term (different equality) is flagged", () => {
  const src = `theorem bad: 1 == 2 by proof_refl(5)\n`;
  const result = runtimeEval(src, undefined, [typeExt], undefined, true,
                             undefined, /*softFail*/ true);
  const verdict = buildVerdict(result.evalCtx, result.compilationReport);
  const sug = verdict.iterationHints!.suggestions.find(s => s.theoremName === "bad");
  eq(sug !== undefined, true);
  eq(sug!.message.includes("different fact"), true);
});

test("Phase H3: clean module produces no iteration hints", () => {
  const src = `theorem t: 3 + 4 == 7\n`;
  const result = runtimeEval(src, undefined, [typeExt], undefined, true,
                             undefined, /*softFail*/ true);
  const verdict = buildVerdict(result.evalCtx, result.compilationReport);
  // No failures → no suggestions; hints field is omitted (undefined).
  eq(verdict.iterationHints, undefined);
});

test("Phase H3: obligation context surfaces a global lemma reminder", () => {
  const src = `theorem a: 1 == 1\ntheorem b: 2 == 2\ntheorem c: 3 == 4\n`;
  const result = runtimeEval(src, undefined, [typeExt], undefined, true,
                             undefined, /*softFail*/ true);
  // Synthesise an obligation that lists a + b as available lemmas.
  const obligation = makeObligation({
    theoremName: "c",
    proposition: "3 == 4",
    lemmas: ["a", "b"],
  });
  const verdict = buildVerdict(result.evalCtx, result.compilationReport, obligation);
  const global = verdict.iterationHints!.suggestions.find(
    s => s.theoremName === "<global>",
  );
  eq(global !== undefined, true);
  eq(global!.message.includes("2 lemma(s)"), true);
  eq(global!.message.includes("a, b"), true);
});

test("Phase H3: strategiesTried aggregates across priorAttempts", () => {
  const obligation = makeObligation({
    theoremName: "t",
    proposition: "x",
    priorAttempts: [
      {
        attemptNumber: 1, candidate: "",
        verdict: { version: PCP_VERSION, verified: false, theorems: [] },
        strategiesUsed: ["proof_by_eval", "proof_refl"],
      },
      {
        attemptNumber: 2, candidate: "",
        verdict: { version: PCP_VERSION, verified: false, theorems: [] },
        strategiesUsed: ["proof_trans", "proof_by_eval"], // proof_by_eval dedupes
      },
    ],
  });
  const verdict: Verdict = {
    version: PCP_VERSION,
    verified: false,
    theorems: [{
      name: "t", proposition: "x", status: "failed",
      failure: { kind: "proof-failure", reason: "did not reduce to a constant Bool" },
    }],
  };
  const hints = generateHints(verdict.theorems, undefined, obligation);
  eq(JSON.stringify(hints.strategiesTried),
     JSON.stringify(["proof_by_eval", "proof_refl", "proof_trans"]));
});

test("Phase H3: PriorAttempt.strategiesUsed round-trips through JSON", () => {
  const obligation = makeObligation({
    theoremName: "t", proposition: "x",
    priorAttempts: [{
      attemptNumber: 1, candidate: "verify x",
      verdict: { version: PCP_VERSION, verified: false, theorems: [] },
      strategiesUsed: ["proof_by_eval", "tactics.chain"],
    }],
  });
  const wire = serializeObligation(obligation);
  const back = parseObligation(wire);
  eq(JSON.stringify(back.priorAttempts?.[0].strategiesUsed),
     JSON.stringify(["proof_by_eval", "tactics.chain"]));
});

test("Phase H3: formatVerdict renders hints section", () => {
  const src = `theorem t: 1 == 2\n`;
  const result = runtimeEval(src, undefined, [typeExt], undefined, true,
                             undefined, /*softFail*/ true);
  const verdict = buildVerdict(result.evalCtx, result.compilationReport);
  const text = formatVerdict(verdict);
  eq(text.includes("hints:"), true);
  eq(text.includes("[t]"), true);
});

// --- Phase H4b: human-interactive worker (propose / TODO Markdown) ---
//
// `formatTodo` produces a human-readable Markdown work-list of pending
// obligations + hints. `allegro propose` CLI uses it; tests cover both
// the formatter and the CLI smoke path.


test("Phase H4b: formatTodo on a clean file says 'nothing pending'", () => {
  const md = formatTodo({ filename: "x.alg", totalObligations: 3, sections: [] });
  eq(md.includes("All 3 obligation(s) discharged"), true);
  eq(md.includes("Nothing pending"), true);
});

test("Phase H4b: formatTodo renders each pending section with proposition + hints", () => {
  const ob = makeObligation({
    theoremName: "bad", proposition: "5 == 6",
    function: { name: "f", signature: "(x: Int): Int", paramTypes: ["Int"], returnType: "Int" },
    lemmas: ["lemma_a", "lemma_b"],
  });
  const md = formatTodo({
    filename: "x.alg",
    totalObligations: 1,
    sections: [{
      obligation: ob,
      hints: [
        { theoremName: "bad",
          message: "revise the theorem",
          suggestedConstruct: undefined },
        { theoremName: "bad",
          message: "or try a combinator",
          suggestedConstruct: "proof_trans" },
      ],
      failure: { kind: "proof-failure",
                 reason: "proposition is false",
                 counterexample: "5 != 6" },
    }],
  });
  eq(md.includes("# Proof TODO"), true);
  eq(md.includes("1 pending"), true);
  eq(md.includes("## `bad`"), true);
  eq(md.includes("```allegro\n5 == 6\n```"), true);
  eq(md.includes("**Function:** `f (x: Int): Int`"), true);
  eq(md.includes("revise the theorem"), true);
  // Suggested construct rendered as italic-code aside.
  eq(md.includes("*(try `proof_trans`)*"), true);
  eq(md.includes("**Lemmas in scope:** `lemma_a`, `lemma_b`"), true);
  eq(md.includes("counterexample: `5 != 6`"), true);
});

test("Phase H4b: formatTodo truncates long lemma lists", () => {
  const lemmas = ["l1","l2","l3","l4","l5","l6","l7","l8","l9","l10"];
  const ob = makeObligation({ theoremName: "t", proposition: "x", lemmas });
  const md = formatTodo({
    filename: "x.alg", totalObligations: 1,
    sections: [{ obligation: ob }],
  });
  // Top-8 shown + "+2 more" annotation.
  eq(md.includes("l8"), true);
  eq(md.includes("+2 more"), true);
});

test("Phase H4b: CLI `propose` exits 0 and writes Markdown for a failing file", () => {
  const failTmp = path.join("/tmp", `pcp-todo-${Date.now()}.alg`);
  fs.writeFileSync(failTmp, "theorem t: 5 == 6\n");
  try {
    const r = spawnSync("npx", ["tsx", "src/index.ts", "propose", failTmp],
                        { encoding: "utf-8" });
    eq(r.status, 0, `expected exit 0, got ${r.status}: ${r.stderr}`);
    eq(r.stdout.includes("# Proof TODO"), true);
    eq(r.stdout.includes("## `t`"), true);
    eq(r.stdout.includes("5 == 6"), true);
    // The hint for "proposition is false" should appear.
    eq(r.stdout.includes("revise the theorem"), true);
  } finally {
    fs.unlinkSync(failTmp);
  }
});

test("Phase H4b: CLI `propose --output` writes to file", () => {
  const failTmp = path.join("/tmp", `pcp-todo-${Date.now()}.alg`);
  const mdTmp   = path.join("/tmp", `pcp-todo-${Date.now()}.md`);
  fs.writeFileSync(failTmp, "theorem bad: 1 == 2\n");
  try {
    const r = spawnSync("npx", ["tsx", "src/index.ts", "propose",
                                failTmp, "--output", mdTmp],
                        { encoding: "utf-8" });
    eq(r.status, 0);
    eq(fs.existsSync(mdTmp), true, "Markdown file should be written");
    const md = fs.readFileSync(mdTmp, "utf-8");
    eq(md.includes("# Proof TODO"), true);
    eq(md.includes("## `bad`"), true);
  } finally {
    fs.unlinkSync(failTmp);
    if (fs.existsSync(mdTmp)) fs.unlinkSync(mdTmp);
  }
});

// --- Phase H4a: LLM worker pure helpers ---
//
// The orchestrator (`runLlmWorker`) needs a live API key to close the
// loop end-to-end — skipped in CI. The pure helpers (code-block
// extraction, splicing, prompt construction, strategy classification)
// are tested in isolation.


test("Phase H4a: extractCodeBlocks finds ```allegro blocks", () => {
  const text = "Here is the proof.\n\n```allegro\nproof_trans(ab, bc)\n```\n\nDone.";
  const blocks = extractCodeBlocks(text);
  eq(blocks.length, 1);
  eq(blocks[0], "proof_trans(ab, bc)");
});

test("Phase H4a: extractCodeBlocks finds multiple blocks in order", () => {
  const text = "```allegro\nproof_refl(5)\n```\nbetween\n```allegro\nproof_sym(t1)\n```";
  const blocks = extractCodeBlocks(text);
  eq(blocks.length, 2);
  eq(blocks[0], "proof_refl(5)");
  eq(blocks[1], "proof_sym(t1)");
});

test("Phase H4a: extractCodeBlocks falls back to any fenced block if no allegro tag", () => {
  const text = "```\nproof_refl(5)\n```";
  const blocks = extractCodeBlocks(text);
  eq(blocks.length, 1);
  eq(blocks[0], "proof_refl(5)");
});

test("Phase H4a: extractCodeBlocks returns empty array when no blocks", () => {
  eq(extractCodeBlocks("plain text response").length, 0);
});

test("Phase H4a: spliceProof appends `by <term>` to a bare theorem", () => {
  const src = `theorem foo: 1 + 1 == 2\nx = 42\n`;
  const out = spliceProof(src, "foo", "proof_refl(2)");
  eq(out.includes("theorem foo: 1 + 1 == 2 by proof_refl(2)"), true);
  eq(out.includes("x = 42"), true);
});

test("Phase H4a: spliceProof replaces an existing `by` clause", () => {
  const src = `theorem foo: 1 + 1 == 2 by old_proof\n`;
  const out = spliceProof(src, "foo", "proof_refl(2)");
  eq(out.includes("by proof_refl(2)"), true);
  eq(out.includes("old_proof"), false);
});

test("Phase H4a: spliceProof throws when theorem not found", () => {
  const src = `theorem other: 1 == 1\n`;
  throws(() => spliceProof(src, "missing", "proof_refl(1)"),
    "could not locate `theorem missing`");
});

test("Phase H4a: buildIterationMessage includes obligation + hints + lemmas", () => {
  const msg = buildIterationMessage({
    obligationName: "ac",
    proposition:    "a == c",
    lemmas:         ["ab", "bc"],
    failureReason:  "could not be discharged by evaluation",
    failureCounterexample: "`a == c` did not reduce",
    hints: [
      { message: "try a combinator", suggestedConstruct: "proof_trans" },
    ],
    strategiesTried: ["proof_by_eval"],
    attemptNumber:   2,
  });
  eq(msg.includes("Attempt 2"), true);
  eq(msg.includes("```allegro\na == c\n```"), true);
  eq(msg.includes("ab, bc"), true);
  eq(msg.includes("could not be discharged"), true);
  eq(msg.includes("try a combinator"), true);
  eq(msg.includes("`proof_trans`"), true);
  eq(msg.includes("avoid repeating"), true);
  eq(msg.includes("proof_by_eval"), true);
  eq(msg.includes("ONE fenced"), true);
});

test("Phase H4a: classifyStrategy recognises combinators and tactics", () => {
  eq(JSON.stringify(classifyStrategy("proof_refl(5)")),                JSON.stringify(["proof_refl"]));
  eq(JSON.stringify(classifyStrategy("proof_trans(ab, bc)")),          JSON.stringify(["proof_trans"]));
  eq(JSON.stringify(classifyStrategy("tactics.chain([a, b])")),        JSON.stringify(["tactics.chain"]));
  eq(JSON.stringify(classifyStrategy("prove_for_all_bool(b => b)")),   JSON.stringify(["prove_for_all_bool"]));
  eq(JSON.stringify(classifyStrategy("proof_trans(proof_sym(x), y)")), JSON.stringify(["proof_sym", "proof_trans"]));
  eq(JSON.stringify(classifyStrategy("plain_text")),                   JSON.stringify([]));
});

test("Phase H4a: loadPrimer returns the F-arc primer doc", () => {
  const primer = loadPrimer();
  eq(primer.includes("Proving in Allegro"), true);
  eq(primer.includes("proof_by_eval"), true);
  eq(primer.includes("proof_refines"), true);
  eq(primer.includes("prove_for_all_bool"), true);
});

export async function runH4aAsyncTests(): Promise<void> {
  // The source needs a PENDING obligation for the worker to process. A
  // bare `theorem t: 1 + 1 == 2` auto-discharges via PE, leaving
  // extractObligations(pendingOnly) empty. Use a `by` clause with a
  // proof that establishes the WRONG fact (proof_refl(99) proves
  // 99 == 99, not 1 + 1 == 2), so verification fails → pending →
  // the mock client's replacement can splice in and discharge.
  const PENDING_SRC = "theorem t: 1 + 1 == 2 by proof_refl(99)\n";

  await asyncTest("Phase H4a: runLlmWorker uses a mock client and closes the loop", async () => {
    const tmp = path.join("/tmp", `pcp-h4a-${Date.now()}.alg`);
    fs.writeFileSync(tmp, PENDING_SRC);
    try {
      const mockClient: LlmClient = {
        modelId: () => "mock-model",
        async send() { return "```allegro\nproof_refl(2)\n```"; },
      };
      const result = await runLlmWorker({
        filename: tmp, maxAttempts: 3, enableLlm: true,
        client: mockClient, primer: "(mock primer)",
      });
      eq(result.allDischarged, true,
         `expected allDischarged=true; got ${JSON.stringify(result.summary)}`);
      eq(result.summary.discharged, 1);
      eq(result.perObligation[0].name, "t");
      eq(result.perObligation[0].discharged, true);
      eq(result.perObligation[0].finalTerm, "proof_refl(2)");
      eq(result.perObligation[0].authorship?.provers[0].prover, "mock-model");
      eq(result.sourceAfter.includes("by proof_refl(2)"), true);
    } finally {
      fs.unlinkSync(tmp);
    }
  });

  await asyncTest("Phase H4a: runLlmWorker reports pending when client returns bad term", async () => {
    const tmp = path.join("/tmp", `pcp-h4a-${Date.now()}.alg`);
    fs.writeFileSync(tmp, PENDING_SRC);
    try {
      const badClient: LlmClient = {
        modelId: () => "mock-model",
        // proof_refl(99) proves 99 == 99, not 1 + 1 == 2 → rejected.
        async send() { return "```allegro\nproof_refl(99)\n```"; },
      };
      const result = await runLlmWorker({
        filename: tmp, maxAttempts: 2, enableLlm: true,
        client: badClient, primer: "(mock primer)",
      });
      eq(result.allDischarged, false);
      eq(result.summary.pending, 1);
      eq(result.perObligation[0].attempts, 2);
      eq(result.perObligation[0].discharged, false);
    } finally {
      fs.unlinkSync(tmp);
    }
  });

  await asyncTest("Phase H4a: runLlmWorker handles malformed response (no code block)", async () => {
    const tmp = path.join("/tmp", `pcp-h4a-${Date.now()}.alg`);
    fs.writeFileSync(tmp, PENDING_SRC);
    try {
      const wordy: LlmClient = {
        modelId: () => "mock-model",
        async send() { return "I think the proof is proof_refl(2) but I'm not sure"; },
      };
      const result = await runLlmWorker({
        filename: tmp, maxAttempts: 2, enableLlm: true,
        client: wordy, primer: "(mock primer)",
      });
      eq(result.allDischarged, false);
      eq(result.perObligation[0].history.length, 2);
      eq(result.perObligation[0].history[0].reason?.includes("no fenced"), true);
    } finally {
      fs.unlinkSync(tmp);
    }
  });
}

test("Phase H4a: CLI `prove` reports missing API key cleanly", () => {
  const tmp = path.join("/tmp", `pcp-h4a-${Date.now()}.alg`);
  fs.writeFileSync(tmp, "theorem t: 1 == 1\n");
  try {
    const r = spawnSync("npx", ["tsx", "src/index.ts", "prove", tmp],
                        { encoding: "utf-8", env: { ...process.env, ANTHROPIC_API_KEY: "" } });
    eq(r.status, 1);
    eq(r.stderr.includes("ANTHROPIC_API_KEY"), true);
    eq(r.stderr.includes("propose"), true, "should mention the human-worker fallback");
  } finally {
    fs.unlinkSync(tmp);
  }
});

// --- Phase A: introspection / semantic summary ---


test("Phase A: summarizeValue describes an Int literal", () => {
  const src = "x = 42\n";
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const xVal = evalCtx.bindings.get("x")!.value!;
  const s = summarizeValue(xVal);
  eq(s.typeName, "Int");
  eq(s.resolved, true);
  eq(s.shortDescription.includes("42"), true);
});

test("Phase A: summarizeValue reports function param names", () => {
  const src = "f(x, y) => x + y\n";
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const fVal = evalCtx.bindings.get("f")!.value!;
  const s = summarizeValue(fVal);
  eq(s.shortDescription.includes("x, y"), true, `got: ${s.shortDescription}`);
  eq(s.primitives.includes("bits_add"), true, "sums via bits_add");
});

test("Phase A: summarizeValue collects unresolved symbols", () => {
  const src = "f(x) => x + unknown_thing\n";
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const fVal = evalCtx.bindings.get("f")!.value!;
  const s = summarizeValue(fVal);
  eq(s.externalSymbols.includes("unknown_thing"), true);
});

test("Phase A: summarizeModule grades a clean module 'proven-safe'", () => {
  const src = "x = 1\ny = 2\nz = x + y\n";
  const result = runtimeEval(src, undefined, [typeExt], undefined, true);
  const summary = summarizeModule(result.evalCtx, result.compilationReport, {
    excludeBindings: new Set(Object.keys(primRegistry)),
  });
  eq(summary.grade, "proven-safe");
  eq(summary.bindingCount >= 3, true);
  eq(summary.resolvedCount, summary.bindingCount);
});

test("Phase A: safetyGradeFor classifies edge cases", () => {
  eq(safetyGradeFor(undefined), "partial");
  eq(safetyGradeFor({ inferred: [], unresolved: [], bindingTypes: new Map(), notifications: [] }),
     "proven-safe");
  eq(safetyGradeFor({ inferred: [], unresolved: ["foo"], bindingTypes: new Map(), notifications: [] }),
     "partial");
  eq(safetyGradeFor({
       inferred: [], unresolved: [], bindingTypes: new Map(),
       notifications: [{ kind: "test", severity: "error", binding: "f", message: "boom" }],
     }),
     "has-errors");
});

test("Phase A: renderModuleSummary produces readable text", () => {
  const src = "x = 42\nf(n) => n + 1\n";
  const result = runtimeEval(src, undefined, [typeExt], undefined, true);
  const summary = summarizeModule(result.evalCtx, result.compilationReport, {
    excludeBindings: new Set(Object.keys(primRegistry)),
  });
  const text = renderModuleSummary(summary);
  eq(text.includes("safety grade:"), true);
  eq(text.includes("x"), true);
  eq(text.includes("f"), true);
});

