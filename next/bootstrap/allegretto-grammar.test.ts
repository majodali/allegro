// Tests of Allegretto's grammar (next/bootstrap/allegretto-grammar.ts):
// every form of next/ext/allegretto/forms.md §2 parses, and every
// production forms.md §5 removes is refused. Run by `npm run test:next`.

import { test } from "node:test";
import assert from "node:assert/strict";
import { allegrettoGrammar, parseAllegretto, REMOVED_PRODUCTIONS, type ParseTree } from "./allegretto-grammar.js";

const parses = (text: string): void => {
  const r = parseAllegretto(text);
  assert.ok(r.ok, `${JSON.stringify(text)} does not parse: ${r.ok ? "" : r.error.message}`);
};
const refused = (text: string): void => {
  assert.equal(parseAllegretto(text).ok, false, `${JSON.stringify(text)} parses`);
};
/** The tags of a parse tree, in order. */
const tags = (t: ParseTree, out: string[] = []): string[] => {
  if (t.kind === "branch") {
    if (t.tag !== undefined) out.push(t.tag);
    t.children.forEach((c) => tags(c, out));
  }
  return out;
};
const tagsOf = (text: string): string[] => {
  const r = parseAllegretto(text);
  assert.ok(r.ok, text);
  return r.ok ? tags(r.tree) : [];
};

test("every form of forms.md §2 parses", () => {
  const forms = [
    // Values.
    '"text"', '"a \\" b \\\\ c \\n d \\t e"', "42", "0xFF", "1.5", "true", "false", "{a: 1, b: 2}", "[1, 2]", "[]", "{}", "`name",
    // Names, functions and application.
    "x", "x => x", "(x, y) => x", "() => 1", "f(a, b)", "f()", "a |> f", "p.a", "p[0]",
    // Control and claims.
    "if c then a else b", "a && b", "a || b", "!a", "claim(e)", "then(a, b)", "attempt(e, 100)", "describe(k, f)", "build(d)",
    "also(a, b)", "refuse(r)", "assume(x)", "undecided(r)", "put(s, k, v)", "key(s, 0)", "kind(x)", "symbol(t)", "spelling(s)",
    "{a: e, [k]: f}", "{[f(k)]: e}",
    // Operators.
    "a + b", "a - b", "a * b", "a / b", "a % b", "-a", "a < b", "a > b", "a <= b", "a >= b", "a == b", "a != b", "a ++ b",
    "float.add(a, b)", "int.text(42)", "bits.join(a, b)",
    // Bindings and blocks.
    "x = e", "f(x, y) => e", "x <- e", "export x = 1", "export f(x) => x",
    "f(x) =>\n  y = x\n  g(y)\n  z <- h(y)\n  z",
    "f(x) => sync\n  g(x)\n  x", "x = sync\n  g()\n  1", "x <- sync\n  g()\n  1",
    // The module's header lines.
    "capability output\ninput name\nimport other\noutput.write(\"hello\")",
    "key secret\ncapability output\nx = 1\ninput n",
    // Comments.
    "// a line\nx /* between */ = 1",
  ];
  for (const f of forms) parses(f);
});

test("every production forms.md §5 removes is refused", () => {
  const removed: Record<string, string[]> = {
    "a type annotation": ["x: Int = 5", "f(x): Int => x"],
    "a typed parameter": ["(x: Int) => x", "x: Int => x", "f(x: Int) => x"],
    "generics": ["f[T](x) => x", "export f[T](x) => x"],
    "when and patterns": ["when x is 1 then a else b", "when x\n  is {a} then a"],
    "theorem": ["theorem t: true", "theorem t: a == a by refl"],
    "verify": ["verify x == 1"],
    "a grammar block": ["grammar { infix \"**\" at(mul) => f }", "g = grammar { }", "new grammar { }"],
    "& on types": ["T = Int & Pos", "a & b"],
    "instanceof": ["x instanceof T"],
    "subtypeof": ["A subtypeof B"],
    "Y of x": ["type of x", "error of y"],
    "error": ["error x", "error"],
    "none": ["none", "x = none"],
    "text interpolation": ['"a{x}b"', '"{1}"'],
  };
  for (const [form, texts] of Object.entries(removed)) for (const t of texts) assert.equal(parseAllegretto(t).ok, false, `${form}: ${JSON.stringify(t)} parses`);
});

test("the grammar keeps no production forms.md §5 removes, and every production it refers to exists", () => {
  const g = allegrettoGrammar();
  for (const name of REMOVED_PRODUCTIONS) assert.equal(g.productions.has(name), false, name);
  for (const name of ["symbol_lit", "expr_join", "param_list"]) assert.ok(g.productions.has(name), name);
});

test("then is a name as well as the word of if: forms.md binds the kernel primitive to it", () => {
  assert.ok(tagsOf("then(a, b)").includes("call"));
  assert.ok(tagsOf("if c then then(a, b) else d").includes("if"));
  assert.ok(tagsOf("if then(a, b) then c else d").includes("if"));
  refused("if c then a");
});

test("each call makes a new grammar value", () => {
  assert.notEqual(allegrettoGrammar(), allegrettoGrammar());
});

test("x <- e is a statement; inside an expression a < -b is still a comparison", () => {
  assert.ok(tagsOf("x <- e").includes("arrow_binding"));
  assert.ok(!tagsOf("f(a < -b)").includes("arrow_binding"));
  assert.ok(tagsOf("f(a < -b)").includes("lt"));
});

test("the header words are not reserved: they stay names elsewhere", () => {
  assert.ok(tagsOf("capability output").includes("capability_decl"));
  assert.ok(tagsOf("input name").includes("input_decl"));
  assert.ok(tagsOf("key name").includes("key_decl"));
  assert.ok(tagsOf("input = 1").includes("binding"));
  assert.ok(!tagsOf("capability(1)").includes("capability_decl"));
  assert.ok(!tagsOf("key(s, 0)").includes("key_decl"));
  assert.ok(tagsOf("key(s, 0)").includes("call"));
});

test("sync is a word before an indented block and a name elsewhere; a computed key is an entry of a structure literal", () => {
  assert.ok(tagsOf("f() => sync\n  a\n  b").includes("sync_block"));
  assert.ok(!tagsOf("x = sync").includes("sync_block"));
  assert.ok(tagsOf("{[k]: 1}").includes("computed_field"));
});
