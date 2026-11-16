// The grammar of Allegretto (B-196 (the rebuild's acceptance side), chunk
// Q5 (the first notation and the bootstrap), part 2), as
// next/ext/allegretto/forms.md §5 states it: the present tree's base
// grammar with the standard language's productions removed, and five
// added.
//
// The one file of the new tree that reaches the present tree. It uses the
// present parser engine and nothing else of the present tree: no tree
// builder, no evaluator. The exports it uses:
//   - `buildLeftRecursiveBaseGrammar`, `ladderLevels`
//                                 src/grammar2/base-grammar.ts
//   - `getBaseGrammar`            src/grammar2/base-grammar.ts, read
//                                 only, by the census
//                                 (next/bootstrap/census.ts), to see what
//                                 a present text uses
//   - `parse`                     src/grammar2/engine.ts
//   - `lit`, `regex`, `nonterm`, `seq`, `alt`, `rep`, `opt`
//                                 src/grammar2/types.ts, the grammar
//                                 constructors
// The import is dynamic, by a computed path, so the new tree's typecheck
// does not compile the present tree. The boundary is typed by the shapes
// below, which are what this file reads and writes of a present grammar
// value. The present tree is not changed.
//
// How the grammar is made. `buildLeftRecursiveBaseGrammar` returns a new
// value on every call, in the specification form that the present
// tree's own grammar extension edits (src/grammar2/fragments.ts). This
// file edits that value: it removes productions and alternatives by name,
// adds productions built with the engine's own constructors, and then has
// `ladderLevels` rewrite the precedence levels, as the present tree does
// after its edits. The shared value `getBaseGrammar` returns is never
// touched. After the edits every production still referred to must exist,
// and every removed one must be unreferenced; `allegrettoGrammar` checks
// both and throws otherwise, so a change in the present base grammar
// shows here as an error and never as a silently different grammar.
//
// What it keeps of the base grammar: whitespace and comments, the
// literals (texts without interpolation), names, lambdas without types,
// function bindings and bindings without types, `export`, `import`,
// application, the pipe, `.` and `[ ]`, `if then else`, the logical,
// comparison and arithmetic operators, structure and list literals,
// parentheses and indented blocks. It keeps the keyword forms `and` and
// `or` and the binary number `0b…`, which forms.md §5 does not list for
// removal; the reader refuses them, since forms.md §2 gives them no
// meaning.
//
// What it removes (forms.md §5): type annotations and type expressions,
// typed parameters and return types, generics, `when` and patterns,
// `theorem` and `verify`, the `grammar` block and its declarations, `&`
// on types, `instanceof` and `subtypeof`, `Y of x`, `error`, `none`, and
// text interpolation. The keywords of the removed forms stay reserved, so
// `none`, `error x`, `when`, `x instanceof T` and `type of x` are refused
// by the parse and never read as names. A text may not hold `{`: with
// interpolation removed, `"a{x}"` is refused rather than read as the
// characters `a{x}`, which would give a present text a different meaning.
//
// What it adds (forms.md §5 and §6): the symbol literal `` `name ``; `++`,
// on a level of its own between the comparisons and `+`; the statement
// `x <- e`; and the header lines `capability NAME` and `input NAME`, as
// statements beside `import NAME`. The reader checks that header lines
// come first. And one change forms.md §5 does not list: `then` is no
// longer reserved, since forms.md §2 binds the kernel primitive `then` to
// that name; the word of `if c then a else b` still reads as before.
//
// The precedence, loosest first, is forms.md's: `|>`; `||`; `&&`; `==`
// `!=`; `<` `>` `<=` `>=`; `++`; `+` `-`; `*` `/` `%`; prefix `-` `!`;
// application, `.` and `[ ]`. All binary operators group to the left.

// ── The present grammar value, as this file reads and writes it ────────

/** A grammar rule (src/grammar2/types.ts `Rule`), as far as this file reads it. */
export type Rule =
  | { readonly kind: "terminal"; readonly match: unknown; attrs?: RuleAttrs }
  | { readonly kind: "nonterm"; readonly name: string; attrs?: RuleAttrs }
  | { readonly kind: "seq"; readonly items: Rule[]; attrs?: RuleAttrs }
  | { readonly kind: "alt"; readonly options: Rule[]; attrs?: RuleAttrs }
  | { readonly kind: "rep"; readonly item: Rule; readonly sep?: Rule; attrs?: RuleAttrs }
  | { readonly kind: "opt"; readonly item: Rule; attrs?: RuleAttrs }
  | { readonly kind: "guarded"; readonly item: Rule; readonly guard: { readonly rule?: Rule }; attrs?: RuleAttrs };

interface RuleAttrs {
  name?: string;
}

interface Production {
  readonly name: string;
  rule: Rule;
  readonly attrs?: RuleAttrs;
}

/** A grammar value (src/grammar2/types.ts `Grammar`), as far as this file reads it. */
export interface Grammar {
  readonly productions: Map<string, Production>;
  readonly start: string;
  readonly reserved: Map<string, Set<string>>;
}

/** The engine's parse tree (src/grammar2/types.ts `ParseTree`). */
export type ParseTree =
  | { readonly kind: "leaf"; readonly text: string; readonly range: SourceRange }
  | { readonly kind: "branch"; readonly tag?: string; readonly children: readonly ParseTree[]; readonly range: SourceRange }
  | { readonly kind: "none"; readonly range: SourceRange }
  | { readonly kind: "error"; readonly message: string; readonly range: SourceRange };

export interface SourceRange {
  readonly start: number;
  readonly end: number;
}

export type ParseResult =
  | { readonly ok: true; readonly tree: ParseTree }
  | { readonly ok: false; readonly error: { readonly position: number; readonly message: string } };

interface Present {
  buildLeftRecursiveBaseGrammar(): Grammar;
  getBaseGrammar(): Grammar;
  ladderLevels(g: Grammar): void;
  parse(g: Grammar, input: string): ParseResult;
  lit(text: string): Rule;
  regex(pattern: RegExp): Rule;
  nonterm(name: string): Rule;
  seq(items: Rule[], attrs?: RuleAttrs): Rule;
  alt(options: Rule[], attrs?: RuleAttrs): Rule;
  rep(item: Rule, opts?: { min?: number; sep?: Rule }): Rule;
  opt(item: Rule): Rule;
}

const SRC = new URL("../../src/grammar2/", import.meta.url);
const load = async (file: string): Promise<Record<string, unknown>> => (await import(new URL(file, SRC).href)) as Record<string, unknown>;
const [baseModule, engineModule, typesModule] = await Promise.all([load("base-grammar.js"), load("engine.js"), load("types.js")]);
const present = {
  buildLeftRecursiveBaseGrammar: baseModule.buildLeftRecursiveBaseGrammar,
  getBaseGrammar: baseModule.getBaseGrammar,
  ladderLevels: baseModule.ladderLevels,
  parse: engineModule.parse,
  lit: typesModule.lit,
  regex: typesModule.regex,
  nonterm: typesModule.nonterm,
  seq: typesModule.seq,
  alt: typesModule.alt,
  rep: typesModule.rep,
  opt: typesModule.opt,
} as Present;
for (const [name, f] of Object.entries(present))
  if (typeof f !== "function") throw new Error(`the present tree no longer exports ${name}`);

// ── The edits ─────────────────────────────────────────────────────────

/** The productions of the standard language, removed whole (forms.md §5). */
export const REMOVED_PRODUCTIONS: readonly string[] = [
  // `&` on types, and `Y of x`: two precedence levels.
  "expr_amp", "expr_of",
  // `when` and patterns.
  "when_expr", "when_case", "pattern", "pattern_wildcard", "pattern_number", "pattern_string", "pattern_bool", "pattern_none",
  "pattern_ident", "pattern_struct", "pattern_typed", "field_pattern",
  // `none`.
  "none_lit",
  // Type expressions, typed parameters, generics.
  "type_expr", "type_expr_atom", "typed_param", "typed_param_list", "generic_param", "generic_param_list", "generic_decl",
  // Text interpolation.
  "string_interp",
  // The `grammar` block and its declarations.
  "grammar_expr", "grammar_body", "grammar_decl", "infix_decl", "prefix_decl", "postfix_decl", "expr_prefix_decl", "prec_spec",
  "prec_form", "prec_target", "assoc", "rule_decl", "expr_form_decl", "stmt_form_decl", "ebnf_body", "ebnf_alt", "ebnf_seq",
  "ebnf_elem", "ebnf_labeled", "ebnf_post", "ebnf_sep", "ebnf_atom", "ebnf_regex",
];

/** Alternatives removed from a production that stays, by the production and the alternative's tag. */
export const REMOVED_ALTERNATIVES: ReadonlyArray<readonly [production: string, tag: string]> = [
  ["expr_cmp", "instanceof"],
  ["expr_cmp", "subtypeof"],
  ["expr_unary", "error_expr"],
  ["lambda", "lambda1_typed"],
  ["stmt", "theorem_decl"],
  ["stmt", "verify_stmt"],
];

/** Every name a rule refers to. */
function references(rule: Rule, out: Set<string>): Set<string> {
  switch (rule.kind) {
    case "nonterm":
      out.add(rule.name);
      break;
    case "seq":
      rule.items.forEach((r) => references(r, out));
      break;
    case "alt":
      rule.options.forEach((r) => references(r, out));
      break;
    case "rep":
      references(rule.item, out);
      if (rule.sep !== undefined) references(rule.sep, out);
      break;
    case "opt":
      references(rule.item, out);
      break;
    case "guarded":
      references(rule.item, out);
      if (rule.guard.rule !== undefined) references(rule.guard.rule, out);
      break;
    case "terminal":
      break;
  }
  return out;
}

/** The rule with every reference to `from` made a reference to `to`. Shares what it does not change. */
function retarget(rule: Rule, from: string, to: string): Rule {
  switch (rule.kind) {
    case "nonterm":
      return rule.name === from ? { ...rule, name: to } : rule;
    case "seq":
      return { ...rule, items: rule.items.map((r) => retarget(r, from, to)) };
    case "alt":
      return { ...rule, options: rule.options.map((r) => retarget(r, from, to)) };
    case "rep":
      return { ...rule, item: retarget(rule.item, from, to), ...(rule.sep === undefined ? {} : { sep: retarget(rule.sep, from, to) }) };
    case "opt":
      return { ...rule, item: retarget(rule.item, from, to) };
    case "guarded":
      return { ...rule, item: retarget(rule.item, from, to) };
    case "terminal":
      return rule;
  }
}

function production(g: Grammar, name: string): Production {
  const p = g.productions.get(name);
  if (p === undefined) throw new Error(`the present base grammar has no production ${name}`);
  return p;
}

function options(g: Grammar, name: string): Rule[] {
  const r = production(g, name).rule;
  if (r.kind !== "alt") throw new Error(`the production ${name} of the present base grammar is not a choice`);
  return r.options;
}

/** Replaces the alternative tagged `tag` of a choice, or removes it where `by` is undefined. */
function editAlternative(g: Grammar, name: string, tag: string, by: Rule | undefined): void {
  const all = options(g, name);
  const i = all.findIndex((o) => o.attrs?.name === tag);
  if (i < 0) throw new Error(`the production ${name} of the present base grammar has no alternative ${tag}`);
  const p = production(g, name);
  const kept = by === undefined ? [...all.slice(0, i), ...all.slice(i + 1)] : [...all.slice(0, i), by, ...all.slice(i + 1)];
  p.rule = present.alt(kept, p.rule.attrs);
}

function insertAlternative(g: Grammar, name: string, beforeTag: string | undefined, rule: Rule, beforeName?: string): void {
  const all = options(g, name);
  const i = all.findIndex((o) => (beforeTag !== undefined ? o.attrs?.name === beforeTag : o.kind === "nonterm" && o.name === beforeName));
  if (i < 0) throw new Error(`the production ${name} of the present base grammar has no alternative ${beforeTag ?? beforeName}`);
  const p = production(g, name);
  p.rule = present.alt([...all.slice(0, i), rule, ...all.slice(i)], p.rule.attrs);
}

function removeOption(g: Grammar, name: string, nontermName: string): void {
  const all = options(g, name);
  const i = all.findIndex((o) => o.kind === "nonterm" && o.name === nontermName);
  if (i < 0) throw new Error(`the production ${name} of the present base grammar has no alternative ${nontermName}`);
  const p = production(g, name);
  p.rule = present.alt([...all.slice(0, i), ...all.slice(i + 1)], p.rule.attrs);
}

function addProduction(g: Grammar, name: string, rule: Rule): void {
  if (g.productions.has(name)) throw new Error(`the present base grammar already has a production ${name}`);
  g.productions.set(name, { name, rule });
}

/** Builds Allegretto's grammar: a new value on every call, never shared with the present tree. */
export function allegrettoGrammar(): Grammar {
  const { lit, regex, nonterm, seq, alt, rep, opt } = present;
  const g = present.buildLeftRecursiveBaseGrammar();
  const ws = nonterm("ws");
  const wsAny = nonterm("ws_any");
  const commaList = (item: string): Rule => rep(nonterm(item), { min: 1, sep: seq([wsAny, lit(","), wsAny]) });

  // The two levels removed: their neighbours are joined.
  for (const [name, p] of g.productions) {
    p.rule = retarget(retarget(p.rule, "expr_amp", "expr_and"), "expr_of", "expr_unary");
    g.productions.set(name, p);
  }
  for (const [name, tag] of REMOVED_ALTERNATIVES) editAlternative(g, name, tag, undefined);
  for (const atom of ["when_expr", "none_lit", "grammar_expr"]) removeOption(g, "expr_atom", atom);

  // Text without interpolation: `{` is no part of a text.
  production(g, "string").rule = seq([lit("\""), rep(alt([nonterm("string_chars"), nonterm("string_escape")]), { min: 0 }), lit("\"")]);

  // Parameters without types.
  addProduction(g, "param_list", opt(commaList("ident")));
  editAlternative(g, "lambda", "lambdaN",
    seq([lit("("), wsAny, nonterm("param_list"), wsAny, lit(")"), ws, lit("=>"), ws, nonterm("expr")], { name: "lambdaN" }));
  const fnDecl = (lead: Rule[], tag: string): Rule =>
    seq([...lead, nonterm("ident"), lit("("), wsAny, nonterm("param_list"), wsAny, lit(")"), nonterm("hws"), lit("=>"), nonterm("fn_body")], { name: tag });
  const binding = (lead: Rule[], tag: string): Rule => seq([...lead, nonterm("ident"), nonterm("hws"), lit("="), nonterm("fn_body")], { name: tag });
  const exported = [lit("export"), nonterm("ws_req")];
  editAlternative(g, "stmt", "export_fn_decl", fnDecl(exported, "export_fn_decl"));
  editAlternative(g, "stmt", "export_binding", binding(exported, "export_binding"));
  editAlternative(g, "stmt", "fn_decl", fnDecl([], "fn_decl"));
  editAlternative(g, "stmt", "binding", binding([], "binding"));

  for (const name of REMOVED_PRODUCTIONS) {
    if (!g.productions.delete(name)) throw new Error(`the present base grammar has no production ${name}`);
  }

  // The five added.
  // 1. The symbol literal, tried before a name.
  addProduction(g, "symbol_lit", seq([lit("`"), nonterm("ident")], { name: "symbol_lit" }));
  insertAlternative(g, "expr_atom", undefined, nonterm("symbol_lit"), "ident");
  // 2. `++`, a level of its own between the comparisons and `+`.
  addProduction(g, "expr_join", alt([seq([nonterm("expr_join"), ws, lit("++"), ws, nonterm("expr_add")], { name: "join" }), nonterm("expr_add")]));
  production(g, "expr_cmp").rule = retarget(production(g, "expr_cmp").rule, "expr_add", "expr_join");
  // 3. The statement `x <- e`, tried before a bare expression, where it would read as `x < -e`.
  insertAlternative(g, "stmt", undefined, seq([nonterm("ident"), nonterm("hws"), lit("<-"), nonterm("fn_body")], { name: "arrow_binding" }), "expr");
  // 4 and 5. The header lines `capability NAME` and `input NAME`, beside `import NAME`.
  insertAlternative(g, "stmt", "export_fn_decl", seq([lit("capability"), nonterm("ws_req"), nonterm("ident")], { name: "capability_decl" }));
  insertAlternative(g, "stmt", "export_fn_decl", seq([lit("input"), nonterm("ws_req"), nonterm("ident")], { name: "input_decl" }));

  // `then` is a name as well as the word of `if c then a else b`: forms.md §2 binds the kernel
  // primitive to it. The base grammar reserves it; nothing reads it as a name where the word is due.
  const keywords = g.reserved.get("keywords");
  if (keywords === undefined || !keywords.delete("then")) throw new Error("the present base grammar does not reserve then");

  // Every reference resolves, and nothing removed is still referred to.
  const referred = new Set<string>([g.start]);
  for (const p of g.productions.values()) references(p.rule, referred);
  for (const name of referred) if (!g.productions.has(name)) throw new Error(`Allegretto's grammar refers to ${name}, which it does not have`);

  present.ladderLevels(g);
  // The ladder kept a level as specified only where it could not show the two parse alike; none of these may stay so.
  for (const level of ["expr_pipe", "expr_or", "expr_and", "expr_eq", "expr_cmp", "expr_join", "expr_add", "expr_mul", "expr_post"]) {
    const r = production(g, level).rule;
    if (r.kind === "alt" && r.options.some((o) => o.kind === "seq" && o.items[0]?.kind === "nonterm" && o.items[0].name === level))
      throw new Error(`the level ${level} of Allegretto's grammar is still left-recursive`);
  }
  return g;
}

let cached: Grammar | undefined;

/** Has the present parser engine read a text with Allegretto's grammar. */
export function parseAllegretto(text: string): ParseResult {
  cached ??= allegrettoGrammar();
  return present.parse(cached, text);
}

const TYPED = new Set(["binding", "export_binding", "fn_decl", "export_fn_decl", "typed_param", "lambdaN"]);

/**
 * The tags of the parse tree the present base grammar gives a text, or
 * undefined where it does not parse. For the census: which forms of the
 * present surface a text uses. A type annotation, which has no tag of its
 * own, is added as the tag "type annotation". The present grammar value is
 * read, never changed.
 */
export function presentTags(text: string): Set<string> | undefined {
  const r = present.parse(present.getBaseGrammar(), text);
  if (!r.ok) return undefined;
  const tags = new Set<string>();
  const walk = (t: ParseTree): void => {
    if (t.kind !== "branch") return;
    if (t.tag !== undefined) tags.add(t.tag);
    // A type annotation has no tag of its own: it is the `: T` part of one of these.
    if (t.tag !== undefined && TYPED.has(t.tag) && t.children.some((c) => c.kind === "branch" && c.tag === undefined && c.children.some((d) => d.kind === "leaf" && d.text === ":")))
      tags.add("type annotation");
    t.children.forEach(walk);
  };
  walk(r.tree);
  return tags;
}

/** The tag the ladder gives a level's node (src/grammar2/base-grammar.ts `LADDER_TAG`). */
export const LADDER_TAG: string = String(baseModule.LADDER_TAG);
