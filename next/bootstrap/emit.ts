// The emitter of Allegretto (B-196 (the rebuild's acceptance side), chunk
// Q5 (the first notation and the bootstrap), parts 2 and 3): a text read
// by next/bootstrap/reader.ts becomes a saved program in the data form of
// next/kernel/saved-program.ts.
//
//   npm run emit -- <file> [-o out.json]
//   npx tsx next/bootstrap/emit.ts <file> [-o out.json]
//
// The command emits the text with the texts it imports, through the
// bootstrap's driver (next/bootstrap/driver.ts), and writes the text's own
// record. A record holds one module, so for a text that imports it also
// writes to stderr one line for each imported text, in the order the
// records are to be loaded: emitted alone, each gives the same record and
// identity, and `npm run launch` takes it by `--import`.
//
// Each form becomes exactly what next/ext/allegretto/forms.md §2 says it
// stands for, on the kernel as forms.md §4 lists it built. It never writes
// an encoding of its own for a form. `emit` returns every finding of a
// text, so the census (next/bootstrap/census.ts) counts what the emitter
// refuses.
//
// Part 4 brought it up to forms.md as it stood on 2026-11-19: statements
// as a chain of `also`, `sync` blocks, a dropped statement as a claim,
// `is_failure` and `handle`, `x <- e` as a binding of its block's group,
// the kernel's other primitives as names, computed keys, keys and private
// entries, the four structures `int`, `float`, `text` and `bits`, and four
// more shipped primitives.
//
// Part 5 brought imports (forms.md §2 "The module", question 7): `emit`
// takes, for each imported name, the imported module's declarations and
// identity, which the driver (next/bootstrap/driver.ts) gets by emitting
// the imported text first and loading its record. An import is then a
// parameter of the module function declared `{ role: "module", name,
// identity }`, and the binding `name = <that parameter>(arguments)` in the
// module's block, with one argument for each capability and input the
// imported module declares, in its order: the importing module's own of
// that name, the expression of a `with` pair, or, for a name after
// `without`, `refuse("the capability c was withheld by the importing
// module")`.
//
// What it realises, from docs/plans/book-pass-inventory.md:
//   "Allegretto is a small language for the kernel and nothing else"
//   "A saved program is a recorded sequence of interface calls": the
//     record constructs values only
//   "A saved program names what it needs by content hash": `needs` lists
//     the shipped primitives the text uses, each by the hash `shippedByName`
//     of next/prims/index.ts gives when the record is built
//   "A module is a function of its capabilities, inputs and imports": the
//     header lines are the module function's parameters, in order
//   "Export marks the binding, and a module with no exports is open"
//   "A block of bindings is one kernel primitive", "Sequence is one kernel
//     primitive"
//   "Machine arithmetic is a set of pure primitives that ships with the
//     platform": an operator is one shipped primitive
//   "A language checks the names it cares about": a name nothing binds is
//     refused at the end of the text
//
// How a name is written. Two kinds of name are told apart in the record,
// as the kernel tells them apart:
//   - a parameter of a function, and a header line, which is a parameter
//     of the module function: the function's param node. The kernel puts
//     the argument in its place when the function is applied;
//   - a name a block binds (`x = e`, `f(x) => e`, `x <- e`): a symbol node
//     whose name is the name as written. The kernel looks it up from where
//     it is used, and finds the innermost block's binding.
// A name Allegretto binds is the node it stands for: a kernel node, a
// primitive node of a shipped primitive, or the structure of one of `int`,
// `float`, `text` and `bits`. `is_failure` and `handle` are bound in a
// block around the module's own (`FAILURE_FUNCTIONS`), written only where
// the text uses one of the names. The emitter resolves every name
// lexically first, and refuses one nothing binds.
//
// How each form is written:
//   - `"text"`, `42`, `0xFF`, `1.5`, `true`, `false`: a bits node.
//   - `{a: e}`: a structure node keyed by the symbol `a`; `[e, f]`: one
//     with no keys. `` `a ``: the node `datum` of the symbol `a`.
//   - `{a: e, [k]: f}`: `put({a: e}, k, f)`, and each entry after a
//     computed key is put on what comes before it. Where `k` is a key's
//     header name the entry is private: the structure node's entry keyed by
//     the key's parameter.
//   - `x => e` and its kin: a function node; `f(a, b)`: an expression
//     node; `a |> f`: the expression node of `f(a)`.
//   - `p.a`: `get(p, `a)`, with `` `a `` a datum node; `p[i]`: `get(p, i)`.
//     A capability's part, `output.write`, is the same reading.
//   - `int.add` and the other names of forms.md §3: the shipped primitive;
//     `bits.join`, `bits.length`, `bits.slice`: the kernel's `join`,
//     `length`, `slice`. This means the same as reading the entry of the
//     structure, and is written so where the text does not bind the first
//     part again, so a record's `needs` lists only what the text uses.
//     `int` and its kin used as a value: the structure of the primitives.
//   - `then`, `also`, `attempt`, `describe`, `build`, `refuse`, `assume`,
//     `undecided`, `get`, `count`, `claim`, `put`, `key`, `kind`, `symbol`,
//     `spelling`: the kernel primitive of that name.
//   - `if c then a else b`: `if(c, a, b)`; `a && b`, `a || b`, `!a`:
//     `if(a, b, false)`, `if(a, true, b)`, `if(a, false, true)`.
//   - `+ - * / %`, `< > <= >=`, prefix `-`: `int.add` and its kin, one
//     shipped primitive each; `==`: `same(a, b)`; `!=`:
//     `if(same(a, b), false, true)`; `++`: `join(a, b)`.
//   - a block: `block(bindings, body)`, the bindings a structure keyed by
//     the symbols of their names, the body the chain of `also` of its
//     statements, or of `then` after `sync`. A block with no binding is
//     the chain alone.
//   - a statement whose value is dropped: `claim(!is_failure(a))`. The
//     last statement of a block, `x <- e` and a claim are not wrapped.
//   - `x <- e`: the binding `x: e` among the block's bindings, and the
//     statement `x` at its place, so the block is
//     `block({…, x: e}, … also(x, rest))`.
//   - the module: a function node whose parameters are the header lines,
//     keys first, with `declares` naming each but the keys, and the
//     record's `keys` counting them. Its body is its block, ended by the
//     structure of the bindings it yields, keyed by the symbols of their
//     names: those marked `export`, or all of them where none is. An
//     import is a binding, so a module with no export yields it too, in
//     written order with the others; no form marks an import `export`. So every
//     statement the module writes has its value dropped. The module's own
//     block is never a `sync` block: forms.md does not say where `sync`
//     would be written for it.
//
// The record is always of the second version: see `emitModule`.
//
// Tested by next/bootstrap/emit.test.ts and, through the launcher, by
// next/corpus/allegretto.test.ts over the programs of next/corpus/allegretto/.

import * as fs from "fs";
import * as path from "path";
import { read, type Expr, type Header, type Item, type Module, type Name, type Place } from "./reader.js";
import { check2, encode, SAVED_PROGRAM_FORMAT, SAVED_PROGRAM_VERSION_2, type Declared, type Need, type Node, type Ref, type SavedProgram } from "../kernel/saved-program.js";
import { shippedByName } from "../prims/index.js";

// ── The forms ─────────────────────────────────────────────────────────

/** The items of forms.md §4: what the kernel stream owes, each built by now. */
export const ITEMS = {
  1: "the block of bindings",
  2: "the kernel's primitives on bits",
  3: "reading a structure",
  4: "the shipped primitives",
  5: "a primitive function that refuses",
  6: "a symbol as data",
} as const;
export type ItemNumber = keyof typeof ITEMS;

/** A form of forms.md §2, by the name this file gives it. */
export type FormId =
  | "text" | "whole number" | "fraction" | "truth" | "structure" | "list" | "symbol"
  | "computed key" | "private entry"
  | "name" | "function" | "application" | "pipe" | "entry by key" | "entry at place" | "namespace"
  | "if" | "&& || !" | "claim" | "kernel name"
  | "integer operator" | "== !=" | "++" | "shipped name" | "bits name"
  | "binding" | "function binding" | "x <- e" | "block" | "statements" | "sync block"
  | "dropped statement" | "failure functions"
  | "capability" | "input" | "key" | "import" | "import with" | "import without" | "capability part" | "export";

export interface FormInfo {
  /** What the form stands for, in forms.md's words, and the node the emitter writes. */
  readonly standsFor: string;
}

/** Every form of forms.md §2 and what it stands for. Each is written; the tests run each on the kernel. */
export const FORMS: Readonly<Record<FormId, FormInfo>> = {
  "text": { standsFor: "bits: the text's UTF-8 bytes" },
  "whole number": { standsFor: "bits: 64, the number in two's complement, most significant byte first" },
  "fraction": { standsFor: "bits: 64, IEEE 754 binary64" },
  "truth": { standsFor: "bits of length one: 1 and 0" },
  "structure": { standsFor: "a structure whose keys are symbols" },
  "list": { standsFor: "a structure with no keys" },
  "symbol": { standsFor: "the symbol, as data: the node datum" },
  "computed key": { standsFor: "{a: e, [k]: f} is put({a: e}, k, f)" },
  "private entry": { standsFor: "[k]: e where k is a key's header name: the structure's entry keyed by the key's parameter" },
  "name": { standsFor: "what the name is bound to: a parameter, or a symbol the kernel looks up" },
  "function": { standsFor: "a composed function" },
  "application": { standsFor: "an application" },
  "pipe": { standsFor: "f(a)" },
  "entry by key": { standsFor: "get(p, the symbol as data)" },
  "entry at place": { standsFor: "get(p, i)" },
  "namespace": { standsFor: "int, float, text or bits as a value: the structure of its primitives" },
  "if": { standsFor: "the kernel's conditional" },
  "&& || !": { standsFor: "the kernel's conditional" },
  "claim": { standsFor: "the kernel's claim" },
  "kernel name": {
    standsFor: "a kernel primitive Allegretto binds a name to: then, also, attempt, describe, build, refuse, assume, undecided, get, count, put, key, kind, symbol, spelling",
  },
  "integer operator": { standsFor: "a shipped primitive on signed 64-bit integers: int.add and its kin" },
  "== !=": { standsFor: "same(a, b), and if(same(a, b), false, true)" },
  "++": { standsFor: "join(a, b)" },
  "shipped name": { standsFor: "a shipped pure primitive, by its name in forms.md §3" },
  "bits name": { standsFor: "a kernel primitive on bits: bits.join, bits.length, bits.slice" },
  "binding": { standsFor: "a binding in the enclosing block of bindings" },
  "function binding": { standsFor: "the binding f = (x, y) => e" },
  "x <- e": { standsFor: "the binding x = e in the block's one group, and the statement x at its place: block({…, x: e}, … also(x, rest))" },
  "block": { standsFor: "block(bindings, a chain of also); with no bindings, the chain alone" },
  "statements": { standsFor: "a chain of the kernel primitive also" },
  "sync block": { standsFor: "sync and an indented block: the same block around a chain of then" },
  "dropped statement": { standsFor: "a statement whose value is dropped: claim(!is_failure(a))" },
  "failure functions": { standsFor: "is_failure and handle, Allegretto's two functions, bound in a block around the module's own" },
  "capability": { standsFor: "a parameter of the module, declared as a capability" },
  "input": { standsFor: "a parameter of the module, declared as an input" },
  "key": { standsFor: "a parameter of the module placed before every other, counted by the record's keys" },
  "import": { standsFor: "a parameter of the module declared { role: module, name, identity }, and the binding name = <that parameter>(arguments): by default the importing module's capability or input of each name" },
  "import with": { standsFor: "for a name after with, the expression given, as that argument of the imported module" },
  "import without": { standsFor: "for a name after without, refuse(\"the capability c was withheld by the importing module\"), as that argument" },
  "capability part": { standsFor: "a part of a capability, read as an entry: get(output, `write)" },
  "export": { standsFor: "a binding marked to be yielded by the module" },
};

/** The names of forms.md §3. Each stands for the shipped primitive of that name. */
export const SHIPPED_NAMES: readonly string[] = [
  "int.add", "int.sub", "int.mul", "int.neg", "int.div", "int.mod", "int.lt", "int.gt", "int.le", "int.ge", "int.text", "text.int",
  "float.add", "float.sub", "float.mul", "float.div", "float.neg", "float.lt", "float.le", "float.text", "int.float", "float.int",
  "float.gt", "float.ge", "float.eq", "bits.int",
];
/** The names Allegretto binds to the kernel's primitives on bits (forms.md §4 item 2). */
const BITS_NAMES: Readonly<Record<string, string>> = { "bits.join": "join", "bits.length": "length", "bits.slice": "slice" };
/** The four structures Allegretto binds, whose entries are the primitives (forms.md §2, "Names, functions and application"). */
const NAMESPACES: readonly string[] = ["int", "float", "text", "bits"];
/** The kernel primitives Allegretto binds a name to (forms.md §2, "Control and claims", and `get` and `count` of §4 item 3). */
export const KERNEL_NAMES: readonly string[] = [
  "then", "also", "attempt", "describe", "build", "refuse", "assume", "undecided", "get", "count", "claim", "put", "key", "kind", "symbol", "spelling",
];
/** Every kernel primitive a record of this emitter may name. */
export const KERNEL_WRITTEN: readonly string[] = [
  "also", "assume", "attempt", "block", "build", "claim", "count", "describe", "get", "if", "join", "key", "kind", "length", "put", "refuse", "same",
  "slice", "spelling", "symbol", "then", "undecided",
];
/** The operators of forms.md §2 that stand for a shipped primitive, with its name. */
const INT_OPERATORS: Readonly<Record<string, string>> = {
  "+": "int.add", "-": "int.sub", "*": "int.mul", "/": "int.div", "%": "int.mod", "<": "int.lt", ">": "int.gt", "<=": "int.le", ">=": "int.ge",
};

/**
 * Allegretto's two functions for a failure, as forms.md §2 "Failures"
 * writes them. The one place their text is kept. The emitter reads it with
 * the reader every text is read with, and binds both names in a block
 * around the module's own, so a text may bind either name again and hide
 * it. A test holds this text to the forms' own.
 */
export const FAILURE_FUNCTIONS = `is_failure(x) =>
  if kind(x) == \`structure
  then if count(x) == 0 then false
       else if kind(key(x, 0)) == \`symbol then key(x, 0) == \`failure else false
  else false

handle(x, name, handler) =>
  if is_failure(x) && x.failure == name then handler(x) else x
`;
/** The names `FAILURE_FUNCTIONS` binds. */
const FAILURE_NAMES: readonly string[] = ["is_failure", "handle"];

let failureItems: ReadonlyArray<Extract<Item, { k: "function" }>> | undefined;
/** The two functions, read once. */
function failureFunctions(): ReadonlyArray<Extract<Item, { k: "function" }>> {
  if (failureItems !== undefined) return failureItems;
  const r = read(FAILURE_FUNCTIONS);
  if (!r.ok) throw new Error(`the failure functions are not Allegretto: ${r.findings.map((f) => f.message).join("; ")}`);
  const fns = r.module.items.filter((i): i is Extract<Item, { k: "function" }> => i.k === "function");
  if (r.module.headers.length > 0 || fns.length !== r.module.items.length || fns.map((f) => f.name.name).join() !== FAILURE_NAMES.join())
    throw new Error("the failure functions are not the two function bindings is_failure and handle");
  return (failureItems = fns);
}

/** Why a text is not emitted, at a place. */
export interface Finding {
  readonly at: Place;
  /**
   * "read": the reader refused the text. "unbound", "rebound": a name.
   * "refused": a block with no statement, which has no value. "waits": a
   * name of forms.md §3 that the shipped primitives lack. "import": an
   * import whose declarations and identity are not supplied, or whose
   * arguments do not match what the imported module declares.
   */
  readonly kind: "read" | "waits" | "unbound" | "rebound" | "refused" | "import";
  /** The form, for "waits". */
  readonly form?: FormId;
  /** The items of forms.md §4 it waits on, for "waits". */
  readonly items?: readonly ItemNumber[];
  readonly message: string;
}

/**
 * What the emitter needs of an imported module: what it declares, in its
 * order (the `declares` of its record), and its identity, as
 * `Kernel2.moduleOf` gives it for the loaded record.
 */
export interface ImportedModule {
  readonly declares: ReadonlyArray<Pick<Declared, "role" | "name">>;
  readonly identity: string;
}

/** The imported modules a text's imports name, by the name each is imported under. */
export type Imports = ReadonlyMap<string, ImportedModule>;

/** The reason a withheld capability or input refuses with, where the imported module uses it (forms.md §2, "The module"). */
export function withheldReason(name: string): string {
  return `the capability ${name} was withheld by the importing module`;
}

export type EmitResult =
  | { readonly ok: true; readonly program: SavedProgram; readonly forms: readonly FormId[] }
  | { readonly ok: false; readonly findings: readonly Finding[]; readonly forms: readonly FormId[] };

/** One line for a finding, for a person. */
export function describeFinding(f: Finding, file = "<text>"): string {
  return `${file}:${f.at.line}:${f.at.column}: ${f.message}`;
}

// ── The record being built ────────────────────────────────────────────

class Builder {
  readonly nodes: Node[] = [];
  private readonly shared = new Map<string, Ref>();
  add(n: Node): Ref {
    this.nodes.push(n);
    return this.nodes.length - 1;
  }
  /** A node with no parts, written once: bits, a symbol, a datum, a kernel primitive, a shipped primitive. */
  constant(n: Node): Ref {
    const key = JSON.stringify(n);
    let r = this.shared.get(key);
    if (r === undefined) this.shared.set(key, (r = this.add(n)));
    return r;
  }
  bits(bytes: Uint8Array, bitLength: number): Ref {
    return this.constant({ k: "bits", hex: Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(""), bits: bitLength });
  }
  kernel(name: string): Ref {
    return this.constant({ k: "kernel", name });
  }
  symbol(fqn: string): Ref {
    return this.constant({ k: "symbol", fqn });
  }
  datum(fqn: string): Ref {
    return this.constant({ k: "datum", fqn });
  }
  primitive(hash: string): Ref {
    return this.constant({ k: "primitive", hash });
  }
  apply(fn: Ref, args: readonly Ref[]): Ref {
    return this.add({ k: "expression", fn, args });
  }
  param(name: string): Ref {
    return this.add({ k: "param", name });
  }
  fn(params: readonly Ref[], body: Ref): Ref {
    return this.add({ k: "function", params, body });
  }
  structure(entries: ReadonlyArray<readonly [Ref | null, Ref]>): Ref {
    return this.add({ k: "structure", entries });
  }
}

/** A whole number's 64 bits, two's complement, most significant byte first. */
function intBytes(n: bigint): Uint8Array {
  const out = new Uint8Array(8);
  new DataView(out.buffer).setBigInt64(0, n, false);
  return out;
}
/** A fraction's 64 bits, IEEE 754 binary64, most significant byte first. */
function floatBytes(x: number): Uint8Array {
  const out = new Uint8Array(8);
  new DataView(out.buffer).setFloat64(0, x, false);
  return out;
}

/** A literal of forms.md §2 that stands for bits: a text, a whole number, a fraction, a truth value. */
export type BitsLiteral = Extract<Expr, { k: "text" | "int" | "float" | "truth" }>;

/**
 * The bits a literal stands for, as this emitter writes them. The one
 * encoding of each literal: the emitter writes it, and the reader of an
 * input's value (next/bootstrap/literal.ts) reads it.
 */
export function literalBits(e: BitsLiteral): { readonly bytes: Uint8Array; readonly bitLength: number } {
  switch (e.k) {
    case "text":
      return { bytes: e.bytes, bitLength: e.bytes.length * 8 };
    case "int":
      return { bytes: intBytes(e.value), bitLength: 64 };
    case "float":
      return { bytes: floatBytes(e.value), bitLength: 64 };
    case "truth":
      return { bytes: Uint8Array.of(e.value ? 1 : 0), bitLength: 1 };
  }
}

/** No node: a text with a finding writes no record. */
const NONE: Ref = -1;

/** What a name stands for where it is used. */
type Meaning =
  /** A parameter of a function, or a header line. */
  | { readonly k: "param"; readonly ref: Ref; readonly role?: Header["k"] }
  /** A name a block binds: a symbol the kernel looks up. */
  | { readonly k: "symbol"; readonly name: string }
  | { readonly k: "kernel"; readonly name: string }
  /** `int`, `float`, `text` or `bits`: a structure Allegretto binds. */
  | { readonly k: "namespace"; readonly name: string }
  /** `is_failure` or `handle`: bound in the block around the module's own. */
  | { readonly k: "failure function"; readonly name: string };

class Scope {
  readonly names = new Map<string, Meaning>();
  constructor(readonly parent: Scope | undefined) {}
  lookup(name: string): Meaning | undefined {
    for (let s: Scope | undefined = this; s !== undefined; s = s.parent) {
      const m = s.names.get(name);
      if (m !== undefined) return m;
    }
    return undefined;
  }
}

type BindingItem = Extract<Item, { k: "binding" | "function" | "arrow" }>;
const isBinding = (i: Item): i is BindingItem => i.k === "binding" || i.k === "function" || i.k === "arrow";

// ── Emitting ──────────────────────────────────────────────────────────

/**
 * Emits a module read from a text.
 *
 * The record is always of the second version. A symbol as data, the node
 * `datum`, needs it, and a text holds one as soon as it reads a key with
 * `.`, which every text that prints does. Writing every record so keeps one
 * rule: a text is one module (forms.md §2), and `load` has the kernel make
 * every record into one, with its identity. A text's record does not
 * change version when the text gains a `.`. A record has a key slot for
 * each `key` header line, and no stored outcomes.
 */
export function emitModule(module: Module, imports: Imports = new Map()): EmitResult {
  const b = new Builder();
  const findings: Finding[] = [];
  const forms = new Set<FormId>();
  const unbound: Array<{ name: string; at: Place }> = [];
  const needs = new Map<string, Need>();

  /** Binds a name in a block, refusing a second binding of it there. */
  const bind = (scope: Scope, name: Name, meaning: Meaning): void => {
    if (scope.names.has(name.name)) {
      findings.push({ at: name.at, kind: "rebound", message: `the name ${name.name} is bound twice in one block` });
      return;
    }
    scope.names.set(name.name, meaning);
  };

  const allegretto = new Scope(undefined);
  for (const name of KERNEL_NAMES) allegretto.names.set(name, { k: "kernel", name });
  for (const name of NAMESPACES) allegretto.names.set(name, { k: "namespace", name });
  const failures = new Scope(allegretto);
  for (const name of FAILURE_NAMES) failures.names.set(name, { k: "failure function", name });
  /** True once the text uses `is_failure` or `handle` by name: the module's block is then put in the block that binds them. */
  let failuresUsed = false;

  const truth = (value: boolean): Ref => {
    const { bytes, bitLength } = literalBits({ k: "truth", value, at: { start: 0, end: 0, line: 1, column: 1 } });
    return b.bits(bytes, bitLength);
  };
  const FALSE = (): Ref => truth(false);
  const TRUE = (): Ref => truth(true);
  const cond = (c: Ref, a: Ref, e: Ref): Ref => b.apply(b.kernel("if"), [c, a, e]);
  const shipped = (name: string, at: Place, form: FormId): Ref => {
    forms.add(form);
    const p = shippedByName.get(name);
    if (p === undefined) {
      findings.push({ at, kind: "waits", form, items: [4], message: `the shipped primitive ${name} waits on forms.md §4 item 4 (${ITEMS[4]}): next/prims/index.ts does not ship it` });
      return NONE;
    }
    needs.set(p.hash, { hash: p.hash, name: p.name });
    return b.primitive(p.hash);
  };

  /** The structure one of `int`, `float`, `text` and `bits` stands for, written once: its entries keyed by the names after the dot. */
  const namespaceNodes = new Map<string, Ref>();
  const namespace = (name: string, at: Place): Ref => {
    let r = namespaceNodes.get(name);
    if (r !== undefined) return r;
    const prefix = `${name}.`;
    const entries: Array<readonly [Ref, Ref]> = [];
    for (const full of SHIPPED_NAMES) if (full.startsWith(prefix)) entries.push([b.symbol(full.slice(prefix.length)), shipped(full, at, "namespace")]);
    for (const [full, kernel] of Object.entries(BITS_NAMES)) if (full.startsWith(prefix)) entries.push([b.symbol(full.slice(prefix.length)), b.kernel(kernel)]);
    namespaceNodes.set(name, (r = b.structure(entries)));
    return r;
  };

  /** The function nodes of `is_failure` and `handle`, each written once, in the scope that binds the two, with the forms of the text left as they were. */
  const failureNodes = new Map<string, Ref>();
  const failureFunction = (name: string): Ref => {
    let r = failureNodes.get(name);
    if (r !== undefined) return r;
    const kept = [...forms];
    const it = failureFunctions().find((f) => f.name.name === name) as Extract<Item, { k: "function" }>;
    r = bindingValue(it, failures);
    forms.clear();
    for (const f of kept) forms.add(f);
    failureNodes.set(name, r);
    return r;
  };

  const named = (m: Meaning, at: Place): Ref => {
    switch (m.k) {
      case "param":
        return m.ref;
      case "symbol":
        return b.symbol(m.name);
      case "kernel":
        return b.kernel(m.name);
      case "namespace":
        return namespace(m.name, at);
      case "failure function":
        failuresUsed = true;
        return b.symbol(m.name);
    }
  };
  /** The key parameter a computed key names, where it is a key's header name. */
  const keyParam = (k: Expr, scope: Scope): Ref | undefined => {
    if (k.k !== "name") return undefined;
    const m = scope.lookup(k.name);
    return m?.k === "param" && m.role === "key" ? m.ref : undefined;
  };

  const expr = (e: Expr, scope: Scope): Ref => {
    switch (e.k) {
      case "text":
      case "int":
      case "float":
      case "truth": {
        forms.add(e.k === "text" ? "text" : e.k === "int" ? "whole number" : e.k === "float" ? "fraction" : "truth");
        const { bytes, bitLength } = literalBits(e);
        return b.bits(bytes, bitLength);
      }
      case "symbol":
        forms.add("symbol");
        return b.datum(e.name);
      case "name": {
        const m = scope.lookup(e.name);
        if (m === undefined) {
          forms.add("name");
          unbound.push({ name: e.name, at: e.at });
          return NONE;
        }
        forms.add(
          m.k === "kernel" ? (m.name === "claim" ? "claim" : "kernel name") : m.k === "namespace" ? "namespace" : m.k === "failure function" ? "failure functions" : "name",
        );
        return named(m, e.at);
      }
      case "lambda": {
        forms.add("function");
        const inner = new Scope(scope);
        const params = e.params.map((p) => {
          const ref = b.param(p.name);
          bind(inner, p, { k: "param", ref });
          return ref;
        });
        return b.fn(params, expr(e.body, inner));
      }
      case "apply": {
        forms.add("application");
        const fn = expr(e.fn, scope);
        const args = e.args.map((a) => expr(a, scope));
        return b.apply(fn, args);
      }
      case "pipe": {
        forms.add("pipe");
        const value = expr(e.value, scope);
        const fn = expr(e.fn, scope);
        return b.apply(fn, [value]);
      }
      case "dot": {
        // `int.add` and its kin, where the structure is Allegretto's: the primitive itself, which means the same as reading the entry.
        if (e.object.k === "name" && scope.lookup(e.object.name)?.k === "namespace") {
          const full = `${e.object.name}.${e.name.name}`;
          if (SHIPPED_NAMES.includes(full)) return shipped(full, e.at, "shipped name");
          if (full in BITS_NAMES) {
            forms.add("bits name");
            return b.kernel(BITS_NAMES[full]);
          }
          forms.add("name");
          unbound.push({ name: full, at: e.at });
          return NONE;
        }
        const object = e.object.k === "name" ? scope.lookup(e.object.name) : undefined;
        forms.add(object?.k === "param" && object.role === "capability" ? "capability part" : "entry by key");
        return b.apply(b.kernel("get"), [expr(e.object, scope), b.datum(e.name.name)]);
      }
      case "index": {
        forms.add("entry at place");
        const object = expr(e.object, scope);
        return b.apply(b.kernel("get"), [object, expr(e.index, scope)]);
      }
      case "if": {
        forms.add("if");
        return cond(expr(e.condition, scope), expr(e.then, scope), expr(e.else, scope));
      }
      case "unary": {
        const operand = expr(e.operand, scope);
        if (e.op === "!") {
          forms.add("&& || !");
          return cond(operand, FALSE(), TRUE());
        }
        return b.apply(shipped("int.neg", e.at, "integer operator"), [operand]);
      }
      case "binary": {
        const left = expr(e.left, scope);
        const right = expr(e.right, scope);
        switch (e.op) {
          case "&&":
            forms.add("&& || !");
            return cond(left, right, FALSE());
          case "||":
            forms.add("&& || !");
            return cond(left, TRUE(), right);
          case "==":
            forms.add("== !=");
            return b.apply(b.kernel("same"), [left, right]);
          case "!=":
            forms.add("== !=");
            return cond(b.apply(b.kernel("same"), [left, right]), FALSE(), TRUE());
          case "++":
            forms.add("++");
            return b.apply(b.kernel("join"), [left, right]);
          default:
            return b.apply(shipped(INT_OPERATORS[e.op], e.at, "integer operator"), [left, right]);
        }
      }
      case "record": {
        // The entries up to the first computed key are the structure node, a private entry keyed by its key's
        // parameter among them; each entry from there on is put on what comes before it, in written order.
        forms.add("structure");
        const prefix: Array<readonly [Ref, Ref]> = [];
        let built: Ref | undefined;
        for (const f of e.fields) {
          const key = f.k === "named" ? undefined : keyParam(f.key, scope);
          if (f.k === "computed") forms.add(key !== undefined ? "private entry" : "computed key");
          if (built === undefined && (f.k === "named" || key !== undefined)) {
            prefix.push([f.k === "named" ? b.symbol(f.name.name) : (key as Ref), expr(f.value, scope)]);
            continue;
          }
          built ??= b.structure(prefix);
          const k = f.k === "named" ? b.datum(f.name.name) : key ?? expr(f.key, scope);
          built = b.apply(b.kernel("put"), [built, k, expr(f.value, scope)]);
        }
        return built ?? b.structure(prefix);
      }
      case "list": {
        forms.add("list");
        const entries = e.items.map((i) => [null, expr(i, scope)] as const);
        return b.structure(entries);
      }
      case "block": {
        forms.add("block");
        const value = block(e.items, new Scope(scope), undefined, e.sync);
        if (value === undefined) {
          findings.push({ at: e.at, kind: "refused", message: "a block with no statement has no value" });
          return NONE;
        }
        return value;
      }
    }
  };

  /** A binding's value: a function node for `f(x) => e`, the expression for `x = e`. */
  const bindingValue = (it: Extract<Item, { k: "binding" | "function" }>, scope: Scope): Ref => {
    if (it.k === "binding") return expr(it.value, scope);
    const inner = new Scope(scope);
    const params = it.params.map((p) => {
      const ref = b.param(p.name);
      bind(inner, p, { k: "param", ref });
      return ref;
    });
    return b.fn(params, expr(it.body, inner));
  };

  /** True for a statement that is itself a claim: an application of the kernel's claim. It needs no claim of its own. */
  const isClaim = (e: Expr, scope: Scope): boolean => {
    if (e.k !== "apply" || e.fn.k !== "name") return false;
    const m = scope.lookup(e.fn.name);
    return m?.k === "kernel" && m.name === "claim";
  };

  /**
   * A block. Its bindings, `x <- e` among them, are one group, bound
   * before anything is written, since they are order-free. Its statements
   * are a chain of `also` in written order, or of `then` in a `sync` block;
   * the statement of `x <- e` is `x` at its place. A statement whose value
   * is dropped is `claim(!is_failure(a))`, with Allegretto's `is_failure`
   * itself, so a text that binds the name again does not change what a
   * dropped statement means. A statement whose value is not dropped is the
   * block's last, and `x <- e`; a claim needs no claim of its own. `tail`
   * ends the chain where it is given: the module's structure of its
   * bindings, after which no written statement is the last. The value is
   * undefined for a block with no statement and no tail.
   */
  const block = (
    items: readonly Item[],
    scope: Scope,
    tail: (() => Ref) | undefined,
    sync: boolean,
    more: ReadonlyArray<{ readonly name: string; readonly value: () => Ref }> = [],
  ): Ref | undefined => {
    const group = items.filter(isBinding);
    for (const it of group) {
      forms.add(it.k === "binding" ? "binding" : it.k === "function" ? "function binding" : "x <- e");
      if (it.k !== "arrow" && it.exported) forms.add("export");
      bind(scope, it.name, { k: "symbol", name: it.name.name });
    }
    const values = [
      ...group.map((it) => [b.symbol(it.name.name), it.k === "arrow" ? expr(it.value, scope) : bindingValue(it, scope)] as const),
      ...more.map((m) => [b.symbol(m.name), m.value()] as const),
    ];

    const lines = items.filter((i): i is Extract<Item, { k: "statement" | "arrow" }> => i.k === "statement" || i.k === "arrow");
    if (lines.length > 1) forms.add("statements");
    if (sync) forms.add("sync block");
    const parts = lines.map((it, i) => {
      if (it.k === "arrow") return b.symbol(it.name.name);
      const value = expr(it.expr, scope);
      if ((tail === undefined && i === lines.length - 1) || isClaim(it.expr, scope)) return value;
      forms.add("dropped statement");
      return b.apply(b.kernel("claim"), [cond(b.apply(failureFunction("is_failure"), [value]), FALSE(), TRUE())]);
    });
    if (tail !== undefined) parts.push(tail());
    if (parts.length === 0) return undefined;
    let chain = parts[parts.length - 1];
    for (let i = parts.length - 2; i >= 0; i--) chain = b.apply(b.kernel(sync ? "then" : "also"), [parts[i], chain]);
    return values.length === 0 ? chain : b.apply(b.kernel("block"), [b.structure(values), chain]);
  };

  // The module: its header lines are its parameters, keys first, each role in written order; its block the body.
  // An import is a parameter declared as a module, with the imported module's identity, and a binding of the
  // module's block that calls that parameter (forms.md §2 "The module"): its name is a binding, not the parameter.
  const top = new Scope(failures);
  const keyParams: Ref[] = [];
  const params: Ref[] = [];
  const declares: Declared[] = [];
  const importLines: Array<{ readonly h: Header; readonly ref: Ref; readonly imported: ImportedModule | undefined }> = [];
  for (const h of module.headers) {
    forms.add(h.k);
    const ref = b.param(h.name.name);
    if (h.k === "key") {
      bind(top, h.name, { k: "param", ref, role: h.k });
      keyParams.push(ref);
    } else if (h.k === "import") {
      bind(top, h.name, { k: "symbol", name: h.name.name });
      params.push(ref);
      const imported = imports.get(h.name.name);
      declares.push(imported === undefined ? { param: ref, role: "module", name: h.name.name } : { param: ref, role: "module", name: h.name.name, identity: imported.identity });
      importLines.push({ h, ref, imported });
    } else {
      bind(top, h.name, { k: "param", ref, role: h.k });
      params.push(ref);
      declares.push({ param: ref, role: h.k, name: h.name.name });
    }
  }

  /** The value of an import's binding: the imported module's function applied to one argument for each capability and input it declares. */
  const importValue = ({ h, ref, imported }: (typeof importLines)[number]) => (): Ref => {
    const name = h.name.name;
    if (imported === undefined) {
      findings.push({ at: h.at, kind: "import", message: `the module ${name} is imported, and its declarations and identity were not supplied: the text it is read from is emitted first` });
      return NONE;
    }
    const takes = imported.declares.filter((d) => d.role !== "module");
    const declared = new Set(takes.map((d) => d.name));
    const handed = new Map<string, Expr>();
    const withheld = new Set<string>();
    for (const p of h.with) {
      forms.add("import with");
      if (!declared.has(p.name.name)) findings.push({ at: p.name.at, kind: "import", message: `the import of ${name} hands ${p.name.name} with with, and ${name} declares no capability or input ${p.name.name}` });
      else if (handed.has(p.name.name)) findings.push({ at: p.name.at, kind: "import", message: `the import of ${name} hands ${p.name.name} twice` });
      handed.set(p.name.name, p.value);
    }
    for (const c of h.without) {
      forms.add("import without");
      if (!declared.has(c.name)) findings.push({ at: c.at, kind: "import", message: `the import of ${name} withholds ${c.name}, and ${name} declares no capability or input ${c.name}` });
      else if (handed.has(c.name)) findings.push({ at: c.at, kind: "import", message: `the import of ${name} both hands and withholds ${c.name}` });
      else if (withheld.has(c.name)) findings.push({ at: c.at, kind: "import", message: `the import of ${name} withholds ${c.name} twice` });
      withheld.add(c.name);
    }
    const args = takes.map((d) => {
      const given = handed.get(d.name);
      if (given !== undefined) return expr(given, top);
      if (withheld.has(d.name)) {
        const reason = new TextEncoder().encode(withheldReason(d.name));
        return b.apply(b.kernel("refuse"), [b.bits(reason, reason.length * 8)]);
      }
      const own = top.names.get(d.name);
      if (own?.k === "param" && (own.role === "capability" || own.role === "input")) return own.ref;
      findings.push({
        at: h.at,
        kind: "import",
        message: `${name} declares the ${d.role} ${d.name}, which this module neither holds under that name, nor hands with with, nor withholds`,
      });
      return NONE;
    });
    return b.apply(ref, args);
  };

  // What the module yields: the structure of its bindings, keyed by the symbols of their names, in written order. An
  // import is a binding; a key's header name is none.
  const own = module.items.filter(isBinding);
  const exported = own.filter((i) => i.k !== "arrow" && i.exported);
  const yielded =
    exported.length > 0
      ? exported.map((i) => i.name)
      : [...own.map((i) => i.name), ...importLines.map((l) => l.h.name)].sort((x, y) => x.at.start - y.at.start);
  const more = importLines.map((l) => ({ name: l.h.name.name, value: importValue(l) }));
  let body = block(module.items, top, () => b.structure(yielded.map((n) => [b.symbol(n.name), b.symbol(n.name)] as const)), false, more) as Ref;
  if (failuresUsed)
    body = b.apply(b.kernel("block"), [b.structure(FAILURE_NAMES.map((n) => [b.symbol(n), failureFunction(n)] as const)), body]);
  for (const u of unbound) findings.push({ at: u.at, kind: "unbound", message: `the name ${u.name} is bound nowhere in the text` });

  const used = [...forms].sort() as FormId[];
  if (findings.length > 0) return { ok: false, findings: [...findings].sort((x, y) => x.at.start - y.at.start), forms: used };
  const program: SavedProgram = {
    format: SAVED_PROGRAM_FORMAT,
    version: SAVED_PROGRAM_VERSION_2,
    needs: [...needs.values()].sort((x, y) => x.name.localeCompare(y.name)),
    nodes: b.nodes,
    module: b.fn([...keyParams, ...params], body),
    declares,
    keys: keyParams.length,
    outcomes: [],
  };
  const problems = check2(program);
  if (problems.length > 0) throw new Error(`the emitter wrote a record that does not check: ${problems.join("; ")}`);
  return { ok: true, program, forms: used };
}

/** Reads a text and emits it, with the declarations and identity of each module it imports. */
export function emit(text: string, imports: Imports = new Map()): EmitResult {
  const r = read(text);
  if (!r.ok) return { ok: false, findings: r.findings.map((f) => ({ at: f.at, kind: "read" as const, message: f.message })), forms: [] };
  return emitModule(r.module, imports);
}

// ── The command ───────────────────────────────────────────────────────

async function main(argv: readonly string[]): Promise<number> {
  const usage = "usage: npx tsx next/bootstrap/emit.ts <file> [-o out.json]";
  const o = argv.indexOf("-o");
  const out = o >= 0 ? argv[o + 1] : undefined;
  const files = argv.filter((a, i) => a !== "-o" && (o < 0 || i !== o + 1));
  if (files.length !== 1 || (o >= 0 && out === undefined)) {
    console.error(usage);
    return 2;
  }
  const file = files[0];
  // The driver imports this file, so the command takes it only when it runs, once this file is evaluated.
  const { drive, describeDriveFinding } = await import("./driver.js");
  const r = drive(fs.readFileSync(file, "utf-8"), file, (f) => (fs.existsSync(f) ? fs.readFileSync(f, "utf-8") : undefined));
  if (!r.ok) {
    for (const f of r.findings) console.error(describeDriveFinding(f));
    return 1;
  }
  const records = r.records;
  const text = encode(records[records.length - 1].program);
  if (out === undefined) process.stdout.write(text);
  else fs.writeFileSync(out, text);
  for (const x of records.slice(0, -1))
    console.error(`${file}: needs the record of ${x.file}; npm run launch takes it by --import, in the order of these lines`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) void main(process.argv.slice(2)).then((code) => (process.exitCode = code));
