// Tests of the saved-program data form (next/kernel/saved-program.ts):
// the check accepts a well-formed record and names each way a record can
// be wrong, and `load` makes constructing calls only. Run by
// `npm run test:next`.

import { test } from "node:test";
import assert from "node:assert/strict";
import type { Kernel, Value } from "./interface.js";
import { check, encode, load, type SavedProgram } from "./saved-program.js";

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
  assert.throws(() => load(kernel, edit((d) => (d.version = 2)) as SavedProgram, new Map()), /not a saved program/);
  assert.deepEqual(calls, []);
});
