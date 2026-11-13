// The acceptance corpus (B-196, docs/plans/rebuild-acceptance.md §1 "Case"
// and "Class", chunk Q2): `next/corpus/cases.json` holds one case per pinned
// output line of the present tree's programs and one per test of its suite,
// one case per line. A case names its source, and carries the fields a
// later part of Q2 fills by hand: its class (survives, changes, detail), the
// ruling and new result of a case that changes, the decisions it tests and
// the milestone that must pass it. This file generates the inventory once,
// syncs it when the present tree changes under the freeze's exception, and
// checks it.
//
//   npx tsx next/tools/corpus.ts            the check (same as --check)
//   npx tsx next/tools/corpus.ts --check    findings, one per line; exit 1 on any
//   npm run lint:corpus                     the same check
//   npx tsx next/tools/corpus.ts --summary  the check's last line only
//   npx tsx next/tools/corpus.ts --init     write next/corpus/registered-tests.json
//                                           and next/corpus/cases.json; refuses
//                                           if the cases file exists
//   npx tsx next/tools/corpus.ts --sync     regenerate the registered-tests list,
//                                           add cases for new pins and tests,
//                                           drop and print cases whose source is
//                                           gone, keep every hand-edited field
//   npx tsx next/tools/corpus.ts --apply <overlay.json>
//                                           class cases from an overlay: a map
//                                           from case id to class, ruling,
//                                           becomes, decisions, milestone and
//                                           an optional note; run the check after
//   npx tsx next/tools/corpus.ts --rename-decision "<old>" "<new>"
//                                           follow a decision the inventory
//                                           retitled: every case that lists
//                                           the old title, or cites it as its
//                                           ruling, takes the new one. Run it
//                                           after decision-map.ts --sync
//                                           --rename; it refuses a new title
//                                           the map does not hold
//   npx tsx next/tools/corpus.ts --by-decision
//                                           one line per decision of the map,
//                                           in its order: its owner and the
//                                           number of cases that list it, by
//                                           class; then the decisions no case
//                                           lists
//   npx tsx next/tools/corpus.ts --by-decision "<title>"
//                                           the ids of the cases that list
//                                           that decision, each with its class
//                                           and milestone
//
// Where the cases come from.
//   A pin is a line of a program matching the suite's own pattern
//   /\/\/\s*expect:\s*(.*)/ (src/test/alg-files.ts `runAlgFile`), its text
//   the trimmed capture, exactly what the suite compares with the output.
//   The programs are those of tests/*.alg, demos/*/*.alg and basics.alg that
//   the suite runs against their pins: a program is run against its pins
//   when a registered test is named `file: <basename>` (`fileTest`) or
//   `grammar2/std: <basename> runs end-to-end` (the grammar2 runner of
//   src/test/grammar2-language.ts, which reads the same pattern).
//   A test is one registration of `test` or `asyncTest` of
//   src/test/harness.ts. The names come from the suite itself, by a dry
//   listing: the suite's index src/test/index.ts is imported in a child
//   process with ALLEGRO_TEST_FILTER set to a pattern no name matches, so
//   the harness counts every registration and runs no body; the listing
//   reads each name as the harness hands it to the filter, and the module
//   from the registration's stack (the first file under src/ other than the
//   harness and the corpus runner alg-files.ts). It takes about a second
//   and edits nothing in the present tree. Two tests of one module with one
//   name get the ids `…<name>` and `…<name>#2`.
//
// What the check catches. Every pin of a program run against its pins has
// exactly one case, at the same line with the same text, and no pin case
// lacks its pin; every registration has exactly one case and no test case
// lacks its registration; the committed list
// next/corpus/registered-tests.json equals the dry listing entry for entry,
// so a test added, removed, renamed or moved between modules fails the
// check until --sync; the cases are in the stable order; class, ruling,
// becomes, decisions and milestone obey the rules of docs/plans/
// rebuild-acceptance.md §1 and §5 row Q2, against the titles of
// next/decisions.json.
//
// What it cannot catch. Whether a test body really tests what its name
// says, or a `file:` or grammar2 test really compares the pins (the runner
// is known by its test's name); a test registered only inside another
// test's body, or only after a body has run, since no body runs (the dry
// count equals the full run's total today); a pin the suite compares in
// some other way than the two runners; whether a class, ruling, becomes,
// decision or milestone is right, only that it is well formed. A
// registration whose stack names no file under src/ gets module "?".
//
// Tested by next/tools/corpus.test.ts, against known-bad inventories.

import * as fs from "fs";
import * as path from "path";
import { spawnSync } from "child_process";

export const CASES_PATH = "next/corpus/cases.json";
export const REGISTERED_PATH = "next/corpus/registered-tests.json";
export const DECISIONS_PATH = "next/decisions.json";
export const SUITE_INDEX = "src/test/index.ts";

export const CLASSES = ["survives", "changes", "detail"] as const;
export type CaseClass = (typeof CLASSES)[number];

// ── Pins ──────────────────────────────────────────────────────────────

/** The suite's pin pattern, as `runAlgFile` and the grammar2 runner read it. */
export const PIN_PATTERN = /\/\/\s*expect:\s*(.*)/;

export interface Pin { file: string; ordinal: number; line: number; expect: string }

/** Every pin of one program, in order, ordinals from 1. */
export function pinsOf(file: string, text: string): Pin[] {
  const pins: Pin[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const m = raw.match(PIN_PATTERN);
    if (m) pins.push({ file, ordinal: pins.length + 1, line: i + 1, expect: m[1].trim() });
  });
  return pins;
}

/** The program files the corpus draws from, repo-relative, sorted. */
export function programFiles(root: string): string[] {
  const out: string[] = [];
  const algIn = (dir: string) =>
    fs.existsSync(path.join(root, dir))
      ? fs.readdirSync(path.join(root, dir)).filter((n) => n.endsWith(".alg") && fs.statSync(path.join(root, dir, n)).isFile()).map((n) => `${dir}/${n}`)
      : [];
  out.push(...algIn("tests"));
  if (fs.existsSync(path.join(root, "demos"))) {
    for (const d of fs.readdirSync(path.join(root, "demos"))) {
      if (fs.statSync(path.join(root, "demos", d)).isDirectory()) out.push(...algIn(`demos/${d}`));
    }
  }
  if (fs.existsSync(path.join(root, "basics.alg"))) out.push("basics.alg");
  return out.sort();
}

/** The test-name forms of the two runners that compare a program with its pins. */
export const PIN_RUNNERS: RegExp[] = [/^file: (.+\.alg)$/, /^grammar2\/std: (\S+\.alg) runs end-to-end$/];

/** The programs the registered tests run against their pins, by basename. */
export function pinnedPrograms(registered: RegisteredTest[], programs: string[]): { files: string[]; findings: string[] } {
  const byBase = new Map<string, string[]>();
  for (const p of programs) byBase.set(path.posix.basename(p), [...(byBase.get(path.posix.basename(p)) ?? []), p]);
  const files = new Set<string>();
  const findings: string[] = [];
  for (const t of registered) {
    for (const re of PIN_RUNNERS) {
      const m = t.name.match(re);
      if (!m) continue;
      const hits = byBase.get(m[1]) ?? [];
      if (hits.length === 1) files.add(hits[0]);
      else if (hits.length === 0) findings.push(`test "${t.name}" runs ${m[1]}, which is no program of tests/, demos/ or the root`);
      else findings.push(`test "${t.name}" runs ${m[1]}, which names ${hits.length} programs (${hits.join(", ")})`);
    }
  }
  return { files: [...files].sort(), findings };
}

// ── Registered tests ──────────────────────────────────────────────────

export interface RegisteredTest { module: string; name: string }
export interface RegisteredList { _: string; tests: RegisteredTest[] }

export const REGISTERED_NOTE =
  "The tests the present tree's suite registers (B-196, chunk Q2), in registration order, one per line: the module that registers each and its name, exactly. " +
  "Generated by next/tools/corpus.ts --init or --sync from a dry listing of the suite (src/test/index.ts imported with a filter no name matches, so no body runs); " +
  "npm run lint:corpus checks it against a fresh dry listing. Nobody edits it by hand.";

export function serializeRegistered(list: RegisteredList): string {
  const rows = list.tests.map((t, i) => `    ${JSON.stringify({ module: t.module, name: t.name })}${i < list.tests.length - 1 ? "," : ""}`);
  return `{\n  "_": ${JSON.stringify(list._)},\n  "tests": [\n${rows.join("\n")}\n  ]\n}\n`;
}

const DRY_FILTER = "^corpus dry listing \\u0000 no test has this name$";

/**
 * The child side of the dry listing: register every test of the suite and
 * run none, writing `[{module, name}]` to `out`. The harness calls its
 * filter's `test` once per registration, before it would run the body; the
 * listing answers false for the sentinel pattern and records the name.
 */
async function dryListChild(root: string, out: string): Promise<void> {
  process.env.ALLEGRO_TEST_FILTER = DRY_FILTER;
  delete process.env.ALLEGRO_TEST_SHARD;
  delete process.env.ALLEGRO_TEST_TRACE;
  const seen: RegisteredTest[] = [];
  const realTest = RegExp.prototype.test;
  const srcPrefix = path.join(root, "src") + path.sep;
  const skip = new Set(["src/test/harness.ts", "src/test/alg-files.ts"]);
  Error.stackTraceLimit = 100;
  RegExp.prototype.test = function (this: RegExp, s: string): boolean {
    if (this.source !== DRY_FILTER) return realTest.call(this, s);
    const stack = new Error().stack ?? "";
    let module = "?";
    for (const line of stack.split("\n")) {
      const at = line.indexOf(srcPrefix);
      if (at < 0) continue;
      const rel = "src/" + line.slice(at + srcPrefix.length).replace(/:\d+:\d+\)?\s*$/, "").split(path.sep).join("/");
      if (skip.has(rel)) continue;
      module = rel;
      break;
    }
    seen.push({ module, name: String(s) });
    return false;
  };
  process.on("beforeExit", () => { fs.writeFileSync(out, JSON.stringify(seen)); });
  console.log = () => {};
  process.chdir(root);
  await import(path.join(root, SUITE_INDEX));
}

/** List the suite's registrations by the dry listing, in a child process. */
export function listRegisteredTests(root: string): { tests: RegisteredTest[] | null; error: string | null } {
  const out = path.join(fs.mkdtempSync(path.join(process.env.TMPDIR ?? "/tmp", "corpus-")), "tests.json");
  const env = { ...process.env };
  delete env.ALLEGRO_TEST_SHARD;
  delete env.ALLEGRO_TEST_TRACE;
  const r = spawnSync(process.execPath, ["--import", "tsx", path.join(root, "next/tools/corpus.ts"), "--dry-list", out], {
    cwd: root, env, encoding: "utf-8", timeout: 120000,
  });
  try {
    if (r.status !== 0 || !fs.existsSync(out)) {
      return { tests: null, error: `the dry listing failed (exit ${r.status}): ${(r.stderr || r.error?.message || "").trim().split("\n").slice(-3).join(" | ")}` };
    }
    return { tests: JSON.parse(fs.readFileSync(out, "utf-8")) as RegisteredTest[], error: null };
  } finally {
    fs.rmSync(path.dirname(out), { recursive: true, force: true });
  }
}

/** Findings when the committed list differs from the dry listing. */
export function compareRegistered(committed: RegisteredTest[], listed: RegisteredTest[]): string[] {
  const key = (t: RegisteredTest) => `${t.module}\u0000${t.name}`;
  const same = committed.length === listed.length && committed.every((t, i) => key(t) === key(listed[i]));
  if (same) return [];
  const count = (ts: RegisteredTest[]) => { const m = new Map<string, number>(); for (const t of ts) m.set(key(t), (m.get(key(t)) ?? 0) + 1); return m; };
  const a = count(committed), b = count(listed);
  const findings: string[] = [];
  for (const [k, n] of b) if ((a.get(k) ?? 0) < n) findings.push(`${REGISTERED_PATH} lacks a test the suite registers: ${k.replace("\u0000", " · ")} (run --sync)`);
  for (const [k, n] of a) if ((b.get(k) ?? 0) < n) findings.push(`${REGISTERED_PATH} lists a test the suite does not register: ${k.replace("\u0000", " · ")} (run --sync)`);
  if (findings.length === 0) findings.push(`${REGISTERED_PATH} lists the suite's tests in another order than they register (run --sync)`);
  return findings;
}

// ── Cases ─────────────────────────────────────────────────────────────

export interface PinCase {
  id: string; kind: "pin"; file: string; line: number; expect: string;
  class: CaseClass | null; decisions: string[]; milestone: number | null;
  [field: string]: unknown;
}
export interface TestCase {
  id: string; kind: "test"; module: string; name: string;
  class: CaseClass | null; decisions: string[]; milestone: number | null;
  [field: string]: unknown;
}
export type Case = PinCase | TestCase;
export interface Corpus { _: string; cases: Case[] }

export const NOTE =
  "The acceptance corpus (B-196, docs/plans/rebuild-acceptance.md §1 'Case' and 'Class', chunk Q2): one case per line. " +
  "A pin case is one '// expect:' line of a program the present tree's suite runs against its pins (id pin:<file>#<ordinal>, the line and the pinned text exactly); " +
  "a test case is one test the suite registers (id test:<module without src/test/ and .ts>:<name>, #2 for a second test of one name in one module). " +
  "Pins come first by file then ordinal, tests by module then registration. id, kind, file, line, expect, module and name are derived and rewritten by next/tools/corpus.ts --sync; " +
  "class (null, survives, changes, detail), ruling and becomes (required when class is changes: a decision title of next/decisions.json and the new result), " +
  "decisions (titles of next/decisions.json) and milestone (1 to 9, required when class is survives or changes) are edited by hand and kept by --sync. " +
  "Checked by npm run lint:corpus.";

/** The id part of a module: `src/test/base.ts` -> `base`, `src/boundary-tests.ts` -> `boundary-tests`. */
export function moduleId(module: string): string {
  return module.replace(/^src\/test\//, "").replace(/^src\//, "").replace(/\.ts$/, "");
}

/** Derived pin cases, in the stable order. */
export function pinCases(pins: Pin[]): PinCase[] {
  return [...pins]
    .sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : a.ordinal - b.ordinal))
    .map((p) => ({ id: `pin:${p.file}#${p.ordinal}`, kind: "pin", file: p.file, line: p.line, expect: p.expect, class: null, decisions: [], milestone: null }));
}

/** Derived test cases, in the stable order: by module, then registration. */
export function testCases(registered: RegisteredTest[]): TestCase[] {
  const seen = new Map<string, number>();
  const withIds = registered.map((t, i) => {
    const base = `test:${moduleId(t.module)}:${t.name}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return { i, c: { id: n === 1 ? base : `${base}#${n}`, kind: "test" as const, module: t.module, name: t.name, class: null, decisions: [], milestone: null } };
  });
  return withIds.sort((a, b) => (a.c.module < b.c.module ? -1 : a.c.module > b.c.module ? 1 : a.i - b.i)).map((x) => x.c);
}

/** The tests that share a name, with their modules. */
export function duplicateNames(registered: RegisteredTest[]): { name: string; modules: string[] }[] {
  const by = new Map<string, string[]>();
  for (const t of registered) by.set(t.name, [...(by.get(t.name) ?? []), t.module]);
  return [...by].filter(([, ms]) => ms.length > 1).map(([name, modules]) => ({ name, modules }));
}

const PIN_KEYS = ["id", "kind", "file", "line", "expect", "class", "ruling", "becomes", "decisions", "milestone"] as const;
const TEST_KEYS = ["id", "kind", "module", "name", "class", "ruling", "becomes", "decisions", "milestone"] as const;

/** One case as one line of JSON, its fields in the fixed order; ruling and becomes only when present. */
export function serializeCase(c: Case): string {
  const r = c as Record<string, unknown>;
  const keys: readonly string[] = r.kind === "pin" ? PIN_KEYS : TEST_KEYS;
  const ordered: Record<string, unknown> = {};
  for (const k of keys) {
    if ((k === "ruling" || k === "becomes") && !(k in r)) continue;
    ordered[k] = r[k];
  }
  for (const k of Object.keys(r)) if (!keys.includes(k)) ordered[k] = r[k];
  return JSON.stringify(ordered);
}

/** The whole file: one case per line, so edits to different cases merge without conflict. */
export function serializeCorpus(corpus: Corpus): string {
  const rows = corpus.cases.map((c, i) => `    ${serializeCase(c)}${i < corpus.cases.length - 1 ? "," : ""}`);
  return `{\n  "_": ${JSON.stringify(corpus._)},\n  "cases": [\n${rows.join("\n")}\n  ]\n}\n`;
}

// ── Classing from an overlay ──────────────────────────────────────────

/** The fields an overlay may set on a case: the hand-edited ones, and a note. */
export const OVERLAY_FIELDS = ["class", "ruling", "becomes", "decisions", "milestone", "note"] as const;
export type Overlay = Record<string, Record<string, unknown>>;
export interface ApplyResult { corpus: Corpus; applied: number; errors: string[] }

/**
 * Class cases from an overlay: a map from case id to the hand-edited
 * fields. An entry replaces those fields on its case whole, so a field the
 * entry leaves out (a `ruling` on a case that no longer changes) is
 * removed. An id that is no case, or a field outside OVERLAY_FIELDS, is an
 * error and nothing is applied. Whether the result is well formed is the
 * check's question, not this function's.
 */
export function applyOverlay(corpus: Corpus, overlay: Overlay): ApplyResult {
  const errors: string[] = [];
  const ids = new Set(corpus.cases.map((c) => c.id));
  for (const [id, entry] of Object.entries(overlay)) {
    if (!ids.has(id)) errors.push(`overlay: ${id} is not a case of the corpus`);
    for (const k of Object.keys(entry)) if (!(OVERLAY_FIELDS as readonly string[]).includes(k)) errors.push(`overlay: ${id} sets ${k}, which an overlay may not set`);
  }
  if (errors.length > 0) return { corpus, applied: 0, errors };
  let applied = 0;
  const cases = corpus.cases.map((c) => {
    const entry = overlay[c.id];
    if (!entry) return c;
    applied++;
    const out: Record<string, unknown> = { ...c };
    for (const k of OVERLAY_FIELDS) delete out[k];
    out.class = null; out.decisions = []; out.milestone = null;
    for (const [k, v] of Object.entries(entry)) out[k] = v;
    return out as Case;
  });
  return { corpus: { _: corpus._, cases }, applied, errors };
}

/** What the present tree fixes: the derived cases, in order. */
export interface Source { pins: PinCase[]; tests: TestCase[] }

export function deriveSource(pins: Pin[], registered: RegisteredTest[]): Source {
  return { pins: pinCases(pins), tests: testCases(registered) };
}

export function initialCorpus(src: Source): Corpus {
  return { _: NOTE, cases: [...src.pins, ...src.tests] };
}

// ── The check ─────────────────────────────────────────────────────────

export interface CheckResult { findings: string[]; summary: string }

/** Check the cases (parsed JSON, any shape) against the present tree's pins and tests and the decision titles. */
export function checkCorpus(src: Source, corpus: unknown, decisionTitles: Set<string>): CheckResult {
  const findings: string[] = [];
  const listed = corpus !== null && typeof corpus === "object" && Array.isArray((corpus as { cases?: unknown }).cases);
  const cases: unknown[] = listed ? (corpus as { cases: unknown[] }).cases : [];
  if (!listed) findings.push("the corpus has no cases list");

  const expected = new Map<string, Case>();
  const order = new Map<string, number>();
  [...src.pins, ...src.tests].forEach((c, i) => { expected.set(c.id, c); order.set(c.id, i); });
  const byId = new Map<string, number[]>();
  const counts = { pin: 0, test: 0, survives: 0, changes: 0, detail: 0, unclassed: 0 };
  let lastOrder = -1;
  let lastId = "";

  cases.forEach((raw, i) => {
    const at = `case ${i + 1}`;
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) { findings.push(`${at}: not an object`); return; }
    const r = raw as Record<string, unknown>;
    if (typeof r.id !== "string") { findings.push(`${at}: no id`); return; }
    const label = `${at} ${r.id}`;
    byId.set(r.id, [...(byId.get(r.id) ?? []), i + 1]);
    if (r.kind === "pin") counts.pin++;
    else if (r.kind === "test") counts.test++;
    else findings.push(`${label}: kind ${JSON.stringify(r.kind)} is neither pin nor test`);

    const want = expected.get(r.id);
    if (want === undefined) {
      findings.push(r.kind === "pin"
        ? `${label}: no pin of the present tree has this id (its program, or the pin, is gone or not run against its pins)`
        : `${label}: no registered test has this id (run --sync if the suite changed)`);
    } else {
      const fields = want.kind === "pin" ? (["kind", "file", "line", "expect"] as const) : (["kind", "module", "name"] as const);
      for (const f of fields) {
        const w = (want as Record<string, unknown>)[f];
        if (r[f] !== w) findings.push(`${label}: ${f} is ${JSON.stringify(r[f])}, the present tree says ${JSON.stringify(w)}`);
      }
      const k = order.get(r.id)!;
      if (k < lastOrder) findings.push(`${label}: out of the stable order, it comes before ${lastId}`);
      else { lastOrder = k; lastId = r.id; }
    }

    const cls = r.class;
    if (cls === null) counts.unclassed++;
    else if (typeof cls === "string" && (CLASSES as readonly string[]).includes(cls)) counts[cls as CaseClass]++;
    else findings.push(`${label}: class ${JSON.stringify(cls)} is not null, survives, changes or detail`);
    if (cls === "changes") {
      if (typeof r.ruling !== "string") findings.push(`${label}: class changes with no ruling`);
      else if (!decisionTitles.has(r.ruling)) findings.push(`${label}: ruling "${r.ruling}" is no decision of ${DECISIONS_PATH}`);
      if (typeof r.becomes !== "string") findings.push(`${label}: class changes with no becomes (the new result, a string)`);
    }
    if (!Array.isArray(r.decisions) || r.decisions.some((d) => typeof d !== "string")) findings.push(`${label}: decisions is not a list of strings`);
    else for (const d of r.decisions as string[]) if (!decisionTitles.has(d)) findings.push(`${label}: decision "${d}" is no decision of ${DECISIONS_PATH}`);
    const ms = r.milestone;
    if (ms !== null && !(typeof ms === "number" && Number.isInteger(ms) && ms >= 1 && ms <= 9)) findings.push(`${label}: milestone ${JSON.stringify(ms)} is neither null nor 1 to 9`);
    if ((cls === "survives" || cls === "changes") && ms === null) findings.push(`${label}: class ${cls} with no milestone`);
  });

  for (const c of [...src.pins, ...src.tests]) {
    const at = byId.get(c.id);
    if (at === undefined) findings.push(c.kind === "pin" ? `pin ${c.id} (line ${c.line}, "${c.expect}") has no case` : `test ${c.id} has no case`);
    else if (at.length > 1) findings.push(`${c.id} has ${at.length} cases (cases ${at.join(", ")})`);
  }

  const classed = counts.survives + counts.changes + counts.detail;
  const verdict = findings.length === 0 ? "consistent" : `${findings.length} finding(s)`;
  const summary =
    `corpus: ${cases.length} cases · pins ${counts.pin} · tests ${counts.test} · classed ${classed} ` +
    `(survives ${counts.survives}, changes ${counts.changes}, detail ${counts.detail}) · unclassed ${counts.unclassed} — ${verdict}`;
  return { findings, summary };
}

// ── Sync ──────────────────────────────────────────────────────────────

export interface SyncResult { corpus: Corpus; added: string[]; gone: Case[] }

/** The longest common subsequence of two text lists, as index pairs. */
function align(a: string[], b: string[]): [number, number][] {
  const n = a.length, m = b.length;
  const t: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) t[i][j] = a[i] === b[j] ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1]);
  const pairs: [number, number][] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { pairs.push([i, j]); i++; j++; }
    else if (t[i + 1][j] >= t[i][j + 1]) i++;
    else j++;
  }
  return pairs;
}

const DERIVED = new Set(["id", "kind", "file", "line", "expect", "module", "name"]);

/** Carry every hand-edited field of `old` onto a fresh derived case. */
function carry<C extends Case>(fresh: C, old: Case): C {
  const out: Record<string, unknown> = { ...fresh };
  for (const [k, v] of Object.entries(old)) if (!DERIVED.has(k)) out[k] = v;
  return out as C;
}

/**
 * Rebuild the cases from the present tree, keeping hand-edited fields.
 * A program's old pin cases are aligned with its present pins by text (the
 * longest common subsequence), so a pin inserted or removed renumbers the
 * others without losing their fields; a test case is matched by module,
 * name and occurrence. A case left unmatched is gone: dropped from the file
 * and returned, so the caller prints it whole.
 */
export function syncCorpus(src: Source, corpus: Corpus): SyncResult {
  const oldPins = corpus.cases.filter((c): c is PinCase => c.kind === "pin");
  const oldTests = corpus.cases.filter((c): c is TestCase => c.kind === "test");
  const other = corpus.cases.filter((c) => c.kind !== "pin" && c.kind !== "test");
  const added: string[] = [];
  const gone: Case[] = [...other];

  const pinsOut: PinCase[] = [];
  const files = [...new Set([...oldPins.map((c) => c.file), ...src.pins.map((c) => c.file)])].sort();
  for (const f of files) {
    const olds = oldPins.filter((c) => c.file === f);
    const news = src.pins.filter((c) => c.file === f);
    const pairs = align(olds.map((c) => c.expect), news.map((c) => c.expect));
    const matchedOld = new Set(pairs.map(([i]) => i));
    const oldFor = new Map(pairs.map(([i, j]) => [j, i]));
    news.forEach((c, j) => {
      const i = oldFor.get(j);
      if (i === undefined) { pinsOut.push(c); added.push(c.id); } else pinsOut.push(carry(c, olds[i]));
    });
    olds.forEach((c, i) => { if (!matchedOld.has(i)) gone.push(c); });
  }

  const key = (c: { module: string; name: string }) => `${c.module}\u0000${c.name}`;
  const oldByKey = new Map<string, TestCase[]>();
  for (const c of oldTests) oldByKey.set(key(c), [...(oldByKey.get(key(c)) ?? []), c]);
  const testsOut: TestCase[] = src.tests.map((c) => {
    const queue = oldByKey.get(key(c));
    const old = queue?.shift();
    if (old === undefined) { added.push(c.id); return c; }
    return carry(c, old);
  });
  for (const rest of oldByKey.values()) gone.push(...rest);

  return { corpus: { _: corpus._, cases: [...pinsOut, ...testsOut] }, added, gone };
}

// ── main ──────────────────────────────────────────────────────────────

/** Every pin of the programs the registered tests run against their pins. */
export function presentPins(root: string, registered: RegisteredTest[]): { pins: Pin[]; findings: string[] } {
  const { files, findings } = pinnedPrograms(registered, programFiles(root));
  const pins = files.flatMap((f) => pinsOf(f, fs.readFileSync(path.join(root, f), "utf-8")));
  return { pins, findings };
}

export function decisionTitles(root: string): Set<string> {
  const map = JSON.parse(fs.readFileSync(path.join(root, DECISIONS_PATH), "utf-8")) as { rows: { title: string }[] };
  return new Set(map.rows.map((r) => r.title));
}

/**
 * Follow a retitled decision: every case that lists `from` among its
 * decisions, or cites it as its ruling, takes `to`. Returns the ids of the
 * cases changed. A case that already lists `to` beside `from` keeps one.
 */
export function renameDecision(corpus: Corpus, from: string, to: string): { corpus: Corpus; changed: string[] } {
  const changed: string[] = [];
  const cases = corpus.cases.map((c) => {
    const lists = c.decisions.includes(from);
    const cites = c.ruling === from;
    if (!lists && !cites) return c;
    changed.push(c.id);
    const out = { ...c } as Case;
    if (lists) out.decisions = [...new Set(c.decisions.map((t) => (t === from ? to : t)))];
    if (cites) out.ruling = to;
    return out;
  });
  return { corpus: { ...corpus, cases }, changed };
}

export interface DecisionCases { title: string; owner: string; survives: string[]; changes: string[]; detail: string[] }

/**
 * The cases by decision: for each decision, in the order given, the ids of
 * the cases that list it, by class. A case that lists a title not among the
 * decisions is skipped here; the check reports it.
 */
export function casesByDecision(decisions: { title: string; owner: string }[], corpus: Corpus): DecisionCases[] {
  const rows = new Map<string, DecisionCases>();
  for (const d of decisions) rows.set(d.title, { title: d.title, owner: d.owner, survives: [], changes: [], detail: [] });
  for (const c of corpus.cases) {
    if (c.class === null) continue;
    for (const t of new Set(c.decisions)) rows.get(t)?.[c.class].push(c.id);
  }
  return [...rows.values()];
}

function readJson(root: string, rel: string): { value: unknown; error: string | null } {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) return { value: null, error: `${rel} does not exist (generate it with --init)` };
  try { return { value: JSON.parse(fs.readFileSync(file, "utf-8")), error: null }; }
  catch (e) { return { value: null, error: `${rel} is not JSON: ${(e as Error).message}` }; }
}

/**
 * The repository's check: the committed registered-tests list against the
 * dry listing (`listed`, null to skip that step), then the cases against
 * the present tree's pins, that list and the decision titles.
 */
export function checkRepository(root: string, listed: RegisteredTest[] | null | "list" = "list"): CheckResult {
  const findings: string[] = [];
  const reg = readJson(root, REGISTERED_PATH);
  const committed = reg.error === null && Array.isArray((reg.value as RegisteredList).tests) ? (reg.value as RegisteredList).tests : [];
  if (reg.error !== null) findings.push(reg.error);
  else if (!Array.isArray((reg.value as RegisteredList).tests)) findings.push(`${REGISTERED_PATH} has no tests list`);
  let fresh = listed;
  if (fresh === "list") {
    const r = listRegisteredTests(root);
    if (r.error !== null) findings.push(r.error);
    fresh = r.tests;
  }
  if (fresh !== null) findings.push(...compareRegistered(committed, fresh));

  const { pins, findings: pinFindings } = presentPins(root, committed);
  findings.push(...pinFindings);
  const src = deriveSource(pins, committed);
  const cases = readJson(root, CASES_PATH);
  if (cases.error !== null) {
    const r = checkCorpus(src, { cases: [] }, new Set());
    return { findings: [...findings, cases.error, ...r.findings], summary: r.summary.replace(/— .*$/, `— ${findings.length + 1 + r.findings.length} finding(s)`) };
  }
  const r = checkCorpus(src, cases.value, decisionTitles(root));
  const all = [...findings, ...r.findings];
  return { findings: all, summary: r.summary.replace(/— (consistent|\d+ finding\(s\))$/, `— ${all.length === 0 ? "consistent" : `${all.length} finding(s)`}`) };
}

function main(): void {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
  const argv = process.argv.slice(2);
  const casesFile = path.join(root, CASES_PATH);

  if (argv[0] === "--apply") {
    if (!argv[1]) { console.error("--apply takes the path of an overlay file"); process.exit(1); }
    const corpus = JSON.parse(fs.readFileSync(casesFile, "utf-8")) as Corpus;
    const overlay = JSON.parse(fs.readFileSync(path.resolve(argv[1]), "utf-8")) as Overlay;
    const r = applyOverlay(corpus, overlay);
    if (r.errors.length > 0) { for (const e of r.errors) console.error(e); process.exit(1); }
    fs.writeFileSync(casesFile, serializeCorpus(r.corpus));
    console.log(`${CASES_PATH}: ${r.applied} case(s) classed from ${argv[1]}`);
    return;
  }

  if (argv[0] === "--dry-list") { void dryListChild(root, argv[1]); return; }

  if (argv[0] === "--rename-decision") {
    const [from, to] = [argv[1], argv[2]];
    if (!from || !to) { console.error('--rename-decision takes two titles: "<old>" "<new>"'); process.exit(1); }
    if (!decisionTitles(root).has(to)) { console.error(`"${to}" is no decision of ${DECISIONS_PATH}; run decision-map.ts --sync --rename first`); process.exit(1); }
    const r = renameDecision(JSON.parse(fs.readFileSync(casesFile, "utf-8")) as Corpus, from, to);
    if (r.changed.length === 0) { console.error(`no case lists or cites "${from}"`); process.exit(1); }
    fs.writeFileSync(casesFile, serializeCorpus(r.corpus));
    console.log(`${CASES_PATH}: ${r.changed.length} case(s) moved from "${from}" to "${to}"`);
    return;
  }

  if (argv[0] === "--by-decision") {
    const map = JSON.parse(fs.readFileSync(path.join(root, DECISIONS_PATH), "utf-8")) as { rows: { title: string; owner: string }[] };
    const corpus = JSON.parse(fs.readFileSync(casesFile, "utf-8")) as Corpus;
    const rows = casesByDecision(map.rows, corpus);
    if (argv[1]) {
      const row = rows.find((r) => r.title === argv[1]);
      if (!row) { console.error(`no decision titled "${argv[1]}" in ${DECISIONS_PATH}`); process.exit(1); }
      const byId = new Map(corpus.cases.map((c) => [c.id, c]));
      for (const cls of CLASSES) for (const id of row[cls]) console.log(`${cls}\t${byId.get(id)!.milestone ?? "-"}\t${id}`);
      console.log(`${row.title} (owner ${row.owner}): survives ${row.survives.length}, changes ${row.changes.length}, detail ${row.detail.length}`);
      return;
    }
    for (const r of rows) console.log(`${r.owner}\t${r.survives.length}\t${r.changes.length}\t${r.detail.length}\t${r.title}`);
    const none = rows.filter((r) => r.survives.length + r.changes.length + r.detail.length === 0);
    const owners = [...new Set(rows.map((r) => r.owner))].sort();
    console.log(`decisions ${rows.length} · listed by a case ${rows.length - none.length} · listed by none ${none.length} (${owners.map((o) => `${o} ${none.filter((r) => r.owner === o).length}`).join(", ")}) — columns: owner, survives, changes, detail, title`);
    return;
  }

  if (argv.includes("--init") || argv.includes("--sync")) {
    const init = argv.includes("--init");
    if (init && fs.existsSync(casesFile)) { console.error(`${CASES_PATH} exists: the corpus is generated once; use --sync`); process.exit(1); }
    const r = listRegisteredTests(root);
    if (r.tests === null) { console.error(r.error); process.exit(1); }
    const { pins, findings } = presentPins(root, r.tests);
    if (findings.length > 0) { for (const f of findings) console.error(f); process.exit(1); }
    const src = deriveSource(pins, r.tests);
    fs.mkdirSync(path.dirname(casesFile), { recursive: true });
    fs.writeFileSync(path.join(root, REGISTERED_PATH), serializeRegistered({ _: REGISTERED_NOTE, tests: r.tests }));
    let corpus: Corpus;
    if (init) corpus = initialCorpus(src);
    else {
      const s = syncCorpus(src, JSON.parse(fs.readFileSync(casesFile, "utf-8")) as Corpus);
      for (const id of s.added) console.log(`added: ${id}`);
      for (const c of s.gone) console.log(`gone, dropped: ${serializeCase(c)}`);
      corpus = s.corpus;
    }
    fs.writeFileSync(casesFile, serializeCorpus(corpus));
    for (const d of duplicateNames(r.tests)) console.log(`shared name: "${d.name}" in ${d.modules.join(", ")}`);
    console.log(`${REGISTERED_PATH}: ${r.tests.length} tests written`);
    console.log(`${CASES_PATH}: ${corpus.cases.length} cases written (pins ${src.pins.length}, tests ${src.tests.length})`);
    return;
  }

  const { findings, summary } = checkRepository(root);
  if (!argv.includes("--summary")) for (const f of findings) console.log(f);
  console.log(summary);
  if (findings.length > 0) process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) main();
