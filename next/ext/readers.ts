// The two readers of Allegretto, compared.
//
// Whose: the kernel stream (lane R). Chunk E7 of docs/plans/book-pass.md
// section 10: "both readers agree on every program of the corpus". One
// reader is the bootstrap (next/bootstrap/reader.ts, the acceptance
// stream's, called here and not changed). The other is the engine written
// in Allegretto with Allegretto's grammar (next/ext/lib/allegretto.alg).
//
// Each reader's tree of a text is written as one text, in one form
// (`shown` of allegretto.alg), and the two texts are compared. A place is
// written with its offsets in bytes, so the bootstrap's offsets, which
// count the units of a host string, are counted again here.
//
//   npx tsx next/ext/readers.ts            every .alg under next/
//   npx tsx next/ext/readers.ts <part>     those whose path holds <part>

import * as fs from "node:fs";
import * as path from "node:path";
import { read, type Expr, type Field, type Header, type Item, type Name, type Place } from "../bootstrap/reader.js";
import { emitted } from "../corpus/allegretto.js";
import { launch } from "../launch/launcher.js";
import { output } from "../launch/output.js";
import { createKernel } from "../kernel/create.js";
import { shipped } from "../prims/index.js";

/** A float as the shipped primitive `float.text` writes it. */
const floatText = (x: number): string => (Number.isNaN(x) ? "nan" : x === Infinity ? "inf" : x === -Infinity ? "-inf" : Object.is(x, -0) ? "-0" : String(x));

/** The bootstrap's tree of a text, as `shown` of allegretto.alg writes a tree; or why the bootstrap refuses the text. */
export function bootstrapTree(text: string): { tree: string } | { refused: string } {
  const r = read(text);
  if (!r.ok) return { refused: r.findings.map((f) => f.message).join("; ") };
  const source = r.module.text;
  const encoder = new TextEncoder();
  const bytes = (to: number): number => encoder.encode(source.slice(0, to)).length;
  const P = (a: Place): string => `@${bytes(a.start)}-${bytes(a.end)}:${a.line}:${encoder.encode(source.slice(source.lastIndexOf("\n", a.start - 1) + 1, a.start)).length + 1}`;
  const N = (n: Name): string => `${n.name}${P(n.at)}`;
  const hex = (b: Uint8Array): string => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  const E = (x: Expr): string => `(${x.k} ${parts(x)} ${P(x.at)})`;
  const F = (f: Field): string => (f.k === "named" ? `(named ${N(f.name)} ${E(f.value)})` : `(computed ${E(f.key)} ${E(f.value)} ${P(f.at)})`);
  const parts = (x: Expr): string => {
    switch (x.k) {
      case "text":
        return hex(x.bytes);
      case "int":
        return String(x.value);
      case "float":
        return floatText(x.value);
      case "truth":
        return String(x.value);
      case "symbol":
      case "name":
        return x.name;
      case "lambda":
        return `(${x.params.map(N).join(" ")}) ${E(x.body)}`;
      case "apply":
        return `${E(x.fn)} (${x.args.map(E).join(" ")})`;
      case "pipe":
        return `${E(x.value)} ${E(x.fn)}`;
      case "dot":
        return `${E(x.object)} ${N(x.name)}`;
      case "index":
        return `${E(x.object)} ${E(x.index)}`;
      case "if":
        return `${E(x.condition)} ${E(x.then)} ${E(x.else)}`;
      case "binary":
        return `${x.op} ${E(x.left)} ${E(x.right)}`;
      case "unary":
        return `${x.op} ${E(x.operand)}`;
      case "record":
        return `(${x.fields.map(F).join(" ")})`;
      case "list":
        return `(${x.items.map(E).join(" ")})`;
      case "block":
        return `${x.sync} (${x.items.map(I).join(" ")})`;
    }
  };
  const I = (i: Item): string => {
    switch (i.k) {
      case "binding":
        return `(binding ${N(i.name)} ${i.exported} ${E(i.value)} ${P(i.at)})`;
      case "function":
        return `(function ${N(i.name)} (${i.params.map(N).join(" ")}) ${i.exported} ${E(i.body)} ${P(i.at)})`;
      case "arrow":
        return `(arrow ${N(i.name)} ${E(i.value)} ${P(i.at)})`;
      case "statement":
        return `(statement ${E(i.expr)} ${P(i.at)})`;
    }
  };
  const H = (h: Header): string => `(${h.k} ${N(h.name)} (${h.with.map((p) => `(${N(p.name)} ${E(p.value)})`).join(" ")}) (${h.without.map(N).join(" ")}) ${P(h.at)})`;
  return { tree: `(module (${r.module.headers.map(H).join(" ")}) (${r.module.items.map(I).join(" ")}))` };
}

/**
 * A program that reads each text of its input `sources` with the engine
 * and Allegretto's grammar, and prints a line for each: the tree, or
 * where no reading went on, or that there are two. The grammar is
 * prepared once for all the texts, and one kernel reads them all: a
 * launch for each text spent a fifth of the time on starting.
 */
const READER = [
  "capability output",
  "input sources",
  "import allegretto",
  "import engine",
  "p = engine.prepared(allegretto.language)",
  'shown_or(a) => if is_failure(a) then "no reading at " ++ int.text(a.at) else if count(a.readings.t) > 0 then "two readings" else allegretto.shown(a.readings.h)',
  "each(i) => if i == count(sources) then 0 else then(output.write(shown_or(engine.parses(p, sources[i]))), each(i + 1))",
  "each(0)",
  "",
].join("\n");

let reader: ReturnType<typeof emitted> | undefined;

/** What the engine gives for one text: its tree as one text, or where no reading went on. */
export type EngineTree = { tree: string } | { refused: string };

/** The engine's tree of each text, in order, with the steps all of them took. */
export async function engineTrees(texts: readonly string[]): Promise<{ trees: EngineTree[]; steps: number }> {
  reader ??= emitted(READER, "next/ext/lib/reader.alg");
  if ("findings" in reader) throw new Error(`the reader's own text is refused: ${reader.findings.join("; ")}`);
  const encoder = new TextEncoder();
  const sources = { entries: texts.map((t) => [null, { bits: encoder.encode(t.replace(/\r\n/g, "\n")) }] as const) };
  const outcome = await launch({
    createKernel,
    program: reader.program,
    imports: reader.imports,
    configuration: { ceiling: ["output"], steps: 2_000_000_000, inputs: { sources } },
    target: { capabilities: [output], primitives: shipped },
  });
  const steps = "steps" in outcome.end ? outcome.end.steps : 0;
  // A reading that ends early gives fewer lines than texts: the rest are told so.
  const trees = texts.map((_, i): EngineTree => {
    const line = outcome.lines[i];
    if (line === undefined) return { refused: `the reading ended ${outcome.end.kind} before this text` };
    return line.startsWith("(module") ? { tree: line } : { refused: line };
  });
  return { trees, steps };
}

/** The engine's tree of one text. */
export async function engineTree(text: string): Promise<EngineTree & { steps: number }> {
  const r = await engineTrees([text]);
  return { ...r.trees[0], steps: r.steps };
}

/** How the two readers compare on a text. */
export type Compared = { same: true; refused: boolean } | { same: false; bootstrap: string; engine: string };

function comparedWith(text: string, e: EngineTree): Compared {
  const b = bootstrapTree(text);
  if ("refused" in b && "refused" in e) return { same: true, refused: true };
  if ("tree" in b && "tree" in e && b.tree === e.tree) return { same: true, refused: false };
  return { same: false, bootstrap: "tree" in b ? b.tree : `refused: ${b.refused}`, engine: "tree" in e ? e.tree : `refused: ${e.refused}` };
}

/** How the two readers compare on each text, in order, the engine reading them all in one launch. */
export async function comparedAll(texts: readonly string[]): Promise<{ each: Compared[]; steps: number }> {
  const r = await engineTrees(texts);
  return { each: texts.map((t, i) => comparedWith(t, r.trees[i])), steps: r.steps };
}

export async function compared(text: string): Promise<Compared> {
  return (await comparedAll([text])).each[0];
}

/** Every `.alg` under a directory, in name order. */
export function texts(dir: string): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((d) => (d.isDirectory() ? texts(path.join(dir, d.name)) : d.name.endsWith(".alg") ? [path.join(dir, d.name)] : []))
    .sort();
}

/** Where two texts first differ, with what is around it. */
export function firstDifference(a: string, b: string): string {
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  return `at ${i}: ${a.slice(Math.max(0, i - 40), i + 80)} | ${b.slice(Math.max(0, i - 40), i + 80)}`;
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === path.resolve("next/ext/readers.ts")) {
  const part = process.argv[2];
  const files = texts("next").filter((f) => part === undefined || f.includes(part));
  const began = Date.now();
  const all = await comparedAll(files.map((f) => fs.readFileSync(f, "utf8")));
  let [same, refused, differ] = [0, 0, 0];
  all.each.forEach((c, i) => {
    if (!c.same) {
      differ++;
      console.log(`${files[i]}: ${firstDifference(c.bootstrap, c.engine)}`);
    } else if (c.refused) refused++;
    else same++;
  });
  console.log(`readers: ${files.length} text(s) · the same tree ${same} · refused by both ${refused} · different ${differ} · ${all.steps} steps · ${Math.round((Date.now() - began) / 1000)} s`);
  if (differ > 0) process.exit(1);
}
