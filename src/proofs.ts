// =============================================================================
// Proof checking (Phase F)
// =============================================================================
//
// Phase F makes proofs first-class Values. F1's only constructor is
// `proof_by_eval` (discharge by partial evaluation): the proposition is
// evaluated; if it folds to `true` the proof is discharged, otherwise the
// primitive returns a *failed* Proof — a `Proof`-typed Context with
// `__discharged = 0` plus `__proposition`, `__reason`, and (when available)
// `__counterexample` bindings.
//
// `checkProofs` scans evaluated values for failed proofs and turns each into
// a finding. The runtime surfaces these as error-severity notifications and
// halts compilation — a failed proof is unsound by construction, so it gets
// the same "build safety in" treatment as a failed effects declaration.
//
// F2 (refinement-domain discharge) and F3 (proof combinators) add more
// constructors; they reuse this same failed-Proof shape so `checkProofs`
// stays the single surfacing point.

import {
  Value, ValueKind, ContextValue, BitsValue,
  primaryOf, bitsToString,
} from "./types.js";
import { getTypeName } from "./types-std.js";

export interface ProofFinding {
  /** Binding name for a `theorem`, or null for an anonymous `verify`. */
  binding: string | null;
  /** The proposition's source text, as captured at parse time. */
  proposition: string;
  /** Why the proof failed (human-readable). */
  reason: string;
  /** Concrete witness, reusing the Phase E Stage 6 counterexample shape. */
  counterexample?: string;
}

/** Is this evaluated value a Proof that did NOT discharge? */
export function isFailedProof(v: Value | undefined): boolean {
  if (!v) return false;
  const p = primaryOf(v);
  if (p.kind !== ValueKind.Context) return false;
  if (getTypeName(v) !== "Proof") return false;
  const d = (p as ContextValue).bindings.get("__discharged")?.value;
  if (!d) return false;
  const dp = primaryOf(d);
  return dp.kind === ValueKind.Bits && (dp as BitsValue).data === 0n;
}

/** Is this a discharged (valid) Proof? */
export function isDischargedProof(v: Value | undefined): boolean {
  if (!v) return false;
  const p = primaryOf(v);
  if (p.kind !== ValueKind.Context) return false;
  if (getTypeName(v) !== "Proof") return false;
  const d = (p as ContextValue).bindings.get("__discharged")?.value;
  if (!d) return false;
  const dp = primaryOf(d);
  return dp.kind === ValueKind.Bits && (dp as BitsValue).data === 1n;
}

function ctxString(ctx: ContextValue, key: string): string | undefined {
  const b = ctx.bindings.get(key)?.value;
  if (!b) return undefined;
  const p = primaryOf(b);
  return p.kind === ValueKind.Bits ? bitsToString(p as BitsValue) : undefined;
}

/** Turn a failed-Proof value into a structured finding. `binding` is the
 *  theorem name (or null for an anonymous `verify`). */
export function describeFailedProof(
  v: Value,
  binding: string | null,
): ProofFinding {
  const ctx = primaryOf(v) as ContextValue;
  return {
    binding,
    proposition:    ctxString(ctx, "__proposition") ?? "<proposition>",
    reason:         ctxString(ctx, "__reason") ?? "proof did not discharge",
    counterexample: ctxString(ctx, "__counterexample"),
  };
}

/** Scan an iterable of (name, evaluated-value) pairs for failed proofs.
 *  Anonymous `verify` results arrive with name = null. */
export function checkProofs(
  entries: Iterable<{ key: string | null; value: Value | undefined }>,
): ProofFinding[] {
  const findings: ProofFinding[] = [];
  for (const e of entries) {
    if (e.value && isFailedProof(e.value)) {
      findings.push(describeFailedProof(e.value, e.key));
    }
  }
  return findings;
}

/** One-line render for the error message / introspection summary. */
export function formatProofFinding(f: ProofFinding): string {
  const who = f.binding ? `theorem \`${f.binding}\`` : `verify`;
  let s = `${who}: \`${f.proposition}\` — ${f.reason}`;
  if (f.counterexample) s += ` (counterexample: ${f.counterexample})`;
  return s;
}
