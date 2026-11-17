// The native baseline of the parser speed test (B-196 (the rebuild's
// acceptance side), chunk Q8 (the speed tests of milestone 3)): the present
// tree's own parser engine, `parse` of src/grammar2/engine.ts, run on the
// grammar of next/corpus/speed/parser.alg written in the engine's
// formalism, and the tree's value computed in host code. It is what a user
// of the present tree gets today, not the same algorithm: the engine is
// host code, memoizes each rule at each place, and loops where the twin
// recurses.
//
// The grammar, rule for rule as in parser.alg:
//   start   = sum sp
//   sum     = product (sp addop product)*
//   product = factor (sp mulop factor)*
//   factor  = sp (number | "(" sum sp ")")
//   number  = digit digit*
//   digit   = "0" | ... | "9";  addop = "+" | "-";  mulop = "*" | "/";  sp = " "*
//
// Read by next/corpus/speed/bench.ts through a dynamic import, so the new
// tree's typecheck does not reach into the present tree; run by tsx. The
// present tree is read, never changed.

import { parse } from "../../../../src/grammar2/engine.js";
import { makeGrammar, addProduction, lit, seq, alt, rep, nonterm, type Grammar, type ParseTree } from "../../../../src/grammar2/types.js";

/** The arithmetic grammar in the engine's formalism. */
export function arithmetic(): Grammar {
  const g = makeGrammar({ start: "start" });
  const add = (name: string, rule: Parameters<typeof addProduction>[1]["rule"]): void => addProduction(g, { name, rule });
  add("start", seq([nonterm("sum"), nonterm("sp")]));
  add("sum", seq([nonterm("product"), rep(seq([nonterm("sp"), nonterm("addop"), nonterm("product")]))]));
  add("product", seq([nonterm("factor"), rep(seq([nonterm("sp"), nonterm("mulop"), nonterm("factor")]))]));
  add("factor", seq([nonterm("sp"), alt([nonterm("number"), seq([lit("("), nonterm("sum"), nonterm("sp"), lit(")")])])]));
  add("number", seq([nonterm("digit"), rep(nonterm("digit"))]));
  add("digit", alt("0123456789".split("").map((d) => lit(d))));
  add("addop", alt([lit("+"), lit("-")]));
  add("mulop", alt([lit("*"), lit("/")]));
  add("sp", rep(lit(" ")));
  return g;
}

type Branch = Extract<ParseTree, { kind: "branch" }>;
const branch = (t: ParseTree): Branch => {
  if (t.kind !== "branch") throw new Error(`expected a branch, found ${t.kind}`);
  return t;
};
const leafText = (t: ParseTree): string => {
  const b = branch(t);
  const l = b.children[0];
  if (l.kind !== "leaf") throw new Error("expected a leaf");
  return l.text;
};

/** Integer division truncated toward zero, as int.div. */
const div = (a: bigint, b: bigint): bigint => a / b;

function level(t: ParseTree, operand: (t: ParseTree) => bigint, apply: (op: string, a: bigint, b: bigint) => bigint): bigint {
  const [first, more] = branch(t).children;
  let acc = operand(first);
  for (const s of branch(more).children) {
    const [, op, next] = branch(s).children;
    acc = apply(leafText(op), acc, operand(next));
  }
  return acc;
}
const sum = (t: ParseTree): bigint => level(t, product, (op, a, b) => (op === "+" ? a + b : a - b));
const product = (t: ParseTree): bigint => level(t, factor, (op, a, b) => (op === "*" ? a * b : div(a, b)));
function factor(t: ParseTree): bigint {
  const c = branch(t).children[1];
  if (c.kind === "branch" && c.tag === "number") return number(c);
  return sum(branch(c).children[1]);
}
function number(t: ParseTree): bigint {
  const [first, more] = branch(t).children;
  let acc = BigInt(leafText(first));
  for (const d of branch(more).children) acc = acc * 10n + BigInt(leafText(d));
  return acc;
}

/** The nodes of an engine tree: its branches and leaves. Not comparable with parser.alg's count. */
function nodes(t: ParseTree): number {
  return t.kind === "branch" ? 1 + t.children.reduce((n, c) => n + nodes(c), 0) : 1;
}

/** Parses a text and computes its value: the line parser.alg prints, with the engine's own node count. */
export function run(text: string, grammar: Grammar = arithmetic()): string {
  const r = parse(grammar, text);
  if (!r.ok) return `failed at character ${r.error.position}`;
  return `value ${sum(branch(r.tree).children[0])}, nodes ${nodes(r.tree)}`;
}
