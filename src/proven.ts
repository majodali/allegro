// =============================================================================
// `proven` clause checking (Phase F7)
// =============================================================================
//
// `proven <prop>` attaches a theorem to the function being defined. The
// compiler verifies the property at definition time by BOUNDED SAMPLING
// (Stage-7 minimum, K=4): invoke the function at sample inputs and
// evaluate the predicate. A failed sample halts compilation with a
// concrete counterexample input.
//
// This is the [implementation, proof] pair contract: the function body
// says what it does; the proven clause says what's true about it. AI
// agents in Phase H target this surface — propose impl + proven prop,
// compiler verifies.
//
// F7 minimum: single Int / NonNeg / PositiveInt / Bool typed param. Other
// shapes (multi-param, untyped, non-numeric types) emit an info
// notification — the analyzer can't sample them sensibly today.
//
// Full symbolic verification (reasoning over all inputs of the param
// type) is F7+ and likely requires either richer abstract-domain
// machinery or an external SMT discharge.

import { dataOf, getName, channelReadRaw, componentsView } from "./slots.js";
import { scopeLookup } from "./scope.js";
import {
  Value, ValueKind, StructureValue, ComposedFunctionValue, ExpressionValue,
  ParamValue, BitsValue,
  bitsToString, makeInt, withMetadata,
} from "./types.js";

import { evaluate } from "./evaluator.js";
import { getType, getTypeName, getFunctionParamTypes, BoolType, IntType } from "./types-std.js";

export interface ProvenFinding {
  /** The function the `proven` clause is attached to. */
  binding: string;
  /** Source-rendered predicate text — best effort (we don't carry source). */
  proposition: string;
  /** Concrete failing input as a counterexample, when available. */
  counterexample?: string;
  /** Why the predicate didn't hold. */
  reason: string;
}

/** Resolve a paramType AST/Value to its concrete type Context (via the
 *  evalCtx Symbol lookup if needed). Returns the Context that may carry
 *  `__name`, `abstractDomain`, etc. */
function resolveTypeContext(t: Value, evalCtx: StructureValue): StructureValue | null {
  let cur: Value = dataOf(t);
  if (cur.kind === ValueKind.Symbol) {
    const name = (cur as any).name as string;
    // C2.3b: chain-aware — type names (Int, Bool, user refinements) may
    // live on any layer of the root scope chain, not the source layer.
    const b = scopeLookup(evalCtx, name);
    if (!b?.value) return null;
    return resolveTypeContext(b.value, evalCtx);
  }
  return cur.kind === ValueKind.Structure ? (cur as StructureValue) : null;
}

/** Pick sample inputs for a parameter based on its resolved type. Returns
 *  `null` when the type isn't one of the F7-minimum shapes; the caller
 *  records this as a "type not sampleable" info notification. */
function pickSamples(typeCtx: StructureValue): Value[] | null {
  const nameBinding = getName(typeCtx);
  const name = nameBinding && dataOf(nameBinding).kind === ValueKind.Bits
    ? bitsToString(dataOf(nameBinding) as BitsValue) : null;

  // Bool — enumerate the domain.
  if (name === "Bool") {
    return [
      withMetadata(makeInt(1), new Map([["type", BoolType as Value]])),
      withMetadata(makeInt(0), new Map([["type", BoolType as Value]])),
    ];
  }

  // Samples must be TYPED (wrapped with Int) — the function's type_check
  // at call time inspects the value's type component to verify it
  // satisfies the param's declared type (which may be a refinement).
  const asTypedInt = (n: number): Value =>
    withMetadata(makeInt(n), new Map([["type", IntType as Value]]));

  // Refined Int (NonNeg / PositiveInt / SmallPos / etc.) — read the
  // abstract domain's `lo` to pick non-trivial samples.
  const dom = (typeCtx as any).abstractDomain;
  if (dom && dom.kind === "interval") {
    const lo = Number.isFinite(dom.lo) ? dom.lo : 0;
    const hi = Number.isFinite(dom.hi) ? dom.hi : Infinity;
    const samples: number[] = [];
    for (let i = 0; i < 4; i++) {
      const v = lo + i;
      if (v <= hi) samples.push(v);
    }
    return samples.map(asTypedInt);
  }

  // Plain Int — mix of boundary, small, and negative.
  if (name === "Int") {
    return [0, 1, 5, -3].map(asTypedInt);
  }

  return null;
}

/** Render a sample value as a short string for counterexamples. */
function describeSample(v: Value): string {
  const p = dataOf(v);
  if (p.kind !== ValueKind.Bits) return "?";
  const b = p as BitsValue;
  if (b.length !== 64) return "?";
  const d = b.data;
  const signed = d >= 0x8000000000000000n ? d - 0x10000000000000000n : d;
  // Bool rendering when the typed wrapper says so.
  const t = getType(v);
  if (t && getTypeName(v) === "Bool") return signed === 0n ? "false" : "true";
  return String(signed);
}

/** Walk an AST replacing Params owned by `cfn` (by position) with values
 *  from `posMap`. Mirrors evaluator.subst but is local to this module so
 *  we don't have to export the internal helper. */
function substParams(
  v: Value,
  cfn: ComposedFunctionValue,
  posMap: Map<number, Value>,
  seen: Set<Value> = new Set(),
): Value {
  if (!v || typeof v !== "object") return v;
  if (seen.has(v)) return v;
  switch (v.kind) {
    case ValueKind.Bits:
    case ValueKind.PrimitiveFunction:
    case ValueKind.Symbol:
      return v;
    case ValueKind.Param: {
      const p = v as ParamValue;
      // Match by owner identity (or unowned) and position.
      if ((p.owner === cfn || (p as any).owner == null) && posMap.has(p.position)) {
        return posMap.get(p.position)!;
      }
      return v;
    }
    case ValueKind.Expression: {
      seen.add(v);
      const e = v as ExpressionValue;
      const fn = substParams(e.fn, cfn, posMap, seen);
      const args = e.args.map(a => substParams(a, cfn, posMap, seen));
      return { ...e, fn, args };
    }
    case ValueKind.Structure: {
      seen.add(v);
      const pp = (v as any).primary;
      if (pp === undefined) return v;
      return withMetadata(substParams(pp, cfn, posMap, seen), componentsView(v) as Map<string, import("./types.js").Value>);
    }
    case ValueKind.ComposedFunction: {
      seen.add(v);
      // Don't recurse into inner ComposedFunctions — their Params have a
      // different owner so they wouldn't match anyway.
      return v;
    }
    default:
      return v;
  }
}

/** Render a Param's source name for predicate display. */
function paramName(p: ParamValue): string {
  return (p as any)._name ?? `param${p.position}`;
}

/** Render a predicate's structural shape for display when source isn't
 *  available. For F7 minimum we just say "predicate over `<param>`". */
function renderPredicateShape(cfn: ComposedFunctionValue): string {
  if (cfn.params.length === 1) {
    return `predicate over \`${paramName(cfn.params[0])}\``;
  }
  return `predicate`;
}

/** Walk an evalCtx and check every function binding that carries one or
 *  more `proven` clauses. Returns one finding per failing predicate. */
export function checkProvenClauses(
  evalCtx: StructureValue,
): { errors: ProvenFinding[]; infos: ProvenFinding[] } {
  const errors: ProvenFinding[] = [];
  const infos: ProvenFinding[] = [];

  for (const [name, binding] of evalCtx.bindings) {
    const val = binding.value;
    if (!val) continue;
    // Need a ComposedFunction body to peel + sample.
    let cfn: ComposedFunctionValue | null = null;
    let paramTypes: Value[] | null = null;
    if (val.kind === ValueKind.Structure && (val as any).primary !== undefined) {
      const mv = val as any;
      if (mv.primary?.kind === ValueKind.ComposedFunction) {
        cfn = mv.primary as ComposedFunctionValue;
        const tComp = channelReadRaw(mv, "type");
        if (tComp?.kind === ValueKind.Structure) {
          paramTypes = getFunctionParamTypes(tComp as StructureValue);
        }
      }
    } else if (val.kind === ValueKind.ComposedFunction) {
      cfn = val as ComposedFunctionValue;
    }
    if (!cfn) continue;

    const provenClauses = (cfn as any).provenClauses as Value[] | undefined;
    if (!provenClauses || provenClauses.length === 0) continue;

    // F7 minimum: single typed param. Multi-param + untyped emit info.
    if (cfn.params.length !== 1) {
      infos.push({
        binding: name,
        proposition: renderPredicateShape(cfn),
        reason: `proven check skipped: F7 minimum supports single-param functions only (got ${cfn.params.length} params)`,
      });
      continue;
    }
    const paramTypeAst = paramTypes?.[0];
    if (!paramTypeAst) {
      infos.push({
        binding: name,
        proposition: renderPredicateShape(cfn),
        reason: `proven check skipped: param has no type annotation (F7 minimum needs Int/NonNeg/PositiveInt/Bool)`,
      });
      continue;
    }
    const typeCtx = resolveTypeContext(paramTypeAst, evalCtx);
    if (!typeCtx) {
      infos.push({
        binding: name,
        proposition: renderPredicateShape(cfn),
        reason: `proven check skipped: could not resolve param type to a concrete Context`,
      });
      continue;
    }
    const samples = pickSamples(typeCtx);
    if (!samples) {
      const tn = getName(typeCtx);
      const tname = tn && dataOf(tn).kind === ValueKind.Bits
        ? bitsToString(dataOf(tn) as BitsValue) : "<type>";
      infos.push({
        binding: name,
        proposition: renderPredicateShape(cfn),
        reason: `proven check skipped: param type \`${tname}\` isn't sampleable (F7 minimum supports Int/NonNeg/PositiveInt/Bool)`,
      });
      continue;
    }

    // For each predicate, sample.
    const param = cfn.params[0];
    for (let pi = 0; pi < provenClauses.length; pi++) {
      const predAst = provenClauses[pi];
      let failed: { sample: Value; reason: string } | null = null;
      for (const sample of samples) {
        const posMap = new Map<number, Value>([[param.position, sample]]);
        const substituted = substParams(predAst, cfn, posMap);
        let result: Value;
        try {
          result = evaluate(substituted, evalCtx, 0);
        } catch (e: any) {
          failed = { sample, reason: `evaluation threw: ${e.message}` };
          break;
        }
        const rp = dataOf(result);
        if (rp.kind !== ValueKind.Bits || (rp as BitsValue).data !== 1n) {
          const rendered = rp.kind === ValueKind.Bits
            ? `${rp.data}` : `<${rp.kind}>`;
          failed = { sample, reason: `predicate did not reduce to true (got ${rendered})` };
          break;
        }
      }
      if (failed) {
        errors.push({
          binding: name,
          proposition: renderPredicateShape(cfn),
          counterexample: `at ${paramName(param)} = ${describeSample(failed.sample)}: ${failed.reason}`,
          reason: `proven clause #${pi + 1} failed`,
        });
      }
    }
  }

  return { errors, infos };
}

/** One-line render for the notification message. */
export function formatProvenFinding(f: ProvenFinding): string {
  return `function \`${f.binding}\` — ${f.reason}: ${f.proposition}`;
}
