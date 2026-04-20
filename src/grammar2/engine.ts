// =============================================================================
// Allegro Grammar 2 — Parser Engine
//
// A recursive parser with memoization, set up to grow into a full GLL engine
// when Phase 2's base grammar requires it (left recursion handling, GSS,
// ambiguity detection). For Phase 1 it handles:
//
//   - Terminal matching (literal, charClass, regex, eof, empty, fail)
//   - Sequence, alternation, repetition, option, nonterminal
//   - Guards (notFollowedBy, followedBy, reserved)
//   - Farthest-advance error reporting
//
// Intentionally NOT in Phase 1:
//   - Indent-aware terminals (NEWLINE/INDENT/DEDENT/SAMELINE)
//   - Left recursion
//   - SPPF / ambiguity detection
//   - @error productions, @sync panic recovery
//   - Precedence-aware parsing
//
// These are added in later phases. The types and engine interface are stable
// enough to absorb them without refactoring the surface API.
// =============================================================================

import {
  Rule, Grammar, ParseTree, SourceRange, Terminal, NonTerm, Seq, Alt, Rep, Opt, Guarded, Guard,
  TerminalMatch,
} from "./types.js";

// --- Public API ---

export interface ParseOk {
  ok:   true;
  tree: ParseTree;
}

export interface ParseFail {
  ok:      false;
  error:   ParseError;
}

export interface ParseError {
  /** Character position where the farthest-advancing descriptor stalled. */
  position: number;
  /**
   * Human-readable message describing what was expected. Derived from the
   * rules that were active at `position` plus the actual next character.
   */
  message:  string;
  /**
   * The character at `position` (or "<EOF>" if beyond the end).
   */
  actual:   string;
}

export type ParseResult = ParseOk | ParseFail;

export function parse(grammar: Grammar, input: string): ParseResult {
  if (!grammar.start) {
    throw new Error("Grammar has no start production");
  }
  if (!grammar.productions.has(grammar.start)) {
    throw new Error(`Start production '${grammar.start}' not found in grammar`);
  }
  const state = new ParseState(grammar, input);
  const startRule: NonTerm = { kind: "nonterm", name: grammar.start };
  const result = matchRule(state, startRule, 0);
  if (!result) {
    return { ok: false, error: buildFarthestError(state) };
  }
  if (result.nextPos !== input.length) {
    // Didn't consume all input; surface the farthest error.
    return { ok: false, error: buildFarthestError(state) };
  }
  return { ok: true, tree: result.tree };
}

// --- Internal state ---

class ParseState {
  grammar: Grammar;
  input:   string;
  /** Farthest input position any match attempted to advance past. */
  farthest:      number = 0;
  /** Rules active at the farthest position (for error messages). */
  farthestRules: Rule[] = [];
  /**
   * Memo cache: key = `${ruleId}@${pos}`. Value = match result or null (for
   * "known failure" at this position).
   *
   * Rules are identified by their JS object identity via a WeakMap. Non-
   * terminal references use `nt:${name}@${pos}` keys since those are shared
   * by every reference to the same name.
   */
  memo: Map<string, MatchResult | null> = new Map();
  ruleIds: WeakMap<Rule, number> = new WeakMap();
  nextRuleId: number = 1;

  constructor(grammar: Grammar, input: string) {
    this.grammar = grammar;
    this.input   = input;
  }

  ruleKey(rule: Rule, pos: number): string {
    if (rule.kind === "nonterm") return `nt:${rule.name}@${pos}`;
    let id = this.ruleIds.get(rule);
    if (id === undefined) {
      id = this.nextRuleId++;
      this.ruleIds.set(rule, id);
    }
    return `r${id}@${pos}`;
  }

  advance(pos: number, activeRules: Rule[]): void {
    if (pos > this.farthest) {
      this.farthest      = pos;
      this.farthestRules = activeRules.slice();
    } else if (pos === this.farthest) {
      for (const r of activeRules) {
        if (!this.farthestRules.includes(r)) {
          this.farthestRules.push(r);
        }
      }
    }
  }
}

interface MatchResult {
  tree:    ParseTree;
  nextPos: number;
}

// --- Rule dispatch ---

function matchRule(state: ParseState, rule: Rule, pos: number): MatchResult | null {
  const key = state.ruleKey(rule, pos);
  const cached = state.memo.get(key);
  if (cached !== undefined) return cached;

  let result: MatchResult | null = null;
  switch (rule.kind) {
    case "terminal": result = matchTerminal(state, rule, pos); break;
    case "nonterm":  result = matchNonTerm(state, rule, pos);  break;
    case "seq":      result = matchSeq(state, rule, pos);      break;
    case "alt":      result = matchAlt(state, rule, pos);      break;
    case "rep":      result = matchRep(state, rule, pos);      break;
    case "opt":      result = matchOpt(state, rule, pos);      break;
    case "guarded":  result = matchGuarded(state, rule, pos);  break;
  }

  // Apply @name tagging to the resulting tree.
  if (result && rule.attrs?.name && result.tree.kind === "branch") {
    result = { ...result, tree: { ...result.tree, tag: rule.attrs.name } };
  } else if (result && rule.attrs?.name && result.tree.kind === "leaf") {
    // Promote leaf to a tagged single-child branch? Simpler: leave as leaf
    // and let consumers inspect the text. The tag is informational anyway.
  }

  state.memo.set(key, result);
  if (result === null) {
    // Track this rule as "active at the farthest position" if we failed here.
    state.advance(pos, [rule]);
  }
  return result;
}

// --- Terminal ---

function matchTerminal(state: ParseState, rule: Terminal, pos: number): MatchResult | null {
  const m = rule.match;
  const range: SourceRange = { start: pos, end: pos };
  switch (m.kind) {
    case "literal": {
      if (state.input.startsWith(m.text, pos)) {
        const end = pos + m.text.length;
        return {
          tree: { kind: "leaf", text: m.text, range: { start: pos, end } },
          nextPos: end,
        };
      }
      return null;
    }
    case "charClass": {
      if (pos >= state.input.length) return null;
      const slice = state.input.slice(pos, pos + 1);
      if (m.compiled.test(slice)) {
        return {
          tree: { kind: "leaf", text: slice, range: { start: pos, end: pos + 1 } },
          nextPos: pos + 1,
        };
      }
      return null;
    }
    case "regex": {
      const slice = state.input.slice(pos);
      const exec  = m.pattern.exec(slice);
      if (exec && exec.index === 0) {
        const matched = exec[0];
        const end = pos + matched.length;
        return {
          tree: { kind: "leaf", text: matched, range: { start: pos, end } },
          nextPos: end,
        };
      }
      return null;
    }
    case "eof": {
      if (pos === state.input.length) {
        return {
          tree: { kind: "leaf", text: "", range },
          nextPos: pos,
        };
      }
      return null;
    }
    case "empty": {
      return {
        tree: { kind: "leaf", text: "", range },
        nextPos: pos,
      };
    }
    case "fail": {
      return null;
    }
    case "indent": {
      // Indent terminals are Phase 1-deferred. For now, fail cleanly with a
      // message so callers know not to use them yet.
      throw new Error(`indent terminal '${m.directive}' not yet supported in Phase 1 engine`);
    }
  }
}

// --- NonTerm ---

function matchNonTerm(state: ParseState, rule: NonTerm, pos: number): MatchResult | null {
  const prod = state.grammar.productions.get(rule.name);
  if (!prod) {
    throw new Error(`Undefined production reference: '${rule.name}'`);
  }
  const inner = matchRule(state, prod.rule, pos);
  if (!inner) return null;

  // If the inner tree is already a branch and the production has no explicit
  // name attr, pass the child through. Otherwise wrap in a named branch.
  const prodName = prod.attrs?.name ?? rule.name;
  if (inner.tree.kind === "branch") {
    return {
      tree: { ...inner.tree, tag: inner.tree.tag ?? prodName },
      nextPos: inner.nextPos,
    };
  }
  if (inner.tree.kind === "leaf") {
    return {
      tree: {
        kind: "branch",
        tag: prodName,
        children: [inner.tree],
        range: inner.tree.range,
      },
      nextPos: inner.nextPos,
    };
  }
  return inner;
}

// --- Seq ---

function matchSeq(state: ParseState, rule: Seq, pos: number): MatchResult | null {
  const children: ParseTree[] = [];
  let cur = pos;
  for (const item of rule.items) {
    const m = matchRule(state, item, cur);
    if (!m) return null;
    children.push(m.tree);
    cur = m.nextPos;
  }
  const range: SourceRange = {
    start: children.length ? children[0].range.start : pos,
    end:   cur,
  };
  return {
    tree: { kind: "branch", children, range },
    nextPos: cur,
  };
}

// --- Alt ---

function matchAlt(state: ParseState, rule: Alt, pos: number): MatchResult | null {
  // For Phase 1 (pre-analyzer), we try each option in order and take the FIRST
  // one that succeeds. This mirrors the not-yet-implemented @longest / @prec
  // logic for simple cases, and lets us get the engine running.
  //
  // Phase 3 replaces this with the analyzer-driven strategy: non-overlapping
  // options short-circuit, @longest options evaluate all, @prec options
  // resolve by precedence.
  let best: MatchResult | null = null;
  let bestIdx = -1;
  const longest = rule.attrs?.longest === true;

  for (let i = 0; i < rule.options.length; i++) {
    const m = matchRule(state, rule.options[i], pos);
    if (m) {
      if (!best) {
        best    = m;
        bestIdx = i;
        if (!longest) break;
      } else if (longest) {
        if (m.nextPos > best.nextPos) {
          best = m; bestIdx = i;
        } else if (m.nextPos === best.nextPos) {
          throw new Error(
            `@longest tie at position ${pos}: alternatives ${bestIdx} and ${i} both match ${m.nextPos - pos} characters`,
          );
        }
      }
    }
  }
  return best;
}

// --- Rep ---

function matchRep(state: ParseState, rule: Rep, pos: number): MatchResult | null {
  const children: ParseTree[] = [];
  let cur = pos;
  let iterations = 0;

  while (rule.max === null || iterations < rule.max) {
    let itemStart = cur;

    // For iterations > 0, consume the separator first.
    if (iterations > 0 && rule.sep) {
      const sepResult = matchRule(state, rule.sep, cur);
      if (!sepResult) break;
      itemStart = sepResult.nextPos;
    }

    const itemResult = matchRule(state, rule.item, itemStart);
    if (!itemResult) {
      // Item failed — we're done. If a separator was consumed but the
      // following item failed, we don't roll back; but we also don't
      // include that separator in children. Simple approach: the Rep's
      // successful match ends at the last item consumed, excluding trailing
      // separator.
      break;
    }

    // Protect against infinite loops on nullable items with no separator
    // that match zero-width.
    if (itemResult.nextPos === cur) {
      if (rule.sep) {
        // With a separator, zero-width item is OK — we advance via separator.
        // But we still need iterations to terminate.
      } else {
        throw new Error(
          `Rep of a nullable item with no separator at position ${pos} would loop forever`,
        );
      }
    }

    children.push(itemResult.tree);
    cur = itemResult.nextPos;
    iterations++;
  }

  if (iterations < rule.min) return null;

  const range: SourceRange = {
    start: pos,
    end:   cur,
  };
  return {
    tree: { kind: "branch", children, range },
    nextPos: cur,
  };
}

// --- Opt ---

function matchOpt(state: ParseState, rule: Opt, pos: number): MatchResult | null {
  const m = matchRule(state, rule.item, pos);
  if (m) return m;
  return {
    tree: { kind: "none", range: { start: pos, end: pos } },
    nextPos: pos,
  };
}

// --- Guarded ---

function matchGuarded(state: ParseState, rule: Guarded, pos: number): MatchResult | null {
  // Match the item first. All guards apply at the END position of the item's
  // match (zero-width postcondition). This matches the spec's intent for
  // notFollowedBy / followedBy on keyword boundaries, and is required for
  // reserved which needs the consumed text.
  //
  // Pre-item guards (lookahead BEFORE matching) aren't supported in Phase 1;
  // they can be expressed via placement in a Seq.
  const result = matchRule(state, rule.item, pos);
  if (!result) return null;

  switch (rule.guard.kind) {
    case "notFollowedBy": {
      const m = matchRule(state, rule.guard.rule, result.nextPos);
      if (m !== null) return null;
      return result;
    }
    case "followedBy": {
      const m = matchRule(state, rule.guard.rule, result.nextPos);
      if (m === null) return null;
      return result;
    }
    case "reserved": {
      const consumed = state.input.slice(pos, result.nextPos);
      const set = state.grammar.reserved.get(rule.guard.setName);
      if (!set) {
        throw new Error(`Reserved set '${rule.guard.setName}' not declared`);
      }
      if (set.has(consumed)) return null;
      return result;
    }
  }
}

// --- Error reporting ---

function buildFarthestError(state: ParseState): ParseError {
  const pos      = state.farthest;
  const actual   = pos < state.input.length ? state.input[pos] : "<EOF>";
  const expected = describeExpected(state.farthestRules);
  const message  = expected
    ? `expected ${expected}, got '${actual}' at position ${pos}`
    : `unexpected '${actual}' at position ${pos}`;
  return { position: pos, message, actual };
}

function describeExpected(rules: Rule[]): string {
  // Best-effort description. Collect terminal literals and char classes.
  const parts: string[] = [];
  for (const r of rules) {
    parts.push(describeRule(r));
  }
  const unique = Array.from(new Set(parts));
  if (unique.length === 0) return "";
  if (unique.length === 1) return unique[0];
  if (unique.length <= 4)  return unique.slice(0, -1).join(", ") + " or " + unique[unique.length - 1];
  return unique.slice(0, 3).join(", ") + ", ...";
}

function describeRule(r: Rule): string {
  switch (r.kind) {
    case "terminal": return describeTerminal(r.match);
    case "nonterm":  return r.name;
    case "seq":      return r.attrs?.name ?? "sequence";
    case "alt":      return r.attrs?.name ?? "alternative";
    case "rep":      return r.attrs?.name ?? "repetition";
    case "opt":      return r.attrs?.name ?? "optional";
    case "guarded":  return describeRule(r.item);
  }
}

function describeTerminal(m: TerminalMatch): string {
  switch (m.kind) {
    case "literal":   return `'${m.text}'`;
    case "charClass": return `character matching ${m.pattern}`;
    case "regex":     return `pattern /${m.pattern.source}/`;
    case "eof":       return "end of input";
    case "empty":     return "";
    case "fail":      return "unreachable";
    case "indent":    return m.directive;
  }
}
