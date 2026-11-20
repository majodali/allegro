// Tests of the reader of an Allegretto literal as plain data (B-196 (the
// rebuild's acceptance side), chunk Q7 (the minimal launcher and the output
// capability), part 3): `readLiteral` of next/bootstrap/literal.ts. Run by
// `npm run test:next`.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createKernel } from "../kernel/create.js";
import { encode, type SavedProgram } from "../kernel/saved-program.js";
import { launch, type Configuration, type Plain } from "../launch/launcher.js";
import { output } from "../launch/output.js";
import { shipped } from "../prims/index.js";
import { emit } from "./emit.js";
import { readLiteral } from "./literal.js";

const int64 = (n: bigint): Plain => {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setBigInt64(0, n, false);
  return { bits: bytes, bitLength: 64 };
};
const float64 = (x: number): Plain => {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setFloat64(0, x, false);
  return { bits: bytes, bitLength: 64 };
};
const text = (t: string): Plain => {
  const bytes = new TextEncoder().encode(t);
  return { bits: bytes, bitLength: bytes.length * 8 };
};
const ok = (literal: string): Plain => {
  const r = readLiteral(literal);
  assert.ok(r.ok, r.ok ? "" : r.finding);
  return r.value;
};

test("each literal form is read as the plain data forms.md §2 says it stands for", () => {
  assert.deepEqual(ok('"hi\\n"'), text("hi\n"));
  assert.deepEqual(ok("42"), int64(42n));
  assert.deepEqual(ok("0xFF"), int64(255n));
  assert.deepEqual(ok("1.5"), float64(1.5));
  assert.deepEqual(ok("true"), { bits: Uint8Array.of(1), bitLength: 1 });
  assert.deepEqual(ok("false"), { bits: Uint8Array.of(0), bitLength: 1 });
  assert.deepEqual(ok("`name"), { symbol: "name" });
  assert.deepEqual(ok("-7"), int64(-7n));
  assert.deepEqual(ok("-9223372036854775807"), int64(-9223372036854775807n));
  assert.deepEqual(ok("-9223372036854775808"), int64(-(2n ** 63n)), "the least integer");
  assert.deepEqual(ok("-1.5"), float64(-1.5), "a - written before a fraction is part of the literal");
  assert.deepEqual(ok("-0.0"), float64(-0), "and -0.0 is negative zero");
  assert.deepEqual(ok("[]"), { entries: [] });
  assert.deepEqual(ok("{}"), { entries: [] });
  assert.deepEqual(ok('{a: 1, b: [true, `x, {c: "t"}], d: -2}'), {
    entries: [
      [{ symbol: "a" }, int64(1n)],
      [{ symbol: "b" }, { entries: [[null, { bits: Uint8Array.of(1), bitLength: 1 }], [null, { symbol: "x" }], [null, { entries: [[{ symbol: "c" }, text("t")]] }]] }],
      [{ symbol: "d" }, int64(-2n)],
    ],
  });
});

test("anything else is refused with a finding that says an input's value is a literal", () => {
  for (const [literal, holds] of [
    ["x", /holds the name x$/],
    ["1 + 2", /holds an expression \(binary\)$/],
    ["f(1)", /holds an application$/],
    ["x => x", /holds a function$/],
    ["--5", /holds a negation of something that is not a whole number$/],
    ["!true", /holds a negation with !$/],
    ["{a: y}", /holds the name y$/],
    ['{[`k]: 1}', /holds an entry with a computed key$/],
    ["1\n2", /is not one literal$/],
    ["capability output\n1", /is not one literal$/],
    ["", /is not one literal$/],
    ["9223372036854775808", /is not Allegretto: the whole number 9223372036854775808 is outside the signed 64-bit range$/],
    ['"open', /is not Allegretto/],
  ] as const) {
    const r = readLiteral(literal);
    assert.equal(r.ok, false, literal);
    if (r.ok) continue;
    assert.match(r.finding, /^an input's value is a literal: a text, a number, true, false, a symbol, or a structure or array of these; /, literal);
    assert.match(r.finding, holds, literal);
  }
});

/** module(output, v) => output.write(if <test> then "true" else "false"). */
function sameAs(test: string): SavedProgram {
  const r = emit(`capability output\ninput v\noutput.write(if ${test} then "true" else "false")\n`);
  assert.ok(r.ok, r.ok ? "" : r.findings.map((f) => f.message).join("; "));
  return JSON.parse(encode(r.program)) as SavedProgram;
}

test("a literal handed as an input is the same as the same literal written in the program: the program prints true", async () => {
  const cases: Array<[string, string]> = [
    ['"text"', 'v == "text"'],
    ["42", "v == 42"],
    ["0xFF", "v == 255"],
    ["-7", "v == -7"],
    ["-9223372036854775808", "v == -9223372036854775808"],
    ["1.5", "v == 1.5"],
    ["true", "v == true"],
    ["false", "v == false"],
    ["`name", "v == `name"],
    ['{a: -1, b: [`x, "t"]}', 'v.a == -1 && v.b[0] == `x && v.b[1] == "t" && count(v) == 2 && count(v.b) == 2'],
  ];
  for (const [literal, test] of cases) {
    const value = ok(literal);
    const configurations: Configuration[] = [
      { ceiling: ["output"], inputs: { v: value } },
      { ceiling: ["output"], later: [{ v: value }] },
    ];
    for (const configuration of configurations) {
      const outcome = await launch({ createKernel, program: sameAs(test), configuration, target: { capabilities: [output], primitives: shipped } });
      assert.deepEqual(outcome.lines, ["true"], `${literal}: ${test}`);
      assert.equal(outcome.end.kind, "completed", literal);
    }
  }
});
