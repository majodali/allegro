// The census of milestone 3 (B-196 (the rebuild's acceptance side), chunk
// Q5 (the first notation and the bootstrap), part 1): what the corpus's
// milestone 3 cases need, read from the present tree's parse.
//
//   npx tsx next/bootstrap/census.ts            the table, as Markdown
//   npx tsx next/bootstrap/census.ts --cases    and every case with its needs
//
// For each case of next/corpus/cases.json due at milestone 3 it finds the
// Allegro texts the case runs and has the emitter (next/bootstrap/emit.ts)
// read each, which has the present tree's parser read it. A case's needs
// are the emitter's findings on its texts: the same needs the emitter
// refuses on, so the census and the emitter cannot disagree.
//
// Where the texts come from:
//   - a pin case: its program, the whole file. A program is emitted whole
//     or not at all, so every pin of a program waits on every need of it.
//   - a test case: the test's body in its module under src/, found by its
//     registered name with TypeScript's parser (`ts-compiler`, as
//     scripts/analyze/ does). A string in the body is taken as an Allegro
//     text when it is the first string argument of a call whose callee is
//     named eval*, runtimeEval, g2parse, parse*, compile* or run*, or when
//     it holds a line break or `=>`, or when it names a `.alg` file, which
//     is read. A text counts only if the present parser reads it, except
//     for the first string of an eval call, whose parse failure is the
//     need "parse". A test with no text found, or whose assertion goes
//     through host code only, is classed "host" with the callees it uses,
//     so a reader can check the class.
// Nothing here guesses a need from a text by eye: every need below is the
// emitter's finding on the parse.

import * as fs from "fs";
import * as path from "path";
import ts from "ts-compiler";
import { emit, needInfo, type NeedId } from "./emit.js";
import { CASES_PATH, type Corpus, type PinCase, type TestCase } from "../tools/corpus.js";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");

/** A need of the census: one the emitter names, or "host" for a test that asserts through host code. */
export type CensusNeed = NeedId | "host";

export interface CaseNeeds {
  readonly id: string;
  readonly kind: "pin" | "test";
  /** The program, or the test's module. */
  readonly where: string;
  readonly texts: number;
  readonly needs: readonly CensusNeed[];
  /** For a host case: the callees its body uses. */
  readonly host?: string;
}

const EVAL_CALLEE = /^(eval\w*|runtimeEval|g2parse|parse\w*|compile\w*|run\w*)$/;

interface FoundText { readonly text: string; readonly fromEval: boolean }

function calleeName(e: ts.Expression): string | undefined {
  if (ts.isIdentifier(e)) return e.text;
  if (ts.isPropertyAccessExpression(e)) return e.name.text;
  return undefined;
}

function stringOf(e: ts.Node): string | undefined {
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return e.text;
  if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const a = stringOf(e.left);
    const b = stringOf(e.right);
    return a !== undefined && b !== undefined ? a + b : undefined;
  }
  return undefined;
}

/** The functions a module declares at its top level, by name: a test body's helpers. */
function helpers(src: ts.SourceFile): Map<string, ts.Node> {
  const out = new Map<string, ts.Node>();
  for (const s of src.statements) if (ts.isFunctionDeclaration(s) && s.name !== undefined && s.body !== undefined) out.set(s.name.text, s.body);
  return out;
}

/** The test bodies of a module, by registered name, in registration order (a second test of one name is `#2`). */
function testBodies(file: string): Map<string, ts.Node> {
  const src = ts.createSourceFile(file, fs.readFileSync(path.join(ROOT, file), "utf-8"), ts.ScriptTarget.ES2022, true);
  const out = new Map<string, ts.Node>();
  const visit = (n: ts.Node): void => {
    if (ts.isCallExpression(n)) {
      const c = calleeName(n.expression);
      const name = n.arguments[0] === undefined ? undefined : stringOf(n.arguments[0]);
      if ((c === "test" || c === "asyncTest") && name !== undefined && n.arguments[1] !== undefined) {
        let key = name;
        for (let i = 2; out.has(key); i++) key = `${name}#${i}`;
        out.set(key, n.arguments[1]);
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(src);
  helperBodies.set(file, helpers(src));
  return out;
}

/** The names the texts use and do not bind, with how many texts use each. */
export const unboundNames = new Map<string, number>();

const helperBodies = new Map<string, Map<string, ts.Node>>();

/** The Allegro texts of a test body, and the callees it uses. */
function textsOf(body: ts.Node, local: ReadonlyMap<string, ts.Node> = new Map()): { texts: FoundText[]; callees: Set<string> } {
  const texts: FoundText[] = [];
  const callees = new Set<string>();
  const taken = new Set<ts.Node>();
  const visit = (n: ts.Node): void => {
    if (ts.isCallExpression(n)) {
      const c = calleeName(n.expression);
      if (c !== undefined) callees.add(c);
      // A helper of the same module, followed one level: its texts are the test's.
      const helper = c === undefined ? undefined : local.get(c);
      if (helper !== undefined && helper !== body) {
        const inner = textsOf(helper);
        texts.push(...inner.texts);
      }
      if (c !== undefined && EVAL_CALLEE.test(c)) {
        const first = n.arguments.find((a) => stringOf(a) !== undefined);
        if (first !== undefined) {
          texts.push({ text: stringOf(first) as string, fromEval: true });
          taken.add(first);
        }
      }
    }
    const s = taken.has(n) ? undefined : stringOf(n);
    if (s !== undefined && !(ts.isBinaryExpression(n.parent) && stringOf(n.parent) !== undefined)) {
      if (/\.alg$/.test(s)) {
        const file = [path.join(ROOT, s), path.join(ROOT, "tests", path.basename(s))].find((f) => fs.existsSync(f));
        if (file !== undefined) texts.push({ text: fs.readFileSync(file, "utf-8"), fromEval: true });
      } else if (/\n|=>/.test(s)) texts.push({ text: s, fromEval: false });
    }
    ts.forEachChild(n, visit);
  };
  visit(body);
  return { texts, callees };
}

/** The needs of some texts: the emitter's findings, a text the parser does not read counting only when an eval call ran it. */
function needsOf(texts: readonly FoundText[]): { needs: Set<CensusNeed>; read: number } {
  const needs = new Set<CensusNeed>();
  const names = unboundNames;
  let read = 0;
  for (const t of texts) {
    const r = emit(t.text);
    const parseFailed = !r.ok && r.findings.length === 1 && r.findings[0].need === "parse" && r.forms.length === 0;
    if (parseFailed && !t.fromEval) continue;
    read++;
    if (!r.ok) for (const f of r.findings) {
      needs.add(f.need);
      if (f.need === "unbound") names.set(f.form.replace(/^the name /, ""), (names.get(f.form.replace(/^the name /, "")) ?? 0) + 1);
    }
  }
  return { needs, read };
}

/** The census: every case due at a milestone, with its needs. */
export function census(corpus: Corpus, milestone = 3): CaseNeeds[] {
  const due = corpus.cases.filter((c) => c.milestone === milestone && (c.class === "survives" || c.class === "changes"));
  const out: CaseNeeds[] = [];
  const programs = new Map<string, Set<CensusNeed>>();
  for (const c of due.filter((c): c is PinCase => c.kind === "pin")) {
    let needs = programs.get(c.file);
    if (needs === undefined) {
      needs = needsOf([{ text: fs.readFileSync(path.join(ROOT, c.file), "utf-8"), fromEval: true }]).needs;
      programs.set(c.file, needs);
    }
    out.push({ id: c.id, kind: "pin", where: c.file, texts: 1, needs: [...needs].sort() });
  }
  const bodies = new Map<string, Map<string, ts.Node>>();
  for (const c of due.filter((c): c is TestCase => c.kind === "test")) {
    let mod = bodies.get(c.module);
    if (mod === undefined) bodies.set(c.module, (mod = testBodies(c.module)));
    const name = c.id.slice(c.id.indexOf(":", 5) + 1);
    const body = mod.get(name) ?? mod.get(c.name);
    const file = /^file: (.+\.alg)$/.exec(c.name);
    if (body === undefined && file !== null && fs.existsSync(path.join(ROOT, "tests", file[1]))) {
      // Registered by src/test/alg-files.ts for each program of tests/, under the module that imports it.
      const needs = needsOf([{ text: fs.readFileSync(path.join(ROOT, "tests", file[1]), "utf-8"), fromEval: true }]).needs;
      out.push({ id: c.id, kind: "test", where: c.module, texts: 1, needs: [...needs].sort() });
      continue;
    }
    if (body === undefined) {
      out.push({ id: c.id, kind: "test", where: c.module, texts: 0, needs: ["host"], host: "the test's body was not found by its name" });
      continue;
    }
    const { texts, callees } = textsOf(body, helperBodies.get(c.module));
    const { needs, read } = needsOf(texts);
    const hostOnly = read === 0;
    if (hostOnly) needs.add("host");
    out.push({ id: c.id, kind: "test", where: c.module, texts: read, needs: [...needs].sort(), ...(hostOnly ? { host: [...callees].sort().join(", ") } : {}) });
  }
  return out;
}

export interface NeedRow { readonly need: CensusNeed; readonly pins: number; readonly tests: number }

/** One row per need: how many cases wait on it, most first. */
export function needRows(cases: readonly CaseNeeds[]): NeedRow[] {
  const rows = new Map<CensusNeed, { pins: number; tests: number }>();
  for (const c of cases)
    for (const n of c.needs) {
      const r = rows.get(n) ?? { pins: 0, tests: 0 };
      if (c.kind === "pin") r.pins++;
      else r.tests++;
      rows.set(n, r);
    }
  return [...rows.entries()].map(([need, r]) => ({ need, ...r })).sort((a, b) => b.pins + b.tests - (a.pins + a.tests) || String(a.need).localeCompare(String(b.need)));
}

function stateOf(n: CensusNeed): string {
  return n === "host" ? "host" : needInfo(n).state;
}
function titleOf(n: CensusNeed): string {
  return n === "host" ? "the test asserts through host code, with no Allegro text the parser reads" : needInfo(n).title;
}

/** Needs supplied cumulatively, in the order the kernel stream could supply them: what each step would let the emitter emit. */
export const STEPS: ReadonlyArray<readonly [string, readonly CensusNeed[]]> = (() => {
  const steps: [string, CensusNeed[]][] = [];
  const add = (label: string, more: CensusNeed[]) => steps.push([label, [...(steps.at(-1)?.[1] ?? []), ...more]]);
  add("integer arithmetic, comparison and decimal text (shipped)", ["int-arith", "int-compare", "int-to-text"]);
  add("and telling bits apart (kernel)", ["bits-equal"]);
  add("and joining texts, and the float primitives (shipped)", ["text-concat", "float-arith", "float-compare", "float-to-text"]);
  add("and reading a structure's entry (kernel)", ["structure-read"]);
  add("and a reader that keeps block bindings (bootstrap)", ["block-binding"]);
  return steps;
})();

function main(): void {
  const corpus = JSON.parse(fs.readFileSync(path.join(ROOT, CASES_PATH), "utf-8")) as Corpus;
  const cases = census(corpus);
  const pins = cases.filter((c) => c.kind === "pin");
  const tests = cases.filter((c) => c.kind === "test");
  const ready = (cs: readonly CaseNeeds[]) => cs.filter((c) => c.needs.length === 0).length;
  console.log(`census: milestone 3 · ${cases.length} cases (pins ${pins.length}, tests ${tests.length}) · every text emits today: pins ${ready(pins)}, tests ${ready(tests)}`);
  console.log("");
  console.log("| Need | State | Pins waiting | Tests waiting | Cases waiting |");
  console.log("|---|---|---|---|---|");
  for (const r of needRows(cases)) console.log(`| \`${r.need}\`: ${titleOf(r.need)} | ${stateOf(r.need)} | ${r.pins} | ${r.tests} | ${r.pins + r.tests} |`);
  console.log("");
  console.log("| Program or module | Cases | Every text emits today | Needs, with the cases waiting on each |");
  console.log("|---|---|---|---|");
  const byWhere = new Map<string, CaseNeeds[]>();
  for (const c of cases) byWhere.set(c.where, [...(byWhere.get(c.where) ?? []), c]);
  for (const [where, cs] of byWhere) {
    const rows = needRows(cs).map((r) => `\`${r.need}\` ${r.pins + r.tests}`).join(", ");
    console.log(`| \`${where}\` | ${cs.length} | ${ready(cs)} | ${rows === "" ? "none" : rows} |`);
  }
  console.log("");
  console.log(`Names used and not bound (texts): ${[...unboundNames.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([n, k]) => `\`${n}\` ${k}`).join(", ")}.`);
  console.log("");
  console.log("| If these were supplied | Pins then emitted | Tests then emitted |");
  console.log("|---|---|---|");
  for (const [label, set] of STEPS) {
    const ok = (cs: readonly CaseNeeds[]) => cs.filter((c) => c.needs.every((n) => set.includes(n))).length;
    console.log(`| ${label} | ${ok(pins)} of ${pins.length} | ${ok(tests)} of ${tests.length} |`);
  }
  if (process.argv.includes("--cases")) {
    console.log("");
    for (const c of cases) console.log(`${c.id} · texts ${c.texts} · ${c.needs.length === 0 ? "emitted" : c.needs.join(", ")}${c.host ? ` · host: ${c.host}` : ""}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) main();
