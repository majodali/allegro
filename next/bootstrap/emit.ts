// The bootstrap emitter (B-196 (the rebuild's acceptance side), chunk Q5
// (the first notation and the bootstrap), part 1): a text in the first
// notation becomes a saved program in the data form.
//
//   npm run emit -- <file> [-o out.json]
//   npx tsx next/bootstrap/emit.ts <file> [-o out.json]
//
// The notation is proposed in next/bootstrap/first-notation.md and is the
// maintainer's to rule; this file builds only the forms that proposal
// marks "expressible today", under its recommended options. Each choice
// below names the section or question of the proposal it follows.
//
// What it realises, from docs/plans/book-pass-inventory.md:
//   "A saved program is a recorded sequence of interface calls" (the
//     record constructs values and binds nothing; names are resolved here)
//   "A module is a function of the capabilities it declares" (the text is
//     one module function, its declared capabilities its parameters)
//   "Only the module being run performs effects when instantiated" (the
//     top-level effects sit in the body, in written order)
//   "Order of definition carries no meaning" (a function may be used
//     before its definition; a name bound twice is refused)
//   "Every notation stands for an expression" (each form stands for one
//     kernel expression; the mapping is this file's and computes nothing
//     the kernel would compute differently)
//
// How it reads a text: the present tree's parser reads it
// (next/bootstrap/present-reader.ts) and the emitter walks what that
// parser built. It never emits a record the kernel would evaluate
// differently from what the text says. Where it is in doubt, or a form
// needs something that does not exist yet, it gives a finding instead,
// naming the form and the need, and writes no record. `emit` returns
// every finding of the text, so the census (next/bootstrap/census.ts)
// counts the same needs the emitter refuses on.
//
// Tested by next/bootstrap/emit.test.ts.

import * as fs from "fs";
import * as path from "path";
import { readPresent, type PNode } from "./present-reader.js";
import { check2, encode, SAVED_PROGRAM_FORMAT, SAVED_PROGRAM_VERSION, type Declared, type Node, type Ref, type SavedProgram } from "../kernel/saved-program.js";

// ── Needs: what a form waits on ───────────────────────────────────────

/** Who must supply a need. */
export type NeedState =
  /** One of the kernel's own primitives, the kernel stream's (chunk K4 settles the list). */
  | "kernel primitive"
  /** A pure primitive function that ships with the platform, under next/prims/ (lane R). */
  | "shipped pure primitive"
  /** The standard language, written in Allegro under next/ext/ (lane R): milestone 4. */
  | "standard language"
  /** This stream's bootstrap: the reader of the present parse. */
  | "bootstrap"
  /** A question of next/bootstrap/first-notation.md §5 that the maintainer rules. */
  | "question"
  /** A present form a ruled decision removed. */
  | "not accepted";

export interface NeedInfo {
  readonly title: string;
  readonly state: NeedState;
  /** The decision, chunk or question that owns it. */
  readonly owner: string;
}

/** The needs the emitter can name. A present primitive it does not class is `prim:<name>`. */
export const NEEDS = {
  "bits-equal": { title: "telling two bits values apart (== and != on texts and truth values)", state: "kernel primitive", owner: "\"The kernel's primitives are pure and few\": telling bits apart; kernel chunk K4" },
  "structure-read": { title: "reading an entry of a structure (a field, an index)", state: "kernel primitive", owner: "\"The kernel's primitives are pure and few\": building and reading structures and expressions; kernel chunk K4" },
  "int-arith": { title: "integer arithmetic (+ - * / % and unary minus)", state: "shipped pure primitive", owner: "\"Machine arithmetic is a set of pure primitives that ships with the platform\"" },
  "int-compare": { title: "integer comparison (== != < > <= >= on numbers)", state: "shipped pure primitive", owner: "\"Machine arithmetic is a set of pure primitives that ships with the platform\"" },
  "float-arith": { title: "floating-point arithmetic", state: "shipped pure primitive", owner: "\"Machine arithmetic is a set of pure primitives that ships with the platform\"" },
  "float-compare": { title: "floating-point comparison", state: "shipped pure primitive", owner: "\"Machine arithmetic is a set of pure primitives that ships with the platform\"" },
  "text-concat": { title: "joining texts (+ on texts, interpolation)", state: "shipped pure primitive", owner: "\"The core types are built over bits\": a string is bits with a type; no decision names the text primitives (question 9)" },
  "int-to-text": { title: "an integer's decimal text (printing a number, interpolation)", state: "shipped pure primitive", owner: "question 9" },
  "float-to-text": { title: "a float's text (printing a float)", state: "shipped pure primitive", owner: "question 9" },
  "types": { title: "a type annotation, a typed function or a type check", state: "standard language", owner: "\"Nothing is a claim until someone makes it\"; milestone 4" },
  "match": { title: "when/is, patterns and guards", state: "standard language", owner: "the standard language's match extension, over bits-equal and structure-read; milestone 4" },
  "method": { title: "a method of a value's type (a name after a dot on a text or a number)", state: "standard language", owner: "\"The core types are built over bits\": an operator is a method of its operand's type; milestone 4" },
  "unbound": { title: "a name the text does not bind", state: "question", owner: "question 4 (\"A language checks the names it cares about\")" },
  "block-binding": { title: "a binding inside a block, which the present tree builder substitutes at each use", state: "bootstrap", owner: "this stream: a reader of the present parse tree that keeps the binding (question 5)" },
  "forward-value": { title: "a value binding used before its line", state: "question", owner: "question 5 (\"Order of definition carries no meaning\")" },
  "print-value": { title: "the value of print used", state: "question", owner: "question 7: the part write answers an empty structure; the present print answers its argument" },
  "print-sort": { title: "print of a value whose sort the emitter cannot see", state: "standard language", owner: "question 7: rendering by type needs the standard language's types; milestone 4" },
  "import": { title: "a module imported (import NAME)", state: "question", owner: "question 6; the launcher supplies no module yet, and reading its bindings needs structure-read" },
  "use": { title: "a grammar change (use NAME)", state: "not accepted", owner: "\"A text can change the grammar it is read in\": the first notation's grammar is fixed (§1)" },
  "export": { title: "export of a binding", state: "question", owner: "question 8: a module yields all its bindings" },
  "rebind": { title: "a name bound twice in one scope", state: "not accepted", owner: "\"Order of definition carries no meaning\": binding a name twice in one scope is an error" },
  "origin": { title: "the expression a value came from (source of)", state: "kernel primitive", owner: "the origin decision, reworded on PR #216: an origin is a description; not built on origin/main or in PR #216" },
  "block-value": { title: "a block whose value is its last statement's, after earlier statements", state: "kernel primitive", owner: "question 10; \"The kernel's primitives are pure and few\": making and reading structures, not built on origin/main or in PR #216" },
  "claim-value": { title: "a claim inside an expression rather than as a statement", state: "question", owner: "question 1; PR #216 evaluates an argument only when needed" },
  "parse": { title: "text the present parser does not read", state: "not accepted", owner: "the first notation is what the present parser reads (§1)" },
} as const satisfies Record<string, NeedInfo>;

export type NeedId = keyof typeof NEEDS | `prim:${string}`;

export function needInfo(id: NeedId): NeedInfo {
  if (id in NEEDS) return NEEDS[id as keyof typeof NEEDS];
  return { title: `the present tree's primitive ${id.slice(5)}`, state: "standard language", owner: "unclassed: the present parser put a primitive here that the first notation has no form for" };
}

/** A form the emitter cannot emit yet. */
export interface Finding {
  readonly need: NeedId;
  /** The form, as a reader names it. */
  readonly form: string;
  /** Why, in a sentence. */
  readonly why: string;
}

/** The forms of the first notation (first-notation.md §2), by the name the table gives each. */
export type FormId =
  | "text" | "number" | "truth" | "name" | "function" | "application" | "binding" | "sequence" | "conditional"
  | "logic" | "claim" | "recursion" | "structure" | "print";

export type EmitResult =
  | { readonly ok: true; readonly program: SavedProgram; readonly forms: readonly FormId[] }
  | { readonly ok: false; readonly findings: readonly Finding[]; readonly forms: readonly FormId[] };

// ── Sorts: what the emitter can see of a value without types ──────────

/**
 * What the emitter knows of a value from its form alone. "effect" is the
 * answer of print; "pending" is a recursive call whose sort is the
 * function's own (it takes the other branch's sort).
 */
type Sort = "text" | "number" | "float" | "truth" | "structure" | "function" | "effect" | "pending" | "unknown";

const merge = (a: Sort, b: Sort): Sort => (a === b ? a : a === "pending" ? b : b === "pending" ? a : "unknown");

// ── The record being built ────────────────────────────────────────────

class Builder {
  readonly nodes: Node[] = [];
  private readonly consts = new Map<string, Ref>();
  add(n: Node): Ref {
    this.nodes.push(n);
    return this.nodes.length - 1;
  }
  /** A node with no parts, shared: bits, a symbol, a kernel primitive. */
  constant(n: Node): Ref {
    const key = JSON.stringify(n);
    let r = this.consts.get(key);
    if (r === undefined) this.consts.set(key, (r = this.add(n)));
    return r;
  }
  bits(bytes: readonly number[], bitLength: number): Ref {
    return this.constant({ k: "bits", hex: bytes.map((b) => b.toString(16).padStart(2, "0")).join(""), bits: bitLength });
  }
  kernel(name: "if" | "claim"): Ref {
    return this.constant({ k: "kernel", name });
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
}

/** The truth values: the bits of length one ("The kernel's primitives are pure and few", note of DR4; confirmed on PR #214). */
const TRUE_BITS = { bytes: [1], bits: 1 };
const FALSE_BITS = { bytes: [0], bits: 1 };

const utf8 = new TextEncoder();

/** The bytes of a present text's bits: the present tree keeps the first byte lowest (src/types.ts `stringToBits`). */
function presentTextBytes(hex: string, length: number): number[] {
  let v = BigInt("0x" + (hex === "" ? "0" : hex));
  const out: number[] = [];
  for (let i = 0; i < length / 8; i++) {
    out.push(Number(v & 0xffn));
    v >>= 8n;
  }
  return out;
}

/** A present number's 64 bits, most significant byte first (question 3). */
function numberBytes(hex: string, length: number): number[] {
  const padded = hex.padStart(Math.ceil(length / 4), "0");
  const out: number[] = [];
  for (let i = 0; i < padded.length; i += 2) out.push(parseInt(padded.slice(i, i + 2), 16));
  return out;
}

// ── Names ─────────────────────────────────────────────────────────────

/** What a name of the text stands for, where it is used. */
type Meaning =
  /** A value binding of the module, once its line is passed: the let's parameter. */
  | { readonly kind: "value"; readonly ref: Ref; readonly sort: Sort }
  /** A value binding whose line is not passed yet. */
  | { readonly kind: "later"; readonly line: number }
  /** A function binding of the module. */
  | { readonly kind: "function"; readonly name: string }
  /** A member of the recursive group being built: its self parameter. */
  | { readonly kind: "self"; readonly group: Group; readonly index: number; readonly selfs: readonly Ref[] };

interface Group {
  readonly members: readonly string[];
  /** The raw functions, each taking every member first. */
  raws: Ref[] | null;
}

interface FunctionInfo {
  readonly name: string;
  readonly node: Extract<PNode, { k: "function" }>;
  /** The public function value, once built. */
  ref: Ref | null;
  sort: Sort;
  building: boolean;
  group: Group | null;
}

// ── The emitter ───────────────────────────────────────────────────────

class Emitter {
  readonly b = new Builder();
  readonly findings: Finding[] = [];
  readonly forms = new Set<FormId>();
  private readonly params = new Map<PNode, Ref>();
  private readonly names = new Map<string, Meaning>();
  private readonly functions = new Map<string, FunctionInfo>();
  private outParam: Ref | null = null;

  find(need: NeedId, form: string, why: string): null {
    if (!this.findings.some((f) => f.need === need && f.form === form)) this.findings.push({ need, form, why });
    return null;
  }

  /** The module's output capability parameter: declared when the text prints (question 6). */
  out(): Ref {
    if (this.outParam === null) this.outParam = this.b.param("out");
    return this.outParam;
  }
  get usesOutput(): boolean {
    return this.outParam !== null;
  }

  text(s: string): Ref {
    const bytes = [...utf8.encode(s)];
    return this.b.bits(bytes, bytes.length * 8);
  }

  /** A value position: an effect's answer may not be used there (question 7). */
  value(n: PNode, where: string): { ref: Ref | null; sort: Sort } {
    const r = this.expr(n);
    if (r.sort === "effect") {
      this.find("print-value", `print used as ${where}`, "the output part write answers an empty structure, and the present print answers its argument, so a text that uses the value would mean two things");
      return { ref: null, sort: "unknown" };
    }
    return r;
  }

  expr(n: PNode): { ref: Ref | null; sort: Sort } {
    if (n.meta.length > 0) {
      // The parse attaches metadata the first notation has no form for: refuse rather than drop it.
      this.find("types", `a value carrying ${n.meta.join(", ")}`, "the present parser attached metadata to it, which the data form does not hold");
    }
    switch (n.k) {
      case "bits": {
        this.forms.add("number");
        if (n.length !== 64) return { ref: this.find("parse", `bits of width ${n.length}`, "the first notation's numbers are 64 bits"), sort: "unknown" };
        return { ref: this.b.bits(numberBytes(n.hex, 64), 64), sort: "number" };
      }
      case "symbol":
        return this.name(n.name);
      case "param": {
        const r = this.params.get(n);
        if (r === undefined) return { ref: this.find("parse", `the parameter ${n.name}`, "a parameter outside the function that owns it"), sort: "unknown" };
        return { ref: r, sort: "unknown" };
      }
      case "prim":
        return { ref: this.find(`prim:${n.name}`, `the present primitive ${n.name}`, "the present parser put a primitive here and the first notation has no form for it"), sort: "unknown" };
      case "function":
        return { ref: this.lambda(n), sort: "function" };
      case "apply":
        return this.apply(n);
      case "structure":
        return { ref: this.find("parse", "a structure of bindings inside an expression", "the first notation has no form for it"), sort: "unknown" };
      default:
        return { ref: this.find("parse", `a present value of kind ${n.kind}`, "the first notation has no form for it"), sort: "unknown" };
    }
  }

  name(name: string): { ref: Ref | null; sort: Sort } {
    const m = this.names.get(name);
    if (m === undefined) {
      if (name === "true" || name === "false") {
        this.forms.add("truth");
        const t = name === "true" ? TRUE_BITS : FALSE_BITS;
        return { ref: this.b.bits(t.bytes, t.bits), sort: "truth" };
      }
      if (name === "print" || name === "claim")
        return { ref: this.find("parse", `${name} as a value`, `the first notation reads ${name} only where it is applied to one argument`), sort: "unknown" };
      return { ref: this.find("unbound", `the name ${name}`, `nothing in the text binds ${name}; the first notation checks names at the end of the text`), sort: "unknown" };
    }
    this.forms.add("name");
    switch (m.kind) {
      case "value":
        return { ref: m.ref, sort: m.sort };
      case "later":
        return { ref: this.find("forward-value", `the value binding ${name}, used before its line`, "a value binding is evaluated where it is written, so a use before that line has no value yet"), sort: "unknown" };
      case "function": {
        const f = this.fnInfo(m.name);
        return { ref: f.ref, sort: "function" };
      }
      case "self":
        return { ref: this.selfWrapper(m), sort: "function" };
    }
  }

  /** The function of a binding, built at its first use (it may need value bindings passed by then). */
  fnInfo(name: string): FunctionInfo {
    const f = this.functions.get(name) as FunctionInfo;
    if (f.ref === null && !f.building) {
      if (f.group !== null) this.buildGroup(f.group);
      else {
        f.building = true;
        const built = this.lambdaWithSort(f.node);
        f.ref = built.ref;
        f.sort = built.sort;
        f.building = false;
      }
    }
    return f;
  }

  lambda(n: Extract<PNode, { k: "function" }>): Ref | null {
    return this.lambdaWithSort(n).ref;
  }

  lambdaWithSort(n: Extract<PNode, { k: "function" }>, leading: readonly Ref[] = []): { ref: Ref | null; sort: Sort } {
    this.forms.add("function");
    const ps = n.params.map((p) => {
      const r = this.b.param(p.k === "param" ? p.name : "p");
      this.params.set(p, r);
      return r;
    });
    const body = this.expr(n.body);
    if (body.ref === null) return { ref: null, sort: body.sort };
    return { ref: this.b.fn([...leading, ...ps], body.ref), sort: body.sort };
  }

  /**
   * A recursive group, as self-application (§4, "Recursion"): each member
   * becomes a raw function that takes every member of the group first, and
   * calls a member by applying its parameter to the members and the
   * arguments. The public function applies its raw function to the raw
   * functions. No node refers to a later one, and nothing is bound.
   */
  buildGroup(g: Group): void {
    this.forms.add("recursion");
    const infos = g.members.map((m) => this.functions.get(m) as FunctionInfo);
    for (const f of infos) f.building = true;
    const raws: (Ref | null)[] = [];
    const sorts: Sort[] = [];
    for (const f of infos) {
      const selfs = g.members.map((m) => this.b.param(m));
      const saved = g.members.map((m) => this.names.get(m));
      g.members.forEach((m, i) => this.names.set(m, { kind: "self", group: g, index: i, selfs }));
      const built = this.lambdaWithSort(f.node, selfs);
      g.members.forEach((m, i) => this.names.set(m, saved[i] as Meaning));
      raws.push(built.ref);
      sorts.push(built.sort);
    }
    infos.forEach((f, i) => {
      f.sort = sorts[i] === "pending" ? "unknown" : sorts[i];
      f.building = false;
    });
    if (raws.some((r) => r === null)) return;
    g.raws = raws as Ref[];
    infos.forEach((f, i) => {
      const ps = f.node.params.map((p) => this.b.param(p.k === "param" ? p.name : "p"));
      f.ref = this.b.fn(ps, this.b.apply((g.raws as Ref[])[i], [...(g.raws as Ref[]), ...ps]));
    });
  }

  /** A member of the group being built, used as a value inside it: a function that calls it. */
  selfWrapper(m: Extract<Meaning, { kind: "self" }>): Ref {
    const f = this.functions.get(m.group.members[m.index]) as FunctionInfo;
    const ps = f.node.params.map((p) => this.b.param(p.k === "param" ? p.name : "p"));
    return this.b.fn(ps, this.b.apply(m.selfs[m.index], [...m.selfs, ...ps]));
  }

  /** The body of a present thunk (a function of no parameters the parser built for a branch). */
  thunk(n: PNode): { ref: Ref | null; sort: Sort } {
    if (n.k === "function" && n.params.length === 0 && n.meta.length === 0) return this.expr(n.body);
    return this.expr(n);
  }

  conditional(cond: { ref: Ref | null; sort: Sort }, yes: { ref: Ref | null; sort: Sort }, no: { ref: Ref | null; sort: Sort }): { ref: Ref | null; sort: Sort } {
    const sort = merge(yes.sort, no.sort);
    if (cond.ref === null || yes.ref === null || no.ref === null) return { ref: null, sort };
    return { ref: this.b.apply(this.b.kernel("if"), [cond.ref, yes.ref, no.ref]), sort };
  }

  truth(t: { bytes: number[]; bits: number }): { ref: Ref; sort: Sort } {
    return { ref: this.b.bits(t.bytes, t.bits), sort: "truth" };
  }

  apply(n: Extract<PNode, { k: "apply" }>): { ref: Ref | null; sort: Sort } {
    const fn = n.fn;
    if (fn.k === "symbol" && !this.names.has(fn.name) && (fn.name === "print" || fn.name === "claim")) {
      if (n.args.length !== 1) return { ref: this.find("parse", `${fn.name} with ${n.args.length} arguments`, `${fn.name} takes one argument`), sort: "unknown" };
      return fn.name === "print" ? this.print(n.args[0]) : this.claim(n.args[0]);
    }
    if (fn.k === "prim") return this.primitive(fn.name, n.args);
    // An application of a member of the recursive group being built calls its parameter directly.
    if (fn.k === "symbol") {
      const m = this.names.get(fn.name);
      if (m !== undefined && m.kind === "self") {
        this.forms.add("application");
        const args = n.args.map((a) => this.value(a, "an argument"));
        if (args.some((a) => a.ref === null)) return { ref: null, sort: "pending" };
        return { ref: this.b.apply(m.selfs[m.index], [...m.selfs, ...args.map((a) => a.ref as Ref)]), sort: "pending" };
      }
    }
    this.forms.add("application");
    const f = this.value(fn, "a function");
    const args = n.args.map((a) => this.value(a, "an argument"));
    let sort: Sort = "unknown";
    if (fn.k === "symbol") {
      const m = this.names.get(fn.name);
      if (m !== undefined && m.kind === "function") sort = (this.functions.get(fn.name) as FunctionInfo).sort;
    } else if (fn.k === "function") sort = this.lambdaSortOf(fn);
    if (f.ref === null || args.some((a) => a.ref === null)) return { ref: null, sort };
    return { ref: this.b.apply(f.ref, args.map((a) => a.ref as Ref)), sort };
  }

  private lambdaSortOf(_fn: PNode): Sort {
    return "unknown";
  }

  /** print(e): the module's output capability applied to e's text (§2, "Printing"; question 7). */
  print(arg: PNode): { ref: Ref | null; sort: Sort } {
    this.forms.add("print");
    const a = this.value(arg, "what print prints");
    let text: Ref | null = null;
    switch (a.sort) {
      case "text":
        text = a.ref;
        break;
      case "truth":
        if (a.ref !== null) text = this.b.apply(this.b.kernel("if"), [a.ref, this.text("true"), this.text("false")]);
        break;
      case "number":
        this.find("int-to-text", "print of a number", "printing a number needs its decimal text, which no shipped primitive gives yet");
        break;
      case "float":
        this.find("float-to-text", "print of a float", "printing a float needs its text, which no shipped primitive gives yet");
        break;
      default:
        this.find("print-sort", `print of a value of sort ${a.sort}`, "without types the emitter cannot see what the value is, so it cannot choose how to render it");
    }
    if (text === null) return { ref: null, sort: "effect" };
    return { ref: this.b.apply(this.out(), [text]), sort: "effect" };
  }

  /**
   * claim(e) inside an expression. Refused: whether it is evaluated would
   * depend on whether its value is needed, which origin/main and PR #216
   * answer differently (an argument nothing needs is never evaluated
   * there). A claim stands as a statement (`statement`).
   */
  claim(_arg: PNode): { ref: Ref | null; sort: Sort } {
    this.forms.add("claim");
    return { ref: this.find("claim-value", "a claim inside an expression", "a claim is emitted as a statement only: inside an expression it would be evaluated only when its value is needed"), sort: "truth" };
  }

  primitive(name: string, args: readonly PNode[]): { ref: Ref | null; sort: Sort } {
    const sortsOf = () => args.map((a) => this.peekSort(a));
    switch (name) {
      case "typed_string": {
        this.forms.add("text");
        const a = args[0];
        if (args.length !== 1 || a.k !== "bits") return { ref: this.find("parse", "a text", "the present parser built a text the first notation does not read"), sort: "unknown" };
        return { ref: this.b.bits(presentTextBytes(a.hex, a.length), a.length), sort: "text" };
      }
      case "typed_float": {
        this.forms.add("number");
        const a = args[0];
        if (args.length !== 1 || a.k !== "bits") return { ref: this.find("parse", "a float", "the present parser built a float the first notation does not read"), sort: "unknown" };
        return { ref: this.b.bits(numberBytes(a.hex, 64), 64), sort: "float" };
      }
      case "eval_if": {
        this.forms.add("conditional");
        if (args.length !== 3) return { ref: this.find("parse", "a conditional", "a conditional has a condition and two branches"), sort: "unknown" };
        return this.conditional(this.value(args[0], "a condition"), this.thunk(args[1]), this.thunk(args[2]));
      }
      case "typed_and":
      case "typed_or": {
        this.forms.add("logic");
        if (args.length !== 2) return { ref: this.find("parse", name, "a logical operator has two operands"), sort: "unknown" };
        const left = this.value(args[0], "an operand");
        const right = this.thunk(args[1]);
        if (right.sort === "effect") this.find("print-value", "print used as an operand", "the output part write answers an empty structure, and the present print answers its argument");
        const r = name === "typed_and" ? this.conditional(left, right, this.truth(FALSE_BITS)) : this.conditional(left, this.truth(TRUE_BITS), right);
        return { ref: r.ref, sort: "truth" };
      }
      case "typed_not": {
        this.forms.add("logic");
        if (args.length !== 1) return { ref: this.find("parse", "!", "! has one operand"), sort: "unknown" };
        const r = this.conditional(this.value(args[0], "an operand"), this.truth(FALSE_BITS), this.truth(TRUE_BITS));
        return { ref: r.ref, sort: "truth" };
      }
      case "seq":
        return this.sequence(args);
      case "typed_object":
      case "typed_array": {
        this.forms.add("structure");
        const entries: [Ref | null, Ref][] = [];
        let ok = true;
        if (name === "typed_object") {
          for (let i = 0; i + 1 < args.length; i += 2) {
            const k = args[i];
            const v = this.value(args[i + 1], "a structure's entry");
            if (k.k !== "bits") { ok = this.find("parse", "a structure's key", "the present parser built a key the first notation does not read") !== null; continue; }
            const key = new TextDecoder().decode(Uint8Array.from(presentTextBytes(k.hex, k.length)));
            if (v.ref === null) { ok = false; continue; }
            entries.push([this.b.constant({ k: "symbol", fqn: key }), v.ref]);
          }
        } else {
          for (const a of args) {
            const v = this.value(a, "an array's element");
            if (v.ref === null) ok = false;
            else entries.push([null, v.ref]);
          }
        }
        if (!ok) return { ref: null, sort: "structure" };
        return { ref: this.b.add({ k: "structure", entries }), sort: "structure" };
      }
      case "type_dispatch": {
        const recv = args[0] === undefined ? "unknown" : this.peekSort(args[0]);
        if (recv === "text" || recv === "number" || recv === "float" || recv === "truth")
          return { ref: this.find("method", `a method of a ${recv}`, "a method is its type's, and types are the standard language's"), sort: "unknown" };
        return { ref: this.find("structure-read", "reading a structure's entry", "the kernel has no primitive yet that reads an entry of a structure"), sort: "unknown" };
      }
      case "bits_add":
      case "bits_sub":
      case "bits_mul":
      case "bits_div":
      case "bits_mod": {
        const ss = sortsOf();
        if (name === "bits_add" && ss.some((s) => s === "text")) return { ref: this.find("text-concat", "+ on texts", "joining texts needs a shipped text primitive"), sort: "text" };
        if (ss.some((s) => s === "float")) return { ref: this.find("float-arith", `${opName(name)} on floats`, "no shipped float primitive exists yet"), sort: "float" };
        return { ref: this.find("int-arith", `${opName(name)} on numbers`, "no shipped arithmetic primitive exists yet"), sort: "number" };
      }
      case "eval_when":
        return { ref: this.find("match", "when", "when/is is the standard language's match, which needs telling bits apart and reading structures"), sort: "unknown" };
      case "source_get":
        return { ref: this.find("origin", "source of", "reading what a value came from needs origins, which no kernel keeps yet"), sort: "unknown" };
      case "bits_eq":
      case "bits_ne":
      case "bits_neq":
      case "bits_lt":
      case "bits_gt":
      case "bits_le":
      case "bits_lte":
      case "bits_ge":
      case "bits_gte": {
        const ss = sortsOf();
        if (ss.some((s) => s === "float")) return { ref: this.find("float-compare", `${opName(name)} on floats`, "no shipped float primitive exists yet"), sort: "truth" };
        if (ss.some((s) => s === "number") || !["bits_eq", "bits_ne", "bits_neq"].includes(name))
          return { ref: this.find("int-compare", `${opName(name)} on numbers`, "no shipped comparison primitive exists yet"), sort: "truth" };
        return { ref: this.find("bits-equal", `${opName(name)} on texts or truth values`, "the kernel has no primitive yet that tells two bits values apart"), sort: "truth" };
      }
      case "type_check_binding":
      case "type_check":
      case "typed_function":
        return { ref: this.find("types", "a type annotation", "a type is the standard language's"), sort: "unknown" };
      default:
        return { ref: this.find(`prim:${name}`, `the present primitive ${name}`, "the present parser put a primitive here and the first notation has no form for it"), sort: "unknown" };
    }
  }

  /** A sort seen without building: for choosing an operator's need. */
  peekSort(n: PNode): Sort {
    switch (n.k) {
      case "bits":
        return "number";
      case "symbol": {
        if (n.name === "true" || n.name === "false") return "truth";
        const m = this.names.get(n.name);
        if (m !== undefined && m.kind === "value") return m.sort;
        return "unknown";
      }
      case "apply":
        if (n.fn.k === "prim") {
          if (n.fn.name === "typed_string") return "text";
          if (n.fn.name === "typed_float") return "float";
          if (["typed_and", "typed_or", "typed_not", "bits_eq", "bits_ne", "bits_neq", "bits_lt", "bits_gt", "bits_le", "bits_lte", "bits_ge", "bits_gte"].includes(n.fn.name)) return "truth";
          if (["bits_add", "bits_sub", "bits_mul", "bits_div", "bits_mod"].includes(n.fn.name)) {
            const ss = n.args.map((a) => this.peekSort(a));
            return ss.includes("text") ? "text" : ss.includes("float") ? "float" : "number";
          }
          if (n.fn.name === "typed_object" || n.fn.name === "typed_array") return "structure";
        }
        return "unknown";
      default:
        return "unknown";
    }
  }

  /**
   * A block: statements in written order (§2, "Sequence"). It stands for a
   * structure of the statements, which the kernel evaluates entry by entry
   * in order, on origin/main and after PR #216 alike. Its value is that
   * structure, so a block is emitted only where its value is an effect's,
   * which nothing may use (question 7). A block whose last statement gives
   * a value needs a way to take that value after the others: on
   * origin/main a function of one unused parameter would do it, and after
   * PR #216 that argument is never evaluated, so the emitter refuses it.
   */
  sequence(stmts: readonly PNode[]): { ref: Ref | null; sort: Sort } {
    this.forms.add("sequence");
    if (stmts.length === 0) return { ref: this.find("parse", "an empty block", "a block has a statement"), sort: "unknown" };
    const all = stmts.map((s) => this.statement(s));
    const last = all[all.length - 1];
    if (last.sort !== "effect") {
      this.find("block-value", "a block whose last statement gives a value", "taking the last statement's value after the others needs reading a structure's entry, or a sequencing form the kernel does not have");
      return { ref: null, sort: last.sort };
    }
    if (all.some((d) => d.ref === null)) return { ref: null, sort: "effect" };
    return { ref: this.b.add({ k: "structure", entries: all.map((d) => [null, d.ref as Ref] as const) }), sort: "effect" };
  }

  /** A statement: an expression whose value is not used. A claim may stand only here (§2, "Claim"). */
  statement(n: PNode): { ref: Ref | null; sort: Sort } {
    if (n.k === "apply" && n.fn.k === "symbol" && n.fn.name === "claim" && !this.names.has("claim")) {
      if (n.args.length !== 1) return { ref: this.find("parse", "claim with other than one argument", "claim takes one argument"), sort: "unknown" };
      this.forms.add("claim");
      const a = this.value(n.args[0], "what a claim states");
      if (a.ref === null) return { ref: null, sort: "effect" };
      return { ref: this.b.apply(this.b.kernel("claim"), [a.ref]), sort: "effect" };
    }
    return this.expr(n);
  }

  // ── The module (§3) ─────────────────────────────────────────────────

  module(program: PNode): Ref | null {
    if (program.k !== "structure") return this.find("parse", "a program", "the present parser did not build a program");
    const entries = program.entries;
    const bound = new Map<string, number>();
    entries.forEach((e, i) => {
      if (e.key === null) return;
      if (bound.has(e.key)) this.find("rebind", `the name ${e.key}, bound twice`, `${e.key} is bound on two lines; the present tree keeps the later silently`);
      else bound.set(e.key, i);
      if (e.exported) this.find("export", `export ${e.key}`, "the first notation's module yields every binding; which ones it exports waits on question 8");
      if (e.value === null) this.find("import", `import ${e.key}`, "an imported module is a parameter of the module function; the launcher supplies none yet");
    });
    // Function bindings: order-free. Value bindings and statements: in written order.
    const seq: { index: number; key: string | null; value: PNode }[] = [];
    for (const [i, e] of entries.entries()) {
      if (e.value === null) continue;
      if (e.key !== null && bound.get(e.key) !== i) continue;
      if (e.key !== null && e.value.k === "function" && e.value.meta.length === 0) {
        this.functions.set(e.key, { name: e.key, node: e.value, ref: null, sort: "unknown", building: false, group: null });
        this.names.set(e.key, { kind: "function", name: e.key });
      } else seq.push({ index: i, key: e.key, value: e.value });
    }
    for (const s of seq) if (s.key !== null) this.names.set(s.key, { kind: "later", line: s.index });
    this.groups();
    // The capability parameter comes first in the record, as in next/launch/fixtures/hello.json.
    if (!bound.has("print") && mentions(program, "print")) this.out();

    const keyed = entries.filter((e, i) => e.key !== null && e.value !== null && bound.get(e.key) === i).map((e) => e.key as string);
    // The body (§3): one structure per statement or value binding, in written order, each holding
    // the next as its last entry; the innermost is the structure of the bindings. A value binding is
    // a function of its name applied to its value, whose body is that structure with the binding as
    // its first entry, so the value is needed at its written place on origin/main and after PR #216.
    const chain = (i: number): Ref | null => {
      if (i === seq.length) return keyed.length === 0 ? null : this.bindings(keyed);
      const s = seq[i];
      if (s.key !== null) {
        this.forms.add("binding");
        const v = this.value(s.value, `the value of ${s.key}`);
        const p = this.b.param(s.key);
        this.names.set(s.key, { kind: "value", ref: p, sort: v.sort });
        const rest = chain(i + 1);
        if (v.ref === null || rest === null) return null;
        const entries: [Ref | null, Ref][] = [[this.b.constant({ k: "symbol", fqn: s.key }), p], [null, rest]];
        return this.b.apply(this.b.fn([p], this.b.add({ k: "structure", entries })), [v.ref]);
      }
      const v = this.statement(s.value);
      if (i === seq.length - 1 && keyed.length === 0) return v.ref;
      if (seq.length > 1) this.forms.add("sequence");
      const rest = chain(i + 1);
      if (v.ref === null || rest === null) return null;
      return this.b.add({ k: "structure", entries: [[null, v.ref], [null, rest]] });
    };
    if (seq.length === 0 && keyed.length === 0) return this.b.add({ k: "structure", entries: [] });
    return chain(0);
  }

  /** The structure of the module's bindings, keyed by symbols of their names (question 8). */
  bindings(keyed: readonly string[]): Ref | null {
    const entries: [Ref, Ref][] = [];
    let ok = true;
    for (const k of keyed) {
      const r = this.name(k).ref;
      if (r === null) ok = false;
      else entries.push([this.b.constant({ k: "symbol", fqn: k }), r]);
    }
    return ok ? this.b.add({ k: "structure", entries }) : null;
  }

  /** Finds the recursive groups among the function bindings: the strongly connected parts of who calls whom. */
  groups(): void {
    const names = [...this.functions.keys()];
    const edges = new Map(names.map((n) => [n, new Set<string>()]));
    const walk = (p: PNode, from: string, seen: Set<PNode>): void => {
      if (seen.has(p)) return;
      seen.add(p);
      if (p.k === "symbol" && this.functions.has(p.name)) (edges.get(from) as Set<string>).add(p.name);
      else if (p.k === "apply") { walk(p.fn, from, seen); p.args.forEach((a) => walk(a, from, seen)); }
      else if (p.k === "function") walk(p.body, from, seen);
    };
    for (const n of names) walk((this.functions.get(n) as FunctionInfo).node.body, n, new Set());
    // Tarjan's algorithm.
    let index = 0;
    const idx = new Map<string, number>();
    const low = new Map<string, number>();
    const stack: string[] = [];
    const on = new Set<string>();
    const connect = (v: string): void => {
      idx.set(v, index);
      low.set(v, index++);
      stack.push(v);
      on.add(v);
      for (const w of edges.get(v) as Set<string>) {
        if (!idx.has(w)) { connect(w); low.set(v, Math.min(low.get(v) as number, low.get(w) as number)); }
        else if (on.has(w)) low.set(v, Math.min(low.get(v) as number, idx.get(w) as number));
      }
      if (low.get(v) === idx.get(v)) {
        const part: string[] = [];
        let w: string;
        do { w = stack.pop() as string; on.delete(w); part.push(w); } while (w !== v);
        part.sort((a, b) => names.indexOf(a) - names.indexOf(b));
        if (part.length > 1 || (edges.get(v) as Set<string>).has(v)) {
          const g: Group = { members: part, raws: null };
          for (const m of part) (this.functions.get(m) as FunctionInfo).group = g;
        }
      }
    };
    for (const n of names) if (!idx.has(n)) connect(n);
  }
}

/** True where the name appears anywhere in the parse. */
function mentions(p: PNode, name: string, seen = new Set<PNode>()): boolean {
  if (seen.has(p)) return false;
  seen.add(p);
  switch (p.k) {
    case "symbol": return p.name === name;
    case "apply": return mentions(p.fn, name, seen) || p.args.some((a) => mentions(a, name, seen));
    case "function": return mentions(p.body, name, seen);
    case "structure": return p.entries.some((e) => e.value !== null && mentions(e.value, name, seen));
    default: return false;
  }
}

function opName(prim: string): string {
  return ({ bits_add: "+", bits_sub: "-", bits_mul: "*", bits_div: "/", bits_mod: "%", bits_eq: "==", bits_ne: "!=", bits_neq: "!=", bits_lt: "<", bits_gt: ">", bits_le: "<=", bits_lte: "<=", bits_ge: ">=", bits_gte: ">=" } as Record<string, string>)[prim] ?? prim;
}

/**
 * Emits a text in the first notation as a saved program of the first
 * version, or returns every finding: each form it cannot emit yet, and why.
 */
export function emit(text: string): EmitResult {
  const read = readPresent(text);
  const e = new Emitter();
  for (const u of read.uses) e.find("use", u.text, "the first notation's grammar is fixed: a text cannot change the grammar it is read in until the parser engine runs on the kernel");
  if (!read.ok) {
    e.find("parse", "the text", `the present parser does not read it: ${read.message.split("\n")[0]}`);
    return { ok: false, findings: e.findings, forms: [] };
  }
  for (const bb of read.blockBindings)
    e.find("block-binding", `the binding "${bb.text}" inside a block`, "the present tree builder substitutes the bound expression at each use, so its effects would move and repeat");
  const body = e.module(read.program);
  const forms = [...e.forms].sort();
  if (e.findings.length > 0 || body === null) return { ok: false, findings: e.findings, forms };
  const params: Ref[] = [];
  const declares: Declared[] = [];
  if (e.usesOutput) {
    const out = e.out();
    params.push(out);
    declares.push({ param: out, role: "capability", name: "output" });
  }
  const module = e.b.fn(params, body);
  const program: SavedProgram = { format: SAVED_PROGRAM_FORMAT, version: SAVED_PROGRAM_VERSION, needs: [], nodes: e.b.nodes, module, declares };
  const problems = check2(program);
  if (problems.length > 0) throw new Error(`the emitter wrote a record that does not check: ${problems.join("; ")}`);
  return { ok: true, program, forms };
}

/** One line for a finding, for a person. */
export function describeFinding(f: Finding): string {
  return `${f.form}: ${f.why} (needs ${needInfo(f.need).title}: ${needInfo(f.need).state})`;
}

// ── The command ───────────────────────────────────────────────────────

function main(argv: readonly string[]): void {
  let file: string | undefined;
  let out: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "-o") out = argv[++i];
    else if (file === undefined) file = argv[i];
    else { console.error(`unexpected argument ${argv[i]}`); process.exit(2); }
  }
  if (file === undefined || (argv.includes("-o") && out === undefined)) {
    console.error("usage: npm run emit -- <file> [-o out.json]");
    process.exit(2);
  }
  const result = emit(fs.readFileSync(file, "utf-8"));
  if (!result.ok) {
    for (const f of result.findings) console.error(`${file}: cannot be emitted yet: ${describeFinding(f)}`);
    process.exit(1);
  }
  const json = encode(result.program);
  if (out === undefined) process.stdout.write(json);
  else fs.writeFileSync(out, json);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) main(process.argv.slice(2));
