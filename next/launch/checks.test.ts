// Tests of the checks (B-196 (the rebuild's acceptance side), chunk Q13
// (check and run as configurations, and what a result holds), part 7):
// next/launch/checks.ts, on results written by hand as plain data. No
// kernel is made here. The launcher's use of the checks is tested in
// next/launch/launcher.test.ts. Run by `npm run test:next`.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import { CHECK_DEFAULTS, CHECK_NAMES, CHECK_SETTINGS, checkFinding, shippedChecks } from "./checks.js";
import type { ClaimResult, LaunchResult, UntouchedData } from "./launcher.js";
import { messageLine } from "./report.js";

const here = path.dirname(new URL(import.meta.url).pathname);

const at = (line: number, column: number, source = "m.alg") => ({ source, start: { index: 0, line, column }, end: { index: 1, line, column: column + 1 } });

/** A claim's entry, written by hand: the counts that give the word asked for. */
function claim(word: "decided" | "refuted" | "waiting", line: number, column = 1, reasons: string[] = []): ClaimResult {
  return {
    key: `sha256:${line}-${column}`, at: at(line, column), decided: word === "decided" ? 1 : 0, sampled: 0, assumed: 0, undecided: 0,
    refuted: word === "refuted" ? 1 : 0, waiting: word === "waiting" ? 1 : 0, reasons, restsOn: [],
  };
}

/** A check's result, written by hand. */
function result(claims: ClaimResult[], broader: ClaimResult[] = [], refutations: LaunchResult["refutations"] = []): LaunchResult {
  return {
    claims, summary: "decided", restsOn: { kernel: "k", primitives: [], modules: [], capabilities: [] }, refutations,
    broader: { claims: broader, summary: "decided" }, untouched: [],
  };
}

const lines = (r: LaunchResult, settings = {}) => shippedChecks(settings).findings(r).map(messageLine);

test("the four settings, their values and their defaults", () => {
  assert.deepEqual(CHECK_NAMES, ["arguments", "uncalled", "unread", "waiting"]);
  assert.deepEqual(CHECK_SETTINGS, { arguments: ["on", "off"], uncalled: ["on", "off"], unread: ["on", "off"], waiting: ["pass", "note", "warning", "error"] });
  assert.deepEqual(CHECK_DEFAULTS, { arguments: "on", uncalled: "on", unread: "off", waiting: "pass" });
});

test("what the shipped checks go into, by default and with each setting", () => {
  const called: UntouchedData = { kind: "function", parameters: 1, called: true, at: at(2, 1) };
  const uncalled: UntouchedData = { kind: "function", parameters: 2, called: false, at: at(3, 1) };
  const others: UntouchedData[] = [{ kind: "binding", at: at(4, 5) }, { kind: "argument" }, { kind: "entry" }];
  const into = (settings = {}) => [called, uncalled, ...others].map((u) => shippedChecks(settings).into(u));
  assert.deepEqual(into(), [true, true, false, false, false], "a function for every argument, called or not; nothing unread");
  assert.deepEqual(into({ arguments: "off" }), [false, true, false, false, false]);
  assert.deepEqual(into({ uncalled: "off" }), [true, false, false, false, false]);
  assert.deepEqual(into({ unread: "on" }), [true, true, true, true, true]);
  assert.deepEqual(into({ arguments: "off", uncalled: "off", unread: "off" }), [false, false, false, false, false]);
  assert.deepEqual(into({ waiting: "error" }), into(), "waiting chooses nothing to go into");
});

test("the findings: an error for each refuted claim of either list and each refutation, each with its place, in that order", () => {
  const r = result(
    [claim("decided", 2), claim("refuted", 3, 5, ["a claim that is not true"])],
    [claim("refuted", 7, 14, ["a claim that is not true"])],
    [{ reason: "the name nowhere is bound by no block", at: at(9, 2) }, { reason: "no place" }],
  );
  assert.deepEqual(lines(r), [
    "m.alg:3:5: error: a claim of the program as written is refuted: a claim that is not true",
    "m.alg:7:14: error: a claim of the broader analysis is refuted: a claim that is not true",
    "m.alg:9:2: error: a part is refuted: the name nowhere is bound by no block",
    "error: a part is refuted: no place",
  ]);
  const [first] = shippedChecks().findings(r);
  assert.deepEqual([first.file, first.line, first.column], ["m.alg", 3n, 5n], "the place as report's messages carry it");
  // A refuted claim with no reason: the text says which it is, and gives none.
  assert.deepEqual(lines(result([claim("refuted", 2)])), ["m.alg:2:1: error: a claim of the program as written is refuted"]);
});

test("a claim that waits is passed by default, and reported at each other level, after the errors", () => {
  const r = result([claim("waiting", 2), claim("refuted", 3)], [claim("waiting", 5, 3)]);
  assert.deepEqual(lines(r), ["m.alg:3:1: error: a claim of the program as written is refuted"]);
  for (const level of ["note", "warning", "error"] as const)
    assert.deepEqual(lines(r, { waiting: level }), [
      "m.alg:3:1: error: a claim of the program as written is refuted",
      `m.alg:2:1: ${level}: a claim of the program as written waits: the check could not decide it`,
      `m.alg:5:3: ${level}: a claim of the broader analysis waits: the check could not decide it`,
    ], level);
  // No claim waits: no message, whatever the level.
  assert.deepEqual(lines(result([claim("decided", 2)], [claim("decided", 2)]), { waiting: "error" }), []);
});

test("a claim in both lists is reported once: refuted in either, or waiting in either", () => {
  const both = result([claim("refuted", 3, 1, ["r"])], [claim("refuted", 3, 1, ["r"])]);
  assert.deepEqual(lines(both), ["m.alg:3:1: error: a claim of the program as written is refuted: r"]);
  // Decided as written and waiting for every argument: one message, the broader list's.
  const decidedThenWaiting = result([claim("decided", 4)], [claim("waiting", 4)]);
  assert.deepEqual(lines(decidedThenWaiting, { waiting: "warning" }), ["m.alg:4:1: warning: a claim of the broader analysis waits: the check could not decide it"]);
  const waitingInBoth = result([claim("waiting", 4)], [claim("waiting", 4)]);
  assert.deepEqual(lines(waitingInBoth, { waiting: "note" }), ["m.alg:4:1: note: a claim of the program as written waits: the check could not decide it"]);
  // Refuted in one and waiting in the other: the error alone.
  assert.deepEqual(lines(result([claim("waiting", 6)], [claim("refuted", 6)]), { waiting: "error" }), ["m.alg:6:1: error: a claim of the broader analysis is refuted"]);
});

test("a name or a value that is none of the settings' is a finding, which says who set it", () => {
  assert.equal(checkFinding("unread", "on", "the command line"), undefined);
  assert.equal(checkFinding("waiting", "warning", "the command line"), undefined);
  assert.equal(checkFinding("unused", "on", "the command line"), "the command line sets check unused, which names no check setting: the names are arguments, uncalled, unread and waiting");
  assert.equal(checkFinding("unread", "yes", "the project's file"), 'the project\'s file sets check unread to "yes", which is none of its values: on and off');
  assert.equal(checkFinding("waiting", "fail", "x"), 'x sets check waiting to "fail", which is none of its values: pass, note, warning and error');
});

test("the checks reach no host API", () => {
  const source = fs.readFileSync(path.join(here, "checks.ts"), "utf8").replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(source, /\bprocess\.|from "fs"|from "path"|\bBuffer\b/);
});
