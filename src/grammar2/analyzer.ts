// =============================================================================
// Allegro Grammar 2 — Static Analyzer
//
// Implements the required checks from docs/grammar-formalism.md §7:
//   - Reachability: every production must be reachable from start
//   - Defined-ness: every NonTerm(name) must resolve to a production
//   - Nullability: which productions can derive the empty string
//   - FIRST sets: first character(s) that can start each production
//   - Alternative disjointness: no two alts of the same Alt can match the
//     same input (WARN for now; would be ERROR with proper @prec annotations)
//   - Left recursion: classified and reported (allowed by engine)
//   - Infinite loop: Rep of nullable item with no separator
//   - Reservation consistency: every @reserved(name) must reference a set
//
// Runs once per unique Grammar identity; results cached.
// =============================================================================

import { Grammar, Rule, Production, Guard } from "./types.js";

// --- Report shape ---

export interface GrammarError {
  code:    string;                // e.g. "E_UNDEFINED_NAME"
  message: string;
  production?: string;
  rule?:       Rule;
}

export interface GrammarWarning {
  code:    string;
  message: string;
  production?: string;
}

export interface GrammarReport {
  errors:    GrammarError[];
  warnings:  GrammarWarning[];
  nullable:  Set<string>;         // production names that can derive empty
  first:     Map<string, FirstSet>; // production name → FIRST set
  leftRec:   Set<string>;         // production names with direct left recursion
}

/**
 * A FIRST set is a collection of character-level predicates representing
 * the possible first characters of the production's language. For
 * scannerless grammars, we track:
 *   - literal: a specific leading substring (e.g. "if")
 *   - charClass: a regex character class (e.g. "[a-z]")
 *   - any: wildcard
 *   - empty: can match empty (nullable)
 */
export type FirstEntry =
  | { kind: "literal";   text: string }
  | { kind: "charClass"; pattern: string }
  | { kind: "regex";     pattern: string }
  | { kind: "any" }
  | { kind: "empty" };

export type FirstSet = FirstEntry[];

// --- Main entry ---

const reportCache: WeakMap<Grammar, GrammarReport> = new WeakMap();

export function analyze(grammar: Grammar): GrammarReport {
  const cached = reportCache.get(grammar);
  if (cached) return cached;

  const errors:   GrammarError[]   = [];
  const warnings: GrammarWarning[] = [];

  // 1. Defined-ness and reachability
  checkDefinedness(grammar, errors);
  checkReachability(grammar, warnings);

  // 2. Nullability (fixed-point)
  const nullable = computeNullability(grammar);

  // 3. FIRST sets (fixed-point)
  const first = computeFirst(grammar, nullable);

  // 4. Structural checks
  const leftRec = new Set<string>();
  checkStructure(grammar, nullable, leftRec, errors, warnings);

  // 5. Reservation consistency
  checkReservations(grammar, errors);

  // 6. Alt disjointness: DISABLED in Phase 3 because the current stratified
  //    grammar intentionally relies on ordered-alt semantics (e.g. block_expr
  //    tried first; lambda tried before bare ident; keyword alts tried
  //    before general ident). Re-enable when the base grammar uses proper
  //    `@prec` / `@longest` annotations and each alt is structurally
  //    unambiguous.
  //
  //    The checkAltDisjointness machinery is retained so user-defined
  //    grammars (via `grammar2_*` primitives) can opt in, and so the Phase
  //    4+ grammar analyzer has the building blocks ready.

  const report: GrammarReport = { errors, warnings, nullable, first, leftRec };
  reportCache.set(grammar, report);
  return report;
}

// --- 1. Defined-ness ---

function checkDefinedness(grammar: Grammar, errors: GrammarError[]): void {
  const walk = (rule: Rule, prod: string): void => {
    switch (rule.kind) {
      case "nonterm":
        if (!grammar.productions.has(rule.name)) {
          errors.push({
            code: "E_UNDEFINED_NAME",
            message: `production '${rule.name}' is referenced but not defined`,
            production: prod,
            rule,
          });
        }
        break;
      case "seq":
        for (const item of rule.items) walk(item, prod);
        break;
      case "alt":
        for (const opt of rule.options) walk(opt, prod);
        break;
      case "rep":
        walk(rule.item, prod);
        if (rule.sep) walk(rule.sep, prod);
        break;
      case "opt":
        walk(rule.item, prod);
        break;
      case "guarded":
        walk(rule.item, prod);
        walkGuard(rule.guard, prod);
        break;
    }
  };
  const walkGuard = (g: Guard, prod: string): void => {
    if (g.kind === "notFollowedBy" || g.kind === "followedBy") walk(g.rule, prod);
  };

  for (const [name, p] of grammar.productions) walk(p.rule, name);
  if (grammar.start && !grammar.productions.has(grammar.start)) {
    errors.push({
      code: "E_UNDEFINED_START",
      message: `start production '${grammar.start}' is not defined`,
    });
  }
}

// --- 2. Reachability ---

function checkReachability(grammar: Grammar, warnings: GrammarWarning[]): void {
  if (!grammar.start || !grammar.productions.has(grammar.start)) return;
  const reachable = new Set<string>();
  const visit = (name: string): void => {
    if (reachable.has(name)) return;
    reachable.add(name);
    const prod = grammar.productions.get(name);
    if (!prod) return;
    const visitRule = (r: Rule): void => {
      switch (r.kind) {
        case "nonterm": visit(r.name); break;
        case "seq": r.items.forEach(visitRule); break;
        case "alt": r.options.forEach(visitRule); break;
        case "rep": visitRule(r.item); if (r.sep) visitRule(r.sep); break;
        case "opt": visitRule(r.item); break;
        case "guarded":
          visitRule(r.item);
          if (r.guard.kind === "notFollowedBy" || r.guard.kind === "followedBy") {
            visitRule(r.guard.rule);
          }
          break;
      }
    };
    visitRule(prod.rule);
  };
  visit(grammar.start);
  for (const name of grammar.productions.keys()) {
    if (!reachable.has(name)) {
      warnings.push({
        code: "W_UNREACHABLE",
        message: `production '${name}' is not reachable from start '${grammar.start}'`,
        production: name,
      });
    }
  }
}

// --- 3. Nullability (fixed-point) ---

function computeNullability(grammar: Grammar): Set<string> {
  const nullable = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const [name, prod] of grammar.productions) {
      if (nullable.has(name)) continue;
      if (isNullable(prod.rule, nullable)) {
        nullable.add(name);
        changed = true;
      }
    }
  }
  return nullable;
}

function isNullable(rule: Rule, nullable: Set<string>): boolean {
  switch (rule.kind) {
    case "terminal":
      return rule.match.kind === "empty" ||
             (rule.match.kind === "indent" &&
              (rule.match.directive === "INDENT" || rule.match.directive === "DEDENT" ||
               rule.match.directive === "SAMELINE"));
    case "nonterm":
      return nullable.has(rule.name);
    case "seq":
      return rule.items.every(r => isNullable(r, nullable));
    case "alt":
      return rule.options.some(r => isNullable(r, nullable));
    case "rep":
      return rule.min === 0 || isNullable(rule.item, nullable);
    case "opt":
      return true;
    case "guarded":
      return isNullable(rule.item, nullable);
  }
}

// --- 4. FIRST sets (fixed-point) ---

function computeFirst(grammar: Grammar, nullable: Set<string>): Map<string, FirstSet> {
  const first = new Map<string, FirstSet>();
  for (const name of grammar.productions.keys()) first.set(name, []);

  let changed = true;
  while (changed) {
    changed = false;
    for (const [name, prod] of grammar.productions) {
      const before = first.get(name)!;
      const after = ruleFirst(prod.rule, first, nullable, new Set([name]));
      if (extendSet(before, after)) changed = true;
    }
  }
  return first;
}

function ruleFirst(
  rule: Rule,
  first: Map<string, FirstSet>,
  nullable: Set<string>,
  onStack: Set<string>,
): FirstSet {
  switch (rule.kind) {
    case "terminal": return terminalFirst(rule.match);
    case "nonterm": {
      if (onStack.has(rule.name)) return []; // left recursion — handled elsewhere
      const fs = first.get(rule.name);
      return fs ? fs.slice() : [];
    }
    case "seq": {
      const out: FirstSet = [];
      for (const item of rule.items) {
        const f = ruleFirst(item, first, nullable, onStack);
        for (const e of f) if (e.kind !== "empty") out.push(e);
        if (!isNullable(item, nullable)) return dedup(out);
      }
      // All items nullable — include empty
      out.push({ kind: "empty" });
      return dedup(out);
    }
    case "alt": {
      const out: FirstSet = [];
      for (const opt of rule.options) {
        for (const e of ruleFirst(opt, first, nullable, onStack)) out.push(e);
      }
      return dedup(out);
    }
    case "rep": {
      const inner = ruleFirst(rule.item, first, nullable, onStack);
      if (rule.min === 0) {
        const out: FirstSet = inner.filter(e => e.kind !== "empty");
        out.push({ kind: "empty" });
        return dedup(out);
      }
      return dedup(inner);
    }
    case "opt": {
      const inner = ruleFirst(rule.item, first, nullable, onStack);
      const out: FirstSet = inner.filter(e => e.kind !== "empty");
      out.push({ kind: "empty" });
      return dedup(out);
    }
    case "guarded":
      return ruleFirst(rule.item, first, nullable, onStack);
  }
}

function terminalFirst(m: import("./types.js").TerminalMatch): FirstSet {
  switch (m.kind) {
    case "literal":   return [{ kind: "literal", text: m.text }];
    case "charClass": return [{ kind: "charClass", pattern: m.pattern }];
    case "regex":     return regexFirst(m.pattern.source);
    case "empty":     return [{ kind: "empty" }];
    case "eof":       return [{ kind: "literal", text: "" }];  // eof — no character
    case "fail":      return [];
    case "indent": {
      // NEWLINE / CONT_NL: lead with \n; INDENT/DEDENT/SAMELINE: no character
      if (m.directive === "NEWLINE" || m.directive === "CONT_NL") {
        return [{ kind: "literal", text: "\n" }];
      }
      return [{ kind: "empty" }];
    }
  }
}

/**
 * Extract a FIRST set from a regex source. Best-effort static analysis:
 *   - `^[X]...` → charClass(X)
 *   - `^\x...` → literal(x)  (escaped single char)
 *   - `^ABC`  → literal(A) (first char)
 *   - anything else → any
 */
function regexFirst(source: string): FirstSet {
  // Strip anchors
  let src = source;
  if (src.startsWith("^(?:")) {
    // anchored group — peel one layer
    src = src.slice(4);
    // try to find the matching close
    let depth = 1, end = 0;
    for (let i = 0; i < src.length && depth > 0; i++) {
      if (src[i] === "\\") { i++; continue; }
      if (src[i] === "(") depth++;
      else if (src[i] === ")") { depth--; if (depth === 0) end = i; }
    }
    // We don't need to close the group — just take the first char(s) inside
  }
  if (src.startsWith("^")) src = src.slice(1);

  // Character class start
  if (src.startsWith("[")) {
    let end = 1;
    while (end < src.length && src[end] !== "]") {
      if (src[end] === "\\") { end += 2; continue; }
      end++;
    }
    if (end < src.length) {
      return [{ kind: "charClass", pattern: src.slice(0, end + 1) }];
    }
  }

  // Escape sequence
  if (src.startsWith("\\") && src.length >= 2) {
    const ch = src[1];
    if (ch === "d") return [{ kind: "charClass", pattern: "[0-9]" }];
    if (ch === "w") return [{ kind: "charClass", pattern: "[a-zA-Z0-9_]" }];
    if (ch === "s") return [{ kind: "charClass", pattern: "[ \\t\\n\\r]" }];
    // Escaped literal char (\/, \., etc.)
    return [{ kind: "literal", text: ch === "n" ? "\n" : ch === "t" ? "\t" : ch }];
  }

  // First literal char of the pattern
  if (src.length > 0 && !"*+?.(){}|".includes(src[0])) {
    return [{ kind: "literal", text: src[0] }];
  }

  return [{ kind: "any" }];
}

function extendSet(current: FirstSet, extra: FirstSet): boolean {
  let changed = false;
  for (const e of extra) {
    if (!hasEntry(current, e)) { current.push(e); changed = true; }
  }
  return changed;
}

function hasEntry(set: FirstSet, e: FirstEntry): boolean {
  return set.some(x => firstEntryEq(x, e));
}

function firstEntryEq(a: FirstEntry, b: FirstEntry): boolean {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case "literal":   return a.text === (b as any).text;
    case "charClass": return a.pattern === (b as any).pattern;
    case "regex":     return a.pattern === (b as any).pattern;
    case "any":
    case "empty":     return true;
  }
}

function dedup(set: FirstSet): FirstSet {
  const out: FirstSet = [];
  for (const e of set) if (!hasEntry(out, e)) out.push(e);
  return out;
}

// --- 5. Structural checks (left recursion, infinite loops) ---

function checkStructure(
  grammar: Grammar,
  nullable: Set<string>,
  leftRec: Set<string>,
  errors: GrammarError[],
  warnings: GrammarWarning[],
): void {
  // Direct left recursion: a production P whose rule, starting from the
  // left, can reach NonTerm(P) without consuming any character.
  for (const [name, prod] of grammar.productions) {
    if (leftRecursiveAtStart(prod.rule, name, nullable, new Set())) {
      leftRec.add(name);
    }
  }

  // Infinite loop: Rep of a nullable item with no separator (or a nullable
  // separator). This would cause the engine to loop forever at parse time.
  const visit = (rule: Rule, prodName: string): void => {
    switch (rule.kind) {
      case "rep": {
        if (isNullable(rule.item, nullable) &&
            (!rule.sep || isNullable(rule.sep, nullable))) {
          errors.push({
            code: "E_INFINITE_REP",
            message: `Rep of a nullable item with no non-nullable separator — would loop forever`,
            production: prodName,
            rule,
          });
        }
        visit(rule.item, prodName);
        if (rule.sep) visit(rule.sep, prodName);
        break;
      }
      case "seq": rule.items.forEach(r => visit(r, prodName)); break;
      case "alt": rule.options.forEach(r => visit(r, prodName)); break;
      case "opt": visit(rule.item, prodName); break;
      case "guarded": {
        visit(rule.item, prodName);
        if (rule.guard.kind === "notFollowedBy" || rule.guard.kind === "followedBy") {
          visit(rule.guard.rule, prodName);
        }
        break;
      }
      // terminal, nonterm: nothing
    }
  };
  for (const [name, prod] of grammar.productions) visit(prod.rule, name);
}

function leftRecursiveAtStart(
  rule: Rule,
  target: string,
  nullable: Set<string>,
  seen: Set<string>,
): boolean {
  switch (rule.kind) {
    case "terminal": return false;
    case "nonterm":
      if (rule.name === target) return true;
      if (seen.has(rule.name)) return false;
      // Recursively follow: inner name's rule's leftmost position
      // could re-enter the target (indirect LR). For now, just DIRECT.
      return false;
    case "seq": {
      for (const item of rule.items) {
        if (leftRecursiveAtStart(item, target, nullable, seen)) return true;
        if (!isNullable(item, nullable)) return false;
      }
      return false;
    }
    case "alt":
      return rule.options.some(r => leftRecursiveAtStart(r, target, nullable, seen));
    case "rep": return leftRecursiveAtStart(rule.item, target, nullable, seen);
    case "opt": return leftRecursiveAtStart(rule.item, target, nullable, seen);
    case "guarded": return leftRecursiveAtStart(rule.item, target, nullable, seen);
  }
}

// --- 6. Reservation consistency ---

function checkReservations(grammar: Grammar, errors: GrammarError[]): void {
  const walk = (rule: Rule, prod: string): void => {
    switch (rule.kind) {
      case "guarded":
        if (rule.guard.kind === "reserved") {
          if (!grammar.reserved.has(rule.guard.setName)) {
            errors.push({
              code: "E_UNDEFINED_RESERVED_SET",
              message: `guarded(reserved('${rule.guard.setName}')) — reserved set '${rule.guard.setName}' is not declared`,
              production: prod,
              rule,
            });
          }
        }
        walk(rule.item, prod);
        if (rule.guard.kind === "notFollowedBy" || rule.guard.kind === "followedBy") {
          walk(rule.guard.rule, prod);
        }
        break;
      case "seq": rule.items.forEach(r => walk(r, prod)); break;
      case "alt": rule.options.forEach(r => walk(r, prod)); break;
      case "rep": walk(rule.item, prod); if (rule.sep) walk(rule.sep, prod); break;
      case "opt": walk(rule.item, prod); break;
      // terminal, nonterm: nothing
    }
  };
  for (const [name, prod] of grammar.productions) walk(prod.rule, name);
}

// --- 7. Alt disjointness (warnings for now) ---

/**
 * For each Alt in the grammar, check if any two alternatives have
 * overlapping FIRST sets. If so, emit a warning. (Our current stratified
 * grammar intentionally uses ordered-alt semantics to resolve some of
 * these; making them errors requires proper `@prec`/`@longest` annotations,
 * which is future work.)
 */
function checkAltDisjointness(
  grammar: Grammar,
  first: Map<string, FirstSet>,
  nullable: Set<string>,
  warnings: GrammarWarning[],
): void {
  const visit = (rule: Rule, prod: string): void => {
    switch (rule.kind) {
      case "alt": {
        // If this Alt's containing production uses direct left recursion
        // (any alt starts with NonTerm(prod)), we're intentionally using
        // ordered-alt + Warth-style LR iteration. Don't flag overlap.
        const isLRProd = rule.options.some(opt => startsWithNonTerm(opt, prod));
        if (!isLRProd) {
          const optFirsts: FirstSet[] = rule.options.map(opt =>
            ruleFirst(opt, first, nullable, new Set()),
          );
          for (let i = 0; i < optFirsts.length; i++) {
            for (let j = i + 1; j < optFirsts.length; j++) {
              if (firstSetsOverlap(optFirsts[i], optFirsts[j])) {
                warnings.push({
                  code: "W_ALT_OVERLAP",
                  message: `Alt alternatives ${i} and ${j} may overlap (FIRST sets intersect)`,
                  production: prod,
                });
                // One report per Alt.
                rule.options.forEach(r => visit(r, prod));
                return;
              }
            }
          }
        }
        rule.options.forEach(r => visit(r, prod));
        break;
      }
      case "seq": rule.items.forEach(r => visit(r, prod)); break;
      case "rep": visit(rule.item, prod); if (rule.sep) visit(rule.sep, prod); break;
      case "opt": visit(rule.item, prod); break;
      case "guarded":
        visit(rule.item, prod);
        if (rule.guard.kind === "notFollowedBy" || rule.guard.kind === "followedBy") {
          visit(rule.guard.rule, prod);
        }
        break;
      // terminal, nonterm: nothing
    }
  };
  for (const [name, prod] of grammar.productions) visit(prod.rule, name);
}

/** Check if a rule starts with NonTerm(name) in its leftmost position. */
function startsWithNonTerm(rule: Rule, name: string): boolean {
  switch (rule.kind) {
    case "nonterm": return rule.name === name;
    case "seq":     return rule.items.length > 0 && startsWithNonTerm(rule.items[0], name);
    case "alt":     return rule.options.some(r => startsWithNonTerm(r, name));
    case "guarded": return startsWithNonTerm(rule.item, name);
    default:        return false;
  }
}

function firstSetsOverlap(a: FirstSet, b: FirstSet): boolean {
  for (const ea of a) {
    for (const eb of b) {
      if (firstEntriesOverlap(ea, eb)) return true;
    }
  }
  return false;
}

function firstEntriesOverlap(a: FirstEntry, b: FirstEntry): boolean {
  // empty entries don't count as consuming input
  if (a.kind === "empty" || b.kind === "empty") return false;
  if (a.kind === "any" || b.kind === "any") return true;

  if (a.kind === "literal" && b.kind === "literal") {
    if (a.text === "" || b.text === "") return false;
    return a.text[0] === b.text[0] ||
      a.text.startsWith(b.text) || b.text.startsWith(a.text);
  }
  if (a.kind === "literal" && b.kind === "charClass") {
    return a.text.length > 0 && charMatchesClass(a.text[0], b.pattern);
  }
  if (a.kind === "charClass" && b.kind === "literal") {
    return b.text.length > 0 && charMatchesClass(b.text[0], a.pattern);
  }
  if (a.kind === "charClass" && b.kind === "charClass") {
    return charClassesOverlap(a.pattern, b.pattern);
  }
  // regex: conservative — assume possible overlap with anything
  if (a.kind === "regex" || b.kind === "regex") return true;
  return false;
}

function charMatchesClass(ch: string, pattern: string): boolean {
  try {
    return new RegExp("^" + pattern + "$").test(ch);
  } catch {
    return true;
  }
}

function charClassesOverlap(p1: string, p2: string): boolean {
  // Conservative: test if a sample of typical chars would match both.
  const samples = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 \t_-+*/%.,:;!@#$&()[]{}<>=|\\\"'?";
  try {
    const r1 = new RegExp("^" + p1 + "$");
    const r2 = new RegExp("^" + p2 + "$");
    for (const ch of samples) if (r1.test(ch) && r2.test(ch)) return true;
    return false;
  } catch {
    return true;
  }
}

// --- Rendering ---

/**
 * Format a report for display. Returns a string with errors listed first,
 * then warnings. Useful for diagnostics.
 */
export function formatReport(report: GrammarReport): string {
  const lines: string[] = [];
  if (report.errors.length > 0) {
    lines.push("Grammar errors:");
    for (const e of report.errors) {
      const where = e.production ? ` [in ${e.production}]` : "";
      lines.push(`  [${e.code}]${where}: ${e.message}`);
    }
  }
  if (report.warnings.length > 0) {
    lines.push("Grammar warnings:");
    for (const w of report.warnings) {
      const where = w.production ? ` [in ${w.production}]` : "";
      lines.push(`  [${w.code}]${where}: ${w.message}`);
    }
  }
  if (report.errors.length === 0 && report.warnings.length === 0) {
    lines.push("Grammar is clean: no errors or warnings.");
  }
  return lines.join("\n");
}

/** Throw with a formatted message if the report has errors. */
export function assertClean(grammar: Grammar, report: GrammarReport = analyze(grammar)): void {
  if (report.errors.length > 0) {
    throw new Error("Grammar has errors:\n" + formatReport(report));
  }
}

/**
 * Opt-in disjointness check. Useful for user-defined grammars where
 * ordered-alt is not intended. Currently skipped in the base grammar
 * analysis — see note in `analyze()`.
 */
export function analyzeWithDisjointnessCheck(grammar: Grammar): GrammarReport {
  const report = analyze(grammar);
  // Re-run with the extra check; merge warnings.
  const extraWarnings: GrammarWarning[] = [];
  checkAltDisjointness(grammar, report.first, report.nullable, extraWarnings);
  return { ...report, warnings: [...report.warnings, ...extraWarnings] };
}
