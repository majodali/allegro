// =============================================================================
// Allegro Base Language - Runtime
// Bridges the parser's output to the evaluator.
// =============================================================================

import { parse } from "./parser.js";
import { parseExtended, GrammarExtension } from "./grammar-ext.js";
import { primitives } from "./primitives.js";
import { evaluate } from "./evaluator.js";
import { Value, ValueKind, ContextValue, Binding, BitsValue, PrimitiveFunctionValue, ExpressionValue, ComposedFunctionValue, makeContext, makeExpr, makePrimitive, makeMultiValue, Extension } from "./types.js";
import { withType, IntType, StringType, wrapAsUntypedFunction } from "./types-std.js";

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
  if (seen.has(v)) return v;
  seen.add(v);

  switch (v.kind) {
    case ValueKind.Bits:
      // 64-bit = Int literal, other lengths = String literal (from stringToBits)
      // Note: empty string "" has length 0 but is NOT 64-bit, so it falls through to String.
      if (v.length === 64) return withType(v, IntType);
      return withType(v, StringType);
    case ValueKind.Expression: {
      const newFn = typeLiterals(v.fn, seen);
      const newArgs = v.args.map(a => typeLiterals(a, seen));
      if (newFn === v.fn && newArgs.every((a, i) => a === v.args[i])) return v;
      return makeExpr(newFn, newArgs);
    }
    case ValueKind.ComposedFunction: {
      const newBody = typeLiterals(v.body, seen);
      if (newBody === v.body) return v;
      // Create new ComposedFunction with typed body but same params
      const newFn: ComposedFunctionValue = { kind: ValueKind.ComposedFunction, params: v.params, body: newBody };
      // Re-bind params to new function
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

  for (const b of fileCtx.bindingList) {
    if (b.value !== undefined) {
      for (const [name, srcBinding] of sourceBindings) {
        patchNamedParams(b.value, name, srcBinding, new Set());
      }
    }
  }
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
    if (value.fn.kind === ValueKind.Param && value.fn._name === name && value.fn.position === -1) {
      (value as any).fn = binding.value;
    } else {
      patchNamedParams(value.fn, name, binding, seen);
    }
    for (let i = 0; i < value.args.length; i++) {
      const arg = value.args[i];
      if (arg.kind === ValueKind.Param && arg._name === name && arg.position === -1) {
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
  if (seen.has(value)) return value;
  seen.add(value);

  switch (value.kind) {
    case ValueKind.Bits:
    case ValueKind.Context:
      return value;

    case ValueKind.PrimitiveFunction: {
      // Resolve primitive stubs (fn: null)
      if ((value as any).fn === null) {
        const real = primitives[value.name];
        if (real) return real;
        // Unknown primitive — leave as-is (might be resolved later)
      }
      return value;
    }

    case ValueKind.Param: {
      if (value._name && value.position === -1) {
        // Skip self-references — handled after the whole function is resolved
        if (value._name === selfName) return value;
        const resolved = resMap.get(value._name);
        if (resolved !== undefined) return resolved;
        // Unresolved — leave as named Param (might be a type variable or phase binding)
      }
      return value;
    }

    case ValueKind.ComposedFunction: {
      // Don't resolve params owned by this function — they're positional
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
  if (seen.has(value)) return value;
  seen.add(value);

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
      // Positional params owned by this function — leave alone
      if (value.owner === owner) return value;
      // Named params that shadow function params — leave alone
      if (value._name && ownParamNames.has(value._name)) return value;
      // Named params — resolve
      if (value._name && value.position === -1) {
        if (value._name === selfName) return value;
        const resolved = resMap.get(value._name);
        if (resolved !== undefined) return resolved;
      }
      return value;
    }

    case ValueKind.ComposedFunction: {
      // Inner function — create new scope with its own params
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

/**
 * Parse and evaluate Allegro source code.
 * Returns { value, evalCtx } where value is the last bare expression's result
 * and evalCtx is the final context (useful for REPL persistence).
 *
 * @param source           — Allegro source code
 * @param base             — pre-existing context (REPL persistence)
 * @param extensions       — anonymous extensions from the execution context
 * @param grammarExtension — grammar extensions (additional syntax)
 * @param typed            — if true, wrap literals with type info (Allegro Standard)
 */
export function evalSource(
  source: string,
  base?: ContextValue,
  extensions?: Extension[],
  grammarExtension?: GrammarExtension,
  typed?: boolean,
): { value: Value | null; evalCtx: ContextValue } {
  // Normalize line endings — the parser expects \n only
  const normalized = source.replace(/\r\n/g, "\n");
  const result = grammarExtension
    ? parseExtended(normalized, grammarExtension)
    : parse(normalized);

  if (result.errors.length > 0) {
    throw new Error(`Parse error: ${result.errors[0].message}`);
  }

  const fileCtx = (result.tree as any).ctx;
  if (!fileCtx) {
    return { value: null, evalCtx: base ?? makeContext() };
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

  const evalCtx = buildEvalCtx(fileCtx, base, extensions, typed);

  let lastValue: Value | null = null;
  for (const b of fileCtx.bindingList) {
    if (b.key === null && b.value !== undefined) {
      lastValue = evaluate(b.value, evalCtx);
    }
  }

  return { value: lastValue, evalCtx };
}
