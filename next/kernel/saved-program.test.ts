// Tests of the saved-program data form (next/kernel/saved-program.ts):
// the check accepts a well-formed record and names each way a record can
// be wrong, and `load` makes constructing calls only. Run by
// `npm run test:next`.

import { test } from "node:test";
import assert from "node:assert/strict";
import type { Kernel, Value } from "./interface.js";
import { check, check2, encode, load, outcomeKeys, type SavedProgram } from "./saved-program.js";
import { createKernel } from "./kernel.js";

const ADD = "sha256:" + "ab".repeat(32);

// module(out, n) => out(add(n, 1))   — one capability, one input.
const good: SavedProgram = {
  format: "allegro-saved-program",
  version: 1,
  needs: [{ hash: ADD, name: "int.add" }],
  nodes: [
    { k: "param", name: "out" },
    { k: "param", name: "n" },
    { k: "primitive", hash: ADD },
    { k: "bits", hex: "01", bits: 8 },
    { k: "expression", fn: 2, args: [1, 3] },
    { k: "expression", fn: 0, args: [4] },
    { k: "function", params: [0, 1], body: 5 },
  ],
  module: 6,
  declares: [
    { param: 0, role: "capability", name: "output" },
    { param: 1, role: "input", name: "n" },
  ],
};

function edit(f: (doc: any) => void): unknown {
  const doc = JSON.parse(JSON.stringify(good));
  f(doc);
  return doc;
}

/** A stand-in kernel that records the name of every call made on it. */
function recorder(): { kernel: Kernel; calls: string[] } {
  const calls: string[] = [];
  let next = 0;
  const kernel = new Proxy({} as Kernel, {
    get: (_target, name) => (..._args: unknown[]) => {
      calls.push(String(name));
      return { id: next++ } as unknown as Value;
    },
  });
  return { kernel, calls };
}

test("a well-formed record passes, and survives encoding", () => {
  assert.deepEqual(check(good), []);
  assert.deepEqual(check(JSON.parse(encode(good))), []);
  assert.equal(encode(good).split("\n").filter((l) => l.startsWith('{"k":')).length, good.nodes.length);
});

test("the record has no way to say anything but a constructing call", () => {
  for (const k of ["evaluate", "bind", "fill", "scope", "limits", "restore", "cell"])
    assert.match(check(edit((d) => d.nodes.splice(3, 0, { k })))[0], /not a node of a known kind/);
  assert.match(check(edit((d) => (d.run = [])))[0], /unknown key "run"/);
  assert.match(check(edit((d) => (d.nodes[3].meta = {}))).join(), /unknown key "meta"/);
});

test("a node refers only to earlier nodes", () => {
  assert.match(check(edit((d) => (d.nodes[4].args = [1, 5]))).join(), /args\[1\] does not refer to an earlier node/);
  assert.match(check(edit((d) => (d.nodes[4].fn = 4))).join(), /fn does not refer to an earlier node/);
});

test("a primitive is named by a hash the record lists, and never otherwise", () => {
  assert.match(check(edit((d) => (d.needs = []))).join(), /hash is not listed in needs/);
  assert.match(check(edit((d) => (d.needs[0].hash = "int.add"))).join(), /not sha256/);
  assert.match(check(edit((d) => d.needs.push({ hash: "sha256:" + "cd".repeat(32), name: "x" }))).join(), /which no node uses/);
  assert.match(check(edit((d) => (d.nodes[2] = { k: "primitive", capability: "files" }))).join(), /unknown key "capability"/);
});

test("the module is a function, and its parameters are all declared", () => {
  assert.match(check(edit((d) => (d.module = 5))).join(), /module does not refer to a function node/);
  assert.match(check(edit((d) => d.declares.pop())).join(), /one entry for each parameter/);
  assert.match(check(edit((d) => (d.declares[0].role = "ambient"))).join(), /declares\[0\] is not/);
  assert.match(check(edit((d) => (d.declares[1].param = 0))).join(), /is not parameter 1/);
});

test("a param belongs to exactly one function", () => {
  assert.match(check(edit((d) => d.nodes.splice(2, 0, { k: "param", name: "stray" }))).join(), /param that no function lists/);
  const twice = edit((d) => {
    d.nodes.push({ k: "function", params: [0], body: 3 });
  });
  assert.match(check(twice).join(), /already a parameter of nodes\[6\]/);
});

test("bits carry a length that fits their hex", () => {
  assert.deepEqual(check(edit((d) => (d.nodes[3] = { k: "bits", hex: "01", bits: 1 }))), []);
  assert.deepEqual(check(edit((d) => (d.nodes[3] = { k: "bits", hex: "", bits: 0 }))), []);
  assert.match(check(edit((d) => (d.nodes[3] = { k: "bits", hex: "01", bits: 9 }))).join(), /does not fit/);
  assert.match(check(edit((d) => (d.nodes[3] = { k: "bits", hex: "0G", bits: 8 }))).join(), /not lowercase hex/);
});

test("load makes constructing calls only, one for each node it builds", () => {
  const { kernel, calls } = recorder();
  const add = { prim: "add" } as unknown as Value;
  const moduleFn = load(kernel, good, new Map([[ADD, add]]));
  assert.deepEqual(calls, ["param", "param", "bits", "expression", "expression", "composedFunction"]);
  assert.deepEqual(moduleFn, { id: 5 });
});

test("load refuses a record whose needs the kernel lacks, before any call", () => {
  const { kernel, calls } = recorder();
  assert.throws(() => load(kernel, good, new Map()), /lacks the primitive int.add/);
  assert.deepEqual(calls, []);
});

test("load refuses a document that is not a saved program", () => {
  const { kernel, calls } = recorder();
  assert.throws(() => load(kernel, edit((d) => (d.version = 3)) as SavedProgram, new Map()), /not a saved program/);
  assert.deepEqual(calls, []);
});

// ---- The second version: key slots and stored outcomes -------------------

// module(key, n) => claim(n == 0)   — one key slot, one input, one stored outcome.
const EQ0 = "sha256:" + "ee".repeat(32);
const draft: SavedProgram = {
  format: "allegro-saved-program",
  version: 2,
  needs: [{ hash: EQ0, name: "isZero" }],
  nodes: [
    { k: "param", name: "key" },
    { k: "param", name: "n" },
    { k: "primitive", hash: EQ0 },
    { k: "kernel", name: "claim" },
    { k: "expression", fn: 2, args: [1] },
    { k: "expression", fn: 3, args: [4] },
    { k: "structure", entries: [[null, 0], [null, 5]] },
    { k: "function", params: [0, 1], body: 6 },
  ],
  module: 7,
  declares: [{ param: 1, role: "input", name: "n" }],
  keys: 1,
  outcomes: [{ claim: 5, restsOn: [{ kind: "primitive", hash: EQ0, name: "isZero" }], key: "sha256:" + "00".repeat(32) }],
};
/** The record as a builder writes it: the kernel computes each outcome's key. */
const second: SavedProgram = (() => {
  const k = createKernel();
  const isZero = k.primitiveFunction({ purity: "pure", hash: EQ0, name: "isZero", arity: 1, run: (_a, c) => c.bits(Uint8Array.of(1), 1) });
  const [key] = outcomeKeys(k, draft, new Map([[EQ0, isZero]]));
  return { ...draft, outcomes: [{ ...draft.outcomes![0], key }] };
})();
const edit2 = (f: (doc: any) => void): unknown => {
  const doc = JSON.parse(JSON.stringify(second));
  f(doc);
  return doc;
};

test("the first version's check refuses a record of the second, and check2 accepts both", () => {
  assert.deepEqual(check2(second), []);
  assert.deepEqual(check2(good), []);
  assert.deepEqual(check2(JSON.parse(encode(second))), []);
  assert.match(check(second)[0], /version is not 1/);
  assert.match(check2(edit2((d) => (d.version = 3))).join(), /version is not 1 or 2/);
  assert.match(check2(edit((d) => (d.keys = 0))).join(), /unknown key "keys"/, "a first-version record has no key slots");
});

test("key slots are a count of the module function's first parameters, and are not declared", () => {
  assert.match(check2(edit2((d) => (d.keys = 3))).join(), /keys is not a count/);
  assert.match(check2(edit2((d) => (d.keys = 0))).join(), /one entry for each parameter/);
  assert.match(check2(edit2((d) => d.nodes.splice(1, 0, { k: "key", module: "x", slot: 0 }))).join(), /not a node of a known kind/, "a record never holds a key");
});

test("a stored outcome names a claim, and never rests on a capability", () => {
  assert.match(check2(edit2((d) => (d.outcomes[0].claim = 4))).join(), /does not refer to an application of the kernel primitive "claim"/);
  assert.match(check2(edit2((d) => d.outcomes[0].restsOn.push({ kind: "capability", capability: "http", part: "get" }))).join(), /never stored/);
  assert.match(check2(edit2((d) => d.outcomes[0].restsOn.push({ kind: "rumour" }))).join(), /not something a result rests on/);
  assert.match(check2(edit2((d) => delete d.outcomes[0].key)).join(), /key is not sha256/);
});

test("a stored outcome whose key the loading kernel does not compute is refused", () => {
  const k = createKernel();
  const isZero = k.primitiveFunction({ purity: "pure", hash: EQ0, name: "isZero", arity: 1, run: (_a, c) => c.bits(Uint8Array.of(1), 1) });
  const prims = new Map([[EQ0, isZero]]);
  assert.throws(() => load(k, draft, prims, { restoreAs: "b" }), /does not match/, "a made-up key");
  const moved = edit2((d) => (d.nodes[4] = { k: "expression", fn: 2, args: [0] })) as SavedProgram;
  assert.throws(() => load(k, moved, prims, { restoreAs: "b" }), /does not match/, "the claim was changed under its key");
  const regrounded = edit2((d) => (d.outcomes[0].restsOn = [])) as SavedProgram;
  assert.throws(() => load(k, regrounded, prims, { restoreAs: "b" }), /does not match/, "the grounds were changed under its key");
  assert.doesNotThrow(() => load(k, draft, prims), "with no builder named, the outcomes are not looked at");
});

function loaded(restoreAs?: string) {
  const k = createKernel();
  let ran = 0;
  const isZero = k.primitiveFunction({ purity: "pure", hash: EQ0, name: "isZero", arity: 1, run: (a, c) => (ran++, c.bits(Uint8Array.of(c.bitsOf(a[0]).bytes[0] === 0 ? 1 : 0), 1)) });
  const moduleFn = load(k, second, new Map([[EQ0, isZero]]), restoreAs === undefined ? {} : { restoreAs });
  // The record's body is a structure, and this caller reads every entry of it.
  const scope = k.scope();
  let result = k.evaluate(k.expression(moduleFn, [k.bits(Uint8Array.of(7))]), scope);
  for (const [, entry] of result.refuted ? [] : k.entriesOf(result.value)) {
    const e = k.evaluate(entry, scope);
    if (e.refuted) result = e;
  }
  return { k, moduleFn, result, ran: () => ran };
}

test("loading makes the module's keys from its content: the same in every kernel", () => {
  const a = loaded();
  const b = loaded();
  const keyA = a.k.keyOf(a.k.entriesOf(a.k.evaluate(a.k.expression(a.moduleFn, [a.k.bits(Uint8Array.of(0))]), a.k.scope()).value)[0][1]);
  const keyB = b.k.keyOf(b.k.entriesOf(b.k.evaluate(b.k.expression(b.moduleFn, [b.k.bits(Uint8Array.of(0))]), b.k.scope()).value)[0][1]);
  assert.deepEqual(keyA, keyB);
  assert.equal(keyA.slot, 0);
  assert.match(keyA.module, /^sha256:[0-9a-f]{64}$/);
  assert.equal(a.k.moduleOf(a.moduleFn), keyA.module);
});

test("without a builder named, a stored outcome is ignored and the claim is decided again", () => {
  const { result, ran } = loaded();
  assert.equal(result.refuted, true, "7 is not zero, whatever the record says");
  assert.equal(ran(), 1);
});

test("with a builder named, a stored outcome is restored: not evaluated, and resting on that builder", () => {
  const { k, result, ran } = loaded("build-server");
  assert.equal(result.refuted, false);
  assert.equal(ran(), 0, "the claim was not evaluated again");
  const claim = k.entriesOf(result.value)[1][1];
  assert.equal(k.outcomeOf(claim), "decided");
  assert.deepEqual(k.restsOn(claim), [{ kind: "builder", builder: "build-server" }, { kind: "primitive", hash: EQ0, name: "isZero" }]);
});

test("a record with key slots does not load on a kernel of the first version", () => {
  const { kernel } = recorder();
  assert.throws(() => load(kernel, second, new Map([[EQ0, {} as Value]])), /key slots, and this kernel is of the first version/);
});

test("a record of the second version holds a symbol as data and a block of bindings", () => {
  // The module's body:  block({x: `tag}, same(x, `tag))
  const doc = {
    format: "allegro-saved-program", version: 2, needs: [],
    nodes: [
      { k: "kernel", name: "block" },
      { k: "symbol", fqn: "m.x" },
      { k: "datum", fqn: "m.tag" },
      { k: "kernel", name: "same" },
      { k: "expression", fn: 3, args: [1, 2] },
      { k: "structure", entries: [[1, 2]] },
      { k: "expression", fn: 0, args: [5, 4] },
      { k: "function", params: [], body: 6 },
    ],
    module: 7, declares: [], keys: 0, outcomes: [],
  };
  assert.deepEqual(check2(doc), []);
  const k = createKernel();
  const moduleFn = load(k, doc as unknown as SavedProgram, new Map());
  const r = k.evaluate(k.expression(moduleFn, []), k.scope());
  assert.deepEqual(k.bitsOf(r.value), { bytes: Uint8Array.of(1), bitLength: 1 });
  // The first version has no symbol as data.
  const first = { ...doc, version: 1, keys: undefined, outcomes: undefined };
  delete (first as Record<string, unknown>).keys;
  delete (first as Record<string, unknown>).outcomes;
  assert.ok(check(first).some((f) => f.includes("needs version 2")));
});

test("a record whose module holds a free name does not load", () => {
  // The module's body:  host.output(session.password), neither declared nor bound.
  const doc = {
    format: "allegro-saved-program", version: 2, needs: [],
    nodes: [
      { k: "symbol", fqn: "host.output" },
      { k: "symbol", fqn: "session.password" },
      { k: "expression", fn: 0, args: [1] },
      { k: "function", params: [], body: 2 },
    ],
    module: 3, declares: [], keys: 0, outcomes: [],
  };
  assert.throws(() => load(createKernel(), doc as unknown as SavedProgram, new Map()), /free name\(s\) host\.output, session\.password/);
});
