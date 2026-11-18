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
//   "A composed function is parameters and a body",
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
// expression applies what its function evaluates to.
//
// Arguments are evaluated when they are needed. A composed function is
// applied by putting its arguments, not yet evaluated, in place of its
// parameters in the body, and evaluating that. An argument is evaluated
// when something in the body needs its value, which in the end is a
// primitive function: a primitive function needs every argument, and
// runs when each is fully known. An argument is evaluated at most once,
// however often the body uses it, and in the scope where it was
// written. An argument nothing needs is never evaluated: an effect in it
// does not happen and a refutation in it marks nothing. No argument can
// be inspected: there is no value of an expression's kind that a
// function can look into.
//
// An effect happens when its value is needed. The statements of a body
// are a chain of `then`. A structure does not need its entries: each is
// evaluated when something reads it, at most once. A primitive function
// needs its arguments in full, left to right, so a structure handed to
// one has every entry evaluated first, in order. A caller of `evaluate`
// is given the value it asked for and no more: an entry of a structure
// in the result is evaluated when the caller evaluates it. There is no
// call for a whole value: a host that wants one evaluates the entries it
// reads. A function's free names are tied to the
// scope in which the function value is first evaluated, so a function
// means the same wherever it is later called.
//
// The kernel's own primitives, by name (chunk K4 fixed the list; fields
// and the questions about keys are not built yet):
//   "if"        if(condition, then, else). It needs its condition, which
//               must come to one of the kernel's two truth values, and
//               then only the branch taken. While the condition is
//               unknown the whole stays a residual and neither branch is
//               evaluated. A form that gives a branch more knowledge
//               makes the branch a function of the names its condition
//               tested, and applies it to values that carry the fact.
//   "claim"     claim(x). True records the outcome "decided". Anything
//               else fully known is a refutation. Unknown stays a residual.
//   "assume"    assume(x). Records the outcome "assumed" and does not
//               evaluate x. The record names the module whose code wrote
//               the call, from the mark on it. A claim that rests on an
//               assumption comes out assumed, never decided.
//   "undecided" undecided(reason). The answer of what decides a claim when
//               it cannot tell. A claim on it is done, with the outcome
//               "undecided" and that reason; it refutes nothing, and what
//               follows the claim goes ahead.
//   "describe"  describe(right, function). A description of the function,
//               as plain data. `right` is a key of the module that made
//               the function, or the inspection right. Where the function
//               holds an unforgeable value the description holds its
//               public identity only. A description is a program that
//               means the same: the bindings the function reads from a
//               block, and an argument used more than once and not yet
//               evaluated, are the bindings of a block around it.
//   "build"     build(description, names). The function a description
//               describes, which is a function or a block around one.
//               `names` is a structure keyed by symbols: the
//               value for each name the description leaves free. A free
//               name with no value is a refutation, so a built function
//               reads nothing from the place it is built. A refutation
//               too where the description holds the identity of an
//               unforgeable value: nothing makes authority from data, and
//               a live value is supplied under a name.
//   "block"     block(bindings, body). The bindings are a structure keyed
//               by symbols. They are one group, in a scope of their own:
//               each may use any other, and itself, so a recursive
//               function is one value. A binding's value is evaluated
//               when needed, at most once. The block's value is its
//               body's. No value of the language is or holds a scope.
//   "then"      then(first, second). It needs its first argument, and then
//               its value is the second. This is the one way a text's
//               order becomes an order of effects. While the first
//               waits, the second is evaluated ahead with no effect
//               performed, so a refutation in it is found at once.
//   "same"      same(a, b). Tells two bits values apart, or two symbols:
//               true where they are the same. Anything else is a
//               refutation; the kernel gives bits no other meaning.
//   "join"      join(a, b). The bits of a followed by the bits of b.
//   "length"    length(a). The number of bits, as 64 bits.
//   "slice"     slice(a, from, count). `count` bits of a from place
//               `from`, the first bit being place 0.
//   "get"       get(structure, key). The entry keyed by a symbol, or at a
//               place counted from 0, or keyed by a key. The entry may
//               itself still wait.
//   "put"       put(structure, key, value). A new structure: the old one with
//               the entry added at its end, or in place of the entry
//               already under that key. The key is a symbol, one of the
//               module's keys for a private entry, or the empty structure
//               for an entry with no key. The value is not evaluated.
//   "key"       key(structure, place). The key of the entry there: a
//               symbol, or the empty structure where it has none.
//   "kind"      kind(value). What a value is, as a symbol: bits, symbol,
//               structure, function or key.
//   "symbol"    symbol(text). The symbol of that name, as data.
//   "spelling"  spelling(symbol). The symbol's name, as text.
//   "refuse"    refuse(reason). A refutation with that reason, a text. It is
//               how code says why it will not go on, and what a withheld
//               capability is: a refusal that happens when it is used.
//   "count"     count(structure). The number of entries, as 64 bits.
//               A place or a count outside the value is a refutation.
//               An entry keyed by a key is private: only `get` with that
//               key reads it. It has no place, is not counted, and is
//               not handed to a primitive function.
//   "attempt"   attempt(x, budget). Evaluates its first argument under a
//               budget of steps and answers how that ended, as data: a
//               value, a refutation with its reason, or the limit
//               reached. A refutation inside marks nothing outside.
// The truth values are the bits of length one: 1 is true, 0 is false.
// There is no quotation, and no argument can be inspected. A symbol that
// is data comes from a description, from a cell or from a primitive
// function.
//
// A description is a structure whose first entry is a symbol naming its
// form, all in the names `description.*`:
//   bits <bits>            symbol <symbol>          name <symbol>
//   param <depth> <index>  apply <fn> <args>        function <count> <body>
//   structure <entries>    kernel <name>            primitive <hash>
//   capability <name> <part>   key <module> <slot>  unknown
//   opaque <params>: a part another module wrote; only the parameters of
//                    the described function that it mentions are listed
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
  Declaration,
  Advance, Cell, ClaimRecord, CreateKernel2, Entry, Kernel2, KeyDescription, Kind, Limits, Outcome, PrimitiveContext, PrimitiveDeclaration, Rest, Result, Scope,
  Value,
} from "./interface.js";
import { INTERFACE_VERSION, InterfaceError, KernelFault, Refusal } from "./interface.js";
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
/** Where a part of an expression was written: the module, and the function of it the part sits in. */
interface Mark {
  readonly module: string;
  readonly fn: Fn | undefined;
}
class Struct {
  /** Written by the kernel when a module is made or a function is built, and kept by every copy. */
  owner: Mark | undefined = undefined;
  constructor(readonly entries: ReadonlyArray<readonly [V | null, V]>) {}
}
class Expr {
  owner: Mark | undefined = undefined;
  /** For what is left of a claim: the claim as it was written. */
  site: Expr | undefined = undefined;
  constructor(readonly fn: V, readonly args: readonly V[]) {}
}
class Fn {
  owner: Mark | undefined = undefined;
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
/** A value with the outcome of a claim on it: decided, assumed, or undecided with the reason nothing could tell. */
class Decided {
  constructor(readonly inner: V, readonly rests: readonly Rest[], readonly outcome: "decided" | "assumed" | "undecided" = "decided", readonly reason?: string) {}
}
/**
 * An argument that has not been needed yet: an expression, the scope it
 * was written in, and, once it has been needed, its value. It is shared
 * by every use of the parameter, so it is evaluated at most once.
 */
class Lazy {
  done = false;
  rests: readonly Rest[] = [];
  constructor(public value: V, readonly scope: ScopeV) {}
}
/** A refutation. Whatever is computed from it is it. */
class Refuted {
  constructor(readonly reason: string, readonly about: V | undefined) {}
}

type V = Bits | Sym | Param | Struct | Expr | Fn | Prim | KernelPrim | CellV | NameRef | Quoted | Decided | Refuted | Key | Lazy;

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

const KERNEL_PRIMITIVES: ReadonlyArray<readonly [string, number]> = [
  ["assume", 1], ["attempt", 2], ["block", 2], ["build", 2], ["claim", 1], ["count", 1], ["describe", 2], ["get", 2], ["if", 3],
  ["join", 2], ["key", 2], ["kind", 1], ["length", 1], ["put", 3], ["refuse", 1], ["same", 2], ["slice", 3], ["spelling", 1],
  ["symbol", 1], ["then", 2], ["undecided", 1],
];
/** The module name under which the kernel makes the inspection right. No content hashes to it. */
const INSPECT = "kernel:inspect";

/** Creates a reference kernel. It does nothing until it is called. */
export const createKernel: CreateKernel2 = () => {
  const symbols = new Map<string, Sym>();
  const kernelPrims = new Map(KERNEL_PRIMITIVES.map(([name, arity]) => [name, new KernelPrim(name, arity)] as const));
  /** Structures and functions known to need no further evaluation. */
  const settled = new WeakSet<object>();
  /** Structures that have been evaluated: complete in shape, each entry a value or an entry not yet needed. */
  const built = new WeakSet<object>();
  /** A function with its free names tied to a scope, by function and scope. */
  const closed = new WeakMap<Fn, Map<ScopeV, Fn>>();
  const roots: Root[] = [];
  const rootOf = new WeakMap<object, Root>();
  /** Claims whose outcome was restored from a saved program, with what each rests on. */
  const restored = new WeakMap<Expr, readonly Rest[]>();
  const moduleIds = new WeakMap<Fn, string>();
  /** What each parameter of a module function is declared to be. */
  const moduleDeclares = new WeakMap<Fn, readonly Declaration[]>();
  /** The modules a value is an instance of. */
  /** The modules made in this kernel, by identity: what an import is supplied from. */
  const modulesById = new Map<string, Fn>();
  /** The instances of each module: one for each distinct set of arguments. */
  const instancesOf = new WeakMap<Fn, { args: readonly V[]; value: Lazy }[]>();
  /** The module a function was made in, for every function inside a module. */
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
  /** True while evaluating what follows something not yet done: no effect is performed there. */
  let ahead = false;
  /** The functions being opened while evaluating ahead. */
  const opening: Fn[] = [];

  const restKey = (r: Rest): string =>
    r.kind === "kernel" ? `kernel ${r.variant}` : r.kind === "primitive" ? `primitive ${r.hash}` : r.kind === "capability" ? `capability ${r.capability}.${r.part}` : r.kind === "assumption" ? `assumption ${r.by}` : r.kind === "limit" ? "limit" : `builder ${r.builder}`;
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
    x instanceof Decided || x instanceof Refuted || x instanceof Key || x instanceof Lazy;
  const into = (x: Value | null | undefined, what: string): V => {
    if (!isV(x)) throw new InterfaceError(`${what} is not a value of this kernel`);
    return x;
  };
  const scopeIn = (x: Scope | undefined, what: string): ScopeV => {
    if (!(x instanceof ScopeV)) throw new InterfaceError(`${what} is not a scope of this kernel`);
    return x;
  };

  /** Through a filled cell and an argument, to what is there now. */
  const through = (v: V): V => {
    for (;;) {
      if (v instanceof CellV && v.filled) v = v.value as V;
      else if (v instanceof Lazy) v = v.value;
      else return v;
    }
  };
  /** The value a handle stands for when it is read: through a filled cell, an argument, a quotation and an outcome. */
  const seen = (v: V): V => {
    for (;;) {
      v = through(v);
      if (v instanceof Quoted || v instanceof Decided) v = v.inner;
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
    if (v instanceof Lazy) return v.done && known(v.value);
    if (v instanceof CellV) return v.filled && known(v.value as V);
    if (v instanceof Struct) {
      // An evaluated structure is known: its shape is complete, whatever its entries still need.
      if (settled.has(v) || built.has(v)) return true;
      if (!v.entries.every(([, e]) => known(e))) return false;
      settled.add(v);
      return true;
    }
    return false; // a symbol, a name, a parameter, an expression
  };

  /** True for an entry keyed by a key: one only code that holds the key can reach. */
  const hidden = (k: V | null): boolean => k !== null && seen(k) instanceof Key;

  /** True when nothing in the value waits and no entry is left unevaluated: what a primitive function needs. */
  const knownInFull = (v: V): boolean => {
    if (v instanceof Decided) return knownInFull(v.inner);
    if (v instanceof Lazy) return v.done && knownInFull(v.value);
    if (v instanceof CellV) return v.filled && knownInFull(v.value as V);
    if (v instanceof Struct) {
      if (settled.has(v)) return true;
      // An entry keyed by a key is not handed to a primitive function, so it is not needed.
      if (!built.has(v) || !v.entries.every(([k, e]) => hidden(k) || knownInFull(e))) return false;
      if (!v.entries.some(([k]) => hidden(k))) settled.add(v);
      return true;
    }
    return known(v);
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
  /** The names a block of bindings binds, where the value is one; otherwise undefined. */
  const blockNames = (v: V): Sym[] | undefined => {
    if (!(v instanceof Expr) || !(v.fn instanceof KernelPrim) || v.fn.name !== "block" || v.args.length !== 2) return undefined;
    const bindings = v.args[0];
    if (!(bindings instanceof Struct)) return undefined;
    return bindings.entries.flatMap(([k]) => (k !== null && seen(k) instanceof Sym ? [seen(k) as Sym] : []));
  };

  /** A copy keeps the mark of what it was copied from: a part is its writer's wherever it goes. */
  const keep = (from: V, to: V): V => {
    if (to !== from && (to instanceof Expr || to instanceof Struct || to instanceof Fn) && to.owner === undefined && (from instanceof Expr || from instanceof Struct || from instanceof Fn))
      to.owner = from.owner;
    // What a copy or an evaluation leaves of a claim is still that claim, as written.
    if (to !== from && to instanceof Expr && from instanceof Expr && to.site === undefined && (from.site !== undefined || from.fn === kernelPrims.get("claim")))
      to.site = from.site ?? from;
    return to;
  };

  // ---- The claims of a call ------------------------------------------------
  //
  // One tally for each claim as written, however often it was evaluated.

  interface Tally { decided: number; assumed: number; undecided: number; refuted: number; reasons: Set<string>; rests: Map<string, Rest> }
  /** The tallies of the call of `evaluate` or `advance` now running. */
  let tallies = new Map<Expr, Tally>();
  /** How many evaluations of each written claim wait now, and which residuals they are. */
  const waitingAt = new Map<Expr, number>();
  const waitingClaims = new WeakSet<Expr>();
  const tallyOf = (site: Expr): Tally => {
    let t = tallies.get(site);
    if (t === undefined) tallies.set(site, (t = { decided: 0, assumed: 0, undecided: 0, refuted: 0, reasons: new Set(), rests: new Map() }));
    return t;
  };
  /** Records how one evaluation of a claim came out. `from` is what was evaluated: the claim, or what an earlier evaluation left of it. */
  const tallied = (from: Expr, result: V, rests: readonly Rest[]): V => {
    const site = from.site ?? from;
    const t = tallyOf(site);
    if (waitingClaims.has(from)) {
      waitingClaims.delete(from);
      waitingAt.set(site, (waitingAt.get(site) ?? 1) - 1);
    }
    if (result instanceof Refuted) {
      t.refuted++;
      t.reasons.add(result.reason);
    } else if (result instanceof Decided) {
      t[result.outcome]++;
      if (result.reason !== undefined) t.reasons.add(result.reason);
      for (const r of [...result.rests, ...rests]) t.rests.set(restKey(r), r);
    } else if (result instanceof Expr) {
      result.site = site;
      waitingClaims.add(result);
      waitingAt.set(site, (waitingAt.get(site) ?? 0) + 1);
    }
    return result;
  };
  const claimRecords = (): ClaimRecord[] =>
    [...tallies].map(([site, t]) => ({
      claim: out(site),
      ...(site.owner === undefined ? {} : { module: site.owner.module }),
      decided: t.decided,
      assumed: t.assumed,
      undecided: t.undecided,
      refuted: t.refuted,
      waiting: waitingAt.get(site) ?? 0,
      reasons: [...t.reasons],
      restsOn: [...t.rests.values()],
    }));

  /** The names in a value that no block around them binds, in the order met. */
  const freeNames = (v: V, bound: ReadonlySet<Sym>, found: Sym[], visited: Map<V, ReadonlySet<Sym>[]>): Sym[] => {
    if (v instanceof Sym) {
      if (!bound.has(v) && !found.includes(v)) found.push(v);
      return found;
    }
    if (v instanceof NameRef) {
      if (bindingOf(v) === undefined && !bound.has(v.sym) && !found.includes(v.sym)) found.push(v.sym);
      return found;
    }
    if (!(v instanceof Expr || v instanceof Struct || v instanceof Fn || v instanceof Lazy)) return found;
    const seenWith = visited.get(v) ?? [];
    if (seenWith.includes(bound)) return found;
    visited.set(v, [...seenWith, bound]);
    if (v instanceof Lazy) return v.done ? found : freeNames(v.value, bound, found, visited);
    if (v instanceof Fn) return freeNames(v.body, bound, found, visited);
    if (v instanceof Struct) {
      if (!settled.has(v)) v.entries.forEach(([, e]) => freeNames(e, bound, found, visited));
      return found;
    }
    const names = blockNames(v);
    const inner = names === undefined ? bound : new Set([...bound, ...names]);
    freeNames(v.fn, bound, found, visited);
    v.args.forEach((a) => freeNames(a, inner, found, visited));
    return found;
  };

  /** A value with each free name replaced by the value supplied for it. */
  const supply = (v: V, values: ReadonlyMap<Sym, V>, bound: ReadonlySet<Sym>): V => keep(v, supplied(v, values, bound));
  const supplied = (v: V, values: ReadonlyMap<Sym, V>, bound: ReadonlySet<Sym>): V => {
    if (v instanceof Sym) return bound.has(v) ? v : (values.get(v) ?? v);
    if (v instanceof Fn) {
      const body = supply(v.body, values, bound);
      return body === v.body ? v : new Fn(v.params, body);
    }
    if (v instanceof Struct) {
      if (settled.has(v)) return v;
      const entries = v.entries.map(([k, e]) => [k, supply(e, values, bound)] as const);
      return entries.some(([, e], i) => e !== v.entries[i][1]) ? new Struct(entries) : v;
    }
    if (!(v instanceof Expr)) return v;
    const names = blockNames(v);
    const inner = names === undefined ? bound : new Set([...bound, ...names]);
    const fn = supply(v.fn, values, bound);
    const args = v.args.map((a) => supply(a, values, inner));
    return fn !== v.fn || args.some((a, i) => a !== v.args[i]) ? new Expr(fn, args) : v;
  };

  const tie = (v: V, scope: ScopeV, memo: Map<V, V>, skip?: ReadonlySet<Sym>): V => {
    const done = memo.get(v);
    if (done !== undefined) return done;
    if (v instanceof Expr && restored.has(v)) return v;
    let r: V = v;
    if (v instanceof Sym) r = skip?.has(v) ? v : new NameRef(scope, v);
    else if (v instanceof Expr) {
      // The names a block binds are its own: they are tied when the block is evaluated.
      const names = blockNames(v);
      const inner = names === undefined ? skip : new Set([...(skip ?? []), ...names]);
      const within = names === undefined ? memo : new Map<V, V>();
      const fn = tie(v.fn, scope, memo, skip);
      const args = v.args.map((a) => tie(a, scope, within, inner));
      if (fn !== v.fn || args.some((a, i) => a !== v.args[i])) r = new Expr(fn, args);
    } else if (v instanceof Struct && !settled.has(v)) {
      const entries = v.entries.map(([k, e]) => [k, tie(e, scope, memo, skip)] as const);
      if (entries.some(([, e], i) => e !== v.entries[i][1])) r = new Struct(entries);
    } else if (v instanceof Fn && !settled.has(v)) {
      const body = tie(v.body, scope, memo, skip);
      r = body === v.body ? v : new Fn(v.params, body);
      // A function written inside a block may use the block's names, which are tied when
      // the block is evaluated; until then it is not finished.
      if (skip === undefined || skip.size === 0) settled.add(r);
    }
    keep(v, r);
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
        // A key slot written as an entry's key takes the module's key, as it does anywhere else.
        const entries = v.entries.map(([k, e]) => [k instanceof Param ? (env.get(k) ?? k) : k, substitute(e, env, memo)] as const);
        if (entries.some(([k, e], i) => e !== v.entries[i][1] || k !== v.entries[i][0])) r = new Struct(entries);
      }
    } else {
      const body = substitute(v.body, env, memo);
      if (body !== v.body) {
        r = new Fn(v.params, body);
        if (settled.has(v)) settled.add(r);
      }
    }
    keep(v, r);
    memo.set(v, r);
    return r;
  };

  // ---- Evaluation ---------------------------------------------------------

  const step = (): void => {
    if (spent >= budget) throw new LimitReached();
    spent++;
  };
  /** Charges work on bits: one step for each 64 bits handled, beyond the step of the call itself. */
  const charge = (bits: number): void => {
    const steps = Math.floor(bits / 64);
    if (steps === 0) return;
    if (spent + steps > budget) {
      spent = budget;
      throw new LimitReached();
    }
    spent += steps;
  };

  const context: PrimitiveContext = {
    bits: (bytes, bitLength) => out(new Bits(bytes, bitLength ?? bytes.length * 8)),
    symbol: (fqn) => out(new Quoted(intern(fqn))),
    structure: (entries) => out(asData(new Struct(entries.map(([k, e]) => [k === null ? null : into(k, "a key"), into(e, "an entry")] as const)), "a structure a primitive builds")),
    kind: (v) => kindOf(into(v, "the value")),
    bitsOf: (v) => bitsOf(into(v, "the value")),
    symbolName: (v) => symbolName(into(v, "the value")),
    entriesOf: (v) => entriesOf(into(v, "the value"), true),
    cell: () => out(new CellV(running)) as Cell,
  };

  /** What an evaluation leaves in place of a part is that part's writer's: a residual keeps its mark. */
  const evaluate = (v: V, scope: ScopeV): V => keep(v, evaluated(v, scope));
  const evaluated = (v: V, scope: ScopeV): V => {
    if (v instanceof Sym) return evaluate(new NameRef(scope, v), scope);
    if (v instanceof NameRef) {
      const found = bindingOf(v);
      if (found === undefined) return new Refuted(`the name ${v.sym.fqn} is bound by no block around it`, undefined);
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
    if (v instanceof Lazy) {
      if (v.done) {
        v.rests.forEach(rest);
        return v.value;
      }
      const { value: r, rests } = collecting(() => evaluate(v.value, v.scope));
      rests.forEach(rest);
      v.rests = [...v.rests, ...rests];
      v.value = r;
      if (r instanceof Refuted || known(r)) {
        v.done = true;
        return r;
      }
      return v; // It still waits. It stays one thing, so whatever is left in it is done once.
    }
    if (v instanceof Struct) {
      // A structure does not need its entries. Each is kept as written, tied to this scope,
      // and is evaluated when something reads it, at most once.
      if (settled.has(v) || built.has(v)) return v;
      const r = new Struct(v.entries.map(([k, e]) => [k, later(e, scope)] as const));
      built.add(r);
      return r;
    }
    if (!(v instanceof Expr)) return v; // bits, a parameter, a primitive, a quotation, an outcome, a refutation

    const stored = restored.get(v);
    if (stored !== undefined) {
      stored.forEach(rest);
      return tallied(v, new Decided(TRUE, stored), []);
    }
    step();
    const fn = evaluate(v.fn, scope);
    if (fn instanceof Refuted) return fn;

    if (fn instanceof KernelPrim) {
      if (v.args.length !== fn.arity) return new Refuted(`"${fn.name}" takes ${fn.arity} argument(s) and was given ${v.args.length}`, undefined);
      if (fn.name === "claim") {
        const { value: claimed, rests } = collecting(() => evaluate(v.args[0], scope));
        rests.forEach(rest);
        if (claimed instanceof Refuted) return tallied(v, claimed, rests);
        // What decides the claim answered that it cannot tell: the claim is done, and undecided.
        const told = through(claimed);
        if (told instanceof Decided && told.outcome === "undecided") return tallied(v, new Decided(told.inner, [{ kind: "kernel", variant: VARIANT }, ...rests], "undecided", told.reason), rests);
        if (truthOf(claimed) === true) {
          // A claim that rests on an assumption is no stronger than assumed.
          const assumed = rests.some((r) => r.kind === "assumption");
          return tallied(v, new Decided(seen(claimed), [{ kind: "kernel", variant: VARIANT }, ...rests], assumed ? "assumed" : "decided"), rests);
        }
        if (known(claimed)) return tallied(v, new Refuted("a claim that is not true", claimed), rests);
        return tallied(v, new Expr(fn, [claimed]), rests);
      }
      if (fn.name === "assume") {
        // The claim is not evaluated. The record says who assumed it: the module whose code this is.
        const by: Rest = { kind: "assumption", by: v.owner?.module ?? "" };
        rest(by);
        return new Decided(TRUE, [by], "assumed");
      }
      if (fn.name === "if") {
        // The condition is needed; a branch is needed only if it is the one taken.
        const condition = evaluate(v.args[0], scope);
        if (condition instanceof Refuted) return condition;
        const truth = truthOf(condition);
        if (truth === true) return evaluate(v.args[1], scope);
        if (truth === false) return evaluate(v.args[2], scope);
        if (known(condition)) return new Refuted("a condition that is neither true nor false", condition);
        return new Expr(fn, [condition, later(v.args[1], scope), later(v.args[2], scope)]);
      }
      if (fn.name === "block") {
        // The bindings are one group in a scope of their own: each may use any other, and
        // itself. A binding's value is evaluated when something needs it, at most once.
        const bindings = v.args[0];
        if (!(bindings instanceof Struct)) return new Refuted("a block's bindings are written as a structure", undefined);
        const inner = new ScopeV(scope);
        for (const [k, e] of bindings.entries) {
          const name = k === null ? undefined : seen(k);
          if (!(name instanceof Sym)) return new Refuted("each binding of a block is keyed by a symbol", undefined);
          if (inner.bindings.has(name)) return new Refuted(`the name ${name.fqn} is bound twice in one block`, undefined);
          inner.bindings.set(name, { value: e instanceof Fn || !(e instanceof Expr || e instanceof Sym || e instanceof Struct) ? e : new Lazy(e, inner), memo: undefined, rests: [] });
        }
        return evaluate(v.args[1], inner);
      }
      if (fn.name === "put") {
        // A new structure: the old one with this entry added at its end, or put in place of the
        // entry already under that key. The value is not evaluated: an entry is evaluated when read.
        const [target, k] = [evaluate(v.args[0], scope), evaluate(v.args[1], scope)];
        if (target instanceof Refuted) return target;
        if (k instanceof Refuted) return k;
        const s = seen(target);
        if (!(s instanceof Struct)) return known(target) ? new Refuted("only a structure can be given an entry", target) : new Expr(fn, [target, k, later(v.args[2], scope)]);
        if (!known(k)) return new Expr(fn, [target, k, later(v.args[2], scope)]);
        const key = seen(k);
        const none = key instanceof Struct && key.entries.length === 0;
        if (!none && !(key instanceof Sym) && !(key instanceof Key)) return new Refuted("an entry's key is a symbol, a key, or the empty structure for none", k);
        charge(s.entries.length);
        const value = later(v.args[2], scope);
        const at = none ? -1 : s.entries.findIndex(([x]) => x !== null && seen(x) === key);
        const entries = at < 0 ? [...s.entries, [none ? null : (key as V), value] as const] : s.entries.map((e, i) => (i === at ? ([e[0], value] as const) : e));
        const made = new Struct(entries);
        built.add(made);
        return made;
      }
      if (fn.name === "then") {
        // The first is needed, and only then the second. While the first waits, the second
        // is evaluated ahead with no effect performed, so a refutation in it is found now.
        const first = evaluate(v.args[0], scope);
        if (first instanceof Refuted) return first;
        if (known(first)) return evaluate(v.args[1], scope);
        const before = ahead;
        ahead = true;
        let second: V;
        try {
          second = evaluate(v.args[1], scope);
        } finally {
          ahead = before;
        }
        if (second instanceof Refuted) return second;
        return new Expr(fn, [first, second instanceof Lazy || !(second instanceof Expr || second instanceof NameRef) ? second : later(second, scope)]);
      }
      if (fn.name === "attempt") {
        // The budget is needed; what is attempted is evaluated inside the attempt.
        const steps = evaluate(v.args[1], scope);
        if (steps instanceof Refuted) return steps;
        const budgetBits = seen(steps);
        if (!known(steps)) return new Expr(fn, [later(v.args[0], scope), steps]);
        if (!(budgetBits instanceof Bits)) return new Refuted("an attempt's budget is a number of steps, as bits", steps);
        const outer = budget;
        budget = Math.min(outer, spent + numberOf(budgetBits));
        let r: V;
        try {
          r = evaluate(v.args[0], scope);
        } catch (e) {
          // The attempt's own budget ran out, or the kernel's own limit was reached inside it:
          // either way the answer is "limit", and what goes on from it rests on a limit.
          if ((e instanceof LimitReached && spent < outer) || e instanceof RangeError) {
            rest({ kind: "limit" });
            return data("limit");
          }
          throw e;
        } finally {
          budget = outer;
        }
        if (r instanceof Refuted) return data("refuted", text(r.reason));
        if (known(r)) return data("value", r);
        // It waits on something. What is left is attempted again, so nothing done so far is done twice.
        return new Expr(fn, [r, steps]);
      }
      const args: V[] = [];
      for (const a of v.args) {
        const r = evaluate(a, scope);
        if (r instanceof Refuted) return r;
        args.push(r);
      }
      const waits = (): V => new Expr(fn, args);
      if (fn.name === "describe") {
        const [right, f] = [seen(args[0]), args[1]];
        if (!known(right) || !known(f)) return waits();
        if (!(right instanceof Key)) return new Refuted("describing a function needs a key or the inspection right", right);
        if (!(f instanceof Fn)) return new Refuted("only a function can be described", f);
        const all = right.module === INSPECT;
        if (!all && f.owner?.module !== right.module)
          return new Refuted("describing a function needs a key of the module that made it, or the inspection right", undefined);
        return describeWhole(f, all ? undefined : right.module);
      }
      if (fn.name === "build") {
        // A description is read whole, so it is needed in full.
        const description = inFull(args[0], scope);
        if (description instanceof Refuted) return description;
        if (!knownInFull(description)) return waits();
        const built = build(description, []);
        if (built instanceof Refuted) return built;
        // A function, or a block around one: the bindings the function reads, each evaluated at most once.
        const blockOf = built instanceof Expr && built.fn === kernelPrims.get("block") && built.args.length === 2 && built.args[1] instanceof Fn;
        if (!(built instanceof Fn) && !blockOf) return new Refuted("only the description of a function can be built", args[0]);
        // A built function reads nothing from where it is built: each name the description
        // leaves free takes the value supplied for it, and one with no value is refused.
        const supplied = seen(args[1]);
        if (!(supplied instanceof Struct)) return known(args[1]) ? new Refuted("the names supplied to build are a structure keyed by symbols", args[1]) : waits();
        const values = new Map<Sym, V>();
        for (const [k, e] of supplied.entries) {
          const name = k === null ? undefined : seen(k);
          if (!(name instanceof Sym)) return new Refuted("the names supplied to build are a structure keyed by symbols", args[1]);
          values.set(name, e);
        }
        const whole = supply(built, values, new Set());
        const missing = freeNames(whole, new Set(), [], new Map());
        if (missing.length > 0) return new Refuted(`the description leaves ${missing.map((m) => m.fqn).join(", ")} free, and no value was supplied`, undefined);
        // What is built is the builder's: it takes the mark of the code that called `build`.
        if (v.owner !== undefined) markAll(whole, v.owner.module, v.owner.fn, new Set());
        return whole instanceof Fn ? close(whole, scope) : evaluate(whole, scope);
      }
      if (fn.name === "same") {
        if (!known(args[0]) || !known(args[1])) return waits();
        const [a, b] = [seen(args[0]), seen(args[1])];
        if (a instanceof Bits && b instanceof Bits) {
          if (a.bitLength !== b.bitLength) return FALSE;
          charge(a.bitLength);
          if (whole(a) && whole(b)) return a.bytes.every((x, i) => x === b.bytes[i]) ? TRUE : FALSE;
          const [x, y] = [bitList(a), bitList(b)];
          return x.every((bit, i) => bit === y[i]) ? TRUE : FALSE;
        }
        if (a instanceof Sym && b instanceof Sym) return a === b ? TRUE : FALSE;
        return new Refuted("only two bits values or two symbols can be told apart", undefined);
      }
      if (fn.name === "join") {
        if (!known(args[0]) || !known(args[1])) return waits();
        const [a, b] = [seen(args[0]), seen(args[1])];
        if (!(a instanceof Bits && b instanceof Bits)) return new Refuted("only two bits values can be joined", undefined);
        charge(a.bitLength + b.bitLength);
        if (whole(a) && whole(b)) {
          const bytes = new Uint8Array(a.bytes.length + b.bytes.length);
          bytes.set(a.bytes, 0);
          bytes.set(b.bytes, a.bytes.length);
          return new Bits(bytes, bytes.length * 8);
        }
        return packed([...bitList(a), ...bitList(b)]);
      }
      if (fn.name === "length") {
        if (!known(args[0])) return waits();
        const a = seen(args[0]);
        return a instanceof Bits ? count64(a.bitLength) : new Refuted("only a bits value has a length", args[0]);
      }
      if (fn.name === "slice") {
        if (!args.every(known)) return waits();
        const [a, from, n] = [seen(args[0]), countOf(args[1]), countOf(args[2])];
        if (!(a instanceof Bits)) return new Refuted("only a bits value can be taken apart", args[0]);
        if (from === undefined || n === undefined) return new Refuted("a place and a count are whole numbers, as bits", undefined);
        if (from + n > a.bitLength) return new Refuted(`${n} bit(s) from place ${from} is outside a value of ${a.bitLength} bit(s)`, undefined);
        if (whole(a) && from % 8 === 0 && n % 8 === 0) {
          charge(n);
          return new Bits(a.bytes.slice(from / 8, (from + n) / 8), n);
        }
        charge(a.bitLength);
        return packed(bitList(a).slice(from, from + n));
      }
      if (fn.name === "undecided") {
        if (!known(args[0])) return waits();
        const reason = seen(args[0]);
        if (!(reason instanceof Bits) || reason.bitLength % 8 !== 0) return new Refuted("the reason nothing could tell is a text", args[0]);
        return new Decided(new Bits(new Uint8Array(0), 0), [], "undecided", textOf(reason));
      }
      if (fn.name === "refuse") {
        if (!known(args[0])) return waits();
        const reason = seen(args[0]);
        return reason instanceof Bits && reason.bitLength % 8 === 0 ? new Refuted(textOf(reason), undefined) : new Refuted("a refusal's reason is a text", args[0]);
      }
      if (fn.name === "key") {
        const s = seen(args[0]);
        if (!(s instanceof Struct)) return known(args[0]) ? new Refuted("only a structure has entries with keys", args[0]) : waits();
        if (!known(args[1])) return waits();
        const place = countOf(args[1]);
        if (place === undefined) return new Refuted("a place is a whole number, as bits", args[1]);
        const open = s.entries.filter(([k]) => !hidden(k));
        if (place >= open.length) return new Refuted(`place ${place} is outside a structure of ${open.length} entr${open.length === 1 ? "y" : "ies"}`, undefined);
        const k = open[place][0];
        return k === null ? list([]) : new Quoted(seen(k) as Sym);
      }
      if (fn.name === "kind") {
        if (!known(args[0])) return waits();
        const x = seen(args[0]);
        const name = x instanceof Bits ? "bits" : x instanceof Sym ? "symbol" : x instanceof Struct ? "structure" : x instanceof Key ? "key" : x instanceof Fn || x instanceof Prim || x instanceof KernelPrim ? "function" : undefined;
        return name === undefined ? new Refuted("a value of no kind a program can hold", args[0]) : new Quoted(intern(name));
      }
      if (fn.name === "symbol") {
        if (!known(args[0])) return waits();
        const t = seen(args[0]);
        if (!(t instanceof Bits) || !whole(t) || t.bitLength === 0) return new Refuted("a symbol is made from a text that is not empty", args[0]);
        return new Quoted(intern(textOf(t)));
      }
      if (fn.name === "spelling") {
        if (!known(args[0])) return waits();
        const x = seen(args[0]);
        return x instanceof Sym ? text(x.fqn) : new Refuted("only a symbol has a spelling", args[0]);
      }
      if (fn.name === "count") {
        const s = seen(args[0]);
        // An entry keyed by a key has no place and is not counted.
        if (s instanceof Struct) return count64(s.entries.filter(([k]) => !hidden(k)).length);
        return known(args[0]) ? new Refuted("only a structure has a number of entries", args[0]) : waits();
      }
      if (fn.name === "get") {
        const s = seen(args[0]);
        if (!(s instanceof Struct)) return known(args[0]) ? new Refuted("only a structure has entries to read", args[0]) : waits();
        if (!known(args[1])) return waits();
        const key = seen(args[1]);
        if (key instanceof Sym) {
          const entry = s.entries.find(([k]) => k !== null && seen(k) === key);
          return entry !== undefined ? evaluate(entry[1], scope) : new Refuted(`the structure has no entry keyed ${key.fqn}`, undefined);
        }
        if (key instanceof Key) {
          // A private entry: only this key reads it, and without it nothing tells that it is there.
          const entry = s.entries.find(([k]) => k !== null && seen(k) === key);
          return entry !== undefined ? evaluate(entry[1], scope) : new Refuted("the structure has no entry under that key", undefined);
        }
        const place = key instanceof Bits ? countOf(key) : undefined;
        if (place === undefined) return new Refuted("an entry is read by a symbol, by a place or by a key", args[1]);
        const open = s.entries.filter(([k]) => !hidden(k));
        return place < open.length ? evaluate(open[place][1], scope) : new Refuted(`place ${place} is outside a structure of ${open.length} entr${open.length === 1 ? "y" : "ies"}`, undefined);
      }
      throw new KernelFault(`the kernel primitive "${fn.name}" has no evaluation`);
    }

    if (fn instanceof Fn) {
      // A composed function's arguments are not evaluated here. Each goes into the body as
      // it was written, and is evaluated when something in the body needs it.
      const identity = moduleIds.get(fn);
      if (identity !== undefined) {
        // Calling a module function instantiates it. It is handed its capabilities and inputs;
        // the kernel supplies each module it imports, by the identity declared, so nobody can
        // connect it to another. The module instantiates its imports itself, in its body.
        const declares = moduleDeclares.get(fn);
        const handed = fn.params.map((_, i) => i).filter((i) => declares === undefined || declares[i].role !== "module");
        if (handed.length !== v.args.length)
          return new Refuted(`a module of ${handed.length} capability and input parameter(s) was given ${v.args.length} argument(s)`, undefined);
        const args: V[] = [];
        handed.forEach((i, j) => (args[i] = later(v.args[j], scope)));
        for (let i = 0; i < fn.params.length; i++) {
          const d = declares?.[i];
          if (d === undefined || d.role !== "module") continue;
          const imported = d.identity === undefined ? undefined : modulesById.get(d.identity);
          if (imported === undefined) return new Refuted(`the module ${d.name}, which it imports, is not loaded`, undefined);
          args[i] = imported;
        }
        // One instance for each distinct set of arguments: its statements happen once.
        const all = instancesOf.get(fn) ?? [];
        let instance = all.find((x) => x.args.every((a, i) => sameInformation(a, args[i])));
        if (instance === undefined) {
          instance = { args, value: new Lazy(substitute(fn.body, new Map(fn.params.map((p, i) => [p, args[i]] as const)), new Map()), scope) };
          instancesOf.set(fn, [...all, instance]);
        }
        return evaluate(instance.value, scope);
      }
      if (fn.params.length !== v.args.length)
        return new Refuted(`a function of ${fn.params.length} parameter(s) was given ${v.args.length} argument(s)`, undefined);
      const given = v.args.map((a) => {
        const l = later(a, scope);
        // An argument that is one step of work on values already known is evaluated now: a
        // loop's counter or total then never grows into a chain of work put off. It has no
        // effect, and a refutation it comes to is held until something needs the argument.
        if (l instanceof Lazy && oneStep(l.value)) collecting(() => evaluate(l, scope));
        return l;
      });
      const env = new Map(fn.params.map((p, i) => [p, given[i]] as const));
      if (!ahead) return evaluate(substitute(fn.body, env, new Map()), scope);
      // Ahead of what is done, a function already being opened ahead is not opened again,
      // whatever it is given: the call stays in the residual. Evaluation ahead only finds a
      // refutation early, and a loop that carries state would otherwise never end.
      if (opening.includes(fn)) return new Expr(fn, given);
      opening.push(fn);
      try {
        return evaluate(substitute(fn.body, env, new Map()), scope);
      } finally {
        opening.pop();
      }
    }
    if (!(fn instanceof Prim)) {
      if (known(fn)) return new Refuted("a call on something that is not a function", fn);
      return new Expr(fn, v.args.map((a) => later(a, scope)));
    }
    // A primitive function needs every argument, in full and left to right: its host code
    // cannot evaluate, so a structure it is handed has every entry evaluated first.
    // Once one argument waits, those after it are evaluated ahead with no effect performed,
    // so the effects of two arguments never happen out of the order written.
    const args: V[] = [];
    const before = ahead;
    try {
      for (const a of v.args) {
        const r = inFull(a, scope);
        if (r instanceof Refuted) return r;
        if (!knownInFull(r)) ahead = true;
        args.push(r);
      }
    } finally {
      ahead = before;
    }
    {
      if (fn.declaration.arity !== args.length)
        return new Refuted(`a primitive of ${fn.declaration.arity} parameter(s) was given ${args.length} argument(s)`, undefined);
      if (!args.every(knownInFull)) return new Expr(fn, args);
      const d = fn.declaration;
      if (ahead && d.purity === "effectful") return new Expr(fn, args);
      const what: Rest = d.purity === "pure" ? { kind: "primitive", hash: d.hash, name: d.name } : { kind: "capability", capability: d.capability, part: d.part };
      rest(what);
      const before = running;
      running = d.purity === "effectful" ? what : undefined;
      let r: V;
      try {
        r = into(d.run(args.map(out), context), "what a primitive returned");
      } catch (e) {
        if (e instanceof Refusal) return new Refuted(e.reason, undefined);
        throw e;
      } finally {
        running = before;
      }
      return r instanceof CellV ? r : asData(r, "what a primitive returned");
    }
  };

  /** A value with every entry of every structure in it evaluated, in order. A refutation inside is the whole's. */
  const inFull = (v: V, scope: ScopeV): V => {
    const r = evaluate(v, scope);
    if (r instanceof Refuted) return r;
    const s = seen(r);
    if (s instanceof Struct && !settled.has(s)) {
      // Once one entry waits, those after it are evaluated ahead with no effect performed.
      const before = ahead;
      try {
        for (const [k, e] of s.entries) {
          if (hidden(k)) continue;
          step(); // a structure handed over whole costs a step for each entry
          const x = inFull(e, scope);
          if (x instanceof Refuted) return x;
          if (!knownInFull(x)) ahead = true;
        }
      } finally {
        ahead = before;
      }
    }
    return r;
  };

  /**
   * An argument as it is handed on without being evaluated: tied to the
   * scope it was written in, and shared, so it is evaluated at most once
   * and means there what it meant here. What needs no evaluation is
   * handed on as it is.
   */
  /** The kernel's primitives that compute on data and do nothing else. */
  const ONE_STEP = new Set(["join", "length", "slice", "same", "count", "kind", "key", "symbol", "spelling"]);
  /** True for a pure primitive function, or such a kernel primitive, applied to values already known. */
  const oneStep = (e: V): boolean =>
    e instanceof Expr &&
    ((e.fn instanceof Prim && e.fn.declaration.purity === "pure") || (e.fn instanceof KernelPrim && ONE_STEP.has(e.fn.name))) &&
    e.args.every((a) => !(a instanceof Expr || a instanceof NameRef || a instanceof Sym) && knownInFull(a));

  const later = (a: V, scope: ScopeV): V => {
    const tied = tie(a, scope, new Map());
    return tied instanceof Expr || tied instanceof NameRef || (tied instanceof Struct && !settled.has(tied) && !built.has(tied)) ? new Lazy(tied, scope) : tied;
  };

  /** True where two arguments carry the same information: the same thing, or the same known bits. */
  const sameInformation = (a: V, b: V): boolean => {
    const [x, y] = [seen(a), seen(b)];
    if (x === y) return true;
    return x instanceof Bits && y instanceof Bits && x.bitLength === y.bitLength && bitList(x).every((bit, i) => bit === bitList(y)[i]);
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
    } else if (v instanceof Expr) {
      waitsOn(v.fn, found, visited);
      v.args.forEach((a) => waitsOn(a, found, visited));
    } else if (v instanceof Struct) {
      if (!settled.has(v)) v.entries.forEach(([, e]) => waitsOn(e, found, visited));
    } else if (v instanceof Decided) waitsOn(v.inner, found, visited);
    else if (v instanceof Lazy) waitsOn(v.value, found, visited);
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
  const entriesOf = (v: V, forPrimitive = false): readonly Entry[] => {
    const s = seen(v);
    if (s instanceof Refuted) return [];
    if (s instanceof Key) {
      const slot = Uint8Array.of(s.slot >>> 24, (s.slot >>> 16) & 255, (s.slot >>> 8) & 255, s.slot & 255);
      return [[null, out(new Bits(utf8.encode(s.module), s.module.length * 8))], [null, out(new Bits(slot, 32))]];
    }
    if (!(s instanceof Struct)) return wrong("entriesOf", v);
    // A primitive function's host code is not handed an entry keyed by a key.
    return s.entries.filter(([k]) => !forPrimitive || !hidden(k)).map(([k, e]) => [k === null ? null : out(k), out(e)] as const);
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
    else if (v instanceof Lazy) return contentOf(v.value, binders, memo);
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

  /** Marks every part that has no mark yet with a module and the function it sits in. */
  const markAll = (v: V, module: string, within: Fn | undefined, visited: Set<V>): void => {
    if (visited.has(v)) return;
    visited.add(v);
    if (v instanceof Fn) {
      if (v.owner === undefined) v.owner = { module, fn: within };
      markAll(v.body, module, v, visited);
    } else if (v instanceof Expr) {
      if (v.owner === undefined) v.owner = { module, fn: within };
      markAll(v.fn, module, within, visited);
      v.args.forEach((a) => markAll(a, module, within, visited));
    } else if (v instanceof Struct) {
      if (v.owner === undefined && !settled.has(v)) v.owner = { module, fn: within };
      v.entries.forEach(([, e]) => markAll(e, module, within, visited));
    }
  };

  /** A module's identity: its function's content and what each parameter after the key slots is declared to be. */
  const identityOf = (f: Fn, declares: readonly Declaration[] | undefined): string => {
    const declared = declares === undefined ? "undeclared" : declares.map((d) => `${d.role} ${JSON.stringify(d.name)} ${d.identity ?? "-"}`).join("|");
    return `sha256:${sha256Text(`module ${contentOf(f, [], new Map()).digest} ${declared}`)}`;
  };
  const declarationsFor = (f: Fn, keyCount: number | undefined, declares: readonly Declaration[] | undefined, what: string): void => {
    if (declares === undefined) return;
    if (keyCount !== undefined && declares.length !== f.params.length - keyCount) throw new InterfaceError(`${what}: there is not one declaration for each parameter after the key slots`);
    if (declares.length > f.params.length) throw new InterfaceError(`${what}: there are more declarations than parameters`);
    for (const d of declares) {
      if (!["capability", "input", "module"].includes(d.role) || typeof d.name !== "string") throw new InterfaceError(`${what}: a declaration is not {role, name}`);
      if (d.identity !== undefined && (d.role !== "module" || !/^sha256:[0-9a-f]{64}$/.test(d.identity))) throw new InterfaceError(`${what}: only a module is declared with an identity, as sha256: and 64 hex digits`);
    }
  };

  /**
   * Refuses a claim that has something unknown under it: a stored outcome is what any kernel
   * would compute only where the claim's value depends on nothing a call supplies.
   */
  const closedFor = (claim: Expr, within: Fn, declares: readonly Declaration[] | undefined): void => {
    const fixed = new Set<Param>();
    const keyCount = declares === undefined ? 0 : within.params.length - declares.length;
    within.params.forEach((p, i) => {
      if (declares !== undefined && (i < keyCount || declares[i - keyCount].role === "module")) fixed.add(p);
    });
    const walk = (v: V, own: ReadonlySet<Param>, visited: Set<V>): void => {
      if (v instanceof Param) {
        if (!own.has(v) && !fixed.has(v)) throw new InterfaceError(`restore: the claim depends on the parameter ${v.name}; only a claim with nothing unknown under it is restored`);
        return;
      }
      if (v instanceof CellV) throw new InterfaceError("restore: the claim depends on a cell; only a claim with nothing unknown under it is restored");
      if (visited.has(v)) return;
      visited.add(v);
      if (v instanceof Fn) walk(v.body, new Set([...own, ...v.params]), new Set());
      else if (v instanceof Expr) [v.fn, ...v.args].forEach((x) => walk(x, own, visited));
      else if (v instanceof Struct) v.entries.forEach(([, e]) => walk(e, own, visited));
      else if (v instanceof Lazy) walk(v.value, own, visited);
    };
    walk(claim, new Set(), new Set());
  };

  /** The key of a claim's outcome: its content, the identity of the module it sits in, and what it rests on. */
  const claimKey = (claim: V, within: V, restsOn: readonly Rest[], declares?: readonly Declaration[]): string => {
    if (!(claim instanceof Expr) || claim.fn !== kernelPrims.get("claim") || claim.args.length !== 1)
      throw new InterfaceError("not an application of the kernel's claim primitive");
    if (!(within instanceof Fn)) throw new InterfaceError("the claim's function is not a composed function");
    const binders = enclosing(claim, within, [], new Set());
    if (binders === undefined) throw new InterfaceError("the claim is not inside that function");
    const grounds = restsOn.filter((r) => r.kind !== "builder").map(restKey).sort();
    declarationsFor(within, undefined, declares, "claimKey");
    const memo = new Map<V, string>();
    return `sha256:${sha256Text(`outcome ${identityOf(within, declares)} ${contentOf(claim, binders, memo).digest} ${grounds.join("|")}`)}`;
  };

  // ---- Descriptions -------------------------------------------------------

  const text = (t: string): V => new Bits(utf8.encode(t), utf8.encode(t).length * 8);
  const number = (n: number): V => new Bits(Uint8Array.of(n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255), 32);
  const numberOf = (b: Bits): number => b.bytes.reduce((n, byte) => (n * 256 + byte) % 0x100000000, 0);
  /** The bits of a value, one number each: the last `bitLength` bits of its bytes. */
  const bitList = (b: Bits): number[] => {
    const all: number[] = [];
    for (const byte of b.bytes) for (let i = 7; i >= 0; i--) all.push((byte >> i) & 1);
    return all.slice(all.length - b.bitLength);
  };
  /** A bits value from its bits, held in as few bytes as hold them. */
  /** True where a bits value is whole bytes, so it can be handled a byte at a time. */
  const whole = (b: Bits): boolean => b.bitLength === b.bytes.length * 8;
  const packed = (bits: readonly number[]): V => {
    const bytes = new Uint8Array(Math.ceil(bits.length / 8));
    const pad = bytes.length * 8 - bits.length;
    bits.forEach((bit, i) => { if (bit) bytes[(i + pad) >> 3] |= 128 >> ((i + pad) & 7); });
    return new Bits(bytes, bits.length);
  };
  /** A count as the kernel answers one: 64 bits, most significant first. */
  const count64 = (n: number): V => packed(Array.from({ length: 64 }, (_, i) => (i < 11 ? 0 : Math.floor(n / 2 ** (63 - i)) % 2)));
  /** A whole number read from bits, or undefined where the value is not bits or is too large to count with. */
  const countOf = (v: V): number | undefined => {
    const b = seen(v);
    if (!(b instanceof Bits)) return undefined;
    const n = bitList(b).reduce((acc, bit) => acc * 2 + bit, 0);
    return Number.isSafeInteger(n) ? n : undefined;
  };
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
    if (v instanceof NameRef) {
      const found = bindingOf(v);
      if (found === undefined) return data("name", new Quoted(v.sym));
      const name = showing?.names.get(found.binding);
      return name !== undefined ? data("name", new Quoted(name)) : describe(boundValue(found), binders, own);
    }
    if (v instanceof Decided) return describe(v.inner, binders, own);
    if (v instanceof Lazy) {
      const name = v.done ? undefined : showing?.shared.get(v);
      return name !== undefined ? data("name", new Quoted(name)) : describe(v.value, binders, own);
    }
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
    // A part another module wrote is not shown: only which parameters of the described
    // function it mentions. Plain data is a value like bits, and is shown.
    if (own !== undefined && (v instanceof Expr || v instanceof Fn || (v instanceof Struct && !settled.has(v))) && v.owner?.module !== own) {
      const mentioned: V[] = [];
      const walk = (x: V, visited: Set<V>): void => {
        if (x instanceof Param) {
          const d = describe(x, binders, own);
          if (!mentioned.includes(x) && seen((d as Struct).entries[0][1]) !== intern("description.unknown")) mentioned.push(x);
          return;
        }
        if (visited.has(x)) return;
        visited.add(x);
        if (x instanceof Expr) [x.fn, ...x.args].forEach((y) => walk(y, visited));
        else if (x instanceof Struct) x.entries.forEach(([, e]) => walk(e, visited));
        else if (x instanceof Fn) walk(x.body, visited);
        else if (x instanceof Lazy) walk(x.value, visited);
        else if (x instanceof Decided) walk(x.inner, visited);
      };
      walk(v, new Set());
      return data("opaque", list(mentioned.map((m) => describe(m, binders, own))));
    }
    if (v instanceof Expr) return data("apply", describe(v.fn, binders, own), list(v.args.map((a) => describe(a, binders, own))));
    if (v instanceof Struct) {
      const entries = new Struct(v.entries.map(([k, e]) => [k === null ? null : seen(k) instanceof Key ? describe(seen(k), binders, own) : asData(k, "a structure's key"), describe(e, binders, own)] as const));
      settled.add(entries);
      return data("structure", entries);
    }
    if (v instanceof Fn) return data("function", number(v.params.length), describe(v.body, [...binders, v], own));
    return data("unknown"); // a refutation
  };

  /** True where a part is another module's and is shown as opaque. */
  const closedTo = (v: V, own: string | undefined): boolean =>
    own !== undefined && (v instanceof Expr || v instanceof Fn || (v instanceof Struct && !settled.has(v))) && v.owner?.module !== own;

  /** What a name of a block stands for now: its value where that is known, else what is still to be evaluated. */
  const boundValue = (found: { binding: Binding; scope: ScopeV }): V => {
    if (found.binding.memo !== undefined) return found.binding.memo;
    const value = found.binding.value;
    return value instanceof Fn ? close(value, found.scope) : value;
  };

  /** The names a description in the making writes: for a block's binding, and for an argument used more than once. */
  let showing: { names: Map<Binding, Sym>; shared: Map<Lazy, Sym> } | undefined;

  /**
   * The description of a function, as a program that means the same.
   *
   * Inside the kernel two things are held that plain data does not show.
   * A function made in a block reads the block's names, and an argument
   * used more than once is evaluated once. A description says both as a
   * block around the function: each binding the function reads, and each
   * shared argument still waiting, is a binding of that block. Sharing a
   * node means nothing in a description; a binding is what says "once".
   *
   * A binding is named as it was written, unless that name is taken in
   * what is shown: then the kernel picks another.
   *
   * The block is around the whole function. That is right while no
   * binding mentions a parameter of a function inside the description,
   * which holds for every value this kernel makes: a function's body is
   * not evaluated until it is called. Specialization will need a block
   * inside a function.
   */
  const describeWhole = (f: Fn, own: string | undefined): V => {
    const bindings = new Map<Binding, { found: { binding: Binding; scope: ScopeV }; sym: Sym }>();
    const uses = new Map<Lazy, number>();
    const written = new Set<Sym>();
    const order: (Binding | Lazy)[] = [];
    // The walk follows what `describe` shows, part for part: a part shown twice counts twice.
    const walk = (v: V): void => {
      if (v instanceof Sym) written.add(v);
      else if (v instanceof Quoted) { if (!(v.inner instanceof Sym)) walk(v.inner); }
      else if (v instanceof Decided) walk(v.inner);
      else if (v instanceof CellV) { if (v.filled) walk(v.value as V); }
      else if (v instanceof NameRef) {
        const found = bindingOf(v);
        if (found === undefined) { written.add(v.sym); return; }
        if (bindings.has(found.binding)) return;
        const value = boundValue(found);
        // A value that is plain is written where it is used.
        if (!(value instanceof Fn || value instanceof Expr || value instanceof Lazy || value instanceof NameRef || (value instanceof Struct && !settled.has(value)))) return;
        bindings.set(found.binding, { found, sym: v.sym });
        order.push(found.binding);
        walk(value);
      } else if (v instanceof Lazy) {
        if (v.done) { walk(v.value); return; }
        const n = uses.get(v) ?? 0;
        uses.set(v, n + 1);
        if (n === 0) walk(v.value);
        else if (n === 1) order.push(v);
      } else if (closedTo(v, own)) return;
      else if (v instanceof Expr) [v.fn, ...v.args].forEach(walk);
      else if (v instanceof Struct) v.entries.forEach(([, e]) => walk(e));
      else if (v instanceof Fn) walk(v.body);
    };
    walk(f);
    if (order.length === 0) return describe(f, [], own);
    const names = new Map<Binding, Sym>();
    const shared = new Map<Lazy, Sym>();
    const fresh = (wanted: string): Sym => {
      for (let n = 1; ; n++) {
        const sym = intern(n === 1 ? wanted : `${wanted}_${n}`);
        if (!written.has(sym)) { written.add(sym); return sym; }
      }
    };
    for (const item of order) {
      if (item instanceof Lazy) shared.set(item, fresh("shared"));
      else names.set(item, fresh((bindings.get(item) as { sym: Sym }).sym.fqn));
    }
    const before = showing;
    showing = { names, shared };
    try {
      const entries = new Struct(order.map((item) => {
        const value = item instanceof Lazy ? item.value : boundValue((bindings.get(item) as { found: { binding: Binding; scope: ScopeV } }).found);
        const name = item instanceof Lazy ? shared.get(item) : names.get(item);
        return [name as Sym, describe(value, [], own)] as const;
      }));
      settled.add(entries);
      return data("apply", data("kernel", text("block")), list([data("structure", entries), describe(f, [], own)]));
    } finally {
      showing = before;
    }
  };

  /** The value a description describes, or a refutation where it cannot be built. */
  const build = (d: V, binders: readonly Fn[]): V => {
    const malformed = (): V => new Refuted("not a description", d);
    const s = seen(d);
    if (!(s instanceof Struct) || s.entries.length === 0) return malformed();
    // An entry may be one that was evaluated when read: what it came to is what is read.
    const head = through(s.entries[0][1]);
    const form = head instanceof Quoted && head.inner instanceof Sym ? head.inner.fqn : "";
    const parts = s.entries.slice(1).map(([, e]) => through(e));
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
    symbolData: (fqn) => out(new Quoted(intern(fqn))),
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
      tallies = new Map();
      const r = within(limits, () => evaluate(e, s));
      const value = r.value ?? e;
      if (r.ended === "complete" && !known(value)) {
        const root: Root = { scope: s, value, done: false };
        roots.push(root);
        rootOf.set(value, root);
      }
      return { value: out(value), ended: r.ended, steps: r.steps, refuted: value instanceof Refuted, claims: claimRecords() };
    },
    advance: (limits): Advance => {
      if (!dirty) return { ended: "complete", steps: 0, refuted: [], claims: [] };
      dirty = false;
      tallies = new Map();
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
      return { ended: r.ended, steps: r.steps, refuted, claims: claimRecords() };
    },
    current: (value) => {
      const v = into(value, "the value");
      const root = rootOf.get(v);
      if (root !== undefined) return out(root.value);
      const now = through(v);
      return now === v ? value : out(now);
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
        if (s instanceof Decided) return s.outcome;
        const t = through(s);
        if (t !== s) s = t;
        else if (s instanceof Quoted) s = s.inner;
        else break;
      }
      return s instanceof Expr && s.fn === kernelPrims.get("claim") ? "undecided" : undefined;
    },
    originOf: (v) => {
      into(v, "the value");
      return undefined;
    },

    module: (fn, count, declares) => {
      const f = into(fn, "the function");
      if (!(f instanceof Fn)) throw new InterfaceError("module: not a composed function");
      if (!Number.isInteger(count) || count < 0 || count > f.params.length) throw new InterfaceError("module: the number of key slots does not fit the function's parameters");
      const free = freeNames(f, new Set(), [], new Map());
      if (free.length > 0) throw new InterfaceError(`module: the function has the free name(s) ${free.map((n) => n.fqn).join(", ")}; a module names only what its blocks bind and what it is handed`);
      declarationsFor(f, count, declares, "module");
      const identity = identityOf(f, declares);
      const env = new Map<Param, V>();
      for (let slot = 0; slot < count; slot++) {
        const name = `${identity} ${slot}`;
        let key = keys.get(name);
        if (key === undefined) keys.set(name, (key = new Key(identity, slot)));
        env.set(f.params[slot], key);
      }
      const made = new Fn(f.params.slice(count), substitute(f.body, env, new Map()));
      moduleIds.set(made, identity);
      if (!modulesById.has(identity)) modulesById.set(identity, made);
      if (declares !== undefined) moduleDeclares.set(made, declares);
      // Every part of the module's text is the module's, written in the function it sits in.
      markAll(made, identity, undefined, new Set());
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
      const v = through(into(value, "the value"));
      return v instanceof Decided ? v.rests : [];
    },
    reasonOf: (value) => {
      const v = through(into(value, "the value"));
      return v instanceof Refuted ? v.reason : v instanceof Decided ? v.reason : undefined;
    },
    claimKey: (claim, within, restsOn, declares) => claimKey(into(claim, "the claim"), into(within, "the function"), restsOn, declares),
    restore: (claim, within, builder, restsOn, key, declares) => {
      const c = into(claim, "the claim");
      if (builder === "") throw new InterfaceError("restore: an outcome is restored under a builder's name");
      if (restsOn.some((r) => r.kind === "limit"))
        throw new InterfaceError("restore: an outcome that rests on a limit is never stored");
      if (restsOn.some((r) => r.kind === "capability"))
        throw new InterfaceError("restore: an outcome that rests on a capability's answer is never stored");
      const w = into(within, "the function");
      if (claimKey(c, w, restsOn, declares) !== key)
        throw new InterfaceError("restore: the key does not match this claim, in this function, resting on these things");
      closedFor(c as Expr, w as Fn, declares);
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
