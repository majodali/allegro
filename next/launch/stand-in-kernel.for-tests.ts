// A stand-in kernel, for the launcher's tests only (B-196 (the rebuild's
// acceptance side), chunk Q7 (the minimal launcher), part 1). It is not
// the kernel and not a design for one: the kernel is the kernel stream's,
// under next/kernel/. The terminal entry next/launch/terminal.ts never
// loads this file; a test in next/launch/launcher.test.ts holds that.
//
// It implements just enough of `Kernel` (next/kernel/interface.ts) for
// the launcher's tests, by substitution:
//   - constructing the seven kinds, except kernel primitives;
//   - `scope`, a handle that holds nothing;
//   - `evaluate`: an application of a composed function substitutes its
//     arguments for its parameters in the body; an application of a
//     primitive function calls its `run`; a structure's entries are
//     evaluated in entry order; each application is one step;
//   - an application with an unfilled cell among its evaluated
//     arguments, and a cell an evaluation returns, are residuals that
//     wait on the cell;
//   - `cell`, `fill`, `filled`, `waiting`, `advance` (each waiting
//     residual whose cells are all filled is evaluated again), `current`;
//   - the reading calls the launcher and its tests use.
// It records no claim and never refutes. Every other call throws a "not
// in the stand-in" error.

import type {
  Advance, Cell, Entry, Kernel, Kind, Limits, PrimitiveContext, PrimitiveDeclaration, Result, Scope, Value,
} from "../kernel/interface.js";
import { INTERFACE_VERSION } from "../kernel/interface.js";

type Node =
  | { kind: "bits"; bytes: Uint8Array; bitLength: number }
  | { kind: "symbol"; fqn: string }
  | { kind: "param"; name: string }
  | { kind: "structure"; entries: readonly Entry[] }
  | { kind: "expression"; fn: Value; args: readonly Value[] }
  | { kind: "composed-function"; params: readonly Value[]; body: Value }
  | { kind: "primitive-function"; declaration: PrimitiveDeclaration }
  | { kind: "cell"; value: Value | undefined };

const node = (v: Value): Node => v as unknown as Node;
const value = (n: Node): Value => n as unknown as Value;

function notInStandIn(name: string): never {
  throw new Error(`${name} is not in the stand-in kernel`);
}

class Limit extends Error {}

/** Makes a stand-in kernel. For tests only. */
export function createStandInKernel(): Kernel {
  const symbols = new Map<string, Value>();
  const waiters: { residual: Value; current: Value }[] = [];
  let spent = 0;
  let limit = Infinity;

  const k = {
    bits: (bytes: Uint8Array, bitLength?: number) => value({ kind: "bits", bytes, bitLength: bitLength ?? bytes.length * 8 }),
    symbol: (fqn: string) => {
      if (!symbols.has(fqn)) symbols.set(fqn, value({ kind: "symbol", fqn }));
      return symbols.get(fqn)!;
    },
    structure: (entries: readonly Entry[]) => value({ kind: "structure", entries }),
    cell: () => value({ kind: "cell", value: undefined }) as Cell,
  };
  const kindOf = (v: Value): Kind => {
    const n = node(v);
    return n.kind === "cell" ? (n.value === undefined ? "expression" : kindOf(n.value)) : n.kind;
  };
  const resolve = (v: Value): Value => {
    const n = node(v);
    return n.kind === "cell" && n.value !== undefined ? resolve(n.value) : v;
  };
  const unfilled = (v: Value): boolean => {
    const n = node(v);
    return n.kind === "cell" && n.value === undefined;
  };
  const context: PrimitiveContext = {
    ...k,
    kind: kindOf,
    bitsOf: (v) => {
      const n = node(resolve(v));
      if (n.kind !== "bits") throw new Error("bitsOf: not bits");
      return { bytes: n.bytes, bitLength: n.bitLength };
    },
    symbolName: (v) => {
      const n = node(resolve(v));
      if (n.kind !== "symbol") throw new Error("symbolName: not a symbol");
      return n.fqn;
    },
    entriesOf: (v) => {
      const n = node(resolve(v));
      if (n.kind !== "structure") throw new Error("entriesOf: not a structure");
      return n.entries;
    },
  };

  const substitute = (v: Value, env: Map<Value, Value>): Value => {
    const n = node(v);
    switch (n.kind) {
      case "param":
        return env.get(v) ?? v;
      case "expression":
        return value({ kind: "expression", fn: substitute(n.fn, env), args: n.args.map((a) => substitute(a, env)) });
      case "structure":
        return value({ kind: "structure", entries: n.entries.map(([key, e]) => [key, substitute(e, env)] as const) });
      default:
        return v;
    }
  };
  const evaluate = (v: Value): Value => {
    const n = node(resolve(v));
    if (n.kind === "structure") return value({ kind: "structure", entries: n.entries.map(([key, e]) => [key, evaluate(e)] as const) });
    if (n.kind !== "expression") return resolve(v);
    if (spent >= limit) throw new Limit();
    spent++;
    const fn = node(evaluate(n.fn));
    const args = n.args.map(evaluate);
    if (args.some(unfilled)) return value({ kind: "expression", fn: value(fn), args });
    if (fn.kind === "composed-function") {
      if (fn.params.length !== args.length) throw new Error("arity mismatch");
      return evaluate(substitute(fn.body, new Map(fn.params.map((p, i) => [p, args[i]] as const))));
    }
    if (fn.kind === "primitive-function") return fn.declaration.run(args, context);
    return notInStandIn(`applying a ${fn.kind}`);
  };
  /** The cells in a value; the unfilled ones only, unless `all`. */
  const cellsIn = (v: Value, out: Cell[], all = false): Cell[] => {
    const n = node(v);
    if (n.kind === "cell") {
      if (n.value === undefined || all) out.push(v as Cell);
      if (n.value !== undefined) cellsIn(n.value, out, all);
    } else if (n.kind === "expression") {
      cellsIn(n.fn, out, all);
      n.args.forEach((a) => cellsIn(a, out, all));
    } else if (n.kind === "structure") n.entries.forEach(([, e]) => cellsIn(e, out, all));
    return out;
  };
  const run = <T>(limits: Limits | undefined, body: () => T): { value: T | undefined; ended: "complete" | "limit"; steps: number } => {
    spent = 0;
    limit = limits?.steps ?? Infinity;
    try {
      return { value: body(), ended: "complete", steps: spent };
    } catch (e) {
      if (e instanceof Limit) return { value: undefined, ended: "limit", steps: spent };
      throw e;
    }
  };

  const kernel: Kernel = {
    interfaceVersion: INTERFACE_VERSION,
    variant: "stand-in-for-tests",
    ...k,
    param: (name) => value({ kind: "param", name }),
    expression: (fn, args) => value({ kind: "expression", fn, args }),
    composedFunction: (params, body) => value({ kind: "composed-function", params, body }),
    primitiveFunction: (declaration) => value({ kind: "primitive-function", declaration }),
    kernelPrimitive: (name) => notInStandIn(`the kernel primitive ${name}`),
    kernelPrimitiveNames: () => [],
    scope: () => ({}) as Scope,
    bind: () => notInStandIn("bind"),
    fill: (cell, v) => {
      const n = node(cell);
      if (n.kind !== "cell" || n.value !== undefined) throw new Error("fill: not an unfilled cell");
      n.value = v;
    },
    filled: (cell) => !unfilled(cell),
    waiting: () => [...new Set(waiters.flatMap((w) => cellsIn(w.current, [])))],
    evaluate: (expression, _scope, limits): Result => {
      const r = run(limits, () => evaluate(expression));
      const v = r.value ?? expression;
      if (cellsIn(v, []).length > 0) waiters.push({ residual: v, current: v });
      return { value: v, ended: r.ended, steps: r.steps, refuted: false };
    },
    advance: (limits): Advance => {
      const r = run(limits, () => {
        // A waiter is ready when it holds cells and all of them are filled.
        for (const w of waiters)
          if (cellsIn(w.current, [], true).length > 0 && cellsIn(w.current, []).length === 0) w.current = evaluate(w.current);
      });
      return { ended: r.ended, steps: r.steps, refuted: [] };
    },
    current: (v) => waiters.find((w) => w.residual === v)?.current ?? resolve(v),
    kind: kindOf,
    bitsOf: context.bitsOf,
    symbolName: context.symbolName,
    paramName: (v) => {
      const n = node(v);
      if (n.kind !== "param") throw new Error("paramName: not a param");
      return n.name;
    },
    entriesOf: context.entriesOf,
    expressionOf: (v) => {
      const n = node(v);
      if (n.kind !== "expression") throw new Error("expressionOf: not an expression");
      return { fn: n.fn, args: n.args };
    },
    composedFunctionOf: (v) => {
      const n = node(v);
      if (n.kind !== "composed-function") throw new Error("composedFunctionOf: not a composed function");
      return { params: n.params, body: n.body };
    },
    primitiveFunctionOf: (v) => {
      const n = node(v);
      if (n.kind !== "primitive-function") throw new Error("primitiveFunctionOf: not a primitive function");
      const { run: _run, ...rest } = n.declaration;
      return rest;
    },
    fieldsOf: () => notInStandIn("fieldsOf"),
    field: () => notInStandIn("field"),
    outcomeOf: () => notInStandIn("outcomeOf"),
    originOf: () => notInStandIn("originOf"),
  };
  return kernel;
}
