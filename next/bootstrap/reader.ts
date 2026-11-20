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
//     `\"`, `\\`, `\n`, `\t`, to its UTF-8 bytes. Prefix `-` on a whole
//     number of exactly 2^63 is read as the least integer, -2^63, which no
//     other text can write (the hand-off of PR #260). A `-` written before
//     a fraction is part of the literal: `-1.5` is the fraction, where
//     `int.neg` of its bits would be another number (ruled 2026-11-20);
//   - a structure literal's entries, each `name: e` or `[k]: e`, with a
//     computed key;
//   - the header lines (`capability`, `input`, `key`, `import`), anywhere
//     at the module's top level (forms.md §2 "The module", question 7),
//     and the module's block;
//   - a block's bindings (`x = e`, `f(x, y) => e`, `export` before
//     either), its statements, and the statement `x <- e`; and `sync`
//     before an indented block.
// What the grammar still parses and forms.md §2 gives no meaning, the
// reader refuses: the keywords `and` and `or`, and the binary number
// `0b…`. It also refuses a header line in a block inside the module, and
// `export` there.
//
// It checks one thing about names (forms.md §2 "Failures", the paragraph
// on `<-`): a statement written above `x <- e` in its block that needs
// `x`, itself or through a binding of that block, is refused, since it
// would start `e` before its place. Every other check of names is the
// emitter's (next/bootstrap/emit.ts), at the end of the text.
//
// An import is read as a header line with its two lists (chunk Q5, part
// 5): the pairs after `with`, each a name and an expression, and the
// names after `without`, each in written order. Each list may be written
// once. What an import stands for is the emitter's, which needs the
// imported module's declarations and identity: the driver
// (next/bootstrap/driver.ts) supplies them. The `<-` check above counts an
// import as a binding of the module's block, which needs the names its
// `with` expressions use. `use name` is refused here with a reason: its
// notation needs the parser engine written in Allegretto, which is not
// built.

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
  /** `{a: e, [k]: f}`. */
  | { readonly k: "record"; readonly fields: readonly Field[]; readonly at: Place }
  /** `[e, f]`. */
  | { readonly k: "list"; readonly items: readonly Expr[]; readonly at: Place }
  /** An indented block; `sync` where `sync` stands before it. */
  | { readonly k: "block"; readonly items: readonly Item[]; readonly sync: boolean; readonly at: Place };

/** One entry of a structure literal: `name: e`, or `[k]: e` with a computed key. */
export type Field =
  | { readonly k: "named"; readonly name: Name; readonly value: Expr }
  | { readonly k: "computed"; readonly key: Expr; readonly value: Expr; readonly at: Place };

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

/** One pair of an import's `with` list: the name the imported module declares, and the expression handed for it. */
export interface WithPair {
  readonly name: Name;
  readonly value: Expr;
}

/** A header line. */
export interface Header {
  readonly k: "capability" | "input" | "key" | "import";
  readonly name: Name;
  readonly at: Place;
  /** For an import: the pairs of its `with` list, in written order. Empty for every other header line. */
  readonly with: readonly WithPair[];
  /** For an import: the names of its `without` list, in written order. Empty for every other header line. */
  readonly without: readonly Name[];
}

/** A text read as one module: its header lines, in written order, and its block. */
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
/** The least integer, -2^63: written only as prefix `-` on the whole number 2^63. */
const INT_MIN = -(1n << 63n);
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
  /** A node with the levels of the ladder that hold no operator taken off: the operand itself. */
  const bare = (t: ParseTree): ParseTree => {
    let n = t;
    while (n.kind === "branch" && n.tag === LADDER_TAG && n.children.length === 2 && branches(n.children[1]).length === 0) n = n.children[0];
    return n;
  };
  /**
   * `-` written before a number that is one literal with its sign (forms.md
   * §2, "Values"): a whole number of exactly 2^63, the least integer, and
   * any fraction. Undefined for any other operand: there `-` is `int.neg`.
   */
  const negativeLiteral = (t: Branch): Expr | undefined => {
    const operand = branches(t).find((c) => !["ws", "ws_any", "ws_req", "hws"].includes(c.tag ?? ""));
    const n = operand === undefined ? undefined : bare(operand);
    if (n === undefined || n.kind !== "branch") return undefined;
    if (n.tag === "float") {
      const f = float(n);
      return f.k === "float" ? { k: "float", value: -f.value, at: at(t) } : f;
    }
    if (n.tag !== "number") return undefined;
    const digits = leafText(n);
    return !/^0[bB]/.test(digits) && BigInt(digits) === -INT_MIN ? { k: "int", value: INT_MIN, at: at(t) } : undefined;
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
        return negativeLiteral(t) ?? { k: "unary", op: "-", operand: lastExpr(t), at: at(t) };
      case "not":
        return { k: "unary", op: "!", operand: lastExpr(t), at: at(t) };
      case "if": {
        const isBody = (c: Branch): boolean => c.tag === "fn_body" || c.tag === "sync_block";
        const bodies = branches(t).filter(isBody).map((c) => (c.tag === "sync_block" ? expr(c) : lastExpr(c)));
        const condition = branches(t).filter((c) => !["ws", "ws_req"].includes(c.tag ?? "") && !isBody(c))[0];
        return { k: "if", condition: expr(condition), then: bodies[0], else: bodies[1], at: at(t) };
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
        const list = fields.kind === "branch" ? branches(fields.children[0]).filter((c) => c.tag === "object_field" || c.tag === "computed_field") : [];
        return {
          k: "record",
          fields: list.map((f): Field =>
            f.tag === "object_field"
              ? { k: "named", name: nameOf(child(f, "ident")), value: lastExpr(f) }
              : { k: "computed", key: lastNonClose(f), value: lastExpr(f), at: at(f) }),
          at: at(t),
        };
      }
      case "block_expr":
        return { k: "block", items: block(t), sync: false, at: at(t) };
      case "sync_block":
        return { k: "block", items: block(child(t, "block_expr")), sync: true, at: at(t) };
      default:
        return refuse(at(t), `the parse tree has a form ${t.tag ?? "(untagged)"} that Allegretto does not have`);
    }
  };

  /** The statements of a block node: the repetition among its children. */
  const statementsOf = (t: Branch): Branch[] => {
    const rep = t.children.find((c) => c.kind === "branch" && c.tag !== "stmt");
    return rep === undefined ? [] : branches(rep).filter((c) => c.tag === "stmt");
  };
  const block = (t: Branch): Item[] => {
    const items: Item[] = [];
    for (const s of statementsOf(t)) {
      const it = statement(s, false);
      if (it !== undefined) items.push(it);
    }
    arrowsInPlace(items, []);
    return items;
  };
  /** The branches under a node that have one of the tags, not looking inside one found. */
  const tagged = (t: ParseTree, tags: readonly string[]): Branch[] =>
    branches(t).flatMap((c) => (tags.includes(c.tag ?? "") ? [c] : tagged(c, tags)));

  /** The value of a binding, a function or `x <- e`: an indented block, `sync` and one, or an expression. */
  const bodyOf = (inner: Branch): Expr => {
    const b = branches(inner).find((c) => c.tag === "fn_body" || c.tag === "sync_block");
    if (b === undefined) return refuse(at(inner), "the parse tree has no fn_body here");
    return b.tag === "sync_block" ? expr(b) : lastExpr(b);
  };

  /**
   * Refuses each statement written above `x <- e` in its block that needs
   * `x`, itself or through a binding of the block (forms.md §2, "Failures"):
   * it would start `e` before its place. `imports` are the module's
   * imports, each a binding of its block that uses the names of its
   * `with` expressions.
   */
  const arrowsInPlace = (items: readonly Item[], imports: readonly Header[]): void => {
    const uses = new Map<string, Set<string>>();
    for (const it of items) if (it.k === "binding" || it.k === "function") uses.set(it.name.name, freeOfItem(it));
    for (const h of imports) {
      const used = new Set<string>();
      for (const p of h.with) freeNames(p.value, used);
      uses.set(h.name.name, used);
    }
    /** The names of this block a line needs: what it uses, and what the bindings it uses use, of this block's names. */
    const needs = (it: Item): Set<string> => {
      const out = new Set<string>();
      const todo = [...freeOfItem(it)];
      while (todo.length > 0) {
        const n = todo.pop() as string;
        if (out.has(n)) continue;
        out.add(n);
        const b = uses.get(n);
        if (b !== undefined) todo.push(...b);
      }
      return out;
    };
    const lines = items.filter((it) => it.k === "statement" || it.k === "arrow");
    lines.forEach((arrow, j) => {
      if (arrow.k !== "arrow") return;
      const x = arrow.name.name;
      for (const it of lines.slice(0, j))
        if (needs(it).has(x))
          findings.push({
            at: it.at,
            message: `the statement at ${it.at.line}:${it.at.column} needs ${x}, which ${x} <- … binds below it at ${arrow.at.line}:${arrow.at.column}: it would start that line's value before its place`,
          });
    });
  };

  const headers: Header[] = [];
  /** One line. A header line is collected apart and gives no item. */
  const statement = (s: Branch, top: boolean): Item | undefined => {
    try {
      const inner = branch(s.children[0]);
      const where = at(s);
      switch (inner.tag) {
        case "capability_decl":
        case "input_decl":
        case "key_decl":
        case "import_stmt": {
          const k = inner.tag === "capability_decl" ? "capability" : inner.tag === "input_decl" ? "input" : inner.tag === "key_decl" ? "key" : "import";
          if (!top) return refuse(where, `the header line ${k} belongs at the top level of the module, not in a block`);
          const name = nameOf(child(inner, "ident"));
          const lists = tagged(inner, ["with_clause", "without_clause"]);
          for (const word of ["with", "without"]) {
            const written = lists.filter((c) => c.tag === `${word}_clause`);
            if (written.length > 1) return refuse(at(written[1]), `the import of ${name.name} has two ${word} lists: write one, its entries separated by commas`);
          }
          const pairs = lists.filter((c) => c.tag === "with_clause").flatMap((c) => tagged(c, ["with_pair"]));
          const withheld = lists.filter((c) => c.tag === "without_clause").flatMap((c) => tagged(c, ["ident"]));
          headers.push({
            k,
            name,
            at: where,
            with: pairs.map((p) => ({ name: nameOf(child(p, "ident")), value: lastExpr(p) })),
            without: withheld.map(nameOf),
          });
          return undefined;
        }
        case "use_decl":
          return refuse(
            where,
            `use ${leafText(child(inner, "ident"))} brings a module's notation, which needs the parser engine written in Allegretto; that engine is not built, so use is not read yet (forms.md §2, "The module")`,
          );
        case "binding":
        case "export_binding": {
          const exported = inner.tag === "export_binding";
          if (exported && !top) return refuse(where, "export marks a binding of the module, and this one is in a block inside it");
          return { k: "binding", name: nameOf(child(inner, "ident")), value: bodyOf(inner), exported, at: where };
        }
        case "fn_decl":
        case "export_fn_decl": {
          const exported = inner.tag === "export_fn_decl";
          if (exported && !top) return refuse(where, "export marks a binding of the module, and this one is in a block inside it");
          const params = branches(inner).find((c) => c.tag === "param_list");
          return { k: "function", name: nameOf(child(inner, "ident")), params: paramsOf(params), body: bodyOf(inner), exported, at: where };
        }
        case "arrow_binding":
          return { k: "arrow", name: nameOf(child(inner, "ident")), value: bodyOf(inner), at: where };
        default:
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
  arrowsInPlace(items, headers.filter((h) => h.k === "import"));
  if (findings.length > 0) return { ok: false, findings: [...findings].sort((a, b) => a.at.start - b.at.start) };
  return { ok: true, module: { headers, items } };
}

// ── The names an expression uses ──────────────────────────────────────

/** The names an expression uses that nothing inside it binds. `int.add` uses `int`. */
export function freeNames(e: Expr, out: Set<string> = new Set()): Set<string> {
  switch (e.k) {
    case "name":
      out.add(e.name);
      break;
    case "lambda": {
      const inner = freeNames(e.body);
      for (const p of e.params) inner.delete(p.name);
      for (const n of inner) out.add(n);
      break;
    }
    case "apply":
      freeNames(e.fn, out);
      e.args.forEach((a) => freeNames(a, out));
      break;
    case "pipe":
      freeNames(e.value, out);
      freeNames(e.fn, out);
      break;
    case "dot":
      freeNames(e.object, out);
      break;
    case "index":
      freeNames(e.object, out);
      freeNames(e.index, out);
      break;
    case "if":
      freeNames(e.condition, out);
      freeNames(e.then, out);
      freeNames(e.else, out);
      break;
    case "binary":
      freeNames(e.left, out);
      freeNames(e.right, out);
      break;
    case "unary":
      freeNames(e.operand, out);
      break;
    case "record":
      for (const f of e.fields) {
        if (f.k === "computed") freeNames(f.key, out);
        freeNames(f.value, out);
      }
      break;
    case "list":
      e.items.forEach((i) => freeNames(i, out));
      break;
    case "block": {
      const bound = new Set(e.items.flatMap((i) => (i.k === "statement" ? [] : [i.name.name])));
      const inner = new Set<string>();
      for (const i of e.items) for (const n of freeOfItem(i)) inner.add(n);
      for (const n of inner) if (!bound.has(n)) out.add(n);
      break;
    }
    default:
      break;
  }
  return out;
}

/** The names one line of a block uses: of its value, or of its function's body less the parameters. */
function freeOfItem(it: Item): Set<string> {
  if (it.k === "statement") return freeNames(it.expr);
  if (it.k === "function") {
    const inner = freeNames(it.body);
    for (const p of it.params) inner.delete(p.name);
    return inner;
  }
  return freeNames(it.value);
}
