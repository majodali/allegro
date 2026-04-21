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

    case "call": return buildCall(tree, paramMap);
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
    case "string": {
      const raw = textOf(tree);
      const unquoted = raw.slice(1, -1); // strip surrounding quotes
      // Handle basic escape sequences
      const unescaped = unquoted.replace(/\\(.)/g, (_, ch) => {
        switch (ch) {
          case "n":  return "\n";
          case "t":  return "\t";
          case "\\": return "\\";
          case "\"": return "\"";
          default:   return ch;
        }
      });
      return stringToBits(unescaped);
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
  "neg","not","call","paren","if","lambda1","lambdaN","number","string","ident",
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
