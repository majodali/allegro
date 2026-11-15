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
import type { Kernel, PrimitiveDeclaration, Value } from "./interface.js";
import { createKernel, InterfaceError, refutationOf } from "./kernel.js";
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
  assert.deepEqual([...k.kernelPrimitiveNames()].sort(), ["claim", "if", "quote"]);
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

test("a structure's entries are evaluated, in order", () => {
  const { k, add, call } = setup();
  const r = k.evaluate(k.structure([[null, call(add, byte(k, 1), byte(k, 2))], [k.symbol("m.b"), byte(k, 9)]]), k.scope());
  const entries = k.entriesOf(r.value);
  assert.equal(num(k, entries[0][1]), 3);
  assert.equal(k.symbolName(entries[1][0] as Value), "m.b");
});

test("recursion on known arguments runs to its end", () => {
  const { k, mul, dec, isZero, call, kp } = setup();
  const scope = k.scope();
  const n = k.param("n");
  const fact = k.symbol("m.fact");
  k.bind(scope, fact, k.composedFunction([n], call(kp("if"), call(isZero, n), byte(k, 1), call(mul, n, call(fact, call(dec, n))))));
  assert.equal(num(k, k.evaluate(call(fact, byte(k, 5)), scope).value), 120);
});

test("a name may be used before it is bound: an unbound name is a residual, never a refutation", () => {
  const { k, add, call } = setup();
  const scope = k.scope();
  const a = k.symbol("m.a");
  const r = k.evaluate(call(add, a, byte(k, 1)), scope);
  assert.equal(r.refuted, false);
  assert.equal(k.kind(r.value), "expression");
  const waiting = k.waiting();
  assert.equal(waiting.length, 1);
  assert.equal(k.symbolName(waiting[0]), "m.a");
  assert.equal(k.filled(waiting[0]), false);
  k.bind(scope, a, byte(k, 41));
  assert.deepEqual(k.advance().refuted, []);
  assert.equal(num(k, k.current(r.value)), 42);
  assert.deepEqual(k.waiting(), []);
  assert.throws(() => k.bind(scope, a, byte(k, 0)), /already bound/);
});

test("a binding is an expression, evaluated when it is needed and in its own scope", () => {
  const { k, add, call } = setup();
  const outer = k.scope();
  const inner = k.scope(outer);
  const [a, b] = [k.symbol("m.a"), k.symbol("m.b")];
  k.bind(outer, b, call(add, a, byte(k, 1))); // b = a + 1, with a bound below it in the text
  k.bind(outer, a, byte(k, 10));
  k.bind(inner, a, byte(k, 99));
  assert.equal(num(k, k.evaluate(b, inner).value), 11, "b's own a, not the inner scope's");
  assert.equal(num(k, k.evaluate(a, inner).value), 99);
});

test("a function's free names mean what they meant where the function was evaluated", () => {
  const { k, add, call } = setup();
  const home = k.scope();
  const away = k.scope();
  const [x, f] = [k.symbol("m.x"), k.symbol("m.f")];
  const p = k.param("p");
  k.bind(home, x, byte(k, 1));
  k.bind(home, f, k.composedFunction([p], call(add, p, x)));
  const fValue = k.evaluate(f, home).value;
  k.bind(away, x, byte(k, 100));
  assert.equal(num(k, k.evaluate(call(fValue, byte(k, 1)), away).value), 2);
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

test("\"if\" evaluates only the branch taken, and waits when the condition is unknown", () => {
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
  assert.match(refutationOf(k, r3.value) ?? "", /neither true nor false/);
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
  const r = k.evaluate(k.structure([[null, call(f, call(kp("claim"), call(isZero, byte(k, 1))))]]), k.scope());
  assert.equal(r.refuted, true);
  assert.match(refutationOf(k, r.value) ?? "", /claim that is not true/);
});

test("a call on something that is not a function, or with the wrong number of arguments, is a refutation", () => {
  const { k, add, call } = setup();
  const r = k.evaluate(call(byte(k, 1), byte(k, 2)), k.scope());
  assert.equal(r.refuted, true);
  assert.match(refutationOf(k, r.value) ?? "", /not a function/);
  assert.equal(k.evaluate(call(add, byte(k, 1)), k.scope()).refuted, true);
  assert.equal(k.evaluate(call(k.composedFunction([], byte(k, 1)), byte(k, 2)), k.scope()).refuted, true);
});

test("\"quote\" hands a symbol on as data", () => {
  const { k, call, kp } = setup();
  const nameOf = k.primitiveFunction({
    purity: "pure", hash: hash(9), name: "nameLength", arity: 1,
    run: (args, c) => c.bits(Uint8Array.of(c.symbolName(args[0]).length)),
  });
  const s = k.symbol("m.unbound");
  const scope = k.scope();
  assert.equal(num(k, k.evaluate(call(nameOf, call(kp("quote"), s)), scope).value), 9);
  const x = k.param("x");
  const id = k.composedFunction([x], x);
  const r = k.evaluate(call(id, call(kp("quote"), s)), scope);
  assert.equal(k.kind(r.value), "symbol");
  assert.equal(k.symbolName(r.value), "m.unbound");
  assert.deepEqual(k.waiting(), [], "a quoted symbol is data and waits on nothing");
});

test("a step budget ends an evaluation the same way every time", () => {
  const { k, dec, isZero, call, kp } = setup();
  const scope = k.scope();
  const n = k.param("n");
  const down = k.symbol("m.down");
  k.bind(scope, down, k.composedFunction([n], call(kp("if"), call(isZero, n), byte(k, 0), call(down, call(dec, n)))));
  const full = k.evaluate(call(down, byte(k, 50)), scope);
  assert.equal(full.ended, "complete");
  const cut1 = k.evaluate(call(down, byte(k, 50)), scope, { steps: 40 });
  const cut2 = k.evaluate(call(down, byte(k, 50)), scope, { steps: 40 });
  assert.deepEqual([cut1.ended, cut1.steps, cut1.refuted], ["limit", 40, false]);
  assert.equal(cut2.steps, cut1.steps);
  assert.equal(k.evaluate(call(down, byte(k, 50)), scope, { steps: full.steps }).ended, "complete");
});

test("a recursion that never ends is ended by the budget, and is not a fault", () => {
  const { k, call } = setup();
  const scope = k.scope();
  const loop = k.symbol("m.loop");
  const n = k.param("n");
  k.bind(scope, loop, k.composedFunction([n], call(loop, n)));
  assert.equal(k.evaluate(call(loop, byte(k, 1)), scope, { steps: 500 }).ended, "limit");
  assert.equal(k.evaluate(call(loop, byte(k, 1)), scope).ended, "limit", "with no budget, the depth it can reach is the limit");
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
