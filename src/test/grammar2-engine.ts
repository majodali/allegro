// =============================================================================
// Grammar 2: the formalism, the scannerless engine, and the analyzer.
//
// Extracted from the single-file suite (suite split, lane B). Registrations
// run at import time; src/test/index.ts imports this module in suite order.
// =============================================================================

import { test, eq, throws } from "./harness.js";
import { evalStd, typeExt } from "./fixtures.js";
import { evalSource as runtimeEval } from "../runtime.js";
import { Value, ValueKind, bitsToString } from "../types.js";
import { parse as g2parse, ParseResult as G2ParseResult } from "../grammar2/engine.js";
import { getGrammarWithFragments as g2getGrammarWithFragments } from "../grammar2/fragments.js";
import { analyze as g2analyze, formatReport as g2format, analyzeWithDisjointnessCheck } from "../grammar2/analyzer.js";
import { buildBaseGrammar as buildBaseG2 } from "../grammar2/base-grammar.js";
import { assertClean as g2assertClean } from "../grammar2/analyzer.js";
import { grammarToAllegro } from "../grammar2/to-allegro.js";
import { evaluate } from "../evaluator.js";
import { makeExpr } from "../types.js";
import { getSlotCount } from "../slots.js";
import * as g2 from "../grammar2/types.js";
import * as fs from "fs";

// == Grammar 2 (Phase 1) — new formalism + engine ==
//
// Tests for the TypeScript-level types and engine in src/grammar2/. These
// do NOT yet integrate with Allegro source; they verify the engine on
// directly-constructed grammar values. Allegro-level integration comes
// via builder.ts and registered primitives (tested separately below).


export function g2ok(r: G2ParseResult): asserts r is Extract<G2ParseResult, { ok: true }> {
  if (!r.ok) throw new Error(`expected parse success, got: ${r.error.message}`);
}

export function g2fail(r: G2ParseResult): asserts r is Extract<G2ParseResult, { ok: false }> {
  if (r.ok) throw new Error(`expected parse failure, got tree`);
}

export function mkGrammar(start: string, productions: Record<string, g2.Rule>): g2.Grammar {
  const g = g2.makeGrammar({ start });
  for (const [name, rule] of Object.entries(productions)) {
    g2.addProduction(g, { name, rule });
  }
  return g;
}

test("grammar2/types: constructor helpers produce well-shaped values", () => {
  const r = g2.seq([g2.lit("a"), g2.lit("b")]);
  eq(r.kind, "seq");
  eq((r.items[0] as g2.Terminal).match.kind, "literal");
});

test("grammar2/engine: literal match", () => {
  const g = mkGrammar("s", { s: g2.lit("hello") });
  const r = g2parse(g, "hello");
  g2ok(r);
  eq(r.tree.kind === "branch" || r.tree.kind === "leaf", true);
});

test("grammar2/engine: literal mismatch reports farthest advance", () => {
  const g = mkGrammar("s", { s: g2.lit("hello") });
  const r = g2parse(g, "hxllo");
  g2fail(r);
  eq(r.error.position, 0);
  eq(r.error.actual, "h");
});

test("grammar2/engine: seq consumes all items in order", () => {
  const g = mkGrammar("s", { s: g2.seq([g2.lit("ab"), g2.lit("cd")]) });
  const r = g2parse(g, "abcd");
  g2ok(r);
  if (r.tree.kind === "branch") {
    eq(r.tree.children.length, 2);
  }
});

test("grammar2/engine: alt picks the first matching alternative", () => {
  const g = mkGrammar("s", { s: g2.alt([g2.lit("x"), g2.lit("y")]) });
  const r = g2parse(g, "y");
  g2ok(r);
});

test("grammar2/engine: alt reports farthest failure across options", () => {
  const g = mkGrammar("s", { s: g2.alt([g2.lit("xxxx"), g2.lit("yy")]) });
  const r = g2parse(g, "zz");
  g2fail(r);
  // Neither alt advances; farthest is 0.
  eq(r.error.position, 0);
});

test("grammar2/engine: rep with min=1 requires at least one match", () => {
  const g = mkGrammar("s", { s: g2.rep(g2.lit("a"), { min: 1 }) });
  const r = g2parse(g, "aaa");
  g2ok(r);
  if (r.tree.kind === "branch") {
    eq(r.tree.children.length, 3);
  }
});

test("grammar2/engine: rep with min=1 fails on empty", () => {
  const g = mkGrammar("s", { s: g2.rep(g2.lit("a"), { min: 1 }) });
  const r = g2parse(g, "");
  g2fail(r);
});

test("grammar2/engine: rep with separator strips delimiters from result", () => {
  const g = mkGrammar("s", {
    s: g2.rep(g2.lit("x"), { min: 1, sep: g2.lit(",") }),
  });
  const r = g2parse(g, "x,x,x");
  g2ok(r);
  if (r.tree.kind === "branch") {
    eq(r.tree.children.length, 3);
  }
});

test("grammar2/engine: opt produces 'none' on miss", () => {
  const g = mkGrammar("s", { s: g2.seq([g2.lit("a"), g2.opt(g2.lit("b"))]) });
  const r = g2parse(g, "a");
  g2ok(r);
  if (r.tree.kind === "branch") {
    eq(r.tree.children.length, 2);
    eq(r.tree.children[1].kind, "none");
  }
});

test("grammar2/engine: opt consumes when present", () => {
  const g = mkGrammar("s", { s: g2.seq([g2.lit("a"), g2.opt(g2.lit("b"))]) });
  const r = g2parse(g, "ab");
  g2ok(r);
});

test("grammar2/engine: charClass matches a single character", () => {
  const g = mkGrammar("s", { s: g2.cls("[a-z]") });
  const r = g2parse(g, "m");
  g2ok(r);
});

test("grammar2/engine: regex matches at current position", () => {
  const g = mkGrammar("s", { s: g2.regex(/[0-9]+/) });
  const r = g2parse(g, "12345");
  g2ok(r);
});

test("grammar2/engine: nonterm dispatches to named production", () => {
  const g = mkGrammar("s", {
    s:   g2.seq([g2.nonterm("a"), g2.nonterm("a")]),
    a:   g2.lit("hi"),
  });
  const r = g2parse(g, "hihi");
  g2ok(r);
});

test("grammar2/engine: guarded notFollowedBy succeeds when negative lookahead holds", () => {
  const g = mkGrammar("s", {
    s: g2.guarded(g2.lit("if"), g2.notFollowedBy(g2.cls("[a-zA-Z]"))),
  });
  const r = g2parse(g, "if");
  g2ok(r);
});

test("grammar2/engine: guarded notFollowedBy fails when lookahead matches", () => {
  const g = mkGrammar("s", {
    s: g2.guarded(g2.lit("if"), g2.notFollowedBy(g2.cls("[a-zA-Z]"))),
  });
  const r = g2parse(g, "iffy");
  g2fail(r);
});

test("grammar2/engine: reserved guard rejects keyword-matching idents", () => {
  const g = g2.makeGrammar({ start: "s" });
  g.reserved.set("keywords", new Set(["if", "then", "else"]));
  g2.addProduction(g, {
    name: "s",
    rule: g2.guarded(
      g2.regex(/[a-zA-Z]+/),
      g2.reserved("keywords"),
    ),
  });
  const ok = g2parse(g, "hello");
  g2ok(ok);
  const notOk = g2parse(g, "if");
  g2fail(notOk);
});

test("grammar2/engine: left-to-right alt order determines match (pre-analyzer)", () => {
  // "a+" matches one or more 'a'; order of alts in an alt means the shorter
  // literal wins if placed first. Phase 1 uses first-match semantics.
  const g = mkGrammar("s", {
    s: g2.alt([g2.lit("ab"), g2.lit("abc")]),
  });
  const r = g2parse(g, "abc");
  // "ab" matches but "abc" doesn't fully consume input — farthest-advance
  // error. This tests that first-match behavior is working as documented.
  g2fail(r);
});

test("grammar2/engine: @longest alt picks the longest match", () => {
  const g = mkGrammar("s", {
    s: g2.alt(
      [g2.lit("ab"), g2.lit("abc")],
      { longest: true },
    ),
  });
  const r = g2parse(g, "abc");
  g2ok(r);
});

// --- Regex DSL (§10.3 acceptance test) ---
// Build a regex grammar that matches character-level patterns: a*, b+, c?,
// alternation |, grouping (...). Then verify it parses a few regex strings.

// --- Phase 3: grammar analyzer ---


test("grammar2/analyzer: base grammar is clean", () => {
  const g = buildBaseG2();
  const report = g2analyze(g);
  eq(report.errors.length, 0, `errors: ${g2format(report)}`);
  eq(report.warnings.length, 0, `warnings: ${g2format(report)}`);
});

test("grammar2/analyzer: detects undefined nonterminal reference", () => {
  const g = g2.makeGrammar({ start: "s" });
  g2.addProduction(g, { name: "s", rule: g2.nonterm("missing") });
  const report = g2analyze(g);
  eq(report.errors.length >= 1, true);
  eq(report.errors.some(e => e.code === "E_UNDEFINED_NAME"), true);
});

test("grammar2/analyzer: detects undefined start production", () => {
  const g = g2.makeGrammar({ start: "missing" });
  g2.addProduction(g, { name: "other", rule: g2.lit("x") });
  const report = g2analyze(g);
  eq(report.errors.some(e => e.code === "E_UNDEFINED_START"), true);
});

test("grammar2/analyzer: detects unreachable production", () => {
  const g = g2.makeGrammar({ start: "s" });
  g2.addProduction(g, { name: "s",      rule: g2.lit("a") });
  g2.addProduction(g, { name: "orphan", rule: g2.lit("b") });
  const report = g2analyze(g);
  eq(report.warnings.some(w => w.code === "W_UNREACHABLE" && w.production === "orphan"), true);
});

test("grammar2/analyzer: detects infinite Rep (nullable item, no sep)", () => {
  const g = g2.makeGrammar({ start: "s" });
  g2.addProduction(g, { name: "s",
    rule: g2.rep(g2.opt(g2.lit("a")), { min: 0 }),
  });
  const report = g2analyze(g);
  eq(report.errors.some(e => e.code === "E_INFINITE_REP"), true);
});

test("grammar2/analyzer: computes nullability correctly", () => {
  const g = g2.makeGrammar({ start: "s" });
  g2.addProduction(g, { name: "s", rule: g2.opt(g2.lit("a")) });
  g2.addProduction(g, { name: "t", rule: g2.lit("b") });
  const report = g2analyze(g);
  eq(report.nullable.has("s"), true);
  eq(report.nullable.has("t"), false);
});

test("grammar2/analyzer: identifies direct left recursion", () => {
  const g = g2.makeGrammar({ start: "e" });
  g2.addProduction(g, { name: "e", rule: g2.alt([
    g2.seq([g2.nonterm("e"), g2.lit("+"), g2.nonterm("num")]),
    g2.nonterm("num"),
  ]) });
  g2.addProduction(g, { name: "num", rule: g2.regex(/[0-9]+/) });
  const report = g2analyze(g);
  eq(report.leftRec.has("e"), true);
  eq(report.leftRec.has("num"), false);
});

test("grammar2/analyzer: detects undefined reserved set", () => {
  const g = g2.makeGrammar({ start: "s" });
  g2.addProduction(g, { name: "s",
    rule: g2.guarded(g2.regex(/[a-z]+/), g2.reserved("undeclared_set")),
  });
  const report = g2analyze(g);
  eq(report.errors.some(e => e.code === "E_UNDEFINED_RESERVED_SET"), true);
});

test("grammar2/analyzer: computes FIRST sets for simple productions", () => {
  const g = g2.makeGrammar({ start: "s" });
  g2.addProduction(g, { name: "s", rule: g2.lit("hello") });
  const report = g2analyze(g);
  const firsts = report.first.get("s");
  eq(firsts!.length >= 1, true);
  eq(firsts!.some(e => e.kind === "literal" && (e as any).text === "hello"), true);
});

test("grammar2/analyzer: opt-in disjointness catches real ambiguity", () => {
  // Two alts that genuinely overlap: both start with 'a'.
  const g = g2.makeGrammar({ start: "s" });
  g2.addProduction(g, { name: "s", rule: g2.alt([
    g2.lit("apple"),
    g2.lit("apricot"),
  ]) });
  const report = analyzeWithDisjointnessCheck(g);
  eq(report.warnings.some(w => w.code === "W_ALT_OVERLAP"), true);
});


test("grammar2/analyzer: assertClean throws on grammar errors", () => {
  const g = g2.makeGrammar({ start: "s" });
  g2.addProduction(g, { name: "s", rule: g2.nonterm("missing") });
  let threw = false;
  try { g2assertClean(g); }
  catch (e: any) { threw = e.message.includes("E_UNDEFINED_NAME"); }
  eq(threw, true);
});

// --- Phase 5: Allegro-native analyzer (proof-of-concept) ---
//
// Verifies that the Allegro-implemented grammar analyzer in
// `lib/grammar-analyzer.alg` works end-to-end: parse a ~4KB .alg module,
// invoke its `check_defined` and `check_reachable` functions on a small
// grammar, compare results to the TS reference.
//
// Parse+eval of the analyzer module takes ~40s on current interpreter —
// the bulk of the time is parsing due to the stratified grammar's
// backtracking. Performance work is Phase 9.

let _analyzerCtx: any = null;
function loadAllegroAnalyzer(): any {
  if (_analyzerCtx) return _analyzerCtx;
  const src = fs.readFileSync("lib/grammar-analyzer.alg", "utf-8");
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  _analyzerCtx = evalCtx;
  return evalCtx;
}

/** Call an Allegro analyzer function with `(grammar)` and return the raw result Value. */
function callAllegroFn1(fnName: string, grammar: g2.Grammar): any {
  const evalCtx = loadAllegroAnalyzer();
  const fn = evalCtx.bindings.get(fnName)?.value;
  if (!fn) throw new Error(`${fnName} not found in analyzer context`);
  return evaluate(makeExpr(fn, [grammarToAllegro(grammar)]), evalCtx);
}

/** Call an Allegro analyzer function with `(grammar, nullable)` and return the raw result. */
function callAllegroFn2(fnName: string, grammar: g2.Grammar, nullable: any): any {
  const evalCtx = loadAllegroAnalyzer();
  const fn = evalCtx.bindings.get(fnName)?.value;
  if (!fn) throw new Error(`${fnName} not found in analyzer context`);
  return evaluate(makeExpr(fn, [grammarToAllegro(grammar), nullable]), evalCtx);
}

/** Extract an array of `{code, message, production}` error/warning records. */
function extractErrorList(result: any): { code?: string; message?: string; production?: string }[] {
  const p = result;
  if (p.kind !== ValueKind.Structure) return [];
  const len = Number((getSlotCount(p) as any)?.data ?? 0n);
  const out: { code?: string; message?: string; production?: string }[] = [];
  for (let i = 0; i < len; i++) {
    const entry = p.bindings.get(String(i))?.value;
    const entryP = entry!;
    if (entryP.kind === ValueKind.Structure) {
      const code = entryP.bindings.get("code")?.value;
      const msg = entryP.bindings.get("message")?.value;
      const prod = entryP.bindings.get("production")?.value;
      out.push({
        code:       code ? bitsToString(code as any) : undefined,
        message:    msg ? bitsToString(msg as any) : undefined,
        production: prod && (prod as any).kind === ValueKind.Bits ? bitsToString(prod as any) :
                    prod ? bitsToString(prod as any) : undefined,
      });
    }
  }
  return out;
}

/** Extract an array of strings from an Allegro Array result. */
function extractStringList(result: any): string[] {
  const p = result;
  if (p.kind !== ValueKind.Structure) return [];
  const len = Number((getSlotCount(p) as any)?.data ?? 0n);
  const out: string[] = [];
  for (let i = 0; i < len; i++) {
    const entry = p.bindings.get(String(i))?.value;
    if (!entry) continue;
    const entryP = entry;
    if (entryP.kind === ValueKind.Bits) out.push(bitsToString(entryP));
  }
  return out;
}

/** Legacy helper — returns error-list shape for `check_defined` / `check_reachable`. */
function callAllegroAnalyzer(fnName: string, grammar: g2.Grammar): any[] {
  return extractErrorList(callAllegroFn1(fnName, grammar));
}

test("Phase 5: Allegro analyzer detects undefined name (matches TS analyzer)", () => {
  const g = g2.makeGrammar({ start: "s" });
  g2.addProduction(g, { name: "s", rule: g2.seq([g2.lit("a"), g2.nonterm("missing")]) });

  // Allegro analyzer
  const algErrs = callAllegroAnalyzer("check_defined", g);
  // TS analyzer
  const tsReport = g2analyze(g);

  // Both should report exactly one E_UNDEFINED_NAME error.
  eq(algErrs.length, 1, "Allegro analyzer found 1 error");
  eq(algErrs[0].code, "E_UNDEFINED_NAME");
  eq(tsReport.errors.filter(e => e.code === "E_UNDEFINED_NAME").length, 1, "TS analyzer agrees");
});

test("Phase 5: Allegro analyzer detects unreachable production (matches TS analyzer)", () => {
  const g = g2.makeGrammar({ start: "s" });
  g2.addProduction(g, { name: "s",      rule: g2.lit("a") });
  g2.addProduction(g, { name: "orphan", rule: g2.lit("b") });

  const algWarns = callAllegroAnalyzer("check_reachable", g);
  const tsReport = g2analyze(g);

  eq(algWarns.length, 1);
  eq(algWarns[0].code, "W_UNREACHABLE");
  eq(algWarns[0].production, "orphan");
  eq(tsReport.warnings.filter(w => w.code === "W_UNREACHABLE" && w.production === "orphan").length, 1);
});

test("Phase 5: Allegro analyzer finds no errors in a clean grammar", () => {
  const g = g2.makeGrammar({ start: "s" });
  g2.addProduction(g, { name: "s", rule: g2.seq([g2.lit("a"), g2.nonterm("b")]) });
  g2.addProduction(g, { name: "b", rule: g2.lit("b") });

  const algErrs = callAllegroAnalyzer("check_defined", g);
  const algWarns = callAllegroAnalyzer("check_reachable", g);

  eq(algErrs.length, 0);
  eq(algWarns.length, 0);
});

test("Phase 5: Allegro analyzer detects undefined start production", () => {
  const g = g2.makeGrammar({ start: "missing_start" });
  g2.addProduction(g, { name: "s", rule: g2.lit("a") });

  const algErrs = callAllegroAnalyzer("check_defined", g);
  eq(algErrs.length, 1);
  eq(algErrs[0].code, "E_UNDEFINED_START");
});

test("Phase 5: Allegro analyzer computes nullability (matches TS reference)", () => {
  // s → opt("a") [nullable]; t → "b" [not nullable]; u → s [nullable, via s]
  const g = g2.makeGrammar({ start: "s" });
  g2.addProduction(g, { name: "s", rule: g2.opt(g2.lit("a")) });
  g2.addProduction(g, { name: "t", rule: g2.lit("b") });
  g2.addProduction(g, { name: "u", rule: g2.nonterm("s") });

  const algNullable = extractStringList(callAllegroFn1("compute_nullability", g)).sort();
  const tsReport = g2analyze(g);
  const tsNullable = [...tsReport.nullable].sort();

  eq(algNullable.join(","), tsNullable.join(","));
  eq(algNullable.includes("s"), true);
  eq(algNullable.includes("u"), true);
  eq(algNullable.includes("t"), false);
});

test("Phase 5: Allegro analyzer detects infinite-rep (rep of nullable with no sep)", () => {
  // s → (opt("a"))*  — rep of a nullable item with no non-nullable separator
  const g = g2.makeGrammar({ start: "s" });
  g2.addProduction(g, { name: "s", rule: g2.rep(g2.opt(g2.lit("a"))) });

  const nullable = callAllegroFn1("compute_nullability", g);
  const algErrs = extractErrorList(callAllegroFn2("check_infinite_rep", g, nullable));
  const tsReport = g2analyze(g);

  eq(algErrs.length, 1);
  eq(algErrs[0].code, "E_INFINITE_REP");
  eq(tsReport.errors.filter(e => e.code === "E_INFINITE_REP").length, 1);
});

test("Phase 5: Allegro analyzer passes rep with non-nullable item", () => {
  const g = g2.makeGrammar({ start: "s" });
  g2.addProduction(g, { name: "s", rule: g2.rep(g2.lit("a")) });

  const nullable = callAllegroFn1("compute_nullability", g);
  const algErrs = extractErrorList(callAllegroFn2("check_infinite_rep", g, nullable));
  eq(algErrs.length, 0);
});

test("Phase 5: Allegro analyzer detects undefined reserved set", () => {
  // s → guarded("x", reserved("missing_set")) — references a set that was never declared
  const g = g2.makeGrammar({ start: "s" });
  g2.addProduction(g, {
    name: "s",
    rule: g2.guarded(g2.lit("x"), g2.reserved("missing_set")),
  });

  const algErrs = extractErrorList(callAllegroFn1("check_reservations", g));
  const tsReport = g2analyze(g);

  eq(algErrs.length, 1);
  eq(algErrs[0].code, "E_UNDEFINED_RESERVED_SET");
  eq(tsReport.errors.filter(e => e.code === "E_UNDEFINED_RESERVED_SET").length, 1);
});

test("Phase 5: Allegro analyzer passes declared reserved set", () => {
  const g = g2.makeGrammar({ start: "s" });
  g.reserved.set("kw", new Set(["if", "then", "else"]));
  g2.addProduction(g, {
    name: "s",
    rule: g2.guarded(g2.regex(/[a-z]+/), g2.reserved("kw")),
  });

  const algErrs = extractErrorList(callAllegroFn1("check_reservations", g));
  eq(algErrs.length, 0);
});

test("Phase 5: Allegro analyzer detects left recursion (direct and via nullable prefix)", () => {
  // s → s "a" | "b"      — direct left recursion
  // t → opt(x) t "c" | "d"  — left recursion via nullable prefix
  const g = g2.makeGrammar({ start: "s" });
  g2.addProduction(g, {
    name: "s",
    rule: g2.alt([
      g2.seq([g2.nonterm("s"), g2.lit("a")]),
      g2.lit("b"),
    ]),
  });
  g2.addProduction(g, {
    name: "t",
    rule: g2.alt([
      g2.seq([g2.opt(g2.lit("x")), g2.nonterm("t"), g2.lit("c")]),
      g2.lit("d"),
    ]),
  });
  g2.addProduction(g, { name: "u", rule: g2.lit("u") }); // not LR

  const nullable = callAllegroFn1("compute_nullability", g);
  const algLR = extractStringList(callAllegroFn2("check_left_recursion", g, nullable)).sort();
  const tsReport = g2analyze(g);
  const tsLR = [...tsReport.leftRec].sort();

  eq(algLR.join(","), tsLR.join(","));
  eq(algLR.includes("s"), true);
  eq(algLR.includes("t"), true);
  eq(algLR.includes("u"), false);
});

test("Phase 5: Allegro analyze() top-level returns unified report", () => {
  // One grammar exercising every check at once.
  const g = g2.makeGrammar({ start: "s" });
  g2.addProduction(g, { name: "s",      rule: g2.seq([g2.lit("a"), g2.nonterm("missing")]) }); // E_UNDEFINED_NAME
  g2.addProduction(g, { name: "orphan", rule: g2.lit("b") });                                   // W_UNREACHABLE
  g2.addProduction(g, { name: "lr",     rule: g2.nonterm("lr") });                              // left rec (unreachable too)

  const result = callAllegroFn1("analyze", g);
  const p = result;
  eq(p.kind, ValueKind.Structure, "analyze returned an object");
  if (p.kind !== ValueKind.Structure) return;

  const errors   = extractErrorList(p.bindings.get("errors")!.value);
  const warnings = extractErrorList(p.bindings.get("warnings")!.value);
  const nullable = extractStringList(p.bindings.get("nullable")!.value);
  const leftRec  = extractStringList(p.bindings.get("leftRec")!.value);

  eq(errors.some(e => e.code === "E_UNDEFINED_NAME"), true);
  eq(warnings.some(w => w.code === "W_UNREACHABLE"), true);
  eq(Array.isArray(nullable), true);
  eq(leftRec.includes("lr"), true);
});

