// The emitter of Allegretto (B-196 (the rebuild's acceptance side), chunk
// Q5 (the first notation and the bootstrap), part 2): a text read by
// next/bootstrap/reader.ts becomes a saved program in the data form of
// next/kernel/saved-program.ts.
//
//   npm run emit -- <file> [-o out.json]
//   npx tsx next/bootstrap/emit.ts <file> [-o out.json]
//
// Each form becomes exactly what next/ext/allegretto/forms.md says it
// stands for. Where the kernel thing a form stands for does not exist
// yet, the emitter gives a finding that names the item of forms.md §4 it
// waits on, and writes no record. It never writes an encoding of its own
// for such a form. `emit` returns every finding of a text, so the census
// (next/bootstrap/census.ts) counts what the emitter refuses on.
//
// What it realises, from docs/plans/book-pass-inventory.md:
//   "Allegretto is a small language for the kernel and nothing else"
//   "A saved program is a recorded sequence of interface calls": the
//     record constructs values only; names are resolved here
//   "A module is a function of its capabilities, inputs and imports": the
//     header lines are the module function's parameters, in order
//   "Sequence is one kernel primitive": a block's statements are a chain
//     of the kernel primitive `then`
//   "A language checks the names it cares about": a name nothing binds is
//     refused at the end of the text
//
// How each form is written, today:
//   - `"text"`, `42`, `0xFF`, `1.5`, `true`, `false`: a bits node.
//   - `x`: the node the name is bound to: a parameter, or one of the
//     kernel's primitives `then`, `attempt`, `describe`, `build`, `claim`.
//     No name is written as a symbol, so nothing rests on a scope.
//   - `x => e` and its kin: a function node; `f(a, b)` an expression
//     node; `a |> f` the expression node of `f(a)`.
//   - `if c then a else b`: `if(c, a, b)` of the kernel; `a && b`,
//     `a || b`, `!a`: `if(a, b, false)`, `if(a, true, b)`,
//     `if(a, false, true)`.
//   - `{a: e}`: a structure node keyed by the symbol `a`; `[e, f]`: a
//     structure node with no keys.
//   - a block's statements `s1`, `s2`, `s3`: `then(s1, then(s2, s3))`.
//   - `x <- e` followed by the rest `r` of the block:
//     `((x) => then(x, r))(e)`. The kernel puts `e`, unevaluated and
//     shared, in place of `x`; `then` needs its first argument, so `e` is
//     evaluated there, after the statements before it; every use of `x`
//     in `r` reads that one value, since an argument is evaluated at most
//     once. Where nothing follows, the block's value is `e`.
//   - the module: a function node whose parameters are the header lines,
//     in order, with `declares` naming each. Its body is the chain of its
//     statements, ended by the structure of its bindings
//     (forms.md §2, "The module"): today that structure is empty, since a
//     module with a binding waits on the block of bindings.
//
// What it does not write: see `FORMS`. Every finding names its form and,
// where there is one, the item of forms.md §4 it waits on.
//
// Tested by next/bootstrap/emit.test.ts.

import * as fs from "fs";
import * as path from "path";
import { read, type Expr, type Header, type Item, type Module, type Name, type Place } from "./reader.js";
import { check2, encode, SAVED_PROGRAM_FORMAT, SAVED_PROGRAM_VERSION, type Declared, type Node, type Ref, type SavedProgram } from "../kernel/saved-program.js";

// ── The forms and what each waits on ──────────────────────────────────

/** The items of forms.md §4: what the kernel stream owes. */
export const ITEMS = {
  1: "the block of bindings",
  2: "the kernel's primitives on bits",
  3: "reading a structure",
  4: "the shipped primitives",
  5: "a primitive function that refuses",
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
  /** What the form stands for, in forms.md's words. */
  readonly standsFor: string;
  /**
   * The items of forms.md §4 it waits on: empty when it is emitted today.
   * `null` where it waits on something forms.md §4 does not list.
   */
  readonly waits: readonly ItemNumber[] | null;
}

/** Every form of forms.md §2, what it stands for, and what it waits on. Checked against the kernel by the tests. */
export const FORMS: Readonly<Record<FormId, FormInfo>> = {
  "text": { standsFor: "bits: the text's UTF-8 bytes", waits: [] },
  "whole number": { standsFor: "bits: 64, the number in two's complement, most significant byte first", waits: [] },
  "fraction": { standsFor: "bits: 64, IEEE 754 binary64", waits: [] },
  "truth": { standsFor: "bits of length one: 1 and 0", waits: [] },
  "structure": { standsFor: "a structure whose keys are symbols", waits: [] },
  "list": { standsFor: "a structure with no keys", waits: [] },
  "symbol": { standsFor: "the symbol, as data: the data form has no node that puts a symbol in an expression as data, and the kernel has no quotation", waits: null },
  "name": { standsFor: "what the name is bound to", waits: [] },
  "function": { standsFor: "a composed function", waits: [] },
  "application": { standsFor: "an application", waits: [] },
  "pipe": { standsFor: "f(a)", waits: [] },
  "entry by key": { standsFor: "reading the entry keyed by a symbol", waits: [3] },
  "entry at place": { standsFor: "reading the entry at a place, counted from 0", waits: [3] },
  "if": { standsFor: "the kernel's conditional", waits: [] },
  "&& || !": { standsFor: "the kernel's conditional", waits: [] },
  "claim": { standsFor: "the kernel's claim", waits: [] },
  "kernel name": { standsFor: "a kernel primitive Allegretto binds a name to: then, attempt, describe, build", waits: [] },
  "integer operator": { standsFor: "a shipped primitive on signed 64-bit integers: int.add and its kin", waits: [4] },
  "== !=": { standsFor: "the kernel's primitive that tells two bits values apart, and its negation", waits: [2] },
  "++": { standsFor: "the kernel's primitive that joins two bits values", waits: [2] },
  "shipped name": { standsFor: "a shipped pure primitive, by its name in forms.md §3", waits: [4] },
  "bits name": { standsFor: "a kernel primitive on bits: bits.join, bits.length, bits.slice", waits: [2] },
  "binding": { standsFor: "a binding in the enclosing block of bindings", waits: [1] },
  "function binding": { standsFor: "the binding f = (x, y) => e", waits: [1] },
  "x <- e": { standsFor: "a statement: e happens here, and x is bound to its value for the rest of the block", waits: [] },
  "block": { standsFor: "a block of bindings around a chain of then; with no bindings, the chain alone", waits: [] },
  "statements": { standsFor: "a chain of the kernel primitive then", waits: [] },
  "capability": { standsFor: "a parameter of the module, declared as a capability", waits: [] },
  "input": { standsFor: "a parameter of the module, declared as an input", waits: [] },
  "import": { standsFor: "a parameter of the module, declared as another module", waits: [] },
  "capability part": { standsFor: "a part of a capability, read as an entry", waits: [3] },
  "export": { standsFor: "a binding marked to be yielded by the module", waits: [1] },
};

/** The names of forms.md §3, as Allegretto writes them, with the items each waits on. */
const SHIPPED: ReadonlyMap<string, readonly ItemNumber[]> = new Map<string, readonly ItemNumber[]>([
  ...["int.add", "int.sub", "int.mul", "int.neg", "int.lt", "int.gt", "int.le", "int.ge", "int.text", "int.float"].map((n): [string, readonly ItemNumber[]] => [n, [4]]),
  ...["int.div", "int.mod", "text.int"].map((n): [string, readonly ItemNumber[]] => [n, [4, 5]]),
  ...["float.add", "float.sub", "float.mul", "float.div", "float.neg", "float.lt", "float.le", "float.text", "float.int"].map((n): [string, readonly ItemNumber[]] => [n, [4]]),
]);
const BITS_NAMES: readonly string[] = ["bits.join", "bits.length", "bits.slice"];
const NAMESPACES: readonly string[] = ["int", "float", "text", "bits"];
/** The kernel primitives Allegretto binds a name to (forms.md §2, "Control and claims"). */
const KERNEL_NAMES: readonly string[] = ["then", "attempt", "describe", "build", "claim"];
/** The operators of forms.md §2 that stand for a shipped primitive, with its name. */
const INT_OPERATORS: Readonly<Record<string, string>> = {
  "+": "int.add", "-": "int.sub", "*": "int.mul", "/": "int.div", "%": "int.mod", "<": "int.lt", ">": "int.gt", "<=": "int.le", ">=": "int.ge",
};

/** Why a text is not emitted, at a place. */
export interface Finding {
  readonly at: Place;
  /**
   * "read": the reader refused the text. "waits": the form waits on the
   * kernel stream. "unbound", "rebound": a name. "refused": a block with
   * no statement, which has no value.
   */
  readonly kind: "read" | "waits" | "unbound" | "rebound" | "refused";
  /** The form, for "waits"; the name, for "unbound" and "rebound". */
  readonly form?: FormId;
  /** The items of forms.md §4 it waits on, for "waits"; empty where forms.md §4 lists none. */
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
  /** A node with no parts, written once: bits, a symbol, a kernel primitive. */
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

/** No node: a form that waits writes none, and the record is not written. */
const NONE: Ref = -1;

/** What a name stands for where it is used. */
type Meaning =
  | { readonly k: "param"; readonly ref: Ref; readonly role?: Header["k"] }
  | { readonly k: "kernel"; readonly name: string }
  /** Bound by a binding that waits on the block of bindings. */
  | { readonly k: "waiting" };

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

/** Emits a module read from a text. */
export function emitModule(module: Module): EmitResult {
  const b = new Builder();
  const findings: Finding[] = [];
  const forms = new Set<FormId>();
  const unbound: Array<{ name: string; at: Place }> = [];

  const waits = (form: FormId, at: Place, what: string, items: readonly ItemNumber[] | null = FORMS[form].waits): Ref => {
    forms.add(form);
    const on = items === null || items.length === 0
      ? "a way to put a symbol in an expression as data, which forms.md §4 does not list"
      : items.map((i) => `forms.md §4 item ${i} (${ITEMS[i]})`).join(" and ");
    findings.push({ at, kind: "waits", form, items: items ?? [], message: `${what} waits on ${on}` });
    return NONE;
  };
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

  const FALSE = (): Ref => b.bits(Uint8Array.of(0), 1);
  const TRUE = (): Ref => b.bits(Uint8Array.of(1), 1);
  const cond = (c: Ref, a: Ref, e: Ref): Ref => b.apply(b.kernel("if"), [c, a, e]);

  const expr = (e: Expr, scope: Scope): Ref => {
    switch (e.k) {
      case "text":
        forms.add("text");
        return b.bits(e.bytes, e.bytes.length * 8);
      case "int":
        forms.add("whole number");
        return b.bits(intBytes(e.value), 64);
      case "float":
        forms.add("fraction");
        return b.bits(floatBytes(e.value), 64);
      case "truth":
        forms.add("truth");
        return e.value ? TRUE() : FALSE();
      case "symbol":
        return waits("symbol", e.at, `the symbol literal \`${e.name}`);
      case "name": {
        const m = scope.lookup(e.name);
        if (m === undefined) {
          forms.add("name");
          unbound.push({ name: e.name, at: e.at });
          return NONE;
        }
        if (m.k === "kernel") {
          forms.add(m.name === "claim" ? "claim" : "kernel name");
          return b.kernel(m.name);
        }
        forms.add("name");
        return m.k === "param" ? m.ref : NONE;
      }
      case "lambda": {
        forms.add("function");
        const inner = new Scope(scope);
        const params = e.params.map((p) => {
          const ref = b.param(p.name);
          bind(inner, p, { k: "param", ref });
          return ref;
        });
        const body = expr(e.body, inner);
        return b.fn(params, body);
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
          const shipped = SHIPPED.get(full);
          if (shipped !== undefined) return waits("shipped name", e.at, `the shipped primitive ${full}`, shipped);
          if (BITS_NAMES.includes(full)) return waits("bits name", e.at, `the kernel primitive ${full}`);
          forms.add("name");
          unbound.push({ name: full, at: e.at });
          return NONE;
        }
        const object = e.object.k === "name" ? scope.lookup(e.object.name) : undefined;
        expr(e.object, scope);
        if (object?.k === "param" && object.role === "capability")
          return waits("capability part", e.at, `the part ${e.name.name} of the capability ${(e.object as { name: string }).name}`);
        return waits("entry by key", e.at, `reading the entry ${e.name.name} of a structure`);
      }
      case "index":
        expr(e.object, scope);
        expr(e.index, scope);
        return waits("entry at place", e.at, "reading an entry of a structure at a place");
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
        return waits("integer operator", e.at, "the prefix - (int.neg)");
      }
      case "binary": {
        const left = expr(e.left, scope);
        const right = expr(e.right, scope);
        if (e.op === "&&" || e.op === "||") {
          forms.add("&& || !");
          return e.op === "&&" ? cond(left, right, FALSE()) : cond(left, TRUE(), right);
        }
        if (e.op === "==" || e.op === "!=") return waits("== !=", e.at, `the operator ${e.op}`);
        if (e.op === "++") return waits("++", e.at, "the operator ++");
        const prim = INT_OPERATORS[e.op];
        return waits("integer operator", e.at, `the operator ${e.op} (${prim})`, SHIPPED.get(prim) ?? [4]);
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

  /**
   * A block: its bindings bound first, since they are order-free, then
   * its statements in written order, as a chain of `then`. `tail` ends the
   * chain where it is given: the module's structure of its bindings. The
   * value is undefined for a block with no statement and no tail.
   */
  const block = (items: readonly Item[], scope: Scope, tail: (() => Ref) | undefined): Ref | undefined => {
    for (const it of items) {
      if (it.k === "binding") {
        forms.add("binding");
        if (it.exported) forms.add("export");
        bind(scope, it.name, { k: "waiting" });
      } else if (it.k === "function") {
        forms.add("function binding");
        if (it.exported) forms.add("export");
        bind(scope, it.name, { k: "waiting" });
      }
    }
    /** The names this block's `x <- e` lines bind, so a second binding of one in the block is refused. */
    const arrows = new Set<string>();
    const statements = items.filter((i) => i.k === "statement" || i.k === "arrow");
    if (statements.length > 1) forms.add("statements");
    /** The chain from the i-th line on, in the scope that line sees. */
    const rest = (i: number, here: Scope): Ref | undefined => {
      if (i === items.length) return tail?.();
      const it = items[i];
      if (it.k === "binding" || it.k === "function") {
        const what = it.k === "binding" ? `the binding ${it.name.name} = …` : `the function binding ${it.name.name}(…) => …`;
        waits(it.k === "binding" ? "binding" : "function binding", it.at, what);
        if (it.exported) waits("export", it.at, `export of the binding ${it.name.name}`);
        if (it.k === "binding") expr(it.value, here);
        else {
          const inner = new Scope(here);
          for (const p of it.params) bind(inner, p, { k: "param", ref: b.param(p.name) });
          expr(it.body, inner);
        }
        return rest(i + 1, here);
      }
      const more = tail !== undefined || items.slice(i + 1).some((j) => j.k === "statement" || j.k === "arrow");
      if (it.k === "statement") {
        const value = expr(it.expr, here);
        if (!more) return value;
        const after = rest(i + 1, here);
        return after === undefined ? value : b.apply(b.kernel("then"), [value, after]);
      }
      forms.add("x <- e");
      const value = expr(it.value, here);
      if (scope.names.has(it.name.name) || arrows.has(it.name.name))
        findings.push({ at: it.name.at, kind: "rebound", message: `the name ${it.name.name} is bound twice in one block` });
      arrows.add(it.name.name);
      // Nothing follows: the block's value is e's, and the name is bound for no line.
      if (!more) return value;
      // ((x) => then(x, rest))(e): e happens here, and x is bound to its value for the rest.
      const x = b.param(it.name.name);
      const after = new Scope(here);
      after.names.set(it.name.name, { k: "param", ref: x });
      const body = rest(i + 1, after) ?? x;
      return b.apply(b.fn([x], b.apply(b.kernel("then"), [x, body])), [value]);
    };
    return rest(0, scope);
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
  // What the module yields: the structure of its bindings. A binding waits on the block of bindings, so today it is empty.
  const body = block(module.items, top, () => b.structure([])) as Ref;
  for (const u of unbound) findings.push({ at: u.at, kind: "unbound", message: `the name ${u.name} is bound nowhere in the text` });

  const used = [...forms].sort() as FormId[];
  if (findings.length > 0) return { ok: false, findings: [...findings].sort((x, y) => x.at.start - y.at.start), forms: used };
  const program: SavedProgram = {
    format: SAVED_PROGRAM_FORMAT,
    version: SAVED_PROGRAM_VERSION,
    needs: [],
    nodes: b.nodes,
    module: b.fn(params, body),
    declares,
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
