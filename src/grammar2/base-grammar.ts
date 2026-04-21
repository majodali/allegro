// =============================================================================
// Allegro Grammar 2 — Base (Allegretto) Grammar
//
// Full grammar for the Allegretto base language, expressed as a Grammar
// value per the Phase 0 formalism. Replaces the hand-written Pratt +
// recursive-descent parser (src/hybrid-parser.ts) once integrated.
//
// Precedence is encoded via stratified productions (expr_or → expr_and →
// expr_eq → expr_cmp → expr_add → expr_mul → expr_unary → expr_post →
// expr_atom), since the analyzer (Phase 3) is not yet available. Binary
// operators use LEFT RECURSION, handled by the engine's Warth iteration.
// =============================================================================

import {
  Grammar, Rule,
  makeGrammar, addProduction,
  lit, cls, regex, nonterm, seq, alt, rep, opt, guarded, reserved, indent as indentTerm,
} from "./types.js";

// --- Helpers ---

/** Interleave the whitespace nonterminal `ws` between items. */
function spaced(items: Rule[]): Rule {
  if (items.length === 0) return seq([]);
  const ws = nonterm("ws");
  const result: Rule[] = [items[0]];
  for (let i = 1; i < items.length; i++) {
    result.push(ws);
    result.push(items[i]);
  }
  return seq(result);
}

/** Left-recursive binary op: `head (OP tail)*` using LR. */
function leftBinary(selfName: string, tailName: string, ops: Array<{ op: string; tag: string }>): Rule {
  const options: Rule[] = [];
  for (const { op, tag } of ops) {
    options.push(spaced([nonterm(selfName), lit(op), nonterm(tailName)]));
    options[options.length - 1].attrs = { ...(options[options.length - 1].attrs), name: tag };
  }
  options.push(nonterm(tailName));
  return alt(options);
}

// --- Build the grammar ---

export function buildBaseGrammar(): Grammar {
  const g = makeGrammar({ start: "program" });

  g.reserved.set("keywords", new Set([
    "if", "then", "else",
    "when", "is", "of", "and",
    "import", "export",
    "true", "false",
    "none", "error",
    "instanceof", "subtypeof",
  ]));

  // --- Terminals ---

  // Whitespace: spaces, tabs, and line/block comments. Horizontal only — does
  // NOT consume newlines. Newlines are statement boundaries (NEWLINE).
  addProduction(g, { name: "ws",
    rule: rep(alt([
      lit(" "),
      lit("\t"),
      regex(/\/\/[^\n]*/),           // // line comment
      regex(/\/\*[\s\S]*?\*\//),     // /* block comment */
    ]), { min: 0 }),
  });

  // Required-whitespace variant, for keyword boundaries like `if cond`.
  addProduction(g, { name: "ws_req",
    rule: rep(alt([
      lit(" "),
      lit("\t"),
      regex(/\/\/[^\n]*/),
      regex(/\/\*[\s\S]*?\*\//),
    ]), { min: 1 }),
  });

  // Number literal: integers only in the base. Floats are a Standard addition.
  addProduction(g, { name: "number",
    rule: regex(/[0-9]+/),
    attrs: { name: "number" },
  });

  // Float literal (Standard): digits, decimal point, digits. Must be tried
  // BEFORE `number` in Alt order so "3.14" matches the float rule rather
  // than `number` consuming "3" and leaving `.14` to dot access.
  addProduction(g, { name: "float",
    rule: regex(/[0-9]+\.[0-9]+/),
    attrs: { name: "float" },
  });

  // Bool literals (Standard): `true`/`false`. Note these ARE in the reserved
  // set, so they're kept out of `ident`; here they match as typed atoms.
  addProduction(g, { name: "bool",
    rule: alt([lit("true"), lit("false")]),
    attrs: { name: "bool" },
  });

  // None literal (Standard): the `none` singleton.
  addProduction(g, { name: "none_lit",
    rule: lit("none"),
    attrs: { name: "none_lit" },
  });

  // Identifier: starts with letter or underscore; followed by word chars.
  // @reserved(keywords) excludes exact-match keywords from `ident`.
  addProduction(g, { name: "ident",
    rule: guarded(
      regex(/[a-zA-Z_][a-zA-Z_0-9]*/),
      reserved("keywords"),
    ),
    attrs: { name: "ident" },
  });

  // String literal: double-quoted. Backslash escapes deferred to Standard.
  addProduction(g, { name: "string",
    rule: regex(/"(?:[^"\\]|\\.)*"/),
    attrs: { name: "string" },
  });

  // --- Expression levels (left-recursive for binary operators) ---

  // Top-level expression: start at the lowest precedence (or).
  addProduction(g, { name: "expr",
    rule: nonterm("expr_or"),
  });

  // Level 1 — logical or
  addProduction(g, { name: "expr_or",
    rule: leftBinary("expr_or", "expr_and", [{ op: "||", tag: "or" }]),
  });

  // Level 2 — logical and
  addProduction(g, { name: "expr_and",
    rule: leftBinary("expr_and", "expr_eq", [{ op: "&&", tag: "and" }]),
  });

  // Level 3 — equality
  addProduction(g, { name: "expr_eq",
    rule: leftBinary("expr_eq", "expr_cmp", [
      { op: "==", tag: "eq" },
      { op: "!=", tag: "neq" },
    ]),
  });

  // Level 4 — comparison
  addProduction(g, { name: "expr_cmp",
    rule: leftBinary("expr_cmp", "expr_add", [
      { op: "<=", tag: "lte" },
      { op: ">=", tag: "gte" },
      { op: "<",  tag: "lt" },
      { op: ">",  tag: "gt" },
    ]),
  });

  // Level 5 — additive
  addProduction(g, { name: "expr_add",
    rule: leftBinary("expr_add", "expr_mul", [
      { op: "+", tag: "add" },
      { op: "-", tag: "sub" },
    ]),
  });

  // Level 6 — multiplicative
  addProduction(g, { name: "expr_mul",
    rule: leftBinary("expr_mul", "expr_unary", [
      { op: "*", tag: "mul" },
      { op: "/", tag: "div" },
      { op: "%", tag: "mod" },
    ]),
  });

  // Level 7 — unary prefix ops
  addProduction(g, { name: "expr_unary",
    rule: alt([
      seq([lit("-"), nonterm("expr_unary")], { name: "neg" }),
      seq([lit("!"), nonterm("expr_unary")], { name: "not" }),
      nonterm("expr_post"),
    ]),
  });

  // Level 8 — postfix: function calls, dot access, bracket indexing.
  // Left-recursive so `f(x).y[0]` parses left-to-right as (((f)(x)).y)[0].
  addProduction(g, { name: "expr_post",
    rule: alt([
      seq([nonterm("expr_post"), lit("("), nonterm("ws"),
           nonterm("args"), nonterm("ws"), lit(")")], { name: "call" }),
      seq([nonterm("expr_post"), lit("."), nonterm("ident")], { name: "dot" }),
      seq([nonterm("expr_post"), lit("["), nonterm("ws"),
           nonterm("expr"), nonterm("ws"), lit("]")], { name: "bracket" }),
      nonterm("expr_atom"),
    ]),
  });

  // Comma-separated arguments (0 or more)
  addProduction(g, { name: "args",
    rule: opt(spaced_list("expr", ",")),
  });

  // Level 9 — atoms. Order matters: float before number (3.14 vs 3), bool
  // and none before ident (they're keywords and would fail ident's reserved
  // guard anyway, but being explicit matches clearly).
  addProduction(g, { name: "expr_atom",
    rule: alt([
      nonterm("if_expr"),
      nonterm("lambda"),
      nonterm("float"),
      nonterm("number"),
      nonterm("string"),
      nonterm("bool"),
      nonterm("none_lit"),
      nonterm("paren_expr"),
      nonterm("ident"),
    ]),
  });

  addProduction(g, { name: "paren_expr",
    rule: spaced([lit("("), nonterm("expr"), lit(")")]),
    attrs: { name: "paren" },
  });

  // if-then-else (right-associative by construction: else branch is expr)
  addProduction(g, { name: "if_expr",
    rule: seq([
      lit("if"),    nonterm("ws_req"),
      nonterm("expr"), nonterm("ws_req"),
      lit("then"),  nonterm("ws_req"),
      nonterm("expr"), nonterm("ws_req"),
      lit("else"),  nonterm("ws_req"),
      nonterm("expr"),
    ], { name: "if" }),
  });

  // Lambda: `x => expr` (single param, no parens) or `(x, y) => expr`.
  addProduction(g, { name: "lambda",
    rule: alt([
      // Single-param: ident => expr
      seq([nonterm("ident"), nonterm("ws"), lit("=>"), nonterm("ws"), nonterm("expr")],
        { name: "lambda1" }),
      // Multi-param: (ident, ...) => expr
      seq([lit("("), nonterm("ws"), nonterm("param_list"), nonterm("ws"), lit(")"),
           nonterm("ws"), lit("=>"), nonterm("ws"), nonterm("expr")],
        { name: "lambdaN" }),
    ]),
  });

  // Parameter list: 0 or more idents separated by commas.
  addProduction(g, { name: "param_list",
    rule: opt(spaced_list("ident", ",")),
  });

  // --- Statements ---

  addProduction(g, { name: "stmt",
    rule: alt([
      // Function def: `name(params) => body`
      seq([nonterm("ident"), lit("("), nonterm("ws"), nonterm("param_list"),
           nonterm("ws"), lit(")"), nonterm("ws"), lit("=>"), nonterm("ws"),
           nonterm("expr")],
        { name: "fn_decl" }),
      // Binding: `name = expr`
      seq([nonterm("ident"), nonterm("ws"), lit("="), nonterm("ws"), nonterm("expr")],
        { name: "binding" }),
      // Bare expression
      nonterm("expr"),
    ]),
    attrs: { name: "stmt" },
  });

  // --- Program: statements separated by newlines ---
  //
  // Programs can have leading/trailing blank lines and surrounding whitespace.
  // Structure: ws? (NEWLINE ws?)* stmt (NEWLINE+ stmt)* (NEWLINE ws?)*
  //
  // We achieve this by wrapping optional "line breaks" (Rep of NEWLINE) around
  // the core Rep of statements.

  // line_break: at least one \n-boundary, possibly interleaved with
  // horizontal whitespace / comments. Handles blank lines, comment-only
  // lines, and trailing whitespace before \n.
  addProduction(g, { name: "line_break",
    rule: rep(seq([opt(nonterm("ws")), indentTerm("NEWLINE")]), { min: 1 }),
  });

  addProduction(g, { name: "program",
    rule: seq([
      opt(nonterm("ws")),
      opt(nonterm("line_break")),
      opt(rep(nonterm("stmt"), { min: 1, sep: nonterm("line_break") })),
      opt(nonterm("line_break")),
      opt(nonterm("ws")),
    ], { name: "program" }),
  });

  return g;
}

/** Helper: build a Rep with comma separator (comma + surrounding ws). */
function spaced_list(itemName: string, separator: string): Rule {
  return rep(nonterm(itemName), {
    min: 1,
    sep: seq([nonterm("ws"), lit(separator), nonterm("ws")]),
  });
}

// --- Singleton ---

let cachedBase: Grammar | null = null;

export function getBaseGrammar(): Grammar {
  if (!cachedBase) cachedBase = buildBaseGrammar();
  return cachedBase;
}
