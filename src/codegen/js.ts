// Phase I codegen — JavaScript (ESM) backend.
//
// Lowers a resolved pre-evaluation program (see ./resolve.ts) to an ESM
// JavaScript module string. Syntax-directed: the residual expression DAG is
// the IR, and `emitValue` is a recursive walk producing a JS expression.
//
// I1 scope: Int / Float / String literals; ComposedFunctions; the
// arithmetic / comparison primitive core; `eval_if` → ternary; direct and
// higher-order calls; `print`. Anything outside this surface raises a
// `CodegenError` naming the offending construct — no silent wrong output
// ("build safety in").

import {
  Value,
  ValueKind,
  BitsValue,
  bitsToString,
  bitsToFloat,
  primaryOf,
} from "../types.js";
import { ResolvedProgram } from "./resolve.js";

export class CodegenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CodegenError";
  }
}

// --- Primitive → JS binary operator map (both Allegretto bits_* and the
//     Allegro Standard typed_* shapes lower the same way). ---

const BINOP: Record<string, string> = {
  bits_add: "+",  typed_add: "+",
  bits_sub: "-",  typed_sub: "-",
  bits_mul: "*",  typed_mul: "*",
  bits_mod: "%",  typed_mod: "%",
  bits_eq: "===", typed_eq: "===",
  bits_neq: "!==", typed_neq: "!==",
  bits_lt: "<",   typed_lt: "<",
  bits_gt: ">",   typed_gt: ">",
  bits_lte: "<=", typed_lte: "<=",
  bits_gte: ">=", typed_gte: ">=",
};

// Integer division truncates toward zero (Allegro Int semantics).
const INT_DIV = new Set(["bits_div", "typed_div"]);

// Primitives lowered to a runtime-shim call rather than an operator.
const SHIM: Record<string, string> = {
  print: "__a.print",
};

// The inlined prelude. Self-contained so emitted modules need no external
// runtime resolution (I1 decision; factored into an importable runtime at
// I5). Kept intentionally small — it grows one entry per shimmed primitive.
const PRELUDE = `// --- Allegro codegen runtime (Phase I) ---
const __a = {
  print(x) { console.log(__a.show(x)); return x; },
  show(x) {
    if (typeof x === "boolean") return x ? "true" : "false";
    return String(x);
  },
};
`;

// --- Identifier hygiene ------------------------------------------------------

function jsIdent(name: string): string {
  let s = name.replace(/[^A-Za-z0-9_$]/g, "_");
  if (/^[0-9]/.test(s)) s = "_" + s;
  return s;
}

// --- Literal lowering --------------------------------------------------------

/** Interpret a 64-bit Bits payload as a signed integer. */
function intLiteral(data: bigint): string {
  let n = data;
  if (n >= (1n << 63n)) n -= 1n << 64n; // two's-complement wrap
  return String(n);
}

/** Lower a Bits value to a JS literal, using an optional type-component name
 *  to disambiguate Float (64-bit, same width as Int) from Int. */
function bitsLiteral(b: BitsValue, typeName: string | null): string {
  if (typeName === "Float") {
    const f = bitsToFloat(b);
    return Number.isFinite(f) ? String(f) : "NaN";
  }
  if (b.length === 64 && typeName !== "String") {
    return intLiteral(b.data);
  }
  // Non-64-bit Bits in Standard mode are UTF-8 strings.
  return JSON.stringify(bitsToString(b));
}

// --- Core emitter ------------------------------------------------------------

interface Ctx {
  /** Names used in the current emission, for diagnostics. */
  bindingName?: string;
}

/** Type-component name on a MultiValue, if any. */
function typeNameOf(v: Value): string | null {
  if (v.kind !== ValueKind.MultiValue) return null;
  const t = v.components.get("type");
  if (t && primaryOf(t).kind === ValueKind.Context) {
    const ctx = primaryOf(t) as any;
    const nm = ctx.bindings?.get("__name")?.value;
    if (nm && nm.kind === ValueKind.Bits) return bitsToString(nm as BitsValue);
  }
  return null;
}

/** Emit a JS expression string for an Allegro Value. */
function emitValue(v: Value, ctx: Ctx): string {
  switch (v.kind) {
    case ValueKind.MultiValue: {
      const tn = typeNameOf(v);
      const prim = v.primary;
      if (prim.kind === ValueKind.Bits) return bitsLiteral(prim as BitsValue, tn);
      // MultiValue wrapping a non-literal (e.g. a typed function) — emit the
      // primary; the type component is compile-time only at runtime.
      return emitValue(prim, ctx);
    }

    case ValueKind.Bits:
      return bitsLiteral(v as BitsValue, null);

    case ValueKind.Param:
      return jsIdent(v._name ?? `_p${v.position}`);

    case ValueKind.Symbol:
      return jsIdent(v.name);

    case ValueKind.ComposedFunction: {
      const params = v.params.map(p => jsIdent(p._name ?? `_p${p.position}`));
      return `(${params.join(", ")}) => ${emitValue(v.body, ctx)}`;
    }

    case ValueKind.Expression:
      return emitCall(v.fn, v.args, ctx);

    case ValueKind.PrimitiveFunction:
      throw new CodegenError(
        `cannot emit a bare primitive '${v.name}' as a value` +
          (ctx.bindingName ? ` (in '${ctx.bindingName}')` : ""),
      );

    case ValueKind.Context:
      throw new CodegenError(
        `Context/Object/Array emission is not supported yet (I2)` +
          (ctx.bindingName ? ` (in '${ctx.bindingName}')` : ""),
      );
  }
}

/** Unwrap a MultiValue down to the value used as a callee. */
function callee(fn: Value): Value {
  return fn.kind === ValueKind.MultiValue ? primaryOf(fn) : fn;
}

/** A 0-param ComposedFunction used as an `eval_if` branch is inlined to its
 *  body; anything else is called as a thunk. */
function emitThunk(arg: Value, ctx: Ctx): string {
  const c = callee(arg);
  if (c.kind === ValueKind.ComposedFunction && c.params.length === 0) {
    return emitValue(c.body, ctx);
  }
  return `(${emitValue(arg, ctx)})()`;
}

function emitCall(fnVal: Value, args: Value[], ctx: Ctx): string {
  const fn = callee(fnVal);

  if (fn.kind === ValueKind.PrimitiveFunction) {
    const name = fn.name;

    if (name === "eval_if") {
      if (args.length !== 3) {
        throw new CodegenError(`eval_if expects 3 args, got ${args.length}`);
      }
      const cond = emitValue(args[0], ctx);
      const t = emitThunk(args[1], ctx);
      const e = emitThunk(args[2], ctx);
      return `(${cond} ? ${t} : ${e})`;
    }

    if (BINOP[name]) {
      if (args.length !== 2) {
        throw new CodegenError(`${name} expects 2 args, got ${args.length}`);
      }
      return `(${emitValue(args[0], ctx)} ${BINOP[name]} ${emitValue(args[1], ctx)})`;
    }

    if (INT_DIV.has(name)) {
      return `Math.trunc(${emitValue(args[0], ctx)} / ${emitValue(args[1], ctx)})`;
    }

    if (SHIM[name]) {
      return `${SHIM[name]}(${args.map(a => emitValue(a, ctx)).join(", ")})`;
    }

    throw new CodegenError(
      `unsupported primitive '${name}'` +
        (ctx.bindingName ? ` (in '${ctx.bindingName}')` : "") +
        ` — not yet lowered by the JS backend`,
    );
  }

  // Call of a Symbol (top-level fn), Param (higher-order), CFn, or nested
  // Expression result.
  const calleeStr = emitValue(fn, ctx);
  const argStr = args.map(a => emitValue(a, ctx)).join(", ");
  return `${calleeStr}(${argStr})`;
}

// --- Top-level module emission ----------------------------------------------

/** Emit a complete ESM JavaScript module for a resolved program. */
export function emitProgram(program: ResolvedProgram): string {
  const lines: string[] = [PRELUDE];

  for (const b of program.bindingList) {
    if (b.value === undefined) continue;
    const ctx: Ctx = { bindingName: b.key ?? undefined };

    if (b.key === null) {
      // Bare statement (e.g. a top-level print) — emit for side effects.
      lines.push(`${emitValue(b.value, ctx)};`);
      continue;
    }

    const name = jsIdent(b.key);
    const inner = callee(b.value);

    if (inner.kind === ValueKind.ComposedFunction) {
      // Hoisted function declaration — supports self- and mutual recursion
      // without const temporal-dead-zone issues.
      const params = inner.params.map(p => jsIdent(p._name ?? `_p${p.position}`));
      lines.push(
        `function ${name}(${params.join(", ")}) { return ${emitValue(inner.body, ctx)}; }`,
      );
    } else {
      lines.push(`const ${name} = ${emitValue(b.value, ctx)};`);
    }
  }

  return lines.join("\n") + "\n";
}
