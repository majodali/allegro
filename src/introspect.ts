// =============================================================================
// Allegro — Introspection API (Phase A of the provability arc)
//
// Exposes the compiler's existing knowledge about an evaluated program as
// structured data consumable by tools (CLI, web sandbox, eventually the
// review UI). No new analyses live here — every field is populated from
// information already computed during parse / typeLiterals / resolveSymbols
// / precompileFunctions / evaluation. The point is to make the silent
// knowledge visible.
//
// See .claude/plans/crystal-proving-curry.md for the broader plan.
// =============================================================================

import {
  Value, ValueKind, ContextValue, ComposedFunctionValue,
  BitsValue, PrimitiveFunctionValue, ParamValue,
  primaryOf, bitsToString, bitsToFloat, isResolved,
} from "./types.js";
import type { CompilationReport } from "./runtime.js";
import { getTypeName } from "./types-std.js";

// =============================================================================
// Summary shapes
// =============================================================================

/** Structural summary of a single Value tree (a binding's value). */
export interface ValueSummary {
  /** The Value kind at the top level (post-MultiValue-unwrap). */
  kind:          ValueKind;
  /** Type name if the value is typed (e.g., "Int", "Function", "Array"). */
  typeName:      string | null;
  /** Whether the value is fully resolved (no residual Expression / Symbol). */
  resolved:      boolean;
  /** Total node count in the Value tree. */
  nodeCount:     number;
  /** Expression-tree depth (0 for atoms). */
  depth:         number;
  /** External Symbols referenced (unresolved names). */
  externalSymbols: string[];
  /** Names of primitives this value directly calls. */
  primitives:    string[];
  /** Human-readable short description for log / UI display. */
  shortDescription: string;
}

/** Safety classification for a compiled module or binding.
 *  Phase A grades use only signals already available; later phases add more
 *  detail (effect purity, refinement coverage, proof counts, etc.). */
export type SafetyGrade =
  | "proven-safe"
  | "partial"
  | "has-warnings"
  | "has-errors";

/** Module-level summary surfaced by `allegro inspect` and the web Inspect
 *  button. One entry per top-level binding, plus module-wide stats. */
export interface ModuleSummary {
  grade:            SafetyGrade;
  bindingCount:     number;
  resolvedCount:    number;
  unresolvedNames:  string[];
  typeErrorCount:   number;
  warnings:         string[];
  /** One entry per top-level binding (key, value, inferred type, summary). */
  bindings:         BindingSummary[];
}

export interface BindingSummary {
  key:        string;
  typeName:   string | null;
  resolved:   boolean;
  summary:    ValueSummary;
}

// =============================================================================
// Graph walker — the core of the introspection API
// =============================================================================

/**
 * Produce a structural summary of a Value. Walks the tree once; handles
 * cycles via a visited-set on ComposedFunctions (the only kind where
 * self-reference shows up via Params owned by the fn).
 */
export function summarizeValue(v: Value): ValueSummary {
  const externalSymbols = new Set<string>();
  const primitives      = new Set<string>();
  let nodeCount = 0;
  let maxDepth  = 0;

  const walk = (node: Value, depth: number, seen: Set<Value>): void => {
    nodeCount++;
    if (depth > maxDepth) maxDepth = depth;

    switch (node.kind) {
      case ValueKind.Symbol:
        externalSymbols.add(node.name);
        return;
      case ValueKind.PrimitiveFunction:
        primitives.add(node.name);
        return;
      case ValueKind.Expression: {
        if (seen.has(node)) return;
        seen.add(node);
        walk(node.fn, depth + 1, seen);
        for (const a of node.args) walk(a, depth + 1, seen);
        return;
      }
      case ValueKind.ComposedFunction: {
        if (seen.has(node)) return;
        seen.add(node);
        walk(node.body, depth + 1, seen);
        return;
      }
      case ValueKind.MultiValue:
        walk(node.primary, depth, seen);
        return;
      case ValueKind.Context:
      case ValueKind.Bits:
      case ValueKind.Param:
        return;
    }
  };

  walk(v, 0, new Set());

  const kindAtPrimary = primaryOf(v).kind;
  const typeName = getTypeName(v);

  return {
    kind:             kindAtPrimary,
    typeName,
    resolved:         isResolved(v),
    nodeCount,
    depth:            maxDepth,
    externalSymbols:  [...externalSymbols].sort(),
    primitives:       [...primitives].sort(),
    shortDescription: describeValue(v, kindAtPrimary, typeName),
  };
}

function describeValue(v: Value, kind: ValueKind, typeName: string | null): string {
  switch (kind) {
    case ValueKind.Bits: {
      const bits = primaryOf(v) as BitsValue;
      if (typeName === "String") {
        const s = bitsToString(bits);
        return s.length <= 40 ? `String "${s}"` : `String "${s.slice(0, 37)}..."`;
      }
      if (typeName === "Float") {
        return `Float ${bitsToFloat(bits)}`;
      }
      if (typeName === "Int" || typeName === "Bool") {
        return `${typeName} ${bits.data}`;
      }
      return `Bits(len=${bits.length})`;
    }
    case ValueKind.Expression: {
      const ev = v.kind === ValueKind.Expression ? v : (v.kind === ValueKind.MultiValue ? primaryOf(v) as Value : v);
      if (ev.kind === ValueKind.Expression) {
        const fn = ev.fn;
        const fnName = fn.kind === ValueKind.PrimitiveFunction ? fn.name :
                       fn.kind === ValueKind.ComposedFunction ? "<composed>" :
                       fn.kind === ValueKind.Symbol ? fn.name : "<expr>";
        return `residual Expression(${fnName}, ${ev.args.length} args)`;
      }
      return "Expression";
    }
    case ValueKind.ComposedFunction: {
      const cf = v.kind === ValueKind.ComposedFunction ? v : (v.kind === ValueKind.MultiValue ? primaryOf(v) as ComposedFunctionValue : null);
      if (cf && cf.kind === ValueKind.ComposedFunction) {
        const paramNames = cf.params.map(p => p._name ?? `_${p.position}`).join(", ");
        if (typeName === "Function") return `Function(${paramNames})`;
        return `ComposedFunction(${paramNames})`;
      }
      return "ComposedFunction";
    }
    case ValueKind.PrimitiveFunction:
      return `Primitive <${(primaryOf(v) as PrimitiveFunctionValue).name}>`;
    case ValueKind.Symbol:
      return `unresolved Symbol <${(primaryOf(v) as { kind: ValueKind.Symbol; name: string }).name}>`;
    case ValueKind.Context: {
      const ctx = primaryOf(v) as ContextValue;
      if ((ctx as any).__grammarValue) {
        const chain = (ctx as any).__grammarValue.baseChain?.join(" > ") ?? "?";
        return `Grammar (extends ${chain})`;
      }
      if (typeName) return `${typeName} object`;
      return "Context";
    }
    case ValueKind.MultiValue:
      return `${typeName ?? "typed"} value`;
    case ValueKind.Param:
      return `Param <${(primaryOf(v) as ParamValue)._name ?? "?"}>`;
  }
}

// =============================================================================
// Safety grade
// =============================================================================

/**
 * Classify a compilation report's overall safety grade using signals that
 * already exist in the report. Phase A grade is intentionally coarse — a
 * placeholder. Later phases refine this with:
 *   - purity / effect summary (Phase D)
 *   - discharged / pending / failed refinements (Phase B)
 *   - totality status (Phase E)
 *   - proof counts (Phase F)
 */
export function safetyGradeFor(report: CompilationReport | undefined): SafetyGrade {
  if (!report) return "partial";
  if (report.errors.length > 0)     return "has-errors";
  if (report.unresolved.length > 0) return "partial";
  // No errors, everything resolved. The "proven-safe" grade is still a
  // loose promise at this phase — we're only checking that the compiler
  // didn't complain. Phase B+ makes this claim stronger.
  return "proven-safe";
}

// =============================================================================
// Module summary
// =============================================================================

/**
 * Produce a full module summary from an evaluation context and its
 * compilation report. The file runner / CLI / web `Inspect` button all
 * consume this single structure.
 */
export function summarizeModule(
  evalCtx: ContextValue,
  report?:  CompilationReport,
  opts?: {
    /** Names to include (defaults to all user-defined bindings). */
    includeBindings?: string[];
    /** Names to exclude (primitives / type names). */
    excludeBindings?: Set<string>;
  },
): ModuleSummary {
  const bindings: BindingSummary[] = [];
  let resolvedCount = 0;
  const excluded = opts?.excludeBindings ?? new Set<string>();
  const include = opts?.includeBindings ? new Set(opts.includeBindings) : null;

  for (const [key, b] of evalCtx.bindings) {
    if (!b.value) continue;
    if (excluded.has(key)) continue;
    if (include && !include.has(key)) continue;

    const summary = summarizeValue(b.value);
    const typeName = report?.bindingTypes.get(key) ?? summary.typeName;
    if (summary.resolved) resolvedCount++;
    bindings.push({ key, typeName, resolved: summary.resolved, summary });
  }

  const warnings: string[] = [];
  if (report?.errors) {
    for (const e of report.errors) warnings.push(`error in ${e.name}: ${e.message}`);
  }

  return {
    grade:            safetyGradeFor(report),
    bindingCount:     bindings.length,
    resolvedCount,
    unresolvedNames:  bindings.filter(b => !b.resolved).map(b => b.key),
    typeErrorCount:   report?.errors.length ?? 0,
    warnings,
    bindings,
  };
}

// =============================================================================
// Human-readable renderer (used by the CLI)
// =============================================================================

export function renderModuleSummary(summary: ModuleSummary): string {
  const lines: string[] = [];
  lines.push(`safety grade:    ${summary.grade}`);
  lines.push(`bindings:        ${summary.bindingCount} (${summary.resolvedCount} resolved)`);
  if (summary.typeErrorCount > 0) {
    lines.push(`type errors:     ${summary.typeErrorCount}`);
  }
  if (summary.unresolvedNames.length > 0) {
    lines.push(`unresolved:      ${summary.unresolvedNames.join(", ")}`);
  }
  if (summary.warnings.length > 0) {
    lines.push(`warnings:`);
    for (const w of summary.warnings) lines.push(`  ${w}`);
  }
  lines.push("");
  lines.push("bindings:");
  for (const b of summary.bindings) {
    const typeBit = b.typeName ? ` : ${b.typeName}` : "";
    const resolvedBit = b.resolved ? "" : " [unresolved]";
    lines.push(`  ${b.key}${typeBit}${resolvedBit}`);
    lines.push(`      ${b.summary.shortDescription}`);
    if (b.summary.nodeCount > 1) {
      lines.push(`      nodes: ${b.summary.nodeCount}, depth: ${b.summary.depth}`);
    }
    if (b.summary.primitives.length > 0) {
      const shown = b.summary.primitives.slice(0, 6).join(", ");
      const more = b.summary.primitives.length > 6
        ? ` (+${b.summary.primitives.length - 6} more)` : "";
      lines.push(`      primitives: ${shown}${more}`);
    }
    if (b.summary.externalSymbols.length > 0) {
      const shown = b.summary.externalSymbols.slice(0, 6).join(", ");
      const more = b.summary.externalSymbols.length > 6
        ? ` (+${b.summary.externalSymbols.length - 6} more)` : "";
      lines.push(`      unresolved refs: ${shown}${more}`);
    }
  }
  return lines.join("\n");
}
