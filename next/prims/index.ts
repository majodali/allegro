// The pure primitive functions the platform ships.
//
// Whose: the kernel stream (lane R). Read by: a launcher, which hands them
// to a kernel and to the loader of saved programs; the acceptance stream's
// emitter, which names each by its content hash; anyone who writes a
// reference definition.
//
// Decisions: "Machine arithmetic is a set of pure primitives that ships
// with the platform", "Every pure primitive the platform ships has a
// reference definition" (a goal: none is written yet), "Host code reaches
// a program only as primitive functions". The names and behaviour are
// those of Allegretto's forms, next/ext/allegretto/forms.md section 3.
//
// Each primitive takes bits and answers bits. An integer is 64 bits, most
// significant byte first, read as two's complement where a sign matters.
// A float is 64 bits, IEEE 754 binary64, most significant byte first. A
// truth value is the kernel's: one bit. A text is its UTF-8 bytes.
//
// Outside its domain a primitive refuses, and the kernel answers a
// refutation: an argument that is not bits of the right length, division
// or remainder by zero, a text that is not a number.
//
// The content hash. A saved program names a primitive by the hash of its
// content, which by ruling is its host code: the helpers below, shared by
// every primitive, and the primitive's own entry in the list. The hashes
// are computed by hash-source.ts and committed in hashes.ts; a test
// computes them again. After changing this file, run
//   npx tsx next/prims/hash-source.ts --write
// A record built against a primitive does not load once its code changes.

import { Refusal, type PrimitiveContext, type PrimitiveDeclaration, type Value } from "../kernel/interface.js";
import { HASHES } from "./hashes.js";

type Pure = Extract<PrimitiveDeclaration, { purity: "pure" }>;

const utf8 = new TextEncoder();
const MIN = -(2n ** 63n);
const MAX = 2n ** 63n - 1n;

function bytesOf(name: string, v: Value, c: PrimitiveContext, what: string): Uint8Array {
  if (c.kind(v) !== "bits") throw new Refusal(`${name} takes ${what}, not a value of kind ${c.kind(v)}`);
  return c.bitsOf(v).bytes;
}
function word(name: string, v: Value, c: PrimitiveContext, what: string): DataView {
  if (c.kind(v) !== "bits" || c.bitsOf(v).bitLength !== 64) throw new Refusal(`${name} takes ${what} of 64 bits`);
  const { bytes } = c.bitsOf(v);
  return new DataView(bytes.buffer, bytes.byteOffset, 8);
}
const int = (name: string, v: Value, c: PrimitiveContext): bigint => word(name, v, c, "an integer").getBigInt64(0);
const float = (name: string, v: Value, c: PrimitiveContext): number => word(name, v, c, "a float").getFloat64(0);
function fromInt(n: bigint, c: PrimitiveContext): Value {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setBigInt64(0, BigInt.asIntN(64, n));
  return c.bits(bytes);
}
function fromFloat(x: number, c: PrimitiveContext): Value {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setFloat64(0, x);
  return c.bits(bytes);
}
const truth = (b: boolean, c: PrimitiveContext): Value => c.bits(Uint8Array.of(b ? 1 : 0), 1);
const text = (t: string, c: PrimitiveContext): Value => c.bits(utf8.encode(t));

function primitive(name: string, arity: number, _meaning: string, run: (args: readonly Value[], c: PrimitiveContext) => Value): Pure {
  const hash = HASHES[name];
  if (hash === undefined) throw new Error(`the shipped primitive ${name} has no committed hash: run next/prims/hash-source.ts --write`);
  return { purity: "pure", hash, name, arity, run };
}
const int2 = (name: string, meaning: string, f: (a: bigint, b: bigint) => bigint): Pure =>
  primitive(name, 2, meaning, (a, c) => fromInt(f(int(name, a[0], c), int(name, a[1], c)), c));
const intTest = (name: string, meaning: string, f: (a: bigint, b: bigint) => boolean): Pure =>
  primitive(name, 2, meaning, (a, c) => truth(f(int(name, a[0], c), int(name, a[1], c)), c));
const float2 = (name: string, meaning: string, f: (a: number, b: number) => number): Pure =>
  primitive(name, 2, meaning, (a, c) => fromFloat(f(float(name, a[0], c), float(name, a[1], c)), c));
const floatTest = (name: string, meaning: string, f: (a: number, b: number) => boolean): Pure =>
  primitive(name, 2, meaning, (a, c) => truth(f(float(name, a[0], c), float(name, a[1], c)), c));

function nonZero(name: string, b: bigint): bigint {
  if (b === 0n) throw new Refusal("division by zero");
  return b;
}

/** A float's text: the shortest decimal that reads back as the same float; a whole float has no point. */
function floatText(x: number): string {
  if (Number.isNaN(x)) return "nan";
  if (x === Infinity) return "inf";
  if (x === -Infinity) return "-inf";
  return Object.is(x, -0) ? "-0" : String(x);
}

/** Every shipped primitive, in name order. */
export const shipped: readonly Pure[] = [
  primitive("bits.int", 1, "the bits of a value of at most 64 bits, read as a whole number with the most significant bit first, as a signed 64-bit integer; a value of 64 bits is that integer; refused for more than 64 bits", (a, c) => {
    const b = c.bitsOf(a[0]);
    if (b.bitLength > 64) throw new Refusal("bits.int takes at most 64 bits");
    let n = 0n;
    for (const byte of b.bytes) n = (n << 8n) | BigInt(byte);
    return fromInt(BigInt.asIntN(64, n & ((1n << BigInt(b.bitLength)) - 1n)), c);
  }),
  float2("float.add", "the sum of two binary64 floats, rounded to nearest, ties to even", (a, b) => a + b),
  float2("float.div", "the quotient of two binary64 floats, rounded to nearest, ties to even; division by zero follows IEEE 754", (a, b) => a / b),
  floatTest("float.eq", "true where two binary64 floats are equal as numbers: zero equals negative zero, and what is not a number equals nothing", (a, b) => a === b),
  floatTest("float.ge", "true where the first binary64 float is greater than or equal to the second; false where either is not a number", (a, b) => a >= b),
  floatTest("float.gt", "true where the first binary64 float is greater than the second; false where either is not a number", (a, b) => a > b),
  primitive("float.int", 1, "a binary64 float truncated toward zero to a signed 64-bit integer; refused where it is not a number or does not fit", (a, c) => {
    const x = float("float.int", a[0], c);
    if (!Number.isFinite(x)) throw new Refusal("float.int takes a finite float");
    const n = BigInt(Math.trunc(x));
    if (n < MIN || n > MAX) throw new Refusal("float.int: the float is outside the signed 64-bit range");
    return fromInt(n, c);
  }),
  floatTest("float.le", "true where the first binary64 float is less than or equal to the second; false where either is not a number", (a, b) => a <= b),
  floatTest("float.lt", "true where the first binary64 float is less than the second; false where either is not a number", (a, b) => a < b),
  float2("float.mul", "the product of two binary64 floats, rounded to nearest, ties to even", (a, b) => a * b),
  primitive("float.neg", 1, "a binary64 float with its sign changed", (a, c) => fromFloat(-float("float.neg", a[0], c), c)),
  float2("float.sub", "the difference of two binary64 floats, rounded to nearest, ties to even", (a, b) => a - b),
  primitive("float.text", 1, "a binary64 float as UTF-8 text: the shortest decimal that reads back as the same float, with no point for a whole number; nan, inf and -inf", (a, c) =>
    text(floatText(float("float.text", a[0], c)), c)),
  int2("int.add", "the sum of two 64-bit integers, wrapping", (a, b) => a + b),
  int2("int.div", "the quotient of two signed 64-bit integers, truncated toward zero, wrapping; refused where the divisor is zero", (a, b) => a / nonZero("int.div", b)),
  primitive("int.float", 1, "a signed 64-bit integer as the nearest binary64 float, ties to even", (a, c) => fromFloat(Number(int("int.float", a[0], c)), c)),
  intTest("int.ge", "true where the first signed 64-bit integer is greater than or equal to the second", (a, b) => a >= b),
  intTest("int.gt", "true where the first signed 64-bit integer is greater than the second", (a, b) => a > b),
  intTest("int.le", "true where the first signed 64-bit integer is less than or equal to the second", (a, b) => a <= b),
  intTest("int.lt", "true where the first signed 64-bit integer is less than the second", (a, b) => a < b),
  int2("int.mod", "the remainder of two signed 64-bit integers, with the sign of the dividend; refused where the divisor is zero", (a, b) => a % nonZero("int.mod", b)),
  int2("int.mul", "the product of two 64-bit integers, wrapping", (a, b) => a * b),
  primitive("int.neg", 1, "a 64-bit integer negated, wrapping", (a, c) => fromInt(-int("int.neg", a[0], c), c)),
  int2("int.sub", "the difference of two 64-bit integers, wrapping", (a, b) => a - b),
  primitive("int.text", 1, "a signed 64-bit integer as UTF-8 text: decimal digits, with a leading minus where negative", (a, c) => text(int("int.text", a[0], c).toString(), c)),
  // text.byte, text.span, text.starts and text.until are what a parser's terminals stand on
  // (docs/plans/book-pass.md section 10.3): each reads a text from a byte position, in one step. A position is a count of bytes from the start of the text.
  primitive("text.byte", 2, "the byte of a text at a position, as a signed 64-bit integer; minus one at the end of the text; refused for a position before the start or beyond the end", (a, c) => {
    const [t, at] = [bytesOf("text.byte", a[0], c, "a text"), int("text.byte", a[1], c)];
    if (at < 0n || at > BigInt(t.length)) throw new Refusal(`text.byte: the position ${at} is outside a text of ${t.length} byte(s)`);
    return fromInt(at === BigInt(t.length) ? -1n : BigInt(t[Number(at)]), c);
  }),
  primitive("text.int", 1, "the signed 64-bit integer a UTF-8 text writes in decimal digits, with an optional leading minus; refused for any other text or a number that does not fit", (a, c) => {
    const t = new TextDecoder().decode(bytesOf("text.int", a[0], c, "a text"));
    if (!/^-?[0-9]+$/.test(t)) throw new Refusal(`text.int: "${t}" is not a whole number`);
    const n = BigInt(t);
    if (n < MIN || n > MAX) throw new Refusal(`text.int: ${t} is outside the signed 64-bit range`);
    return fromInt(n, c);
  }),
  primitive("text.span", 3, "the count of bytes of a text, from a position on, that belong to a class, as a signed 64-bit integer; a class is a text of pairs of bytes, each pair the lowest and the highest byte of a range, and a byte belongs where it is in a range; refused for a position before the start or beyond the end, or a class that is not pairs", (a, c) => {
    const [t, at, ranges] = [bytesOf("text.span", a[0], c, "a text"), int("text.span", a[1], c), bytesOf("text.span", a[2], c, "a class")];
    if (at < 0n || at > BigInt(t.length)) throw new Refusal(`text.span: the position ${at} is outside a text of ${t.length} byte(s)`);
    if (ranges.length % 2 !== 0) throw new Refusal(`text.span: a class is pairs of bytes, and this one has ${ranges.length} byte(s)`);
    const member = new Uint8Array(256);
    for (let r = 0; r < ranges.length; r += 2) for (let b = ranges[r]; b <= ranges[r + 1]; b++) member[b] = 1;
    let end = Number(at);
    while (end < t.length && member[t[end]] === 1) end++;
    return fromInt(BigInt(end) - at, c);
  }),
  primitive("text.starts", 3, "true where a text, from a position on, begins with a second text; refused for a position before the start or beyond the end", (a, c) => {
    const [t, at, lit] = [bytesOf("text.starts", a[0], c, "a text"), int("text.starts", a[1], c), bytesOf("text.starts", a[2], c, "a text")];
    if (at < 0n || at > BigInt(t.length)) throw new Refusal(`text.starts: the position ${at} is outside a text of ${t.length} byte(s)`);
    const from = Number(at);
    if (from + lit.length > t.length) return truth(false, c);
    for (let i = 0; i < lit.length; i++) if (t[from + i] !== lit[i]) return truth(false, c);
    return truth(true, c);
  }),
  primitive("text.until", 3, "the count of bytes of a text, from a position on, before the next place a second text begins, or to the end of the text where it begins nowhere, as a signed 64-bit integer; refused for a position before the start or beyond the end, or a second text that is empty", (a, c) => {
    const [t, at, lit] = [bytesOf("text.until", a[0], c, "a text"), int("text.until", a[1], c), bytesOf("text.until", a[2], c, "a text")];
    if (at < 0n || at > BigInt(t.length)) throw new Refusal(`text.until: the position ${at} is outside a text of ${t.length} byte(s)`);
    if (lit.length === 0) throw new Refusal("text.until: the text to stop at is empty");
    let end = Number(at);
    scan: for (; end < t.length; end++) {
      if (end + lit.length > t.length) { end = t.length; break; }
      for (let i = 0; i < lit.length; i++) if (t[end + i] !== lit[i]) continue scan;
      break;
    }
    return fromInt(BigInt(end) - at, c);
  }),
];

/** The shipped primitives by name. */
export const shippedByName: ReadonlyMap<string, Pure> = new Map(shipped.map((p) => [p.name, p]));
