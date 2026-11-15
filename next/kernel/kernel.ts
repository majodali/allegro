// The reference kernel (chunks K2 and K3 of docs/plans/book-pass.md).
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
// The kernel's own primitives, by name (chunk K4 fixed the list; fields
// and the questions about keys are not built yet):
//   "if"        if(condition, then, else). The condition must come to one
//               of the kernel's two truth values. Each branch is a
//               function of no parameters, and only the one taken is
//               called. While the condition is unknown the whole stays a
//               residual. A form that gives a branch more knowledge makes
//               the branch a function of the names its condition tested.
//   "claim"     claim(x). True records the outcome "decided". Anything
//               else fully known is a refutation. Unknown stays a residual.
//   "describe"  describe(right, function). A description of the function,
//               as plain data. `right` is a key of the module that made
//               the function, or the inspection right. Where the function
//               holds an unforgeable value the description holds its
//               public identity only.
//   "build"     build(description). The function a description describes.
//               A refutation where the description holds the identity of
//               an unforgeable value: nothing makes authority from data.
//   "attempt"   attempt(function, budget). Calls a function of no
//               parameters under a budget of steps and answers how it
//               ended, as data: a value, a refutation with its reason, or
//               the limit reached. A refutation inside marks nothing
//               outside.
// The truth values are the bits of length one: 1 is true, 0 is false.
// There is no quotation and no argument taken unevaluated: a callee is
// handed functions and values, never the text of its caller. A symbol
// that is data comes from a description, from a cell or from a
// primitive function.
//
// A description is a structure whose first entry is a symbol naming its
// form, all in the names `description.*`:
//   bits <bits>            symbol <symbol>          name <symbol>
//   param <depth> <index>  apply <fn> <args>        function <count> <body>
//   structure <entries>    kernel <name>            primitive <hash>
//   capability <name> <part>   key <module> <slot>  opaque   unknown
// A parameter is named by its place, as in a module's content. The last
// four hold no value: they say what was there.
//
// Left for later chunks, and not attempted here:
//   - metadata fields, their rules, and origins (`fieldsOf` is empty and
//     `originOf` answers undefined);
//   - evaluating a branch that may not be taken, without capabilities;
//   - recursion on unknown arguments: a call is always opened, so only
//     the step budget ends such a recursion (chunk K5);
//   - building a description that holds an unforgeable value, by
//     supplying the value; and the block of bindings that lets a built
//     function bind its own names (Part III's loader needs both);
//   - the gate that keeps an effect from a value whose claims are
//     undecided, and the order of effects that become ready together.
//
// The second version of the interface (chunk K3) adds, here:
//   - modules and keys. `module` hashes a function's content, and makes
//     the module's keys from that identity;
//   - what a result rests on. While a claim is evaluated the kernel
//     collects the primitive functions that ran, the capabilities whose
//     answers it read, and the builders of restored outcomes it met;
//   - restore. A restored claim is not evaluated: it is decided, resting
//     on its builder.

import type {
  Advance, Cell, CreateKernel2, Entry, Kernel2, KeyDescription, Kind, Limits, Outcome, PrimitiveContext, PrimitiveDeclaration, Rest, Result, Scope,
  Value,
} from "./interface.js";
import { INTERFACE_VERSION, InterfaceError, KernelFault } from "./interface.js";
import { sha256Text } from "./hash.js";

export { InterfaceError, KernelFault } from "./interface.js";

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
/** A missing value, filled once. `source` is the capability whose answer it will hold, where one made it. */
class CellV {
  filled = false;
  value: V | undefined;
  constructor(readonly source: Rest | undefined) {}
}
/**
 * A key: made with its module, from the module's identity. It reads as
 * a structure of two entries, the module's identity and the slot. The
 * kernel's mark is that it is of this class: until metadata fields are
 * built, that is how the reference kernel tells a key from a structure
 * with the same entries.
 */
class Key {
  constructor(readonly module: string, readonly slot: number) {}
}
/** A name tied to the scope it is looked up from. Unbound, it is a residual that waits on the name. */
class NameRef {
  constructor(readonly scope: ScopeV, readonly sym: Sym) {}
}
/** A value that is data and is not to be evaluated: a symbol in a description, from a cell or from a primitive function. */
class Quoted {
  constructor(readonly inner: V) {}
}
/** A value with the kernel's record of a claim's outcome on it. */
class Decided {
  constructor(readonly inner: V, readonly rests: readonly Rest[]) {}
}
/** A refutation. Whatever is computed from it is it. */
class Refuted {
  constructor(readonly reason: string, readonly about: V | undefined) {}
}

type V = Bits | Sym | Param | Struct | Expr | Fn | Prim | KernelPrim | CellV | NameRef | Quoted | Decided | Refuted | Key;

interface Binding {
  readonly value: V;
  memo: V | undefined;
  /** What evaluating the binding rested on, kept with its value. */
  rests: readonly Rest[];
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

const KERNEL_PRIMITIVES: ReadonlyArray<readonly [string, number]> = [["attempt", 2], ["build", 1], ["claim", 1], ["describe", 2], ["if", 3]];
/** The module name under which the kernel makes the inspection right. No content hashes to it. */
const INSPECT = "kernel:inspect";

/** Creates a reference kernel. It does nothing until it is called. */
export const createKernel: CreateKernel2 = () => {
  const symbols = new Map<string, Sym>();
  const kernelPrims = new Map(KERNEL_PRIMITIVES.map(([name, arity]) => [name, new KernelPrim(name, arity)] as const));
  /** Structures and functions known to need no further evaluation. */
  const settled = new WeakSet<object>();
  /** A function with its free names tied to a scope, by function and scope. */
  const closed = new WeakMap<Fn, Map<ScopeV, Fn>>();
  const roots: Root[] = [];
  const rootOf = new WeakMap<object, Root>();
  /** Claims whose outcome was restored from a saved program, with what each rests on. */
  const restored = new WeakMap<Expr, readonly Rest[]>();
  const moduleIds = new WeakMap<Fn, string>();
  /** The module a function was made in, for every function inside a module. */
  const madeBy = new WeakMap<Fn, string>();
  /** The pure primitive functions made in this kernel, by content hash. */
  const pureByHash = new Map<string, Prim>();
  const keys = new Map<string, Key>();
  const VARIANT = "reference-k3";
  let dirty = false;
  let spent = 0;
  let budget = Infinity;
  /** What the evaluations now under way rest on: one collector for each claim or binding being evaluated. */
  const collectors: Map<string, Rest>[] = [];
  /** The capability part now running, so a cell it makes knows where its answer comes from. */
  let running: Rest | undefined;

  const restKey = (r: Rest): string =>
    r.kind === "kernel" ? `kernel ${r.variant}` : r.kind === "primitive" ? `primitive ${r.hash}` : r.kind === "capability" ? `capability ${r.capability}.${r.part}` : `builder ${r.builder}`;
  const rest = (r: Rest): void => {
    for (const c of collectors) c.set(restKey(r), r);
  };
  /** Evaluates under a fresh collector and returns what the evaluation rested on. */
  const collecting = <T>(body: () => T): { value: T; rests: Rest[] } => {
    const mine = new Map<string, Rest>();
    collectors.push(mine);
    try {
      return { value: body(), rests: [...mine.values()] };
    } finally {
      collectors.pop();
    }
  };

  const TRUE = new Bits(Uint8Array.of(1), 1);
  const FALSE = new Bits(Uint8Array.of(0), 1);

  // ---- Handles ------------------------------------------------------------

  const out = (v: V): Value => v as unknown as Value;
  const isV = (x: unknown): x is V =>
    x instanceof Bits || x instanceof Sym || x instanceof Param || x instanceof Struct || x instanceof Expr || x instanceof Fn ||
    x instanceof Prim || x instanceof KernelPrim || x instanceof CellV || x instanceof NameRef || x instanceof Quoted ||
    x instanceof Decided || x instanceof Refuted || x instanceof Key;
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
    if (v instanceof Bits || v instanceof Prim || v instanceof KernelPrim || v instanceof Quoted || v instanceof Refuted || v instanceof Fn || v instanceof Key) return true;
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
    if (v instanceof Expr && restored.has(v)) return v;
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
      const maker = madeBy.get(v);
      if (maker !== undefined) madeBy.set(r, maker);
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
    if (v instanceof Expr && restored.has(v)) return v;
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
        const maker = madeBy.get(v);
        if (maker !== undefined) madeBy.set(r, maker);
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
    cell: () => out(new CellV(running)) as Cell,
  };

  const evaluate = (v: V, scope: ScopeV): V => {
    if (v instanceof Sym) return evaluate(new NameRef(scope, v), scope);
    if (v instanceof NameRef) {
      const found = bindingOf(v);
      if (found === undefined) return v;
      if (found.binding.memo !== undefined) {
        found.binding.rests.forEach(rest);
        return found.binding.memo;
      }
      const { value: r, rests } = collecting(() => evaluate(found.binding.value, found.scope));
      rests.forEach(rest);
      if (known(r)) {
        found.binding.memo = r;
        found.binding.rests = rests;
      }
      return r;
    }
    if (v instanceof CellV) {
      if (!v.filled) return v;
      if (v.source !== undefined) rest(v.source);
      return v.value as V;
    }
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

    const stored = restored.get(v);
    if (stored !== undefined) {
      stored.forEach(rest);
      return new Decided(TRUE, stored);
    }
    step();
    const fn = evaluate(v.fn, scope);
    if (fn instanceof Refuted) return fn;

    if (fn instanceof KernelPrim) {
      if (v.args.length !== fn.arity) return new Refuted(`"${fn.name}" takes ${fn.arity} argument(s) and was given ${v.args.length}`, undefined);
      if (fn.name === "claim") {
        const { value: claimed, rests } = collecting(() => evaluate(v.args[0], scope));
        rests.forEach(rest);
        if (claimed instanceof Refuted) return claimed;
        if (truthOf(claimed) === true) return new Decided(seen(claimed), [{ kind: "kernel", variant: VARIANT }, ...rests]);
        if (known(claimed)) return new Refuted("a claim that is not true", claimed);
        return new Expr(fn, [claimed]);
      }
      const args: V[] = [];
      for (const a of v.args) {
        const r = evaluate(a, scope);
        if (r instanceof Refuted) return r;
        args.push(r);
      }
      const waits = (): V => new Expr(fn, args);
      if (fn.name === "if") {
        const truth = truthOf(args[0]);
        if (truth === undefined) return known(args[0]) ? new Refuted("a condition that is neither true nor false", args[0]) : waits();
        const branch = args[truth ? 1 : 2];
        if (branch instanceof Fn && branch.params.length === 0) return evaluate(branch.body, scope);
        return known(branch) ? new Refuted("a branch of a conditional is not a function of no parameters", branch) : waits();
      }
      if (fn.name === "describe") {
        const [right, f] = [seen(args[0]), args[1]];
        if (!known(right) || !known(f)) return waits();
        if (!(right instanceof Key)) return new Refuted("describing a function needs a key or the inspection right", right);
        if (!(f instanceof Fn)) return new Refuted("only a function can be described", f);
        const all = right.module === INSPECT;
        if (!all && madeBy.get(f) !== right.module)
          return new Refuted("describing a function needs a key of the module that made it, or the inspection right", undefined);
        return describe(f, [], all ? undefined : right.module);
      }
      if (fn.name === "build") {
        if (!known(args[0])) return waits();
        const built = build(args[0], []);
        return built instanceof Fn ? close(built, scope) : built instanceof Refuted ? built : new Refuted("only the description of a function can be built", args[0]);
      }
      if (fn.name === "attempt") {
        const [f, steps] = [args[0], seen(args[1])];
        if (!known(f) || !known(steps)) return waits();
        if (!(f instanceof Fn) || f.params.length !== 0) return new Refuted("an attempt takes a function of no parameters", f);
        if (!(steps instanceof Bits)) return new Refuted("an attempt's budget is a number of steps, as bits", steps);
        const outer = budget;
        budget = Math.min(outer, spent + numberOf(steps));
        let r: V;
        try {
          r = evaluate(f.body, scope);
        } catch (e) {
          if (e instanceof LimitReached && spent < outer) return data("limit");
          throw e;
        } finally {
          budget = outer;
        }
        if (r instanceof Refuted) return data("refuted", text(r.reason));
        if (known(r)) return data("value", r);
        // It waits on something. What is left is attempted again, so nothing done so far is done twice.
        const rest = new Fn([], r);
        settled.add(rest);
        return new Expr(fn, [rest, args[1]]);
      }
      throw new KernelFault(`the kernel primitive "${fn.name}" has no evaluation`);
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
      const d = fn.declaration;
      const what: Rest = d.purity === "pure" ? { kind: "primitive", hash: d.hash, name: d.name } : { kind: "capability", capability: d.capability, part: d.part };
      rest(what);
      const before = running;
      running = d.purity === "effectful" ? what : undefined;
      let r: V;
      try {
        r = into(d.run(args.map(out), context), "what a primitive returned");
      } finally {
        running = before;
      }
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

  const utf8 = new TextEncoder();
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
    if (s instanceof Struct || s instanceof Refuted || s instanceof Key) return "structure";
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
    if (s instanceof Key) {
      const slot = Uint8Array.of(s.slot >>> 24, (s.slot >>> 16) & 255, (s.slot >>> 8) & 255, s.slot & 255);
      return [[null, out(new Bits(utf8.encode(s.module), s.module.length * 8))], [null, out(new Bits(slot, 32))]];
    }
    return s instanceof Struct ? s.entries.map(([k, e]) => [k === null ? null : out(k), out(e)] as const) : wrong("entriesOf", v);
  };

  // ---- Content ------------------------------------------------------------

  const hex = (bytes: Uint8Array): string => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  /**
   * The digest of a value's content, and how many enclosing functions its
   * free parameters reach past it (0: none). A parameter is named by its
   * place: how many functions out its owner is, and where in the owner's
   * list. So two functions that differ only in their parameters' names,
   * or in how their parts are shared, have the same content.
   */
  const contentOf = (v: V, binders: readonly Fn[], memo: Map<V, string>): { digest: string; free: number } => {
    const known = memo.get(v);
    if (known !== undefined) return { digest: known, free: 0 };
    let text: string;
    let free = 0;
    const part = (x: V, bs: readonly Fn[] = binders): string => {
      const c = contentOf(x, bs, memo);
      free = Math.max(free, bs === binders ? c.free : c.free - 1);
      return c.digest;
    };
    if (v instanceof Bits) text = `bits ${v.bitLength} ${hex(v.bytes)}`;
    else if (v instanceof Sym) text = `symbol ${v.fqn}`;
    else if (v instanceof KernelPrim) text = `kernel ${v.name}`;
    else if (v instanceof Key) text = `key ${v.module} ${v.slot}`;
    else if (v instanceof Quoted) text = `quote ${part(v.inner)}`;
    else if (v instanceof Decided) return contentOf(v.inner, binders, memo);
    else if (v instanceof Expr) text = `apply ${part(v.fn)} ${v.args.map((a) => part(a)).join(" ")}`;
    else if (v instanceof Struct) text = `structure ${v.entries.map(([k, e]) => `${k === null ? "-" : part(k)}:${part(e)}`).join(" ")}`;
    else if (v instanceof Fn) text = `function ${v.params.length} ${part(v.body, [...binders, v])}`;
    else if (v instanceof Param) {
      let found = -1;
      let index = -1;
      for (let d = binders.length - 1; d >= 0 && found < 0; d--) {
        index = binders[d].params.indexOf(v);
        if (index >= 0) found = binders.length - 1 - d;
      }
      if (found < 0) throw new InterfaceError(`module: the parameter ${v.name} belongs to no function in it`);
      text = `param ${found} ${index}`;
      free = found + 1;
    } else if (v instanceof Prim) {
      if (v.declaration.purity !== "pure") throw new InterfaceError("module: an effectful primitive has no content; a capability reaches a module as an argument");
      text = `primitive ${v.declaration.hash}`;
    } else if (v instanceof CellV && v.filled) return contentOf(v.value as V, binders, memo);
    else throw new InterfaceError("module: the function is not closed: it holds a cell, a name tied to a scope, or a refutation");
    const digest = sha256Text(text);
    if (free <= 0) memo.set(v, digest);
    return { digest, free: Math.max(0, free) };
  };

  /** The functions that enclose a value inside another, outermost first, or undefined where it is not inside. */
  const enclosing = (target: V, v: V, binders: readonly Fn[], visited: Set<V>): readonly Fn[] | undefined => {
    if (v === target) return binders;
    if (visited.has(v)) return undefined;
    visited.add(v);
    const parts: V[] = v instanceof Expr ? [v.fn, ...v.args] : v instanceof Struct ? v.entries.map(([, e]) => e) : v instanceof Quoted ? [v.inner] : [];
    for (const p of parts) {
      const found = enclosing(target, p, binders, visited);
      if (found !== undefined) return found;
    }
    return v instanceof Fn ? enclosing(target, v.body, [...binders, v], visited) : undefined;
  };

  /** The key of a claim's outcome: its content, the content of the function it sits in, and what it rests on. */
  const claimKey = (claim: V, within: V, restsOn: readonly Rest[]): string => {
    if (!(claim instanceof Expr) || claim.fn !== kernelPrims.get("claim") || claim.args.length !== 1)
      throw new InterfaceError("not an application of the kernel's claim primitive");
    if (!(within instanceof Fn)) throw new InterfaceError("the claim's function is not a composed function");
    const binders = enclosing(claim, within, [], new Set());
    if (binders === undefined) throw new InterfaceError("the claim is not inside that function");
    const grounds = restsOn.filter((r) => r.kind !== "builder").map(restKey).sort();
    const memo = new Map<V, string>();
    return `sha256:${sha256Text(`outcome ${contentOf(within, [], memo).digest} ${contentOf(claim, binders, memo).digest} ${grounds.join("|")}`)}`;
  };

  // ---- Descriptions -------------------------------------------------------

  const text = (t: string): V => new Bits(utf8.encode(t), utf8.encode(t).length * 8);
  const number = (n: number): V => new Bits(Uint8Array.of(n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255), 32);
  const numberOf = (b: Bits): number => b.bytes.reduce((n, byte) => (n * 256 + byte) % 0x100000000, 0);
  const textOf = (b: Bits): string => new TextDecoder().decode(b.bytes);
  /** A structure of plain data whose first entry is a symbol naming its form. */
  const data = (form: string, ...parts: V[]): V => {
    const s = new Struct([[null, new Quoted(intern(`description.${form}`))], ...parts.map((p) => [null, p] as const)]);
    settled.add(s);
    return s;
  };
  const list = (items: readonly V[]): V => {
    const s = new Struct(items.map((p) => [null, p] as const));
    settled.add(s);
    return s;
  };

  /**
   * The description of a value. `own` is the module whose functions may
   * be described; undefined describes every function. A function of
   * another module is described as opaque.
   */
  const describe = (v: V, binders: readonly Fn[], own: string | undefined): V => {
    if (v instanceof Bits) return data("bits", v);
    if (v instanceof Quoted) return v.inner instanceof Sym ? data("symbol", v) : describe(v.inner, binders, own);
    if (v instanceof Sym) return data("name", new Quoted(v));
    if (v instanceof NameRef) return data("name", new Quoted(v.sym));
    if (v instanceof Decided) return describe(v.inner, binders, own);
    if (v instanceof CellV) return v.filled ? describe(v.value as V, binders, own) : data("unknown");
    if (v instanceof KernelPrim) return data("kernel", text(v.name));
    if (v instanceof Key) return data("key", text(v.module), number(v.slot));
    if (v instanceof Prim) {
      const d = v.declaration;
      return d.purity === "pure" ? data("primitive", text(d.hash)) : data("capability", text(d.capability), text(d.part));
    }
    if (v instanceof Param) {
      for (let d = binders.length - 1; d >= 0; d--) {
        const index = binders[d].params.indexOf(v);
        if (index >= 0) return data("param", number(binders.length - 1 - d), number(index));
      }
      return data("unknown");
    }
    if (v instanceof Expr) return data("apply", describe(v.fn, binders, own), list(v.args.map((a) => describe(a, binders, own))));
    if (v instanceof Struct) {
      const entries = new Struct(v.entries.map(([k, e]) => [k === null ? null : asData(k, "a structure's key"), describe(e, binders, own)] as const));
      settled.add(entries);
      return data("structure", entries);
    }
    if (v instanceof Fn) {
      if (own !== undefined && madeBy.get(v) !== own) return data("opaque");
      return data("function", number(v.params.length), describe(v.body, [...binders, v], own));
    }
    return data("unknown"); // a refutation
  };

  /** The value a description describes, or a refutation where it cannot be built. */
  const build = (d: V, binders: readonly Fn[]): V => {
    const malformed = (): V => new Refuted("not a description", d);
    const s = seen(d);
    if (!(s instanceof Struct) || s.entries.length === 0) return malformed();
    const head = s.entries[0][1];
    const form = head instanceof Quoted && head.inner instanceof Sym ? head.inner.fqn : "";
    const parts = s.entries.slice(1).map(([, e]) => e);
    const bitsAt = (i: number): Bits | undefined => {
      const p = parts[i] === undefined ? undefined : seen(parts[i]);
      return p instanceof Bits ? p : undefined;
    };
    switch (form) {
      case "description.bits":
        return bitsAt(0) ?? malformed();
      case "description.symbol":
        return parts[0] instanceof Quoted ? parts[0] : malformed();
      case "description.name":
        return parts[0] instanceof Quoted && parts[0].inner instanceof Sym ? parts[0].inner : malformed();
      case "description.kernel": {
        const p = bitsAt(0) === undefined ? undefined : kernelPrims.get(textOf(bitsAt(0) as Bits));
        return p ?? malformed();
      }
      case "description.primitive": {
        const b = bitsAt(0);
        if (b === undefined) return malformed();
        return pureByHash.get(textOf(b)) ?? new Refuted(`a description names the primitive ${textOf(b)}, which this kernel lacks`, undefined);
      }
      case "description.param": {
        const [depth, index] = [bitsAt(0), bitsAt(1)];
        if (depth === undefined || index === undefined) return malformed();
        const owner = binders[binders.length - 1 - numberOf(depth)];
        return owner?.params[numberOf(index)] ?? malformed();
      }
      case "description.apply": {
        const args = parts[1] === undefined ? undefined : seen(parts[1]);
        if (parts[0] === undefined || !(args instanceof Struct)) return malformed();
        const fn = build(parts[0], binders);
        if (fn instanceof Refuted) return fn;
        const built: V[] = [];
        for (const [, a] of args.entries) {
          const r = build(a, binders);
          if (r instanceof Refuted) return r;
          built.push(r);
        }
        return new Expr(fn, built);
      }
      case "description.structure": {
        const entries = parts[0] === undefined ? undefined : seen(parts[0]);
        if (!(entries instanceof Struct)) return malformed();
        const built: (readonly [V | null, V])[] = [];
        for (const [k, e] of entries.entries) {
          const r = build(e, binders);
          if (r instanceof Refuted) return r;
          built.push([k, r]);
        }
        return new Struct(built);
      }
      case "description.function": {
        const count = bitsAt(0);
        if (count === undefined || parts[1] === undefined || numberOf(count) > 255) return malformed();
        const params = Array.from({ length: numberOf(count) }, (_x, i) => new Param(`p${i}`));
        // A stand-in with the same parameters is the innermost binder while the body is built.
        const body = build(parts[1], [...binders, new Fn(params, new Struct([]))]);
        return body instanceof Refuted ? body : new Fn(params, body);
      }
      case "description.capability":
      case "description.key":
      case "description.opaque":
        return new Refuted("a description that holds the identity of an unforgeable value cannot be built: nothing makes authority from data", undefined);
      default:
        return malformed();
    }
  };

  const kernel: Kernel2 = {
    interfaceVersion: INTERFACE_VERSION,
    variant: VARIANT,

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
    primitiveFunction: (declaration) => {
      const p = new Prim(declaration);
      if (declaration.purity === "pure") pureByHash.set(declaration.hash, p);
      return out(p);
    },
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
      s.bindings.set(sym, { value: into(value, "the value"), memo: undefined, rests: [] });
      dirty = true;
    },

    cell: () => out(new CellV(undefined)) as Cell,
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

    module: (fn, count) => {
      const f = into(fn, "the function");
      if (!(f instanceof Fn)) throw new InterfaceError("module: not a composed function");
      if (!Number.isInteger(count) || count < 0 || count > f.params.length) throw new InterfaceError("module: the number of key slots does not fit the function's parameters");
      const identity = `sha256:${contentOf(f, [], new Map()).digest}`;
      const env = new Map<Param, V>();
      for (let slot = 0; slot < count; slot++) {
        const name = `${identity} ${slot}`;
        let key = keys.get(name);
        if (key === undefined) keys.set(name, (key = new Key(identity, slot)));
        env.set(f.params[slot], key);
      }
      const made = new Fn(f.params.slice(count), substitute(f.body, env, new Map()));
      moduleIds.set(made, identity);
      // Every function inside the module is the module's: its keys describe them.
      const mark = (v: V, visited: Set<V>): void => {
        if (visited.has(v)) return;
        visited.add(v);
        if (v instanceof Fn) {
          madeBy.set(v, identity);
          mark(v.body, visited);
        } else if (v instanceof Expr) {
          mark(v.fn, visited);
          v.args.forEach((a) => mark(a, visited));
        } else if (v instanceof Struct) v.entries.forEach(([, e]) => mark(e, visited));
      };
      mark(made, new Set());
      return out(made);
    },
    moduleOf: (value) => {
      const v = into(value, "the value");
      return v instanceof Fn ? moduleIds.get(v) : undefined;
    },
    inspectionRight: () => {
      let key = keys.get(INSPECT);
      if (key === undefined) keys.set(INSPECT, (key = new Key(INSPECT, 0)));
      return out(key);
    },
    isKey: (value) => seen(into(value, "the value")) instanceof Key,
    keyOf: (value): KeyDescription => {
      const s = seen(into(value, "the value"));
      if (!(s instanceof Key)) throw new InterfaceError("keyOf: the value is not a key");
      return { module: s.module, slot: s.slot };
    },
    restsOn: (value) => {
      let v = into(value, "the value");
      while (v instanceof CellV && v.filled) v = v.value as V;
      return v instanceof Decided ? v.rests : [];
    },
    reasonOf: (value) => {
      const v = into(value, "the value");
      return v instanceof Refuted ? v.reason : undefined;
    },
    claimKey: (claim, within, restsOn) => claimKey(into(claim, "the claim"), into(within, "the function"), restsOn),
    restore: (claim, within, builder, restsOn, key) => {
      const c = into(claim, "the claim");
      if (builder === "") throw new InterfaceError("restore: an outcome is restored under a builder's name");
      if (restsOn.some((r) => r.kind === "capability"))
        throw new InterfaceError("restore: an outcome that rests on a capability's answer is never stored");
      if (claimKey(c, into(within, "the function"), restsOn) !== key)
        throw new InterfaceError("restore: the key does not match this claim, in this function, resting on these things");
      const all = new Map<string, Rest>();
      for (const r of [{ kind: "builder", builder } as const, ...restsOn]) all.set(restKey(r), r);
      restored.set(c as Expr, [...all.values()]);
    },
    isCell: (value) => {
      const v = into(value, "the value");
      return v instanceof CellV || v instanceof NameRef;
    },
  };
  return kernel;
};
