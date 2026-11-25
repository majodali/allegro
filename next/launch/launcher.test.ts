// Tests of the minimal launcher (B-196 (the rebuild's acceptance side),
// chunk Q7 (the minimal launcher), parts 1 to 3, and chunk Q5 (the first
// notation and the bootstrap), part 3): next/launch/launcher.ts
// and the output capability next/launch/output.ts, on the kernel
// `createKernel` of next/launch/kernel-variant.ts gives: the variant that
// keeps its own stack, and the reference kernel where
// next/launch/reference.test.ts loads this file. Run by
// `npm run test:next`. A test that spawns a command passes it `--kernel`
// with the variant in use. The tests of what a result holds are chunk Q13
// (check and run as configurations, and what a result holds), part 1; of
// the configuration's sources, part 2; of phases, part 3; of a check, and
// check then run, part 5; of the test phase, part 6; of a check on
// ordinary evaluation, and the checks, part 7. The tests of the
// two commands' exit code with check output are chunk Q16 (the
// capabilities the launchers ship), part 3.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { Cell, Kernel, PrimitiveContext, PrimitiveDeclaration, Value } from "../kernel/interface.js";
import { createKernel, kernelOf, usedVariant } from "./kernel-variant.js";
import { exitCode, resolveOnTerminal, runTarget, terminalReport } from "./terminal.js";
import { check2, encode, outcomeKeys, type Node, type SavedProgram } from "../kernel/saved-program.js";
import { emit } from "../bootstrap/emit.js";
import { drive } from "../bootstrap/driver.js";
import { claimWord, describe, launch, summaryOf, type CapabilityImplementation, type ClaimResult, type Configuration, type LaunchOutcome, type LaunchResult, type Phase, type Plain, type Target, type UntouchedData } from "./launcher.js";
import { timer } from "./timer.js";
import { virtualClock } from "./clock.js";
import { OUTPUT, output } from "./output.js";
import { shippedChecks, type Checks } from "./checks.js";
import { collector, messageLine, report, type ReportMessage } from "./report.js";
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

/** The kernel `createKernel` gives, wrapped so every function called on it is recorded by name. */
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

  // The kernel reports one refuted value per run of one module.
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
  const run = spawnSync(process.execPath, ["--import", "tsx", path.join(here, "terminal.ts"), "--kernel", usedVariant(), FIXTURE], { cwd: ROOT, encoding: "utf8", timeout: 30000 });
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
  const run = (...args: string[]) => spawnSync(process.execPath, ["--import", "tsx", path.join(here, "allegretto.ts"), "--kernel", usedVariant(), ...args], { cwd: ROOT, encoding: "utf8", timeout: 30000 });
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
    const run = (...args: string[]) => spawnSync(process.execPath, ["--import", "tsx", path.join(here, "terminal.ts"), "--kernel", usedVariant(), ...args], { cwd: ROOT, encoding: "utf8", timeout: 30000 });
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
    const run = () => spawnSync(process.execPath, ["--import", "tsx", path.join(here, "allegretto.ts"), "--kernel", usedVariant(), main], { cwd: ROOT, encoding: "utf8", timeout: 30000 });
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
  assert.match(claim.key ?? "", /^sha256:[0-9a-f]{64}$/, "a claim of a module is told apart by its key");
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
  const entry = (over: Partial<ClaimResult>): ClaimResult => ({ decided: 0, sampled: 0, assumed: 0, undecided: 0, refuted: 0, waiting: 0, reasons: [], restsOn: [], ...over });
  const decided = entry({ decided: 3 });
  assert.equal(summaryOf([]), "decided", "a run with no claim: nothing in it is weaker");
  assert.equal(summaryOf([decided]), "decided");
  assert.equal(summaryOf([decided, entry({ decided: 1, assumed: 1 })]), "assumed");
  assert.equal(summaryOf([decided, entry({ decided: 1, waiting: 1 })]), "undecided", "a claim that still waits is undecided");
  assert.equal(summaryOf([entry({ assumed: 2 }), entry({ undecided: 1 })]), "undecided");
  assert.equal(summaryOf([entry({ undecided: 1 }), entry({ decided: 5, refuted: 1 })]), "refuted");
});

test("a sampled claim is weaker than a decided one and stronger than an assumed one", () => {
  const entry = (over: Partial<ClaimResult>): ClaimResult => ({ decided: 0, sampled: 0, assumed: 0, undecided: 0, refuted: 0, waiting: 0, reasons: [], restsOn: [], ...over });
  assert.equal(summaryOf([entry({ decided: 3 }), entry({ sampled: 1 })]), "sampled");
  assert.equal(summaryOf([entry({ decided: 2, sampled: 1 })]), "sampled");
  assert.equal(summaryOf([entry({ sampled: 1 }), entry({ assumed: 1 })]), "assumed");
  assert.equal(summaryOf([entry({ sampled: 1, assumed: 1 })]), "assumed");
  assert.equal(summaryOf([entry({ sampled: 4 }), entry({ undecided: 1 })]), "undecided");
  assert.equal(summaryOf([entry({ sampled: 4, waiting: 1 })]), "undecided");
  assert.equal(summaryOf([entry({ sampled: 4 }), entry({ refuted: 1 })]), "refuted");
});

test("a claim the kernel samples is counted sampled, rests on the number of cases, and gives the summary sampled", async () => {
  // The notation does not write the kernel's `sample` yet. The text writes `first`, a kernel primitive of two arguments
  // too, and the record is changed to name `sample` in its place: `sample(claim, cases)` of next/kernel/interface.ts.
  const written = emitted("capability output\nholds(x) => x == x\nclaim(first(holds, [1, 2, 3]))\n");
  const program = JSON.parse(JSON.stringify(written).replaceAll('{"k":"kernel","name":"first"}', '{"k":"kernel","name":"sample"}')) as unknown;
  assert.notDeepEqual(program, written, "the record named `first`");
  const result = resultOf(await launch({ createKernel, program, configuration: { ceiling: ["output"] }, target: SHIPPED_TARGET }));
  const sampled = result.claims.filter((c) => c.sampled > 0);
  assert.ok(sampled.length > 0, JSON.stringify(result.claims));
  assert.ok(sampled.some((c) => c.restsOn.some((rest) => rest.kind === "kernel" && rest.sampled === 3)), JSON.stringify(sampled.map((c) => c.restsOn)));
  assert.equal(result.summary, "sampled");
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result, "the result is plain data");
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

// ── Where a claim was written (chunks Q5 and Q13, 2026-11-23) ─────────
//
// `at` is the plain data of the kernel's `ClaimRecord.at`, copied as
// the kernel gives it. `key` is the claim's key. The names are the kernel's.

/** A claim's place as `source:line:column-line:column`, for a short assertion. */
const placeText = (c: ClaimResult): string | undefined =>
  c.at === undefined ? undefined : `${c.at.source}:${c.at.start.line}:${c.at.start.column}-${c.at.end.line}:${c.at.end.column}`;

test("a result gives each claim the place it was written, and keeps its key in at", async () => {
  const text = "capability output\nclaim(1 == 1)\nassume(2 == 2)\noutput.write(\n  \"done\")\nclaim(3 == 4)\n";
  const result = resultOf(await run(emitted(text)));
  const places = result.claims.map(placeText);
  for (const p of ["<text>:2:1-2:14", "<text>:4:1-5:10", "<text>:6:1-6:14"]) assert.ok(places.includes(p), `${p} among ${JSON.stringify(places)}`);
  const refuted = result.claims.find((c) => placeText(c) === "<text>:6:1-6:14");
  assert.ok(refuted !== undefined && refuted.refuted === 1, "the claim at line 6 is the refuted one");
  assert.match(refuted.key ?? "", /^sha256:[0-9a-f]{64}$/, "key is the claim's key");
  const first = result.claims.find((c) => placeText(c) === "<text>:2:1-2:14");
  assert.deepEqual(first?.at, { source: "<text>", start: { index: text.indexOf("claim(1"), line: 2, column: 1 }, end: { index: text.indexOf("claim(1") + 13, line: 2, column: 14 } });
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result, "the result is plain data");
});

test("a claim in an imported module names that module's file", async () => {
  const records = drivenRecords("capability output\nimport lib\noutput.write(int.text(lib.double(21)))\n", { lib: "export double(n) => sync\n  claim(n >= 0)\n  n * 2\n" });
  const result = resultOf(await launchDriven(records));
  const inLib = result.claims.find((c) => c.at?.source === path.join("dir", "lib.alg"));
  assert.ok(inLib !== undefined, JSON.stringify(result.claims.map(placeText)));
  assert.deepEqual([inLib.at?.start.line, inLib.at?.start.column], [2, 3]);
  assert.equal(inLib.module, result.restsOn.modules[0], "the module that wrote it is the imported one");
  assert.ok(result.claims.some((c) => c.at?.source === "dir/main.alg"), "the write in the main text is a claim of its own file");
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
});

test("a claim that waits and is decided later keeps its place", async () => {
  const later = laterCapability();
  const program = emitted('capability later\nclaim(later.ask() == "yes")\n');
  const pending = launch({ createKernel, program, configuration: { ceiling: ["later"] }, target: { capabilities: [later.capability], primitives: shipped } });
  await new Promise((resolve) => setTimeout(resolve, 10));
  later.answer("yes");
  const outcome = await pending;
  assert.equal(outcome.end.kind, "completed");
  const result = resultOf(outcome);
  const claim = entryWith(result, [1, 0, 0, 0, 0]);
  assert.equal(placeText(claim), "<text>:2:1-2:28");
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
});

test("the word for one claim is the summary's rule, with waiting kept apart from undecided", () => {
  const entry = (over: Partial<ClaimResult>): ClaimResult => ({ decided: 0, sampled: 0, assumed: 0, undecided: 0, refuted: 0, waiting: 0, reasons: [], restsOn: [], ...over });
  assert.equal(claimWord(entry({ decided: 2 })), "decided");
  assert.equal(claimWord(entry({ decided: 1, sampled: 1 })), "sampled");
  assert.equal(claimWord(entry({ sampled: 1, assumed: 1 })), "assumed");
  assert.equal(claimWord(entry({ assumed: 1, waiting: 1 })), "waiting");
  assert.equal(claimWord(entry({ undecided: 1, waiting: 1 })), "undecided");
  assert.equal(claimWord(entry({ undecided: 1, refuted: 1 })), "refuted");
  for (const c of [entry({ decided: 1 }), entry({ sampled: 1 }), entry({ assumed: 1 }), entry({ waiting: 1 }), entry({ undecided: 1 }), entry({ refuted: 1 })]) {
    const word = claimWord(c);
    assert.equal(summaryOf([c]), word === "waiting" ? "undecided" : word, JSON.stringify(c));
  }
});


// ── A configuration from its sources (chunk Q13, part 2) ──────────────
//
// The two commands end to end, on a temporary directory: lines and exit
// codes only. The resolver's rules are tested in
// next/tools/configuration.test.ts.

/** Runs one of the two commands with the environment given, beside this process's own. */
function command(entry: "terminal.ts" | "allegretto.ts", args: readonly string[], env: { readonly [name: string]: string } = {}) {
  return spawnSync(process.execPath, ["--import", "tsx", path.join(here, entry), "--kernel", usedVariant(), ...args], { cwd: ROOT, encoding: "utf8", timeout: 30000, env: { ...process.env, ...env } });
}

test("npm run allegretto reads allegro.json beside its text: its inputs, and an input a flag replaces", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "allegretto-project-"));
  try {
    const file = path.join(dir, "main.alg");
    fs.writeFileSync(file, 'capability output\ninput a\ninput b\noutput.write(a)\noutput.write(b)\n');
    fs.writeFileSync(path.join(dir, "allegro.json"), JSON.stringify({ inputs: { a: '"a from the file"', b: '"b from the file"' } }));
    const fromFile = command("allegretto.ts", [file]);
    assert.equal(fromFile.stderr, "");
    assert.equal(fromFile.stdout, "a from the file\nb from the file\n");
    assert.equal(fromFile.status, 0);
    const replaced = command("allegretto.ts", [file, "--input", 'b="b from the flag"']);
    assert.equal(replaced.stdout, "a from the file\nb from the flag\n");
    assert.equal(replaced.status, 0);
    fs.writeFileSync(path.join(dir, "allegro.json"), JSON.stringify({ steps: 0, later: [{ a: '"late a"' }, { b: '"late b"' }] }));
    const fileSteps = command("allegretto.ts", [file]);
    assert.equal(fileSteps.stderr, "limit: the step budget of 0 ran out\n");
    assert.equal(fileSteps.status, 1);
    const fileLater = command("allegretto.ts", [file, "--steps", "10000000"]);
    assert.equal(fileLater.stdout, "late a\nlate b\n");
    assert.equal(fileLater.status, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("npm run allegretto refuses a project file with a finding: a setting it may not set, JSON that does not parse, an unknown key; exit 1 and nothing printed", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "allegretto-project-"));
  try {
    const file = path.join(dir, "main.alg");
    const project = path.join(dir, "allegro.json");
    fs.writeFileSync(file, 'capability output\noutput.write("ran")\n');
    fs.writeFileSync(project, JSON.stringify({ ceiling: ["output"] }));
    const ceiling = command("allegretto.ts", [file]);
    assert.equal(ceiling.stdout, "");
    assert.equal(ceiling.stderr, "the setting ceiling is set by the project's file allegro.json, which may not set it: only the command line and the launcher may\n");
    assert.equal(ceiling.status, 1);
    fs.writeFileSync(project, "{ not json");
    const notJson = command("allegretto.ts", [file]);
    assert.match(notJson.stderr, new RegExp(`^${project.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}: the file is not JSON: `));
    assert.equal(notJson.status, 1);
    fs.writeFileSync(project, JSON.stringify({ budget: 3 }));
    const unknown = command("allegretto.ts", [file]);
    assert.equal(unknown.stderr, `${project}: "budget" is not a setting; the settings are steps, inputs, later, ceiling, restore, kernel, phases\n`);
    assert.equal(unknown.status, 1);
    fs.rmSync(project);
    const none = command("allegretto.ts", [file]);
    assert.equal(none.stdout, "ran\n");
    assert.equal(none.status, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("npm run launch resolves from its flags and the launcher: --ceiling narrows, and a name the terminal does not supply is refused", () => {
  const ok = command("terminal.ts", [FIXTURE, "--ceiling", "output"]);
  assert.equal(ok.stdout, "hello, world\n");
  assert.equal(ok.status, 0);
  const narrowed = command("terminal.ts", [FIXTURE, "--ceiling", "timer,http"]);
  assert.equal(narrowed.stdout, "");
  assert.equal(narrowed.stderr, "refused: the module declares the capability output, which the ceiling does not grant\n");
  assert.equal(narrowed.status, 1);
  const wider = command("terminal.ts", [FIXTURE, "--ceiling", "output,files"]);
  assert.equal(wider.stderr, "the ceiling of the command line grants files, which the launcher's ceiling does not grant: a ceiling may only narrow the launcher's\n");
  assert.equal(wider.status, 1);
});

test("no setting comes from the environment: with ALLEGRO_STEPS set, each command runs as it does without it", () => {
  // The maintainer, 2026-11-25: "command line only" means ALLEGRO_STEPS should be removed.
  for (const value of ["0", "many"]) {
    for (const [entry, file] of [["terminal.ts", FIXTURE], ["allegretto.ts", FIXTURE_TEXT]] as const) {
      const r = command(entry, [file], { ALLEGRO_STEPS: value });
      assert.equal(r.stderr, "", `${entry} with ALLEGRO_STEPS=${value}`);
      assert.equal(r.stdout, "hello, world\n");
      assert.equal(r.status, 0);
    }
  }
  const budget = command("terminal.ts", [FIXTURE, "--steps", "0"], { ALLEGRO_STEPS: "10000000" });
  assert.equal(budget.stderr, "limit: the step budget of 0 ran out\n", "the budget is the command line's");
  assert.equal(budget.status, 1);
});


// ── The kernel variant from the command line (chunk Q13) ──────────────
//
// By the maintainer's ruling of 2026-11-23 the command line alone chooses
// the kernel variant: `--kernel <name>`, else the launcher's default,
// `machine` (`DEFAULT_KERNEL` of next/launch/kernel-variant.ts).

/** Runs a command with exactly these arguments, and no `--kernel` but the ones given. */
const bare = (entry: string, args: readonly string[]) => spawnSync(process.execPath, ["--import", "tsx", path.join(ROOT, entry), ...args], { cwd: ROOT, encoding: "utf8", timeout: 30000 });

test("--kernel names the variant, the result's restsOn shows it, and its source is the command line; with no flag it is the launcher's machine", async () => {
  for (const [commandLine, variant, source] of [[{ kernel: "reference" }, "reference", "command line"], [{ kernel: "machine" }, "machine", "command line"], [{}, "machine", "launcher"]] as const) {
    const resolved = resolveOnTerminal(commandLine);
    assert.equal(resolved.kernel, variant);
    const outcome = await launch({ createKernel: kernelOf(resolved.kernel), program: JSON.parse(fs.readFileSync(FIXTURE, "utf8")), configuration: resolved.configuration, sources: resolved.sources, target: runTarget(terminalReport(() => {}).sink) });
    assert.deepEqual(outcome.lines, ["hello, world"]);
    assert.match(outcome.result?.restsOn.kernel ?? "", new RegExp(`^${variant}-`), JSON.stringify(commandLine));
    assert.ok(outcome.result?.restsOn.configuration?.some((s) => s.setting === "kernel" && s.source === source), JSON.stringify(commandLine));
  }
});

test("each command runs with --kernel reference and --kernel machine, and refuses a name that is no variant before anything is evaluated: exit 1, the variants listed", () => {
  const refusal = 'the setting kernel is "neither", which names no kernel variant: the variants are reference and machine\n';
  for (const [entry, file] of [["next/launch/terminal.ts", FIXTURE], ["next/launch/allegretto.ts", FIXTURE_TEXT]] as const) {
    for (const variant of ["reference", "machine"]) {
      const ran = bare(entry, [file, "--kernel", variant]);
      assert.equal(ran.stdout, "hello, world\n", `${entry} --kernel ${variant}`);
      assert.equal(ran.stderr, "");
      assert.equal(ran.status, 0);
    }
    const refused = bare(entry, [file, "--kernel", "neither"]);
    assert.equal(refused.stdout, "", entry);
    assert.equal(refused.stderr, refusal, entry);
    assert.equal(refused.status, 1, entry);
    const noName = bare(entry, [file, "--kernel"]);
    assert.match(noName.stderr, /^--kernel takes the name of a kernel variant: reference or machine\nusage: npm run /, entry);
    assert.equal(noName.status, 1, entry);
  }
  // A text the driver would refuse is not read: the name is refused first.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "allegretto-kernel-"));
  try {
    const file = path.join(dir, "main.alg");
    fs.writeFileSync(file, "capability output\noutput.write(\n");
    const first = bare("next/launch/allegretto.ts", [file, "--kernel", "neither"]);
    assert.equal(first.stderr, refusal);
    assert.equal(first.status, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("the project's file may not set the kernel: a finding, exit 1, nothing printed", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "allegretto-kernel-"));
  try {
    const file = path.join(dir, "main.alg");
    fs.writeFileSync(file, 'capability output\noutput.write("ran")\n');
    fs.writeFileSync(path.join(dir, "allegro.json"), JSON.stringify({ kernel: "reference" }));
    const r = command("allegretto.ts", [file]);
    assert.equal(r.stdout, "");
    assert.equal(r.stderr, "the setting kernel is set by the project's file allegro.json, which may not set it: only the command line and the launcher may\n");
    assert.equal(r.status, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});


// ── Phases (chunk Q13, part 3) ────────────────────────────────────────
//
// A phase is what it supplies (`Configuration.phases`). A declared
// capability no phase has supplied yet is a fresh cell. Every test here
// passes on both kernel variants, and asserts what must be present. The
// phase `CHECK` below is named check and is no check (`Phase.check` is
// unset): it holds the path a first phase that is no check takes, which
// nothing shipped uses since part 5.

const CHECK = { name: "check", capabilities: [] } as const;
const checkOnly = (ceiling: readonly string[] = ["output"]): Configuration => ({ ceiling, phases: [CHECK] });

test("under check a capability is a cell: nothing is printed, a claim before the first statement that needs it is decided, and the launch ends waiting on it, by name", async () => {
  const program = emitted('capability output\nsquare(n) => n * n\nclaim(square(7) == 49)\noutput.write("hello")\n');
  const outcome = await launch({ createKernel, program, configuration: checkOnly(), target: SHIPPED_TARGET });
  assert.deepEqual(outcome.lines, []);
  assert.equal(outcome.end.kind, "waiting");
  assert.deepEqual(outcome.end.kind === "waiting" && [outcome.end.unanswered, outcome.end.inputs, outcome.end.capabilities], [0, [], ["output"]]);
  assert.equal(describe(outcome.end), "waiting: the program waits on the capability(ies) output, which no phase supplies");
  const result = resultOf(outcome);
  entryWith(result, [1, 0, 0, 0, 0]);
  assert.equal(result.summary, "undecided", "the write's claim still waits");
});

test("under check a false claim written before any effect is refuted, and nothing is printed", async () => {
  const outcome = await launch({ createKernel, program: emitted('capability output\nclaim(2 + 2 == 5)\noutput.write("never")\n'), configuration: checkOnly(), target: SHIPPED_TARGET });
  assert.deepEqual(outcome.lines, []);
  assert.equal(describe(outcome.end), "refuted: a claim that is not true");
});

test("under check a false claim after a statement bound with <- that calls the capability is refuted, and nothing is printed", async () => {
  const outcome = await launch({ createKernel, program: emitted('capability output\nshown <- output.write("hello")\nclaim(2 + 2 == 5)\n'), configuration: checkOnly(), target: SHIPPED_TARGET });
  assert.deepEqual(outcome.lines, []);
  assert.equal(describe(outcome.end), "refuted: a claim that is not true");
});

test("under check a module that hands its capability on to an imported module: the imported module's use of it waits too", async () => {
  const records = drivenRecords('capability output\nimport lib\nclaim(lib.double(21) == 42)\nlib.greet()\n', {
    lib: 'capability output\nexport double(n) => n * 2\nexport greet() => output.write("from lib")\n',
  });
  const outcome = await launchDriven(records, checkOnly());
  assert.deepEqual(outcome.lines, []);
  assert.equal(outcome.end.kind, "waiting");
  assert.deepEqual(outcome.end.kind === "waiting" && outcome.end.capabilities, ["output"]);
  entryWith(resultOf(outcome), [1, 0, 0, 0, 0]);
});

test("the end names the capabilities no phase supplied beside the inputs, and neither is counted as unanswered", async () => {
  // The statement bound with <- holds nothing, so it waits on n while the write waits on output.
  const program = emitted('capability output\ninput n\nm <- n + 1\noutput.write("x")\n');
  const outcome = await launch({ createKernel, program, configuration: checkOnly(), target: SHIPPED_TARGET });
  assert.deepEqual(outcome.lines, []);
  assert.deepEqual(outcome.end.kind === "waiting" && [outcome.end.unanswered, outcome.end.inputs, outcome.end.capabilities], [0, ["n"], ["output"]]);
  assert.equal(describe(outcome.end), "waiting: the program waits on the input(s) n, which the configuration does not supply and on the capability(ies) output, which no phase supplies");
});

test("a phase that supplies every capability at the start runs as today; each phase applied has an entry, with the lines printed before it", async () => {
  const r = recording();
  const phases = [{ name: "first", capabilities: ["output"] }, { name: "second", capabilities: [], inputs: { n: textData("late") } }];
  const outcome = await launch({ createKernel: r.createKernel, program: PRINTS_N, configuration: { ceiling: ["output"], phases }, target: TERMINAL });
  assert.deepEqual(outcome.lines, ["before", "late", "after"]);
  assert.equal(outcome.end.kind, "completed");
  assert.deepEqual(outcome.linesBeforePhase, [1]);
  assert.deepEqual(outcome.phases?.map((p) => [p.name, p.linesBefore]), [["first", 0], ["second", 1]]);
  assert.deepEqual(r.calls.filter((c) => evaluating.includes(c) || c === "fill"), ["evaluate", "fill", "advance"]);
});

test("the result of each phase: a claim that waits when the first phase is over is decided in the second, and the last entry's result is the outcome's", async () => {
  const program = emitted('capability output\ninput n\nclaim(n == 1)\noutput.write("decided")\n');
  const phases = [{ name: "first", capabilities: ["output"] }, { name: "second", capabilities: [], inputs: { n: { bits: Uint8Array.of(0, 0, 0, 0, 0, 0, 0, 1), bitLength: 64 } } }];
  const outcome = await launch({ createKernel, program, configuration: { ceiling: ["output"], phases }, target: SHIPPED_TARGET });
  assert.deepEqual(outcome.lines, ["decided"]);
  assert.equal(outcome.end.kind, "completed");
  const [first, second] = outcome.phases ?? [];
  assert.ok(first.result.claims.some((c) => c.waiting > 0), JSON.stringify(first.result.claims.map(counts)));
  assert.equal(first.result.summary, "undecided");
  entryWith(second.result, [1, 0, 0, 0, 0]);
  assert.equal(second.result, outcome.result);
  assert.deepEqual(JSON.parse(JSON.stringify(outcome.phases)), outcome.phases, "each result is plain data");
});

test("without phases the launch has one entry named run, and then one named later for each later phase applied", async () => {
  const outcome = await launch({ createKernel, program: PRINTS_A_B, configuration: { ceiling: ["output"], later: [{ a: textData("one") }, { b: textData("two") }] }, target: TERMINAL });
  assert.deepEqual(outcome.phases?.map((p) => [p.name, p.linesBefore]), [["run", 0], ["later", 1], ["later", 2]]);
  assert.equal(outcome.phases?.[2].result, outcome.result);
});

test("a refutation ends the launch in the phase that finds it: the phases after it are not applied", async () => {
  const r = recording();
  const phases = [{ name: "first", capabilities: ["output"] }, { name: "second", capabilities: [], inputs: { n: textData("never") } }];
  const outcome = await launch({ createKernel: r.createKernel, program: emitted("capability output\ninput n\nclaim(1 == 2)\noutput.write(n)\n"), configuration: { ceiling: ["output"], phases }, target: SHIPPED_TARGET });
  assert.equal(describe(outcome.end), "refuted: a claim that is not true");
  assert.deepEqual(outcome.lines, []);
  assert.deepEqual(outcome.phases?.map((p) => p.name), ["first"]);
  assert.ok(!r.calls.includes("fill"));
});

test("a configuration of phases is refused before anything is evaluated: with inputs or later beside it, with no phase, a capability the ceiling does not grant, a capability after the first phase", async () => {
  const run = { name: "run", capabilities: ["output"] };
  const cases: Array<[Configuration, string]> = [
    [{ ceiling: ["output"], phases: [run], inputs: { n: textData("x") } }, "the configuration gives phases and also inputs or later: with phases, each phase supplies its own inputs"],
    [{ ceiling: ["output"], phases: [run], later: [{ n: textData("x") }] }, "the configuration gives phases and also inputs or later: with phases, each phase supplies its own inputs"],
    [{ ceiling: ["output"], phases: [] }, "the configuration gives no phase"],
    [{ ceiling: ["output"], phases: [{ name: "run", capabilities: ["output", "timer"] }] }, "the phase run supplies the capability timer, which the ceiling does not grant"],
    [{ ceiling: ["output"], phases: [run, { name: "again", capabilities: ["output"] }] }, "the phase again supplies the capability output after the first phase: the kernel fills a cell with plain data only, so a capability is supplied by the first phase or by none"],
  ];
  for (const [configuration, reason] of cases) {
    const r = recording();
    const outcome = await launch({ createKernel: r.createKernel, program: PRINTS_N, configuration, target: TERMINAL });
    assert.equal(outcome.end.kind === "refused" && outcome.end.reason, reason);
    assert.ok(!r.calls.includes("evaluate"));
    assert.equal(outcome.phases, undefined, "a refused launch has no phase");
  }
  // A declared capability the ceiling does not grant is refused as today, whatever the phases.
  const notGranted = await launch({ createKernel, program: HELLO, configuration: { ceiling: [], phases: [CHECK] }, target: TERMINAL });
  assert.equal(describe(notGranted.end), "refused: the module declares the capability output, which the ceiling does not grant");
  // An input a phase supplies is checked as today: declared, and supplied once.
  const twice = await launch({ createKernel, program: PRINTS_N, configuration: { ceiling: ["output"], phases: [{ name: "a", capabilities: ["output"], inputs: { n: textData("x") } }, { name: "b", capabilities: [], inputs: { n: textData("y") } }] }, target: TERMINAL });
  assert.equal(twice.end.kind === "refused" && twice.end.reason, "the configuration supplies the input n at the start and again in later phase 1");
});

test("check then run, given to the launcher directly, is refused before anything is evaluated: a phase after the first cannot supply a capability", async () => {
  const r = recording();
  const outcome = await launch({ createKernel: r.createKernel, program: HELLO, configuration: { ceiling: ["output"], phases: [CHECK, { name: "run", capabilities: ["output"] }] }, target: TERMINAL });
  assert.equal(
    describe(outcome.end),
    "refused: the phase run supplies the capability output after the first phase: the kernel fills a cell with plain data only, so a capability is supplied by the first phase or by none",
  );
  assert.ok(!r.calls.includes("evaluate"));
  assert.deepEqual(outcome.lines, []);
});

test("both commands take --phases: run as today, check with nothing printed, check,run as run; a list that is not built, or no list, exits 1", () => {
  const run = command("terminal.ts", [FIXTURE, "--phases", "run"]);
  assert.equal(run.stdout, "hello, world\n");
  assert.equal(run.status, 0);
  const check = command("terminal.ts", [FIXTURE, "--phases", "check"]);
  assert.equal(check.stdout, "");
  assert.equal(check.stderr, "", "the check finds no refutation: the write waits, and nothing is performed");
  assert.equal(check.status, 0);
  const notBuilt = command("terminal.ts", [FIXTURE, "--phases", "run,check"]);
  assert.equal(notBuilt.stdout, "");
  assert.equal(notBuilt.stderr, 'the setting phases is "run, check", which is not built: the values built are "run", "check", "check, run", "test", "check, test"\n');
  assert.equal(notBuilt.status, 1);
  for (const entry of ["terminal.ts", "allegretto.ts"] as const) {
    const both = command(entry, [entry === "terminal.ts" ? FIXTURE : FIXTURE_TEXT, "--phases", "check,run"]);
    assert.equal(both.stdout, "hello, world\n", entry);
    assert.equal(both.stderr, "", entry);
    assert.equal(both.status, 0, entry);
  }
  const noList = command("allegretto.ts", [FIXTURE_TEXT, "--phases"]);
  assert.match(noList.stderr, /^--phases takes the names of phases, separated by commas: run, check, check,run, test, or check,test\nusage: npm run allegretto -- /);
  assert.equal(noList.status, 1);
  const text = command("allegretto.ts", [FIXTURE_TEXT, "--phases", "check"]);
  assert.equal(text.stdout, "");
  assert.equal(text.stderr, "");
  assert.equal(text.status, 0);
});

test("npm run allegretto under --phases check: a false claim after a statement bound with <- is refuted, nothing printed; the project's file sets phases, under the flag's", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "allegretto-phases-"));
  try {
    const file = path.join(dir, "main.alg");
    fs.writeFileSync(file, 'capability output\nshown <- output.write("hello")\nclaim(2 + 2 == 5)\n');
    const checked = command("allegretto.ts", [file, "--phases", "check"]);
    assert.equal(checked.stdout, "");
    assert.equal(checked.stderr, "refuted: a claim that is not true\n");
    assert.equal(checked.status, 1);
    const ran = command("allegretto.ts", [file]);
    assert.equal(ran.stdout, "hello\n");
    assert.equal(ran.stderr, "refuted: a claim that is not true\n");
    assert.equal(ran.status, 1);
    fs.writeFileSync(file, 'capability output\noutput.write("hello")\n');
    fs.writeFileSync(path.join(dir, "allegro.json"), JSON.stringify({ phases: ["check"] }));
    const fromFile = command("allegretto.ts", [file]);
    assert.equal(fromFile.stdout, "");
    assert.equal(fromFile.stderr, "");
    assert.equal(fromFile.status, 0);
    const flagOver = command("allegretto.ts", [file, "--phases", "run"]);
    assert.equal(flagOver.stdout, "hello\n");
    assert.equal(flagOver.status, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});


// ── Check output and the exit code (chunk Q16, part 3) ────────────────
//
// Both commands end to end: what is printed, what is written to stderr,
// and the exit code, the higher of the end's code and the highest status
// handed to report. The capability's own rules are tested in
// next/launch/report.test.ts.

test("both commands exit with the higher of the end's code and the highest status: completed with 3 exits 3, refuted with 0 exits 1, refuted with 7 exits 7", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "report-exit-"));
  try {
    const programs: Array<[string, string, string, string, number]> = [
      // name, text, stdout, stderr, exit code
      ["completed-3", 'capability output\ncapability report\nreport.message({level: `warning, text: "w", file: "a.alg", line: 2, column: 5})\nreport.status(3)\noutput.write("done")\n', "done\n", "a.alg:2:5: warning: w\n", 3],
      ["refuted-0", 'capability output\ncapability report\nreport.message({level: `error, text: "e"})\nclaim(1 == 2)\n', "", "error: e\nrefuted: a claim that is not true\n", 1],
      ["refuted-7", 'capability output\ncapability report\nreport.status(7)\noutput.write("before")\nclaim(1 == 2)\n', "before\n", "refuted: a claim that is not true\n", 7],
      ["completed-0", 'capability output\ncapability report\nreport.message("a note")\noutput.write("done")\n', "done\n", "note: a note\n", 0],
    ];
    for (const [name, text, stdout, stderr, status] of programs) {
      const file = path.join(dir, `${name}.alg`);
      fs.writeFileSync(file, text);
      const record = path.join(dir, `${name}.json`);
      fs.writeFileSync(record, encode(emitted(text)));
      for (const [entry, arg] of [["allegretto.ts", file], ["terminal.ts", record]] as const) {
        const r = command(entry, [arg]);
        assert.equal(r.stdout, stdout, `${entry} ${name}`);
        assert.equal(r.stderr, stderr, `${entry} ${name}`);
        assert.equal(r.status, status, `${entry} ${name}`);
      }
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("both commands under --phases check: report is not needed, so no message and no status is handed over; nothing is printed, a call on output waits, and the check completes", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "report-check-"));
  try {
    const text = 'capability output\ncapability report\nreport.message({level: `warning, text: "checked"})\nreport.status(4)\noutput.write("never")\n';
    const file = path.join(dir, "main.alg");
    fs.writeFileSync(file, text);
    const record = path.join(dir, "main.json");
    fs.writeFileSync(record, encode(emitted(text)));
    for (const [entry, arg] of [["allegretto.ts", file], ["terminal.ts", record]] as const) {
      const r = command(entry, [arg, "--phases", "check"]);
      assert.equal(r.stdout, "", entry);
      assert.equal(r.stderr, "", entry);
      assert.equal(r.status, 0, entry);
      const narrowed = command(entry, [arg, "--ceiling", "output"]);
      assert.equal(narrowed.stdout, "", entry);
      assert.equal(narrowed.stderr, "refused: the module declares the capability report, which the ceiling does not grant\n", entry);
      assert.equal(narrowed.status, 1, entry);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});


// ── A check, and check then run (chunk Q13, part 5) ───────────────────
//
// A first phase that is a check (`Phase.check`) is evaluations the
// launcher makes with `speculative` (part 7, below, has the checks that
// choose them). Every test here passes on both kernel variants. It asserts
// what must be present: a word, an end, a count above zero. It holds no
// count of evaluations under check, since the kernel may count one twice.

/** A capability of one part of one argument, whose implementation records each call of the part. */
function recordingCapability(name: string, part: string): { capability: CapabilityImplementation; calls: string[] } {
  const calls: string[] = [];
  const capability: CapabilityImplementation = {
    definition: { name, parts: [part] },
    create: (host) => [{
      purity: "effectful", capability: name, part, arity: 1,
      run: (args, context) => {
        calls.push(`${name}.${part}`);
        host.line(`${name}: ${new TextDecoder().decode(context.bitsOf(args[0]).bytes)}`);
        return context.structure([]);
      },
    }],
  };
  return { capability, calls };
}
const CHECKING = { name: "check", check: true, capabilities: [] } as const;
const checkThen = (...more: Phase[]): Configuration => ({ ceiling: ["output"], phases: [CHECKING, ...more] });
const RUN_AFTER = { name: "run", capabilities: ["output"] } as const;
/** The shipped checks with their defaults: functions for every argument, called or not; nothing unread. */
const SHIPPED_CHECKS = shippedChecks();
/** An end as words, without the count of steps a completed run gives. */
const endWords = (end: LaunchOutcome["end"]): string => (end.kind === "completed" ? "completed" : describe(end));
/** The word of the claim written at this line and column of `<text>`; undefined where none is. */
const wordAt = (result: LaunchResult, line: number, column: number) => {
  const c = result.claims.find((x) => x.at?.start.line === line && x.at.start.column === column);
  return c === undefined ? undefined : claimWord(c);
};
/** The same, in a check's broader analysis (`LaunchResult.broader`). */
const broaderWordAt = (result: LaunchResult, line: number, column: number) => (result.broader === undefined ? undefined : wordAt({ ...result, claims: result.broader.claims }, line, column));

test("under a check no part of any capability's implementation is called: one the check names, and one it does not", async () => {
  const say = recordingCapability("say", "line");
  const note = recordingCapability("note", "message");
  const r = recording();
  const program = emitted('capability say\ncapability note\nnote.message("n")\nsay.line("s")\nclaim(2 + 2 == 4)\n');
  const outcome = await launch({ createKernel: r.createKernel, program, configuration: { ceiling: ["say", "note"], phases: [{ name: "check", check: true, capabilities: ["note"] }] }, target: { capabilities: [say.capability, note.capability], primitives: shipped } });
  assert.deepEqual(say.calls, []);
  assert.deepEqual(note.calls, []);
  assert.deepEqual(outcome.lines, []);
  assert.equal(outcome.end.kind, "completed");
  assert.deepEqual(r.calls.filter((c) => ["check", "evaluate", "advance", "fill"].includes(c)), ["evaluate"], "with no checks handed, the kernel is handed one expression, by evaluate, and nothing is filled or advanced");
  assert.equal(wordAt(resultOf(outcome), 5, 1), "decided");
});

test("under a check a capability it names is not needed: a call answers the empty structure, and a claim on the answer is decided", async () => {
  const note = recordingCapability("note", "message");
  const program = (claimed: string) => emitted(`capability note\nx <- note.message("n")\nclaim(${claimed})\n`);
  const target: Target = { capabilities: [note.capability], primitives: shipped };
  const named: Configuration = { ceiling: ["note"], phases: [{ name: "check", check: true, capabilities: ["note"] }] };
  // count(x) is 0 only of the empty structure: the claim is decided where the stand-in answers it.
  const empty = await launch({ createKernel, program: program("count(x) == 0"), configuration: named, target });
  const claim = resultOf(empty).claims.find((c) => c.at?.start.line === 3);
  assert.ok(claim !== undefined && claim.decided > 0, JSON.stringify(resultOf(empty).claims.map(counts)));
  // A claim that the answer has an entry is refuted by the empty structure.
  const one = await launch({ createKernel, program: program("count(x) == 1"), configuration: named, target });
  assert.equal(describe(one.end), "refuted: a claim that is not true");
  // Not named, the capability is not yet given: the call waits, and nothing refutes the claim.
  const notGiven = await launch({ createKernel, program: program("count(x) == 1"), configuration: { ceiling: ["note"], phases: [CHECKING] }, target });
  assert.equal(notGiven.end.kind, "completed");
  assert.equal(wordAt(resultOf(notGiven), 3, 1), "waiting");
  assert.deepEqual(note.calls, []);
});

test("under a check every input is unknown: a claim over it waits, a claim over nothing unknown is decided, and the launch completes", async () => {
  const outcome = await launch({ createKernel, program: emitted("capability output\ninput n\nclaim(n == 1)\nclaim(2 + 2 == 4)\n"), configuration: checkThen(), target: SHIPPED_TARGET });
  assert.equal(outcome.end.kind, "completed");
  const result = resultOf(outcome);
  assert.equal(wordAt(result, 3, 1), "waiting");
  assert.equal(wordAt(result, 4, 1), "decided");
  assert.equal(result.summary, "undecided");
  assert.deepEqual(outcome.phases?.map((p) => p.name), ["check"]);
});

test("a check reaches a false claim in a function nothing calls and one under a condition on an unknown input, and ends the launch refuted", async () => {
  const uncalled = await launch({ createKernel, program: emitted('capability output\nunused(n) => claim(1 == 2)\noutput.write("hello")\n'), configuration: checkThen(), target: SHIPPED_TARGET, checks: SHIPPED_CHECKS });
  assert.equal(describe(uncalled.end), "refuted: a claim that is not true");
  assert.equal(broaderWordAt(resultOf(uncalled), 2, 14), "refuted");
  assert.deepEqual(uncalled.lines, []);
  // The binding x is read by nothing: the shipped checks go into it where unread is on.
  const branch = await launch({ createKernel, program: emitted('capability output\ninput mode\nx = if mode == 1 then claim(1 == 2) else 0\noutput.write("ok")\n'), configuration: checkThen(), target: SHIPPED_TARGET, checks: shippedChecks({ unread: "on" }) });
  assert.equal(describe(branch.end), "refuted: a claim that is not true");
  assert.equal(broaderWordAt(resultOf(branch), 3, 23), "refuted");
  // Run alone does not reach the claim in the function nothing calls, and completes.
  const ran = await launch({ createKernel, program: emitted('capability output\nunused(n) => claim(1 == 2)\noutput.write("hello")\n'), configuration: ONLY_OUTPUT, target: SHIPPED_TARGET });
  assert.equal(ran.end.kind, "completed");
  assert.deepEqual(ran.lines, ["hello"]);
});

test("a check ends at its limit where its budget runs out and nothing is refuted", async () => {
  const outcome = await launch({ createKernel, program: emitted("capability output\nclaim(2 + 2 == 4)\nclaim(3 + 3 == 6)\n"), configuration: { ceiling: ["output"], steps: 1, phases: [CHECKING] }, target: SHIPPED_TARGET });
  assert.equal(describe(outcome.end), "limit: the step budget of 1 ran out");
  assert.ok(outcome.result !== undefined, "a check at its limit has a result");
});

/**
 * A record of the first version, which makes no module, so a name nothing
 * binds is not refused at loading: module(output) => block({f: x =>
 * then(x, nowhere)}, {}). f is never called. Written at line 2 of free.alg.
 */
const FREE_IN_UNCALLED: unknown = (() => {
  const at = { source: "free.alg", start: { index: 0, line: 2, column: 1 }, end: { index: 9, line: 2, column: 10 } };
  return {
    format: "allegro-saved-program", version: 1, needs: [], module: 11, declares: [{ param: 0, role: "capability", name: "output" }],
    nodes: [
      { k: "param", name: "output" }, { k: "param", name: "x" }, { k: "symbol", fqn: "nowhere" }, { k: "kernel", name: "then" },
      { k: "expression", fn: 3, args: [1, 2], at }, { k: "function", params: [1], body: 4, at }, { k: "symbol", fqn: "f" },
      { k: "structure", entries: [[6, 5]] }, { k: "kernel", name: "block" }, { k: "structure", entries: [] },
      { k: "expression", fn: 8, args: [7, 9] }, { k: "function", params: [0], body: 10 },
    ],
  };
})();

test("a check's result gives the refutations found in parts that do not refute the whole, each with its place, and the launch ends refuted with their reason", async () => {
  assert.deepEqual(check2(FREE_IN_UNCALLED), []);
  const outcome = await launch({ createKernel, program: FREE_IN_UNCALLED, configuration: checkThen(), target: TERMINAL, checks: SHIPPED_CHECKS });
  assert.equal(outcome.end.kind, "refuted");
  const result = resultOf(outcome);
  const found = result.refutations.find((r) => /nowhere is bound by no block/.test(r.reason));
  assert.ok(found !== undefined, JSON.stringify(result.refutations));
  assert.deepEqual([found.at?.source, found.at?.start.line], ["free.alg", 2]);
  assert.ok(outcome.end.kind === "refuted" && outcome.end.reasons.includes(found.reason));
  // A finding's line and column are bigints, as a message of report has them; the rest survives JSON.
  const { findings, ...rest } = result;
  assert.deepEqual(JSON.parse(JSON.stringify(rest)), rest, "the result is plain data");
  assert.ok(findings !== undefined && findings.some((f) => f.level === "error" && f.file === "free.alg" && f.line === 2n), JSON.stringify(findings, (_, v) => (typeof v === "bigint" ? String(v) : v)));
  // A run gives none: the function is never called.
  const ran = await launch({ createKernel, program: FREE_IN_UNCALLED, configuration: ONLY_OUTPUT, target: TERMINAL });
  assert.equal(ran.end.kind, "completed");
  assert.deepEqual(resultOf(ran).refutations, []);
});

test("a check is the first phase or none, and names no input: each is refused before anything is evaluated", async () => {
  const cases: Array<[Configuration, string]> = [
    [{ ceiling: ["output"], phases: [RUN_AFTER, { name: "again", check: true, capabilities: [] }] }, "the phase again is a check after the first phase: only the first phase may be a check"],
    [{ ceiling: ["output"], phases: [{ name: "check", check: true, capabilities: [], inputs: { n: textData("x") } }] }, "the phase check is a check and supplies the input(s) n: a check supplies no input, and leaves every input unknown"],
  ];
  for (const [configuration, reason] of cases) {
    const r = recording();
    const outcome = await launch({ createKernel: r.createKernel, program: PRINTS_N, configuration, target: TERMINAL });
    assert.equal(outcome.end.kind === "refused" && outcome.end.reason, reason);
    assert.ok(!r.calls.includes("evaluate") && !r.calls.includes("check"));
    assert.deepEqual(outcome.lines, []);
  }
  // After a check, the first phase of the run supplies capabilities, and a phase after it may not.
  const late = await launch({ createKernel, program: PRINTS_N, configuration: checkThen(RUN_AFTER, { name: "later", capabilities: ["output"] }), target: TERMINAL });
  assert.match(describe(late.end), /^refused: the phase later supplies the capability output after the first phase/);
});

test("check then run, on one kernel: two phases, the run a fresh evaluation, its result free of the check's counts, and the outcome's result the run's", async () => {
  const r = recording();
  const program = emitted('capability output\ninput n\nunused(m) => claim(m == m)\nclaim(2 + 2 == 4)\noutput.write(n)\n');
  const outcome = await launch({ createKernel: r.createKernel, program, configuration: checkThen({ ...RUN_AFTER, inputs: { n: textData("given") } }), target: SHIPPED_TARGET, checks: SHIPPED_CHECKS });
  assert.equal(r.created(), 1);
  assert.ok(!r.calls.includes("check"), "the kernel's check is not called");
  assert.ok(r.calls.filter((c) => c === "evaluate").length >= 3, "the program as written, the function nothing calls, and the run");
  assert.deepEqual(outcome.lines, ["given"], "the run is given the input the check left unknown");
  assert.equal(outcome.end.kind, "completed");
  assert.deepEqual(outcome.phases?.map((p) => [p.name, p.linesBefore]), [["check", 0], ["run", 0]]);
  const [checked, ran] = outcome.phases ?? [];
  assert.equal(ran.result, outcome.result);
  // The claim in the function nothing calls is the check's broader analysis: the run never reaches it, and its result holds none of the check's.
  assert.ok(broaderWordAt(checked.result, 3, 14) !== undefined, JSON.stringify(checked.result.broader?.claims.map((c) => c.at?.start)));
  assert.equal(wordAt(ran.result, 3, 14), undefined);
  assert.equal(wordAt(checked.result, 4, 1), "decided");
  const runClaim = ran.result.claims.find((c) => c.at?.start.line === 4);
  assert.ok(runClaim !== undefined && runClaim.decided > 0);
  assert.deepEqual(JSON.parse(JSON.stringify(outcome.phases)), outcome.phases, "each result is plain data");
});

test("check then run prints what run alone prints and ends as it ends; where the check ends the launch nothing is printed", async () => {
  for (const text of ['capability output\noutput.write("first")\noutput.write("second")\n', "capability output\ninput n\noutput.write(\"before\")\noutput.write(n)\n"]) {
    const alone = await launch({ createKernel, program: emitted(text), configuration: ONLY_OUTPUT, target: SHIPPED_TARGET });
    const both = await launch({ createKernel, program: emitted(text), configuration: checkThen(RUN_AFTER), target: SHIPPED_TARGET });
    assert.deepEqual(both.lines, alone.lines, text);
    assert.equal(endWords(both.end), endWords(alone.end), text);
  }
  const text = 'capability output\noutput.write("hello")\nclaim(2 + 2 == 5)\n';
  const alone = await launch({ createKernel, program: emitted(text), configuration: ONLY_OUTPUT, target: SHIPPED_TARGET });
  assert.deepEqual(alone.lines, ["hello"], "run alone prints the line before the false claim is reached");
  const both = await launch({ createKernel, program: emitted(text), configuration: checkThen(RUN_AFTER), target: SHIPPED_TARGET });
  assert.deepEqual(both.lines, []);
  assert.equal(describe(both.end), "refuted: a claim that is not true");
  assert.deepEqual(both.phases?.map((p) => p.name), ["check"], "the run is not applied");
});

test("both commands under --phases check and --phases check,run: the lines, the messages and the exit codes", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "check-run-"));
  try {
    const programs: Array<[string, string, [string, string, number], [string, string, number]]> = [
      // name, text, [stdout, stderr, exit code] under check, and under check,run
      ["reports", 'capability output\ncapability report\nreport.message("m")\nreport.status(3)\noutput.write("done")\n', ["", "", 0], ["done\n", "note: m\n", 3]],
      ["refuted", 'capability output\noutput.write("hello")\nclaim(2 + 2 == 5)\n', ["", "refuted: a claim that is not true\n", 1], ["", "refuted: a claim that is not true\n", 1]],
      ["uncalled", 'capability output\nunused(n) => claim(1 == 2)\noutput.write("hello")\n', ["", "refuted: a claim that is not true\n", 1], ["", "refuted: a claim that is not true\n", 1]],
    ];
    for (const [name, text, checked, both] of programs) {
      const file = path.join(dir, `${name}.alg`);
      fs.writeFileSync(file, text);
      const record = path.join(dir, `${name}.json`);
      fs.writeFileSync(record, encode(emitted(text)));
      for (const [entry, arg] of [["allegretto.ts", file], ["terminal.ts", record]] as const)
        for (const [phases, [stdout, stderr, status]] of [["check", checked], ["check,run", both]] as const) {
          const r = command(entry, [arg, "--phases", phases]);
          assert.deepEqual([r.stdout, r.stderr, r.status], [stdout, stderr, status], `${entry} ${name} --phases ${phases}`);
        }
    }
    // Run alone prints the line before the false claim, which check, run does not.
    const alone = command("allegretto.ts", [path.join(dir, "refuted.alg")]);
    assert.deepEqual([alone.stdout, alone.status], ["hello\n", 1]);
    // An input: check leaves it unknown, and the run is given it.
    const file = path.join(dir, "input.alg");
    fs.writeFileSync(file, "capability output\ninput n\noutput.write(n)\n");
    const checkedInput = command("allegretto.ts", [file, "--phases", "check", "--input", 'n="given"']);
    assert.deepEqual([checkedInput.stdout, checkedInput.stderr, checkedInput.status], ["", "", 0]);
    const ranInput = command("allegretto.ts", [file, "--phases", "check,run", "--input", 'n="given"']);
    assert.deepEqual([ranInput.stdout, ranInput.stderr, ranInput.status], ["given\n", "", 0]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});


// ── The test phase (chunk Q13, part 6) ────────────────────────────────
//
// A test phase (`Phase.test`) loads a test module by an ordinary
// evaluation of its function, and then calls each test, an entry of the
// structure it yields whose value is a composed function of no
// parameters, by its own evaluation. Every test here passes on both kernel
// variants. It asserts what must be present: a name, an end, a word, a
// count above zero. It holds no step count.

const TEST_CEILING = ["output", "timer"];
const TESTING: Phase = { name: "test", test: true, capabilities: TEST_CEILING };
const TEST_TARGET = (): Target => ({ capabilities: [output, timer(virtualClock().clock)], primitives: shipped });
/** Launches a text under a test phase, after a check with the shipped checks where `checked` is true. */
const tested = (text: string, more: { steps?: number; inputs?: Configuration["inputs"]; checked?: boolean } = {}) =>
  launch({
    createKernel,
    checks: SHIPPED_CHECKS,
    program: emitted(text),
    configuration: {
      ceiling: TEST_CEILING,
      ...(more.steps === undefined ? {} : { steps: more.steps }),
      phases: [...(more.checked === true ? [CHECKING] : []), { ...TESTING, ...(more.inputs === undefined ? {} : { inputs: more.inputs }) }],
    },
    target: TEST_TARGET(),
  });
/** Each test's name and end, as words. */
const testEnds = (outcome: LaunchOutcome): Array<[string, string]> => (outcome.tests?.tests ?? []).map((t) => [t.name, t.end.kind === "completed" ? "passed" : describe(t.end)]);

test("the tests of a module that marks exports: its exported functions of no parameters, in the order the structure holds them", async () => {
  const outcome = await tested('capability output\nexport b() => claim(2 == 2)\nexport takes(n) => claim(n == n)\nhidden() => claim(1 == 2)\nexport a() => claim(1 == 1)\nexport n = 3\nexport alias = () => claim(3 == 3)\n');
  assert.deepEqual(testEnds(outcome), [["b", "passed"], ["a", "passed"], ["alias", "passed"]]);
  assert.equal(outcome.end.kind, "completed");
  assert.equal(outcome.tests?.load.end.kind, "completed");
});

test("the tests of a module that marks none: every function of no parameters it binds, in order; another kind of entry, or a function with parameters, is no test", async () => {
  const outcome = await tested('capability output\nfirst() => claim(1 == 1)\nhelper(n) => n + 1\ncount_ = 4\nsecond() => claim(helper(1) == 2)\nmark <- output.write("loaded")\n');
  assert.deepEqual(testEnds(outcome), [["first", "passed"], ["second", "passed"]]);
  assert.deepEqual(outcome.tests?.load.lines, ["loaded"], "the load runs the module's top-level statements");
  assert.deepEqual(outcome.lines, ["loaded"]);
});

test("a refuted test ends that test and no other: the next is still called, and the launch ends as the first test that did not complete", async () => {
  const outcome = await tested('capability output\nexport one() => claim(1 == 1)\nexport two() => claim(1 == 2)\nexport three() => claim(3 == 3)\nexport four() => claim(4 == 5)\n');
  assert.deepEqual(testEnds(outcome), [["one", "passed"], ["two", "refuted: a claim that is not true"], ["three", "passed"], ["four", "refuted: a claim that is not true"]]);
  assert.equal(describe(outcome.end), "refuted: a claim that is not true");
  const [, two] = outcome.tests?.tests ?? [];
  assert.equal(wordAt(two.result, 3, 17), "refuted", "the refuted test's result names its claim's place");
  assert.equal(outcome.end, two.end, "the launch's end is the first test's that did not complete");
});

test("each test's result is its own: a claim only one test reaches is in that test's result alone, and a claim both reach is counted in each", async () => {
  const outcome = await tested("capability output\nshared(n) => claim(n == n)\nexport a() =>\n  claim(1 == 1)\n  shared(1)\nexport b() =>\n  claim(2 == 2)\n  shared(2)\n");
  const [a, b] = outcome.tests?.tests ?? [];
  assert.deepEqual([a.name, b.name], ["a", "b"]);
  assert.equal(wordAt(a.result, 4, 3), "decided");
  assert.equal(wordAt(a.result, 7, 3), undefined, "a's result holds nothing of b's claim");
  assert.equal(wordAt(b.result, 7, 3), "decided");
  assert.equal(wordAt(b.result, 4, 3), undefined, "b's result holds nothing of a's claim");
  for (const t of [a, b]) {
    const c = t.result.claims.find((x) => x.at?.start.line === 2);
    assert.ok(c !== undefined && c.decided > 0 && c.refuted === 0 && c.waiting === 0, `${t.name}: ${JSON.stringify(t.result.claims.map(counts))}`);
    assert.equal(t.result.summary, "decided", t.name);
  }
  assert.deepEqual(outcome.tests?.load.result.claims, [], "the load reached no claim");
  assert.equal(outcome.result, outcome.tests?.load.result, "the launch's result is the load's");
  assert.deepEqual(JSON.parse(JSON.stringify(outcome.tests)), outcome.tests, "the outcome of the tests is plain data");
});

test("each test has the step budget of the launch to itself: one that exceeds a small budget ends at its limit, and the next still runs", async () => {
  const text = "capability output\nloop(n) => if n == 0 then 0 else loop(n - 1)\nexport big() => claim(loop(200) == 0)\nexport small() => claim(1 == 1)\nexport again() => claim(2 == 2)\n";
  const outcome = await tested(text, { steps: 200 });
  assert.deepEqual(testEnds(outcome), [["big", "limit: the step budget of 200 ran out"], ["small", "passed"], ["again", "passed"]]);
  assert.equal(describe(outcome.end), "limit: the step budget of 200 ran out");
  // With no budget, each completes.
  assert.deepEqual(testEnds(await tested(text)), [["big", "passed"], ["small", "passed"], ["again", "passed"]]);
});

test("a load that does not complete calls no test: the phase ends as the load ended", async () => {
  const outcome = await tested('capability output\nclaim(1 == 2)\nexport prints() => output.write("called")\n');
  assert.equal(describe(outcome.end), "refuted: a claim that is not true");
  assert.equal(outcome.tests?.load.end, outcome.end);
  assert.deepEqual(outcome.tests?.tests, []);
  assert.deepEqual(outcome.lines, [], "the test that prints was not called");
  const waits = await tested("capability output\ninput n\nclaim(n == 1)\nexport t() => claim(1 == 1)\n");
  assert.equal(describe(waits.end), "waiting: the program waits on the input(s) n, which the configuration does not supply");
  assert.deepEqual(waits.tests?.tests, []);
});

test("a test's lines are its own, and a test that waits on the timer is advanced until it is over", async () => {
  const outcome = await tested('capability output\ncapability timer\noutput.write("load")\nexport first() => output.write("one")\nexport waits() =>\n  t <- timer.wait(5000)\n  output.write("waited")\n  claim(t == 5000)\nexport last() => output.write("three")\n');
  assert.deepEqual(testEnds(outcome), [["first", "passed"], ["waits", "passed"], ["last", "passed"]]);
  assert.deepEqual(outcome.tests?.load.lines, ["load"]);
  assert.deepEqual(outcome.tests?.tests.map((t) => t.lines), [["one"], ["waited"], ["three"]]);
  assert.deepEqual(outcome.lines, ["load", "one", "waited", "three"]);
  assert.equal(wordAt(outcome.tests!.tests[1].result, 8, 3), "decided");
});

test("the inputs of a test phase go to the load; a test that reads an input no phase supplies ends waiting on it, and the next still runs", async () => {
  const text = "capability output\ninput n\nexport reads() => claim(n == 1)\nexport other() => claim(2 == 2)\n";
  const supplied = await tested(text, { inputs: { n: { bits: Uint8Array.of(0, 0, 0, 0, 0, 0, 0, 1), bitLength: 64 } } });
  assert.deepEqual(testEnds(supplied), [["reads", "passed"], ["other", "passed"]]);
  const missing = await tested(text);
  assert.deepEqual(testEnds(missing), [["reads", "waiting: the program waits on the input(s) n, which the configuration does not supply"], ["other", "passed"]]);
  assert.equal(missing.end.kind, "waiting");
});

test("a module with no test: the load completes, no test is called, and the launch completes", async () => {
  const outcome = await tested("capability output\nexport n = 1\nexport f(x) => x\n");
  assert.deepEqual(outcome.tests?.tests, []);
  assert.equal(outcome.end.kind, "completed");
  assert.deepEqual(outcome.phases?.map((p) => p.name), ["test"]);
});

test("check then test: the check reaches a false claim in a function no test calls, and no test is called; where it finds nothing, the tests run in a fresh evaluation", async () => {
  const refuted = await tested('capability output\nunused(n) => claim(1 == 2)\nexport t() => output.write("called")\n', { checked: true });
  assert.equal(describe(refuted.end), "refuted: a claim that is not true");
  assert.equal(refuted.tests, undefined, "the load was not started");
  assert.deepEqual(refuted.lines, []);
  const r = recording();
  const passes = await launch({
    createKernel: r.createKernel, program: emitted('capability output\nhelper(n) => claim(n == n)\nexport a() =>\n  helper(1)\n  output.write("a ran")\nexport b() => claim(2 == 2)\n'),
    configuration: { ceiling: TEST_CEILING, phases: [CHECKING, TESTING] }, target: TEST_TARGET(), checks: SHIPPED_CHECKS,
  });
  assert.equal(r.created(), 1);
  assert.ok(!r.calls.includes("check"), "the kernel's check is not called");
  assert.deepEqual(passes.phases?.map((p) => p.name), ["check", "test"]);
  assert.deepEqual(testEnds(passes), [["a", "passed"], ["b", "passed"]]);
  assert.deepEqual(passes.lines, ["a ran"]);
  assert.equal(passes.end.kind, "completed");
  // After a check a claim's level of waiting may carry into the tests (a known limit of the kernel): a count above zero, not the summary.
  for (const t of passes.tests?.tests ?? []) assert.ok(t.result.claims.some((c) => c.decided > 0), `${t.name}: ${JSON.stringify(t.result.claims.map(counts))}`);
});

test("a test phase is the first phase or follows a check, and no phase follows it: each is refused before anything is evaluated", async () => {
  const cases: Array<[Configuration, string]> = [
    [{ ceiling: ["output"], phases: [RUN_AFTER, { ...TESTING, capabilities: [] }] }, "the phase test is a test phase after a phase that is no check: a test phase is the first phase, or follows a check"],
    [{ ceiling: ["output"], phases: [{ ...TESTING, capabilities: ["output"] }, { name: "run", capabilities: [] }] }, "the phase run follows the test phase test: no phase follows the tests"],
    [{ ceiling: ["output"], phases: [{ name: "both", check: true, test: true, capabilities: [] }] }, "the phase both is both a check and a test phase"],
  ];
  for (const [configuration, reason] of cases) {
    const r = recording();
    const outcome = await launch({ createKernel: r.createKernel, program: PRINTS_N, configuration, target: TERMINAL });
    assert.equal(outcome.end.kind === "refused" && outcome.end.reason, reason);
    assert.ok(!r.calls.includes("evaluate") && !r.calls.includes("check"));
    assert.equal(outcome.tests, undefined);
  }
});

test("a run has no tests", async () => {
  const outcome = await launch({ createKernel, program: HELLO, configuration: ONLY_OUTPUT, target: TERMINAL });
  assert.equal(outcome.tests, undefined);
});

// ── The test phase on both commands (chunk Q13, part 6) ───────────────
//
// Both commands end to end: what is printed, what is written to stderr,
// and the exit code. What the lines and messages hold is tested in
// next/launch/test-output.test.ts.

/** Writes a text and its record, emitted with the text's path as the source of its places, into `dir`. */
function writeBoth(dir: string, name: string, text: string): { file: string; record: string } {
  const file = path.join(dir, `${name}.alg`);
  fs.writeFileSync(file, text);
  const r = emit(text, new Map(), file);
  assert.ok(r.ok, r.ok ? "" : r.findings.map((f) => f.message).join("; "));
  const record = path.join(dir, `${name}.json`);
  fs.writeFileSync(record, encode(r.program));
  return { file, record };
}

test("both commands under --phases test: a line for each test, a failing test's lines indented, the last line, a message with the place of the refuted claim, and exit 1", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "test-phase-"));
  try {
    const { file, record } = writeBoth(dir, "tests", 'capability output\nexport passes() =>\n  output.write("hidden")\n  claim(1 == 1)\nexport fails() =>\n  output.write("trace")\n  claim(1 == 2)\nexport after() => claim(2 == 2)\n');
    for (const [entry, arg] of [["allegretto.ts", file], ["terminal.ts", record]] as const) {
      const r = command(entry, [arg, "--phases", "test"]);
      assert.equal(r.stdout, "test passes: passed\ntest fails: refuted: a claim that is not true\n  trace\ntest after: passed\ntests: 2 passed, 1 failed\n", entry);
      assert.equal(r.stderr, `${file}:7:3: error: test fails: a claim that is not true\n`, entry);
      assert.equal(r.status, 1, entry);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("both commands under --phases test: tests that pass exit 0; a module with no test prints the last line alone; a load that does not complete prints as a run", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "test-phase-"));
  try {
    const programs: Array<[string, string, string, string, number]> = [
      // name, text, stdout, stderr, exit code
      ["passing", "capability output\nexport a() => claim(1 == 1)\nexport b() => claim(2 == 2)\n", "test a: passed\ntest b: passed\ntests: 2 passed, 0 failed\n", "", 0],
      ["none", "capability output\nexport n = 1\nexport f(x) => x\n", "tests: 0 passed, 0 failed\n", "", 0],
      ["load-refuted", 'capability output\noutput.write("loading")\nclaim(1 == 2)\nexport t() => output.write("never")\n', "loading\n", "refuted: a claim that is not true\n", 1],
      ["reports", 'capability output\ncapability report\nexport a() =>\n  report.message({level: `warning, text: "from a test"})\n  report.status(5)\nexport b() => claim(1 == 1)\n', "test a: passed\ntest b: passed\ntests: 2 passed, 0 failed\n", "warning: from a test\n", 5],
      ["versions", 'capability output\ncapability timer\ncapability http\nexport waits() =>\n  t <- timer.wait(9000000000)\n  claim(t == 9000000000)\nexport requests() =>\n  r <- http.request({method: "GET", url: "https://example.com/"})\n  claim(r.failure == `unreachable)\n', "test waits: passed\ntest requests: passed\ntests: 2 passed, 0 failed\n", "", 0],
    ];
    for (const [name, text, stdout, stderr, status] of programs) {
      const { file, record } = writeBoth(dir, name, text);
      for (const [entry, arg] of [["allegretto.ts", file], ["terminal.ts", record]] as const) {
        const r = command(entry, [arg, "--phases", "test"]);
        assert.deepEqual([r.stdout, r.stderr, r.status], [stdout, stderr, status], `${entry} ${name}`);
      }
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("both commands under --phases check,test: a false claim no test calls is refuted by the check and no test is called; where the check finds nothing, the tests run", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "check-test-"));
  try {
    const refuted = writeBoth(dir, "refuted", 'capability output\nunused(n) => claim(1 == 2)\nexport t() => output.write("never")\n');
    const passing = writeBoth(dir, "passing", "capability output\nexport t() => claim(1 == 1)\n");
    for (const [entry, which] of [["allegretto.ts", "file"], ["terminal.ts", "record"]] as const) {
      const r = command(entry, [refuted[which], "--phases", "check,test"]);
      assert.deepEqual([r.stdout, r.stderr, r.status], ["", "refuted: a claim that is not true\n", 1], entry);
      const tests = command(entry, [refuted[which], "--phases", "test"]);
      assert.deepEqual([tests.stdout, tests.status], ["test t: passed\ntests: 1 passed, 0 failed\n", 0], `${entry}: the test alone does not reach the claim`);
      const p = command(entry, [passing[which], "--phases", "check,test"]);
      assert.deepEqual([p.stdout, p.stderr, p.status], ["test t: passed\ntests: 1 passed, 0 failed\n", "", 0], entry);
    }
    // A later phase with a test phase is a finding, and nothing is launched.
    const later = command("allegretto.ts", [passing.file, "--phases", "test", "--later", "n=1"]);
    assert.deepEqual([later.stdout, later.stderr, later.status], ["", 'the setting later is given with the phases "test": no later phase follows the tests\n', 1]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});


// ── A check on ordinary evaluation, and the checks (chunk Q13, part 7) ─
//
// A check is evaluations the launcher makes with `speculative`: the
// program as written, then what the checks choose of what was left
// untouched (`Launch.checks`, next/launch/checks.ts). Every test here
// passes on both kernel variants. It asserts what must be present: for
// `untouched`, the things that must be told, never that nothing else is.

/** The kernel `createKernel` gives, wrapped so each `evaluate` is recorded with its expression and its result, and each module function made. */
function speculating(): { createKernel: () => Kernel; kernel: () => Kernel; evaluated: Array<{ expression: Value; speculative: boolean; result: import("../kernel/interface.js").Result }>; modules: Value[] } {
  const evaluated: Array<{ expression: Value; speculative: boolean; result: import("../kernel/interface.js").Result }> = [];
  const modules: Value[] = [];
  let made: Kernel | undefined;
  const create = () => {
    const inner = createKernel();
    made = inner;
    return new Proxy(inner, {
      get(target, name, receiver) {
        const v = Reflect.get(target, name, receiver);
        if (typeof v !== "function") return v;
        return (...args: unknown[]) => {
          const out = (v as (...a: unknown[]) => unknown).apply(target, args);
          if (name === "evaluate") evaluated.push({ expression: args[0] as Value, speculative: (args[1] as { speculative?: boolean } | undefined)?.speculative === true, result: out as import("../kernel/interface.js").Result });
          if (name === "module") modules.push(out as Value);
          return out;
        };
      },
    });
  };
  return { createKernel: create, kernel: () => made!, evaluated, modules };
}

/** Checks that answer as `answer` does and record what they were asked, and the result `findings` was given. */
function askingChecks(answer: (item: UntouchedData) => boolean, found: (r: LaunchResult) => ReportMessage[] = () => []): { checks: Checks; asked: UntouchedData[]; given: LaunchResult[] } {
  const asked: UntouchedData[] = [];
  const given: LaunchResult[] = [];
  return {
    checks: {
      into: (item) => {
        asked.push(item);
        return answer(item);
      },
      findings: (r) => {
        given.push(r);
        return found(r);
      },
    },
    asked,
    given,
  };
}

/** A module with a called function, an uncalled one, an unread binding and a list holding a function. */
const FOUR_KINDS = 'capability output\nf(n) => n + 1\nunused(n) => claim(n == 2)\nx = 3 + 4\nl = [(m) => claim(m == 1)]\nclaim(f(1) == 2)\n';

/**
 * The handle of each thing a check went into after the first evaluation: a
 * function, called with an unfilled cell for each parameter, by the
 * function; anything else by its value.
 */
function goneIntoHandles(s: ReturnType<typeof speculating>): Value[] {
  const k = s.kernel();
  return s.evaluated.slice(1).map(({ expression: e }) => {
    if (k.kind(e) !== "expression") return e;
    const { fn, args } = k.expressionOf(e);
    return args.length > 0 && args.every((a) => k.isCell(a) && !k.filled(a as Cell)) ? fn : e;
  });
}
const goneInto = (s: ReturnType<typeof speculating>): number => s.evaluated.length - 1;

const toldAt = (result: LaunchResult, kind: string, line: number, column: number) =>
  (result.untouched ?? []).find((u) => u.kind === kind && u.at?.start.line === line && u.at.start.column === column);

test("with no checks handed a check goes into nothing beyond the program as written, and lists as untouched all the kernel told but the module's function", async () => {
  const s = speculating();
  const outcome = await launch({ createKernel: s.createKernel, program: emitted(FOUR_KINDS), configuration: checkThen(), target: SHIPPED_TARGET });
  assert.equal(outcome.end.kind, "completed");
  assert.equal(s.evaluated.length, 1, "one evaluation: the program as written");
  assert.ok(s.evaluated[0].speculative, "with speculative");
  const result = resultOf(outcome);
  assert.equal(wordAt(result, 6, 1), "decided", "the call made decides the claim in the program as written");
  assert.deepEqual(result.broader?.claims, [], "nothing was gone into after the first");
  assert.deepEqual(result.findings, []);
  // What must be told: the called function, the uncalled one, the unread bindings.
  const f = toldAt(result, "function", 2, 1);
  assert.ok(f?.kind === "function" && f.called && f.parameters === 1, JSON.stringify(result.untouched));
  const unused = toldAt(result, "function", 3, 1);
  assert.ok(unused?.kind === "function" && !unused.called, JSON.stringify(result.untouched));
  assert.ok(toldAt(result, "binding", 4, 5) !== undefined && toldAt(result, "binding", 5, 5) !== undefined, JSON.stringify(result.untouched));
  // The list is the kernel's, each handle once, with the module's own function left out.
  const [module] = s.modules;
  const kernelTold = new Set((s.evaluated[0].result.untouched ?? []).map((u) => u.value));
  assert.ok(kernelTold.has(module), "the kernel tells the module's function");
  kernelTold.delete(module);
  assert.equal(result.untouched?.length, kernelTold.size);
});

test("the checks are asked about each thing told, as plain data with no handle, and the module's function is never gone into again", async () => {
  const s = speculating();
  const a = askingChecks(() => true);
  const outcome = await launch({ createKernel: s.createKernel, program: emitted(FOUR_KINDS), configuration: checkThen(), target: SHIPPED_TARGET, checks: a.checks });
  assert.equal(outcome.end.kind, "completed");
  assert.ok(a.asked.length > 0);
  for (const item of a.asked) {
    assert.deepEqual(JSON.parse(JSON.stringify(item)), item, "plain data");
    assert.ok(Object.keys(item).every((k) => ["kind", "parameters", "called", "at"].includes(k)), JSON.stringify(item));
  }
  assert.ok(a.asked.some((u) => u.kind === "function" && u.at?.start.line === 5 && u.at.start.column === 6), "the function in the list, told once the binding is gone into");
  const [module] = s.modules;
  const k = s.kernel();
  for (const e of s.evaluated.slice(1)) {
    assert.ok(e.speculative);
    assert.ok(e.expression !== module && !(k.kind(e.expression) === "expression" && k.expressionOf(e.expression).fn === module), "the module's function is not gone into again");
  }
  // Each handle is gone into once.
  assert.equal(goneInto(s), new Set(goneIntoHandles(s)).size);
  // Going into everything, nothing is left untouched that was told.
  assert.deepEqual(resultOf(outcome).untouched, []);
  // The findings are given the check's result as plain data, with the two lists.
  assert.equal(a.given.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(a.given[0])), a.given[0]);
  assert.ok(a.given[0].broader !== undefined && a.given[0].untouched !== undefined);
});

test("each handle is gone into once, and the check ends, for a function that calls itself and for two that call each other", async () => {
  const text = "capability output\nloop(n) => if n == 0 then 0 else loop(n - 1)\neven(n) => if n == 0 then true else odd(n - 1)\nodd(n) => if n == 0 then false else even(n - 1)\nclaim(loop(3) == 0)\nclaim(even(4))\n";
  const s = speculating();
  const outcome = await launch({ createKernel: s.createKernel, program: emitted(text), configuration: checkThen(), target: SHIPPED_TARGET, checks: askingChecks(() => true).checks });
  assert.equal(outcome.end.kind, "completed");
  assert.equal(goneInto(s), new Set(goneIntoHandles(s)).size, "no handle twice");
  assert.ok(s.evaluated.length >= 4, "the program as written, loop, even and odd");
});

test("the two lists are kept apart: a claim decided on the call made is decided as written, and waits for every argument in the broader analysis", async () => {
  const text = "capability output\npositive(n) => claim(n > 0)\npositive(3)\n";
  const outcome = await launch({ createKernel, program: emitted(text), configuration: checkThen(), target: SHIPPED_TARGET, checks: SHIPPED_CHECKS });
  assert.equal(outcome.end.kind, "completed", "a claim that waits refutes nothing");
  const result = resultOf(outcome);
  assert.equal(wordAt(result, 2, 16), "decided");
  assert.equal(broaderWordAt(result, 2, 16), "waiting");
  assert.equal(result.summary, "decided", "the summary is the program as written's");
  assert.equal(result.broader?.summary, "undecided");
  // With arguments off, the function a call opened is not gone into: the broader list has no record of the claim.
  const off = await launch({ createKernel, program: emitted(text), configuration: checkThen(), target: SHIPPED_TARGET, checks: shippedChecks({ arguments: "off" }) });
  assert.equal(broaderWordAt(resultOf(off), 2, 16), undefined);
  assert.ok(toldAt(resultOf(off), "function", 2, 1)?.kind === "function", "it is told as untouched");
});

test("a check ends refuted where either list has a refuted claim or a refutation is listed; the findings are in its result", async () => {
  const text = 'capability output\nunused(n) => claim(1 == 2)\noutput.write("hello")\n';
  const outcome = await launch({ createKernel, program: emitted(text), configuration: checkThen(RUN_AFTER), target: SHIPPED_TARGET, checks: SHIPPED_CHECKS });
  assert.equal(describe(outcome.end), "refuted: a claim that is not true");
  assert.deepEqual(outcome.phases?.map((p) => p.name), ["check"], "no run after it");
  const result = resultOf(outcome);
  assert.equal(wordAt(result, 2, 14), undefined, "the program as written does not reach it");
  assert.equal(broaderWordAt(result, 2, 14), "refuted");
  assert.deepEqual(result.findings?.map(messageLine), ["<text>:2:14: error: a claim of the broader analysis is refuted: a claim that is not true"]);
  // With uncalled off the function is told as untouched, and the check completes.
  const off = await launch({ createKernel, program: emitted(text), configuration: checkThen(), target: SHIPPED_TARGET, checks: shippedChecks({ uncalled: "off" }) });
  assert.equal(off.end.kind, "completed");
  assert.ok(toldAt(resultOf(off), "function", 2, 1) !== undefined);
  assert.deepEqual(resultOf(off).findings, []);
});

test("a finding of level error ends the launch at the end findings, with the count of errors, and no run follows; a warning does not", async () => {
  const text = 'capability output\ninput n\nclaim(n == 1)\noutput.write("ran")\n';
  const waits = (level: "error" | "warning") => launch({ createKernel, program: emitted(text), configuration: checkThen({ ...RUN_AFTER, inputs: { n: { bits: Uint8Array.of(0, 0, 0, 0, 0, 0, 0, 1), bitLength: 64 } } }), target: SHIPPED_TARGET, checks: shippedChecks({ waiting: level }) });
  const failed = await waits("error");
  assert.equal(failed.end.kind, "findings");
  // Two claims wait: the one over n, and the write's, since output is not yet given under the check.
  assert.deepEqual(failed.end.kind === "findings" && [failed.end.errors, failed.end.reason], [2, "the check's findings hold 2 error(s)"]);
  assert.equal(describe(failed.end), "findings: the check's findings hold 2 error(s)");
  assert.deepEqual(failed.lines, [], "no run after it");
  assert.deepEqual(failed.phases?.map((p) => p.name), ["check"]);
  assert.deepEqual(resultOf(failed).findings?.map(messageLine), [
    "<text>:3:1: error: a claim of the program as written waits: the check could not decide it",
    "<text>:4:1: error: a claim of the program as written waits: the check could not decide it",
  ]);
  const warned = await waits("warning");
  assert.equal(warned.end.kind, "completed");
  assert.deepEqual(warned.lines, ["ran"]);
  assert.deepEqual(warned.phases?.[0].result.findings?.map((f) => f.level), ["warning", "warning"], "the check's result keeps its findings");
  assert.equal(warned.result?.findings, undefined, "the run's result has none");
  // A refutation outranks the findings, and so does a limit.
  const refuted = await launch({ createKernel, program: emitted("capability output\ninput n\nclaim(n == 1)\nclaim(1 == 2)\n"), configuration: checkThen(), target: SHIPPED_TARGET, checks: shippedChecks({ waiting: "error" }) });
  assert.equal(refuted.end.kind, "refuted");
  const limited = await launch({ createKernel, program: emitted(text), configuration: { ceiling: ["output"], steps: 1, phases: [CHECKING] }, target: SHIPPED_TARGET, checks: shippedChecks({ waiting: "error" }) });
  assert.equal(limited.end.kind, "limit");
  // The findings end is no completed end: the exit code is 1.
  assert.equal(exitCode(failed.end, 0), 1);
});

test("a capability the check names as not needed stays as handed: the claim a dropped call on it stands for is decided as written", async () => {
  const program = emitted('capability report\nreport.message("checked")\nclaim(2 + 2 == 4)\n');
  const outcome = await launch({ createKernel, program, configuration: { ceiling: ["report"], phases: [{ name: "check", check: true, capabilities: ["report"] }] }, target: { capabilities: [report(collector().sink)], primitives: shipped }, checks: SHIPPED_CHECKS });
  assert.equal(outcome.end.kind, "completed");
  assert.equal(wordAt(resultOf(outcome), 2, 1), "decided");
});

test("a binding nothing reads is told and skipped by default, and gone into with unread on; a function held in a list likewise", async () => {
  const text = "capability output\nx = if 1 == 1 then claim(1 == 2) else 0\nl = [(m) => claim(m == m + 1)]\n";
  const skipped = await launch({ createKernel, program: emitted(text), configuration: checkThen(), target: SHIPPED_TARGET, checks: SHIPPED_CHECKS });
  assert.equal(skipped.end.kind, "completed");
  assert.ok(toldAt(resultOf(skipped), "binding", 2, 5) !== undefined && toldAt(resultOf(skipped), "binding", 3, 5) !== undefined, JSON.stringify(resultOf(skipped).untouched));
  const read = await launch({ createKernel, program: emitted(text), configuration: checkThen(), target: SHIPPED_TARGET, checks: shippedChecks({ unread: "on" }) });
  assert.equal(describe(read.end), "refuted: a claim that is not true");
  assert.equal(broaderWordAt(resultOf(read), 2, 20), "refuted");
  assert.ok(resultOf(read).broader?.claims.some((c) => c.at?.start.line === 3), "the function in the list is gone into for every argument");
});

test("a part gone into that comes out refuted as a whole, with no refuted claim, is a refutation at its place", async () => {
  const text = "capability output\nx = 1 / 0\nclaim(1 == 1)\n";
  const outcome = await launch({ createKernel, program: emitted(text), configuration: checkThen(), target: SHIPPED_TARGET, checks: shippedChecks({ unread: "on" }) });
  assert.equal(outcome.end.kind, "refuted");
  const found = resultOf(outcome).refutations.find((r) => r.at?.start.line === 2 && r.at.start.column === 5);
  assert.ok(found !== undefined, JSON.stringify(resultOf(outcome).refutations));
  assert.ok(outcome.end.kind === "refuted" && outcome.end.reasons.includes(found.reason));
  assert.ok(resultOf(outcome).findings?.some((f) => f.level === "error" && f.line === 2n && f.column === 5n && f.text === `a part is refuted: ${found.reason}`));
  // By default nothing reads x and nothing goes into it.
  const skipped = await launch({ createKernel, program: emitted(text), configuration: checkThen(), target: SHIPPED_TARGET, checks: SHIPPED_CHECKS });
  assert.equal(skipped.end.kind, "completed");
});
