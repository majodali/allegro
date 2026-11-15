// Tests of the bootstrap emitter (next/bootstrap/emit.ts), run by Node's
// test runner through tsx (`npm run test:next`). Each record the emitter
// writes is checked against the data form (`check2` of
// next/kernel/saved-program.ts), loaded through the launcher
// (next/launch/launcher.ts) into the reference kernel and run, and its
// printed lines are compared with what the text says. A text with a form
// that is not expressible yet gives the finding and no record.

import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import { emit, NEEDS, needInfo, type EmitResult, type NeedId } from "./emit.js";
import { check2, encode, type SavedProgram } from "../kernel/saved-program.js";
import { createKernel } from "../kernel/create.js";
import { launch, type LaunchOutcome } from "../launch/launcher.js";
import { output } from "../launch/output.js";

const here = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(here, "../..");

function emitted(text: string): SavedProgram {
  const r = emit(text);
  if (!r.ok) assert.fail(`expected a record, got findings: ${r.findings.map((f) => `${f.need}: ${f.form}`).join("; ")}`);
  assert.deepEqual(check2(r.program), [], "the record passes check2");
  assert.ok(r.program.nodes.every((n) => n.k !== "kernel" || n.name === "if" || n.name === "claim"), "the record uses the kernel primitives if and claim only, never quote");
  return r.program;
}

async function run(text: string, steps = 100000): Promise<LaunchOutcome> {
  const program = emitted(text);
  return launch({ createKernel, program: JSON.parse(encode(program)), configuration: { ceiling: ["output"], steps }, target: { capabilities: [output] } });
}

async function prints(text: string, lines: string[]): Promise<void> {
  const o = await run(text);
  assert.deepEqual(o.lines, lines);
  assert.equal(o.end.kind, "completed", JSON.stringify(o.end));
}

function refused(text: string, need: NeedId): EmitResult & { ok: false } {
  const r = emit(text);
  assert.equal(r.ok, false, "no record is written");
  if (r.ok) throw new Error("unreachable");
  assert.ok(r.findings.some((f) => f.need === need), `a finding of ${need} among ${r.findings.map((f) => f.need).join(", ")}`);
  assert.ok(!("program" in r));
  return r;
}

/** The lines a fixture pins with `// expect:`. */
function expects(text: string): string[] {
  return text.split("\n").filter((l) => l.trim().startsWith("// expect:")).map((l) => l.trim().slice("// expect:".length).trim());
}

// ── The round trip ──

test("the committed fixture next/launch/fixtures/hello.json is reproduced from a one-line text", () => {
  const text = fs.readFileSync(path.join(here, "fixtures", "hello.alg"), "utf-8");
  assert.equal(text, 'print("hello, world")\n');
  assert.equal(encode(emitted(text)), fs.readFileSync(path.join(ROOT, "next/launch/fixtures/hello.json"), "utf-8"));
});

test("each fixture program emits, runs on the reference kernel through the launcher, and prints its pinned lines", async () => {
  for (const name of ["forms", "recursion"]) {
    const text = fs.readFileSync(path.join(here, "fixtures", `${name}.alg`), "utf-8");
    await prints(text, expects(text));
  }
});

// ── Each expressible form ──

test("a text literal, printed through the output capability the module declares", async () => {
  const p = emitted('print("é and ü")');
  assert.deepEqual(p.declares, [{ param: p.declares[0].param, role: "capability", name: "output" }]);
  await prints('print("é and ü")', ["é and ü"]);
});

test("a text with no print declares no capability, and its module takes no argument", async () => {
  const p = emitted('x = "a"');
  assert.deepEqual(p.declares, []);
  const o = await run('x = "a"');
  assert.deepEqual(o, { lines: [], end: { kind: "completed", steps: o.end.kind === "completed" ? o.end.steps : -1 } });
});

test("truth values and the logical forms are the kernel's conditional over the bits of length one", async () => {
  await prints("print(true)\nprint(!true)\nprint(true && false)\nprint(false || true)\nprint(true and true)", ["true", "false", "false", "true", "true"]);
});

test("a binding of a name is a function of the name applied to the value, needed at its written place", async () => {
  await prints('a = "first"\nprint(a)\nb = a\nprint(b)', ["first", "first"]);
});

test("statements happen in written order, at the top level and in a block", async () => {
  await prints('print("1")\nf() =>\n  print("2")\n  print("3")\nf()\nprint("4")', ["1", "2", "3", "4"]);
});

test("a function may be used before its definition; a lambda and a function that takes a function", async () => {
  await prints('print(pick(false))\npick(c) => if c then "a" else "b"\nflip(g, v) => g(!v)\nprint(if flip(x => x, false) then "t" else "f")', ["b", "t"]);
});

test("a function's free use of a value binding sees the value", async () => {
  await prints('word = "seen"\nsay() => print(word)\nsay()', ["seen"]);
});

test("a conditional evaluates only the branch taken", async () => {
  await prints('if true then print("taken") else print("not taken")\nif false then print("no") else print("else")', ["taken", "else"]);
});

test("a recursive function and a pair of mutually recursive ones, by self-application", async () => {
  await prints('r(go) =>\n  print("r")\n  if go then r(false) else print("end")\nr(true)', ["r", "r", "end"]);
  await prints('a(go) => if go then b(false) else "a ends"\nb(go) => if go then a(false) else "b ends"\nprint(a(true))', ["b ends"]);
});

test("a recursion whose state repeats runs to the step budget: the reference kernel opens every call", async () => {
  const o = await run("loop(x) => loop(x)\nloop(true)", 5000);
  assert.deepEqual(o.lines, []);
  assert.equal(o.end.kind, "limit");
});

test("a whole-number literal the present parser rounds is refused, and one below 2^53 is kept exactly", () => {
  for (const text of ["x = 9007199254740993", "x = 9223372036854775807", "x = 0xFFFFFFFFFFFFFFFF", "x = 9007199254740992"]) refused(text, "large-literal");
  const program = emitted("x = 9007199254740991");
  assert.ok(program.nodes.some((n) => n.k === "bits" && n.bits === 64 && n.hex === "001fffffffffffff"), JSON.stringify(program.nodes));
});

test("with no step budget the same recursion ends at the kernel's own limit, and the end says no budget was set", async () => {
  const program = emitted("loop(x) => loop(x)\nloop(true)");
  const o = await launch({ createKernel, program: JSON.parse(encode(program)), configuration: { ceiling: ["output"] }, target: { capabilities: [output] } });
  assert.equal(o.end.kind, "limit");
  assert.equal(o.end.kind === "limit" && o.end.reason, "the kernel reached its own limit; no step budget was set");
});

test("a claim that holds lets the program go on; one that does not refutes it, and no later statement runs", async () => {
  await prints('claim(true)\nprint("on")', ["on"]);
  const o = await run('print("before")\nclaim(false)\nprint("after")');
  assert.deepEqual(o.lines, ["before"]);
  assert.equal(o.end.kind, "refuted");
});

test("a structure literal and an array are structures; a comment is nothing", async () => {
  const p = emitted('// a comment\np = {a: "x", b: [true, false]}\n/* another */');
  const structures = p.nodes.filter((n) => n.k === "structure");
  assert.ok(structures.some((n) => n.k === "structure" && n.entries.length === 2 && n.entries.every(([k]) => k === null)), "the array");
  assert.ok(p.nodes.some((n) => n.k === "symbol" && n.fqn === "a"), "a field's key is a symbol of its name");
  await prints('p = {a: "x"}\nprint("ok")', ["ok"]);
});

test("the module's value ends in the structure of its bindings, keyed by their names", async () => {
  const p = emitted('x = "1"\nf() => x');
  const last = p.nodes[p.nodes.length - 2];
  assert.equal(last.k, "expression");
  const keys = p.nodes.filter((n) => n.k === "symbol").map((n) => (n as { fqn: string }).fqn);
  assert.deepEqual([...new Set(keys)].sort(), ["f", "x"]);
});

// ── Forms not expressible yet: a finding and no record ──

test("arithmetic, comparison and printing a number wait on shipped primitives", () => {
  refused("print(1 + 2)", "int-arith");
  refused("x = 3 < 4", "int-compare");
  refused("print(42)", "int-to-text");
  refused('print("a" + "b")', "text-concat");
  refused("print(1.5 + 2.5)", "float-arith");
});

test("== on texts waits on a kernel primitive that tells bits apart, and reading a field on one that reads structures", () => {
  refused('x = "a" == "b"', "bits-equal");
  refused('p = {a: "1"}\nprint(p.a)', "structure-read");
});

test("a binding inside a block is refused: the present tree builder substitutes it at each use", () => {
  const r = refused('f() =>\n  x = print("a")\n  print("b")\n  x\nf()', "block-binding");
  assert.match(r.findings.find((f) => f.need === "block-binding")!.form, /x = print\("a"\)/);
});

test("a name bound twice, a grammar change and a text the parser does not read are not accepted", () => {
  refused('x = "1"\nx = "2"', "rebind");
  refused('use units\nprint("a")', "use");
  refused("+ +", "parse");
});

test("a name nothing binds, and a value binding used before its line, are findings", () => {
  refused("print(missing)", "unbound");
  refused('print(later)\nlater = "x"', "forward-value");
});

test("a claim inside an expression, a block that gives a value, and print's value used, are findings", () => {
  refused("x = claim(true)", "claim-value");
  refused('f() =>\n  print("a")\n  "value"\nprint(f())', "block-value");
  refused('x = print("a")', "print-value");
});

test("a type annotation, when and an import wait on the standard language and the launcher", () => {
  refused('x: Int = 5', "types");
  refused("y = when 1 is 1 then true else false", "match");
  refused("import helpers\nprint(\"a\")", "import");
});

test("every need has a state and an owner", () => {
  for (const id of Object.keys(NEEDS) as NeedId[]) {
    const info = needInfo(id);
    assert.ok(info.title.length > 0 && info.owner.length > 0, id);
  }
  assert.equal(needInfo("prim:proof_check").state, "standard language");
});
