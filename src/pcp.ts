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
  /** H3: free-form tags describing which proof strategies the prover
   *  applied in this attempt (`"proof_by_eval"`, `"prove_induction"`,
   *  `"tactics.chain"`, …). The compiler doesn't parse these — they
   *  round-trip so the next round's hints can say "don't repeat". */
  strategiesUsed?: string[];
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
  /** H3: structured guidance for the next attempt. Generated from the
   *  failure modes in this verdict + any priorAttempts metadata. */
  iterationHints?: IterationHints;
}

// =============================================================================
// Iteration hints (H3)
// =============================================================================
//
// Compiler-side, transparent, limited heuristics. The PROVER (LLM, human)
// does the real proof search — these hints just nudge it past common
// pitfalls (PE residual? wrong proposition? trivial counterexample?).

export interface IterationHints {
  /** Per-theorem or global suggestions for what to try next. */
  suggestions: Suggestion[];
  /** Strategies the prover already tried in prior attempts (aggregated
   *  + deduplicated). Workers should avoid repeating these. */
  strategiesTried?: string[];
}

export interface Suggestion {
  /** Either the theorem name this suggestion is about, or `"<global>"`
   *  for module-level advice. */
  theoremName: string;
  /** Free-form, human-readable. Workers parse on `suggestedConstruct`
   *  rather than the message text. */
  message: string;
  /** Optional machine-readable handle for the suggested tactic /
   *  primitive (`"prove_for_all_bool"`, `"tactics.chain"`, …). */
  suggestedConstruct?: string;
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
  if (v.iterationHints) {
    if (v.iterationHints.suggestions.length > 0) {
      lines.push(`  hints:`);
      for (const s of v.iterationHints.suggestions) {
        lines.push(`    [${s.theoremName}] ${s.message}`);
        if (s.suggestedConstruct) {
          lines.push(`      try: ${s.suggestedConstruct}`);
        }
      }
    }
    if (v.iterationHints.strategiesTried && v.iterationHints.strategiesTried.length > 0) {
      lines.push(`  already tried: ${v.iterationHints.strategiesTried.join(", ")}`);
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
 *  (effects-mismatch, return-type-mismatch, …).
 *
 *  When `obligation` is supplied, the H3 `iterationHints` field is
 *  populated using both the current verdict's failures AND any
 *  `strategiesUsed` recorded by the prover in prior attempts. Without
 *  an obligation, hints reflect this attempt only. */
export function buildVerdict(
  evalCtx: ContextValue,
  report: CompilationReport | undefined,
  obligation?: Obligation,
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
  const iterationHints = generateHints(theorems, report, obligation);
  return {
    version: PCP_VERSION,
    verified: !anyError && !hasFailedTheorem,
    theorems,
    ...(totalityFindings.length > 0 ? { totalityFindings } : {}),
    ...(effectMismatches.length > 0 ? { effectMismatches } : {}),
    ...(iterationHints.suggestions.length > 0 || iterationHints.strategiesTried
        ? { iterationHints } : {}),
  };
}

/** H3: generate compiler-side hints from the failure modes in a Verdict
 *  + any strategies the prover recorded in prior attempts. Heuristics
 *  are deliberately limited and transparent — workers do the real proof
 *  search; the compiler nudges past common pitfalls. */
export function generateHints(
  theorems: TheoremResult[],
  report: CompilationReport | undefined,
  obligation?: Obligation,
): IterationHints {
  const suggestions: Suggestion[] = [];

  for (const t of theorems) {
    if (t.status === "discharged" || !t.failure) continue;
    const name   = t.name;
    const kind   = t.failure.kind;
    const reason = t.failure.reason ?? "";
    const cex    = t.failure.counterexample ?? "";

    // F1 proof-failure shapes (most common).
    if (kind === "proof-failure") {
      if (reason.includes("did not reduce to a constant Bool") ||
          cex.includes("PE left a residual")) {
        suggestions.push({
          theoremName: name,
          message: "PE left a residual — try a combinator (`proof_refl` / `proof_sym` / `proof_trans` / `proof_cong`) or `prove_for_all_bool` for finite-domain quantification",
          suggestedConstruct: "proof_trans",
        });
      } else if (reason.includes("evaluates to false") || cex.includes("evaluates to false")) {
        suggestions.push({
          theoremName: name,
          message: "proposition is false on the supplied inputs — revise the theorem statement or the function it references; check the counterexample",
        });
      } else if (reason.includes("transitivity middle terms differ") ||
                 cex.includes("middle terms")) {
        suggestions.push({
          theoremName: name,
          message: "in `proof_trans(p1, p2)` the RHS of p1 must value-match the LHS of p2 — inspect the intermediate term and consider `tactics.chain([…])` for a longer chain",
          suggestedConstruct: "tactics.chain",
        });
      } else if (reason.includes("different equality") ||
                 reason.includes("establishes a different")) {
        suggestions.push({
          theoremName: name,
          message: "the `by` proof term establishes a different fact than the theorem claims — match the proposition exactly",
        });
      }
    }

    // F7 proven-failed shapes (sampled witness).
    if (kind === "proven-failed") {
      // Counterexample format: "at <param> = <value>: <reason>"
      const m = /at (\w+)\s*=\s*([^:]+):/.exec(cex);
      if (m) {
        suggestions.push({
          theoremName: name,
          message: `the implementation violates the predicate at \`${m[1]} = ${m[2].trim()}\` — revise the impl or weaken the proven clause`,
        });
      } else {
        suggestions.push({
          theoremName: name,
          message: "sampling found a counterexample to the proven clause — see counterexample",
        });
      }
    }

    if (kind === "proven-skipped") {
      if (reason.includes("F7 minimum supports single-param")) {
        suggestions.push({
          theoremName: name,
          message: "F7 sampling supports single-param functions only — split the function or attach the theorem at a single-param helper",
        });
      } else if (reason.includes("no type annotation")) {
        suggestions.push({
          theoremName: name,
          message: "the param has no type annotation; F7 needs `Int` / `NonNeg` / `PositiveInt` / `Bool` to sample",
          suggestedConstruct: "type-annotation",
        });
      } else if (reason.includes("not sampleable")) {
        suggestions.push({
          theoremName: name,
          message: "the param type isn't a sampleable shape (F7 minimum); restructure the function or prove via combinators / `prove_induction`",
        });
      }
    }
  }

  // Global lemma reminder — surfaced once when an obligation supplies
  // lemmas (otherwise the prover would have to scan the obligation
  // separately).
  if (obligation && obligation.context.lemmas.length > 0) {
    const top = obligation.context.lemmas.slice(0, 5).join(", ");
    const more = obligation.context.lemmas.length > 5
      ? ` … (${obligation.context.lemmas.length - 5} more)` : "";
    suggestions.push({
      theoremName: "<global>",
      message: `${obligation.context.lemmas.length} lemma(s) in scope: ${top}${more}. Consider \`proof_trans\` / \`tactics.chain\` for chaining.`,
    });
  }

  // Aggregate strategies the prover tried (round-tripped). Workers use
  // this to avoid repeating.
  const triedSet = new Set<string>();
  for (const pa of obligation?.priorAttempts ?? []) {
    for (const s of pa.strategiesUsed ?? []) triedSet.add(s);
  }
  const strategiesTried = triedSet.size > 0 ? Array.from(triedSet).sort() : undefined;

  return {
    suggestions,
    ...(strategiesTried ? { strategiesTried } : {}),
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

// =============================================================================
// Markdown TODO renderer (H4b — human-interactive worker)
// =============================================================================
//
// `formatTodo` produces a Markdown summary of pending obligations and
// the iteration hints attached to each. Optimised for human reading —
// the `allegro propose` CLI subcommand uses this to give a developer a
// curated worklist they can act on without spelunking the JSON.
//
// Each obligation gets a section header with the theorem name + status,
// the proposition rendered in a fenced code block, and any associated
// hints / counterexamples as bullets. A leading file-level summary
// counts pending vs. total so the developer sees how much is left.

export interface TodoSection {
  obligation: Obligation;
  /** Suggestions specifically for this theorem (from a Verdict's
   *  iterationHints, filtered by name). Pre-extracted so the renderer
   *  doesn't need the full verdict. */
  hints?: Suggestion[];
  /** Optional last-known failure context (counterexample / reason). */
  failure?: TheoremFailure;
}

export function formatTodo(args: {
  filename: string;
  totalObligations: number;
  sections: TodoSection[];
}): string {
  const lines: string[] = [];
  const pendingCount = args.sections.length;
  lines.push(`# Proof TODO — \`${args.filename}\``);
  lines.push("");
  if (pendingCount === 0) {
    lines.push(`All ${args.totalObligations} obligation(s) discharged. Nothing pending.`);
    return lines.join("\n");
  }
  lines.push(`**${pendingCount} pending** of ${args.totalObligations} obligation(s).`);
  lines.push("");

  for (const s of args.sections) {
    const ob = s.obligation;
    lines.push(`## \`${ob.theorem.name}\``);
    lines.push("");
    lines.push("**Proposition:**");
    lines.push("");
    lines.push("```allegro");
    lines.push(ob.theorem.proposition);
    lines.push("```");
    lines.push("");

    if (ob.function) {
      lines.push(`**Function:** \`${ob.function.name} ${ob.function.signature}\``);
      lines.push("");
    }

    if (s.failure) {
      lines.push("**Last failure:**");
      lines.push(`- reason: ${s.failure.reason}`);
      if (s.failure.counterexample) {
        lines.push(`- counterexample: \`${s.failure.counterexample}\``);
      }
      lines.push("");
    }

    if (s.hints && s.hints.length > 0) {
      lines.push("**Hints:**");
      for (const h of s.hints) {
        lines.push(`- ${h.message}` +
          (h.suggestedConstruct ? ` *(try \`${h.suggestedConstruct}\`)*` : ""));
      }
      lines.push("");
    }

    if (ob.context.lemmas.length > 0) {
      const top = ob.context.lemmas.slice(0, 8).join("`, `");
      const more = ob.context.lemmas.length > 8
        ? ` *(+${ob.context.lemmas.length - 8} more)*` : "";
      lines.push(`**Lemmas in scope:** \`${top}\`${more}`);
      lines.push("");
    }

    if (ob.priorAttempts && ob.priorAttempts.length > 0) {
      lines.push(`**Prior attempts:** ${ob.priorAttempts.length}`);
      lines.push("");
    }

    lines.push("---");
    lines.push("");
  }

  lines.push("_When done, run `allegro verify` on the source file to confirm._");
  return lines.join("\n");
}
