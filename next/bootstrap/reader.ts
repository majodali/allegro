// The reader of Allegretto (B-196 (the rebuild's acceptance side), chunk
// Q5 (the first notation and the bootstrap), part 2): the parse tree the
// present parser engine makes with Allegretto's grammar
// (next/bootstrap/allegretto-grammar.ts), read into a syntax tree of this
// file's own.
//
// It reads the engine's parse tree and nothing else. It does not use the
// present tree builder, which rewrites what it reads
// (next/ext/allegretto/forms.md §5): what is written here is what the
// text says, form by form, each node with its place in the text.
//
// What it reads, from forms.md §2:
//   - a literal from its digits or characters in the text: a whole number
//     to a signed 64-bit integer, refused outside that range; `0xFF`; a
//     decimal fraction to IEEE 754 binary64; a text, with the escapes
//     `\"`, `\\`, `\n`, `\t`, to its UTF-8 bytes;
//   - the header lines first (`capability`, `input`, `import`), then the
//     module's block;
//   - a block's bindings (`x = e`, `f(x, y) => e`, `export` before
//     either), its statements, and the statement `x <- e`.
// What the grammar still parses and forms.md §2 gives no meaning, the
// reader refuses: the keywords `and` and `or`, and the binary number
// `0b…`. It also refuses a header line after anything else, and `export`
// in a block inside the module.
//
// It checks nothing about names: that is the emitter's
// (next/bootstrap/emit.ts), at the end of the text.

import { LADDER_TAG, parseAllegretto, type ParseTree } from "./allegretto-grammar.js";

// ── The syntax tree ────────────────────────────────────────────────────

/** A place in the text: offsets from 0, and the line and column of the start, from 1. */
export interface Place {
  readonly start: number;
  readonly end: number;
  readonly line: number;
  readonly column: number;
}

/** The binary operators of forms.md §2, as written. */
export type BinaryOp = "||" | "&&" | "==" | "!=" | "<" | ">" | "<=" | ">=" | "++" | "+" | "-" | "*" | "/" | "%";

export type Expr =
  /** A text's bytes, UTF-8. */
  | { readonly k: "text"; readonly bytes: Uint8Array; readonly at: Place }
  /** A whole number, within the signed 64-bit range. */
  | { readonly k: "int"; readonly value: bigint; readonly at: Place }
  /** A decimal fraction, as IEEE 754 binary64. */
  | { readonly k: "float"; readonly value: number; readonly at: Place }
  | { readonly k: "truth"; readonly value: boolean; readonly at: Place }
  /** `` `name ``. */
  | { readonly k: "symbol"; readonly name: string; readonly at: Place }
  | { readonly k: "name"; readonly name: string; readonly at: Place }
  | { readonly k: "lambda"; readonly params: readonly Name[]; readonly body: Expr; readonly at: Place }
  | { readonly k: "apply"; readonly fn: Expr; readonly args: readonly Expr[]; readonly at: Place }
  /** `value |> fn`. */
  | { readonly k: "pipe"; readonly value: Expr; readonly fn: Expr; readonly at: Place }
  /** `object.name`. */
  | { readonly k: "dot"; readonly object: Expr; readonly name: Name; readonly at: Place }
  /** `object[index]`. */
  | { readonly k: "index"; readonly object: Expr; readonly index: Expr; readonly at: Place }
  | { readonly k: "if"; readonly condition: Expr; readonly then: Expr; readonly else: Expr; readonly at: Place }
  | { readonly k: "binary"; readonly op: BinaryOp; readonly left: Expr; readonly right: Expr; readonly at: Place }
  | { readonly k: "unary"; readonly op: "-" | "!"; readonly operand: Expr; readonly at: Place }
  /** `{a: e, b: f}`. */
  | { readonly k: "record"; readonly fields: ReadonlyArray<{ readonly name: Name; readonly value: Expr }>; readonly at: Place }
  /** `[e, f]`. */
  | { readonly k: "list"; readonly items: readonly Expr[]; readonly at: Place }
  /** An indented block. */
  | { readonly k: "block"; readonly items: readonly Item[]; readonly at: Place };

/** A name where it is bound or read as a key, with its place. */
export interface Name {
  readonly name: string;
  readonly at: Place;
}

/** One line of a block. */
export type Item =
  /** `x = e`, or `export x = e`. */
  | { readonly k: "binding"; readonly name: Name; readonly value: Expr; readonly exported: boolean; readonly at: Place }
  /** `f(x, y) => e`, or `export f(x, y) => e`. */
  | { readonly k: "function"; readonly name: Name; readonly params: readonly Name[]; readonly body: Expr; readonly exported: boolean; readonly at: Place }
  /** `x <- e`. */
  | { readonly k: "arrow"; readonly name: Name; readonly value: Expr; readonly at: Place }
  /** A bare expression. */
  | { readonly k: "statement"; readonly expr: Expr; readonly at: Place };

/** A header line. */
export interface Header {
  readonly k: "capability" | "input" | "import";
  readonly name: Name;
  readonly at: Place;
}

/** A text read as one module: its header lines, then its block. */
export interface Module {
  readonly headers: readonly Header[];
  readonly items: readonly Item[];
}

/** Why a text is refused, at a place. */
export interface ReadFinding {
  readonly at: Place;
  readonly message: string;
}

export type ReadResult = { readonly ok: true; readonly module: Module } | { readonly ok: false; readonly findings: readonly ReadFinding[] };

// ── Reading ────────────────────────────────────────────────────────────

const INT_MAX = (1n << 63n) - 1n;
const ESCAPES: Readonly<Record<string, string>> = { '\\"': '"', "\\\\": "\\", "\\n": "\n", "\\t": "\t" };
const BINARY_TAGS: Readonly<Record<string, BinaryOp>> = {
  or: "||", and: "&&", eq: "==", neq: "!=", lt: "<", gt: ">", lte: "<=", gte: ">=", join: "++", add: "+", sub: "-", mul: "*", div: "/", mod: "%",
};

class Refused extends Error {
  constructor(readonly finding: ReadFinding) {
    super(finding.message);
  }
}

type Branch = Extract<ParseTree, { kind: "branch" }>;

/** Reads a text as one Allegretto module. */
export function read(text: string): ReadResult {
  const source = text.replace(/\r\n/g, "\n");
  const lineStarts = [0];
  for (let i = 0; i < source.length; i++) if (source[i] === "\n") lineStarts.push(i + 1);
  const place = (start: number, end: number = start): Place => {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineStarts[mid] <= start) lo = mid;
      else hi = mid - 1;
    }
    return { start, end, line: lo + 1, column: start - lineStarts[lo] + 1 };
  };
  const at = (t: ParseTree): Place => place(t.range.start, t.range.end);
  const refuse = (where: Place, message: string): never => {
    throw new Refused({ at: where, message });
  };

  const parsed = parseAllegretto(source);
  if (!parsed.ok) return { ok: false, findings: [{ at: place(parsed.error.position), message: `not Allegretto: ${parsed.error.message}` }] };

  const findings: ReadFinding[] = [];
  const branch = (t: ParseTree): Branch => {
    if (t.kind !== "branch") return refuse(at(t), "the parse tree has an unexpected shape here");
    return t;
  };
  /** The branches among a node's children. */
  const branches = (t: ParseTree): Branch[] => (t.kind === "branch" ? t.children.filter((c): c is Branch => c.kind === "branch") : []);
  const child = (t: ParseTree, tag: string): Branch => {
    const found = branches(t).find((c) => c.tag === tag);
    return found ?? refuse(at(t), `the parse tree has no ${tag} here`);
  };
  const leafText = (t: ParseTree): string => {
    if (t.kind === "leaf") return t.text;
    if (t.kind === "branch" && t.children.length === 1) return leafText(t.children[0]);
    return refuse(at(t), "the parse tree has an unexpected shape here");
  };
  const nameOf = (t: ParseTree): Name => ({ name: leafText(t), at: at(t) });
  /** The ident children of a parameter list, or none. */
  const paramsOf = (t: ParseTree | undefined): Name[] => (t === undefined || t.kind !== "branch" ? [] : branches(t).filter((c) => c.tag === "ident").map(nameOf));
  /** The expression of a node whose last branch child is the expression (fn_body, a tail, parentheses). */
  const lastExpr = (t: ParseTree): Expr => {
    const bs = branches(t).filter((c) => !["ws", "ws_any", "ws_req", "hws"].includes(c.tag ?? ""));
    const last = bs[bs.length - 1];
    return last === undefined ? refuse(at(t), "the parse tree has no expression here") : expr(last);
  };
  const exprs = (t: ParseTree | undefined): Expr[] =>
    t === undefined || t.kind !== "branch" ? [] : t.children.filter((c): c is Branch => c.kind === "branch").filter((c) => !["ws", "ws_any"].includes(c.tag ?? "")).map(expr);

  const number = (t: ParseTree): Expr => {
    const digits = leafText(t);
    if (/^0[bB]/.test(digits)) return refuse(at(t), `the binary number ${digits} is not a form of Allegretto (forms.md §2 has 42 and 0xFF)`);
    const value = BigInt(digits);
    if (value > INT_MAX) return refuse(at(t), `the whole number ${digits} is outside the signed 64-bit range`);
    return { k: "int", value, at: at(t) };
  };
  const float = (t: ParseTree): Expr => {
    const digits = leafText(t);
    const value = Number(digits);
    if (!Number.isFinite(value)) return refuse(at(t), `the number ${digits} is outside the range of IEEE 754 binary64`);
    return { k: "float", value, at: at(t) };
  };
  const string = (t: Branch): Expr => {
    let chars = "";
    const parts = t.children.find((c) => c.kind === "branch");
    for (const p of parts === undefined ? [] : branches(parts)) {
      const s = leafText(p);
      if (p.tag === "string_escape") {
        const e = ESCAPES[s];
        if (e === undefined) return refuse(at(p), `the escape ${s} is not one of \\" \\\\ \\n \\t`);
        chars += e;
      } else chars += s;
    }
    return { k: "text", bytes: new TextEncoder().encode(chars), at: at(t) };
  };

  /** Folds a ladder: its first operand, then each tail, to the left. */
  const ladder = (t: Branch): Expr => {
    const [first, tails] = t.children;
    let left = expr(first);
    for (const tail of tails === undefined ? [] : branches(tails)) {
      const where = place(t.range.start, tail.range.end);
      const tag = tail.tag ?? "";
      if (tag === "call") left = { k: "apply", fn: left, args: exprs(branches(tail).find((c) => c.tag === "args")), at: where };
      else if (tag === "dot") left = { k: "dot", object: left, name: nameOf(child(tail, "ident")), at: where };
      else if (tag === "bracket") left = { k: "index", object: left, index: lastNonClose(tail), at: where };
      else if (tag === "pipe") left = { k: "pipe", value: left, fn: lastExpr(tail), at: where };
      else if (tag in BINARY_TAGS) {
        const op = tail.children.find((c) => c.kind === "leaf");
        if (op !== undefined && op.kind === "leaf" && (op.text === "and" || op.text === "or"))
          return refuse(at(op), `the keyword ${op.text} is not a form of Allegretto (forms.md §2 has ${op.text === "and" ? "&&" : "||"})`);
        left = { k: "binary", op: BINARY_TAGS[tag], left, right: lastExpr(tail), at: where };
      } else return refuse(at(tail), `the parse tree has an operator ${tag} that Allegretto does not have`);
    }
    return left;
  };
  /** `[ e ]`: the expression between the brackets. */
  const lastNonClose = (t: Branch): Expr => {
    const e = branches(t).filter((c) => !["ws", "ws_any"].includes(c.tag ?? ""));
    return expr(e[0]);
  };

  const expr = (t0: ParseTree): Expr => {
    const t = branch(t0);
    switch (t.tag) {
      case LADDER_TAG:
        return ladder(t);
      case "number":
        return number(t);
      case "float":
        return float(t);
      case "bool":
        return { k: "truth", value: leafText(t) === "true", at: at(t) };
      case "string":
        return string(t);
      case "symbol_lit":
        return { k: "symbol", name: leafText(child(t, "ident")), at: at(t) };
      case "ident":
        return { k: "name", name: leafText(t), at: at(t) };
      case "paren":
        return lastNonClose(t);
      case "neg":
      case "not":
        return { k: "unary", op: t.tag === "neg" ? "-" : "!", operand: lastExpr(t), at: at(t) };
      case "if": {
        const bodies = branches(t).filter((c) => c.tag === "fn_body");
        const condition = branches(t).filter((c) => !["ws", "ws_req", "fn_body"].includes(c.tag ?? ""))[0];
        return { k: "if", condition: expr(condition), then: lastExpr(bodies[0]), else: lastExpr(bodies[1]), at: at(t) };
      }
      case "lambda1":
        return { k: "lambda", params: [nameOf(child(t, "ident"))], body: lastExpr(t), at: at(t) };
      case "lambdaN":
        return { k: "lambda", params: paramsOf(t.children[2]), body: lastExpr(t), at: at(t) };
      case "array_lit": {
        const items = t.children[2];
        return { k: "list", items: items.kind === "branch" ? exprs(items.children[0]) : [], at: at(t) };
      }
      case "object_lit": {
        const fields = t.children[2];
        const list = fields.kind === "branch" ? branches(fields.children[0]).filter((c) => c.tag === "object_field") : [];
        return { k: "record", fields: list.map((f) => ({ name: nameOf(child(f, "ident")), value: lastExpr(f) })), at: at(t) };
      }
      case "block_expr":
        return { k: "block", items: block(t, false), at: at(t) };
      default:
        return refuse(at(t), `the parse tree has a form ${t.tag ?? "(untagged)"} that Allegretto does not have`);
    }
  };

  /** The statements of a block node: the repetition among its children. */
  const statementsOf = (t: Branch): Branch[] => {
    const rep = t.children.find((c) => c.kind === "branch" && c.tag !== "stmt");
    return rep === undefined ? [] : branches(rep).filter((c) => c.tag === "stmt");
  };
  const block = (t: Branch, top: boolean): Item[] => {
    const items: Item[] = [];
    for (const s of statementsOf(t)) {
      const it = statement(s, top);
      if (it !== undefined) items.push(it);
    }
    return items;
  };

  const headers: Header[] = [];
  /** True once a line of the module's block that is not a header line has been read. */
  let sawItem = false;
  /** One line. A header line is collected apart and gives no item. */
  const statement = (s: Branch, top: boolean): Item | undefined => {
    try {
      const inner = branch(s.children[0]);
      const where = at(s);
      switch (inner.tag) {
        case "capability_decl":
        case "input_decl":
        case "import_stmt": {
          const k = inner.tag === "capability_decl" ? "capability" : inner.tag === "input_decl" ? "input" : "import";
          if (!top) return refuse(where, `the header line ${k} belongs at the start of the text, not in a block`);
          if (sawItem) return refuse(where, `the header line ${k} comes after other lines; header lines come before anything else`);
          headers.push({ k, name: nameOf(child(inner, "ident")), at: where });
          return undefined;
        }
        case "binding":
        case "export_binding": {
          const exported = inner.tag === "export_binding";
          if (exported && !top) return refuse(where, "export marks a binding of the module, and this one is in a block inside it");
          sawItem = top || sawItem;
          return { k: "binding", name: nameOf(child(inner, "ident")), value: lastExpr(child(inner, "fn_body")), exported, at: where };
        }
        case "fn_decl":
        case "export_fn_decl": {
          const exported = inner.tag === "export_fn_decl";
          if (exported && !top) return refuse(where, "export marks a binding of the module, and this one is in a block inside it");
          sawItem = top || sawItem;
          const params = branches(inner).find((c) => c.tag === "param_list");
          return { k: "function", name: nameOf(child(inner, "ident")), params: paramsOf(params), body: lastExpr(child(inner, "fn_body")), exported, at: where };
        }
        case "arrow_binding":
          sawItem = top || sawItem;
          return { k: "arrow", name: nameOf(child(inner, "ident")), value: lastExpr(child(inner, "fn_body")), at: where };
        default:
          sawItem = top || sawItem;
          return { k: "statement", expr: expr(inner), at: where };
      }
    } catch (e) {
      if (!(e instanceof Refused)) throw e;
      findings.push(e.finding);
      return undefined;
    }
  };

  const program = branch(parsed.tree);
  const stmts = branches(program).find((c) => c.tag !== "ws" && c.tag !== "line_break");
  const items: Item[] = [];
  for (const s of stmts === undefined ? [] : branches(stmts).filter((c) => c.tag === "stmt")) {
    const it = statement(s, true);
    if (it !== undefined) items.push(it);
  }
  if (findings.length > 0) return { ok: false, findings };
  return { ok: true, module: { headers, items } };
}
