// Tests of the shipped primitives, through a kernel: each is applied as a
// program would apply it.
//
//   npm run test:next

import { test } from "node:test";
import assert from "node:assert/strict";
import type { Value } from "../kernel/interface.js";
import { createKernel } from "../kernel/kernel.js";
import { shipped, shippedByName } from "./index.js";
import { HASHES } from "./hashes.js";
import { readSource, sourceHashes } from "./hash-source.js";

const k = createKernel();
const fns = new Map([...shippedByName].map(([name, d]) => [name, k.primitiveFunction(d)]));
const int = (n: bigint): Value => {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setBigInt64(0, BigInt.asIntN(64, n));
  return k.bits(bytes);
};
const float = (x: number): Value => {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setFloat64(0, x);
  return k.bits(bytes);
};
const text = (t: string): Value => k.bits(new TextEncoder().encode(t));
const run = (name: string, ...args: Value[]) => k.evaluate(k.expression(fns.get(name)!, args), k.scope());
const view = (v: Value) => { const { bytes } = k.bitsOf(v); return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); };
const asInt = (name: string, ...args: Value[]) => view(run(name, ...args).value).getBigInt64(0);
const asFloat = (name: string, ...args: Value[]) => view(run(name, ...args).value).getFloat64(0);
const asText = (name: string, ...args: Value[]) => new TextDecoder().decode(k.bitsOf(run(name, ...args).value).bytes);
const asTruth = (name: string, ...args: Value[]) => { const b = k.bitsOf(run(name, ...args).value); assert.equal(b.bitLength, 1); return b.bytes[0] === 1; };
const refusal = (name: string, ...args: Value[]) => { const r = run(name, ...args); assert.equal(r.refuted, true, `${name} should refuse`); return k.reasonOf(r.value) ?? ""; };
const MAX = 2n ** 63n - 1n;
const MIN = -(2n ** 63n);

test("the shipped primitives are listed in name order, each with its own content hash", () => {
  const names = shipped.map((p) => p.name);
  assert.deepEqual(names, [...names].sort());
  assert.equal(new Set(shipped.map((p) => p.hash)).size, shipped.length);
  for (const p of shipped) assert.match(p.hash, /^sha256:[0-9a-f]{64}$/);
  // The names Allegretto's forms give, section 3.
  assert.deepEqual(names, [
    "bits.int",
    "float.add", "float.div", "float.eq", "float.ge", "float.gt", "float.int", "float.le", "float.lt", "float.mul", "float.neg", "float.sub", "float.text",
    "int.add", "int.div", "int.float", "int.ge", "int.gt", "int.le", "int.lt", "int.mod", "int.mul", "int.neg", "int.sub", "int.text", "text.int",
  ]);
});

test("each hash is taken over the primitive's host code, and the committed hashes are the source's", () => {
  const source = readSource();
  assert.deepEqual({ ...HASHES }, sourceHashes(source), "run: npx tsx next/prims/hash-source.ts --write");
  for (const p of shipped) assert.equal(p.hash, HASHES[p.name]);
  const changed = (edit: (s: string) => string) => {
    const [before, after] = [sourceHashes(source), sourceHashes(edit(source))];
    return Object.keys(before).filter((n) => before[n] !== after[n]);
  };
  const once = (s: string, a: string, b: string) => { assert.equal(s.split(a).length, 2, a); return s.replace(a, b); };
  // A change to one primitive's code changes that primitive's hash and no other.
  assert.deepEqual(changed((s) => once(s, "(a, b) => a + b),\n  int2(\"int.div\"", "(a, b) => a - b),\n  int2(\"int.div\"")), ["int.add"]);
  // A change to code every primitive shares changes every hash.
  assert.equal(changed((s) => once(s, "new DataView(bytes.buffer).setFloat64(0, x);", "new DataView(bytes.buffer).setFloat64(0, -x);")).length, shipped.length);
  // A comment and a blank line change none.
  assert.deepEqual(changed((s) => "// a new comment\n\n" + s), []);
});

test("integer arithmetic is 64-bit and wraps", () => {
  assert.equal(asInt("int.add", int(2n), int(3n)), 5n);
  assert.equal(asInt("int.add", int(MAX), int(1n)), MIN);
  assert.equal(asInt("int.sub", int(2n), int(3n)), -1n);
  assert.equal(asInt("int.sub", int(MIN), int(1n)), MAX);
  assert.equal(asInt("int.mul", int(-4n), int(6n)), -24n);
  assert.equal(asInt("int.mul", int(2n ** 62n), int(4n)), 0n);
  assert.equal(asInt("int.neg", int(7n)), -7n);
  assert.equal(asInt("int.neg", int(MIN)), MIN);
});

test("integer division truncates toward zero, and the remainder takes the dividend's sign", () => {
  assert.equal(asInt("int.div", int(7n), int(2n)), 3n);
  assert.equal(asInt("int.div", int(-7n), int(2n)), -3n);
  assert.equal(asInt("int.div", int(7n), int(-2n)), -3n);
  assert.equal(asInt("int.mod", int(-7n), int(3n)), -1n);
  assert.equal(asInt("int.mod", int(7n), int(-3n)), 1n);
  assert.equal(asInt("int.div", int(MIN), int(-1n)), MIN, "the one quotient that does not fit wraps");
  assert.equal(refusal("int.div", int(1n), int(0n)), "division by zero");
  assert.equal(refusal("int.mod", int(1n), int(0n)), "division by zero");
});

test("integer orderings are signed", () => {
  assert.equal(asTruth("int.lt", int(-1n), int(1n)), true, "as unsigned bits -1 would be the larger");
  assert.equal(asTruth("int.lt", int(1n), int(1n)), false);
  assert.equal(asTruth("int.le", int(1n), int(1n)), true);
  assert.equal(asTruth("int.gt", int(MIN), int(MAX)), false);
  assert.equal(asTruth("int.ge", int(MAX), int(MAX)), true);
  assert.equal(asTruth("int.ge", int(-2n), int(-1n)), false);
});

test("an integer and its text", () => {
  assert.equal(asText("int.text", int(0n)), "0");
  assert.equal(asText("int.text", int(-42n)), "-42");
  assert.equal(asText("int.text", int(MIN)), "-9223372036854775808");
  assert.equal(asInt("text.int", text("9223372036854775807")), MAX);
  assert.equal(asInt("text.int", text("-17")), -17n);
  assert.match(refusal("text.int", text("12a")), /not a whole number/);
  assert.match(refusal("text.int", text("")), /not a whole number/);
  assert.match(refusal("text.int", text("9223372036854775808")), /outside/);
});

test("float arithmetic and orderings follow IEEE 754", () => {
  assert.equal(asFloat("float.add", float(1.5), float(2.5)), 4);
  assert.equal(asFloat("float.add", float(0.1), float(0.2)), 0.30000000000000004);
  assert.equal(asFloat("float.sub", float(1), float(0.25)), 0.75);
  assert.equal(asFloat("float.mul", float(1.5), float(-2)), -3);
  assert.equal(asFloat("float.div", float(7), float(2)), 3.5);
  assert.equal(asFloat("float.div", float(1), float(0)), Infinity, "division by zero is not refused for floats");
  assert.ok(Number.isNaN(asFloat("float.div", float(0), float(0))));
  assert.equal(asFloat("float.neg", float(2.5)), -2.5);
  assert.equal(asTruth("float.lt", float(1), float(1.5)), true);
  assert.equal(asTruth("float.le", float(1.5), float(1.5)), true);
  assert.equal(asTruth("float.lt", float(NaN), float(1)), false);
  assert.equal(asTruth("float.le", float(NaN), float(NaN)), false);
  // Added on 2026-11-19: `==` compares bits, so a float needs comparisons of its own.
  assert.equal(asTruth("float.eq", float(1.5), float(1.5)), true);
  assert.equal(asTruth("float.eq", float(0), float(-0)), true, "zero equals negative zero, though their bits differ");
  assert.equal(asTruth("float.eq", float(NaN), float(NaN)), false, "what is not a number equals nothing, though its bits equal themselves");
  assert.equal(asTruth("float.gt", float(2), float(1.5)), true);
  assert.equal(asTruth("float.gt", float(1.5), float(1.5)), false);
  assert.equal(asTruth("float.ge", float(1.5), float(1.5)), true);
  assert.equal(asTruth("float.ge", float(NaN), float(1)), false);
});

test("bits.int reads up to 64 bits as a whole number", () => {
  const bits = (bytes: number[], length?: number): Value => k.bits(Uint8Array.from(bytes), length);
  assert.equal(asInt("bits.int", bits([0x41])), 65n, "one byte of a text: the letter A");
  assert.equal(asInt("bits.int", bits([0xff])), 255n, "widened with zeros, never with the sign");
  assert.equal(asInt("bits.int", bits([0x01, 0x00])), 256n);
  assert.equal(asInt("bits.int", bits([])), 0n, "no bits is zero");
  assert.equal(asInt("bits.int", bits([0x05], 3)), 5n, "three bits");
  assert.equal(asInt("bits.int", int(-1n)), -1n, "64 bits are the integer they are");
  assert.match(refusal("bits.int", bits([1, 2, 3, 4, 5, 6, 7, 8, 9])), /at most 64 bits/);
});

test("a float's text is the shortest that reads back, and floats and integers convert", () => {
  assert.equal(asText("float.text", float(4)), "4");
  assert.equal(asText("float.text", float(3.5)), "3.5");
  assert.equal(asText("float.text", float(0.1)), "0.1");
  assert.equal(asText("float.text", float(-0)), "-0");
  assert.equal(asText("float.text", float(NaN)), "nan");
  assert.equal(asText("float.text", float(-Infinity)), "-inf");
  assert.equal(asFloat("int.float", int(3n)), 3);
  assert.equal(asFloat("int.float", int(MAX)), 9223372036854775808, "rounded to the nearest float");
  assert.equal(asInt("float.int", float(-3.9)), -3n);
  assert.match(refusal("float.int", float(NaN)), /finite/);
  assert.match(refusal("float.int", float(1e19)), /outside/);
});

test("an argument that is not 64 bits is refused, and an unknown argument leaves a residual", () => {
  assert.match(refusal("int.add", int(1n), k.bits(Uint8Array.of(1))), /64 bits/);
  assert.match(refusal("float.add", float(1), k.bits(Uint8Array.of(1), 1)), /64 bits/);
  assert.match(refusal("int.text", k.structure([])), /64 bits/);
  assert.match(refusal("text.int", k.structure([])), /not a value of kind structure/);
  const c = k.cell();
  const scope = k.scope();
  const waits = k.evaluate(k.expression(fns.get("int.add")!, [int(1n), c]), scope);
  assert.equal(k.kind(waits.value), "expression");
  k.fill(c, int(2n));
  k.advance({ steps: 100 });
  assert.equal(view(k.current(waits.value)).getBigInt64(0), 3n);
});
