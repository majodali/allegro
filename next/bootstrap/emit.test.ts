// Tests of the emitter of Allegretto (next/bootstrap/emit.ts). Each form
// is emitted, its record passes `check2`, and the record is loaded into
// a kernel (`createKernel` of next/launch/kernel-variant.ts: the machine,
// and the reference where next/launch/reference.test.ts loads this file), with the
// shipped primitives its `needs` names, and evaluated through the kernel's
// interface. What the emitter refuses gives its finding and no record.
// Run by `npm run test:next`.
//
// How a text is given an effect. The texts here declare inputs, `input see`
// and its kin, and the test hands each input an effectful primitive
// function it makes through the kernel's interface. `see` records the
// value it is given, in the order the kernel performs it; `tick` records
// that it ran and answers the next whole number; `ask` answers with a cell
// the test fills later. The programs of milestone 3, run through the
// launcher with the output capability, are next/corpus/allegretto/m3/ and
// their test next/corpus/allegretto.test.ts.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { spawnSync } from "child_process";
import type { Cell, Kernel, Value } from "../kernel/interface.js";
import { createKernel } from "../launch/kernel-variant.js";
import { check2, encode, load, type SavedProgram } from "../kernel/saved-program.js";
import { launch } from "../launch/launcher.js";
import { output } from "../launch/output.js";
import { shippedByName } from "../prims/index.js";
import { emit, FAILURE_FUNCTIONS, STREAM_FUNCTIONS, FORMS, KERNEL_WRITTEN, SHIPPED_NAMES, withheldReason, type Finding, type FormId, type ImportedModule, type Imports } from "./emit.js";

const here = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(here, "../..");
const utf8 = new TextEncoder();

/** Emits a text that must emit, and checks its record. */
function emitted(text: string): SavedProgram {
  const r = emitTracked(text);
  assert.ok(r.ok, `${JSON.stringify(text)} is not emitted: ${r.ok ? "" : r.findings.map((f) => f.message).join("; ")}`);
  const doc = JSON.parse(encode(r.program)) as SavedProgram;
  assert.deepEqual(check2(doc), []);
  return doc;
}

/** Emits a text that imports, with the declarations and identity of each module it imports, and checks its record. */
function emittedWith(text: string, imports: Imports): SavedProgram {
  TEXTS.push([text, imports]);
  const r = emit(text, imports);
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
  readonly k: Kernel;
  /** What the effects did, in the order the kernel performed them. */
  readonly events: Array<{ readonly part: string; readonly value?: Value }>;
  /** The cells `ask` answered with, in order. */
  readonly cells: Cell[];
  readonly value: Value;
  readonly refuted: boolean;
}

/** The shipped primitives a record needs, made in a kernel, by hash. */
function primitivesFor(k: Kernel, doc: SavedProgram): Map<string, Value> {
  const byHash = new Map([...shippedByName.values()].map((p) => [p.hash, p] as const));
  return new Map(doc.needs.map((n) => [n.hash, k.primitiveFunction(byHash.get(n.hash)!)] as const));
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
  const fn = load(k, doc, primitivesFor(k, doc));
  const args = doc.declares.map((d) => {
    const make = inputs[d.name];
    assert.ok(make !== undefined, `the test supplies no input ${d.name}`);
    return make();
  });
  const r = k.evaluate(k.expression(fn, args), { steps: 100_000 });
  assert.equal(r.ended, "complete");
  return { k, events, cells, value: r.value, refuted: r.refuted };
}

/** What `see` was given, read as the test expects it. */
const textOf = (k: Kernel, v: Value | undefined): string => new TextDecoder().decode(k.bitsOf(v as Value).bytes);
const bitsOf = (k: Kernel, v: Value | undefined): string => {
  const b = k.bitsOf(v as Value);
  return `${b.bitLength}:${Array.from(b.bytes, (x) => x.toString(16).padStart(2, "0")).join("")}`;
};
const seen = (r: Run): Value[] => r.events.filter((e) => e.part === "see").map((e) => e.value as Value);
const seenTexts = (r: Run): string[] => seen(r).map((v) => textOf(r.k, v));
/** A whole number of 64 bits, read as two's complement. */
const intOf = (k: Kernel, v: Value | undefined): bigint => {
  const { bytes } = k.bitsOf(v as Value);
  return new DataView(bytes.buffer, bytes.byteOffset, 8).getBigInt64(0);
};
const seenInts = (r: Run): bigint[] => seen(r).map((v) => intOf(r.k, v));
/** The texts the emitter is run on in this file, each with what it imports, for the test that every form is written. */
const TEXTS: Array<readonly [string, Imports]> = [];
const emitTracked = (text: string) => {
  TEXTS.push([text, new Map()]);
  return emit(text);
};

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
  // build takes the description and the values for the names it leaves free
  // ("A free name never gets a value"); here it leaves none.
  const text = 'input see\ninput right\nthen(see("first"), see("second"))\nsee(attempt("tried", 100))\nsee(build(describe(right, x => x), {})("built"))';
  const r = run(text);
  const [first, second, attempted, built] = seen(r);
  assert.deepEqual([textOf(r.k, first), textOf(r.k, second), textOf(r.k, built)], ["first", "second", "built"]);
  // What an attempt answers is the kernel's to state, and its own tests hold
  // it (ruled 2026-11-19: the value itself, or a failure). This test holds
  // what the emitter owes: `attempt` is written as the kernel's primitive of
  // that name, the run goes on past it, and the call answers something.
  assert.ok(emitted(text).nodes.some((n) => n.k === "kernel" && n.name === "attempt"), "the record names the kernel primitive attempt");
  assert.equal(r.refuted, false);
  assert.notEqual(attempted, undefined);
});

test("first is the kernel's primitive by its name: its value is that of the argument known at once", () => {
  const text = 'input see\nsee(first("one", "two"))';
  assert.ok(emitted(text).nodes.some((n) => n.k === "kernel" && n.name === "first"));
  assert.deepEqual(seenTexts(run(text)), ["one"]);
});

// ── Statements and x <- e ──────────────────────────────────────────────

test("a block's statements are started in written order: the module body is a chain of also", () => {
  const doc = emitted('input see\nsee("one")\nsee("two")\nsee("three")');
  assert.ok(doc.nodes.some((n) => n.k === "kernel" && n.name === "also"));
  assert.ok(!doc.nodes.some((n) => n.k === "structure" && n.entries.length > 0), "no statement is a structure's entry");
  assert.deepEqual(seenTexts(run('input see\nsee("one")\nsee("two")\nsee("three")')), ["one", "two", "three"]);
});

test("sync before an indented block makes its statements a chain of then", () => {
  const doc = emitted('input see\nrun() => sync\n  see("one")\n  see("two")\nrun()');
  const fn = doc.nodes.find((n) => n.k === "function" && n.params.length === 0);
  assert.ok(fn !== undefined && fn.k === "function");
  const body = doc.nodes[fn.body];
  assert.ok(body.k === "expression" && doc.nodes[body.fn].k === "kernel" && (doc.nodes[body.fn] as { name: string }).name === "then", "the sync block's chain is of then");
  assert.deepEqual(seenTexts(run('input see\nrun() => sync\n  see("one")\n  see("two")\nrun()')), ["one", "two"]);
  // sync may stand after =, => and <-.
  assert.deepEqual(seenTexts(run('input see\nx = sync\n  see("a")\n  1\ny <- sync\n  see("b")\n  x\nsee(int.text(y))')), ["b", "a", "1"]);
});

test("a statement whose value is dropped is a claim that it is no failure: claim(!is_failure(a))", () => {
  const failing = 'input see\nsee("before")\n{failure: `nope}\nsee("after")';
  const r = run(failing);
  assert.deepEqual(seenTexts(r), ["before"]);
  assert.equal(r.refuted, true);
  const doc = emitted(failing);
  const claim = doc.nodes.findIndex((n) => n.k === "kernel" && n.name === "claim");
  assert.equal(doc.nodes.filter((n) => n.k === "expression" && n.fn === claim).length, 3, "each of the three statements is dropped: the module's value is the structure it yields");
  // A failure bound with <-, and a block's last statement, are the program's own: no claim.
  const kept = run('input see\nr <- {failure: `nope}\nsee(if is_failure(r) then "looked at" else "no")\nf() =>\n  see("inner")\n  {failure: `given}\nv <- f()\nsee(spelling(v.failure))');
  assert.deepEqual(seenTexts(kept), ["looked at", "inner", "given"]);
  assert.equal(kept.refuted, false);
  // A statement that is itself a claim needs none of its own.
  const one = emitted("input see\nclaim(true)\nsee(1)");
  const c = one.nodes.findIndex((n) => n.k === "kernel" && n.name === "claim");
  assert.equal(one.nodes.filter((n) => n.k === "expression" && n.fn === c).length, 2);
});

test("a dropped statement whose answer has not come holds what is written after it", () => {
  const r = run('input see\ninput ask\nsee("first")\nask()\nsee("after the answer")');
  assert.deepEqual(seenTexts(r), ["first"]);
  r.k.fill(r.cells[0], r.k.bits(utf8.encode("answer")), { hold: true });
  r.k.advance();
  assert.deepEqual(seenTexts(r), ["first", "after the answer"]);
});

test("is_failure and handle are Allegretto's functions: bound for every text, and hidden where a text binds the name again", () => {
  const r = run('input see\nsee(is_failure({failure: `x}))\nsee(is_failure([]))\nsee(is_failure({a: 1}))\nsee(is_failure(1))\nsee(handle({failure: `x, n: 2}, `x, f => f.n))\nsee(handle(3, `x, f => 0))');
  assert.deepEqual(seen(r).slice(0, 4).map((v) => bitsOf(r.k, v)), ["1:01", "1:00", "1:00", "1:00"]);
  assert.deepEqual(seen(r).slice(4).map((v) => intOf(r.k, v)), [2n, 3n]);
  const hidden = run('input see\nhandle(x, a, b) => "the text\'s own"\nsee(handle(1, 2, 3))\nsee(is_failure(1))');
  assert.equal(textOf(hidden.k, seen(hidden)[0]), "the text's own");
  // A text that uses neither name carries no block that binds them.
  assert.ok(!emitted('input see\nsee("x")').nodes.some((n) => n.k === "symbol" && n.fqn === "is_failure"));
});

test("the failure functions the emitter keeps are the text of forms.md, section Failures", () => {
  const forms = fs.readFileSync(path.join(ROOT, "next/ext/allegretto/forms.md"), "utf8");
  const section = forms.slice(forms.indexOf("### Failures"), forms.indexOf("### The module"));
  const blocks = [...section.matchAll(/```\n([\s\S]*?)```/g)].map((m) => m[1]);
  const definitions = blocks.find((t) => t.startsWith("is_failure(x) =>"));
  assert.ok(definitions !== undefined, "forms.md writes is_failure and handle in one block");
  assert.equal(FAILURE_FUNCTIONS, definitions);
});

test("the stream functions the emitter keeps are the text of forms.md, section Streams", () => {
  const forms = fs.readFileSync(path.join(ROOT, "next/ext/allegretto/forms.md"), "utf8");
  const section = forms.slice(forms.indexOf("### Streams"));
  const blocks = [...section.matchAll(/```\n([\s\S]*?)```/g)].map((m) => m[1]);
  const definitions = blocks.find((t) => t.startsWith("each(s, f) =>"));
  assert.ok(definitions !== undefined, "forms.md writes each, each_at_once, each_within and all in one block");
  assert.equal(STREAM_FUNCTIONS, definitions);
});

test("each, each_at_once, each_within and all are Allegretto's functions for iteration; the helpers they are written with are no names of a text", () => {
  const stream = "from(n, last) => if n > last then [] else {item: n, rest: from(n + 1, last)}";
  // each: one item at a time, in order; its value is [] at a stream's end, and the failure a stream ends in.
  const r = run(`input see\n${stream}\nend <- each(from(1, 3), see)\nsee(count(end))\nbroken <- each({item: 9, rest: {failure: \`closed}}, see)\nsee(is_failure(broken))`);
  assert.deepEqual(seenInts({ ...r, events: r.events.slice(0, 4) }), [1n, 2n, 3n, 0n]);
  assert.deepEqual(bitsOf(r.k, seen(r)[4]), "64:0000000000000009");
  assert.deepEqual(bitsOf(r.k, seen(r)[5]), "1:01");
  // The other three, each on a short stream or list.
  assert.deepEqual(seenInts(run(`input see\n${stream}\neach_at_once(from(4, 5), see)`)), [4n, 5n]);
  assert.deepEqual(seenInts(run(`input see\n${stream}\neach_within(from(6, 9), 2, see)`)), [6n, 7n, 8n, 9n]);
  assert.deepEqual(seenInts(run("input see\nxs = all([1 + 1, 3])\nsee(xs[0] + xs[1])")), [5n]);
  // A helper of the forms' text is not a name a text may use, and a text may bind any of the names itself.
  assert.deepEqual(findings("input see\nsee(window([], 1, see, []))").map((x) => [x.kind, x.message]), [["unbound", "the name window is bound nowhere in the text"]]);
  assert.deepEqual(seenInts(run("input see\ngo(n) => n + 1\neach(s, f) => 41\nsee(go(each(1, 2)))")), [42n]);
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

test("x <- e on an answer that arrives later holds nothing: only what uses its value waits for the cell; in a sync block all after it waits", () => {
  const r = run('input see\ninput ask\nsee("first")\na <- ask()\nsee("not held")\nsee(a)');
  assert.deepEqual(seenTexts(r), ["first", "not held"]);
  assert.equal(r.cells.length, 1);
  r.k.fill(r.cells[0], r.k.bits(utf8.encode("answer")), { hold: true });
  r.k.advance();
  assert.deepEqual(seenTexts(r), ["first", "not held", "answer"]);
  const s = run('input see\ninput ask\nrun() => sync\n  see("first")\n  a <- ask()\n  see("after the answer")\n  see(a)\nrun()');
  assert.deepEqual(seenTexts(s), ["first"]);
  s.k.fill(s.cells[0], s.k.bits(utf8.encode("answer")), { hold: true });
  s.k.advance();
  assert.deepEqual(seenTexts(s), ["first", "after the answer", "answer"]);
});

test("a block as a value: its last statement's value; an inner block may bind a name again", () => {
  const r = run('input see\nn <- "outer"\nm <-\n  n <- "inner"\n  see(n)\n  n\nsee(n)\nsee(m)');
  assert.deepEqual(seenTexts(r), ["inner", "outer", "inner"]);
});

// ── The module ────────────────────────────────────────────────────────

test("the header lines are the module function's parameters, in order, and declares names each with its role", () => {
  const other: ImportedModule = { declares: [], identity: "sha256:" + "ab".repeat(32) };
  const doc = emittedWith("capability output\ninput see\nimport other", new Map([["other", other]]));
  const fn = doc.nodes[doc.module];
  assert.equal(fn.k, "function");
  assert.deepEqual(doc.declares.map((d) => [d.role, d.name]), [["capability", "output"], ["input", "see"], ["module", "other"]]);
  assert.deepEqual(doc.declares.map((d) => d.param), fn.k === "function" ? fn.params : []);
});

test("a capability's part is read as an entry: output.write is get(output, `write)", () => {
  const doc = emitted('capability output\noutput.write("hello, world")');
  const get = doc.nodes.findIndex((n) => n.k === "kernel" && n.name === "get");
  const write = doc.nodes.findIndex((n) => n.k === "datum" && n.fqn === "write");
  const fn = doc.nodes[doc.module];
  assert.ok(fn.k === "function");
  assert.ok(doc.nodes.some((n) => n.k === "expression" && n.fn === get && n.args[0] === fn.params[0] && n.args[1] === write));
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
  // A statement above x <- e that needs x is refused by the reader: it would start e before its place.
  assert.deepEqual(findings("input see\nsee(n)\nn <- 1").map((x) => [x.kind, x.message]), [
    ["read", "the statement at 2:1 needs n, which n <- … binds below it at 3:1: it would start that line's value before its place"],
  ]);
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

// ── Bindings and blocks ───────────────────────────────────────────────

test("a block's bindings are one group: a binding may be used before its line, and the record is the kernel's block", () => {
  const text = 'input see\ngreeting = join(hello, "world")\njoin(a, b) => a ++ ", " ++ b\nhello = "hello"\nsee(greeting)';
  const doc = emitted(text);
  assert.ok(doc.nodes.some((n) => n.k === "kernel" && n.name === "block"));
  assert.ok(!doc.nodes.some((n) => (n.k as string) === "bindings"));
  assert.deepEqual(seenTexts(run(text)), ["hello, world"]);
});

test("a block's name is a symbol the kernel looks up, and a function's parameter is its param node", () => {
  const doc = emitted("input see\nf(x) => x\nsee(f(1))");
  const fn = doc.nodes.find((n) => n.k === "function" && n.params.length === 1 && doc.nodes[n.params[0]].k === "param" && (doc.nodes[n.params[0]] as { name: string }).name === "x");
  assert.ok(fn !== undefined && fn.k === "function");
  assert.deepEqual(doc.nodes[fn.body], { k: "param", name: "x" }, "the parameter x is its param node");
  assert.ok(doc.nodes.some((n) => n.k === "symbol" && n.fqn === "f"), "the name f is a symbol");
  assert.ok(!doc.nodes.some((n) => n.k === "symbol" && n.fqn === "x"));
  assert.ok(!doc.nodes.some((n) => n.k === "symbol" && n.fqn === "see"), "a header line is a parameter of the module function");
});

test("a binding is evaluated when first needed and once; a binding nothing needs is never evaluated when it is not yielded", () => {
  const r = run('input see\nlater = see("needed")\nunused = see("never")\nexport shown = "x"\nsee("first")\nlater\nlater\nsee("last")');
  assert.deepEqual(seenTexts(r), ["first", "needed", "last"]);
});

test("recursion is one value with one identity, and two functions may call each other", () => {
  const text = [
    "input see",
    'count(n) => if n == 0 then "done" else count(n - 1)',
    "even(n) => if n == 0 then true else odd(n - 1)",
    "odd(n) => if n == 0 then false else even(n - 1)",
    "see(count(3))",
    'see(if even(10) then "even" else "odd")',
    "see(int.text(fact(5)))",
    "fact(n) => if n == 0 then 1 else n * fact(n - 1)",
  ].join("\n");
  assert.deepEqual(seenTexts(run(text)), ["done", "even", "120"]);
});

test("an inner block binds its own names; a name there means the innermost block's binding", () => {
  const r = run('input see\na = "outer"\nb <-\n  a = "inner"\n  a\nsee(b)\nsee(a)');
  assert.deepEqual(seenTexts(r), ["inner", "outer"]);
});

test("x <- e is a binding of its block's one group: block({…, x: e}, … also(x, rest)), and a binding before or after it may use x", () => {
  const r = run("input see\ninput tick\nbefore = n * 10\nn <- tick()\nafter = n + 1\nsee(after)\nsee(before)");
  assert.deepEqual(seenInts(r), [2n, 10n]);
  assert.deepEqual(r.events.map((e) => e.part), ["tick", "see", "see"]);
  const doc = emitted("input see\nn <- 1\nm = 2\nsee(n)");
  const block = doc.nodes.findIndex((n) => n.k === "kernel" && n.name === "block");
  const n = doc.nodes.findIndex((x) => x.k === "symbol" && x.fqn === "n");
  const m = doc.nodes.findIndex((x) => x.k === "symbol" && x.fqn === "m");
  const group = doc.nodes.find((x) => x.k === "structure" && x.entries.some(([key]) => key === n));
  assert.ok(group !== undefined && group.k === "structure" && group.entries.some(([key]) => key === m), "n and m are bound in one group");
  assert.equal(doc.nodes.filter((x) => x.k === "expression" && x.fn === block).length, 1, "x <- e opens no block of its own");
  // A statement above the arrow that needs the name through a binding is refused too.
  assert.match(findings("input see\nshow() => see(n)\nshow()\nn <- 1").map((x) => x.message).join(), /needs n, which n <- … binds below it/);
});

// ── Operators, bits and reading a structure ───────────────────────────

test("the integer operators are the shipped primitives, at their precedence, grouping to the left", () => {
  const r = run("input see\nsee(1 + 2 * 3)\nsee(10 - 3 - 2)\nsee(7 / 2)\nsee(-7 % 3)\nsee(-(2 + 3))\nsee(9223372036854775807 + 1)");
  assert.deepEqual(seenInts(r), [7n, 5n, 3n, -1n, -5n, -(2n ** 63n)]);
  const t = run("input see\nsee(1 < 2)\nsee(2 > 2)\nsee(2 <= 2)\nsee(1 >= 2)\nsee(1 + 1 == 2 && 3 < 4)");
  assert.deepEqual(seen(t).map((v) => bitsOf(t.k, v)), ["1:01", "1:00", "1:01", "1:00", "1:01"]);
});

test("the record's needs are exactly the shipped primitives the text uses, each by the hash shippedByName gives", () => {
  const doc = emitted("input see\nsee(int.text(1 + 2 * -3))\nsee(1 + 1)");
  assert.deepEqual(doc.needs, ["int.add", "int.mul", "int.neg", "int.text"].map((n) => ({ hash: shippedByName.get(n)!.hash, name: n })));
  assert.deepEqual(emitted('input see\nsee("no arithmetic")').needs, []);
  for (const name of SHIPPED_NAMES) assert.ok(shippedByName.has(name), `forms.md §3 names ${name}, and next/prims ships it`);
});

test("every name of forms.md §3 is the shipped primitive of that name", () => {
  const r = run([
    "input see",
    'see(int.text(int.add(1, 2)))', 'see(int.text(int.sub(1, 2)))', 'see(int.text(int.mul(3, 2)))', 'see(int.text(int.neg(4)))',
    'see(int.text(int.div(9, 2)))', 'see(int.text(int.mod(9, 2)))', 'see(int.text(text.int("-12")))',
    'see(float.text(float.add(1.5, 2.25)))', 'see(float.text(float.sub(1.5, 2.0)))', 'see(float.text(float.mul(1.5, 2.0)))',
    'see(float.text(float.div(1.0, 4.0)))', 'see(float.text(float.neg(1.5)))', 'see(float.text(int.float(3)))', 'see(int.text(float.int(2.75)))',
  ].join("\n"));
  assert.deepEqual(seenTexts(r), ["3", "-1", "6", "-4", "4", "1", "-12", "3.75", "-0.5", "3", "0.25", "-1.5", "3", "2"]);
  const c = run("input see\nsee(int.lt(1, 2))\nsee(int.gt(1, 2))\nsee(int.le(2, 2))\nsee(int.ge(1, 2))\nsee(float.lt(1.0, 2.0))\nsee(float.le(2.5, 2.0))");
  assert.deepEqual(seen(c).map((v) => bitsOf(c.k, v)), ["1:01", "1:00", "1:01", "1:00", "1:01", "1:00"]);
});

test("== is same, != its negation, and ++ joins: on texts and on numbers", () => {
  const r = run('input see\nsee("ab" == "ab")\nsee("ab" == "abc")\nsee(2 == 2)\nsee(1 == 1.0)\nsee(2 != 3)\nsee("a" != "a")');
  assert.deepEqual(seen(r).map((v) => bitsOf(r.k, v)), ["1:01", "1:00", "1:01", "1:00", "1:01", "1:00"]);
  assert.deepEqual(seenTexts(run('input see\nsee("hello" ++ ", " ++ "world")')), ["hello, world"]);
  const s = run("input see\nsee({a: 1} == {a: 1})");
  assert.equal(s.refuted, true, "two structures are not compared: a refutation");
});

test("bits.join, bits.length and bits.slice are the kernel's join, length and slice", () => {
  const r = run('input see\nsee(bits.join("ab", "c"))\nsee(bits.slice("abc", 8, 16))');
  assert.deepEqual(seenTexts(r), ["abc", "bc"]);
  const l = run('input see\nsee(bits.length("abc"))');
  assert.deepEqual(seenInts(l), [24n]);
});

test("p.a reads the entry keyed by the symbol a, p[i] the entry at place i, and get and count are the kernel's", () => {
  const r = run('input see\np = {a: "first", b: "second"}\nsee(p.b)\nsee(p[0])\nsee(get(p, `a))\nsee(["x", "y", "z"][2])');
  assert.deepEqual(seenTexts(r), ["second", "first", "first", "z"]);
  assert.deepEqual(seenInts(run("input see\nsee(count([1, 2, 3]))")), [3n]);
  const out = run("input see\nsee([1][1])");
  assert.equal(out.refuted, true);
  assert.equal(out.k.reasonOf(out.value), "place 1 is outside a structure of 1 entry");
});

test("the symbol literal is the symbol as data, in a record of the second version", () => {
  const doc = emitted("input see\nsee(`name)");
  assert.equal(doc.version, 2);
  assert.ok(doc.nodes.some((n) => n.k === "datum" && n.fqn === "name"));
  const r = run("input see\nsee(`name)\nsee(`a == `a)\nsee(`a == `b)");
  assert.equal(r.k.kind(seen(r)[0]), "symbol");
  assert.equal(r.k.symbolName(seen(r)[0]), "name");
  assert.deepEqual(seen(r).slice(1).map((v) => bitsOf(r.k, v)), ["1:01", "1:00"]);
});

test("every record is of the second version, with no key slots and no stored outcomes", () => {
  const doc = emitted('input see\nsee("no key read")');
  assert.equal(doc.version, 2);
  assert.equal(doc.keys, 0);
  assert.deepEqual(doc.outcomes, []);
});

test("a primitive outside its domain is a refutation with its reason", () => {
  const r = run('input see\nsee("before")\nsee(1 / 0)\nsee("after")');
  assert.deepEqual(seenTexts(r), ["before"]);
  assert.equal(r.refuted, true);
  assert.equal(r.k.reasonOf(r.value), "division by zero");
});

// ── Data, keys and the four structures ───────────────────────────────

test("the five names for data are the kernel's put, key, kind, symbol and spelling, and range is the forms' recursion", () => {
  const r = run([
    "input see",
    "range(n) => if n == 0 then [] else put(range(n - 1), [], n)",
    "see(count(range(3)))",
    "see(get(range(3), 2))",
    "s = put({a: 1}, `b, 2)",
    "see(spelling(key(s, 1)))",
    "see(kind(s) == `structure && kind(1) == `bits && kind(`a) == `symbol && kind(range) == `function)",
    "see(get(s, symbol(\"a\")))",
  ].join("\n"));
  assert.deepEqual(seen(r).slice(0, 2).map((v) => intOf(r.k, v)), [3n, 3n]);
  assert.equal(textOf(r.k, seen(r)[2]), "b");
  assert.equal(bitsOf(r.k, seen(r)[3]), "1:01");
  assert.equal(intOf(r.k, seen(r)[4]), 1n);
  const doc = emitted("input see\nsee(kind(put([], [], 1)))\nsee(spelling(symbol(\"x\")))\nsee(key([1], 0))");
  for (const name of ["put", "key", "kind", "symbol", "spelling"]) assert.ok(doc.nodes.some((n) => n.k === "kernel" && n.name === name), name);
});

test("refuse, assume and undecided are the kernel's primitives of those names", () => {
  const r = run('input see\nsee("before")\nsee(refuse("no further"))\nsee("after")');
  assert.deepEqual(seenTexts(r), ["before"]);
  assert.equal(r.refuted, true);
  assert.equal(r.k.reasonOf(r.value), "no further");
  const doc = emitted('input see\nassume(1 == 1)\nclaim(undecided("cannot tell"))\nsee("on")');
  for (const name of ["assume", "undecided"]) assert.ok(doc.nodes.some((n) => n.k === "kernel" && n.name === name), name);
  const w = run('input see\nassume(1 == 1)\nclaim(undecided("cannot tell"))\nsee("on")');
  assert.deepEqual(seenTexts(w), ["on"]);
  assert.equal(w.refuted, false);
});

// ── Six names ruled on 2026-11-25 ─────────────────────────────────────
//
// The maintainer ruled that the emitter writes the shipped primitives
// text.byte, text.span, text.starts and text.until, and the kernel
// primitives specialize and sample. forms.md does not state them yet.

test("text.byte, text.span, text.starts and text.until are the shipped primitives of those names: the record needs each by its hash and applies it", () => {
  const names = ["text.byte", "text.span", "text.starts", "text.until"];
  const text = [
    "input see",
    'see(text.byte("ab", 0))', 'see(text.byte("ab", 2))',
    'see(text.span("abc1", 0, "az"))',
    'see(text.until("key=value", 0, "="))', 'see(text.until("key", 1, "="))',
    'see(text.starts("hello", 1, "ell"))', 'see(text.starts("hello", 1, "elk"))',
  ].join("\n");
  const doc = emitted(text);
  assert.deepEqual(doc.needs.map((n) => n.name).filter((n) => names.includes(n)).sort(), [...names].sort());
  for (const name of names) {
    assert.ok(doc.needs.some((n) => n.name === name && n.hash === shippedByName.get(name)?.hash), `the record needs ${name} by the hash shippedByName gives`);
    assert.ok(doc.nodes.some(shippedNamed(doc, name)), `the record applies the primitive ${name}`);
  }
  const r = run(text);
  assert.equal(r.refuted, false);
  assert.deepEqual(seen(r).slice(0, 5).map((v) => intOf(r.k, v)), [97n, -1n, 3n, 3n, 2n]);
  assert.deepEqual(seen(r).slice(5).map((v) => bitsOf(r.k, v)), ["1:01", "1:00"]);
  // They are entries of the structure text, as text.int is.
  assert.deepEqual(seenInts(run('input see\nt = text\nsee(t.byte("A", 0))\nsee(t.span(" x", 0, "  "))')), [65n, 1n]);
  // Outside its domain each is a refutation.
  assert.equal(run('input see\nsee(text.byte("ab", 3))').refuted, true);
});

test("specialize and sample are the kernel's primitives of those names: the record applies each, and the kernel evaluates it", () => {
  const text = "input see\ndouble(n) => n * 2\nfast = specialize(double, 1000)\nsee(fast(21))\nclaim(sample(n => n + 0 == n, [1, 2, 3]))\nsee(\"after the sample\")";
  const doc = emitted(text);
  for (const name of ["specialize", "sample"]) {
    assert.ok(doc.nodes.some((n) => n.k === "kernel" && n.name === name), `the record names the kernel primitive ${name}`);
    assert.ok(doc.nodes.some(kernelNamed(doc, name)), `the record applies ${name}`);
  }
  const r = run(text);
  assert.equal(r.refuted, false);
  assert.deepEqual(seen(r).map((v, i) => (i === 0 ? String(intOf(r.k, v)) : textOf(r.k, v))), ["42", "after the sample"]);
  // A case the claim is not true of refutes the sample, and the statements after the claim do not happen.
  const wrong = run('input see\nclaim(sample(n => n == 1, [1, 2]))\nsee("never")');
  assert.equal(wrong.refuted, true);
  assert.deepEqual(seenTexts(wrong), []);
  // Only a function is specialized.
  assert.equal(run("input see\nsee(specialize(1, 10))").refuted, true);
});

test("a computed key in a structure literal is put: {a: e, [k]: f} is put({a: e}, k, f), and an entry after it is put too", () => {
  const text = 'input see\nk = symbol("z")\ns = {a: 1, [k]: 2, b: 3}\nsee(s.z)\nsee(s.b)\nsee(spelling(key(s, 1)))\nsee(count(s))';
  const doc = emitted(text);
  const put = doc.nodes.findIndex((n) => n.k === "kernel" && n.name === "put");
  assert.equal(doc.nodes.filter((n) => n.k === "expression" && n.fn === put).length, 2);
  const r = run(text);
  assert.deepEqual(seen(r).map((v, i) => (i === 2 ? textOf(r.k, v) : String(intOf(r.k, v)))), ["2", "3", "z", "3"]);
});

test("a key header line is a parameter before every other, counted by keys, not declared; [k]: e with its name is a private entry", () => {
  const text = "input see\nkey secret\nkey other\nmake(n) => {shown: n, [secret]: n * 2}\nbox = make(21)\nsee(count(box))\nsee(box[secret])";
  const doc = emitted(text);
  const fn = doc.nodes[doc.module];
  assert.ok(fn.k === "function");
  assert.deepEqual(fn.params.map((p) => (doc.nodes[p] as { name: string }).name), ["secret", "other", "see"]);
  assert.equal(doc.keys, 2);
  assert.deepEqual(doc.declares.map((d) => d.name), ["see"]);
  const secret = fn.params[0];
  assert.ok(doc.nodes.some((n) => n.k === "structure" && n.entries.some(([key]) => key === secret)), "the private entry is keyed by the key's parameter");
  assert.deepEqual(seenInts(run(text)), [1n, 42n]);
  // A key's header name is no binding: the module does not yield it.
  const open = run("input see\nkey secret\nx = 1\nsee(x)");
  assert.deepEqual(open.k.entriesOf(open.value).map(([key]) => open.k.symbolName(key as Value)), ["x"]);
});

test("the header lines may stand anywhere at the top level; the parameters are keys first, then the rest in written order", () => {
  const doc = emitted("x = 1\ninput see\nsee(x)\nkey k\ncapability output\noutput.write(\"w\")\ninput tick");
  const fn = doc.nodes[doc.module];
  assert.ok(fn.k === "function");
  assert.deepEqual(fn.params.map((p) => (doc.nodes[p] as { name: string }).name), ["k", "see", "output", "tick"]);
  assert.deepEqual(doc.declares.map((d) => [d.role, d.name]), [["input", "see"], ["capability", "output"], ["input", "tick"]]);
});

test("int, float, text and bits are structures: one handed as a value is the structure of its primitives, and a block may hide one", () => {
  const r = run("input see\napply(ops, a, b) => ops.add(a, b)\nsee(apply(int, 2, 3))\nsee(bits.length)\nhidden <-\n  int = {add: (a, b) => 0}\n  int.add(1, 2)\nsee(hidden)");
  assert.equal(intOf(r.k, seen(r)[0]), 5n);
  assert.equal(r.k.kind(seen(r)[1]), "primitive-function");
  assert.equal(intOf(r.k, seen(r)[2]), 0n);
  // Written only as int.<entry>, the text needs only the primitives it names.
  assert.deepEqual(emitted("input see\nsee(int.add(1, 2))").needs.map((n) => n.name), ["int.add"]);
  const whole = emitted("input see\nsee(int)");
  assert.ok(whole.needs.length >= 12 && whole.needs.some((n) => n.name === "int.float"));
});

test("the four primitives added: bits.int, float.eq, float.ge, float.gt", () => {
  const r = run('input see\nsee(bits.int(bits.slice("A", 0, 8)))\nsee(float.eq(0.0, -0.0))\nsee(float.ge(2.0, 2.0))\nsee(float.gt(2.0, 2.0))');
  assert.equal(intOf(r.k, seen(r)[0]), 65n);
  assert.deepEqual(seen(r).slice(1).map((v) => bitsOf(r.k, v)), ["1:01", "1:01", "1:00"]);
});

test("the least integer is written -9223372036854775808: one literal, with no int.neg", () => {
  const doc = emitted("input see\nsee(-9223372036854775808)");
  assert.deepEqual(doc.needs, []);
  assert.deepEqual(seenInts(run("input see\nsee(-9223372036854775808)\nsee(-9223372036854775807 - 1)")), [-(2n ** 63n), -(2n ** 63n)]);
});

test("a - written before a fraction is part of the literal: -1.5 is the fraction, with no int.neg", () => {
  const text = "input see\nsee(float.text(-1.5))\nsee(float.text(float.add(-0.25, 1.0)))";
  assert.deepEqual(emitted(text).needs.map((n) => n.name), ["float.add", "float.text"]);
  assert.deepEqual(seenTexts(run(text)), ["-1.5", "0.75"]);
  // Before anything but a number written out, prefix - is int.neg (forms.md §2, "Operators").
  assert.ok(emitted("input see\nx = 1.5\nsee(-x)").needs.some((n) => n.name === "int.neg"));
});

// ── What the module yields ────────────────────────────────────────────

test("a module with no export yields all its bindings, keyed by the symbols of their names; with export, those marked", () => {
  // x <- e is a binding of the module's block like any other, so it is yielded too.
  const all = run('input see\nf(x) => x\nn = 1\nm <- 2\nsee("ran")');
  assert.deepEqual(all.k.entriesOf(all.value).map(([key]) => all.k.symbolName(key as Value)), ["f", "n", "m"]);
  // An entry is evaluated when something reads it, so the entry is read through the kernel, not taken from `entriesOf`.
  const f = all.k.evaluate(all.k.expression(all.k.kernelPrimitive("get"), [all.value, all.k.symbolData("f")]));
  assert.equal(f.refuted, false);
  assert.equal(all.k.kind(f.value), "composed-function");
  const some = run('input see\nexport f(x) => x\nn = 1\nsee("ran")');
  assert.deepEqual(some.k.entriesOf(some.value).map(([key]) => some.k.symbolName(key as Value)), ["f"]);
});

// ── Imports (part 5) ──────────────────────────────────────────────────

/**
 * Emits each imported text in order, each with the ones before it to
 * import, loads each record into one reference kernel and takes its
 * identity with `moduleOf`, as the driver does; then emits the text with
 * them and instantiates its module with `see` for its input of that name,
 * passing no argument for an import: the kernel supplies it.
 */
function runImporting(libs: ReadonlyArray<readonly [string, string]>, text: string): { k: Kernel; seen: string[]; value: Value; refuted: boolean; doc: SavedProgram; imports: Map<string, ImportedModule> } {
  const k = createKernel();
  const imports = new Map<string, ImportedModule>();
  for (const [name, lib] of libs) {
    const doc = emittedWith(lib, imports);
    const identity = k.moduleOf(load(k, doc, primitivesFor(k, doc)));
    assert.ok(identity !== undefined);
    imports.set(name, { declares: doc.declares, identity });
  }
  const doc = emittedWith(text, imports);
  const fn = load(k, doc, primitivesFor(k, doc));
  const seenTexts: string[] = [];
  const see = k.primitiveFunction({ purity: "effectful", capability: "test", part: "see", arity: 1, run: ([v]) => {
    seenTexts.push(new TextDecoder().decode(k.bitsOf(v).bytes));
    return k.structure([]);
  } });
  const args = doc.declares.filter((d) => d.role !== "module").map((d) => {
    assert.equal(d.name, "see", `the test supplies no input ${d.name}`);
    return see;
  });
  const r = k.evaluate(k.expression(fn, args), { steps: 100_000 });
  return { k, seen: seenTexts, value: r.value, refuted: r.refuted, doc, imports };
}

const LIB = 'input see\ninput greeting\nexport hello() => see(greeting)\nexport double(n) => n * 2\n';

test("an import is a parameter declared a module, with the imported module's identity, and a binding that calls it", () => {
  const r = runImporting([["lib", LIB]], 'input see\nimport lib with greeting: "hi"\nlib.hello()\nsee(int.text(lib.double(21)))');
  assert.equal(r.refuted, false);
  assert.deepEqual(r.seen, ["hi", "42"]);
  const fn = r.doc.nodes[r.doc.module];
  assert.ok(fn.k === "function");
  const lib = r.doc.declares.find((d) => d.role === "module");
  assert.deepEqual(lib && [lib.name, lib.identity], ["lib", r.imports.get("lib")?.identity]);
  assert.ok(lib !== undefined && fn.params.includes(lib.param));
  // The binding lib = <that parameter>(see, "hi"), in the module's block: an application of the parameter.
  assert.ok(r.doc.nodes.some((n) => n.k === "expression" && n.fn === lib?.param && n.args.length === 2));
  assert.ok(r.doc.nodes.some((n) => n.k === "symbol" && n.fqn === "lib"));
});

test("by default an import is handed the importing module's capability or input of the same name; with hands an expression, which may use the module's bindings", () => {
  const lib = 'input see\nexport shout(t) => see(t ++ "!")\n';
  assert.deepEqual(runImporting([["lib", lib]], 'input see\nimport lib\nlib.shout("hello")').seen, ["hello!"]);
  assert.deepEqual(runImporting([["lib", LIB]], 'input see\nimport lib with greeting: word ++ "?"\nword = "what"\nlib.hello()').seen, ["what?"]);
});

test("without hands a refusal: the imported module refuses only where it uses what was withheld", () => {
  const lib = 'input see\ninput greeting\nexport quiet() => 7\nexport loud() => see(greeting)\n';
  const quiet = runImporting([["lib", lib]], "input see\nimport lib without greeting\nsee(int.text(lib.quiet()))");
  assert.equal(quiet.refuted, false);
  assert.deepEqual(quiet.seen, ["7"]);
  const loud = runImporting([["lib", lib]], 'input see\nimport lib without greeting\nsee("before")\nlib.loud()');
  assert.equal(loud.refuted, true);
  assert.deepEqual(loud.seen, ["before"]);
  assert.equal(loud.k.reasonOf(loud.value), withheldReason("greeting"));
  assert.equal(withheldReason("c"), "the capability c was withheld by the importing module");
});

test("two imports of one module with the same arguments are one instance: its top-level statement happens once", () => {
  const shared = 'input see\nsee("shared")\nx = 42\n';
  const a = "input see\nimport shared\nexport y = shared.x + 1\n";
  const b = "input see\nimport shared\nexport z = shared.x + 2\n";
  const r = runImporting([["shared", shared], ["a", a], ["b", b]], "input see\nimport a\nimport b\nsee(int.text(a.y))\nsee(int.text(b.z))");
  assert.equal(r.refuted, false);
  assert.deepEqual(r.seen, ["shared", "43", "44"]);
});

test("an import nothing needs is never instantiated", () => {
  const r = runImporting([["noisy", 'input see\nsee("noisy")\n']], 'input see\nimport noisy\nsee("main")');
  assert.deepEqual(r.seen, ["main"]);
});

test("an import is a binding: a module with no export yields it, in written order; one with exports does not", () => {
  const lib = "export one = 1\n";
  const open = runImporting([["lib", lib]], "input see\nx = 1\nimport lib\ny = 2");
  assert.deepEqual(open.k.entriesOf(open.value).map(([key]) => open.k.symbolName(key as Value)), ["x", "lib", "y"]);
  const closed = runImporting([["lib", lib]], "input see\nimport lib\nexport y = lib.one");
  assert.deepEqual(closed.k.entriesOf(closed.value).map(([key]) => closed.k.symbolName(key as Value)), ["y"]);
});

test("an import's findings: no pair supplied; a name it declares that nothing supplies; a with or without naming what it does not declare; a name handed and withheld", () => {
  const lib: ImportedModule = { declares: [{ role: "capability", name: "output" }, { role: "input", name: "n" }], identity: "sha256:" + "cd".repeat(32) };
  const imports = new Map([["lib", lib]]);
  const messages = (text: string, given: Imports = imports): string[] => {
    const r = emit(text, given);
    assert.equal(r.ok, false, text);
    return r.ok ? [] : r.findings.map((f) => `${f.at.line}:${f.at.column} ${f.kind} ${f.message}`);
  };
  assert.deepEqual(messages("capability output\nimport lib", new Map()), [
    "2:1 import the module lib is imported, and its declarations and identity were not supplied: the text it is read from is emitted first",
  ]);
  assert.deepEqual(messages("capability output\nimport lib"), [
    "2:1 import lib declares the input n, which this module neither holds under that name, nor hands with with, nor withholds",
  ]);
  assert.deepEqual(messages("capability output\nimport lib with n: 1, m: 2 without k"), [
    "2:23 import the import of lib hands m with with, and lib declares no capability or input m",
    "2:36 import the import of lib withholds k, and lib declares no capability or input k",
  ]);
  assert.deepEqual(messages("capability output\nimport lib with n: 1 without n"), ["2:30 import the import of lib both hands and withholds n"]);
  assert.deepEqual(messages("import lib with n: 1, n: 2 without output, output"), [
    "1:23 import the import of lib hands n twice",
    "1:44 import the import of lib withholds output twice",
  ]);
  // The import's name is a binding of the module's block: a binding of the same name is bound twice.
  assert.deepEqual(messages("capability output\ninput n\nimport lib\nlib = 1").map((m) => m.split(" ").slice(1).join(" ")), ["rebound the name lib is bound twice in one block"]);
  // Handed and withheld in full, the import emits with no capability or input of the importing module.
  assert.equal(emit("import lib with n: 1 without output", imports).ok, true);
});

// What the emitter writes is checked against the kernel of this base,
// without failing when the kernel stream supplies more: the kernel is lane
// R's, and a new primitive there must not fail this stream's test. The test
// turns to a todo and names what the emitter does not write yet.
test("what waits, against the kernel on this base: a thing the kernel now has is named as work for the emitter", (t) => {
  const k = createKernel();
  const owed: string[] = [];
  const more = [...k.kernelPrimitiveNames()].filter((n) => !KERNEL_WRITTEN.includes(n)).sort();
  if (more.length > 0) owed.push(`the kernel has the primitives ${more.join(", ")}, which the emitter does not write`);
  const unshipped = SHIPPED_NAMES.filter((n) => !shippedByName.has(n));
  if (unshipped.length > 0) owed.push(`next/prims does not ship ${unshipped.join(", ")}`);
  // What the emitter writes must be in the kernel and the data form.
  for (const name of KERNEL_WRITTEN) assert.doesNotThrow(() => k.kernelPrimitive(name), name);
  assert.equal(typeof k.symbolData, "function");
  assert.deepEqual(check2({ format: "allegro-saved-program", version: 2, needs: [], nodes: [{ k: "datum", fqn: "a" }, { k: "function", params: [], body: 0 }], module: 1, declares: [] }), []);
  for (const o of owed) t.diagnostic(o);
  if (owed.length > 0) t.todo(`the emitter can write more: ${owed.join("; ")}`);
});

test("every form of the table is written by some text of this file", () => {
  const used = new Set<FormId>();
  for (const [text, imports] of TEXTS) {
    const r = emit(text, imports);
    if (r.ok) for (const f of r.forms) used.add(f);
  }
  const missing = (Object.keys(FORMS) as FormId[]).filter((f) => !used.has(f));
  assert.deepEqual(missing, []);
});

test("every finding of a text is given, each at its place, and the forms it uses are listed", () => {
  const r = emit("capability output\nx = 1\nx = 2\noutput.write(y + 1 == 2)");
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.deepEqual(r.findings.map((f) => [f.at.line, f.kind]), [[3, "rebound"], [4, "unbound"]]);
  assert.deepEqual(r.forms, ["== !=", "application", "binding", "capability", "capability part", "dropped statement", "integer operator", "name", "whole number"]);
  // An inner block with bindings and no statement has no value.
  assert.deepEqual(findings("input see\nb <-\n  a = 1\nsee(b)").map((x) => x.kind), ["refused"]);
});

// ── Places ────────────────────────────────────────────────────────────
//
// Each node of kind expression, function or structure that a part of the
// text gives rise to carries `at`, the kernel's place: the text's name, and
// the index, line and column of its start and of the point after its last
// character (next/kernel/interface.ts, `Place`).

/** A node that carries a place, with the part of the text its place spans. */
type Placed = { readonly node: SavedProgram["nodes"][number]; readonly at: NonNullable<Extract<SavedProgram["nodes"][number], { k: "expression" }>["at"]>; readonly part: string };
function placed(doc: SavedProgram, text: string): Placed[] {
  return doc.nodes.flatMap((node) =>
    (node.k === "expression" || node.k === "function" || node.k === "structure") && node.at !== undefined ? [{ node, at: node.at, part: text.slice(node.at.start.index, node.at.end.index) }] : [],
  );
}
/** The one node that spans the part and is what `is` says, as `[start line, start column, end line, end column]` with its source. */
function placeOf(doc: SavedProgram, text: string, part: string, is: (n: SavedProgram["nodes"][number]) => boolean): [string, number, number, number, number] {
  const found = placed(doc, text).filter((p) => p.part === part && is(p.node));
  assert.equal(found.length, 1, `one node spans ${JSON.stringify(part)} and is what is asked: ${JSON.stringify(found)}`);
  const { at } = found[0];
  return [at.source, at.start.line, at.start.column, at.end.line, at.end.column];
}
const kernelNamed = (doc: SavedProgram, name: string) => (n: SavedProgram["nodes"][number]) => n.k === "expression" && doc.nodes[n.fn].k === "kernel" && (doc.nodes[n.fn] as { name: string }).name === name;
const shippedNamed = (doc: SavedProgram, name: string) => (n: SavedProgram["nodes"][number]) =>
  n.k === "expression" && doc.nodes[n.fn].k === "primitive" && (doc.nodes[n.fn] as { hash: string }).hash === shippedByName.get(name)?.hash;
const callOf = (doc: SavedProgram, fqn: string) => (n: SavedProgram["nodes"][number]) => n.k === "expression" && doc.nodes[n.fn].k === "symbol" && (doc.nodes[n.fn] as { fqn: string }).fqn === fqn;

const PLACES = [
  "input see",
  "square(n) => n * n",
  "r = {a: 1,",
  "  b: [2, 3]}",
  "see(square(",
  "  4) + 1)",
  "claim(r.a == 1)",
  "x <- see(2)",
  "",
].join("\n");

test("a place on each part: a claim, a call, an operator expression, a function and a structure literal, by the line and column of each end", () => {
  const doc = emitted(PLACES);
  assert.deepEqual(check2(doc), []);
  assert.deepEqual(placeOf(doc, PLACES, "claim(r.a == 1)", kernelNamed(doc, "claim")), ["<text>", 7, 1, 7, 16], "the claim");
  assert.deepEqual(placeOf(doc, PLACES, "square(\n  4)", callOf(doc, "square")), ["<text>", 5, 5, 6, 5], "a call written over two lines");
  assert.deepEqual(placeOf(doc, PLACES, "square(\n  4) + 1", shippedNamed(doc, "int.add")), ["<text>", 5, 5, 6, 9], "the operator expression is the call of int.add");
  assert.deepEqual(placeOf(doc, PLACES, "r.a == 1", kernelNamed(doc, "same")), ["<text>", 7, 7, 7, 15], "== is the call of same");
  assert.deepEqual(placeOf(doc, PLACES, "r.a", kernelNamed(doc, "get")), ["<text>", 7, 7, 7, 10], "p.a is the call of get");
  assert.deepEqual(placeOf(doc, PLACES, "square(n) => n * n", (n) => n.k === "function"), ["<text>", 2, 1, 2, 19], "the function binding");
  assert.deepEqual(placeOf(doc, PLACES, "n * n", shippedNamed(doc, "int.mul")), ["<text>", 2, 14, 2, 19]);
  assert.deepEqual(placeOf(doc, PLACES, "{a: 1,\n  b: [2, 3]}", (n) => n.k === "structure" && n.entries.length === 2 && n.entries[0][0] !== null), ["<text>", 3, 5, 4, 13], "a structure literal over two lines");
  assert.deepEqual(placeOf(doc, PLACES, "[2, 3]", (n) => n.k === "structure" && n.entries.every(([key]) => key === null)), ["<text>", 4, 6, 4, 12], "a list");
});

test("a place on what a form stands for: the claim of a dropped statement takes the statement's; x <- e's value its own; the module the whole text", () => {
  const doc = emitted(PLACES);
  assert.deepEqual(placeOf(doc, PLACES, "see(square(\n  4) + 1)", kernelNamed(doc, "claim")), ["<text>", 5, 1, 6, 10], "the claim a dropped statement stands for");
  assert.deepEqual(placeOf(doc, PLACES, "see(square(\n  4) + 1)", kernelNamed(doc, "if")), ["<text>", 5, 1, 6, 10], "and the negation in it");
  assert.deepEqual(placeOf(doc, PLACES, "see(2)", (n) => n.k === "expression" && doc.nodes[n.fn].k === "param"), ["<text>", 8, 6, 8, 12], "the value of x <- see(2)");
  assert.deepEqual(placeOf(doc, PLACES, PLACES, (n) => n === doc.nodes[doc.module]), ["<text>", 1, 1, 9, 1], "the module function: the whole text, its end after the last line break");
  // The index of each end counts characters from 0.
  const claim = placed(doc, PLACES).find((p) => p.part === "claim(r.a == 1)" && kernelNamed(doc, "claim")(p.node));
  assert.deepEqual([claim?.at.start.index, claim?.at.end.index], [PLACES.indexOf("claim("), PLACES.indexOf("claim(") + "claim(r.a == 1)".length]);
});

test("the places name the text: <text> where it is given no name, and the name it is emitted under", () => {
  const unnamed = emitted('input see\nsee("a")\n');
  assert.ok(placed(unnamed, "").length > 0);
  assert.ok(placed(unnamed, "").every((p) => p.at.source === "<text>"));
  const r = emit('input see\nsee("a")\n', new Map(), "dir/named.alg");
  assert.ok(r.ok);
  const named = placed(r.program, "");
  assert.ok(named.length > 0);
  assert.ok(named.every((p) => p.at.source === "dir/named.alg"), JSON.stringify(named.map((p) => p.at.source)));
});

test("two parts written alike in two places are two nodes, each with its place", () => {
  const text = "input see\nsee(1)\nsee(1)\n";
  const doc = emitted(text);
  const calls = placed(doc, text).filter((p) => p.part === "see(1)" && p.node.k === "expression" && doc.nodes[p.node.fn].k === "param");
  assert.deepEqual(calls.map((p) => p.at.start.line), [2, 3]);
});

test("a text with lines ended \\r\\n: each place counts in the text with its line ends written \\n", () => {
  const doc = emitted("input see\r\nsee(1)\r\nsee(2)\r\n");
  const text = "input see\nsee(1)\nsee(2)\n";
  assert.deepEqual(placeOf(doc, text, "see(2)", (n) => n.k === "expression" && doc.nodes[n.fn].k === "param"), ["<text>", 3, 1, 3, 7]);
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
      "bad.alg:2:1: the name see is bound nowhere in the text",
      "bad.alg:2:5: the name y is bound nowhere in the text",
    ]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("npm run emit on a text that imports writes the text's own record, and names each imported text whose record it needs, in load order", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "allegretto-emit-imports-"));
  try {
    fs.writeFileSync(path.join(dir, "main.alg"), "capability output\nimport derived\noutput.write(int.text(derived.four(1)))\n");
    fs.writeFileSync(path.join(dir, "derived.alg"), "import base\nexport four(n) => base.two(base.two(n))\n");
    fs.writeFileSync(path.join(dir, "base.alg"), "export two(n) => n * 2\n");
    const run = spawnSync(process.execPath, ["--import", "tsx", "next/bootstrap/emit.ts", path.join(dir, "main.alg"), "-o", path.join(dir, "main.json")], { cwd: ROOT, encoding: "utf-8" });
    assert.equal(run.status, 0, run.stderr);
    assert.deepEqual(run.stderr.trim().split("\n").map((l) => l.split(dir).join("<dir>")), [
      "<dir>/main.alg: needs the record of <dir>/base.alg; npm run launch takes it by --import, in the order of these lines",
      "<dir>/main.alg: needs the record of <dir>/derived.alg; npm run launch takes it by --import, in the order of these lines",
    ]);
    const main = JSON.parse(fs.readFileSync(path.join(dir, "main.json"), "utf-8")) as SavedProgram;
    assert.deepEqual(check2(main), []);
    assert.deepEqual(main.declares.map((d) => [d.role, d.name]), [["capability", "output"], ["module", "derived"]]);
    const missing = spawnSync(process.execPath, ["--import", "tsx", "next/bootstrap/emit.ts", path.join(dir, "derived.alg")], { cwd: ROOT, encoding: "utf-8" });
    assert.equal(missing.status, 0, missing.stderr);
    fs.rmSync(path.join(dir, "base.alg"));
    const refused = spawnSync(process.execPath, ["--import", "tsx", "next/bootstrap/emit.ts", path.join(dir, "main.alg")], { cwd: ROOT, encoding: "utf-8" });
    assert.equal(refused.status, 1);
    assert.equal(refused.stdout, "");
    assert.equal(refused.stderr.split(dir).join("<dir>"), "<dir>/derived.alg:1:1: the text base.alg, which import base names, is not found in the directory of derived.alg\n");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ── Through the launcher ──────────────────────────────────────────────

/** Emits a text and runs it through the launcher with the output capability and the shipped primitives. */
async function launched(text: string): Promise<{ lines: string[]; end: string }> {
  const r = emitTracked(text);
  if (!r.ok) throw new Error(r.findings.map((f) => f.message).join("; "));
  const o = await launch({ createKernel, program: JSON.parse(encode(r.program)), configuration: { ceiling: ["output"], steps: 100_000 }, target: { capabilities: [output], primitives: [...shippedByName.values()] } });
  return { lines: o.lines, end: o.end.kind };
}

test("hello, world through the output capability's part", async () => {
  assert.deepEqual(await launched('capability output\noutput.write("hello, world")\n'), { lines: ["hello, world"], end: "completed" });
});

test("a block of bindings, order-free, through the launcher", async () => {
  const text = 'capability output\ngreeting = join(hello, "world")\njoin(a, b) => a ++ ", " ++ b\nhello = "hello"\noutput.write(greeting)\n';
  assert.deepEqual(await launched(text), { lines: ["hello, world"], end: "completed" });
});

test("recursion, one value with one identity, through the launcher", async () => {
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

