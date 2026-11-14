// Tests of the minimal launcher (B-196 (the rebuild's acceptance side),
// chunk Q7 (the minimal launcher), part 1): next/launch/launcher.ts and
// the output capability next/launch/output.ts, on the stand-in kernel of
// next/launch/stand-in-kernel.for-tests.ts. Run by `npm run test:next`.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import type { Cell, Kernel, PrimitiveDeclaration } from "../kernel/interface.js";
import { check, encode, type SavedProgram } from "../kernel/saved-program.js";
import { describe, launch, type CapabilityImplementation, type Configuration, type Plain, type Target } from "./launcher.js";
import { OUTPUT, output } from "./output.js";
import { createStandInKernel } from "./stand-in-kernel.for-tests.js";

const here = path.dirname(new URL(import.meta.url).pathname);
const FIXTURE = path.join(here, "fixtures", "hello.json");
const hex = (text: string) => Array.from(new TextEncoder().encode(text), (b) => b.toString(16).padStart(2, "0")).join("");
const text = (t: string) => ({ k: "bits", hex: hex(t), bits: new TextEncoder().encode(t).length * 8 }) as const;

/** module(out) => out("hello, world"): the fixture of next/launch/fixtures/hello.json. */
const HELLO: SavedProgram = {
  format: "allegro-saved-program",
  version: 1,
  needs: [],
  nodes: [
    { k: "param", name: "out" },
    text("hello, world"),
    { k: "expression", fn: 0, args: [1] },
    { k: "function", params: [0], body: 2 },
  ],
  module: 3,
  declares: [{ param: 0, role: "capability", name: "output" }],
};

/**
 * module(out) => [out("first"), out("second")]. The data form has no
 * sequencing form: sequence is a kernel primitive's. The body here is a
 * structure of two applications, which the stand-in evaluates in entry
 * order; that order is the stand-in's, not a ruling.
 */
const TWO: SavedProgram = {
  ...HELLO,
  nodes: [
    { k: "param", name: "out" },
    text("first"),
    { k: "expression", fn: 0, args: [1] },
    text("second"),
    { k: "expression", fn: 0, args: [3] },
    { k: "structure", entries: [[null, 2], [null, 4]] },
    { k: "function", params: [0], body: 5 },
  ],
  module: 6,
};

const ADD = "sha256:" + "ab".repeat(32);
/** module(out) => out(echo("pure")), with echo a pure primitive named by hash. */
const NEEDS_ECHO: SavedProgram = {
  ...HELLO,
  needs: [{ hash: ADD, name: "test.echo" }],
  nodes: [
    { k: "param", name: "out" },
    { k: "primitive", hash: ADD },
    text("pure"),
    { k: "expression", fn: 1, args: [2] },
    { k: "expression", fn: 0, args: [3] },
    { k: "function", params: [0], body: 4 },
  ],
  module: 5,
};
const ECHO: PrimitiveDeclaration = { purity: "pure", hash: ADD, name: "test.echo", arity: 1, run: ([v]) => v };

/** module(later, out) => out(later.ask()): the line is written only once the answer arrives. */
const LATER: SavedProgram = {
  ...HELLO,
  nodes: [
    { k: "param", name: "later" },
    { k: "param", name: "out" },
    { k: "expression", fn: 0, args: [] },
    { k: "expression", fn: 1, args: [2] },
    { k: "function", params: [0, 1], body: 3 },
  ],
  module: 4,
  declares: [
    { param: 0, role: "capability", name: "later" },
    { param: 1, role: "capability", name: "output" },
  ],
};

/** A deterministic test capability: its one part returns a cell, answered when the test says. */
function laterCapability(): { capability: CapabilityImplementation; answer: (text: string) => void; asked: () => number } {
  let resolve: (p: Plain) => void = () => {};
  const answer = new Promise<Plain>((r) => (resolve = r));
  let asked = 0;
  const capability: CapabilityImplementation = {
    definition: { name: "later", parts: ["ask"] },
    create: (host) => [{
      purity: "effectful",
      capability: "later",
      part: "ask",
      arity: 0,
      run: (_args, context) => {
        asked++;
        const cell = context.cell();
        host.later(cell, answer);
        return cell;
      },
    }],
  };
  return { capability, answer: (t) => resolve({ bits: new TextEncoder().encode(t) }), asked: () => asked };
}

/** A stand-in kernel wrapped so every function called on it is recorded by name. */
function recording(): { createKernel: () => Kernel; created: () => number; calls: string[]; made: PrimitiveDeclaration[] } {
  const calls: string[] = [];
  const made: PrimitiveDeclaration[] = [];
  let created = 0;
  const createKernel = () => {
    created++;
    const inner = createStandInKernel();
    return new Proxy(inner, {
      get(target, name, receiver) {
        const v = Reflect.get(target, name, receiver);
        if (typeof v !== "function") return v;
        return (...args: unknown[]) => {
          calls.push(String(name));
          if (name === "primitiveFunction") made.push(args[0] as PrimitiveDeclaration);
          return (v as (...a: unknown[]) => unknown).apply(target, args);
        };
      },
    });
  };
  return { createKernel, created: () => created, calls, made };
}

const ONLY_OUTPUT: Configuration = { ceiling: ["output"] };
const TERMINAL: Target = { capabilities: [output] };
const evaluating = ["evaluate", "advance"];

test("the fixture is HELLO, written with encode, and checks", () => {
  assert.equal(fs.readFileSync(FIXTURE, "utf8"), encode(HELLO));
  assert.deepEqual(check(JSON.parse(fs.readFileSync(FIXTURE, "utf8"))), []);
  for (const p of [TWO, NEEDS_ECHO, LATER]) assert.deepEqual(check(p), []);
});

test("a module that applies output to a text prints that line once and completes", async () => {
  const r = recording();
  const outcome = await launch({ createKernel: r.createKernel, program: JSON.parse(fs.readFileSync(FIXTURE, "utf8")), configuration: ONLY_OUTPUT, target: TERMINAL });
  assert.deepEqual(outcome.lines, ["hello, world"]);
  assert.deepEqual(outcome.end, { kind: "completed", steps: 2 });
  assert.equal(r.calls.filter((c) => c === "evaluate").length, 1);
});

test("two applications print two lines, in the body's order", async () => {
  const outcome = await launch({ createKernel: createStandInKernel, program: TWO, configuration: ONLY_OUTPUT, target: TERMINAL });
  assert.deepEqual(outcome.lines, ["first", "second"]);
  assert.equal(outcome.end.kind, "completed");
});

test("the lines also reach the caller's sink as they are printed", async () => {
  const seen: string[] = [];
  await launch({ createKernel: createStandInKernel, program: TWO, configuration: ONLY_OUTPUT, target: TERMINAL, onLine: (l) => seen.push(l) });
  assert.deepEqual(seen, ["first", "second"]);
});

test("a record that does not check is refused with its findings, and no kernel call is made", async () => {
  const r = recording();
  const bad = { ...HELLO, version: 2, nodes: [...HELLO.nodes, { k: "evaluate" }] };
  const outcome = await launch({ createKernel: r.createKernel, program: bad, configuration: ONLY_OUTPUT, target: TERMINAL });
  assert.equal(outcome.end.kind, "refused");
  assert.equal(outcome.end.kind === "refused" && outcome.end.reason, "the saved program does not check");
  assert.deepEqual(outcome.end.kind === "refused" && outcome.end.findings, check(bad));
  assert.ok(check(bad).some((f) => /version is not 1/.test(f)));
  assert.equal(r.created(), 1);
  assert.deepEqual(r.calls, []);
  assert.deepEqual(outcome.lines, []);
});

test("a declared capability the ceiling does not grant is refused, by name, before anything is evaluated", async () => {
  const r = recording();
  const outcome = await launch({ createKernel: r.createKernel, program: HELLO, configuration: { ceiling: [] }, target: TERMINAL });
  assert.equal(outcome.end.kind, "refused");
  assert.match(describe(outcome.end), /declares the capability output, which the ceiling does not grant/);
  assert.deepEqual(r.calls, []);
  assert.deepEqual(outcome.lines, []);
});

test("a ceiling that names a capability the target does not supply is refused", async () => {
  const outcome = await launch({ createKernel: createStandInKernel, program: HELLO, configuration: { ceiling: ["output", "files"] }, target: TERMINAL });
  assert.match(describe(outcome.end), /grants files, which this target does not supply/);
});

test("inputs and module parameters are refused in this part, with a plain reason", async () => {
  const withInput: SavedProgram = {
    ...HELLO,
    nodes: [{ k: "param", name: "out" }, { k: "param", name: "n" }, { k: "expression", fn: 0, args: [1] }, { k: "function", params: [0, 1], body: 2 }],
    declares: [{ param: 0, role: "capability", name: "output" }, { param: 1, role: "input", name: "n" }],
  };
  assert.match(describe((await launch({ createKernel: createStandInKernel, program: withInput, configuration: ONLY_OUTPUT, target: TERMINAL })).end), /supplies no inputs yet/);
  const withModule = { ...withInput, declares: [withInput.declares[0], { param: 1, role: "module", name: "lib" }] };
  assert.match(describe((await launch({ createKernel: createStandInKernel, program: withModule, configuration: ONLY_OUTPUT, target: TERMINAL })).end), /supplies no modules yet/);
});

test("a record that needs a primitive hash the target lacks is refused, before any kernel call", async () => {
  const r = recording();
  const outcome = await launch({ createKernel: r.createKernel, program: NEEDS_ECHO, configuration: ONLY_OUTPUT, target: TERMINAL });
  assert.equal(outcome.end.kind, "refused");
  assert.match(describe(outcome.end), /lacks the primitive test\.echo/);
  assert.deepEqual(r.calls, []);
  const supplied = await launch({ createKernel: createStandInKernel, program: NEEDS_ECHO, configuration: ONLY_OUTPUT, target: { ...TERMINAL, primitives: [ECHO] } });
  assert.deepEqual(supplied.lines, ["pure"]);
  assert.equal(supplied.end.kind, "completed");
});

test("a step budget of zero, or too few, stops at the limit and says so", async () => {
  const zero = await launch({ createKernel: createStandInKernel, program: HELLO, configuration: { ceiling: ["output"], steps: 0 }, target: TERMINAL });
  assert.deepEqual(zero.end, { kind: "limit", steps: 0, reason: "the step budget of 0 ran out" });
  assert.deepEqual(zero.lines, []);
  const few = await launch({ createKernel: createStandInKernel, program: TWO, configuration: { ceiling: ["output"], steps: 2 }, target: TERMINAL });
  assert.equal(few.end.kind, "limit");
  assert.match(describe(few.end), /^limit: the step budget of 2 ran out$/);
  const enough = await launch({ createKernel: createStandInKernel, program: TWO, configuration: { ceiling: ["output"], steps: 3 }, target: TERMINAL });
  assert.deepEqual(enough.end, { kind: "completed", steps: 3 });
});

test("an answer that arrives later is filled and advanced, and the run completes only then", async () => {
  const later = laterCapability();
  const r = recording();
  const run = launch({ createKernel: r.createKernel, program: LATER, configuration: { ceiling: ["later", "output"] }, target: { capabilities: [output, later.capability] } });
  let settled = false;
  void run.then(() => (settled = true));
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(settled, false);
  assert.equal(later.asked(), 1);
  assert.deepEqual(r.calls.filter((c) => evaluating.includes(c) || c === "fill"), ["evaluate"]);
  later.answer("arrived");
  const outcome = await run;
  assert.deepEqual(outcome.lines, ["arrived"]);
  assert.equal(outcome.end.kind, "completed");
  assert.deepEqual(r.calls.filter((c) => evaluating.includes(c) || c === "fill"), ["evaluate", "fill", "advance"]);
});

test("a cell that no capability will answer ends the run as waiting, not completed", async () => {
  const stuck: CapabilityImplementation = {
    definition: { name: "later", parts: ["ask"] },
    create: () => [{ purity: "effectful", capability: "later", part: "ask", arity: 0, run: (_a, context) => context.cell() as Cell }],
  };
  const outcome = await launch({ createKernel: createStandInKernel, program: LATER, configuration: { ceiling: ["later", "output"] }, target: { capabilities: [output, stuck] } });
  assert.equal(outcome.end.kind, "waiting");
  assert.deepEqual(outcome.lines, []);
});

test("a refutation the kernel records ends the run as refuted, and says what it cannot say", async () => {
  const refuting = () => {
    const inner = createStandInKernel();
    return { ...inner, evaluate: (...a: Parameters<Kernel["evaluate"]>) => ({ ...inner.evaluate(...a), refuted: true }) };
  };
  const outcome = await launch({ createKernel: refuting, program: HELLO, configuration: ONLY_OUTPUT, target: TERMINAL });
  assert.equal(outcome.end.kind, "refuted");
  assert.match(describe(outcome.end), /gives no explanation/);
});

test("the kernel is created once, and output's part is the only effectful primitive made when the ceiling grants only output", async () => {
  const r = recording();
  const later = laterCapability();
  await launch({ createKernel: r.createKernel, program: HELLO, configuration: ONLY_OUTPUT, target: { capabilities: [output, later.capability], primitives: [ECHO] } });
  assert.equal(r.created(), 1);
  const effectful = r.made.filter((d) => d.purity === "effectful");
  assert.equal(effectful.length, 1);
  assert.deepEqual(effectful.map((d) => d.purity === "effectful" && [d.capability, d.part]), [[OUTPUT.name, OUTPUT.parts[0]]]);
  assert.equal(r.made.length, 1, "no pure primitive is made that the record does not need");
});

test("output's part refuses what is not UTF-8 text, and the launcher reports the fault", async () => {
  const notText: SavedProgram = { ...HELLO, nodes: [HELLO.nodes[0], { k: "bits", hex: "ff", bits: 8 }, HELLO.nodes[2], HELLO.nodes[3]] };
  const outcome = await launch({ createKernel: createStandInKernel, program: notText, configuration: ONLY_OUTPUT, target: TERMINAL });
  assert.equal(outcome.end.kind, "fault");
  assert.deepEqual(outcome.lines, []);
});

test("the terminal entry never loads the stand-in kernel", () => {
  const source = fs.readFileSync(path.join(here, "terminal.ts"), "utf8");
  assert.doesNotMatch(source, /import[^;]*stand-in/);
  assert.match(source, /KERNEL_MODULE = "next\/kernel\/create\.ts"/);
});

test("the launcher, the output capability and the stand-in reach no host API", () => {
  for (const file of ["launcher.ts", "output.ts", "stand-in-kernel.for-tests.ts"]) {
    const source = fs.readFileSync(path.join(here, file), "utf8").replace(/^\s*\/\/.*$/gm, "");
    assert.doesNotMatch(source, /\bprocess\.|from "fs"|from "path"|\bBuffer\b/, file);
  }
});
