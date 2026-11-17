// Tests of the reference kernel (next/kernel/kernel.ts), made only through
// the kernel's interface, as host code would. Milestone 1 of the rebuild:
// the kernel evaluates expressions built through its interface. The last
// tests are the kernel's half of milestone 2: a saved program is loaded
// and run by the acceptance stream's launcher on this kernel.
// Run by `npm run test:next`.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Kernel, PrimitiveDeclaration, Rest, Value } from "./interface.js";
import { createKernel, InterfaceError } from "./kernel.js";
import { Refusal } from "./interface.js";
import { load, type SavedProgram } from "./saved-program.js";
import { launch } from "../launch/launcher.js";
import { output } from "../launch/output.js";

const hash = (n: number) => "sha256:" + n.toString(16).padStart(64, "0");

/** A byte as bits, and back. Arithmetic here is on one byte: enough to test calls. */
const byte = (k: Kernel, n: number) => k.bits(Uint8Array.of(n));
const num = (k: Kernel, v: Value) => k.bitsOf(v).bytes[0];
const truth = (k: Kernel, b: boolean) => k.bits(Uint8Array.of(b ? 1 : 0), 1);

/** A pure primitive on bytes. */
function pure(name: string, n: number, arity: number, f: (...xs: number[]) => number | boolean): PrimitiveDeclaration {
  return {
    purity: "pure",
    hash: hash(n),
    name,
    arity,
    run: (args, c) => {
      const r = f(...args.map((a) => c.bitsOf(a).bytes[0]));
      return typeof r === "boolean" ? c.bits(Uint8Array.of(r ? 1 : 0), 1) : c.bits(Uint8Array.of(r & 255));
    },
  };
}

/**
 * What a host does that wants a whole value: it evaluates the value and
 * then each entry it reads, in order. The kernel has no call for this.
 */
function whole(k: Kernel, expression: Value, scope = k.scope()): ReturnType<Kernel["evaluate"]> {
  const r = k.evaluate(expression, scope);
  if (r.refuted || k.kind(r.value) !== "structure") return r;
  for (const [, entry] of k.entriesOf(r.value)) {
    const e = whole(k, entry, scope);
    if (e.refuted) return e;
  }
  return r;
}

/** A block that binds these names around a body: how a name gets a value. */
function within(k: Kernel, bindings: ReadonlyArray<readonly [Value, Value]>, body: Value): Value {
  return k.expression(k.kernelPrimitive("block"), [k.structure(bindings), body]);
}

function setup() {
  const k = createKernel();
  const add = k.primitiveFunction(pure("add", 1, 2, (a, b) => a + b));
  const mul = k.primitiveFunction(pure("mul", 2, 2, (a, b) => a * b));
  const dec = k.primitiveFunction(pure("dec", 3, 1, (a) => a - 1));
  const isZero = k.primitiveFunction(pure("isZero", 4, 1, (a) => a === 0));
  const call = (fn: Value, ...args: Value[]) => k.expression(fn, args);
  const kp = (name: string) => k.kernelPrimitive(name);
  return { k, add, mul, dec, isZero, call, kp };
}

test("the kernel is passive and states its interface", () => {
  const k = createKernel();
  assert.equal(k.interfaceVersion, 1);
  assert.deepEqual(k.waiting(), []);
  assert.deepEqual(k.advance(), { ended: "complete", steps: 0, refuted: [] });
  assert.deepEqual([...k.kernelPrimitiveNames()].sort(), ["attempt", "block", "build", "claim", "count", "describe", "get", "if", "join", "length", "same", "slice", "then"]);
});

test("values of the seven kinds are made and read back", () => {
  const { k, add } = setup();
  const p = k.param("x");
  const s = k.symbol("m.name");
  assert.equal(k.symbol("m.name"), s, "a symbol is the same for the same name");
  const st = k.structure([[null, byte(k, 1)], [s, byte(k, 2)]]);
  const e = k.expression(add, [byte(k, 1), p]);
  const f = k.composedFunction([p], e);
  assert.deepEqual([byte(k, 7), s, p, e, f, add, st].map((v) => k.kind(v)), ["bits", "symbol", "param", "expression", "composed-function", "primitive-function", "structure"]);
  assert.equal(k.symbolName(s), "m.name");
  assert.equal(k.paramName(p), "x");
  assert.equal(k.entriesOf(st).length, 2);
  assert.equal(k.expressionOf(e).args[1], p);
  assert.equal(k.composedFunctionOf(f).body, e);
  assert.deepEqual(k.primitiveFunctionOf(add), { purity: "pure", hash: hash(1), name: "add", arity: 2 });
  assert.throws(() => k.bitsOf(s), InterfaceError);
  assert.throws(() => k.composedFunction([p, p], e), InterfaceError);
});

test("a call of a composed function is evaluated by evaluating its body", () => {
  const { k, add, mul, call } = setup();
  const x = k.param("x");
  const y = k.param("y");
  const f = k.composedFunction([x, y], call(add, call(mul, x, x), y)); // x*x + y
  const r = k.evaluate(call(f, byte(k, 3), byte(k, 4)), k.scope());
  assert.equal(num(k, r.value), 13);
  assert.equal(r.ended, "complete");
  assert.equal(r.refuted, false);
  assert.equal(r.steps, 3, "three applications: f, mul, add");
});

test("functions are values: one can be passed and returned", () => {
  const { k, add, call } = setup();
  const f = k.param("f");
  const x = k.param("x");
  const twice = k.composedFunction([f, x], call(f, call(f, x)));
  const n = k.param("n");
  const addN = k.composedFunction([n], k.composedFunction([x], call(add, x, n))); // n => x => x + n
  const r = k.evaluate(call(twice, call(addN, byte(k, 5)), byte(k, 1)), k.scope());
  assert.equal(num(k, r.value), 11);
});

test("a structure asked for in full has its entries evaluated, in order", () => {
  // Until the ruling of 2026-11-16 a structure's entries were evaluated when it was built.
  const { k, add, call } = setup();
  const s = k.structure([[null, call(add, byte(k, 1), byte(k, 2))], [k.symbol("m.b"), byte(k, 9)]]);
  const r = whole(k, s);
  const entries = k.entriesOf(r.value);
  assert.equal(num(k, entries[0][1]), 3);
  assert.equal(k.symbolName(entries[1][0] as Value), "m.b");
  // Asked for and no more, the structure is complete in shape and its first entry is not yet evaluated.
  const weak = k.evaluate(s, k.scope());
  assert.equal(k.entriesOf(weak.value).length, 2);
  assert.equal(k.kind(k.entriesOf(weak.value)[0][1]), "expression");
  // The caller evaluates the entry it wants.
  assert.equal(num(k, k.evaluate(k.entriesOf(weak.value)[0][1], k.scope()).value), 3);
  // Reading an entry gives its value, not the entry as written.
  const read = k.evaluate(call(k.kernelPrimitive("get"), s, byte(k, 0)), k.scope());
  assert.equal(k.kind(read.value), "bits");
  assert.equal(num(k, read.value), 3);
  const keyed = k.evaluate(call(k.kernelPrimitive("get"), k.structure([[k.symbol("m.sum"), call(add, byte(k, 3), byte(k, 4))]]), k.symbolData("m.sum")), k.scope());
  assert.equal(k.kind(keyed.value), "bits");
  assert.equal(num(k, keyed.value), 7);
  // An entry the caller evaluated that waits is taken up again when its value arrives.
  const c = k.cell();
  const scope = k.scope();
  const waits = whole(k, k.structure([[null, call(add, c, byte(k, 1))], [null, call(add, byte(k, 2), byte(k, 2))]]), scope);
  assert.equal(k.waiting().length, 1);
  k.fill(c, byte(k, 5));
  k.advance({ steps: 100 });
  assert.deepEqual(k.entriesOf(waits.value).map(([, v]) => num(k, k.current(v))), [6, 4]);
  assert.deepEqual(k.waiting(), []);
});

test("recursion on known arguments runs to its end", () => {
  const { k, mul, dec, isZero, call, kp } = setup();
  const scope = k.scope();
  const n = k.param("n");
  const fact = k.symbol("m.fact");
  const factFn = k.composedFunction([n], call(kp("if"), call(isZero, n), byte(k, 1), call(mul, n, call(fact, call(dec, n)))));
  assert.equal(num(k, k.evaluate(within(k, [[fact, factFn]], call(fact, byte(k, 5))), scope).value), 120);
});

test("a name no block binds is a refutation when it is needed, and a name gets a later value through a cell", () => {
  // Until the ruling of 2026-11-17 an unbound name was a residual that waited to be bound.
  // Nothing can bind a free name now, so it never waits.
  const { k, add, call, kp } = setup();
  const scope = k.scope();
  const a = k.symbol("m.a");
  const r = k.evaluate(call(add, a, byte(k, 1)), scope);
  assert.equal(r.refuted, true);
  assert.match(k.reasonOf(r.value) ?? "", /the name m\.a is bound by no block/);
  assert.deepEqual(k.waiting(), [], "a free name is not something that waits");
  // A free name nothing needs refutes nothing.
  assert.equal(num(k, k.evaluate(call(kp("if"), truth(k, true), byte(k, 7), a), scope).value), 7);
  // A value that arrives later: a block binds the name to a cell, and the host fills the cell.
  const c = k.cell();
  const waits = k.evaluate(within(k, [[a, c]], call(add, a, byte(k, 1))), scope);
  assert.equal(waits.refuted, false);
  assert.equal(k.waiting().length, 1);
  k.fill(c, byte(k, 41));
  assert.deepEqual(k.advance().refuted, []);
  assert.equal(num(k, k.current(waits.value)), 42);
  assert.deepEqual(k.waiting(), []);
});

test("a binding is an expression, evaluated when it is needed and in its own block", () => {
  const { k, add, call } = setup();
  const [a, b] = [k.symbol("m.a"), k.symbol("m.b")];
  // b = a + 1, with a bound below it in the text; an inner block binds a again.
  const nested = within(k, [[b, call(add, a, byte(k, 1))], [a, byte(k, 10)]], within(k, [[a, byte(k, 99)]], k.structure([[null, b], [null, a]])));
  assert.deepEqual(k.entriesOf(whole(k, nested).value).map(([, v]) => num(k, v)), [11, 99], "b's own a, not the inner block's");
});

test("a function's names mean what they meant where the function was written", () => {
  const { k, add, call } = setup();
  const [x, f] = [k.symbol("m.x"), k.symbol("m.f")];
  const p = k.param("p");
  const home = within(k, [[x, byte(k, 1)], [f, k.composedFunction([p], call(add, p, x))]], within(k, [[x, byte(k, 100)]], call(f, byte(k, 1))));
  assert.equal(num(k, k.evaluate(home, k.scope()).value), 2);
});

test("nothing can be bound from outside: the interface has no call for it", () => {
  const { k, add, call } = setup();
  assert.equal((k as unknown as Record<string, unknown>).bind, undefined);
  // Two evaluations share nothing: a name one binds is free in the other.
  const a = k.symbol("m.a");
  const scope = k.scope();
  assert.equal(num(k, k.evaluate(within(k, [[a, byte(k, 1)]], call(add, a, a)), scope).value), 2);
  assert.equal(k.evaluate(call(add, a, a), scope).refuted, true);
});

test("a primitive runs only when its arguments are fully known", () => {
  const { k, add, call } = setup();
  const p = k.param("p");
  const r = k.evaluate(call(add, p, call(add, byte(k, 1), byte(k, 2))), k.scope());
  const residual = k.expressionOf(r.value);
  assert.equal(residual.fn, add);
  assert.equal(residual.args[0], p);
  assert.equal(num(k, residual.args[1]), 3, "the known part is evaluated");
  assert.deepEqual(k.waiting(), [], "a parameter is unknown, and nothing will fill it");
});

test("a cell is filled once, and what waited on it is evaluated again by advance", () => {
  const { k, add, call } = setup();
  const [c1, c2] = [k.cell(), k.cell()];
  const r = k.evaluate(call(add, c1, c2), k.scope());
  assert.equal(k.kind(r.value), "expression");
  assert.equal(k.waiting().length, 2);
  k.fill(c1, byte(k, 20));
  assert.equal(k.advance().steps, 1);
  assert.equal(k.waiting().length, 1, "still waits on the other cell");
  k.fill(c2, byte(k, 22));
  k.advance();
  assert.equal(num(k, k.current(r.value)), 42);
  assert.equal(k.advance().steps, 0, "nothing became ready");
  assert.throws(() => k.fill(c1, byte(k, 0)), /already filled/);
  assert.throws(() => k.fill(k.cell(), k.param("p")), /not plain data/);
});

test("the conditional needs only the branch taken, and waits when the condition is unknown", () => {
  const { k, add, call, kp } = setup();
  let ran = 0;
  const mark = k.primitiveFunction({ purity: "effectful", capability: "probe", part: "mark", arity: 0, run: (_a, c) => (ran++, c.structure([])) });
  const scope = k.scope();
  const r1 = k.evaluate(call(kp("if"), truth(k, true), byte(k, 1), call(mark)), scope);
  assert.equal(num(k, r1.value), 1);
  assert.equal(ran, 0, "the branch not taken is not evaluated");
  const c = k.cell();
  const r2 = k.evaluate(call(kp("if"), c, call(mark), call(add, byte(k, 1), byte(k, 1))), scope);
  assert.equal(ran, 0, "neither branch is evaluated while the condition is unknown");
  k.fill(c, truth(k, false));
  k.advance();
  assert.equal(num(k, k.current(r2.value)), 2);
  assert.equal(ran, 0);
  const r3 = k.evaluate(call(kp("if"), byte(k, 1), byte(k, 1), byte(k, 2)), scope);
  assert.equal(r3.refuted, true, "a byte is not a truth value");
  assert.match(k.reasonOf(r3.value) ?? "", /neither true nor false/);
});

test("an argument is evaluated when it is needed: a conditional written as a function needs no wrapper", () => {
  const { k, mul, dec, isZero, call, kp } = setup();
  const scope = k.scope();
  const [c, a, b, n] = ["c", "a", "b", "n"].map((name) => k.param(name));
  const [choose, fact] = [k.symbol("m.choose"), k.symbol("m.fact")];
  const chooseFn = k.composedFunction([c, a, b], call(kp("if"), c, a, b));
  // The recursive call is an argument of `choose`. It is evaluated only when the branch is taken.
  const factFn = k.composedFunction([n], call(choose, call(isZero, n), byte(k, 1), call(mul, n, call(fact, call(dec, n)))));
  assert.equal(num(k, k.evaluate(within(k, [[choose, chooseFn], [fact, factFn]], call(fact, byte(k, 5))), scope).value), 120);
});

test("an argument nothing needs is never evaluated: its effect does not happen and its refutation marks nothing", () => {
  const { k, isZero, call, kp } = setup();
  let ran = 0;
  const mark = k.primitiveFunction({ purity: "effectful", capability: "probe", part: "mark", arity: 0, run: (_a, c) => (ran++, c.structure([])) });
  const [used, unused] = [k.param("used"), k.param("unused")];
  const first = k.composedFunction([used, unused], used);
  const scope = k.scope();
  assert.equal(num(k, k.evaluate(call(first, byte(k, 7), call(mark)), scope).value), 7);
  assert.equal(ran, 0);
  const r = k.evaluate(call(first, byte(k, 7), call(kp("claim"), call(isZero, byte(k, 1)))), scope);
  assert.equal(r.refuted, false);
  assert.equal(k.evaluate(call(first, call(kp("claim"), call(isZero, byte(k, 1))), byte(k, 0)), scope).refuted, true, "needed, it refutes");
});

test("an argument is evaluated at most once, however often it is used, and across an advance", () => {
  const { k, add, call } = setup();
  let ran = 0;
  const count = k.primitiveFunction({ purity: "effectful", capability: "probe", part: "count", arity: 0, run: (_a, c) => c.bits(Uint8Array.of(++ran)) });
  const x = k.param("x");
  const twice = k.composedFunction([x], call(add, x, call(add, x, x)));
  assert.equal(num(k, k.evaluate(call(twice, call(count)), k.scope()).value), 3, "1 + 1 + 1, not 1 + 2 + 3");
  assert.equal(ran, 1);
  // The same when the argument has to wait: what is left of it is still one thing.
  let wrote = 0;
  const write = k.primitiveFunction({ purity: "effectful", capability: "output", part: "write", arity: 1, run: (a, c) => (wrote++, c.bits(c.bitsOf(a[0]).bytes)) });
  const cell = k.cell();
  const r = k.evaluate(call(twice, call(write, cell)), k.scope());
  assert.equal(wrote, 0);
  k.fill(cell, byte(k, 5));
  k.advance();
  assert.equal(num(k, k.current(r.value)), 15);
  assert.equal(wrote, 1);
});

test("an argument is evaluated in the scope where it was written, wherever it ends up", () => {
  const { k, add, call } = setup();
  const [a, kept] = [k.symbol("m.a"), k.symbol("m.kept")];
  const [x, y] = [k.param("x"), k.param("y")];
  const keep = k.composedFunction([x], k.composedFunction([y], call(add, x, y))); // x => y => x + y
  // `a` is not needed where `keep(a)` is written; it is needed inside a block that binds another `a`.
  const program = within(k, [[a, byte(k, 1)], [kept, call(keep, a)]], within(k, [[a, byte(k, 100)]], call(kept, byte(k, 1))));
  assert.equal(num(k, k.evaluate(program, k.scope()).value), 2, "the `a` of where it was written");
});

test("an effect happens when its value is needed, and a structure does not need its entries", () => {
  // Until the ruling of 2026-11-16 this test held that a structure needs its entries in order.
  const { k, call, kp } = setup();
  const said: number[] = [];
  const say = k.primitiveFunction({ purity: "effectful", capability: "output", part: "write", arity: 1, run: (a, c) => (said.push(c.bitsOf(a[0]).bytes[0]), a[0]) });
  const [first, second] = [k.param("first"), k.param("second")];
  const swap = k.composedFunction([first, second], call(kp("then"), second, first));
  k.evaluate(call(swap, call(say, byte(k, 1)), call(say, byte(k, 2))), k.scope());
  assert.deepEqual(said, [2, 1], "in the order the body needs them, not the order the call wrote them");
  // Building a structure performs nothing.
  said.length = 0;
  const pair = k.structure([[null, call(say, byte(k, 1))], [null, call(say, byte(k, 2))], [null, call(say, byte(k, 3))]]);
  const built = k.evaluate(pair, k.scope());
  assert.deepEqual(said, []);
  // Reading an entry performs that entry's effect, once, however often it is read.
  const s = k.symbol("t.s");
  const twice = call(kp("block"), k.structure([[s, pair]]), call(kp("then"), call(kp("get"), s, byte(k, 2)), call(kp("then"), call(kp("get"), s, byte(k, 0)), call(kp("get"), s, byte(k, 2)))));
  assert.equal(num(k, k.evaluate(twice, k.scope()).value), 3);
  assert.deepEqual(said, [3, 1], "in the order read; the second entry is never read and never happens");
  // A primitive function needs its argument in full: every entry, in order.
  said.length = 0;
  const size = k.primitiveFunction({ purity: "pure", hash: hash(50), name: "size", arity: 1, run: (a, c) => c.bits(Uint8Array.of(c.entriesOf(a[0]).length)) });
  assert.equal(num(k, k.evaluate(call(size, pair), k.scope()).value), 3);
  assert.deepEqual(said, [1, 2, 3]);
  // A caller that evaluates every entry performs each, in the order it reads them.
  said.length = 0;
  assert.equal(k.entriesOf(built.value).length, 3);
  whole(k, pair);
  assert.deepEqual(said, [1, 2, 3]);
});

test("then: the first is done, and then the second; a text's order becomes an order of effects", () => {
  const { k, call, kp } = setup();
  const said: number[] = [];
  const say = k.primitiveFunction({ purity: "effectful", capability: "output", part: "write", arity: 1, run: (a, c) => (said.push(c.bitsOf(a[0]).bytes[0]), c.structure([])) });
  const body = call(kp("then"), call(say, byte(k, 1)), call(kp("then"), call(say, byte(k, 2)), byte(k, 9)));
  const r = k.evaluate(body, k.scope());
  assert.deepEqual(said, [1, 2]);
  assert.equal(num(k, r.value), 9, "its value is the second's");
  // Inside a function that does not use the first for its value, the first still happens.
  said.length = 0;
  const x = k.param("x");
  const twice = k.composedFunction([x], call(kp("then"), call(say, x), call(say, x)));
  k.evaluate(call(twice, byte(k, 5)), k.scope());
  assert.deepEqual(said, [5, 5]);
});

test("then: while the first waits, nothing after it is performed, and a refutation after it is found at once", () => {
  const { k, isZero, call, kp } = setup();
  const said: number[] = [];
  const say = k.primitiveFunction({ purity: "effectful", capability: "output", part: "write", arity: 1, run: (a, c) => (said.push(c.bitsOf(a[0]).bytes[0]), c.structure([])) });
  const scope = k.scope();
  const c = k.cell();
  k.evaluate(call(kp("then"), call(say, c), call(say, byte(k, 2))), scope);
  assert.equal(k.waiting().length, 1);
  assert.deepEqual(said, [], "the second is not performed before the first");
  k.fill(c, byte(k, 1));
  k.advance({ steps: 1000 });
  assert.deepEqual(said, [1, 2], "both, in the order written, each once");
  // What follows a waiting statement is still checked: the refutation is found before any effect.
  said.length = 0;
  const d = k.cell();
  const bad = k.evaluate(call(kp("then"), call(say, d), call(kp("then"), call(kp("claim"), call(isZero, byte(k, 3))), call(say, byte(k, 4)))), scope);
  assert.equal(bad.refuted, true);
  assert.deepEqual(said, []);
});

test("bits are told apart, joined, measured and taken apart, and given no other meaning", () => {
  const { k, call, kp } = setup();
  const run = (name: string, ...args: Value[]) => k.evaluate(call(kp(name), ...args), k.scope());
  const big = (v: Value) => k.bitsOf(v).bytes.reduce((n, b) => n * 256 + b, 0);
  const [t, f] = [truth(k, true), truth(k, false)];
  const ab = k.bits(Uint8Array.of(0x61, 0x62));
  assert.deepEqual(k.bitsOf(run("same", ab, k.bits(Uint8Array.of(0x61, 0x62))).value), k.bitsOf(t));
  assert.deepEqual(k.bitsOf(run("same", ab, k.bits(Uint8Array.of(0x61, 0x63))).value), k.bitsOf(f));
  assert.deepEqual(k.bitsOf(run("same", t, k.bits(Uint8Array.of(1))).value), k.bitsOf(f), "one bit and eight bits differ, whatever the byte");
  assert.deepEqual(k.bitsOf(run("same", k.bits(Uint8Array.of(0xff), 1), t).value), k.bitsOf(t), "the bits before the last bitLength are ignored");
  assert.deepEqual(k.bitsOf(run("same", t, k.bits(Uint8Array.of(0x80))).value), k.bitsOf(f), "a value is not the same as a longer one that begins with it");
  assert.deepEqual(k.bitsOf(run("same", k.symbolData("m.a"), k.symbolData("m.a")).value), k.bitsOf(t));
  assert.deepEqual(k.bitsOf(run("same", k.symbolData("m.a"), k.symbolData("m.b")).value), k.bitsOf(f));
  assert.equal(run("same", k.structure([]), k.structure([])).refuted, true, "structures are not compared");
  assert.equal(run("same", ab, k.symbolData("m.a")).refuted, true);
  // join, length, slice
  const joined = run("join", ab, k.bits(Uint8Array.of(0x63))).value;
  assert.deepEqual([...k.bitsOf(joined).bytes], [0x61, 0x62, 0x63]);
  const odd = run("join", t, run("join", f, t).value).value; // the three bits 1 0 1
  assert.deepEqual(k.bitsOf(odd), { bytes: Uint8Array.of(0b101), bitLength: 3 });
  assert.equal(big(run("length", odd).value), 3);
  assert.equal(k.bitsOf(run("length", ab).value).bitLength, 64);
  assert.equal(big(run("length", ab).value), 16);
  const part = run("slice", joined, byte(k, 8), byte(k, 8)).value;
  assert.deepEqual([...k.bitsOf(part).bytes], [0x62]);
  assert.deepEqual(k.bitsOf(run("slice", odd, byte(k, 1), byte(k, 2)).value), { bytes: Uint8Array.of(0b01), bitLength: 2 });
  assert.equal(run("slice", ab, byte(k, 9), byte(k, 8)).refuted, true, "outside the value");
  assert.equal(run("join", ab, k.structure([])).refuted, true);
  // Unknown stays a residual, and is done when the value arrives.
  const c = k.cell();
  const scope = k.scope();
  const waits = k.evaluate(call(kp("join"), ab, c), scope);
  assert.equal(k.kind(waits.value), "expression");
  k.fill(c, k.bits(Uint8Array.of(0x64)));
  k.advance({ steps: 100 });
  assert.deepEqual([...k.bitsOf(k.current(waits.value)).bytes], [0x61, 0x62, 0x64]);
});

test("a structure is read by key, by place and by its number of entries", () => {
  const { k, call, kp } = setup();
  const run = (name: string, ...args: Value[]) => k.evaluate(call(kp(name), ...args), k.scope());
  const big = (v: Value) => k.bitsOf(v).bytes.reduce((n, b) => n * 256 + b, 0);
  const [a, b] = [k.symbolData("m.a"), k.symbolData("m.b")];
  const s = k.structure([[k.symbol("m.a"), byte(k, 1)], [k.symbol("m.b"), byte(k, 2)], [null, byte(k, 3)]]);
  assert.equal(num(k, run("get", s, b).value), 2);
  assert.equal(num(k, run("get", s, byte(k, 0)).value), 1, "a keyed entry also has a place");
  assert.equal(num(k, run("get", s, byte(k, 2)).value), 3);
  assert.equal(big(run("count", s).value), 3);
  assert.equal(run("get", s, k.symbolData("m.c")).refuted, true, "no such key");
  assert.equal(run("get", s, byte(k, 3)).refuted, true, "no such place");
  assert.equal(run("get", byte(k, 1), a).refuted, true, "not a structure");
  assert.equal(run("count", byte(k, 1)).refuted, true);
  // A structure is complete in shape while an entry waits: the other entries can be read.
  const c = k.cell();
  const scope = k.scope();
  const partly = k.structure([[k.symbol("m.a"), c], [k.symbol("m.b"), byte(k, 2)]]);
  assert.equal(num(k, k.evaluate(call(kp("get"), partly, b), scope).value), 2);
  assert.equal(big(k.evaluate(call(kp("count"), partly), scope).value), 2);
  const waiting = k.evaluate(call(kp("get"), partly, a), scope);
  k.fill(c, byte(k, 7));
  k.advance({ steps: 100 });
  assert.equal(num(k, k.current(waiting.value)), 7);
});

test("a primitive function applied outside its domain refuses, and that is a refutation", () => {
  const { k, call } = setup();
  const div = k.primitiveFunction({ purity: "pure", hash: hash(40), name: "div", arity: 2, run: (args, c) => {
    const [x, y] = args.map((v) => c.bitsOf(v).bytes[0]);
    if (y === 0) throw new Refusal("division by zero");
    return c.bits(Uint8Array.of(Math.trunc(x / y)));
  } });
  assert.equal(num(k, k.evaluate(call(div, byte(k, 7), byte(k, 2)), k.scope()).value), 3);
  const bad = k.evaluate(call(div, byte(k, 7), byte(k, 0)), k.scope());
  assert.equal(bad.refuted, true);
  assert.equal(k.reasonOf(bad.value), "division by zero");
  const broken = k.primitiveFunction({ purity: "pure", hash: hash(41), name: "broken", arity: 0, run: () => { throw new Error("a bug in the host code"); } });
  assert.throws(() => k.evaluate(call(broken), k.scope()), /a bug in the host code/, "any other error is the primitive's fault and is not caught");
});

test("a block of bindings: each may use any other and itself, so a recursive function is one value", () => {
  const { k, add, mul, dec, isZero, call, kp } = setup();
  const [fact, n, even, odd, base] = ["t.fact", "t.n", "t.even", "t.odd", "t.base"].map((x) => k.symbol(x));
  const x = k.param("x");
  // fact(x) = if isZero(x) then base else mul(x, fact(dec(x))), with base bound after its use.
  const factFn = k.composedFunction([x], call(kp("if"), call(isZero, x), base, call(mul, x, call(fact, call(dec, x)))));
  const block = call(kp("block"), k.structure([[fact, factFn], [base, call(add, byte(k, 0), byte(k, 1))], [n, byte(k, 5)]]), call(fact, n));
  assert.equal(num(k, k.evaluate(block, k.scope()).value), 120);
  // Two functions that call each other.
  const y = k.param("y");
  const evenFn = k.composedFunction([y], call(kp("if"), call(isZero, y), truth(k, true), call(odd, call(dec, y))));
  const oddFn = k.composedFunction([y], call(kp("if"), call(isZero, y), truth(k, false), call(even, call(dec, y))));
  const both = (m: number) => k.evaluate(call(kp("block"), k.structure([[even, evenFn], [odd, oddFn]]), call(even, byte(k, m))), k.scope());
  assert.deepEqual(k.bitsOf(both(6).value), k.bitsOf(truth(k, true)));
  assert.deepEqual(k.bitsOf(both(7).value), k.bitsOf(truth(k, false)));
  // The function is one value: what the name gives inside is what it gives outside.
  const same = whole(k, call(kp("block"), k.structure([[fact, factFn], [base, byte(k, 1)]]), k.structure([[null, fact], [null, fact]])));
  const [first, second] = k.entriesOf(same.value).map(([, v]) => k.current(v));
  assert.equal(first, second);
  assert.equal(k.kind(first), "composed-function");
});

test("a block of bindings: a value is evaluated when needed, at most once, and a name is the innermost block's", () => {
  const { k, add, call, kp } = setup();
  const said: number[] = [];
  const say = k.primitiveFunction({ purity: "effectful", capability: "output", part: "write", arity: 1, run: (a, c) => (said.push(c.bitsOf(a[0]).bytes[0]), a[0]) });
  const [a, b, unused] = ["t.a", "t.b", "t.unused"].map((x) => k.symbol(x));
  // a is used twice and said once; unused is never said; the body's statement comes first.
  const body = call(kp("then"), call(say, byte(k, 9)), call(add, a, a));
  const r = k.evaluate(call(kp("block"), k.structure([[a, call(say, byte(k, 1))], [unused, call(say, byte(k, 2))]]), body), k.scope());
  assert.equal(num(k, r.value), 2);
  assert.deepEqual(said, [9, 1]);
  // Binding at a place: the block binds the name, and a sequence needs it there.
  said.length = 0;
  const atPlace = call(kp("block"), k.structure([[a, call(say, byte(k, 1))]]), call(kp("then"), a, call(kp("then"), call(say, byte(k, 9)), a)));
  assert.equal(num(k, k.evaluate(atPlace, k.scope()).value), 1);
  assert.deepEqual(said, [1, 9]);
  // An inner block binds the name again; the outer binding is untouched, and reaches inner code that does not rebind it.
  const nested = call(kp("block"), k.structure([[a, byte(k, 1)], [b, byte(k, 10)]]),
    k.structure([[null, call(kp("block"), k.structure([[a, byte(k, 2)]]), call(add, a, b))], [null, a]]));
  assert.deepEqual(k.entriesOf(whole(k, nested).value).map(([, v]) => num(k, v)), [12, 1]);
  // A block written inside a function, and one handed on as an argument, keep their own names.
  const p = k.param("p");
  const inFn = k.composedFunction([p], call(kp("block"), k.structure([[a, call(add, p, byte(k, 1))]]), call(add, a, a)));
  assert.equal(num(k, k.evaluate(call(inFn, byte(k, 4)), k.scope()).value), 10);
  const id = k.composedFunction([p], p);
  assert.equal(num(k, k.evaluate(call(id, call(kp("block"), k.structure([[a, byte(k, 6)]]), a)), k.scope()).value), 6);
  // A binding that waits is taken up again, and its effect is not repeated.
  said.length = 0;
  const c = k.cell();
  const scope = k.scope();
  const waits = k.evaluate(call(kp("block"), k.structure([[a, call(add, call(say, byte(k, 3)), c)]]), call(add, a, a)), scope);
  k.fill(c, byte(k, 4));
  k.advance({ steps: 1000 });
  assert.equal(num(k, k.current(waits.value)), 14);
  assert.deepEqual(said, [3]);
  // Malformed blocks are refutations.
  assert.equal(k.evaluate(call(kp("block"), k.structure([[a, byte(k, 1)], [a, byte(k, 2)]]), a), k.scope()).refuted, true, "a name bound twice");
  assert.equal(k.evaluate(call(kp("block"), k.structure([[null, byte(k, 1)]]), byte(k, 0)), k.scope()).refuted, true, "a binding with no name");
});

test("ahead of what is done, a call with the same information is not opened again", () => {
  const { k, call, kp } = setup();
  const said: number[] = [];
  const say = k.primitiveFunction({ purity: "effectful", capability: "output", part: "write", arity: 1, run: (a, c) => (said.push(c.bitsOf(a[0]).bytes[0]), c.structure([])) });
  const loop = k.symbol("t.loop");
  const x = k.param("x");
  // loop(x) = then(say(x), loop(x)): a program that prints for ever.
  const loopFn = k.composedFunction([x], call(kp("then"), call(say, x), call(loop, x)));
  const c = k.cell();
  const scope = k.scope();
  // Its first statement waits, so the rest is evaluated ahead. It ends, with the inner call left in the residual.
  const r = k.evaluate(call(kp("block"), k.structure([[loop, loopFn]]), call(loop, c)), scope, { steps: 500 });
  assert.equal(r.ended, "complete");
  assert.equal(r.refuted, false);
  assert.deepEqual(said, []);
  // With the value known and the effect performed, the same program runs to its budget: nothing is ahead.
  const run = k.evaluate(call(kp("block"), k.structure([[loop, loopFn]]), call(loop, byte(k, 1))), k.scope(), { steps: 200 });
  assert.equal(run.ended, "limit");
  assert.ok(said.length > 10 && said.every((n) => n === 1));
});

test("once an entry or an argument waits, what follows it performs no effect until it is done", () => {
  const { k, add, call } = setup();
  const said: number[] = [];
  const say = k.primitiveFunction({ purity: "effectful", capability: "output", part: "write", arity: 1, run: (a, c) => (said.push(c.bitsOf(a[0]).bytes[0]), a[0]) });
  // A structure handed to a primitive function, whose first entry waits on a cell.
  const size = k.primitiveFunction({ purity: "pure", hash: hash(51), name: "size", arity: 1, run: (a, x) => x.bits(Uint8Array.of(x.entriesOf(a[0]).length)) });
  const c = k.cell();
  const scope = k.scope();
  const waits = k.evaluate(call(size, k.structure([[null, call(say, c)], [null, call(say, byte(k, 2))]])), scope);
  assert.equal(waits.ended, "complete", "a value that waits is not a limit and not a refutation");
  assert.equal(waits.refuted, false);
  assert.equal(k.waiting().length, 1, "the caller is told what it waits on");
  assert.deepEqual(said, [], "the second entry's effect does not overtake the first's");
  k.fill(c, byte(k, 1));
  k.advance({ steps: 100 });
  assert.deepEqual(said, [1, 2]);
  assert.equal(num(k, k.current(waits.value)), 2);
  // The arguments of a primitive function, the same way.
  said.length = 0;
  const d = k.cell();
  const sum = k.evaluate(call(add, call(say, d), call(say, byte(k, 4))), scope);
  assert.deepEqual(said, []);
  k.fill(d, byte(k, 3));
  k.advance({ steps: 100 });
  assert.deepEqual(said, [3, 4]);
  assert.equal(num(k, k.current(sum.value)), 7);
});

test("a description made by code is read in full when it is built", () => {
  const { k, add, call, kp } = setup();
  const x = k.param("x");
  const f = k.composedFunction([x], call(add, x, byte(k, 1)));
  const scope = k.scope();
  const d = k.evaluate(call(kp("describe"), k.inspectionRight(), f), scope).value;
  // The same description, put together entry by entry: each entry is an expression until it is read.
  const pieces = k.structure(k.entriesOf(d).map((_, i) => [null, call(kp("get"), d, byte(k, i))] as const));
  const built = k.evaluate(call(kp("build"), pieces, k.structure([])), scope);
  assert.equal(built.refuted, false);
  assert.equal(num(k, k.evaluate(call(built.value, byte(k, 6)), scope).value), 7);
});

test("a branch gets more knowledge as an argument: it is a function of the name its condition tested", () => {
  // What a language's `if` form builds for:  if isZero(x) then use(x) else use(x)
  // where `use` wants to know which branch it is in. Nothing is rebound: the
  // branch is a function of x, and the form applies it to x and the fact.
  const { k, isZero, call, kp } = setup();
  const tag = (fact: number) => k.primitiveFunction({ purity: "pure", hash: hash(20 + fact), name: `withFact${fact}`, arity: 1, run: (a, c) => c.structure([[null, a[0]], [null, c.bits(Uint8Array.of(fact))]]) });
  const [knownZero, knownNonZero] = [tag(1), tag(2)];
  const [x, v, thenFn, elseFn] = ["x", "v", "then", "else"].map((n) => k.param(n));
  const refiningIf = k.composedFunction([x, thenFn, elseFn], call(kp("if"), call(isZero, x), call(thenFn, call(knownZero, x)), call(elseFn, call(knownNonZero, x))));
  const use = k.composedFunction([v], v);
  const fact = (n: number) => num(k, k.entriesOf(k.evaluate(call(refiningIf, byte(k, n), use, use), k.scope()).value)[1][1]);
  assert.equal(fact(0), 1, "the then-branch was handed x with the fact that it is zero");
  assert.equal(fact(7), 2, "the else-branch was handed x with the fact that it is not");
});

test("a claim is decided, refuted or left waiting, and only the kernel records which", () => {
  const { k, isZero, call, kp } = setup();
  const scope = k.scope();
  const ok = k.evaluate(call(kp("claim"), call(isZero, byte(k, 0))), scope);
  assert.equal(k.outcomeOf(ok.value), "decided");
  assert.equal(ok.refuted, false);
  const bad = k.evaluate(call(kp("claim"), call(isZero, byte(k, 3))), scope);
  assert.equal(bad.refuted, true);
  assert.equal(k.outcomeOf(bad.value), "refuted");
  const c = k.cell();
  const later = k.evaluate(call(kp("claim"), call(isZero, c)), scope);
  assert.equal(k.outcomeOf(later.value), "undecided");
  k.fill(c, byte(k, 1));
  const advanced = k.advance();
  assert.equal(advanced.refuted.length, 1, "the advance reports the refutation");
  assert.equal(k.outcomeOf(k.current(later.value)), "refuted");
  assert.equal(k.outcomeOf(byte(k, 1)), undefined);
});

test("a refutation marks everything computed from it", () => {
  const { k, add, isZero, call, kp } = setup();
  const x = k.param("x");
  const f = k.composedFunction([x], call(add, x, byte(k, 1)));
  const wrong = k.structure([[null, call(f, call(kp("claim"), call(isZero, byte(k, 1))))]]);
  const r = whole(k, wrong);
  assert.equal(r.refuted, true);
  assert.match(k.reasonOf(r.value) ?? "", /claim that is not true/);
  // A refutation stays where it arose: an entry nothing reads refutes nothing.
  assert.equal(k.evaluate(wrong, k.scope()).refuted, false);
});

test("a call on something that is not a function, or with the wrong number of arguments, is a refutation", () => {
  const { k, add, call } = setup();
  const r = k.evaluate(call(byte(k, 1), byte(k, 2)), k.scope());
  assert.equal(r.refuted, true);
  assert.match(k.reasonOf(r.value) ?? "", /not a function/);
  assert.equal(k.evaluate(call(add, byte(k, 1)), k.scope()).refuted, true);
  assert.equal(k.evaluate(call(k.composedFunction([], byte(k, 1)), byte(k, 2)), k.scope()).refuted, true);
});

test("there is no quotation: a symbol that is data comes from a primitive or a cell, and a symbol in an expression is a name", () => {
  const { k, call } = setup();
  assert.throws(() => k.kernelPrimitive("quote"), InterfaceError);
  const give = k.primitiveFunction({ purity: "pure", hash: hash(9), name: "aSymbol", arity: 0, run: (_a, c) => c.symbol("m.data") });
  const x = k.param("x");
  const id = k.composedFunction([x], x);
  const r = k.evaluate(call(id, call(give)), k.scope());
  assert.equal(k.kind(r.value), "symbol");
  assert.equal(k.symbolName(r.value), "m.data");
  assert.deepEqual(k.waiting(), [], "a symbol that is data waits on nothing, however far it is handed on");
});

test("a step budget ends an evaluation the same way every time", () => {
  const { k, dec, isZero, call, kp } = setup();
  const scope = k.scope();
  const n = k.param("n");
  const down = k.symbol("m.down");
  const program = within(k, [[down, k.composedFunction([n], call(kp("if"), call(isZero, n), byte(k, 0), call(down, call(dec, n))))]], call(down, byte(k, 50)));
  const full = k.evaluate(program, scope);
  assert.equal(full.ended, "complete");
  const cut1 = k.evaluate(program, scope, { steps: 40 });
  const cut2 = k.evaluate(program, scope, { steps: 40 });
  assert.deepEqual([cut1.ended, cut1.steps, cut1.refuted], ["limit", 40, false]);
  assert.equal(cut2.steps, cut1.steps);
  assert.equal(k.evaluate(program, scope, { steps: full.steps }).ended, "complete");
});

test("a recursion that never ends is ended by the budget, and is not a fault", () => {
  const { k, call } = setup();
  const scope = k.scope();
  const loop = k.symbol("m.loop");
  const n = k.param("n");
  const program = within(k, [[loop, k.composedFunction([n], call(loop, n))]], call(loop, byte(k, 1)));
  assert.equal(k.evaluate(program, scope, { steps: 500 }).ended, "limit");
  assert.equal(k.evaluate(program, scope).ended, "limit", "with no budget, the depth it can reach is the limit");
});

test("an effect is performed once, when its arguments are known", () => {
  const { k, add, call } = setup();
  const lines: number[] = [];
  const write = k.primitiveFunction({ purity: "effectful", capability: "output", part: "write", arity: 1, run: (a, c) => (lines.push(c.bitsOf(a[0]).bytes[0]), c.structure([])) });
  const c = k.cell();
  k.evaluate(call(write, call(add, c, byte(k, 1))), k.scope());
  assert.deepEqual(lines, []);
  k.fill(c, byte(k, 6));
  k.advance();
  k.fill(k.cell(), byte(k, 0));
  k.advance();
  assert.deepEqual(lines, [7], "performed once, and not again by a later advance");
});

test("a capability's answer that takes time comes back through a cell", () => {
  const { k, add, call } = setup();
  let pending: ReturnType<Kernel["cell"]> | undefined;
  const ask = k.primitiveFunction({ purity: "effectful", capability: "timer", part: "wait", arity: 0, run: (_a, c) => (pending = c.cell()) });
  const r = k.evaluate(call(add, call(ask), byte(k, 1)), k.scope());
  assert.equal(k.waiting().length, 1);
  assert.equal(k.waiting()[0], pending);
  k.fill(pending!, byte(k, 9));
  k.advance();
  assert.equal(num(k, k.current(r.value)), 10);
});

test("a saved program loads as a module function and is instantiated by a call", () => {
  const { k, add, call } = setup();
  const program: SavedProgram = {
    format: "allegro-saved-program",
    version: 1,
    needs: [{ hash: hash(1), name: "add" }],
    nodes: [
      { k: "param", name: "n" },
      { k: "primitive", hash: hash(1) },
      { k: "bits", hex: "02", bits: 8 },
      { k: "expression", fn: 1, args: [0, 2] },
      { k: "function", params: [0], body: 3 },
    ],
    module: 4,
    declares: [{ param: 0, role: "input", name: "n" }],
  };
  const moduleFn = load(k, program, new Map([[hash(1), add]]));
  assert.equal(k.kind(moduleFn), "composed-function");
  assert.equal(num(k, k.evaluate(call(moduleFn, byte(k, 40)), k.scope()).value), 42);
});

test("milestone 2, the kernel's half: the launcher runs a saved program that prints through a capability", async () => {
  const fixture = fileURLToPath(new URL("../launch/fixtures/hello.json", import.meta.url));
  const outcome = await launch({
    createKernel,
    program: JSON.parse(readFileSync(fixture, "utf8")),
    configuration: { ceiling: ["output"], steps: 1000 },
    target: { capabilities: [output] },
  });
  assert.deepEqual(outcome.lines, ["hello, world"]);
  assert.equal(outcome.end.kind, "completed");
});

test("with an empty ceiling the launcher refuses the same program, and the kernel evaluates nothing", async () => {
  const fixture = fileURLToPath(new URL("../launch/fixtures/hello.json", import.meta.url));
  const outcome = await launch({
    createKernel,
    program: JSON.parse(readFileSync(fixture, "utf8")),
    configuration: { ceiling: [] },
    target: { capabilities: [output] },
  });
  assert.equal(outcome.end.kind, "refused");
  assert.deepEqual(outcome.lines, []);
});

// ---- The second version: modules, keys, what a result rests on, restore ----

test("a module's identity is its content: the same in every kernel, whatever its parameters are called", () => {
  const make = (names: [string, string]) => {
    const { k, add, call } = setup();
    const [key, n] = [k.param(names[0]), k.param(names[1])];
    const m = k.module(k.composedFunction([key, n], k.structure([[null, key], [null, call(add, n, byte(k, 1))]])), 1);
    return { k, m, id: k.moduleOf(m) as string };
  };
  const a = make(["key", "n"]);
  const b = make(["k2", "input"]);
  assert.match(a.id, /^sha256:[0-9a-f]{64}$/);
  assert.equal(a.id, b.id);
  const other = setup();
  const [key, n] = [other.k.param("key"), other.k.param("n")];
  const changed = other.k.module(other.k.composedFunction([key, n], other.k.structure([[null, key], [null, other.call(other.add, n, byte(other.k, 2))]])), 1);
  assert.notEqual(other.k.moduleOf(changed), a.id, "other content, other identity, other keys");
  assert.equal(a.k.composedFunctionOf(a.m).params.length, 1, "the key slot is no longer a parameter");
});

test("a module's keys are made from its identity, one for each slot", () => {
  const { k, call } = setup();
  const [k0, k1] = [k.param("k0"), k.param("k1")];
  const m = k.module(k.composedFunction([k0, k1], k.structure([[null, k0], [null, k1]])), 2);
  const made = k.entriesOf(k.evaluate(call(m), k.scope()).value).map(([, v]) => v);
  assert.deepEqual(made.map((v) => k.kind(v)), ["structure", "structure"], "a key is a structure the kernel marks, not a kind of its own");
  assert.deepEqual(made.map((v) => k.isKey(v)), [true, true]);
  const lookalike = k.structure(k.entriesOf(made[0]).map(([key, v]) => [key, v] as const));
  assert.equal(k.isKey(lookalike), false, "the same entries, and no mark");
  assert.throws(() => k.keyOf(lookalike), /not a key/);
  assert.equal(new TextDecoder().decode(k.bitsOf(k.entriesOf(made[0])[0][1]).bytes), k.moduleOf(m), "its entries say which module");
  assert.deepEqual(made.map((v) => k.keyOf(v).slot), [0, 1]);
  assert.equal(k.keyOf(made[0]).module, k.moduleOf(m));
  assert.notEqual(made[0], made[1]);
  const again = k.entriesOf(k.evaluate(call(k.module(k.composedFunction([k0, k1], k.structure([[null, k0], [null, k1]])), 2)), k.scope()).value);
  assert.equal(again[0][1], made[0], "the same module gives the same key, not a new one");
  assert.throws(() => k.keyOf(byte(k, 1)), InterfaceError);
  assert.equal(k.moduleOf(k.composedFunction([], byte(k, 1))), undefined);
});

test("a module must be closed: no cell, no stray parameter, no effectful primitive", () => {
  const { k, call } = setup();
  const p = k.param("p");
  const write = k.primitiveFunction({ purity: "effectful", capability: "output", part: "write", arity: 1, run: (_a, c) => c.structure([]) });
  assert.throws(() => k.module(k.composedFunction([p], k.cell()), 0), /not closed/);
  assert.throws(() => k.module(k.composedFunction([], p), 0), /belongs to no function/);
  assert.throws(() => k.module(k.composedFunction([p], call(write, p)), 0), /capability reaches a module as an argument/);
  assert.throws(() => k.module(k.composedFunction([p], p), 2), /does not fit/);
  assert.throws(() => k.module(byte(k, 1), 0), /not a composed function/);
});

test("a decided claim says what it rests on, and the word stays \"decided\"", () => {
  const { k, add, isZero, call, kp } = setup();
  const scope = k.scope();
  const r = k.evaluate(call(kp("claim"), call(isZero, call(add, byte(k, 0), byte(k, 0)))), scope);
  assert.equal(k.outcomeOf(r.value), "decided");
  assert.deepEqual(k.restsOn(r.value).map((x) => (x.kind === "primitive" ? x.name : x.kind)), ["kernel", "add", "isZero"], "in the order they ran");
  const plain = k.evaluate(call(kp("claim"), truth(k, true)), scope);
  assert.deepEqual(k.restsOn(plain.value), [{ kind: "kernel", variant: k.variant }]);
  assert.deepEqual(k.restsOn(byte(k, 1)), []);
});

test("a claim on a capability's answer is decided about that answer, and names the capability", () => {
  const { k, isZero, call, kp } = setup();
  let pending: Value | undefined;
  const ask = k.primitiveFunction({ purity: "effectful", capability: "http", part: "get", arity: 0, run: (_a, c) => (pending = c.cell()) });
  const r = k.evaluate(call(kp("claim"), call(isZero, call(ask))), k.scope());
  assert.equal(k.outcomeOf(r.value), "undecided");
  k.fill(pending as ReturnType<Kernel["cell"]>, byte(k, 0));
  k.advance();
  const now = k.current(r.value);
  assert.equal(k.outcomeOf(now), "decided");
  assert.ok(k.restsOn(now).some((x) => x.kind === "capability" && x.capability === "http" && x.part === "get"));
});

test("what a binding's value rested on is kept with it", () => {
  const { k, isZero, call, kp } = setup();
  const scope = k.scope();
  const z = k.symbol("m.z");
  // The binding is needed twice and evaluated once; the claim on its second use still rests on what it used.
  const r = k.evaluate(within(k, [[z, call(isZero, byte(k, 0))]], call(kp("then"), z, call(kp("claim"), z))), scope);
  assert.ok(k.restsOn(r.value).some((x) => x.kind === "primitive" && x.name === "isZero"), "though the binding was not evaluated again");
});

test("restore records an outcome under a builder's name, only where the kernel's own key matches", () => {
  const build = () => {
    const s = setup();
    const n = s.k.param("n");
    // The claim has nothing unknown under it: it is false, whatever the function is called with.
    const claim = s.call(s.kp("claim"), s.call(s.isZero, byte(s.k, 5)));
    const fn = s.k.composedFunction([n], claim);
    return { ...s, n, claim, fn };
  };
  const { k, isZero, call, kp, n, claim, fn } = build();
  const grounds: Rest[] = [{ kind: "primitive", hash: hash(4), name: "isZero" }];
  const key = k.claimKey(claim, fn, grounds);
  assert.match(key, /^sha256:[0-9a-f]{64}$/);
  const elsewhere = build();
  assert.equal(elsewhere.k.claimKey(elsewhere.claim, elsewhere.fn, grounds), key, "the same key in every kernel");

  assert.equal(k.evaluate(call(fn, byte(k, 5)), k.scope()).refuted, true, "not restored: 5 is not zero");
  k.restore(claim, fn, "team-build", grounds, key);
  const r = k.evaluate(call(fn, byte(k, 5)), k.scope());
  assert.equal(k.outcomeOf(r.value), "decided");
  assert.deepEqual(k.restsOn(r.value), [{ kind: "builder", builder: "team-build" }, ...grounds]);
  const outer = k.evaluate(call(kp("claim"), call(fn, byte(k, 5))), k.scope());
  assert.ok(k.restsOn(outer.value).some((x) => x.kind === "builder"), "what rests on a restored outcome names the builder too");

  // The key ties the outcome to this claim, in this function, on these grounds.
  const other = call(kp("claim"), call(isZero, n));
  const fn2 = k.composedFunction([n], k.structure([[null, other]]));
  assert.notEqual(k.claimKey(other, fn2, grounds), key, "the same claim in another function");
  assert.notEqual(k.claimKey(claim, fn, []), key, "the same claim on other grounds");
  assert.throws(() => k.restore(other, fn2, "team-build", grounds, key), /does not match/);
  assert.throws(() => k.restore(claim, fn, "team-build", [], key), /does not match/);
  assert.throws(() => k.restore(claim, fn, "", grounds, key), /under a builder's name/);
  assert.throws(() => k.restore(claim, fn, "b", [{ kind: "capability", capability: "http", part: "get" }], key), /never stored/);
  assert.throws(() => k.claimKey(call(isZero, byte(k, 0)), fn, []), /claim primitive/);
  assert.throws(() => k.claimKey(other, fn, []), /not inside that function/);

  // Only a claim with nothing unknown under it is restored. A claim over a parameter has one
  // outcome for each call, and a stored one would hold for every value.
  const keyOther = k.claimKey(other, fn2, grounds);
  assert.throws(() => k.restore(other, fn2, "team-build", grounds, keyOther), /depends on the parameter n/);
  // A claim over an input is refused the same way; one over an import is not, since the
  // module's identity fixes what the import is.
  const [inp, lib] = [k.param("input"), k.param("lib")];
  const overInput = call(kp("claim"), call(isZero, inp));
  const overImport = call(kp("claim"), call(isZero, call(kp("get"), lib, byte(k, 0))));
  const m = k.composedFunction([inp, lib], k.structure([[null, overInput], [null, overImport]]));
  const declares = [{ role: "input", name: "n" }, { role: "module", name: "lib", identity: hash(77) }] as const;
  assert.throws(() => k.restore(overInput, m, "team-build", grounds, k.claimKey(overInput, m, grounds, declares), declares), /depends on the parameter input/);
  assert.doesNotThrow(() => k.restore(overImport, m, "team-build", grounds, k.claimKey(overImport, m, grounds, declares), declares));
  // The key covers what the module declares: the same claim in the same code, declared otherwise, has another key.
  const otherwise = [{ role: "input", name: "n" }, { role: "module", name: "lib", identity: hash(78) }] as const;
  assert.notEqual(k.claimKey(overImport, m, grounds, otherwise), k.claimKey(overImport, m, grounds, declares));
});

test("isCell tells a cell from other values, and only a cell waits", () => {
  // Until the ruling of 2026-11-17 a name nothing had bound also waited.
  const { k, add, call } = setup();
  const c = k.cell();
  assert.equal(k.isCell(c), true);
  assert.equal(k.isCell(byte(k, 1)), false);
  k.evaluate(call(add, c, byte(k, 1)), k.scope());
  assert.deepEqual(k.waiting().map((w) => k.isCell(w)), [true]);
});

test("a module's identity covers what it declares, and through its imports what it depends on", () => {
  const { k } = setup();
  const make = (declares: Parameters<typeof k.module>[2]) => {
    const [key, dep] = [k.param("key"), k.param("dep")];
    return k.module(k.composedFunction([key, dep], k.structure([[null, key]])), 1, declares);
  };
  const asImport = make([{ role: "module", name: "solver", identity: hash(60) }]);
  const again = make([{ role: "module", name: "solver", identity: hash(60) }]);
  const otherModule = make([{ role: "module", name: "solver", identity: hash(61) }]);
  const asCapability = make([{ role: "capability", name: "sink" }]);
  assert.equal(k.moduleOf(asImport), k.moduleOf(again), "the same code declared the same way is the same module");
  assert.notEqual(k.moduleOf(asImport), k.moduleOf(otherModule), "the same code importing another module is another module");
  assert.notEqual(k.moduleOf(asImport), k.moduleOf(asCapability), "the same code with its parameter declared otherwise is another module");
  // Its keys follow its identity.
  const keyOfInstance = (m: Value, arg: Value) => k.keyOf(k.entriesOf(k.evaluate(k.expression(m, [arg]), k.scope()).value)[0][1]);
  const sink = k.primitiveFunction({ purity: "effectful", capability: "sink", part: "write", arity: 1, run: (a) => a[0] });
  const other = k.primitiveFunction({ purity: "effectful", capability: "sink", part: "other", arity: 1, run: (a) => a[0] });
  // Two instances that differ only in the capability they were handed have the same key.
  assert.deepEqual(keyOfInstance(asCapability, sink), keyOfInstance(asCapability, other));
  assert.equal(keyOfInstance(asCapability, sink).module, k.moduleOf(asCapability));
  assert.throws(() => make([{ role: "capability", name: "sink", identity: hash(60) }]), /only a module is declared with an identity/);
  assert.throws(() => make([]), /not one declaration for each parameter/);
});

test("instantiating a module checks its imports: only an instance of the module declared is accepted", () => {
  const { k, add, call, kp } = setup();
  const f = k.symbol("lib.f");
  const library = (n: number) => k.module(k.composedFunction([], k.structure([[f, byte(k, n)]])), 0, []);
  const [lib, lookalike] = [library(1), library(2)];
  const idLib = k.moduleOf(lib) as string;
  const p = k.param("lib");
  const user = k.module(k.composedFunction([p], k.structure([[null, call(add, call(kp("get"), p, k.symbolData("lib.f")), byte(k, 10))]])), 0, [{ role: "module", name: "lib", identity: idLib }]);
  const scope = k.scope();
  const first = (v: Value) => num(k, k.evaluate(k.entriesOf(v)[0][1], scope).value);
  // An instance of the library declared.
  const instance = k.evaluate(call(lib), scope).value;
  assert.deepEqual(k.instanceOf(instance), [idLib]);
  assert.deepEqual(k.instanceOf(byte(k, 1)), []);
  assert.equal(first(k.evaluate(call(user, call(lib)), scope).value), 11);
  // A structure of the same shape that no module yielded, and an instance of another module, are refused.
  const fake = k.evaluate(call(user, k.structure([[f, byte(k, 1)]])), scope);
  assert.match(k.reasonOf(fake.value) ?? "", /the import lib is not an instance of the module it is declared to be/);
  assert.equal(k.evaluate(call(user, call(lookalike)), scope).refuted, true);
  // A module that imports the library is not thereby an instance of it.
  const wrapper = k.module(k.composedFunction([p], k.structure([[f, byte(k, 1)]])), 0, [{ role: "module", name: "lib", identity: idLib }]);
  const wrapped = k.evaluate(call(wrapper, call(lib)), scope).value;
  assert.deepEqual(k.instanceOf(wrapped), [k.moduleOf(wrapper)]);
  assert.equal(k.evaluate(call(user, call(wrapper, call(lib))), scope).refuted, true);
  // An import declared with no identity can never be satisfied.
  const loose = k.module(k.composedFunction([p], k.structure([[null, p]])), 0, [{ role: "module", name: "lib" }]);
  assert.equal(k.evaluate(call(loose, call(lib)), scope).refuted, true);
  // An import that has not arrived leaves the call waiting, and it is taken up when it arrives.
  const c = k.cell();
  const waits = k.evaluate(call(user, c), scope);
  assert.equal(waits.refuted, false);
  assert.equal(k.waiting().length, 1);
});

test("a module names only what its blocks bind and what it is handed", () => {
  const { k, add, call, kp } = setup();
  const say = k.primitiveFunction({ purity: "effectful", capability: "output", part: "write", arity: 1, run: (a) => a[0] });
  const [out, secret, x] = [k.symbol("host.output"), k.symbol("session.password"), k.symbol("m.x")];
  // A function with a free name is not a module, whatever a host might later mean by the name.
  assert.throws(() => k.module(k.composedFunction([], call(out, secret)), 0), /free name\(s\) host\.output, session\.password/);
  // A name a block inside it binds is not free, nor is a parameter.
  const p = k.param("out");
  const ok = k.module(k.composedFunction([p], within(k, [[x, byte(k, 2)]], call(p, call(add, x, x)))), 0);
  assert.equal(num(k, k.evaluate(call(ok, say), k.scope()).value), 4);
  // A free name in a branch that is never taken is refused too: the check reads the text.
  assert.throws(() => k.module(k.composedFunction([], call(kp("if"), truth(k, true), byte(k, 1), secret)), 0), /free name/);
});

test("a function made in a block inside a module keeps the block's names", () => {
  const { k, add, call, kp } = setup();
  const [kk, f] = [k.symbol("m.k"), k.symbol("m.f")];
  const n = k.param("n");
  const m = k.module(k.composedFunction([], within(k, [[kk, byte(k, 7)], [f, k.composedFunction([n], call(add, n, kk))]], k.structure([[null, f]]))), 0);
  const scope = k.scope();
  const made = k.evaluate(call(kp("get"), call(m), byte(k, 0)), scope).value;
  assert.equal(num(k, k.evaluate(call(made, byte(k, 1)), scope).value), 8);
});

test("a built function reads nothing from where it is built: its free names are supplied", () => {
  const { k, add, call, kp } = setup();
  const [v, lib, got] = [k.symbol("m.v"), k.symbol("m.lib"), k.symbol("m.got")];
  const scope = k.scope();
  // The description of () => add(v, 1), with v left free.
  const describing = k.composedFunction([], within(k, [[v, byte(k, 0)]], k.composedFunction([], call(add, v, byte(k, 1)))));
  const inner = k.evaluate(call(describing), scope).value;
  const d = k.evaluate(call(kp("describe"), k.inspectionRight(), inner), scope).value;
  // Built with no value for v: refused, also where a block around the call binds a v of its own.
  const bare = k.evaluate(call(kp("build"), d, k.structure([])), scope);
  assert.match(k.reasonOf(bare.value) ?? "", /leaves m\.v free/);
  const around = k.evaluate(within(k, [[v, byte(k, 78)]], call(kp("build"), d, k.structure([]))), scope);
  assert.match(k.reasonOf(around.value) ?? "", /leaves m\.v free/, "the caller's binding is not read");
  // Built with a value for v: it uses that value, wherever it is called.
  const built = within(k, [[lib, call(kp("build"), d, k.structure([[v, byte(k, 41)]]))]], within(k, [[v, byte(k, 99)], [got, call(lib)]], got));
  assert.equal(num(k, k.evaluate(built, scope).value), 42);
  // A name a block inside the description binds is that block's, whatever is supplied under the same name.
  const own = k.evaluate(call(kp("describe"), k.inspectionRight(), k.composedFunction([], within(k, [[v, byte(k, 5)]], call(add, v, byte(k, 1))))), scope).value;
  assert.equal(num(k, k.evaluate(call(call(kp("build"), own, k.structure([[v, byte(k, 41)]]))), scope).value), 6);
});

// ---- Values and descriptions (chunk K4) -------------------------------------

/** Reads a description: its form, and its parts. */
function form(k: Kernel, d: Value): { form: string; parts: Value[] } {
  const entries = k.entriesOf(d);
  return { form: k.symbolName(entries[0][1]).replace("description.", ""), parts: entries.slice(1).map(([, v]) => v) };
}
const text = (k: Kernel, v: Value) => new TextDecoder().decode(k.bitsOf(v).bytes);
const steps = (k: Kernel, n: number) => k.bits(Uint8Array.of(n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255));

/** A module with one key and one function: (key) => [key, n => n + 1]. */
function moduleWithFunction() {
  const s = setup();
  const { k, add, call } = s;
  const [key, n] = [k.param("key"), k.param("n")];
  const m = k.module(k.composedFunction([key], k.structure([[null, key], [null, k.composedFunction([n], call(add, n, byte(k, 1)))]])), 1);
  const [ownKey, inc] = k.entriesOf(k.evaluate(call(m), k.scope()).value).map(([, v]) => v);
  return { ...s, ownKey, inc };
}

test("a function is opaque: describing one takes a key of its module, or the inspection right", () => {
  const { k, call, kp, ownKey, inc } = moduleWithFunction();
  const scope = k.scope();
  const d = form(k, k.evaluate(call(kp("describe"), ownKey, inc), scope).value);
  assert.equal(d.form, "function");
  const body = form(k, d.parts[1]);
  assert.equal(body.form, "apply");
  assert.equal(form(k, body.parts[0]).form, "primitive");
  assert.equal(text(k, form(k, body.parts[0]).parts[0]), hash(1), "a pure primitive is named by its hash");
  assert.deepEqual(k.entriesOf(body.parts[1]).map(([, a]) => form(k, a).form), ["param", "bits"]);

  const k0 = k.param("k0");
  const otherKey = k.entriesOf(k.evaluate(call(k.module(k.composedFunction([k0], k.structure([[null, k0]])), 1)), scope).value)[0][1];
  const refused = k.evaluate(call(kp("describe"), otherKey, inc), scope);
  assert.match(k.reasonOf(refused.value) ?? "", /a key of the module that made it/);
  assert.match(k.reasonOf(k.evaluate(call(kp("describe"), byte(k, 1), inc), scope).value) ?? "", /a key or the inspection right/);
  const lookalike = k.structure(k.entriesOf(ownKey).map(([key, v]) => [key, v] as const));
  assert.match(k.reasonOf(k.evaluate(call(kp("describe"), lookalike, inc), scope).value) ?? "", /a key or the inspection right/, "a structure with a key's entries is not a key");
  assert.equal(form(k, k.evaluate(call(kp("describe"), k.inspectionRight(), inc), scope).value).form, "function");
  assert.equal(k.isKey(k.inspectionRight()), true);
});

test("a description never yields authority: a capability inside is described by name, and cannot be built", () => {
  const { k, isZero, call, kp } = setup();
  let wrote = 0;
  const write = k.primitiveFunction({ purity: "effectful", capability: "files", part: "write", arity: 1, run: (_a, c) => (wrote++, c.structure([])) });
  const p = k.param("p");
  // A narrowed capability: it writes only where its guard allows.
  const guarded = k.composedFunction([p], call(kp("if"), call(isZero, p), call(write, p), k.structure([])));
  const scope = k.scope();
  const d = k.evaluate(call(kp("describe"), k.inspectionRight(), guarded), scope).value;
  const condition = form(k, form(k, d).parts[1]);
  const use = form(k, k.entriesOf(condition.parts[1])[1][1]);
  const named = form(k, use.parts[0]);
  assert.equal(named.form, "capability");
  assert.deepEqual(named.parts.map((v) => text(k, v)), ["files", "write"], "the description says which capability, and holds none");
  const rebuilt = k.evaluate(call(kp("build"), d, k.structure([])), scope);
  assert.match(k.reasonOf(rebuilt.value) ?? "", /nothing makes authority from data/);
  // The part that applies the capability, cut out of its guard, cannot be built either.
  const cut = k.evaluate(call(kp("build"), k.entriesOf(condition.parts[1])[1][1], k.structure([])), scope);
  assert.equal(cut.refuted, true);
  assert.equal(wrote, 0);
});

test("a description of a function that holds no unforgeable value builds a function that does the same", () => {
  const { k, call, kp, ownKey, inc } = moduleWithFunction();
  const scope = k.scope();
  const d = k.evaluate(call(kp("describe"), ownKey, inc), scope).value;
  const built = k.evaluate(call(kp("build"), d, k.structure([])), scope).value;
  assert.equal(k.kind(built), "composed-function");
  assert.notEqual(built, inc);
  assert.equal(num(k, k.evaluate(call(built, byte(k, 41)), scope).value), 42);
  assert.match(k.reasonOf(k.evaluate(call(kp("build"), byte(k, 1), k.structure([])), scope).value) ?? "", /not a description/);
  assert.match(k.reasonOf(k.evaluate(call(kp("build"), form(k, d).parts[0], k.structure([])), scope).value) ?? "", /not a description/);
});

test("a function of another module is opaque inside a description, unless the inspection right describes it", () => {
  const { k, call, kp, ownKey, inc } = moduleWithFunction();
  const [key, f] = [k.param("key"), k.param("f")];
  // A second module, handed the first one's function: (key, f) => [key, () => f]
  const holder = k.module(k.composedFunction([key, f], k.structure([[null, key], [null, k.composedFunction([], f)]])), 1);
  const [holderKey, wrapper] = k.entriesOf(k.evaluate(call(holder, inc), k.scope()).value).map(([, v]) => v);
  const mine = form(k, k.evaluate(call(kp("describe"), holderKey, wrapper), k.scope()).value);
  assert.equal(form(k, mine.parts[1]).form, "opaque", "its own key does not open another module's function");
  const all = form(k, k.evaluate(call(kp("describe"), k.inspectionRight(), wrapper), k.scope()).value);
  assert.equal(form(k, all.parts[1]).form, "function");
  void ownKey;
});

test("an attempt returns how an evaluation ended, as data, and a refutation inside marks nothing outside", () => {
  const { k, add, isZero, dec, call, kp } = setup();
  const scope = k.scope();
  const tried = (body: Value, n = 1000) => form(k, k.evaluate(call(kp("attempt"), body, steps(k, n)), scope).value);
  const ok = tried(call(add, byte(k, 1), byte(k, 2)));
  assert.equal(ok.form, "value");
  assert.equal(num(k, ok.parts[0]), 3);
  const bad = k.evaluate(call(kp("attempt"), call(kp("claim"), call(isZero, byte(k, 5))), steps(k, 1000)), scope);
  assert.equal(bad.refuted, false, "the attempt itself is not wrong");
  assert.equal(form(k, bad.value).form, "refuted");
  assert.match(text(k, form(k, bad.value).parts[0]), /claim that is not true/);

  const n = k.param("n");
  const down = k.symbol("m.down");
  const downTo = (m: number) => within(k, [[down, k.composedFunction([n], call(kp("if"), call(isZero, n), byte(k, 0), call(down, call(dec, n))))]], call(down, byte(k, m)));
  assert.equal(tried(downTo(200), 30).form, "limit");
  assert.equal(tried(downTo(200), 30).form, "limit", "the same every time");
  assert.equal(tried(downTo(3), 30).form, "value");
  // A search: try candidates until one satisfies a claim.
  const candidate = k.param("candidate");
  const fits = k.composedFunction([candidate], call(kp("attempt"), call(kp("claim"), call(isZero, call(dec, candidate))), steps(k, 100)));
  assert.deepEqual([0, 1, 2].map((c) => form(k, k.evaluate(call(fits, byte(k, c)), scope).value).form), ["refuted", "value", "refuted"]);
});

test("an attempt that waits is taken up again from where it stopped, so an effect inside is performed once", () => {
  const { k, add, call, kp } = setup();
  let wrote = 0;
  const write = k.primitiveFunction({ purity: "effectful", capability: "output", part: "write", arity: 0, run: (_a, c) => (wrote++, c.bits(Uint8Array.of(1))) });
  const c = k.cell();
  const r = k.evaluate(call(kp("attempt"), call(add, call(write), c), steps(k, 100)), k.scope());
  assert.equal(k.kind(r.value), "expression", "it waits on the cell");
  assert.equal(wrote, 1);
  k.fill(c, byte(k, 4));
  k.advance();
  const done = form(k, k.current(r.value));
  assert.equal(done.form, "value");
  assert.equal(num(k, done.parts[0]), 5);
  assert.equal(wrote, 1, "the effect was not performed again");
});
