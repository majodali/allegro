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
  apiKey?: string;
  model?:  string;
}

export interface LlmClient {
  /** Send the system primer + iteration message; return the assistant's
   *  text response. Throws on API failure (the orchestrator catches and
   *  treats as a failed attempt). B-187 L3: `obligation` names the
   *  obligation the message is about (its `theorem.name`), for a client
   *  that answers by name, as the scripted proposer does. */
  send(args: { systemPrompt: string; userMessage: string; obligation?: string }): Promise<string>;
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
    async send({ systemPrompt, userMessage }) {
      const resp = await client.messages.create({
        model,
        max_tokens: 2048,
        system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: userMessage }],
      });
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

/** One attempt as the worker records it: the candidate the proposer sent
 *  (a proof term, or a node block), whether the kernel accepted it, and the
 *  kernel's reason when it did not. */
export interface AttemptRecord { proofTerm: string; verified: boolean; reason?: string }

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
    return a.accepted ? { discharged: true } : { discharged: false, reason: formatPlanProposalAnswer(a) };
  },
  primer: (repoRoot) => loadPlanPrimer(repoRoot),
};

/** The kind registry: an obligation without a kind is a theorem (pcp/1). */
export const OBLIGATION_KINDS: Record<ObligationKind, ObligationKindSpec> = {
  theorem: theoremKind,
  plan:    planKind,
};

/** Drive the loop end-to-end. For each pending obligation, by its kind:
 *   1. Build the request text.
 *   2. Ask the client.
 *   3. Extract the candidate (the first fenced block).
 *   4. Splice it into the source.
 *   5. Judge it: one `evalSource` over the spliced source, `softFail` set.
 *   6. On failure, record the attempt and retry with the kernel's reason. */
export async function runLlmWorker(opts: RunWorkerOptions): Promise<WorkerResult> {
  const maxAttempts = opts.maxAttempts ?? 5;
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

  const perObligation: WorkerResult["perObligation"] = [];
  const skipped: string[] = [];

  for (const ob of pending) {
    const kind: ObligationKind = ob.kind ?? "theorem";
    const spec = OBLIGATION_KINDS[kind];
    if (client?.answers && !client.answers(ob.theorem.name)) {
      skipped.push(ob.theorem.name);
      continue;
    }
    const so: AttemptsSoFar = { history: [], priorAttempts: [] };
    const history = so.history;
    let discharged = false;
    let finalTerm: string | undefined;
    let authorship: Authorship | undefined;

    for (let attempt = 1; attempt <= maxAttempts && !discharged; attempt++) {
      const userMessage = spec.request(ob, attempt, so);

      // Ask the client (or fail fast if disabled).
      if (!client) {
        throw new Error("runLlmWorker: client missing");
      }
      let responseText: string;
      try {
        responseText = await client.send({ systemPrompt: primerOf(kind), userMessage, obligation: ob.theorem.name });
      } catch (e: any) {
        history.push({ proofTerm: "", verified: false, reason: `API error: ${e.message}` });
        break;
      }

      const blocks = extractCodeBlocks(responseText);
      if (blocks.length === 0) {
        history.push({ proofTerm: responseText, verified: false, reason: "no fenced code block in response" });
        so.priorAttempts.push({
          attemptNumber: attempt, candidate: responseText,
          verdict: { version: PCP_VERSION, verified: false, theorems: [] },
          strategiesUsed: [],
        });
        continue;
      }
      const candidate = blocks[0];

      // Splice + judge.
      const sp = spec.splice(source, ob, candidate);
      if (!sp.ok) {
        history.push({ proofTerm: candidate, verified: false, reason: sp.reason });
        if (sp.final) break;
        continue;
      }
      const j = spec.judge({ source, spliced: sp.source, ob, candidate, attemptNumber: attempt, evaluate });

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
        history.push({ proofTerm: candidate, verified: true });
      } else {
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
    });
  }

  const summary = {
    discharged: perObligation.filter(o => o.discharged).length,
    pending:    perObligation.filter(o => !o.discharged).length,
    skipped:    skipped.length,
  };
  return {
    sourceAfter:   source,
    allDischarged: summary.pending === 0,
    perObligation,
    ...(skipped.length > 0 ? { skipped } : {}),
    summary,
  };
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
