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

/** A program that reads its input `source` with the engine and Allegretto's grammar, and prints the tree, or where no reading went on, or that there are two. */
const READER = [
  "capability output",
  "input source",
  "import allegretto",
  "import engine",
  'shown_or(a) => if is_failure(a) then "no reading at " ++ int.text(a.at) else if count(a.readings.t) > 0 then "two readings" else allegretto.shown(a.readings.h)',
  "output.write(shown_or(engine.parses(engine.prepared(allegretto.language), source)))",
  "",
].join("\n");

let reader: ReturnType<typeof emitted> | undefined;

/** The engine's tree of a text, as one text; or where no reading went on; with the steps it took. */
export async function engineTree(text: string): Promise<{ tree: string; steps: number } | { refused: string; steps: number }> {
  reader ??= emitted(READER, "next/ext/lib/reader.alg");
  if ("findings" in reader) throw new Error(`the reader's own text is refused: ${reader.findings.join("; ")}`);
  const outcome = await launch({
    createKernel,
    program: reader.program,
    imports: reader.imports,
    configuration: { ceiling: ["output"], steps: 300_000_000, inputs: { source: { bits: new TextEncoder().encode(text.replace(/\r\n/g, "\n")) } } },
    target: { capabilities: [output], primitives: shipped },
  });
  const steps = "steps" in outcome.end ? outcome.end.steps : 0;
  const line = outcome.lines[0];
  if (outcome.end.kind !== "completed" || line === undefined) return { refused: `the reading ended ${outcome.end.kind}`, steps };
  return line.startsWith("(module") ? { tree: line, steps } : { refused: line, steps };
}

/** How the two readers compare on a text. */
export type Compared = { same: true; refused: boolean; steps: number } | { same: false; bootstrap: string; engine: string; steps: number };

export async function compared(text: string): Promise<Compared> {
  const [b, e] = [bootstrapTree(text), await engineTree(text)];
  if ("refused" in b && "refused" in e) return { same: true, refused: true, steps: e.steps };
  if ("tree" in b && "tree" in e && b.tree === e.tree) return { same: true, refused: false, steps: e.steps };
  return { same: false, bootstrap: "tree" in b ? b.tree : `refused: ${b.refused}`, engine: "tree" in e ? e.tree : `refused: ${e.refused}`, steps: e.steps };
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
  let [same, refused, differ, steps] = [0, 0, 0, 0];
  for (const file of files) {
    const c = await compared(fs.readFileSync(file, "utf8"));
    steps += c.steps;
    if (!c.same) {
      differ++;
      console.log(`${file}: ${firstDifference(c.bootstrap, c.engine)}`);
    } else if (c.refused) refused++;
    else same++;
  }
  console.log(`readers: ${files.length} text(s) · the same tree ${same} · refused by both ${refused} · different ${differ} · ${steps} steps`);
  if (differ > 0) process.exit(1);
}
