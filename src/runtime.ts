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

  // Layer 4: Source bindings (overwrite anything below)
  for (const b of fileCtx.bindingList) {
    if (b.key !== null && b.value !== undefined) {
      const resolved = resolvePrimitives(b.value);
      addBinding(b.key, resolved);
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

  const evalCtx = buildEvalCtx(fileCtx, base, extensions, typed);

  let lastValue: Value | null = null;
  for (const b of fileCtx.bindingList) {
    if (b.key === null && b.value !== undefined) {
      const resolved = resolvePrimitives(b.value);
      lastValue = evaluate(resolved, evalCtx);
    }
  }

  return { value: lastValue, evalCtx };
}
