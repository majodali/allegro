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
  makeComposedFn, makeStructure, prim, bind, buildFn, substName,
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
    // `&` — type/effect conjunction. The RHS is wrapped in a zero-arg thunk
    // so the primitive can extract its body as a refinement predicate.
    case "amp":  return makeExpr(prim("typed_amp"),  [buildExpr(c[0], paramMap), makeComposedFn([], buildExpr(lastChild(c), paramMap))]);
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
      // D47(e)/(f): `source of x` is the observe-tagged source read — a
      // dedicated primitive so the effect label is static; the generic
      // component accessor answers none for this key.
      if (name === "source") {
        return makeExpr(prim("source_get"), [target]);
      }
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
      // Children include the condition as a direct expr branch, then for
      // then/else a `fn_body` wrapper (inline expr or indented block).
      // Collect expression trees — either direct expr-tagged branches, or
      // descend through fn_body wrappers.
      const exprBranches: ParseTree[] = [];
      for (const ch of c) {
        if (ch.kind !== "branch") continue;
        if (ch.tag === "fn_body") {
          const inner = findBodyExpr([ch]);
          if (inner) exprBranches.push(inner);
        } else if (ch.tag && EXPRESSION_TAGS.has(ch.tag)) {
          exprBranches.push(ch);
        }
      }
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

    case "grammar_expr":
    case "grammar_expr_new":
    case "grammar_expr_extends":
      return buildGrammarExpr(tree, paramMap);

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
  // `register_postfix` / `register_expr_prefix` / Phase 6 `grammar { … }`).
  // The tag is a unique identifier issued by fragments.ts; look up the
  // user's substitution template and apply it to the operand AST(s).
  if (tag && tag.startsWith("user_op_")) {
    const userOp = getUserOp(tag);
    if (!userOp) throw new Error(`buildExpr: unknown user-op tag '${tag}'`);

    // Phase 6b multi-token forms and user rules: operand extraction is by
    // LABEL (from the EBNF `name:rule` bindings). The parse tree may tag
    // rep-kind labels as `label$rep` — when present, the operand is
    // collected as a typed_array regardless of how many items matched.
    if (userOp.kind === "exprForm" || userOp.kind === "stmtForm" || userOp.kind === "rule") {
      const labels = userOp.labels ?? [];
      const operands: any[] = [];
      for (const label of labels) {
        const { tree: labelTree, isRep } = findLabeledBranch(c, label);
        if (!labelTree) throw new Error(`user ${userOp.kind}: label '${label}' not found in parse tree`);
        operands.push(buildExprFromLabeled(labelTree, paramMap, isRep));
      }
      return substituteParams(userOp.fn as any, operands);
    }

    // Phase 1/6 operators: collect expression-tagged children positionally
    // (two for infix, one for prefix/postfix/expr_prefix).
    const operands: any[] = [];
    for (const ch of c) {
      if (ch.kind === "branch" && ch.tag && EXPRESSION_TAGS.has(ch.tag)) {
        operands.push(buildExpr(ch, paramMap));
      }
    }
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
  // fn_body wrappers get unwrapped to their inner block_expr / expression.
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
    if (t.tag === "fn_body") {
      const inner = findBodyExpr([t]);
      if (inner) items.push({ kind: "tagged", branch: inner });
      return;
    }
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

/** Recognise an Expression whose function is the named primitive — either
 *  already resolved (`PrimitiveFunction`, the typical case after hygienic
 *  template resolution) or still a Symbol (when the primitive was called
 *  directly by name in source, before resolveSymbols runs). The contract
 *  preprocessor needs both shapes since it runs at parse time. */
function isPrimitiveCall(value: any, primName: string): boolean {
  if (!value || typeof value !== "object") return false;
  if (value.kind !== "Expression") return false;
  // B-121 C4: a typed function used to arrive wrapped (e.g. when a stmt_form's
  // template was evaluated in a lib module's typed env) and had to be peeled.
  // It carries its type directly now, so the kind tests below see it as it is.
  const fn = value.fn;
  if (!fn) return false;
  if (fn.kind === "PrimitiveFunction" && fn.name === primName) return true;
  if (fn.kind === "Symbol" && fn.name === primName) return true;
  return false;
}

/**
 * Convert a block-expression parse tree into a Value. The block consists
 * of zero or more binding/fn_decl stmts followed by a final bare-expression
 * stmt. The value of the block is the final expression with each preceding
 * binding substituted in.
 *
 * Implementation: walk stmts in order, collecting bindings. Non-last bare
 * expressions are sequenced via the `seq` primitive so their side effects
 * (assertions, prints, contract checks) fire in source order. The final
 * bare expression is the return value. Bindings from first to last
 * substitute their values into all subsequent stmts and the result.
 *
 * Phase C Chunk 3: contract preprocessing. `requires_stmt(P)` markers are
 * hoisted to the front (so preconditions check before any body statement
 * runs); `ensures_decl(P)` markers are extracted, their predicate is
 * compiled into a one-param lambda over `_`, and the block's result is
 * wrapped with `ensures_check(result, lambda)` so the post-condition
 * checks at function exit with `_` bound to the value.
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

  // Phase C Chunk 3 + Phase D1: extract contract / effect markers from
  // bare-expression stmts.
  //   requires_stmt(P)            → hoisted to function-entry checks
  //   ensures_decl(P)             → predicate compiled to `(_) => P` lambda
  //   effects_decl_marker(labels) → declared effect set wraps the result
  // Bindings and ordinary bare expressions stay in `filteredStmts`. Order
  // among non-contract stmts is preserved.
  const requiresStmts: any[] = [];
  const ensuresLambdas: any[] = [];
  const declaredEffects: any[] = [];   // typed_array Expression of Symbol(label)
  const paramEffects: Array<{ paramRef: any; effSym: any }> = [];
  let partialMarked = false;
  let decreasesMetric: any | null = null;
  let totalMarked = false;                // B-028 F3 — `total`
  let assumeTerminatesMarked = false;     // B-028 F3 — `assume terminates`
  const provenPredicates: any[] = []; // F7 — accumulated across multiple `proven` clauses
  const filteredStmts: BuiltBinding[] = [];
  for (const s of stmts) {
    if (s.key === null && isPrimitiveCall(s.value, "requires_stmt")) {
      requiresStmts.push(s.value);
      continue;
    }
    if (s.key === null && isPrimitiveCall(s.value, "ensures_decl")) {
      // Extract the predicate expression (P) and lift it into a one-param
      // lambda `(_) => P`. buildFn walks the body and converts Symbol("_")
      // into a Param so the runtime check binds `_` to the result value.
      const predExpr = s.value.args[0];
      const lambda = buildFn(["_"], predExpr);
      ensuresLambdas.push(lambda);
      continue;
    }
    if (s.key === null && isPrimitiveCall(s.value, "effects_decl_marker")) {
      // Single arg: a typed_array of Symbol(label) values produced by the
      // grammar's `labels:ident ** ","` repetition. Keep it as-is; the
      // wrapper code below collects all declarations into one labels array.
      const labelsArg = s.value.args[0];
      declaredEffects.push(labelsArg);
      continue;
    }
    if (s.key === null && isPrimitiveCall(s.value, "param_effects_decl_marker")) {
      // Stage D — Surface C `param_effects name: eff`. Args: [paramRef,
      // effSym]. The paramRef is already a Param value (the lambda's
      // paramMap converted the matched ident at template substitution).
      const margs = s.value.args as any[];
      if (margs.length >= 2) {
        paramEffects.push({ paramRef: margs[0], effSym: margs[1] });
      }
      continue;
    }
    if (s.key === null && isPrimitiveCall(s.value, "partial_decl_marker")) {
      // Phase E Stage 0 — `partial` opt-out. No args; presence alone is
      // the signal. Multiple `partial` clauses in one body are idempotent
      // (the wrapper is attached at most once).
      partialMarked = true;
      continue;
    }
    if (s.key === null && isPrimitiveCall(s.value, "decreases_decl_marker")) {
      // Phase E Stage 3 — user-supplied termination metric. The arg is the
      // metric expression. Last writer wins if multiple clauses appear.
      const margs = s.value.args as any[];
      if (margs.length >= 1) decreasesMetric = margs[0];
      continue;
    }
    if (s.key === null && isPrimitiveCall(s.value, "total_decl_marker")) {
      // B-028 F3 — per-function strict opt-in. Presence is the signal.
      totalMarked = true;
      continue;
    }
    if (s.key === null && isPrimitiveCall(s.value, "assume_terminates_decl_marker")) {
      // B-028 F3 — the admitted liveness axiom. Presence is the signal.
      assumeTerminatesMarked = true;
      continue;
    }
    if (s.key === null && isPrimitiveCall(s.value, "proven_decl_marker")) {
      // Phase F7 — `proven <prop>`. The arg is the predicate expression
      // (which references the function's Params in scope). Multiple
      // `proven` clauses accumulate as independent theorems to check.
      const margs = s.value.args as any[];
      if (margs.length >= 1) provenPredicates.push(margs[0]);
      continue;
    }
    filteredStmts.push(s);
  }

  if (filteredStmts.length === 0) {
    // Block consisted entirely of contract markers — degenerate but legal.
    // Return noneSingleton-equivalent: a Symbol that resolves to none.
    // (Practically never hit; bodies always have a result expression.)
    return makeSymbol("none");
  }

  // Separate final bare expression (key=null) from bindings (key=<name>).
  // If the final stmt is a binding, use its value as the block's result
  // (matches hybrid parser's fallback behavior for blocks without a final
  // bare expression).
  const lastStmt = filteredStmts[filteredStmts.length - 1];
  let result: any;
  let bindings: BuiltBinding[];
  let bareEarly: BuiltBinding[];
  if (lastStmt.key === null) {
    // Last is a bare expression — its value IS the block's result.
    result = lastStmt.value;
    const earlyStmts = filteredStmts.slice(0, -1);
    bindings  = earlyStmts.filter(s => s.key !== null);
    bareEarly = earlyStmts.filter(s => s.key === null);
  } else {
    // No final bare expr — use the last binding's value.
    result = lastStmt.value;
    bindings  = filteredStmts.filter(s => s.key !== null);
    bareEarly = filteredStmts.filter((s, i) => s.key === null && i !== filteredStmts.length - 1);
  }

  // Substitute each binding into all subsequent values, bare expressions,
  // and the result, from first to last. (Matches the hybrid parser's
  // `substName` approach.)
  for (let i = 0; i < bindings.length; i++) {
    const bname = bindings[i].key as string;
    const bval = bindings[i].value;
    for (let j = i + 1; j < bindings.length; j++) {
      bindings[j].value = substName(bindings[j].value, bname, bval);
    }
    for (let k = 0; k < bareEarly.length; k++) {
      bareEarly[k].value = substName(bareEarly[k].value, bname, bval);
    }
    // Propagate into requires too (they reference function params, which
    // bindings might shadow — though typical usage doesn't shadow params).
    for (let r = 0; r < requiresStmts.length; r++) {
      requiresStmts[r] = substName(requiresStmts[r], bname, bval);
    }
    // Propagate into ensures lambdas' bodies.
    for (let e = 0; e < ensuresLambdas.length; e++) {
      ensuresLambdas[e] = substName(ensuresLambdas[e], bname, bval);
    }
    result = substName(result, bname, bval);
  }

  // Wrap the result with ensures checks. Each `ensures_check(result, lambda)`
  // runs the lambda against the result; on success the result is returned
  // with the post-condition's domain attached to its predicate set.
  for (const lambda of ensuresLambdas) {
    result = makeExpr(prim("ensures_check"), [result, lambda]);
  }

  // Sequence: requires checks first, then ordinary bare expressions in
  // source order, then the (possibly-ensures-wrapped) result. `seq` is an
  // eager primitive that evaluates each arg in order and returns the last,
  // so side effects of earlier args (assertions, prints) fire before the
  // result is computed.
  const seqArgs: any[] = [];
  for (const r of requiresStmts) seqArgs.push(r);
  for (const b of bareEarly) seqArgs.push(b.value);
  if (seqArgs.length > 0) {
    seqArgs.push(result);
    result = makeExpr(prim("seq"), seqArgs);
  }

  // Phase D1: if the block declared effect labels, wrap the (now-sequenced)
  // result with `effects_attach(result, labels)`. The wrapper is a runtime
  // passthrough; the inference walker / introspection peel it to recover
  // the declared label set and check it against the inferred set.
  if (declaredEffects.length > 0) {
    // Merge the per-clause typed_array Expressions into one. Each is
    // `typed_array(Symbol(L1), Symbol(L2), …)`; we union their args.
    const mergedSymbols: any[] = [];
    const seenLabels = new Set<string>();
    for (const labelArr of declaredEffects) {
      const arr = labelArr;
      if (!arr || arr.kind !== "Expression") continue;
      for (const sym of arr.args) {
        // sym is a Symbol value (or, defensively, anything else — skip).
        if (sym && sym.kind === "Symbol") {
          if (seenLabels.has(sym.name)) continue;
          seenLabels.add(sym.name);
          mergedSymbols.push(sym);
        }
      }
    }
    const labelsAst = makeExpr(prim("typed_array"), mergedSymbols);
    result = makeExpr(prim("effects_attach"), [result, labelsAst]);
  }

  // Stage D — wrap with `param_effects_attach(result, paramRef1, effSym1, …)`
  // so `typed_function_impl` can peel and stamp `Param.effectBound` from the
  // metadata. Lazy passthrough at runtime, identical Param-bound shape to
  // Surface A (`f: pure` in the param-type slot).
  if (paramEffects.length > 0) {
    const flatArgs: any[] = [result];
    for (const pe of paramEffects) {
      flatArgs.push(pe.paramRef, pe.effSym);
    }
    result = makeExpr(prim("param_effects_attach"), flatArgs);
  }

  // Phase E Stage 0 — wrap with `partial_attach(result)` if a `partial`
  // clause appeared anywhere in the body. Runtime passthrough; the totality
  // analyzer (Stage 1+) peels it to skip exhaustiveness / termination
  // checks for opted-out functions.
  if (partialMarked) {
    result = makeExpr(prim("partial_attach"), [result]);
  }

  // Phase E Stage 3 — wrap with `decreases_attach(result, metric)` when a
  // `decreases <expr>` clause appeared. Runtime passthrough; the analyzer
  // peels it via `unwrapDecreasesAttach` to verify (or trust) the metric.
  if (decreasesMetric !== null) {
    result = makeExpr(prim("decreases_attach"), [result, decreasesMetric]);
  }

  // B-028 F3 — the completion-discharge wrappers. Runtime passthroughs;
  // `collapseBodyMetadata` stashes `total` / `assumeTerminates` for
  // the divergence analysis.
  if (totalMarked) {
    result = makeExpr(prim("total_attach"), [result]);
  }
  if (assumeTerminatesMarked) {
    result = makeExpr(prim("assume_terminates_attach"), [result]);
  }

  // Phase F7 — wrap with `proven_attach(result, pred1, ...)` when one or
  // more `proven <prop>` clauses appeared. Runtime passthrough; the
  // analyzer (`checkProvenClauses`) peels it and samples the function.
  if (provenPredicates.length > 0) {
    result = makeExpr(prim("proven_attach"), [result, ...provenPredicates]);
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
  "or","and","amp","eq","neq","lt","gt","lte","gte","add","sub","mul","div","mod",
  "neg","not","call","dot","bracket","paren","if","lambda1","lambda1_typed","lambdaN",
  "number","float","bool","none_lit","string","ident",
  "array_lit","object_lit",
  "instanceof","subtypeof","of","of_error","error_expr",
  "when_expr","block_expr","pipe",
  "grammar_expr",           // Phase 6 — `grammar { … }` block (default base)
  "grammar_expr_new",       // Phase 7 — `new grammar { … }` (base = empty)
  "grammar_expr_extends",   // Phase 7 — `grammar extends X { … }` (explicit base)
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

/** Generic parameter declared in `name[T, e: Effect](…)`. The `kind` is the
 *  raw type-expression value of the annotation (`Type`, `Effect`, …) or
 *  `undefined` when the user wrote bare `T`. Stage C2 will dispatch on kind
 *  to drive effect-variable unification distinctly from type-variable
 *  unification. */
interface GenericParam { name: string; kind?: any; }

function collectGenericParams(tree: ParseTree): GenericParam[] {
  const out: GenericParam[] = [];
  walk(tree);
  return out;

  function walk(t: ParseTree): void {
    if (t.kind !== "branch") return;
    if (t.tag === "generic_param") {
      const identTree = t.children.find(ch => ch.kind === "branch" && ch.tag === "ident");
      if (!identTree) throw new Error("generic_param: missing ident");
      const name = textOf(identTree);
      let kind: any | undefined = undefined;
      for (const ch of t.children) {
        if (ch.kind === "branch" && !ch.tag) {
          const typeTree = findTypeExpr(ch);
          if (typeTree) kind = buildTypeExpr(typeTree, new Map());
        }
      }
      out.push({ name, kind });
      return;
    }
    for (const ch of t.children) walk(ch);
  }
}

/** Find the type_expr within an optional annotation block. */
function findTypeExpr(tree: ParseTree): ParseTree | null {
  if (tree.kind !== "branch") return null;
  // A type_expr is tagged as `type_generic`, `type_structural`,
  // `type_function` (Stage E), or `ident`. Search recursively.
  if (tree.tag === "type_generic" ||
      tree.tag === "type_structural" || tree.tag === "type_function" ||
      tree.tag === "ident") {
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
 *   - type_function            → type_function(paramType1, …, paramTypeN, returnType)
 */
function buildTypeExpr(tree: ParseTree, paramMap: Map<string, any>): any {
  if (tree.kind !== "branch") throw new Error("buildTypeExpr: not a branch");
  if (tree.tag === "ident") {
    return makeSymbol(textOf(tree));
  }
  if (tree.tag === "type_function") {
    // Children: ["(", ws_any, opt(rep(type_expr, sep=",")), ws_any, ")",
    //           ws, "=>", ws, type_expr]. Walk children in order; collect
    //           type_exprs found before the `=>` literal as paramTypes, the
    //           one after as returnType. Lower to a `type_function` primitive
    //           call: paramType1, …, paramTypeN, returnType (return last).
    const paramTypes: any[] = [];
    let returnType: any | undefined = undefined;
    let sawArrow = false;
    const walkChild = (t: ParseTree): void => {
      if (t.kind === "leaf" && t.text === "=>") { sawArrow = true; return; }
      if (t.kind !== "branch") return;
      const inner = findTypeExpr(t);
      if (inner) {
        if (sawArrow) {
          if (returnType === undefined) returnType = buildTypeExpr(inner, paramMap);
        } else {
          paramTypes.push(buildTypeExpr(inner, paramMap));
        }
        return;
      }
      for (const c of t.children) walkChild(c);
    };
    for (const ch of tree.children) walkChild(ch);
    if (returnType === undefined) {
      throw new Error("type_function: missing return type");
    }
    return makeExpr(prim("type_function"), [...paramTypes, returnType]);
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
      if (ch.kind === "branch" && (ch.tag === "type_generic"
          || ch.tag === "type_structural" || ch.tag === "type_function"
          || ch.tag === "ident")) {
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
  /** B-097 V1: `export NAME = …` / `export NAME(…) => …` mark the
   *  BINDING (Binding.visibility), not the value — no export wrapper
   *  rides the RHS any more. */
  exported?: true;
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

  if (tag === "theorem_decl") {
    // theorem NAME: <prop> [by <proofterm>]. Without `by` the proof is
    // discharged by evaluation (F1: `proof_by_eval`). With `by`, the proof
    // term is checked against the proposition (F3: `proof_check`). The
    // proposition's source text is captured via `textOf` (label only,
    // never re-parsed) for counterexample / export rendering.
    const identTree = c.find(ch => ch.kind === "branch" && ch.tag === "ident");
    if (!identTree) throw new Error("theorem_decl: missing name");
    const name = textOf(identTree);
    // Structure: `theorem` ws IDENT ws ':' ws PROP [ ws 'by' ws PROOF ].
    // `ident` is itself in EXPRESSION_TAGS, so we can't just grab the first
    // expr-tagged child — key off the `:` delimiter, and split the proof
    // term off at the `by` leaf (which lives inside the opt-clause branch).
    const colonIdx = c.findIndex(ch => ch.kind === "leaf" && ch.text === ":");
    if (colonIdx < 0) throw new Error("theorem_decl: missing ':'");
    let propTree: ParseTree | null = null;
    let byClause: ParseTree | null = null;
    for (let i = colonIdx + 1; i < c.length; i++) {
      const ch = c[i];
      if (ch.kind !== "branch") continue;
      // The opt `by` clause is the branch whose source text starts with
      // `by` (after trimming) — its inner expression is the proof term.
      if (!propTree && ch.tag && EXPRESSION_TAGS.has(ch.tag)) {
        propTree = ch;
        continue;
      }
      if (propTree && textOf(ch).trimStart().startsWith("by")) {
        byClause = ch;
        break;
      }
    }
    if (!propTree) throw new Error("theorem_decl: missing proposition");
    const propSrc = textOf(propTree).trim();
    const proofTree: ParseTree | null = byClause ? findInner(byClause) : null;
    let value: any;
    if (proofTree) {
      // F3: check the proof term against the proposition. `proof_check` is
      // lazy on the proposition (needs the AST to detect equality shape)
      // and evaluates the proof term itself.
      value = makeExpr(prim("proof_check"), [
        stringToBits(propSrc),
        buildExpr(propTree, outerParamMap),
        buildExpr(proofTree, outerParamMap),
      ]);
    } else {
      // F1: discharge by evaluation.
      value = makeExpr(prim("proof_by_eval"),
        [stringToBits(propSrc), buildExpr(propTree, outerParamMap)]);
    }
    return { key: name, value };
  }

  if (tag === "verify_stmt") {
    // verify <prop>  — Phase F1. Anonymous one-shot proof by evaluation.
    // Bare expression: the proof Value is produced and discarded; its only
    // purpose is the compile-time discharge check (`checkProofs`).
    const propTree = [...c].reverse().find(
      ch => ch.kind === "branch" && ch.tag && EXPRESSION_TAGS.has(ch.tag),
    );
    if (!propTree) throw new Error("verify_stmt: missing proposition");
    const propSrc = textOf(propTree).trim();
    const value = makeExpr(prim("proof_by_eval"),
      [stringToBits(propSrc), buildExpr(propTree, outerParamMap)]);
    return { key: null, value };
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
    return { key: name, value, exported: true };
  }

  if (tag === "export_fn_decl") {
    // export NAME[generic_decl](params)[: ret] => body
    const identTree = c.find(ch => ch.kind === "branch" && ch.tag === "ident");
    if (!identTree) throw new Error("export_fn_decl: missing function name");
    const fnName = textOf(identTree);

    const genericTree = c.find(ch => ch.kind === "branch" && ch.tag === "generic_decl");
    const genericParams = genericTree ? collectGenericParams(genericTree) : [];

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
    if (genericParams.length > 0) {
      (fn as any).genericParams = genericParams;
    }
    const typed = maybeTyped(fn, typedParams, returnTypeExpr);
    return { key: fnName, value: typed, exported: true };
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
    // ident [generic_decl] "(" ws typed_param_list ws ")" [ws ":" ws type_expr] ws "=>" ws expr
    const identTree = c.find(ch => ch.kind === "branch" && ch.tag === "ident");
    if (!identTree) throw new Error("fn_decl: missing function name");
    const fnName = textOf(identTree);

    // Stage C1: optional generic param list `[T, e: Effect, …]` between the
    // function name and `(`. For now we just collect the names so they
    // resolve as type variables in subsequent type-expression parses; kind
    // annotations are captured for later validation but not yet dispatched
    // on (Stage C2 will do effect-variable unification).
    const genericTree = c.find(ch => ch.kind === "branch" && ch.tag === "generic_decl");
    const genericParams = genericTree ? collectGenericParams(genericTree) : [];

    // Collect typed params from typed_param_list. The inner paramMap below
    // will resolve generic-param names to fresh Symbols so they're treated
    // as type variables (matches the existing auto-promotion path).
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
    // Stash generic-param metadata on the ComposedFunction (the identity
    // survives `typed_function` wrapping at runtime). Stage C2 will consume
    // this for effect-variable unification; inert in Stage C1.
    if (genericParams.length > 0) {
      (fn as any).genericParams = genericParams;
    }
    const value = maybeTyped(fn, typedParams, returnTypeExpr);
    return { key: fnName, value };
  }

  // Bare expression (the stmt's whole tree is an expression). Rebuild as expr.
  const value = buildExpr(tree, outerParamMap);
  return { key: null, value };
}

// --- Top-level: program → fileCtx ---

// --- Phase 6: grammar { … } block ---
//
// A grammar block compiles to a chain of fragment-builder primitive calls:
//
//   grammar_fragment_finalize(
//     grammar_infix_add(
//       grammar_prefix_add(
//         grammar_fragment_new("allegro"),
//         "neg", prec_spec, body
//       ),
//       "**", prec_spec, assoc, body
//     )
//   )
//
// Each `grammar_*_add` primitive takes the handle, mutates it, and returns
// it so calls can be chained. `grammar_fragment_finalize` returns the
// resulting Grammar value. Step 3 only produces the expression shape; the
// primitive implementations (step 4) and merger (step 5+) fill in behaviour.

function buildGrammarExpr(tree: ParseTree, paramMap: Map<string, any>): any {
  if (tree.kind !== "branch") throw new Error(`buildGrammarExpr: not a branch`);
  const tag = tree.tag;
  if (tag !== "grammar_expr" && tag !== "grammar_expr_new" && tag !== "grammar_expr_extends") {
    throw new Error(`buildGrammarExpr: unexpected tag '${tag}'`);
  }

  // Collect all decl branches (rep + ws may wrap them).
  const decls: ParseTree[] = [];
  const walk = (t: ParseTree): void => {
    if (t.kind !== "branch") return;
    if (t.tag === "infix_decl"        || t.tag === "prefix_decl" ||
        t.tag === "postfix_decl"      || t.tag === "expr_prefix_decl" ||
        t.tag === "rule_decl"         || t.tag === "expr_form_decl" ||
        t.tag === "stmt_form_decl"    ||
        t.tag === "rule_replace_alt"  || t.tag === "rule_remove") {
      decls.push(t);
      return;
    }
    for (const c of t.children) walk(c);
  };
  for (const c of tree.children) walk(c);

  // Base selection:
  //   grammar { … }                 → grammar_fragment_new("allegro")
  //   new grammar { … }             → grammar_fragment_new("empty")
  //   grammar extends X { … }       → grammar_fragment_new_from(X)
  //                                   (X evaluates at parse-eval time to a
  //                                    Grammar value whose baseChain seeds the
  //                                    new fragment's chain)
  let expr: any;
  if (tag === "grammar_expr_new") {
    expr = makeExpr(prim("grammar_fragment_new"), [stringToBits("empty")]);
  } else if (tag === "grammar_expr_extends") {
    // Find the ident child that names the base grammar.
    const identTree = findTaggedBranch(tree.children, "ident");
    if (!identTree) throw new Error("grammar extends: missing ident");
    const baseSym = makeSymbol(textOf(identTree));
    expr = makeExpr(prim("grammar_fragment_new_from"), [baseSym]);
  } else {
    expr = makeExpr(prim("grammar_fragment_new"), [stringToBits("allegro")]);
  }
  for (const decl of decls) {
    expr = buildDeclAsCall(decl, expr, paramMap);
  }
  return makeExpr(prim("grammar_fragment_finalize"), [expr]);
}

function buildDeclAsCall(decl: ParseTree, fragExpr: any, paramMap: Map<string, any>): any {
  if (decl.kind !== "branch") throw new Error("buildDeclAsCall: not a branch");
  const c = decl.children;

  // Phase 6b decls have a different shape (ident name, ebnf body). Dispatch first.
  switch (decl.tag) {
    case "rule_decl":         return buildRuleDecl(decl, fragExpr, paramMap);
    case "rule_replace_alt":  return buildRuleReplaceAlt(decl, fragExpr, paramMap);
    case "rule_remove":       return buildRuleRemove(decl, fragExpr);
    case "expr_form_decl":    return buildFormDecl(decl, fragExpr, paramMap, "grammar_expr_form_add");
    case "stmt_form_decl":    return buildFormDecl(decl, fragExpr, paramMap, "grammar_stmt_form_add");
  }

  // Phase 6 (and back-compat Phase 1) decls: op string + optional prec_spec.
  const stringTree = findTaggedBranch(c, "string");
  const precTree   = findTaggedBranch(c, "prec_spec");
  const assocTree  = findTaggedBranch(c, "assoc");
  let bodyTree: ParseTree | null = null;
  for (let i = c.length - 1; i >= 0; i--) {
    const ch = c[i];
    if (ch.kind === "branch") {
      if (ch.tag && EXPRESSION_TAGS.has(ch.tag)) { bodyTree = ch; break; }
      const sub = findLastExprBranch(ch.children);
      if (sub) { bodyTree = sub; break; }
    }
  }
  if (!stringTree || !bodyTree) {
    throw new Error(`${decl.tag}: missing required parts (string=${!!stringTree}, body=${!!bodyTree})`);
  }

  const opBits = stringToBits(simpleStringText(stringTree));
  const body   = buildExpr(bodyTree, paramMap);

  switch (decl.tag) {
    case "infix_decl": {
      if (!precTree) throw new Error("infix_decl: missing prec_spec");
      const precSpec = buildPrecSpec(precTree);
      const assoc    = assocTree ? textOf(assocTree) : "left";
      return makeExpr(prim("grammar_infix_add"),
        [fragExpr, opBits, precSpec, stringToBits(assoc), body]);
    }
    case "prefix_decl": {
      if (!precTree) throw new Error("prefix_decl: missing prec_spec");
      const precSpec = buildPrecSpec(precTree);
      return makeExpr(prim("grammar_prefix_add"), [fragExpr, opBits, precSpec, body]);
    }
    case "postfix_decl": {
      if (!precTree) throw new Error("postfix_decl: missing prec_spec");
      const precSpec = buildPrecSpec(precTree);
      return makeExpr(prim("grammar_postfix_add"), [fragExpr, opBits, precSpec, body]);
    }
    case "expr_prefix_decl":
      return makeExpr(prim("grammar_expr_prefix_add"), [fragExpr, opBits, body]);
  }
  throw new Error(`buildDeclAsCall: unknown decl tag ${decl.tag}`);
}

/**
 * Build a `rule_decl` call. Shape:
 *   rule NAME = body => template        // add / replace production
 *   rule NAME += body => template       // append alternative
 *
 * Lowers to:
 *   grammar_rule_add(handle, "NAME", "add"|"append", ebnfObject, templateFn)
 */
function buildRuleDecl(decl: ParseTree, fragExpr: any, paramMap: Map<string, any>): any {
  if (decl.kind !== "branch") throw new Error("buildRuleDecl: not a branch");
  const c = decl.children;
  const nameTree = findTaggedBranch(c, "ident");
  if (!nameTree) throw new Error("rule_decl: missing rule name");
  const name = textOf(nameTree);

  // Tag indicates add vs append — the inner alt wrapper.
  const opTagTree = findTaggedBranch(c, "rule_append") ?? findTaggedBranch(c, "rule_replace_or_add");
  const opName    = opTagTree?.kind === "branch" && opTagTree.tag === "rule_append" ? "append" : "add";

  const ebnfTree = findTaggedBranch(c, "ebnf_body");
  if (!ebnfTree) throw new Error("rule_decl: missing ebnf_body");
  const ebnfObj = buildEbnf(ebnfTree);

  // Template lambda follows `=> …`. Last expression-tagged descendant.
  const templateTree = findLastExprBranch(c);
  if (!templateTree) throw new Error("rule_decl: missing template");
  const template = buildExpr(templateTree, paramMap);

  return makeExpr(prim("grammar_rule_add"),
    [fragExpr, stringToBits(name), stringToBits(opName), ebnfObj, template]);
}

/**
 * Build a `rule NAME[ALT] = body => template` declaration — replaces a
 * specific alternative in the named production.
 */
function buildRuleReplaceAlt(decl: ParseTree, fragExpr: any, paramMap: Map<string, any>): any {
  if (decl.kind !== "branch") throw new Error("buildRuleReplaceAlt: not a branch");
  // Children include two ident branches: the rule name and the selector.
  // They appear in order — name first, selector second.
  const idents: ParseTree[] = [];
  const walk = (t: ParseTree): void => {
    if (t.kind !== "branch") return;
    if (t.tag === "ident") { idents.push(t); return; }
    for (const c of t.children) walk(c);
  };
  for (const c of decl.children) walk(c);
  if (idents.length < 2) throw new Error("rule_replace_alt: expected name and selector idents");
  const ruleName = textOf(idents[0]);
  const selector = textOf(idents[1]);

  const ebnfTree = findTaggedBranch(decl.children, "ebnf_body");
  if (!ebnfTree) throw new Error("rule_replace_alt: missing ebnf_body");
  const ebnfObj = buildEbnf(ebnfTree);

  const templateTree = findLastExprBranch(decl.children);
  if (!templateTree) throw new Error("rule_replace_alt: missing template");
  const template = buildExpr(templateTree, paramMap);

  return makeExpr(prim("grammar_rule_replace_alt"),
    [fragExpr, stringToBits(ruleName), stringToBits(selector), ebnfObj, template]);
}

/**
 * Build a `rule NAME -= ALT` declaration — removes a specific alternative
 * from the named production. No template.
 */
function buildRuleRemove(decl: ParseTree, fragExpr: any): any {
  if (decl.kind !== "branch") throw new Error("buildRuleRemove: not a branch");
  const idents: ParseTree[] = [];
  const walk = (t: ParseTree): void => {
    if (t.kind !== "branch") return;
    if (t.tag === "ident") { idents.push(t); return; }
    for (const c of t.children) walk(c);
  };
  for (const c of decl.children) walk(c);
  if (idents.length < 2) throw new Error("rule_remove: expected name and selector idents");
  const ruleName = textOf(idents[0]);
  const selector = textOf(idents[1]);
  return makeExpr(prim("grammar_rule_remove"),
    [fragExpr, stringToBits(ruleName), stringToBits(selector)]);
}

/**
 * Build an `expr_form_decl` or `stmt_form_decl` call. Both have the same
 * shape: a multi-token EBNF body (typically a seq of labeled parts) and a
 * template lambda.
 */
function buildFormDecl(
  decl:     ParseTree,
  fragExpr: any,
  paramMap: Map<string, any>,
  primName: "grammar_expr_form_add" | "grammar_stmt_form_add",
): any {
  if (decl.kind !== "branch") throw new Error(`buildFormDecl: not a branch`);
  const c = decl.children;
  const ebnfTree = findTaggedBranch(c, "ebnf_body");
  if (!ebnfTree) throw new Error(`${decl.tag}: missing ebnf_body`);
  const ebnfObj = buildEbnf(ebnfTree);

  const templateTree = findLastExprBranch(c);
  if (!templateTree) throw new Error(`${decl.tag}: missing template`);
  const template = buildExpr(templateTree, paramMap);

  return makeExpr(prim(primName), [fragExpr, ebnfObj, template]);
}

// --- EBNF → Rule Object conversion ---
//
// Each EBNF construct lowers to a typed Object whose `kind` field steers
// the fragment primitive when parsing it into a grammar2 Rule value.
//
//   {kind:"lit",     text:"match"}
//   {kind:"regex",   pattern:"[a-z]+"}
//   {kind:"nonterm", name:"expr"}
//   {kind:"seq",     items:[r, r, …]}
//   {kind:"alt",     options:[r, r, …]}
//   {kind:"rep",     item:r, min:0|1, sep:r|none}
//   {kind:"opt",     item:r}
//   {kind:"labeled", label:"s", rule:r}

function buildEbnf(tree: ParseTree): any {
  // Strip leading untagged wrappers until we hit a handled tag.
  if (tree.kind !== "branch") throw new Error("buildEbnf: not a branch");

  // Dispatch on the tagged branch — ebnf_body wraps an ebnf_alt, which may
  // itself be tagged "ebnf_alt" (true alt) or pass through the first alt.
  return buildEbnfNode(tree);
}

function buildEbnfNode(t: ParseTree): any {
  if (t.kind !== "branch") {
    throw new Error(`buildEbnfNode: unexpected leaf '${t.kind === "leaf" ? t.text : t.kind}'`);
  }

  switch (t.tag) {
    case "ebnf_body":     return buildEbnfNode(findFirstEbnfChildOrSelf(t) ?? t);
    case "ebnf_seq":      return buildEbnfSeqChildren(t);
    case "ebnf_alt":      return buildEbnfAlt(t);
    case "ebnf_labeled":  return buildEbnfLabeled(t);
    case "ebnf_star":     return ebnfRep(buildEbnfNode(firstNonWs(t)!), 0);
    case "ebnf_plus":     return ebnfRep(buildEbnfNode(firstNonWs(t)!), 1);
    case "ebnf_opt":      return ebnfObj("opt",
                             [stringToBits("item"), buildEbnfNode(firstNonWs(t)!)]);
    case "ebnf_sep_rep":  return buildEbnfSepRep(t);
    case "ebnf_group":    return buildEbnfNode(findFirstEbnfChild(t)!);
    case "ebnf_regex":    return buildEbnfRegex(t);
    case "string":        return ebnfObj("lit", [stringToBits("text"), stringToBits(simpleStringText(t))]);
    case "ident":         return ebnfObj("nonterm", [stringToBits("name"), stringToBits(textOf(t))]);
  }

  // No explicit tag — walk into children to find the EBNF node. Covers
  // thin wrappers the engine sometimes produces.
  const sub = findFirstEbnfChild(t);
  if (sub) return buildEbnfNode(sub);

  return buildEbnfSeqChildren(t);
}

/** Unlike findFirstEbnfChild, returns the child even if its tag is a wrapper
 *  (e.g. ebnf_seq, ebnf_alt) — covers the case where ebnf_body wraps a
 *  single-seq body that we want to descend INTO rather than past. */
function findFirstEbnfChildOrSelf(t: ParseTree): ParseTree | null {
  if (t.kind !== "branch") return null;
  const extended = new Set([...EBNF_VALUE_TAGS, "ebnf_seq", "ebnf_body"]);
  for (const c of t.children) {
    if (c.kind === "branch" && c.tag && extended.has(c.tag)) return c;
  }
  return null;
}

function buildEbnfAlt(t: ParseTree): any {
  if (t.kind !== "branch") throw new Error("buildEbnfAlt: not a branch");
  const opts: any[] = [];
  const walkAlt = (n: ParseTree): void => {
    if (n.kind !== "branch") return;
    if (n.tag === "ebnf_alt" || n.tag === "ebnf_alt_tail") {
      for (const c of n.children) walkAlt(c);
      return;
    }
    if (isEbnfValueSubtree(n)) { opts.push(buildEbnfNode(n)); return; }
    for (const c of n.children) walkAlt(c);
  };
  for (const c of t.children) walkAlt(c);
  if (opts.length === 1) return opts[0];
  return ebnfObj("alt", [stringToBits("options"), makeEbnfArray(opts)]);
}

function buildEbnfLabeled(t: ParseTree): any {
  if (t.kind !== "branch") throw new Error("buildEbnfLabeled: not a branch");
  const identTree = t.children.find(c => c.kind === "branch" && c.tag === "ident") as ParseTree | undefined;
  if (!identTree) throw new Error("ebnf_labeled: missing ident");
  const label = textOf(identTree);
  const innerTree = findFirstEbnfChild(t, new Set([t, identTree]));
  if (!innerTree) throw new Error("ebnf_labeled: missing inner");
  const inner = buildEbnfNode(innerTree);
  return ebnfObj("labeled", [stringToBits("label"), stringToBits(label), stringToBits("rule"), inner]);
}

function buildEbnfSepRep(t: ParseTree): any {
  if (t.kind !== "branch") throw new Error("buildEbnfSepRep: not a branch");
  const atoms: any[] = [];
  for (const c of t.children) {
    if (c.kind === "branch" && isEbnfValueSubtree(c)) {
      atoms.push(buildEbnfNode(c));
    }
  }
  if (atoms.length !== 2) throw new Error(`ebnf_sep_rep: expected 2 atoms, got ${atoms.length}`);
  const [item, sep] = atoms;
  return ebnfObj("rep",
    [stringToBits("item"), item, stringToBits("min"), makeInt(0), stringToBits("sep"), sep]);
}

function buildEbnfRegex(t: ParseTree): any {
  if (t.kind !== "branch") throw new Error("buildEbnfRegex: not a branch");
  let body = "";
  let seenFirst = false;
  for (const c of t.children) {
    if (c.kind === "leaf") {
      if (c.text === "/") { seenFirst = true; continue; }
      if (seenFirst) body += c.text;
    } else if (c.kind === "branch") {
      if (seenFirst) body += textOf(c);
    }
  }
  return ebnfObj("regex", [stringToBits("pattern"), stringToBits(body)]);
}

function buildEbnfSeqChildren(t: ParseTree): any {
  if (t.kind !== "branch") throw new Error("buildEbnfSeqChildren: not a branch");
  const items: any[] = [];
  const walk = (n: ParseTree): void => {
    if (n.kind !== "branch") return;
    if (isEbnfValueSubtree(n)) { items.push(buildEbnfNode(n)); return; }
    for (const c of n.children) walk(c);
  };
  for (const c of t.children) walk(c);
  if (items.length === 0) throw new Error("ebnf seq: no items");
  if (items.length === 1) return items[0];
  return ebnfObj("seq", [stringToBits("items"), makeEbnfArray(items)]);
}

/** Tags that build into an EBNF value node. */
const EBNF_VALUE_TAGS = new Set([
  "ebnf_alt", "ebnf_labeled", "ebnf_star", "ebnf_plus", "ebnf_opt",
  "ebnf_sep_rep", "ebnf_group", "ebnf_regex",
  "string", "ident",
]);

function isEbnfValueSubtree(t: ParseTree): boolean {
  return t.kind === "branch" && !!t.tag && EBNF_VALUE_TAGS.has(t.tag);
}

function firstNonWs(t: ParseTree): ParseTree | null {
  if (t.kind !== "branch") return null;
  for (const c of t.children) {
    if (c.kind === "branch" && c.tag !== "ws" && c.tag !== "ws_any") return c;
  }
  return null;
}

function findFirstEbnfChild(t: ParseTree, exclude?: Set<ParseTree>): ParseTree | null {
  if (t.kind !== "branch") return null;
  for (const c of t.children) {
    if (exclude?.has(c)) continue;
    if (c.kind === "branch" && c.tag && EBNF_VALUE_TAGS.has(c.tag)) return c;
  }
  for (const c of t.children) {
    if (exclude?.has(c)) continue;
    if (c.kind === "branch") {
      const sub = findFirstEbnfChild(c, exclude);
      if (sub) return sub;
    }
  }
  return null;
}

function ebnfObj(kind: string, kvs: any[]): any {
  // typed_object(key, val, key, val, …) takes a flat list and kind goes first.
  return makeExpr(prim("typed_object"), [stringToBits("kind"), stringToBits(kind), ...kvs]);
}

function makeEbnfArray(items: any[]): any {
  return makeExpr(prim("typed_array"), items);
}

function ebnfRep(item: any, min: 0 | 1): any {
  return ebnfObj("rep",
    [stringToBits("item"), item, stringToBits("min"), makeInt(min)]);
}

/**
 * Build a precedence-spec value from a prec_spec tree. Emits a typed Object
 * with kind-keyed fields: `{at: "mul"}`, `{above: "mul", below: "unary"}`,
 * `{prec: "pow"}`, etc. The merger inspects which keys are present.
 */
function buildPrecSpec(tree: ParseTree): any {
  if (tree.kind !== "branch") throw new Error("buildPrecSpec: not a branch");
  const kvs: any[] = [];
  const walk = (t: ParseTree): void => {
    if (t.kind !== "branch") return;
    const kind =
      t.tag === "prec_at"    ? "at"    :
      t.tag === "prec_above" ? "above" :
      t.tag === "prec_below" ? "below" :
      t.tag === "prec_named" ? "prec"  : undefined;
    if (kind) {
      kvs.push(stringToBits(kind));
      kvs.push(stringToBits(extractPrecTarget(t)));
      return;
    }
    for (const c of t.children) walk(c);
  };
  for (const c of tree.children) walk(c);
  return makeExpr(prim("typed_object"), kvs);
}

/**
 * Extract the prec_target's underlying text. The `prec_target` production is
 * an alt that may hoist past its wrapper, so we scan the whole subtree for
 * the first `ident` or `string` branch.
 */
function extractPrecTarget(tree: ParseTree): string {
  const walk = (t: ParseTree): string | null => {
    if (t.kind !== "branch") return null;
    if (t.tag === "ident")  return textOf(t);
    if (t.tag === "string") return simpleStringText(t);
    for (const c of t.children) {
      const r = walk(c);
      if (r !== null) return r;
    }
    return null;
  };
  const r = walk(tree);
  if (r === null) throw new Error("prec_target: missing ident or string");
  return r;
}

/** Extract plain text from a `string` ParseTree. Interpolation not allowed. */
function simpleStringText(tree: ParseTree): string {
  if (tree.kind !== "branch" || tree.tag !== "string") {
    throw new Error(`simpleStringText: expected string tree, got ${tree.kind}/${(tree as any).tag}`);
  }
  let out = "";
  const walk = (t: ParseTree): void => {
    if (t.kind === "branch") {
      if (t.tag === "string_interp") {
        throw new Error("string interpolation not allowed in grammar declaration");
      }
      for (const c of t.children) walk(c);
      return;
    }
    if (t.kind === "leaf") {
      if (t.text === `"`) return;   // skip quote leaves
      out += t.text;
    }
  };
  walk(tree);
  return out.replace(/\\(.)/g, (_, ch: string) => {
    switch (ch) {
      case "n":  return "\n";
      case "t":  return "\t";
      case "r":  return "\r";
      case '"':  return '"';
      case "\\": return "\\";
      default:   return ch;
    }
  });
}

/** Search children (and their descendants) for the first branch with the
 *  given tag. Used by the grammar-block builder where named subtrees may
 *  be wrapped by `opt(seq([…]))` and similar. */
function findTaggedBranch(children: ParseTree[], tag: string): ParseTree | undefined {
  for (const c of children) {
    if (c.kind !== "branch") continue;
    if (c.tag === tag) return c;
    const sub = findTaggedBranch(c.children, tag);
    if (sub) return sub;
  }
  return undefined;
}

/** Like findTaggedBranch but traverses more deeply — for user rule / form
 *  dispatch where labeled branches may be nested under repetition wrappers. */
function findTaggedBranchDeep(children: ParseTree[], tag: string): ParseTree | undefined {
  const queue: ParseTree[] = [...children];
  while (queue.length > 0) {
    const t = queue.shift()!;
    if (t.kind !== "branch") continue;
    if (t.tag === tag) return t;
    for (const c of t.children) queue.push(c);
  }
  return undefined;
}

/** Find a label-tagged branch, also checking for the `$rep` suffix that the
 *  merger attaches to labels wrapping a rep-kind inner rule. Returns both
 *  the tree and whether it came from the $rep variant. */
function findLabeledBranch(children: ParseTree[], label: string): { tree: ParseTree | undefined; isRep: boolean } {
  const direct = findTaggedBranchDeep(children, label);
  if (direct) return { tree: direct, isRep: false };
  const rep = findTaggedBranchDeep(children, `${label}$rep`);
  if (rep) return { tree: rep, isRep: true };
  return { tree: undefined, isRep: false };
}

/**
 * Build an Allegro Value from a labeled parse-tree branch. If the label
 * wraps a single expression, recurse into it. If it wraps a repetition of
 * labeled sub-items, build an Array of their values. Otherwise, treat as
 * raw text.
 */
function buildExprFromLabeled(tree: ParseTree, paramMap: Map<string, any>, isRep: boolean = false): any {
  if (tree.kind !== "branch") return stringToBits(tree.kind === "leaf" ? tree.text : "");

  // Collect all expression-tagged descendants in order. Walk recursively but
  // don't descend into an expression-tagged branch's children (those belong
  // to that expression's own tree-building).
  const items: any[] = [];
  const walk = (t: ParseTree): void => {
    if (t.kind !== "branch") return;
    if (t.tag && EXPRESSION_TAGS.has(t.tag)) { items.push(buildExpr(t, paramMap)); return; }
    for (const c of t.children) walk(c);
  };
  for (const c of tree.children) walk(c);

  if (isRep) {
    // Rep-kind label: always wrap as an array, even if exactly one item.
    return makeExpr(prim("typed_array"), items);
  }
  if (items.length === 1) return items[0];
  if (items.length  >  1) {
    return makeExpr(prim("typed_array"), items);
  }
  return stringToBits(textOf(tree));
}

function findLastExprBranch(children: ParseTree[]): ParseTree | null {
  for (let i = children.length - 1; i >= 0; i--) {
    const c = children[i];
    if (c.kind === "branch") {
      if (c.tag && EXPRESSION_TAGS.has(c.tag)) return c;
      const sub = findLastExprBranch(c.children);
      if (sub) return sub;
    }
  }
  return null;
}

export function buildProgram(tree: ParseTree): any {
  tree = peelUntilTag(tree);
  const ctx = makeStructure();

  function addStmt(stmt: BuiltBinding): void {
    const b: any = { key: stmt.key, value: stmt.value };
    if (stmt.exported) b.visibility = "exported";
    // NOT `putEntry`: this `makeStructure` is parser-helpers', which mints a
    // plain `{ kind: 'Context', bindings, bindingList }` literal rather than a
    // Structure (B-132). The Structure write path does not apply to it.
    (ctx as any).bindingList.push(b);
    if (stmt.key !== null) (ctx as any).bindings.set(stmt.key, b);
  }

  // The program tree is either a "program" branch or untagged wrapper.
  const root = tree;
  if (root.kind !== "branch") {
    throw new Error("buildProgram: expected branch root");
  }

  // Walk to find stmt branches. theorem_decl / verify_stmt MUST be in
  // this dispatch set: fragment-merged grammars surface stmt
  // alternatives without the base grammar's "stmt" wrapper tag, and
  // without direct dispatch the walk would recurse past the theorem
  // into its children — building the proposition as a bare expression
  // and silently DROPPING the proof obligation (a false theorem in a
  // `use`-header file then never halts the build).
  const walk = (t: ParseTree): void => {
    if (t.kind !== "branch") return;
    if (t.tag === "stmt" || t.tag === "binding" || t.tag === "fn_decl" ||
        t.tag === "import_stmt" || t.tag === "export_binding" || t.tag === "export_fn_decl" ||
        t.tag === "theorem_decl" || t.tag === "verify_stmt" ||
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
