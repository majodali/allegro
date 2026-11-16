// The census of milestone 3 (B-196 (the rebuild's acceptance side), chunk
// Q5 (the first notation and the bootstrap), part 2): which of the
// corpus's milestone 3 cases read as Allegretto unchanged, and of those,
// which forms of next/ext/allegretto/forms.md they use and which wait on
// the kernel stream. It measures; it changes no case.
//
//   npx tsx next/bootstrap/census.ts            the tables, as Markdown
//   npx tsx next/bootstrap/census.ts --cases    and one line for each case
//
// forms.md §6, answer 5: milestone 3's programs become Allegretto texts
// written for the purpose, and a present-surface case that needs types
// moves to milestone 4. This census is the measure the orchestrating
// session moves cases by; next/corpus/cases.json is not changed here.
//
// For each case of next/corpus/cases.json whose `milestone` is 3 it finds
// the texts the case runs, and has the reader (next/bootstrap/reader.ts)
// and the emitter (next/bootstrap/emit.ts) take each. A case is:
//   - "host" where no text was found: its test asserts through host code;
//   - "does not read" where some text does not read as Allegretto, with
//     why: the forms of forms.md §5 the present parse of the text shows
//     (`presentTags` of next/bootstrap/allegretto-grammar.ts), or the
//     reader's refusal;
//   - "reads" where every text reads, with the forms they use, the items
//     of forms.md §4 those forms wait on, and the names nothing binds.
//
// Where the texts come from (carried over from part 1 of this chunk):
//   - a pin case: its program, the whole file;
//   - a test case: the test's body in its module under src/, found by its
//     registered name with TypeScript's parser (`ts-compiler`, as
//     scripts/analyze/ does). A string in the body is a text when it is
//     the first string argument of a call whose callee is named eval*,
//     runtimeEval, g2parse, parse*, compile* or run*, or when it holds a
//     line break or `=>` and the present base grammar parses it, or when it
//     names a `.alg` file, which is read. A helper of the same module
//     called from the body is followed one level.

import * as fs from "fs";
import * as path from "path";
import ts from "ts-compiler";
import { presentTags } from "./allegretto-grammar.js";
import { emit, FORMS, ITEMS, type FormId, type ItemNumber } from "./emit.js";
import { read, type Expr, type Item } from "./reader.js";
import { CASES_PATH, type Corpus, type PinCase, type TestCase } from "../tools/corpus.js";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");

/** Why a text does not read: a form of forms.md §5 its present parse shows, or the reader's refusal. */
const REMOVED_TAGS: Readonly<Record<string, string>> = {
  "type annotation": "a type annotation or typed parameter",
  lambda1_typed: "a type annotation or typed parameter",
  type_generic: "a type annotation or typed parameter",
  type_function: "a type annotation or typed parameter",
  type_structural: "a type annotation or typed parameter",
  generic_decl: "generics",
  when_expr: "`when` and patterns",
  theorem_decl: "`theorem` and `verify`",
  verify_stmt: "`theorem` and `verify`",
  grammar_expr: "the `grammar` block",
  grammar_expr_new: "the `grammar` block",
  grammar_expr_extends: "the `grammar` block",
  amp: "`&` on types",
  instanceof: "`instanceof` and `subtypeof`",
  subtypeof: "`instanceof` and `subtypeof`",
  of: "`Y of x`",
  of_error: "`Y of x`",
  error_expr: "`error`",
  none_lit: "`none`",
  string_interp: "text interpolation",
};

export type Status = "host" | "does not read" | "reads";

export interface CaseRead {
  readonly id: string;
  readonly kind: "pin" | "test";
  /** The program, or the test's module. */
  readonly where: string;
  readonly texts: number;
  readonly status: Status;
  /** For "does not read": why, one reason or more. */
  readonly reasons: readonly string[];
  /** For "reads": the forms its texts use. */
  readonly forms: readonly FormId[];
  /** For "reads": the items of forms.md §4 its waiting forms wait on; "unlisted" for a wait §4 does not list. */
  readonly items: ReadonlyArray<ItemNumber | "unlisted">;
  /** For "reads": the names its texts use and nothing binds. */
  readonly unbound: readonly string[];
  /** For "reads": every text is emitted today. */
  readonly emits: boolean;
  /**
   * For "reads": why the case still needs the standard language's types,
   * though its texts read (forms.md §6, answer 5). Empty: nothing seen.
   */
  readonly typed: readonly string[];
}

/** One text as the census takes it. */
interface Taken {
  readonly reads: boolean;
  readonly reasons: string[];
  readonly forms: FormId[];
  readonly items: Array<ItemNumber | "unlisted">;
  readonly unbound: string[];
  readonly emits: boolean;
  readonly typed: string[];
}

const ARITHMETIC = new Set(["+", "-", "*", "/", "%", "<", ">", "<=", ">="]);

/**
 * Where a text that reads means something else in Allegretto than in the
 * present tree, because the present meaning is chosen by a type. Only
 * what the text shows is counted: an operator of the integers applied to
 * a text or to a decimal fraction, and a method read off a literal. An
 * operand that is a name is not judged.
 */
function typedUses(items: readonly Item[]): string[] {
  const out = new Set<string>();
  const literal = (e: Expr): "text" | "float" | "int" | null => (e.k === "text" || e.k === "float" || e.k === "int" ? e.k : null);
  const expr = (e: Expr): void => {
    switch (e.k) {
      case "binary":
        if (ARITHMETIC.has(e.op))
          for (const side of [e.left, e.right]) {
            const l = literal(side);
            if (l === "text") out.add("an integer operator applied to a text");
            if (l === "float") out.add("an integer operator applied to a decimal fraction");
          }
        expr(e.left); expr(e.right);
        break;
      case "unary":
        if (e.op === "-" && literal(e.operand) === "float") out.add("an integer operator applied to a decimal fraction");
        expr(e.operand);
        break;
      case "dot":
        if (literal(e.object) !== null) out.add("a method read off a literal");
        expr(e.object);
        break;
      case "index": expr(e.object); expr(e.index); break;
      case "lambda": expr(e.body); break;
      case "apply": expr(e.fn); e.args.forEach(expr); break;
      case "pipe": expr(e.value); expr(e.fn); break;
      case "if": expr(e.condition); expr(e.then); expr(e.else); break;
      case "record": e.fields.forEach((f) => expr(f.value)); break;
      case "list": e.items.forEach(expr); break;
      case "block": block(e.items); break;
      default: break;
    }
  };
  const block = (its: readonly Item[]): void => {
    for (const i of its) {
      if (i.k === "statement") expr(i.expr);
      else if (i.k === "function") expr(i.body);
      else expr(i.value);
    }
  };
  block(items);
  return [...out];
}

/** Why a text does not read, from its present parse and the reader's findings. */
function reasonsOf(text: string, findings: readonly string[]): string[] {
  const out = new Set<string>();
  if (/^\s*use\s/m.test(text)) out.add("a `use` line: a grammar change");
  const tags = presentTags(text);
  if (tags !== undefined) for (const t of tags) if (t in REMOVED_TAGS) out.add(REMOVED_TAGS[t]);
  for (const f of findings) {
    if (/the keyword (and|or)/.test(f)) out.add("the keyword `and` or `or`");
    else if (/binary number/.test(f)) out.add("a binary number `0b…`");
    else if (/the escape/.test(f)) out.add("an escape forms.md §2 does not list");
    else if (/outside the signed 64-bit range/.test(f)) out.add("a whole number outside the signed 64-bit range");
    else if (/header line|export marks/.test(f)) out.add("a header line or `export` out of place");
  }
  if (out.size === 0) out.add(tags === undefined ? "the present parser does not read it either" : "another form the grammar refuses");
  return [...out].sort();
}

function take(text: string): Taken {
  const r = read(text);
  if (!r.ok) return { reads: false, reasons: reasonsOf(text, r.findings.map((f) => f.message)), forms: [], items: [], unbound: [], emits: false, typed: [] };
  const e = emit(text);
  const items = new Set<ItemNumber | "unlisted">();
  const unbound = new Set<string>();
  if (!e.ok)
    for (const f of e.findings) {
      if (f.kind === "waits") {
        if ((f.items ?? []).length === 0) items.add("unlisted");
        for (const i of f.items ?? []) items.add(i);
      } else if (f.kind === "unbound") unbound.add(f.message.replace(/^the name (\S+) .*$/, "$1"));
    }
  const typed = typedUses(r.module.items);
  // `print` is the present tree's: it renders its argument by its type.
  if (unbound.has("print")) typed.push("`print`, which renders a value by its type");
  return { reads: true, reasons: [], forms: [...e.forms], items: [...items], unbound: [...unbound], emits: e.ok, typed };
}

// ── Finding the texts of a test (carried over from part 1) ─────────────

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

const helperBodies = new Map<string, Map<string, ts.Node>>();

/** The test bodies of a module, by registered name, in registration order (a second test of one name is `#2`). */
function testBodies(file: string): Map<string, ts.Node> {
  const src = ts.createSourceFile(file, fs.readFileSync(path.join(ROOT, file), "utf-8"), ts.ScriptTarget.ES2022, true);
  const out = new Map<string, ts.Node>();
  const helpers = new Map<string, ts.Node>();
  for (const s of src.statements) if (ts.isFunctionDeclaration(s) && s.name !== undefined && s.body !== undefined) helpers.set(s.name.text, s.body);
  helperBodies.set(file, helpers);
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
  return out;
}

/** The texts of a test body. */
function textsOf(body: ts.Node, local: ReadonlyMap<string, ts.Node>, depth = 0): FoundText[] {
  const texts: FoundText[] = [];
  const taken = new Set<ts.Node>();
  const visit = (n: ts.Node): void => {
    if (ts.isCallExpression(n)) {
      const c = calleeName(n.expression);
      const helper = c === undefined ? undefined : local.get(c);
      if (helper !== undefined && helper !== body && depth === 0) texts.push(...textsOf(helper, local, depth + 1));
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
      } else if (/\n|=>/.test(s) && presentTags(s) !== undefined) texts.push({ text: s, fromEval: false });
    }
    ts.forEachChild(n, visit);
  };
  visit(body);
  return texts;
}

// ── The census ─────────────────────────────────────────────────────────

function combine(c: { id: string; kind: "pin" | "test"; where: string }, texts: readonly string[]): CaseRead {
  if (texts.length === 0) return { ...c, texts: 0, status: "host", reasons: [], forms: [], items: [], unbound: [], emits: false, typed: [] };
  const all = texts.map(take);
  const sorted = <T>(xs: Iterable<T>): T[] => [...new Set(xs)].sort((a, b) => String(a).localeCompare(String(b)));
  if (all.some((t) => !t.reads))
    return { ...c, texts: texts.length, status: "does not read", reasons: sorted(all.flatMap((t) => t.reasons)), forms: [], items: [], unbound: [], emits: false, typed: [] };
  return {
    ...c, texts: texts.length, status: "reads", reasons: [],
    forms: sorted(all.flatMap((t) => t.forms)), items: sorted(all.flatMap((t) => t.items)), unbound: sorted(all.flatMap((t) => t.unbound)),
    emits: all.every((t) => t.emits),
    typed: sorted(all.flatMap((t) => t.typed)),
  };
}

/** A case that tests the present parser's refusal of a text: it is no program of either language. */
const REFUSAL_ONLY = "the present parser does not read it either";

/**
 * The cases that move to milestone 4 (forms.md §6, answer 5): a
 * present-surface case that needs types. Counted: a case with a text
 * that does not read as Allegretto, since the forms it lacks are the
 * standard language's; and a case whose texts read and show a meaning
 * chosen by a type (`typed`). A case with no text, and a case that only
 * tests a refusal of the present parser, stay.
 */
export function movesToMilestone4(cases: readonly CaseRead[]): Array<{ id: string; why: string }> {
  const out: Array<{ id: string; why: string }> = [];
  for (const c of cases) {
    if (c.status === "does not read" && !(c.reasons.length === 1 && c.reasons[0] === REFUSAL_ONLY)) out.push({ id: c.id, why: `does not read as Allegretto: ${c.reasons.join("; ")}` });
    else if (c.status === "reads" && c.typed.length > 0) out.push({ id: c.id, why: `reads, and needs a type: ${c.typed.join("; ")}` });
  }
  return out;
}

/** The census: every case of the milestone, each read. */
export function census(corpus: Corpus, milestone = 3): CaseRead[] {
  const due = corpus.cases.filter((c) => c.milestone === milestone);
  const out: CaseRead[] = [];
  const programs = new Map<string, string>();
  const programText = (file: string): string => {
    let t = programs.get(file);
    if (t === undefined) programs.set(file, (t = fs.readFileSync(path.join(ROOT, file), "utf-8")));
    return t;
  };
  const bodies = new Map<string, Map<string, ts.Node>>();
  for (const c of due) {
    if (c.kind === "pin") {
      const p = c as PinCase;
      out.push(combine({ id: p.id, kind: "pin", where: p.file }, [programText(p.file)]));
      continue;
    }
    const t = c as TestCase;
    let mod = bodies.get(t.module);
    if (mod === undefined) bodies.set(t.module, (mod = testBodies(t.module)));
    const name = t.id.slice(t.id.indexOf(":", 5) + 1);
    const body = mod.get(name) ?? mod.get(t.name);
    const file = /^file: (.+\.alg)$/.exec(t.name);
    if (body === undefined && file !== null && fs.existsSync(path.join(ROOT, "tests", file[1]))) {
      out.push(combine({ id: t.id, kind: "test", where: t.module }, [programText(`tests/${file[1]}`)]));
      continue;
    }
    const texts = body === undefined ? [] : textsOf(body, helperBodies.get(t.module) ?? new Map()).map((x) => x.text);
    out.push(combine({ id: t.id, kind: "test", where: t.module }, texts));
  }
  return out;
}

const count = (cases: readonly CaseRead[], p: (c: CaseRead) => boolean): string => {
  const pins = cases.filter((c) => c.kind === "pin" && p(c)).length;
  const tests = cases.filter((c) => c.kind === "test" && p(c)).length;
  return `${pins + tests} (${pins} pins, ${tests} tests)`;
};

/** The census as Markdown lines. */
export function report(cases: readonly CaseRead[]): string[] {
  const lines: string[] = [];
  const reads = cases.filter((c) => c.status === "reads");
  lines.push(`census: milestone 3 · ${count(cases, () => true)} · host ${count(cases, (c) => c.status === "host")} · ` +
    `does not read ${count(cases, (c) => c.status === "does not read")} · reads ${count(cases, (c) => c.status === "reads")}, ` +
    `of which emit today ${count(cases, (c) => c.status === "reads" && c.emits)}`);
  lines.push("", "| Program or module | Cases | Host | Does not read | Reads | Emit today |", "|---|---|---|---|---|---|");
  const byWhere = new Map<string, CaseRead[]>();
  for (const c of cases) byWhere.set(c.where, [...(byWhere.get(c.where) ?? []), c]);
  for (const [where, cs] of byWhere) {
    const n = (s: Status) => cs.filter((c) => c.status === s).length;
    lines.push(`| \`${where}\` | ${cs.length} | ${n("host")} | ${n("does not read")} | ${n("reads")} | ${cs.filter((c) => c.status === "reads" && c.emits).length} |`);
  }
  const reasons = new Map<string, number>();
  for (const c of cases) for (const r of c.reasons) reasons.set(r, (reasons.get(r) ?? 0) + 1);
  lines.push("", "| Why a case does not read (a case may have several reasons) | Cases |", "|---|---|");
  for (const [r, n] of [...reasons].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) lines.push(`| ${r} | ${n} |`);
  lines.push("", "| Form, in the cases that read | Cases using it | Waits on |", "|---|---|---|");
  const forms = new Map<FormId, number>();
  for (const c of reads) for (const f of c.forms) forms.set(f, (forms.get(f) ?? 0) + 1);
  for (const [f, n] of [...forms].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
    const w = FORMS[f].waits;
    lines.push(`| \`${f.replace(/\|/g, "\\|")}\` | ${n} | ${w === null ? "nothing forms.md §4 lists" : w.length === 0 ? "nothing: emitted today" : w.map((i) => `item ${i}`).join(", ")} |`);
  }
  lines.push("", "| Item of forms.md §4, in the cases that read | Cases waiting on it |", "|---|---|");
  for (const i of [1, 2, 3, 4, 5, "unlisted"] as const) {
    const n = reads.filter((c) => c.items.includes(i)).length;
    lines.push(`| ${i === "unlisted" ? "none listed (the symbol literal)" : `${i}: ${ITEMS[i]}`} | ${n} |`);
  }
  const unbound = new Map<string, number>();
  for (const c of reads) for (const u of c.unbound) unbound.set(u, (unbound.get(u) ?? 0) + 1);
  const typed = new Map<string, number>();
  for (const c of reads) for (const t of c.typed) typed.set(t, (typed.get(t) ?? 0) + 1);
  if (typed.size > 0) {
    lines.push("", "| Why a case that reads still needs a type (a case may have several) | Cases |", "|---|---|");
    for (const [t, n] of [...typed].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) lines.push(`| ${t} | ${n} |`);
  }
  const moves = movesToMilestone4(cases);
  lines.push("", `Cases that need types and belong to milestone 4: ${moves.length} (${moves.filter((m) => m.id.startsWith("pin:")).length} pins, ${moves.filter((m) => !m.id.startsWith("pin:")).length} tests).`);
  lines.push("", `Names used and bound nowhere, in the cases that read: ${[...unbound].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([n, k]) => `\`${n}\` ${k}`).join(", ") || "none"}.`);
  return lines;
}

function main(): void {
  const corpus = JSON.parse(fs.readFileSync(path.join(ROOT, CASES_PATH), "utf-8")) as Corpus;
  const cases = census(corpus);
  for (const l of report(cases)) console.log(l);
  if (process.argv.includes("--moves")) {
    console.log("");
    console.log(JSON.stringify(movesToMilestone4(cases), null, 1));
  }
  if (process.argv.includes("--cases")) {
    console.log("");
    for (const c of cases) {
      const detail = c.status === "does not read" ? c.reasons.join("; ")
        : c.status === "reads" ? `${c.emits ? "emits today" : `waits: ${c.items.join(", ") || "none"}`}${c.unbound.length > 0 ? ` · unbound: ${c.unbound.join(", ")}` : ""} · forms: ${c.forms.join(", ")}`
        : "";
      console.log(`${c.id} · ${c.status} · texts ${c.texts}${detail === "" ? "" : ` · ${detail}`}`);
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) main();
