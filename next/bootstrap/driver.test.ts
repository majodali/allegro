// Tests of the bootstrap's driver for imports (next/bootstrap/driver.ts):
// the texts a text imports are emitted first, in dependency order, each
// once, each with the identity the kernel gives its loaded record; and
// what it refuses. The texts are held in a map, so no file system is
// read. Run by `npm run test:next`.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as path from "path";
import { createKernel } from "../kernel/create.js";
import type { Value } from "../kernel/interface.js";
import { load } from "../kernel/saved-program.js";
import { shippedByName } from "../prims/index.js";
import { describeDriveFinding, drive, importedFile, type DriveFinding, type DrivenRecord, type ReadText } from "./driver.js";
import { emit } from "./emit.js";

/** A reader over texts held by file name, recording each file it is asked for. */
function texts(files: Record<string, string>): { readText: ReadText; asked: string[] } {
  const asked: string[] = [];
  return { asked, readText: (file) => (asked.push(file), Object.hasOwn(files, file) ? files[file] : undefined) };
}

function driven(main: string, files: Record<string, string>, file = "dir/main.alg"): readonly DrivenRecord[] {
  const r = drive(main, file, texts(files).readText);
  assert.ok(r.ok, r.ok ? "" : r.findings.map(describeDriveFinding).join("; "));
  return r.records;
}
function refused(main: string, files: Record<string, string>, file = "dir/main.alg"): readonly DriveFinding[] {
  const r = drive(main, file, texts(files).readText);
  assert.equal(r.ok, false);
  return r.ok ? [] : r.findings;
}

test("import name names the file name.alg in the directory of the importing text", () => {
  assert.equal(importedFile("lib", "dir/main.alg"), path.join("dir", "lib.alg"));
  assert.equal(importedFile("lib", "main.alg"), "lib.alg");
  assert.equal(importedFile("lib", "/a/b/main.alg"), "/a/b/lib.alg");
});

test("a text that imports nothing gives its one record, as the emitter writes it", () => {
  const text = 'capability output\noutput.write("hi")\n';
  const [only, ...rest] = driven(text, {});
  assert.deepEqual(rest, []);
  // Emitted under the file the driver read it from: every place in the record names that file.
  const e = emit(text, new Map(), "dir/main.alg");
  assert.ok(e.ok);
  assert.deepEqual(only.program, e.program);
  assert.equal(only.file, "dir/main.alg");
});

test("the imported texts come first, in dependency order, the main one last; each identity is the kernel's for the loaded record", () => {
  const files = {
    [path.join("dir", "derived.alg")]: "import base\nexport quadruple(n) => base.double(base.double(n))\n",
    [path.join("dir", "base.alg")]: "export double(n) => n * 2\n",
  };
  const records = driven("capability output\nimport derived\noutput.write(int.text(derived.quadruple(5)))\n", files);
  assert.deepEqual(records.map((r) => path.basename(r.file)), ["base.alg", "derived.alg", "main.alg"]);
  const k = createKernel();
  const byHash = new Map([...shippedByName.values()].map((p) => [p.hash, p] as const));
  const primitives = new Map<string, Value>();
  for (const r of records) {
    for (const n of r.program.needs) if (!primitives.has(n.hash)) primitives.set(n.hash, k.primitiveFunction(byHash.get(n.hash)!));
    assert.equal(k.moduleOf(load(k, r.program, primitives)), r.identity, r.file);
  }
  // Each import is declared with the identity of the record it names.
  const [base, derived, main] = records;
  assert.equal(derived.program.declares.find((d) => d.role === "module")?.identity, base.identity);
  assert.equal(main.program.declares.find((d) => d.role === "module")?.identity, derived.identity);
});

test("each text's parts name its own file: an imported text's places are in the imported file", () => {
  const lib = path.join("dir", "lib.alg");
  const records = driven("capability output\nimport lib\noutput.write(int.text(lib.double(21)))\n", { [lib]: "export double(n) =>\n  n * 2\n" });
  const sources = (r: DrivenRecord): string[] => [
    ...new Set(r.program.nodes.flatMap((n) => ((n.k === "expression" || n.k === "function" || n.k === "structure") && n.at !== undefined ? [n.at.source] : []))),
  ];
  assert.deepEqual(records.map((r) => [r.file, sources(r)]), [[lib, [lib]], ["dir/main.alg", ["dir/main.alg"]]]);
  // The function the imported text binds, from its line to the end of its body on the next line.
  const fn = records[0].program.nodes.find((n) => n.k === "function" && n.params.length === 1);
  assert.ok(fn !== undefined && fn.k === "function" && fn.at !== undefined);
  assert.deepEqual([fn.at.start, fn.at.end], [{ index: 0, line: 1, column: 1 }, { index: 27, line: 2, column: 8 }]);
});

test("a text two others import is read and emitted once", () => {
  const { readText, asked } = texts({
    [path.join("dir", "a.alg")]: "import shared\nexport y = shared.x\n",
    [path.join("dir", "b.alg")]: "import shared\nexport z = shared.x\n",
    [path.join("dir", "shared.alg")]: "x = 42\n",
  });
  const r = drive("import a\nimport b\n", "dir/main.alg", readText);
  assert.ok(r.ok);
  assert.deepEqual(r.records.map((x) => path.basename(x.file)), ["shared.alg", "a.alg", "b.alg", "main.alg"]);
  assert.equal(asked.filter((f) => path.basename(f) === "shared.alg").length, 1);
});

test("an imported text that is not found is refused, at the import, in the importing file", () => {
  const [f, ...rest] = refused("capability output\nimport nowhere\n", {});
  assert.deepEqual(rest, []);
  assert.deepEqual([f.file, f.kind, f.at.line, f.message], ["dir/main.alg", "not found", 2, "the text nowhere.alg, which import nowhere names, is not found in the directory of main.alg"]);
  assert.equal(describeDriveFinding(f), "dir/main.alg:2:1: the text nowhere.alg, which import nowhere names, is not found in the directory of main.alg");
});

test("a cycle of imports has no order: it is refused, naming the cycle", () => {
  const files = { [path.join("dir", "a.alg")]: "import b\nx = 1\n", [path.join("dir", "b.alg")]: "import a\ny = 2\n" };
  const [f, ...rest] = refused("import a\n", files);
  assert.deepEqual(rest, []);
  assert.deepEqual([path.basename(f.file), f.kind, f.message], ["b.alg", "cycle", "the imports form a cycle, which has no order: a imports b, which imports a"]);
  const self = refused("import main\n", {}, "dir/main.alg");
  assert.deepEqual(self.map((x) => x.message), ["the imports form a cycle, which has no order: main imports main"]);
});

test("a finding in an imported text is reported with its file, and the text that imports it is not emitted", () => {
  const files = { [path.join("dir", "lib.alg")]: "export f(n) => n + missing\n" };
  const findings = refused("import lib\nimport lib2\n", { ...files, [path.join("dir", "lib2.alg")]: "x = 1\n" });
  assert.deepEqual(findings.map((f) => [path.basename(f.file), f.kind, f.message]), [["lib.alg", "unbound", "the name missing is bound nowhere in the text"]]);
  const read = refused("import lib\n", { [path.join("dir", "lib.alg")]: "x = 1 +\n" });
  assert.deepEqual(read.map((f) => [path.basename(f.file), f.kind]), [["lib.alg", "read"]]);
});

test("an import whose arguments do not match what the imported module declares is the emitter's finding, in the importing file", () => {
  const files = { [path.join("dir", "lib.alg")]: "input n\nexport f() => n\n" };
  const findings = refused("import lib\n", files);
  assert.deepEqual(findings.map((f) => [f.file, f.kind, f.message]), [
    ["dir/main.alg", "import", "lib declares the input n, which this module neither holds under that name, nor hands with with, nor withholds"],
  ]);
  assert.equal(driven("import lib with n: 1\n", files).length, 2);
});
