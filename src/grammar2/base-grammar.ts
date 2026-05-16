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

// --- Precedence levels (data-driven) ---
//
// The stratified expression grammar used to be 11 hand-written `addProduction`
// blocks threading their tighter neighbours by name. This array holds one
// `LevelSpec` per level instead; `build(selfName, tighterName)` returns the
// Rule for that level given its production name and the name of its tighter
// (higher-precedence) neighbour. The construction loop in `buildBaseGrammar`
// wires the chain in order.
//
// The order here IS the precedence ordering — first entry is loosest, last is
// tightest. Phase 6 grammar extensions can insert new levels by splicing into
// this list (after resolving `above`/`below`/`at` constraints), then rebuilding.
//
// Each level's production name is `expr_${level.name}`. `expr_atom` is the
// innermost level and has no tighter neighbour.

interface LevelSpec {
  name:  string;
  build: (selfName: string, tighterName: string | undefined) => Rule;
}

const LEVELS: LevelSpec[] = [
  // Level 0 — pipe operator `x |> f` (left-associative).
  { name: "pipe", build: (self, tighter) => alt([
      seq([nonterm(self), nonterm("ws"), lit("|>"), nonterm("ws"), nonterm(tighter!)],
        { name: "pipe" }),
      nonterm(tighter!),
    ]) },

  // Level 1 — logical or (`||` and keyword `or`).
  { name: "or", build: (self, tighter) => alt([
      seq([nonterm(self), nonterm("ws"), lit("||"), nonterm("ws"), nonterm(tighter!)], { name: "or" }),
      seq([nonterm(self), nonterm("ws_req"), lit("or"), nonterm("ws_req"), nonterm(tighter!)], { name: "or" }),
      nonterm(tighter!),
    ]) },

  // Level 2 — type/effect conjunction (`&`). Looser than `&&` so refinement
  // predicates absorb logical-AND combinations: `Int & _ > 0 && _ < 100`
  // parses as `Int & ((_ > 0) && (_ < 100))`.
  { name: "amp", build: (self, tighter) => alt([
      seq([nonterm(self), nonterm("ws"), lit("&"), nonterm("ws"), nonterm(tighter!)], { name: "amp" }),
      nonterm(tighter!),
    ]) },

  // Level 3 — logical and (`&&` and keyword `and`).
  { name: "and", build: (self, tighter) => alt([
      seq([nonterm(self), nonterm("ws"), lit("&&"), nonterm("ws"), nonterm(tighter!)], { name: "and" }),
      seq([nonterm(self), nonterm("ws_req"), lit("and"), nonterm("ws_req"), nonterm(tighter!)], { name: "and" }),
      nonterm(tighter!),
    ]) },

  // Level 3 — equality.
  { name: "eq", build: (self, tighter) => leftBinary(self, tighter!, [
      { op: "==", tag: "eq" },
      { op: "!=", tag: "neq" },
    ]) },

  // Level 4 — comparison (ordering + type operators).
  { name: "cmp", build: (self, tighter) => alt([
      seq([nonterm(self), nonterm("ws"), lit("<="), nonterm("ws"), nonterm(tighter!)], { name: "lte" }),
      seq([nonterm(self), nonterm("ws"), lit(">="), nonterm("ws"), nonterm(tighter!)], { name: "gte" }),
      seq([nonterm(self), nonterm("ws"), lit("<"),  nonterm("ws"), nonterm(tighter!)], { name: "lt" }),
      seq([nonterm(self), nonterm("ws"), lit(">"),  nonterm("ws"), nonterm(tighter!)], { name: "gt" }),
      seq([nonterm(self), nonterm("ws_req"), lit("instanceof"), nonterm("ws_req"), nonterm(tighter!)], { name: "instanceof" }),
      seq([nonterm(self), nonterm("ws_req"), lit("subtypeof"),  nonterm("ws_req"), nonterm(tighter!)], { name: "subtypeof" }),
      nonterm(tighter!),
    ]) },

  // Level 5 — additive.
  { name: "add", build: (self, tighter) => leftBinary(self, tighter!, [
      { op: "+", tag: "add" },
      { op: "-", tag: "sub" },
    ]) },

  // Level 6 — multiplicative.
  { name: "mul", build: (self, tighter) => leftBinary(self, tighter!, [
      { op: "*", tag: "mul" },
      { op: "/", tag: "div" },
      { op: "%", tag: "mod" },
    ]) },

  // Level 7a — `<name> of <expr>`: MultiValue component access.
  //   type of x   → mv_get(x, "type")
  //   error of y  → mv_get(y, "error")
  // LHS is syntactically an ident OR the `error` keyword. Non-recursive: only
  // one `of` per chain.
  { name: "of", build: (_self, tighter) => alt([
      seq([nonterm("ident"), nonterm("ws_req"), lit("of"), nonterm("ws_req"), nonterm(tighter!)], { name: "of" }),
      seq([lit("error"),     nonterm("ws_req"), lit("of"), nonterm("ws_req"), nonterm(tighter!)], { name: "of_error" }),
      nonterm(tighter!),
    ]) },

  // Level 7b — unary prefix operators.
  { name: "unary", build: (self, tighter) => alt([
      seq([lit("-"), nonterm(self)], { name: "neg" }),
      seq([lit("!"), nonterm(self)], { name: "not" }),
      seq([lit("error"), nonterm("ws_req"), nonterm(self)], { name: "error_expr" }),
      nonterm(tighter!),
    ]) },

  // Level 8 — postfix: function calls, dot access, bracket indexing.
  // Left-recursive so `f(x).y[0]` parses left-to-right as (((f)(x)).y)[0].
  // `ws` before the opener allows multi-line chains (e.g. `xs\n  .map(f)`).
  // Bracketed contexts use `ws_any` so args/indices may span lines freely.
  { name: "post", build: (self, tighter) => alt([
      seq([nonterm(self), nonterm("ws"), lit("("), nonterm("ws_any"),
           nonterm("args"), nonterm("ws_any"), lit(")")], { name: "call" }),
      seq([nonterm(self), nonterm("ws"), lit("."), nonterm("ws"), nonterm("ident")], { name: "dot" }),
      seq([nonterm(self), nonterm("ws"), lit("["), nonterm("ws_any"),
           nonterm("expr"), nonterm("ws_any"), lit("]")], { name: "bracket" }),
      nonterm(tighter!),
    ]) },

  // Level 9 — atoms. Order matters: float before number (3.14 vs 3), bool and
  // none before ident (they're keywords and would fail ident's reserved guard
  // anyway, but being explicit matches clearly). block_expr is tried first
  // because it needs the INDENT terminal to fire; INDENT can only match if
  // the next content is deeper than the current stack top, so block_expr
  // fails cheaply on non-block inputs.
  { name: "atom", build: (_self, _tighter) => alt([
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
      nonterm("grammar_expr"),          // Phase 6 — `grammar { … }` block.
      nonterm("paren_expr"),
      nonterm("ident"),
    ]) },
];

/**
 * Ordered precedence level names (loosest → tightest). Exported so Phase 6
 * fragment merging can splice in new user-declared levels and rebuild the
 * stratified stack.
 */
export const BASE_LEVEL_NAMES: readonly string[] = LEVELS.map(l => l.name);

/**
 * Map from operator symbol / keyword to the level it lives at in the base
 * grammar. Enables `at("*")` / `above("+")` operator-symbol lookup in
 * precedence specs. Keys cover every user-visible base-grammar operator.
 */
export const BASE_OPERATORS_TO_LEVEL: Readonly<Record<string, string>> = {
  "|>":         "pipe",
  "||":         "or",
  "or":         "or",
  "&":          "amp",
  "&&":         "and",
  "and":        "and",
  "==":         "eq",
  "!=":         "eq",
  "<":          "cmp",
  ">":          "cmp",
  "<=":         "cmp",
  ">=":         "cmp",
  "instanceof": "cmp",
  "subtypeof":  "cmp",
  "+":          "add",
  "-":          "add",
  "*":          "mul",
  "/":          "mul",
  "%":          "mul",
  "of":         "of",
};

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
  // Note: `grammar` is NOT reserved — existing code uses it as a variable /
  // parameter name (see `lib/grammar-analyzer.alg`). The `grammar_expr`
  // atom alternative disambiguates by requiring `{` to follow; if absent,
  // parsing backtracks to `ident` which accepts `grammar` normally.

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
  //
  // Construction is data-driven: LEVELS (module-level) supplies each level's
  // name and rule-builder. Top-level `expr` forwards to the loosest level;
  // each level's production is `expr_${level.name}` and references its tighter
  // neighbour's name via its build function. Level definitions, semantics,
  // and associativity commentary live on each LevelSpec above.
  addProduction(g, { name: "expr",
    rule: nonterm(`expr_${LEVELS[0].name}`),
  });
  for (let i = 0; i < LEVELS.length; i++) {
    const level   = LEVELS[i];
    const self    = `expr_${level.name}`;
    const tighter = i + 1 < LEVELS.length ? `expr_${LEVELS[i + 1].name}` : undefined;
    addProduction(g, { name: self, rule: level.build(self, tighter) });
  }

  // Comma-separated arguments (0 or more) — used by the `call` alternative in
  // the `post` level. Not itself a precedence level.
  addProduction(g, { name: "args",
    rule: opt(spaced_list("expr", ",")),
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

  // Array literal: `[expr, expr, ...]` — zero or more elements, optional
  // trailing comma. Uses ws_any inside so multi-line arrays work.
  addProduction(g, { name: "array_lit",
    rule: seq([
      lit("["),
      nonterm("ws_any"),
      opt(seq([
        rep(nonterm("expr"), {
          min: 1,
          sep: seq([nonterm("ws_any"), lit(","), nonterm("ws_any")]),
        }),
        opt(seq([nonterm("ws_any"), lit(",")])),
      ])),
      nonterm("ws_any"),
      lit("]"),
    ], { name: "array_lit" }),
  });

  // Object literal: `{key: expr, key: expr, ...}`. Keys are identifiers,
  // optional trailing comma. Uses ws_any inside so multi-line objects work.
  addProduction(g, { name: "object_lit",
    rule: seq([
      lit("{"),
      nonterm("ws_any"),
      opt(seq([
        rep(nonterm("object_field"), {
          min: 1,
          sep: seq([nonterm("ws_any"), lit(","), nonterm("ws_any")]),
        }),
        opt(seq([nonterm("ws_any"), lit(",")])),
      ])),
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

  // Body-after-then uses fn_body so an indented block is allowed.
  addProduction(g, { name: "when_case",
    rule: seq([
      lit("is"), nonterm("ws_req"), nonterm("pattern"),
      opt(seq([nonterm("ws_req"), lit("and"), nonterm("ws_req"), nonterm("expr")])),
      nonterm("ws_req"), lit("then"), nonterm("fn_body"),
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

  // if-then-else. Branches use fn_body so they can be indented blocks.
  addProduction(g, { name: "if_expr",
    rule: seq([
      lit("if"),    nonterm("ws_req"),
      nonterm("expr"), nonterm("ws_req"),
      lit("then"),  nonterm("fn_body"), nonterm("ws_req"),
      lit("else"),  nonterm("fn_body"),
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
      // Function type: (T1, T2, …) => R   — Stage E. Right-recursive return
      // (`(A) => (B) => C` parses as `(A) => ((B) => C)`) since the return
      // type is itself `type_expr`. Tried before `type_generic` so the `(`
      // opener is unambiguous; lambda parsing only fires in expression
      // position, never inside a type_expr.
      seq([lit("("), nonterm("ws_any"),
           opt(rep(nonterm("type_expr"), {
             min: 1,
             sep: seq([nonterm("ws_any"), lit(","), nonterm("ws_any")]),
           })),
           nonterm("ws_any"), lit(")"),
           nonterm("ws"), lit("=>"), nonterm("ws"), nonterm("type_expr")],
        { name: "type_function" }),
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

  // Generic parameter: `T` or `T : Kind`. Kind defaults to Type when absent.
  // Used in function declarations: `name[T, e: Effect](params) => body`.
  addProduction(g, { name: "generic_param",
    rule: seq([
      nonterm("ident"),
      opt(seq([nonterm("ws"), lit(":"), nonterm("ws"), nonterm("type_expr")])),
    ], { name: "generic_param" }),
  });

  addProduction(g, { name: "generic_param_list",
    rule: rep(nonterm("generic_param"), {
      min: 1,
      sep: seq([nonterm("ws_any"), lit(","), nonterm("ws_any")]),
    }),
  });

  // Optional bracket-wrapped generic-param section (after the function name,
  // before the `(`). Disambiguated from expression-level indexing by the
  // declaration position — only `name[…](` matches this production.
  addProduction(g, { name: "generic_decl",
    rule: seq([
      lit("["), nonterm("ws_any"), nonterm("generic_param_list"),
      nonterm("ws_any"), lit("]"),
    ], { name: "generic_decl" }),
  });

  // --- Statements ---

  addProduction(g, { name: "stmt",
    rule: alt([
      // Phase F1 — provability surface. `theorem`/`verify` are core to
      // Allegro's defining feature, so they live in the base grammar (not
      // an opt-in lib extension). Tried before binding/fn_decl/expr so the
      // leading keyword wins; they are NOT reserved words — `theorem` /
      // `verify` as ordinary identifiers still parse via backtracking to
      // `binding` / `expr` (same approach as the `grammar` atom).
      //
      // theorem NAME: <prop>  — named, referenceable proof binding
      seq([lit("theorem"), nonterm("ws_req"),
           nonterm("ident"),
           nonterm("ws"), lit(":"), nonterm("ws"), nonterm("expr")],
        { name: "theorem_decl" }),
      // verify <prop>  — anonymous, one-shot proof by evaluation
      seq([lit("verify"), nonterm("ws_req"), nonterm("expr")],
        { name: "verify_stmt" }),
      // import NAME
      seq([lit("import"), nonterm("ws_req"), nonterm("ident")],
        { name: "import_stmt" }),
      // export NAME[generic_decl](params)[: ret] => body — exported function
      seq([lit("export"), nonterm("ws_req"),
           nonterm("ident"),
           opt(nonterm("generic_decl")),
           lit("("), nonterm("ws_any"), nonterm("typed_param_list"),
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
      // Function def with optional generic params + optional return type:
      // `name[generic_decl](params)[: ret] => body`
      seq([nonterm("ident"),
           opt(nonterm("generic_decl")),
           lit("("), nonterm("ws_any"), nonterm("typed_param_list"),
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

  // --- Phase 6: grammar { … } blocks ---
  //
  // The `grammar` keyword introduces a grammar-building expression. Inside
  // braces, a sequence of declarations (infix / prefix / postfix /
  // expr_prefix in step 3's subset) compile to calls on a fresh fragment
  // accumulator. The tree-builder chains them into primitive-call
  // expressions; at evaluation the fragment is finalized into a Grammar
  // value.
  //
  // Step 3 parses only the Phase 1-equivalent forms. Step 5 adds `prec(X)`
  // named levels and combined `above(X) below(Y)` precedence clauses; step
  // 6 adds `rule NAME = …` and the `expr_form` / `stmt_form` multi-token
  // shapes with the EBNF mini-grammar.

  // grammar_expr accepts three shapes:
  //   grammar { … }                 — default extends allegro
  //   new grammar { … }             — fresh, no base (extends empty)
  //   grammar extends X { … }       — explicit base (X is an ident)
  addProduction(g, { name: "grammar_expr",
    rule: alt([
      seq([
        lit("new"), nonterm("ws_req"), lit("grammar"),
        nonterm("ws"), lit("{"), nonterm("ws_any"),
        nonterm("grammar_body"), nonterm("ws_any"), lit("}"),
      ], { name: "grammar_expr_new" }),
      seq([
        lit("grammar"), nonterm("ws_req"), lit("extends"), nonterm("ws_req"),
        nonterm("ident"),
        nonterm("ws"), lit("{"), nonterm("ws_any"),
        nonterm("grammar_body"), nonterm("ws_any"), lit("}"),
      ], { name: "grammar_expr_extends" }),
      seq([
        lit("grammar"),
        nonterm("ws"), lit("{"), nonterm("ws_any"),
        nonterm("grammar_body"), nonterm("ws_any"), lit("}"),
      ], { name: "grammar_expr" }),
    ]),
  });

  // grammar_body = (ws_any grammar_decl)*
  // `ws_any` before each decl consumes newlines between declarations inside
  // braces. Each decl's keyword starts with `infix`/`prefix`/`postfix`/
  // `expr_prefix`, which unambiguously signal the decl alternative.
  addProduction(g, { name: "grammar_body",
    rule: rep(seq([nonterm("ws_any"), nonterm("grammar_decl")]), { min: 0 }),
  });

  addProduction(g, { name: "grammar_decl",
    rule: alt([
      nonterm("infix_decl"),
      nonterm("prefix_decl"),
      nonterm("postfix_decl"),
      nonterm("expr_prefix_decl"),
      nonterm("rule_decl"),           // Phase 6b: user sub-rule
      nonterm("expr_form_decl"),      // Phase 6b: multi-token expression form
      nonterm("stmt_form_decl"),      // Phase 6b: multi-token statement form
    ]),
  });

  // infix_decl = "infix" ws_req string ws prec_spec ws (assoc ws)? "=>" ws expr
  addProduction(g, { name: "infix_decl",
    rule: seq([
      lit("infix"),
      nonterm("ws_req"),
      nonterm("string"),
      nonterm("ws_req"),
      nonterm("prec_spec"),
      nonterm("ws"),
      opt(seq([nonterm("assoc"), nonterm("ws")])),
      lit("=>"),
      nonterm("ws"),
      nonterm("expr"),
    ], { name: "infix_decl" }),
  });

  // prefix_decl = "prefix" ws_req string ws_req prec_spec ws "=>" ws expr
  addProduction(g, { name: "prefix_decl",
    rule: seq([
      lit("prefix"),
      nonterm("ws_req"),
      nonterm("string"),
      nonterm("ws_req"),
      nonterm("prec_spec"),
      nonterm("ws"),
      lit("=>"),
      nonterm("ws"),
      nonterm("expr"),
    ], { name: "prefix_decl" }),
  });

  // postfix_decl = "postfix" ws_req string ws_req prec_spec ws "=>" ws expr
  addProduction(g, { name: "postfix_decl",
    rule: seq([
      lit("postfix"),
      nonterm("ws_req"),
      nonterm("string"),
      nonterm("ws_req"),
      nonterm("prec_spec"),
      nonterm("ws"),
      lit("=>"),
      nonterm("ws"),
      nonterm("expr"),
    ], { name: "postfix_decl" }),
  });

  // expr_prefix_decl = "expr_prefix" ws_req string ws "=>" ws expr
  addProduction(g, { name: "expr_prefix_decl",
    rule: seq([
      lit("expr_prefix"),
      nonterm("ws_req"),
      nonterm("string"),
      nonterm("ws"),
      lit("=>"),
      nonterm("ws"),
      nonterm("expr"),
    ], { name: "expr_prefix_decl" }),
  });

  // prec_spec = prec_form (ws prec_form)*
  // A prec_spec is one or more forms. Examples:
  //   at(mul)
  //   prec(pow) above(mul) below(unary)
  //   above("*")                                  // lookup by operator symbol
  addProduction(g, { name: "prec_spec",
    rule: rep(nonterm("prec_form"), { min: 1, sep: nonterm("ws") }),
  });

  addProduction(g, { name: "prec_form",
    rule: alt([
      seq([lit("at"),    nonterm("ws"), lit("("), nonterm("ws"), nonterm("prec_target"), nonterm("ws"), lit(")")], { name: "prec_at" }),
      seq([lit("above"), nonterm("ws"), lit("("), nonterm("ws"), nonterm("prec_target"), nonterm("ws"), lit(")")], { name: "prec_above" }),
      seq([lit("below"), nonterm("ws"), lit("("), nonterm("ws"), nonterm("prec_target"), nonterm("ws"), lit(")")], { name: "prec_below" }),
      seq([lit("prec"),  nonterm("ws"), lit("("), nonterm("ws"), nonterm("prec_target"), nonterm("ws"), lit(")")], { name: "prec_named" }),
    ]),
  });

  // prec_target: an identifier (level name) OR a literal string (operator
  // symbol lookup). Interpolated strings are not supported here.
  addProduction(g, { name: "prec_target",
    rule: alt([
      nonterm("ident"),
      nonterm("string"),
    ]),
  });

  // Associativity keyword: literal matches are context-sensitive so `left`
  // and `right` remain usable as identifiers elsewhere.
  addProduction(g, { name: "assoc",
    rule: alt([
      lit("left"),
      lit("right"),
      lit("none"),
    ]),
  });

  // --- Phase 6b: user rules and multi-token forms ---
  //
  // rule_decl:      adds a user-named production to the grammar, or appends
  //                 an alternative to an existing production (`+=`). The
  //                 body is an EBNF expression; the `=> template` is a
  //                 ComposedFunction whose positional Params match the
  //                 order of labeled parts in the body.
  //
  // expr_form_decl: adds a new multi-token expression alternative (e.g.
  //                 `match x with p => e | …`). The body is a seq of EBNF
  //                 parts, at least some of which are labeled.
  //
  // stmt_form_decl: same but for statement-level forms (`for x in xs: body`).

  // rule_decl shapes:
  //   rule NAME = body => template       (add / replace whole production)
  //   rule NAME += body => template      (append alternative)
  //   rule NAME[ALT] = body => template  (replace specific alternative — 7c)
  //   rule NAME -= ALT                   (remove alternative — 7c, no template)
  addProduction(g, { name: "rule_decl",
    rule: alt([
      // rule NAME -= ALT  (remove alternative, no template)
      seq([
        lit("rule"), nonterm("ws_req"), nonterm("ident"),
        nonterm("ws"), lit("-="), nonterm("ws_req"), nonterm("ident"),
      ], { name: "rule_remove" }),
      // rule NAME[ALT] = body => template
      seq([
        lit("rule"), nonterm("ws_req"), nonterm("ident"),
        nonterm("ws"), lit("["), nonterm("ws"), nonterm("ident"), nonterm("ws"), lit("]"),
        nonterm("ws"), lit("="), nonterm("ws"), nonterm("ebnf_body"),
        nonterm("ws"), lit("=>"), nonterm("ws"), nonterm("expr"),
      ], { name: "rule_replace_alt" }),
      // rule NAME = body => template / rule NAME += body => template
      seq([
        lit("rule"), nonterm("ws_req"), nonterm("ident"),
        nonterm("ws"),
        alt([
          seq([lit("+="), nonterm("ws"), nonterm("ebnf_body")], { name: "rule_append" }),
          seq([lit("="),  nonterm("ws"), nonterm("ebnf_body")], { name: "rule_replace_or_add" }),
        ]),
        nonterm("ws"), lit("=>"), nonterm("ws"), nonterm("expr"),
      ], { name: "rule_decl" }),
    ]),
  });

  addProduction(g, { name: "expr_form_decl",
    rule: seq([
      lit("expr_form"),
      nonterm("ws_req"),
      nonterm("ebnf_body"),
      nonterm("ws"),
      lit("=>"),
      nonterm("ws"),
      nonterm("expr"),
    ], { name: "expr_form_decl" }),
  });

  addProduction(g, { name: "stmt_form_decl",
    rule: seq([
      lit("stmt_form"),
      nonterm("ws_req"),
      nonterm("ebnf_body"),
      nonterm("ws"),
      lit("=>"),
      nonterm("ws"),
      nonterm("expr"),
    ], { name: "stmt_form_decl" }),
  });

  // --- EBNF mini-grammar ---
  //
  // Precedence (low → high):
  //   alt   — `a | b`
  //   seq   — juxtaposition `a b c`
  //   label — `name:atom` (bound tight around one element)
  //   post  — `a*` `a+` `a?`
  //   sep   — `a ** sep`
  //   atom  — `"lit"`, `/regex/`, ident, `(…)`
  //
  // Whitespace inside EBNF bodies is `ws_any`-style (newlines allowed), so
  // multi-line rules work out of the box inside a grammar { } block.

  addProduction(g, { name: "ebnf_body",
    rule: nonterm("ebnf_alt"),
    attrs: { name: "ebnf_body" },       // force tag so tree-builder can find it
  });

  addProduction(g, { name: "ebnf_alt",
    rule: alt([
      seq([nonterm("ebnf_seq"), nonterm("ws_any"),
           rep(seq([lit("|"), nonterm("ws_any"), nonterm("ebnf_seq"), nonterm("ws_any")], { name: "ebnf_alt_tail" }), { min: 1 })],
        { name: "ebnf_alt" }),
      nonterm("ebnf_seq"),
    ]),
  });

  addProduction(g, { name: "ebnf_seq",
    rule: rep(nonterm("ebnf_elem"), { min: 1, sep: nonterm("ws_any") }),
  });

  addProduction(g, { name: "ebnf_elem",
    rule: alt([
      nonterm("ebnf_labeled"),
      nonterm("ebnf_post"),
    ]),
  });

  // label binds tighter than postfix; `s:a*` = `s:(a*)` per the rule shape.
  addProduction(g, { name: "ebnf_labeled",
    rule: seq([nonterm("ident"), lit(":"), nonterm("ebnf_post")],
      { name: "ebnf_labeled" }),
  });

  addProduction(g, { name: "ebnf_post",
    rule: alt([
      seq([nonterm("ebnf_sep"), lit("*")], { name: "ebnf_star" }),
      seq([nonterm("ebnf_sep"), lit("+")], { name: "ebnf_plus" }),
      seq([nonterm("ebnf_sep"), lit("?")], { name: "ebnf_opt" }),
      nonterm("ebnf_sep"),
    ]),
  });

  addProduction(g, { name: "ebnf_sep",
    rule: alt([
      seq([nonterm("ebnf_atom"), nonterm("ws_any"), lit("**"), nonterm("ws_any"), nonterm("ebnf_atom")],
        { name: "ebnf_sep_rep" }),
      nonterm("ebnf_atom"),
    ]),
  });

  addProduction(g, { name: "ebnf_atom",
    rule: alt([
      seq([lit("("), nonterm("ws_any"), nonterm("ebnf_alt"), nonterm("ws_any"), lit(")")],
        { name: "ebnf_group" }),
      nonterm("string"),                     // string literal → lit(…)
      nonterm("ebnf_regex"),
      nonterm("ident"),                      // bare ident → nonterm(name)
    ]),
  });

  // Regex literal: `/pattern/` — simple match-anything-but-slash-or-newline
  // in step 6b. Escapes and flags come later if needed.
  addProduction(g, { name: "ebnf_regex",
    rule: seq([
      lit("/"),
      regex(/[^\/\n]+/),
      lit("/"),
    ], { name: "ebnf_regex" }),
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
