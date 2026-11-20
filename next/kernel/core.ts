// What a kernel does that is no evaluation, shared by both variants:
// symbols, handles, reading values, plain data, a module's content and
// identity, marks, the key of a claim, and building a description.
//
// Whose: the kernel stream (lane R). Taken out of next/kernel/kernel.ts on
// 2026-11-20 with no change (docs/plans/book-pass.md section 9). The
// reference kernel's evaluator is next/kernel/kernel.ts.

import type { Declaration, Entry, Kind, Rest, Value } from "./interface.js";
import { InterfaceError } from "./interface.js";
import { sha256Text } from "./hash.js";
import { Bits, CellV, Decided, Expr, Fn, KERNEL_PRIMITIVES, KernelPrim, Key, Lazy, NameRef, Param, Prim, Quoted, Refuted, Struct, Sym } from "./values.js";
import type { Binding, ScopeV, V } from "./values.js";

/** The state and the functions of one kernel that are no evaluation. */
export const createCore = () => {
  const symbols = new Map<string, Sym>();
  const kernelPrims = new Map(KERNEL_PRIMITIVES.map(([name, arity]) => [name, new KernelPrim(name, arity)] as const));
  /** Structures and functions known to need no further evaluation. */
  const settled = new WeakSet<object>();
  /** Structures that have been evaluated: complete in shape, each entry a value or an entry not yet needed. */
  const built = new WeakSet<object>();
  const moduleIds = new WeakMap<Fn, string>();
  /** What each parameter of a module function is declared to be. */
  const moduleDeclares = new WeakMap<Fn, readonly Declaration[]>();
  /** The modules a value is an instance of. */
  /** The modules made in this kernel, by identity: what an import is supplied from. */
  const modulesById = new Map<string, Fn>();
  /** The module a function was made in, for every function inside a module. */
  /** The pure primitive functions made in this kernel, by content hash. */
  const pureByHash = new Map<string, Prim>();
  const keys = new Map<string, Key>();

  const restKey = (r: Rest): string =>
    r.kind === "kernel" ? `kernel ${r.variant}` : r.kind === "primitive" ? `primitive ${r.hash}` : r.kind === "capability" ? `capability ${r.capability}.${r.part}` : r.kind === "assumption" ? `assumption ${r.by}` : r.kind === "limit" ? "limit" : `builder ${r.builder}`;

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
  /**
   * A failure a program can handle, in the one shape every failure has: a structure whose
   * first entry is keyed `failure` and holds a symbol naming what failed. An attempt answers
   * with one where what it attempted was refuted or reached its limit.
   */
  const failure = (name: string, reason?: V): V => {
    const entries: (readonly [V | null, V])[] = [[intern("failure"), new Quoted(intern(name))]];
    if (reason !== undefined) entries.push([intern("reason"), reason]);
    const s = new Struct(entries);
    settled.add(s);
    return s;
  };
  const list = (items: readonly V[]): V => {
    const s = new Struct(items.map((p) => [null, p] as const));
    settled.add(s);
    return s;
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

  return {
    symbols, kernelPrims, settled, built, moduleIds, moduleDeclares, modulesById, pureByHash, keys,
    restKey, TRUE, FALSE, out, isV, into, through, seen, bindingOf, known, hidden, knownInFull,
    asData, blockNames, freeNames, utf8, intern, kindOf, wrong, bitsOf, symbolName, entriesOf, hex,
    contentOf, enclosing, markAll, identityOf, declarationsFor, closedFor, claimKey, text, number,
    numberOf, bitList, whole, packed, count64, countOf, textOf, data, failure, list, build,
  };
};

export type Core = ReturnType<typeof createCore>;
