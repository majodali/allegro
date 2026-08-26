// =============================================================================
// Shared evaluation fixtures.
//
// The helpers every area module reaches for: bare-Allegretto evaluation
// (`evalSource`/`evalStr`/`evalNum`), the Standard type-system extension
// (`typeExt`) and Standard-mode evaluation (`evalStd`), plus the math
// extension the base and legacy-grammar areas share.
//
// `typeExt` is constructed at MODULE LOAD, exactly as it was when the suite
// was one file — eagerly, once, the same way in every shard. It is
// deliberately NOT lazy: a lazily-built fixture would be built at first USE,
// which differs per shard, making fixture construction order shard-dependent.
//
// Note the asymmetry, preserved verbatim from the single-file suite:
// `evalSource` appends a newline to its input and `evalStd` does not.
// =============================================================================

import { formatValue } from "../primitives.js";
import { evalSource as runtimeEval, Extension } from "../runtime.js";
import { createTypeSystem } from "../types-std.js";
import { Value, ValueKind, BitsValue, AllegroError, makePrimitive, makeInt, makeContext, dataOf } from "../types.js";

export function evalSource(source: string): Value | null {
  return runtimeEval(source + "\n").value;
}

/** Evaluate and return the formatted string result. */
export function evalStr(source: string): string {
  const val = evalSource(source);
  if (val === null) throw new Error("No value produced");
  return formatValue(val);
}

/** Evaluate and return the numeric result (for Bits values). */
export function evalNum(source: string): number {
  const val = evalSource(source);
  if (val === null) throw new Error("No value produced");
  const p = dataOf(val);
  if (p.kind !== ValueKind.Bits) throw new Error(`Expected Bits, got ${p.kind}`);
  // Handle signed 64-bit
  if (p.length === 64 && p.data >= 2n ** 63n) return Number(p.data - 2n ** 64n);
  return Number(p.data);
}

// Build a math extension with abs, max, min
export const mathExtension: Extension = {
  name: "math",
  bindings: {
    abs: makePrimitive("abs", (args) => {
      const p = dataOf(args[0]);
      if (p.kind !== ValueKind.Bits) throw new AllegroError("abs: expected Bits");
      const v = p.length === 64 && p.data >= 2n ** 63n ? p.data - 2n ** 64n : p.data;
      return makeInt(Number(v < 0n ? -v : v));
    }),
    max: makePrimitive("max", (args) => {
      const a = dataOf(args[0]) as BitsValue;
      const b = dataOf(args[1]) as BitsValue;
      const av = a.length === 64 && a.data >= 2n ** 63n ? a.data - 2n ** 64n : a.data;
      const bv = b.length === 64 && b.data >= 2n ** 63n ? b.data - 2n ** 64n : b.data;
      return av >= bv ? a : b;
    }),
    min: makePrimitive("min", (args) => {
      const a = dataOf(args[0]) as BitsValue;
      const b = dataOf(args[1]) as BitsValue;
      const av = a.length === 64 && a.data >= 2n ** 63n ? a.data - 2n ** 64n : a.data;
      const bv = b.length === 64 && b.data >= 2n ** 63n ? b.data - 2n ** 64n : b.data;
      return av <= bv ? a : b;
    }),
  },
};

/** Evaluate with extensions and return numeric result. */
export function evalNumExt(source: string, extensions?: Extension[]): number {
  const result = runtimeEval(source + "\n", undefined, extensions);
  const val = result.value;
  if (val === null) throw new Error("No value produced");
  const p = dataOf(val);
  if (p.kind !== ValueKind.Bits) throw new Error(`Expected Bits, got ${p.kind}`);
  if (p.length === 64 && p.data >= 2n ** 63n) return Number(p.data - 2n ** 64n);
  return Number(p.data);
}

export const typeExt = createTypeSystem();

/** Evaluate source in Allegro Standard mode (uses hybrid parser) */
export function evalStd(source: string, extraExtensions?: Extension[]): Value | null {
  const exts = [typeExt, ...(extraExtensions ?? [])];
  const { value } = runtimeEval(source, undefined, exts, undefined, true);
  return value;
}

/** A Context carrying the given bindings — the "module object" shape the
 *  extension and type-system tests build by hand. */
export function makeCtxWith(bindings: Record<string, Value>): Value {
  const ctx = makeContext();
  for (const [name, value] of Object.entries(bindings)) {
    ctx.bindings.set(name, { key: name, value });
    ctx.bindingList.push({ key: name, value });
  }
  return ctx;
}
