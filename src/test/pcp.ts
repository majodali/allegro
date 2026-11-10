// =============================================================================
// Proof Collaboration Protocol (H1-H4) + introspection (Phase A).
//
// Extracted from the single-file suite (suite split, lane B). Registrations
// run at import time; src/test/index.ts imports this module in suite order.
// =============================================================================

import { test, asyncTest, eq, throws } from "./harness.js";
import { evalStd, typeExt } from "./fixtures.js";
import { evalSource as runtimeEval, Extension } from "../runtime.js";
import { Value, ValueKind, BitsValue, StructureValue, bitsToString, makeInt } from "../types.js";
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
  splicePlanProposal, judgePlanObligation, answerPlanProposal, formatPlanProposalAnswer,
} from "../pcp.js";
import * as os from "os";
import {
  extractCodeBlocks, spliceProof, buildIterationMessage,
  classifyStrategy, loadPrimer, runLlmWorker, LlmClient,
} from "../../pcp/llm-worker.js";
import {
  createScriptedClient, parseProposals, loadPlanPrimer, OBLIGATION_KINDS,
} from "../../pcp/llm-worker.js";
import { testsDir, libExtensions } from "./alg-files.js";
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

// --- B-187 L1: plan obligations (docs/plans/planning-loop.md) ---
//
// An open plan (`plan NAME from CATALOG:`, lib/planning_loop.alg) carries
// the gaps completion from its catalog cannot fill; the protocol lists them
// as obligations of kind "plan", after every theorem and law obligation,
// with a hash over the plan's declared surface and the gap.

const planLoopExts = (): Extension[] => [typeExt, ...libExtensions(["units", "planning", "planning_loop"])];

const openPlanSource = (outcomes: string, catalog: string): string => [
  `depot = with_estimate(leaf("Depot", [port("Shipped")], [port("Sorted")]), est(30 min, person_hours(0.25), none))`,
  `van = with_estimate(leaf("Van", [port("Sorted")], [port("Delivered")]), est(60 min, person_hours(0.5), none))`,
  `bin = leaf("Bin", [port("Receipt")], [port("Archived")])`,
  `yard = ${catalog}`,
  `plan Fulfil from yard:`,
  `  inputs: Order`,
  `  outcomes: ${outcomes}`,
  `  Pack:`,
  `    inputs: Order`,
  `    outcomes: Packed`,
  ``,
].join("\n");

const planObligationsOf = (src: string, pendingOnly = false): Obligation[] => {
  const result = runtimeEval(src, undefined, planLoopExts(), undefined, true, undefined, /*softFail*/ true);
  return extractObligations(result.evalCtx, result.compilationReport, { pendingOnly, plans: true })
    .filter(o => o.kind === "plan");
};

test("B-187 L1: extractObligations collects an open plan's obligation in planning words", () => {
  const obs = planObligationsOf(openPlanSource("Delivered", "[depot, van]"), true);
  eq(obs.length, 1, "one distinct gap, one obligation");
  const p = obs[0].plan!;
  eq(p.binding, "Fulfil");
  eq(p.plan, "Fulfil");
  eq(p.catalog, "yard", "the catalog's binding is named");
  eq(p.port, "Shipped");
  eq(p.consumer, "Depot");
  eq(p.fixture, undefined, "an unconstrained port has no fixture");
  eq(p.stop, "catalog");
  eq(p.depth, 2);
  eq(p.steps.join(", "), "Delivered from Van, Sorted from Depot");
  eq(p.gap, "Shipped, which Depot needs");
  eq(p.message, "nothing in the catalog produces Shipped, which Depot needs");
  eq(p.identity, "plan Fulfil; inputs Order; outcomes Delivered; no budget; gap Shipped by Depot");
  eq(p.hash, hashProposition(p.identity));
  eq(obs[0].theorem.propositionHash, p.hash, "the theorem slot carries the same identity");
  // The JSON round-trips through the pcp/1 validator unchanged.
  const back = parseObligation(serializeObligation(obs[0]));
  eq(back.kind, "plan");
  eq(back.plan?.hash, p.hash);
  // The text rendering names the gap and the hash.
  const text = formatObligation(obs[0]);
  eq(text.includes("Obligation: plan `Fulfil`: Shipped, which Depot needs"), true, text);
  eq(text.includes(`hash:        ${p.hash}`), true, text);
});

test("B-187 L1: the plan obligation's hash moves with the declared outcome, not with an unrelated catalog entry", () => {
  const base = planObligationsOf(openPlanSource("Delivered", "[depot, van]"))[0].plan!;
  const moreCatalog = planObligationsOf(openPlanSource("Delivered", "[depot, van, bin]"))[0].plan!;
  eq(moreCatalog.gap, base.gap, "the unrelated entry leaves the gap");
  eq(moreCatalog.hash, base.hash, "an added catalog entry does not change the identity");
  const otherOutcome = planObligationsOf(openPlanSource("Delivered, Archived", "[depot, van, bin]"))[0].plan!;
  eq(otherOutcome.gap, base.gap, "the first gap is the same");
  eq(otherOutcome.hash !== base.hash, true, "a changed declared outcome changes the identity");
});

test("B-187 L1: theorem and law obligations are unchanged by the plan kind", () => {
  // Opt-in: without `plans`, extractObligations answers what it did before;
  // with it, a file without open plans answers the same list.
  const src = `theorem a: 1 == 1\ntheorem b: 1 == 2\n`;
  const result = runtimeEval(src, undefined, [typeExt], undefined, true, undefined, /*softFail*/ true);
  const before = extractObligations(result.evalCtx, result.compilationReport);
  const withPlans = extractObligations(result.evalCtx, result.compilationReport, { plans: true });
  eq(JSON.stringify(withPlans), JSON.stringify(before));
  eq(before.every(o => o.kind === undefined), true, "a theorem obligation carries no kind (pcp/1 unchanged)");
  // An open plan's file: the plan obligation comes last, after the rest.
  const plans = runtimeEval(openPlanSource("Delivered", "[depot, van]"), undefined, planLoopExts(), undefined, true, undefined, true);
  const all = extractObligations(plans.evalCtx, plans.compilationReport, { plans: true });
  const without = extractObligations(plans.evalCtx, plans.compilationReport);
  eq(all.length, without.length + 1);
  eq(JSON.stringify(all.slice(0, without.length)), JSON.stringify(without));
  eq(all[all.length - 1].kind, "plan");
});

test("B-187 L1: CLI `obligations --pending` lists the demo's plan obligation with its hash, in text and JSON", () => {
  const file = path.join(testsDir, "planning-loop-obligations.alg");
  const text = spawnSync("npx", ["tsx", "src/index.ts", "obligations", file, "--pending"], { encoding: "utf-8" });
  eq(text.status, 0, text.stderr);
  const json = spawnSync("npx", ["tsx", "src/index.ts", "obligations", file, "--pending", "--json"], { encoding: "utf-8" });
  eq(json.status, 0, json.stderr);
  const lines = json.stdout.trim().split("\n").filter(l => l.length > 0).map(l => JSON.parse(l));
  const plan = lines.filter(o => o.kind === "plan");
  eq(plan.length, 1);
  eq(plan[0].plan.gap, "Shipped, which Depot needs");
  eq(plan[0].plan.catalog, "yard");
  eq(plan[0].plan.stop, "catalog");
  eq(plan[0].plan.hash, hashProposition("plan Fulfil; inputs Order; outcomes Delivered; no budget; gap Shipped by Depot"));
  eq(lines.filter(o => o.kind === undefined).length, 5, "the units library's five pending laws, as before");
  eq(text.stdout.includes("Obligation: plan `Fulfil`: Shipped, which Depot needs"), true, text.stdout);
  eq(text.stdout.includes(`hash:        ${plan[0].plan.hash}`), true, text.stdout);
  // Since chunk L2 (its PR #182, ask 1), `propose` renders the plan
  // obligation's TODO; `verify` is pinned on this file below.
  const propose = spawnSync("npx", ["tsx", "src/index.ts", "propose", file], { encoding: "utf-8" });
  eq(propose.status, 0, propose.stderr);
  eq(propose.stdout.includes("## `Fulfil: Shipped, which Depot needs`\n\n**Gap:** nothing in the catalog produces Shipped, which Depot needs"), true,
     "propose renders the plan obligation's TODO");
  const verify = spawnSync("npx", ["tsx", "src/index.ts", "verify", file], { encoding: "utf-8" });
  eq(verify.status, 0, verify.stderr);
});

test("B-187 L2: CLI `propose` and `verify` on L1's demo list its plan obligation by default", () => {
  const file = path.join(testsDir, "planning-loop-obligations.alg");
  const propose = spawnSync("npx", ["tsx", "src/index.ts", "propose", file], { encoding: "utf-8" });
  eq(propose.status, 0, propose.stderr);
  eq(propose.stdout.includes("**6 pending** of 20 obligation(s).\n"), true, "the five laws and the plan obligation");
  eq(propose.stdout.includes([
    "## `Fulfil: Shipped, which Depot needs`",
    "",
    "**Gap:** nothing in the catalog produces Shipped, which Depot needs",
    "",
    "**Search so far:** Delivered from Van, Sorted from Depot",
    "",
    "**Catalog to extend:** `yard`: add one node block that produces `Shipped`; leave the plan `Fulfil` as written.",
    "",
    "**Hash:** `421ea754` (over: plan Fulfil; inputs Order; outcomes Delivered; no budget; gap Shipped by Depot)",
    "",
    "---",
    "",
    "_When done, run `allegro verify` on the source file to confirm._",
  ].join("\n")), true, propose.stdout);
  const verify = spawnSync("npx", ["tsx", "src/index.ts", "verify", file], { encoding: "utf-8" });
  eq(verify.status, 0, "a pending plan obligation leaves the verdict verified");
  eq(verify.stdout.includes([
    "  coercions: 2/2 obligations discharged",
    "  plans: 1/2 discharged, 1 pending",
    "    ? Fulfil: Shipped, which Depot needs — nothing in the catalog produces Shipped, which Depot needs",
    "    ✓ closed: every gap closed — Delivered from Van, Sorted from Depot, Shipped from Ship; bound effort 1.5 person-hours, duration 155 min",
    "  assumption ledger: rests on 0 admitted, 0 sampled; 5 obligation(s) pending",
  ].join("\n")), true, verify.stdout);
  eq(verify.stdout.startsWith("Verdict (verified): 0/0 discharged\n"), true, "the count line still counts theorems only");
});

// --- B-187 L2: the proposal protocol (docs/plans/planning-loop.md) ---
//
// A proposal is one node block, spliced as one more entry of the open
// plan's `catalog NAME:` block; the plan never changes. The kernel's answer
// is read from the `OpenPlan` record the library stores (`surface`,
// `state`, `answer`): the plan solved, or the refusal in planning words.

const proposalSource = (planOutcomes = "Delivered"): string => [
  `catalog yard:`,
  `  Depot:`,
  `    inputs: Shipped`,
  `    outcomes: Sorted`,
  `    estimate: 30 min, 0.25 person-hours`,
  `  Van:`,
  `    inputs: Sorted`,
  `    outcomes: Delivered`,
  `    estimate: 60 min, 0.5 person-hours`,
  ``,
  `plan Fulfil from yard:`,
  `  inputs: Order`,
  `  outcomes: ${planOutcomes}`,
  `  budget: 160 min`,
  `  Pack:`,
  `    inputs: Order`,
  `    outcomes: Packed`,
  `    estimate: 20 min, 0.5 person-hours`,
  ``,
].join("\n");

const evalPlanFile = (src: string) =>
  runtimeEval(src, undefined, planLoopExts(), undefined, true, undefined, /*softFail*/ true);

const planObligationOfSource = (src: string): Obligation =>
  extractObligations(evalPlanFile(src).evalCtx, undefined, { plans: true }).filter(o => o.kind === "plan")[0];

const SHIP = "Ship:\n  inputs: Packed\n  outcomes: Shipped\n  estimate: 45 min, 0.25 person-hours\n";
const FREIGHT = "Freight:\n  inputs: Packed\n  outcomes: Shipped\n  estimate: 90 min, 0.25 person-hours\n";
const COURIER = "Courier:\n  inputs: Labelled\n  outcomes: Shipped\n  estimate: 40 min, 0.25 person-hours\n";

test("B-187 L2: splicePlanProposal appends one node block to the named catalog and leaves the plan", () => {
  const src = proposalSource();
  const ob = planObligationOfSource(src);
  eq(ob.plan!.catalog, "yard");
  eq(ob.plan!.identity, "plan Fulfil; inputs Order; outcomes Delivered; budget duration 160 min, effort none, money none; gap Shipped by Depot");
  const sp = splicePlanProposal(src, ob.plan!, SHIP);
  eq(sp.ok, true);
  if (!sp.ok) return;
  eq(sp.entry, "Ship");
  const lines = sp.source.split("\n");
  eq(lines.slice(9, 13).join("\n"), "  Ship:\n    inputs: Packed\n    outcomes: Shipped\n    estimate: 45 min, 0.25 person-hours",
     "the entry follows the catalog's last entry, at its indentation");
  eq(sp.source.includes(src.split("\n").slice(10).join("\n")), true, "the plan's block is unchanged");
  // An indented reply is dedented first.
  const indented = splicePlanProposal(src, ob.plan!, "    Ship:\n      inputs: Packed\n      outcomes: Shipped\n");
  eq(indented.ok && indented.source.includes("\n  Ship:\n    inputs: Packed\n"), true);
});

test("B-187 L2: the kernel's answer per proposal: closed and solved, the next dead end, the budget missed", () => {
  const src = proposalSource();
  const obligation = planObligationOfSource(src);
  const answer = (proposal: string) => answerPlanProposal({ source: src, obligation, proposal, evaluate: evalPlanFile });
  const closing = answer(SHIP);
  eq(closing.accepted, true, closing.message);
  eq(closing.message, "Delivered from Van, Sorted from Depot, Shipped from Ship; bound effort 1.5 person-hours, duration 155 min");
  eq(formatPlanProposalAnswer(closing),
     "accepted: the gap is closed and the plan solved: Delivered from Van, Sorted from Depot, Shipped from Ship; bound effort 1.5 person-hours, duration 155 min");
  const open = answer(COURIER);
  eq(open.accepted, false);
  eq(open.refusal, "open");
  eq(open.message, "nothing in the catalog produces Labelled, which Courier needs", "the next dead end, the new obligation's message");
  const over = answer(FREIGHT);
  eq(over.accepted, false);
  eq(over.refusal, "unsolved");
  eq(over.message, "no completion of Fulfil from the catalog fits the budget of Fulfil; the cheapest, Delivered from Van, Sorted from Depot, Shipped from Freight, is duration 200 min against 160 min");
  eq(formatPlanProposalAnswer(over), `refused (unsolved): ${over.message}`);
});

test("B-187 L2: a plan edit is refused by the identity hash; a second statement by the splice", () => {
  const src = proposalSource();
  const ob = planObligationOfSource(src);
  // A reply that would also redeclare the plan is not one node block.
  const redeclare = splicePlanProposal(src, ob.plan!,
    SHIP + "plan Fulfil from yard:\n  inputs: Order\n  outcomes: Packed\n");
  eq(redeclare.ok, false);
  eq(!redeclare.ok && redeclare.refusal, "not-a-node-block");
  eq(!redeclare.ok && redeclare.reason, "the proposal is more than one node block: line 5, `plan Fulfil from yard:`, starts another statement at the margin");
  // A file whose plan was edited (as a human might, beside the entry): the
  // plan solves, but the obligation's hash no longer matches the file's.
  const sp = splicePlanProposal(src, ob.plan!, SHIP);
  if (!sp.ok) throw new Error(sp.reason);
  const edited = sp.source.replace("  outcomes: Delivered\n  budget:", "  outcomes: Sorted\n  budget:");
  eq(edited !== sp.source, true);
  const judged = judgePlanObligation(evalPlanFile(edited).evalCtx, ob.plan!);
  eq(judged.status, "refused");
  const editedHash = hashProposition("plan Fulfil; inputs Order; outcomes Sorted; budget duration 160 min, effort none, money none; gap Shipped by Depot");
  eq(judged.message, `the plan was edited: the obligation's hash is ${ob.plan!.hash}, the file's is ${editedHash}; a proposal adds a catalog entry and leaves the plan as written`);
  // The same file with the plan as written is discharged.
  eq(judgePlanObligation(evalPlanFile(sp.source).evalCtx, ob.plan!).status, "discharged");
});

test("B-187 L2: the splice's other refusals: a keyword, a reused name, a list catalog, a parse the kernel refuses", () => {
  const src = proposalSource();
  const ob = planObligationOfSource(src);
  const refuse = (text: string, source = src) => {
    const r = splicePlanProposal(source, ob.plan!, text);
    return r.ok ? "spliced" : `${r.refusal}: ${r.reason}`;
  };
  eq(refuse("catalog more:\n  " + SHIP.replace(/\n/g, "\n  ")),
     "not-a-node-block: the proposal starts with `catalog`: reply with the node block alone, without the `catalog` or `plan` keyword");
  eq(refuse("ship = leaf(\"Ship\", [port(\"Packed\")], [port(\"Shipped\")])"),
     "not-a-node-block: the proposal is not a node block: its first line, `ship = leaf(\"Ship\", [port(\"Packed\")], [port(\"Shipped\")])`, must be a capitalised node name and a colon, as `Ship:`");
  eq(refuse("Van:\n  inputs: Packed\n  outcomes: Shipped\n"),
     "name-reused: the proposal's node `Van` reuses a name the plan or the catalog `yard` already has: name the new entry differently");
  eq(refuse("Pack:\n  inputs: Packed\n  outcomes: Shipped\n"),
     "name-reused: the proposal's node `Pack` reuses a name the plan or the catalog `yard` already has: name the new entry differently");
  // L1's demo writes its catalog as a list expression: nothing to splice into.
  const listSource = openPlanSource("Delivered", "[depot, van]");
  const listOb = planObligationsOf(listSource)[0];
  eq(splicePlanProposal(listSource, listOb.plan!, SHIP).ok, false);
  const r = splicePlanProposal(listSource, listOb.plan!, SHIP);
  eq(!r.ok && r.reason, "the catalog `yard` is written as an expression, not as a `catalog yard:` block: a node block is spliced into the block form only");
  // Items that do not parse: the splice passes the layout check, and the
  // kernel's parse refuses the file.
  const bad = answerPlanProposal({ source: src, obligation: ob, proposal: "Ship:\n  inputz: Packed\n", evaluate: evalPlanFile });
  eq(bad.accepted, false);
  eq(bad.refusal, "halt");
  eq(bad.message.startsWith("the kernel refused the file with the entry spliced: Parse error"), true, bad.message);
});

test("B-187 L2: buildVerdict records plan obligations only when asked; a verdict without them is unchanged", () => {
  const src = proposalSource();
  const ob = planObligationOfSource(src);
  const res = evalPlanFile(src);
  const plain = buildVerdict(res.evalCtx, res.compilationReport);
  eq(plain.planObligations, undefined, "absent unless asked for");
  const theorems = runtimeEval(`theorem a: 1 == 1\n`, undefined, [typeExt], undefined, true, undefined, true);
  const stamp = (v: Verdict) => JSON.stringify(v).replace(/"verifiedAt":"[^"]*"/g, `"verifiedAt":"-"`);
  eq(stamp(buildVerdict(theorems.evalCtx, theorems.compilationReport, undefined, { plans: true })),
     stamp(buildVerdict(theorems.evalCtx, theorems.compilationReport)), "a file without open plans: the same verdict");
  const withPlans = buildVerdict(res.evalCtx, res.compilationReport, undefined, { plans: true });
  eq(withPlans.planObligations!.length, 1);
  eq(withPlans.planObligations![0].status, "pending");
  eq(withPlans.verified, true, "a pending plan obligation does not flip verified, as a pending law does not");
  const text = formatVerdict(withPlans);
  eq(text.includes("  plans: 0/1 discharged, 1 pending\n    ? Fulfil: Shipped, which Depot needs — nothing in the catalog produces Shipped, which Depot needs"), true, text);
  // Supplied, the obligation must be discharged.
  const supplied = buildVerdict(res.evalCtx, res.compilationReport, ob);
  eq(checkObligationSatisfied(ob, supplied), "plan obligation `Fulfil` (Shipped, which Depot needs) is pending: nothing in the catalog produces Shipped, which Depot needs");
  const sp = splicePlanProposal(src, ob.plan!, SHIP);
  if (!sp.ok) throw new Error(sp.reason);
  const closed = evalPlanFile(sp.source);
  const done = buildVerdict(closed.evalCtx, closed.compilationReport, ob, { plans: true });
  eq(checkObligationSatisfied(ob, done), null);
  eq(done.planObligations!.length, 1, "the supplied obligation replaces the open plan's own record");
  eq(formatVerdict(done).includes("  plans: 1/1 discharged\n    ✓ Fulfil: Shipped, which Depot needs — Delivered from Van, Sorted from Depot, Shipped from Ship; bound effort 1.5 person-hours, duration 155 min"), true);
  // The JSON round-trips through the pcp/1 validator.
  eq(parseVerdict(serializeVerdict(done)).planObligations![0].status, "discharged");
});

test("B-187 L2: formatTodo renders a plan obligation in planning words, with the catalog to extend and the hash", () => {
  const ob = planObligationOfSource(proposalSource());
  const md = formatTodo({ filename: "fulfil.alg", totalObligations: 1, sections: [{ obligation: ob }] });
  eq(md, [
    "# Proof TODO — `fulfil.alg`",
    "",
    "**1 pending** of 1 obligation(s).",
    "",
    "## `Fulfil: Shipped, which Depot needs`",
    "",
    "**Gap:** nothing in the catalog produces Shipped, which Depot needs",
    "",
    "**Search so far:** Delivered from Van, Sorted from Depot",
    "",
    "**Catalog to extend:** `yard`: add one node block that produces `Shipped`; leave the plan `Fulfil` as written.",
    "",
    `**Hash:** \`${ob.plan!.hash}\` (over: plan Fulfil; inputs Order; outcomes Delivered; budget duration 160 min, effort none, money none; gap Shipped by Depot)`,
    "",
    "---",
    "",
    "_When done, run `allegro verify` on the source file to confirm._",
  ].join("\n"));
});

test("B-187 L2: the human path on L1's open plan through the CLI: obligations, edit, verify --obligation", () => {
  // L1's demo, its open plan only (the demo's later lines read the open
  // obligation and would halt once it closes), in a scratch directory.
  const l1 = fs.readFileSync(path.join(testsDir, "planning-loop-obligations.alg"), "utf-8").split("\n").slice(0, 23).join("\n") + "\n";
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "allegro-l2-"));
  try {
    const file = path.join(dir, "fulfil.alg");
    fs.writeFileSync(file, l1);
    const obs = spawnSync("npx", ["tsx", "src/index.ts", "obligations", file, "--pending", "--json"], { encoding: "utf-8" });
    eq(obs.status, 0, obs.stderr);
    const planLine = obs.stdout.trim().split("\n").find(l => JSON.parse(l).kind === "plan")!;
    const obPath = path.join(dir, "O.json");
    fs.writeFileSync(obPath, planLine);
    const verify = (f: string) => spawnSync("npx", ["tsx", "src/index.ts", "verify", f, "--obligation", obPath], { encoding: "utf-8" });
    const before = verify(file);
    eq(before.status, 1, "the obligation is open");
    eq(before.stdout.includes("  plans: 0/1 discharged, 1 pending\n    ? Fulfil: Shipped, which Depot needs — nothing in the catalog produces Shipped, which Depot needs\n"), true, before.stdout);
    // The edit: the hand-written entry of L1's demo, added to the catalog.
    const ship = `ship  = with_estimate(leaf("Ship", [port("Packed")], [port("Shipped")]), est(45 min, person_hours(0.25), none))\n`;
    const editedFile = path.join(dir, "edited.alg");
    fs.writeFileSync(editedFile, l1.replace("yard  = [depot, van]\n", ship + "yard  = [depot, van, ship]\n"));
    const after = verify(editedFile);
    eq(after.status, 0, after.stdout + after.stderr);
    eq(after.stdout.startsWith("Verdict (verified): 0/0 discharged\n"), true, after.stdout);
    eq(after.stdout.includes("  plans: 1/1 discharged\n    ✓ Fulfil: Shipped, which Depot needs — Delivered from Van, Sorted from Depot, Shipped from Ship; bound effort 1.5 person-hours, duration 155 min\n"), true, after.stdout);
    eq(after.stdout.includes("obligation mismatch"), false);
    // The plan edited as well: refused by the hash.
    const planEdit = path.join(dir, "plan-edit.alg");
    fs.writeFileSync(planEdit, fs.readFileSync(editedFile, "utf-8").replace("  outcomes: Delivered\n  Pack:", "  outcomes: Sorted\n  Pack:"));
    const refused = verify(planEdit);
    eq(refused.status, 1);
    eq(refused.stdout.includes("1 REFUSED\n    ✗ Fulfil: Shipped, which Depot needs — the plan was edited: the obligation's hash is 421ea754"), true, refused.stdout);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
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

  // --- B-187 L3: the LLM-free loop (docs/plans/planning-loop.md) ---
  //
  // One loop for every obligation kind (ruling R3 (a)); the client here is
  // the scripted proposer with its answers in the test, so no file, no key
  // and no network. The file is L1's open plan (the plan of
  // `tests/planning-loop-obligations.alg`, the same obligation and hash),
  // with its catalog written as a `catalog yard:` block, the form a
  // proposal is spliced into.
  const L1_OPEN_PLAN = [
    "use units", "use planning", "use planning_loop", "",
    "catalog yard:",
    "  Depot:", "    inputs: Shipped", "    outcomes: Sorted", "    estimate: 30 min, 0.25 person-hours",
    "  Van:", "    inputs: Sorted", "    outcomes: Delivered", "    estimate: 60 min, 0.5 person-hours",
    "",
    "plan Fulfil from yard:",
    "  inputs: Order", "  outcomes: Delivered",
    "  Pack:", "    inputs: Order", "    outcomes: Packed", "    estimate: 20 min, 0.5 person-hours",
    "",
  ].join("\n");
  const COURIER_ENTRY = "Courier:\n  inputs: Labelled\n  outcomes: Shipped\n  estimate: 40 min, 0.25 person-hours";
  const SHIP_ENTRY = "Ship:\n  inputs: Packed\n  outcomes: Shipped\n  estimate: 45 min, 0.25 person-hours";
  const GAP = "Fulfil: Shipped, which Depot needs";

  await asyncTest("B-187 L3: the worker's scripted loop on L1's open plan converges in two attempts, one refused with its reason", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "allegro-l3-"));
    try {
      const file = path.join(dir, "fulfil.alg");
      fs.writeFileSync(file, L1_OPEN_PLAN);
      const scripted = createScriptedClient({ byObligation: new Map([[GAP, [COURIER_ENTRY, SHIP_ENTRY]]]), unnamed: [] });
      const asked: Array<{ systemPrompt: string; userMessage: string; obligation?: string }> = [];
      const client: LlmClient = {
        modelId: scripted.modelId, answers: scripted.answers,
        async send(args) { asked.push(args); return scripted.send(args); },
      };
      const result = await runLlmWorker({ filename: file, maxAttempts: 5, client, extensions: [typeExt] });
      eq(JSON.stringify(result.summary), JSON.stringify({ discharged: 1, pending: 0, skipped: 5 }),
         "the plan obligation discharged; the units library's five laws have no prepared proposal");
      eq(result.allDischarged, true);
      eq(result.skipped!.join(", "), "Quantity.law_mul_comm, Quantity.law_conv_roundtrip, Quantity.law_refl, Quantity.law_sym, Quantity.law_trans");
      const ob = result.perObligation[0];
      eq(ob.name, GAP);
      eq(ob.kind, "plan");
      eq(ob.attempts, 2);
      eq(ob.history[0].proofTerm, COURIER_ENTRY);
      eq(ob.history[0].verified, false);
      eq(ob.history[0].reason, "refused (open): nothing in the catalog produces Labelled, which Courier needs");
      eq(ob.history[1].verified, true);
      eq(ob.history[1].answer, "accepted: the gap is closed and the plan solved: Delivered from Van, Sorted from Depot, Shipped from Ship; bound effort 1.5 person-hours, duration 155 min");
      eq(ob.finalTerm, SHIP_ENTRY);
      const p = ob.authorship!.provers[0];
      eq(JSON.stringify(p), JSON.stringify({ prover: "scripted", attemptsUsed: 2, effortBudgetUsed: { attempts: 2 }, role: "primary" }),
         "the authorship names the scripted proposer and the attempts");
      // The entry is in the catalog; the plan is as written.
      eq(result.sourceAfter.includes("    estimate: 60 min, 0.5 person-hours\n  Ship:\n    inputs: Packed\n"), true, result.sourceAfter);
      eq(result.sourceAfter.includes(L1_OPEN_PLAN.slice(L1_OPEN_PLAN.indexOf("plan Fulfil"))), true, "the plan's block unchanged");
      // The requests: the plan kind's words, the refusal fed back, its primer section.
      eq(asked.length, 2);
      eq(asked.every(a => a.obligation === GAP), true);
      eq(asked[0].userMessage.startsWith("Attempt 1 for plan obligation `Fulfil: Shipped, which Depot needs`.\n\n**Gap:** nothing in the catalog produces Shipped, which Depot needs\n"), true, asked[0].userMessage);
      eq(asked[0].userMessage.includes("**Hash:** `421ea754` (over: plan Fulfil; inputs Order; outcomes Delivered; no budget; gap Shipped by Depot)"), true,
         "L1's obligation, its hash unchanged by the catalog's form");
      eq(asked[0].userMessage.includes("Last attempt's refusal"), false);
      eq(asked[1].userMessage.includes("Last attempt's refusal:\n- refused (open): nothing in the catalog produces Labelled, which Courier needs\n\nAttempts so far: 1\n- 1: `Courier`, refused (open): nothing in the catalog produces Labelled, which Courier needs\n"), true, asked[1].userMessage);
      eq(asked[1].userMessage.endsWith("The kernel will add it to the catalog `yard` and check the plan again."), true);
      eq(asked[0].systemPrompt, loadPlanPrimer(), "the system prompt is the plan kind's primer section");
      eq(asked[0].systemPrompt.startsWith("### 2.9 Output contract for a plan proposer\n"), true);
      eq(asked[0].systemPrompt.includes("## 3."), false, "the section alone");
      // The kernel agrees on the result: the file as the loop left it is discharged.
      const after = runtimeEval(result.sourceAfter.slice(result.sourceAfter.indexOf("catalog yard")), undefined, planLoopExts(), undefined, true, undefined, true);
      const v = buildVerdict(after.evalCtx, after.compilationReport, undefined, { plans: true });
      eq(v.planObligations!.map(r => `${r.status} ${r.message}`).join(" | "),
         "discharged Delivered from Van, Sorted from Depot, Shipped from Ship; bound effort 1.5 person-hours, duration 155 min");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  await asyncTest("B-187 L3: the one loop serves a theorem through the scripted proposer, with a prepared proof term", async () => {
    const tmp = path.join(os.tmpdir(), `pcp-l3-${process.pid}-${Date.now()}.alg`);
    fs.writeFileSync(tmp, PENDING_SRC);
    try {
      const client = createScriptedClient({ byObligation: new Map([["t", ["proof_refl(99)", "proof_refl(2)"]]]), unnamed: [] },
                                          { prover: "scripted:test" });
      const result = await runLlmWorker({ filename: tmp, maxAttempts: 3, client, primer: "(mock primer)" });
      eq(result.allDischarged, true);
      const ob = result.perObligation[0];
      eq(ob.name, "t");
      eq(ob.kind, undefined, "a theorem carries no kind");
      eq(ob.attempts, 2);
      eq(ob.history[0].verified, false);
      eq(ob.history[1].answer, undefined, "a theorem's accepted attempt carries no answer, as before");
      eq(ob.finalTerm, "proof_refl(2)");
      eq(ob.authorship!.provers[0].prover, "scripted:test");
      eq(ob.authorship!.provers[0].attemptsUsed, 2);
      eq(result.sourceAfter.includes("by proof_refl(2)"), true);
    } finally {
      fs.unlinkSync(tmp);
    }
  });

  await asyncTest("B-187 L3: the worker opens a file with a `use` header (B-175 item 5)", async () => {
    // Before chunk L3 the worker evaluated the header unstripped and threw
    // a parse error at position 546 (`use units`) on this file.
    const seen: string[] = [];
    const client: LlmClient = {
      modelId: () => "mock-model",
      answers: (name) => { seen.push(name); return false; },
      async send() { throw new Error("not asked"); },
    };
    const result = await runLlmWorker({ filename: path.resolve("demos/rung3/02-solve.alg"), client, extensions: [typeExt] });
    eq(seen.join(", "), "Quantity.law_mul_comm, Quantity.law_conv_roundtrip, Quantity.law_refl, Quantity.law_sym, Quantity.law_trans",
       "the units library's laws, as `obligations --pending` lists them");
    eq(result.summary.skipped, 5);
    eq(result.perObligation.length, 0);
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

// --- B-187 L3: the scripted proposer, its file and its CLI option ---

test("B-187 L3: parseProposals reads a proposals file for the worker: sections by obligation, one block per attempt", () => {
  const md = [
    "# Proposals", "",
    "```allegro", "Any:", "  inputs: X", "```", "",
    "## `Fulfil: Shipped, which Depot needs`", "",
    "First, a courier (it needs a label):", "",
    "```allegro", "Courier:", "  inputs: Labelled", "  outcomes: Shipped", "```", "",
    "```text", "a note, not an answer", "```", "",
    "```", "Ship:", "  inputs: Packed", "  outcomes: Shipped", "```", "",
    "## `t`", "", "```allegro", "proof_refl(2)", "```", "",
  ].join("\n");
  const script = parseProposals(md);
  eq(JSON.stringify([...script.byObligation.entries()]), JSON.stringify([
    ["Fulfil: Shipped, which Depot needs", ["Courier:\n  inputs: Labelled\n  outcomes: Shipped", "Ship:\n  inputs: Packed\n  outcomes: Shipped"]],
    ["t", ["proof_refl(2)"]],
  ]));
  eq(JSON.stringify(script.unnamed), JSON.stringify(["Any:\n  inputs: X"]), "a block before any section answers any obligation");
  const client = createScriptedClient({ byObligation: new Map([["t", ["proof_refl(2)"]]]), unnamed: [] });
  eq(client.modelId(), "scripted");
  eq(client.answers!("t"), true);
  eq(client.answers!("u"), false, "an obligation without a section is declined, so the loop skips it");
  eq(Object.keys(OBLIGATION_KINDS).join(", "), "theorem, plan", "the kind registry");
});

test("B-187 L3: CLI `prove --proposals` runs the loop without a key: the budget missed, then accepted", () => {
  // The L2 demo's plan has a budget, so the first proposal is refused as
  // unsolved; the proposals file lives in the test's temp directory.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "allegro-l3-cli-"));
  try {
    const proposals = path.join(dir, "proposals.md");
    fs.writeFileSync(proposals, [
      "## `Fulfil: Shipped, which Depot needs`", "",
      "```allegro", FREIGHT.trimEnd(), "```", "",
      "```allegro", SHIP.trimEnd(), "```", "",
    ].join("\n"));
    const file = path.join(testsDir, "planning-loop-proposals.alg");
    const r = spawnSync("npx", ["tsx", "src/index.ts", "prove", file, "--proposals", proposals, "--json"],
                        { encoding: "utf-8", env: { ...process.env, ANTHROPIC_API_KEY: "" } });
    eq(r.status, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    eq(out.allDischarged, true);
    eq(JSON.stringify(out.summary), JSON.stringify({ discharged: 1, pending: 0, skipped: 6 }));
    eq(out.skipped[5], "courier: Labelled, which Courier needs",
       "the demo's `courier` is an open plan too; the file has no answer for it");
    const ob = out.perObligation[0];
    eq(ob.name, "Fulfil: Shipped, which Depot needs");
    eq(ob.kind, "plan");
    eq(ob.attempts, 2);
    eq(ob.history[0].reason, "refused (unsolved): no completion of Fulfil from the catalog fits the budget of Fulfil; the cheapest, Delivered from Van, Sorted from Depot, Shipped from Freight, is duration 200 min against 160 min");
    eq(ob.history[1].verified, true);
    eq(ob.history[1].answer, "accepted: the gap is closed and the plan solved: Delivered from Van, Sorted from Depot, Shipped from Ship; bound effort 1.5 person-hours, duration 155 min");
    eq(ob.finalTerm, SHIP.trimEnd());
    eq(ob.authorship.provers[0].prover, "scripted:proposals.md");
    eq(ob.authorship.provers[0].attemptsUsed, 2);
    // The text form names each turn and the proposer.
    const text = spawnSync("npx", ["tsx", "src/index.ts", "prove", file, "--proposals", proposals],
                           { encoding: "utf-8", env: { ...process.env, ANTHROPIC_API_KEY: "" } });
    eq(text.status, 0, text.stderr);
    eq(text.stdout.includes([
      "  ✓ Fulfil: Shipped, which Depot needs (2 attempt(s))",
      `      attempt 1: ${ob.history[0].reason}`,
      "      attempt 2: accepted: the gap is closed and the plan solved: Delivered from Van, Sorted from Depot, Shipped from Ship; bound effort 1.5 person-hours, duration 155 min",
      "      entry: Ship:",
      "      by scripted:proposals.md in 2 attempt(s)",
    ].join("\n")), true, text.stdout);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
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

