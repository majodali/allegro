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
import type { Kernel, Kernel2, PrimitiveDeclaration, Rest, Value } from "./interface.js";
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
  // The record of claims was added on 2026-11-18 (cluster 13 of the second review): with nothing to do, there are none.
  assert.deepEqual(k.advance(), { ended: "complete", steps: 0, refuted: [], claims: [] });
  assert.deepEqual([...k.kernelPrimitiveNames()].sort(), ["also", "assume", "attempt", "block", "build", "claim", "count", "describe", "get", "if", "join", "key", "kind", "length", "put", "refuse", "same", "slice", "spelling", "symbol", "then", "undecided"]);
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

// Until the ruling of 2026-11-19 on cluster 8 of the second review this test was "once an
// entry or an argument waits, what follows it performs no effect until it is done", and
// asserted that the second effect waited for the first. The maintainer ruled that effects are
// not ordered unless need or `then` orders them, so that independent effects run at once:
// the second effect is now performed while the first waits. The values are as before.
test("entries and arguments are started in order and none waits for one before it", () => {
  const { k, add, call, kp } = setup();
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
  assert.deepEqual(said, [2], "the second entry's effect does not wait for the first's");
  k.fill(c, byte(k, 1));
  k.advance({ steps: 100 });
  assert.deepEqual(said, [2, 1], "each is performed once");
  assert.equal(num(k, k.current(waits.value)), 2);
  // The arguments of a primitive function, the same way.
  said.length = 0;
  const d = k.cell();
  const sum = k.evaluate(call(add, call(say, d), call(say, byte(k, 4))), scope);
  assert.deepEqual(said, [4]);
  k.fill(d, byte(k, 3));
  k.advance({ steps: 100 });
  assert.deepEqual(said, [4, 3]);
  assert.equal(num(k, k.current(sum.value)), 7);
  // With nothing late, the order is the order written, every time.
  said.length = 0;
  k.evaluate(call(add, call(say, byte(k, 5)), call(say, byte(k, 6))), scope);
  assert.deepEqual(said, [5, 6]);
  // `then` is what makes the second wait.
  said.length = 0;
  const e = k.cell();
  k.evaluate(call(kp("then"), call(say, e), call(say, byte(k, 8))), scope);
  assert.deepEqual(said, []);
  k.fill(e, byte(k, 7));
  k.advance({ steps: 100 });
  assert.deepEqual(said, [7, 8]);
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

test("an import is supplied by the kernel, by identity, and instantiated by the module that imports it", () => {
  const { k, add, call, kp } = setup();
  const f = k.symbol("lib.f");
  const library = (n: number) => k.module(k.composedFunction([], k.structure([[f, byte(k, n)]])), 0, []);
  const lib = library(1);
  const idLib = k.moduleOf(lib) as string;
  const p = k.param("lib");
  // user(lib) => get(lib(), `f) + 10: the import is the library's module function, called in the body.
  const body = call(add, call(kp("get"), call(p), k.symbolData("lib.f")), byte(k, 10));
  const user = k.module(k.composedFunction([p], body), 0, [{ role: "module", name: "lib", identity: idLib }]);
  const scope = k.scope();
  // Nobody passes the import: the module is called with its capabilities and inputs only, here none.
  assert.equal(num(k, k.evaluate(call(user), scope).value), 11);
  // Passing one is one argument too many, whatever it is.
  assert.match(k.reasonOf(k.evaluate(call(user, library(2)), scope).value) ?? "", /was given 1 argument/);
  // A module that imports one not made in this kernel is refuted when it is called.
  const missing = k.module(k.composedFunction([p], call(p)), 0, [{ role: "module", name: "lib", identity: hash(99) }]);
  assert.match(k.reasonOf(k.evaluate(call(missing), scope).value) ?? "", /the module lib, which it imports, is not loaded/);
  // An import declared with no identity can never be supplied.
  const loose = k.module(k.composedFunction([p], call(p)), 0, [{ role: "module", name: "lib" }]);
  assert.equal(k.evaluate(call(loose), scope).refuted, true);
});

test("a module's statements happen when it is instantiated: when first needed, and once for the same arguments", () => {
  const { k, call, kp } = setup();
  const said: number[] = [];
  const say = k.primitiveFunction({ purity: "effectful", capability: "output", part: "write", arity: 1, run: (a, c) => (said.push(c.bitsOf(a[0]).bytes[0]), a[0]) });
  const quiet = k.primitiveFunction({ purity: "effectful", capability: "output", part: "write", arity: 1, run: (a, c) => (said.push(100 + c.bitsOf(a[0]).bytes[0]), a[0]) });
  const f = k.symbol("lib.f");
  // library(out) => then(out(7), {f: 1}): it says 7 when it is instantiated.
  const out = k.param("out");
  const library = k.module(k.composedFunction([out], call(kp("then"), call(out, byte(k, 7)), k.structure([[f, byte(k, 1)]]))), 0, [{ role: "capability", name: "output" }]);
  const idLib = k.moduleOf(library) as string;
  const [lib, o, other] = [k.param("lib"), k.param("out"), k.param("other")];
  const [first, second, third] = ["t.first", "t.second", "t.third"].map((n) => k.symbol(n));
  const read = (name: Value) => call(kp("get"), name, k.symbolData("lib.f"));
  // user(lib, out, other): three imports of the library, two with the same capability, and a statement of its own first.
  const user = k.module(k.composedFunction([lib, o, other], call(kp("block"),
    k.structure([[first, call(lib, o)], [second, call(lib, o)], [third, call(lib, other)]]),
    call(kp("then"), call(o, byte(k, 1)), call(kp("then"), read(first), call(kp("then"), read(second), call(kp("then"), call(o, byte(k, 2)), read(third))))))),
    0, [{ role: "module", name: "lib", identity: idLib }, { role: "capability", name: "output" }, { role: "capability", name: "other" }]);
  const r = k.evaluate(call(user, say, quiet), k.scope());
  assert.equal(num(k, r.value), 1);
  assert.deepEqual(said, [1, 7, 2, 107], "the library's statement happens when the import is first needed, once for the same capability, and again for another");
  // An import nothing needs is never instantiated.
  said.length = 0;
  const idle = k.module(k.composedFunction([lib, o], call(kp("block"), k.structure([[first, call(lib, o)]]), call(o, byte(k, 3)))), 0,
    [{ role: "module", name: "lib", identity: idLib }, { role: "capability", name: "output" }]);
  k.evaluate(call(idle, say), k.scope());
  assert.deepEqual(said, [3]);
});

test("an assumption is recorded as assumed, with the module that made it, and is never evaluated", () => {
  const { k, isZero, call, kp } = setup();
  const said: number[] = [];
  const say = k.primitiveFunction({ purity: "effectful", capability: "output", part: "write", arity: 1, run: (a, c) => (said.push(c.bitsOf(a[0]).bytes[0]), a[0]) });
  const scope = k.scope();
  // module(out) => then(assume(isZero(out(5))), out(1)): the assumed claim would write 5 and is false.
  const out = k.param("out");
  const written = call(kp("assume"), call(isZero, call(out, byte(k, 5))));
  const m = k.module(k.composedFunction([out], k.structure([[null, written], [null, call(out, byte(k, 1))]])), 0, [{ role: "capability", name: "output" }]);
  const [assumed, after] = k.entriesOf(k.evaluate(call(m, say), scope).value).map(([, v]) => k.evaluate(v, scope).value);
  assert.equal(k.outcomeOf(assumed), "assumed");
  // Since the ruling of 2026-11-19 the record also names the assumption itself, as written.
  assert.deepEqual(k.restsOn(assumed), [{ kind: "assumption", by: k.moduleOf(m), at: written }], "the record names the module, from the mark on its code, and the assumption as written");
  assert.deepEqual(said, [1], "what was assumed was not evaluated; what follows goes ahead");
  assert.equal(num(k, after), 1);
  // A claim that rests on an assumption is no stronger than assumed.
  const resting = k.evaluate(call(kp("claim"), call(kp("assume"), call(isZero, byte(k, 0)))), scope);
  assert.equal(k.outcomeOf(resting.value), "assumed");
  assert.ok(k.restsOn(resting.value).some((r) => r.kind === "assumption"));
  // Code that belongs to no module assumes under no name.
  const bare = call(kp("assume"), byte(k, 0));
  assert.deepEqual(k.restsOn(k.evaluate(bare, scope).value), [{ kind: "assumption", by: "", at: bare }]);
  // Nothing an assumption does makes a claim decided, and a claim that is simply true is still decided.
  assert.equal(k.outcomeOf(k.evaluate(call(kp("claim"), call(isZero, byte(k, 0))), scope).value), "decided");
});

test("what decides a claim may answer that it cannot tell: the claim is done, undecided, and holds nothing back", () => {
  const { k, isZero, call, kp } = setup();
  const said: number[] = [];
  const say = k.primitiveFunction({ purity: "effectful", capability: "output", part: "write", arity: 1, run: (a, c) => (said.push(c.bitsOf(a[0]).bytes[0]), a[0]) });
  const reason = (t: string) => k.bits(new TextEncoder().encode(t));
  const scope = k.scope();
  const r = k.evaluate(call(kp("claim"), call(kp("undecided"), reason("no rule applies"))), scope);
  assert.equal(r.refuted, false);
  assert.equal(k.outcomeOf(r.value), "undecided");
  assert.equal(k.reasonOf(r.value), "no rule applies");
  assert.notEqual(k.kind(r.value), "expression", "it is done: nothing waits");
  assert.deepEqual(k.waiting(), []);
  // What follows such a claim goes ahead.
  k.evaluate(call(kp("then"), call(kp("claim"), call(kp("undecided"), reason("no rule applies"))), call(say, byte(k, 1))), scope);
  assert.deepEqual(said, [1]);
  // A claim that waits on a value is another thing: what follows it waits too.
  said.length = 0;
  const c = k.cell();
  const waits = k.evaluate(call(kp("then"), call(kp("claim"), call(isZero, c)), call(say, byte(k, 2))), scope);
  assert.equal(k.kind(waits.value), "expression");
  assert.deepEqual(said, []);
  k.fill(c, byte(k, 0));
  k.advance({ steps: 100 });
  assert.deepEqual(said, [2]);
  // An undecided answer is neither true nor false: a conditional on it is refuted.
  assert.equal(k.evaluate(call(kp("if"), call(kp("claim"), call(kp("undecided"), reason("x"))), byte(k, 1), byte(k, 2)), scope).refuted, true);
  // It cannot be used to refute, or to decide.
  assert.equal(k.evaluate(call(kp("undecided"), k.structure([])), scope).refuted, true, "the reason is a text");
});

test("a refusal is a refutation with a reason, and a withheld capability is one that happens when it is used", () => {
  const { k, call, kp } = setup();
  const reason = (t: string) => k.bits(new TextEncoder().encode(t));
  const scope = k.scope();
  const r = k.evaluate(call(kp("refuse"), reason("the capability files was withheld")), scope);
  assert.equal(r.refuted, true);
  assert.equal(k.reasonOf(r.value), "the capability files was withheld");
  // Handed to a module in place of a capability, it refutes nothing until the module uses it.
  const [files, flag] = [k.param("files"), k.param("flag")];
  const m = k.module(k.composedFunction([files, flag], call(kp("if"), flag, call(files, byte(k, 1)), byte(k, 0))), 0,
    [{ role: "capability", name: "files" }, { role: "input", name: "flag" }]);
  const withheld = call(kp("refuse"), reason("the capability files was withheld"));
  assert.equal(num(k, k.evaluate(call(m, withheld, truth(k, false)), scope).value), 0);
  const used = k.evaluate(call(m, withheld, truth(k, true)), scope);
  assert.equal(k.reasonOf(used.value), "the capability files was withheld");
  assert.equal(k.evaluate(call(kp("refuse"), k.structure([])), scope).refuted, true);
});

test("a private member is an entry keyed by a key: only that key reads it", () => {
  const { k, call, kp } = setup();
  const said: number[] = [];
  const say = k.primitiveFunction({ purity: "effectful", capability: "output", part: "write", arity: 1, run: (a, c) => (said.push(c.bitsOf(a[0]).bytes[0]), a[0]) });
  const size = k.primitiveFunction({ purity: "pure", hash: hash(52), name: "size", arity: 1, run: (a, c) => c.bits(Uint8Array.of(c.entriesOf(a[0]).length)) });
  const a = k.symbol("t.a");
  // module(key, out) => [ {a: 1, <key>: out(42), 3},  o => get(o, key) ]
  const make = (extra: number) => {
    const [key, o, outP] = [k.param("key"), k.param("o"), k.param("out")];
    const obj = k.structure([[a, byte(k, 1)], [key, call(outP, byte(k, 42))], [null, byte(k, extra)]]);
    return k.module(k.composedFunction([key, outP], k.structure([[null, obj], [null, k.composedFunction([o], call(kp("get"), o, key))]])), 1, [{ role: "capability", name: "output" }]);
  };
  const scope = k.scope();
  const part = (m: Value, i: number) => k.evaluate(call(kp("get"), call(m, say), byte(k, i)), scope).value;
  const [m, other] = [make(3), make(4)];
  const [obj, read] = [part(m, 0), part(m, 1)];
  const big = (v: Value) => k.bitsOf(v).bytes.reduce((n, b) => n * 256 + b, 0);
  // Without the key: the entry has no place, is not counted, and nothing tells that it is there.
  assert.equal(big(k.evaluate(call(kp("count"), obj), scope).value), 2);
  assert.equal(num(k, k.evaluate(call(kp("get"), obj, byte(k, 0)), scope).value), 1);
  assert.equal(num(k, k.evaluate(call(kp("get"), obj, byte(k, 1)), scope).value), 3, "the place after the private entry");
  assert.equal(k.evaluate(call(kp("get"), obj, byte(k, 2)), scope).refuted, true);
  // A primitive function is handed the structure without it, and it is not evaluated for that.
  assert.equal(num(k, k.evaluate(call(size, obj), scope).value), 2);
  assert.deepEqual(said, [], "nothing needed the private entry");
  // With the key, through the module's own function.
  assert.equal(num(k, k.evaluate(call(read, obj), scope).value), 42);
  assert.deepEqual(said, [42]);
  // Another module's key reads nothing, and the refusal does not say whether an entry is there.
  const wrong = k.evaluate(call(part(other, 1), obj), scope);
  assert.match(k.reasonOf(wrong.value) ?? "", /no entry under that key/);
  // The host, which is trusted, sees every entry.
  assert.equal(k.entriesOf(obj).length, 3);
  assert.equal(k.isKey(k.entriesOf(obj)[1][0] as Value), true);
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
  // The description of () => add(v, 1), with v left free: the function is written with no
  // block around it. (Until the ruling of 2026-11-18 on cluster 10 of the second review this
  // test took its description from a function made in a block that bound v, and the
  // description left v free. A description now carries the bindings its function reads, so
  // that one is no longer a description with a free name; the test below holds it.)
  const d = k.evaluate(call(kp("describe"), k.inspectionRight(), k.composedFunction([], call(add, v, byte(k, 1)))), scope).value;
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

test("a description is a program that means the same: it carries the bindings its function reads", () => {
  const { k, add, call, kp } = setup();
  const [v, f, n] = [k.symbol("m.v"), k.symbol("m.f"), k.param("n")];
  const scope = k.scope();
  const none = k.structure([]);
  const describe = (x: Value) => k.evaluate(call(kp("describe"), k.inspectionRight(), x), scope).value;
  // A function made in a block that binds v to plain data: the value is written where it is used.
  const closure = k.evaluate(within(k, [[v, byte(k, 7)]], k.composedFunction([n], call(add, n, v))), scope).value;
  const plain = describe(closure);
  assert.equal(form(k, plain).form, "function", "a binding that is plain data needs no block");
  assert.equal(num(k, k.evaluate(call(call(kp("build"), plain, none), byte(k, 1)), scope).value), 8, "built again with no names, it still adds 7");
  // A function that calls another binding of its block: the description is a block around it.
  const twoStep = k.evaluate(
    within(k, [[v, k.composedFunction([n], call(add, n, byte(k, 10)))], [f, k.composedFunction([n], call(v, call(v, n)))]], f),
    scope,
  ).value;
  const around = form(k, describe(twoStep));
  assert.equal(around.form, "apply", "a block around the function");
  assert.equal(text(k, form(k, around.parts[0]).parts[0]), "block");
  assert.equal(num(k, k.evaluate(call(call(kp("build"), describe(twoStep), none), byte(k, 1)), scope).value), 21);
});

test("a description carries a function's own binding: a recursive function is built again and runs", () => {
  const { k, mul, dec, isZero, call, kp } = setup();
  const [fact, n] = [k.symbol("m.fact"), k.param("n")];
  const scope = k.scope();
  const factFn = k.composedFunction([n], call(kp("if"), call(isZero, n), byte(k, 1), call(mul, n, call(fact, call(dec, n)))));
  const made = k.evaluate(within(k, [[fact, factFn]], fact), scope).value;
  const d = k.evaluate(call(kp("describe"), k.inspectionRight(), made), scope).value;
  assert.equal(form(k, d).form, "apply", "a block that binds the function's own name");
  // Built where a block binds the same name to something else: the description's own binding is the one read.
  const again = within(k, [[fact, byte(k, 0)]], call(call(kp("build"), d, k.structure([])), byte(k, 5)));
  assert.equal(num(k, k.evaluate(again, scope).value), 120);
});

test("a description says once with a binding: an argument used twice is performed once when built again", () => {
  const { k, add, call, kp } = setup();
  const said: number[] = [];
  const say = k.primitiveFunction({ purity: "effectful", capability: "output", part: "write", arity: 1, run: (a, c) => (said.push(c.bitsOf(a[0]).bytes[0]), a[0]) });
  const [s, a] = [k.symbol("m.say"), k.param("a")];
  const scope = k.scope();
  // (a => (() => a + a))(say(3)), with say a free name: the function made holds the argument, not yet evaluated, twice.
  const made = k.evaluate(call(k.composedFunction([a], k.composedFunction([], call(add, a, a))), call(s, byte(k, 3))), scope).value;
  assert.deepEqual(said, [], "nothing needed the argument");
  const d = k.evaluate(call(kp("describe"), k.inspectionRight(), made), scope).value;
  const block = form(k, d);
  assert.equal(block.form, "apply", "a block around the function");
  assert.equal(k.entriesOf(form(k, k.entriesOf(block.parts[1])[0][1]).parts[0]).length, 1, "one binding: the shared argument");
  // Built again with the capability supplied for the name, and called: one effect, as in the program described.
  const r = k.evaluate(call(call(kp("build"), d, k.structure([[s, say]]))), scope);
  assert.equal(num(k, r.value), 6);
  assert.deepEqual(said, [3], "performed once");
  // An argument used once needs no binding.
  const once = k.evaluate(call(k.composedFunction([a], k.composedFunction([], call(add, a, byte(k, 1)))), call(s, byte(k, 3))), scope).value;
  assert.equal(form(k, k.evaluate(call(kp("describe"), k.inspectionRight(), once), scope).value).form, "function");
});

test("a name the kernel picks for a binding is not one the description already writes", () => {
  const { k, add, call, kp } = setup();
  const [v, a] = [k.symbol("m.v"), k.param("a")];
  const scope = k.scope();
  const outer = k.composedFunction([a], call(add, a, byte(k, 1)));
  // In a block that binds v to a function, a function whose body has a block of its own binding v.
  const made = k.evaluate(
    within(k, [[v, outer]], k.composedFunction([a], call(add, call(v, a), within(k, [[v, byte(k, 100)]], v)))),
    scope,
  ).value;
  const d = k.evaluate(call(kp("describe"), k.inspectionRight(), made), scope).value;
  const names = k.entriesOf(form(k, k.entriesOf(form(k, d).parts[1])[0][1]).parts[0]).map(([key]) => k.symbolName(key as Value));
  assert.deepEqual(names, ["m.v_2"], "the outer v is renamed: the inner block writes v");
  assert.equal(num(k, k.evaluate(call(call(kp("build"), d, k.structure([])), byte(k, 1)), scope).value), 102);
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

test("an argument is its writer's: a callee that wraps it and describes the wrapper does not see it", () => {
  const { k, add, call, kp } = setup();
  const scope = k.scope();
  const entry = (v: Value, i: number) => k.evaluate(k.entriesOf(v)[i][1], scope).value;
  // The library: (key) => [ a => (() => a),  f => describe(key, f) ]
  const [libKey, a, f] = [k.param("key"), k.param("a"), k.param("f")];
  const library = k.module(k.composedFunction([libKey], k.structure([
    [null, k.composedFunction([a], k.composedFunction([], a))],
    [null, k.composedFunction([f], call(kp("describe"), libKey, f))],
  ])), 1, []);
  const lib = k.evaluate(call(library), scope).value;
  const [wrap, look] = [entry(lib, 0), entry(lib, 1)];
  // The caller: (wrap, x) => wrap(add(add(x, 7), 1)). The 7 is in the caller's text.
  const [w, x] = [k.param("wrap"), k.param("x")];
  const caller = k.module(k.composedFunction([w, x], call(w, call(add, call(add, x, byte(k, 7)), byte(k, 1)))), 0, [{ role: "input", name: "wrap" }, { role: "input", name: "x" }]);
  const c = k.cell(); // x is not known, so the argument stays an expression
  const wrapped = k.evaluate(call(caller, wrap, c), scope).value;
  const seenByLibrary = form(k, k.evaluate(call(look, wrapped), scope).value);
  assert.equal(seenByLibrary.form, "function", "the wrapper is the library's own, and it may describe it");
  const body = form(k, seenByLibrary.parts[1]);
  assert.equal(body.form, "opaque", "what the caller wrote inside it is not shown");
  assert.deepEqual(k.entriesOf(body.parts[0]), [], "and it mentions none of the wrapper's parameters");
  // The inspection right sees the caller's expression, constants and all.
  const all = form(k, form(k, k.evaluate(call(kp("describe"), k.inspectionRight(), wrapped), scope).value).parts[1]);
  assert.equal(all.form, "apply");
  // Once the argument has a value, the value is shown: a value is not an expression.
  const known = k.evaluate(call(caller, wrap, byte(k, 2)), scope).value;
  k.evaluate(call(known), scope); // something needs it
  assert.equal(form(k, form(k, k.evaluate(call(look, known), scope).value).parts[1]).form, "bits");
});

test("what an evaluation leaves in place of a part keeps the part's mark", () => {
  const { k, add, call, kp } = setup();
  const scope = k.scope();
  const entry = (v: Value, i: number) => k.evaluate(k.entriesOf(v)[i][1], scope).value;
  // One module: (key, c) => [ (a => (() => a))(add(c, 1)),  f => describe(key, f) ]
  const [key, c, a, f] = [k.param("key"), k.param("c"), k.param("a"), k.param("f")];
  const m = k.module(k.composedFunction([key, c], k.structure([
    [null, call(k.composedFunction([a], k.composedFunction([], a)), call(add, c, byte(k, 1)))],
    [null, k.composedFunction([f], call(kp("describe"), key, f))],
  ])), 1, [{ role: "input", name: "c" }]);
  const cell = k.cell();
  const made = k.evaluate(call(m, cell), scope).value;
  const [closure, look] = [entry(made, 0), entry(made, 1)];
  // Something needs the argument while c is unknown: what is left is a new expression.
  k.evaluate(call(closure), scope);
  const body = form(k, form(k, k.evaluate(call(look, closure), scope).value).parts[1]);
  assert.equal(body.form, "apply", "the module still sees its own part");
});

test("a built function is its builder's: the module whose code built it may describe it", () => {
  const { k, add, call, kp } = setup();
  const scope = k.scope();
  const entry = (v: Value, i: number) => k.evaluate(k.entriesOf(v)[i][1], scope).value;
  // A description of () => add(1, 2), taken with the inspection right from a function no module made.
  const d = k.evaluate(call(kp("describe"), k.inspectionRight(), k.composedFunction([], call(add, byte(k, 1), byte(k, 2)))), scope).value;
  // Two modules, each: (key, d) => [ build(d, {}),  f => describe(key, f),  tag ]
  const make = (tag: number) => {
    const [key, dd, f] = [k.param("key"), k.param("d"), k.param("f")];
    return k.module(k.composedFunction([key, dd], k.structure([
      [null, call(kp("build"), dd, k.structure([]))],
      [null, k.composedFunction([f], call(kp("describe"), key, f))],
      [null, byte(k, tag)],
    ])), 1, [{ role: "input", name: "d" }]);
  };
  const [one, two] = [1, 2].map((tag) => k.evaluate(call(make(tag), d), scope).value);
  const built = entry(one, 0);
  assert.equal(num(k, k.evaluate(call(built), scope).value), 3);
  const own = form(k, k.evaluate(call(entry(one, 1), built), scope).value);
  assert.equal(own.form, "function", "the module that built it describes it");
  assert.equal(form(k, own.parts[1]).form, "apply", "every part of it, not only the function");
  assert.equal(k.evaluate(call(entry(two, 1), built), scope).refuted, true, "another module's key does not");
});

test("an attempt returns how an evaluation ended, as data, and a refutation inside marks nothing outside", () => {
  const { k, add, isZero, dec, call, kp } = setup();
  const scope = k.scope();
  // Until the ruling of 2026-11-19 an attempt answered a structure tagged `value`, `refuted`
  // or `limit`. It now answers the value itself, or a failure in the shape every failure a
  // program handles has: a structure whose first entry is keyed `failure`.
  const how = (v: Value): string => {
    if (k.kind(v) !== "structure") return "value";
    const [first] = k.entriesOf(v);
    return first !== undefined && first[0] !== null && k.symbolName(first[0]) === "failure" ? k.symbolName(first[1]) : "value";
  };
  const tried = (body: Value, n = 1000) => ({ form: how(k.evaluate(call(kp("attempt"), body, steps(k, n)), scope).value) });
  const ok = k.evaluate(call(kp("attempt"), call(add, byte(k, 1), byte(k, 2)), steps(k, 1000)), scope);
  assert.equal(num(k, ok.value), 3, "the value itself");
  const bad = k.evaluate(call(kp("attempt"), call(kp("claim"), call(isZero, byte(k, 5))), steps(k, 1000)), scope);
  assert.equal(bad.refuted, false, "the attempt itself is not wrong");
  assert.equal(how(bad.value), "refuted");
  const [, reason] = k.entriesOf(bad.value);
  assert.equal(k.symbolName(reason[0] as Value), "reason");
  assert.match(text(k, reason[1]), /claim that is not true/);

  const n = k.param("n");
  const down = k.symbol("m.down");
  const downTo = (m: number) => within(k, [[down, k.composedFunction([n], call(kp("if"), call(isZero, n), byte(k, 0), call(down, call(dec, n))))]], call(down, byte(k, m)));
  assert.equal(tried(downTo(200), 30).form, "limit");
  assert.equal(tried(downTo(200), 30).form, "limit", "the same every time");
  assert.equal(tried(downTo(3), 30).form, "value");
  // A search: try candidates until one satisfies a claim.
  const candidate = k.param("candidate");
  const fits = k.composedFunction([candidate], call(kp("attempt"), call(kp("claim"), call(isZero, call(dec, candidate))), steps(k, 100)));
  assert.deepEqual([0, 1, 2].map((c) => how(k.evaluate(call(fits, byte(k, c)), scope).value)), ["refuted", "value", "refuted"]);
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
  // Since the ruling of 2026-11-19 an attempt's answer is the value itself, where there is one.
  assert.equal(num(k, k.current(r.value)), 5);
  assert.equal(wrote, 1, "the effect was not performed again");
});

test("what goes on from an attempt's limit rests on a limit, and such an outcome is never stored", () => {
  const { k, dec, isZero, call, kp } = setup();
  const scope = k.scope();
  const isData = k.primitiveFunction({ purity: "pure", hash: hash(70), name: "isData", arity: 1, run: (a, c) => c.bits(Uint8Array.of(c.kind(a[0]) === "structure" ? 1 : 0), 1) });
  const [down, n] = [k.symbol("t.down"), k.param("n")];
  const downFn = k.composedFunction([n], call(kp("if"), call(isZero, n), byte(k, 0), call(down, call(dec, n))));
  const tried = (m: number, budget: number) => call(kp("claim"), call(isData, call(kp("attempt"), within(k, [[down, downFn]], call(down, byte(k, m))), steps(k, budget))));
  // The attempt runs out: the claim is still decided here, and says what it rests on.
  const limited = k.evaluate(tried(200, 30), scope);
  assert.equal(k.outcomeOf(limited.value), "decided");
  assert.ok(k.restsOn(limited.value).some((r) => r.kind === "limit"));
  // The attempt ends within its budget: nothing rests on a limit.
  const within30 = k.evaluate(tried(3, 30), scope);
  assert.ok(!k.restsOn(within30.value).some((r) => r.kind === "limit"));
  // An outcome that rests on a limit is not restored.
  const p = k.param("p");
  const claim = call(kp("claim"), call(isZero, byte(k, 0)));
  const fn = k.composedFunction([p], claim);
  const grounds: Rest[] = [{ kind: "limit" }];
  assert.throws(() => k.restore(claim, fn, "team-build", grounds, k.claimKey(claim, fn, grounds)), /rests on a limit is never stored/);
});

test("a step is a bounded amount of work: bits are charged by size, and a structure handed over by its entries", () => {
  const { k, call, kp } = setup();
  const kib = k.bits(new Uint8Array(1024).fill(0x61)); // 8192 bits
  const scope = k.scope();
  // Joining two values of 8192 bits handles 16384 bits: 256 steps beyond the call's own.
  const joined = k.evaluate(call(kp("join"), kib, kib), scope);
  assert.equal(k.bitsOf(joined.value).bitLength, 16384);
  assert.ok(joined.steps >= 256, `${joined.steps} steps`);
  assert.equal(k.evaluate(call(kp("join"), kib, kib), scope, { steps: 100 }).ended, "limit", "a small budget does not buy a large value");
  // Doubling a value under an attempt ends at the attempt's budget, long before memory does.
  const twice = k.param("x");
  const double = k.composedFunction([twice], call(kp("join"), twice, twice));
  let grown: Value = kib;
  for (let i = 0; i < 20; i++) grown = call(double, grown);
  const r = k.evaluate(call(kp("attempt"), grown, steps(k, 5000)), scope);
  assert.equal(r.ended, "complete");
  assert.equal(form(k, r.value).form, "limit");
  // Comparing and slicing are charged too, and give what they gave.
  const same = k.evaluate(call(kp("same"), kib, k.bits(new Uint8Array(1024).fill(0x61))), scope);
  assert.deepEqual(k.bitsOf(same.value), { bytes: Uint8Array.of(1), bitLength: 1 });
  assert.ok(same.steps >= 128);
  const part = k.evaluate(call(kp("slice"), kib, steps(k, 8), steps(k, 4096)), scope);
  assert.equal(k.bitsOf(part.value).bitLength, 4096);
  assert.ok(part.steps >= 64 && part.steps < 128, "a slice of whole bytes is charged for what it takes");
  // A structure handed to a primitive function costs a step for each entry.
  const size = k.primitiveFunction({ purity: "pure", hash: hash(71), name: "size", arity: 1, run: (a, c) => c.bits(Uint8Array.of(c.entriesOf(a[0]).length)) });
  const few = k.evaluate(call(size, k.structure([[null, byte(k, 1)]])), scope).steps;
  const many = k.evaluate(call(size, k.structure(Array.from({ length: 41 }, () => [null, byte(k, 1)] as const))), scope).steps;
  assert.equal(many - few, 40);
});

test("the kernel's own limit inside an attempt is the attempt's limit, not the end of the evaluation", () => {
  const { k, add, call, kp } = setup();
  const [deep, n] = [k.symbol("t.deep"), k.param("n")];
  // deep(n) = add(1, deep(n)): it never ends, and each call sits inside the one before.
  const deepFn = k.composedFunction([n], call(add, byte(k, 1), call(deep, n)));
  const r = k.evaluate(call(kp("attempt"), within(k, [[deep, deepFn]], call(deep, byte(k, 1))), steps(k, 50_000_000)), k.scope());
  assert.equal(r.ended, "complete", "the attempt answers; the evaluation goes on");
  assert.equal(form(k, r.value).form, "limit");
});

test("a structure is built an entry at a time: put adds or replaces, and never changes what it was given", () => {
  const { k, add, dec, isZero, call, kp } = setup();
  const said: number[] = [];
  const say = k.primitiveFunction({ purity: "effectful", capability: "output", part: "write", arity: 1, run: (a, c) => (said.push(c.bitsOf(a[0]).bytes[0]), a[0]) });
  const scope = k.scope();
  const run = (name: string, ...args: Value[]) => k.evaluate(call(kp(name), ...args), scope);
  const big = (v: Value) => k.bitsOf(v).bytes.reduce((n, b) => n * 256 + b, 0);
  const none = k.structure([]);
  const [a, b] = [k.symbolData("a"), k.symbolData("b")];
  const base = k.evaluate(k.structure([[k.symbol("a"), byte(k, 1)]]), scope).value;
  // An entry with no key goes at the end; one with a new key too; one with a key already there takes its place.
  const two = run("put", base, none, byte(k, 2)).value;
  const three = run("put", two, b, byte(k, 3)).value;
  const replaced = run("put", three, a, byte(k, 9)).value;
  assert.equal(big(run("count", base).value), 1, "what was given is as it was");
  assert.equal(big(run("count", three).value), 3);
  assert.equal(big(run("count", replaced).value), 3);
  assert.deepEqual([0, 1, 2].map((i) => num(k, run("get", replaced, byte(k, i)).value)), [9, 2, 3]);
  assert.equal(num(k, run("get", three, a).value), 1);
  assert.equal(num(k, run("get", replaced, b).value), 3);
  // The value is not evaluated by put: it is evaluated when the entry is read, once.
  const lazy = run("put", none, none, call(say, byte(k, 7))).value;
  assert.deepEqual(said, []);
  run("get", lazy, byte(k, 0));
  run("get", lazy, byte(k, 0));
  assert.deepEqual(said, [7]);
  // A structure of a size the text does not fix: range(n) = if n == 0 then [] else put(range(n - 1), [], n).
  const [range, n] = [k.symbol("t.range"), k.param("n")];
  const rangeFn = k.composedFunction([n], call(kp("if"), call(isZero, n), none, call(kp("put"), call(range, call(dec, n)), none, n)));
  const five = k.evaluate(within(k, [[range, rangeFn]], call(range, byte(k, 5))), scope).value;
  assert.deepEqual(k.entriesOf(whole(k, five).value).map(([, v]) => num(k, v)), [1, 2, 3, 4, 5]);
  // Refusals.
  assert.equal(run("put", byte(k, 1), none, byte(k, 2)).refuted, true, "only a structure");
  assert.equal(run("put", none, byte(k, 1), byte(k, 2)).refuted, true, "a key is a symbol, a key or none");
  void add;
});

test("put with a key makes a private entry, and carries the private entries of what it was given", () => {
  const { k, call, kp } = setup();
  const scope = k.scope();
  // module(key) => [ put(put({}, key, 42), `shown, 1),  o => get(o, key) ]
  const [key, o] = [k.param("key"), k.param("o")];
  const made = call(kp("put"), call(kp("put"), k.structure([]), key, byte(k, 42)), k.symbolData("shown"), byte(k, 1));
  const m = k.module(k.composedFunction([key], k.structure([[null, made], [null, k.composedFunction([o], call(kp("get"), o, key))]])), 1, []);
  const [obj, read] = k.entriesOf(k.evaluate(call(m), scope).value).map(([, v]) => k.evaluate(v, scope).value);
  const big = (v: Value) => k.bitsOf(v).bytes.reduce((n, b) => n * 256 + b, 0);
  assert.equal(big(k.evaluate(call(kp("count"), obj), scope).value), 1, "the private entry is not counted");
  assert.equal(k.symbolName(k.evaluate(call(kp("key"), obj, byte(k, 0)), scope).value), "shown", "and has no place");
  // Code without the key adds an entry: the private one is carried across.
  const more = k.evaluate(call(kp("put"), obj, k.structure([]), byte(k, 5)), scope).value;
  assert.equal(big(k.evaluate(call(kp("count"), more), scope).value), 2);
  assert.equal(num(k, k.evaluate(call(read, more), scope).value), 42);
});

test("a structure's keys, a value's kind, and a symbol's spelling can be read", () => {
  const { k, add, call, kp } = setup();
  const scope = k.scope();
  const run = (name: string, ...args: Value[]) => k.evaluate(call(kp(name), ...args), scope);
  const text = (t: string) => k.bits(new TextEncoder().encode(t));
  const s = k.evaluate(k.structure([[k.symbol("first"), byte(k, 1)], [null, byte(k, 2)]]), scope).value;
  // key: a symbol, or the empty structure for an entry with none.
  assert.equal(k.symbolName(run("key", s, byte(k, 0)).value), "first");
  const unkeyed = run("key", s, byte(k, 1)).value;
  assert.equal(k.kind(unkeyed), "structure");
  assert.equal(k.entriesOf(unkeyed).length, 0);
  assert.equal(run("key", s, byte(k, 2)).refuted, true, "no such place");
  // kind: what a value is.
  const kindOf = (v: Value) => k.symbolName(run("kind", v).value);
  assert.equal(kindOf(byte(k, 1)), "bits");
  assert.equal(kindOf(k.symbolData("x")), "symbol");
  assert.equal(kindOf(s), "structure");
  assert.equal(kindOf(add), "function");
  assert.equal(kindOf(k.composedFunction([], byte(k, 1))), "function", "a composed function and a primitive one are not told apart");
  assert.equal(kindOf(kp("if")), "function");
  assert.equal(kindOf(k.inspectionRight()), "key");
  // The key of an unkeyed entry is told from a symbol by its kind.
  assert.equal(kindOf(unkeyed), "structure");
  assert.equal(kindOf(run("key", s, byte(k, 0)).value), "symbol");
  // A value that has not arrived has no kind yet.
  const c = k.cell();
  assert.equal(k.kind(k.evaluate(call(kp("kind"), c), scope).value), "expression");
  // symbol and spelling.
  const made = run("symbol", text("total")).value;
  assert.equal(k.symbolName(made), "total");
  assert.deepEqual(k.bitsOf(run("same", made, k.symbolData("total")).value), k.bitsOf(truth(k, true)), "the symbol of that name, the same as one written");
  assert.equal(new TextDecoder().decode(k.bitsOf(run("spelling", made).value).bytes), "total");
  assert.equal(num(k, run("get", k.structure([[k.symbol("total"), byte(k, 8)]]), call(kp("symbol"), text("total"))).value), 8, "a computed symbol reads an entry");
  assert.equal(run("symbol", text("")).refuted, true);
  assert.equal(run("symbol", k.structure([])).refuted, true);
  assert.equal(run("spelling", byte(k, 1)).refuted, true);
});

// ---- The claims of a call (the second review's cluster 13) -------------------

test("a call lists its claims: one record for each claim as written, however often it was evaluated", () => {
  const { k, isZero, call, kp } = setup();
  const n = k.param("n");
  const scope = k.scope();
  const written = call(kp("claim"), call(isZero, n));
  const f = k.composedFunction([n], call(kp("then"), written, n));
  const three = k.evaluate(call(kp("then"), call(f, byte(k, 0)), call(kp("then"), call(f, byte(k, 0)), call(f, byte(k, 0)))), scope);
  assert.equal(three.claims.length, 1, "one written claim, one record");
  const [record] = three.claims;
  assert.equal(record.claim, written, "the claim as written, by the handle the host made");
  assert.deepEqual([record.decided, record.assumed, record.undecided, record.refuted, record.waiting], [3, 0, 0, 0, 0]);
  assert.ok(record.restsOn.some((r) => r.kind === "primitive"), "what the outcomes rest on");
  assert.equal(record.module, undefined, "no module wrote it");
  // A refuted evaluation is counted, with its reason. The counts are of this call alone.
  const bad = k.evaluate(call(f, byte(k, 3)), scope);
  assert.deepEqual([bad.claims[0].decided, bad.claims[0].refuted], [0, 1]);
  assert.deepEqual(bad.claims[0].reasons, ["a claim that is not true"]);
  // A call that evaluates no claim lists none.
  assert.deepEqual(k.evaluate(call(isZero, byte(k, 0)), scope).claims, []);
});

test("a claim that waits is listed as waiting, and the advance that takes it up says how it came out", () => {
  const { k, isZero, call, kp } = setup();
  const scope = k.scope();
  const [c, d] = [k.cell(), k.cell()];
  const [first, second] = [call(kp("claim"), call(isZero, c)), call(kp("claim"), call(isZero, d))];
  const r = k.evaluate(k.structure([[null, first], [null, second]]), scope);
  assert.deepEqual(r.claims, [], "a structure does not need its entries: no claim was evaluated");
  const one = k.evaluate(first, scope);
  const two = k.evaluate(second, scope);
  assert.deepEqual([one.claims[0].decided, one.claims[0].waiting], [0, 1]);
  assert.equal(two.claims[0].claim, second);
  k.fill(c, byte(k, 0));
  const advanced = k.advance();
  const of = (claim: Value) => advanced.claims.find((x) => x.claim === claim);
  assert.deepEqual([of(first)?.decided, of(first)?.waiting], [1, 0], "taken up and decided: it waits no longer");
  assert.equal(of(second)?.waiting ?? 1, 1, "the other still waits");
  k.fill(d, byte(k, 7));
  const last = k.advance();
  assert.deepEqual([last.claims.find((x) => x.claim === second)?.refuted, last.claims.find((x) => x.claim === second)?.waiting], [1, 0]);
});

test("a claim's record tells the weaker outcomes apart and names the module that wrote the claim", () => {
  const { k, isZero, call, kp } = setup();
  const reason = (t: string) => k.bits(new TextEncoder().encode(t));
  const key = k.param("key");
  const cannotTell = call(kp("claim"), call(kp("undecided"), reason("no rule applies")));
  const assumed = call(kp("claim"), call(kp("assume"), call(isZero, byte(k, 3))));
  const m = k.module(k.composedFunction([key], call(kp("then"), cannotTell, assumed)), 1);
  const r = k.evaluate(call(m), k.scope());
  assert.equal(r.claims.length, 2);
  const [u, a] = [r.claims.find((x) => x.undecided === 1), r.claims.find((x) => x.assumed === 1)];
  assert.deepEqual(u?.reasons, ["no rule applies"]);
  assert.ok(a?.restsOn.some((x) => x.kind === "assumption"), "an assumed claim names who assumed");
  assert.equal(u?.module, k.moduleOf(m), "the module whose code wrote the claim");
  assert.equal(a?.module, k.moduleOf(m));
});

// ---- Recursion as the loop (the second review's cluster 9) -------------------

test("ahead of what is done, a loop that carries state ends: a function being opened is not opened again", () => {
  const { k, add, call, kp } = setup();
  let accepted = 0;
  const pending: Value[] = [];
  const accept = k.primitiveFunction({ purity: "effectful", capability: "net", part: "accept", arity: 0, run: (_a, c) => (accepted++, pending.push(c.cell()), pending[pending.length - 1]) });
  const [serve, i] = [k.symbol("t.serve"), k.param("i")];
  // serve(i) = then(accept(), serve(i + 1)): the answer comes late, and each turn has a new i.
  const serveFn = k.composedFunction([i], call(kp("then"), call(accept), call(serve, call(add, i, byte(k, 1)))));
  const r = k.evaluate(within(k, [[serve, serveFn]], call(serve, byte(k, 0))), k.scope(), { steps: 2000 });
  assert.equal(r.ended, "complete", "it ends well inside its budget");
  assert.ok(r.steps < 50, `a few steps, not the budget: ${r.steps}`);
  assert.equal(accepted, 1, "one effect: the rest was ahead");
  // When the answer arrives the loop goes on by one turn, and waits again.
  k.fill(pending[0] as never, k.structure([]));
  const next = k.advance({ steps: 2000 });
  assert.equal(next.ended, "complete");
  assert.equal(accepted, 2);
});

test("an argument that is one step of work on known values is evaluated at the call", () => {
  const { k, add, dec, isZero, call, kp } = setup();
  let ran = 0;
  const tick = k.primitiveFunction({ ...pure("tick", 20, 1, (a) => a), run: (a, c) => (ran++, c.bits(c.bitsOf(a[0]).bytes)) });
  const [a, n, acc, count] = [k.param("a"), k.param("n"), k.param("acc"), k.symbol("t.count")];
  const scope = k.scope();
  // The function does not use its argument; the argument is evaluated all the same, once.
  const ignore = k.composedFunction([a], byte(k, 9));
  assert.equal(num(k, k.evaluate(call(ignore, call(tick, byte(k, 1))), scope).value), 9);
  assert.equal(ran, 1, "evaluated at the call");
  // Not where a value under it is not known yet, and not where it is a call of a composed function.
  k.evaluate(call(ignore, call(tick, k.cell())), scope);
  k.evaluate(call(ignore, call(k.composedFunction([], call(tick, byte(k, 1))))), scope);
  assert.equal(ran, 1, "neither was evaluated");
  // A refutation it comes to is held: the call goes through, and using the argument is what refutes.
  const fails = k.primitiveFunction({ ...pure("fails", 21, 1, (x) => x), run: () => { throw new Refusal("no"); } });
  assert.equal(k.evaluate(call(ignore, call(fails, byte(k, 1))), scope).refuted, false);
  assert.equal(k.evaluate(call(k.composedFunction([a], a), call(fails, byte(k, 1))), scope).refuted, true);
  // A loop with a total: each turn's total is a value, so the last turn hands back bits with nothing put off.
  // count(n, acc) = if isZero(n) then acc else count(dec(n), tick(add(acc, 1)))
  ran = 0;
  const countFn = k.composedFunction([n, acc], call(kp("if"), call(isZero, n), acc, call(count, call(dec, n), call(add, acc, byte(k, 1)))));
  const r = k.evaluate(within(k, [[count, countFn]], call(count, byte(k, 250), byte(k, 0))), scope);
  assert.equal(r.ended, "complete");
  assert.equal(num(k, r.value), 250);
});

// ---- Statements that do not wait (the second review's cluster 8) --------------

function sayer() {
  const base = setup();
  const said: number[] = [];
  const say = base.k.primitiveFunction({ purity: "effectful", capability: "output", part: "write", arity: 1, run: (a, c) => (said.push(c.bitsOf(a[0]).bytes[0]), a[0]) });
  return { ...base, said, say };
}

test("also starts its first and then its second, and the second does not wait", () => {
  const { k, call, kp, said, say } = sayer();
  const scope = k.scope();
  // Nothing late: the order written.
  assert.equal(num(k, k.evaluate(call(kp("also"), call(say, byte(k, 1)), call(say, byte(k, 2))), scope).value), 2);
  assert.deepEqual(said, [1, 2]);
  // The first waits on a late answer: the second is performed, and its value is given now.
  said.length = 0;
  const c = k.cell();
  const r = k.evaluate(call(kp("also"), call(say, c), call(say, byte(k, 4))), scope);
  assert.deepEqual(said, [4]);
  assert.equal(k.kind(r.value), "bits", "the value is given, not held for the first");
  assert.equal(num(k, r.value), 4);
  assert.equal(k.waiting().length, 1, "the first goes on as work of the evaluation");
  k.fill(c, byte(k, 3));
  k.advance({ steps: 100 });
  assert.deepEqual(said, [4, 3], "the first is taken up when its answer arrives, once");
  assert.deepEqual(k.waiting(), []);
});

test("a function gives its value while work it started goes on, and a refutation in that work is reported", () => {
  const { k, add, call, kp, said, say } = sayer();
  const scope = k.scope();
  const c = k.cell();
  // f() = also(say(c), 42): the caller goes on with 42.
  const f = k.composedFunction([], call(kp("also"), call(say, c), byte(k, 42)));
  assert.equal(num(k, k.evaluate(call(add, call(f), byte(k, 1)), scope).value), 43);
  assert.deepEqual(said, []);
  k.fill(c, byte(k, 9));
  assert.deepEqual(k.advance({ steps: 100 }).refuted, []);
  assert.deepEqual(said, [9]);
  // Work that comes to a refutation after the value was given: the advance reports it.
  const fails = k.primitiveFunction({ ...pure("fails", 61, 1, (x) => x), run: () => { throw new Refusal("no"); } });
  const d = k.cell();
  const r = k.evaluate(call(kp("also"), call(fails, d), byte(k, 5)), scope);
  assert.equal(r.refuted, false);
  assert.equal(num(k, r.value), 5);
  k.fill(d, byte(k, 0));
  assert.equal(k.advance({ steps: 100 }).refuted.length, 1);
});

test("a claim holds what is written after it: no later effect until it is decided, and none if it is refuted", () => {
  const { k, isZero, call, kp, said, say } = sayer();
  const scope = k.scope();
  const x = k.param("x");
  const run = (first: (c: Value) => Value) => {
    const c = k.cell();
    said.length = 0;
    const r = k.evaluate(call(kp("also"), first(c), call(say, byte(k, 2))), scope);
    return { c, r };
  };
  // A claim written as the statement.
  const direct = run((c) => call(kp("claim"), call(isZero, c)));
  assert.deepEqual(said, [], "held while the claim waits");
  assert.equal(k.kind(direct.r.value), "expression", "and so is the value");
  k.fill(direct.c, byte(k, 0));
  k.advance({ steps: 100 });
  assert.deepEqual(said, [2], "decided: what follows goes on");
  // Refuted: what follows is not performed.
  const refuted = run((c) => call(kp("claim"), call(isZero, c)));
  k.fill(refuted.c, byte(k, 7));
  assert.equal(k.advance({ steps: 100 }).refuted.length, 1);
  assert.deepEqual(said, []);
  // A claim inside a function the statement calls does not hold the caller's statements.
  // (Until the ruling of 2026-11-20 this asserted the opposite. The acceptance stream found
  // that it held the line after `a <- f()`, which the forms say holds nothing. A statement
  // whose value is dropped is held by the claim the notation writes for it: see the tests of
  // failures below.)
  const check = k.composedFunction([x], call(kp("also"), call(kp("claim"), call(isZero, x)), byte(k, 1)));
  const nested = run((c) => call(check, c));
  assert.deepEqual(said, [2], "not held: the statement is a call, not a claim");
  k.fill(nested.c, byte(k, 0));
  k.advance({ steps: 100 });
  assert.deepEqual(said, [2]);
  // A claim already refuted, or a statement already refuted, stops the block at once.
  said.length = 0;
  assert.equal(k.evaluate(call(kp("also"), call(kp("claim"), call(isZero, byte(k, 3))), call(say, byte(k, 2))), scope).refuted, true);
  assert.deepEqual(said, []);
});

test("ahead of what is done, also starts nothing: each effect is performed once when it is reached", () => {
  const { k, call, kp, said, say } = sayer();
  const scope = k.scope();
  const [c, d] = [k.cell(), k.cell()];
  // then(say(c), also(say(d), say(2))): the whole second part is ahead while say(c) waits.
  const r = k.evaluate(call(kp("then"), call(say, c), call(kp("also"), call(say, d), call(say, byte(k, 2)))), scope);
  assert.deepEqual(said, []);
  k.fill(c, byte(k, 1));
  k.advance({ steps: 100 });
  assert.deepEqual(said, [1, 2], "reached: the second statement does not wait for say(d)");
  assert.equal(num(k, k.current(r.value)), 2);
  k.fill(d, byte(k, 3));
  k.advance({ steps: 100 });
  assert.deepEqual(said, [1, 2, 3], "and say(d) is performed once");
  // The same where the second's value is known ahead: the first is not started early.
  said.length = 0;
  const [e, f] = [k.cell(), k.cell()];
  k.evaluate(call(kp("then"), call(say, e), call(kp("also"), call(say, f), byte(k, 9))), scope);
  k.fill(f, byte(k, 5));
  k.advance({ steps: 100 });
  assert.deepEqual(said, [], "say(f) is written after a `then` that still waits");
  k.fill(e, byte(k, 4));
  k.advance({ steps: 100 });
  assert.deepEqual(said, [4, 5]);
});

test("answers are acted on in the order they arrive, and what waits on another cell is left alone", () => {
  const { k, add, call, said, say } = sayer();
  const scope = k.scope();
  const [c1, c2, c3] = [k.cell(), k.cell(), k.cell()];
  // Three evaluations, started in this order, each waiting on its own cell.
  k.evaluate(call(say, c1), scope);
  k.evaluate(call(say, c2), scope);
  // The third has three applications left to do, and no effect.
  const sum = k.evaluate(call(add, c3, call(add, c3, call(add, c3, byte(k, 1)))), scope);
  // The second's answer arrives first.
  k.fill(c2, byte(k, 2));
  k.fill(c1, byte(k, 1));
  const both = k.advance({ steps: 100 });
  assert.deepEqual(said, [2, 1], "the order the answers arrived, not the order the evaluations were started");
  assert.equal(both.steps, 2, "the third evaluation waits on neither cell and is not walked again");
  assert.deepEqual(k.advance({ steps: 100 }), { ended: "complete", steps: 0, refuted: [], claims: [] }, "nothing new has arrived");
  k.fill(c3, byte(k, 5));
  assert.equal(k.advance({ steps: 100 }).steps, 3);
  assert.equal(num(k, k.current(sum.value)), 16);
  assert.deepEqual(k.waiting(), []);
});

test("an advance that a limit stops is gone on with by the next, and nothing is taken up twice", () => {
  const { k, call, said, say } = sayer();
  const scope = k.scope();
  const [c1, c2] = [k.cell(), k.cell()];
  k.evaluate(call(say, c1), scope);
  k.evaluate(call(say, c2), scope);
  k.fill(c1, byte(k, 1));
  k.fill(c2, byte(k, 2));
  const first = k.advance({ steps: 1 });
  assert.equal(first.ended, "limit");
  assert.deepEqual(said, [1]);
  const second = k.advance({ steps: 10 });
  assert.equal(second.ended, "complete");
  assert.deepEqual(said, [1, 2]);
});

test("an evaluation that comes to wait on a new cell is taken up when that cell is filled", () => {
  const { k, call, kp } = setup();
  const cells: Value[] = [];
  const late = k.primitiveFunction({ purity: "effectful", capability: "net", part: "read", arity: 0, run: (_a, c) => (cells.push(c.cell()), cells[cells.length - 1]) });
  // then(late(), then(late(), 9)): the second answer is asked for only when the first has come.
  const r = k.evaluate(call(kp("then"), call(late), call(kp("then"), call(late), byte(k, 9))), k.scope());
  assert.equal(cells.length, 1);
  k.fill(cells[0] as never, byte(k, 1));
  k.advance({ steps: 100 });
  assert.equal(cells.length, 2, "now it waits on a cell that did not exist before");
  // An answer nothing waits on wakes nothing: the evaluation is known to wait on the new cell only.
  k.fill(k.cell(), byte(k, 0));
  assert.equal(k.advance({ steps: 100 }).steps, 0);
  k.fill(cells[1] as never, byte(k, 2));
  k.advance({ steps: 100 });
  assert.equal(num(k, k.current(r.value)), 9);
});

// ---- A failure is plain data (the second review's cluster 8) -----------------
//
// The kernel has nothing for a failure. These tests hold that the two functions
// Allegretto ships for one, and the claim a notation writes for a statement whose value is
// dropped, need no primitive beyond those the kernel has.

function failures() {
  const base = sayer();
  const { k, call, kp } = base;
  const sd = (name: string) => k.symbolData(name);
  const [T, F] = [truth(k, true), truth(k, false)];
  const [x, name, handler] = [k.param("x"), k.param("name"), k.param("handler")];
  const firstKey = call(kp("key"), x, byte(k, 0));
  // is_failure(x): a structure whose first entry is keyed `failure`.
  const isFailure = k.composedFunction(
    [x],
    call(kp("if"), call(kp("same"), call(kp("kind"), x), sd("structure")),
      call(kp("if"), call(kp("same"), call(kp("count"), x), call(kp("count"), k.structure([]))), F,
        call(kp("if"), call(kp("same"), call(kp("kind"), firstKey), sd("symbol")), call(kp("same"), firstKey, sd("failure")), F)),
      F),
  );
  // handle(x, name, handler): handler(x) where x is a failure of that name, and x otherwise.
  const handle = k.composedFunction(
    [x, name, handler],
    call(kp("if"), call(isFailure, x), call(kp("if"), call(kp("same"), call(kp("get"), x, sd("failure")), name), call(handler, x), x), x),
  );
  const failure = (what: string) => k.structure([[k.symbol("failure"), sd(what)], [k.symbol("code"), byte(k, 7)]]);
  // What a notation writes for a statement whose value is dropped: claim(!is_failure(a)).
  const dropped = (a: Value) => call(kp("claim"), call(kp("if"), call(isFailure, a), F, T));
  return { ...base, sd, isFailure, handle, failure, dropped };
}

test("a failure is plain data of one shape, told by a function written with the kernel's primitives", () => {
  const { k, call, sd, isFailure, failure } = failures();
  const scope = k.scope();
  const is = (v: Value) => k.bitsOf(k.evaluate(call(isFailure, v), scope).value).bytes[0] === 1;
  assert.equal(is(failure("file_missing")), true);
  assert.equal(is(byte(k, 1)), false, "bits");
  assert.equal(is(sd("failure")), false, "the symbol alone");
  assert.equal(is(k.structure([])), false, "an empty structure");
  assert.equal(is(k.structure([[null, sd("failure")]])), false, "an entry with no key");
  assert.equal(is(k.structure([[k.symbol("code"), byte(k, 1)], [k.symbol("failure"), sd("late")]])), false, "the entry is not the first");
});

test("handle names the failure it handles, and lets any other through", () => {
  const { k, call, sd, isFailure, handle, failure } = failures();
  const scope = k.scope();
  const x = k.param("x");
  const nine = k.composedFunction([x], byte(k, 9));
  assert.equal(num(k, k.evaluate(call(handle, failure("file_missing"), sd("file_missing"), nine), scope).value), 9);
  assert.equal(num(k, k.evaluate(call(handle, byte(k, 3), sd("file_missing"), nine), scope).value), 3, "what is no failure is itself");
  const other = call(handle, failure("no_permission"), sd("file_missing"), nine);
  assert.equal(k.bitsOf(k.evaluate(call(isFailure, other), scope).value).bytes[0], 1, "a failure of another name is still a failure");
});

test("a statement whose value is dropped holds what follows until its answer comes, and a failure refutes it", () => {
  const { k, call, kp, said, say, dropped, failure, isFailure } = failures();
  const scope = k.scope();
  const cells: Value[] = [];
  const write = k.primitiveFunction({ purity: "effectful", capability: "files", part: "write", arity: 0, run: (_a, c) => (cells.push(c.cell()), cells[cells.length - 1]) });
  // write(); say(2), with the write's answer dropped.
  k.evaluate(call(kp("also"), dropped(call(write)), call(say, byte(k, 2))), scope);
  assert.deepEqual(said, [], "held: nobody has looked at the write's answer yet");
  k.fill(cells[0] as never, k.structure([]));
  assert.deepEqual(k.advance({ steps: 200 }).refuted, []);
  assert.deepEqual(said, [2], "the write succeeded");
  // The same, and the write fails.
  said.length = 0;
  k.evaluate(call(kp("also"), dropped(call(write)), call(say, byte(k, 2))), scope);
  k.fill(cells[1] as never, failure("disk_full"));
  assert.equal(k.advance({ steps: 200 }).refuted.length, 1, "a failure nothing handled");
  assert.deepEqual(said, [], "and nothing written after it happened");
  // r <- write(); say(2): the answer is bound, so nothing holds, and a failure is r's to handle.
  said.length = 0;
  const r = k.symbol("t.r");
  const bound = k.evaluate(within(k, [[r, call(write)]], call(kp("also"), r, call(kp("also"), call(say, byte(k, 2)), call(isFailure, r)))), scope);
  assert.deepEqual(said, [2], "at once");
  k.fill(cells[2] as never, failure("disk_full"));
  assert.deepEqual(k.advance({ steps: 200 }).refuted, [], "no refutation: the program reads the answer");
  assert.equal(k.bitsOf(k.current(bound.value)).bytes[0], 1);
});

test("a call whose value is dropped is held by its own claim, and one whose value is bound holds nothing, though a claim waits inside", () => {
  const { k, isZero, call, kp, said, say, dropped } = failures();
  const scope = k.scope();
  const x = k.param("x");
  // check(x) = claim(isZero(x)); 1, as a block of two statements.
  const check = k.composedFunction([x], call(kp("also"), call(kp("claim"), call(isZero, x)), byte(k, 1)));
  // check(c); say(2), with check's value dropped: held until the claim inside is decided.
  const c1 = k.cell();
  k.evaluate(call(kp("also"), dropped(call(check, c1)), call(say, byte(k, 2))), scope);
  assert.deepEqual(said, [], "held by the claim the notation writes for a dropped statement");
  k.fill(c1, byte(k, 0));
  k.advance({ steps: 200 });
  assert.deepEqual(said, [2]);
  // a <- check(c); say(4): bound, so nothing holds, as the forms say.
  said.length = 0;
  const [c2, a] = [k.cell(), k.symbol("t.a")];
  k.evaluate(within(k, [[a, call(check, c2)]], call(kp("also"), a, call(say, byte(k, 4)))), scope);
  assert.deepEqual(said, [4], "at once");
});

// ---- What a refutation halts (the second review's cluster 8) -----------------

test("after a refuted statement the rest is evaluated ahead: a further refutation is counted, and no effect happens", () => {
  const { k, isZero, call, kp, said, say } = sayer();
  const scope = k.scope();
  const v = k.symbol("t.v");
  for (const order of ["then", "also"]) {
    said.length = 0;
    const [first, second] = [call(kp("claim"), call(isZero, byte(k, 3))), call(kp("claim"), call(isZero, byte(k, 4)))];
    // claim(isZero(3)); say(1); claim(isZero(4))
    const r = k.evaluate(call(kp(order), first, call(kp(order), call(say, byte(k, 1)), second)), scope);
    assert.equal(r.refuted, true, order);
    assert.deepEqual(said, [], "nothing written after the refuted claim is performed");
    assert.deepEqual(r.claims.map((c) => [c.claim === first || c.claim === second, c.refuted]), [[true, 1], [true, 1]], "both refutations are reported");
  }
  // A claim that only receives the first refutation is not counted as a second one.
  const made = call(kp("claim"), call(isZero, byte(k, 3)));
  const rests = call(kp("claim"), call(isZero, v));
  const one = k.evaluate(within(k, [[v, made]], call(kp("then"), v, rests)), scope);
  assert.equal(one.refuted, true);
  assert.deepEqual(one.claims.map((c) => c.refuted), [1], "one refutation, one record");
});

// Until the ruling of 2026-11-20 this test was "looking ahead after a refutation never ends
// the evaluation at its limit", and asserted that looking took at most half of the steps
// left. The maintainer ruled that a refutation outranks a limit: looking may use every step
// that is left, the refutation stands all the same, and the result says it was cut short.
test("a refutation outranks a limit: the steps may run out while looking for more, and the refutation stands", () => {
  const { k, add, isZero, call, kp } = setup();
  // After the refuted claim, a sum of a hundred additions: more than all the steps that are left.
  let sum: Value = byte(k, 0);
  for (let i = 0; i < 100; i++) sum = call(add, sum, byte(k, 1));
  const r = k.evaluate(call(kp("then"), call(kp("claim"), call(isZero, byte(k, 3))), sum), k.scope(), { steps: 80 });
  assert.equal(r.ended, "complete", "the refutation is the answer, not the limit");
  assert.equal(r.refuted, true);
  assert.equal(r.cutShort, true, "and the result says looking for more was cut short");
  assert.equal(r.steps, 80, "every step that was left went into looking");
  // With steps to spare nothing is cut short, and the field is absent.
  const whole = k.evaluate(call(kp("then"), call(kp("claim"), call(isZero, byte(k, 3))), sum), k.scope(), { steps: 1000 });
  assert.equal(whole.refuted, true);
  assert.equal("cutShort" in whole, false);
  // Inside an attempt the same holds: the attempt answers that it was refuted, not that it reached its limit.
  const tried = k.evaluate(call(kp("attempt"), call(kp("then"), call(kp("claim"), call(isZero, byte(k, 3))), sum), k.bits(Uint8Array.of(0, 0, 0, 50))), k.scope());
  const [first] = k.entriesOf(tried.value);
  assert.equal(k.symbolName(first[1]), "refuted");
});

test("a call of advance that meets a refutation performs no further effect, and a later call goes on", () => {
  const { k, isZero, call, kp, said, say } = sayer();
  const scope = k.scope();
  const [c1, c2, c3] = [k.cell(), k.cell(), k.cell()];
  k.evaluate(call(say, c1), scope);
  k.evaluate(call(kp("claim"), call(isZero, c2)), scope);
  k.evaluate(call(say, c3), scope);
  // The answers arrive in this order: an effect, then what refutes, then another effect.
  k.fill(c1, byte(k, 1));
  k.fill(c2, byte(k, 7));
  k.fill(c3, byte(k, 3));
  const first = k.advance({ steps: 100 });
  assert.equal(first.refuted.length, 1);
  assert.deepEqual(said, [1], "what arrived before the refutation was done; what arrived after it is held");
  // The launcher may end the phase here. If it calls again, what was held is done.
  const second = k.advance({ steps: 100 });
  assert.deepEqual(second.refuted, []);
  assert.deepEqual(said, [1, 3]);
  assert.deepEqual(k.waiting(), []);
});

// ---- Assumptions named and withdrawn; a sequence that waits for all (2026-11-19) ----

test("what rests on an assumption names that assumption, and two of one module are told apart", () => {
  const { k, isZero, call, kp } = setup();
  const scope = k.scope();
  const [a1, a2] = [call(kp("assume"), call(isZero, byte(k, 0))), call(kp("assume"), call(isZero, byte(k, 3)))];
  const [onFirst, onBoth] = [call(kp("claim"), a1), call(kp("claim"), call(kp("then"), a1, a2))];
  const r = k.evaluate(k.structure([[null, onFirst], [null, onBoth]]), scope);
  const [first, both] = k.entriesOf(r.value).map(([, v]) => k.evaluate(v, scope));
  const at = (x: ReturnType<Kernel["evaluate"]>) => k.restsOn(x.value).filter((rest) => rest.kind === "assumption").map((rest) => (rest as { at?: Value }).at);
  assert.deepEqual(at(first), [a1]);
  assert.deepEqual(at(both), [a1, a2], "each assumption is named, though one module made both");
  // The list of claims says the same, so a tool can list what rests on one assumption.
  const resting = both.claims.find((c) => c.claim === onBoth);
  assert.equal(resting?.assumed, 1);
  assert.equal(resting?.restsOn.filter((rest) => rest.kind === "assumption").length, 2);
});

test("a withdrawn assumption is not taken on trust: it is evaluated as a claim", () => {
  const { k, isZero, call, kp } = setup();
  const scope = k.scope();
  const [holds, fails] = [call(kp("assume"), call(isZero, byte(k, 0))), call(kp("assume"), call(isZero, byte(k, 3)))];
  assert.equal(k.outcomeOf(k.evaluate(fails, scope).value), "assumed", "taken on trust, though it is false");
  (k as Kernel2).withdraw(holds);
  (k as Kernel2).withdraw(fails);
  const checked = k.evaluate(holds, scope);
  assert.equal(k.outcomeOf(checked.value), "decided", "checked, and it holds");
  assert.deepEqual(k.restsOn(checked.value).filter((rest) => rest.kind === "assumption"), []);
  const wrong = k.evaluate(fails, scope);
  assert.equal(wrong.refuted, true, "checked, and it does not hold");
  assert.equal(wrong.claims[0].claim, fails, "it is listed among the claims, as written");
  // An assumption that was not withdrawn is still an assumption.
  assert.equal(k.outcomeOf(k.evaluate(call(kp("assume"), call(isZero, byte(k, 3))), scope).value), "assumed");
  // By module: every assumption its code makes.
  const key = k.param("key");
  const m = (k as Kernel2).module(k.composedFunction([key], call(kp("assume"), call(isZero, byte(k, 3)))), 1);
  assert.equal(k.outcomeOf(k.evaluate(call(m), scope).value), "assumed");
  (k as Kernel2).withdraw((k as Kernel2).moduleOf(m) as string);
  const other = (k as Kernel2).module(k.composedFunction([key], call(kp("assume"), call(isZero, byte(k, 4)))), 1);
  (k as Kernel2).withdraw((k as Kernel2).moduleOf(other) as string);
  assert.equal(k.evaluate(call(other), scope).refuted, true);
  assert.throws(() => (k as Kernel2).withdraw(call(kp("claim"), byte(k, 1))), /assume primitive/);
  assert.throws(() => (k as Kernel2).withdraw("M"), /identity/);
});

test("then waits for everything its first started, and also does not", () => {
  const { k, add, call, kp, said, say } = sayer();
  const scope = k.scope();
  // leaves(c) = also(say(c), 42): it gives 42 and leaves say(c) going.
  const c = k.param("c");
  const leaves = k.composedFunction([c], call(kp("also"), call(say, c), byte(k, 42)));
  // then(leaves(c1), say(2)): the 2 is said only when what leaves() started is over.
  const c1 = k.cell();
  const r = k.evaluate(call(kp("then"), call(leaves, c1), call(say, byte(k, 2))), scope);
  assert.deepEqual(said, [], "the first has given its value, and is not over");
  assert.equal(k.kind(r.value), "expression");
  k.fill(c1, byte(k, 1));
  k.advance({ steps: 100 });
  assert.deepEqual(said, [1, 2]);
  assert.equal(num(k, k.current(r.value)), 2);
  assert.deepEqual(k.waiting(), []);
  // also(leaves(c2), say(4)): the caller did not ask to wait.
  said.length = 0;
  const c2 = k.cell();
  k.evaluate(call(kp("also"), call(leaves, c2), call(say, byte(k, 4))), scope);
  assert.deepEqual(said, [4]);
  k.fill(c2, byte(k, 3));
  k.advance({ steps: 100 });
  assert.deepEqual(said, [4, 3]);
  // A value computed from the first is still only the first's value: the wait is the then's.
  said.length = 0;
  const c3 = k.cell();
  assert.equal(num(k, k.evaluate(call(add, call(leaves, c3), byte(k, 1)), scope).value), 43);
  k.fill(c3, byte(k, 0));
  k.advance({ steps: 100 });
});

test("a refutation in what a then's first started refutes the then, and the second is not done", () => {
  const { k, call, kp, said, say } = sayer();
  const scope = k.scope();
  const fails = k.primitiveFunction({ ...pure("fails", 62, 1, (x) => x), run: () => { throw new Refusal("no"); } });
  const c = k.param("c");
  const leaves = k.composedFunction([c], call(kp("also"), call(fails, c), byte(k, 42)));
  const c1 = k.cell();
  const r = k.evaluate(call(kp("then"), call(leaves, c1), call(say, byte(k, 2))), scope);
  assert.equal(r.refuted, false);
  k.fill(c1, byte(k, 0));
  const advanced = k.advance({ steps: 100 });
  assert.equal(advanced.refuted.length, 1, "one refutation, reported once");
  assert.deepEqual(said, [], "the second was not done");
  assert.equal(k.outcomeOf(k.current(r.value)), "refuted");
});

test("a then inside a then: each waits for what its own first started", () => {
  const { k, call, kp, said, say } = sayer();
  const scope = k.scope();
  const c = k.param("c");
  const leaves = k.composedFunction([c], call(kp("also"), call(say, c), byte(k, 42)));
  const [c1, c2] = [k.cell(), k.cell()];
  // then(then(leaves(c1), leaves(c2)), say(9))
  k.evaluate(call(kp("then"), call(kp("then"), call(leaves, c1), call(leaves, c2)), call(say, byte(k, 9))), scope);
  k.fill(c1, byte(k, 1));
  k.advance({ steps: 100 });
  assert.deepEqual(said, [1], "the inner then goes on to its second, which leaves say(c2) going; the outer still waits");
  k.fill(c2, byte(k, 2));
  k.advance({ steps: 100 });
  assert.deepEqual(said, [1, 2, 9]);
});

test("an attempt's answer is handled as any failure is: is_failure and handle work on it", () => {
  const { k, isZero, call, kp, sd, isFailure, handle } = failures();
  const scope = k.scope();
  const x = k.param("x");
  const refutedOne = call(kp("attempt"), call(kp("claim"), call(isZero, byte(k, 5))), steps(k, 100));
  assert.equal(k.bitsOf(k.evaluate(call(isFailure, refutedOne), scope).value).bytes[0], 1);
  const nine = k.composedFunction([x], byte(k, 9));
  assert.equal(num(k, k.evaluate(call(handle, refutedOne, sd("refuted"), nine), scope).value), 9);
  assert.equal(num(k, k.evaluate(call(handle, call(kp("attempt"), byte(k, 3), steps(k, 100)), sd("refuted"), nine), scope).value), 3, "a value is itself");
});

// ---- A value that needs itself (found by the acceptance stream, 2026-11-20) ---

test("a binding that needs its own value is refuted, and a function or a structure that mentions itself is not", () => {
  const { k, add, mul, dec, isZero, call, kp } = setup();
  const [n, m, xs, fact] = [k.symbol("t.n"), k.symbol("t.m"), k.symbol("t.xs"), k.symbol("t.fact")];
  const p = k.param("p");
  // n = n + 1: before, this ran until the steps or the host's stack ran out.
  const self = k.evaluate(within(k, [[n, call(add, n, byte(k, 1))]], n), k.scope(), { steps: 1000 });
  assert.equal(self.ended, "complete", "it ends, and not at a limit");
  assert.equal(self.refuted, true);
  assert.match(k.reasonOf(self.value) ?? "", /needs itself/);
  assert.ok(self.steps < 20);
  // Through another binding: n = m + 1, m = n.
  const round = k.evaluate(within(k, [[n, call(add, m, byte(k, 1))], [m, call(add, n, byte(k, 0))]], n), k.scope(), { steps: 1000 });
  assert.equal(round.refuted, true);
  // A function that calls itself needs no value of its own to be made.
  const factFn = k.composedFunction([p], call(kp("if"), call(isZero, p), byte(k, 1), call(mul, p, call(fact, call(dec, p)))));
  assert.equal(num(k, k.evaluate(within(k, [[fact, factFn]], call(fact, byte(k, 5))), k.scope()).value), 120);
  // A structure whose entry mentions the structure: an entry is evaluated when read, so the structure is made first.
  const looped = k.evaluate(within(k, [[xs, k.structure([[null, byte(k, 1)], [null, xs]])]], call(kp("count"), xs)), k.scope());
  assert.equal(looped.refuted, false);
  assert.equal(k.bitsOf(looped.value).bytes[7], 2);
});

// ---- A stream is a value (B-203, 2026-11-20) ----------------------------------
//
// Nothing in the kernel is for streams. These tests hold that a structure whose entries
// are evaluated when read is one: {item, rest}, where reading the rest reads the source.

function streams() {
  const base = sayer();
  const { k, isZero, call, kp } = base;
  const cells: Value[] = [];
  // The host's operation: the next item, as a late answer. 0 stands for the end.
  const read = k.primitiveFunction({ purity: "effectful", capability: "source", part: "read", arity: 0, run: (_a, c) => (cells.push(c.cell()), cells[cells.length - 1]) });
  const [lines, r, each, s] = [k.symbol("t.lines"), k.symbol("t.r"), k.symbol("t.each"), k.param("s")];
  const sd = (name: string) => k.symbolData(name);
  // lines() = r <- read(); if r == 0 then [] else {item: r, rest: lines()}
  const linesFn = k.composedFunction(
    [],
    within(k, [[r, call(read)]], call(kp("if"), call(isZero, r), k.structure([]), k.structure([[k.symbol("item"), r], [k.symbol("rest"), call(lines)]]))),
  );
  const isEnd = (x: Value) => call(kp("same"), call(kp("count"), x), call(kp("count"), k.structure([])));
  // each(s) = if s is the end then [] else then(say(s.item), each(s.rest))
  const eachFn = k.composedFunction(
    [s],
    call(kp("if"), isEnd(s), k.structure([]), call(kp("then"), call(base.say, call(kp("get"), s, sd("item"))), call(each, call(kp("get"), s, sd("rest"))))),
  );
  const program = (body: Value) => within(k, [[lines, linesFn], [each, eachFn]], body);
  const answer = (n: number) => {
    const next = cells.findIndex((c) => !k.filled(c as never));
    k.fill(cells[next] as never, byte(k, n));
    return k.advance({ steps: 500 });
  };
  return { ...base, cells, lines, each, sd, program, answer, isEnd };
}

test("a stream backed by late answers is read one item at a time, in order, by need", () => {
  const { k, call, said, cells, lines, each, program, answer } = streams();
  k.evaluate(program(call(each, call(lines))), k.scope());
  assert.equal(cells.length, 1, "one read is in flight");
  assert.deepEqual(said, []);
  answer(7);
  assert.deepEqual(said, [7]);
  assert.equal(cells.length, 2, "the next read was asked for only when the rest was read");
  answer(8);
  answer(0);
  assert.deepEqual(said, [7, 8]);
  assert.equal(cells.length, 3, "the end was read, and nothing after it");
  assert.deepEqual(k.waiting(), []);
});

test("a stream is a value: read twice it gives the same items, and the source is read once", () => {
  const { k, add, call, kp, cells, lines, sd, program, answer } = streams();
  const st = k.symbol("t.st");
  const second = () => call(kp("get"), call(kp("get"), st, sd("rest")), sd("item"));
  // st = lines(); st.rest.item + st.rest.item
  const r = k.evaluate(program(within(k, [[st, call(lines)]], call(add, second(), second()))), k.scope());
  answer(5);
  answer(6);
  assert.equal(num(k, k.current(r.value)), 12, "the second item, twice");
  assert.equal(cells.length, 2, "two reads for two cells of the stream, though the second was read twice");
});

test("every entry of a list is started at once, and a then around them waits for all", () => {
  const { k, call, kp, said, say } = sayer();
  const cells: Value[] = [];
  const fetch = k.primitiveFunction({ purity: "effectful", capability: "net", part: "get", arity: 0, run: (_a, c) => (cells.push(c.cell()), cells[cells.length - 1]) });
  const xs = k.symbol("t.xs");
  const at = (i: number) => call(kp("get"), xs, byte(k, i));
  // xs = [fetch(), fetch()]; then(also(xs[0], xs[1]), say(xs[0] + xs[1]))
  const sum = call(k.primitiveFunction(pure("sum", 71, 2, (a, b) => a + b)), at(0), at(1));
  k.evaluate(within(k, [[xs, k.structure([[null, call(fetch)], [null, call(fetch)]])]], call(kp("then"), call(kp("also"), at(0), at(1)), call(say, sum))), k.scope());
  assert.equal(cells.length, 2, "both requests are in flight before either has answered");
  k.fill(cells[1] as never, byte(k, 2));
  k.advance({ steps: 200 });
  assert.deepEqual(said, [], "one answer is not all of them");
  k.fill(cells[0] as never, byte(k, 1));
  k.advance({ steps: 200 });
  assert.deepEqual(said, [3]);
  assert.equal(cells.length, 2, "each entry was evaluated once");
});
