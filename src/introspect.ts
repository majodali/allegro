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
// See docs/plans/crystal-proving-curry.md for the broader plan.
// =============================================================================

import { metaReadRaw, backingsOf } from "./slots.js";
import type { LawBackingRec } from "./slots.js";
import {
  Value, ValueKind, StructureValue, ComposedFunctionValue,
  BitsValue, PrimitiveFunctionValue, ParamValue,
  bitsToString, bitsToFloat, isResolved,
} from "./types.js";
import type { CompilationReport, Notification } from "./runtime.js";
import { reportErrors, reportHasErrors } from "./runtime.js";
import { getTypeName, typeContextName } from "./types-std.js";
import {
  domainOf, formatDomain, AbstractDomain,
  predicatesOf, PredicateSet, Predicate,
  deriveBranchPredicates, domainFromPredicate,
  occurrenceBoundOf,
} from "./refinements.js";
import {
  EffectSet, formatEffects, effectsOf, unwrapEffectsAttach,
  effectDifference,
} from "./effects.js";

// =============================================================================
// Summary shapes
// =============================================================================

/** Structural summary of a single Value tree (a binding's value). */
export interface ValueSummary {
  /** The Value kind at the top level (post-MultiValue-unwrap). */
  kind:          ValueKind;
  /** Type name if the value is typed (e.g., "Int", "Function", "Array"). */
  typeName:      string | null;
  /** C3.2 (D36): the occurrence bound's type name, when this value crossed
   *  an annotation boundary wider than its shape (e.g. "Animal" on a value
   *  whose typeName is "Dog"). Member availability follows the bound. */
  annotationBound: string | null;
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
  /** Abstract domain (Phase B refinement propagation) if any. Effective
   *  domain across all predicates in the binding's set. */
  domain:        AbstractDomain | null;
  /** Full predicate set (Phase C) if any. Each entry includes its
   *  algebraic shape and source attribution. */
  predicates:    Predicate[];
  /** Phase C Chunk 3: contracts surfaced from a function body. `requires`
   *  entries are caller obligations (preconditions); `ensures` entries are
   *  implementer guarantees (postconditions). Each entry pairs the
   *  algebraic shape with the bindings referenced in the predicate. */
  requires:      ContractSummary[];
  ensures:       ContractSummary[];
  /** Phase C Chunk 3: implicit-precondition suggestions. When an in-body
   *  `assert P` references only function parameters / module-level
   *  constants, P could be promoted to `requires P` for caller-side proof.
   *  Each entry holds the recognised shape and the parameter names it
   *  pins down. */
  promotionSuggestions: ContractSummary[];
  /** Phase D1: inferred effect set — labels accumulated from primitives
   *  the function transitively calls. Empty set = pure. Only populated
   *  when the value is a function (ComposedFunction or wrapped). */
  inferredEffects: EffectSet | null;
  /** Phase D1: declared effect set, if any (from an `effects` body
   *  clause). When non-null AND inferred ⊄ declared, the function has a
   *  declaration mismatch (separately surfaced as an error). */
  declaredEffects: EffectSet | null;
  /** D2 roll-up (B-091): for Proof values, the TRANSITIVE law-backing
   *  set — every {equality, law, tier} the proof rests on through its
   *  combinator chain. Admitted/sampled entries are the assumptions the
   *  renderer surfaces. */
  restsOn?: LawBackingRec[];
}

export interface ContractSummary {
  /** Recognised algebraic shape (interval / eq / ne / opaque). */
  shape:    AbstractDomain;
  /** Names referenced in the predicate (function params or `_`). */
  bindings: string[];
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
  /** Stage 6: totality / exhaustiveness notices anchored to this binding,
   *  with counterexamples surfaced inline by the renderer. */
  totalityNotices?: Notification[];
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
  const requires:    ContractSummary[] = [];
  const ensures:     ContractSummary[] = [];
  const assertsInBody: ContractSummary[] = [];
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
        // Phase C Chunk 3: surface contracts when we encounter their
        // primitive-call markers. Match both PrimitiveFunction (after
        // hygienic resolution / resolveSymbols) and Symbol (raw parse-time
        // shape, when the primitive was invoked directly by name). In
        // Standard mode, resolveSymbols wraps primitives as UntypedFunction
        // MultiValues — peel that wrapper before matching.
        const fnPrim = node.fn;
        const fnName = (fnPrim.kind === ValueKind.PrimitiveFunction || fnPrim.kind === ValueKind.Symbol)
          ? fnPrim.name : null;
        if (fnName) {
          if (fnName === "requires_stmt" && node.args.length === 1) {
            const c = recogniseBoolExpr(node.args[0]);
            if (c) requires.push(c);
          } else if (fnName === "ensures_check" && node.args.length === 2) {
            // args[1] is the lambda `(_) => P` — domainFromPredicate
            // extracts its shape; we record `_` as the bound name.
            const shape = domainFromPredicate(node.args[1]);
            ensures.push({ shape, bindings: ["_"] });
          } else if (fnName === "assert_stmt" && node.args.length === 1) {
            // Body-internal asserts: candidate for promotion to `requires`
            // when they reference only function parameters / constants.
            const c = recogniseBoolExpr(node.args[0]);
            if (c) assertsInBody.push(c);
          } else if (fnName === "effects_attach" && node.args.length === 2) {
            // Phase D1: skip the metadata arg entirely. It contains a
            // typed_array of Symbol(label) values which are intentionally
            // unresolved — they're declarations, not references — so they
            // shouldn't pollute the externalSymbols set or the primitive
            // counts. Walk only the wrapped body.
            walk(node.fn, depth + 1, seen);
            walk(node.args[0], depth + 1, seen);
            return;
          }
        }
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
      case ValueKind.Structure:
        return; // inert — B-121 C4 deleted the carrier arm
      case ValueKind.Bits:
      case ValueKind.Param:
        return;
    }
  };

  walk(v, 0, new Set());

  // Phase C Chunk 3: filter promotion suggestions. An in-body assert is a
  // candidate for promotion to `requires` only if its predicate references
  // function parameters (Symbols matching declared param names). The
  // recogniser already tells us which bindings are referenced; here we
  // intersect with the function's own param names.
  const paramNames = collectParamNames(v);
  const promotionSuggestions: ContractSummary[] = [];
  for (const a of assertsInBody) {
    if (a.bindings.length === 0) continue;
    if (a.bindings.every(b => paramNames.has(b))) {
      promotionSuggestions.push(a);
    }
  }

  const kindAtPrimary = v.kind;
  const typeName = getTypeName(v);
  // Pull predicate set from the value itself, or — for refined values that
  // didn't go through __construct — synthesise a singleton set from the
  // refined type Context's stored abstractDomain.
  let preds = predicatesOf(v);
  // B-121 C2: kind guard dropped — the question is whether `v` carries a
  // type, and a refined SCALAR is exactly the case the guard used to catch
  // only because typing had made it a Structure.
  if (!preds) {
    const typeComp = metaReadRaw(v, "type");
    if (typeComp?.kind === ValueKind.Structure) {
      const fromType = (typeComp as any).abstractDomain;
      if (fromType && fromType.kind) {
        preds = new PredicateSet([{ shape: fromType, source: "refinement-type" }]);
      }
    }
  }
  const dom = preds?.effectiveDomain() ?? domainOf(v);

  // If the value is a function, read inferred effects via `effectsOf`,
  // which checks the `effects` MultiValue component first and falls back
  // to the ComposedFunction's `inferredEffects` stash. Declared effects
  // come from the body's `effects_attach` wrapper.
  let inferredEffects: EffectSet | null = null;
  let declaredEffects: EffectSet | null = null;
  const fnPrim = v;
  if (fnPrim.kind === ValueKind.ComposedFunction) {
    inferredEffects = effectsOf(v);
    const wrap = unwrapEffectsAttach(fnPrim as import("./types.js").ComposedFunctionValue);
    if (wrap) declaredEffects = wrap.declared;
  }

  const boundCtx = occurrenceBoundOf(v);
  const annotationBound = boundCtx ? (typeContextName(boundCtx) ?? "<anonymous>") : null;

  // D2 roll-up (B-091): a Proof value's transitive law-backing set —
  // what the proof rests on, through the whole combinator chain.
  let restsOn: LawBackingRec[] | undefined;
  const structPrim = v;
  if (structPrim.kind === ValueKind.Structure) {
    const backings = backingsOf(structPrim as StructureValue);
    if (backings.length > 0) restsOn = backings;
  }

  return {
    kind:             kindAtPrimary,
    typeName,
    annotationBound,
    resolved:         isResolved(v),
    nodeCount,
    depth:            maxDepth,
    externalSymbols:  [...externalSymbols].sort(),
    primitives:       [...primitives].sort(),
    shortDescription: describeValue(v, kindAtPrimary, typeName),
    domain:           dom,
    predicates:       preds ? [...preds] : [],
    requires,
    ensures,
    promotionSuggestions,
    inferredEffects,
    declaredEffects,
    ...(restsOn ? { restsOn } : {}),
  };
}

/** Extract a ContractSummary from a boolean expression (the condition of
 *  an assert / requires). Inside a function body (which is what we walk)
 *  references to function parameters are Params, not Symbols, so we can't
 *  reuse `deriveBranchPredicates` directly — that recogniser is tuned for
 *  the runtime path where bindings appear as Symbols. Instead we run the
 *  same shape detection but match `Param._name` as the binding identifier. */
function recogniseBoolExpr(expr: Value): ContractSummary | null {
  // First try the Symbol path (covers top-level asserts in file scope).
  const map = deriveBranchPredicates(expr, true, "assert");
  if (map.size > 0) {
    const [name, set] = [...map.entries()][0];
    const eff = set.effectiveDomain();
    if (eff) return { shape: eff, bindings: [name] };
  }
  // Fall back to Param-aware shape detection for in-body contracts.
  return recogniseParamBoolExpr(expr);
}

/** Walk a boolean expression where function parameters appear as Params
 *  (which is the case before substitution). Recognises:
 *    - Param OP literal
 *    - literal OP Param
 *    - left && right (conjunction; combines via the left's shape)
 *  Returns the first single-Param constraint found. Multi-param predicates
 *  return null until Phase D introduces relational tracking. */
function recogniseParamBoolExpr(expr: Value): ContractSummary | null {
  const e = expr;
  if (e.kind !== ValueKind.Expression) return null;
  const fn = e.fn;
  // Accept Symbol too — when the boolean expr survives without resolveSymbols
  // running (rare; the runtime fast-path normally resolves first).
  if (fn.kind !== ValueKind.PrimitiveFunction && fn.kind !== ValueKind.Symbol) return null;

  // Conjunction — recurse into the left side first; the right is the more
  // complex case (it's wrapped in a thunk for short-circuiting).
  if (fn.name === "typed_and" && e.args.length === 2) {
    const left = recogniseParamBoolExpr(e.args[0]);
    if (left) return left;
    const rightArg = e.args[1];
    if (rightArg.kind === ValueKind.ComposedFunction && rightArg.params.length === 0) {
      return recogniseParamBoolExpr(rightArg.body);
    }
    return recogniseParamBoolExpr(e.args[1]);
  }

  if (e.args.length !== 2) return null;
  const a = e.args[0];
  const b = e.args[1];
  let paramName: string | null = null;
  let lit: number | null = null;
  let leftIsParam = false;
  if (a.kind === ValueKind.Param) {
    paramName = a._name ?? null;
    lit = asIntLiteral(e.args[1]);
    leftIsParam = true;
  } else if (b.kind === ValueKind.Param) {
    paramName = b._name ?? null;
    lit = asIntLiteral(e.args[0]);
    leftIsParam = false;
  }
  if (paramName === null || lit === null) return null;

  let op = fn.name;
  if (!leftIsParam) {
    // Swap operator: `k OP param` ↔ `param SWAP(OP) k`.
    switch (op) {
      case "bits_gt":   op = "bits_lt";   break;
      case "bits_gte":  op = "bits_lte";  break;
      case "bits_lt":   op = "bits_gt";   break;
      case "bits_lte":  op = "bits_gte";  break;
      case "typed_gt":  op = "typed_lt";  break;
      case "typed_gte": op = "typed_lte"; break;
      case "typed_lt":  op = "typed_gt";  break;
      case "typed_lte": op = "typed_gte"; break;
    }
  }

  let shape: AbstractDomain | null = null;
  switch (op) {
    case "bits_gt":   case "typed_gt":  shape = { kind: "interval", lo: lit + 1,     hi: +Infinity }; break;
    case "bits_gte":  case "typed_gte": shape = { kind: "interval", lo: lit,         hi: +Infinity }; break;
    case "bits_lt":   case "typed_lt":  shape = { kind: "interval", lo: -Infinity,   hi: lit - 1   }; break;
    case "bits_lte":  case "typed_lte": shape = { kind: "interval", lo: -Infinity,   hi: lit       }; break;
    case "bits_eq":   case "typed_eq":  shape = { kind: "eq", value: lit }; break;
    case "bits_neq":  case "typed_neq": shape = { kind: "ne", value: lit }; break;
  }
  if (!shape) return null;
  return { shape, bindings: [paramName] };
}

/** Extract a 64-bit integer literal value from a typed-or-raw Bits Value.
 *  Mirrors refinements.ts asIntLiteral but lives here to avoid widening
 *  that module's export surface for a single use. */
function asIntLiteral(v: Value): number | null {
  const p = v;
  if (p.kind !== ValueKind.Bits) return null;
  if (p.length !== 64) return null;
  const data = p.data;
  if (typeof data !== "bigint") return null;
  const asSigned = data >= 0x8000000000000000n ? data - 0x10000000000000000n : data;
  const n = Number(asSigned);
  if (!Number.isSafeInteger(n)) return null;
  return n;
}

/** Collect declared parameter names of a function value (for the promotion
 *  filter). Returns empty set if the value is not a function. */
function collectParamNames(v: Value): Set<string> {
  const out = new Set<string>();
  const p = v;
  if (p.kind === ValueKind.ComposedFunction) {
    for (const param of p.params) {
      if (param._name) out.add(param._name);
    }
  }
  return out;
}

function describeValue(v: Value, kind: ValueKind, typeName: string | null): string {
  switch (kind) {
    case ValueKind.Bits: {
      const bits = v as BitsValue;
      if (typeName === "String") {
        const s = bitsToString(bits);
        return s.length <= 40 ? `String "${s}"` : `String "${s.slice(0, 37)}..."`;
      }
      if (typeName === "Float") {
        return `Float ${bitsToFloat(bits)}`;
      }
      if (bits.length === 64) {
        // Int-sized Bits: whatever the nominal type name is, render the
        // integer value. Covers refined-Int (PositiveInt, etc.) where
        // typeName is the refinement's name, not "Int".
        const signed = bits.data >= 0x8000000000000000n ? bits.data - 0x10000000000000000n : bits.data;
        return `${typeName ?? "Int"} ${signed}`;
      }
      if (typeName === "Bool") {
        return `Bool ${bits.data}`;
      }
      return `Bits(len=${bits.length})`;
    }
    case ValueKind.Expression: {
      const ev = v as Value;
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
      const cf = v.kind === ValueKind.ComposedFunction ? v as ComposedFunctionValue : null;
      if (cf && cf.kind === ValueKind.ComposedFunction) {
        const paramNames = cf.params.map(p => p._name ?? `_${p.position}`).join(", ");
        if (typeName === "Function") return `Function(${paramNames})`;
        return `ComposedFunction(${paramNames})`;
      }
      return "ComposedFunction";
    }
    case ValueKind.PrimitiveFunction:
      return `Primitive <${(v as PrimitiveFunctionValue).name}>`;
    case ValueKind.Symbol:
      return `unresolved Symbol <${(v as { kind: ValueKind.Symbol; name: string }).name}>`;
    case ValueKind.Structure: {
      const ctx = v as StructureValue;
      if ((ctx as any).grammarValue) {
        const chain = (ctx as any).grammarValue.baseChain?.join(" > ") ?? "?";
        return `Grammar (extends ${chain})`;
      }
      // C6.1b: lifecycle invariants are ordinary refinements now — the
      // Phase C Chunk 4 `__invariantsList` rendering left with
      // buildInvariantedType (refined types render their predicate/domain
      // through the standard refinement summary instead).
      if (typeName) return `${typeName} object`;
      return "Context";
    }
    case ValueKind.Param:
      return `Param <${(v as ParamValue)._name ?? "?"}>`;
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
  if (reportHasErrors(report))      return "has-errors";
  if (report.unresolved.length > 0) return "partial";
  // No errors, everything resolved. The "proven-safe" grade is still a
  // loose promise at this phase — we're only checking that the compiler
  // didn't complain. Phase B+ makes this claim stronger.
  return "proven-safe";
}

/**
 * Classify a module summary considering both compilation report (above)
 * AND the resolved bindings — values typed Error count as has-errors even
 * when the compilation was syntactically clean. Phase C: failed
 * refinement / invariant checks produce Error values; the safety grade
 * should reflect them.
 */
export function safetyGradeForSummary(
  bindings: Array<{ summary: { typeName: string | null } }>,
  report: CompilationReport | undefined,
): SafetyGrade {
  const reportGrade = safetyGradeFor(report);
  if (reportGrade === "has-errors") return "has-errors";
  for (const b of bindings) {
    if (b.summary.typeName === "Error") return "has-errors";
  }
  return reportGrade;
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
  evalCtx: StructureValue,
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

  // Stage 6: pre-group totality notifications by binding for per-binding
  // rendering. Both `totality-exhaustiveness` and `totality-nontermination`
  // are anchored to a binding via `Notification.binding`; we surface them
  // inline below their owner.
  const totalityByBinding = new Map<string, Notification[]>();
  if (report) {
    for (const n of report.notifications) {
      if (!n.binding) continue;
      if (n.kind !== "totality-exhaustiveness" && n.kind !== "totality-nontermination") continue;
      const arr = totalityByBinding.get(n.binding) ?? [];
      arr.push(n);
      totalityByBinding.set(n.binding, arr);
    }
  }

  for (const [key, b] of evalCtx.bindings) {
    if (!b.value) continue;
    if (excluded.has(key)) continue;
    if (include && !include.has(key)) continue;

    const summary = summarizeValue(b.value);
    const typeName = report?.bindingTypes.get(key) ?? summary.typeName;
    if (summary.resolved) resolvedCount++;
    const totalityNotices = totalityByBinding.get(key);
    bindings.push({ key, typeName, resolved: summary.resolved, summary, totalityNotices });
  }

  const warnings: string[] = [];
  const errors = report ? reportErrors(report) : [];
  for (const e of errors) warnings.push(`error in ${e.binding ?? "?"}: ${e.message}`);

  return {
    grade:            safetyGradeForSummary(bindings, report),
    bindingCount:     bindings.length,
    resolvedCount,
    unresolvedNames:  bindings.filter(b => !b.resolved).map(b => b.key),
    typeErrorCount:   errors.length,
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
    // Predicate-set rendering: when there's exactly one non-opaque predicate
    // (the common case so far), keep the compact "refinement: ≥ k" line.
    // When there are multiple predicates, list each with its source.
    const nonOpaque = b.summary.predicates.filter(p => p.shape.kind !== "opaque");
    if (nonOpaque.length === 1) {
      lines.push(`      refinement: ${formatDomain(nonOpaque[0].shape)}`);
    } else if (nonOpaque.length > 1) {
      lines.push(`      predicates:`);
      for (const p of nonOpaque) {
        const src = p.source ? ` [${p.source}]` : "";
        lines.push(`        ${formatDomain(p.shape)}${src}`);
      }
    } else if (b.summary.domain && b.summary.domain.kind !== "opaque") {
      // Fallback: legacy single-domain path.
      lines.push(`      refinement: ${formatDomain(b.summary.domain)}`);
    }
    // C3.2 (delta 5, additive): surface the occurrence bound when present.
    if (b.summary.annotationBound) {
      lines.push(`      bound: ${b.summary.annotationBound} (annotation)`);
    }
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
    // Phase C Chunk 3: contracts and promotion suggestions.
    if (b.summary.requires.length > 0) {
      lines.push(`      requires:`);
      for (const c of b.summary.requires) {
        const name = c.bindings[0] ?? "<expr>";
        lines.push(`        ${name} ${formatDomain(c.shape)}`);
      }
    }
    if (b.summary.ensures.length > 0) {
      lines.push(`      ensures:`);
      for (const c of b.summary.ensures) {
        lines.push(`        _ ${formatDomain(c.shape)}`);
      }
    }
    if (b.summary.promotionSuggestions.length > 0) {
      lines.push(`      suggested:`);
      for (const c of b.summary.promotionSuggestions) {
        const name = c.bindings[0] ?? "<expr>";
        lines.push(`        promote 'assert ${name} ${formatDomain(c.shape)}' → 'requires …'`);
      }
    }
    // D2 roll-up (B-091): a proof binding's transitive backing. Weak
    // (admitted/sampled) entries render loudly; all-proven sets render
    // a single quiet line.
    if (b.summary.restsOn && b.summary.restsOn.length > 0) {
      const weak = b.summary.restsOn.filter(
        r => r.tier === "admitted" || r.tier === "sampled");
      if (weak.length > 0) {
        lines.push(`      rests on: ${weak.map(r => `${r.tier} '${r.law}' of '${r.equality}'`).join(", ")}`);
      } else {
        lines.push(`      rests on: proven backing only (${b.summary.restsOn.length} law(s))`);
      }
    }
    // Phase D1: surface inferred and declared effects when the binding is
    // a function. The format varies by whether a declaration is present
    // and whether the declaration verified.
    if (b.summary.inferredEffects) {
      const inf = b.summary.inferredEffects;
      const dec = b.summary.declaredEffects;
      if (dec === null) {
        lines.push(`      effects:    ${formatEffects(inf)} (inferred)`);
      } else {
        const missing = effectDifference(inf, dec);
        if (missing.size === 0) {
          // Inferred ⊆ Declared — declaration verifies.
          if (formatEffects(inf) === formatEffects(dec)) {
            lines.push(`      effects:    ${formatEffects(dec)} (declared, verified)`);
          } else {
            lines.push(`      effects:    ${formatEffects(dec)} (declared) ⊇ ${formatEffects(inf)} (inferred) ✓`);
          }
        } else {
          // Mismatch — declared is missing labels.
          lines.push(`      effects:    declared \`${formatEffects(dec)}\`, inferred \`${formatEffects(inf)}\` — undeclared: \`${formatEffects(missing)}\` ✗`);
        }
      }
    }
    // Stage 6: totality notices anchored to this binding, with concrete
    // counterexamples when the analyzer produced one. The notices are
    // info-severity by default (non-blocking); the renderer's job is to
    // make them legible enough that a user notices.
    if (b.totalityNotices && b.totalityNotices.length > 0) {
      lines.push(`      totality:`);
      for (const n of b.totalityNotices) {
        lines.push(`        ${n.message}`);
        if (n.counterexample) {
          lines.push(`          counterexample: ${n.counterexample}`);
        }
      }
    }
  }
  return lines.join("\n");
}
