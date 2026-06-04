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
// `docs/proving-in-allegro.md` (the participant-neutral primer): one
// fenced ```allegro code block per pending obligation, containing
// ONLY the proof term (no `theorem` declaration, no `by` keyword).
// The worker splices each term into the corresponding theorem's `by`
// slot in the source.

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
   *  treats as a failed attempt). */
  send(args: { systemPrompt: string; userMessage: string }): Promise<string>;
  /** Model identifier currently in use. */
  modelId(): string;
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
// Primer loader
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// Orchestration
// -----------------------------------------------------------------------------

import {
  Obligation, Verdict, Authorship, PriorAttempt,
  buildVerdict, extractObligations, makeAuthorship,
} from "../src/pcp.js";
import { evalSource } from "../src/runtime.js";
import { createTypeSystem } from "../src/types-std.js";

export interface WorkerResult {
  /** The final source after all successful splices. */
  sourceAfter:   string;
  /** Whether every initially-pending obligation eventually discharged. */
  allDischarged: boolean;
  /** One entry per obligation the worker tried to prove. */
  perObligation: Array<{
    name:        string;
    discharged:  boolean;
    attempts:    number;
    finalTerm?:  string;
    authorship?: Authorship;
    history:     Array<{ proofTerm: string; verified: boolean; reason?: string }>;
  }>;
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
  primer?:         string;
}

/** Drive the loop end-to-end. For each pending obligation:
 *   1. Build the iteration message.
 *   2. Ask the client.
 *   3. Extract the proof term.
 *   4. Splice into source.
 *   5. Verify by re-evaluating in `softFail` mode.
 *   6. On failure, record the attempt and retry with hints. */
export async function runLlmWorker(opts: RunWorkerOptions): Promise<WorkerResult> {
  const maxAttempts = opts.maxAttempts ?? 5;
  let source = fs.readFileSync(opts.filename, "utf-8");
  const typeExt = createTypeSystem();

  // Initial obligation list — pending only.
  const initial = evalSource(source, undefined, [typeExt], undefined, true,
                             undefined, /*softFail*/ true);
  const pending = extractObligations(initial.evalCtx, initial.compilationReport,
                                      { pendingOnly: true, sourceFile: opts.filename });

  const primer = opts.primer ?? loadPrimer();
  const client = opts.client;
  if ((opts.enableLlm ?? true) && !client) {
    throw new Error("runLlmWorker: enableLlm is true but no client supplied");
  }

  const perObligation: WorkerResult["perObligation"] = [];

  for (const ob of pending) {
    const history: Array<{ proofTerm: string; verified: boolean; reason?: string }> = [];
    const priorAttempts: PriorAttempt[] = [];
    let discharged = false;
    let finalTerm: string | undefined;
    let authorship: Authorship | undefined;

    for (let attempt = 1; attempt <= maxAttempts && !discharged; attempt++) {
      // Build the message using whatever hints accumulated in priorAttempts.
      // We re-build a verdict-shaped picture from the most recent prior attempt.
      const lastVerdict = priorAttempts[priorAttempts.length - 1]?.verdict;
      const lastFailure = lastVerdict?.theorems.find(t => t.name === ob.theorem.name)?.failure;
      const userMessage = buildIterationMessage({
        obligationName:        ob.theorem.name,
        proposition:           ob.theorem.proposition,
        lemmas:                ob.context.lemmas,
        failureReason:         lastFailure?.reason,
        failureCounterexample: lastFailure?.counterexample,
        hints: lastVerdict?.iterationHints?.suggestions
                 ?.filter(s => s.theoremName === ob.theorem.name || s.theoremName === "<global>")
                 .map(s => ({ message: s.message, suggestedConstruct: s.suggestedConstruct })),
        strategiesTried: lastVerdict?.iterationHints?.strategiesTried,
        attemptNumber:   attempt,
      });

      // Ask the client (or fail fast if disabled).
      if (!client) {
        throw new Error("runLlmWorker: client missing");
      }
      let responseText: string;
      try {
        responseText = await client.send({ systemPrompt: primer, userMessage });
      } catch (e: any) {
        history.push({ proofTerm: "", verified: false, reason: `API error: ${e.message}` });
        break;
      }

      const blocks = extractCodeBlocks(responseText);
      if (blocks.length === 0) {
        history.push({ proofTerm: responseText, verified: false, reason: "no fenced code block in response" });
        priorAttempts.push({
          attemptNumber: attempt, candidate: responseText,
          verdict: { version: "pcp/1", verified: false, theorems: [] },
          strategiesUsed: [],
        });
        continue;
      }
      const proofTerm = blocks[0];

      // Splice + verify.
      let candidateSource: string;
      try {
        candidateSource = spliceProof(source, ob.theorem.name, proofTerm);
      } catch (e: any) {
        history.push({ proofTerm, verified: false, reason: `splice error: ${e.message}` });
        break;
      }
      const evalRes = evalSource(candidateSource, undefined, [typeExt], undefined, true,
                                  undefined, /*softFail*/ true);
      const verdict = buildVerdict(evalRes.evalCtx, evalRes.compilationReport);
      const t = verdict.theorems.find(t => t.name === ob.theorem.name);

      if (t?.status === "discharged") {
        discharged = true;
        finalTerm  = proofTerm;
        source     = candidateSource;
        authorship = makeAuthorship({
          prover:           client.modelId(),
          attemptsUsed:     attempt,
          role:             "primary",
          effortBudgetUsed: { attempts: attempt },
        });
        history.push({ proofTerm, verified: true });
      } else {
        history.push({
          proofTerm,
          verified: false,
          reason:   t?.failure?.reason ?? "verification failed",
        });
        priorAttempts.push({
          attemptNumber: attempt,
          candidate:     proofTerm,
          verdict,
          strategiesUsed: classifyStrategy(proofTerm),
        });
      }
    }

    perObligation.push({
      name:       ob.theorem.name,
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
    skipped:    0,
  };
  return {
    sourceAfter:   source,
    allDischarged: summary.pending === 0,
    perObligation,
    summary,
  };
}

/** Load the participant-neutral primer from `docs/proving-in-allegro.md`
 *  — same text humans read, same text the LLM gets in its system prompt.
 *  Looks up relative to the cwd or an explicit repo root. */
export function loadPrimer(repoRoot?: string): string {
  const candidates = [
    repoRoot && path.join(repoRoot, "docs", "proving-in-allegro.md"),
    path.join(process.cwd(), "docs", "proving-in-allegro.md"),
  ].filter(Boolean) as string[];
  for (const c of candidates) {
    if (fs.existsSync(c)) return fs.readFileSync(c, "utf-8");
  }
  throw new Error(`primer not found; tried: ${candidates.join(", ")}`);
}
