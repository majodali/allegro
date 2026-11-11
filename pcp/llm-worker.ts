// =============================================================================
// PCP LLM worker (Phase H4a)
// =============================================================================
//
// Closes the central thesis loop: take an Allegro source file with one
// or more unproven `theorem` / `verify` declarations, ask Claude to
// propose proof terms, verify each via the kernel, iterate on failure
// up to a configurable attempt cap.
//
// The worker is a reference implementation of the PCP protocol. The
// SAME protocol drives H4b's human-interactive worker; the LLM
// implementation just automates the read-edit-verify loop.
//
// Layering:
//   - Pure helpers (no SDK / no API key needed): prompt construction,
//     response parsing, candidate splicing, source patching. Tested
//     directly.
//   - LLM client wrapper: thin shim around `@anthropic-ai/sdk` that
//     respects API key absence — when ANTHROPIC_API_KEY is unset, the
//     worker reports a clear "no key, can't run" error rather than
//     silently failing or hanging.
//   - Orchestration: `runLlmWorker(...)` ties them together.
//
// Output contract from the LLM is documented in
// `docs/book/proving-in-allegro.md` (the participant-neutral primer): one
// fenced ```allegro code block per pending obligation, containing
// ONLY the proof term (no `theorem` declaration, no `by` keyword).
// The worker splices each term into the corresponding theorem's `by`
// slot in the source.
//
// B-187 L3 (docs/plans/planning-loop.md, ruling R3 (a)): the loop is one
// for every obligation kind. Each kind brings its request text, its
// splice, its success test and its primer section (`OBLIGATION_KINDS`);
// theorems are the first kind, plan obligations the second, whose
// proposal is one catalog entry and whose contract is §2.9 of
// `docs/book/vivace/planning-dsl.md`. The file is loaded as the CLI's
// `pcpLoadAndEval` loads it (B-175 item 5), once, and each turn is one
// `evalSource`.
//
// B-187 L4: a time box per turn, beside the attempt limit (B-083's
// "time-boxing"). Two budgets, each optional: the client's reply
// (`replyTimeoutMs`) and the kernel's evaluation of the spliced source
// (`turnTimeoutMs`). `evalSource` is synchronous, and the evaluator has no
// wall-clock or step budget: its one guard, `MAX_DEPTH`, stops a deep
// recursion but not a loop in tail position, which the TCO loop runs
// forever. So with a kernel budget the turn's judgement runs in a worker
// thread (`pcp/turn-worker.ts`) that loads the file's modules once and is
// terminated when the budget runs out; the turn ends with the refusal kind
// `timeout`, the attempt counts, and the loop goes on. The kernel is not
// changed.

import * as fs from "fs";
import * as path from "path";

// -----------------------------------------------------------------------------
// Pure helpers (no SDK / no API key needed)
// -----------------------------------------------------------------------------

/** Extract every fenced ```allegro code block from a Markdown / mixed
 *  text response. Returns the inner text of each block, in order.
 *  Falls back to ```language (any) blocks if no allegro-tagged blocks
 *  are found — Claude sometimes tags differently. */
export function extractCodeBlocks(text: string): string[] {
  const out: string[] = [];
  // Prefer ```allegro blocks.
  const allegroRe = /```allegro\s*\n([\s\S]*?)\n```/g;
  let m: RegExpExecArray | null;
  while ((m = allegroRe.exec(text)) !== null) out.push(m[1].trim());
  if (out.length > 0) return out;
  // Fallback: any fenced block.
  const anyRe = /```[a-zA-Z]*\s*\n([\s\S]*?)\n```/g;
  while ((m = anyRe.exec(text)) !== null) out.push(m[1].trim());
  return out;
}

/** Splice a proof term into a theorem declaration in the source. The
 *  theorem may already have a `by` clause — we replace it; or it may
 *  not — we append `by <term>` before any trailing newline / next
 *  statement. Naive single-line matching: looks for
 *  `theorem <name>: <prop>` and replaces / appends.
 *
 *  Returns the new source. Throws if the theorem declaration can't be
 *  located uniquely. */
export function spliceProof(source: string, theoremName: string, proofTerm: string): string {
  // Match a `theorem NAME:` line. Allow leading whitespace.
  // The proposition may continue across the rest of the line (and not
  // beyond — we don't support multi-line propositions in the splicer).
  const escName = theoremName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const lineRe = new RegExp(
    `^([ \\t]*theorem\\s+${escName}\\s*:[^\\n]*?)(\\s+by\\s+[^\\n]+)?(\\s*)$`,
    "m",
  );
  const m = source.match(lineRe);
  if (!m) {
    throw new Error(`spliceProof: could not locate \`theorem ${theoremName}\` declaration in source`);
  }
  const head = m[1];          // "  theorem foo: 1 == 1" (no trailing by)
  const trailing = m[3] ?? "";
  const replacement = `${head} by ${proofTerm}${trailing}`;
  return source.replace(lineRe, replacement);
}

/** Build the user-message text for one iteration. Combines the obligation
 *  description (with hints from prior attempts) and a fresh restatement
 *  of the output contract. The system prompt (containing the primer) is
 *  attached separately and prompt-cached.
 *
 *  Format mirrors `formatTodo` style — bullet points, fenced
 *  propositions — so the LLM sees the same shape a human would. */
export function buildIterationMessage(args: {
  obligationName: string;
  proposition: string;
  lemmas?: string[];
  failureReason?: string;
  failureCounterexample?: string;
  hints?: Array<{ message: string; suggestedConstruct?: string }>;
  strategiesTried?: string[];
  attemptNumber: number;
}): string {
  const lines: string[] = [];
  lines.push(`Attempt ${args.attemptNumber} for theorem \`${args.obligationName}\`.`);
  lines.push("");
  lines.push("Proposition:");
  lines.push("```allegro");
  lines.push(args.proposition);
  lines.push("```");
  lines.push("");
  if (args.lemmas && args.lemmas.length > 0) {
    const top = args.lemmas.slice(0, 12).join(", ");
    const more = args.lemmas.length > 12 ? ` (+${args.lemmas.length - 12} more)` : "";
    lines.push(`Available lemmas (in scope, all discharged): ${top}${more}`);
    lines.push("");
  }
  if (args.failureReason || args.failureCounterexample) {
    lines.push("Last attempt's failure:");
    if (args.failureReason)         lines.push(`- ${args.failureReason}`);
    if (args.failureCounterexample) lines.push(`- counterexample: \`${args.failureCounterexample}\``);
    lines.push("");
  }
  if (args.hints && args.hints.length > 0) {
    lines.push("Compiler hints:");
    for (const h of args.hints) {
      lines.push(`- ${h.message}` +
        (h.suggestedConstruct ? ` (try \`${h.suggestedConstruct}\`)` : ""));
    }
    lines.push("");
  }
  if (args.strategiesTried && args.strategiesTried.length > 0) {
    lines.push(`Strategies already tried (avoid repeating): ${args.strategiesTried.join(", ")}`);
    lines.push("");
  }
  lines.push("Reply with ONE fenced ```allegro code block containing only the proof term (no `theorem` declaration, no `by` keyword). The kernel will splice it into the source.");
  return lines.join("\n");
}

/** Determine the "strategy" tag for an attempted proof term — used to
 *  populate PriorAttempt.strategiesUsed so the H3 hint generator can
 *  warn against repetition. Cheap heuristic: scan for known proof-term
 *  constructors. */
export function classifyStrategy(proofTerm: string): string[] {
  const tags = new Set<string>();
  const checks: Array<[RegExp, string]> = [
    [/\bproof_by_eval\b/,    "proof_by_eval"],
    [/\bproof_refines\b/,    "proof_refines"],
    [/\bproof_refl\b/,       "proof_refl"],
    [/\bproof_sym\b/,        "proof_sym"],
    [/\bproof_trans\b/,      "proof_trans"],
    [/\bproof_cong\b/,       "proof_cong"],
    [/\btactics\.same\b/,    "tactics.same"],
    [/\btactics\.flip\b/,    "tactics.flip"],
    [/\btactics\.under\b/,   "tactics.under"],
    [/\btactics\.step\b/,    "tactics.step"],
    [/\btactics\.chain\b/,   "tactics.chain"],
    [/\btactics\.rewrite\b/, "tactics.rewrite"],
    [/\bprove_for_all_bool\b/, "prove_for_all_bool"],
    [/\bprove_induction\b/,  "prove_induction"],
  ];
  for (const [re, tag] of checks) if (re.test(proofTerm)) tags.add(tag);
  return Array.from(tags).sort();
}

// -----------------------------------------------------------------------------
// LLM client shim
// -----------------------------------------------------------------------------

export interface LlmClientOptions {
  /** The key; `ANTHROPIC_API_KEY` when absent. B-187 L4: `prove --api-key
   *  KEY` passes it (B-175 item 6). */
  apiKey?: string;
  model?:  string;
}

export interface LlmClient {
  /** Send the system primer + iteration message; return the assistant's
   *  text response. Throws on API failure (the orchestrator catches and
   *  treats as a failed attempt). B-187 L3: `obligation` names the
   *  obligation the message is about (its `theorem.name`), for a client
   *  that answers by name, as the scripted proposer does. */
  send(args: { systemPrompt: string; userMessage: string; obligation?: string;
               /** B-187 L4: aborted when the reply's time box runs out. */
               signal?: AbortSignal }): Promise<string>;
  /** Model identifier currently in use: the prover the authorship names. */
  modelId(): string;
  /** B-187 L3: whether the client answers the named obligation at all.
   *  Absent means every one; an obligation it declines is skipped, not
   *  attempted. */
  answers?(obligation: string): boolean;
}

/** Default Anthropic client. Loads the SDK lazily so a missing API key
 *  is reported as a clear error at the right point — and so tests that
 *  exercise only the pure helpers don't pull the SDK into memory. */
export async function createAnthropicClient(opts: LlmClientOptions = {}): Promise<LlmClient> {
  const apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Set the environment variable or pass --api-key, " +
      "or use `allegro propose` (the human-interactive worker) instead.");
  }
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey });
  const model = opts.model ?? "claude-opus-4-5";
  return {
    modelId: () => model,
    async send({ systemPrompt, userMessage, signal }) {
      const resp = await client.messages.create({
        model,
        max_tokens: 2048,
        system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: userMessage }],
      }, signal ? { signal } : undefined);
      // Concatenate text blocks from the response.
      const text = resp.content
        .filter((b: any) => b.type === "text")
        .map((b: any) => b.text)
        .join("");
      return text;
    },
  };
}

// -----------------------------------------------------------------------------
// The scripted proposer (B-187 L3)
// -----------------------------------------------------------------------------
//
// A client that answers from prepared proposals, so the loop runs without a
// key and without the network (docs/plans/planning-loop.md, §1's
// done-condition). The proposals file is Markdown in the shape of the TODO
// `allegro propose` prints: a section per obligation, headed
// "## `NAME`" with the obligation's name as the TODO heads it, and under it
// one fenced ```allegro block per attempt, in the order the loop asks.
// Prose between the blocks is ignored, so a human can note why each answer
// is there. Blocks before the first such heading answer any obligation
// without a section of its own, in order.

/** Prepared proposals: the answers per obligation, in attempt order, and
 *  the answers for any obligation without a section. */
export interface ProposalScript {
  byObligation: Map<string, string[]>;
  unnamed:      string[];
}

/** Parse a proposals file (the format above). A fenced block tagged
 *  `allegro`, or untagged, is an answer; a block with another tag is not. */
export function parseProposals(text: string): ProposalScript {
  const byObligation = new Map<string, string[]>();
  const unnamed: string[] = [];
  let current: string[] = unnamed;
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const head = /^##[ \t]+`([^`]+)`[ \t]*$/.exec(lines[i]);
    if (head) {
      current = byObligation.get(head[1]) ?? [];
      byObligation.set(head[1], current);
      continue;
    }
    const fence = /^```([A-Za-z]*)[ \t]*$/.exec(lines[i]);
    if (!fence) continue;
    const body: string[] = [];
    let j = i + 1;
    while (j < lines.length && !/^```[ \t]*$/.test(lines[j])) body.push(lines[j++]);
    if (fence[1] === "" || fence[1] === "allegro") current.push(body.join("\n").trim());
    i = j;
  }
  return { byObligation, unnamed };
}

export function loadProposalsFile(file: string): ProposalScript {
  return parseProposals(fs.readFileSync(file, "utf-8"));
}

/** A client that answers each request with the next prepared proposal for
 *  the obligation it names, as one fenced ```allegro block. The prover the
 *  authorship names is `prover` ("scripted" by default; the CLI passes
 *  "scripted:FILE"). It declines an obligation it has no answer for, and
 *  throws when an obligation's answers run out. */
export function createScriptedClient(script: ProposalScript, opts: { prover?: string } = {}): LlmClient {
  const queues = new Map<string, string[]>();
  for (const [k, v] of script.byObligation) queues.set(k, [...v]);
  const unnamed = [...script.unnamed];
  const prover = opts.prover ?? "scripted";
  return {
    modelId: () => prover,
    answers: (obligation) => queues.has(obligation) || unnamed.length > 0,
    async send({ obligation }) {
      const queue = (obligation !== undefined ? queues.get(obligation) : undefined) ?? unnamed;
      const next = queue.shift();
      if (next === undefined) {
        throw new Error(`the proposals file holds no answer left for \`${obligation ?? "?"}\``);
      }
      return "```allegro\n" + next + "\n```";
    },
  };
}

// -----------------------------------------------------------------------------
// Orchestration
// -----------------------------------------------------------------------------

import {
  Obligation, ObligationKind, Verdict, Authorship, PriorAttempt, PCP_VERSION,
  buildVerdict, extractObligations, makeAuthorship,
  splicePlanProposal, answerPlanProposal, formatPlanProposalAnswer, formatPlanTodo,
} from "../src/pcp.js";
import { evalSource, Extension } from "../src/runtime.js";
import { createTypeSystem } from "../src/types-std.js";
import { ModuleLoader } from "../src/modules.js";
import { scanUses, scanImports } from "../src/use-scanner.js";
import { fileURLToPath } from "url";
import { Worker } from "node:worker_threads";

/** One attempt as the worker records it: the candidate the proposer sent
 *  (a proof term, or a node block), whether the kernel accepted it, and the
 *  kernel's reason when it did not. */
export interface AttemptRecord {
  proofTerm: string; verified: boolean; reason?: string;
  /** The kernel's answer on acceptance, when the kind gives one (a plan
   *  obligation's: the solution). */
  answer?: string;
  /** B-187 L4: a refusal the loop itself makes, when a time box ran out
   *  (the kernel's evaluation, or the client's reply). The kernel's own
   *  refusals are named in `reason`, as `refused (KIND): …`. */
  refusal?: LoopRefusal;
}

/** B-187 L4: the refusal kinds the loop adds to the protocol's: `timeout`,
 *  a turn whose time box ran out. */
export type LoopRefusal = "timeout";

/** B-187 L4: one turn as the transcript records it: the request sent, the
 *  reply and its code block, the kernel's answer verbatim, and the time
 *  each took. */
export interface TurnRecord {
  attempt:   number;
  /** The request text (the user message). */
  request:   string;
  /** The system prompt by name: the primer section, not its text. */
  primer:    string;
  /** The client's reply, whole; absent when it did not reply. */
  reply?:    string;
  /** The reply's first code block: the candidate the kernel judged. */
  candidate?: string;
  /** The kernel's answer: `accepted: …` or the refusal's text. */
  kernel:    string;
  accepted:  boolean;
  refusal?:  LoopRefusal;
  /** Wall clock of the client's reply, and of the kernel's judgement
   *  (absent when the kernel was not asked). */
  replyMs:   number;
  kernelMs?: number;
}

export interface WorkerResult {
  /** The final source after all successful splices. */
  sourceAfter:   string;
  /** Whether every initially-pending obligation eventually discharged. */
  allDischarged: boolean;
  /** One entry per obligation the worker tried to prove. */
  perObligation: Array<{
    name:        string;
    /** B-187 L3: present for a kind other than a theorem ("plan"). */
    kind?:       ObligationKind;
    discharged:  boolean;
    attempts:    number;
    finalTerm?:  string;
    authorship?: Authorship;
    history:     AttemptRecord[];
    /** B-187 L4: the turns, for the transcript. */
    turns:       TurnRecord[];
  }>;
  /** B-187 L3: the pending obligations the client has no answer for
   *  (`LlmClient.answers` false), by name; not attempted, not pending. */
  skipped?: string[];
  /** Aggregated authorship summary. */
  summary: {
    discharged: number;
    pending:    number;
    skipped:    number;
  };
  /** B-187 L4: the run's transcript (`formatTranscript` renders it). */
  transcript: Transcript;
}

export interface RunWorkerOptions {
  filename:        string;
  maxAttempts?:    number;
  /** When false, never call the LLM client — used for dry-run / testing. */
  enableLlm?:      boolean;
  client?:         LlmClient;
  /** The system prompt for every kind, in place of each kind's primer
   *  section (a test's stand-in). */
  primer?:         string;
  /** B-187 L3: the base extensions the file is loaded over; the type
   *  system alone by default, as the CLI's `pcpLoadAndEval` has it. A test
   *  passes its own, so the libraries the suite already loaded are shared. */
  extensions?:     Extension[];
  /** B-187 L4: the kernel's time box per turn, in milliseconds: the
   *  evaluation of the spliced source and the success test. Absent or 0:
   *  no box, the turn is judged in this thread (as before L4). Set: the
   *  turn is judged in a worker thread, terminated when the box runs out.
   *  `extensions` does not reach that thread, which loads the file's
   *  modules over the type system alone, as the CLI does. */
  turnTimeoutMs?:  number;
  /** B-187 L4: the client's time box per reply, in milliseconds. Absent or
   *  0: no box. */
  replyTimeoutMs?: number;
}

/** B-187 L4: the CLI's defaults. A kernel turn on the planning demos
 *  takes under 2 s (L3 measured 448,000 evaluates for the accepted turn,
 *  1.7 s for the whole scripted loop), so 30 s is fifteen times the
 *  slowest turn measured, room for a slow machine, and still no longer
 *  than a model's reply. A model's reply takes seconds to a minute at
 *  `max_tokens` 2048, so the reply's box is two minutes. */
export const DEFAULT_TURN_TIMEOUT_MS  = 30_000;
export const DEFAULT_REPLY_TIMEOUT_MS = 120_000;

/** A duration in seconds, as the refusals say it. */
export function formatSeconds(ms: number): string {
  return `${Number((ms / 1000).toFixed(3))} s`;
}

/** B-187 L4: the refusal's text when the kernel's box runs out. */
export function kernelTimeoutReason(ms: number): string {
  return `refused (timeout): the kernel did not finish within ${formatSeconds(ms)}: the proposal may make the plan's search or a proof diverge`;
}

/** B-187 L4: the refusal's text when the client's box runs out. */
export function replyTimeoutReason(ms: number): string {
  return `refused (timeout): the proposer did not reply within ${formatSeconds(ms)}`;
}

// --- Loading the file as the CLI does (B-175 item 5) -------------------------
//
// `pcpLoadAndEval` in `src/index.ts`: the `use` header's modules loaded
// over the type system, the header stripped, the body's `import`ed modules
// loaded, program prints suppressed, `evalSource` with `softFail` set. The
// modules load once per run (and once per process: the loader's library
// cache, `src/modules.ts`), so a turn of the loop is one `evalSource` over
// the spliced body. The CLI cannot share its own loader with the worker
// (`src/index.ts` runs its command line at import), so the steps are
// mirrored here.

/** The evaluator the loop calls once per turn, over the whole source (its
 *  `use` header included: it is stripped before evaluation). */
export type Evaluate = (source: string) => ReturnType<typeof evalSource>;

const systemLibDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "lib");

function loadModules(names: string[], sourceDir: string, existing: Extension[]): Promise<Extension[]> {
  if (names.length === 0) return Promise.resolve([]);
  const libDir = path.join(sourceDir, "lib");
  const loader = new ModuleLoader({
    modules: names.map(id => ({ id })),
    resolve: (id) => {
      const local = path.join(libDir, `${id}.alg`);
      if (fs.existsSync(local)) return local;
      const system = path.join(systemLibDir, `${id}.alg`);
      if (fs.existsSync(system)) return system;
      return null;
    },
    readFile: async (p) => fs.readFileSync(p, "utf-8"),
    extensions: existing,
  });
  return loader.loadAll();
}

/** Load the file's modules as `pcpLoadAndEval` does and answer the
 *  per-turn evaluator over them. */
export async function loadForLoop(
  filename: string,
  source: string,
  base?: Extension[],
): Promise<Evaluate> {
  const sourceDir = path.dirname(path.resolve(filename));
  let extensions: Extension[] = base ? [...base] : [createTypeSystem()];
  const { directives, headerEnd } = scanUses(source);
  const moduleNames = directives.filter(d => d.kind === "module").map(d => d.name!);
  extensions = [...extensions, ...await loadModules(moduleNames, sourceDir, extensions)];
  const existingNames = new Set<string>();
  for (const ext of extensions) {
    for (const name of Object.keys(ext.bindings)) existingNames.add(name);
    if (ext.moduleObject) existingNames.add(ext.name);
  }
  const imported = scanImports(source.slice(headerEnd)).filter(n => !existingNames.has(n));
  extensions = [...extensions, ...await loadModules(imported, sourceDir, extensions)];
  return (src: string) => {
    const body = src.slice(scanUses(src).headerEnd);
    const origLog = console.log;
    console.log = () => {};
    try {
      return evalSource(body, undefined, extensions, undefined, true, undefined, /*softFail*/ true);
    } finally {
      console.log = origLog;
    }
  };
}

// --- The obligation kinds (ruling R3 (a)) ------------------------------------
//
// One loop, one client shim, one authorship path; each kind of obligation
// brings four parts: the request text, the splice, the success test and the
// primer section the system prompt holds.

/** What the loop has recorded for one obligation so far. */
export interface AttemptsSoFar {
  history:       AttemptRecord[];
  /** The theorem kind's prior attempts, each with its verdict (for the
   *  failure, the hints and the strategies tried). */
  priorAttempts: PriorAttempt[];
}

export type KindSplice =
  | { ok: true; source: string }
  /** `final`: no later attempt can splice (the site is missing). */
  | { ok: false; reason: string; final: boolean };

export interface KindJudgement {
  discharged: boolean;
  /** The kernel's answer on acceptance, when the kind gives one. */
  answer?:    string;
  /** The kernel's reason, when not discharged. */
  reason?:    string;
  /** The theorem kind's prior-attempt record for the next request. */
  prior?:     PriorAttempt;
}

export interface ObligationKindSpec {
  /** The request text of one attempt. */
  request(ob: Obligation, attemptNumber: number, so: AttemptsSoFar): string;
  /** Put the candidate where the kernel reads it. */
  splice(source: string, ob: Obligation, candidate: string): KindSplice;
  /** The success test, over the spliced source: one `evaluate` call. */
  judge(args: { source: string; spliced: string; ob: Obligation; candidate: string;
                attemptNumber: number; evaluate: Evaluate }): KindJudgement;
  /** The system prompt: this kind's primer section. */
  primer(repoRoot?: string): string;
  /** B-187 L4: the primer section's name, as the transcript names it. */
  primerName: string;
}

/** Theorems: the H4a worker's parts, unchanged. */
export const theoremKind: ObligationKindSpec = {
  request(ob, attemptNumber, so) {
    const lastVerdict = so.priorAttempts[so.priorAttempts.length - 1]?.verdict;
    const lastFailure = lastVerdict?.theorems.find(t => t.name === ob.theorem.name)?.failure;
    return buildIterationMessage({
      obligationName:        ob.theorem.name,
      proposition:           ob.theorem.proposition,
      lemmas:                ob.context.lemmas,
      failureReason:         lastFailure?.reason,
      failureCounterexample: lastFailure?.counterexample,
      hints: lastVerdict?.iterationHints?.suggestions
               ?.filter(s => s.theoremName === ob.theorem.name || s.theoremName === "<global>")
               .map(s => ({ message: s.message, suggestedConstruct: s.suggestedConstruct })),
      strategiesTried: lastVerdict?.iterationHints?.strategiesTried,
      attemptNumber,
    });
  },
  splice(source, ob, candidate) {
    try {
      return { ok: true, source: spliceProof(source, ob.theorem.name, candidate) };
    } catch (e: any) {
      return { ok: false, reason: `splice error: ${e.message}`, final: true };
    }
  },
  judge({ spliced, ob, candidate, attemptNumber, evaluate }) {
    const evalRes = evaluate(spliced);
    const verdict = buildVerdict(evalRes.evalCtx, evalRes.compilationReport);
    const t = verdict.theorems.find(t => t.name === ob.theorem.name);
    if (t?.status === "discharged") return { discharged: true };
    return {
      discharged: false,
      reason: t?.failure?.reason ?? "verification failed",
      prior: { attemptNumber, candidate, verdict, strategiesUsed: classifyStrategy(candidate) },
    };
  },
  primer: (repoRoot) => loadPrimer(repoRoot),
  primerName: "`docs/book/proving-in-allegro.md`, whole",
};

/** The request text of one attempt at a plan obligation: the words of the
 *  obligation's TODO section (`formatPlanTodo`: the gap, the search so far,
 *  the catalog to extend, the hash), the last refusal's text, the attempts
 *  so far, and the output contract restated. */
export function buildPlanIterationMessage(ob: Obligation, attemptNumber: number, history: AttemptRecord[]): string {
  const p = ob.plan!;
  const lines: string[] = [];
  lines.push(`Attempt ${attemptNumber} for plan obligation \`${ob.theorem.name}\`.`);
  lines.push("");
  lines.push(...formatPlanTodo(p));
  const last = history[history.length - 1];
  if (last?.reason) {
    lines.push("Last attempt's refusal:");
    lines.push(`- ${last.reason}`);
    lines.push("");
  }
  if (history.length > 0) {
    lines.push(`Attempts so far: ${history.length}`);
    history.forEach((h, i) => {
      const entry = /^([A-Z][A-Za-z0-9_]*)[ \t]*:/.exec(h.proofTerm.trim())?.[1];
      lines.push(`- ${i + 1}: ${entry ? `\`${entry}\`` : "a reply"}, ${h.reason ?? "accepted"}`);
    });
    lines.push("");
  }
  lines.push(`Reply with ONE fenced \`\`\`allegro code block holding ONE node block that produces \`${p.port}\`, as it would appear in a plan's body, with no \`catalog\` and no \`plan\` keyword. The kernel will add it to the catalog${p.catalog ? ` \`${p.catalog}\`` : ""} and check the plan again.`);
  return lines.join("\n");
}

/** Plan obligations (B-187 L3): a proposal is one catalog entry (ruling R2
 *  (a)); the kernel's answer is `answerPlanProposal`'s. */
export const planKind: ObligationKindSpec = {
  request: (ob, attemptNumber, so) => buildPlanIterationMessage(ob, attemptNumber, so.history),
  splice(source, ob, candidate) {
    const sp = splicePlanProposal(source, ob.plan!, candidate);
    if (sp.ok) return { ok: true, source: sp.source };
    return { ok: false, final: sp.refusal === "no-catalog",
             reason: formatPlanProposalAnswer({ accepted: false, refusal: sp.refusal, message: sp.reason }) };
  },
  // The success test is the kernel's answer to the proposal: accepted when
  // the plan obligation is discharged (the open plan solved, its identity
  // hash unchanged). `answerPlanProposal` splices again from the source
  // before the turn, so the answer is the protocol's own, the refusals
  // `halt`, `open`, `unsolved`, `plan-edited` and `plan-missing` included.
  judge({ source, ob, candidate, evaluate }) {
    const a = answerPlanProposal({ source, obligation: ob, proposal: candidate, evaluate });
    return a.accepted
      ? { discharged: true, answer: formatPlanProposalAnswer(a) }
      : { discharged: false, reason: formatPlanProposalAnswer(a) };
  },
  primer: (repoRoot) => loadPlanPrimer(repoRoot),
  primerName: "§2.9 \"Output contract for a plan proposer\" of `docs/book/vivace/planning-dsl.md`",
};

/** The kind registry: an obligation without a kind is a theorem (pcp/1). */
export const OBLIGATION_KINDS: Record<ObligationKind, ObligationKindSpec> = {
  theorem: theoremKind,
  plan:    planKind,
};

// --- The kernel's time box (B-187 L4) -----------------------------------------
//
// A turn's judgement (the evaluation of the spliced source and the kind's
// success test) runs in a worker thread when the kernel has a budget. The
// thread loads the file's modules once, as `loadForLoop` does, and answers
// one judgement per message; when a judgement does not come back within the
// budget the thread is terminated, which ends any evaluation, and the next
// turn starts a fresh one. Loading the modules is not counted against the
// budget: it is the run's fixed cost, not the proposal's.

/** What the loop sends the thread for one turn. */
export interface TurnRequest {
  id:            number;
  kind:          ObligationKind;
  source:        string;
  spliced:       string;
  ob:            Obligation;
  candidate:     string;
  attemptNumber: number;
}

/** What the thread answers: the kind's judgement, or the error its
 *  evaluation threw. */
export type TurnReply =
  | { id: number; judgement: KindJudgement }
  | { id: number; error: string };

/** The thread's side: load the file once, then judge each turn. Called by
 *  `pcp/turn-worker.ts`, the thread's entry. */
export async function serveTurns(
  port: { postMessage(m: unknown): void; on(ev: "message", f: (m: TurnRequest) => void): unknown },
  data: { filename: string; source: string },
): Promise<void> {
  const evaluate = await loadForLoop(data.filename, data.source);
  port.on("message", (m) => {
    let reply: TurnReply;
    try {
      const judgement = OBLIGATION_KINDS[m.kind].judge({
        source: m.source, spliced: m.spliced, ob: m.ob, candidate: m.candidate,
        attemptNumber: m.attemptNumber, evaluate,
      });
      reply = { id: m.id, judgement };
    } catch (e: any) {
      reply = { id: m.id, error: e?.message ?? String(e) };
    }
    port.postMessage(reply);
  });
  port.postMessage({ ready: true });
}

/** The loop's side of the thread. `judge` answers the judgement, or
 *  `"timeout"` when the budget ran out (the thread is then terminated),
 *  with the time from the request to the answer. `warm` starts a thread
 *  ahead of the turn, so its load overlaps the client's reply. */
class KernelBox {
  private worker?: Worker;
  private ready?: Promise<void>;
  private pending = new Map<number, { resolve: (r: TurnReply) => void; reject: (e: Error) => void }>();
  private nextId = 1;

  constructor(private filename: string, private source: string, private budgetMs: number) {}

  private start(): Promise<void> {
    const worker = new Worker(new URL("./turn-worker.ts", import.meta.url),
                              { workerData: { filename: this.filename, source: this.source } });
    this.worker = worker;
    this.ready = new Promise<void>((resolve, reject) => {
      worker.on("message", (m: any) => {
        if (m?.ready) { resolve(); return; }
        const p = this.pending.get(m.id);
        if (p) { this.pending.delete(m.id); p.resolve(m as TurnReply); }
      });
      worker.on("error", (e: Error) => {
        reject(e);
        for (const p of this.pending.values()) p.reject(e);
        this.pending.clear();
      });
      worker.on("exit", () => { if (this.worker === worker) { this.worker = undefined; this.ready = undefined; } });
    });
    return this.ready;
  }

  warm(): void {
    if (!this.worker) this.start().catch(() => { /* reported by the next judge */ });
  }

  async judge(req: Omit<TurnRequest, "id">): Promise<{ result: KindJudgement | "timeout"; ms: number }> {
    if (!this.worker || !this.ready) await this.start(); else await this.ready;
    const worker = this.worker!;
    const id = this.nextId++;
    const postedAt = performance.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const reply = new Promise<TurnReply>((resolve, reject) => this.pending.set(id, { resolve, reject }));
    const timeout = new Promise<"timeout">(resolve => { timer = setTimeout(() => resolve("timeout"), this.budgetMs); });
    worker.postMessage({ ...req, id });
    let r: TurnReply | "timeout";
    try {
      r = await Promise.race([reply, timeout]);
    } finally {
      clearTimeout(timer);
    }
    if (r === "timeout") {
      this.pending.delete(id);
      this.worker = undefined;
      this.ready = undefined;
      await worker.terminate();
      return { result: "timeout", ms: Math.round(performance.now() - postedAt) };
    }
    if ("error" in r) throw new Error(r.error);
    return { result: r.judgement, ms: Math.round(performance.now() - postedAt) };
  }

  async close(): Promise<void> {
    const w = this.worker;
    this.worker = undefined;
    this.ready = undefined;
    if (w) await w.terminate();
  }
}

/** The client's reply within its box: the text, or `"timeout"` (the
 *  request's signal is then aborted). */
async function sendWithin(
  client: LlmClient,
  args: { systemPrompt: string; userMessage: string; obligation?: string },
  budgetMs: number | undefined,
): Promise<string | "timeout"> {
  if (!budgetMs) return client.send(args);
  const abort = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const sent = client.send({ ...args, signal: abort.signal });
  const timeout = new Promise<"timeout">(resolve => { timer = setTimeout(() => resolve("timeout"), budgetMs); });
  try {
    const r = await Promise.race([sent, timeout]);
    if (r === "timeout") { sent.catch(() => {}); abort.abort(); }
    return r;
  } finally {
    clearTimeout(timer);
  }
}

/** Drive the loop end-to-end. For each pending obligation, by its kind:
 *   1. Build the request text.
 *   2. Ask the client (within the reply's box, if any).
 *   3. Extract the candidate (the first fenced block).
 *   4. Splice it into the source.
 *   5. Judge it: one `evalSource` over the spliced source, `softFail` set
 *      (within the kernel's box, if any, in a worker thread).
 *   6. On failure, record the attempt and retry with the kernel's reason. */
export async function runLlmWorker(opts: RunWorkerOptions): Promise<WorkerResult> {
  const maxAttempts = opts.maxAttempts ?? 5;
  const startedAt = new Date().toISOString();
  let source = fs.readFileSync(opts.filename, "utf-8");
  // B-175 item 5: the file is loaded as the CLI loads it, its `use` header
  // included; the modules load once, and each turn evaluates the body.
  const evaluate = await loadForLoop(opts.filename, source, opts.extensions);

  // Initial obligation list — pending only, the plan obligations last.
  const initial = evaluate(source);
  const pending = extractObligations(initial.evalCtx, initial.compilationReport,
                                      { pendingOnly: true, sourceFile: opts.filename, plans: true });

  const client = opts.client;
  if ((opts.enableLlm ?? true) && !client) {
    throw new Error("runLlmWorker: enableLlm is true but no client supplied");
  }
  const primers = new Map<ObligationKind, string>();
  const primerOf = (kind: ObligationKind): string => {
    if (opts.primer !== undefined) return opts.primer;
    if (!primers.has(kind)) primers.set(kind, OBLIGATION_KINDS[kind].primer());
    return primers.get(kind)!;
  };
  const primerNameOf = (kind: ObligationKind): string =>
    opts.primer !== undefined ? "the caller's primer" : OBLIGATION_KINDS[kind].primerName;

  const perObligation: WorkerResult["perObligation"] = [];
  const skipped: string[] = [];
  // B-187 L4: the kernel's box, opened at the first turn it judges. The
  // thread loads the source as it stood before the loop: the modules are
  // the header's, which a proposal does not change.
  const box = opts.turnTimeoutMs ? new KernelBox(opts.filename, source, opts.turnTimeoutMs) : undefined;

  try {
    for (const ob of pending) {
      const kind: ObligationKind = ob.kind ?? "theorem";
      const spec = OBLIGATION_KINDS[kind];
      if (client?.answers && !client.answers(ob.theorem.name)) {
        skipped.push(ob.theorem.name);
        continue;
      }
      const so: AttemptsSoFar = { history: [], priorAttempts: [] };
      const history = so.history;
      const turns: TurnRecord[] = [];
      let discharged = false;
      let finalTerm: string | undefined;
      let authorship: Authorship | undefined;

      for (let attempt = 1; attempt <= maxAttempts && !discharged; attempt++) {
        const userMessage = spec.request(ob, attempt, so);
        const turn: TurnRecord = { attempt, request: userMessage, primer: primerNameOf(kind),
                                   kernel: "", accepted: false, replyMs: 0 };
        turns.push(turn);

        // Ask the client (or fail fast if disabled).
        if (!client) {
          throw new Error("runLlmWorker: client missing");
        }
        let responseText: string | "timeout";
        box?.warm();
        const sentAt = performance.now();
        try {
          responseText = await sendWithin(client,
            { systemPrompt: primerOf(kind), userMessage, obligation: ob.theorem.name }, opts.replyTimeoutMs);
        } catch (e: any) {
          turn.replyMs = Math.round(performance.now() - sentAt);
          turn.kernel = `API error: ${e.message}`;
          history.push({ proofTerm: "", verified: false, reason: `API error: ${e.message}` });
          break;
        }
        turn.replyMs = Math.round(performance.now() - sentAt);
        if (responseText === "timeout") {
          // B-187 L4: the reply's box ran out; the attempt counts.
          const reason = replyTimeoutReason(opts.replyTimeoutMs!);
          turn.kernel = reason;
          turn.refusal = "timeout";
          history.push({ proofTerm: "", verified: false, reason, refusal: "timeout" });
          continue;
        }
        turn.reply = responseText;

        const blocks = extractCodeBlocks(responseText);
        if (blocks.length === 0) {
          turn.kernel = "no fenced code block in response";
          history.push({ proofTerm: responseText, verified: false, reason: "no fenced code block in response" });
          so.priorAttempts.push({
            attemptNumber: attempt, candidate: responseText,
            verdict: { version: PCP_VERSION, verified: false, theorems: [] },
            strategiesUsed: [],
          });
          continue;
        }
        const candidate = blocks[0];
        turn.candidate = candidate;

        // Splice + judge.
        const sp = spec.splice(source, ob, candidate);
        if (!sp.ok) {
          turn.kernel = sp.reason;
          history.push({ proofTerm: candidate, verified: false, reason: sp.reason });
          if (sp.final) break;
          continue;
        }
        const judgeArgs = { source, spliced: sp.source, ob, candidate, attemptNumber: attempt };
        let j: KindJudgement | "timeout";
        if (box) {
          const boxed = await box.judge({ kind, ...judgeArgs });
          j = boxed.result;
          turn.kernelMs = boxed.ms;
        } else {
          const judgedAt = performance.now();
          j = spec.judge({ ...judgeArgs, evaluate });
          turn.kernelMs = Math.round(performance.now() - judgedAt);
        }

        if (j === "timeout") {
          // B-187 L4: the kernel's box ran out: the proposal may diverge.
          const reason = kernelTimeoutReason(opts.turnTimeoutMs!);
          turn.kernel = reason;
          turn.refusal = "timeout";
          history.push({ proofTerm: candidate, verified: false, reason, refusal: "timeout" });
          continue;
        }
        if (j.discharged) {
          discharged = true;
          finalTerm  = candidate;
          source     = sp.source;
          authorship = makeAuthorship({
            prover:           client.modelId(),
            attemptsUsed:     attempt,
            role:             "primary",
            effortBudgetUsed: { attempts: attempt },
          });
          turn.accepted = true;
          turn.kernel = j.answer ?? "accepted: the theorem is discharged";
          history.push({ proofTerm: candidate, verified: true, ...(j.answer ? { answer: j.answer } : {}) });
        } else {
          turn.kernel = j.reason ?? "verification failed";
          history.push({ proofTerm: candidate, verified: false, reason: j.reason ?? "verification failed" });
          if (j.prior) so.priorAttempts.push(j.prior);
        }
      }

      perObligation.push({
        name:       ob.theorem.name,
        ...(ob.kind && ob.kind !== "theorem" ? { kind: ob.kind } : {}),
        discharged,
        attempts:   history.length,
        finalTerm,
        authorship,
        history,
        turns,
      });
    }
  } finally {
    await box?.close();
  }

  const summary = {
    discharged: perObligation.filter(o => o.discharged).length,
    pending:    perObligation.filter(o => !o.discharged).length,
    skipped:    skipped.length,
  };
  const transcript: Transcript = {
    version:        TRANSCRIPT_VERSION,
    file:           opts.filename,
    prover:         client?.modelId() ?? "none",
    date:           startedAt,
    maxAttempts,
    ...(opts.turnTimeoutMs  ? { turnTimeoutMs:  opts.turnTimeoutMs }  : {}),
    ...(opts.replyTimeoutMs ? { replyTimeoutMs: opts.replyTimeoutMs } : {}),
    skipped,
    obligations: perObligation.map(o => ({
      name: o.name, kind: o.kind ?? "theorem", discharged: o.discharged, attempts: o.attempts,
      ...(o.authorship ? { authorship: o.authorship } : {}),
      turns: o.turns,
    })),
  };
  return {
    sourceAfter:   source,
    allDischarged: summary.pending === 0,
    perObligation,
    ...(skipped.length > 0 ? { skipped } : {}),
    summary,
    transcript,
  };
}

// --- The transcript (B-187 L4) --------------------------------------------------
//
// What a run did, for a stakeholder and for a test: per obligation its name
// and kind, and per attempt the request (the system prompt by its primer
// section's name), the reply's code block, the kernel's answer verbatim and
// the time each took; the authorship on acceptance; the prover (the model's
// name, or `scripted:FILE`) and the date. `formatTranscript` renders it as
// Markdown; the same record as JSON is its twin, which a test reads back
// without parsing Markdown (`prove --transcript FILE.md` writes both).

export const TRANSCRIPT_VERSION = "transcript/1";

export interface Transcript {
  version:         typeof TRANSCRIPT_VERSION;
  file:            string;
  /** The client's `modelId()`: the model's name, or `scripted:FILE`. */
  prover:          string;
  /** When the run started (ISO 8601). */
  date:            string;
  maxAttempts:     number;
  turnTimeoutMs?:  number;
  replyTimeoutMs?: number;
  /** The obligations the proposer declined. */
  skipped:         string[];
  obligations: Array<{
    name: string; kind: ObligationKind; discharged: boolean; attempts: number;
    authorship?: Authorship;
    turns: TurnRecord[];
  }>;
}

/** A fence longer than any run of backticks in the text. */
function fenceFor(text: string, info = ""): (body: string) => string {
  const longest = Math.max(2, ...(text.match(/`+/g) ?? []).map(r => r.length));
  const fence = "`".repeat(longest + 1);
  return (body) => `${fence}${info}\n${body}\n${fence}`;
}

/** The transcript as Markdown. */
export function formatTranscript(t: Transcript): string {
  const out: string[] = [];
  out.push(`# Transcript: \`prove ${t.file}\``, "");
  out.push(`- **Prover:** \`${t.prover}\``);
  out.push(`- **Date:** ${t.date}`);
  out.push(`- **Attempt limit:** ${t.maxAttempts} per obligation`);
  out.push(`- **Time box:** kernel ${t.turnTimeoutMs ? formatSeconds(t.turnTimeoutMs) : "none"} per turn, reply ${t.replyTimeoutMs ? formatSeconds(t.replyTimeoutMs) : "none"}`);
  out.push(`- **Attempted:** ${t.obligations.length}; **discharged:** ${t.obligations.filter(o => o.discharged).length}`);
  if (t.skipped.length > 0) {
    out.push(`- **Skipped** (the proposer has no answer): ${t.skipped.map(n => `\`${n}\``).join(", ")}`);
  }
  for (const o of t.obligations) {
    out.push("", `## \`${o.name}\` (${o.kind})`, "");
    out.push(`**Result:** ${o.discharged ? "discharged" : "pending"} after ${o.attempts} attempt(s).`);
    for (const turn of o.turns) {
      out.push("", `### Attempt ${turn.attempt}`, "");
      out.push(`**Request** (system prompt: ${turn.primer}):`, "");
      out.push(fenceFor(turn.request, "text")(turn.request), "");
      if (turn.reply === undefined) {
        out.push(`**Reply** (${turn.replyMs} ms): none.`, "");
      } else if (turn.candidate === undefined) {
        out.push(`**Reply** (${turn.replyMs} ms), no code block:`, "");
        out.push(fenceFor(turn.reply, "text")(turn.reply), "");
      } else {
        out.push(`**Reply** (${turn.replyMs} ms), its code block:`, "");
        out.push(fenceFor(turn.candidate, "allegro")(turn.candidate), "");
      }
      out.push(`**Kernel**${turn.kernelMs !== undefined ? ` (${turn.kernelMs} ms)` : ""}:`, "");
      out.push(fenceFor(turn.kernel, "text")(turn.kernel));
    }
    if (o.authorship) {
      out.push("", "### Authorship", "");
      out.push(fenceFor("", "json")(JSON.stringify(o.authorship, null, 2)));
    }
  }
  return out.join("\n") + "\n";
}

/** The JSON twin's path beside a transcript: `FILE.md` becomes `FILE.json`. */
export function transcriptJsonPath(file: string): string {
  return file.replace(/\.md$/i, "") + ".json";
}

// --- The `prove` command's options (B-187 L4) ----------------------------------

export interface ProveOptions {
  maxAttempts:    number;
  model?:         string;
  outputPath?:    string;
  asJson:         boolean;
  proposalsPath?: string;
  /** `--api-key KEY` (B-175 item 6); `ANTHROPIC_API_KEY` when absent. */
  apiKey?:        string;
  /** `--turn-timeout MS`, `DEFAULT_TURN_TIMEOUT_MS` by default; 0: no box. */
  turnTimeoutMs:  number;
  /** `--reply-timeout MS`, `DEFAULT_REPLY_TIMEOUT_MS` by default; 0: no box. */
  replyTimeoutMs: number;
  /** `--transcript FILE.md`: the transcript, and its JSON twin beside it. */
  transcriptPath?: string;
}

/** Parse `prove`'s flags from the command line's arguments. Answers the
 *  options, or the error to print. */
export function parseProveArgs(argv: string[]): ProveOptions | { error: string } {
  const value = (flag: string): string | undefined | null => {
    const i = argv.indexOf(flag);
    if (i < 0) return undefined;
    const v = argv[i + 1];
    return v === undefined || v.startsWith("--") ? null : v;
  };
  const opts: ProveOptions = {
    maxAttempts: 5, asJson: argv.includes("--json"),
    turnTimeoutMs: DEFAULT_TURN_TIMEOUT_MS, replyTimeoutMs: DEFAULT_REPLY_TIMEOUT_MS,
  };
  const strings: Array<[string, "model" | "outputPath" | "proposalsPath" | "apiKey" | "transcriptPath"]> = [
    ["--model", "model"], ["--output", "outputPath"], ["--proposals", "proposalsPath"],
    ["--api-key", "apiKey"], ["--transcript", "transcriptPath"],
  ];
  for (const [flag, key] of strings) {
    const v = value(flag);
    if (v === null) return { error: `${flag} takes a value` };
    if (v !== undefined) opts[key] = v;
  }
  const max = value("--max-attempts");
  if (max === null) return { error: "--max-attempts takes a value" };
  if (max !== undefined) opts.maxAttempts = Number(max);
  const millis: Array<[string, "turnTimeoutMs" | "replyTimeoutMs"]> = [
    ["--turn-timeout", "turnTimeoutMs"], ["--reply-timeout", "replyTimeoutMs"],
  ];
  for (const [flag, key] of millis) {
    const v = value(flag);
    if (v === undefined) continue;
    if (v === null || !/^\d+$/.test(v)) return { error: `${flag} takes milliseconds, a whole number (0: no time box)` };
    opts[key] = Number(v);
  }
  return opts;
}

/** Load the participant-neutral primer from `docs/book/proving-in-allegro.md`
 *  — same text humans read, same text the LLM gets in its system prompt.
 *  Looks up relative to the cwd or an explicit repo root. */
export function loadPrimer(repoRoot?: string): string {
  const candidates = [
    repoRoot && path.join(repoRoot, "docs", "book", "proving-in-allegro.md"),
    path.join(process.cwd(), "docs", "book", "proving-in-allegro.md"),
  ].filter(Boolean) as string[];
  for (const c of candidates) {
    if (fs.existsSync(c)) return fs.readFileSync(c, "utf-8");
  }
  throw new Error(`primer not found; tried: ${candidates.join(", ")}`);
}

/** B-187 L3: the primer section for plan obligations, §2.9 "Output
 *  contract for a plan proposer" of `docs/book/vivace/planning-dsl.md`,
 *  from its heading to the next heading of its level or above. Looked up
 *  as `loadPrimer` looks up its file. */
export function loadPlanPrimer(repoRoot?: string): string {
  const rel = path.join("docs", "book", "vivace", "planning-dsl.md");
  const candidates = [
    repoRoot && path.join(repoRoot, rel),
    path.join(process.cwd(), rel),
  ].filter(Boolean) as string[];
  for (const c of candidates) {
    if (!fs.existsSync(c)) continue;
    const lines = fs.readFileSync(c, "utf-8").split("\n");
    const start = lines.findIndex(l => /^### 2\.9 Output contract for a plan proposer/.test(l));
    if (start < 0) throw new Error(`plan primer section not found in ${c}`);
    let end = lines.length;
    for (let i = start + 1; i < lines.length; i++) {
      if (/^#{1,3} /.test(lines[i])) { end = i; break; }
    }
    return lines.slice(start, end).join("\n").trimEnd() + "\n";
  }
  throw new Error(`plan primer not found; tried: ${candidates.join(", ")}`);
}
