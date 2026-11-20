// Tests of the minimal launcher (B-196 (the rebuild's acceptance side),
// chunk Q7 (the minimal launcher), parts 1 to 3, and chunk Q5 (the first
// notation and the bootstrap), part 3): next/launch/launcher.ts
// and the output capability next/launch/output.ts, on the kernel
// `createKernel` of next/kernel/create.ts gives: the reference kernel, or
// the variant that keeps its own stack with `ALLEGRO_KERNEL=machine`. Run
// by `npm run test:next`. The tests of what a result holds are chunk Q13
// (check and run as configurations, and what a result holds), part 1.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { Cell, Kernel, PrimitiveContext, PrimitiveDeclaration, Value } from "../kernel/interface.js";
import { createKernel } from "../kernel/create.js";
import { check2, encode, outcomeKeys, type Node, type SavedProgram } from "../kernel/saved-program.js";
import { emit } from "../bootstrap/emit.js";
import { drive } from "../bootstrap/driver.js";
import { describe, launch, summaryOf, type CapabilityImplementation, type ClaimResult, type Configuration, type LaunchOutcome, type LaunchResult, type Plain, type Target } from "./launcher.js";
import { timer } from "./timer.js";
import { virtualClock } from "./clock.js";
import { OUTPUT, output } from "./output.js";
import { shipped } from "../prims/index.js";

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
 * module(later, output) => then(later.ask(), output.write(greeting)): a
 * cell no capability answers, and a name nothing binds. The two are
 * statements, so they are a link of `then`, never a structure's entries:
 * an entry is evaluated only when something reads it.
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
function recording(): { createKernel: () => Kernel; created: () => number; calls: string[]; made: PrimitiveDeclaration[] } {
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
  // How many steps the run takes is the kernel's and the emitter's to say: it
  // moves when either changes what a statement stands for. The run completes
  // and reports the steps it spent.
  assert.equal(outcome.end.kind, "completed");
  assert.ok(outcome.end.kind === "completed" && outcome.end.steps > 0);
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

test("a module declaration whose identity no supplied record has is refused, with a plain reason, before anything is evaluated", async () => {
  const withModule: SavedProgram = (() => {
    const r = new Record();
    const out = r.capability("output");
    const lib = r.param("lib");
    r.params.push(lib);
    const doc = r.done(r.apply(r.part(out, "write"), [r.text("never")]));
    return { ...doc, declares: [...doc.declares, { param: lib, role: "module", name: "lib", identity: "sha256:" + "ee".repeat(32) }] };
  })();
  assert.deepEqual(check2(withModule), []);
  const r = recording();
  const outcome = await launch({ createKernel: r.createKernel, program: withModule, configuration: ONLY_OUTPUT, target: TERMINAL });
  assert.equal(describe(outcome.end), `refused: the saved program imports the module lib with the identity sha256:${"ee".repeat(32)}, which no supplied record has`);
  assert.ok(!r.calls.includes("evaluate"));
  assert.deepEqual(outcome.lines, []);
  const none = { ...withModule, declares: withModule.declares.map((d) => (d.role === "module" ? { param: d.param, role: d.role, name: d.name } : d)) };
  const unnamed = await launch({ createKernel, program: none, configuration: ONLY_OUTPUT, target: TERMINAL });
  assert.equal(describe(unnamed.end), "refused: the saved program imports the module lib with no identity declared");
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
  // A kernel that stops at a limit of its own: it gives every evaluation 50 steps, though the launcher sets none.
  // The launcher gives no default budget (the maintainer's ruling of 2026-11-20), so on a kernel with no
  // limit of its own this program would not end; the test does not rest on where a kernel's stack runs out.
  const stopsByItself = (): Kernel => {
    const inner = createKernel();
    return new Proxy(inner, {
      get(target, name, receiver) {
        const v = Reflect.get(target, name, receiver);
        if (name !== "evaluate" || typeof v !== "function") return v;
        return (expression: unknown, budget: { steps?: number } = {}) => {
          assert.equal(budget.steps, undefined, "the launcher sets no budget where the configuration sets none");
          return (v as (...a: unknown[]) => unknown).call(target, expression, { steps: 50 });
        };
      },
    });
  };
  const outcome = await launch({ createKernel: stopsByItself, program: NEVER_ENDS, configuration: ONLY_OUTPUT, target: TERMINAL });
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
    inputs: [],
  });
  assert.deepEqual(outcome.lines, []);
});

// "A free name never gets a value": ruled 2026-11-17. These two tests rest
// on the ruling alone: a run whose record uses a name nothing binds never
// completes, writes nothing through that name, and is told which name. How
// the kernel says so is the kernel's: it refuses to make a module with a
// free name, so the record does not load.
test("a name nothing binds never gets a value: the run does not complete, writes nothing, and its end names the name", async () => {
  const outcome = await launch({ createKernel, program: UNBOUND, configuration: ONLY_OUTPUT, target: TERMINAL });
  assert.notEqual(outcome.end.kind, "completed");
  assert.match(describe(outcome.end), /greeting/);
  assert.deepEqual(outcome.lines, []);
});

test("a free name beside a cell no capability answers: the run does not complete, and its end names the name", async () => {
  const stuck: CapabilityImplementation = {
    definition: { name: "later", parts: ["ask"] },
    create: () => [{ purity: "effectful", capability: "later", part: "ask", arity: 0, run: (_a, context) => context.cell() as Cell }],
  };
  const outcome = await launch({ createKernel, program: BOTH, configuration: { ceiling: ["later", "output"] }, target: { capabilities: [output, stuck] } });
  assert.notEqual(outcome.end.kind, "completed");
  assert.match(describe(outcome.end), /greeting/);
  assert.deepEqual(outcome.lines, []);
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
    const other = inner.evaluate(inner.expression(inner.kernelPrimitive("if"), [inner.bits(Uint8Array.of(7)), inner.structure([]), inner.structure([])])).value;
    return { ...inner, advance: (...a: Parameters<Kernel["advance"]>) => {
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

test("output's part refuses what is not UTF-8 text: a refutation with the part's reason, and no line", async () => {
  const outcome = await launch({ createKernel, program: writes({ hex: "ff", bits: 8 }), configuration: ONLY_OUTPUT, target: TERMINAL });
  assert.equal(outcome.end.kind, "refuted");
  assert.match(outcome.end.kind === "refuted" ? outcome.end.reason : "", /output\.write takes bits read as UTF-8 text/);
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
  // The code alone: the header comment names the stand-in kernel to say it is never loaded.
  assert.doesNotMatch(source.replace(/^\s*\/\/.*$/gm, ""), /import[^;]*stand-in/);
  assert.match(source, /KERNEL_MODULE = "next\/kernel\/create\.ts"/);
});

test("the launcher and the output capability reach no host API", () => {
  for (const file of ["launcher.ts", "output.ts"]) {
    const source = fs.readFileSync(path.join(here, file), "utf8").replace(/^\s*\/\/.*$/gm, "");
    assert.doesNotMatch(source, /\bprocess\.|from "fs"|from "path"|\bBuffer\b/, file);
  }
});


// ── Inputs (chunk Q7, part 3) ─────────────────────────────────────────

/** The record the emitter writes for an Allegretto text, as JSON round-trips it. */
function emitted(text: string): SavedProgram {
  const r = emit(text);
  assert.ok(r.ok, r.ok ? "" : r.findings.map((f) => f.message).join("; "));
  return JSON.parse(encode(r.program)) as SavedProgram;
}
const textData = (t: string): Plain => ({ bits: new TextEncoder().encode(t) });
const SHIPPED_TARGET: Target = { capabilities: [output], primitives: shipped };

/** input n: it prints a line, then n, then a line. */
const PRINTS_N = emitted('capability output\ninput n\noutput.write("before")\noutput.write(n)\noutput.write("after")\n');
/** inputs a and b, each printed in turn. */
const PRINTS_A_B = emitted('capability output\ninput a\ninput b\noutput.write("start")\noutput.write(a)\noutput.write(b)\n');

test("an input the configuration supplies at the start is handed as its plain data, by its declared name", async () => {
  const r = recording();
  const outcome = await launch({ createKernel: r.createKernel, program: PRINTS_N, configuration: { ceiling: ["output"], inputs: { n: textData("supplied") } }, target: TERMINAL });
  assert.deepEqual(outcome.lines, ["before", "supplied", "after"]);
  assert.equal(outcome.end.kind, "completed");
  assert.deepEqual(outcome.linesBeforePhase, []);
  assert.ok(!r.calls.includes("fill"), "an input supplied at the start fills no cell");
});

test("an input not supplied is a cell: the run evaluates what does not depend on it, and ends waiting on the input, by name", async () => {
  const outcome = await launch({ createKernel, program: PRINTS_N, configuration: ONLY_OUTPUT, target: TERMINAL });
  assert.deepEqual(outcome.lines, ["before"]);
  assert.equal(outcome.end.kind, "waiting");
  assert.deepEqual(outcome.end.kind === "waiting" && [outcome.end.unanswered, outcome.end.inputs], [0, ["n"]]);
  assert.equal(describe(outcome.end), "waiting: the program waits on the input(s) n, which the configuration does not supply");
});

test("an input the module does not declare is refused, by name, before anything is evaluated: at the start and in a later phase", async () => {
  const configurations: Configuration[] = [
    { ceiling: ["output"], inputs: { n: textData("x"), m: textData("y") } },
    { ceiling: ["output"], later: [{ n: textData("x") }, { m: textData("y") }] },
  ];
  for (const configuration of configurations) {
    const r = recording();
    const outcome = await launch({ createKernel: r.createKernel, program: PRINTS_N, configuration, target: TERMINAL });
    assert.equal(outcome.end.kind, "refused");
    assert.match(describe(outcome.end), /^refused: the configuration supplies the input m (at the start|in later phase 2), which the module does not declare$/);
    assert.ok(!r.calls.includes("evaluate"));
    assert.deepEqual(outcome.lines, []);
  }
});

test("an input supplied more than once is refused, by name, before anything is evaluated: at the start and later, or in two later phases", async () => {
  const cases: Array<[Configuration, string]> = [
    [{ ceiling: ["output"], inputs: { n: textData("x") }, later: [{ n: textData("y") }] }, "the configuration supplies the input n at the start and again in later phase 1"],
    [{ ceiling: ["output"], later: [{ n: textData("x") }, { n: textData("y") }] }, "the configuration supplies the input n in later phase 1 and again in later phase 2"],
  ];
  for (const [configuration, reason] of cases) {
    const r = recording();
    const outcome = await launch({ createKernel: r.createKernel, program: PRINTS_N, configuration, target: TERMINAL });
    assert.equal(outcome.end.kind === "refused" && outcome.end.reason, reason);
    assert.ok(!r.calls.includes("evaluate"));
  }
});

test("a later phase is applied when the kernel waits: its inputs are filled, advance runs, and the lines printed before it are counted", async () => {
  const r = recording();
  const outcome = await launch({ createKernel: r.createKernel, program: PRINTS_N, configuration: { ceiling: ["output"], later: [{ n: textData("late") }] }, target: TERMINAL });
  assert.deepEqual(outcome.lines, ["before", "late", "after"]);
  assert.equal(outcome.end.kind, "completed");
  assert.deepEqual(outcome.linesBeforePhase, [1]);
  assert.deepEqual(r.calls.filter((c) => evaluating.includes(c) || c === "fill"), ["evaluate", "fill", "advance"]);
});

test("later phases are applied in order, one at a time", async () => {
  const r = recording();
  const outcome = await launch({ createKernel: r.createKernel, program: PRINTS_A_B, configuration: { ceiling: ["output"], later: [{ a: textData("one") }, { b: textData("two") }] }, target: TERMINAL });
  assert.deepEqual(outcome.lines, ["start", "one", "two"]);
  assert.deepEqual(outcome.linesBeforePhase, [1, 2]);
  assert.deepEqual(r.calls.filter((c) => evaluating.includes(c) || c === "fill"), ["evaluate", "fill", "advance", "fill", "advance"]);
  // Supplied in the other order, a phase fills b first; a waits until the second, and output keeps its written order.
  const swapped = await launch({ createKernel, program: PRINTS_A_B, configuration: { ceiling: ["output"], later: [{ b: textData("two") }, { a: textData("one") }] }, target: TERMINAL });
  assert.deepEqual(swapped.lines, ["start", "one", "two"]);
  assert.deepEqual(swapped.linesBeforePhase, [1, 1]);
});

test("a later phase waits while a capability's answer is due, and is applied only once nothing is due", async () => {
  const later = laterCapability();
  const program = emitted("capability later\ncapability output\ninput n\noutput.write(later.ask())\noutput.write(n)\n");
  const run = launch({ createKernel, program, configuration: { ceiling: ["later", "output"], later: [{ n: textData("from the phase") }] }, target: { capabilities: [output, later.capability] } });
  await new Promise((resolve) => setTimeout(resolve, 10));
  later.answer("from the capability");
  const outcome = await run;
  assert.deepEqual(outcome.lines, ["from the capability", "from the phase"]);
  assert.deepEqual(outcome.linesBeforePhase, [1]);
  assert.equal(outcome.end.kind, "completed");
});

test("when nothing waits the run has completed, and the phases left are not applied", async () => {
  const r = recording();
  const unused = emitted('capability output\ninput n\noutput.write("done")\n');
  const outcome = await launch({ createKernel: r.createKernel, program: unused, configuration: { ceiling: ["output"], later: [{ n: textData("x") }] }, target: TERMINAL });
  assert.deepEqual(outcome.lines, ["done"]);
  assert.equal(outcome.end.kind, "completed");
  assert.deepEqual(outcome.linesBeforePhase, []);
  assert.ok(!r.calls.includes("fill"));
  const once = emitted("capability output\ninput a\ninput b\noutput.write(a)\n");
  const left = await launch({ createKernel, program: once, configuration: { ceiling: ["output"], later: [{ a: textData("one") }, { b: textData("two") }] }, target: TERMINAL });
  assert.deepEqual(left.lines, ["one"]);
  assert.equal(left.end.kind, "completed");
  assert.deepEqual(left.linesBeforePhase, [0]);
});

test("a run left waiting after its phases names the inputs no phase supplied", async () => {
  const outcome = await launch({ createKernel, program: PRINTS_A_B, configuration: { ceiling: ["output"], later: [{ a: textData("one") }] }, target: TERMINAL });
  assert.deepEqual(outcome.lines, ["start", "one"]);
  assert.deepEqual(outcome.linesBeforePhase, [1]);
  assert.deepEqual(outcome.end.kind === "waiting" && outcome.end.inputs, ["b"]);
  assert.equal(describe(outcome.end), "waiting: the program waits on the input(s) b, which the configuration does not supply");
});

test("the end names the inputs beside the unanswered cells, and the cells of inputs are not counted as unanswered", async () => {
  // module(later, output, n) => then(later.ask(), output.write(n)).
  const program: SavedProgram = (() => {
    const r = new Record();
    const later = r.capability("later");
    const out = r.capability("output");
    const n = r.param("n");
    r.params.push(n);
    const doc = r.done(r.then(r.apply(r.part(later, "ask"), []), r.apply(r.part(out, "write"), [n])));
    return { ...doc, declares: [...doc.declares, { param: n, role: "input", name: "n" }] };
  })();
  assert.deepEqual(check2(program), []);
  const stuck: CapabilityImplementation = {
    definition: { name: "later", parts: ["ask"] },
    create: () => [{ purity: "effectful", capability: "later", part: "ask", arity: 0, run: (_a, context) => context.cell() as Cell }],
  };
  const outcome = await launch({ createKernel, program, configuration: { ceiling: ["later", "output"] }, target: { capabilities: [output, stuck] } });
  assert.equal(outcome.end.kind, "waiting");
  assert.deepEqual(outcome.end.kind === "waiting" && [outcome.end.unanswered, outcome.end.inputs], [1, ["n"]]);
  assert.match(describe(outcome.end), /1 cell\(s\) that no capability will answer and on the input\(s\) n, which the configuration does not supply/);
});

test("a later phase advances under the same step budget as the evaluation before it", async () => {
  const configuration = (steps?: number): Configuration => ({ ceiling: ["output"], steps, later: [{ n: textData("late") }] });
  const full = await launch({ createKernel, program: PRINTS_N, configuration: configuration(), target: TERMINAL });
  const needed = full.end.kind === "completed" ? full.end.steps : -1;
  const first = await launch({ createKernel, program: PRINTS_N, configuration: { ceiling: ["output"] }, target: TERMINAL });
  const before = first.end.kind === "waiting" ? first.end.steps : -1;
  assert.ok(before > 0 && needed > before, "the phase spends steps of its own");
  const few = await launch({ createKernel, program: PRINTS_N, configuration: configuration(needed - 1), target: TERMINAL });
  assert.deepEqual(few.end, { kind: "limit", steps: needed - 1, reason: `the step budget of ${needed - 1} ran out` });
  assert.deepEqual(few.linesBeforePhase, [1]);
  const enough = await launch({ createKernel, program: PRINTS_N, configuration: configuration(needed), target: TERMINAL });
  assert.deepEqual(enough.end, { kind: "completed", steps: needed });
});

test("an input of each kind of plain data is handed as data: bits, a symbol, a structure", async () => {
  const program = emitted('capability output\ninput t\ninput s\ninput p\noutput.write(t)\noutput.write(if s == `a then "true" else "false")\noutput.write(int.text(p.x + p.y[0]))\n');
  const seven = { bits: Uint8Array.of(0, 0, 0, 0, 0, 0, 0, 7), bitLength: 64 };
  const p: Plain = { entries: [[{ symbol: "x" }, seven], [{ symbol: "y" }, { entries: [[null, seven]] }]] };
  const configurations: Configuration[] = [
    { ceiling: ["output"], inputs: { t: textData("text"), s: { symbol: "a" }, p } },
    { ceiling: ["output"], later: [{ t: textData("text") }, { s: { symbol: "a" } }, { p }] },
  ];
  for (const configuration of configurations) {
    const outcome = await launch({ createKernel, program, configuration, target: SHIPPED_TARGET });
    assert.deepEqual(outcome.lines, ["text", "true", "14"]);
    assert.equal(outcome.end.kind, "completed");
  }
});

test("the launcher does not import the bootstrap", () => {
  const source = fs.readFileSync(path.join(here, "launcher.ts"), "utf8").replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(source, /from "\.\.\/bootstrap\//);
});

test("npm run allegretto takes --input and --later: each later phase in the order written; a value that is not a literal, or a flag with no =, exits 1", () => {
  const run = (...args: string[]) => spawnSync(process.execPath, ["--import", "tsx", path.join(here, "allegretto.ts"), ...args], { cwd: ROOT, encoding: "utf8", timeout: 30000 });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "allegretto-inputs-"));
  try {
    const file = path.join(dir, "inputs.alg");
    fs.writeFileSync(file, 'capability output\ninput a\ninput b\noutput.write("start")\noutput.write(a)\noutput.write(int.text(b + 1))\n');
    const atStart = run(file, "--input", 'a="one"', "--input", "b=-3");
    assert.equal(atStart.stderr, "");
    assert.equal(atStart.stdout, "start\none\n-2\n");
    assert.equal(atStart.status, 0);
    const phased = run(file, "--later", 'b=41', "--later", 'a="one"', "--steps", "1000");
    assert.equal(phased.stdout, "start\none\n42\n");
    assert.equal(phased.status, 0);
    const missing = run(file, "--input", 'a="one"');
    assert.equal(missing.stdout, "start\none\n");
    assert.equal(missing.stderr, "waiting: the program waits on the input(s) b, which the configuration does not supply\n");
    assert.equal(missing.status, 1);
    const notLiteral = run(file, "--input", "a=x + 1");
    assert.equal(notLiteral.stdout, "");
    assert.match(notLiteral.stderr, /^--input a=x \+ 1: an input's value is a literal/);
    assert.equal(notLiteral.status, 1);
    const noEquals = run(file, "--later", "a");
    assert.match(noEquals.stderr, /^--later a: no = between the input's name and its value\nusage: npm run allegretto -- <file\.alg>/);
    assert.equal(noEquals.status, 1);
    const undeclared = run(file, "--input", "c=1");
    assert.equal(undeclared.stderr, "refused: the configuration supplies the input c at the start, which the module does not declare\n");
    assert.equal(undeclared.status, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});


// ── Imports (chunk Q7, part 4) ────────────────────────────────────────

/** The records of a main text and the texts it imports, as the bootstrap's driver emits them, in load order, as JSON round-trips them. */
function drivenRecords(main: string, files: { readonly [name: string]: string }): SavedProgram[] {
  const r = drive(main, "dir/main.alg", (file) => files[path.basename(file, ".alg")]);
  assert.ok(r.ok, r.ok ? "" : r.findings.map((f) => f.message).join("; "));
  return r.records.map((x) => JSON.parse(encode(x.program)) as SavedProgram);
}
/** Launches the last record with the others as its imports, in order. */
async function launchDriven(records: SavedProgram[], configuration: Configuration = ONLY_OUTPUT, createKernelFor = createKernel) {
  return launch({ createKernel: createKernelFor, program: records[records.length - 1], imports: records.slice(0, -1), configuration, target: SHIPPED_TARGET });
}

test("the records of imported modules are loaded into the same kernel before the main one, and none is called by the launcher", async () => {
  const records = drivenRecords('capability output\nimport lib\noutput.write("main")\noutput.write(int.text(lib.double(21)))\n', {
    lib: 'capability output\noutput.write("lib instantiated")\nexport double(n) => n * 2\n',
  });
  const r = recording();
  const outcome = await launchDriven(records, ONLY_OUTPUT, r.createKernel);
  assert.deepEqual(outcome.lines, ["main", "lib instantiated", "42"]);
  assert.equal(outcome.end.kind, "completed");
  assert.equal(r.created(), 1);
  assert.equal(r.calls.filter((c) => c === "module").length, 2, "load makes each record a module in the one kernel");
  assert.equal(r.calls.filter((c) => c === "evaluate").length, 1, "only the main module is called");
  assert.ok(r.calls.indexOf("module") < r.calls.indexOf("evaluate"));
});

test("an imported module that nothing needs is loaded and never instantiated", async () => {
  const records = drivenRecords('capability output\nimport lib\noutput.write("main")\n', { lib: 'capability output\noutput.write("lib instantiated")\n' });
  const outcome = await launchDriven(records);
  assert.deepEqual(outcome.lines, ["main"]);
  assert.equal(outcome.end.kind, "completed");
});

test("an imported module gets a capability only as the importing module hands it: withheld, its use is a refutation with the reason", async () => {
  const lib = 'capability output\nexport quiet() => 7\nexport loud() => output.write("from lib")\n';
  const quiet = await launchDriven(drivenRecords("capability output\nimport lib without output\noutput.write(int.text(lib.quiet()))\n", { lib }));
  assert.deepEqual(quiet.lines, ["7"]);
  assert.equal(quiet.end.kind, "completed");
  const loud = await launchDriven(drivenRecords('capability output\nimport lib without output\noutput.write("before")\nlib.loud()\noutput.write("after")\n', { lib }));
  assert.deepEqual(loud.lines, ["before"]);
  assert.equal(describe(loud.end), "refuted: the capability output was withheld by the importing module");
});

test("an imported record is not handed the ceiling's capabilities: one that the importing module does not hold is the emitter's finding", () => {
  const r = drive("import lib\n", "dir/main.alg", () => "capability output\nexport f() => 1\n");
  assert.equal(r.ok, false);
  assert.match(r.ok ? "" : r.findings[0].message, /lib declares the capability output, which this module neither holds under that name/);
});

test("an imported record that does not check, or that the kernel does not load, is refused before anything is evaluated", async () => {
  const records = drivenRecords("capability output\nimport lib\noutput.write(lib.t)\n", { lib: 'export t = "x"\n' });
  const [lib, main] = records;
  const bad = { ...lib, version: 3 };
  const r = recording();
  const notChecked = await launch({ createKernel: r.createKernel, program: main, imports: [bad], configuration: ONLY_OUTPUT, target: SHIPPED_TARGET });
  assert.equal(notChecked.end.kind, "refused");
  assert.equal(notChecked.end.kind === "refused" && notChecked.end.reason, "an imported record does not check");
  assert.ok(notChecked.end.kind === "refused" && notChecked.end.findings.includes("imported record 1: version is not 1 or 2"));
  assert.deepEqual(r.calls, []);
  // A record whose stored outcome's key is wrong does not load where the configuration restores outcomes.
  const wrongKey = withOutcome("sha256:" + "00".repeat(32));
  const notLoaded = await launch({ createKernel, program: main, imports: [wrongKey, lib], configuration: { ceiling: ["output"], restoreAs: "builder-a" }, target: SHIPPED_TARGET });
  assert.match(describe(notLoaded.end), /^refused: the kernel refused to load an imported record\n  imported record 1: restore: the key does not match/);
  // The record is there, but the main record imports another identity: refused, naming it.
  const missing = await launch({ createKernel, program: main, imports: [], configuration: ONLY_OUTPUT, target: SHIPPED_TARGET });
  assert.match(describe(missing.end), /^refused: the saved program imports the module lib with the identity sha256:[0-9a-f]{64}, which no supplied record has$/);
  const supplied = await launch({ createKernel, program: main, imports: [lib], configuration: ONLY_OUTPUT, target: SHIPPED_TARGET });
  assert.deepEqual(supplied.lines, ["x"]);
});

test("the pure primitives every record needs are supplied, an imported one's among them", async () => {
  const records = drivenRecords("capability output\nimport lib\noutput.write(lib.t)\n", { lib: "export t = int.text(6 * 7)\n" });
  assert.equal(records[1].needs.length, 0);
  assert.ok(records[0].needs.length > 0);
  const outcome = await launchDriven(records);
  assert.deepEqual(outcome.lines, ["42"]);
  const lacking = await launch({ createKernel, program: records[1], imports: [records[0]], configuration: ONLY_OUTPUT, target: TERMINAL });
  assert.match(describe(lacking.end), /^refused: the target lacks a primitive the saved program needs\n  the target lacks the primitive int\.(mul|text)/);
});

test("the main module's inputs come from the configuration, and an imported module's from the importing module", async () => {
  const records = drivenRecords("capability output\ninput n\nimport lib with m: n + 1\noutput.write(int.text(lib.twice))\n", { lib: "input m\nexport twice = m * 2\n" });
  const outcome = await launchDriven(records, { ceiling: ["output"], inputs: { n: { bits: Uint8Array.of(0, 0, 0, 0, 0, 0, 0, 20), bitLength: 64 } } });
  assert.deepEqual(outcome.lines, ["42"]);
  const later = await launchDriven(records, { ceiling: ["output"], later: [{ n: { bits: Uint8Array.of(0, 0, 0, 0, 0, 0, 0, 3), bitLength: 64 } }] });
  assert.deepEqual(later.lines, ["8"]);
  assert.deepEqual(later.linesBeforePhase, [0]);
});

test("npm run launch takes the imported records by --import, in load order", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "launch-imports-"));
  try {
    const [lib, main] = drivenRecords("capability output\nimport lib\noutput.write(lib.t)\n", { lib: 'export t = "from lib"\n' });
    fs.writeFileSync(path.join(dir, "lib.json"), encode(lib));
    fs.writeFileSync(path.join(dir, "main.json"), encode(main));
    const run = (...args: string[]) => spawnSync(process.execPath, ["--import", "tsx", path.join(here, "terminal.ts"), ...args], { cwd: ROOT, encoding: "utf8", timeout: 30000 });
    const ok = run(path.join(dir, "main.json"), "--import", path.join(dir, "lib.json"));
    assert.equal(ok.stderr, "");
    assert.equal(ok.stdout, "from lib\n");
    assert.equal(ok.status, 0);
    const without = run(path.join(dir, "main.json"));
    assert.match(without.stderr, /^refused: the saved program imports the module lib with the identity sha256:[0-9a-f]{64}, which no supplied record has\n$/);
    assert.equal(without.status, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("npm run allegretto runs a text that imports: the imported texts are found beside it, emitted and loaded first; a text not found is refused", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "allegretto-imports-"));
  try {
    const main = path.join(dir, "main.alg");
    fs.writeFileSync(main, 'capability output\nimport greeter with name: "world"\ngreeter.greet()\n');
    fs.writeFileSync(path.join(dir, "greeter.alg"), 'capability output\ninput name\nexport greet() => output.write("hello, " ++ name)\n');
    const run = () => spawnSync(process.execPath, ["--import", "tsx", path.join(here, "allegretto.ts"), main], { cwd: ROOT, encoding: "utf8", timeout: 30000 });
    const ok = run();
    assert.equal(ok.stderr, "");
    assert.equal(ok.stdout, "hello, world\n");
    assert.equal(ok.status, 0);
    fs.rmSync(path.join(dir, "greeter.alg"));
    const missing = run();
    assert.equal(missing.stdout, "");
    assert.equal(missing.stderr, `${main}:2:1: the text greeter.alg, which import greeter names, is not found in the directory of main.alg\n`);
    assert.equal(missing.status, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});


// ── What a result holds (chunk Q13, part 1) ───────────────────────────
//
// Every test here passes on both kernel variants. It asserts what must be
// present in a result, never that something is absent, and no step count.

/** The result of a run, which every end but a refusal carries. */
function resultOf(outcome: LaunchOutcome): LaunchResult {
  assert.notEqual(outcome.end.kind, "refused", describe(outcome.end));
  assert.ok(outcome.result !== undefined, "every end but a refusal carries a result");
  return outcome.result;
}
/** The four counts and the level of a claim's entry, in that order. */
const counts = (c: ClaimResult) => [c.decided, c.assumed, c.undecided, c.refuted, c.waiting];
/** The entry with these counts and level; it fails when there is none. */
function entryWith(result: LaunchResult, expected: readonly number[]): ClaimResult {
  const found = result.claims.find((c) => JSON.stringify(counts(c)) === JSON.stringify(expected));
  assert.ok(found !== undefined, `no claim with the counts ${JSON.stringify(expected)} among ${JSON.stringify(result.claims.map(counts))}`);
  return found;
}
const run = (program: SavedProgram, configuration: Configuration = ONLY_OUTPUT) => launch({ createKernel, program, configuration, target: SHIPPED_TARGET });
const variant = createKernel().variant;
const primitiveNames = (c: ClaimResult) => c.restsOn.flatMap((r) => (r.kind === "primitive" ? [r.name] : []));

test("a claim evaluated once is one entry with one decided evaluation, the module that wrote it, and what it rests on", async () => {
  const outcome = await run(emitted("capability output\nsquare(n) => n * n\nclaim(square(7) == 49)\n"));
  assert.equal(outcome.end.kind, "completed");
  const result = resultOf(outcome);
  const claim = entryWith(result, [1, 0, 0, 0, 0]);
  assert.equal(claim.module, result.restsOn.modules[result.restsOn.modules.length - 1], "the module run wrote it");
  assert.ok(claim.restsOn.some((r) => r.kind === "kernel" && r.variant === variant));
  assert.ok(primitiveNames(claim).includes("int.mul"));
  assert.match(claim.at ?? "", /^sha256:[0-9a-f]{64}$/, "a claim of a module is told apart by its key");
  assert.equal(result.summary, "decided");
});

test("a claim inside a recursion is one entry, its counts summed over every evaluation", async () => {
  // f(5) evaluates the claim in f's body six times, for 5 down to 0.
  const outcome = await run(emitted("capability output\nf(n) => sync\n  claim(n >= 0)\n  if n == 0 then 0 else f(n - 1)\nclaim(f(5) == 0)\n"));
  assert.equal(outcome.end.kind, "completed");
  const result = resultOf(outcome);
  const inBody = entryWith(result, [6, 0, 0, 0, 0]);
  assert.ok(primitiveNames(inBody).includes("int.ge"));
  assert.equal(result.summary, "decided");
});

test("a claim that waits on an answer is counted once it is decided, and its level is back at zero", async () => {
  const later = laterCapability();
  const program = emitted('capability later\nclaim(later.ask() == "yes")\n');
  const pending = launch({ createKernel, program, configuration: { ceiling: ["later"] }, target: { capabilities: [later.capability], primitives: shipped } });
  await new Promise((resolve) => setTimeout(resolve, 10));
  later.answer("yes");
  const outcome = await pending;
  assert.equal(outcome.end.kind, "completed");
  const result = resultOf(outcome);
  const claim = entryWith(result, [1, 0, 0, 0, 0]);
  assert.ok(claim.restsOn.some((r) => r.kind === "capability" && r.capability === "later" && r.part === "ask"), "it rests on the answer it read");
  assert.equal(result.summary, "decided");
});

test("a claim that still waits when the run ends gives its level, and the summary is undecided", async () => {
  const outcome = await run(PRINTS_N);
  assert.equal(outcome.end.kind, "waiting");
  const result = resultOf(outcome);
  // The write of n is a statement whose value is dropped: its claim waits on the input.
  assert.ok(result.claims.some((c) => c.waiting > 0), JSON.stringify(result.claims.map(counts)));
  assert.equal(result.summary, "undecided");
});

test("a refuted claim is an entry with its refuted evaluation and the reason the kernel gives", async () => {
  const outcome = await run(FALSE_CLAIM);
  assert.equal(outcome.end.kind, "refuted");
  const result = resultOf(outcome);
  const claim = result.claims.find((c) => c.refuted === 1);
  assert.ok(claim !== undefined, JSON.stringify(result.claims.map(counts)));
  assert.deepEqual(claim.reasons, ["a claim that is not true"]);
  assert.equal(result.summary, "refuted");
});

test("an assumed claim is counted assumed and rests on the module that made the assumption", async () => {
  const outcome = await run(emitted('capability output\nassume(1 == 2)\noutput.write("after")\n'));
  assert.deepEqual(outcome.lines, ["after"]);
  const result = resultOf(outcome);
  const main = result.restsOn.modules[result.restsOn.modules.length - 1];
  const claim = entryWith(result, [0, 1, 0, 0, 0]);
  assert.ok(claim.restsOn.some((r) => r.kind === "assumption" && r.by === main), JSON.stringify(claim.restsOn));
  assert.equal(result.summary, "assumed");
});

test("an attempt that reaches its limit: the claim that goes on from its answer rests on a limit", async () => {
  const outcome = await run(emitted("capability output\ndown(n) => if n == 0 then 0 else down(n - 1)\nr <- attempt(down(1000), 50)\nclaim(is_failure(r))\n"));
  assert.equal(outcome.end.kind, "completed");
  const result = resultOf(outcome);
  const claim = entryWith(result, [1, 0, 0, 0, 0]);
  assert.ok(claim.restsOn.some((r) => r.kind === "limit"), JSON.stringify(claim.restsOn));
  // What rests on a limit is recorded beside the word and never changes it.
  assert.equal(result.summary, "decided");
});

test("the summary is the weakest strength among the claims: each word the kernel can give", async () => {
  const cases: Array<[string, string]> = [
    ["capability output\nclaim(1 == 1)\n", "decided"],
    ["capability output\nclaim(1 == 1)\nassume(1 == 1)\n", "assumed"],
    ['capability output\nassume(1 == 1)\nclaim(undecided("no rule decides this"))\n', "undecided"],
    ['capability output\nclaim(undecided("no rule decides this"))\nclaim(1 == 2)\n', "refuted"],
  ];
  for (const [text, summary] of cases) {
    const result = resultOf(await run(emitted(text)));
    assert.equal(result.summary, summary, text);
  }
  // The undecided claim gives its reason.
  const undecided = resultOf(await run(emitted('capability output\nclaim(undecided("no rule decides this"))\n')));
  assert.deepEqual(entryWith(undecided, [0, 0, 1, 0, 0]).reasons, ["no rule decides this"]);
});

test("the summary's rule, on entries written by hand: refuted, then undecided or waiting, then assumed, then decided; with no claim, decided", () => {
  const entry = (over: Partial<ClaimResult>): ClaimResult => ({ decided: 0, assumed: 0, undecided: 0, refuted: 0, waiting: 0, reasons: [], restsOn: [], ...over });
  const decided = entry({ decided: 3 });
  assert.equal(summaryOf([]), "decided", "a run with no claim: nothing in it is weaker");
  assert.equal(summaryOf([decided]), "decided");
  assert.equal(summaryOf([decided, entry({ decided: 1, assumed: 1 })]), "assumed");
  assert.equal(summaryOf([decided, entry({ decided: 1, waiting: 1 })]), "undecided", "a claim that still waits is undecided");
  assert.equal(summaryOf([entry({ assumed: 2 }), entry({ undecided: 1 })]), "undecided");
  assert.equal(summaryOf([entry({ undecided: 1 }), entry({ decided: 5, refuted: 1 })]), "refuted");
});

test("a run with no claim has the summary decided", async () => {
  // TWO is a chain of `then` written by hand: it holds no claim.
  const outcome = await launch({ createKernel, program: TWO, configuration: ONLY_OUTPUT, target: TERMINAL });
  assert.equal(outcome.end.kind, "completed");
  assert.equal(resultOf(outcome).summary, "decided");
});

test("what the run rests on: the kernel variant, the primitives, the modules in load order, the capabilities declared, the builder", async () => {
  const records = drivenRecords("capability output\ncapability timer\nimport lib\noutput.write(int.text(lib.double(timer.wait(21))))\n", {
    lib: "export double(n) => n * 2\n",
  });
  const [lib, main] = records;
  const configuration: Configuration = { ceiling: ["output", "timer"], restoreAs: "builder-a" };
  const target: Target = { capabilities: [output, timer(virtualClock().clock)], primitives: shipped };
  const outcome = await launch({ createKernel, program: main, imports: [lib], configuration, target });
  assert.deepEqual(outcome.lines, ["42"]);
  const { restsOn } = resultOf(outcome);
  assert.equal(restsOn.kernel, variant);
  for (const n of [...lib.needs, ...main.needs]) assert.ok(restsOn.primitives.some((p) => p.hash === n.hash && p.name === n.name), n.name);
  assert.equal(new Set(restsOn.primitives.map((p) => p.hash)).size, restsOn.primitives.length, "each primitive once");
  const libIdentity = main.declares.find((d) => d.role === "module")?.identity;
  assert.equal(restsOn.modules[0], libIdentity, "the imported module is loaded first");
  assert.match(restsOn.modules[1] ?? "", /^sha256:[0-9a-f]{64}$/, "and then the module run");
  assert.deepEqual(restsOn.capabilities, ["output", "timer"]);
  assert.equal(restsOn.builder, "builder-a");
});

test("the result holds no kernel handle: it survives JSON unchanged", async () => {
  const outcomes = [
    await run(emitted("capability output\ndown(n) => if n == 0 then 0 else down(n - 1)\nr <- attempt(down(1000), 50)\nclaim(is_failure(r))\nassume(1 == 2)\n")),
    await run(FALSE_CLAIM),
    await run(PRINTS_N),
  ];
  for (const outcome of outcomes) {
    const result = resultOf(outcome);
    assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
  }
});
