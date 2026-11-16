// Tests of the minimal launcher (B-196 (the rebuild's acceptance side),
// chunk Q7 (the minimal launcher), parts 1 and 2, and chunk Q5 (the first
// notation and the bootstrap), part 3): next/launch/launcher.ts
// and the output capability next/launch/output.ts, on the reference
// kernel, `createKernel` of next/kernel/create.ts. Run by
// `npm run test:next`.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import type { Cell, Kernel2, PrimitiveContext, PrimitiveDeclaration, Value } from "../kernel/interface.js";
import { createKernel } from "../kernel/create.js";
import { check2, encode, outcomeKeys, type Node, type SavedProgram } from "../kernel/saved-program.js";
import { emit } from "../bootstrap/emit.js";
import { describe, launch, type CapabilityImplementation, type Configuration, type Plain, type Target } from "./launcher.js";
import { OUTPUT, output } from "./output.js";

const here = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(here, "../..");
const FIXTURE = path.join(here, "fixtures", "hello.json");
const FIXTURE_TEXT = path.join(here, "fixtures", "hello.alg");
const hex = (text: string) => Array.from(new TextEncoder().encode(text), (b) => b.toString(16).padStart(2, "0")).join("");

/** Writes a record by hand, node by node, as the emitter would: of the second version, each part of a capability read as an entry. */
class Record {
  readonly nodes: Node[] = [];
  readonly params: number[] = [];
  readonly keySlots: number[] = [];
  readonly declares: Array<{ param: number; role: "capability"; name: string }> = [];
  add(n: Node): number {
    this.nodes.push(n);
    return this.nodes.length - 1;
  }
  param(name: string): number {
    return this.add({ k: "param", name });
  }
  /** A key slot: one of the module function's first parameters. */
  keySlot(name: string): number {
    const p = this.param(name);
    this.keySlots.push(p);
    return p;
  }
  /** A capability the module declares: a parameter of the module function. */
  capability(name: string): number {
    const p = this.param(name);
    this.params.push(p);
    this.declares.push({ param: p, role: "capability", name });
    return p;
  }
  text(t: string): number {
    return this.add({ k: "bits", hex: hex(t), bits: new TextEncoder().encode(t).length * 8 });
  }
  kernel(name: string): number {
    return this.add({ k: "kernel", name });
  }
  apply(fn: number, args: readonly number[]): number {
    return this.add({ k: "expression", fn, args });
  }
  /** The part of a capability: get(capability, `part). */
  part(capability: number, part: string): number {
    return this.apply(this.kernel("get"), [capability, this.add({ k: "datum", fqn: part })]);
  }
  /** then(first, second). */
  then(first: number, second: number): number {
    return this.apply(this.kernel("then"), [first, second]);
  }
  done(body: number, more: Partial<SavedProgram> = {}): SavedProgram {
    const module = this.add({ k: "function", params: [...this.keySlots, ...this.params], body });
    return { format: "allegro-saved-program", version: 2, needs: [], nodes: this.nodes, module, declares: this.declares, keys: this.keySlots.length, outcomes: [], ...more };
  }
}

/** The fixture of next/launch/fixtures/hello.json: then(output.write("hello, world"), {}), as the emitter writes it. */
const HELLO = JSON.parse(fs.readFileSync(FIXTURE, "utf8")) as SavedProgram;

/** module(output) => output.write("first") then output.write("second"). */
const TWO: SavedProgram = (() => {
  const r = new Record();
  const out = r.capability("output");
  const write = r.part(out, "write");
  return r.done(r.then(r.apply(write, [r.text("first")]), r.apply(write, [r.text("second")])));
})();

const ADD = "sha256:" + "ab".repeat(32);
/** module(output) => output.write(echo("pure")), with echo a pure primitive named by hash. */
const NEEDS_ECHO: SavedProgram = (() => {
  const r = new Record();
  const out = r.capability("output");
  const echo = r.add({ k: "primitive", hash: ADD });
  return r.done(r.apply(r.part(out, "write"), [r.apply(echo, [r.text("pure")])]), { needs: [{ hash: ADD, name: "test.echo" }] });
})();
const ECHO: PrimitiveDeclaration = { purity: "pure", hash: ADD, name: "test.echo", arity: 1, run: ([v]) => v };

/** module(output) => claim(false) then output.write("after"): the claim is refuted and the line is never written. */
const FALSE_CLAIM: SavedProgram = (() => {
  const r = new Record();
  const out = r.capability("output");
  const claim = r.apply(r.kernel("claim"), [r.add({ k: "bits", hex: "00", bits: 1 })]);
  return r.done(r.then(claim, r.apply(r.part(out, "write"), [r.text("after")])));
})();

/** module(output) => output.write(greeting), where nothing binds the name greeting. */
const UNBOUND: SavedProgram = (() => {
  const r = new Record();
  const out = r.capability("output");
  return r.done(r.apply(r.part(out, "write"), [r.add({ k: "symbol", fqn: "greeting" })]));
})();

/** module(output) => output.write(the given bits): for a value that is not text. */
function writes(bits: { hex: string; bits: number }): SavedProgram {
  const r = new Record();
  const out = r.capability("output");
  return r.done(r.apply(r.part(out, "write"), [r.add({ k: "bits", ...bits })]));
}

/**
 * A record with a key slot: module(key, output) =>
 * claim(true) then output.write("hello, world"), with the claim's outcome
 * stored under `key`.
 */
function withOutcome(key: string): SavedProgram {
  const r = new Record();
  r.keySlot("key");
  const out = r.capability("output");
  const claim = r.apply(r.kernel("claim"), [r.add({ k: "bits", hex: "01", bits: 1 })]);
  return r.done(r.then(claim, r.apply(r.part(out, "write"), [r.text("hello, world")])), { outcomes: [{ claim, restsOn: [{ kind: "kernel", variant: "reference-k3" }], key }] });
}

/** module(later, output) => output.write(later.ask()): the line is written only once the answer arrives. */
const LATER: SavedProgram = (() => {
  const r = new Record();
  const later = r.capability("later");
  const out = r.capability("output");
  return r.done(r.apply(r.part(out, "write"), [r.apply(r.part(later, "ask"), [])]));
})();

/** module(later, output) => claim(later.ask()): the claim is decided only once the answer arrives. */
const CLAIM_LATER: SavedProgram = (() => {
  const r = new Record();
  const later = r.capability("later");
  r.capability("output");
  return r.done(r.apply(r.kernel("claim"), [r.apply(r.part(later, "ask"), [])]));
})();

/**
 * module(later, output) => then(later.ask(), output.write(greeting)): it
 * waits on a cell and on a name. The two are statements, so they are a
 * link of `then`, never a structure's entries: an entry is evaluated only
 * when something reads it. While the first waits, the kernel evaluates the
 * second ahead and meets the name.
 */
const BOTH: SavedProgram = (() => {
  const r = new Record();
  const later = r.capability("later");
  const out = r.capability("output");
  const asked = r.apply(r.part(later, "ask"), []);
  const wrote = r.apply(r.part(out, "write"), [r.add({ k: "symbol", fqn: "greeting" })]);
  return r.done(r.then(asked, wrote));
})();

/** module(pair) => pair.left("one") then pair.right("two"): a capability of two parts. */
const PAIR: SavedProgram = (() => {
  const r = new Record();
  const pair = r.capability("pair");
  return r.done(r.then(r.apply(r.part(pair, "left"), [r.text("one")]), r.apply(r.part(pair, "right"), [r.text("two")])));
})();

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

test("the committed fixture is the record the emitter writes for hello.alg, and every record here checks", () => {
  const r = emit(fs.readFileSync(FIXTURE_TEXT, "utf8"));
  assert.ok(r.ok, r.ok ? "" : r.findings.map((f) => f.message).join("; "));
  assert.equal(fs.readFileSync(FIXTURE, "utf8"), encode(r.program));
  assert.equal(fs.readFileSync(FIXTURE_TEXT, "utf8"), 'capability output\noutput.write("hello, world")\n');
  for (const p of [HELLO, TWO, NEEDS_ECHO, LATER, CLAIM_LATER, BOTH, PAIR, FALSE_CLAIM, UNBOUND, NEVER_ENDS, writes({ hex: "ff", bits: 8 })]) assert.deepEqual(check2(p), []);
  assert.deepEqual(check2(withOutcome("sha256:" + "00".repeat(32))), []);
});

test("a capability is handed as a structure of its parts, keyed by the symbols of the part names: one of two parts", async () => {
  const said: string[] = [];
  const pair: CapabilityImplementation = {
    definition: { name: "pair", parts: ["left", "right"] },
    create: (host) => ["left", "right"].map((part) => ({
      purity: "effectful" as const, capability: "pair", part, arity: 1,
      run: (args: readonly Value[], context: PrimitiveContext) => {
        const { bytes } = context.bitsOf(args[0]);
        said.push(part);
        host.line(`${part}: ${new TextDecoder().decode(bytes)}`);
        return context.structure([]);
      },
    })),
  };
  const outcome = await launch({ createKernel, program: PAIR, configuration: { ceiling: ["pair"] }, target: { capabilities: [pair] } });
  assert.deepEqual(outcome.lines, ["left: one", "right: two"]);
  assert.deepEqual(said, ["left", "right"]);
  assert.equal(outcome.end.kind, "completed");
});

test("a module that applies output to a text prints that line once and completes", async () => {
  const r = recording();
  const outcome = await launch({ createKernel: r.createKernel, program: JSON.parse(fs.readFileSync(FIXTURE, "utf8")), configuration: ONLY_OUTPUT, target: TERMINAL });
  assert.deepEqual(outcome.lines, ["hello, world"]);
  // The application of the module, `then`, the application of the part, and `get`.
  assert.deepEqual(outcome.end, { kind: "completed", steps: 4 });
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
  assert.ok(check2(bad).some((f) => new RegExp(`nodes\\[${HELLO.nodes.length}\\] is not a node of a known kind`).test(f)));
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
  const withInput: SavedProgram = (() => {
    const r = new Record();
    const out = r.capability("output");
    const n = r.param("n");
    r.params.push(n);
    const doc = r.done(r.apply(r.part(out, "write"), [n]));
    return { ...doc, declares: [...doc.declares, { param: n, role: "input", name: "n" }] };
  })();
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
  const full = await launch({ createKernel, program: TWO, configuration: ONLY_OUTPUT, target: TERMINAL });
  const needed = full.end.kind === "completed" ? full.end.steps : -1;
  assert.ok(needed > 0);
  const few = await launch({ createKernel, program: TWO, configuration: { ceiling: ["output"], steps: needed - 1 }, target: TERMINAL });
  assert.equal(few.end.kind, "limit");
  assert.equal(describe(few.end), `limit: the step budget of ${needed - 1} ran out`);
  const enough = await launch({ createKernel, program: TWO, configuration: { ceiling: ["output"], steps: needed }, target: TERMINAL });
  assert.deepEqual(enough.end, { kind: "completed", steps: needed });
});

/**
 * module(out) => (f => f(f))(f => f(f)): an application that never ends.
 * A hand-built record for the launcher's test; an emitted program never
 * applies a function to itself.
 */
const NEVER_ENDS: SavedProgram = (() => {
  const r = new Record();
  r.capability("output");
  const f = r.param("f");
  const self = r.add({ k: "function", params: [f], body: r.apply(f, [f]) });
  const g = r.param("g");
  const other = r.add({ k: "function", params: [g], body: r.apply(g, [g]) });
  return r.done(r.apply(self, [other]));
})();

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
  const outcome = await launch({ createKernel, program: writes({ hex: "ff", bits: 8 }), configuration: ONLY_OUTPUT, target: TERMINAL });
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
