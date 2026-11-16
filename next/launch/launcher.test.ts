// Tests of the minimal launcher (B-196 (the rebuild's acceptance side),
// chunk Q7 (the minimal launcher), parts 1 and 2): next/launch/launcher.ts
// and the output capability next/launch/output.ts, on the reference
// kernel, `createKernel` of next/kernel/create.ts. Run by
// `npm run test:next`.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import type { Cell, Kernel2, PrimitiveDeclaration } from "../kernel/interface.js";
import { createKernel } from "../kernel/create.js";
import { check, check2, encode, outcomeKeys, type SavedProgram } from "../kernel/saved-program.js";
import { describe, launch, type CapabilityImplementation, type Configuration, type Plain, type Target } from "./launcher.js";
import { OUTPUT, output } from "./output.js";

const here = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(here, "../..");
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
 * structure of two applications, which the reference kernel evaluates in
 * entry order; that order is the kernel's choice and awaits a ruling.
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

const TRUE_BIT = { k: "bits", hex: "01", bits: 1 } as const;
const FALSE_BIT = { k: "bits", hex: "00", bits: 1 } as const;

/** module(out) => [claim(false), out("after")]: the claim is refuted and the line is never written. */
const FALSE_CLAIM: SavedProgram = {
  ...HELLO,
  nodes: [
    { k: "param", name: "out" },
    { k: "kernel", name: "claim" },
    FALSE_BIT,
    { k: "expression", fn: 1, args: [2] },
    text("after"),
    { k: "expression", fn: 0, args: [4] },
    { k: "structure", entries: [[null, 3], [null, 5]] },
    { k: "function", params: [0], body: 6 },
  ],
  module: 7,
};

/** module(out) => out(greeting), where nothing binds the name greeting. */
const UNBOUND: SavedProgram = {
  ...HELLO,
  nodes: [
    { k: "param", name: "out" },
    { k: "symbol", fqn: "greeting" },
    { k: "expression", fn: 0, args: [1] },
    { k: "function", params: [0], body: 2 },
  ],
  module: 3,
};

/**
 * A record of the second version: module(key, out) =>
 * [claim(true), out("hello, world")], with one key slot and the claim's
 * outcome stored under `key`.
 */
function withOutcome(key: string): SavedProgram {
  return {
    format: "allegro-saved-program",
    version: 2,
    needs: [],
    nodes: [
      { k: "param", name: "key" },
      { k: "param", name: "out" },
      { k: "kernel", name: "claim" },
      TRUE_BIT,
      { k: "expression", fn: 2, args: [3] },
      text("hello, world"),
      { k: "expression", fn: 1, args: [5] },
      { k: "structure", entries: [[null, 4], [null, 6]] },
      { k: "function", params: [0, 1], body: 7 },
    ],
    module: 8,
    declares: [{ param: 1, role: "capability", name: "output" }],
    keys: 1,
    outcomes: [{ claim: 4, restsOn: [{ kind: "kernel", variant: "reference-k3" }], key }],
  };
}

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

/** module(later, out) => claim(later.ask()): the claim is decided only once the answer arrives. */
const CLAIM_LATER: SavedProgram = {
  ...LATER,
  nodes: [
    { k: "param", name: "later" },
    { k: "param", name: "out" },
    { k: "kernel", name: "claim" },
    { k: "expression", fn: 0, args: [] },
    { k: "expression", fn: 2, args: [3] },
    { k: "function", params: [0, 1], body: 4 },
  ],
  module: 5,
};

/** module(later, out) => [later.ask(), out(greeting)]: it waits on a cell and on a name. */
const BOTH: SavedProgram = {
  ...LATER,
  nodes: [
    { k: "param", name: "later" },
    { k: "param", name: "out" },
    { k: "expression", fn: 0, args: [] },
    { k: "symbol", fqn: "greeting" },
    { k: "expression", fn: 1, args: [3] },
    { k: "structure", entries: [[null, 2], [null, 4]] },
    { k: "function", params: [0, 1], body: 5 },
  ],
  module: 6,
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

/** The reference kernel wrapped so every function called on it is recorded by name. */
function recording(): { createKernel: () => Kernel2; created: () => number; calls: string[]; made: PrimitiveDeclaration[] } {
  const calls: string[] = [];
  const made: PrimitiveDeclaration[] = [];
  let created = 0;
  const create = () => {
    created++;
    const inner = createKernel();
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
  return { createKernel: create, created: () => created, calls, made };
}

const ONLY_OUTPUT: Configuration = { ceiling: ["output"] };
const TERMINAL: Target = { capabilities: [output] };
const evaluating = ["evaluate", "advance"];

test("the fixture is HELLO, written with encode, and checks", () => {
  assert.equal(fs.readFileSync(FIXTURE, "utf8"), encode(HELLO));
  assert.deepEqual(check(JSON.parse(fs.readFileSync(FIXTURE, "utf8"))), []);
  for (const p of [TWO, NEEDS_ECHO, LATER, FALSE_CLAIM, UNBOUND]) assert.deepEqual(check(p), []);
  assert.deepEqual(check2(withOutcome("sha256:" + "00".repeat(32))), []);
});

test("a module that applies output to a text prints that line once and completes", async () => {
  const r = recording();
  const outcome = await launch({ createKernel: r.createKernel, program: JSON.parse(fs.readFileSync(FIXTURE, "utf8")), configuration: ONLY_OUTPUT, target: TERMINAL });
  assert.deepEqual(outcome.lines, ["hello, world"]);
  assert.deepEqual(outcome.end, { kind: "completed", steps: 2 });
  assert.equal(r.calls.filter((c) => c === "evaluate").length, 1);
});

test("two applications print two lines, in the body's order", async () => {
  const outcome = await launch({ createKernel, program: TWO, configuration: ONLY_OUTPUT, target: TERMINAL });
  assert.deepEqual(outcome.lines, ["first", "second"]);
  assert.equal(outcome.end.kind, "completed");
});

test("the lines also reach the caller's sink as they are printed", async () => {
  const seen: string[] = [];
  await launch({ createKernel, program: TWO, configuration: ONLY_OUTPUT, target: TERMINAL, onLine: (l) => seen.push(l) });
  assert.deepEqual(seen, ["first", "second"]);
});

test("a record that does not check is refused with its findings, and no kernel call is made", async () => {
  const r = recording();
  const bad = { ...HELLO, version: 3, nodes: [...HELLO.nodes, { k: "evaluate" }] };
  const outcome = await launch({ createKernel: r.createKernel, program: bad, configuration: ONLY_OUTPUT, target: TERMINAL });
  assert.equal(outcome.end.kind, "refused");
  assert.equal(outcome.end.kind === "refused" && outcome.end.reason, "the saved program does not check");
  assert.deepEqual(outcome.end.kind === "refused" && outcome.end.findings, check2(bad));
  assert.ok(check2(bad).some((f) => /version is not 1 or 2/.test(f)));
  assert.ok(check2(bad).some((f) => /nodes\[4\] is not a node of a known kind/.test(f)));
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
  const outcome = await launch({ createKernel, program: HELLO, configuration: { ceiling: ["output", "files"] }, target: TERMINAL });
  assert.match(describe(outcome.end), /grants files, which this target does not supply/);
});

test("inputs and module parameters are refused in this part, with a plain reason", async () => {
  const withInput: SavedProgram = {
    ...HELLO,
    nodes: [{ k: "param", name: "out" }, { k: "param", name: "n" }, { k: "expression", fn: 0, args: [1] }, { k: "function", params: [0, 1], body: 2 }],
    declares: [{ param: 0, role: "capability", name: "output" }, { param: 1, role: "input", name: "n" }],
  };
  assert.match(describe((await launch({ createKernel, program: withInput, configuration: ONLY_OUTPUT, target: TERMINAL })).end), /supplies no inputs yet/);
  const withModule = { ...withInput, declares: [withInput.declares[0], { param: 1, role: "module", name: "lib" }] };
  assert.match(describe((await launch({ createKernel, program: withModule, configuration: ONLY_OUTPUT, target: TERMINAL })).end), /supplies no modules yet/);
});

test("a record that needs a primitive hash the target lacks is refused, before any kernel call", async () => {
  const r = recording();
  const outcome = await launch({ createKernel: r.createKernel, program: NEEDS_ECHO, configuration: ONLY_OUTPUT, target: TERMINAL });
  assert.equal(outcome.end.kind, "refused");
  assert.match(describe(outcome.end), /lacks the primitive test\.echo/);
  assert.deepEqual(r.calls, []);
  const supplied = await launch({ createKernel, program: NEEDS_ECHO, configuration: ONLY_OUTPUT, target: { ...TERMINAL, primitives: [ECHO] } });
  assert.deepEqual(supplied.lines, ["pure"]);
  assert.equal(supplied.end.kind, "completed");
});

test("a step budget of zero, or too few, stops at the limit and says so", async () => {
  const zero = await launch({ createKernel, program: HELLO, configuration: { ceiling: ["output"], steps: 0 }, target: TERMINAL });
  assert.deepEqual(zero.end, { kind: "limit", steps: 0, reason: "the step budget of 0 ran out" });
  assert.deepEqual(zero.lines, []);
  const few = await launch({ createKernel, program: TWO, configuration: { ceiling: ["output"], steps: 2 }, target: TERMINAL });
  assert.equal(few.end.kind, "limit");
  assert.match(describe(few.end), /^limit: the step budget of 2 ran out$/);
  const enough = await launch({ createKernel, program: TWO, configuration: { ceiling: ["output"], steps: 3 }, target: TERMINAL });
  assert.deepEqual(enough.end, { kind: "completed", steps: 3 });
});

/**
 * module(out) => (f => f(f))(f => f(f)): an application that never ends.
 * A hand-built record for the launcher's test; an emitted program never
 * applies a function to itself.
 */
const NEVER_ENDS: SavedProgram = {
  ...HELLO,
  nodes: [
    { k: "param", name: "out" },
    { k: "param", name: "f" },
    { k: "expression", fn: 1, args: [1] },
    { k: "function", params: [1], body: 2 },
    { k: "param", name: "g" },
    { k: "expression", fn: 4, args: [4] },
    { k: "function", params: [4], body: 5 },
    { k: "expression", fn: 3, args: [6] },
    { k: "function", params: [0], body: 7 },
  ],
  module: 8,
};

test("with no step budget a run that ends at the kernel's own limit says that no budget was set", async () => {
  const outcome = await launch({ createKernel, program: NEVER_ENDS, configuration: ONLY_OUTPUT, target: TERMINAL });
  assert.equal(outcome.end.kind, "limit");
  assert.equal(describe(outcome.end), "limit: the kernel reached its own limit; no step budget was set");
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
  const outcome = await launch({ createKernel, program: LATER, configuration: { ceiling: ["later", "output"] }, target: { capabilities: [output, stuck] } });
  assert.deepEqual(outcome.end, {
    kind: "waiting",
    steps: outcome.end.kind === "waiting" ? outcome.end.steps : -1,
    reason: "the program waits on 1 cell(s) that no capability will answer",
    unanswered: 1,
    unbound: [],
  });
  assert.deepEqual(outcome.lines, []);
});

test("a name nothing binds ends the run as waiting, and the end names the name", async () => {
  const outcome = await launch({ createKernel, program: UNBOUND, configuration: ONLY_OUTPUT, target: TERMINAL });
  assert.equal(outcome.end.kind, "waiting");
  assert.deepEqual(outcome.end.kind === "waiting" && [outcome.end.unanswered, outcome.end.unbound], [0, ["greeting"]]);
  assert.equal(describe(outcome.end), "waiting: the program waits on the name(s) greeting, which nothing binds");
  assert.deepEqual(outcome.lines, []);
});

test("a run that waits on both is told apart: the unanswered cells are counted and the unbound names named", async () => {
  const stuck: CapabilityImplementation = {
    definition: { name: "later", parts: ["ask"] },
    create: () => [{ purity: "effectful", capability: "later", part: "ask", arity: 0, run: (_a, context) => context.cell() as Cell }],
  };
  const outcome = await launch({ createKernel, program: BOTH, configuration: { ceiling: ["later", "output"] }, target: { capabilities: [output, stuck] } });
  assert.equal(outcome.end.kind, "waiting");
  assert.deepEqual(outcome.end.kind === "waiting" && [outcome.end.unanswered, outcome.end.unbound], [1, ["greeting"]]);
  assert.match(describe(outcome.end), /1 cell\(s\) that no capability will answer and on the name\(s\) greeting, which nothing binds/);
});

test("a claim that is false ends the run as refuted, with the reason the kernel gives", async () => {
  const outcome = await launch({ createKernel, program: FALSE_CLAIM, configuration: ONLY_OUTPUT, target: TERMINAL });
  assert.equal(outcome.end.kind, "refuted");
  assert.deepEqual(outcome.end.kind === "refuted" && outcome.end.reasons, ["a claim that is not true"]);
  assert.equal(describe(outcome.end), "refuted: a claim that is not true");
  assert.deepEqual(outcome.lines, [], "the effect after the refuted claim is not performed");
});

test("a claim refuted once its answer arrives ends the run as refuted, and the outcome holds every reason the kernel reports", async () => {
  const later = laterCapability();
  const run = launch({ createKernel, program: CLAIM_LATER, configuration: { ceiling: ["later", "output"] }, target: { capabilities: [output, later.capability] } });
  later.answer("not a truth value");
  const one = await run;
  assert.deepEqual(one.end.kind === "refuted" && one.end.reasons, ["a claim that is not true"]);

  // The reference kernel reports one refuted value per run of one module.
  // This wrapper adds a second refuted value, made by the same kernel, to
  // what `advance` reports, so the test holds that the outcome keeps all.
  const twice = () => {
    const inner = createKernel();
    const other = inner.evaluate(inner.expression(inner.kernelPrimitive("if"), [inner.bits(Uint8Array.of(7)), inner.structure([]), inner.structure([])]), inner.scope()).value;
    return { ...inner, advance: (...a: Parameters<Kernel2["advance"]>) => {
      const r = inner.advance(...a);
      return { ...r, refuted: [...r.refuted, other] };
    } };
  };
  const again = laterCapability();
  const both = launch({ createKernel: twice, program: CLAIM_LATER, configuration: { ceiling: ["later", "output"] }, target: { capabilities: [output, again.capability] } });
  again.answer("not a truth value");
  const end = (await both).end;
  assert.deepEqual(end.kind === "refuted" && end.reasons, ["a claim that is not true", "a condition that is neither true nor false"]);
  assert.equal(describe(end), "refuted: a claim that is not true; a condition that is neither true nor false");
});

test("a record of the second version loads: its key slot is the kernel's, and its stored outcome is not looked at unless the configuration names the builder", async () => {
  const k = createKernel();
  const [key] = outcomeKeys(k, withOutcome("sha256:" + "00".repeat(32)), new Map());
  const v2 = withOutcome(key);

  const plain = recording();
  const ignored = await launch({ createKernel: plain.createKernel, program: v2, configuration: ONLY_OUTPUT, target: TERMINAL });
  assert.deepEqual(ignored.lines, ["hello, world"]);
  assert.equal(ignored.end.kind, "completed");
  assert.ok(plain.calls.includes("module"), "load makes the module and its key");
  assert.ok(!plain.calls.includes("restore"));

  const accepting = recording();
  const restored = await launch({ createKernel: accepting.createKernel, program: v2, configuration: { ceiling: ["output"], restoreAs: "builder-a" }, target: TERMINAL });
  assert.deepEqual(restored.lines, ["hello, world"]);
  assert.equal(restored.end.kind, "completed");
  assert.equal(accepting.calls.filter((c) => c === "restore").length, 1);
  assert.ok(restored.end.kind === "completed" && ignored.end.kind === "completed" && restored.end.steps < ignored.end.steps, "a restored claim is not evaluated again");

  const wrong = withOutcome("sha256:" + "00".repeat(32));
  const notLooked = await launch({ createKernel, program: wrong, configuration: ONLY_OUTPUT, target: TERMINAL });
  assert.equal(notLooked.end.kind, "completed", "without a builder named, a wrong stored key is not looked at");
  const r = recording();
  const refusedEnd = await launch({ createKernel: r.createKernel, program: wrong, configuration: { ceiling: ["output"], restoreAs: "builder-a" }, target: TERMINAL });
  assert.equal(refusedEnd.end.kind, "refused");
  assert.match(describe(refusedEnd.end), /^refused: the kernel refused to load the saved program\n  restore: the key does not match/);
  assert.ok(!r.calls.includes("evaluate"));
  assert.deepEqual(refusedEnd.lines, []);
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
  const outcome = await launch({ createKernel, program: notText, configuration: ONLY_OUTPUT, target: TERMINAL });
  assert.equal(outcome.end.kind, "fault");
  assert.deepEqual(outcome.lines, []);
});

test("the terminal entry runs the committed fixture: it prints the line and exits 0", () => {
  const run = spawnSync(process.execPath, ["--import", "tsx", path.join(here, "terminal.ts"), FIXTURE], { cwd: ROOT, encoding: "utf8", timeout: 30000 });
  assert.equal(run.stderr, "");
  assert.equal(run.stdout, "hello, world\n");
  assert.equal(run.status, 0);
});

test("the terminal entry never loads a stand-in kernel", () => {
  const source = fs.readFileSync(path.join(here, "terminal.ts"), "utf8");
  assert.doesNotMatch(source, /import[^;]*stand-in/);
  assert.match(source, /KERNEL_MODULE = "next\/kernel\/create\.ts"/);
});

test("the launcher and the output capability reach no host API", () => {
  for (const file of ["launcher.ts", "output.ts"]) {
    const source = fs.readFileSync(path.join(here, file), "utf8").replace(/^\s*\/\/.*$/gm, "");
    assert.doesNotMatch(source, /\bprocess\.|from "fs"|from "path"|\bBuffer\b/, file);
  }
});
