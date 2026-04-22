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

  // Whitespace: spaces, tabs, line/block comments, AND continuation newlines.
  // A continuation newline is `\n + ws` where the next non-blank line's indent
  // is strictly deeper than the current block (stack top). This lets
  // expressions naturally span lines when indented:
  //
  //   if cond
  //     then a
  //     else b
  //
  // is a single expression because each continuation line is at col > 0.
  //
  // Horizontal whitespace AT the current block's column still ends the
  // expression (NEWLINE fires instead), so statement separation remains
  // intact.
  addProduction(g, { name: "ws",
    rule: rep(alt([
      lit(" "),
      lit("\t"),
      regex(/\/\/[^\n]*/),           // // line comment
      regex(/\/\*[\s\S]*?\*\//),     // /* block comment */
      indentTerm("CONT_NL"),         // continuation newline
    ]), { min: 0 }),
  });

  // Required-whitespace variant, for keyword boundaries like `if cond`.
  addProduction(g, { name: "ws_req",
    rule: rep(alt([
      lit(" "),
      lit("\t"),
      regex(/\/\/[^\n]*/),
      regex(/\/\*[\s\S]*?\*\//),
      indentTerm("CONT_NL"),
    ]), { min: 1 }),
  });

  // Bracket-context whitespace: consumes ANY whitespace including unconditional
  // newlines and comments. Used inside (...), [...], {...} where the opening
  // bracket establishes a "this is one expression" context — newlines don't
  // mean statement boundaries until the matching closing bracket.
  addProduction(g, { name: "ws_any",
    rule: rep(alt([
      lit(" "),
      lit("\t"),
      lit("\n"),
      regex(/\/\/[^\n]*/),
      regex(/\/\*[\s\S]*?\*\//),
    ]), { min: 0 }),
  });

  // Horizontal-only whitespace (no CONT_NL, no \n): used before a position
  // where INDENT might start a block, so the \n stays available for INDENT
  // to match. Without this, `ws`'s CONT_NL would consume the \n eagerly
  // and prevent block_expr from matching.
  addProduction(g, { name: "hws",
    rule: rep(alt([
      lit(" "),
      lit("\t"),
      regex(/\/\/[^\n]*/),
      regex(/\/\*[\s\S]*?\*\//),
    ]), { min: 0 }),
  });

  // Number literal: integers. Supports decimal, hex (`0x...`) and binary
  // (`0b...`) forms. Floats are a separate production.
  addProduction(g, { name: "number",
    rule: alt([
      regex(/0[xX][0-9a-fA-F]+/),   // hex
      regex(/0[bB][01]+/),          // binary
      regex(/[0-9]+/),              // decimal
    ]),
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

  // String literal: double-quoted, with backslash escapes and `{expr}`
  // interpolation. Supports escapes `\n`, `\t`, `\\`, `\"`, `\{`, `\}`.
  //
  // Structure (scannerless):
  //   string = " string_part* "
  //   string_part = string_chars | string_escape | string_interp
  //   string_chars = anything except " \ {
  //   string_escape = \ .
  //   string_interp = { expr }
  addProduction(g, { name: "string_chars",
    rule: regex(/[^"\\{]+/),
  });
  addProduction(g, { name: "string_escape",
    rule: regex(/\\./),
  });
  addProduction(g, { name: "string_interp",
    rule: seq([lit("{"), nonterm("ws"), nonterm("expr"), nonterm("ws"), lit("}")],
      { name: "string_interp" }),
  });
  addProduction(g, { name: "string",
    rule: seq([
      lit("\""),
      rep(alt([
        nonterm("string_chars"),
        nonterm("string_escape"),
        nonterm("string_interp"),
      ]), { min: 0 }),
      lit("\""),
    ]),
    attrs: { name: "string" },
  });

  // --- Expression levels (left-recursive for binary operators) ---

  // Top-level expression: pipe is the lowest precedence.
  addProduction(g, { name: "expr",
    rule: nonterm("expr_pipe"),
  });

  // Level 0 — pipe operator: `x |> f` → `f(x)` (left-associative)
  addProduction(g, { name: "expr_pipe",
    rule: alt([
      seq([nonterm("expr_pipe"), nonterm("ws"), lit("|>"), nonterm("ws"), nonterm("expr_or")],
        { name: "pipe" }),
      nonterm("expr_or"),
    ]),
  });

  // Level 1 — logical or (|| and keyword `or`)
  addProduction(g, { name: "expr_or",
    rule: alt([
      seq([nonterm("expr_or"), nonterm("ws"), lit("||"), nonterm("ws"), nonterm("expr_and")], { name: "or" }),
      seq([nonterm("expr_or"), nonterm("ws_req"), lit("or"), nonterm("ws_req"), nonterm("expr_and")], { name: "or" }),
      nonterm("expr_and"),
    ]),
  });

  // Level 2 — logical and (&& and keyword `and`)
  addProduction(g, { name: "expr_and",
    rule: alt([
      seq([nonterm("expr_and"), nonterm("ws"), lit("&&"), nonterm("ws"), nonterm("expr_eq")], { name: "and" }),
      seq([nonterm("expr_and"), nonterm("ws_req"), lit("and"), nonterm("ws_req"), nonterm("expr_eq")], { name: "and" }),
      nonterm("expr_eq"),
    ]),
  });

  // Level 3 — equality
  addProduction(g, { name: "expr_eq",
    rule: leftBinary("expr_eq", "expr_cmp", [
      { op: "==", tag: "eq" },
      { op: "!=", tag: "neq" },
    ]),
  });

  // Level 4 — comparison (ordering + type operators)
  addProduction(g, { name: "expr_cmp",
    rule: alt([
      seq([nonterm("expr_cmp"), nonterm("ws"), lit("<="), nonterm("ws"), nonterm("expr_add")], { name: "lte" }),
      seq([nonterm("expr_cmp"), nonterm("ws"), lit(">="), nonterm("ws"), nonterm("expr_add")], { name: "gte" }),
      seq([nonterm("expr_cmp"), nonterm("ws"), lit("<"),  nonterm("ws"), nonterm("expr_add")], { name: "lt" }),
      seq([nonterm("expr_cmp"), nonterm("ws"), lit(">"),  nonterm("ws"), nonterm("expr_add")], { name: "gt" }),
      seq([nonterm("expr_cmp"), nonterm("ws_req"), lit("instanceof"), nonterm("ws_req"), nonterm("expr_add")], { name: "instanceof" }),
      seq([nonterm("expr_cmp"), nonterm("ws_req"), lit("subtypeof"),  nonterm("ws_req"), nonterm("expr_add")], { name: "subtypeof" }),
      nonterm("expr_add"),
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
    rule: leftBinary("expr_mul", "expr_of", [
      { op: "*", tag: "mul" },
      { op: "/", tag: "div" },
      { op: "%", tag: "mod" },
    ]),
  });

  // Level 7a — `<name> of <expr>`: MultiValue component access.
  //   type of x   → mv_get(x, "type")
  //   error of y  → mv_get(y, "error")
  //
  // LHS is syntactically an ident OR the `error` keyword (which is reserved
  // and wouldn't match ident). Non-recursive: only one `of` per chain.
  addProduction(g, { name: "expr_of",
    rule: alt([
      seq([nonterm("ident"),    nonterm("ws_req"), lit("of"), nonterm("ws_req"), nonterm("expr_unary")], { name: "of" }),
      seq([lit("error"),        nonterm("ws_req"), lit("of"), nonterm("ws_req"), nonterm("expr_unary")], { name: "of_error" }),
      nonterm("expr_unary"),
    ]),
  });

  // Level 7b — unary prefix ops
  addProduction(g, { name: "expr_unary",
    rule: alt([
      seq([lit("-"), nonterm("expr_unary")], { name: "neg" }),
      seq([lit("!"), nonterm("expr_unary")], { name: "not" }),
      seq([lit("error"), nonterm("ws_req"), nonterm("expr_unary")], { name: "error_expr" }),
      nonterm("expr_post"),
    ]),
  });

  // Level 8 — postfix: function calls, dot access, bracket indexing.
  // Left-recursive so `f(x).y[0]` parses left-to-right as (((f)(x)).y)[0].
  // Bracketed contexts use `ws_any` so args and indices may span lines freely.
  addProduction(g, { name: "expr_post",
    rule: alt([
      seq([nonterm("expr_post"), lit("("), nonterm("ws_any"),
           nonterm("args"), nonterm("ws_any"), lit(")")], { name: "call" }),
      seq([nonterm("expr_post"), lit("."), nonterm("ident")], { name: "dot" }),
      seq([nonterm("expr_post"), lit("["), nonterm("ws_any"),
           nonterm("expr"), nonterm("ws_any"), lit("]")], { name: "bracket" }),
      nonterm("expr_atom"),
    ]),
  });

  // Comma-separated arguments (0 or more)
  addProduction(g, { name: "args",
    rule: opt(spaced_list("expr", ",")),
  });

  // Level 9 — atoms. Order matters: float before number (3.14 vs 3), bool
  // and none before ident (they're keywords and would fail ident's reserved
  // guard anyway, but being explicit matches clearly). block_expr is tried
  // first because it needs the INDENT terminal to fire; INDENT can only
  // match if the next content is deeper than the current stack top, so
  // block_expr fails cheaply on non-block inputs.
  addProduction(g, { name: "expr_atom",
    rule: alt([
      nonterm("block_expr"),
      nonterm("when_expr"),
      nonterm("if_expr"),
      nonterm("lambda"),
      nonterm("float"),
      nonterm("number"),
      nonterm("string"),
      nonterm("bool"),
      nonterm("none_lit"),
      nonterm("array_lit"),
      nonterm("object_lit"),
      nonterm("paren_expr"),
      nonterm("ident"),
    ]),
  });

  // Offside-rule block as an expression value. Grammar:
  //
  //   block_expr = INDENT block_body DEDENT
  //   block_body = stmt (NEWLINE stmt)*     (last stmt must be a bare expr)
  //
  // The value of the block is the value of the final bare-expr stmt, with
  // preceding binding stmts available in its scope (handled by the tree
  // builder via nested lambda substitution).
  addProduction(g, { name: "block_expr",
    rule: seq([
      indentTerm("INDENT"),
      rep(nonterm("stmt"), { min: 1, sep: nonterm("line_break") }),
      indentTerm("DEDENT"),
    ], { name: "block_expr" }),
  });

  // Body of a function or binding value. Tries an indented block FIRST —
  // `hws` (horizontal-only) keeps the \n available for INDENT to match. If
  // that fails, fall back to the inline form with continuation-aware `ws`.
  addProduction(g, { name: "fn_body",
    rule: alt([
      seq([nonterm("hws"), nonterm("block_expr")]),
      seq([nonterm("ws"),  nonterm("expr")]),
    ]),
  });

  // Array literal: `[expr, expr, ...]` — zero or more elements.
  // Uses ws_any inside so multi-line arrays work.
  addProduction(g, { name: "array_lit",
    rule: seq([
      lit("["),
      nonterm("ws_any"),
      opt(rep(nonterm("expr"), {
        min: 1,
        sep: seq([nonterm("ws_any"), lit(","), nonterm("ws_any")]),
      })),
      nonterm("ws_any"),
      lit("]"),
    ], { name: "array_lit" }),
  });

  // Object literal: `{key: expr, key: expr, ...}`. Keys are identifiers.
  // Uses ws_any inside so multi-line objects work.
  addProduction(g, { name: "object_lit",
    rule: seq([
      lit("{"),
      nonterm("ws_any"),
      opt(rep(nonterm("object_field"), {
        min: 1,
        sep: seq([nonterm("ws_any"), lit(","), nonterm("ws_any")]),
      })),
      nonterm("ws_any"),
      lit("}"),
    ], { name: "object_lit" }),
  });

  addProduction(g, { name: "object_field",
    rule: seq([
      nonterm("ident"),
      nonterm("ws"),
      lit(":"),
      nonterm("ws"),
      nonterm("expr"),
    ], { name: "object_field" }),
  });

  addProduction(g, { name: "paren_expr",
    rule: seq([lit("("), nonterm("ws_any"), nonterm("expr"), nonterm("ws_any"), lit(")")]),
    attrs: { name: "paren" },
  });

  // --- `when/is/then` pattern matching ---
  //
  // Inline : `when expr is pattern [and guard] then result else result`
  // Multi  : `when expr (is pattern [and guard] then result)+` (cases separated
  //          by continuation whitespace; no else required)
  //
  // The grammar expresses one-or-more cases with an optional else branch.
  // Limitation: deeply nested `when` inside case bodies requires parens or
  // explicit `else` branches (no column-based scope tracking yet).
  addProduction(g, { name: "when_expr",
    rule: seq([
      lit("when"), nonterm("ws_req"), nonterm("expr"),
      nonterm("ws"), nonterm("when_case"),
      rep(seq([nonterm("ws"), nonterm("when_case")]), { min: 0 }),
      opt(seq([nonterm("ws"), lit("else"), nonterm("ws_req"), nonterm("expr")])),
    ], { name: "when_expr" }),
  });

  addProduction(g, { name: "when_case",
    rule: seq([
      lit("is"), nonterm("ws_req"), nonterm("pattern"),
      opt(seq([nonterm("ws_req"), lit("and"), nonterm("ws_req"), nonterm("expr")])),
      nonterm("ws_req"), lit("then"), nonterm("ws_req"), nonterm("expr"),
    ], { name: "when_case" }),
  });

  // Pattern grammar. Order matters — more-specific patterns first.
  addProduction(g, { name: "pattern",
    rule: alt([
      nonterm("pattern_struct"),   // {x, y} / {x: sub}
      nonterm("pattern_typed"),    // Type(x, y)
      nonterm("pattern_wildcard"), // _
      nonterm("pattern_string"),   // "..."
      nonterm("pattern_number"),   // 42, -3
      nonterm("pattern_bool"),     // true/false
      nonterm("pattern_none"),     // none
      nonterm("pattern_ident"),    // var (binding or resolve-first)
    ]),
  });

  addProduction(g, { name: "pattern_wildcard",
    rule: seq([lit("_"), guarded(lit(""), {
      kind: "notFollowedBy",
      rule: cls("[a-zA-Z_0-9]"),
    } as any)], { name: "pattern_wildcard" }),
  });

  addProduction(g, { name: "pattern_number",
    rule: alt([
      seq([lit("-"), regex(/[0-9]+/)], { name: "pattern_neg_number" }),
      seq([regex(/[0-9]+/)],           { name: "pattern_number" }),
    ]),
  });

  addProduction(g, { name: "pattern_string",
    rule: nonterm("string"),
    attrs: { name: "pattern_string" },
  });

  addProduction(g, { name: "pattern_bool",
    rule: alt([lit("true"), lit("false")]),
    attrs: { name: "pattern_bool" },
  });

  addProduction(g, { name: "pattern_none",
    rule: lit("none"),
    attrs: { name: "pattern_none" },
  });

  addProduction(g, { name: "pattern_ident",
    rule: nonterm("ident"),
    attrs: { name: "pattern_ident" },
  });

  addProduction(g, { name: "pattern_struct",
    rule: seq([
      lit("{"), nonterm("ws_any"),
      opt(rep(nonterm("field_pattern"), {
        min: 1,
        sep: seq([nonterm("ws_any"), lit(","), nonterm("ws_any")]),
      })),
      nonterm("ws_any"), lit("}"),
    ], { name: "pattern_struct" }),
  });

  addProduction(g, { name: "pattern_typed",
    rule: seq([
      nonterm("ident"),
      lit("("), nonterm("ws_any"),
      opt(rep(nonterm("field_pattern"), {
        min: 1,
        sep: seq([nonterm("ws_any"), lit(","), nonterm("ws_any")]),
      })),
      nonterm("ws_any"), lit(")"),
    ], { name: "pattern_typed" }),
  });

  // Field patterns: `name` (shorthand for `name: name`) or `name: subpattern`
  addProduction(g, { name: "field_pattern",
    rule: alt([
      seq([nonterm("ident"), nonterm("ws"), lit(":"), nonterm("ws"), nonterm("pattern")],
        { name: "field_pattern_renamed" }),
      nonterm("ident"),
    ]),
    attrs: { name: "field_pattern" },
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

  // Lambda: `x => expr`, `x: T => expr`, `(x, y) => expr`, `(x: T, y: U): R => expr`.
  addProduction(g, { name: "lambda",
    rule: alt([
      // Single-param with type: ident : type => expr
      seq([nonterm("ident"), nonterm("ws"), lit(":"), nonterm("ws"), nonterm("type_expr"),
           nonterm("ws"), lit("=>"), nonterm("ws"), nonterm("expr")],
        { name: "lambda1_typed" }),
      // Single-param: ident => expr
      seq([nonterm("ident"), nonterm("ws"), lit("=>"), nonterm("ws"), nonterm("expr")],
        { name: "lambda1" }),
      // Multi-param with optional return type: (typed_params)[: R] => expr
      seq([lit("("), nonterm("ws_any"), nonterm("typed_param_list"), nonterm("ws_any"), lit(")"),
           opt(seq([nonterm("ws"), lit(":"), nonterm("ws"), nonterm("type_expr")])),
           nonterm("ws"), lit("=>"), nonterm("ws"), nonterm("expr")],
        { name: "lambdaN" }),
    ]),
  });

  // --- Type expressions (Phase 2c-4 — simple + generics) ---
  //
  // type_expr = type_expr_union
  // type_expr_union = type_expr_atom ("|" type_expr_atom)*
  // type_expr_atom = ident ("[" type_expr_args "]")? | "{" type_fields "}"
  //
  // For now, just ident-based types with generics. Union and structural are
  // supported. Refinements (`&&`) deferred.

  addProduction(g, { name: "type_expr",
    rule: alt([
      seq([nonterm("type_expr_atom"), nonterm("ws"), lit("|"), nonterm("ws"), nonterm("type_expr")], { name: "type_union" }),
      nonterm("type_expr_atom"),
    ]),
  });

  addProduction(g, { name: "type_expr_atom",
    rule: alt([
      // Structural wrap: ~Type
      seq([lit("~"), nonterm("type_expr_atom")], { name: "type_structural" }),
      // Generic: Name[T, U, ...]
      seq([nonterm("ident"), lit("["), nonterm("ws_any"),
           rep(nonterm("type_expr"), { min: 1, sep: seq([nonterm("ws_any"), lit(","), nonterm("ws_any")]) }),
           nonterm("ws_any"), lit("]")], { name: "type_generic" }),
      // Simple: Name
      nonterm("ident"),
    ]),
  });

  // Typed parameter: `ident` or `ident : type_expr`
  addProduction(g, { name: "typed_param",
    rule: seq([
      nonterm("ident"),
      opt(seq([nonterm("ws"), lit(":"), nonterm("ws"), nonterm("type_expr")])),
    ], { name: "typed_param" }),
  });

  addProduction(g, { name: "typed_param_list",
    rule: opt(rep(nonterm("typed_param"), {
      min: 1,
      sep: seq([nonterm("ws_any"), lit(","), nonterm("ws_any")]),
    })),
  });

  // --- Statements ---

  addProduction(g, { name: "stmt",
    rule: alt([
      // import NAME
      seq([lit("import"), nonterm("ws_req"), nonterm("ident")],
        { name: "import_stmt" }),
      // export NAME(params)[: ret] => body — exported function
      seq([lit("export"), nonterm("ws_req"),
           nonterm("ident"), lit("("), nonterm("ws_any"), nonterm("typed_param_list"),
           nonterm("ws_any"), lit(")"),
           opt(seq([nonterm("ws"), lit(":"), nonterm("ws"), nonterm("type_expr")])),
           nonterm("hws"), lit("=>"),
           nonterm("fn_body")],
        { name: "export_fn_decl" }),
      // export NAME[: type] = expr — exported binding
      seq([lit("export"), nonterm("ws_req"),
           nonterm("ident"),
           opt(seq([nonterm("ws"), lit(":"), nonterm("ws"), nonterm("type_expr")])),
           nonterm("hws"), lit("="), nonterm("fn_body")],
        { name: "export_binding" }),
      // Function def with optional return type: `name(params)[: ret] => body`
      seq([nonterm("ident"), lit("("), nonterm("ws_any"), nonterm("typed_param_list"),
           nonterm("ws_any"), lit(")"),
           opt(seq([nonterm("ws"), lit(":"), nonterm("ws"), nonterm("type_expr")])),
           nonterm("hws"), lit("=>"),
           nonterm("fn_body")],
        { name: "fn_decl" }),
      // Binding with optional type annotation: `name[: type] = expr`
      seq([nonterm("ident"),
           opt(seq([nonterm("ws"), lit(":"), nonterm("ws"), nonterm("type_expr")])),
           nonterm("hws"), lit("="), nonterm("fn_body")],
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
