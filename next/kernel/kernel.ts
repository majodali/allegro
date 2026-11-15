// The reference kernel, first part (chunk K2 of docs/plans/book-pass.md).
//
// It implements the kernel's interface (next/kernel/interface.ts) for
// what milestone 1 of the rebuild needs, and the kernel's half of
// milestone 2: values of the seven kinds, scopes and names, cells, and
// the evaluation of names, structures, calls of composed functions and
// calls of primitive functions. It is the reference: small and plain,
// with no attempt at speed.
//
// What it realises, from docs/plans/book-pass-inventory.md:
//   "The kernel is passive", "What the kernel's interface offers",
//   "No interface call writes a bare claim outcome", "Limits are step budgets",
//   "Seven representation kinds", "Expressions are values, forming a DAG",
//   "Functions are data: params plus body",
//   "A call is evaluated by evaluating the function's body",
//   "Evaluation is total over unresolved information",
//   "A missing value is a cell that is filled once",
//   "When information arrives, what waited on it is evaluated again",
//   "A refutation marks everything computed from it",
//   "A language checks the names it cares about" (the kernel's half: an
//   unbound name is a residual, never a refutation).
//
// How evaluation goes. A value of kind bits, a function and a primitive
// evaluate to themselves. A structure evaluates its entries, in order. A
// symbol is a name: it evaluates to what its scope binds it to, and to a
// residual that waits on the name where nothing binds it yet. A cell
// evaluates to what it was filled with, and to itself until then. An
// expression applies what its function evaluates to. A composed
// function is applied by putting the arguments in place of its
// parameters in the body and evaluating that. A primitive function is
// run when every argument is fully known, and the application stays a
// residual until then. A function's free names are tied to the scope in
// which the function value is first evaluated, so a function means the
// same wherever it is later called.
//
// The kernel's own primitives in this part, by name:
//   "if"     if(condition, then, else). The condition must come to one
//            of the kernel's two truth values; only the branch taken is
//            evaluated. While the condition is unknown the whole stays a
//            residual and neither branch is evaluated.
//   "claim"  claim(x). True records the outcome "decided". Anything else
//            fully known is a refutation. Unknown stays a residual.
//   "quote"  quote(x). Its argument, not evaluated: how a symbol or an
//            expression is handed on as data.
// The truth values are the bits of length one: 1 is true, 0 is false.
// The names and the list are Part II's to settle (chunk K4); these three
// are what the first milestones need.
//
// Left for later chunks, and not attempted here:
//   - metadata fields, their rules, and origins (`fieldsOf` is empty and
//     `originOf` answers undefined);
//   - evaluating a branch that may not be taken, without capabilities;
//   - recursion on unknown arguments: a call is always opened, so only
//     the step budget ends such a recursion (chunk K5);
//   - arguments taken unevaluated, beyond "quote" (chunk K4);
//   - the gate that keeps an effect from a value whose claims are
//     undecided, and the order of effects that become ready together.
//
// Three places where the interface as written does not quite fit, noted
// for its next version, which is the maintainer's to merge:
//   - it has no call that says whether a value is a cell; here an
//     unfilled cell reads as kind "expression", as a residual does;
//   - it declares `KernelFault` and `InterfaceError` without bodies, so
//     this file exports the real classes;
//   - it has no call that gives the reason for a refutation;
//     `refutationOf` below is this kernel's own addition for tests.

import type {
  Advance, Cell, CreateKernel, Entry, Kernel, Kind, Limits, Outcome, PrimitiveContext, PrimitiveDeclaration, Result, Scope, Value,
} from "./interface.js";
import { INTERFACE_VERSION } from "./interface.js";

/** One of the kernel's own invariants is broken. A fault in the kernel, never in the program. */
export class KernelFault extends Error {
  constructor(readonly invariant: string) {
    super(`kernel fault: ${invariant}`);
  }
}

/** The host misused the interface. */
export class InterfaceError extends Error {}

// ---- The representation --------------------------------------------------

class Bits {
  constructor(readonly bytes: Uint8Array, readonly bitLength: number) {}
}
class Sym {
  constructor(readonly fqn: string) {}
}
class Param {
  constructor(readonly name: string) {}
}
class Struct {
  constructor(readonly entries: ReadonlyArray<readonly [V | null, V]>) {}
}
class Expr {
  constructor(readonly fn: V, readonly args: readonly V[]) {}
}
class Fn {
  constructor(readonly params: readonly Param[], readonly body: V) {}
}
class Prim {
  constructor(readonly declaration: PrimitiveDeclaration) {}
}
class KernelPrim {
  constructor(readonly name: string, readonly arity: number) {}
}
/** A missing value, filled once. */
class CellV {
  filled = false;
  value: V | undefined;
}
/** A name tied to the scope it is looked up from. Unbound, it is a residual that waits on the name. */
class NameRef {
  constructor(readonly scope: ScopeV, readonly sym: Sym) {}
}
/** A value that is data and is not to be evaluated: a symbol or an expression handed on by "quote". */
class Quoted {
  constructor(readonly inner: V) {}
}
/** A value with the kernel's record of a claim's outcome on it. */
class Decided {
  constructor(readonly inner: V) {}
}
/** A refutation. Whatever is computed from it is it. */
class Refuted {
  constructor(readonly reason: string, readonly about: V | undefined) {}
}

type V = Bits | Sym | Param | Struct | Expr | Fn | Prim | KernelPrim | CellV | NameRef | Quoted | Decided | Refuted;

interface Binding {
  readonly value: V;
  memo: V | undefined;
}
class ScopeV {
  readonly bindings = new Map<Sym, Binding>();
  constructor(readonly parent: ScopeV | undefined) {}
}

/** Thrown inside one evaluation when its budget runs out. Never leaves the kernel. */
class LimitReached extends Error {}

interface Root {
  readonly scope: ScopeV;
  value: V;
  done: boolean;
}

const KERNEL_PRIMITIVES: ReadonlyArray<readonly [string, number]> = [["claim", 1], ["if", 3], ["quote", 1]];

/** Creates a reference kernel. It does nothing until it is called. */
export const createKernel: CreateKernel = () => {
  const symbols = new Map<string, Sym>();
  const kernelPrims = new Map(KERNEL_PRIMITIVES.map(([name, arity]) => [name, new KernelPrim(name, arity)] as const));
  /** Structures and functions known to need no further evaluation. */
  const settled = new WeakSet<object>();
  /** A function with its free names tied to a scope, by function and scope. */
  const closed = new WeakMap<Fn, Map<ScopeV, Fn>>();
  const roots: Root[] = [];
  const rootOf = new WeakMap<object, Root>();
  let dirty = false;
  let spent = 0;
  let budget = Infinity;

  const TRUE = new Bits(Uint8Array.of(1), 1);
  const FALSE = new Bits(Uint8Array.of(0), 1);

  // ---- Handles ------------------------------------------------------------

  const out = (v: V): Value => v as unknown as Value;
  const isV = (x: unknown): x is V =>
    x instanceof Bits || x instanceof Sym || x instanceof Param || x instanceof Struct || x instanceof Expr || x instanceof Fn ||
    x instanceof Prim || x instanceof KernelPrim || x instanceof CellV || x instanceof NameRef || x instanceof Quoted ||
    x instanceof Decided || x instanceof Refuted;
  const into = (x: Value | null | undefined, what: string): V => {
    if (!isV(x)) throw new InterfaceError(`${what} is not a value of this kernel`);
    return x;
  };
  const scopeIn = (x: Scope | undefined, what: string): ScopeV => {
    if (!(x instanceof ScopeV)) throw new InterfaceError(`${what} is not a scope of this kernel`);
    return x;
  };

  /** The value a handle stands for when it is read: through a filled cell, a quotation and an outcome. */
  const seen = (v: V): V => {
    for (;;) {
      if (v instanceof CellV && v.filled) v = v.value as V;
      else if (v instanceof Quoted || v instanceof Decided) v = v.inner;
      else return v;
    }
  };

  // ---- Names --------------------------------------------------------------

  /** The binding of a name, looked for from a scope outward. */
  const bindingOf = (ref: NameRef): { binding: Binding; scope: ScopeV } | undefined => {
    for (let s: ScopeV | undefined = ref.scope; s !== undefined; s = s.parent) {
      const binding = s.bindings.get(ref.sym);
      if (binding !== undefined) return { binding, scope: s };
    }
    return undefined;
  };

  // ---- What is fully known ------------------------------------------------

  /** True when nothing in the value waits: no unbound name, unfilled cell, parameter or unevaluated application. */
  const known = (v: V): boolean => {
    if (v instanceof Bits || v instanceof Prim || v instanceof KernelPrim || v instanceof Quoted || v instanceof Refuted || v instanceof Fn) return true;
    if (v instanceof Decided) return known(v.inner);
    if (v instanceof CellV) return v.filled && known(v.value as V);
    if (v instanceof Struct) {
      if (settled.has(v)) return true;
      if (!v.entries.every(([, e]) => known(e))) return false;
      settled.add(v);
      return true;
    }
    return false; // a symbol, a name, a parameter, an expression
  };

  /** Plain data from the host or a primitive, made safe to hand on: its symbols are data, not names. */
  const asData = (v: V, what: string): V => {
    if (v instanceof Bits || v instanceof Quoted) return v;
    if (v instanceof Sym) return new Quoted(v);
    if (v instanceof Struct) {
      const s = new Struct(v.entries.map(([k, e]) => [k, asData(e, what)] as const));
      settled.add(s);
      return s;
    }
    throw new InterfaceError(`${what} is not plain data: bits, symbols and structures of them`);
  };

  // ---- Functions ----------------------------------------------------------

  /** Ties the free names of an expression to a scope. Returns the same object where nothing changed. */
  const tie = (v: V, scope: ScopeV, memo: Map<V, V>): V => {
    const done = memo.get(v);
    if (done !== undefined) return done;
    let r: V = v;
    if (v instanceof Sym) r = new NameRef(scope, v);
    else if (v instanceof Expr) {
      const fn = tie(v.fn, scope, memo);
      const args = v.args.map((a) => tie(a, scope, memo));
      if (fn !== v.fn || args.some((a, i) => a !== v.args[i])) r = new Expr(fn, args);
    } else if (v instanceof Struct && !settled.has(v)) {
      const entries = v.entries.map(([k, e]) => [k, tie(e, scope, memo)] as const);
      if (entries.some(([, e], i) => e !== v.entries[i][1])) r = new Struct(entries);
    } else if (v instanceof Fn && !settled.has(v)) {
      const body = tie(v.body, scope, memo);
      r = body === v.body ? v : new Fn(v.params, body);
      settled.add(r);
    }
    memo.set(v, r);
    return r;
  };

  /** A function value, evaluated in a scope: its free names now mean what they mean there. */
  const close = (fn: Fn, scope: ScopeV): Fn => {
    if (settled.has(fn)) return fn;
    let byScope = closed.get(fn);
    if (byScope === undefined) closed.set(fn, (byScope = new Map()));
    let r = byScope.get(scope);
    if (r === undefined) {
      r = tie(fn, scope, new Map()) as Fn;
      settled.add(r);
      byScope.set(scope, r);
    }
    return r;
  };

  /** Puts arguments in place of parameters. */
  const substitute = (v: V, env: Map<Param, V>, memo: Map<V, V>): V => {
    if (v instanceof Param) return env.get(v) ?? v;
    if (!(v instanceof Expr || v instanceof Struct || v instanceof Fn)) return v;
    const done = memo.get(v);
    if (done !== undefined) return done;
    let r: V = v;
    if (v instanceof Expr) {
      const fn = substitute(v.fn, env, memo);
      const args = v.args.map((a) => substitute(a, env, memo));
      if (fn !== v.fn || args.some((a, i) => a !== v.args[i])) r = new Expr(fn, args);
    } else if (v instanceof Struct) {
      if (!settled.has(v)) {
        const entries = v.entries.map(([k, e]) => [k, substitute(e, env, memo)] as const);
        if (entries.some(([, e], i) => e !== v.entries[i][1])) r = new Struct(entries);
      }
    } else {
      const body = substitute(v.body, env, memo);
      if (body !== v.body) {
        r = new Fn(v.params, body);
        if (settled.has(v)) settled.add(r);
      }
    }
    memo.set(v, r);
    return r;
  };

  // ---- Evaluation ---------------------------------------------------------

  const step = (): void => {
    if (spent >= budget) throw new LimitReached();
    spent++;
  };

  const context: PrimitiveContext = {
    bits: (bytes, bitLength) => out(new Bits(bytes, bitLength ?? bytes.length * 8)),
    symbol: (fqn) => out(new Quoted(intern(fqn))),
    structure: (entries) => out(asData(new Struct(entries.map(([k, e]) => [k === null ? null : into(k, "a key"), into(e, "an entry")] as const)), "a structure a primitive builds")),
    kind: (v) => kindOf(into(v, "the value")),
    bitsOf: (v) => bitsOf(into(v, "the value")),
    symbolName: (v) => symbolName(into(v, "the value")),
    entriesOf: (v) => entriesOf(into(v, "the value")),
    cell: () => out(new CellV()) as Cell,
  };

  const evaluate = (v: V, scope: ScopeV): V => {
    if (v instanceof Sym) return evaluate(new NameRef(scope, v), scope);
    if (v instanceof NameRef) {
      const found = bindingOf(v);
      if (found === undefined) return v;
      if (found.binding.memo !== undefined) return found.binding.memo;
      const r = evaluate(found.binding.value, found.scope);
      if (known(r)) found.binding.memo = r;
      return r;
    }
    if (v instanceof CellV) return v.filled ? (v.value as V) : v;
    if (v instanceof Fn) return close(v, scope);
    if (v instanceof Struct) {
      if (settled.has(v)) return v;
      const entries: (readonly [V | null, V])[] = [];
      let changed = false;
      for (const [k, e] of v.entries) {
        const r = evaluate(e, scope);
        if (r instanceof Refuted) return r;
        if (r !== e) changed = true;
        entries.push([k, r]);
      }
      const r = changed ? new Struct(entries) : v;
      known(r);
      return r;
    }
    if (!(v instanceof Expr)) return v; // bits, a parameter, a primitive, a quotation, an outcome, a refutation

    step();
    const fn = evaluate(v.fn, scope);
    if (fn instanceof Refuted) return fn;

    if (fn instanceof KernelPrim) {
      if (v.args.length !== fn.arity) return new Refuted(`"${fn.name}" takes ${fn.arity} argument(s) and was given ${v.args.length}`, undefined);
      if (fn.name === "quote") {
        const a = v.args[0];
        return a instanceof Bits || a instanceof Quoted ? a : new Quoted(a);
      }
      const first = evaluate(v.args[0], scope);
      if (first instanceof Refuted) return first;
      const truth = truthOf(first);
      if (fn.name === "if") {
        if (truth === true) return evaluate(v.args[1], scope);
        if (truth === false) return evaluate(v.args[2], scope);
        if (known(first)) return new Refuted("a condition that is neither true nor false", first);
        return new Expr(fn, [first, tie(v.args[1], scope, new Map()), tie(v.args[2], scope, new Map())]);
      }
      // claim
      if (truth === true) return first instanceof Decided ? first : new Decided(first);
      if (known(first)) return new Refuted("a claim that is not true", first);
      return new Expr(fn, [first]);
    }

    const args: V[] = [];
    for (const a of v.args) {
      const r = evaluate(a, scope);
      if (r instanceof Refuted) return r;
      args.push(r);
    }
    if (fn instanceof Fn) {
      if (fn.params.length !== args.length)
        return new Refuted(`a function of ${fn.params.length} parameter(s) was given ${args.length} argument(s)`, undefined);
      const env = new Map(fn.params.map((p, i) => [p, args[i]] as const));
      return evaluate(substitute(fn.body, env, new Map()), scope);
    }
    if (fn instanceof Prim) {
      if (fn.declaration.arity !== args.length)
        return new Refuted(`a primitive of ${fn.declaration.arity} parameter(s) was given ${args.length} argument(s)`, undefined);
      if (!args.every(known)) return new Expr(fn, args);
      const r = into(fn.declaration.run(args.map(out), context), "what a primitive returned");
      return r instanceof CellV ? r : asData(r, "what a primitive returned");
    }
    if (known(fn)) return new Refuted("a call on something that is not a function", fn);
    return new Expr(fn, args);
  };

  const truthOf = (v: V): boolean | undefined => {
    const s = seen(v);
    if (!(s instanceof Bits) || s.bitLength !== 1) return undefined;
    return (s.bytes[0] & 1) === 1;
  };

  /** Runs one piece of evaluation under a budget. A stack that runs out is a limit too. */
  const within = <T>(limits: Limits | undefined, body: () => T): { value: T | undefined; ended: "complete" | "limit"; steps: number } => {
    spent = 0;
    budget = limits?.steps ?? Infinity;
    try {
      return { value: body(), ended: "complete", steps: spent };
    } catch (e) {
      if (e instanceof LimitReached || e instanceof RangeError) return { value: undefined, ended: "limit", steps: spent };
      throw e;
    }
  };

  /** The unfilled cells and unbound names a value still waits on. */
  const waitsOn = (v: V, found: Set<V>, visited: Set<V>): void => {
    if (visited.has(v)) return;
    visited.add(v);
    if (v instanceof CellV) {
      if (!v.filled) found.add(v);
      else waitsOn(v.value as V, found, visited);
    } else if (v instanceof NameRef) {
      if (bindingOf(v) === undefined) found.add(v);
    } else if (v instanceof Expr) {
      waitsOn(v.fn, found, visited);
      v.args.forEach((a) => waitsOn(a, found, visited));
    } else if (v instanceof Struct) {
      if (!settled.has(v)) v.entries.forEach(([, e]) => waitsOn(e, found, visited));
    } else if (v instanceof Decided) waitsOn(v.inner, found, visited);
  };

  // ---- Reading ------------------------------------------------------------

  const intern = (fqn: string): Sym => {
    let s = symbols.get(fqn);
    if (s === undefined) symbols.set(fqn, (s = new Sym(fqn)));
    return s;
  };
  const kindOf = (v: V): Kind => {
    const s = seen(v);
    if (s instanceof Bits) return "bits";
    if (s instanceof Sym || s instanceof NameRef) return "symbol";
    if (s instanceof Param) return "param";
    if (s instanceof Struct || s instanceof Refuted) return "structure";
    if (s instanceof Fn) return "composed-function";
    if (s instanceof Prim || s instanceof KernelPrim) return "primitive-function";
    return "expression"; // an expression, and an unfilled cell
  };
  const wrong = (call: string, v: V): never => {
    throw new InterfaceError(`${call}: the value is of kind ${kindOf(v)}`);
  };
  const bitsOf = (v: V) => {
    const s = seen(v);
    return s instanceof Bits ? { bytes: s.bytes, bitLength: s.bitLength } : wrong("bitsOf", v);
  };
  const symbolName = (v: V): string => {
    const s = seen(v);
    return s instanceof Sym ? s.fqn : s instanceof NameRef ? s.sym.fqn : wrong("symbolName", v);
  };
  const entriesOf = (v: V): readonly Entry[] => {
    const s = seen(v);
    if (s instanceof Refuted) return [];
    return s instanceof Struct ? s.entries.map(([k, e]) => [k === null ? null : out(k), out(e)] as const) : wrong("entriesOf", v);
  };

  const kernel: Kernel & { refutationOf(value: Value): string | undefined } = {
    interfaceVersion: INTERFACE_VERSION,
    variant: "reference-k2",

    bits: (bytes, bitLength) => {
      const n = bitLength ?? bytes.length * 8;
      if (!Number.isInteger(n) || n < 0 || n > bytes.length * 8) throw new InterfaceError("bits: the length does not fit the bytes");
      return out(new Bits(bytes, n));
    },
    symbol: (fqn) => out(intern(fqn)),
    param: (name) => out(new Param(name)),
    structure: (entries) => out(new Struct(entries.map(([k, e]) => [k === null ? null : into(k, "a key"), into(e, "an entry")] as const))),
    expression: (fn, args) => out(new Expr(into(fn, "the function"), args.map((a) => into(a, "an argument")))),
    composedFunction: (params, body) => {
      const ps = params.map((p) => {
        const v = into(p, "a parameter");
        if (!(v instanceof Param)) throw new InterfaceError("composedFunction: a parameter is not of kind param");
        return v;
      });
      if (new Set(ps).size !== ps.length) throw new InterfaceError("composedFunction: a parameter is listed twice");
      return out(new Fn(ps, into(body, "the body")));
    },
    primitiveFunction: (declaration) => out(new Prim(declaration)),
    kernelPrimitive: (name) => {
      const p = kernelPrims.get(name);
      if (p === undefined) throw new InterfaceError(`kernelPrimitive: the kernel has no primitive named "${name}"`);
      return out(p);
    },
    kernelPrimitiveNames: () => [...kernelPrims.keys()],

    scope: (parent) => new ScopeV(parent === undefined ? undefined : scopeIn(parent, "the parent")) as unknown as Scope,
    bind: (scope, symbol, value) => {
      const s = scopeIn(scope, "the scope");
      const sym = into(symbol, "the symbol");
      if (!(sym instanceof Sym)) throw new InterfaceError("bind: the name is not of kind symbol");
      if (s.bindings.has(sym)) throw new InterfaceError(`bind: ${sym.fqn} is already bound in this scope`);
      s.bindings.set(sym, { value: into(value, "the value"), memo: undefined });
      dirty = true;
    },

    cell: () => out(new CellV()) as Cell,
    fill: (cell, value) => {
      const c = into(cell, "the cell");
      if (!(c instanceof CellV)) throw new InterfaceError("fill: not a cell");
      if (c.filled) throw new InterfaceError("fill: the cell is already filled");
      c.value = asData(into(value, "the value"), "what a cell is filled with");
      c.filled = true;
      dirty = true;
    },
    filled: (cell) => {
      const c = into(cell, "the cell");
      if (c instanceof CellV) return c.filled;
      if (c instanceof NameRef) return bindingOf(c) !== undefined;
      throw new InterfaceError("filled: not a cell");
    },
    waiting: () => {
      const found = new Set<V>();
      for (const root of roots) if (!root.done) waitsOn(root.value, found, new Set());
      return [...found].map((v) => out(v) as Cell);
    },

    evaluate: (expression, scope, limits): Result => {
      const e = into(expression, "the expression");
      const s = scopeIn(scope, "the scope");
      const r = within(limits, () => evaluate(e, s));
      const value = r.value ?? e;
      if (r.ended === "complete" && !known(value)) {
        const root: Root = { scope: s, value, done: false };
        roots.push(root);
        rootOf.set(value, root);
      }
      return { value: out(value), ended: r.ended, steps: r.steps, refuted: value instanceof Refuted };
    },
    advance: (limits): Advance => {
      if (!dirty) return { ended: "complete", steps: 0, refuted: [] };
      dirty = false;
      const refuted: Value[] = [];
      const r = within(limits, () => {
        for (const root of roots) {
          if (root.done) continue;
          const next = evaluate(root.value, root.scope);
          root.value = next;
          rootOf.set(next, root);
          if (next instanceof Refuted) refuted.push(out(next));
          if (known(next)) root.done = true;
        }
      });
      if (r.ended === "limit") dirty = true;
      return { ended: r.ended, steps: r.steps, refuted };
    },
    current: (value) => {
      const v = into(value, "the value");
      const root = rootOf.get(v);
      if (root !== undefined) return out(root.value);
      if (v instanceof CellV && v.filled) return out(v.value as V);
      return value;
    },

    kind: (v) => kindOf(into(v, "the value")),
    bitsOf: (v) => bitsOf(into(v, "the value")),
    symbolName: (v) => symbolName(into(v, "the value")),
    paramName: (v) => {
      const s = seen(into(v, "the value"));
      return s instanceof Param ? s.name : wrong("paramName", s);
    },
    entriesOf: (v) => entriesOf(into(v, "the value")),
    expressionOf: (v) => {
      const s = seen(into(v, "the value"));
      return s instanceof Expr ? { fn: out(s.fn), args: s.args.map(out) } : wrong("expressionOf", s);
    },
    composedFunctionOf: (v) => {
      const s = seen(into(v, "the value"));
      return s instanceof Fn ? { params: s.params.map(out), body: out(s.body) } : wrong("composedFunctionOf", s);
    },
    primitiveFunctionOf: (v) => {
      const s = seen(into(v, "the value"));
      if (s instanceof KernelPrim) return { purity: "pure", hash: `kernel:${s.name}`, name: s.name, arity: s.arity };
      if (!(s instanceof Prim)) return wrong("primitiveFunctionOf", s);
      const { run: _run, ...rest } = s.declaration;
      return rest;
    },
    fieldsOf: (v) => {
      into(v, "the value");
      return [];
    },
    field: (v, field) => {
      into(v, "the value");
      into(field, "the field");
      return undefined;
    },
    outcomeOf: (v): Outcome | undefined => {
      let s = into(v, "the value");
      for (;;) {
        if (s instanceof Refuted) return "refuted";
        if (s instanceof Decided) return "decided";
        if (s instanceof CellV && s.filled) s = s.value as V;
        else if (s instanceof Quoted) s = s.inner;
        else break;
      }
      return s instanceof Expr && s.fn === kernelPrims.get("claim") ? "undecided" : undefined;
    },
    originOf: (v) => {
      into(v, "the value");
      return undefined;
    },

    refutationOf: (value) => {
      const v = into(value, "the value");
      return v instanceof Refuted ? v.reason : undefined;
    },
  };
  return kernel;
};

/** The reason a refutation was recorded, on a kernel made by this file. Not part of the interface yet. */
export function refutationOf(kernel: Kernel, value: Value): string | undefined {
  return (kernel as Kernel & { refutationOf?(v: Value): string | undefined }).refutationOf?.(value);
}
