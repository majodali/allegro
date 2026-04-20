// =============================================================================
// Allegro Grammar 2 — Types
//
// Type definitions for the Phase 0 grammar formalism. See
// docs/grammar-formalism.md for the spec.
//
// Everything here is structural — these TS types mirror the shape of the
// Allegro Context values that users will work with. Primitives in builder.ts
// convert between Allegro values and these TS structures on the way in/out.
// =============================================================================

// --- Terminal matches (what a Terminal rule consumes) ---

export type TerminalMatch =
  | { kind: "literal";     text:      string }                          // exact text
  | { kind: "charClass";   pattern:   string;    compiled: RegExp }     // single-char class, e.g. "[a-z]"
  | { kind: "regex";       pattern:   RegExp }                          // multi-char regex
  | { kind: "eof" }                                                      // end of input
  | { kind: "empty" }                                                    // zero-width success
  | { kind: "fail" }                                                     // always fails
  | { kind: "indent";      directive: IndentDirective };                 // stateful indent terminals

export type IndentDirective = "NEWLINE" | "INDENT" | "DEDENT" | "SAMELINE";

export function lit(text: string): Terminal {
  return { kind: "terminal", match: { kind: "literal", text } };
}

export function cls(pattern: string): Terminal {
  // Single-character class. Compile to an anchored regex so engine matches are O(1).
  const compiled = new RegExp("^(?:" + pattern + ")");
  return { kind: "terminal", match: { kind: "charClass", pattern, compiled } };
}

export function regex(pattern: RegExp | string): Terminal {
  // Normalize to anchored global-free form for consistent exec behavior.
  const source = typeof pattern === "string" ? pattern : pattern.source;
  const flags = typeof pattern === "string" ? "" : pattern.flags.replace(/g/g, "");
  const compiled = new RegExp("^(?:" + source + ")", flags);
  return { kind: "terminal", match: { kind: "regex", pattern: compiled } };
}

export const eof:   Terminal = { kind: "terminal", match: { kind: "eof" } };
export const empty: Terminal = { kind: "terminal", match: { kind: "empty" } };
export const fail:  Terminal = { kind: "terminal", match: { kind: "fail" } };

export function indent(directive: IndentDirective): Terminal {
  return { kind: "terminal", match: { kind: "indent", directive } };
}

// --- Rule union ---

export type Rule =
  | Terminal
  | NonTerm
  | Seq
  | Alt
  | Rep
  | Opt
  | Guarded;

export interface RuleAttrs {
  name?:     string;                         // @name — tags the matched branch
  unwrap?:   boolean;                        // @unwrap — forward child unwrapped
  flatten?:  boolean;                        // @flatten — flatten Rep into parent
  prec?:     string;                         // @prec(level) — precedence name
  assoc?:    "left" | "right" | "none";      // @assoc
  longest?:  boolean;                        // @longest — on Alt
  error?:    string;                         // @error(msg) — error production
  sync?:     boolean;                        // @sync — panic-recovery sync point
  notFollowedBy?: Rule;                      // shortcut for Guarded + NotFollowedBy
  followedBy?:    Rule;                      // shortcut for Guarded + FollowedBy
  reserved?: string;                         // @reserved(set_name)
}

export interface Terminal { kind: "terminal"; match: TerminalMatch; attrs?: RuleAttrs; }
export interface NonTerm  { kind: "nonterm";  name: string;         attrs?: RuleAttrs; }
export interface Seq      { kind: "seq";      items: Rule[];        attrs?: RuleAttrs; }
export interface Alt      { kind: "alt";      options: Rule[];      attrs?: RuleAttrs; }
export interface Rep      {
  kind: "rep";
  item: Rule;
  min: number;
  max: number | null;            // null = unbounded
  sep?: Rule;
  attrs?: RuleAttrs;
}
export interface Opt      { kind: "opt";      item: Rule;           attrs?: RuleAttrs; }

export type Guard =
  | { kind: "notFollowedBy"; rule: Rule }
  | { kind: "followedBy";    rule: Rule }
  | { kind: "reserved";      setName: string };

export interface Guarded {
  kind:   "guarded";
  item:   Rule;
  guard:  Guard;
  attrs?: RuleAttrs;
}

// --- Rule constructor helpers ---

export function nonterm(name: string, attrs?: RuleAttrs): NonTerm {
  return { kind: "nonterm", name, attrs };
}

export function seq(items: Rule[], attrs?: RuleAttrs): Seq {
  return { kind: "seq", items, attrs };
}

export function alt(options: Rule[], attrs?: RuleAttrs): Alt {
  return { kind: "alt", options, attrs };
}

export function rep(
  item: Rule,
  opts?: { min?: number; max?: number | null; sep?: Rule; attrs?: RuleAttrs },
): Rep {
  return {
    kind: "rep",
    item,
    min: opts?.min ?? 0,
    max: opts?.max ?? null,
    sep: opts?.sep,
    attrs: opts?.attrs,
  };
}

export function opt(item: Rule, attrs?: RuleAttrs): Opt {
  return { kind: "opt", item, attrs };
}

export function guarded(item: Rule, guard: Guard, attrs?: RuleAttrs): Guarded {
  return { kind: "guarded", item, guard, attrs };
}

export function notFollowedBy(rule: Rule): Guard {
  return { kind: "notFollowedBy", rule };
}

export function followedBy(rule: Rule): Guard {
  return { kind: "followedBy", rule };
}

export function reserved(setName: string): Guard {
  return { kind: "reserved", setName };
}

// --- Production and Grammar ---

export interface Production {
  name:   string;
  rule:   Rule;
  attrs?: RuleAttrs;
}

/**
 * Precedence constraint between two named levels.
 * Interpretation: `lower` binds looser than `higher`.
 */
export interface PrecedenceConstraint {
  lower:  string;
  higher: string;
}

export interface Grammar {
  productions: Map<string, Production>;
  start:       string;
  reserved:    Map<string, Set<string>>;
  precedence:  {
    constraints: PrecedenceConstraint[];
    /**
     * Computed by the analyzer from `constraints` — maps level name to
     * integer rank (0 = lowest). Undefined until analyze() runs.
     */
    levels?: Map<string, number>;
  };
  meta: Record<string, unknown>;
}

export function makeGrammar(init?: Partial<Grammar>): Grammar {
  return {
    productions: init?.productions ?? new Map(),
    start:       init?.start ?? "",
    reserved:    init?.reserved ?? new Map(),
    precedence:  init?.precedence ?? { constraints: [] },
    meta:        init?.meta ?? {},
  };
}

export function addProduction(grammar: Grammar, production: Production): void {
  if (grammar.productions.has(production.name)) {
    throw new Error(`Production '${production.name}' already defined`);
  }
  grammar.productions.set(production.name, production);
}

export function setStart(grammar: Grammar, name: string): void {
  grammar.start = name;
}

// --- Grammar Delta (extension) ---

export type Operation =
  | { kind: "add";         production: Production }
  | { kind: "append";      alts: Array<{ rule: Rule; attrs?: RuleAttrs }> }
  | { kind: "replace";     rule: Rule; attrs?: RuleAttrs }
  | { kind: "replaceAlt";  selector: Selector; rule: Rule; attrs?: RuleAttrs }
  | { kind: "remove";      selector: Selector }
  | { kind: "wrap";        fn: (g: Grammar) => Grammar };

export type Selector =
  | { kind: "byName";  name:  string }
  | { kind: "byIndex"; index: number };

export interface PrecedenceInsert {
  name:    string;
  before?: string;
  after?:  string;
}

export interface GrammarDelta {
  productions:      Map<string, Operation>;
  reserved:         Map<string, Set<string>>;
  precedence_adds:  PrecedenceInsert[];
  meta:             Record<string, unknown>;
}

export function makeDelta(init?: Partial<GrammarDelta>): GrammarDelta {
  return {
    productions:     init?.productions     ?? new Map(),
    reserved:        init?.reserved        ?? new Map(),
    precedence_adds: init?.precedence_adds ?? [],
    meta:            init?.meta            ?? {},
  };
}

// --- Parse tree output ---

/**
 * A parse tree node. Output of the engine.
 *
 * - `leaf`: a Terminal match. Carries the consumed text and its input range.
 * - `branch`: any composite match. `tag` comes from @name if set. `children`
 *   are in matched order. Range spans from first child's start to last
 *   child's end, or an empty range at the current position if no children.
 * - `none`: a missing Opt match.
 * - `error`: an `@error` production match. Parses succeed for recovery
 *   purposes; downstream passes inspect `message`.
 */
export type ParseTree =
  | { kind: "leaf";   text:     string;       range: SourceRange }
  | { kind: "branch"; tag?:     string;       children: ParseTree[]; range: SourceRange }
  | { kind: "none";   range:    SourceRange }
  | { kind: "error";  message:  string;       inner?: ParseTree;    range: SourceRange };

export interface SourceRange {
  start: number;  // character offset, inclusive
  end:   number;  // character offset, exclusive
}

// --- Source locations (optional, populated when available) ---

export interface SourceLocation {
  file?:   string;
  line:    number;
  column:  number;
}
