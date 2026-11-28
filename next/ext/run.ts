// Running a text of Allegretto loaded by the loader written in Allegretto.
//
// Whose: the kernel stream (lane R). Chunks E8 and E9 of
// docs/plans/book-pass.md section 10. The acceptance stream's runner
// (next/corpus/allegretto.ts) reads a text with the bootstrap, which
// refuses `use`, and loads through the bootstrap's driver. This one
// hands a text's name to the loader (next/ext/lib/loader.alg), which
// reads through the capability `files`, has the engine read each text in
// turns with its grammar, and makes each module through the capability
// `modules`. The module it gives is then applied.
//
// What this file does is what a launcher does for the loader, and no
// more: it makes a kernel, makes the two capabilities for it
// (next/ext/capabilities.ts), hands the loader the platform's modules
// already made, and applies what the loader gives. The platform's
// modules are the texts of next/ext/lib/ that the loader itself is
// written with; they, and the loader, are made here from the
// bootstrap's records until chunk E10 ships them built.
//
// Only what a test of these chunks needs is here: the capability
// `output`, inputs handed at the start, and a run that ends when its
// evaluation does. Phases, waiting and reports are the launcher's.

import { drive, type ReadText } from "../bootstrap/driver.js";
import { FAILURE_FUNCTIONS, KERNEL_NAMES, SHIPPED_NAMES, STREAM_FUNCTIONS } from "../bootstrap/emit.js";
import { readUnder } from "../corpus/allegretto.js";
import { plainValue, type Plain } from "../launch/launcher.js";
import { outputWrite } from "../launch/output.js";
import { createKernel } from "../kernel/create.js";
import type { Declaration, Kernel, Value } from "../kernel/interface.js";
import { encode, load, type SavedProgram } from "../kernel/saved-program.js";
import { shippedByName } from "../prims/index.js";
import { filesRead, modulesParts } from "./capabilities.js";

/** The module that stands between this file and the loader: it holds the two capabilities and hands them on. */
const HOST = [
  "capability files",
  "capability modules",
  "import loader",
  "export load(file, platform, shipped, own, names) => loader.load(file, {platform: platform, shipped: shipped, own: own, names: names})",
  'export failed(r) => if is_failure(r) then lines(r.findings, 0) else ""',
  'lines(f, i) => if i == count(f) then "" else "\\n" ++ f[i].file ++ ": " ++ f[i].message ++ lines(f, i + 1)',
  "export module_of(r) => r.module",
  "export identity_of(r) => r.identity",
  'export declared(r) => each(r.declares, 0)',
  'each(d, i) => if i == count(d) then "" else "\\n" ++ d[i].role ++ " " ++ d[i].name ++ each(d, i + 1)',
  "",
].join("\n");

/** What a run gave: the lines written, or why there was no run; and how the evaluation ended. */
export interface Ran {
  /** The lines written through `output`. */
  readonly lines: string[];
  /** Why the text was not loaded, each with the file it is of; none where the text ran. */
  readonly findings: string[];
  /** The reason, where the evaluation ended refuted. */
  readonly refuted?: string;
  /** The identity of the module the text is, where it was loaded. */
  readonly identity?: string;
  /** The steps of loading and of the run together. */
  readonly steps: number;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const text = (t: string): Plain => ({ bits: encoder.encode(t) });
const record = (o: Record<string, Plain>): Plain => ({ entries: Object.entries(o).map(([key, v]) => [{ symbol: key }, v] as const) });
const list = (xs: readonly Plain[]): Plain => ({ entries: xs.map((x) => [null, x] as const) });

interface Loader {
  readonly k: Kernel;
  readonly call: (name: string, ...args: Value[]) => { value: Value; refuted?: string };
  /** The texts the capability `files` reads, set for each run. */
  reads: ReadText;
  readonly platform: Value;
  readonly shipped: Value;
  readonly own: Value;
  readonly names: Value;
  readonly steps: () => number;
}

/** A kernel holding the loader, with its two capabilities and the platform's modules as the bootstrap gave them. */
function loader(): Loader {
  const driven = drive(HOST, "next/ext/lib/host.alg", readUnder(process.cwd()));
  if (!driven.ok) throw new Error(`the host module's own text is refused: ${driven.findings.map((f) => f.message).join("; ")}`);
  const k = createKernel();
  const prims = new Map([...shippedByName.values()].map((p) => [p.hash, k.primitiveFunction(p)] as const));
  const platform: Value[] = [];
  let host: Value | undefined;
  driven.records.forEach((r, i) => {
    const program = JSON.parse(encode(r.program)) as SavedProgram;
    const value = load(k, program, prims);
    if (i === driven.records.length - 1) host = value;
    else
      platform.push(
        k.structure([
          [k.symbol("name"), k.bits(encoder.encode(r.file.split("/").pop()!.replace(/\.alg$/, "")))],
          [k.symbol("module"), value],
          [k.symbol("identity"), k.bits(encoder.encode(r.identity))],
          [k.symbol("declares"), plainValue(k, list(program.declares.filter((d) => d.role !== "module").map((d) => record({ role: text(d.role), name: text(d.name) }))))],
        ]),
      );
  });
  const self: { reads: ReadText } = { reads: () => undefined };
  const part = (name: string, declarations: readonly Parameters<Kernel["primitiveFunction"]>[0][]): Value =>
    k.structure(declarations.map((d) => [k.symbol((d as { part: string }).part), k.primitiveFunction(d)] as const));
  const files = part("files", [filesRead((file) => self.reads(file))]);
  const modules = part("modules", modulesParts(k));
  const made = k.evaluate(k.expression(host!, [files, modules]), { steps: 10_000_000 });
  let steps = 0;
  const entry = (name: string): Value => {
    const found = k.entriesOf(k.current(made.value)).find(([key]) => key !== null && k.symbolName(key) === name);
    if (found === undefined) throw new Error(`the host module yields no ${name}`);
    return found[1];
  };
  const call = (name: string, ...args: Value[]): { value: Value; refuted?: string } => {
    const r = k.evaluate(k.expression(entry(name), args), { steps: 2_000_000_000 });
    steps += r.steps;
    return r.refuted ? { value: r.value, refuted: k.reasonOf(r.value) ?? "refused" } : { value: r.value };
  };
  return {
    k,
    call,
    get reads() {
      return self.reads;
    },
    set reads(r: ReadText) {
      self.reads = r;
    },
    platform: k.structure(platform.map((p) => [null, p] as const)),
    shipped: plainValue(k, list(SHIPPED_NAMES.filter((n) => shippedByName.has(n)).map((n) => record({ name: text(n), hash: text(shippedByName.get(n)!.hash) })))),
    own: k.bits(encoder.encode(`${FAILURE_FUNCTIONS}\n${STREAM_FUNCTIONS}`)),
    names: plainValue(k, list(KERNEL_NAMES.map(text))),
    steps: () => steps,
  };
}

let shared: Loader | undefined;

/** Loads the text of a file through `readText` and runs it. `inputs` are handed at the start. */
export function runFile(file: string, readText: ReadText, inputs: Readonly<Record<string, Plain>> = {}): Ran {
  // One kernel loads for every run: starting it is most of the time of a short one.
  const l = (shared ??= loader());
  const { k, call } = l;
  const before = l.steps();
  const steps = (): number => l.steps() - before;
  const said = (v: Value): string => decoder.decode(k.bitsOf(k.current(v)).bytes);
  l.reads = readText;
  const lines: string[] = [];
  const loaded = call("load", k.bits(encoder.encode(file)), l.platform, l.shipped, l.own, l.names);
  if (loaded.refuted !== undefined) return { lines, findings: [`${file}: ${loaded.refuted}`], steps: steps() };
  const unloaded = said(call("failed", loaded.value).value);
  if (unloaded !== "") return { lines, findings: unloaded.slice(1).split("\n"), steps: steps() };
  const identity = said(call("identity_of", loaded.value).value);
  const declares = said(call("declared", loaded.value).value).split("\n").slice(1).map((d): Declaration => ({ role: d.split(" ")[0], name: d.split(" ")[1] }) as Declaration);
  const output = k.structure([[k.symbol("write"), k.primitiveFunction(outputWrite((line) => lines.push(line)))]]);
  const args: Value[] = [];
  for (const d of declares) {
    if (d.role === "capability" && d.name === "output") args.push(output);
    else if (d.role === "input" && Object.hasOwn(inputs, d.name)) args.push(plainValue(k, inputs[d.name]));
    else return { lines, findings: [`${file}: this runner hands no ${d.role} ${d.name}`], identity, steps: steps() };
  }
  const ran = k.evaluate(k.expression(call("module_of", loaded.value).value, args), { steps: 100_000_000 });
  return { lines, findings: [], identity, steps: steps() + ran.steps, ...(ran.refuted ? { refuted: k.reasonOf(ran.value) ?? "refuted" } : {}) };
}

/**
 * Runs the text called `main` among `texts`, each the text of the file
 * `name.alg` in one directory. `inputs` are handed at the start.
 */
export function runTexts(main: string, texts: Readonly<Record<string, string>>, inputs: Readonly<Record<string, Plain>> = {}): Ran {
  return runFile(`${main}.alg`, (file) => (file.endsWith(".alg") && Object.hasOwn(texts, file.slice(0, -4)) ? texts[file.slice(0, -4)] : undefined), inputs);
}
