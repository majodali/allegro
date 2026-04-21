// =============================================================================
// Allegro Grammar 2 — Tree Builder
//
// Converts a grammar2 ParseTree (from the scannerless engine) into an Allegro
// Value tree (Expression/ComposedFunction/Bits/...) matching the shape the
// evaluator expects. The existing hybrid parser produces Value trees directly;
// this builder produces the same output via a post-pass on ParseTrees.
//
// This file is specific to the BASE (Allegretto) grammar in base-grammar.ts.
// The Standard grammar (Phase 2c) will reuse most of these builders and add
// cases for typed literals, dot access, array literals, etc.
// =============================================================================

import { ParseTree } from "./types.js";
import {
  makeInt, makeBits, stringToBits, makeParam, makeSymbol, makeExpr,
  makeComposedFn, makeContext, prim, bind,
} from "../parser-helpers.js";
import { makeFloat } from "../types.js";

// --- Helpers ---

/**
 * Unwrap a ParseTree to its text value. Only valid on leaves or branches
 * that collapse to a single text content (e.g., the `ident` production).
 */
function textOf(tree: ParseTree): string {
  switch (tree.kind) {
    case "leaf":   return tree.text;
    case "branch": {
      // Concatenate all leaf children recursively. Used for things like
      // identifiers, which the grammar represents as a single branch but
      // whose raw characters are split into sub-leaves.
      let out = "";
      for (const c of tree.children) out += textOf(c);
      return out;
    }
    case "none":   return "";
    case "error":  return "";
  }
}

/** Return the tree with its outer branch layer stripped until we hit a tagged node. */
function peelUntilTag(tree: ParseTree): ParseTree {
  while (tree.kind === "branch" && !tree.tag && tree.children.length === 1) {
    tree = tree.children[0];
  }
  return tree;
}

// --- Expression builder ---

/**
 * Build a Value from a ParseTree rooted at an expression production. The
 * tag system from the grammar tells us which operator/form to emit.
 */
export function buildExpr(tree: ParseTree, paramMap: Map<string, any>): any {
  tree = peelUntilTag(tree);

  if (tree.kind === "leaf") {
    // Rare — most leaves are wrapped in a branch. If we see one, treat as
    // identifier-by-text fallback. Shouldn't normally happen with the base
    // grammar because every atom has a named branch wrapper.
    return makeSymbol(tree.text);
  }
  if (tree.kind === "none") {
    throw new Error("buildExpr: unexpected 'none' node");
  }
  if (tree.kind === "error") {
    throw new Error(`buildExpr: parse error in input: ${tree.message}`);
  }

  const tag = tree.tag;
  const c = tree.children;

  // Binary operators share the same layout: [left, right] (whitespace and
  // operator leaves are interleaved but we skip them by tag lookup).
  switch (tag) {
    // Binary operators — produce Expression(prim_op, [left, right])
    case "or":   return makeExpr(prim("typed_or"),   [buildExpr(c[0], paramMap), buildExpr(lastChild(c), paramMap)]);
    case "and":  return makeExpr(prim("typed_and"),  [buildExpr(c[0], paramMap), buildExpr(lastChild(c), paramMap)]);
    case "eq":   return makeExpr(prim("bits_eq"),    [buildExpr(c[0], paramMap), buildExpr(lastChild(c), paramMap)]);
    case "neq":  return makeExpr(prim("bits_neq"),   [buildExpr(c[0], paramMap), buildExpr(lastChild(c), paramMap)]);
    case "lt":   return makeExpr(prim("bits_lt"),    [buildExpr(c[0], paramMap), buildExpr(lastChild(c), paramMap)]);
    case "gt":   return makeExpr(prim("bits_gt"),    [buildExpr(c[0], paramMap), buildExpr(lastChild(c), paramMap)]);
    case "lte":  return makeExpr(prim("bits_lte"),   [buildExpr(c[0], paramMap), buildExpr(lastChild(c), paramMap)]);
    case "gte":  return makeExpr(prim("bits_gte"),   [buildExpr(c[0], paramMap), buildExpr(lastChild(c), paramMap)]);
    case "add":  return makeExpr(prim("bits_add"),   [buildExpr(c[0], paramMap), buildExpr(lastChild(c), paramMap)]);
    case "sub":  return makeExpr(prim("bits_sub"),   [buildExpr(c[0], paramMap), buildExpr(lastChild(c), paramMap)]);
    case "mul":  return makeExpr(prim("bits_mul"),   [buildExpr(c[0], paramMap), buildExpr(lastChild(c), paramMap)]);
    case "div":  return makeExpr(prim("bits_div"),   [buildExpr(c[0], paramMap), buildExpr(lastChild(c), paramMap)]);
    case "mod":  return makeExpr(prim("bits_mod"),   [buildExpr(c[0], paramMap), buildExpr(lastChild(c), paramMap)]);

    case "neg":  return makeExpr(prim("bits_sub"),   [makeInt(0), buildExpr(lastChild(c), paramMap)]);
    case "not":  return makeExpr(prim("typed_not"),  [buildExpr(lastChild(c), paramMap)]);

    case "call":    return buildCall(tree, paramMap);
    case "dot":     return buildDot(tree, paramMap);
    case "bracket": return buildBracket(tree, paramMap);
    case "paren": {
      // The paren_expr production wraps `( ws expr ws )`. Find the expr child.
      const inner = findTaggedChild(c, ["or","and","eq","neq","lt","gt","lte","gte","add","sub","mul","div","mod","neg","not","call","paren","if","lambda1","lambdaN","number","string","ident"]);
      if (!inner) throw new Error("paren_expr: missing inner expression");
      return buildExpr(inner, paramMap);
    }

    case "if": {
      // Children: "if" ws_req <cond> ws_req "then" ws_req <then> ws_req "else" ws_req <else>
      // Filter to just expression-tagged branches (skips ws, ws_req, keyword leaves).
      const exprBranches = c.filter(ch =>
        ch.kind === "branch" && ch.tag && EXPRESSION_TAGS.has(ch.tag),
      );
      if (exprBranches.length < 3) throw new Error(`if: expected 3 expressions, got ${exprBranches.length}`);
      const condV = buildExpr(exprBranches[0], paramMap);
      const thenV = buildExpr(exprBranches[1], paramMap);
      const elseV = buildExpr(exprBranches[2], paramMap);
      // Wrap then/else in thunks (zero-arg ComposedFunctions) for lazy eval_if.
      const thenThunk = makeComposedFn([], thenV);
      const elseThunk = makeComposedFn([], elseV);
      return makeExpr(prim("eval_if"), [condV, thenThunk, elseThunk]);
    }

    case "lambda1":
    case "lambdaN":
      return buildLambda(tree, paramMap);

    case "number": {
      const txt = textOf(tree);
      return makeInt(Number(txt));
    }
    case "float": {
      // Emit typed_float(bits) so the evaluator produces a Float-typed value.
      // (A raw 64-bit Bits would be wrapped as Int by typeLiterals otherwise.)
      const txt = textOf(tree);
      const f = makeFloat(Number(txt));
      return makeExpr(prim("typed_float"), [f]);
    }
    case "bool": {
      // `true` and `false` are extension-provided bindings in Standard mode.
      // Emit Symbol; resolveSymbols will link it to the extension value.
      const txt = textOf(tree);
      return makeSymbol(txt);
    }
    case "none_lit": {
      return makeSymbol("none");
    }
    case "string": {
      return buildString(tree, paramMap);
    }
    case "array_lit": {
      return buildArrayLit(tree, paramMap);
    }
    case "object_lit": {
      return buildObjectLit(tree, paramMap);
    }
    case "ident": {
      const name = textOf(tree);
      if (paramMap.has(name)) return paramMap.get(name);
      return makeSymbol(name);
    }
  }

  // Untagged: a pass-through wrapper. Descend to the only child.
  if (c.length === 1) return buildExpr(c[0], paramMap);

  throw new Error(`buildExpr: unrecognized tree tag '${tag ?? "(untagged)"}' with ${c.length} children`);
}

/** Grab the last branch/leaf child after skipping whitespace/operator tokens. */
function lastChild(children: ParseTree[]): ParseTree {
  // Walk from the end; skip empty leaves (whitespace). Return the last
  // content-bearing child.
  for (let i = children.length - 1; i >= 0; i--) {
    const c = children[i];
    if (c.kind === "branch") return c;
    if (c.kind === "leaf" && c.text.trim() !== "" && !/^[-+*/<>!=%&|]+$/.test(c.text)) {
      return c;
    }
  }
  return children[children.length - 1];
}

function findTaggedChild(children: ParseTree[], tags: string[]): ParseTree | null {
  for (const c of children) {
    if (c.kind === "branch" && c.tag && tags.includes(c.tag)) return c;
    if (c.kind === "branch" && !c.tag && c.children.length > 0) {
      const found = findTaggedChild(c.children, tags);
      if (found) return found;
    }
  }
  return null;
}

// --- Dot access: `obj.field` → Expression(type_dispatch, [obj, "field"]) ---

function buildDot(tree: ParseTree, paramMap: Map<string, any>): any {
  if (tree.kind !== "branch") throw new Error("buildDot: not a branch");
  const c = tree.children;
  // Children: [expr_post, ".", ident]. The field is the LAST ident, not the
  // first — the obj is also often an ident, so `find` would grab the wrong
  // one. Scan from the end.
  const objTree = c[0];
  let identTree: ParseTree | null = null;
  for (let i = c.length - 1; i >= 1; i--) {
    if (c[i].kind === "branch" && (c[i] as any).tag === "ident") {
      identTree = c[i]; break;
    }
  }
  if (!identTree) throw new Error("dot: missing field ident");
  const obj = buildExpr(objTree, paramMap);
  const field = textOf(identTree);
  return makeExpr(prim("type_dispatch"), [obj, stringToBits(field)]);
}

// --- Bracket indexing: `arr[i]` → Expression(type_dispatch(arr, "get"), [i]) ---

function buildBracket(tree: ParseTree, paramMap: Map<string, any>): any {
  if (tree.kind !== "branch") throw new Error("buildBracket: not a branch");
  const c = tree.children;
  // Children: [expr_post, "[", ws, expr, ws, "]"]
  const objTree = c[0];
  const indexTree = c.slice(1).find(ch =>
    ch.kind === "branch" && ch.tag && EXPRESSION_TAGS.has(ch.tag),
  );
  if (!indexTree) throw new Error("bracket: missing index expression");
  const obj = buildExpr(objTree, paramMap);
  const index = buildExpr(indexTree, paramMap);
  const getter = makeExpr(prim("type_dispatch"), [obj, stringToBits("get")]);
  return makeExpr(getter, [index]);
}

// --- String literals (with interpolation) ---

/**
 * Build a typed-string expression from a `string` branch tree. The tree has
 * the structure:
 *
 *   [string]
 *     "\""                          <- opening quote leaf
 *     [<rep>]                        <- untagged rep body
 *       [string_chars]  text         \ zero or more
 *       [string_escape] \x text      | mixed in
 *       [string_interp] { expr }    / any order
 *     "\""                          <- closing quote leaf
 *
 * Output: typed_string(bits) when no interp; otherwise a chain of
 * concatenations: typed_string(s0) + type_dispatch(e1, "toString")() + typed_string(s1) + ...
 * matching the hybrid parser's shape.
 */
function buildString(tree: ParseTree, paramMap: Map<string, any>): any {
  if (tree.kind !== "branch") throw new Error("buildString: not a branch");
  // Walk children depth-first, collecting runs of text and interp exprs.
  // Emit a running "accumulator" as we go: string + toString(expr) + string + ...
  const parts: Array<{ kind: "text"; text: string } | { kind: "expr"; value: any }> = [];

  const walk = (t: ParseTree): void => {
    if (t.kind === "leaf") {
      // Skip the surrounding quote leaves (they're the opening/closing quotes).
      if (t.text === "\"") return;
      // Other leaves shouldn't appear inside string; ignore defensively.
      return;
    }
    if (t.kind === "none") return;
    if (t.kind === "error") return;
    // Branch
    if (t.tag === "string_chars") {
      appendText(parts, t.children.map(c => c.kind === "leaf" ? c.text : "").join(""));
      return;
    }
    if (t.tag === "string_escape") {
      const raw = textOf(t);
      // raw is "\x" — one escape char
      const ch = raw[1] ?? "";
      appendText(parts, unescape(ch));
      return;
    }
    if (t.tag === "string_interp") {
      // Children: "{", ws, expr, ws, "}"
      const exprTree = t.children.find(ch =>
        ch.kind === "branch" && ch.tag && EXPRESSION_TAGS.has(ch.tag),
      );
      if (!exprTree) throw new Error("string_interp: missing expression");
      parts.push({ kind: "expr", value: buildExpr(exprTree, paramMap) });
      return;
    }
    // Untagged wrapper — descend.
    for (const c of t.children) walk(c);
  };
  walk(tree);

  // Build output. Ensure we always start and end with a text (possibly "").
  if (parts.length === 0 || parts[0].kind !== "text") {
    parts.unshift({ kind: "text", text: "" });
  }
  let result: any = makeExpr(prim("typed_string"), [stringToBits((parts[0] as any).text)]);
  for (let i = 1; i < parts.length; i++) {
    const p = parts[i];
    let piece: any;
    if (p.kind === "text") {
      piece = makeExpr(prim("typed_string"), [stringToBits(p.text)]);
    } else {
      // type_dispatch(expr, "toString")()
      const method = makeExpr(prim("type_dispatch"), [p.value, stringToBits("toString")]);
      piece = makeExpr(method, []);
    }
    result = makeExpr(prim("bits_add"), [result, piece]);
  }
  return result;
}

function appendText(parts: Array<{ kind: "text"; text: string } | { kind: "expr"; value: any }>, text: string): void {
  const last = parts[parts.length - 1];
  if (last && last.kind === "text") last.text += text;
  else parts.push({ kind: "text", text });
}

function unescape(ch: string): string {
  switch (ch) {
    case "n":  return "\n";
    case "t":  return "\t";
    case "\\": return "\\";
    case "\"": return "\"";
    case "{":  return "{";
    case "}":  return "}";
    default:   return ch;
  }
}

// --- Array literal ---

function buildArrayLit(tree: ParseTree, paramMap: Map<string, any>): any {
  if (tree.kind !== "branch") throw new Error("buildArrayLit: not a branch");
  // Children: "[", ws, <opt rep of expr>, ws, "]"
  const elems: any[] = [];
  const walk = (t: ParseTree): void => {
    if (t.kind !== "branch") return;
    if (t.tag && EXPRESSION_TAGS.has(t.tag)) {
      elems.push(buildExpr(t, paramMap));
      return;
    }
    // Skip whitespace
    if (t.tag === "ws" || t.tag === "ws_req") return;
    for (const c of t.children) walk(c);
  };
  // Skip the outer `[` and `]` leaves by walking all children of tree.
  for (const c of tree.children) walk(c);
  return makeExpr(prim("typed_array"), elems);
}

// --- Object literal ---

function buildObjectLit(tree: ParseTree, paramMap: Map<string, any>): any {
  if (tree.kind !== "branch") throw new Error("buildObjectLit: not a branch");
  // The object literal's children contain object_field branches. typed_object
  // takes a flat list [key_bits, value, key_bits, value, ...].
  const args: any[] = [];
  const walk = (t: ParseTree): void => {
    if (t.kind !== "branch") return;
    if (t.tag === "object_field") {
      // Children: ident, ws, ":", ws, expr
      const keyTree = t.children.find(ch => ch.kind === "branch" && ch.tag === "ident");
      const valTree = t.children.slice().reverse().find(ch =>
        ch.kind === "branch" && ch.tag && EXPRESSION_TAGS.has(ch.tag),
      );
      if (!keyTree || !valTree) throw new Error("object_field: missing key or value");
      args.push(stringToBits(textOf(keyTree)));
      args.push(buildExpr(valTree, paramMap));
      return;
    }
    for (const c of t.children) walk(c);
  };
  for (const c of tree.children) walk(c);
  return makeExpr(prim("typed_object"), args);
}

// --- Function calls ---

function buildCall(tree: ParseTree, paramMap: Map<string, any>): any {
  if (tree.kind !== "branch") throw new Error("buildCall: not a branch");
  const c = tree.children;
  // Children: [callee_expr_post, "(", ws, args, ws, ")"]
  // The first child is the callee (recursively); the args live in the `args` branch.
  const calleeTree = c[0];
  const callee = buildExpr(calleeTree, paramMap);
  // Find the args branch
  let argsTree: ParseTree | null = null;
  for (const ch of c) {
    if (ch.kind === "branch" && (ch.tag === "args" || ch.tag === undefined)) {
      // The `args = opt(spaced_list(...))` production. opt may produce a
      // 'none' or a branch containing a Rep branch of argument expressions.
      argsTree = ch;
    }
  }
  const args = argsTree ? collectArgs(argsTree, paramMap) : [];
  return makeExpr(callee, args);
}

function collectArgs(tree: ParseTree, paramMap: Map<string, any>): any[] {
  if (tree.kind === "none") return [];
  if (tree.kind === "leaf") return [];
  // Walk children. Pick only expression-looking children (branches with
  // known tags or at least a branch kind). Skip whitespace and comma leaves.
  const out: any[] = [];
  const walk = (t: ParseTree) => {
    if (t.kind !== "branch") return;
    // If it looks like an expression tag, build and add.
    if (t.tag && EXPRESSION_TAGS.has(t.tag)) {
      out.push(buildExpr(t, paramMap));
      return;
    }
    // Otherwise descend.
    for (const c of t.children) walk(c);
  };
  walk(tree);
  return out;
}

const EXPRESSION_TAGS = new Set([
  "or","and","eq","neq","lt","gt","lte","gte","add","sub","mul","div","mod",
  "neg","not","call","dot","bracket","paren","if","lambda1","lambdaN",
  "number","float","bool","none_lit","string","ident",
  "array_lit","object_lit",
]);

// --- Lambdas ---

function buildLambda(tree: ParseTree, outerParamMap: Map<string, any>): any {
  if (tree.kind !== "branch") throw new Error("buildLambda: not a branch");
  const c = tree.children;

  // Extract parameter names:
  const paramNames: string[] = [];
  if (tree.tag === "lambda1") {
    // First child is the ident branch
    const identTree = c.find(ch => ch.kind === "branch" && ch.tag === "ident");
    if (!identTree) throw new Error("lambda1: missing param ident");
    paramNames.push(textOf(identTree));
  } else {
    // lambdaN: param_list branch holds them
    const paramListTree = c.find(ch => ch.kind === "branch" && ch.tag === "param_list");
    if (paramListTree) {
      collectIdents(paramListTree, paramNames);
    }
  }

  // Build Params and extend paramMap
  const params = paramNames.map((n, i) => makeParam(i, n));
  const innerMap = new Map(outerParamMap);
  for (let i = 0; i < paramNames.length; i++) innerMap.set(paramNames[i], params[i]);

  // Find the body expression (the last branch child with an expression tag)
  let bodyTree: ParseTree | null = null;
  for (let i = c.length - 1; i >= 0; i--) {
    const ch = c[i];
    if (ch.kind === "branch" && ch.tag && EXPRESSION_TAGS.has(ch.tag)) {
      bodyTree = ch;
      break;
    }
    if (ch.kind === "branch" && !ch.tag) {
      // An unwrapped passthrough — descend
      const inner = findTaggedChild([ch], [...EXPRESSION_TAGS]);
      if (inner) { bodyTree = inner; break; }
    }
  }
  if (!bodyTree) throw new Error("lambda: missing body");

  const body = buildExpr(bodyTree, innerMap);
  return makeComposedFn(params, body);
}

function collectIdents(tree: ParseTree, out: string[]): void {
  if (tree.kind !== "branch") return;
  if (tree.tag === "ident") {
    out.push(textOf(tree));
    return;
  }
  for (const c of tree.children) collectIdents(c, out);
}

// --- Statements ---

export interface BuiltBinding {
  key: string | null;      // null for bare expressions
  value: any;
}

export function buildStmt(tree: ParseTree): BuiltBinding {
  tree = peelUntilTag(tree);
  if (tree.kind !== "branch") throw new Error("buildStmt: not a branch");

  // A "stmt" production wrapper may contain the inner tagged stmt.
  if (tree.tag === "stmt") {
    // Find the inner tagged child
    for (const c of tree.children) {
      if (c.kind === "branch" && c.tag) return buildStmt(c);
    }
  }

  const tag = tree.tag;
  const c = tree.children;

  if (tag === "binding") {
    // ident ws '=' ws expr  →  find ident and expr
    const identTree = c.find(ch => ch.kind === "branch" && ch.tag === "ident");
    const exprTree = c.slice().reverse().find(ch => ch.kind === "branch" && ch.tag !== "ident");
    if (!identTree || !exprTree) throw new Error("binding: missing ident or expr");
    const name = textOf(identTree);
    const value = buildExpr(exprTree, new Map());
    return { key: name, value };
  }

  if (tag === "fn_decl") {
    // ident "(" ws param_list ws ")" ws "=>" ws expr
    const identTree = c.find(ch => ch.kind === "branch" && ch.tag === "ident");
    if (!identTree) throw new Error("fn_decl: missing function name");
    const fnName = textOf(identTree);

    // param_list branch carries tag "param_list" (its production name).
    const paramNames: string[] = [];
    const paramListTree = c.find(ch => ch.kind === "branch" && ch.tag === "param_list");
    if (paramListTree) collectIdents(paramListTree, paramNames);

    // Body: the last expression-tagged branch. Must skip non-expr branches
    // (ws, param_list) and only consider true expressions.
    let bodyTree: ParseTree | null = null;
    for (let i = c.length - 1; i >= 0; i--) {
      const ch = c[i];
      if (ch.kind === "branch" && ch.tag && EXPRESSION_TAGS.has(ch.tag)) {
        bodyTree = ch; break;
      }
    }
    if (!bodyTree) throw new Error("fn_decl: missing body");

    const params = paramNames.map((n, i) => makeParam(i, n));
    const innerMap = new Map<string, any>();
    for (let i = 0; i < paramNames.length; i++) innerMap.set(paramNames[i], params[i]);
    const body = buildExpr(bodyTree, innerMap);
    const fn = makeComposedFn(params, body);
    return { key: fnName, value: fn };
  }

  // Bare expression (the stmt's whole tree is an expression). Rebuild as expr.
  const value = buildExpr(tree, new Map());
  return { key: null, value };
}

// --- Top-level: program → fileCtx ---

export function buildProgram(tree: ParseTree): any {
  tree = peelUntilTag(tree);
  const ctx = makeContext();

  function addStmt(stmt: BuiltBinding): void {
    const b = { key: stmt.key, value: stmt.value, isUse: false };
    (ctx as any).bindingList.push(b);
    if (stmt.key !== null) (ctx as any).bindings.set(stmt.key, b);
  }

  // The program tree is either a "program" branch or untagged wrapper.
  const root = tree;
  if (root.kind !== "branch") {
    throw new Error("buildProgram: expected branch root");
  }

  // Walk to find stmt branches.
  const walk = (t: ParseTree): void => {
    if (t.kind !== "branch") return;
    if (t.tag === "stmt" || t.tag === "binding" || t.tag === "fn_decl" ||
        (t.tag && EXPRESSION_TAGS.has(t.tag))) {
      // Build this stmt
      try {
        addStmt(buildStmt(t));
      } catch (e: any) {
        // If a stmt build fails, log but continue
        throw new Error(`Failed to build stmt: ${e.message}`);
      }
      return;
    }
    for (const c of t.children) walk(c);
  };
  walk(root);
  return ctx;
}
