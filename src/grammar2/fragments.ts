// =============================================================================
// Allegro Grammar 2 — Runtime Fragment Merging
//
// `use_grammar NAME` loads a module that calls `register_infix` / `register_prefix` /
// `register_postfix` / `register_expr_prefix`. Each call records an entry on a
// `GrammarFragment` attached to the module's Extension.
//
// This file takes those fragments and produces an extended grammar2 Grammar
// value — adding user-registered infix/prefix/postfix alternatives at the
// appropriate precedence levels, and tagging them with unique user-op tags
// so the tree-builder can dispatch via a registry of the user-supplied
// substitution templates.
// =============================================================================

import {
  Grammar, Rule, makeGrammar, addProduction,
  lit, nonterm, seq, alt, rep,
} from "./types.js";
import { buildBaseGrammar } from "./base-grammar.js";
import type { GrammarFragment } from "../types.js";
import type { Value } from "../types.js";

// --- User operation registry ---
//
// Each registered operator gets a unique tag. The registry maps tag → the
// user-supplied lambda Value (whose body is an AST template). Tree-builder
// looks up by tag at match time and calls substituteParams on the template.

export interface UserOp {
  kind:  "infix" | "prefix" | "postfix" | "exprPrefix";
  token: string;   // "**" or "neg"
  fn:    Value;    // ComposedFunction whose body is the AST template
}

const userOpRegistry: Map<string, UserOp> = new Map();

export function getUserOp(tag: string): UserOp | undefined {
  return userOpRegistry.get(tag);
}

let nextUserOpId = 1;

function registerUserOp(op: UserOp): string {
  const tag = `user_op_${nextUserOpId++}_${op.kind}_${op.token.replace(/[^a-zA-Z0-9]/g, "_")}`;
  userOpRegistry.set(tag, op);
  return tag;
}

// --- Fragment → Grammar merging ---

/**
 * Build a grammar from the base grammar plus a list of runtime-registered
 * grammar fragments. If `fragments` is empty, returns the cached base
 * grammar; otherwise builds a fresh Grammar with user ops inserted at
 * specific precedence levels.
 */
export function getGrammarWithFragments(fragments: GrammarFragment[]): Grammar {
  if (fragments.length === 0) {
    // No extensions — fall through to the shared/cached base grammar in
    // base-grammar.ts. Callers that want a fresh grammar can pass [].
    return buildBaseGrammar();
  }
  return buildExtendedGrammar(fragments);
}

/**
 * Build a fresh extended grammar with user-registered rules.
 *
 * Precedence placement (current, simple):
 *   - Infix operators go BETWEEN expr_mul and expr_of — higher precedence
 *     than * / /, lower than function calls.
 *   - Prefix operators go INTO expr_unary (alongside -, !, error).
 *   - Postfix operators go INTO expr_post (alongside call / dot / bracket).
 *   - Expr-prefix keywords go INTO expr_unary (like `error`).
 *
 * Future work: map the user-supplied `bp` to a specific precedence level.
 */
function buildExtendedGrammar(fragments: GrammarFragment[]): Grammar {
  // Start with a fresh base grammar.
  const g = buildBaseGrammar();

  // Collect all user alternatives by kind.
  const userInfix:    Array<{ tag: string; op: string }> = [];
  const userPrefix:   Array<{ tag: string; op: string }> = [];
  const userPostfix:  Array<{ tag: string; op: string }> = [];
  const userExprPref: Array<{ tag: string; kw: string }> = [];

  for (const frag of fragments) {
    for (const entry of frag.infix) {
      const tag = registerUserOp({ kind: "infix", token: entry.token, fn: entry.fn });
      userInfix.push({ tag, op: entry.token });
    }
    for (const entry of frag.prefixOp) {
      const tag = registerUserOp({ kind: "prefix", token: entry.token, fn: entry.fn });
      userPrefix.push({ tag, op: entry.token });
    }
    for (const entry of frag.postfixOp) {
      const tag = registerUserOp({ kind: "postfix", token: entry.token, fn: entry.fn });
      userPostfix.push({ tag, op: entry.token });
    }
    for (const entry of frag.exprPrefix) {
      const tag = registerUserOp({ kind: "exprPrefix", token: entry.keyword, fn: entry.fn });
      userExprPref.push({ tag, kw: entry.keyword });
    }
  }

  // Override expr_mul to fall through to a user-infix level.
  // `expr_mul = ...mul/div/mod... | expr_user_infix`
  // `expr_user_infix = <user infix alts> | expr_of`
  if (userInfix.length > 0) {
    // Redefine expr_mul with expr_user_infix as the fallthrough target.
    const mulRule = alt([
      seq([nonterm("expr_mul"), nonterm("ws"), lit("*"), nonterm("ws"), nonterm("expr_user_infix")], { name: "mul" }),
      seq([nonterm("expr_mul"), nonterm("ws"), lit("/"), nonterm("ws"), nonterm("expr_user_infix")], { name: "div" }),
      seq([nonterm("expr_mul"), nonterm("ws"), lit("%"), nonterm("ws"), nonterm("expr_user_infix")], { name: "mod" }),
      nonterm("expr_user_infix"),
    ]);
    g.productions.delete("expr_mul");
    addProduction(g, { name: "expr_mul", rule: mulRule });

    // Build expr_user_infix with user-registered infix operators.
    const alts: Rule[] = userInfix.map(({ tag, op }) =>
      seq([nonterm("expr_user_infix"), nonterm("ws"), lit(op), nonterm("ws"), nonterm("expr_of")], { name: tag })
    );
    alts.push(nonterm("expr_of"));
    addProduction(g, { name: "expr_user_infix", rule: alt(alts) });
  }

  // Override expr_unary to include user prefix operators and expr-prefix keywords.
  if (userPrefix.length > 0 || userExprPref.length > 0) {
    const alts: Rule[] = [
      seq([lit("-"),     nonterm("expr_unary")], { name: "neg" }),
      seq([lit("!"),     nonterm("expr_unary")], { name: "not" }),
      seq([lit("error"), nonterm("ws_req"), nonterm("expr_unary")], { name: "error_expr" }),
    ];
    // User expr-prefix keywords (e.g. `neg x`). Keyword + ws_req + expr.
    for (const { tag, kw } of userExprPref) {
      alts.push(seq([lit(kw), nonterm("ws_req"), nonterm("expr_unary")], { name: tag }));
    }
    // User prefix operators (e.g. `#x`). Symbol + expr.
    for (const { tag, op } of userPrefix) {
      alts.push(seq([lit(op), nonterm("expr_unary")], { name: tag }));
    }
    alts.push(nonterm("expr_post"));
    g.productions.delete("expr_unary");
    addProduction(g, { name: "expr_unary", rule: alt(alts) });
  }

  // Override expr_post to include user postfix operators.
  if (userPostfix.length > 0) {
    const alts: Rule[] = [
      seq([nonterm("expr_post"), lit("("), nonterm("ws_any"), nonterm("args"), nonterm("ws_any"), lit(")")], { name: "call" }),
      seq([nonterm("expr_post"), lit("."), nonterm("ident")], { name: "dot" }),
      seq([nonterm("expr_post"), lit("["), nonterm("ws_any"), nonterm("expr"), nonterm("ws_any"), lit("]")], { name: "bracket" }),
    ];
    for (const { tag, op } of userPostfix) {
      alts.push(seq([nonterm("expr_post"), lit(op)], { name: tag }));
    }
    alts.push(nonterm("expr_atom"));
    g.productions.delete("expr_post");
    addProduction(g, { name: "expr_post", rule: alt(alts) });
  }

  // Add user-registered keywords to the reserved set so they don't collide
  // with `ident`.
  for (const { kw } of userExprPref) {
    const keywords = g.reserved.get("keywords");
    if (keywords) keywords.add(kw);
  }

  return g;
}
