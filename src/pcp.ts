// =============================================================================
// Proof Collaboration Protocol (PCP) — Phase H, Chunk 1
// =============================================================================
//
// PCP is the participant-neutral protocol for closing the loop between a
// PROVER (LLM, human, SMT, hybrid) and the Allegro verification kernel.
// H1 ships the three canonical on-disk schemas:
//
//   - Obligation  — what needs to be proved (function, theorem,
//                   context, prior attempts)
//   - Verdict     — what the verifier emits after consuming a candidate
//                   (pass/fail per theorem with counterexamples)
//   - Authorship  — provenance on each discharged theorem
//                   (ordered list of provers, attempts, budget used)
//
// **JSON is canonical.** External tools (IDEs, build systems, LLM
// agents, human-interactive workers) consume the JSON and render to
// users as they see fit. The plain-text renderers in this file are
// minimal — adequate for direct CLI use, not engineered for rich
// presentation.
//
// **Schema version is "pcp/1".** Forward-compatible additions get
// bumped to pcp/1.1 etc.; breaking changes go to pcp/2.

import type { ContextValue, BitsValue } from "./types.js";
import { ValueKind, primaryOf, bitsToString } from "./types.js";
import { isDischargedProof, isFailedProof } from "./proofs.js";
import type { CompilationReport, Notification } from "./runtime.js";

export const PCP_VERSION = "pcp/1" as const;

// =============================================================================
// Obligation
// =============================================================================

/** A proof burden the compiler describes to a prover. */
export interface Obligation {
  version: typeof PCP_VERSION;
  theorem: TheoremStatement;
  /** Set when the obligation is attached to a function via `proven`. */
  function?: FunctionSignature;
  context: ObligationContext;
  /** Empty on first try; populated by the worker across iterations. */
  priorAttempts?: PriorAttempt[];
}

export interface TheoremStatement {
  /** Source-level binding name, or `"<verify>"` for anonymous `verify`. */
  name: string;
  /** Source-rendered proposition text, e.g. `"abs(abs(13)) == abs(13)"`. */
  proposition: string;
  /** Stable hash of the proposition for change detection. */
  propositionHash: string;
  /** Optional source location for tooling. */
  location?: SourceLocation;
}

export interface FunctionSignature {
  name: string;
  /** Source-rendered signature, e.g. `"(x: NonNeg): Int"`. */
  signature: string;
  paramTypes: string[];
  /** Omitted when the return type isn't annotated. */
  returnType?: string;
}

export interface ObligationContext {
  /** Names of imported libs in scope. */
  imports: string[];
  /** Names of discharged theorems available as lemmas. */
  lemmas: string[];
}

export interface PriorAttempt {
  attemptNumber: number;
  /** The candidate `.alg` snippet that was tried. */
  candidate: string;
  /** Verifier's response to that candidate. */
  verdict: Verdict;
}

export interface SourceLocation {
  file?: string;
  line?: number;
  column?: number;
}

// =============================================================================
// Verdict
// =============================================================================

/** What `allegro verify` emits after consuming a candidate. */
export interface Verdict {
  version: typeof PCP_VERSION;
  /** True iff every theorem in the candidate is discharged AND no other
   *  fatal diagnostics fired. */
  verified: boolean;
  /** One entry per theorem the verifier saw, in source order. */
  theorems: TheoremResult[];
  /** Totality (Phase E) findings — non-fatal by default, surfaced for
   *  the prover to optionally address. */
  totalityFindings?: TotalityFinding[];
  /** Effects-declaration mismatches (Phase D1) — fatal. */
  effectMismatches?: EffectMismatch[];
}

export type TheoremStatus = "discharged" | "failed" | "skipped";

export interface TheoremResult {
  name: string;
  /** Source-rendered proposition (echoed from the obligation if any). */
  proposition: string;
  status: TheoremStatus;
  /** Set when status === "discharged". */
  authorship?: Authorship;
  /** Set when status === "failed" or "skipped". */
  failure?: TheoremFailure;
}

export interface TheoremFailure {
  /** Stable rule tag, e.g. "proof-failure" / "proven-failed" /
   *  "proven-skipped". Mirrors `Notification.kind`. */
  kind: string;
  /** Human-readable explanation. */
  reason: string;
  /** Concrete counterexample (Phase E Stage 6 + F-arc), when available. */
  counterexample?: string;
}

export interface TotalityFinding {
  binding: string;
  kind: string;          // "totality-exhaustiveness" / "totality-nontermination" / …
  message: string;
  counterexample?: string;
}

export interface EffectMismatch {
  binding: string;
  declared: string[];
  inferred: string[];
  /** Labels in `inferred` but not in `declared`. */
  missing: string[];
}

// =============================================================================
// Authorship
// =============================================================================

/** Provenance on a discharged theorem. Multi-prover proofs (e.g. LLM
 *  proposed, human reviewed) carry an ordered list of contributors. */
export interface Authorship {
  /** Ordered: primary author first, then reviewers / tactic-fillers. */
  provers: ProverRecord[];
  /** ISO 8601 UTC timestamp at which the verifier accepted the proof. */
  verifiedAt: string;
}

export interface ProverRecord {
  /** Identity string. Conventions:
   *  - `"auto-PE"`         — discharged by the kernel itself, no prover
   *  - `"claude-opus-4-7"` — LLM identifier
   *  - `"user:alice@…"`    — human (git config email or similar)
   *  - `"smt:z3"`          — SMT-backed prover (future) */
  prover: string;
  /** Free-form version tag, e.g. `"2026-05"` for a model release. */
  proverVersion?: string;
  /** Iterations consumed before convergence. */
  attemptsUsed?: number;
  /** Effort consumed; only the fields relevant to the prover kind. */
  effortBudgetUsed?: EffortBudget;
  /** Defaults to "primary" when omitted. */
  role?: ProverRole;
}

export type ProverRole = "primary" | "review" | "tactic-fill";

export interface EffortBudget {
  tokens?:      number; // LLM
  wallTimeMs?:  number; // human / wall-clock
  attempts?:    number;
}

// =============================================================================
// Stable proposition hashing
// =============================================================================
//
// Used for `Obligation.theorem.propositionHash` so workers can detect
// "this is the same theorem I was working on" across iterations even if
// source whitespace or comments shifted slightly. djb2 — deterministic,
// dependency-free, browser-safe. Not security-grade; change-detection only.

export function hashProposition(propositionSource: string): string {
  // Canonicalize: collapse runs of whitespace to single space, trim.
  const canon = propositionSource.replace(/\s+/g, " ").trim();
  let h = 5381n;
  for (let i = 0; i < canon.length; i++) {
    h = ((h << 5n) + h + BigInt(canon.charCodeAt(i))) & 0xffffffffn;
  }
  return h.toString(16).padStart(8, "0");
}

// =============================================================================
// JSON serializers (round-trip stable)
// =============================================================================
//
// `JSON.stringify` / `JSON.parse` round-trip these correctly already
// because every field is a plain string / number / boolean / array /
// object. The wrappers below add validation: catch malformed input
// before downstream code trusts it.

export function serializeObligation(o: Obligation): string {
  return JSON.stringify(o);
}

export function parseObligation(text: string): Obligation {
  const raw = JSON.parse(text);
  validateObligation(raw);
  return raw as Obligation;
}

export function serializeVerdict(v: Verdict): string {
  return JSON.stringify(v);
}

export function parseVerdict(text: string): Verdict {
  const raw = JSON.parse(text);
  validateVerdict(raw);
  return raw as Verdict;
}

export function serializeAuthorship(a: Authorship): string {
  return JSON.stringify(a);
}

export function parseAuthorship(text: string): Authorship {
  const raw = JSON.parse(text);
  validateAuthorship(raw);
  return raw as Authorship;
}

function _require(cond: any, msg: string): void {
  if (!cond) throw new Error(`PCP: ${msg}`);
}

function validateObligation(o: any): void {
  _require(o && typeof o === "object",            "obligation must be an object");
  _require(o.version === PCP_VERSION,             `unsupported version: ${o.version}`);
  _require(o.theorem && typeof o.theorem === "object", "obligation.theorem missing");
  _require(typeof o.theorem.name === "string",    "theorem.name must be a string");
  _require(typeof o.theorem.proposition === "string", "theorem.proposition must be a string");
  _require(typeof o.theorem.propositionHash === "string", "theorem.propositionHash must be a string");
  _require(o.context && typeof o.context === "object", "obligation.context missing");
  _require(Array.isArray(o.context.imports),      "context.imports must be an array");
  _require(Array.isArray(o.context.lemmas),       "context.lemmas must be an array");
  if (o.priorAttempts !== undefined) {
    _require(Array.isArray(o.priorAttempts),      "priorAttempts must be an array if present");
  }
}

function validateVerdict(v: any): void {
  _require(v && typeof v === "object",            "verdict must be an object");
  _require(v.version === PCP_VERSION,             `unsupported version: ${v.version}`);
  _require(typeof v.verified === "boolean",       "verdict.verified must be a boolean");
  _require(Array.isArray(v.theorems),             "verdict.theorems must be an array");
  for (const t of v.theorems) {
    _require(typeof t.name === "string",          "theorem.name must be a string");
    _require(typeof t.proposition === "string",   "theorem.proposition must be a string");
    _require(
      t.status === "discharged" || t.status === "failed" || t.status === "skipped",
      `theorem.status must be discharged/failed/skipped, got ${t.status}`,
    );
  }
}

function validateAuthorship(a: any): void {
  _require(a && typeof a === "object",            "authorship must be an object");
  _require(Array.isArray(a.provers) && a.provers.length > 0,
                                                  "authorship.provers must be a non-empty array");
  _require(typeof a.verifiedAt === "string",      "authorship.verifiedAt must be an ISO string");
  for (const p of a.provers) {
    _require(typeof p.prover === "string",        "prover.prover must be a string");
  }
}

// =============================================================================
// Builders (used by the verifier, the workers, and tests)
// =============================================================================

/** Build an Obligation describing a theorem. */
export function makeObligation(args: {
  theoremName: string;
  proposition: string;
  function?: FunctionSignature;
  imports?: string[];
  lemmas?: string[];
  priorAttempts?: PriorAttempt[];
  location?: SourceLocation;
}): Obligation {
  return {
    version: PCP_VERSION,
    theorem: {
      name:            args.theoremName,
      proposition:     args.proposition,
      propositionHash: hashProposition(args.proposition),
      ...(args.location ? { location: args.location } : {}),
    },
    ...(args.function ? { function: args.function } : {}),
    context: {
      imports: args.imports ?? [],
      lemmas:  args.lemmas  ?? [],
    },
    ...(args.priorAttempts ? { priorAttempts: args.priorAttempts } : {}),
  };
}

/** Build an Authorship record for a single prover (the common case). */
export function makeAuthorship(args: {
  prover: string;
  proverVersion?: string;
  attemptsUsed?: number;
  effortBudgetUsed?: EffortBudget;
  role?: ProverRole;
  verifiedAt?: string;
}): Authorship {
  return {
    provers: [
      {
        prover: args.prover,
        ...(args.proverVersion    !== undefined ? { proverVersion:    args.proverVersion }    : {}),
        ...(args.attemptsUsed     !== undefined ? { attemptsUsed:     args.attemptsUsed }     : {}),
        ...(args.effortBudgetUsed !== undefined ? { effortBudgetUsed: args.effortBudgetUsed } : {}),
        ...(args.role             !== undefined ? { role:             args.role }             : {}),
      },
    ],
    verifiedAt: args.verifiedAt ?? new Date().toISOString(),
  };
}

/** The canonical attribution for proofs the kernel discharges itself
 *  (PE-as-discharge, F2 refinement-domain entailment, etc.). */
export const AUTO_PE_AUTHORSHIP = (): Authorship =>
  makeAuthorship({ prover: "auto-PE" });

// =============================================================================
// Basic plain-text renderers
// =============================================================================
//
// Minimal — adequate for direct CLI use only. IDEs and external tools
// should consume the JSON and render to users themselves.

export function formatObligation(o: Obligation): string {
  const lines: string[] = [];
  lines.push(`Obligation: theorem \`${o.theorem.name}\``);
  lines.push(`  proposition: ${o.theorem.proposition}`);
  lines.push(`  hash:        ${o.theorem.propositionHash}`);
  if (o.function) {
    lines.push(`  function:    ${o.function.name} ${o.function.signature}`);
  }
  if (o.context.imports.length > 0) {
    lines.push(`  imports:     ${o.context.imports.join(", ")}`);
  }
  if (o.context.lemmas.length > 0) {
    lines.push(`  lemmas:      ${o.context.lemmas.join(", ")}`);
  }
  if (o.priorAttempts && o.priorAttempts.length > 0) {
    lines.push(`  prior attempts: ${o.priorAttempts.length}`);
    for (const pa of o.priorAttempts) {
      lines.push(`    #${pa.attemptNumber}: verified=${pa.verdict.verified}`);
    }
  }
  return lines.join("\n");
}

export function formatVerdict(v: Verdict): string {
  const lines: string[] = [];
  const total      = v.theorems.length;
  const discharged = v.theorems.filter(t => t.status === "discharged").length;
  const failed     = v.theorems.filter(t => t.status === "failed").length;
  const skipped    = v.theorems.filter(t => t.status === "skipped").length;
  lines.push(
    `Verdict (${v.verified ? "verified" : "FAILED"}): ` +
    `${discharged}/${total} discharged` +
    (failed > 0 ? `, ${failed} failed` : "") +
    (skipped > 0 ? `, ${skipped} skipped` : ""),
  );
  for (const t of v.theorems) {
    const mark =
      t.status === "discharged" ? "✓" :
      t.status === "failed"     ? "✗" : "?";
    const author = t.authorship
      ? ` — by ${t.authorship.provers.map(p => p.prover).join(" + ")}`
      : "";
    lines.push(`  ${mark} ${t.name}${author}`);
    if (t.failure) {
      lines.push(`      ${t.failure.reason}`);
      if (t.failure.counterexample) {
        lines.push(`      counterexample: ${t.failure.counterexample}`);
      }
    }
  }
  if (v.totalityFindings && v.totalityFindings.length > 0) {
    lines.push(`  totality:`);
    for (const tf of v.totalityFindings) {
      lines.push(`    [${tf.binding}] ${tf.message}`);
      if (tf.counterexample) {
        lines.push(`      counterexample: ${tf.counterexample}`);
      }
    }
  }
  if (v.effectMismatches && v.effectMismatches.length > 0) {
    lines.push(`  effects mismatches:`);
    for (const em of v.effectMismatches) {
      lines.push(`    [${em.binding}] declared=${em.declared.join(",") || "∅"} inferred=${em.inferred.join(",") || "∅"} missing=${em.missing.join(",") || "∅"}`);
    }
  }
  return lines.join("\n");
}

// =============================================================================
// Conversion: internal compiler state → PCP wire shapes (H2)
// =============================================================================
//
// `buildVerdict` and `extractObligations` are the bridge between the
// evaluator's internal state (evalCtx + CompilationReport) and the PCP
// JSON formats. CLI subcommands + workers consume these to surface the
// verifier's view to external provers.

function _ctxString(ctx: ContextValue, key: string): string | undefined {
  const b = ctx.bindings.get(key)?.value;
  if (!b) return undefined;
  const p = primaryOf(b);
  return p.kind === ValueKind.Bits ? bitsToString(p as BitsValue) : undefined;
}

/** Build a Verdict by walking evalCtx + the CompilationReport. Every
 *  Proof-typed binding becomes a TheoremResult; totality findings and
 *  effect mismatches are pulled from notifications. `verified` is true
 *  iff every theorem discharged and no error-severity notification fired
 *  (effects-mismatch, return-type-mismatch, …). */
export function buildVerdict(
  evalCtx: ContextValue,
  report: CompilationReport | undefined,
): Verdict {
  const theorems: TheoremResult[] = [];
  for (const [key, binding] of evalCtx.bindings) {
    const v = binding.value;
    if (!v) continue;
    if (isDischargedProof(v)) {
      const ctx = primaryOf(v) as ContextValue;
      theorems.push({
        name: key,
        proposition: _ctxString(ctx, "__proposition") ?? "<unknown>",
        status: "discharged",
        authorship: AUTO_PE_AUTHORSHIP(),
      });
    } else if (isFailedProof(v)) {
      const ctx = primaryOf(v) as ContextValue;
      theorems.push({
        name: key,
        proposition: _ctxString(ctx, "__proposition") ?? "<unknown>",
        status: "failed",
        failure: {
          kind: "proof-failure",
          reason: _ctxString(ctx, "__reason") ?? "proof did not discharge",
          counterexample: _ctxString(ctx, "__counterexample"),
        },
      });
    }
  }

  const totalityFindings: TotalityFinding[] = [];
  const effectMismatches: EffectMismatch[] = [];
  let anyError = false;
  if (report) {
    for (const n of report.notifications) {
      if (n.severity === "error") anyError = true;
      if (n.kind.startsWith("totality-")) {
        totalityFindings.push({
          binding: n.binding ?? "?",
          kind: n.kind,
          message: n.message,
          counterexample: n.counterexample,
        });
      } else if (n.kind === "effects-mismatch") {
        // The Notification carries the formatted message; parsing declared/
        // inferred/missing out of it is best-effort. Surface message
        // verbatim and leave structured fields empty for H2 minimum.
        effectMismatches.push({
          binding: n.binding ?? "?",
          declared: [],
          inferred: [],
          missing:  [],
        });
      } else if (n.kind === "proof-failure") {
        // Failed `theorem` / `verify` (bare and named). Named failures
        // also appear as failed-Proof bindings above; dedup by name +
        // proposition. Anonymous verifies (binding is undefined) ALWAYS
        // surface here.
        const name = n.binding ?? "<verify>";
        const already = theorems.find(
          t => t.name === name && t.status === "failed",
        );
        if (!already) {
          theorems.push({
            name,
            proposition: n.message,
            status: "failed",
            failure: {
              kind: "proof-failure",
              reason: n.message,
              counterexample: n.counterexample,
            },
          });
        }
      } else if (n.kind === "proven-failed") {
        theorems.push({
          name: n.binding ?? "<proven>",
          proposition: n.message,
          status: "failed",
          failure: {
            kind: "proven-failed",
            reason: n.message,
            counterexample: n.counterexample,
          },
        });
      } else if (n.kind === "proven-skipped") {
        theorems.push({
          name: n.binding ?? "<proven>",
          proposition: n.message,
          status: "skipped",
          failure: {
            kind: "proven-skipped",
            reason: n.message,
          },
        });
      }
    }
  }

  const hasFailedTheorem = theorems.some(t => t.status === "failed");
  return {
    version: PCP_VERSION,
    verified: !anyError && !hasFailedTheorem,
    theorems,
    ...(totalityFindings.length > 0 ? { totalityFindings } : {}),
    ...(effectMismatches.length > 0 ? { effectMismatches } : {}),
  };
}

/** Extract Obligations from an evaluated module — one per Proof-typed
 *  binding. When `pendingOnly` is true, only theorems that didn't
 *  discharge (failed or skipped) are included; otherwise every theorem
 *  is enumerated (useful for cataloguing). */
export function extractObligations(
  evalCtx: ContextValue,
  report: CompilationReport | undefined,
  opts?: { pendingOnly?: boolean; sourceFile?: string },
): Obligation[] {
  const obligations: Obligation[] = [];
  // Collect the lemma names (discharged proof bindings) for context.
  const lemmas: string[] = [];
  for (const [key, b] of evalCtx.bindings) {
    if (b.value && isDischargedProof(b.value)) lemmas.push(key);
  }

  for (const [key, binding] of evalCtx.bindings) {
    const v = binding.value;
    if (!v) continue;
    const discharged = isDischargedProof(v);
    const failed     = isFailedProof(v);
    if (!discharged && !failed) continue;
    if (opts?.pendingOnly && discharged) continue;

    const ctx = primaryOf(v) as ContextValue;
    const proposition = _ctxString(ctx, "__proposition") ?? "<unknown>";

    // Prior attempt context: if failed, package the failure as a single
    // PriorAttempt with the candidate slot empty (we don't know what
    // text was tried — the proof was inline). H4 workers will populate
    // candidate text when they own the loop.
    const priorAttempts: PriorAttempt[] | undefined = failed
      ? [{
          attemptNumber: 1,
          candidate: "",
          verdict: {
            version: PCP_VERSION,
            verified: false,
            theorems: [{
              name: key, proposition, status: "failed",
              failure: {
                kind: "proof-failure",
                reason: _ctxString(ctx, "__reason") ?? "did not discharge",
                counterexample: _ctxString(ctx, "__counterexample"),
              },
            }],
          },
        }]
      : undefined;

    obligations.push(makeObligation({
      theoremName: key,
      proposition,
      // Lemmas exclude this binding itself.
      lemmas: lemmas.filter(l => l !== key),
      ...(opts?.sourceFile ? { location: { file: opts.sourceFile } } : {}),
      ...(priorAttempts ? { priorAttempts } : {}),
    }));
  }

  // Also surface unmet `proven` clauses on functions via the
  // CompilationReport's proven-failed / proven-skipped notifications.
  if (report) {
    for (const n of report.notifications) {
      if (n.kind !== "proven-failed" && n.kind !== "proven-skipped") continue;
      if (opts?.pendingOnly === false) continue; // already covered via bindings
      obligations.push(makeObligation({
        theoremName: n.binding ?? "<proven>",
        proposition: n.message,
        ...(opts?.sourceFile ? { location: { file: opts.sourceFile } } : {}),
        priorAttempts: [{
          attemptNumber: 1,
          candidate: "",
          verdict: {
            version: PCP_VERSION,
            verified: false,
            theorems: [{
              name: n.binding ?? "<proven>",
              proposition: n.message,
              status: n.kind === "proven-failed" ? "failed" : "skipped",
              failure: {
                kind: n.kind,
                reason: n.message,
                counterexample: n.counterexample,
              },
            }],
          },
        }],
      }));
    }
  }

  return obligations;
}

/** Did the candidate satisfy the obligation? Used by `allegro verify
 *  --obligation O.json`: the obligation's theorem must appear in the
 *  verdict as discharged, with matching propositionHash. Returns null
 *  on satisfaction, an error message on mismatch. */
export function checkObligationSatisfied(
  obligation: Obligation,
  verdict: Verdict,
): string | null {
  const t = verdict.theorems.find(t => t.name === obligation.theorem.name);
  if (!t) {
    return `obligation theorem \`${obligation.theorem.name}\` not present in candidate`;
  }
  if (t.status !== "discharged") {
    return `obligation theorem \`${obligation.theorem.name}\` is ${t.status}`;
  }
  const candidateHash = hashProposition(t.proposition);
  if (candidateHash !== obligation.theorem.propositionHash) {
    return `candidate proves a different proposition: obligation hash ${obligation.theorem.propositionHash}, candidate hash ${candidateHash}`;
  }
  return null;
}

export function formatAuthorship(a: Authorship): string {
  const lines: string[] = [];
  lines.push(`Authorship (verified ${a.verifiedAt}):`);
  for (const p of a.provers) {
    const role = p.role ? ` [${p.role}]` : "";
    const ver  = p.proverVersion ? `@${p.proverVersion}` : "";
    const att  = p.attemptsUsed !== undefined ? ` (${p.attemptsUsed} attempts)` : "";
    lines.push(`  ${p.prover}${ver}${role}${att}`);
    if (p.effortBudgetUsed) {
      const parts: string[] = [];
      if (p.effortBudgetUsed.tokens     !== undefined) parts.push(`${p.effortBudgetUsed.tokens} tokens`);
      if (p.effortBudgetUsed.wallTimeMs !== undefined) parts.push(`${p.effortBudgetUsed.wallTimeMs}ms`);
      if (p.effortBudgetUsed.attempts   !== undefined) parts.push(`${p.effortBudgetUsed.attempts} attempts`);
      if (parts.length > 0) lines.push(`    effort: ${parts.join(", ")}`);
    }
  }
  return lines.join("\n");
}
