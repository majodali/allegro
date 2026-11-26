// Running a text of Allegretto read by the engine written in Allegretto.
//
// Whose: the kernel stream (lane R). Chunk E8 of docs/plans/book-pass.md
// section 10. The acceptance stream's runner (next/corpus/allegretto.ts)
// reads a text with the bootstrap, which refuses `use`. This one reads
// with the engine in turns with the grammar (next/ext/lib/reader.alg),
// has the meaning rules write each module's function
// (next/ext/lib/meaning.alg), and has the kernel build and run it.
//
// It stands in for the loader until chunk E9: the texts are handed by
// name, and a module a text needs is emitted before it. A module of the
// engine's own that a text imports (grammar, change, levels and the
// rest) is not read again: it is the module the bootstrap gave, which
// next/ext/modules.ts shows to be the same module by identity.
//
// Only what a test of this chunk needs is here: the capability `output`,
// inputs handed at the start, and a run that ends when its evaluation
// does. Phases, waiting and reports are the launcher's.

import { drive } from "../bootstrap/driver.js";
import { FAILURE_FUNCTIONS, SHIPPED_NAMES, STREAM_FUNCTIONS } from "../bootstrap/emit.js";
import { readUnder } from "../corpus/allegretto.js";
import { plainValue, type Plain } from "../launch/launcher.js";
import { outputWrite } from "../launch/output.js";
import { createKernel } from "../kernel/create.js";
import type { Declaration, Kernel, Value } from "../kernel/interface.js";
import { encode, load, type SavedProgram } from "../kernel/saved-program.js";
import { shippedByName } from "../prims/index.js";

/** The module that stands between this file and the Allegretto modules. */
const HOST = [
  "import meaning",
  "import reader",
  "export read(text, name, texts, shipped, own) => reader.read(text, name, {texts: texts, shipped: shipped, own: own})",
  'export failed(t) => if is_failure(t) then lines(t.findings, 0) else ""',
  'export needed(tree) => names(meaning.needed(tree), 0)',
  'names(l, i) => if i == count(l) then "" else "\\n" ++ l[i] ++ names(l, i + 1)',
  "export module_from(tree, shipped, modules, own) => meaning.module_of(tree, {shipped: shipped, modules: modules, own: own})",
  "export description(m) => m.description",
  'export summary(m) => if is_failure(m) then "refused" ++ lines(m.findings, 0) else "keys " ++ int.text(m.keys) ++ declared(m.declares, 0)',
  'lines(f, i) => if i == count(f) then "" else "\\n" ++ f[i].message ++ lines(f, i + 1)',
  'declared(d, i) => if i == count(d) then "" else "\\n" ++ d[i].role ++ " " ++ d[i].name ++ (if count(d[i]) == 3 then " " ++ d[i].identity else "") ++ declared(d, i + 1)',
  "",
].join("\n");

/** What a run gave: the lines written, or why there was no run; and how the evaluation ended. */
export interface Ran {
  /** The lines written through `output`. */
  readonly lines: string[];
  /** Why a text was not read or is no module, each with the module it is of; none where the main text ran. */
  readonly findings: string[];
  /** The reason, where the evaluation ended refuted. */
  readonly refuted?: string;
  /** The steps of reading, of the meaning rules and of the run together. */
  readonly steps: number;
}

/** A module emitted: the kernel's module, its identity and what it declares. */
interface Emitted {
  readonly value: Value;
  readonly identity: string;
  readonly declares: readonly Declaration[];
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const text = (t: string): Plain => ({ bits: encoder.encode(t) });
const record = (o: Record<string, Plain>): Plain => ({ entries: Object.entries(o).map(([key, v]) => [{ symbol: key }, v] as const) });
const list = (xs: readonly Plain[]): Plain => ({ entries: xs.map((x) => [null, x] as const) });

/** What a call into the Allegretto modules refused with. */
class Refusal extends Error {}

interface Reader {
  readonly k: Kernel;
  readonly call: (name: string, ...args: Value[]) => Value;
  readonly shipped: Value;
  readonly own: Value;
  readonly library: ReadonlyMap<string, Emitted>;
  readonly steps: () => number;
}

/** A kernel holding the reader and the meaning rules, with the engine's own modules as the bootstrap gave them. */
function reader(): Reader {
  const driven = drive(HOST, "next/ext/lib/host.alg", readUnder(process.cwd()));
  if (!driven.ok) throw new Error(`the host module's own text is refused: ${driven.findings.map((f) => f.message).join("; ")}`);
  const k = createKernel();
  const prims = new Map([...shippedByName.values()].map((p) => [p.hash, k.primitiveFunction(p)] as const));
  const library = new Map<string, Emitted>();
  let host: Value | undefined;
  driven.records.forEach((r, i) => {
    const program = JSON.parse(encode(r.program)) as SavedProgram;
    const value = load(k, program, prims);
    if (i === driven.records.length - 1) host = value;
    else library.set(r.file.split("/").pop()!.replace(/\.alg$/, ""), { value, identity: r.identity, declares: program.declares.map((d) => (d.identity === undefined ? { role: d.role, name: d.name } : { role: d.role, name: d.name, identity: d.identity })) as Declaration[] });
  });
  const made = k.evaluate(k.expression(host!, []), { steps: 10_000_000 });
  let steps = 0;
  const entry = (name: string): Value => {
    const found = k.entriesOf(k.current(made.value)).find(([key]) => key !== null && k.symbolName(key) === name);
    if (found === undefined) throw new Error(`the host module yields no ${name}`);
    return found[1];
  };
  const call = (name: string, ...args: Value[]): Value => {
    const r = k.evaluate(k.expression(entry(name), args), { steps: 2_000_000_000 });
    steps += r.steps;
    if (r.refuted) throw new Refusal(k.reasonOf(r.value) ?? "refused");
    return r.value;
  };
  const shipped = plainValue(k, list(SHIPPED_NAMES.filter((n) => shippedByName.has(n)).map((n) => record({ name: text(n), hash: text(shippedByName.get(n)!.hash) }))));
  const none = plainValue(k, list([]));
  const own = call("read", k.bits(encoder.encode(`${FAILURE_FUNCTIONS}\n${STREAM_FUNCTIONS}`)), k.bits(new Uint8Array(0)), none, none, none);
  return { k, call, shipped, own, library, steps: () => steps };
}

let shared: Reader | undefined;

/**
 * Runs the text called `main` among `texts`, each under the name a line
 * `import` or `use` writes for it. `inputs` are handed at the start.
 */
export function runTexts(main: string, texts: Readonly<Record<string, string>>, inputs: Readonly<Record<string, Plain>> = {}): Ran {
  // One kernel reads for every run: starting it is most of the time of a short one.
  const { k, call, shipped, own, library, steps: stepsSoFar } = (shared ??= reader());
  const before = stepsSoFar();
  const steps = (): number => stepsSoFar() - before;
  const said = (v: Value): string => decoder.decode(k.bitsOf(k.current(v)).bytes);
  const handed = plainValue(k, list(Object.entries(texts).map(([name, t]) => record({ name: text(name), text: text(t.replace(/\r\n/g, "\n")) }))));
  const findings: string[] = [];
  const emitted = new Map<string, Emitted | undefined>();
  const emit = (name: string, above: readonly string[]): Emitted | undefined => {
    const ready = library.get(name);
    if (ready !== undefined) return ready;
    if (emitted.has(name)) return emitted.get(name);
    const refused = (why: string): undefined => {
      findings.push(`${name}: ${why}`);
      emitted.set(name, undefined);
      return undefined;
    };
    if (above.includes(name)) return refused(`the module is needed by itself, through ${[...above, name].join(", ")}`);
    const source = texts[name];
    if (source === undefined) return refused("no text of that name was handed");
    try {
      const tree = call("read", k.bits(encoder.encode(source.replace(/\r\n/g, "\n"))), k.bits(encoder.encode(`${name}.alg`)), handed, shipped, own);
      const unread = said(call("failed", tree));
      if (unread !== "") return refused(unread.slice(1));
      // The modules the text needs, emitted first: each is handed to the meaning rules with what it declares and its identity.
      const needs = said(call("needed", tree)).split("\n").slice(1);
      const modules: Plain[] = [];
      for (const need of needs) {
        const m = emit(need, [...above, name]);
        if (m === undefined) return refused(`the module ${need}, which it needs, is no module`);
        modules.push(record({ name: text(need), declares: list(m.declares.filter((d) => d.role !== "module").map((d) => record({ role: text(d.role), name: text(d.name) }))), identity: text(m.identity) }));
      }
      const m = call("module_from", tree, shipped, plainValue(k, list(modules)), own);
      const summary = said(call("summary", m)).split("\n");
      if (summary[0] === "refused") return refused(summary.slice(1).join("; "));
      const keys = Number(summary[0].split(" ")[1]);
      const declares = summary.slice(1).map((l): Declaration => {
        const [role, declared, identity] = l.split(" ");
        return (identity === undefined ? { role, name: declared } : { role, name: declared, identity }) as Declaration;
      });
      const built = k.evaluate(k.expression(k.kernelPrimitive("build"), [call("description", m), k.structure([])]), { steps: 500_000_000 });
      if (built.refuted || k.kind(k.current(built.value)) !== "composed-function") return refused(`the kernel does not build the description: ${k.reasonOf(built.value) ?? "it gives no function"}`);
      const value = k.module(k.current(built.value), keys, declares);
      const made: Emitted = { value, identity: k.moduleOf(value) ?? "", declares };
      emitted.set(name, made);
      return made;
    } catch (x) {
      if (x instanceof Refusal) return refused(x.message);
      throw x;
    }
  };
  const lines: string[] = [];
  const program = emit(main, []);
  if (program === undefined) return { lines, findings, steps: steps() };
  const output = k.structure([[k.symbol("write"), k.primitiveFunction(outputWrite((line) => lines.push(line)))]]);
  const args: Value[] = [];
  for (const d of program.declares) {
    if (d.role === "module") continue;
    if (d.role === "capability" && d.name === "output") args.push(output);
    else if (d.role === "input" && Object.hasOwn(inputs, d.name)) args.push(plainValue(k, inputs[d.name]));
    else return { lines, findings: [`${main}: this runner hands no ${d.role} ${d.name}`], steps: steps() };
  }
  const ran = k.evaluate(k.expression(program.value, args), { steps: 100_000_000 });
  return { lines, findings, steps: steps() + ran.steps, ...(ran.refuted ? { refuted: k.reasonOf(ran.value) ?? "refuted" } : {}) };
}
