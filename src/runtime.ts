// =============================================================================
// Allegretto - Runtime
// Bridges the parser's output to the evaluator.
// =============================================================================

import { parseExtended, GrammarExtension } from "./grammar-ext.js";
import { markTailCalls, precompileFunction, remapParams } from "./evaluator.js";
import { parse as grammar2Parse } from "./grammar2/engine.js";
import { getBaseGrammar } from "./grammar2/base-grammar.js";
import { buildProgram } from "./grammar2/tree-builder.js";
import { getGrammarWithFragments } from "./grammar2/fragments.js";
import { analyze as analyzeGrammar, assertClean as assertGrammarClean } from "./grammar2/analyzer.js";
import { primitives, asGrammarValue } from "./primitives.js";
import { evaluate } from "./evaluator.js";
import { Value, ValueKind, ContextValue, Binding, BitsValue, PrimitiveFunctionValue, ExpressionValue, ComposedFunctionValue, ParamValue, makeContext, makeExpr, makePrimitive, makeMultiValue, bitsToString, stringToBits, Extension, DepCollector, isResolved, primaryOf, GrammarFragment } from "./types.js";
import { checkEffectsDeclarations, formatMismatch, opaqueEffectNotices } from "./effects.js";
import { checkExhaustiveness, checkTermination } from "./totality.js";
import { isFailedProof, describeFailedProof, formatProofFinding, ProofFinding } from "./proofs.js";
import { checkProvenClauses, formatProvenFinding } from "./proven.js";
import { withType, IntType, StringType, wrapAsUntypedFunction, getType, getTypeName, getFunctionParamTypes, getFunctionReturnType } from "./types-std.js";

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
      const newFn: ComposedFunctionValue = { kind: ValueKind.ComposedFunction, params: v.params, body: newBody };
      for (const p of newFn.params) p.owner = newFn;
      // Preserve generic-param / effect-var-param metadata across clones so
      // Slice 2's polymorphism resolution still works after this pass.
      if ((v as any).__genericParams) (newFn as any).__genericParams = (v as any).__genericParams;
      if ((v as any).__effectVarParams) (newFn as any).__effectVarParams = (v as any).__effectVarParams;
      return newFn;
    }
    case ValueKind.MultiValue: {
      // If the MultiValue already carries a type component, don't recurse
      // into its primary — the value was deliberately typed (e.g. by an
      // earlier typeLiterals pass in a module) and wrapping again would
      // produce a nested MultiValue(MultiValue(Bits, T), T) that later
      // breaks `primaryOf(v) as BitsValue` extractions.
      if (v.components.has("type")) return v;
      const newPrimary = typeLiterals(v.primary, seen);
      if (newPrimary === v.primary) return v;
      return makeMultiValue(newPrimary, new Map(v.components));
    }
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

  if (v.kind === "MultiValue") {
    v.primary = resolvePrimitives(v.primary, seen);
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
  base?: ContextValue,
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

  // Layer 3: Base context (REPL persistence)
  if (base) {
    for (const [key, binding] of base.bindings) {
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
  } else if (value.kind === ValueKind.MultiValue) {
    patchNamedParams(value.primary, name, binding, seen);
  }
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
    case ValueKind.Context:
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
      const newFn: ComposedFunctionValue = {
        kind: ValueKind.ComposedFunction,
        params: newParams,
        body: remappedBody,
      };
      for (const p of newFn.params) p.owner = newFn;
      if ((fn as any).__genericParams) (newFn as any).__genericParams = (fn as any).__genericParams;
      if ((fn as any).__effectVarParams) (newFn as any).__effectVarParams = (fn as any).__effectVarParams;
      return newFn;
    }

    case ValueKind.Expression: {
      const newFn = resolveNamedParams(value.fn, resMap, selfName, seen);
      const newArgs = value.args.map(a => resolveNamedParams(a, resMap, selfName, seen));
      if (newFn === value.fn && newArgs.every((a, i) => a === value.args[i])) return value;
      return makeExpr(newFn, newArgs);
    }

    case ValueKind.MultiValue: {
      const newP = resolveNamedParams(value.primary, resMap, selfName, seen);
      if (newP === value.primary) return value;
      return makeMultiValue(newP, new Map(value.components));
    }
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
    case ValueKind.Context:
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
      const newFn: ComposedFunctionValue = {
        kind: ValueKind.ComposedFunction,
        params: newParams,
        body: remappedBody,
      };
      for (const p of newFn.params) p.owner = newFn;
      if ((fn as any).__genericParams) (newFn as any).__genericParams = (fn as any).__genericParams;
      if ((fn as any).__effectVarParams) (newFn as any).__effectVarParams = (fn as any).__effectVarParams;
      return newFn;
    }

    case ValueKind.Expression: {
      const newFn = resolveNamedParamsInner(value.fn, resMap, owner, ownParamNames, selfName, seen);
      const newArgs = value.args.map(a => resolveNamedParamsInner(a, resMap, owner, ownParamNames, selfName, seen));
      if (newFn === value.fn && newArgs.every((a, i) => a === value.args[i])) return value;
      return makeExpr(newFn, newArgs);
    }

    case ValueKind.MultiValue: {
      const newP = resolveNamedParamsInner(value.primary, resMap, owner, ownParamNames, selfName, seen);
      if (newP === value.primary) return value;
      return makeMultiValue(newP, new Map(value.components));
    }
  }
  return value;
}

/**
 * Walk all bindings and mark tail-position calls in ComposedFunction bodies.
 */
function markTailCallsInContext(fileCtx: any): void {
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
  } else if (v.kind === "MultiValue") {
    markTailCallsInValue(v.primary, seen);
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

  // Build a minimal context for pre-compilation (primitives + extensions)
  const compileCtx = makeContext();
  for (const [name, prim] of Object.entries(primitives)) {
    const binding = { key: name, value: prim as Value, isUse: false };
    compileCtx.bindings.set(name, binding);
    compileCtx.bindingList.push(binding);
  }
  if (extensions) {
    for (const ext of extensions) {
      for (const [name, value] of Object.entries(ext.bindings)) {
        const binding = { key: name, value, isUse: false };
        compileCtx.bindings.set(name, binding);
        compileCtx.bindingList.push(binding);
      }
      if (ext.moduleObject) {
        const binding = { key: ext.name, value: ext.moduleObject, isUse: false };
        compileCtx.bindings.set(ext.name, binding);
        compileCtx.bindingList.push(binding);
      }
    }
  }
  // Add source bindings to compile context
  for (const b of fileCtx.bindingList) {
    if (b.key !== null && b.value !== undefined) {
      compileCtx.bindings.set(b.key, { key: b.key, value: b.value, isUse: false });
      compileCtx.bindingList.push({ key: b.key, value: b.value, isUse: false });
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
    if (val.kind === ValueKind.MultiValue) {
      fnType = getType(val);
      if (!fnType) continue;
      const typeName = getTypeName(val);
      const isTyped = typeName === "Function";
      const isUntyped = typeName === "UntypedFunction";
      if (!isTyped && !isUntyped) continue;
      if (val.primary.kind !== ValueKind.ComposedFunction) continue;
      fn = val.primary;
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
      const inferredName = inferredReturnType.kind === ValueKind.Context
        ? (inferredReturnType as ContextValue).bindings.get("__name")?.value
        : null;
      const inferredStr = inferredName && inferredName.kind === ValueKind.Bits
        ? bitsToString(inferredName as BitsValue)
        : "unknown";
      report.inferred.push({ name: b.key, returnType: inferredStr });

      // Check against explicit return type if declared (typed functions only)
      const declaredReturn = fnType ? getFunctionReturnType(fnType) : null;
      if (declaredReturn && declaredReturn.kind === ValueKind.Context) {
        const declaredName = (declaredReturn as ContextValue).bindings.get("__name")?.value;
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
 * Context layers (bottom to top, later layers shadow earlier ones):
 *   1. Primitives — base language built-ins
 *   2. Extensions — anonymous extensions from the execution context
 *   3. Base context — REPL persistence / pre-existing bindings
 *   4. Source bindings — parsed from the current source file
 */
export function buildEvalCtx(
  fileCtx: any,
  base?: ContextValue,
  extensions?: Extension[],
  typed?: boolean,
): ContextValue {
  const evalCtx = makeContext();

  function addBinding(key: string, value: Value, isUse: boolean = false): void {
    const binding = { key, value, isUse };
    const existingIdx = evalCtx.bindingList.findIndex(x => x.key === key);
    if (existingIdx >= 0) {
      evalCtx.bindingList[existingIdx] = binding;
    } else {
      evalCtx.bindingList.push(binding);
    }
    evalCtx.bindings.set(key, binding);
  }

  // Layer 1: Primitives
  // In typed/standard mode, wrap function primitives as UntypedFunction
  for (const [name, prim] of Object.entries(primitives)) {
    if (typed && (prim as any).kind === ValueKind.PrimitiveFunction) {
      addBinding(name, wrapAsUntypedFunction(prim as Value));
    } else {
      addBinding(name, prim as Value);
    }
  }

  // Layer 2: Extensions (applied in order, later extensions shadow earlier ones)
  if (extensions) {
    for (const ext of extensions) {
      for (const [name, value] of Object.entries(ext.bindings)) {
        addBinding(name, value);
      }
      // If extension has a typed module object, bind the module name to it.
      // This is what `import <name>` resolves to — the encapsulated module.
      if (ext.moduleObject) {
        addBinding(ext.name, ext.moduleObject);
      }
    }
  }

  // Layer 3: Base context (REPL persistence)
  if (base) {
    for (const [key, binding] of base.bindings) {
      // Skip primitives and extension bindings that were already added
      // Only bring forward user-defined bindings from previous REPL inputs
      addBinding(key, binding.value!, binding.isUse);
    }
  }

  // Layer 4: Source bindings (already resolved by resolveSymbols)
  for (const b of fileCtx.bindingList) {
    if (b.key !== null && b.value !== undefined) {
      addBinding(b.key, b.value);
    }
  }

  return evalCtx;
}

/**
 * Wrap an Extension's bindings as a Context value.
 * If the extension has a moduleObject (typed module), returns it as the primary.
 * Otherwise wraps bindings as a plain Context (backward compat).
 */
export function extensionToContext(ext: Extension): Value {
  if (ext.moduleObject) return ext.moduleObject;
  const ctx = makeContext();
  for (const [name, value] of Object.entries(ext.bindings)) {
    const binding: Binding = { key: name, value, isUse: false };
    ctx.bindings.set(name, binding);
    ctx.bindingList.push(binding);
  }
  return ctx;
}

// =============================================================================
// Forward-Chaining Reactive Partial Evaluation
// =============================================================================

/** A binding tracked by the reactive evaluation system. */
export interface ReactiveBinding {
  key: string;
  /** Current value — may be a residual Expression or final value */
  currentValue: Value;
  /** Names of incomplete dependencies (only meaningful when !isComplete) */
  incompleteDeps: Set<string>;
  /** True when currentValue is fully resolved */
  isComplete: boolean;
}

/** Registry of reactive bindings and their dependency relationships. */
export interface DependencyRegistry {
  /** Maps incomplete binding name → set of binding keys that depend on it */
  dependents: Map<string, Set<string>>;
  /** All reactive bindings by key */
  bindings: Map<string, ReactiveBinding>;
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
  evalCtx: ContextValue,
  completedNames: Set<string>,
): void {
  const worklist = new Set<string>();

  // Collect all bindings that depend on the newly completed names
  for (const name of completedNames) {
    const deps = registry.dependents.get(name);
    if (deps) {
      for (const depKey of deps) worklist.add(depKey);
      registry.dependents.delete(name);
    }
  }

  const newlyCompleted = new Set<string>();

  for (const key of worklist) {
    const rb = registry.bindings.get(key);
    if (!rb || rb.isComplete) continue;

    // Re-evaluate the residual in the updated context
    const collector: DepCollector = { incompleteRefs: new Set() };
    const newVal = evaluate(rb.currentValue, evalCtx, 0, collector);

    // Replace the binding's value (not mutate)
    rb.currentValue = newVal;
    rb.incompleteDeps = collector.incompleteRefs;

    const ctxBinding = evalCtx.bindings.get(key);
    if (ctxBinding) ctxBinding.value = newVal;

    const nowComplete = isResolved(newVal);
    rb.isComplete = nowComplete;

    if (nowComplete) {
      newlyCompleted.add(key);
    } else {
      // Re-register remaining dependencies
      registerDeps(registry, key, collector.incompleteRefs);
    }
  }

  // Cascade: if re-evaluation completed more bindings, propagate again
  if (newlyCompleted.size > 0) {
    propagateCompletions(registry, evalCtx, newlyCompleted);
  }
}

/**
 * Apply a new phase: add bindings and trigger re-evaluation of dependents.
 * Used for import resolution, REPL persistence, and multi-phase builds.
 */
export function applyPhase(
  registry: DependencyRegistry,
  evalCtx: ContextValue,
  newBindings: Map<string, Value>,
): void {
  const completed = new Set<string>();

  for (const [name, value] of newBindings) {
    const binding: Binding = { key: name, value, isUse: false };
    evalCtx.bindings.set(name, binding);
    // Also add to bindingList if not already present
    if (!evalCtx.bindingList.some(b => b.key === name)) {
      evalCtx.bindingList.push(binding);
    }
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
  base?: ContextValue,
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
): { value: Value | null; evalCtx: ContextValue; compilationReport?: CompilationReport; registry: DependencyRegistry } {
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
    return { value: null, evalCtx: base ?? makeContext(), registry: createRegistry() };
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

  // Pre-compile typed functions: infer return types and detect type errors
  const compilationReport = precompileFunctions(fileCtx, extensions, typed);

  // Phase D1: check effect declarations against inferred sets. Mismatches
  // (declared ⊉ inferred, ignoring "opaque" which is a Slice-1 placeholder
  // from stdlib HOF calls) are recorded as errors and halt compilation.
  // Opaque-only inferences become informational notifications (sub-chunk
  // 1.3) so callers using `effects pure` over Array.map don't fail
  // spuriously while soundness is being completed in Slice 2.
  if (typed) {
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
    // Phase E Stages 1-2 — totality analyzers. The exhaustiveness check
    // (Stage 1) and structural-termination check (Stage 2) both need to
    // resolve Symbol-typed param annotations (`b: Bool`, `n: NonNeg`) to
    // their underlying type Context (the one carrying `__abstractDomain`
    // for refinement domains). We build a small compile-mode ctx mirroring
    // `precompileFunctions` so we can `evaluate` user-defined type bindings
    // (`NonNeg = Int & _ >= 0`) on demand, in addition to looking up
    // extension-provided types (Int, Bool, …).
    const totalityCompileCtx = makeContext();
    for (const [name, prim] of Object.entries(primitives)) {
      const binding = { key: name, value: prim as Value, isUse: false };
      totalityCompileCtx.bindings.set(name, binding);
      totalityCompileCtx.bindingList.push(binding);
    }
    if (extensions) {
      for (const ext of extensions) {
        for (const [name, value] of Object.entries(ext.bindings)) {
          const binding = { key: name, value, isUse: false };
          totalityCompileCtx.bindings.set(name, binding);
          totalityCompileCtx.bindingList.push(binding);
        }
      }
    }
    for (const b of fileCtx.bindingList) {
      if (b.key !== null && b.value !== undefined) {
        totalityCompileCtx.bindings.set(b.key, { key: b.key, value: b.value, isUse: false });
      }
    }
    const exhTypeLookup = (name: string): Value | undefined => {
      const binding = totalityCompileCtx.bindings.get(name);
      if (!binding?.value) return undefined;
      try {
        return evaluate(binding.value, totalityCompileCtx, 0);
      } catch {
        return binding.value;
      }
    };
    for (const f of checkExhaustiveness(fileCtx.bindingList, exhTypeLookup)) {
      compilationReport.notifications.push({
        kind:            "totality-exhaustiveness",
        severity:        "info",
        binding:         f.binding,
        message:         f.message,
        counterexample:  f.counterexample,
      });
    }
    // Phase E Stage 2 — structural termination check. Notifications fire
    // for recursive functions whose calls aren't shown to decrease on a
    // bounded parameter. Confidence policy: only fire when at least one
    // call is suspect — non-recursive functions are silent.
    for (const f of checkTermination(fileCtx.bindingList, exhTypeLookup)) {
      compilationReport.notifications.push({
        kind:            "totality-nontermination",
        severity:        "info",
        binding:         f.binding,
        message:         f.message,
        counterexample:  f.counterexample,
      });
    }
  }

  const evalCtx = buildEvalCtx(fileCtx, base, extensions, typed);
  const registry = createRegistry();

  // Link FutureManager to registry and evalCtx (for async primitives)
  if (futureManager) {
    futureManager.registry = registry;
    futureManager.evalCtx = evalCtx;
    (evalCtx as any).__futureManager = futureManager;
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
    if (v.kind === ValueKind.MultiValue) collectSymbolRefs(v.primary, refs, seen);
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
    if (b.value === undefined) continue;

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
      // can re-evaluate them (e.g., deferred print calls)
      if (!isResolved(val) && collector.incompleteRefs.size > 0) {
        const bareKey = `__bare_${bareCounter++}`;
        registry.bindings.set(bareKey, {
          key: bareKey,
          currentValue: val,
          incompleteDeps: collector.incompleteRefs,
          isComplete: false,
        });
        registerDeps(registry, bareKey, collector.incompleteRefs);
        evalCtx.bindings.set(bareKey, { key: bareKey, value: val, isUse: false });
        evalCtx.bindingList.push({ key: bareKey, value: val, isUse: false });
      }
    } else {
      // Auto-name types immediately (types may be bare Contexts or MultiValue-wrapped)
      const typeCtx = val.kind === ValueKind.Context ? val as ContextValue
        : (val.kind === ValueKind.MultiValue && primaryOf(val).kind === ValueKind.Context)
          ? primaryOf(val) as ContextValue : null;
      if (typeCtx && typeCtx.bindings.has("__type")) {
        const nameBinding = typeCtx.bindings.get("__name");
        if (nameBinding?.value?.kind === ValueKind.Bits) {
          const currentName = bitsToString(nameBinding.value as BitsValue);
          if (currentName.startsWith("<")) {
            nameBinding.value = stringToBits(b.key);
          }
        }
      }

      // Store evaluated value in eval context
      const ctxBinding = evalCtx.bindings.get(b.key);
      if (ctxBinding) ctxBinding.value = val;

      // Record inferred type in compilation report
      if (compilationReport) {
        const typeName = getTypeName(val);
        if (typeName) {
          compilationReport.bindingTypes.set(b.key, typeName);
        }
      }

      // Track Symbol dependencies from async futures in the result tree
      if (!isResolved(val)) collectSymbolRefs(val, collector.incompleteRefs);

      // Register in reactive registry
      const complete = isResolved(val);
      registry.bindings.set(b.key, {
        key: b.key,
        currentValue: val,
        incompleteDeps: complete ? new Set() : collector.incompleteRefs,
        isComplete: complete,
      });

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

  return { value: lastValue, evalCtx, compilationReport, registry };
}
