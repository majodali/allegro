// The bootstrap's driver for imports (B-196 (the rebuild's acceptance
// side), chunk Q5 (the first notation and the bootstrap), part 5): given
// a text and where it was read from, it emits the texts the text imports
// first, in dependency order, and then the text itself, so the emitter
// (next/bootstrap/emit.ts) has the declarations and identity of every
// module an import names.
//
// How the identity is got, as the kernel stream's hand-off of PR #268
// says: the imported text is emitted first, and its record's `declares`
// are its declarations; the record is loaded into a kernel with `load`
// (next/kernel/saved-program.ts), which constructs and evaluates nothing;
// and `Kernel.moduleOf` of what `load` returns is the identity. One
// kernel serves a whole drive.
//
// Where an imported text is found. `import name` in a text read from the
// file F names the file `name.alg` in the directory of F
// (`importedFile`). This is the acceptance stream's choice, for the
// maintainer to ratify. The driver reads a file only through the function
// its caller passes in (`ReadText`), so a test needs no file system and
// the rule is in this one place.
//
// What it answers: the records in the order they are to be loaded, the
// main text's last, each once however many texts import it. What it
// refuses, with the file each finding is in:
//   - an imported text that is not found;
//   - a cycle of imports, which has no order, naming the cycle;
//   - a finding of the reader or the emitter in any text, the imported
//     ones included. A text that imports one with a finding is not
//     emitted: the finding in the imported text is the one reported.
//
// What it realises, from docs/plans/book-pass-inventory.md:
//   "A module is a function of its capabilities, inputs and imports": the
//     imported modules are emitted, and their identities taken, before the
//     module that imports them
//
// Used by `npm run allegretto` and `npm run emit`, and by the corpus's
// `runProgram` (next/corpus/allegretto.ts). Tested by
// next/bootstrap/driver.test.ts.

import * as path from "path";
import type { CreateKernel, Kernel, Value } from "../kernel/interface.js";
import { createKernel as referenceKernel } from "../kernel/create.js";
import { load, type SavedProgram } from "../kernel/saved-program.js";
import { shippedByName } from "../prims/index.js";
import { read, type Header, type Place } from "./reader.js";
import { emitModule, type Finding, type FormId, type ImportedModule } from "./emit.js";

/** Reads the text of a file, or gives undefined where there is none. */
export type ReadText = (file: string) => string | undefined;

/** One emitted text: where it was read from, its record, the identity the kernel gives its module, and the forms the text uses. */
export interface DrivenRecord {
  readonly file: string;
  readonly program: SavedProgram;
  readonly identity: string;
  readonly forms: readonly FormId[];
}

/** Why a drive gives no records: a finding, in the file it is in. */
export interface DriveFinding {
  readonly file: string;
  readonly at: Place;
  /** The emitter's kinds, and "not found" and "cycle" for an import the driver cannot follow. */
  readonly kind: Finding["kind"] | "not found" | "cycle";
  readonly message: string;
}

export type DriveResult =
  | { readonly ok: true; readonly records: readonly DrivenRecord[] }
  | { readonly ok: false; readonly findings: readonly DriveFinding[] };

/** The file `import name` names in a text read from `importer`: `name.alg` in the importer's directory. */
export function importedFile(name: string, importer: string): string {
  return path.join(path.dirname(importer), `${name}.alg`);
}

/** One line for a finding, for a person: `file:line:column: message`, as `npm run emit` prints one. */
export function describeDriveFinding(f: DriveFinding): string {
  return `${f.file}:${f.at.line}:${f.at.column}: ${f.message}`;
}

/** The name a text is imported under, from its file: the file's name without `.alg`. */
const nameOf = (file: string): string => path.basename(file, ".alg");

/**
 * Emits a text and every text it imports, each imported one first.
 * `file` is where the text was read from; `readText` reads every imported
 * text. The kernel identities are taken in a kernel `createKernel` makes,
 * the reference kernel unless the caller passes another.
 */
export function drive(text: string, file: string, readText: ReadText, createKernel: CreateKernel = referenceKernel): DriveResult {
  const kernel: Kernel = createKernel();
  const primitives = new Map<string, Value>();
  const records: DrivenRecord[] = [];
  const findings: DriveFinding[] = [];
  /** Each text emitted or refused, by its file: its record, or undefined where it has a finding. */
  const done = new Map<string, DrivenRecord | undefined>();
  /** The texts being emitted, outermost first: an import of one of them is a cycle. */
  const open: string[] = [];

  const visit = (source: string, at: string): DrivenRecord | undefined => {
    const key = path.normalize(at);
    open.push(key);
    try {
      const r = read(source);
      if (!r.ok) {
        for (const f of r.findings) findings.push({ file: at, at: f.at, kind: "read", message: f.message });
        return undefined;
      }
      const imports = new Map<string, ImportedModule>();
      let complete = true;
      for (const h of r.module.headers.filter((x): x is Header => x.k === "import")) {
        const target = importedFile(h.name.name, at);
        const targetKey = path.normalize(target);
        const cycleFrom = open.indexOf(targetKey);
        if (cycleFrom >= 0) {
          const chain = [...open.slice(cycleFrom), targetKey].map(nameOf);
          findings.push({
            file: at,
            at: h.at,
            kind: "cycle",
            message: `the imports form a cycle, which has no order: ${chain[0]} imports ${chain.slice(1).join(", which imports ")}`,
          });
          complete = false;
          continue;
        }
        let record: DrivenRecord | undefined;
        if (done.has(targetKey)) record = done.get(targetKey);
        else {
          const imported = readText(target);
          if (imported === undefined) {
            findings.push({
              file: at,
              at: h.at,
              kind: "not found",
              message: `the text ${h.name.name}.alg, which import ${h.name.name} names, is not found in the directory of ${path.basename(at)}`,
            });
            done.set(targetKey, undefined);
            complete = false;
            continue;
          }
          record = visit(imported, target);
          done.set(targetKey, record);
        }
        if (record === undefined) complete = false;
        else imports.set(h.name.name, { declares: record.program.declares, identity: record.identity });
      }
      // A text that imports one with a finding is not emitted: that finding is the one to read.
      if (!complete) return undefined;
      const e = emitModule(r.module, imports);
      if (!e.ok) {
        for (const f of e.findings) findings.push({ file: at, at: f.at, kind: f.kind, message: f.message });
        return undefined;
      }
      const record: DrivenRecord = { file: at, program: e.program, identity: identityOf(e.program, at), forms: e.forms };
      records.push(record);
      return record;
    } finally {
      open.pop();
    }
  };

  /** The identity of a record's module: the record loaded into the drive's kernel, read with `moduleOf`. */
  const identityOf = (program: SavedProgram, at: string): string => {
    for (const need of program.needs) {
      if (primitives.has(need.hash)) continue;
      const p = shippedByName.get(need.name);
      if (p === undefined || p.hash !== need.hash) throw new Error(`${at}: the record needs ${need.name} (${need.hash}), which next/prims does not ship`);
      primitives.set(need.hash, kernel.primitiveFunction(p));
    }
    const identity = kernel.moduleOf(load(kernel, program, primitives));
    if (identity === undefined) throw new Error(`${at}: the kernel gives the loaded record no identity`);
    return identity;
  };

  const main = visit(text, file);
  if (findings.length > 0 || main === undefined) return { ok: false, findings };
  // Each text once, in the order emitted: an imported text before every text that imports it, the main text last.
  return { ok: true, records };
}
