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
  /** A delayed expression: a function of no parameters. */
  const delay = (body: Value) => k.composedFunction([], body);
  return { k, add, mul, dec, isZero, call, kp, delay };
}

test("the kernel is passive and states its interface", () => {
  const k = createKernel();
  assert.equal(k.interfaceVersion, 1);
  assert.deepEqual(k.waiting(), []);
  assert.deepEqual(k.advance(), { ended: "complete", steps: 0, refuted: [] });
  assert.deepEqual([...k.kernelPrimitiveNames()].sort(), ["attempt", "build", "claim", "describe", "if"]);
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
  const { k, mul, dec, isZero, call, kp, delay } = setup();
  const scope = k.scope();
  const n = k.param("n");
  const fact = k.symbol("m.fact");
  k.bind(scope, fact, k.composedFunction([n], call(kp("if"), call(isZero, n), delay(byte(k, 1)), delay(call(mul, n, call(fact, call(dec, n)))))));
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

test("the conditional calls only the branch taken, and waits when the condition is unknown", () => {
  const { k, add, call, kp, delay } = setup();
  let ran = 0;
  const mark = k.primitiveFunction({ purity: "effectful", capability: "probe", part: "mark", arity: 0, run: (_a, c) => (ran++, c.structure([])) });
  const scope = k.scope();
  const r1 = k.evaluate(call(kp("if"), truth(k, true), delay(byte(k, 1)), delay(call(mark))), scope);
  assert.equal(num(k, r1.value), 1);
  assert.equal(ran, 0, "the branch not taken is not called");
  const c = k.cell();
  const r2 = k.evaluate(call(kp("if"), c, delay(call(mark)), delay(call(add, byte(k, 1), byte(k, 1)))), scope);
  assert.equal(ran, 0, "neither branch is called while the condition is unknown");
  k.fill(c, truth(k, false));
  k.advance();
  assert.equal(num(k, k.current(r2.value)), 2);
  assert.equal(ran, 0);
  const r3 = k.evaluate(call(kp("if"), byte(k, 1), delay(byte(k, 1)), delay(byte(k, 2))), scope);
  assert.equal(r3.refuted, true, "a byte is not a truth value");
  assert.match(k.reasonOf(r3.value) ?? "", /neither true nor false/);
  const r4 = k.evaluate(call(kp("if"), truth(k, true), byte(k, 1), byte(k, 2)), scope);
  assert.match(k.reasonOf(r4.value) ?? "", /not a function of no parameters/, "a branch is a function, never bare text");
});

test("a branch gets more knowledge as an argument: it is a function of the name its condition tested", () => {
  // What a language's `if` form builds for:  if isZero(x) then use(x) else use(x)
  // where `use` wants to know which branch it is in. Nothing is rebound: the
  // branch is a function of x, and the form calls it with x and the fact.
  const { k, isZero, call, kp, delay } = setup();
  const tag = (fact: number) => k.primitiveFunction({ purity: "pure", hash: hash(20 + fact), name: `withFact${fact}`, arity: 1, run: (a, c) => c.structure([[null, a[0]], [null, c.bits(Uint8Array.of(fact))]]) });
  const [knownZero, knownNonZero] = [tag(1), tag(2)];
  const [x, v, thenFn, elseFn] = ["x", "v", "then", "else"].map((n) => k.param(n));
  const refiningIf = k.composedFunction([x, thenFn, elseFn], call(kp("if"), call(isZero, x), delay(call(thenFn, call(knownZero, x))), delay(call(elseFn, call(knownNonZero, x)))));
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
  const r = k.evaluate(k.structure([[null, call(f, call(kp("claim"), call(isZero, byte(k, 1))))]]), k.scope());
  assert.equal(r.refuted, true);
  assert.match(k.reasonOf(r.value) ?? "", /claim that is not true/);
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
  const { k, dec, isZero, call, kp, delay } = setup();
  const scope = k.scope();
  const n = k.param("n");
  const down = k.symbol("m.down");
  k.bind(scope, down, k.composedFunction([n], call(kp("if"), call(isZero, n), delay(byte(k, 0)), delay(call(down, call(dec, n))))));
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
  k.bind(scope, z, call(isZero, byte(k, 0)));
  k.evaluate(z, scope);
  const r = k.evaluate(call(kp("claim"), z), scope);
  assert.ok(k.restsOn(r.value).some((x) => x.kind === "primitive" && x.name === "isZero"), "though the binding was not evaluated again");
});

test("restore records an outcome under a builder's name, only where the kernel's own key matches", () => {
  const build = () => {
    const s = setup();
    const n = s.k.param("n");
    const claim = s.call(s.kp("claim"), s.call(s.isZero, n));
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
});

test("isCell tells a cell and a waiting name from other values", () => {
  const { k, add, call } = setup();
  const c = k.cell();
  assert.equal(k.isCell(c), true);
  assert.equal(k.isCell(byte(k, 1)), false);
  k.evaluate(call(add, k.symbol("m.later"), byte(k, 1)), k.scope());
  assert.equal(k.isCell(k.waiting()[0]), true);
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
  const { k, isZero, call, kp, delay } = setup();
  let wrote = 0;
  const write = k.primitiveFunction({ purity: "effectful", capability: "files", part: "write", arity: 1, run: (_a, c) => (wrote++, c.structure([])) });
  const p = k.param("p");
  // A narrowed capability: it writes only where its guard allows.
  const guarded = k.composedFunction([p], call(kp("if"), call(isZero, p), delay(call(write, p)), delay(k.structure([]))));
  const scope = k.scope();
  const d = k.evaluate(call(kp("describe"), k.inspectionRight(), guarded), scope).value;
  const condition = form(k, form(k, d).parts[1]);
  const thenBranch = form(k, k.entriesOf(condition.parts[1])[1][1]);
  const use = form(k, thenBranch.parts[1]);
  const named = form(k, use.parts[0]);
  assert.equal(named.form, "capability");
  assert.deepEqual(named.parts.map((v) => text(k, v)), ["files", "write"], "the description says which capability, and holds none");
  const rebuilt = k.evaluate(call(kp("build"), d), scope);
  assert.match(k.reasonOf(rebuilt.value) ?? "", /nothing makes authority from data/);
  // The part that applies the capability, cut out of its guard, cannot be built either.
  const cut = k.evaluate(call(kp("build"), k.entriesOf(condition.parts[1])[1][1]), scope);
  assert.equal(cut.refuted, true);
  assert.equal(wrote, 0);
});

test("a description of a function that holds no unforgeable value builds a function that does the same", () => {
  const { k, call, kp, ownKey, inc } = moduleWithFunction();
  const scope = k.scope();
  const d = k.evaluate(call(kp("describe"), ownKey, inc), scope).value;
  const built = k.evaluate(call(kp("build"), d), scope).value;
  assert.equal(k.kind(built), "composed-function");
  assert.notEqual(built, inc);
  assert.equal(num(k, k.evaluate(call(built, byte(k, 41)), scope).value), 42);
  assert.match(k.reasonOf(k.evaluate(call(kp("build"), byte(k, 1)), scope).value) ?? "", /not a description/);
  assert.match(k.reasonOf(k.evaluate(call(kp("build"), form(k, d).parts[0]), scope).value) ?? "", /not a description/);
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
  const { k, add, isZero, dec, call, kp, delay } = setup();
  const scope = k.scope();
  const tried = (body: Value, n = 1000) => form(k, k.evaluate(call(kp("attempt"), delay(body), steps(k, n)), scope).value);
  const ok = tried(call(add, byte(k, 1), byte(k, 2)));
  assert.equal(ok.form, "value");
  assert.equal(num(k, ok.parts[0]), 3);
  const bad = k.evaluate(call(kp("attempt"), delay(call(kp("claim"), call(isZero, byte(k, 5)))), steps(k, 1000)), scope);
  assert.equal(bad.refuted, false, "the attempt itself is not wrong");
  assert.equal(form(k, bad.value).form, "refuted");
  assert.match(text(k, form(k, bad.value).parts[0]), /claim that is not true/);

  const n = k.param("n");
  const down = k.symbol("m.down");
  k.bind(scope, down, k.composedFunction([n], call(kp("if"), call(isZero, n), delay(byte(k, 0)), delay(call(down, call(dec, n))))));
  assert.equal(tried(call(down, byte(k, 200)), 30).form, "limit");
  assert.equal(tried(call(down, byte(k, 200)), 30).form, "limit", "the same every time");
  assert.equal(tried(call(down, byte(k, 3)), 30).form, "value");
  // A search: try candidates until one satisfies a claim.
  const candidate = k.param("candidate");
  const fits = k.composedFunction([candidate], call(kp("attempt"), delay(call(kp("claim"), call(isZero, call(dec, candidate)))), steps(k, 100)));
  assert.deepEqual([0, 1, 2].map((c) => form(k, k.evaluate(call(fits, byte(k, c)), scope).value).form), ["refuted", "value", "refuted"]);
});

test("an attempt that waits is taken up again from where it stopped, so an effect inside is performed once", () => {
  const { k, add, call, kp, delay } = setup();
  let wrote = 0;
  const write = k.primitiveFunction({ purity: "effectful", capability: "output", part: "write", arity: 0, run: (_a, c) => (wrote++, c.bits(Uint8Array.of(1))) });
  const c = k.cell();
  const r = k.evaluate(call(kp("attempt"), delay(call(add, call(write), c)), steps(k, 100)), k.scope());
  assert.equal(k.kind(r.value), "expression", "it waits on the cell");
  assert.equal(wrote, 1);
  k.fill(c, byte(k, 4));
  k.advance();
  const done = form(k, k.current(r.value));
  assert.equal(done.form, "value");
  assert.equal(num(k, done.parts[0]), 5);
  assert.equal(wrote, 1, "the effect was not performed again");
});
