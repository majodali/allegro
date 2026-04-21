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
   * Memo cache: key = `${ruleId}@${pos}:${indentKey}`.
   * Values are either a regular memoized result (MemoEntry) or null (known
   * failure at this position+indent).
   */
  memo: Map<string, MemoEntry | null> = new Map();
  ruleIds: WeakMap<Rule, number> = new WeakMap();
  nextRuleId: number = 1;

  /**
   * Indent stack. Top of stack is the indent level of the currently-open
   * block. Starts as [0] (the document block is rooted at column 0).
   */
  indentStack: number[] = [0];

  constructor(grammar: Grammar, input: string) {
    this.grammar = grammar;
    this.input   = input;
  }

  ruleKey(rule: Rule, pos: number): string {
    const baseKey = rule.kind === "nonterm"
      ? `nt:${rule.name}@${pos}`
      : `r${this.ruleId(rule)}@${pos}`;
    // Include the indent stack in the key. Even though most rules don't
    // depend on it, including it keeps the memo correct for indent-aware
    // rules without a static grammar analysis. Cost is modest: stacks are
    // typically 1-5 elements.
    return `${baseKey}:${this.indentStack.join(",")}`;
  }

  private ruleId(rule: Rule): number {
    let id = this.ruleIds.get(rule);
    if (id === undefined) {
      id = this.nextRuleId++;
      this.ruleIds.set(rule, id);
    }
    return id;
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

export interface MatchResult {
  tree:    ParseTree;
  nextPos: number;
  /**
   * If set, replaces the parser's indent stack after this match. Used by
   * INDENT (pushes a level), DEDENT (pops). NEWLINE does not modify the
   * stack directly — it's passive about block structure.
   */
  newIndentStack?: number[];
}

/**
 * Memo entry. Warth-style left recursion support:
 *   - `result` holds the final cached answer once settled.
 *   - `isLR` is true while a left-recursive computation is in progress at
 *     this (rule, pos); recursive re-entry returns the current `seed`.
 *   - `lrDetected` flips to true when the recursive re-entry actually
 *     happens, triggering iteration after the first parse attempt.
 */
interface MemoEntry {
  result:     MatchResult | null;
  isLR:       boolean;
  seed:       MatchResult | null;
  lrDetected: boolean;
}

// --- Rule dispatch ---

function matchRule(state: ParseState, rule: Rule, pos: number): MatchResult | null {
  const key = state.ruleKey(rule, pos);
  const cached = state.memo.get(key);
  if (cached !== undefined) {
    if (cached === null) return null;
    if (cached.isLR) {
      cached.lrDetected = true;
      // Return the seed; seed may carry a newIndentStack (rare for LR seeds).
      if (cached.seed?.newIndentStack) state.indentStack = cached.seed.newIndentStack;
      return cached.seed;
    }
    if (cached.result?.newIndentStack) state.indentStack = cached.result.newIndentStack;
    return cached.result;
  }

  const snapshot = state.indentStack;
  const entry: MemoEntry = { result: null, isLR: true, seed: null, lrDetected: false };
  state.memo.set(key, entry);

  let result = runDoMatch(state, rule, pos, snapshot);

  if (!entry.lrDetected) {
    entry.isLR  = false;
    entry.result = result;
    if (result === null) {
      state.indentStack = snapshot;
      state.advance(pos, [rule]);
    } else if (result.newIndentStack) {
      // Commit post-state.
      state.indentStack = result.newIndentStack;
    }
    return result;
  }

  // Left recursion detected. Iterate with seed growth. Between iterations,
  // clear memo entries at the same pos (other than our own LR entry) — they
  // were computed against a stale seed and would incorrectly short-circuit
  // the re-evaluation. This is Warth's "growing heads" concern, handled here
  // conservatively by position-scoped invalidation.
  let iters = 0;
  while (result !== null) {
    if (entry.seed !== null && result.nextPos <= entry.seed.nextPos) break;
    entry.seed = result;
    state.indentStack = snapshot;
    invalidateAtPos(state, pos, key);
    result = runDoMatch(state, rule, pos, snapshot);
    if (++iters > state.input.length + 10) {
      throw new Error(`LR iteration exceeded input length at rule ${rule.kind === "nonterm" ? rule.name : rule.kind} pos ${pos}`);
    }
  }

  entry.isLR  = false;
  entry.result = entry.seed;
  if (entry.seed === null) {
    state.indentStack = snapshot;
    state.advance(pos, [rule]);
  } else if (entry.seed.newIndentStack) {
    state.indentStack = entry.seed.newIndentStack;
  } else {
    state.indentStack = snapshot;
  }
  return entry.seed;
}

/**
 * Clear memo entries whose key identifies a match attempt at `pos`, except
 * the LR entry `keepKey` AND any other in-progress LR entries (isLR=true)
 * at the same position. Outer LR entries must be preserved so their own
 * seeds remain the active "current answer" for their rules during inner
 * iteration.
 */
function invalidateAtPos(state: ParseState, pos: number, keepKey: string): void {
  const posMarker = `@${pos}:`;
  for (const k of Array.from(state.memo.keys())) {
    if (k === keepKey) continue;
    if (!k.includes(posMarker)) continue;
    const entry = state.memo.get(k);
    if (entry && entry.isLR) continue;  // in-progress LR — preserve
    state.memo.delete(k);
  }
}

/**
 * Run doMatch. On failure, restore snapshot. On success, if the match mutated
 * the stack (via INDENT/DEDENT returning newIndentStack in its result),
 * propagate that up on the MatchResult so the caller memoizes the post-state.
 *
 * Nested matches (Seq/Alt/Rep/Opt) inherently commit via the inner matchRule
 * logic above, which sets state.indentStack from result.newIndentStack. So by
 * the time doMatch returns for a composite rule, state.indentStack already
 * reflects the cumulative post-state of all inner matches.
 */
function runDoMatch(state: ParseState, rule: Rule, pos: number, snapshot: number[]): MatchResult | null {
  const result = doMatch(state, rule, pos);
  if (result === null) {
    state.indentStack = snapshot;
    return null;
  }
  // Surface the net change on the result so the outer memo captures it.
  if (state.indentStack !== snapshot && !result.newIndentStack) {
    result.newIndentStack = state.indentStack;
  } else if (result.newIndentStack) {
    // A terminal (INDENT/DEDENT) returned newIndentStack directly; mirror it
    // into state so the NEXT rule in the enclosing Seq sees the updated stack.
    state.indentStack = result.newIndentStack;
  }
  return result;
}

/**
 * The actual rule-specific matching logic, separated from matchRule so the
 * Warth iteration can call it multiple times without memo interference.
 */
function doMatch(state: ParseState, rule: Rule, pos: number): MatchResult | null {
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
      return matchIndentDirective(state, m.directive, pos);
    }
  }
}

// --- Indent directives ---
//
// Semantics (per docs/grammar-formalism.md §5, with concrete pos-consumption
// rules):
//
//   NEWLINE : at \n; consumes \n + horizontal ws + any blank lines. Succeeds
//             iff the next non-blank line's content is at column == top of
//             stack. (Same-level statement boundary.)
//   INDENT  : at \n; same consumption as NEWLINE. Succeeds iff next content
//             col > top. Pushes new col onto stack.
//   DEDENT  : zero-width. Succeeds iff the current pos's column is < top of
//             stack. Pops stack by one. Users can iterate DEDENT via Rep to
//             pop multiple levels.
//   SAMELINE: not implemented in Phase 2a; the grammar author should avoid it.

/**
 * Skip from `pos` over any \n and horizontal whitespace and blank lines,
 * landing at the first non-blank line's first non-ws character (or EOF).
 * Returns the resulting position and the column of that character.
 *
 * Tabs count as 4 columns, aligned to the next multiple of 4. Mixed tabs
 * and spaces in leading whitespace of the SAME line produce an error.
 */
function skipToNextContent(input: string, start: number): { pos: number; col: number; error?: string } {
  let p = start;
  // Walk potentially past \n + blank lines.
  while (p < input.length) {
    // At \n: advance past it.
    if (input[p] === "\n") { p++; continue; }
    // Count leading ws of this line, checking for tab/space mixing.
    let col = 0;
    let lineStart = p;
    let sawTab = false, sawSpace = false;
    while (p < input.length && (input[p] === " " || input[p] === "\t")) {
      if (input[p] === " ") { col++; sawSpace = true; }
      else { col = (col + 4) & ~3; sawTab = true; }
      p++;
    }
    if (sawTab && sawSpace) {
      return { pos: p, col, error: `mixed tabs and spaces in leading whitespace at position ${lineStart}` };
    }
    if (p >= input.length) return { pos: p, col: Infinity };      // EOF after leading ws
    if (input[p] === "\n") { p++; continue; }                     // blank line
    return { pos: p, col };
  }
  return { pos: p, col: Infinity };
}

/**
 * Return the column of `pos` (chars since the most recent \n or start).
 * Used by DEDENT (zero-width, must inspect current column).
 */
function columnOf(input: string, pos: number): number {
  let lineStart = pos;
  while (lineStart > 0 && input[lineStart - 1] !== "\n") lineStart--;
  let col = 0;
  for (let i = lineStart; i < pos; i++) {
    if (input[i] === " ") col++;
    else if (input[i] === "\t") col = (col + 4) & ~3;
    else col++;
  }
  return col;
}

function matchIndentDirective(state: ParseState, directive: "NEWLINE" | "INDENT" | "DEDENT" | "SAMELINE" | "CONT_NL", pos: number): MatchResult | null {
  const top = state.indentStack[state.indentStack.length - 1];
  switch (directive) {
    case "NEWLINE": {
      if (state.input[pos] !== "\n") return null;
      const { pos: contentPos, col, error } = skipToNextContent(state.input, pos);
      if (error) return null;  // mixed tabs/spaces — just fail the NEWLINE; error reporting is a future concern
      if (col === Infinity) {
        // EOF: still counts as a statement boundary.
        return {
          tree: { kind: "leaf", text: state.input.slice(pos, contentPos), range: { start: pos, end: contentPos } },
          nextPos: contentPos,
        };
      }
      if (col !== top) return null;
      return {
        tree: { kind: "leaf", text: state.input.slice(pos, contentPos), range: { start: pos, end: contentPos } },
        nextPos: contentPos,
      };
    }
    case "INDENT": {
      if (state.input[pos] !== "\n") return null;
      const { pos: contentPos, col, error } = skipToNextContent(state.input, pos);
      if (error || col === Infinity || col <= top) return null;
      const newStack = [...state.indentStack, col];
      return {
        tree: { kind: "leaf", text: state.input.slice(pos, contentPos), range: { start: pos, end: contentPos } },
        nextPos: contentPos,
        newIndentStack: newStack,
      };
    }
    case "DEDENT": {
      // Zero-width. Look ahead to the next content's column. If that column
      // is strictly less than top, this block is ending — pop one level.
      // (To pop multiple levels, grammar authors chain DEDENTs via Rep.)
      if (state.indentStack.length <= 1) return null;
      const { col } = skipToNextContent(state.input, pos);
      // col === Infinity means EOF — treat as dedent for all levels.
      if (col !== Infinity && col >= top) return null;
      const newStack = state.indentStack.slice(0, -1);
      return {
        tree: { kind: "leaf", text: "", range: { start: pos, end: pos } },
        nextPos: pos,
        newIndentStack: newStack,
      };
    }
    case "CONT_NL": {
      // Expression continuation: consume \n + horizontal whitespace iff the
      // next non-blank line's indent is STRICTLY DEEPER than the current
      // block's indent. Does NOT modify the stack — we're just absorbing
      // continuation whitespace mid-expression.
      if (state.input[pos] !== "\n") return null;
      const { pos: contentPos, col, error } = skipToNextContent(state.input, pos);
      if (error || col === Infinity) return null;
      if (col <= top) return null;
      return {
        tree: { kind: "leaf", text: state.input.slice(pos, contentPos), range: { start: pos, end: contentPos } },
        nextPos: contentPos,
      };
    }
    case "SAMELINE":
      throw new Error("SAMELINE is not implemented in the Phase 2a engine");
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

  // Tag the resulting branch. If the production has an EXPLICIT @name attr,
  // use that — it overrides whatever tag the inner rule produced. Otherwise
  // fall back to the inner tree's existing tag, or the production's name.
  const explicitName = prod.attrs?.name;
  const defaultName = rule.name;
  if (inner.tree.kind === "branch") {
    const tag = explicitName ?? inner.tree.tag ?? defaultName;
    // If explicit name, wrap in a new branch so the downstream tree-builder
    // sees `pattern_ident > ident > "n"` rather than a re-tagged ident.
    if (explicitName && inner.tree.tag && inner.tree.tag !== explicitName) {
      return {
        tree: {
          kind: "branch",
          tag: explicitName,
          children: [inner.tree],
          range: inner.tree.range,
        },
        nextPos: inner.nextPos,
      };
    }
    return {
      tree: { ...inner.tree, tag },
      nextPos: inner.nextPos,
    };
  }
  if (inner.tree.kind === "leaf") {
    return {
      tree: {
        kind: "branch",
        tag: explicitName ?? defaultName,
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
