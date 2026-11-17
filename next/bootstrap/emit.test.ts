// Tests of the emitter of Allegretto (next/bootstrap/emit.ts). Each form
// is emitted, its record passes `check2`, and the record is loaded into
// the reference kernel (`createKernel` of next/kernel/create.ts), with the
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
import type { Cell, Kernel2, Value } from "../kernel/interface.js";
import { createKernel } from "../kernel/create.js";
import { check2, encode, load, type SavedProgram } from "../kernel/saved-program.js";
import { launch } from "../launch/launcher.js";
import { output } from "../launch/output.js";
import { shippedByName } from "../prims/index.js";
import { emit, FORMS, KERNEL_WRITTEN, SHIPPED_NAMES, type Finding, type FormId } from "./emit.js";

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

/** The shipped primitives a record needs, made in a kernel, by hash. */
function primitivesFor(k: Kernel2, doc: SavedProgram): Map<string, Value> {
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
  const r = k.evaluate(k.expression(fn, args), k.scope(), { steps: 100_000 });
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
/** A whole number of 64 bits, read as two's complement. */
const intOf = (k: Kernel2, v: Value | undefined): bigint => {
  const { bytes } = k.bitsOf(v as Value);
  return new DataView(bytes.buffer, bytes.byteOffset, 8).getBigInt64(0);
};
const seenInts = (r: Run): bigint[] => seen(r).map((v) => intOf(r.k, v));
/** The texts the emitter is run on in this file, for the test that every form is written. */
const TEXTS: string[] = [];
const emitTracked = (text: string) => {
  TEXTS.push(text);
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
  const r = run('input see\ninput right\nthen(see("first"), see("second"))\nsee(attempt("tried", 100))');
  const [first, second, attempted] = seen(r);
  assert.deepEqual([textOf(r.k, first), textOf(r.k, second)], ["first", "second"]);
  const [head, value] = r.k.entriesOf(attempted);
  assert.equal(r.k.symbolName(head[1]), "description.value");
  assert.equal(textOf(r.k, value[1]), "tried");
  // describe and build are written as the kernel's primitives of those names.
  // What each is applied to is the kernel's to say: the ruling of 2026-11-17,
  // "A free name never gets a value", gives build a second argument, the
  // values for the names a description leaves free. So the record is read
  // here, and nothing is built.
  const doc = emitted("input right\nf(d, names) => build(d, names)\ng(x) => describe(right, x)");
  for (const name of ["describe", "build"]) assert.ok(doc.nodes.some((n) => n.k === "kernel" && n.name === name), `the record names the kernel primitive ${name}`);
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

test("x <- e whose e reads an enclosing block's x reads that x, not itself", () => {
  const r = run("input see\nn <- 1\nm <-\n  n <- n + 1\n  n\nsee(n)\nsee(m)");
  assert.deepEqual(seenInts(r), [1n, 2n]);
  // Written as forms.md has it where e does not read x.
  const doc = emitted("input see\nn <- 1\nsee(n)");
  const block = doc.nodes.findIndex((n) => n.k === "kernel" && n.name === "block");
  assert.ok(doc.nodes.some((n) => n.k === "expression" && n.fn === block));
  assert.ok(!doc.nodes.some((n) => n.k === "function" && n.params.length > 0 && doc.nodes[n.params[0]].k === "param" && (doc.nodes[n.params[0]] as { name: string }).name === "n"));
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

// ── What the module yields ────────────────────────────────────────────

test("a module with no export yields all its bindings, keyed by the symbols of their names; with export, those marked", () => {
  const all = run('input see\nf(x) => x\nn = 1\nm <- 2\nsee("ran")');
  assert.deepEqual(all.k.entriesOf(all.value).map(([key]) => all.k.symbolName(key as Value)), ["f", "n"]);
  // An entry is evaluated when something reads it, so the entry is read through the kernel, not taken from `entriesOf`.
  const f = all.k.evaluate(all.k.expression(all.k.kernelPrimitive("get"), [all.value, all.k.symbolData("f")]), all.k.scope());
  assert.equal(f.refuted, false);
  assert.equal(all.k.kind(f.value), "composed-function");
  const some = run('input see\nexport f(x) => x\nn = 1\nsee("ran")');
  assert.deepEqual(some.k.entriesOf(some.value).map(([key]) => some.k.symbolName(key as Value)), ["f"]);
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
  for (const text of TEXTS) {
    const r = emit(text);
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
  assert.deepEqual(r.forms, ["== !=", "application", "binding", "capability", "capability part", "integer operator", "name", "whole number"]);
  // A binding cannot read a name bound at a place: the group is bound before any statement.
  assert.deepEqual(findings("input see\nn <- 1\nm = n\nsee(m)").map((x) => [x.kind, x.message]), [["unbound", "the name n is bound nowhere in the text"]]);
  // An inner block with bindings and no statement has no value.
  assert.deepEqual(findings("input see\nb <-\n  a = 1\nsee(b)").map((x) => x.kind), ["refused"]);
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
