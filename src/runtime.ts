// =============================================================================
// Allegro Base Language - Runtime
// Bridges the parser's output to the evaluator.
// =============================================================================

import { parse } from "./parser.js";
import { primitives } from "./primitives.js";
import { evaluate } from "./evaluator.js";
import { Value, ValueKind, ContextValue, PrimitiveFunctionValue, makeContext } from "./types.js";

/**
 * An anonymous extension: a set of named bindings injected into the
 * evaluation context by the execution environment. Extensions are layered
 * between primitives (bottom) and source bindings (top).
 *
 * Values can be any Allegro value — primitives, composed functions, bits, etc.
 * An extension whose values are not fully resolved (e.g. contain Params or
 * Expressions) supports partial evaluation: earlier build phases can
 * type-check and optimize against the extension's interface without
 * requiring the final runtime implementation.
 */
export interface Extension {
  name: string;
  bindings: Record<string, Value>;
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
  for (const [name, prim] of Object.entries(primitives)) {
    addBinding(name, prim as Value);
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
 * Parse and evaluate Allegro source code.
 * Returns { value, evalCtx } where value is the last bare expression's result
 * and evalCtx is the final context (useful for REPL persistence).
 *
 * @param source    — Allegro source code
 * @param base      — pre-existing context (REPL persistence)
 * @param extensions — anonymous extensions from the execution context
 */
export function evalSource(
  source: string,
  base?: ContextValue,
  extensions?: Extension[],
): { value: Value | null; evalCtx: ContextValue } {
  // Normalize line endings — the parser expects \n only
  const result = parse(source.replace(/\r\n/g, "\n"));

  if (result.errors.length > 0) {
    throw new Error(`Parse error: ${result.errors[0].message}`);
  }

  const fileCtx = (result.tree as any).ctx;
  if (!fileCtx) {
    return { value: null, evalCtx: base ?? makeContext() };
  }

  const evalCtx = buildEvalCtx(fileCtx, base, extensions);

  let lastValue: Value | null = null;
  for (const b of fileCtx.bindingList) {
    if (b.key === null && b.value !== undefined) {
      const resolved = resolvePrimitives(b.value);
      lastValue = evaluate(resolved, evalCtx);
    }
  }

  return { value: lastValue, evalCtx };
}
