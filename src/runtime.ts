// =============================================================================
// Allegretto - Runtime
// Bridges the parser's output to the evaluator.
// =============================================================================

import { parseExtended, GrammarExtension } from "./grammar-ext.js";
import { dataOf, metaReadRaw, cloneMeta, hasShapeSlot, getName, renameInPlace, bumpMetaEpoch, isBareBindingName, isFutureBindingName, isMetaSlotKey, withSource, carryMeta} from "./slots.js";
import { scopeNew, scopeLookup, scopeAllBindings, makeCell, resolveCell } from "./scope.js";
import { markTailCalls, precompileFunction, remapParams, setInlineCutoff } from "./evaluator.js";
import { parse as grammar2Parse } from "./grammar2/engine.js";
import { getBaseGrammar } from "./grammar2/base-grammar.js";
import { buildProgram } from "./grammar2/tree-builder.js";
import { getGrammarWithFragments } from "./grammar2/fragments.js";
import { analyze as analyzeGrammar, assertClean as assertGrammarClean } from "./grammar2/analyzer.js";
import { primitives, asGrammarValue } from "./primitives.js";
import { evaluate } from "./evaluator.js";
import { Value, ValueKind, StructureValue, Binding, BitsValue, PrimitiveFunctionValue, ExpressionValue, ComposedFunctionValue, ParamValue, makeStructure, makeExpr, makePrimitive, withMeta, bitsToString, stringToBits, Extension, DepCollector, isResolved, GrammarFragment, AllegroError} from "./types.js";
import { checkEffectsDeclarations, formatMismatch, opaqueEffectNotices, effectsOf } from "./effects.js";
import { collapseBodyMetadata, checkExhaustiveness, analyzeDivergence, NOTIF_TOTALITY_NEEDS_ANNOTATION, DivObligation, DivergenceResult } from "./totality.js";
import { isFailedProof, describeFailedProof, formatProofFinding, ProofFinding } from "./proofs.js";
import { checkProvenClauses, formatProvenFinding } from "./proven.js";
import { registerScopeSymbol, MAIN_SCOPE_FQN, typeMemberScopeFqn, FQN_SEP } from "./symbols.js";
import { withType, IntType, StringType, wrapAsUntypedFunction, getType, getTypeName, getFunctionParamTypes, getFunctionReturnType, stabilizeTypeMemberScope, setLawInstantiationSuspended, setDivergenceProbe, resolveDataSlots } from "./types-std.js";

// Re-export Extension for backward compatibility
export type { Extension };

/**
 * Walk an expression tree and wrap literal Bits values with type information.
 * Int literals (64-bit) become MultiValue with Int type.
 * String literals (non-64-bit, from stringToBits) become MultiValue with String type.
 * Used when standard type system is active.
 */
export function typeLiterals(v: Value, seen?: Set<Value>): Value {
  if (!seen) seen = new Set();
  // Only track ComposedFunctions for cycle detection (self-referential function bodies).
  // Do NOT skip Expressions — shared expression objects (like subject in multi-case when)
  // must be processed each time they appear to ensure all references get updated.
  if (v.kind === ValueKind.ComposedFunction && seen.has(v)) return v;

  switch (v.kind) {
    case ValueKind.Bits:
      if (v.length === 64) return withType(v, IntType);
      return withType(v, StringType);
    case ValueKind.Expression: {
      const newFn = typeLiterals(v.fn, seen);
      const newArgs = v.args.map(a => typeLiterals(a, seen));
      if (newFn === v.fn && newArgs.every((a, i) => a === v.args[i])) return v;
      return makeExpr(newFn, newArgs);
    }
    case ValueKind.ComposedFunction: {
      seen.add(v);
      const newBody = typeLiterals(v.body, seen);
      if (newBody === v.body) return v;
      const newFn: ComposedFunctionValue = carryMeta(v, { kind: ValueKind.ComposedFunction, params: v.params, body: newBody });
      for (const p of newFn.params) p.owner = newFn;
      // Preserve generic-param / effect-var-param metadata across clones so
      // Slice 2's polymorphism resolution still works after this pass.
      if ((v as any).genericParams) (newFn as any).genericParams = (v as any).genericParams;
      return newFn;
    }
    case ValueKind.Structure:
      // Structures are inert. B-121 C4: the carrier arm is deleted — the
      // values this pass types are Bits, which the literal cases above reach
      // directly now instead of through a wrapper.
      return v;
    default:
      return v;
  }
}

/**
 * The parser creates stub PrimitiveFunctionValues with fn: null.
 * This walks a value tree and replaces them with real primitives.
 */
export function resolvePrimitives(v: any, seen: Set<any> = new Set()): Value {
  if (!v || typeof v !== "object" || seen.has(v)) return v;
  seen.add(v);

  if (v.kind === "PrimitiveFunction" && v.fn === null) {
    const real = primitives[v.name];
    if (real) return real;
    throw new Error(`Unknown primitive: ${v.name}`);
  }

  if (v.kind === "Expression") {
    v.fn = resolvePrimitives(v.fn, seen);
    for (let i = 0; i < v.args.length; i++) {
      v.args[i] = resolvePrimitives(v.args[i], seen);
    }
    return v;
  }

  if (v.kind === "ComposedFunction") {
    v.body = resolvePrimitives(v.body, seen);
    return v;
  }

  return v;
}

/**
 * Resolve all named symbols (Param position=-1) in a file context using lexical scoping.
 * Two-pass per context:
 *   1. Collect all binding names in the context
 *   2. Walk expression trees, replacing Param(-1, "name") with direct references
 *
 * Resolution order (inner to outer):
 *   - Source bindings (same context)
 *   - Base context (REPL persistence)
 *   - Extensions (type system, modules, etc.)
 *   - Primitives
 *
 * After resolution, no named Params remain — everything is either:
 *   - A positional Param (function parameter)
 *   - A direct reference to the definition value
 *   - An unresolvable name (throws error)
 *
 * Recursive functions: the function body references the same ComposedFunction
 * object, creating a direct circular reference (JavaScript handles this fine).
 */
export function resolveSymbols(
  fileCtx: any,
  base?: StructureValue,
  extensions?: Extension[],
  typed?: boolean,
): void {
  // Build the full resolution map: name → value
  // Order matters: later entries shadow earlier ones
  const resolutionMap = new Map<string, Value>();

  // Layer 1: Primitives
  for (const [name, prim] of Object.entries(primitives)) {
    if (typed && (prim as any).kind === ValueKind.PrimitiveFunction) {
      resolutionMap.set(name, wrapAsUntypedFunction(prim as Value));
    } else {
      resolutionMap.set(name, prim as Value);
    }
  }

  // Layer 2: Extensions
  if (extensions) {
    for (const ext of extensions) {
      for (const [name, value] of Object.entries(ext.bindings)) {
        resolutionMap.set(name, value);
      }
      if (ext.moduleObject) {
        resolutionMap.set(ext.name, ext.moduleObject);
      }
    }
  }

  // Layer 3: Base context (REPL persistence). The base may be a layered
  // scope chain (C2.3b root layering) — flatten it so every persisted
  // binding participates in resolution.
  if (base) {
    for (const [key, binding] of scopeAllBindings(base)) {
      if (binding.value !== undefined) {
        resolutionMap.set(key, binding.value);
      }
    }
  }

  // Layer 4: Source bindings — collect names first (two-pass)
  // First pass: resolve primitive stubs and record all source binding names
  const sourceNames = new Set<string>();
  for (const b of fileCtx.bindingList) {
    if (b.key !== null) {
      sourceNames.add(b.key);
      // Resolve primitive stubs in the binding values
      if (b.value !== undefined) {
        b.value = resolvePrimitives(b.value);
      }
    }
  }

  // Add source bindings to resolution map (values may still contain unresolved named Params)
  for (const b of fileCtx.bindingList) {
    if (b.key !== null && b.value !== undefined) {
      resolutionMap.set(b.key, b.value);
    }
  }

  // Second pass: resolve non-source names (primitives, extensions, base context)
  // Skip source binding names — they may have forward/mutual references
  const nonSourceMap = new Map(resolutionMap);
  for (const name of sourceNames) nonSourceMap.delete(name);

  for (const b of fileCtx.bindingList) {
    if (b.value !== undefined) {
      b.value = resolveNamedParams(b.value, nonSourceMap, null);
    }
  }

  // Third pass: patch source-binding references in-place
  // Build a map from source name → binding object (so mutations propagate)
  // Use in-place patching to handle mutual recursion and self-references
  const sourceBindings = new Map<string, any>();
  for (const b of fileCtx.bindingList) {
    if (b.key !== null && b.value !== undefined) {
      sourceBindings.set(b.key, b);
    }
  }

  // Third pass removed: source-to-source references stay as Symbols and resolve
  // from the eval context at runtime. This ensures that when a binding is evaluated,
  // subsequent references see the evaluated value (not the pre-evaluation expression).
  // This is correct with forward-chaining: bindings evaluate once, results stored
  // in evalCtx, and Symbols resolve to those results.
  // Previously patchNamedParams created direct value references which prevented
  // re-evaluation from seeing updated values (the auto-naming/duplicate-object issue).
}

/**
 * In-place patch: find Param(-1, name) in expression trees and replace
 * with the binding's current value. Uses the binding object so the
 * reference stays current even for mutual recursion.
 * Creates circular references for recursive functions (JS handles this).
 */
function patchNamedParams(
  value: Value,
  name: string,
  binding: { value: Value },
  seen: Set<Value>,
): void {
  if (!value || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);

  if (value.kind === ValueKind.Expression) {
    if (value.fn.kind === ValueKind.Symbol && value.fn.name === name) {
      (value as any).fn = binding.value;
    } else {
      patchNamedParams(value.fn, name, binding, seen);
    }
    for (let i = 0; i < value.args.length; i++) {
      const arg = value.args[i];
      if (arg.kind === ValueKind.Symbol && arg.name === name) {
        value.args[i] = binding.value;
      } else {
        patchNamedParams(arg, name, binding, seen);
      }
    }
  } else if (value.kind === ValueKind.ComposedFunction) {
    // Don't patch params that shadow the name
    const shadows = value.params.some(p => p._name === name);
    if (!shadows) {
      patchNamedParams(value.body, name, binding, seen);
    }
  }
  // B-121 C4: the Structure arm walked a carrier's `primary`; structures
  // themselves were always inert here.
}

/**
 * Walk an expression tree and replace named Params (position=-1) with their
 * definitions from the resolution map.
 *
 * @param selfName — if provided, skip resolution of this name to handle
 *   recursive self-references. The function's body will contain a Param
 *   that refers to itself. After this pass, we patch it with the actual
 *   function reference.
 */
function resolveNamedParams(
  value: Value,
  resMap: Map<string, Value>,
  selfName?: string | null,
  seen?: Set<Value>,
): Value {
  if (!seen) seen = new Set();
  if (!value || typeof value !== "object") return value;
  // Only track ComposedFunctions for cycle detection — NOT Expressions.
  // Shared expression objects (e.g., subject in multi-case when) must be
  // processed each time they appear to ensure all references get updated.
  if (value.kind === ValueKind.ComposedFunction && seen.has(value)) return value;

  switch (value.kind) {
    case ValueKind.Bits:
      return value;

    case ValueKind.PrimitiveFunction: {
      if ((value as any).fn === null) {
        const real = primitives[value.name];
        if (real) return real;
      }
      return value;
    }

    case ValueKind.Param:
      return value;

    case ValueKind.Symbol: {
      if (value.name === selfName) return value;
      const resolved = resMap.get(value.name);
      if (resolved !== undefined) return resolved;
      return value;
    }

    case ValueKind.ComposedFunction: {
      seen.add(value);
      const fn = value as ComposedFunctionValue;
      const ownParamNames = new Set(fn.params.map(p => p._name).filter(Boolean) as string[]);
      const newBody = resolveNamedParamsInner(fn.body, resMap, fn, ownParamNames, selfName, seen);
      if (newBody === fn.body) return value;
      // CRITICAL: clone params so that mutating owner below doesn't corrupt
      // the original function. Without this, earlier-resolved closures that
      // share this params array would have their params re-pointed to newFn.
      // See evaluator.ts subst() for the same fix pattern.
      const newParams = fn.params.map(p => ({
        kind: ValueKind.Param,
        position: p.position,
        owner: null as any,
        _name: p._name,
      } as ParamValue));
      const paramMap = new Map<ParamValue, ParamValue>();
      for (let i = 0; i < fn.params.length; i++) paramMap.set(fn.params[i], newParams[i]);
      const remappedBody = remapParams(newBody, paramMap);
      const newFn: ComposedFunctionValue = carryMeta(fn, {
        kind: ValueKind.ComposedFunction,
        params: newParams,
        body: remappedBody,
      });
      for (const p of newFn.params) p.owner = newFn;
      if ((fn as any).genericParams) (newFn as any).genericParams = (fn as any).genericParams;
      return newFn;
    }

    case ValueKind.Expression: {
      const newFn = resolveNamedParams(value.fn, resMap, selfName, seen);
      const newArgs = value.args.map(a => resolveNamedParams(a, resMap, selfName, seen));
      if (newFn === value.fn && newArgs.every((a, i) => a === value.args[i])) return value;
      return makeExpr(newFn, newArgs);
    }

    case ValueKind.Structure:
      return value; // inert — B-121 C4 deleted the carrier arm
  }
  return value;
}

/**
 * Inner resolution for function bodies — skips params owned by the enclosing function
 * and params that shadow outer bindings.
 */
function resolveNamedParamsInner(
  value: Value,
  resMap: Map<string, Value>,
  owner: ComposedFunctionValue,
  ownParamNames: Set<string>,
  selfName?: string | null,
  seen?: Set<Value>,
): Value {
  if (!value || typeof value !== "object") return value;
  if (!seen) seen = new Set();
  // Only track ComposedFunctions for cycle detection
  if (value.kind === ValueKind.ComposedFunction && seen.has(value)) return value;

  switch (value.kind) {
    case ValueKind.Bits:
      return value;

    case ValueKind.PrimitiveFunction: {
      if ((value as any).fn === null) {
        const real = primitives[value.name];
        if (real) return real;
      }
      return value;
    }

    case ValueKind.Param: {
      if (value.owner === owner) return value;
      return value;
    }

    case ValueKind.Symbol: {
      if (ownParamNames.has(value.name)) return value;
      if (value.name === selfName) return value;
      const resolved = resMap.get(value.name);
      if (resolved !== undefined) return resolved;
      return value;
    }

    case ValueKind.ComposedFunction: {
      seen.add(value);
      const fn = value as ComposedFunctionValue;
      const innerOwn = new Set(fn.params.map(p => p._name).filter(Boolean) as string[]);
      const newBody = resolveNamedParamsInner(fn.body, resMap, fn, innerOwn, selfName, seen);
      if (newBody === fn.body) return value;
      // Clone params — see resolveNamedParams above and evaluator.ts subst().
      const newParams = fn.params.map(p => ({
        kind: ValueKind.Param,
        position: p.position,
        owner: null as any,
        _name: p._name,
      } as ParamValue));
      const paramMap = new Map<ParamValue, ParamValue>();
      for (let i = 0; i < fn.params.length; i++) paramMap.set(fn.params[i], newParams[i]);
      const remappedBody = remapParams(newBody, paramMap);
      const newFn: ComposedFunctionValue = carryMeta(fn, {
        kind: ValueKind.ComposedFunction,
        params: newParams,
        body: remappedBody,
      });
      for (const p of newFn.params) p.owner = newFn;
      if ((fn as any).genericParams) (newFn as any).genericParams = (fn as any).genericParams;
      return newFn;
    }

    case ValueKind.Expression: {
      const newFn = resolveNamedParamsInner(value.fn, resMap, owner, ownParamNames, selfName, seen);
      const newArgs = value.args.map(a => resolveNamedParamsInner(a, resMap, owner, ownParamNames, selfName, seen));
      if (newFn === value.fn && newArgs.every((a, i) => a === value.args[i])) return value;
      return makeExpr(newFn, newArgs);
    }

    case ValueKind.Structure:
      return value; // inert — B-121 C4 deleted the carrier arm
  }
  return value;
}

/**
 * Walk all bindings and mark tail-position calls in ComposedFunction bodies.
 */
function markTailCallsInContext(fileCtx: any): void {
  // C1.5b: collapse body-form metadata wrappers onto function properties
  // BEFORE tail-call marking, so tail positions are computed on the real
  // body (previously the passthrough wrappers had to forward TailCalls).
  const collapseSeen = new Set<any>();
  for (const b of fileCtx.bindingList) {
    if (b.value !== undefined) collapseBodyMetadata(b.value, collapseSeen);
  }
  const seen = new Set<any>();
  for (const b of fileCtx.bindingList) {
    if (b.value !== undefined) {
      markTailCallsInValue(b.value, seen);
    }
  }
}

function markTailCallsInValue(v: any, seen: Set<any>): void {
  if (!v || typeof v !== "object" || seen.has(v)) return;
  seen.add(v);
  if (v.kind === "ComposedFunction") {
    // Mark the body's outermost expression as tail position
    markTailCalls(v.body, new Set());
    // Also recurse into the body to find nested functions
    markTailCallsInValue(v.body, seen);
  } else if (v.kind === "Expression") {
    markTailCallsInValue(v.fn, seen);
    for (const a of v.args) markTailCallsInValue(a, seen);
  }
}

// --- Compilation Report ---

/** A diagnostic emitted during compilation. The single category that replaced
 *  the former errors / warnings / notifications split — every diagnostic now
 *  carries a `kind` tag and a `severity`, so per-project config can remap
 *  rules without changing the storage. Filtering helpers below select by
 *  severity for consumers that only want one tier. */
export type Severity = "error" | "warning" | "info";

export interface Notification {
  /** Stable rule tag — project config keys on this to remap severity.
   *  Examples: `"effects-mismatch"`, `"return-type-mismatch"`,
   *  `"precompile-eval"`, `"effects-opaque-from-stdlib-hof"`. */
  kind:      string;
  /** Human-readable message. */
  message:   string;
  /** Severity at emission. Error halts compilation when surfaced through
   *  `evalSource`'s throw; warning and info do not. */
  severity:  Severity;
  /** Binding the diagnostic is anchored to, if applicable. */
  binding?:  string;
  /** Phase E Stage 6: concrete witness illustrating the failure. For
   *  totality notifications, this is a trace or sample input that would
   *  trigger the unsoundness, e.g. `factorial(n=any) → factorial(n)` for
   *  non-decreasing recursion, or `f(false) falls through` for missing
   *  Bool cases. Renderers surface this prominently when present. */
  counterexample?: string;
}

export interface CompilationReport {
  /** Functions with inferred return types */
  inferred: { name: string; returnType: string }[];
  /** Bindings still unresolved after compilation */
  unresolved: string[];
  /** Inferred types for all bindings (populated during evaluation) */
  bindingTypes: Map<string, string>;
  /** All diagnostics — errors, warnings, and informational notices. Filter
   *  via `notificationsBySeverity` / `reportErrors` / `reportHasErrors`. */
  notifications: Notification[];
  /** B-028 F3 (CE-R2): per-binding div discharge record (D34 tiers) —
   *  consumed by the Verdict ledger and the obligations surface. */
  divObligations?: DivObligation[];
}

/** Filter notifications by one severity. */
export function notificationsBySeverity(
  report: CompilationReport,
  severity: Severity,
): Notification[] {
  return report.notifications.filter(n => n.severity === severity);
}

/** Convenience: the error-severity slice (most common consumer pattern). */
export function reportErrors(report: CompilationReport): Notification[] {
  return notificationsBySeverity(report, "error");
}

/** Convenience: does the report carry any error-severity notification? */
export function reportHasErrors(report: CompilationReport): boolean {
  return report.notifications.some(n => n.severity === "error");
}

/**
 * Pre-compile typed functions: partially evaluate their bodies with
 * typed param placeholders to infer return types and detect type errors.
 */
function precompileFunctions(
  fileCtx: any,
  extensions?: Extension[],
  typed?: boolean,
): CompilationReport {
  const report: CompilationReport = { inferred: [], unresolved: [], bindingTypes: new Map(), notifications: [] };
  if (!typed) return report;

  // E3: the pass's exploratory binding evaluations mint throwaway type
  // objects (the real evaluation mints the bound ones) — suspend law-
  // obligation instantiation + the E-R5 gate so definition-time semantics
  // fire exactly once, at the real evaluation.
  setLawInstantiationSuspended(true);
  try {
    return precompileFunctionsInner(fileCtx, extensions, report);
  } finally {
    setLawInstantiationSuspended(false);
  }
}

function precompileFunctionsInner(
  fileCtx: any,
  extensions: Extension[] | undefined,
  report: CompilationReport,
): CompilationReport {
  // Build a minimal context for pre-compilation (primitives + extensions)
  const compileCtx = makeStructure();
  for (const [name, prim] of Object.entries(primitives)) {
    const binding = { key: name, value: prim as Value };
    compileCtx.bindings.set(name, binding);
    compileCtx.bindingList.push(binding);
  }
  if (extensions) {
    for (const ext of extensions) {
      for (const [name, value] of Object.entries(ext.bindings)) {
        const binding = { key: name, value };
        compileCtx.bindings.set(name, binding);
        compileCtx.bindingList.push(binding);
      }
      if (ext.moduleObject) {
        const binding = { key: ext.name, value: ext.moduleObject };
        compileCtx.bindings.set(ext.name, binding);
        compileCtx.bindingList.push(binding);
      }
    }
  }
  // Add source bindings to compile context
  for (const b of fileCtx.bindingList) {
    if (b.key !== null && b.value !== undefined) {
      compileCtx.bindings.set(b.key, { key: b.key, value: b.value });
      compileCtx.bindingList.push({ key: b.key, value: b.value });
    }
  }

  for (const b of fileCtx.bindingList) {
    if (b.key === null || b.value === undefined) continue;

    // Evaluate the binding to resolve typed_function wrappers
    let val: Value;
    try {
      val = evaluate(b.value, compileCtx, 0);
    } catch (e: any) {
      // Skip bindings that can't be evaluated at compile time
      report.notifications.push({
        kind:     "precompile-eval",
        severity: "error",
        binding:  b.key ?? "?",
        message:  `precompile eval: ${e.message}`,
      });
      continue;
    }

    // Precompile any function-shaped binding. Three forms in standard mode:
    //   - MultiValue + FunctionType (typed function via `typed_function`)
    //   - MultiValue + UntypedFunction (wrapped primitive)
    //   - bare ComposedFunction (user-defined without type annotations)
    // For untyped forms paramTypes is null; precompileFunction uses bare-
    // Param placeholders and we get effect inference via PE residuals,
    // even though return-type inference is weaker without typed args.
    let fn: Value;
    let fnType: Value | null = null;
    let paramTypes: Value[] | null = null;
    // B-121 C2: was `if (isCarrier(val))` reading `val.primary` — "is a
    // carrier over a ComposedFunction" standing in for "a function value
    // carrying a type". A typed function is now a ComposedFunction with
    // `meta`, so both the guard and the `.primary` read had to go. The typed
    // branch is tried first because a typed function also satisfies the plain
    // one below it.
    const fnType0 = getType(val);
    const typeName0 = fnType0 ? getTypeName(val) : null;
    const isTyped = typeName0 === "Function";
    const isUntyped = typeName0 === "UntypedFunction";
    const datum = dataOf(val);
    if (fnType0 && (isTyped || isUntyped) && datum.kind === ValueKind.ComposedFunction) {
      fnType = fnType0;
      fn = datum;
      paramTypes = isTyped ? getFunctionParamTypes(fnType) : null;
      if (isTyped && !paramTypes) continue;
    } else if (val.kind === ValueKind.ComposedFunction) {
      fn = val;
    } else {
      continue;
    }

    // Pre-compile: partially evaluate body with typed placeholders
    const { inferredReturnType, errors: fnErrors } = precompileFunction(
      fn as ComposedFunctionValue,
      paramTypes ?? [],
      compileCtx,
    );

    if (fnErrors.length > 0) {
      for (const err of fnErrors) {
        report.notifications.push({
          kind:     "precompile-type-error",
          severity: "error",
          binding:  b.key,
          message:  err,
        });
      }
    }

    if (inferredReturnType) {
      const inferredName = inferredReturnType.kind === ValueKind.Structure
        ? getName(inferredReturnType as StructureValue)
        : null;
      const inferredStr = inferredName && inferredName.kind === ValueKind.Bits
        ? bitsToString(inferredName as BitsValue)
        : "unknown";
      report.inferred.push({ name: b.key, returnType: inferredStr });

      // Check against explicit return type if declared (typed functions only)
      const declaredReturn = fnType ? getFunctionReturnType(fnType) : null;
      if (declaredReturn && declaredReturn.kind === ValueKind.Structure) {
        const declaredName = getName(declaredReturn as StructureValue);
        const declaredStr = declaredName && declaredName.kind === ValueKind.Bits
          ? bitsToString(declaredName as BitsValue)
          : null;
        if (declaredStr && inferredStr !== "unknown" && declaredStr !== inferredStr && declaredStr !== "Any") {
          report.notifications.push({
            kind:     "return-type-mismatch",
            severity: "error",
            binding:  b.key,
            message:  `Return type mismatch: declared ${declaredStr}, inferred ${inferredStr}`,
          });
        }
      }
    }
  }

  // Scan for unresolved bindings
  for (const b of fileCtx.bindingList) {
    if (b.key !== null && b.value === undefined) {
      report.unresolved.push(b.key);
    }
  }

  return report;
}

/**
 * Build an evaluation context from a parser file context.
 *
 * C2.3b: the root context is a real SCOPE CHAIN (rootmost first):
 *   1. Primitives — base language built-ins
 *   2. Extensions — anonymous extensions from the execution context
 *   3. Base context — REPL persistence / pre-existing bindings (flattened
 *      copies of the previous pass's chain, so completions in this pass
 *      never mutate the previous pass's ctx)
 *   4. Source bindings — parsed from the current source file (the layer
 *      returned; its OWN map holds exactly the source-level bindings)
 *
 * Lookup walks the chain (scopeLookup) — nearer layers shadow. Source
 * bindings that are declared but unresolved (e.g. `import foo` with no
 * provider anywhere below) become PENDING FUTURE CELLS in the source
 * layer, distinguishing them from genuinely absent names.
 */
export function buildEvalCtx(
  fileCtx: any,
  base?: StructureValue,
  extensions?: Extension[],
  typed?: boolean,
): StructureValue {
  // Per-layer add with replace-or-push semantics (same-name re-adds within
  // one layer replace the earlier entry rather than duplicating).
  function addTo(layer: StructureValue, key: string, value: Value): void {
    const binding: Binding = { key, value };
    const existingIdx = layer.bindingList.findIndex(x => x.key === key);
    if (existingIdx >= 0) {
      layer.bindingList[existingIdx] = binding;
    } else {
      layer.bindingList.push(binding);
    }
    layer.bindings.set(key, binding);
  }

  // Layer 1: Primitives
  // In typed/standard mode, wrap function primitives as UntypedFunction
  const primLayer = scopeNew();
  for (const [name, prim] of Object.entries(primitives)) {
    if (typed && (prim as any).kind === ValueKind.PrimitiveFunction) {
      addTo(primLayer, name, wrapAsUntypedFunction(prim as Value));
    } else {
      addTo(primLayer, name, prim as Value);
    }
  }

  // Layer 2: Extensions (applied in order, later extensions shadow earlier ones)
  let below: StructureValue = primLayer;
  if (extensions && extensions.length > 0) {
    const extLayer = scopeNew(below);
    for (const ext of extensions) {
      for (const [name, value] of Object.entries(ext.bindings)) {
        addTo(extLayer, name, value);
      }
      // If extension has a typed module object, bind the module name to it.
      // This is what `import <name>` resolves to — the encapsulated module.
      if (ext.moduleObject) {
        addTo(extLayer, ext.name, ext.moduleObject);
      }
    }
    below = extLayer;
  }

  // Layer 3: Base context (REPL persistence). Flatten the base's own chain
  // and copy each binding into a fresh object — in-place cell resolution in
  // THIS pass must not reach back into the previous pass's ctx.
  if (base) {
    const baseLayer = scopeNew(below);
    for (const [key, binding] of scopeAllBindings(base)) {
      if (binding.value !== undefined) {
        addTo(baseLayer, key, binding.value);
      } else {
        // Carry unresolved bindings forward as fresh pending cells — a
        // REPL `import foo` awaiting a later phase stays unresolved (and
        // residualising) across passes, exactly as the flat copy did.
        const cell = makeCell(key);
        baseLayer.bindings.set(key, cell);
        baseLayer.bindingList.push(cell);
      }
    }
    below = baseLayer;
  }

  // Layer 4: Source bindings (already resolved by resolveSymbols). This is
  // the returned scope; dynamically-added bindings (futures, bare residuals,
  // applyPhase completions) land here too.
  const evalCtx = scopeNew(below);
  for (const b of fileCtx.bindingList) {
    if (b.key === null) continue;
    if (b.value !== undefined) {
      addTo(evalCtx, b.key, b.value);
      // B-097 V1: visibility rides the BINDING into the eval scope —
      // the module loader reads it off evalCtx (never off values).
      if (b.visibility) evalCtx.bindings.get(b.key)!.visibility = b.visibility;
    } else if (scopeLookup(below, b.key) === undefined && !evalCtx.bindings.has(b.key)) {
      // Declared but unresolved with no provider below — a pending future
      // cell awaiting a later phase (applyPhase resolves it in place).
      // Names provided by a lower layer (e.g. `import math` satisfied by a
      // module extension) resolve through the chain and get no cell.
      const cell = makeCell(b.key);
      evalCtx.bindings.set(b.key, cell);
      evalCtx.bindingList.push(cell);
    }
  }

  return evalCtx;
}

/**
 * Wrap an Extension's bindings as a Context value.
 * If the extension has a moduleObject (typed module), returns it as the primary.
 * Otherwise wraps bindings as a plain Context (backward compat).
 */
export function extensionToStructure(ext: Extension): Value {
  if (ext.moduleObject) return ext.moduleObject;
  const ctx = makeStructure();
  for (const [name, value] of Object.entries(ext.bindings)) {
    const binding: Binding = { key: name, value };
    ctx.bindings.set(name, binding);
    ctx.bindingList.push(binding);
  }
  return ctx;
}

// =============================================================================
// Forward-Chaining Reactive Partial Evaluation
// =============================================================================

/** Registry of reactive bindings and their dependency relationships.
 *  C2.3b: the registry tracks the SAME `Binding` objects the evaluation
 *  scope's source layer holds — a binding IS its future cell (value +
 *  `incompleteDeps` + `isComplete` on one record). The former
 *  `ReactiveBinding.currentValue` mirror and its dual-write dance are
 *  gone: resolving a cell is one in-place write visible to both. */
export interface DependencyRegistry {
  /** Maps incomplete binding name → set of binding keys that depend on it */
  dependents: Map<string, Set<string>>;
  /** All reactive bindings by key — shared with the eval scope's own layer */
  bindings: Map<string, Binding>;
}

/** Create an empty dependency registry. */
export function createRegistry(): DependencyRegistry {
  return { dependents: new Map(), bindings: new Map() };
}

/** Register a binding's incomplete dependencies in the registry. */
function registerDeps(registry: DependencyRegistry, key: string, deps: Set<string>): void {
  for (const depName of deps) {
    let set = registry.dependents.get(depName);
    if (!set) { set = new Set(); registry.dependents.set(depName, set); }
    set.add(key);
  }
}

/**
 * Forward-chain: when bindings complete, re-evaluate their dependents.
 * Cascades until no more completions occur.
 */
function propagateCompletions(
  registry: DependencyRegistry,
  evalCtx: StructureValue,
  completedNames: Set<string>,
): void {
  // B-028 F1: ITERATIVE cascade. The former recursion's depth was
  // bounded by dependency-chain length — a deep enough chain of
  // completions could blow the JS stack. The loop preserves the exact
  // semantics: each pass re-evaluates the dependents of the names
  // completed by the previous pass, until a pass completes nothing new.
  // Termination is structural (a binding completes at most once and
  // completed bindings are skipped, so every pass either completes a
  // new binding or is the last); a binding MAY re-evaluate once per
  // pass — that is legitimate convergence as its deps land, not a cycle.
  let frontier = completedNames;
  while (frontier.size > 0) {
    const worklist = new Set<string>();

    // Collect all bindings that depend on the newly completed names
    for (const name of frontier) {
      const deps = registry.dependents.get(name);
      if (deps) {
        for (const depKey of deps) worklist.add(depKey);
        registry.dependents.delete(name);
      }
    }

    const newlyCompleted = new Set<string>();

    for (const key of worklist) {
      const rb = registry.bindings.get(key);
      // Skip cells still pending with no residual to re-evaluate (their
      // completion comes directly through applyPhase).
      if (!rb || rb.value === undefined) continue;
      // B-028 F4 (D33 completion replacement): a binding that completed
      // while an UNTOUCHED slot was still pending (guarded construction —
      // the invariant's fields landed first, D32 pipelining) holds that
      // slot as a stale symbol. When the slot's future lands, refine the
      // stored instance in place: copy-on-write value, one monotone cell
      // write — the same value, more resolved. Never a re-resolution, so
      // write-once (D33) is untouched.
      if (rb.isComplete) {
        const refined = resolveDataSlots(rb.value, evalCtx,
          (vv, cc) => evaluate(vv, cc, 0) as Value, /* cellRefsOnly */ true);
        if (refined !== rb.value) rb.value = refined;
        continue;
      }

      // Re-evaluate the residual in the updated context. The residual is
      // replaced (not mutated); the write goes to the ONE shared binding.
      const collector: DepCollector = { incompleteRefs: new Set() };
      const newVal = evaluate(rb.value, evalCtx, 0, collector);
      const nowComplete = isResolved(newVal);
      resolveCell(rb, newVal, nowComplete, collector.incompleteRefs);

      if (nowComplete) {
        newlyCompleted.add(key);
      } else {
        // Re-register remaining dependencies
        registerDeps(registry, key, collector.incompleteRefs);
      }
    }

    frontier = newlyCompleted;
  }
}

/**
 * Apply a new phase: add bindings and trigger re-evaluation of dependents.
 * Used for import resolution, REPL persistence, and multi-phase builds.
 */
export function applyPhase(
  registry: DependencyRegistry,
  evalCtx: StructureValue,
  newBindings: Map<string, Value>,
): void {
  const completed = new Set<string>();

  for (const [name, value] of newBindings) {
    // Resolve an existing cell in place (pending import, async future) —
    // the registry shares the object, so one write completes both views.
    // Only genuinely new names get fresh bindings.
    const existing = evalCtx.bindings.get(name);
    const tracked = registry.bindings.get(name);
    // B-028 F1 (D33): cells resolved through the phase interface are
    // WRITE-ONCE — a second resolution of a completed cell is an
    // invariant violation, not a quiet overwrite. (Ordinary source
    // rebinding never goes through applyPhase; monotonic residual
    // refinement goes through propagateCompletions' resolveCell, which
    // only touches incomplete cells.)
    if (existing?.isComplete) {
      throw new AllegroError(
        `applyPhase: '${name}' is already resolved — future/import cells are write-once (D33)`);
    }
    if (existing) {
      resolveCell(existing, value, true);
    } else {
      const binding: Binding = { key: name, value, isComplete: true };
      evalCtx.bindings.set(name, binding);
      evalCtx.bindingList.push(binding);
    }
    // Defensive: a registry entry that predates the unification (or was
    // installed by an external caller) may not alias the ctx binding.
    if (tracked && tracked !== existing && !tracked.isComplete) resolveCell(tracked, value, true);
    completed.add(name);
  }

  propagateCompletions(registry, evalCtx, completed);
}

// =============================================================================
// Source Evaluation
// =============================================================================

/**
 * Parse and evaluate Allegro source code.
 * Uses the hybrid parser (Pratt + recursive descent) by default.
 * Falls back to Earley parser when a grammarExtension is provided
 * (for standalone grammars or tests using the old extension mechanism).
 *
 * @param source           — Allegro source code
 * @param base             — pre-existing context (REPL persistence)
 * @param extensions       — anonymous extensions from the execution context
 * @param grammarExtension — Earley grammar extension (legacy, for standalone grammars)
 * @param typed            — if true, wrap literals with type info (Allegro Standard)
 */
export function evalSource(
  source: string,
  base?: StructureValue,
  extensions?: Extension[],
  grammarExtension?: GrammarExtension,
  typed?: boolean,
  futureManager?: import("./futures.js").FutureManager,
  /** Phase H2: when true, proof / proven / effects failures push their
   *  notifications as usual but do NOT throw. The caller gets the full
   *  evalCtx + compilationReport and decides how to surface the failures
   *  (e.g. the `allegro verify` CLI emits them as a Verdict). Default
   *  false (compilation halts on failure — "build safety in"). */
  softFail?: boolean,
  /** C5.1: the defining-scope FQN for this source's top-level bindings
   *  (default `<main>`; ModuleLoader passes the resolved module file path).
   *  Every top-level binding name is REGISTERED as an FQN symbol —
   *  identity = FQN, interned in src/symbols.ts. Exporting is a separate
   *  act (the D42 partition), performed by the module loader. */
  moduleFqn?: string,
): { value: Value | null; evalCtx: StructureValue; compilationReport?: CompilationReport; registry: DependencyRegistry } {
  // New pass: Allegro-minted channel registrations from prior passes are
  // sealed (see MetaFieldEntry.epoch in slots.ts).
  bumpMetaEpoch();
  // Normalize line endings — the parser expects \n only
  const normalized = source.replace(/\r\n/g, "\n");

  // Gather any grammar fragments from the extensions. Two sources:
  //   - `ext.grammarFragment` — set by Phase 1 register_* primitives.
  //   - Grammar values bound in ext.bindings — set by Phase 6 `grammar { … }`
  //     blocks inside a `use`d module.
  // grammar2 handles both the unextended base and fragment-augmented cases
  // uniformly through `getGrammarWithFragments`.
  const g2Fragments: GrammarFragment[] = [];
  for (const ext of extensions ?? []) {
    if (ext.grammarFragment) g2Fragments.push(ext.grammarFragment);
    if (ext.bindings) {
      for (const key of Object.keys(ext.bindings)) {
        const data = asGrammarValue(ext.bindings[key]);
        if (data) g2Fragments.push(data.fragment);
      }
    }
  }

  // Parser selection:
  //   - Earley fallback (grammarExtension): for standalone DSL grammars
  //   - grammar2: for everything else, with runtime fragments merged in
  let fileCtx: any;
  if (grammarExtension) {
    const result = parseExtended(normalized, grammarExtension);
    if (result.errors.length > 0) throw new Error(`Parse error: ${result.errors[0].message}`);
    fileCtx = (result.tree as any).ctx;
  } else {
    const grammar = g2Fragments.length > 0
      ? getGrammarWithFragments(g2Fragments)
      : getBaseGrammar();
    // Run the static analyzer. Base grammar is known-clean; fragments can
    // introduce errors (e.g., a user registers an operator that references
    // an undeclared reserved set). `assertGrammarClean` throws on errors
    // with the full report in the message.
    assertGrammarClean(grammar);
    const result = grammar2Parse(grammar, normalized);
    if (!result.ok) {
      throw new Error(`Parse error at position ${result.error.position}: ${result.error.message}`);
    }
    fileCtx = buildProgram(result.tree);
  }

  if (!fileCtx) {
    return { value: null, evalCtx: base ?? makeStructure(), registry: createRegistry() };
  }

  // Type literals if standard type system is active
  if (typed) {
    for (const b of fileCtx.bindingList) {
      if (b.value !== undefined) {
        b.value = typeLiterals(b.value);
      }
    }
  }

  // Resolve all symbols (named Params) using lexical scoping
  resolveSymbols(fileCtx, base, extensions, typed);

  // Mark tail-position calls in function bodies for TCO
  markTailCallsInContext(fileCtx);

  // B-018 T-R6: the divergence analysis runs BEFORE precompile.
  // Precompile is where speculative inlining happens, so the cutoff has
  // to be installed first — measured: 124k inline expansions of a single
  // undischarged binding completed before the analysis block was even
  // reached. The analysis itself is pure static AST work (it does not
  // consume precompile's output), and the STAMPING half stays below,
  // after precompile has written its inferred sets.
  let divR: DivergenceResult | undefined;
  let exhTypeLookup: ((name: string) => Value | undefined) | undefined;
  setInlineCutoff(null);
  if (typed) {
    // Phase E Stages 1-2 — totality analyzers. The exhaustiveness check
    // (Stage 1) and structural-termination check (Stage 2) both need to
    // resolve Symbol-typed param annotations (`b: Bool`, `n: NonNeg`) to
    // their underlying type Context (the one carrying `abstractDomain`
    // for refinement domains). We build a small compile-mode ctx mirroring
    // `precompileFunctions` so we can `evaluate` user-defined type bindings
    // (`NonNeg = Int & _ >= 0`) on demand, in addition to looking up
    // extension-provided types (Int, Bool, …).
    const totalityCompileCtx = makeStructure();
    for (const [name, prim] of Object.entries(primitives)) {
      const binding = { key: name, value: prim as Value };
      totalityCompileCtx.bindings.set(name, binding);
      totalityCompileCtx.bindingList.push(binding);
    }
    if (extensions) {
      for (const ext of extensions) {
        for (const [name, value] of Object.entries(ext.bindings)) {
          const binding = { key: name, value };
          totalityCompileCtx.bindings.set(name, binding);
          totalityCompileCtx.bindingList.push(binding);
        }
      }
    }
    for (const b of fileCtx.bindingList) {
      if (b.key !== null && b.value !== undefined) {
        totalityCompileCtx.bindings.set(b.key, { key: b.key, value: b.value });
      }
    }
    // B-028 F1 (delivers B-087): memoize the type lookup. The analyzers
    // call this per case-pattern and per decrease-position per call
    // site, and each un-memoized hit re-EVALUATED the type expression
    // (a refinement like `Int & _ >= 0` re-minted a fresh refined type
    // every time) — the profiled ~200s suite hotspot. Sound to cache:
    // totalityCompileCtx is fully populated before the first lookup and
    // never mutated during analysis.
    const exhTypeCache = new Map<string, Value | undefined>();
    exhTypeLookup = (name: string): Value | undefined => {
      if (exhTypeCache.has(name)) return exhTypeCache.get(name);
      const binding = totalityCompileCtx.bindings.get(name);
      let out: Value | undefined;
      if (!binding?.value) {
        out = undefined;
      } else {
        try {
          out = evaluate(binding.value, totalityCompileCtx, 0);
        } catch {
          out = binding.value;
        }
      }
      exhTypeCache.set(name, out);
      return out;
    };
    // Phase E Stage 2 + B-028 F3 — the termination analysis IS the div
    // inference (CE-R1). One pass computes the Stage-2 findings, the D34
    // discharge tier per binding, and the div closure over the call
    // graph; leaf callees (module imports, extension bindings) answer
    // through their own effect sets — the cross-module seam. Runs here,
    // ahead of precompile, so the T-R6 cutoff below is in force while
    // precompile speculates; the reporting/stamping half is below.
    const leafDivResolver = (name: string): boolean => {
      const v = totalityCompileCtx.bindings.get(name)?.value;
      if (!v) return false;
      const eff = effectsOf(v);
      return eff !== null && eff.has("div");
    };
    divR = analyzeDivergence(fileCtx.bindingList, exhTypeLookup, leafDivResolver);
    // B-018 T-R6 (broadened 2026-08, maintainer-ratified): the cutoff
    // covers EVERY recursive binding, not only the undischarged ones.
    // Termination discharge turned out to be the wrong predicate: a
    // recursive call with unresolved arguments cannot converge no matter
    // how well it is proven to terminate, because the base case is
    // undecidable without a concrete argument. PE unfolded such calls to
    // MAX_DEPTH, blew the JS stack, and DISCARDED the result as a
    // `precompile-type-error` — so a provably-total `factorial(n:
    // NonNeg)` cost 71.1s to compile and produced a spurious error,
    // while the same function over bare `Int` (undischarged, hence cut)
    // took 0.1s. Proving termination must not be punished.
    const cutoffCfns = new Set<Value>();
    for (const name of divR.recursiveBindings) {
      const cfn = divR.stampTargets.get(name);
      if (cfn) cutoffCfns.add(cfn as unknown as Value);
    }
    if (cutoffCfns.size > 0) {
      setInlineCutoff((fnValue: Value) => cutoffCfns.has(dataOf(fnValue)));
    }
  }
  // Pre-compile typed functions: infer return types and detect type errors
  const compilationReport = precompileFunctions(fileCtx, extensions, typed);

  // Phase D1: check effect declarations against inferred sets. Mismatches
  // (declared ⊉ inferred, ignoring "opaque" which is a Slice-1 placeholder
  // from stdlib HOF calls) are recorded as errors and halt compilation.
  // Opaque-only inferences become informational notifications (sub-chunk
  // 1.3) so callers using `effects pure` over Array.map don't fail
  // spuriously while soundness is being completed in Slice 2.
  if (typed) {
    for (const f of checkExhaustiveness(fileCtx.bindingList, exhTypeLookup!)) {
      compilationReport.notifications.push({
        kind:            "totality-exhaustiveness",
        severity:        "info",
        binding:         f.binding,
        message:         f.message,
        counterexample:  f.counterexample,
      });
    }
    for (const f of divR!.findings) {
      compilationReport.notifications.push({
        kind:            "totality-nontermination",
        severity:        "info",
        binding:         f.binding,
        message:         f.message,
        counterexample:  f.counterexample,
      });
    }
    // The long-reserved needs-annotation kind, finally emitted: a clean
    // function that INHERITS div through its calls.
    for (const n of divR!.propagationNotices) {
      compilationReport.notifications.push({
        kind:     NOTIF_TOTALITY_NEEDS_ANNOTATION,
        severity: "info",
        binding:  n.binding,
        message:  n.message,
      });
    }
    // Stamp: div joins each carrier's INFERRED effect set — before the
    // declaration check below, so the existing inferred-⊆-declared
    // machinery (and its halt) carries div with no new enforcement path.
    for (const [name] of divR!.divBindings) {
      const cfn = divR!.stampTargets.get(name);
      if (!cfn) continue;
      const prior = (cfn as any).inferredEffects as Set<string> | undefined;
      const next = new Set(prior ?? []);
      next.add("div");
      (cfn as any).inferredEffects = next;
    }
    // CE-R3: `total` is the per-function STRICT opt-in — an undischarged
    // (own or inherited) div on a `total`-declared function is an error.
    const totalViolations: string[] = [];
    for (const [name, cfn] of divR!.stampTargets) {
      if ((cfn as any).total !== true) continue;
      const why = divR!.divBindings.get(name);
      if (!why) continue;
      const reason = why.own
        ? (divR!.obligations.find((o: DivObligation) => o.binding === name)?.detail ?? "termination unproven")
        : `calls \`${why.via}\`, which may not terminate`;
      const message = `\`${name}\` is declared \`total\` but div is undischarged: ${reason}`;
      compilationReport.notifications.push({
        kind: "totality-total-violation", severity: "error", binding: name, message,
      });
      totalViolations.push("  " + message);
    }
    if (totalViolations.length > 0 && !softFail) {
      throw new Error("totality check failed:\n" + totalViolations.join("\n"));
    }
    // CE-R2: the per-binding discharge record rides the report — the
    // Verdict ledger and the obligations surface consume it.
    compilationReport.divObligations = divR!.obligations;
    // CE-R7: the mechanical purity gates (eq / coercion — E-R5) consult
    // divergence by function identity during the evaluation below.
    const divCfns = new Set<Value>();
    for (const [name] of divR!.divBindings) {
      const cfn = divR!.stampTargets.get(name);
      if (cfn) divCfns.add(cfn as unknown as Value);
    }
    setDivergenceProbe((fnValue: Value) => divCfns.has(dataOf(fnValue)));

    // Phase D1: check effect declarations against inferred sets — now
    // INCLUDING div (CE-R1: a declaration is a contract; `effects pure`
    // on a possibly-diverging function halts). Mismatches (declared ⊉
    // inferred, ignoring "opaque") are errors and halt compilation.
    const fxMismatches = checkEffectsDeclarations(fileCtx.bindingList);
    if (fxMismatches.length > 0) {
      for (const m of fxMismatches) {
        compilationReport.notifications.push({
          kind:     "effects-mismatch",
          severity: "error",
          binding:  m.binding,
          message:  formatMismatch(m),
        });
      }
      const lines = fxMismatches.map(m => "  " + formatMismatch(m));
      if (!softFail) {
        throw new Error("effects declaration check failed:\n" + lines.join("\n"));
      }
    }
    for (const n of opaqueEffectNotices(fileCtx.bindingList)) {
      compilationReport.notifications.push({
        kind:     "effects-opaque-from-stdlib-hof",
        severity: "info",
        binding:  n.binding,
        message:  n.message,
      });
    }
  }

  const evalCtx = buildEvalCtx(fileCtx, base, extensions, typed);
  const registry = createRegistry();

  // Link FutureManager to registry and evalCtx (for async primitives)
  if (futureManager) {
    futureManager.registry = registry;
    futureManager.evalCtx = evalCtx;
    (evalCtx as any).futureManager = futureManager;
  }

  // Helper: collect Symbol names from a value tree (for dependency tracking
  // of futures returned from primitives that bypass DepCollector)
  function collectSymbolRefs(v: Value, refs: Set<string>, seen?: Set<Value>): void {
    if (!seen) seen = new Set();
    if (!v || typeof v !== "object" || seen.has(v)) return;
    seen.add(v);
    if (v.kind === ValueKind.Symbol) refs.add(v.name);
    if (v.kind === ValueKind.Expression) {
      collectSymbolRefs(v.fn, refs, seen);
      for (const a of v.args) collectSymbolRefs(a, refs, seen);
    }
    if (v.kind === ValueKind.Structure) {
      // B-028 F1: a pending future inside a DATA structure's field is a
      // dependency of the binding holding it (a residualized guarded
      // construction carries the instance with the pending slot inside —
      // D12: incompleteness is a value in a slot). Scopes are not data;
      // never walk their bindings.
      const ctx = v as StructureValue;
      if (!ctx.isScope) {
        for (const b of ctx.bindings.values()) {
          if (b.value !== undefined) collectSymbolRefs(b.value, refs, seen);
        }
      }
    }
    if (v.kind === ValueKind.ComposedFunction) collectSymbolRefs(v.body, refs, seen);
  }

  // Evaluate all bindings (named and bare) in order with dependency tracking.
  let lastValue: Value | null = null;
  const completedInThisPass = new Set<string>();
  let bareCounter = 0;
  // Phase F1: failed proofs collected during evaluation. `theorem`/`verify`
  // evaluate to a Proof value; a non-discharged one is a finding.
  const proofFindings: ProofFinding[] = [];

  for (const b of fileCtx.bindingList) {
    if (b.value === undefined) {
      // Declared-but-unresolved source binding. If buildEvalCtx installed a
      // pending cell for it (no provider on the chain), track the cell in
      // the registry so it lives on the ONE unresolved representation
      // applyPhase completes.
      if (b.key !== null) {
        const cell = evalCtx.bindings.get(b.key);
        if (cell && cell.value === undefined) registry.bindings.set(b.key, cell);
      }
      continue;
    }

    const collector: DepCollector = { incompleteRefs: new Set() };
    const val = evaluate(b.value, evalCtx, 0, collector);

    // Phase F1: surface failed proofs (both anonymous `verify` and named
    // `theorem` bindings evaluate to a Proof value).
    if (isFailedProof(val)) {
      proofFindings.push(describeFailedProof(val, b.key));
    }

    if (b.key === null) {
      // Bare expression
      lastValue = val;
      // Track Symbol dependencies from async futures (Symbols in the result
      // that weren't seen by DepCollector because they were returned by primitives)
      if (!isResolved(val)) collectSymbolRefs(val, collector.incompleteRefs);
      // Track bare expressions with pending futures so forward-chaining
      // can re-evaluate them (e.g., deferred print calls). One cell,
      // shared by the eval scope and the registry.
      if (!isResolved(val) && collector.incompleteRefs.size > 0) {
        const bareKey = `__bare_${bareCounter++}`;
        const cell: Binding = {
          key: bareKey,
          value: val,
          incompleteDeps: collector.incompleteRefs,
          isComplete: false,
        };
        registry.bindings.set(bareKey, cell);
        registerDeps(registry, bareKey, collector.incompleteRefs);
        evalCtx.bindings.set(bareKey, cell);
        evalCtx.bindingList.push(cell);
      }
    } else {
      // Auto-name types immediately (types may be bare Contexts or MultiValue-wrapped)
      const typeCtx = dataOf(val).kind === ValueKind.Structure ? dataOf(val) as StructureValue : null;
      if (typeCtx && hasShapeSlot(typeCtx)) {
        const nameV = getName(typeCtx);
        if (nameV?.kind === ValueKind.Bits) {
          const currentName = bitsToString(nameV as BitsValue);
          if (currentName.startsWith("<")) {
            renameInPlace(typeCtx, stringToBits(b.key));
          }
          // C6.1a: stabilize the type's LOCAL member symbols onto the
          // declaration-site scope (module FQN + binding name) — the
          // fixpoint may re-evaluate this declaration, and both
          // constructions must yield the SAME member symbols for
          // conformance to hold across passes.
          stabilizeTypeMemberScope(typeCtx,
            typeMemberScopeFqn(`${moduleFqn ?? MAIN_SCOPE_FQN}${FQN_SEP}${b.key}`));
        }
      }

      // Record inferred type in compilation report
      if (compilationReport) {
        const typeName = getTypeName(val);
        if (typeName) {
          compilationReport.bindingTypes.set(b.key, typeName);
        }
      }

      // Track Symbol dependencies from async futures in the result tree
      if (!isResolved(val)) collectSymbolRefs(val, collector.incompleteRefs);

      // Store the evaluated value on the scope's binding and track that
      // SAME object in the reactive registry — the binding is its cell.
      const complete = isResolved(val);
      // D47 (B-094 chunk 1): binding-level source attachment — a resolved
      // top-level binding's value carries its RHS AST on the `source`
      // channel (kernel origination). Chunk-1 scope: non-Structure data
      // only — Structures (types, records, proofs) carry channels directly
      // and are identity-sensitive (memoized generics, law registries);
      // their attachment is the chunk-2+ audit. Residuals are skipped:
      // forward chaining REPLACES them on completion, dropping anything
      // attached here.
      const storedVal = (complete && !isMetaSlotKey(b.key)
          && dataOf(val).kind !== ValueKind.Structure)
        ? withSource(val, b.value)
        : val;
      let ctxBinding = evalCtx.bindings.get(b.key);
      if (!ctxBinding) {
        ctxBinding = { key: b.key, value: storedVal };
        evalCtx.bindings.set(b.key, ctxBinding);
        evalCtx.bindingList.push(ctxBinding);
      }
      resolveCell(ctxBinding, storedVal, complete, collector.incompleteRefs);
      registry.bindings.set(b.key, ctxBinding);

      if (complete) {
        completedInThisPass.add(b.key);
      } else if (collector.incompleteRefs.size > 0) {
        registerDeps(registry, b.key, collector.incompleteRefs);
      }
    }
  }

  // Forward-chain: propagate completions to re-evaluate dependent residuals
  if (completedInThisPass.size > 0) {
    propagateCompletions(registry, evalCtx, completedInThisPass);
  }

  // Phase F1: a failed proof is unsound by construction. Surface every
  // finding as an error-severity notification and halt — same "build
  // safety in" treatment as a failed effects declaration.
  if (proofFindings.length > 0 && compilationReport) {
    for (const f of proofFindings) {
      compilationReport.notifications.push({
        kind:           "proof-failure",
        severity:       "error",
        binding:        f.binding ?? undefined,
        message:        formatProofFinding(f),
        counterexample: f.counterexample,
      });
    }
    if (!softFail) {
      throw new Error(
        "proof check failed:\n" +
        proofFindings.map(f => "  " + formatProofFinding(f)).join("\n"),
      );
    }
  }

  // Phase F7: `proven` clauses on functions. Sample each annotated
  // function's typed param(s) and verify the predicate holds. Same
  // halt-on-error treatment as F1 proof failures; "skipped" cases
  // (multi-param, non-sampleable types) surface as info notifications.
  if (compilationReport) {
    const provenResults = checkProvenClauses(evalCtx);
    for (const f of provenResults.infos) {
      compilationReport.notifications.push({
        kind:     "proven-skipped",
        severity: "info",
        binding:  f.binding,
        message:  formatProvenFinding(f),
      });
    }
    if (provenResults.errors.length > 0) {
      for (const f of provenResults.errors) {
        compilationReport.notifications.push({
          kind:           "proven-failed",
          severity:       "error",
          binding:        f.binding,
          message:        formatProvenFinding(f),
          counterexample: f.counterexample,
        });
      }
      if (!softFail) {
        throw new Error(
        "proven clause failed:\n" +
        provenResults.errors.map(f => "  " + formatProvenFinding(f)
          + (f.counterexample ? `\n    counterexample: ${f.counterexample}` : "")
        ).join("\n"),
        );
      }
    }
  }

  // C5.1: register this source's top-level binding names as FQN symbols
  // under the defining scope (module file path, or `<main>`). Registration
  // is idempotent (interned — same FQN is the same object across re-eval
  // and reload); synthetic bare/future markers are not names.
  {
    const scopeFqn = moduleFqn ?? MAIN_SCOPE_FQN;
    for (const key of evalCtx.bindings.keys()) {
      if (isBareBindingName(key) || isFutureBindingName(key)) continue;
      registerScopeSymbol(scopeFqn, key);
    }
  }

  return { value: lastValue, evalCtx, compilationReport, registry };
}
