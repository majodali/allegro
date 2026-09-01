// =============================================================================
// Grammar 2: grammar blocks, rule surgery, and Allegro-through-grammar2.
//
// Extracted from the single-file suite (suite split, lane B). Registrations
// run at import time; src/test/index.ts imports this module in suite order.
// =============================================================================

import { test, eq, throws } from "./harness.js";
import { g2ok, g2fail } from "./grammar2-engine.js";
import { evalStd, evalNum, typeExt } from "./fixtures.js";
import { evalSource as runtimeEval } from "../runtime.js";
import { asGrammarValue } from "../primitives.js";
import { Value, ValueKind, BitsValue, StructureValue, bitsToString } from "../types.js";
import { buildBaseGrammar } from "../grammar2/base-grammar.js";
import { buildProgram } from "../grammar2/tree-builder.js";
import { evaluate as evalVal } from "../evaluator.js";
import { resolveSymbols, buildEvalCtx, resolvePrimitives, typeLiterals } from "../runtime.js";
import { parse as g2parse } from "../grammar2/engine.js";
import { getGrammarWithFragments as g2getGrammarWithFragments } from "../grammar2/fragments.js";
import { getTypeName } from "../types-std.js";
import { getName, metaOf, getSlotCount } from "../slots.js";
import { testsDir } from "./alg-files.js";
import * as fs from "fs";
import * as path from "path";
import * as g2 from "../grammar2/types.js";
import { indexGet } from "../slots.js";

// --- Phase 6 step 3: grammar { … } block parsing ---
//
// Confirm the new `grammar { … }` atom parses into the expected tree
// (a chain of grammar_*_add primitive calls wrapped in
// grammar_fragment_finalize). Execution requires the primitives to be
// implemented (step 4), so these tests only assert on parse shape.

test("Phase 6: empty grammar block parses", () => {
  const g = buildBaseGrammar();
  const result = g2parse(g, "x = grammar { }\n");
  eq(result.ok, true, "empty grammar block parses");
});

test("Phase 6: infix decl in grammar block parses", () => {
  const g = buildBaseGrammar();
  const result = g2parse(g, 'x = grammar { infix "**" at(mul) right => (l, r) => l + r }\n');
  eq(result.ok, true, "infix decl parses");
});

test("Phase 6: multiple decls in grammar block parses", () => {
  const g = buildBaseGrammar();
  const src =
    'x = grammar {\n' +
    '  infix "**" at(mul) right => (l, r) => l + r\n' +
    '  prefix "neg" at(unary) => x => 0 - x\n' +
    '  expr_prefix "lazy" => e => e\n' +
    '}\n';
  const result = g2parse(g, src);
  eq(result.ok, true, `multi-decl grammar block parses (${result.ok ? "ok" : (result as any).error.message})`);
});

test("Phase 6: grammar as a parameter name still works (no reservation collision)", () => {
  const g = buildBaseGrammar();
  const result = g2parse(g, "f(grammar) => grammar.productions\n");
  eq(result.ok, true, "grammar as param name works");
});

test("Phase 6: grammar block evaluates to a Grammar value (infix)", () => {
  const src = 'x = grammar { infix "**" at(mul) right => (l, r) => l + r }\n';
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const xVal = evalCtx.bindings.get("x")?.value;
  const data = xVal ? asGrammarValue(xVal) : undefined;
  eq(data !== undefined, true, "x is a Grammar value");
  if (!data) return;
  eq(data.baseChain.join(","), "allegro");
  eq(data.fragment.infix.length, 1);
  eq(data.fragment.infix[0].token, "**");
  eq(data.fragment.infix[0].level, "mul");
  eq(data.fragment.infix[0].assoc, "right");
});

test("Phase 6: grammar block accumulates multiple decl kinds", () => {
  const src =
    'x = grammar {\n' +
    '  infix "**" at(mul) right => (l, r) => l + r\n' +
    '  prefix "neg" at(unary) => y => 0 - y\n' +
    '  expr_prefix "lazy" => e => e\n' +
    '}\n';
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const xVal = evalCtx.bindings.get("x")?.value;
  const data = xVal ? asGrammarValue(xVal) : undefined;
  eq(data !== undefined, true);
  if (!data) return;
  eq(data.fragment.infix.length, 1);
  eq(data.fragment.prefixOp.length, 1);
  eq(data.fragment.exprPrefix.length, 1);
  eq(data.fragment.infix[0].token, "**");
  eq(data.fragment.prefixOp[0].token, "neg");
  eq(data.fragment.prefixOp[0].level, "unary");
  eq(data.fragment.exprPrefix[0].keyword, "lazy");
  // `neg` is tracked as a user keyword (distinguishes from the ident `neg`).
  eq(data.fragment.operators.includes("neg"), true);
  eq(data.fragment.keywords.includes("lazy"), true);
});

test("Phase 6: prec(pow) above(mul) below(unary) declares named level with constraints", () => {
  const src =
    'x = grammar {\n' +
    '  infix "**" prec(pow) above(mul) below(unary) right => (l, r) => l + r\n' +
    '}\n';
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const data = asGrammarValue(evalCtx.bindings.get("x")!.value!);
  eq(data !== undefined, true);
  if (!data) return;
  eq(data.fragment.infix[0].level, "pow");
  const prec = data.fragment.precedence ?? [];
  const pow  = prec.find(p => p.name === "pow");
  eq(pow !== undefined, true, "pow precedence declared");
  if (!pow) return;
  eq(pow.constraints.some(c => c.kind === "above" && c.target === "mul"), true);
  eq(pow.constraints.some(c => c.kind === "below" && c.target === "unary"), true);
});

test("Phase 6: anonymous above(mul) below(unary) gensyms a level name", () => {
  const src =
    'x = grammar { infix "**" above(mul) below(unary) right => (l, r) => l + r }\n';
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const data = asGrammarValue(evalCtx.bindings.get("x")!.value!);
  eq(data !== undefined, true);
  if (!data) return;
  const anonLevel = data.fragment.infix[0].level!;
  // Anonymity is checked by exclusion, not by the gensym's slot prefix:
  // internal `__*` names are not the suite's to assert (C0, 2026-08). A
  // minted level is a NEW one — neither of the two it was positioned
  // between — and the fragment declares it (asserted just below).
  eq(anonLevel !== "mul" && anonLevel !== "unary", true,
     `level is anonymous (got ${anonLevel})`);
  const prec = data.fragment.precedence ?? [];
  eq(prec.length, 1, "one precedence decl");
  eq(prec[0].name, anonLevel);
});

test("Phase 6: at(\"*\") resolves to mul via operator-symbol lookup", () => {
  const src = 'x = grammar { infix "**" at("*") right => (l, r) => l + r }\n';
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const data = asGrammarValue(evalCtx.bindings.get("x")!.value!);
  eq(data !== undefined, true);
  if (!data) return;
  eq(data.fragment.infix[0].level, "mul", "at(\"*\") resolves to mul");
});

test("Phase 6 step 5b: level insertion creates expr_pow production in merged grammar", () => {
  const src =
    'x = grammar {\n' +
    '  infix "**" prec(pow) above(mul) below(unary) right => (l, r) => l + r\n' +
    '}\n';
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const data = asGrammarValue(evalCtx.bindings.get("x")!.value!);
  eq(data !== undefined, true);
  if (!data) return;
  // Now merge into base grammar and check the result.
  const merged = g2getGrammarWithFragments([data.fragment]);
  eq(merged.productions.has("expr_pow"), true, "expr_pow production exists");
  // expr_mul should now reference expr_pow (not expr_of) as its tighter neighbour.
  const mulProd = merged.productions.get("expr_mul")!;
  const mulStr  = JSON.stringify(mulProd);
  eq(mulStr.includes("expr_pow"), true, "expr_mul threads through expr_pow");
  // expr_pow should include a user-op alternative (tag starts with user_op_).
  const powProd = merged.productions.get("expr_pow")!;
  const powStr  = JSON.stringify(powProd);
  eq(powStr.includes("user_op_"), true, "expr_pow contains a user_op_ tagged alt");
  // The insertion preserves the intermediate `of` level — pow sits between
  // mul and of, so pow falls through to of (NOT directly to unary).
  eq(powStr.includes("expr_of"), true, "expr_pow falls through to expr_of (chain preserved)");
});

test("Phase 6 step 5b: at(mul) appends to existing mul level, no new production", () => {
  // Using a bare symbol as the body (not a lambda) keeps the tree-builder
  // path identical across assoc variants.
  const src =
    'f = (l, r) => l + r\n' +
    'x = grammar { infix "++" at(mul) left => (l, r) => l + r }\n';
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const data = asGrammarValue(evalCtx.bindings.get("x")!.value!);
  eq(data !== undefined, true);
  if (!data) return;
  const merged = g2getGrammarWithFragments([data.fragment]);
  // No new production created.
  eq(merged.productions.has("expr_pow"), false);
  // expr_mul should contain the user-op alt.
  const mulStr = JSON.stringify(merged.productions.get("expr_mul"));
  eq(mulStr.includes("user_op_"), true, "expr_mul contains the user_op_ alt");
});

test("Phase 6: multiple infix regs sharing prec(X) share one level decl", () => {
  const src =
    'x = grammar {\n' +
    '  infix "^^" prec(pow) above(mul) right => (l, r) => l + r\n' +
    '  infix "**" prec(pow) right => (l, r) => l * r\n' +
    '}\n';
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const data = asGrammarValue(evalCtx.bindings.get("x")!.value!);
  eq(data !== undefined, true);
  if (!data) return;
  const prec = data.fragment.precedence ?? [];
  const pow  = prec.filter(p => p.name === "pow");
  eq(pow.length, 1, "pow declared only once");
  eq(data.fragment.infix.length, 2);
  eq(data.fragment.infix[0].level, "pow");
  eq(data.fragment.infix[1].level, "pow");
});

// --- Phase 6b step 1: EBNF + rule/expr_form/stmt_form syntax parses ---

test("Phase 6b: rule_decl with EBNF body parses", () => {
  const g = buildBaseGrammar();
  const src =
    'x = grammar {\n' +
    '  rule match_case = p:expr "=>" e:expr => {p: p, e: e}\n' +
    '}\n';
  const r = g2parse(g, src);
  eq(r.ok, true, `parse ok (${r.ok ? "" : (r as any).error.message})`);
});

test("Phase 6b: rule_decl with `+=` parses", () => {
  const g = buildBaseGrammar();
  const src =
    'x = grammar {\n' +
    '  rule expr_add += expr_add "xor" expr_mul => (l, r) => l + r\n' +
    '}\n';
  const r = g2parse(g, src);
  eq(r.ok, true);
});

test("Phase 6b: expr_form with multi-token body parses", () => {
  const g = buildBaseGrammar();
  const src =
    'x = grammar {\n' +
    '  expr_form "match" s:expr "with" cs:match_list => (s, cs) => cs\n' +
    '}\n';
  const r = g2parse(g, src);
  eq(r.ok, true, `parse ok (${r.ok ? "" : (r as any).error.message})`);
});

test("Phase 6b: stmt_form with block parses", () => {
  const g = buildBaseGrammar();
  const src =
    'x = grammar {\n' +
    '  stmt_form "for" v:ident "in" xs:expr ":" body:block_expr => (v, xs, body) => body\n' +
    '}\n';
  const r = g2parse(g, src);
  eq(r.ok, true);
});

test("Phase 6b: EBNF postfix / alt / sep-rep all parse", () => {
  const g = buildBaseGrammar();
  const src =
    'x = grammar {\n' +
    '  rule a = "foo"* => l => l\n' +
    '  rule b = "foo"+ => l => l\n' +
    '  rule c = "foo"? => l => l\n' +
    '  rule d = item ** "," => l => l\n' +
    '  rule e = "a" | "b" | "c" => x => x\n' +
    '  rule f = (item | other) => x => x\n' +
    '}\n';
  const r = g2parse(g, src);
  eq(r.ok, true, `parse ok (${r.ok ? "" : (r as any).error.message})`);
});

test("Phase 6b: EBNF regex literal parses", () => {
  const g = buildBaseGrammar();
  const src =
    'x = grammar {\n' +
    '  rule hex = /[0-9a-fA-F]+/ => x => x\n' +
    '}\n';
  const r = g2parse(g, src);
  eq(r.ok, true);
});

// --- Phase 6b step 2: tree-builder + primitives populate fragment ---

test("Phase 6b: rule_decl populates fragment.rules", () => {
  const src =
    'x = grammar {\n' +
    '  rule match_case = p:expr "=>" e:expr => (p, e) => {p: p, e: e}\n' +
    '}\n';
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const data = asGrammarValue(evalCtx.bindings.get("x")!.value!);
  eq(data !== undefined, true);
  if (!data) return;
  const rules = data.fragment.rules ?? [];
  eq(rules.length, 1, "one user rule");
  eq(rules[0].name, "match_case");
  eq(rules[0].op,   "add");
});

test("Phase 6b: expr_form_decl populates fragment.exprForms", () => {
  const src =
    'x = grammar {\n' +
    '  expr_form "match" s:expr "with" cs:expr => (s, cs) => cs\n' +
    '}\n';
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const data = asGrammarValue(evalCtx.bindings.get("x")!.value!);
  eq(data !== undefined, true);
  if (!data) return;
  const forms = data.fragment.exprForms ?? [];
  eq(forms.length, 1, "one expr_form");
  eq(forms[0].rule !== undefined, true);
});

test("Phase 6b: stmt_form_decl populates fragment.stmtForms", () => {
  const src =
    'x = grammar {\n' +
    '  stmt_form "for" v:ident "in" xs:expr ":" body:block_expr => (v, xs, body) => body\n' +
    '}\n';
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const data = asGrammarValue(evalCtx.bindings.get("x")!.value!);
  eq(data !== undefined, true);
  if (!data) return;
  const forms = data.fragment.stmtForms ?? [];
  eq(forms.length, 1, "one stmt_form");
});

test("Phase 6b: rule_decl with += populates op=append", () => {
  const src =
    'x = grammar {\n' +
    '  rule expr_add += expr_add "xor" expr_mul => (l, op, r) => l + r\n' +
    '}\n';
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const data = asGrammarValue(evalCtx.bindings.get("x")!.value!);
  eq(data !== undefined, true);
  if (!data) return;
  const rules = data.fragment.rules ?? [];
  eq(rules.length, 1);
  eq(rules[0].op, "append");
});

// --- Phase 6 step 7: conflict detection ---

test("Phase 6 step 7: duplicate infix op across fragments → E_OPERATOR_CONFLICT", () => {
  const src1 = 'a = grammar { infix "**" at(mul) right => (l, r) => l + r }\n';
  const src2 = 'b = grammar { infix "**" at(mul) right => (l, r) => l * r }\n';
  const { evalCtx: c1 } = runtimeEval(src1, undefined, [typeExt], undefined, true);
  const { evalCtx: c2 } = runtimeEval(src2, undefined, [typeExt], undefined, true);
  const f1 = asGrammarValue(c1.bindings.get("a")!.value!)!.fragment;
  const f2 = asGrammarValue(c2.bindings.get("b")!.value!)!.fragment;
  let threw = false, msg = "";
  try { g2getGrammarWithFragments([f1, f2]); }
  catch (e: any) { threw = true; msg = e.message; }
  eq(threw, true, "conflict throws");
  eq(msg.includes("E_OPERATOR_CONFLICT"), true, `error mentions E_OPERATOR_CONFLICT: ${msg}`);
  eq(msg.includes("**"), true);
});

test("Phase 6 step 7: user infix shadowing a base operator → E_OPERATOR_CONFLICT", () => {
  const src = 'x = grammar { infix "+" at(add) left => (l, r) => l * r }\n';
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const frag = asGrammarValue(evalCtx.bindings.get("x")!.value!)!.fragment;
  let threw = false, msg = "";
  try { g2getGrammarWithFragments([frag]); }
  catch (e: any) { threw = true; msg = e.message; }
  eq(threw, true, "base-shadow throws");
  eq(msg.includes("E_OPERATOR_CONFLICT"), true);
  eq(msg.includes("base grammar"), true, "error mentions base grammar");
});

test("Phase 6 step 7: duplicate expr_prefix keyword → E_KEYWORD_CONFLICT", () => {
  const src1 = 'a = grammar { expr_prefix "lazy" => e => e }\n';
  const src2 = 'b = grammar { expr_prefix "lazy" => e => e }\n';
  const { evalCtx: c1 } = runtimeEval(src1, undefined, [typeExt], undefined, true);
  const { evalCtx: c2 } = runtimeEval(src2, undefined, [typeExt], undefined, true);
  const f1 = asGrammarValue(c1.bindings.get("a")!.value!)!.fragment;
  const f2 = asGrammarValue(c2.bindings.get("b")!.value!)!.fragment;
  let threw = false, msg = "";
  try { g2getGrammarWithFragments([f1, f2]); }
  catch (e: any) { threw = true; msg = e.message; }
  eq(threw, true);
  eq(msg.includes("E_KEYWORD_CONFLICT"), true, `error mentions E_KEYWORD_CONFLICT: ${msg}`);
});

test("Phase 6 step 7: expr_prefix shadowing a base keyword → E_KEYWORD_CONFLICT", () => {
  const src = 'x = grammar { expr_prefix "if" => e => e }\n';
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const frag = asGrammarValue(evalCtx.bindings.get("x")!.value!)!.fragment;
  let threw = false, msg = "";
  try { g2getGrammarWithFragments([frag]); }
  catch (e: any) { threw = true; msg = e.message; }
  eq(threw, true);
  eq(msg.includes("E_KEYWORD_CONFLICT"), true);
  eq(msg.includes("base reserved"), true);
});

test("Phase 6 step 7: cyclic precedence → E_PRECEDENCE_CYCLE", () => {
  // Two levels each claiming to be above the other.
  const src =
    'x = grammar {\n' +
    '  infix "@@" prec(a) above(b) right => (l, r) => l + r\n' +
    '  infix "##" prec(b) above(a) right => (l, r) => l + r\n' +
    '}\n';
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const frag = asGrammarValue(evalCtx.bindings.get("x")!.value!)!.fragment;
  let threw = false, msg = "";
  try { g2getGrammarWithFragments([frag]); }
  catch (e: any) { threw = true; msg = e.message; }
  eq(threw, true, "cycle throws");
  eq(msg.includes("E_PRECEDENCE_CYCLE"), true, `error mentions E_PRECEDENCE_CYCLE: ${msg}`);
});

test("Phase 6 step 7: non-cyclic constraints between two user levels are fine", () => {
  // a tighter than mul, b tighter than a — linear chain, no cycle.
  const src =
    'x = grammar {\n' +
    '  infix "@@" prec(a) above(mul) right => (l, r) => l + r\n' +
    '  infix "##" prec(b) above(a)   right => (l, r) => l + r\n' +
    '}\n';
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const frag = asGrammarValue(evalCtx.bindings.get("x")!.value!)!.fragment;
  const merged = g2getGrammarWithFragments([frag]);    // must not throw
  eq(merged.productions.has("expr_a"), true);
  eq(merged.productions.has("expr_b"), true);
});

// --- Phase 7a thread 1: `new grammar` + `extends X` ---

test("Phase 7a: `grammar { … }` defaults to baseChain = [allegro]", () => {
  const src = 'x = grammar { infix "**" at(mul) right => (l, r) => l + r }\n';
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const data = asGrammarValue(evalCtx.bindings.get("x")!.value!);
  eq(data !== undefined, true);
  if (!data) return;
  eq(data.baseChain.join(","), "allegro");
});

test("Phase 7a: `new grammar { … }` has baseChain = [empty]", () => {
  const src = 'x = new grammar { infix "**" at(mul) right => (l, r) => l + r }\n';
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const data = asGrammarValue(evalCtx.bindings.get("x")!.value!);
  eq(data !== undefined, true);
  if (!data) return;
  eq(data.baseChain.join(","), "empty");
});

// --- Phase 7c: selector-based rule surgery ---

test("Phase 7c: `rule foo -= alt` removes the named alternative", () => {
  const src =
    'x = grammar {\n' +
    '  rule expr_add -= sub\n' +
    '}\n';
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const frag = asGrammarValue(evalCtx.bindings.get("x")!.value!)!.fragment;
  const merged = g2getGrammarWithFragments([frag]);
  const addProd = merged.productions.get("expr_add")!;
  const addStr  = JSON.stringify(addProd);
  // The `sub` alternative is gone; `add` still there.
  eq(addStr.includes(`"name":"sub"`), false, "sub alt removed");
  eq(addStr.includes(`"name":"add"`), true,  "add alt preserved");
});

test("Phase 7c: removing a non-existent alt errors", () => {
  const src =
    'x = grammar {\n' +
    '  rule expr_add -= bogus\n' +
    '}\n';
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const frag = asGrammarValue(evalCtx.bindings.get("x")!.value!)!.fragment;
  let threw = false;
  let msg = "";
  try { g2getGrammarWithFragments([frag]); }
  catch (e: any) { threw = true; msg = e.message; }
  eq(threw, true);
  eq(msg.includes("bogus"), true);
});

test("Phase 7c: `rule foo[alt] = body => template` replaces a specific alternative", () => {
  const src =
    'x = grammar {\n' +
    '  rule expr_add[sub] = expr_add "-" expr_mul => (l, _, r) => l + r\n' +
    '}\n';
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const frag = asGrammarValue(evalCtx.bindings.get("x")!.value!)!.fragment;
  const merged = g2getGrammarWithFragments([frag]);
  const addStr = JSON.stringify(merged.productions.get("expr_add")!);
  // The old `sub`-named alt is replaced by a seq whose wrapper is tagged
  // user_op_<N>_rule_ (from the template wrapper).
  eq(addStr.includes(`"name":"sub"`), false, "old sub alt removed");
  eq(addStr.includes("user_op_"), true, "new user_op alt present");
});

test("Phase 7a thread 8: two fragments with incompatible bases trigger E_INCOMPATIBLE_GRAMMARS", () => {
  const src1 = 'a = grammar { infix "**" at(mul) right => (l, r) => l + r }\n';
  const src2 = 'b = new grammar { infix "^^" at(add) left => (l, r) => l + r }\n';
  const { evalCtx: c1 } = runtimeEval(src1, undefined, [typeExt], undefined, true);
  const { evalCtx: c2 } = runtimeEval(src2, undefined, [typeExt], undefined, true);
  const f1 = asGrammarValue(c1.bindings.get("a")!.value!)!.fragment;
  const f2 = asGrammarValue(c2.bindings.get("b")!.value!)!.fragment;
  let threw = false, msg = "";
  try { g2getGrammarWithFragments([f1, f2]); }
  catch (e: any) { threw = true; msg = e.message; }
  eq(threw, true, "incompatible bases throws");
  eq(msg.includes("E_INCOMPATIBLE_GRAMMARS"), true, `error mentions E_INCOMPATIBLE_GRAMMARS: ${msg}`);
});

test("Phase 7a thread 8: rule shadowing a base production emits W_PRODUCTION_REPLACED", () => {
  // Rewriting `expr_atom` with a user rule shadows the base. Capture console.warn.
  const src =
    'x = grammar {\n' +
    '  rule expr_atom = "foo" => x => x\n' +
    '}\n';
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const frag = asGrammarValue(evalCtx.bindings.get("x")!.value!)!.fragment;
  const warnings: string[] = [];
  const origWarn = console.warn;
  console.warn = (msg: string) => warnings.push(msg);
  try { g2getGrammarWithFragments([frag]); }
  finally { console.warn = origWarn; }
  eq(warnings.some(w => w.includes("W_PRODUCTION_REPLACED")), true, "warning emitted");
  eq(warnings.some(w => w.includes("expr_atom")), true, "warning mentions expr_atom");
});

test("Phase 7a: `grammar extends X { … }` chains onto X's baseChain", () => {
  const src =
    'base_g = grammar { infix "**" at(mul) right => (l, r) => l + r }\n' +
    'derived = grammar extends base_g { infix "^^" at(add) left => (l, r) => l * r }\n';
  const { evalCtx } = runtimeEval(src, undefined, [typeExt], undefined, true);
  const baseG    = asGrammarValue(evalCtx.bindings.get("base_g")!.value!);
  const derived  = asGrammarValue(evalCtx.bindings.get("derived")!.value!);
  eq(baseG !== undefined, true);
  eq(derived !== undefined, true);
  if (!baseG || !derived) return;
  eq(baseG.baseChain.join(","), "allegro", "base chain is allegro");
  eq(derived.baseChain.join(","), "allegro", "derived inherits base_g's chain");
  // Derived cumulatively contains both operators.
  eq(derived.fragment.infix.length, 2, "derived has both infix ops");
  const tokens = derived.fragment.infix.map(i => i.token).sort();
  eq(tokens.join(","), "**,^^");
});

test("Phase 6: tree-builder lowers grammar block to finalize(add(new))", () => {
  const g = buildBaseGrammar();
  const result = g2parse(g, 'x = grammar { infix "**" at(mul) right => (l, r) => l + r }\n');
  eq(result.ok, true);
  if (!result.ok) return;
  const program = buildProgram(result.tree);
  // The binding `x` should be an Expression calling grammar_fragment_finalize.
  const xBinding = program.bindings.get("x");
  eq(xBinding !== undefined, true, "x binding exists");
  const xVal = xBinding.value;
  eq(xVal.kind, ValueKind.Expression, "x is an Expression");
  const fnName = (xVal.fn && xVal.fn.name) ? xVal.fn.name : "?";
  eq(fnName, "grammar_fragment_finalize", `outer call is finalize, got ${fnName}`);
});

// --- Phase 2b: base (Allegretto) grammar in grammar2 formalism ---


function parseBase2(source: string): any {
  const g = buildBaseGrammar();
  const normalized = source.replace(/\r\n/g, "\n");
  const result = g2parse(g, normalized);
  if (!result.ok) throw new Error(`Parse failed: ${result.error.message}`);
  return buildProgram(result.tree);
}

function evalBase2(source: string): any {
  const fileCtx = parseBase2(source);
  for (const b of fileCtx.bindingList) {
    if (b.value !== undefined) b.value = resolvePrimitives(b.value);
  }
  resolveSymbols(fileCtx, undefined, undefined, false);
  const ctx = buildEvalCtx(fileCtx, undefined, undefined, false);
  let last: any = null;
  for (const b of fileCtx.bindingList) {
    if (b.value !== undefined) {
      const r = evalVal(b.value, ctx);
      if (b.key === null) last = r;
    }
  }
  return last;
}

/** Evaluate a source through grammar2 in Standard mode (type system active). */
function evalStandard2(source: string): any {
  const fileCtx = parseBase2(source);
  const extensions = [typeExt];
  for (const b of fileCtx.bindingList) {
    if (b.value !== undefined) b.value = resolvePrimitives(b.value);
  }
  // typeLiterals: wraps raw Bits with type info (Int for 64-bit, String otherwise).
  // Runs before symbol resolution.
  for (const b of fileCtx.bindingList) {
    if (b.value !== undefined) b.value = typeLiterals(b.value);
  }
  resolveSymbols(fileCtx, undefined, extensions, true);
  const ctx = buildEvalCtx(fileCtx, undefined, extensions, true);
  let last: any = null;
  for (const b of fileCtx.bindingList) {
    if (b.value !== undefined) {
      const r = evalVal(b.value, ctx);
      // Mirror evalSource's loop: WRITE BACK the evaluated value (into the
      // EVAL CTX binding — source references stay Symbols and resolve
      // through it at runtime) so later references see the constructed
      // object instead of re-evaluating the construction expression.
      // C5.2b made the difference observable: re-running a
      // `Interface.define(...)` expression mints a fresh member scope, so
      // symbol-identity conformance would spuriously fail against a
      // second construction of the "same" interface.
      if (b.key !== null) {
        b.value = r;
        const ctxBinding = ctx.bindings.get(b.key);
        if (ctxBinding) ctxBinding.value = r;
      } else {
        last = r;
      }
    }
  }
  return last;
}

test("grammar2/base: integer literal", () => {
  const g = buildBaseGrammar();
  const r = g2parse(g, "42");
  g2ok(r);
});

test("grammar2/base: simple binding", () => {
  const g = buildBaseGrammar();
  const r = g2parse(g, "x = 42");
  g2ok(r);
});

test("grammar2/base: binding evaluates", () => {
  const r = evalBase2("x = 42\nx");
  eq(Number((r as BitsValue).data), 42);
});

test("grammar2/base: arithmetic evaluates", () => {
  const r = evalBase2("3 + 4");
  eq(Number((r as BitsValue).data), 7);
});

test("grammar2/base: precedence — mul tighter than add", () => {
  const r = evalBase2("3 + 4 * 2");
  eq(Number((r as BitsValue).data), 11);
});

test("grammar2/base: parentheses override precedence", () => {
  const r = evalBase2("(3 + 4) * 2");
  eq(Number((r as BitsValue).data), 14);
});

test("grammar2/base: comparison returns bits", () => {
  const r = evalBase2("3 == 3");
  // bits_eq returns 1 on equal
  eq(Number((r as BitsValue).data), 1);
});

test("grammar2/base: if-then-else selects branch", () => {
  const r = evalBase2("if 1 then 42 else 0");
  eq(Number((r as BitsValue).data), 42);
});

test("grammar2/base: function definition and call", () => {
  const r = evalBase2("double(n) => n * 2\ndouble(21)");
  eq(Number((r as BitsValue).data), 42);
});

test("grammar2/base: factorial (recursive)", () => {
  const r = evalBase2("fact(n) => if n == 0 then 1 else n * fact(n - 1)\nfact(5)");
  eq(Number((r as BitsValue).data), 120);
});

test("grammar2/base: lambda", () => {
  const r = evalBase2("apply(f, x) => f(x)\napply(n => n + 10, 32)");
  eq(Number((r as BitsValue).data), 42);
});

test("grammar2/base: fib", () => {
  const r = evalBase2("fib(n) => if n <= 1 then n else fib(n - 1) + fib(n - 2)\nfib(10)");
  eq(Number((r as BitsValue).data), 55);
});

// --- Phase 2c-1: typed literals, dot access, bracket indexing ---

test("grammar2/std: float literal produces Float-typed value", () => {
  const r = evalStandard2("3.14");
  eq(getTypeName(r), "Float");
});

test("grammar2/std: true/false resolve to Bool values", () => {
  const r1 = evalStandard2("true");
  const r2 = evalStandard2("false");
  eq(getTypeName(r1), "Bool");
  eq(getTypeName(r2), "Bool");
});

test("grammar2/std: none resolves to None singleton", () => {
  const r = evalStandard2("none");
  eq(getTypeName(r), "None");
});

test("grammar2/std: string literal produces String-typed value", () => {
  const r = evalStandard2('"hello"');
  eq(getTypeName(r), "String");
});

test("grammar2/std: dot access — string length getter", () => {
  const r = evalStandard2('"hello".length');
  eq(Number((r as BitsValue).data), 5);
});

test("grammar2/std: dot access — string method call", () => {
  const r = evalStandard2('"hello".slice(0, 3)');
  eq(bitsToString(r as BitsValue), "hel");
});

test("grammar2/std: dot access — Int.toString()", () => {
  const r = evalStandard2("42.toString()");
  eq(bitsToString(r as BitsValue), "42");
});

test("grammar2/std: dot access — Float.toString()", () => {
  const r = evalStandard2("3.14.toString()");
  eq(bitsToString(r as BitsValue), "3.14");
});

test("grammar2/std: dot access — Bool.toString()", () => {
  const r = evalStandard2("true.toString()");
  eq(bitsToString(r as BitsValue), "true");
});

test("grammar2/std: chained dot access and method calls", () => {
  const r = evalStandard2('"hello".indexOf("ll")');
  eq(Number((r as BitsValue).data), 2);
});

test("grammar2/std: bound variable dot access", () => {
  const r = evalStandard2('s = "a,b,c".split(",")\ns.length');
  eq(Number((r as BitsValue).data), 3);
});

test("grammar2/std: bracket indexing on array", () => {
  // `.split(",")` returns an Array[String]. arr[0] dispatches through
  // the array's `get` method.
  const r = evalStandard2('arr = "a,b,c".split(",")\narr[1]');
  eq(bitsToString(r as BitsValue), "b");
});

// --- Phase 2c-2: collection literals + string interpolation ---

test("grammar2/std: array literal", () => {
  const r = evalStandard2("[1, 2, 3]");
  eq(getTypeName(r), "Array");
});

test("grammar2/std: array element access via bracket", () => {
  const r = evalStandard2("[10, 20, 30][1]");
  eq(Number((r as BitsValue).data), 20);
});

test("grammar2/std: empty array", () => {
  const r = evalStandard2("[]");
  eq(getTypeName(r), "Array");
});

test("grammar2/std: array map method", () => {
  const r = evalStandard2("[1, 2, 3].map(x => x * 2).length");
  eq(Number((r as BitsValue).data), 3);
});

test("grammar2/std: object literal", () => {
  const r = evalStandard2("{x: 10, y: 20}");
  eq(getTypeName(r), "Object");
});

test("grammar2/std: object field access via dot", () => {
  const r = evalStandard2("p = {x: 10, y: 20}\np.x");
  eq(Number((r as BitsValue).data), 10);
});

test("grammar2/std: nested object field access", () => {
  const r = evalStandard2("nested = {a: {b: 42}}\nnested.a.b");
  eq(Number((r as BitsValue).data), 42);
});

test("grammar2/std: string interpolation", () => {
  const r = evalStandard2('name = "world"\n"hello {name}"');
  eq(bitsToString(r as BitsValue), "hello world");
});

test("grammar2/std: string interpolation with expression", () => {
  const r = evalStandard2('"2 + 2 = {2 + 2}"');
  eq(bitsToString(r as BitsValue), "2 + 2 = 4");
});

test("grammar2/std: escaped braces in string", () => {
  const r = evalStandard2('"\\{literal\\}"');
  eq(bitsToString(r as BitsValue), "{literal}");
});

test("grammar2/std: array concat method", () => {
  const r = evalStandard2("[1, 2].concat([3, 4]).length");
  eq(Number((r as BitsValue).data), 4);
});

test("grammar2/std: array filter/reduce chain", () => {
  const r = evalStandard2("[1, 2, 3, 4, 5].filter(x => x > 2).reduce((a, x) => a + x, 0)");
  eq(Number((r as BitsValue).data), 12);
});

test("grammar2/std: object with multiple fields", () => {
  const r = evalStandard2("{a: 1, b: 2, c: 3}.b");
  eq(Number((r as BitsValue).data), 2);
});

test("grammar2/std: empty object literal", () => {
  const r = evalStandard2("{}");
  eq(getTypeName(r), "Object");
});

test("grammar2/std: array of objects with .map on field", () => {
  const r = evalStandard2(
    'people = [{name: "Alice", age: 30}, {name: "Bob", age: 25}]\npeople.map(p => p.name).length'
  );
  eq(Number((r as BitsValue).data), 2);
});

// --- Phase 2c-4: keyword operators ---

test("grammar2/std: instanceof operator", () => {
  const r = evalStandard2("42 instanceof Int");
  eq(Number((r as BitsValue).data), 1);
});

test("grammar2/std: subtypeof operator", () => {
  const r = evalStandard2("Type subtypeof Type");
  eq(Number((r as BitsValue).data), 1);
});

test("grammar2/std: `and` keyword as logical and", () => {
  const r = evalStandard2("true and false");
  eq(Number((r as BitsValue).data), 0);
});

test("grammar2/std: `or` keyword as logical or", () => {
  const r = evalStandard2("false or true");
  eq(Number((r as BitsValue).data), 1);
});

test("grammar2/std: `of` infix accesses MultiValue component", () => {
  // `type of 42` returns the Int type (a raw Context). Verify it's a Context
  // with name "Int".
  const r = evalStandard2("type of 42");
  const p = r!;
  eq(p.kind, ValueKind.Structure);
  const nameBind = getName(p as StructureValue);
  eq(bitsToString(nameBind as BitsValue), "Int");
});

test("grammar2/std: `error expr` creates an error value", () => {
  const r = evalStandard2('error "something broke"');
  eq(metaOf(r!).has("error"), true);
});

test("grammar2/std: `error of x` extracts error component", () => {
  const r = evalStandard2('x = error "boom"\nerror of x');
  eq(bitsToString(r as BitsValue), "boom");
});

// --- Phase 2c-4: type annotations ---

test("grammar2/std: typed function params", () => {
  const r = evalStandard2("add(x: Int, y: Int) => x + y\nadd(3, 4)");
  eq(Number((r as BitsValue).data), 7);
});

test("grammar2/std: typed function return type", () => {
  const r = evalStandard2("double(x: Int): Int => x * 2\ndouble(21)");
  eq(Number((r as BitsValue).data), 42);
});

test("grammar2/std: typed lambda (paren form)", () => {
  const r = evalStandard2("mul = (x: Int, y: Int) => x * y\nmul(6, 7)");
  eq(Number((r as BitsValue).data), 42);
});

test("grammar2/std: typed lambda (single-param form)", () => {
  const r = evalStandard2("f = x: Int => x * 2\nf(21)");
  eq(Number((r as BitsValue).data), 42);
});

test("grammar2/std: binding type annotation", () => {
  const r = evalStandard2("x: Int = 42\nx");
  eq(Number((r as BitsValue).data), 42);
});

test("grammar2/std: generic type annotation Array[Int]", () => {
  const r = evalStandard2("head(arr: Array[Int]): Int => arr[0]\nhead([10, 20, 30])");
  eq(Number((r as BitsValue).data), 10);
});

test("grammar2/std: mixed typed and untyped functions coexist", () => {
  const r = evalStandard2("identity(x) => x\ntyped(x: Int): Int => x + 1\ntyped(identity(41))");
  eq(Number((r as BitsValue).data), 42);
});

// --- Phase 2c-4: when/is/then pattern matching ---

test("grammar2/std: when with int literal match", () => {
  const r = evalStandard2("when 42 is 42 then 1 else 0");
  eq(Number((r as BitsValue).data), 1);
});

test("grammar2/std: when with int literal miss", () => {
  const r = evalStandard2("when 42 is 99 then 1 else 0");
  eq(Number((r as BitsValue).data), 0);
});

test("grammar2/std: when with wildcard", () => {
  const r = evalStandard2("when 42 is _ then 99 else 0");
  eq(Number((r as BitsValue).data), 99);
});

test("grammar2/std: when with ident binding", () => {
  const r = evalStandard2("when 10 is n then n + 5 else 0");
  eq(Number((r as BitsValue).data), 15);
});

test("grammar2/std: when resolve-first (known var matches)", () => {
  const r = evalStandard2("known = 42\nwhen 42 is known then 1 else 0");
  eq(Number((r as BitsValue).data), 1);
});

test("grammar2/std: when multi-case (inline lines)", () => {
  const r = evalStandard2(`
v = 2
m = when v
  is 1 then 10
  is 2 then 20
  is 3 then 30
m`);
  eq(Number((r as BitsValue).data), 20);
});

test("grammar2/std: when with structural destructuring", () => {
  const r = evalStandard2('point = {x: 3, y: 4}\nwhen point is {x, y} then x + y else 0');
  eq(Number((r as BitsValue).data), 7);
});

test("grammar2/std: when with type destructuring", () => {
  const r = evalStandard2('obj = {width: 5, height: 10}\nwhen obj is Object(width, height) then width * height else 0');
  eq(Number((r as BitsValue).data), 50);
});

test("grammar2/std: when with guard", () => {
  const r = evalStandard2("when 5 is n and n > 0 then n * 2 else 0");
  eq(Number((r as BitsValue).data), 10);
});

test("grammar2/std: pattern-match.alg runs end-to-end", () => {
  const source = fs.readFileSync(path.join(testsDir, "pattern-match.alg"), "utf-8");
  const printed: string[] = [];
  const origLog = console.log;
  console.log = (msg: any) => printed.push(String(msg));
  try {
    evalStandard2(source);
  } finally {
    console.log = origLog;
  }
  const lines = source.split(/\r?\n/);
  const expected: string[] = [];
  for (const line of lines) {
    const m = line.match(/\/\/\s*expect:\s*(.*)/);
    if (m) expected.push(m[1].trim());
  }
  eq(printed.length, expected.length, "line count");
  for (let i = 0; i < expected.length; i++) {
    eq(printed[i], expected[i], `line ${i}`);
  }
});

// --- Phase 2c-5: remaining Standard features ---

test("grammar2/std: hex literal", () => {
  const r = evalStandard2("0xFF");
  eq(Number((r as BitsValue).data), 255);
});

test("grammar2/std: binary literal", () => {
  const r = evalStandard2("0b1010");
  eq(Number((r as BitsValue).data), 10);
});

test("grammar2/std: refinement type creation", () => {
  // Int & _ > 0 creates a refined type
  const r = evalStandard2("PI = Int & _ > 0\nPI(5)");
  eq(Number((r as BitsValue).data), 5);
});

test("grammar2/std: refinement check failure produces error", () => {
  const r = evalStandard2("PI = Int & _ > 0\nPI(0 - 5)");
  eq(metaOf(r!).has("error"), true);
});

test("grammar2/std: compound refinement predicates", () => {
  const r = evalStandard2("SmallPos = Int & _ > 0 && _ < 100\nSmallPos(50)");
  eq(Number((r as BitsValue).data), 50);
});

test("grammar2/std: structural wrap type annotation", () => {
  // ~Int creates a structural wrap
  const r = evalStandard2("f(x: ~Int) => x\nf(42)");
  eq(Number((r as BitsValue).data), 42);
});

// B-104 chunk 2: union types are removed (maintainer ruling; redesign B-105).
// The annotation test is replaced by its inverse — the grammar no longer
// admits `|` in a type position, and must say so rather than mis-parse.
test("grammar2/std: union type annotation is rejected (B-104 c2)", () => {
  let threw = false;
  try { evalStandard2('f(x: Int | String) => x\nf(42)'); }
  catch { threw = true; }
  eq(threw, true, "`Int | String` no longer parses as a type expression");
});

test("grammar2/std: export binding wraps value", () => {
  // B-097 V1 collapse-equivalent (conscious delta 1): export-ness is
  // recorded on the BINDING (Binding.visibility), never as a value
  // component — same contract (exported binding usable, export-ness
  // recorded), new carrier.
  const r2 = runtimeEval("export x = 42\nx", undefined, [typeExt], undefined, true);
  eq(Number((r2.value! as BitsValue).data), 42);
  eq(r2.evalCtx.bindings.get("x")?.visibility, "exported");
});

test("grammar2/std: export function declaration", () => {
  const r = evalStandard2("export double(n: Int): Int => n * 2\ndouble(21)");
  eq(Number((r as BitsValue).data), 42);
});

// Helper for file-based grammar2 tests
function runFileThroughGrammar2(filename: string): void {
  const source = fs.readFileSync(path.join(testsDir, filename), "utf-8");
  const printed: string[] = [];
  const origLog = console.log;
  console.log = (msg: any) => printed.push(String(msg));
  try {
    evalStandard2(source);
  } finally {
    console.log = origLog;
  }
  const lines = source.split(/\r?\n/);
  const expected: string[] = [];
  for (const line of lines) {
    const m = line.match(/\/\/\s*expect:\s*(.*)/);
    if (m) expected.push(m[1].trim());
  }
  eq(printed.length, expected.length, `${filename}: line count`);
  for (let i = 0; i < expected.length; i++) {
    eq(printed[i], expected[i], `${filename} line ${i}`);
  }
}

test("grammar2/std: refinements.alg runs end-to-end", () => {
  runFileThroughGrammar2("refinements.alg");
});

test("grammar2/std: types.alg runs end-to-end", () => {
  runFileThroughGrammar2("types.alg");
});

test("grammar2/std: logical.alg runs end-to-end", () => {
  runFileThroughGrammar2("logical.alg");
});

test("grammar2/std: functions.alg runs end-to-end", () => {
  runFileThroughGrammar2("functions.alg");
});

test("grammar2/std: interfaces.alg runs end-to-end", () => {
  runFileThroughGrammar2("interfaces.alg");
});

test("grammar2/std: mixins.alg runs end-to-end", () => {
  runFileThroughGrammar2("mixins.alg");
});

test("grammar2/std: generics.alg runs end-to-end", () => {
  runFileThroughGrammar2("generics.alg");
});

test("grammar2/std: function-types.alg runs end-to-end", () => {
  runFileThroughGrammar2("function-types.alg");
});

test("grammar2/std: typed-types.alg runs end-to-end", () => {
  runFileThroughGrammar2("typed-types.alg");
});

test("grammar2/std: block expression as function body", () => {
  const r = evalStandard2(`
f() =>
  x = 3
  y = x + 1
  y * 2
f()`);
  eq(Number((r as BitsValue).data), 8);
});

// grammar-regex.alg deferred — parses fully through grammar2 with block
// expressions, but exercises grammar_* primitives whose "No target element
// specified" behavior needs investigation separate from the parser work.

test("grammar2/std: type-annotations.alg runs end-to-end", () => {
  const source = fs.readFileSync(path.join(testsDir, "type-annotations.alg"), "utf-8");
  const printed: string[] = [];
  const origLog = console.log;
  console.log = (msg: any) => printed.push(String(msg));
  try {
    evalStandard2(source);
  } finally {
    console.log = origLog;
  }
  const lines = source.split(/\r?\n/);
  const expected: string[] = [];
  for (const line of lines) {
    const m = line.match(/\/\/\s*expect:\s*(.*)/);
    if (m) expected.push(m[1].trim());
  }
  eq(printed.length, expected.length, "line count");
  for (let i = 0; i < expected.length; i++) {
    eq(printed[i], expected[i], `line ${i}`);
  }
});

// --- Phase 2c-3: multi-line expression continuation ---

test("grammar2/std: if-then-else can span lines", () => {
  const r = evalStandard2("x = 5\nif x > 0\n  then x\n  else 0 - x");
  eq(Number((r as BitsValue).data), 5);
});

test("grammar2/std: function body spans lines", () => {
  const r = evalStandard2("f(n) =>\n  if n == 0\n    then 1\n    else n + 1\nf(0)");
  eq(Number((r as BitsValue).data), 1);
});

test("grammar2/std: binary operator continues onto next line", () => {
  const r = evalStandard2("x = 1 +\n    2 +\n    3\nx");
  eq(Number((r as BitsValue).data), 6);
});

test("grammar2/std: function call args spread across lines", () => {
  const r = evalStandard2("f(a, b, c) => a + b + c\nf(\n  1,\n  2,\n  3)");
  eq(Number((r as BitsValue).data), 6);
});

test("grammar2/std: array literal spread across lines", () => {
  const r = evalStandard2("arr = [\n  1,\n  2,\n  3\n]\narr.length");
  eq(Number((r as BitsValue).data), 3);
});

test("grammar2/std: continuation doesn't cross back to base column", () => {
  // After `x = 1`, `y` is at col 0 (same as top of stack) → NEWLINE fires,
  // two separate stmts. Without continuation logic this would fail.
  const r = evalStandard2("x = 1\ny = 2\nx + y");
  eq(Number((r as BitsValue).data), 3);
});

test("grammar2/std: recursive multi-line function (arrays.alg idiom)", () => {
  const r = evalStandard2(`
myMap(arr, f) =>
  if arr.length == 0
    then []
    else [f(arr[0])].concat(myMap(arr.slice(1), f))

myMap([1, 2, 3], x => x * 10).length
`);
  eq(Number((r as BitsValue).data), 3);
});

test("grammar2/std: arrays.alg runs end-to-end", () => {
  const source = fs.readFileSync(path.join(testsDir, "arrays.alg"), "utf-8");
  const printed: string[] = [];
  const origLog = console.log;
  console.log = (msg: any) => printed.push(String(msg));
  try {
    evalStandard2(source);
  } finally {
    console.log = origLog;
  }
  const lines = source.split(/\r?\n/);
  const expected: string[] = [];
  for (const line of lines) {
    const m = line.match(/\/\/\s*expect:\s*(.*)/);
    if (m) expected.push(m[1].trim());
  }
  eq(printed.length, expected.length, "line count");
  for (let i = 0; i < expected.length; i++) {
    eq(printed[i], expected[i], `line ${i}`);
  }
});


test("grammar2/std: objects.alg runs end-to-end", () => {
  const source = fs.readFileSync(path.join(testsDir, "objects.alg"), "utf-8");
  const printed: string[] = [];
  const origLog = console.log;
  console.log = (msg: any) => printed.push(String(msg));
  try {
    evalStandard2(source);
  } finally {
    console.log = origLog;
  }
  const lines = source.split(/\r?\n/);
  const expected: string[] = [];
  for (const line of lines) {
    const m = line.match(/\/\/\s*expect:\s*(.*)/);
    if (m) expected.push(m[1].trim());
  }
  eq(printed.length, expected.length);
  for (let i = 0; i < expected.length; i++) {
    eq(printed[i], expected[i], `line ${i}`);
  }
});

// Note: full end-to-end on tests/arrays.alg requires multi-line expression
// continuation (e.g., `f(x) =>\n  if cond\n    then a\n    else b`) which
// is scheduled for a later sub-phase.

test("grammar2/std: dot-access.alg runs end-to-end through grammar2", () => {
  const source = fs.readFileSync(path.join(testsDir, "dot-access.alg"), "utf-8");
  const printed: string[] = [];
  const origLog = console.log;
  console.log = (msg: any) => printed.push(String(msg));
  try {
    evalStandard2(source);
  } finally {
    console.log = origLog;
  }
  // Extract expected outputs from "// expect: ..." comments and compare
  const lines = source.split(/\r?\n/);
  const expected: string[] = [];
  for (const line of lines) {
    const m = line.match(/\/\/\s*expect:\s*(.*)/);
    if (m) expected.push(m[1].trim());
  }
  eq(printed.length, expected.length);
  for (let i = 0; i < expected.length; i++) {
    eq(printed[i], expected[i], `line ${i}`);
  }
});

test("grammar2/base: basics.alg runs end-to-end, matches expected output", () => {
  // Phase 2b acceptance: parse, build, and evaluate the full basics.alg through
  // the new grammar2 path. The expected output is pinned as the seven
  // lines below — all produced by print() calls in the source; this
  // test is the oracle (formerly duplicated in CLAUDE.md).
  const source = fs.readFileSync("basics.alg", "utf-8");
  const printed: string[] = [];
  const origLog = console.log;
  console.log = (msg: any) => printed.push(String(msg));
  try {
    evalBase2(source);
  } finally {
    console.log = origLog;
  }
  eq(printed.join(","), "11,42,120,42,55,42,7");
});

// --- Phase 2a: left recursion (Warth) ---

test("grammar2/engine: direct left recursion on a single rule", () => {
  // expr = expr '+' num | num
  const g = g2.makeGrammar({ start: "expr" });
  g2.addProduction(g, { name: "num",
    rule: g2.regex(/[0-9]+/),
  });
  g2.addProduction(g, { name: "expr",
    rule: g2.alt([
      g2.seq([g2.nonterm("expr"), g2.lit("+"), g2.nonterm("num")]),
      g2.nonterm("num"),
    ]),
  });
  const r = g2parse(g, "1+2+3");
  g2ok(r);
});

test("grammar2/engine: left recursion produces left-associative tree", () => {
  const g = g2.makeGrammar({ start: "expr" });
  g2.addProduction(g, { name: "num",
    rule: g2.regex(/[0-9]+/),
  });
  g2.addProduction(g, { name: "expr",
    rule: g2.alt([
      g2.seq([g2.nonterm("expr"), g2.lit("+"), g2.nonterm("num")], { name: "add" }),
      g2.nonterm("num"),
    ]),
  });
  const r = g2parse(g, "1+2+3");
  g2ok(r);
  // Expect the tree to be nested left: add(add(1, 2), 3) not add(1, add(2, 3)).
  // The top-level is an `add` branch whose first child is itself an `add` branch.
  if (r.tree.kind === "branch") {
    // Unwrap the outer production layer if present.
    const outer = r.tree.tag === "add" ? r.tree :
      (r.tree.children[0] && r.tree.children[0].kind === "branch" ? r.tree.children[0] : null);
    if (outer && outer.tag === "add") {
      // First child should be a nested add, not a leaf/num
      const first = outer.children[0];
      if (first.kind === "branch") {
        // If first is a nested branch, it should eventually lead to another "add"
        const hasNestedAdd = JSON.stringify(first).includes("\"tag\":\"add\"");
        eq(hasNestedAdd, true, "left-associative: first child should contain another add");
      }
    }
  }
});

test("grammar2/engine: left-recursive rule falls back to base when no further matches", () => {
  const g = g2.makeGrammar({ start: "expr" });
  g2.addProduction(g, { name: "num", rule: g2.regex(/[0-9]+/) });
  g2.addProduction(g, { name: "expr",
    rule: g2.alt([
      g2.seq([g2.nonterm("expr"), g2.lit("+"), g2.nonterm("num")]),
      g2.nonterm("num"),
    ]),
  });
  // Single number should parse via the base (non-recursive) alt.
  const r = g2parse(g, "42");
  g2ok(r);
});

test("grammar2/engine: deeply left-recursive input parses without stack overflow", () => {
  // Generate 100 "+1" suffixes; all-left-associative chain.
  const g = g2.makeGrammar({ start: "expr" });
  g2.addProduction(g, { name: "num", rule: g2.regex(/[0-9]+/) });
  g2.addProduction(g, { name: "expr",
    rule: g2.alt([
      g2.seq([g2.nonterm("expr"), g2.lit("+"), g2.nonterm("num")]),
      g2.nonterm("num"),
    ]),
  });
  const input = "1" + "+1".repeat(100);
  const r = g2parse(g, input);
  g2ok(r);
});

// --- Phase 2a: indent terminals ---

test("grammar2/engine: NEWLINE matches same-indent line boundary", () => {
  const g = g2.makeGrammar({ start: "lines" });
  g2.addProduction(g, { name: "line", rule: g2.regex(/[a-z]+/) });
  g2.addProduction(g, { name: "lines",
    rule: g2.rep(g2.nonterm("line"), { min: 1, sep: g2.indent("NEWLINE") }),
  });
  const r = g2parse(g, "abc\ndef\nghi");
  g2ok(r);
});

test("grammar2/engine: INDENT + DEDENT bracket an indented block", () => {
  // header = 'if' NEWLINE? block
  // block  = INDENT line (NEWLINE line)* DEDENT
  const g = g2.makeGrammar({ start: "top" });
  g2.addProduction(g, { name: "line", rule: g2.regex(/[a-z]+/) });
  g2.addProduction(g, { name: "block",
    rule: g2.seq([
      g2.indent("INDENT"),
      g2.rep(g2.nonterm("line"), { min: 1, sep: g2.indent("NEWLINE") }),
      g2.indent("DEDENT"),
    ]),
  });
  g2.addProduction(g, { name: "top",
    rule: g2.seq([g2.lit("if"), g2.nonterm("block")]),
  });
  // "if\n    a\n    b" — after "if", INDENT at col 4 succeeds, line a, NEWLINE at col 4,
  // line b, then DEDENT (next content is EOF or col < 4).
  const r = g2parse(g, "if\n    a\n    b");
  g2ok(r);
});

test("grammar2/engine: INDENT fails when next line is not deeper", () => {
  const g = g2.makeGrammar({ start: "top" });
  g2.addProduction(g, { name: "line", rule: g2.regex(/[a-z]+/) });
  g2.addProduction(g, { name: "top",
    rule: g2.seq([g2.lit("if"), g2.indent("INDENT"), g2.nonterm("line")]),
  });
  // No indented line follows "if".
  const r = g2parse(g, "if\nx");
  g2fail(r);
});

test("grammar2/engine: NEWLINE fails between continuation lines", () => {
  // NEWLINE at col 0 top, input "abc\n  def" — second line is deeper,
  // so NEWLINE doesn't fire (continuation-style).
  const g = g2.makeGrammar({ start: "lines" });
  g2.addProduction(g, { name: "line", rule: g2.regex(/[a-z]+/) });
  g2.addProduction(g, { name: "lines",
    rule: g2.rep(g2.nonterm("line"), { min: 2, sep: g2.indent("NEWLINE") }),
  });
  const r = g2parse(g, "abc\n  def");
  g2fail(r);
});

test("grammar2/engine: DEDENT pops a level", () => {
  // A two-level nested block
  const g = g2.makeGrammar({ start: "top" });
  g2.addProduction(g, { name: "line", rule: g2.regex(/[a-z]+/) });
  g2.addProduction(g, { name: "block",
    rule: g2.seq([
      g2.indent("INDENT"),
      g2.rep(g2.nonterm("line"), { min: 1, sep: g2.indent("NEWLINE") }),
      g2.indent("DEDENT"),
    ]),
  });
  g2.addProduction(g, { name: "top",
    rule: g2.seq([g2.lit("outer"), g2.nonterm("block")]),
  });
  // outer \n INDENT \n a \n b DEDENT
  const r = g2parse(g, "outer\n  a\n  b");
  g2ok(r);
});

// --- Allegro-level integration: verify the primitives compose from Allegro code ---

test("grammar2 primitives: literal match via Allegro", () => {
  const r = evalStd(`
g = grammar2_new()
grammar2_add_production(g, "s", grammar2_lit("hello"))
grammar2_set_start(g, "s")
grammar2_parse(g, "hello")
`);
  // Parse tree for the "s" production wrapping a single literal leaf.
  // Shape: Object { tag: "s", children: ["hello"] } OR just a String if the
  // engine collapsed the single-child branch. Either way, primary is not an error.
  eq(metaOf(r!).has("error"), false);
});

test("grammar2 primitives: sequence via Allegro", () => {
  const r = evalStd(`
g = grammar2_new()
grammar2_add_production(g, "s", grammar2_seq([grammar2_lit("ab"), grammar2_lit("cd")]))
grammar2_set_start(g, "s")
grammar2_parse(g, "abcd")
`);
  eq(metaOf(r!).has("error"), false);
});

test("grammar2 primitives: parse failure produces error value", () => {
  const r = evalStd(`
g = grammar2_new()
grammar2_add_production(g, "s", grammar2_lit("hello"))
grammar2_set_start(g, "s")
grammar2_parse(g, "world")
`);
  eq(metaOf(r!).has("error"), true);
});

test("grammar2 primitives: left recursion works from Allegro", () => {
  // expr = expr + num | num
  const r = evalStd(`
g = grammar2_new()
grammar2_add_production(g, "num", grammar2_regex("[0-9]+"))
grammar2_add_production(g, "expr",
  grammar2_alt([
    grammar2_seq([grammar2_nonterm("expr"), grammar2_lit("+"), grammar2_nonterm("num")]),
    grammar2_nonterm("num")
  ]))
grammar2_set_start(g, "expr")
if error of grammar2_parse(g, "1+2+3+4") == none then "ok" else "err"
`);
  eq(bitsToString(r! as BitsValue), "ok");
});

test("grammar2 primitives: indent block works from Allegro", () => {
  const r = evalStd(`
g = grammar2_new()
grammar2_add_production(g, "line", grammar2_regex("[a-z]+"))
grammar2_add_production(g, "block",
  grammar2_seq([
    grammar2_indent("INDENT"),
    grammar2_rep(grammar2_nonterm("line"), {min: 1, sep: grammar2_indent("NEWLINE")}),
    grammar2_indent("DEDENT")
  ]))
grammar2_add_production(g, "top",
  grammar2_seq([grammar2_lit("if"), grammar2_nonterm("block")]))
grammar2_set_start(g, "top")
if error of grammar2_parse(g, "if
    a
    b") == none then "ok" else "err"
`);
  eq(bitsToString(r! as BitsValue), "ok");
});

test("grammar2 primitives: regex DSL end-to-end from Allegro", () => {
  // Build the §10.3 regex grammar and parse a few inputs, returning Bool.
  const r = evalStd(`
g = grammar2_new()

// Productions:
//   pattern = concat (| concat)*
//   concat  = atom+
//   atom    = base postfix?
//   postfix = * | + | ?
//   base    = [a-z] | group
//   group   = ( pattern )

grammar2_add_production(g, "pattern",
  grammar2_rep(grammar2_nonterm("concat"), {min: 1, sep: grammar2_lit("|")}))
grammar2_add_production(g, "concat",
  grammar2_rep(grammar2_nonterm("atom"), {min: 1}))
grammar2_add_production(g, "atom",
  grammar2_seq([grammar2_nonterm("base"), grammar2_opt(grammar2_nonterm("postfix"))]))
grammar2_add_production(g, "postfix",
  grammar2_alt([grammar2_lit("*"), grammar2_lit("+"), grammar2_lit("?")]))
grammar2_add_production(g, "base",
  grammar2_alt([grammar2_cls("[a-z]"), grammar2_nonterm("group")]))
grammar2_add_production(g, "group",
  grammar2_seq([grammar2_lit("("), grammar2_nonterm("pattern"), grammar2_lit(")")]))

grammar2_set_start(g, "pattern")

// Parse each input; check error component inline (error values auto-propagate
// through function calls, so we can't use a helper).
[
  if error of grammar2_parse(g, "abc")     == none then "ok" else "err",
  if error of grammar2_parse(g, "a*b")     == none then "ok" else "err",
  if error of grammar2_parse(g, "(ab)+")   == none then "ok" else "err",
  if error of grammar2_parse(g, "a|b|c")   == none then "ok" else "err",
  if error of grammar2_parse(g, "(a|b)*c") == none then "ok" else "err",
  if error of grammar2_parse(g, "")        == none then "ok" else "err",
  if error of grammar2_parse(g, "AB")      == none then "ok" else "err",
  if error of grammar2_parse(g, "(abc")    == none then "ok" else "err"
]
`);
  // Expected: 5 "ok", then 3 "err".
  const p = r! as any;
  // p is the Array Context with __length and numeric bindings.
  const len = Number((getSlotCount(p) as any).data);
  eq(len, 8);
  const results: string[] = [];
  for (let i = 0; i < len; i++) {
    const el = indexGet(p, i)!;     // B-120 E4: positional, not string-keyed
    results.push(bitsToString(el as any));
  }
  eq(results.join(","), "ok,ok,ok,ok,ok,err,err,err");
});

test("grammar2 §10.3: regex DSL parses simple literal", () => {
  const g = g2.makeGrammar({ start: "pattern" });
  g2.addProduction(g, { name: "pattern",
    rule: g2.rep(g2.nonterm("concat"), { min: 1, sep: g2.lit("|") }),
  });
  g2.addProduction(g, { name: "concat",
    rule: g2.rep(g2.nonterm("atom"), { min: 1 }),
  });
  g2.addProduction(g, { name: "atom",
    rule: g2.seq([g2.nonterm("base"), g2.opt(g2.nonterm("postfix"))]),
  });
  g2.addProduction(g, { name: "postfix",
    rule: g2.alt([g2.lit("*"), g2.lit("+"), g2.lit("?")]),
  });
  g2.addProduction(g, { name: "base",
    rule: g2.alt([g2.cls("[a-z]"), g2.nonterm("group")]),
  });
  g2.addProduction(g, { name: "group",
    rule: g2.seq([g2.lit("("), g2.nonterm("pattern"), g2.lit(")")]),
  });

  g2ok(g2parse(g, "abc"));
  g2ok(g2parse(g, "a*b"));
  g2ok(g2parse(g, "(ab)+"));
  g2ok(g2parse(g, "a|b|c"));
  g2ok(g2parse(g, "(a|b)*c"));
  g2fail(g2parse(g, ""));           // min=1, empty fails
  g2fail(g2parse(g, "AB"));         // uppercase not in [a-z]
  g2fail(g2parse(g, "(abc"));       // unbalanced paren
});

