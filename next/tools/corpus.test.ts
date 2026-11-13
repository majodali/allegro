// Tests of the acceptance corpus's check (next/tools/corpus.ts), run by
// Node's test runner through tsx (`npm run test:next`). The check is probed
// against known-bad inventories built in memory before it is trusted, and
// the committed inventory is checked against the present tree, with a fresh
// dry listing of the suite's registrations.

import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import {
  pinsOf, pinnedPrograms, deriveSource, initialCorpus, checkCorpus, compareRegistered, syncCorpus,
  serializeCorpus, serializeRegistered, testCases, duplicateNames, moduleId, checkRepository, applyOverlay, casesByDecision,
  type Corpus, type RegisteredTest, type RegisteredList, type Case,
} from "./corpus.js";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");

const A = "x = 1\nprint(x)  // expect: 1\n// prose\nprint(2) //expect:   two words  \n";
const B = "// expect: b1\n";
const REGISTERED: RegisteredTest[] = [
  { module: "src/test/base.ts", name: "file: a.alg" },
  { module: "src/test/base.ts", name: "adds" },
  { module: "src/test/zeta.ts", name: "grammar2/std: b.alg runs end-to-end" },
  { module: "src/test/base.ts", name: "adds" },
];
const TITLES = new Set(["Alpha", "Beta"]);
const source = () => deriveSource([...pinsOf("tests/a.alg", A), ...pinsOf("demos/r1/b.alg", B)], REGISTERED);
const good = (): Corpus => initialCorpus(source());
const check = (c: unknown) => checkCorpus(source(), c, TITLES);
const set = (c: Corpus, i: number, fields: Record<string, unknown>) => { c.cases[i] = { ...c.cases[i], ...fields } as Case; };

test("pins are read with the suite's pattern and trimmed, ordinals from 1", () => {
  assert.deepEqual(pinsOf("tests/a.alg", A), [
    { file: "tests/a.alg", ordinal: 1, line: 2, expect: "1" },
    { file: "tests/a.alg", ordinal: 2, line: 4, expect: "two words" },
  ]);
});

test("the programs run against their pins are named by the runners' tests", () => {
  const programs = ["basics.alg", "demos/r1/b.alg", "tests/a.alg", "tests/c.alg"];
  assert.deepEqual(pinnedPrograms(REGISTERED, programs), { files: ["demos/r1/b.alg", "tests/a.alg"], findings: [] });
  const r = pinnedPrograms([{ module: "m", name: "file: a.alg" }, { module: "m", name: "file: gone.alg" }], ["tests/a.alg", "demos/r1/a.alg"]);
  assert.deepEqual(r.findings, [
    'test "file: a.alg" runs a.alg, which names 2 programs (tests/a.alg, demos/r1/a.alg)',
    'test "file: gone.alg" runs gone.alg, which is no program of tests/, demos/ or the root',
  ]);
});

test("test ids: module without src/test/ and .ts, a second test of one name gets #2, order by module then registration", () => {
  assert.equal(moduleId("src/test/base.ts"), "base");
  assert.equal(moduleId("src/boundary-tests.ts"), "boundary-tests");
  assert.deepEqual(testCases(REGISTERED).map((c) => c.id), [
    "test:base:file: a.alg", "test:base:adds", "test:base:adds#2", "test:zeta:grammar2/std: b.alg runs end-to-end",
  ]);
  assert.deepEqual(duplicateNames(REGISTERED), [{ name: "adds", modules: ["src/test/base.ts", "src/test/base.ts"] }]);
});

// ── Probes against known-bad inventories ──

test("a fresh inventory is consistent, pins by file before tests", () => {
  const c = good();
  assert.deepEqual(c.cases.slice(0, 3).map((x) => x.id), ["pin:demos/r1/b.alg#1", "pin:tests/a.alg#1", "pin:tests/a.alg#2"]);
  const r = check(c);
  assert.deepEqual(r.findings, []);
  assert.equal(r.summary, "corpus: 7 cases · pins 3 · tests 4 · classed 0 (survives 0, changes 0, detail 0) · unclassed 7 — consistent");
});

test("a pin case removed fails", () => {
  const c = good(); c.cases.splice(1, 1);
  assert.deepEqual(check(c).findings, ['pin pin:tests/a.alg#1 (line 2, "1") has no case']);
});

test("a pin case duplicated fails", () => {
  const c = good(); c.cases.splice(2, 0, { ...c.cases[1] });
  assert.deepEqual(check(c).findings, ["pin:tests/a.alg#1 has 2 cases (cases 2, 3)"]);
});

test("a pin case's text altered fails, and so does its line", () => {
  const c = good(); set(c, 2, { expect: "two  words" }); set(c, 0, { line: 2 });
  assert.deepEqual(check(c).findings, [
    'case 1 pin:demos/r1/b.alg#1: line is 2, the present tree says 1',
    'case 3 pin:tests/a.alg#2: expect is "two  words", the present tree says "two words"',
  ]);
});

test("a pin case with no pin fails", () => {
  const c = good(); c.cases.splice(3, 0, { ...c.cases[2], id: "pin:tests/a.alg#3", line: 9 });
  assert.deepEqual(check(c).findings, ["case 4 pin:tests/a.alg#3: no pin of the present tree has this id (its program, or the pin, is gone or not run against its pins)"]);
});

test("a test case removed fails; a test case with no registration fails", () => {
  const c = good(); c.cases.splice(5, 1);
  assert.deepEqual(check(c).findings, ["test test:base:adds#2 has no case"]);
  const d = good(); d.cases.push({ ...d.cases[6], id: "test:zeta:gone", name: "gone" } as Case);
  assert.deepEqual(check(d).findings, ["case 8 test:zeta:gone: no registered test has this id (run --sync if the suite changed)"]);
});

test("cases out of the stable order fail", () => {
  const c = good(); [c.cases[3], c.cases[4]] = [c.cases[4], c.cases[3]];
  assert.deepEqual(check(c).findings, ["case 5 test:base:file: a.alg: out of the stable order, it comes before test:base:adds"]);
});

test("a changes case with no ruling and no becomes fails", () => {
  const c = good(); set(c, 0, { class: "changes", milestone: 2 });
  assert.deepEqual(check(c).findings, [
    "case 1 pin:demos/r1/b.alg#1: class changes with no ruling",
    "case 1 pin:demos/r1/b.alg#1: class changes with no becomes (the new result, a string)",
  ]);
});

test("a ruling that is not a decision fails; a well-formed changes case passes", () => {
  const c = good(); set(c, 0, { class: "changes", ruling: "Gamma", becomes: "b2", milestone: 2 });
  assert.deepEqual(check(c).findings, [`case 1 pin:demos/r1/b.alg#1: ruling "Gamma" is no decision of next/decisions.json`]);
  const ok = good(); set(ok, 0, { class: "changes", ruling: "Alpha", becomes: "b2", milestone: 2, decisions: ["Alpha"] });
  assert.deepEqual(check(ok).findings, []);
  assert.match(check(ok).summary, /classed 1 \(survives 0, changes 1, detail 0\) · unclassed 6 — consistent$/);
});

test("a classed case with no milestone fails; detail needs none", () => {
  const c = good(); set(c, 1, { class: "survives" }); set(c, 2, { class: "detail" });
  assert.deepEqual(check(c).findings, ["case 2 pin:tests/a.alg#1: class survives with no milestone"]);
});

test("a class, a decision or a milestone outside the rules fails", () => {
  const c = good(); set(c, 1, { class: "kept" }); set(c, 2, { decisions: ["Alpha", "Omega"] }); set(c, 3, { milestone: 10 }); set(c, 4, { decisions: "Alpha" });
  assert.deepEqual(check(c).findings, [
    'case 2 pin:tests/a.alg#1: class "kept" is not null, survives, changes or detail',
    'case 3 pin:tests/a.alg#2: decision "Omega" is no decision of next/decisions.json',
    "case 4 test:base:file: a.alg: milestone 10 is neither null nor 1 to 9",
    "case 5 test:base:adds: decisions is not a list of strings",
  ]);
});

test("an inventory with no cases list fails, and every source is missing", () => {
  const f = check({ _: "x" }).findings;
  assert.equal(f[0], "the corpus has no cases list");
  assert.equal(f.length, 8);
});

// ── The registered-tests list ──

test("the committed list differing from the dry listing fails: added, removed, reordered", () => {
  const listed = REGISTERED;
  assert.deepEqual(compareRegistered(REGISTERED, listed), []);
  assert.deepEqual(compareRegistered(REGISTERED.slice(0, 3), listed), [
    "next/corpus/registered-tests.json lacks a test the suite registers: src/test/base.ts · adds (run --sync)",
  ]);
  assert.deepEqual(compareRegistered([...REGISTERED, { module: "src/test/zeta.ts", name: "x" }], listed), [
    "next/corpus/registered-tests.json lists a test the suite does not register: src/test/zeta.ts · x (run --sync)",
  ]);
  assert.deepEqual(compareRegistered([REGISTERED[1], REGISTERED[0], ...REGISTERED.slice(2)], listed), [
    "next/corpus/registered-tests.json lists the suite's tests in another order than they register (run --sync)",
  ]);
});

// ── Serialisation and sync ──

test("the serialisers write one entry per line and round-trip", () => {
  const c = good();
  const text = serializeCorpus(c);
  assert.equal(text.split("\n").filter((l) => l.startsWith('    {"id":')).length, 7);
  assert.deepEqual(JSON.parse(text), JSON.parse(JSON.stringify(c)));
  const list: RegisteredList = { _: "n", tests: REGISTERED };
  assert.deepEqual(JSON.parse(serializeRegistered(list)), list);
});

test("sync keeps hand-edited fields, renumbers pins around an inserted one, adds new tests and drops gone cases", () => {
  const c = good();
  set(c, 2, { class: "survives", milestone: 1, decisions: ["Beta"], note: "kept" });
  set(c, 5, { class: "detail" });
  const A2 = "print(0) // expect: zero\n" + A.replace("// expect: 1", "// expect: one");
  const reg = [...REGISTERED.slice(0, 3), { module: "src/test/base.ts", name: "new" }];
  const src = deriveSource([...pinsOf("tests/a.alg", A2), ...pinsOf("demos/r1/b.alg", B)], reg);
  const r = syncCorpus(src, c);
  assert.deepEqual(r.added, ["pin:tests/a.alg#1", "pin:tests/a.alg#2", "test:base:new"]);
  assert.deepEqual(r.gone.map((x) => x.id), ["pin:tests/a.alg#1", "test:base:adds#2"]);
  assert.deepEqual(checkCorpus(src, r.corpus, TITLES).findings, []);
  const moved = r.corpus.cases.find((x) => x.id === "pin:tests/a.alg#3")!;
  assert.deepEqual([moved.expect, moved.line, moved.class, moved.milestone, moved.decisions, moved.note], ["two words", 5, "survives", 1, ["Beta"], "kept"]);
  assert.equal(r.gone[1].class, "detail");
});

// ── The committed files ──

test("an overlay classes its cases whole, and refuses an id that is no case or a field it may not set", () => {
  const c = good(); set(c, 0, { class: "changes", ruling: "Alpha", becomes: "b2", milestone: 2 });
  const r = applyOverlay(c, {
    "pin:demos/r1/b.alg#1": { class: "survives", decisions: ["Beta"], milestone: 3, note: "the source changes" },
    "pin:tests/a.alg#2": { class: "detail" },
  });
  assert.deepEqual(r.errors, []);
  assert.equal(r.applied, 2);
  const first = r.corpus.cases[0] as Record<string, unknown>;
  assert.deepEqual([first.class, first.decisions, first.milestone, first.note], ["survives", ["Beta"], 3, "the source changes"]);
  assert.equal("ruling" in first, false, "a field the entry leaves out is removed");
  assert.equal("becomes" in first, false);
  assert.deepEqual(check(r.corpus).findings, []);
  assert.equal(r.corpus.cases[1].class, null, "a case with no entry is untouched");

  const bad = applyOverlay(good(), { "pin:nowhere#1": { class: "detail" }, "pin:tests/a.alg#1": { class: "detail", expect: "x" } });
  assert.deepEqual(bad.errors, [
    "overlay: pin:nowhere#1 is not a case of the corpus",
    "overlay: pin:tests/a.alg#1 sets expect, which an overlay may not set",
  ]);
  assert.equal(bad.applied, 0);
});

test("the cases by decision: every listing counted once under its class, in the decisions' order; an unclassed case and an unknown title are left out", () => {
  const c = good();
  const [a, b, d] = [c.cases[0], c.cases[1], c.cases[2]];
  Object.assign(a, { class: "survives", decisions: ["Beta", "Alpha", "Beta"], milestone: 3 });
  Object.assign(b, { class: "changes", ruling: "Alpha", becomes: "x", decisions: ["Alpha", "Gamma"], milestone: 3 });
  Object.assign(d, { decisions: ["Alpha"] });
  const rows = casesByDecision([{ title: "Alpha", owner: "R" }, { title: "Beta", owner: "Q" }, { title: "Delta", owner: "none" }], c);
  assert.deepEqual(rows, [
    { title: "Alpha", owner: "R", survives: [a.id], changes: [b.id], detail: [] },
    { title: "Beta", owner: "Q", survives: [a.id], changes: [], detail: [] },
    { title: "Delta", owner: "none", survives: [], changes: [], detail: [] },
  ]);
});

test("the committed inventory is consistent with the present tree, by a fresh dry listing", () => {
  const r = checkRepository(ROOT);
  assert.deepEqual(r.findings, []);
  assert.match(r.summary, /^corpus: 1992 cases · pins 613 · tests 1379 · /);
});

test("the committed files are in the serialisers' form, one entry per line", () => {
  const cases = fs.readFileSync(path.join(ROOT, "next/corpus/cases.json"), "utf-8");
  assert.equal(serializeCorpus(JSON.parse(cases) as Corpus), cases);
  const reg = fs.readFileSync(path.join(ROOT, "next/corpus/registered-tests.json"), "utf-8");
  assert.equal(serializeRegistered(JSON.parse(reg) as RegisteredList), reg);
});
