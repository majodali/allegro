// =============================================================================
// Allegro Base Language - Runtime
// Bridges the parser's output to the evaluator.
// =============================================================================

import { parse } from "./parser.js";
import { primitives } from "./primitives.js";
import { evaluate } from "./evaluator.js";
import { Value, ValueKind, ContextValue, makeContext } from "./types.js";

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
 * Resolves stub primitives and binds all primitives into scope.
 * Optionally merges bindings from a pre-existing context (for REPL persistence).
 */
export function buildEvalCtx(fileCtx: any, base?: ContextValue): ContextValue {
  const evalCtx = makeContext();

  // Copy bindings from base context (REPL persistence)
  if (base) {
    for (const [key, binding] of base.bindings) {
      const copy = { ...binding };
      evalCtx.bindings.set(key, copy);
      evalCtx.bindingList.push(copy);
    }
  }

  // Add named bindings from parsed file (overwrite if redefined)
  for (const b of fileCtx.bindingList) {
    if (b.key !== null && b.value !== undefined) {
      const resolved = resolvePrimitives(b.value);
      const binding = { key: b.key, value: resolved, isUse: false };
      evalCtx.bindings.set(b.key, binding);
      // Replace in bindingList if already present from base, otherwise push
      const existingIdx = evalCtx.bindingList.findIndex(x => x.key === b.key);
      if (existingIdx >= 0) {
        evalCtx.bindingList[existingIdx] = binding;
      } else {
        evalCtx.bindingList.push(binding);
      }
    }
  }

  // Bind all primitives into context (if not already bound)
  for (const [name, prim] of Object.entries(primitives)) {
    if (!evalCtx.bindings.has(name)) {
      const binding = { key: name, value: prim as Value, isUse: false };
      evalCtx.bindings.set(name, binding);
      evalCtx.bindingList.push(binding);
    }
  }

  return evalCtx;
}

/**
 * Parse and evaluate Allegro source code.
 * Returns { value, evalCtx } where value is the last bare expression's result
 * and evalCtx is the final context (useful for REPL persistence).
 */
export function evalSource(
  source: string,
  base?: ContextValue,
): { value: Value | null; evalCtx: ContextValue } {
  const result = parse(source);

  if (result.errors.length > 0) {
    throw new Error(`Parse error: ${result.errors[0].message}`);
  }

  const fileCtx = (result.tree as any).ctx;
  if (!fileCtx) {
    return { value: null, evalCtx: base ?? makeContext() };
  }

  const evalCtx = buildEvalCtx(fileCtx, base);

  let lastValue: Value | null = null;
  for (const b of fileCtx.bindingList) {
    if (b.key === null && b.value !== undefined) {
      const resolved = resolvePrimitives(b.value);
      lastValue = evaluate(resolved, evalCtx);
    }
  }

  return { value: lastValue, evalCtx };
}
