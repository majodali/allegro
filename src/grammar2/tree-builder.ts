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
  makeComposedFn, makeContext, prim, bind, buildFn, substName,
} from "../parser-helpers.js";
import { makeFloat } from "../types.js";
import { getUserOp } from "./fragments.js";
import { substituteParams } from "../evaluator.js";

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
    // Logical operators wrap RHS in a zero-arg thunk so it can be lazily
    // evaluated (short-circuit) or inspected as a predicate body (for
    // `Type && _ > 0` refinements).
    case "or":   return makeExpr(prim("typed_or"),   [buildExpr(c[0], paramMap), makeComposedFn([], buildExpr(lastChild(c), paramMap))]);
    case "and":  return makeExpr(prim("typed_and"),  [buildExpr(c[0], paramMap), makeComposedFn([], buildExpr(lastChild(c), paramMap))]);
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

    // Pipe: `x |> f` → `f(x)`. left-associative.
    case "pipe": {
      const left = buildExpr(c[0], paramMap);
      const right = buildExpr(lastChild(c), paramMap);
      return makeExpr(right, [left]);
    }

    // Type operators — use the typed variants (type-aware dispatch)
    case "instanceof": return makeExpr(prim("type_instanceof"), [buildExpr(c[0], paramMap), buildExpr(lastChild(c), paramMap)]);
    case "subtypeof":  return makeExpr(prim("type_subtypeof"),  [buildExpr(c[0], paramMap), buildExpr(lastChild(c), paramMap)]);

    // MultiValue component access: `name of expr` → component_get(expr, "name")
    // Note: `component_get` is lazy — it sees the MultiValue wrapper directly,
    // unlike `mv_get` which operates on primaryArgs.
    case "of": {
      // c[0] is the ident (component name); last expression-tagged child is the target.
      const name = textOf(c[0]);
      const target = buildExpr(lastChild(c), paramMap);
      return makeExpr(prim("component_get"), [target, stringToBits(name)]);
    }
    case "of_error": {
      // `error of expr` — same shape but LHS is the literal `error` keyword.
      const target = buildExpr(lastChild(c), paramMap);
      return makeExpr(prim("component_get"), [target, stringToBits("error")]);
    }

    // Error creation: `error expr` → make_error(expr)
    case "error_expr": {
      return makeExpr(prim("make_error"), [buildExpr(lastChild(c), paramMap)]);
    }

    case "call":    return buildCall(tree, paramMap);
    case "dot":     return buildDot(tree, paramMap);
    case "bracket": return buildBracket(tree, paramMap);
    case "paren": {
      // The paren_expr production wraps `( ws expr ws )`. Find the first
      // expression-tagged branch child.
      let inner: ParseTree | null = null;
      for (const ch of c) {
        if (ch.kind === "branch" && EXPRESSION_TAGS.has(ch.tag)) { inner = ch; break; }
      }
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
    case "lambda1_typed":
    case "lambdaN":
      return buildLambda(tree, paramMap);

    case "when_expr":
      return buildWhenExpr(tree, paramMap);

    case "block_expr":
      return buildBlockExpr(tree, paramMap);

    case "number": {
      const txt = textOf(tree);
      if (txt.startsWith("0x") || txt.startsWith("0X")) {
        return makeInt(parseInt(txt, 16));
      }
      if (txt.startsWith("0b") || txt.startsWith("0B")) {
        return makeInt(parseInt(txt.slice(2), 2));
      }
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

  // User-registered operator (from `register_infix` / `register_prefix` /
  // `register_postfix` / `register_expr_prefix` with `use_grammar NAME`).
  // The tag is a unique identifier issued by fragments.ts; look up the
  // user's substitution template and apply it to the operand AST(s).
  if (tag && tag.startsWith("user_op_")) {
    const userOp = getUserOp(tag);
    if (!userOp) throw new Error(`buildExpr: unknown user-op tag '${tag}'`);
    // Collect expression-typed children (the operands). For infix there
    // are two; for prefix/postfix there's one; the expr-prefix keyword
    // form has one.
    const operands: any[] = [];
    for (const ch of c) {
      if (ch.kind === "branch" && ch.tag && EXPRESSION_TAGS.has(ch.tag)) {
        operands.push(buildExpr(ch, paramMap));
      }
    }
    // Apply substituteParams: body of user's lambda has Params referring
    // to the operand positions (0, 1, ...). Substitution produces the
    // expanded AST.
    return substituteParams(userOp.fn as any, operands);
  }

  // Untagged: a pass-through wrapper. Descend to the only child.
  if (c.length === 1) return buildExpr(c[0], paramMap);

  throw new Error(`buildExpr: unrecognized tree tag '${tag ?? "(untagged)"}' with ${c.length} children`);
}

/**
 * Find a function/binding body inside a stmt's children. The body lives
 * either as a direct expression-tagged branch (inline case) or inside a
 * `fn_body` wrapper (which may contain either an inline expression or a
 * block_expr). Returns the body tree — which may be an expression, a
 * `block_expr`, or null if missing.
 */
function findBodyExpr(children: ParseTree[]): ParseTree | null {
  // Scan from the end for fn_body or direct expression.
  for (let i = children.length - 1; i >= 0; i--) {
    const ch = children[i];
    if (ch.kind !== "branch") continue;
    if (ch.tag === "fn_body") {
      // Descend: look for block_expr or expression tag inside.
      for (let j = ch.children.length - 1; j >= 0; j--) {
        const sub = ch.children[j];
        if (sub.kind === "branch") {
          if (sub.tag === "block_expr") return sub;
          if (sub.tag && EXPRESSION_TAGS.has(sub.tag)) return sub;
          // Could be an untagged seq wrapper — descend once more
          const inner = findInner(sub);
          if (inner) return inner;
        }
      }
      continue;
    }
    if (ch.tag && EXPRESSION_TAGS.has(ch.tag)) {
      return ch;
    }
  }
  return null;
}

function findInner(t: ParseTree): ParseTree | null {
  if (t.kind !== "branch") return null;
  if (t.tag === "block_expr" || (t.tag && EXPRESSION_TAGS.has(t.tag))) return t;
  for (const c of t.children) {
    const r = findInner(c);
    if (r) return r;
  }
  return null;
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

// --- when/is/then pattern matching ---

interface PatternResult {
  pattern:      any;           // Value — the pattern AST
  bindingNames: string[];      // names extracted by this pattern
}

function buildPattern(tree: ParseTree): PatternResult {
  if (tree.kind !== "branch") throw new Error("buildPattern: not a branch");
  const tag = tree.tag;
  const c = tree.children;

  switch (tag) {
    case "pattern_wildcard":
      return { pattern: makeExpr(prim("when_wildcard"), []), bindingNames: [] };

    case "pattern_number": {
      const numTree = c.find(ch => ch.kind === "leaf" || ch.kind === "branch");
      const txt = textOf(tree);
      return { pattern: makeInt(Number(txt)), bindingNames: [] };
    }
    case "pattern_neg_number": {
      // Children include "-" and a number leaf/branch
      const digits = textOf(tree).replace(/^-/, "");
      return {
        pattern: makeExpr(prim("bits_sub"), [makeInt(0), makeInt(Number(digits))]),
        bindingNames: [],
      };
    }
    case "pattern_string": {
      // Build the string normally (handles escapes + interpolation if any,
      // though interpolation in patterns is unusual and probably should error)
      const pat = buildString(tree, new Map());
      return { pattern: pat, bindingNames: [] };
    }
    case "pattern_bool": {
      const txt = textOf(tree);
      return { pattern: makeSymbol(txt), bindingNames: [] };
    }
    case "pattern_none":
      return { pattern: makeSymbol("none"), bindingNames: [] };

    case "pattern_ident": {
      // Plain identifier — resolve-first binding. The interpretation at runtime
      // is: if `name` is resolvable in scope, match against that value;
      // otherwise bind `name` to the subject.
      const name = textOf(tree);
      return { pattern: makeSymbol(name), bindingNames: [name] };
    }

    case "pattern_struct": {
      // Children: "{", ws, opt(rep(field_pattern, sep)), ws, "}"
      const fieldArgs: any[] = [];
      const bindingNames: string[] = [];
      collectFieldPatterns(tree, fieldArgs, bindingNames);
      return {
        pattern: makeExpr(prim("when_struct_destruct"), fieldArgs),
        bindingNames,
      };
    }

    case "pattern_typed": {
      // Children: ident "(" ws opt(rep(field_pattern, sep)) ws ")"
      const identTree = c.find(ch => ch.kind === "branch" && ch.tag === "ident");
      if (!identTree) throw new Error("pattern_typed: missing type name");
      const fieldArgs: any[] = [];
      const bindingNames: string[] = [];
      collectFieldPatterns(tree, fieldArgs, bindingNames);
      return {
        pattern: makeExpr(prim("when_type_destruct"), [makeSymbol(textOf(identTree)), ...fieldArgs]),
        bindingNames,
      };
    }
  }

  // Untagged wrapper? Descend.
  if (c.length === 1) return buildPattern(c[0]);
  throw new Error(`buildPattern: unrecognized tag '${tag}'`);
}

/**
 * Walk a pattern_struct / pattern_typed tree, collecting flat field-pattern
 * args and binding names.
 *
 * For each field_pattern:
 *   - shorthand `x` → args=[Bits("x"), when_wildcard], bindings=["x"]
 *   - renamed `x: sub` → args=[Bits("x"), sub_pattern], bindings follow sub
 */
function collectFieldPatterns(tree: ParseTree, args: any[], bindings: string[]): void {
  if (tree.kind !== "branch") return;
  if (tree.tag === "field_pattern") {
    // A shorthand field_pattern wraps a single ident or a renamed form.
    // Look at children.
    const c = tree.children;
    // If children contain a field_pattern_renamed child (untagged, since the
    // Alt doesn't re-tag), find the renamed form.
    const renamedChild = c.find(ch => ch.kind === "branch" && ch.tag === "field_pattern_renamed");
    if (renamedChild && renamedChild.kind === "branch") {
      // field_pattern_renamed children: [ident, ws, ":", ws, pattern]
      const rc = renamedChild.children;
      const identTree = rc.find((ch: ParseTree) => ch.kind === "branch" && ch.tag === "ident");
      const patTree   = rc.slice().reverse().find((ch: ParseTree) => ch.kind === "branch" && ch.tag !== "ident" && ch.tag !== "ws");
      if (!identTree) throw new Error("field_pattern_renamed: missing ident");
      if (!patTree) throw new Error("field_pattern_renamed: missing sub-pattern");
      const name = textOf(identTree);
      const sub = buildPattern(patTree);
      args.push(stringToBits(name), sub.pattern);
      // Binding rules (match hybrid parser):
      //   - Nested destructuring: use nested bindings
      //   - Everything else: field name is the binding
      const isDestruct = sub.pattern.kind === "Expression" &&
        sub.pattern.fn?.kind === "PrimitiveFunction" &&
        (sub.pattern.fn.name === "when_struct_destruct" || sub.pattern.fn.name === "when_type_destruct");
      if (sub.bindingNames.length > 1 || isDestruct) {
        for (const b of sub.bindingNames) bindings.push(b);
      } else {
        bindings.push(name);
      }
      return;
    }
    // Shorthand: just an ident; binding = ident name, sub-pattern = wildcard
    const identTree = c.find(ch => ch.kind === "branch" && ch.tag === "ident");
    if (!identTree) throw new Error("field_pattern: missing ident");
    const name = textOf(identTree);
    args.push(stringToBits(name), makeExpr(prim("when_wildcard"), []));
    bindings.push(name);
    return;
  }
  for (const ch of tree.children) collectFieldPatterns(ch, args, bindings);
}

/**
 * Build a when-expression tree:
 *   when subject case1 case2 ... [else fallback]
 * Desugars to nested eval_when calls.
 *
 * The tree has considerable nesting from Seq + Rep + Opt wrappers. We
 * flatten it into a linear sequence of leaves/tagged-branches, then walk
 * that sequentially finding the subject, cases, and else branch.
 */
function buildWhenExpr(tree: ParseTree, paramMap: Map<string, any>): any {
  if (tree.kind !== "branch") throw new Error("buildWhenExpr: not a branch");

  // Flatten: collect all tagged branches and all meaningful leaves, in order.
  const items: Array<{ kind: "leaf"; text: string } | { kind: "tagged"; branch: ParseTree }> = [];
  const walk = (t: ParseTree): void => {
    if (t.kind === "leaf") {
      if (t.text === "when" || t.text === "else" || t.text === "and" || t.text === "is" || t.text === "then") {
        items.push({ kind: "leaf", text: t.text });
      }
      return;
    }
    if (t.kind !== "branch") return;
    if (t.tag === "ws" || t.tag === "ws_req" || t.tag === "ws_any") return;
    if (t.tag === "when_case" || (t.tag && EXPRESSION_TAGS.has(t.tag))) {
      items.push({ kind: "tagged", branch: t });
      return;
    }
    // Untagged wrapper — descend
    for (const c of t.children) walk(c);
  };
  for (const c of tree.children) walk(c);

  // Process: "when" <expr> <when_case>+ ["else" <expr>]
  let idx = 0;
  const next = () => items[idx++];
  const peek = () => items[idx];

  const first = next();
  if (!first || first.kind !== "leaf" || first.text !== "when") {
    throw new Error("when_expr: missing 'when' keyword");
  }
  const subjectItem = next();
  if (!subjectItem || subjectItem.kind !== "tagged" || subjectItem.branch.kind !== "branch" ||
      !subjectItem.branch.tag || !EXPRESSION_TAGS.has(subjectItem.branch.tag)) {
    throw new Error("when_expr: missing subject expression");
  }
  const subject = buildExpr(subjectItem.branch, paramMap);

  const cases: Array<{ pattern: any; guard: any; body: any; bindingNames: string[] }> = [];
  while (peek() && peek().kind === "tagged" && (peek() as any).branch.tag === "when_case") {
    const cItem = next() as any;
    cases.push(buildWhenCase(cItem.branch, paramMap));
  }

  if (cases.length === 0) throw new Error("when_expr: at least one case required");

  let elseBranch: any | null = null;
  if (peek() && peek().kind === "leaf" && (peek() as any).text === "else") {
    next(); // consume "else"
    const elseItem = next();
    if (!elseItem || elseItem.kind !== "tagged") {
      throw new Error("when_expr: missing else expression");
    }
    elseBranch = buildExpr(elseItem.branch, paramMap);
  }

  // Default else branch: when_no_match(subject)
  let result: any = elseBranch !== null
    ? elseBranch
    : makeExpr(prim("when_no_match"), [subject]);

  // Fold cases from last to first into nested eval_when expressions.
  for (let i = cases.length - 1; i >= 0; i--) {
    const cs = cases[i];
    const thenFn = cs.bindingNames.length > 0
      ? buildFn(cs.bindingNames, cs.body)
      : makeComposedFn([], cs.body);
    const elseFn = makeComposedFn([], result);
    result = makeExpr(prim("eval_when"), [subject, cs.pattern, cs.guard, thenFn, elseFn]);
  }
  return result;
}

function buildWhenCase(tree: ParseTree, paramMap: Map<string, any>): { pattern: any; guard: any; body: any; bindingNames: string[] } {
  if (tree.kind !== "branch") throw new Error("buildWhenCase: not a branch");

  // Flatten: collect leaves (is/and/then) and tagged branches (pattern_* + expr).
  type Item = { kind: "leaf"; text: string } | { kind: "tagged"; branch: ParseTree };
  const items: Item[] = [];
  const walk = (t: ParseTree): void => {
    if (t.kind === "leaf") {
      if (t.text === "is" || t.text === "and" || t.text === "then") {
        items.push({ kind: "leaf", text: t.text });
      }
      return;
    }
    if (t.kind !== "branch") return;
    if (t.tag === "ws" || t.tag === "ws_req" || t.tag === "ws_any") return;
    if (t.tag && (isPatternTag(t.tag) || EXPRESSION_TAGS.has(t.tag))) {
      items.push({ kind: "tagged", branch: t });
      return;
    }
    for (const c of t.children) walk(c);
  };
  for (const c of tree.children) walk(c);

  // Process: "is" <pattern> ["and" <guard_expr>] "then" <body_expr>
  let idx = 0;
  const next = () => items[idx++];
  const peek = () => items[idx];

  const firstTok = next();
  if (!firstTok || firstTok.kind !== "leaf" || firstTok.text !== "is") {
    throw new Error("when_case: missing 'is'");
  }
  const patItem = next();
  if (!patItem || patItem.kind !== "tagged" || patItem.branch.kind !== "branch" ||
      !isPatternTag(patItem.branch.tag)) {
    throw new Error("when_case: missing pattern");
  }
  const patResult = buildPattern(patItem.branch);
  const bindingNames = patResult.bindingNames;

  let guardTree: ParseTree | null = null;
  if (peek() && peek().kind === "leaf" && (peek() as any).text === "and") {
    next(); // consume "and"
    const gItem = next();
    if (!gItem || gItem.kind !== "tagged" || !EXPRESSION_TAGS.has((gItem as any).branch.tag)) {
      throw new Error("when_case: missing guard expression");
    }
    guardTree = (gItem as any).branch;
  }

  const thenTok = next();
  if (!thenTok || thenTok.kind !== "leaf" || thenTok.text !== "then") {
    throw new Error("when_case: missing 'then'");
  }
  const bodyItem = next();
  if (!bodyItem || bodyItem.kind !== "tagged" || !EXPRESSION_TAGS.has((bodyItem as any).branch.tag)) {
    throw new Error("when_case: missing body");
  }

  const body = buildExpr((bodyItem as any).branch, paramMap);
  let guard: any = makeInt(1);
  if (guardTree) {
    const guardExpr = buildExpr(guardTree, paramMap);
    guard = bindingNames.length > 0
      ? buildFn(bindingNames, guardExpr)
      : makeComposedFn([], guardExpr);
  }
  return { pattern: patResult.pattern, guard, body, bindingNames };
}

function isPatternTag(tag: string | undefined): boolean {
  return tag === "pattern_wildcard" || tag === "pattern_number" ||
    tag === "pattern_neg_number" || tag === "pattern_string" ||
    tag === "pattern_bool" || tag === "pattern_none" ||
    tag === "pattern_ident" || tag === "pattern_struct" ||
    tag === "pattern_typed";
}

// --- Block expressions (offside-rule blocks as values) ---

/**
 * Convert a block-expression parse tree into a Value. The block consists
 * of zero or more binding/fn_decl stmts followed by a final bare-expression
 * stmt. The value of the block is the final expression with each preceding
 * binding substituted in.
 *
 * Implementation: walk stmts in order, collecting bindings. The final bare
 * expression is the return value. Then fold bindings from last to first,
 * substituting each binding's name with its value in the rest.
 */
function buildBlockExpr(tree: ParseTree, paramMap: Map<string, any>): any {
  if (tree.kind !== "branch") throw new Error("buildBlockExpr: not a branch");

  // Collect stmts in order (by building each via buildStmt, passing our
  // outer paramMap so `n` inside the block resolves to the function's Param).
  const stmts: BuiltBinding[] = [];
  const walk = (t: ParseTree): void => {
    if (t.kind !== "branch") return;
    if (t.tag === "stmt" || t.tag === "binding" || t.tag === "fn_decl" ||
        t.tag === "import_stmt" || t.tag === "export_binding" || t.tag === "export_fn_decl" ||
        (t.tag && EXPRESSION_TAGS.has(t.tag))) {
      stmts.push(buildStmt(t, paramMap));
      return;
    }
    for (const c of t.children) walk(c);
  };
  for (const c of tree.children) walk(c);

  if (stmts.length === 0) {
    throw new Error("block_expr: empty block");
  }

  // Separate final bare expression (key=null) from bindings (key=<name>).
  // If the final stmt is a binding, use its value as the block's result
  // (matches hybrid parser's fallback behavior for blocks without a final
  // bare expression).
  const lastStmt = stmts[stmts.length - 1];
  let result: any;
  let bindings: BuiltBinding[];
  if (lastStmt.key === null) {
    // Last is a bare expression — its value IS the block's result.
    result = lastStmt.value;
    bindings = stmts.slice(0, -1).filter(s => s.key !== null);
  } else {
    // No final bare expr — use the last binding's value.
    result = lastStmt.value;
    bindings = stmts.filter(s => s.key !== null);
  }

  // Substitute each binding into all subsequent values and the result, from
  // first to last. (Matches the hybrid parser's `substName` approach.)
  for (let i = 0; i < bindings.length; i++) {
    const bname = bindings[i].key as string;
    const bval = bindings[i].value;
    // Propagate to later bindings
    for (let j = i + 1; j < bindings.length; j++) {
      bindings[j].value = substName(bindings[j].value, bname, bval);
    }
    // Propagate to the result
    result = substName(result, bname, bval);
  }
  return result;
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

const BUILTIN_EXPRESSION_TAGS = new Set([
  "or","and","eq","neq","lt","gt","lte","gte","add","sub","mul","div","mod",
  "neg","not","call","dot","bracket","paren","if","lambda1","lambda1_typed","lambdaN",
  "number","float","bool","none_lit","string","ident",
  "array_lit","object_lit",
  "instanceof","subtypeof","of","of_error","error_expr",
  "when_expr","block_expr","pipe",
]);

// Used like a Set but also matches user-op tags issued at runtime by
// grammar extension. All user-registered operators share the `user_op_`
// prefix.
const EXPRESSION_TAGS = {
  has(tag: string | undefined): boolean {
    if (!tag) return false;
    if (BUILTIN_EXPRESSION_TAGS.has(tag)) return true;
    return tag.startsWith("user_op_");
  },
} as const;

// --- Lambdas ---

/**
 * Collect typed parameters from a typed_param_list tree.
 * Returns an array of { name, typeExpr? } — typeExpr is the value built from
 * the type annotation, or undefined if the param has no annotation.
 */
interface TypedParam { name: string; typeExpr?: any; }

function collectTypedParams(tree: ParseTree, paramMap: Map<string, any>, out: TypedParam[]): void {
  if (tree.kind !== "branch") return;
  if (tree.tag === "typed_param") {
    // Children: [ident, opt_type_annotation]
    const identTree = tree.children.find(ch => ch.kind === "branch" && ch.tag === "ident");
    if (!identTree) throw new Error("typed_param: missing ident");
    const name = textOf(identTree);
    // The optional annotation is an untagged branch containing [ws, ":", ws, type_expr]
    // OR a 'none' if no annotation was given.
    let typeExpr: any | undefined = undefined;
    for (const ch of tree.children) {
      if (ch.kind === "branch" && !ch.tag) {
        // Unwrapped opt's content — look for a type_expr
        const typeTree = findTypeExpr(ch);
        if (typeTree) typeExpr = buildTypeExpr(typeTree, paramMap);
      }
    }
    out.push({ name, typeExpr });
    return;
  }
  for (const ch of tree.children) collectTypedParams(ch, paramMap, out);
}

/** Find the type_expr within an optional annotation block. */
function findTypeExpr(tree: ParseTree): ParseTree | null {
  if (tree.kind !== "branch") return null;
  // A type_expr is tagged as `type_union`, `type_generic`, `type_structural`,
  // or `ident`. Search recursively.
  if (tree.tag === "type_union" || tree.tag === "type_generic" ||
      tree.tag === "type_structural" || tree.tag === "ident") {
    return tree;
  }
  for (const ch of tree.children) {
    const f = findTypeExpr(ch);
    if (f) return f;
  }
  return null;
}

/**
 * Build a type expression from a parse tree. Supports:
 *   - ident                    → Symbol(name)
 *   - type_generic             → type_apply(Symbol(name), [args...])
 *   - type_union               → type_union(left, right)
 */
function buildTypeExpr(tree: ParseTree, paramMap: Map<string, any>): any {
  if (tree.kind !== "branch") throw new Error("buildTypeExpr: not a branch");
  if (tree.tag === "ident") {
    return makeSymbol(textOf(tree));
  }
  if (tree.tag === "type_generic") {
    // Children: [ident, "[", ws, rep-of-type_expr, ws, "]"]
    const identTree = tree.children.find(ch => ch.kind === "branch" && ch.tag === "ident");
    if (!identTree) throw new Error("type_generic: missing ident");
    const args: any[] = [];
    const walk = (t: ParseTree): void => {
      if (t.kind !== "branch") return;
      if (t === identTree) return;
      const inner = findTypeExpr(t);
      if (inner && inner !== identTree) {
        args.push(buildTypeExpr(inner, paramMap));
        return;
      }
      for (const c of t.children) walk(c);
    };
    // Skip the first child (the ident) and walk the rest for type args
    for (let i = 1; i < tree.children.length; i++) walk(tree.children[i]);
    return makeExpr(prim("type_apply"), [makeSymbol(textOf(identTree)), ...args]);
  }
  if (tree.tag === "type_union") {
    // Children: [type_expr_atom, ws, "|", ws, type_expr]
    const parts = tree.children.filter(ch =>
      ch.kind === "branch" && (ch.tag === "ident" || ch.tag === "type_generic" ||
        ch.tag === "type_union" || ch.tag === "type_structural")
    );
    if (parts.length < 2) throw new Error("type_union: expected 2 parts");
    return makeExpr(prim("type_union"),
      parts.map(p => buildTypeExpr(p, paramMap)));
  }
  if (tree.tag === "type_structural") {
    // Children: ["~", type_expr_atom]
    const inner = tree.children.find(ch =>
      ch.kind === "branch" && ch.tag && ch.tag !== "ws" && ch.tag !== "ws_any",
    );
    if (!inner) throw new Error("type_structural: missing inner type");
    return makeExpr(prim("structural_wrap"), [buildTypeExpr(inner, paramMap)]);
  }
  throw new Error(`buildTypeExpr: unknown tag '${tree.tag}'`);
}

/**
 * Wrap a built function with `typed_function` if any param or return type
 * annotation is present. Otherwise return as-is.
 */
function maybeTyped(fn: any, typedParams: TypedParam[], returnTypeExpr: any | undefined): any {
  const hasAnyType = returnTypeExpr !== undefined || typedParams.some(p => p.typeExpr !== undefined);
  if (!hasAnyType) return fn;
  // Wrap body with type_check(body, returnTypeExpr) if return type given
  if (returnTypeExpr !== undefined && fn.kind === "ComposedFunction") {
    fn.body = makeExpr(prim("type_check"), [fn.body, returnTypeExpr]);
  }
  const typeExprs = typedParams.map(p => p.typeExpr ?? makeSymbol("Any"));
  const retExpr = returnTypeExpr ?? makeSymbol("Any");
  return makeExpr(prim("typed_function"), [fn, makeInt(typedParams.length), ...typeExprs, retExpr]);
}

function buildLambda(tree: ParseTree, outerParamMap: Map<string, any>): any {
  if (tree.kind !== "branch") throw new Error("buildLambda: not a branch");
  const c = tree.children;

  // Extract typed params
  const typedParams: TypedParam[] = [];
  if (tree.tag === "lambda1") {
    // First child is the ident branch (untyped)
    const identTree = c.find(ch => ch.kind === "branch" && ch.tag === "ident");
    if (!identTree) throw new Error("lambda1: missing param ident");
    typedParams.push({ name: textOf(identTree) });
  } else if (tree.tag === "lambda1_typed") {
    // ident ws ":" ws type_expr ws "=>" ws expr
    const identTree = c.find(ch => ch.kind === "branch" && ch.tag === "ident");
    if (!identTree) throw new Error("lambda1_typed: missing ident");
    // Find the type_expr (the first type-expr-like branch AFTER the ident)
    let seen = false;
    let typeExpr: any | undefined = undefined;
    for (const ch of c) {
      if (ch === identTree) { seen = true; continue; }
      if (!seen) continue;
      if (ch.kind === "branch" && (ch.tag === "type_generic" || ch.tag === "type_union" || ch.tag === "ident")) {
        typeExpr = buildTypeExpr(ch, outerParamMap);
        break;
      }
    }
    typedParams.push({ name: textOf(identTree), typeExpr });
  } else {
    // lambdaN: typed_param_list branch holds them
    const paramListTree = c.find(ch => ch.kind === "branch" && ch.tag === "typed_param_list");
    if (paramListTree) {
      collectTypedParams(paramListTree, outerParamMap, typedParams);
    }
  }

  // Optional return type annotation for lambdaN: `)[: R] =>`
  let returnTypeExpr: any | undefined = undefined;
  if (tree.tag === "lambdaN") {
    let afterCloseParen = false;
    for (const ch of c) {
      if (ch.kind === "leaf" && ch.text === ")") { afterCloseParen = true; continue; }
      if (!afterCloseParen) continue;
      if (ch.kind === "leaf" && ch.text === "=>") break;
      if (ch.kind === "branch") {
        const typeTree = findTypeExpr(ch);
        if (typeTree) { returnTypeExpr = buildTypeExpr(typeTree, outerParamMap); break; }
      }
    }
  }

  // Build Params and extend paramMap
  const paramNames = typedParams.map(p => p.name);
  const params = paramNames.map((n, i) => makeParam(i, n));
  const innerMap = new Map(outerParamMap);
  for (let i = 0; i < paramNames.length; i++) innerMap.set(paramNames[i], params[i]);

  // Find the body: fn_body wrapper, or a direct expression-tagged branch.
  const bodyTree = findBodyExpr(c);
  if (!bodyTree) throw new Error("lambda: missing body");

  const body = buildExpr(bodyTree, innerMap);
  const fn = makeComposedFn(params, body);
  return maybeTyped(fn, typedParams, returnTypeExpr);
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

export function buildStmt(tree: ParseTree, outerParamMap: Map<string, any> = new Map()): BuiltBinding {
  tree = peelUntilTag(tree);
  if (tree.kind !== "branch") throw new Error("buildStmt: not a branch");

  // A "stmt" production wrapper may contain the inner tagged stmt.
  if (tree.tag === "stmt") {
    for (const c of tree.children) {
      if (c.kind === "branch" && c.tag) return buildStmt(c, outerParamMap);
    }
  }

  const tag = tree.tag;
  const c = tree.children;

  if (tag === "import_stmt") {
    // import NAME — produces a binding with value undefined. Module loader
    // provides the actual value via an extension.
    const identTree = c.find(ch => ch.kind === "branch" && ch.tag === "ident");
    if (!identTree) throw new Error("import_stmt: missing name");
    return { key: textOf(identTree), value: undefined as any };
  }

  if (tag === "export_binding") {
    // export NAME[: type] = expr — build binding, wrap with export primitive.
    const identTree = c.find(ch => ch.kind === "branch" && ch.tag === "ident");
    if (!identTree) throw new Error("export_binding: missing name");
    const name = textOf(identTree);
    // Find optional type annotation (between ident and "=")
    const identIdx = c.indexOf(identTree);
    const eqIdx = c.findIndex(ch => ch.kind === "leaf" && ch.text === "=");
    let typeExpr: any | undefined = undefined;
    if (identIdx >= 0 && eqIdx > identIdx) {
      const midChildren = c.slice(identIdx + 1, eqIdx);
      const typeTree = findTypeExpr({ kind: "branch", tag: undefined, children: midChildren, range: { start: 0, end: 0 } } as any);
      if (typeTree) typeExpr = buildTypeExpr(typeTree, new Map());
    }
    const bodyTree2 = findBodyExpr(c);
    if (!bodyTree2) throw new Error("export_binding: missing expr");
    let value = buildExpr(bodyTree2, new Map());
    if (typeExpr !== undefined) {
      value = makeExpr(prim("type_check_binding"), [value, typeExpr]);
    }
    value = makeExpr(prim("export"), [value]);
    return { key: name, value };
  }

  if (tag === "export_fn_decl") {
    // export NAME(params)[: ret] => body — build fn_decl, then wrap with export.
    const identTree = c.find(ch => ch.kind === "branch" && ch.tag === "ident");
    if (!identTree) throw new Error("export_fn_decl: missing function name");
    const fnName = textOf(identTree);

    const typedParams: TypedParam[] = [];
    const paramListTree = c.find(ch => ch.kind === "branch" && ch.tag === "typed_param_list");
    if (paramListTree) collectTypedParams(paramListTree, new Map(), typedParams);

    let returnTypeExpr: any | undefined = undefined;
    let afterCloseParen = false;
    for (const ch of c) {
      if (ch.kind === "leaf" && ch.text === ")") { afterCloseParen = true; continue; }
      if (!afterCloseParen) continue;
      if (ch.kind === "leaf" && ch.text === "=>") break;
      if (ch.kind === "branch") {
        const typeTree = findTypeExpr(ch);
        if (typeTree) { returnTypeExpr = buildTypeExpr(typeTree, new Map()); break; }
      }
    }

    const bodyTree = findBodyExpr(c);
    if (!bodyTree) throw new Error("export_fn_decl: missing body");

    const paramNames = typedParams.map(p => p.name);
    const params = paramNames.map((n, i) => makeParam(i, n));
    const innerMap = new Map<string, any>(outerParamMap);
    for (let i = 0; i < paramNames.length; i++) innerMap.set(paramNames[i], params[i]);
    const body = buildExpr(bodyTree, innerMap);
    const fn = makeComposedFn(params, body);
    const typed = maybeTyped(fn, typedParams, returnTypeExpr);
    const exported = makeExpr(prim("export"), [typed]);
    return { key: fnName, value: exported };
  }

  if (tag === "binding") {
    // ident [ws ":" ws type_expr] ws "=" ws expr
    const identTree = c.find(ch => ch.kind === "branch" && ch.tag === "ident");
    if (!identTree) throw new Error("binding: missing ident");
    const name = textOf(identTree);

    // Find optional type annotation (between ident and "=" leaf)
    const identIdx = c.indexOf(identTree);
    const eqIdx = c.findIndex(ch => ch.kind === "leaf" && ch.text === "=");
    let typeExpr: any | undefined = undefined;
    if (identIdx >= 0 && eqIdx > identIdx + 1) {
      const midChildren = c.slice(identIdx + 1, eqIdx);
      const typeTree = findTypeExpr({ kind: "branch", tag: undefined, children: midChildren, range: { start: 0, end: 0 } } as any);
      if (typeTree) typeExpr = buildTypeExpr(typeTree, new Map());
    }

    // Body: the fn_body wrapper, or an expression-tagged branch directly.
    let bodyTree: ParseTree | null = findBodyExpr(c);
    if (!bodyTree) throw new Error("binding: missing expr");
    let value = buildExpr(bodyTree, outerParamMap);
    if (typeExpr !== undefined) {
      value = makeExpr(prim("type_check_binding"), [value, typeExpr]);
    }
    return { key: name, value };
  }

  if (tag === "fn_decl") {
    // ident "(" ws typed_param_list ws ")" [ws ":" ws type_expr] ws "=>" ws expr
    const identTree = c.find(ch => ch.kind === "branch" && ch.tag === "ident");
    if (!identTree) throw new Error("fn_decl: missing function name");
    const fnName = textOf(identTree);

    // Collect typed params from typed_param_list
    const typedParams: TypedParam[] = [];
    const paramListTree = c.find(ch => ch.kind === "branch" && ch.tag === "typed_param_list");
    if (paramListTree) collectTypedParams(paramListTree, new Map(), typedParams);

    // Return type (optional): the first type_expr branch AFTER the ")" leaf
    let returnTypeExpr: any | undefined = undefined;
    let afterCloseParen = false;
    for (const ch of c) {
      if (ch.kind === "leaf" && ch.text === ")") { afterCloseParen = true; continue; }
      if (!afterCloseParen) continue;
      if (ch.kind === "leaf" && ch.text === "=>") break;
      if (ch.kind === "branch") {
        const typeTree = findTypeExpr(ch);
        if (typeTree) { returnTypeExpr = buildTypeExpr(typeTree, new Map()); break; }
      }
    }

    const bodyTree = findBodyExpr(c);
    if (!bodyTree) throw new Error("fn_decl: missing body");

    const paramNames = typedParams.map(p => p.name);
    const params = paramNames.map((n, i) => makeParam(i, n));
    const innerMap = new Map<string, any>(outerParamMap);
    for (let i = 0; i < paramNames.length; i++) innerMap.set(paramNames[i], params[i]);
    const body = buildExpr(bodyTree, innerMap);
    const fn = makeComposedFn(params, body);
    const value = maybeTyped(fn, typedParams, returnTypeExpr);
    return { key: fnName, value };
  }

  // Bare expression (the stmt's whole tree is an expression). Rebuild as expr.
  const value = buildExpr(tree, outerParamMap);
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
        t.tag === "import_stmt" || t.tag === "export_binding" || t.tag === "export_fn_decl" ||
        (t.tag && EXPRESSION_TAGS.has(t.tag))) {
      try {
        addStmt(buildStmt(t));
      } catch (e: any) {
        throw new Error(`Failed to build stmt: ${e.message}`);
      }
      return;
    }
    for (const c of t.children) walk(c);
  };
  walk(root);
  return ctx;
}
