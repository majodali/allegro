// Tests of the emitter of Allegretto (next/bootstrap/emit.ts). Each form
// emitted today is emitted, its record passes `check2`, and the record is
// loaded into the reference kernel (`createKernel` of
// next/kernel/create.ts) and evaluated through the kernel's interface.
// Each form that waits on the kernel stream gives its finding and no
// record. Run by `npm run test:next`.
//
// How a text is given an effect. A capability's part cannot be read yet
// (forms.md §4 item 3), so the texts here declare inputs, `input see` and
// its kin, and the test hands each input an effectful primitive function
// it makes through the kernel's interface. `see` records the value it is
// given, in the order the kernel performs it; `tick` records that it ran
// and answers the next whole number; `ask` answers with a cell the test
// fills later.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { spawnSync } from "child_process";
import type { Cell, Kernel2, Value } from "../kernel/interface.js";
import { createKernel } from "../kernel/create.js";
import { check2, encode, load, type SavedProgram } from "../kernel/saved-program.js";
import { launch } from "../launch/launcher.js";
import { output } from "../launch/output.js";
import { emit, FORMS, ITEMS, type Finding, type FormId } from "./emit.js";

const here = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(here, "../..");
const utf8 = new TextEncoder();

/** Emits a text that must emit, and checks its record. */
function emitted(text: string): SavedProgram {
  const r = emit(text);
  assert.ok(r.ok, `${JSON.stringify(text)} is not emitted: ${r.ok ? "" : r.findings.map((f) => f.message).join("; ")}`);
  const doc = JSON.parse(encode(r.program)) as SavedProgram;
  assert.deepEqual(check2(doc), []);
  return doc;
}

/** The findings of a text that must not emit. */
function findings(text: string): Finding[] {
  const r = emit(text);
  assert.equal(r.ok, false, `${JSON.stringify(text)} is emitted`);
  return r.ok ? [] : [...r.findings];
}

interface Run {
  readonly k: Kernel2;
  /** What the effects did, in the order the kernel performed them. */
  readonly events: Array<{ readonly part: string; readonly value?: Value }>;
  /** The cells `ask` answered with, in order. */
  readonly cells: Cell[];
  readonly value: Value;
  readonly refuted: boolean;
}

/** Emits a text, loads its record into a new reference kernel, and instantiates the module with the test's inputs. */
function run(text: string): Run {
  const doc = emitted(text);
  const k = createKernel();
  const events: Array<{ part: string; value?: Value }> = [];
  const cells: Cell[] = [];
  let ticks = 0;
  const effect = (part: string, arity: number, answer: (args: readonly Value[]) => Value): Value =>
    k.primitiveFunction({ purity: "effectful", capability: "test", part, arity, run: (args) => answer(args) });
  const inputs: Record<string, () => Value> = {
    see: () => effect("see", 1, ([v]) => {
      events.push({ part: "see", value: v });
      return k.structure([]);
    }),
    tick: () => effect("tick", 0, () => {
      events.push({ part: "tick" });
      return k.bits(Uint8Array.of(0, 0, 0, 0, 0, 0, 0, ++ticks));
    }),
    ask: () => effect("ask", 0, () => {
      events.push({ part: "ask" });
      const c = k.cell();
      cells.push(c);
      return c;
    }),
    right: () => k.inspectionRight(),
  };
  const fn = load(k, doc, new Map());
  const args = doc.declares.map((d) => {
    const make = inputs[d.name];
    assert.ok(make !== undefined, `the test supplies no input ${d.name}`);
    return make();
  });
  const r = k.evaluate(k.expression(fn, args), k.scope());
  assert.equal(r.ended, "complete");
  return { k, events, cells, value: r.value, refuted: r.refuted };
}

/** What `see` was given, read as the test expects it. */
const textOf = (k: Kernel2, v: Value | undefined): string => new TextDecoder().decode(k.bitsOf(v as Value).bytes);
const bitsOf = (k: Kernel2, v: Value | undefined): string => {
  const b = k.bitsOf(v as Value);
  return `${b.bitLength}:${Array.from(b.bytes, (x) => x.toString(16).padStart(2, "0")).join("")}`;
};
const seen = (r: Run): Value[] => r.events.filter((e) => e.part === "see").map((e) => e.value as Value);
const seenTexts = (r: Run): string[] => seen(r).map((v) => textOf(r.k, v));

// ── Values ─────────────────────────────────────────────────────────────

test("the four literals are bits: a text's UTF-8 bytes, 64 bits of a whole number or a fraction, one bit of a truth value", () => {
  const r = run('input see\nsee("hé")\nsee(42)\nsee(0xFF)\nsee(9223372036854775807)\nsee(1.5)\nsee(true)\nsee(false)');
  assert.deepEqual(seen(r).map((v) => bitsOf(r.k, v)), [
    `24:${Array.from(utf8.encode("hé"), (x) => x.toString(16).padStart(2, "0")).join("")}`,
    "64:000000000000002a",
    "64:00000000000000ff",
    "64:7fffffffffffffff",
    "64:3ff8000000000000",
    "1:01",
    "1:00",
  ]);
});

test("a structure literal is keyed by symbols; a list has no keys", () => {
  const r = run('input see\nsee({a: 1, b: "x"})\nsee([true, "y"])');
  const [s, l] = seen(r);
  const entries = r.k.entriesOf(s);
  assert.deepEqual(entries.map(([key]) => (key === null ? null : [r.k.kind(key), r.k.symbolName(key)])), [["symbol", "a"], ["symbol", "b"]]);
  assert.equal(textOf(r.k, entries[1][1]), "x");
  assert.deepEqual(r.k.entriesOf(l).map(([key, v]) => [key, r.k.kind(v)]), [[null, "bits"], [null, "bits"]]);
});

// ── Names, functions and application ───────────────────────────────────

test("a composed function and its application, of none, one and two parameters; a function as a value", () => {
  const r = run('input see\nsee((x => x)("one"))\nsee(((a, b) => b)("a", "two"))\nsee((() => "none")())\nsee((x => y => x)("outer")("inner"))');
  assert.deepEqual(seenTexts(r), ["one", "two", "none", "outer"]);
});

test("the pipe a |> f is f(a)", () => {
  assert.deepEqual(seenTexts(run('input see\n"piped" |> see\n"twice" |> (x => x) |> see')), ["piped", "twice"]);
});

// ── Control and claims ─────────────────────────────────────────────────

test("if c then a else b is the kernel's conditional: only the branch taken happens", () => {
  const r = run('input see\nsee(if true then "a" else "b")\nif false then see("not taken") else see("taken")');
  assert.deepEqual(seenTexts(r), ["a", "taken"]);
});

test("&&, || and ! are the conditional: the right side happens only when it is needed", () => {
  const r = run('input see\nsee(true && false)\nsee(false || true)\nsee(!true)\nsee(!false)\nfalse && see("no")\ntrue || see("no")\ntrue && see("yes")\nfalse || see("yes too")');
  assert.deepEqual(seen(r).slice(0, 4).map((v) => bitsOf(r.k, v)), ["1:00", "1:01", "1:00", "1:01"]);
  assert.deepEqual(seen(r).slice(4).map((v) => textOf(r.k, v)), ["yes", "yes too"]);
});

test("claim is the kernel's claim: a true one lets the module go on, and a refuted claim after a statement ends it there", () => {
  assert.deepEqual(seenTexts(run('input see\nclaim(true)\nsee("on")')), ["on"]);
  const r = run('input see\nsee("before")\nclaim(false)\nsee("after")');
  assert.deepEqual(seenTexts(r), ["before"]);
  assert.equal(r.refuted, true);
  assert.equal(r.k.reasonOf(r.value), "a claim that is not true");
});

test("the kernel primitives Allegretto names: then, attempt, describe and build", () => {
  const r = run('input see\ninput right\nthen(see("first"), see("second"))\nsee(attempt("tried", 100))\nsee(build(describe(right, x => x))("built"))');
  const [first, second, attempted, built] = seen(r);
  assert.deepEqual([textOf(r.k, first), textOf(r.k, second), textOf(r.k, built)], ["first", "second", "built"]);
  const [head, value] = r.k.entriesOf(attempted);
  assert.equal(r.k.symbolName(head[1]), "description.value");
  assert.equal(textOf(r.k, value[1]), "tried");
});

// ── Statements and x <- e ──────────────────────────────────────────────

test("a block's statements happen in written order: the module body is a chain of then", () => {
  const doc = emitted('input see\nsee("one")\nsee("two")\nsee("three")');
  assert.ok(doc.nodes.some((n) => n.k === "kernel" && n.name === "then"));
  assert.ok(!doc.nodes.some((n) => n.k === "structure" && n.entries.length > 0), "no statement is a structure's entry");
  assert.deepEqual(seenTexts(run('input see\nsee("one")\nsee("two")\nsee("three")')), ["one", "two", "three"]);
});

test("x <- e: e happens at its place, once, and x is its value for the rest of the block", () => {
  const r = run('input see\ninput tick\nsee("before")\nn <- tick()\nsee("after")\nsee(n)\nsee(n)');
  assert.deepEqual(r.events.map((e) => e.part), ["see", "tick", "see", "see", "see"]);
  assert.deepEqual(seen(r).slice(0, 2).map((v) => textOf(r.k, v)), ["before", "after"]);
  assert.deepEqual(seen(r).slice(2).map((v) => bitsOf(r.k, v)), ["64:0000000000000001", "64:0000000000000001"]);
  // Two in a row: each happens at its own place.
  const two = run("input see\ninput tick\na <- tick()\nb <- tick()\nsee(b)\nsee(a)");
  assert.deepEqual(seen(two).map((v) => bitsOf(two.k, v)), ["64:0000000000000002", "64:0000000000000001"]);
});

test("x <- e on an answer that arrives later: nothing after it is performed until the cell is filled", () => {
  const r = run('input see\ninput ask\nsee("first")\na <- ask()\nsee("after the answer")\nsee(a)');
  assert.deepEqual(seenTexts(r), ["first"]);
  assert.equal(r.cells.length, 1);
  r.k.fill(r.cells[0], r.k.bits(utf8.encode("answer")));
  r.k.advance();
  assert.deepEqual(seenTexts(r), ["first", "after the answer", "answer"]);
});

test("a block as a value: its last statement's value; an inner block may bind a name again", () => {
  const r = run('input see\nn <- "outer"\nm <-\n  n <- "inner"\n  see(n)\n  n\nsee(n)\nsee(m)');
  assert.deepEqual(seenTexts(r), ["inner", "outer", "inner"]);
});

// ── The module ────────────────────────────────────────────────────────

test("the header lines are the module function's parameters, in order, and declares names each with its role", () => {
  const doc = emitted("capability output\ninput see\nimport other");
  const fn = doc.nodes[doc.module];
  assert.equal(fn.k, "function");
  assert.deepEqual(doc.declares.map((d) => [d.role, d.name]), [["capability", "output"], ["input", "see"], ["module", "other"]]);
  assert.deepEqual(doc.declares.map((d) => d.param), fn.k === "function" ? fn.params : []);
});

test("the module yields the structure of its bindings: with none, an empty structure, after its statements", () => {
  const r = run('input see\nsee("done")');
  assert.equal(r.k.kind(r.value), "structure");
  assert.deepEqual(r.k.entriesOf(r.value), []);
  assert.deepEqual(seenTexts(r), ["done"]);
});

test("the emitted hello world, with output handed as an input, runs on the kernel as the launcher's fixture does", () => {
  const r = run('input see\nsee("hello, world")');
  assert.deepEqual(seenTexts(r), ["hello, world"]);
});

// ── Names ─────────────────────────────────────────────────────────────

test("a name nothing binds is refused, at the end of the text, wherever it is used", () => {
  const f = findings("input see\nsee(x)\nsee(y => z)");
  assert.deepEqual(f.map((x) => [x.kind, x.message]), [
    ["unbound", "the name x is bound nowhere in the text"],
    ["unbound", "the name z is bound nowhere in the text"],
  ]);
  assert.deepEqual([f[0].at.line, f[0].at.column], [2, 5]);
  // A name used before its x <- e line is not bound there: x <- e binds for the rest of the block.
  assert.deepEqual(findings("input see\nsee(n)\nn <- 1").map((x) => x.kind), ["unbound"]);
  // int.foo is no name of forms.md §3.
  assert.deepEqual(findings("input see\nsee(int.foo(1))").map((x) => x.message), ["the name int.foo is bound nowhere in the text"]);
});

test("a name bound twice in one block is refused; a parameter or an inner block may bind it again", () => {
  assert.deepEqual(findings("input see\nn <- 1\nn <- 2\nsee(n)").map((x) => x.kind), ["rebound"]);
  assert.deepEqual(findings("input see\nsee <- 1").map((x) => x.kind), ["rebound"]);
  assert.deepEqual(findings("input see\ninput see").map((x) => x.kind), ["rebound"]);
  assert.deepEqual(findings("input see\nsee((x, x) => x)").map((x) => x.kind), ["rebound"]);
  assert.deepEqual(findings("input see\nx = 1\nx <- 2").filter((x) => x.kind === "rebound").length, 1);
  assert.deepEqual(seenTexts(run('input see\nsee((see => see)("shadowed"))')), ["shadowed"]);
});

// ── What waits ────────────────────────────────────────────────────────

/** Each form that waits, a text that uses it, and the items of forms.md §4 its finding names. */
const WAITING: ReadonlyArray<readonly [FormId, string, readonly number[]]> = [
  ["binding", "x = 1", [1]],
  ["function binding", "f(x) => x", [1]],
  ["export", "export x = 1", [1]],
  ["== !=", "input see\nsee(1 == 1)", [2]],
  ["== !=", "input see\nsee(1 != 1)", [2]],
  ["++", 'input see\nsee("a" ++ "b")', [2]],
  ["bits name", "input see\nsee(bits.length(1))", [2]],
  ["entry by key", "input see\nsee({a: 1}.a)", [3]],
  ["entry at place", "input see\nsee([1][0])", [3]],
  ["capability part", 'capability output\noutput.write("hello, world")', [3]],
  ["integer operator", "input see\nsee(1 + 2)", [4]],
  ["integer operator", "input see\nsee(-1)", [4]],
  ["integer operator", "input see\nsee(1 < 2)", [4]],
  ["integer operator", "input see\nsee(7 / 2)", [4, 5]],
  ["shipped name", "input see\nsee(int.text(1))", [4]],
  ["shipped name", "input see\nsee(float.add(1.5, 2.5))", [4]],
  ["shipped name", 'input see\nsee(text.int("1"))', [4, 5]],
  ["symbol", "input see\nsee(`name)", []],
];

test("each form that waits gives its finding, naming the item of forms.md §4, and no record", () => {
  for (const [form, text, items] of WAITING) {
    const r = emit(text);
    assert.equal(r.ok, false, `${form}: ${JSON.stringify(text)} is emitted`);
    if (r.ok) continue;
    const f = r.findings.filter((x) => x.kind === "waits" && x.form === form);
    assert.equal(f.length, 1, `${form}: ${JSON.stringify(text)}: ${r.findings.map((x) => x.message).join("; ")}`);
    assert.deepEqual(f[0].items, items, form);
    for (const i of items) assert.ok(f[0].message.includes(`forms.md §4 item ${i} (${ITEMS[i as keyof typeof ITEMS]})`), f[0].message);
    if (items.length === 0) assert.match(f[0].message, /which forms\.md §4 does not list/);
    assert.ok(!("program" in r));
  }
});

test("every form of the table is tested, and the table says the same as the tests about what waits", () => {
  const waiting = new Set(WAITING.map(([form]) => form));
  for (const [form, info] of Object.entries(FORMS) as Array<[FormId, (typeof FORMS)[FormId]]>) {
    const waits = info.waits === null || info.waits.length > 0;
    assert.equal(waiting.has(form), waits, `${form}: the table says it ${waits ? "waits" : "is emitted"}`);
  }
});

test("what waits is absent from the kernel on this base: the table is checked against it", () => {
  const k = createKernel();
  // Items 2 and 3: the kernel's primitives are the six of today, none on bits and none that reads a structure.
  assert.deepEqual([...k.kernelPrimitiveNames()].sort(), ["attempt", "build", "claim", "describe", "if", "then"]);
  // Item 1: the data form has no node for a block of bindings.
  const withBindings = { format: "allegro-saved-program", version: 1, needs: [], nodes: [{ k: "bindings" }], module: 0, declares: [] };
  assert.ok(check2(withBindings).includes("nodes[0] is not a node of a known kind"));
  // Item 4: no shipped primitive exists yet.
  assert.equal(fs.existsSync(path.join(ROOT, "next/prims")), false);
  // The symbol literal: a symbol in an expression is a name, and an unbound one leaves a residual.
  const r = k.evaluate(k.expression(k.kernelPrimitive("claim"), [k.symbol("name")]), k.scope());
  assert.equal(r.refuted, false);
  assert.equal(k.kind(r.value), "expression");
  // What is emitted today, in the kernel: the conditional, the claim and sequence.
  for (const name of ["if", "claim", "then", "attempt", "describe", "build"]) assert.doesNotThrow(() => k.kernelPrimitive(name));
});

test("every finding of a text is given, each at its place, and the forms it uses are listed", () => {
  const r = emit('capability output\nx = 1\noutput.write(x + 1 == 2)');
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.deepEqual(r.findings.map((f) => [f.at.line, f.form]), [[2, "binding"], [3, "capability part"], [3, "integer operator"], [3, "== !="]]);
  assert.deepEqual(r.forms, ["== !=", "application", "binding", "capability", "capability part", "integer operator", "name", "whole number"]);
});

// ── The command ───────────────────────────────────────────────────────

test("npm run emit writes the record; a text it refuses prints each finding and exits 1", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "allegretto-emit-"));
  try {
    const good = path.join(dir, "good.alg");
    const bad = path.join(dir, "bad.alg");
    const out = path.join(dir, "good.json");
    fs.writeFileSync(good, 'input see\nsee("hi")\n');
    fs.writeFileSync(bad, "x = 1\nsee(y)\n");
    const ok = spawnSync(process.execPath, ["--import", "tsx", "next/bootstrap/emit.ts", good, "-o", out], { cwd: ROOT, encoding: "utf-8" });
    assert.equal(ok.status, 0, ok.stderr);
    assert.deepEqual(check2(JSON.parse(fs.readFileSync(out, "utf-8"))), []);
    const no = spawnSync(process.execPath, ["--import", "tsx", "next/bootstrap/emit.ts", bad], { cwd: ROOT, encoding: "utf-8" });
    assert.equal(no.status, 1);
    assert.deepEqual(no.stderr.trim().split("\n").map((l) => l.replace(bad, "bad.alg")), [
      "bad.alg:1:1: the binding x = … waits on forms.md §4 item 1 (the block of bindings)",
      "bad.alg:2:1: the name see is bound nowhere in the text",
      "bad.alg:2:5: the name y is bound nowhere in the text",
    ]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ── Waiting: the texts that run when the kernel stream supplies forms.md §4 ──

/** Emits a text and runs it through the launcher with the output capability. */
async function launched(text: string): Promise<{ lines: string[]; end: string }> {
  const r = emit(text);
  if (!r.ok) throw new Error(r.findings.map((f) => f.message).join("; "));
  const o = await launch({ createKernel, program: JSON.parse(encode(r.program)), configuration: { ceiling: ["output"], steps: 100_000 }, target: { capabilities: [output] } });
  return { lines: o.lines, end: o.end.kind };
}

test("waiting on forms.md §4 items 3 and the launcher: hello, world through the output capability's part", { todo: "waits on forms.md §4 item 3 (reading a structure) and the launcher's change" }, async () => {
  assert.deepEqual(await launched('capability output\noutput.write("hello, world")\n'), { lines: ["hello, world"], end: "completed" });
});

test("waiting on forms.md §4 item 1: a block of bindings, order-free", { todo: "waits on forms.md §4 item 1 (the block of bindings)" }, async () => {
  const text = 'capability output\ngreeting = join(hello, "world")\njoin(a, b) => a ++ ", " ++ b\nhello = "hello"\noutput.write(greeting)\n';
  assert.deepEqual(await launched(text), { lines: ["hello, world"], end: "completed" });
});

test("waiting on forms.md §4 items 1 to 4: recursion, one value with one identity", { todo: "waits on forms.md §4 items 1, 2, 3 and 4" }, async () => {
  const text = [
    "capability output",
    "count(n) => if n == 0 then \"done\" else count(n - 1)",
    "even(n) => if n == 0 then true else odd(n - 1)",
    "odd(n) => if n == 0 then false else even(n - 1)",
    "output.write(count(3))",
    "output.write(if even(10) then \"even\" else \"odd\")",
    "output.write(int.text(fact(5)))",
    "fact(n) => if n == 0 then 1 else n * fact(n - 1)",
  ].join("\n");
  assert.deepEqual(await launched(text), { lines: ["done", "even", "120"], end: "completed" });
});
