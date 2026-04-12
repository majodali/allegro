// =============================================================================
// Allegretto - Runtime
// Bridges the parser's output to the evaluator.
// =============================================================================

import { parseExtended, GrammarExtension } from "./grammar-ext.js";
import { markTailCalls, precompileFunction } from "./evaluator.js";
import { parseBase as hybridParseBase, parseStandard as hybridParseStandard } from "./hybrid-parser.js";
import { primitives } from "./primitives.js";
import { evaluate } from "./evaluator.js";
import { Value, ValueKind, ContextValue, Binding, BitsValue, PrimitiveFunctionValue, ExpressionValue, ComposedFunctionValue, makeContext, makeExpr, makePrimitive, makeMultiValue, bitsToString, stringToBits, Extension, DepCollector, isResolved } from "./types.js";
import { withType, IntType, StringType, wrapAsUntypedFunction, getType, getTypeName, getFunctionParamTypes, getFunctionReturnType } from "./types-std.js";

// Re-export Extension for backward compatibility
export type { Extension };

/**
 * Walk an expression tree and wrap literal Bits values with type information.
 * Int literals (64-bit) become MultiValue with Int type.
 * String literals (non-64-bit, from stringToBits) become MultiValue with String type.
 * Used when standard type system is active.
 */
function typeLiterals(v: Value, seen?: Set<Value>): Value {
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
      return newFn;
    }
    case ValueKind.MultiValue: {
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
      const newFn: ComposedFunctionValue = {
        kind: ValueKind.ComposedFunction,
        params: fn.params,
        body: newBody,
      };
      for (const p of newFn.params) p.owner = newFn;
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
      const newFn: ComposedFunctionValue = {
        kind: ValueKind.ComposedFunction,
        params: fn.params,
        body: newBody,
      };
      for (const p of newFn.params) p.owner = newFn;
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

export interface CompilationReport {
  /** Functions with inferred return types */
  inferred: { name: string; returnType: string }[];
  /** Type errors detected at compile time */
  errors: { name: string; message: string }[];
  /** Bindings still unresolved after compilation */
  unresolved: string[];
  /** Inferred types for all bindings (populated during evaluation) */
  bindingTypes: Map<string, string>;
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
  const report: CompilationReport = { inferred: [], errors: [], unresolved: [], bindingTypes: new Map() };
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
      report.errors.push({ name: b.key ?? "?", message: `precompile eval: ${e.message}` });
      continue;
    }

    // Check if this is a typed function (MultiValue with FunctionType)
    if (val.kind !== ValueKind.MultiValue) continue;

    const fnType = getType(val);
    if (!fnType) continue;
    const typeName = getTypeName(val);
    if (typeName !== "Function") continue;

    const fn = val.primary;
    if (fn.kind !== ValueKind.ComposedFunction) continue;

    const paramTypes = getFunctionParamTypes(fnType);
    if (!paramTypes) continue;

    // Pre-compile: partially evaluate body with typed placeholders
    const { inferredReturnType, errors: fnErrors } = precompileFunction(
      fn as ComposedFunctionValue,
      paramTypes,
      compileCtx,
    );

    if (fnErrors.length > 0) {
      for (const err of fnErrors) {
        report.errors.push({ name: b.key, message: err });
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

      // Check against explicit return type if declared
      const declaredReturn = getFunctionReturnType(fnType);
      if (declaredReturn && declaredReturn.kind === ValueKind.Context) {
        const declaredName = (declaredReturn as ContextValue).bindings.get("__name")?.value;
        const declaredStr = declaredName && declaredName.kind === ValueKind.Bits
          ? bitsToString(declaredName as BitsValue)
          : null;
        if (declaredStr && inferredStr !== "unknown" && declaredStr !== inferredStr && declaredStr !== "Any") {
          report.errors.push({
            name: b.key,
            message: `Return type mismatch: declared ${declaredStr}, inferred ${inferredStr}`,
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
): { value: Value | null; evalCtx: ContextValue; compilationReport?: CompilationReport; registry: DependencyRegistry } {
  // Normalize line endings — the parser expects \n only
  const normalized = source.replace(/\r\n/g, "\n");

  // Use hybrid parser by default; fall back to Earley for legacy grammar extensions
  const result = grammarExtension
    ? parseExtended(normalized, grammarExtension)
    : typed
      ? hybridParseStandard(normalized)
      : hybridParseBase(normalized);

  if (result.errors.length > 0) {
    throw new Error(`Parse error: ${result.errors[0].message}`);
  }

  const fileCtx = (result.tree as any).ctx;
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

  for (const b of fileCtx.bindingList) {
    if (b.value === undefined) continue;

    const collector: DepCollector = { incompleteRefs: new Set() };
    const val = evaluate(b.value, evalCtx, 0, collector);

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
      // Auto-name types immediately
      if (val.kind === ValueKind.Context) {
        const nameBinding = (val as ContextValue).bindings.get("__name");
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

  return { value: lastValue, evalCtx, compilationReport, registry };
}
