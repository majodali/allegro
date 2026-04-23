// =============================================================================
// Allegro Grammar 2 — Runtime Fragment Merging
//
// `use NAME` (and the Phase 1 legacy `register_infix` / `register_prefix` /
// `register_postfix` / `register_expr_prefix` primitives) load a module whose
// grammar extensions — stored as a `GrammarFragment` — are merged into the
// parser grammar before parsing the consuming file.
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
import { buildBaseGrammar, BASE_LEVEL_NAMES, BASE_OPERATORS_TO_LEVEL } from "./base-grammar.js";
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
// --- Fragment compatibility / conflict validation (Phase 6 step 7) ---
//
// Run BEFORE the merger applies changes so errors surface as a single
// aggregated message rather than a mid-merge failure. Checks:
//   E_OPERATOR_CONFLICT      — two fragments (or fragment + base) both
//                              register the same operator symbol.
//   E_KEYWORD_CONFLICT       — ditto for expr_prefix keywords / user
//                              keywords vs. base reserved words.
//   E_PRECEDENCE_CYCLE       — user level constraints + base stack form a
//                              cyclic partial order (topo-sort fails).
//
// Deferred: E_INCOMPATIBLE_GRAMMARS (meaningful only after `new grammar`),
// W_PRODUCTION_REPLACED (needs `rule NAME = …` — step 6).

const BASE_RESERVED_KEYWORDS = new Set([
  "if", "then", "else",
  "when", "is", "of", "and",
  "import", "export",
  "true", "false",
  "none", "error",
  "instanceof", "subtypeof",
]);

export function validateFragments(fragments: GrammarFragment[]): string[] {
  const errors: string[] = [];

  // --- Operator conflicts ---
  //
  // Track each operator symbol's first source. A collision is any attempt to
  // re-register the same symbol — whether it's a base operator the user is
  // trying to shadow, or two fragments registering the same new operator.
  const opSources = new Map<string, string>();
  for (const [sym, level] of Object.entries(BASE_OPERATORS_TO_LEVEL)) {
    opSources.set(sym, `base grammar (level '${level}')`);
  }
  for (let i = 0; i < fragments.length; i++) {
    const fragTag = `fragment[${i}]`;
    for (const e of fragments[i].infix) {
      if (opSources.has(e.token)) {
        errors.push(`E_OPERATOR_CONFLICT: infix '${e.token}' from ${fragTag} conflicts with ${opSources.get(e.token)}`);
      } else opSources.set(e.token, `${fragTag} infix`);
    }
    for (const e of fragments[i].prefixOp) {
      if (opSources.has(e.token)) {
        errors.push(`E_OPERATOR_CONFLICT: prefix '${e.token}' from ${fragTag} conflicts with ${opSources.get(e.token)}`);
      } else opSources.set(e.token, `${fragTag} prefix`);
    }
    for (const e of fragments[i].postfixOp) {
      if (opSources.has(e.token)) {
        errors.push(`E_OPERATOR_CONFLICT: postfix '${e.token}' from ${fragTag} conflicts with ${opSources.get(e.token)}`);
      } else opSources.set(e.token, `${fragTag} postfix`);
    }
  }

  // --- Keyword conflicts (expr_prefix) ---
  const kwSources = new Map<string, string>();
  for (const kw of BASE_RESERVED_KEYWORDS) kwSources.set(kw, "base reserved keyword");
  for (let i = 0; i < fragments.length; i++) {
    for (const e of fragments[i].exprPrefix) {
      if (kwSources.has(e.keyword)) {
        errors.push(`E_KEYWORD_CONFLICT: keyword '${e.keyword}' from fragment[${i}] conflicts with ${kwSources.get(e.keyword)}`);
      } else kwSources.set(e.keyword, `fragment[${i}]`);
    }
  }

  // --- Precedence cycle detection ---
  //
  // Build a DAG over [base levels ∪ user levels]. Edges encode "binds tighter
  // than": A → B means B is tighter than A. The base grammar contributes its
  // total order (pipe → or → … → atom). Each user constraint adds:
  //   above(X) on level L  ⇒ X → L       (L is tighter than X)
  //   below(Y) on level L  ⇒ L → Y       (L is looser than Y, i.e., Y tighter than L)
  //
  // DFS with three-colour marking catches any back-edge = cycle.
  const userLevelDecls = new Map<string, Array<{ kind: "at"|"above"|"below"; target: string }>>();
  for (const f of fragments) {
    for (const p of (f.precedence ?? [])) {
      const existing = userLevelDecls.get(p.name) ?? [];
      for (const c of p.constraints) {
        if (!existing.some(ec => ec.kind === c.kind && ec.target === c.target)) {
          existing.push(c);
        }
      }
      userLevelDecls.set(p.name, existing);
    }
  }
  if (userLevelDecls.size > 0) {
    const cycleErr = detectPrecedenceCycle(userLevelDecls);
    if (cycleErr) errors.push(cycleErr);
  }

  return errors;
}

function detectPrecedenceCycle(
  userDecls: Map<string, Array<{ kind: "at"|"above"|"below"; target: string }>>,
): string | null {
  const nodes = new Set<string>([...BASE_LEVEL_NAMES, ...userDecls.keys()]);
  const edges = new Map<string, Set<string>>();
  for (const n of nodes) edges.set(n, new Set());

  // Base total order.
  for (let i = 0; i < BASE_LEVEL_NAMES.length - 1; i++) {
    edges.get(BASE_LEVEL_NAMES[i])!.add(BASE_LEVEL_NAMES[i + 1]);
  }
  // User constraints.
  for (const [level, constraints] of userDecls) {
    for (const c of constraints) {
      if (c.kind === "above") edges.get(c.target)?.add(level);
      if (c.kind === "below") edges.get(level)?.add(c.target);
      // `at` is an alias — no edge needed.
    }
  }

  // DFS cycle detection.
  const colour = new Map<string, 0 | 1 | 2>();
  for (const n of nodes) colour.set(n, 0);

  function dfs(n: string, stack: string[]): string[] | null {
    if (colour.get(n) === 1) {
      const start = stack.indexOf(n);
      return [...stack.slice(start), n];
    }
    if (colour.get(n) === 2) return null;
    colour.set(n, 1);
    stack.push(n);
    for (const m of edges.get(n) ?? []) {
      const cyc = dfs(m, stack);
      if (cyc) return cyc;
    }
    stack.pop();
    colour.set(n, 2);
    return null;
  }

  for (const n of nodes) {
    if (colour.get(n) === 0) {
      const cyc = dfs(n, []);
      if (cyc) return `E_PRECEDENCE_CYCLE: constraint cycle: ${cyc.join(" → ")}`;
    }
  }
  return null;
}

function buildExtendedGrammar(fragments: GrammarFragment[]): Grammar {
  // Validate cross-fragment consistency before mutating the grammar. An
  // aggregated error (joined with \n) surfaces at the `use X` call site so
  // users see all problems at once.
  const errs = validateFragments(fragments);
  if (errs.length > 0) {
    throw new Error("Grammar extension errors:\n  " + errs.join("\n  "));
  }

  // Start with a fresh base grammar.
  const g = buildBaseGrammar();

  // --- Split entries into Phase 1 (bp set) vs Phase 6 (level set) ---
  //
  // Phase 1 entries come from `register_infix` / `register_prefix` /
  // `register_postfix` / `register_expr_prefix` — numeric bp, no level name.
  // Phase 6 entries come from `grammar { … }` blocks — named level, no bp.
  const p1Frags: GrammarFragment[] = [];
  const p6Infix:   Array<{ tag: string; op: string; level: string; assoc: "left"|"right"|"none" }> = [];
  const p6Prefix:  Array<{ tag: string; op: string; level: string }> = [];
  const p6Postfix: Array<{ tag: string; op: string; level: string }> = [];
  const p6LevelDecls: Map<string, Array<{ kind: "at"|"above"|"below"; target: string }>> = new Map();

  for (const frag of fragments) {
    const p1: GrammarFragment = {
      keywords:   [...frag.keywords],
      operators:  [...frag.operators],
      infix:      [],
      prefixOp:   [],
      postfixOp:  [],
      exprPrefix: [...frag.exprPrefix],      // expr_prefix is level-less in both phases
    };
    for (const e of frag.infix) {
      if (e.level !== undefined) {
        const tag = registerUserOp({ kind: "infix", token: e.token, fn: e.fn });
        p6Infix.push({ tag, op: e.token, level: e.level, assoc: e.assoc ?? "left" });
      } else {
        p1.infix.push(e);
      }
    }
    for (const e of frag.prefixOp) {
      if (e.level !== undefined) {
        const tag = registerUserOp({ kind: "prefix", token: e.token, fn: e.fn });
        p6Prefix.push({ tag, op: e.token, level: e.level });
      } else {
        p1.prefixOp.push(e);
      }
    }
    for (const e of frag.postfixOp) {
      if (e.level !== undefined) {
        const tag = registerUserOp({ kind: "postfix", token: e.token, fn: e.fn });
        p6Postfix.push({ tag, op: e.token, level: e.level });
      } else {
        p1.postfixOp.push(e);
      }
    }
    for (const decl of (frag.precedence ?? [])) {
      const existing = p6LevelDecls.get(decl.name) ?? [];
      for (const c of decl.constraints) {
        if (!existing.some(ec => ec.kind === c.kind && ec.target === c.target)) {
          existing.push(c);
        }
      }
      p6LevelDecls.set(decl.name, existing);
    }
    p1Frags.push(p1);
  }

  // --- Phase 1 path (back-compat for register_*) ---
  applyPhase1Extensions(g, p1Frags);

  // --- Phase 6 path (named precedence, level insertion) ---
  applyPhase6Extensions(g, p6Infix, p6Prefix, p6Postfix, p6LevelDecls);

  return g;
}

function applyPhase1Extensions(g: Grammar, fragments: GrammarFragment[]): void {
  const userInfix:    Array<{ tag: string; op: string }> = [];
  const userPrefix:   Array<{ tag: string; op: string }> = [];
  const userPostfix:  Array<{ tag: string; op: string }> = [];
  const userExprPref: Array<{ tag: string; kw: string }> = [];
  for (const frag of fragments) {
    for (const e of frag.infix) {
      const tag = registerUserOp({ kind: "infix", token: e.token, fn: e.fn });
      userInfix.push({ tag, op: e.token });
    }
    for (const e of frag.prefixOp) {
      const tag = registerUserOp({ kind: "prefix", token: e.token, fn: e.fn });
      userPrefix.push({ tag, op: e.token });
    }
    for (const e of frag.postfixOp) {
      const tag = registerUserOp({ kind: "postfix", token: e.token, fn: e.fn });
      userPostfix.push({ tag, op: e.token });
    }
    for (const e of frag.exprPrefix) {
      const tag = registerUserOp({ kind: "exprPrefix", token: e.keyword, fn: e.fn });
      userExprPref.push({ tag, kw: e.keyword });
    }
  }

  // Phase 1 infix → synthetic expr_user_infix between mul and of.
  if (userInfix.length > 0) {
    const mulRule = alt([
      seq([nonterm("expr_mul"), nonterm("ws"), lit("*"), nonterm("ws"), nonterm("expr_user_infix")], { name: "mul" }),
      seq([nonterm("expr_mul"), nonterm("ws"), lit("/"), nonterm("ws"), nonterm("expr_user_infix")], { name: "div" }),
      seq([nonterm("expr_mul"), nonterm("ws"), lit("%"), nonterm("ws"), nonterm("expr_user_infix")], { name: "mod" }),
      nonterm("expr_user_infix"),
    ]);
    g.productions.delete("expr_mul");
    addProduction(g, { name: "expr_mul", rule: mulRule });
    const alts: Rule[] = userInfix.map(({ tag, op }) =>
      seq([nonterm("expr_user_infix"), nonterm("ws"), lit(op), nonterm("ws"), nonterm("expr_of")], { name: tag })
    );
    alts.push(nonterm("expr_of"));
    addProduction(g, { name: "expr_user_infix", rule: alt(alts) });
  }

  if (userPrefix.length > 0 || userExprPref.length > 0) {
    const alts: Rule[] = [
      seq([lit("-"),     nonterm("expr_unary")], { name: "neg" }),
      seq([lit("!"),     nonterm("expr_unary")], { name: "not" }),
      seq([lit("error"), nonterm("ws_req"), nonterm("expr_unary")], { name: "error_expr" }),
    ];
    for (const { tag, kw } of userExprPref) {
      alts.push(seq([lit(kw), nonterm("ws_req"), nonterm("expr_unary")], { name: tag }));
    }
    for (const { tag, op } of userPrefix) {
      alts.push(seq([lit(op), nonterm("expr_unary")], { name: tag }));
    }
    alts.push(nonterm("expr_post"));
    g.productions.delete("expr_unary");
    addProduction(g, { name: "expr_unary", rule: alt(alts) });
  }

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

  const keywords = g.reserved.get("keywords");
  if (keywords) {
    for (const { kw } of userExprPref) keywords.add(kw);
  }
}

function applyPhase6Extensions(
  g:        Grammar,
  infix:    Array<{ tag: string; op: string; level: string; assoc: "left"|"right"|"none" }>,
  prefix:   Array<{ tag: string; op: string; level: string }>,
  postfix:  Array<{ tag: string; op: string; level: string }>,
  levelDecls: Map<string, Array<{ kind: "at"|"above"|"below"; target: string }>>,
): void {
  if (infix.length === 0 && prefix.length === 0 && postfix.length === 0 && levelDecls.size === 0) return;

  // Gather the set of referenced level names (base + user-declared).
  const referencedLevels = new Set<string>();
  for (const e of infix)   referencedLevels.add(e.level);
  for (const e of prefix)  referencedLevels.add(e.level);
  for (const e of postfix) referencedLevels.add(e.level);
  for (const name of levelDecls.keys()) referencedLevels.add(name);

  // Insert each non-base level into the stratified stack. Base levels (`mul`,
  // `add`, etc.) stay in place; user levels get spliced in based on their
  // constraints relative to their neighbours.
  for (const levelName of referencedLevels) {
    if (BASE_LEVEL_NAMES.includes(levelName)) continue;
    const constraints = levelDecls.get(levelName) ?? [];
    insertUserLevel(g, levelName, constraints);
  }

  // Append user operators to their target level's production.
  for (const e of infix) {
    const tighter = getTighterNeighbor(g, e.level);
    if (!tighter) throw new Error(`phase6 infix '${e.op}' at level '${e.level}' has no tighter neighbour`);
    const selfName  = `expr_${e.level}`;
    const tightName = `expr_${tighter}`;
    const leftSide  = e.assoc === "right" ? nonterm(tightName) : nonterm(selfName);
    const rightSide = e.assoc === "left"  ? nonterm(tightName) : e.assoc === "right" ? nonterm(selfName) : nonterm(tightName);
    const newAlt    = seq([leftSide, nonterm("ws"), lit(e.op), nonterm("ws"), rightSide], { name: e.tag });
    appendAltBeforeFallthrough(g, selfName, newAlt);
  }
  for (const e of prefix) {
    const tighter = getTighterNeighbor(g, e.level);
    const selfName = `expr_${e.level}`;
    const newAlt   = seq([lit(e.op), nonterm(selfName)], { name: e.tag });
    appendAltBeforeFallthrough(g, selfName, newAlt);
  }
  for (const e of postfix) {
    const selfName = `expr_${e.level}`;
    const newAlt   = seq([nonterm(selfName), lit(e.op)], { name: e.tag });
    appendAltBeforeFallthrough(g, selfName, newAlt);
  }
}

/**
 * Insert a new user-declared level into the stratified stack. Determines the
 * looser + tighter neighbours from the level's constraints, creates the new
 * `expr_<name>` production forwarding to the tighter neighbour, and rewrites
 * the looser neighbour's production to point at the new level instead.
 */
function insertUserLevel(
  g: Grammar,
  levelName: string,
  constraints: Array<{ kind: "at"|"above"|"below"; target: string }>,
): void {
  // Skip if already inserted.
  if (g.productions.has(`expr_${levelName}`)) return;

  // `above(X)` = tighter than X = inserted immediately after X in the stack.
  // `below(Y)` = looser than Y = user level's chain must reach Y transitively
  //              (it's a *range* constraint, not a positional one).
  // We pick the insertion point from `above(X)` when present; `below(Y)` acts
  // as a secondary constraint the caller can validate (step 7: cycle check).
  let looserTarget:  string | undefined;
  let tighterTarget: string | undefined;

  for (const c of constraints) {
    if (c.kind === "above") looserTarget  = c.target;
    if (c.kind === "below") tighterTarget = c.target;
  }

  // If only below(Y) given, find whatever level currently forwards directly
  // to Y and use it as the looser neighbour — the user level will be
  // inserted immediately before Y in the chain.
  if (!looserTarget && tighterTarget) {
    for (const [prodName] of g.productions) {
      if (!prodName.startsWith("expr_")) continue;
      const lvl = prodName.slice(5);
      if (lvl === tighterTarget) continue;
      if (getTighterNeighbor(g, lvl) === tighterTarget) {
        looserTarget = lvl;
        break;
      }
    }
  }

  if (!looserTarget) {
    throw new Error(`precedence: level '${levelName}' needs above(X) or below(Y) constraint`);
  }
  if (!g.productions.has(`expr_${looserTarget}`)) {
    throw new Error(`precedence: unknown target level '${looserTarget}' for level '${levelName}'`);
  }

  // Insert immediately after `looserTarget`. The new level's tighter
  // neighbour is whatever `looserTarget` currently forwards to — NOT the
  // user-stated `tighterTarget` (which may be several links down the chain).
  const currentNext = getTighterNeighbor(g, looserTarget);
  if (!currentNext) {
    throw new Error(`precedence: looser target '${looserTarget}' has no tighter neighbour`);
  }

  const selfName    = `expr_${levelName}`;
  const nextName    = `expr_${currentNext}`;
  const looserName  = `expr_${looserTarget}`;

  addProduction(g, { name: selfName, rule: alt([ nonterm(nextName) ]) });

  const looserProd = g.productions.get(looserName);
  if (!looserProd) throw new Error(`precedence: looser level '${looserTarget}' not in grammar`);
  const rewritten = rewriteNonterm(looserProd.rule, nextName, selfName);
  g.productions.delete(looserName);
  addProduction(g, { name: looserName, rule: rewritten });

  // Silence tighterTarget unused-var warning — step 7 adds the validation.
  void tighterTarget;
}

/**
 * Find the tighter neighbour of a level by looking at the grammar itself:
 * the level's production typically ends with a `nonterm(...)` fallthrough.
 * Returns the level name (without the `expr_` prefix), or undefined if the
 * level is not found or has no fallthrough.
 */
function getTighterNeighbor(g: Grammar, levelName: string): string | undefined {
  const prod = g.productions.get(`expr_${levelName}`);
  if (!prod || prod.rule.kind !== "alt") return undefined;
  const last = prod.rule.options[prod.rule.options.length - 1];
  if (last.kind !== "nonterm") return undefined;
  return last.name.startsWith("expr_") ? last.name.slice(5) : undefined;
}

/**
 * Insert a new alternative into a level's alt-list, right before the
 * fallthrough (which is always the last option — a bare nonterm reference to
 * the tighter neighbour).
 */
function appendAltBeforeFallthrough(g: Grammar, selfName: string, newAlt: Rule): void {
  const prod = g.productions.get(selfName);
  if (!prod) throw new Error(`appendAltBeforeFallthrough: production ${selfName} not found`);
  if (prod.rule.kind !== "alt") throw new Error(`${selfName} is not an alt rule`);
  const opts = [...prod.rule.options];
  const lastIdx = opts.length - 1;
  opts.splice(lastIdx, 0, newAlt);
  g.productions.delete(selfName);
  addProduction(g, { name: selfName, rule: alt(opts) });
}

/** Recursively rewrite nonterm references in a Rule. */
function rewriteNonterm(rule: Rule, fromName: string, toName: string): Rule {
  switch (rule.kind) {
    case "nonterm":
      return rule.name === fromName ? { ...rule, name: toName } : rule;
    case "seq":
      return { ...rule, items: rule.items.map(r => rewriteNonterm(r, fromName, toName)) };
    case "alt":
      return { ...rule, options: rule.options.map(r => rewriteNonterm(r, fromName, toName)) };
    case "rep":
      return {
        ...rule,
        item: rewriteNonterm(rule.item, fromName, toName),
        sep:  rule.sep ? rewriteNonterm(rule.sep, fromName, toName) : undefined,
      };
    case "opt":
      return { ...rule, item: rewriteNonterm(rule.item, fromName, toName) };
    case "guarded":
      return { ...rule, item: rewriteNonterm(rule.item, fromName, toName) };
    default:
      return rule;
  }
}
