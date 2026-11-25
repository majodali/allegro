// Tests of the timer capability and its clocks (B-196 (the rebuild's
// acceptance side), chunk Q7 (the minimal launcher and the output
// capability), part 5): next/launch/timer.ts and next/launch/clock.ts,
// through the launcher of next/launch/launcher.ts on the kernel
// `createKernel` of next/launch/kernel-variant.ts gives: the machine, and
// the reference where next/launch/reference.test.ts loads this file. Run
// by `npm run test:next`.
//
// No test here pins a step count or a wall-clock duration. A clock that
// answers when the test says (`heldClock`) shows what is printed before
// an answer and after it.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { createKernel, usedVariant } from "./kernel-variant.js";
import { encode, type SavedProgram } from "../kernel/saved-program.js";
import { emit } from "../bootstrap/emit.js";
import { shipped } from "../prims/index.js";
import { describe, launch, type Configuration, type LaunchOutcome, type Target } from "./launcher.js";
import { output } from "./output.js";
import { TIMER, timer } from "./timer.js";
import { virtualClock, type Clock } from "./clock.js";

const here = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(here, "../..");

/** The record the emitter writes for an Allegretto text, as JSON round-trips it. */
function emitted(text: string): SavedProgram {
  const r = emit(text);
  assert.ok(r.ok, r.ok ? "" : r.findings.map((f) => f.message).join("; "));
  return JSON.parse(encode(r.program)) as SavedProgram;
}

const BOTH: Configuration = { ceiling: ["output", "timer"] };
const target = (clock: Clock): Target => ({ capabilities: [output, timer(clock)], primitives: shipped });
const run = (program: SavedProgram, clock: Clock, configuration: Configuration = BOTH): Promise<LaunchOutcome> =>
  launch({ createKernel, program, configuration, target: target(clock) });

/** A clock that answers a wait only when the test says: `asked` lists the waits in the order asked. */
function heldClock(): { clock: Clock; asked: bigint[]; answer: (i: number) => void } {
  const asked: bigint[] = [];
  const callbacks: Array<() => void> = [];
  return {
    clock: (ms, callback) => {
      asked.push(ms);
      callbacks.push(callback);
    },
    asked,
    answer: (i) => callbacks[i](),
  };
}
/** Lets the launcher go on until it waits again. */
const settle = () => new Promise((resolve) => setImmediate(resolve));

const ONE_WAIT = emitted('capability output\ncapability timer\nx <- timer.wait(7)\nshown <- output.write("x is " ++ int.text(x))\noutput.write("started")\n');
const TWO_WAITS = emitted('capability output\ncapability timer\na <- output.write("a: " ++ int.text(timer.wait(20)))\nb <- output.write("b: " ++ int.text(timer.wait(10)))\n');

test("the timer capability has one part, wait", () => {
  assert.deepEqual(TIMER, { name: "timer", parts: ["wait"] });
});

test("timer.wait answers late, with the number it was given: nothing that uses it is printed until the clock answers", async () => {
  const held = heldClock();
  let settled = false;
  const outcome = run(ONE_WAIT, held.clock);
  void outcome.then(() => (settled = true));
  await settle();
  assert.deepEqual(held.asked, [7n]);
  assert.equal(settled, false);
  held.answer(0);
  const done = await outcome;
  assert.deepEqual(done.lines, ["started", "x is 7"]);
  assert.equal(done.end.kind, "completed");
});

test("several waits in flight: each answer is filled when it arrives, and what waited on it is evaluated again then", async () => {
  const held = heldClock();
  const seen: string[] = [];
  const outcome = launch({ createKernel, program: TWO_WAITS, configuration: BOTH, target: target(held.clock), onLine: (l) => seen.push(l) });
  await settle();
  assert.deepEqual(held.asked, [20n, 10n], "both waits are asked before either is answered");
  held.answer(0);
  await settle();
  assert.deepEqual(seen, ["a: 20"], "the first answer is printed before the second arrives");
  held.answer(1);
  const done = await outcome;
  assert.deepEqual(done.lines, ["a: 20", "b: 10"]);
  assert.equal(done.end.kind, "completed");
});

test("on the virtual clock the waits are answered in the order they fall due", async () => {
  const done = await run(TWO_WAITS, virtualClock().clock);
  assert.deepEqual(done.lines, ["b: 10", "a: 20"]);
  assert.equal(done.end.kind, "completed");
});

test("on the virtual clock equal waits are answered in the order they were asked", async () => {
  const program = emitted('capability output\ncapability timer\nshow(name) => output.write(name ++ " " ++ int.text(timer.wait(5)))\na <- show("a")\nb <- show("b")\nc <- show("c")\n');
  const done = await run(program, virtualClock().clock);
  assert.deepEqual(done.lines, ["a 5", "b 5", "c 5"]);
});

test("timer.wait(0) answers late too, and a wait no clock of the host could take is answered on the virtual clock", async () => {
  const zero = await run(emitted('capability output\ncapability timer\noutput.write(int.text(timer.wait(0)))\n'), virtualClock().clock);
  assert.deepEqual(zero.lines, ["0"]);
  const longest = await run(emitted('capability output\ncapability timer\noutput.write(int.text(timer.wait(9223372036854775807)))\n'), virtualClock().clock);
  assert.deepEqual(longest.lines, ["9223372036854775807"]);
  assert.equal(longest.end.kind, "completed");
});

test("a value outside timer.wait's domain is a refutation with the part's reason", async () => {
  for (const [argument, says] of [
    ["-1", /timer\.wait takes a number of milliseconds that is not negative; this one is -1/],
    ['"ten"', /timer\.wait takes a whole number of 64 bits; this value has 24 bits/],
    ["true", /timer\.wait takes a whole number of 64 bits; this value has 1 bits/],
    ["[]", /timer\.wait takes a whole number of 64 bits, not structure/],
  ] as const) {
    const done = await run(emitted(`capability output\ncapability timer\noutput.write("before")\nr <- timer.wait(${argument})\n`), virtualClock().clock);
    assert.equal(done.end.kind, "refuted", argument);
    assert.match(describe(done.end), says);
  }
});

test("the launcher's loop with waits in flight: a later phase is applied only once no wait is due, and the end names what is left", async () => {
  const program = emitted('capability output\ncapability timer\ninput n\ninput m\na <- output.write("waited " ++ int.text(timer.wait(10)))\nb <- output.write("n is " ++ n)\nc <- output.write("waited " ++ int.text(timer.wait(20)))\nd <- output.write("m is " ++ m)\n');
  const done = await run(program, virtualClock().clock, { ...BOTH, later: [{ n: { bits: new TextEncoder().encode("late") } }] });
  assert.deepEqual(done.lines, ["waited 10", "waited 20", "n is late"]);
  assert.deepEqual(done.linesBeforePhase, [2]);
  assert.equal(describe(done.end), "waiting: the program waits on the input(s) m, which the configuration does not supply");
});

test("a program that declares timer where the ceiling does not grant it is refused, as for any capability", async () => {
  const done = await run(ONE_WAIT, virtualClock().clock, { ceiling: ["output"] });
  assert.equal(done.end.kind, "refused");
  assert.equal(describe(done.end), "refused: the module declares the capability timer, which the ceiling does not grant");
  assert.deepEqual(done.lines, []);
});

test("a program that does not declare timer is unaffected by a ceiling that grants it", async () => {
  const done = await run(emitted('capability output\noutput.write("hello, world")\n'), virtualClock().clock);
  assert.deepEqual(done.lines, ["hello, world"]);
  assert.equal(done.end.kind, "completed");
});

test("the virtual clock: the earliest due first, the earliest asked among equal ones, a wait asked during an answer counted from it", async () => {
  const v = virtualClock();
  const order: string[] = [];
  v.clock(30n, () => order.push("30"));
  v.clock(10n, () => {
    order.push("10");
    v.clock(15n, () => order.push("10+15"));
  });
  v.clock(30n, () => order.push("30, asked second"));
  v.clock(20n, () => order.push("20"));
  assert.equal(v.pending(), 4);
  assert.deepEqual(order, [], "nothing is answered while the asking goes on");
  while (v.pending() > 0) await settle();
  assert.deepEqual(order, ["10", "20", "10+15", "30", "30, asked second"]);
  assert.equal(v.now(), 30n);
});

test("the timer capability and the clocks reach no host API but the timers", () => {
  for (const file of ["timer.ts", "clock.ts"]) {
    const source = fs.readFileSync(path.join(here, file), "utf8").replace(/^\s*\/\/.*$/gm, "");
    assert.doesNotMatch(source, /\bprocess\.|from "fs"|from "path"|\bBuffer\b/, file);
  }
});

test("npm run allegretto grants timer on the host's real timer: a program that waits prints its lines in the order the waits fall due", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "allegretto-timer-"));
  try {
    const file = path.join(dir, "waits.alg");
    fs.writeFileSync(file, 'capability output\ncapability timer\nslow <- output.write("slow " ++ int.text(timer.wait(40)))\nfast <- output.write("fast " ++ int.text(timer.wait(2)))\noutput.write("started")\n');
    const r = spawnSync(process.execPath, ["--import", "tsx", path.join(here, "allegretto.ts"), "--kernel", usedVariant(), file], { cwd: ROOT, encoding: "utf8", timeout: 30000 });
    assert.equal(r.stderr, "");
    assert.equal(r.stdout, "started\nfast 2\nslow 40\n");
    assert.equal(r.status, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("npm run launch grants timer too: a record that declares timer runs on the host's real timer", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "launch-timer-"));
  try {
    const file = path.join(dir, "waits.json");
    fs.writeFileSync(file, encode(ONE_WAIT));
    const r = spawnSync(process.execPath, ["--import", "tsx", path.join(here, "terminal.ts"), "--kernel", usedVariant(), file], { cwd: ROOT, encoding: "utf8", timeout: 30000 });
    assert.equal(r.stderr, "");
    assert.equal(r.stdout, "started\nx is 7\n");
    assert.equal(r.status, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
