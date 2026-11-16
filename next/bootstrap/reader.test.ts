// Tests of the reader of Allegretto (next/bootstrap/reader.ts): the
// engine's parse tree read into the reader's syntax tree, never through
// the present tree builder. Run by `npm run test:next`.

import { test } from "node:test";
import assert from "node:assert/strict";
import { read, type Expr, type Item, type Module } from "./reader.js";

const moduleOf = (text: string): Module => {
  const r = read(text);
  assert.ok(r.ok, `${JSON.stringify(text)} is refused: ${r.ok ? "" : r.findings.map((f) => f.message).join("; ")}`);
  return r.module;
};
/** The one statement's expression of a text of one line. */
const exprOf = (text: string): Expr => {
  const [item] = moduleOf(text).items;
  assert.equal(item.k, "statement");
  return (item as Extract<Item, { k: "statement" }>).expr;
};
const refusal = (text: string): string[] => {
  const r = read(text);
  assert.equal(r.ok, false, `${JSON.stringify(text)} is read`);
  return r.ok ? [] : r.findings.map((f) => f.message);
};
/** An expression as a short text, with every operator node in parentheses. */
const shape = (e: Expr): string => {
  switch (e.k) {
    case "name":
      return e.name;
    case "int":
      return String(e.value);
    case "binary":
      return `(${shape(e.left)} ${e.op} ${shape(e.right)})`;
    case "unary":
      return `(${e.op}${shape(e.operand)})`;
    case "apply":
      return `${shape(e.fn)}(${e.args.map(shape).join(", ")})`;
    case "pipe":
      return `(${shape(e.value)} |> ${shape(e.fn)})`;
    case "dot":
      return `${shape(e.object)}.${e.name.name}`;
    case "index":
      return `${shape(e.object)}[${shape(e.index)}]`;
    default:
      return e.k;
  }
};

test("a whole number is read from its digits, within the signed 64-bit range; outside it the reader refuses", () => {
  assert.deepEqual(exprOf("42"), { k: "int", value: 42n, at: { start: 0, end: 2, line: 1, column: 1 } });
  assert.equal((exprOf("9223372036854775807") as { value: bigint }).value, 9223372036854775807n);
  assert.equal((exprOf("9007199254740993") as { value: bigint }).value, 9007199254740993n, "a number above 2^53 keeps every digit");
  assert.match(refusal("9223372036854775808")[0], /outside the signed 64-bit range/);
  assert.match(refusal("0x8000000000000000")[0], /outside the signed 64-bit range/);
});

test("0xFF is read as 255", () => {
  assert.equal((exprOf("0xFF") as { value: bigint }).value, 255n);
  assert.equal((exprOf("0x7fffffffffffffff") as { value: bigint }).value, 9223372036854775807n);
});

test("a decimal fraction is read as IEEE 754 binary64", () => {
  assert.equal((exprOf("1.5") as { value: number }).value, 1.5);
  assert.equal((exprOf("0.1") as { value: number }).value, 0.1);
});

test("a text's escapes are \\\" \\\\ \\n \\t, and the text is read to its UTF-8 bytes", () => {
  const e = exprOf('"a\\"b\\\\c\\nd\\te é"');
  assert.equal(e.k, "text");
  assert.deepEqual([...(e as { bytes: Uint8Array }).bytes], [...new TextEncoder().encode('a"b\\c\nd\te é')]);
  assert.match(refusal('"a\\qb"')[0], /the escape \\q is not one of/);
  assert.match(refusal('"\\{"')[0], /the escape \\\{ is not one of/);
});

test("the other literals: truth values, the symbol literal, structures and lists", () => {
  assert.deepEqual([exprOf("true").k, (exprOf("true") as { value: boolean }).value, (exprOf("false") as { value: boolean }).value], ["truth", true, false]);
  const s = exprOf("`name");
  assert.deepEqual([s.k, (s as { name: string }).name], ["symbol", "name"]);
  const r = exprOf("{a: 1, b: x}");
  assert.equal(r.k, "record");
  assert.deepEqual((r as Extract<Expr, { k: "record" }>).fields.map((f) => [f.name.name, shape(f.value)]), [["a", "1"], ["b", "x"]]);
  const l = exprOf("[1, x, [ ]]");
  assert.equal(l.k, "list");
  assert.deepEqual((l as Extract<Expr, { k: "list" }>).items.map((i) => i.k), ["int", "name", "list"]);
  assert.deepEqual(exprOf("{}").k, "record");
});

test("functions, application, the pipe, . and [ ]", () => {
  const f = exprOf("(x, y) => x");
  assert.equal(f.k, "lambda");
  assert.deepEqual((f as Extract<Expr, { k: "lambda" }>).params.map((p) => p.name), ["x", "y"]);
  assert.deepEqual((exprOf("() => 1") as Extract<Expr, { k: "lambda" }>).params, []);
  assert.deepEqual((exprOf("x => x") as Extract<Expr, { k: "lambda" }>).params.map((p) => p.name), ["x"]);
  assert.equal(shape(exprOf("f(a, b)(c)")), "f(a, b)(c)");
  assert.equal(shape(exprOf("a |> f |> g")), "((a |> f) |> g)");
  assert.equal(shape(exprOf("p.a[0].b")), "p.a[0].b");
  assert.equal(shape(exprOf("f()")), "f()");
});

test("if then else, and the conditional operators", () => {
  const e = exprOf("if a then b else c");
  assert.equal(e.k, "if");
  const i = e as Extract<Expr, { k: "if" }>;
  assert.deepEqual([shape(i.condition), shape(i.then), shape(i.else)], ["a", "b", "c"]);
  assert.equal(shape(exprOf("!a && b || c")), "(((!a) && b) || c)");
});

test("precedence and grouping are forms.md's", () => {
  assert.equal(shape(exprOf("a |> f || g")), "(a |> (f || g))");
  assert.equal(shape(exprOf("a || b && c")), "(a || (b && c))");
  assert.equal(shape(exprOf("a && b == c")), "(a && (b == c))");
  assert.equal(shape(exprOf("a == b < c")), "(a == (b < c))");
  assert.equal(shape(exprOf("a < b ++ c")), "(a < (b ++ c))");
  assert.equal(shape(exprOf("a ++ b + c")), "(a ++ (b + c))");
  assert.equal(shape(exprOf("a + b * c")), "(a + (b * c))");
  assert.equal(shape(exprOf("-a * b")), "((-a) * b)");
  assert.equal(shape(exprOf("-f(x).y")), "(-f(x).y)");
  assert.equal(shape(exprOf("a - b - c")), "((a - b) - c)");
  assert.equal(shape(exprOf("a ++ b ++ c")), "((a ++ b) ++ c)");
  assert.equal(shape(exprOf("a / b % c")), "((a / b) % c)");
  assert.equal(shape(exprOf("a != b == c")), "((a != b) == c)");
});

test("the header lines come first, then the module's block", () => {
  const m = moduleOf("capability output\ninput name\nimport other\nx = 1\noutput.write(x)");
  assert.deepEqual(m.headers.map((h) => [h.k, h.name.name]), [["capability", "output"], ["input", "name"], ["import", "other"]]);
  assert.deepEqual(m.items.map((i) => i.k), ["binding", "statement"]);
  assert.match(refusal("x = 1\ncapability output")[0], /header lines come before anything else/);
  assert.match(refusal("f() =>\n  input x\n  x")[0], /belongs at the start of the text/);
});

test("a block's bindings, function bindings, statements and x <- e, with export at the module's level only", () => {
  const m = moduleOf("x = 1\nexport y = 2\nf(a, b) => a\nexport g() => 3\nz <- f(x, y)\ng()");
  assert.deepEqual(m.items.map((i) => [i.k, "name" in i ? i.name.name : "", "exported" in i ? i.exported : null]),
    [["binding", "x", false], ["binding", "y", true], ["function", "f", false], ["function", "g", true], ["arrow", "z", null], ["statement", "", null]]);
  const f = m.items[2] as Extract<Item, { k: "function" }>;
  assert.deepEqual(f.params.map((p) => p.name), ["a", "b"]);
  const body = moduleOf("f(x) =>\n  y = x\n  see(y)\n  n <- y\n  n").items[0] as Extract<Item, { k: "function" }>;
  assert.equal(body.body.k, "block");
  assert.deepEqual((body.body as Extract<Expr, { k: "block" }>).items.map((i) => i.k), ["binding", "statement", "arrow", "statement"]);
  assert.match(refusal("f() =>\n  export y = 1\n  y")[0], /export marks a binding of the module/);
});

test("every node keeps its place in the text", () => {
  const m = moduleOf("input see\n\nsee(\"a\")\n  // comment\nx <- see(42)");
  const [s, a] = m.items as [Extract<Item, { k: "statement" }>, Extract<Item, { k: "arrow" }>];
  assert.deepEqual([s.at.line, s.at.column], [3, 1]);
  assert.deepEqual([a.at.line, a.at.column, a.name.at.column], [5, 1, 1]);
  const call = a.value as Extract<Expr, { k: "apply" }>;
  assert.deepEqual([call.args[0].at.line, call.args[0].at.column, call.args[0].at.start, call.args[0].at.end], [5, 10, 42, 44]);
  assert.equal(m.headers[0].at.line, 1);
});

test("what the grammar still parses and forms.md §2 gives no meaning is refused: and, or, 0b", () => {
  assert.match(refusal("a and b")[0], /the keyword and is not a form of Allegretto/);
  assert.match(refusal("a or b")[0], /the keyword or is not a form of Allegretto/);
  assert.match(refusal("0b101")[0], /the binary number 0b101 is not a form of Allegretto/);
});

test("a text the grammar refuses is one finding, at the place the parse stopped", () => {
  const r = read("x = 1\nnone");
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.findings.length, 1);
    assert.match(r.findings[0].message, /^not Allegretto: /);
    assert.equal(r.findings[0].at.line, 2);
  }
});

test("each refusal in a text is reported, not only the first", () => {
  assert.equal(refusal("a = 9223372036854775808\nb = \"\\q\"\nc = 0b1").length, 3);
});
