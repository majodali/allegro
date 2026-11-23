// What a kernel does that is no evaluation, shared by both variants:
// symbols, handles, reading values, plain data, a module's content and
// identity, marks, the key of a claim, building and describing, the
// tally of claims, and the rewriting of expressions: tying names to a
// scope, supplying values for names and putting arguments for parameters.
//
// Whose: the kernel stream (lane R). Taken out of next/kernel/kernel.ts on
// 2026-11-20 with no change (docs/plans/book-pass.md section 9). The
// reference kernel's evaluator is next/kernel/kernel.ts.

import type { Cell, ClaimRecord, Declaration, Entry, Kernel, KeyDescription, Kind, Location, Observed, Outcome, Place, Rest, Value } from "./interface.js";
import { InterfaceError } from "./interface.js";
import { sha256Text } from "./hash.js";
import { Bits, CellV, Decided, Expr, Fn, INSPECT, KERNEL_PRIMITIVES, KernelPrim, Key, Lazy, NameRef, Param, Prim, Quoted, Refuted, Struct, Sym } from "./values.js";
import type { Binding, Group, ScopeV, V } from "./values.js";

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
    r.kind === "kernel" ? `kernel ${r.variant}${r.sampled === undefined ? "" : ` sampled ${r.sampled}`}` : r.kind === "primitive" ? `primitive ${r.hash}` : r.kind === "capability" ? `capability ${r.capability}.${r.part}` : r.kind === "assumption" ? `assumption ${r.by}` : r.kind === "limit" ? "limit" : `builder ${r.builder}`;

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
    if (!(s instanceof Bits)) return wrong("bitsOf", v);
    // The length is known at once. Bytes that are laid out are handed over as they are.
    if (s.laidOut) return { bytes: s.bytes, bitLength: s.bitLength };
    // The bytes of a value made by joining are laid out when they are read.
    return {
      get bytes(): Uint8Array {
        return s.bytes;
      },
      bitLength: s.bitLength,
    };
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
  const whole = (b: Bits): boolean => b.whole;
  const packed = (bits: readonly number[]): V => {
    const bytes = new Uint8Array(Math.ceil(bits.length / 8));
    const pad = bytes.length * 8 - bits.length;
    bits.forEach((bit, i) => { if (bit) bytes[(i + pad) >> 3] |= 128 >> ((i + pad) & 7); });
    return new Bits(bytes, bits.length);
  };
  /** A count as the kernel answers one: 64 bits, most significant first. */
  const count64 = (n: number): V => {
    const bytes = new Uint8Array(8);
    for (let i = 7, rest = n; i >= 0 && rest > 0; i--, rest = Math.floor(rest / 256)) bytes[i] = rest % 256;
    return new Bits(bytes, 64);
  };
  /** A whole number read from bits, or undefined where the value is not bits or is too large to count with. */
  const countOf = (v: V): number | undefined => {
    const b = seen(v);
    if (!(b instanceof Bits)) return undefined;
    const n = bitList(b).reduce((acc, bit) => acc * 2 + bit, 0);
    return Number.isSafeInteger(n) ? n : undefined;
  };
  const textOf = (b: Bits): string => new TextDecoder().decode(b.bytes);
  /** A structure of plain data whose first entry is a symbol naming its form. */
  /**
   * The entries of each form of description, in the order they are written. Every
   * description is a structure keyed by symbols: `form` first, then these, then `at`
   * where the part has a place.
   */
  const FORMS: Record<string, readonly string[]> = {
    bits: ["value"], symbol: ["value"], name: ["name"], param: ["function", "index"], apply: ["function", "arguments"],
    function: ["parameters", "body"], structure: ["entries"], kernel: ["name"], primitive: ["hash"],
    capability: ["capability", "part"], key: ["module", "slot"], opaque: ["mentions"], unknown: [],
  };
  const keyed = (entries: ReadonlyArray<readonly [string, V]>): Struct => {
    const s = new Struct(entries.map(([k, e]) => [intern(k), e] as const));
    settled.add(s);
    return s;
  };
  const data = (form: string, ...parts: V[]): V => keyed([["form", new Quoted(intern(form))], ...parts.map((p, i) => [FORMS[form][i], p] as const)]);
  /** A description with the place of the part it describes, where the part has one. */
  const placed = (d: V, from: V): V => {
    const at = from instanceof Expr || from instanceof Fn || from instanceof Struct ? from.at : undefined;
    return at === undefined ? d : keyed([...(d as Struct).entries.map(([k, e]) => [(k as Sym).fqn, e] as const), ["at", placeData(at)]]);
  };
  const locationData = (l: Location): V => keyed([["index", number(l.index)], ["line", number(l.line)], ["column", number(l.column)]]);
  /** A place as plain data: its source, and the two locations. */
  const placeData = (p: Place): V => keyed([["source", text(p.source)], ["start", locationData(p.start)], ["end", locationData(p.end)]]);
  /** The entry of a structure under a name, evaluated where it was evaluated when read. */
  const entryOf = (s: Struct, name: string): V | undefined => {
    const key = intern(name);
    const found = s.entries.find(([k]) => k !== null && seen(k) === key);
    return found === undefined ? undefined : through(found[1]);
  };
  /** A place read from plain data, or undefined where the data is not one. */
  const placeOfData = (v: V | undefined): Place | undefined => {
    const s = v === undefined ? undefined : seen(v);
    if (!(s instanceof Struct)) return undefined;
    const source = entryOf(s, "source");
    const sourceBits = source === undefined ? undefined : seen(source);
    const location = (name: string): Location | undefined => {
      const l = entryOf(s, name);
      const ls = l === undefined ? undefined : seen(l);
      if (!(ls instanceof Struct)) return undefined;
      const [index, line, column] = ["index", "line", "column"].map((n) => {
        const b = entryOf(ls, n);
        return b !== undefined && seen(b) instanceof Bits ? numberOf(seen(b) as Bits) : undefined;
      });
      return index === undefined || line === undefined || column === undefined ? undefined : { index, line, column };
    };
    const [start, end] = [location("start"), location("end")];
    return !(sourceBits instanceof Bits) || start === undefined || end === undefined ? undefined : { source: textOf(sourceBits), start, end };
  };
  /** A place a host gives, checked. */
  const placeIn = (at: Place | undefined, what: string): Place | undefined => {
    if (at === undefined) return undefined;
    const whole = (n: unknown): boolean => typeof n === "number" && Number.isInteger(n) && n >= 0;
    const ok = (l: Location | undefined): boolean => l !== undefined && whole(l.index) && whole(l.line) && whole(l.column);
    if (typeof at.source !== "string" || !ok(at.start) || !ok(at.end)) throw new InterfaceError(`${what}: the place is not {source, start, end} with a location at each end`);
    return { source: at.source, start: { ...at.start }, end: { ...at.end } };
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
    if (!(s instanceof Struct)) return malformed();
    // The entries are read by their keys, and one that is not known is passed over. An entry
    // may be one that was evaluated when read: what it came to is what is read.
    const head = entryOf(s, "form");
    const form = head instanceof Quoted && head.inner instanceof Sym ? head.inner.fqn : "";
    const parts = (FORMS[form] ?? []).map((name) => entryOf(s, name));
    // A part with a place is built with it. A place that is not one is no description.
    const atData = entryOf(s, "at");
    const at = placeOfData(atData);
    if (atData !== undefined && at === undefined) return malformed();
    const sited = <T extends Expr | Fn | Struct>(made: T): T => {
      made.at = at;
      return made;
    };
    const bitsAt = (i: number): Bits | undefined => {
      const p = parts[i] === undefined ? undefined : seen(parts[i]);
      return p instanceof Bits ? p : undefined;
    };
    switch (form) {
      case "bits":
        return bitsAt(0) ?? malformed();
      case "symbol":
        return parts[0] instanceof Quoted ? parts[0] : malformed();
      case "name":
        return parts[0] instanceof Quoted && parts[0].inner instanceof Sym ? parts[0].inner : malformed();
      case "kernel": {
        const p = bitsAt(0) === undefined ? undefined : kernelPrims.get(textOf(bitsAt(0) as Bits));
        return p ?? malformed();
      }
      case "primitive": {
        const b = bitsAt(0);
        if (b === undefined) return malformed();
        return pureByHash.get(textOf(b)) ?? new Refuted(`a description names the primitive ${textOf(b)}, which this kernel lacks`, undefined);
      }
      case "param": {
        const [depth, index] = [bitsAt(0), bitsAt(1)];
        if (depth === undefined || index === undefined) return malformed();
        const owner = binders[binders.length - 1 - numberOf(depth)];
        return owner?.params[numberOf(index)] ?? malformed();
      }
      case "apply": {
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
        return sited(new Expr(fn, built));
      }
      case "structure": {
        const entries = parts[0] === undefined ? undefined : seen(parts[0]);
        if (!(entries instanceof Struct)) return malformed();
        const built: (readonly [V | null, V])[] = [];
        for (const [k, e] of entries.entries) {
          const r = build(e, binders);
          if (r instanceof Refuted) return r;
          built.push([k, r]);
        }
        return sited(new Struct(built));
      }
      case "function": {
        const count = bitsAt(0);
        if (count === undefined || parts[1] === undefined || numberOf(count) > 255) return malformed();
        const params = Array.from({ length: numberOf(count) }, (_x, i) => new Param(`p${i}`));
        // A stand-in with the same parameters is the innermost binder while the body is built.
        const body = build(parts[1], [...binders, new Fn(params, new Struct([]))]);
        return body instanceof Refuted ? body : sited(new Fn(params, body));
      }
      case "capability":
      case "key":
      case "opaque":
        return new Refuted("a description that holds the identity of an unforgeable value cannot be built: nothing makes authority from data", undefined);
      default:
        return malformed();
    }
  };

  /** A function with its free names tied to a scope, by function and scope. */
  const closed = new WeakMap<Fn, Map<ScopeV, Fn>>();
  /** Claims whose outcome was restored from a saved program, with what each rests on. */
  const restored = new WeakMap<Expr, readonly Rest[]>();
  /** What is left of a `then` that waits, with what its first part started. */
  const thenGroups = new WeakMap<Expr, Group>();
  /** A number for each assumption as written, so two assumptions of one module are told apart. */
  const assumptionNumbers = new WeakMap<object, number>();
  let assumptionCount = 0;
  /** The key within one kernel: it tells two assumptions of one module apart, which the stored key does not. */
  /** The key of a rest that is not an assumption at a place, kept: the same record is noted at every step that rests on it. */
  const keyOfRest = new WeakMap<Rest, string>();
  const localKey = (r: Rest): string => {
    if (r.kind !== "assumption" || r.at === undefined) {
      let key = keyOfRest.get(r);
      if (key === undefined) keyOfRest.set(r, (key = restKey(r)));
      return key;
    }
    let n = assumptionNumbers.get(r.at as object);
    if (n === undefined) assumptionNumbers.set(r.at as object, (n = ++assumptionCount));
    return `${restKey(r)} #${n}`;
  };

  /** A copy keeps the mark of what it was copied from: a part is its writer's wherever it goes. */
  const keep = (from: V, to: V): V => {
    if (to !== from && (to instanceof Expr || to instanceof Struct || to instanceof Fn) && to.owner === undefined && (from instanceof Expr || from instanceof Struct || from instanceof Fn))
      to.owner = from.owner;
    // And the place it was written at: what a copy or an evaluation leaves of a part is still that part.
    if (to !== from && (to instanceof Expr || to instanceof Struct || to instanceof Fn) && to.at === undefined && (from instanceof Expr || from instanceof Struct || from instanceof Fn))
      to.at = from.at;
    // What a copy or an evaluation leaves of a claim is still that claim, as written.
    if (to !== from && to instanceof Expr && from instanceof Expr && to.site === undefined && (from.site !== undefined || from.fn === kernelPrims.get("claim") || from.fn === kernelPrims.get("assume")))
      to.site = from.site ?? from;
    // What is left of a sequence that waits keeps what its first part started.
    if (to !== from && to instanceof Expr && from instanceof Expr) {
      const group = thenGroups.get(from);
      if (group !== undefined && !thenGroups.has(to)) thenGroups.set(to, group);
    }
    return to;
  };

  // ---- The claims of a call ------------------------------------------------
  //
  // One tally for each claim as written, however often it was evaluated.

  interface Tally { decided: number; sampled: number; assumed: number; undecided: number; refuted: number; reasons: Set<string>; rests: Map<string, Rest> }
  /** The tallies of the call of `evaluate` or `advance` now running. */
  const tallies = new Map<Expr, Tally>();
  /** How many evaluations of each written claim wait now, and which residuals they are. */
  const waitingAt = new Map<Expr, number>();
  const waitingClaims = new WeakSet<Expr>();
  /** The refutations a claim has been counted for. */
  const counted = new WeakSet<Refuted>();
  const tallyOf = (site: Expr): Tally => {
    let t = tallies.get(site);
    if (t === undefined) tallies.set(site, (t = { decided: 0, sampled: 0, assumed: 0, undecided: 0, refuted: 0, reasons: new Set(), rests: new Map() }));
    return t;
  };
  // ---- What a host is told ---------------------------------------------------

  let observer: ((seen: Observed) => void) | undefined;
  /** Whether the evaluator is ahead of what is done. The evaluator says how to tell. */
  let aheadNow: () => boolean = () => false;
  const aheadIs = (reader: () => boolean): void => {
    aheadNow = reader;
  };
  /** True while a host listens: what is told is only put together then. */
  const observed = (): boolean => observer !== undefined;
  /** Tells the host that listens one thing the kernel did, with the part it is about and the part's place. */
  const tell = (part: V, what: { kind: "branch"; taken: "then" | "else" | "both" | "neither" } | { kind: "call"; function: Value } | { kind: "claim"; outcome: Outcome | "waiting" } | { kind: "effect"; capability: string; operation: string } | { kind: "refutation"; reason: string }): void => {
    if (observer === undefined) return;
    const at = part instanceof Expr || part instanceof Fn || part instanceof Struct ? part.at : undefined;
    observer({ part: out(part), ...(at === undefined ? {} : { at }), ahead: aheadNow(), ...what } as Observed);
  };

  /** Records how one evaluation of a claim came out. `from` is what was evaluated: the claim, or what an earlier evaluation left of it. */
  const tallied = (from: Expr, result: V, rests: readonly Rest[]): V => {
    const site = from.site ?? from;
    if (observer !== undefined) tell(site, { kind: "claim", outcome: result instanceof Refuted ? "refuted" : result instanceof Decided ? result.outcome : "waiting" });
    if (waitingClaims.has(from)) {
      waitingClaims.delete(from);
      waitingAt.set(site, (waitingAt.get(site) ?? 1) - 1);
    }
    // A claim that only receives a refutation met before is not refuted over again: each
    // refutation is counted once, where it arose or at the first claim it reached.
    if (result instanceof Refuted && counted.has(result)) return result;
    const t = tallyOf(site);
    if (result instanceof Refuted) {
      counted.add(result);
      t.refuted++;
      t.reasons.add(result.reason);
    } else if (result instanceof Decided) {
      t[result.outcome]++;
      if (result.reason !== undefined) t.reasons.add(result.reason);
      for (const r of [...result.rests, ...rests]) t.rests.set(localKey(r), r);
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
      ...(site.at === undefined ? {} : { at: site.at }),
      decided: t.decided,
      sampled: t.sampled,
      assumed: t.assumed,
      undecided: t.undecided,
      refuted: t.refuted,
      waiting: waitingAt.get(site) ?? 0,
      reasons: [...t.reasons],
      restsOn: [...t.rests.values()],
    }));

  // ---- What is left, as a function's body ----------------------------------

  let sharedNames = 0;
  /**
   * What an evaluation left, made fit to be a function's body. What is left holds values
   * evaluated when needed, each one thing evaluated at most once. In a body such a value
   * must be worked out afresh at every call. So one that is used once is written where it
   * is used, and one used more than once is bound in a block around the body, which gives
   * every call a value of its own, still evaluated at most once.
   */
  const asBody = (left: V): V => {
    const uses = new Map<Lazy, number>();
    const count = (v: V, inside: Set<V>): void => {
      if (v instanceof Lazy) {
        if (v.done) return count(v.value, inside);
        uses.set(v, (uses.get(v) ?? 0) + 1);
        if (uses.get(v) === 1) count(v.value, inside);
      } else if (v instanceof Expr) {
        if (inside.has(v)) return;
        inside.add(v);
        count(v.fn, inside);
        v.args.forEach((a) => count(a, inside));
        inside.delete(v);
      } else if (v instanceof Struct) {
        if (!settled.has(v)) v.entries.forEach(([, e]) => count(e, inside));
      } else if (v instanceof Fn) count(v.body, inside);
      else if (v instanceof Decided) count(v.inner, inside);
    };
    count(left, new Set());
    const names = new Map<Lazy, Sym>();
    const bound: (readonly [V, V])[] = [];
    const plain = (v: V): V => {
      if (v instanceof Lazy) {
        if (v.done) return plain(v.value);
        if ((uses.get(v) ?? 0) < 2) return plain(v.value);
        let name = names.get(v);
        if (name === undefined) {
          names.set(v, (name = intern(`kernel.shared.${++sharedNames}`)));
          bound.push([name, plain(v.value)]);
        }
        return name;
      }
      if (v instanceof Expr) {
        if (restored.has(v)) return v;
        const [fn, args] = [plain(v.fn), v.args.map(plain)];
        return fn === v.fn && args.every((a, i) => a === v.args[i]) ? v : keep(v, new Expr(fn, args));
      }
      if (v instanceof Struct) {
        if (settled.has(v)) return v;
        const entries = v.entries.map(([k, e]) => [k, plain(e)] as const);
        return entries.every(([, e], i) => e === v.entries[i][1]) ? v : keep(v, new Struct(entries));
      }
      if (v instanceof Fn) {
        const body = plain(v.body);
        return body === v.body ? v : keep(v, new Fn(v.params, body));
      }
      return v;
    };
    const body = plain(left);
    return bound.length === 0 ? body : new Expr(kernelPrims.get("block") as V, [new Struct(bound), body]);
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

  /**
   * True where a statement is itself a claim that waits: such a statement holds what is
   * written after it in its block. A claim inside a function the statement calls does not:
   * a statement that binds its value holds nothing, and a notation writes a claim of its own
   * for a statement whose value is dropped.
   */
  const heldByClaim = (r: V): boolean => r instanceof Expr && (r.site !== undefined || r.fn === kernelPrims.get("claim"));

  /** The kernel's primitives that compute on data and do nothing else. */
  const ONE_STEP = new Set(["join", "length", "slice", "same", "count", "kind", "key", "symbol", "spelling"]);
  /** True for a pure primitive function, or such a kernel primitive, applied to values already known. */
  const oneStep = (e: V): boolean =>
    e instanceof Expr &&
    ((e.fn instanceof Prim && e.fn.declaration.purity === "pure") || (e.fn instanceof KernelPrim && ONE_STEP.has(e.fn.name))) &&
    e.args.every((a) => !(a instanceof Expr || a instanceof NameRef || a instanceof Sym) && knownInFull(a));

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
    if (v instanceof Expr) return placed(data("apply", describe(v.fn, binders, own), list(v.args.map((a) => describe(a, binders, own)))), v);
    if (v instanceof Struct) {
      const entries = new Struct(v.entries.map(([k, e]) => [k === null ? null : seen(k) instanceof Key ? describe(seen(k), binders, own) : asData(k, "a structure's key"), describe(e, binders, own)] as const));
      settled.add(entries);
      return placed(data("structure", entries), v);
    }
    if (v instanceof Fn) return placed(data("function", number(v.params.length), describe(v.body, [...binders, v], own)), v);
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


  /** The assumptions a configuration does not accept: by module, and one by one. */
  const withdrawnModules = new Set<string>();
  const withdrawnSites = new WeakSet<Expr>();

  /**
   * The part of the interface that evaluates nothing: constructing values, reading them,
   * making a module, and the calls about keys, claims and outcomes. Both variants offer it
   * as it is. What is left to a variant is evaluation: `scope`, `fill`, `waiting`,
   * `evaluate`, `advance` and `current`.
   */
  const shared: Omit<Kernel, "interfaceVersion" | "variant" | "fill" | "waiting" | "kept" | "evaluate" | "check" | "advance" | "current"> = {

    bits: (bytes, bitLength) => {
      const n = bitLength ?? bytes.length * 8;
      if (!Number.isInteger(n) || n < 0 || n > bytes.length * 8) throw new InterfaceError("bits: the length does not fit the bytes");
      return out(new Bits(bytes, n));
    },
    symbol: (fqn) => out(intern(fqn)),
    symbolData: (fqn) => out(new Quoted(intern(fqn))),
    param: (name) => out(new Param(name)),
    structure: (entries, at) => {
      const made = new Struct(entries.map(([k, e]) => [k === null ? null : into(k, "a key"), into(e, "an entry")] as const));
      made.at = placeIn(at, "structure");
      return out(made);
    },
    expression: (fn, args, at) => {
      const made = new Expr(into(fn, "the function"), args.map((a) => into(a, "an argument")));
      made.at = placeIn(at, "expression");
      return out(made);
    },
    observe: (o) => {
      if (o !== undefined && typeof o !== "function") throw new InterfaceError("observe: the observer is not a function");
      observer = o;
    },
    placeOf: (value) => {
      const v = through(into(value, "the value"));
      return v instanceof Expr || v instanceof Fn || v instanceof Struct ? v.at : undefined;
    },
    composedFunction: (params, body, at) => {
      const ps = params.map((p) => {
        const v = into(p, "a parameter");
        if (!(v instanceof Param)) throw new InterfaceError("composedFunction: a parameter is not of kind param");
        return v;
      });
      if (new Set(ps).size !== ps.length) throw new InterfaceError("composedFunction: a parameter is listed twice");
      const made = new Fn(ps, into(body, "the body"));
      made.at = placeIn(at, "composedFunction");
      return out(made);
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
    cell: () => out(new CellV(undefined)) as Cell,
    filled: (cell) => {
      const c = into(cell, "the cell");
      if (c instanceof CellV) return c.filled;
      if (c instanceof NameRef) return bindingOf(c) !== undefined;
      throw new InterfaceError("filled: not a cell");
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
    withdraw: (what) => {
      if (typeof what === "string") {
        if (!/^sha256:[0-9a-f]{64}$/.test(what)) throw new InterfaceError("withdraw: a module is named by its identity, as sha256: and 64 hex digits");
        withdrawnModules.add(what);
        return;
      }
      const e = into(what, "the assumption");
      if (!(e instanceof Expr) || e.fn !== kernelPrims.get("assume")) throw new InterfaceError("withdraw: not an application of the kernel's assume primitive");
      withdrawnSites.add(e.site ?? e);
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

  return {
    symbols, kernelPrims, settled, built, moduleIds, moduleDeclares, modulesById, pureByHash, keys,
    restKey, TRUE, FALSE, out, isV, into, through, seen, bindingOf, known, hidden, knownInFull,
    asData, blockNames, freeNames, utf8, intern, kindOf, wrong, bitsOf, symbolName, entriesOf, hex,
    contentOf, enclosing, markAll, identityOf, declarationsFor, closedFor, claimKey, text, number,
    numberOf, bitList, whole, packed, count64, countOf, textOf, data, failure, list, build, closed,
    restored, thenGroups, localKey, keep, asBody, tell, observed, aheadIs, tallies, waitingAt, waitingClaims, counted, tallyOf,
    tallied, claimRecords, supply, tie, close, substitute, heldByClaim, oneStep, sameInformation,
    truthOf, describe, closedTo, boundValue, describeWhole, withdrawnModules, withdrawnSites,
    shared,
  };
};

export type Core = ReturnType<typeof createCore>;
