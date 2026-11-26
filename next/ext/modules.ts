// The two emitters of Allegretto, compared.
//
// Whose: the kernel stream (lane R). Chunk E7 of docs/plans/book-pass.md
// section 10, second part: "the same module by identity". One emitter is
// the bootstrap (next/bootstrap/emit.ts behind next/bootstrap/driver.ts,
// the acceptance stream's, called here and not changed). The other is
// written in Allegretto (next/ext/lib/meaning.alg): it takes the tree the
// engine reads with Allegretto's grammar and gives the description of the
// module's function, its declarations and its count of keys. The kernel
// builds the function from the description, and the module's identity is
// compared with the identity the bootstrap's module has.
//
// What the meaning rules are given, and do not work out: the names and
// hashes of the shipped primitives, the declarations and identity of each
// module a text imports (the bootstrap's driver emits those first; a
// loader in Allegretto is chunk E9), and the tree of the functions
// Allegretto writes for itself (the acceptance stream's text, read here
// by the engine).
//
//   npx tsx next/ext/modules.ts            every .alg under next/
//   npx tsx next/ext/modules.ts <part>     those whose path holds <part>

import * as fs from "node:fs";
import { drive, importedFile, type ReadText } from "../bootstrap/driver.js";
import { FAILURE_FUNCTIONS, SHIPPED_NAMES, STREAM_FUNCTIONS } from "../bootstrap/emit.js";
import { emitted, readUnder } from "../corpus/allegretto.js";
import { plainValue, type Plain } from "../launch/launcher.js";
import { createKernel } from "../kernel/create.js";
import type { Declaration, Kernel, Value } from "../kernel/interface.js";
import { load, type SavedProgram } from "../kernel/saved-program.js";
import { shippedByName } from "../prims/index.js";
import { texts } from "./readers.js";

/** The module that stands between this file and the Allegretto modules: it reads a text, and gives a module's parts. */
const HOST = [
  "import allegretto",
  "import engine",
  "import meaning",
  "p = engine.prepared(allegretto.language)",
  "export tree_of(text, name) => engine.parses_of(p, text, name)",
  "export one(a) => a.readings.h",
  "export module_from(tree, shipped, modules, own) => meaning.module_of(tree, {shipped: shipped, modules: modules, own: own})",
  "export description(m) => m.description",
  'export summary(m) => if is_failure(m) then "refused" ++ lines(m.findings, 0) else "keys " ++ int.text(m.keys) ++ declared(m.declares, 0)',
  'lines(f, i) => if i == count(f) then "" else "\\n" ++ f[i].message ++ lines(f, i + 1)',
  'declared(d, i) => if i == count(d) then "" else "\\n" ++ d[i].role ++ " " ++ d[i].name ++ (if count(d[i]) == 3 then " " ++ d[i].identity else "") ++ declared(d, i + 1)',
  'export reading(a) => if is_failure(a) then "no reading at " ++ int.text(a.at) else if count(a.readings.t) > 0 then "two readings" else "read"',
  "",
].join("\n");

/** What an emitter gives for a text: its module's identity, or the messages of its refusal. */
export type Emitted = { identity: string } | { refused: string[] };

/**
 * One text under both emitters. `same` is the same identity and the same
 * places, or a refusal by both; `worded` is the same messages too.
 * `places` is the first place one emitter gives a part and the other does
 * not, where there is one: a place is no part of a module's identity, so
 * the places are compared beside it.
 */
export interface ComparedModule {
  readonly file: string;
  readonly bootstrap: Emitted;
  readonly engine: Emitted;
  readonly same: boolean;
  readonly worded: boolean;
  readonly places?: string;
  /** How many places were compared: those the bootstrap's module has. */
  readonly placed: number;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const text = (t: string): Plain => ({ bits: encoder.encode(t) });
const record = (o: Record<string, Plain>): Plain => ({ entries: Object.entries(o).map(([key, v]) => [{ symbol: key }, v] as const) });
const list = (xs: readonly Plain[]): Plain => ({ entries: xs.map((x) => [null, x] as const) });

/** What a call into the Allegretto modules refused with. */
class Refusal extends Error {}

/** A kernel holding the engine, Allegretto's grammar and the meaning rules, with the calls into them. */
function emitter(): { k: Kernel; call: (name: string, ...args: Value[]) => Value; shipped: Value; own: Value; steps: () => number } {
  const e = emitted(HOST, "next/ext/lib/host.alg");
  if ("findings" in e) throw new Error(`the host module's own text is refused: ${e.findings.join("; ")}`);
  const k = createKernel();
  // Every shipped primitive is made known to the kernel: a description names one by its hash.
  const prims = new Map([...shippedByName.values()].map((p) => [p.hash, k.primitiveFunction(p)] as const));
  for (const d of e.imports) load(k, d, prims);
  const host = k.evaluate(k.expression(load(k, e.program, prims), []), { steps: 10_000_000 });
  let steps = 0;
  const entry = (name: string): Value => {
    const found = k.entriesOf(k.current(host.value)).find(([key]) => key !== null && k.symbolName(key) === name);
    if (found === undefined) throw new Error(`the host module yields no ${name}`);
    return found[1];
  };
  const call = (name: string, ...args: Value[]): Value => {
    const r = k.evaluate(k.expression(entry(name), args), { steps: 2_000_000_000 });
    steps += r.steps;
    // A reading or a rule that refuses: told as the engine's refusal of the text.
    if (r.refuted) throw new Refusal(k.reasonOf(r.value) ?? "refused");
    return r.value;
  };
  const shipped = plainValue(k, list(SHIPPED_NAMES.filter((n) => shippedByName.has(n)).map((n) => record({ name: text(n), hash: text(shippedByName.get(n)!.hash) }))));
  const own = call("one", call("tree_of", k.bits(encoder.encode(`${FAILURE_FUNCTIONS}\n${STREAM_FUNCTIONS}`)), k.bits(new Uint8Array(0))));
  return { k, call, shipped, own, steps: () => steps };
}

/** What the kernel calls the part a description's form writes. */
const PART: Record<string, string> = { apply: "expression", function: "function", structure: "structure" };

/**
 * The places of a text's parts as the bootstrap's saved program holds
 * them, each `kind@start-end:line:column`. The bootstrap counts the
 * units of a host string and the engine counts bytes, so the bootstrap's
 * offsets are counted again in bytes (readers.ts does the same).
 */
function savedPlaces(program: SavedProgram, source: string): Set<string> {
  const bytes = (to: number): number => encoder.encode(source.slice(0, to)).length;
  const out = new Set<string>();
  for (const node of program.nodes) {
    if (!("at" in node) || node.at === undefined) continue;
    const { start, end } = node.at;
    const column = encoder.encode(source.slice(source.lastIndexOf("\n", start.index - 1) + 1, start.index)).length + 1;
    out.add(`${node.k}@${bytes(start.index)}-${bytes(end.index)}:${start.line}:${column}`);
  }
  return out;
}

/** The places of the parts of a description the meaning rules gave, written the same way. */
function describedPlaces(k: Kernel, description: Value): Set<string> {
  const out = new Set<string>();
  const whole = (v: Value): number => k.bitsOf(v).bytes.reduce((n, b) => n * 256 + b, 0);
  const walk = (given: Value): void => {
    const v = k.current(k.evaluate(given).value);
    if (k.kind(v) !== "structure") return;
    const entries = k.entriesOf(v);
    const named = (name: string): Value | undefined => {
      const found = entries.find(([key]) => key !== null && k.kind(key) === "symbol" && k.symbolName(key) === name);
      return found === undefined ? undefined : k.current(k.evaluate(found[1]).value);
    };
    // A description has a symbol under `form`. The entries of a structure a text writes may be keyed `form` and `at` too: those are descriptions, and are walked.
    const [form, at] = [named("form"), named("at")];
    const described = form !== undefined && k.kind(form) === "symbol";
    if (described && at !== undefined) {
      const end = (which: string, part: string): number => {
        const side = k.entriesOf(at).find(([key]) => key !== null && k.symbolName(key) === which)![1];
        return whole(k.current(k.evaluate(k.entriesOf(k.current(k.evaluate(side).value)).find(([key]) => key !== null && k.symbolName(key) === part)![1]).value));
      };
      out.add(`${PART[k.symbolName(form!)] ?? k.symbolName(form!)}@${end("start", "index")}-${end("end", "index")}:${end("start", "line")}:${end("start", "column")}`);
    }
    for (const [key, e] of entries) if (!described || key === null || k.kind(key) !== "symbol" || k.symbolName(key) !== "at") walk(e);
  };
  walk(description);
  return out;
}

/** Each text under both emitters, in one kernel, with the steps the engine and the meaning rules took. */
export function comparedModules(files: readonly { file: string; text: string }[], readText: ReadText = readUnder(process.cwd())): { each: ComparedModule[]; steps: number } {
  const { k, call, shipped, own, steps } = emitter();
  const said = (v: Value): string => decoder.decode(k.bitsOf(k.current(v)).bytes);
  const each = files.map(({ file, text: given }): ComparedModule => {
    const source = given.replace(/\r\n/g, "\n");
    const driven = drive(source, file, readText);
    const bootstrap: Emitted = driven.ok
      ? { identity: driven.records[driven.records.length - 1].identity }
      : { refused: driven.findings.filter((f) => f.file === file).map((f) => f.message).sort() };
    let described: Value | undefined;
    const emittedByEngine = (): Emitted => {
      const parsed = call("tree_of", k.bits(encoder.encode(source)), k.bits(encoder.encode(file)));
      const how = said(call("reading", parsed));
      if (how !== "read") return { refused: [how] };
      // The modules the text imports, as the bootstrap's driver emitted them, each under the name of its file.
      // Where the bootstrap refuses the text itself, each text it imports is driven by itself.
      const imports = driven.ok
        ? driven.records.slice(0, -1)
        : [...source.matchAll(/^import ([a-z_][a-z0-9_]*)/gm)].flatMap(([, name]) => {
            const imported = importedFile(name, file);
            const read = readText(imported);
            const r = typeof read === "string" ? drive(read, imported, readText) : undefined;
            return r !== undefined && r.ok ? [r.records[r.records.length - 1]] : [];
          });
      const modules = plainValue(
        k,
        list(
          imports.map((r) =>
            record({
              name: text(r.file.split("/").pop()!.replace(/\.alg$/, "")),
              declares: list(r.program.declares.map((d) => record({ role: text(d.role), name: text(d.name) }))),
              identity: text(r.identity),
            }),
          ),
        ),
      );
      const m = call("module_from", call("one", parsed), shipped, modules, own);
      const summary = said(call("summary", m)).split("\n");
      if (summary[0] === "refused") return { refused: summary.slice(1).sort() };
      const keys = Number(summary[0].split(" ")[1]);
      const declares = summary.slice(1).map((l): Declaration => {
        const [role, name, identity] = l.split(" ");
        return (identity === undefined ? { role, name } : { role, name, identity }) as Declaration;
      });
      described = call("description", m);
      const built = k.evaluate(k.expression(k.kernelPrimitive("build"), [described, k.structure([])]), { steps: 500_000_000 });
      if (built.refuted || k.kind(k.current(built.value)) !== "composed-function") return { refused: [`the kernel does not build the description: ${k.reasonOf(built.value) ?? "it gives no function"}`] };
      // The kernel refuses a function that is no module, and declarations that fit none, with an error of its interface.
      try {
        return { identity: k.moduleOf(k.module(k.current(built.value), keys, declares)) ?? "no identity" };
      } catch (x) {
        return { refused: [`the kernel makes no module of it: ${x instanceof Error ? x.message : String(x)}`] };
      }
    };
    const engine = ((): Emitted => {
      try {
        return emittedByEngine();
      } catch (x) {
        if (x instanceof Refusal) return { refused: [x.message] };
        throw x;
      }
    })();
    const both = "refused" in bootstrap && "refused" in engine;
    const worded = both && bootstrap.refused.join("\n") === engine.refused.join("\n");
    // Where both give a module, the places its parts have: each emitter's that the other has not.
    let places: string | undefined;
    let placed = 0;
    if (driven.ok && described !== undefined && "identity" in engine) {
      const [theirs, mine] = [savedPlaces(driven.records[driven.records.length - 1].program, source), describedPlaces(k, described)];
      placed = theirs.size;
      const only = [...[...theirs].filter((x) => !mine.has(x)).map((x) => `the bootstrap alone places ${x}`), ...[...mine].filter((x) => !theirs.has(x)).map((x) => `the meaning rules alone place ${x}`)];
      if (only.length > 0) places = `${only[0]} (${only.length} in all, of ${theirs.size} and ${mine.size})`;
    }
    const same = both || ("identity" in bootstrap && "identity" in engine && bootstrap.identity === engine.identity && places === undefined);
    return { file, bootstrap, engine, same, worded: both ? worded : same, placed, ...(places === undefined ? {} : { places }) };
  });
  return { each, steps: steps() };
}

/** An emitter's answer on one line. */
export const shownEmitted = (e: Emitted): string => ("identity" in e ? `identity ${e.identity}` : `refused: ${e.refused.join(" | ")}`);

if (process.argv[1] !== undefined && import.meta.url === new URL(`file://${fs.realpathSync(process.argv[1])}`).href) {
  const part = process.argv[2];
  const files = texts("next").filter((f) => part === undefined || f.includes(part));
  const began = Date.now();
  const { each, steps } = comparedModules(files.map((file) => ({ file, text: fs.readFileSync(file, "utf8") })));
  for (const c of each) if (!c.same || !c.worded || part !== undefined) console.log(`${c.same ? ("identity" in c.engine ? "same   " : c.worded ? "refused" : "refused, worded otherwise") : "DIFFER "} ${c.file}\n   bootstrap: ${shownEmitted(c.bootstrap)}\n   engine:    ${shownEmitted(c.engine)}${c.places === undefined ? "" : `\n   places:    ${c.places}`}`);
  const count = (f: (c: ComparedModule) => boolean): number => each.filter(f).length;
  console.log(`${each.length} texts: ${count((c) => c.same && "identity" in c.engine)} the same identity, ${count((c) => c.same && "refused" in c.engine)} refused by both (${count((c) => "refused" in c.engine && c.worded)} in the same words), ${count((c) => !c.same)} differ; ${steps} steps, ${Math.round((Date.now() - began) / 1000)} s`);
  process.exitCode = each.every((c) => c.same) ? 0 : 1;
}
