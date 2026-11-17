// The emitter of Allegretto (B-196 (the rebuild's acceptance side), chunk
// Q5 (the first notation and the bootstrap), parts 2 and 3): a text read
// by next/bootstrap/reader.ts becomes a saved program in the data form of
// next/kernel/saved-program.ts.
//
//   npm run emit -- <file> [-o out.json]
//   npx tsx next/bootstrap/emit.ts <file> [-o out.json]
//
// Each form becomes exactly what next/ext/allegretto/forms.md §2 says it
// stands for, on the kernel as forms.md §4 lists it built. It never writes
// an encoding of its own for a form. `emit` returns every finding of a
// text, so the census (next/bootstrap/census.ts) counts what the emitter
// refuses.
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
// A name Allegretto binds is the node it stands for: a kernel node, or a
// primitive node of a shipped primitive. The emitter resolves every name
// lexically first, and refuses one nothing binds.
//
// How each form is written:
//   - `"text"`, `42`, `0xFF`, `1.5`, `true`, `false`: a bits node.
//   - `{a: e}`: a structure node keyed by the symbol `a`; `[e, f]`: one
//     with no keys. `` `a ``: the node `datum` of the symbol `a`.
//   - `x => e` and its kin: a function node; `f(a, b)`: an expression
//     node; `a |> f`: the expression node of `f(a)`.
//   - `p.a`: `get(p, `a)`, with `` `a `` a datum node; `p[i]`: `get(p, i)`.
//     A capability's part, `output.write`, is the same reading.
//   - `int.add` and the other names of forms.md §3: the shipped primitive;
//     `bits.join`, `bits.length`, `bits.slice`: the kernel's `join`,
//     `length`, `slice`; `then`, `attempt`, `describe`, `build`, `get`,
//     `count`, `claim`: the kernel primitive of that name.
//   - `if c then a else b`: `if(c, a, b)`; `a && b`, `a || b`, `!a`:
//     `if(a, b, false)`, `if(a, true, b)`, `if(a, false, true)`.
//   - `+ - * / %`, `< > <= >=`, prefix `-`: `int.add` and its kin, one
//     shipped primitive each; `==`: `same(a, b)`; `!=`:
//     `if(same(a, b), false, true)`; `++`: `join(a, b)`.
//   - a block: `block(bindings, body)`, the bindings a structure keyed by
//     the symbols of their names, the body the chain of `then` of its
//     statements. A block with no binding is the chain alone.
//   - `x <- e` followed by the rest `r` of the block:
//     `block({x: e}, then(x, r))`; where nothing follows, `e`. Where `e`
//     reads a name `x` an enclosing block binds, `e` is handed in as an
//     argument, `((t) => block({x: t}, then(x, r)))(e)`, so it still reads
//     the enclosing `x` and not itself.
//   - the module: a function node whose parameters are the header lines,
//     with `declares` naming each. Its body is its block, ended by the
//     structure of the bindings it yields, keyed by the symbols of their
//     names: those marked `export`, or all of them where none is.
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
  | "name" | "function" | "application" | "pipe" | "entry by key" | "entry at place"
  | "if" | "&& || !" | "claim" | "kernel name"
  | "integer operator" | "== !=" | "++" | "shipped name" | "bits name"
  | "binding" | "function binding" | "x <- e" | "block" | "statements"
  | "capability" | "input" | "import" | "capability part" | "export";

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
  "name": { standsFor: "what the name is bound to: a parameter, or a symbol the kernel looks up" },
  "function": { standsFor: "a composed function" },
  "application": { standsFor: "an application" },
  "pipe": { standsFor: "f(a)" },
  "entry by key": { standsFor: "get(p, the symbol as data)" },
  "entry at place": { standsFor: "get(p, i)" },
  "if": { standsFor: "the kernel's conditional" },
  "&& || !": { standsFor: "the kernel's conditional" },
  "claim": { standsFor: "the kernel's claim" },
  "kernel name": { standsFor: "a kernel primitive Allegretto binds a name to: then, attempt, describe, build, get, count" },
  "integer operator": { standsFor: "a shipped primitive on signed 64-bit integers: int.add and its kin" },
  "== !=": { standsFor: "same(a, b), and if(same(a, b), false, true)" },
  "++": { standsFor: "join(a, b)" },
  "shipped name": { standsFor: "a shipped pure primitive, by its name in forms.md §3" },
  "bits name": { standsFor: "a kernel primitive on bits: bits.join, bits.length, bits.slice" },
  "binding": { standsFor: "a binding in the enclosing block of bindings" },
  "function binding": { standsFor: "the binding f = (x, y) => e" },
  "x <- e": { standsFor: "block({x: e}, then(x, rest))" },
  "block": { standsFor: "block(bindings, a chain of then); with no bindings, the chain alone" },
  "statements": { standsFor: "a chain of the kernel primitive then" },
  "capability": { standsFor: "a parameter of the module, declared as a capability" },
  "input": { standsFor: "a parameter of the module, declared as an input" },
  "import": { standsFor: "a parameter of the module, declared as another module" },
  "capability part": { standsFor: "a part of a capability, read as an entry: get(output, `write)" },
  "export": { standsFor: "a binding marked to be yielded by the module" },
};

/** The names of forms.md §3. Each stands for the shipped primitive of that name. */
export const SHIPPED_NAMES: readonly string[] = [
  "int.add", "int.sub", "int.mul", "int.neg", "int.div", "int.mod", "int.lt", "int.gt", "int.le", "int.ge", "int.text", "text.int",
  "float.add", "float.sub", "float.mul", "float.div", "float.neg", "float.lt", "float.le", "float.text", "int.float", "float.int",
];
/** The names Allegretto binds to the kernel's primitives on bits (forms.md §4 item 2). */
const BITS_NAMES: Readonly<Record<string, string>> = { "bits.join": "join", "bits.length": "length", "bits.slice": "slice" };
const NAMESPACES: readonly string[] = ["int", "float", "text", "bits"];
/** The kernel primitives Allegretto binds a name to (forms.md §2, "Control and claims", and `get` and `count` of §4 item 3). */
export const KERNEL_NAMES: readonly string[] = ["then", "attempt", "describe", "build", "get", "count", "claim"];
/** Every kernel primitive a record of this emitter may name. */
export const KERNEL_WRITTEN: readonly string[] = ["attempt", "block", "build", "claim", "count", "describe", "get", "if", "join", "length", "same", "slice", "then"];
/** The operators of forms.md §2 that stand for a shipped primitive, with its name. */
const INT_OPERATORS: Readonly<Record<string, string>> = {
  "+": "int.add", "-": "int.sub", "*": "int.mul", "/": "int.div", "%": "int.mod", "<": "int.lt", ">": "int.gt", "<=": "int.le", ">=": "int.ge",
};

/** Why a text is not emitted, at a place. */
export interface Finding {
  readonly at: Place;
  /**
   * "read": the reader refused the text. "unbound", "rebound": a name.
   * "refused": a block with no statement, which has no value. "waits": a
   * name of forms.md §3 that the shipped primitives lack.
   */
  readonly kind: "read" | "waits" | "unbound" | "rebound" | "refused";
  /** The form, for "waits". */
  readonly form?: FormId;
  /** The items of forms.md §4 it waits on, for "waits". */
  readonly items?: readonly ItemNumber[];
  readonly message: string;
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
  | { readonly k: "kernel"; readonly name: string };

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

// ── Emitting ──────────────────────────────────────────────────────────

/**
 * Emits a module read from a text.
 *
 * The record is always of the second version. A symbol as data, the node
 * `datum`, needs it, and a text holds one as soon as it reads a key with
 * `.`, which every text that prints does. Writing every record so keeps one
 * rule: a text is one module (forms.md §2), and `load` has the kernel make
 * every record into one, with its identity. A text's record does not
 * change version when the text gains a `.`. A record has no key slots and
 * no stored outcomes.
 */
export function emitModule(module: Module): EmitResult {
  const b = new Builder();
  const findings: Finding[] = [];
  const forms = new Set<FormId>();
  const unbound: Array<{ name: string; at: Place }> = [];
  const needs = new Map<string, Need>();
  /** The meanings looked up while an expression is written, for each `x <- e` whose `e` is being written. */
  const trackers: Set<Meaning>[] = [];

  /** Binds a name in a block, refusing a second binding of it there. */
  const bind = (scope: Scope, name: Name, meaning: Meaning): void => {
    if (scope.names.has(name.name)) {
      findings.push({ at: name.at, kind: "rebound", message: `the name ${name.name} is bound twice in one block` });
      return;
    }
    scope.names.set(name.name, meaning);
  };
  const lookup = (scope: Scope, name: string): Meaning | undefined => {
    const m = scope.lookup(name);
    if (m !== undefined) for (const t of trackers) t.add(m);
    return m;
  };

  const allegretto = new Scope(undefined);
  for (const name of KERNEL_NAMES) allegretto.names.set(name, { k: "kernel", name });

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
  const named = (m: Meaning): Ref => (m.k === "param" ? m.ref : m.k === "symbol" ? b.symbol(m.name) : b.kernel(m.name));

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
        const m = lookup(scope, e.name);
        if (m === undefined) {
          forms.add("name");
          unbound.push({ name: e.name, at: e.at });
          return NONE;
        }
        forms.add(m.k !== "kernel" ? "name" : m.name === "claim" ? "claim" : "kernel name");
        return named(m);
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
        // `int.add` and its kin: a name of forms.md §3, where the first part is not bound.
        if (e.object.k === "name" && NAMESPACES.includes(e.object.name) && scope.lookup(e.object.name) === undefined) {
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
        forms.add("structure");
        const entries = e.fields.map((f) => [b.symbol(f.name.name), expr(f.value, scope)] as const);
        return b.structure(entries);
      }
      case "list": {
        forms.add("list");
        const entries = e.items.map((i) => [null, expr(i, scope)] as const);
        return b.structure(entries);
      }
      case "block": {
        forms.add("block");
        const value = block(e.items, new Scope(scope), undefined);
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

  /**
   * A block: its bindings are one group, bound before anything is written,
   * since they are order-free; its statements are a chain of `then` in
   * written order. `tail` ends the chain where it is given: the module's
   * structure of its bindings. The value is undefined for a block with no
   * statement and no tail.
   */
  const block = (items: readonly Item[], scope: Scope, tail: (() => Ref) | undefined): Ref | undefined => {
    const bindings = items.filter((i): i is Extract<Item, { k: "binding" | "function" }> => i.k === "binding" || i.k === "function");
    for (const it of bindings) {
      forms.add(it.k === "binding" ? "binding" : "function binding");
      if (it.exported) forms.add("export");
      bind(scope, it.name, { k: "symbol", name: it.name.name });
    }
    const values = bindings.map((it) => [b.symbol(it.name.name), bindingValue(it, scope)] as const);

    /** The names this block's `x <- e` lines bind, so a second binding of one in the block is refused. */
    const arrows = new Set<string>();
    const statements = items.filter((i) => i.k === "statement" || i.k === "arrow");
    if (statements.length > 1) forms.add("statements");
    /** The chain from the i-th statement on, in the scope that line sees. */
    const rest = (i: number, here: Scope): Ref | undefined => {
      if (i === statements.length) return tail?.();
      const it = statements[i];
      const more = tail !== undefined || i + 1 < statements.length;
      if (it.k === "statement") {
        const value = expr(it.expr, here);
        if (!more) return value;
        const after = rest(i + 1, here);
        return after === undefined ? value : b.apply(b.kernel("then"), [value, after]);
      }
      if (it.k !== "arrow") return undefined;
      forms.add("x <- e");
      const name = it.name.name;
      const outer = here.lookup(name);
      const read = new Set<Meaning>();
      trackers.push(read);
      const value = expr(it.value, here);
      trackers.pop();
      if (scope.names.has(name) || arrows.has(name))
        findings.push({ at: it.name.at, kind: "rebound", message: `the name ${name} is bound twice in one block` });
      arrows.add(name);
      // Nothing follows: the block's value is e's, and the name is bound for no line.
      if (!more) return value;
      // block({x: e}, then(x, rest)): e happens here, and x is bound to its value for the rest.
      const after = new Scope(here);
      after.names.set(name, { k: "symbol", name });
      const x = b.symbol(name);
      const body = rest(i + 1, after) ?? x;
      const chain = b.apply(b.kernel("then"), [x, body]);
      if (outer?.k === "symbol" && read.has(outer)) {
        // e reads the x of an enclosing block: it is handed in, so it does not read itself.
        const t = b.param(name);
        return b.apply(b.fn([t], b.apply(b.kernel("block"), [b.structure([[x, t]]), chain])), [value]);
      }
      return b.apply(b.kernel("block"), [b.structure([[x, value]]), chain]);
    };
    const body = rest(0, scope);
    if (body === undefined || bindings.length === 0) return body;
    return b.apply(b.kernel("block"), [b.structure(values), body]);
  };

  // The module: its header lines are its parameters, its block the body.
  const top = new Scope(allegretto);
  const params: Ref[] = [];
  const declares: Declared[] = [];
  for (const h of module.headers) {
    forms.add(h.k);
    const ref = b.param(h.name.name);
    bind(top, h.name, { k: "param", ref, role: h.k });
    params.push(ref);
    declares.push({ param: ref, role: h.k === "import" ? "module" : h.k, name: h.name.name });
  }
  // What the module yields: the structure of its bindings, keyed by the symbols of their names.
  const own = module.items.filter((i): i is Extract<Item, { k: "binding" | "function" }> => i.k === "binding" || i.k === "function");
  const yielded = own.some((i) => i.exported) ? own.filter((i) => i.exported) : own;
  const body = block(module.items, top, () => b.structure(yielded.map((i) => [b.symbol(i.name.name), b.symbol(i.name.name)] as const))) as Ref;
  for (const u of unbound) findings.push({ at: u.at, kind: "unbound", message: `the name ${u.name} is bound nowhere in the text` });

  const used = [...forms].sort() as FormId[];
  if (findings.length > 0) return { ok: false, findings: [...findings].sort((x, y) => x.at.start - y.at.start), forms: used };
  const program: SavedProgram = {
    format: SAVED_PROGRAM_FORMAT,
    version: SAVED_PROGRAM_VERSION_2,
    needs: [...needs.values()].sort((x, y) => x.name.localeCompare(y.name)),
    nodes: b.nodes,
    module: b.fn(params, body),
    declares,
    keys: 0,
    outcomes: [],
  };
  const problems = check2(program);
  if (problems.length > 0) throw new Error(`the emitter wrote a record that does not check: ${problems.join("; ")}`);
  return { ok: true, program, forms: used };
}

/** Reads a text and emits it. */
export function emit(text: string): EmitResult {
  const r = read(text);
  if (!r.ok) return { ok: false, findings: r.findings.map((f) => ({ at: f.at, kind: "read" as const, message: f.message })), forms: [] };
  return emitModule(r.module);
}

// ── The command ───────────────────────────────────────────────────────

function main(argv: readonly string[]): number {
  const usage = "usage: npx tsx next/bootstrap/emit.ts <file> [-o out.json]";
  const o = argv.indexOf("-o");
  const out = o >= 0 ? argv[o + 1] : undefined;
  const files = argv.filter((a, i) => a !== "-o" && (o < 0 || i !== o + 1));
  if (files.length !== 1 || (o >= 0 && out === undefined)) {
    console.error(usage);
    return 2;
  }
  const file = files[0];
  const r = emit(fs.readFileSync(file, "utf-8"));
  if (!r.ok) {
    for (const f of r.findings) console.error(describeFinding(f, file));
    return 1;
  }
  const text = encode(r.program);
  if (out === undefined) process.stdout.write(text);
  else fs.writeFileSync(out, text);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) process.exitCode = main(process.argv.slice(2));
