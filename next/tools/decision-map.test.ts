// Tests of the decision map's check (next/tools/decision-map.ts), run by
// Node's test runner through tsx (`npm run test:next`). The check is probed
// against known-bad maps built in memory before it is trusted, and the
// committed map is checked against the committed inventory.

import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import {
  parseInventory, deriveAll, normalisePresent, ownerOf, initialMap, checkMap, checkRepository,
  serializeMap, syncMap, type DecisionMap, type Derived, type Row,
} from "./decision-map.js";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");

const FIXTURE = `# An inventory

**Part I: The bet**

1. **First chapter** (2 decisions). Text.
   - Decisions: A; B.

**Part VI: Building**

2. **The kernel's interface** (1 decision). Text.
3. **Plans as outcome graphs** (1 decision; held).
4. **Tools** (1 decision).

## Findings held for their decisions

### Not a chapter

#### Not a decision
- Status: settled

## The decisions, in book order

### First chapter

**A thesis, not a decision.**

#### Alpha
- Decides: something.
- Status: settled for proofs; reworded 2026-11-12
- Type: capability — a note
- Chapter: First chapter

#### Beta
- Status: open, a design to prove; ruled 2026-11-11
- Type: implementation
- Chapter: Elsewhere

### The kernel's interface

#### Gamma
- Status: partly built (the code has one); ruled 2026-11-13
- Type: capability

### Plans as outcome graphs

#### Delta
- Status: to prove; ruled 2026-11-11
- Type: capability

### Tools

#### Epsilon
- Status: open (a goal); ruled 2026-11-13
- Type: capability

## Identifier key
`;

test("the inventory parser reads the contents and the decisions section only", () => {
  const inv = parseInventory(FIXTURE);
  assert.deepEqual([...inv.partOf.entries()], [
    ["First chapter", "I"], ["The kernel's interface", "VI"], ["Plans as outcome graphs", "VI"], ["Tools", "VI"],
  ]);
  assert.deepEqual(inv.entries.map((e) => [e.title, e.chapter, e.chapterLine]), [
    ["Alpha", "First chapter", "First chapter"],
    ["Beta", "First chapter", "Elsewhere"],
    ["Gamma", "The kernel's interface", null],
    ["Delta", "Plans as outcome graphs", null],
    ["Epsilon", "Tools", null],
  ]);
  const { derived, findings } = deriveAll(inv);
  assert.deepEqual(findings, ['inventory line 33 "Beta": sits under "First chapter" but its Chapter line says "Elsewhere"']);
  assert.deepEqual(derived.map((d) => [d.title, d.part, d.type, d.present, d.owner, d.held ?? false]), [
    ["Alpha", "I", "capability", "settled", "none", false],
    ["Beta", "I", "implementation", "open", "none", false],
    ["Gamma", "VI", "capability", "partly built", "R", false],
    ["Delta", "VI", "capability", "open", "Q", true],
    ["Epsilon", "VI", "capability", "open", "Q", false],
  ]);
});

test("status and owner normalisation", () => {
  assert.equal(normalisePresent("settled for proofs; reworded"), "settled");
  assert.equal(normalisePresent("open, a goal; ruled"), "open");
  assert.equal(normalisePresent("to prove; ruled"), "open");
  assert.equal(normalisePresent("partly built (x)"), "partly built");
  assert.equal(normalisePresent("unknown"), null);
  assert.equal(ownerOf("I", "x"), "none");
  assert.equal(ownerOf("III", "x"), "R");
  assert.equal(ownerOf("VI", "The kernel's interface"), "R");
  assert.equal(ownerOf("VI", "Tools"), "Q");
  assert.equal(ownerOf("V", "Models"), "Q");
});

// ── Probes against known-bad maps ──

const derived: Derived[] = deriveAll(parseInventory(FIXTURE)).derived;
const good = (): DecisionMap => initialMap(derived);
const exists = (rel: string) => rel === "next/kernel/eval.ts";
const check = (m: unknown) => checkMap(derived, m, exists);

test("a fresh map is consistent", () => {
  const r = check(good());
  assert.deepEqual(r.findings, []);
  assert.equal(r.summary, "decision-map: 5 rows · R 1 · Q 2 · none 2 · state none 5, carried 0, adapted 0, written 0, proved 0 — consistent");
});

test("a row removed fails", () => {
  const m = good(); m.rows.splice(2, 1);
  assert.deepEqual(check(m).findings, ['decision "Gamma" (The kernel\'s interface) has no row']);
});

test("a row duplicated fails", () => {
  const m = good(); m.rows.splice(3, 0, { ...m.rows[2] });
  assert.deepEqual(check(m).findings, ['decision "Gamma" has 2 rows (rows 3, 4)']);
});

test("an orphan row fails", () => {
  const m = good(); m.rows.push({ ...m.rows[4], title: "Zeta" });
  assert.match(check(m).findings.join("\n"), /row 6 "Zeta": orphan row/);
});

test("a wrong owner fails", () => {
  const m = good(); m.rows[2].owner = "Q";
  assert.deepEqual(check(m).findings, ['row 3 "Gamma": owner is "Q", the inventory says "R"']);
});

test("a wrong derived field fails, held included", () => {
  const m = good(); m.rows[0].present = "open"; delete m.rows[3].held; m.rows[4].held = true;
  assert.deepEqual(check(m).findings, [
    'row 1 "Alpha": present is "open", the inventory says "settled"',
    'row 4 "Delta": held is missing, the decision is held',
    'row 5 "Epsilon": held is true, the decision is not held (omit the field)',
  ]);
});

test("a state with no unit fails; a state outside the five fails", () => {
  const m = good(); m.rows[2].state = "written"; (m.rows[3] as unknown as Record<string, unknown>).state = "done";
  assert.deepEqual(check(m).findings, [
    'row 3 "Gamma": state written with no unit',
    'row 4 "Delta": state "done" is not one of none, carried, adapted, written, proved',
  ]);
});

test("a unit outside next/ fails; a unit that does not exist fails; one that exists passes", () => {
  const m = good();
  m.rows[2].state = "written"; m.rows[2].unit = "src/evaluator.ts";
  m.rows[3].state = "adapted"; m.rows[3].unit = "next/models/plan.alg";
  m.rows[4].state = "carried"; m.rows[4].unit = "next/../src/x.ts";
  assert.deepEqual(check(m).findings, [
    'row 3 "Gamma": unit src/evaluator.ts is not a path under next/',
    'row 4 "Delta": unit next/models/plan.alg does not exist',
    'row 5 "Epsilon": unit next/../src/x.ts is not a path under next/',
  ]);
  const ok = good(); ok.rows[2].state = "proved"; ok.rows[2].unit = "next/kernel/eval.ts";
  assert.deepEqual(check(ok).findings, []);
  assert.match(check(ok).summary, /state none 4, carried 0, adapted 0, written 0, proved 1 — consistent$/);
});

test("a state on a row owned by none fails", () => {
  const m = good(); m.rows[0].state = "carried"; m.rows[0].unit = "next/kernel/eval.ts";
  assert.deepEqual(check(m).findings, ['row 1 "Alpha": state carried on a row owned by none']);
});

test("cases that are not a list of strings fail", () => {
  const m = good(); (m.rows[1] as unknown as Record<string, unknown>).cases = [1];
  assert.deepEqual(check(m).findings, ['row 2 "Beta": cases is not a list of strings']);
});

test("rows out of order fail", () => {
  const m = good(); [m.rows[1], m.rows[2]] = [m.rows[2], m.rows[1]];
  assert.deepEqual(check(m).findings, ['row 3 "Beta": out of the inventory\'s order, it comes before "Gamma"']);
});

test("a map with no rows list fails, and every decision is missing", () => {
  const f = check({ _: "x" }).findings;
  assert.equal(f[0], "the map has no rows list");
  assert.equal(f.length, 6);
});

// ── Serialisation and sync ──

test("the serialiser writes one row per line and round-trips", () => {
  const m = good();
  const text = serializeMap(m);
  const lines = text.split("\n");
  assert.equal(lines.filter((l) => l.startsWith('    {"title":')).length, 5);
  assert.deepEqual(JSON.parse(text), JSON.parse(JSON.stringify(m)));
});

test("sync keeps state, unit and cases, rewrites derived fields and adds new decisions", () => {
  const m = good();
  m.rows[2] = { ...m.rows[2], owner: "Q", state: "written", unit: "next/kernel/eval.ts", cases: ["c1"] };
  m.rows.splice(4, 1);
  const r = syncMap(derived, m);
  assert.deepEqual(r.added, ["Epsilon"]);
  assert.deepEqual(r.orphans, []);
  assert.deepEqual(check(r.map).findings, []);
  const g = r.map.rows[2] as Row;
  assert.deepEqual([g.owner, g.state, g.unit, g.cases], ["R", "written", "next/kernel/eval.ts", ["c1"]]);
});

test("sync never guesses a rename: an orphan is kept and reported until --rename moves it", () => {
  const m = good();
  m.rows[1] = { ...m.rows[1], title: "Beta, old title", cases: ["c2"] };
  const r = syncMap(derived, m);
  assert.deepEqual(r.added, ["Beta"]);
  assert.deepEqual(r.orphans, ["Beta, old title"]);
  assert.deepEqual(r.map.rows.map((x) => x.title), ["Alpha", "Beta, old title", "Beta", "Gamma", "Delta", "Epsilon"]);
  assert.match(check(r.map).findings.join("\n"), /orphan row/);
  const moved = syncMap(derived, m, [["Beta, old title", "Beta"]]);
  assert.deepEqual(moved.errors, []);
  assert.deepEqual(check(moved.map).findings, []);
  assert.deepEqual(moved.map.rows[1].cases, ["c2"]);
  assert.match(syncMap(derived, m, [["No such row", "Beta"]]).errors[0], /0 rows titled/);
});

// ── The committed files ──

test("the committed map is consistent with the committed inventory", () => {
  const r = checkRepository(ROOT);
  assert.deepEqual(r.findings, []);
  assert.match(r.summary, /^decision-map: 231 rows · R 141 · Q 67 · none 23 · /);
});

test("the committed map is in the serialiser's form, one row per line", () => {
  const text = fs.readFileSync(path.join(ROOT, "next/decisions.json"), "utf-8");
  assert.equal(serializeMap(JSON.parse(text) as DecisionMap), text);
});
